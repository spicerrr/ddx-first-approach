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
  return station.stage === "BENCH"
    ? progress.benchChecks.length + progress.benchAdjustments.length
    : Object.keys(progress.placements[station.stage]).length;
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

export function submit(progress: Progress, action: Action, at = new Date().toISOString()): Result {
  const reject = (message: string): Result => ({ progress, accepted: false, message });
  if (progress.phase !== "playing") return reject("Продолжи прохождение со своего экрана.");

  const station = stations[progress.stageIndex];
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
        return reject(`Сначала нужно ${task.check.label.toLocaleLowerCase("ru-RU")}.`);
      }
      updated = { ...progress, benchChecks: [...progress.benchChecks, action.check] };
      message = "Проверка отмечена.";
    }
  } else {
    if (station.stage !== action.stage) return reject("Выбери предмет текущей станции.");

    const item = station.items.find(({ id }) => id === action.item);
    const target = station.targets.find(({ id }) => id === action.destination);
    if (!item || !target) return reject("Выбери предмет и подписанное место для него.");

    const placements = progress.placements[action.stage];
    if (Object.hasOwn(placements, item.id)) return reject("Этот предмет уже на месте.");

    if (action.stage === "BARBELL") {
      const duplicate = station.items.some((candidate) =>
        candidate.weightKg === item.weightKg && placements[candidate.id] === target.id,
      );
      if (duplicate) {
        return reject(`Здесь уже есть диск ${item.weightKg} кг. Поставь второй диск такого веса с другой стороны.`);
      }
    } else {
      const expected = placementDestination(action.stage, item.id);
      if (expected !== target.id) {
        const label = station.targets.find(({ id }) => id === expected)?.label;
        return reject(label ? `Для этого предмета нужно другое место: «${label}».` : "Зона для этого предмета недоступна.");
      }
    }

    updated = {
      ...progress,
      placements: { ...progress.placements, [action.stage]: { ...placements, [item.id]: target.id } },
    };
    message = "На месте.";
  }

  if (stationProgress(updated, station) === stationTotal(station)) {
    const events: GameEvent[] = [
      ...updated.events,
      { type: "game_stage_completed", at, stage: station.stage },
    ];
    if (updated.stageIndex === lastStation) events.push({ type: "game_session_completed", at });
    updated = { ...updated, phase: "lesson", events };
  }

  return { progress: updated, accepted: true, message };
}
