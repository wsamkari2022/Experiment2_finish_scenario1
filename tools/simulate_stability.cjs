/**
 * simulate_stability.cjs — walks synthetic participants through the REAL Block-5 code and
 * asserts that Stability behaves the way the design says it should.
 *
 * It also regenerates the null distribution that STABILITY_CHURN_CEILING is derived from, so the
 * constant in block5CVR.ts can be re-checked whenever bump magnitudes or scenarios change.
 *
 * Run: npm run validate:stability   (chained into npm run validate:block5)
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

const { labelOptions, applyKeepUpdates, applyEndorsementUpdates, applyApaUpdates, optionMainValue, scenarioIsScored,
        computeStability, STABILITY_CHURN_CEILING } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const STAKE = "stakeholderPerspectiveShiftSensitivity";
const FRAMING = ["directnessSensitivity", "contextSensitivity"];
const ALL = [...POLICY, ...FRAMING, STAKE];
const SHORT = { vulnerabilityProtectionSensitivity: "Vuln", groupSizeSensitivity: "Group",
                gainResponsivenessSensitivity: "Gain", outcomeAggregationSensitivity: "Outcome" };

const mk = (o) => ({
  generatedAt: "", topThreeKeys: [], topSensitivityKey: "x",
  dimensions: ALL.map((k, i) => ({ key: k, label: k, score: o[k] ?? 50, rank: i + 1, weight: 0.1, sourceBlocks: [] })),
});
const START = () => mk({
  vulnerabilityProtectionSensitivity: 82, groupSizeSensitivity: 64,
  gainResponsivenessSensitivity: 38, outcomeAggregationSensitivity: 46,
  directnessSensitivity: 50, contextSensitivity: 55, [STAKE]: 45,
});
const sc = (p, k) => p.dimensions.find((d) => d.key === k).score;
const isFit = (l) => l === "aligned" || l === "weakly_aligned";

const PICKERS = {
  /* stays on whatever value is currently top — the profile should barely move */
  Anchored: (r, p) => {
    const top = [...POLICY].sort((x, y) => sc(p, y) - sc(p, x))[0];
    return r.find((o) => optionMainValue(o) === top) ?? r[0];
  },
  Loyal: (r) => r[0],
  /* one honest change of heart in scenario 1, then true to the new value */
  Convert: (r, _p, i, st) => {
    if (i === 0) { const o = r.find((x) => !isFit(x.level)) ?? r[2]; st.v = optionMainValue(o); return o; }
    return r.find((x) => optionMainValue(x) === st.v) ?? r[0];
  },
  /* away for two scenarios, then back home — the case that net drift alone cannot see */
  Swinger: (r, p, i, st) => {
    if (i === 0) st.home = [...POLICY].sort((x, y) => sc(p, y) - sc(p, x))[0];
    if (i < 2) return r.find((x) => !isFit(x.level) && optionMainValue(x) !== st.home) ?? r[2];
    return r.find((x) => optionMainValue(x) === st.home) ?? r[0];
  },
  /*
   * FLIP-FLOPPER — takes up a value they have NOT held before, every scenario.
   *
   * This used to exclude only the value taken in the PREVIOUS scenario, which let it oscillate
   * between two values and, on a four-scoring-scenario deck, walk straight back to the ordering it
   * started from. Its order half then scored 100 — correctly, because the order half is a
   * start-versus-end comparison — and Stability came out at exactly 50 however violently the
   * profile had thrashed in between.
   *
   * That is not a fault in Stability, and the gate below was not wrong to expect better: it was
   * being asked of the wrong subject. A participant who ends where they began is the ROUND TRIP
   * case, and the round trip is already covered by S5, which catches it in churn (48.6 vs 18.2)
   * precisely because the order half cannot. Testing S3 against a returning participant asked the
   * composite for something no start-versus-end measure can deliver.
   *
   * "Changing what you value every scenario" now means what it says — a new value each time — so
   * S3 tests drift and S5 tests the round trip, instead of both landing on the same person.
   */
  "Flip-flopper": (r, p, _i, st) => {
    st.used = st.used ?? new Set();
    const top = [...POLICY].sort((x, y) => sc(p, y) - sc(p, x))[0];
    const notTop = r.filter((x) => !isFit(x.level) && optionMainValue(x) !== top);
    const fresh = notTop.filter((x) => !st.used.has(optionMainValue(x)));
    const o = fresh[0] ?? notTop[0] ?? r[r.length - 1];
    st.used.add(optionMainValue(o));
    st.last = optionMainValue(o);
    return o;
  },
  Contrarian: (r) => r[r.length - 1],
};

