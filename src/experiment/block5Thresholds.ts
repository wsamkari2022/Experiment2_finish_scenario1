/**
 * block5Thresholds.ts — Derives the planner's decision parameters from Blocks 1–4.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * READ-ONLY. This module imports from Blocks 1–4 and writes nothing back.
 * Blocks 1–4 — their instruments, their scoring, and the profile they produce —
 * are frozen. Everything here is a second READING of data those blocks already
 * collected and already store.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The trade-off planner (block5Planner.ts) needs three things about a participant that the
 * 0–100 sensitivity profile does not carry:
 *
 *   redLine    — "I will not do this for any price."
 *   exchange   — "how much MORE do I demand when the target changes?"
 *   tolerance  — "how small a gap is too small for me to have noticed?"
 *
 * The obvious move is to invent defaults for all three. That was rejected: a threshold the
 * participant never stated, presented as if they had, is the kind of thing that quietly turns a
 * measurement into an artefact of its own constants.
 *
 * It turns out none of it needs inventing. Blocks 1–3 are LADDERS, and a ladder measures exactly
 * these three quantities:
 *
 *   1. RED LINE = a refusal sentinel. Block 3 escalates $1 → $10k → $100k → $1M → $10M → $100M.
 *      A participant who said no at every rung, including $100 million, drew a line with their own
 *      hand. `thresholdBeyondRange` / the sentinel index is that refusal, already stored.
 *
 *      Red lines are found on only TWO of the four values — protecting the vulnerable, and how
 *      many are harmed. Refusing money to hurt people is a line about HURTING PEOPLE. It is not a
 *      line about "gain" or about "help", and inventing one there would be exactly the kind of
 *      unstated threshold this module exists to avoid. The reasoning is set out in full above the
 *      four derivations below.
 *
 *   2. EXCHANGE RATE = the gap between two ladder answers. Block 3 asks the SAME question six
 *      times, changing only WHO is harmed (buffered / unbuffered) and HOW MANY (small / medium /
 *      large). Someone who accepted $10,000 for a buffered group but needed $10 million for an
 *      unbuffered one has stated a rate: a hundred times more money before they will do it to
 *      people who cannot absorb it. Both numbers were already on screen; they had simply never
 *      been read side by side.
 *
 *   3. TOLERANCE = the ladder's own resolution at the participant's threshold. They refused at one
 *      rung and accepted at the next, so any difference narrower than that interval is a
 *      difference they never actually discriminated.
 *
 * WHAT COULD NOT BE DERIVED, AND WHAT WAS DONE ABOUT IT
 * ----------------------------------------------------
 * Nothing anywhere in Blocks 1–4 asks whether SPEED matters more than REVERSIBILITY. There is no
 * source for performance weights. Rather than default them to 0.2 each, performance was removed
 * from the ordering entirely — see block5Planner.ts. The five metrics remain on the card as
 * information; they never move an option up or down.
 *
 * HONESTY NOTE FOR THE METHODS SECTION
 * ------------------------------------
 * A rung index IS the participant's answer. Calling a rung DIFFERENCE an "exchange rate", and
 * mapping it to a multiplier, is an INTERPRETATION this module makes. That is far stronger than a
 * default — it is anchored to a real response — but it is not free of theory, and it must be
 * reported as a reading rather than as raw data. Every such mapping is marked READING below.
 *
 * See docs/BLOCK5_PLANNER_ORDERING_PLAN.md §4b.
 */

import { POLICY_DIM_KEYS } from "./block5Types";
import type { Block5PolicyDimKey, Block5UserProfile } from "./block5Types";
import type { MoralProfile } from "./profileAnalysis";

/* ------------------------------------------------------------------------- *
 * Ladder geometry — read from the instruments, not chosen here.
 * ------------------------------------------------------------------------- */

