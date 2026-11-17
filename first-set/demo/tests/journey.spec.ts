import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { activate, adjustBench, begin, button, dragProp, dropTarget, noOverflow, openBench, placements, prop } from "./controls";

const oldStorageKey = "first-approach-interactive-v3";
const score = (page: Page, done: number, all: number) => page.getByLabel("Выполнено " + done + " из " + all, { exact: true });
const weight = (page: Page) => page.locator("[data-current-weight]");

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(name + ".png"), fullPage: true, animations: "disabled" });
}

test("четыре станции, перетаскивание снарядов и замки", async ({ page, isMobile }, info) => {
  test.setTimeout(80_000);
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (entry) => { if (entry.type() === "error") problems.push(entry.text()); });
  page.on("response", (response) => { if (response.status() >= 400) problems.push(response.status() + " " + response.url()); });
  page.on("requestfailed", (request) => problems.push(request.failure()?.errorText + " " + request.url()));
  await page.addInitScript(() => {
    const pulses: (number | number[])[] = [];
    Object.defineProperty(window, "__scenePulses", { value: pulses });
    Object.defineProperty(navigator, "vibrate", { value: (pattern: number | number[]) => { pulses.push(pattern); return true; } });
  });
  const press = (name: string) => activate(page, name, isMobile);
  const move = (pair: readonly [string, string]) => dragProp(page, pair, isMobile);
  const status = page.locator(".scene-response");
  const itemsOnFloor = page.locator(".gym-floor [data-location='FLOOR']");

  await page.goto("");
  await expect(button(page, "Начать знакомство")).toBeVisible();
  const clubNavigation = page.getByRole("navigation", { name: "Разделы DDX Fitness" });
  await expect(clubNavigation.getByRole("button", { name: "Главная" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#club-approach").getByRole("button", { name: "Начать знакомство" })).toHaveCSS("background-color", "rgb(255, 106, 77)");
  await capture(page, info, "01-home");
  await press("Календарь");
  await expect(page.getByRole("heading", { name: "Мой календарь", level: 1 })).toBeVisible();
  await press("Action");
  await press("Начать знакомство");
  await press("Выйти");
  await expect(page.getByRole("heading", { name: "Action", level: 1 })).toBeVisible();
  await press("Главная");
  await press("Smart Start");
  await expect(page.getByRole("heading", { name: "Smart Start", exact: true })).toBeVisible();
  await press("Назад");
  await press("Начать знакомство");
  await expect(page.getByRole("heading", { name: "Привет!" })).toBeVisible();
  await capture(page, info, "02-coach");
  await press("К маршруту");
  await expect(page.getByRole("heading", { name: "Твой маршрут" })).toBeVisible();
  await press("Начать маршрут");
  await expect(itemsOnFloor).toHaveCount(6);
  await expect(page.locator('.rack-pair[data-shelf="1"]')).toHaveCount(4);
  await expect(page.locator('.rack-pair[data-shelf="2"]')).toHaveCount(4);
  await expect(page.locator('.rack-pair[data-weight="12"]')).toHaveAttribute("data-first-slot", "3");
  await expect(page.locator('.rack-pair[data-weight="16"]')).toHaveAttribute("data-first-slot", "7");
  await expect(prop(page, "DB_16_A").locator("img")).toHaveAttribute("src", /dumbbell-16\.png$/);
  await capture(page, info, "03-dumbbells");

  await move(placements.dumbbells[0]);
  await expect(itemsOnFloor).toHaveCount(5);
  await expect(prop(page, "DB_8_A")).toHaveAttribute("data-location", "RACK_8");
  await move(["DB_12_A", "RACK_8"]);
  await expect(status).toContainText("пары 8 кг");
  await expect(score(page, 0, 3)).toBeVisible();
  await press("Smart Start");
  await press("Назад");
  await expect(itemsOnFloor).toHaveCount(5);
  for (const pair of placements.dumbbells.slice(1)) await move(pair);

  await expect(page.getByRole("dialog", { name: "Гантели на месте" })).toBeVisible();
  await capture(page, info, "04-station-result");
  await press("Следующая станция");
  await expect(weight(page)).toHaveText("60 кг");
  await page.mouse.move(1, 1);
  await expect(button(page, "Проверить")).toHaveCSS("background-color", "rgb(255, 106, 77)");
  await expect(page.getByRole("button", { name: /^Диск \d/ })).toHaveCount(0);
  await capture(page, info, "05-barbell");
  await move(["DISK_20_B", "FLOOR"]);
  await expect(weight(page)).toHaveText("40 кг");
  await move(["DISK_20_B", "RIGHT"]);
  await expect(weight(page)).toHaveText("60 кг");
  await expect(prop(page, "DISK_20_B").locator(".mounted-art")).toHaveAttribute("src", /bar-disk-20\.webp$/);
  const pulses = () => page.evaluate(() => (window as Window & { __scenePulses?: (number | number[])[] }).__scenePulses);
  await expect.poll(pulses).toEqual(expect.arrayContaining([[40, 16, 22]]));

  await move(placements.barbell[0]);
  await expect.poll(pulses).toEqual(expect.arrayContaining([13]));
  const beforeLightDisk = await pulses();
  await move(["DISK_5_A", "RIGHT"]);
  await expect(prop(page, "DISK_5_A")).toHaveAttribute("data-location", "RIGHT");
  await expect(prop(page, "DISK_5_A")).not.toHaveAttribute("data-landed", "true");
  expect(await pulses()).toEqual(beforeLightDisk);
  await press("Проверить");
  await expect(status).toContainText("не хватает 5 кг");
  await expect(weight(page)).toHaveText("75 кг");
  await press("Маршрут");
  await expect(page.locator(".route-stations li").first()).toContainText("Пройдено");
  await press("Вернуться к заданию");
  await expect(weight(page)).toHaveText("75 кг");
  await move(["DISK_5_A", "FLOOR"]);
  await expect(prop(page, "DISK_5_A")).toHaveAttribute("data-location", "FLOOR");
  await expect(weight(page)).toHaveText("70 кг");
  await move(placements.barbell[1]);
  await expect(weight(page)).toHaveText("80 кг");
  await press("Проверить");
  await expect(status).toContainText("по замку");
  await move(placements.barbell[2]);

  await page.evaluate(() => {
    const log: unknown[] = [];
    (window as Window & {motionTrace?: unknown[]}).motionTrace = log;
    for (const name of ["pointerdown", "pointermove", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture", "touchstart", "touchend", "click", "scroll"]) {
      document.addEventListener(name, (event) => {
        const target = event.target;
        const el = target instanceof HTMLElement ? target : target instanceof Element ? target.parentElement : undefined;
        const item = el?.closest<HTMLElement>("[data-scene-item]");
        const hit = el?.closest<HTMLElement>("button");
        const p = event as PointerEvent;
        log.push([name, item?.dataset.sceneItem, hit?.getAttribute("aria-label"), el?.className, p.isPrimary, p.button, p.pointerId, p.clientX, p.clientY, window.scrollY, performance.now().toFixed(0)]);
      }, true);
    }
  });
  await press("Защёлкнуть левый замок");
  await expect(prop(page, "LOCK_A").locator(".clamp-sprite")).toHaveAttribute("data-closed", "true");
  await move(["LOCK_A", "FLOOR"]);

  console.log("TOUCH TRACE", JSON.stringify(await page.evaluate(() => (window as Window & {motionTrace?: unknown[]}).motionTrace)));
  await expect(status).toContainText("Открой защёлку");
  await expect(weight(page)).toHaveText("80 кг");
  await press("Открыть левый замок");
  await move(["LOCK_A", "FLOOR"]);
  await expect(prop(page, "LOCK_A")).toHaveAttribute("data-location", "FLOOR");
  for (const pair of placements.barbell.slice(2)) await move(pair);
  await press("Проверить");
  await expect(status).toContainText("защёлкнуть");
  await press("Защёлкнуть левый замок");
  await press("Защёлкнуть правый замок");
  await expect(page.getByText("Защёлкнуто 2/2")).toBeVisible();
  await capture(page, info, "06-barbell-locked");
  await press("Проверить");

  await expect(page.getByRole("dialog", { name: "Штанга собрана" })).toBeVisible();
  await press("Следующая станция");
  await expect(page.locator(".bench-demo-visual img")).toHaveAttribute("src", /bench-backrest\.gif$/);
  await capture(page, info, "07a-bench-demo");
  await openBench(page, isMobile);
  await expect(score(page, 0, 2)).toBeVisible();
  await expect(button(page, "Следующая станция")).toHaveCount(0);
  await adjustBench(page, isMobile, false);
  await expect(page.locator(".bench-angle strong")).toHaveText("0°");
  await expect(score(page, 0, 2)).toBeVisible();
  await adjustBench(page, isMobile, true);
  await expect(score(page, 1, 2)).toBeVisible();
  await expect(page.locator(".bench-angle strong")).not.toHaveText("0°");
  await expect(page.locator(".bench-view")).not.toHaveAttribute("data-unlocked", "true");
  await press("Сиденье");
  await adjustBench(page, isMobile, true);
  await expect(score(page, 2, 2)).toBeVisible();
  await expect(page.locator(".bench-practice")).toHaveAttribute("data-sandbox", "true");
  await expect(page.getByRole("img", { name: "Обе подушки отрегулированы" })).toBeVisible();
  await capture(page, info, "07b-bench-practice");
  await press("Спинка");
  await adjustBench(page, isMobile, true, -61);
  await expect(page.locator(".bench-angle strong")).toHaveText("0°");
  await expect(page.locator(".bench-practice")).toHaveAttribute("data-sandbox", "true");
  await press("Следующая станция");
  await capture(page, info, "08-inventory");
  await move(["MAT_1", "BANDS"]);
  await expect(status).toContainText("Стойка ковриков");
  for (const pair of placements.inventory) await move(pair);

  await expect(page.getByRole("dialog", { name: "Проход свободен" })).toBeVisible();
  await press("К результату");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("завершён");
  await expect(page.locator(".finish-confetti .confetti-piece")).toHaveCount(54);
  await expect(page.locator(".finish-confetti .confetti-piece").first()).toHaveCSS("animation-name", "confetti-fall");
  await page.screenshot({ path: info.outputPath("09-finish.png"), animations: "allow" });
  await press("Ознакомительная тренировка");
  await expect(page.getByRole("link").first()).toHaveAttribute("href", "https://www.ddxfitness.ru/group-training/3076/");
  await press("Назад");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("завершён");
  await expect(button(page, "Пройти ещё раз")).toHaveCount(0);
  await noOverflow(page);
  expect(problems).toEqual([]);
});

test("выход и перезагрузка открывают чистый маршрут", async ({ page, isMobile }) => {
  await page.goto("");
  await page.evaluate((key) => localStorage.setItem(key, '{"previous":"cycle"}'), oldStorageKey);
  await begin(page, isMobile);
  await dragProp(page, placements.dumbbells[0], isMobile);
  await expect(prop(page, "DB_8_A")).toHaveAttribute("data-location", "RACK_8");
  await activate(page, "Выйти", isMobile);
  await begin(page, isMobile);
  await expect(page.locator(".gym-floor [data-location='FLOOR']")).toHaveCount(6);
  await dragProp(page, placements.dumbbells[0], isMobile);
  await page.reload();
  await expect(button(page, "Продолжить")).toHaveCount(0);
  await activate(page, "Начать знакомство", isMobile);
  await activate(page, "Пропустить", isMobile);
  await activate(page, "Узнать о Smart Start", isMobile);
  await expect(page.getByRole("link").first()).toHaveAttribute("href", "https://www.ddxfitness.ru/smart-start/");
  await activate(page, "Назад", isMobile);
  await activate(page, "На главный экран", isMobile);
  await begin(page, isMobile);
  await expect(page.locator(".gym-floor [data-location='FLOOR']")).toHaveCount(6);
  expect(await page.evaluate((key) => localStorage.getItem(key), oldStorageKey)).toBe('{"previous":"cycle"}');
});

test("клавиатура поднимает снаряд и ставит его в выбранное место", async ({ page, isMobile }) => {
  await page.goto("");
  await begin(page, isMobile);
  await prop(page, "DB_8_A").press("Space");
  await expect(dropTarget(page, "RACK_8")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(prop(page, "DB_8_A")).toHaveAttribute("data-location", "RACK_8");
  await prop(page, "DB_12_A").press("Enter");
  await page.keyboard.press("Tab");
  await expect(dropTarget(page, "RACK_12")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(prop(page, "DB_12_A")).toHaveAttribute("data-location", "RACK_12");
  await dragProp(page, placements.dumbbells[1], isMobile);
  await expect(score(page, 1, 3)).toBeVisible();
});
