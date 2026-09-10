/**
 * aiWorkforceTypes.ts — Block 3 (AI Workforce Rollout) type definitions
 *
 * Block 3 asks: "At what level of financial gain would you approve an AI rollout
 * that causes serious job displacement?" The scenario is varied across two worker
 * group types and three group sizes, producing a 2×3 matrix of threshold results.
 *
 * Naming note: this block was originally called "Product Launch". That legacy
 * vocabulary and the productLaunchTypes file have been fully removed — this is now
 * the only Block-3 type module (Approved Change 1).
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
  label: string;        // used inline in the scenario sentence (e.g. "entry-level workers")
  shortLabel: string;   // short form for the info hover card header
  /** One-line gloss shown next to shortLabel in the terms panel. */
  tagline: string;
  definition: string;   // definition text shown in the hover card
}

/** Definition of a group size tier. */
export interface WorkerGroupSizeOption {
  key: WorkerGroupSizeKey;
  label: string;        // head-count phrase used inline (e.g. "group of about 10 workers")
  shortLabel: string;   // compact label used in summary tables
  count: number;        // approximate number of affected workers
}

/**
 * The six escalating financial gain levels tested in Block 3. Every cell of the
 * (worker group x group size) matrix starts at the FIRST rung and escalates only when the
 * participant declines — see `blocksLegacyMethodology.ts`.
 *
 * The ladder spans eight orders of magnitude ($1 -> $100M) so that it brackets the whole
 * plausible range: the first rung is deliberately trivial, which makes an approval there a
 * strong signal that the harm barely registers, while the top rung is large enough that
 * refusing it is an equally strong signal in the other direction.
 *
 * SCORING NOTE: every downstream calculation uses the ORDINAL INDEX of the rung (0..5),
 * never the dollar figure — see `toGainComparableIndex` in aiWorkforceAnalysis.ts. The
 * rungs are treated as six evenly-spaced steps. Do NOT average or subtract `thresholdGain`
 * dollar values; on a ladder this skewed the result would be meaningless.
 */
export const GAIN_OPTIONS: readonly GainOption[] = [
  { value: 1,           label: "$1" },
  { value: 10_000,      label: "$10,000" },
  { value: 100_000,     label: "$100,000" },
  { value: 1_000_000,   label: "$1 million" },
  { value: 10_000_000,  label: "$10 million" },
  { value: 100_000_000, label: "$100 million" },
];

/**
 * The two worker group types, presented in this order: the more replaceable group first.
 *
 * The contrast is SENIORITY / REPLACEABILITY: entry-level workers hold junior or routine
 * roles that an AI system can take over with little difficulty, while senior-level workers
 * are experienced specialists — including the engineers who build the AI itself — whose
 * expertise is hard to replace. Entry-level workers therefore absorb job displacement with
 * more difficulty, which is what makes them the more vulnerable group in this block.
 *
 * NAMING NOTE — the internal keys are still `low_buffer` and `high_buffer`, and the stored
 * threshold keys are still `threshold_lowbuffer_*` / `threshold_highbuffer_*`. Only the
 * participant-facing wording changed. The mapping is:
 *
 *     low_buffer   ->  "entry-level workers"    (more replaceable, more vulnerable)
 *     high_buffer  ->  "senior-level workers"   (less replaceable, less vulnerable)
 *
 * The keys were deliberately left alone so that already-saved records, the analysis helpers
 * (`avgLowBufferIndex` / `avgHighBufferIndex`) and the vulnerability formula in
 * thresholdTree.ts all keep working unchanged. Keep this mapping in mind when reading
 * exported data.
 */
export const WORKER_GROUPS: readonly WorkerGroupOption[] = [
  {
    key: "low_buffer",
    label: "entry-level workers",
    shortLabel: "Entry-level workers",
    tagline: "junior or routine roles that AI can readily take over",
    definition:
      "Workers in junior or routine roles that an AI system can take over with little difficulty. They usually have less savings or financial reserve, and fewer realistic job alternatives if their current work is reduced or replaced.",
  },
  {
    key: "high_buffer",
    label: "senior-level workers",
    shortLabel: "Senior-level workers",
    tagline: "experienced specialists, such as the engineers who build AI systems",
    definition:
      "Experienced specialists — for example, the engineers who design and maintain these AI systems. Their expertise is difficult to replace, and they usually have more savings or financial reserve, and stronger realistic job alternatives if their current work is reduced or replaced.",
  },
];

/**
 * Disclaimer shown alongside the worker group info icon. Clarifies that the terms describe
 * how replaceable a ROLE is and how much disruption a worker can absorb — not the personal
 * worth of the people in it.
 */
export const WORKER_GROUP_DISCLAIMER =
  "These terms describe how easily a role can be taken over by an AI system, and how much disruption a worker can absorb if their job changes. They are not judgments about personal worth.";

/**
 * The three group sizes, presented in this order within each worker group type. Each one
 * starts its own gain ladder at the first rung — nothing carries over from the previous
 * size (see `blocksLegacyMethodology.ts`).
 *
 * WORDING: the labels state the head-count and nothing else. The adjectives "small",
 * "medium" and "large" were removed from the participant-facing text because they are
 * evaluative framing supplied by the instrument rather than facts about the scenario —
 * calling 10 workers "small" invites the participant to treat that harm as minor before
 * they have weighed it themselves. The number alone lets them make that judgment.
 * The `key` values are unchanged, so stored data and analysis code are unaffected.
 */
export const WORKER_GROUP_SIZES: readonly WorkerGroupSizeOption[] = [
  {
    key: "small",
    label: "group of about 10 workers",
    shortLabel: "~10 workers",
    count: 10,
  },
  {
    key: "medium",
    label: "group of about 1,000 workers",
    shortLabel: "~1,000 workers",
    count: 1000,
  },
  {
    key: "large",
    label: "group of about 100,000 workers",
    shortLabel: "~100,000 workers",
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
  /** unified anonymous session id (= getSessionId()); the MongoDB join key. */
  participantId?: string;
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
 * Naming note: this block was originally "Product Launch". The legacy alias key and
 * the ProductLaunch types have been fully removed — Block 3 now writes ONLY to
 * AI_WORKFORCE_RESULTS_KEY in the AI-Workforce vocabulary (Approved Change 1).
 */
