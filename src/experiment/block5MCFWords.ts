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
 * The panel renders these words and adds nothing of its own. Since 27 September 2026 each sentence
 * comes as a list of SPANS - a piece of text and what it is (a value's name, a direction, an option's
 * title) - so the panel can color the words that carry the meaning. The words are the same whether
 * they are colored or not: `plainText` joins the spans back into the sentence the gates read, and
 * meaning is never carried by color alone.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT CHANGED ON 27 SEPTEMBER 2026, AND WHY (the researcher's approval, "Q1 - Yes")
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * An audit ran the old words over 4,000 pretend participants who answered Blocks 1-4 (60,000
 * readings per group) and found that they said WHICH SIDE of the participant's number an option sat
 * on, but not clearly HOW FAR, and never what a gap means:
 *
 *   - "above" had one size: one point above and sixty points above both read "More than you asked
 *     for". Now three sizes each way, from the bands block5MCF already computes (BAND 10, WIDE_BAND
 *     25): SLIGHTLY (under 10 points), plain (10-24), WELL (25 or more).
 *   - "a little below" covered everything under 25 points: 17 in 100 below-clauses were 15-24 points
 *     below. Same fix.
 *   - 28 in 100 "It asks" sentences read "You to accept a little below on reducing harm." - below
 *     what? The first clause now always says "where you stand".
 *   - "Most of all on X" names the value that COSTS most, which weighs the gap by how strongly the
 *     participant holds the value, and the words never said so: in about 5 in 100 readings with two
 *     or more values below, X was not the biggest gap, and in 4 in 1,000 the sentence read as a
 *     contradiction ("well below on A ... a little below on B. Most of all on B"). It now adds
 *     "because you hold it more strongly than A" whenever the costliest value is not the biggest gap.
 *     That clause is TRUE BY ARITHMETIC: cost = (hold / 100) x gap, so a smaller gap can only cost
 *     more when it is held more strongly - and it is also checked here on the numbers before it is
 *     written, and by gate M9 on every reading.
 *   - A value exactly at the participant's number was never mentioned. It now reads "exactly where
 *     you stand".
 *   - "what you asked for" was not literally true: the four numbers are computed from the
 *     participant's answers, never asked for (the same reason "you rated" was removed from the
 *     confirm-keep question on 24 September 2026). It now reads "where you stand".
 *   - A sentence could start with a lower-case value name ("reducing harm is served most here").
 *     Every line now starts with a capital.
 *   - NEW: a value-by-value reading (`byValue`), one row per value in the participant's own order,
 *     strongest first, with the same side and size the sentences use - so each option is read
 *     against each of the participant's four numbers, which is what MCF is for.
 *
 * The arithmetic did not change (block5MCF.ts, MCF_VERSION unchanged); only the words did. Records
 * made before 27 September 2026 were made with the old words on screen (HOW_TO_ANALYZE 4.9).
 */

import { POLICY_DIM_KEYS, POLICY_DIM_SHORT } from "./block5Types";
import type { Block5PolicyDimKey } from "./block5Types";
import type { McfOption, McfValueLine } from "./block5MCF";

const name = (key: Block5PolicyDimKey) => POLICY_DIM_SHORT[key];

/* ------------------------------------------------------------------ the pieces of a sentence */

/**
 * What a piece of a sentence IS, so the panel can color it. `value` = one of the four values' names
 * (drawn in that value's own color, as in "Your values in this scenario"); `above` / `below` /
 * `exact` = a direction and its size; `option` = an option's quoted title; `strong` = a phrase the
 * sentence leans on ("Most of all"); `text` = everything else.
 */
export type McfTone = "text" | "value" | "above" | "below" | "exact" | "option" | "strong";

export interface McfSpan {
  text: string;
  tone: McfTone;
  /** Set on `value` spans: which value, so the panel can pick its color and icon. */
  value?: Block5PolicyDimKey;
  /** Set on `option` spans: which option, so the panel can draw its chart color beside it. */
  optionId?: string;
}

/** One sentence, as the spans it is built from. */
export type McfLine = McfSpan[];

/** The sentence as a participant reads it, without the coloring. What every gate checks. */
export function plainText(line: McfLine): string {
  return line.map((s) => s.text).join("");
}

const span = (text: string, tone: McfTone = "text"): McfSpan => ({ text, tone });
const valueSpan = (key: Block5PolicyDimKey): McfSpan => ({ text: name(key), tone: "value", value: key });

/** Joins pieces the way a person writes a list: "a", "a and b", "a, b and c". */
function listedSpans(items: McfSpan[][]): McfSpan[] {
  if (items.length <= 1) return items[0] ?? [];
  const out: McfSpan[] = [];
  items.forEach((item, i) => {
    if (i > 0) out.push(span(i === items.length - 1 ? " and " : ", "));
    out.push(...item);
  });
  return out;
}
const listedValues = (keys: Block5PolicyDimKey[]) => listedSpans(keys.map((k) => [valueSpan(k)]));

