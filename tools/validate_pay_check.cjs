/*
 * validate_pay_check.cjs — the daily Prolific pay check (tools/pay_check.cjs), since 7 October 2026.
 *
 * Pretend files in the shapes the researcher will download (a Compass JSON export with university AND Prolific records,
 * Extended JSON values included; a Prolific submissions CSV with quotes, a byte-order mark and Windows line ends), with
 * one person for every group, and the command run end to end:
 *
 *   Y1  the groups: a clean finisher is PAY (also with ONE failed number row, a different code typed, or near day 21);
 *       failed BOTH rows, the same answer everywhere, 3+ rushed blocks, exceptionally fast, a record begun long before
 *       Prolific's clock -> LOOK FIRST with Prolific's wording; no record, not finished, answers missing (five scenarios
 *       of six, no feedback), the code never shown, almost no working time, our clock far shorter than Prolific's ->
 *       PROBLEM; returned / timed out / active -> NOT FINISHED; approved / rejected -> DECIDED
 *   Y2  exceptionally fast, by hand: Prolific's "Time taken", mean - 3 x the sample standard deviation over finished
 *       submissions, read only once 10 have a time (9 -> nobody flagged)
 *   Y3  the files: Extended JSON ($date, $oid, $numberInt), one document per line, quoted CSV fields with commas and line
 *       breaks, a BOM, CRLF; times as seconds or h:mm:ss; GMT dates without a zone; a missing column stops with the
 *       columns found
 *   Y4  privacy: no email in the report or the approve list (university records never read; a report that would carry an
 *       email is refused); the code itself never printed
 *   Y5  the command: the two files written in the day's folder, the approve line exactly the PAY group, the summary, the
 *       hourly pay from --reward, day 21 counted from --today, a missing file stops with a clear message
 *
 * Run:  npm run validate:pay
 */
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const P = require("./pay_check.cjs");

let fails = 0;
function gate(id, ok, text) {
  if (!ok) fails += 1;
  console.log(`  ${ok ? "  ok " : " FAIL"}  ${id.padEnd(3)} ${text}`);
}

console.log("");
console.log("==============================================================================");
console.log("  THE DAILY PROLIFIC PAY CHECK");
console.log("==============================================================================");

/* ------------------------------------------------------------------ pretend data */
const TODAY = new Date("2026-10-20T12:00:00Z");
const pidOf = (n) => `${String(n).padStart(2, "0")}aa11bb22cc33dd44ee55ff`.slice(0, 24);
const iso = (minutesAgo) => new Date(TODAY.getTime() - minutesAgo * 60000).toISOString();

/** A finished Prolific record with every answer, made `ago` minutes before today and finished `took` minutes later. */
function record(n, over = {}) {
  const took = over.took ?? 45, ago = over.ago ?? 600;
  const doc = {
    _id: { $oid: `65${String(n).padStart(22, "0")}` },
    prolific_pid: pidOf(n), recruitment_source: "prolific", status: "Study Completed", current_stage: "feedback",
    condition_type: ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"][n % 4], age: { $numberInt: "30" },
    created_at: iso(ago), completed_at: { $date: iso(ago - took) },
    prolific_code_given_at: iso(ago - took - 1),
    blocks: {
      block1_money: { ok: true }, block2_trolley: { ok: true }, block3_ai_workforce: { ok: true }, block4_stakeholder_reflection: { ok: true },
      block5_emergency_scenarios: { scenarioResults: Array.from({ length: 6 }, (_, i) => ({ scenarioId: i + 1 })) },
      feedback_answers: { feedback: { wellbeing: { items: { LI1: 4 } } } },
    },
    analysis: { attention_checks: { door: "prolific", prolific_rule: { instruction_checks_failed: over.rowsFailed ?? 0, failed_both_instruction_checks: (over.rowsFailed ?? 0) === 2 } } },
    quality: { active_minutes: over.working ?? 40, straightlined_feedback: !!over.straight, blocks_under_30_seconds: over.rushed ?? 0 },
    active_time: { total_active_minutes: over.working ?? 40 },
  };
  if (over.mutate) over.mutate(doc);
  return doc;
}

