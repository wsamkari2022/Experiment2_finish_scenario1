/**
 * apa_context_variants.cjs — should Q1 = "just this situation" RAISE the sacrificed value?
 *
 * THE QUESTION
 * ------------
 * Q1's second answer applies +5 to the value the option served, and nothing to the value it
 * sacrificed. Raising the sacrificed value looks like the obvious thing to do — the participant has
 * just told us it matters more to them — so this measures why it is not.
 *
 * But read what the answer actually says on screen:
 *
 *     "I chose it for THIS PARTICULAR SITUATION — overall, [sacrificed] still matters more to me
 *      than [served]."
 *
 * The participant is not describing their choice. They are contradicting it: telling us the value
 * they appeared to sacrifice is in fact their real priority and the choice was an exception. Read
 * that way, raising it is the faithful response, and lowering it would record the opposite of what
 * they said.
 *
 * So the question is not "is the direction wrong" but "is this bump doing any work" — because the
 * same participant usually goes on to name that same value in Q2, where it receives +30 anyway.
 *
 * HOW THIS TESTS IT
 * -----------------
 * The harness re-implements applyApaUpdates so the one constant can be varied. That is only
 * trustworthy if the re-implementation is exact, so it FIRST asserts that the variant set to the
 * shipped value reproduces the shipped function on 2,000 random cases. If that gate fails the
 * script stops: every number after it would be measuring this file rather than the study.
 *
 * Run: npm run apa:variants
 */
const path = require("node:path");
const fs = require("node:fs");

