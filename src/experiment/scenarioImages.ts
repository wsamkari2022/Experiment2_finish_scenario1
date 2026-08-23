/**
 * scenarioImages.ts — illustration lookup for the threshold-ladder blocks.
 *
 * WHAT THIS IS FOR
 * Every question in Blocks 1-3 is one rung of an escalating ladder inside one sub-scenario:
 * Block 1 pairs a context (where the money was found) with a dollar amount; Block 2 pairs a
 * phase (lever or bridge) with a number of lives at stake; Block 3 pairs a cell of the worker
 * group x group size matrix with a level of financial gain. When an illustration exists for
 * that exact pair it is shown beside the question, so the participant sees the quantity rather
 * than only reading it, and it changes on every choice that moves the ladder.
 *
 * KEYED BY LADDER VALUE, NOT BY INDEX
 * Each map is keyed by the numeric rung value (0.25, 1, 10 … / 1, 2, 5 …), not by the position
 * of that rung in the ladder. Keying by index would silently mis-pair every image if a rung
 * were ever inserted, removed or reordered — a $10 question showing the $1,000 picture, with
 * nothing to indicate anything was wrong. The value is the stable identity of a rung, so a
 * reordering cannot break the pairing and an unmapped value simply returns null.
 *
 * PARTIAL COVERAGE IS SAFE
 * A context with no entry returns null and its question renders full-width and centred, exactly
 * as it did before illustrations existed. Artwork can therefore be added one context at a time.
 * All three Block 1 contexts are now illustrated.
 *
 * ASSETS
 * Files live in `public/scenario-images/`, mirroring the folder layout of the masters in
 * `scenarios_images/`, and are referenced by absolute URL so Vite serves them as-is. The
 * mirrored names are URL-sanitised: characters outside [A-Za-z0-9._-] become underscores, so
 * the master folder "Block 3 images/100,000_Entry_level" is served as
 * "Block_3_images/100_000_Entry_level". Names that were already safe are unchanged. Always
 * copy the path from `public/scenario-images/` rather than from the masters folder. They are
 * 900 px wide WebP re-encodes: visually identical at display size but ~28x smaller than the
 * masters, which is what makes preloading a whole context practical. Regenerate with:
 *
 *     python tools/optimize_scenario_images.py
 */

/** Base directory for scenario artwork served from `public/`. */
const IMAGE_BASE = "/scenario-images";

/* ----------------------------- BLOCK 1 — Found Money ----------------------------- */

/** Master folders, mirrored under IMAGE_BASE by tools/optimize_scenario_images.py. */
const B1_SIDEWALK = `${IMAGE_BASE}/Block1_Sidewalk_street_scenario_images`;
const B1_WEALTHY = `${IMAGE_BASE}/Block1_Wealthy_district_scenario_images`;
const B1_SHELTER = `${IMAGE_BASE}/Block1_Shelter_scenario_images`;

/**
 * Block 1 artwork, keyed by context key and then by the numeric amount in dollars.
 *
 * The amount keys must match `AMOUNT_VALUES` in constants.ts exactly. `moneyScenarioImage()`
 * returns null for anything not listed here, and `missingMoneyScenarioImages()` reports gaps.
 *
 * UNUSED MASTERS: the wealthy and shelter folders also contain a `_5` illustration, but the
 * amount ladder has no $5 rung (it runs 0.25, 1, 10, 20, 50, 100, 1000, 10000). Those two files
 * are therefore deliberately not mapped — mapping them would have no effect, and adding a $5
 * rung to the ladder is a separate decision because it changes MONEY_STEPS, which normalises
 * every Block 1 score.
 */
