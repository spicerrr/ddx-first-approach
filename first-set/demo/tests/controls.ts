import { expect, type Page } from "@playwright/test";

export const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
export const prop = (page: Page, id: string) => page.locator('[data-scene-item="' + id + '"]');
export const dropTarget = (page: Page, id: string) => page.locator('[data-scene-target="' + id + '"]');

export const placements = {
  dumbbells: [
    ["DB_8_A", "RACK_LEFT"], ["DB_8_B", "RACK_LEFT"],
    ["DB_12_A", "RACK_MIDDLE"], ["DB_12_B", "RACK_MIDDLE"],
    ["DB_16_A", "RACK_RIGHT"], ["DB_16_B", "RACK_RIGHT"],
  ],
  barbell: [
    ["DISK_10_A", "LEFT"], ["DISK_10_B", "RIGHT"],
    ["LOCK_A", "LEFT"], ["LOCK_B", "RIGHT"],
  ],
  inventory: [
    ["MAT_1", "MATS"], ["BAND_1", "BANDS"], ["BLOCK_1", "BLOCKS"], ["ROLLER_1", "ROLLERS"],
    ["MAT_2", "MATS"], ["BAND_2", "BANDS"], ["BLOCK_2", "BLOCKS"], ["ROLLER_2", "ROLLERS"],
  ],
} as const;

export async function activate(page: Page, name: string, touch = false) {
  const control = button(page, name);
  if (touch) await control.tap();
  else await control.click();
}

export async function begin(page: Page, touch = false) {
  for (const name of ["Начать знакомство", "К маршруту", "Начать маршрут"]) await activate(page, name, touch);
}

export async function keyboardPlace(page: Page, [item, target]: readonly [string, string]) {
  await prop(page, item).press("Space");
  await dropTarget(page, target).press("Space");
}

export async function dragProp(page: Page, [item, target]: readonly [string, string], touch = false) {
  const source = prop(page, item);
  const receiver = dropTarget(page, target);
  await source.scrollIntoViewIfNeeded();
  await receiver.scrollIntoViewIfNeeded();
  const from = await source.evaluate((node) => {
    const box = node.getBoundingClientRect();
    for (const py of [.5, .42, .56, .66, .34, .22, .78]) {
      for (const px of [.5, .64, .35, .79, .23]) {
        const x = box.left + box.width * px, y = box.top + box.height * py;
        if (document.elementFromPoint(x, y)?.closest("[data-scene-item]") === node) return { x, y };
      }
    }
    return null;
  });
  expect(from, item + " можно взять со сцены").not.toBeNull();
  const rect = (await receiver.boundingBox())!;
  const to = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from!] });
    for (let step = 1; step <= 6; step++) {
      const x = from!.x + (to.x - from!.x) * step / 6;
      const y = from!.y + (to.y - from!.y) * step / 6;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(from!.x, from!.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  }
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
