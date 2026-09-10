/**
 * block5Position.ts — Position Effect: does where you stand change what you choose?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE QUESTION
 *
 * Block 5 already asks WHAT a participant chooses. It does not ask whether they are the SAME
 * PERSON when the cost lands somewhere else. The five scenarios are built as a ladder of who
 * carries that cost:
 *
 *   Scenario 1  — only me                (chemical release, alone)
 *   Scenario 2  — me and my people       (wildfire, household of four)
 *   Scenario 3  — other people           (cancer; the participant is not at risk)
 *   Scenario 4  — at work, under rules   (care schedule; colleagues carry it, the participant decides)
 *   Scenario 5  — done to me, no say     (the same cut, decided by someone else)
 *
 * SCENARIO 5 IS INCLUDED HERE AND EXCLUDED FROM VCI, CVR, APA AND STABILITY. Those four ask what a
 * participant DID and hold them answerable for it, and a wish is not a decision. This measure is a
 * DISTANCE — |frozen profile − the option| — and that arithmetic is identical whether the option
 * was chosen or wished for. It is labeled as a wish everywhere it is shown.
 *
 * The driving example is the author's own: "Am I the same driver alone as I am with my children
 * in the car?"
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IS COMPUTED, AND WHY EACH PIECE EXISTS
 *
 * 1. DISTANCE (`profileDistance`) — the readable number, one per scenario.
 *
 *        D = (1/4) × Σ | pre_k − chosen_k |     over the four policy values
 *
 *    Mean absolute difference rather than Euclidean, for two reasons: it reads as a sentence
 *    ("on average each of your four values sat 24 points from what you chose"), and it does not
 *    let one large gap drown three small ones. For a within-person comparison an even-handed
 *    summary is what is wanted, not a worst-case one.
 *
 * 2. DEPARTURE (`departureIndex`) — the same distance as a share of the room that scenario
 *    actually offered, over its own six options. Range 0-100.
 *
 *    This exists because the five menus are not identical. They were measured and they sit within
 *    about 2 points of each other, against roughly 20 points of room inside each scenario — so
 *    the confound is small, and the raw distance is already broadly comparable. The normalized
 *    form costs nothing, removes the remaining 1-2 points, and means the position claim survives
 *    the question being asked. Charts show D; the position comparison uses E.
 *
 * 3. HEADLINE (`positionEffect`) — highest position minus lowest, across whichever positions the
 *    deck actually carries; scenarios sharing a position are averaged into it. On the shipped deck
 *    that is five positions of one scenario each. 0 = the same person everywhere.
 *
 * 4. DIRECTION (`valueDrift`) — the SIGNED mean movement per value, per position. This is what
 *    turns "they moved 51" into "when other people carry the cost, this person protects the
 *    vulnerable 30 points LESS than their own profile says". The sign is the finding; the
 *    magnitude alone is not.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT READS THE FROZEN PROFILE. NEVER THE CURRENT ONE.
 *
 * `Block5Results.originalProfile` is the pre-Block-5 snapshot and is never mutated. Measuring
 * against the profile that CVR and APA have been moving would compare the participant with a
 * ruler that moved while they did, and the number would mean nothing. This is the same reason
 * the planner orders cards from the frozen profile — see block5Planner.ts.
 *
 * WHY THIS IS A DISTANCE AND ALIGNMENT IS NOT
 *
 * `policyAlignmentScore` is deliberately ONE-SIDED: an option is penalized only when it delivers
 * LESS than the participant demands, because nobody should be marked down for an option that
 * protects the vulnerable more than they asked. That is correct for JUDGING AN OPTION and wrong
 * here. If someone whose profile reads "protect the vulnerable = 30" chooses an option reading
 * 95, they HAVE moved away from who they were, and that movement is the finding. So this measure
 * is SYMMETRIC. Alignment is untouched; the two answer different questions.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE CONFOUND, AND THE CHECK THAT SHIPS WITH IT
 *
 * Position is confounded with sequence: "for others" is always last, and always follows two
 * scenarios of accumulated drift. A participant who drifts because they are tired, practiced or
 * warmed up will look position-sensitive.
 *
 * `driftCheck` is the partial control and it is not optional. When two or more scenarios share a
 * position while sitting at different points in the sequence, a trend across them measures drift
 * within a CONSTANT position. A large value is a warning that the effect is time rather than
 * position. Any position claim reported without it is overclaiming.
 *
 * ON THE CURRENT DECK THE CONTROL IS UNAVAILABLE. Each of the five positions appears in exactly one
 * scenario, so no position is held constant across the sequence and `driftCheck` returns null.
 * This is not a bug and not a
 * rounding-down of the claim — it is the claim disappearing. Measured on synthetic participants,
 * someone who genuinely responds to position and someone answering at random BOTH score a Position
 * Effect of 100, and only the drift check separated them (0 vs 100). Until a position repeats,
 * Position Effect is a description of what a participant did, not evidence that position caused
 * it, and both the visualization caption and tools/simulate_position.cjs say so out loud.
 *
 * Everything here is computed from records Block 5 already stores — `originalProfile`,
 * `scenarioId` and `selectedOptionId` — so it also applies to data already collected. Nothing
 * about what Block 5 asks or records changes.
 */

