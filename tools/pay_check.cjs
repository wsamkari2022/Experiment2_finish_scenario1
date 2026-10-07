/*
 * pay_check.cjs — the daily Prolific pay check (since 7 October 2026; Step 5 of docs/PROLIFIC_CONVERSION_PLAN.md).
 *
 * Every Prolific submission is "Manually review". Each day the researcher downloads two files into one folder:
 *   participants.json   Compass: the `participants` collection, Export -> JSON (an array; Extended JSON is fine)
 *   prolific.csv        Prolific: the study's submissions, the export file (Participant id, Status, Time taken, ...)
 * and this tool sorts every Prolific person into groups, using ONLY reasons Prolific accepts (researcher-help.prolific.com,
 * "Who should I reject?"): failed attention checks (two or more, in a study over 5 minutes), clear low effort throughout,
 * exceptionally fast (more than 3 standard deviations below the mean). It never rejects, never contacts anybody, and never
 * touches the database: it reads the two files and writes two files beside them.
 *
 *   PAY          Prolific "Awaiting review", our record finished with every answer, and nothing below applies
 *   LOOK FIRST   failed BOTH "pick the number" rows; clear low effort (the same answer to every feedback rating, or 3+
 *                blocks finished in under 30 seconds); exceptionally fast on Prolific's own "Time taken"; or the record
 *                began long before Prolific's clock. The researcher decides; the report gives Prolific's wording.
 *   PROBLEM      the data does not match the submission: no record here, a record not finished, answers missing, the
 *                code never shown, almost no working time, or our clock far shorter than Prolific's (a script, or a
 *                shared code). Usually a message to the person through Prolific first.
 *   NOT FINISHED returned, timed out or still working on Prolific: nothing to pay; listed for information
 *   DECIDED      already approved or rejected on Prolific
 *
 * The researcher's answers of 7 October 2026: "1-A" exceptionally fast is judged on Prolific's own "Time taken"; "2-A" clear
 * low effort = the same answer to every rating OR 3+ blocks under 30 seconds (the gift-card rule's two reasons); "3-A"
 * failing both number rows goes to LOOK FIRST (he presses Reject himself); "4-A" a Markdown report, a one-line approve
 * list, and a summary in the chat. Plus the audit's three additions: every answer present, the two clocks compared, and
 * the code each person typed (information only: a wrong code is not a valid reason to reject).
 *
 * Privacy: only records with a Prolific ID are read (the Compass file also holds university participants, with their
 * emails); the report is refused if an email address would appear in it, and the completion code itself is never printed.
 * Both output files stay in the folder given (keep it inside `Prolific docs/`, which never goes to GitHub).
 *
 * Run:  npm run pay:check -- "Prolific docs/daily/2026-10-20" [--reward 10] [--today 2026-10-20]
 *       (or --db <participants.json> --prolific <prolific.csv> --out <folder>)
 * Checked by:  npm run validate:pay
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

/* ------------------------------------------------------------------ the rules, in one place */

const RULES = {
  /** Prolific's speed rule: more than this many standard deviations below the mean "Time taken". */
  fastSds: 3,
  /** The speed rule is only read once this many submissions have a time (a smaller group gives no stable spread). */
  fastNeedsAtLeast: 10,
  /** Clear low effort: this many blocks finished in under 30 seconds (the gift-card rule's own line). */
  rushedBlocks: 3,
  /** Almost no working time recorded: a real run has about 40 minutes; a script has none. */
  minWorkingMinutes: 5,
  /** Our clock (record made -> finished) far shorter than Prolific's: shorter than half of it, minus 5 minutes. */
  clockShortShare: 0.5,
  clockShortSlackMin: 5,
  /** Our record began this many minutes before Prolific's clock started: an earlier attempt, or a mix-up. */
  clockLongSlackMin: 15,
  /** Prolific approves a submission by itself on day 21; warn from this day. */
  warnAfterDays: 18,
  autoApproveDay: 21,
};

/** The parts every finished record must hold (the study's own answers). */
const NEEDED_PARTS = [
  ["blocks.block1_money", "Block 1 (found money)"],
  ["blocks.block2_trolley", "Block 2 (trolley)"],
  ["blocks.block3_ai_workforce", "Block 3 (AI workforce)"],
  ["blocks.block4_stakeholder_reflection", "Block 4 (reflection)"],
  ["blocks.feedback_answers", "the feedback answers"],
  ["analysis.attention_checks", "the attention checks"],
];

