import { expect, it } from "vitest";
import { newChallenge, submitChallenge } from "./src/engine/challenge";
import { barbellLayout } from "./src/engine/barbell";

const place = (stage, item, destination) => ({ kind: "place", stage, item, destination });
const move = (item, destination) => ({ kind: "move-barbell", item, destination });
const mount = (side) => ({ kind: "toggle-collar", side });
const attempt = (state, action) => submitChallenge(state, action).challenge;

it("проверяет перестановку одной пары и трёх предметов без изменения прогресса обучения", () => {
  const dumbbells = newChallenge("DUMBBELLS");
  const wrong = attempt(dumbbells, place("DUMBBELLS", "DB_12_A", "RACK_8"));
  expect(wrong.outcome).toBe("retry");
  expect(wrong.progress).toBe(dumbbells.progress);
  expect([place("DUMBBELLS", "DB_12_A", "RACK_12"), place("DUMBBELLS", "DB_12_B", "RACK_12")].reduce(attempt, wrong).outcome).toBe("passed");
  const inventory = newChallenge("INVENTORY");
  expect(Object.keys(inventory.progress.placements.INVENTORY)).toHaveLength(10);
  expect([place("INVENTORY", "PLATE_15", "PLATES_15"), place("INVENTORY", "BAND_1", "BANDS"),
    place("INVENTORY", "ROLLER_2", "ROLLERS")].reduce(attempt, inventory).outcome).toBe("passed");
});

it("проверяет штангу на новую массу с теми же правилами равновесия и замков", () => {
  const check = { kind: "check-barbell" };
  const setup = [move("DISK_20_A", "LEFT"), move("DISK_20_B", "RIGHT"), move("DISK_5_A", "LEFT"), move("DISK_5_B", "RIGHT")]
    .reduce(attempt, newChallenge("BARBELL"));
  expect(barbellLayout(setup.progress.barbell, 70)).toMatchObject({ totalKg: 70, disksReady: true });
  expect(attempt(setup, check).outcome).toBe("retry");
  expect([move("LOCK_A", "LEFT"), move("LOCK_B", "RIGHT"), mount("LEFT"), mount("RIGHT"), check]
    .reduce(attempt, setup).outcome).toBe("passed");
});

it("проверяет для скамьи новую ступень и даёт повторить попытку", () => {
  const bench = newChallenge("BENCH");
  const wrong = attempt(bench, { kind: "bench-adjustment", part: "backrest", notch: 2 });
  expect(wrong.outcome).toBe("retry");
  expect(attempt(wrong, { kind: "bench-adjustment", part: "backrest", notch: 1 }).outcome).toBe("passed");
});
