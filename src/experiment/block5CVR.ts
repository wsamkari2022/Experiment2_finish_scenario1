/**
 * block5CVR.ts — The CVR Cube engine for Block 5 (v3 spec).
 *
 * Pure functions only (no UI). Implements:
 *  - policy-fit match score + 4-level alignment label (bands 85/75/55), NO option removal
 *  - the CVR Cube coordinate: violated value + framing (context/directness) + who appears
 *  - profile score updates on endorsement (+30/+15 & −20/−10), stakeholder ±25,
 *    weakly-aligned +10 (all clamped 0–100; the caller commits only on Confirm)
 *  - graded + reflective VCI, and the Stability Score
 *  - performance score from the 8 generic metrics (separate from alignment)
 */

import {
  POLICY_DIM_KEYS,
  ALIGNMENT_RANK_RULE,
  METRIC_KEYS,
} from "./block5Types";
import type {
  AlignmentLevel,
  Block5DecisionRole,
  Block5MetricProfile,
  Block5PolicyDimKey,
  Block5ScenarioOption,
  Block5ScenarioResult,
  Block5UserProfile,
  CVRCoordinate,
  CVRFraming,
  FramingAdjust,
  SalienceWho,
} from "./block5Types";

const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

/**
 * One sensitivity score off a profile, 0-100.
 *
 * Missing dimensions fall back to 50 - the midpoint - rather than 0. A missing value is "we do
 * not know", and scoring that as "cares not at all" would silently invent a strong position for
 * a participant who never expressed one.
 */
function scoreOf(profile: Block5UserProfile, key: string): number {
  return profile.dimensions.find((d) => d.key === key)?.score ?? 50;
}

/* ---------------- Alignment (policy fit) ---------------- */

/**
 * Threshold-satisfaction alignment (v3.1). Each participant score is a THRESHOLD
 * (a floor). An option is penalized ONLY when it falls BELOW that threshold; meeting
 * or exceeding it costs nothing. Each shortfall is weighted by how much the
 * participant cares about that value (their own score), so missing an important value
 * hurts more than missing one they barely care about.
 *
 *   alignment = 100 − Σ (user/100) × max(0, user − option)
 */
/**
 * ALIGNMENT — how well one option fits one participant, on the four POLICY values only.
 *
 * WHAT:  penalty = Σ over the 4 policy dims of  (u / 100) x max(0, u − f)
 *        score   = 100 − penalty
 * where u is the participant's score on that value and f is the option's fingerprint on it.
 *
 * WHY ONLY SHORTFALLS COUNT — max(0, u − f): an option is penalised only when it delivers LESS
 * than the participant demands. Exceeding their bar costs nothing: you are not punished for
 * caring more than required. This is a THRESHOLD-SATISFACTION model, not a distance model. A
 * distance model would penalise an option for protecting the vulnerable "too much", which is not
 * a coherent thing to hold against it.
 *
 * WHY THE PENALTY IS WEIGHTED BY u/100: a shortfall on a value you hold strongly should hurt
 * more than the same shortfall on one you barely hold. This is exactly why the seven dimensions
 * had to be put on a common ruler first (see sensitivityCalibration.ts): before that, a value
 * scoring 14 by construction contributed a fifth as much as one scoring 47, purely because of
 * how it happened to be measured — not because the participant cared less.
 *
 * WHY ONLY FOUR OF THE SEVEN: the other three are not policy demands. Context and directness
 * choose the CVR's framing lens; stakeholder chooses whose voice appears. Mixing them into
 * alignment would be comparing "what I demand of a policy" with "what kind of reflection moves
 * me", which are different questions.
 */
export function policyAlignmentScore(option: Block5ScenarioOption, profile: Block5UserProfile): number {
  let penalty = 0;
  for (const k of POLICY_DIM_KEYS) {
    const u = scoreOf(profile, k);
    const o = option.fingerprint[k];
    const shortfall = Math.max(0, u - o); // only falling BELOW the threshold counts
    penalty += (u / 100) * shortfall;
  }
  return Math.round(clamp(100 - penalty));
}

/**
 * Rank-based label (v3.3): an option's position in the scenario ranking decides its level,
 * which guarantees a spread for any profile. For 6 options with the default rule this gives
 * 1 Aligned / 1 Weakly / 2 Misaligned / 2 Strongly.
 */
/**
 * Turns an option's RANK POSITION into its alignment label.
 *
 * WHAT: with 6 options and the current rule, exactly 1 Aligned / 1 Weakly aligned /
 * 2 Misaligned / 2 Strongly misaligned. The CVR fires on the bottom four.
 *
 * WHY RANK AND NOT AN ABSOLUTE CUTOFF: absolute score bands would give some participants six
 * "aligned" options and therefore no reflection at all, and others six "misaligned" ones. The
 * experiment needs every participant to face the same structure of choices — one clear fit, one
 * near fit, and four that cost them something — regardless of how demanding their profile is.
 * Ranking guarantees that spread for everyone.
 *
 * Options are NEVER hidden or removed; the label is information, not a filter.
 */
export function rankLabel(index: number, total: number): AlignmentLevel {
  const a = ALIGNMENT_RANK_RULE.aligned;
  const w = ALIGNMENT_RANK_RULE.weaklyAligned;
  if (index < a) return "aligned";
  if (index < a + w) return "weakly_aligned";
  const remaining = Math.max(0, total - a - w);
  const posInRest = index - a - w;
  const misalignedCount = Math.ceil(remaining / 2);
  return posInRest < misalignedCount ? "misaligned" : "strongly_misaligned";
}

/**
 * The CVR TRIGGER. True for the bottom two of the four tiers.
 *
 * This single predicate decides who sees a reflection vignette at all, so it is also the line
 * that decides which participants can produce CVR and APA data. Widening or narrowing it changes
 * the sample for every CVR-based analysis.
 */
export function isMisaligned(level: AlignmentLevel): boolean {
  return level === "misaligned" || level === "strongly_misaligned";
}

export const ALIGNMENT_LABEL: Record<AlignmentLevel, string> = {
  aligned: "Aligned",
  weakly_aligned: "Weakly aligned",
  misaligned: "Misaligned",
  strongly_misaligned: "Strongly misaligned",
};

export interface LabeledOption extends Block5ScenarioOption {
  matchScore: number;
  level: AlignmentLevel;
  performance: number;
  rank: number;
}

