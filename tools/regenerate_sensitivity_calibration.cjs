/**
 * regenerate_sensitivity_calibration.cjs — THE RECIPE for the common ruler (24 September 2026).
 *
 * WHAT THE TABLES ARE FOR. The seven value scores come from very different questions: a money
 * ladder, a lives ladder, a 2x3 workforce grid, a stakeholder story. Some are levels, some are
 * differences between two answers, and their raw numbers are not comparable with each other. The
 * tables in src/experiment/sensitivityCalibrationTables.ts put all seven on one ruler: a score is
 * the share of all the ways a person could answer that this participant's answers exceed on that
 * value. They are what make "your #1 value" mean the same thing for every value.
 *
 * WHY THIS FILE EXISTS. The first tables (23 August 2026) were made by a recipe that was never
 * committed - the procedure file the code pointed to did not exist - so they could not be rebuilt
 * when the formulas changed. This is that recipe, committed, so the tables can always be rebuilt
 * and always checked against the formulas they belong to.
 *
 * THE RECIPE, in words. 200,000 pretend participants, each answering EVERYTHING by chance, with every
 * answer and every button equally likely (the researcher's decision, 24 September 2026):
 *
 *   Block 1  in each of the three places, where they stop is equally likely to be any of the 8 rungs
 *            or "never kept it" (9 outcomes); at every rung they refuse, the refusal button is
 *            equally likely to be return, leave or donate
 *   Block 2  lever and bridge: acted at any of the 8 rungs, or never (9 outcomes each)
 *   Block 3  each of the six cells: approved at any of the 6 rungs, or never (7 outcomes each)
 *   Block 4  initial, middle and final decision: proceed or not, 50/50 each; both confidence
 *            ratings 1-5, equally likely; named an influential voice 50/50, and if so harmed or
 *            benefited 50/50
 *
 * Each pretend participant is scored by the REAL formulas (rawSensitivityScores in thresholdTree.ts,
 * compiled from src). For every value, the table lists each raw score that occurred and the
 * percentage of pretend participants strictly below it. A value that was not measured for a pretend
 * participant (every comparison two refusals) is left out of that value's table.
 *
 * Seeded, so the same code always gives exactly the same tables.
 *
 * Run:  npm run calibration:regenerate   writes the tables file
 *       npm run calibration:check        fails if the committed tables are not what this produces
 *                                        (also run by validate:profile, gate K1)
 */
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");
const TABLES_FILE = path.join(ROOT, "src", "experiment", "sensitivityCalibrationTables.ts");

const DRAWS = 200000;
const SEED = 20260924;
const KEYS = [
  "vulnerability_protection", "group_size", "gain_responsiveness", "outcome_aggregation",
  "directness", "context", "stakeholder_shift",
];

function load() {
  if (!fs.existsSync(BUILD)) {
    console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
    process.exit(1);
  }
  fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
  const B = (f) => require(path.join(BUILD, f));
  return {
    rawSensitivityScores: B("thresholdTree.js").rawSensitivityScores,
    deriveMoralProfile: B("profileAnalysis.js").deriveMoralProfile,
    /* Read only when checking: the very first run has no tables file to read. */
    committed: () => B("sensitivityCalibrationTables.js").GENERATED_NULL_CDF,
  };
}

/** Mulberry32 — small, fast, identical on every machine. */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One pretend participant who answers everything by chance, in the exact shapes the blocks store.
 * Exported so validate:profile can measure fairness on the SAME answer model the tables are built on.
 */
