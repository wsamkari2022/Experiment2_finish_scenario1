/**
 * simulate_stability.cjs — walks synthetic participants through the REAL Block-5 code and asserts
 * that Stability, and the three sensitivity stabilities, behave the way the Stability section of
 * src/experiment/block5CVR.ts says they do.
 *
 * WHAT IT CHECKS
 * --------------
 *   S1-S7   each kind of participant lands where the method says: best fit every time and second
 *           best every time hold steady, a flip-flopper does not, a thrasher scores below someone
 *           who changed once, a round trip is counted as the path it took
 *   S8      rankSwaps is the Kendall tau distance with a tie at one half
 *   S9      the five levels sit at 100 / 83 / 50 / 17 - one, three and five swaps
 *   S10     only a decider scenario in which the reflection ran can add swaps
 *   S11     each sensitivity's stability is the distance it traveled on its 0-100 scale
 *   A1-A6   the APA clarification moves the profile the way applyApaUpdates promises
 *
 * Imports the compiled modules rather than re-implementing the formulas: a simulator that carries
 * its own copy of the math drifts from the code and then lies.
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
        computeStability, computeSensitivityStability, rankSwaps, stabilityLevel, STABILITY_FULL_REVERSAL } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const STAKE = "stakeholderPerspectiveShiftSensitivity";
const FRAMING = ["directnessSensitivity", "contextSensitivity"];
const ALL = [...POLICY, ...FRAMING, STAKE];

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
const policyOf = (p) => Object.fromEntries(POLICY.map((k) => [k, sc(p, k)]));

/* The same convert as simulate_vci.cjs: a change of heart adopts a VALUE, so scenario 1's pick is
   the first option outside the top two that stands for one value (its strongest value 85 or more),
   not a middle-of-the-road option whose largest number happens to be one value. */
const convertsFirstPick = (r) =>
  r.find((x) => !isFit(x.level) && x.fingerprint[optionMainValue(x)] >= 85)
  ?? r.find((x) => !isFit(x.level)) ?? r[2];

const PICKERS = {
  /* stays on whatever value is currently top */
  Anchored: (r, p) => {
    const top = [...POLICY].sort((x, y) => sc(p, y) - sc(p, x))[0];
    return r.find((o) => optionMainValue(o) === top) ?? r[0];
  },
  Loyal: (r) => r[0],
  /* always the second-best option: every step is a keep step, so Stability must not move */
  "Near-loyal": (r) => r[1],
  /* one honest change of heart in scenario 1, then true to the new value */
  Convert: (r, _p, i, st) => {
    if (i === 0) { const o = convertsFirstPick(r); st.v = optionMainValue(o); return o; }
    return r.find((x) => optionMainValue(x) === st.v) ?? r[0];
  },
  /* away for two scenarios, then back home — the round trip a start-versus-end check cannot see */
  Swinger: (r, p, i, st) => {
    if (i === 0) st.home = [...POLICY].sort((x, y) => sc(p, y) - sc(p, x))[0];
    if (i < 2) return r.find((x) => !isFit(x.level) && optionMainValue(x) !== st.home) ?? r[2];
    return r.find((x) => optionMainValue(x) === st.home) ?? r[0];
  },
  /* takes up a value they have not held before, in every scenario */
  "Flip-flopper": (r, p, _i, st) => {
    st.used = st.used ?? new Set();
    const top = [...POLICY].sort((x, y) => sc(p, y) - sc(p, x))[0];
    const notTop = r.filter((x) => !isFit(x.level) && optionMainValue(x) !== top);
    const fresh = notTop.filter((x) => !st.used.has(optionMainValue(x)));
    const o = fresh[0] ?? notTop[0] ?? r[r.length - 1];
    st.used.add(optionMainValue(o));
    return o;
  },
  /* always the worst fit, endorsed every time */
  Contrarian: (r) => r[r.length - 1],
};

/** Runs one participant and returns stored-result rows shaped exactly as the app stores them. */
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
    const scored = scenarioIsScored(scenario);
    /* MIRRORS commitChoice: the reflection runs only in a decider scenario, on a misaligned choice,
       and a wish or the prediction test never moves the profile. */
    const cvrFired = scored && !isFit(opt.level);
    if (scored) {
      p = isFit(opt.level) ? applyKeepUpdates(p, opt, opt.level, w)
                           : applyEndorsementUpdates(p, opt, true, i % 2 === 0, null, w);
    }
    results.push({
      scenarioId: scenario.id,
      decisionRole: scenario.decisionRole ?? "decider",
      cvrFired,
      policySnapshotAfter: policyOf(p),
      framingSnapshotAfter: { directnessSensitivity: sc(p, "directnessSensitivity"), contextSensitivity: sc(p, "contextSensitivity") },
      stakeholderSnapshotAfter: sc(p, STAKE),
    });
  });
  return {
    s: computeStability(results, original),
    sens: computeSensitivityStability(results, original),
    netSwaps: rankSwaps(policyOf(original), results[results.length - 1].policySnapshotAfter),
  };
}