/** Label every option (never removes any). Sorted by match score for display only. */
export function labelOptions(
  options: Block5ScenarioOption[],
  profile: Block5UserProfile,
): LabeledOption[] {
  const labeled: LabeledOption[] = options.map((o) => ({
    ...o,
    matchScore: policyAlignmentScore(o, profile),
    level: "misaligned" as AlignmentLevel,
    performance: performanceScore(o),
    rank: 0,
  }));
  // Rank by absolute fit (stable tie-break by id), then label by RANK POSITION (guaranteed spread).
  labeled.sort((a, b) => (b.matchScore - a.matchScore) || a.id.localeCompare(b.id));
  labeled.forEach((o, i) => { o.rank = i + 1; o.level = rankLabel(i, labeled.length); });
  return labeled;
}

/* ---------------- CVR Cube coordinate ---------------- */

/** The option's "main value" = its single highest of the 4 policy dims. */
export function optionMainValue(option: Block5ScenarioOption): Block5PolicyDimKey {
  let best: Block5PolicyDimKey = POLICY_DIM_KEYS[0];
  let bestV = -1;
  for (const k of POLICY_DIM_KEYS) {
    const v = option.fingerprint[k];
    if (v > bestV) { bestV = v; best = k; }
  }
  return best;
}

/** The value with the largest IMPORTANCE-WEIGHTED shortfall (the value the option most under-served). */
export function violatedValue(option: Block5ScenarioOption, profile: Block5UserProfile): Block5PolicyDimKey {
  let best: Block5PolicyDimKey = POLICY_DIM_KEYS[0];
  let bestPenalty = -1;
  for (const k of POLICY_DIM_KEYS) {
    const u = scoreOf(profile, k);
    const penalty = (u / 100) * Math.max(0, u - option.fingerprint[k]);
    if (penalty > bestPenalty) { bestPenalty = penalty; best = k; }
  }
  if (bestPenalty <= 0) {
    // No shortfall (rare when misaligned) — fall back to the most important value.
    return [...POLICY_DIM_KEYS].sort((a, b) => scoreOf(profile, b) - scoreOf(profile, a))[0];
  }
  return best;
}

/** Framing = the participant's bigger of context vs directness sensitivity (the lens shown FIRST). */
/**
 * Picks which reflection lens the CVR uses — the FRAMING pair.
 *
 * WHAT: whichever of context sensitivity or directness sensitivity is higher.
 *
 * WHY THESE TWO AND ONLY THESE TWO: they are the two dimensions that describe HOW a participant
 * is moved rather than WHAT they demand. Someone whose answers shift with the situation gets the
 * context lens ("the reason some people rank lower here is circumstance, not worth"); someone
 * whose answers shift with their own causal role gets the directness lens ("this is not the
 * system deciding — your own choice is what moves the cost onto them").
 *
 * This is a direct numeric comparison between two dimensions, which is only meaningful because
 * both are on the common ruler (see sensitivityCalibration.ts). Before calibration this
 * comparison was decided largely by which formula produced bigger numbers.
 */
export function chooseFraming(profile: Block5UserProfile): CVRFraming {
  return scoreOf(profile, "contextSensitivity") >= scoreOf(profile, "directnessSensitivity")
    ? "context"
    : "directness";
}

/** The opposite reflection lens (used to generate the alternate CVR view). */
export function otherFraming(framing: CVRFraming): CVRFraming {
  return framing === "context" ? "directness" : "context";
}

/** Maps a reflection lens to the profile sensitivity key it adjusts. */
export function framingSensitivityKey(framing: CVRFraming): FramingAdjust["sensitivityKey"] {
  return framing === "directness" ? "directnessSensitivity" : "contextSensitivity";
}

/** Who appears = INVERSE map of stakeholder sensitivity (low→close, high→system). */
/**
 * Picks whose voice speaks in the CVR vignette — the VOICE group.
 *
 * WHAT: an INVERSE map of stakeholder sensitivity. Low → "close" (someone you have known twenty
 * years); middle → "group" (an affected community member); high → "system" (a distant official).
 *
 * WHY INVERSE: the point is to give each participant the voice most likely to actually reach
 * them. Someone barely moved by stakeholder perspectives needs the closest, most personal voice
 * to feel anything; someone already highly moved will register even a distant systemic one.
 *
 * KNOWN LIMITATION: the cutoffs assume the stakeholder score spreads across the range. It does
 * not — the underlying Block 4 measure is near-binary, so in practice this returns "close" for
 * about 81% of participants. The cutoffs are not the fault; the measure is. See the Block 4
 * notes in thresholdTree.ts.
 */
export function chooseWho(profile: Block5UserProfile): SalienceWho {
  const s = scoreOf(profile, "stakeholderPerspectiveShiftSensitivity");
  if (s < 40) return "close";
  if (s < 70) return "group";
  return "system";
}

/**
 * The three-axis address of one reflection: WHICH value was violated, WHICH lens frames it, and
 * WHOSE voice speaks.
 *
 * This is the CVR Cube coordinate. It is computed once per choice and stored on the result, so an
 * analyst can group reflections by cell rather than re-deriving which vignette a participant saw.
 */
export function cvrCoordinate(option: Block5ScenarioOption, profile: Block5UserProfile): CVRCoordinate {
  return {
    violatedKey: violatedValue(option, profile),
    framing: chooseFraming(profile),
    who: chooseWho(profile),
  };
}

/* ---------------- Profile updates (pending until the caller commits) ---------------- */

/**
 * Deep-enough copy for a profile update.
 *
 * Every apply* function clones before mutating, and that is what keeps `originalProfile` frozen
 * for the whole of Block 5. A shallow copy would share the `dimensions` array and let one bump
 * silently rewrite the pre-Block-5 snapshot that Stability and Position Effect measure against.
 */
function cloneProfile(p: Block5UserProfile): Block5UserProfile {
  return { ...p, dimensions: p.dimensions.map((d) => ({ ...d })) };
}

/**
 * Applies one profile update, scaled by how much room the score has left to move.
 *
 * A raw `delta` is not added directly. It is multiplied by the fraction of the range still
 * available in that direction — `(100 − score)/100` for a gain, `score/100` for a loss — so a
 * dimension already near a bound moves only a little, while a mid-range dimension moves almost
 * the full step. This is the standard proportional (Rescorla–Wagner) update form.
 *
 * Why: with five scenarios each able to add +30, a plain additive rule drives every dimension a
 * consistent participant touches to 0 or 100 by about the third scenario, after which the
 * carry-over between scenarios becomes invisible (verified by simulation: 2 of 3 tracked
 * dimensions pinned at 3 scenarios, 3 of 3 at five). Proportional updating cannot reach a bound,
 * so the profile keeps responding right through Scenario 5 while preserving every ordering —
 * a strong endorser still ends clearly above a weak one.
 */
