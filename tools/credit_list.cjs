/*
 * credit_list.cjs — the course-credit list for CSE4301/CSE5290 (since 16 October 2026; the researcher's "3-yes").
 *
 * The IRB modification (14 October 2026) and the Florida Tech consent page promise: "the course credit is given when I
 * complete the study", and "Your instructor is told only whether you completed the study, never your answers". After the
 * participation window closes (12/12/2026), the researcher exports the `participants` collection from Compass into a
 * folder and runs this tool. It writes two files there, and never touches the database:
 *
 *   CREDIT_LIST.txt   for Dr. Eskridge: the email addresses of the students who completed the study on time, one per
 *                     line, and NOTHING else (no answers, no scores, no condition, no dates)
 *   CREDIT_CHECK.md   for the researcher only: every student on the list with the date they finished and their careful-
 *                     participation verdict (quality.careful_participation, information only), the ones to look at
 *                     (finished after the deadline, or not with a Florida Tech address), and the ones who did not finish
 *
 * The rule is the consent page's own: on the list = status "Study Completed" (reached the thank-you page), finished by the
 * end of the deadline day in Melbourne, Florida (America/New_York), with a Florida Tech address (@fit.edu or a subdomain
 * such as @my.fit.edu). Careful participation NEVER takes anybody off the list (the researcher's "1-yes": credit is given
 * on completion; behaviour is recorded for him only). Late finishers and other addresses are not on the list: he decides
 * ("4-yes").
 *
 * Privacy: only university records are read (records with a Prolific ID are skipped and counted); the console prints
 * counts only, never an email, so the run can be checked without showing anybody's address; both files hold emails, so
 * keep the folder inside `Course credit/` (git-ignored, never on GitHub).
 *
 * Run:  npm run credit:list -- "Course credit/2026-12-13" [--deadline 2026-12-12]
 *       (or --db <participants.json> --out <folder>)
 * Checked by:  npm run validate:credit
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { readParticipants } = require("./pay_check.cjs");

const DEFAULT_DEADLINE = "2026-12-12";
const FLORIDA_TECH = /@([a-z0-9-]+\.)*fit\.edu$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ZONE = "America/New_York";

/** The last moment of the deadline day in Melbourne, Florida, as an instant (EST or EDT, whichever applies that day). */
function endOfDayEastern(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--deadline must look like 2026-12-12, not "${day}"`);
  for (const offset of ["-05:00", "-04:00"]) {
    const t = Date.parse(`${day}T23:59:59.999${offset}`);
    if (easternDay(t) === day && easternDay(t + 1) !== day) return t;
  }
  throw new Error(`could not place the end of ${day} in Florida time`);
}

/** The calendar day of an instant in Melbourne, Florida. */
function easternDay(t) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(t));
  const v = (type) => parts.find((p) => p.type === type).value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}

/** "2026-12-10 14:05" in Florida time. */
function easternWhen(t) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(t));
  const v = (type) => parts.find((p) => p.type === type).value;
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour") === "24" ? "00" : v("hour")}:${v("minute")}`;
}

const isUniversity = (d) => !(typeof d?.prolific_pid === "string" && d.prolific_pid) && d?.recruitment_source !== "prolific";
const careWords = (q) => (q?.careful_participation === true ? "Yes" : q?.careful_participation === false ? "No" : "Cannot tell");

