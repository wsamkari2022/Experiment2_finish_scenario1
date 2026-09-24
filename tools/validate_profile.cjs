/**
 * validate_profile.cjs — the gate on the Blocks 1-4 scoring that feeds Block 5.
 *
 * WHY IT EXISTS. Until 24 September 2026 nothing in the check chain ran thresholdTree.ts at all.
 * The four value scores it produces are the planner's input, the alignment score's input and the
 * CVR's input, so an error there moves every Block 5 number while every other gate stays green.
 *
 * It runs the REAL modules, compiled from src by tools/tsconfig.sim.json, over hand-built answer
 * patterns (whose right answer can be worked out on paper) and over uniformly random ones (the same
 * "every way a person could answer" reference the calibration tables are built on).
 *
 * The rules it stands over, each approved by the researcher on 24 September 2026:
 *   C  every value can reach 100                     sensitivityCalibration.ts, calibrateSensitivity
 *
 * Run: npm run validate:profile
 */
const path = require("node:path");
const fs = require("node:fs");

const BUILD = path.join(__dirname, "..", ".sim-build");
if (!fs.existsSync(BUILD)) {
  console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const B = (f) => require(path.join(BUILD, f));

const { buildThresholdTree } = B("thresholdTree.js");
const { deriveMoralProfile } = B("profileAnalysis.js");
const { calibrateSensitivity, calibrationTop, SENSITIVITY_NULL_CDF } = B("sensitivityCalibration.js");

let failures = 0;
function gate(id, ok, detail) {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${id}  ${detail}`);
}

/* ------------------------------------------------------------------ answer patterns -> results */

const SIZES = ["small", "medium", "large"];
const MONEY_NEVER = 8;
const TROLLEY_NEVER = 8;
const GAIN_NEVER = 6;

/**
 * One participant's Blocks 1-4 results, in the exact shapes the blocks store.
 *
 * `money`   [sidewalk, wealthy, shelter]  rung kept at, 0-7, or 8 = never kept
 * `trolley` [lever, bridge]               rung acted at, 0-7, or 8 = never acted
 * `lb`/`hb` Block 3 entry-level / senior cells, small-medium-large, 0-5, or 6 = never approved
 * `actions` the non-keep action per money context (return / leave / donate), for the donation signal
 */
function resultsFrom(p) {
  const ctxKeys = ["sidewalk", "wealthy", "shelter"];
  const history = [];
  ctxKeys.forEach((ctx, i) => {
    const refusedSteps = Math.min(p.money[i], MONEY_NEVER);
    for (let s = 0; s < refusedSteps; s++) {
      history.push({ contextKey: ctx, action: (p.actions && p.actions[i]) || "return", timestamp: "x" });
    }
  });
  const money = {
    completed: true, completedAt: "x", history,
    thresholds: Object.fromEntries(ctxKeys.map((ctx, i) => [`threshold_${ctx}`,
      p.money[i] >= MONEY_NEVER
        ? { contextKey: ctx, accepted: false, thresholdAmount: null, thresholdLabel: null, thresholdAmountIndex: null, thresholdBeyondRange: true }
        : { contextKey: ctx, accepted: true, thresholdAmount: 1, thresholdLabel: "x", thresholdAmountIndex: p.money[i], thresholdBeyondRange: false }])),
  };
  const t = (i) => (i >= TROLLEY_NEVER ? { accepted: false, thresholdIndex: null } : { accepted: true, thresholdIndex: i });
  const trolley = {
    completed: true, completedAt: "x", summary: {}, history: [],
    leverThreshold: { scenarioType: "lever", ...t(p.trolley[0]) },
    bridgeThreshold: { scenarioType: "bridge", ...t(p.trolley[1]) },
  };
  const thresholds = {};
  for (const [group, key, cells] of [["low_buffer", "lowbuffer", p.lb], ["high_buffer", "highbuffer", p.hb]]) {
    SIZES.forEach((size, i) => {
      const v = cells[i];
      thresholds[`threshold_${key}_${size}`] = {
        groupTypeKey: group, groupSizeKey: size, accepted: v < GAIN_NEVER,
        thresholdGainIndex: v < GAIN_NEVER ? v : null, blockedByPriorNonAcceptance: false,
      };
    });
  }
  const ai = { completed: true, completedAt: "x", thresholds, history: [] };
  const block4 = p.block4 ?? {
    initialDecision: "do_not_proceed", midDecision: "do_not_proceed", finalDecision: "do_not_proceed",
    confidence: 3, initialConfidence: 3, reportedInfluence: false, influentialValence: null,
  };
  return { money, trolley, ai, block4 };
}

function treeOf(p) {
  const r = resultsFrom(p);
  const mp = deriveMoralProfile(r.money, r.trolley, r.ai);
  return buildThresholdTree(mp, r.ai, r.block4);
}

/* Seeded, so every run of this file reports the same numbers. Mulberry32. */
let seed = 20260924;
function rand() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (n) => Math.floor(rand() * (n + 1));
const pick = (a) => a[Math.floor(rand() * a.length)];

/** A uniformly random answer pattern over every ladder, the "never" answer included. */
function randomPattern() {
  const decision = () => pick(["proceed", "do_not_proceed"]);
  const influence = rand() < 0.5;
  return {
    money: [ri(8), ri(8), ri(8)],
    actions: [pick(["return", "leave", "donate"]), pick(["return", "leave", "donate"]), pick(["return", "leave", "donate"])],
    trolley: [ri(8), ri(8)],
    lb: [ri(6), ri(6), ri(6)],
    hb: [ri(6), ri(6), ri(6)],
    block4: {
      initialDecision: decision(), midDecision: decision(), finalDecision: decision(),
      confidence: 1 + ri(4), initialConfidence: 1 + ri(4), reportedInfluence: influence,
      influentialValence: influence ? pick(["harmed", "benefited"]) : null,
    },
  };
}

const KEYS = [
  "vulnerability_protection", "group_size", "gain_responsiveness", "outcome_aggregation",
  "directness", "context", "stakeholder_shift",
];

/* ================================================================== C. every value can reach 100 */

console.log("\n  C. Every value can reach 100 (calibrateSensitivity)");

/* The rule before 24 September, kept here as the reference the unchanged values must still match. */
function calibrateBefore(key, raw) {
  const cdf = SENSITIVITY_NULL_CDF[key];
  if (raw <= cdf[0][0]) return 0;
  const last = cdf[cdf.length - 1];
  if (raw >= last[0]) return Math.round(last[1]);
  for (let i = 1; i < cdf.length; i++) {
    const [hiRaw, hiPct] = cdf[i];
    if (raw === hiRaw) return Math.round(hiPct);
    if (raw < hiRaw) {
      const [loRaw, loPct] = cdf[i - 1];
      return Math.round(loPct + ((raw - loRaw) / (hiRaw - loRaw)) * (hiPct - loPct));
    }
  }
  return Math.round(last[1]);
}

gate("C1", KEYS.every((k) => calibrateSensitivity(k, 100) === 100),
  "the strongest possible answer scores exactly 100 on all seven values  ("
  + KEYS.map((k) => `${k} ${calibrateSensitivity(k, 100)}`).join(", ") + ")");

gate("C2", KEYS.every((k) => calibrateSensitivity(k, 0) === 0),
  "a raw zero still maps to zero on all seven");

let monotone = true;
for (const k of KEYS) {
  let prev = -1;
  for (let raw = 0; raw <= 100; raw++) {
    const v = calibrateSensitivity(k, raw);
    if (v < prev) monotone = false;
    prev = v;
  }
}
gate("C3", monotone, "the mapping never reverses the order of two raw scores on the same value");

const unchanged = KEYS.filter((k) => calibrationTop(k) === 100);
let sameAsBefore = true;
for (const k of unchanged) {
  for (let raw = 0; raw <= 100; raw++) if (calibrateSensitivity(k, raw) !== calibrateBefore(k, raw)) sameAsBefore = false;
}
gate("C4", sameAsBefore && unchanged.length === 3,
  `the three values that already reached 100 (${unchanged.join(", ")}) score exactly as before`);

/* ------------------------------------------------------------ report: who comes out on top */

/**
 * The calibration's own fairness test (docs/MEASUREMENT_MODEL.md section 7): for somebody answering
 * at random, how often does each value rank first? The ideal is 1 in 7 = 14.3%. Reported, not gated:
 * it is a property of the instrument to be watched, not a rule with a pass mark.
 */
{
  const N = 20000;
  const top = Object.fromEntries(KEYS.map((k) => [k, 0]));
  for (let i = 0; i < N; i++) top[treeOf(randomPattern()).dimensions[0].key]++;
  console.log(`\n  Report: how often each value ranks first for a random responder (ideal 14.3%, n=${N})`);
  for (const k of KEYS) console.log(`      ${k.padEnd(26)} ${(100 * top[k] / N).toFixed(1).padStart(5)}%`);
}

console.log("");
if (failures) {
  console.log(`### ${failures} PROFILE GATE(S) FAILED ###`);
  process.exit(1);
}
console.log("### ALL PROFILE GATES PASSED ###");
