/**
 * profileAnalysis.ts — Derive a MoralProfile from Blocks 1–3
 *
 * This is the core analysis module. It converts raw block results into a
 * normalised MoralProfile (6 numeric scores + boolean flags) that drives:
 * - The MoralProfileInsightsPage display
 * - Block-4 scenario and perspective personalisation
 * - The FinalMoralAnalysisPage written observations
 * - The ThresholdTree dimension calculations
 *
 * All scores are in [0, 1]. Higher always means "more of that trait".
 * Comparable indices map accepted thresholds to their 0-based position in the
 * option ladder; "sentinel" values (equal to the step count) represent
 * "threshold beyond range" — never accepted even at the highest option.
 */

import { AMOUNT_LABELS } from "./constants";
import { SAVED_LIVES_OPTIONS } from "./trolleyTypes";
import {
  GROUP_SIZES,
  GROUP_TYPES,
  PROFIT_OPTIONS,
  thresholdKeyFor,
  type GroupSizeKey,
  type GroupTypeKey,
} from "./productLaunchTypes";
import type { MoneyBlockResults, ThresholdResult } from "./types";
import type {
  BridgeThresholdResult,
  LeverThresholdResult,
  TrolleyBlockResults,
} from "./trolleyTypes";
import type {
  LaunchThresholdResult,
  ProductLaunchBlockResults,
} from "./productLaunchTypes";

/** Total number of steps in the Block 1 amount ladder. Used as the sentinel "beyond range" value. */
export const MONEY_STEPS = AMOUNT_LABELS.length;

/** Total number of steps in the Block 2 lives ladder. */
export const TROLLEY_STEPS = SAVED_LIVES_OPTIONS.length;

/** Total number of steps in the Block 3 gain ladder. */
export const PRODUCT_STEPS = PROFIT_OPTIONS.length;

/**
 * Returns the comparable index for a Block 1 threshold.
 * Accepted → thresholdAmountIndex (0..MONEY_STEPS-1)
 * Not accepted or null → MONEY_STEPS (sentinel: beyond range)
 */
export function toMoneyComparableIndex(t: ThresholdResult | null): number {
  if (!t) return MONEY_STEPS;
  if (!t.accepted || t.thresholdAmountIndex === null) return MONEY_STEPS;
  return t.thresholdAmountIndex;
}

/**
 * Returns the comparable index for a Block 2 lever threshold.
 * Accepted → thresholdIndex (0..TROLLEY_STEPS-1)
 * Not accepted or null → TROLLEY_STEPS
 */
export function toTrolleyComparableIndex(
  t: LeverThresholdResult | null,
): number {
  if (!t) return TROLLEY_STEPS;
  if (!t.accepted || t.thresholdIndex === null) return TROLLEY_STEPS;
  return t.thresholdIndex;
}

/**
 * Returns the comparable index for a Block 2 bridge threshold.
 * Accepted → thresholdIndex (0..TROLLEY_STEPS-1)
 * Not accepted or null → TROLLEY_STEPS
 */
export function toBridgeComparableIndex(
  t: BridgeThresholdResult | null,
): number {
  if (!t) return TROLLEY_STEPS;
  if (!t.accepted || t.thresholdIndex === null) return TROLLEY_STEPS;
  return t.thresholdIndex;
}

/**
 * Returns the comparable index for a Block 3 threshold.
 * Accepted → thresholdProfitIndex (0..PRODUCT_STEPS-1)
 * Blocked by prior non-acceptance → PRODUCT_STEPS (treated same as beyond range)
 * Not accepted or null → PRODUCT_STEPS
 */
export function toProductComparableIndex(
  t: LaunchThresholdResult | null,
): number {
  if (!t) return PRODUCT_STEPS;
  if (t.blockedByPriorNonAcceptance) return PRODUCT_STEPS;
  if (!t.accepted || t.thresholdProfitIndex === null) return PRODUCT_STEPS;
  return t.thresholdProfitIndex;
}

