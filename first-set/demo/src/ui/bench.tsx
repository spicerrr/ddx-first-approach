import { lazy, Suspense, useEffect, useState } from "react";
import type { Action, Progress, Result } from "../engine/game";
import { benchGoals, benchNotches, benchParts, stationDetails, type BenchNotch, type BenchPart } from "../engine/scenario";
import type { BenchPose } from "./bench-view";
import { CheckBurst } from "./celebration";
import { asset, Icon } from "./graphics";
import { SceneButton } from "./scene-button";
import { CoachFeedback } from "./coach-message";

const BenchView = lazy(() => import("./bench-view"));
const lastNotch = benchNotches.length - 1;
const finePointer = "(pointer: fine) and (hover: hover)";

function startsWithTouch() {
  return window.matchMedia("(pointer: coarse)").matches
    || (navigator.maxTouchPoints > 0 && !window.matchMedia(finePointer).matches);
}

const exercises = {
  backrest: {
    title: "Спинка",
    switchTo: "К спинке",
    hold: "Потяни за жёлтый штифт и удерживай.",
    release: "Теперь можно отпустить штифт.",
    instruction: "Скамью можно подстроить под упражнение. Начнём со спинки. Когда отведёшь фиксатор, увидишь, куда её поднять.",
    demo: "Штифт остаётся выдвинутым, пока спинка движется.",
  },
  seat: {
    title: "Сиденье",
    switchTo: "К сиденью",
    hold: "Отведи П-образный рычаг и удерживай.",
    release: "Теперь можно отпустить рычаг.",
    instruction: "Сиденье регулируется отдельно. Под ним П-образный рычаг. Попробуй отвести его и поднять сиденье до контура.",
    demo: "Рычаг остаётся отведённым, пока сиденье движется.",
  },
};

export function BenchStation({ progress, submit }: { progress: Progress; submit: (action: Action) => Result }) {
  const pending = benchParts.find((item) => !progress.benchAdjustments.includes(item));
  const complete = pending === undefined;
  const [part, setPart] = useState<BenchPart>(pending ?? "seat");
  const [showDemo, setShowDemo] = useState(false);
  const [touchControls, setTouchControls] = useState(startsWithTouch);
  const [preview, setPreview] = useState<BenchNotch>();
  const [retry, setRetry] = useState(false);
  const [celebrated, setCelebrated] = useState<BenchPart>();
  const exercise = exercises[part];
  const otherPart = part === "backrest" ? "seat" : "backrest";
  const solved = progress.benchAdjustments.includes(part);
  const waitingForNext = solved && !complete;
  const target = solved ? undefined : benchGoals[part];
  const notch = progress.benchPositions[part];
  const position = preview ?? notch;
  const direction = target === undefined ? "" : position < target ? "Чуть выше." : position > target ? "Чуть ниже." : "";

  const pose: BenchPose = {
    RaiseBackrest: progress.benchPositions.backrest / lastNotch,
    RaiseSeat: progress.benchPositions.seat / lastNotch,
    PullBackrestPin: 0,
    ReleaseSeatLatch: 0,
  };

  useEffect(() => {
    const pointer = window.matchMedia(finePointer);
    function update() {
      setTouchControls(startsWithTouch());
    }
    pointer.addEventListener("change", update);
    return () => pointer.removeEventListener("change", update);
  }, []);

  function choose(nextPart: BenchPart) {
    setPart(nextPart);
    setPreview(undefined);
    setShowDemo(false);
    setRetry(false);
    setCelebrated(undefined);
  }

  function adjust(next: BenchNotch) {
    const result = submit({ kind: "bench-adjustment", part, notch: next });
    if (target === undefined) return;
    const matched = result.progress.benchAdjustments.includes(part);
    setRetry(!matched);
    if (matched) setCelebrated(part);
  }

  return (
    <section className="bench-station" data-bench-part={part} data-sandbox={complete || undefined}
      onPointerDownCapture={(event) => {
        if (event.pointerType) setTouchControls(event.pointerType !== "mouse");
      }}>
      <CoachFeedback message={complete
        ? "Скамья готова. Если хочешь, попробуй другие положения."
        : waitingForNext ? "Со спинкой получилось. Теперь попробуем сиденье." : exercise.instruction}
        hint={retry ? "Фиксатор встал на место. Попробуй ещё раз совместить подушку с бирюзовым контуром." : null} />

      <div className="bench-workshop">
        <div className="bench-scene">
          <div className="bench-hud" aria-hidden="true">
            <span className="bench-hud-rest">{exercise.title}</span>
            <span className="bench-hud-open"><Icon name="unlock" size={15} /> Фиксатор отведён</span>
            <span className="bench-hud-ready"><Icon name="check" size={15} /> Положение совпало</span>
          </div>
          <div inert={showDemo}>
            <Suspense fallback={<div className="bench-view"><p className="bench-status" role="status">Загружается 3D-модель…</p></div>}>
              <BenchView part={part} pose={pose} notch={notch} keyboardControls={!touchControls}
                target={target} paused={waitingForNext || showDemo} onPreview={setPreview} onAdjust={adjust} />
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
              {touchControls ? exercise.hold : "Удерживай пробел, чтобы отвести фиксатор."}
            </span>
            <span className="bench-cue-move">
              {preview !== undefined && target !== undefined ? direction
                : !touchControls ? "Меняй наклон мышью или стрелками."
                  : target === undefined ? "Вторым пальцем меняй наклон." : "Вторым пальцем совмести подушку с контуром."}
            </span>
            <span className="bench-cue-snap">
              {touchControls ? exercise.release : "Теперь можно отпустить пробел."}
            </span>
          </p>
        )}
        <SceneButton type="button" className="button quiet bench-help" onActivate={() => setShowDemo(!showDemo)}
          aria-expanded={showDemo} aria-controls="bench-demo" onKeyDown={(event) => {
            if (event.key === "Escape" && showDemo) setShowDemo(false);
          }}>
          <Icon name={showDemo ? "close" : "play"} size={18} /> {showDemo ? "Вернуться к модели" : "Показать приём"}
        </SceneButton>
      </div>

      <div className="bench-practice-actions">
        {waitingForNext && (
          <SceneButton type="button" className="button primary" onActivate={() => choose(pending)}>
            К сиденью <Icon name="arrow" size={17} />
          </SceneButton>
        )}
        {complete && (
          <>
            <SceneButton type="button" className="button ghost" onActivate={() => choose(otherPart)}>
              {exercises[otherPart].switchTo}
            </SceneButton>
            <SceneButton type="button" className="button primary" onActivate={() => submit({ kind: "finish-bench" })}>
              {stationDetails.BENCH.nextButton} <Icon name="arrow" size={17} />
            </SceneButton>
          </>
        )}
      </div>
    </section>
  );
}
