/**
 * validate_cvr_people.mjs — guards the 60 little stories.
 *
 * Each option carries two: the person the choice HURTS (shown after "yes") and the person who
 * NEEDED it (shown after "no"). Both are dropped in after a lead that has already introduced
 * someone — "Someone you have known for twenty years… They ___" — so they have to obey rules that
 * are easy to break by accident and impossible to notice by clicking around.
 *
 * The rules, and why each one is here:
 *   1. BOTH PRESENT — a missing "needs it" story silently falls back to a generic line.
 *   2. NOT A RESTATEMENT — the story must not simply repeat the option's own "you give up" text.
 *      That was the single worst problem in the original set: several stories said the same thing
 *      the participant had just read, in prettier words, and added nothing.
 *   3. NO NEW PERSON — the lead already named someone. A story that opens "A child…" or "A miner…"
 *      hands the participant a stranger and wastes the closeness the lead just built.
 *   4. AGREES WITH "They" — the template supplies the subject, so "is unwell" would render as
 *      "…what you chose. They is unwell."
 *   5. NEITHER SIDE PUSHES HARDER — hurt and need should be similar in length, or the measure
 *      partly reflects which story was written with more force.
 *
 * Run: npm run validate:people   (chained into npm run validate:block5)
 */
import fs from "node:fs";

const SRC = fs.readFileSync("src/experiment/block5Scenarios.ts", "utf8");

const re = /\{\s*id: "([a-z0-9_]+)",\s*cvrSeed: \{([\s\S]*?)\n\s{8}\},/g;
const field = (blk, k) => (blk.match(new RegExp(k + ': "((?:[^"\\\\]|\\\\.)*)"')) || [, ""])[1];

const opts = [];
let m;
while ((m = re.exec(SRC)) !== null) {
  const id = m[1], blk = m[2];
  const at = SRC.indexOf(`id: "${id}",`);
  const tail = SRC.slice(at, at + 4000);
  opts.push({
    id,
    identifiedCase: field(blk, "identifiedCase"),
    harm: field(blk, "harm"),
    benefitCase: field(blk, "benefitCase"),
    benefitLost: field(blk, "benefitLost"),
    givesUp: field(tail, "givesUp"),
  });
}

let fails = 0;
const gate = (ok, msg) => { console.log(`  ${ok ? "  ok  " : " FAIL "} ${msg}`); if (!ok) fails++; };

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
  "it", "its", "that", "this", "they", "them", "their", "you", "your", "with", "at", "by", "be",
  "was", "were", "as", "not", "but", "so", "from", "than", "have", "has", "had", "will", "would"]);
const words = (t) => t.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)
  .filter((w) => w.length > 3 && !STOP.has(w));
/** share of the story's meaningful words that also appear in the option's own "you give up" line */
const overlap = (story, givesUp) => {
  const a = words(story), b = new Set(words(givesUp));
  if (!a.length) return 0;
  return a.filter((w) => b.has(w)).length / a.length;
};

console.log("\n=== THE 60 STORIES ===\n");

/* Counted against the options that ship, not against a number written down here: a hardcoded
   30 keeps reporting PASS after a scenario is added or removed, over exactly the gap it exists
   to catch. Six options per scenario is the structural invariant; the total is derived. */
gate(opts.length > 0 && opts.length % 6 === 0,
  `${opts.length} options found (${opts.length / 6} scenarios x 6)`);

/* 1 — both present */
const missing = opts.filter((o) => !o.identifiedCase || !o.harm || !o.benefitCase || !o.benefitLost);
gate(missing.length === 0,
  `every option has a hurt story AND a needs-it story${missing.length ? ": missing on " + missing.map((o) => o.id).join(", ") : ""}`);

/* 2 — not a restatement of the option's own text */
let worst = { id: "", v: 0 };
for (const o of opts) {
  const v = Math.max(overlap(o.identifiedCase + " " + o.harm, o.givesUp),
                     overlap(o.benefitCase + " " + o.benefitLost, o.givesUp));
  if (v > worst.v) worst = { id: o.id, v };
}
gate(worst.v < 0.34,
  `no story merely repeats its option's "you give up" line — worst overlap ${(worst.v * 100).toFixed(0)}% (${worst.id})`);

/* 3 — no new person introduced */
const NEW_PERSON = /^(a|an|the|one|another)\s+(child|miner|nurse|doctor|driver|parent|resident|worker|patient|person|family|man|woman|teacher|neighbour|neighbor)\b/i;
const strangers = opts.filter((o) => NEW_PERSON.test(o.identifiedCase) || NEW_PERSON.test(o.benefitCase));
gate(strangers.length === 0,
  `no story introduces a different person from the one the lead named${strangers.length ? ": " + strangers.map((o) => o.id).join(", ") : ""}`);

/* 4 — agrees with "They" */
// Only PRESENT-tense singular forms belong here. Past tense is the same for one person or
// many ("They drew a place", "They were told"), so listing it would flag correct sentences.
const SINGULAR = /^(is|has|was|does|lives|works|takes|comes|goes|makes|needs|wants|uses|looks|finds|delivers|sits|feels|knows|holds|keeps)\b/i;
const bad = opts.filter((o) => SINGULAR.test(o.identifiedCase.trim()) || SINGULAR.test(o.benefitCase.trim()));
gate(bad.length === 0,
  `every story reads correctly after "They"${bad.length ? ": " + bad.map((o) => o.id).join(", ") : ""}`);

/* 5 — neither side pushes harder */
const lens = opts.map((o) => ({
  id: o.id,
  h: (o.identifiedCase + " " + o.harm).length,
  n: (o.benefitCase + " " + o.benefitLost).length,
}));
const lopsided = lens.filter((l) => Math.abs(l.h - l.n) > Math.max(l.h, l.n) * 0.55);
gate(lopsided.length === 0,
  `hurt and needs-it are similar in length${lopsided.length ? ": " + lopsided.map((l) => `${l.id} (${l.h} vs ${l.n})`).join(", ") : ""}`);

const avgH = lens.reduce((a, l) => a + l.h, 0) / lens.length;
const avgN = lens.reduce((a, l) => a + l.n, 0) / lens.length;
console.log(`\n  average length — hurts ${avgH.toFixed(0)} chars, needs-it ${avgN.toFixed(0)} chars`);

console.log("\n" + "=".repeat(72));
console.log(fails === 0 ? "### ALL STORY GATES PASSED ###" : `### ${fails} STORY GATE FAILURE(S) ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails ? 1 : 0);