const PROLIFIC_WORDING = {
  bothRows: "Failed attention checks: both instruction checks (\"Pick the number ...\") were answered wrongly.",
  lowEffort: "Low effort: clear low-effort responding throughout the study.",
  fast: "Exceptionally fast: completed more than 3 standard deviations faster than the mean.",
};

/* ------------------------------------------------------------------ reading the two files */

/** Mongo's Extended JSON ({ "$date": ... }, { "$oid": ... }, numbers) back to plain values. */
function plain(value) {
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1) {
      const [k] = keys;
      const v = value[k];
      if (k === "$date") return typeof v === "object" && v !== null ? new Date(Number(v.$numberLong)).toISOString() : String(v);
      if (k === "$oid") return String(v);
      if (k === "$numberInt" || k === "$numberLong" || k === "$numberDouble" || k === "$numberDecimal") return Number(v);
    }
    const out = {};
    for (const k of keys) out[k] = plain(value[k]);
    return out;
  }
  return value;
}

/** The Compass export: a JSON array, or one document per line. */
function readParticipants(text) {
  const t = text.replace(/^﻿/, "").trim();
  if (!t) return [];
  if (t.startsWith("[")) return plain(JSON.parse(t));
  return t.split(/\r?\n/).filter((l) => l.trim()).map((l) => plain(JSON.parse(l)));
}

/** A CSV reader for Prolific's export: quoted fields, "" inside quotes, commas and line breaks inside quotes, CRLF, BOM. */
function parseCsv(text) {
  const t = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (quoted) {
      if (c === "\"" && t[i + 1] === "\"") { field += "\""; i += 1; }
      else if (c === "\"") quoted = false;
      else field += c;
    } else if (c === "\"") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const squash = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
/** Prolific's column names, and the other spellings they have had. */
const COLUMNS = {
  pid: ["participantid", "prolificpid", "participant"],
  status: ["status", "submissionstatus"],
  timeTaken: ["timetaken"],
  startedAt: ["startedat", "starteddatetime", "starteddate"],
  completedAt: ["completedat", "completeddatetime", "completeddate"],
  code: ["completioncode", "enteredcode"],
};

/** The submissions, one object per row; stops with the columns it found when a needed one is missing. */
function readSubmissions(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("the Prolific file is empty");
  const header = rows[0];
  const at = {};
  for (const [name, spellings] of Object.entries(COLUMNS)) {
    const i = header.findIndex((h) => spellings.includes(squash(h)));
    if (i >= 0) at[name] = i;
  }
  for (const needed of ["pid", "status"]) {
    if (at[needed] === undefined) {
      throw new Error(`the Prolific file has no "${needed === "pid" ? "Participant id" : "Status"}" column. Its columns are: ${header.join(" | ")}`);
    }
  }
  return rows.slice(1).map((r) => ({
    pid: String(r[at.pid] ?? "").trim().toLowerCase(),
    status: String(r[at.status] ?? "").trim().toUpperCase().replace(/[-_]+/g, " ").replace(/\s+/g, " "),
    timeTakenSec: at.timeTaken === undefined ? null : seconds(r[at.timeTaken]),
    startedAt: at.startedAt === undefined ? null : (r[at.startedAt] || null),
    completedAt: at.completedAt === undefined ? null : (r[at.completedAt] || null),
    code: at.code === undefined ? null : String(r[at.code] ?? "").trim(),
  })).filter((s) => s.pid);
}

/** "2940", "2940.5", "49:00" or "0:49:00" -> seconds; anything else -> null. */
function seconds(value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^\d+(:\d{1,2}){1,2}$/.test(v)) return v.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
  return null;
}

/** Prolific writes its times in GMT, sometimes as "2026-10-20 14:03:22.123000" with no zone: read those as GMT. */
function parseGmt(value) {
  const v = String(value ?? "").trim();
  if (!v) return NaN;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?$/.exec(v);
  if (m) return Date.parse(`${m[1]}T${m[2]}${m[3] ? m[3].slice(0, 4) : ""}Z`);
  return Date.parse(v);
}

