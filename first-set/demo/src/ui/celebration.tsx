import type { CSSProperties } from "react";
import { Icon } from "./graphics";

export function CheckBurst({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={"check-burst " + className} role={label ? "img" : undefined} aria-label={label} aria-hidden={!label}>
      <i className="check-burst-ring" />
      <span className="check-burst-mark"><Icon name="check" size={39} /></span>
      {Array.from({ length: 8 }, (_, index) => (
        <i key={index} className="check-burst-ray" style={{ "--ray-angle": index * 45 + "deg", "--delay": index * 20 + "ms" } as CSSProperties} />
      ))}
    </div>
  );
}

const confettiColors = ["var(--accent)", "var(--aqua)", "var(--ink)", "#fff", "#f5ac4f"];

export function Confetti() {
  return (
    <div className="finish-confetti" aria-hidden="true">
      {Array.from({ length: 54 }, (_, index) => (
        <i key={index} className="confetti-piece" style={{
          left: (index * 41 % 103) + "%",
          backgroundColor: confettiColors[index % confettiColors.length],
          "--spin": (index % 2 ? -1 : 1) * (170 + index % 9 * 57) + "deg",
          "--drift": (index * 23 % 109 - 54) + "px",
          "--delay": index * 47 % 510 + "ms",
          "--time": 1650 + index * 61 % 980 + "ms",
          "--size": 5 + index % 6 + "px",
        } as CSSProperties} />
      ))}
    </div>
  );
}
