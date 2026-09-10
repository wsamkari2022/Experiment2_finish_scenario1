/**
 * simulate_position.cjs — the authoring gate for Position Effect.
 *
 * WHAT THIS ANSWERS
 * -----------------
 * Position Effect claims that a participant's choices move as the cost shifts from themselves, to
 * their household, to strangers. Two things have to be true before that claim can be made, and
 * neither can be assumed:
 *
 *   1. IT MUST DISCRIMINATE. A participant who behaves identically in every position must score
 *      near 0, and one who behaves differently must score high. If both score the same, the
 *      measure is noise wearing a name.
 *
 *   2. THE MENUS MUST NOT DO THE WORK. Each scenario offers a different six options. If scenario
 *      3's menu simply sits further from a given profile than scenario 1's, then a raw distance
 *      partly measures WHICH SCENARIO YOU WERE IN rather than HOW YOU RESPONDED. This is the
 *      first question any examiner asks.
 *
 * WHY THIS IS RE-MEASURED RATHER THAN CITED
 * -----------------------------------------
 * BLOCK5_POSITION_EFFECT_PLAN.md reports the menu confound at 1.0-2.4 points against ~20 points
 * of room. That measurement was taken BEFORE scenarios 1 and 2 were replaced with the chemical
 * release and the wildfire, and before scenarios 3-5 were retuned. Every payoff in the deck has
 * changed since. Quoting the old number would be quoting a measurement of a study that no longer
 * exists, so it is taken again here, against the scenarios that actually ship.
 *
 * Run: npm run validate:position
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
const { POLICY_DIM_KEYS } = B("block5Types.js");
const P = B("block5Position.js");
const PERF = B("block5Performance.js");

let failures = 0;
let skipped = 0;
const pass = (name, detail) => console.log(`  [PASS] ${name}${detail ? "  — " + detail : ""}`);
const fail = (name, detail) => { failures++; console.log(`  [FAIL] ${name}${detail ? "  — " + detail : ""}`); };
const skip = (name, why) => { skipped++; console.log(`  [SKIP] ${name}\n         ${why}`); };
const check = (name, cond, detail) => (cond ? pass(name, detail) : fail(name, detail));

/**
 * IS THE DRIFT CONTROL EVEN AVAILABLE?
 *
 * `driftCheck` compares scenarios that SHARE a stakePosition, so it needs at least one position
 * to appear twice. With one scenario per position it returns null, and the gates below have
 * nothing to assert.
 *
 * They are SKIPPED rather than deleted, weakened, or quietly passed. A gate rewritten until it
 * passes on a deck that cannot support it is worse than no gate: it reports green over exactly
 * the hole it was built to find. Skipping states the hole out loud, and the gates re-arm on their
 * own the moment a position repeats again.
 */
const POSITION_COUNTS = BLOCK5_SCENARIOS.reduce((acc, sc) => {
  acc[sc.stakePosition] = (acc[sc.stakePosition] ?? 0) + 1;
  return acc;
}, {});
const REPEATED_POSITIONS = Object.entries(POSITION_COUNTS).filter(([, n]) => n >= 2);
const DRIFT_CONTROL_AVAILABLE = REPEATED_POSITIONS.length > 0;
const DRIFT_UNAVAILABLE_WHY =
  "No stakePosition appears in more than one scenario (" +
  Object.entries(POSITION_COUNTS).map(([k, n]) => `${k} x${n}`).join(", ") +
  "), so driftCheck returns null and there is nothing to measure. CONSEQUENCE: a genuine\n         " +
  "position-shifter and a random responder both score Position Effect 100, and nothing in the\n         " +
  "suite tells them apart. Position Effect is DESCRIPTIVE until a position repeats.";

/** Builds a Block5UserProfile-shaped object from four scores. */
const profileOf = (scores) => ({
  dimensions: POLICY_DIM_KEYS.map((k) => ({ key: k, label: k, score: scores[k] })),
});