/* ------------------------------------------------------------------ reading one record */

const get = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const minutesBetween = (a, b) => {
  const ta = Date.parse(a), tb = Date.parse(b);
  return Number.isFinite(ta) && Number.isFinite(tb) ? (tb - ta) / 60000 : null;
};
const round1 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);

function recordFacts(doc) {
  const results = get(doc, "blocks.block5_emergency_scenarios.scenarioResults");
  const missing = NEEDED_PARTS.filter(([p]) => get(doc, p) === undefined || get(doc, p) === null).map(([, words]) => words);
  if (!Array.isArray(results) || results.length < 6) missing.splice(4, 0, `the main study (${Array.isArray(results) ? `${results.length} of 6 scenarios` : "none"})`);
  const rule = get(doc, "analysis.attention_checks.prolific_rule") ?? null;
  const quality = doc.quality ?? {};
  const working = get(doc, "active_time.total_active_minutes") ?? quality.active_minutes ?? null;
  return {
    finished: doc.status === "Study Completed",
    stage: doc.current_stage ?? null,
    condition: doc.condition_type ?? null,
    missing,
    codeGiven: !!doc.prolific_code_given_at,
    workingMinutes: typeof working === "number" ? working : null,
    ourMinutes: minutesBetween(doc.created_at, doc.completed_at),
    rowsFailed: typeof rule?.instruction_checks_failed === "number" ? rule.instruction_checks_failed
      : (typeof quality.prolific_instruction_checks_failed === "number" ? quality.prolific_instruction_checks_failed : null),
    failedBoth: rule?.failed_both_instruction_checks === true || quality.prolific_failed_both_instruction_checks === true,
    straightlined: quality.straightlined_feedback === true,
    rushedBlocks: typeof quality.blocks_under_30_seconds === "number" ? quality.blocks_under_30_seconds : 0,
  };
}

/* ------------------------------------------------------------------ the decision */

const DONE = new Set(["AWAITING REVIEW", "APPROVED", "REJECTED", "PARTIALLY APPROVED"]);
const NOT_FINISHED = new Set(["RETURNED", "TIMED OUT", "ACTIVE", "SCREENED OUT", "RESERVED"]);

