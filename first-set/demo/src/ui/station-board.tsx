import { lazy, Suspense } from "react";
import type { Action, Progress, Result } from "../engine/game";
import type { Station } from "../engine/scenario";
import type { InputMode } from "./input-mode";
import type { Coach } from "./use-coach";

const loadSpatial = () => import("./gym");
const loadBench = () => import("./bench");
const Spatial = lazy(() => loadSpatial().then((module) => ({ default: module.SpatialStation })));
const Bench = lazy(() => loadBench().then((module) => ({ default: module.BenchStation })));

export type BoardProps = {
  station: Station; progress: Progress; submit: (action: Action) => Result;
  inputMode: InputMode; coach?: Coach; goal?: number; onLocked?: () => void;
};

export function StationBoard({ station, progress, submit, inputMode, coach, goal, onLocked }: BoardProps) {
  return (
    <Suspense fallback={<p className="station-loading" role="status">Загружается оборудование…</p>}>
      {station.stage === "BENCH" ? <Bench progress={progress} submit={submit} inputMode={inputMode} coach={coach} onLocked={onLocked} />
        : <Spatial station={station} progress={progress} submit={submit} coach={coach} goal={goal} />}
    </Suspense>
  );
}

export function preloadBoard(stage: Station["stage"]) {
  return stage === "BENCH" ? loadBench() : loadSpatial();
}
