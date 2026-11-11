/**
 * THE AI-SAFE COPY OF THE REAL DATA (since 11 November 2026; the researcher's decision D5).
 *
 *   npm run data:ai-copy -- "Prolific docs/analysis/2026-12-20"
 *
 * The folder holds `participants.json` (Compass's export of the participants collection: a JSON array, one document per
 * line, or Extended JSON), and optionally `condition_arrivals.json` (the same, for that collection) and `prolific.csv`
 * (Prolific's submissions file). The command writes, into the same folder:
 *
 *   participants_ai_safe.json   every record, with each Prolific ID replaced by a code (P001, P002, ...), Prolific's study
 *                               and session ids replaced (STUDY1, P001-SESSION), and any email of an old test record replaced;
 *                               the replacement is made everywhere in the record (inside the saved browser files too)
 *   arrivals_ai_safe.json       the same for condition_arrivals.json, when it is there
 *   key.csv                     code, Prolific ID, and whether the ID is in Prolific's submissions file: PRIVATE, it never
 *                               leaves the folder
 *
 * Only the AI-safe files may be given to an AI tool. Before anything is written, a self-check reads the copies back and
 * stops (writing nothing) if any original Prolific ID, study id, session id or any email is still in them. The command
 * prints counts only, never an ID. It refuses a folder outside `Prolific docs/` (which Git ignores), unless --anywhere.
 *
 * A record whose Prolific ID is NOT in Prolific's file is a test run, a Prolific Preview run or a made-up ID typed into
 * the paste box: key.csv marks it "no", and the researcher decides what to do with it (HOW_TO_ANALYZE section 2).
 * The checks: npm run validate:aicopy (tools/validate_ai_safe_copy.cjs).
 */
const fs = require("fs");
const path = require("path");
const { readParticipants, readSubmissions } = require("./pay_check.cjs");

const EMAIL_ANYWHERE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every identifier of the export, and the code that replaces it. Codes follow the order of the export. */
function buildKey(docs, submissions) {
  const inProlific = new Set((submissions || []).map((s) => s.pid));
  const width = Math.max(3, String(docs.length).length);
  const replace = new Map();   // lower-cased original -> code
  const rows = [];
  let n = 0;
  for (const d of docs) {
    const pid = typeof d.prolific_pid === "string" && d.prolific_pid.trim() ? d.prolific_pid.trim().toLowerCase() : null;
    const email = typeof d.email === "string" && d.email.trim() ? d.email.trim().toLowerCase() : null;
    if (!pid && !email) continue;
    n += 1;
    const code = `P${String(n).padStart(width, "0")}`;
    if (pid && !replace.has(pid)) replace.set(pid, code);
    if (email && !replace.has(email)) replace.set(email, `${code}-EMAIL-REMOVED`);
    if (typeof d.prolific_session_id === "string" && d.prolific_session_id.trim()) {
      replace.set(d.prolific_session_id.trim().toLowerCase(), `${code}-SESSION`);
    }
    rows.push({ code, pid: pid ?? "", inProlific: pid ? (submissions ? (inProlific.has(pid) ? "yes" : "no") : "unknown") : "no (no Prolific ID)" });
  }
  const studies = [...new Set(docs.map((d) => d.prolific_study_id).filter((x) => typeof x === "string" && x.trim())
    .map((x) => x.trim().toLowerCase()))];
  studies.forEach((s, i) => replace.set(s, `STUDY${i + 1}`));
  return { replace, rows };
}

/** One pass that replaces every original identifier inside a string, whatever its case. Longest first. */
function makeReplacer(replace) {
  const originals = [...replace.keys()].sort((a, b) => b.length - a.length);
  if (originals.length === 0) return (t) => t;
  const re = new RegExp(originals.map(escapeRe).join("|"), "gi");
  return (t) => t.replace(re, (m) => replace.get(m.toLowerCase()) ?? m).replace(EMAIL_ANYWHERE, "EMAIL-REMOVED");
}

