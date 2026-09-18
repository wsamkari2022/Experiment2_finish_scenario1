/**
 * audit_cvr_rules.cjs — checks the CVR lenses against THE RESEARCHER'S OWN RULES, one at a time.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT validate_block5.cjs
 * ------------------------------------------------------
 * The repo's gates check what the repo decided to check. These ten check the sentences the
 * researcher actually said when scenario 1's lenses were commissioned, and they are a different
 * instrument: writing scenario 2 they disagreed with the repo's gates twice, and both times the
 * repo's gates were the ones missing something.
 *
 *   - The repo bans the word "same" in a lens HEADING and PROMPT only, because scenario 4 has an
 *     option that legitimately "takes the same share off every client". R1 here reads every word of
 *     both lenses, which is what was asked for, and reports rather than blocks.
 *   - The repo checks the 24-hour rule nowhere at all. R2 does.
 *
 * NOT IN THE BLOCKING CHAIN, DELIBERATELY. Scenarios 3 and 4 have not had Pass E yet, so they
 * would fail half of this today and a validator that cannot pass is a validator that gets switched
 * off. It reports on every scenario and EXITS NON-ZERO ONLY for scenarios that have been through
 * Pass E, which it detects by the presence of an authored `parallelAct`. Each scenario therefore
 * arms itself as its lenses are rewritten.
 *
 * Run: npm run audit:rules            (all scenarios)
 *      npm run audit:rules -- <id>    (one scenario)
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

const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { getCVRLensPair, getCVRMirror } = B("block5CVRContent.js");

const strip = (s) => (s || "").replace(/\{[avfwb]\|([^{}]*)\}/g, "$1");
const only = process.argv[2];

/** Scenarios that run a reflection at all: the wish and the prediction test do not. */
const WITH_LENSES = BLOCK5_SCENARIOS.filter(
  (s) => (s.decisionRole ?? "decider") === "decider" && (!only || s.id === only),
);

let armedFails = 0;
let reported = 0;

