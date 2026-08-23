/**
 * sensitivityCalibration.ts — puts the seven sensitivities on one common ruler.
 *
 * ============================================================================
 * THE PROBLEM THIS SOLVES
 * ============================================================================
 * The seven sensitivities are computed from genuinely different kinds of statistic:
 *
 *   LEVELS      gain responsiveness, outcome aggregation
 *               "how low is your bar?" — a position on a ladder
 *   DIFFERENCES vulnerability protection, group size, directness
 *               "how much further did you move for one case than another?"
 *   VARIATION   context
 *               "how much did your answer change across three settings?"
 *   COMPOSITE   stakeholder shift
 *
 * All seven were then divided by their ladder length and called a 0-100 score, as if that
 * made them comparable. It does not. A level naturally lands near the middle of its range; a
 * difference between two answers on the same ladder is usually small. Measured on a RANDOM
 * responder — someone with no preferences at all — the raw scores came out:
 *
 *      stakeholder 63 · context 56 · outcome 50 · gain 50 · directness 37 · vuln 15 · group 13
 *
 * Block 5 then RANKS these seven against each other to decide a participant's leading value,
 * and weights them against option fingerprints. Ranking a level against a difference is like
 * asking whether someone's height is bigger than their age: the arithmetic works, the answer
 * is meaningless. In practice the two level-type dimensions won almost every time, and the
 * CVR fired on only two of the four policy values — vulnerability protection, the centre of
 * the whole thesis, fired 0% of the time.
 *
 * ============================================================================
 * THE FIX: POSITION WITHIN THE INSTRUMENT'S OWN RESPONSE SPACE
 * ============================================================================
 * Every sensitivity is re-expressed as one thing, with one meaning:
 *
 *      "the percentage of all the ways a person could answer this instrument
 *       that this participant's answers exceed on this value"
 *
 * That definition is identical for all seven, so they become directly comparable. It is also
 * a monotone relabelling: it never changes the order of two participants on the same
 * dimension, only the number attached to that order.
 *
 * WHY THIS REFERENCE, AND NOT A POPULATION
 * The tables below describe the INSTRUMENT, not people. They answer "what range of scores can
 * these questions produce, and how often?", which is a fact about the questionnaire that can
 * be recomputed by anyone from the code. No pilot data is required and no assumption about
 * participants is smuggled in — a uniform draw over the response space is the maximum-entropy
 * choice, i.e. the one that assumes least. This matters for defensibility: the scale is a
 * property of the design, fixed before any participant is recruited.
 *
 * WHY "STRICTLY EXCEEDS" AND NOT MID-RANK
 * The percentage counts response patterns STRICTLY below the participant. That guarantees a
 * raw score of zero maps to zero on every dimension, which is essential: three of the seven
 * are clamped at zero when the effect runs the wrong way, and "this factor did not move me"
 * must not be rewarded. The standard mid-rank convention would map a raw zero on group size to
 * 28/100 purely because many response patterns tie there. The cost of this choice is that the
 * highest attainable raw value maps near, rather than exactly to, 100 on some dimensions,
 * because the patterns tying at the top are not counted as exceeded. That is the honest number.
 *
 * ============================================================================
 * REGENERATING THE TABLES
 * ============================================================================
 * The tables are an empirical CDF over 200,000 draws from a seeded PRNG (seed 20260823), taken
 * by running the real `deriveMoralProfile` → `buildThresholdTree` pipeline on uniformly random
 * Block 1-4 answers, including the "never accepted" sentinel for every ladder. Each entry is
 * `[rawScore, percentOfDrawsStrictlyBelowIt]`.
 *
 * They MUST be regenerated whenever anything upstream changes the shape of a raw score:
 * a ladder gains or loses a rung, a signal weight changes, a formula changes, or a block is
 * added. If they are not, the ruler no longer matches the thing being measured.
 * See `tools/regenerate_sensitivity_calibration.md` for the procedure.
 */

/**
 * The seven dimension keys, matching `ThresholdTreeDimension.key` in thresholdTree.ts.
 * Declared here rather than imported because that field is typed as a plain `string`;
 * spelling them out gives the calibration table exhaustiveness checking.
 */
export type SensitivityKey =
  | "vulnerability_protection"
  | "group_size"
  | "gain_responsiveness"
  | "outcome_aggregation"
  | "directness"
  | "context"
  | "stakeholder_shift";

/**
 * Identifies the calibration tables in force. Stamped onto every stored participant record, so
 * analysis can tell which scores are comparable with which: two participants scored under
 * different table versions are NOT on the same ruler.
 *
 * Bump this whenever the tables below are regenerated.
 */
export const SENSITIVITY_CALIBRATION_VERSION = "null-cdf-2026-08-23";

/** `[rawScore, percentOfTheResponseSpaceStrictlyBelowThatScore]`, ascending by rawScore. */
type NullCdf = ReadonlyArray<readonly [number, number]>;

