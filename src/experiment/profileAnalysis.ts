/**
 * profileAnalysis.ts — Interim Blocks-1–3 descriptive snapshot (the "MoralProfile")
 *
 * This builds the INTERIM profile shown on the Insights page (after Block 3, before
 * Block 4) and used to personalise the Block-4 scenario. It is a descriptive
 * snapshot of Blocks 1–3 only.
 *
 * It is NOT the authoritative seven-sensitivity User Value Profile — that is built
 * from all four blocks in thresholdTree.ts (buildThresholdTree) and is the single
 * source of truth fed to Block 5. Both modules now derive Block-3 quantities from
 * ONE place: computeAIWorkforceAnalysis (aiWorkforceAnalysis.ts).
 *
 * Migration note (Approved Change 1): Block 3 is the "AI-Workforce Rollout" block.
 * The legacy "Product Launch" vocabulary (vulnerable/wealthy/profit) has been fully
 * removed — fields now use AI-Workforce concepts (low-buffer/high-buffer/gain).
 *
 * All scores are in [0, 1]; higher always means "more of that trait". Comparable
 * indices map an accepted threshold to its 0-based rung; a sentinel equal to the
 * ladder length means "never accepted even at the top rung".
 */

import { AMOUNT_LABELS } from "./constants";
import { SAVED_LIVES_OPTIONS } from "./trolleyTypes";
import type { MoneyBlockResults, ThresholdResult } from "./types";
import type {
  BridgeThresholdResult,
  LeverThresholdResult,
  TrolleyBlockResults,
} from "./trolleyTypes";
import {
  WORKER_GROUP_SIZES,
  aiWorkforceThresholdKeyFor,
  type AIWorkforceBlockResults,
  type WorkerGroupSizeKey,
} from "./aiWorkforceTypes";
import { computeAIWorkforceAnalysis, GAIN_STEPS } from "./aiWorkforceAnalysis";

/** Total rungs in the Block 1 money ladder. Sentinel value for "never kept". */
export const MONEY_STEPS = AMOUNT_LABELS.length;

/** Total rungs in the Block 2 saved-lives ladder. Sentinel value for "never acted". */
export const TROLLEY_STEPS = SAVED_LIVES_OPTIONS.length;

/** Total rungs in the Block 3 gain ladder. Re-exported so display code has one constant. */
export { GAIN_STEPS };

/** Comparable index for a Block 1 threshold (accepted → rung; else MONEY_STEPS sentinel). */
export function toMoneyComparableIndex(t: ThresholdResult | null): number {
  if (!t) return MONEY_STEPS;
  if (!t.accepted || t.thresholdAmountIndex === null) return MONEY_STEPS;
  return t.thresholdAmountIndex;
}

/** Comparable index for a Block 2 lever threshold (accepted → rung; else TROLLEY_STEPS). */
export function toTrolleyComparableIndex(t: LeverThresholdResult | null): number {
  if (!t) return TROLLEY_STEPS;
  if (!t.accepted || t.thresholdIndex === null) return TROLLEY_STEPS;
  return t.thresholdIndex;
}

/** Comparable index for a Block 2 bridge threshold (accepted → rung; else TROLLEY_STEPS). */
export function toBridgeComparableIndex(t: BridgeThresholdResult | null): number {
  if (!t) return TROLLEY_STEPS;
  if (!t.accepted || t.thresholdIndex === null) return TROLLEY_STEPS;
  return t.thresholdIndex;
}

/** Normalises an index to [0,1] by dividing by the ladder length. */
function norm(idx: number, steps: number): number {
  return Math.max(0, Math.min(1, idx / steps));
}

