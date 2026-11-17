import type { ReactNode } from "react";
import { asset } from "./graphics";

export function CoachMessage({ children }: { children: ReactNode }) {
  return (
    <div className="coach-message">
      <span className="coach-avatar" aria-hidden="true">
        <img src={asset("coach-neutral")} alt="" />
      </span>
      <div>
        <strong>Тренер</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function CoachHint({ children }: { children: ReactNode }) {
  return (
    <div className="coach-hint">
      <img src={asset("coach-explaining")} alt="" />
      <p>{children}</p>
    </div>
  );
}

export function CoachFeedback({ message, hint }: { message: string; hint?: string | null }) {
  return (
    <div className="scene-response" data-hint={Boolean(hint) || undefined} aria-live="polite" aria-atomic="true">
      <CoachMessage>{message}</CoachMessage>
      {hint && <CoachHint key={hint}>{hint}</CoachHint>}
    </div>
  );
}