/** Five archetype profiles spanning the space of people who might arrive. */
const ARCHETYPES = {
  protector: { vulnerabilityProtectionSensitivity: 90, groupSizeSensitivity: 40, gainResponsivenessSensitivity: 20, outcomeAggregationSensitivity: 40 },
  maximiser: { vulnerabilityProtectionSensitivity: 25, groupSizeSensitivity: 85, gainResponsivenessSensitivity: 75, outcomeAggregationSensitivity: 85 },
  middle:    { vulnerabilityProtectionSensitivity: 55, groupSizeSensitivity: 55, gainResponsivenessSensitivity: 50, outcomeAggregationSensitivity: 55 },
  lowDemand: { vulnerabilityProtectionSensitivity: 20, groupSizeSensitivity: 25, gainResponsivenessSensitivity: 30, outcomeAggregationSensitivity: 20 },
  highDemand:{ vulnerabilityProtectionSensitivity: 90, groupSizeSensitivity: 88, gainResponsivenessSensitivity: 70, outcomeAggregationSensitivity: 90 },
};

/** A scenario result carrying only what the measure reads. */
const resultOf = (scenario, optionId) => ({ scenarioId: scenario.id, selectedOptionId: optionId });

/** Picks, per scenario, the option nearest / farthest from a profile. */
function nearestFarthest(profile, scenario) {
  const scored = scenario.options.map((o) => ({ id: o.id, d: P.profileDistance(profile, o) }));
  scored.sort((a, b) => a.d - b.d);
  return { nearest: scored[0], farthest: scored[scored.length - 1] };
}

console.log("\n==============================================================================");
console.log("  1. THE MENU CONFOUND  —  re-measured on the scenarios that ship");
console.log("==============================================================================");
/*
 * For each archetype: how much does the MENU alone shift the achievable distance between
 * scenarios, compared with how much room each scenario gives INSIDE itself?
 *
 *   menu spread = the range of per-scenario MEAN distances (what you get by scenario alone)
 *   room        = farthest - nearest inside one scenario (what your CHOICE can move)
 *
 * The signal has to be several times the confound or the measure is partly a scenario id.
 */
let worstRatio = Infinity;
for (const [name, scores] of Object.entries(ARCHETYPES)) {
  const profile = profileOf(scores);
  const means = [], rooms = [];
  for (const sc of BLOCK5_SCENARIOS) {
    const ds = sc.options.map((o) => P.profileDistance(profile, o));
    means.push(ds.reduce((a, b) => a + b, 0) / ds.length);
    rooms.push(Math.max(...ds) - Math.min(...ds));
  }
  const menuSpread = Math.max(...means) - Math.min(...means);
  const room = rooms.reduce((a, b) => a + b, 0) / rooms.length;
  const ratio = room / menuSpread;
  worstRatio = Math.min(worstRatio, ratio);
  console.log(`  ${name.padEnd(11)} menu spread ${menuSpread.toFixed(1).padStart(5)} pts` +
              `   room inside a scenario ${room.toFixed(1).padStart(5)} pts   ratio ${ratio.toFixed(1)}x`);
}
check("choice moves the number several times more than the menu does",
  worstRatio >= 3, `worst ratio ${worstRatio.toFixed(1)}x (gate: >= 3x)`);

console.log("\n==============================================================================");
console.log("  2. IT DISCRIMINATES");
console.log("==============================================================================");
/*
 * Three synthetic participants, each defined by a RULE rather than by a score, so the rule is
 * what the measure has to recover:
 *
 *   steady   — always takes the option nearest their own profile, whatever the position
 *   drifter  — nearest when they are at risk, farthest when only other people are
 *   erratic  — farthest, then nearest, alternating, ignoring position entirely
 */