/** The record with every string and every object key passed through the replacer. */
function scrub(value, rep) {
  if (typeof value === "string") return rep(value);
  if (Array.isArray(value)) return value.map((v) => scrub(v, rep));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[rep(k)] = scrub(v, rep);
    return out;
  }
  return value;
}

/** The self-check: the written text holds no original identifier and no email. Returns the problems, never an ID. */
function leaks(text, replace) {
  const lower = text.toLowerCase();
  const problems = [];
  let left = 0;
  for (const original of replace.keys()) if (lower.includes(original)) left += 1;
  if (left) problems.push(`${left} original identifier(s) still in the copy`);
  if ((text.match(EMAIL_ANYWHERE) || []).length) problems.push("an email address is still in the copy");
  return problems;
}

function makeCopy({ docs, arrivals, submissions }) {
  const { replace, rows } = buildKey(docs, submissions);
  const rep = makeReplacer(replace);
  const safeDocs = docs.map((d) => scrub(d, rep));
  const safeArrivals = arrivals ? arrivals.map((a) => scrub(a, rep)) : null;
  const docsText = JSON.stringify(safeDocs, null, 2);
  const arrivalsText = safeArrivals ? JSON.stringify(safeArrivals, null, 2) : null;
  const problems = [...leaks(docsText, replace), ...(arrivalsText ? leaks(arrivalsText, replace) : [])];
  const keyCsv = ["code,prolific_id,in_prolific_submissions_file", ...rows.map((r) => `${r.code},${r.pid},${r.inProlific}`)].join("\n") + "\n";
  return { docsText, arrivalsText, keyCsv, rows, problems };
}

function main(argv) {
  const folder = argv.find((a) => !a.startsWith("--"));
  if (!folder) throw new Error('give the folder holding participants.json, for example "Prolific docs/analysis/2026-12-20"');
  const anywhere = argv.includes("--anywhere");
  if (!anywhere && !path.resolve(folder).split(path.sep).includes("Prolific docs")) {
    throw new Error("the folder must be inside \"Prolific docs/\" (Git ignores it, and key.csv holds Prolific IDs); add --anywhere to override");
  }
  const dbFile = path.join(folder, "participants.json");
  if (!fs.existsSync(dbFile)) throw new Error(`no participants.json in ${folder}`);
  const docs = readParticipants(fs.readFileSync(dbFile, "utf8"));
  const arrFile = path.join(folder, "condition_arrivals.json");
  const arrivals = fs.existsSync(arrFile) ? readParticipants(fs.readFileSync(arrFile, "utf8")) : null;
  const csvFile = path.join(folder, "prolific.csv");
  const submissions = fs.existsSync(csvFile) ? readSubmissions(fs.readFileSync(csvFile, "utf8")) : null;
  const out = makeCopy({ docs, arrivals, submissions });
  if (out.problems.length) throw new Error(`the self-check found ${out.problems.join("; ")}; nothing was written`);
  fs.writeFileSync(path.join(folder, "participants_ai_safe.json"), out.docsText + "\n");
  if (out.arrivalsText) fs.writeFileSync(path.join(folder, "arrivals_ai_safe.json"), out.arrivalsText + "\n");
  fs.writeFileSync(path.join(folder, "key.csv"), out.keyCsv);
  const notIn = out.rows.filter((r) => r.inProlific === "no" || r.inProlific.startsWith("no (")).length;
  console.log(`AI-safe copy: ${docs.length} records, ${out.rows.length} coded${arrivals ? `, ${arrivals.length} arrivals` : ""}; `
    + (submissions ? `${notIn} not in Prolific's submissions file (see key.csv)` : "no prolific.csv, so nothing compared with Prolific's file") + ".");
  console.log(`Written in ${folder}: participants_ai_safe.json${arrivals ? ", arrivals_ai_safe.json" : ""} and key.csv (key.csv stays private).`);
  return out;
}

module.exports = { buildKey, makeReplacer, scrub, leaks, makeCopy, main };

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`AI-safe copy stopped: ${e.message}`);
    process.exit(1);
  }
}
