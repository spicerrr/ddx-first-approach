import { describe, expect, it } from "vitest";
import { newProgress, nextStation, start, stationProgress, submit } from "./src/engine/game";
import { barbellLayout } from "./src/engine/barbell";
import { floorId, stations } from "./src/engine/scenario";

const at = "2026-11-16T09:00:00.000Z";
const place = (stage, item, destination) => ({ kind: "place", stage, item, destination });
const dumbbell = (item, target) => place("DUMBBELLS", item, target);
const move = (item, destination) => ({ kind: "move-barbell", item, destination });
const bench = (check) => ({ kind: "bench", check });
const adjust = (part) => ({ kind: "bench-adjustment", part });
const check = { kind: "check-barbell" };
const closeBarbell = [move("LOCK_A", "LEFT"), move("LOCK_B", "RIGHT"), check];
const tens = [move("DISK_10_A", "LEFT"), move("DISK_10_B", "RIGHT")];
const fives = [
  move("DISK_5_A", "LEFT"), move("DISK_5_B", "LEFT"),
  move("DISK_5_C", "RIGHT"), move("DISK_5_D", "RIGHT"),
];
const actions = [
  [
    dumbbell("DB_8_A", "RACK_LEFT"), dumbbell("DB_8_B", "RACK_LEFT"),
    dumbbell("DB_12_A", "RACK_MIDDLE"), dumbbell("DB_12_B", "RACK_MIDDLE"),
    dumbbell("DB_16_A", "RACK_RIGHT"), dumbbell("DB_16_B", "RACK_RIGHT"),
  ],
  [...tens, ...closeBarbell],
  [bench("UNLOADED"), adjust("backrest"), adjust("seat"), bench("VERIFY_LOCK")],
  [
    place("INVENTORY", "MAT_1", "MATS"), place("INVENTORY", "MAT_2", "MATS"),
    place("INVENTORY", "BAND_1", "BANDS"), place("INVENTORY", "BAND_2", "BANDS"),
    place("INVENTORY", "BLOCK_1", "BLOCKS"), place("INVENTORY", "BLOCK_2", "BLOCKS"),
    place("INVENTORY", "ROLLER_1", "ROLLERS"), place("INVENTORY", "ROLLER_2", "ROLLERS"),
  ],
];

function accept(progress, action) {
  const result = submit(progress, action, at);
  expect(result, result.message).toMatchObject({ accepted: true });
  return result.progress;
}

function reject(progress, action, explanation) {
  const result = submit(progress, action, at);
  expect(result.accepted).toBe(false);
  expect(result.progress).toBe(progress);
  if (explanation) expect(result.message).toContain(explanation);
}

function atStation(index) {
  let progress = start(newProgress(), at);
  for (let i = 0; i < index; i++) progress = nextStation(actions[i].reduce(accept, progress));
  return progress;
}