for (const SCEN of WITH_LENSES) {
  /* Pass E is what authors `parallelAct`. Before it, this scenario is reported but not enforced. */
  const armed = SCEN.options.every((o) => (o.cvrSeed || {}).parallelAct);

  const lenses = SCEN.options.map((o) => ({
    o,
    pair: getCVRLensPair(SCEN, o, {
      violatedKey: "vulnerabilityProtectionSensitivity", framing: "context", who: "group",
    }),
  }));
  const whole = (L) =>
    /* JOINED WITH A PERIOD, not a space: the heading has no full stop of its own, so a space glued
       it onto the body's first sentence and R8 measured a 27-word sentence nobody ever reads. */
    [strip(L.heading), strip(L.body), ...(L.points || []).map((p) => strip(p.text)), strip(L.prompt || "")]
      .filter(Boolean).join(". ");

  let fails = 0;
  const ok = (name, cond, detail) => {
    console.log("  " + (cond ? "PASS" : armed ? "FAIL" : "TODO") + "  " + name.padEnd(54) + (detail || ""));
    if (!cond) fails++;
  };

  console.log("\n" + "=".repeat(96));
  console.log(SCEN.id + (armed ? "" : "   (Pass E not done — reported, not enforced)"));
  console.log("=".repeat(96));

  /* R1 — never announce the resemblance. */
  const BANNED = /\b(same|also|just like)\b/i;
  const said = [];
  for (const { o, pair } of lenses) for (const f of ["context", "directness"]) {
    const m = whole(pair[f]).match(BANNED);
    if (m) said.push(o.id + "/" + f + ': "' + m[0] + '"');
  }
  ok("R1  neither lens ever says same / also / just like", said.length === 0,
     said.join("; ") || "clean across all 12 lenses");

  /* R2 — nothing happens more than 24 hours out. A span in the PAST is backstory, not a
     consequence: "he has been on home oxygen for two years" explains why he needs the mask. */
  /*
   * THE HORIZON IS THE SCENARIO'S OWN DECISION CYCLE, not a fixed 24 hours.
   *
   * The rule is that a consequence must land near enough for a reader to join it to the choice.
   * For an escape that is the night, and anything in weeks or months broke it. For an ALLOCATION
   * the cycle is the month before more supply arrives, and the cost of being passed over IS the
   * wait for the next batch - so a month is inside the cycle there, and a year is still outside it.
   * The lens labels move with it: see `horizon` in block5CVRContent.ts.
   */
  const MONTHLY = SCEN.options.some((o) => /dose|visit|round/i.test(o.summary || ""));
  const FAR = MONTHLY
    ? /\b(years|year|winter|spring|summer|season)\b/i
    : /\b(month|months|week|weeks|year|years|winter|spring|summer|season|fortnight)\b/i;
  const far = [];
  for (const { o, pair } of lenses) for (const f of ["context", "directness"]) {
    for (const p of pair[f].points || []) {
      const forward = strip(p.text).replace(/\b(has|had|have) been[^.]*?\./gi, "");
      if (FAR.test(forward)) far.push(o.id + "/" + f + ": " + strip(p.text).slice(0, 60));
    }
  }
  ok("R2  no consequence reaches past 24 hours", far.length === 0,
     far.join("; ") || "every consequence inside the day");

  /* R3 — the directness lens names the method printed on the card; the context lens has an
     authored act of its own. The second world's nouns differ per scenario, so what is checked
     there is that the sentence exists and is not the directness act with the pronouns swapped. */
  const noMethod = [];
  for (const { o, pair } of lenses) {
    const kind = (o.method || {}).kind;
    const words = {
      car: /\bcar\b|\bdrive|\bdriving\b/i, bus: /\bbus\b|\bboat\b|\bhoist\b/i,
      van: /\bminibus\b|\bvan\b/i, foot: /\bwalk|\bfoot|\bclimb|\bpath\b|\bladder\b/i,
      stay: /\bstay|\btape|\binside\b/i,
      /* The allocation scenarios, where the method is how the short supply is handed out. */
      score: /\bscore|\brank|\bmodel|\bodds\b/i,
      list: /\blist\b|\bregister\b|\bsort|\bworked down/i,
      draw: /\bdraw\b|\bdrawn\b|\blottery\b|\bslip/i,
      hold: /\bhold|\bheld\b|\bkept\b|\breserv|\bprotect/i,
      /* Scenario 4: cutting HOURS. */
      route: /\bround|\bmap\b|\bdriv|\broute/i,
      even: /\bevery client|\bone visit in four|\bequal/i,
      trim: /\bshort|\btrim|\bcut every visit/i,
    }[kind];
    if (!words) { noMethod.push(o.id + " (no method on the card)"); continue; }
    if (!words.test(strip(pair.directness.body))) noMethod.push(o.id + "/directness");
    const seed = o.cvrSeed || {};
    if (!seed.parallelAct) noMethod.push(o.id + "/context on the generic fallback");
    else if (strip(seed.parallelAct).replace(/their|they|them|a passenger/gi, "")
          === strip(seed.act || "").replace(/your|you/gi, "")) {
      noMethod.push(o.id + "/context is the directness act reworded");
    }
  }
  ok("R3  both lenses name a method, each in its own world", noMethod.length === 0,
     noMethod.join(", ") || "all 6 options, both lenses");

  /* R4 — nobody knows what happens next. */
  const hard = [];
  for (const { o, pair } of lenses) for (const f of ["context", "directness"]) {
    const later = (pair[f].points || [])[1];
    if (later && !/\b(may|could|might)\b/i.test(strip(later.text))) hard.push(o.id + "/" + f);
  }
  ok("R4  the later consequence hedges with may or could", hard.length === 0, hard.join(", ") || "all 12");

  /* R5 — THE INSTRUMENT. The two lenses must differ in exactly one respect: authorship. */
  const YOU = /\byou\b|\byour\b/i;
  const blame = [];
  for (const { o, pair } of lenses) {
    if (!YOU.test(whole(pair.directness))) blame.push(o.id + "/directness never says you");
    if (YOU.test(whole(pair.context))) blame.push(o.id + "/context says you");
  }
  ok("R5  directness blames, context names nobody", blame.length === 0,
     blame.join("; ") || "all 6 split cleanly");

  /* R6 — a line insisting nobody is to blame raises blame as surely as naming somebody. */
  const closes = [];
  for (const { o, pair } of lenses) {
    if (!pair.directness.prompt) closes.push(o.id + "/directness has no closing line");
    if (pair.context.prompt) closes.push(o.id + "/context HAS a closing line");
  }
  ok("R6  only directness closes on a line", closes.length === 0,
     closes.join("; ") || "context ends on its last consequence");

  /* R7 — the whole parallel sentence carries the person color, and markup does not nest. */
  const color = SCEN.options
    .filter((o) => { const s = (o.cvrSeed || {}).parallelAct; return !s || !/^\{w\|[^{}]*\}$/.test(s); })
    .map((o) => o.id);
  ok("R7  every parallel sentence is one whole {w|...}", color.length === 0,
     color.join(", ") || "6 of 6, and no nested markup");

  /* R8 — participants read this in a second language. */
  let worst = 0, worstAt = "";
  for (const { o, pair } of lenses) for (const f of ["context", "directness"]) {
    for (const sent of whole(pair[f]).split(/(?<=[.!?])\s+/)) {
      const w = sent.trim().split(/\s+/).filter(Boolean).length;
      if (w > worst) { worst = w; worstAt = o.id + "/" + f; }
    }
  }
  ok("R8  no sentence anywhere over 25 words", worst <= 25, "longest is " + worst + "w (" + worstAt + ")");

  /* R9 — the APA mirror table, marked on both sides so the numbers do the work "same" used to. */
  const rows = getCVRMirror(SCEN);
  const unmarked = rows.filter((r) => !/\{a\|/.test(r.here) || !/\{a\|/.test(r.there));
  ok("R9  the APA mirror has rows, marked on both sides", rows.length > 0 && unmarked.length === 0,
     rows.length + " rows, " + unmarked.length + " unmarked");

  /* R10 — a row whose second half was never on screen would introduce a world rather than
     reveal one, which is the exact failure the last-lens gate on the APA page exists to prevent. */
  const settingText = strip(lenses[0].pair.context.body).toLowerCase();
  const orphans = rows.filter((r) => {
    const nums = strip(r.there).toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand)\b/g) || [];
    return nums.length > 0 && !nums.some((n) => settingText.includes(n));
  });
  ok("R10 every mirror row was actually shown in the lens", orphans.length === 0,
     orphans.map((r) => strip(r.there)).join("; ") || "all rows trace back to the setting");

  reported++;
  if (armed) armedFails += fails;
}

console.log("\n" + "=".repeat(96));
console.log(armedFails === 0
  ? "### ALL OF THE RESEARCHER'S RULES HOLD (" + reported + " scenario(s) reported) ###"
  : "### " + armedFails + " RULE(S) BROKEN in scenarios that have finished Pass E ###");
console.log("=".repeat(96) + "\n");
process.exit(armedFails ? 1 : 0);
