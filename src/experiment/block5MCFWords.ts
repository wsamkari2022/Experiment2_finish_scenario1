/**
 * block5MCFWords.ts — the Moral Commitment Function turned into sentences.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE WORDS LIVE APART FROM THE PANEL THAT SHOWS THEM
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * Two rules govern everything a participant reads about their own values, and both are easy to
 * break with one careless edit months from now:
 *
 *   1. no verdict - never "aligned", "best fit", "recommended", "should"
 *   2. no arithmetic - never a value number, a shortfall, a percentage or a rank
 *
 * A rule that lives only inside JSX can only be checked by reading the JSX. Built here, every
 * sentence a participant can ever see is a plain string that a gate can inspect: `npm run
 * validate:mcf` generates all of them, for every option in every scenario against hundreds of
 * profiles, and fails if a verdict word or a digit appears in any of them (M7).
 *
 * The panel renders these strings and adds nothing of its own.
 */

import { POLICY_DIM_SHORT } from "./block5Types";
import type { Block5PolicyDimKey } from "./block5Types";
import type { McfOption, McfValueLine } from "./block5MCF";

const name = (key: Block5PolicyDimKey) => POLICY_DIM_SHORT[key];

/** Joins a list the way a person writes one: "a", "a and b", "a, b and c". */
function listed(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * "below" or "well below" — chosen by the band block5MCF already decided.
 *
 * The threshold is not re-derived here. This file picks the English for a direction; the
 * calculation owns where the line sits.
 */
const belowWord = (line: McfValueLine) =>
  line.direction === "well_below" ? "well below" : "below";

export interface McfSentences {
  /** What the option gives beyond what they asked for. Never called credit. */
  gives: string;
  /** What it asks of them, costliest value first. */
  asks: string;
  /** Which option on this table serves those values most. Null when it asks nothing. */
  servedMost: string | null;
  /** What honoring the value it asks most of would give up instead. At most two. */
  inExchange: string[];
}

/**
 * The four sentences for one option.
 *
 * WHAT IS DELIBERATELY LEFT OUT. block5MCF also knows whether the swap option costs this
 * participant more or less overall. That is precisely a fit comparison between two options, so it
 * never becomes a sentence - only what the swap asks instead, which is a fact about the options
 * rather than a verdict about the person.
 */
export function mcfSentences(
  row: McfOption,
  titleOf: (optionId: string) => string,
): McfSentences {
  const gives = row.lines.filter((l) => l.surplus > 0);
  const asks = row.lines
    .filter((l) => l.costOfFallingShort > 0)
    .sort((a, b) => b.costOfFallingShort - a.costOfFallingShort);

  const givesSentence = gives.length
    ? `More than you asked for on ${listed(gives.map((l) => name(l.value)))}.`
    : "Nothing beyond what you asked for on any of the four values.";

  /*
   * GROUPED BY HOW FAR BELOW, not one clause per value.
   *
   * Written value by value, four shortfalls read as "well below where you stand on X, well below
   * where you stand on Y, well below where you stand on Z and below where you stand on W" - the
   * same seven words four times, which is where a reader stops reading. Grouped, the same facts
   * take one clause each and the difference between "well below" and "below" becomes visible
   * instead of being buried in the repetition.
   */
  let asksSentence: string;
  if (!asks.length) {
    asksSentence = "Nothing: it meets or clears where you stand on all four values.";
  } else {
    const wellBelow = asks.filter((l) => belowWord(l) === "well below").map((l) => name(l.value));
    const below = asks.filter((l) => belowWord(l) === "below").map((l) => name(l.value));
    const clauses: string[] = [];
    if (wellBelow.length) clauses.push(`well below where you stand on ${listed(wellBelow)}`);
    if (below.length) clauses.push(`a little below on ${listed(below)}`);
    asksSentence = asks.length > 1
      ? `You to accept ${listed(clauses)}. Most of all on ${name(asks[0].value)}.`
      : `You to accept ${listed(clauses)}.`;
  }

  const servedMost = asks.length
    ? `${listed(asks.slice(0, 2).map((l) => (
        l.servedMostHere === row.optionId
          ? `${name(l.value)} is served most here by this option`
          : `${name(l.value)} is served most here by “${titleOf(l.servedMostHere)}”`
      )))}.`
    : null;

  /* Two at most. A reading with four is a page, and the two costliest values are the ones being
     weighed. */
  const candidates = asks.slice(0, 2)
    .map((l) => row.swaps.find((s) => s.value === l.value))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  /* The values nothing on this table can meet are said once, together: two sentences beginning
     "Nothing on this table" read as a fault in the page rather than as a fact about the menu. */
  const unmet = candidates.filter((s) => !s.optionId || !s.clearsWhatYouHold);
  const met = candidates.filter((s) => s.optionId && s.clearsWhatYouHold);

  const inExchange = [
    ...met.map((swap) => {
      const instead = swap.givesUpInstead.length
        ? ` — and would ask you to accept less on ${listed(swap.givesUpInstead.map(name))}.`
        : " — without asking more of the other three.";
      return `Taking “${titleOf(swap.optionId as string)}” instead would meet where you stand on `
        + `${name(swap.value)}${instead}`;
    }),
    ...(unmet.length
      ? [`No option on this table meets where you stand on ${listed(unmet.map((s) => name(s.value)))}.`]
      : []),
  ];

  return { gives: givesSentence, asks: asksSentence, servedMost, inExchange };
}