import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { capturedOf, overallStanding } from "./block5Performance";
import { METRIC_KEYS, POLICY_DIM_KEYS, POLICY_DIM_SHORT } from "./block5Types";
import type {
  Block5MetricKey,
  Block5PolicyDimKey,
  Block5Scenario,
  Block5ScenarioOption,
  Block5ScenarioResult,
  Block5UserProfile,
  StakePosition,
} from "./block5Types";

/**
 * The rungs of the ladder. ALIASED to `StakePosition` rather than re-listed.
 *
 * These two were separate hand-written unions saying the same thing, which is the arrangement in
 * which they drift: adding a position to `StakePosition` left this one short, and every
 * `Record<PositionKey, …>` below went on compiling while silently having no entry for the new
 * position. Aliasing makes the compiler enforce what the comment used to ask for.
 */
export type PositionKey = StakePosition;

export const POSITION_LABEL: Record<PositionKey, string> = {
  self: "Only me",
  self_and_group: "Me and my people",
  others: "Other people",
  under_authority: "My employer's rules",
  receiving_end: "Done to me",
};

/**
 * Short forms for chart row labels. HBarChart reserves a fixed 116-unit label column, and
 * "S2 · Me and my people" overruns it and is drawn over by the bar. The color band and the
 * legend already carry the position, so the row label only has to disambiguate.
 */
export const POSITION_SHORT: Record<PositionKey, string> = {
  self: "me",
  self_and_group: "my people",
  others: "others",
  under_authority: "at work",
  receiving_end: "done to me",
};

/** Reads a profile's four policy values as a plain record. */
function profileScores(profile: Block5UserProfile): Record<Block5PolicyDimKey, number> {
  const out = {} as Record<Block5PolicyDimKey, number>;
  for (const k of POLICY_DIM_KEYS) {
    out[k] = profile.dimensions.find((d) => d.key === k)?.score ?? 0;
  }
  return out;
}

/**
 * Mean absolute difference between a profile and an option, over the four policy values. 0-100.
 *
 * Symmetric on purpose — see the header. Moving further UP a value than you asked for is still
 * moving.
 */
export function profileDistance(
  profile: Block5UserProfile,
  option: Block5ScenarioOption,
): number {
  const me = profileScores(profile);
  const total = POLICY_DIM_KEYS.reduce(
    (a, k) => a + Math.abs((me[k] ?? 0) - (option.fingerprint[k] ?? 0)),
    0,
  );
  return total / POLICY_DIM_KEYS.length;
}

