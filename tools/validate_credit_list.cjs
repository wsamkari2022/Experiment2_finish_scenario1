/*
 * validate_credit_list.cjs — the course-credit list (tools/credit_list.cjs), since 16 October 2026.
 *
 * Pretend Compass exports (a JSON array with Extended JSON values, and one document per line) holding students for every
 * case, Prolific records beside them, and the command run end to end:
 *
 *   Z1  the groups: a student who finished on time with a Florida Tech address (@fit.edu or @my.fit.edu) is ON THE LIST,
 *       also when careful participation is "No" or cannot be told (credit is given on completion; behaviour never takes
 *       anybody off); finished after the deadline, finished with another address, or finished with no finishing time ->
 *       LOOK AT; not finished -> NOT FINISHED; Prolific records skipped; a duplicate email counted once
 *   Z2  the deadline is the end of the day in Florida: 23:30 on 12/12/2026 in Florida (04:30 the next day in UTC) is on
 *       time, 00:30 on 13/12 is late; a summer date uses daylight time; a badly written deadline stops
 *   Z3  CREDIT_LIST.txt holds the on-time emails, one per line, and nothing else: no answer, score, condition, date or
 *       verdict; CREDIT_CHECK.md holds the verdicts and the reasons, for the researcher
 *   Z4  privacy: the console prints counts only, never an email; no Prolific ID anywhere in the two files
 *   Z5  the command: both files written in the folder, --deadline read, a missing file stops with a clear message
 *
 * Run:  npm run validate:credit
 */
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const C = require("./credit_list.cjs");

let fails = 0;
function gate(id, ok, text) {
  if (!ok) fails += 1;
  console.log(`  ${ok ? "  ok " : " FAIL"}  ${id.padEnd(3)} ${text}`);
}

console.log("");
console.log("==============================================================================");
console.log("  THE COURSE-CREDIT LIST");
console.log("==============================================================================");

/* Florida time 2026-12-12 23:30 = 2026-12-13 04:30 UTC; 2026-12-13 00:30 Florida = 05:30 UTC. */
const ON_TIME = "2026-12-10T18:00:00.000Z", LAST_MINUTE = "2026-12-13T04:30:00.000Z", JUST_LATE = "2026-12-13T05:30:00.000Z";
const careful = (yes) => (yes === null
  ? { careful_participation: null, careful_participation_reasons: [], careful_participation_cannot_tell: ["Blocks 1-3 timing not on record"] }
  : { careful_participation: yes, careful_participation_reasons: yes ? [] : ["gave the same answer to every feedback rating"], careful_participation_cannot_tell: [] });
const student = (email, over = {}) => ({
  _id: { $oid: `66${email.length.toString().padStart(22, "0")}` }, email, recruitment_source: "university",
  status: over.status ?? "Study Completed", current_stage: over.stage ?? "feedback",
  completed_at: over.completed === undefined ? { $date: ON_TIME } : over.completed,
  condition_type: "CVR+APA", age: { $numberInt: "21" },
  blocks: { feedback_answers: { feedback: { wellbeing: { items: { LI1: 4 } } } } },
  headline: { consistency_score: 77 },
  quality: careful(over.careful === undefined ? true : over.careful),
});
const DOCS = [
  student("ana.student2022@my.fit.edu"),                                  // on the list
  student("ben@fit.edu", { careful: false }),                              // on the list although not careful
  student("cy@my.fit.edu", { careful: null }),                             // on the list although cannot tell
  student("dee@my.fit.edu", { completed: { $date: LAST_MINUTE } }),        // on the list: 23:30 on the deadline day
  student("eve@my.fit.edu", { completed: { $date: JUST_LATE } }),          // late -> look at
  student("fay@gmail.com"),                                                // not Florida Tech -> look at
  student("gil@my.fit.edu", { completed: null }),                          // no finishing time -> look at
  student("hal@my.fit.edu", { status: "Study Not Completed", stage: "block5", completed: null }), // not finished
  student("Ana.Student2022@my.fit.edu", { status: "Study Not Completed", stage: "money", completed: null }), // duplicate
  { prolific_pid: "5f8a9b0c1d2e3f4a5b6c7d8e", recruitment_source: "prolific", status: "Study Completed", completed_at: ON_TIME },
  { prolific_pid: "60aa11bb22cc33dd44ee55ff", recruitment_source: "prolific", status: "Study Not Completed" },
];
const where = (r, email) => Object.entries(r.groups).find(([, rows]) => rows.some((x) => x.email === email))?.[0] ?? "nowhere";
/* A check that stops (an exception) is a failed gate with its message, never a silent crash. */
const attempt = (fn) => { try { return { value: fn(), error: null }; } catch (e) { return { value: null, error: e.message }; } };
const made = attempt(() => C.creditCheck({ docs: require("./pay_check.cjs").readParticipants(JSON.stringify(DOCS)), deadline: "2026-12-12" }));
if (made.error) {
  for (const id of ["Z1", "Z2", "Z3", "Z4", "Z5"]) gate(id, false, `the check stopped before it could judge: ${made.error}`);
  process.exit(1);
}
const result = made.value;

