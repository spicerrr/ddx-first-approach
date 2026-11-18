import { test, expect, type Page } from "@playwright/test";
import { activate, adjustBenchWithMouse, begin, button, dragProp, dropTarget, keyboardBench, openBench } from "./controls";

async function resumeBench(page: Page) {
  await page.addInitScript(() => localStorage.setItem("ddx-first-approach-completed-v1", "2"));
  await page.goto("");
  await activate(page, "Открыть игру");
  await activate(page, "К станции");
}

test("подсказка при паузе запрашивается вручную, повышает уровень и сменяется результатом", async ({ page, isMobile }) => {
  const press = (name: string) => activate(page, name, isMobile);
  await page.clock.install();
  await page.goto("");
  await begin(page, isMobile);
  const coach = page.locator(".scene-response .coach-message");
  const avatar = coach.locator(".coach-avatar");
  const portrait = await avatar.locator("img").getAttribute("src");
  await expect(coach).toHaveAttribute("data-tone", "task");
  await expect(button(page, "Нужна подсказка?")).toHaveCount(0);

  await page.clock.fastForward(13_600);
  await expect(button(page, "Нужна подсказка?")).toBeVisible();
  await expect(coach).toHaveAttribute("data-tone", "task");
  await press("Нужна подсказка?");
  await expect(coach).toHaveAttribute("data-hint-level", "1");
  await expect(page.locator("[data-tip-target]")).toHaveCount(0);
  for (const level of ["2", "3"]) {
    await dragProp(page, ["DB_8_A", "RACK_12"], isMobile);
    await expect(coach).toHaveAttribute("data-hint-level", level);
  }
  await expect(dropTarget(page, "RACK_8")).toHaveAttribute("data-tip-target", "true");
  await press("Помощь");
  await press("Подсказка");
  await expect(coach).toHaveAttribute("data-hint-level", "4");
  await press("Показать приём");
  await expect(page.getByRole("dialog", { name: "Показать приём" })).toBeVisible();
  await expect(page.locator(".hint-diagram img")).toHaveCount(2);
  await press("К заданию");
  await dragProp(page, ["DB_8_A", "RACK_8"], isMobile);
  await expect(coach).toHaveAttribute("data-tone", "success");
  await expect(coach).toContainText("Одна гантель 8 кг уже на месте.");
  await expect(avatar.locator("img")).toHaveAttribute("src", portrait!);
  await expect(page.locator("[data-tip-target]")).toHaveCount(0);
});

test("на скамье можно провести весь жест одной мышью", async ({ page, isMobile }) => {
  test.skip(isMobile, "Сценарий мыши");
  await resumeBench(page);
  await openBench(page);
  await adjustBenchWithMouse(page, 2);
  await expect(page.getByText("Спинка зафиксирована. Теперь настроим сиденье.")).toBeVisible();
  await activate(page, "К сиденью");
  await adjustBenchWithMouse(page, 1);
  await expect(page.getByText("Скамья настроена: спинка и сиденье зафиксированы.")).toBeVisible();
  await expect(page.locator(".bench-station")).toHaveAttribute("data-input", "mouse");
});

test("сбой загрузки 3D оставляет рабочую схему, снаряды не грузятся на главной", async ({ page, isMobile }) => {
  test.skip(isMobile, "Сценарий клавиатуры");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requested: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/art/")) requested.push(request.url()); });
  await page.route("**/art/bench.glb", (route) => route.abort());
  await page.goto("");
  await expect(button(page, "Открыть игру")).toBeVisible();
  expect(requested).not.toEqual(expect.arrayContaining([expect.stringContaining("/art/bench.glb")]));
  expect(requested).not.toEqual(expect.arrayContaining([expect.stringContaining("/art/dumbbell-rack-empty.webp")]));
  await resumeBench(page);
  const bench = page.locator(".bench-view");
  await expect(bench).toHaveAttribute("data-model", "failed");
  await expect(bench.locator(".bench-sketch")).toBeVisible();
  await keyboardBench(page, 2);
  await activate(page, "К сиденью");
  await keyboardBench(page);
  await expect(page.getByText("Скамья настроена: спинка и сиденье зафиксированы.")).toBeVisible();
});