export const MONEY_SCENARIO_IMAGES: Record<string, Record<number, string>> = {
  sidewalk: {
    0.25: `${B1_SIDEWALK}/Sidewalk_street_25cent.webp`,
    1: `${B1_SIDEWALK}/Sidewalk_street_1dollar.webp`,
    10: `${B1_SIDEWALK}/Sidewalk_street_10.webp`,
    20: `${B1_SIDEWALK}/Sidewalk_street_20.webp`,
    50: `${B1_SIDEWALK}/Sidewalk_street_50.webp`,
    100: `${B1_SIDEWALK}/Sidewalk_street_100.webp`,
    1000: `${B1_SIDEWALK}/Sidewalk_street_1000.webp`,
    10000: `${B1_SIDEWALK}/Sidewalk_street_10000.webp`,
  },
  wealthy: {
    0.25: `${B1_WEALTHY}/Wealth_district_25cent.webp`,
    1: `${B1_WEALTHY}/Wealth_district_1dollar.webp`,
    10: `${B1_WEALTHY}/Wealth_district_10.webp`,
    20: `${B1_WEALTHY}/Wealth_district_20.webp`,
    50: `${B1_WEALTHY}/Wealth_district_50.webp`,
    100: `${B1_WEALTHY}/Wealth_district_100.webp`,
    1000: `${B1_WEALTHY}/Wealth_district_1000.webp`,
    10000: `${B1_WEALTHY}/Wealth_district_10000.webp`,
  },
  shelter: {
    0.25: `${B1_SHELTER}/Shelter_25cent.webp`,
    1: `${B1_SHELTER}/Shelter_1dollar.webp`,
    10: `${B1_SHELTER}/Shelter_10.webp`,
    20: `${B1_SHELTER}/Shelter_20.webp`,
    50: `${B1_SHELTER}/Shelter_50.webp`,
    100: `${B1_SHELTER}/Shelter_100.webp`,
    1000: `${B1_SHELTER}/Shelter_1000.webp`,
    10000: `${B1_SHELTER}/Shelter_10000.webp`,
  },
};

/**
 * The illustration for one Block 1 question, or null when none exists for that
 * (context, amount) pair. Callers must handle null by laying the question out full-width.
 */
export function moneyScenarioImage(
  contextKey: string,
  amountValue: number,
): string | null {
  return MONEY_SCENARIO_IMAGES[contextKey]?.[amountValue] ?? null;
}

/** Every illustration for one context, in ladder order — used to preload a context up front. */
export function moneyScenarioImagesFor(
  contextKey: string,
  amountValues: readonly number[],
): string[] {
  return amountValues
    .map((v) => moneyScenarioImage(contextKey, v))
    .filter((src): src is string => src !== null);
}

/* ------------------------------ BLOCK 2 — Trolley ------------------------------ */

/**
 * Master folders for Block 2.
 *
 * NOTE the bridge folder name is spelled "Birdge_sceario" in the masters directory. That is
 * reproduced here exactly, because these strings are URLs to real files — do not "correct" the
 * spelling here alone or every bridge illustration will 404. If the folder is ever renamed,
 * rename it in `scenarios_images/`, re-run `tools/optimize_scenario_images.py`, delete the old
 * mirrored folder under `public/scenario-images/`, and update this constant to match.
 */
const B2_LEVER = `${IMAGE_BASE}/Block2_Trolley_lever_scenario_images`;
const B2_BRIDGE = `${IMAGE_BASE}/Block2_Trolley_Birdge_sceario_images`;

/**
 * Block 2 artwork, keyed by phase and then by the number of lives that would be SAVED by
 * acting. The keys must match `SAVED_LIVES_OPTIONS` in trolleyTypes.ts exactly.
 *
 * The lever files are named "<n>vs1" because the lever scene shows n people on the main track
 * against the single person on the branch; the number in the filename is the same n that keys
 * the map, so "lever_scenario_5vs1" is the illustration for the 5-lives rung.
 */
export const TROLLEY_SCENARIO_IMAGES: Record<string, Record<number, string>> = {
  lever: {
    1: `${B2_LEVER}/lever_scenario_1vs1.webp`,
    2: `${B2_LEVER}/lever_scenario_2vs1.webp`,
    5: `${B2_LEVER}/lever_scenario_5vs1.webp`,
    10: `${B2_LEVER}/lever_scenario_10vs1.webp`,
    50: `${B2_LEVER}/lever_scenario_50vs1.webp`,
    100: `${B2_LEVER}/lever_scenario_100vs1.webp`,
    1000: `${B2_LEVER}/lever_scenario_1000vs1.webp`,
    10000: `${B2_LEVER}/lever_scenario_10000vs1.webp`,
  },
  bridge: {
    1: `${B2_BRIDGE}/Bridge_1person.webp`,
    2: `${B2_BRIDGE}/Bridge_2.webp`,
    5: `${B2_BRIDGE}/Bridge_5.webp`,
    10: `${B2_BRIDGE}/Bridge_10.webp`,
    50: `${B2_BRIDGE}/Bridge_50.webp`,
    100: `${B2_BRIDGE}/Bridge_100.webp`,
    1000: `${B2_BRIDGE}/Bridge_1000.webp`,
    10000: `${B2_BRIDGE}/Bridge_10000.webp`,
  },
};

