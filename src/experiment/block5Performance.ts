/**
 * block5Performance.ts — performance scored against what each scenario actually offered.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM THIS FIXES
 *
 * `performanceScore` is the unweighted mean of an option's five metrics, and the session headline
 * was the mean of those across the five scenarios. Nothing about that is wrong, but the number it
 * produces is close to uninterpretable, because the SCALE IS NOT THE ONE IT APPEARS TO BE:
 *
 *   a participant who takes the best-performing option in all five scenarios scores  69.8
 *   a participant who takes an average option every time scores                      64.9
 *   a participant who takes the WORST-performing option every time still scores      55.8
 *
 * So "Performance: 65" looks like a middling mark out of 100 and actually means dead average, and
 * the entire achievable range is 14 points wide. Two participants who behaved as differently as it
 * is possible to behave are separated by 14 points on a scale that reads as 0–100.
 *
 * WHY THIS MATTERS FOR THE STUDY, NOT JUST FOR THE UI
 *
 * The prior paper's H3 tests whether reflection costs performance, using a TOST equivalence test
 * with a margin of 0.05 on a 0–1 composite — 5 points on this scale. Against a raw composite whose
 * achievable range is 14 points, that margin is 36% OF THE ENTIRE RANGE. An equivalence test with
 * a window that wide passes almost by construction, and "reflection carries no performance cost"
 * stops being a finding and becomes an artefact of the scale.
 *
 * Normalized within scenario, the range is a true 0–100 and the same 5-point margin is 5% of it,
 * which is what the paper intended.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IS COMPUTED
 *
 *   captured = 100 x (chosen − worst available) / (best available − worst available)
 *
 * read as: OF THE PERFORMANCE THIS SCENARIO MADE AVAILABLE TO YOU, HOW MUCH DID YOU TAKE?
 *
 *   100 — you took the best-performing option on the table
 *    50 — you took something mid-range
 *     0 — you took the worst-performing option on the table
 *
 * Three properties the raw mean does not have:
 *
 *  1. It spans the full 0–100, so effect sizes and equivalence margins mean what they say.
 *  2. It is immune to menu differences BY CONSTRUCTION. The five menus here happen to be matched
 *     to within 0.9 points (0.5% of the variance in achievable scores is "which scenario you were
 *     in"; 99.5% is "which option you picked"), so this changes little in practice — but it makes
 *     the property structural rather than something that has to be re-measured after every edit.
 *  3. It is a statement about the participant's CHOICE, never about which scenarios they faced.
 *
 * THE RAW COMPOSITE IS KEPT. `performanceScore` still runs and is still stored, so anything
 * already collected stays readable and the two can be reported side by side.
 *
 * WHY THE FIVE METRICS ARE STILL UNWEIGHTED
 *
 * Nothing in Blocks 1–4 asks whether a participant values speed above reversibility, so any
 * weighting would be the study's opinion wearing the participant's name. It is the same reason
 * performance plays no part in the planner's ordering (block5Planner.ts): a system that trades
 * performance against morality on the participant's behalf makes it impossible to observe the
 * participant doing it. Equal weights are declared here rather than hidden.
 */

import { METRIC_KEYS } from "./block5Types";
import type {
  Block5MetricKey,
  Block5Scenario,
  Block5ScenarioOption,
  Block5ScenarioResult,
} from "./block5Types";

/** Unweighted mean of an option's five metrics. Same quantity `performanceScore` reports. */
export function rawComposite(option: Block5ScenarioOption): number {
  return METRIC_KEYS.reduce((a, k) => a + (option.metrics[k] ?? 0), 0) / METRIC_KEYS.length;
}

/** What one scenario's menu made available: the worst and best composite on the table. */
export interface MenuRange {
  worst: number;
  best: number;
  /** best − worst. Zero would mean the menu offers no performance choice at all. */
  span: number;
}

/**
 * The worst and best raw composite on one scenario's table.
 *
 * These two numbers are the 0 and the 100 that `capturedOf` normalizes against, so they define
 * what "took all the performance available" means for that scenario and no other.
 */
export function menuRange(scenario: Block5Scenario): MenuRange {
  const v = scenario.options.map(rawComposite);
  const worst = Math.min(...v);
  const best = Math.max(...v);
  return { worst, best, span: best - worst };
}

/**
 * How much of the available performance this option captures, 0–100.
 *
 * A menu with no span (every option identical on all five metrics) returns 50 rather than dividing
 * by zero: with nothing to choose between, the participant cannot have captured more or less than
 * anyone else, and 50 says that honestly. The authoring gates make this case unreachable in
 * practice — every scenario is required to spread each metric by at least 30 points — but the
 * guard stays, because a scoring function that can produce NaN will eventually produce NaN.
 */
