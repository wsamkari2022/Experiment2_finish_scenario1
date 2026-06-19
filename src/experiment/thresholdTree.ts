/**
 * thresholdTree.ts — Build the ranked 7-dimension sensitivity tree
 *
 * This module computes a ThresholdTree: a ranked list of 7 "sensitivity
 * dimensions" that describe which moral levers most strongly drove the
 * participant's decision-making across all four blocks.
 *
 * Each dimension is assigned a score (0–100) derived from specific block
 * results, then all dimensions are sorted by score descending and assigned
 * a rank. A weighted composite "overall sensitivity index" (0–100) is also
 * computed using rank-proportional weights so the top-scoring dimension
 * contributes most to the composite.
 *
 * The tree is displayed on FinalMoralAnalysisPage via RankedThresholdTree.tsx.
 */

import {
  GAIN_OPTIONS,
  WORKER_GROUP_SIZES,
  aiWorkforceThresholdKeyFor,
  type AIWorkforceBlockResults,
  type WorkerGroupKey,
} from "./aiWorkforceTypes";
import { toGainComparableIndex } from "./aiWorkforceAnalysis";
import type { MoralProfile } from "./profileAnalysis";
import type { Block4DecisionRecord } from "./finalAnalysis";

/** Total gain steps — used as the normalisation denominator. */
export const GAIN_STEPS = GAIN_OPTIONS.length;

/** Clamp a value to [0, 1]. NaN is treated as 0. */
function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** Scale a [0, 1] value to an integer in [0, 100]. */
function to100(v: number): number {
  return Math.round(clamp01(v) * 100);
}

/**
 * Average the comparable gain indices across all three group sizes
 * for a given worker group type. Used to summarise Block-3 strictness
 * per worker category.
 */
function avgIndexForGroup(
  results: AIWorkforceBlockResults,
  gt: WorkerGroupKey,
): number {
  const idx = WORKER_GROUP_SIZES.map((gs) =>
    toGainComparableIndex(
      results.thresholds[aiWorkforceThresholdKeyFor(gt, gs.key)],
    ),
  );
  return idx.reduce((a, b) => a + b, 0) / idx.length;
}

/**
 * Compute the spread (max − min) of comparable gain indices across the
 * three group sizes for a given worker group type. High spread = thresholds
 * moved substantially as group size grew.
 */
function spreadForGroup(
  results: AIWorkforceBlockResults,
  gt: WorkerGroupKey,
): number {
  const idx = WORKER_GROUP_SIZES.map((gs) =>
    toGainComparableIndex(
      results.thresholds[aiWorkforceThresholdKeyFor(gt, gs.key)],
    ),
  );
  return Math.max(...idx) - Math.min(...idx);
}

/**
 * A single dimension in the ranked threshold tree.
 * - `score`      — the 0–100 score for this dimension
 * - `rank`       — 1 = highest score (assigned after sorting)
 * - `rationale`  — one-sentence plain-English explanation shown to the participant
 * - `derivation` — the formula with substituted values, shown in the detail view
 */
export interface ThresholdTreeDimension {
  key: string;
  label: string;
  score: number;
  rank: number;
  rationale: string;
  derivation: string;
}

/**
 * The complete ranked threshold tree.
 * - `dimensions`               — all 7 dimensions sorted by score descending
 * - `overallSensitivityIndex`  — rank-weighted composite score (0–100)
 * - `primaryDriver`            — the dimension ranked #1
 * - `secondaryDriver`          — the dimension ranked #2
 */
export interface ThresholdTree {
  dimensions: ThresholdTreeDimension[];
  overallSensitivityIndex: number;
  primaryDriver: ThresholdTreeDimension | null;
  secondaryDriver: ThresholdTreeDimension | null;
}