/**
 * Applies one profile update. THE DELTA IS FLAT: +30 means +30, not "+30 scaled by something".
 *
 * WHY THIS CHANGED (2026-08-31). It used to scale every delta by the remaining headroom —
 * `delta * (100 - score)/100` going up. That had one real virtue (values approached the ends
 * asymptotically and never piled up on a ceiling) and two costs that turned out to matter more:
 *
 *   1. THE DOCUMENTED CONSTANT WAS NEVER THE APPLIED ONE. "+30" moved a value at 20 by +24 and a
 *      value at 96 by +1.2. Every description of the rule — in the methods chapter, in the advisor
 *      deck, in this file's own header — was therefore approximately false, and no reader could
 *      check the arithmetic against the stored profiles.
 *   2. IT DISCRIMINATED LESS. Measured on the real scenario set across 5 profiles x 4 behaviours,
 *      Stability separated steady participants from drifting ones by 33 points under headroom and
 *      by 42 under flat. The measure's whole job is that separation.
 *
 * WHAT IT COSTS, STATED RATHER THAN HIDDEN. Flat deltas do pile up on the ends: about 13% of
 * values finish a five-scenario run sitting exactly on 0 or 100, and roughly 17 bumps per 20 runs
 * are swallowed by `clamp`. A value pinned at 100 stops contributing movement for the rest of the
 * run, so a participant who keeps drifting after saturating one value will look slightly steadier
 * than they were. That is a real limitation and belongs in the write-up; it is not large enough to
 * outweigh being able to state the rule truthfully in one line.
 *
 * CHANGING THIS FUNCTION CHANGES `STABILITY_CHURN_CEILING`. The ceiling is the p99 of the null
 * model, and the null churn distribution scales with the deltas — it moved 42 -> 65 with this
 * edit. Gate S7 in tools/simulate_stability.cjs enforces the pairing.
 */
function bump(p: Block5UserProfile, key: string, delta: number): void {
  const dim = p.dimensions.find((d) => d.key === key);
  if (!dim) return;
  dim.score = clamp(dim.score + delta);
}

/**
 * Re-derives rank, weight and topThreeKeys after any score changes.
 *
 * Must run at the end of every update, because the alignment tier, the CVR framing and the
 * stakeholder voice are all chosen from the RANKING rather than from the raw scores. Skipping it
 * leaves a profile whose numbers moved but whose priority order still reflects the old ones.
 */
function recompute(p: Block5UserProfile): void {
  const byScore = [...p.dimensions].sort((a, b) => b.score - a.score);
  byScore.forEach((d, i) => { d.rank = i + 1; d.weight = (8 - d.rank) / 28; });
  const byRank = [...p.dimensions].sort((a, b) => a.rank - b.rank);
  p.topThreeKeys = byRank.slice(0, 3).map((d) => d.key);
  p.topSensitivityKey = byRank[0]?.key ?? p.topSensitivityKey;
}

/**
 * The value this option actually NEGLECTS — the participant's highest-scoring value that the
 * option falls more than 5 points short of. Returns null when the option falls short of nothing.
 *
 * That null matters. This used to fall back to `sorted[0]` — the participant's top value —
 * even when the option satisfied every value they hold. Combined with a downward bump, choosing
 * an option that serves you well would have pushed your top value DOWN. An option that costs you
 * nothing should cost you nothing.
 */
function displacedTopValue(p: Block5UserProfile, option: Block5ScenarioOption): Block5PolicyDimKey | null {
  const sorted = [...POLICY_DIM_KEYS].sort((a, b) => scoreOf(p, b) - scoreOf(p, a));
  for (const k of sorted) {
    if (option.fingerprint[k] < scoreOf(p, k) - 5) return k;
  }
  return null;
}

/**
 * Misaligned + YES: endorsed value +30/+15, displaced #1 value −20/−10, stakeholder ±25.
 *
 * `framingAdjust` (optional) is the dual-perspective change — applied ONLY when the participant
 * generated the other lens and answered the new question. On the YES path it is −20 to the lens
 * that did NOT influence keeping the option. Passing null/undefined keeps the original behaviour.
 */
export function applyEndorsementUpdates(
  profile: Block5UserProfile,
  option: Block5ScenarioOption,
  q1Strong: boolean,
  q2Guided: boolean,
  framingAdjust?: FramingAdjust | null,
  stakesWeight = 1,
): Block5UserProfile {
  const p = cloneProfile(profile);
  const w = stakesWeight;
  /*
   * THE TWO VALUES MOVED ARE THE TWO VALUES THE PARTICIPANT WAS SHOWN.
   *
   * This used to lower `displacedTopValue` — the participant's highest-scoring value that the
   * option under-serves by more than 5. That is not the value the option actually sacrifices, and
   * measured across 60,000 misaligned choices the two disagreed 16.3% of the time. Worse, when the
   * option's own value WAS the participant's top value, `displacedTopValue` returned that same
   * value, the `!== endorsed` guard skipped the decrement, and the endorsement taught the profile
   * nothing at all.
   *
   * A real case: a participant scoring gained 100 / helped 99 picks an option with gain 94 and
   * helped 41. It is misaligned almost entirely because of HELPED (weighted shortfall 57.4 against
   * 6.0 for gained) — yet the old rule raised gained (already 100, so clamped to no change) and
   * lowered nothing. The participant endorsed a trade and the model recorded no trade.
   *
   * `violatedValue` is the value with the largest importance-weighted shortfall — precisely "what
   * this option gives up, weighted by how much you said you care". It is what the reflection text
   * now names, so the arithmetic and the sentence finally describe the same trade. In the case
   * above it moves helped 99 -> 79, which separates it from gained and is exactly the learning the
   * endorsement was supposed to capture.
   *
   * WHY NO SEPARATE HANDLING FOR A SATURATED VALUE. When the served value is already at 100 the
   * increment is clamped and expresses nothing — but alignment reads the RANKING, so lowering the
   * sacrificed value carries the whole meaning on its own. The fix falls out of using the right
   * pair; it needs no special case.
   */
  const served = optionMainValue(option);
  const sacrificed = violatedValue(option, p);
  bump(p, served, (q1Strong ? 30 : 15) * w);
  // Equal only when the option's own strongest value is also the one it most under-serves. There is
  // no trade to record then, so the endorsement is the whole signal.
  if (sacrificed !== served) bump(p, sacrificed, (q1Strong ? -20 : -10) * w);
  bump(p, "stakeholderPerspectiveShiftSensitivity", (q2Guided ? 25 : -25) * w);
  if (framingAdjust) bump(p, framingAdjust.sensitivityKey, framingAdjust.delta * w);
  recompute(p);
  return p;
}