const behaviors = {
  steady:  (profile, sc) => nearestFarthest(profile, sc).nearest.id,
  drifter: (profile, sc) => (sc.stakePosition === "others"
    ? nearestFarthest(profile, sc).farthest.id
    : nearestFarthest(profile, sc).nearest.id),
  erratic: (profile, sc, i) => (i % 2 === 0
    ? nearestFarthest(profile, sc).farthest.id
    : nearestFarthest(profile, sc).nearest.id),
};

const table = {};
for (const [bname, pick] of Object.entries(behaviors)) {
  table[bname] = {};
  for (const [aname, scores] of Object.entries(ARCHETYPES)) {
    const profile = profileOf(scores);
    const results = BLOCK5_SCENARIOS.map((sc, i) => resultOf(sc, pick(profile, sc, i)));
    const a = P.analysePosition(results, profile);
    table[bname][aname] = a;
  }
}

console.log("  behavior     " + Object.keys(ARCHETYPES).map((a) => a.padStart(11)).join(""));
for (const bname of Object.keys(behaviors)) {
  const row = Object.keys(ARCHETYPES)
    .map((a) => String(table[bname][a].effect).padStart(11)).join("");
  console.log("  " + bname.padEnd(14) + row);
}

const steadyMax = Math.max(...Object.values(table.steady).map((a) => a.effect));
const drifterMin = Math.min(...Object.values(table.drifter).map((a) => a.effect));
check("a participant who ignores position scores low", steadyMax <= 15, `worst steady = ${steadyMax}`);
check("a participant who switches by position scores high", drifterMin >= 50, `weakest drifter = ${drifterMin}`);
check("the two are cleanly separated", drifterMin > steadyMax + 25,
  `gap = ${drifterMin - steadyMax} points`);

/*
 * THE MOST IMPORTANT GATE IN THIS FILE.
 *
 * `erratic` scores the SAME headline as `drifter` - both 100 - and they are not remotely the same
 * person. One responds to who carries the cost; the other is not responding to anything. If the
 * headline were reported alone, a random responder would be published as a position finding.
 *
 * The drift check is what separates them, and it separates them completely: the drifter's three
 * "other people" scenarios agree with each other (0 spread), while the erratic participant's swing
 * across the full range (100 spread) despite sharing a position. This is why the caption on the
 * chart card reports the drift check in the same sentence as the effect, and never after it.
 */
const erraticDrift = Math.min(...Object.values(table.erratic).map((a) => a.drift));
const drifterDrift = Math.max(...Object.values(table.drifter).map((a) => a.drift));
check("the headline ALONE cannot separate a drifter from a random responder",
  Math.min(...Object.values(table.erratic).map((a) => a.effect)) >= drifterMin,
  "both reach the same effect - which is the reason the next gate exists");
if (DRIFT_CONTROL_AVAILABLE) {
  check("the drift check separates them completely",
    erraticDrift > drifterDrift + 40,
    `drifter drift <= ${drifterDrift}, erratic drift >= ${erraticDrift}`);
} else {
  skip("the drift check separates them completely", DRIFT_UNAVAILABLE_WHY);
}

console.log("\n==============================================================================");
console.log("  3. THE DRIFT CHECK CATCHES TIME-ON-TASK");
console.log("==============================================================================");
/*
 * The confound Position Effect cannot remove on its own: "for others" is always last. A
 * participant who drifts steadily with TIME - not with position - must set the drift check off,
 * otherwise the number would be reported as a position finding when it is a fatigue finding.
 */
