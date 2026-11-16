import type { Item, PlacementStation } from "../engine/scenario";

export function asset(file: string) {
  return `${import.meta.env.BASE_URL}art/${file}.webp`;
}

const iconPaths = {
  arrow: <><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></>,
  back: <><path d="M20 12H5"/><path d="m11 6-6 6 6 6"/></>,
  external: <><path d="M6 18 18 6"/><path d="M8 6h10v10"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  plus: <><path d="M12 6v12"/><path d="M6 12h12"/></>,
  close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
  alert: <><path d="M12 6v7"/><path d="M12 17h.01"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
  gym: <><path d="M7 5v14m10-14v14M4 8v8m16-8v8M7 12h10"/></>,
  bench: <><path d="m9 12 8-8m-8 8H4m5 0-3 7m3-7 9 7m-15 0h6m6 0h6"/></>,
  storage: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/></>,
  book: <><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6m-6 4h6"/></>,
  person: <><circle cx="12" cy="8" r="3"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></>,
  level: <><path d="M4 17h16M7 13V7m5 6V5m5 8V9"/><path d="M4 20h16"/></>,
} as const;

export type IconName = keyof typeof iconPaths;
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

export type ArtName = "dumbbells" | "plate" | "mat" | "band" | "block" | "roller" | "bench";
const inventoryArt: Record<string, ArtName> = { MAT: "mat", BAND: "band", BLOCK: "block", ROLLER: "roller" };

export function Equipment({ name, className = "", alt = "" }: { name: ArtName; className?: string; alt?: string }) {
  return <img className={`equipment ${className}`} src={asset(name)} alt={alt} decoding="async" draggable={false} />;
}

export function ItemArt({ station, item }: { station: PlacementStation; item: Item }) {
  const name = station === "DUMBBELLS" ? "dumbbells" : station === "BARBELL" ? "plate" : inventoryArt[item.id.split("_")[0]];
  const weight = item.weightKg ?? item.id.split("_")[1];
  return <Equipment name={name} className={station === "INVENTORY" ? "" : `mass-${weight}`} />;
}
