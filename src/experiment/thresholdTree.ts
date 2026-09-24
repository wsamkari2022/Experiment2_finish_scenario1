/**
 * thresholdTree.ts — The User Value Profile engine (single source of truth)
 * ════════════════════════════════════════════════════════════════════════════
 * Blocks 1–4 are a PRE-EXPERIMENT value-profiling stage. Their only job is to
 * build one integrated User Value Profile — the seven moral "sensitivities" —
 * that Block 5 (the real experiment) then uses. This module is where that
 * profile is assembled. It is intentionally the ONE place the seven scores are
 * computed, so the math can be audited and explained in the dissertation.
 *
 * DESIGN (Approved Changes 2, 3, 7, 8) — the multi-block contribution model.
 * Every block contributes, directly or indirectly, and every sensitivity is
 * estimated from the richest available evidence. Each block has a clear "home"
 * sensitivity (so no single block dominates unjustifiably) plus justified
 * secondary signals. The two meaningless duplications the audit flagged
 * (context≡vulnerability, outcome≡group-size) are removed: each sensitivity now
 * draws on a DISTINCT signal.
 *
 *   Sensitivity              Primary signal                     Secondary signal(s)
 *   ───────────────────────  ─────────────────────────────────  ───────────────────────────
 *   Vulnerability protection B3 low- vs high-buffer gain gap     B1 shelter-vs-neutral; B4 moved-by-harmed
 *   Group size               B3 threshold spread across sizes    —
 *   Gain responsiveness      B3 overall gain level (inverted)    B4 moved-by-beneficiary
 *   Outcome aggregation      B2 trolley sacrifice-willingness     —
 *   Directness               B2 bridge-vs-lever gap              —
 *   Context                  B1 spread across the 3 contexts     —
 *   Stakeholder shift        B4 decision change + confidence     B4 reported influence
 *
 *   Block "homes":  B1 → Context, B2 → Directness + Outcome aggregation,
 *                   B3 → Vulnerability + Group size + Gain responsiveness,
 *                   B4 → Stakeholder shift.  (B1 and B4 are no longer near-unused.)
 *
 * All scores are integers 0–100; higher always means "more of that sensitivity". Every
 * sensitivity is on a common 0-BASELINE scale: 0 = the factor did not move the participant at
 * all, and NOTHING is centered at 50 — so a participant who treats direct and indirect harm
 * identically scores 0 directness (not 50), and a spread-based dimension like context can
 * legitimately rank above directness. The full rationale + every weight is in userValueModel.md.
 *
 * Two shapes of 0-baseline are used, and which one applies depends on whether the reverse
 * direction is a MEANINGFUL SIGNAL or merely the ABSENCE of the value:
 *
 *   DIRECTIONAL — max(0, gap). Used for vulnerability protection, where the reverse direction
 *     (demanding LESS to harm the more vulnerable group) is not a different kind of
 *     protectiveness; it is simply the absence of it, and belongs at 0.
 *
 *   MAGNITUDE — |gap| or (max − min). Used for context, group size and — since Block 2's two
 *     phases became independent — directness. Here the reverse direction is a real signal: a
 *     participant who needs FEWER lives at stake to push than to pull is moved just as strongly
 *     by directness as one who needs more; only the sign differs. The sign is preserved
 *     separately on the Block 2 record (`directnessGapIndex` / `directnessDirection`) and is
 *     deliberately never folded into the score. See blocksLegacyMethodology.ts.
 *
 * The tree is displayed on FinalMoralAnalysisPage (RankedThresholdTree.tsx) and
 * converted into the Block5UserProfile by extractBlock5Profile (block5Profile.ts).
 *
 * ============================================================================
 * START HERE:  docs/MEASUREMENT_MODEL.md
 * ============================================================================
 * That document is the map for this whole file — what every equation computes, why that
 * equation and not another, and how the numbers travel from a participant's first click to the
 * Block 5 alignment scores. Every formula below also carries its own reasoning above it.
 *
 * THE SEVEN ARE USED IN THREE SEPARATE COMPARISONS, never as one pool:
 *
 *   POLICY   vulnerability · group size · gain · outcome
 *            compared with each other and with option fingerprints, to score alignment in
 *            Block 5 and to decide which value the CVR says an option violated.
 *   FRAMING  context · directness
 *            compared only with EACH OTHER, to pick the CVR reflection lens (chooseFraming).
 *   VOICE    stakeholder shift
 *            used alone against absolute cutoffs, to pick whose voice speaks (chooseWho).
 *
 * Each group needed its own fairness test, and they are not interchangeable.
 */

import { computeAIWorkforceAnalysis, GAIN_STEPS as AI_GAIN_STEPS } from "./aiWorkforceAnalysis";
import {
  WORKER_GROUP_SIZES,
  type AIWorkforceBlockResults,
  type WorkerGroupKey,
  type WorkerGroupSizeKey,
} from "./aiWorkforceTypes";
import { MONEY_STEPS, TROLLEY_STEPS, type MoralProfile } from "./profileAnalysis";
import type { Block4DecisionRecord } from "./finalAnalysis";
import { BLOCK2_LEGACY_PAIRED_BRIDGE } from "./blocksLegacyMethodology";
import { calibrateSensitivity } from "./sensitivityCalibration";

/** Re-exported for callers that referenced the Block-3 gain-ladder length here. */
export const GAIN_STEPS = AI_GAIN_STEPS;

/** Clamp to [0,1]; NaN → 0. */
function clamp01(v: number): number {
  return Number.isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
}
/** Scale a [0,1] value to an integer 0–100. */
/**
 * Converts an internal 0-1 signal to the 0-100 score used everywhere downstream.
 * Clamped first, so a blend that overshoots (Block 1's additive vulnerability facets can) is
 * capped rather than producing an out-of-range score.
 */
function to100(v: number): number {
  return Math.round(clamp01(v) * 100);
}

/**
 * One piece of evidence for a sensitivity: a normalized [0,1] value, a relative
 * weight, whether it is actually available for this participant, and a label.
 */
interface Signal {
  block: "Block 1" | "Block 2" | "Block 3" | "Block 4";
  label: string;
  value: number;   // normalized 0–1 (higher = stronger sensitivity)
  weight: number;  // relative importance among this sensitivity's signals
  available: boolean;
}

