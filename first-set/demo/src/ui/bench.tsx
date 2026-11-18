import { lazy, Suspense, useState } from "react";
import type { Action, Progress, Result } from "../engine/game";
import { benchGoals, benchNotches, benchParts, stationDetails, type BenchNotch, type BenchPart } from "../engine/scenario";
import { benchRule } from "../engine/station-hints";
import type { BenchPose } from "./bench-view";
import { CheckBurst } from "./celebration";
import { asset, Icon } from "./graphics";
import { SceneButton } from "./scene-button";
import { CoachFeedback } from "./coach-message";
import { AssistControls } from "./station-help";
import type { InputMode } from "./input-mode";
import type { Coach } from "./use-coach";

const BenchView = lazy(() => import("./bench-view"));
const lastNotch = benchNotches.length - 1;

const exercises = {
  backrest: {
    title: "Спинка",
    switchTo: "К спинке",
    task: "Подстрой спинку под бирюзовый контур.",
    demo: "Штифт остаётся выдвинутым, пока спинка движется.",
  },
  seat: {
    title: "Сиденье",
    switchTo: "К сиденью",
    task: "Совмести сиденье с бирюзовым контуром.",
    demo: "Рычаг остаётся отведённым, пока сиденье движется.",
  },
};

const controls = {
  touch: ["Удерживай фиксатор одним пальцем.", "Другим пальцем меняй положение.", "Отпусти фиксатор."],
  keyboard: ["Удерживай пробел.", "Стрелками меняй положение.", "Отпусти пробел."],
  mouse: ["Удерживай фиксатор.", "Не отпуская кнопку, веди мышь к контуру.", "Отпусти кнопку мыши."],
};

