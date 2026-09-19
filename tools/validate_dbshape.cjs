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

console.log("");
console.log("========================================================================");
if (fails) {
  console.log(`### ${fails} DATABASE GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("========================================================================");
  console.log("");
  process.exit(1);
}
console.log("### ALL DATABASE GATES PASSED ###");
console.log("========================================================================");
console.log("");
