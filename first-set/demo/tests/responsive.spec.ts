import { test, expect } from "@playwright/test";
import { button, keyboardBench, keyboardPlace, looseInventory, noOverflow, openBench, openRoute, placements } from "./controls";

const nextButtons = ["К штанге", "К скамье", "К инвентарю"];

for (const width of [320, 375, 402, 430, 768, 1440]) {
  test(`экраны и доступность кнопок при ширине ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 874 : 900 });
    await page.goto("");
    await expect(button(page, "Точка старта")).toBeVisible();
    await noOverflow(page);
    if (width >= 520) {
      expect(await page.locator(".app").evaluate((el) => [el.clientWidth, el.clientHeight])).toEqual([402, 874]);
      const bounds = (await page.locator(".app").boundingBox())!;
      expect(bounds.width / bounds.height).toBeCloseTo(402 / 874, 2);
    }
    await openRoute(page);
    await noOverflow(page);
    const route = page.getByRole("list", { name: "Станции" });
    await expect(route).toHaveCSS("list-style-type", "none");
    await expect(route.getByRole("listitem")).toHaveCount(4);
    await expect(route.getByRole("listitem").first()).toHaveCSS("display", "grid");
    const hero = route.locator('[data-progress="current"] .route-art img');
    await expect(hero).toBeVisible();
    expect((await hero.boundingBox())!.width).toBeGreaterThan(75);
    await expect(route.locator('[data-progress="locked"]')).toHaveCount(3);
    expect(await route.locator("li").evaluateAll((cards) => cards.every((card) => {
      const body = card.getBoundingClientRect();
      const image = card.querySelector("img")!.getBoundingClientRect();
      return image.top >= body.top && image.bottom <= body.bottom;
    }))).toBe(true);
    await expect(button(page, "Начать")).toBeInViewport();
    await button(page, "Начать").click();
    for (const [index, name] of ["dumbbells", "barbell", "bench", "inventory"].entries()) {
      await noOverflow(page);
      const coach = page.locator(".coach-message");
      await expect(coach).toHaveCSS("display", "grid");
      const avatarSize = await coach.locator(".coach-avatar").evaluate((el) => {
        const avatar = el as HTMLElement;
        return [avatar.offsetWidth, avatar.offsetHeight];
      });
      expect(avatarSize[0]).toBeGreaterThanOrEqual(56);
      expect(avatarSize[0]).toBeLessThanOrEqual(72);
      expect(avatarSize[1]).toBe(avatarSize[0]);
      const heading = page.locator(".game-heading h1");
      const score = page.locator(".stage-score");
      const title = (await heading.boundingBox())!;
      const badge = (await score.boundingBox())!;
      expect(title.x).toBeLessThan(badge.x);
      expect(badge.x).toBeGreaterThanOrEqual(title.x + title.width);
      expect(badge.y).toBeLessThan(title.y + title.height);
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
        for (const pair of name === "inventory" ? await looseInventory(page) : placements[name as keyof typeof placements]) await keyboardPlace(page, pair);
        if (name === "barbell") {
          await button(page, "Защёлкнуть левый замок").click();
          await button(page, "Защёлкнуть правый замок").click();
          await button(page, "Проверить").click();
        }
      }
      await noOverflow(page);
      if (index < nextButtons.length) {
        await button(page, nextButtons[index]).click();
        await button(page, "К станции").click();
      }
    }
    await expect(button(page, "Вернуться в Точку старта")).toBeVisible();
    for (const link of await page.locator(".finish-next").getByRole("link").all()) {
      await expect(link).toBeInViewport({ ratio: 1 });
      expect(await link.evaluate((el) => el.clientHeight)).toBeGreaterThanOrEqual(44);
    }
    await noOverflow(page);
  });
}

test("баннер и обе кнопки расписания видны на коротком мобильном экране", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ddx-first-approach-completed-v1", "4"));
  for (const [width, height] of [[320, 568], [375, 667], [390, 664]]) {
    await page.setViewportSize({ width, height });
    await page.goto("");
    const banner = button(page, "Точка старта");
    await expect(banner).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".club-stories").getByRole("button", { name: "Точка старта" })).toHaveCount(0);
    await openRoute(page);
    await expect(page.getByRole("link", { name: "Выбрать занятие Smart Start" })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("link", { name: "Выбрать время с тренером" })).toBeInViewport({ ratio: 1 });
    await noOverflow(page);
  }
});
