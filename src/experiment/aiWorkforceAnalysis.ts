/**
 * aiWorkforceAnalysis.ts — Block 3 score computation
 *
 * Computes five 0–100 scores from the Block 3 (AI Workforce Rollout) threshold
 * matrix. These scores supplement the MoralProfile (which uses the legacy
 * productLaunchTypes shape) and are displayed on the Insights page.
 *
 * All scores are clamp-rounded integers in [0, 100].
 * Higher scores always mean "more of that tendency" — see each score's comment.
 */

import {
  GAIN_OPTIONS,
  WORKER_GROUP_SIZES,
  aiWorkforceThresholdKeyFor,
  type AIWorkforceBlockResults,
  type AIWorkforceThresholdResult,
  type WorkerGroupKey,
  type WorkerGroupSizeKey,
} from "./aiWorkforceTypes";

/** Total number of gain steps. Used as the sentinel "beyond range" value. */
export const GAIN_STEPS = GAIN_OPTIONS.length;

/** Clamp-and-round a raw number to an integer in [0, 100]. */
export function clamp0to100(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Returns the comparable index for a Block 3 threshold.
 * - Accepted → thresholdGainIndex (0..GAIN_STEPS-1)
 * - Blocked by prior non-acceptance → GAIN_STEPS
 * - Not accepted or null → GAIN_STEPS
 *
 * A higher index means a higher gain was required before approving.
 * GAIN_STEPS acts as the sentinel for "never approved".
 */
export function toGainComparableIndex(
  t: AIWorkforceThresholdResult | null | undefined,
): number {
  if (!t) return GAIN_STEPS;
  if (t.blockedByPriorNonAcceptance) return GAIN_STEPS;
  if (!t.accepted || t.thresholdGainIndex === null) return GAIN_STEPS;
  return t.thresholdGainIndex;
}

/**
 * Computes the average comparable index across all three group sizes for a given worker group type.
 * Used in multiple score calculations as a summary of how restrictive the participant was overall
 * for that worker category.
 */
function avgIndexForGroup(
  results: AIWorkforceBlockResults,
  groupType: WorkerGroupKey,
): number {
  const values = WORKER_GROUP_SIZES.map((gs) =>
    toGainComparableIndex(
      results.thresholds[aiWorkforceThresholdKeyFor(groupType, gs.key)],
    ),
  );
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Computes the spread (max − min) of comparable indices across the three group sizes
 * for a given worker group type. A large spread indicates that the participant's threshold
 * shifted substantially as group size grew.
 */
function spreadForGroup(
  results: AIWorkforceBlockResults,
  groupType: WorkerGroupKey,
): number {
  const indices = WORKER_GROUP_SIZES.map((gs) =>
    toGainComparableIndex(
      results.thresholds[aiWorkforceThresholdKeyFor(groupType, gs.key)],
    ),
  );
  return Math.max(...indices) - Math.min(...indices);
}

/**
 * The five Block-3 analysis scores, plus the raw index averages and spreads
 * used in the ProfileCalculationModal derivation tables.
 */
export interface AIWorkforceAnalysis {
  /**
   * How readily financial gain drove approval (higher = approves at lower gain levels).
   * Inverted normalisation of the overall average gain index.
   */
  organizationalGainResponsivenessScore: number;

  /**
   * Whether the low-buffer threshold exceeded the high-buffer threshold.
   * Positive gap → more protective of low-buffer workers → higher score.
   */
  lowBufferProtectionScore: number;

  /**
   * How readily high-buffer scenarios were approved (lower HB threshold = higher score).
   */
  highBufferPermissivenessScore: number;

  /**
   * How much the threshold shifted as group size grew from ~10 to ~100,000.
   * Average of the spread for both worker group types.
   */
  sizeEscalationSensitivityScore: number;

  /**
   * Absolute difference between LB and HB average indices.
   * High score = worker type made a big difference to approval behaviour.
   */
  workerContextSensitivityScore: number;

  /** Raw average index for the low-buffer group (used in formulas and display). */
  avgLowBufferIndex: number;

  /** Raw average index for the high-buffer group (used in formulas and display). */
  avgHighBufferIndex: number;

  /** Spread (max−min) of indices across group sizes for low-buffer workers. */
  lowBufferSpread: number;

  /** Spread (max−min) of indices across group sizes for high-buffer workers. */
  highBufferSpread: number;

  /**
   * Per-cell breakdown of comparable indices, keyed by worker group type and group size.
   * Used in the ProfileCalculationModal derivation table.
   */
  indexByKey: Partial<Record<WorkerGroupKey, Partial<Record<WorkerGroupSizeKey, number>>>>;
}

/**
 * computeAIWorkforceAnalysis — the main entry point for this module.
 *
 * Takes the completed Block 3 results and returns an AIWorkforceAnalysis.
 * Called by MoralProfileInsightsPage alongside deriveMoralProfile.
 */
export function computeAIWorkforceAnalysis(
  results: AIWorkforceBlockResults,
): AIWorkforceAnalysis {
  const avgLowBuffer  = avgIndexForGroup(results, "low_buffer");
  const avgHighBuffer = avgIndexForGroup(results, "high_buffer");
  const overallAvg    = (avgLowBuffer + avgHighBuffer) / 2;

  // 1. Gain responsiveness: low overall average index → approves at low gain → high score.
  //    Formula: 100 × (1 − overallAvg / GAIN_STEPS)
  const organizationalGainResponsivenessScore = clamp0to100(
    100 * (1 - overallAvg / GAIN_STEPS),
  );

  // 2. Low-buffer protection: LB average index > HB average index → more protective of LB → higher score.
  //    Formula: 50 + 50 × (avgLB − avgHB) / GAIN_STEPS   (centred at 50 = no difference)
  const protectionGap = (avgLowBuffer - avgHighBuffer) / GAIN_STEPS;
  const lowBufferProtectionScore = clamp0to100(50 + 50 * protectionGap);

  // 3. High-buffer permissiveness: low HB average index → approved easily → high score.
  //    Formula: 100 × (1 − avgHB / GAIN_STEPS)
  const highBufferPermissivenessScore = clamp0to100(
    100 * (1 - avgHighBuffer / GAIN_STEPS),
  );

  // 4. Size escalation sensitivity: average spread of indices across sizes (both groups).
  //    Formula: 100 × avgSpread / GAIN_STEPS
  const spreadLB  = spreadForGroup(results, "low_buffer");
  const spreadHB  = spreadForGroup(results, "high_buffer");
  const avgSpread = (spreadLB + spreadHB) / 2;
  const sizeEscalationSensitivityScore = clamp0to100(
    100 * (avgSpread / GAIN_STEPS),
  );

  // 5. Worker context sensitivity: how different were LB and HB approval thresholds overall?
  //    Formula: 100 × |avgLB − avgHB| / GAIN_STEPS
  const workerContextSensitivityScore = clamp0to100(
    100 * (Math.abs(avgLowBuffer - avgHighBuffer) / GAIN_STEPS),
  );

  // Build the per-cell index breakdown for display purposes
  const indexByKey: AIWorkforceAnalysis["indexByKey"] = {
    low_buffer: {},
    high_buffer: {},
  };
  (["low_buffer", "high_buffer"] as WorkerGroupKey[]).forEach((gt) => {
    WORKER_GROUP_SIZES.forEach((gs) => {
      indexByKey[gt]![gs.key] = toGainComparableIndex(
        results.thresholds[aiWorkforceThresholdKeyFor(gt, gs.key)],
      );
    });
  });

  return {
    organizationalGainResponsivenessScore,
    lowBufferProtectionScore,
    highBufferPermissivenessScore,
    sizeEscalationSensitivityScore,
    workerContextSensitivityScore,
    avgLowBufferIndex: avgLowBuffer,
    avgHighBufferIndex: avgHighBuffer,
    lowBufferSpread: spreadLB,
    highBufferSpread: spreadHB,
    indexByKey,
  };
}
