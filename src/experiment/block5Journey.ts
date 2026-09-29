/**
 * block5Journey.ts — the numbers behind "A picture of your journey" (Block5VisualizationsView), with no
 * React and no browser storage, so `npm run validate:journey` can check them on pretend runs.
 *
 * WHY IT EXISTS (28 September 2026, the researcher's request: "most of the visualization cards are
 * stale"). The charts page stopped at scenario 5 and predated a week of changes: VCI_all, the scenario 6
 * prediction test, the five positions, the wish's value-by-value change, Block 4. The pieces added then
 * are worked out here, each from the function that already owns the idea - the study's distance
 * (`profileDistance`), its fit labels, the stored running fits - so the page can never draw a second
 * version of a number the database stores.
 *
 * The researcher's decisions of 28 September 2026 ("Q1-A, Q2-final, Q3-yes"):
 *   - the consistency card shows VCI_all's six parts, the running fits, so its points average to the
 *     VCI_all on the results page (they were hidden until then; the page comes after every choice);
 *   - scenario 6 is shown by its FINAL rule, the one VCI_all and the choice card use;
 *   - Block 4 gets a card of its own.
 */

import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { isPredictionTest } from "./block5CVR";
import { profileDistance, type PositionKey } from "./block5Position";
import type { Block5ScenarioResult, Block5UserProfile } from "./block5Types";

/** The five positions the deck puts a participant in, in the order they meet them. The legend reads this. */
export const DECK_POSITIONS: PositionKey[] = BLOCK5_SCENARIOS
  .map((s) => s.stakePosition)
  .filter((p): p is PositionKey => !!p && p !== "behind_the_veil")
  .filter((p, i, all) => all.indexOf(p) === i);

/* ------------------------------------------------------------------ consistency, all six */

export interface ConsistencyPoint {
  /** 1-6, the order the participant met the scenario in. */
  index: number;
  kind: "decision" | "wish" | "veil";
  /** 0-100: this scenario's part of VCI_all (the running fit), or of VCI when there is no running fit. */
  value: number;
  /** The study's own fit of the same choice, 0-100: the label the cards were built on. Equal in 1-4. */
  studyValue: number;
}

export interface ConsistencyReading {
  points: ConsistencyPoint[];
  /** VCI (the four decisions), as stored. */
  vci: number | null;
  /** VCI_all (all six), as stored; null on a run finished before 28 September 2026. */
  vciAll: number | null;
  /** True when every point is a running fit, so the points average to VCI_all. */
  pointsAreVciAllParts: boolean;
}

const kindOf = (r: Block5ScenarioResult): ConsistencyPoint["kind"] =>
  r.decisionRole === "recipient" ? "wish" : isPredictionTest(r) ? "veil" : "decision";

/**
 * One point per scenario. With the running fits saved (every run since 28 September 2026) the points
 * ARE VCI_all's six parts, so their average is the VCI_all the results page shows; without them the
 * points fall back to the study's own fit and VCI_all is not drawn at all.
 */
export function consistencyReading(
  results: Block5ScenarioResult[], vci: number | undefined, vciAll: number | undefined,
): ConsistencyReading {
  const running = results.length > 0 && results.every((r) => typeof r.running?.vciScore === "number");
  const points = results.map((r, i) => {
    const studyValue = Math.round((r.vciScore ?? 0) * 100);
    return {
      index: i + 1,
      kind: kindOf(r),
      value: running ? Math.round((r.running?.vciScore ?? 0) * 100) : studyValue,
      studyValue,
    };
  });
  return {
    points,
    vci: typeof vci === "number" ? vci : null,
    vciAll: running && typeof vciAll === "number" ? vciAll : null,
    pointsAreVciAllParts: running,
  };
}

/* ------------------------------------------------------------------ scenario 6: the rule and the guess */

export interface VeilRow {
  index: number;
  title: string;
  /** The FINAL rule (the researcher's choice, "Q2-final"). */
  ruleTitle: string;
  /** Mean absolute distance from the values brought into Block 5, 0-100: the study's `profileDistance`. */
  distance: number;
  /** The nearest and farthest of the four rules from the same values, for reading the distance. */
  nearest: number;
  farthest: number;
  /** The same distance as a share of the room the four rules gave, 0-100 (as the positions' departure). */
  departure: number;
  /** True when the final rule differs from the one chosen before the guess appeared. */
  changedAfterTheGuess: boolean;
  firstRuleTitle: string | null;
}

/** Scenario 6 read the way the position cards read the other five: its final rule's distance from the
 *  person as they entered Block 5. Drawn APART from the five positions, never as a sixth bar: the veil
 *  gives no position, and its menu is four rules rather than six actions (hypothesis H13, Figure 24). */
