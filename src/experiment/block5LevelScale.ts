/**
 * block5LevelScale.ts — the level bar under each major score on the results page (since 4 October 2026).
 *
 * WHY IT EXISTS. The researcher (4 October 2026): a VCI of 57 sat above the bar's "random = 50" mark and still read
 * "Low" - "how it above 50 and it says low!!? so we need to show that why it is low" - and a participant does not know
 * what a random chooser is. So the random mark is gone, and each score's thin bar is now its LEVEL SCALE: the 0-100
 * line cut into the score's own levels, each in its traffic-light color (his "Q1-B": green for high, yellow in the
 * middle, orange and red for low), the participant's level lit and the others faint, a marker at their number, and a
 * caption that names the band ("Low = 50-64") - which is the answer to "why is 57 low".
 *
 * THE EDGES ARE THE CODE'S OWN, NEVER TYPED HERE. Every band is built from the list the level word itself comes from:
 * VCI_LEVELS (consistencyLevel, block5CVR.ts), VCI_ALL_LEVELS (block5VciAll.ts), COMBINED_STABILITY_EDGES
 * (stabilityLevel, block5CVR.ts; Stability and Stability_all share it) and CAPTURED_LEVELS (capturedLabel,
 * block5Performance.ts). Every score is a whole number, so a band's range is exact: it starts at its edge rounded up
 * and ends one below the next level's edge. `npm run validate:journey` J15 checks, for every whole number 0-100, that
 * the band drawn has the same word the score's own level function gives.
 *
 * Pure: no React, no storage. Presentation only - nothing here feeds a calculation.
 */

import { COMBINED_STABILITY_EDGES, VCI_LEVELS } from "./block5CVR";
import { VCI_ALL_LEVELS } from "./block5VciAll";
import { CAPTURED_LEVELS } from "./block5Performance";

export type ScoreScale = "vci" | "vciAll" | "stability" | "performance";

/** One traffic-light color: the fill, and the text that reads on it. */
export interface LevelTone {
  name: string;
  bg: string;
  fg: string;
}

/**
 * The traffic light, best level first. Solid fills, each with a text color that stays readable on it in both color
 * modes (white on the dark green, orange and reds; a dark ink on lime and yellow): every pair reaches the 4.5 : 1
 * contrast WCAG asks of normal text, which J15 measures (the orange was #ea580c, 3.6 : 1, until that check). A
 * five-level scale uses the first five; VCI's six levels use all six.
 */
export const TRAFFIC_LIGHT: ReadonlyArray<LevelTone> = [
  { name: "green", bg: "#15803d", fg: "#ffffff" },
  { name: "lime", bg: "#84cc16", fg: "#1a2e05" },
  { name: "yellow", bg: "#facc15", fg: "#422006" },
  { name: "orange", bg: "#c2410c", fg: "#ffffff" },
  { name: "red", bg: "#dc2626", fg: "#ffffff" },
  { name: "deep red", bg: "#991b1b", fg: "#ffffff" },
];

export interface LevelBand {
  label: string;
  /** The lowest and highest whole score in this level. */
  lo: number;
  hi: number;
  tone: LevelTone;
}

const LEVELS: Record<ScoreScale, ReadonlyArray<{ label: string; from: number }>> = {
  vci: VCI_LEVELS,
  vciAll: VCI_ALL_LEVELS,
  stability: COMBINED_STABILITY_EDGES,
  performance: CAPTURED_LEVELS,
};

/** A score's levels, LOWEST FIRST (the bar runs from 0 on the left to 100 on the right). */
export function levelBands(scale: ScoreScale): LevelBand[] {
  const levels = LEVELS[scale];
  const bands = levels.map((l, i) => ({
    label: l.label,
    lo: Number.isFinite(l.from) ? Math.max(0, Math.ceil(l.from)) : 0,
    hi: i === 0 ? 100 : Math.ceil(levels[i - 1].from) - 1,
    tone: TRAFFIC_LIGHT[i],
  }));
  return bands.reverse();
}

/**
 * The band a score sits in. The stored level word wins when a band carries it (it is what the badge prints); the two
 * always agree for a score made by today's rules, which J15 checks.
 */
export function levelOf(scale: ScoreScale, value: number, storedLabel?: string): { bands: LevelBand[]; index: number } {
  const bands = levelBands(scale);
  const byLabel = storedLabel ? bands.findIndex((b) => b.label === storedLabel) : -1;
  const v = Math.round(value);
  const byValue = bands.findIndex((b) => v >= b.lo && v <= b.hi);
  return { bands, index: byLabel >= 0 ? byLabel : Math.max(0, byValue) };
}

/**
 * The caption under the bar: this level's range, and where the next level up begins (or that this is the top). The
 * badge above already names the level, so the caption does not repeat it - which keeps it to one short line.
 */
export function levelCaption(bands: LevelBand[], index: number): string {
  const band = bands[index];
  const next = bands[index + 1];
  return next
    ? `This level: ${band.lo}–${band.hi} · next at ${next.lo}`
    : `This level: ${band.lo}–${band.hi} · top level`;
}