/**
 * Rungs per ladder. These are properties of the FROZEN Blocks 1–3 instruments, restated here so
 * the derivation can normalise a rung index without importing UI modules.
 *
 *   Block 1  AMOUNT_VALUES        8 rungs, $0.25 … $10,000, x3 contexts
 *   Block 2  SAVED_LIVES_OPTIONS  8 rungs, 1 … 10,000 lives, x2 phases
 *   Block 3  GAIN_OPTIONS         6 rungs, $1 … $100,000,000, x6 cells
 *
 * In all three, an index EQUAL TO the rung count is the stored sentinel for "refused every rung".
 * That sentinel is the whole basis of the red-line derivation below.
 */
export const LADDER_RUNGS = { money: 8, trolley: 8, gain: 6 } as const;

/** The Block 3 cell keys, as they appear in `MoralProfile.aiWorkforceIndices`. */
const AI_CELLS = {
  lowBuffer: ["threshold_lowbuffer_small", "threshold_lowbuffer_medium", "threshold_lowbuffer_large"],
  highBuffer: ["threshold_highbuffer_small", "threshold_highbuffer_medium", "threshold_highbuffer_large"],
  small: ["threshold_lowbuffer_small", "threshold_highbuffer_small"],
  large: ["threshold_lowbuffer_large", "threshold_highbuffer_large"],
} as const;

/* ------------------------------------------------------------------------- *
 * The derived contract
 * ------------------------------------------------------------------------- */

/**
 * One value's derived decision parameters.
 *
 * All three are expressed in NORMALISED scenario units [0,1], because that is the space the
 * planner compares options in. A ladder answer is ordinal (rung 3 of 6); normalising it to 0.5 is
 * the only way to put "how strict this person is" on the same ruler as "how much this option
 * delivers, relative to what this scenario offers".
 */
export interface ValueThreshold {
  /**
   * TRUE only when the participant refused at every rung of the ladder that measures this value.
   * This is the red line, and it is the participant's own refusal, not a modelled cut-off.
   */
  hasRedLine: boolean;
  /**
   * How far up the ladder their threshold sat, 0–1. 0 = accepted at the very first rung
   * (undemanding); 1 = never accepted (maximally demanding). Used for the soft Bin-B floor.
   */
  strictness: number;
  /**
   * The width of the ladder interval their threshold sits in, as a fraction of the ladder.
   * READING: treated as the smallest difference on this value they demonstrably discriminated.
   */
  tolerance: number;
  /**
   * How many extra rungs they demanded when the target got harder (more vulnerable / larger /
   * more direct). READING: mapped to a multiplier as `1 + rungGap`, so a gap of 0 means "no extra
   * demand" (multiplier 1) and each additional rung — roughly a factor of ten in the instrument —
   * adds one to the multiplier. Monotone and bounded; never tuned to produce a desired ordering.
   */
  exchange: number;
  /** Plain-English provenance, for the methods write-up and the debug panel. */
  source: string;
}

/** Everything the planner needs about one participant. Produced once, before the first scenario. */
export interface DecisionProfile {
  /** The four policy values, rank 1 first. Taken directly from Blocks 1–4; not re-derived. */
  order: Block5PolicyDimKey[];
  thresholds: Record<Block5PolicyDimKey, ValueThreshold>;
  /** True when Blocks 1–3 data was missing and a neutral fallback was used (see deriveDecisionProfile). */
  degraded: boolean;
}

/* ------------------------------------------------------------------------- *
 * Derivation helpers
 * ------------------------------------------------------------------------- */

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** True when every named Block 3 cell is at or past the refusal sentinel. */
function allRefused(indices: Partial<Record<string, number>>, keys: readonly string[]): boolean {
  const vals = keys.map((k) => indices[k]).filter((v): v is number => Number.isFinite(v));
  return vals.length > 0 && vals.every((v) => v >= LADDER_RUNGS.gain);
}

/**
 * The rung gap between two conditions of the SAME Block 3 question — the exchange rate.
 * Positive means they demanded more when the target got harder. Negative gaps are clamped to 0:
 * demanding LESS to harm vulnerable people is not a negative exchange rate, it is noise or a
 * response set, and it must not be allowed to invert the tree's branch.
 */
function rungGap(harder: number | undefined, easier: number | undefined): number {
  if (harder === undefined || easier === undefined) return 0;
  return Math.max(0, harder - easier);
}

