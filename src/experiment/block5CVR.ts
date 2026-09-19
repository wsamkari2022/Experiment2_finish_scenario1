/**
 * block5CVR.ts — The CVR Cube engine for Block 5 (v3 spec).
 *
 * Pure functions only (no UI). Implements:
 *  - policy-fit match score + 4-level alignment label (bands 85/75/55), NO option removal
 *  - the CVR Cube coordinate: violated value + framing (context/directness) + who appears
 *  - profile score updates on endorsement (+30/+15 & −20/−10), stakeholder ±25,
 *    weakly-aligned +10 (all clamped 0–100; the caller commits only on Confirm)
 *  - VCI (label weights from each option's place in line; see the VCI section) and the Stability Score
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
 * WHY ONLY SHORTFALLS COUNT — max(0, u − f): an option is penalized only when it delivers LESS
 * than the participant demands. Exceeding their bar costs nothing: you are not punished for
 * caring more than required. This is a THRESHOLD-SATISFACTION model, not a distance model. A
 * distance model would penalize an option for protecting the vulnerable "too much", which is not
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
  return Math.round(clamp(100 - policyAlignmentShortfall(option, profile)));
}

/**
 * THE SAME QUANTITY, BEFORE THE FLOOR IS APPLIED. Lower is a better fit; 0 is a perfect one.
 *
 * WHY THIS HAD TO BE SEPARATED OUT.
 * `policyAlignmentScore` clamps at 0, and a clamp destroys information. A demanding participant -
 * one who asked for a lot on several values - pushes most options past a shortfall of 100, and
 * every one of them then reports the same score of 0. Ranking on that number put those options in
 * order of their internal id, which is alphabetical, so the "best fit" badge went to whichever
 * option happened to be named earliest.
 *
 * It is a stopwatch that stops at 60 seconds. Runners finishing in 70, 90 and 120 are all written
 * down as 60, and the medals then get handed out by name.
 *
 * Measured over 20,000 profiles on the five-scenario deck: at least one option sat on the floor in
 * 18.7% of scenarios, every option sat there in 0.1%, and ranking on the floored number put the
 * wrong label on 2.7% of cards and named the wrong best-fit option in 1.5% of scenarios. About one
 * participant in five was affected somewhere in their run.
 *
 * THE SCORE SHOWN TO PARTICIPANTS IS UNCHANGED. They still see 0 rather than a negative number,
 * which would mean nothing to them. Only the ORDERING moved onto this uncensored value, and for
 * every participant whose options all score above 0 the two orderings are identical - the score is
 * exactly 100 minus this, so ranking by one is ranking by the other.
 *
 * STORE THIS, NOT ONLY THE SCORE, for analysis. The score is censored above a shortfall of 100 and
 * cannot be treated as an interval measure at the bottom of the range; this can.
 */
export function policyAlignmentShortfall(
  option: Block5ScenarioOption,
  profile: Block5UserProfile,
): number {
  const by = policyShortfallByValue(option, profile);
  return POLICY_DIM_KEYS.reduce((sum, k) => sum + by[k], 0);
}

/**
 * The same shortfall, value by value: (score / 100) × (score − what the option delivers), and 0
 * where the option delivers at least the score. `policyAlignmentShortfall` is exactly their sum.
 *
 * The APA page uses it to list the values an option fell short on in order, biggest miss first,
 * so the order on screen comes from the number on screen and cannot drift from it.
 */
export function policyShortfallByValue(
  option: Block5ScenarioOption,
  profile: Block5UserProfile,
): Record<Block5PolicyDimKey, number> {
  const out = {} as Record<Block5PolicyDimKey, number>;
  for (const k of POLICY_DIM_KEYS) {
    const u = scoreOf(profile, k);
    const o = option.fingerprint[k];
    out[k] = (u / 100) * Math.max(0, u - o); // only falling BELOW the threshold counts
  }
  return out;
}

/**
 * How much an option gives of what this participant holds: Σ (score / 100) × what the option
 * delivers, over the four policy values. The same weights the shortfall uses.
 *
 * USED ONLY TO BREAK A TIE in `labelOptions`. It never changes a score, a shortfall or a CVR
 * trigger on its own - it only decides the order of options whose shortfall is identical.
 */
