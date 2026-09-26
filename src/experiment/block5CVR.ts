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
  Block5ValueMove,
  CVRCoordinate,
  CVRFraming,
  FramingAdjust,
  SalienceWho,
  SensitivityStability,
  SensitivityStabilities,
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
 *   shortfall = Σ (user/100) × max(0, user − option)
 *   alignment = 100 × (1 − shortfall ÷ the most this participant could possibly lose)
 */
/**
 * ALIGNMENT — how well one option fits one participant, on the four POLICY values only.
 *
 * WHAT:  shortfall = Σ over the 4 policy dims of  (u / 100) x max(0, u − f)
 *        most      = Σ over the 4 policy dims of  (u / 100) x u     (an option giving 0 on all four)
 *        score     = 100 x (1 − shortfall / most)
 * where u is the participant's score on that value and f is the option's fingerprint on it.
 *
 * THE SHARE OF WHAT THEY ASKED FOR (24 September 2026, researcher's approval). The score used to be
 * 100 − shortfall, stopped at 0. A demanding participant loses more than 100 points on many options,
 * so several cards read "0 out of 100" at once - 5 in 100 of all cards for steady pretend
 * participants, two or more on one menu in 8 scenarios in 100 - and even the BEST fit read under 50
 * in 7 in 100. The screen could no longer tell those options apart. Dividing by the most this
 * participant could possibly lose makes the score a share: 100 = the option meets every value they
 * hold, 0 = it gives nothing on any of them. It never stops at 0 by accident.
 *
 * NOTHING THAT RANKS CHANGES. For one participant, "most" is a single number, so the new score is a
 * straight rescaling of the shortfall and orders the options exactly as before (100 out of 100
 * scenarios in the check). Labels, VCI, the planner and the MPF (which reads the shortfall itself)
 * are untouched. Only the number printed or stored moves. A participant who holds no policy value
 * at all has nothing to fall short of and scores 100 on every option.
 *
 * EXCEEDING STILL EARNS NOTHING, on purpose: the participant's score is a minimum, and giving more
 * of one value does not make up for giving less of another.
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
/**
 * The scale the fit score is on, stamped on every scenario result as `fitScoreScale`. A row
 * without it was saved before 24 September 2026, when the score was 100 minus the shortfall,
 * stopped at 0. The two scales must never be pooled, so the database puts an untagged row's
 * numbers under a separate, plainly named field. Move this string if the formula ever moves again.
 */
export const FIT_SCORE_SCALE = "share-of-what-they-asked-for-2026-09-24";

export function policyAlignmentScore(option: Block5ScenarioOption, profile: Block5UserProfile): number {
  const most = policyMostPossibleShortfall(profile);
  if (most <= 0) return 100;
  return Math.round(clamp(100 * (1 - policyAlignmentShortfall(option, profile) / most)));
}

/**
 * The most a participant could lose on one option: the shortfall of an option that gives 0 on all
 * four policy values, Σ (u/100) x u. It is the denominator that turns the shortfall into a share.
 */
export function policyMostPossibleShortfall(profile: Block5UserProfile): number {
  return POLICY_DIM_KEYS.reduce((sum, k) => {
    const u = scoreOf(profile, k);
    return sum + (u / 100) * u;
  }, 0);
}

/**
 * THE SAME QUANTITY, BEFORE THE FLOOR IS APPLIED. Lower is a better fit; 0 is a perfect one.
 *
 * WHY THIS HAD TO BE SEPARATED OUT.
 * `policyAlignmentScore` clamped at 0 until 24 September 2026, and a clamp destroys information. A demanding participant -
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
 * SINCE 24 SEPTEMBER 2026 THE SCORE NO LONGER STOPS AT 0: it is this shortfall divided by the most
 * the participant could possibly lose (see policyAlignmentScore), so it orders the options exactly
 * as this does. This remains the quantity to store and analyse: it is on the same scale for every
 * participant, while the score is a share of each participant's own maximum.
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
  /**
   * 0-100, shown to the participant: the share of what their four values asked for that this option
   * gives (see policyAlignmentScore). Since 24 September 2026 it no longer stops at 0.
   */
  matchScore: number;
  /**
   * The same fit as a raw total: weighted shortfall, lower is better. The ranking uses this; the
   * score is it divided by the participant's own maximum, so the two always agree on order.
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
 *
 * A TIE GOES TO THE PARTICIPANT'S OWN COIN, NOT ALWAYS TO CONTEXT (24 September 2026, researcher's
 * approval). This used to be `context >= directness`, so every tie - including the common 0 against
 * 0 of somebody who answered "never" in both Block 1 and Block 2 - showed the context lens first.
 * A tie now goes to whichever of the two ranks higher in the profile, and that rank order is set by
 * the fair coin in thresholdTree.ts (TIE_RULE), made from the participant's own answers. During
 * Block 5, `recompute` keeps tied values in that same order, so the coin holds for the whole block.
 */
