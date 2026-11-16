import { describe, expect, it } from "vitest";
import { newProgress, nextStation, start, stationProgress, submit } from "./src/engine/game";
import { barbellLayout } from "./src/engine/barbell";
import { legacyVersion, stations } from "./src/engine/scenario";
import { decode, freshData, migrate, readData, saveData, storageKey, withUiEvent } from "./src/engine/store";

const at = "2026-11-16T09:00:00.000Z";
const place = (stage, item, destination) => ({ kind: "place", stage, item, destination });
const bench = (check) => ({ kind: "bench", check });
const adjust = (part) => ({ kind: "bench-adjustment", part });

const disk = (item, side) => place("BARBELL", item, side);
const checkBarbell = { kind: "check-barbell" };
const actions = [
  [
    place("DUMBBELLS", "DB_8_B", "RACK_8"),
    place("DUMBBELLS", "DB_12_A", "RACK_12"),
    place("DUMBBELLS", "DB_12_B", "RACK_12"),
    place("DUMBBELLS", "DB_16_A", "RACK_16"),
    place("DUMBBELLS", "DB_16_B", "RACK_16"),
  ],
  [disk("DISK_10_A", "LEFT"), disk("DISK_10_B", "RIGHT"), checkBarbell],
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
  expect(result.accepted).toBe(true);
  return result.progress;
}

function atStation(index) {
  let progress = start(newProgress(), at);
  for (let i = 0; i < index; i += 1) progress = nextStation(actions[i].reduce(accept, progress));
  return progress;
}

function envelope(progress) {
  return { ...freshData(), progress };
}

