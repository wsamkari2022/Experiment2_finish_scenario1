/**
 * block5Planner.ts — The trade-off planner that ORDERS the option cards.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THIS FILE DOES ONE THING: it decides what ORDER the six option cards appear in.
 *
 * It does NOT compute alignment. `policyAlignmentScore` / `rankLabel` / `labelOptions`
 * in block5CVR.ts are untouched and keep producing the four-level tier that renders on
 * every card. Two computations, two code paths, two separate fields in the log.
 *
 * That separation is the entire point. The consistency analysis has to be able to ask:
 * "the participant chose the option the planner ranked 4th, and that option was labeled
 * strongly aligned." Both halves of that sentence must survive into the results.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * WHY THE ORDER IS CHANGING AT ALL
 * --------------------------------
 * Today the cards are displayed in alignment order — best fit on top (see
 * Block5PublicEmergencySimulation.tsx, where labelOptions() output is rendered directly).
 * That makes "chose rank 1" and "chose the aligned option" the SAME EVENT, and neither can then
 * be interpreted: picking the top card might mean "it matched my values" or might mean "it was
 * first", and nothing in the data separates those. Measured on the current option payoffs, the
 * planner's #1 and the alignment #1 coincide in 54–79% of profiles. The design gate is under 50%.
 *
 * WHAT THE PLANNER DOES INSTEAD
 * -----------------------------
 * It never scores an option on its own. It compares TWO options and asks one question: for this
 * pair, do I honor the participant's top-priority value, or set it aside because the gap on it is
 * tiny while the gap on their second-priority value is large?
 *
 *   Rank-1 value = gain, rank-2 = harm, and two options:
 *     P: gain 1.00, harm 0.20
 *     Q: gain 0.92, harm 0.95
 *   P is better on gain — by 0.08. Q is better on harm by 0.75, nearly ten times as much.
 *   The tree drops gain for this pair and Q ranks above P.
 *
 * P is the best option on the participant's own rank-1 value and still does not rank first. That
 * is the behavior the whole design depends on, and a plain sort by the top value can never
 * produce it.
 *
 * NO CONSTANTS. THIS FILE HAS NO TUNING PARAMETERS.
 * -------------------------------------------------
 * Every threshold the tree uses — red lines, exchange rates, tolerance bands — is derived from the
 * participant's own Blocks 1–3 ladder answers in block5Thresholds.ts. There is no constants block
 * here because there is nothing to put in it. The only bare numbers below are structural: 0, 1,
 * and TIE_EPSILON (a floating-point guard, not a preference).
 *
 * PERFORMANCE IS DELIBERATELY ABSENT FROM THE ORDERING
 * ----------------------------------------------------
 * Nothing in Blocks 1–4 asks whether speed matters more than reversibility, so there is no
 * derivable weighting for the five performance metrics. Rather than default them to equal and
 * present an invented weighting as if it were the participant's, performance plays NO part in the
 * win count and NO part in tie-breaking. The metrics still appear on the card as ranked chips.
 *
 * This is a better design than weighting them would have been. The study asks whether participants
 * trade moral alignment against practical performance. If the planner made that trade for them,
 * the question would be unanswerable.
 *
 * See docs/BLOCK5_PLANNER_ORDERING_PLAN.md §4b and §6.
 */

import { POLICY_DIM_KEYS, METRIC_KEYS, METRIC_LABELS } from "./block5Types";
import type {
  Block5MetricKey,
  Block5PolicyDimKey,
  Block5Scenario,
  Block5ScenarioOption,
} from "./block5Types";
import type { DecisionProfile, ValueThreshold } from "./block5Thresholds";

/**
 * Below this, two normalized values are treated as the same number.
 *
 * NOT a preference and NOT tunable: min–max normalization over six integer payoffs produces exact
 * ties and near-ties from floating-point division, and a lexicographic comparison must not let
 * 1e-16 of arithmetic noise decide an ordering. It is a float guard.
 */
const TIE_EPSILON = 1e-9;

/* ------------------------------------------------------------------------- *
 * Bins
 * ------------------------------------------------------------------------- */