/** What one scenario's menu made available: the nearest and farthest options from this profile. */
function menuDistanceRange(profile: Block5UserProfile, scenario: Block5Scenario) {
  const all = scenario.options.map((o) => profileDistance(profile, o));
  const nearest = Math.min(...all);
  const farthest = Math.max(...all);
  return { nearest, farthest, span: farthest - nearest };
}

/** One scenario's contribution to the position picture. */
export interface PositionRow {
  scenarioId: string;
  /** 1-5, the order the participant met it in. Sequence, for the drift check. */
  index: number;
  title: string;
  position: PositionKey;
  positionLabel: string;
  /** D — mean absolute distance from the frozen profile, 0-100. The readable number. */
  distance: number;
  /** E — that distance as a share of the room this scenario offered, 0-100. */
  departure: number;
  /** nearest / farthest distance the six options here allowed, for auditing the number. */
  nearest: number;
  farthest: number;
  /** signed movement per value: chosen − profile. Positive = the choice sits ABOVE your profile. */
  valueDrift: Record<Block5PolicyDimKey, number>;
}

/**
 * Per-scenario distance from the frozen profile.
 *
 * Results with no matching scenario or option are skipped rather than scored as zero — a missing
 * record is not the same event as "chose an option identical to their profile", and scoring it as
 * zero would quietly pull a participant toward looking consistent.
 */
export function positionRows(
  results: Block5ScenarioResult[],
  originalProfile: Block5UserProfile,
): PositionRow[] {
  const me = profileScores(originalProfile);
  const rows: PositionRow[] = [];

  results.forEach((r, i) => {
    const scenario = BLOCK5_SCENARIOS.find((s) => s.id === r.scenarioId);
    if (!scenario) return;
    const option = scenario.options.find((o) => o.id === r.selectedOptionId);
    if (!option) return;

    const distance = profileDistance(originalProfile, option);
    const { nearest, farthest, span } = menuDistanceRange(originalProfile, scenario);
    const drift = {} as Record<Block5PolicyDimKey, number>;
    for (const k of POLICY_DIM_KEYS) {
      drift[k] = (option.fingerprint[k] ?? 0) - (me[k] ?? 0);
    }

    const position = (scenario.stakePosition ?? "others") as PositionKey;
    rows.push({
      scenarioId: scenario.id,
      index: i + 1,
      title: scenario.title,
      position,
      positionLabel: POSITION_LABEL[position],
      distance: Math.round(distance * 10) / 10,
      // A menu with no span cannot discriminate, so 50 is the honest answer rather than a
      // division by zero. The authoring gates make this unreachable in practice.
      departure: span <= 0 ? 50 : Math.round(((distance - nearest) / span) * 100),
      nearest: Math.round(nearest * 10) / 10,
      farthest: Math.round(farthest * 10) / 10,
      valueDrift: drift,
    });
  });

  return rows;
}

/** One entry per position present in the deck, each averaged over the scenarios that carried it. */
export interface PositionSummary {
  position: PositionKey;
  label: string;
  /** mean D across the scenarios at this position */
  distance: number;
  /** mean E across the scenarios at this position — what the headline compares */
  departure: number;
  scenarioCount: number;
  /** mean signed movement per value at this position */
  valueDrift: Record<Block5PolicyDimKey, number>;
}

/*
 * Presentation order — the order the participant meets them. The workplace pair always sits last
 * and adjacent, in this order: DECIDE first, then WISH. That ordering is a deliberate methodological
 * choice, not a layout accident. Having already committed, a participant is pulled toward repeating
 * themselves in the wish, so any gap between the two is a LOWER BOUND on the real one. A gap found
 * against that pull is evidence; a gap found the other way round would be much harder to argue.
 */
const POSITION_ORDER: PositionKey[] = [
  "self", "self_and_group", "others", "under_authority", "receiving_end",
];

/**
 * Collapses the per-scenario rows into one entry per position, averaging within each.
 *
 * Positions with no scenarios are omitted rather than reported as zero: a position the
 * participant never reached has no distance, and printing 0 would read as "they did not move".
 */