/* ------------------------------------------------------------------ Z1 the groups */
{
  const why = [];
  const want = { "ana.student2022@my.fit.edu": "onList", "ben@fit.edu": "onList", "cy@my.fit.edu": "onList", "dee@my.fit.edu": "onList",
    "eve@my.fit.edu": "lookAt", "fay@gmail.com": "lookAt", "gil@my.fit.edu": "lookAt", "hal@my.fit.edu": "notFinished" };
  for (const [email, g] of Object.entries(want)) if (where(result, email) !== g) why.push(`${email}: ${where(result, email)} (wanted ${g})`);
  if (result.prolificSkipped !== 2) why.push(`Prolific records skipped: ${result.prolificSkipped}`);
  const total = Object.values(result.groups).flat().length;
  if (total !== 8) why.push(`${total} students in the groups (a duplicate email counted twice?)`);
  const row = (e) => Object.values(result.groups).flat().find((r) => r.email === e);
  if (row("ben@fit.edu").careful !== "No" || row("cy@my.fit.edu").careful !== "Cannot tell" || row("ana.student2022@my.fit.edu").careful !== "Yes") why.push("the careful verdict is not carried");
  if (!row("eve@my.fit.edu").why.some((w) => /after the deadline/.test(w)) || !row("fay@gmail.com").why.some((w) => /not a Florida Tech/.test(w)) || !row("gil@my.fit.edu").why.some((w) => /no finishing time/.test(w))) why.push("a look-at reason is missing");
  gate("Z1", why.length === 0, why.length ? why.join(" | ")
    : "on time with a Florida Tech address is ON THE LIST, also when careful participation is No or cannot be told (credit on completion); late, another address, or no finishing time -> LOOK AT; not finished -> NOT FINISHED; 2 Prolific records skipped; a duplicate email counted once (the finished one kept)");
}

/* ------------------------------------------------------------------ Z2 the deadline */
{
  const why = [];
  const dec = attempt(() => new Date(C.endOfDayEastern("2026-12-12")).toISOString()), jul = attempt(() => new Date(C.endOfDayEastern("2026-07-04")).toISOString());
  if (dec.value !== "2026-12-13T04:59:59.999Z") why.push(`the December deadline is not the end of the day in Florida (EST): ${dec.value ?? dec.error}`);
  if (jul.value !== "2026-07-05T03:59:59.999Z") why.push(`a summer deadline does not use daylight time (EDT): ${jul.value ?? jul.error}`);
  let stopped = "";
  try { C.endOfDayEastern("12/12/2026"); } catch (e) { stopped = e.message; }
  if (!/--deadline must look like 2026-12-12/.test(stopped)) why.push("a badly written deadline does not stop");
  if (where(result, "dee@my.fit.edu") !== "onList" || where(result, "eve@my.fit.edu") !== "lookAt") why.push("23:30 and 00:30 around the deadline are not told apart");
  const late = C.creditCheck({ docs: require("./pay_check.cjs").readParticipants(JSON.stringify(DOCS)), deadline: "2026-12-13" });
  if (where(late, "eve@my.fit.edu") !== "onList") why.push("--deadline is not read");
  gate("Z2", why.length === 0, why.length ? why.join(" | ")
    : "the deadline is the end of the day in Florida (12/12/2026 ends 04:59:59 UTC on 13/12; a July day ends 03:59:59 UTC): 23:30 on the day is on time, 00:30 the next day is late; a later deadline moves the late student onto the list; \"12/12/2026\" stops with the right form");
}