/**
 * Normalises an index to [0, 1] by dividing by the total step count.
 * A result of 0 means index 0 (accepted at the lowest option);
 * a result approaching 1 means the threshold was at or beyond the highest option.
 */
function norm(idx: number, steps: number): number {
  return Math.max(0, Math.min(1, idx / steps));
}

/**
 * The full moral profile derived from all three quantitative blocks.
 *
 * Numeric scores (all 0–1):
 *   vulnerabilitySensitivityScore      — does context of vulnerability raise the bar?
 *   wealthContextPermissivenessScore   — more permissive when counterparty is wealthy?
 *   harmReluctanceScore                — general reluctance to cause harm (both trolley phases)
 *   directnessAversionScore            — higher bar for direct vs. indirect harm?
 *   scaleSensitivityScore              — do thresholds shift with group size?
 *   consistencyAcrossDomainsScore      — are vulnerability signals consistent across blocks?
 *
 * Boolean flags (derived from the scores and raw indices):
 *   protectsVulnerableStrongly         — vulnerability sensitivity ≥ 0.62 OR shelter beyond range
 *   refusedBridge                      — never pushed in the bridge phase
 *   refusedLever                       — never pulled in the lever phase
 *   refusedAnyProduct                  — at least one Block-3 cell was never accepted
 *   refusedAllVulnerableProducts       — every low-buffer cell was never accepted
 *
 * Raw index snapshots (used by downstream analysis and display):
 *   moneyIndices     — { sidewalk, wealthy, shelter } comparable indices
 *   trolleyIndices   — { lever, bridge } comparable indices
 *   productIndices   — all 6 (groupType × groupSize) comparable indices
 */
export interface MoralProfile {
  vulnerabilitySensitivityScore: number;
  wealthContextPermissivenessScore: number;
  harmReluctanceScore: number;
  directnessAversionScore: number;
  scaleSensitivityScore: number;
  consistencyAcrossDomainsScore: number;
  protectsVulnerableStrongly: boolean;
  refusedBridge: boolean;
  refusedLever: boolean;
  refusedAnyProduct: boolean;
  refusedAllVulnerableProducts: boolean;
  dominantVulnerableGroupSize: GroupSizeKey | null;
  moneyIndices: Record<string, number>;
  trolleyIndices: { lever: number; bridge: number };
  productIndices: Partial<Record<string, number>>;
}

/**
 * Computes the average comparable index across all three group sizes for a given group type.
 * Used as a summary signal for Block-3 permissiveness per worker category.
 */