/* Who is who: [number, what we expect, Prolific status, Prolific minutes, record options or null for no record] */
const PEOPLE = [
  [1, "pay", "AWAITING REVIEW", 50, {}],
  [2, "pay", "AWAITING REVIEW", 48, { rowsFailed: 1 }],
  [3, "look", "AWAITING REVIEW", 52, { rowsFailed: 2 }],
  [4, "look", "AWAITING REVIEW", 47, { straight: true }],
  [5, "look", "AWAITING REVIEW", 49, { rushed: 3 }],
  [6, "look", "AWAITING REVIEW", 5, { took: 4, working: 6 }], // exceptionally fast on Prolific's clock
  [7, "problem", "AWAITING REVIEW", 51, null], // no record
  [8, "problem", "AWAITING REVIEW", 46, { mutate: (d) => { d.status = "Study Not Completed"; d.current_stage = "block5"; } }],
  [9, "problem", "AWAITING REVIEW", 50, { mutate: (d) => { d.blocks.block5_emergency_scenarios.scenarioResults.pop(); } }],
  [10, "problem", "AWAITING REVIEW", 53, { mutate: (d) => { delete d.blocks.feedback_answers; } }],
  [11, "problem", "AWAITING REVIEW", 50, { mutate: (d) => { delete d.prolific_code_given_at; } }],
  [12, "problem", "AWAITING REVIEW", 50, { working: 0.4 }], // a script: no working time
  [13, "problem", "AWAITING REVIEW", 50, { took: 3 }], // our clock far shorter than Prolific's
  [14, "look", "AWAITING REVIEW", 45, { took: 75 }], // our record began 30 minutes before Prolific's clock
  [15, "pay", "AWAITING REVIEW", 50, {}], // typed a different code
  [16, "pay", "AWAITING REVIEW", 50, {}], // waiting 19 days
  [17, "notFinished", "RETURNED", null, { mutate: (d) => { d.status = "Study Not Completed"; } }],
  [18, "notFinished", "TIMED-OUT", null, null],
  [19, "notFinished", "ACTIVE", null, null],
  [20, "decided", "APPROVED", 49, {}],
  [21, "decided", "REJECTED", 51, {}],
];
const COMMON = "SECRETCODE1"; // the code most people typed in this pretend file: must never be printed
const csvHeader = ["Submission id", "Participant id", "Status", "Custom study tncs accepted at", "Started at", "Completed at", "Reviewed at", "Archived at", "Time taken", "Completion code", "Total approvals", "Country of residence"];
function csvFor(people, { crlf = true, bom = true } = {}) {
  const lines = [csvHeader.join(",")];
  for (const [n, , status, minutes] of people) {
    const completed = n === 16 ? "2026-10-01 09:15:00.000000" : "2026-10-20 10:00:00.000000";
    const code = n === 15 ? "WRONG99" : status === "AWAITING REVIEW" || status === "APPROVED" || status === "REJECTED" ? COMMON : "";
    lines.push([`sub${n}`, pidOf(n), status, "", "2026-10-20 09:00:00.000000", minutes === null ? "" : completed, "", "", minutes === null ? "" : String(minutes * 60),
      code, "12", "\"Korea, Republic of\""].join(","));
  }
  return (bom ? "﻿" : "") + lines.join(crlf ? "\r\n" : "\n") + (crlf ? "\r\n" : "\n");
}
const prolificDocs = PEOPLE.filter(([, , , , opts]) => opts).map(([n, , , , opts]) => record(n, opts));
const extra = record(30); // in our database, not in Prolific's file (a test run)
const university = [{ email: "student.one@my.fit.edu", status: "Study Completed", recruitment_source: "university" },
  { email: "staff.two@fit.edu", status: "Study Not Completed" }];
const allDocs = [...university, ...prolificDocs, extra];