/**
 * Frame shape per Block 2 phase, as width/height.
 *
 * The two phases were drawn to different shapes — the lever scenes are 16:9 (1672x941) and the
 * bridge scenes are 3:2 (~1530x1028) — so a single frame for the whole block would have to crop
 * one of them by about 16%. That is not acceptable here: in both scenes the people being
 * counted run right up to the edge of the frame, and they are the entire point of the picture.
 * Each phase therefore uses its own native shape, which crops essentially nothing (under 1%).
 *
 * The picture is a constant size for every rung WITHIN a phase, which is what keeps the block
 * steady as the participant climbs the ladder. It changes shape once, at the lever-to-bridge
 * handover — which is already a full scenario change, with new artwork, new buttons and a
 * progress bar that restarts.
 */
export const TROLLEY_IMAGE_ASPECT: Record<string, number> = {
  lever: 16 / 9,
  bridge: 3 / 2,
};

/** The illustration for one Block 2 question, or null when the phase has no artwork. */
export function trolleyScenarioImage(
  phase: string,
  savedLives: number,
): string | null {
  return TROLLEY_SCENARIO_IMAGES[phase]?.[savedLives] ?? null;
}

/** Every illustration for one Block 2 phase, in ladder order — used to preload the phase. */
export function trolleyScenarioImagesFor(
  phase: string,
  savedLivesOptions: readonly number[],
): string[] {
  return savedLivesOptions
    .map((v) => trolleyScenarioImage(phase, v))
    .filter((src): src is string => src !== null);
}

/* --------------------------- BLOCK 3 — AI Workforce --------------------------- */

/** Master folder for Block 3, sanitised (the master is "Block 3 images", with spaces). */
const B3 = `${IMAGE_BASE}/Block_3_images`;

/**
 * Block 3 artwork, keyed by worker group, then group size, then the financial gain in dollars.
 *
 * Each illustration shows a fork in the road: the gain on one signpost and the affected group
 * on the other, so a single picture carries the whole trade-off the question is asking about.
 * That is why this map needs all three coordinates — unlike Blocks 1 and 2, the picture is
 * specific to the CELL as well as the rung, which is 36 illustrations in total.
 *
 * KEY NAMING: the internal group keys remain `low_buffer` / `high_buffer` (see the naming note
 * in aiWorkforceTypes.ts), while the artwork is labelled "entry-level" and "senior-level". The
 * mapping is low_buffer -> Entry_level and high_buffer -> Senior_level.
 *
 * FILENAMES are irregular across the six folders — some carry a "worker" segment, some suffix
 * "dollar" and some do not, and the 100,000-senior set used a trailing underscore that the
 * optimiser's sanitiser strips. Every entry is therefore written out explicitly rather than
 * derived from a pattern; a pattern would break silently the moment one file is named
 * differently, and would be far harder to check by eye against the folder listing.
 */
export const AI_WORKFORCE_SCENARIO_IMAGES: Record<
  string,
  Record<string, Record<number, string>>
