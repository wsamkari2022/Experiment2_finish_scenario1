/*
 * british_scan.cjs — finds British English in the text a participant reads.
 *
 * READ-ONLY. It reads source files and prints what it finds; it changes nothing.
 *
 * It looks only inside string literals and JSX text, never inside comments, because the
 * comments are for the researcher and the rule ("Always use American English") is about what a
 * participant reads. Identifiers such as care_rota_reduction are skipped for the same reason.
 *
 * Run from the repo root:
 *   node .claude/skills/my-advisor/scripts/british_scan.cjs                 # Block 5 content files
 *   node .claude/skills/my-advisor/scripts/british_scan.cjs --all           # every file under src/
 *   node .claude/skills/my-advisor/scripts/british_scan.cjs src/experiment/SomePage.tsx
 *
 * Two kinds of hit:
 *   BRITISH  — the word is British in this form. Change it.
 *   CHECK    — British in ONE of its senses ("round" as a delivery round, "lift" as a ride,
 *              "council" as local government). A person has to read the sentence and decide.
 * A clean run is not proof: this is a word list, and a British turn of phrase that is not on it
 * will pass. It exists so the obvious ones are never missed, not so the reading can be skipped.
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_FILES = [
  "src/experiment/block5Scenarios.ts",
  "src/experiment/block5CVRContent.ts",
];

/* [pattern, American replacement, kind]. Patterns are matched case-insensitively on word edges. */
const WORDS = [
  // spelling
  ["colours?", "color", "spell"], ["favour(s|ed|ite|able)?", "favor", "spell"],
  ["honour(s|ed)?", "honor", "spell"], ["behaviour(s|al)?", "behavior", "spell"],
  ["neighbour(s|hood|ing)?", "neighbor", "spell"], ["labour(s|ed)?", "labor", "spell"],
  ["rumours?", "rumor", "spell"], ["humour", "humor", "spell"], ["harbours?", "harbor", "spell"],
  ["centres?", "center", "spell"], ["metres?", "meter", "spell"], ["litres?", "liter", "spell"],
  ["theatres?", "theater", "spell"], ["programmes?", "program", "spell"], ["catalogues?", "catalog", "spell"],
  ["defence", "defense", "spell"], ["offence", "offense", "spell"], ["licence", "license", "spell"],
  ["grey", "gray", "spell"], ["tyres?", "tire", "spell"], ["kerbs?", "curb", "spell"],
  ["aluminium", "aluminum", "spell"], ["whilst", "while", "spell"], ["amongst", "among", "spell"],
  ["towards", "toward", "spell"], ["afterwards", "afterward", "spell"], ["learnt", "learned", "spell"],
  ["spelt", "spelled", "spell"], ["dreamt", "dreamed", "spell"],
  ["travell(ed|ing|er|ers)", "traveled / traveling", "spell"], ["cancell(ed|ing)", "canceled / canceling", "spell"],
  ["label{2}(ed|ing)", "labeled", "spell"], ["model{2}(ed|ing)", "modeled / modeling", "spell"],
  ["fuel{2}(ed|ing)", "fueled", "spell"], ["signal{2}(ed|ing)", "signaled", "spell"],
  ["level{2}(ed|ing)", "leveled", "spell"], ["total{2}(ed|ing)", "totaled", "spell"],
  ["counsel{2}(ed|ing|or)", "counseled / counselor", "spell"], ["marshal{2}(ed|ing)", "marshaled / marshaling", "spell"],
  ["(organ|real|recogn|priorit|minim|maxim|apolog|emphas|summar|critic|categor|final|util)is(e|ed|es|ing|ation)",
    "-ize / -ization", "spell"],
  ["analys(e|ed|ing)", "analyze", "spell"], ["paralys(e|ed|ing)", "paralyze", "spell"],
  // vocabulary — always British in this form
  ["carers?", "caregiver", "word"], ["rotas?", "schedule", "word"], ["lorr(y|ies)", "truck", "word"],
  ["petrol", "gas", "word"], ["motorways?", "highway", "word"], ["pavements?", "sidewalk", "word"],
  ["car parks?", "parking lot", "word"], ["queu(e|es|ed|ing)", "line / wait in line", "word"],
  ["mobile phones?", "cell phone", "word"], ["postcodes?", "ZIP code", "word"], ["A&E", "ER", "word"],
  ["chemists?", "pharmacy", "word"], ["nappies|nappy", "diaper", "word"], ["prams?", "stroller", "word"],
  ["torch(es)?", "flashlight", "word"], ["rubbish", "trash", "word"], ["maths", "math", "word"],
  ["timetables?", "schedule", "word"], ["fortnights?", "two weeks", "word"], ["pensioners?", "retiree / senior", "word"],
  ["walking frames?", "walker", "word"], ["care homes?", "nursing home", "word"],
  ["key ?workers?", "essential worker", "word"], ["windscreens?", "windshield", "word"],
  ["roundabouts?", "traffic circle", "word"], ["dual carriageways?", "divided highway", "word"],
  ["tailbacks?", "backup", "word"], ["sat ?nav", "GPS", "word"], ["cheques?", "check", "word"],
  ["in hospital", "in the hospital", "word"], ["at the weekend", "on the weekend", "word"],
  ["turn(ing|ed|s)? round", "turn around", "word"], ["(\\w+ )?days running", "in a row", "word"],
  ["stationary traffic", "stopped traffic / a standstill", "word"], ["signed off( work| sick)?", "on sick leave", "word"],
  ["high streets?", "main street", "word"], ["lay-bys?", "rest area", "word"], ["full stop", "period", "word"],
  ["have a wash|a wash\\b", "a bath / get washed", "word"], ["ring road", "beltway", "word"],
  ["blocks? of flats", "apartment building", "word"], ["roster(ing|ed)", "scheduling", "word"], ["members? of staff", "staff member", "word"], ["go(es)? on (paperwork|admin|handovers)", "go to", "word"],
  ["the long way round|to go round|all year round", "around", "word"], ["standard coach(es)?", "regular bus", "word"],
  // one sense is British — read the sentence
  ["rounds?", "route (a caregiver's round) — fine for a doctor's rounds", "check"],
  ["lift", "ride (\"give a lift\") — fine for a wheelchair lift", "check"],
  ["council", "city / county (local government)", "check"], ["coach(es)?", "bus", "check"],
  ["kit", "gear / equipment — fine in \"first-aid kit\"", "check"], ["flats?", "apartment — fine as the adjective", "check"],
  ["frames?", "walker, when it means a walking frame", "check"], ["bends", "curves", "check"],
  ["sign(s|ed|ing)? off", "sign off on / approve", "check"], ["surgery", "doctor's office, when not an operation", "check"],
  ["post", "mail, when it means letters", "check"], ["bins?", "trash can", "check"], ["holidays?", "vacation", "check"],
  ["any more", "anymore, when it means \"now\" (fine for a quantity)", "check"],
  ["(into|inside) (your|the|their) block", "building, when it means a block of flats (fine for a city block)", "check"],
  ["washing|medicines", "bathing / medications, in personal care (\"washing\" is laundry in America)", "check"],
];
const RULES = WORDS.map(([p, fix, kind]) => ({ re: new RegExp("\\b(" + p + ")\\b", "gi"), fix, kind }));

