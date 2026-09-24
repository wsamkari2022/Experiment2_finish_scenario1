/**
 * block5MCF.ts — the Moral Commitment Function.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT ANSWERS, FOR ONE OPTION IN ONE SCENARIO
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *   · which of the participant's four values this option SERVES beyond what they asked for
 *   · which ones it GIVES UP, and how much that costs them
 *   · which other option on this table serves each value most, and by how much
 *   · what taking that other option would cost them elsewhere — the commitment in the name
 *
 * STAGE 1 IS ARITHMETIC ONLY. Nothing here renders, nothing here is stored, and nothing here
 * produces a sentence a participant reads. It produces the numbers and one neutral direction word
 * per value; the wording and the panel come later, on top of a calculation that is already
 * settled. See `npm run validate:mcf`.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * IT IS A DECOMPOSITION, NOT A SECOND OPINION
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * The study already scores an option against a participant as a single shortfall:
 *
 *     shortfall(o) = Σ over the four values of  (u / 100) × max(0, u − f(o, v))
 *
 * where u is how much the participant holds that value and f is what the option delivers on it.
 * `policyShortfallByValue` in block5CVR.ts already breaks that sum into its four parts, and this
 * file CALLS it rather than repeating the formula. So MCF cannot disagree with the alignment
 * label: it is the same number, read one value at a time. Gate M1 proves the four parts still sum
 * to the whole.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT SURPLUS IS NOT
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * An option can deliver MORE on a value than the participant asked for. The study's rule does not
 * reward that: only falling short is ever charged. `surplus` is therefore reported as what it is —
 * more than they asked for on that value — and never added to anything. Presenting it as credit
 * would describe a scoring rule this study does not have.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * TWO KINDS OF FACT, DELIBERATELY KEPT APART
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * `youAndThisOption` compares the option to the PARTICIPANT, and changes from person to person.
 * `servedMostHere` compares the options to EACH OTHER, and is the same for everybody who meets
 * this scenario. Keeping them in separate fields means a later display can show the second
 * without the first, which is the cheapest way to answer a reviewer who asks what the participant
 * was told about themselves.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHICH PROFILE
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * The profile passed in is the LIVE one — the same profile the alignment label uses, which moves
 * as the block proceeds. Two participants meeting the same option in scenario 4 can therefore get
 * different MCF numbers, and the same participant would get different numbers in scenario 2 and
 * scenario 4. That is intended: MCF describes the distance between this option and the person as
 * they stand now. An analyst reading stored MCF must not treat it as a property of the option.
 */

import {
  POLICY_DIM_KEYS,
  type Block5PolicyDimKey,
  type Block5Scenario,
  type Block5ScenarioOption,
  type Block5UserProfile,
} from "./block5Types";
import { policyShortfallByValue } from "./block5CVR";

/**
 * Stamped on every stored MCF record.
 *
 * Move it whenever the arithmetic below changes, for the same reason `PREDICTION_VERSION` exists:
 * records made under two different rules must never be pooled, and the only way to know which
 * rule produced a row is for the row to say so.
 */
export const MCF_VERSION = "2026-09-23-a";

/**
 * How far the option sits from the participant on one value, in words a later display can use
 * without inventing its own thresholds.
 *
 * NONE OF THESE IS A VERDICT. They describe a distance on one value, not a fit, and there is
 * deliberately no word here for "good", "bad", "aligned" or "recommended". Gate M5 checks that the
 * vocabulary stays this short.
 *
 * The bands are in points of the 0-100 value scale, and 10 is the smallest difference the study
 * treats as real anywhere else (the authoring gates keep option values at least that far apart on
 * the value each one champions).
 */
export type McfDirection = "well_above" | "above" | "close" | "below" | "well_below";

const BAND = 10;
const WIDE_BAND = 25;

function directionOf(gap: number): McfDirection {
  if (gap >= WIDE_BAND) return "well_above";
  if (gap >= BAND) return "above";
  if (gap <= -WIDE_BAND) return "well_below";
  if (gap <= -BAND) return "below";
  return "close";
}