/** The whole check, pure: the records -> the groups. */
function creditCheck({ docs, deadline = DEFAULT_DEADLINE }) {
  const end = endOfDayEastern(deadline);
  const university = (docs ?? []).filter(isUniversity);
  const prolificSkipped = (docs ?? []).length - university.length;
  const byEmail = new Map();
  for (const d of university) {
    const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
    if (!EMAIL.test(email)) continue;
    /* One person = one email (the database's own rule); a duplicate in an export keeps the finished one. */
    const prev = byEmail.get(email);
    if (!prev || (prev.status !== "Study Completed" && d.status === "Study Completed")) byEmail.set(email, d);
  }
  const groups = { onList: [], lookAt: [], notFinished: [] };
  for (const [email, d] of [...byEmail.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const q = d.quality ?? {};
    const finishedAt = Date.parse(d.completed_at ?? "");
    const row = {
      email,
      finished: Number.isFinite(finishedAt) ? easternWhen(finishedAt) : null,
      careful: careWords(q),
      reasons: Array.isArray(q.careful_participation_reasons) ? q.careful_participation_reasons : [],
      cannotTell: Array.isArray(q.careful_participation_cannot_tell) ? q.careful_participation_cannot_tell : [],
      stage: d.current_stage ?? null,
      why: [],
    };
    if (d.status !== "Study Completed") { groups.notFinished.push(row); continue; }
    if (!Number.isFinite(finishedAt)) row.why.push("finished, but the record has no finishing time");
    else if (finishedAt > end) row.why.push(`finished after the deadline (${deadline}, end of the day in Florida)`);
    if (!FLORIDA_TECH.test(email)) row.why.push("not a Florida Tech email address");
    if (row.why.length) groups.lookAt.push(row);
    else groups.onList.push(row);
  }
  return { groups, deadline, prolificSkipped, universityRecords: university.length };
}

/** CREDIT_LIST.txt: the emails, one per line, nothing else. */
function creditListText(result) {
  const lines = result.groups.onList.map((r) => r.email);
  for (const l of lines) if (!EMAIL.test(l) || /[\s,;|]/.test(l)) throw new Error("the credit list would hold something that is not one email address; nothing was written");
  return lines.join("\n") + (lines.length ? "\n" : "");
}

/** CREDIT_CHECK.md: for the researcher only. */
function creditCheckMarkdown(result, { date, file }) {
  const { groups, deadline, prolificSkipped, universityRecords } = result;
  const L = [];
  const table = (rows, cols) => {
    if (!rows.length) { L.push("_None._", ""); return; }
    L.push(`| ${cols.map((c) => c[0]).join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`);
    for (const r of rows) L.push(`| ${cols.map((c) => String(c[1](r)).replace(/\|/g, "/")).join(" | ")} |`);
    L.push("");
  };
  L.push(`# Course credit, CSE4301/CSE5290: ${date}`, "");
  L.push(`For you only: it holds students' emails and their careful-participation verdicts. Send Dr. Eskridge **CREDIT_LIST.txt only** (emails, nothing else). Read: \`${file}\` (${universityRecords} university records; ${prolificSkipped} Prolific records skipped). Nothing was changed anywhere.`, "");
  L.push("| Group | Students | What to do |", "|---|---|---|");
  L.push(`| On the list | ${groups.onList.length} | Their emails are in CREDIT_LIST.txt: send that file to Dr. Eskridge |`);
  L.push(`| Look at | ${groups.lookAt.length} | Finished, but late or not with a Florida Tech address: you decide, and add an email by hand if you give the credit |`);
  L.push(`| Not finished | ${groups.notFinished.length} | No credit from the study; they can do the alternative assignment |`);
  L.push("");
  L.push(`## 1. On the list (${groups.onList.length})`, "");
  L.push("Careful participation never takes anybody off this list: the course credit is given on completion (the consent page). It is shown so you know who answered carefully.", "");
  table(groups.onList, [["Email", (r) => r.email], ["Finished (Florida time)", (r) => r.finished], ["Careful participation", (r) => r.careful],
    ["Why not careful", (r) => r.reasons.join("; ") || "-"], ["Could not tell", (r) => r.cannotTell.join("; ") || "-"]]);
  L.push(`## 2. Look at (${groups.lookAt.length})`, "");
  table(groups.lookAt, [["Email", (r) => r.email], ["Why", (r) => r.why.join("; ")], ["Finished (Florida time)", (r) => r.finished ?? "-"], ["Careful participation", (r) => r.careful]]);
  L.push(`## 3. Not finished (${groups.notFinished.length})`, "");
  table(groups.notFinished, [["Email", (r) => r.email], ["Stopped at", (r) => r.stage ?? "-"]]);
  L.push("## How this was decided", "");
  L.push(`On the list: status "Study Completed" (reached the thank-you page; the consent page: "the course credit is given when I complete the study"), finished by the end of ${deadline} in Florida, and a Florida Tech address (@fit.edu or a subdomain such as @my.fit.edu). Careful participation (the four OSF robustness signs: answered very fast in Blocks 1-3, two or more scenarios under 15 seconds, the same answer to every feedback rating, an attention check answered wrongly) is information only. Made by tools/credit_list.cjs (\`npm run credit:list\`).`, "");
  return L.join("\n");
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}

function main(argv) {
  const folder = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
  const dbFile = arg(argv, "--db") ?? (folder ? path.join(folder, "participants.json") : null);
  const outDir = arg(argv, "--out") ?? folder ?? (dbFile ? path.dirname(dbFile) : null);
  if (!dbFile || !fs.existsSync(dbFile)) throw new Error(`give the folder holding participants.json (or --db). Looked for: ${dbFile ?? "?"}`);
  const deadline = arg(argv, "--deadline") ?? DEFAULT_DEADLINE;
  const result = creditCheck({ docs: readParticipants(fs.readFileSync(dbFile, "utf8")), deadline });
  const list = creditListText(result);
  const md = creditCheckMarkdown(result, { date: easternDay(Date.now()), file: path.basename(dbFile) });
  fs.writeFileSync(path.join(outDir, "CREDIT_LIST.txt"), list);
  fs.writeFileSync(path.join(outDir, "CREDIT_CHECK.md"), md);
  const g = result.groups;
  /* Counts only: never an email on the screen. */
  console.log(`Course credit (deadline ${deadline}): on the list ${g.onList.length}, look at ${g.lookAt.length}, not finished ${g.notFinished.length}; Prolific records skipped ${result.prolificSkipped}.`);
  console.log(`Written: CREDIT_LIST.txt (for Dr. Eskridge) and CREDIT_CHECK.md (for you only) in ${outDir}`);
  if (!/course credit/i.test(path.resolve(outDir))) console.log("Note: keep these files inside the \"Course credit\" folder, which never goes to GitHub.");
  return result;
}

module.exports = { creditCheck, creditListText, creditCheckMarkdown, endOfDayEastern, easternDay, FLORIDA_TECH, DEFAULT_DEADLINE, main };

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(`Credit list stopped: ${e.message}`); process.exit(1); }
}
