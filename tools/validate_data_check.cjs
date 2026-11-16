/**
 * THE DATA CHECK'S OWN CHECK (since 16 November 2026): npm run validate:datacheck
 *
 * Stands over tools/data_check.cjs (the page DATA_CHECK.html: is every Prolific record complete in the database?).
 *
 *   X1  what the check expects is what the code writes: 36 saved sections read from storage.ts and dbShape.ts (8 answer
 *       parts, 22 analysis parts, 6 summary parts; `resume_state` never), a section named only in a comment never read,
 *       every server field in server/, every score field written by dbShape.ts and the main study, every self-check field
 *       in dbShape.ts
 *   X2  REALISM: complete pretend records built by the study's real code in all four conditions
 *       (`validate_dbshape.cjs --dump-full`) are all "Complete", with nothing found; the reflection scores measured in
 *       CVR+APA and CVR_Only and empty by design in APA_Only and Baseline
 *   X3  each of the 36 sections removed, one at a time, is caught and named
 *   X4  each field the server writes, removed, is caught at the right weight (consent, about you, condition, code: a
 *       problem; Prolific's study / session id, the arrival id: a note)
 *   X5  every main score not a number from 0 to 100 is caught; the reflection scores follow the condition
 *   X6  a score different in any of its three places is caught and named; so is a different condition
 *   X7  a self-check that disagrees is caught and named; one that does not apply is not
 *   X8  a missing row in any per-scenario part is caught
 *   X9  privacy: a planted score, age, answer, code and email never reach the page or the console; the email is reported
 *       by its place only; a hostile Prolific ID is escaped; the console never names a Prolific ID
 *   X10 unfinished records are never a problem; the same Prolific ID twice is; a record without one is skipped
 *   X11 the command end to end in a temporary folder, every Compass file shape, and its errors
 *
 * Each gate was proved on 16 November 2026 by breaking the check on purpose.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const dc = require("./data_check.cjs");

const ROOT = path.join(__dirname, "..");
const results = [];
const gate = (id, ok, detail, why = []) => {
  results.push({ id, ok });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${id}  ${detail}`);
  for (const w of why.slice(0, 12)) console.log(`         ${w}`);
  if (why.length > 12) console.log(`         ... and ${why.length - 12} more`);
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const get = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const set = (obj, dotted, v) => { const ks = dotted.split("."); const last = ks.pop(); ks.reduce((o, k) => o[k], obj)[last] = v; };
const del = (obj, dotted) => { const ks = dotted.split("."); const last = ks.pop(); const o = ks.reduce((x, k) => (x == null ? x : x[k]), obj); if (o) delete o[last]; };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

console.log("\n  THE DATA CHECK (tools/validate_data_check.cjs)\n");

const facts = dc.codeFacts();
const one = (doc) => dc.dataCheck([doc], facts);
const problemsOf = (doc) => one(doc).problems.map((p) => p.problem);
const groupOf = (doc) => one(doc).rows[0].group;

/* ---- the realistic records: the study's real builders, all four conditions ---- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vrds-datacheck-"));
let docs = [];
try {
  const out = path.join(tmp, "full.json");
  execFileSync(process.execPath, [path.join(__dirname, "validate_dbshape.cjs"), `--dump-full=${out}`], { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
  docs = JSON.parse(fs.readFileSync(out, "utf8"));
  for (const d of docs) d.consent.version = facts.consentVersion;
} catch (e) {
  console.log(`  could not build the realistic records: ${String(e.message).split("\n")[0]}`);
}
const base = docs[0];

/* X1 */
{
  const why = [];
  const s = facts.sections;
  const fam = (f) => s.filter(f).length;
  if (s.length !== 36) why.push(`${s.length} sections read, expected 36`);
  if (s.includes("resume_state")) why.push("resume_state is expected, but a finished record must not have it");
  if (fam((p) => p.startsWith("blocks.")) !== 8 || fam((p) => p.startsWith("analysis.")) !== 22 || fam((p) => !p.includes(".")) !== 6) {
    why.push(`families ${fam((p) => p.startsWith("blocks."))} / ${fam((p) => p.startsWith("analysis."))} / ${fam((p) => !p.includes("."))}, expected 8 / 22 / 6`);
  }
  /* A section named only in a comment is never read. */
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), "vrds-datacheck-root-"));
  for (const rel of ["src/experiment/storage.ts", "src/experiment/dbShape.ts", "src/experiment/ConsentPage.tsx", "server/conditions.js"]) {
    fs.mkdirSync(path.join(fake, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(fake, rel), read(rel) + (rel.endsWith("storage.ts") ? '\n/* path: "analysis.only_in_a_comment" */\n// path: "analysis.only_in_a_line_comment"\n' : ""));
  }
  if (dc.codeFacts(fake).sections.length !== 36) why.push("a section named only in a comment was read");
  fs.rmSync(fake, { recursive: true, force: true });
  const server = strip(read("server/index.js") + read("server/conditions.js"));
  for (const f of ["participant_id", "prolific_study_id", "prolific_session_id", "recruitment_source", "age", "gender", "country",
    "english_first_language", "consent", "condition_number", "condition_type", "condition_source", "condition_assigned_at",
    "condition_arrival_id", "status", "current_stage", "prolific_code_given_at", "resume_state"]) {
    if (!new RegExp(`\\b${f}\\b`).test(server)) why.push(`the server never writes ${f}`);
  }
  const db = strip(read("src/experiment/dbShape.ts"));
  const page = strip(read("src/experiment/Block5PublicEmergencySimulation.tsx"));
  for (const [name, hk, bk, mk] of dc.MAIN_SCORES) {
    if (!new RegExp(`\\b${hk}:`).test(db)) why.push(`dbShape.ts never writes headline.${hk} (${name})`);
    if (!new RegExp(`\\b${mk.split(".").pop()}:`).test(db)) why.push(`dbShape.ts never writes major_info_and_scores.${mk}`);
    if (bk && !new RegExp(`\\b${bk}:`).test(page)) why.push(`the main study never saves ${bk}`);
  }
  for (const [, hk, mk] of dc.REFLECTION_SCORES) {
    if (!new RegExp(`\\b${hk}:`).test(db) || !new RegExp(`\\b${mk.split(".").pop()}:`).test(db)) why.push(`${hk} or ${mk} is not written by dbShape.ts`);
  }
  for (const [, p] of dc.SELF_CHECKS) if (!new RegExp(`\\b${p.split(".").pop()}:`).test(db)) why.push(`dbShape.ts has no ${p}`);
  if (!/order_rebuilt_from_these_inputs_matches_the_order_stored:/.test(db)) why.push("dbShape.ts has no card-order self-check");
  gate("X1", why.length === 0, why.length ? "the check expects something the code does not write" : `36 sections read from the code (8 answers, 22 analysis, 6 summary), comments ignored; ${dc.MAIN_SCORES.length + dc.REFLECTION_SCORES.length} score fields, ${dc.SELF_CHECKS.length + 1} self-checks and every server field found in the code`, why);
}