describe("Правила и переходы", () => {
  it("ведёт через четыре станции и завершает сессию один раз", () => {
    let progress = atStation(0);
    for (const [index, group] of actions.entries()) {
      for (const [step, action] of group.entries()) {
        progress = accept(progress, action);
        expect(stationProgress(progress, stations[index])).toBe(index === 1 ? Number(action === checkBarbell) : step + 1);
      }
      expect(progress.phase).toBe("lesson");
      expect(progress.stageIndex).toBe(index);
      expect(decode(envelope(progress))).toEqual(envelope(progress));
      expect(submit(progress, group.at(-1)).progress).toBe(progress);
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
    expect(decode(envelope(progress))).toEqual(envelope(progress));
  });

  it("нельзя применить действие до начала или повторить запуск", () => {
    const fresh = newProgress();
    expect(submit(fresh, actions[0][0]).accepted).toBe(false);
    expect(start(start(fresh, at), at).events).toHaveLength(1);
  });

  it("неправильная ячейка и повторное размещение не меняют стойку", () => {
    const state = accept(atStation(0), actions[0][0]);
    const invalid = submit(state, place("DUMBBELLS", "DB_12_A", "RACK_16"));
    expect(invalid).toMatchObject({ accepted: false, message: expect.stringContaining("Ячейка 12 кг") });
    expect(invalid.progress).toBe(state);
    expect(submit(state, actions[0][0]).progress).toBe(state);
  });

  it("различает недовес, перевес, разницу масс и разницу наборов", () => {
    const initial = atStation(1);
    expect(barbellLayout(initial.placements.BARBELL)).toMatchObject({ totalKg: 60, leftKg: 20, rightKg: 20 });
    const under = [disk("DISK_10_A", "LEFT"), disk("DISK_5_A", "RIGHT")].reduce(accept, initial);
    expect(barbellLayout(under.placements.BARBELL).totalKg).toBe(75);
    expect(submit(under, checkBarbell)).toMatchObject({ accepted: false, progress: under, message: "До цели не хватает 5 кг." });
    const mixed = accept(under, disk("DISK_5_B", "RIGHT"));
    expect(barbellLayout(mixed.placements.BARBELL)).toMatchObject({ totalKg: 80, leftKg: 30, rightKg: 30, symmetric: false });
    expect(submit(mixed, checkBarbell)).toMatchObject({ accepted: false, progress: mixed, message: expect.stringContaining("одинаковые наборы") });
    const unbalanced = accept(mixed, disk("DISK_10_A", "RIGHT"));
    expect(submit(unbalanced, checkBarbell)).toMatchObject({ accepted: false, progress: unbalanced, message: expect.stringContaining("Слева 20 кг") });
    const over = accept(mixed, disk("DISK_5_C", "LEFT"));
    expect(submit(over, checkBarbell)).toMatchObject({ accepted: false, progress: over, message: expect.stringContaining("Убери 5 кг") });
  });

  it("сохраняет черновик, позволяет переставить и снять диск, засчитывает только проверку", () => {
    const initial = atStation(1);
    const loaded = actions[1].slice(0, 2).reduce(accept, initial);
    expect(decode(envelope(loaded))?.progress).toEqual(loaded);
    expect(loaded.phase).toBe("playing");
    const removed = accept(loaded, { kind: "remove-disk", item: "DISK_10_A" });
    expect(barbellLayout(removed.placements.BARBELL).totalKg).toBe(70);
    expect(submit(removed, { kind: "remove-disk", item: "DISK_10_A" }).progress).toBe(removed);
    const restored = accept(removed, disk("DISK_10_A", "LEFT"));
    const complete = accept(restored, checkBarbell);
    expect(complete.phase).toBe("lesson");
    expect(submit(complete, checkBarbell).progress).toBe(complete);
    const fives = [disk("DISK_5_A", "LEFT"), disk("DISK_5_B", "LEFT"), disk("DISK_5_C", "RIGHT"), disk("DISK_5_D", "RIGHT")];
    expect(accept(fives.reduce(accept, initial), checkBarbell).phase).toBe("lesson");
  });

  it("скамья отклоняет пропуск шага и повтор уже пройденной проверки", () => {
    const state = atStation(2);
    const invalid = submit(state, bench("VERIFY_LOCK"));
    expect(invalid.progress).toBe(state);
    expect(invalid.message).toContain("освободи скамью");
    const accepted = accept(state, bench("UNLOADED"));
    expect(submit(accepted, bench("UNLOADED")).accepted).toBe(false);
  });

  it("требует настройку обеих подушек перед финальной проверкой", () => {
    const state = accept(atStation(2), bench("UNLOADED"));
    expect(submit(state, bench("VERIFY_LOCK")).progress).toBe(state);
    expect(submit(state, adjust("seat")).progress).toBe(state);
    const backrestDone = accept(state, adjust("backrest"));
    expect(decode(envelope(backrestDone))?.progress.benchAdjustments).toEqual(["backrest"]);
    expect(submit(backrestDone, adjust("backrest")).progress).toBe(backrestDone);
    const seatDone = accept(backrestDone, adjust("seat"));
    expect(seatDone.phase).toBe("playing");
    expect(accept(seatDone, bench("VERIFY_LOCK")).phase).toBe("lesson");
  });

  it("чужая зона на складе, неизвестный предмет и другая станция не принимаются", () => {
    const state = accept(atStation(3), actions[3][0]);
    expect(submit(state, place("INVENTORY", "MAT_2", "BANDS")).progress).toBe(state);
    expect(submit(state, place("INVENTORY", "UNKNOWN", "MATS")).progress).toBe(state);
    expect(submit(state, actions[0][0]).progress).toBe(state);
    expect(state.placements.INVENTORY).toEqual({ MAT_1: "MATS" });
  });
});

describe("Локальное состояние", () => {
  it("сохраняет и восстанавливает уже принятые действия", () => {
    const values = new Map();
    const port = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const data = envelope(accept(atStation(0), actions[0][1]));
    expect(saveData(data, port)).toBe(true);
    expect(readData(port)).toEqual({ data, status: "ok" });
    saveData(envelope(start(newProgress(), at)), port);
    expect(readData(port).data.progress.placements.DUMBBELLS).toEqual({});
  });

  it("сохраняет прогресс и события прохождения при переходе к занятиям", () => {
    for (const progress of [newProgress(), atStation(2), actions[3].reduce(accept, atStation(3))]) {
      const data = withUiEvent(envelope(progress), { type: "intro_cta_clicked", at, from: "play", destination: "smart-start" });
      expect(data.progress).toBe(progress);
      expect(decode(data)?.uiEvents).toHaveLength(1);
    }
  });

  it("переносит действительное сохранение частичного прохождения из v2", () => {
    const v2 = {
      started: true, done: false, stageIndex: 0,
      placements: { DUMBBELLS: { PAIR_8: "RACK_8" }, BARBELL: {}, INVENTORY: {} },
      benchChecks: [],
      events: [
        { eventType: "game_session_started", occurredAt: at },
        { eventType: "intro_cta_clicked", occurredAt: at, destination: "Smart Start" },
      ],
    };
    expect(migrate(v2)).toEqual(envelope(accept(atStation(0), actions[0][0])));
  });

  it("переносит пройденные станции из 1.0 и сохраняет уже проверенную спинку", () => {
    const readyForSeat = actions[2].slice(0, 2).reduce(accept, atStation(2));
    const legacy = {
      ...envelope(readyForSeat),
      scenarioVersion: legacyVersion,
      progress: {
        ...readyForSeat,
        placements: {
          ...readyForSeat.placements,
          DUMBBELLS: { PAIR_8: "RACK_8", PAIR_12: "RACK_12", PAIR_16: "RACK_16" },
          BARBELL: { DISK_5_A: "LEFT", DISK_5_B: "RIGHT", DISK_10_A: "LEFT", DISK_10_B: "RIGHT" },
        },
        benchChecks: ["AREA_CLEAR", "UNLOADED", "MODEL_GUIDANCE", "ASK_TRAINER_IF_UNSURE", "NO_FORCE"],
      },
    };
    expect(decode(legacy)?.progress).toEqual(readyForSeat);
    expect(decode(envelope({ ...readyForSeat, benchAdjustments: ["seat"] }))).toBeNull();
    expect(decode(envelope({ ...readyForSeat, benchChecks: ["UNLOADED", "VERIFY_LOCK"] }))).toBeNull();
  });

  it.each([null, 1, [], {}, { ...freshData(), format: 2 }, { ...freshData(), scenarioVersion: "0.1" }])(
    "игнорирует неподдерживаемую запись %#", (value) => expect(decode(value)).toBeNull(),
  );

  it("отклоняет повреждённые размещения, ранний переход и дубли событий", () => {
    const state = atStation(0);
    expect(decode(envelope({ ...state, placements: { ...state.placements, DUMBBELLS: { PAIR_8: "RACK_16" } } }))).toBeNull();
    expect(decode(envelope({ ...state, stageIndex: 1 }))).toBeNull();
    expect(decode(envelope({ ...state, events: [...state.events, ...state.events] }))).toBeNull();
    expect(decode(envelope({ ...state, benchChecks: ["AREA_CLEAR"] }))).toBeNull();
  });

  it("открывает чистый экран при повреждённом JSON и недоступном хранилище", () => {
    const broken = { getItem: (key) => key === storageKey ? "{" : null, setItem() {} };
    expect(readData(broken)).toEqual({ data: freshData(), status: "invalid" });
    const forbidden = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
    expect(readData(forbidden)).toEqual({ data: freshData(), status: "unavailable" });
    expect(saveData(freshData(), forbidden)).toBe(false);
  });
});
