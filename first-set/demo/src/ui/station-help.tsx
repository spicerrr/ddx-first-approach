import { createContext, useContext, useEffect, useState } from "react";
import type { HintRule } from "../engine/hints";
import { Icon } from "./graphics";
import { SceneButton } from "./scene-button";
import type { Coach } from "./use-coach";

export type Example = { item: string; destination: string; caption: string };
export type HelpOptions = {
  hint?: () => void;
  demo?: () => void;
};
export type HelpContext = { open: (options: HelpOptions) => void; showExample: (example: Example) => void; paused: boolean };
export const GameHelp = createContext<HelpContext | null>(null);

export function AssistControls({ coach, rule, example, demo }: {
  coach: Coach; rule?: HintRule; example?: Omit<Example, "caption">; demo?: () => void;
}) {
  const help = useContext(GameHelp);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(false);
    if (!rule || !help || help.paused) return;
    const timeout = window.setTimeout(() => setIdle(true), 13_500);
    return () => window.clearTimeout(timeout);
  }, [coach.activity, rule?.id, help?.paused]);
  if (!help) return null;

  const hint = rule ? () => coach.request(rule) : undefined;
  const sample = rule && example ? { ...example, caption: rule.steps[2] } : undefined;
  function reveal() {
    if (rule) coach.demo(rule);
    if (demo) demo();
    else if (sample) help?.showExample(sample);
  }
  const offerDemo = coach.line?.demo && sample && !demo;

  return (
    <div className="coach-controls">
      {(offerDemo || hint && idle && !coach.line?.demo) && (
        <SceneButton type="button" className="coach-optional" onActivate={offerDemo ? reveal : hint!}>
          {offerDemo ? "Показать приём" : "Нужна подсказка?"}
        </SceneButton>
      )}
      <SceneButton type="button" className="coach-help" aria-label="Помощь" aria-haspopup="dialog"
        onActivate={() => help.open({ hint, demo: demo || sample ? reveal : undefined })}>
        <Icon name="help" size={21} />
      </SceneButton>
    </div>
  );
}

export function HintExample({ example }: { example: Example }) {
  return (
    <figure className="hint-example">
      <div className="hint-diagram" aria-hidden="true">
        <img src={example.item} alt="" />
        <Icon name="arrow" size={22} />
        <img src={example.destination} alt="" />
      </div>
      <figcaption>{example.caption}</figcaption>
    </figure>
  );
}