/* ------------------------------------------------------------------ Y1 the groups */
const docs = P.readParticipants(JSON.stringify(allDocs));
const subs = P.readSubmissions(csvFor(PEOPLE));
const result = P.payCheck({ docs, submissions: subs, today: TODAY, reward: 10 });
const groupOf = new Map();
for (const [g, rows] of Object.entries(result.groups)) for (const r of rows) groupOf.set(r.pid, g);
{
  const why = [];
  for (const [n, want] of PEOPLE) if (groupOf.get(pidOf(n)) !== want) why.push(`person ${n}: ${groupOf.get(pidOf(n)) ?? "nowhere"} (wanted ${want})`);
  const row = (n) => Object.values(result.groups).flat().find((r) => r.pid === pidOf(n));
  if (!row(3).wording.some((w) => /Failed attention checks/.test(w))) why.push("both rows failed gives no Prolific wording");
  if (!row(4).wording.some((w) => /Low effort/.test(w)) || !row(5).wording.some((w) => /Low effort/.test(w))) why.push("low effort gives no Prolific wording");
  if (!row(6).wording.some((w) => /Exceptionally fast/.test(w))) why.push("exceptionally fast gives no Prolific wording");
  if (!row(2).notes.some((x) => /one of the two number rows/.test(x))) why.push("one failed row is not noted");
  if (!row(15).notes.some((x) => /different from most/.test(x)) || row(1).code !== "same as most") why.push("the typed code is not compared");
  if (row(16).decideBy !== "2026-10-22" || !row(16).notes.some((x) => /approves it by itself on 2026-10-22/.test(x))) why.push(`day 21 is not counted: ${row(16).decideBy}`);
  for (const [n, re] of [[7, /no record/], [8, /not finished/], [9, /5 of 6 scenarios/], [10, /the feedback answers/], [11, /never showed them the completion code/], [12, /0\.4 working minutes/], [13, /made and finished in 3 minutes, but Prolific counted 50/], [14, /began 30 minutes before/]]) {
    if (!row(n).reasons.some((r) => re.test(r))) why.push(`person ${n}'s reason does not say ${re}`);
  }
  if (result.approveIds.join() !== [1, 2, 15, 16].map(pidOf).join()) why.push(`the approve list is ${result.approveIds.join(",")}`);
  if (result.notInProlific.length !== 1 || result.notInProlific[0].pid !== pidOf(30)) why.push("the record missing from Prolific's file is not listed");
  gate("Y1", why.length === 0, why.length ? why.slice(0, 5).join(" | ")
    : "a clean finisher is PAY (also with one failed number row, a different code, or near day 21: decide by 2026-10-22); both rows failed, the same answer everywhere, 3 rushed blocks, exceptionally fast and a record begun before Prolific's clock are LOOK FIRST with Prolific's wording; no record, not finished, five scenarios of six, no feedback, the code never shown, 0.4 working minutes and our clock far shorter are PROBLEM; returned, timed out and active NOT FINISHED; approved and rejected DECIDED; the approve line is exactly the PAY group; a test record not in Prolific's file is listed");
}

