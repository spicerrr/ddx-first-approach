import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { activate, benchControls, button, moveBenchPart, noOverflow, placements, put } from "./controls";

const key = "first-approach-interactive-v3";
const saved = (page: Page) => page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!), key);
const score = (page: Page, done: number, all: number) => page.getByLabel(`Выполнено ${done} из ${all}`, { exact: true });

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: "disabled" });
}

test("23 действия, регулировка скамьи, ошибки и восстановление", async ({ page, isMobile }, info) => {
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
  await capture(page, info, "02-dumbbells");

  await move(placements.dumbbells[0]);
  await move(["Пара · 12 кг", "Ячейка 16 кг"]);
  await expect(status).toContainText("Ячейка 12 кг");
  await expect(score(page, 1, 3)).toBeVisible();
  await capture(page, info, "03-error");
  await press("Выйти");
  await press("Продолжить");
  await expect(button(page, "Пара · 8 кг")).toBeDisabled();
  await page.reload();
  await press("Продолжить");
  await expect(button(page, "Пара · 8 кг")).toBeDisabled();
  await press("Smart Start");
  await press("Назад");
  await expect(score(page, 1, 3)).toBeVisible();
  await move(placements.dumbbells[1]);
  await move(placements.dumbbells[2]);

  await expect(page.getByRole("heading", { name: "Гантели на месте" })).toBeVisible();
  await capture(page, info, "04-red-lesson");
  await page.reload();
  await press("Продолжить");
  await press("Следующая станция");
  await capture(page, info, "05-barbell");
  await move(placements.barbell[0]);
  await move(["Диск Б · 5 кг", "Левая сторона"]);
  await expect(status).toContainText("с другой стороны");
  await press("Правая сторона");
  await move(placements.barbell[2]);
  await expect(button(page, "Левая сторона")).toContainText("15");
  await expect(button(page, "Правая сторона")).toContainText("5");
  await move(placements.barbell[3]);

  await expect(page.getByRole("heading", { name: "Диски по обе стороны" })).toBeVisible();
  await press("Следующая станция");
  await expect(page.locator(".bench-view")).toHaveAttribute("data-model", "ready");
  await capture(page, info, "06-bench");
  await press("Шаг 6: Фиксация и устойчивость");
  await expect(page.locator(".bench-feedback")).toContainText("Сначала");
  await expect(score(page, 0, 8)).toBeVisible();
  await press("Отметить проверку");
  await expect(button(page, "Шаг 1: Свободная скамья (выполнен)")).toBeDisabled();
  for (let i = 1; i < 5; i += 1) await press("Отметить проверку");
  await moveBenchPart(page, benchControls[0], isMobile, -18);
  await expect(button(page, benchControls[0])).toBeVisible();
  for (const control of benchControls.slice(0, 3)) await moveBenchPart(page, control, isMobile);
  await expect(score(page, 6, 8)).toBeVisible();
  await page.reload();
  await press("Продолжить");
  await expect(score(page, 6, 8)).toBeVisible();
  for (const control of benchControls.slice(3)) await moveBenchPart(page, control, isMobile);
  await expect(score(page, 7, 8)).toBeVisible();
  await expect(page.locator(".bench-feedback")).toHaveText("Фиксация сиденья проверена.");
  await button(page, "Отметить проверку").scrollIntoViewIfNeeded();
  await press("Отметить проверку");

  await expect(page.getByRole("heading", { name: "Скамья готова" })).toBeVisible();
  await press("Следующая станция");
  await capture(page, info, "07-inventory");
  await move(["Коврик 01", "Зона резинок"]);
  await expect(status).toContainText("Стойка ковриков");
  await press("Стойка ковриков");
  for (const pair of placements.inventory.slice(1)) await move(pair);

  await expect(page.getByRole("heading", { name: "Зона свободна" })).toBeVisible();
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
  await expect(score(page, 0, 3)).toBeVisible();
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
  await button(page, "Пара · 8 кг").press("Enter");
  await expect(button(page, "Ячейка 8 кг")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(score(page, 1, 3)).toBeVisible();

  const source = await button(page, "Пара · 12 кг").boundingBox();
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
  await expect(score(page, 2, 3)).toBeVisible();
  await put(page, placements.dumbbells[2], isMobile);
  await expect(button(page, "Следующая станция")).toBeVisible();
});
