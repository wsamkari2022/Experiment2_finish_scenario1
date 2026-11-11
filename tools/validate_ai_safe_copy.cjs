/**
 * Checks for the AI-safe copy (tools/ai_safe_copy.cjs, npm run data:ai-copy), since 11 November 2026. Pretend files only:
 * every Prolific ID below is made up.
 *
 *   Q1  every Prolific ID, study id, session id and email is replaced everywhere: top-level fields, nested saved files,
 *       object keys, in any letter case; nothing else changes; the codes follow the order of the export
 *   Q2  key.csv: one row per coded record, "yes" / "no" against Prolific's file, "unknown" without it
 *   Q3  the self-check: a copy that still holds an identifier or an email is refused (never written)
 *   Q4  Compass's Extended JSON and one-document-per-line exports are read
 *   Q5  the command end to end in a temporary "Prolific docs" folder: the three files written, no ID on the screen; a
 *       folder outside "Prolific docs" refused
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { makeCopy, leaks, buildKey, main } = require("./ai_safe_copy.cjs");
const { readParticipants, readSubmissions } = require("./pay_check.cjs");

const results = [];
const gate = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(`  ${ok ? "PASS" : "FAIL"} ${id}  ${detail}`); };

const A = "aaaaaaaaaaaaaaaaaaaaaa01";   // made-up Prolific IDs (24 letters a-f and digits)
const B = "bbbbbbbbbbbbbbbbbbbbbb02";
const STUDY = "cccccccccccccccccccccc03";
const SESS_A = "dddddddddddddddddddddd04";
const docs = () => [
  { _id: "6551f0000000000000000001", prolific_pid: A, prolific_study_id: STUDY, prolific_session_id: SESS_A, age: 30,
    condition_type: "CVR_APA", status: "Study Completed",
    resume_state: { vrds_demographics: { prolificPid: A.toUpperCase(), owner: A }, [`vrds_directory_${A}`]: { key: A } },
    blocks: { feedback_answers: { note: `owner ${A}` } } },
  { _id: "6551f0000000000000000002", prolific_pid: B, prolific_study_id: STUDY, age: 41, condition_type: "Baseline", status: "Study Completed" },
  { _id: "6551f0000000000000000003", email: "old.tester@example.com", age: 22, status: "In Progress" },
];

console.log("\n  THE AI-SAFE COPY (tools/ai_safe_copy.cjs)\n");

/* Q1 */
{
  const out = makeCopy({ docs: docs(), arrivals: [{ linked_prolific_pid: B, condition_type: "Baseline" }], submissions: null });
  const copy = JSON.parse(out.docsText);
  const arr = JSON.parse(out.arrivalsText);
  const why = [];
  const text = out.docsText.toLowerCase() + out.arrivalsText.toLowerCase();
  for (const id of [A, B, STUDY, SESS_A, "old.tester@example.com"]) if (text.includes(id)) why.push(`still holds ${id.slice(0, 6)}...`);
  if (copy[0].prolific_pid !== "P001" || copy[1].prolific_pid !== "P002") why.push("codes not in export order");
  if (copy[0].prolific_study_id !== "STUDY1" || copy[0].prolific_session_id !== "P001-SESSION") why.push("study or session id not coded");
  if (copy[0].resume_state.vrds_demographics.prolificPid !== "P001") why.push("an upper-case ID inside a saved file was missed");
  if (!Object.keys(copy[0].resume_state).includes("vrds_directory_P001")) why.push("an ID inside an object key was missed");
  if (copy[0].blocks.feedback_answers.note !== "owner P001") why.push("an ID inside a longer string was missed");
  if (copy[2].email !== "P003-EMAIL-REMOVED") why.push("an old test record's email was not replaced");
  if (arr[0].linked_prolific_pid !== "P002") why.push("the arrivals were not coded with the same key");
  if (copy[0].age !== 30 || copy[1].condition_type !== "Baseline" || copy[0]._id !== "6551f0000000000000000001") why.push("something other than an identifier changed");
  gate("Q1", why.length === 0, why.join(" | ") || "every identifier replaced, everywhere, and nothing else changed");
}

