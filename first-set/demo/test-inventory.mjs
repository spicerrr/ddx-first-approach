import { describe, expect, it, vi } from "vitest";
import { completedStationCount, inventoryPlacements, nextStation, restoreProgress, start, stationProgress, stationTotal, submit } from "./src/engine/game";
import { createInventoryInitialLayout, inventoryMilestone, inventoryRemaining } from "./src/engine/inventory";
import { stations } from "./src/engine/scenario";
import { inventoryRule } from "./src/engine/station-hints";

const station = stations[3];
const place = (item, destination = item.targetId) => ({ kind: "place", stage: station.stage, item: item.id, destination });
function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe("Начальная раскладка инвентаря", () => {
  it("сохраняет инварианты для 256 начальных значений генератора", () => {
    const supplies = station.items.filter(({ weightKg }) => weightKg === undefined);
    const categories = new Set(supplies.map(({ targetId }) => targetId));
    const seen = new Set();
    for (let seed = 0; seed < 256; seed++) {
      const assigned = createInventoryInitialLayout(seeded(seed));
      seen.add(Object.keys(assigned).sort().join(","));
      const fitted = station.items.filter(({ id }) => Object.hasOwn(assigned, id));
      const fittedSupplies = fitted.filter(({ weightKg }) => weightKg === undefined);
      const loose = inventoryRemaining(assigned);
      expect(fitted).toHaveLength(5);
      expect(fitted.filter(({ weightKg }) => weightKg !== undefined)).toHaveLength(2);
      expect(fittedSupplies).toHaveLength(3);
      expect(new Set(fittedSupplies.map(({ targetId }) => targetId)).size).toBe(3);
      expect(loose).toMatchObject({ plates: 3, supplies: 5 });
      expect(loose.loose).toHaveLength(8);
      expect(new Set(loose.loose.filter(({ weightKg }) => weightKg === undefined).map(({ targetId }) => targetId))).toEqual(categories);
      for (const item of fitted) expect(assigned[item.id]).toBe(item.targetId);
    }
    expect(seen.size).toBeGreaterThan(60);
  });

  it("создаёт раскладку один раз, разделяет исходные размещения и действия", () => {
    const rng = vi.fn(() => .99);
    const ready = restoreProgress(3);
    const initial = start(ready, rng);
    expect(rng).toHaveBeenCalledTimes(8);
    expect(start(initial, rng)).toBe(initial);
    expect(rng).toHaveBeenCalledTimes(8);
    expect(stationProgress(initial, station)).toBe(0);
    expect(stationTotal(station)).toBe(8);
    const alreadyStored = station.items.find(({ id }) => initial.inventoryInitial[id]);
    const spare = inventoryRemaining(initial.inventoryInitial).loose[0];
    for (const attempt of [place(alreadyStored), place(alreadyStored, spare.targetId), place(spare, "MATS")]) {
      expect(submit(initial, attempt)).toMatchObject({ accepted: false, progress: initial });
    }
    const result = submit(initial, place(spare));
    expect(result.accepted).toBe(true);
    expect(result.progress.placements.INVENTORY).toEqual({ [spare.id]: spare.targetId });
    expect(result.progress.inventoryInitial).toBe(initial.inventoryInitial);
    expect(inventoryRemaining(inventoryPlacements(result.progress)).loose).toHaveLength(7);
    expect(start(result.progress, rng)).toBe(result.progress);
    expect(start(restoreProgress(3), () => 0).inventoryInitial).not.toEqual(initial.inventoryInitial);
  });

  it("считает реплику по оставшимся в категории и завершает станцию после восьмого действия", () => {
    let progress = start(restoreProgress(3), () => .99);
    const loose = inventoryRemaining(inventoryPlacements(progress)).loose;
    const items = [...loose.filter(({ weightKg }) => weightKg !== undefined),
      ...loose.filter(({ weightKg }) => weightKg === undefined)];
    for (const [index, item] of items.entries()) {
      const result = submit(progress, place(item));
      expect(result.accepted).toBe(true);
      progress = result.progress;
      const remaining = inventoryRemaining(inventoryPlacements(progress));
      expect(remaining.loose.length).toBe(7 - index);
      const line = inventoryMilestone(item, remaining, index + 1);
      if (index === 0) expect(line).toContain("ориентироваться по подписям");
      if (index === 2) expect(line).toBe("Все диски на стойке.");
      if (item.id === "BAND_1") expect(line).toBe("Резинки на месте.");
      if (index < 7) expect(progress.phase).toBe("playing");
      else expect(line).toBe("Готово. Инвентарь на местах, проход свободен.");
    }
    expect(progress.phase).toBe("complete");
    expect(completedStationCount(progress)).toBe(4);
    expect(nextStation(progress)).toBe(progress);
    expect(restoreProgress(4).phase).toBe("complete");
  });

  it("ведёт ошибки по правилу категории и сохраняет конкретный штырь в подсказке", () => {
    const rule = (id) => inventoryRule(station.items.find((item) => item.id === id));
    expect(rule("BAND_1").id).toBe(rule("BAND_2").id);
    expect(rule("BAND_1").id).not.toBe(rule("MAT_1").id);
    expect(rule("PLATE_5").id).toBe(rule("PLATE_20").id);
    expect(rule("PLATE_5").highlight).toBe("PLATES_5");
    expect(rule("PLATE_20").highlight).toBe("PLATES_20");
  });
});
