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
 *   K  the tables are exactly what the recipe makes  tools/regenerate_sensitivity_calibration.cjs
 *   T  ties are decided by a fair coin               thresholdTree.ts, TIE_RULE
 *   R  a comparison between two refusals is not 0    thresholdTree.ts, NOT_MEASURED_SCORE
 *   H  half a step gets half the credit              thresholdTree.ts, group size
 *   L  directness / context: flagged, fair lens      thresholdTree.ts + block5CVR.ts chooseFraming
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
gate("C4", sameAsBefore,
  `a value whose table already reaches 100 is not stretched at all (${unchanged.length ? unchanged.join(", ") : "none today"})`);

/* ================================================== K. the tables are what the recipe produces */

console.log("\n  K. The calibration tables are exactly what the committed recipe produces");

const recipe = require("./regenerate_sensitivity_calibration.cjs");
{
  const { GENERATED_NULL_CDF } = B("sensitivityCalibrationTables.js");
  const started = Date.now();
  const rebuilt = recipe.buildTables({
    rawSensitivityScores: B("thresholdTree.js").rawSensitivityScores,
    deriveMoralProfile,
  });
  const diff = recipe.firstDifference(rebuilt, GENERATED_NULL_CDF);
  gate("K1", diff === null,
    diff === null
      ? `rebuilt from ${recipe.DRAWS} pretend participants in ${((Date.now() - started) / 1000).toFixed(1)}s: identical`
      : `the committed tables differ from the recipe (first: ${diff}) - a formula changed without its ruler; run npm run calibration:regenerate`);
}

/* ======================================================================= T. ties are fair */

console.log("\n  T. Tied values are ordered by a coin from the participant's own answers");

{
  seed = 424242;
  let twoWayTopTies = 0, wonByListOrder = 0, recordedRight = true, strictlyOrdered = true, anyTies = 0;
  for (let i = 0; i < 20000; i++) {
    const tree = treeOf(randomPattern());
    const dims = tree.dimensions;

    /* T3: what is recorded matches what happened. */
    const groups = [];
    dims.forEach((d, j) => {
      if (j > 0 && dims[j - 1].score === d.score) groups[groups.length - 1].push(d.key);
      else groups.push([d.key]);
    });
    const expected = groups.filter((g) => g.length > 1);
    if (JSON.stringify(expected) !== JSON.stringify(tree.tiedValues ?? [])) recordedRight = false;
    for (const d of dims) {
      const g = expected.find((x) => x.includes(d.key));
      const want = g ? g.filter((k) => k !== d.key) : undefined;
      if (JSON.stringify(want) !== JSON.stringify(d.tiedWith)) recordedRight = false;
    }
    if (expected.length) anyTies++;

    /* T4: scores never go up as the rank goes down. */
    for (let j = 1; j < dims.length; j++) if (dims[j].score > dims[j - 1].score) strictlyOrdered = false;

    /* T1: in a two-way tie for first place, how often does the value the file lists first win? */
    if (dims[0].score === dims[1].score && (dims.length < 3 || dims[2].score !== dims[0].score)) {
      twoWayTopTies++;
      if (KEYS.indexOf(dims[0].key) < KEYS.indexOf(dims[1].key)) wonByListOrder++;
    }
  }
  const share = twoWayTopTies ? wonByListOrder / twoWayTopTies : 0.5;
  gate("T1", twoWayTopTies > 200 && share > 0.4 && share < 0.6,
    `in ${twoWayTopTies} two-way ties for first place, the value listed first in the code won `
    + `${(100 * share).toFixed(1)}% (list order would give 100%; a fair coin about 50%)`);

  const p = randomPattern();
  const a = treeOf(p).dimensions.map((d) => d.key).join(">");
  const b = treeOf(p).dimensions.map((d) => d.key).join(">");
  const nulled = { ...p, block4: { ...p.block4, initialConfidence: null, reportedInfluence: undefined } };
  const blank = { ...p, block4: { ...p.block4, initialConfidence: undefined, reportedInfluence: null } };
  const c = treeOf(nulled).dimensions.map((d) => d.key).join(">");
  const d = treeOf(blank).dimensions.map((d) => d.key).join(">");
  gate("T2", a === b && c === d,
    "the same answers give the same order every time, and a missing Block 4 field gives the same coin whether it is null or undefined");

  gate("T3", recordedRight, `every tie is recorded in tiedValues and tiedWith (${anyTies} of 20000 trees had at least one)`);
  gate("T4", strictlyOrdered, "no value is ever ranked above a value with a higher score");
}

