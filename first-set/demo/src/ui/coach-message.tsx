import type { ReactNode } from "react";
import type { CoachLine } from "../engine/hints";
import { asset } from "./graphics";

export function CoachMessage({ children, tone = "task", level, controls }: {
  children: ReactNode; tone?: CoachLine["tone"]; level?: number; controls?: ReactNode;
}) {
  return (
    <div className="coach-message" data-tone={tone} data-hint-level={level}>
      <span className="coach-avatar" aria-hidden="true">
        <img src={asset("coach-neutral")} alt="" />
      </span>
      <div className="coach-copy">
        <strong>Тренер</strong>
        <p aria-live="polite" aria-atomic="true">{children}</p>
      </div>
      {controls}
    </div>
  );
}

export function CoachFeedback({ message, line, controls }: {
  message: string; line?: CoachLine; controls?: ReactNode;
}) {
  return (
    <div className="scene-response">
      <CoachMessage tone={line?.tone} level={line?.level} controls={controls}>
        {line?.text ?? message}
      </CoachMessage>
    </div>
  );
}
