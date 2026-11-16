import { lazy, Suspense, useRef, useState, type MouseEvent } from "react";
import { benchTask, type Action, type Progress, type Result } from "../engine/game";
import { benchFinalCheck, benchParts, benchPreparation, type BenchPart, type Station } from "../engine/scenario";
import type { BenchClip, BenchGesture, BenchPose } from "./bench-view";
import { Equipment, Icon } from "./graphics";

const BenchView = lazy(() => import("./bench-view"));

type Motion = "release" | "raise" | "verify";
type Step = "identify" | Motion;
type Exercise = {
  label: string;
  position: string;
  latch: { clip: BenchClip; target: string };
  cushion: { clip: BenchClip; target: string };
  steps: Record<Motion, { title: string; detail: string; button: string }>;
};

const exercises: Record<BenchPart, Exercise> = {
  backrest: {
    label: "Спинка",
    position: "Учебный наклон 30°",
    latch: { clip: "PullBackrestPin", target: "BackrestPinTarget" },
    cushion: { clip: "RaiseBackrest", target: "BackrestCushionTarget" },
    steps: {
      release: {
        title: "Вытяни жёлтый штифт",
        detail: "Потяни штифт спинки в сторону от рамы по стрелке.",
        button: "Вытянуть штифт",
      },
      raise: {
        title: "Подними спинку",
        detail: "Потяни спинку вверх до конца стрелки. В новом положении штифт вернётся на место.",
        button: "Поднять спинку до 30°",
      },
      verify: {
        title: "Проверь фиксацию спинки",
        detail: "Потяни спинку вверх ещё раз. Зафиксированная спинка останется на месте.",
        button: "Проверить спинку",
      },
    },
  },
  seat: {
    label: "Сиденье",
    position: "Учебный наклон 12°",
    latch: { clip: "ReleaseSeatLatch", target: "SeatLatchTarget" },
    cushion: { clip: "RaiseSeat", target: "SeatCushionTarget" },
    steps: {
      release: {
        title: "Освободи фиксатор сиденья",
        detail: "Потяни тонкий П-образный рычаг под цилиндрической ручкой по стрелке.",
        button: "Освободить фиксатор сиденья",
      },
      raise: {
        title: "Подними сиденье",
        detail: "Потяни свободный край вверх до конца стрелки. В новом положении рычаг вернётся на место.",
        button: "Поднять сиденье до 12°",
      },
      verify: {
        title: "Проверь фиксацию сиденья",
        detail: "Потяни сиденье вверх ещё раз. Зафиксированное сиденье останется на месте.",
        button: "Проверить сиденье",
      },
    },
  },
};

const stepNumber = { identify: 1, release: 1, raise: 2, verify: 3 };
const mechanisms = [
  { id: "backrest", label: "Жёлтый штифт", use: "Жёлтый штифт освобождает спинку." },
  { id: "handle", label: "Цилиндрическая ручка", use: "Ручка нужна, чтобы перемещать скамью." },
  { id: "seat", label: "П-образный рычаг", use: "П-образный рычаг освобождает сиденье." },
] as const;

const checks = {
  [benchPreparation]: {
    title: "Что сделаешь перед настройкой?",
    detail: "На подушке осталась гантель.",
    options: [
      { id: "adjust-first", label: "Сразу изменить наклон" },
      { id: benchPreparation, label: "Убрать гантель" },
      { id: "sit-first", label: "Сесть на скамью" },
    ],
  },
  [benchFinalCheck]: {
    title: "Проверь скамью перед подходом",
    detail: "Обе подушки закреплены. Что ещё нужно проверить?",
    options: [
      { id: "finish-now", label: "Сразу начать подход" },
      { id: benchFinalCheck, label: "Проверить устойчивость" },
    ],
  },
};

