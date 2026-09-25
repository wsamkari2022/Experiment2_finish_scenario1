/**
 * block5Prediction.ts — the model's stated guess at which option a participant will choose.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR
 * Scenario 6 shows the participant a probability for each of the six options before asking whether
 * the guess describes them. This file produces those probabilities. It is the only place they are
 * computed, so the number a participant is shown, the number stored for analysis, and the number a
 * validation run measures are always the same number.
 *
 * THIS FILE READS THE MODEL. IT MUST NEVER WRITE TO IT.
 * Nothing here returns a profile, and nothing here may be wired into a profile update. Scenario 6
 * is a test OF the model, so letting it feed the model would make the test evidence for the thing
 * it is testing. The same rule keeps Stability honest: a sixth scenario that moved the profile
 * would add swaps that no decision of the participant's produced.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * THE ONE MEASUREMENT THAT SHAPED EVERY CHOICE BELOW
 *
 * Across 3,000 randomly drawn profiles, the gap in alignment score between a scenario's BEST option
 * and its SECOND best is:
 *
 *     p10 = 0 points   ·   median = 7 points   ·   p90 = 22 points
 *
 * The model usually cannot separate the top two options. That is a fact about the instrument, not a
 * flaw in this file, and it has a direct consequence: an honest prediction is usually a hedged one.
 * A rule that announced "we are 80% sure you will pick this" off a 7-point gap would be asserting
 * confidence the underlying scores do not contain, and the first participant to pick the other
 * option would be right to say the model had overreached.
 *
 * So the probabilities here are deliberately soft in the ordinary case and sharpen only when the
 * participant's own profile genuinely separates the options.
 */

import type {
  Block5PolicyDimKey,
  Block5ScenarioOption,
  Block5UserProfile,
} from "./block5Types";
import { POLICY_DIM_KEYS, POLICY_DIM_SHORT } from "./block5Types";
import { optionMainValue, policyAlignmentScore, policyAlignmentShortfall, policyDelivery } from "./block5CVR";

/**
 * Stamped onto every stored prediction.
 *
 * The prediction rule is a claim the study makes BEFORE seeing how participants behave, and the
 * whole value of scenario 6 rests on that rule being fixed in advance. Bump this if any constant
 * or formula below changes, so a stored prediction can always be traced to the rule that produced
 * it. Predictions made under different versions must not be pooled.
 */
export const PREDICTION_VERSION = "2026-09-19-e";

/*
 * VERSION HISTORY. Predictions made under different versions must not be pooled.
 *
 *   2026-09-13-a  First rule. Softmax over the DISPLAYED alignment score, which stops at 0.
 *   2026-09-14-b  Softmax over the uncensored shortfall instead. The displayed score floors at 0,
 *                 so a demanding participant could push every option there and receive four
 *                 identical probabilities - the model declaring it knew nothing at exactly the
 *                 moment their values were most pronounced. Away from the floor the two rules give
 *                 identical probabilities, because a softmax is unchanged by adding a constant to
 *                 every input, so only floored cases differ. `separation` moved onto the same
 *                 uncensored quantity for the same reason. This bump was missed when the change
 *                 was made, which is the failure the constant exists to prevent: for one commit,
 *                 two different rules were stamped with the same version and could not be told
 *                 apart in the data. No participant data was collected under either.
 *   2026-09-18-c  Nothing in this file changed. Its VCI INPUT did: a final choice reached through the
 *                 APA clarification is now judged on the profile the participant brought into that
 *                 scenario, as the keep path always was, and ties in the label ranking are broken by
 *                 what an option delivers rather than by its id (see block5CVR.ts). The same run of
 *                 choices can therefore give a different VCI, so a different confidence and
 *                 temperature here. Moved so that the two can never be pooled by mistake.
 *   2026-09-19-d  Nothing in this file changed. Its VCI INPUT did again: each alignment label now
 *                 carries the weight given by its place in line (1.00 / 0.80 / 0.50 / 0.10 on six
 *                 options; see the VCI section of block5CVR.ts), so the same run of choices gives a
 *                 different VCI, and so a different confidence and temperature here.
 *   2026-09-19-e  Two changes. (1) An exact tie in fit is ranked the way labelOptions ranks it (what
 *                 the option delivers, then id) rather than by card position, so "most likely"
 *                 is always the Aligned option; probabilities are unchanged, only the rank of
 *                 tied options. (2) Its Stability INPUT changed: Stability now counts swaps in the
 *                 order of the four policy values at the conflict steps (block5CVR.ts), so the
 *                 same run gives a different Stability, confidence and temperature.
 */

/* ------------------------------------------------------------------ the confidence dial */

/**
 * Temperature at maximum confidence. Lower = sharper.
 *
 * Not a free choice. At 18, the median case above (a 7-point gap over the runner-up) puts the top
 * option near 40% rather than near 80%, which is about as far as a 7-point difference can honestly
 * be pushed. Going lower would manufacture certainty out of a gap the instrument cannot resolve.
 */
const TEMPERATURE_SHARP = 18;

