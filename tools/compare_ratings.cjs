/**
 * compare_ratings.cjs — reads the blind raters' answers (tools/build_rater_sheet.cjs made the sheets)
 * and compares them with each other and with the study's own option value numbers.
 *
 * WHAT IT REPORTS (26 September 2026, audit Fix 3 Step B):
 *   1. VALIDITY of each answer: complete (4 scenarios x 4 values x 6 options, a full ranking), scores
 *      0-100, and the rater's own statement that it used no tool and opened no file. An invalid
 *      answer is reported and left out of every figure below.
 *   2. AGREEMENT BETWEEN THE RATERS: ICC(2,1) - two-way random, absolute agreement, one rater - over
 *      all 96 option-value scores; the mean Spearman correlation between every pair of raters'
 *      rankings; and the mean distance between two raters' scores. For the thesis this is an
 *      AI-assisted blind content review, NOT human inter-rater reliability.
 *   3. AGREEMENT WITH THE STUDY: per scenario and value, the study's number next to the raters'
 *      mean, their spread, and the difference; the Spearman correlation between the study's order
 *      and the raters' order.
 *   4. FLAGS for the researcher to decide, one by one:
 *        - DISTANCE: the study's number is 20 or more points from the raters' mean;
 *        - ORDER: the study's top option on a value is not the raters' top option, or an option's
 *          place in the study's order differs from its place in the raters' order by 2 or more;
 *        - SPLIT: the raters are 30 or more points apart among themselves, which points at the card's
 *          words rather than its number.
 *
 *   node tools/compare_ratings.cjs <study-dir> [--rooms <rooms-dir>]
 *     <study-dir>/key_<rater>.json      letters -> option ids (from build_rater_sheet.cjs)
 *     <study-dir>/answers/<rater>.json  each rater's JSON answer, saved as it came back
 *     --rooms: first copy each <rooms-dir>/rater_<rater>/answer.json (build_rater_room.cjs) into
 *              answers/, and its probe_result.md and run_notes.md into runs/<rater>/, unchanged
 *   writes <study-dir>/REPORT.md and <study-dir>/comparison.json
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

const DIR = process.argv[2];
if (!DIR) { console.error("  usage: node tools/compare_ratings.cjs <study-dir> [--rooms <rooms-dir>]"); process.exit(1); }
const ROOMS = process.argv.includes("--rooms") ? process.argv[process.argv.indexOf("--rooms") + 1] : null;
if (ROOMS) {
  fs.mkdirSync(path.join(DIR, "answers"), { recursive: true });
  for (const room of fs.readdirSync(ROOMS).filter((f) => /^rater_[a-z]+$/.test(f))) {
    const r = room.slice("rater_".length);
    const src = path.join(ROOMS, room);
    if (!fs.existsSync(path.join(src, "answer.json"))) { console.log(`  ${room}: no answer.json yet`); continue; }
    fs.copyFileSync(path.join(src, "answer.json"), path.join(DIR, "answers", `${r}.json`));
    fs.mkdirSync(path.join(DIR, "runs", r), { recursive: true });
    for (const f of ["probe_result.md", "run_notes.md"]) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(DIR, "runs", r, f));
    console.log(`  ${room}: answer collected`);
  }
}

const VALUES = [
  ["vulnerable", "vulnerabilityProtectionSensitivity", "Protecting the vulnerable"],
  ["harm", "groupSizeSensitivity", "Reducing harm"],
  ["gain", "gainResponsivenessSensitivity", "How much is gained"],
  ["helped", "outcomeAggregationSensitivity", "How many are helped"],
];
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const DECIDERS = BLOCK5_SCENARIOS.filter((s) => (s.decisionRole ?? "decider") === "decider");
/* The scenarios this study-dir rated, read from its keys (round 2 rated 2, 3 and 4 only). */
const firstKey = fs.readdirSync(DIR).find((f) => /^key_[a-z]+\.json$/.test(f));
const NUMS = firstKey
  ? Object.keys(JSON.parse(fs.readFileSync(path.join(DIR, firstKey), "utf8"))).filter((k) => /^scenario_\d+$/.test(k)).map((k) => Number(k.slice(9))).sort((a, b) => a - b)
  : DECIDERS.map((_, i) => i + 1);
