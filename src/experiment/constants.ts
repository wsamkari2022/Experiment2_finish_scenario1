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
