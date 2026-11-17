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
    if (target) {
      const hint = diskHint(barbellLayout(assembly));
      if (hint) return reject(hint);
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
  const mass = (side: BarbellSide) => barbell.props.reduce<number>((sum, item) =>
    sum + (item.kind === "disk" && assembly.disks[side].includes(item.id) ? item.weightKg : 0), 0);
  const leftKg = mass("LEFT");
  const rightKg = mass("RIGHT");
  const totalKg = barbell.shaftKg + leftKg + rightKg;
  const symmetric = leftKg === rightKg;
  return {
    leftKg, rightKg, totalKg, symmetric,
    disksReady: totalKg === barbell.targetKg && symmetric,
    collarCount: barbellSides.filter((side) => assembly.locked[side]).length,
  };
}

export function diskHint({ leftKg, rightKg, totalKg }: ReturnType<typeof barbellLayout>) {
  const missing = barbell.targetKg - totalKg;
  if (totalKg === barbell.targetKg && leftKg !== rightKg) {
    return `${barbell.targetKg} кг уже набрано. На левой стороне ${leftKg} кг дисков, на правой — ${rightKg} кг. Для равновесия нужно по ${(barbell.targetKg - barbell.shaftKg) / 2} кг с каждой стороны.`;
  }
  if (missing > 0) return `До ${barbell.targetKg} кг осталось ${missing} кг. Замки ставим в конце, когда вес набран поровну.`;
  if (missing < 0) return `На грифе на ${-missing} кг больше цели. Если взять диски полегче, получится ближе к нужному весу.`;
  return null;
}

export function checkBarbell(assembly: BarbellAssembly) {
  const layout = barbellLayout(assembly);
  const hint = diskHint(layout);
  if (hint) return { accepted: false, message: hint };
  const { collarCount } = layout;
  if (collarCount !== 2) {
    const mounted = barbellSides.filter((side) => assembly.collars[side]).length;
    return { accepted: false, message: mounted === 2 ? "Диски на месте. Закрой рычажки замков, чтобы их удержать." : "Диски на месте. Надень по замку на каждую сторону и закрой рычажки." };
  }
  return { accepted: true, message: "" };
}