/**
 * APA clarification updates (pending until the participant commits a final choice inside APA).
 * Q1 endorse: option value +15, the value it went against −10. Q1 context: +5 / +10.
 * Q1 unsure: no value change. Q2 stakeholder ±25. Q3 forced prioritization: +10 (stacks with Q1).
 */
/**
 * How much weight the participant's own certainty carries, 1–5 -> 0.6–1.0.
 *
 * The confidence rating was collected, stored, and then used by nothing at all: a participant who
 * answered "1 — not sure" moved the model exactly as far as one who answered "5 — very sure".
 * Asking a question and discarding the answer is worse than not asking, because the participant
 * believes it mattered.
 *
 * IT NEVER FALLS TO ZERO. Even at "not sure" the participant still picked an answer rather than
 * skipping, and 0.6 keeps that worth something. A scale that bottomed out at 0 would silently
 * throw away the whole clarification for the people least certain about themselves — who are
 * exactly the participants this step exists to help.
 */
export function confidenceWeight(confidence: number): number {
  const c = Math.min(5, Math.max(1, Math.round(confidence || 3)));
  return 0.6 + 0.4 * ((c - 1) / 4);
}

/**
 * THE APA CLARIFICATION — applied when a participant REFUSES their first choice after the vignette.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IT APPLIES
 *
 *   Q1 endorse   : +15 served, -10 sacrificed        Q2 named value : +30, and -20 to current top
 *   Q1 context   :  +5 served, nothing else          confidence 1-5 : scales all of the above 0.6-1.0
 *   Q1 unsure    : nothing                           lens named     : +20 to that lens
 *   THE CAP      : no policy value moves more than 30 x w in one clarification, either direction
 *   switched after meeting the person : +/-25, deliberately NOT confidence-scaled
 *
 * The published confidence table (a value starting at 0): 1 -> 18, 3 -> 24, 5 -> 30.
 * Asserted by tools/verify_apa.cjs, so this comment cannot drift from the code unnoticed.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE CAP, AND WHY THE ORDER OF THE BUMPS MATTERS
 *
 * Q1 and Q2 can name the SAME value. The cap at the end of this function is what keeps the
 * published constant honest when they do — see the block above it for the measurement. Anything
 * that changes these magnitudes must re-run `npm run verify:apa` and then the full
 * `npm run validate:block5`: STABILITY_CHURN_CEILING is the p99 of a null model run against this
 * behaviour, so it moves when this does.
 *
 * WHERE THE MECHANISM IS STILL WEAK, and it is worth knowing before touching anything:
 *
 * 1. SATURATION. 11.9% of policy values sit at 100 after a clarification. A pinned value cannot
 *    show further endorsement, and the ranking loses resolution at the top — which is exactly
 *    where alignment labels are decided. Inherent to flat deltas on a bounded scale; the cap
 *    reduces it, nothing removes it.
 *
 * 2. THE STAKEHOLDER +/-25 is the one constant here with no measurement behind it. Being unscaled
 *    by confidence is deliberate (it is behavioural, not self-reported), but the magnitude is
 *    judgement alone, and two non-switches pin a participant at the floor.
 *
 * Reproduce: `npm run apa:personas` (six answer patterns) · `npm run apa:variants` (the constants)
 * Full working: docs/BLOCK5_APA_AUDIT.md
 */
