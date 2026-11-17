import type { Item } from "../engine/scenario";

export function asset(file: string) {
  return `${import.meta.env.BASE_URL}art/${file}.webp`;
}

export function sceneAsset(file: string) {
  return `${import.meta.env.BASE_URL}art/${file}.png`;
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
  home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"/><path d="M9 16h6"/></>,
  calendar: <><rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 3v5m8-5v5M4 11h16M8 15h.01m4 0h.01m4 0h.01M8 18h.01m4 0h.01"/></>,
  play: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 9h18c0-2-3-3-3-9M10 21h4"/></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.4-2.1"/></>,
  gym: <><path d="M7 5v14m10-14v14M4 8v8m16-8v8M7 12h10"/></>,
  bench: <><path d="m9 12 8-8m-8 8H4m5 0-3 7m3-7 9 7m-15 0h6m6 0h6"/></>,
  storage: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/></>,
  book: <><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6m-6 4h6"/></>,
  person: <><circle cx="12" cy="8" r="3"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></>,
  rotate: <><path d="M4 11a8 8 0 1 1 2 6M4 5v6h6"/></>,
  level: <><path d="M4 17h16M7 13V7m5 6V5m5 8V9"/><path d="M4 20h16"/></>,
} as const;

export type IconName = keyof typeof iconPaths;
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

export type ArtName = "dumbbells" | "plate" | "mat" | "band" | "block" | "roller";
const inventoryArt: Record<string, ArtName> = { MAT: "mat", BAND: "band", BLOCK: "block", ROLLER: "roller" };

export function Equipment({ name, className = "", alt = "" }: { name: ArtName; className?: string; alt?: string }) {
  return <img className={`equipment ${className}`} src={asset(name)} alt={alt} decoding="async" draggable={false} />;
}

export function inventoryAsset(item: Item) {
  if (item.id.startsWith("PLATE_")) return asset("inventory-plate-" + item.weightKg);
  return asset(inventoryArt[item.id.split("_")[0]]);
}
