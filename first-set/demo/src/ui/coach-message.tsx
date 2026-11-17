import type { ReactNode } from "react";
import { asset, Icon } from "./graphics";

export function CoachMessage({ children, visitor = false, live = false, className = "" }: {
  children: ReactNode; visitor?: boolean; live?: boolean; className?: string;
}) {
  return (
    <div className={("coach-message " + className).trim()} data-visitor={visitor || undefined}>
      <span className="coach-avatar" aria-hidden="true">
        {visitor ? <Icon name="person" size={19} /> : <img src={asset("coach-avatar-blue")} alt="" />}
      </span>
      <div>
        <strong>{visitor ? "Посетитель" : "Тренер"}</strong>
        <p aria-live={live ? "polite" : undefined} aria-atomic={live || undefined}>{children}</p>
      </div>
    </div>
  );
}
