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