function randomAnswers(rand) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const upTo = (n) => Math.floor(rand() * (n + 1));

  const places = ["sidewalk", "wealthy", "shelter"];
  const history = [];
  const moneyThresholds = {};
  for (const place of places) {
    const stop = upTo(8); // 0-7 = kept at that rung, 8 = never kept
    for (let step = 0; step < stop; step++) {
      history.push({ contextKey: place, action: pick(["return", "leave", "donate"]) });
    }
    moneyThresholds[`threshold_${place}`] = stop >= 8
      ? { contextKey: place, accepted: false, thresholdAmount: null, thresholdLabel: null, thresholdAmountIndex: null, thresholdBeyondRange: true }
      : { contextKey: place, accepted: true, thresholdAmount: 1, thresholdLabel: "x", thresholdAmountIndex: stop, thresholdBeyondRange: false };
  }
  const money = { completed: true, completedAt: "recipe", thresholds: moneyThresholds, history };

  const ladder = () => { const v = upTo(8); return v >= 8 ? { accepted: false, thresholdIndex: null } : { accepted: true, thresholdIndex: v }; };
  const trolley = {
    completed: true, completedAt: "recipe", summary: {}, history: [],
    leverThreshold: { scenarioType: "lever", ...ladder() },
    bridgeThreshold: { scenarioType: "bridge", ...ladder() },
  };

  const cells = {};
  for (const [group, key] of [["low_buffer", "lowbuffer"], ["high_buffer", "highbuffer"]]) {
    for (const size of ["small", "medium", "large"]) {
      const v = upTo(6); // 0-5 = approved at that rung, 6 = never
      cells[`threshold_${key}_${size}`] = {
        groupTypeKey: group, groupSizeKey: size, accepted: v < 6,
        thresholdGainIndex: v < 6 ? v : null, blockedByPriorNonAcceptance: false,
      };
    }
  }
  const ai = { completed: true, completedAt: "recipe", thresholds: cells, history: [] };

  const decision = () => pick(["proceed", "do_not_proceed"]);
  const named = rand() < 0.5;
  const block4 = {
    initialDecision: decision(), midDecision: decision(), finalDecision: decision(),
    confidence: 1 + upTo(4), initialConfidence: 1 + upTo(4),
    reportedInfluence: named, influentialValence: named ? pick(["harmed", "benefited"]) : null,
  };
  return { money, trolley, ai, block4 };
}

/** The tables, built from DRAWS pretend participants. Deterministic. */
function buildTables(mods) {
  const rand = seededRandom(SEED);
  const raws = Object.fromEntries(KEYS.map((k) => [k, []]));
  for (let i = 0; i < DRAWS; i++) {
    const a = randomAnswers(rand);
    const mp = mods.deriveMoralProfile(a.money, a.trolley, a.ai);
    for (const d of mods.rawSensitivityScores(mp, a.ai, a.block4)) {
      if (d.measured) raws[d.key].push(d.raw);
    }
  }
  const tables = {};
  for (const k of KEYS) {
    const sorted = raws[k].sort((x, y) => x - y);
    const n = sorted.length;
    const rows = [];
    let below = 0;
    for (let i = 0; i < n; i++) {
      if (i === 0 || sorted[i] !== sorted[i - 1]) {
        below = i;
        rows.push([sorted[i], Math.round((1000 * below) / n) / 10]);
      }
    }
    tables[k] = rows;
  }
  return tables;
}

function render(tables) {
  const lines = KEYS.map((k) => `  ${k}: ${JSON.stringify(tables[k])},`);
  return [
    "/**",
    " * sensitivityCalibrationTables.ts — GENERATED. Do not edit by hand.",
    " *",
    " * Produced by tools/regenerate_sensitivity_calibration.cjs (npm run calibration:regenerate), which",
    ` * scores ${DRAWS.toLocaleString("en-US")} pretend participants who answer everything by chance (every answer and`,
    ` * every button equally likely, seed ${SEED}) with the real formulas in thresholdTree.ts.`,
    " * Each entry is [raw score, percent of pretend participants strictly below it].",
    " *",
    " * `npm run calibration:check` - part of validate:profile, gate K1 - fails if these ever differ",
    " * from what the recipe produces, so a formula can no longer change without its ruler.",
    " */",
    "",
    `export const CALIBRATION_RECIPE = { draws: ${DRAWS}, seed: ${SEED} } as const;`,
    "",
    "export const GENERATED_NULL_CDF: Record<string, ReadonlyArray<readonly [number, number]>> = {",
    ...lines,
    "};",
    "",
  ].join("\n");
}

/** The first difference between two sets of tables, or null when they are identical. */
function firstDifference(a, b) {
  for (const k of KEYS) {
    const x = JSON.stringify(a[k] ?? null), y = JSON.stringify(b[k] ?? null);
    if (x !== y) return k;
  }
  return null;
}

module.exports = { randomAnswers, buildTables, firstDifference, seededRandom, DRAWS, SEED, KEYS };

if (require.main === module) {
  const mods = load();
  const started = Date.now();
  const tables = buildTables(mods);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (process.argv.includes("--check")) {
    const diff = firstDifference(tables, mods.committed());
    if (diff) {
      console.log(`  [FAIL] K1  the committed tables are NOT what the recipe produces (first difference: ${diff}).`);
      console.log("         A formula changed without its ruler. Run: npm run calibration:regenerate");
      process.exit(1);
    }
    console.log(`  [PASS] K1  the committed tables are exactly what the recipe produces (${DRAWS} draws, ${seconds}s)`);
  } else {
    fs.writeFileSync(TABLES_FILE, render(tables));
    console.log(`  wrote ${path.relative(ROOT, TABLES_FILE)} from ${DRAWS} draws in ${seconds}s`);
  }
}