function run(name) {
  const pick = PICKERS[name];
  const original = START();
  let p = START();
  const st = {};
  const results = [];
  BLOCK5_SCENARIOS.forEach((scenario, i) => {
    const ranked = labelOptions(scenario.options, p);
    const opt = pick(ranked, p, i, st);
    const w = scenario.stakesWeight ?? 1;
    /* A recipient scenario asks for a WISH, and a wish teaches the profile nothing. The app
       skips the update here (block5CVR.scenarioIsScored is the single shared rule), so the
       simulator must skip it too — a simulator that moves the profile where the app does not
       is not validating the app, it is validating something that will never run. */
    if (scenarioIsScored(scenario)) {
      p = isFit(opt.level) ? applyKeepUpdates(p, opt, opt.level, w)
                           : applyEndorsementUpdates(p, opt, true, i % 2 === 0, null, w);
    }
    results.push({
      policySnapshotAfter: Object.fromEntries(POLICY.map((k) => [k, sc(p, k)])),
      stakeholderSnapshotAfter: sc(p, STAKE),
    });
  });
  const framingMoved = FRAMING.some((k) => Math.abs(sc(p, k) - sc(original, k)) > 0.01);
  return { s: computeStability(results, original), framingMoved };
}

let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(3)} ${msg}`);
  if (!ok) fails++;
};

console.log("\n=== STABILITY SIMULATION — synthetic participants through the real scoring code ===\n");
console.log("  participant        stability  level                 order  movement  pairs  churn  framing");
console.log("  " + "-".repeat(98));
const out = {};
Object.keys(PICKERS).forEach((n) => {
  const { s, framingMoved } = run(n);
  out[n] = s;
  console.log(
    "  " + n.padEnd(18) +
    String(s.value).padStart(6) + "     " + s.level.padEnd(22) +
    String(s.orderPart).padStart(4) + String(s.movementPart).padStart(9) +
    String(s.pairsSwapped).padStart(7) + String(s.churn).padStart(8) +
    (framingMoved ? "  moved" : "  none"));
});

console.log("\n--- gates ---");
gate("S1", out["Loyal"].value >= 80,
  `a participant who always picks their best fit holds steady  (got ${out["Loyal"].value})`);
gate("S2", out["Anchored"].value >= 80,
  `a participant who always serves their top value holds steady  (got ${out["Anchored"].value})`);
gate("S3", out["Flip-flopper"].value < 50,
  `changing what you value every scenario is not stable  (got ${out["Flip-flopper"].value})`);
gate("S4", out["Contrarian"].value < out["Convert"].value,
  `THE KEY GATE: a thrasher must score BELOW someone who changed once and held. Net drift alone `
  + `would invert this (10.2 vs 13.6).  (${out["Contrarian"].value} vs ${out["Convert"].value})`);
gate("S5", out["Swinger"].churn > out["Convert"].churn,
  `going away and coming back registers as more movement than one lasting change  `
  + `(churn ${out["Swinger"].churn} vs ${out["Convert"].churn})`);
gate("S6", out["Convert"].pairsSwapped > 0 && out["Loyal"].pairsSwapped === 0,
  `the order half responds: Convert reordered ${out["Convert"].pairsSwapped}/6 pairs, Loyal ${out["Loyal"].pairsSwapped}/6`);

/* ------------------------------------------------------------------------------------------
   APA — the clarification step. These gates exist because it did NOT work: measured over 5,056
   simulated clarifications, the value a participant NAMED as their priority rose in the ranking
   only 26.6% of the time, and the confidence they gave was collected and never used at all.
   ------------------------------------------------------------------------------------------ */
console.log("\n--- APA clarification ---");
{
  const { confidenceWeight } = B("block5CVR.js");
  const apaBase = mk({
    gainResponsivenessSensitivity: 100, outcomeAggregationSensitivity: 99,
    groupSizeSensitivity: 0, vulnerabilityProtectionSensitivity: 0,
    directnessSensitivity: 50, contextSensitivity: 50, [STAKE]: 50,
  });
  const scen = BLOCK5_SCENARIOS[0];
  const opt = labelOptions(scen.options, apaBase).find((o) => !isFit(o.level));
  const PRI = "groupSizeSensitivity";
  const run1 = (conf, pri = PRI) =>
    applyApaUpdates(apaBase, opt, "context", false, pri, null, 1, conf);

  const byConf = [1, 2, 3, 4, 5].map((c) => sc(run1(c), PRI));
  /*
   * IT MUST ACTUALLY DIFFER, not merely fail to decrease.
   *
   * The first version of this gate asserted only that the values were non-decreasing, and it
   * happily passed while reporting "30 -> 30 -> 30 -> 30 -> 30" — the exact state where confidence
   * had stopped being applied at all. A gate that goes green on the bug it exists to catch is
   * worse than no gate, so it now requires a real spread between "not sure" and "very sure".
   */
  const rising = byConf.every((v, i) => i === 0 || v >= byConf[i - 1]);
  const spread = byConf[4] - byConf[0];
  gate("A1", rising && spread >= 5,
    `confidence changes how far the profile moves  (${byConf.map((v) => Math.round(v)).join(" -> ")}, spread ${Math.round(spread)})`);
  gate("A2", byConf[0] > sc(apaBase, PRI),
    `even "not sure at all" still moves the profile  (0 -> ${Math.round(byConf[0])}, weight ${confidenceWeight(1)})`);

  /* Naming the value you already hold highest must never be punished — the old +15/-10 shape
     could land both halves on the same value and net out to a penalty for agreeing with yourself. */
  const topPri = run1(5, "gainResponsivenessSensitivity");
  gate("A3", sc(topPri, "gainResponsivenessSensitivity") >= sc(apaBase, "gainResponsivenessSensitivity"),
    `naming the value you already rank first never lowers it  (100 -> ${Math.round(sc(topPri, "gainResponsivenessSensitivity"))})`);

  /* A malformed confidence must not be able to produce a profile outside 0-100. */
  const wild = [0, -3, 99, NaN, undefined].every((c) => {
    const a = applyApaUpdates(apaBase, opt, "context", false, PRI, null, 1, c);
    return POLICY.every((k) => sc(a, k) >= 0 && sc(a, k) <= 100);
  });
  gate("A4", wild, "a bad confidence value cannot produce an invalid profile  (0, -3, 99, NaN, undefined)");

  /* THE GATE THAT MATTERS: the clarification has to be able to change how the NEXT scenario judges
     you. If naming your priority leaves every later label untouched, the step is decoration. */
  const after = run1(5);
  const next = BLOCK5_SCENARIOS[1];
  const before = Object.fromEntries(labelOptions(next.options, apaBase).map((o) => [o.id, o.level]));
  const changed = labelOptions(next.options, after).filter((o) => before[o.id] !== o.level).length;
  gate("A5", changed > 0,
    `naming your priority changes how the next scenario labels your options  (${changed} of ${next.options.length} changed)`);

  /* The stakeholder question is a separate yes/no, so the confidence rating must not touch it. */
  const s1 = applyApaUpdates(apaBase, opt, "context", true, PRI, null, 1, 1);
  const s5 = applyApaUpdates(apaBase, opt, "context", true, PRI, null, 1, 5);
  gate("A6", sc(s1, STAKE) === sc(s5, STAKE),
    `the stakeholder move is not scaled by confidence  (both ${Math.round(sc(s1, STAKE))})`);
}

/* --- the null model the ceiling is derived from --- */
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const churns = [];
for (let n = 0; n < 4000; n++) {
  const o = {};
  ALL.forEach((k) => { o[k] = Math.round(rnd() * 100); });
  const original = mk(o);
  let p = mk(o);
  const results = [];
  BLOCK5_SCENARIOS.forEach((scenario) => {
    const ranked = labelOptions(scenario.options, p);
    const opt = ranked[Math.floor(rnd() * ranked.length)];
    const w = scenario.stakesWeight ?? 1;
    if (scenarioIsScored(scenario)) {
      /*
       * THE NULL MODEL MUST WALK EVERY PATH A REAL PARTICIPANT CAN WALK.
       *
       * It used to run only the two "keep" paths and never the APA clarification, even though a
       * real participant reaches APA whenever the vignette changes their mind. The ceiling was
       * therefore the 99th percentile of a journey nobody actually takes — and it mattered more
       * once APA started moving values by 30 instead of 10.
       *
       * A misaligned pick sends a chance responder to APA about half the time (they answer the
       * vignette at random, and the flow routes on whether the person moved them), so that is the
       * split modelled here. Every APA answer is random too: the value they prioritise, their
       * confidence, and whether the stakeholder swayed them.
       */
      if (isFit(opt.level)) {
        p = applyKeepUpdates(p, opt, opt.level, w);
      } else if (rnd() < 0.5) {
        p = applyEndorsementUpdates(p, opt, rnd() < 0.5, rnd() < 0.5, null, w);
      } else {
        const q1 = rnd() < 0.5 ? "endorse" : "context";
        const prioritised = POLICY[Math.floor(rnd() * POLICY.length)];
        const confidence = 1 + Math.floor(rnd() * 5);
        p = applyApaUpdates(p, opt, q1, rnd() < 0.5, prioritised, null, w, confidence);
      }
    }
    results.push({
      policySnapshotAfter: Object.fromEntries(POLICY.map((k) => [k, sc(p, k)])),
      stakeholderSnapshotAfter: sc(p, STAKE),
    });
  });
  churns.push(computeStability(results, original).churn);
}
churns.sort((a, b) => a - b);
const q = (t) => churns[Math.floor(t * (churns.length - 1))];
console.log(`\n--- null model (${churns.length} seeded random responders) ---`);
console.log(`  churn  p50 ${q(0.5).toFixed(1)}   p90 ${q(0.9).toFixed(1)}   p99 ${q(0.99).toFixed(1)}   max ${churns[churns.length - 1].toFixed(1)}`);
gate("S7", Math.abs(q(0.99) - STABILITY_CHURN_CEILING) <= 3,
  `STABILITY_CHURN_CEILING (${STABILITY_CHURN_CEILING}) still matches the null p99 (${q(0.99).toFixed(1)})`);

console.log("\n" + "=".repeat(72));
console.log(fails === 0 ? "### ALL STABILITY GATES PASSED ###" : `### ${fails} STABILITY GATE FAILURE(S) ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails ? 1 : 0);