/**
 * buildThresholdTree — the main entry point for this module.
 *
 * Computes all 7 dimension scores, sorts them, assigns ranks, and computes
 * the weighted composite index. Called by FinalMoralAnalysisPage.
 *
 * When `aiResults` is null (data missing), Block-3 dimensions fall back to
 * neutral mid-range values rather than throwing an error.
 *
 * The 7 dimensions and their sources:
 *
 * 1. Directness sensitivity (Block 2)
 *    From the directnessAversionScore in the moral profile.
 *    High = needed more lives at risk to push than to pull.
 *
 * 2. Vulnerability protection sensitivity (Block 3)
 *    From the gap between LB and HB average indices.
 *    High = required more financial gain to approve harm to low-buffer workers.
 *
 * 3. Group-size sensitivity (Block 3)
 *    From the average spread of thresholds across sizes within each group.
 *    High = threshold moved substantially as the affected group grew.
 *
 * 4. Context sensitivity (Block 1 + Block 3)
 *    Combines Block-1 wealth context permissiveness with Block-3 LB vs HB gap.
 *    High = context of the people affected substantially shifted behaviour.
 *
 * 5. Gain responsiveness (Block 3)
 *    Inverted normalisation of the overall average gain index.
 *    High = approved at lower financial gain levels overall.
 *
 * 6. Stakeholder-voice responsiveness (Block 4)
 *    Counts decision shifts between the three Block-4 decision points.
 *    High = stakeholder perspectives moved the participant's decision.
 *
 * 7. Outcome-aggregation sensitivity (Block 2 + Block 3)
 *    Combines the scale sensitivity score with the group-size spread.
 *    High = aggregate numbers (scale, size) drove threshold changes.
 */