/* Q2 */
{
  const subs = readSubmissions(`Participant id,Status\n${A.toUpperCase()},AWAITING REVIEW\n`);
  const withFile = buildKey(docs(), subs).rows;
  const without = buildKey(docs(), null).rows;
  const why = [];
  if (withFile.length !== 3) why.push(`${withFile.length} rows, expected 3`);
  if (withFile[0].inProlific !== "yes" || withFile[1].inProlific !== "no") why.push("in / not in Prolific's file wrong");
  if (!withFile[2].inProlific.startsWith("no (")) why.push("a record with no Prolific ID not marked");
  if (without[0].inProlific !== "unknown") why.push("without Prolific's file it should say unknown");
  gate("Q2", why.length === 0, why.join(" | ") || "key rows, yes / no / unknown");
}

/* Q3 */
{
  const { replace } = buildKey(docs(), null);
  const leaked = leaks(`{"note":"${A}"}`, replace);
  const mail = leaks(`{"note":"someone@example.org"}`, replace);
  const clean = leaks(`{"note":"P001"}`, replace);
  gate("Q3", leaked.length === 1 && mail.length === 1 && clean.length === 0,
    `a leaked ID found: ${leaked.length === 1}; a leaked email found: ${mail.length === 1}; a clean copy passes: ${clean.length === 0}`);
}

/* Q4 */
{
  const ext = `[{"_id":{"$oid":"6551f0000000000000000009"},"prolific_pid":"${A}","completed_at":{"$date":"2026-12-01T10:00:00Z"},"age":{"$numberInt":"33"}}]`;
  const lines = `{"prolific_pid":"${A}"}\n{"prolific_pid":"${B}"}\n`;
  const e = readParticipants(ext);
  const l = readParticipants(lines);
  const out = makeCopy({ docs: e, arrivals: null, submissions: null });
  gate("Q4", e[0].age === 33 && l.length === 2 && JSON.parse(out.docsText)[0].prolific_pid === "P001",
    "Extended JSON and one document per line read and coded");
}

/* Q5 */
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "vrds-aicopy-"));
  const folder = path.join(base, "Prolific docs", "analysis", "2026-12-20");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "participants.json"), JSON.stringify(docs()));
  fs.writeFileSync(path.join(folder, "prolific.csv"), `Participant id,Status\n${A},APPROVED\n${B},AWAITING REVIEW\n`);
  /* The same export outside "Prolific docs", so that only the folder rule can refuse it. */
  fs.writeFileSync(path.join(base, "participants.json"), JSON.stringify(docs()));
  const said = [];
  const log = console.log;
  console.log = (...a) => said.push(a.join(" "));
  let ok = true, refused = false;
  try { main([folder]); } catch (e) { ok = false; said.push(e.message); }
  try { main([base]); } catch (e) { refused = /Prolific docs/.test(e.message); }
  const wroteOutside = fs.existsSync(path.join(base, "key.csv"));
  console.log = log;
  const files = ["participants_ai_safe.json", "key.csv"].every((f) => fs.existsSync(path.join(folder, f)));
  const screen = said.join("\n").toLowerCase();
  const noIdOnScreen = ![A, B, STUDY, SESS_A, "old.tester"].some((id) => screen.includes(id));
  const key = fs.existsSync(path.join(folder, "key.csv")) ? fs.readFileSync(path.join(folder, "key.csv"), "utf8") : "";
  fs.rmSync(base, { recursive: true, force: true });
  gate("Q5", ok && files && noIdOnScreen && refused && !wroteOutside && key.includes(`P001,${A},yes`),
    `ran: ${ok}; files written: ${files}; no ID on the screen: ${noIdOnScreen}; outside "Prolific docs" refused: ${refused}`);
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n  ${failed.length} AI-SAFE COPY GATE(S) FAILED\n` : "\n  ALL AI-SAFE COPY GATES PASSED\n");
process.exit(failed.length ? 1 : 0);
