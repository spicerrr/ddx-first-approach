import { useState } from "react";
import { moveCoach, newCoachState, openDemo, showHint, type CoachLine, type HintRule } from "../engine/hints";

export function useCoach() {
  const [state, setState] = useState(newCoachState);
  const [activity, setActivity] = useState(0);
  function act() {
    setActivity((count) => count + 1);
  }
  return {
    line: state.line,
    active: state.active,
    activity,
    act,
    reset: () => setState(newCoachState()),
    mistake: (rule: HintRule) => setState((previous) => showHint(previous, rule, false)),
    request: (rule: HintRule) => {
      act();
      setState((previous) => showHint(previous, rule, true));
    },
    demo: (rule: HintRule) => {
      act();
      setState((previous) => openDemo(previous, rule));
    },
    resolve: (ids: readonly string[]) => setState((previous) => moveCoach(previous, previous.line, ids)),
    say: (text: string, tone: CoachLine["tone"] = "task", resolved: readonly string[] = []) =>
      setState((previous) => moveCoach(previous, { text, tone }, resolved)),
  };
}

export type Coach = ReturnType<typeof useCoach>;
