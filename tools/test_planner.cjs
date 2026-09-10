/**
 * test_planner.cjs — behavioral tests for the trade-off tree.
 *
 * These assert the things that MUST be true for the planner to be doing its job at all, on
 * synthetic option sets small enough to reason about by hand. The authoring sweep
 * (simulate_planner.cjs) asks whether the real scenarios discriminate; this file asks whether the
 * algorithm is correct in the first place. Both are needed: a correct planner over flat payoffs
 * produces one order for everyone, and a broken planner over good payoffs produces many wrong ones.
 *
 * Run: npm run test:planner
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

const { plannerRank } = B("block5Planner.js");

const GAIN = "gainResponsivenessSensitivity";
const HARM = "groupSizeSensitivity";
const HELP = "outcomeAggregationSensitivity";
const VULN = "vulnerabilityProtectionSensitivity";

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) console.log(`         expected ${e}\n         actual   ${a}`);
}
function assert(name, ok, detail) {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? `  — ${detail}` : ""}`);
}

/** A scenario shaped like a real one, but with payoffs chosen so the arithmetic is checkable. */
function scenarioOf(rows) {
  return {
    id: "unit_test",
    title: "unit",
    description: "",
    theme: { gradient: "", accent: "", shadow: "" },
    options: rows.map((r) => ({
      id: r.id,
      title: r.id,
      summary: "",
      fingerprint: {
        [GAIN]: r.gain, [HARM]: r.harm,
        [HELP]: r.help ?? 50, [VULN]: r.vuln ?? 50,
        directnessSensitivity: 50, contextSensitivity: 50,
        stakeholderPerspectiveShiftSensitivity: 50,
      },
      metrics: { speed: 50, resourceUse: 50, reliability: 50, durability: 50, reversibility: 50 },
    })),
  };
}

function profileOf(order, { tolerance = 0.15, exchange = 2.0, redLines = [] } = {}) {
  const thresholds = {};
  for (const key of order) {
    thresholds[key] = {
      hasRedLine: redLines.includes(key),
      strictness: 0.5,
      tolerance,
      exchange,
      source: "unit-test",
    };
  }
  return { order, thresholds, degraded: false };
}

/* =================================================================== *
 * 1. The worked example — the case the whole design rests on
 * =================================================================== */

console.log("\n=== 1. Worked example: the top value is set aside for a small gap ===\n");

/*
 * Raw payoffs chosen so that min-max normalization inside the scenario yields:
 *
 *     option   n(gain)   n(harm)
 *     P         1.000     0.111
 *     Q         0.916     0.944
 *     R         0.368     1.000
 *     S         0.000     0.000
 *
 * With gain ranked first, harm second, tolerance 0.15 and exchange 2.0:
 *
 *   P vs Q   diff(gain) = 0.084 < 0.15, and diff(harm) = 0.833 > 2.0 x 0.084 = 0.168
 *            -> the tree drops gain for this pair and compares on harm -> Q WINS
 *   P vs R   diff(gain) = 0.632 >= 0.15 -> the gap is real, honor the ranking -> P WINS
 *   Q vs R   diff(gain) = 0.547 >= 0.15 -> Q WINS
 *   S loses all three on gain.
 *
 *   wins: Q 3, P 2, R 1, S 0.
 *
 * The point of the test is the FIRST TWO PLACES. P is the best option in the set on the
 * participant's own rank-1 value and still does not rank first, because the amount by which it
 * wins there is smaller than this participant's own demonstrated resolution, while the amount it
 * loses on their second value is eight times larger. A sort by the top value cannot produce this,
 * and if this test ever starts returning P, Q, R, S the planner has silently become such a sort.
 */
const worked = scenarioOf([
  { id: "P", gain: 100, harm: 20 },
  { id: "Q", gain: 92, harm: 95 },
  { id: "R", gain: 40, harm: 100 },
  { id: "S", gain: 5, harm: 10 },
]);

const gainFirst = plannerRank(worked, profileOf([GAIN, HARM, HELP, VULN]));
check("order is Q, P, R, S", gainFirst.orderedIds, ["Q", "P", "R", "S"]);
assert("P is best on gain but not ranked first",
  gainFirst.byId.P.normalized[GAIN] === 1 && gainFirst.byId.P.rank !== 1,
  `P n(gain)=1.00 at rank ${gainFirst.byId.P.rank}`);
