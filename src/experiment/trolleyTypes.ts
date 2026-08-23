/**
 * trolleyTypes.ts — Block 2 (Trolley Problem) type definitions
 *
 * Block 2 has two sequential phases:
 *   1. Lever phase — how many lives at risk before the participant pulls a lever?
 *   2. Bridge phase — how many lives at risk before the participant pushes someone off a
 *      bridge? Tests whether the DIRECTNESS of the harm changes the decision.
 *
 * Both phases share the same escalating lives-saved ladder (SAVED_LIVES_OPTIONS), and under
 * the current methodology both walk that ladder INDEPENDENTLY from rung 0.
 *
 * METHODOLOGY: originally the bridge phase started at the rung where the lever was accepted
 * (a matched pair) and was skipped when the lever was never accepted. That is switchable —
 * see `blocksLegacyMethodology.ts` for the full rationale and the one-line revert.
 */

/**
 * The escalating ladder of lives that would be saved by acting.
 *
 * CURRENT: both phases start at index 0, so each threshold is measured over the whole
 * ladder and the bridge threshold is free to land above, equal to, or below the lever.
 * ORIGINAL: the bridge phase started at the index where the lever was accepted, which made
 * `bridge >= lever` an artifact of the procedure rather than a finding.
 */
/**
 * BLOCK 2 LADDER — the number of lives that acting would save.
 *
 * Eight rungs from 1 (no net gain — acting kills one to save one) to 10,000. The bottom rung is
 * deliberately a non-dilemma so that anyone acting there is telling us something extreme, and
 * the top is large enough that refusing it is equally informative.
 *
 * BOTH PHASES walk this same ladder from rung 0, independently. Only the ordinal position is
 * used in scoring. Changing the number of rungs changes TROLLEY_STEPS and invalidates the
 * calibration tables in sensitivityCalibration.ts.
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
 * - `startedAtSameValueAsLever` — the number of lives the bridge phase started from.
 *   CURRENT methodology: always the first rung (1), because the bridge starts independently.
 *   ORIGINAL methodology: the lever's accepted value. The field name is kept unchanged so
 *   that previously-collected records stay readable under the same schema.
 * - `consistencyAtSameNumber` — true if the bridge threshold equals the lever threshold.
 *   Under the current methodology this is a genuine comparison of two independently
 *   measured thresholds rather than a check against a shared starting point.
 * - `directnessGap` — bridgeAcceptedValue − leverAcceptedValue, in LIVES. Positive means
 *   more lives were needed to push than to pull. CAN NOW BE NEGATIVE (the participant
 *   pushed at a lower number than they pulled), which the original design made impossible.
 *   Note the lives ladder is highly non-linear (1 → 10,000), so prefer `directnessGapIndex`
 *   for any quantitative analysis.
 * - `directnessGapIndex` — the same gap expressed in LADDER RUNGS (signed, −8…+8). This is
 *   the linear, analysis-ready version of `directnessGap`. A phase refused at every rung
 *   counts as `SAVED_LIVES_OPTIONS.length`, matching the "never accepted" sentinel used by
 *   `toTrolleyComparableIndex` and by the Directness sensitivity in `thresholdTree.ts`.
 * - `directnessDirection` — a plain label for the sign of the gap, so analysis never has to
 *   re-derive it: "aversion" (needed more lives at stake to push), "reverse" (needed fewer —
 *   only observable now that the two phases are independent), or "none" (identical thresholds,
 *   which includes refusing both phases outright). "incomplete" is retained only for records
 *   collected under the ORIGINAL methodology, where the bridge phase could be skipped.
 */
export interface BridgeThresholdResult extends TrolleyThresholdResult {
  scenarioType: "bridge";
  startedAtSameValueAsLever: number | null;
  consistencyAtSameNumber: boolean | null;
  directnessGap: number | null;
  /** Signed gap in ladder rungs (bridgeIndex − leverIndex). Optional: absent on records
   *  collected before this field existed. */
  directnessGapIndex?: number | null;
  /** Sign of the gap as a label. Optional for the same backward-compatibility reason. */
  directnessDirection?: DirectnessDirection;
}

/** Which way the bridge threshold sat relative to the lever threshold. */
export type DirectnessDirection = "aversion" | "none" | "reverse" | "incomplete";

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
  /** Gap in LIVES (may be negative — see BridgeThresholdResult). */
  directnessGap: number | null;
  /** Gap in ladder RUNGS, signed. The analysis-ready form. */
  directnessGapIndex?: number | null;
  /** Sign of the gap as a label. */
  directnessDirection?: DirectnessDirection;
}

/**
 * The complete output of Block 2, saved to localStorage and passed to profileAnalysis.
 *
 * CURRENT methodology: the bridge phase always runs, so `bridgeThreshold` is always
 * present. It stays nullable because records collected under the ORIGINAL methodology —
 * where the bridge was skipped whenever the lever was never accepted — must still parse.
 */
export interface TrolleyBlockResults {
  /** Stable participant/session id — carried on every record for future MongoDB joins. */
  participantId?: string;
  completed: boolean;
  completedAt: string;   // ISO-8601 — when the block was completed (analysis timestamp)
  leverThreshold: LeverThresholdResult;
  bridgeThreshold: BridgeThresholdResult | null;
  summary: TrolleyBlockSummary;
  history: TrolleyChoiceRecord[];
}

/** localStorage key for saving the final Block 2 results. */
export const TROLLEY_RESULTS_STORAGE_KEY = "trolley_block_results";

/** localStorage key for saving mid-block progress (currently unused — Block 2 does not persist mid-block). */
export const TROLLEY_PROGRESS_STORAGE_KEY = "trolley_block_progress";