export function buildThresholdTree(
  profile: MoralProfile,
  aiResults: AIWorkforceBlockResults | null,
  block4: Block4DecisionRecord,
): ThresholdTree {
  // ── Block 3 derived quantities (fall back to neutral when data missing) ──
  const avgLB     = aiResults ? avgIndexForGroup(aiResults, "low_buffer")  : GAIN_STEPS / 2;
  const avgHB     = aiResults ? avgIndexForGroup(aiResults, "high_buffer") : GAIN_STEPS / 2;
  const spreadLB  = aiResults ? spreadForGroup(aiResults, "low_buffer")    : 0;
  const spreadHB  = aiResults ? spreadForGroup(aiResults, "high_buffer")   : 0;
  const avgSpread = (spreadLB + spreadHB) / 2;
  const overallAvg = (avgLB + avgHB) / 2;

  // ── Dimension scores ─────────────────────────────────────────────────────

  // 1. Directness sensitivity
  //    Re-uses the directnessAversionScore computed in profileAnalysis.
  const directness = to100(profile.directnessAversionScore);

  // 2. Vulnerability protection sensitivity
  //    Centred at 50 (no gap = 50); positive gap → higher score.
  //    Formula: 100 × (0.5 + 0.5 × (avgLB − avgHB) / GAIN_STEPS)
  const workerVulnerability = to100(
    0.5 + 0.5 * ((avgLB - avgHB) / GAIN_STEPS),
  );

  // 3. Group-size sensitivity
  //    Formula: 100 × avgSpread / GAIN_STEPS
  const groupSize = to100(avgSpread / GAIN_STEPS);

  // 4. Context sensitivity
  //    50% from Block-1 wealth context permissiveness + 50% from Block-3 LB vs HB gap.
  //    Formula: 100 × (0.5 × wealthContextPerm + 0.5 × |avgLB − avgHB| / GAIN_STEPS)
  const contextBlock1 = profile.wealthContextPermissivenessScore;
  const contextBlock3 = Math.abs(avgLB - avgHB) / GAIN_STEPS;
  const context = to100(0.5 * contextBlock1 + 0.5 * contextBlock3);

  // 5. Gain responsiveness
  //    Formula: 100 × (1 − overallAvg / GAIN_STEPS)
  const gainResponsiveness = to100(1 - overallAvg / GAIN_STEPS);

  // 6. Stakeholder-voice responsiveness
  //    Counts the two possible decision-point shifts in Block 4.
  //    Score = 0, 50, or 100.
  const { initialDecision, midDecision, finalDecision } = block4;
  let shiftCount = 0;
  if (initialDecision && midDecision && initialDecision !== midDecision) shiftCount += 1;
  if (midDecision && finalDecision && midDecision !== finalDecision) shiftCount += 1;
  const stakeholderShift = to100(shiftCount / 2);

  // 7. Outcome-aggregation sensitivity
  //    50% from scaleSensitivityScore (Block 2 + Block 3 via profileAnalysis)
  //    + 50% from Block-3 group-size spread.
  //    Formula: 100 × (0.5 × scaleSensitivity + 0.5 × avgSpread / GAIN_STEPS)
  const outcomeAggregation = to100(
    0.5 * profile.scaleSensitivityScore + 0.5 * (avgSpread / GAIN_STEPS),
  );

  // ── Assemble raw dimensions ──────────────────────────────────────────────
  const raw: Omit<ThresholdTreeDimension, "rank">[] = [
    {
      key: "directness",
      label: "Directness sensitivity",
      score: directness,
      rationale:
        "Reflects how much more hesitant you were to cause harm directly than at a distance (Block 2).",
      derivation: `score = clamp(0,100,  100 × ((bridge_idx − lever_idx)/${""}TROLLEY_STEPS + 0.5))`,
    },
    {
      key: "worker_vulnerability",
      label: "Vulnerability protection sensitivity",
      score: workerVulnerability,
      rationale:
        "Reflects whether your approval threshold was higher for low-buffer workers than for high-buffer workers (Block 3).",
      derivation: `avg_LB = ${avgLB.toFixed(2)}, avg_HB = ${avgHB.toFixed(2)}\nscore = clamp(0,100,  100 × (0.5 + 0.5 × (avg_LB − avg_HB) / ${GAIN_STEPS}))`,
    },
    {
      key: "group_size",
      label: "Group-size sensitivity",
      score: groupSize,
      rationale:
        "Reflects how much your threshold shifted as the affected group grew from ~10 to ~100,000 (Block 3).",
      derivation: `spread_LB = ${spreadLB}, spread_HB = ${spreadHB}\navg_spread = ${avgSpread.toFixed(2)}\nscore = clamp(0,100,  100 × avg_spread / ${GAIN_STEPS})`,
    },
    {
      key: "context",
      label: "Context sensitivity",
      score: context,
      rationale:
        "Combines your contextual shifts in Block 1 (sidewalk vs shelter vs wealthy) with your worker-context shift in Block 3.",
      derivation: `score = clamp(0,100,  100 × (0.5 × wealth_context_perm + 0.5 × |avg_LB − avg_HB| / ${GAIN_STEPS}))`,
    },
    {
      key: "gain_responsiveness",
      label: "Gain responsiveness",
      score: gainResponsiveness,
      rationale:
        "Reflects how readily financial gain moved you toward approval across the AI workforce block.",
      derivation: `overall_avg = ${overallAvg.toFixed(2)}\nscore = clamp(0,100,  100 × (1 − overall_avg / ${GAIN_STEPS}))`,
    },
    {
      key: "stakeholder_shift",
      label: "Stakeholder-voice responsiveness",
      score: stakeholderShift,
      rationale:
        "Reflects whether hearing from the two affected stakeholders in Block 4 shifted your decision.",
      derivation: `shift_count = ${shiftCount} (of 2 possible shifts)\nscore = clamp(0,100,  100 × shift_count / 2)`,
    },
    {
      key: "outcome_aggregation",
      label: "Outcome-aggregation sensitivity",
      score: outcomeAggregation,
      rationale:
        "Combines Block 2 scale sensitivity with Block 3 size-spread — how much aggregate outcomes shifted your thresholds.",
      derivation: `score = clamp(0,100,  100 × (0.5 × scale_sensitivity + 0.5 × avg_spread / ${GAIN_STEPS}))`,
    },
  ];

  // ── Sort and rank ────────────────────────────────────────────────────────
  const sorted = [...raw]
    .sort((a, b) => b.score - a.score)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  // ── Weighted composite ───────────────────────────────────────────────────
  // Rank-proportional weights so the highest-scoring dimension contributes most.
  // The 7 weights sum to 1.0.
  const weights = [0.22, 0.18, 0.16, 0.14, 0.12, 0.1, 0.08];
  const overall = sorted.reduce(
    (sum, d, i) => sum + (weights[i] ?? 0) * d.score,
    0,
  );
  const overallSensitivityIndex = Math.round(overall);

  return {
    dimensions: sorted,
    overallSensitivityIndex,
    primaryDriver: sorted[0] ?? null,
    secondaryDriver: sorted[1] ?? null,
  };
}

/**
 * Returns a human-readable level label for a 0–100 score.
 * Used in RankedThresholdTree to describe each dimension's intensity.
 */
export function describeLevel(score: number): "strong" | "moderate" | "mild" | "low" {
  if (score >= 75) return "strong";
  if (score >= 55) return "moderate";
  if (score >= 35) return "mild";
  return "low";
}
