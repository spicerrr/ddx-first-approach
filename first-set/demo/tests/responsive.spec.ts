import { test, expect } from "@playwright/test";
import { button, keyboardBench, keyboardPlace, noOverflow, openBench, placements } from "./controls";

const nextButtons = ["К штанге", "К скамье", "К инвентарю", "Завершить игру"];

for (const width of [320, 375, 402, 430, 768, 1440]) {
  test(`экраны и доступность кнопок при ширине ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 874 : 900 });
    await page.goto("");
    await expect(button(page, "Открыть игру")).toBeVisible();
    await noOverflow(page);
    if (width >= 520) {
      expect(await page.locator(".app").evaluate((el) => [el.clientWidth, el.clientHeight])).toEqual([402, 874]);
      const bounds = (await page.locator(".app").boundingBox())!;
      expect(bounds.width / bounds.height).toBeCloseTo(402 / 874, 2);
    }
    await button(page, "Открыть игру").click();
    const cover = page.locator(".intro-cover-hero");
    const title = await cover.getByRole("heading").boundingBox();
    const portrait = await cover.locator("img").boundingBox();
    expect(portrait!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
    await noOverflow(page);
    await button(page, "Начать игру").click();
    const route = page.getByRole("list", { name: "Станции" });
    await expect(route).toHaveCSS("list-style-type", "none");
    await expect(route.getByRole("listitem")).toHaveCount(4);
    await expect(route.getByRole("listitem").first()).toHaveCSS("display", "grid");
    expect(await route.locator("img").evaluateAll((images) =>
      images.every((img) => img.clientWidth <= 70 && img.clientHeight === 46),
    )).toBe(true);
    await expect(button(page, "К гантелям")).toBeInViewport();
    await button(page, "К гантелям").click();
    for (const [index, name] of ["dumbbells", "barbell", "bench", "inventory"].entries()) {
      await noOverflow(page);
      const coach = page.locator(".coach-message");
      await expect(coach).toHaveCSS("display", "grid");
      expect(await coach.locator(".coach-avatar").evaluate((el) => {
        const avatar = el as HTMLElement;
        return [avatar.offsetWidth, avatar.offsetHeight];
      })).toEqual([56, 56]);
      const heading = page.locator(".game-heading h1");
      const score = page.locator(".stage-score");
      if (name !== "barbell") {
        const title = (await heading.boundingBox())!;
        const badge = (await score.boundingBox())!;
        expect(title.x).toBeLessThan(badge.x);
        expect(badge.x).toBeGreaterThanOrEqual(title.x + title.width);
        expect(badge.y).toBeLessThan(title.y + title.height);
      }
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
      await button(page, nextButtons[index]).click();
    }
    await expect(button(page, "На главный экран")).toBeVisible();
    await noOverflow(page);
  });
}