/**
 * Which of the three display groups an option falls into.
 *
 *   clear   — inside every limit this participant expressed.
 *   costed  — falls to the bottom of the range on a value they PRICED but did not refuse.
 *   blocked — falls to the bottom of the range on a value they REFUSED outright.
 *
 * Blocked options are a DISPLAY TREATMENT, never an interaction lock. They remain fully
 * selectable. The study exists to measure whether people cross their own stated lines, and that is
 * unmeasurable if the interface will not let them.
 */
export type PlannerBin = "clear" | "costed" | "blocked";

const BIN_ORDER: Record<PlannerBin, number> = { clear: 0, costed: 1, blocked: 2 };

/** Which value put an option into its bin, and by how much it fell short (normalized units). */
export interface BinBreach {
  key: Block5PolicyDimKey;
  /** how far below the participant's floor the option sits, in normalized scenario units. */
  amount: number;
  /** true when this came from an outright refusal rather than a priced threshold. */
  hard: boolean;
}

/* ------------------------------------------------------------------------- *
 * Result shape
 * ------------------------------------------------------------------------- */

/** One performance metric's standing within its scenario, for the card chips. */
export interface PerfChip {
  key: Block5MetricKey;
  label: string;
  /** 1 = best of the options in this scenario on this metric. */
  rank: number;
  total: number;
}

/** Everything the planner concluded about one option. */
export interface PlannedOption {
  id: string;
  rank: number;
  bin: PlannerBin;
  wins: number;
  comparisons: number;
  /** the value that decided the most pairwise comparisons this option took part in. */
  decidedOn: Block5PolicyDimKey | null;
  /**
   * The options this one beat, head to head. `wins` is its length; both are kept because the card
   * says "Beat 4 of the other 5" and the reason line names the specific option it edged out.
   *
   * This also makes the comparison graph inspectable from outside, which matters: the relation is
   * NOT transitive, and a cycle can only be detected by looking at the whole graph. It cannot be
   * recovered by re-running the planner on a pair, because normalization is within-set and a pair
   * rescales to 0 and 1.
   */
  beatIds: string[];
  /** every floor this option falls below, worst first. Empty for a clear option. */
  breaches: BinBreach[];
  /** pairs where this option won BECAUSE the rank-1 value was set aside (the IGNORE_A leaf). */
  ignoredTopValueAgainst: string[];
  /** two strongest and one weakest performance metric, ranked within the scenario. */
  perfChips: PerfChip[];
  /** normalized policy values, exposed so the UI can render deltas without renormalizing. */
  normalized: Record<Block5PolicyDimKey, number>;
}

export interface PlannerResult {
  /** option ids in display order: clear, then costed, then blocked; by win count within each. */
  orderedIds: string[];
  byId: Record<string, PlannedOption>;
  /** the highest-ranked CLEAR option — the reference every gain/lose line is written against. */
  cleanReferenceId: string | null;
  /** the participant's value ranking used for this run, rank 1 first. */
  order: Block5PolicyDimKey[];
}

/* ------------------------------------------------------------------------- *
 * Normalization
 * ------------------------------------------------------------------------- */

/**
 * Min–max normalize one field across the options of ONE scenario.
 *
 * WITHIN-SCENARIO, deliberately: a fingerprint score is authored as "how well this option serves
 * this value, among the options available HERE" (see the scale note in block5Types.ts). Comparing
 * a raw 70 in one scenario against a raw 70 in another would be comparing two different rulers.
 *
 * NO INVERSION ANYWHERE. All four policy fingerprints in this codebase are already oriented so
 * that HIGHER IS BETTER — `groupSizeSensitivity: 93` means the option does WELL on "how many are
 * harmed", not that it harms 93 people. Inverting them would make the planner rank options in the
 * opposite order to the alignment score that renders beside it on the same card.
 *
 * A field where every option scores the same collapses to 0.5 for all of them: it carries no
 * information in this scenario, so it must not decide anything.
 */
function normaliseField(values: number[]): number[] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => 0.5);
  return values.map((v) => (v - lo) / (hi - lo));
}

interface Normalized {
  policy: Record<string, Record<Block5PolicyDimKey, number>>;
  metricRank: Record<string, Record<Block5MetricKey, number>>;
}

