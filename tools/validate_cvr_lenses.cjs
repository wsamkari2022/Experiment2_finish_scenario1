/**
 * validate_cvr_lenses.cjs — builds every CVR lens the experiment can produce and checks it.
 *
 * 5 scenarios x 6 options x 2 lenses = 60 combinations. A missing parallelRule, an empty field or
 * a stray "undefined" would otherwise only surface in front of a participant, on one specific
 * option, in one specific scenario, under one specific framing — the kind of gap that is very
 * unlikely to be caught by clicking around.
 *
 * Run: npm run validate:lenses   (chained into npm run validate:block5)
 */
const path = require("node:path");
const fs = require("node:fs");

const BUILD = path.join(__dirname, "..", ".sim-build");
if (!fs.existsSync(BUILD)) {
  console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const R = (f) => require(path.join(BUILD, f));

const { getCVRStory, getCVRLensPair } = R("block5CVRContent.js");
const { BLOCK5_SCENARIOS } = R("block5Scenarios.js");
const { scenarioIsScored } = R("block5CVR.js");

/*
 * Only scenarios a reflection can actually fire in are checked.
 *
 * Recipient scenarios carry no cvrSeed, so every lens built for them resolves through the GENERIC
 * fallback and passes — 48 combinations reporting ok for text no participant will ever see. That is
 * not a gate, it is padding, and it makes the headline count mean something other than what it
 * says. Skipping them keeps "N combinations with no gaps" a statement about reachable content.
 */
const LENS_SCENARIOS = BLOCK5_SCENARIOS.filter(scenarioIsScored);
const SKIPPED_LENS = BLOCK5_SCENARIOS.length - LENS_SCENARIOS.length;
const { SHOW_LENS_VIGNETTES } = R("blocksLegacyMethodology.js");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const WHO = { lead: "Someone close to you says:", label: "someone close" };
const plain = (s) => s.replace(/\{[avfwb]\|([^}]*)\}/g, "$1");

let fails = 0;
const bad = [];
const gate = (ok, msg) => { console.log(`  ${ok ? "  ok  " : " FAIL "} ${msg}`); if (!ok) fails++; };

console.log("\n=== CVR LENS INTEGRITY ===\n");

if (!SHOW_LENS_VIGNETTES) {
  console.log("  SHOW_LENS_VIGNETTES is off — the original single-clause framing is in use.");
  console.log("  Skipping lens checks (that is the documented revert path).\n");
  process.exit(0);
}

let built = 0;
for (const s of LENS_SCENARIOS) {
  for (const violatedKey of POLICY) {
    for (const framing of ["context", "directness"]) {
      for (const o of s.options) {
        const where = `${s.id}/${o.id}/${framing}/${violatedKey.replace("Sensitivity", "")}`;
        const st = getCVRStory(s, o, { violatedKey, framing, who: "close" }, WHO);
        built++;
        if (!st.lens) { bad.push(`${where}: no lens`); continue; }
        const { heading, body, prompt } = st.lens;
        if (!heading || !body || !prompt) bad.push(`${where}: empty field`);
        if (/undefined|\[object/.test(body + prompt)) bad.push(`${where}: unresolved value in text`);
        // The framing clause must have moved OUT of the recontext paragraph — leaving it there
        // would mean the participant reads the lens twice, once as an assertion.
        if (/\{f\|/.test(st.recontext)) bad.push(`${where}: framing clause still inside recontext`);
        // The context lens must actually name a second place; the directness lens must not.
        if (framing === "context" && !/A rule decides there too/.test(body) && !/somewhere else entirely/.test(body)) {
          bad.push(`${where}: context lens does not transplant`);
        }
        if (framing === "directness" && /somewhere else/.test(body)) {
          bad.push(`${where}: directness lens leaves its own context`);
        }
      }
    }
  }
}
gate(bad.length === 0, `${built} reachable lens combinations built${bad.length ? "" : " with no gaps"}`
  + (SKIPPED_LENS ? ` (${SKIPPED_LENS} recipient scenario(s) skipped — no reflection fires there)` : ""));
bad.slice(0, 12).forEach((b) => console.log(`        ${b}`));

/* The pair used by the dual-perspective question must differ only in framing. */
const s0 = LENS_SCENARIOS[0];
const pair = getCVRLensPair(s0, s0.options[0],
  { violatedKey: POLICY[0], framing: "context", who: "close" });
gate(pair.context.framing === "context" && pair.directness.framing === "directness",
  "the comparison pair returns one lens of each kind");
gate(plain(pair.context.prompt) !== plain(pair.directness.prompt),
  "the two lenses ask visibly different questions");

console.log("\n" + "=".repeat(72));
console.log(fails === 0 ? "### ALL CVR LENS GATES PASSED ###" : `### ${fails} LENS GATE FAILURE(S) ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails ? 1 : 0);
