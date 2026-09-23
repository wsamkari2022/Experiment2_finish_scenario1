/*
 * planner_vs_weighting.cjs — how often does the FIRST card happen to be the best-fitting option?
 *
 * WHY THIS EXISTS. The question put to the researcher was whether the cards should be ordered by
 * how well each option fits the participant's values — a "weighting planner" — instead of by the
 * trade-off planner the study uses. The objection to it is a number, not an opinion: if the first
 * card is usually the best-fitting card, then "chose the first card" and "chose the option that
 * matched their values" become the same event, and no analysis afterwards can separate them.
 *
 * This measures that number for both designs, over thousands of simulated participants, using the
 * REAL planner and the REAL alignment scorer compiled from src. Nothing here reimplements either.
 *
 * WHAT A SIMULATED PARTICIPANT IS. A random ordering of the four policy values, random scores
 * behind that ordering (so "how much they care" varies, not just the order), and one of the three
 * strictness archetypes the authoring sweep already uses. The random draw is seeded, so the
 * numbers reproduce exactly.
 *
 * THE THREE DESIGNS COMPARED
 *   current   the trade-off planner that ships (block5Planner.ts)
 *   weighted  options ranked by a weighted sum of the four values, weights = the participant's
 *             own value scores. This is the design being proposed.
 *   ranked    the same idea with simpler weights 4/3/2/1 by value rank, in case the advisor means
 *             this rather than the scores.
 *
 * Run:  npm run report:planner
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");

try {
  execFileSync("npx", ["tsc", "-p", "tools/tsconfig.sim.json"], { cwd: ROOT, encoding: "utf8", shell: true });
} catch { /* the sim build reports errors from files this tool does not use */ }
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const B = (f) => require(path.join(BUILD, f));

const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { labelOptions } = B("block5CVR.js");
const { plannerRank } = B("block5Planner.js");
const { POLICY_DIM_KEYS } = B("block5Types.js");

const ALL_KEYS = [...POLICY_DIM_KEYS, "directnessSensitivity", "contextSensitivity",
  "stakeholderPerspectiveShiftSensitivity"];

/* ----------------------------------------------------------------- a seeded, reproducible sample */

const SEED = 20260923;
let seed = SEED;
/** Mulberry32 — small, fast, and identical on every machine, which is what reproducible means. */
function rand() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ARCHETYPES = [
  { name: "lenient", redLines: [], exchange: 1, tolerance: 1 / 8 },
  { name: "moderate", redLines: ["vulnerabilityProtectionSensitivity"], exchange: 2, tolerance: 1 / 6 },
  { name: "strict", redLines: ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity"], exchange: 4, tolerance: 1 / 6 },
];

/**
 * One simulated participant: an ordering of their four values, a score behind each, and how
 * strictly they answered the ladders.
 *
 * The scores are drawn and then sorted onto the ordering, so a participant can care a great deal
 * more about their first value than their second, or barely more. That difference is exactly what
 * a weighting planner would act on, so it has to vary here.
 */
function makeParticipant() {
  const order = shuffled(POLICY_DIM_KEYS);
  const draws = [rand(), rand(), rand(), rand()]
    .map((r) => Math.round(20 + r * 80))
    .sort((a, b) => b - a);
  const scores = {};
  order.forEach((k, i) => { scores[k] = draws[i]; });

  const dimensions = ALL_KEYS.map((key) => {
    const policyRank = order.indexOf(key);
    const rank = policyRank >= 0 ? policyRank + 1 : 5 + ALL_KEYS.indexOf(key) - POLICY_DIM_KEYS.length;
    return { key, label: key, score: scores[key] ?? 50, rank, weight: 1 / 7, sourceBlocks: [] };
  });
  const sorted = [...dimensions].sort((a, b) => a.rank - b.rank);
  const userProfile = {
    generatedAt: "sim", dimensions,
    topThreeKeys: sorted.slice(0, 3).map((d) => d.key),
    topSensitivityKey: sorted[0].key,
  };

  const arch = pick(ARCHETYPES);
  const thresholds = {};
  order.forEach((key, i) => {
    thresholds[key] = {
      hasRedLine: arch.redLines.includes(key),
      strictness: 1 - i * 0.2,
      tolerance: arch.tolerance,
      exchange: arch.exchange,
      source: `synthetic:${arch.name}`,
    };
  });

  return { order, scores, userProfile, decisionProfile: { order, thresholds, degraded: false } };
}

/* -------------------------------------------------------------- the two orderings being compared */

/** The proposed design: highest weighted sum of the four values first. */
function weightedTopId(options, weights) {
  let best = null;
  let bestScore = -Infinity;
  for (const o of options) {
    let s = 0;
    for (const k of POLICY_DIM_KEYS) s += (weights[k] ?? 0) * (o.fingerprint[k] ?? 0);
    if (s > bestScore) { bestScore = s; best = o.id; }
  }
  return best;
}

/* ------------------------------------------------------------------------------------- the run */

const RUNS = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 5000);

const rows = [];
for (const scenario of BLOCK5_SCENARIOS) {
  const options = scenario.options;
  const n = options.length;
  let current = 0, weighted = 0, ranked = 0;

  seed = SEED;   // every scenario sees the same sample of participants
  for (let i = 0; i < RUNS; i++) {
    const p = makeParticipant();
    const fitFirst = labelOptions(options, p.userProfile)[0].id;

    if (plannerRank(scenario, p.decisionProfile).orderedIds[0] === fitFirst) current++;

    if (weightedTopId(options, p.scores) === fitFirst) weighted++;

    const rankWeights = {};
    p.order.forEach((k, idx) => { rankWeights[k] = 4 - idx; });
    if (weightedTopId(options, rankWeights) === fitFirst) ranked++;
  }

  rows.push({
    id: scenario.id,
    options: n,
    chance: Math.round((100 / n) * 10) / 10,
    current: Math.round((current / RUNS) * 1000) / 10,
    weighted: Math.round((weighted / RUNS) * 1000) / 10,
    ranked: Math.round((ranked / RUNS) * 1000) / 10,
  });
}

console.log("");
console.log("==============================================================================");
console.log("  HOW OFTEN IS THE FIRST CARD THE BEST-FITTING OPTION?");
console.log(`  ${RUNS} simulated participants per scenario, seed ${SEED}`);
console.log("==============================================================================");
console.log("");
console.log("  scenario                          opts  by chance   CURRENT   weighted   rank-weighted");
for (const r of rows) {
  console.log("  " + r.id.padEnd(33)
    + String(r.options).padStart(4)
    + (r.chance + "%").padStart(11)
    + (r.current + "%").padStart(10)
    + (r.weighted + "%").padStart(11)
    + (r.ranked + "%").padStart(14));
}

const deciders = rows.filter((r) => r.options === 6);
const mean = (k) => Math.round((deciders.reduce((a, b) => a + b[k], 0) / deciders.length) * 10) / 10;
console.log("");
console.log("  Across the five six-option scenarios:");
console.log(`    by chance alone        ${mean("chance")}%`);
console.log(`    the CURRENT planner    ${mean("current")}%`);
console.log(`    a weighting planner    ${mean("weighted")}%   (weights = the participant's value scores)`);
console.log(`    rank weights 4/3/2/1   ${mean("ranked")}%`);
console.log("");
console.log(`  SCENARIO 1, the number asked for: the first card is the best-fitting option`);
console.log(`  ${rows[0].current}% of the time under the current planner, and ${rows[0].weighted}% under a weighting planner.`);
console.log("");
console.log(JSON.stringify({ seed: SEED, runs: RUNS, rows }, null, 0));
console.log("");
