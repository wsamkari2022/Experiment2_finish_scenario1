/**
 * block5VciAll.ts — VCI_all, and the hidden RUNNING values behind it (since 28 September 2026).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT MEASURES, AND WHY IT EXISTS
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * VCI asks how well a participant's choices fit their own values in the four scenarios where they
 * DECIDE and know their position (scenarios 1-4). The researcher also wanted to know whether they hold
 * to their values in the other two situations: when the decision lands on them (scenario 5, the wish)
 * and when they do not know their position (scenario 6, the veil). VCI_all is the same kind of number
 * over all six scenarios. Both are shown on the results page, VCI unchanged beside it. It changes no
 * existing score, nothing on the scenario pages, and nothing the study's own values do.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * THE RUNNING VALUES (the researcher's design, 28 September 2026)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * A second, hidden copy of the four policy values that moves after EVERY final decision:
 *
 *   scenarios 1-4   the study's own update moves them, so they ARE the study's values
 *   scenario 5      the wish moves them too (the study's own values never move on a wish)
 *   scenario 6      the rule moves them too (the study's own values must never move there)
 *
 * In scenarios 5 and 6 no reflection runs, so the rules that read the reflection's answers have
 * nothing to read. The RUNNING RULE is the keep rule's comparison with the best fit, for every pick
 * that is not the best fit (+20 / -15; the best fit moves nothing): `applyRunningMoveWithMoves` in
 * block5CVR.ts (the researcher's choice "Q1-A").
 *
 * THE RUNNING FIT of a scenario is its FINAL choice's label on the running values AS THEY STOOD WHEN
 * THE SCENARIO OPENED - never on values its own choice moved. Judging a choice on the values it moved
 * would let anybody who changes value every time look consistent: the study rejected exactly that on
 * 18 September 2026 (it gave a person who switches value every scenario 56 instead of 31; gate V8).
 * Scenario 6 counts its FINAL choice (the researcher's decision), the one made after the MPF's guess;
 * the rule chosen before the guess stays on the record (`predictionTest.firstChoiceOptionId`).
 *
 * VCI_all = 100 × the mean of the six running fits, each `labelWeight(label, number of options)`:
 * 1.00 / 0.80 / 0.50 / 0.10 on six options, 1.00 / 0.67 / 0.33 / 0.00 on scenario 6's four. Blind
 * picking averages exactly 50 on either menu, so VCI_all reads like VCI: 50 = blind, 100 = the best fit
 * every time.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT DIFFERS FROM THE NUMBERS ON SCREEN, STATED (the researcher accepted both, "Q2-yes")
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * Scenario 5's cards are shown and scored on the values scenario 4 OPENED with (profileShownIn), so the
 * two identical scenarios show identical numbers. The running fit judges the wish on the values AFTER
 * scenario 4's choice. Measured on 2,000 × 12 pretend participants (28 September 2026):
 *   - THE ECHO. Scenario 4's choice moves the values toward the option chosen, and scenario 5 offers the
 *     same six options, so wishing for the option one decided often scores higher (35 in 100 of those
 *     who do). Example: "Protect full visits" 80 in scenario 4, 100 as the wish.
 *   - SCREEN AGAINST YARDSTICK. 8 in 100 wishes for the card that LOOKS best on screen score below 100
 *     on the running values.
 * VCI (scenarios 1-4) and `vci_wished` (the wish on scenario 4's opening values, hypothesis H12) are
 * untouched by either.
 *
 * TRAPS FOR AN ANALYST: VCI_all contains VCI's four parts, so never correlate the two (compare their
 * difference); there are two scenario-5 fits and two scenario-6 fits (the study's and the running),
 * and two sets of values (the study's and the running) - every running field says "running".
 */

import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import {
  POLICY_DIM_KEYS,
  type AlignmentLevel,
  type Block5PolicyDimKey,
  type Block5RunningFit,
  type Block5Scenario,
  type Block5ScenarioResult,
  type Block5UserProfile,
} from "./block5Types";
import {
  applyRunningMoveWithMoves, labelOptions, labelWeight, profileWithScores, roundForRecord, scenarioIsScored,
} from "./block5CVR";

/** Stamped on every running fit. Move it whenever the running rule or the running fit changes. */
export const RUNNING_VERSION = "2026-09-28-a";

function policyValues(profile: Block5UserProfile): Record<Block5PolicyDimKey, number> {
  const out = {} as Record<Block5PolicyDimKey, number>;
  for (const k of POLICY_DIM_KEYS) {
    out[k] = roundForRecord(profile.dimensions.find((d) => d.key === k)?.score ?? 0);
  }
  return out;
}

/**
 * One scenario's running step: judge the final choice on the running values the scenario opened with,
 * then move them. In scenarios 1-4 the move IS the study's own update (`studyNext`, the profile the
 * study moved to); in scenarios 5 and 6 it is the running rule.
 */
