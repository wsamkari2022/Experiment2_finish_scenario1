/**
 * simulate_vci.cjs — walks synthetic participants through the REAL Block-5 scoring code, and checks
 * that VCI and its levels are exactly what the VCI section of src/experiment/block5CVR.ts says.
 *
 * WHAT IT CHECKS
 * --------------
 *   V1-V6   each kind of participant scores where the method says it should (loyal, near-loyal,
 *           flip-flopper, contrarian, convert, hesitant convert)
 *   V7      keeping your best-fit option never lowers the value it is built on
 *   V8      the APA route does not rescue a flip-flopper (choices are judged at entry on every path)
 *   V9      ties in fit are broken by what an option delivers, never by its name
 *   V10     the label weights are the published ones: 1.00 / 0.80 / 0.50 / 0.10 on six options,
 *           1.00 / 0.67 / 0.33 / 0.00 on four
 *   V11     blind picking scores exactly 50, on every menu size
 *   V12     the six levels sit at the published edges: 90 / 80 / 65 / 50 / 30
 *
 * It imports the compiled modules rather than re-implementing the formulas, deliberately — a
 * simulator that carries its own copy of the math drifts from the code and then lies. The two
 * places it has to MIRROR the app (the fit path and the APA path) say so where they do it.
 *
 * Run: npm run validate:vci    (chained into npm run validate:block5)
 */
const path = require("node:path");
const fs = require("node:fs");

/* The project package.json says "type": "module", so tsc's CommonJS output in .sim-build would
   be read as ESM and fail. This marker scopes that folder back to CommonJS. */
const BUILD = path.join(__dirname, "..", ".sim-build");
if (!fs.existsSync(BUILD)) {
  console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));

const B = (f) => require(path.join(BUILD, f));

const { labelOptions, scenarioVciScore, applyKeepUpdates, applyEndorsementUpdates, applyApaUpdates,
        optionMainValue, computeVCI, scenarioIsScored, policyDelivery, labelWeight, rankLabel,
        consistencyLevel, VCI_LEVELS } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

/* How many scenarios VCI averages over, read from the scenarios that ship: only the deciders.
   Scenario 5 asks for a wish and scenario 6 tests the model, so neither enters the average. Gates
   below are expressed against this, so they keep asserting the same property if a scenario is
   added, removed, or changes role. */
const N_SCENARIOS = BLOCK5_SCENARIOS.filter(scenarioIsScored).length;
const N_UNSCORED = BLOCK5_SCENARIOS.length - N_SCENARIOS;

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity",
             "stakeholderPerspectiveShiftSensitivity"];

/** A starting profile with a clear ordering, so "top value" and "second value" are unambiguous. */
function makeProfile(scores) {
  const dims = ALL.map((key, i) => ({
    key, label: key, score: scores[key] ?? 50, rank: i + 1, weight: 0.1, sourceBlocks: [],
  }));
  dims.sort((a, b) => b.score - a.score).forEach((d, i) => { d.rank = i + 1; });
  return {
    generatedAt: new Date().toISOString(),
    dimensions: dims,
    topThreeKeys: [...dims].sort((a, b) => a.rank - b.rank).slice(0, 3).map((d) => d.key),
    topSensitivityKey: [...dims].sort((a, b) => a.rank - b.rank)[0].key,
  };
}
const START = () => makeProfile({
  vulnerabilityProtectionSensitivity: 82,
  groupSizeSensitivity: 64,
  gainResponsivenessSensitivity: 38,
  outcomeAggregationSensitivity: 46,
  directnessSensitivity: 50,
  contextSensitivity: 55,
  stakeholderPerspectiveShiftSensitivity: 45,
});
const scoreOf = (p, k) => p.dimensions.find((d) => d.key === k)?.score ?? 50;
const isFit = (lv) => lv === "aligned" || lv === "weakly_aligned";
const near = (a, b) => Math.abs(a - b) < 1e-9;

/**
 * Each participant is a function that, given this scenario's options ranked by fit and the
 * profile, returns the option to choose. `st` lets a participant remember what it did earlier.
 */