export function applyApaUpdates(
  profile: Block5UserProfile,
  misalignedOption: Block5ScenarioOption,
  q1: "endorse" | "context" | "unsure",
  stakeholderInfluenced: boolean,
  prioritizedValue: Block5PolicyDimKey,
  framingAdjust?: FramingAdjust | null,
  stakesWeight = 1,
  confidence = 3,
): Block5UserProfile {
  const p = cloneProfile(profile);
  /*
   * ONE WEIGHT FOR THE WHOLE CLARIFICATION.
   *
   * Confidence scales every value move this function makes, not just the one asked next to it. The
   * rating is the participant's answer to "how sure are you about this clarification", and the
   * clarification is Q1 and Q2 together — one act of the participant telling the model who they
   * are. Splitting the weight so that only Q2 responded to it made a participant who answered
   * "not sure" move just as far on Q1 as one who answered "very sure", which is the same defect
   * the rating was introduced to remove.
   *
   * The stakeholder move below is the exception, and is deliberately left alone: it comes from a
   * separate yes/no question about whether a person's story swayed them, and it is not a matter of
   * degree.
   */
  const w = stakesWeight * confidenceWeight(confidence);
  const optionValue = optionMainValue(misalignedOption);
  const topValue = violatedValue(misalignedOption, profile);
  if (q1 === "endorse") {
    bump(p, optionValue, 15 * w);
    if (topValue !== optionValue) bump(p, topValue, -10 * w);
  } else if (q1 === "context") {
    bump(p, optionValue, 5 * w);
    /*
     * THE SACRIFICED VALUE IS DELIBERATELY NOT RAISED HERE. It used to get +10 x w.
     *
     * The +10 was not the wrong direction. This answer reads, on screen, "overall, [sacrificed]
     * still matters more to me than [served]" — the participant is contradicting their own choice
     * and reasserting that value, so raising it was faithful to what they said.
     *
     * It was, however, SELF-DEFEATING. Q2 below subtracts 20 from whichever value is top, and it
     * reads "top" AFTER this block has run. Measured over 2,500 simulated participants, the +10
     * promoted the sacrificed value to top 87.6% of the time (vs 76% without it) and the -20 then
     * landed on it in 25.7% of all cases: +10 followed by -20 is a NET LOSS of 10 on the one value
     * the participant had just said mattered more.
     *
     * On the only claim they make — that the sacrificed value outranks the served one — removing
     * the bump does BETTER than keeping it: 79.5% of profiles end up agreeing, against 71.9% with
     * the +10. Values pinned at the 0/100 ceiling also fall from 14.3% to 12.0%.
     *
     * Lowering it instead (-5 was tested) scores worse again at 75.8% AND records the opposite of
     * what the participant said, so it was rejected.
     *
     * The division of labour is now clean: Q1 records what they DID, Q2 records what they WANT.
     * The sacrificed value is carried by Q2, where naming it is worth +30.
     *
     * Reproduce: npm run apa:variants   ·   Full reasoning: docs/BLOCK5_APA_AUDIT.md
     */
  }
  // The stakeholder move is answered by a separate question and is NOT a matter of degree, so the
  // confidence rating attached to Q1 has no business scaling it.
  bump(p, "stakeholderPerspectiveShiftSensitivity",
    (stakeholderInfluenced ? 25 : -25) * stakesWeight);
  /*
   * THE PRIORITISED VALUE: +30, and the value currently on top comes DOWN 20.
   *
   * This was a flat +10 with no counterweight, and it did not work. Measured over 5,056 simulated
   * clarifications, the value the participant NAMED as their priority rose in the ranking only
   * 26.6% of the time — three times in four, someone stated their priority outright and the model
   * that judges them did not move at all. A real case: a participant scoring gained 100 / helped 99
   * said "how many are harmed" with the highest confidence, and harmed went 0 -> 10, still ranked
   * third of four. The next scenario then told them their harm-avoiding choices were misaligned.
   *
   * WHY THE DECREMENT IS THE IMPORTANT HALF. Alignment reads the ORDER of the four values. A value
   * sitting at 0 cannot be promoted past values sitting at 100 by adding points to it alone, and
   * adding without subtracting inflates every profile toward the ceiling until the ranking stops
   * discriminating at all. Lowering the incumbent is what actually lets the order change.
   *
   * WHY +30/-20 AND NOT SOMETHING NEW. It is the shape already used when a participant endorses a
   * misaligned choice, so the rule reads as one sentence: a direct statement of priority counts
   * exactly as much as a strong endorsement of a choice. Measured, it lifts the named value in the
   * ranking 59% of the time without inflating profiles any further than the old rule did.
   */
  const currentTop = [...POLICY_DIM_KEYS].sort((a, b) => scoreOf(p, b) - scoreOf(p, a))[0];
  bump(p, prioritizedValue, 30 * w);
  if (currentTop !== prioritizedValue) bump(p, currentTop, -20 * w);
  // Dual-perspective: NO path = +20 to the lens that changed their mind (only when answered).
  if (framingAdjust) bump(p, framingAdjust.sensitivityKey, framingAdjust.delta * w);

  /*
   * THE CAP: no policy value moves more than 30 x w in one clarification, in either direction.
   *
   * WHY IT IS NEEDED. Q1 and Q2 can name the SAME value, and then they add. A participant who
   * endorses their choice and goes on to name the value that choice served receives +15 and +30 —
   * +45 x w, not the +30 x w this rule is published as. That is not an edge case: it is what an
   * internally consistent participant naturally answers, so the documented constant was wrong for
   * the most coherent respondents rather than for the confused ones.
   *
   * IT ALSO REPAIRED THE CONFIDENCE RATING. Without the cap, from confidence 2 upward a
   * double-counting participant moved FURTHER than one who was completely sure and did not:
   * 45 x 0.7 = 31.5 against 30 x 1.0. The rating exists to do the opposite of that.
   *
   * WHY IT IS APPLIED TO THE NET CHANGE, NOT TO EACH BUMP. The bumps are not independent — the
   * -20 is meant to be able to cancel part of a +30. Capping each one separately would leave the
   * sum uncapped and change nothing.
   *
   * WHY THE FOUR POLICY VALUES ONLY. The stakeholder move is +/-25 from a separate behavioural
   * observation and is deliberately not confidence-scaled; at low confidence the cap would clip it
   * (30 x 0.6 = 18) and quietly alter a different measure. The lens adjustment is already 20 x w
   * and cannot reach the cap. Neither is part of the double-count this exists to remove.
   */
  const capped = 30 * w;
  for (const k of POLICY_DIM_KEYS) {
    const before = scoreOf(profile, k);
    const after = scoreOf(p, k);
    const moved = after - before;
    if (Math.abs(moved) > capped) {
      const dim = p.dimensions.find((d) => d.key === k);
      if (dim) dim.score = clamp(before + Math.sign(moved) * capped);
    }
  }
  recompute(p);
  return p;
}

/** Keeping an aligned/weakly-aligned option reinforces its main value by `points` (clamped 0–100). */
/**
 * Profile update when the participant KEEPS an option that already fits them (no CVR fires).
 *
 * WHY THE SECOND-BEST OPTION MOVES THE PROFILE FURTHER (+20 vs +15)
 * ----------------------------------------------------------------
 * Keeping your top-ranked option tells the model almost nothing it did not already believe — it
 * already thought that was your best fit. Keeping your SECOND-ranked option is the informative
 * case: it says the ordering may be wrong. So it earns the larger move, which is what lets a
 * value you keep choosing climb toward the top while the one you keep passing over settles
 * beneath it.
 *
 * TWO GUARDS ON THE DOWNWARD BUMP, both of which were missing:
 *   1. Never subtract from the value just raised. If the option you kept is built on your top
 *      value, +15 and -10 would land on the SAME value and net out to +5 — punishing you for
 *      agreeing with yourself.
 *   2. Only subtract from a value the option genuinely neglects (see displacedTopValue). An
 *      option that satisfies everything you hold costs you nothing.
 *
 * It cannot guarantee the kept value reaches rank 1 after a single choice, and should not:
 * whether an option counts as fitting depends on all four values together
 * (policyAlignmentScore), not on one. A forced swap would make the profile — and with it the CVR
 * targeting, which aims at whichever value is on top — jump around between scenarios.
 */
export function applyKeepUpdates(
  profile: Block5UserProfile,
  option: Block5ScenarioOption,
  level: AlignmentLevel,
  stakesWeight = 1,
): Block5UserProfile {
  const p = cloneProfile(profile);
  const gain = level === "aligned" ? 15 : level === "weakly_aligned" ? 20 : 0;
  if (gain === 0) return p;
  const loss = level === "aligned" ? -10 : -15;
  const kept = optionMainValue(option);
  const neglected = displacedTopValue(p, option);
  bump(p, kept, gain * stakesWeight);
  if (neglected && neglected !== kept) bump(p, neglected, loss * stakesWeight);
  recompute(p);
  return p;
}