const BUILD = path.join(__dirname, "..", ".sim-build");
if (!fs.existsSync(BUILD)) {
  console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const B = (f) => require(path.join(BUILD, f));

const { applyApaUpdates, confidenceWeight, optionMainValue, violatedValue,
        labelOptions, isMisaligned } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { POLICY_DIM_KEYS } = B("block5Types.js");

const POLICY = [...POLICY_DIM_KEYS];
const STAKE = "stakeholderPerspectiveShiftSensitivity";
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity", STAKE];
const clamp = (v) => Math.max(0, Math.min(100, v));

const mk = (o) => ({
  generatedAt: "", topThreeKeys: [], topSensitivityKey: "x",
  dimensions: ALL.map((k, i) => ({ key: k, label: k, score: o[k] ?? 50, rank: i + 1, weight: 0.1, sourceBlocks: [] })),
});
const sc = (p, k) => p.dimensions.find((d) => d.key === k).score;
const set = (p, k, v) => { p.dimensions.find((d) => d.key === k).score = clamp(v); };
const clone = (p) => mk(Object.fromEntries(p.dimensions.map((d) => [d.key, d.score])));

/* Seeded, so a re-run reproduces the same participants and the same table. */
let seed = 20260907;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

/**
 * The shipped rule, with two things under test exposed.
 *
 * `topFromOriginal` matters more than it looks. The shipped code reads "whichever value is
 * currently top" AFTER Q1's bumps have landed — so a +10 on the sacrificed value can promote it to
 * top and put it directly in the path of Q2's −20. The participant says a value matters more, and
 * the update lowers it. Reading the top from the profile as it stood BEFORE Q1 removes that.
 */
function applyVariant(profile, option, prioritized, confidence, moved, sacrificedBump,
                      topFromOriginal = false) {
  const p = clone(profile);
  const w = confidenceWeight(confidence);            // stakesWeight is 1 for every shipped scenario
  const served = optionMainValue(option);
  const sacrificed = violatedValue(option, profile);
  const topBefore = [...POLICY].sort((a, b) => sc(p, b) - sc(p, a))[0];
  set(p, served, sc(p, served) + 5 * w);
  if (sacrificed !== served) set(p, sacrificed, sc(p, sacrificed) + sacrificedBump * w);
  set(p, STAKE, sc(p, STAKE) + (moved ? 25 : -25));
  const currentTop = topFromOriginal
    ? topBefore
    : [...POLICY].sort((a, b) => sc(p, b) - sc(p, a))[0];
  set(p, prioritized, sc(p, prioritized) + 30 * w);
  if (currentTop !== prioritized) set(p, currentTop, sc(p, currentTop) - 20 * w);
  /* The shipped cap: no policy value moves more than 30 x w in one clarification. Mirrored here
     because the gate below asserts this harness reproduces the shipped function exactly. */
  const capped = 30 * w;
  for (const k of POLICY) {
    const moved = sc(p, k) - sc(profile, k);
    if (Math.abs(moved) > capped) set(p, k, sc(profile, k) + Math.sign(moved) * capped);
  }
  p._topHitSacrificed = currentTop === sacrificed && prioritized !== sacrificed;
  return p;
}

/* Realistic cases: a random profile, and a MISALIGNED option — the only kind that reaches the APA. */
const CASES = [];
while (CASES.length < 2500) {
  const prof = mk(Object.fromEntries(ALL.map((k) => [k, Math.round(rnd() * 100)])));
  const scen = pick(BLOCK5_SCENARIOS.filter((s) => (s.decisionRole ?? "decider") === "decider"));
  const labeled = labelOptions(scen.options, prof).filter((o) => isMisaligned(o.level));
  if (!labeled.length) continue;
  const option = pick(labeled);
  const sacrificed = violatedValue(option, prof);
  const served = optionMainValue(option);
  if (sacrificed === served) continue;               // the bump cannot apply; not the case under test
  CASES.push({
    prof, option, served, sacrificed,
    confidence: 1 + Math.floor(rnd() * 5),
    moved: rnd() < 0.5,
    /* 60% name the value they just said matters more — the coherent follow-up. */
    prioritized: rnd() < 0.6 ? sacrificed : pick(POLICY),
  });
}

/* ── GATE: the harness must reproduce the shipped function exactly ──────────────────────────── */
let mismatch = 0;
for (const c of CASES.slice(0, 2000)) {
  const real = applyApaUpdates(c.prof, c.option, "context", c.moved, c.prioritized, null, 1, c.confidence);
  const mine = applyVariant(c.prof, c.option, c.prioritized, c.confidence, c.moved, 0);
  for (const k of POLICY) if (Math.abs(sc(real, k) - sc(mine, k)) > 1e-9) { mismatch++; break; }
}
if (mismatch) {
  console.error("\n  HARNESS DOES NOT MATCH THE SHIPPED CODE on " + mismatch + " of 2000 cases. Stopping.");
  console.error("  Every number below would be measuring this file rather than the study.\n");
  process.exit(1);
}

const VARIANTS = [
  ["+10, top read after Q1", 10, false],
  ["+5,  top read after Q1", 5, false],
  ["0,   top read after Q1 (in use)", 0, false],
  ["-5,  top read after Q1", -5, false],
  ["+10, top read BEFORE Q1", 10, true],
  ["0,   top read BEFORE Q1", 0, true],
];

console.log("");
console.log('Q1 = "just this situation"  —  what should happen to the SACRIFICED value?');
console.log('On screen the answer reads: "overall, [sacrificed] still matters more to me than [served]".');
console.log("");
console.log("  " + CASES.length + " participants  ·  random profiles  ·  misaligned options only  ·  harness matches shipped code exactly");
console.log("");

const coherent = CASES.filter((c) => c.prioritized === c.sacrificed).length;
const rescuable = CASES.filter((c) => sc(c.prof, c.sacrificed) - sc(c.prof, c.served) <= 0).length;
const pc = (n, d) => (d ? (100 * n / d).toFixed(1) : "0.0") + "%";

const hdr = ["variant".padEnd(34), "RESCUED".padEnd(10), "CEILING".padEnd(10),
             "SELF-HIT".padEnd(10), "DOUBLE-COUNT"].join("");
console.log("  " + hdr);
console.log("  " + "-".repeat(hdr.length));

const rows = [];
for (const [label, bump, topFirst] of VARIANTS) {
  let rescued = 0, toward = 0, away = 0, ceiling = 0, cells = 0, dbl = 0, dblN = 0, selfHit = 0;
  for (const c of CASES) {
    const after = applyVariant(c.prof, c.option, c.prioritized, c.confidence, c.moved, bump, topFirst);
    if (after._topHitSacrificed) selfHit++;
    const gapBefore = sc(c.prof, c.sacrificed) - sc(c.prof, c.served);
    const gapAfter = sc(after, c.sacrificed) - sc(after, c.served);
    /* The discriminating subset: the participant SAYS the sacrificed value matters more, but the
       profile does not yet agree. Does the bump fix that? Cases where it was already true tell us
       nothing at all about this constant. */
    if (gapBefore <= 0 && gapAfter > 0) rescued++;
    if (gapAfter > gapBefore) toward++; else if (gapAfter < gapBefore) away++;
    for (const k of POLICY) { cells++; if (sc(after, k) >= 99.999) ceiling++; }
    if (c.prioritized === c.sacrificed) { dbl += (bump + 30) * confidenceWeight(c.confidence); dblN++; }
  }
  rows.push({ label, bump, rescued: 100 * rescued / rescuable, ceiling: 100 * ceiling / cells, dbl: dbl / dblN });
  console.log("  " + [label.padEnd(34), pc(rescued, rescuable).padEnd(10), pc(ceiling, cells).padEnd(10),
                      pc(selfHit, CASES.length).padEnd(10),
                      "+" + (dbl / dblN).toFixed(1) + " on average"].join(""));
}

console.log("");
console.log("  RESCUED       THE COLUMN THAT MATTERS. Of the " + rescuable + " participants whose profile did NOT yet");
console.log("                agree with what they said, how often does the update make it agree?");
console.log("  CEILING       share of the four values left pinned at 100 — the saturation problem.");
console.log("  SELF-HIT      the value the participant just said matters MORE is the one Q2's -20 lands on.");
console.log("  DOUBLE-COUNT  what the sacrificed value receives from Q1 and Q2 TOGETHER when the participant");
console.log("                goes on to name it in Q2 — the coherent follow-up, " + Math.round(100 * coherent / CASES.length) + "% of cases here.");
console.log("");

const spreadR = Math.max(...rows.map((r) => r.rescued)) - Math.min(...rows.map((r) => r.rescued));
const spreadC = Math.max(...rows.map((r) => r.ceiling)) - Math.min(...rows.map((r) => r.ceiling));
console.log("  Spread across all four variants:  RESCUED " + spreadR.toFixed(1)
  + " points   ·   CEILING " + spreadC.toFixed(1) + " points   ·   DOUBLE-COUNT "
  + (rows[0].dbl - rows[3].dbl).toFixed(1) + " points");
console.log("");
