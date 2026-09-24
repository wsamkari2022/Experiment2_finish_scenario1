/**
 * block5PlannerText.ts — turns planner state into the sentences shown on an option card.
 *
 * WHY THIS IS A SEPARATE FILE
 * ---------------------------
 * Every line below is GENERATED FROM THE PLANNER'S OWN STATE. None of it is authored per option,
 * and none of it may be. Two reasons:
 *
 *   1. If the explanation were hand-written it could disagree with the ordering, and a participant
 *      who spots that stops trusting the whole screen.
 *   2. The explanation is itself an intervention (see docs/BLOCK5_PLANNER_ORDERING_PLAN.md §10).
 *      Held constant, it is part of the environment. Written per option, it becomes a source of
 *      uncontrolled variation sitting exactly where the measurement is most sensitive.
 *
 * `block5Planner.ts` stays free of presentation; this file stays free of decisions. Neither
 * imports the other's job.
 *
 * ONE RULE ABOUT TONE. These lines report; they never approve or scold. An option that crosses a
 * limit the participant set is described, placed lower, and left fully selectable. The study
 * exists to find out whether people cross their own lines, so the interface must not make doing so
 * feel like a scolding — that would be measuring the interface's disapproval, not the person.
 */

import { METRIC_DEFS, POLICY_DIM_KEYS, POLICY_DIM_SHORT } from "./block5Types";
import type { Block5MetricKey, Block5Scenario } from "./block5Types";
import type { PlannerBin, PlannerResult, PerfChip } from "./block5Planner";
import type { DecisionProfile } from "./block5Thresholds";

/* ------------------------------------------------------------------ *
 * Magnitude words
 * ------------------------------------------------------------------ */

/**
 * A normalized difference turned into a word.
 *
 * The participant is never shown the normalized number itself. 0.31 is not a quantity anybody has
 * an intuition for, and printing it would imply a precision the min-max scale does not carry — it
 * is a position within THIS scenario's spread, not a measurement of anything in the world.
 * "Clearly better" says what the number actually supports.
 */
function magnitude(delta: number): string {
  const d = Math.abs(delta);
  if (d < 0.12) return "slightly";
  if (d < 0.40) return "clearly";
  return "far";
}

/* ------------------------------------------------------------------ *
 * Performance chips
 * ------------------------------------------------------------------ */

/** Superlatives for a metric at the top and bottom of its scenario range. */
const CHIP_BEST: Record<Block5MetricKey, string> = {
  speed: "Fastest",
  resourceUse: "Leanest",
  reliability: "Most reliable",
  durability: "Longest-lasting",
  reversibility: "Easiest to undo",
};
const CHIP_WORST: Record<Block5MetricKey, string> = {
  speed: "Slowest",
  resourceUse: "Heaviest on resources",
  reliability: "Least reliable",
  durability: "Shortest-lived",
  reversibility: "Hardest to undo",
};

/**
 * Chip text for one metric's standing. Ordinal only — these report position within the scenario,
 * never a score, because nothing in Blocks 1-4 says what any metric is worth to this participant
 * and the planner therefore does not weigh them (see block5Planner.ts).
 */
