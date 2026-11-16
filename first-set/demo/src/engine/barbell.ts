import { barbell } from "./scenario";

export function barbellLayout(placements: Readonly<Record<string, string>>) {
  const left: number[] = [];
  const right: number[] = [];
  for (const item of barbell.items) {
    if (placements[item.id] === "LEFT") left.push(item.weightKg);
    if (placements[item.id] === "RIGHT") right.push(item.weightKg);
  }
  const leftKg = barbell.startingDiskKg + left.reduce((sum, kg) => sum + kg, 0);
  const rightKg = barbell.startingDiskKg + right.reduce((sum, kg) => sum + kg, 0);
  left.sort((a, b) => a - b);
  right.sort((a, b) => a - b);
  return {
    leftKg, rightKg,
    totalKg: barbell.shaftKg + leftKg + rightKg,
    symmetric: left.length === right.length && left.every((kg, index) => kg === right[index]),
  };
}

export function checkBarbell(placements: Readonly<Record<string, string>>) {
  const { leftKg, rightKg, totalKg, symmetric } = barbellLayout(placements);
  const missing = barbell.targetKg - totalKg;
  if (missing > 0) return { accepted: false, message: `До цели не хватает ${missing} кг.` };
  if (missing < 0) return { accepted: false, message: `Убери ${-missing} кг, чтобы получить ${barbell.targetKg} кг.` };
  if (leftKg !== rightKg) {
    return { accepted: false, message: `Целевой вес набран. Слева ${leftKg} кг дисков, справа ${rightKg} кг. Уравняй стороны.` };
  }
  if (!symmetric) {
    return { accepted: false, message: "Масса сторон совпала. Собери одинаковые наборы дисков слева и справа." };
  }
  return { accepted: true, message: "Вес и набор дисков совпадают." };
}
