import { checkBarbell, moveBarbell, newAssembly, toggleCollar, type BarbellAssembly, type BarbellDestination } from "./barbell";
import { benchGoals, benchNotches, benchParts, floorId, inventoryDestination, lastStation, rackTargets, stations, stationTotal,
  type BarbellSide, type BenchNotch, type BenchPart, type Station, type StationId } from "./scenario";

export type Phase = "ready" | "playing" | "lesson" | "complete";
export type GameEvent =
  | { type: "game_session_started" | "game_session_completed"; at: string }
  | { type: "game_stage_completed"; at: string; stage: StationId };

export type Progress = {
  phase: Phase;
  stageIndex: number;
  placements: Record<"DUMBBELLS" | "INVENTORY", Record<string, string>>;
  barbell: BarbellAssembly;
  benchPositions: Record<BenchPart, BenchNotch>;
  benchAdjustments: BenchPart[];
  events: GameEvent[];
};

export type Action =
  | { kind: "place"; stage: "DUMBBELLS" | "INVENTORY"; item: string; destination: string }
  | { kind: "reset-barbell" }
  | { kind: "move-barbell"; item: string; destination: BarbellDestination }
  | { kind: "check-barbell" }
  | { kind: "toggle-collar"; side: BarbellSide }
  | { kind: "bench-adjustment"; part: BenchPart; notch: BenchNotch }
  | { kind: "finish-bench" };

export type Result = {
  progress: Progress;
  accepted: boolean;
  message: string;
};

export function newProgress(): Progress {
  return {
    phase: "ready",
    stageIndex: 0,
    placements: { DUMBBELLS: {}, INVENTORY: {} },
    barbell: newAssembly(),
    benchPositions: { backrest: 0, seat: 0 },
    benchAdjustments: [],
    events: [],
  };
}

export function start(progress: Progress, at = new Date().toISOString()): Progress {
  if (progress.phase !== "ready") return progress;
  return { ...progress, phase: "playing", events: [{ type: "game_session_started", at }] };
}

export function stationProgress(progress: Progress, station: Station) {
  if (station.stage === "BENCH") return progress.benchAdjustments.length;
  if (station.stage === "BARBELL") {
    return Number(progress.events.some((event) => event.type === "game_stage_completed" && event.stage === "BARBELL"));
  }
  const placements = Object.values(progress.placements[station.stage]);
  if (station.stage === "DUMBBELLS") {
    return station.targets.filter(({ id }) => placements.filter((target) => target === id).length === 2).length;
  }
  return placements.length;
}

export function nextStation(progress: Progress): Progress {
  if (progress.phase !== "lesson") return progress;
  return progress.stageIndex === lastStation
    ? { ...progress, phase: "complete" }
    : { ...progress, phase: "playing", stageIndex: progress.stageIndex + 1 };
}

function finishStation(progress: Progress, stage: StationId, at: string): Progress {
  const events: GameEvent[] = [...progress.events, { type: "game_stage_completed", at, stage }];
  if (progress.stageIndex === lastStation) events.push({ type: "game_session_completed", at });
  return { ...progress, phase: "lesson", events };
}

export function submit(progress: Progress, action: Action, at = new Date().toISOString()): Result {
  const reject = (message: string): Result => ({ progress, accepted: false, message });
  const accept = (next: Progress, message: string): Result => ({ progress: next, accepted: true, message });
  if (progress.phase !== "playing") return reject("Продолжи прохождение со своего экрана.");

  const station = stations[progress.stageIndex];
  if (action.kind === "check-barbell") {
    if (station.stage !== "BARBELL") return reject("Выбери действие текущей станции.");
    const result = checkBarbell(progress.barbell);
    return result.accepted ? accept(finishStation(progress, "BARBELL", at), result.message) : reject(result.message);
  }

  if (action.kind === "reset-barbell") {
    if (station.stage !== "BARBELL") return reject("Сброс доступен на станции со штангой.");
    return accept({ ...progress, barbell: newAssembly() }, "");
  }

  if (action.kind === "move-barbell") {
    if (station.stage !== "BARBELL") return reject("Выбери действие текущей станции.");
    const result = moveBarbell(progress.barbell, action.item, action.destination);
    return result.accepted ? accept({ ...progress, barbell: result.assembly }, result.message) : reject(result.message);
  }

  if (action.kind === "toggle-collar") {
    if (station.stage !== "BARBELL") return reject("Выбери действие текущей станции.");
    const barbell = toggleCollar(progress.barbell, action.side);
    return barbell ? accept({ ...progress, barbell }, "") : reject("Надень замок на втулку.");
  }

  if (action.kind === "bench-adjustment") {
    if (station.stage !== "BENCH" || !benchParts.includes(action.part) || !benchNotches.includes(action.notch)) {
      return reject("Выбери положение подушки на скамье.");
    }
    const pending = benchParts.find((part) => !progress.benchAdjustments.includes(part));
    if (pending && action.part !== pending) return reject("Выполни текущую настройку.");
    if (progress.benchPositions[action.part] === action.notch) return reject("");
    return accept({
      ...progress,
      benchPositions: { ...progress.benchPositions, [action.part]: action.notch },
      benchAdjustments: pending && action.notch === benchGoals[pending]
        ? [...progress.benchAdjustments, pending]
        : progress.benchAdjustments,
    }, "");
  }

  if (action.kind === "finish-bench") {
    if (station.stage !== "BENCH" || !benchParts.every((part) => progress.benchAdjustments.includes(part))) {
      return reject("Отрегулируй спинку и сиденье.");
    }
    return accept(nextStation(finishStation(progress, "BENCH", at)), "");
  }

  if (station.stage !== action.stage) return reject("Выбери предмет текущей станции.");

  const item = station.items.find(({ id }) => id === action.item);
  const target = station.targets.find(({ id }) => id === action.destination);
  if (!item || (!target && !(action.stage === "DUMBBELLS" && action.destination === floorId))) {
    return reject("Выбери предмет и место для него.");
  }
  const placements = progress.placements[action.stage];
  const assigned = { ...placements };
  if (placements[item.id] === action.destination) return reject("");

  if (action.stage === "DUMBBELLS") {
    if (!target) {
      if (!Object.hasOwn(placements, item.id)) return reject("");
      delete assigned[item.id];
    } else {
      const pocket = rackTargets.find(({ id }) => id === target.id);
      if (pocket?.weightKg !== item.weightKg) {
        return reject("Посмотри на соседние пары. Куда подойдёт этот вес, если ряд идёт от лёгких гантелей к тяжёлым?");
      }
      assigned[item.id] = target.id;
    }
  } else {
    if (Object.hasOwn(placements, item.id)) return reject("Этот предмет уже на месте.");
    const expected = inventoryDestination(item);
    if (target?.id !== expected) {
      const label = station.targets.find(({ id }) => id === expected)?.label;
      return reject(label ? `Посмотри на зону «${label}». Там следующий человек будет искать этот инвентарь.` : "Давай найдём подходящую зону хранения.");
    }
    assigned[item.id] = action.destination;
  }

  let updated = { ...progress, placements: { ...progress.placements, [action.stage]: assigned } };
  if (stationProgress(updated, station) === stationTotal(station)) {
    updated = finishStation(updated, station.stage, at);
  }
  return accept(updated, "");
}
