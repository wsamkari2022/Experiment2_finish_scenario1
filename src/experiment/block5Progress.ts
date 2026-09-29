/**
 * block5Progress.ts — Block 5 continues at the scenario the participant had not finished (since
 * 29 September 2026, the researcher's plan, "Q1-yes").
 *
 * WHY. Block 5 started again at scenario 1 on every page load: the component deleted its progress when it
 * opened (a line from the first version of the study, with no reason written down), and never saved any.
 * A refresh, or a new browser after the email-and-age check, sent the participant back to scenario 1.
 *
 * WHAT IS SAVED, after every finished scenario: the index of the next scenario, every finished scenario's
 * result, the values as they stand now, and the hidden running values. That is everything the next
 * scenario is built from, so it opens with the same cards, the same order and the same fit numbers as if
 * the participant had never left. A scenario left half-done is started again from its beginning; its row
 * says so (`restartedAfterLeaving`).
 *
 * WHOSE IT IS. The file names its owner (the participant's email) and the values they brought into Block 5.
 * It is restored only when both still match, so a second person on the same computer never continues the
 * first person's run, and a run whose Blocks 1-4 answers changed starts Block 5 cleanly.
 *
 * Pure apart from localStorage, which the checks fake (npm run validate:session).
 */

import type { Block5ScenarioResult, Block5UserProfile } from "./block5Types";
import { BLOCK5_PROGRESS_KEY } from "./block5Types";

export interface SavedBlock5Progress {
  version: 1;
  /** The participant's email, lower case; "" when the study runs without one. */
  owner: string;
  /** Every value score the participant brought into Block 5, by key: the file only fits that profile. */
  broughtIn: Record<string, number>;
  /** 1-based count of finished scenarios = the index of the scenario to open next. */
  nextScenarioIndex: number;
  scenarioResults: Block5ScenarioResult[];
  /** The values as they stand after the last finished scenario. */
  profile: Block5UserProfile;
  /** The hidden running values behind VCI_all. */
  runningProfile?: Block5UserProfile;
  savedAt: string;
}

const ownerOf = (email: string | null | undefined) => String(email ?? "").trim().toLowerCase();

/** The scores of a profile by key, so two profiles can be compared exactly. */
export function scoresByKey(profile: Block5UserProfile | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of profile?.dimensions ?? []) out[d.key] = d.score;
  return out;
}

function sameScores(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(a);
  return keys.length > 0 && keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/** Saves the run after a finished scenario. */
export function saveBlock5Progress(input: {
  owner: string | null | undefined;
  broughtIn: Block5UserProfile;
  nextScenarioIndex: number;
  scenarioResults: Block5ScenarioResult[];
  profile: Block5UserProfile;
  runningProfile?: Block5UserProfile;
}): void {
  const saved: SavedBlock5Progress = {
    version: 1,
    owner: ownerOf(input.owner),
    broughtIn: scoresByKey(input.broughtIn),
    nextScenarioIndex: input.nextScenarioIndex,
    scenarioResults: input.scenarioResults,
    profile: input.profile,
    runningProfile: input.runningProfile,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(BLOCK5_PROGRESS_KEY, JSON.stringify(saved));
  } catch { /* storage full or blocked: the run goes on, it just cannot be continued elsewhere */ }
}

/**
 * The saved run, when it belongs to this participant and this profile and still has a scenario left to
 * do; otherwise null (and the block starts at scenario 1, as it always did).
 */
export function readBlock5Progress(
  owner: string | null | undefined, broughtIn: Block5UserProfile, scenarioCount: number,
): SavedBlock5Progress | null {
  let saved: SavedBlock5Progress | null = null;
  try {
    const raw = localStorage.getItem(BLOCK5_PROGRESS_KEY);
    saved = raw ? (JSON.parse(raw) as SavedBlock5Progress) : null;
  } catch {
    return null;
  }
  if (!saved || saved.version !== 1) return null;
  if (saved.owner !== ownerOf(owner)) return null;
  if (!sameScores(saved.broughtIn ?? {}, scoresByKey(broughtIn))) return null;
  const n = saved.nextScenarioIndex;
  if (!Number.isInteger(n) || n < 1 || n >= scenarioCount) return null;
  if (!Array.isArray(saved.scenarioResults) || saved.scenarioResults.length !== n) return null;
  if (!Array.isArray(saved.profile?.dimensions) || saved.profile.dimensions.length === 0) return null;
  return saved;
}

export function clearBlock5Progress(): void {
  try {
    localStorage.removeItem(BLOCK5_PROGRESS_KEY);
  } catch { /* ignore */ }
}
