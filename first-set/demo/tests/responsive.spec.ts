import { test, expect } from "@playwright/test";
import { button, noOverflow, placements, put } from "./controls";

for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`экраны и доступность кнопок при ширине ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await page.goto("");
    await expect(button(page, "Начать знакомство")).toBeVisible();
    await noOverflow(page);
    await button(page, "Начать знакомство").click();
    for (const [index, name] of ["dumbbells", "barbell", "bench", "inventory"].entries()) {
      await noOverflow(page);
      const controls = await page.locator("main button:not(:disabled)").evaluateAll((buttons) =>
        buttons.every((b) => b.getBoundingClientRect().height >= 44),
      );
      expect(controls).toBe(true);
      if (name === "bench") {
        for (let step = 0; step < 6; step += 1) await button(page, "Отметить проверку").click();
      } else {
        for (const pair of placements[name as keyof typeof placements]) await put(page, pair);
      }
      await noOverflow(page);
      await button(page, index === 3 ? "К результату" : "Следующая станция").click();
    }
    await expect(button(page, "Пройти ещё раз")).toBeVisible();
    await noOverflow(page);
  });
}
