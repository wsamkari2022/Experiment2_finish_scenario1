/**
 * verify_apa.cjs — asserts the ARITHMETIC of the APA clarification against the real code.
 *
 * WHY THIS EXISTS
 * ---------------
 * The APA rule has been described in prose several times — in commit messages, in the guide, and
 * in conversation. It currently reads "+30 to the value you name, -10 to each of the other three,
 * scaled 0.6-1.0 by confidence", and before 17 September 2026 it read "-20 to the incumbent" in
 * place of that middle clause. Prose is a claim. Twice now the description and the code have had to be checked
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

/* NO OPTION AND NO Q1 ANY MORE. applyApaUpdates used to take the misaligned option (to read the
   value it served) and the first question's answer; both were removed on 17 September 2026, so the
   arithmetic below depends on nothing but the profile, the named value and the confidence. */
const PRIOR = "groupSizeSensitivity";

console.log("\nAPA ARITHMETIC\n");

/* A-APA-1  Every shipped scenario runs at stakesWeight 1. The documented table is stated in
   absolute points, which is only meaningful while nothing else is scaling them. */
const weights = BLOCK5_SCENARIOS.map((s) => s.stakesWeight ?? 1);
ok("A-APA-1  every scenario runs at stakesWeight 1",
   weights.every((w) => w === 1), `weights = ${weights.join(",")}`);

/* A-APA-2  The headline rule, measured away from the 0/100 clamps so the raw deltas are visible.
   The value the participant NAMES gains exactly 30 x w, and EACH of the other three loses 10 x w.

   It used to say "the value currently on top loses 20 x w" and check only that one value, which
   meant the other two were never looked at: the rule could have moved them by any amount and this
   would still have gone green. All four are checked now. */
const MID = { gainResponsivenessSensitivity: 70, outcomeAggregationSensitivity: 60,
              vulnerabilityProtectionSensitivity: 40, groupSizeSensitivity: 30,
              directnessSensitivity: 50, contextSensitivity: 50, [STAKE]: 50 };
for (const c of [1, 2, 3, 4, 5]) {
  const w = confidenceWeight(c);
  const before = mk(MID);
  const after = applyApaUpdates(before, false, PRIOR, null, 1, c);
  const want = (k) => sc(before, k) + (k === PRIOR ? 30 * w : -10 * w);
  const good = POLICY.every((k) => Math.abs(sc(after, k) - want(k)) < 1e-6);
  ok(`A-APA-2.${c}  conf ${c} (w=${w.toFixed(2)}): named +30w, each other -10w`, good,
     POLICY.map((k) => `${POLICY_DIM_SHORT[k]} ${sc(before, k)}->${sc(after, k).toFixed(1)} (want ${want(k).toFixed(1)})`).join(" · "));
}

/* A-APA-2z  THE RULE IS ZERO-SUM, away from the clamps: +30 in, three lots of -10 out.

   This is the property that keeps the four scores from drifting upward together however many
   clarifications a participant runs, and a ranking whose members all rise together eventually
   stops discriminating. The old rule was not zero-sum — naming the value already on top added 30
   and subtracted nothing — so this check could not have existed before. */
for (const c of [1, 3, 5]) {
  for (const named of POLICY) {
    const before = mk(MID);
    const after = applyApaUpdates(before, false, named, null, 1, c);
    const net = POLICY.reduce((s, k) => s + (sc(after, k) - sc(before, k)), 0);
    ok(`A-APA-2z.${c}.${POLICY_DIM_SHORT[named]}  conf ${c}, names ${POLICY_DIM_SHORT[named]}: the four moves cancel`,
       Math.abs(net) < 1e-6, `net ${net.toFixed(6)}`);
  }
}

/* A-APA-3  The published table for the participant who approved everything in Blocks 1-4:
   a value sitting at 0 rises to 18 / 21 / 24 / 27 / 30. This is the case the rule was written for. */
const CEIL = { gainResponsivenessSensitivity: 100, outcomeAggregationSensitivity: 99,
               vulnerabilityProtectionSensitivity: 0, groupSizeSensitivity: 0,
               directnessSensitivity: 50, contextSensitivity: 50, [STAKE]: 50 };
