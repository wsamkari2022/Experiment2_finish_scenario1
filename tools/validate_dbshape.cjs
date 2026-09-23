/*
 * validate_dbshape.cjs — the guard on what reaches MongoDB.
 *
 * WHY THIS EXISTS. Everything under `analysis` is computed on the way out of the browser and then
 * never looked at again by anybody until somebody opens the collection months later to write a
 * paper. There is no screen where a wrong number here would be noticed. The scoring model has
 * `validate:block5` standing over it and the predictor has `validate:prediction`; this is the same
 * idea for the database writer.
 *
 * IT RUNS THE REAL FUNCTIONS. dbShape.ts is compiled to CommonJS and required, so a gate that
 * passes here passes on the code that actually ships, not on a copy of it that can drift.
 *
 * THE FIXTURE IS BUILT FROM THE REAL DECK AND THE REAL SCORING FUNCTIONS. A participant is
 * simulated by choosing an option in each of the six scenarios and then filling the result rows the
 * way the live component fills them — labelOptions for the alignment label and the fit score,
 * predictChoice for scenario 6's stored prediction. A fixture assembled from invented numbers would
 * only test that the code copies fields around.
 *
 * Run:  npm run validate:dbshape
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");

/* ------------------------------------------------------------------ compile, and be strict about
 * WHOSE errors matter.
 *
 * dbShape.ts reaches, through one type-only import, into a React component that uses `import.meta`.
 * Compiled to CommonJS that is an error in THAT file, and it is meaningless here: a type-only
 * import is erased on emit, so nothing React is required at run time. The app's own `npm run
 * typecheck` is what owns those files.
 *
 * So the rule is narrow and stated rather than "ignore errors": any error in dbShape.ts itself
 * fails this gate, and errors elsewhere are reported and allowed. */