export function veilRow(results: Block5ScenarioResult[], frozen: Block5UserProfile | undefined): VeilRow | null {
  if (!frozen) return null;
  const at = results.findIndex((r) => isPredictionTest(r));
  if (at < 0) return null;
  const r = results[at];
  const scenario = BLOCK5_SCENARIOS.find((s) => s.id === r.scenarioId);
  const option = scenario?.options.find((o) => o.id === r.selectedOptionId);
  if (!scenario || !option) return null;
  const all = scenario.options.map((o) => profileDistance(frozen, o));
  const distance = profileDistance(frozen, option);
  const nearest = Math.min(...all), farthest = Math.max(...all);
  const firstId = r.predictionTest?.firstChoiceOptionId ?? null;
  const first = firstId ? scenario.options.find((o) => o.id === firstId) : undefined;
  return {
    index: at + 1,
    title: scenario.title,
    ruleTitle: option.title,
    distance: Math.round(distance * 10) / 10,
    nearest: Math.round(nearest * 10) / 10,
    farthest: Math.round(farthest * 10) / 10,
    departure: farthest - nearest <= 0 ? 50 : Math.round(((distance - nearest) / (farthest - nearest)) * 100),
    changedAfterTheGuess: !!firstId && firstId !== r.selectedOptionId,
    firstRuleTitle: first?.title ?? null,
  };
}

export interface GuessRule {
  optionId: string;
  title: string;
  /** The MPF's chance for this rule, in percent, as shown on the page. */
  chancePercent: number;
  isMpfFirst: boolean;
  isYourFirst: boolean;
  isYourFinal: boolean;
}

export interface GuessReading {
  index: number;
  rules: GuessRule[];
  /** Did the MPF's most likely rule match the rule chosen BEFORE the guess? (What the test scores.) */
  mpfNamedYourFirstRule: boolean;
  changedAfterTheGuess: boolean;
  /** "Does this guess sound like how you decide?", 1-7, or null when unanswered. */
  soundsLikeYou: number | null;
  surprised: boolean | null;
}

/** The prediction test as the participant met it: the four rules with the MPF's chances, most likely first. */
export function guessReading(results: Block5ScenarioResult[]): GuessReading | null {
  const at = results.findIndex((r) => isPredictionTest(r));
  if (at < 0) return null;
  const r = results[at];
  const test = r.predictionTest;
  const scenario = BLOCK5_SCENARIOS.find((s) => s.id === r.scenarioId);
  if (!test || !scenario || !test.shownProbabilities?.length) return null;
  const rules = [...test.shownProbabilities]
    .sort((a, b) => a.rank - b.rank)
    .map((p) => ({
      optionId: p.optionId,
      title: scenario.options.find((o) => o.id === p.optionId)?.title ?? p.optionId,
      chancePercent: Math.round(p.probability * 1000) / 10,
      isMpfFirst: p.optionId === test.predictedTopOptionId,
      isYourFirst: p.optionId === test.firstChoiceOptionId,
      isYourFinal: p.optionId === r.selectedOptionId,
    }));
  return {
    index: at + 1,
    rules,
    mpfNamedYourFirstRule: test.predictedTopOptionId === test.firstChoiceOptionId,
    changedAfterTheGuess: test.firstChoiceOptionId !== r.selectedOptionId,
    soundsLikeYou: typeof test.soundsLikeMe === "number" ? test.soundsLikeMe : null,
    surprised: typeof test.surprised === "boolean" ? test.surprised : null,
  };
}

/* ------------------------------------------------------------------ the MPF in every scenario */

export interface PredictionRow {
  /** 1-6, the order the participant met the scenario in. */
  index: number;
  kind: ConsistencyPoint["kind"];
  favouriteTitle: string;
  /** The MPF's chance for its favourite option, in percent (one decimal, as stored). */
  favouritePercent: number;
  finalTitle: string;
  /** The MPF's chance for the option finally chosen, in percent. */
  finalPercent: number;
  /** Percentage points between the two; 0 when the favourite was the final choice. */
  pointsBehind: number;
  /** True when the MPF's favourite IS the final choice. */
  namedFinal: boolean;
  /** Only when the first choice differs from the final one (reflection, or scenario 6's guess). */
  firstTitle: string | null;
  firstPercent: number | null;
  /** A blind guess on that menu, in percent: 1 in 6, or 1 in 4 behind the veil. */
  guessPercent: number;
  /** True only in scenario 6: the other scenarios' numbers were worked out after the choices. */
  shownWhileChoosing: boolean;
}

export interface PredictionReading {
  rows: PredictionRow[];
  /** How many of the rows had the MPF's favourite as the final choice. */
  namedFinal: number;
}

/**
 * THE MPF IN EVERY SCENARIO, READ FROM THE DATABASE'S OWN SECTION (since 28 September 2026, the
 * researcher's plan, "Q3-yes, Q4-yes"). The page passes `buildMpfPercentages(buildMpfPredictions(results))`
 * from dbShape.ts - the very section stored as `analysis.mpf_prediction_percentages` - so the card can
 * never show a number the database does not hold. This only picks the fields the card draws.
 *
 * The favourite is always the option that fits the participant's values best as they stood when the
 * scenario opened (the MPF is a softmax on that fit), so "the favourite was your choice" is the same
 * fact as "you chose your best fit". The card adds how SURE the MPF was, and says so.
 */