if (!DRIFT_CONTROL_AVAILABLE) {
  skip("a time-drifter sets the drift check off", DRIFT_UNAVAILABLE_WHY);
  skip("a steady participant does not",
    "Same cause. WITH NO DRIFT CONTROL, the time-on-task confound is unmeasured: 'deciding for\n         " +
    "others' is always last, so a participant who simply drifts as the session wears on is\n         " +
    "indistinguishable from one responding to who carries the cost.");
} else {
  const profile = profileOf(ARCHETYPES.middle);
  // moves further from themselves with every scenario, regardless of who pays
  const creeping = BLOCK5_SCENARIOS.map((sc, i) => {
    const scored = sc.options
      .map((o) => ({ id: o.id, d: P.profileDistance(profile, o) }))
      .sort((a, b) => a.d - b.d);
    return resultOf(sc, scored[Math.min(i, scored.length - 1)].id);
  });
  const a = P.analysePosition(creeping, profile);
  const nRepeated = Math.max(...REPEATED_POSITIONS.map(([, n]) => n));
  check("a time-drifter sets the drift check off", (a.drift ?? 0) >= 20,
    `drift check = ${a.drift} across the ${nRepeated} same-position scenarios`);

  const steady = BLOCK5_SCENARIOS.map((sc) => resultOf(sc, nearestFarthest(profile, sc).nearest.id));
  const b = P.analysePosition(steady, profile);
  check("a steady participant does not", (b.drift ?? 0) <= 15, `drift check = ${b.drift}`);
}

console.log("\n==============================================================================");
console.log("  3b. THE DRIFT CHECK RE-ARMS — verified on synthetic decks, not on the shipped one");
console.log("==============================================================================");
/*
 * The three gates above are SKIPPED on a deck where no position repeats, and a skipped gate
 * proves nothing. This section exists so that the claim "they re-arm automatically" is itself
 * tested, on hand-built rows rather than on BLOCK5_SCENARIOS.
 *
 * The third case is the one that matters. driftCheck used to read `r.position === "others"`, so a
 * deck that repeated `self` instead would have gone on returning null — the control absent while
 * still appearing to ship. That case fails against the old implementation and passes against the
 * current one.
 */
{
  const row = (index, position, departure) => ({
    index, position, departure, distance: departure, farthest: 100,
    scenarioId: `s${index}`, scenarioTitle: `S${index}`, optionId: "o", optionTitle: "O",
    valueDrift: {},
  });
  const cases = [
    ["no position repeats -> the control is correctly unavailable",
      [row(1, "self", 10), row(2, "self_and_group", 40), row(3, "others", 90)], null],
    ["one position twice -> the control runs",
      [row(1, "self", 10), row(2, "others", 20), row(3, "others", 75)], 55],
    ["the repeated position is DISCOVERED, not assumed to be 'others'",
      [row(1, "self", 12), row(2, "self", 70), row(3, "others", 44)], 58],
    ["the largest same-position group is used when two repeat",
      [row(1, "self", 10), row(2, "self", 20), row(3, "others", 0), row(4, "others", 50),
       row(5, "others", 90)], 90],
    ["a steady participant at a repeated position scores near zero",
      [row(1, "self", 10), row(2, "others", 41), row(3, "others", 44)], 3],
  ];
  for (const [name, rows, expect] of cases) {
    const got = P.driftCheck(rows);
    check(name, got === expect, `drift check = ${got}${got === expect ? "" : ` (expected ${expect})`}`);
  }
}

