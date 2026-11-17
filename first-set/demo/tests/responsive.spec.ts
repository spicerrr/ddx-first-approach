import { test, expect } from "@playwright/test";
import { begin, button, keyboardBench, keyboardPlace, noOverflow, openBench, placements } from "./controls";

for (const width of [320, 375, 402, 430, 768, 1440]) {
  test(`экраны и доступность кнопок при ширине ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 874 : 900 });
    await page.goto("");
    await expect(button(page, "Начать знакомство")).toBeVisible();
    await noOverflow(page);
    if (width >= 520) {
      expect(await page.locator(".app").evaluate((el) => [el.clientWidth, el.clientHeight])).toEqual([402, 874]);
      const bounds = (await page.locator(".app").boundingBox())!;
      expect(bounds.width / bounds.height).toBeCloseTo(402 / 874, 2);
    }
    await begin(page);
    for (const [index, name] of ["dumbbells", "barbell", "bench", "inventory"].entries()) {
      await noOverflow(page);
      const controls = await page.locator("main button:not(:disabled)").evaluateAll((buttons) =>
        buttons.every((b) => (b as HTMLElement).offsetHeight >= 44),
      );
      expect(controls).toBe(true);
      if (name === "bench") {
        await openBench(page);
        await keyboardBench(page, 2);
        await button(page, "К сиденью").click();
        await openBench(page);
        await keyboardBench(page);
      } else {
        for (const pair of placements[name as keyof typeof placements]) await keyboardPlace(page, pair);
        if (name === "barbell") {
          await button(page, "Защёлкнуть левый замок").click();
          await button(page, "Защёлкнуть правый замок").click();
          await button(page, "Проверить").click();
        }
      }
      await noOverflow(page);
      await button(page, index === 3 ? "К результату" : "Следующая станция").click();
    }
    await expect(button(page, "На главный экран")).toBeVisible();
    await noOverflow(page);
  });
}
