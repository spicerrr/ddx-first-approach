import { Component, lazy, Suspense, type ReactNode } from "react";
import type { Action, Progress, Result } from "../engine/game";
import type { Station } from "../engine/scenario";
import type { InputMode } from "./input-mode";
import type { Coach } from "./use-coach";
import { SceneButton } from "./scene-button";

const loadSpatial = () => import("./gym");
const loadBench = () => import("./bench");
const Spatial = lazy(() => loadSpatial().then((module) => ({ default: module.SpatialStation })));
const Bench = lazy(() => loadBench().then((module) => ({ default: module.BenchStation })));

export type BoardProps = {
  station: Station; progress: Progress; submit: (action: Action) => Result;
  inputMode: InputMode; coach: Coach; onExit: () => void;
};

class StationBoundary extends Component<{ children: ReactNode; onExit: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="station-loading">
      <p role="alert">Станция не загрузилась. Можно вернуться в Точку старта.</p>
      <SceneButton type="button" className="button secondary" onActivate={this.props.onExit}>В Точку старта</SceneButton>
    </div>;
  }
}

export function StationBoard({ station, progress, submit, inputMode, coach, onExit }: BoardProps) {
  return (
    <StationBoundary onExit={onExit}>
      <Suspense fallback={<p className="station-loading" role="status">Загружается оборудование…</p>}>
        {station.stage === "BENCH" ? <Bench progress={progress} submit={submit} inputMode={inputMode} coach={coach} />
          : <Spatial station={station} progress={progress} submit={submit} coach={coach} />}
      </Suspense>
    </StationBoundary>
  );
}

export function preloadBoard(stage: Station["stage"]) {
  return stage === "BENCH" ? loadBench() : loadSpatial();
}