/**
 * Tolerance from an interval width in rungs.
 *
 * Blocks 1 and 2 walk one rung at a time, so their interval is a single step and tolerance is the
 * instrument's resolution — 1/8. Block 3 carries a start index forward between cells, so a cell
 * can be entered part-way up the ladder and the interval is genuinely per-participant.
 */
function toleranceFromInterval(widthInRungs: number, rungs: number): number {
  return clamp01(Math.max(1, widthInRungs) / rungs);
}

/* ------------------------------------------------------------------------- *
 * The four derivations
 *
 * EVERY STRICTNESS FORMULA BELOW MIRRORS thresholdTree.ts EXACTLY.
 *
 * That is not a stylistic choice, it is a correctness requirement. The planner orders the cards
 * and the alignment score labels them, and both render on the SAME card. If this module read a
 * ladder in the opposite direction to the one Blocks 1-4 use, the planner would rank options in
 * the reverse order to the tier printed beside them, and the contradiction would look like a
 * finding rather than a bug.
 *
 * The two easy mistakes, both made and caught during authoring:
 *
 *   GAIN IS AN INVERTED LEVEL, NOT A DEMAND.  gainB3 = 1 - overallGain / GAIN_STEPS. A LOW bar
 *   means a small gain was enough to move you, so gain responsiveness is HIGH. Someone who
 *   refuses even $100M everywhere scores ZERO on this dimension — they are not "maximally
 *   demanding about gain", they are simply not moved by gain at all.
 *
 *   HELP IS AN INVERTED LEVEL TOO.  aggregationB2 = 1 - avgTrolley / TROLLEY_STEPS. Acting at FEW
 *   lives means a high willingness to trade a small harm for a net-positive result. Never acting
 *   scores ZERO.
 *
 * WHICH FOLLOWS: RED LINES EXIST ON ONLY TWO OF THE FOUR VALUES.
 *
 * Refusing every rung on the "who gets hurt" values (vulnerable, harm) is a refusal to hurt
 * people — a genuine line, drawn by the participant, on screen. Refusing every rung on gain or
 * help is not a line about gain or help: it lands as a ZERO on those dimensions, and its moral
 * content is already carried by the other two. Manufacturing a red line there would invent a
 * limit the participant never drew, which is the one thing this module exists to avoid.
 * ------------------------------------------------------------------------- */

/** The six Block 3 cell indices, defaulting a missing cell to the refusal sentinel, as Block 3 does. */
function aiCells(mp: MoralProfile): Record<string, number> {
  const src = mp.aiWorkforceIndices ?? {};
  const out: Record<string, number> = {};
  for (const key of [...AI_CELLS.lowBuffer, ...AI_CELLS.highBuffer]) {
    const v = src[key];
    out[key] = Number.isFinite(v) ? (v as number) : LADDER_RUNGS.gain;
  }
  return out;
}

const meanOf = (cells: Record<string, number>, keys: readonly string[]): number =>
  keys.reduce((a, k) => a + cells[k], 0) / keys.length;

/**
 * PROTECTING THE VULNERABLE — Block 3's buffer contrast.
 *
 * Mirrors  vulnB3 = max(0, avgLB − avgHB) / GAIN_STEPS.
 *
 * The quantity IS a gap: how many extra rungs of money they demanded before harming a group that
 * cannot absorb the hit. So strictness and exchange here are the same measurement read twice, and
 * that is honest rather than redundant — it is the one place in the whole study where a
 * participant states a price for protection in a currency they can see.
 *
 * RED LINE: refused at every gain, up to $100 million, for the unbuffered group.
 */
function deriveVulnerable(mp: MoralProfile): ValueThreshold {
  const cells = aiCells(mp);
  const avgLB = meanOf(cells, AI_CELLS.lowBuffer);
  const avgHB = meanOf(cells, AI_CELLS.highBuffer);
  const gap = Math.max(0, avgLB - avgHB);
  const refused = mp.refusedAllLowBufferRollouts === true || allRefused(cells, AI_CELLS.lowBuffer);
  return {
    hasRedLine: refused,
    strictness: clamp01(gap / LADDER_RUNGS.gain),
    tolerance: toleranceFromInterval(1, LADDER_RUNGS.gain),
    exchange: 1 + gap,
    source: refused
      ? "Block 3: refused to harm an unbuffered group at every gain, up to $100M"
      : `Block 3: demanded ${gap.toFixed(1)} rungs more before harming an unbuffered group`,
  };
}

