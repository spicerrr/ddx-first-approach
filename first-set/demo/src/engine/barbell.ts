import { barbell, barbellSides, floorId, type BarbellSide } from "./scenario";

export type BarbellAssembly = {
  disks: Record<BarbellSide, readonly string[]>;
  collars: Partial<Record<BarbellSide, string>>;
  locked: Partial<Record<BarbellSide, true>>;
};

export type BarbellDestination = BarbellSide | typeof floorId;

export function newAssembly(): BarbellAssembly {
  return { disks: { LEFT: ["DISK_20_A"], RIGHT: ["DISK_20_B"] }, collars: {}, locked: {} };
}

export function moveBarbell(assembly: BarbellAssembly, id: string, destination: BarbellDestination) {
  const prop = barbell.props.find((item) => item.id === id);
  const reject = (message: string) => ({ accepted: false as const, message });
  if (!prop || (destination !== floorId && !barbellSides.includes(destination))) {
    return reject("Попробуй перенести предмет на втулку или в лоток.");
  }

  const source = barbellSides.find((side) => prop.kind === "disk"
    ? assembly.disks[side].includes(id)
    : assembly.collars[side] === id);
  const target = destination === floorId ? undefined : destination;
  if (source === target) return reject("");

  if (prop.kind === "collar") {
    if (source && assembly.locked[source]) return reject("Открой защёлку на замке, затем сдвинь его в лоток.");
    if (target && assembly.collars[target]) return reject("На этой стороне уже есть замок.");
    const collars = { ...assembly.collars };
    if (source) delete collars[source];
    if (target) collars[target] = id;
    return {
      accepted: true as const,
      assembly: { ...assembly, collars },
      message: "",
    };
  }

  if ((source && assembly.collars[source]) || (target && assembly.collars[target])) {
    return reject("Сначала сдвинь замок с этой втулки в лоток.");
  }
  if (source && assembly.disks[source].at(-1) !== id) {
    return reject("Начни с крайнего диска. Его можно стянуть в лоток.");
  }
  if (target && assembly.disks[target].length >= barbell.sleeveCapacity) {
    return reject("Втулка заполнена. Оставь место для замка.");
  }

  const disks = { ...assembly.disks };
  if (source) disks[source] = disks[source].slice(0, -1);
  if (target) disks[target] = [...disks[target], id];
  return { accepted: true as const, assembly: { ...assembly, disks }, message: "" };
}

export function toggleCollar(assembly: BarbellAssembly, side: BarbellSide): BarbellAssembly | null {
  if (!assembly.collars[side]) return null;
  const locked = { ...assembly.locked };
  if (locked[side]) delete locked[side];
  else locked[side] = true;
  return { ...assembly, locked };
}

export function barbellLayout(assembly: BarbellAssembly) {
  const weights = (side: BarbellSide) => barbell.props.flatMap((item) =>
    item.kind === "disk" && assembly.disks[side].includes(item.id) ? [item.weightKg] : [],
  ).sort((a, b) => a - b);
  const left = weights("LEFT");
  const right = weights("RIGHT");
  const leftKg = left.reduce<number>((sum, kg) => sum + kg, 0);
  const rightKg = right.reduce<number>((sum, kg) => sum + kg, 0);
  return {
    leftKg, rightKg,
    totalKg: barbell.shaftKg + leftKg + rightKg,
    symmetric: left.length === right.length && left.every((kg, index) => kg === right[index]),
    collarCount: barbellSides.filter((side) => assembly.locked[side]).length,
  };
}

export function checkBarbell(assembly: BarbellAssembly) {
  const { leftKg, rightKg, totalKg, symmetric, collarCount } = barbellLayout(assembly);
  const missing = barbell.targetKg - totalKg;
  if (missing > 0) return { accepted: false, message: "До цели не хватает " + missing + " кг." };
  if (missing < 0) return { accepted: false, message: "Убери " + -missing + " кг, чтобы получить " + barbell.targetKg + " кг." };
  if (leftKg !== rightKg) {
    return { accepted: false, message: "Целевой вес набран. Слева " + leftKg + " кг дисков, справа " + rightKg + " кг. Уравняй стороны." };
  }
  if (!symmetric) {
    return { accepted: false, message: "Вес сторон совпал. Подбери одинаковые наборы дисков для обеих сторон." };
  }
  if (collarCount !== 2) {
    const mounted = barbellSides.filter((side) => assembly.collars[side]).length;
    return { accepted: false, message: mounted === 2 ? "Нажми на рычажок каждого открытого замка, чтобы защёлкнуть его." : "Надень по замку на каждый конец грифа, затем защёлкни оба замка." };
  }
  return { accepted: true, message: "" };
}