console.log("\n==============================================================================");
console.log("  3c. THE WORKPLACE PAIR — company values, stance, and the mirror");
console.log("==============================================================================");
{
  const CO = B("block5Company.js");
  const MIR = B("block5Mirror.js");
  const pairRecipient = BLOCK5_SCENARIOS.find((s) => s.decisionRole === "recipient" && s.employer);
  const pairDecider = pairRecipient && BLOCK5_SCENARIOS.find(
    (s) => s.id !== pairRecipient.id && (s.decisionRole ?? "decider") === "decider"
      && s.employer?.name === pairRecipient.employer?.name);

  if (!pairRecipient || !pairDecider) {
    skip("the workplace pair is present",
      "No employer appears in both a decider and a recipient scenario, so there is no mirror to\n         measure. Every gate in this section needs one.");
  } else {
    /* THE PRECONDITION. The mirror measures position only while the content is identical; if one
       side is ever edited alone, every number below still computes and silently measures content. */
    check("the pair offers the SAME six options, in the same order",
      MIR.mirrorContentMatches(pairDecider.id, pairRecipient.id),
      `${pairDecider.id} vs ${pairRecipient.id}`);
    check("the pair is decide-then-wish, adjacent, in that order",
      BLOCK5_SCENARIOS.indexOf(pairRecipient) === BLOCK5_SCENARIOS.indexOf(pairDecider) + 1,
      `slots ${BLOCK5_SCENARIOS.indexOf(pairDecider) + 1} then ${BLOCK5_SCENARIOS.indexOf(pairRecipient) + 1}`);
    check("the recipient half runs no reflection",
      pairRecipient.options.every((o) => !o.cvrSeed),
      "no cvrSeed on any of its options");

    /*
     * A MISALIGNED WISH MUST STILL NOT OPEN A REFLECTION.
     *
     * The case is not hypothetical: the gate below shows every archetype has misaligned options on
     * that table, so a participant WILL wish for one. They made no decision, so there is nothing to
     * hold them to — the wish goes straight to a single confirmation page instead.
     *
     * `scenarioIsScored` is the one predicate the app's CVR guard reads, so asserting it here
     * asserts the behavior rather than a copy of it. Checking only that the options carry no
     * cvrSeed would not be enough: a seed-less option still reaches the CVR path and falls back to
     * GENERIC content, which is precisely the wrong page appearing with plausible-looking text.
     */
    {
      const { scenarioIsScored } = B("block5CVR.js");
      const { labelOptions, isMisaligned } = B("block5CVR.js");
      check("a wish never opens a reflection, however misaligned",
        scenarioIsScored(pairRecipient) === false,
        "scenarioIsScored(recipient) = false, so the CVR guard in the app can never open");
      const counts = Object.entries(ARCHETYPES).map(([name, scores]) => {
        const n = labelOptions(pairRecipient.options, profileOf(scores))
          .filter((o) => isMisaligned(o.level)).length;
        return `${name}:${n}`;
      });
      check("misaligned wishes are reachable, so the page above is the one that matters",
        counts.every((c) => Number(c.split(":")[1]) > 0), counts.join("  "));
    }

    /*
     * THE CARDS MUST APPEAR IN THE SAME ORDER IN BOTH HALVES.
     *
     * Shuffling the second presentation was the original plan, as a guard against a participant
     * clicking the same position twice. It was dropped: the order comes from the planner and the
     * frozen profile, so reordering one half would mean the halves differ in the DECISION SUPPORT
     * the participant received as well as in position — and "nothing changed except the chair" is
     * the mirror's whole claim. This gate holds the decision in place, so that if anyone ever
     * reorders one side the suite says so instead of the numbers quietly changing meaning.
     */
    {
      const { plannerRank } = B("block5Planner.js");
      /* plannerRank takes a DecisionProfile — a value ORDER plus per-value thresholds — not the
         0-100 sensitivity profile the rest of this file uses. Built here from each archetype's own
         ranking so the orders compared are the ones that archetype would really be shown. */
      const decisionProfileOf = (scores) => {
        const order = [...POLICY_DIM_KEYS].sort((a, b) => scores[b] - scores[a]);
        const thresholds = {};
        for (const key of order) {
          thresholds[key] = { hasRedLine: false, strictness: 0.5, tolerance: 0.15, exchange: 2.0, source: "mirror-gate" };
        }
        return { order, thresholds, degraded: false };
      };
      const titlesOf = (scn, ids) => ids.map((id) => scn.options.find((o) => o.id === id).title);
      const mismatched = Object.entries(ARCHETYPES).filter(([, scores]) => {
        const dp = decisionProfileOf(scores);
        // ids differ by prefix by design, so compare the option TITLES the participant actually sees
        return titlesOf(pairDecider, plannerRank(pairDecider, dp).orderedIds).join("|")
            !== titlesOf(pairRecipient, plannerRank(pairRecipient, dp).orderedIds).join("|");
      }).map(([n]) => n);
      check("both halves present the six cards in the SAME order, for every profile",
        mismatched.length === 0,
        mismatched.length ? `differs for: ${mismatched.join(", ")}` : `identical for all ${Object.keys(ARCHETYPES).length} archetypes`);
    }

    /* THE COMPANY MUST OPPOSE EVERY PARTICIPANT. Its stated priority is the value they hold least,
       so this has to hold for every archetype, not just for a convenient one. */
    for (const [name, scores] of Object.entries(ARCHETYPES)) {
      const p = profileOf(scores);
      const derived = CO.deriveCompanyValues(p, pairDecider.employer);
      const mine = POLICY_DIM_KEYS.map((k) => ({ k, v: scores[k] })).sort((a, b) => a.v - b.v);
      check(`the employer prizes ${name}'s WEAKEST value`,
        derived.statedKey === mine[0].k,
        `${derived.statedKey.replace("Sensitivity", "")} (they score ${derived.participantScore})`);
    }

    /* STANCE. Reading the participant's own champion must give "resisted"; reading the option that
       champions the company's stated value must give "adopted". If those two ever agree, the
       scenario is not producing a conflict and the measure is meaningless. */
    {
      const p = profileOf(ARCHETYPES.protector);
      const co = CO.deriveCompanyValues(p, pairDecider.employer);
      const mineBest = [...pairDecider.options]
        .sort((a, b) => P.profileDistance(p, a) - P.profileDistance(p, b))[0];
      const theirsBest = [...pairDecider.options]
        .sort((a, b) => CO.companyDistance(co.statedKey, a) - CO.companyDistance(co.statedKey, b))[0];
      check("choosing what fits YOU reads as resisted",
        CO.stanceOf(p, co, mineBest).stance === "resisted", mineBest.title);
      check("choosing what fits THE COMPANY reads as adopted",
        CO.stanceOf(p, co, theirsBest).stance === "adopted", theirsBest.title);
      check("those are not the same option — the conflict is real",
        mineBest.id !== theirsBest.id, `${mineBest.id} vs ${theirsBest.id}`);
    }

    /* THE MIRROR. A participant who takes the company line while deciding and wishes for their own
       values when it lands on them must produce a positive gap on both measures. */
    {
      const p = profileOf(ARCHETYPES.protector);
      const co = CO.deriveCompanyValues(p, pairDecider.employer);
      const companyOption = [...pairDecider.options]
        .sort((a, b) => CO.companyDistance(co.statedKey, a) - CO.companyDistance(co.statedKey, b))[0];
      const ownWish = [...pairRecipient.options]
        .sort((a, b) => P.profileDistance(p, a) - P.profileDistance(p, b))[0];
      const results = BLOCK5_SCENARIOS.map((sc) => {
        if (sc.id === pairDecider.id) return resultOf(sc, companyOption.id);
        if (sc.id === pairRecipient.id) return resultOf(sc, ownWish.id);
        return resultOf(sc, nearestFarthest(p, sc).nearest.id);
      });
      const m = MIR.analyseMirror(results, p);
      check("the mirror is produced when both halves are present", !!m);
      if (m) {
        check("a self-serving reversal shows a POSITIVE mirror gap", m.mirrorGap > 0,
          `chose "${m.decided.optionTitle}" (${m.decided.departure}), wished "${m.wished.optionTitle}" (${m.wished.departure}) — gap ${m.mirrorGap}`);
        check("the wish and the decision are recognized as different options", !m.sameOption);
        check("the responsibility gap is on the same 0-100 scale as VCI",
          m.vciActed >= 0 && m.vciActed <= 100 && m.vciWished >= 0 && m.vciWished <= 100,
          `acted ${m.vciActed}, wished ${m.vciWished}, gap ${m.responsibilityGap}`);
      }
      /* And the control: wishing for exactly what you chose must read as no gap at all. */
      const same = BLOCK5_SCENARIOS.map((sc) => {
        if (sc.id === pairDecider.id) return resultOf(sc, companyOption.id);
        if (sc.id === pairRecipient.id) {
          const twin = pairRecipient.options.find((o) => o.title === companyOption.title);
          return resultOf(sc, twin.id);
        }
        return resultOf(sc, nearestFarthest(p, sc).nearest.id);
      });
      const m2 = MIR.analyseMirror(same, p);
      check("wishing for what you chose reads as no gap",
        !!m2 && m2.sameOption && m2.mirrorGap === 0, m2 ? m2.sentence : "no mirror");
      /*
       * AND THE RESPONSIBILITY GAP MUST AGREE WITH IT.
       *
       * This gate exists because the first version of the measure failed it, and nothing caught
       * that until a live run: `vciActed` averaged EVERY decider scenario and compared the result
       * to the single wish, so a participant who wished for exactly what they had chosen was
       * reported as "much truer to their values when the decision was not yours" (60 vs 85). The
       * number was reading the other three scenarios, not the change of chair.
       *
       * Both halves now come from the pair. A small residue is legitimate — the deciding half is
       * scored before its own APA update and the wish after it — so this allows a little movement
       * rather than demanding zero, which would fail for a real reason.
       */
      if (m2) {
        check("wishing for what you chose leaves the responsibility gap near zero",
          Math.abs(m2.responsibilityGap) <= 20,
          `acted ${m2.vciActed}, wished ${m2.vciWished}, gap ${m2.responsibilityGap}`);
      }
    }
  }
}

