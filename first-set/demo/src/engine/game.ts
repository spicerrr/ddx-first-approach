import { checkBarbell, moveBarbell, newAssembly, toggleCollar, type BarbellAssembly, type BarbellDestination, type BarbellIssue } from "./barbell";
import { benchGoals, benchNotches, benchParts, floorId, inventoryLayout, lastStation, stations,
  type BarbellSide, type BenchNotch, type BenchPart, type Station } from "./scenario";
import { createInventoryInitialLayout } from "./inventory";

export type Phase = "ready" | "playing" | "lesson" | "complete";

export type Progress = {
  phase: Phase;
  stageIndex: number;
  inventoryInitial: Readonly<Record<string, string>>;
  placements: Record<"DUMBBELLS" | "INVENTORY", Record<string, string>>;
  barbell: BarbellAssembly;
  benchPositions: Record<BenchPart, BenchNotch>;
  benchAdjustments: BenchPart[];
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
  issue?: BarbellIssue;
};

export function newProgress(): Progress {
  return {
    phase: "ready",
    stageIndex: 0,
    inventoryInitial: {},
    placements: { DUMBBELLS: {}, INVENTORY: {} },
    barbell: newAssembly(),
    benchPositions: { backrest: benchNotches[0], seat: benchNotches[0] },
    benchAdjustments: [],
  };
}

export function start(progress: Progress, rng = Math.random): Progress {
  if (progress.phase !== "ready") return progress;
  return {
    ...progress,
    phase: "playing",
    inventoryInitial: stations[progress.stageIndex].stage === "INVENTORY"
      ? createInventoryInitialLayout(rng) : progress.inventoryInitial,
  };
}

export function completedStationCount(progress: Progress) {
  return progress.stageIndex + Number(progress.phase === "lesson" || progress.phase === "complete");
}

export function restoreProgress(completed: number): Progress {
  const progress = newProgress();
  if (completed >= stations.length) return { ...progress, stageIndex: lastStation, phase: "complete" };
  return { ...progress, stageIndex: completed };
}

export function stationProgress(progress: Progress, station: Station) {
  if (station.stage === "BENCH") return progress.benchAdjustments.length;
  if (station.stage === "BARBELL") {
    return Number(completedStationCount(progress) > stations.findIndex(({ stage }) => stage === station.stage));
  }
  const placements = Object.values(progress.placements[station.stage]);
  if (station.stage === "DUMBBELLS") {
    return station.targets.filter(({ id }) => placements.filter((target) => target === id).length === 2).length;
  }
  return placements.length;
}

export function stationTotal(station: Station) {
  if (station.stage === "BARBELL") return 1;
  if (station.stage === "BENCH") return benchParts.length;
  if (station.stage === "DUMBBELLS") return station.targets.length;
  return station.items.length - inventoryLayout.platesPreplaced - inventoryLayout.distinctStorageZonesPreplaced;
}

export function inventoryPlacements(progress: Progress) {
  return { ...progress.inventoryInitial, ...progress.placements.INVENTORY };
}

export function nextStation(progress: Progress): Progress {
  if (progress.phase !== "lesson") return progress;
  return { ...progress, phase: "ready", stageIndex: progress.stageIndex + 1 };
}

function finishStation(progress: Progress): Progress {
  return { ...progress, phase: progress.stageIndex === lastStation ? "complete" : "lesson" };
}

export function submit(progress: Progress, action: Action): Result {
  const reject = (message: string, issue?: BarbellIssue): Result => ({ progress, accepted: false, message, issue });
  const accept = (next: Progress, message: string): Result => ({ progress: next, accepted: true, message });
  const station = stations[progress.stageIndex];
  const benchPractice = progress.phase === "lesson" && station.stage === "BENCH"
    && (action.kind === "bench-adjustment" || action.kind === "finish-bench");
  if (progress.phase !== "playing" && !benchPractice) return reject("Продолжи прохождение со своего экрана.");
  if (action.kind === "check-barbell") {
    if (station.stage !== "BARBELL") return reject("Выбери действие текущей станции.");
    const result = checkBarbell(progress.barbell);
    return result.accepted ? accept(finishStation(progress), result.message) : reject(result.message, result.issue);
  }

  if (action.kind === "reset-barbell") {
    if (station.stage !== "BARBELL") return reject("Сброс доступен на станции со штангой.");
    return accept({ ...progress, barbell: newAssembly() }, "");
  }

  if (action.kind === "move-barbell") {
    if (station.stage !== "BARBELL") return reject("Выбери действие текущей станции.");
    const result = moveBarbell(progress.barbell, action.item, action.destination);
    return result.accepted ? accept({ ...progress, barbell: result.assembly }, result.message) : reject(result.message, result.issue);
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
    const next = {
      ...progress,
      benchPositions: { ...progress.benchPositions, [action.part]: action.notch },
      benchAdjustments: pending && action.notch === benchGoals[pending]
        ? [...progress.benchAdjustments, pending]
        : progress.benchAdjustments,
    };
    const finished = pending && next.benchAdjustments.length === benchParts.length;
    return accept(finished ? finishStation(next) : next, "");
  }

  if (action.kind === "finish-bench") {
    if (station.stage !== "BENCH" || !benchParts.every((part) => progress.benchAdjustments.includes(part))) {
      return reject("Отрегулируй спинку и сиденье.");
    }
    return accept(nextStation(progress), "");
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
      if (target.id !== item.targetId) {
        return reject("Посмотри на соседние пары. Куда подойдёт этот вес, если ряд идёт от лёгких гантелей к тяжёлым?");
      }
      assigned[item.id] = target.id;
    }
  } else {
    if (Object.hasOwn(progress.inventoryInitial, item.id) || Object.hasOwn(placements, item.id)) {
      return reject("Этот предмет уже на месте.");
    }
    const expected = item.targetId;
    if (target?.id !== expected) {
      if (item.id.startsWith("PLATE_")) return reject(`На стойке у каждого веса своё место. Для этого диска подойдёт штырь с отметкой ${item.weightKg} кг.`);
      if (expected === "BANDS") return reject("Резинку можно повесить на крючки сбоку стеллажа.");
      const label = station.targets.find(({ id }) => id === expected)?.label;
      return reject(label ? `Для этого предмета подходит зона «${label}». Попробуй её.` : "Давай найдём подходящую зону хранения.");
    }
    assigned[item.id] = action.destination;
  }

  let updated = { ...progress, placements: { ...progress.placements, [action.stage]: assigned } };
  if (stationProgress(updated, station) === stationTotal(station)) {
    updated = finishStation(updated);
  }
  return accept(updated, "");
}
