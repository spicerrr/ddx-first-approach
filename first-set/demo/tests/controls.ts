import { expect, type Page } from "@playwright/test";

export const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

export const placements = {
  dumbbells: [
    ["Гантель Б · 8 кг", "Ячейка 8 кг"],
    ["Гантель А · 12 кг", "Ячейка 12 кг"],
    ["Гантель Б · 12 кг", "Ячейка 12 кг"],
    ["Гантель А · 16 кг", "Ячейка 16 кг"],
    ["Гантель Б · 16 кг", "Ячейка 16 кг"],
  ],
  barbell: [
    ["Диск В · 10 кг", "Левая сторона"],
    ["Диск Г · 10 кг", "Правая сторона"],
  ],
  inventory: [
    ["Коврик 01", "Стойка ковриков"],
    ["Резинка 01", "Зона резинок"],
    ["Йога-блок 01", "Йога-блоки"],
    ["МФР-ролл 01", "МФР-роллы"],
    ["Коврик 02", "Стойка ковриков"],
    ["Резинка 02", "Зона резинок"],
    ["Йога-блок 02", "Йога-блоки"],
    ["МФР-ролл 02", "МФР-роллы"],
  ],
} as const;

export async function activate(page: Page, name: string, touch = false) {
  const control = button(page, name);
  if (touch) await control.tap();
  else await control.click();
}

export async function put(page: Page, [item, target]: readonly [string, string], touch = false) {
  await activate(page, item, touch);
  await activate(page, target, touch);
}

export async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

export const benchControls = [
  "Вытянуть штифт", "Поднять спинку до 30°", "Проверить спинку",
  "Освободить фиксатор сиденья", "Поднять сиденье до 12°", "Проверить сиденье",
] as const;

export async function moveBenchPart(page: Page, label: string, touch: boolean, distance = 58) {
  const marker = button(page, `На модели: ${label}`);
  await expect(marker).toBeVisible();
  await marker.scrollIntoViewIfNeeded();
  const bounds = (await marker.boundingBox())!;
  const angle = await marker.evaluate((el) => Number.parseFloat(el.style.getPropertyValue("--gesture-angle")));
  expect(Number.isFinite(angle)).toBe(true);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const dx = distance * Math.cos(angle);
  const dy = distance * Math.sin(angle);
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 7; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: x + dx * step / 7, y: y + dy * step / 7 }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 7 });
    await page.mouse.up();
  }
}