/* ---------------- Performance metrics ---------------- */

/**
 * An option's five performance metrics.
 *
 * There is no fallback any more, and that is the point. This used to read
 * `option.metrics ?? deriveMetrics(option)`, and deriveMetrics copied the option's FINGERPRINT
 * into its metrics — totalBenefit = outcomeAggregation, vulnerableProtection =
 * vulnerabilityProtection. That is where the duplication came from: the metrics stopped being a
 * second view of the option and became the same numbers under a second heading. `metrics` is now
 * a required field on Block5ScenarioOption, so a new scenario cannot silently inherit its own
 * fingerprint. See docs/BLOCK5_METRIC_REDESIGN_PLAN.md.
 */
export function optionMetrics(option: Block5ScenarioOption): Block5MetricProfile {
  return option.metrics;
}

/**
 * The unweighted mean of one option's five outcome measures, 0-100.
 *
 * EQUAL WEIGHTS ARE A DECLARED CHOICE, not neutrality: nothing in Blocks 1-4 asks whether speed
 * matters more to this participant than reversibility, so any weighting would be the study's
 * opinion wearing the participant's name.
 *
 * READ THIS NUMBER WITH CARE. Across a scenario's six options it only spans about 54 to 69, so
 * "65" looks like a middling mark out of 100 and actually means dead average. `capturedOf` in
 * block5Performance.ts rescales it against what each scenario offered, and that is the figure
 * the charts and the analysis use.
 */
export function performanceScore(option: Block5ScenarioOption): number {
  const m = optionMetrics(option);
  const sum = METRIC_KEYS.reduce((a, k) => a + (m[k] ?? 0), 0);
  return Math.round(sum / METRIC_KEYS.length);
}

/* ---------------- Measures: graded VCI + Stability ---------------- */

/**
 * How much consistency credit one scenario earns, from WHAT WAS CHOSEN — judged against the
 * participant's values as they stood at that moment, which move as the block proceeds.
 *
 * 0.85 for the second-best option, not 0.75: staying inside your own top two is consistent
 * behaviour, and a participant who never once chose against themselves should be able to reach
 * the top band. It stays below 1.00 so that "always my best fit" and "always my second" remain
 * distinguishable.
 *
 * 0.35 for a misaligned choice is partial credit — it separates "chose poorly" from
 * "chose the furthest thing available", which earns 0.
 *
 * ============================================================================
 * WHY THE CVR ENDORSEMENT IS NOT IN THIS FORMULA
 * ============================================================================
 * It used to be: the score was max(base credit, 0.9 for a firm endorsement). That paid for the
 * same act twice. When a participant goes against their values and genuinely endorses the choice,
 * their profile ALREADY moves — the endorsed value gains +30, the displaced one loses 20
 * (applyEndorsementUpdates) — so from the next scenario on, choosing that value scores full credit
 * because it has genuinely become one of their values. That is the reward, and it is the design.
 *
 * Adding a second reward inside the same scenario let the least consistent participant possible
 * hide: someone who takes up a DIFFERENT clashing value in every scenario re-earned the 0.9 each
 * time, and scored 90 — the same as a participant who never once chose against themselves. The
 * one thing VCI exists to detect was the one thing it could not see. See tools/simulate_vci.cjs,
 * which asserts this, and docs/BLOCK5_VCI_PLAN.md.
 *
 * The raw answer is NOT lost: it is stored per scenario as `cvrEndorsement` and can still be
 * related to behaviour in analysis. It simply no longer inflates this score.
 */
const BASE_CREDIT: Record<AlignmentLevel, number> = {
  aligned: 1.0,
  weakly_aligned: 0.85,
  misaligned: 0.35,
  strongly_misaligned: 0.0,
};

/**
 * One scenario's contribution to VCI, 0-1, from the alignment tier of the FINAL choice.
 *
 * Judged against the profile as it stood at that moment, not the frozen one - a value the
 * participant took on during Block 5 counts from then on. That is what separates VCI (did your
 * choices fit your values as they stood?) from Stability (did your values themselves move?).
 */
export function scenarioVciScore(level: AlignmentLevel): number {
  return BASE_CREDIT[level];
}

/** Plain words for a VCI score. Presentation only - never fed back into any calculation. */
export function consistencyLevel(value0to100: number): string {
  if (value0to100 >= 85) return "Highly consistent";
  if (value0to100 >= 70) return "Consistent";
  if (value0to100 >= 50) return "Moderately consistent";
  if (value0to100 >= 30) return "Low consistency";
  return "Very low consistency";
}

/**
 * Does this scenario TEACH the profile and count toward the choice-based measures?
 *
 * True for deciders, false for recipients. One predicate, used by the app and by every simulator,
 * because the alternative is the same rule written out in five places and drifting in four of
 * them — and a simulator that disagrees with the app about which scenarios count does not
 * validate the app, it validates a fiction.
 *
 * A scenario with no `decisionRole` is a decider, so everything authored before the field existed
 * behaves exactly as it did.
 */
export function scenarioIsScored(scenario: { decisionRole?: Block5DecisionRole }): boolean {
  return (scenario.decisionRole ?? "decider") === "decider";
}

/** Same question, asked of a stored result rather than of a scenario definition. */
export function resultIsScored(result: Block5ScenarioResult): boolean {
  return (result.decisionRole ?? "decider") === "decider";
}

/**
 * VCI — did your CHOICES fit your values, judged as they stood at the time?
 *
 * RECIPIENT SCENARIOS ARE EXCLUDED, and the exclusion belongs here rather than at every call site.
 * VCI is a question about choices. A recipient scenario asks what the participant WISHES someone
 * else would do: nobody is answerable for a wish, and it costs nothing to hold. Averaging one into
 * VCI would silently mix two different psychological acts into a single number and then report it
 * as though it measured one thing.
 *
 * The wish is not discarded — `vciScore` is still recorded on the recipient result, and the
 * Responsibility Gap compares it against this figure on the same 0–100 scale. What is refused here
 * is the averaging, not the measurement.
 *
 * Returns 0 when nothing scoreable ran, which is the honest answer to "how consistent were the
 * choices you made?" when no choices were made.
 */
