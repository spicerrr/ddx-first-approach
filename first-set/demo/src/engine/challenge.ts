import { newProgress, start, submit, type Action, type Progress } from "./game";
import { inventoryDestination, stations, type StationId } from "./scenario";

export const challengeWeight = 70;
const challengeNotch = 1;
const tasks = {
  DUMBBELLS: "Две гантели остались на полу. Верни пару на стойку.",
  BARBELL: `Собери штангу весом ${challengeWeight} кг и проверь сборку.`,
  BENCH: "Подними спинку на одну ступень от исходного положения и зафиксируй её.",
  INVENTORY: "Найди три предмета, оставленных на полу, и верни их на места.",
};
const lastItems = new Set(["PLATE_15", "BAND_1", "ROLLER_2"]);
const stages = Object.keys(tasks) as StationId[];

export type Challenge = {
  stage: StationId;
  task: string;
  progress: Progress;
  outcome: "idle" | "placed" | "retry" | "passed";
  canFinish: boolean;
};

export function newChallenge(stage = stages[Math.floor(Math.random() * stages.length)]): Challenge {
  const stageIndex = stations.findIndex((station) => station.stage === stage);
  const station = stations[stageIndex];
  const progress = { ...start(newProgress()), stageIndex };
  if (stage === "DUMBBELLS") {
    progress.placements.DUMBBELLS = Object.fromEntries(station.items
      .filter((item) => item.weightKg !== 12).map((item) => [item.id, "RACK_" + item.weightKg]));
  }
  if (stage === "INVENTORY") {
    progress.placements.INVENTORY = Object.fromEntries(station.items
      .filter((item) => !lastItems.has(item.id)).map((item) => [item.id, inventoryDestination(item)!]));
  }
  return { stage, task: tasks[stage], progress, outcome: "idle", canFinish: false };
}

export function failedChallenge(challenge: Challenge): Challenge {
  return { ...challenge, outcome: "retry", canFinish: true };
}

export function submitChallenge(challenge: Challenge, action: Action) {
  const result = submit(challenge.progress, action, undefined, {
    barbellKg: challengeWeight, bench: { backrest: challengeNotch },
  });
  const checkingBench = challenge.stage === "BENCH" && action.kind === "bench-adjustment";
  const passed = checkingBench ? result.accepted && action.notch === challengeNotch : result.progress.phase === "lesson";
  const wrong = !passed && (checkingBench || !result.accepted && result.message !== "");
  const update = { ...challenge, progress: result.progress };
  return {
    result,
    challenge: passed ? { ...update, outcome: "passed", canFinish: true } satisfies Challenge
      : wrong ? failedChallenge(update)
        : result.accepted && action.kind === "place" ? { ...update, outcome: "placed" } satisfies Challenge : update,
  };
}