let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(3)} ${msg}`);
  if (!ok) fails++;
};

console.log("\n=== STABILITY SIMULATION — synthetic participants through the real scoring code ===\n");
console.log("  participant    stability  level                   swaps  conflicts  net swaps | directness  context  stakeholder");
console.log("  " + "-".repeat(112));
const out = {};
Object.keys(PICKERS).forEach((n) => {
  const r = run(n);
  out[n] = r;
  const v = (x) => (x ? String(x.value) : "—").padStart(6);
  console.log("  " + n.padEnd(14) + String(r.s.value).padStart(8) + "   " + r.s.level.padEnd(22) +
    String(r.s.swaps).padStart(6) + String(r.s.conflictSteps).padStart(10) + String(r.netSwaps).padStart(11) +
    " |" + v(r.sens.directness) + "     " + v(r.sens.context) + "      " + v(r.sens.stakeholder));
});

console.log("\n--- gates ---");
gate("S1", out["Loyal"].s.value === 100 && out["Loyal"].s.level === "Held steady",
  `always the best fit holds steady: no conflict, so no swaps  (got ${out["Loyal"].s.value}, "${out["Loyal"].s.level}")`);
gate("S2", out["Anchored"].s.value >= 83,
  `always serving your top value is at least "Mostly steady"  (got ${out["Anchored"].s.value})`);
gate("S3", out["Flip-flopper"].s.value < 50,
  `changing what you value every scenario is not stable  (got ${out["Flip-flopper"].s.value})`);
gate("S4", out["Contrarian"].s.value < out["Convert"].s.value,
  `a thrasher scores below someone who changed once and held  (${out["Contrarian"].s.value} vs ${out["Convert"].s.value})`);
/* S5 — Stability counts the PATH. Going away and coming back swaps priorities on the way out and
   again on the way home, so the round trip must register more swaps than its start and end differ. */
gate("S5", out["Swinger"].s.swaps > out["Swinger"].netSwaps,
  `a round trip counts every swap on the way, not only where it ended  (${out["Swinger"].s.swaps} swaps against ${out["Swinger"].netSwaps} start-to-end)`);
gate("S6", out["Convert"].s.swaps > 0 && out["Loyal"].s.swaps === 0,
  `swaps respond: Convert ${out["Convert"].s.swaps}, Loyal ${out["Loyal"].s.swaps}`);
/* S7 — keeping a fitting option is the model refining its estimate, not the participant changing:
   always choosing the SECOND best moves the profile at every step, and must still score 100. */
gate("S7", out["Near-loyal"].s.value === 100 && out["Near-loyal"].s.conflictSteps === 0,
  `keep steps never count: always the second best scores 100  (got ${out["Near-loyal"].s.value})`);

/* S8 — the swap count itself. */
{
  const k = POLICY;
  const r = (a, b, c, d) => ({ [k[0]]: a, [k[1]]: b, [k[2]]: c, [k[3]]: d });
  const cases = [
    ["identical", r(90, 70, 50, 30), r(90, 70, 50, 30), 0],
    ["one neighboring pair swaps", r(90, 70, 50, 30), r(70, 90, 50, 30), 1],
    ["one value climbs last to first", r(90, 70, 50, 30), r(80, 60, 40, 95), 3],
    ["a complete reversal", r(90, 70, 50, 30), r(30, 50, 70, 90), STABILITY_FULL_REVERSAL],
    ["a tie opens", r(90, 90, 50, 30), r(95, 85, 50, 30), 0.5],
    ["a tie closes", r(90, 70, 50, 30), r(80, 80, 50, 30), 0.5],
    ["float noise is not a tie", r(90, 70, 50, 30), r(90 + 1e-9, 70, 50, 30), 0],
  ];
  const wrong = cases.filter(([, a, b, want]) => rankSwaps(a, b) !== want);
  gate("S8", wrong.length === 0,
    `rankSwaps is the Kendall tau distance, a tie at one half  (${wrong.length ? "wrong: " + wrong.map((c) => c[0]).join("; ") : `${cases.length} of ${cases.length} cases`})`);
}

/* S9 — the levels, at one, three and five swaps. */
{
  const cases = [[100, "Held steady"], [92, "Mostly steady"], [83, "Mostly steady"], [82, "Shifted a little"],
    [50, "Shifted a little"], [49, "Shifted a lot"], [17, "Shifted a lot"], [16, "Changed substantially"],
    [0, "Changed substantially"]];
  const wrong = cases.filter(([v, l]) => stabilityLevel(v) !== l);
  gate("S9", wrong.length === 0,
    `levels at 100 / 83 / 50 / 17  (${wrong.length ? "misplaced: " + wrong.map((c) => c[0]).join(", ") : `${cases.length} of ${cases.length} scores land correctly`})`);
}

/* S10 — only a decider scenario in which the reflection ran can add swaps. A wish that moved (it
   cannot, but a corrupted record might say so) and a keep step that reordered must both be ignored. */
{
  const original = START();
  const reversed = Object.fromEntries(POLICY.map((k, i) => [k, 10 + 20 * i]));
  const rows = [
    { scenarioId: "a", decisionRole: "decider", cvrFired: false, policySnapshotAfter: reversed },
    { scenarioId: "b", decisionRole: "recipient", cvrFired: true, policySnapshotAfter: policyOf(original) },
  ];
  const s = computeStability(rows, original);
  gate("S10", s.swaps === 0 && s.value === 100,
    `a keep step or a wish cannot add swaps, even when the profile moved  (${s.swaps} swaps)`);
}

/* S11 — a sensitivity's stability is the distance it traveled on its own scale. */
{
  const original = START(); // stakeholder 45, directness 50, context 55
  const row = (stake) => ({ scenarioId: "x", decisionRole: "decider", cvrFired: true,
    policySnapshotAfter: policyOf(original),
    framingSnapshotAfter: { directnessSensitivity: 50, contextSensitivity: 55 }, stakeholderSnapshotAfter: stake });
  const sens = computeSensitivityStability([row(70), row(45), row(20)], original); // 25 + 25 + 25 = 75 points
  gate("S11", sens.stakeholder.distance === 75 && sens.stakeholder.value === 25
    && sens.stakeholder.level === "Shifted a lot" && sens.directness.value === 100 && sens.context.value === 100,
    `stakeholder 45 -> 70 -> 45 -> 20 travels 75 points and scores 25; directness and context hold at 100  (${sens.stakeholder.distance}, ${sens.stakeholder.value}, ${sens.directness.value}, ${sens.context.value})`);
}

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
  const PRI = "groupSizeSensitivity";
  const run1 = (conf, pri = PRI) =>
    applyApaUpdates(apaBase, false, pri, null, 1, conf);

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
    const a = applyApaUpdates(apaBase, false, PRI, null, 1, c);
    return POLICY.every((k) => sc(a, k) >= 0 && sc(a, k) <= 100);
  });
  gate("A4", wild, "a bad confidence value cannot produce an invalid profile  (0, -3, 99, NaN, undefined)");

  /*
   * THE GATE THAT MATTERS: the clarification has to be able to change how the NEXT scenario judges
   * you. If naming your priority leaves every later label untouched, the step is decoration.
   *
   * MEASURED OVER MANY PROFILES, NOT ONE. A single fixture is a knife-edge: whether one profile
   * crosses a rank boundary depends on where its four scores happen to sit relative to six option
   * fingerprints, so a one-profile gate measures the fixture. Swept over 3,000 random profiles x 4
   * priorities, the current rule moves a label about 78% of the time; the floor is far below that
   * on purpose, to catch a clarification that has stopped mattering rather than to pin the rule to
   * the exact shape it has today.
   */
  const next = BLOCK5_SCENARIOS[1];
  let aSeed = 20260917;
  const aRnd = () => ((aSeed = (aSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let moved = 0, tried = 0;
  for (let i = 0; i < 500; i++) {
    const rp = mk(Object.fromEntries(POLICY.map((k) => [k, Math.round(aRnd() * 100)])));
    const was = Object.fromEntries(labelOptions(next.options, rp).map((o) => [o.id, o.level]));
    for (const pri of POLICY) {
      tried++;
      const now = applyApaUpdates(rp, false, pri, null, 1, 5);
      if (labelOptions(next.options, now).some((o) => was[o.id] !== o.level)) moved++;
    }
  }
  const movedPct = (100 * moved / tried);
  gate("A5", movedPct >= 50,
    `naming your priority changes how the next scenario labels your options  (${movedPct.toFixed(1)}% of ${tried} clarifications, floor 50%)`);

  /* The stakeholder question is a separate yes/no, so the confidence rating must not touch it. */
  const s1 = applyApaUpdates(apaBase, true, PRI, null, 1, 1);
  const s5 = applyApaUpdates(apaBase, true, PRI, null, 1, 5);
  gate("A6", sc(s1, STAKE) === sc(s5, STAKE),
    `the stakeholder move is not scaled by confidence  (both ${Math.round(sc(s1, STAKE))})`);
}

console.log("\n" + "=".repeat(72));
console.log(fails === 0 ? "### ALL STABILITY GATES PASSED ###" : `### ${fails} STABILITY GATE FAILURE(S) ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails ? 1 : 0);