export function policyDelivery(option: Block5ScenarioOption, profile: Block5UserProfile): number {
  return POLICY_DIM_KEYS.reduce((sum, k) => sum + (scoreOf(profile, k) / 100) * option.fingerprint[k], 0);
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
  /** 0-100, shown to the participant. Floored at 0, so not an interval measure at the bottom. */
  matchScore: number;
  /**
   * The same fit, uncensored: total weighted shortfall, lower is better.
   *
   * This is what the ranking uses and what an analysis should use. `matchScore` cannot separate an
   * option that missed by 104 from one that missed by 154 - both read 0 - and this can.
   */
  matchShortfall: number;
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
    matchShortfall: policyAlignmentShortfall(o, profile),
    level: "misaligned" as AlignmentLevel,
    performance: performanceScore(o),
    rank: 0,
  }));
  /*
   * RANKED ON THE UNCENSORED SHORTFALL, not on the floored score.
   *
   * Sorting on `matchScore` looked identical for most participants and was silently wrong for the
   * rest: every option past a shortfall of 100 reports 0, so the comparison collapsed to the
   * tie-break and the ranking became alphabetical by id. `rankLabel` then handed "Aligned" to
   * whichever option was named earliest.
   *
   * Ascending, because a shortfall is a cost.
   *
   * TIES ARE BROKEN BY WHAT THE OPTION DELIVERS, NOT BY ITS NAME (18 September 2026).
   *
   * The same fault as above, at the other end of the scale. A shortfall only counts falling BELOW a
   * floor, so two options that both clear every floor tie at exactly 0, and the tie used to go to
   * the id - alphabetical order. Measured over 2,000 random profiles on scenarios 1-4, the top two
   * options tied in 10.9% of cases, and an option that met every floor was labeled misaligned in
   * 5.1%, purely because its id sorted later. The CVR then fired on it.
   *
   * Among options with the same shortfall, the one that gives more of what the participant holds
   * (`policyDelivery`) now goes first. When three or more options clear every floor, the rank rule
   * still calls the rest misaligned - on purpose, see `rankLabel` - but now it is the ones that give
   * LESS of what the participant cares about, not the ones whose names come later in the alphabet.
   *
   * The id stays as the very last resort, so the same profile always produces the same order.
   * Nothing else reads this order: the planner and the scenario-6 prediction compute their own.
   */
  const delivered = new Map(labeled.map((o) => [o.id, policyDelivery(o, profile)]));
  labeled.sort((a, b) => (a.matchShortfall - b.matchShortfall)
    || ((delivered.get(b.id) ?? 0) - (delivered.get(a.id) ?? 0))
    || a.id.localeCompare(b.id));
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
 * EVERY WAY THE PROFILE CAN CHANGE INSIDE BLOCK 5, IN ONE PLACE.
 *
 * There are exactly four. A value that moved between the pre-Block-5 snapshot and the final
 * profile came from one of them. They are collected here because the analysis and the write-up
 * both need to say WHICH decision produced WHICH movement, and the amounts otherwise sit spread
 * across three functions.
 *
 *  1. applyKeepUpdates - the participant confirmed an option ALREADY labeled a good fit.
 *       Aligned          +15 to the value the option is built on (optionMainValue)
 *                        -10 to a value it neglects by more than 5 (displacedTopValue)
 *       Weakly aligned   +20 / -15
 *       Any other level  no change at all
 *     Weakly aligned moves FURTHER on purpose: keeping your top-ranked option tells the model
 *     what it already believed, while keeping your second says the ordering may be wrong.
 *     The decrement is skipped when the neglected value IS the value just raised, and when the
 *     option neglects nothing - so an aligned pick often moves one value and nothing else.
 *
 *  2. applyEndorsementUpdates - the reflection ran and the participant KEPT the misaligned choice.
 *       served value      +30 strong endorsement / +15 weak
 *       sacrificed value  -20 strong / -10 weak   (violatedValue; skipped when it equals served)
 *       stakeholder       +25 if the person's story moved them, else -25
 *       framing lens      -20 to the lens they said did NOT influence them (dual-perspective only)
 *
 *  3. applyApaUpdates - the reflection ran and the participant CHANGED their mind. Amounts and
 *     the net cap are documented on the function itself.
 *
 *  4. Nothing at all - scenario 5 is a wish rather than a decision. scenarioIsScored() returns
 *     false for it, the whole reflection path stays shut, and the profile is carried through
 *     untouched so Stability measures only movement that real decisions produced.
 *
 * Every amount is additionally multiplied by the scenario's stakesWeight, which is 1 for all five
 * shipped scenarios, so in the current deck the published number IS the applied number.
 *
 * WHAT THIS COSTS, kept next to the amounts rather than buried: the deltas are flat (see `bump`),
 * so values pile up on 0 and 100. Measured on seven archetypes through the four scored scenarios,
 * six of them finish with one of their four policy values sitting exactly on 100. An aligned pick
 * is mildly inflationary - about +6.3 points of net profile per pick, with no decrement at all
 * 46% of the time. A value pinned at 100 stops contributing movement for the rest of the run.
 *
 * WHAT IT DOES NOT COST: the number of reflections. Alignment labels are assigned by RANK inside
 * the scenario (rankLabel), so it is always 1 aligned / 1 weakly / 2 misaligned / 2 strongly,
 * whatever the profile looks like. Raising a profile changes WHICH option lands in which slot; it
 * can never reduce how many options trigger the CVR.
 */

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
 *   2. IT DISCRIMINATED LESS. Measured on the real scenario set across 5 profiles x 4 behaviors,
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
 * that did NOT influence keeping the option. Passing null/undefined keeps the original behavior.
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
 *
 * THE AMOUNTS, as the code applies them. `w` is stakesWeight x confidenceWeight(confidence).
 *   Q1 endorse   option's own value +15 x w, the value it went against -10 x w
 *   Q1 context   option's own value +5 x w, and NOTHING is raised in return (see the long note
 *                inside the function: the old +10 to the sacrificed value was self-defeating)
 *   Q1 unsure    no value change
 *   Q2           stakeholder +25 if the person's story moved them, else -25. Multiplied by
 *                stakesWeight ONLY - never by confidence, because it is not a matter of degree
 *   Q3           +30 x w to the value the participant named, -20 x w to whichever value is
 *                currently top (skipped when those are the same value)
 *   Net cap      no policy value moves more than 30 x w in one clarification, either direction.
 *                Q1 and Q2 can name the same value and would otherwise stack to 45 x w.
 *
 * These superseded an earlier rule of "+5/+10 on context, +10 on prioritization". If a number
 * here disagrees with a paper draft, the code is the authority and the draft is stale.
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
 * behavior, so it moves when this does.
 *
 * WHERE THE MECHANISM IS STILL WEAK, and it is worth knowing before touching anything:
 *
 * 1. SATURATION. 11.9% of policy values sit at 100 after a clarification. A pinned value cannot
 *    show further endorsement, and the ranking loses resolution at the top — which is exactly
 *    where alignment labels are decided. Inherent to flat deltas on a bounded scale; the cap
 *    reduces it, nothing removes it.
 *
 * 2. THE STAKEHOLDER +/-25 is the one constant here with no measurement behind it. Being unscaled
 *    by confidence is deliberate (it is behavioral, not self-reported), but the magnitude is
 *    judgment alone, and two non-switches pin a participant at the floor.
 *
 * Reproduce: `npm run apa:personas` (six answer patterns) · `npm run apa:variants` (the constants)
 * Full working: docs/BLOCK5_APA_AUDIT.md
 */