> = {
  low_buffer: {
    small: {
      1: `${B3}/10_Entry_level/10_Entry_level_worker_1dollar.webp`,
      10_000: `${B3}/10_Entry_level/10_Entry_level_worker_10000.webp`,
      100_000: `${B3}/10_Entry_level/10_Entry_level_worker_100000.webp`,
      1_000_000: `${B3}/10_Entry_level/10_Entry_level_worker_1million.webp`,
      10_000_000: `${B3}/10_Entry_level/10_Entry_level_worker_10million.webp`,
      100_000_000: `${B3}/10_Entry_level/10_Entry_level_worker_100million.webp`,
    },
    medium: {
      1: `${B3}/1000_Entry_level/1000_Entry_level_worker_1dollar.webp`,
      10_000: `${B3}/1000_Entry_level/1000_Entry_level_worker_10000dollar.webp`,
      100_000: `${B3}/1000_Entry_level/1000_Entry_level_worker_100000dollar.webp`,
      1_000_000: `${B3}/1000_Entry_level/1000_Entry_level_worker_1million_dollar.webp`,
      10_000_000: `${B3}/1000_Entry_level/1000_Entry_level_worker_10million_dollar.webp`,
      100_000_000: `${B3}/1000_Entry_level/1000_Entry_level_worker_100million_dollar.webp`,
    },
    large: {
      1: `${B3}/100_000_Entry_level/100k_Entry_level_1dollar.webp`,
      10_000: `${B3}/100_000_Entry_level/100k_Entry_level_10000dollar.webp`,
      100_000: `${B3}/100_000_Entry_level/100k_Entry_level_100000dollar.webp`,
      1_000_000: `${B3}/100_000_Entry_level/100k_Entry_level_1million_dollar.webp`,
      10_000_000: `${B3}/100_000_Entry_level/100k_Entry_level_10million_dollar.webp`,
      100_000_000: `${B3}/100_000_Entry_level/100k_Entry_level_100million_dollar.webp`,
    },
  },
  high_buffer: {
    small: {
      1: `${B3}/10_Senior_level/10_Senior_1dollar.webp`,
      10_000: `${B3}/10_Senior_level/10_Senior_10000dollar.webp`,
      100_000: `${B3}/10_Senior_level/10_Senior_100000dollar.webp`,
      1_000_000: `${B3}/10_Senior_level/10_Senior_1million_dollar.webp`,
      10_000_000: `${B3}/10_Senior_level/10_Senior_10million_dollar.webp`,
      100_000_000: `${B3}/10_Senior_level/10_Senior_100million_dollar.webp`,
    },
    medium: {
      1: `${B3}/1000_Senior_level/1000_Senior_1dollar.webp`,
      10_000: `${B3}/1000_Senior_level/1000_Senior_10000dollar.webp`,
      100_000: `${B3}/1000_Senior_level/1000_Senior_100000dollar.webp`,
      1_000_000: `${B3}/1000_Senior_level/1000_Senior_1million_dollar.webp`,
      10_000_000: `${B3}/1000_Senior_level/1000_Senior_10million_dollar.webp`,
      100_000_000: `${B3}/1000_Senior_level/1000_Senior_100million_dollar.webp`,
    },
    large: {
      1: `${B3}/100_000_Senior_level/100K_Senior_1dollar.webp`,
      10_000: `${B3}/100_000_Senior_level/100K_Senior_10000dollar.webp`,
      100_000: `${B3}/100_000_Senior_level/100K_Senior_100000dollar.webp`,
      1_000_000: `${B3}/100_000_Senior_level/100K_Senior_1million_dollar.webp`,
      10_000_000: `${B3}/100_000_Senior_level/100K_Senior_10million_dollar.webp`,
      100_000_000: `${B3}/100_000_Senior_level/100K_Senior_100million_dollar.webp`,
    },
  },
};

/** The illustration for one Block 3 question, or null when that cell has no artwork. */
export function aiWorkforceScenarioImage(
  groupTypeKey: string,
  groupSizeKey: string,
  gainValue: number,
): string | null {
  return (
    AI_WORKFORCE_SCENARIO_IMAGES[groupTypeKey]?.[groupSizeKey]?.[gainValue] ?? null
  );
}

/** Every illustration for one Block 3 cell, in ladder order — used to preload the cell. */
export function aiWorkforceScenarioImagesFor(
  groupTypeKey: string,
  groupSizeKey: string,
  gainValues: readonly number[],
): string[] {
  return gainValues
    .map((v) => aiWorkforceScenarioImage(groupTypeKey, groupSizeKey, v))
    .filter((src): src is string => src !== null);
}

/* ------------------------------- shared helpers ------------------------------- */

/**
 * Reports (context, amount) pairs that have no artwork, for a context that has SOME artwork.
 * A context with no artwork at all is intentional and is not reported; a context that is
 * half-illustrated almost certainly means a file was renamed or an export was missed, which
 * would otherwise only show up as one blank question mid-block.
 */
export function missingMoneyScenarioImages(
  contextKeys: readonly string[],
  amountValues: readonly number[],
): Array<{ contextKey: string; amountValue: number }> {
  const gaps: Array<{ contextKey: string; amountValue: number }> = [];
  for (const contextKey of contextKeys) {
    const forContext = MONEY_SCENARIO_IMAGES[contextKey];
    if (!forContext || Object.keys(forContext).length === 0) continue;
    for (const amountValue of amountValues) {
      if (!forContext[amountValue]) gaps.push({ contextKey, amountValue });
    }
  }
  return gaps;
}