let tscOutput = "";
try {
  execFileSync("npx", ["tsc", "-p", "tools/tsconfig.dbshape.json"], { cwd: ROOT, encoding: "utf8", shell: true });
} catch (e) {
  tscOutput = `${e.stdout ?? ""}${e.stderr ?? ""}`;
}
const ownErrors = tscOutput.split(/\r?\n/).filter((l) => l.includes("experiment/dbShape.ts("));
if (ownErrors.length) {
  console.error("\n  dbShape.ts does not compile:\n");
  for (const line of ownErrors) console.error(`    ${line}`);
  process.exit(1);
}
if (!fs.existsSync(path.join(BUILD, "dbShape.js"))) {
  console.error("  .sim-build/dbShape.js was not produced.");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const B = (f) => require(path.join(BUILD, f));

const db = B("dbShape.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { labelOptions, computeVCI, computeStability, computeSensitivityStability } = B("block5CVR.js");
const { predictChoice, predictionConfidence, PREDICTION_VERSION } = B("block5Prediction.js");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity",
             "stakeholderPerspectiveShiftSensitivity"];

const profileOf = (scores) => ({
  generatedAt: "2026-09-15T00:00:00.000Z",
  topThreeKeys: POLICY.slice(0, 3),
  topSensitivityKey: POLICY[0],
  dimensions: ALL.map((k, i) => ({
    key: k, label: k, score: scores[k] === undefined ? 50 : scores[k],
    rank: i + 1, weight: 1 / ALL.length, sourceBlocks: [],
  })),
});

/* ------------------------------------------------------------------------------ the fixture */

/**
 * One simulated participant, built the way the live block builds one.
 *
 * `pick` decides which option they take in each scenario, so a gate can run the same machinery
 * over a participant who always takes the best-fitting option and over one who always takes the
 * worst. The profile is nudged between scenarios so `policySnapshotAfter` differs from row to row —
 * without that, "the profile as it stood when this scenario opened" would be untested.
 */
function makeParticipant(startScores, pick) {
  const original = profileOf(startScores);
  let current = profileOf(startScores);
  const results = [];

  BLOCK5_SCENARIOS.forEach((scenario, index) => {
    const labeled = labelOptions(scenario.options, current);
    const chosen = pick(labeled, index);
    const rank = labeled.findIndex((o) => o.id === chosen.id) + 1;
    const role = scenario.decisionRole ?? "decider";

    /* Nudge the four values, the way CVR and APA do, so each scenario opens on a different profile.
       Scenario 6 must not move anything, which is what the last gate below checks. */
    if (role !== "predicted") {
      const moved = {};
      for (const k of ALL) {
        const now = current.dimensions.find((d) => d.key === k).score;
        moved[k] = Math.max(0, Math.min(100, now + (POLICY.includes(k) ? (index % 2 ? -6 : 5) : 0)));
      }
      current = profileOf(moved);
    }

    const row = {
      scenarioId: scenario.id,
      selectedOptionId: chosen.id,
      selectedRank: rank,
      topRankedOptionId: labeled[0].id,
      selectedWasTopCandidate: labeled[0].id === chosen.id,
      selectedWasCandidate: true,
      rankedOptionIds: labeled.map((o) => o.id),
      fitScoresByOptionId: Object.fromEntries(labeled.map((o) => [o.id, o.matchScore])),
      candidateStatusByOptionId: {},
      viewedExplanationOptionIds: [chosen.id],
      timeMs: 60_000 + index * 1000,
      alignmentLevel: chosen.level,
      matchScore: chosen.matchScore,
      firstChoiceOptionId: chosen.id,
      decisionRole: role,
      vciScore: role === "decider" ? 0.7 : 0.5,
      cvrFired: index === 0,
      cvrEndorsement: index === 0 ? "weak" : undefined,
      cvrCoordinate: index === 0
        ? { violatedKey: POLICY[0], framing: "context", who: "identified" }
        : undefined,
      /* No `q1`: the APA page's first question was removed on 17 September 2026, and this fixture
         is what a run recorded AFTER that change looks like. */
      apa: index === 0
        ? { confidence: 4, stakeholderInfluenced: true,
            prioritizedValue: POLICY[1], originalOptionId: chosen.id }
        : undefined,
      policySnapshotAfter: Object.fromEntries(
        POLICY.map((k) => [k, current.dimensions.find((d) => d.key === k).score]),
      ),
      /* The three sensitivities after this scenario, which their stabilities read. The fixture's
         profile does not move them, so all three should come out "Held steady" (D22d). */
      framingSnapshotAfter: {
        directnessSensitivity: current.dimensions.find((d) => d.key === "directnessSensitivity")?.score ?? 50,
        contextSensitivity: current.dimensions.find((d) => d.key === "contextSensitivity")?.score ?? 50,
      },
      stakeholderSnapshotAfter:
        current.dimensions.find((d) => d.key === "stakeholderPerspectiveShiftSensitivity")?.score ?? 50,
    };

    /* Scenario 6 stores the prediction that was actually shown. Built with the real predictor from
       the profile as it stood at that moment — which is the profile scenario 5 left behind. */
    if (role === "predicted") {
      const openedOn = profileOf(Object.fromEntries(
        POLICY.map((k) => [k, results[index - 1].policySnapshotAfter[k]]),
      ));
      /* THE CONFIDENCE INPUTS ARE THE ONES THE LIVE PAGE USES, and getting this wrong is what the
         self-check gate is for. The component computes VCI and Stability from the scenarios
         finished SO FAR — five of them — and hands those to the predictor. Feeding the fixture two
         invented numbers instead made the recomputation miss by 5 percentage points, which is
         exactly the kind of drift D27 exists to catch. */
      const vciNow = computeVCI(results).value;
      const stabilityNow = computeStability(results, original).value;
      const p = predictChoice(scenario.options, openedOn, { vci: vciNow, stability: stabilityNow });
      row.predictionTest = {
        version: p.version,
        temperature: p.temperature,
        confidence: p.confidence,
        separation: p.separation,
        shownProbabilities: p.options.map((o) => ({
          optionId: o.optionId, probability: o.probability, rank: o.rank, alignmentScore: o.alignmentScore,
        })),
        predictedTopOptionId: p.options.find((o) => o.rank === 1).optionId,
        firstChoiceOptionId: chosen.id,
        probabilityOfFirstChoice: p.options.find((o) => o.optionId === chosen.id).probability,
        predictionWasRight: p.options.find((o) => o.rank === 1).optionId === chosen.id,
        soundsLikeMe: 5,
        surprised: false,
        changedAfterSeeing: false,
        finalChoiceOptionId: chosen.id,
        secondsViewingPrediction: 24,
        switchesBeforeGuess: 2,
        switchesAfterGuess: 0,
        shownOrder: scenario.options.map((o) => o.id),
        rulesOpenedBeforeGuess: 3,
        rulesOpenedAfterGuess: 1,
        interactions: [
          { atMs: 1200, what: "opened_details", optionId: scenario.options[0].id },
          { atMs: 2400, what: "selected", optionId: scenario.options[0].id },
          { atMs: 3100, what: "backed_out", optionId: scenario.options[0].id },
          { atMs: 4000, what: "selected", optionId: chosen.id },
          { atMs: 5000, what: "guess_shown", optionId: chosen.id },
          { atMs: 9000, what: "answered_sounds_like", value: 5 },
          { atMs: 10_000, what: "answered_surprised", value: "No" },
          { atMs: 11_000, what: "kept_answer" },
          { atMs: 11_500, what: "committed", optionId: chosen.id },
        ],
      };
    }

    results.push(row);
  });

  const vci = computeVCI(results);
  const stab = computeStability(results, original);
  return {
    completed: true,
    completedAt: "2026-09-15T12:00:00.000Z",
    userProfile: current,
    originalProfile: original,
    scenarioResults: results,
    vci: vci.value, vciLevel: vci.level,
    stability: stab.value, stabilityLevel: stab.level,
    sensitivityStability: computeSensitivityStability(results, original),
  };
}

const bestFit = (labeled) => labeled[0];
const worstFit = (labeled) => labeled[labeled.length - 1];
const middling = (labeled, i) => labeled[Math.min(labeled.length - 1, 1 + (i % 3))];

const PEOPLE = [
  ["takes the best-fitting option every time", makeParticipant(
    { vulnerabilityProtectionSensitivity: 82, groupSizeSensitivity: 40,
      gainResponsivenessSensitivity: 61, outcomeAggregationSensitivity: 25 }, bestFit)],
  ["takes the worst-fitting option every time", makeParticipant(
    { vulnerabilityProtectionSensitivity: 15, groupSizeSensitivity: 90,
      gainResponsivenessSensitivity: 33, outcomeAggregationSensitivity: 77 }, worstFit)],
  ["a demanding participant, every value near the ceiling", makeParticipant(
    { vulnerabilityProtectionSensitivity: 100, groupSizeSensitivity: 96,
      gainResponsivenessSensitivity: 94, outcomeAggregationSensitivity: 99 }, middling)],
];

/* --------------------------------------------------------------------------------- the gates */

let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${String(id).padEnd(4)} ${msg}`);
  if (!ok) fails += 1;
};
const near = (a, b, tol) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;

console.log("");
console.log("========================================================================");
console.log("  WHAT REACHES THE DATABASE");
console.log("========================================================================");
console.log("");

/* ---- D1 · the two display pages are gone from every per-page timing ---- */
console.log("  THE TWO READ-ONLY PAGES ARE NOT TIMED");
const ledger = {
  firstStartedAt: 1000, lastEventAt: 900_000,
  stages: {
    money: { durationMs: 120_000 }, trolley: { durationMs: 90_000 },
    insights: { durationMs: 4000 }, block4: { durationMs: 200_000 },
    final_analysis: { durationMs: 3000 }, block5: { durationMs: 480_000 },
  },
};
const timingRow = db.SOURCE_MAP.find((s) => s.path === "timings");
const timings = timingRow.transform(ledger);
gate("D1", !("insights" in timings.stages) && !("final_analysis" in timings.stages),
  "neither page appears in timings.stages");
gate("D2", Array.isArray(timings.stages_not_timed) && timings.stages_not_timed.length === 2
  && typeof timings.stages_not_timed_note === "string",
  "the document says which two are missing, and why");
gate("D3", timings.stages.money.durationMs === 120_000 && timings.firstStartedAt === 1000,
  "every other stage and the run's span are untouched");

const activeRow = db.SOURCE_MAP.find((s) => s.path === "active_time");
const active = activeRow.transform({
  totalMs: 2_400_000, sittings: 2, longestIdleMs: 60_000,
  byStage: { money: 300_000, insights: 120_000, block5: 900_000, final_analysis: 60_000 },
});
gate("D4", !("insights" in active.by_stage_minutes) && !("final_analysis" in active.by_stage_minutes),
  "neither page appears in active_time.by_stage_minutes");
gate("D5", active.total_active_minutes === 40 && typeof active.breakdown_note === "string",
  "the total is unchanged at 40 min, and the note warns that the parts no longer sum to it");

const quality = db.buildQuality(
  { totalMs: 2_400_000, sittings: 1, longestIdleMs: 0,
    byStage: { money: 300_000, insights: 4000, final_analysis: 3000, block5: 900_000 } },
  PEOPLE[0][1], null, "Study Completed",
);
gate("D6", quality.rushed_blocks.every((b) => b.stage !== "insights" && b.stage !== "final_analysis")
  && quality.blocks_under_30_seconds === 0,
  "a 4-second glance at a read-only page is no longer a rushed block");

/* ---- D33-D36 · the four defects the 15 September audit found, each turned into a gate ---- */
console.log("");
console.log("  THINGS THAT WERE WRONG ONCE");

{
  /* The headline total narrowed when the two pages stopped being timed. That is allowed; saying
     nothing about it was not. The field that explains it must travel with the number. */
  const head = db.buildHeadline({ scenarioResults: [] }, ledger);
  gate("D33", typeof head.total_time_minutes_covers === "string"
    && head.total_time_minutes_covers.includes("active_time.total_active_minutes"),
    "headline.total_time_minutes says what it covers and points at the ledger that counts everything");
}

{
  /* A missing snapshot used to fall back to the frozen profile while the row still claimed it was
     using the profile from after scenario N. The number was right; the sentence beside it was a
     lie, and nothing on the row let a reader notice. */
  const [, sample] = PEOPLE[0];
  const broken = JSON.parse(JSON.stringify(sample));
  delete broken.scenarioResults[1].policySnapshotAfter;
  const row = db.buildMpfPredictions(broken).by_scenario[2];
  gate("D34", row.profile_snapshot_was_missing === true
    && row.profile_used.includes("as they entered Block 5")
    && row.profile_used.includes("is missing from this record"),
    "a missing snapshot is declared, and `profile_used` describes the numbers actually used");
  const intact = db.buildMpfPredictions(sample).by_scenario[2];
  gate("D35", intact.profile_snapshot_was_missing === false
    && intact.profile_used === "the participant's four values after scenario 2",
    "an intact record still reports the profile the scenario actually opened on");
}

{
  /* One number, two names, in adjacent sections. */
  const s6 = db.buildScenario6Section(PEOPLE[0][1]);
  const mpfRow = db.buildMpfPredictions(PEOPLE[0][1]).by_scenario.find((r) => r.was_shown_to_the_participant);
  gate("D36", "mpf_chance_of_their_first_choice_percent" in s6.participant
    && near(s6.participant.mpf_chance_of_their_first_choice_percent,
            mpfRow.participant.mpf_chance_of_their_first_choice_percent, 0.1),
    "the same quantity has the same name in both sections, and the same value");
}

/* D37 — what happened after the scenario-6 guess, in all three shapes: kept, changed to a different
   rule, and pressed "Change my answer" but came back to the same rule. The third is built as a
   record from before 19 September 2026 (no `pressedChangeAnswer`), so the fallback that reads the
   log is tested too. */
{
  const withS6 = (edit) => {
    const b = JSON.parse(JSON.stringify(PEOPLE[0][1]));
    const row = b.scenarioResults.find((r) => r.predictionTest);
    edit(row.predictionTest, row);
    return db.buildScenario6Section(b).participant;
  };
  const kept = withS6(() => {});
  const changed = withS6((pt, row) => {
    const other = pt.shownProbabilities.find((o) => o.optionId !== pt.firstChoiceOptionId);
    pt.changedAfterSeeing = true;
    pt.finalChoiceOptionId = other.optionId;
    pt.probabilityOfFinalChoice = other.probability;
    pt.pressedChangeAnswer = true;
    row.selectedOptionId = other.optionId;
  });
  const cameBack = withS6((pt) => {
    delete pt.pressedChangeAnswer;
    pt.interactions = [...pt.interactions, { atMs: 1, what: "changed_answer" }];
  });
  const s6scn = BLOCK5_SCENARIOS.find((s) => s.decisionRole === "predicted");
  const titleOf = (id) => s6scn.options.find((o) => o.id === id).title;
  const ok = kept.what_happened_after_the_guess === "kept their first rule" && kept.pressed_change_my_answer === false
    && changed.what_happened_after_the_guess === "changed to a different rule" && changed.pressed_change_my_answer === true
    && changed.rule_chosen_in_the_end_title === titleOf(changed.rule_chosen_in_the_end)
    && changed.rule_chosen_before_seeing_the_guess_title === titleOf(changed.rule_chosen_before_seeing_the_guess)
    && typeof changed.mpf_chance_of_their_final_choice_percent === "number"
    && cameBack.what_happened_after_the_guess === "reconsidered, then came back to their first rule"
    && cameBack.pressed_change_my_answer === true && cameBack.changed_after_seeing_the_guess === false;
  gate("D37", ok, `after the guess: "${kept.what_happened_after_the_guess}" / "${changed.what_happened_after_the_guess}" / "${cameBack.what_happened_after_the_guess}"`);
}

/* ---- every path the browser writes is a path the server accepts ----
 *
 * THE BUG THIS EXISTS FOR. `sessions` was registered in dbShape and was not in the server's
 * WRITABLE_ROOTS, so the API answered 400 to every save of it. Nothing in this suite looked at the
 * server, so the mismatch was invisible here while it lost data in production — and because the
 * outbox stopped at its first failure, the refused write held back every write queued behind it.
 *
 * It reads the server's own source rather than a copy of the list, because a copy is the thing
 * that drifts. Two rules are checked: the first segment must be an allowed root, and the whole
 * path must satisfy the server's SAFE_PATH, which permits at most two segments.
 */
{
  const serverSource = fs.readFileSync(path.join(ROOT, "server", "index.js"), "utf8");
  const rootsBlock = /const WRITABLE_ROOTS = new Set\(\[([\s\S]*?)\]\)/.exec(serverSource);
  /* Comments are stripped first. The allowlist explains itself in a comment that names the very
     section it allows, and reading THAT as an entry would let the gate pass while the real entry
     was missing — which is exactly what it did the first time it was tested. */
  const withoutComments = rootsBlock
    ? rootsBlock[1].replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ")
    : "";
  const roots = new Set((withoutComments.match(/"([a-z0-9_]+)"/g) || []).map((s) => s.replace(/"/g, "")));

  /* Paths come from two places: the source map, and the sections storage.ts sends by hand after
     Block 5 changes. Both reach the same endpoint, so both are checked. */
  const storageSource = fs.readFileSync(path.join(ROOT, "src", "experiment", "storage.ts"), "utf8");
  const handWritten = (storageSource.match(/path:\s*"([a-z0-9_.]+)"/g) || [])
    .map((s) => s.replace(/path:\s*"/, "").replace(/"$/, ""));
  const everyPath = [...new Set([...db.SOURCE_MAP.map((s) => s.path), ...handWritten])];

  const SAFE_PATH = /^[a-z0-9_]+(\.[a-z0-9_]+)?$/;
  const refused = everyPath.filter((p) => !roots.has(p.split(".")[0]));
  const malformed = everyPath.filter((p) => !SAFE_PATH.test(p));

  gate("D44", roots.size > 0 && refused.length === 0 && malformed.length === 0,
    roots.size === 0
      ? "could not read WRITABLE_ROOTS from server/index.js — this gate is not running"
      : refused.length || malformed.length
        ? "the server would REFUSE these writes: " + [...refused, ...malformed].join(", ")
        : "every section the browser writes is one the server accepts  ("
          + everyPath.length + " paths, " + roots.size + " allowed roots)");
}

/* ---- the headline carries the performance pair AND its label ---- */
{
  const head = db.buildHeadline(
    { scenarioResults: [], performance: 62, performanceCaptured: 71,
      performanceCapturedLevel: "Took most of what was available" },
    {},
  );
  gate("D40",
    head.performance_score === 62
    && head.performance_captured === 71
    && head.performance_captured_label === "Took most of what was available",
    `overall performance reaches the headline with its label  (${head.performance_score} / `
    + `${head.performance_captured} "${head.performance_captured_label}")`);
}

/* ---- every login, and the machines they came from ---- */
{
  const sessionsRow = db.SOURCE_MAP.find((s) => s.path === "sessions");
  const sessions = sessionsRow.transform({
    dropped: 2,
    sessions: [
      { browserId: "aaa", startedAt: 1_000_000, lastSeenAt: 1_600_000,
        stageAtStart: "money", stageAtLastSeen: "trolley", how: "typed_their_email" },
      { browserId: "aaa", startedAt: 90_000_000, lastSeenAt: 90_300_000,
        stageAtStart: "trolley", stageAtLastSeen: "block4", how: "continued_in_this_browser" },
      { browserId: "bbb", startedAt: 200_000_000, lastSeenAt: 200_900_000,
        stageAtStart: "block4", stageAtLastSeen: "block5", how: "restored_from_another_device" },
    ],
  });
  gate("D41",
    sessions.total_logins === 5
    && sessions.logins_listed_here === 3
    && sessions.older_logins_counted_but_not_listed === 2
    && sessions.browsers_used === 2
    && sessions.used_more_than_one_browser === true
    && sessions.ever_restored_from_another_device === true
    && sessions.list[0].number === 3
    && sessions.list[0].browser_number === 1
    && sessions.list[2].browser_number === 2
    && sessions.list[0].minutes_open === 10,
    `logins are counted, numbered and traced to machines  (${sessions.total_logins} logins over `
    + `${sessions.browsers_used} browsers, ${sessions.older_logins_counted_but_not_listed} older not listed)`);

  /* The history has to travel with a participant; the browser id must not, or two machines read
     as one and the whole section stops meaning anything. */
  gate("D42",
    db.RESUME_FILES.includes("vrds_session_log") && !db.RESUME_FILES.includes("vrds_browser_id"),
    "the login history is on the resume list and the browser id is not");
}

/* ---- the prediction percentages: the distance, and the short table that carries it ---- */
{
  const [, block5] = PEOPLE[0];
  const full = db.buildMpfPredictions(block5);
  const short = db.buildMpfPercentages(full);

  /* The distance is stored rather than left to be subtracted, and it IS the subtraction.
     Checked over all three simulated participants, and at least one of them must come out
     non-zero: a fixture where everybody takes the model's favourite would pass a broken
     subtraction that always returned 0. */
  let distanceIsRight = true;
  let zeroWhenNamed = true;
  let sawARealGap = 0;
  for (const [, person] of PEOPLE) {
    for (const r of db.buildMpfPredictions(person).by_scenario) {
      if (r.could_not_be_computed) continue;
      const top = r.most_expected_option_chance_percent;
      const mine = r.participant.mpf_chance_of_their_final_choice_percent;
      const stored = r.participant.points_behind_the_most_expected_option_at_final_choice;
      if (typeof top !== "number" || typeof mine !== "number") {
        if (stored !== null) distanceIsRight = false;
        continue;
      }
      if (!near(stored, Math.max(0, top - mine), 0.11)) distanceIsRight = false;
      if (r.participant.mpf_named_their_final_choice === true && stored !== 0) zeroWhenNamed = false;
      sawARealGap = Math.max(sawARealGap, stored);
    }
  }
  gate("D38", distanceIsRight && zeroWhenNamed && sawARealGap > 0,
    "how far behind the model's favourite their choice sat is stored, 0 when it WAS the "
    + "favourite  (widest gap seen " + sawARealGap + " points)");

  /* The short table is a copy, so it must agree with the long one row for row. */
  const agrees = short.by_scenario.length === full.by_scenario.length
    && short.by_scenario.every((s, i) => {
      const f = full.by_scenario[i];
      return s.scenario_id === f.scenario_id
        && s.order_shown === f.order_shown
        && s.most_expected_option_id === f.most_expected_option_id
        && s.most_expected_option_chance_percent === f.most_expected_option_chance_percent
        && s.their_final_choice_option_id === f.participant.final_choice_option_id
        && s.their_final_choice_chance_percent === f.participant.mpf_chance_of_their_final_choice_percent
        && s.points_behind_the_most_expected_option_at_final_choice
             === f.participant.points_behind_the_most_expected_option_at_final_choice;
    });
  gate("D39", agrees && short.rule_version === full.rule_version,
    `the short percentage table agrees with the full section, row for row  (${short.by_scenario.length} rows)`);

  /* It must also be readable on its own: a title beside every id, and the guessing baseline. */
  const readable = short.by_scenario.every((r) =>
    (r.most_expected_option_id === null || typeof r.most_expected_option_title === "string")
    && typeof r.chance_if_guessing_percent === "number"
    && typeof r.was_shown_to_the_participant === "boolean");
  const onlySix = short.by_scenario.filter((r) => r.was_shown_to_the_participant === true).length === 1;
  gate("D43", readable && onlySix,
    "each row names its options, carries the guessing baseline, and only scenario 6 was shown");
}

/* ---- the position rows, recomputed from the raw deck rather than trusted ----
 *
 * WHY ARITHMETIC IS REDONE HERE INSTEAD OF CALLING THE SAME FUNCTION. Every other gate in this
 * file checks that dbShape COPIED a number correctly. These two check that the number is RIGHT:
 * the distance and the departure share are worked out again from the option fingerprints and the
 * frozen profile, by hand, and compared with what reached the document. A gate that called
 * analysePosition would agree with a wrong analysePosition.
 */
{
  /* All three fixtures, not one: they choose very differently, and a distance formula can be
     right for somebody who always takes the nearest option and wrong for somebody who does not. */
  let rowsRightAll = true, meansRightAll = true, rowsSeen = 0;
  const problems = [];
  for (const [, block5] of PEOPLE) {
  const position = db.buildPositionSection(block5);
  const frozen = {};
  for (const d of block5.originalProfile.dimensions) frozen[d.key] = d.score;

  /* distance = mean |profile − option| over the four policy values. */
  const distanceOf = (option) =>
    POLICY.reduce((a, k) => a + Math.abs((frozen[k] ?? 0) - (option.fingerprint[k] ?? 0)), 0)
    / POLICY.length;

  let rowsRight = true;
  let worstDistance = 0;
  let worstShare = 0;
  const detail = [];

  for (const row of position.by_scenario) {
    const scenario = BLOCK5_SCENARIOS.find((s) => s.id === row.scenario_id);
    const result = block5.scenarioResults.find((r) => r.scenarioId === row.scenario_id);
    const chosen = scenario.options.find((o) => o.id === result.selectedOptionId);

    const mine = distanceOf(chosen);
    const all = scenario.options.map(distanceOf);
    const nearest = Math.min(...all);
    const farthest = Math.max(...all);
    const span = farthest - nearest;
    const share = span <= 0 ? 50 : Math.round(((mine - nearest) / span) * 100);

    worstDistance = Math.max(worstDistance, Math.abs(row.distance_from_profile_before_block5 - mine));
    worstShare = Math.max(worstShare, Math.abs(row.departure_share - share));
    if (Math.abs(row.distance_from_profile_before_block5 - mine) > 0.06
      || Math.abs(row.departure_share - share) > 0.6
      || row.position !== scenario.stakePosition) {
      rowsRight = false;
      detail.push(`${row.scenario_id}: stored ${row.distance_from_profile_before_block5}/`
        + `${row.departure_share}%, recomputed ${Math.round(mine * 10) / 10}/${share}%`);
    }
  }

  rowsSeen += position.by_scenario.length;
  if (!rowsRight) { rowsRightAll = false; problems.push(...detail); }

  /* The veil scenario has no position by construction, and the means must be the means. */
  const hasVeil = position.by_scenario.some((r) => r.position === "behind_the_veil");
  let meansRight = true;
  for (const summary of position.by_position) {
    const mine = position.by_scenario.filter((r) => r.position === summary.position);
    const mean = mine.reduce((a, r) => a + r.departure_share, 0) / mine.length;
    if (Math.abs(mean - summary.mean_departure_share) > 0.6) meansRight = false;
    if (mine.length !== summary.scenarios_at_this_position) meansRight = false;
  }
  const spread = position.by_position.map((s) => s.mean_departure_share);
  const effect = spread.length > 1 ? Math.max(...spread) - Math.min(...spread) : null;
  const effectRight = effect === null
    ? position.overall_effect === null
    : Math.abs(effect - position.overall_effect) <= 0.6;

  if (hasVeil || !meansRight || !effectRight) meansRightAll = false;
  }

  gate("D45", rowsRightAll,
    rowsRightAll
      ? `every position row recomputes from the deck, by hand  (${rowsSeen} rows across `
        + `${PEOPLE.length} very different participants)`
      : `position rows disagree with the deck: ${problems.join(" | ")}`);
  gate("D46", meansRightAll,
    "each chair averages its own rows, the effect is their spread, and the veil is never a row");
}

/* ---- the per-scenario predictions, checked as probabilities rather than as copied fields ---- */
{
  let sumsRight = true;
  let ranksRight = true;
  let topRight = true;
  let theirsRight = true;
  let profileRight = true;
  let worstSum = 0;
  let rowsChecked = 0;

  for (const [, block5] of PEOPLE) {
  const mpf = db.buildMpfPredictions(block5);
  mpf.by_scenario.forEach((row, i) => {
    rowsChecked += 1;
    if (row.could_not_be_computed) return;

    const total = row.by_option.reduce((a, o) => a + o.mpf_chance_percent, 0);
    worstSum = Math.max(worstSum, Math.abs(100 - total));
    if (Math.abs(100 - total) > 0.35) sumsRight = false;   // one decimal per option, six options

    const ranks = row.by_option.map((o) => o.rank).sort((a, b) => a - b);
    const expected = row.by_option.map((_, n) => n + 1);
    if (JSON.stringify(ranks) !== JSON.stringify(expected)) ranksRight = false;

    const best = row.by_option.reduce((a, b) => (b.mpf_chance_percent > a.mpf_chance_percent ? b : a));
    if (best.rank !== 1 || best.option_id !== row.most_expected_option_id
      || Math.abs(best.mpf_chance_percent - row.most_expected_option_chance_percent) > 0.001) {
      topRight = false;
    }

    const theirs = row.by_option.find((o) => o.option_id === row.participant.final_choice_option_id);
    if (theirs && Math.abs(theirs.mpf_chance_percent
      - row.participant.mpf_chance_of_their_final_choice_percent) > 0.001) {
      theirsRight = false;
    }

    /* The profile a row was predicted from must be the one that scenario OPENED on: the frozen
       profile for the first, and the snapshot the previous scenario left behind for the rest. */
    const expectedProfile = i === 0
      ? Object.fromEntries(block5.originalProfile.dimensions
          .filter((d) => POLICY.includes(d.key)).map((d) => [d.key, d.score]))
      : block5.scenarioResults[i - 1].policySnapshotAfter;
    if (!row.profile_snapshot_was_missing && expectedProfile) {
      for (const k of POLICY) {
        if (Math.abs((row.profile_used_values?.[k] ?? -1) - (expectedProfile[k] ?? -2)) > 0.001) {
          profileRight = false;
        }
      }
    }
  });
  }

  gate("D47", sumsRight && ranksRight && topRight && theirsRight,
    `every prediction row is a real probability distribution  (${rowsChecked} rows across `
    + `${PEOPLE.length} participants, worst sum off by ${Math.round(worstSum * 100) / 100} points)`);

  gate("D48", profileRight,
    "each row was predicted from the profile its scenario opened on, not from a later one");
}

/* ---- the Block 5 sections, over three very different participants ---- */
for (const [who, block5] of PEOPLE) {
  console.log("");
  console.log(`  ${who.toUpperCase()}`);

  const lifted = db.buildLiftedScenarios(block5);
  const results = block5.scenarioResults;
  const i5 = results.findIndex((r) => r.decisionRole === "recipient");
  const i6 = results.findIndex((r) => r.decisionRole === "predicted");

  gate("D7", lifted.scenario5 && lifted.scenario6
    && lifted.scenario5.scenario_id === results[i5].scenarioId
    && lifted.scenario6.scenario_id === results[i6].scenarioId,
    "scenarios 5 and 6 are lifted into `blocks` under their own names");
  gate("D8", lifted.scenario5.this_is_a_copy_of === `blocks.block5_emergency_scenarios.scenarioResults[${i5}]`
    && lifted.scenario6.this_is_a_copy_of === `blocks.block5_emergency_scenarios.scenarioResults[${i6}]`,
    "each copy points at the row it was copied from, so nobody counts it twice");
  gate("D9", JSON.stringify(lifted.scenario5.answer) === JSON.stringify(results[i5])
    && JSON.stringify(lifted.scenario6.answer) === JSON.stringify(results[i6]),
    "the copy is the raw row, byte for byte");

  /* ---- scenario 6: decisions only ---- */
  const s6 = db.buildScenario6Section(block5);
  const kinds = s6.what_they_did.map((e) => e.what_happened);
  gate("D10", !kinds.includes("opened_details") && !kinds.includes("backed_out"),
    "no navigation events survive into the database");
  gate("D11", kinds.join(",") === "selected,selected,guess_shown,answered_sounds_like,answered_surprised,kept_answer,committed",
    "every decision, the guess and both answers do survive, in order");
  gate("D12", s6.wavering.rules_opened_before_the_guess === 3 && s6.wavering.switches_before_the_guess === 2,
    "the counters are untouched — they were never built from that log");
  gate("D13", typeof s6.distance_from_profile_before_block5 === "number"
    && typeof s6.distance_from_profile_before_block5_note === "string",
    "scenario 6's distance from the frozen profile is stored, and marked as not part of position");

  /* ---- alignment ---- */
  const align = db.buildAlignmentRecords(block5);
  gate("D14", align.by_scenario.length === results.length,
    `one alignment row per scenario (${align.by_scenario.length})`);
  gate("D15", align.by_scenario.every((row, i) =>
    row.alignment_score_0_to_100 === results[i].matchScore
    && row.alignment_level === results[i].alignmentLevel
    && row.chosen_option_id === results[i].selectedOptionId),
    "every label and score matches the raw scenario row it came from");
  gate("D16", align.by_scenario.filter((r) => r.counts_towards_consistency_and_stability).length
    === results.filter((r) => (r.decisionRole ?? "decider") === "decider").length
    && align.totals.scenarios_counted
      === results.filter((r) => (r.decisionRole ?? "decider") === "decider").length,
    "the wish and the prediction test are marked, and kept out of the totals");
  gate("D17", align.by_scenario[0].cvr.fired === true && align.by_scenario[0].apa.ran === true
    && align.by_scenario[1].apa.ran === false,
    "CVR and APA travel with the scenario they happened in");

  /* ---- position ---- */
  const position = db.buildPositionSection(block5);
  const positioned = position.by_scenario.length;
  const expectedPairs = (positioned * (positioned - 1)) / 2;
  gate("D18", position.between_scenarios.pairs.length === expectedPairs,
    `every scenario against every other one (${expectedPairs} pairs from ${positioned} scenarios)`);
  gate("D19", !position.between_scenarios.pairs.some(
    (p) => p.from_position === "behind_the_veil" || p.to_position === "behind_the_veil"),
    "scenario 6 is not in the position table — it has no position by construction");
  gate("D20", position.between_scenarios.alone_vs_with_dependents
    && position.between_scenarios.alone_vs_with_dependents.from_position === "self"
    && position.between_scenarios.alone_vs_with_dependents.to_position === "self_and_group",
    "alone against with-dependents is lifted out of the list");
  gate("D21", position.between_scenarios.pairs.every((p) =>
    p.distance_between_the_two_choices >= 0 && p.distance_between_the_two_choices <= 100),
    "every choice-to-choice distance is on the 0-100 scale");
  /* D22d — the three sensitivity stabilities reach the headline, each its own score and words,
     copied from the stored results rather than recomputed. */
  {
    const head = db.buildHeadline(block5, {});
    const ss = block5.sensitivityStability;
    const ok = ["directness", "context", "stakeholder"].every((w) =>
      ss[w] && head[`${w}_stability_score`] === ss[w].value && head[`${w}_stability_label`] === ss[w].level);
    gate("D22d", ok, `directness, context and stakeholder stability are in the headline  (${
      ["directness", "context", "stakeholder"].map((w) => `${w} ${head[`${w}_stability_score`]}`).join(", ")})`);
  }
  /* D21b — the decision and the wish, side by side. Each "was aligned" flag must follow the label
     stored on that scenario's own result, and each VCI must be that result's stored weight × 100:
     the section reads the record, it does not re-judge it. */
  {
    const dw = position.decided_versus_wished;
    const res = (id) => results.find((r) => r.scenarioId === id);
    const ok = !!dw
      && dw.acted_choice_was_aligned === (res(dw.acted_scenario_id)?.alignmentLevel === "aligned")
      && dw.wished_choice_was_aligned === (res(dw.wished_scenario_id)?.alignmentLevel === "aligned")
      && dw.vci_acted === Math.round(100 * res(dw.acted_scenario_id)?.vciScore)
      && dw.vci_wished === Math.round(100 * res(dw.wished_scenario_id)?.vciScore)
      && dw.responsibility_gap === dw.vci_wished - dw.vci_acted;
    gate("D21b", ok, dw
      ? `decision vs wish stored with its alignment flags  (acted ${dw.vci_acted} ${dw.acted_alignment_label}, wished ${dw.vci_wished} ${dw.wished_alignment_label})`
      : "decision vs wish stored with its alignment flags  (section missing)");
  }
  {
    const p = position.between_scenarios.pairs[0];
    const a = position.by_scenario.find((r) => r.scenario_id === p.from_scenario_id);
    const b = position.by_scenario.find((r) => r.scenario_id === p.to_scenario_id);
    gate("D22", near(p.difference_in_departure_share, b.departure_share - a.departure_share, 0.06),
      "the signed difference equals the two departure shares subtracted");
  }
  /* The stored verdict must follow the stored number, not the one before rounding — otherwise a row
     can read 0.1 and say "neither", and a reader who spots it stops trusting the whole table. */
  gate("D22b", position.between_scenarios.pairs.every((p) => {
    const id = p.difference_in_departure_share === 0
      ? "neither"
      : p.difference_in_departure_share > 0 ? p.to_scenario_id : p.from_scenario_id;
    return p.moved_further_from_themselves === id;
  }), "the direction always agrees with the difference as it is stored");
  gate("D22c", position.between_scenarios.pairs.every((p) =>
    p.moved_further_from_themselves === "neither"
    || p.moved_further_from_themselves === p.from_scenario_id
    || p.moved_further_from_themselves === p.to_scenario_id),
    "the direction names a scenario id, which stays unambiguous if a position ever repeats");

  /* ---- the prediction function, on every scenario ---- */
  const mpf = db.buildMpfPredictions(block5);
  gate("D23", mpf.by_scenario.length === results.length && mpf.rule_version === PREDICTION_VERSION,
    `one prediction row per scenario, stamped ${PREDICTION_VERSION}`);
  gate("D24", mpf.by_scenario.every((row) => {
    const total = row.by_option.reduce((a, o) => a + o.mpf_chance_percent, 0);
    return near(total, 100, 0.25);
  }), "the chances in every scenario add up to 100%");
  gate("D25", mpf.by_scenario.every((row) => {
    const scenario = BLOCK5_SCENARIOS.find((s) => s.id === row.scenario_id);
    return row.by_option.length === scenario.options.length
      && near(row.chance_if_guessing_percent, 100 / scenario.options.length, 0.1);
  }), "every option is listed, and the guessing baseline matches the option count");
  gate("D26", mpf.by_scenario.filter((r) => r.was_shown_to_the_participant).length === 1
    && mpf.by_scenario[i6].was_shown_to_the_participant === true,
    "only scenario 6 is marked as having been shown to the participant");
  gate("D27", mpf.self_check.passed === true && mpf.self_check.largest_difference_in_percentage_points <= 0.1,
    `recomputing scenario 6 reproduces what was shown (worst gap ${mpf.self_check.largest_difference_in_percentage_points} pp)`);
  gate("D28", mpf.by_scenario.every((row) =>
    row.participant.mpf_chance_of_their_first_choice_percent !== null
    && row.by_option.some((o) => o.option_id === row.participant.first_choice_option_id)),
    "the option they picked is always one of the options a chance was given to");
  gate("D29", (() => {
    const first = mpf.by_scenario[0];
    return first.using_profile_before_block5.most_expected_option_id === first.most_expected_option_id;
  })(), "in scenario 1 the moving predictor and the fixed one agree — they are the same profile there");
  gate("D30", (() => {
    const later = mpf.by_scenario.find((r, i) => i > 0 && r.profile_used_values);
    const snapshot = results[mpf.by_scenario.indexOf(later) - 1].policySnapshotAfter;
    return POLICY.every((k) => later.profile_used_values[k] === snapshot[k]);
  })(), "a later scenario is predicted from the profile the scenario before it left behind");
  gate("D31", near(mpf.confidence_dial.confidence_0_to_1,
    predictionConfidence(block5.vci, block5.stability), 0.001),
    "the confidence dial is the published function of VCI and Stability");

  /* ---- the rule that everything above rests on ---- */
  gate("D32", (() => {
    const before = results[i6 - 1].policySnapshotAfter;
    const after = results[i6].policySnapshotAfter;
    return POLICY.every((k) => before[k] === after[k]);
  })(), "scenario 6 moved no value — it is still a test OF the model, not input to it");
}

/* ---- the one room that gathers the major scores must agree with the rooms it copies ---- */
{
  let agrees = true;
  let listsRight = true;
  const gaps = [];
  for (const [who, block5] of PEOPLE) {
    const head = db.buildHeadline(block5, ledger);
    const position = db.buildPositionSection(block5);
    const alignment = db.buildAlignmentRecords(block5);
    const mpf = db.buildMpfPredictions(block5);
    const major = db.buildMajorScores(block5, ledger, {
      totalMs: 600000, byStage: { block5: 600000 }, sittings: 2, longestIdleMs: 0,
      firstSeenAt: 1, lastActiveAt: 2, lastInputAt: 2, stopped: false, owner: "x@y.z",
    }, { dropped: 0, sessions: [] }, null);

    const same = (a, b, what) => {
      if (a !== b) { agrees = false; gaps.push(`${who}: ${what} ${a} vs ${b}`); }
    };
    same(major.vci.overall_score, head.consistency_score, "vci");
    same(major.vci.overall_label, head.consistency_label, "vci label");
    same(major.vci.when_deciding_scenario_4, position.decided_versus_wished?.vci_acted, "vci acted");
    same(major.vci.when_wishing_scenario_5, position.decided_versus_wished?.vci_wished, "vci wished");
    same(major.stability.score, head.stability_score, "stability");
    same(major.stability.stakeholder_score, head.stakeholder_stability_score, "stakeholder stability");
    same(major.performance.score, head.performance_score, "performance");
    same(major.position_effect.overall, position.overall_effect, "position effect");
    same(major.visits.number_of_visits, 2, "visits");

    /* The five lists have to be lists, of the right length, in the order the participant met them. */
    if (major.position_effect.by_scenario.length !== position.by_scenario.length) listsRight = false;
    if (major.predictions_by_scenario.length !== mpf.by_scenario.length) listsRight = false;
    if (major.alignment_by_scenario.length !== alignment.by_scenario.length) listsRight = false;
    const order = major.predictions_by_scenario.map((r) => r.order_shown);
    if (JSON.stringify(order) !== JSON.stringify(order.slice().sort((a, b) => a - b))) listsRight = false;
    for (const row of major.predictions_by_scenario) {
      const source = mpf.by_scenario.find((r) => r.scenario_id === row.scenario_id);
      if (row.most_expected_option_chance_percent !== source.most_expected_option_chance_percent
        || row.their_choice_chance_percent
          !== source.participant.mpf_chance_of_their_final_choice_percent) {
        agrees = false;
        gaps.push(`${who}: prediction row ${row.scenario_id}`);
      }
    }
    /* The three profiles are three different things, and the frozen one must never move. */
    const before = db.buildProfileChange(block5)?.before;
    if (JSON.stringify(major.profile_before_block5) !== JSON.stringify(before)) {
      agrees = false;
      gaps.push(`${who}: frozen profile`);
    }
  }

  gate("D49", agrees && listsRight,
    agrees && listsRight
      ? `major_info_and_scores matches every section it copies  (${PEOPLE.length} participants, `
        + "five lists, twelve fields)"
      : `the gathered copy disagrees with its source: ${gaps.join(" | ")}`);
}

console.log("");
console.log("========================================================================");
if (fails) {
  console.log(`### ${fails} DATABASE GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("========================================================================");
  console.log("");
  process.exit(1);
}
/*
 * `--dump` prints the document these gates were just run over, so anybody can see the real shape
 * of a participant record without a MongoDB to open. It runs after the gates, so a dump is only
 * ever of a document that passed them. `--dump=<path>` writes the JSON to a file instead.
 */
if (process.argv.some((a) => a.startsWith("--dump"))) {
  const [, block5] = PEOPLE[0];
  const doc = {
    headline: db.buildHeadline(block5, ledger),
    timings: timings,
    active_time: active,
    quality: quality,
    sessions: db.SOURCE_MAP.find((s) => s.path === "sessions").transform({
      dropped: 0,
      sessions: [
        { browserId: "aaa", startedAt: 1_000_000, lastSeenAt: 1_600_000,
          stageAtStart: "money", stageAtLastSeen: "trolley", how: "typed_their_email" },
        { browserId: "bbb", startedAt: 200_000_000, lastSeenAt: 200_900_000,
          stageAtStart: "trolley", stageAtLastSeen: "block5", how: "restored_from_another_device" },
      ],
    }),
    analysis: {
      position_effect: db.buildPositionSection(block5),
      alignment_records: db.buildAlignmentRecords(block5),
      mpf_predictions_every_scenario: db.buildMpfPredictions(block5),
      mpf_prediction_percentages: db.buildMpfPercentages(db.buildMpfPredictions(block5)),
    },
    major_info_and_scores: db.buildMajorScores(block5, ledger, {
      totalMs: 2_400_000, byStage: { block5: 1_500_000, money: 400_000 }, sittings: 2,
      longestIdleMs: 45_000, firstSeenAt: 1, lastActiveAt: 2, lastInputAt: 2, stopped: true,
      owner: "x@y.z",
    }, { dropped: 0, sessions: [] }, null),
    _end: {
      scenario6_mpf_test: db.buildScenario6Section(block5),
    },
  };
  const arg = process.argv.find((a) => a.startsWith("--dump="));
  if (arg) {
    fs.writeFileSync(arg.slice("--dump=".length), JSON.stringify(doc, null, 2));
    console.log(`  document written to ${arg.slice("--dump=".length)}`);
  } else {
    console.log(JSON.stringify(doc, null, 2));
  }
  console.log("");
}

console.log("### ALL DATABASE GATES PASSED ###");
console.log("========================================================================");
console.log("");
