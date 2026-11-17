import { expect, type Page } from "@playwright/test";

export const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
export const prop = (page: Page, id: string) => page.locator('[data-scene-item="' + id + '"]');
export const dropTarget = (page: Page, id: string) => page.locator('[data-scene-target="' + id + '"]');

export const placements = {
  dumbbells: [
    ["DB_8_A", "RACK_8"], ["DB_8_B", "RACK_8"],
    ["DB_12_A", "RACK_12"], ["DB_12_B", "RACK_12"],
    ["DB_16_A", "RACK_16"], ["DB_16_B", "RACK_16"],
  ],
  barbell: [
    ["DISK_20_A", "LEFT"], ["DISK_20_B", "RIGHT"],
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
  for (const name of ["Начать знакомство", "Начать", "Начать смену"]) await activate(page, name, touch);
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
      for (const px of [.5, .64, .35, .79, .23, .89, .11, .95, .05]) {
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

export async function openBench(page: Page, touch = false) {
  await activate(page, "Попробовать на скамье", touch);
  await expect(page.locator(".bench-view")).toHaveAttribute("data-model", "ready");
}

export async function keyboardBench(page: Page, notches = 1) {
  await page.locator(".bench-view").focus();
  await page.keyboard.down("Space");
  for (let index = 0; index < notches; index++) await page.keyboard.press("ArrowUp");
  await page.keyboard.up("Space");
}

type Finger = { x: number; y: number; id: number };

export async function adjustBench(page: Page, touch: boolean, held: boolean, distance = 61) {
  const view = page.locator(".bench-view");
  await expect(view).toHaveAttribute("data-model", "ready");
  async function mark(control: "latch" | "cushion", id: number, span: number) {
    const target = view.locator('[data-bench-control="' + control + '"]');
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeVisible();
    const box = (await target.boundingBox())!;
    const angle = await target.evaluate((node) => parseFloat(node.style.getPropertyValue("--gesture-angle")));
    expect(Number.isFinite(angle)).toBe(true);
    return {
      start: { x: box.x + box.width / 2, y: box.y + box.height / 2, id },
      offset: { x: Math.cos(angle) * span, y: Math.sin(angle) * span },
    };
  }

  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    const fingers: Finger[] = [];
    async function drag(control: "latch" | "cushion", id: number, span: number) {
      const { start, offset } = await mark(control, id, span);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [...fingers, start] });
      let end = start;
      for (let index = 1; index <= 6; index++) {
        end = { id, x: start.x + offset.x * index / 6, y: start.y + offset.y * index / 6 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [...fingers, end] });
      }
      fingers.push(end);
    }
    try {
      if (held) {
        await drag("latch", 1, 31);
        await expect(view).toHaveAttribute("data-unlocked", "true");
      }
      await drag("cushion", 2, distance);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await cdp.detach();
    }
  } else {
    const { start, offset } = await mark("cushion", 2, distance);
    if (held) {
      await view.focus();
      await page.keyboard.down("Space");
      await expect(view).toHaveAttribute("data-unlocked", "true");
    }
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + offset.x, start.y + offset.y, { steps: 8 });
    await page.mouse.up();
    if (held) await page.keyboard.up("Space");
  }
}
