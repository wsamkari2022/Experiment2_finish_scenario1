/*
 * validate_journey.cjs — the guard on "A picture of your journey" (28 September 2026).
 *
 * The charts page was refreshed with scenario 6 and a week of new measures (the researcher: "most of
 * the visualization cards are stale"). Its new numbers live in src/experiment/block5Journey.ts; these
 * gates run them over pretend runs built with the study's real functions and check that each card says
 * what the study stores:
 *
 *   J1  consistency: six points; in the four decisions each is the study's own fit; the points are
 *       VCI_all's parts, so their (unrounded) average IS the VCI_all the results page shows
 *   J2  a run without running fits (before 28 September 2026) falls back to the study's fits and draws
 *       no VCI_all
 *   J3  the veil row: the FINAL rule, its distance by the study's own profileDistance from the values
 *       brought into Block 5, the four rules' range, and "changed after the guess" when it did
 *   J4  the guess card: four rules, chances summing to 100, one MPF favourite, the participant's rule
 *       marked, "the MPF named your first rule" exactly when it did
 *   J5  reconsidering: six bars; scenario 6 split before and after the guess
 *   J6  the five positions of the legend are the deck's own, in order, the veil never among them
 *   J7  Block 4: kept / changed / back, in the words the participant saw
 *   J8  the page and the flow, read from the source: the cards read every scenario, no "three colors",
 *       no Finish button, and a finished participant opens on the thank-you screen
 *   J9  the way on to the feedback, from the source: "1 step left", the card, the bar, every button recorded
 *   J10 the MPF in every scenario: the database's own numbers, the gap, a first choice only when it changed,
 *       scenario 6 as shown, the favourite = the best fit; scenario 6 a slate bar apart from the positions
 *
 * Run:  npm run validate:journey
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");
try {
  execFileSync("npx", ["tsc", "-p", "tools/tsconfig.sim.json"], { cwd: ROOT, encoding: "utf8", shell: true });
} catch { /* errors in files this tool does not use are not its business */ }
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const B = (f) => require(path.join(BUILD, f));

const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { labelOptions, labelWeight, isPredictionTest, applyKeepUpdates } = B("block5CVR.js");
const { runningStep, computeVciAll } = B("block5VciAll.js");
const { predictChoice } = B("block5Prediction.js");
const { profileDistance } = B("block5Position.js");
const J = B("block5Journey.js");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
  "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity", "stakeholderPerspectiveShiftSensitivity"];
const profileOf = (scores) => ({
  generatedAt: "", topThreeKeys: [], topSensitivityKey: POLICY[0],
  dimensions: ALL.map((k, i) => ({ key: k, label: k, score: scores[k] ?? 50, rank: i + 1, weight: 0.1, sourceBlocks: [] })),
});