/**
 * Min-max normalizes every option's four values WITHIN this scenario, to 0-1.
 *
 * The tree compares gaps against the participant's own tolerance and exchange rate, and both of
 * those are expressed as fractions of a ladder. Comparing them against raw 0-100 authoring scores
 * would mean a scenario whose options happen to be tightly clustered produced systematically
 * smaller gaps, and therefore a different card order, for the very same person.
 */
function normaliseScenario(options: Block5ScenarioOption[]): Normalized {
  const policy: Normalized["policy"] = {};
  const metricRank: Normalized["metricRank"] = {};
  for (const o of options) {
    policy[o.id] = {} as Record<Block5PolicyDimKey, number>;
    metricRank[o.id] = {} as Record<Block5MetricKey, number>;
  }

  for (const key of POLICY_DIM_KEYS) {
    const n = normaliseField(options.map((o) => o.fingerprint[key]));
    options.forEach((o, i) => { policy[o.id][key] = n[i]; });
  }

  // Metrics are RANKED, not normalized: they are shown as "Fastest / Least reversible", never
  // scored, so their standing is ordinal and a distance would imply a precision the chips do not claim.
  for (const key of METRIC_KEYS) {
    const sorted = [...options].sort((a, b) => (b.metrics[key] - a.metrics[key]) || a.id.localeCompare(b.id));
    sorted.forEach((o, i) => { metricRank[o.id][key] = i + 1; });
  }

  return { policy, metricRank };
}

/* ------------------------------------------------------------------------- *
 * Step 1 — gate into bins
 * ------------------------------------------------------------------------- */

/**
 * An option breaches a value's floor when it sits within the participant's own indiscrimination
 * band of the bottom of that value's range in this scenario.
 *
 * WHY THE BAND IS `tolerance` AND NOT A CHOSEN NUMBER: tolerance is the width of the ladder
 * interval the participant's own threshold sat in — the smallest difference they demonstrably
 * noticed. An option sitting inside that band of the floor is, by their own demonstrated
 * resolution, indistinguishable from the worst this scenario offers on that value.
 *
 * WHY THE FLOOR IS THE SCENARIO MINIMUM AND NOT THEIR 0–100 SCORE: mapping the sensitivity score
 * onto the option scale was tried first and blocks 93–100% of options, because a fingerprint is
 * "how well this option serves the value" and five of six options necessarily sit below the one
 * champion. A gate that fires on everything is not a gate. See the plan, §2b.
 */
function breachesOf(
  norm: Record<Block5PolicyDimKey, number>,
  thresholds: Record<Block5PolicyDimKey, ValueThreshold>,
  order: Block5PolicyDimKey[],
): BinBreach[] {
  const out: BinBreach[] = [];
  for (const key of POLICY_DIM_KEYS) {
    const t = thresholds[key];
    const band = t.tolerance;
    if (norm[key] >= band) continue;

    if (t.hasRedLine) {
      // They refused this outright, at every rung. Hard breach, whatever its rank.
      out.push({ key, amount: band - norm[key], hard: true });
    } else if (order.indexOf(key) === 0) {
      // Their single most important value, priced rather than refused. It costs them something;
      // it does not cross a line they drew.
      //
      // RESTRICTED TO RANK 1 DELIBERATELY. Bin membership outranks the win count in the display
      // sort, so a soft breach demotes an option below every clear one — a very strong action.
      // Applying it to the top TWO values was tried first and demoted roughly a third of all
      // cards, which left the trade-off tree deciding the order of the leftovers rather than
      // deciding the order. One value, the one they ranked first, is as far as a soft floor can
      // reasonably reach.
      out.push({ key, amount: band - norm[key], hard: false });
    }
  }
  return out.sort((a, b) => (Number(b.hard) - Number(a.hard)) || (b.amount - a.amount));
}

/**
 * Sorts one option into Clear, Costed or Blocked.
 *
 * The bin affects PRESENTATION ONLY - grouping and a neutral label. Every option in every bin
 * stays selectable, including Blocked, because a card the participant cannot choose cannot record
 * that they were willing to cross their own stated limit, which is one of the things worth
 * observing.
 */
