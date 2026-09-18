/*
 * value_audit.cjs — every option's four value numbers next to its own card, scenario by scenario.
 *
 * READ-ONLY. It builds nothing and writes nothing except a one-line package.json inside .sim-build.
 *
 * Run from the repo root, after compiling the study for Node:
 *   npx tsc -p tools/tsconfig.sim.json
 *   node .claude/skills/my-advisor/scripts/value_audit.cjs            # scenarios 1 to 4 and 6
 *   node .claude/skills/my-advisor/scripts/value_audit.cjs cancer     # ids containing "cancer"
 *
 * For each scenario it prints:
 *   1. every option's four numbers beside its gains and cost lines — read each number against
 *      the card AND against what Blocks 1-4 measure (see the table in SKILL.md);
 *   2. the champion of each value (the highest, which must be unique and a different option for
 *      each value — tools/validate_block5.cjs enforces it);
 *   3. which options the APA page lists after a participant picks each value ("the options that
 *      fit it" = options whose OWN highest value is that one), so the "In this scenario" line in
 *      block5CVRContent.ts can be checked against it;
 *   4. how often each option is the best fit, over 100,000 random value profiles. A number that
 *      moves a lot here moves alignment, the CVR trigger and the APA page for many participants.
 *
 * WHY THIS EXISTS. On 18 September 2026 an audit that had read the numbers against the value
 * NAMES ("Reducing harm" read loosely as "singles nobody out") passed a draw scored 94 on Reducing
 * harm whose own card gave up "Results", and an even cut whose highest value was money though its
 * card claimed no payoff. Read against what the values MEASURE, nine numbers contradicted their cards.
 */
const path = require("path");
const fs = require("fs");

const BUILD = path.join(process.cwd(), ".sim-build");
if (!fs.existsSync(path.join(BUILD, "block5Scenarios.js"))) {
  console.error("No .sim-build found. Run first:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const { BLOCK5_SCENARIOS } = require(path.join(BUILD, "block5Scenarios.js"));

const K = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity", "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const SHORT = { vulnerabilityProtectionSensitivity: "vuln", groupSizeSensitivity: "harm", gainResponsivenessSensitivity: "gain", outcomeAggregationSensitivity: "many" };
const NAME = { vulnerabilityProtectionSensitivity: "Protecting the vulnerable", groupSizeSensitivity: "Reducing harm", gainResponsivenessSensitivity: "How much is gained", outcomeAggregationSensitivity: "How many are helped" };
const only = process.argv[2];
const main = (o) => K.reduce((a, k) => (o.fingerprint[k] > o.fingerprint[a] ? k : a), K[0]);
const penalty = (o, p) => K.reduce((s, k) => s + (p[k] / 100) * Math.max(0, p[k] - o.fingerprint[k]), 0);

for (const S of BLOCK5_SCENARIOS) {
  if (only && !S.id.includes(only)) continue;
  if ((S.decisionRole ?? "decider") === "recipient") continue;          // scenario 5 copies scenario 4
  console.log("\n" + "#".repeat(100) + "\n" + S.id + "\n" + "#".repeat(100));
  console.log("   vuln  harm  gain  many   option");
  for (const o of S.options) {
    console.log("   " + K.map((k) => String(o.fingerprint[k]).padStart(4)).join("  ") + "   " + o.title);
    console.log("                               gains: " + o.gains);
    console.log("                               cost:  " + o.givesUp);
  }
  console.log("\n  CHAMPIONS");
  for (const k of K) {
    const mx = Math.max(...S.options.map((o) => o.fingerprint[k]));
    const tops = S.options.filter((o) => o.fingerprint[k] === mx);
    console.log(`    ${NAME[k].padEnd(26)} ${tops.length === 1 ? tops[0].title : "TIE: " + tops.map((o) => o.title).join(" | ")} (${mx})`);
  }
  console.log("\n  THE APA PAGE: after picking a value, the participant sees");
  for (const k of K) {
    const m = S.options.filter((o) => main(o) === k);
    const list = m.length ? m : [...S.options].sort((a, b) => b.fingerprint[k] - a.fingerprint[k]).slice(0, 1);
    console.log(`    ${NAME[k].padEnd(26)} → ${list.map((o) => o.title).join(" | ")}${m.length ? "" : "  [fallback: top scorer]"}`);
  }
  console.log("\n  BEST FIT, over 100,000 random value profiles");
  const wins = new Map(S.options.map((o) => [o.id, 0]));
  for (let n = 0; n < 100000; n++) {
    const p = {}; K.forEach((k) => (p[k] = Math.floor(Math.random() * 101)));
    let best = null, bv = Infinity;
    for (const o of S.options) { const v = penalty(o, p); if (v < bv) { bv = v; best = o; } }
    wins.set(best.id, wins.get(best.id) + 1);
  }
  for (const o of S.options) console.log(`    ${(wins.get(o.id) / 1000).toFixed(1).padStart(5)}%  ${o.title}`);
}
