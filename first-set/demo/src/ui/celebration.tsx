import type { CSSProperties } from "react";
import { asset, Icon } from "./graphics";

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

export function FinishMedal() {
  return (
    <div className="finish-medal" aria-hidden="true">
      <img src={asset("finish-medal")} alt="" width={422} height={424} />
    </div>
  );
}

const confettiColors = ["#ff782c", "#06c7d5", "#ffeab7", "#ffc267", "#88fffa"];

export function Confetti() {
  return (
    <div className="finish-confetti" aria-hidden="true">
      {Array.from({ length: 60 }, (_, index) => {
        const right = index % 2 === 0;
        const phase = index * 23 % 61;
        const near = index % 4 === 0;
        return <i key={index} className="confetti-piece" data-shape={index % 3 === 0 ? "pearl" : "ribbon"}
          data-near={near || undefined} style={{
            left: (right ? 82 : 18) + "%",
            "--pigment": confettiColors[index % confettiColors.length],
            "--lift": -(62 + phase * 1.8) + "px",
            "--drift": (right ? -1 : 1) * (phase - 13) + "cqw",
            "--spin": (right ? -1 : 1) * (160 + index % 9 * 46) + "deg",
            "--turn": 230 + phase * 5 + "deg",
            "--delay": 120 + index * 29 % 620 + "ms",
            "--time": 2700 + index * 61 % 1250 + "ms",
            "--size": (near ? 8 : 4) + index % 3 + "px",
            "--depth": near ? "38px" : "-28px",
          } as CSSProperties} />;
      })}
    </div>
  );
}