function binOf(breaches: BinBreach[]): PlannerBin {
  if (breaches.some((b) => b.hard)) return "blocked";
  if (breaches.length > 0) return "costed";
  return "clear";
}

/* ------------------------------------------------------------------------- *
 * Step 2 — the pairwise trade-off tree
 * ------------------------------------------------------------------------- */

interface PairOutcome {
  /** +1 when X wins, -1 when Y wins, 0 when the pair is indistinguishable on all four values. */
  winner: number;
  /** the value that actually decided it, or null when nothing separated them. */
  decidedOn: Block5PolicyDimKey | null;
  /** true when the rank-1 value was set aside to reach the decision (the IGNORE_A leaf). */
  ignoredTop: boolean;
}

/**
 * Compare two options along a value ordering, first value that separates them wins.
 * Returns the deciding value so the card can say WHY it ranked where it did.
 */
function lexical(
  x: Record<Block5PolicyDimKey, number>,
  y: Record<Block5PolicyDimKey, number>,
  order: Block5PolicyDimKey[],
): { winner: number; decidedOn: Block5PolicyDimKey | null } {
  for (const key of order) {
    const d = x[key] - y[key];
    if (Math.abs(d) > TIE_EPSILON) return { winner: d > 0 ? 1 : -1, decidedOn: key };
  }
  return { winner: 0, decidedOn: null };
}

/**
 * THE TREE. Three branches, exactly as the design requires.
 *
 *   node 1 — is the best either option manages on the top value already below the participant's
 *            floor? Then the top value cannot discriminate usefully here and must still decide:
 *            both options are bad on it, and choosing between two bad options on the thing they
 *            care about most is precisely when their ranking should govern.
 *   node 2 — is the gap on the top value REAL (wider than what they demonstrably discriminate)?
 *            Then honor the ranking.
 *   node 3 — the gap on the top value is inside their own noise floor. Is the gap on their SECOND
 *            value larger than their stated exchange rate makes it worth? Then set the top value
 *            aside for this pair only.
 *
 * `exchange` here is the participant's own elicited premium (Block 3's same-question-six-times
 * design), so node 3 asks a question they have already answered in a different currency.
 */
function comparePair(
  x: Record<Block5PolicyDimKey, number>,
  y: Record<Block5PolicyDimKey, number>,
  order: Block5PolicyDimKey[],
  thresholds: Record<Block5PolicyDimKey, ValueThreshold>,
): PairOutcome {
  const top = order[0];
  const second = order[1];
  const tTop = thresholds[top];

  const bestTop = Math.max(x[top], y[top]);
  const diffTop = Math.abs(x[top] - y[top]);
  const diffSecond = second ? Math.abs(x[second] - y[second]) : 0;

  let useOrder = order;
  let ignoredTop = false;

  if (bestTop < tTop.tolerance) {
    useOrder = order;                                   // node 1 -> honor the ranking
  } else if (diffTop >= tTop.tolerance) {
    useOrder = order;                                   // node 2 -> the gap is real
  } else if (second && diffSecond > tTop.exchange * diffTop) {
    useOrder = order.slice(1);                          // node 3 -> set the top value aside
    ignoredTop = true;
  }

  const { winner, decidedOn } = lexical(x, y, useOrder);
  return { winner, decidedOn, ignoredTop: ignoredTop && winner !== 0 };
}

/* ------------------------------------------------------------------------- *
 * Step 3 — win counting, then display order
 * ------------------------------------------------------------------------- */

/**
 * plannerRank — pure, DOM-free, deterministic. Same inputs, byte-identical output, every time.
 *
 * WHY WINS ARE COUNTED RATHER THAN SORTED: different pairs take different branches of the tree, so
 * the comparison is NOT transitive — X can beat Y, Y beat Z, and Z beat X. Handing that to
 * Array.sort() gives an order that depends on the comparison sequence, which is both wrong and
 * unreproducible. Counting how many of its five opponents each option beats is well-defined
 * whatever the graph looks like.
 *
 * TIE-BREAKS, in order: raw lexicographic on the participant's ranking with no tree, then the
 * option's original index in the scenario (stable, and part of the data, not a preference).
 * Performance is NOT a tie-break — see the file header.
 */