describe("Один игровой маршрут", () => {
  it("зачитывает четыре станции и завершает маршрут один раз", () => {
    let progress = atStation(0);
    for (const [index, group] of actions.entries()) {
      for (const [step, action] of group.entries()) {
        progress = accept(progress, action);
        const done = index === 0 ? Math.floor((step + 1) / 2) : index === 1 ? Number(action === check) : step + 1;
        expect(stationProgress(progress, stations[index])).toBe(done);
      }
      expect(progress.phase).toBe("lesson");
      expect(progress.stageIndex).toBe(index);
      reject(progress, group.at(-1));
      progress = nextStation(progress);
    }
    expect(progress.phase).toBe("complete");
    expect(progress.events.map((event) => event.type)).toEqual([
      "game_session_started",
      "game_stage_completed", "game_stage_completed", "game_stage_completed", "game_stage_completed",
      "game_session_completed",
    ]);
    expect(start(progress)).toBe(progress);
    expect(nextStation(progress)).toBe(progress);
  });

  it("создаёт чистое прохождение и блокирует действия до начала", () => {
    const older = actions[1].reduce(accept, atStation(1));
    expect(older.phase).toBe("lesson");
    const fresh = newProgress();
    expect(fresh.placements).toEqual({ DUMBBELLS: {}, INVENTORY: {} });
    expect(barbellLayout(fresh.barbell)).toMatchObject({ totalKg: 60, collarCount: 0 });
    expect(fresh.events).toEqual([]);
    reject(fresh, actions[0][0]);
    expect(start(start(fresh, at), at).events).toHaveLength(1);
  });

  it("считает пары и разрешает исправлять расстановку гантелей", () => {
    const state = accept(atStation(0), dumbbell("DB_8_A", "RACK_RIGHT"));
    expect(stationProgress(state, stations[0])).toBe(0);
    reject(state, dumbbell("DB_12_A", "RACK_RIGHT"), "8 кг");
    reject(state, dumbbell("DB_8_B", "RACK_LEFT"), "уже на стойке");
    const paired = accept(state, dumbbell("DB_8_B", "RACK_RIGHT"));
    expect(stationProgress(paired, stations[0])).toBe(1);
    reject(paired, dumbbell("DB_12_A", "RACK_RIGHT"), "уже стоит пара");
    const returned = accept(paired, dumbbell("DB_8_A", floorId));
    expect(returned.placements.DUMBBELLS).toEqual({ DB_8_B: "RACK_RIGHT" });
    expect(stationProgress(returned, stations[0])).toBe(0);
  });

  it("различает недовес, перевес, разницу масс и разницу наборов", () => {
    const initial = atStation(1);
    expect(barbellLayout(initial.barbell)).toMatchObject({ totalKg: 60, leftKg: 20, rightKg: 20 });
    const under = [tens[0], move("DISK_5_A", "RIGHT")].reduce(accept, initial);
    expect(barbellLayout(under.barbell).totalKg).toBe(75);
    reject(under, check, "До цели не хватает 5 кг.");
    const mixed = accept(under, move("DISK_5_B", "RIGHT"));
    expect(barbellLayout(mixed.barbell)).toMatchObject({ totalKg: 80, leftKg: 30, rightKg: 30, symmetric: false });
    reject(mixed, check, "одинаковые наборы");
    const unbalanced = [move("DISK_10_A", floorId), move("DISK_5_B", floorId), move("DISK_5_A", floorId),
      move("DISK_10_A", "RIGHT"), move("DISK_10_B", "RIGHT")].reduce(accept, mixed);
    reject(unbalanced, check, "Слева 20 кг");
    const over = accept(mixed, move("DISK_5_C", "LEFT"));
    reject(over, check, "Убери 5 кг");
  });

  it("зачитывает два симметричных решения только с замком на каждой втулке", () => {
    for (const sequence of [tens, fives]) {
      const prepared = sequence.reduce(accept, atStation(1));
      reject(prepared, check, "по замку");
      const a = accept(prepared, move("LOCK_A", "RIGHT"));
      reject(a, check, "второй замок");
      reject(a, move("LOCK_B", "RIGHT"), "уже есть замок");
      const b = accept(a, move("LOCK_B", "LEFT"));
      const done = accept(b, check);
      expect(done.phase).toBe("lesson");
      reject(done, check);
    }
  });

  it("снимает замок и внешний диск, позволяет снять стартовый диск и переставить его", () => {
    const initial = atStation(1);
    const assembled = [tens[0], move("LOCK_A", "LEFT")].reduce(accept, initial);
    reject(assembled, move("DISK_10_A", floorId), "сдвинь замок");
    reject(assembled, move("DISK_5_B", "LEFT"), "сдвинь замок");
    const unlocked = accept(assembled, move("LOCK_A", floorId));
    reject(unlocked, move("DISK_20_A", floorId), "крайнего диска");
    const outerRemoved = accept(unlocked, move("DISK_10_A", floorId));
    const allRemoved = accept(outerRemoved, move("DISK_20_A", floorId));
    expect(barbellLayout(allRemoved.barbell).totalKg).toBe(40);
    const relocated = accept(allRemoved, move("DISK_20_A", "RIGHT"));
    expect(relocated.barbell.disks.RIGHT).toEqual(["DISK_20_B", "DISK_20_A"]);
    const full = accept(relocated, move("DISK_5_A", "RIGHT"));
    reject(full, move("DISK_5_B", "RIGHT"), "Втулка заполнена");
    expect(accept(full, move("LOCK_B", "RIGHT")).barbell.collars.RIGHT).toBe("LOCK_B");
  });

  it("проверяет оба фиксатора и порядок подготовки скамьи", () => {
    const state = atStation(2);
    reject(state, bench("VERIFY_LOCK"), "освободи скамью");
    const a = accept(state, bench("UNLOADED"));
    reject(a, bench("UNLOADED"));
    reject(a, adjust("seat"));
    reject(a, bench("VERIFY_LOCK"));
    const b = accept(a, adjust("backrest"));
    reject(b, adjust("backrest"));
    const ready = accept(b, adjust("seat"));
    expect(accept(ready, bench("VERIFY_LOCK")).phase).toBe("lesson");
  });

  it("отклоняет чужую зону, неизвестный предмет и действие другой станции", () => {
    const state = accept(atStation(3), actions[3][0]);
    reject(state, place("INVENTORY", "MAT_2", "BANDS"));
    reject(state, place("INVENTORY", "UNKNOWN", "MATS"));
    reject(state, actions[0][0]);
    expect(state.placements.INVENTORY).toEqual({ MAT_1: "MATS" });
  });
});