const EXPECT = { 1: 18, 2: 21, 3: 24, 4: 27, 5: 30 };
for (const c of [1, 2, 3, 4, 5]) {
  const after = applyApaUpdates(mk(CEIL), false, PRIOR, null, 1, c);
  ok(`A-APA-3.${c}  documented table: conf ${c} -> ${EXPECT[c]}`,
     Math.round(sc(after, PRIOR)) === EXPECT[c], `got ${Math.round(sc(after, PRIOR))}`);
}

/* A-APA-4  Confidence must be MONOTONIC. A participant who is more sure moves the model further,
   at every step — the whole reason the rating is collected. */
const named = [1, 2, 3, 4, 5].map((c) =>
  sc(applyApaUpdates(mk(MID), false, PRIOR, null, 1, c), PRIOR));
ok("A-APA-4  more confident always moves the profile further",
   named.every((v, i) => i === 0 || v > named[i - 1]), named.map((v) => v.toFixed(1)).join(" < "));

/* A-APA-5  The gap between the named value and the incumbent must CLOSE, at every confidence.
   This is the defect the rule was rewritten to fix: adding points without subtracting any left a
   value at 0 unable to catch values at 100, so stating a priority changed nothing. */
for (const c of [1, 3, 5]) {
  const before = mk(CEIL);
  const after = applyApaUpdates(before, false, PRIOR, null, 1, c);
  const g0 = sc(before, "gainResponsivenessSensitivity") - sc(before, PRIOR);
  const g1 = sc(after, "gainResponsivenessSensitivity") - sc(after, PRIOR);
  ok(`A-APA-5.${c}  conf ${c}: gap narrows`, g1 < g0, `gap ${g0} -> ${g1}`);
}

/* A-APA-6  Naming the value that is ALREADY top must not punish it. The -10 is applied to the three
   values the participant did NOT name, so the named one is never on both sides of the sum, and
   agreeing with yourself can only ever help. */
for (const c of [1, 5]) {
  const before = mk(MID);
  const after = applyApaUpdates(before, false, "gainResponsivenessSensitivity", null, 1, c);
  const v = sc(after, "gainResponsivenessSensitivity");
  ok(`A-APA-6.${c}  naming the current top only raises it`,
     Math.abs(v - (70 + 30 * confidenceWeight(c))) < 1e-6, `70 -> ${v.toFixed(1)}`);
}

/* A-APA-8  THE CAP. No policy value moves more than 30 x w in a single clarification, in either
   direction. It guarded against two questions naming the same value and adding: a participant who
   endorsed their choice and then named the value it served received +45 x w while the rule was
   published as +30. There is only one question now, so the collision it guarded against cannot
   happen — which is exactly why the check stays. A future edit that adds a second bump would
   reintroduce it silently, and this is what would notice.

   THE Q1 SWEEP IS GONE from the loop, because the parameter is. It was iterating three values that
   the function no longer accepts, so two thirds of the "300 combinations" it reported were the same
   combination run again. */
{
  let worst = 0, worstAt = "", combos = 0;
  for (const c of [1, 2, 3, 4, 5]) {
    const cap = 30 * confidenceWeight(c);
    for (const named of POLICY) {
      for (const moved of [true, false]) {
        for (const start of [MID, CEIL]) {
          combos++;
          const before = mk(start);
          const after = applyApaUpdates(before, moved, named, null, 1, c);
          for (const k of POLICY) {
            const delta = Math.abs(sc(after, k) - sc(before, k));
            if (delta - cap > worst) { worst = delta - cap; worstAt = k + "/conf" + c; }
          }
        }
      }
    }
  }
  ok("A-APA-8  no policy value moves more than 30 x confidence",
     worst <= 1e-9, worst > 1e-9 ? "exceeded by " + worst.toFixed(2) + " at " + worstAt : `swept ${combos} combinations`);
}

/* A-APA-7  Nothing escapes 0-100. Ranking is read off these scores; a score outside the scale
   would make the alignment tiers meaningless. */
let inRange = true;
for (const c of [1, 3, 5]) for (const k of POLICY) for (const moved of [true, false]) {
  const after = applyApaUpdates(mk(CEIL), moved, k, null, 1, c);
  if (after.dimensions.some((d) => d.score < 0 || d.score > 100)) inRange = false;
}
ok("A-APA-7  every score stays inside 0-100", inRange);

console.log(`\n  ${fails === 0 ? "ALL APA CHECKS PASS" : fails + " APA CHECK(S) FAILED"}\n`);
process.exit(fails === 0 ? 0 : 1);
