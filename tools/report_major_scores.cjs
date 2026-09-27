/**
 * report_major_scores.cjs — writes docs/MAJOR_SCORES_DISTRIBUTION.md: how every major score comes out for
 * every kind of pretend participant, with the code as it stands (26 September 2026, the researcher's request:
 * "create an MD file for Major Scores user's behavior distribution ... and update this table when we update
 * anything").
 *
 * WHY A GENERATOR AND NOT A HAND-WRITTEN TABLE. Numbers typed by hand go stale the first time an option
 * number or a rule changes, and nobody notices. This file is rebuilt from the real code in one command, so
 * "update the table" means running it again, and the page says which code version it was made from.
 *
 * RUN IT AFTER ANY CHANGE to an option number, a scoring rule, a step size, the planner or a scenario:
 *   npm run report:major-scores
 * and commit the new docs/MAJOR_SCORES_DISTRIBUTION.md with the change (CLAUDE.md says so too).
 *
 * WHERE THE NUMBERS COME FROM
 *   Sections 1-4   tools/behavior_sim.cjs: the pretend people of report:vci (2,000 starting profiles x 12 kinds,
 *                  seeded), through the real Block 5 code; VCI is identical to report:vci person by person.
 *   Section 5      the text of `npm run report:planner-overlap` (pretend people who answer Blocks 1-4).
 *   Section 6      the ratio lines of `npm run validate:position`.
 *   Section 7      the summary and calibration of `npm run validate:prediction`.
 * Seeded throughout: the same code gives the same page (only the date and version line change).
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "MAJOR_SCORES_DISTRIBUTION.md");
const { KINDS, measureAll } = require("./behavior_sim.cjs");
const { VCI_LEVELS } = require(path.join(ROOT, ".sim-build", "block5CVR.js"));

/* ------------------------------------------------------------------ the version line */
const git = (args) => { try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return null; } };
const head = git(["rev-parse", "--short", "HEAD"]) ?? "unknown";
const dirty = (git(["status", "--porcelain"]) ?? "").split("\n").filter((l) => l.trim() && !l.includes("MAJOR_SCORES_DISTRIBUTION.md")).length > 0;
const today = new Date();
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

/* ------------------------------------------------------------------ sections 1-4 */
const res = measureAll();
const q = (a, t) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(t * (s.length - 1))]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const col = (beh, k) => res[beh].map((r) => r[k]).filter((v) => v !== null && v !== undefined);
const pct = (x) => `${Math.round(100 * x)}%`;
const sep = (a, b) => { let w = 0, t = 0; for (const x of a) for (const y of b) { if (x > y) w++; else if (x === y) t++; } return (w + t / 2) / (a.length * b.length); };

const WHAT = {
  "Always aligned": "always takes their best-fit option",
  "Always weakly aligned": "always takes their second-best fit",
  "Top-two mixer": "takes the best or the second-best fit, half and half",
  "True to top value": "always takes the option that serves their #1 value (from Blocks 1-4) most",
  "Corrected by APA": "picks a misaligned option, then names their current top value on the APA page and switches",
  "Convert (keeps)": "changes their mind once, in scenario 1 (a misaligned pick, kept), then stays true to the new value",
  "Convert (via APA)": "the same one change, made through the APA page",
  "Performance chaser": "ignores values: always the option with the best performance numbers",
  "Random responder": "everything at random: the option, the reflection route and every APA answer",
  "Flip-flopper (keeps)": "a new value every scenario (never their current top), keeping each choice",
  "Flip-flopper (via APA)": "the same flip-flopper, saying so on the APA page each time",
  "Always the worst fit": "always takes their worst-fit option",
};
/* Stability's level list is not exported by block5CVR.ts (and the study code is not changed for a report), so its
   names are read from the results themselves, highest-scoring level first. They cannot drift from the code. */
const STABILITY_LEVELS = (() => {
  const byLabel = new Map();
  for (const k of KINDS) for (const r of res[k]) (byLabel.get(r.stabilityLevel) ?? byLabel.set(r.stabilityLevel, []).get(r.stabilityLevel)).push(r.stability);
  return [...byLabel.entries()].map(([label, v]) => ({ label, top: Math.max(...v) })).sort((x, y) => y.top - x.top);
})();
const levelShares = (beh, key, levels) => levels.map((l) => pct(res[beh].filter((r) => r[key] === l.label).length / res[beh].length));
const L = [];
const line = (s = "") => L.push(s);