assert("Q records that it won by setting the top value aside",
  gainFirst.byId.Q.ignoredTopValueAgainst.includes("P"),
  `ignored-top against: [${gainFirst.byId.Q.ignoredTopValueAgainst.join(", ")}]`);
check("win counts", [gainFirst.byId.Q.wins, gainFirst.byId.P.wins, gainFirst.byId.R.wins, gainFirst.byId.S.wins], [3, 2, 1, 0]);

/* =================================================================== *
 * 2. Flip the profile — the same options must order differently
 * =================================================================== */

console.log("\n=== 2. Same options, different participant, different order ===\n");

/*
 * vulnerable and help are flat across all four options here, so they cannot separate anything.
 * With the ranking flipped to vulnerable > help > harm > gain, the first value that CAN separate
 * them is harm, and the order becomes harm-descending: R, Q, P, S.
 *
 * If this returned the same order as test 1, the planner would be ignoring the profile entirely —
 * which is precisely the failure mode that makes an ordering uninterpretable.
 */
const vulnFirst = plannerRank(worked, profileOf([VULN, HELP, HARM, GAIN]));
check("order is R, Q, P, S", vulnFirst.orderedIds, ["R", "Q", "P", "S"]);
assert("the two profiles produce different orders",
  gainFirst.orderedIds.join(">") !== vulnFirst.orderedIds.join(">"),
  `${gainFirst.orderedIds.join(">")}   vs   ${vulnFirst.orderedIds.join(">")}`);

/* =================================================================== *
 * 3. Non-transitivity — why wins are counted rather than sorted
 * =================================================================== */

console.log("\n=== 3. Non-transitive comparisons resolve without crashing ===\n");

/*
 * Different pairs take different branches of the tree, so "beats" is NOT a transitive relation:
 * X can beat Y, Y beat Z, and Z beat X. Handing that to Array.sort() gives an order that depends
 * on which pairs the sort happens to compare, which is both wrong and irreproducible.
 *
 * This searches a small grid for a genuine cycle and then asserts the planner still returns a
 * clean total order over it. If no cycle is found the test says so rather than passing quietly —
 * a silent pass here would mean the search, not the planner, was doing the work.
 */
/*
 * A cycle is detected from the FULL three-option run, never by comparing two options on their own.
 * Normalization is min-max WITHIN the option set, so pulling a pair out of a triple rescales both
 * of them and asks a different question than the planner ever asks. (Written the wrong way first;
 * the pairwise helper found no cycles precisely because rescaling every pair to 0-and-1 destroys
 * the small gaps the tolerance branch keys on.)
 *
 * In a three-option set, "each option won exactly one of its two comparisons" IS a 3-cycle: with
 * three pairs and three wins spread one apiece, no option beat both others, so no transitive
 * ordering exists.
 */
/*
 * The set must have SIX options, not three. Min-max normalization forces the extremes to 0 and 1,
 * so in a three-option set at least one consecutive gap is 0.5 — far wider than any tolerance
 * band, which means the "small gap on the top value" branch can never fire and no cycle can exist.
 * Two anchor options hold the ends of the range so the three candidates can sit close together on
 * gain while differing widely on harm, which is exactly the configuration the tree is built for.
 */
let cycle = null;
const cycleProfile = profileOf([GAIN, HARM, HELP, VULN]);
outer:
for (let gb = 46; gb <= 62 && !cycle; gb += 2) {
  for (let gc = 46; gc <= 62; gc += 2) {
    for (let hb = 0; hb <= 100; hb += 10) {
      for (let hc = 0; hc <= 100; hc += 10) {
        const scn = scenarioOf([
          { id: "LOW", gain: 0, harm: 50, help: 50, vuln: 50 },      // anchors the bottom of both ranges
          { id: "HIGH", gain: 100, harm: 100, help: 50, vuln: 50 },  // anchors the top
          { id: "A", gain: 54, harm: 50, help: 50, vuln: 50 },
          { id: "B", gain: gb, harm: hb, help: 50, vuln: 50 },
          { id: "C", gain: gc, harm: hc, help: 50, vuln: 50 },
        ]);
        const r = plannerRank(scn, cycleProfile);
        const beat = (x, y) => r.byId[x].beatIds.includes(y);
        if ((beat("A", "B") && beat("B", "C") && beat("C", "A")) ||
            (beat("B", "A") && beat("C", "B") && beat("A", "C"))) {
          cycle = {
            scn, prof: cycleProfile, r,
            note: `A(gain 54, harm 50)  B(gain ${gb}, harm ${hb})  C(gain ${gc}, harm ${hc})`,
          };
          break outer;
        }
      }
    }
  }
}