const SCENARIOS = NUMS.map((n) => DECIDERS[n - 1]);
const DISTANCE_FLAG = 20;
const PLACE_FLAG = 2;
const SPLIT_FLAG = 30;

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1 || 1)); };
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((m, n) => m[0] - n[0]);
  const r = new Array(a.length); let i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
function pearson(a, b) { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return da && db ? n / Math.sqrt(da * db) : 0; }
const spearman = (a, b) => pearson(ranks(a), ranks(b));
/** ICC(2,1), two-way random effects, absolute agreement, single rater (Shrout & Fleiss). rows = items, cols = raters. */
function icc21(rows) {
  const n = rows.length, k = rows[0].length;
  const grand = mean(rows.flat());
  const rowM = rows.map(mean), colM = [...Array(k)].map((_, j) => mean(rows.map((r) => r[j])));
  const ssR = k * rowM.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssC = n * colM.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssT = rows.flat().reduce((s, v) => s + (v - grand) ** 2, 0);
  const ssE = ssT - ssR - ssC;
  const msR = ssR / (n - 1), msC = ssC / (k - 1), msE = ssE / ((n - 1) * (k - 1));
  return (msR - msE) / (msR + (k - 1) * msE + (k * (msC - msE)) / n);
}

/* ---- 1. read and check every answer ---- */
const answersDir = path.join(DIR, "answers");
const raters = fs.existsSync(answersDir)
  ? fs.readdirSync(answersDir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
  : [];
const valid = {};
const validity = [];
for (const r of raters) {
  const why = [];
  let ans = null, key = null;
  try { ans = JSON.parse(fs.readFileSync(path.join(answersDir, `${r}.json`), "utf8")); } catch (e) { why.push(`not valid JSON (${e.message})`); }
  try { key = JSON.parse(fs.readFileSync(path.join(DIR, `key_${r}.json`), "utf8")); } catch { why.push("no key file for this rater"); }
  const notes = [];
  if (ans && key) {
    if (ans.used_any_tool !== false) why.push("did not state used_any_tool: false");
    if (ans.opened_any_file !== false) why.push("did not state opened_any_file: false");
    if (key.sheet_check_code && ans.sheet_check_code !== key.sheet_check_code) why.push(`check code "${ans.sheet_check_code}" is not "${key.sheet_check_code}": the sheet may have reached it incomplete`);
    const table = {};
    SCENARIOS.forEach((s, si) => {
      const sc = (ans.scenarios ?? []).find((x) => x.scenario === NUMS[si]);
      if (!sc) { why.push(`scenario ${NUMS[si]} missing`); return; }
      for (const [vk] of VALUES) {
        const v = sc.values?.[vk];
        if (!v) { why.push(`scenario ${NUMS[si]} ${vk} missing`); continue; }
        if (!Array.isArray(v.ranking) || [...v.ranking].sort().join("") !== LETTERS.join("")) why.push(`scenario ${NUMS[si]} ${vk}: ranking is not A-F once each`);
        for (const L of LETTERS) {
          const e = v.scores?.[L];
          const id = key[`scenario_${NUMS[si]}`]?.[L];
          if (!e || typeof e.score !== "number" || e.score < 0 || e.score > 100) { why.push(`scenario ${NUMS[si]} ${vk} ${L}: no score 0-100`); continue; }
          table[`${NUMS[si]}|${vk}|${id}`] = { score: e.score, reason: String(e.reason ?? ""), place: v.ranking.indexOf(L) + 1 };
        }
        /* A higher place should never carry a lower score. Noted, not disqualifying: the score is what is compared. */
        if (Array.isArray(v.ranking)) for (let i = 1; i < v.ranking.length; i++) {
          const up = v.scores?.[v.ranking[i - 1]]?.score, down = v.scores?.[v.ranking[i]]?.score;
          if (typeof up === "number" && typeof down === "number" && down > up) notes.push(`scenario ${NUMS[si]} ${vk}: ${v.ranking[i]} scored above ${v.ranking[i - 1]} but ranked below it`);
        }
      }
    });
    const legend = SCENARIOS.map((s, si) => `Scenario ${NUMS[si]}: ` + LETTERS.map((L) => `${L} = ${s.options.find((o) => o.id === key[`scenario_${NUMS[si]}`]?.[L])?.title ?? "?"}`).join("; "));
    if (!why.length) valid[r] = { model: ans.rater_model ?? r, table, unclear: ans.unclear ?? [], comments: ans.comments ?? [], legend };
  }
  validity.push({ rater: r, model: ans?.rater_model ?? "?", valid: why.length === 0, problems: [...new Set(why)].slice(0, 8), notes: notes.slice(0, 8) });
}
const used = Object.keys(valid);

/* ---- 2 + 3 + 4: the comparison ---- */
const items = [];
const flags = [];
const bySv = [];
const pairRho = [];
SCENARIOS.forEach((s, si) => {
  for (const [vk, key, name] of VALUES) {
    const opts = s.options.map((o) => {
      const scores = used.map((r) => valid[r].table[`${NUMS[si]}|${vk}|${o.id}`].score);
      const reasons = used.map((r) => `${r}: ${valid[r].table[`${NUMS[si]}|${vk}|${o.id}`].reason}`);
      return { id: o.id, title: o.title, study: o.fingerprint[key], scores, reasons, m: scores.length ? mean(scores) : null, spread: scores.length > 1 ? sd(scores) : 0 };
    });
    if (!used.length) continue;
    opts.forEach((o) => items.push(o.scores));
    /* raters' order = by their mean score; study order = by the study's number */
    const raterPlace = ranks(opts.map((o) => -o.m));
    const studyPlace = ranks(opts.map((o) => -o.study));
    const rho = spearman(opts.map((o) => o.study), opts.map((o) => o.m));
    for (let a = 0; a < used.length; a++) for (let b = a + 1; b < used.length; b++) {
      pairRho.push(spearman(opts.map((o) => valid[used[a]].table[`${NUMS[si]}|${vk}|${o.id}`].score),
        opts.map((o) => valid[used[b]].table[`${NUMS[si]}|${vk}|${o.id}`].score)));
    }
    const studyTop = opts[studyPlace.indexOf(Math.min(...studyPlace))];
    const raterTop = opts[raterPlace.indexOf(Math.min(...raterPlace))];
    bySv.push({ scenario: NUMS[si], title: s.title, value: name, rho, studyTop: studyTop.title, raterTop: raterTop.title, opts: opts.map((o, i) => ({ ...o, studyPlace: studyPlace[i], raterPlace: raterPlace[i] })) });
    opts.forEach((o, i) => {
      const reasonsOut = [];
      if (Math.abs(o.study - o.m) >= DISTANCE_FLAG) reasonsOut.push(`study ${o.study} vs raters ${o.m.toFixed(0)} (${o.study > o.m ? "+" : ""}${(o.study - o.m).toFixed(0)})`);
      if (Math.abs(studyPlace[i] - raterPlace[i]) >= PLACE_FLAG) reasonsOut.push(`place ${studyPlace[i]} in the study, ${raterPlace[i]} for the raters`);
      /* The raters disagreeing among themselves says the WORDS are unclear on this value, whatever the number. */
      if (o.scores.length > 1 && Math.max(...o.scores) - Math.min(...o.scores) >= SPLIT_FLAG) reasonsOut.push(`the raters themselves are ${Math.max(...o.scores) - Math.min(...o.scores)} points apart (the words may be unclear on this value)`);
      if (reasonsOut.length) flags.push({ scenario: NUMS[si], value: name, option: o.title, study: o.study, raters: o.scores, raterMean: Math.round(o.m), why: reasonsOut, reasons: o.reasons });
    });
    if (studyTop.id !== raterTop.id) flags.push({ scenario: NUMS[si], value: name, option: `TOP OPTION: study says "${studyTop.title}", raters say "${raterTop.title}"`, study: studyTop.study, raters: raterTop.scores, raterMean: Math.round(raterTop.m), why: ["the study's top option on this value is not the raters' top option"], reasons: raterTop.reasons });
  }
});

const summary = used.length >= 2 ? {
  icc_2_1: +icc21(items).toFixed(3),
  mean_pairwise_spearman: +mean(pairRho).toFixed(3),
  mean_distance_between_raters: +mean(items.map((r) => { let d = 0, c = 0; for (let a = 0; a < r.length; a++) for (let b = a + 1; b < r.length; b++) { d += Math.abs(r[a] - r[b]); c++; } return d / c; })).toFixed(1),
  mean_spearman_study_vs_raters: +mean(bySv.map((x) => x.rho)).toFixed(3),
} : null;

/* ---- write ---- */
fs.writeFileSync(path.join(DIR, "comparison.json"), JSON.stringify({ validity, summary, flags, bySv }, null, 2));
const md = [];
md.push("# Blind option-value review: the comparison", "");
md.push("AI-assisted blind content review (Claude models, no tools, fresh context each), adjudicated by the researcher. Not human inter-rater reliability.", "");
md.push("## 1. The answers", "", "| Rater | Model it reported | Valid | Problems | Notes |", "|---|---|---|---|---|");
for (const v of validity) md.push(`| ${v.rater} | ${v.model} | ${v.valid ? "yes" : "**no**"} | ${v.problems.join("; ") || "-"} | ${v.notes.join("; ") || "-"} |`);
md.push("");
for (const v of validity) {
  const probe = path.join(DIR, "runs", v.rater, "probe_result.md");
  if (fs.existsSync(probe)) md.push(`- ${v.rater} probe: ${fs.readFileSync(probe, "utf8").replace(/\s+/g, " ").trim().slice(0, 300)}`);
}
md.push("");
if (summary) {
  md.push("## 2. How much the raters agree with each other", "");
  md.push(`- ICC(2,1), absolute agreement, over ${items.length} option-value scores: **${summary.icc_2_1}** (0.75 or more is usually called good, 0.90 excellent)`);
  md.push(`- Mean Spearman correlation between two raters' orders: **${summary.mean_pairwise_spearman}**`);
  md.push(`- Mean distance between two raters' scores: **${summary.mean_distance_between_raters} points**`, "");
  md.push("## 3. How much the raters agree with the study's numbers", "");
  md.push(`Mean Spearman correlation between the study's order and the raters' order: **${summary.mean_spearman_study_vs_raters}** (1 = the same order).`, "");
  md.push("| Scenario | Value | Same order? (Spearman) | Study's top | Raters' top |", "|---|---|---|---|---|");
  for (const x of bySv) md.push(`| ${x.scenario} | ${x.value} | ${x.rho.toFixed(2)} | ${x.studyTop} | ${x.raterTop} |`);
  md.push("");
}
md.push(`## 4. Flagged numbers, for the researcher to decide (${flags.length})`, "");
md.push(`A number is flagged when it is ${DISTANCE_FLAG}+ points from the raters' mean, or ${PLACE_FLAG}+ places from where the raters put it, or when the top option differs. An option is also flagged when the raters are ${SPLIT_FLAG}+ points apart among themselves: then the card's words, not its number, may be what needs a look.`, "");
for (const f of flags) {
  md.push(`### Scenario ${f.scenario}, ${f.value}: ${f.option}`, "");
  md.push(`- Study: ${f.study}. Raters: ${f.raters.join(", ")} (mean ${f.raterMean}).`);
  md.push(`- Why flagged: ${f.why.join("; ")}.`);
  for (const r of f.reasons) md.push(`  - ${r}`);
  md.push("");
}
md.push("## 5. What each rater said in its own words", "", "Each rater had its own letters; its legend is under its notes.", "");
for (const r of used) {
  md.push(`### ${r} (${valid[r].model})`, "");
  md.push("Unclear:", ...(valid[r].unclear.length ? valid[r].unclear.map((x) => `- ${x}`) : ["- nothing"]), "");
  md.push("Comments:", ...(valid[r].comments.length ? valid[r].comments.map((x) => `- ${x}`) : ["- nothing"]), "");
  md.push("Letters:", ...valid[r].legend.map((x) => `- ${x}`), "");
}
fs.writeFileSync(path.join(DIR, "REPORT.md"), md.join("\n"));
console.log(`  ${used.length} valid answer(s) of ${raters.length}; ${flags.length} flag(s); report written to ${path.join(DIR, "REPORT.md")}`);
if (summary) console.log(`  ICC(2,1) ${summary.icc_2_1}, rater-rater Spearman ${summary.mean_pairwise_spearman}, study-raters Spearman ${summary.mean_spearman_study_vs_raters}`);