line("# Major scores by kind of participant");
line("");
line(`> **Generated** by \`npm run report:major-scores\` on ${date}, from code version \`${head}\`${dirty ? " plus changes not yet committed" : ""}.`);
line("> Do not edit this page by hand: change `tools/report_major_scores.cjs` and run it again. **Run it after every change**");
line("> to an option number, a scoring rule, a step size, the planner or a scenario, and commit the new page with the change.");
line("");
line("## How to read this page");
line("");
line("These are **pretend participants, not real people**. 2,000 random starting profiles (every value equally likely");
line("between 0 and 100) each go through the six scenarios twelve times, once as each kind of chooser below, using the");
line("study's real scoring code. The same 2,000 profiles and the same random draws are used for every kind, so the kinds");
line("can be compared fairly. The numbers are the same on every run, until the code changes.");
line("");
line("| Kind | What this pretend participant does |");
line("|---|---|");
for (const k of KINDS) line(`| ${k} | ${WHAT[k] ?? ""} |`);
line("");
line("| Score | What it measures | What a fair or good value looks like |");
line("|---|---|---|");
line("| **VCI** (0-100) | How well the four decisions fit the participant's own values | Picking blindly gives 50; always the best fit gives 100; always the worst fit 10 |");
line("| **Stability** (0-100) | Whether the order of the four values changed when the participant went against their best fit | 100 = the order held, or it was never tested (see \"not measured\") |");
line("| **Performance** (0-100, end of study) | How good the chosen options were, inside each scenario | 0 = the weakest option in every decision, 100 = the strongest; random choosing gives about 50 |");
line("");
line("\"p10 / p50 / p90\": 10 in 100 people score at or below the first number, half at or below the second, 90 in 100 at");
line("or below the third. The level columns are the share of people in each named level.");
line("");

line("## 1. VCI");
line("");
line(`| Kind | Mean | p10 | p50 | p90 | ${VCI_LEVELS.map((l) => l.label).join(" | ")} |`);
line(`|---|---|---|---|---|${VCI_LEVELS.map(() => "---").join("|")}|`);
for (const k of KINDS) {
  const v = col(k, "vci");
  line(`| ${k} | ${mean(v).toFixed(0)} | ${q(v, 0.1)} | ${q(v, 0.5)} | ${q(v, 0.9)} | ${levelShares(k, "vciLevel", VCI_LEVELS).join(" | ")} |`);
}
line("");

line("## 2. Stability");
line("");
line("\"Not measured\" = the share who never went against their best fit in a decision, so no reflection ran and there");
line("was nothing to count: their Stability is 100 by default. \"Mean if measured\" leaves them out. The database says");
line("which is which (`headline.stability_was_measured`, since 26 September 2026).");
line("For the random chooser the shares can differ by about one point from `npm run report:stability`, which draws its");
line("random APA answers in a different order; every other kind is identical to that report, and VCI (section 1) is");
line("identical to `npm run report:vci` for every one of the 24,000 pretend people.");
line("");
line(`| Kind | Mean | p10 | p50 | p90 | Not measured | Mean if measured | ${STABILITY_LEVELS.map((l) => l.label).join(" | ")} |`);
line(`|---|---|---|---|---|---|---|${STABILITY_LEVELS.map(() => "---").join("|")}|`);
for (const k of KINDS) {
  const v = col(k, "stability");
  const meas = res[k].filter((r) => r.measured).map((r) => r.stability);
  line(`| ${k} | ${mean(v).toFixed(0)} | ${q(v, 0.1)} | ${q(v, 0.5)} | ${q(v, 0.9)} | ${pct(1 - meas.length / v.length)} | ${meas.length ? mean(meas).toFixed(0) : "-"} | ${levelShares(k, "stabilityLevel", STABILITY_LEVELS).join(" | ")} |`);
}
line("");

line("## 3. Performance at the end of the study");
line("");
line("The mean of the four decisions' captured scores (scenario 5, a wish, and scenario 6, a test, are not counted).");
line("Following your own top value costs performance in this deck (true to top value against random choosers): that is");
line("the trade-off the study is built on, not a flaw in the score (HOW_TO_ANALYZE_MY_DATA.md 4.8).");
line("");
line("| Kind | Mean | p10 | p50 | p90 |");
line("|---|---|---|---|---|");
for (const k of KINDS) {
  const v = col(k, "performance");
  line(`| ${k} | ${mean(v).toFixed(0)} | ${q(v, 0.1)} | ${q(v, 0.5)} | ${q(v, 0.9)} |`);
}
line("");