/**
 * Temperature at minimum confidence. Higher = flatter.
 *
 * At 60 the six options sit close to even, which is the correct output for a participant whose
 * values moved a great deal during the block: their profile is a poor guide to their next choice
 * and the prediction should say so by declining to commit, rather than by guessing confidently and
 * being wrong half the time.
 *
 * It is not set to infinity. Even an unstable participant's profile carries some information, and a
 * perfectly flat prediction would throw away the part that is real.
 */
const TEMPERATURE_FLAT = 60;

/**
 * How sure the model is allowed to be about this particular participant, 0 to 1.
 *
 * VCI and Stability are each already on 0-100 and each answers half of the question a predictor
 * needs to ask:
 *
 *   VCI       did this person's past choices match their profile? A high VCI means the profile has
 *             been predicting them correctly all block, so it has earned confidence here.
 *   Stability did the order of their priorities hold when they went against their best fit? A
 *             profile whose priorities were reordered during Block 5 is a snapshot of someone who
 *             is changing, and is a weaker basis for a forecast.
 *
 * EQUAL WEIGHTS ARE A DECLARED CHOICE, not neutrality. Nothing in the study measures whether
 * consistency or steadiness is the better predictor of a sixth choice, so any other weighting would
 * be the study's opinion wearing the participant's name. If real data later shows one dominates,
 * change it here, bump PREDICTION_VERSION, and say so.
 *
 * Missing inputs fall to 0 rather than to a middle value: an unknown confidence is not an average
 * confidence, and the safe direction is the flat prediction that claims less.
 */
export function predictionConfidence(vci: number | null | undefined,
                                     stability: number | null | undefined): number {
  const v = typeof vci === "number" && Number.isFinite(vci) ? clamp01(vci / 100) : 0;
  const s = typeof stability === "number" && Number.isFinite(stability) ? clamp01(stability / 100) : 0;
  return clamp01((v + s) / 2);
}

/** Confidence 0 gives TEMPERATURE_FLAT, confidence 1 gives TEMPERATURE_SHARP. */
function temperatureFor(confidence: number): number {
  return TEMPERATURE_FLAT - clamp01(confidence) * (TEMPERATURE_FLAT - TEMPERATURE_SHARP);
}

/* ------------------------------------------------------------------------------- types */

export interface PredictedOption {
  optionId: string;
  optionTitle: string;
  /** The model's raw fit score for this option, 0-100. What the probability is derived from. */
  alignmentScore: number;
  /** 0-1. The six probabilities in one prediction sum to 1. */
  probability: number;
  /** 1 = most likely. Ties are broken by the option's order in the scenario, never randomly. */
  rank: number;
  /** The value this option is built on, and the participant-facing name for it. */
  builtOn: Block5PolicyDimKey;
  builtOnLabel: string;
}

export interface ChoicePrediction {
  version: string;
  options: PredictedOption[];
  /** 0-1, from VCI and Stability. */
  confidence: number;
  /** The softmax temperature actually used. Stored so a stored prediction is reproducible. */
  temperature: number;
  /** The top option's probability, 0-1. Convenience for analysis; also in `options`. */
  topProbability: number;
  /**
   * Alignment-score gap between the best and second-best option.
   *
   * The honest headline for how much the model really knows here. A prediction with a separation of
   * 2 is a coin flip dressed up in percentages, and an analysis that ignores this column will treat
   * those cases as though the model had committed to something.
   */
  separation: number;
  /** The participant's highest-ranked policy values, strongest first. Drives the explanation. */
  leadingValues: Block5PolicyDimKey[];
}

/* --------------------------------------------------------------------------- the engine */

/**
 * Turn six alignment scores into six probabilities.
 *
 * WHY SOFTMAX AND NOT "the top option wins".
 * A single named guess cannot be wrong by degrees, so it cannot be calibrated, and calibration is
 * the only thing that makes a prediction testable. Saying "38%" makes a claim that can be checked
 * against how often that option is actually chosen; saying "you will pick this" cannot.
 *
 * WHY THE SCORES ARE USED RAW.
 * The shortfall is already on a common ruler with the participant's own values, which is the
 * entire point of the calibration step upstream. (The displayed score has been a share of each
 * participant's own maximum since 24 September 2026; the softmax does not read it.) Re-normalising the six scores per scenario
 * would throw that away and make a scenario where every option fits badly look identical to one
 * where every option fits well.
 */
