import scenario from "../../../sa/contracts/scenario-v1.sample.json";

export type StationId = "DUMBBELLS" | "BARBELL" | "BENCH" | "INVENTORY";
export type PlacementStation = Exclude<StationId, "BENCH">;
export type Item = { id: string; label: string; weightKg?: number };
export type Destination = { id: string; label: string };
export type Station = {
  stage: StationId;
  title: string;
  items: readonly Item[];
  targets: readonly Destination[];
};

export const legacyVersion = scenario.version;
export const legacyStations = scenario.stages as readonly Station[];
export const scenarioVersion = "1.1";

export const benchParts = ["backrest", "seat"] as const;
export type BenchPart = typeof benchParts[number];
export const benchPreparation = "UNLOADED";
export const benchFinalCheck = "VERIFY_LOCK";

export const initialDumbbell: Item = { id: "DB_8_A", label: "Гантель А · 8 кг", weightKg: 8 };
const dumbbells = [
  { id: "DB_8_B", label: "Гантель Б · 8 кг", weightKg: 8 },
  { id: "DB_12_A", label: "Гантель А · 12 кг", weightKg: 12 },
  { id: "DB_12_B", label: "Гантель Б · 12 кг", weightKg: 12 },
  { id: "DB_16_A", label: "Гантель А · 16 кг", weightKg: 16 },
  { id: "DB_16_B", label: "Гантель Б · 16 кг", weightKg: 16 },
] satisfies Item[];

export const barbell = {
  shaftKg: 20,
  startingDiskKg: 20,
  targetKg: 80,
  items: [
    { id: "DISK_5_A", label: "Диск А · 5 кг", weightKg: 5 },
    { id: "DISK_5_B", label: "Диск Б · 5 кг", weightKg: 5 },
    { id: "DISK_10_A", label: "Диск В · 10 кг", weightKg: 10 },
    { id: "DISK_10_B", label: "Диск Г · 10 кг", weightKg: 10 },
    { id: "DISK_5_C", label: "Диск Д · 5 кг", weightKg: 5 },
    { id: "DISK_5_D", label: "Диск Е · 5 кг", weightKg: 5 },
  ],
};

export const stations: readonly Station[] = legacyStations.map((station) => {
  switch (station.stage) {
    case "DUMBBELLS": return { ...station, title: "Собери пары", items: dumbbells };
    case "BARBELL": return { ...station, title: "Собери штангу", items: barbell.items };
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
  return station.items.length + (station.stage === "BENCH" ? benchParts.length : 0);
};

export const stationDetails = {
  DUMBBELLS: {
    name: "Гантели",
    instruction: "На стойке одна гантель. Собери пары и поставь их в ячейки своего веса.",
    lessonTitle: "Гантели на месте",
    lesson: "Три пары стоят в подписанных ячейках. Следующий участник сможет быстро найти нужный вес.",
    takeaway: "Возвращай гантели в ячейку их веса.",
  },
  BARBELL: {
    name: "Штанга",
    instruction: `Доведи массу виртуальной штанги до ${barbell.targetKg} кг. Проверь, что с обеих сторон одинаковый набор дисков.`,
    lessonTitle: "Штанга собрана",
    lesson: `Получилось ${barbell.targetKg} кг. Вес и набор дисков совпадают с обеих сторон.`,
    takeaway: "Сверяй вес и состав дисков на обеих сторонах грифа.",
  },
  BENCH: {
    name: "Скамья",
    instruction: "Подготовь скамью к подходу. Выставь наклон спинки и сиденья и проверь фиксаторы.",
    lessonTitle: "Скамья готова",
    lesson: "Спинка и сиденье закреплены, опора устойчива. В клубе уточни устройство конкретной модели у тренера.",
    takeaway: "После регулировки проверь фиксацию спинки, сиденья и устойчивость скамьи.",
  },
  INVENTORY: {
    name: "Инвентарь",
    instruction: "После подхода в проходе остался инвентарь. Разложи его по обозначенным зонам.",
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

export function placementDestination(station: "DUMBBELLS" | "INVENTORY", item: Item) {
  return station === "DUMBBELLS" ? `RACK_${item.weightKg}` : inventoryZones[item.id.split("_")[0]];
}
