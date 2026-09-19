/**
 * stageSignal.ts — where the participant has got to, for the few things OUTSIDE the flow that need
 * to know.
 *
 * WHY THIS EXISTS. `ExperimentFlow` owns the stage and keeps it in its own state, but the
 * light/dark toggle is rendered by `App` above the flow, so it can never be handed that state
 * without threading a prop through every screen. It needs one fact only — has the participant
 * reached Block 5 — and this module is that one fact, in one place, so a stage rename cannot leave
 * two lists disagreeing.
 *
 * It holds no React state and imports nothing. The flow ANNOUNCES each stage as it saves it; anyone
 * who cares subscribes, and anyone mounting late reads the saved stage instead.
 */

/** Where the current stage is saved, so a refresh resumes on the same screen. */
export const STAGE_STORAGE_KEY = "experiment_flow_stage";

/** Fired on `window` whenever the flow moves to a stage worth remembering. `detail` is the stage. */
export const STAGE_CHANGED_EVENT = "vrds:stage-changed";

/**
 * Block 5 and everything after it.
 *
 * `transition_final_block5` is here as well even though the flow never saves a transition stage:
 * an announcement of it is still the moment Block 5 begins, and a reader of this list should not
 * have to know which stages are skipped to understand where the line is.
 */
const BLOCK5_AND_LATER: readonly string[] = [
  "transition_final_block5",
  "block5_intro",
  "block5",
  "transition_block5_summary",
  "block5_summary",
  "feedback",
];

/** True once the participant is in Block 5 or past it. Unknown or missing stages read as false. */
export function isBlock5OrLater(stage: string | null | undefined): boolean {
  return !!stage && BLOCK5_AND_LATER.includes(stage);
}

/** The stage this browser last saved, or null before the study starts. */
export function savedStage(): string | null {
  try {
    return localStorage.getItem(STAGE_STORAGE_KEY);
  } catch {
    return null; // storage blocked: callers fall back to their own default
  }
}

/** Tell anyone listening that the flow has moved. Never throws: this is a courtesy, not a channel. */
export function announceStage(stage: string): void {
  try {
    window.dispatchEvent(new CustomEvent(STAGE_CHANGED_EVENT, { detail: stage }));
  } catch {
    // ignore
  }
}
