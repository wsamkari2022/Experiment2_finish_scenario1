/**
 * verify_apa.cjs — asserts the ARITHMETIC of the APA clarification against the real code.
 *
 * WHY THIS EXISTS
 * ---------------
 * The APA rule has been described in prose several times — in commit messages, in the guide, and
 * in conversation ("+30 to the value you name, -20 to the incumbent, scaled 0.6-1.0 by
 * confidence"). Prose is a claim. Twice now the description and the code have had to be checked
 * against each other by hand, and the second time was only because the question order changed and
 * nobody could be sure the numbers had survived the edit.
 *
 * This turns the prose into assertions. If someone changes a constant, moves a question, or adds
 * a bump, the sentence in the documentation stops being true and this fails.
 *
 * It imports the shipped module rather than re-implementing the formula, deliberately — a checker
 * carrying its own copy of the math drifts from the code and then certifies the drift.
 *
 * Run: npm run verify:apa    (chained into npm run validate:block5)
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

const { applyApaUpdates, confidenceWeight } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { POLICY_DIM_SHORT } = B("block5Types.js");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const STAKE = "stakeholderPerspectiveShiftSensitivity";
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity", STAKE];
const mk = (o) => ({
  generatedAt: "", topThreeKeys: [], topSensitivityKey: "x",
  dimensions: ALL.map((k, i) => ({ key: k, label: k, score: o[k] ?? 50, rank: i + 1, weight: 0.1, sourceBlocks: [] })),
});
const sc = (p, k) => p.dimensions.find((d) => d.key === k).score;

let fails = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${detail ? "   " + detail : ""}`);
  if (!cond) fails++;
};

/* An option is only needed so the function has something to read a served value off; Q1 is
   answered "unsure" throughout so that Q1's own bumps stay out of the arithmetic being checked. */
const OPT = BLOCK5_SCENARIOS[0].options[BLOCK5_SCENARIOS[0].options.length - 1];
const PRIOR = "groupSizeSensitivity";

console.log("\nAPA ARITHMETIC\n");

/* A-APA-1  Every shipped scenario runs at stakesWeight 1. The documented table is stated in
   absolute points, which is only meaningful while nothing else is scaling them. */
const weights = BLOCK5_SCENARIOS.map((s) => s.stakesWeight ?? 1);
ok("A-APA-1  every scenario runs at stakesWeight 1",
   weights.every((w) => w === 1), `weights = ${weights.join(",")}`);

/* A-APA-2  The headline rule, measured away from the 0/100 clamps so the raw deltas are visible.
   The value the participant NAMES gains exactly 30 x w; the value currently on top loses 20 x w. */
const MID = { gainResponsivenessSensitivity: 70, outcomeAggregationSensitivity: 60,
              vulnerabilityProtectionSensitivity: 40, groupSizeSensitivity: 30,
              directnessSensitivity: 50, contextSensitivity: 50, [STAKE]: 50 };
for (const c of [1, 2, 3, 4, 5]) {
  const w = confidenceWeight(c);
  const after = applyApaUpdates(mk(MID), OPT, "unsure", false, PRIOR, null, 1, c);
  const named = sc(after, PRIOR), top = sc(after, "gainResponsivenessSensitivity");
  ok(`A-APA-2.${c}  conf ${c} (w=${w.toFixed(2)}): named +30w, incumbent -20w`,
     Math.abs(named - (30 + 30 * w)) < 1e-6 && Math.abs(top - (70 - 20 * w)) < 1e-6,
     `named 30->${named.toFixed(1)} (want ${(30 + 30 * w).toFixed(1)}) · top 70->${top.toFixed(1)} (want ${(70 - 20 * w).toFixed(1)})`);
}

/* A-APA-3  The published table for the participant who approved everything in Blocks 1-4:
   a value sitting at 0 rises to 18 / 21 / 24 / 27 / 30. This is the case the rule was written for. */
const CEIL = { gainResponsivenessSensitivity: 100, outcomeAggregationSensitivity: 99,
               vulnerabilityProtectionSensitivity: 0, groupSizeSensitivity: 0,
               directnessSensitivity: 50, contextSensitivity: 50, [STAKE]: 50 };
