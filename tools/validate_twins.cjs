/**
 * validate_twins.cjs — scenarios 4 and 5 are the same six options written twice, and nothing
 * enforced it until now.
 *
 * WHY THIS IS A BLOCKING GATE
 * ---------------------------
 * From block5Mirror.ts, on the measure these two scenarios exist to produce:
 *
 *     Because the content is held exactly constant, ANY difference between the two is
 *     attributable to position and to nothing else.
 *
 * That sentence is the claim. This file is the only thing that makes it true. Edit one half alone
 * and every number downstream still computes — the position effect, the decided-versus-wished
 * comparison, the whole matched pair — and starts silently measuring CONTENT instead of POSITION,
 * which is the single confound the design was built to remove.
 *
 * It fails LOUDLY and names the option and the field, because the failure mode it guards against is
 * invisible: nothing looks wrong, no number goes out of range, and the study simply stops measuring
 * what it says it measures.
 *
 * WHY IT IS IN THE BLOCKING CHAIN and audit:rules is not: this one passes today. A validator that
 * cannot pass gets switched off; a validator that can, and does, is worth stopping a build for.
 *
 * WHAT IT DOES NOT CHECK, deliberately — see mirrorContentDifferences in block5Mirror.ts for the
 * reasoning: the option ids are prefixed differently on purpose, the recipient half carries no
 * cvrSeed by design, and the two scenarios' own situation boxes, roles and titles are MEANT to
 * differ, because one asks what you decide and the other what you hope somebody else decides.
 *
 * Run: npm run validate:twins   (chained into npm run validate:block5)
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

const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { mirrorContentDifferences } = B("block5Mirror.js");

let fails = 0;
const ok = (name, cond, detail) => {
  console.log("  " + (cond ? "PASS" : "FAIL") + "  " + name.padEnd(58) + (detail || ""));
  if (!cond) fails++;
};

console.log("\n" + "=".repeat(78));
console.log("  THE MATCHED PAIR: the same six options, decided once and wished once");
console.log("=".repeat(78));

/*
 * PAIRED BY EMPLOYER, NEVER BY POSITION IN THE LIST — the same rule block5Mirror.ts uses. Matching
 * on order would quietly pair the wrong two the first time a scenario is inserted between them.
 */
const recipient = BLOCK5_SCENARIOS.find((s) => s.decisionRole === "recipient" && s.employer);
const decider = recipient && BLOCK5_SCENARIOS.find(
  (s) => s.id !== recipient.id
    && (s.decisionRole ?? "decider") === "decider"
    && s.employer?.name === recipient.employer?.name,
);

if (!recipient || !decider) {
  /*
   * NOT A FAILURE. A deck with no decide/wish pair simply has no mirror to protect, and the
   * position analysis already reports itself as descriptive in that case. Failing here would mean
   * a deck could not drop the pair without this file refusing to let it build.
   */
  console.log("\n  No decide/wish pair on this deck — nothing to hold constant. Skipped.\n");
  console.log("=".repeat(78) + "\n");
  process.exit(0);
}

console.log("\n  " + decider.id + "  (decides for others)");
console.log("  " + recipient.id + "  (wishes for themselves)\n");

const diffs = mirrorContentDifferences(decider.id, recipient.id);

ok("the two halves offer the same number of options",
   decider.options.length === recipient.options.length,
   `${decider.options.length} and ${recipient.options.length}`);

ok("every option matches its twin on every authored field",
   diffs.length === 0,
   diffs.length === 0
     ? `${decider.options.length} options, all fields identical`
     : `${diffs.length} difference(s)`);

for (const d of diffs) console.log("          " + d);

/*
 * THE ORDER MATTERS AS MUCH AS THE CONTENT. The card order is produced by the planner from the
 * frozen profile, so with the same six options it is necessarily the same order both times —
 * which is exactly why the pair must not be reordered by hand. See the note in block5Mirror.ts on
 * why shuffling the second presentation was considered and rejected.
 */
ok("the twins are in the same order",
   decider.options.every((o, i) => o.title === recipient.options[i]?.title),
   "compared by title, position for position");

/* The recipient half runs no reflection: no vignette, therefore no profile churn. */
ok("the recipient half carries no cvrSeed",
   recipient.options.every((o) => !o.cvrSeed),
   recipient.options.some((o) => o.cvrSeed) ? "a wish scenario must run no reflection" : "none of the 6");

console.log("\n" + "=".repeat(78));
console.log(fails === 0
  ? "### THE MATCHED PAIR IS INTACT ###"
  : `### ${fails} TWIN GATE FAILURE(S) — the position effect is measuring content ###`);
console.log("=".repeat(78) + "\n");
process.exit(fails ? 1 : 0);