/**
 * The interim Blocks-1–3 descriptive snapshot.
 *
 * Numeric scores (all 0–1):
 *   vulnerabilitySensitivityScore     — does a vulnerable context raise the bar?
 *                                       (Block 1 shelter-vs-neutral + Block 3 low- vs high-buffer)
 *   wealthContextPermissivenessScore  — more permissive when the counterparty is wealthy? (Block 1)
 *   harmReluctanceScore               — general reluctance to cause harm (Block 2, both phases)
 *   directnessAversionScore           — higher bar for direct vs indirect harm? (Block 2)
 *   scaleSensitivityScore             — threshold shifts with group size? (Block 3 low-buffer spread)
 *   consistencyAcrossDomainsScore     — do the vulnerability signals agree across blocks?
 *
 * Flags:
 *   protectsVulnerableStrongly        — vulnerabilitySensitivity ≥ 0.62 OR shelter beyond range
 *   refusedBridge / refusedLever      — never acted in that Block-2 phase
 *   refusedAnyRollout                 — at least one Block-3 cell was never approved
 *   refusedAllLowBufferRollouts       — every low-buffer cell was never approved
 *   mostRestrictiveLowBufferSize      — low-buffer group size that required the highest gain
 *
 * Raw snapshots (for the calculation modal / analysis):
 *   moneyIndices        — { sidewalk, wealthy, shelter }
 *   trolleyIndices      — { lever, bridge }
 *   aiWorkforceIndices  — all 6 (workerGroup × size) comparable gain indices,
 *                         keyed threshold_lowbuffer_small … threshold_highbuffer_large
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
  refusedAnyRollout: boolean;
  refusedAllLowBufferRollouts: boolean;
  mostRestrictiveLowBufferSize: WorkerGroupSizeKey | null;
  moneyIndices: Record<string, number>;
  trolleyIndices: { lever: number; bridge: number };
  aiWorkforceIndices: Partial<Record<string, number>>;
  /**
   * Idea B (light secondary): prosocial-donation signal from Block 1's exact non-keep action.
   * 1 = chose "donate" in the shelter context · 0.5 = donated in any context · 0 = never donated.
   * Used ONLY as a small boost to Vulnerability protection (not Context). Return/Leave map to no
   * sensitivity (no honesty/passivity dimension exists) and are kept for descriptive analysis only.
   */
  block1DonationSignal: number;
}

/**
 * deriveMoralProfile — builds the interim snapshot from Blocks 1–3.
 * Block-3 quantities come from computeAIWorkforceAnalysis (single source of truth).
 */
