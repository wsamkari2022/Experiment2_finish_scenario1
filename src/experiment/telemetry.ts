/**
 * telemetry.ts — central, low-overhead stage timing for the whole experiment.
 *
 * `ExperimentFlow` marks each content stage start/end as the participant moves through the
 * experiment (one `useEffect` on the stage). We keep a single `StageTimings` object in
 * LocalStorage so timing survives a refresh, then assemble an analysis-ready `timing`
 * summary (clean millisecond numbers) for the feedback record.
 *
 * This file ONLY measures wall-clock time per stage. Per-scenario Block-5 timing, CVR/APA
 * dwell, visit counts and switch counts are captured inside the Block-5 component and stored
 * on the Block-5 results — telemetry.ts does not touch Block-5 scoring or scenarios.
 */

/** LocalStorage key for the raw stage-timing object. */
export const TELEMETRY_KEY = "vrds_stage_timings";

/** The content stages we time (transition spinners are intentionally not timed). */
export type TelemetryStage =
  | "money"
  | "trolley"
  | "product"
  | "insights"
  | "block4"
  | "final_analysis"
  | "block5"
  | "block5_summary"
  | "feedback";

/** Stages that should be timed; anything else passed in is ignored (e.g. transition spinners). */
const TIMED_STAGES: TelemetryStage[] = [
  "money", "trolley", "product", "insights", "block4",
  "final_analysis", "block5", "block5_summary", "feedback",
];

interface StageRecord {
  startedAt?: number;   // epoch ms of the first time this stage was entered
  lastEnteredAt?: number; // epoch ms of the most recent entry (for accumulation)
  endedAt?: number;     // epoch ms of the most recent exit
  durationMs: number;   // accumulated visible time (handles re-entries via refresh/back)
}

interface StageTimings {
  firstStartedAt?: number;   // epoch ms the experiment began (first stage start)
  lastEventAt?: number;      // epoch ms of the most recent mark (start or end)
  stages: Partial<Record<TelemetryStage, StageRecord>>;
}

/** Maps a telemetry stage to its output key in the feedback record's `timing` block. */
const TIMING_OUTPUT_KEY: Record<TelemetryStage, string> = {
  money: "block1Ms",
  trolley: "block2Ms",
  product: "block3Ms",
  insights: "insightsMs",
  block4: "block4Ms",
  final_analysis: "finalAnalysisMs",
  block5: "block5TotalMs",
  block5_summary: "summaryMs",
  feedback: "feedbackMs",
};

/**
 * Reads the timing ledger, returning an empty one on first use or on anything unusable.
 *
 * THE SHAPE IS CHECKED, NOT ASSUMED.
 *
 * This used to return `JSON.parse(raw)` directly, which is safe only while the stored value has
 * the shape this file expects. Anything else — a ledger written by an older version of the app, a
 * partially written value, a key edited by hand during testing — parses successfully into an
 * object with no `stages`, and the very next line of markStage does `t.stages[stage]` on
 * undefined. That throws during a React effect, which unmounts the whole experiment: the
 * participant gets a blank white page mid-study and cannot continue.
 *
 * The comment on writeTimings already says timing is never worth failing a session over. This is
 * what makes that true on the way in as well as on the way out.
 */
function readTimings(): StageTimings {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StageTimings> | null;
      if (parsed && typeof parsed === "object" && parsed.stages && typeof parsed.stages === "object") {
        return parsed as StageTimings;
      }
    }
  } catch {
    // ignore — start fresh
  }
  return { stages: {} };
}

/** Persists the timing ledger. Silently gives up if storage is unavailable - timing is never
 *  worth failing a participant's session over. */
function writeTimings(t: StageTimings): void {
  try {
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(t));
  } catch {
    // ignore
  }
}

/** True for the nine real stages. Transition spinners are excluded so their seconds are not
 *  attributed to the block on either side of them. */
function isTimedStage(stage: string): stage is TelemetryStage {
  return (TIMED_STAGES as string[]).includes(stage);
}

/**
 * Records a stage entering ("start") or leaving ("end"). Safe to call with any string;
 * non-timed stages (transition spinners) are ignored. Duration accumulates across
 * re-entries so a refresh mid-stage doesn't lose or double-count time.
 */
export function markStage(stage: string, edge: "start" | "end"): void {
  if (!isTimedStage(stage)) return;
  const now = Date.now();
  const t = readTimings();
  const rec: StageRecord = t.stages[stage] ?? { durationMs: 0 };

  if (edge === "start") {
    if (rec.startedAt === undefined) rec.startedAt = now;
    rec.lastEnteredAt = now;
    if (t.firstStartedAt === undefined) t.firstStartedAt = now;
  } else {
    rec.endedAt = now;
    if (rec.lastEnteredAt !== undefined) {
      rec.durationMs += Math.max(0, now - rec.lastEnteredAt);
      rec.lastEnteredAt = undefined;
    }
  }

  t.stages[stage] = rec;
  t.lastEventAt = now;
  writeTimings(t);
}

/** The analysis-ready timing summary stored on the feedback record. All values are ms. */
export interface TimingSummary {
  totalExperimentMs: number;
  block1Ms: number;
  block2Ms: number;
  block3Ms: number;
  block4Ms: number;
  insightsMs: number;
  finalAnalysisMs: number;
  block5TotalMs: number;
  summaryMs: number;
  feedbackMs: number;
  /**
   * Per-Block-5-scenario time in presentation order, filled from the Block-5 results (not from
   * stage timing). This is an ARRAY so the record always covers however many scenarios the deck
   * holds. It previously used fixed scenario1Ms/2Ms/3Ms fields, which silently discarded the
   * timing of any scenario past the third — a data-loss bug once Block 5 grew to five.
   */
  block5: { scenarioMs: number[] };
}

/**
 * Builds the timing summary. `scenarioMsList` is the per-scenario `timeMs` from the
 * Block-5 results (in scenario order); it fills the `block5.scenarioN` fields so the
 * analysis has both the Block-5 total and the per-scenario breakdown.
 */
export function buildTimingSummary(scenarioMsList: number[] = []): TimingSummary {
  const t = readTimings();
  const dur = (stage: TelemetryStage): number => t.stages[stage]?.durationMs ?? 0;

  // Total = span from the very first stage start to the most recent event (whole session).
  const totalExperimentMs =
    t.firstStartedAt !== undefined && t.lastEventAt !== undefined
      ? Math.max(0, t.lastEventAt - t.firstStartedAt)
      : 0;

  return {
    totalExperimentMs,
    block1Ms: dur("money"),
    block2Ms: dur("trolley"),
    block3Ms: dur("product"),
    block4Ms: dur("block4"),
    insightsMs: dur("insights"),
    finalAnalysisMs: dur("final_analysis"),
    block5TotalMs: dur("block5"),
    summaryMs: dur("block5_summary"),
    feedbackMs: dur("feedback"),
    block5: { scenarioMs: [...scenarioMsList] },
  };
}

/** Clears all stage-timing data (called on Start-Over / Finish). */
export function resetTelemetry(): void {
  try {
    localStorage.removeItem(TELEMETRY_KEY);
  } catch {
    // ignore
  }
}

/** Exposed only so callers can reference the output-key map if needed (kept stable for DB). */
export { TIMING_OUTPUT_KEY };