export function plannerRank(scenario: Block5Scenario, profile: DecisionProfile): PlannerResult {
  const options = scenario.options;
  const { policy, metricRank } = normaliseScenario(options);
  const { order, thresholds } = profile;

  const wins: Record<string, number> = {};
  const beatIds: Record<string, string[]> = {};
  const comparisons: Record<string, number> = {};
  const decidedTally: Record<string, Partial<Record<Block5PolicyDimKey, number>>> = {};
  const ignoredAgainst: Record<string, string[]> = {};
  for (const o of options) {
    wins[o.id] = 0;
    beatIds[o.id] = [];
    comparisons[o.id] = 0;
    decidedTally[o.id] = {};
    ignoredAgainst[o.id] = [];
  }

  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const X = options[i];
      const Y = options[j];
      const r = comparePair(policy[X.id], policy[Y.id], order, thresholds);
      comparisons[X.id]++;
      comparisons[Y.id]++;
      if (r.winner > 0) {
        wins[X.id]++;
        beatIds[X.id].push(Y.id);
        if (r.ignoredTop) ignoredAgainst[X.id].push(Y.id);
      } else if (r.winner < 0) {
        wins[Y.id]++;
        beatIds[Y.id].push(X.id);
        if (r.ignoredTop) ignoredAgainst[Y.id].push(X.id);
      }
      if (r.decidedOn) {
        for (const id of [X.id, Y.id]) {
          decidedTally[id][r.decidedOn] = (decidedTally[id][r.decidedOn] ?? 0) + 1;
        }
      }
    }
  }

  const breaches: Record<string, BinBreach[]> = {};
  const bins: Record<string, PlannerBin> = {};
  for (const o of options) {
    breaches[o.id] = breachesOf(policy[o.id], thresholds, order);
    bins[o.id] = binOf(breaches[o.id]);
  }

  const indexOf = new Map(options.map((o, i) => [o.id, i]));
  const sorted = [...options].sort((a, b) => {
    const binDiff = BIN_ORDER[bins[a.id]] - BIN_ORDER[bins[b.id]];
    if (binDiff !== 0) return binDiff;
    const winDiff = wins[b.id] - wins[a.id];
    if (winDiff !== 0) return winDiff;
    const lex = lexical(policy[a.id], policy[b.id], order).winner;
    if (lex !== 0) return -lex;
    return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
  });

  const byId: Record<string, PlannedOption> = {};
  sorted.forEach((o, i) => {
    const tally = decidedTally[o.id];
    const decidedOn = (Object.keys(tally) as Block5PolicyDimKey[])
      .sort((a, b) => (tally[b] ?? 0) - (tally[a] ?? 0) || order.indexOf(a) - order.indexOf(b))[0] ?? null;
    byId[o.id] = {
      id: o.id,
      rank: i + 1,
      bin: bins[o.id],
      wins: wins[o.id],
      beatIds: beatIds[o.id],
      comparisons: comparisons[o.id],
      decidedOn,
      breaches: breaches[o.id],
      ignoredTopValueAgainst: ignoredAgainst[o.id],
      perfChips: buildPerfChips(metricRank[o.id], options.length),
      normalized: policy[o.id],
    };
  });

  const cleanReferenceId = sorted.find((o) => bins[o.id] === "clear")?.id ?? null;

  return { orderedIds: sorted.map((o) => o.id), byId, cleanReferenceId, order };
}

/**
 * The two metrics this option leads on and the one it trails on, e.g.
 * "Fastest · Lowest resource use · Least reversible".
 *
 * Ordinal only. These are shown, never scored — nothing in Blocks 1–4 says how much any of them is
 * worth to this participant, so the planner reports standing and lets them weigh it.
 */
function buildPerfChips(ranks: Record<Block5MetricKey, number>, total: number): PerfChip[] {
  const all = METRIC_KEYS.map((key) => ({ key, label: METRIC_LABELS[key], rank: ranks[key], total }));
  const byRank = [...all].sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));
  const best = byRank.slice(0, 2);
  const worst = byRank[byRank.length - 1];
  return [...best, worst];
}
