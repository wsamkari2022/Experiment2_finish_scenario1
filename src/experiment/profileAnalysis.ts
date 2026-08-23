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
/**
 * Turns one Block 1 threshold into a COMPARABLE INDEX — the rung at which the participant
 * changed their mind, or the "never" sentinel.
 *
 * WHAT: the accepted rung (0 … MONEY_STEPS-1), or MONEY_STEPS when they never kept the money —
 * one step beyond the top rung.
 *
 * WHY THE INDEX AND NOT THE DOLLAR AMOUNT: the ladder is not linear in dollars ($0.25 → $10,000),
 * so averaging or subtracting the amounts would be meaningless. Every calculation in the model
 * uses the ordinal position, treating the rungs as equal steps of "one notch more persuasion
 * required". This is the standard reading of a staircase instrument, and it is why the ladder
 * values can be re-chosen without touching a single formula.
 *
 * WHY A SENTINEL ONE STEP BEYOND THE TOP: someone who refuses every rung is more demanding than
 * someone who accepted at the last one, so they must sort above them. MONEY_STEPS is the
 * smallest value that guarantees this.
 *
 * KNOWN LIMITATION — CENSORED DATA: "I would not keep it at any amount" is stored as though it
 * were exactly one notch above $10,000, and then averaged with real thresholds. The direction is
 * right; the magnitude is a floor, not a measurement. Worth stating in the methods chapter.
 */
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

  // ── Directness AVERSION ── (needed more lives to push than to pull; 0.5 = equal)
  //
  // DELIBERATELY DIFFERENT from the "Directness sensitivity" in thresholdTree.ts. Do not
  // "fix" one to match the other — they measure two different things:
  //
  //   directnessAversionScore (here)  — SIGNED, centred on 0.5. Answers "which way did this
  //     participant lean?": above 0.5 = more reluctant to push than to pull, below 0.5 = more
  //     willing to push than to pull. Descriptive only; feeds the interim profile preview and
  //     scenario selection, neither of which ranks it against other dimensions.
  //
  //   directness sensitivity (thresholdTree) — MAGNITUDE, |gap|, 0-baseline. Answers "how much
  //     did directness move this participant at all?". It is RANKED and WEIGHTED against the
  //     other six sensitivities in Block 5, so it must sit on the same 0 = "did not move me"
  //     footing as the rest; a 0.5-centred score there would inflate directness for everyone.
  //
  // Since Block 2's two phases became independent, a below-0.5 value is genuinely reachable
  // here for the first time (see blocksLegacyMethodology.ts). Under the original paired design
  // the bridge could not be accepted below the lever, so this score could never fall below 0.5.
  const directnessAversionScore = clamp01((bridgeIdx - leverIdx) / TROLLEY_STEPS + 0.5);

  // ── Scale sensitivity ── (how far the low-buffer threshold moved across sizes)
  // Signed slope, clamped at zero — see sizeSlopeForGroup in aiWorkforceAnalysis.ts for why
  // the unsigned range was replaced (it scored a random responder 57/100).
  const scaleSensitivityScore = clamp01(
    Math.max(0, ai.sizeSlopeLowBuffer) / GAIN_STEPS,
  );

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
