import type { StationId } from "../engine/scenario";
import { asset } from "./graphics";
import { benchModel } from "./bench-resource";
import { preloadBoard } from "./station-board";

const art: Record<StationId, readonly string[]> = {
  DUMBBELLS: ["dumbbell-rack-empty", ...[2, 4, 6, 8, 10, 12, 14, 16].map((weight) => "rack-dumbbell-" + weight),
    ...[8, 12, 16].map((weight) => "dumbbell-floor-" + weight)],
  BARBELL: ["bar-shaft", "bar-tray-collar", "bar-clamp", "bar-clamp-open", "bar-clamp-closed",
    ...[5, 10, 20].flatMap((weight) => ["bar-disk-" + weight, "bar-tray-" + weight])],
  BENCH: [],
  INVENTORY: ["inventory-plate-rack", "inventory-storage-rack", "inventory-band-hanging", "inventory-band-hanging-coral",
    "mat", "mat-teal", "mat-unroll-coral", "mat-unroll-teal", "band", "band-coral", "block", "block-light", "roller", "roller-teal",
    ...[5, 10, 15, 20, 25].map((weight) => "inventory-plate-" + weight)],
};

const images = new Map<string, HTMLImageElement>();

export function warmStation(stage: StationId) {
  void preloadBoard(stage).catch(() => undefined);
  if (stage === "BENCH") {
    void import("./bench-view").catch(() => undefined);
    void benchModel().catch(() => undefined);
  }
  for (const name of art[stage]) {
    if (images.has(name)) continue;
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.onerror = () => images.delete(name);
    image.src = asset(name);
    images.set(name, image);
  }
}
