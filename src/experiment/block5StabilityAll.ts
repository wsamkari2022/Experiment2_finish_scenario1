/**
 * block5StabilityAll.ts — Stability_all and the top-value choices (since 29 September 2026).
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHY (the researcher: "Stability_all for all 6 scenarios, so we can see if the user will pick the most top
 * value or values as pre-block5 user profile?"; plan answers "Q1-yes, Q2-recommended, Q3-recommended, Q4-A")
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * Stability counts, at the moments a participant chose against their best fit, how many pairs of their four
 * values traded places. It covers the four decisions only (scenarios 1-4). Stability_all is the same rule over
 * all six scenarios, read from the hidden RUNNING values behind VCI_all (block5VciAll.ts), which are the study's
 * own values through scenario 4 and also move after the wish (scenario 5) and the veil (scenario 6).
 *
 * WHICH STEPS COUNT ("Q2-recommended")
 *   scenarios 1-4   exactly Stability's: a decision where the reflection ran (`cvrFired`). The running values
 *                   ARE the study's values there, so this part equals Stability's count, swap for swap.
 *   scenarios 5, 6  when the FINAL choice was not one of the two best fits on the running values the scenario
 *                   opened with - the moment a reflection would have run in a decision. None runs there, so the
 *                   values move by the running rule (+20 / -15), smaller steps than a reflection's.
 * A second-best pick never counts anywhere, as in Stability: it is the model refining its estimate.
 * Stability_all = 100 × (1 - min(1, swaps / 6)), Stability's own equation (`stabilityFromSwaps`) and level words.
 * So Stability_all is never above Stability, and equals it when neither scenario 5 nor 6 was counted.
 *
 * SINCE 2 OCTOBER 2026, LIKE STABILITY, TWO PARTS AVERAGED (block5CVR.ts, "Stability has two parts"): the ORDER part is
 * the equation above (so the order part is never above Stability's order part); the DIFFERENCE part is 100 - the
 * average points the four running values moved at the counted steps, added up; Stability_all = their average, with
 * Stability's level words and edges. Because a move in scenario 5 or 6 can bring a value back toward where it began,
 * the combined Stability_all CAN now be a little above Stability (about 5 in 100 pretend runs); it equals Stability
 * when neither scenario 5 nor 6 was counted.
 *
 * TOP-VALUE CHOICES ("Q4-A": saved for the analysis, never shown). In how many of the six scenarios the final
 * choice was the option that does MOST for the participant's #1 value as they brought it into Block 5 (and, as a
 * second count, for their #1 or their #2). Ties at the top count for every tied option. This answers the second
 * half of the researcher's question directly; it looks at the top value only, so it is not VCI.
 *
 * Measured on 2,000 pretend participants of each kind (real code): Stability -> Stability_all, the value
 * followers 100 -> 100 and 90.5 -> 89.4, random responders 57.5 -> 39, flip-floppers 11.7 -> 3.4; top-value picks
 * of six: true to their top value 6, best-fit pickers 2.7, random 1.2.
 *
 * TRAPS: Stability_all contains Stability (never correlate them; compare the difference). Its absolute level
 * depends on the step sizes, like Stability's. Scenario 5 has VCI_all's "echo": it is shown on scenario 4's
 * opening values and judged on the running values after scenario 4's choice, so about 5 in 100 second-best
 * pickers get a counted step there.
 */

import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { POLICY_DIM_KEYS, type Block5PolicyDimKey, type Block5RunningFit, type Block5ScenarioResult, type Block5UserProfile } from "./block5Types";
import { combineStability, differenceStabilityFromMoves, rankSwaps, stabilityFromSwaps, stabilityLevel } from "./block5CVR";

/** Stamped on the saved section. Move it whenever the rule of which steps count, or the equation, changes. */
export const STABILITY_ALL_VERSION = "2026-10-02-b";

const isFit = (level: string | undefined) => level === "aligned" || level === "weakly_aligned";
const isDecision = (r: Block5ScenarioResult) => (r.decisionRole ?? "decider") === "decider";

export interface StabilityAllStep {
  scenarioId: string;
  /** 1-6, the order the scenario was met in. */
  index: number;
  kind: "decision" | "wish" | "veil";
  counted: boolean;
  /** Why it was counted or not, in words. */
  why: string;
  /** Pairs of values that traded places at this step (0 when not counted). */
  swaps: number;
  /** Since 2 October 2026: the points each of the four running values moved at this step (empty when not counted). */
  moves: Record<string, number>;
}

export interface StabilityAllResult {
  /** 0-100. Since 2 October 2026 the average of the two parts below, as Stability. */
  value: number;
  /** The order part (Value_Order_Stability_all): equation (3) over the counted steps' swaps. */
  orderValue: number;
  /** The difference part (Value_Difference_Stability_all): 100 - the average points the running values moved at them. */
  differenceValue: number;
  /** The average, over the four values, of the points moved at the counted steps (added up), one decimal. */
  averageMove: number;
  level: string;
  swaps: number;
  conflictSteps: number;
  /** False when no step counted: 100 then means "never tested", not "held". */
  measured: boolean;
  steps: StabilityAllStep[];
  /** How many of the six had a running record (all six on every run since 28 September 2026). */
  scenariosRead: number;
}

/**
 * Stability_all from the six scenario rows. `runningFits` defaults to the saved `running` record of each row;
 * dbShape passes rebuilt ones for a record that has none. Null when a row has no running record at all.
 */
