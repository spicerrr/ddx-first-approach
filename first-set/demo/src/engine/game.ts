import { checkBarbell } from "./barbell";
import { benchFinalCheck, benchParts, lastStation, placementDestination, stations, stationTotal,
  type BenchPart, type PlacementStation, type Station, type StationId } from "./scenario";

export type Phase = "ready" | "playing" | "lesson" | "complete";
export type GameEvent =
  | { type: "game_session_started" | "game_session_completed"; at: string }
  | { type: "game_stage_completed"; at: string; stage: StationId };

export type Progress = {
  phase: Phase;
  stageIndex: number;
  placements: Record<PlacementStation, Record<string, string>>;
  benchChecks: string[];
  benchAdjustments: BenchPart[];
  events: GameEvent[];
};

export type Action =
  | { kind: "place"; stage: PlacementStation; item: string; destination: string }
  | { kind: "remove-disk"; item: string }
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
    placements: { DUMBBELLS: {}, BARBELL: {}, INVENTORY: {} },
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
  return Object.keys(progress.placements[station.stage]).length;
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
    const result = checkBarbell(progress.placements.BARBELL);
    return result.accepted ? accept(finishStation(progress, "BARBELL", at), result.message) : reject(result.message);
  }

  if (action.kind === "remove-disk") {
    if (station.stage !== "BARBELL") return reject("Выбери действие текущей станции.");
    const disks = { ...progress.placements.BARBELL };
    if (!Object.hasOwn(disks, action.item)) return reject("Выбери установленный диск.");
    delete disks[action.item];
    return accept({ ...progress, placements: { ...progress.placements, BARBELL: disks } }, "Диск возвращён в лоток.");
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
    if (!item || !target) return reject("Выбери предмет и место для него.");

    const placements = progress.placements[action.stage];
    if (action.stage === "BARBELL") {
      if (placements[item.id] === target.id) return reject("Диск уже на этой стороне.");
    } else {
      if (Object.hasOwn(placements, item.id)) return reject("Этот предмет уже на месте.");
      const expected = placementDestination(action.stage, item);
      if (expected !== target.id) {
        const label = station.targets.find(({ id }) => id === expected)?.label;
        return reject(label ? `Для этого предмета подходит «${label}».` : "Зона для этого предмета недоступна.");
      }
    }

    updated = { ...progress, placements: { ...progress.placements, [action.stage]: { ...placements, [item.id]: target.id } } };
    message = action.stage === "BARBELL" ? "Штанга обновлена." : "На месте.";
  }

  if (station.stage !== "BARBELL" && stationProgress(updated, station) === stationTotal(station)) {
    updated = finishStation(updated, station.stage, at);
  }
  return accept(updated, message);
}