/* X2 */
{
  const why = [];
  if (docs.length !== 4) why.push(`${docs.length} realistic records built, expected 4`);
  else {
    const r = dc.dataCheck(docs, facts);
    if (r.groups.complete.length !== 4) why.push(`${r.groups.complete.length} of 4 complete; found: ${r.problems.map((p) => p.problem).join(", ")}`);
    if (r.problems.length) why.push(`found on records built by the real code: ${r.problems.map((p) => p.problem).join(", ")}`);
    if (r.byCondition.map((c) => c.finished).join() !== "1,1,1,1") why.push("not one finished record per condition");
    const refl = r.rows.map((row) => row.items.find((i) => i.label.startsWith("Reflection scores")).value);
    if (!/all saved/.test(refl[0]) || !/all saved/.test(refl[1]) || !/by design/.test(refl[2]) || !/by design/.test(refl[3])) why.push(`reflection scores read: ${refl.join(" | ")}`);
    const selfChecks = r.rows[0].items.find((i) => i.label === "The study's own self-checks").value;
    if (!/^7 checked/.test(selfChecks)) why.push(`self-checks read: ${selfChecks}`);
  }
  gate("X2", why.length === 0, why.length ? "a record built by the study's real code is not called Complete" : "4 records built by the study's real code (one per condition) are all Complete, nothing found; reflection scores measured in conditions 1-2, empty by design in APA_Only and Baseline; 7 self-checks read", why);
}

/* X3 */
{
  const why = [];
  if (base) {
    for (const p of facts.sections) {
      const d = clone(base); del(d, p);
      if (groupOf(d) !== "missing" || !problemsOf(d).includes(`missing ${p}`)) why.push(`removing ${p} was not caught`);
    }
  } else why.push("no realistic record");
  gate("X3", why.length === 0, why.length ? "a missing section was not caught" : `each of the ${facts.sections.length} sections removed, one at a time: caught and named`, why);
}

