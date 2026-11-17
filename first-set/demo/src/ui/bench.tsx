import { lazy, Suspense, useState } from "react";
import type { Action, Progress, Result } from "../engine/game";
import { benchNotches, benchParts, type BenchPart } from "../engine/scenario";
import type { BenchPose } from "./bench-view";
import { CheckBurst } from "./celebration";
import { asset, Equipment, Icon } from "./graphics";
import { SceneButton } from "./scene-button";

const BenchView = lazy(() => import("./bench-view"));

const exercises = {
  backrest: {
    title: "Спинка",
    action: "Потяни жёлтый штифт. Удерживая его, измени наклон спинки. Отпусти штифт, чтобы зафиксировать положение.",
    alt: "Выдвинутый штифт удерживается при подъёме спинки и возвращается при отпускании.",
    maximum: 30,
  },
  seat: {
    title: "Сиденье",
    action: "Отведи П-образный рычаг под сиденьем. Удерживая рычаг, измени наклон подушки. Отпусти рычаг для фиксации.",
    alt: "П-образный рычаг остаётся открытым при подъёме сиденья и возвращается при отпускании.",
    maximum: 12,
  },
};

type Demo = { part: BenchPart; firstVisit: boolean };
const demoSource = (part: BenchPart) => import.meta.env.BASE_URL + "art/bench-" + part + ".gif";
const lastNotch = benchNotches.length - 1;

export function BenchStation({ progress, submit }: { progress: Progress; submit: (action: Action) => Result }) {
  const [part, setPart] = useState<BenchPart>(() => progress.benchAdjustments.includes("backrest") ? "seat" : "backrest");
  const [demo, setDemo] = useState<Demo | null>(() => progress.benchAdjustments.length ? null : { part: "backrest", firstVisit: true });
  const complete = benchParts.every((item) => progress.benchAdjustments.includes(item));

  if (demo) {
    const exercise = exercises[demo.part];
    const nextDemo = demo.firstVisit && demo.part === "backrest";
    return (
      <section className="bench-station bench-demo" aria-labelledby="bench-demo-title">
        <picture className="bench-demo-visual" key={demo.part}>
          <source media="(prefers-reduced-motion: reduce)" srcSet={asset("bench-" + demo.part + "-still")} />
          <img src={demoSource(demo.part)} alt={exercise.alt} width={376} height={223} />
        </picture>
        <div className="bench-lesson-copy">
          <h2 id="bench-demo-title">{exercise.title}</h2>
          <p>{exercise.action}</p>
        </div>
        <SceneButton type="button" className="button primary" onActivate={() => {
          if (nextDemo) setDemo({ part: "seat", firstVisit: true });
          else setDemo(null);
        }}>
          {nextDemo ? "Посмотреть сиденье" : "Попробовать на скамье"} <Icon name="arrow" size={17} />
        </SceneButton>
      </section>
    );
  }

  const { backrest, seat } = progress.benchPositions;
  const pose: BenchPose = {
    RaiseBackrest: backrest / lastNotch,
    RaiseSeat: seat / lastNotch,
    PullBackrestPin: 0,
    ReleaseSeatLatch: 0,
  };

  return (
    <section className="bench-station bench-practice" data-bench-part={part} data-sandbox={complete || undefined}>
      <div className="bench-parts" aria-label="Подушки скамьи">
        {benchParts.map((item) => (
          <SceneButton key={item} type="button" aria-pressed={part === item} onActivate={() => setPart(item)}>
            {progress.benchAdjustments.includes(item) && <Icon name="check" size={16} />}
            {exercises[item].title}
          </SceneButton>
        ))}
      </div>
      <div className="play-scene scene-bench">
        <Suspense fallback={<div className="bench-view"><Equipment name="bench" alt="Регулируемая скамья" /></div>}>
          <BenchView part={part} pose={pose} notch={progress.benchPositions[part]}
            onAdjust={(notch) => submit({ kind: "bench-adjustment", part, notch })} />
        </Suspense>
        {complete && <CheckBurst className="bench-achievement" label="Обе подушки отрегулированы" />}
      </div>
      <div className="bench-angle" role="status" aria-live="polite">
        <span>{exercises[part].title}</span>
        <strong>{progress.benchPositions[part] * exercises[part].maximum / lastNotch}°</strong>
      </div>
      <p className="bench-operation" id="bench-operation">
        <span className="bench-touch-help">Отведи фиксатор одним пальцем и удерживай. Другим пальцем перетащи подушку, затем отпусти фиксатор.</span>
        <span className="bench-key-help">Удерживай пробел и перетащи подушку мышью или меняй угол стрелками. Отпусти пробел для фиксации.</span>
      </p>
      <div className="bench-practice-actions">
        <SceneButton type="button" className="button ghost" onActivate={() => setDemo({ part, firstVisit: false })}>
          Показать приём <Icon name="play" size={17} />
        </SceneButton>
        {complete && <SceneButton type="button" className="button primary" onActivate={() => submit({ kind: "finish-bench" })}>
          Следующая станция <Icon name="arrow" size={17} />
        </SceneButton>}
      </div>
    </section>
  );
}
