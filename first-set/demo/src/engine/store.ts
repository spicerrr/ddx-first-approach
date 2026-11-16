import { newProgress, stationProgress, type GameEvent, type Phase, type Progress } from "./game";
import { benchFinalCheck, benchParts, lastStation, placementDestination, scenarioVersion, stations, stationTotal,
  type PlacementStation, type StationId } from "./scenario";

export const storageKey = "first-approach-interactive-v3";
const legacyKey = "first-approach-interactive-v2";
const uiEventLimit = 30;

type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type Training = "smart-start" | "intro";
export type UiEvent =
  | { type: "onboarding_offer_exposed"; at: string }
  | { type: "intro_cta_clicked"; at: string; from: "home" | "play" | "skip"; destination: Training };

export type LocalData = {
  format: 3;
  scenarioVersion: string;
  progress: Progress;
  uiEvents: UiEvent[];
};

export function freshData(): LocalData {
  return { format: 3, scenarioVersion, progress: newProgress(), uiEvents: [] };
}

export function withUiEvent(data: LocalData, event: UiEvent): LocalData {
  return { ...data, uiEvents: [...data.uiEvents, event].slice(-uiEventLimit) };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function stationId(value: unknown): value is StationId {
  return stations.some((station) => station.stage === value);
}

function isGameEvent(entry: unknown): entry is GameEvent {
  if (!record(entry) || !validDate(entry.at)) return false;
  if (entry.type === "game_session_started" || entry.type === "game_session_completed") return true;
  return entry.type === "game_stage_completed" && stationId(entry.stage);
}

function eventKey(e: GameEvent): string {
  return e.type === "game_stage_completed" ? e.stage : e.type;
}

function isUiEvent(entry: unknown): entry is UiEvent {
  if (!record(entry) || !validDate(entry.at)) return false;
  if (entry.type === "onboarding_offer_exposed") return true;
  return entry.type === "intro_cta_clicked"
    && (entry.destination === "smart-start" || entry.destination === "intro")
    && (entry.from === "home" || entry.from === "play" || entry.from === "skip");
}

function validateProgress(value: unknown): Progress | null {
  if (!record(value) || !record(value.placements) || !Array.isArray(value.benchChecks)
    || !Array.isArray(value.events) || typeof value.stageIndex !== "number") return null;

  const { phase, stageIndex, placements, benchChecks, events } = value;
  if (phase !== "ready" && phase !== "playing" && phase !== "lesson" && phase !== "complete") return null;
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > lastStation) return null;
  if (phase === "ready" && stageIndex !== 0 || phase === "complete" && stageIndex !== lastStation) return null;

  const validated: Progress = { ...newProgress(), phase, stageIndex };
  for (const [index, station] of stations.entries()) {
    if (station.stage === "BENCH") {
      if (benchChecks.length > station.items.length || benchChecks.some((id, i) => id !== station.items[i].id)) return null;
      validated.benchChecks = benchChecks;
      const verifyIndex = station.items.findIndex(({ id }) => id === benchFinalCheck);
      // Older saves had only the checklist. Keep previously completed stations complete.
      const adjustments = value.benchAdjustments === undefined
        ? benchChecks.length > verifyIndex ? [...benchParts] : []
        : value.benchAdjustments;
      if (!Array.isArray(adjustments) || adjustments.length > benchParts.length
        || adjustments.some((part, i) => part !== benchParts[i])
        || (benchChecks.length < verifyIndex && adjustments.length > 0)
        || (benchChecks.length > verifyIndex && adjustments.length < benchParts.length)) return null;
      validated.benchAdjustments = adjustments;
    } else {
      const values = placements[station.stage];
      if (!record(values)) return null;
      const occupied = new Set<string>();
      const assigned: Record<string, string> = {};
      for (const [id, target] of Object.entries(values)) {
        const item = station.items.find((candidate) => candidate.id === id);
        if (!item || typeof target !== "string" || !station.targets.some((candidate) => candidate.id === target)) return null;
        if (station.stage === "BARBELL") {
          const slot = `${target}/${item.weightKg}`;
          if (occupied.has(slot)) return null;
          occupied.add(slot);
        } else if (placementDestination(station.stage, id) !== target) {
          return null;
        }
        assigned[id] = target;
      }
      validated.placements[station.stage as PlacementStation] = assigned;
    }

    const completed = index < stageIndex || index === stageIndex && (phase === "lesson" || phase === "complete");
    const inPlay = phase === "playing" && index === stageIndex;
    const count = stationProgress(validated, station);
    if (completed ? count !== stationTotal(station) : inPlay ? count >= stationTotal(station) : count !== 0) return null;
  }

  if (!events.every(isGameEvent)) return null;
  const keys = events.map(eventKey);
  if (new Set(keys).size !== keys.length) return null;
  const completedStations = stations.filter((station) => stationProgress(validated, station) === stationTotal(station));
  const expected = phase === "ready" ? [] : [
    "game_session_started",
    ...completedStations.map(({ stage }) => stage),
    ...(completedStations.length === stations.length ? ["game_session_completed"] : []),
  ];
  if (expected.length !== keys.length || expected.some((key, i) => keys[i] !== key)) return null;
  return { ...validated, events };
}

export function decode(value: unknown): LocalData | null {
  if (!record(value) || value.format !== 3 || value.scenarioVersion !== scenarioVersion) return null;
  const progress = validateProgress(value.progress);
  if (!progress || !Array.isArray(value.uiEvents)
    || value.uiEvents.length > uiEventLimit || !value.uiEvents.every(isUiEvent)) return null;
  return { format: 3, scenarioVersion, progress, uiEvents: value.uiEvents };
}

export function migrate(value: unknown): LocalData | null {
  if (!record(value) || typeof value.started !== "boolean" || typeof value.done !== "boolean"
    || typeof value.stageIndex !== "number" || !Array.isArray(value.events)) return null;
  const phase: Phase = value.done ? "complete" : value.started ? "playing" : "ready";
  if (value.done && (!value.started || value.stageIndex !== stations.length)) return null;

  const events: GameEvent[] = [];
  for (const entry of value.events) {
    if (!record(entry) || !validDate(entry.occurredAt)) continue;
    const candidate = { type: entry.eventType, at: entry.occurredAt, stage: entry.stage };
    if (isGameEvent(candidate)) events.push(candidate);
  }

  const progress = validateProgress({
    phase,
    stageIndex: value.done ? lastStation : value.stageIndex,
    placements: value.placements,
    benchChecks: value.benchChecks,
    events,
  });
  return progress ? { ...freshData(), progress } : null;
}

export type LoadResult = { data: LocalData; status: "ok" | "invalid" | "unavailable" };

export function readData(storage?: StoragePort): LoadResult {
  let current: string | null;
  let previous: string | null;
  try {
    const port = storage ?? window.localStorage;
    current = port.getItem(storageKey);
    previous = current === null ? port.getItem(legacyKey) : null;
  } catch {
    return { data: freshData(), status: "unavailable" };
  }

  if (current === null && previous === null) return { data: freshData(), status: "ok" };
  try {
    const data = current !== null ? decode(JSON.parse(current)) : migrate(JSON.parse(previous!));
    if (data) return { data, status: "ok" };
  } catch {
    // A stale or truncated record should not prevent the game from opening.
  }
  return { data: freshData(), status: "invalid" };
}

export function saveData(data: LocalData, storage?: StoragePort) {
  try {
    (storage ?? window.localStorage).setItem(storageKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