/* ------------------------------------------------------------------ Y2 exceptionally fast, by hand */
{
  const why = [];
  const times = PEOPLE.filter(([, , status, min]) => ["AWAITING REVIEW", "APPROVED", "REJECTED"].includes(status) && min !== null).map(([, , , min]) => min);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const sd = Math.sqrt(times.reduce((a, b) => a + (b - mean) ** 2, 0) / (times.length - 1));
  const line = mean - 3 * sd;
  if (Math.abs(result.speed.mean - mean) > 1e-9 || Math.abs(result.speed.sd - sd) > 1e-9 || Math.abs(result.speed.line - line) > 1e-9) why.push(`the line is ${result.speed.line}, by hand ${line}`);
  const flagged = Object.values(result.groups).flat().filter((r) => r.reasons.some((x) => /exceptionally fast/.test(x))).map((r) => r.pid);
  const byHand = PEOPLE.filter(([, , status, min]) => status === "AWAITING REVIEW" && min !== null && min < line).map(([n]) => pidOf(n));
  if (flagged.join() !== byHand.filter((p) => groupOf.get(p) === "look").join()) why.push(`flagged ${flagged.join(",")}, by hand ${byHand.join(",")}`);
  /* Nine timed submissions: the rule is not read. */
  const nine = PEOPLE.filter(([n]) => [1, 2, 3, 4, 5, 6, 15, 16, 20].includes(n));
  const small = P.payCheck({ docs, submissions: P.readSubmissions(csvFor(nine)), today: TODAY });
  if (small.speed.active || Object.values(small.groups).flat().some((r) => r.reasons.some((x) => /exceptionally fast/.test(x)))) why.push("with nine timed submissions somebody was still called exceptionally fast");
  if (Math.abs(result.hourly - 10 / (result.speed.median / 60)) > 1e-9) why.push("the hourly pay is not reward / median hours");
  gate("Y2", why.length === 0, why.length ? why.join(" | ")
    : `exceptionally fast on Prolific's "Time taken": mean ${mean.toFixed(1)} - 3 x ${sd.toFixed(1)} (sample standard deviation) = ${line.toFixed(1)} minutes, recounted by hand; only person 6 (5 minutes) is under it; with nine timed submissions the rule is not read; hourly pay = reward / median hours`);
}

/* ------------------------------------------------------------------ Y3 the files */
{
  const why = [];
  const ndjson = allDocs.map((d) => JSON.stringify(d)).join("\n");
  if (P.readParticipants(ndjson).length !== allDocs.length) why.push("one document per line is not read");
  const one = P.readParticipants(JSON.stringify([record(40)]))[0];
  if (one._id !== `65${"40".padStart(22, "0")}` || typeof one.age !== "number" || typeof one.completed_at !== "string") why.push("Extended JSON values are not made plain");
  if (P.plain({ $date: { $numberLong: "86400000" } }) !== "1970-01-02T00:00:00.000Z") why.push("a $date in milliseconds is not read");
  const lf = P.readSubmissions(csvFor(PEOPLE, { crlf: false, bom: false }));
  if (JSON.stringify(lf) !== JSON.stringify(subs)) why.push("Windows line ends or the byte-order mark change what is read");
  const rows = P.parseCsv("a,b,c\r\n\"x, y\",\"he said \"\"hi\"\"\",\"two\nlines\"\r\n");
  if (rows.length !== 2 || rows[1][0] !== "x, y" || rows[1][1] !== "he said \"hi\"" || rows[1][2] !== "two\nlines") why.push("quoted fields are not read whole");
  if (P.seconds("2940") !== 2940 || P.seconds("0:49:00") !== 2940 || P.seconds("49:00") !== 2940 || P.seconds("") !== null || P.seconds("n/a") !== null) why.push("times are not read as seconds");
  if (new Date(P.parseGmt("2026-10-01 09:15:00.000000")).toISOString() !== "2026-10-01T09:15:00.000Z") why.push("a GMT date without a zone is read as local time");
  if (subs.find((s) => s.pid === pidOf(18)).status !== "TIMED OUT") why.push("TIMED-OUT is not read as TIMED OUT");
  let stopped = "";
  try { P.readSubmissions("Submission id,Who,State\r\nx,y,z\r\n"); } catch (e) { stopped = e.message; }
  if (!/no "Participant id" column/.test(stopped) || !/Submission id \| Who \| State/.test(stopped)) why.push(`a missing column does not stop with the columns found: ${stopped}`);
  gate("Y3", why.length === 0, why.length ? why.join(" | ")
    : "Extended JSON ($oid, $date, $numberInt) and one document per line; quoted CSV fields with commas, quotes and line breaks; a byte-order mark and Windows line ends change nothing; times as seconds or h:mm:ss; GMT dates without a zone; TIMED-OUT; a missing column stops and names the columns found");
}