export function deriveMoralProfile(
  money: MoneyBlockResults,
  trolley: TrolleyBlockResults,
  aiWorkforce: AIWorkforceBlockResults,
): MoralProfile {
  const sidewalkIdx = toMoneyComparableIndex(money.thresholds.threshold_sidewalk);
  const wealthyIdx = toMoneyComparableIndex(money.thresholds.threshold_wealthy);
  const shelterIdx = toMoneyComparableIndex(money.thresholds.threshold_shelter);

  // ── Idea B: prosocial-donation signal from Block 1's exact non-keep action ──
  // "donate near the shelter" = prosocial toward the vulnerable (strong); any donation = mild.
  // Return/Leave carry no sensitivity (no honesty/passivity dimension) — recorded for analysis only.
  const donations = money.history.filter((h) => h.action === "donate");
  const block1DonationSignal = donations.some((h) => h.contextKey === "shelter")
    ? 1
    : donations.length > 0
      ? 0.5
      : 0;

  const leverIdx = toTrolleyComparableIndex(trolley.leverThreshold);
  const bridgeIdx = toBridgeComparableIndex(trolley.bridgeThreshold);

  // ── Block 3 — derived once via the canonical analysis ──
  const ai = computeAIWorkforceAnalysis(aiWorkforce);
  const avgLowBuffer = ai.avgLowBufferIndex;
  const avgHighBuffer = ai.avgHighBufferIndex;

  // Flatten the per-cell indices into a stable, analysis-ready map.
  const aiWorkforceIndices: Partial<Record<string, number>> = {};
  (["low_buffer", "high_buffer"] as const).forEach((gt) => {
    WORKER_GROUP_SIZES.forEach((gs) => {
      const key = aiWorkforceThresholdKeyFor(gt, gs.key);
      aiWorkforceIndices[key] = ai.indexByKey[gt]?.[gs.key] ?? GAIN_STEPS;
    });
  });

  // ── Vulnerability sensitivity ──
  // Demanded more gain to harm low-buffer than high-buffer workers (Block 3),
  // and/or a higher bar to keep money outside a shelter than on a neutral sidewalk (Block 1).
  const bufferGap = (avgLowBuffer - avgHighBuffer) / GAIN_STEPS;
  const moneyVulnGap = norm(shelterIdx, MONEY_STEPS) - norm(sidewalkIdx, MONEY_STEPS);
  const vulnerabilitySensitivityScore = clamp01(
    0.5 + 0.5 * (0.5 * bufferGap + 0.5 * moneyVulnGap),
  );

  // ── Wealth-context permissiveness ── (more lenient when counterparty is wealthy)
  const wealthContextPermissivenessScore = clamp01(
    0.5 + 0.5 * (norm(sidewalkIdx, MONEY_STEPS) - norm(wealthyIdx, MONEY_STEPS)),
  );

  // ── Harm reluctance ── (needs many lives saved before acting; both phases equal weight)
  const leverRefused = leverIdx >= TROLLEY_STEPS;
  const bridgeRefused = bridgeIdx >= TROLLEY_STEPS;
  const harmReluctanceScore = clamp01(
    0.5 * (leverIdx / TROLLEY_STEPS) + 0.5 * (bridgeIdx / TROLLEY_STEPS),
  );

  // ── Directness aversion ── (needed more lives to push than to pull; 0.5 = equal)
  const directnessAversionScore = clamp01((bridgeIdx - leverIdx) / TROLLEY_STEPS + 0.5);

  // ── Scale sensitivity ── (how far the low-buffer threshold moved across sizes)
  const scaleSensitivityScore = clamp01(ai.lowBufferSpread / GAIN_STEPS);

  // ── Consistency across domains ── (do the three vulnerability signals agree?)
  const moneyVulnNorm = 1 - norm(shelterIdx, MONEY_STEPS);
  const lowBufferVulnNorm = 1 - avgLowBuffer / GAIN_STEPS;
  const harmReluctanceNorm = harmReluctanceScore;
  const meanSens = (moneyVulnNorm + lowBufferVulnNorm + harmReluctanceNorm) / 3;
  const variance =
    (Math.pow(moneyVulnNorm - meanSens, 2) +
      Math.pow(lowBufferVulnNorm - meanSens, 2) +
      Math.pow(harmReluctanceNorm - meanSens, 2)) /
    3;
  const consistencyAcrossDomainsScore = clamp01(1 - Math.sqrt(variance) * 2);

  // ── Flags ──
  const protectsVulnerableStrongly =
    vulnerabilitySensitivityScore >= 0.62 || shelterIdx >= MONEY_STEPS;

  // A cell counts as "not approved" when its comparable index hits the sentinel.
  const lowBufferIdx = WORKER_GROUP_SIZES.map(
    (gs) => aiWorkforceIndices[aiWorkforceThresholdKeyFor("low_buffer", gs.key)] ?? GAIN_STEPS,
  );
  const refusedAllLowBufferRollouts = lowBufferIdx.every((i) => i >= GAIN_STEPS);
  const refusedAnyRollout = Object.values(aiWorkforceIndices).some(
    (i) => (i ?? GAIN_STEPS) >= GAIN_STEPS,
  );

  // Which low-buffer size required the highest gain (most restrictive)?
  const lowBufferSizes: { key: WorkerGroupSizeKey; idx: number }[] = WORKER_GROUP_SIZES.map(
    (gs) => ({
      key: gs.key,
      idx: aiWorkforceIndices[aiWorkforceThresholdKeyFor("low_buffer", gs.key)] ?? GAIN_STEPS,
    }),
  );
  lowBufferSizes.sort((a, b) => b.idx - a.idx);
  const mostRestrictiveLowBufferSize =
    lowBufferSizes[0] && lowBufferSizes[0].idx > 0 ? lowBufferSizes[0].key : null;

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
    refusedAnyRollout,
    refusedAllLowBufferRollouts,
    mostRestrictiveLowBufferSize,
    moneyIndices: { sidewalk: sidewalkIdx, wealthy: wealthyIdx, shelter: shelterIdx },
    trolleyIndices: { lever: leverIdx, bridge: bridgeIdx },
    aiWorkforceIndices,
    block1DonationSignal,
  };
}

/** Clamp to [0,1]; NaN → 0. */
function clamp01(v: number): number {
  return Number.isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
}

/** Human-readable strength label for any 0–1 score. */
export function describeScore(score: number): string {
  if (score >= 0.75) return "strong";
  if (score >= 0.55) return "moderate";
  if (score >= 0.35) return "mild";
  return "low";
}