export function positionSummaries(rows: PositionRow[]): PositionSummary[] {
  const out: PositionSummary[] = [];
  for (const position of POSITION_ORDER) {
    const mine = rows.filter((r) => r.position === position);
    if (mine.length === 0) continue;
    const mean = (f: (r: PositionRow) => number) =>
      mine.reduce((a, r) => a + f(r), 0) / mine.length;
    const drift = {} as Record<Block5PolicyDimKey, number>;
    for (const k of POLICY_DIM_KEYS) {
      drift[k] = mean((r) => r.valueDrift[k] ?? 0);
    }
    out.push({
      position,
      label: POSITION_LABEL[position],
      distance: Math.round(mean((r) => r.distance) * 10) / 10,
      departure: Math.round(mean((r) => r.departure)),
      scenarioCount: mine.length,
      valueDrift: drift,
    });
  }
  return out;
}

/**
 * The headline: highest position minus lowest, on the menu-normalized departure. 0-100.
 *
 * Needs at least two positions to mean anything — one position has nothing to compare against,
 * and returning 0 there would say "the same person everywhere" on the strength of no evidence.
 */
export function positionEffect(summaries: PositionSummary[]): number | null {
  if (summaries.length < 2) return null;
  const v = summaries.map((s) => s.departure);
  return Math.max(...v) - Math.min(...v);
}

/**
 * THE CONTROL, not an extra. How much movement happens ACROSS scenarios that SHARE a position but
 * sit at different points in the sequence.
 *
 * A large value means the participant was still moving while the position was held constant — so
 * the position effect above is partly time on task, and must be reported as such. Returns null
 * when no position appears twice, because then there is nothing to hold constant.
 *
 * WHICH POSITION IS CHECKED IS DISCOVERED, NOT NAMED. This used to read `r.position === "others"`,
 * which was correct for a deck whose three repeated scenarios happened to be the "other people"
 * ones. That is a property of one deck, not of the measure: had a later deck repeated `self`
 * instead, this would have gone on returning null and the control would have been silently absent
 * while still appearing to ship. The most-repeated position is used, and ties break toward the
 * larger group, so the check runs wherever the deck actually gives it something to compare.
 */
export function driftCheck(rows: PositionRow[]): number | null {
  const byPosition = new Map<string, PositionRow[]>();
  for (const r of rows) {
    const list = byPosition.get(r.position);
    if (list) list.push(r); else byPosition.set(r.position, [r]);
  }
  let group: PositionRow[] = [];
  for (const list of byPosition.values()) if (list.length > group.length) group = list;
  if (group.length < 2) return null;
  const v = [...group].sort((a, b) => a.index - b.index).map((r) => r.departure);
  return Math.max(...v) - Math.min(...v);
}

/** Plain words for a position effect. Deliberately about the CHOICES, never about the person. */
export function positionEffectLabel(v: number): string {
  if (v >= 60) return "Your choices changed a great deal with your position";
  if (v >= 35) return "Your choices changed noticeably with your position";
  if (v >= 15) return "Your choices changed a little with your position";
  return "Your choices stayed close to the same in every position";
}

/**
 * The sentence the driving example asks for, built from the largest signed drift at the position
 * where the participant moved most.
 *
 * Returns null when nothing moved far enough to be worth a sentence — a caption that fires on
 * noise teaches the reader to ignore captions.
 */
export function positionDirectionSentence(summaries: PositionSummary[]): string | null {
  if (summaries.length < 2) return null;
  let best: { summary: PositionSummary; key: Block5PolicyDimKey; delta: number } | null = null;
  for (const s of summaries) {
    for (const k of POLICY_DIM_KEYS) {
      const d = s.valueDrift[k] ?? 0;
      if (!best || Math.abs(d) > Math.abs(best.delta)) best = { summary: s, key: k, delta: d };
    }
  }
  if (!best || Math.abs(best.delta) < 10) return null;
  const where = best.summary.position === "self"
    ? "When only you carry the cost"
    : best.summary.position === "self_and_group"
      ? "When you and your people carry the cost"
      : "When other people carry the cost";
  const dir = best.delta > 0 ? "more" : "less";
  return `${where}, you chose options that deliver ${Math.abs(Math.round(best.delta))} points ` +
    `${dir} on ${POLICY_DIM_SHORT[best.key]} than your own profile asks for.`;
}

