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

export const scenarioVersion = scenario.version;
export const stations = scenario.stages as readonly Station[];
export const lastStation = stations.length - 1;
export const totalActions = stations.reduce((sum, station) => sum + station.items.length, 0);

export const stationDetails = {
  DUMBBELLS: {
    name: "Гантели",
    instruction: "Верни каждую пару в ячейку с таким же весом.",
    lessonTitle: "Гантели на месте",
    lesson: "Возвращай гантели в подписанные ячейки. Следующий человек быстрее найдёт нужную пару, а проходы останутся свободными.",
    takeaway: "Верни гантели в ячейку с нужным весом.",
  },
  BARBELL: {
    name: "Штанга",
    instruction: "Поставь по одному диску 5 и 10 кг на каждую сторону грифа.",
    lessonTitle: "Диски по обе стороны",
    lesson: "Одинаковые диски с каждой стороны дают симметричную нагрузку. Подготовку реальной штанги и крепления уточни у тренера.",
    takeaway: "Распредели одинаковые диски по обе стороны грифа.",
  },
  BENCH: {
    name: "Скамья",
    instruction: "Выполни шесть проверок по порядку.",
    lessonTitle: "Сначала проверь",
    lesson: "Устройство скамей различается. Найди инструкцию к своей модели, а если сомневаешься, попроси тренера показать её в зале.",
    takeaway: "Уточни, как пользоваться скамьёй, и проверь, что она устойчива.",
  },
  INVENTORY: {
    name: "Инвентарь",
    instruction: "Распредели восемь предметов по зонам хранения.",
    lessonTitle: "Зона свободна",
    lesson: "Возвращай предметы в обозначенные зоны хранения своего клуба. Оставляй пространство для других участников.",
    takeaway: "После подхода убери инвентарь в зону хранения.",
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

export function placementDestination(station: "DUMBBELLS" | "INVENTORY", itemId: string) {
  return station === "DUMBBELLS"
    ? itemId.replace(/^PAIR_/, "RACK_")
    : inventoryZones[itemId.split("_")[0]];
}
