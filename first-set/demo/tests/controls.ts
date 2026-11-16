import { expect, type Page } from "@playwright/test";

export const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

export const placements = {
  dumbbells: [
    ["Пара · 8 кг", "Ячейка 8 кг"],
    ["Пара · 12 кг", "Ячейка 12 кг"],
    ["Пара · 16 кг", "Ячейка 16 кг"],
  ],
  barbell: [
    ["Диск А · 5 кг", "Левая сторона"],
    ["Диск Б · 5 кг", "Правая сторона"],
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