/* X4 */
{
  const why = [];
  if (base) {
    const cases = [
      ["age", "bad", "missing age"], ["gender", "bad", "missing gender"], ["country", "bad", "missing country"],
      ["english_first_language", "bad", "missing english_first_language"], ["consent", "bad", "no consent"],
      ["condition_type", "bad", "no valid condition"], ["condition_number", "bad", "no valid condition"],
      ["prolific_code_given_at", "bad", "code never shown"], ["participant_id", "bad", "missing participant_id"],
      ["recruitment_source", "bad", "recruitment_source not prolific"],
      ["prolific_study_id", "warn", "no prolific_study_id"], ["prolific_session_id", "warn", "no prolific_session_id"],
      ["condition_arrival_id", "warn", "condition without its arrival id"],
    ];
    for (const [field, weight, problem] of cases) {
      const d = clone(base); delete d[field];
      const r = one(d);
      const found = r.problems.find((p) => p.problem === problem);
      if (!found) why.push(`removing ${field} was not caught`);
      else if (found.serious !== (weight === "bad")) why.push(`removing ${field} has the wrong weight`);
      if (weight === "warn" && r.rows[0].group !== "complete") why.push(`removing ${field} (a note) made the record incomplete`);
    }
    const old = clone(base); old.consent.version = "an-older-version";
    if (!problemsOf(old).includes("older consent version") || groupOf(old) !== "complete") why.push("an older consent version is not a note");
    const test = clone(base); test.condition_source = "address";
    if (!problemsOf(test).includes("condition not from the landing page")) why.push("a tester's condition is not noted");
    const left = clone(base); left.resume_state = { files: {} };
    if (!problemsOf(left).includes("resume_state still there")) why.push("a leftover resume_state is not noted");
    const age = clone(base); age.age = "34";
    if (problemsOf(age).length) why.push("an age saved as text was called missing");
  } else why.push("no realistic record");
  gate("X4", why.length === 0, why.length ? "a missing field was not caught at the right weight" : "13 server fields removed: consent, about you, condition, code, ids caught as problems; Prolific's study / session id and the arrival id as notes; an older consent, a tester's condition and a leftover resume_state as notes", why);
}

/* X5 */
{
  const why = [];
  if (base) {
    for (const [name, hk] of dc.MAIN_SCORES) {
      for (const v of [null, 101, -1, "50", undefined]) {
        const d = clone(base);
        if (v === undefined) delete d.headline[hk]; else d.headline[hk] = v;
        if (!problemsOf(d).includes(`score not saved: ${name}`)) why.push(`${name} = ${JSON.stringify(v)} was not caught`);
      }
    }
    const six = clone(base); six.headline.scenarios_completed = 5;
    if (!problemsOf(six).includes("headline not 6 scenarios")) why.push("a headline with 5 scenarios was not caught");
    const c1 = clone(docs[0]); c1.headline.context_stability_score = null;
    if (!problemsOf(c1).includes("score not saved: Context stability")) why.push("an empty reflection score in CVR+APA was not caught");
    const c3 = clone(docs[2]); c3.headline.directness_stability_score = 40; c3.major_info_and_scores.stability.directness_score = 40;
    if (!problemsOf(c3).includes("reflection scores filled where not measured")) why.push("a filled reflection score in APA_Only was not caught");
    const c4 = clone(docs[3]); c4.headline.reflection_scores_measured = true;
    if (!problemsOf(c4).includes("reflection scores do not match the condition")) why.push("\"measured\" in Baseline was not caught");
    const c2 = clone(docs[1]); c2.headline.reflection_scores_measured = false;
    if (!problemsOf(c2).includes("reflection scores do not match the condition")) why.push("\"not measured\" in CVR_Only was not caught");
  } else why.push("no realistic record");
  gate("X5", why.length === 0, why.length ? "a main score not saved properly was not caught" : `each of the ${dc.MAIN_SCORES.length} main scores empty, missing, text, below 0 or above 100: caught; the reflection scores against all four conditions`, why);
}

