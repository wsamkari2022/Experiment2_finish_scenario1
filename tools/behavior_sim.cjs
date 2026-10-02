/**
 * behavior_sim.cjs — one pretend participant through Block 5, with every major score (26 September 2026).
 *
 * Shared by tools/report_major_scores.cjs (the table in docs/MAJOR_SCORES_DISTRIBUTION.md) and
 * tools/report_step_sensitivity.cjs (audit B3), so the two can never describe two different simulations.
 *
 * The pretend people are those of `npm run report:vci` (tools/vci_distribution.cjs): the same 2,000
 * starting profiles, the same twelve kinds of chooser, the same seed. The path through the scenarios is
 * vci_distribution.run step for step - labels from the profile brought into each scenario, the final
 * choice on the keep path or through APA, the profile moved by the real applyKeepUpdates /
 * applyEndorsementUpdates / applyApaUpdates in the decider scenarios only - and it ALSO keeps what the
 * other scores need, the way the app stores a run: `cvrFired` (a decider scenario whose choice was not
 * one of the two best fits) and the four values after every scenario. From one path it returns:
 *
 *   vci, vciLevel                 computeVCI, as report:vci (identical for every person; the report checks it)
 *   stability, stabilityLevel     computeStability over the snapshots
 *   measured                      Stability counted at least one conflict step (headline.stability_was_measured)
 *   performance                   end-of-study performance: the mean captured score of the four decisions,
 *                                 0 = the scenario's weakest option every time, 100 = its strongest
 *   stakeholder                   the stakeholder sensitivity's stability
 *   stabilityAll, stabilityAllLevel, stabilityAllMeasured   Stability_all (since 29 September 2026, block5StabilityAll.ts):
 *                                 Stability's rule over all six on the running values; topValue / topOrSecond: the
 *                                 top-value choices (of six)
 *   vciAll, vciAllLevel           VCI_all (since 28 September 2026): the six hidden running fits, scenarios 5 and 6
 *                                 included, by the real runningStep / computeVciAll (block5VciAll.ts). The wish is
 *                                 shown on scenario 4's OPENING values, as the page shows it (profileShownIn); that
 *                                 changes only which wish a kind picks, so no other score here can move.
 *
 * Load order: a caller that wants to change the step sizes must require step_scale_hook.cjs BEFORE this
 * file, because this file loads block5CVR.js.
 */
const path = require("node:path");
const fs = require("node:fs");

const BUILD = path.join(__dirname, "..", ".sim-build");
if (!fs.existsSync(BUILD)) {
  console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
const B = (f) => require(path.join(BUILD, f));
const { labelOptions, applyKeepUpdates, applyEndorsementUpdates, applyApaUpdates, optionMainValue,
        scenarioIsScored, scenarioVciScore, computeVCI, computeStability, computeSensitivityStability } = B("block5CVR.js");
const { capturedOf } = B("block5Performance.js");
const { runningStep, computeVciAll } = B("block5VciAll.js");
const { computeStabilityAll, computeTopValueChoices } = B("block5StabilityAll.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const POP = require("./vci_distribution.cjs");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const STAKE = "stakeholderPerspectiveShiftSensitivity";
const sc = (p, k) => p.dimensions.find((d) => d.key === k).score;
const clone = (p) => JSON.parse(JSON.stringify(p));
const isFit = (l) => l === "aligned" || l === "weakly_aligned";

function runPerson(start, beh) {
  const frozen = clone(start);
  let p = clone(start);
  let running = clone(start);   // the hidden running values behind VCI_all
  let s4Open = null;
  const st = {};
  const vciRows = [], results = [], captured = [], runningRows = [];
  BLOCK5_SCENARIOS.forEach((s, i) => {
    if ((s.decisionRole ?? "decider") === "decider" && BLOCK5_SCENARIOS[i + 1]?.decisionRole === "recipient") s4Open = clone(p);
    const shownOn = s.decisionRole === "recipient" && s4Open ? s4Open : p;   // the wish: scenario 4's opening values
    const ranked = labelOptions(s.options, shownOn);
    const { opt, cvr } = POP.BEHAVIORS[beh](ranked, shownOn, frozen, i, st);
    const w = s.stakesWeight ?? 1;
    const scored = scenarioIsScored(s);
    let finalId = opt.id;
    if (scored) {
      if (isFit(opt.level)) p = applyKeepUpdates(p, opt, opt.level, w, s.options);
      else if (cvr.path === "keep") p = applyEndorsementUpdates(p, opt, cvr.strong, cvr.moved, null, w);
      else {
        const pending = applyApaUpdates(p, cvr.moved, cvr.value, null, w, cvr.confidence);
        const lab = labelOptions(s.options, pending);
        let matching = lab.filter((o) => optionMainValue(o) === cvr.value);
        if (!matching.length) matching = [...lab].sort((a, b) => b.fingerprint[cvr.value] - a.fingerprint[cvr.value]).slice(0, 1);
        finalId = cvr.choose(matching).id;
        p = pending;
      }
      captured.push(capturedOf(s, s.options.find((o) => o.id === finalId)));
    }
    const level = ranked.find((o) => o.id === finalId).level; // judged on the profile the scenario opened with
    vciRows.push({ vciScore: scenarioVciScore(level, s.options.length), decisionRole: s.decisionRole ?? "decider" });
    const step = runningStep(s, finalId, running, p);
    running = step.next;
    runningRows.push({ running: step.record });
    results.push({
      scenarioId: s.id, decisionRole: s.decisionRole ?? "decider", cvrFired: scored && !isFit(opt.level),
      selectedOptionId: finalId, running: step.record,
      policySnapshotAfter: Object.fromEntries(POLICY.map((k) => [k, sc(p, k)])),
      framingSnapshotAfter: { directnessSensitivity: sc(p, "directnessSensitivity"), contextSensitivity: sc(p, "contextSensitivity") },
      stakeholderSnapshotAfter: sc(p, STAKE),
    });
  });
  const vci = computeVCI(vciRows);
  const vciAll = computeVciAll(runningRows);
  const stab = computeStability(results, frozen);
  const stabAll = computeStabilityAll(results);
  const top = computeTopValueChoices(results, frozen);
  return {
    vci: vci.value, vciLevel: vci.level,
    vciAll: vciAll.value, vciAllLevel: vciAll.level,
    stability: stab.value, stabilityLevel: stab.level, measured: stab.conflictSteps > 0,
    stabilityAll: stabAll.value, stabilityAllLevel: stabAll.level, stabilityAllMeasured: stabAll.measured,
    /* Since 2 October 2026 Stability and Stability_all are the average of these two parts each (block5CVR.ts). */
    stabilityOrder: stab.orderValue, stabilityDifference: stab.differenceValue,
    stabilityAllOrder: stabAll.orderValue, stabilityAllDifference: stabAll.differenceValue,
    topValue: top.countTopValue, topOrSecond: top.countTopOrSecond,
    blindTopValue: top.blindTopValue, blindTopOrSecond: top.blindTopOrSecond,
    performance: Math.round(captured.reduce((a, b) => a + b, 0) / captured.length),
    stakeholder: computeSensitivityStability(results, frozen).stakeholder?.value ?? null,
  };
}

const KINDS = Object.keys(POP.BEHAVIORS);
/** Every kind over the 2,000 starting profiles, each kind meeting the same random draws (seed 777, as report:vci). */
function measureAll() {
  const out = {};
  for (const beh of KINDS) { POP.reseed(777); out[beh] = POP.starts.map((s) => runPerson(s, beh)); }
  return out;
}

module.exports = { KINDS, POP, runPerson, measureAll };