/**
 * Availability-aware weighted mean. Absent signals are EXCLUDED and the weights
 * of the present signals are renormalized — so a missing optional signal never
 * silently drags a score toward zero. If nothing is available we return the
 * neutral midpoint 0.5 (documented behavior; in practice the primary signals
 * are always present because Blocks 1–3 are mandatory).
 */
/**
 * Combines several raw signals into one sensitivity: a weighted mean over the AVAILABLE ones.
 *
 * WHAT: Σ(weight x value) / Σ(weight), taken only over signals that were actually measured.
 * Returns the neutral 0.5 when nothing at all is available.
 *
 * WHY THE WEIGHTS ARE WHAT THEY ARE: they encode EVIDENCE STRENGTH, not preference. A rich
 * direct measure (Block 3's 2x3 gain matrix — 36 questions) outweighs a single contextual
 * contrast (Block 1's shelter-vs-sidewalk — 2 thresholds), which outweighs a soft reflective
 * self-report (Block 4's named influence). The tiers are approximately 0.55 / 0.30 / 0.15.
 * A weight is never a statement that one value matters more than another; it is a statement
 * about how much the instrument actually learned from that question.
 *
 * WHY RE-NORMALIZING BY THE AVAILABLE WEIGHT MATTERS: some signals only exist for some
 * participants — Block 4's secondary signals require that an influential voice was named AND
 * its valence recorded. When a signal is missing it is DROPPED and the remaining weights are
 * rescaled to sum to 1. Scoring a missing measurement as 0 would be wrong: absence of evidence
 * is not evidence of absence, and it would silently penalize anyone who skipped an optional step.
 */
function blend(signals: Signal[]): number {
  const active = signals.filter((s) => s.available && Number.isFinite(s.value));
  if (active.length === 0) return 0.5;
  const wsum = active.reduce((a, s) => a + s.weight, 0);
  if (wsum <= 0) return 0.5;
  return active.reduce((a, s) => a + s.weight * clamp01(s.value), 0) / wsum;
}

/** A single sensitivity in the ranked User Value Profile. */
export interface ThresholdTreeDimension {
  key: string;        // internal snake_case key (mapped to a Block5SensitivityKey)
  label: string;
  score: number;      // 0–100
  rank: number;       // 1 = strongest
  rationale: string;  // one plain-English sentence
  derivation: string; // formula with the participant's real values substituted
  /** The signals that fed this score, for transparency/CVR-cube display. */
  contributions: { block: string; label: string; value: number; weight: number }[];
  /** The other values that share this exact score. Absent when there is no tie. See TIE_RULE. */
  tiedWith?: string[];
  /**
   * false when none of the comparisons behind this value could be measured, because every one of
   * them was two refusals. Its score is then NOT_MEASURED_SCORE. Absent on trees stored before
   * 24 September 2026, which never marked it.
   */
  measured?: boolean;
}

/**
 * The score a POLICY value gets when Blocks 1-4 could not measure it: the middle of the common
 * ruler. "We do not know" must not read as "cares not at all". Block 5's own `scoreOf` uses the same
 * 50 for a value it cannot find.
 */
export const NOT_MEASURED_SCORE = 50;

/**
 * What a value scores when it was not measured. Two different answers, on purpose (24 September
 * 2026, researcher's decision):
 *
 *   vulnerability protection and group size -> NOT_MEASURED_SCORE (50). They are POLICY values: the
 *     fit score weights every shortfall by the participant's own score, so at 0 the value would
 *     vanish from the fit altogether, and somebody who refused to harm anyone at any price would
 *     again find that every option "fits" them perfectly.
 *   directness and context -> 0. They only choose which CVR lens is shown first, where a tie now
 *     goes to the participant's own fair coin (chooseFraming in block5CVR.ts), so 0 does no harm;
 *     and in an analysis a 50 would read as a real middle answer. The flag `measured: false` is
 *     what says the 0 was not measured.
 */
export function notMeasuredScore(key: string): number {
  return key === "directness" || key === "context" ? 0 : NOT_MEASURED_SCORE;
}

/** The complete ranked User Value Profile. */
export interface ThresholdTree {
  dimensions: ThresholdTreeDimension[];
  overallSensitivityIndex: number;
  primaryDriver: ThresholdTreeDimension | null;
  secondaryDriver: ThresholdTreeDimension | null;
  /** Every group of values that shared a score, in rank order. Empty when nothing tied. */
  tiedValues?: string[][];
  /** How those ties were ordered. Optional only so that trees stored before 24 September parse. */
  tieRule?: string;
}

/**
 * Rank-proportional weight used for the overall composite index.
 *   weight(rank) = (N + 1 − rank) / (N(N+1)/2)
 * The strongest sensitivity gets the largest share, decreasing linearly; the N
 * weights sum to exactly 1.0 by construction. Derived from the dimension count —
 * no magic numbers. (block5Profile.ts mirrors this for profile metadata.)
 */
/**
 * Triangular weight for a dimension's RANK, used for the composite score and carried into the
 * Block 5 profile.
 *
 * WHAT: (n + 1 − rank) / (n(n+1)/2). With 7 dimensions the ranks receive 7/28, 6/28 … 1/28,
 * which sum to exactly 1.
 *
 * WHY TRIANGULAR: the intent is that a participant's leading value counts for more than their
 * seventh, with a smooth decline rather than a cliff. A triangular series is the simplest
 * weighting with that property, needs no tuning parameter, and always normalizes to 1 for any
 * number of dimensions — so adding an eighth sensitivity later requires no change here.
 *
 * TIES: about 10% of participants tie for their top dimension. Until 24 September 2026 the tie was
 * broken by list order, which always favored vulnerability; it is now broken by a coin made from
 * the participant's own answers and recorded on the tree. See TIE_RULE and buildThresholdTree.
 */
export function rankWeight(rank: number, dimensionCount: number): number {
  const triangular = (dimensionCount * (dimensionCount + 1)) / 2;
  return (dimensionCount + 1 - rank) / triangular;
}

/** Human-readable intensity band for a 0–100 score. */
export function describeLevel(score: number): "strong" | "moderate" | "mild" | "low" {
  if (score >= 75) return "strong";
  if (score >= 55) return "moderate";
  if (score >= 35) return "mild";
  return "low";
}