if (!cycle) {
  assert("a non-transitive triple exists in the search grid", false,
    "none found — the cycle test did not exercise anything");
} else {
  const r = cycle.r;
  assert("a genuine A>B>C>A cycle exists", true, cycle.note);
  assert("the three cycle members each beat exactly one of the other two",
    ["A", "B", "C"].every((id) => r.byId[id].beatIds.filter((o) => "ABC".includes(o)).length === 1),
    ["A", "B", "C"].map((id) => `${id}->${r.byId[id].beatIds.filter((o) => "ABC".includes(o)).join("")}`).join("  "));
  check("win counting still yields five distinct ranks",
    [...new Set(r.orderedIds.map((id) => r.byId[id].rank))].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert("no option is lost or duplicated", new Set(r.orderedIds).size === 5);
  const again = plannerRank(cycle.scn, cycle.prof);
  assert("resolution is deterministic across runs", r.orderedIds.join(">") === again.orderedIds.join(">"),
    r.orderedIds.join(" > "));
}

/* =================================================================== *
 * 4. No inversion — an option better on everything must rank first
 * =================================================================== */

console.log("\n=== 4. No fingerprint is inverted ===\n");

/*
 * All four policy fingerprints in this codebase are oriented HIGHER IS BETTER, including harm and
 * vulnerable: `groupSizeSensitivity: 93` means the option does WELL on "reducing harm", not
 * that it harms 93 people. An option that leads on all four must therefore rank first for EVERY
 * participant, whatever they value.
 *
 * This is the cheapest possible guard against the single most damaging mistake available here.
 * Inverting two of the four would leave the planner ranking options in the opposite order to the
 * alignment tier printed beside them on the same card, and the contradiction would read as a
 * finding rather than as a bug.
 */
const dominant = scenarioOf([
  { id: "BEST", gain: 95, harm: 95, help: 95, vuln: 95 },
  { id: "MID1", gain: 60, harm: 40, help: 55, vuln: 30 },
  { id: "MID2", gain: 30, harm: 70, help: 20, vuln: 65 },
  { id: "WORST", gain: 10, harm: 10, help: 10, vuln: 10 },
]);

const perms = (a) => a.length <= 1 ? [a] :
  a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r]));
const bad = perms([GAIN, HARM, HELP, VULN])
  .filter((order) => plannerRank(dominant, profileOf(order)).orderedIds[0] !== "BEST");
assert("the all-round best option ranks first for all 24 value orderings", bad.length === 0,
  bad.length ? `fails for ${bad.length}: e.g. ${bad[0].join(" > ")}` : "24/24");

/* =================================================================== *
 * 5. Blocked options are ordered last but never removed
 * =================================================================== */

console.log("\n=== 5. Blocked options stay in the list ===\n");

/*
 * A red line is a DISPLAY treatment, never an interaction lock. The study exists to measure
 * whether people cross lines they drew themselves, and that is unmeasurable if the interface will
 * not let them. So a blocked option must still appear, still carry a rank, and simply sit lower.
 */
const withRedLine = plannerRank(worked, profileOf([GAIN, HARM, HELP, VULN], { redLines: [HARM] }));
const blocked = withRedLine.orderedIds.filter((id) => withRedLine.byId[id].bin === "blocked");
assert("a red line on harm blocks at least one option", blocked.length > 0, `blocked: [${blocked.join(", ")}]`);
check("all four options are still present and ranked",
  withRedLine.orderedIds.length, 4);
assert("every blocked option sits below every clear one",
  withRedLine.orderedIds.every((id, i) =>
    withRedLine.byId[id].bin !== "blocked" ||
    withRedLine.orderedIds.slice(i).every((j) => withRedLine.byId[j].bin !== "clear")),
  `order: ${withRedLine.orderedIds.map((id) => `${id}(${withRedLine.byId[id].bin})`).join(" ")}`);
assert("the breach records which value and by how much",
  blocked.every((id) => withRedLine.byId[id].breaches.some((b) => b.hard && b.key === HARM && b.amount > 0)));


/* =================================================================== *
 * 6. The card text, on the real scenarios
 * =================================================================== */