/*
 * NO `misalignedOption` PARAMETER EITHER. It was read only by the removed first question, which
 * needed the option to work out which value it served and which it undercut. The update now
 * depends on nothing but what the participant said, and a parameter the arithmetic never touches
 * is a standing invitation to believe it does.
 */
export function applyApaUpdates(
  profile: Block5UserProfile,
  stakeholderInfluenced: boolean,
  prioritizedValue: Block5PolicyDimKey,
  framingAdjust?: FramingAdjust | null,
  stakesWeight = 1,
  confidence = 3,
): Block5UserProfile {
  const p = cloneProfile(profile);
  /*
   * ONE WEIGHT FOR ONE CLARIFICATION. Confidence scales the value move below.
   *
   * The stakeholder move is the exception, and is deliberately left alone: it comes from a
   * separate yes/no question about whether a person's story swayed them, and it is not a matter of
   * degree.
   */
  const w = stakesWeight * confidenceWeight(confidence);
  /*
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * THERE IS NO LONGER A FIRST QUESTION, AND THIS FUNCTION NO LONGER READS ONE.
   * Removed on the researcher's instruction, 17 September 2026.
   *
   * WHAT WENT. The page used to open by asking "which is closer to the truth?" - did you really
   * rank this value above that one, or was it just this situation - and the answer moved the
   * profile: endorse gave +15 to the option's value and -10 to the value it undercut, context gave
   * +5. The question rested on a two-way trade the page asserted and the arithmetic does not have.
   * An option usually falls short on SEVERAL of the four values at once, so naming one as "served"
   * and one as "sacrificed" described a choice the participant had not made, and then asked them to
   * defend it.
   *
   * WHAT REPLACES IT. Nothing. One question now carries the whole clarification: the participant
   * names the value they want weighted, and that is the update. The division of labour used to be
   * "Q1 records what they DID, Q2 records what they WANT"; the first half is gone, and what is left
   * is the half that was doing the useful work.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  // The stakeholder move is answered by a separate question and is NOT a matter of degree, so the
  // confidence rating attached to Q1 has no business scaling it.
  bump(p, "stakeholderPerspectiveShiftSensitivity",
    (stakeholderInfluenced ? 25 : -25) * stakesWeight);
  /*
   * THE PRIORITIZED VALUE: +30, AND THE OTHER THREE COME DOWN 10 EACH.
   *
   * SET BY THE RESEARCHER, 17 September 2026, when this became the only question that moves the
   * profile. It replaced "+30 to the named value, -20 to whichever value happens to be on top".
   *
   * IT IS ZERO-SUM BY CONSTRUCTION: +30 in, 3 x -10 out. The four scores cannot drift upward
   * together however many clarifications a participant runs, which is what eventually stops a
   * ranking from discriminating at all. The old rule only pushed down the incumbent, so a
   * participant who named the SAME value twice raised it twice and lowered nothing the second time.
   *
   * IT ALSO TREATS THE THREE UNNAMED VALUES ALIKE. Under the old rule the value in second place was
   * untouched while the leader took the whole -20, so naming your third choice could leave your
   * second choice ahead of it. Every value the participant did not name now gives way by the same
   * amount, which is what "this is the one I want weighted" actually means.
   *
   * The gap the named value opens over each other value is 40 x w, against 50 x w over the former
   * leader and 30 x w over everyone else under the old rule - slightly tighter at the top, much
   * more even across the rest.
   *
   * WHAT THE OLD RULE WAS FOR, kept here because the reasoning still holds for the +30 half:
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
  bump(p, prioritizedValue, 30 * w);
  for (const k of POLICY_DIM_KEYS) {
    if (k !== prioritizedValue) bump(p, k, -10 * w);
  }
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
   * WHY THE FOUR POLICY VALUES ONLY. The stakeholder move is +/-25 from a separate behavioral
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

/* ================================================================================================
   VCI - THE VALUE CONSISTENCY INDEX
   ================================================================================================

   THE QUESTION IT ANSWERS
   -----------------------
   Across the scenarios in which the participant DECIDED, how well did the option they finally
   chose fit their own values - judged against their values as they stood when that scenario
   opened? 100 means they chose the option that fit them best every time.

   It is a question about CHOICES. Whether the values themselves moved is Stability (further down
   this file); how good the chosen options were on their outcomes is Performance. The three are
   kept apart on purpose, so that one number never answers two questions.

   THE THREE EQUATIONS
   -------------------
   Each scenario lines up its n options for this participant (labelOptions): place 1 is the option
   that fits them best, place n the one that fits them worst. rankLabel turns places into the four
   alignment labels - on a six-option menu, place 1 Aligned, place 2 Weakly aligned, places 3-4
   Misaligned, places 5-6 Strongly misaligned.

     (1) Place score     b(r) = (n - r) / (n - 1)
                         the share of the OTHER options on the menu that fit the participant
                         worse than the option in place r.                          -> placeScore

     (2) Label weight    w(L) = the average of b(r) over the places r that carry label L
                                                                                    -> labelWeight

     (3) VCI             VCI = round( 100 x (w(L_1) + w(L_2) + ... + w(L_K)) / K )
                         L_k is the label of the FINAL choice in the k-th scenario that counts,
                         and K is how many scenarios count - the decider scenarios, 1 to 4, so
                         K = 4.                                                     -> computeVCI

   THE WEIGHTS THIS GIVES
   ----------------------
     Six options (scenarios 1-5)                        Four options (scenario 6)
       Aligned              place 1     1.00                  place 1   1.00
       Weakly aligned       place 2     0.80                  place 2   0.67
       Misaligned           places 3-4  (0.6 + 0.4) / 2 = 0.50       place 3   0.33
       Strongly misaligned  places 5-6  (0.2 + 0.0) / 2 = 0.10       place 4   0.00

   In words, on six options:
       Aligned              1.00   the choice fit better than every other option
       Weakly aligned       0.80   it fit better than four of the other five
       Misaligned           0.50   no better than picking blindly
       Strongly misaligned  0.10   worse than picking blindly: nearly every other option fit better

   WORKED EXAMPLE. The final choices were Aligned, Weakly aligned, Misaligned, Aligned:
       VCI = 100 x (1.00 + 0.80 + 0.50 + 1.00) / 4 = 82.5, rounded to 83 -> "Mostly Consistent".

   WHY THESE WEIGHTS - THE CASE FOR THE METHODS CHAPTER
   ----------------------------------------------------
   1. NO NUMBER IS CHOSEN BY HAND. All four weights follow from equation (1) and the label rule.
      b(r) is a percentile rank within the option's own menu - the share of the other options it
      beats, the familiar way of saying how far up the list it was.

   2. A LABEL THAT COVERS TWO PLACES GETS THEIR AVERAGE. The label does not say whether a
      Misaligned choice was the 3rd option or the 4th, and the average of the two is the fair,
      unbiased guess. It is the mid-rank rule rank statistics use for ties (Mann-Whitney U,
      Spearman's rho). Taking the worse place instead would short-change everyone who took the
      better one; taking the better place would flatter everyone who took the worse one.

   3. BLIND PICKING SCORES EXACTLY 50, on a menu of any size. The average of b(r) over the places
      1..n is exactly one half, and averaging within labels does not move an average. So 50 is a
      fixed yardstick: above it the choices fit the participant better than chance, below it worse.

   4. THE FIT NUMBERS AGREE WITH THE RULE. Measured over 2,000 random starting profiles on
      scenarios 1-4 (`npm run report:vci`, part 4), the options carrying each label come this
      close, on average, to the participant's best available fit, where
          closeness = 1 - (its shortfall - the best shortfall) / (the worst shortfall - the best shortfall)
      : 1.00 / 0.83 / 0.57 / 0.13. The rule gives 1.00 / 0.80 / 0.50 / 0.10, within 0.07 of every
      one. The rule is used rather than the measurement because a measurement would have to be
      redone every time an option changed.

   5. ONE RULE FOR EVERY MENU. Scenario 6 has four options and takes its weights from the same two
      equations. If ALIGNMENT_RANK_RULE ever changes, labelWeight follows it with no edit here.

   ALTERNATIVES CONSIDERED AND NOT USED
   ------------------------------------
   - The worse place of each label (1.00 / 0.80 / 0.40 / 0.00). It lets 0 be reached, but it
     short-changes every participant who took the better of a label's two places, and it moves
     blind picking to 43 - an anchor with no meaning.
   - The measured closeness above, used directly as the weights (1.00 / 0.83 / 0.57 / 0.13).
     Almost the same numbers, but tied to today's option numbers and population draw.
   - Closeness scored choice by choice, against the participant's own total demand. It pushes
     everyone toward the top: blind picking scored 82 and always choosing the worst option 66, so
     the scale stopped separating anyone.
   None of the three told the participant types apart better than the rule: the weights change
   what the numbers read, not the order in which participants fall. (These comparisons were run
   once, on the same 2,000 profiles, while the rule was being chosen; report:vci reproduces the
   rule, not the alternatives.)

   WHAT THE ANCHORS MEAN
   ---------------------
       100   the best-fitting option in every scenario
        80   the second-best option in every scenario
        50   what blind picking gives, on average
        10   the lowest possible score: a Strongly misaligned option every time. It is not 0
             because the label cannot tell the 5th option from the 6th, and its weight is their
             average.

   WHICH SCENARIOS COUNT
   ---------------------
   Only the scenarios in which the participant decides (scenarioIsScored / resultIsScored).
   Scenario 5 asks for a wish and scenario 6 tests the model; both still RECORD a per-scenario
   weight (`vciScore` on the result) - scenario 5's feeds the responsibility gap - and neither is
   ever averaged into VCI. See computeVCI.

   WHICH PROFILE THE CHOICE IS JUDGED ON
   -------------------------------------
   The profile the participant brought INTO the scenario: Blocks 1-4, as moved by the CVR and APA
   answers of EARLIER scenarios. This holds on every path. Keeping an option after the reflection
   (CVR) and finishing through the clarification (APA) both move the profile for the NEXT scenario,
   and neither re-labels the choice made in this one (see handleApaCommit). A value taken on during
   the block therefore counts from the next scenario on.
   Why it matters, measured over 2,000 random starting profiles (`npm run report:vci`, part 6): a
   participant who takes up a new value in every scenario scores 31 whichever route they take.
   Relabeling the APA route on the profile it had just moved would lift the same behavior to 56 -
   the score of a random responder. Gate V8 in tools/simulate_vci.cjs guards it.

   WHAT VCI DOES NOT READ
   ----------------------
   The endorsement answer after the CVR, the APA answers, whether the stakeholder moved them, and
   the performance metrics. All of them are stored per scenario and can be analyzed next to VCI.
   The endorsement is rewarded ONCE, through the profile update: the endorsed value is raised, so
   from the next scenario on, choosing it earns full weight. Crediting it again here would let a
   participant who endorses a different clashing value in every scenario score like one who never
   chose against themselves - the one pattern VCI exists to catch.

   THE LEVELS (consistencyLevel)
   -----------------------------
   A level says which label the participant's AVERAGE choice sits nearest. The edges are the four
   "the same label every time" scores and the midpoints between them, computed from the weights -
   so they follow the weights and are never tuned by hand:

       Highly Consistent     90-100   nearer the best fit than the second best
                                      (edge: midpoint of always-Aligned 100 and always-Weakly 80)
       Mostly Consistent     80-89    about the second-best fit, on average   (edge: always-Weakly)
       Moderate              65-79    between the second best and a misaligned choice
                                      (edge: midpoint of always-Weakly 80 and always-Misaligned 50)
       Low                   50-64    nearer a misaligned choice                (edge: always-Misaligned
                                      = 50, which is also blind picking)
       Very Low              30-49    worse than picking blindly
                                      (edge: midpoint of always-Misaligned 50 and always-Strongly 10)
       Highly Inconsistent   10-29    nearer the options that fit worst

   KNOWN LIMITS, TO STATE IN THE WRITE-UP
   --------------------------------------
   Every "measured" figure in this section is printed by `npm run report:vci` (tools/
   vci_distribution.cjs: 2,000 seeded random starting profiles, the real scoring code); the rules
   themselves are asserted by `npm run validate:vci`.
   1. IT IS ORDINAL. The weight follows the option's place, not how much worse it fit. When two
      neighboring options fit almost equally well, the label boundary between them can move one
      scenario by up to 0.40 of weight, which is 10 VCI points; 26-31% of label boundaries are
      decided by under 3 points of fit.
   2. FOUR SCENARIOS COUNT, so the scale is coarse: 30 different VCI values are possible, from 10
      to 100.
   3. A CHANGE OF HEART IS LEARNED OVER ABOUT TWO SCENARIOS. One strong endorsement makes the
      newly endorsed value the participant's top value in 56% of profiles - a little over half - so
      a genuine convert usually loses part of the next scenario as well as the one in which they
      changed. A one-time convert averages 69.
   4. RANDOM ANSWERING. Blind picking averages exactly 50. A simulated responder who also answers
      the CVR and APA at random averages 56, because APA lists only the options built on the value
      they name, which steers some random choices toward a fit.
   5. SEPARATION. A participant true to their top value outscores a random responder 96% of the
      time; a random responder outscores a flip-flopper 88% of the time; a one-time convert
      outscores a random responder 71% of the time.
   ================================================================================================ */

/**
 * Equation (1): the place score of the option in place `place` (1 = best fit) on a menu of
 * `menuSize` options - the share of the other options that fit worse. 1 for the best, 0 for the
 * worst. A menu of one option has nothing to beat, so its only option scores 1.
 */
export function placeScore(place: number, menuSize: number): number {
  if (menuSize < 2) return 1;
  return (menuSize - place) / (menuSize - 1);
}

/**
 * Equation (2): the VCI weight of an alignment label on a menu of `menuSize` options - the average
 * place score of the places rankLabel gives that label. Six options: 1.00 / 0.80 / 0.50 / 0.10.
 * Four options: 1.00 / 0.67 / 0.33 / 0.00.
 *
 * Read from rankLabel itself rather than written out, so the weights can never disagree with the
 * rule that hands out the labels. A label that cannot occur on a menu this small returns 0, so an
 * impossible input can never raise a score.
 */
export function labelWeight(level: AlignmentLevel, menuSize = 6): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < menuSize; i++) {
    if (rankLabel(i, menuSize) === level) {
      sum += placeScore(i + 1, menuSize);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * One scenario's contribution to VCI, 0-1: the weight of the label the FINAL choice carries,
 * `labelWeight(level, menuSize)`. Stored on every result as `vciScore` (in the database,
 * `per_scenario_consistency_0_to_1`).
 *
 * `level` must be the label the option had on the profile the participant brought INTO the
 * scenario - on the keep path and the APA path alike. `menuSize` is that scenario's number of
 * options: 6 in scenarios 1-5, 4 in scenario 6.
 */
export function scenarioVciScore(level: AlignmentLevel, menuSize = 6): number {
  return labelWeight(level, menuSize);
}

/**
 * The six VCI levels, highest first, each with the lowest score that reaches it.
 *
 * The edges are computed from the six-option weights, never written out: the four "the same label
 * every time" scores and the midpoints between neighbors (see "THE LEVELS" in the VCI section).
 * With today's weights: 90 / 80 / 65 / 50 / 30. Rounded to two decimals so that floating-point error
 * in some future weight can never move a participant across an edge.
 */
const VCI_ALWAYS = {
  aligned: 100 * labelWeight("aligned"),
  weakly: 100 * labelWeight("weakly_aligned"),
  misaligned: 100 * labelWeight("misaligned"),
  strongly: 100 * labelWeight("strongly_misaligned"),
};
const edge = (x: number) => Math.round(x * 100) / 100;
export const VCI_LEVELS: ReadonlyArray<{ label: string; from: number }> = [
  { label: "Highly Consistent", from: edge((VCI_ALWAYS.aligned + VCI_ALWAYS.weakly) / 2) },
  { label: "Mostly Consistent", from: edge(VCI_ALWAYS.weakly) },
  { label: "Moderate", from: edge((VCI_ALWAYS.weakly + VCI_ALWAYS.misaligned) / 2) },
  { label: "Low", from: edge(VCI_ALWAYS.misaligned) },
  { label: "Very Low", from: edge((VCI_ALWAYS.misaligned + VCI_ALWAYS.strongly) / 2) },
  { label: "Highly Inconsistent", from: -Infinity },
];

/**
 * Plain words for a VCI score: the first level whose edge the score reaches. Shown on the results
 * page and stored as `vciLevel` (in the database, `consistency_label`).
 *
 * Presentation only - never fed back into any calculation.
 */
export function consistencyLevel(value0to100: number): string {
  for (const l of VCI_LEVELS) if (value0to100 >= l.from) return l.label;
  return VCI_LEVELS[VCI_LEVELS.length - 1].label;
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

/**
 * Does this scenario show the participant its PERFORMANCE numbers?
 *
 * Everywhere except scenario 6. There the four options are standing rules rather than actions, so
 * "how fast" and "how reversible" have no answer for them; their metrics are all 50 to say exactly
 * that; and the scenario is excluded from the Performance measure along with VCI and Stability.
 *
 * Showing them anyway would be worse than useless. Six identical bars invite a participant to hunt
 * for a difference that is not there, and a scenario built to ask which VALUE someone acts on would
 * be handing them a second, meaningless thing to compare on. Scenario 6 asks one question and shows
 * only what that question needs.
 *
 * One predicate, used by the dashboard, the card chips, the metric bars and the preview button, so
 * the four cannot disagree about whether performance exists here.
 */
export function scenarioShowsPerformance(scenario: { decisionRole?: Block5DecisionRole }): boolean {
  return (scenario.decisionRole ?? "decider") !== "predicted";
}

/**
 * Is this the scenario-6 prediction test rather than one of the study's own measurements?
 *
 * Works on a scenario definition or on a stored result, because both carry `decisionRole`.
 *
 * WHY THIS IS NOT `resultIsScored`. That predicate answers "does this teach the profile", and it
 * is false for the recipient scenario as well. The recipient scenario still BELONGS in the results
 * charts: it is a real choice the participant made, it appears in the position effect and in the
 * decided-versus-wished comparison, and hiding it would remove half of the study's own matched
 * pair. Scenario 6 is a different kind of thing entirely - a test of the MODEL - and belongs in
 * none of the charts that describe the participant.
 *
 * Drawn on a chart it would actively mislead. The value-drift line would show a flat sixth step,
 * because scenario 6 cannot move the profile; the consistency line would show a sixth point that
 * is excluded from the consistency score beside it; and a caption reading "across all 6 scenarios"
 * would be counting two scenarios that were never able to move anything.
 */
export function isPredictionTest(x: { decisionRole?: Block5DecisionRole }): boolean {
  return (x.decisionRole ?? "decider") === "predicted";
}

/** Same question, asked of a stored result rather than of a scenario definition. */
export function resultIsScored(result: Block5ScenarioResult): boolean {
  return (result.decisionRole ?? "decider") === "decider";
}

/**
 * VCI — did your CHOICES fit your values, judged as they stood at the time? Equation (3) of the VCI
 * section above: the average of the stored per-scenario weights (`vciScore`) over the scenarios that
 * count, times 100, rounded to a whole number.
 *
 * ONLY DECIDER SCENARIOS COUNT, and the exclusion belongs here rather than at every call site.
 * VCI is a question about choices. A recipient scenario (5) asks what the participant WISHES someone
 * else would do: nobody is answerable for a wish, and it costs nothing to hold. Averaging one into
 * VCI would silently mix two different psychological acts into a single number and then report it
 * as though it measured one thing. Scenario 6 is a test of the model, not a measurement of the
 * participant, and is left out for the same reason.
 *
 * The wish is not discarded — `vciScore` is still recorded on the recipient result, and the
 * responsibility gap compares it with the weight of the matched decision (scenario 4) on the same
 * scale; see block5Mirror.ts. What is refused here is the averaging, not the measurement.
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
   of them traveled.

   That makes the pair genuinely different questions instead of two views of one:
     VCI       — did your choices fit your values, judged as they stood at the time?
     Stability — did your values themselves change?

   TWO HALVES, AND WHY BOTH ARE NEEDED
   -----------------------------------
   1. ORDER — of the six possible pairs among the four policy values, how many swapped places
      between the start of Block 5 and the end? This is the qualitative event: your priorities
      reordered.

   2. MOVEMENT — the total distance the five scored values traveled, summed scenario by
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
   answers which lens moved them. Simulation across six behavior types found them completely
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
 * ceiling calibrated against behavior the app was about to stop producing, which would have made
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
 * CORRECTION (2026-09-13): that entry records a measurement, not the constant. The exported value
 * below is and has stayed 56, and gate S7 confirms it against a freshly measured null p99 of 56.3
 * on the current deck. Read the entries above as a log of what was measured on each date; the one
 * number that is authoritative is the export itself, which the gate checks on every run.
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

/*
 * THE SCALE THIS RETURNS, for anyone about to analyze or report it.
 *
 *   order half    = 100 x (6 - pairs swapped) / 6     only 7 values: 0 17 33 50 67 83 100
 *   movement half = 100 x (1 - min(1, churn / 56))    exactly 0 for any churn at or above 56
 *   value         = the mean of the two
 *
 * THE FULL 0-100 RANGE IS REACHABLE. Measured over 1,200 runs (300 random starting profiles x 4
 * behaviors) the lowest score was 0 and the highest 100. STABILITY_CHURN_CEILING is a CHURN value
 * and not a cap on the score - a participant can and does reach 100.
 *
 * THREE THINGS THAT ARE EASY TO REPORT WRONGLY:
 *   1. It is descriptive, not evaluative. High means the values did not move. It says nothing
 *      about whether the participant chose well - that is VCI, a different number.
 *   2. The order half is coarse. Seven possible values, so it is not continuous.
 *   3. The movement half is censored from below: everyone past the ceiling scores 0 on it and
 *      cannot be told apart on that half alone. Report the composite.
 *
 * A PARTICIPANT WHO PICKS THEIR BEST FIT EVERY TIME still lands below 70 about one time in ten,
 * and in every such case it is the ORDER half that dropped. That is the measure working as
 * designed, and it is the most likely thing to be misread.
 *
 * Regenerate every figure above with `npm run report:stability`. Full reporting and visualization
 * guidance: docs/MEASUREMENT_MODEL.md, "The Stability scale, for reporting".
 */
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
 * Kept so that data collected before the per-scenario normalization stays readable, and so the
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
