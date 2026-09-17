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
        const { heading, body } = st.lens;
        /*
         * A LENS MAY CLOSE ON NOTHING. The context lens has no `prompt` any more: it ends on its
         * last consequence, because a closing line insisting nobody is to blame raises blame as
         * surely as naming somebody would. So `prompt` is optional here, and the directness gate
         * below is what keeps the directness lens from quietly losing its own closing line.
         */
        const prompt = st.lens.prompt ?? "";
        if (!heading || !body) bad.push(`${where}: empty field`);
        if (/undefined|\[object/.test(body + prompt)) bad.push(`${where}: unresolved value in text`);
        // Only the directness lens is REQUIRED to close on a line, and it must name the participant.
        if (framing === "directness" && !prompt) bad.push(`${where}: directness lens has no closing line`);
        if (framing === "context" && prompt) bad.push(`${where}: context lens has a closing line - it must end on its consequence`);
        /*
         * THE GATES BELOW REPLACED PHRASE-MATCHING, and the reason is worth keeping.
         *
         * They used to require the literal string "A rule decides there too" in every context
         * body. That is a check on one author's sentence, not on the property the lens has to
         * have, and it broke the moment the sentence was rewritten — while a lens that genuinely
         * stopped transplanting would have sailed through as long as it kept the phrase.
         *
         * These check the properties instead: nobody is named in the context lens, the
         * participant is named in the directness lens, and neither says "same".
         */

        // NOBODY IS BLAMED IN THE CONTEXT LENS. The missing accusation IS the manipulation: if
        // this block also pointed at the participant it would be a second directness lens.
        if (framing === "context" && /\byou\b|\byour\b/i.test(plain(body) + " " + plain(prompt))) {
          bad.push(`${where}: context lens says "you" — it must blame nobody`);
        }
        // THE DIRECTNESS LENS MUST NAME THE PARTICIPANT. That is the whole of what it varies.
        if (framing === "directness" && !/\byou\b/i.test(plain(body) + " " + plain(prompt))) {
          bad.push(`${where}: directness lens never names the participant`);
        }
        /*
         * NEITHER LENS MAY ANNOUNCE THE RESEMBLANCE — checked on the HEADING and the PROMPT, not
         * on the whole block.
         *
         * Those two are ours: written once per lens, identical for every option, and they are
         * where an announcement would live ("The same rule, somewhere else"). The BODY is
         * different — it carries authored option text, and an option can legitimately be ABOUT
         * sameness. Scenario 4 has one that "takes the same share off every client", where the
         * word is the option's own meaning rather than a nudge. Banning the English word outright
         * would have forced that option to be reworded into something it is not.
         */
        if (/\bsame\b|\bjust like\b/i.test(plain(heading) + " " + plain(prompt))) {
          bad.push(`${where}: lens heading or prompt announces the resemblance`);
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
gate(!pair.context.prompt && !!pair.directness.prompt,
  "only the directness lens closes by naming anybody");

console.log("\n" + "=".repeat(72));
console.log(fails === 0 ? "### ALL CVR LENS GATES PASSED ###" : `### ${fails} LENS GATE FAILURE(S) ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails ? 1 : 0);
