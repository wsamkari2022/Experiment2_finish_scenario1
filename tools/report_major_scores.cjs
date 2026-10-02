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
 *   Section 9      a pointer to docs/MAJOR_SCORES_BY_CONDITION.md, which this run also writes (tools/report_conditions_page.cjs,
 *                  the rules in tools/condition_sim.cjs): the same pretend people in each of the four conditions, since
 *                  1 October 2026.
 * Seeded throughout: the same code gives the same page (only the date and version line change).
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "MAJOR_SCORES_DISTRIBUTION.md");
const { KINDS, measureAll } = require("./behavior_sim.cjs");
const { VCI_LEVELS } = require(path.join(ROOT, ".sim-build", "block5CVR.js"));
const { VCI_ALL_LEVELS } = require(path.join(ROOT, ".sim-build", "block5VciAll.js"));

/* ------------------------------------------------------------------ the version line */
const git = (args) => { try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return null; } };
const head = git(["rev-parse", "--short", "HEAD"]) ?? "unknown";
const dirty = (git(["status", "--porcelain"]) ?? "").split("\n").filter((l) => l.trim() && !l.includes("MAJOR_SCORES_DISTRIBUTION.md") && !l.includes("MAJOR_SCORES_BY_CONDITION.md")).length > 0;
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
line("| **VCI_all** (0-100, since 28 September 2026) | The same over all six scenarios - the four decisions, the wish and the veil (its final choice) - on hidden running values that also move after the wish and the veil | Blind 50; always the best fit 100; its level edges are its own (88.89 / 77.78 / 62.5 / 47.22 / 27.78), derived the same way as VCI's |");
line("| **Stability** (0-100) | Whether the four values stayed the same when the participant went against their best fit. Since 2 October 2026 the average of two parts: did their ORDER change (swaps), and how far did they MOVE | 100 = they held, or it was never tested (see \"not measured\"); levels at 94 / 85 / 63 / 49 |");
line("| **Stability_all** (0-100, since 29 September 2026) | The same rule over all six scenarios, on the running values: the wish and the veil count when the final choice was not one of the two best fits | Never above Stability; 100 = the order held, or it was never tested |");
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