export function chooseFraming(profile: Block5UserProfile): CVRFraming {
  const context = scoreOf(profile, "contextSensitivity");
  const directness = scoreOf(profile, "directnessSensitivity");
  if (context !== directness) return context > directness ? "context" : "directness";
  const rankOf = (key: string) =>
    profile.dimensions.find((d) => d.key === key)?.rank ?? Number.MAX_SAFE_INTEGER;
  return rankOf("contextSensitivity") <= rankOf("directnessSensitivity") ? "context" : "directness";
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
 *     Since 24 September 2026 (researcher's approval) it learns from the COMPARISON:
 *       Aligned          nothing moves - the model's own best guess came true
 *       Weakly aligned   compared with the best-fit option they passed over:
 *                        +20 to the value on which their pick beats the best fit the most,
 *                        -15 to the value on which the best fit beat their pick the most,
 *                        weighted by how much they hold it
 *       Any other level  no change at all
 *     See the function for why, and for the two defects it replaced.
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
 * are swallowed by `clamp`. Two values pinned at the same end are TIED, which is why Stability
 * counts a tie opening or closing as half a swap (rankSwaps). That is a real limitation and belongs
 * in the write-up; it is not large enough to outweigh being able to state the rule truthfully in
 * one line.
 *
 * MEASURED AGAIN, 24 September 2026, with pretend participants built by the REAL Blocks 1-4 scoring
 * instead of uniform random profiles: 16-23 in 100 policy values already START Block 5 at 0 or 100,
 * and 7-49 in 100 moves are cut off depending on how people choose (18 for random choosers, 49 for
 * people who always follow their top value). The 13% above came from uniform profiles and
 * understates it. Every cut is now recorded (see below).
 *
 * EVERY MOVE IS NOW WRITTEN DOWN (24 September 2026, audit item B5). When `moves` is given, each
 * bump adds what it asked for and what it actually made. A move that `clamp` swallows used to leave
 * no trace at all, so "this value did not move" and "this value could not move, it was already at
 * 100" looked the same in the data. The *WithMoves update functions pass the list; the plain ones
 * do not, and behave exactly as before.
 *
 * CHANGING THIS FUNCTION CHANGES WHAT EVERY SCORE READS. Re-run `npm run validate:block5`, then
 * `npm run report:vci` and `npm run report:stability`, and update the figures their documentation
 * quotes.
 */
function bump(p: Block5UserProfile, key: string, delta: number, moves?: Block5ValueMove[], why = ""): void {
  const dim = p.dimensions.find((d) => d.key === key);
  if (!dim) return;
  const from = dim.score;
  dim.score = clamp(dim.score + delta);
  if (moves) moves.push(valueMove(key, from, delta, dim.score - from, why));
}

/**
 * A copy of a profile with some scores replaced, ranks recomputed. Used to rebuild the profile a
 * scenario OPENED with from the snapshots its predecessor saved (see profileShownIn in
 * block5Mirror.ts). The array order is kept, so ties fall exactly as they did live.
 */
export function profileWithScores(profile: Block5UserProfile, scores: Record<string, number>): Block5UserProfile {
  const p = cloneProfile(profile);
  for (const d of p.dimensions) {
    if (typeof scores[d.key] === "number") d.score = scores[d.key];
  }
  recompute(p);
  return p;
}

/** Two decimals: enough for a stored record, and free of floating-point noise like 20.999999. */
export function roundForRecord(n: number): number {
  return Math.round(n * 100) / 100;
}

function valueMove(value: string, from: number, requested: number, applied: number, why: string): Block5ValueMove {
  return {
    value,
    from: roundForRecord(from),
    requested: roundForRecord(requested),
    applied: roundForRecord(applied),
    why,
  };
}

/** A profile update together with every move it asked for and what it actually made (B5). */
export interface ProfileUpdate {
  profile: Block5UserProfile;
  moves: Block5ValueMove[];
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
  return applyEndorsementUpdatesWithMoves(profile, option, q1Strong, q2Guided, framingAdjust, stakesWeight).profile;
}

/** The same update, with every move it asked for and what it actually made (B5). */
export function applyEndorsementUpdatesWithMoves(
  profile: Block5UserProfile,
  option: Block5ScenarioOption,
  q1Strong: boolean,
  q2Guided: boolean,
  framingAdjust?: FramingAdjust | null,
  stakesWeight = 1,
): ProfileUpdate {
  const p = cloneProfile(profile);
  const moves: Block5ValueMove[] = [];
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
  bump(p, served, (q1Strong ? 30 : 15) * w, moves, "kept a misaligned option: the value it serves most");
  // Equal only when the option's own strongest value is also the one it most under-serves. There is
  // no trade to record then, so the endorsement is the whole signal.
  if (sacrificed !== served) {
    bump(p, sacrificed, (q1Strong ? -20 : -10) * w, moves, "kept a misaligned option: the value it gives up most");
  }
  bump(p, "stakeholderPerspectiveShiftSensitivity", (q2Guided ? 25 : -25) * w, moves,
    q2Guided ? "the other person's story guided the choice" : "the other person's story did not guide the choice");
  if (framingAdjust) {
    bump(p, framingAdjust.sensitivityKey, framingAdjust.delta * w, moves,
      "the reflection view that did not influence keeping the option");
  }
  recompute(p);
  return { profile: p, moves };
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
 * that changes these magnitudes must re-run `npm run verify:apa`, then the full
 * `npm run validate:block5`, then `npm run report:stability`: how often a clarification reorders
 * two values - and so what Stability reads - moves when these do.
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
  return applyApaUpdatesWithMoves(
    profile, stakeholderInfluenced, prioritizedValue, framingAdjust, stakesWeight, confidence,
  ).profile;
}

/** The same update, with every move it asked for and what it actually made (B5). */
export function applyApaUpdatesWithMoves(
  profile: Block5UserProfile,
  stakeholderInfluenced: boolean,
  prioritizedValue: Block5PolicyDimKey,
  framingAdjust?: FramingAdjust | null,
  stakesWeight = 1,
  confidence = 3,
): ProfileUpdate {
  const p = cloneProfile(profile);
  const moves: Block5ValueMove[] = [];
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
    (stakeholderInfluenced ? 25 : -25) * stakesWeight, moves,
    stakeholderInfluenced
      ? "changed their mind: the other person's story moved them"
      : "changed their mind: the other person's story did not move them");
  /*
   * THE PRIORITIZED VALUE: +30, AND THE OTHER THREE COME DOWN 10 EACH.
   *
   * SET BY THE RESEARCHER, 17 September 2026, when this became the only question that moves the
   * profile. It replaced "+30 to the named value, -20 to whichever value happens to be on top".
   *
   * IT IS ZERO-SUM BY CONSTRUCTION: +30 in, 3 x -10 out. The four scores cannot drift upward
   * together however many clarifications a participant runs, which is what eventually stops a
   * ranking from discriminating at all.
   *
   * EXCEPT AT THE EDGES (audit B4, written down 25 September 2026). A value already at 0 cannot come
   * down 10, and the named value cannot rise past 100, so there the move is not zero-sum. Example:
   * vulnerable 0, harm 0, gain 100, helped 80, naming "reducing harm": harm +30, vulnerable stays 0,
   * gain -10, helped -10 - the four total 190 instead of 180. Every such cut is now recorded in
   * `valueMoves` (analysis.value_moves_asked_for_and_made), so it can be counted rather than assumed. The old rule only pushed down the incumbent, so a
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
  bump(p, prioritizedValue, 30 * w, moves, "changed their mind: the value they named");
  for (const k of POLICY_DIM_KEYS) {
    if (k !== prioritizedValue) bump(p, k, -10 * w, moves, "changed their mind: a value they did not name");
  }
  // Dual-perspective: NO path = +20 to the lens that changed their mind (only when answered).
  if (framingAdjust) {
    bump(p, framingAdjust.sensitivityKey, framingAdjust.delta * w, moves,
      "changed their mind: the reflection view that changed their mind");
  }

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
      if (dim) {
        const from = dim.score;
        const target = before + Math.sign(moved) * capped;
        dim.score = clamp(target);
        moves.push(valueMove(k, from, target - from, dim.score - from,
          "the cap: no value moves more than 30 x weight in one clarification"));
      }
    }
  }
  recompute(p);
  return { profile: p, moves };
}

/**
 * Profile update when the participant KEEPS an option that already fits them (no CVR fires).
 *
 * IT LEARNS FROM THE COMPARISON, NOT FROM THE OPTION ALONE (24 September 2026, researcher's
 * approval). The rule before read the chosen option by itself - +15/+20 to its biggest number,
 * -10/-15 to the participant's highest value it fell short on - and had two defects:
 *
 *   B2  PICKING YOUR BEST FIT COULD LOWER YOUR #1 VALUE. Every option falls short somewhere, so the
 *       best fit usually "neglected" something too. A participant at gain 100, helped 99 who picked
 *       their best fit (helped 87, gain 80) got helped +15, gain -10: their top two values swapped
 *       for choosing exactly what the model predicted. It happened to 16 of 100 best-fit picks and
 *       reordered the four values in 23 of 100 (4,000 steady pretend participants, scenarios 1-4).
 *   B1  THE DECREMENT COULD HIT NOTHING. It lowered "your highest value this option misses by more
 *       than 5", and when that was the value just raised it skipped - never looking further. A
 *       second-best pick that gave up a value the person holds by 20 points or more then lowered
 *       nothing in 35 of 100 cases; the researcher's own test run moved 0 in two scenarios.
 *
 * WHAT IT DOES NOW. A choice teaches the model only what it did not already expect:
 *
 *   Aligned          the model's own best guess came true, so nothing moves - like a rating that
 *                    barely changes when you beat the player you were expected to beat.
 *   Weakly aligned   the participant chose the model's SECOND guess over its FIRST. Compared with
 *                    that best-fit option, their pick is better on some values and worse on others:
 *                      +20 to the value where their pick beats the best fit the most (why they chose it)
 *                      -15 to the value where the best fit beat their pick the most, weighted by how
 *                          much they hold it (score/100, as violatedValue does) (what they gave up)
 *                    Ties go to the participant's own rank order, never to the order of this file.
 *   Anything else    no change (a misaligned pick goes through the reflection instead).
 *
 * The step sizes are the ones the rule always had; only WHICH values move changed. `menu` is the
 * scenario's options, needed to know which option was the best fit. It is required for a
 * second-best pick, and a call without it throws rather than silently teaching nothing.
 */
export function applyKeepUpdates(
  profile: Block5UserProfile,
  option: Block5ScenarioOption,
  level: AlignmentLevel,
  stakesWeight = 1,
  menu?: Block5ScenarioOption[],
): Block5UserProfile {
  return applyKeepUpdatesWithMoves(profile, option, level, stakesWeight, menu).profile;
}

/** The same update, with every move it asked for and what it actually made (B5). */
export function applyKeepUpdatesWithMoves(
  profile: Block5UserProfile,
  option: Block5ScenarioOption,
  level: AlignmentLevel,
  stakesWeight = 1,
  menu?: Block5ScenarioOption[],
): ProfileUpdate {
  const p = cloneProfile(profile);
  const moves: Block5ValueMove[] = [];
  if (level !== "weakly_aligned") return { profile: p, moves };
  if (!menu || menu.length === 0) {
    throw new Error("[applyKeepUpdates] a second-best pick needs the scenario's options (menu) to know which best fit it was chosen over.");
  }
  const bestFit = labelOptions(menu, profile)[0];
  if (!bestFit || bestFit.id === option.id) return { profile: p, moves };

  const rankOf = (k: Block5PolicyDimKey) =>
    profile.dimensions.find((d) => d.key === k)?.rank ?? Number.MAX_SAFE_INTEGER;
  const gaps = POLICY_DIM_KEYS.map((k) => ({ k, gap: option.fingerprint[k] - bestFit.fingerprint[k] }));
  const whyChosen = gaps
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap || rankOf(a.k) - rankOf(b.k))[0];
  const givenUp = gaps
    .filter((x) => x.gap < 0)
    .map((x) => ({ k: x.k, cost: (-x.gap * scoreOf(profile, x.k)) / 100 }))
    .filter((x) => x.cost > 0)
    .sort((a, b) => b.cost - a.cost || rankOf(a.k) - rankOf(b.k))[0];

  if (whyChosen) bump(p, whyChosen.k, 20 * stakesWeight, moves, "kept a second-best option: where it beats the best fit most");
  if (givenUp) bump(p, givenUp.k, -15 * stakesWeight, moves, "kept a second-best option: where the best fit beat it most");
  recompute(p);
  return { profile: p, moves };
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
      changed. A one-time convert averages 68.
   4. RANDOM ANSWERING. Blind picking averages exactly 50. A simulated responder who also answers
      the CVR and APA at random averages 57, because APA lists only the options built on the value
      they name, which steers some random choices toward a fit.
   5. SEPARATION. A participant true to their top value outscores a random responder 96% of the
      time; a random responder outscores a flip-flopper 87% of the time; a one-time convert
      outscores a random responder 70% of the time.
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
 * that; and the scenario is excluded from the Performance measure along with VCI and Stability
 * (really excluded only since 25 September 2026 - see scenarioCountsTowardsPerformance).
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
 * DOES THIS SCENARIO COUNT TOWARD THE PARTICIPANT'S PERFORMANCE? Only a decision does
 * (25 September 2026, the researcher's decision).
 *
 * Until this date every average of performance - the running bars at the top of the page, the raw
 * mean and the captured share - took in ALL six scenarios. Two of them are not decisions:
 *   - scenario 5 is a WISH. Nothing the participant picks there happens because of them, so it
 *     cannot be part of how well their decisions turned out. It now shows no "Preview impact".
 *   - scenario 6's four rules all have performance 50, so it pulled every score toward 50 and
 *     nobody could reach 100: the strongest option in every scenario scored 92.
 * The same four decisions that VCI and Stability read are the only ones performance reads now.
 * A wish's own performance number is still saved on its row; it simply is not averaged in.
 */
export function scenarioCountsTowardsPerformance(scenario: { decisionRole?: Block5DecisionRole }): boolean {
  return scenarioIsScored(scenario);
}

/** Same question, asked of a stored result. */
export function resultCountsTowardsPerformance(result: Block5ScenarioResult): boolean {
  return resultIsScored(result);
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

/* ================================================================================================
   STABILITY - DID THE PARTICIPANT'S PRIORITIES CHANGE DURING BLOCK 5?
   ================================================================================================

   THE QUESTION IT ANSWERS
   -----------------------
   When the participant went against their best fit, did the ORDER of their four policy values -
   which comes first, second, third and fourth - change? 100 means no two of their priorities ever
   traded places.

   It is a question about VALUES, not choices. VCI asks whether the choices fit the values as they
   stood; Stability asks whether the values themselves were reordered. A participant can choose
   against their values in every scenario and keep the same priorities (low VCI, high Stability),
   or change their priorities once and then choose in line with the new ones (VCI recovers,
   Stability records the change). Stability is DESCRIPTIVE: a high score is not better than a low
   one, and a genuine change of heart is supposed to lower it.

   THE EQUATIONS
   -------------
   A CONFLICT STEP is a decider scenario in which the reflection ran (`cvrFired` on the result): the
   final choice was Misaligned or Strongly misaligned, and the participant either kept it (the
   endorsement update) or clarified through APA (the APA update). Nothing else counts. Keeping an
   Aligned or Weakly aligned option is not a conflict, and neither is the wish (scenario 5) or the
   prediction test (scenario 6).

     (1) Swaps in one conflict step, over the six pairs (i, j) of the four policy values:
             s_ij = 1     the pair's order REVERSED            i above j before, j above i after
             s_ij = 1/2   a tie OPENED or CLOSED               equal before and ordered after, or
                                                               the other way round
             s_ij = 0     otherwise
             swaps_t = Σ s_ij                                  0 to 6 in one step
         This is the Kendall tau distance between the ranking before the step and the ranking
         after it, with a tie counted as half a disagreement.                          -> rankSwaps

     (2) Total swaps      S = Σ swaps_t over the conflict steps

     (3) Stability        Stability = round( 100 × (1 − min(1, S / 6)) )         -> computeStability
                          6 is the number of pairs among four values: six swaps is as much
                          reordering as turning the four priorities completely upside down.

   Each swap costs 100 / 6 = 16.7 points and a half swap 8.3.

   WORKED EXAMPLE. Before a conflict the participant's order is vulnerable > harm > helped > gained.
   They keep an option built on "gained", and the endorsement update lifts it to second place:
   vulnerable > gained > harm > helped. Two pairs reversed (gained/harm and gained/helped), so this
   step is 2 swaps. With no other conflict, Stability = round(100 × (1 − 2/6)) = 67, "Shifted a
   little".

   THE LEVELS (stabilityLevel), set by the researcher by total swaps:
       Held steady             100      no two priorities traded places
       Mostly steady           83-99    more than none, at most one swap
       Shifted a little        50-82    more than one, at most three (one value climbing from last
                                        place to first is three)
       Shifted a lot           17-49    more than three, at most five
       Changed substantially    0-16    more than five - about as much as a complete reversal
   On the stored, rounded value the edges are 100 / 83 / 50 / 17: exactly one, three and five swaps
   put through equation (3). They are computed that way in the code, never written in.

   WHY SWAPS AND NOT DISTANCE TRAVELED - THE CASE FOR THE METHODS CHAPTER
   ----------------------------------------------------------------------
   The obvious alternative adds up how far the values traveled, step by step ("churn"), usually with
   a start-versus-end order check beside it. That is what Stability measured until 19 September
   2026, and it was replaced for five reasons. Every figure is reproduced by `npm run
   report:stability`, which still computes the distance measure for this comparison.
   1. THE ORDER IS WHAT THE STUDY USES. Alignment ranks options against the participant's values,
      the CVR aims at the value on top, and the planner orders the cards by the order of the values.
      A move that reorders two values changes every one of those; a move of the same size that
      leaves the order alone changes none of them. Swaps count exactly the moves that matter to the
      instrument.
   2. DISTANCE MOSTLY MEASURES THE STUDY'S OWN CONSTANTS. Every profile update is a fixed step the
      study chose (+30 / −20 for an endorsement, +30 / −10 for a clarification, +15 / −10 for keeping
      a fit, ±25 for the stakeholder). The distance a profile travels is largely those constants
      counted up, so it reports how often an update fired as much as how much the participant
      changed. Whether a step reorders two values depends on how close the participant's own scores
      were - which is information about the participant.
   3. DISTANCE NEEDS A CEILING THAT HAS TO BE SIMULATED. To become a 0-100 score, distance needs a
      "this much movement counts as maximal" constant. It could only be taken from simulated random
      responders, and it went stale - and had to be re-measured - every time a scenario, an option
      or an update constant changed. Swaps have a natural maximum, a complete reversal, which needs
      no simulation and cannot go stale.
   4. DISTANCE COULD NOT TELL THE PARTICIPANTS APART. A participant who takes up a new value in every
      scenario scored above a one-time convert in 32% of pairings under distance, and above a random
      responder in 36%. Under swaps: 10% and 12%.
   5. DISTANCE COUNTED AGREEMENT AS CHANGE. Keeping an option that already fits still nudges the
      profile, so a participant who chose their best fit in every scenario averaged 86, and 38% of
      them fell below "Held steady". Swaps count only conflict steps, so that participant scores 100.
   What swaps give up: they are blind to how far a value moved when it moved without overtaking
   another, and they come in steps of a half swap. The first is the point - Stability asks whether
   the priorities changed, not how hard the model was pushed - and the second is the price of
   measuring an order.

   WHY ONLY CONFLICT STEPS
   -----------------------
   Outside a conflict the profile still moves: keeping a fitting option lifts the value it is built
   on (applyKeepUpdates), so that a value the participant keeps choosing can climb. That is the
   MODEL correcting its estimate of someone who has just confirmed their values, not the participant
   changing them. Counted, it made "always my best fit" average 86 and "always my second best" 69.
   Only a conflict - choosing against the current best fit and then standing by it or clarifying -
   is the participant doing something to their own priorities.

   WHY ONLY THE FOUR POLICY VALUES
   -------------------------------
   Stability is about priorities, and the four policy values are the only ones ranked against each
   other to decide what fits. Stakeholder sensitivity (±25 on every reflection), directness and
   context (±20 when the second lens is compared) describe HOW a participant is moved, not WHAT they
   put first, and each has a stability score of its own (computeSensitivityStability, below).
   Mixed in, the stakeholder step - the largest fixed step in the block - supplied much of the old
   movement on its own, whatever the participant's priorities did.

   KNOWN LIMITS, TO STATE IN THE WRITE-UP
   --------------------------------------
   Every "measured" figure is printed by `npm run report:stability` (2,000 seeded random starting
   profiles, the real scoring code); the rules are asserted by `npm run validate:stability`.
   1. COARSE. Thirteen values are possible, 100 down to 0 in steps of a half swap (8.3 points).
   2. THE ROUTE MATTERS A LITTLE. A clarification moves the named value +30 and each other value
      −10; an endorsement moves the served value +30 and the sacrificed one −20. So the same change
      of heart reorders less when it goes through APA: a participant who takes up a new value in
      every scenario averages 28 through APA and 11 by keeping.
   3. A CHANGE OF HEART IS A LARGE REORDERING. A one-time convert averages 57, about the same as a
      random responder (56). Stability measures change, not quality.
   4. TIES ARE COMMON. After 11% of conflict steps two of the four values are exactly equal - the
      updates are round numbers and stop at 0 and 100 - which is why a tie opening or closing counts
      half rather than being ignored or counted whole.
   ================================================================================================ */

/** Six: the number of pairs among the four policy values, and so a complete reversal of them. */
export const STABILITY_FULL_REVERSAL = (POLICY_DIM_KEYS.length * (POLICY_DIM_KEYS.length - 1)) / 2;

/** Two scores closer than this are a tie, so that floating-point noise cannot open or close one. */
const TIE_TOLERANCE = 1e-6;
const signOf = (x: number): number => (Math.abs(x) < TIE_TOLERANCE ? 0 : Math.sign(x));

/**
 * Equation (1): how many pairs of values traded places between two rankings, a tie opening or
 * closing counted as half. The Kendall tau distance, with ties at one half.
 */
export function rankSwaps(
  before: Record<string, number>,
  after: Record<string, number>,
  keys: readonly string[] = POLICY_DIM_KEYS,
): number {
  let swaps = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const b = signOf(before[keys[i]] - before[keys[j]]);
      const a = signOf(after[keys[i]] - after[keys[j]]);
      if (b * a < 0) swaps += 1;        // the pair reversed
      else if (b !== a) swaps += 0.5;   // exactly one side is a tie: a tie opened or closed
    }
  }
  return swaps;
}

/** Equation (3) for a number of swaps. Also the level edges: one, three and five swaps. */
function stabilityFromSwaps(swaps: number): number {
  return Math.round(100 * (1 - Math.min(1, swaps / STABILITY_FULL_REVERSAL)));
}

/** The five levels, highest first, each with the most swaps it allows. Set by the researcher. */
const STABILITY_LEVELS: ReadonlyArray<{ label: string; mostSwaps: number }> = [
  { label: "Held steady", mostSwaps: 0 },
  { label: "Mostly steady", mostSwaps: 1 },
  { label: "Shifted a little", mostSwaps: 3 },
  { label: "Shifted a lot", mostSwaps: 5 },
  { label: "Changed substantially", mostSwaps: Infinity },
];

/**
 * Plain words for a stability value, 0-100 - Stability itself, or any of the three sensitivity
 * stabilities. The edges are the swap bands put through equation (3): 100 / 83 / 50 / 17.
 *
 * Deliberately NOT the VCI wording: this reports change, not fit. Presentation only - never fed
 * back into any calculation.
 */
export function stabilityLevel(value0to100: number): string {
  for (const l of STABILITY_LEVELS) {
    if (value0to100 >= stabilityFromSwaps(l.mostSwaps)) return l.label;
  }
  return STABILITY_LEVELS[STABILITY_LEVELS.length - 1].label;
}

export interface StabilityResult {
  /** 0-100, equation (3) */
  value: number;
  level: string;
  /** S: total swaps across the conflict steps, in halves */
  swaps: number;
  /** how many decider scenarios were conflict steps */
  conflictSteps: number;
  /** the swaps at each conflict step, in the order the scenarios ran */
  swapsByScenario: Array<{ scenarioId: string; swaps: number }>;
  /** the top policy value when Block 5 began, and when it ended */
  topValueBefore: string;
  topValueAfter: string;
}

/**
 * Stability: equations (1) to (3) over the stored results, against the profile the participant
 * brought into Block 5.
 *
 * Reads `policySnapshotAfter` on every result (the four values after that scenario's update) and
 * `cvrFired` to know which steps were conflicts. A record written before the snapshots existed
 * cannot be scored and returns the empty result rather than a guess.
 */
export function computeStability(
  results: Block5ScenarioResult[],
  originalProfile: Block5UserProfile | null | undefined,
): StabilityResult {
  const empty: StabilityResult = {
    value: 0, level: "—", swaps: 0, conflictSteps: 0, swapsByScenario: [],
    topValueBefore: "", topValueAfter: "",
  };
  if (!originalProfile || results.length === 0) return empty;

  const start: Record<string, number> =
    Object.fromEntries(POLICY_DIM_KEYS.map((k) => [k, scoreOf(originalProfile, k)]));
  let before = start;
  let swaps = 0;
  const swapsByScenario: StabilityResult["swapsByScenario"] = [];
  for (const r of results) {
    const after = r.policySnapshotAfter as Record<string, number> | undefined;
    if (!after) return empty;
    if (resultIsScored(r) && r.cvrFired) {
      const s = rankSwaps(before, after);
      swaps += s;
      swapsByScenario.push({ scenarioId: r.scenarioId, swaps: s });
    }
    before = after;
  }

  const value = stabilityFromSwaps(swaps);
  const top = (p: Record<string, number>) => [...POLICY_DIM_KEYS].sort((a, b) => p[b] - p[a])[0];
  return {
    value, level: stabilityLevel(value), swaps, conflictSteps: swapsByScenario.length, swapsByScenario,
    topValueBefore: top(start), topValueAfter: top(before),
  };
}

/* ------------------------------------------------------------------------------------------------
   THE THREE SENSITIVITY STABILITIES - directness, context and stakeholder, one score each
   ------------------------------------------------------------------------------------------------
   Each is ONE value, so it has no order to swap. Its stability is how far it traveled along its own
   0-100 scale during Block 5, with the whole width of the scale as the maximum:

       distance_x    = Σ | x after scenario k − x before scenario k |      over the scenarios in order
       Stability_x   = round( 100 × (1 − min(1, distance_x / 100)) )

   Distance is the right measure HERE and not for the policy values, because the argument against
   it does not apply: a single value is not ranked against anything, so the only way it can change
   is by moving along its scale, and the width of that scale is a natural maximum that needs no
   simulation. The step sizes are still the study's constants, which is limit 2 below.

   They move only at a conflict step: the stakeholder by ±25 whenever the reflection runs (up if the
   person's story moved them, down if not), directness or context by 20 × weight when the
   participant compared both lenses and said which one moved them. Keeping a fitting option, the
   wish and the prediction test never touch them, so summing over every scenario and summing over
   the conflict steps give the same number.

   Same words as Stability, on the same edges of the 0-100 value (100 / 83 / 50 / 17): "Held
   steady" if it never moved, "Mostly steady" if it traveled at most a sixth of its scale, and so on.

   KNOWN LIMITS
   1. Directness and context move only when the optional second lens is generated and answered, so
      most participants hold both at 100. That is a fact about the button, and the stored
      `cvrAltViewGenerated` says who used it.
   2. The stakeholder moves 25 points on every reflection, so its stability mostly counts
      reflections and whether the person's story moved the participant each time. Four reflections
      that each move it, unclamped, reach the full 100 points of distance.
   ------------------------------------------------------------------------------------------------ */

/**
 * The three sensitivity stabilities over the stored results. Each reads its own snapshot on every
 * result (`framingSnapshotAfter` for directness and context, `stakeholderSnapshotAfter` for the
 * stakeholder) and is null when any snapshot it needs is missing, rather than a guess.
 */
export function computeSensitivityStability(
  results: Block5ScenarioResult[],
  originalProfile: Block5UserProfile | null | undefined,
): SensitivityStabilities {
  const none: SensitivityStabilities = { directness: null, context: null, stakeholder: null };
  if (!originalProfile || results.length === 0) return none;

  const one = (
    key: "directnessSensitivity" | "contextSensitivity" | "stakeholderPerspectiveShiftSensitivity",
    after: (r: Block5ScenarioResult) => number | undefined,
  ): SensitivityStability | null => {
    let prev = scoreOf(originalProfile, key);
    let distance = 0;
    for (const r of results) {
      const now = after(r);
      if (typeof now !== "number" || !Number.isFinite(now)) return null;
      distance += Math.abs(now - prev);
      prev = now;
    }
    const value = Math.round(100 * (1 - Math.min(1, distance / 100)));
    return { value, level: stabilityLevel(value), distance: Math.round(distance * 10) / 10 };
  };

  return {
    directness: one("directnessSensitivity", (r) => r.framingSnapshotAfter?.directnessSensitivity),
    context: one("contextSensitivity", (r) => r.framingSnapshotAfter?.contextSensitivity),
    stakeholder: one("stakeholderPerspectiveShiftSensitivity", (r) => r.stakeholderSnapshotAfter),
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
  const counted = results.filter(resultCountsTowardsPerformance);
  if (counted.length === 0) return 0;
  const sum = counted.reduce((a, r) => a + (r.performanceScore ?? 0), 0);
  return Math.round(sum / counted.length);
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

/** Running-average performance across the DECISIONS confirmed so far (0 when none). A wish is not averaged in. */
export function cumulativeMetrics(results: Block5ScenarioResult[]): Block5MetricProfile {
  const list = results.filter(resultCountsTowardsPerformance)
    .map((r) => r.metrics).filter((m): m is Block5MetricProfile => !!m);
  return averageMetricProfiles(list);
}

/** What the running average would become if one more option's metrics were added. */
export function projectedMetrics(
  results: Block5ScenarioResult[],
  optionMetricsProfile: Block5MetricProfile,
): Block5MetricProfile {
  const list = results.filter(resultCountsTowardsPerformance)
    .map((r) => r.metrics).filter((m): m is Block5MetricProfile => !!m);
  list.push(optionMetricsProfile);
  return averageMetricProfiles(list);
}

/** Overall 0–100 score for a metric profile (mean of the five metrics). */
export function metricProfileScore(m: Block5MetricProfile): number {
  const sum = METRIC_KEYS.reduce((a, k) => a + (m[k] ?? 0), 0);
  return Math.round(sum / METRIC_KEYS.length);
}