console.log("\n==============================================================================");
console.log("  4. INVARIANTS");
console.log("==============================================================================");
{
  const profile = profileOf(ARCHETYPES.protector);
  const results = BLOCK5_SCENARIOS.map((sc) => resultOf(sc, sc.options[0].id));

  const runs = new Set();
  for (let i = 0; i < 50; i++) runs.add(JSON.stringify(P.analysePosition(results, profile)));
  check("deterministic across 50 runs", runs.size === 1);

  const a = P.analysePosition(results, profile);
  check("one row per scenario", a.rows.length === BLOCK5_SCENARIOS.length,
    `${a.rows.length} rows`);
  /* Every position the deck actually uses must produce a summary row — counted from the deck, not
     from a literal 3, which stopped meaning "all of them" the moment a fourth position existed. */
  const deckPositions = new Set(BLOCK5_SCENARIOS.map((s) => s.stakePosition ?? "others"));
  check("every position in the deck is represented",
    a.summaries.length === deckPositions.size,
    `${a.summaries.length}/${deckPositions.size} — ` +
    a.summaries.map((s) => `${s.label}:${s.scenarioCount}`).join("  "));
  check("every distance sits inside its own menu range",
    a.rows.every((r) => r.distance >= r.nearest - 1e-9 && r.distance <= r.farthest + 1e-9));
  check("every departure is inside 0-100",
    a.rows.every((r) => r.departure >= 0 && r.departure <= 100));

  // A participant who chose an option identical to their own profile must score 0 distance -
  // the measure has to have a true zero or "distance" is the wrong word for it.
  const exact = BLOCK5_SCENARIOS[0].options[0];
  const mirror = profileOf(Object.fromEntries(POLICY_DIM_KEYS.map((k) => [k, exact.fingerprint[k]])));
  check("choosing an option that matches you exactly scores 0",
    P.profileDistance(mirror, exact) === 0);

  check("no profile means no analysis, rather than a fabricated zero",
    P.analysePosition(results, undefined).effect === null);
  check("a single scenario yields no headline",
    P.analysePosition([results[0]], profile).effect === null);
}