export function computeVCI(results: Block5ScenarioResult[]): { value: number; level: string } {
  const scored = results.filter(resultIsScored);
  if (scored.length === 0) return { value: 0, level: "—" };
  const sum = scored.reduce((a, r) => a + (r.vciScore ?? 0), 0);
  const value = Math.round((sum / scored.length) * 100);
  return { value, level: consistencyLevel(value) };
}

/* ================================================================================
   STABILITY — how much the participant's value profile itself moved during Block 5
   ================================================================================

   WHAT IT ASKS
   ------------
   Not "did you keep choosing what the old you would have chosen" — that is a question about
   CHOICES, and it is very close to what VCI already asks. Stability asks about the PROFILE:
   the block updates the participant's values as they go, and this measures how far that model
   of them travelled.

   That makes the pair genuinely different questions instead of two views of one:
     VCI       — did your choices fit your values, judged as they stood at the time?
     Stability — did your values themselves change?

   TWO HALVES, AND WHY BOTH ARE NEEDED
   -----------------------------------
   1. ORDER — of the six possible pairs among the four policy values, how many swapped places
      between the start of Block 5 and the end? This is the qualitative event: your priorities
      reordered.

   2. MOVEMENT — the total distance the five scored values travelled, summed scenario by
      scenario ("churn"), not just start-versus-end ("net drift").

   Order alone is blind: two participants can finish with an identical ranking while one moved
   six points further on a value. Net drift alone is worse than blind, it inverts. A participant
   who picks the option furthest from their values in EVERY scenario thrashes back and forth and
   ends up near where they began — measured start-to-end they score 10.2, while a participant who
   changed their mind once and held it scores 13.6. Net drift would call the thrasher the more
   stable of the two. Churn separates them: 33.2 against 13.6.

   WHY STAKEHOLDER IS IN THE MOVEMENT HALF BUT NOT THE ORDER HALF
   --------------------------------------------------------------
   It moves +-25 on every CVR, the biggest bump in the system, so leaving it out would hide the
   most-moved value. But a list of one has no order, so it can only contribute magnitude.

   WHY CONTEXT AND DIRECTNESS ARE IN NEITHER
   -----------------------------------------
   They only move when a participant clicks the optional "Generate the other view" control AND
   answers which lens moved them. Simulation across six behaviour types found them completely
   unmoved in every case. Scoring a variable that is frozen for most participants would dilute
   the number without measuring anything. They are reported separately instead, as how often the
   participant compared both lenses — which does vary, and is a fact about them rather than about
   the button.
   ================================================================================ */

/** The four policy values, whose ORDER is tracked. */
const STABILITY_ORDER_KEYS = POLICY_DIM_KEYS;
/** The values whose MOVEMENT is tracked — the four policies plus stakeholder. */
const STABILITY_MOVE_KEYS: string[] = [...POLICY_DIM_KEYS, "stakeholderPerspectiveShiftSensitivity"];

/**
 * Churn at or above this counts as maximum instability.
 *
 * DERIVED, NOT CHOSEN. 4,000 seeded random responders were run through the real five scenarios;
 * their churn distribution came out p50 = 28.0, p90 = 35.3, p99 = 41.7. The ceiling is the p99 of
 * that null model: movement beyond what 99% of random answering produces is as unstable as this
 * instrument can register. This is the same null-model calibration the Blocks 1-4 sensitivities
 * use (see sensitivityCalibration.ts), so the whole instrument is anchored the same way.
 *
 * WAS 35, against a null of p50 22.0 / p90 29.2 / p99 34.9. That null was measured on the previous
 * option payoffs. The Stage 3 rewrite replaced the two everyday scenarios and retuned the other
 * three, which widened the payoff spread and therefore widened the churn a random responder
 * produces. Leaving the ceiling at 35 would have saturated the movement half of Stability early:
 * a chance responder would have scored 0 movement far more often than the calibration intends,
 * and genuinely unstable participants would have been indistinguishable from merely noisy ones.
 * The constant is a property of the scenario set, so it moves when the scenario set moves.
 *
 * Regenerate with tools/simulate_stability.cjs if the bump magnitudes or the scenario set change.
 *
 * MOVED 42 -> 65 on 2026-08-31, when `bump` stopped scaling deltas by the remaining headroom. Flat
 * deltas are larger in absolute terms, so a chance responder now churns further: the null p99 went
 * from 41.7 to 65.4. Leaving it at 42 would have driven the movement half of Stability to zero for
 * most real participants.
 *
 * MOVED 65 -> 43 on 2026-09-04, when the flood and water scenarios were removed. Churn ACCUMULATES
 * across the deck, so it is a function of how many scenarios there are as well as how large each
 * bump is: three scenarios give a chance responder two fewer chances to move, and the measured
 * null p99 fell from 65.4 to 42.8. This constant is not a threshold anyone chose — it is a
 * measurement OF THE SCENARIO SET, so it must be regenerated whenever that set changes. Leaving it
 * at 65 would have made every real participant look stable, because nobody could reach the ceiling.
 *
 * MOVED 43 -> 55 on 2026-09-04, when the two workplace scenarios landed. The deck is five again,
 * but it is NOT the five it was before: `care_rota_receiving` asks for a wish rather than a choice,
 * so it runs no profile update and contributes no churn at all. A chance responder therefore has
 * four opportunities to move rather than five, and the null p99 came in at 55.0 — between the
 * three-scenario 42.8 and the old five-scenario 65.4, which is exactly where four scoring
 * scenarios should put it.
 *
 * THE ORDER OF OPERATIONS MATTERS HERE and is worth recording, because getting it wrong is silent.
 * The ceiling was measured only AFTER the recipient skip was wired through `scenarioIsScored`. Run
 * before that, the null model still moved the profile in all five scenarios and reported 65.4 — a
 * ceiling calibrated against behaviour the app was about to stop producing, which would have made
 * every real participant look more stable than they were.
 *
 * MOVED 55 -> 56 on 5 September 2026, when the endorsement rule changed to lower the value the
 * option actually sacrifices rather than the highest-scoring one it merely under-serves. Aiming the
 * decrement at a different value changes how far a chance responder drifts, so the null model had
 * to be re-run: p99 came back at 55.8.
 *
 * MOVED 56 -> 57 on 7 September 2026, when Q1's "just this situation" answer stopped raising the
 * sacrificed value. Removing a bump changes how far a chance responder drifts, so the null model
 * was re-run: p99 came back at 57.0.
 *
 * Gate S7 enforces the pair: the suite fails if this number and the freshly measured p99 drift
 * apart. Regenerate with `npm run validate:stability` whenever the deck, the roles, or the bump
 * magnitudes change.
 */