/* ================================================================ R. a refusal is not a zero */

console.log("\n  R. A comparison between two refusals is 'not measured', never 0");

const { NOT_MEASURED_SCORE } = B("thresholdTree.js");
const { extractBlock5Profile } = B("block5Profile.js");
const { deriveDecisionProfile } = B("block5Thresholds.js");
const dim = (tree, key) => tree.dimensions.find((d) => d.key === key);
const rawOf = (d) => Number(/\(raw (\d+)\)/.exec(d.derivation)?.[1]);

/* The formulas as they were before 24 September, for the patterns the rule must leave alone. */
const to100 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100);
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function vulnBefore(p) {
  const b3 = Math.max(0, avg(p.lb) - avg(p.hb)) / 6;
  const don = p.actions.map((a, i) => (a === "donate" && p.money[i] > 0 ? i : -1)).filter((i) => i >= 0);
  const donation = don.includes(2) ? 1 : don.length ? 0.5 : 0;
  const [sw, we, sh] = p.money;
  const b1 = Math.max(0, Math.min(1, Math.max(0, sh - sw) / 8 + 0.2 * Math.max(0, sw - we) / 8 + 0.2 * donation));
  const s = [[b3, 0.55], [b1, 0.30]];
  if (p.block4.reportedInfluence === true && p.block4.influentialValence === "harmed") {
    s.push([p.block4.finalDecision === "do_not_proceed" ? 1 : 0.3, 0.15]);
  }
  return to100(s.reduce((a, [v, w]) => a + v * w, 0) / s.reduce((a, [, w]) => a + w, 0));
}
const harmBefore = (p) => to100(Math.max(0, ((p.lb[2] - p.lb[0]) + (p.hb[2] - p.hb[0])) / 2) / 6);
const doubleRefusal = (p) =>
  p.lb.some((v, i) => v >= 6 && p.hb[i] >= 6)
  || (p.lb[0] >= 6 && p.lb[2] >= 6) || (p.hb[0] >= 6 && p.hb[2] >= 6)
  || (p.money[0] >= 8 && p.money[2] >= 8) || (p.money[0] >= 8 && p.money[1] >= 8);

