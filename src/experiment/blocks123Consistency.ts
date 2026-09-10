/**
 * blocks123Consistency.ts — how the participant ANSWERED Blocks 1-3, read back after Block 5.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS NOT
 *
 * It is not a grade, and there is no composite score. Every number here is descriptive, and the
 * page that draws it says so. That is a deliberate limit, for a reason worth stating:
 *
 *   ANSWERING DIFFERENTLY IN DIFFERENT CONTEXTS IS NOT INCONSISTENCY. A participant who keeps
 *   $10 found on a wealthy street but returns $1,000 found outside a shelter has not contradicted
 *   themselves — they have expressed the exact sensitivity this study exists to measure. Scoring
 *   that as instability would invert the finding.
 *
 * So the only things named as problems here are the two that are genuinely defects of ANSWERING
 * rather than positions about the world: answering faster than the questions can be read, and
 * moving in both directions on a scale that only moves one way.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO "LADDER REVERSAL" MEASURE
 *
 * The obvious coherence check — did they accept at $10 and refuse at $100? — cannot fire. Every
 * ladder in Blocks 1-3 walks upward and STOPS at the first acceptance (MoneyThresholdBlock's
 * handler advances only on a non-keep; Block 3 additionally carries `blockedByPriorNonAcceptance`).
 * Monotonicity is enforced by the interface, so a reversal is not something a participant can
 * produce. A measure of it would return "perfectly coherent" for every human being alive, which is
 * a measure of the UI and not of the person.
 *
 * The one place a genuine ordering problem CAN appear is Block 3's group-size axis, because its
 * six cells are separate questions rather than one ladder. That is what `scaleZigzag` looks at.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHERE THE DATA COMES FROM
 *
 * Blocks 1-3 write their own results to localStorage and are never rewritten by Block 5, so this
 * reads them directly. Nothing here is recomputed from the derived profile: the point is to show
 * the RAW answers, and a profile that CVR and APA have been moving is the wrong source for that.
 */

import { AMOUNT_LABELS, CONTEXTS, SESSION_KEY_RESULTS } from "./constants";
import { SAVED_LIVES_OPTIONS, TROLLEY_RESULTS_STORAGE_KEY } from "./trolleyTypes";
import { AI_WORKFORCE_RESULTS_KEY, GAIN_OPTIONS } from "./aiWorkforceTypes";
import type { MoneyBlockResults } from "./types";
import type { TrolleyBlockResults } from "./trolleyTypes";
import type { AIWorkforceBlockResults, WorkerGroupSizeKey } from "./aiWorkforceTypes";

/** Parses one LocalStorage entry, returning null on anything unexpected rather than throwing. */
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/* ---------------------------------- Block 1 ---------------------------------- */

export interface MoneyContextPoint {
  key: string;
  label: string;
  /**
   * A short form for the chart row. HBarChart reserves a fixed label column about fifteen
   * characters wide, and "Outside a homeless shelter" is drawn over by its own bar. The full
   * label is still used in the sentence underneath, which has the room for it.
   */
  shortLabel: string;
  /** 0-7 = the rung they stopped at; 8 = never kept it at any amount. */
  rung: number;
  /** the money label at that rung, or null when they kept nothing at all */
  amountLabel: string | null;
  kept: boolean;
}

export interface MoneyReadout {
  points: MoneyContextPoint[];
  /** highest rung minus lowest, in ladder steps. NOT a judgment - see the header. */
  spread: number;
  maxRung: number;
}

const MONEY_SHORT: Record<string, string> = {
  sidewalk: "Sidewalk",
  wealthy: "Wealthy street",
  shelter: "By a shelter",
};

/**
 * Block 1 read back as three independent ladder positions.
 *
 * A context where the participant never kept the money is recorded at rung 8 - one past the top
 * of the ladder - so "never" sits at the far end of the same axis instead of being dropped. The
 * spread across contexts is then comparable whether or not any context was refused outright.
 */
function readMoney(): MoneyReadout | null {
  const r = readJson<MoneyBlockResults>(SESSION_KEY_RESULTS);
  if (!r || !r.thresholds) return null;
  const points: MoneyContextPoint[] = CONTEXTS.map((c) => {
    const t = r.thresholds[`threshold_${c.key}` as keyof typeof r.thresholds];
    const idx = t?.thresholdAmountIndex;
    const kept = !!t?.accepted && Number.isFinite(idx);
    return {
      key: c.key,
      label: c.label,
      shortLabel: MONEY_SHORT[c.key] ?? c.label,
      rung: kept ? (idx as number) : AMOUNT_LABELS.length,
      amountLabel: kept ? AMOUNT_LABELS[idx as number] : null,
      kept,
    };
  });
  if (points.length === 0) return null;
  const rungs = points.map((p) => p.rung);
  return {
    points,
    spread: Math.max(...rungs) - Math.min(...rungs),
    maxRung: AMOUNT_LABELS.length,
  };
}

