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
export const rackRows = [[2, 4, 6, 8], [10, 12, 14, 16]] as const;
const rackWeights = [8, 12, 16];
export const rackTargets = rackRows.flatMap((row, shelf) => Array.from(row).flatMap((weightKg, pair) =>
  rackWeights.includes(weightKg) ? [{
    id: `RACK_${weightKg}`, label: `${shelf === 0 ? "Верхняя" : "Нижняя"} полка, пара ${pair + 1}`, weightKg, shelf, pair,
  }] : [],
));

export const benchParts = ["backrest", "seat"] as const;
export type BenchPart = typeof benchParts[number];
export const benchNotches = [0, 1, 2, 3] as const;
export type BenchNotch = typeof benchNotches[number];
export const benchAngles = { backrest: [0, 10, 20, 30], seat: [0, 4, 8, 12] } as const;
export const benchGoals = { backrest: 2, seat: 1 } as const satisfies Record<BenchPart, BenchNotch>;

const dumbbells = rackWeights.flatMap((weightKg) =>
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
    case "DUMBBELLS": return { ...station, title: "Верни гантели", items: dumbbells, targets: rackTargets };
    case "BARBELL": return { ...station, title: "Собери штангу", items: barbell.props };
    case "BENCH": return {
      ...station, title: "Помоги посетителю",
      items: [],
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
    mission: "Верни пары на стойку",
    instruction: "Поможешь вернуть три пары? Следующему человеку будет проще найти свой вес. Лёгкие гантели ставим выше, на каждой полке вес растёт слева направо.",
    lessonTitle: "Гантели на месте",
    takeaway: "Лёгкие пары ставь выше, тяжёлые ниже. На каждой полке вес растёт слева направо.",
  },
  BARBELL: {
    name: "Штанга",
    mission: `Собери ${barbell.targetKg} кг`,
    instruction: `Как насчёт ${barbell.targetKg} кг? Чтобы штанга была в равновесии, вес дисков на обеих сторонах должен совпасть. Когда всё на месте, можно закрепить диски замками.`,
    lessonTitle: "Штанга собрана",
    takeaway: "Набирай вес симметрично. Когда диски на месте, надень и защёлкни замки.",
  },
  BENCH: {
    name: "Помощь посетителю",
    mission: "Настрой скамью",
    lessonTitle: "Скамья готова",
    takeaway: "Удерживай фиксатор, меняя наклон. В новом положении отпусти его и проверь фиксацию подушки.",
  },
  INVENTORY: {
    name: "Инвентарь",
    mission: "Освободи проход",
    instruction: "Инвентарь остался на полу после занятий. Поможешь разложить вещи по местам? Так к тренажёрам будет удобно пройти.",
    lessonTitle: "Проход свободен",
    takeaway: "После подхода верни инвентарь в зоны хранения.",
  },
} satisfies Record<StationId, {
  name: string;
  mission: string;
  instruction?: string;
  lessonTitle: string;
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
