import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { activate, benchControls, button, moveBenchPart, noOverflow, placements, put } from "./controls";

const key = "first-approach-interactive-v3";
const saved = (page: Page) => page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!), key);
const score = (page: Page, done: number, all: number) => page.getByLabel(`Выполнено ${done} из ${all}`, { exact: true });

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: "disabled" });
}

test("маршрут, решения четырёх станций и восстановление", async ({ page, isMobile }, info) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (entry) => { if (entry.type() === "error") problems.push(entry.text()); });
  page.on("response", (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => problems.push(`${request.failure()?.errorText} ${request.url()}`));
  const press = (name: string) => activate(page, name, isMobile);
  const move = (pair: readonly [string, string]) => put(page, pair, isMobile);
  const status = page.locator(".game [role='status']");

  await page.goto("");
  await expect(button(page, "Начать знакомство")).toBeVisible();
  await capture(page, info, "01-home");
  await press("Smart Start");
  await expect(page.getByRole("heading", { name: "Smart Start", exact: true })).toBeVisible();
  expect((await saved(page)).progress.phase).toBe("ready");
  await press("Назад");
  await press("Начать знакомство");
  await expect(page.getByRole("heading", { name: "Твой маршрут" })).toBeVisible();
  await press("Начать маршрут");
  await capture(page, info, "02-dumbbells");

  await move(placements.dumbbells[0]);
  await move(["Гантель А · 12 кг", "Ячейка 16 кг"]);
  await expect(status).toContainText("Ячейка 12 кг");
  await expect(score(page, 1, 5)).toBeVisible();
  await capture(page, info, "03-error");
  await press("Выйти");
  await press("Продолжить");
  await expect(button(page, "Гантель Б · 8 кг")).toBeDisabled();
  await page.reload();
  await press("Продолжить");
  await expect(button(page, "Гантель Б · 8 кг")).toBeDisabled();
  await press("Smart Start");
  await press("Назад");
  await expect(score(page, 1, 5)).toBeVisible();
  for (const pair of placements.dumbbells.slice(1)) await move(pair);

  await expect(page.getByRole("heading", { name: "Гантели на месте" })).toBeVisible();
  await capture(page, info, "04-station-result");
  await page.reload();
  await press("Продолжить");
  await press("Следующая станция");
  await capture(page, info, "05-barbell");
  await expect(page.locator("[data-current-weight]")).toHaveText("60 кг");
  await move(placements.barbell[0]);
  await move(["Диск А · 5 кг", "Правая сторона"]);
  await press("Проверить");
  await expect(status).toContainText("не хватает 5 кг");
  await expect(page.locator("[data-current-weight]")).toHaveText("75 кг");
  await press("Маршрут");
  await expect(page.locator(".route-stations li").first()).toContainText("Пройдено");
  await press("Вернуться к заданию");
  await expect(page.locator("[data-current-weight]")).toHaveText("75 кг");
  await press("Диск А · 5 кг");
  await press("Снять выбранный диск");
  await move(placements.barbell[1]);
  await expect(page.locator("[data-current-weight]")).toHaveText("80 кг");
  await press("Проверить");

  await expect(page.getByRole("heading", { name: "Штанга собрана" })).toBeVisible();
  await press("Следующая станция");
  await expect(page.locator(".bench-view")).toHaveAttribute("data-model", "ready");
  await capture(page, info, "06-bench");
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
  await page.reload();
  await press("Продолжить");
  await expect(score(page, 2, 4)).toBeVisible();
  await press("П-образный рычаг");
  for (const control of benchControls.slice(3)) await moveBenchPart(page, control, isMobile);
  await expect(score(page, 3, 4)).toBeVisible();
  await expect(page.locator(".bench-feedback")).toHaveText("Фиксация сиденья проверена.");
  await button(page, "Проверить устойчивость").scrollIntoViewIfNeeded();
  await press("Проверить устойчивость");

  await expect(page.getByRole("heading", { name: "Скамья готова" })).toBeVisible();
  await press("Следующая станция");
  await capture(page, info, "07-inventory");
  await move(["Коврик 01", "Зона резинок"]);
  await expect(status).toContainText("Стойка ковриков");
  await press("Стойка ковриков");
  for (const pair of placements.inventory.slice(1)) await move(pair);

  await expect(page.getByRole("heading", { name: "Проход свободен" })).toBeVisible();
  await press("К результату");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("завершён");
  await capture(page, info, "08-finish");
  await press("Ознакомительная тренировка");
  await expect(page.getByRole("link").first()).toHaveAttribute("href", "https://www.ddxfitness.ru/group-training/3076/");
  await press("Назад");
  await page.reload();
  await press("Открыть результат");
  const events = (await saved(page)).progress.events;
  expect(events.filter((event: { type: string }) => event.type === "game_session_completed")).toHaveLength(1);
  expect(events.filter((event: { type: string }) => event.type === "game_stage_completed")).toHaveLength(4);
  await press("Пройти ещё раз");
  await press("Отмена");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("завершён");
  await press("Пройти ещё раз");
  await press("Начать заново");
  await expect(score(page, 0, 5)).toBeVisible();
  await noOverflow(page);
  expect(problems).toEqual([]);
});

test("пропуск и повреждённая запись не запускают игру", async ({ page, isMobile }) => {
  await page.goto("");
  await page.evaluate((k) => localStorage.setItem(k, '{"format":2}'), key);
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Старое сохранение не удалось открыть");
  await activate(page, "Пропустить", isMobile);
  await activate(page, "Узнать о Smart Start", isMobile);
  await expect(page.getByRole("link").first()).toHaveAttribute("href", "https://www.ddxfitness.ru/smart-start/");
  expect((await saved(page)).progress.events).toEqual([]);
});

test("клавиатура, перетаскивание и следующее нажатие", async ({ page, isMobile }) => {
  await page.goto("");
  await activate(page, "Начать знакомство", isMobile);
  await activate(page, "Начать маршрут", isMobile);
  await button(page, "Гантель Б · 8 кг").press("Enter");
  await expect(button(page, "Ячейка 8 кг")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(score(page, 1, 5)).toBeVisible();

  const source = await button(page, "Гантель А · 12 кг").boundingBox();
  const target = await button(page, "Ячейка 12 кг").boundingBox();
  const from = { x: source!.x + source!.width / 2, y: source!.y + source!.height / 2 };
  const to = { x: target!.x + target!.width / 2, y: target!.y + target!.height / 2 };
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let step = 1; step <= 10; step += 1) {
      const x = from.x + (to.x - from.x) * step / 10;
      const y = from.y + (to.y - from.y) * step / 10;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  }
  await expect(score(page, 2, 5)).toBeVisible();
  for (const pair of placements.dumbbells.slice(2)) await put(page, pair, isMobile);
  await expect(button(page, "Следующая станция")).toBeVisible();
});