/* ---------------------------------- Block 2 ---------------------------------- */

export interface TrolleyReadout {
  leverRung: number | null;
  bridgeRung: number | null;
  leverLabel: string | null;
  bridgeLabel: string | null;
  /** bridge - lever, in ladder steps. Positive = needed more lives before pushing. */
  gap: number | null;
  maxRung: number;
}

/**
 * Block 2 read back as two ladder positions on the same lives-saved scale.
 *
 * Both phases walk that ladder independently from rung 0 under the current methodology, so the
 * gap between them is a like-for-like difference and not an artefact of one starting higher.
 */
function readTrolley(): TrolleyReadout | null {
  const r = readJson<TrolleyBlockResults>(TROLLEY_RESULTS_STORAGE_KEY);
  if (!r) return null;
  const rung = (t: { accepted?: boolean; thresholdIndex?: number | null } | null | undefined) =>
    t && t.accepted && Number.isFinite(t.thresholdIndex)
      ? (t.thresholdIndex as number)
      : SAVED_LIVES_OPTIONS.length;
  const lever = rung(r.leverThreshold);
  const bridge = r.bridgeThreshold ? rung(r.bridgeThreshold) : null;
  const lab = (i: number | null) =>
    i === null ? null : i < SAVED_LIVES_OPTIONS.length ? `${SAVED_LIVES_OPTIONS[i]} lives` : "never";
  return {
    leverRung: lever,
    bridgeRung: bridge,
    leverLabel: lab(lever),
    bridgeLabel: lab(bridge),
    gap: bridge === null ? null : bridge - lever,
    maxRung: SAVED_LIVES_OPTIONS.length,
  };
}

/* ---------------------------------- Block 3 ---------------------------------- */

const SIZES: WorkerGroupSizeKey[] = ["small", "medium", "large"];
const SIZE_LABEL: Record<WorkerGroupSizeKey, string> = {
  small: "Small group", medium: "Medium group", large: "Large group",
};

export interface WorkforceSeries {
  buffer: "low_buffer" | "high_buffer";
  label: string;
  /** one rung per size, in small → medium → large order. maxRung = refused at every price. */
  rungs: number[];
  /** true when the three rungs never change direction (flat counts as consistent). */
  consistent: boolean;
}

export interface WorkforceReadout {
  series: WorkforceSeries[];
  sizeLabels: string[];
  maxRung: number;
  /** the series whose demand moved BOTH up and down across the three sizes */
  zigzag: string[];
}

/** True when the sequence never changes direction. Flat is consistent; up-then-down is not. */
function monotone(v: number[]): boolean {
  let up = false, down = false;
  for (let i = 1; i < v.length; i++) {
    if (v[i] > v[i - 1]) up = true;
    if (v[i] < v[i - 1]) down = true;
  }
  return !(up && down);
}

/**
 * Block 3 read back as two three-point series across the group-size axis.
 *
 * This is the only place in Blocks 1-3 where an ordering problem can genuinely appear, because
 * the six cells are separate questions rather than one ladder. Everywhere else the interface
 * stops at the first acceptance and enforces monotonicity for the participant.
 */
function readWorkforce(): WorkforceReadout | null {
  const r = readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY);
  if (!r || !r.thresholds) return null;
  const max = GAIN_OPTIONS.length;
  const build = (buffer: "low_buffer" | "high_buffer", label: string): WorkforceSeries => {
    const rungs = SIZES.map((size) => {
      const key = `threshold_${buffer === "low_buffer" ? "lowbuffer" : "highbuffer"}_${size}`;
      const cell = r.thresholds[key as keyof typeof r.thresholds];
      const idx = cell?.thresholdGainIndex;
      return cell?.accepted && Number.isFinite(idx) ? (idx as number) : max;
    });
    return { buffer, label, rungs, consistent: monotone(rungs) };
  };
  const series = [
    build("low_buffer", "Workers with little to fall back on"),
    build("high_buffer", "Workers with a strong safety net"),
  ];
  return {
    series,
    sizeLabels: SIZES.map((s) => SIZE_LABEL[s]),
    maxRung: max,
    zigzag: series.filter((s) => !s.consistent).map((s) => s.label),
  };
}

/* -------------------------------- deliberation -------------------------------- */

export interface DeliberationReadout {
  decisions: number;
  /** median seconds between one click and the next, within a block */
  medianSeconds: number;
  /** true when the median is short enough that the questions cannot have been read */
  hurried: boolean;
}