line("## 4. How well the scores tell kinds apart");
line("");
line("How often the first kind scores higher than the second when one person of each is picked at random (ties count");
line("half). 0.50 is a coin; 1.00 is always.");
line("");
const PAIRS = [["True to top value", "Random responder"], ["Random responder", "Flip-flopper (keeps)"],
  ["Convert (keeps)", "Random responder"], ["Convert (keeps)", "Flip-flopper (keeps)"], ["Always aligned", "Random responder"]];
line("| First kind | Second kind | VCI | Stability | Performance |");
line("|---|---|---|---|---|");
for (const [a, b] of PAIRS) {
  line(`| ${a} | ${b} | ${sep(col(a, "vci"), col(b, "vci")).toFixed(2)} | ${sep(col(a, "stability"), col(b, "stability")).toFixed(2)} | ${sep(col(a, "performance"), col(b, "performance")).toFixed(2)} |`);
}
line("");
line("Read the Convert row as a known limit (audit G6): one honest change of mind scores about like random choosing on");
line("Stability. Stability's absolute level also depends on the step sizes (docs/BLOCK5_STEP_SIZE_SENSITIVITY.md); its");
line("comparisons between kinds do not.");
line("");

/* ------------------------------------------------------------------ sections 5-7: the other reports' own words */
const runTool = (file) => execFileSync(process.execPath, [path.join(__dirname, file)], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
const overlap = runTool("report_planner_overlap.cjs");
const position = runTool("simulate_position.cjs");
const prediction = runTool("validate_prediction.cjs");
const block = (text) => { line("```"); for (const l of text.replace(/\r/g, "").split("\n")) line(l.replace(/\s+$/, "")); line("```"); };

line("## 5. Card order: how often the first card is also the best fit, and how close the top two values are");
line("");
line("From `npm run report:planner-overlap` (pretend participants who answer Blocks 1-4, then the real planner):");
line("");
const o = overlap.replace(/\r/g, "");
block(o.slice(o.indexOf("  How often the first card")).trim());
line("");

line("## 6. Position check");
line("");
line("From `npm run validate:position`: for each kind of scripted participant, how much the menu alone moves the");
line("fit number (\"menu spread\") against how much their choice can (\"room inside a scenario\"). The check wants the");
line("ratio to be at least 3.");
line("");
block(position.replace(/\r/g, "").split("\n").filter((l) => /ratio|POSITION GATES/.test(l)).join("\n"));
line("");

line("## 7. Prediction (scenario 6)");
line("");
line("From `npm run validate:prediction`: how sure the prediction is, and how often it names the option a simulated");
line("chooser actually takes. Chance is 1 in 6 (16.7%) on six options.");
line("");
const pr = prediction.replace(/\r/g, "").split("\n");
const summary = pr.filter((l) => /top option's probability|chance alone would be|predictions claiming more than 60%/.test(l));
const from = pr.findIndex((l) => l.includes("--- calibration against simulated choosers ---"));
const to = pr.findIndex((l, i) => i > from && /Top-1 is identical/.test(l));
block([...summary, "", ...(from >= 0 && to > from ? pr.slice(from, to) : [])].join("\n").replace(/^\n+|\s+$/g, ""));
line("");

line("## 8. What these numbers already include");
line("");
line("The changes in force when this page was generated, most recent last (full records: docs/FRESH_EYE_AUDIT.md,");
line("the Log, and the dated sections of CLAUDE.md):");
line("");
line("- **Fix 6** (26 Sep 2026): nine option numbers moved to the blind raters' average; new words on several cards.");
line("- **Fix 7** (26 Sep 2026): eight value numbers and fourteen performance numbers from the second rater round.");
line("- **Fix 7b** (26 Sep 2026): two reliability numbers (Seal your apartment 23, the sickest 26).");
line("- **Fix 7c** (26 Sep 2026): which chip a card shows when two measures tie. Changes what cards say, no score.");
line("- **G5** (26 Sep 2026): the record says whether Stability measured anything. No score changed.");
line("- **C7** (26 Sep 2026): the gap between the #1 and #2 values is saved. No score or card order changed.");
line("- **B3** (26 Sep 2026): the step sizes were tested at half and double size; every conclusion held");
line("  (docs/BLOCK5_STEP_SIZE_SENSITIVITY.md). Nothing in the study changed.");
line("");
line("When a new change is made, add one line here (in `tools/report_major_scores.cjs`) and run the generator again.");

fs.writeFileSync(OUT, L.join("\n") + "\n");
console.log(`  wrote ${path.relative(ROOT, OUT)} (${L.length} lines) from code ${head}${dirty ? " + uncommitted changes" : ""}`);