export function BenchChecks({ station, progress, submit }: {
  station: Station;
  progress: Progress;
  submit: (action: Action) => Result;
}) {
  const [step, setStep] = useState<Step>("identify");
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const guide = useRef<HTMLDivElement>(null);
  const task = benchTask(progress, station)!;
  const part = task.kind === "adjust" ? task.part : undefined;
  const exercise = part ? exercises[part] : undefined;
  const instruction = exercise && step !== "identify" ? exercise.steps[step] : undefined;
  const check = task.kind === "check"
    ? checks[task.check.id === benchFinalCheck ? benchFinalCheck : benchPreparation]
    : undefined;

  const isRaised = (id: BenchPart) => progress.benchAdjustments.includes(id) || part === id && step === "verify";
  const pose: BenchPose = {
    RaiseBackrest: Number(isRaised("backrest")),
    RaiseSeat: Number(isRaised("seat")),
    PullBackrestPin: Number(part === "backrest" && step === "raise"),
    ReleaseSeatLatch: Number(part === "seat" && step === "raise"),
  };

  function keepFocus(event?: MouseEvent) {
    if (event?.detail === 0) {
      requestAnimationFrame(() => guide.current?.querySelector("button")?.focus({ preventScroll: true }));
    }
  }

  function checkStep(id: string, event: MouseEvent) {
    const result = submit({ kind: "bench", check: id });
    setFeedback({ text: result.message, error: !result.accepted });
    if (result.accepted) keepFocus(event);
  }

  function chooseMechanism(choice: typeof mechanisms[number], event: MouseEvent) {
    if (choice.id !== part) {
      setFeedback({ text: choice.use, error: true });
      return;
    }
    setStep("release");
    setHint(false);
    setFeedback(null);
    keepFocus(event);
  }

  function adjust(event?: MouseEvent) {
    if (!part) return;
    if (step === "release" || step === "identify") {
      setStep("raise");
      setHint(false);
      setFeedback({ text: "Фиксатор открыт." });
    } else if (step === "raise") {
      setStep("verify");
      setFeedback({ text: "Фиксатор вернулся на место." });
    } else {
      const result = submit({ kind: "bench-adjustment", part });
      if (result.accepted) setStep("identify");
      setFeedback(result.accepted
        ? { text: part === "backrest" ? "Фиксация спинки проверена." : "Фиксация сиденья проверена." }
        : { text: result.message, error: true });
    }
    keepFocus(event);
  }

  const atLatch = step === "identify" || step === "release";
  const gesture: BenchGesture | null = exercise && (instruction || hint) ? {
    target: atLatch ? exercise.latch.target : exercise.cushion.target,
    label: (instruction ?? exercise.steps.release).button,
    clip: atLatch ? exercise.latch.clip : step === "raise" ? exercise.cushion.clip : undefined,
    onFinish: () => adjust(),
  } : null;

  const findLatch = exercise && step === "identify";
  const title = check?.title ?? instruction?.title ?? (part === "backrest" ? "Найди фиксатор спинки" : "Найди фиксатор сиденья");
  const detail = check?.detail ?? instruction?.detail ?? "Осмотри скамью и выбери деталь, которая освобождает подушку.";

  return (
    <div className="bench-station">
      <div className="play-scene scene-bench">
        <Suspense fallback={<div className="bench-view"><div className="bench-view-placeholder">
          <Equipment name="bench" alt="Регулируемая скамья" />
          <p role="status">Загружается 3D-модель…</p>
        </div></div>}>
          <BenchView pose={pose} part={part} gesture={gesture} />
        </Suspense>
        <ol className="bench-parts" aria-label="Подушки скамьи">
          {benchParts.map((id) => (
            <li key={id} aria-current={id === part ? "step" : undefined}>
              {progress.benchAdjustments.includes(id) && <Icon name="check" size={16} />}
              {exercises[id].label}
            </li>
          ))}
        </ol>
      </div>
      <div className="bench-guide" ref={guide}>
        <div className="bench-step-heading">
          <span className="bench-icon"><Icon name="bench" size={24} /></span>
          <div>
            {exercise && <p className="accent-label">{exercise.label} · шаг {stepNumber[step]} из 3</p>}
            <h2>{title}</h2>
          </div>
        </div>
        <p id="bench-detail">{detail}</p>
        {exercise && <p className="bench-position">{exercise.position}</p>}
        {check && (
          <div className="bench-options">
            {check.options.map(({ id, label }) => (
              <button key={id} className="button secondary" type="button" onClick={(event) => checkStep(id, event)}>{label}</button>
            ))}
          </div>
        )}
        {findLatch && (
          <div className="bench-options">
            {mechanisms.map((choice) => (
              <button key={choice.id} className={`button ${hint && part === choice.id ? "primary" : "secondary"}`} type="button"
                onClick={(event) => chooseMechanism(choice, event)}>{choice.label}</button>
            ))}
            <button className="button quiet" type="button" onClick={() => {
              setHint(true);
              setFeedback(null);
            }}>Подсказка</button>
          </div>
        )}
        {instruction && <button type="button" className="button primary" aria-describedby="bench-detail" onClick={adjust}>
          {instruction.button} <Icon name="arrow" />
        </button>}
        <p className={`bench-feedback${feedback?.error ? " bench-error" : ""}`} role="status" aria-live="polite">
          {feedback?.text ?? ""}
        </p>
      </div>
    </div>
  );
}