export function computeStabilityAll(
  results: Block5ScenarioResult[],
  runningFits: Array<Block5RunningFit | null | undefined> = results.map((r) => r.running),
): StabilityAllResult | null {
  if (results.length === 0 || runningFits.some((f) => !f)) return null;
  let swaps = 0;
  const moved: Record<string, number> = Object.fromEntries(POLICY_DIM_KEYS.map((k) => [k, 0]));
  const steps: StabilityAllStep[] = results.map((r, i) => {
    const fit = runningFits[i] as Block5RunningFit;
    const decision = isDecision(r);
    const kind: StabilityAllStep["kind"] = decision ? "decision" : r.decisionRole === "recipient" ? "wish" : "veil";
    const counted = decision ? !!r.cvrFired : !isFit(fit.level);
    const why = decision
      ? (counted ? "a decision where the reflection ran (as in Stability)" : "a decision without a reflection: not counted (as in Stability)")
      : (counted ? "the final choice was not one of the two best fits on the running values"
        : "the final choice was one of the two best fits: not counted");
    const s = counted ? rankSwaps(fit.valuesWhenOpened, fit.valuesAfter) : 0;
    swaps += s;
    const moves: Record<string, number> = {};
    if (counted) {
      for (const k of POLICY_DIM_KEYS) {
        const d = (fit.valuesAfter as Record<string, number>)[k] - (fit.valuesWhenOpened as Record<string, number>)[k];
        moved[k] += d;
        moves[k] = Math.round(d * 100) / 100;
      }
    }
    return { scenarioId: r.scenarioId, index: i + 1, kind, counted, why, swaps: s, moves };
  });
  const orderValue = stabilityFromSwaps(swaps);
  const differenceValue = differenceStabilityFromMoves(moved);
  const value = combineStability(orderValue, differenceValue);
  const averageMove = Math.round((POLICY_DIM_KEYS.reduce((a, k) => a + Math.abs(moved[k]), 0) / POLICY_DIM_KEYS.length) * 10) / 10;
  const conflictSteps = steps.filter((s) => s.counted).length;
  return {
    value, orderValue, differenceValue, averageMove, level: stabilityLevel(value), swaps, conflictSteps,
    measured: conflictSteps > 0, steps, scenariosRead: results.length,
  };
}

/* ------------------------------------------------------------------ top-value choices */

export interface TopValueChoice {
  scenarioId: string;
  index: number;
  kind: "decision" | "wish" | "veil";
  /** The final choice did most (or tied for most) for the #1 value brought into Block 5. */
  mostForTopValue: boolean;
  /** ... or for the #2 value. */
  mostForTopOrSecond: boolean;
  /** How many of the options were tied best for the #1 value (1 = a single champion). */
  optionsBestForTopValue: number;
  optionsOnTheTable: number;
}

export interface TopValueChoices {
  topValue: Block5PolicyDimKey;
  secondValue: Block5PolicyDimKey;
  /** True when #1 and #2 had the same score, so which one is "#1" was a tie. */
  topTwoTied: boolean;
  scenarios: TopValueChoice[];
  countTopValue: number;
  countTopOrSecond: number;
  /** What choosing blindly would give on average, for the same menus. */
  blindTopValue: number;
  blindTopOrSecond: number;
}

/** The four policy values brought into Block 5, strongest first; a tie keeps the study's own key order. */
function orderOf(profile: Block5UserProfile): Block5PolicyDimKey[] {
  const score = (k: Block5PolicyDimKey) => profile.dimensions.find((d) => d.key === k)?.score ?? 0;
  return [...POLICY_DIM_KEYS].sort((a, b) => score(b) - score(a));
}

export function computeTopValueChoices(
  results: Block5ScenarioResult[], originalProfile: Block5UserProfile | null | undefined,
): TopValueChoices | null {
  if (!originalProfile || results.length === 0) return null;
  const [top, second] = orderOf(originalProfile);
  const score = (k: Block5PolicyDimKey) => originalProfile.dimensions.find((d) => d.key === k)?.score ?? 0;
  const scenarios: TopValueChoice[] = [];
  let blindTop = 0, blindEither = 0;
  results.forEach((r, i) => {
    const scenario = BLOCK5_SCENARIOS.find((s) => s.id === r.scenarioId);
    const chosen = scenario?.options.find((o) => o.id === r.selectedOptionId);
    if (!scenario || !chosen) return;
    const bestTop = Math.max(...scenario.options.map((o) => o.fingerprint[top]));
    const bestSecond = Math.max(...scenario.options.map((o) => o.fingerprint[second]));
    const forTop = (o: typeof chosen) => o.fingerprint[top] === bestTop;
    const forEither = (o: typeof chosen) => forTop(o) || o.fingerprint[second] === bestSecond;
    const n = scenario.options.length;
    blindTop += scenario.options.filter(forTop).length / n;
    blindEither += scenario.options.filter(forEither).length / n;
    scenarios.push({
      scenarioId: r.scenarioId,
      index: i + 1,
      kind: isDecision(r) ? "decision" : r.decisionRole === "recipient" ? "wish" : "veil",
      mostForTopValue: forTop(chosen),
      mostForTopOrSecond: forEither(chosen),
      optionsBestForTopValue: scenario.options.filter(forTop).length,
      optionsOnTheTable: n,
    });
  });
  if (scenarios.length === 0) return null;
  return {
    topValue: top,
    secondValue: second,
    topTwoTied: score(top) === score(second),
    scenarios,
    countTopValue: scenarios.filter((s) => s.mostForTopValue).length,
    countTopOrSecond: scenarios.filter((s) => s.mostForTopOrSecond).length,
    blindTopValue: Math.round(blindTop * 100) / 100,
    blindTopOrSecond: Math.round(blindEither * 100) / 100,
  };
}
