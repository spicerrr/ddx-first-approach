import scenario from "../../../sa/contracts/scenario-v2.sample.json";

export type StationId = "DUMBBELLS" | "BARBELL" | "BENCH" | "INVENTORY";
export type BenchPart = "backrest" | "seat";
export type BenchNotch = number;
export type BarbellSide = "LEFT" | "RIGHT";
export type Item = { id: string; label: string; weightKg?: number; targetId?: string };
export type Destination = { id: string; label: string };
export type Station = {
  stage: StationId;
  title: string;
  items: readonly Item[];
  targets: readonly Destination[];
};

type BarbellItem = { id: string } & ({ kind: "disk"; weightKg: number } | { kind: "collar" });
type InventoryItem = { id: string; targetId: string } & ({ weightKg: number; label?: never } | { label: string; weightKg?: never });
type Definition = { title: string } & (
  | { stage: "DUMBBELLS"; rackRows: { weightKg: number; targetId?: string }[][]; items: { id: string; targetId: string }[] }
  | { stage: "BARBELL"; shaftKg: number; sides: BarbellSide[]; items: BarbellItem[];
      completion: { targetKg: number; sideDifferenceKg: number; closedCollars: number } }
  | { stage: "BENCH"; notches: BenchNotch[]; parts: { id: BenchPart; targetNotch: BenchNotch }[] }
  | { stage: "INVENTORY"; shelvesAndHooks: Destination[]; items: InventoryItem[];
      initialLayout: { platesPreplaced: number; distinctStorageZonesPreplaced: number; minLoosePerStorageZone: number } }
);

const definitions = scenario.stages as readonly Definition[];
const rackSpec = definitions.find((definition) => definition.stage === "DUMBBELLS")!;
const barbellSpec = definitions.find((definition) => definition.stage === "BARBELL")!;
const benchSpec = definitions.find((definition) => definition.stage === "BENCH")!;
const inventorySpec = definitions.find((definition) => definition.stage === "INVENTORY")!;

export const scenarioVersion = scenario.version;
export const floorId = "FLOOR";
export const rackRows = rackSpec.rackRows.map((row) => row.map(({ weightKg }) => weightKg));
export const rackTargets = rackSpec.rackRows.flatMap((row, shelf) => row.flatMap(({ weightKg, targetId }, pair) =>
  targetId ? [{
    id: targetId, label: `${shelf === 0 ? "Верхняя" : "Нижняя"} полка, пара ${pair + 1}`, weightKg, shelf, pair,
  }] : [],
));

export const benchParts = benchSpec.parts.map(({ id }) => id);
export const benchNotches = benchSpec.notches;
export const benchGoals = Object.fromEntries(benchSpec.parts.map(({ id, targetNotch }) => [id, targetNotch])) as Record<BenchPart, BenchNotch>;

export const barbellSides = barbellSpec.sides;
export const barbell = {
  shaftKg: barbellSpec.shaftKg,
  ...barbellSpec.completion,
  props: barbellSpec.items.map((item) => ({
    ...item, label: item.kind === "disk" ? `Диск ${item.weightKg} кг` : "Замок для грифа",
  })),
};

const plateItems = inventorySpec.items.filter((item) => item.weightKg !== undefined);
export const inventoryPlateWeights = plateItems.map(({ weightKg }) => weightKg);
export const plateRackSlot = (weightKg: number) => plateItems.find((item) => item.weightKg === weightKg)!.targetId;
export const inventoryLayout = inventorySpec.initialLayout;

export const stations: readonly Station[] = definitions.map(({ stage, title }) => {
  switch (stage) {
    case "DUMBBELLS": return {
      stage, title, targets: rackTargets,
      items: rackSpec.items.map((item) => {
        const { weightKg } = rackTargets.find(({ id }) => id === item.targetId)!;
        return { ...item, weightKg, label: `Гантель ${weightKg} кг` };
      }),
    };
    case "BARBELL": return { stage, title, items: barbell.props, targets: [] };
    case "BENCH": return { stage, title, items: [], targets: [] };
    case "INVENTORY": return {
      stage, title,
      items: inventorySpec.items.map((item) => ({ ...item, label: item.label ?? `Бамперный диск ${item.weightKg} кг` })),
      targets: [...inventorySpec.shelvesAndHooks, ...plateItems.map(({ targetId, weightKg }) => ({ id: targetId, label: `Место для диска ${weightKg} кг` }))],
    };
  }
});
export const lastStation = stations.length - 1;

export const stationDetails = {
  DUMBBELLS: {
    purpose: "Пары и стойка",
    instruction: "На полу три пары гантелей. Верни их на стойку.",
    lessonTitle: "Гантели на месте",
    nextButton: "К штанге",
  },
  BARBELL: {
    purpose: "Вес и замки",
    instruction: `Собери штангу весом ${barbell.targetKg} кг. Гриф весит ${barbell.shaftKg} кг. Когда закончишь — проверь сборку.`,
    lessonTitle: "Штанга собрана",
    nextButton: "К скамье",
  },
  BENCH: {
    purpose: "Регулировка",
    nextButton: "К инвентарю",
  },
  INVENTORY: { purpose: "Зоны хранения" },
};
