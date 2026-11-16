import { useState, type MouseEvent } from "react";
import type { Result } from "../engine/game";
import type { Station } from "../engine/scenario";
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

export function BenchChecks({ station, done, check }: {
  station: Station;
  done: number;
  check: (step: string) => Result;
}) {
  const [error, setError] = useState("");
  const current = station.items[done];
  const step = descriptions[current.id];

  function attempt(id: string, event: MouseEvent) {
    const result = check(id);
    setError(result.accepted ? "" : result.message);
    if (result.accepted && event.detail === 0) {
      requestAnimationFrame(() => document.getElementById("bench-check")?.focus({ preventScroll: true }));
    }
  }

  return (
    <div className="bench-station">
      <div className="play-scene scene-bench">
        <div className="bench-photo">
          <Equipment name="bench" alt="Регулируемая скамья с наклонённой спинкой" />
        </div>
        <nav className="check-track" aria-label="Порядок проверок">
          {station.items.map(({ id }, index) => (
            <button
              type="button"
              key={id}
              className="check-step"
              aria-label={`Шаг ${index + 1}: ${descriptions[id].label}${index < done ? " (выполнен)" : ""}`}
              aria-current={index === done ? "step" : undefined}
              disabled={index < done}
              onClick={(event) => attempt(id, event)}
            >{index < done ? <Icon name="check" size={18} /> : index + 1}</button>
          ))}
        </nav>
      </div>
      <div className="bench-guide">
        <div className="bench-step-heading">
          <span className="bench-icon"><Icon name={step.icon} size={24} /></span>
          <div>
            <p className="accent-label">Проверка {done + 1} из {station.items.length}</p>
            <h2>{step.label}</h2>
          </div>
        </div>
        <p id="bench-detail">{step.detail}</p>
        <button id="bench-check" type="button" className="button primary" aria-describedby="bench-detail" onClick={(event) => attempt(current.id, event)}>
          Отметить проверку <Icon name="arrow" />
        </button>
        <p className="bench-error" role="status" aria-live="polite">{error}</p>
      </div>
    </div>
  );
}