/**
 * HOW MANY ARE HARMED — Block 3's group-size slope.
 *
 * Mirrors  groupSizeB3 = max(0, sizeSlope) / GAIN_STEPS,  where sizeSlope is the mean over the two
 * worker groups of (largest cell − smallest cell). A signed slope, not a spread: the note in
 * thresholdTree.ts records that an unsigned range scored a purely random responder 57/100, because
 * being non-negative it rises with any variation at all.
 *
 * RED LINE: refused at every gain when 100,000 workers were affected.
 */
function deriveHarm(mp: MoralProfile): ValueThreshold {
  const cells = aiCells(mp);
  const slopeFor = (grp: "lowBuffer" | "highBuffer") => {
    const keys = AI_CELLS[grp];
    return cells[keys[keys.length - 1]] - cells[keys[0]];
  };
  const sizeSlope = (slopeFor("lowBuffer") + slopeFor("highBuffer")) / 2;
  const gap = Math.max(0, sizeSlope);
  const refused = allRefused(cells, AI_CELLS.large);
  return {
    hasRedLine: refused,
    strictness: clamp01(gap / LADDER_RUNGS.gain),
    tolerance: toleranceFromInterval(1, LADDER_RUNGS.gain),
    exchange: 1 + gap,
    source: refused
      ? "Block 3: refused at every gain when 100,000 workers were affected"
      : `Block 3: demanded ${gap.toFixed(1)} rungs more as the harmed group grew`,
  };
}

/**
 * HOW MUCH IS GAINED — Block 3's grand mean, INVERTED.
 *
 * Mirrors  gainB3 = 1 − overallGain / GAIN_STEPS.  Approving at $1 is the maximum: you were moved
 * by almost nothing. Refusing everywhere scores zero.
 *
 * NO RED LINE, deliberately. A refusal here is the ABSENCE of gain-motivation, not a limit drawn
 * around gain, and its moral content is already carried by vulnerable and harm.
 *
 * EXCHANGE stays inside Block 3: the spread across the six cells (highest cell − lowest cell), i.e.
 * how much the price the participant demanded MOVED depending on who was harmed and how many. A
 * flat participant charges the same everywhere and trades gain away readily; a participant whose
 * price swings four rungs across conditions is holding gain against something and will not.
 *
 * WHY NOT BLOCK 1's SHELTER-VS-STREET PREMIUM, WHICH WAS TRIED FIRST: Block 1's context spread is
 * the SOLE source of `contextSensitivity`, and context is one of the three presentation
 * sensitivities that drive the CVR framing lens — a separate contribution with its own boundary.
 * Borrowing it into the planner would entangle the ordering machinery with the reflection
 * machinery, and any correlation found later between them would be an artefact of this file.
 * `gainResponsivenessSensitivity` is sourced from Block 3 (weight 0.8) and Block 4 (0.2) in
 * thresholdTree.ts, so its trade-off parameter is sourced from Block 3 too, and the two stay
 * independent by construction.
 */
function deriveGain(mp: MoralProfile): ValueThreshold {
  const cells = aiCells(mp);
  const all = [...AI_CELLS.lowBuffer, ...AI_CELLS.highBuffer];
  const overallGain = meanOf(cells, all);
  const values = all.map((k) => cells[k]);
  const spread = Math.max(...values) - Math.min(...values);
  return {
    hasRedLine: false,
    strictness: clamp01(1 - overallGain / LADDER_RUNGS.gain),
    tolerance: toleranceFromInterval(1, LADDER_RUNGS.gain),
    exchange: 1 + spread,
    source:
      `Block 3: approved at rung ${overallGain.toFixed(1)} of ${LADDER_RUNGS.gain} on average ` +
      `(lower = more readily moved by gain); price swung ${spread} rungs across the six conditions`,
  };
}

