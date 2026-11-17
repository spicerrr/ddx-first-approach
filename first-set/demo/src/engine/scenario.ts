import scenario from "../../../sa/contracts/scenario-v1.sample.json";

export type StationId = "DUMBBELLS" | "BARBELL" | "BENCH" | "INVENTORY";
export type Item = { id: string; label: string; weightKg?: number };
export type Destination = { id: string; label: string };
export type Station = {
  stage: StationId;
  title: string;
  items: readonly Item[];
  targets: readonly Destination[];
};

const contractStations = scenario.stages as readonly Station[];
export const floorId = "FLOOR";
export const rackTargets = [
  { id: "RACK_LEFT", label: "Левая пара на стойке" },
  { id: "RACK_MIDDLE", label: "Средняя пара на стойке" },
  { id: "RACK_RIGHT", label: "Правая пара на стойке" },
] as const;

export const benchParts = ["backrest", "seat"] as const;
export type BenchPart = typeof benchParts[number];
export const benchPreparation = "UNLOADED";
export const benchFinalCheck = "VERIFY_LOCK";

const dumbbells = [8, 12, 16].flatMap((weightKg) =>
  ["A", "B"].map((copy) => ({
    id: `DB_${weightKg}_${copy}`,
    label: `Гантель ${weightKg} кг`,
    weightKg,
  })),
);

export const barbellSides = ["LEFT", "RIGHT"] as const;
export type BarbellSide = typeof barbellSides[number];
export type BarbellProp =
  | { id: string; label: string; kind: "disk"; weightKg: 5 | 10 | 20 }
  | { id: string; label: string; kind: "collar" };

export const barbell = {
  shaftKg: 20,
  targetKg: 80,
  sleeveCapacity: 3,
  props: [
    { id: "DISK_20_A", label: "Диск 20 кг", kind: "disk", weightKg: 20 },
    { id: "DISK_20_B", label: "Диск 20 кг", kind: "disk", weightKg: 20 },
    { id: "DISK_5_A", label: "Диск 5 кг", kind: "disk", weightKg: 5 },
    { id: "DISK_5_B", label: "Диск 5 кг", kind: "disk", weightKg: 5 },
    { id: "DISK_5_C", label: "Диск 5 кг", kind: "disk", weightKg: 5 },
    { id: "DISK_5_D", label: "Диск 5 кг", kind: "disk", weightKg: 5 },
    { id: "DISK_10_A", label: "Диск 10 кг", kind: "disk", weightKg: 10 },
    { id: "DISK_10_B", label: "Диск 10 кг", kind: "disk", weightKg: 10 },
    { id: "LOCK_A", label: "Замок для грифа", kind: "collar" },
    { id: "LOCK_B", label: "Замок для грифа", kind: "collar" },
  ] satisfies BarbellProp[],
};

export const stations: readonly Station[] = contractStations.map((station) => {
  switch (station.stage) {
    case "DUMBBELLS": return { ...station, title: "Гантели", items: dumbbells, targets: rackTargets };
    case "BARBELL": return { ...station, title: "Штанга", items: barbell.props };
    case "BENCH": return {
      ...station, title: "Настрой скамью",
      items: station.items.filter(({ id }) => id === benchPreparation || id === benchFinalCheck),
    };
    case "INVENTORY": return { ...station, title: "Освободи проход" };
  }
});
export const lastStation = stations.length - 1;
export const stationTotal = (station: Station) => {
  if (station.stage === "BARBELL") return 1;
  if (station.stage === "DUMBBELLS") return station.targets.length;
  return station.items.length + (station.stage === "BENCH" ? benchParts.length : 0);
};

export const stationDetails = {
  DUMBBELLS: {
    name: "Гантели",
    instruction: "После подхода верни гантели на стойку. Так следующий человек легко найдёт пару. Посмотри на цифры на торцах и перетащи одинаковые гантели рядом.",
    lessonTitle: "Гантели на месте",
    lesson: "Все три пары на стойке. Теперь нужный вес легко найти, а проход свободен.",
    takeaway: "Возвращай гантели на стойку. Собирай одинаковые веса в пары.",
  },
  BARBELL: {
    name: "Штанга",
    instruction: `Собери учебные ${barbell.targetKg} кг. Перетащи одинаковые диски на обе стороны грифа, затем надень два замка.`,
    lessonTitle: "Штанга собрана",
    lesson: `Получилось ${barbell.targetKg} кг. Диски с обеих сторон совпадают, замки на месте.`,
    takeaway: "Сверяй состав дисков с обеих сторон грифа и ставь замки.",
  },
  BENCH: {
    name: "Скамья",
    instruction: "Спинка и сиденье регулируются отдельно. Найди оба фиксатора на учебной скамье и подготовь её к подходу.",
    lessonTitle: "Скамья готова",
    lesson: "Спинка и сиденье закреплены, опора устойчива. В клубе уточни устройство конкретной модели у тренера.",
    takeaway: "После регулировки проверь фиксацию спинки, сиденья и устойчивость скамьи.",
  },
  INVENTORY: {
    name: "Инвентарь",
    instruction: "Давай освободим проход. Верни вещи в свои зоны, чтобы другим было удобно пройти к тренажёрам.",
    lessonTitle: "Проход свободен",
    lesson: "Все предметы на местах. Можно свободно пройти к оборудованию.",
    takeaway: "После подхода верни инвентарь в зоны хранения.",
  },
} satisfies Record<StationId, {
  name: string;
  instruction: string;
  lessonTitle: string;
  lesson: string;
  takeaway: string;
}>;

const inventoryZones: Readonly<Partial<Record<string, string>>> = {
  MAT: "MATS",
  BAND: "BANDS",
  BLOCK: "BLOCKS",
  ROLLER: "ROLLERS",
};

export function inventoryDestination(item: Item) {
  return inventoryZones[item.id.split("_")[0]];
}
