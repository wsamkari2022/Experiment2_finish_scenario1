/**
 * condition_sim.cjs — the pretend participants of behavior_sim.cjs in each of the four conditions (since 1 October 2026).
 *
 * The researcher's design: four conditions that share Blocks 1-4 and differ from Block 5 on (CLAUDE.md, "The four
 * conditions"). His answers for this simulation (1 October 2026): Q1 "A and B (Do the two of them, so I can see the
 * differences)", Q2 yes (the "How sure" answers below), Q3 "A and B". Each RUN lets the same pretend people through
 * Block 5 one way:
 *
 *   CVR_APA       condition 1, the full version: behavior_sim.runPerson exactly (the report checks it person by person)
 *   CVR_Only      condition 2: a refusal opens the CVR Rejection page (the person-speaking score +25 / -25 on the first
 *                 visit; no view moves, because these kinds never open the second view), then the person CHOOSES AGAIN
 *   APA_Only      condition 3: a misfit opens the APA page at once (no reflection, the stakeholder score never moves);
 *                 every visit is a Stability step
 *   APA_Only_RB   the same, with the random responder's "B" rule (Q3-B)
 *   Baseline      condition 4: a misfit opens the confirmation page with "How sure"; Keep moves +30 / -10 or -15, x the
 *                 sureness weight; a kept misfit is a Stability step
 *   Baseline_B    the same, under principle B (Q1-B)
 *
 * PRINCIPLE A ("the same person, a different page"): each kind makes the choices it makes in condition 1; only the page
 * it meets and that page's moves change.
 *   kinds that KEEP a misfit after the reflection   APA_Only: name the value the box says the option serves most and pick
 *                                                   their own option from the list. Baseline: Keep. How sure: 5 (the
 *                                                   performance chaser, who keeps "with some doubt": 3)
 *   kinds that REFUSE it (Corrected by APA, Convert (via APA), Flip-flopper (via APA))
 *                                                   APA_Only: as in condition 1. CVR_Only and Baseline: go back and choose
 *                                                   the option they end on in condition 1, by the same rule, on the values
 *                                                   they have; a misfit is then kept (CVR_Only "strongly"; Baseline with
 *                                                   How sure = their APA answer: 4 / 5 / 5)
 *   the random responder                            CVR_Only and Baseline: keep or go back at random, a new random pick
 *                                                   after going back (at most 20 times). APA_Only: every answer random
 * PRINCIPLE B ("the pages change behaviour"): a refusal needs a page that asks the person to think again. CVR_Only (the
 *   reflection) and APA_Only (the APA page) have one, so B is A there. Baseline has none, so the three refusing kinds KEEP
 *   their first pick there, with How sure = their APA answer.
 * RANDOM B in APA_Only: when condition 1's random responder would stand by its pick (half the time), it names the box's
 *   value and keeps its own option (random How sure); otherwise every answer is random, as in A.
 *
 * DRAWS. Every kind meets POP's own draws (seed 777), and a second seeded generator (4242, restarted for every kind and
 * run) makes the random responder's later answers. Every kind except the random responder therefore makes the same
 * first pick in every run; the random responder's later picks can differ between runs (condition 1 spends one of POP's
 * draws on its APA list pick), so it is compared as a group. CVR_Only reproduces, person by person, the figures sent to
 * the researcher on 1 October 2026 (the scratch script they came from used exactly these rules and draws).
 */
const path = require("node:path");
const SIM = require("./behavior_sim.cjs");

const B = (f) => require(path.join(__dirname, "..", ".sim-build", f));
const { labelOptions, applyKeepUpdates, applyEndorsementUpdates, applyApaUpdates, applyApaUpdatesWithMoves,
        applyCvrRejectionUpdatesWithMoves, applyBaselineConfirmUpdatesWithMoves, optionMainValue, scenarioIsScored,
        scenarioVciScore, computeVCI, computeStability, computeSensitivityStability, ALIGNMENT_LABEL } = B("block5CVR.js");