/** Everything the chart cards need, computed once. */
export interface PositionAnalysis {
  rows: PositionRow[];
  summaries: PositionSummary[];
  effect: number | null;
  drift: number | null;
  sentence: string | null;
  /** the same rows, joined to what each chosen option achieved */
  choices: PositionChoiceRow[];
  /** both halves of the trade-off, per position, on one 0-100 scale */
  tradeoffs: PositionTradeoff[];
  /** the pattern across positions, in one sentence, or null when nothing moved enough to say */
  tradeoffSentence: string | null;
}

/**
 * Everything the three position charts need, computed once from the stored results.
 *
 * Returns empty rather than throwing when `originalProfile` is missing, which happens for data
 * collected before the frozen snapshot existed. An empty result draws no chart; a fabricated zero
 * would draw a chart claiming the participant never moved.
 */
export function analysePosition(
  results: Block5ScenarioResult[],
  originalProfile: Block5UserProfile | undefined,
): PositionAnalysis {
  if (!originalProfile) {
    return {
      rows: [], summaries: [], effect: null, drift: null, sentence: null,
      choices: [], tradeoffs: [], tradeoffSentence: null,
    };
  }
  const rows = positionRows(results, originalProfile);
  const summaries = positionSummaries(rows);
  const choices = positionChoices(results, originalProfile);
  const tradeoffs = positionTradeoffs(choices);
  return {
    rows,
    summaries,
    effect: positionEffect(summaries),
    drift: driftCheck(rows),
    sentence: positionDirectionSentence(summaries),
    choices,
    tradeoffs,
    tradeoffSentence: positionTradeoffSentence(tradeoffs),
  };
}

/** Position of a scenario id, for labeling outside this module. */
export function positionOfScenario(scenarioId: string): StakePosition | undefined {
  return BLOCK5_SCENARIOS.find((s) => s.id === scenarioId)?.stakePosition;
}

/* ================================================================================================
   PERFORMANCE, SEEN BY POSITION
   ================================================================================================

   The section above answers "how far did you move from yourself?". This one answers the question
   that has to sit beside it: "and what did that cost you in outcome quality?"

   THIS IS THE STUDY'S CENTRAL TRADE-OFF, and until now it could only be read by holding two
   charts side by side and doing the arithmetic in your head. Position Effect says how far the
   choices sat from the participant's own values. Performance says how much of what the scenario
   offered those same choices took. Neither means much alone:

     moved a long way AND took more performance  — the values gave way to outcome quality once
                                                   somebody else was paying
     moved a long way AND took less performance  — the move was not about performance at all
     barely moved, whatever the performance      — position did not reach them

   Both measures are already 0-100 and both are already normalized WITHIN a scenario, so they can
   be drawn on one axis without either being rescaled to fit the other. That is not a convenience;
   a paired chart whose two bars used different scales would invite exactly the comparison it
   cannot support.
   ================================================================================================ */

/** One scenario's choice, with what it achieved as well as how far it sat from the profile. */
export interface PositionChoiceRow extends PositionRow {
  optionTitle: string;
  /** 0-100: of the outcome quality this scenario offered, how much this choice took. */
  performance: number;
  /** 1 = the strongest-performing option on that table. */
  performanceRank: number;
  performanceTotal: number;
  /** the five outcome readings of the option actually chosen */
  metrics: Record<Block5MetricKey, number>;
}

/**
 * The per-scenario rows, joined to what each chosen option achieved.
 *
 * Rebuilt from the scenario deck rather than read off the stored result, so the two halves cannot
 * drift apart: a stored `performanceCaptured` written by an older build would silently disagree
 * with a distance computed today, and the disagreement would look like a finding.
 */
