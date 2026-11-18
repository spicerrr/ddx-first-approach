import { inventoryLayout, stations, type Item } from "./scenario";

const inventory = stations.find(({ stage }) => stage === "INVENTORY")!;
const plates = inventory.items.filter(({ weightKg }) => weightKg !== undefined);
const supplies = inventory.items.filter(({ weightKg }) => weightKg === undefined);
const eligibleZones = inventory.targets
  .map(({ id }) => supplies.filter(({ targetId }) => targetId === id))
  .filter((items) => items.length > inventoryLayout.minLoosePerStorageZone);

function sample<T>(choices: readonly T[], count: number, rng: () => number) {
  const available = [...choices];
  return Array.from({ length: count }, () => available.splice(Math.floor(rng() * available.length), 1)[0]);
}

export function createInventoryInitialLayout(rng = Math.random): Record<string, string> {
  const stored = [
    ...sample(plates, inventoryLayout.platesPreplaced, rng),
    ...sample(eligibleZones, inventoryLayout.distinctStorageZonesPreplaced, rng).flatMap((items) => sample(items, 1, rng)),
  ];
  return Object.fromEntries(stored.map(({ id, targetId }) => [id, targetId!]));
}

export function inventoryRemaining(assigned: Readonly<Record<string, string>>) {
  const loose = inventory.items.filter(({ id }) => !Object.hasOwn(assigned, id));
  const plates = loose.filter(({ weightKg }) => weightKg !== undefined).length;
  return { loose, plates, supplies: loose.length - plates };
}

const zoneMilestones: Readonly<Record<string, string>> = {
  MATS: "Коврики лежат стопкой на нижней полке.",
  BLOCKS: "Блоки на месте.",
  ROLLERS: "МФР-роллы на месте.",
  BANDS: "Резинки на месте.",
};

export function inventoryMilestone(item: Item, remaining: ReturnType<typeof inventoryRemaining>, userActions: number) {
  if (!remaining.loose.length) return "Готово. Инвентарь на местах, проход свободен.";
  if (item.weightKg !== undefined && remaining.plates === 0) return "Все диски на стойке.";
  const categoryDone = remaining.loose.every(({ targetId }) => targetId !== item.targetId);
  const categoryLine = item.weightKg === undefined && categoryDone ? zoneMilestones[item.targetId!] : undefined;
  if (userActions === 1) return `${categoryLine ?? "Да."} Дальше можно ориентироваться по подписям на стойках.`;
  if (categoryLine) return categoryLine;
  if (item.targetId === "MATS") return "Коврик развернулся на нижней полке.";
}