console.log("\n==============================================================================");
console.log("  5. PERFORMANCE, SEEN BY POSITION");
console.log("==============================================================================");
/*
 * The trade-off half. Two things have to hold before a paired chart is honest:
 *   - both measures really are 0-100, so the two bars can share an axis
 *   - the sentence under them says what the numbers say, in all three directions
 *
 * The third is the one worth testing, because a caption that overclaims is worse than no caption:
 * it is read, believed, and never checked against the bars above it.
 */
{
  const profile = profileOf(ARCHETYPES.protector);

  const steady = BLOCK5_SCENARIOS.map((sc) => resultOf(sc, nearestFarthest(profile, sc).nearest.id));
  const a = P.analysePosition(steady, profile);
  check("one choice row per scenario, each naming a real option",
    a.choices.length === BLOCK5_SCENARIOS.length && a.choices.every((c) => c.optionTitle.length > 3));
  check("every performance figure is inside 0-100",
    a.choices.every((c) => c.performance >= 0 && c.performance <= 100));
  check("every performance place is inside 1..6",
    a.choices.every((c) => c.performanceRank >= 1 && c.performanceRank <= c.performanceTotal));
  check("both halves of the trade-off share the 0-100 axis",
    a.tradeoffs.every((t) => t.departure >= 0 && t.departure <= 100 &&
                             t.performance >= 0 && t.performance <= 100));
  check("a participant who ignores position gets the 'stayed close' sentence",
    (a.tradeoffSentence || "").includes("stayed about as close"), a.tradeoffSentence);

  // Chase outcome quality only when other people pay: departure AND performance both rise.
  const chaser = BLOCK5_SCENARIOS.map((sc) => {
    if (sc.stakePosition !== "others") return resultOf(sc, nearestFarthest(profile, sc).nearest.id);
    const best = sc.options.map((o) => ({ id: o.id, p: PERF.capturedOf(sc, o) }))
      .sort((x, y) => y.p - x.p)[0];
    return resultOf(sc, best.id);
  });
  const b = P.analysePosition(chaser, profile);
  const bo = b.tradeoffs.find((t) => t.position === "others");
  const bs = b.tradeoffs.find((t) => t.position === "self");
  console.log(`  performance chaser:  only me ${bs.departure}/${bs.performance}` +
              `   other people ${bo.departure}/${bo.performance}   (departure/performance)`);
  check("chasing performance for strangers is reported as the trade this study looks for",
    (b.tradeoffSentence || "").includes("MORE"), b.tradeoffSentence);

  // Give up both: move away from the profile AND take the weakest-performing option.
  const loser = BLOCK5_SCENARIOS.map((sc) => {
    if (sc.stakePosition !== "others") return resultOf(sc, nearestFarthest(profile, sc).nearest.id);
    const worst = sc.options.map((o) => ({ id: o.id, p: PERF.capturedOf(sc, o) }))
      .sort((x, y) => x.p - y.p)[0];
    return resultOf(sc, worst.id);
  });
  const c = P.analysePosition(loser, profile);
  const co = c.tradeoffs.find((t) => t.position === "others");
  console.log(`  gives up both:       other people ${co.departure}/${co.performance}`);
  check("giving up values AND performance is reported as giving up both",
    (c.tradeoffSentence || "").includes("gave up both"), c.tradeoffSentence);
}

console.log("\n==============================================================================");
if (skipped > 0) {
  console.log(`  !!  ${skipped} GATE(S) SKIPPED — THE DRIFT CONTROL IS NOT AVAILABLE ON THIS DECK  !!`);
  console.log("  !!");
  console.log("  !!  Position Effect can still be REPORTED, but it cannot be DEFENDED: nothing here");
  console.log("  !!  separates a real position-shifter from someone answering at random, and the");
  console.log("  !!  time-on-task confound is unmeasured. Treat the number as descriptive.");
  console.log("  !!");
  console.log("  !!  These gates re-arm automatically once any stakePosition appears twice.");
  console.log("==============================================================================");
}
if (failures === 0) {
  console.log(skipped === 0
    ? "  ### ALL POSITION GATES PASSED ###\n"
    : `  ### POSITION GATES PASSED (${skipped} skipped — see the banner above) ###\n`);
} else {
  console.log(`  ### ${failures} POSITION GATE(S) FAILED ###\n`);
  process.exit(1);
}