/* X6 */
{
  const why = [];
  if (base) {
    for (const [name, hk, bk, mk] of dc.MAIN_SCORES) {
      if (bk) {
        const d = clone(base); d.blocks.block5_emergency_scenarios[bk] += 1;
        if (!problemsOf(d).includes(`copies differ: ${name} (main study / headline)`)) why.push(`${name} different in the main study was not caught`);
      }
      const m = clone(base); set(m.major_info_and_scores, mk, get(m.major_info_and_scores, mk) + 1);
      if (!problemsOf(m).includes(`copies differ: ${name} (headline / major scores)`)) why.push(`${name} different in the major scores was not caught`);
    }
    for (const [name, , mk] of dc.REFLECTION_SCORES) {
      const m = clone(base); set(m.major_info_and_scores, mk, 1000);
      if (!problemsOf(m).includes(`copies differ: ${name} (headline / major scores)`)) why.push(`${name} different in the major scores was not caught`);
    }
    const cond = clone(base); cond.major_info_and_scores.condition.condition_type = "Baseline";
    if (!problemsOf(cond).includes("condition differs in major_info_and_scores")) why.push("a different condition in the major scores was not caught");
  } else why.push("no realistic record");
  gate("X6", why.length === 0, why.length ? "a score different in its places was not caught" : `every main score changed in the main study (8) and in the major scores (${dc.MAIN_SCORES.length + dc.REFLECTION_SCORES.length}): caught and named; a different condition too`, why);
}

/* X7 */
{
  const why = [];
  if (base) {
    for (const [name, p] of dc.SELF_CHECKS) {
      const d = clone(base); set(d, p, false);
      if (!problemsOf(d).includes(`self-check disagrees: ${name}`)) why.push(`"${name}" disagreeing was not caught`);
      const n = clone(base); set(n, p, null);
      if (problemsOf(n).length) why.push(`"${name}" not applying was called a problem`);
    }
    const card = clone(base); card.analysis.card_order_by_scenario.by_scenario[2].order_rebuilt_from_these_inputs_matches_the_order_stored = false;
    if (!problemsOf(card).includes("self-check disagrees: the card order in 1 scenario(s)")) why.push("a card order that does not rebuild was not caught");
    const cardOk = clone(base); cardOk.analysis.card_order_by_scenario.by_scenario.forEach((r) => { r.order_rebuilt_from_these_inputs_matches_the_order_stored = true; });
    if (problemsOf(cardOk).length) why.push("a card order that rebuilds was called a problem");
    /* Only the yes/no fields are read: a self-check block's numbers never reach the page. */
    const n = clone(base); n.analysis.vci_all.self_check.vci_all_recomputed_from_the_rows = 12.3456789;
    if (dc.reportHtml(one(n), { date: "d", file: "f" }).includes("12.3456789")) why.push("a number inside a self-check reached the page");
  } else why.push("no realistic record");
  gate("X7", why.length === 0, why.length ? "a self-check was misread" : `each of the ${dc.SELF_CHECKS.length} self-checks and the card order: "disagree" caught, "does not apply" not; the numbers beside them never shown`, why);
}

/* X8 */
{
  const why = [];
  if (base) {
    for (const [p, n] of dc.ROWS) {
      const d = clone(base); get(d, p).pop();
      if (!problemsOf(d).includes(`wrong number of rows in ${p}`)) why.push(`${p} with ${n - 1} rows was not caught`);
    }
  } else why.push("no realistic record");
  gate("X8", why.length === 0, why.length ? "a missing row was not caught" : `a row missing in each of the ${dc.ROWS.length} per-scenario parts: caught`, why);
}

/* X9 */
{
  const why = [];
  if (base) {
    const d = clone(base);
    d.headline.consistency_score = 73.123; d.blocks.block5_emergency_scenarios.vci = 73.123; d.major_info_and_scores.vci.overall_score = 73.123;
    d.age = 87; d.country = "Atlantisland";
    d.blocks.feedback_answers = { open: "UNIQUEANSWERWORDS", contact: "someone.private@example.com" };
    d.prolific_code = "SECRETCODE9";
    const evil = clone(base); evil.prolific_pid = "<script>alert(1)</script>";
    const r = dc.dataCheck([d, evil], facts);
    /* The page refuses itself when an email would reach it; with the planted email that refusal means the email's TEXT
       (not its place) went into the page, which is the failure this gate exists for. */
    let html = "";
    try { html = dc.reportHtml(r, { date: "d", file: "participants.json" }); }
    catch (e) { why.push(`the page could not be written (${e.message}): a planted value went into it`); }
    const lines = dc.summaryLines(r, "d").join("\n");
    for (const s of ["73.123", ">87<", "Atlantisland", "UNIQUEANSWERWORDS", "someone.private@example.com", "SECRETCODE9"]) {
      if (html.includes(s)) why.push(`the page shows ${s}`);
      if (lines.includes(s)) why.push(`the console shows ${s}`);
    }
    if (!problemsOf(d).includes("an email-like text in the record")) why.push("the email in the record was not reported");
    if (!/blocks\.feedback_answers\.contact/.test(html)) why.push("the email's place is not named");
    if (html.includes("<script>alert(1)")) why.push("a hostile Prolific ID was not escaped");
    if (lines.includes(base.prolific_pid) || lines.includes("alert(1)")) why.push("the console names a Prolific ID");
    const bad = clone(base); bad.prolific_pid = "a@b.cd";
    let refused = false;
    try { dc.reportHtml(one(bad), { date: "d", file: "f" }); } catch { refused = true; }
    if (!refused) why.push("a page containing an email was written");
    if (!/prefers-color-scheme:dark/.test(html) || !/name="viewport"/.test(html) || !/id="find"/.test(html)) why.push("dark mode, the phone width or the search box is missing");
  } else why.push("no realistic record");
  gate("X9", why.length === 0, why.length ? "privacy is broken" : "a planted score, age, country, answer, code and email reach neither the page nor the console; the email reported by its place only; a hostile ID escaped; a page with an email refused", why);
}

