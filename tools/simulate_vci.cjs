/**
 * simulate_vci.cjs — walks synthetic participants through the REAL Block-5 scoring code.
 *
 * WHY THIS EXISTS
 * ---------------
 * The VCI formula was changed on the strength of a table of predicted scores. A table is a claim.
 * This turns it into a test: each participant below is run through the actual `labelOptions`,
 * `applyKeepUpdates`, `applyEndorsementUpdates` and `scenarioVciScore` over whatever scenarios
 * actually ship, and the resulting VCI is asserted.
 *
 * It imports the compiled modules rather than re-implementing the formulas, deliberately — a
 * simulator that carries its own copy of the maths drifts from the code and then lies.
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

const { labelOptions, scenarioVciScore, applyKeepUpdates, applyEndorsementUpdates,
        optionMainValue, computeVCI, scenarioIsScored } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

/* Deck size, read from the scenarios that ship, counting only the ones VCI is computed over.
   Recipient scenarios ask for a wish rather than a choice and are excluded from VCI, so a floor
   derived from the full deck length would be measuring against scenarios that never entered the
   average. Gates below are expressed against this so they keep asserting the same property when
   a scenario is added, removed, or changes role. */
const N_SCENARIOS = BLOCK5_SCENARIOS.filter(scenarioIsScored).length;
const N_WISH = BLOCK5_SCENARIOS.length - N_SCENARIOS;

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

/**
 * Each participant is a function that, given this scenario's options ranked by fit and the
 * profile, returns the option to choose. `adoptedValue` lets the converts remember what they
 * took on in scenario 1.
 */
const PARTICIPANTS = {
  "Loyal": { pick: (r) => r[0] },
  "Near-loyal": { pick: (r) => r[1] },
  "Mixed-loyal": { pick: (r, _p, i) => (i % 2 === 0 ? r[0] : r[1]) },
  "Convert": {
    strong: true,
    pick(r, _p, i, st) {
      if (i === 0) { const o = r.find((x) => !isFit(x.level)) ?? r[2]; st.value = optionMainValue(o); return o; }
      return r.find((x) => optionMainValue(x) === st.value) ?? r[0];
    },
  },
  "Hesitant convert": {
    strong: false,
    pick(r, _p, i, st) {
      if (i === 0) { const o = r.find((x) => !isFit(x.level)) ?? r[2]; st.value = optionMainValue(o); return o; }
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
    // Mirror the app exactly: the fit path records "n/a", only the CVR path records an
    // endorsement. (After the change scenarioVciScore ignores the argument entirely.)
    const endorsement = isFit(opt.level) ? "n/a" : (spec.strong ? "strong" : "weak");
    const credit = scenarioVciScore(opt.level, endorsement);
    // The role travels with the row, exactly as it does on a stored result, so computeVCI
    // filters here for the same reason and by the same field that it filters in the app.
    const decisionRole = scenario.decisionRole ?? "decider";
    perScenario.push({ level: opt.level, credit, title: opt.title, decisionRole });
    const w = scenario.stakesWeight ?? 1;
    if (scenarioIsScored(scenario)) {
      profile = isFit(opt.level)
        ? applyKeepUpdates(profile, opt, opt.level, w)
        : applyEndorsementUpdates(profile, opt, !!spec.strong, true, null, w);
    }
  });
  const vci = computeVCI(perScenario.map((s) => ({ vciScore: s.credit, decisionRole: s.decisionRole }))).value;
  return { vci, perScenario };
}

/* ------------------------------------------------------------------ */
let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(3)} ${msg}`);
  if (!ok) fails++;
};

console.log("\n=== VCI SIMULATION — synthetic participants through the real scoring code ===\n");
const out = {};
Object.keys(PARTICIPANTS).forEach((name) => {
  const r = run(name);
  out[name] = r.vci;
  const shape = r.perScenario.map((s) => s.credit.toFixed(2)).join("  ");
  console.log(`  ${name.padEnd(18)} VCI ${String(r.vci).padStart(3)}    per scenario: ${shape}`);
  if (N_WISH > 0) console.log(`  ${"".padEnd(18)}            (last ${N_WISH} shown for reference only — a wish is not averaged into VCI)`);
  console.log(`  ${"".padEnd(18)}            ${r.perScenario.map((s) => s.level.replace("_", " ")).join(", ")}`);
});

console.log("\n--- gates ---");
gate("V1", out["Loyal"] === 100, `Loyal scores 100  (got ${out["Loyal"]})`);
gate("V2", out["Near-loyal"] >= 80, `Near-loyal >= 80 — staying in your own top two is consistent  (got ${out["Near-loyal"]})`);
gate("V3", out["Flip-flopper"] < 50, `Flip-flopper < 50 — changing what you value every scenario is NOT consistent  (got ${out["Flip-flopper"]})`);
gate("V4", out["Contrarian"] <= out["Flip-flopper"], `Contrarian <= Flip-flopper — never fitting is at least as bad as sometimes  (${out["Contrarian"]} vs ${out["Flip-flopper"]})`);
/* V5 — the convert pays for the ONE scenario in which they changed, and for nothing after it.
   This was written as ">= 80", which is not the claim: 80 is (5-1)/5, so the number silently
   encoded a five-scenario deck. On a three-scenario deck a single change is a third of the run
   rather than a fifth, so the same behaviour scores lower and a fixed threshold would fail a
   participant who did nothing wrong. Expressed against the deck size, the gate keeps testing the
   property instead of the arithmetic: a convert must do at least as well as someone who scored
   zero once and perfectly every time after. */
const FLOOR_ONE_CHANGE = Math.round((100 * (N_SCENARIOS - 1)) / N_SCENARIOS);
gate("V5", out["Convert"] >= FLOOR_ONE_CHANGE,
  `Convert >= ${FLOOR_ONE_CHANGE} (= ${N_SCENARIOS - 1}/${N_SCENARIOS}) — a genuine change of heart, held to, costs only the scenario it happened in  (got ${out["Convert"]})`);
gate("V6", out["Convert"] >= out["Hesitant convert"], `Convert >= Hesitant convert — doubt costs something  (${out["Convert"]} vs ${out["Hesitant convert"]})`);

/* V7 — the reviewer's objection, as an executable check. */
{
  const p = START();
  const scenario = BLOCK5_SCENARIOS[0];
  const best = labelOptions(scenario.options, p)[0];
  const kept = optionMainValue(best);
  const after = applyKeepUpdates(p, best, best.level, scenario.stakesWeight ?? 1);
  const before = scoreOf(p, kept), now = scoreOf(after, kept);
  gate("V7", now >= before,
    `keeping your best-fit option never lowers the value it is built on  (${kept.replace("Sensitivity", "")}: ${before.toFixed(1)} -> ${now.toFixed(1)})`);
}

console.log("\n" + "=".repeat(72));
console.log(fails === 0 ? "### ALL VCI GATES PASSED ###" : `### ${fails} VCI GATE FAILURE(S) ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails ? 1 : 0);