export function BenchStation({ progress, submit, inputMode, coach }: {
  progress: Progress;
  submit: (action: Action) => Result;
  inputMode: InputMode;
  coach: Coach;
}) {
  const pending = benchParts.find((item) => !progress.benchAdjustments.includes(item));
  const complete = pending === undefined;
  const [part, setPart] = useState<BenchPart>(pending ?? "seat");
  const [showDemo, setShowDemo] = useState(false);
  const [celebrated, setCelebrated] = useState<BenchPart>();
  const exercise = exercises[part];
  const otherPart = part === "backrest" ? "seat" : "backrest";
  const solved = progress.benchAdjustments.includes(part);
  const waitingForNext = solved && !complete;
  const target = solved ? undefined : benchGoals[part];
  const lockedRule = benchRule(part, "locked");
  const alignmentRule = benchRule(part, "alignment");
  const latchHint = coach.active?.id === lockedRule.id;
  const latchProgress = coach.rules[lockedRule.id];
  const showControls = Boolean(latchProgress?.demoOpened || (latchProgress?.hintLevel ?? 0) >= 2
    || coach.rules[alignmentRule.id]?.hintLevel);
  const [hold, move, release] = controls[inputMode];
  const controlIcon = inputMode === "keyboard" ? "keyboard" : inputMode === "touch" ? "touch" : "mouse";

  const pose: BenchPose = {
    RaiseBackrest: progress.benchPositions.backrest / lastNotch,
    RaiseSeat: progress.benchPositions.seat / lastNotch,
    PullBackrestPin: 0,
    ReleaseSeatLatch: 0,
  };

  function choose(nextPart: BenchPart) {
    setPart(nextPart);
    setShowDemo(false);
    setCelebrated(undefined);
    if (!complete) coach.say(exercises[nextPart].task);
  }

  function adjust(notch: BenchNotch) {
    const result = submit({ kind: "bench-adjustment", part, notch });
    if (target === undefined) return;
    if (!result.progress.benchAdjustments.includes(part)) {
      coach.mistake(alignmentRule);
      return;
    }
    setCelebrated(part);
    coach.say(part === "backrest" ? "Спинка зафиксирована. Теперь настроим сиденье."
      : "Скамья настроена: спинка и сиденье зафиксированы.", "success", [lockedRule.id, alignmentRule.id]);
  }

  function toggleDemo() {
    if (!showDemo) coach.demo(coach.active ?? lockedRule);
    else coach.act();
    setShowDemo(!showDemo);
  }

  return (
    <section className="bench-station" data-bench-part={part} data-input={inputMode} data-sandbox={complete || undefined}>
      <CoachFeedback message={complete ? "Скамья настроена: спинка и сиденье зафиксированы." : exercise.task}
        line={coach.line} controls={!waitingForNext && <AssistControls coach={coach} rule={coach.active ?? lockedRule} demo={() => setShowDemo(true)} />} />
      <div className="bench-workshop station-arena">
        <div className="bench-scene">
          <div className="bench-hud" aria-hidden="true">
            <span className="bench-hud-rest">{exercise.title}</span>
            <span className="bench-hud-open"><Icon name="unlock" size={15} /> Фиксатор отведён</span>
            <span className="bench-hud-ready"><Icon name="check" size={15} /> Положение совпало</span>
          </div>
          <div inert={showDemo}>
            <Suspense fallback={<div className="bench-view"><p className="bench-status" role="status">Загружается 3D-модель…</p></div>}>
              <BenchView part={part} pose={pose} notch={progress.benchPositions[part]} inputMode={inputMode}
                target={target} paused={waitingForNext || showDemo} highlightLatch={latchHint}
                onAdjust={adjust} onManipulate={coach.act} onLockedAttempt={() => {
                  if (!complete) coach.mistake(lockedRule);
                }} />
            </Suspense>
          </div>
          <figure id="bench-demo" className="bench-demo" hidden={!showDemo}>
            {showDemo && <>
              <picture className="bench-demo-visual">
                <source media="(prefers-reduced-motion: reduce)" srcSet={asset("bench-" + part + "-still")} />
                <img src={import.meta.env.BASE_URL + "art/bench-" + part + ".gif"} alt="" width={376} height={223} />
              </picture>
              <figcaption>{exercise.demo}</figcaption>
            </>}
          </figure>
          {celebrated === part && !showDemo && <CheckBurst className="bench-achievement" label={complete ? "Скамья настроена" : "Спинка настроена"} />}
        </div>
        {!waitingForNext && (
          <p className="bench-cue" id="bench-operation" aria-live="polite">
            <span className="bench-cue-rest">
              <span className="bench-cue-step"><span className="cue-icon"><Icon name={controlIcon} size={20} /></span>
                {complete ? "Поверни модель, чтобы рассмотреть скамью."
                  : showControls ? hold
                    : inputMode === "keyboard" ? "Попробуй изменить положение стрелками." : "Попробуй сдвинуть подушку на модели."}</span>
              {!complete && showControls && <><Icon name="arrow" size={18} />
                <span className="bench-cue-step"><span className="cue-icon"><Icon name={controlIcon} size={20} /></span>{move}</span></>}
            </span>
            <span className="bench-cue-move"><span className="cue-icon"><Icon name={controlIcon} size={20} /></span>{move}</span>
            <span className="bench-cue-snap"><span className="cue-icon"><Icon name="check" size={20} /></span>{release}</span>
          </p>
        )}
        <SceneButton type="button" className="button quiet bench-help" onActivate={toggleDemo}
          data-suggested={coach.line?.demo || undefined} aria-expanded={showDemo} aria-controls="bench-demo" onKeyDown={(event) => {
            if (event.key === "Escape" && showDemo) setShowDemo(false);
          }}>
          <Icon name={showDemo ? "close" : "play"} size={17} /> {showDemo ? "Вернуться к модели" : "Показать приём"}
        </SceneButton>
      </div>
      <div className="bench-practice-actions">
        {waitingForNext && (
          <SceneButton type="button" className="button primary" onActivate={() => choose(pending)}>
            К сиденью <Icon name="arrow" size={17} />
          </SceneButton>
        )}
        {complete && <>
          <SceneButton type="button" className="button ghost" onActivate={() => choose(otherPart)}>
            {exercises[otherPart].switchTo}
          </SceneButton>
          <SceneButton type="button" className="button primary" onActivate={() => submit({ kind: "finish-bench" })}>
            {stationDetails.BENCH.nextButton} <Icon name="arrow" size={17} />
          </SceneButton>
        </>}
      </div>
    </section>
  );
}