/** Every line starts with a capital letter, whatever its first piece is. */
function capitalized(line: McfLine): McfLine {
  if (!line.length) return line;
  const [first, ...rest] = line;
  return [{ ...first, text: first.text.charAt(0).toUpperCase() + first.text.slice(1) }, ...rest];
}

/* ------------------------------------------------------------------ side and size, per value */

export type McfSide = "above" | "below" | "exact";
export type McfSize = "well" | "plain" | "slightly" | "exact";

/**
 * Which side of the participant's number the option sits on, from the gap block5MCF stored (the
 * option's number minus theirs, to one decimal). A gap that rounds to 0 is "exact".
 */
export function sideOf(line: McfValueLine): McfSide {
  if (line.gap > 0) return "above";
  if (line.gap < 0) return "below";
  return "exact";
}

/**
 * How far, in words. The line sits where block5MCF put it (`direction`, bands 10 and 25); this file
 * only picks the English. "close" (under 10 points either way) is SLIGHTLY, on whichever side the
 * gap is.
 */
export function sizeOf(line: McfValueLine): McfSize {
  if (sideOf(line) === "exact") return "exact";
  if (line.direction === "well_above" || line.direction === "well_below") return "well";
  if (line.direction === "above" || line.direction === "below") return "plain";
  return "slightly";
}

const SIZE_WORD: Record<Exclude<McfSize, "exact">, string> = { well: "well ", plain: "", slightly: "slightly " };
const SIZES_FAR_FIRST: Exclude<McfSize, "exact">[] = ["well", "plain", "slightly"];

/** One value, read against the participant: the row of the value-by-value reading. */
export interface McfValueRead {
  value: Block5PolicyDimKey;
  side: McfSide;
  size: McfSize;
  /** The words on the row's tag: "Well below", "Slightly above", "Exactly the same". */
  tag: string;
  /** True on the value this option asks most of, when it asks something on two or more values. */
  asksMost: boolean;
}

/* ------------------------------------------------------------------ the whole reading */

export interface McfWords {
  /** One row per value, in the order given (the participant's own, strongest first). */
  byValue: McfValueRead[];
  /** Where the option is above where they stand (and exactly at it), farthest first. */
  gives: McfLine;
  /** Where it is below, farthest first, and which value it asks most of. */
  asks: McfLine;
  /** Which option on this table serves those values most. Null when it asks nothing. */
  servedMost: McfLine | null;
  /** What honoring the value it asks most of would ask instead. At most two. */
  inExchange: McfLine[];
}

/**
 * Groups values by size, farthest first: "well below where you stand on a and b; below on c".
 * Only the first group says "where you stand" - the rest are read against it.
 */
function groupedBySize(lines: McfValueLine[], side: "above" | "below"): McfLine[] {
  const groups: McfLine[] = [];
  for (const size of SIZES_FAR_FIRST) {
    const keys = lines.filter((l) => sizeOf(l) === size).map((l) => l.value);
    if (!keys.length) continue;
    groups.push([
      span(`${SIZE_WORD[size]}${side}`, side),
      span(groups.length === 0 ? " where you stand on " : " on "),
      ...listedValues(keys),
    ]);
  }
  return groups;
}

/** Groups joined with "; ": a list of values already uses "and", so a second "and" would blur them. */
function joinedGroups(groups: McfLine[]): McfLine {
  const out: McfLine = [];
  groups.forEach((g, i) => { if (i > 0) out.push(span("; ")); out.push(...g); });
  return out;
}

/**
 * Every reading, for one option.
 *
 * `order` is the participant's own order of their four values, strongest first - the order of
 * "Your values in this scenario" - so the value-by-value rows read top to bottom the same way.
 * Without it, the order is worked out from the numbers in the reading (strongest first).
 *
 * WHAT IS DELIBERATELY LEFT OUT. block5MCF also knows whether the swap option costs this
 * participant more or less overall. That is precisely a fit comparison between two options, so it
 * never becomes a sentence - only what the swap asks instead, which is a fact about the options
 * rather than a verdict about the person.
 */