export const STABILITY_CHURN_CEILING = 56;

/** Plain words for Stability. Deliberately NOT the VCI wording — this measures drift, not fit. */
export function stabilityLevel(value0to100: number): string {
  if (value0to100 >= 85) return "Held steady";
  if (value0to100 >= 70) return "Mostly steady";
  if (value0to100 >= 50) return "Shifted a little";
  if (value0to100 >= 30) return "Shifted a lot";
  return "Changed substantially";
}

/** How many of the 6 pairs among four ranked values changed relative order. */
function pairInversions(a: string[], b: string[]): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (b.indexOf(a[i]) > b.indexOf(a[j])) n++;
    }
  }
  return n;
}
const orderByScore = (get: (k: string) => number, keys: readonly string[]) =>
  [...keys].sort((x, y) => get(y) - get(x));

export interface StabilityResult {
  value: number;
  level: string;
  /** 0-100 — how much of the original ordering survived. */
  orderPart: number;
  /** 0-100 — how little the values moved. */
  movementPart: number;
  /** of 6 — how many pairs of policy values swapped places. */
  pairsSwapped: number;
  /** the raw summed movement, kept for analysis. */
  churn: number;
  /** did the top policy value change, and to what. */
  topValueBefore: string;
  topValueAfter: string;
}

export function computeStability(
  results: Block5ScenarioResult[],
  originalProfile: Block5UserProfile | null | undefined,
): StabilityResult {
  const empty: StabilityResult = {
    value: 0, level: "—", orderPart: 0, movementPart: 0, pairsSwapped: 0,
    churn: 0, topValueBefore: "", topValueAfter: "",
  };
  if (!originalProfile || results.length === 0) return empty;

  /* The sequence of profile snapshots: where they started, then after each scenario. */
  const startAt = (k: string) => scoreOf(originalProfile, k);
  const snapshots: Array<(k: string) => number> = [startAt];
  for (const r of results) {
    const policy = r.policySnapshotAfter;
    const stake = r.stakeholderSnapshotAfter;
    if (!policy) return empty; // pre-snapshot data; cannot be scored
    snapshots.push((k) => (k in policy
      ? (policy as Record<string, number>)[k]
      : (stake ?? startAt(k))));
  }

  /* MOVEMENT — summed step by step, so going away and coming back still counts as movement. */
  let churn = 0;
  for (let i = 1; i < snapshots.length; i++) {
    const step = STABILITY_MOVE_KEYS.reduce(
      (a, k) => a + Math.abs(snapshots[i](k) - snapshots[i - 1](k)), 0) / STABILITY_MOVE_KEYS.length;
    churn += step;
  }
  const movementPart = Math.round(100 * (1 - Math.min(1, churn / STABILITY_CHURN_CEILING)));

  /* ORDER — start versus end. */
  const last = snapshots[snapshots.length - 1];
  const before = orderByScore(startAt, STABILITY_ORDER_KEYS);
  const after = orderByScore(last, STABILITY_ORDER_KEYS);
  const pairsSwapped = pairInversions(before, after);
  const maxPairs = (STABILITY_ORDER_KEYS.length * (STABILITY_ORDER_KEYS.length - 1)) / 2;
  const orderPart = Math.round(100 * ((maxPairs - pairsSwapped) / maxPairs));

  /* Half each. Order is the more meaningful event but is coarse — only seven possible values, and
     insensitive when one value starts far ahead. Movement is fine-grained but less meaningful.
     They compensate, so neither is given precedence. */
  const value = Math.round((orderPart + movementPart) / 2);
  return {
    value, level: stabilityLevel(value), orderPart, movementPart, pairsSwapped,
    churn: Math.round(churn * 10) / 10,
    topValueBefore: before[0], topValueAfter: after[0],
  };
}

/**
 * Session performance as the mean of the RAW per-scenario composites.
 *
 * Kept so that data collected before the per-scenario normalisation stays readable, and so the
 * two can be reported side by side. For analysis prefer `overallCaptured`, which averages figures
 * that are already shares of what each scenario offered and therefore share a scale by
 * construction rather than by the five menus happening to match.
 */
export function averagePerformance(results: Block5ScenarioResult[]): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((a, r) => a + (r.performanceScore ?? 0), 0);
  return Math.round(sum / results.length);
}

/* ---------------- Cumulative / projected performance (top dashboard) ---------------- */

/** A zeroed metric profile (the participant's performance at the very start of Block 5). */
export const EMPTY_METRICS: Block5MetricProfile = METRIC_KEYS.reduce(
  (acc, k) => { acc[k] = 0; return acc; },
  {} as Block5MetricProfile,
);

/**
 * Element-wise mean of several metric profiles, used for the running dashboard total.
 *
 * Because it averages rather than sums, the dashboard can never exceed 100 however many
 * scenarios are completed - it reports the typical quality of the options chosen, not a tally.
 */
function averageMetricProfiles(list: Block5MetricProfile[]): Block5MetricProfile {
  if (list.length === 0) return { ...EMPTY_METRICS };
  const out: Block5MetricProfile = { ...EMPTY_METRICS };
  for (const m of list) for (const k of METRIC_KEYS) out[k] += m[k] ?? 0;
  for (const k of METRIC_KEYS) out[k] = Math.round(out[k] / list.length);
  return out;
}

/** Running-average performance across the scenarios confirmed so far (0 when none). */
export function cumulativeMetrics(results: Block5ScenarioResult[]): Block5MetricProfile {
  const list = results.map((r) => r.metrics).filter((m): m is Block5MetricProfile => !!m);
  return averageMetricProfiles(list);
}

/** What the running average would become if one more option's metrics were added. */
export function projectedMetrics(
  results: Block5ScenarioResult[],
  optionMetricsProfile: Block5MetricProfile,
): Block5MetricProfile {
  const list = results.map((r) => r.metrics).filter((m): m is Block5MetricProfile => !!m);
  list.push(optionMetricsProfile);
  return averageMetricProfiles(list);
}

/** Overall 0–100 score for a metric profile (mean of the five metrics). */
export function metricProfileScore(m: Block5MetricProfile): number {
  const sum = METRIC_KEYS.reduce((a, k) => a + (m[k] ?? 0), 0);
  return Math.round(sum / METRIC_KEYS.length);
}
