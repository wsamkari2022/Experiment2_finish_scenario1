/**
 * THE DOCUMENTS CHECK (since 11 November 2026; the researcher's decision D4): npm run validate:docs
 *
 * Reads the documents a reader uses to run, deploy and analyse the study, and checks that they describe today's study:
 *
 *   K1  no sentence describes a removed feature as if it were today (the student door, the university door, two doors,
 *       course credit, a gift card, "Not you?", StartScreen, credit:list, linked_email, about 154 participants). A
 *       sentence is history, and allowed, when it says so: a date, "until", "before", "gone", "removed", "history", a
 *       test record or version, and the like. In CLAUDE.md every dated section is history by its own rule (the note in
 *       "Prolific only"), so only its undated sections (the rules, the check table, how to run it) are read.
 *   K2  every field name written in backticks in the four data documents exists in the code that writes records
 *       (src/experiment, src/lib, server; comments left out), unless its sentence marks it as history ("gone since ...")
 *   K3  every `npm run <command>` in the documents exists in package.json
 *   K4  the 23 hypotheses A1-D5 have the same words in docs/ANALYSIS_AND_FIGURES_PLAN.md 11.1 and
 *       docs/PREREGISTRATION_FREEZE.md 5.1 (the IRB text and the OSF files are outside this folder: compare them by hand)
 *
 * Not in the validate:block5 chain (it reads documents, not the study). Run it after every change to a document and
 * before launch. Each gate was proved on 11 November 2026 by breaking a document on purpose.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const TODAY_DOCS = [
  "CLAUDE.md", "README.md", "DEPLOYMENT.md", "docs/DAILY_PAY_CHECK.md", "docs/ANALYSIS_AND_FIGURES_PLAN.md",
  "Generated Outputs/HOW_TO_READ_MY_DATABASE.md", "Generated Outputs/HOW_TO_ANALYZE_MY_DATA.md",
];
const DATA_DOCS = TODAY_DOCS.slice(3);

const REMOVED = /\bstudents?\b|university door|\buniversity\b|course[ -]credit|gift[ -]card|two doors|both doors|each door|StartScreen|NotYouLink|Not you\?|credit:list|linked_email|course_credit_earned|compensation_eligible|\b154\b/i;
const HISTORY = /\bthere is no\b|\b(until|before|since|gone|removed|deleted|history|historical|earlier|older|old|formerly|used to|no longer|was|were|had|test (record|run|version|file)s?|nobody took|refused|replaced|renamed|moved)\b|\b20\d\d\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i;

/* Sentences kept on purpose, each with its reason. */
const ALLOWED = [
  { file: "docs/ANALYSIS_AND_FIGURES_PLAN.md", starts: "Prolific participants and students are analysed together",
    why: "registered words of 11.1, kept until the OSF Update (the dated pending note above them)" },
];
const allowed = (rel, text) => ALLOWED.some((a) => a.file === rel && text.startsWith(a.starts));