/* X10 */
{
  const why = [];
  if (base) {
    const run = clone(base);
    run.status = "Study Not Completed"; run.current_stage = "block3"; delete run.blocks.block4_stakeholder_reflection;
    delete run.analysis; delete run.headline; delete run.prolific_code_given_at;
    const r = one(run);
    if (r.rows[0].group !== "notFinished" || r.problems.length) why.push("an unfinished record was called a problem");
    if (!r.rows[0].items.some((i) => /stopped at "block3"/.test(i.value))) why.push("an unfinished record does not say where it stopped");
    const twin = clone(base); twin.prolific_pid = base.prolific_pid.toUpperCase();
    const t = dc.dataCheck([clone(base), twin], facts);
    if (t.duplicates !== 1 || t.groups.missing.length !== 2) why.push("the same Prolific ID twice was not caught");
    const noId = clone(base); delete noId.prolific_pid;
    const s = dc.dataCheck([noId, clone(base)], facts);
    if (s.skipped !== 1 || s.rows.length !== 1) why.push("a record without a Prolific ID was not skipped");
  } else why.push("no realistic record");
  gate("X10", why.length === 0, why.length ? "unfinished, twice or without an ID handled wrongly" : "unfinished = never a problem (and says where it stopped); the same Prolific ID twice caught; a record without one skipped", why);
}

/* X11 */
{
  const why = [];
  const folder = path.join(tmp, "2026-11-16");
  fs.mkdirSync(folder);
  try {
    if (base) {
      /* one document per line, in canonical Extended JSON (age as $numberInt) */
      const lines = docs.map((d) => JSON.stringify({ ...d, _id: { $oid: "65f0a1b2c3d4e5f6a7b8c9d0" }, age: { $numberInt: "30" } })).join("\n");
      fs.writeFileSync(path.join(folder, "participants.json"), lines);
      const out = execFileSync(process.execPath, [path.join(__dirname, "data_check.cjs"), folder], { cwd: ROOT, encoding: "utf8" });
      if (!/4 Prolific records - complete 4, something missing 0, not finished 0/.test(out)) why.push(`the command printed: ${out.split("\n")[0]}`);
      if (!fs.existsSync(path.join(folder, "DATA_CHECK.html"))) why.push("DATA_CHECK.html was not written");
      for (const d of docs) if (out.includes(d.prolific_pid)) why.push("the console printed a Prolific ID");
      fs.writeFileSync(path.join(folder, "participants.json"), JSON.stringify(docs));
      const out2 = execFileSync(process.execPath, [path.join(__dirname, "data_check.cjs"), folder], { cwd: ROOT, encoding: "utf8" });
      if (!/complete 4/.test(out2)) why.push("a JSON array was not read");
    } else why.push("no realistic record");
    let stopped = "";
    try { execFileSync(process.execPath, [path.join(__dirname, "data_check.cjs"), path.join(tmp, "nowhere")], { cwd: ROOT, encoding: "utf8", stdio: "pipe" }); }
    catch (e) { stopped = String(e.stderr); }
    if (!/no participants\.json/.test(stopped)) why.push("a folder without participants.json did not stop clearly");
  } catch (e) {
    why.push(`the command failed: ${String(e.message).split("\n")[0]}`);
  }
  gate("X11", why.length === 0, why.length ? "the command does not work end to end" : "the command end to end: one document per line in Extended JSON and a JSON array, DATA_CHECK.html written, no Prolific ID on the console, a clear stop without the file", why);
}

fs.rmSync(tmp, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n  ${failed.length} DATA CHECK GATE(S) FAILED\n` : "\n  ALL DATA CHECK GATES PASSED\n");
process.exit(failed.length ? 1 : 0);
