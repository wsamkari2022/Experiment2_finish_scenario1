/*
 * stability_distribution.cjs — what Stability scores the instrument can actually produce.
 *
 * NOT A GATE. `simulate_stability.cjs` is the gate: it asserts that named archetypes land in the
 * right order and that the churn ceiling still matches the null model. This script asks a
 * different question, the one a methods chapter has to answer:
 *
 *     "Your participants scored between X and Y. Is that the whole scale, or only part of it?"
 *
 * It runs the REAL scoring functions over many randomly drawn starting profiles, so the answer is
 * a property of the instrument rather than of any one archetype. Every number quoted in
 * MEASUREMENT_MODEL.md section "The Stability scale, for reporting" comes from here.
 *
 * Run:  npm run report:stability
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

const {
  labelOptions, applyKeepUpdates, applyEndorsementUpdates,
  scenarioIsScored, computeStability, stabilityLevel, STABILITY_CHURN_CEILING,
} = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const STAKE = "stakeholderPerspectiveShiftSensitivity";
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity", STAKE];

const mk = (o) => ({
  generatedAt: "", topThreeKeys: [], topSensitivityKey: "x",
  dimensions: ALL.map((k, i) => ({
    key: k, label: k, score: o[k] === undefined ? 50 : o[k],
    rank: i + 1, weight: 0.1, sourceBlocks: [],
  })),
});
const sc = (p, k) => p.dimensions.find((d) => d.key === k).score;
const isFit = (l) => l === "aligned" || l === "weakly_aligned";

/* Seeded so the reported figures are reproducible; change SEED only with the docs. */
const SEED = 20260913;
let seed = SEED;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const draw = () => { const o = {}; for (const k of ALL) o[k] = Math.round(rnd() * 100); return mk(o); };

function run(start, pick) {
  const original = JSON.parse(JSON.stringify(start));
  let p = JSON.parse(JSON.stringify(start));
  const results = [];
  BLOCK5_SCENARIOS.forEach((s, i) => {
    const ranked = labelOptions(s.options, p);
    const opt = pick(ranked, i);
    /* A wish teaches the profile nothing; the app skips the update and so must this. */
    if (scenarioIsScored(s)) {
      p = isFit(opt.level)
        ? applyKeepUpdates(p, opt, opt.level, s.stakesWeight || 1)
        : applyEndorsementUpdates(p, opt, true, i % 2 === 0, null, s.stakesWeight || 1);
    }
    results.push({
      policySnapshotAfter: Object.fromEntries(POLICY.map((k) => [k, sc(p, k)])),
      stakeholderSnapshotAfter: sc(p, STAKE),
    });
  });
  return computeStability(results, original);
}

const BEHAVIORS = {
  "always the best fit": (r) => r.find((o) => o.rank === 1),
  "always the second fit": (r) => r.find((o) => o.rank === 2),
  "always the worst fit": (r) => r[r.length - 1],
  "picks at random": (r) => r[Math.floor(rnd() * r.length)],
};

const q = (sorted, f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];

console.log("\n=== STABILITY — THE SCALE THE INSTRUMENT ACTUALLY PRODUCES ===\n");
console.log("  Real scoring code, " + BLOCK5_SCENARIOS.length + " scenarios, seed " + SEED + ".");
console.log("  Churn ceiling = " + STABILITY_CHURN_CEILING + " (a CHURN value, not a cap on the score).\n");

const N = 300;
const starts = Array.from({ length: N }, draw);
const everything = [];

console.log("  " + N + " random starting profiles per behavior:\n");
console.log("    behavior                | min | p25 | median | p75 | max | median reads as");
console.log("    ------------------------+-----+-----+--------+-----+-----+----------------");
for (const [name, pick] of Object.entries(BEHAVIORS)) {
  const vals = starts.map((s) => run(s, pick).value);
  everything.push(...vals);
  const v = [...vals].sort((a, b) => a - b);
  console.log("    " + name.padEnd(23) + " | " + String(v[0]).padStart(3) + " | " + String(q(v, 0.25)).padStart(3)
    + " | " + String(q(v, 0.5)).padStart(6) + " | " + String(q(v, 0.75)).padStart(3) + " | "
    + String(v[v.length - 1]).padStart(3) + " | " + stabilityLevel(q(v, 0.5)));
}
const all = everything.sort((a, b) => a - b);
console.log("\n    Across every behavior and start: lowest " + all[0] + ", highest " + all[all.length - 1]
  + ". The scale is used end to end.\n");

/* The case that drives the caption on the results page. */
const M = 2000;
console.log("  " + M + " participants who pick their BEST-FIT option in every scenario:\n");
const best = Array.from({ length: M }, () => run(draw(), BEHAVIORS["always the best fit"]));
const bv = best.map((x) => x.value).sort((a, b) => a - b);
const pct = (f) => (best.filter(f).length / M * 100).toFixed(1) + "%";
console.log("    median                      " + q(bv, 0.5));
console.log("    85 or above, Held steady    " + pct((x) => x.value >= 85));
console.log("    70 to 84, Mostly steady     " + pct((x) => x.value >= 70 && x.value < 85));
console.log("    50 to 69, Shifted a little  " + pct((x) => x.value >= 50 && x.value < 70));
console.log("    below 50                    " + pct((x) => x.value < 50));
const low = best.filter((x) => x.value < 70);
console.log("\n    Of those scoring below 70, the cause was the ORDER half in "
  + (low.length ? (low.filter((x) => x.orderPart < 100).length / low.length * 100).toFixed(1) : "0") + "%");
console.log("    (their four values changed rank order, even while they kept choosing their best fit).\n");

/* Which values each half can take, so nobody reports them as continuous. */
const orders = [...new Set(best.map((x) => x.orderPart))].sort((a, b) => a - b);
console.log("  The order half is COARSE — with 4 values there are 6 pairs, so only these are possible:");
console.log("    " + [0, 17, 33, 50, 67, 83, 100].join("  ") + "   (observed here: " + orders.join(" ") + ")");
console.log("\n  The movement half is CENSORED — it is 0 for any churn at or above "
  + STABILITY_CHURN_CEILING + ", so participants");
console.log("    past the ceiling are not distinguishable on that half alone.\n");
