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
import type { AIWorkforceBlockResults } from "./aiWorkforceTypes";
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
}

/** The complete ranked User Value Profile. */
export interface ThresholdTree {
  dimensions: ThresholdTreeDimension[];
  overallSensitivityIndex: number;
  primaryDriver: ThresholdTreeDimension | null;
  secondaryDriver: ThresholdTreeDimension | null;
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
 * KNOWN LIMITATION: about 10% of participants tie for their top dimension, and the tie is broken
 * by list order rather than by their answers. topSensitivityKey is therefore decided by accident
 * for roughly one participant in ten.
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
  const shelterContrast = Math.max(0, shelter - sidewalk) / MONEY_STEPS;
  const wealthyPermissiveness = Math.max(0, sidewalk - wealthy) / MONEY_STEPS; // Idea A
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
  const sizeSlope = ai ? ai.sizeSlope : 0;
  const overallGain = (avgLB + avgHB) / 2;
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
  const vulnB3 = Math.max(0, avgLB - avgHB) / GAIN_STEPS;
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
    { block: "Block 3", label: "Entry- vs senior-level gain gap", value: vulnB3, weight: 0.55, available: true },
    { block: "Block 1", label: "Need-sensitivity (shelter, wealthy-leniency, donations)", value: vulnB1, weight: 0.30, available: true },
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
      derivation:
        `blend(  B3 buffer-gap ${pct(vulnB3)} ×0.55,  B1 need-signal ${pct(vulnB1)} ×0.30` +
        (b4VulnAvailable ? `,  B4 moved-by-harmed ${pct(b4Vuln)} ×0.15 ) = ${to100(vulnerability)}/100` : ` ) = ${to100(vulnerability)}/100  (B4 signal absent → excluded)`),
      contributions: vulnSignals.filter((s) => s.available).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "group_size",
      label: "Reducing harm",
      score: to100(groupSize),
      rationale:
        "How much your approval threshold moved as the harmed group grew from ~10 to ~100,000 workers (Block 3). The one-directional (carry-forward) design means this captures how much MORE gain you demanded for larger groups.",
      derivation: `max(0, size slope ${sizeSlope.toFixed(2)}) / ${GAIN_STEPS} steps = ${to100(groupSize)}/100` + (aiAvailable ? "" : "  (Block 3 data missing → neutral)"),
      contributions: single("Block 3", "Threshold spread across group sizes", groupSizeB3).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
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
    },
    {
      key: "context",
      label: "Where it happens",
      score: to100(context),
      rationale:
        "How much surrounding circumstances reshape your choice — measured by how far your keep-threshold moved across the neutral, wealthy, and shelter contexts in Block 1.",
      derivation: `(max−min of [sidewalk ${sidewalk}, wealthy ${wealthy}, shelter ${shelter}]) / ${MONEY_STEPS} = ${to100(context)}/100`,
      contributions: single("Block 1", "Spread across the three contexts", contextSpread).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
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
    const score = calibrateSensitivity(d.key, rawScore);
    return {
      ...d,
      score,
      derivation: `${d.derivation}   →  calibrated ${score}/100 (raw ${rawScore})`,
    };
  });

  const sorted = [...calibrated]
    .sort((a, b) => b.score - a.score)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  const n = sorted.length;
  const overall = sorted.reduce((sum, d) => sum + rankWeight(d.rank, n) * d.score, 0);

  return {
    dimensions: sorted,
    overallSensitivityIndex: Math.round(overall),
    primaryDriver: sorted[0] ?? null,
    secondaryDriver: sorted[1] ?? null,
  };
}