{
  const refuser = {
    money: [8, 8, 8], actions: ["return", "return", "return"], trolley: [8, 8],
    lb: [6, 6, 6], hb: [6, 6, 6],
  };
  const t = treeOf(refuser);
  const v = dim(t, "vulnerability_protection"), h = dim(t, "group_size");
  gate("R1", v.measured === false && h.measured === false
      && v.score === NOT_MEASURED_SCORE && h.score === NOT_MEASURED_SCORE
      && dim(t, "gain_responsiveness").score === 0 && dim(t, "outcome_aggregation").score === 0,
    `the never-harm refuser scores vulnerable ${v.score} and harm ${h.score} (not measured), `
    + `gain ${dim(t, "gain_responsiveness").score}, helped ${dim(t, "outcome_aggregation").score}; it used to be 0 / 0 / 0 / 0`);

  const r = resultsFrom(refuser);
  const mp = deriveMoralProfile(r.money, r.trolley, r.ai);
  const up = extractBlock5Profile(t);
  const flagged = up.dimensions.filter((d) => d.notMeasured).map((d) => d.key).sort();
  const dp = deriveDecisionProfile(up, mp);
  /* This refuser also never kept the money and never pulled or pushed, so directness and context are
     flagged as well (section L); they score 0, the two policy values 50. */
  gate("R2", JSON.stringify(flagged) === JSON.stringify(["contextSensitivity", "directnessSensitivity",
      "groupSizeSensitivity", "vulnerabilityProtectionSensitivity"])
      && dp.thresholds.vulnerabilityProtectionSensitivity.hasRedLine && dp.thresholds.groupSizeSensitivity.hasRedLine,
    "Block 5 receives the flag on all four unmeasured values, and the planner still sees both red lines");

  seed = 777;
  let checked = 0, same = true, firstDiff = "";
  for (let i = 0; i < 20000; i++) {
    const p = randomPattern();
    if (doubleRefusal(p)) continue;
    checked++;
    const tree = treeOf(p);
    const nv = rawOf(dim(tree, "vulnerability_protection")), nh = rawOf(dim(tree, "group_size"));
    if (nv !== vulnBefore(p) || nh !== harmBefore(p)) {
      same = false;
      if (!firstDiff) firstDiff = `  first difference: ${JSON.stringify(p)}`;
    }
  }
  gate("R3", same && checked > 10000,
    `when nothing was refused twice the two formulas give exactly what they always gave (${checked} random patterns)${firstDiff}`);

  const oneSided = treeOf({ money: [3, 3, 3], actions: ["return", "return", "return"], trolley: [4, 4], lb: [6, 6, 6], hb: [2, 3, 4] });
  gate("R4", /buffer-gap 50% over 3 of 3 sizes/.test(dim(oneSided, "vulnerability_protection").derivation)
      && rawOf(dim(oneSided, "group_size")) === 33,
    "a one-sided refusal counts as the lower bound it is: entry-level never, seniors 2/3/4 gives a gap "
    + "of 3 rungs (50%); the size slope uses the seniors only (2 rungs, raw 33)");

  const partial = treeOf({ money: [3, 3, 3], actions: ["return", "return", "return"], trolley: [4, 4], lb: [2, 6, 6], hb: [1, 6, 6] });
  gate("R5", /over 1 of 3 sizes/.test(dim(partial, "vulnerability_protection").derivation)
      && /over 2 of 2 worker groups/.test(dim(partial, "group_size").derivation),
    "a double refusal drops only its own comparison: sizes medium and large drop out of the gap, both groups keep their slope");
}

/* ============================================ H. half a step gets half the credit of one step */

console.log("\n  H. Reducing harm: half a step gets half the credit of one full step");

{
  const base = { money: [4, 4, 4], actions: ["return", "return", "return"], trolley: [4, 4] };
  const harm = (lb, hb) => dim(treeOf({ ...base, lb, hb }), "group_size").score;
  const a = harm([3, 3, 3], [3, 3, 3]);          // no change anywhere
  const b = harm([3, 3, 4], [3, 3, 3]);          // one click, one step: half a step on average
  const c = harm([3, 3, 4], [3, 3, 4]);          // one full step
  const d = harm([1, 3, 5], [3, 3, 3]);          // two steps
  const oneStep = calibrateSensitivity("group_size", Math.round((1 / 6) * 100));
  const twoSteps = calibrateSensitivity("group_size", Math.round((2 / 6) * 100));
  gate("H1", a === 0 && b === Math.round(0.5 * oneStep) && c === oneStep && d === twoSteps,
    `same answers ${a}, one click (half a step) ${b} = half of one step ${oneStep}, one full step ${c}, two steps ${d}`);
  gate("H2", b > 0 && b < c,
    "the one click still counts, and counts for less than a full step");
}

/* ===================================== L. directness and context: flagged, 0, and a fair lens */

console.log("\n  L. Directness and context: 'never' is flagged (score 0), and a lens tie goes to the coin");