/** The mean and the sample standard deviation of Prolific's "Time taken" over finished submissions, and the fast line. */
function speedLine(subs) {
  const times = subs.filter((s) => DONE.has(s.status) && typeof s.timeTakenSec === "number").map((s) => s.timeTakenSec / 60);
  const n = times.length;
  const mean = n ? times.reduce((a, b) => a + b, 0) / n : null;
  const sd = n > 1 ? Math.sqrt(times.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  const sorted = [...times].sort((a, b) => a - b);
  const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : null;
  const active = n >= RULES.fastNeedsAtLeast && sd !== null;
  return { n, mean, sd, median, line: active ? mean - RULES.fastSds * sd : null, active };
}

/**
 * The whole check, pure: the records (Compass) and the submissions (Prolific) -> the groups. `today` is a Date.
 */
function payCheck({ docs, submissions, today = new Date(), reward = null }) {
  const prolificDocs = (docs ?? []).filter((d) => typeof d?.prolific_pid === "string" && d.prolific_pid);
  const byPid = new Map(prolificDocs.map((d) => [d.prolific_pid.toLowerCase(), d]));
  const speed = speedLine(submissions);
  /* The code most people typed, to spot the odd one out; never printed. */
  const codeCounts = new Map();
  for (const s of submissions) if (DONE.has(s.status) && s.code) codeCounts.set(s.code, (codeCounts.get(s.code) ?? 0) + 1);
  const commonCode = [...codeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const groups = { pay: [], look: [], problem: [], notFinished: [], decided: [], other: [] };
  for (const s of submissions) {
    const doc = byPid.get(s.pid) ?? null;
    const facts = doc ? recordFacts(doc) : null;
    const prolificMinutes = typeof s.timeTakenSec === "number" ? s.timeTakenSec / 60 : null;
    const row = {
      pid: s.pid, status: s.status, prolificMinutes: round1(prolificMinutes),
      workingMinutes: round1(facts?.workingMinutes), ourMinutes: round1(facts?.ourMinutes),
      condition: facts?.condition ?? null, stage: facts?.stage ?? null,
      code: !s.code ? "none typed" : commonCode && s.code === commonCode ? "same as most" : "different from most",
      reasons: [], wording: [], notes: [], decideBy: null,
    };
    if (s.status === "APPROVED" || s.status === "REJECTED" || s.status === "PARTIALLY APPROVED") { groups.decided.push(row); continue; }
    if (NOT_FINISHED.has(s.status)) { groups.notFinished.push(row); continue; }
    if (s.status !== "AWAITING REVIEW") { row.reasons.push(`Prolific status "${s.status}" is not one this check knows`); groups.other.push(row); continue; }

    /* Day 21: Prolific approves by itself. */
    const finishedAt = parseGmt(s.completedAt);
    if (Number.isFinite(finishedAt)) {
      const days = Math.floor((today.getTime() - finishedAt) / 86_400_000);
      if (days >= RULES.warnAfterDays) {
        row.decideBy = new Date(finishedAt + RULES.autoApproveDay * 86_400_000).toISOString().slice(0, 10);
        row.notes.push(`waiting ${days} days: Prolific approves it by itself on ${row.decideBy}`);
      }
    }

    /* PROBLEM: the data does not match the submission. */
    if (!doc) row.reasons.push("no record of this Prolific ID in our database (did they take the study, or use somebody else's code?)");
    else {
      if (!facts.finished) row.reasons.push(`our record is not finished (it stopped at "${facts.stage ?? "?"}")`);
      if (facts.missing.length) row.reasons.push(`answers missing: ${facts.missing.join(", ")}`);
      if (facts.finished && !facts.codeGiven) row.reasons.push("our study never showed them the completion code");
      if (facts.workingMinutes !== null && facts.workingMinutes < RULES.minWorkingMinutes) row.reasons.push(`only ${round1(facts.workingMinutes)} working minutes recorded (a real run has about 40)`);
      if (facts.ourMinutes !== null && prolificMinutes !== null
          && facts.ourMinutes < RULES.clockShortShare * prolificMinutes - RULES.clockShortSlackMin) {
        row.reasons.push(`our record was made and finished in ${round1(facts.ourMinutes)} minutes, but Prolific counted ${round1(prolificMinutes)}`);
      }
    }
    if (row.reasons.length) { groups.problem.push(row); continue; }

    /* LOOK FIRST: Prolific's own reasons, for the researcher to decide. */
    if (facts.failedBoth) { row.reasons.push("failed BOTH \"pick the number\" rows"); row.wording.push(PROLIFIC_WORDING.bothRows); }
    if (facts.straightlined) { row.reasons.push("gave the same answer to every feedback rating"); row.wording.push(PROLIFIC_WORDING.lowEffort); }
    if (facts.rushedBlocks >= RULES.rushedBlocks) {
      row.reasons.push(`${facts.rushedBlocks} blocks finished in under 30 seconds`);
      if (!row.wording.includes(PROLIFIC_WORDING.lowEffort)) row.wording.push(PROLIFIC_WORDING.lowEffort);
    }
    if (speed.active && prolificMinutes !== null && prolificMinutes < speed.line) {
      row.reasons.push(`exceptionally fast: ${round1(prolificMinutes)} minutes, under the line of ${round1(speed.line)} (mean ${round1(speed.mean)} - 3 x ${round1(speed.sd)})`);
      row.wording.push(PROLIFIC_WORDING.fast);
    }
    if (facts.ourMinutes !== null && prolificMinutes !== null && facts.ourMinutes > prolificMinutes + RULES.clockLongSlackMin) {
      row.reasons.push(`our record began ${round1(facts.ourMinutes - prolificMinutes)} minutes before Prolific's clock started (an earlier attempt?)`);
    }
    if (facts.rowsFailed === 1) row.notes.push("failed one of the two number rows (not enough for Prolific)");
    if (row.code === "different from most") row.notes.push("typed a code different from most people's (information only)");
    if (row.reasons.length) groups.look.push(row);
    else groups.pay.push(row);
  }

  const inFile = new Set(submissions.map((s) => s.pid));
  const notInProlific = prolificDocs.filter((d) => !inFile.has(d.prolific_pid.toLowerCase())).map((d) => ({
    pid: d.prolific_pid.toLowerCase(), status: d.status ?? null, stage: d.current_stage ?? null, study: d.prolific_study_id ?? null,
  }));
  const hourly = reward !== null && speed.median ? reward / (speed.median / 60) : null;
  return { groups, notInProlific, speed, reward, hourly, approveIds: groups.pay.map((r) => r.pid) };
}

/* ------------------------------------------------------------------ the report */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const fmt = (x, unit = "") => (x === null || x === undefined ? "-" : `${x}${unit}`);

function reportMarkdown(result, { date, files }) {
  const { groups, notInProlific, speed, reward, hourly } = result;
  const L = [];
  const table = (rows, cols) => {
    if (!rows.length) { L.push("_None._", ""); return; }
    L.push(`| ${cols.map((c) => c[0]).join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`);
    for (const r of rows) L.push(`| ${cols.map((c) => String(c[1](r)).replace(/\|/g, "/")).join(" | ")} |`);
    L.push("");
  };
  L.push(`# Prolific pay check, ${date}`, "");
  L.push(`Read: \`${files.db}\` (records with a Prolific ID only) and \`${files.prolific}\`. Nothing was changed anywhere; nobody was contacted.`, "");
  L.push("| Group | People | What to do |", "|---|---|---|");
  L.push(`| Pay | ${groups.pay.length} | Approve: paste approve_ids.txt into Prolific's bulk approve |`);
  L.push(`| Look first | ${groups.look.length} | You decide; Prolific's wording is given |`);
  L.push(`| Problem | ${groups.problem.length} | Usually a message to the person through Prolific first |`);
  L.push(`| Not finished | ${groups.notFinished.length} | Nothing to pay |`);
  L.push(`| Already decided | ${groups.decided.length} | Nothing to do |`);
  if (groups.other.length) L.push(`| Unknown status | ${groups.other.length} | Look at them on Prolific |`);
  L.push("");
  const urgent = [...groups.pay, ...groups.look, ...groups.problem].filter((r) => r.decideBy);
  if (urgent.length) L.push(`**Decide soon:** ${urgent.length} submission(s) are near day 21, when Prolific approves by itself (${urgent.map((r) => `${r.pid} by ${r.decideBy}`).join(", ")}).`, "");

  L.push(`## 1. Pay (${groups.pay.length})`, "");
  table(groups.pay, [["Prolific ID", (r) => r.pid], ["Prolific minutes", (r) => fmt(r.prolificMinutes)], ["Working minutes", (r) => fmt(r.workingMinutes)],
    ["Condition", (r) => fmt(r.condition)], ["Code typed", (r) => r.code], ["Notes", (r) => r.notes.join("; ") || "-"]]);
  L.push(`## 2. Look first (${groups.look.length})`, "");
  table(groups.look, [["Prolific ID", (r) => r.pid], ["Why", (r) => r.reasons.join("; ")], ["Prolific's wording if you reject", (r) => r.wording.join(" ") || "- (no rejection reason; usually pay)"],
    ["Prolific minutes", (r) => fmt(r.prolificMinutes)], ["Notes", (r) => r.notes.join("; ") || "-"]]);
  L.push(`## 3. Problem (${groups.problem.length})`, "");
  table(groups.problem, [["Prolific ID", (r) => r.pid], ["What does not match", (r) => r.reasons.join("; ")], ["Prolific minutes", (r) => fmt(r.prolificMinutes)],
    ["Our minutes", (r) => fmt(r.ourMinutes)], ["Notes", (r) => r.notes.join("; ") || "-"]]);
  L.push(`## 4. Not finished (${groups.notFinished.length})`, "");
  table(groups.notFinished, [["Prolific ID", (r) => r.pid], ["Prolific status", (r) => r.status], ["Our record stopped at", (r) => fmt(r.stage)]]);
  L.push(`## 5. Already decided (${groups.decided.length})`, "");
  table(groups.decided, [["Prolific ID", (r) => r.pid], ["Prolific status", (r) => r.status]]);
  if (groups.other.length) { L.push(`## Unknown Prolific status (${groups.other.length})`, ""); table(groups.other, [["Prolific ID", (r) => r.pid], ["Status", (r) => r.status]]); }
  L.push(`## 6. In our database, not in Prolific's file (${notInProlific.length})`, "");
  L.push("Usually test runs, Prolific previews, or a different Prolific study. Nothing to pay from this file.", "");
  table(notInProlific, [["Prolific ID", (r) => r.pid], ["Our status", (r) => fmt(r.status)], ["Stage", (r) => fmt(r.stage)]]);
  L.push("## 7. Time and pay", "");
  L.push(`- Finished submissions with a time: ${speed.n}. Median ${fmt(round1(speed.median), " min")}, mean ${fmt(round1(speed.mean), " min")}, standard deviation ${fmt(round1(speed.sd), " min")}.`);
  L.push(speed.active
    ? `- Exceptionally fast line (Prolific's rule, mean - 3 x standard deviation): ${round1(speed.line)} min${speed.line <= 0 ? " (below zero: nobody can be under it)" : ""}.`
    : `- Exceptionally fast: not judged yet (needs at least ${RULES.fastNeedsAtLeast} finished submissions with a time).`);
  if (reward !== null) L.push(`- At a reward of ${reward} and the median time, the pay is ${fmt(round1(hourly))} per hour (Prolific: at least 8 USD, 12 recommended).`);
  L.push("", "## How this was decided", "");
  L.push("Only Prolific's valid reasons are used (researcher-help.prolific.com, \"Who should I reject?\"). Failing ONE number row, being slow, a wrong or missing code, or the study's own measures are never reasons to reject. Problem rows mean the data and the submission do not match; ask the person first. Made by tools/pay_check.cjs (`npm run pay:check`).", "");
  const text = L.join("\n");
  if (EMAIL.test(text)) throw new Error("the report would contain an email address; nothing was written");
  return text;
}

/* ------------------------------------------------------------------ the command */

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}

function main(argv) {
  const folder = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
  const dbFile = arg(argv, "--db") ?? (folder ? path.join(folder, "participants.json") : null);
  const csvFile = arg(argv, "--prolific") ?? (folder ? path.join(folder, "prolific.csv") : null);
  const outDir = arg(argv, "--out") ?? folder ?? (dbFile ? path.dirname(dbFile) : null);
  if (!dbFile || !csvFile || !fs.existsSync(dbFile) || !fs.existsSync(csvFile)) {
    throw new Error(`give the day's folder holding participants.json and prolific.csv (or --db and --prolific). Looked for: ${dbFile ?? "?"} and ${csvFile ?? "?"}`);
  }
  const rewardText = arg(argv, "--reward");
  const reward = rewardText === null ? null : Number(rewardText);
  if (reward !== null && !(reward > 0)) throw new Error("--reward must be a positive number");
  const todayText = arg(argv, "--today");
  const today = todayText ? new Date(`${todayText}T12:00:00Z`) : new Date();
  const result = payCheck({ docs: readParticipants(fs.readFileSync(dbFile, "utf8")), submissions: readSubmissions(fs.readFileSync(csvFile, "utf8")), today, reward });
  const date = today.toISOString().slice(0, 10);
  const md = reportMarkdown(result, { date, files: { db: path.basename(dbFile), prolific: path.basename(csvFile) } });
  const approve = result.approveIds.join(",");
  if (EMAIL.test(approve)) throw new Error("the approve list would contain an email address; nothing was written");
  fs.writeFileSync(path.join(outDir, "PAY_CHECK.md"), md);
  fs.writeFileSync(path.join(outDir, "approve_ids.txt"), approve + (approve ? "\n" : ""));
  const g = result.groups;
  console.log(`Pay check ${date}: pay ${g.pay.length}, look first ${g.look.length}, problem ${g.problem.length}, not finished ${g.notFinished.length}, already decided ${g.decided.length}${g.other.length ? `, unknown status ${g.other.length}` : ""}; in our database but not in Prolific's file ${result.notInProlific.length}.`);
  console.log(`Written: ${path.join(outDir, "PAY_CHECK.md")} and ${path.join(outDir, "approve_ids.txt")}`);
  return result;
}

module.exports = { RULES, NEEDED_PARTS, PROLIFIC_WORDING, parseGmt, plain, readParticipants, parseCsv, readSubmissions, seconds, recordFacts, speedLine, payCheck, reportMarkdown, main, EMAIL };

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`Pay check stopped: ${e.message}`);
    process.exit(1);
  }
}