const results = [];
const gate = (id, ok, detail, findings = []) => {
  results.push({ id, ok });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${id}  ${detail}`);
  for (const f of findings.slice(0, 25)) console.log(`         ${f}`);
  if (findings.length > 25) console.log(`         ... and ${findings.length - 25} more`);
};

/** Sentences with their line numbers: table cells and list items apart, code blocks left out. */
function sentences(text, { onlyUndatedSections = false } = {}) {
  const lines = text.split("\n");
  const out = [];
  let inCode = false, skip = false, para = [], paraStart = 0, tableHeader = "";
  const flush = () => {
    if (para.length) {
      const joined = para.join(" ");
      if (/^\|/.test(joined)) { if (!tableHeader) tableHeader = joined; } else tableHeader = "";
      /* A dated note ("Updated 6 October 2026 ...") is history as a whole; so is a table whose header row names a date. */
      const context = (/^\*\*(Updated|History)\b[^*]*20\d\d/.test(joined) ? joined.slice(0, 80) : "")
        + " " + (/^\|/.test(joined) ? tableHeader : "");
      for (const cell of joined.split(/\s\|\s|^\||\|$/)) {
        for (const s of cell.split(/(?<=[.!?;])\s+(?=[A-Z*`"(])/)) {
          if (s.trim()) out.push({ line: paraStart + 1, text: s.trim(), para: joined, context });
        }
      }
    }
    para = [];
  };
  lines.forEach((l, i) => {
    if (/^```/.test(l)) { flush(); inCode = !inCode; return; }
    if (inCode) return;
    if (/^#{1,6} /.test(l)) {
      flush();
      tableHeader = "";
      if (onlyUndatedSections && /^## /.test(l)) skip = /\b20\d\d\b|history/i.test(l);
      /* The earlier hypotheses are kept word for word for possible future use (analysis plan 11.2). */
      else if (/^#{2,3} /.test(l)) skip = /earlier hypotheses/i.test(l);
      if (!skip) out.push({ line: i + 1, text: l, para: l, context: "" });
      return;
    }
    if (skip) return;
    const body = l.replace(/^\s*>\s?/, "");
    if (!body.trim() || /^\s*[-*] |^\s*\d+\. |^\|/.test(body) || (/^\|/.test(para[0] || "") && !/^\|/.test(body))) flush();
    if (body.trim()) { if (!para.length) paraStart = i; para.push(body.trim()); }
  });
  flush();
  return out;
}

console.log("\n  THE DOCUMENTS CHECK (tools/validate_docs.cjs)\n");

/* K1 */
{
  const findings = [];
  for (const rel of TODAY_DOCS) {
    const ss = sentences(read(rel), { onlyUndatedSections: rel === "CLAUDE.md" });
    for (const s of ss) {
      if (!REMOVED.test(s.text)) continue;
      if (HISTORY.test(s.text) || HISTORY.test(s.context)) continue;
      if (/^\| \d{1,2} [A-Z][a-z]+ 2026 \|/.test(s.para)) continue;   // a dated row of a history table (HOW_TO_ANALYZE 4.9)
      if (allowed(rel, s.text)) continue;
      findings.push(`${rel}:${s.line}: ${s.text.slice(0, 150)}`);
    }
  }
  gate("K1", findings.length === 0, findings.length ? `${findings.length} sentence(s) describe a removed feature as today` : "no removed feature described as today", findings);
}

/* K2 */
{
  let code = "";
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/dev$/.test(rel)) walk(rel); }
      else if (/\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) code += read(rel).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1") + "\n";
    }
  };
  ["src/experiment", "src/lib", "server"].forEach((d) => fs.existsSync(path.join(ROOT, d)) && walk(d));
  const words = new Set(code.match(/[A-Za-z_][A-Za-z0-9_]*/g));
  /* dbShape.ts renames two words when it saves Block 3 (THRESHOLD_RENAMES): the database says entry_level / senior_level. */
  for (const w of [...words]) if (/lowbuffer|highbuffer/.test(w)) words.add(w.replace(/lowbuffer/g, "entry_level").replace(/highbuffer/g, "senior_level"));
  const list = [...words];
  /* "(+ `_label`)" and "`their_first_choice_*` (`chance_percent`)" name the END of real field names. */
  const known = (p, last) => words.has(p) || (last && list.some((w) => w.endsWith(p.startsWith("_") ? p : `_${p}`)));
  const findings = [];
  let checked = 0;
  for (const rel of DATA_DOCS) {
    for (const s of sentences(read(rel))) {
      for (const m of s.text.matchAll(/`([^`]+)`/g)) {
        const tok = m[1];
        if (!/^[A-Za-z_][A-Za-z0-9_.[\]]*$/.test(tok)) continue;
        if (!/[_.]|[a-z][A-Z]/.test(tok)) continue;                       // a plain word, not a field
        if (/\.(md|ts|tsx|js|cjs|mjs|json|csv|txt|docx|py|sh)$/.test(tok)) continue;   // a file name
        const parts = tok.split(/[.[\]]+/).filter((p) => p && !/^\d+$/.test(p));
        checked += 1;
        if (parts.every((p, i) => known(p, i === parts.length - 1))) continue;
        if (HISTORY.test(s.text) || HISTORY.test(s.context)) continue;
        findings.push(`${rel}:${s.line}: \`${tok}\``);
      }
    }
  }
  gate("K2", findings.length === 0, findings.length ? `${findings.length} field name(s) not written by the code` : `${checked} field names, every one written by the code`, findings);
}

/* K3 */
{
  const scripts = JSON.parse(read("package.json")).scripts;
  const findings = [];
  for (const rel of TODAY_DOCS) {
    read(rel).split("\n").forEach((l, i) => {
      for (const m of l.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) if (!scripts[m[1]]) findings.push(`${rel}:${i + 1}: npm run ${m[1]}`);
    });
  }
  gate("K3", findings.length === 0, findings.length ? `${findings.length} command(s) not in package.json` : "every npm run command exists", findings);
}

/* K4 */
{
  const plan = read("docs/ANALYSIS_AND_FIGURES_PLAN.md");
  const sec = plan.slice(plan.indexOf("### 11.1"), plan.indexOf("### 11.2"));
  const fromPlan = {};
  for (const m of sec.matchAll(/^- \*\*([A-D][1-7])(?: \([a-z]+\))?\.\*\* (.+)$/gm)) fromPlan[m[1]] = m[2].trim();
  const freeze = read("docs/PREREGISTRATION_FREEZE.md");
  const fsec = freeze.slice(freeze.indexOf("### 5.1"), freeze.indexOf("### 5.2"));
  const fromFreeze = {};
  for (const m of fsec.matchAll(/^\| ([A-D][1-7])(?: \([a-z]+\))? \| (.+?) \|/gm)) fromFreeze[m[1]] = m[2].trim();
  const norm = (t) => t.replace(/\s+/g, " ").replace(/\s*Test:.*$/, "").replace(/\s*Measure:.*$/, "").trim();
  const ids = [...new Set([...Object.keys(fromPlan), ...Object.keys(fromFreeze)])].sort();
  const findings = [];
  for (const id of ids) {
    const a = fromPlan[id], b = fromFreeze[id];
    if (!a || !b) { findings.push(`${id}: in ${a ? "the plan only" : "the freeze note only"}`); continue; }
    if (norm(a) !== norm(b)) findings.push(`${id}: the words differ`);
  }
  if (ids.length !== 23) findings.push(`${ids.length} hypotheses found, expected 23`);
  gate("K4", findings.length === 0, findings.length ? "the two copies of the hypotheses differ" : "the 23 hypotheses have the same words in the plan and the freeze note", findings);
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n  ${failed.length} DOCUMENT CHECK(S) FAILED\n` : "\n  ALL DOCUMENT CHECKS PASSED\n");
process.exit(failed.length ? 1 : 0);
