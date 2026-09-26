/**
 * build_rater_sheet.cjs — the BLIND rating sheet for the option-value review (audit D1 / D2, Fix 3
 * Step B), one shuffled copy per rater, built from the real scenario content.
 *
 * WHY IT EXISTS (26 September 2026). Every option carries four hidden value numbers, and every score
 * in the study is computed from them, while participants only ever read the card's words. The
 * review asks independent raters to score every option from its WORDS alone, so the numbers can be
 * compared with what the words say. The researcher has no human raters available, so the raters are
 * Claude models (Opus, Sonnet, Fable, Haiku), each in a fresh context with no tools: an AI-assisted
 * blind content review, adjudicated by the researcher - not human inter-rater reliability.
 *
 * WHAT A RATER SEES - exactly what a participant reads, and nothing else:
 *   - each scenario's story, situation and role (highlight markup stripped);
 *   - each value's meaning (what a HIGH number on an option means, as the study defines it) and its
 *     "In this scenario" line (getCVRValueHere), as printed in the values panel;
 *   - each option's title, how it is carried out, summary, what it gains, what it gives up, the
 *     moral question, and the fuller "what happens" line shown after choosing.
 * WHAT A RATER NEVER SEES: the value numbers (fingerprint), the performance numbers (metrics), the
 * option ids, the planner's order or any label. By construction: this file never reads those fields
 * into the sheet, and `--check` fails if any of them appears.
 *
 * SHUFFLED PER RATER. Each rater gets its own letters A-F for the six options of a scenario, in its
 * own order, so the order on the page cannot steer the ratings the same way for everybody. The key
 * that maps letters back to option ids is written to a separate file that raters never receive.
 *
 * Scenarios 1-4 only: scenario 5 repeats scenario 4's six options, and scenario 6's four rules are
 * each written as one value on purpose.
 *
 *   node tools/build_rater_sheet.cjs <out-dir>          (after npx tsc -p tools/tsconfig.sim.json)
 */
const fs = require("node:fs");
const path = require("node:path");

const BUILD = path.join(__dirname, "..", ".sim-build");
if (!fs.existsSync(BUILD)) {
  console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const { BLOCK5_SCENARIOS } = require(path.join(BUILD, "block5Scenarios.js"));
const { getCVRValueHere } = require(path.join(BUILD, "block5CVRContent.js"));

const OUT = process.argv[2];
if (!OUT) { console.error("  usage: node tools/build_rater_sheet.cjs <out-dir> [--scenarios 2,3,4] [--round 2]"); process.exit(1); }
const argOf = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null);
/* Round 2 (26 September 2026) re-rates only the scenarios whose words changed in Fix 6 Part B, with its
   own shuffles and check codes, so no copy repeats round 1. Scenario numbers stay the study's own. */
const ROUND = Number(argOf("--round") || 1);
const WANTED = (argOf("--scenarios") || "1,2,3,4").split(",").map(Number);
fs.mkdirSync(OUT, { recursive: true });

/* The raters and the seed that shuffles each one's copy. Fixed, so the sheets can be rebuilt. */
const RATERS = ROUND === 1
  ? [["opus", 20260926], ["sonnet", 20260927], ["fable", 20260928], ["haiku", 20260929]]
  : [["opus", 20261126], ["sonnet", 20261127], ["haiku", 20261129]];
/* The last line of each copy carries a check code the rater must copy back: a copy cut short on its
   way to the rater has no last line, so its answer says "MISSING" instead of the code. */
const CHECK_CODES = ROUND === 1
  ? { opus: "amber-falcon-17", sonnet: "cedar-orchard-58", fable: "silver-meadow-23", haiku: "copper-willow-91" }
  : { opus: "maple-river-64", sonnet: "birch-stone-37", haiku: "slate-field-82" };

/* The four values: the participant-facing name, and what a HIGH number on an option means, as the
   study defines it (the value table the 18 September value audit used). */
const VALUES = [
  ["vulnerable", "vulnerabilityProtectionSensitivity", "Protecting the vulnerable",
    "the people least able to cope are protected or put first"],
  ["harm", "groupSizeSensitivity", "Reducing harm",
    "the FEWEST people end up harmed by this choice (not \"nobody is singled out\")"],
  ["gain", "gainResponsivenessSensitivity", "How much is gained",
    "the biggest payoff: money for an organization, speed and safety for the chooser, years of life per dose"],
  ["helped", "outcomeAggregationSensitivity", "How many are helped",
    "the MOST people helped in total, after subtracting anyone it harms"],
];

