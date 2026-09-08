/**
 * block5Profile.ts — Convert the User Value Profile (the ranked 7-sensitivity
 * tree built from Blocks 1–4) into the Block5UserProfile contract.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THIS IS THE BLOCKS-1–4 → BLOCK-5 BOUNDARY. Treat it as a hard contract.
 * Block 5 (CVR / APA) consumes a Block5UserProfile with exactly these guarantees:
 *   • 7 dimensions, one per Block5SensitivityKey
 *   • each score is an integer 0–100
 *   • higher score = stronger sensitivity (direction is fixed)
 *   • dimensions carry rank (1 = strongest) and a rank-proportional weight
 *   • topThreeKeys / topSensitivityKey are derived from rank
 * Do NOT weaken these guarantees. If something upstream is malformed we throw
 * loudly here rather than silently mislabel a dimension (Approved Change 6).
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { ThresholdTree } from "./thresholdTree";
import {
  POLICY_DIM_KEYS,
  type Block5SensitivityKey,
  type Block5UserProfile,
  type Block5UserProfileDimension,
} from "./block5Types";

/**
 * Maps an internal User-Value-Profile dimension key (snake_case, used inside the
 * scoring engine) to the canonical Block 5 sensitivity key (camelCase, frozen).
 * The Block 5 keys MUST NOT change — they are the contract Block 5 depends on.
 */
const KEY_MAP: Record<string, Block5SensitivityKey> = {
  directness: "directnessSensitivity",
  vulnerability_protection: "vulnerabilityProtectionSensitivity",
  group_size: "groupSizeSensitivity",
  context: "contextSensitivity",
  gain_responsiveness: "gainResponsivenessSensitivity",
  stakeholder_shift: "stakeholderPerspectiveShiftSensitivity",
  outcome_aggregation: "outcomeAggregationSensitivity",
};

/**
 * PARTICIPANT-FACING NAMES. The keys are frozen; only these strings changed.
 *
 * The old names ("outcome aggregation", "gain responsiveness") were academic, and worse, the two
 * of them read as synonyms — both said "benefit" or "total". They are not synonyms: one is
 * measured from a MONEY ladder ($1 -> $100M, Block 3) and asks how big a payoff moves you; the
 * other from a LIVES ladder (1 -> 10,000 saved, Block 2) and asks how many people must be helped.
 *
 * The four policy names are now deliberately parallel — harmed / harmed / helped / gained — so
 * the difference is visible at a glance instead of needing to be explained:
 *
 *   Protecting the vulnerable   WHO is harmed
 *   Reducing harm              HOW MANY are spared
 *   How many are helped        HOW MANY are helped
 *   How much is gained         HOW MUCH money is gained
 *
 * See docs/BLOCK5_VALUE_NAMING_PLAN.md.
 */
const LABEL_MAP: Record<Block5SensitivityKey, string> = {
  vulnerabilityProtectionSensitivity: "Protecting the vulnerable",
  groupSizeSensitivity: "Reducing harm",
  outcomeAggregationSensitivity: "How many are helped",
  gainResponsivenessSensitivity: "How much is gained",
  directnessSensitivity: "Doing it yourself",
  contextSensitivity: "Where it happens",
  stakeholderPerspectiveShiftSensitivity: "Hearing someone's story",
};

/**
 * Which blocks contribute evidence to each sensitivity (for transparency / display).
 * This mirrors the multi-block contribution model documented in userValueModel.ts:
 * every block now has a clear "home" dimension plus justified secondary signals.
 */
const SOURCE_MAP: Record<Block5SensitivityKey, string[]> = {
  directnessSensitivity: ["Block 2 (Trolley)"],
  vulnerabilityProtectionSensitivity: ["Block 3 (AI-Workforce)", "Block 1 (Money)", "Block 4 (Stakeholder)"],
  groupSizeSensitivity: ["Block 3 (AI-Workforce)"],
  contextSensitivity: ["Block 1 (Money)"],
  gainResponsivenessSensitivity: ["Block 3 (AI-Workforce)", "Block 4 (Stakeholder)"],
  stakeholderPerspectiveShiftSensitivity: ["Block 4 (Stakeholder)"],
  outcomeAggregationSensitivity: ["Block 2 (Trolley)"],
};

