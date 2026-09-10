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

const BIN_LABEL: Record<PlannerBin, string | null> = {
  clear: null,
  costed: "Has a cost",
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
      tradeLine =
        `This ranks above “${titleOf(scenario, otherId)}” even though that option is slightly better ` +
        `on ${POLICY_DIM_SHORT[top]} — the gap there is too small for you to have separated it in the ` +
        `earlier questions, while the gap on ${POLICY_DIM_SHORT[second]}` +
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
  /** "You ranked: how much is gained, then reducing harm, then …" */
  rankingLine: string;
  /** The limits being applied, or a line saying none were found. */
  limitsLine: string;
  /** Always shown, whether or not anything is actually blocked (see §10 — held constant). */
  noteLine: string;
}

/**
 * The per-scenario panel.
 *
 * SHOWN IDENTICALLY EVERY TIME. It does not appear only when something is blocked, and its wording
 * does not change with the option set. If it varied with the situation it would be a manipulation
 * that fires exactly where the drift measurement is most sensitive, and the study would not be able
 * to tell an effect of position from an effect of the interface noticing something.
 */
export function plannerPanelText(profile: DecisionProfile): PlannerPanelText {
  const ranking = profile.order.map((k) => POLICY_DIM_SHORT[k]);
  const rankingLine = `From your earlier answers, your order is: ${ranking.join(" → ")}.`;

  const limited = POLICY_DIM_KEYS.filter((k) => profile.thresholds[k]?.hasRedLine);
  const limitsLine = limited.length
    ? `You refused outright on ${listOf(limited.map((k) => POLICY_DIM_SHORT[k]))}, so options at the ` +
      "bottom of the range there are shown lower down."
    : "You named a price on every value rather than refusing outright, so nothing here is ruled out.";

  const noteLine =
    "The order below comes from comparing the options two at a time against that ranking — " +
    "it is not a recommendation, and every option can be chosen.";

  return { rankingLine, limitsLine, noteLine };
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Heading shown on the divider before the first costed / blocked option. */
export const BIN_DIVIDER: Record<Exclude<PlannerBin, "clear">, string> = {
  costed: "These cost you something on the value you ranked first",
  blocked: "These cross a limit you set earlier — still fully available",
};

/** Short participant-facing name for a bin, used on the chosen-option summary. */
export const BIN_SHORT: Record<PlannerBin, string> = {
  clear: "inside your limits",
  costed: "has a cost",
  blocked: "crosses a limit",
};

export type { PlannerBin } from "./block5Planner";
