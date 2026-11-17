import type { ReactNode } from "react";
import { asset } from "./graphics";

export function CoachMessage({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return (
    <div className="coach-message" data-warning={warning || undefined}>
      <span className="coach-avatar" aria-hidden="true">
        <img src={asset(warning ? "coach-explaining" : "coach-neutral")} alt="" />
      </span>
      <div>
        <strong>Тренер</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function CoachFeedback({ message, hint }: { message: string; hint?: string | null }) {
  return (
    <div className="scene-response" aria-live="polite" aria-atomic="true">
      <CoachMessage warning={Boolean(hint)}>{hint ?? message}</CoachMessage>
    </div>
  );
}
