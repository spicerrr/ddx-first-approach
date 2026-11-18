import { scenarioVersion, type StationId } from "./scenario";
import type { HintLevel } from "./hints";

type TrainingSource = "club" | "finish";

type AnalyticsEvent =
  | { eventType: "first_approach_exposed" | "first_approach_started" | "first_approach_completed" | "first_approach_skipped" }
  | { eventType: "first_approach_stage_started" | "first_approach_stage_completed"; stage: StationId }
  | { eventType: "first_approach_hint_requested" | "first_approach_demo_opened"; stage: StationId; concept: string }
  | { eventType: "first_approach_hint_level_reached"; stage: StationId; concept: string; hintLevel: Exclude<HintLevel, 0> }
  | { eventType: "training_cta_clicked"; source: TrainingSource; training: "intro" | "smart-start" };

export function track(event: AnalyticsEvent) {
  window.dispatchEvent(new CustomEvent("first-approach-analytics", {
    detail: { ...event, schemaVersion: "2", scenarioVersion, occurredAt: new Date().toISOString() },
  }));
}