function avgProductIndex(
  results: ProductLaunchBlockResults,
  groupType: GroupTypeKey,
): number {
  const values = GROUP_SIZES.map((gs) =>
    toProductComparableIndex(
      results.thresholds[thresholdKeyFor(groupType, gs.key)] ?? null,
    ),
  );
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * deriveMoralProfile — the main entry point for this module.
 *
 * Takes the completed results from all three quantitative blocks and returns a
 * MoralProfile. Called by MoralProfileInsightsPage once all three blocks are done.
 *
 * Score derivations:
 *
 * vulnerabilitySensitivityScore
 *   = 0.5 + 0.5 × (0.5 × vulnProductGap + 0.5 × moneyVulnGap)
 *   where vulnProductGap = (avgVulnerableIdx − avgWealthyIdx) / PRODUCT_STEPS
 *         moneyVulnGap   = norm(shelterIdx) − norm(sidewalkIdx)
 *   Higher → more reluctant to approve/keep when vulnerable people are affected.
 *
 * wealthContextPermissivenessScore
 *   = 0.5 + 0.5 × (norm(sidewalkIdx) − norm(wealthyIdx))
 *   Higher → threshold drops in a wealthy context (more permissive toward the wealthy).
 *
 * harmReluctanceScore
 *   = 0.5 × norm(leverIdx) + 0.5 × norm(bridgeIdx)
 *   Higher → pulled the lever / pushed at a higher number of lives (more reluctant to cause any harm).
 *
 * directnessAversionScore
 *   = (bridgeIdx − leverIdx) / TROLLEY_STEPS + 0.5
 *   Higher → needed more lives at risk to push than to pull (acts of direct harm need higher justification).
 *
 * scaleSensitivityScore
 *   = (max(vulnIndices) − min(vulnIndices)) / PRODUCT_STEPS
 *   Higher → threshold moved substantially as group size grew.
 *
 * consistencyAcrossDomainsScore
 *   = 1 − √(variance of 3 normalised vulnerability signals) × 2
 *   The three signals are: money vulnerability norm, product vulnerability norm, harm reluctance norm.
 *   Higher → all three signals point in the same direction.
 */
export function deriveMoralProfile(
  money: MoneyBlockResults,
  trolley: TrolleyBlockResults,
  product: ProductLaunchBlockResults,
): MoralProfile {
  const sidewalkIdx = toMoneyComparableIndex(money.thresholds.threshold_sidewalk);
  const wealthyIdx  = toMoneyComparableIndex(money.thresholds.threshold_wealthy);
  const shelterIdx  = toMoneyComparableIndex(money.thresholds.threshold_shelter);

  const leverIdx  = toTrolleyComparableIndex(trolley.leverThreshold);
  const bridgeIdx = toBridgeComparableIndex(trolley.bridgeThreshold);

  const avgVulnerable = avgProductIndex(product, "vulnerable");
  const avgWealthy    = avgProductIndex(product, "wealthy");

  // ── Vulnerability sensitivity ────────────────────────────────────────────
  // How much does a vulnerable context (shelter, low-buffer workers) raise the bar?
  const vulnProductGap = (avgVulnerable - avgWealthy) / PRODUCT_STEPS;
  const moneyVulnGap   = norm(shelterIdx, MONEY_STEPS) - norm(sidewalkIdx, MONEY_STEPS);
  const vulnerabilitySensitivityScore = Math.max(
    0,
    Math.min(1, 0.5 + 0.5 * (0.5 * vulnProductGap + 0.5 * moneyVulnGap)),
  );

  // ── Wealth context permissiveness ────────────────────────────────────────
  // Positive when the sidewalk threshold is higher than the wealthy threshold
  // (i.e. more lenient when the counterparty appears wealthy).
  const wealthContextPermissivenessScore = Math.max(
    0,
    Math.min(
      1,
      0.5 + 0.5 * (norm(sidewalkIdx, MONEY_STEPS) - norm(wealthyIdx, MONEY_STEPS)),
    ),
  );

  // ── Harm reluctance ──────────────────────────────────────────────────────
  // Average of normalised lever and bridge indices; high = needs many lives saved before acting.
  const leverRefused  = leverIdx >= TROLLEY_STEPS;
  const bridgeRefused = bridgeIdx >= TROLLEY_STEPS;
  const harmReluctanceScore = Math.max(
    0,
    Math.min(
      1,
      0.5 * (leverIdx / TROLLEY_STEPS) + 0.5 * (bridgeIdx / TROLLEY_STEPS),
    ),
  );

  // ── Directness aversion ──────────────────────────────────────────────────
  // Positive gap → needed more lives to push than to pull.
  // Centred at 0.5 so that equal thresholds = 0.5 (not averse, not the reverse).
  const directnessAversionScore = Math.max(
    0,
    Math.min(1, (bridgeIdx - leverIdx) / TROLLEY_STEPS + 0.5),
  );

  // ── Scale sensitivity ────────────────────────────────────────────────────
  // How much did the vulnerable-group threshold shift across the three group sizes?
  const vulnSmall  = toProductComparableIndex(product.thresholds.threshold_vulnerable_small  ?? null);
  const vulnMedium = toProductComparableIndex(product.thresholds.threshold_vulnerable_medium ?? null);
  const vulnLarge  = toProductComparableIndex(product.thresholds.threshold_vulnerable_large  ?? null);
  const scaleSpread = Math.max(vulnSmall, vulnMedium, vulnLarge) -
    Math.min(vulnSmall, vulnMedium, vulnLarge);
  const scaleSensitivityScore = Math.max(
    0,
    Math.min(1, scaleSpread / PRODUCT_STEPS),
  );

  // ── Consistency across domains ───────────────────────────────────────────
  // Three normalised signals all measuring "how much does vulnerability affect behaviour?"
  // If they agree, the participant is consistent; high variance → low consistency.
  const moneyVulnNorm      = 1 - norm(shelterIdx, MONEY_STEPS);   // low index → more protective
  const productVulnNorm    = 1 - avgVulnerable / PRODUCT_STEPS;    // low avg → more protective
  const harmReluctanceNorm = harmReluctanceScore;
  const meanSens = (moneyVulnNorm + productVulnNorm + harmReluctanceNorm) / 3;
  const variance =
    (Math.pow(moneyVulnNorm - meanSens, 2) +
      Math.pow(productVulnNorm - meanSens, 2) +
      Math.pow(harmReluctanceNorm - meanSens, 2)) /
    3;
  const consistencyAcrossDomainsScore = Math.max(
    0,
    Math.min(1, 1 - Math.sqrt(variance) * 2),
  );

  // ── Boolean flags ────────────────────────────────────────────────────────
  const protectsVulnerableStrongly =
    vulnerabilitySensitivityScore >= 0.62 || shelterIdx >= MONEY_STEPS;

  const refusedAllVulnerableProducts =
    GROUP_SIZES.every((gs) => {
      const r = product.thresholds[thresholdKeyFor("vulnerable", gs.key)];
      return !r || !r.accepted;
    });

  const refusedAnyProduct = GROUP_TYPES.some((gt) =>
    GROUP_SIZES.some((gs) => {
      const r = product.thresholds[thresholdKeyFor(gt.key, gs.key)];
      return !r || !r.accepted;
    }),
  );

  // Which vulnerable-group size had the highest (most restrictive) threshold index?
  const vulnSizes: { key: GroupSizeKey; idx: number }[] = GROUP_SIZES.map(
    (gs) => ({
      key: gs.key,
      idx: toProductComparableIndex(
        product.thresholds[thresholdKeyFor("vulnerable", gs.key)] ?? null,
      ),
    }),
  );
  vulnSizes.sort((a, b) => b.idx - a.idx);
  const dominantVulnerableGroupSize = vulnSizes[0]?.idx > 0
    ? vulnSizes[0].key
    : null;

  // Build full product index map for display in ProfileCalculationModal
  const productIndices: Partial<Record<string, number>> = {};
  GROUP_TYPES.forEach((gt) => {
    GROUP_SIZES.forEach((gs) => {
      const key = thresholdKeyFor(gt.key, gs.key);
      productIndices[key] = toProductComparableIndex(
        product.thresholds[key] ?? null,
      );
    });
  });

  return {
    vulnerabilitySensitivityScore,
    wealthContextPermissivenessScore,
    harmReluctanceScore,
    directnessAversionScore,
    scaleSensitivityScore,
    consistencyAcrossDomainsScore,
    protectsVulnerableStrongly,
    refusedBridge: bridgeRefused,
    refusedLever: leverRefused,
    refusedAnyProduct,
    refusedAllVulnerableProducts,
    dominantVulnerableGroupSize,
    moneyIndices: {
      sidewalk: sidewalkIdx,
      wealthy:  wealthyIdx,
      shelter:  shelterIdx,
    },
    trolleyIndices: { lever: leverIdx, bridge: bridgeIdx },
    productIndices,
  };
}

/**
 * Returns a human-readable strength label for any 0–1 score.
 * Used in plain-language observations throughout the analysis pages.
 */
export function describeScore(score: number): string {
  if (score >= 0.75) return "strong";
  if (score >= 0.55) return "moderate";
  if (score >= 0.35) return "mild";
  return "low";
}