/* ------------------------------------------------------------------ Z3 the two files */
const listMade = attempt(() => C.creditListText(result));
const list = listMade.value ?? "";
const md = C.creditCheckMarkdown(result, { date: "2026-12-13", file: "participants.json" });
{
  const why = [];
  if (listMade.error) why.push(`the list could not be made: ${listMade.error}`);
  const lines = list.trim().split("\n");
  if (lines.join(",") !== "ana.student2022@my.fit.edu,ben@fit.edu,cy@my.fit.edu,dee@my.fit.edu") why.push(`the list is ${lines.join(",")}`);
  if (/77|CVR|careful|Yes|No|2026|block|feedback|condition|\t|,|;/i.test(list)) why.push("the list holds more than emails");
  if (!/\| ben@fit\.edu \| 2026-12-10 13:00 \| No \| gave the same answer to every feedback rating \|/.test(md)) why.push("the check file does not show the verdict and its reason");
  if (!/never takes anybody off this list/.test(md) || !/Send Dr\. Eskridge \*\*CREDIT_LIST\.txt only\*\*/.test(md)) why.push("the check file does not say how to use it");
  let refused = false;
  try { C.creditListText({ groups: { onList: [{ email: "x@fit.edu, y@fit.edu" }] } }); } catch { refused = true; }
  if (!refused) why.push("a list line that is not one email is not refused");
  gate("Z3", why.length === 0, why.length ? why.join(" | ")
    : "CREDIT_LIST.txt holds the four on-time emails, one per line, and nothing else (no answer, score, condition, date or verdict; a line that is not one email is refused); CREDIT_CHECK.md shows each verdict and reason (finishing time in Florida), says careful participation never takes anybody off, and to send the list only");
}

/* ------------------------------------------------------------------ Z4 + Z5 the command, and privacy */
{
  const why = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vrds-credit-"));
  try {
    fs.writeFileSync(path.join(dir, "participants.json"), DOCS.map((d) => JSON.stringify(d)).join("\n"));
    const out = execFileSync(process.execPath, [path.join(__dirname, "credit_list.cjs"), dir, "--deadline", "2026-12-12"], { encoding: "utf8" });
    const fileList = fs.readFileSync(path.join(dir, "CREDIT_LIST.txt"), "utf8"), fileMd = fs.readFileSync(path.join(dir, "CREDIT_CHECK.md"), "utf8");
    if (/@/.test(out)) why.push("the console printed an email");
    if (!/^Course credit \(deadline 2026-12-12\): on the list 4, look at 3, not finished 1; Prolific records skipped 2\./m.test(out)) why.push(`the console reads: ${out.split("\n")[0]}`);
    if (fileList !== list) why.push("the written list differs from the tool's own");
    if (/5f8a9b0c|60aa11bb/.test(fileList + fileMd)) why.push("a Prolific ID reached a file");
    let stopped = "";
    try { execFileSync(process.execPath, [path.join(__dirname, "credit_list.cjs"), path.join(dir, "nowhere")], { encoding: "utf8", stdio: "pipe" }); } catch (e) { stopped = String(e.stderr); }
    if (!/Credit list stopped: give the folder holding participants\.json/.test(stopped)) why.push(`a missing file does not stop clearly: ${stopped.slice(0, 100)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  gate("Z4", why.length === 0, why.length ? why.join(" | ")
    : "privacy: the console prints counts only (no email), and no Prolific ID reaches either file");
  gate("Z5", why.length === 0, why.length ? "see Z4"
    : "the command reads one document per line, writes both files in the folder (the list exactly the tool's own), reads --deadline, and stops with a clear message when the file is missing");
}

console.log("");
console.log("==============================================================================");
if (fails) {
  console.log(`### ${fails} CREDIT GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("==============================================================================");
  process.exit(1);
}
console.log("### ALL CREDIT GATES PASSED ###");
console.log("==============================================================================");