/**
 * HOW MANY ARE HELPED — Block 2's trolley ladder, INVERTED.
 *
 * Mirrors  aggregationB2 = 1 − avgTrolley / TROLLEY_STEPS,  averaged over lever and bridge.
 * Acting at few lives = high willingness to trade a small harm for a net-positive result.
 *
 * NO RED LINE. Never acting scores zero on this dimension; the refusal itself is about being the
 * DIRECT cause of harm, and Blocks 1–4 already route that to `directnessSensitivity`, which is not
 * one of the four policy values and therefore not the planner's business.
 *
 * EXCHANGE is the bridge-minus-lever gap: the outcome is identical in both phases and only the
 * directness of the act changes, so the extra lives demanded on the bridge is a stated price.
 */
function deriveHelp(mp: MoralProfile): ValueThreshold {
  const half = LADDER_RUNGS.trolley / 2;
  const t = mp.trolleyIndices ?? { lever: half, bridge: half };
  const lever = Number.isFinite(t.lever) ? t.lever : half;
  const bridge = Number.isFinite(t.bridge) ? t.bridge : half;
  const avgTrolley = (lever + bridge) / 2;
  const gap = rungGap(bridge, lever);
  return {
    hasRedLine: false,
    strictness: clamp01(1 - avgTrolley / LADDER_RUNGS.trolley),
    tolerance: toleranceFromInterval(1, LADDER_RUNGS.trolley),
    exchange: 1 + gap,
    source:
      `Block 2: acted at rung ${avgTrolley.toFixed(1)} of ${LADDER_RUNGS.trolley} on average ` +
      `(lower = more willing to act for fewer lives); needed ${gap} rungs more to push than to pull`,
  };
}

/* ------------------------------------------------------------------------- *
 * Entry point
 * ------------------------------------------------------------------------- */

/** A neutral threshold, used only when Blocks 1–3 data is absent (see below). */
function neutralThreshold(reason: string): ValueThreshold {
  return {
    hasRedLine: false,
    strictness: 0.5,
    tolerance: 1 / LADDER_RUNGS.gain,
    exchange: 1,
    source: reason,
  };
}

/**
 * deriveDecisionProfile — the single entry point.
 *
 * `profile` supplies the RANKING of the four values (already computed by Blocks 1–4; not
 * re-derived here). `moralProfile` supplies the ladder answers the thresholds are read from.
 *
 * DEGRADED MODE. If `moralProfile` is missing entirely — which in normal flow cannot happen,
 * because Block 5 is unreachable without completing Blocks 1–4 — every value falls back to a
 * neutral threshold with no red line and no exchange premium, and `degraded` is set. That case is
 * flagged rather than silently equivalent to a real participant, because a planner ordering
 * computed from absent data must never enter the analysis as though it were derived.
 */
export function deriveDecisionProfile(
  profile: Block5UserProfile,
  moralProfile: MoralProfile | null | undefined,
): DecisionProfile {
  const order = [...profile.dimensions]
    .filter((d): d is typeof d & { key: Block5PolicyDimKey } =>
      (POLICY_DIM_KEYS as string[]).includes(d.key))
    .sort((a, b) => a.rank - b.rank)
    .map((d) => d.key);

  if (!moralProfile) {
    const reason = "no Blocks 1-3 record available — neutral fallback, flagged as degraded";
    return {
      order,
      degraded: true,
      thresholds: {
        vulnerabilityProtectionSensitivity: neutralThreshold(reason),
        groupSizeSensitivity: neutralThreshold(reason),
        gainResponsivenessSensitivity: neutralThreshold(reason),
        outcomeAggregationSensitivity: neutralThreshold(reason),
      },
    };
  }

  return {
    order,
    degraded: false,
    thresholds: {
      vulnerabilityProtectionSensitivity: deriveVulnerable(moralProfile),
      groupSizeSensitivity: deriveHarm(moralProfile),
      gainResponsivenessSensitivity: deriveGain(moralProfile),
      outcomeAggregationSensitivity: deriveHelp(moralProfile),
    },
  };
}
