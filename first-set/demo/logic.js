// Browser-only interaction prototype. Not a client of the proposed Game API.
const STORAGE_KEY = "first-approach-interactive-v2";
const stageOrder = ["DUMBBELLS", "BARBELL", "BENCH", "INVENTORY"];
const station = {
  DUMBBELLS: {
    number: "01", name: "Гантели", headline: "Верни пары на стойку",
    intro: "Выбери пару гантелей, затем ячейку с соответствующей маркировкой.",
    lesson: "Гантели после подхода возвращают в предназначенные ячейки. Так проходы остаются свободными, а инвентарь доступен другим.",
    items: [
      { id: "PAIR_8", label: "Пара · 8 кг", target: "RACK_8" },
      { id: "PAIR_12", label: "Пара · 12 кг", target: "RACK_12" },
      { id: "PAIR_16", label: "Пара · 16 кг", target: "RACK_16" }
    ],
    targets: [
      { id: "RACK_8", label: "Ячейка 8 кг" },
      { id: "RACK_12", label: "Ячейка 12 кг" },
      { id: "RACK_16", label: "Ячейка 16 кг" }
    ]
  },
  BARBELL: {
    number: "02", name: "Штанга", headline: "Собери симметрично",
    intro: "Размести четыре виртуальных диска: по 5 и 10 кг с каждой стороны. Вес здесь — условие задачи, не рекомендация нагрузки.",
    lesson: "Обе стороны виртуального грифа должны быть уравновешены. Крепления и реальную подготовку штанги необходимо изучать с тренером.",
    items: [
      { id: "DISK_5_A", label: "Диск А · 5 кг", weight: 5 },
      { id: "DISK_5_B", label: "Диск Б · 5 кг", weight: 5 },
      { id: "DISK_10_A", label: "Диск В · 10 кг", weight: 10 },
      { id: "DISK_10_B", label: "Диск Г · 10 кг", weight: 10 }
    ],
    targets: [{ id: "LEFT", label: "Левая сторона" }, { id: "RIGHT", label: "Правая сторона" }]
  },
  BENCH: {
    number: "03", name: "Скамья", headline: "Проверь перед использованием",
    intro: "Это симуляция логических проверок. Выбирай следующий уместный шаг; не пытайся повторять её как инструкцию для незнакомой модели скамьи.",
    lesson: "Механизмы регулировки отличаются. Не применяй силу к незнакомому фиксатору и попроси тренера показать устройство конкретной скамьи.",
    steps: [
      { id: "AREA_CLEAR", label: "Убедиться, что скамья свободна" },
      { id: "UNLOADED", label: "Убедиться, что на скамье нет нагрузки" },
      { id: "MODEL_GUIDANCE", label: "Найти инструкцию или маркировку модели" },
      { id: "ASK_TRAINER_IF_UNSURE", label: "При неуверенности обратиться к тренеру" },
      { id: "NO_FORCE", label: "Не применять силу к незнакомому механизму" },
      { id: "VERIFY_LOCK", label: "До использования убедиться в фиксации и устойчивости" }
    ],
    displayedOrder: ["VERIFY_LOCK", "MODEL_GUIDANCE", "NO_FORCE", "AREA_CLEAR", "ASK_TRAINER_IF_UNSURE", "UNLOADED"]
  },
  INVENTORY: {
    number: "04", name: "Инвентарь", headline: "Освободи тренировочную зону",
    intro: "Выбери предмет и подходящую зону хранения. В этой модели расположение зон условное.",
    lesson: "Возвращай принадлежности туда, где они хранятся в конкретном клубе, и не загромождай проходы.",
    items: [
      { id: "MAT_1", label: "Коврик 01", target: "MATS" },
      { id: "BAND_1", label: "Резинка 01", target: "BANDS" },
      { id: "BLOCK_1", label: "Йога-блок 01", target: "BLOCKS" },
      { id: "ROLLER_1", label: "МФР-ролл 01", target: "ROLLERS" },
      { id: "MAT_2", label: "Коврик 02", target: "MATS" },
      { id: "BAND_2", label: "Резинка 02", target: "BANDS" },
      { id: "BLOCK_2", label: "Йога-блок 02", target: "BLOCKS" },
      { id: "ROLLER_2", label: "МФР-ролл 02", target: "ROLLERS" }
    ],
    targets: [
      { id: "MATS", label: "Стойка ковриков" },
      { id: "BANDS", label: "Зона резинок" },
      { id: "BLOCKS", label: "Йога-блоки" },
      { id: "ROLLERS", label: "МФР-роллы" }
    ]
  }
};

