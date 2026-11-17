import { test, expect } from "@playwright/test";
import { begin, benchControls, button, keyboardPlace, noOverflow, placements } from "./controls";

for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`экраны и доступность кнопок при ширине ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await page.goto("");
    await expect(button(page, "Начать знакомство")).toBeVisible();
    await noOverflow(page);
    if (width >= 520) expect((await page.locator(".app").boundingBox())!.width).toBe(412);
    await begin(page);
    for (const [index, name] of ["dumbbells", "barbell", "bench", "inventory"].entries()) {
      await noOverflow(page);
      const controls = await page.locator("main button:not(:disabled)").evaluateAll((buttons) =>
        buttons.every((b) => b.getBoundingClientRect().height >= 44),
      );
      expect(controls).toBe(true);
      if (name === "bench") {
        await button(page, "Убрать гантель").click();
        await button(page, "Жёлтый штифт").click();
        for (const control of benchControls.slice(0, 3)) await button(page, control).click();
        await button(page, "П-образный рычаг").click();
        for (const control of benchControls.slice(3)) await button(page, control).click();
        await button(page, "Проверить устойчивость").click();
      } else {
        for (const pair of placements[name as keyof typeof placements]) await keyboardPlace(page, pair);
        if (name === "barbell") await button(page, "Проверить").click();
      }
      await noOverflow(page);
      await button(page, index === 3 ? "К результату" : "Следующая станция").click();
    }
    await expect(button(page, "На главный экран")).toBeVisible();
    await noOverflow(page);
  });
}
