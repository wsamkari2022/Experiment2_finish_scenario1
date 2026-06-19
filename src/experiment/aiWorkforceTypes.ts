/**
 * aiWorkforceTypes.ts — Block 3 (AI Workforce Rollout) type definitions
 *
 * Block 3 asks: "At what level of financial gain would you approve an AI rollout
 * that causes serious job displacement?" The scenario is varied across two worker
 * group types and three group sizes, producing a 2×3 matrix of threshold results.
 *
 * Naming note: this block was originally called "Product Launch". The types file
 * productLaunchTypes.ts still exists for backwards compatibility with stored data
 * and profileAnalysis.ts. New code should use this file.
 */

/** The two worker group classifications tested in Block 3. */
export type WorkerGroupKey = "low_buffer" | "high_buffer";

/** The three group size tiers tested in Block 3. */
export type WorkerGroupSizeKey = "small" | "medium" | "large";

/** The two approval actions available to the participant. */
export type RolloutAction = "approve" | "do_not_approve";

/** A single entry in the financial gain ladder. */
export interface GainOption {
  value: number;   // numeric (e.g. 1_000_000)
  label: string;   // display (e.g. "$1 million")
}

/** Definition of a worker group type, including the hover-card definition shown to participants. */
export interface WorkerGroupOption {
  key: WorkerGroupKey;
  label: string;        // full sentence used inline (e.g. "low-buffer workers with limited alternatives")
  shortLabel: string;   // short form for the info hover card header
  definition: string;   // definition text shown in the hover card
}

/** Definition of a group size tier. */
export interface WorkerGroupSizeOption {
  key: WorkerGroupSizeKey;
  label: string;        // full sentence used inline (e.g. "small group of about 10 workers")
  shortLabel: string;   // compact label used in summary tables
  count: number;        // approximate number of affected workers
}

/**
 * The six escalating financial gain levels tested in Block 3.
 * The scenario starts at $1M and escalates when the participant declines.
 * When a participant approves, the accepted index carries forward to the next
 * group size (same group type) — so the block does not restart from $1M for each cell.
 */
export const GAIN_OPTIONS: readonly GainOption[] = [
  { value: 1_000_000,   label: "$1 million" },
  { value: 5_000_000,   label: "$5 million" },
  { value: 10_000_000,  label: "$10 million" },
  { value: 25_000_000,  label: "$25 million" },
  { value: 50_000_000,  label: "$50 million" },
  { value: 100_000_000, label: "$100 million" },
];

/**
 * The two worker group types. Presented in this order: low_buffer first, then high_buffer.
 * Low-buffer workers have fewer savings and fewer job alternatives — they absorb job
 * displacement with more difficulty than high-buffer workers.
 */
export const WORKER_GROUPS: readonly WorkerGroupOption[] = [
  {
    key: "low_buffer",
    label: "low-buffer workers with limited alternatives",
    shortLabel: "Low-buffer workers",
    definition:
      "Workers who have less savings or financial reserve, and fewer realistic job alternatives if their current work is reduced or replaced.",
  },
  {
    key: "high_buffer",
    label: "high-buffer workers with stronger alternatives",
    shortLabel: "High-buffer workers",
    definition:
      "Workers who have more savings or financial reserve, and stronger realistic job alternatives if their current work is reduced or replaced.",
  },
];

/**
 * Disclaimer shown alongside the worker group info icon.
 * Clarifies that "buffer" is about financial resilience, not personal worth.
 */
export const WORKER_GROUP_DISCLAIMER =
  "These terms describe how much disruption a worker can absorb if their job changes. They are not judgments about personal worth.";

/**
 * The three group sizes, presented in this order within each worker group type.
 * The gain index carries forward from size to size within a group type:
 * if a participant approved at $10M for a small group, the medium group starts at $10M.
 */
export const WORKER_GROUP_SIZES: readonly WorkerGroupSizeOption[] = [
  {
    key: "small",
    label: "small group of about 10 workers",
    shortLabel: "Small (~10)",
    count: 10,
  },
  {
    key: "medium",
    label: "medium group of about 1,000 workers",
    shortLabel: "Medium (~1,000)",
    count: 1000,
  },
  {
    key: "large",
    label: "large group of about 100,000 workers",
    shortLabel: "Large (~100,000)",
    count: 100000,
  },
];