export function chipLabel(chip: PerfChip): string {
  if (chip.rank === 1) return CHIP_BEST[chip.key];
  if (chip.rank === chip.total) return CHIP_WORST[chip.key];
  return `${METRIC_DEFS[chip.key].label} ${chip.rank}${ordinalSuffix(chip.rank)} of ${chip.total}`;
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

/* ------------------------------------------------------------------ *
 * The card explanation
 * ------------------------------------------------------------------ */

export interface CardExplanation {
  rank: number;
  bin: PlannerBin;
  /** Neutral marker for the bin, or null for a clear option (which needs no marker). */
  binLabel: string | null;
  /** "Beat 4 of the other 5 options." */
  winsLine: string;
  /** "Decided on reducing harm." — null when nothing separated it from its opponents. */
  decidedLine: string | null;
  /** Comparison against the highest-ranked option that stays inside every limit. */
  referenceLine: string | null;
  /** Why it outranks an option that beats it on the participant's own top value. */
  tradeLine: string | null;
  /** What limit it crosses, and what it returns for that. Costed and blocked options only. */
  breachLine: string | null;
  /** Two strongest and one weakest metric, as ordinal chips. */
  chips: string[];
}

/*
 * REMOVED ON 24 SEPTEMBER 2026: the "Has a cost" tag.
 *
 * It told a participant that an option was worse than the ones above it, in three words, before
 * they had read a line of the option. That is a nudge, not information - the card already says
 * what the option gives and what it gives up, in the participant's own terms, in the trade-off
 * panel. A short label that summarizes all of it as a penalty invites the reader to skip the
 * reasoning and take the verdict, which is the one thing this block must not let them do.
 *
 * `blocked` keeps its label deliberately. A limit is something the participant SET, in Blocks 1
 * to 4, and choosing an option that crosses one only records a willingness to cross it if they
 * could see that it did. That is a fact about their own earlier answer, not a ranking of options.
 *
 * The bin itself is untouched: the planner still sorts clear before costed before blocked, and
 * `bin` is still stored on every card in the database. Only the word on screen is gone.
 */
const BIN_LABEL: Record<PlannerBin, string | null> = {
  clear: null,
  costed: null,
  blocked: "Crosses a limit you set",
};

const titleOf = (scenario: Block5Scenario, id: string): string =>
  scenario.options.find((o) => o.id === id)?.title ?? id;

/**
 * explainOption — every sentence the card shows about WHY this option sits where it does.
 *
 * Pure: same planner result in, same strings out. No component state, no DOM.
 */
export function explainOption(
  scenario: Block5Scenario,
  plan: PlannerResult,
  profile: DecisionProfile,
  optionId: string,
): CardExplanation {
  const p = plan.byId[optionId];
  const ref = plan.cleanReferenceId;
  const isReference = ref !== null && ref === optionId;

  const winsLine =
    p.wins === p.comparisons
      ? `Beat all ${p.comparisons} of the other options.`
      : p.wins === 0
        ? `Did not win any of its ${p.comparisons} comparisons.`
        : `Beat ${p.wins} of the other ${p.comparisons} options.`;

  const decidedLine = p.decidedOn
    ? `Most often decided on ${POLICY_DIM_SHORT[p.decidedOn]}.`
    : null;

  /* --- comparison against the clean reference --- */
  let referenceLine: string | null = null;
  if (isReference) {
    referenceLine = "This is the option that stays inside every limit you set.";
  } else if (ref) {
    const refN = plan.byId[ref].normalized;
    const deltas = POLICY_DIM_KEYS.map((k) => ({ k, d: p.normalized[k] - refN[k] }));
    const up = deltas.reduce((a, b) => (b.d > a.d ? b : a));
    const down = deltas.reduce((a, b) => (b.d < a.d ? b : a));
    const parts: string[] = [];
    if (up.d > 0.02) parts.push(`${magnitude(up.d)} better on ${POLICY_DIM_SHORT[up.k]}`);
    if (down.d < -0.02) parts.push(`${magnitude(down.d)} worse on ${POLICY_DIM_SHORT[down.k]}`);
    referenceLine = parts.length
      ? `Against “${titleOf(scenario, ref)}”: ${parts.join(", ")}.`
      : `Sits very close to “${titleOf(scenario, ref)}” on all four of your values.`;
  }

  /* --- the trade-off sentence: the advisor's example, in the participant's own numbers --- */
  let tradeLine: string | null = null;
  if (p.ignoredTopValueAgainst.length > 0) {
    const otherId = p.ignoredTopValueAgainst[0];
    const other = plan.byId[otherId];
    const top = profile.order[0];
    const second = profile.order[1];
    if (top && second) {
      const dTop = Math.abs(p.normalized[top] - other.normalized[top]);
      const dSecond = Math.abs(p.normalized[second] - other.normalized[second]);
      const times = dTop > 0 ? Math.round(dSecond / dTop) : 0;
      /* REWORDED 24 September 2026 (researcher's approval). It used to say the gap was "too small
         for you to have separated it in the earlier questions" - a claim about the participant that
         the code cannot make: the smallest gap that counts is the same for everyone, and it is a
         share of this scenario's options, not a step of any ladder they answered. It now says only
         what the planner actually compared. */
      tradeLine =
        `This ranks above “${titleOf(scenario, otherId)}” even though that option is slightly better ` +
        `on ${POLICY_DIM_SHORT[top]} — the gap there is small, while the gap on ${POLICY_DIM_SHORT[second]}` +
        (times >= 2 ? ` is about ${times} times larger.` : " is the larger of the two.");
    }
  }

  /* --- the price tag on a costed or blocked option --- */
  let breachLine: string | null = null;
  if (p.breaches.length > 0) {
    const b = p.breaches[0];
    const what = POLICY_DIM_SHORT[b.key];
    const how = b.hard
      ? `sits at the bottom of this scenario's range on ${what}, which you refused outright in the earlier questions`
      : `sits at the bottom of this scenario's range on ${what}, the value you ranked first`;
    let inReturn = "";
    if (ref && ref !== optionId) {
      const refN = plan.byId[ref].normalized;
      const gains = POLICY_DIM_KEYS.map((k) => ({ k, d: p.normalized[k] - refN[k] }))
        .reduce((a, c) => (c.d > a.d ? c : a));
      if (gains.d > 0.02) {
        inReturn = ` In return it is ${magnitude(gains.d)} better on ${POLICY_DIM_SHORT[gains.k]}.`;
      }
    }
    breachLine = `This ${how}.${inReturn} You can still choose it.`;
  }

  return {
    rank: p.rank,
    bin: p.bin,
    binLabel: BIN_LABEL[p.bin],
    winsLine,
    decidedLine,
    referenceLine,
    tradeLine,
    breachLine,
    chips: p.perfChips.map(chipLabel),
  };
}

/* ------------------------------------------------------------------ *
 * The panel above the cards
 * ------------------------------------------------------------------ */

export interface PlannerPanelText {
  /**
   * The only line the panel shows, and it is the same sentence for every participant.
   *
   * Always shown, whether or not anything is actually blocked (see §10 — held constant).
   */
  noteLine: string;
}

/**
 * The per-scenario panel.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * IT NO LONGER PRINTS THE PARTICIPANT'S OWN VALUE RANKING. Removed on the advisor's instruction,
 * 16 September 2026, and the reason is a measurement one rather than a matter of length.
 *
 * The panel used to open with a line naming the participant's four values in order — "your order
 * is: how much is gained → how many are helped → protecting the vulnerable → reducing harm" — and
 * a second line describing which limits they had set. Both were true and both were a problem: they
 * put the profile the block is about to measure on screen, above the options, while the
 * participant is choosing. Somebody who reads their own ranking and then picks the option that
 * matches it has been told the answer, and VCI can no longer tell a held position from a copied
 * one. It is the same rule that keeps the alignment verdict off the cards.
 *
 * WHAT IS LEFT IS ONE SENTENCE, IDENTICAL FOR EVERY PARTICIPANT AND EVERY SCENARIO. It names the
 * SOURCE of the order without disclosing its CONTENT, which is all a participant needs in order
 * not to read the ordering as a ranking of quality. The wording matches the pre-Block-5 page word
 * for word, so the sentence is a reminder rather than a new claim.
 *
 * A WELCOME SIDE EFFECT: the panel is now literally constant. It used to vary with the profile,
 * which made it a small per-participant difference sitting exactly where the drift measurement is
 * most sensitive. Now there is nothing to vary.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The parameter is kept so the call site does not change and so a future panel can read the
 * profile again without every caller being edited; nothing in the returned text depends on it.
 */
export function plannerPanelText(_profile: DecisionProfile): PlannerPanelText {
  const noteLine =
    "These are ordered using the preferences shown by your earlier answers, "
    + "not by which one we think is best.";

  return { noteLine };
}

/**
 * Heading shown on the divider before the first option of a bin.
 *
 * COSTED HAS NO DIVIDER ANY MORE (24 September 2026). "These cost you something on the value you
 * ranked first" drew a line across the list and told the participant that everything below it was
 * the losing half. Removed for the same reason as the tag above: it is a verdict delivered before
 * the reading, and the cards below it are fully available choices.
 *
 * Partial on purpose - a bin with no entry here simply draws no divider, so removing one is a
 * one-line change rather than a change to every call site.
 */
export const BIN_DIVIDER: Partial<Record<Exclude<PlannerBin, "clear">, string>> = {
  blocked: "These cross a limit you set earlier — still fully available",
};

/**
 * Short name for a bin. NOTHING RENDERS THIS TODAY - it was written for a chosen-option
 * summary that no longer shows one, and it is kept only so a future summary has a single
 * place to take its wording from. If you are looking for what a participant actually reads,
 * it is BIN_LABEL above, where `costed` is deliberately null.
 */
export const BIN_SHORT: Record<PlannerBin, string> = {
  clear: "inside your limits",
  costed: "has a cost",
  blocked: "crosses a limit",
};

export type { PlannerBin } from "./block5Planner";
