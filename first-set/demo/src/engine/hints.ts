export type HintLevel = 0 | 1 | 2 | 3 | 4;
export type HintRule = {
  id: string;
  steps: readonly [string, string, string];
  highlight?: string;
  demo?: string;
};

export type RuleProgress = {
  mistakeCount: number;
  hintLevel: HintLevel;
  hintRequested: boolean;
  demoOpened: boolean;
  resolved: boolean;
};

export type CoachLine = {
  text: string;
  tone: "task" | "hint" | "success";
  level?: HintLevel;
  highlight?: string;
  demo?: boolean;
};

export type CoachState = {
  rules: Record<string, RuleProgress>;
  active?: HintRule;
  line?: CoachLine;
};

export function newCoachState(): CoachState {
  return { rules: {} };
}

const unseen: RuleProgress = {
  mistakeCount: 0, hintLevel: 0, hintRequested: false, demoOpened: false, resolved: false,
};

export function showHint(state: CoachState, rule: HintRule, requested: boolean): CoachState {
  const previous = state.rules[rule.id] ?? unseen;
  const hintLevel = Math.min(previous.hintLevel + 1, rule.demo ? 4 : 3) as 1 | 2 | 3 | 4;
  const updated = {
    ...previous, hintLevel, hintRequested: previous.hintRequested || requested,
    mistakeCount: previous.mistakeCount + Number(!requested), resolved: false,
  };
  return {
    rules: { ...state.rules, [rule.id]: updated }, active: rule,
    line: {
      text: hintLevel === 4 ? rule.demo! : rule.steps[hintLevel - 1],
      tone: "hint", level: hintLevel,
      highlight: hintLevel >= 3 ? rule.highlight : undefined,
      demo: hintLevel === 4,
    },
  };
}

export function openDemo(state: CoachState, rule: HintRule): CoachState {
  const previous = state.rules[rule.id] ?? unseen;
  return {
    ...state,
    rules: { ...state.rules, [rule.id]: { ...previous, demoOpened: true } },
  };
}

export function moveCoach(state: CoachState, line: CoachLine | undefined, resolved: readonly string[] = []): CoachState {
  const rules = { ...state.rules };
  for (const id of resolved) rules[id] = { ...(rules[id] ?? unseen), resolved: true };
  return { rules, line };
}
