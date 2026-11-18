import type { Ref } from "react";
import { challengeWeight, type Challenge } from "../engine/challenge";
import type { Action, Result } from "../engine/game";
import { stationDetails, stations } from "../engine/scenario";
import { Icon } from "./graphics";
import { StationBoard } from "./station-board";
import type { InputMode } from "./input-mode";
import { SceneButton } from "./scene-button";

export function ChallengeScreen({ challenge, heading, inputMode, submit, locked, restart, finish }: {
  challenge: Challenge; heading: Ref<HTMLHeadingElement>; inputMode: InputMode;
  submit: (action: Action) => Result; locked: () => void; restart: () => void; finish: () => void;
}) {
  const { stage, progress, outcome } = challenge;
  const station = stations[progress.stageIndex];
  const passed = outcome === "passed";
  return (
    <section className="challenge" data-challenge={stage}>
      <div className="challenge-brief">
        <p className="challenge-subject">{stationDetails[stage].name}</p>
        <h1 ref={heading} tabIndex={-1}>Теперь без подсказок</h1>
        <p>{challenge.task}</p>
      </div>
      <div className="challenge-board" inert={passed}>
        <StationBoard station={station} progress={progress} submit={submit} inputMode={inputMode}
          goal={stage === "BARBELL" ? challengeWeight : undefined} onLocked={locked} />
      </div>
      <div className="challenge-outcome" role="status" data-outcome={outcome}>
        {outcome === "placed" && <p>Предмет на месте.</p>}
        {outcome === "retry" && <p>Попытка пока не зачтена.</p>}
        {passed && <p><Icon name="check" size={18} /> Контрольная ситуация пройдена.</p>}
      </div>
      {challenge.canFinish && <div className="challenge-actions">
        <SceneButton type="button" className={passed ? "button primary" : "button quiet"} onActivate={finish}>К итогам <Icon name="arrow" size={17} /></SceneButton>
        {!passed && <SceneButton type="button" className="button ghost" onActivate={restart}>Начать заново</SceneButton>}
      </div>}
    </section>
  );
}
