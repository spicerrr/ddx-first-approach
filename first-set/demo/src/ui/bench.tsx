import { lazy, Suspense, useState } from "react";
import type { Action, Progress, Result } from "../engine/game";
import { benchAngles, benchGoals, benchNotches, benchParts, type BenchNotch, type BenchPart } from "../engine/scenario";
import type { BenchPose } from "./bench-view";
import { CheckBurst } from "./celebration";
import { asset, Equipment, Icon } from "./graphics";
import { SceneButton } from "./scene-button";
import { CoachMessage } from "./coach-message";

const BenchView = lazy(() => import("./bench-view"));
const lastNotch = benchNotches.length - 1;

const exercises = {
  backrest: {
    title: "Спинка",
    release: "Отпусти штифт",
    hold: "Отведи жёлтый штифт и удерживай",
    demo: "Штифт остаётся выдвинутым, пока спинка движется.",
  },
  seat: {
    title: "Сиденье",
    release: "Отпусти рычаг",
    hold: "Отведи П-образный рычаг и удерживай",
    demo: "Рычаг остаётся отведённым, пока сиденье движется.",
  },
};

function targetDegrees(part: BenchPart) {
  return benchAngles[part][benchGoals[part]];
}

export function BenchStation({ progress, submit }: { progress: Progress; submit: (action: Action) => Result }) {
  const pending = benchParts.find((item) => !progress.benchAdjustments.includes(item));
  const complete = pending === undefined;
  const [part, setPart] = useState<BenchPart>(pending ?? "seat");
  const [showDemo, setShowDemo] = useState(!complete);
  const [preview, setPreview] = useState<BenchNotch>();
  const [retry, setRetry] = useState(false);
  const [celebrated, setCelebrated] = useState<BenchPart>();
  const exercise = exercises[part];
  const solved = progress.benchAdjustments.includes(part);
  const waitingForNext = solved && !complete;
  const target = solved ? undefined : benchGoals[part];
  const notch = progress.benchPositions[part];
  const current = preview ?? notch;

  const pose: BenchPose = {
    RaiseBackrest: progress.benchPositions.backrest / lastNotch,
    RaiseSeat: progress.benchPositions.seat / lastNotch,
    PullBackrestPin: 0,
    ReleaseSeatLatch: 0,
  };

  function choose(nextPart: BenchPart, withDemo = false) {
    setPart(nextPart);
    setPreview(undefined);
    setShowDemo(withDemo);
    setRetry(false);
    setCelebrated(undefined);
  }

  function adjust(next: BenchNotch) {
    const result = submit({ kind: "bench-adjustment", part, notch: next });
    if (target === undefined) return;
    const matched = result.progress.benchAdjustments.includes(part);
    setRetry(!matched && next !== notch);
    if (matched) setCelebrated(part);
  }

  return (
    <section className="bench-station" data-bench-part={part} data-sandbox={complete || undefined}>
      <CoachMessage visitor={!complete} live>
        {complete ? "Скамья свободна. Можешь попробовать другие положения или перейти к следующему делу."
          : `Поможешь настроить скамью для жима? Спинку на ${targetDegrees("backrest")}°, сиденье на ${targetDegrees("seat")}°.`}
      </CoachMessage>
      <ol className="bench-orders" aria-label="Настройки посетителя">
        {benchParts.map((item) => {
          const done = progress.benchAdjustments.includes(item);
          const name = exercises[item].title;
          const order = <><span className="bench-order-mark">{done ? <Icon name="check" size={14} /> : benchParts.indexOf(item) + 1}</span>
            <span>{name}</span>{!complete && <strong>{targetDegrees(item)}°</strong>}</>;
          return (
            <li key={item} data-active={part === item || undefined} data-done={done || undefined}>
              {complete ? (
                <SceneButton type="button" aria-pressed={part === item} onActivate={() => choose(item)}>{order}</SceneButton>
              ) : <div aria-current={part === item ? "step" : undefined}>{order}</div>}
            </li>
          );
        })}
      </ol>

      <div className="bench-workshop" data-demo={showDemo || undefined} data-retry={retry || undefined}>
        <div className="bench-scene">
          <div className="bench-hud" aria-hidden="true">
            {showDemo ? <span><Icon name="play" size={15} /> Показ приёма</span> : <>
              <span className="bench-hud-lock"><Icon name="lock" size={15} /> Фиксатор на месте</span>
              <span className="bench-hud-open"><Icon name="unlock" size={15} /> Фиксатор отведён</span>
              <span className="bench-hud-ready"><Icon name="check" size={15} /> Положение совпало</span>
            </>}
          </div>
          {showDemo ? (
            <picture className="bench-demo-visual" key={part}>
              <source media="(prefers-reduced-motion: reduce)" srcSet={asset("bench-" + part + "-still")} />
              <img src={import.meta.env.BASE_URL + "art/bench-" + part + ".gif"} alt={exercise.demo} width={376} height={223} />
            </picture>
          ) : (
            <Suspense fallback={<div className="bench-view"><Equipment name="bench" alt="Регулируемая скамья" /></div>}>
              <BenchView part={part} pose={pose} notch={notch}
                target={target} paused={waitingForNext} onPreview={setPreview} onAdjust={adjust} />
            </Suspense>
          )}
          {celebrated === part && <CheckBurst className="bench-achievement" label={complete ? "Скамья настроена" : "Спинка настроена"} />}
        </div>
        {!showDemo && (
          <div className="bench-dial" aria-label={exercise.title + ", наклон " + benchAngles[part][current] + " градусов"}>
            {benchNotches.map((step) => (
              <span key={step} data-current={step === current || undefined} data-target={step === target || undefined}>
                <i aria-hidden="true" />{benchAngles[part][step]}°
              </span>
            ))}
          </div>
        )}
        {!waitingForNext && (
          <p className="bench-cue" id="bench-operation">
            {showDemo ? exercise.demo : <>
              <span className="bench-cue-rest">
                {retry ? `Подушка встала на ${benchAngles[part][notch]}°. Можно попробовать ещё раз и совместить её с бирюзовым контуром.` : <>
                  <span className="bench-touch-help">{exercise.hold}.</span>
                  <span className="bench-key-help">Удерживай пробел, чтобы отвести фиксатор.</span>
                </>}
              </span>
              <span className="bench-cue-move">
                <span className="bench-touch-help">{target === undefined ? "Вторым пальцем меняй наклон." : "Вторым пальцем совмести подушку с бирюзовым контуром."}</span>
                <span className="bench-key-help">Меняй наклон мышью или стрелками.</span>
              </span>
              <span className="bench-cue-snap">
                <span className="bench-touch-help">{exercise.release}.</span>
                <span className="bench-key-help">Отпусти пробел.</span>
              </span>
            </>}
          </p>
        )}
      </div>

      <div className="bench-practice-actions">
        {showDemo ? (
          <SceneButton type="button" className="button primary" onActivate={() => setShowDemo(false)}>
            Попробовать на скамье <Icon name="arrow" size={17} />
          </SceneButton>
        ) : waitingForNext ? (
          <SceneButton type="button" className="button primary" onActivate={() => choose(pending, true)}>
            К сиденью <Icon name="arrow" size={17} />
          </SceneButton>
        ) : (
          <>
            <SceneButton type="button" className="button ghost" onActivate={() => choose(part, true)}>
              Показать приём <Icon name="play" size={17} />
            </SceneButton>
            {complete && <SceneButton type="button" className="button primary" onActivate={() => submit({ kind: "finish-bench" })}>
              Следующая станция <Icon name="arrow" size={17} />
            </SceneButton>}
          </>
        )}
      </div>
    </section>
  );
}