{
  const { chooseFraming } = B("block5CVR.js");
  const neverKeeps = treeOf({ money: [8, 8, 8], actions: ["return", "return", "return"], trolley: [2, 5], lb: [3, 3, 3], hb: [2, 2, 2] });
  const neverActs = treeOf({ money: [2, 4, 7], actions: ["return", "return", "return"], trolley: [8, 8], lb: [3, 3, 3], hb: [2, 2, 2] });
  const partly = treeOf({ money: [8, 8, 3], actions: ["return", "return", "return"], trolley: [8, 3], lb: [3, 3, 3], hb: [2, 2, 2] });
  const c1 = dim(neverKeeps, "context"), d1 = dim(neverKeeps, "directness");
  const d2 = dim(neverActs, "directness"), c2 = dim(neverActs, "context");
  gate("L1", c1.measured === false && c1.score === 0 && d1.measured === true
      && d2.measured === false && d2.score === 0 && c2.measured === true,
    `never kept the money anywhere -> context not measured, score ${c1.score}; never pulled or pushed -> directness not measured, score ${d2.score}`);
  gate("L2", dim(partly, "context").measured === true && rawOf(dim(partly, "context")) === 63
      && dim(partly, "directness").measured === true && rawOf(dim(partly, "directness")) === 63,
    "one real answer among the nevers still measures a spread or a gap, as a lower bound (raw 63 = 5 of 8 rungs)");

  const sara = extractBlock5Profile(treeOf({
    money: [8, 8, 8], actions: ["return", "return", "return"], trolley: [8, 8], lb: [3, 3, 3], hb: [2, 2, 2],
  }));
  const saraScores = ["contextSensitivity", "directnessSensitivity"].map((k) => sara.dimensions.find((x) => x.key === k).score);
  gate("L3", saraScores[0] === 0 && saraScores[1] === 0
      && sara.dimensions.filter((x) => x.notMeasured).map((x) => x.key).sort().join() === "contextSensitivity,directnessSensitivity",
    "'never' in both blocks: context 0 against directness 0, both flagged notMeasured in Block 5");

  seed = 31415;
  let ties = 0, contextWon = 0, differs = 0, higherWon = true;
  /* 100,000 rather than 20,000: a context/directness tie is rare on the rebuilt tables (about 1 in
     350 random patterns), and a fairness check needs a few hundred of them. */
  for (let i = 0; i < 100000; i++) {
    const up = extractBlock5Profile(treeOf(randomPattern()));
    const c = up.dimensions.find((x) => x.key === "contextSensitivity").score;
    const d = up.dimensions.find((x) => x.key === "directnessSensitivity").score;
    const lens = chooseFraming(up);
    if (c === d) { ties++; if (lens === "context") contextWon++; }
    else { differs++; if (lens !== (c > d ? "context" : "directness")) higherWon = false; }
  }
  const share = ties ? contextWon / ties : 0.5;
  gate("L4", higherWon, `when the two differ, the higher one still chooses the lens (${differs} profiles)`);
  gate("L5", ties > 200 && share > 0.4 && share < 0.6,
    `in ${ties} ties the context lens was chosen ${(100 * share).toFixed(1)}% of the time (the old rule gave 100%; a fair coin about 50%)`);
}

/* ------------------------------------------------------------ report: who comes out on top */

/**
 * The calibration's own fairness test (docs/MEASUREMENT_MODEL.md section 7): for somebody answering
 * at random, how often does each value rank first? The ideal is 1 in 7 = 14.3%. Reported, not gated:
 * it is a property of the instrument to be watched, not a rule with a pass mark.
 */
{
  /* The SAME pretend participants the tables are built on (the recipe's own answer model), with a
     different seed so the report is not simply reading back the draws the tables came from. */
  const N = 20000;
  const rand = recipe.seededRandom(777);
  const top = Object.fromEntries(KEYS.map((k) => [k, 0]));
  for (let i = 0; i < N; i++) {
    const a = recipe.randomAnswers(rand);
    top[buildThresholdTree(deriveMoralProfile(a.money, a.trolley, a.ai), a.ai, a.block4).dimensions[0].key]++;
  }
  console.log(`\n  Report: how often each value ranks first for a random responder (ideal 14.3%, n=${N})`);
  for (const k of KEYS) console.log(`      ${k.padEnd(26)} ${(100 * top[k] / N).toFixed(1).padStart(5)}%`);
}

console.log("");
if (failures) {
  console.log(`### ${failures} PROFILE GATE(S) FAILED ###`);
  process.exit(1);
}
console.log("### ALL PROFILE GATES PASSED ###");