const strip = (t) => String(t ?? "").replace(/\{[a-z]\|([^}]*)\}/g, "$1").trim();
function shuffled(list, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const DECIDERS = BLOCK5_SCENARIOS.filter((s) => (s.decisionRole ?? "decider") === "decider");
const NUMS = WANTED.filter((n) => n >= 1 && n <= DECIDERS.length);
const SCENARIOS = NUMS.map((n) => DECIDERS[n - 1]);
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function sheetFor(rater, seed) {
  const key = {};
  const out = [];
  out.push(`# Blind rating sheet - option values`, "");
  out.push(`Rater copy: ${rater}. The options are in a random order made for this copy only.`, "");
  out.push("## The four values", "");
  out.push("Every option in every scenario is scored on the same four values. For each value, a HIGH score means:", "");
  for (const [, , name, high] of VALUES) out.push(`- **${name}**: ${high}.`);
  out.push("", "Each scenario below also says what each value means in that scenario.", "");
  SCENARIOS.forEach((s, si) => {
    const here = getCVRValueHere(s);
    const order = shuffled(s.options, seed + si * 7919);
    key[`scenario_${NUMS[si]}`] = Object.fromEntries(order.map((o, i) => [LETTERS[i], o.id]));
    out.push("---", "", `## Scenario ${NUMS[si]}: ${s.title}`, "");
    out.push(`**What is happening.** ${strip(s.description)}`, "");
    if (s.factBase) out.push(`**The situation right now.** ${strip(s.factBase)}`, "");
    if (s.role) out.push(`**Your role.** ${strip(s.role)}`, "");
    if (here) {
      out.push("**What each value means in this scenario.**", "");
      for (const [, k, name] of VALUES) out.push(`- ${name}: ${strip(here[k])}.`);
      out.push("");
    }
    out.push(`**The six options** (${s.methodLabel ? s.methodLabel.toLowerCase() : "each carried out as described"}):`, "");
    order.forEach((o, i) => {
      out.push(`### Option ${LETTERS[i]}: ${strip(o.title)}`, "");
      if (o.method) out.push(`- How: ${strip(o.method.by)}${o.method.detail ? ` - ${strip(o.method.detail)}` : ""}`);
      out.push(`- Summary: ${strip(o.summary)}`);
      if (o.gains) out.push(`- What it gains: ${strip(o.gains)}`);
      if (o.givesUp) out.push(`- What it gives up: ${strip(o.givesUp)}`);
      if (o.consequence) out.push(`- What happens (shown after choosing it): ${strip(o.consequence)}`);
      if (o.moralTension) out.push(`- The question it raises: ${strip(o.moralTension)}`);
      out.push("");
    });
  });
  out.push("---", "", `End of sheet. Check code: ${CHECK_CODES[rater]}`);
  key.sheet_check_code = CHECK_CODES[rater];
  return { text: out.join("\n"), key };
}

let problems = 0;
for (const [rater, seed] of RATERS) {
  const { text, key } = sheetFor(rater, seed);
  /* NOTHING HIDDEN MAY LEAK: no field names, no ids, and none of the 7 value-number keys. */
  const leaks = ["fingerprint", "metrics", "Sensitivity", "_", "resourceUse", "reversibility"]
    .filter((w) => w !== "_" ? text.includes(w) : /\b[a-z]+_[a-z_]+\b/.test(text));
  for (const s of SCENARIOS) for (const o of s.options) if (text.includes(o.id)) leaks.push(o.id);
  if (leaks.length) { problems++; console.error(`  ${rater}: LEAK ${leaks.join(", ")}`); }
  fs.writeFileSync(path.join(OUT, `sheet_${rater}.md`), text);
  fs.writeFileSync(path.join(OUT, `key_${rater}.json`), JSON.stringify(key, null, 2));
  console.log(`  ${rater}: ${text.split(/\s+/).length} words, ${SCENARIOS.length} scenarios, key written separately`);
}
if (problems) process.exit(1);
console.log("  no value number, performance number, field name or option id in any sheet");