/** One value, read three ways: against the participant, against the menu, and what it would cost. */
export interface McfValueLine {
  value: Block5PolicyDimKey;
  /** What the participant holds this value at, 0-100. */
  youHold: number;
  /** What this option delivers on it, 0-100. */
  thisOptionDelivers: number;
  /** delivers − holds. Positive means more than they asked for. */
  gap: number;
  direction: McfDirection;
  /** (u/100) × max(0, u − f): what falling short here costs, in the study's own units. 0 when it
   *  does not fall short. Taken from policyShortfallByValue, never recomputed. */
  costOfFallingShort: number;
  /** max(0, f − u). Reported, never scored. */
  surplus: number;

  /* ---- the same value, compared across the options on this table ---- */
  /** The option on this table that delivers most on this value. */
  servedMostHere: string;
  servedMostHereDelivers: number;
  /** How much more that option delivers than this one. 0 when this IS the strongest here. */
  headroomHere: number;
  /** True when this option is the strongest on this value among the options offered. */
  thisOptionIsStrongestHere: boolean;
}

/** What it would cost to honor one value instead — the commitment the name refers to. */
export interface McfSwap {
  value: Block5PolicyDimKey;
  /** The option to take instead, or null when nothing on this table clears the participant here. */
  optionId: string | null;
  /** True when that option clears what the participant holds on this value. */
  clearsWhatYouHold: boolean;
  /** Total weighted shortfall of the swap option, against this option's. Positive = costs more. */
  costsMoreElsewhere: number;
  /** Which values the swap gives up that this option did not. */
  givesUpInstead: Block5PolicyDimKey[];
}

export interface McfOption {
  optionId: string;
  /** Σ of costOfFallingShort — identical to policyAlignmentShortfall for this option. */
  totalCostOfFallingShort: number;
  lines: McfValueLine[];
  /** The value this option costs the participant most. Null when it falls short nowhere. */
  costliestValue: Block5PolicyDimKey | null;
  /** The value it serves furthest beyond what they asked for. Null when it never exceeds. */
  mostGenerousValue: Block5PolicyDimKey | null;
  swaps: McfSwap[];
}