function pct(v: number): string {
  return (clamp01(v) * 100).toFixed(0) + "%";
}

/**
 * buildThresholdTree — assemble the seven sensitivities from all four blocks.
 *
 * Inputs:
 *  - profile   : the interim Blocks-1–3 snapshot (provides Block-1 money indices
 *                and Block-2 trolley indices, already normalized once upstream).
 *  - aiResults : raw Block-3 results; Block-3 quantities are derived ONCE via
 *                computeAIWorkforceAnalysis (single source of truth). null → the
 *                three B3-primary signals fall back to neutral and are flagged.
 *  - block4    : the (possibly enriched) Block-4 decision record.
 */
export function buildThresholdTree(
  profile: MoralProfile,
  aiResults: AIWorkforceBlockResults | null,
  block4: Block4DecisionRecord,
): ThresholdTree {
  // ── BLOCK 1 (Money) signals ───────────────────────────────────────────────
  // Source: 3 places (neutral sidewalk / wealthy financial district / outside a homeless
  // shelter) x 8 amounts ($0.25 … $10,000). Each place restarts the ladder at $0.25, so the
  // three thresholds are independent measurements. Index 8 = "kept it at no amount".
  const { sidewalk, wealthy, shelter } = profile.moneyIndices;
  const ctxIdx = [sidewalk, wealthy, shelter];

  /**
   * CONTEXT SENSITIVITY — sole source. Does WHERE you found the money change your answer?
   *
   * WHAT: the spread (largest minus smallest) of the three keep-thresholds, as a fraction of
   * the ladder. 0 = the place made no difference; 1 = it made the maximum possible difference.
   *
   * WHY A RANGE AND NOT A SLOPE: the three places are UNORDERED. Sidewalk → wealthy district →
   * shelter is not a scale from low to high, it is three different situations, so there is no
   * direction in which to take a slope. For an unordered factor the honest question is "did
   * your answer move at all across the settings?", and the range is exactly that.
   *
   * Contrast Block 3's group sizes (10 → 1,000 → 100,000), which ARE ordered and therefore get
   * a signed slope. The difference is not stylistic — it is what each factor permits.
   *
   * KNOWN LIMITATION: a range is non-negative, so it rises with any variation including noise.
   * A random responder scores 55/100 on this raw measure. The Stage 2 calibration fixes the
   * cross-dimension comparison but not the underlying coarseness: with 3 places on an 8-rung
   * ladder the statistic has only 9 possible values. A fourth place would help most.
   */
  const contextSpread = (Math.max(...ctxIdx) - Math.min(...ctxIdx)) / MONEY_STEPS;
  /* A REFUSAL IS NOT A ZERO, for context too (24 September 2026, researcher's approval). Somebody who
     would keep found money at NO amount in all three places has a spread of 0 only because all three
     answers are off the top of the scale - whether the place matters to them was never observed. The
     value is marked not measured. Its score stays 0 by the researcher's decision; see
     notMeasuredScore. Two "never" answers and one real one still measure a spread, as a lower bound. */
  const contextMeasured = !ctxIdx.every((i) => i >= MONEY_STEPS);
  /**
   * VULNERABILITY PROTECTION — Block 1 facet, weight 0.30 of that sensitivity.
   *
   * WHAT: how much this participant's willingness to keep found money tracks the NEED of the
   * person who probably lost it. Three sub-signals, all on a 0-baseline:
   *
   *   PRIMARY  shelterContrast — more reluctant to pocket money outside a homeless shelter
   *            than on a neutral sidewalk. This is the cleanest need contrast the block offers.
   *   LIGHT A  wealthyPermissiveness (x0.20) — keeps money more readily when the likely owner
   *            is wealthy than when neutral. A supporting facet, from data already collected.
   *   LIGHT B  donationSignal (x0.20) — chose to DONATE rather than keep, especially near the
   *            shelter. A prosocial-toward-the-vulnerable signal. "Return" and "Leave" map to no
   *            sensitivity: they are honest or passive, not protective, and there is no honesty
   *            dimension in this model. They are retained for descriptive analysis only.
   *
   * WHY max(0, …) AND NOT |…|: vulnerability protection is a ONE-WAY construct. Being more
   * reluctant near a shelter is protection. Being LESS reluctant is not "reverse protection" —
   * it is the absence of protection, and belongs at zero.
   *
   * This is deliberately different from directness below, where the reverse direction IS a real
   * effect and the absolute value is used. Whether a construct is one-way or two-way is a
   * judgment about meaning, made explicitly per dimension — never a default.
   *
   * WHY ADDITIVE AND CAPPED: the two light signals can only REINFORCE the shelter base, never
   * dilute it, and each contributes at most 0.20 x 0.30 ≈ 6% of the final vulnerability score.
   * Both are routed into vulnerability rather than context, so that the same Block 1 data does
   * not inflate context sensitivity as well — which would double-count it and unbalance the
   * context↔directness comparison that picks the CVR framing lens.
   */
  /*
   * A REFUSAL IS NOT A ZERO (24 September 2026, researcher's approval) — Block 1's part of it.
   *
   * "Never kept it" is stored as the rung after the top. Two nevers subtract to 0, which used to be
   * read as "the place made no difference to you". It says nothing of the kind: somebody who would
   * keep money at NO amount, on the sidewalk and outside the shelter alike, has shown no contrast
   * because both answers are off the top of the scale. The contrast was never measured.
   *
   * So a contrast whose two answers are both "never" is MEASURED: FALSE. Its value is still 0, so
   * nothing is added, but it no longer counts as evidence; if none of Block 1's three parts was
   * measured, the Block 1 signal is dropped from the blend below, exactly as a missing Block 4
   * signal already is. A donation is a real act and always counts as measured.
   */
  const neverKept = (i: number) => i >= MONEY_STEPS;
  const shelterContrastMeasured = !(neverKept(shelter) && neverKept(sidewalk));
  const wealthyContrastMeasured = !(neverKept(sidewalk) && neverKept(wealthy));
  const shelterContrast = shelterContrastMeasured ? Math.max(0, shelter - sidewalk) / MONEY_STEPS : 0;
  const wealthyPermissiveness = wealthyContrastMeasured // Idea A
    ? Math.max(0, sidewalk - wealthy) / MONEY_STEPS
    : 0;
  const vulnB1Measured =
    shelterContrastMeasured || wealthyContrastMeasured || profile.block1DonationSignal > 0;
  const vulnB1 = clamp01(
    shelterContrast + 0.2 * wealthyPermissiveness + 0.2 * profile.block1DonationSignal, // + Idea B
  );

  // ── BLOCK 2 (Trolley) signals ─────────────────────────────────────────────
  // Source: 2 phases (pull a lever / push a person from a bridge) x 8 life-counts (1 … 10,000).
  // Both phases now walk the FULL ladder from 1, independently, and the bridge phase always runs
  // even when the lever was refused at every rung. Index 8 = "never acted".
  //
  // WHY INDEPENDENT PHASES MATTER HERE: under the original design the bridge opened at the rung
  // the lever was accepted at, which made "bridge >= lever" impossible to violate. That was an
  // artifact of the procedure, not a finding about the participant. Independent ladders turn the
  // direct-vs-indirect comparison into an actual measurement. See blocksLegacyMethodology.ts.
  const leverIdx = profile.trolleyIndices.lever;
  const bridgeIdx = profile.trolleyIndices.bridge;
  // Directness = how far apart the DIRECT act (push) and the indirect one (pull) sit for this
  // participant. 0-baseline is preserved: identical thresholds → 0, never 0.5, so directness is
  // not structurally inflated above context / group-size and chooseFraming() stays balanced.
  //
  // CURRENT (independent Block 2)  — MAGNITUDE: |bridge − lever|.
  //   Both phases now walk the full ladder, so the bridge threshold can legitimately land BELOW
  //   the lever's. Such a participant is strongly moved by directness, just in the opposite
  //   direction; scoring them 0 would make them indistinguishable from someone who draws no
  //   distinction at all. The DIRECTION is not lost — it is recorded on the Block 2 result as
  //   directnessGapIndex / directnessDirection, for analysis to use.
  //
  // ORIGINAL (paired Block 2)      — DIRECTIONAL: max(0, bridge − lever).
  //   Under that design the bridge could never be accepted below the lever, so the clamp never
  //   actually fired; it only became lossy once the phases were made independent.
  //
  // See blocksLegacyMethodology.ts for the full rationale and the one-line revert.
  const directnessGapRungs = bridgeIdx - leverIdx;
  /* A REFUSAL IS NOT A ZERO, for directness too (24 September 2026). Never pulling AND never pushing,
     at any number of lives, gives a gap of 0 only because both answers are off the top of the scale:
     whether pushing feels different from pulling was never observed. Not measured; the score stays 0
     by the researcher's decision (see notMeasuredScore). One "never" and one real answer still
     measure a gap, as a lower bound. */
  const directnessMeasured = !(leverIdx >= TROLLEY_STEPS && bridgeIdx >= TROLLEY_STEPS);
  const directnessB2 = BLOCK2_LEGACY_PAIRED_BRIDGE
    ? Math.max(0, directnessGapRungs) / TROLLEY_STEPS
    : Math.abs(directnessGapRungs) / TROLLEY_STEPS;
  /**
   * OUTCOME AGGREGATION — sole source. How much do you weigh the total result?
   *
   * WHAT: the mean of the two trolley thresholds, inverted. Acting to save FEWER lives means
   * accepting a definite harm for a smaller aggregate gain — the canonical utilitarian test —
   * so a LOW threshold indicates HIGH outcome-aggregation thinking, and the ratio is subtracted
   * from 1.
   *
   * WHY THE MEAN OF BOTH PHASES: the construct is about weighing totals, which is present in
   * both the lever and the bridge framing. Using one phase alone would confound it with
   * directness, which is precisely the difference between the two.
   *
   * WHY THE MEAN IS NOW HONEST: under the paired design the bridge could not fall below the
   * lever, so this average was biased upward and the score correspondingly deflated. With
   * independent phases it is an unbiased mean of two free measurements. Scores on this
   * dimension are therefore NOT comparable with anything collected under the old design.
   *
   * KNOWN LIMITATION: single source. Two questions carry the whole dimension.
   */
  const avgTrolley = (leverIdx + bridgeIdx) / 2;
  const aggregationB2 = 1 - avgTrolley / TROLLEY_STEPS;

  // ── BLOCK 3 (AI-Workforce) signals — ONE source of truth ──────────────────
  const ai = aiResults ? computeAIWorkforceAnalysis(aiResults) : null;
  const aiAvailable = ai !== null;
  const avgLB = ai ? ai.avgLowBufferIndex : GAIN_STEPS / 2;
  const avgHB = ai ? ai.avgHighBufferIndex : GAIN_STEPS / 2;
  const overallGain = (avgLB + avgHB) / 2;

  /*
   * A REFUSAL IS NOT A ZERO — Block 3's part (24 September 2026, researcher's approval).
   *
   * Both Block 3 contrasts subtract two answers. When BOTH answers are "never approved", the
   * subtraction gives 0, and that 0 used to be read as "no difference". It is not a difference of
   * zero; it is two answers off the top of the scale, and the difference between them is unknown.
   * A participant who refuses every rollout at every price used to score 0 on both of these values,
   * exactly like somebody the numbers made no difference to.
   *
   * So each contrast now uses only the comparisons that were actually measured:
   *   vulnerability — the entry-level minus senior gap, averaged over the group SIZES where at least
   *                   one of the two groups was approved at some price;
   *   group size    — the largest-minus-smallest slope, averaged over the worker GROUPS where at
   *                   least one of the two sizes was approved at some price.
   * When nothing was refused twice, both are exactly the numbers they always were (the mean of the
   * per-size gaps IS the gap of the means). A value with no measured comparison at all is not
   * measured, and scores the neutral NOT_MEASURED_SCORE instead of 0 — see the calibration step.
   *
   * A one-sided refusal still counts, as the lower bound it is: entry-level refused, senior approved
   * at rung 2, is a gap of at least 6 − 2 = 4 rungs, and 4 is what is used.
   */
  const neverApproved = (i: number) => i >= GAIN_STEPS;
  const cellOf = (group: WorkerGroupKey, size: WorkerGroupSizeKey): number =>
    ai?.indexByKey[group]?.[size] ?? GAIN_STEPS;
  const sizeKeys: WorkerGroupSizeKey[] = WORKER_GROUP_SIZES.map((s) => s.key);
  const smallest = sizeKeys[0];
  const largest = sizeKeys[sizeKeys.length - 1];
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const vulnSizesMeasured = ai
    ? sizeKeys.filter((s) => !(neverApproved(cellOf("low_buffer", s)) && neverApproved(cellOf("high_buffer", s))))
    : [];
  const vulnB3Measured = vulnSizesMeasured.length > 0;
  /* The gap of the two MEANS, not the mean of the gaps. They are equal on paper, but floating point
     can differ in the last digit, and a blend landing on x.5 then rounds the other way. This order
     is the arithmetic the formula always used, so a participant with no double refusal gets
     byte-identical scores (validate:profile, gate R3). */
  const bufferGapRungs = vulnB3Measured
    ? mean(vulnSizesMeasured.map((s) => cellOf("low_buffer", s)))
      - mean(vulnSizesMeasured.map((s) => cellOf("high_buffer", s)))
    : 0;

  const sizeGroupsMeasured = ai
    ? (["low_buffer", "high_buffer"] as WorkerGroupKey[]).filter(
        (g) => !(neverApproved(cellOf(g, smallest)) && neverApproved(cellOf(g, largest))),
      )
    : [];
  const groupSizeMeasured = sizeGroupsMeasured.length > 0;
  const sizeSlope = groupSizeMeasured
    ? mean(sizeGroupsMeasured.map((g) => cellOf(g, largest) - cellOf(g, smallest)))
    : 0;
  // Block 3 is a BALANCED 2x3 FACTORIAL: 2 worker groups x 3 group sizes, every cell presented,
  // every cell restarting at $1. That balance is what lets one block feed three different
  // sensitivities without them being three copies of the same number: the three signals below
  // are the standard ORTHOGONAL MAIN EFFECTS of such a design —
  //
  //     grand mean          → gain responsiveness   ("how high is your bar overall?")
  //     worker-type effect  → vulnerability          ("do you demand more for the replaceable?")
  //     size effect         → group size             ("do you demand more as more are affected?")
  //
  // Measured correlations between the three: -0.03, 0.00, 0.02. They are genuinely independent.
  //
  // WORDING NOTE: participants are told only "entry-level workers" and "senior-level workers,
  // such as the engineers who build these AI systems". They are NEVER told that entry-level
  // workers have less savings — that would put the answer in their mouth. The seniority
  // difference is a plain fact about the roles; the vulnerability judgment is left entirely to
  // the participant and is then read off the difference in their OWN thresholds. Evidence a
  // participant produces is far stronger than agreement with a statement we supplied.
  //
  // KEY NAMING: internal keys remain low_buffer / high_buffer (low_buffer = entry-level).

  /**
   * VULNERABILITY PROTECTION — Block 3 facet, weight 0.55 (the heaviest single signal).
   *
   * WHAT: the worker-type main effect — how much MORE gain was demanded before harming the
   * entry-level (more replaceable) group than the senior-level group, as a fraction of the
   * ladder. This is the richest evidence in the instrument: 36 questions behind one number.
   *
   * WHY max(0, …): one-way construct, exactly as in Block 1. Demanding more before harming the
   * more replaceable group is protection; demanding less is its absence, not its opposite.
   */
  const vulnB3 = Math.max(0, bufferGapRungs) / GAIN_STEPS;
  // Group size = how much MORE gain was demanded as the harmed group grew, as a fraction of
  // the ladder. Uses the signed slope (largest minus smallest), clamped at zero.
  //
  // It previously used the unsigned range (max − min) across the three sizes. That is not a
  // measure of size sensitivity: being non-negative by construction, it rises with any
  // variation at all. A uniformly random responder — someone with no preferences — scored
  // 57/100 on it, and in 54% of those cases the actual small-to-large trend was flat or
  // downward. The slope scores that same random responder 13/100, and is a proper main effect
  // of group size, which makes it orthogonal to the worker-type contrast feeding vulnerability
  // (their correlation falls from −0.16 to −0.04).
  const groupSizeB3 = Math.max(0, sizeSlope) / GAIN_STEPS;
  /**
   * GAIN RESPONSIVENESS — Block 3 facet, weight 0.80.
   *
   * WHAT: the grand mean of all six cells, inverted. A LOW bar means a small gain was enough to
   * move you, so gain responsiveness is high; approving at $1 is the maximum — you were moved by
   * almost nothing. A participant who refuses even $100M everywhere scores 0.
   *
   * WHY THE GRAND MEAN: this is the main effect of gain LEVEL, independent of which group or
   * which size — deliberately averaging away the two contrasts that feed the other dimensions.
   *
   * NOTE ON THE LADDER: it spans eight orders of magnitude ($1 → $100M) and the rungs are NOT
   * evenly spaced in dollars. This calculation never touches the dollar figures, only the rung
   * index, so the ladder values can be re-chosen without changing any formula. See the note on
   * GAIN_OPTIONS in aiWorkforceTypes.ts.
   */
  const gainB3 = 1 - overallGain / GAIN_STEPS;

  // ── BLOCK 4 (Stakeholder reflection) signals ──────────────────────────────
  // Source: ONE policy decision, made; then stakeholder perspectives are heard; then the
  // decision and the confidence in it are revisited. Unlike Blocks 1-3 there is no ladder here,
  // so the signals are event-based rather than threshold-based.
  //
  // KNOWN LIMITATION — this is the weakest-fed sensitivity in the instrument. decisionShift
  // below is a rare, all-or-nothing event and carries half the weight, so in practice the
  // stakeholder score is NEAR-BINARY: roughly 14 for anyone who does not change their decision,
  // roughly 60 for the ~15% who do, with very little in between. Because chooseWho() slices this
  // with absolute cutoffs at 40 and 70, the three stakeholder voices come out at about
  // 81% / 13% / 6% — the ladder of "someone you have known twenty years / a year / just met" is
  // mostly one rung. Re-anchoring the cutoffs does not fix it: three groups cannot be made from
  // a two-valued variable. The fix is more signal in Block 4 — graded per-voice influence
  // ratings rather than a single yes/no flip.
  const { initialDecision, midDecision, finalDecision, confidence } = block4;
  const hasDecisions = !!(initialDecision && finalDecision);
  /**
   * STAKEHOLDER SHIFT — signal 1 of 3, weight 0.50.
   *
   * WHAT: did hearing the stakeholders change the decision?
   *   1.0  a full flip — the final decision differs from the initial one
   *   0.5  a wobble that returned — the middle decision differed, the final one came back
   *   0    no movement at all
   *
   * WHY IT CARRIES HALF THE WEIGHT: actually reversing a decision after hearing someone is the
   * strongest available evidence that a perspective landed. A wobble counts half because
   * something moved but not enough to hold.
   */
  let decisionShift = 0;
  if (hasDecisions && initialDecision !== finalDecision) decisionShift = 1;
  else if (initialDecision && midDecision && midDecision !== initialDecision) decisionShift = 0.5;
  /**
   * STAKEHOLDER SHIFT — signal 2 of 3, weight 0.30.
   *
   * WHAT: how far the participant's confidence moved after hearing the stakeholders, as a
   * fraction of the widest possible move on a 1-5 scale (hence /4). ABSOLUTE value: becoming
   * less sure and becoming more sure are both evidence that the perspectives registered.
   *
   * WHY IT IS SEPARATE FROM THE DECISION: someone can be moved without changing their answer.
   * This catches that, and is the only signal here with any granularity.
   *
   * AVAILABILITY: dropped entirely (not scored 0) when no initial confidence was recorded —
   * a missing measurement is not evidence of absence. See blend().
   */
  const hasInitialConf = typeof block4.initialConfidence === "number";
  const confidenceMovement = hasInitialConf
    ? Math.abs((confidence ?? 3) - (block4.initialConfidence as number)) / 4
    : 0;
  /**
   * STAKEHOLDER SHIFT — signal 3 of 3, weight 0.20.
   *
   * WHAT: 1 if the participant named a perspective as most influential, else 0. The softest of
   * the three — self-report of being moved, rather than observed movement — hence the lowest
   * weight.
   */
  const reportedInfluence = block4.reportedInfluence === true ? 1 : 0;

  // B4 secondary signals (only when the influential voice's valence is recorded).
  const hasValence =
    block4.reportedInfluence === true &&
    (block4.influentialValence === "harmed" || block4.influentialValence === "benefited");
  // Moved-by-harmed → vulnerability: influential voice is the harmed party AND the
  // final decision protected them (do_not_proceed). Heard-but-not-protected = 0.3.
  const b4Vuln =
    hasValence && block4.influentialValence === "harmed"
      ? finalDecision === "do_not_proceed"
        ? 1
        : 0.3
      : 0;
  // Moved-by-beneficiary → gain responsiveness: influential voice is the
  // beneficiary AND the final decision proceeded (captured the gain). Else 0.3.
  const b4Gain =
    hasValence && block4.influentialValence === "benefited"
      ? finalDecision === "proceed"
        ? 1
        : 0.3
      : 0;
  const b4VulnAvailable = hasValence && block4.influentialValence === "harmed";
  const b4GainAvailable = hasValence && block4.influentialValence === "benefited";

  // ── Assemble each sensitivity from its signals ────────────────────────────
  // Weights encode EVIDENCE STRENGTH, not preference: a rich direct measure
  // (a 2×3 gain matrix) outweighs a single contextual contrast, which outweighs
  // a soft reflective signal. The tiers (≈0.55 / 0.30 / 0.15) are documented.

  const vulnSignals: Signal[] = [
    /* Available only when measured: a contrast between two refusals is not evidence. See above. */
    { block: "Block 3", label: "Entry- vs senior-level gain gap", value: vulnB3, weight: 0.55, available: vulnB3Measured },
    { block: "Block 1", label: "Need-sensitivity (shelter, wealthy-leniency, donations)", value: vulnB1, weight: 0.30, available: vulnB1Measured },
    { block: "Block 4", label: "Moved by the harmed stakeholder", value: b4Vuln, weight: 0.15, available: b4VulnAvailable },
  ];
  const gainSignals: Signal[] = [
    { block: "Block 3", label: "Overall gain level required (inverted)", value: gainB3, weight: 0.8, available: true },
    { block: "Block 4", label: "Moved by the benefiting stakeholder", value: b4Gain, weight: 0.2, available: b4GainAvailable },
  ];
  const stakeholderSignals: Signal[] = [
    { block: "Block 4", label: "Decision changed after stakeholders", value: decisionShift, weight: 0.5, available: hasDecisions },
    { block: "Block 4", label: "Confidence shifted", value: confidenceMovement, weight: 0.3, available: hasInitialConf },
    { block: "Block 4", label: "Named an influential perspective", value: reportedInfluence, weight: 0.2, available: block4.reportedInfluence !== undefined },
  ];

  const vulnerability = blend(vulnSignals);
  const vulnerabilityMeasured = vulnSignals.some((s) => s.available);
  const groupSize = clamp01(groupSizeB3);
  const gain = blend(gainSignals);
  const outcome = clamp01(aggregationB2);
  const directness = clamp01(directnessB2);
  const context = clamp01(contextSpread);
  const stakeholder = blend(stakeholderSignals);

  const single = (block: Signal["block"], label: string, value: number): Signal[] => [
    { block, label, value, weight: 1, available: true },
  ];

  // ── Build the seven dimensions (key matches block5Profile KEY_MAP) ────────
  const raw: Omit<ThresholdTreeDimension, "rank">[] = [
    {
      key: "vulnerability_protection",
      label: "Protecting the vulnerable",
      score: to100(vulnerability),
      rationale:
        "How strongly you protect the worse-off — drawn mainly from demanding more gain before harming entry-level workers (Block 3), reinforced by your Block-1 need-sensitivity (shelter reluctance, plus light support from leniency toward a wealthy owner and any donations).",
      derivation: vulnerabilityMeasured
        ? `blend(  B3 buffer-gap ${vulnB3Measured ? `${pct(vulnB3)} over ${vulnSizesMeasured.length} of ${sizeKeys.length} sizes` : "not measured"} ×0.55,`
          + `  B1 need-signal ${vulnB1Measured ? pct(vulnB1) : "not measured"} ×0.30` +
          (b4VulnAvailable ? `,  B4 moved-by-harmed ${pct(b4Vuln)} ×0.15 ) = ${to100(vulnerability)}/100` : ` ) = ${to100(vulnerability)}/100  (B4 signal absent → excluded)`)
        : "not measured: every Block 1 and Block 3 comparison behind this value was two refusals, and no Block 4 signal",
      contributions: vulnSignals.filter((s) => s.available).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
      measured: vulnerabilityMeasured,
    },
    {
      key: "group_size",
      label: "Reducing harm",
      score: to100(groupSize),
      rationale:
        "How much your approval threshold moved as the harmed group grew from ~10 to ~100,000 workers (Block 3). The one-directional (carry-forward) design means this captures how much MORE gain you demanded for larger groups.",
      derivation: groupSizeMeasured
        ? `max(0, size slope ${sizeSlope.toFixed(2)} over ${sizeGroupsMeasured.length} of 2 worker groups) / ${GAIN_STEPS} steps = ${to100(groupSize)}/100`
        : aiAvailable
          ? "not measured: both worker groups were refused at the smallest AND the largest size"
          : "not measured: Block 3 data missing",
      contributions: groupSizeMeasured
        ? single("Block 3", "Threshold spread across group sizes", groupSizeB3).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight }))
        : [],
      measured: groupSizeMeasured,
    },
    {
      key: "gain_responsiveness",
      label: "How much is gained",
      score: to100(gain),
      rationale:
        "How readily financial gain moved you toward approving harm — mainly the overall gain level you required across Block 3.",
      derivation:
        `blend(  B3 gain-level ${pct(gainB3)} ×0.8` +
        (b4GainAvailable ? `,  B4 moved-by-beneficiary ${pct(b4Gain)} ×0.2 ) = ${to100(gain)}/100` : ` ) = ${to100(gain)}/100  (B4 signal absent → excluded)`),
      contributions: gainSignals.filter((s) => s.available).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "outcome_aggregation",
      // "(Utility)" was dropped along with the rest of the jargon: "How many are helped" says
      // the same thing in words every participant already owns. The key is unchanged.
      label: "How many are helped",
      score: to100(outcome),
      rationale:
        "How much you weigh the total/aggregate outcome — measured by your willingness in Block 2 to act for fewer saved lives (trading a small harm for a net-positive result).",
      derivation: `1 − avg(lever ${leverIdx}, bridge ${bridgeIdx}) / ${TROLLEY_STEPS} = ${to100(outcome)}/100`,
      contributions: single("Block 2", "Trolley sacrifice-willingness", aggregationB2).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "directness",
      label: "Doing it yourself",
      score: to100(directness),
      rationale: BLOCK2_LEGACY_PAIRED_BRIDGE
        ? "How much being the DIRECT cause of harm matters — needing more lives at stake to push someone (direct) than to pull a lever (indirect) in Block 2."
        : "How much being the DIRECT cause of harm matters — how far apart your push threshold (direct) and your pull threshold (indirect) were in Block 2. The size of that gap is the sensitivity; which way it ran is recorded separately.",
      derivation: BLOCK2_LEGACY_PAIRED_BRIDGE
        ? `max(0, bridge ${bridgeIdx} − lever ${leverIdx}) / ${TROLLEY_STEPS} = ${to100(directness)}/100   (0 = no direct-vs-indirect distinction)`
        : `|bridge ${bridgeIdx} − lever ${leverIdx}| / ${TROLLEY_STEPS} = ${to100(directness)}/100   (0 = no direct-vs-indirect distinction; direction = ${
            directnessGapRungs > 0 ? "needed MORE to push" : directnessGapRungs < 0 ? "needed FEWER to push" : "none"
          })`,
      contributions: single("Block 2", "Bridge-vs-lever gap", directnessB2).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
      measured: directnessMeasured,
    },
    {
      key: "context",
      label: "Where it happens",
      score: to100(context),
      rationale:
        "How much surrounding circumstances reshape your choice — measured by how far your keep-threshold moved across the neutral, wealthy, and shelter contexts in Block 1.",
      derivation: `(max−min of [sidewalk ${sidewalk}, wealthy ${wealthy}, shelter ${shelter}]) / ${MONEY_STEPS} = ${to100(context)}/100`,
      contributions: single("Block 1", "Spread across the three contexts", contextSpread).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
      measured: contextMeasured,
    },
    {
      key: "stakeholder_shift",
      label: "Hearing someone's story",
      score: to100(stakeholder),
      rationale:
        "How much hearing a named person's perspective moves you — combining whether your Block-4 decision changed, how your confidence shifted, and whether you named an influential voice.",
      derivation:
        `blend(  decision-shift ${pct(decisionShift)} ×0.5` +
        (hasInitialConf ? `,  confidence-move ${pct(confidenceMovement)} ×0.3` : "") +
        (block4.reportedInfluence !== undefined ? `,  influence ${pct(reportedInfluence)} ×0.2` : "") +
        ` ) = ${to100(stakeholder)}/100`,
      contributions: stakeholderSignals.filter((s) => s.available).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
  ];

  // ── Put all seven on one ruler, then sort and rank ────────────────────────
  //
  // Up to this point each dimension carries its RAW score: the natural statistic for that
  // construct, divided by its ladder length. Those are not comparable with one another — some
  // are levels, which sit near the middle of their range by nature, and some are differences,
  // which are small by nature. Ranking them against each other, which is exactly what happens
  // on the next line, was therefore meaningless: the level-type dimensions won almost every
  // time regardless of the participant. See sensitivityCalibration.ts for the full argument
  // and the measurements.
  //
  // `calibrateSensitivity` re-expresses every dimension as the same quantity — how much of the
  // instrument's own response space this participant exceeds on that value — so the seven
  // become directly comparable. It is monotone, so no participant is reordered within a
  // dimension; only the number attached to that order changes.
  //
  // The raw score stays visible in the derivation string, so the calibrated number can always
  // be traced back to the answers that produced it.
  const calibrated = raw.map((d) => {
    const rawScore = d.score;
    /* NOT MEASURED. Every comparison behind the value was two refusals. What it then scores
       depends on the value - see notMeasuredScore - and the flag says which it was either way. */
    if (d.measured === false) {
      const score = notMeasuredScore(d.key);
      return {
        ...d,
        measured: false,
        score,
        derivation: `${d.derivation}   →  ${score}/100 (not measured)`,
      };
    }
    /*
     * HALF A STEP GETS HALF THE CREDIT OF ONE STEP (24 September 2026, researcher's approval).
     *
     * Group size is a slope in rungs, averaged over the two worker groups, so it comes in half
     * steps: 0, 0.5, 1, 1.5 ... Half of all random answer patterns sit at exactly 0, and the
     * calibration counts every one of them as "exceeded" by the smallest positive answer - so ONE
     * click, one rung higher in one cell, jumped from 0 straight to 55 and often became the
     * participant's #1 value, reordering every card in Block 5.
     *
     * The researcher's point was that the click still means something, so it is not set to 0. It
     * gets the credit it earns on a straight line from 0 to one full step: half a step is half of
     * the one-step score. One step or more is untouched. Half a step is the only value that can
     * fall between 0 and 1, so this is the whole of the rule.
     */
    if (d.key === "group_size" && sizeSlope > 0 && sizeSlope < 1) {
      const oneStep = calibrateSensitivity(d.key, to100(1 / GAIN_STEPS));
      const score = Math.round(sizeSlope * oneStep);
      return {
        ...d,
        measured: true,
        score,
        derivation: `${d.derivation}   →  ${sizeSlope} of a step = ${sizeSlope} × the one-step score ${oneStep} = ${score}/100 (raw ${rawScore})`,
      };
    }
    const score = calibrateSensitivity(d.key, rawScore);
    return {
      ...d,
      measured: true,
      score,
      derivation: `${d.derivation}   →  calibrated ${score}/100 (raw ${rawScore})`,
    };
  });

  /*
   * TIES ARE BROKEN BY A COIN, NOT BY THE ORDER THIS FILE LISTS THE VALUES IN (24 September 2026,
   * researcher's approval).
   *
   * A stable sort keeps tied values in the order of the `raw` array above: vulnerability, group
   * size, gain, outcome, directness, context, stakeholder. So every tie went the same way - always
   * to "protecting the vulnerable" first, the value the thesis is about - and about one participant
   * in ten ties for their top value. A reviewer could fairly call that a thumb on the scale.
   *
   * THE COIN. Each tied value is given a number from a hash of this participant's own answers and
   * the value's name, and the lower number goes first. It is:
   *   - fair: across participants each value wins a tie about half the time (validate:profile, T1);
   *   - fixed: the same answers give the same order every time, on every computer, in all three
   *     places the profile is built (ExperimentFlow, participantRecord, the final analysis page);
   *   - checkable: anybody can recompute it from the stored answers.
   * It uses no session id on purpose: a participant who moves to another computer keeps the same id
   * only if the resume copy says so, and a coin that changed mid-study would change the card order.
   *
   * Every tie is recorded, on the dimension (`tiedWith`) and on the tree (`tiedValues`), so an
   * analysis can see which rankings a coin decided.
   */
  const coin = tieCoinFor(profile, block4);
  const sorted = [...calibrated]
    .sort((a, b) => b.score - a.score || coin(a.key) - coin(b.key))
    .map((d, i) => ({ ...d, rank: i + 1 }));

  const tiedValues = tieGroups(sorted);
  for (const d of sorted) {
    const group = tiedValues.find((g) => g.includes(d.key));
    if (group) d.tiedWith = group.filter((k) => k !== d.key);
  }

  const n = sorted.length;
  const overall = sorted.reduce((sum, d) => sum + rankWeight(d.rank, n) * d.score, 0);

  return {
    dimensions: sorted,
    overallSensitivityIndex: Math.round(overall),
    primaryDriver: sorted[0] ?? null,
    secondaryDriver: sorted[1] ?? null,
    tiedValues,
    tieRule: TIE_RULE,
  };
}