console.log("\n=== 6. Explanation text generates on all 30 real options ===\n");

/*
 * The text is generated from planner state, so a change to the planner can silently produce an
 * empty, malformed, or self-contradicting sentence on a card. These assertions run every real
 * option through the real generator and check the things a participant would actually notice.
 */
const { explainOption, plannerPanelText } = B("block5PlannerText.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

const textProfile = profileOf([HARM, VULN, GAIN, HELP], { redLines: [VULN] });
let textFails = 0;
const rows = [];
for (const scn of BLOCK5_SCENARIOS) {
  const r = plannerRank(scn, textProfile);
  for (const id of r.orderedIds) {
    const ex = explainOption(scn, r, textProfile, id);
    rows.push({ scn: scn.id, id, ex, bin: r.byId[id].bin });
    if (!ex.winsLine || !ex.winsLine.endsWith(".")) textFails++;
    if (ex.rank < 1 || ex.rank > 6) textFails++;
    if (ex.chips.length !== 3) textFails++;
    // a costed or blocked card must carry its price tag; a clear one must not
    if (ex.bin !== "clear" && !ex.breachLine) textFails++;
    if (ex.bin === "clear" && ex.breachLine) textFails++;
    // no template hole ever reaches a participant
    const all = [ex.winsLine, ex.decidedLine, ex.referenceLine, ex.tradeLine, ex.breachLine]
      .filter(Boolean).join(" ");
    if (/undefined|null|NaN|\[object/.test(all)) textFails++;
  }
}
assert("every option produces well-formed card text", textFails === 0,
  textFails ? `${textFails} malformed field(s)` : `${rows.length} options checked`);

/* Exactly one card per scenario is the clean reference, and it says so. */
const refs = BLOCK5_SCENARIOS.map((scn) => {
  const r = plannerRank(scn, textProfile);
  return r.orderedIds.filter((id) =>
    explainOption(scn, r, textProfile, id).referenceLine?.startsWith("This is the option that stays")).length;
});
/* Expected shape is built from the deck, not written out: a literal [1, 1, 1, 1, 1] silently
   encoded "five scenarios" and failed the moment the deck changed size, for a reason that has
   nothing to do with what this gate is about. The claim is one clean reference PER SCENARIO. */
check("exactly one clean-reference line per scenario", refs, BLOCK5_SCENARIOS.map(() => 1));

/* The trade-off sentence must actually appear somewhere — it is the whole point of the tree. */
const withTrade = rows.filter((x) => x.ex.tradeLine).length;
assert("the trade-off sentence appears on real options", withTrade > 0, `${withTrade} of ${rows.length} cards`);

/* Blocked cards must say they remain choosable. Nothing in the copy may forbid the click. */
const blockedRows = rows.filter((x) => x.bin === "blocked");
assert("every blocked card says it can still be chosen",
  blockedRows.length > 0 && blockedRows.every((x) => /still choose it/.test(x.ex.breachLine ?? "")),
  `${blockedRows.length} blocked cards`);

/* The panel is held constant: same three lines whatever the option set. */
const panels = BLOCK5_SCENARIOS.map(() => plannerPanelText(textProfile)).map((p) => p.noteLine);
assert("the panel note is identical in every scenario", new Set(panels).size === 1, panels[0]);

console.log("\n  --- sample card, scenario 1, as a participant would read it ---");
{
  const scn = BLOCK5_SCENARIOS[0];
  const r = plannerRank(scn, textProfile);
  const pt = plannerPanelText(textProfile);
  console.log(`  PANEL  ${pt.rankingLine}`);
  console.log(`         ${pt.limitsLine}`);
  for (const id of r.orderedIds) {
    const ex = explainOption(scn, r, textProfile, id);
    const title = scn.options.find((o) => o.id === id).title;
    console.log(`\n  [${ex.rank}] ${title}${ex.binLabel ? `   <${ex.binLabel}>` : ""}`);
    console.log(`      ${ex.winsLine} ${ex.decidedLine ?? ""}`);
    if (ex.referenceLine) console.log(`      ${ex.referenceLine}`);
    if (ex.tradeLine) console.log(`      ${ex.tradeLine}`);
    if (ex.breachLine) console.log(`      ${ex.breachLine}`);
    console.log(`      ${ex.chips.join("  ·  ")}`);
  }
}

console.log(`\n  ${failures === 0 ? "ALL TESTS PASS" : `${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