/**
 * THE CONVERT ADOPTS A VALUE THROUGH AN OPTION THAT STANDS FOR ONE.
 *
 * A change of heart is a change to a VALUE, so the option the convert takes up in scenario 1 must
 * be built on one value: the first option outside their top two whose strongest value is at least
 * STANDS_FOR_ONE_VALUE. A middle-of-the-road option does not qualify. The scenario-1 convoy, for
 * example, scores 55 / 61 / 70 / 56: its "main value" is gained only because 70 is its largest
 * number, and a participant who picks it has not declared that gains now come first. A convert
 * who "adopted" gained that way was then asked to follow gained into the extreme gain option of
 * scenario 3 (18 / 25 / 92 / 43) - an escalation, not holding to what they chose - and paid twice.
 * The persona then tested the convoy's arithmetic rather than the property V5 is about.
 */
const STANDS_FOR_ONE_VALUE = 85;
const convertsFirstPick = (r) =>
  r.find((x) => !isFit(x.level) && x.fingerprint[optionMainValue(x)] >= STANDS_FOR_ONE_VALUE)
  ?? r.find((x) => !isFit(x.level)) ?? r[2];

const PARTICIPANTS = {
  "Loyal": { pick: (r) => r[0] },
  "Near-loyal": { pick: (r) => r[1] },
  "Mixed-loyal": { pick: (r, _p, i) => (i % 2 === 0 ? r[0] : r[1]) },
  "Convert": {
    strong: true,
    pick(r, _p, i, st) {
      if (i === 0) { const o = convertsFirstPick(r); st.value = optionMainValue(o); return o; }
      return r.find((x) => optionMainValue(x) === st.value) ?? r[0];
    },
  },
  "Hesitant convert": {
    strong: false,
    pick(r, _p, i, st) {
      if (i === 0) { const o = convertsFirstPick(r); st.value = optionMainValue(o); return o; }
      return r.find((x) => optionMainValue(x) === st.value) ?? r[0];
    },
  },
  "Flip-flopper": {
    strong: true,
    /* the point of this one: every scenario, take up a value that is NOT the one currently on
       top — i.e. change what you care about in every scenario, endorsing each change. */
    pick(r, p, _i, st) {
      const top = [...POLICY].sort((a, b) => scoreOf(p, b) - scoreOf(p, a))[0];
      const cand = r.filter((x) => !isFit(x.level) && optionMainValue(x) !== top
                                && optionMainValue(x) !== st.last);
      const chosen = cand[0] ?? r.find((x) => !isFit(x.level)) ?? r[r.length - 1];
      st.last = optionMainValue(chosen);
      return chosen;
    },
  },
  /* The same flip-flopper, but every change goes through the APA clarification instead of the keep
     path: they refuse, name the value the option stands for, and pick it. V8 exists for this one. */
  "Flip-flopper (APA)": {
    apa: true,
    pick(r, p, _i, st) {
      const top = [...POLICY].sort((a, b) => scoreOf(p, b) - scoreOf(p, a))[0];
      const cand = r.filter((x) => !isFit(x.level) && optionMainValue(x) !== top
                                && optionMainValue(x) !== st.last);
      const chosen = cand[0] ?? r.find((x) => !isFit(x.level)) ?? r[r.length - 1];
      st.last = optionMainValue(chosen);
      return chosen;
    },
  },
  "Contrarian": { strong: true, pick: (r) => r[r.length - 1] },
};

function run(name) {
  const spec = PARTICIPANTS[name];
  let profile = START();
  const st = {};
  const perScenario = [];
  BLOCK5_SCENARIOS.forEach((scenario, i) => {
    const ranked = labelOptions(scenario.options, profile);
    const opt = spec.pick(ranked, profile, i, st);
    const menuSize = scenario.options.length;
    // MIRRORS commitChoice / handleApaCommit: the weight of the label the option had on the profile
    // brought INTO this scenario, on this scenario's own menu size.
    const credit = scenarioVciScore(opt.level, menuSize);
    // The role travels with the row, exactly as it does on a stored result, so computeVCI
    // filters here for the same reason and by the same field that it filters in the app.
    const decisionRole = scenario.decisionRole ?? "decider";
    const w = scenario.stakesWeight ?? 1;
    /* What relabeling on the profile APA has just moved WOULD credit. VCI does not use it; it is
       printed only so the output shows the size of the hole V8 guards. */
    let relabeledCredit = credit;
    if (scenarioIsScored(scenario)) {
      if (isFit(opt.level)) {
        profile = applyKeepUpdates(profile, opt, opt.level, w, scenario.options);
      } else if (spec.apa) {
        /* MIRRORS handleApaCommit (Block5PublicEmergencySimulation.tsx). The participant names the
           value this option stands for, at full confidence; the profile moves by applyApaUpdates;
           and the final choice KEEPS the label it had when the scenario opened - `credit` above is
           not recomputed. If handleApaCommit ever re-labels on the moved profile, this mirror no
           longer describes the app and must change with it. */
        profile = applyApaUpdates(profile, true, optionMainValue(opt), null, w, 5);
        relabeledCredit = scenarioVciScore(
          labelOptions(scenario.options, profile).find((o) => o.id === opt.id).level, menuSize);
      } else {
        profile = applyEndorsementUpdates(profile, opt, !!spec.strong, true, null, w);
      }
    }
    perScenario.push({ level: opt.level, credit, relabeledCredit, title: opt.title, decisionRole });
  });
  const vci = computeVCI(perScenario.map((s) => ({ vciScore: s.credit, decisionRole: s.decisionRole })));
  const relabeledVci = computeVCI(perScenario.map((s) => ({ vciScore: s.relabeledCredit, decisionRole: s.decisionRole }))).value;
  return { vci: vci.value, level: vci.level, relabeledVci, perScenario };
}

