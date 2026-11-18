import { test, expect, type Page } from "@playwright/test";
import { activate, dropTarget, enterInventory, keyboardPlace, looseInventory, openRoute, prop } from "./controls";

async function openSavedInventory(page: Page, touch: boolean, rng: number) {
  await page.addInitScript(() => localStorage.setItem("ddx-first-approach-completed-v1", "3"));
  await page.goto("");
  await openRoute(page, touch);
  await enterInventory(page, touch, rng);
  await expect(page.locator(".storage-floor [data-scene-item]")).toHaveCount(13);
}

const placements = (page: Page) => page.locator(".storage-floor [data-scene-item]").evaluateAll(
  (items) => items.map((item) => [item.getAttribute("data-scene-item"), item.getAttribute("data-location")]),
);

test("раскладка инвентаря и прогресс сохраняются при возврате на карту", async ({ page, isMobile }) => {
  await openSavedInventory(page, isMobile, .99);
  const press = (name: string) => activate(page, name, isMobile);
  const score = page.locator(".inventory-score");
  const floor = page.locator('.storage-floor [data-location="FLOOR"]');
  const preplaced = page.locator(".storage-floor [data-stationary]");
  const coach = page.locator(".scene-response .coach-message");
  await expect(score).toHaveText("Осталось 8");
  await expect(page.locator(".inventory-meter").nth(0)).toHaveText("Диски · осталось 3");
  await expect(page.locator(".inventory-meter").nth(1)).toHaveText("Инвентарь · осталось 5");
  await expect(coach).toContainText("В зоне осталось убрать 8 предметов.");
  await expect(preplaced).toHaveCount(5);
  expect(await preplaced.evaluateAll((items) => items.every((item) =>
    getComputedStyle(item).pointerEvents === "none" && !item.hasAttribute("tabindex"),
  ))).toBe(true);
  const original = await placements(page);

  await press("Помощь");
  await press("Подсказка");
  await expect(coach).toHaveAttribute("data-hint-level", "1");
  expect(await placements(page)).toEqual(original);
  for (const invalid of ["BANDS", "BLOCKS", "ROLLERS"]) {
    await keyboardPlace(page, ["MAT_1", invalid]);
    await expect(score).toHaveText("Осталось 8");
  }
  await expect(dropTarget(page, "MATS")).toHaveAttribute("data-tip-target", "true");
  await expect(floor.and(page.locator('[data-guided="true"]'))).toHaveCount(1);
  expect(await placements(page)).toEqual(original);

  await keyboardPlace(page, ["MAT_1", "MATS"]);
  await expect(score).toHaveText("Осталось 7");
  await expect(coach).toContainText("ориентироваться по подписям");
  await expect(page.locator("[data-tip-target]")).toHaveCount(0);
  const updated = await placements(page);

  await press("Маршрут");
  await expect(page.locator('.route-stations [aria-current="step"]')).toContainText("Инвентарь");
  await press("К станции");
  await expect(score).toHaveText("Осталось 7");
  expect(await placements(page)).toEqual(updated);
});

test("коврик кладётся поверх уже размещённого при уменьшенном движении", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSavedInventory(page, isMobile, 0);
  const first = prop(page, "MAT_1");
  const second = prop(page, "MAT_2");
  await expect(first).toHaveAttribute("data-stationary", "true");
  await expect(first.locator(".mat-sheet")).toHaveCSS("background-position-x", "100%");
  await keyboardPlace(page, ["MAT_2", "MATS"]);
  await expect(second).toHaveAttribute("data-location", "MATS");
  await expect(second).not.toHaveAttribute("data-landed", "true");
  await expect(second.locator(".mat-sheet")).toHaveCSS("animation-name", "none");
  await expect(second).toHaveCSS("z-index", "6");
  await expect(first).toHaveCSS("z-index", "5");
  await expect(page.locator(".scene-response")).toContainText("Коврики лежат стопкой на нижней полке.");

  const pending = await looseInventory(page);
  expect(pending).toHaveLength(7);
  for (const pair of pending) await keyboardPlace(page, pair);
  await expect(page.getByRole("heading", { name: "Первый подход пройден" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Пройденные станции" }).getByRole("listitem")).toHaveCount(4);
});