/**
 * Rank-proportional weight: the strongest sensitivity (rank 1) receives the
 * largest share and it decreases linearly down to the weakest.
 *
 *   weight(rank) = (N + 1 − rank) / T,   where T = N(N+1)/2  (sum of ranks 1..N)
 *
 * Because T is the triangular number of N, the N weights sum to exactly 1.0 by
 * construction — no magic constants (the old code hard-coded 8 and 28, which only
 * happened to be right for N=7). Derived from the dimension count instead.
 * NOTE: this weight is profile metadata; Block 5 alignment ranks options by the
 * raw 0–100 scores, not by this weight, so changing the formula cannot alter
 * Block 5 behaviour — but we keep it consistent and documented.
 */
function rankWeight(rank: number, dimensionCount: number): number {
  const triangular = (dimensionCount * (dimensionCount + 1)) / 2;
  return (dimensionCount + 1 - rank) / triangular;
}

/**
 * extractBlock5Profile — converts the User Value Profile tree into the frozen
 * Block5UserProfile shape. Validates every dimension and refuses to silently
 * default an unknown/out-of-range value (Approved Change 6).
 */
export function extractBlock5Profile(tree: ThresholdTree): Block5UserProfile {
  if (!tree || !Array.isArray(tree.dimensions) || tree.dimensions.length === 0) {
    throw new Error(
      "[extractBlock5Profile] Received an empty/invalid User Value Profile tree. " +
        "Blocks 1–4 must produce all sensitivity dimensions before Block 5 can start.",
    );
  }

  const dimensionCount = tree.dimensions.length;

  const dimensions: Block5UserProfileDimension[] = tree.dimensions.map((d) => {
    const key = KEY_MAP[d.key];
    if (!key) {
      // Loud failure instead of mislabeling as directness (the previous silent bug).
      throw new Error(
        `[extractBlock5Profile] Unmapped sensitivity key "${d.key}". Blocks 1–4 produced a ` +
          "dimension Block 5 does not recognise. Refusing to silently default it — update KEY_MAP " +
          "if a new dimension was intentionally added.",
      );
    }
    if (!Number.isFinite(d.score) || d.score < 0 || d.score > 100) {
      throw new Error(
        `[extractBlock5Profile] Dimension "${d.key}" has an out-of-range score (${d.score}); ` +
          "expected an integer in [0, 100]. This indicates corrupted upstream data.",
      );
    }
    if (!Number.isInteger(d.rank) || d.rank < 1 || d.rank > dimensionCount) {
      throw new Error(
        `[extractBlock5Profile] Dimension "${d.key}" has an invalid rank (${d.rank}); ` +
          `expected an integer in [1, ${dimensionCount}].`,
      );
    }
    return {
      key,
      label: LABEL_MAP[key],
      score: Math.round(d.score),
      rank: d.rank,
      weight: rankWeight(d.rank, dimensionCount),
      sourceBlocks: SOURCE_MAP[key],
    };
  });

  // Contract guard: Block 5 expects ALL four policy dimensions to be present
  // (its CVR-cube alignment indexes them by key). Catch a missing/duplicate key now.
  const seen = new Set(dimensions.map((d) => d.key));
  if (seen.size !== dimensions.length) {
    throw new Error("[extractBlock5Profile] Duplicate sensitivity keys detected in the profile.");
  }
  for (const policyKey of POLICY_DIM_KEYS) {
    if (!seen.has(policyKey)) {
      throw new Error(
        `[extractBlock5Profile] Required policy dimension "${policyKey}" is missing — Block 5 ` +
          "alignment cannot run without all four policy values.",
      );
    }
  }

  const sorted = [...dimensions].sort((a, b) => a.rank - b.rank);
  const topThreeKeys = sorted.slice(0, 3).map((d) => d.key);
  const topSensitivityKey = sorted[0].key; // safe: length > 0 guaranteed above

  return {
    generatedAt: new Date().toISOString(),
    dimensions,
    topThreeKeys,
    topSensitivityKey,
  };
}