const { capturedOf } = B("block5Performance.js");
const { runningStep, computeVciAll } = B("block5VciAll.js");
const { computeStabilityAll, computeTopValueChoices } = B("block5StabilityAll.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { POLICY_DIM_SHORT } = B("block5Types.js");
const { KINDS, POP } = SIM;
const NAME = (k) => POLICY_DIM_SHORT[k] ?? k;

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const STAKE = "stakeholderPerspectiveShiftSensitivity";
const sc = (p, k) => p.dimensions.find((d) => d.key === k).score;
const clone = (p) => JSON.parse(JSON.stringify(p));
const isFit = (l) => l === "aligned" || l === "weakly_aligned";
const topOf = (p) => [...POLICY].sort((a, b) => sc(p, b) - sc(p, a))[0];
const champion = (ranked, k) => [...ranked].sort((a, b) => b.fingerprint[k] - a.fingerprint[k])[0];

/** The runs, in the order the page shows them. */
const RUNS = [
  { id: "CVR_APA", condition: "CVR+APA", label: "CVR+APA" },
  { id: "CVR_Only", condition: "CVR_Only", label: "CVR_Only" },
  { id: "APA_Only", condition: "APA_Only", label: "APA_Only" },
  { id: "APA_Only_RB", condition: "APA_Only", label: "APA_Only, random B", randomB: true },
  { id: "Baseline", condition: "Baseline", label: "Baseline (A)" },
  { id: "Baseline_B", condition: "Baseline", label: "Baseline (B)", principleB: true },
];
const REFUSERS = ["Corrected by APA", "Convert (via APA)", "Flip-flopper (via APA)"];

/* The second generator: the random responder's answers after going back (and its APA_Only answers when condition 1's
   draws hold none). Restarted for every kind and run. */
let seed2 = 4242;
const rnd2 = () => { seed2 = (seed2 * 1103515245 + 12345) & 0x7fffffff; return seed2 / 0x7fffffff; };
const pick2 = (a) => a[Math.floor(rnd2() * a.length)];
const sure2 = () => 1 + Math.floor(rnd2() * 5);

/** After going back (CVR_Only, Baseline): what this kind chooses, and what it does if that choice is a misfit again. */
function chooseAgain(beh, ranked, p, cvr) {
  if (beh === "Corrected by APA") {
    const v = topOf(p);
    return { opt: ranked.find((o) => optionMainValue(o) === v) ?? champion(ranked, v), onMisfit: () => ({ keep: true, strong: true, moved: false }) };
  }
  if (beh === "Convert (via APA)" || beh === "Flip-flopper (via APA)") {
    return { opt: champion(ranked, cvr.value), onMisfit: () => ({ keep: true, strong: true, moved: false }) };
  }
  if (beh === "Random responder") {
    return { opt: pick2(ranked), onMisfit: () => (rnd2() < 0.5 ? { keep: true, strong: rnd2() < 0.5, moved: rnd2() < 0.5 } : { keep: false, moved: rnd2() < 0.5 }) };
  }
  throw new Error(`${beh} never refuses, so it never goes back`);
}

/** The APA list after naming `value` on the moved values (as the page builds it, and as condition 1 does). */
function apaList(s, pending, value) {
  const lab = labelOptions(s.options, pending);
  const m = lab.filter((o) => optionMainValue(o) === value);
  return m.length ? m : [...lab].sort((a, b) => b.fingerprint[value] - a.fingerprint[value]).slice(0, 1);
}

const title = (s, id) => s.options.find((o) => o.id === id)?.title ?? id;
const levelWord = (l) => ALIGNMENT_LABEL[l] ?? l;

/**
 * One pretend person through Block 5 in one run. `trace`, when given, receives one line per scenario: the first pick,
 * the page it met, the final choice and what moved.
 */
function runPersonIn(start, beh, run, trace = null) {
  const frozen = clone(start);
  let p = clone(start);
  let running = clone(start);
  let s4Open = null;
  const st = {};
  const vciRows = [], results = [], captured = [], runningRows = [];
  const ev = { misfitPicks: 0, wentBack: 0, keptMisfit: 0, apaVisits: 0, rejectionVisits: 0 };
  BLOCK5_SCENARIOS.forEach((s, i) => {
    if ((s.decisionRole ?? "decider") === "decider" && BLOCK5_SCENARIOS[i + 1]?.decisionRole === "recipient") s4Open = clone(p);
    const shownOn = s.decisionRole === "recipient" && s4Open ? s4Open : p;
    const ranked = labelOptions(s.options, shownOn);
    const { opt, cvr } = POP.BEHAVIORS[beh](ranked, shownOn, frozen, i, st);
    const w = s.stakesWeight ?? 1;
    const scored = scenarioIsScored(s);
    const before = clone(p);
    let finalId = opt.id;
    let cvrFired = scored && !isFit(opt.level);
    let page = scored ? (isFit(opt.level) ? "confirmation page, a good fit" : "") : "no page moves anything (not a decision)";
    if (scored && !isFit(opt.level)) ev.misfitPicks += 1;
    if (scored) {
      if (isFit(opt.level)) {
        p = applyKeepUpdates(p, opt, opt.level, w, s.options);
      } else if (run.condition === "CVR+APA") {
        /* behavior_sim.runPerson, line for line. */
        if (cvr.path === "keep") {
          p = applyEndorsementUpdates(p, opt, cvr.strong, cvr.moved, null, w);
          page = `reflection; stood by it (${cvr.strong ? "strongly" : "with some doubt"})`;
        } else {
          const pending = applyApaUpdates(p, cvr.moved, cvr.value, null, w, cvr.confidence);
          finalId = cvr.choose(apaList(s, pending, cvr.value)).id;
          p = pending;
          ev.apaVisits += 1;
          page = `reflection, refused; APA page: named ${NAME(cvr.value)}, sure ${cvr.confidence}`;
        }
      } else if (run.condition === "CVR_Only") {
        if (cvr.path === "keep") {
          p = applyEndorsementUpdates(p, opt, cvr.strong, cvr.moved, null, w);
          page = `reflection; stood by it (${cvr.strong ? "strongly" : "with some doubt"})`;
        } else {
          /* The CVR Rejection page (moves once), back to the options, choose again through the normal flow. */
          ev.wentBack += 1;
          ev.rejectionVisits += 1;
          let moved = cvr.moved, movedHere = false, guard = 0;
          page = "reflection, refused; CVR Rejection page; chose again";
          for (;;) {
            if (!movedHere) {
              p = applyCvrRejectionUpdatesWithMoves(p, { stakeholderMoved: moved, bothViewsSeen: false, lastViewSeen: null, stakesWeight: w }).profile;
              movedHere = true;
            }
            const again = chooseAgain(beh, ranked, p, cvr);
            finalId = again.opt.id;
            if (isFit(again.opt.level)) { p = applyKeepUpdates(p, again.opt, again.opt.level, w, s.options); cvrFired = false; break; }
            const answer = again.onMisfit();
            if (answer.keep || ++guard >= 20) {
              p = applyEndorsementUpdates(p, again.opt, answer.strong ?? true, answer.moved ?? false, null, w);
              cvrFired = true;
              page += "; reflection again, stood by it";
              break;
            }
            ev.rejectionVisits += 1;
            moved = answer.moved;
          }
        }
      } else if (run.condition === "APA_Only") {
        /* Straight to the APA page; the stakeholder score never moves (moveStakeholder false); always a Stability step. */
        ev.apaVisits += 1;
        let value, sure, choose;
        if (cvr.path === "apa") {
          ({ value } = cvr); sure = cvr.confidence; choose = cvr.choose;
        } else if (beh === "Random responder" && !run.randomB) {
          value = pick2(POLICY); sure = sure2(); choose = (m) => pick2(m);
        } else {
          /* Keeps it: names the value the box says the option serves most, and picks its own option from the list. */
          value = optionMainValue(opt);
          sure = beh === "Random responder" ? sure2() : (cvr.strong ? 5 : 3);
          choose = (m) => m.find((o) => o.id === opt.id) ?? m[0];
        }
        const pending = applyApaUpdatesWithMoves(p, false, value, null, w, sure, false).profile;
        finalId = choose(apaList(s, pending, value)).id;
        p = pending;
        page = `APA page: named ${NAME(value)}, sure ${sure}`;
      } else {
        /* Baseline: the confirmation page with How sure; Keep moves the four values, Change my mind moves nothing. */
        const keepHere = (o, sure, how) => {
          p = applyBaselineConfirmUpdatesWithMoves(p, o, o.level, w, sure).profile;
          finalId = o.id; cvrFired = true; ev.keptMisfit += 1;
          page = `${how}confirmation page: Keep, sure ${sure}`;
        };
        if (cvr.path === "keep") {
          keepHere(opt, beh === "Random responder" ? sure2() : (cvr.strong ? 5 : 3), "");
        } else if (run.principleB && REFUSERS.includes(beh)) {
          keepHere(opt, cvr.confidence, "");
        } else {
          ev.wentBack += 1;
          let guard = 0;
          for (;;) {
            const again = chooseAgain(beh, ranked, p, cvr);
            if (isFit(again.opt.level)) {
              p = applyKeepUpdates(p, again.opt, again.opt.level, w, s.options);
              finalId = again.opt.id; cvrFired = false;
              page = "confirmation page: Change my mind; then a good fit";
              break;
            }
            const keepIt = beh !== "Random responder" || rnd2() < 0.5 || ++guard >= 20;
            if (keepIt) { keepHere(again.opt, beh === "Random responder" ? sure2() : cvr.confidence, "Change my mind; then "); break; }
          }
        }
      }
      captured.push(capturedOf(s, s.options.find((o) => o.id === finalId)));
    }
    const level = ranked.find((o) => o.id === finalId).level;
    vciRows.push({ vciScore: scenarioVciScore(level, s.options.length), decisionRole: s.decisionRole ?? "decider" });
    const step = runningStep(s, finalId, running, p);
    running = step.next;
    runningRows.push({ running: step.record });
    results.push({
      scenarioId: s.id, decisionRole: s.decisionRole ?? "decider", cvrFired,
      selectedOptionId: finalId, running: step.record,
      policySnapshotAfter: Object.fromEntries(POLICY.map((k) => [k, sc(p, k)])),
      framingSnapshotAfter: { directnessSensitivity: sc(p, "directnessSensitivity"), contextSensitivity: sc(p, "contextSensitivity") },
      stakeholderSnapshotAfter: sc(p, STAKE),
    });
    if (trace) {
      trace.push({
        scenario: i + 1, scenarioTitle: s.title,
        first: `${title(s, opt.id)} (${levelWord(opt.level)})`,
        page,
        final: finalId === opt.id ? "the same" : `${title(s, finalId)} (${levelWord(ranked.find((o) => o.id === finalId).level)})`,
        moved: [...POLICY, STAKE].map((k) => [k, Math.round((sc(p, k) - sc(before, k)) * 10) / 10]).filter(([, d]) => d !== 0),
        valuesAfter: Object.fromEntries(POLICY.map((k) => [k, Math.round(sc(p, k) * 10) / 10])),
        countedForStability: scored && cvrFired,
      });
    }
  });
  const vci = computeVCI(vciRows);
  const vciAll = computeVciAll(runningRows);
  const stab = computeStability(results, frozen);
  const stabAll = computeStabilityAll(results);
  const top = computeTopValueChoices(results, frozen);
  /* The stakeholder, directness and context scores are never shown or moved in APA_Only and Baseline: the study writes
     their stabilities as not measured (null), so this does too. */
  const frozenScores = run.condition === "APA_Only" || run.condition === "Baseline";
  return {
    vci: vci.value, vciLevel: vci.level,
    vciAll: vciAll.value, vciAllLevel: vciAll.level,
    stability: stab.value, stabilityLevel: stab.level, measured: stab.conflictSteps > 0, conflictSteps: stab.conflictSteps,
    stabilityAll: stabAll.value, stabilityAllLevel: stabAll.level, stabilityAllMeasured: stabAll.measured,
    topValue: top.countTopValue, topOrSecond: top.countTopOrSecond,
    performance: Math.round(captured.reduce((a, b) => a + b, 0) / captured.length),
    stakeholder: frozenScores ? null : computeSensitivityStability(results, frozen).stakeholder?.value ?? null,
    ...ev,
  };
}

/** One kind in one run over the 2,000 starting profiles, both generators restarted. */
function measureRun(run, beh) {
  POP.reseed(777); seed2 = 4242;
  return POP.starts.map((s) => runPersonIn(s, beh, run));
}

/** Every kind in every run: { [runId]: { [kind]: result[] } }. */
function measureConditions() {
  const out = {};
  for (const run of RUNS) {
    out[run.id] = {};
    for (const beh of KINDS) out[run.id][beh] = measureRun(run, beh);
  }
  return out;
}

/** One person's path in every run, for the examples: the draws are replayed from the start for that person. */
function traceAll(beh, personIndex) {
  const out = {};
  for (const run of RUNS) {
    POP.reseed(777); seed2 = 4242;
    let trace = null, result = null;
    POP.starts.forEach((s, i) => {
      if (i === personIndex) { trace = []; result = runPersonIn(s, beh, run, trace); } else if (i < personIndex) runPersonIn(s, beh, run);
    });
    out[run.id] = { trace, result };
  }
  return out;
}

module.exports = { RUNS, REFUSERS, runPersonIn, measureRun, measureConditions, traceAll, POLICY };