/* ------------------------------------------------------------------ Y4 privacy */
{
  const why = [];
  let md = "";
  try { md = P.reportMarkdown(result, { date: "2026-10-20", files: { db: "participants.json", prolific: "prolific.csv" } }); }
  catch (e) { why.push(`the report refused itself (${e.message}): something personal reached the result`); }
  if (P.EMAIL.test(md) || P.EMAIL.test(result.approveIds.join(","))) why.push("an email reached the report or the approve list");
  if (md.includes(COMMON) || md.includes("WRONG99")) why.push("a typed completion code is printed");
  /* Nothing of a university record anywhere in the result (the groups, the "not in Prolific's file" list, anything). */
  if (P.EMAIL.test(JSON.stringify(result)) || JSON.stringify(result).includes("@")) why.push("a university record was read");
  /* A report that would carry an email is refused. */
  const leaky = { ...result, groups: { ...result.groups, pay: [{ ...result.groups.pay[0], notes: ["write to student.one@my.fit.edu"] }] } };
  let refused = false;
  try { P.reportMarkdown(leaky, { date: "x", files: { db: "a", prolific: "b" } }); } catch { refused = true; }
  if (!refused) why.push("a report carrying an email is not refused");
  for (const w of Object.values(P.PROLIFIC_WORDING)) if (!/^(Failed attention checks|Low effort|Exceptionally fast):/.test(w)) why.push(`a wording is not one of Prolific's reasons: ${w}`);
  gate("Y4", why.length === 0, why.length ? why.join(" | ")
    : "no email in the report or the approve list (only records with a Prolific ID are read; a report that would carry an email is refused); no completion code printed; every suggested wording is one of Prolific's valid reasons");
}

/* ------------------------------------------------------------------ Y5 the command, end to end */
{
  const why = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vrds-pay-check-"));
  try {
    fs.writeFileSync(path.join(dir, "participants.json"), JSON.stringify(allDocs, null, 2));
    fs.writeFileSync(path.join(dir, "prolific.csv"), csvFor(PEOPLE));
    const out = execFileSync(process.execPath, [path.join(__dirname, "pay_check.cjs"), dir, "--reward", "10", "--today", "2026-10-20"], { encoding: "utf8" });
    const md = fs.readFileSync(path.join(dir, "PAY_CHECK.md"), "utf8");
    const approve = fs.readFileSync(path.join(dir, "approve_ids.txt"), "utf8").trim();
    if (approve !== [1, 2, 15, 16].map(pidOf).join(",")) why.push(`approve_ids.txt holds ${approve}`);
    if (!/^Pay check 2026-10-20: pay 4, look first 5, problem 7, not finished 3, already decided 2; in our database but not in Prolific's file 1\./m.test(out)) why.push(`the summary reads: ${out.split("\n")[0]}`);
    if (!/## 1\. Pay \(4\)/.test(md) || !/## 2\. Look first \(5\)/.test(md) || !/## 3\. Problem \(7\)/.test(md) || !/Decide soon/.test(md) || !/per hour/.test(md)) why.push("the report lacks a section, the day-21 warning or the hourly pay");
    if (P.EMAIL.test(md + out) || (md + out).includes(COMMON)) why.push("the written files or the summary carry an email or the code");
    let stopped = "";
    try { execFileSync(process.execPath, [path.join(__dirname, "pay_check.cjs"), path.join(dir, "nowhere")], { encoding: "utf8", stdio: "pipe" }); } catch (e) { stopped = String(e.stderr); }
    if (!/Pay check stopped: give the day's folder/.test(stopped)) why.push(`a missing folder does not stop clearly: ${stopped.slice(0, 120)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  gate("Y5", why.length === 0, why.length ? why.join(" | ")
    : "the command writes PAY_CHECK.md and approve_ids.txt in the day's folder (the approve line exactly the PAY group), prints the summary, gives the hourly pay from --reward and counts day 21 from --today; a missing folder stops with a clear message");
}

console.log("");
console.log("==============================================================================");
if (fails) {
  console.log(`### ${fails} PAY CHECK GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("==============================================================================");
  process.exit(1);
}
console.log("### ALL PAY CHECK GATES PASSED ###");
console.log("==============================================================================");
