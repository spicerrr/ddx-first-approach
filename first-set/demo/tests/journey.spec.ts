import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { activate, begin, benchControls, button, dragProp, dropTarget, moveBenchPart, noOverflow, placements, prop } from "./controls";

const oldStorageKey = "first-approach-interactive-v3";
const score = (page: Page, done: number, all: number) => page.getByLabel("Выполнено " + done + " из " + all, { exact: true });
const weight = (page: Page) => page.locator("[data-current-weight]");

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(name + ".png"), fullPage: true, animations: "disabled" });
}

test("четыре станции, перетаскивание снарядов и замки", async ({ page, isMobile }, info) => {
  test.setTimeout(65_000);
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
  await expect(prop(page, "DB_16_A").locator("img")).toHaveAttribute("src", /dumbbell-16\.png$/);
  await capture(page, info, "03-dumbbells");

  await move(placements.dumbbells[0]);
  await expect(itemsOnFloor).toHaveCount(5);
  await expect(prop(page, "DB_8_A")).toHaveAttribute("data-location", "RACK_LEFT");
  await move(["DB_12_A", "RACK_LEFT"]);
  await expect(status).toContainText("гантель 8 кг");
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

  await move(placements.barbell[0]);
  await move(["DISK_5_A", "RIGHT"]);
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
  await move(["DISK_10_A", "FLOOR"]);
  await expect(status).toContainText("сдвинь замок");
  await expect(weight(page)).toHaveText("80 кг");
  await move(["LOCK_A", "FLOOR"]);
  await expect(prop(page, "LOCK_A")).toHaveAttribute("data-location", "FLOOR");
  for (const pair of placements.barbell.slice(2)) await move(pair);
  await expect(page.getByText("Замки 2/2")).toBeVisible();
  const recorded = await page.evaluate(() => (window as Window & { __scenePulses?: number[] }).__scenePulses);
  expect(recorded).toEqual(expect.arrayContaining([8, 18, 28]));
  await capture(page, info, "06-barbell-locked");
  await press("Проверить");

  await expect(page.getByRole("dialog", { name: "Штанга собрана" })).toBeVisible();
  await press("Следующая станция");
  await expect(page.locator(".bench-view")).toHaveAttribute("data-model", "ready");
  await capture(page, info, "07-bench");
  await press("Сразу изменить наклон");
  await expect(page.locator(".bench-feedback")).toContainText("освободи скамью");
  await expect(score(page, 0, 4)).toBeVisible();
  await press("Убрать гантель");
  await press("Цилиндрическая ручка");
  await expect(page.locator(".bench-feedback")).toContainText("перемещать скамью");
  await press("Жёлтый штифт");
  await moveBenchPart(page, benchControls[0], isMobile, -18);
  await expect(button(page, benchControls[0])).toBeVisible();
  for (const control of benchControls.slice(0, 3)) await moveBenchPart(page, control, isMobile);
  await expect(score(page, 2, 4)).toBeVisible();
  await press("П-образный рычаг");
  for (const control of benchControls.slice(3)) await moveBenchPart(page, control, isMobile);
  await expect(score(page, 3, 4)).toBeVisible();
  await expect(page.locator(".bench-feedback")).toHaveText("Фиксация сиденья проверена.");
  await press("Проверить устойчивость");

  await expect(page.getByRole("heading", { name: "Скамья готова" })).toBeVisible();
  await press("Следующая станция");
  await capture(page, info, "08-inventory");
  await move(["MAT_1", "BANDS"]);
  await expect(status).toContainText("Стойка ковриков");
  for (const pair of placements.inventory) await move(pair);

  await expect(page.getByRole("dialog", { name: "Проход свободен" })).toBeVisible();
  await press("К результату");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("завершён");
  await capture(page, info, "09-finish");
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
  await expect(prop(page, "DB_8_A")).toHaveAttribute("data-location", "RACK_LEFT");
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
  await expect(dropTarget(page, "RACK_LEFT")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(prop(page, "DB_8_A")).toHaveAttribute("data-location", "RACK_LEFT");
  await prop(page, "DB_12_A").press("Enter");
  await page.keyboard.press("Tab");
  await expect(dropTarget(page, "RACK_MIDDLE")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(prop(page, "DB_12_A")).toHaveAttribute("data-location", "RACK_MIDDLE");
  await dragProp(page, placements.dumbbells[1], isMobile);
  await expect(score(page, 1, 3)).toBeVisible();
});