export function positionChoices(
  results: Block5ScenarioResult[],
  originalProfile: Block5UserProfile,
): PositionChoiceRow[] {
  return positionRows(results, originalProfile).map((r) => {
    const scenario = BLOCK5_SCENARIOS.find((s) => s.id === r.scenarioId)!;
    const result = results.find((x) => x.scenarioId === r.scenarioId)!;
    const option = scenario.options.find((o) => o.id === result.selectedOptionId)!;
    const standing = overallStanding(scenario, option);
    const metrics = {} as Record<Block5MetricKey, number>;
    for (const k of METRIC_KEYS) metrics[k] = option.metrics[k] ?? 0;
    return {
      ...r,
      optionTitle: option.title,
      performance: capturedOf(scenario, option),
      performanceRank: standing.rank,
      performanceTotal: standing.total,
      metrics,
    };
  });
}

/** One position, with both halves of the trade-off on the same 0-100 scale. */
export interface PositionTradeoff {
  position: PositionKey;
  label: string;
  scenarioCount: number;
  /** mean E — how far the choices sat from who they were, as a share of the room available */
  departure: number;
  /** mean captured performance — how much of the available outcome quality they took */
  performance: number;
  /** mean of the chosen options' five outcome readings, for the shape comparison */
  metrics: Record<Block5MetricKey, number>;
}

/**
 * Both halves of the trade-off per position: how far they moved, and how much performance they
 * took, each already 0-100 and each already normalized inside its own scenario.
 *
 * That shared scale is what lets the two be drawn on one axis. Two bars on different scales would
 * invite exactly the comparison they cannot support.
 */
export function positionTradeoffs(rows: PositionChoiceRow[]): PositionTradeoff[] {
  const out: PositionTradeoff[] = [];
  for (const position of POSITION_ORDER) {
    const mine = rows.filter((r) => r.position === position);
    if (mine.length === 0) continue;
    const mean = (f: (r: PositionChoiceRow) => number) =>
      mine.reduce((a, r) => a + f(r), 0) / mine.length;
    const metrics = {} as Record<Block5MetricKey, number>;
    for (const k of METRIC_KEYS) metrics[k] = Math.round(mean((r) => r.metrics[k] ?? 0));
    out.push({
      position,
      label: POSITION_LABEL[position],
      scenarioCount: mine.length,
      departure: Math.round(mean((r) => r.departure)),
      performance: Math.round(mean((r) => r.performance)),
      metrics,
    });
  }
  return out;
}

/**
 * Reads the pattern across positions in one sentence.
 *
 * Only fires when BOTH halves move by more than 15 points. Below that the two measures are
 * wandering inside their own noise, and a confident sentence about a 6-point difference teaches
 * the reader to trust captions they should not trust. Returns null instead — no sentence is
 * better than a sentence about nothing.
 */
export function positionTradeoffSentence(tradeoffs: PositionTradeoff[]): string | null {
  if (tradeoffs.length < 2) return null;
  const byDeparture = [...tradeoffs].sort((a, b) => a.departure - b.departure);
  const nearest = byDeparture[0];
  const farthest = byDeparture[byDeparture.length - 1];
  const dGap = farthest.departure - nearest.departure;
  const pGap = farthest.performance - nearest.performance;
  if (dGap < 15) {
    return "You stayed about as close to your own values whoever carried the cost.";
  }
  const where = `Where ${farthest.label.toLowerCase()} carried the cost`;
  if (Math.abs(pGap) < 15) {
    return `${where}, you moved furthest from your own values — but took about the same ` +
      `performance as everywhere else. The move was not about outcome quality.`;
  }
  return pGap > 0
    ? `${where}, you moved furthest from your own values and took ${pGap} points MORE ` +
      `performance. That is the trade this study is looking for.`
    : `${where}, you moved furthest from your own values and took ${Math.abs(pGap)} points LESS ` +
      `performance — you gave up both.`;
}