export function runningStep(
  scenario: Block5Scenario,
  selectedOptionId: string,
  runningWhenOpened: Block5UserProfile,
  studyNext: Block5UserProfile,
): { record: Block5RunningFit; next: Block5UserProfile } {
  const chosen = labelOptions(scenario.options, runningWhenOpened).find((o) => o.id === selectedOptionId);
  if (!chosen) throw new Error(`[runningStep] ${selectedOptionId} is not an option of ${scenario.id}`);
  const level: AlignmentLevel = chosen.level;

  let next: Block5UserProfile;
  let movedBy: Block5RunningFit["movedBy"];
  let moves: Block5RunningFit["moves"];
  if (scenarioIsScored(scenario)) {
    next = studyNext;
    movedBy = "study_update";
  } else {
    const option = scenario.options.find((o) => o.id === selectedOptionId) ?? chosen;
    const update = applyRunningMoveWithMoves(runningWhenOpened, option, scenario.options, scenario.stakesWeight ?? 1);
    next = update.profile;
    movedBy = "compare_with_best_fit";
    moves = update.moves;
  }
  return {
    record: {
      version: RUNNING_VERSION,
      level,
      vciScore: labelWeight(level, scenario.options.length),
      valuesWhenOpened: policyValues(runningWhenOpened),
      valuesAfter: policyValues(next),
      movedBy,
      ...(moves ? { moves } : {}),
    },
    next,
  };
}

/* ------------------------------------------------------------------ the level words */

/**
 * VCI_all's six level words, with edges DERIVED the way VCI's are (never hand-tuned; the researcher's
 * approval "Q3-yes"): the score of choosing the same label in every scenario, averaged over this deck's
 * menus (five of six options, one of four), and the midpoints between neighbors. With today's deck:
 * 88.89 / 77.78 / 62.5 / 47.22 / 27.78 - VCI's are 90 / 80 / 65 / 50 / 30, lower here only because
 * scenario 6's four-option weights are lower for every label but the best fit.
 */
const MENU_SIZES = BLOCK5_SCENARIOS.map((s) => s.options.length);
const alwaysScore = (level: AlignmentLevel) =>
  100 * (MENU_SIZES.reduce((a, n) => a + labelWeight(level, n), 0) / MENU_SIZES.length);
const edge = (x: number) => Math.round(x * 100) / 100;
const ALWAYS = {
  aligned: alwaysScore("aligned"),
  weakly: alwaysScore("weakly_aligned"),
  misaligned: alwaysScore("misaligned"),
  strongly: alwaysScore("strongly_misaligned"),
};
export const VCI_ALL_LEVELS: ReadonlyArray<{ label: string; from: number }> = [
  { label: "Highly Consistent", from: edge((ALWAYS.aligned + ALWAYS.weakly) / 2) },
  { label: "Mostly Consistent", from: edge(ALWAYS.weakly) },
  { label: "Moderate", from: edge((ALWAYS.weakly + ALWAYS.misaligned) / 2) },
  { label: "Low", from: edge(ALWAYS.misaligned) },
  { label: "Very Low", from: edge((ALWAYS.misaligned + ALWAYS.strongly) / 2) },
  { label: "Highly Inconsistent", from: -Infinity },
];

export function vciAllLevel(value: number): string {
  return (VCI_ALL_LEVELS.find((l) => value >= l.from) ?? VCI_ALL_LEVELS[VCI_ALL_LEVELS.length - 1]).label;
}

/**
 * VCI_all from the saved running fits: 100 × the mean of `running.vciScore` over every scenario that has
 * one, rounded like VCI. A run finished after 28 September 2026 has all six.
 */
export function computeVciAll(results: Block5ScenarioResult[]): { value: number; level: string; counted: number } {
  const fits = results.map((r) => r.running?.vciScore).filter((x): x is number => typeof x === "number");
  if (fits.length === 0) return { value: 0, level: "—", counted: 0 };
  const value = Math.round((fits.reduce((a, b) => a + b, 0) / fits.length) * 100);
  return { value, level: vciAllLevel(value), counted: fits.length };
}

/* ------------------------------------------------------------------ rebuilt from the saved record */

/**
 * The running fits worked out AGAIN from what every record already saves - the values the participant
 * brought into Block 5, each scenario's final choice, and the study's value snapshot after each decision -
 * with the same functions the page uses. Used by dbShape (analysis.vci_all) as a self-check against the
 * stored `running` records, and to give a record made before 28 September 2026 a VCI_all. Returns null
 * for a row whose scenario is unknown or whose snapshot is missing; from then on nothing can be rebuilt.
 */
export function rebuildRunningFits(
  results: Block5ScenarioResult[],
  originalProfile: Block5UserProfile,
): Array<Block5RunningFit | null> {
  let running: Block5UserProfile | null = originalProfile;
  return results.map((r) => {
    const scenario = BLOCK5_SCENARIOS.find((s) => s.id === r.scenarioId);
    if (!running || !scenario || !r.selectedOptionId) { running = null; return null; }
    let studyNext = running;
    if (scenarioIsScored(scenario)) {
      if (!r.policySnapshotAfter) { running = null; return null; }
      const scores: Record<string, number> = { ...r.policySnapshotAfter };
      if (r.framingSnapshotAfter) Object.assign(scores, r.framingSnapshotAfter);
      if (typeof r.stakeholderSnapshotAfter === "number") scores.stakeholderPerspectiveShiftSensitivity = r.stakeholderSnapshotAfter;
      studyNext = profileWithScores(running, scores);
    }
    const step = runningStep(scenario, r.selectedOptionId, running, studyNext);
    running = step.next;
    return step.record;
  });
}
