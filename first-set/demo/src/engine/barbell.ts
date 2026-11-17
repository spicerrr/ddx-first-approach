import { barbell, barbellSides, floorId, type BarbellSide } from "./scenario";

export type BarbellAssembly = {
  disks: Record<BarbellSide, readonly string[]>;
  collars: Partial<Record<BarbellSide, string>>;
  locked: Partial<Record<BarbellSide, true>>;
};

export type BarbellDestination = BarbellSide | typeof floorId;

export function newAssembly(): BarbellAssembly {
  return { disks: { LEFT: [], RIGHT: [] }, collars: {}, locked: {} };
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
    if (source && assembly.locked[source]) return reject("Замок держит диски. Открой рычажок, тогда замок можно будет снять.");
    if (target && assembly.collars[target]) return reject("По одному замку на втулку. Попробуй с другой стороны.");
    if (target && !barbellLayout(assembly).disksReady) {
      return reject(`Замки ставим в конце, чтобы удержать диски. Сначала собери ${barbell.targetKg} кг с одинаковыми дисками с обеих сторон.`);
    }
    const collars = { ...assembly.collars };
    if (source) delete collars[source];
    if (target) collars[target] = id;
    return {
      accepted: true as const,
      assembly: { ...assembly, collars },
      message: "",
    };
  }

  const blockedSide = [source, target].find((side) => side && assembly.collars[side]);
  if (blockedSide) {
    const remove = assembly.locked[blockedSide] ? "Открой рычажок и верни замок в лоток." : "Верни открытый замок в лоток.";
    return reject("Замок держит диски на конце втулки. " + remove + " Затем можно поменять диски.");
  }
  if (source && assembly.disks[source].at(-1) !== id) {
    return reject("Начни с крайнего диска. Его можно стянуть в лоток.");
  }
  if (target && assembly.disks[target].length >= barbell.sleeveCapacity) {
    return reject("На этой втулке уже три диска. Можно собрать тот же вес с более тяжёлыми дисками.");
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
  const totalKg = barbell.shaftKg + leftKg + rightKg;
  const symmetric = left.length === right.length && left.every((kg, index) => kg === right[index]);
  return {
    leftKg, rightKg,
    totalKg,
    symmetric,
    disksReady: totalKg === barbell.targetKg && symmetric,
    collarCount: barbellSides.filter((side) => assembly.locked[side]).length,
  };
}

export function checkBarbell(assembly: BarbellAssembly) {
  const { leftKg, rightKg, totalKg, symmetric, collarCount } = barbellLayout(assembly);
  const missing = barbell.targetKg - totalKg;
  if (missing > 0) return { accepted: false, message: `До ${barbell.targetKg} кг осталось ${missing} кг. Посмотри, как добрать вес одинаковыми дисками с обеих сторон.` };
  if (missing < 0) return { accepted: false, message: `На грифе на ${-missing} кг больше цели. Давай подберём диски полегче.` };
  if (leftKg !== rightKg) {
    return { accepted: false, message: `Общий вес уже подходит. Слева ${leftKg} кг дисков, справа ${rightKg} кг. Давай уравняем стороны.` };
  }
  if (!symmetric) {
    return { accepted: false, message: "Вес с обеих сторон совпал. Давай ещё сверим сами диски. На каждой стороне нужен одинаковый набор." };
  }
  if (collarCount !== 2) {
    const mounted = barbellSides.filter((side) => assembly.collars[side]).length;
    return { accepted: false, message: mounted === 2 ? "Диски на месте. Закрой рычажки замков, чтобы их удержать." : "Диски на месте. Надень по замку на каждую сторону и закрой рычажки." };
  }
  return { accepted: true, message: "" };
}
