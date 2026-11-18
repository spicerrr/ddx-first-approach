import { useState } from "react";
import { track } from "../engine/analytics";
import { moveCoach, newCoachState, openDemo, showHint, type CoachLine, type HintRule } from "../engine/hints";
import type { StationId } from "../engine/scenario";

export function useCoach(stage: StationId) {
  const [state, setState] = useState(newCoachState);
  const [activity, setActivity] = useState(0);
  function act() {
    setActivity((count) => count + 1);
  }

  function hint(rule: HintRule, requested: boolean) {
    const next = showHint(state, rule, requested);
    setState(next);
    if (requested) track({ eventType: "first_approach_hint_requested", stage, concept: rule.id });
    const level = next.rules[rule.id].hintLevel;
    if (level !== 0 && level !== state.rules[rule.id]?.hintLevel) {
      track({ eventType: "first_approach_hint_level_reached", stage, concept: rule.id, hintLevel: level });
    }
  }

  return {
    line: state.line,
    active: state.active,
    rules: state.rules,
    activity,
    act,
    reset: () => setState(newCoachState()),
    mistake: (rule: HintRule) => hint(rule, false),
    request: (rule: HintRule) => {
      act();
      hint(rule, true);
    },
    demo: (rule: HintRule) => {
      act();
      setState((previous) => openDemo(previous, rule));
      track({ eventType: "first_approach_demo_opened", stage, concept: rule.id });
    },
    resolve: (ids: readonly string[]) => setState((previous) => moveCoach(previous, previous.line, ids)),
    say: (text: string, tone: CoachLine["tone"] = "task", resolved: readonly string[] = []) =>
      setState((previous) => moveCoach(previous, { text, tone }, resolved)),
  };
}

export type Coach = ReturnType<typeof useCoach>;