export interface McfScenario {
  scenarioId: string;
  version: string;
  options: McfOption[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function holdsOf(profile: Block5UserProfile): Record<Block5PolicyDimKey, number> {
  const out = {} as Record<Block5PolicyDimKey, number>;
  for (const key of POLICY_DIM_KEYS) {
    const dim = profile.dimensions.find((d) => d.key === key);
    out[key] = typeof dim?.score === "number" ? dim.score : 50;
  }
  return out;
}

/** Total weighted shortfall of an option — the sum MCF decomposes. */
function totalShortfall(option: Block5ScenarioOption, profile: Block5UserProfile): number {
  const by = policyShortfallByValue(option, profile);
  return POLICY_DIM_KEYS.reduce((sum, k) => sum + by[k], 0);
}

/**
 * Every option in this scenario, read against this participant.
 *
 * Deterministic: the same scenario and the same profile give a byte-identical result. Ties are
 * broken by the option's position in the scenario, which is data rather than a preference — and
 * never by id, which is alphabetical and would quietly favour options by name.
 */
export function mcfForScenario(
  scenario: Block5Scenario,
  profile: Block5UserProfile,
): McfScenario {
  const holds = holdsOf(profile);
  const options = scenario.options;

  /* Menu-relative first, because it does not depend on the participant at all. */
  const strongestOn = {} as Record<Block5PolicyDimKey, { id: string; delivers: number }>;
  for (const key of POLICY_DIM_KEYS) {
    let best = options[0];
    for (const o of options) {
      if (o.fingerprint[key] > best.fingerprint[key]) best = o;   // strict: first one wins a tie
    }
    strongestOn[key] = { id: best.id, delivers: best.fingerprint[key] };
  }

  const shortfalls = new Map<string, Record<Block5PolicyDimKey, number>>();
  const totals = new Map<string, number>();
  for (const o of options) {
    shortfalls.set(o.id, policyShortfallByValue(o, profile));
    totals.set(o.id, totalShortfall(o, profile));
  }

  const built = options.map((option) => {
    const by = shortfalls.get(option.id) as Record<Block5PolicyDimKey, number>;
    const mine = totals.get(option.id) ?? 0;

    const lines: McfValueLine[] = POLICY_DIM_KEYS.map((key) => {
      const youHold = holds[key];
      const delivers = option.fingerprint[key];
      const strongest = strongestOn[key];
      return {
        value: key,
        youHold,
        thisOptionDelivers: delivers,
        gap: round1(delivers - youHold),
        direction: directionOf(delivers - youHold),
        costOfFallingShort: round1(by[key]),
        surplus: round1(Math.max(0, delivers - youHold)),
        servedMostHere: strongest.id,
        servedMostHereDelivers: strongest.delivers,
        headroomHere: round1(Math.max(0, strongest.delivers - delivers)),
        thisOptionIsStrongestHere: strongest.id === option.id,
      };
    });

    /*
     * THE SWAP, FOR EVERY VALUE THIS OPTION FALLS SHORT ON.
     *
     * Among the options that clear what the participant holds on that value, take the one whose
     * OWN total shortfall is smallest — the cheapest way to honor this value. When nothing on the
     * table clears it, fall back to whichever delivers most and say plainly that it still falls
     * short, because "nothing here protects this" is itself the answer to the question.
     */
    const swaps: McfSwap[] = POLICY_DIM_KEYS.filter((key) => by[key] > 0).map((key) => {
      const clearing = options.filter(
        (o) => o.id !== option.id && o.fingerprint[key] >= holds[key],
      );
      const pool = clearing.length
        ? clearing
        : options.filter((o) => o.id !== option.id);
      if (!pool.length) {
        return {
          value: key, optionId: null, clearsWhatYouHold: false,
          costsMoreElsewhere: 0, givesUpInstead: [],
        };
      }
      let pick = pool[0];
      for (const o of pool) {
        const better = clearing.length
          ? (totals.get(o.id) ?? 0) < (totals.get(pick.id) ?? 0)
          : o.fingerprint[key] > pick.fingerprint[key];
        if (better) pick = o;
      }
      const theirs = shortfalls.get(pick.id) as Record<Block5PolicyDimKey, number>;
      return {
        value: key,
        optionId: pick.id,
        clearsWhatYouHold: pick.fingerprint[key] >= holds[key],
        costsMoreElsewhere: round1((totals.get(pick.id) ?? 0) - mine),
        /* What the swap gives up that this option did not — the price of the commitment. */
        givesUpInstead: POLICY_DIM_KEYS.filter((w) => theirs[w] > by[w]),
      };
    });

    const short = POLICY_DIM_KEYS.filter((k) => by[k] > 0);
    const over = POLICY_DIM_KEYS.filter((k) => option.fingerprint[k] > holds[k]);

    return {
      optionId: option.id,
      totalCostOfFallingShort: round1(mine),
      lines,
      costliestValue: short.length
        ? short.reduce((a, b) => (by[b] > by[a] ? b : a))
        : null,
      mostGenerousValue: over.length
        ? over.reduce((a, b) =>
            (option.fingerprint[b] - holds[b] > option.fingerprint[a] - holds[a] ? b : a))
        : null,
      swaps,
    };
  });

  return { scenarioId: scenario.id, version: MCF_VERSION, options: built };
}

/**
 * The same reading, for a caller that holds only the four value scores.
 *
 * The compare overlay has exactly that and no full profile - it is handed the four numbers for the
 * dashed reference shape. Wrapping them here rather than in the component keeps the one place that
 * knows what MCF needs inside the file that computes it.
 */
export function mcfFromScores(
  scenario: Block5Scenario,
  scores: Record<Block5PolicyDimKey, number>,
): McfScenario {
  return mcfForScenario(scenario, {
    generatedAt: "",
    topThreeKeys: [],
    topSensitivityKey: POLICY_DIM_KEYS[0],
    dimensions: POLICY_DIM_KEYS.map((key, i) => ({
      key, label: key, score: scores[key] ?? 50, rank: i + 1, weight: 0, sourceBlocks: [],
    })),
  } as unknown as Block5UserProfile);
}

/** One option, for a caller that has no use for the other five. */
export function mcfForOption(
  scenario: Block5Scenario,
  option: Block5ScenarioOption,
  profile: Block5UserProfile,
): McfOption | null {
  return mcfForScenario(scenario, profile).options.find((o) => o.optionId === option.id) ?? null;
}