/**
 * The fixed harm description used in every Block 3 scenario sentence.
 * The gain amount, worker group type, and group size vary; this phrase is constant.
 */
export const FIXED_HARM_PHRASE =
  "serious job displacement, reduced work opportunities, and financial instability";

/**
 * The threshold result for a single (worker group type × group size) cell.
 *
 * Three outcomes are possible:
 * 1. `accepted: true`  → participant approved at `thresholdGainIndex`
 * 2. `accepted: false` + `thresholdBeyondRange: true` → participant rejected even $100M
 * 3. `accepted: false` + `blockedByPriorNonAcceptance: true` → this cell was never shown
 *    because a smaller group size was already beyond range (blocking logic)
 */
export interface AIWorkforceThresholdResult {
  groupTypeKey: WorkerGroupKey;
  groupTypeLabel: string;
  groupSizeKey: WorkerGroupSizeKey;
  groupSizeLabel: string;
  groupSizeCount: number;
  accepted: boolean;
  thresholdGain: number | null;           // null when not accepted
  thresholdGainLabel: string | null;      // null when not accepted
  thresholdGainIndex: number | null;      // 0-based index into GAIN_OPTIONS; null when not accepted
  thresholdBeyondRange: boolean;          // true when all gains were rejected
  blockedByPriorNonAcceptance: boolean;   // true when cell was skipped due to blocking logic
  startedAtGainIndex: number;             // the gain index this cell began testing from (carry-forward)
}

/**
 * A single choice record written to history on every button click in Block 3.
 * Records the full scenario state at the time of the choice.
 */
export interface AIWorkforceChoiceRecord {
  groupTypeKey: WorkerGroupKey;
  groupTypeLabel: string;
  groupSizeKey: WorkerGroupSizeKey;
  groupSizeLabel: string;
  groupSizeCount: number;
  gainIndex: number;    // index into GAIN_OPTIONS at time of choice
  gainValue: number;
  gainLabel: string;
  action: RolloutAction;
  timestamp: string;    // ISO-8601
}

/**
 * The 6 keys for the threshold map, one per (worker group × group size) cell.
 * Key format: threshold_<grouptype>_<groupsize> with underscores removed from group type.
 */
export type AIWorkforceThresholdKey =
  | "threshold_lowbuffer_small"
  | "threshold_lowbuffer_medium"
  | "threshold_lowbuffer_large"
  | "threshold_highbuffer_small"
  | "threshold_highbuffer_medium"
  | "threshold_highbuffer_large";

/** The complete 2×3 matrix of threshold results. */
export type AIWorkforceThresholdsMap = Record<
  AIWorkforceThresholdKey,
  AIWorkforceThresholdResult
>;

/**
 * The complete output of Block 3, saved to localStorage and passed to the analysis pipeline.
 * `thresholds` is a full 6-cell matrix; every cell is always present (either accepted,
 * beyond range, or blocked) when `completed: true`.
 */
export interface AIWorkforceBlockResults {
  completed: boolean;
  completedAt: string;   // ISO-8601
  thresholds: AIWorkforceThresholdsMap;
  history: AIWorkforceChoiceRecord[];
}

/**
 * Derives the AIWorkforceThresholdKey for a given (groupType, groupSize) pair.
 * Example: aiWorkforceThresholdKeyFor("low_buffer", "small") → "threshold_lowbuffer_small"
 */
export function aiWorkforceThresholdKeyFor(
  groupType: WorkerGroupKey,
  groupSize: WorkerGroupSizeKey,
): AIWorkforceThresholdKey {
  const gt = groupType === "low_buffer" ? "lowbuffer" : "highbuffer";
  return `threshold_${gt}_${groupSize}` as AIWorkforceThresholdKey;
}

/** localStorage key for saving the final Block 3 results. */
export const AI_WORKFORCE_RESULTS_KEY = "ai_workforce_block_results";

/** localStorage key for saving the mid-block in-progress state (enables resume after page refresh). */
export const AI_WORKFORCE_PROGRESS_KEY = "ai_workforce_block_progress";

/**
 * Legacy alias key used by toProductLaunchShape() to write a ProductLaunchBlockResults-
 * shaped copy of the results for backwards compatibility with profileAnalysis.ts.
 */
export const AI_WORKFORCE_LEGACY_ALIAS_KEY = "product_launch_block_results";