line("## 1b. VCI_all (all six scenarios)");
line("");
line("The same pretend people; scenario 5 is shown on scenario 4's opening values, as on the page. VCI_all contains VCI's");
line("four decisions, so the two are never correlated; the difference says how the wish and the veil compare with deciding.");
line("It includes the two stated scenario-5 effects (the echo, and the wishes that followed the screen but score below 100).");
line("");
line(`| Kind | Mean | p10 | p50 | p90 | VCI_all - VCI (mean) | ${VCI_ALL_LEVELS.map((l) => l.label).join(" | ")} |`);
line(`|---|---|---|---|---|---|${VCI_ALL_LEVELS.map(() => "---").join("|")}|`);
for (const k of KINDS) {
  const v = col(k, "vciAll");
  const d = res[k].map((r) => r.vciAll - r.vci);
  line(`| ${k} | ${mean(v).toFixed(0)} | ${q(v, 0.1)} | ${q(v, 0.5)} | ${q(v, 0.9)} | ${mean(d) >= 0 ? "+" : ""}${mean(d).toFixed(1)} | ${levelShares(k, "vciAllLevel", VCI_ALL_LEVELS).join(" | ")} |`);
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

line("## 2b. Stability_all (all six scenarios)");
line("");
line("Stability's own rule over all six scenarios, on the hidden running values behind VCI_all (since 29 September 2026):");
line("the four decisions count exactly as in Stability, the wish and the veil when the final choice was not one of the two");
line("best fits. It contains Stability, so it is never higher and the two are never correlated; the difference says what");
line("the wish and the veil added. \"Not measured\" = no step counted in any of the six.");
line("");
line(`| Kind | Mean | p10 | p50 | p90 | Stability_all - Stability (mean) | Not measured | ${STABILITY_LEVELS.map((l) => l.label).join(" | ")} |`);
line(`|---|---|---|---|---|---|---|${STABILITY_LEVELS.map(() => "---").join("|")}|`);
for (const k of KINDS) {
  const v = col(k, "stabilityAll");
  const d = res[k].map((r) => r.stabilityAll - r.stability);
  const notMeasured = res[k].filter((r) => !r.stabilityAllMeasured).length / v.length;
  line(`| ${k} | ${mean(v).toFixed(0)} | ${q(v, 0.1)} | ${q(v, 0.5)} | ${q(v, 0.9)} | ${mean(d) >= 0 ? "+" : ""}${mean(d).toFixed(1)} | ${pct(notMeasured)} | ${levelShares(k, "stabilityAllLevel", STABILITY_LEVELS).join(" | ")} |`);
}
line("");
line("## 2c. Top-value choices (saved, never shown)");
line("");
line("In how many of the six scenarios the final choice was the option that does most for the #1 value brought into");
line("Block 5, and for the #1 or #2 value (since 29 September 2026; analysis.top_value_choices). Choosing blindly gives");
line(`${mean(col(KINDS[0], "blindTopValue")).toFixed(2)} and ${mean(col(KINDS[0], "blindTopOrSecond")).toFixed(2)} of 6 on these menus (worked out for these same people). It looks at the top value(s) only, so it is not VCI.`);
line("");
line("| Kind | #1 value (mean, of 6) | #1 or #2 value (mean, of 6) | 6 of 6 on the #1 value |");
line("|---|---|---|---|");
for (const k of KINDS) {
  const a = col(k, "topValue"), b = col(k, "topOrSecond");
  line(`| ${k} | ${mean(a).toFixed(1)} | ${mean(b).toFixed(1)} | ${pct(a.filter((x) => x === 6).length / a.length)} |`);
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
line("- **Stability from two parts** (2 Oct 2026): Stability and Stability_all are the average of the order part (the swaps, the");
line("  whole rule until then) and a difference part (how far the four values moved at the counted steps); new level edges.");
line("- **The four conditions** (1 Oct 2026): CVR_Only, APA_Only and Baseline differ from Block 5 on. Every number on THIS page");
line("  is condition 1 (CVR+APA, the full version); the other three are on docs/MAJOR_SCORES_BY_CONDITION.md (section 9).");
line("");
line("When a new change is made, add one line here (in `tools/report_major_scores.cjs`) and run the generator again.");
line("");
line("## 9. The four conditions");
line("");
line("This page is condition 1 (CVR+APA). **docs/MAJOR_SCORES_BY_CONDITION.md**, written by the same command, lets the same");
line("pretend people through all four conditions (two versions of Baseline and of APA_Only's random responder, as the");
line("researcher asked on 1 October 2026), with an explanation and an example after every table.");

fs.writeFileSync(OUT, L.join("\n") + "\n");
console.log(`  wrote ${path.relative(ROOT, OUT)} (${L.length} lines) from code ${head}${dirty ? " + uncommitted changes" : ""}`);
const byCondition = require("./report_conditions_page.cjs").writeConditionsPage({ root: ROOT, head, dirty, date, mainResults: res });
console.log(`  wrote ${byCondition.file} (${byCondition.lines} lines); condition 1 against this page: ${byCondition.cond1Diff} differences`);
if (byCondition.cond1Diff !== 0) { console.error("  CONDITION 1 DOES NOT REPRODUCE THIS PAGE - the condition simulation has drifted"); process.exit(1); }
/* Since 2 October 2026: Stability's level edges, derived again from the same people (MAJOR_SCORES_BY_CONDITION.md section 7). */
console.log(`  Stability's level edges derived again: ${byCondition.edges}`);
if (!byCondition.edgesOk) { console.error("  STABILITY'S LEVEL EDGES HAVE DRIFTED - update COMBINED_STABILITY_EDGES in block5CVR.ts (and its docs)"); process.exit(1); }