export function predictionReading(section: unknown): PredictionReading | null {
  if (!section || typeof section !== "object") return null;
  const raw = (section as { by_scenario?: unknown }).by_scenario;
  if (!Array.isArray(raw)) return null;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const rows: PredictionRow[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const fav = num(r.most_expected_option_chance_percent);
    const final = num(r.their_final_choice_chance_percent);
    const behind = num(r.points_behind_the_most_expected_option_at_final_choice);
    const index = num(r.order_shown);
    if (r.could_not_be_computed || fav === null || final === null || behind === null || index === null) continue;
    const role = r.decision_role;
    const changed = r.they_changed_their_choice === true;
    rows.push({
      index,
      kind: role === "recipient" ? "wish" : role === "predicted" ? "veil" : "decision",
      favouriteTitle: String(r.most_expected_option_title ?? r.most_expected_option_id ?? ""),
      favouritePercent: fav,
      finalTitle: String(r.their_final_choice_title ?? r.their_final_choice_option_id ?? ""),
      finalPercent: final,
      pointsBehind: behind,
      namedFinal: r.mpf_named_their_final_choice === true,
      firstTitle: changed ? String(r.their_first_choice_title ?? r.their_first_choice_option_id ?? "") : null,
      firstPercent: changed ? num(r.their_first_choice_chance_percent) : null,
      guessPercent: num(r.chance_if_guessing_percent) ?? 0,
      shownWhileChoosing: r.was_shown_to_the_participant === true,
    });
  }
  if (rows.length === 0) return null;
  return { rows, namedFinal: rows.filter((r) => r.namedFinal).length };
}

/* ------------------------------------------------------------------ reconsidering, all six */

export interface ReconsiderBar {
  index: number;
  kind: ConsistencyPoint["kind"];
  /** Changes of mind in the scenario; for scenario 6, before the guess appeared. */
  before: number;
  /** Scenario 6 only: changes of mind after the guess appeared (0 elsewhere). */
  afterGuess: number;
}

export function reconsiderBars(results: Block5ScenarioResult[]): ReconsiderBar[] {
  return results.map((r, i) => {
    if (isPredictionTest(r) && r.predictionTest) {
      return { index: i + 1, kind: "veil" as const, before: r.predictionTest.switchesBeforeGuess ?? 0,
        afterGuess: r.predictionTest.switchesAfterGuess ?? 0 };
    }
    return { index: i + 1, kind: kindOf(r), before: r.telemetry?.numberOfSwitches ?? 0, afterGuess: 0 };
  });
}

/* ------------------------------------------------------------------ Block 4 */

type Decision = "proceed" | "do_not_proceed" | null | undefined;

export interface Block4Step {
  moment: string;
  decision: "Approve the policy" | "Do not approve the policy" | null;
  confidence: number | null;
}

export interface Block4Reading {
  steps: Block4Step[];
  /** kept (same answer all three times), changed (ended elsewhere), or back (changed, then returned). */
  pattern: "kept" | "changed" | "back";
  voiceThatMattered: string | null;
  sentence: string;
}

const decisionWords = (d: Decision): Block4Step["decision"] =>
  d === "proceed" ? "Approve the policy" : d === "do_not_proceed" ? "Do not approve the policy" : null;

/** Block 4 as the participant answered it: one question ("Would you approve the policy?") asked before
 *  hearing anyone, after the first voice, and after the second, with confidence (1-5) first and last. */
export function block4Reading(payload: unknown): Block4Reading | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as {
    decisions?: { initialDecision?: Decision; midDecision?: Decision; finalDecision?: Decision;
      confidence?: number; initialConfidence?: number };
    vignettesShown?: { title?: string }[];
    mostInfluentialPerspective?: string | null;
  };
  const d = p.decisions;
  if (!d || (!d.initialDecision && !d.finalDecision)) return null;
  const voices = p.vignettesShown ?? [];
  const steps: Block4Step[] = [
    { moment: "Before hearing anyone", decision: decisionWords(d.initialDecision),
      confidence: typeof d.initialConfidence === "number" ? d.initialConfidence : null },
    { moment: voices[0]?.title ? `After hearing “${voices[0].title}”` : "After the first voice",
      decision: decisionWords(d.midDecision), confidence: null },
    { moment: voices[1]?.title ? `After hearing “${voices[1].title}”` : "After the second voice",
      decision: decisionWords(d.finalDecision),
      confidence: typeof d.confidence === "number" ? d.confidence : null },
  ];
  const [a, b, c] = [d.initialDecision, d.midDecision, d.finalDecision];
  const pattern: Block4Reading["pattern"] = a === c ? (a === b || !b ? "kept" : "back") : "changed";
  const sentence = pattern === "kept"
    ? "You gave the same answer all three times: hearing the two voices did not change it."
    : pattern === "back"
      ? "You changed your answer after the first voice and came back to where you started after the second."
      : "Hearing the voices changed your answer: you ended somewhere other than where you started.";
  return {
    steps,
    pattern,
    voiceThatMattered: p.mostInfluentialPerspective ? String(p.mostInfluentialPerspective) : null,
    sentence,
  };
}