/**
 * Empirical distribution of each raw sensitivity score across the instrument's response space.
 * Generated 2026-08-23 — see the header for the procedure and when to regenerate.
 */
export const SENSITIVITY_NULL_CDF: Record<SensitivityKey, NullCdf> = {
  vulnerability_protection: [[0,0],[1,9.5],[2,12.1],[3,14.7],[4,16.9],[5,26],[6,31.4],[7,34.1],[8,37.2],[9,40.7],[10,44.6],[11,45.6],[12,48.2],[13,50.7],[14,54.2],[15,56.4],[16,58],[17,59.6],[18,61],[19,64.2],[20,65.5],[21,67.7],[22,68.8],[23,72.5],[24,74.4],[25,75.5],[26,76.9],[27,80.1],[28,81.3],[29,82.5],[30,83.8],[31,85],[32,87.2],[33,88.3],[34,88.9],[35,89.9],[36,91.2],[37,92.1],[38,92.7],[39,93.5],[40,94.2],[41,94.9],[42,95.5],[43,95.9],[44,96.3],[45,96.8],[46,97.1],[47,97.5],[48,97.7],[49,97.9],[50,98.3],[51,98.4],[52,98.5],[53,98.8],[54,99],[55,99.1],[56,99.3],[57,99.4],[58,99.4],[59,99.5],[60,99.5],[61,99.7],[62,99.7],[63,99.8],[64,99.8],[65,99.8],[66,99.8],[67,99.9],[68,99.9],[69,100],[93,100]],
  group_size: [[0,0],[8,55.2],[17,63.8],[25,72.5],[33,79.6],[42,85.6],[50,90],[58,93.9],[67,96.5],[75,98.3],[83,99.3],[92,99.8],[100,100]],
  gain_responsiveness: [[6,0],[8,0],[11,0.1],[14,0.1],[15,0.2],[17,0.2],[19,0.5],[22,1],[24,1.9],[25,2.1],[26,3.3],[28,3.7],[30,5.8],[31,6.4],[33,8.8],[35,12.7],[36,13.7],[37,16.9],[39,18.2],[42,24.2],[44,30.6],[46,38.5],[47,39.9],[48,46.4],[50,47.8],[53,55.6],[55,63.3],[56,64.5],[57,70.8],[58,71.8],[59,77.3],[61,78.1],[62,82.8],[64,83.4],[66,87.9],[67,88.2],[68,91.3],[69,91.5],[70,93.9],[72,94],[73,96.2],[75,96.2],[78,97.6],[79,98.6],[81,98.6],[83,99.4],[86,99.7],[89,99.9],[92,99.9],[94,100]],
  outcome_aggregation: [[0,0],[6,1.3],[13,3.9],[19,7.5],[25,12],[31,18.1],[38,25],[44,33.2],[50,43.1],[56,54.5],[63,64.8],[69,73.5],[75,81.3],[81,87.3],[88,92.9],[94,96.2],[100,98.8]],
  directness: [[0,0],[13,10.8],[25,31.2],[38,48.2],[50,62.8],[63,74.6],[75,84.4],[88,91.9],[100,97.4]],
  context: [[0,0],[13,1.2],[25,8],[38,18.9],[50,34.1],[63,49.4],[75,65.7],[88,81],[100,93.1]],
  stakeholder_shift: [[0,0],[8,1.7],[15,4.9],[20,7.2],[22,10.4],[25,12],[28,14.1],[30,19],[33,19.9],[35,22.5],[40,26.2],[43,28.5],[45,30.8],[48,33.7],[50,35.6],[53,41],[55,45.8],[57,46.7],[60,53.2],[65,56.7],[68,61.4],[70,63.8],[73,69.1],[75,72.1],[77,73.2],[80,83.7],[85,85.4],[93,92.5],[100,97.3]],
};

/**
 * Converts one raw sensitivity score (0-100) into its position on the common ruler (0-100).
 *
 * Values that fall between two tabulated points are interpolated linearly, so the mapping is
 * continuous and strictly order-preserving. Anything at or below the lowest attainable raw
 * score maps to 0; anything at or above the highest maps to that entry's percentage.
 */
export function calibrateSensitivity(key: string, rawScore: number): number {
  const cdf = SENSITIVITY_NULL_CDF[key as SensitivityKey];
  if (!cdf || cdf.length === 0) return Math.round(rawScore);

  if (rawScore <= cdf[0][0]) return 0;
  const last = cdf[cdf.length - 1];
  if (rawScore >= last[0]) return Math.round(last[1]);

  for (let i = 1; i < cdf.length; i++) {
    const [hiRaw, hiPct] = cdf[i];
    if (rawScore === hiRaw) return Math.round(hiPct);
    if (rawScore < hiRaw) {
      const [loRaw, loPct] = cdf[i - 1];
      const span = hiRaw - loRaw;
      const t = span === 0 ? 0 : (rawScore - loRaw) / span;
      return Math.round(loPct + t * (hiPct - loPct));
    }
  }
  return Math.round(last[1]);
}
