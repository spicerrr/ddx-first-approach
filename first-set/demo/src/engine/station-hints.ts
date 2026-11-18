import type { HintRule } from "./hints";
import type { BarbellIssue, barbellLayout } from "./barbell";
import { barbell, barbellSides, rackRows, rackTargets, type BenchPart, type Item } from "./scenario";

export function dumbbellRule(weight: number): HintRule {
  const slot = rackTargets.find((target) => target.weightKg === weight)!;
  const row: readonly number[] = rackRows[slot.shelf];
  const before = row[slot.pair - 1];
  const after = row[slot.pair + 1];
  const position = after ? `между ${before} и ${after} кг`
    : `на ${slot.shelf ? "нижней" : "верхней"} полке, после ${before} кг`;
  return {
    id: "dumbbell-" + weight,
    steps: [
      "Сверь вес гантели с соседними парами.",
      `На каждой полке вес растёт слева направо. Эта пара — ${weight} кг.`,
      `Для ${weight} кг место ${position}.`,
    ],
    highlight: slot.id,
    demo: "Могу показать, куда встанет эта пара.",
  };
}

export function barbellRule(issue: BarbellIssue, layout: ReturnType<typeof barbellLayout>): HintRule {
  const { totalKg, leftKg, rightKg } = layout;
  const diskKg = barbell.targetKg - barbell.shaftKg;
  const perSide = `Для равновесия нужно по ${diskKg / barbellSides.length} кг с каждой стороны.`;
  const load = `Слева ${leftKg} кг дисков, справа ${rightKg} кг.`;
  const steps: Record<BarbellIssue, HintRule["steps"]> = {
    "mass-under": [`Сейчас ${totalKg} кг. До цели не хватает ${barbell.targetKg - totalKg} кг.`,
      `Гриф уже входит в общий вес. Дисками нужно добавить ${diskKg} кг.`, perSide],
    "mass-over": [`Сейчас ${totalKg} кг. Это на ${totalKg - barbell.targetKg} кг больше цели.`,
      `Гриф входит в общий вес. На диски приходится ${diskKg} кг.`, perSide],
    imbalanced: [`${barbell.targetKg} кг набрано, но стороны загружены по-разному.`, load, perSide],
    "early-collar": ["Замки понадобятся в конце. Сначала собери вес.",
      `Сейчас ${totalKg} кг. Цель — ${barbell.targetKg} кг вместе с грифом.`, perSide],
    "missing-collar": ["Вес собран. Осталось зафиксировать диски.",
      "Замок удерживает диски на втулке.", "Надень по замку на обе стороны и закрой рычажки."],
    "open-collar": ["Замки на месте. Осталось закрыть рычажки.",
      "Открытый замок ещё не фиксирует диски.", "Защёлкни рычажок каждого открытого замка."],
    "locked-collar": ["Открой рычажок, чтобы освободить замок.",
      "Закрытый замок удерживает диски на втулке.", "Открой замок и верни его на пол."],
    "occupied-collar": ["На этой втулке уже есть замок.",
      "На каждую сторону нужен один замок.", "Поставь замок на другую втулку."],
    "blocked-sleeve": ["Замок держит диски на конце втулки.",
      "Чтобы переставить диски, сначала освободи втулку.", "Открой замок и сними его. Затем переставь диск."],
    "inner-disk": ["Со втулки сначала снимается крайний диск.",
      "Внутренние диски снимаются по очереди.", "Стяни крайний диск с втулки на пол."],
  };
  return {
    id: "barbell-" + issue, steps: steps[issue],
    demo: "Могу показать это на примере штанги.",
  };
}

export function benchRule(part: BenchPart, reason: "locked" | "alignment"): HintRule {
  const backrest = part === "backrest";
  const steps: HintRule["steps"] = reason === "alignment" ? [
    "Фиксатор встал на место. Сравни положение подушки с контуром.",
    "Подушка должна совпасть с контуром до того, как отпустишь фиксатор.",
    "Совмести край подушки с бирюзовым контуром, затем отпусти фиксатор.",
  ] : backrest ? [
    "Спинка сейчас зафиксирована. Посмотри на жёлтый штифт.",
    "Чтобы изменить наклон, штифт нужно отвести и удерживать.",
    "Удерживай штифт, пока двигаешь спинку.",
  ] : [
    "Сиденье тоже зафиксировано. Посмотри под него.",
    "Под сиденьем П-образный рычаг. Его нужно отвести и удерживать.",
    "Удерживай рычаг, пока двигаешь сиденье.",
  ];
  return {
    id: "bench-" + part + "-" + reason, steps,
    highlight: reason === "locked" ? part + "-latch" : undefined,
    demo: "Могу показать регулировку в движении.",
  };
}

export const shelfLabels: Readonly<Record<string, string>> = {
  MATS: "Коврики", BLOCKS: "Блоки", ROLLERS: "МФР-роллы", BANDS: "Резинки",
};

export function inventoryRule(item: Item): HintRule {
  const slot = item.targetId!;
  const steps: HintRule["steps"] = item.weightKg !== undefined ? [
    "Для дисков есть отдельная стойка.",
    "Сверь вес диска с подписью на штыре.",
    `Диск ${item.weightKg} кг ставится на штырь «${item.weightKg} кг».`,
  ] : slot === "BANDS" ? [
    "Резинки хранятся отдельно от полок.",
    "Посмотри сбоку стеллажа.",
    "Повесь резинку на боковой крючок.",
  ] : [
    "Сверь предмет с подписями на полках.",
    "Для этого типа инвентаря есть отдельная полка.",
    `Ищи полку «${shelfLabels[slot]}».`,
  ];
  return { id: item.weightKg === undefined ? "inventory-" + slot : "inventory-plates",
    steps, highlight: slot, demo: "Могу показать место для этого предмета." };
}