/* ------------------------------------------------------------------ */
let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(3)} ${msg}`);
  if (!ok) fails++;
};

const W = {
  aligned: labelWeight("aligned"), weakly: labelWeight("weakly_aligned"),
  misaligned: labelWeight("misaligned"), strongly: labelWeight("strongly_misaligned"),
};

console.log("\n=== VCI SIMULATION — synthetic participants through the real scoring code ===");
console.log(`  Label weights on six options: Aligned ${W.aligned.toFixed(2)}, Weakly aligned ${W.weakly.toFixed(2)}, ` +
  `Misaligned ${W.misaligned.toFixed(2)}, Strongly misaligned ${W.strongly.toFixed(2)}\n`);
const out = {};
const lvl = {};
Object.keys(PARTICIPANTS).forEach((name) => {
  const r = run(name);
  out[name] = r.vci;
  lvl[name] = r.level;
  const shape = r.perScenario.map((s) => s.credit.toFixed(2)).join("  ");
  console.log(`  ${name.padEnd(18)} VCI ${String(r.vci).padStart(3)} ${r.level.padEnd(20)} per scenario: ${shape}`);
  if (N_UNSCORED > 0) console.log(`  ${"".padEnd(18)}                          (last ${N_UNSCORED} recorded for reference only — never averaged into VCI)`);
  console.log(`  ${"".padEnd(18)}                          ${r.perScenario.map((s) => s.level.replace("_", " ")).join(", ")}`);
  if (PARTICIPANTS[name].apa) console.log(`  ${"".padEnd(18)}                          (relabeling on the moved profile, which VCI does not do, would give ${r.relabeledVci})`);
});

console.log("\n--- gates ---");
gate("V1", out["Loyal"] === 100, `Loyal scores 100  (got ${out["Loyal"]})`);
/* V2 — always the second-best option scores exactly the Weakly-aligned weight, and reads
   "Mostly Consistent": every choice fit well, one place below the best. */
gate("V2", out["Near-loyal"] === Math.round(100 * W.weakly) && lvl["Near-loyal"] === "Mostly Consistent",
  `Near-loyal = ${Math.round(100 * W.weakly)}, "Mostly Consistent" — always your second best  (got ${out["Near-loyal"]}, "${lvl["Near-loyal"]}")`);
/* V3 — 50 is what blind picking gives (V11). Changing what you value in every scenario must fall
   below it. */
gate("V3", out["Flip-flopper"] < 50, `Flip-flopper < 50 — below blind picking  (got ${out["Flip-flopper"]})`);
gate("V4", out["Contrarian"] <= out["Flip-flopper"] && out["Contrarian"] === Math.round(100 * W.strongly),
  `Contrarian = ${Math.round(100 * W.strongly)}, the floor, and <= Flip-flopper  (${out["Contrarian"]} vs ${out["Flip-flopper"]})`);
/* V5 — a genuine change of heart, held to, costs only the scenario in which it happened. The floor
   is a participant who took the LOWEST label once and the best option every time after:
       100 x ((K - 1) x 1.00 + w(Strongly misaligned)) / K
   expressed against the deck size, so the gate tests the property rather than one deck's arithmetic.
   The convert adopts its value through an option that stands for one value (convertsFirstPick). */
const FLOOR_ONE_CHANGE = Math.round((100 * ((N_SCENARIOS - 1) + W.strongly)) / N_SCENARIOS);
gate("V5", out["Convert"] >= FLOOR_ONE_CHANGE,
  `Convert >= ${FLOOR_ONE_CHANGE} — a genuine change of heart, held to, costs only the scenario it happened in  (got ${out["Convert"]})`);
gate("V6", out["Convert"] >= out["Hesitant convert"], `Convert >= Hesitant convert — doubt costs something  (${out["Convert"]} vs ${out["Hesitant convert"]})`);

/* V7 — keeping your best fit reinforces the value it is built on. */
{
  const p = START();
  const scenario = BLOCK5_SCENARIOS[0];
  const best = labelOptions(scenario.options, p)[0];
  const kept = optionMainValue(best);
  const after = applyKeepUpdates(p, best, best.level, scenario.stakesWeight ?? 1, scenario.options);
  const before = scoreOf(p, kept), now = scoreOf(after, kept);
  gate("V7", now >= before,
    `keeping your best-fit option never lowers the value it is built on  (${kept.replace("Sensitivity", "")}: ${before.toFixed(1)} -> ${now.toFixed(1)})`);
}

/* V8 — the ROUTE does not rescue a flip-flopper. Changing value every scenario through APA must be
   caught exactly as it is on the keep path, because both are judged on the profile brought into the
   scenario. The figure printed beside the APA flip-flopper shows what relabeling would give. */
gate("V8", out["Flip-flopper (APA)"] < 50,
  `Flip-flopper through APA < 50 — clarifying instead of keeping does not hide a change of value  (got ${out["Flip-flopper (APA)"]}, keep path ${out["Flip-flopper"]})`);

/* V9 — a tie in fit is broken by what the option delivers, never by the alphabet. Checked on seeded
   random profiles, and required to meet real ties, so the gate cannot pass by finding none. */
{
  let seed = 20260918;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let ties = 0, wrong = 0;
  for (let n = 0; n < 2000; n++) {
    const p = makeProfile(Object.fromEntries(ALL.map((k) => [k, Math.round(rnd() * 100)])));
    for (const scenario of BLOCK5_SCENARIOS.filter(scenarioIsScored)) {
      const r = labelOptions(scenario.options, p);
      for (let i = 1; i < r.length; i++) {
        if (r[i].matchShortfall !== r[i - 1].matchShortfall) continue;
        ties++;
        if (policyDelivery(r[i], p) > policyDelivery(r[i - 1], p)) wrong++;
      }
    }
  }
  gate("V9", ties > 0 && wrong === 0,
    `tied options are ordered by what they deliver, not by name  (${ties} ties met, ${wrong} out of order)`);
}

/* V10 — the weights in the code are the weights in the documentation, on both menu sizes the deck
   uses. If ALIGNMENT_RANK_RULE changes, this is the gate that says the published table is stale. */
{
  const six = [1, 0.8, 0.5, 0.1];
  const four = [1, 2 / 3, 1 / 3, 0];
  const L = ["aligned", "weakly_aligned", "misaligned", "strongly_misaligned"];
  const got6 = L.map((l) => labelWeight(l, 6));
  const got4 = L.map((l) => labelWeight(l, 4));
  gate("V10", got6.every((x, i) => near(x, six[i])) && got4.every((x, i) => near(x, four[i])),
    `label weights are the published ones  (six options ${got6.map((x) => x.toFixed(2)).join(" / ")}; four ${got4.map((x) => x.toFixed(2)).join(" / ")})`);
}

/* V11 — blind picking scores exactly 50. A uniform pick lands on every place once, so its expected
   weight is the average of the label weights over all places; the mid-rank rule makes that one
   half on any menu. Checked on every size from 3 to 10 options. */
{
  const sizes = [3, 4, 5, 6, 7, 8, 9, 10];
  const means = sizes.map((n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += labelWeight(rankLabel(i, n), n);
    return s / n;
  });
  gate("V11", means.every((m) => near(m, 0.5)),
    `blind picking scores exactly 50 on every menu size  (${sizes.map((n, i) => `${n}: ${(100 * means[i]).toFixed(1)}`).join(", ")})`);
}

/* V12 — the six levels sit at the published edges, and each score lands in the level the
   documentation gives it. */
{
  const edges = VCI_LEVELS.slice(0, -1).map((l) => l.from);
  const want = [90, 80, 65, 50, 30];
  const cases = [[100, "Highly Consistent"], [90, "Highly Consistent"], [89, "Mostly Consistent"],
    [80, "Mostly Consistent"], [79, "Moderate"], [65, "Moderate"], [64, "Low"], [50, "Low"],
    [49, "Very Low"], [30, "Very Low"], [29, "Highly Inconsistent"], [10, "Highly Inconsistent"]];
  const wrongCase = cases.filter(([v, l]) => consistencyLevel(v) !== l);
  gate("V12", edges.every((e, i) => near(e, want[i])) && wrongCase.length === 0,
    `levels at 90 / 80 / 65 / 50 / 30  (edges ${edges.join(" / ")}; ${wrongCase.length ? "misplaced: " + wrongCase.map((c) => c[0]).join(", ") : "all 12 test scores land correctly"})`);
}

/* V13, V14 — THE KEEP RULE LEARNS FROM THE COMPARISON (24 September 2026, researcher's approval).
   Seeded random profiles, every decider scenario, the best-fit pick and the second-best pick.
     V13  a best-fit pick moves nothing: the model's own guess came true.
     V14  a second-best pick lowers the value on which the best fit beat it most (weighted by how
          much the person holds it), raises the value on which it beat the best fit most, and never
          lowers a value on which it was not worse. */
{
  let seed = 20260924;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let bestMoved = 0, bestPicks = 0, secondPicks = 0, wrongDown = 0, missedDown = 0, missedUp = 0;
  for (let i = 0; i < 2000; i++) {
    const p = makeProfile(Object.fromEntries(POLICY.map((k) => [k, Math.round(rnd() * 100)])));
    for (const scenario of BLOCK5_SCENARIOS.filter(scenarioIsScored)) {
      const ranked = labelOptions(scenario.options, p);
      const [best, second] = ranked;

      bestPicks++;
      const afterBest = applyKeepUpdates(p, best, best.level, 1, scenario.options);
      if (POLICY.some((k) => scoreOf(afterBest, k) !== scoreOf(p, k))) bestMoved++;

      secondPicks++;
      const after = applyKeepUpdates(p, second, second.level, 1, scenario.options);
      const lowered = POLICY.filter((k) => scoreOf(after, k) < scoreOf(p, k));
      const raised = POLICY.filter((k) => scoreOf(after, k) > scoreOf(p, k));
      if (lowered.some((k) => second.fingerprint[k] >= best.fingerprint[k])) wrongDown++;
      const costs = POLICY.map((k) => ({ k, c: Math.max(0, best.fingerprint[k] - second.fingerprint[k]) * scoreOf(p, k) / 100 }));
      const top = costs.filter((x) => x.c > 0).sort((a, b) => b.c - a.c)[0];
      if (top && scoreOf(p, top.k) > 0 && lowered.length === 0) missedDown++;
      /* The value it should raise is the one the pick beats the best fit on the most (ties by the
         person's own rank). Raising nothing is allowed only when THAT value is already at 100. */
      const rank = (k) => p.dimensions.find((d) => d.key === k).rank;
      const why = POLICY.map((k) => ({ k, g: second.fingerprint[k] - best.fingerprint[k] }))
        .filter((x) => x.g > 0).sort((a, b) => b.g - a.g || rank(a.k) - rank(b.k))[0];
      if (why && raised.length === 0 && scoreOf(p, why.k) < 100) missedUp++;
    }
  }
  gate("V13", bestMoved === 0,
    `a best-fit pick moves nothing  (${bestMoved} of ${bestPicks} best-fit picks moved a value; it used to be about 16 in 100 lowering the #1 value)`);
  gate("V14", wrongDown === 0 && missedDown === 0 && missedUp === 0,
    `a second-best pick lowers what it gave up and raises why it was chosen  (${secondPicks} picks: `
    + `${wrongDown} lowered a value it was not worse on, ${missedDown} lowered nothing, ${missedUp} raised nothing)`);
  let threw = false;
  try { applyKeepUpdates(START(), labelOptions(BLOCK5_SCENARIOS[0].options, START())[1], "weakly_aligned", 1); }
  catch { threw = true; }
  gate("V15", threw, "a second-best pick without the scenario's options is refused loudly, never silently ignored");
}

console.log("\n" + "=".repeat(72));
console.log(fails === 0 ? "### ALL VCI GATES PASSED ###" : `### ${fails} VCI GATE FAILURE(S) ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails ? 1 : 0);