export function predictChoice(
  options: Block5ScenarioOption[],
  profile: Block5UserProfile,
  inputs: { vci?: number | null; stability?: number | null },
): ChoicePrediction {
  const confidence = predictionConfidence(inputs.vci, inputs.stability);
  const temperature = temperatureFor(confidence);

  /*
   * THE SOFTMAX RUNS ON THE UNCENSORED SHORTFALL, NOT ON THE FLOORED SCORE.
   *
   * `policyAlignmentScore` stopped at 0 until 24 September 2026, and for a demanding participant
   * every option could land there.
   * Feeding four identical zeros to a softmax returns four identical probabilities, so the
   * prediction would say "25% each" and mean nothing - exactly when the participant's own values
   * are most pronounced.
   *
   * Nothing else changes. Away from the floor the old score was 100 minus the shortfall, and a softmax
   * is unaffected by adding a constant to every input, so the probabilities are identical for every
   * participant who was already being served correctly. `alignmentScore` is still reported for
   * display; only the arithmetic moved.
   */
  const scored = options.map((o) => ({
    option: o,
    alignmentScore: policyAlignmentScore(o, profile),
    fit: -policyAlignmentShortfall(o, profile),
  }));

  /* Subtract the maximum before exponentiating. Standard softmax hygiene: without it a score of
     100 over a temperature of 18 is exp(5.6), which is fine here but stops being fine the moment
     anyone widens the scale, and a silent overflow would produce NaN probabilities on a page a
     participant is reading. */
  const max = Math.max(...scored.map((s) => s.fit));
  const weights = scored.map((s) => Math.exp((s.fit - max) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);

  /* Separation is measured on the uncensored fit for the same reason: two options both floored at
     a displayed 0 would otherwise report a separation of 0 and be called an unbreakable tie, when
     one of them may have missed by 70 points more than the other. */
  const sortedFits = [...scored].map((s) => s.fit).sort((a, b) => b - a);
  const separation = Math.round((sortedFits[0] ?? 0) - (sortedFits[1] ?? 0));

  const withProb = scored.map((s, i) => ({
    optionId: s.option.id,
    optionTitle: s.option.title,
    alignmentScore: s.alignmentScore,
    probability: total > 0 ? weights[i] / total : 1 / Math.max(1, scored.length),
    builtOn: optionMainValue(s.option),
    builtOnLabel: POLICY_DIM_SHORT[optionMainValue(s.option)],
    /* Placeholder; assigned below once the order is known. */
    rank: 0,
  }));

  /* Rank by probability. An exact tie - two options that fit identically, so the softmax gives them
     the same probability - is broken EXACTLY AS labelOptions breaks it: by what the option gives of
     the values the participant holds (policyDelivery), then by id. So the option the MPF calls
     "most likely" is always the option labeled Aligned. Broken by card position instead, as it
     was until 19 September 2026, the two disagreed in 5-9% of scenario-profile pairs in scenarios
     1-5 and 1.8% in scenario 6, purely over which card was written first. The same profile and
     scenario still always produce the same ordering - a prediction that reshuffled between
     renders would be untestable. */
  const delivered = new Map(options.map((o) => [o.id, policyDelivery(o, profile)]));
  const order = withProb
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (b.o.probability - a.o.probability)
      || ((delivered.get(b.o.optionId) ?? 0) - (delivered.get(a.o.optionId) ?? 0))
      || a.o.optionId.localeCompare(b.o.optionId));
  order.forEach((entry, idx) => { entry.o.rank = idx + 1; });

  return {
    version: PREDICTION_VERSION,
    options: withProb,
    confidence,
    temperature,
    topProbability: order[0]?.o.probability ?? 0,
    separation,
    leadingValues: leadingValuesOf(profile),
  };
}

/** The participant's policy values, strongest first. */
function leadingValuesOf(profile: Block5UserProfile): Block5PolicyDimKey[] {
  const score = (k: Block5PolicyDimKey) =>
    profile.dimensions.find((d) => d.key === k)?.score ?? 0;
  return [...POLICY_DIM_KEYS].sort((a, b) => score(b) - score(a));
}

/* ------------------------------------------------------------------- words for the page */

/**
 * How the prediction should describe its own confidence, in the participant's language.
 *
 * Tied to `separation` rather than to the top probability, because separation is the thing that
 * says whether the model distinguished the options at all. Two options at 34% and 33% should never
 * be introduced with the same sentence as one at 34% against 12%.
 */
export function predictionStrength(separation: number): "clear" | "slight" | "none" {
  if (separation >= 15) return "clear";
  if (separation >= 5) return "slight";
  return "none";
}

/**
 * One sentence naming why the model expects what it expects.
 *
 * Names the participant's own two leading values and the value the favoured option is built on. It
 * deliberately does NOT say "you should pick this" or "this is the right option for you" — the
 * study's promise is a system that does not push, and a prediction is only a description of what
 * the model expects, offered so the participant can disagree with it.
 */
export function predictionReason(prediction: ChoicePrediction): string {
  const top = prediction.options.find((o) => o.rank === 1);
  const [first, second] = prediction.leadingValues;
  const lead = `Across your earlier answers you leaned most on ${POLICY_DIM_SHORT[first]}`
    + (second ? ` and then on ${POLICY_DIM_SHORT[second]}` : "");
  if (!top) return `${lead}.`;

  switch (predictionStrength(prediction.separation)) {
    case "clear":
      return `${lead}. The option below that we expect you to pick is built on ${top.builtOnLabel}.`;
    case "slight":
      return `${lead}. Two of the options below fit you almost equally well, so this is a close call.`;
    default:
      return `${lead}. The options below fit you so evenly that we genuinely cannot tell them apart.`;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