/**
 * Median seconds per decision, from the timestamps every block already writes on each click.
 *
 * MEDIAN, NOT MEAN, because one interruption — a participant who walks away mid-block and comes
 * back — would drag a mean upward far enough to hide genuine click-through. The median ignores it.
 *
 * Gaps ARE measured within a block only, never across the boundary between two blocks, since that
 * span includes whatever transition screen sat between them. The 2.5-second flag is a reading-speed
 * floor, not a quality judgment: the shortest scenario text in these blocks cannot be read in
 * that time, so anything below it means the text was not read.
 */
const HURRIED_SECONDS = 2.5;

function readDeliberation(): DeliberationReadout | null {
  const stamps: number[][] = [];
  const money = readJson<MoneyBlockResults>(SESSION_KEY_RESULTS);
  const trolley = readJson<TrolleyBlockResults>(TROLLEY_RESULTS_STORAGE_KEY);
  const work = readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY);
  for (const h of [money?.history, trolley?.history, work?.history]) {
    if (!h || h.length < 2) continue;
    stamps.push(h.map((x) => Date.parse(x.timestamp)).filter((n) => Number.isFinite(n)));
  }
  const gaps: number[] = [];
  for (const block of stamps) {
    for (let i = 1; i < block.length; i++) {
      const d = block[i] - block[i - 1];
      if (d > 0) gaps.push(d);
    }
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)] / 1000;
  return {
    decisions: gaps.length + stamps.length,
    medianSeconds: Math.round(median * 10) / 10,
    hurried: median < HURRIED_SECONDS,
  };
}

/* ---------------------------------- the whole ---------------------------------- */

export interface Blocks123Readout {
  available: boolean;
  money: MoneyReadout | null;
  trolley: TrolleyReadout | null;
  workforce: WorkforceReadout | null;
  deliberation: DeliberationReadout | null;
}

/**
 * Everything the four Blocks 1-3 charts need, read straight from each block's own storage.
 *
 * `available` is false when none of the three blocks left data, which is the signal the page uses
 * to draw nothing at all rather than four empty frames.
 */
export function readBlocks123(): Blocks123Readout {
  const money = readMoney();
  const trolley = readTrolley();
  const workforce = readWorkforce();
  const deliberation = readDeliberation();
  return {
    available: !!(money || trolley || workforce),
    money, trolley, workforce, deliberation,
  };
}

/** One plain sentence about Block 1's spread. Descriptive - it never says better or worse. */
export function moneySentence(m: MoneyReadout): string {
  if (m.spread === 0) {
    return "You gave the same answer in all three places — where the money was found did not change what you did.";
  }
  const most = [...m.points].sort((a, b) => b.rung - a.rung)[0];
  const least = [...m.points].sort((a, b) => a.rung - b.rung)[0];
  /*
    The two places are named as labels rather than folded into the sentence. The context labels
    are noun phrases of different shapes - "Neutral sidewalk", "Outside a homeless shelter" - so a
    template like "you gave in soonest <label>" reads correctly for one of them and ungrammatically
    for the others. Naming them after a colon works whatever the label happens to be.
  */
  return `Where the money was found changed your answer by ${m.spread} step${m.spread === 1 ? "" : "s"} ` +
    `on the ladder. Longest hold-out: ${most.label}. Gave in soonest: ${least.label}.`;
}

/** One plain sentence about the lever/bridge gap. */
export function trolleySentence(t: TrolleyReadout): string {
  if (t.gap === null) return "You did not complete both parts of this block.";
  if (t.gap === 0) {
    return "You asked for the same number of lives before acting, whether the act was pulling a lever or pushing a person.";
  }
  return t.gap > 0
    ? `You needed ${t.gap} more step${t.gap === 1 ? "" : "s"} up the ladder before pushing a person than before pulling a lever — the same outcome, but not the same act.`
    : `You needed ${-t.gap} fewer step${t.gap === -1 ? "" : "s"} before pushing a person than before pulling a lever.`;
}

/** One plain sentence about Block 3's size axis. */
export function workforceSentence(w: WorkforceReadout): string {
  if (w.zigzag.length === 0) {
    return "As the group got larger your demands moved in one consistent direction, for both kinds of worker.";
  }
  // The series labels are capitalised for the legend, so they are lowered here to sit mid-sentence.
  const names = w.zigzag.map((n) => n.charAt(0).toLowerCase() + n.slice(1));
  return `For ${names.join(" and ")}, your demand went up for one group size and down for another. ` +
    "That is the one pattern here worth a second look — the group only ever gets bigger.";
}