export function mcfWords(
  row: McfOption,
  titleOf: (optionId: string) => string,
  order?: Block5PolicyDimKey[],
): McfWords {
  const lineOf = (k: Block5PolicyDimKey) => row.lines.find((l) => l.value === k) as McfValueLine;
  const above = row.lines.filter((l) => sideOf(l) === "above");
  const exact = row.lines.filter((l) => sideOf(l) === "exact");
  /* What it asks, costliest first; an equal cost is broken by the bigger gap, then by the fixed
     order of the four values, so the same numbers always give the same sentence. */
  const below = row.lines
    .filter((l) => sideOf(l) === "below")
    .sort((a, b) => b.costOfFallingShort - a.costOfFallingShort || a.gap - b.gap
      || POLICY_DIM_KEYS.indexOf(a.value) - POLICY_DIM_KEYS.indexOf(b.value));
  const costliest = below.length > 1 ? below[0] : null;

  /* ---- value by value, in the participant's order ---- */
  const ordered = order && order.length === POLICY_DIM_KEYS.length
    ? order
    : [...POLICY_DIM_KEYS].sort((a, b) => lineOf(b).youHold - lineOf(a).youHold);
  const byValue: McfValueRead[] = ordered.map((key) => {
    const line = lineOf(key);
    const side = sideOf(line);
    const size = sizeOf(line);
    const tag = size === "exact"
      ? "Exactly the same"
      : `${SIZE_WORD[size]}${side}`.replace(/^./, (c) => c.toUpperCase());
    return { value: key, side, size, tag, asksMost: costliest?.value === key };
  });

  /* ---- It gives ---- */
  const givesGroups = groupedBySize(above, "above");
  if (exact.length) {
    givesGroups.push([span("exactly where you stand", "exact"), span(" on "), ...listedValues(exact.map((l) => l.value))]);
  }
  const gives: McfLine = givesGroups.length
    ? capitalized([...joinedGroups(givesGroups), span(".")])
    : [span("Nothing above where you stand on any of the four values.")];

  /* ---- It asks ---- */
  let asks: McfLine;
  if (!below.length) {
    asks = [span("Nothing: it meets or clears where you stand on all four values.")];
  } else {
    asks = [span("You to accept "), ...joinedGroups(groupedBySize(below, "below")), span(".")];
    if (costliest) {
      /* The biggest gap in points. When it is not the costliest value, say why the costliest one
         counts for more - but only after checking that the reason is true on these numbers. */
      const biggestGap = [...below].sort((a, b) => a.gap - b.gap
        || POLICY_DIM_KEYS.indexOf(a.value) - POLICY_DIM_KEYS.indexOf(b.value))[0];
      asks.push(span(" "), span("Most of all", "strong"), span(" on "), valueSpan(costliest.value));
      if (biggestGap.value !== costliest.value && costliest.youHold > biggestGap.youHold) {
        asks.push(span(", because you hold it more strongly than "), valueSpan(biggestGap.value));
      }
      asks.push(span("."));
    }
  }

  /* ---- Served most here: the two values it asks most of ---- */
  const servedMost: McfLine | null = below.length
    ? capitalized([
        ...listedSpans(below.slice(0, 2).map((l): McfSpan[] => (
          l.servedMostHere === row.optionId
            ? [valueSpan(l.value), span(" is served most here by this option")]
            : [valueSpan(l.value), span(" is served most here by "),
              { text: `“${titleOf(l.servedMostHere)}”`, tone: "option", optionId: l.servedMostHere }]
        ))),
        span("."),
      ])
    : null;

  /* ---- In exchange: two at most. A reading with four is a page, and the two costliest values are
     the ones being weighed. ---- */
  const candidates = below.slice(0, 2)
    .map((l) => row.swaps.find((s) => s.value === l.value))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  /* The values nothing on this table can meet are said once, together: two sentences beginning
     "No option on this table" read as a fault in the page rather than as a fact about the menu. */
  const unmet = candidates.filter((s) => !s.optionId || !s.clearsWhatYouHold);
  const met = candidates.filter((s) => s.optionId && s.clearsWhatYouHold);

  const inExchange: McfLine[] = [
    ...met.map((swap): McfLine => [
      span("Taking "),
      { text: `“${titleOf(swap.optionId as string)}”`, tone: "option", optionId: swap.optionId as string },
      span(" instead would meet where you stand on "),
      valueSpan(swap.value),
      ...(swap.givesUpInstead.length
        ? [span(" — and would ask you to accept less on "), ...listedValues(swap.givesUpInstead), span(".")]
        : [span(" — without asking more of the other three.")]),
    ]),
    ...(unmet.length
      ? [[span("No option on this table meets where you stand on "), ...listedValues(unmet.map((s) => s.value)), span(".")]]
      : []),
  ];

  return { byValue, gives, asks, servedMost, inExchange };
}

/* ------------------------------------------------------------------ the same, as plain strings */

export interface McfSentences {
  gives: string;
  asks: string;
  servedMost: string | null;
  inExchange: string[];
}

/** The four sentences as plain text - exactly what the panel shows, without the coloring. */
export function mcfSentences(
  row: McfOption,
  titleOf: (optionId: string) => string,
  order?: Block5PolicyDimKey[],
): McfSentences {
  const w = mcfWords(row, titleOf, order);
  return {
    gives: plainText(w.gives),
    asks: plainText(w.asks),
    servedMost: w.servedMost ? plainText(w.servedMost) : null,
    inExchange: w.inExchange.map(plainText),
  };
}
