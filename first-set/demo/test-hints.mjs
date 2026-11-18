import { expect, it } from "vitest";
import { moveCoach, newCoachState, openDemo, showHint } from "./src/engine/hints";

it("продвигает только запрошенное правило, учитывает показ и закрывает подсказку после исправления", () => {
  const rule = { id: "pair12", steps: ["Осмотрись.", "Сравни веса.", "Между 10 и 14 кг."], highlight: "RACK_12", demo: "Посмотри пример." };
  const other = { id: "pair16", steps: ["Посмотри на стойку.", "Сравни веса.", "Справа от 14 кг."] };
  const first = showHint(newCoachState(), rule, false);
  expect(first.line).toMatchObject({ level: 1, tone: "hint", highlight: undefined });
  const second = showHint(first, rule, true);
  expect(second.rules.pair12).toMatchObject({ hintLevel: 2, mistakeCount: 1, hintRequested: true });
  const third = showHint(second, rule, false);
  expect(third.line.highlight).toBe("RACK_12");
  const fourth = showHint(third, rule, true);
  expect(fourth.line).toMatchObject({ level: 4, demo: true });
  const fixed = moveCoach(openDemo(fourth, rule), { text: "Пара на месте.", tone: "success" }, [rule.id]);
  expect(fixed.active).toBeUndefined();
  expect(fixed.line).toMatchObject({ tone: "success", text: "Пара на месте." });
  expect(fixed.rules.pair12).toMatchObject({ resolved: true, demoOpened: true, mistakeCount: 2 });
  expect(showHint(fixed, other, false).line.level).toBe(1);
});
