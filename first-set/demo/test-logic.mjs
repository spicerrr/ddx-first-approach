import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const js = fs.readFileSync(new URL("./logic.js", import.meta.url), "utf8");

function boot(storage = new Map()) {
  const elements = new Map();
  class Element {
    constructor(tag = "div") {
      this.tag = tag;
      this.children = [];
      this.handlers = {};
      this.textContent = "";
      this.disabled = false;
    }
    append(...nodes) { this.children.push(...nodes); }
    insertAdjacentHTML() {}
    addEventListener(name, fn) { this.handlers[name] = fn; }
    setAttribute() {}
    querySelector(selector) {
      if (selector.startsWith("button")) return this.children.find(node => !node.disabled) || null;
      return { focus() {}, tabIndex: -1 };
    }
    focus() {}
    click() {
      assert.ok(!this.disabled, "button is not disabled");
      assert.equal(typeof this.handlers.click, "function", "button has a click handler");
      this.handlers.click();
    }
  }
  const main = new Element("main");
  Object.defineProperty(main, "innerHTML", {
    set(markup) { this.markup = markup; elements.clear(); },
    get() { return this.markup; }
  });
  const document = {
    createElement: tag => new Element(tag),
    getElementById(id) {
      if (id === "screen") return main;
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    }
  };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  };
  const context = vm.createContext({ document, localStorage, console });
  vm.runInContext(js + `
    globalThis.testApi = {
      start,
      setSelection(id) { selectedItemId = id; },
      placeSelected,
      readState() { return JSON.parse(JSON.stringify(state)); }
    };
  `, context, { filename: "logic.js" });
  return { api: context.testApi, storage, get(id) { return document.getElementById(id); } };
}

test("four stations, error recovery, unique completion events, and resume", () => {
  const app = boot();
  const { api } = app;
  api.start();
  assert.equal(api.readState().stageIndex, 0);
  api.setSelection("PAIR_8");
  api.placeSelected("DUMBBELLS", "RACK_12");
  assert.equal(Object.keys(api.readState().placements.DUMBBELLS).length, 0, "wrong placement must not advance");
  for (const [item, target] of [
    ["PAIR_8", "RACK_8"], ["PAIR_12", "RACK_12"], ["PAIR_16", "RACK_16"]
  ]) {
    api.setSelection(item); api.placeSelected("DUMBBELLS", target);
  }
  assert.equal(api.readState().stageIndex, 1);

  api.setSelection("DISK_5_A"); api.placeSelected("BARBELL", "LEFT");
  api.setSelection("DISK_5_B"); api.placeSelected("BARBELL", "LEFT");
  assert.equal(Object.keys(api.readState().placements.BARBELL).length, 1, "duplicate weight on same side rejected");
  for (const [item, side] of [
    ["DISK_5_B", "RIGHT"], ["DISK_10_A", "LEFT"], ["DISK_10_B", "RIGHT"]
  ]) {
    api.setSelection(item); api.placeSelected("BARBELL", side);
  }
  assert.equal(api.readState().stageIndex, 2);

  const selectBench = label => {
    const button = app.get("targets").children.find(child => child.textContent === label);
    assert.ok(button, `bench action available: ${label}`);
    button.click();
  };
  selectBench("До использования убедиться в фиксации и устойчивости");
  assert.equal(api.readState().benchChecks.length, 0, "out-of-order bench check rejected");
  for (const label of [
    "Убедиться, что скамья свободна",
    "Убедиться, что на скамье нет нагрузки",
    "Найти инструкцию или маркировку модели",
    "При неуверенности обратиться к тренеру",
    "Не применять силу к незнакомому механизму",
    "До использования убедиться в фиксации и устойчивости"
  ]) selectBench(label);
  assert.equal(api.readState().stageIndex, 3);

  for (const [item, zone] of [
    ["MAT_1", "MATS"], ["BAND_1", "BANDS"],
    ["BLOCK_1", "BLOCKS"], ["ROLLER_1", "ROLLERS"],
    ["MAT_2", "MATS"], ["BAND_2", "BANDS"],
    ["BLOCK_2", "BLOCKS"], ["ROLLER_2", "ROLLERS"]
  ]) {
    api.setSelection(item); api.placeSelected("INVENTORY", zone);
  }
  const finished = api.readState();
  assert.equal(finished.done, true);
  assert.equal(finished.events.filter(event => event.eventType === "game_stage_completed").length, 4);
  assert.equal(finished.events.filter(event => event.eventType === "game_session_completed").length, 1);
  assert.equal(boot(app.storage).api.readState().done, true, "state survives browser reload");
});

test("new onboarding starts without inheriting old station progress", () => {
  const app = boot();
  app.api.start();
  app.api.setSelection("PAIR_8");
  app.api.placeSelected("DUMBBELLS", "RACK_8");
  assert.equal(Object.keys(app.api.readState().placements.DUMBBELLS).length, 1);
  const anotherSession = boot(new Map());
  assert.equal(Object.keys(anotherSession.api.readState().placements.DUMBBELLS).length, 0);
});