export function capturedOf(scenario: Block5Scenario, option: Block5ScenarioOption): number {
  const { worst, span } = menuRange(scenario);
  if (span <= 0) return 50;
  return Math.round(((rawComposite(option) - worst) / span) * 100);
}

/**
 * "1st", "2nd", "6th" — placings, not counts.
 *
 * The cards used to print "4 of 6 here", which does not say WHICH END IS GOOD. A participant could
 * read it as "4 out of 6 points" just as easily as "4th place", and the two readings are opposites.
 * An ordinal carries the direction in the word itself, the way a race result does.
 */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Per-metric standing of one option within its scenario, for the card display. */
export interface MetricStanding {
  key: Block5MetricKey;
  /** the option's own score, 0–100 as authored */
  score: number;
  /** the worst and best any option in this scenario scores on this metric */
  worst: number;
  best: number;
  /** 0–100: where the option sits between them */
  captured: number;
  /** 1 = best in this scenario on this metric */
  rank: number;
  total: number;
}

/**
 * Every metric's standing for one option.
 *
 * This is what lets a card say "speed 89 — near the top of what this scenario allows" instead of
 * "speed 89", which invites the participant to read it as a percentage of something absolute. The
 * scale note in block5Types.ts has always said the scores are relative to the situation; this
 * makes that visible instead of documented.
 */
export function metricStandings(
  scenario: Block5Scenario,
  option: Block5ScenarioOption,
): MetricStanding[] {
  return METRIC_KEYS.map((key) => {
    const vals = scenario.options.map((o) => o.metrics[key] ?? 0);
    const worst = Math.min(...vals);
    const best = Math.max(...vals);
    const score = option.metrics[key] ?? 0;
    const sorted = [...scenario.options].sort(
      (a, b) => (b.metrics[key] ?? 0) - (a.metrics[key] ?? 0) || a.id.localeCompare(b.id),
    );
    return {
      key,
      score,
      worst,
      best,
      captured: best === worst ? 50 : Math.round(((score - worst) / (best - worst)) * 100),
      rank: sorted.findIndex((o) => o.id === option.id) + 1,
      total: scenario.options.length,
    };
  });
}

/** Where one option's overall performance places among the options it was shown beside. */
export interface OverallStanding {
  /** 0-100, the captured score */
  captured: number;
  /** 1 = the strongest-performing option on this table */
  rank: number;
  total: number;
}

/**
 * The option's overall placing AND its captured score.
 *
 * WHY THE PLACING IS NEEDED AS WELL AS THE PERCENTAGE. `captured` is a min-max position, so the
 * weakest option on every table scores exactly 0 and the strongest exactly 100 by construction.
 * On its own, "this option takes 0% of the outcome quality" reads as "this option achieves
 * nothing" — which is false, and badly so: the 0% option in scenario 1 scores 45/46/71/72/37 and
 * is simply last. It is also possible for two options to sit 4 points apart on captured while
 * their per-metric placings look completely different, because three options can be all but tied
 * on the mean by taking different routes to it.
 *
 * Printing the placing next to the percentage fixes both readings at once: the placing uses the
 * same grammar as the five bars above it, and the percentage then says HOW FAR APART the placings
 * actually are — which is the thing a rank alone can never tell you.
 *
 * Ties are broken by id so the ordering is stable, exactly as `metricStandings` does.
 */
export function overallStanding(
  scenario: Block5Scenario,
  option: Block5ScenarioOption,
): OverallStanding {
  const sorted = [...scenario.options].sort(
    (a, b) => rawComposite(b) - rawComposite(a) || a.id.localeCompare(b.id),
  );
  return {
    captured: capturedOf(scenario, option),
    rank: sorted.findIndex((o) => o.id === option.id) + 1,
    total: scenario.options.length,
  };
}

/**
 * Session performance: the mean of the per-scenario captured scores.
 *
 * Averaging is legitimate here for a reason the raw composite could only claim: each term is
 * already expressed as a share of what that scenario offered, so the terms are on the same scale
 * by construction rather than by the menus happening to match.
 */
export function overallCaptured(results: Block5ScenarioResult[]): number {
  const vals = results
    .map((r) => r.performanceCaptured)
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** Plain words for a captured score. Deliberately about the CHOICE, not about the person. */
export function capturedLabel(v: number): string {
  if (v >= 90) return "Took the strongest option available";
  if (v >= 70) return "Took a strong option";
  if (v >= 45) return "Took a middle option";
  if (v >= 20) return "Took a weaker option";
  return "Took the weakest option available";
}