/* Pull every string literal and JSX text run out of a source file, with its line number.
   A small tokenizer rather than a regex, so that a quote inside a comment, or a "//" inside a
   string, does not throw the whole file out of step. */
function extract(src, isTsx) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  const push = (text, at) => { if (/[A-Za-z]{2}/.test(text)) out.push({ text, line: at }); };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
      i += 2; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c, at = line; let s = ""; i++;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") { s += src[i + 1] || ""; i += 2; continue; }
        if (src[i] === "\n") { line++; if (q !== "`") break; }
        s += src[i]; i++;
      }
      i++;
      push(s, at); continue;
    }
    if (isTsx && c === ">") {
      let j = i + 1, s = "", at = line;
      while (j < n && src[j] !== "<" && src[j] !== "{" && src[j] !== "}" && src[j] !== ";") { s += src[j]; j++; }
      if (src[j] === "<" && /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(s)) push(s.trim(), at);
    }
    i++;
  }
  return out;
}

function files(args) {
  if (args.includes("--all")) {
    const acc = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(p);
      }
    };
    walk("src");
    return acc;
  }
  const given = args.filter((a) => !a.startsWith("--"));
  return given.length ? given : DEFAULT_FILES;
}

const args = process.argv.slice(2);
let british = 0, check = 0;
for (const f of files(args)) {
  if (!fs.existsSync(f)) { console.log("  (missing) " + f); continue; }
  const strings = extract(fs.readFileSync(f, "utf8"), f.endsWith(".tsx"));
  const hits = [];
  for (const { text, line } of strings) {
    if (/^[a-z0-9_.\/-]+$/i.test(text)) continue;          // an id, a key or a path, not prose
    for (const r of RULES) {
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(text)) !== null) {
        if (text[m.index - 1] === ".") continue;            // Math.round(…) is code, not a word
        const a = Math.max(0, m.index - 45), b = Math.min(text.length, m.index + m[0].length + 45);
        hits.push({ line, word: m[0], fix: r.fix, kind: r.kind,
          ctx: (a > 0 ? "…" : "") + text.slice(a, b).replace(/\s+/g, " ") + (b < text.length ? "…" : "") });
      }
    }
  }
  if (!hits.length) continue;
  console.log("\n" + f);
  for (const h of hits.sort((x, y) => x.line - y.line)) {
    const tag = h.kind === "check" ? "CHECK  " : "BRITISH";
    if (h.kind === "check") check++; else british++;
    console.log(`  ${tag} ${String(h.line).padStart(5)}  "${h.word}" → ${h.fix}\n                 ${h.ctx}`);
  }
}
console.log(`\n${british} British, ${check} to check by eye.`);