let fails = 0;
const gate = (id, ok, msg) => { console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(3)} ${msg}`); if (!ok) fails += 1; };

/**
 * One pretend run through all six scenarios, built the way the page records one: the fit on the values
 * the scenario opened with, the running fit, the scenario-6 prediction and the guess, switches.
 * `pick(labeled, i)` chooses; `changeAfterGuess` makes scenario 6's final rule differ from its first.
 * The study's values move in the decisions by the keep rule (so a second-best pick moves them, as on the
 * page), and the wish is shown on the values scenario 4 OPENED with - so the running parts of scenarios
 * 5 and 6 can differ from the study's fit, which is what J1 must be able to see.
 */
function makeRun(scores, pick, changeAfterGuess) {
  const frozen = profileOf(scores);
  let live = frozen;
  let s4Open = frozen;
  let running = frozen;
  const results = [];
  BLOCK5_SCENARIOS.forEach((s, i) => {
    const role = s.decisionRole ?? "decider";
    if (i === 3) s4Open = live;
    const shownOn = role === "recipient" ? s4Open : live;
    const labeled = labelOptions(s.options, shownOn);
    const chosen = pick(labeled, i);
    const studyNext = role === "decider" ? applyKeepUpdates(live, chosen, chosen.level, 1, s.options) : live;
    const r = {
      scenarioId: s.id, selectedOptionId: chosen.id, decisionRole: role,
      alignmentLevel: chosen.level, matchScore: chosen.matchScore,
      vciScore: labelWeight(chosen.level, s.options.length),
      policySnapshotAfter: Object.fromEntries(POLICY.map((k) => [k, studyNext.dimensions.find((d) => d.key === k).score])),
      telemetry: { numberOfSwitches: i % 3 },
    };
    if (role === "predicted") {
      const p = predictChoice(s.options, live, { vci: 70, stability: 80 });
      const first = changeAfterGuess ? labeled[labeled.length - 1].id : chosen.id;
      r.predictionTest = {
        shownProbabilities: p.options.map((o) => ({ optionId: o.optionId, probability: o.probability, rank: o.rank, alignmentScore: o.alignmentScore })),
        predictedTopOptionId: p.options.find((o) => o.rank === 1).optionId,
        firstChoiceOptionId: first, finalChoiceOptionId: chosen.id,
        switchesBeforeGuess: 2, switchesAfterGuess: changeAfterGuess ? 1 : 0,
        soundsLikeMe: 5, surprised: false, changedAfterSeeing: changeAfterGuess,
      };
    }
    const step = runningStep(s, chosen.id, running, studyNext);
    r.running = step.record;
    running = step.next;
    live = studyNext;
    results.push(r);
  });
  return { frozen, results, vciAll: computeVciAll(results) };
}

const RUNS = [
  ["best fit everywhere", makeRun({ vulnerabilityProtectionSensitivity: 90, groupSizeSensitivity: 40, gainResponsivenessSensitivity: 30, outcomeAggregationSensitivity: 60 }, (l) => l[0], false)],
  ["second-best, changed after the guess", makeRun({ vulnerabilityProtectionSensitivity: 20, groupSizeSensitivity: 85, gainResponsivenessSensitivity: 55, outcomeAggregationSensitivity: 40 }, (l) => l[1], true)],
  ["worst fit everywhere", makeRun({ vulnerabilityProtectionSensitivity: 60, groupSizeSensitivity: 60, gainResponsivenessSensitivity: 95, outcomeAggregationSensitivity: 10 }, (l) => l[l.length - 1], false)],
];

console.log("");
console.log("==============================================================================");
console.log("  A PICTURE OF YOUR JOURNEY — the charts page's numbers");
console.log("==============================================================================");

/* J1, J2 */
{
  let j1 = true, j2 = true, differs = 0;
  for (const [, run] of RUNS) {
    const c = J.consistencyReading(run.results, 80, run.vciAll.value);
    if (c.points.length !== 6 || !c.pointsAreVciAllParts || c.vciAll !== run.vciAll.value) j1 = false;
    const exactMean = run.results.reduce((a, r) => a + 100 * r.running.vciScore, 0) / run.results.length;
    if (Math.round(exactMean) !== c.vciAll) j1 = false;
    c.points.forEach((pt, i) => {
      if (Math.abs(pt.value - 100 * run.results[i].running.vciScore) > 0.5) j1 = false;
      if (run.results[i].decisionRole === "decider" && pt.value !== pt.studyValue) j1 = false;
      if (pt.value !== pt.studyValue) differs += 1;
    });
    if (c.points.map((pt) => pt.kind).join() !== "decision,decision,decision,decision,wish,veil") j1 = false;
    const old = run.results.map(({ running: _r, ...rest }) => rest);
    const o = J.consistencyReading(old, 80, undefined);
    if (o.pointsAreVciAllParts || o.vciAll !== null || o.points.some((pt, i) => pt.value !== Math.round(100 * old[i].vciScore))) j2 = false;
  }
  /* Not vacuous: at least one pretend point must differ from the study's fit, or showing the study's fit
     by mistake would pass unseen. */
  if (differs === 0) j1 = false;
  gate("J1", j1, `consistency: six points, the decisions are the study's fit, and the points average exactly to VCI_all  (${differs} wish/veil points differ from the study's fit)`);
  gate("J2", j2, "a run from before the running fits falls back to the study's fits and draws no VCI_all");
}

/* J3, J4, J5 */
{
  let j3 = true, j4 = true, j5 = true;
  for (const [who, run] of RUNS) {
    const s6 = BLOCK5_SCENARIOS.find((s) => s.decisionRole === "predicted");
    const r6 = run.results.find((r) => isPredictionTest(r));
    const v = J.veilRow(run.results, run.frozen);
    const final = s6.options.find((o) => o.id === r6.selectedOptionId);
    const all = s6.options.map((o) => profileDistance(run.frozen, o));
    if (!v || v.ruleTitle !== final.title || v.distance !== Math.round(profileDistance(run.frozen, final) * 10) / 10
      || v.nearest !== Math.round(Math.min(...all) * 10) / 10 || v.farthest !== Math.round(Math.max(...all) * 10) / 10
      || v.changedAfterTheGuess !== (r6.predictionTest.firstChoiceOptionId !== r6.selectedOptionId)) {
      j3 = false; console.log(`      J3 ${who}: ${JSON.stringify(v)}`);
    }
    if (J.veilRow(run.results, undefined) !== null) j3 = false;

    const g = J.guessReading(run.results);
    const sum = g.rules.reduce((a, x) => a + x.chancePercent, 0);
    if (g.rules.length !== 4 || Math.abs(sum - 100) > 0.5 || g.rules.filter((x) => x.isMpfFirst).length !== 1
      || g.rules.filter((x) => x.isYourFinal).length !== 1 || !g.rules.find((x) => x.isYourFinal && x.optionId === r6.selectedOptionId)
      || g.mpfNamedYourFirstRule !== (r6.predictionTest.predictedTopOptionId === r6.predictionTest.firstChoiceOptionId)
      || g.changedAfterTheGuess !== (r6.predictionTest.firstChoiceOptionId !== r6.selectedOptionId)
      || g.rules.some((x, i) => i > 0 && x.chancePercent > g.rules[i - 1].chancePercent)) {
      j4 = false; console.log(`      J4 ${who}: ${JSON.stringify(g)}`);
    }

    const bars = J.reconsiderBars(run.results);
    const vb = bars.find((b) => b.kind === "veil");
    if (bars.length !== 6 || vb.before !== r6.predictionTest.switchesBeforeGuess || vb.afterGuess !== r6.predictionTest.switchesAfterGuess
      || bars.some((b, i) => b.kind !== "veil" && (b.before !== run.results[i].telemetry.numberOfSwitches || b.afterGuess !== 0))) j5 = false;
  }
  gate("J3", j3, "the veil row: the final rule, the study's distance from the values brought into Block 5, the four rules' range, the change after the guess");
  gate("J4", j4, "the guess card: four rules, chances summing to 100 in MPF order, one favourite, the participant's rule and the MPF's hit marked right");
  gate("J5", j5, "reconsidering: six bars, scenario 6 split before and after the guess");
}

/* J6 */
{
  const deck = BLOCK5_SCENARIOS.map((s) => s.stakePosition).filter((p) => p && p !== "behind_the_veil");
  const unique = deck.filter((p, i) => deck.indexOf(p) === i);
  gate("J6", JSON.stringify(J.DECK_POSITIONS) === JSON.stringify(unique) && unique.length === 5 && !J.DECK_POSITIONS.includes("behind_the_veil"),
    `the legend's positions are the deck's own five, in order: ${J.DECK_POSITIONS.join(", ")}`);
}

/* J7 */
{
  const make = (a, b, c) => ({ decisions: { initialDecision: a, midDecision: b, finalDecision: c, confidence: 4, initialConfidence: 3 },
    vignettesShown: [{ title: "The workers" }, { title: "The company" }], mostInfluentialPerspective: "The workers" });
  const kept = J.block4Reading(make("proceed", "proceed", "proceed"));
  const changed = J.block4Reading(make("proceed", "do_not_proceed", "do_not_proceed"));
  const back = J.block4Reading(make("proceed", "do_not_proceed", "proceed"));
  const ok = kept.pattern === "kept" && changed.pattern === "changed" && back.pattern === "back"
    && kept.steps[0].decision === "Approve the policy" && changed.steps[2].decision === "Do not approve the policy"
    && kept.steps[0].confidence === 3 && kept.steps[2].confidence === 4 && kept.steps[1].confidence === null
    && kept.steps[1].moment.includes("The workers") && kept.voiceThatMattered === "The workers"
    && J.block4Reading(null) === null && J.block4Reading({ decisions: {} }) === null;
  gate("J7", ok, "Block 4: kept / changed / back, in the words on the screen, confidence first and last, the voice that mattered");
}

/* J8 — read from the source */
{
  const src = (f) => fs.readFileSync(path.join(ROOT, "src", "experiment", f), "utf8");
  const view = src("Block5VisualizationsView.tsx");
  const feedback = src("UserFeedbackPage.tsx");
  const flow = src("ExperimentFlow.tsx");
  const why = [];
  if (!view.includes("consistencyReading(allScenarios")) why.push("consistency does not read every scenario");
  if (!view.includes("reconsiderBars(allScenarios")) why.push("reconsidering does not read every scenario");
  if (!view.includes("const choiceBars: HBar[] = allScenarios.map")) why.push("the choice card does not read every scenario");
  if (!view.includes("veilRow(allScenarios, before)") || !view.includes("guessReading(allScenarios)")) why.push("the veil is not read");
  if (/three colou?rs/i.test(view)) why.push('"three colors" is back');
  if (!view.includes("DECK_POSITIONS.map")) why.push("the legend is written out");
  if (/>\s*Finish\s*</.test(feedback) || feedback.includes("handleFinish = ")) why.push("the Finish button is back");
  if (!feedback.includes("useState(alreadyCompleted)")) why.push("the feedback page ignores a finished study");
  if (!/alreadyCompleted=\{\(\(\) => \{\s*try \{ return localStorage\.getItem\(STORAGE_KEY_STATUS\) === STATUS_COMPLETED;/.test(flow)) why.push("the flow does not pass the finished status");
  gate("J8", why.length === 0, why.length ? why.join(" | ")
    : "the cards read every scenario, five colors from the deck, no Finish button, a finished participant opens on the thank-you screen");
}

/* J9 — the way on to the feedback, read from the source (28 September 2026, the researcher's plan "Q1-A, Q2-yes,
   Q3-yes, Q4-yes, Q5-yes"). In the previous experiment people took the results page for the end. */
{
  /* Comments are dropped first: they quote the old words on purpose ("Complete", "Don't leave"). */
  const src = (f) => fs.readFileSync(path.join(ROOT, "src", "experiment", f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const results = src("Block5SimulationSummaryPage.tsx");
  const view = src("Block5VisualizationsView.tsx");
  const nudge = src("Block5FeedbackNudge.tsx");
  const stepper = src("GlobalStepper.tsx");
  const why = [];
  /* The header no longer says the study is complete. */
  if (/Main Simulation Complete/.test(results) || />\s*Complete\s*</.test(results)) why.push('the results page says "Complete" again');
  if (!results.includes("Scenarios done · 1 step left")) why.push('the "1 step left" badge is gone');
  /* Q1-A: the card sits after the four score cards and before the charts button. */
  const grid = results.indexOf("</Grid>"), card = results.indexOf("<LastStepCard"), charts = results.indexOf("View your results as charts");
  if (!(grid > 0 && card > grid && card < charts)) why.push("the last-step card is not right under the score cards");
  /* Q2: the bar on both pages. */
  if (!results.includes("<FeedbackBar") || !view.includes("<FeedbackBar")) why.push("the bottom bar is missing from a page");
  /* Q5: every way to the feedback names its button. */
  for (const b of ["card_under_scores", "bar_on_results", "bottom_of_results"]) {
    if (!results.includes(`toFeedback("${b}")`)) why.push(`the results page does not record ${b}`);
  }
  for (const b of ["bar_on_charts", "bottom_of_charts"]) {
    if (!view.includes(`onContinueToFeedback("${b}")`)) why.push(`the charts page does not record ${b}`);
  }
  if (/onClick=\{onContinueToFeedback\}/.test(results + view)) why.push("a feedback button skips the record");
  if (!results.includes("noteChartsOpened()")) why.push("opening the charts is not recorded");
  /* Q4, and the consent page: the gift card NEEDS a completed study; the feedback alone does not earn it. */
  if (!nudge.includes("which you need for") || /earns your \$5/.test(nudge)) why.push("the gift-card sentence promises more than the consent page");
  /* It invites and never warns, and nothing new loops. */
  if (/beforeunload|Don't leave|Do not leave/i.test(nudge + results + view)) why.push("a leave warning is back");
  if (/infinite|animationIterationCount/.test(nudge)) why.push("a second looping animation");
  /* Q3: Feedback is "next" on the results page, and the flag says what still comes first. */
  if (!stepper.includes("next={nextIsLast && i === current + 1}") || !/>\s*next\s*</.test(stepper)) why.push('the progress bar does not mark Feedback "next"');
  if (!stepper.includes("`After the ${afterNext.toLowerCase()}`")) why.push('the flag does not say "After the feedback"');
  /* On a phone the rail is wider than the screen: it must slide to the current stop (and the "next" one). */
  if (!stepper.includes("data-stop={i}") || !stepper.includes("rail.scrollLeft += over")) why.push("the rail does not slide to where you are on a phone");
  gate("J9", why.length === 0, why.length ? why.join(" | ")
    : '"1 step left" instead of "Complete", the card under the score cards, the bar on both pages, every button recorded, an honest gift-card line, no warning, Feedback "next" in the progress bar, the rail slides to it on a phone');
}

/* J10 — the MPF in every scenario, and scenario 6 as a bar of its own (28 September 2026, the researcher's
   "Q2-yes, Q3-yes, Q4-yes"). The card reads the database's own section, so it is checked against that section,
   against the scenario-6 numbers that were shown, and against the rule that the favourite is the best fit. */
{
  try {
    execFileSync("npx", ["tsc", "-p", "tools/tsconfig.dbshape.json"], { cwd: ROOT, encoding: "utf8", shell: true });
  } catch { /* as above */ }
  const db = B("dbShape.js");
  const why = [];
  let changedSeen = 0, missSeen = 0, hitSeen = 0;
  for (const [name, run] of RUNS) {
    const b5 = { originalProfile: run.frozen, vci: 70, stability: 80, scenarioResults: run.results };
    const section = db.buildMpfPercentages(db.buildMpfPredictions(b5));
    const pr = J.predictionReading(section);
    if (!pr || pr.rows.length !== 6) { why.push(`${name}: not six rows`); continue; }
    if (pr.rows.map((r) => r.kind).join() !== "decision,decision,decision,decision,wish,veil") why.push(`${name}: the rows are not the four decisions, the wish and the veil`);
    pr.rows.forEach((row, i) => {
      const src = section.by_scenario[i];
      if (row.favouritePercent !== src.most_expected_option_chance_percent
          || row.finalPercent !== src.their_final_choice_chance_percent
          || row.pointsBehind !== src.points_behind_the_most_expected_option_at_final_choice) {
        why.push(`${name} S${i + 1}: not the database's numbers`);
      }
      const expected = Math.max(0, Math.round((row.favouritePercent - row.finalPercent) * 10) / 10);
      if (Math.abs(expected - row.pointsBehind) > 0.11) why.push(`${name} S${i + 1}: the gap is not the favourite minus the choice`);
      if (row.namedFinal !== (row.favouriteTitle === row.finalTitle)) why.push(`${name} S${i + 1}: "same option" is wrong`);
      if (row.namedFinal) hitSeen += 1; else missSeen += 1;
      const r = run.results[i];
      const first = r.predictionTest?.firstChoiceOptionId ?? r.firstChoiceOptionId ?? r.selectedOptionId;
      const changed = first !== r.selectedOptionId;
      if (changed !== (row.firstPercent !== null)) why.push(`${name} S${i + 1}: the first choice is drawn when it did not change, or missing when it did`);
      if (changed) changedSeen += 1;
      if (row.guessPercent !== Math.round(1000 / BLOCK5_SCENARIOS[i].options.length) / 10) why.push(`${name} S${i + 1}: the blind guess is not 1 in ${BLOCK5_SCENARIOS[i].options.length}`);
      if (row.shownWhileChoosing !== (r.decisionRole === "predicted")) why.push(`${name} S${i + 1}: says it was shown when it was not, or the other way round`);
    });
    /* Scenario 6: the favourite at the chance that was on screen. */
    const top = run.results[5].predictionTest.shownProbabilities.find((o) => o.rank === 1);
    if (Math.abs(pr.rows[5].favouritePercent - Math.round(top.probability * 1000) / 10) > 0.05) why.push(`${name}: scenario 6's favourite is not the chance that was shown`);
    /* The favourite is the best fit on the values the scenario opened with: a best-fit picker is always
       "expected" in scenarios 1-5, a worst-fit picker never. */
    if (name === "best fit everywhere" && pr.rows.slice(0, 5).some((r) => !r.namedFinal)) why.push("the favourite is not the best fit");
    if (name === "worst fit everywhere" && pr.rows.slice(0, 5).some((r) => r.namedFinal)) why.push("a worst-fit choice is called the favourite");
    if (pr.namedFinal !== pr.rows.filter((r) => r.namedFinal).length) why.push(`${name}: the count in the caption is wrong`);
  }
  if (changedSeen === 0 || missSeen === 0 || hitSeen === 0) why.push("the pretend runs do not reach every case (a hit, a miss, a changed first choice)");
  if (J.predictionReading(null) !== null || J.predictionReading({ by_scenario: [] }) !== null) why.push("an empty section should draw no card");

  const view = fs.readFileSync(path.join(ROOT, "src", "experiment", "Block5VisualizationsView.tsx"), "utf8");
  if (!view.includes("predictionReading(buildMpfPercentages(buildMpfPredictions(results)))")) why.push("the card does not read the database's own section");
  if (!view.includes('guess ? "guess" : "", preds ? "predictions" : ""')) why.push("the predictions card is not right after the guess card");
  /* Scenario 6 drawn apart, in slate, with a label short enough for one line of the 480-wide chart (the first
     one, 63 characters in capitals, ran off the edge). */
  const apart = view.match(/apartLabel: "([^"]+)"/);
  if (!apart || !apart[1].startsWith("Behind the veil") || !view.includes("color: VEIL_COLOR,")) why.push("scenario 6 is not a slate bar drawn apart");
  if (apart && apart[1].length > 36) why.push(`the label over scenario 6's bar is too long for the chart (${apart[1].length} characters)`);
  const charts = fs.readFileSync(path.join(ROOT, "src", "experiment", "block5Charts.tsx"), "utf8");
  if (/toUpperCase\(\)/.test(charts)) why.push("the label is drawn in capitals again");
  if (!view.includes("const position = analysePosition(scenarios, before)")) why.push("the Position Effect no longer leaves scenario 6 out");
  gate("J10", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
    : `the MPF card: the database's numbers, the gap = favourite - choice, a first choice only when it changed, scenario 6 as shown, the favourite = the best fit (${hitSeen} hits, ${missSeen} misses, ${changedSeen} changed); scenario 6 a slate bar apart with a label that fits, outside the Position Effect`);
}

console.log("");
console.log("==============================================================================");
if (fails) {
  console.log(`### ${fails} JOURNEY GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("==============================================================================");
  process.exit(1);
}
console.log("### ALL JOURNEY GATES PASSED ###");
console.log("==============================================================================");
console.log("");