function initialState() {
  return {
    started: false, stageIndex: 0, done: false,
    placements: { DUMBBELLS: {}, BARBELL: {}, INVENTORY: {} },
    benchChecks: [], events: []
  };
}
function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!value || !value.placements || !Array.isArray(value.benchChecks)
        || !Number.isInteger(value.stageIndex) || value.stageIndex < 0 || value.stageIndex > 4) return initialState();
    return value;
  } catch { return initialState(); }
}
let state = readState();
let selectedItemId = null;
let feedback = "";
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function logEvent(eventType, detail = {}) {
  state.events.push({ eventType, occurredAt: new Date().toISOString(), ...detail });
  save();
}
function button(label, onClick, className = "btn", disabled = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener("click", onClick);
  return element;
}
function screen(html) {
  $("screen").innerHTML = html;
  const title = $("screen").querySelector("h1, h2");
  if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
}
function progress(key) {
  return key === "BENCH" ? state.benchChecks.length : Object.keys(state.placements[key] || {}).length;
}
function total(key) {
  return key === "BENCH" ? station[key].steps.length : station[key].items.length;
}
function doneActions() {
  return stageOrder.reduce((sum, key, i) => sum + (i < state.stageIndex ? total(key) : i === state.stageIndex ? progress(key) : 0), 0);
}
function start() {
  if (state.done) state = initialState();
  if (!state.started) {
    state.started = true;
    logEvent("game_session_started");
  }
  feedback = "";
  selectedItemId = null;
  renderStage();
}
function restart() {
  state = initialState();
  save();
  start();
}
function renderWelcome() {
  const action = state.done ? "Открыть результат" : state.started ? "Продолжить" : "Начать знакомство";
  screen(`<section class="welcome">
      <p class="eyebrow">Интерактивный онбординг / 4 станции</p>
      <h1 class="hero">ПЕРВЫЙ <em>ПОДХОД</em></h1>
      <p class="lead">Короткая симуляция о порядке в зале, обращении с инвентарём и ситуациях, когда лучше обратиться к тренеру.</p>
      <p class="support">Игра не заменяет ознакомительную тренировку и не обучает работе с конкретным оборудованием.</p>
      <div class="actions" id="welcomeActions"></div>
      <p class="small">Неофициальный прототип. Данные сохраняются только в этом браузере. Никакие сервисы DDX не вызываются.</p>
    </section>`);
  $("welcomeActions").append(button(action, state.done ? renderFinish : start, "btn primary"));
  if (state.started || state.done) $("welcomeActions").append(button("Начать заново", restart, "btn ghost"));
}
function renderStage() {
  if (state.done) return renderFinish();
  const key = stageOrder[state.stageIndex];
  const config = station[key];
  const grandTotal = stageOrder.reduce((sum, id) => sum + total(id), 0);
  const pct = Math.round(doneActions() / grandTotal * 100);
  screen(`<section class="game">
    <div class="stage-head"><div><p class="eyebrow">Станция ${config.number} / 04 · ${escapeHtml(config.name)}</p>
      <h1 class="station-title">${escapeHtml(config.headline)}</h1></div>
      <span class="completion">${pct}% · ${progress(key)} из ${total(key)}</span></div>
    <div class="meter" aria-label="Прогресс игры"><span style="width:${pct}%"></span></div>
    <p class="instruction">${escapeHtml(config.intro)}</p>
    <div class="activity-grid"><section class="work-area"><h2>01 / Предметы и действия</h2><div id="items" class="items"></div></section>
      <section class="work-area targets"><h2>02 / Размещение</h2><div id="targets" class="zones"></div><div id="feedback" role="status" aria-live="polite" class="feedback">${escapeHtml(feedback)}</div></section></div>
    <div class="bottom-actions" id="stageActions"></div>
  </section>`);
  if (key === "BENCH") renderBench();
  else renderPlacements(key);
  $("stageActions").append(button("На главный экран", renderWelcome, "btn ghost"));
}
function renderPlacements(key) {
  const config = station[key];
  const placements = state.placements[key];
  const items = $("items");
  const zones = $("targets");
  config.items.forEach(item => {
    const placed = Object.hasOwn(placements, item.id);
    const selected = selectedItemId === item.id;
    const choice = button(`${placed ? "✓ " : ""}${item.label}`,
      () => { selectedItemId = item.id; feedback = ""; renderStage(); $("targets").querySelector("button:not(:disabled)")?.focus(); },
      `object-btn${selected ? " selected" : ""}${placed ? " placed" : ""}`, placed);
    choice.setAttribute("aria-pressed", String(selected));
    items.append(choice);
  });
  if (key === "BARBELL") {
    const totalFor = side => config.items.reduce((n, item) => n + (placements[item.id] === side ? item.weight : 0), 0);
    const left = totalFor("LEFT"), right = totalFor("RIGHT");
    zones.insertAdjacentHTML("beforeend", `<div class="balance" aria-live="polite"><div>Слева <strong>${left} кг</strong></div><div class="bar-symbol">━━━━</div><div>Справа <strong>${right} кг</strong></div></div>`);
  }
  config.targets.forEach(target => {
    const count = Object.values(placements).filter(value => value === target.id).length;
    const choice = button(`${target.label} · размещено: ${count}`,
      () => placeSelected(key, target.id), "zone-btn", !selectedItemId);
    zones.append(choice);
  });
}
function placeSelected(key, targetId) {
  const config = station[key];
  const item = config.items.find(element => element.id === selectedItemId);
  if (!item) return;
  if (key === "BARBELL") {
    const alreadySame = config.items.some(other =>
      other.id !== item.id && other.weight === item.weight
      && state.placements.BARBELL[other.id] === targetId);
    if (alreadySame) {
      feedback = "На этой стороне уже есть диск такого веса. Распредели одинаковые диски по разным сторонам.";
      renderStage(); return;
    }
  } else if (item.target !== targetId) {
    const target = config.targets.find(element => element.id === item.target);
    feedback = `Это не подходящая зона. Для «${item.label}» найдена маркировка «${target.label}».`;
    renderStage(); return;
  }
  state.placements[key][item.id] = targetId;
  selectedItemId = null;
  feedback = "Предмет размещён. Выбери следующий.";
  save();
  if (progress(key) === total(key)) return completeStage();
  renderStage();
  $("items").querySelector("button:not(:disabled)")?.focus();
}
function renderBench() {
  const all = station.BENCH.steps;
  const remaining = station.BENCH.displayedOrder.filter(id => !state.benchChecks.includes(id));
  const next = all[state.benchChecks.length];
  const items = $("items"), zones = $("targets");
  items.insertAdjacentHTML("beforeend", `<p class="object-hint">Проверено: ${state.benchChecks.length} из 6</p>`);
  const checked = document.createElement("ol");
  checked.className = "checked-list";
  state.benchChecks.forEach(id => {
    const row = document.createElement("li");
    row.textContent = all.find(step => step.id === id).label;
    checked.append(row);
  });
  items.append(checked);
  zones.insertAdjacentHTML("beforeend", '<p class="object-hint">Выбери следующий шаг из оставшихся.</p>');
  remaining.forEach(id => {
    const step = all.find(item => item.id === id);
    zones.append(button(step.label, () => {
      if (id !== next.id) {
        feedback = `Следующий шаг пока не выполнен. Сначала: «${next.label}».`;
        renderStage(); return;
      }
      state.benchChecks.push(id);
      feedback = "Проверка отмечена.";
      save();
      if (progress("BENCH") === total("BENCH")) return completeStage();
      renderStage();
      $("targets").querySelector("button")?.focus();
    }, "zone-btn"));
  });
}
function completeStage() {
  const key = stageOrder[state.stageIndex];
  logEvent("game_stage_completed", { stage: key });
  state.stageIndex++;
  if (state.stageIndex === stageOrder.length) {
    state.done = true;
    logEvent("game_session_completed");
  }
  save();
  feedback = "";
  selectedItemId = null;
  renderLesson(key);
}
function renderLesson(key) {
  const config = station[key];
  const last = state.done;
  screen(`<section class="communication"><p class="eyebrow">Станция ${config.number} пройдена</p>
      <h1>${last ? "ЧЕТЫРЕ ИЗ ЧЕТЫРЁХ." : "СТАНЦИЯ ПРОЙДЕНА."}</h1>
      <p>${escapeHtml(config.lesson)}</p><div id="lessonActions" class="actions"></div></section>`);
  $("lessonActions").append(button(last ? "К результату" : "Следующая станция",
    last ? renderFinish : renderStage, "btn dark"));
}
function renderFinish() {
  screen(`<section class="finish"><p class="eyebrow">Результат / 4 станции</p>
      <h1 class="hero">МОЖНО <em>В ЗАЛ.</em></h1>
      <p class="lead">Ты прошёл(ла) симуляцию базовых ситуаций. Это знакомство с правилами, не проверка практических навыков.</p>
      <div class="takeaways"><div>01 · Возвращай инвентарь в предназначенные зоны.</div>
      <div>02 · Не используй незнакомые механизмы наугад.</div>
      <div>03 · Уточняй регулировки и технику у тренера.</div>
      <div>04 · Smart Start и ознакомительная тренировка доступны в DDX.</div></div>
      <div class="actions" id="resultActions"></div>
      <p class="small">Следующие кнопки демонстрируют навигацию. Реальная запись и проверка прав не выполняются.</p></section>`);
  $("resultActions").append(
    button("Smart Start", () => renderCTA("Smart Start"), "btn primary"),
    button("Ознакомительная тренировка", () => renderCTA("Ознакомительная тренировка")),
    button("Пройти ещё раз", restart, "btn ghost")
  );
}
function renderCTA(destination) {
  logEvent("intro_cta_clicked", { destination, source: "demo_only" });
  screen(`<section class="communication"><p class="eyebrow">Демонстрационная навигация</p>
      <h1>${escapeHtml(destination).toUpperCase()}</h1>
      <p>В действующем приложении здесь должен открываться существующий сценарий записи с условиями и свободными местами. Этот прототип не создаёт бронирование и не проверяет доступность занятия.</p>
      <div id="ctaActions" class="actions"></div></section>`);
  $("ctaActions").append(button("К результату", renderFinish, "btn dark"));
}
renderWelcome();
