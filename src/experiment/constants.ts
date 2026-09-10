/**
 * constants.ts — Block 1 (Found-Money) shared constants
 *
 * Defines the escalating amount ladder and the three location contexts used in
 * MoneyThresholdBlock. The experiment presents each context in order and steps
 * through the amounts from smallest to largest until the participant either
 * clicks "Keep it" (threshold found) or exhausts all amounts (beyond range).
 */

import type { ContextDef } from "./types";

/**
 * Human-readable labels for each amount, in ascending order.
 * Used for display in the scenario sentence and in threshold result records.
 * Index 0 = $0.25, index 7 = $10,000.
 */
/**
 * BLOCK 1 LADDER — the escalating sums of found money.
 *
 * Eight rungs, roughly logarithmic, spanning trivial ($0.25) to life-changing ($10,000). The
 * span matters more than the exact values: the bottom rung must be small enough that almost
 * nobody feels a dilemma, and the top large enough that almost nobody is indifferent, so that
 * most participants' threshold falls strictly inside the ladder rather than at an end.
 *
 * Only the ORDINAL POSITION of a rung is ever used in scoring (see toMoneyComparableIndex), so
 * these figures can be re-chosen without changing any formula. Adding or removing a rung DOES
 * change MONEY_STEPS, which normalizes every Block 1 signal — and it invalidates the calibration
 * tables in sensitivityCalibration.ts, which must then be regenerated.
 */
export const AMOUNT_LABELS: readonly string[] = [
  "$0.25",
  "$1",
  "$10",
  "$20",
  "$50",
  "$100",
  "$1,000",
  "$10,000",
];

/**
 * Numeric values corresponding 1-to-1 with AMOUNT_LABELS.
 * Used when storing the accepted threshold value as a number.
 */
export const AMOUNT_VALUES: readonly number[] = [
  0.25, 1, 10, 20, 50, 100, 1000, 10000,
];

/**
 * The three location contexts presented in Block 1.
 * Each has a unique key (used as a key in ThresholdsState), a display label,
 * and a scenario function that interpolates the current amount into the sentence.
 *
 * Order matters: sidewalk → wealthy → shelter. The sequence moves from a
 * morally neutral context to a context that tests wealth-related permissiveness,
 * then to a context that tests vulnerability sensitivity.
 */
/**
 * BLOCK 1 CONTEXTS — the three places the money is found.
 *
 * These are UNORDERED categories, not a scale: a neutral sidewalk, outside a wealthy financial
 * district office, and outside a homeless shelter. They are chosen to vary the likely NEED of
 * whoever lost the money while holding the act itself constant.
 *
 * Because they are unordered, context sensitivity is measured as the RANGE across them rather
 * than a slope — there is no direction in which a slope would point. Contrast Block 3's group
 * sizes, which are ordered and therefore get a signed slope. See thresholdTree.ts.
 *
 * Each context restarts the ladder at $0.25, so the three thresholds are independent.
 */
export const CONTEXTS: readonly ContextDef[] = [
  {
    key: "sidewalk",
    label: "Neutral sidewalk",
    scenario: (amount) => `You find ${amount} on the sidewalk in a public street.`,
  },
  {
    key: "wealthy",
    label: "Wealthy financial district",
    scenario: (amount) =>
      `You find ${amount} on the ground outside a major financial district office building.`,
  },
  {
    key: "shelter",
    label: "Outside a homeless shelter",
    scenario: (amount) =>
      `You find ${amount} on the ground outside a homeless shelter.`,
  },
];

/** localStorage key under which MoneyBlockResults are saved when Block 1 completes. */
export const SESSION_KEY_RESULTS = "money_block_results";
