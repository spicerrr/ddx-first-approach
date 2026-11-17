import { checkBarbell, moveBarbell, newAssembly, type BarbellAssembly, type BarbellDestination } from "./barbell";
import { benchFinalCheck, benchParts, floorId, inventoryDestination, lastStation, stations, stationTotal,
  type BenchPart, type Station, type StationId } from "./scenario";

export type Phase = "ready" | "playing" | "lesson" | "complete";
export type GameEvent =
  | { type: "game_session_started" | "game_session_completed"; at: string }
  | { type: "game_stage_completed"; at: string; stage: StationId };

export type Progress = {
  phase: Phase;
  stageIndex: number;
  placements: Record<"DUMBBELLS" | "INVENTORY", Record<string, string>>;
  barbell: BarbellAssembly;
  benchChecks: string[];
  benchAdjustments: BenchPart[];
  events: GameEvent[];
};

export type Action =
  | { kind: "place"; stage: "DUMBBELLS" | "INVENTORY"; item: string; destination: string }
  | { kind: "move-barbell"; item: string; destination: BarbellDestination }
  | { kind: "check-barbell" }
  | { kind: "bench"; check: string }
  | { kind: "bench-adjustment"; part: BenchPart };

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
    benchChecks: [],
    benchAdjustments: [],
    events: [],
  };
}

export function start(progress: Progress, at = new Date().toISOString()): Progress {
  if (progress.phase !== "ready") return progress;
  return { ...progress, phase: "playing", events: [{ type: "game_session_started", at }] };
}

export function stationProgress(progress: Progress, station: Station) {
  if (station.stage === "BENCH") return progress.benchChecks.length + progress.benchAdjustments.length;
  if (station.stage === "BARBELL") {
    return Number(progress.events.some((event) => event.type === "game_stage_completed" && event.stage === "BARBELL"));
  }
  const placements = Object.values(progress.placements[station.stage]);
  if (station.stage === "DUMBBELLS") {
    return station.targets.filter(({ id }) => placements.filter((target) => target === id).length === 2).length;
  }
  return placements.length;
}

export function benchTask(progress: Progress, station: Station) {
  const check = station.items[progress.benchChecks.length];
  if (!check) return null;
  const part = benchParts[progress.benchAdjustments.length];
  return check.id === benchFinalCheck && part
    ? { kind: "adjust" as const, part }
    : { kind: "check" as const, check };
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

  if (action.kind === "move-barbell") {
    if (station.stage !== "BARBELL") return reject("Выбери действие текущей станции.");
    const result = moveBarbell(progress.barbell, action.item, action.destination);
    return result.accepted ? accept({ ...progress, barbell: result.assembly }, result.message) : reject(result.message);
  }

  let updated: Progress;
  let message: string;
  if (action.kind === "bench" || action.kind === "bench-adjustment") {
    if (station.stage !== "BENCH") return reject("Выбери действие текущей станции.");
    const task = benchTask(progress, station);
    if (!task) return reject("Скамья уже проверена.");
    if (task.kind === "adjust") {
      if (action.kind !== "bench-adjustment" || action.part !== task.part) {
        return reject(task.part === "backrest" ? "Сначала настрой спинку." : "Сначала настрой сиденье.");
      }
      updated = { ...progress, benchAdjustments: [...progress.benchAdjustments, action.part] };
      message = "Фиксация проверена.";
    } else {
      if (action.kind !== "bench" || task.check.id !== action.check) {
        return reject(task.check.id === benchFinalCheck
          ? "Перед подходом проверь, что скамья стоит устойчиво."
          : "Сначала освободи скамью от инвентаря.");
      }
      updated = { ...progress, benchChecks: [...progress.benchChecks, action.check] };
      message = "Проверка пройдена.";
    }
  } else {
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
        message = "";
      } else {
        const beside = station.items.filter((other) => placements[other.id] === target.id);
        if (beside.length === 2) return reject("Здесь уже стоит пара. Попробуй соседние места.");
        if (beside.length && beside[0].weightKg !== item.weightKg) {
          return reject(`Здесь стоит гантель ${beside[0].weightKg} кг. Найди вторую с такой же цифрой.`);
        }
        const matching = station.items.find((other) => other.id !== item.id && other.weightKg === item.weightKg);
        if (matching && placements[matching.id] && placements[matching.id] !== target.id) {
          return reject("Вторая гантель этого веса уже на стойке. Поставь их рядом.");
        }
        assigned[item.id] = target.id;
        message = beside.length ? "Пара на месте." : "";
      }
    } else {
      if (Object.hasOwn(placements, item.id)) return reject("Этот предмет уже на месте.");
      const expected = inventoryDestination(item);
      if (target?.id !== expected) {
        const label = station.targets.find(({ id }) => id === expected)?.label;
        return reject(label ? `Для этого предмета подходит «${label}».` : "Зона для этого предмета недоступна.");
      }
      assigned[item.id] = action.destination;
      message = "На месте.";
    }
    updated = { ...progress, placements: { ...progress.placements, [action.stage]: assigned } };
  }

  if (stationProgress(updated, station) === stationTotal(station)) {
    updated = finishStation(updated, station.stage, at);
  }
  return accept(updated, message);
}