/** Stored beside every tree, so a reader of the database knows how its ties were decided. */
export const TIE_RULE =
  "Tied values are ordered by a coin made from this participant's own Blocks 1-4 answers "
  + "(FNV-1a hash of the answers and the value's name, lower first). Fair across participants, "
  + "the same on every computer, and recomputable from the stored answers.";

/** FNV-1a, 32-bit. Small, fast and identical on every machine, which is all a coin needs. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Everything the participant answered in Blocks 1-4, as one string with a fixed order.
 *
 * Built from the comparable indices rather than from raw records, because those are what all three
 * callers share exactly. Missing optional Block 4 fields are written as empty, so `undefined` in one
 * caller and `null` in another still give the same coin.
 */
function answerFingerprint(profile: MoralProfile, block4: Block4DecisionRecord): string {
  const sortedPairs = (o: Partial<Record<string, number>> | undefined) =>
    Object.keys(o ?? {}).sort().map((k) => `${k}=${o?.[k] ?? ""}`).join(",");
  const t = profile.trolleyIndices ?? { lever: "", bridge: "" };
  const b4 = [
    block4.initialDecision, block4.midDecision, block4.finalDecision, block4.confidence,
    block4.initialConfidence, block4.reportedInfluence, block4.influentialValence,
  ].map((v) => (v === undefined || v === null ? "" : String(v))).join("/");
  return [
    `money:${sortedPairs(profile.moneyIndices)}`,
    `trolley:lever=${t.lever},bridge=${t.bridge}`,
    `workforce:${sortedPairs(profile.aiWorkforceIndices)}`,
    `donation:${profile.block1DonationSignal ?? ""}`,
    `block4:${b4}`,
  ].join("|");
}

function tieCoinFor(profile: MoralProfile, block4: Block4DecisionRecord): (key: string) => number {
  const fingerprint = answerFingerprint(profile, block4);
  return (key: string) => fnv1a(`${fingerprint}#${key}`);
}

/** Groups of two or more values that share a score, in rank order. */
function tieGroups(sorted: { key: string; score: number }[]): string[][] {
  const groups: string[][] = [];
  sorted.forEach((d, i) => {
    if (i > 0 && sorted[i - 1].score === d.score) groups[groups.length - 1].push(d.key);
    else groups.push([d.key]);
  });
  return groups.filter((g) => g.length > 1);
}
