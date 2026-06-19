/**
 * trolleyTypes.ts — Block 2 (Trolley Problem) type definitions
 *
 * Block 2 has two sequential phases:
 *   1. Lever phase — how many lives at risk before the participant pulls a lever?
 *   2. Bridge phase — at the *same* number found in the lever phase, will the participant
 *      push someone off a bridge? Tests whether the directness of the harm changes the decision.
 *
 * Both phases share the same escalating lives-saved ladder (SAVED_LIVES_OPTIONS).
 */

/**
 * The escalating ladder of lives that would be saved by acting.
 * The lever phase starts at index 0; the bridge phase starts at the index
 * where the lever was accepted (so both scenarios test the same threshold).
 */
export const SAVED_LIVES_OPTIONS: readonly number[] = [
  1, 2, 5, 10, 50, 100, 1000, 10000,
];

/**
 * Which of the two sub-scenarios is currently active.
 * "complete" is an internal sentinel — the UI never renders in this state.
 */
export type TrolleyPhase = "lever" | "bridge" | "complete";

/** Actions available in the lever phase. */
export type LeverAction = "pull" | "do_not_pull";

/** Actions available in the bridge phase. */
export type BridgeAction = "push" | "do_not_push";

/** Union of all trolley actions (used in TrolleyChoiceRecord). */
export type TrolleyAction = LeverAction | BridgeAction;

/**
 * Shared base for both phase threshold results.
 * - `accepted: true`  → the participant acted at `thresholdSavedLives`
 * - `accepted: false` + `thresholdBeyondRange: true` → never acted even at 10,000 lives
 */
export interface TrolleyThresholdResult {
  accepted: boolean;
  thresholdSavedLives: number | null;
  thresholdIndex: number | null;      // 0-based index into SAVED_LIVES_OPTIONS
  thresholdBeyondRange: boolean;
}

/** Lever phase threshold — extends base with scenario type discriminant. */
export interface LeverThresholdResult extends TrolleyThresholdResult {
  scenarioType: "lever";
}

/**
 * Bridge phase threshold — extends base with comparison data relative to the lever result.
 * - `startedAtSameValueAsLever` — the number of lives the bridge phase started from
 *   (equal to the lever accepted value; included for clarity in output)
 * - `consistencyAtSameNumber` — true if the bridge was also accepted at the same number
 *   as the lever (no directness aversion at that specific count)
 * - `directnessGap` — bridgeAcceptedValue − leverAcceptedValue; positive means the
 *   participant needed more lives at risk to push than to pull
 */
export interface BridgeThresholdResult extends TrolleyThresholdResult {
  scenarioType: "bridge";
  startedAtSameValueAsLever: number | null;
  consistencyAtSameNumber: boolean | null;
  directnessGap: number | null;
}

/** A single choice record written to history on every button click in either phase. */
export interface TrolleyChoiceRecord {
  phase: "lever" | "bridge";
  savedLivesIndex: number;   // index into SAVED_LIVES_OPTIONS at time of choice
  savedLivesValue: number;   // numeric value at time of choice
  action: TrolleyAction;
  timestamp: string;         // ISO-8601
}

/**
 * High-level summary derived from both phase thresholds.
 * Included in TrolleyBlockResults for quick access by analysis functions.
 */
export interface TrolleyBlockSummary {
  leverAcceptedValue: number | null;
  bridgeAcceptedValue: number | null;
  consistencyAtSameNumber: boolean | null;
  directnessGap: number | null;
}

/**
 * The complete output of Block 2, saved to localStorage and passed to profileAnalysis.
 * `bridgeThreshold` is null only when the lever was never accepted (beyond range),
 * in which case the bridge phase is skipped entirely.
 */
export interface TrolleyBlockResults {
  completed: boolean;
  completedAt: string;   // ISO-8601
  leverThreshold: LeverThresholdResult;
  bridgeThreshold: BridgeThresholdResult | null;
  summary: TrolleyBlockSummary;
  history: TrolleyChoiceRecord[];
}

/** localStorage key for saving the final Block 2 results. */
export const TROLLEY_RESULTS_STORAGE_KEY = "trolley_block_results";

/** localStorage key for saving mid-block progress (currently unused — Block 2 does not persist mid-block). */
export const TROLLEY_PROGRESS_STORAGE_KEY = "trolley_block_progress";