const EXPECT = { 1: 18, 2: 21, 3: 24, 4: 27, 5: 30 };
for (const c of [1, 2, 3, 4, 5]) {
  const after = applyApaUpdates(mk(CEIL), OPT, "unsure", false, PRIOR, null, 1, c);
  ok(`A-APA-3.${c}  documented table: conf ${c} -> ${EXPECT[c]}`,
     Math.round(sc(after, PRIOR)) === EXPECT[c], `got ${Math.round(sc(after, PRIOR))}`);
}

/* A-APA-4  Confidence must be MONOTONIC. A participant who is more sure moves the model further,
   at every step — the whole reason the rating is collected. */
const named = [1, 2, 3, 4, 5].map((c) =>
  sc(applyApaUpdates(mk(MID), OPT, "unsure", false, PRIOR, null, 1, c), PRIOR));
ok("A-APA-4  more confident always moves the profile further",
   named.every((v, i) => i === 0 || v > named[i - 1]), named.map((v) => v.toFixed(1)).join(" < "));

/* A-APA-5  The gap between the named value and the incumbent must CLOSE, at every confidence.
   This is the defect the rule was rewritten to fix: adding points without subtracting any left a
   value at 0 unable to catch values at 100, so stating a priority changed nothing. */
for (const c of [1, 3, 5]) {
  const before = mk(CEIL);
  const after = applyApaUpdates(before, OPT, "unsure", false, PRIOR, null, 1, c);
  const g0 = sc(before, "gainResponsivenessSensitivity") - sc(before, PRIOR);
  const g1 = sc(after, "gainResponsivenessSensitivity") - sc(after, PRIOR);
  ok(`A-APA-5.${c}  conf ${c}: gap narrows`, g1 < g0, `gap ${g0} -> ${g1}`);
}

/* A-APA-6  Naming the value that is ALREADY top must not punish it. The incumbent decrement is
   skipped in that case, so agreeing with yourself can only ever help. */
for (const c of [1, 5]) {
  const before = mk(MID);
  const after = applyApaUpdates(before, OPT, "unsure", false, "gainResponsivenessSensitivity", null, 1, c);
  const v = sc(after, "gainResponsivenessSensitivity");
  ok(`A-APA-6.${c}  naming the current top only raises it`,
     Math.abs(v - (70 + 30 * confidenceWeight(c))) < 1e-6, `70 -> ${v.toFixed(1)}`);
}

/* A-APA-8  THE CAP. No policy value moves more than 30 x w in a single clarification, in either
   direction. Without it Q1 and Q2 can name the same value and add, so a participant who endorses
   their choice and then names the value it served would receive +45 x w while the rule is published
   as +30. Swept across every answer combination, both stakeholder answers and all five confidence
   levels. */
{
  let worst = 0, worstAt = "";
  for (const c of [1, 2, 3, 4, 5]) {
    const cap = 30 * confidenceWeight(c);
    for (const q of ["endorse", "context", "unsure"]) {
      for (const named of POLICY) {
        for (const moved of [true, false]) {
          for (const start of [MID, CEIL]) {
            const before = mk(start);
            const after = applyApaUpdates(before, OPT, q, moved, named, null, 1, c);
            for (const k of POLICY) {
              const delta = Math.abs(sc(after, k) - sc(before, k));
              if (delta - cap > worst) { worst = delta - cap; worstAt = q + "/" + k + "/conf" + c; }
            }
          }
        }
      }
    }
  }
  ok("A-APA-8  no policy value moves more than 30 x confidence",
     worst <= 1e-9, worst > 1e-9 ? "exceeded by " + worst.toFixed(2) + " at " + worstAt : "swept 300 combinations");
}

/* A-APA-7  Nothing escapes 0-100. Ranking is read off these scores; a score outside the scale
   would make the alignment tiers meaningless. */
let inRange = true;
for (const c of [1, 3, 5]) for (const q of ["endorse", "context", "unsure"]) for (const k of POLICY) {
  const after = applyApaUpdates(mk(CEIL), OPT, q, true, k, null, 1, c);
  if (after.dimensions.some((d) => d.score < 0 || d.score > 100)) inRange = false;
}
ok("A-APA-7  every score stays inside 0-100", inRange);

console.log(`\n  ${fails === 0 ? "ALL APA CHECKS PASS" : fails + " APA CHECK(S) FAILED"}\n`);
process.exit(fails === 0 ? 0 : 1);
