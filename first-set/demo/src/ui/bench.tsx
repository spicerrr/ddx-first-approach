import { lazy, Suspense, useState, type MouseEvent } from "react";
import { benchTask, type Action, type Progress, type Result } from "../engine/game";
import { benchParts, type BenchPart, type Station } from "../engine/scenario";
import type { BenchClip, BenchGesture, BenchPose } from "./bench-view";
import { Equipment, Icon, type IconName } from "./graphics";

const descriptions: Record<string, { detail: string; icon: IconName; label: string }> = {
  AREA_CLEAR: {
    label: "Свободная скамья",
    detail: "Проверь, что скамью сейчас никто не использует.",
    icon: "bench",
  },
  UNLOADED: {
    label: "Без нагрузки",
    detail: "Убедись, что на сиденье и спинке не лежат гантели или другой инвентарь.",
    icon: "gym",
  },
  MODEL_GUIDANCE: {
    label: "Инструкция к модели",
    detail: "Найди инструкцию или маркировку этой скамьи. У разных моделей разные механизмы.",
    icon: "book",
  },
  ASK_TRAINER_IF_UNSURE: {
    label: "Помощь тренера",
    detail: "Если порядок действий непонятен, попроси тренера показать, как пользоваться этой скамьёй.",
    icon: "person",
  },
  NO_FORCE: {
    label: "Знакомый механизм",
    detail: "Если не знаешь, как устроен механизм, не пытайся сдвинуть его силой.",
    icon: "info",
  },
  VERIFY_LOCK: {
    label: "Фиксация и устойчивость",
    detail: "Перед использованием убедись, что скамья зафиксирована и стоит устойчиво.",
    icon: "level",
  },
};

const BenchView = lazy(() => import("./bench-view"));

type Step = "release" | "raise" | "verify";
type Exercise = {
  label: string;
  position: string;
  latch: { clip: BenchClip; target: string };
  cushion: { clip: BenchClip; target: string };
  steps: Record<Step, { title: string; detail: string; button: string }>;
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

const stepNumber = { release: 1, raise: 2, verify: 3 };

export function BenchChecks({ station, progress, submit }: {
  station: Station;
  progress: Progress;
  submit: (action: Action) => Result;
}) {
  const [step, setStep] = useState<Step>("release");
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const task = benchTask(progress, station)!;
  const part = task.kind === "adjust" ? task.part : undefined;
  const exercise = part ? exercises[part] : undefined;
  const instruction = exercise?.steps[step];
  const check = task.kind === "check" ? descriptions[task.check.id] : undefined;
  const done = progress.benchChecks.length;

  const isRaised = (id: BenchPart) => progress.benchAdjustments.includes(id) || part === id && step === "verify";
  const pose: BenchPose = {
    RaiseBackrest: Number(isRaised("backrest")),
    RaiseSeat: Number(isRaised("seat")),
    PullBackrestPin: Number(part === "backrest" && step === "raise"),
    ReleaseSeatLatch: Number(part === "seat" && step === "raise"),
  };

  function keepFocus(event?: MouseEvent) {
    if (event?.detail === 0) {
      requestAnimationFrame(() => document.getElementById("bench-action")?.focus({ preventScroll: true }));
    }
  }

  function checkStep(id: string, event: MouseEvent) {
    const result = submit({ kind: "bench", check: id });
    setFeedback(result.accepted ? null : { text: result.message, error: true });
    if (result.accepted) keepFocus(event);
  }

  function adjust(event?: MouseEvent) {
    if (!part) return;
    if (step === "release") {
      setStep("raise");
      setFeedback({ text: "Фиксатор открыт." });
    } else if (step === "raise") {
      setStep("verify");
      setFeedback({ text: "Фиксатор вернулся на место." });
    } else {
      const result = submit({ kind: "bench-adjustment", part });
      if (result.accepted) setStep("release");
      setFeedback(result.accepted
        ? { text: part === "backrest" ? "Фиксация спинки проверена." : "Фиксация сиденья проверена." }
        : { text: result.message, error: true });
    }
    keepFocus(event);
  }

  const gesture: BenchGesture | null = exercise && instruction ? {
    target: step === "release" ? exercise.latch.target : exercise.cushion.target,
    label: instruction.button,
    clip: step === "release" ? exercise.latch.clip : step === "raise" ? exercise.cushion.clip : undefined,
    onFinish: () => adjust(),
  } : null;

  return (
    <div className="bench-station">
      <div className="play-scene scene-bench">
        <Suspense fallback={<div className="bench-view"><div className="bench-view-placeholder">
          <Equipment name="bench" alt="Регулируемая скамья" />
          <p role="status">Загружается 3D-модель…</p>
        </div></div>}>
          <BenchView pose={pose} part={part} gesture={gesture} />
        </Suspense>
        {exercise ? (
          <ol className="bench-parts" aria-label="Подушки скамьи">
            {benchParts.map((id) => (
              <li key={id} aria-current={id === part ? "step" : undefined}>
                {progress.benchAdjustments.includes(id) && <Icon name="check" size={16} />}
                {exercises[id].label}
              </li>
            ))}
          </ol>
        ) : (
          <nav className="check-track" aria-label="Порядок проверок">
            {station.items.map(({ id }, index) => (
              <button
                type="button"
                key={id}
                className="check-step"
                aria-label={`Шаг ${index + 1}: ${descriptions[id].label}${index < done ? " (выполнен)" : ""}`}
                aria-current={index === done ? "step" : undefined}
                disabled={index < done}
                onClick={(event) => checkStep(id, event)}
              >{index < done ? <Icon name="check" size={18} /> : index + 1}</button>
            ))}
          </nav>
        )}
      </div>
      <div className="bench-guide">
        <div className="bench-step-heading">
          <span className="bench-icon"><Icon name={check?.icon ?? "bench"} size={24} /></span>
          <div>
            <p className="accent-label">{exercise
              ? `${exercise.label} · шаг ${stepNumber[step]} из 3`
              : `Проверка ${done + 1} из ${station.items.length}`}</p>
            <h2>{instruction?.title ?? check?.label}</h2>
          </div>
        </div>
        <p id="bench-detail">{instruction?.detail ?? check?.detail}</p>
        {exercise && <p className="bench-position">{exercise.position}</p>}
        <button id="bench-action" type="button" className="button primary" aria-describedby="bench-detail"
          onClick={task.kind === "check" ? (event) => checkStep(task.check.id, event) : adjust}>
          {instruction?.button ?? "Отметить проверку"} <Icon name="arrow" />
        </button>
        <p className={`bench-feedback${feedback?.error ? " bench-error" : ""}`} role="status" aria-live="polite">
          {feedback?.text ?? ""}
        </p>
      </div>
    </div>
  );
}
