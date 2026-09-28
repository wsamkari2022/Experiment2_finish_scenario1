/*
 * validate_vci_all.cjs — the guard on VCI_all and the hidden running values (28 September 2026).
 *
 * VCI_all is the researcher's second consistency score: the same measure as VCI, over all six scenarios,
 * judged on hidden RUNNING values that move after every final choice, the wish and the veil included.
 * See src/experiment/block5VciAll.ts. These gates run the real code over the pretend participants of
 * report:vci (2,000 starting profiles × twelve kinds, seed 777) with the real update rules, and check:
 *
 *   A1  the keep rule is EXACTLY what it was before its comparison moved into moveByComparisonWithBestFit
 *       (the old code is written out below and compared on 20,000 random cases)
 *   A2  the running rule: a best-fit pick moves nothing; any other pick moves +20 / -15 only, on the
 *       values the comparison names - the keep rule's comparison, whatever the label
 *   A3  the running values are the study's own values through scenario 4, for every pretend participant
 *   A4  no choice is judged on values its own choice moved: every scenario opens on the running values
 *       the previous one left, and the first on the values brought into Block 5
 *   A5  blind picking in all six scenarios gives VCI_all 50 (within 1), on six options and on four
 *   A6  VCI_all's level edges are derived from the deck, never written out: 88.89 / 77.78 / 62.5 /
 *       47.22 / 27.78 today
 *   A7  following one's values in all six gives 100 on VCI and on VCI_all
 *   A8  in the four decisions the running fit IS the study's fit (the label on the values the scenario
 *       opened with), and after a pick in the wish or the veil that is not the best fit the running
 *       values DO move, while the study's own values never do
 *
 * It also PRINTS, without gating, the two stated effects the researcher accepted: the scenario-5 echo
 * and the scenario-5 screen-against-yardstick share (block5VciAll.ts). If they drift far from 35 and 8
 * in 100, the documents that quote them need updating.
 *
 * Run:  npm run validate:vciall
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

const {
  labelOptions, applyKeepUpdates, applyEndorsementUpdates, applyApaUpdates, applyRunningMoveWithMoves,
  optionMainValue, scenarioIsScored, labelWeight, computeVCI,
} = B("block5CVR.js");
const { runningStep, computeVciAll, VCI_ALL_LEVELS } = B("block5VciAll.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const POP = require("./vci_distribution.cjs");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
  "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const clone = (p) => JSON.parse(JSON.stringify(p));
const isFit = (l) => l === "aligned" || l === "weakly_aligned";
const vals = (p) => POLICY.map((k) => p.dimensions.find((d) => d.key === k).score);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

let fails = 0;
const gate = (id, ok, msg) => { console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(3)} ${msg}`); if (!ok) fails += 1; };

console.log("");
console.log("==============================================================================");
console.log("  VCI_ALL AND THE HIDDEN RUNNING VALUES");
console.log("==============================================================================");

/* ---------------------------------------------------------------- A1: the keep rule, unchanged */
{
  /* The keep rule as it stood before 28 September 2026, written out. Kept here as the reference. */
  const scoreOf = (p, k) => p.dimensions.find((d) => d.key === k)?.score ?? 50;
  function oldKeep(profile, option, level, stakesWeight, menu) {
    const p = clone(profile);
    if (level !== "weakly_aligned") return p;
    const bestFit = labelOptions(menu, profile)[0];
    if (!bestFit || bestFit.id === option.id) return p;
    const rankOf = (k) => profile.dimensions.find((d) => d.key === k)?.rank ?? Number.MAX_SAFE_INTEGER;
    const gaps = POLICY.map((k) => ({ k, gap: option.fingerprint[k] - bestFit.fingerprint[k] }));
    const whyChosen = gaps.filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap || rankOf(a.k) - rankOf(b.k))[0];
    const givenUp = gaps.filter((x) => x.gap < 0).map((x) => ({ k: x.k, cost: (-x.gap * scoreOf(profile, x.k)) / 100 }))
      .filter((x) => x.cost > 0).sort((a, b) => b.cost - a.cost || rankOf(a.k) - rankOf(b.k))[0];
    const bump = (k, d) => { const dim = p.dimensions.find((x) => x.key === k); dim.score = Math.max(0, Math.min(100, dim.score + d)); };
    if (whyChosen) bump(whyChosen.k, 20 * stakesWeight);
    if (givenUp) bump(givenUp.k, -15 * stakesWeight);
    return p;
  }
  let same = true, checked = 0;
  POP.reseed(4242);
  for (let n = 0; n < 20000; n++) {
    const start = POP.starts[n % POP.starts.length];
    const s = BLOCK5_SCENARIOS[n % 5];
    const lab = labelOptions(s.options, start);
    const opt = lab[1 + (n % (lab.length - 1))];
    for (const level of ["aligned", "weakly_aligned", "misaligned"]) {
      const a = vals(applyKeepUpdates(start, opt, level, 1, s.options));
      const b = vals(oldKeep(start, opt, level, 1, s.options));
      checked += 1;
      if (a.some((x, i) => Math.abs(x - b[i]) > 1e-9)) same = false;
    }
  }
  gate("A1", same, `the keep rule gives exactly the values it gave before the refactor  (${checked} cases)`);
}

/* ---------------------------------------------------------------- A2: the running rule */
{
  let ok = true, best = 0, other = 0;
  for (const start of POP.starts.slice(0, 500)) {
    for (const s of BLOCK5_SCENARIOS) {
      const lab = labelOptions(s.options, start);
      for (const opt of lab) {
        const u = applyRunningMoveWithMoves(start, opt, s.options, 1);
        if (opt.id === lab[0].id) { best += 1; if (u.moves.length) ok = false; continue; }
        other += 1;
        if (u.moves.some((m) => m.requested !== 20 && m.requested !== -15)) ok = false;
        const keep = applyKeepUpdates(start, opt, "weakly_aligned", 1, s.options);
        if (vals(keep).some((x, i) => Math.abs(x - vals(u.profile)[i]) > 1e-9)) ok = false;
      }
    }
  }
  gate("A2", ok, `the running rule: best fit moves nothing (${best}), every other pick moves +20 / -15 as the keep rule's comparison (${other})`);
}

/* ---------------------------------------------------------------- A3, A4, A7 and the stated effects */
function run(start, beh) {
  const frozen = clone(start);
  let live = clone(start);
  let running = clone(start);
  const st = {};
  const results = [];
  const checks = { studyEqualThrough4: true, opensWhereLastLeft: true, decisionFitIsStudyFit: true, wishAndVeilMove: true, studyStillThere: true };
  let lastAfter = vals(start);
  BLOCK5_SCENARIOS.forEach((s, i) => {
    if (i === 3) st.__s4Open = clone(live);
    const shownOn = i === 4 ? st.__s4Open : live;       // the page: the wish is shown on scenario 4's opening values
    const shown = labelOptions(s.options, shownOn);
    const { opt, cvr } = POP.BEHAVIORS[beh](shown, shownOn, frozen, i, st);
    let finalId = opt.id;
    let studyNext = live;
    if (scenarioIsScored(s)) {
      const w = s.stakesWeight ?? 1;
      if (isFit(opt.level)) studyNext = applyKeepUpdates(live, opt, opt.level, w, s.options);
      else if (cvr.path === "keep") studyNext = applyEndorsementUpdates(live, opt, cvr.strong, cvr.moved, null, w);
      else {
        const pending = applyApaUpdates(live, cvr.moved, cvr.value, null, w, cvr.confidence);
        const lab = labelOptions(s.options, pending);
        let matching = lab.filter((o) => optionMainValue(o) === cvr.value);
        if (!matching.length) matching = [...lab].sort((a, b) => b.fingerprint[cvr.value] - a.fingerprint[cvr.value]).slice(0, 1);
        finalId = cvr.choose(matching).id;
        studyNext = pending;
      }
    }
    if (vals(running).some((x, k) => Math.abs(x - lastAfter[k]) > 1e-9)) checks.opensWhereLastLeft = false;
    if (i < 4 && vals(running).some((x, k) => Math.abs(x - vals(live)[k]) > 1e-9)) checks.studyEqualThrough4 = false;
    const step = runningStep(s, finalId, running, studyNext);
    if (i < 4 && step.record.level !== shown.find((o) => o.id === finalId).level) checks.decisionFitIsStudyFit = false;
    if (i >= 4 && step.record.level !== "aligned" && !(step.record.moves ?? []).length) checks.wishAndVeilMove = false;
    if (i >= 4 && vals(studyNext).some((x, k) => Math.abs(x - vals(live)[k]) > 1e-9)) checks.studyStillThere = false;
    results.push({
      scenarioId: s.id, decisionRole: s.decisionRole ?? "decider", selectedOptionId: finalId,
      vciScore: labelWeight(shown.find((o) => o.id === finalId).level, s.options.length), running: step.record,
    });
    running = step.next;
    lastAfter = vals(running);
    live = studyNext;
  });
  return { results, checks };
}

{
  let a3 = true, a4 = true, a7 = true, a8 = true, people = 0;
  let echoN = 0, echoUp = 0, lookBest = 0, lookBestLost = 0;
  const lines = [];
  for (const beh of Object.keys(POP.BEHAVIORS)) {
    POP.reseed(777);
    const rows = POP.starts.map((st) => run(st, beh));
    for (const r of rows) {
      people += 1;
      if (!r.checks.studyEqualThrough4) a3 = false;
      if (!r.checks.opensWhereLastLeft) a4 = false;
      if (!r.checks.decisionFitIsStudyFit || !r.checks.wishAndVeilMove || !r.checks.studyStillThere) a8 = false;
      const all = computeVciAll(r.results);
      const vci = computeVCI(r.results);
      const parts = r.results.map((x) => x.running.vciScore);
      if (parts.every((x) => x === 1) && (all.value !== 100 || vci.value !== 100)) a7 = false;
      /* the stated effects, scenario 5 */
      const s4 = r.results[3], s5 = r.results[4];
      const t4 = BLOCK5_SCENARIOS[3].options.find((o) => o.id === s4.selectedOptionId).title;
      const t5 = BLOCK5_SCENARIOS[4].options.find((o) => o.id === s5.selectedOptionId).title;
      if (t4 === t5) { echoN += 1; if (s5.running.vciScore > s5.vciScore) echoUp += 1; }
      if (s5.vciScore === 1) { lookBest += 1; if (s5.running.vciScore < 1) lookBestLost += 1; }
    }
    lines.push(`    ${beh.padEnd(24)} VCI ${mean(rows.map((r) => computeVCI(r.results).value)).toFixed(1).padStart(5)}   VCI_all ${mean(rows.map((r) => computeVciAll(r.results).value)).toFixed(1).padStart(5)}`);
  }
  gate("A3", a3, `the running values are the study's own values through scenario 4  (${people} pretend runs)`);
  gate("A4", a4, "every scenario opens on the running values the previous one left: no choice is judged on its own move");
  gate("A7", a7, "following one's values in all six gives 100 on VCI and on VCI_all");
  gate("A8", a8, "decisions: running fit = the study's fit; wish and veil: a non-best pick moves the running values, never the study's");
  console.log("");
  console.log("  VCI and VCI_all by kind of pretend participant (report:vci's people, the real update rules):");
  lines.forEach((l) => console.log(l));
  console.log("");
  console.log(`  STATED, NOT GATED: the echo - of ${echoN} wishes for the option decided in scenario 4, `
    + `${Math.round(100 * echoUp / echoN)} in 100 score higher on the running values than on screen;`);
  console.log(`  screen against yardstick - of ${lookBest} wishes for the card that looked best, `
    + `${Math.round(100 * lookBestLost / lookBest)} in 100 score below 100 on the running values.`);
}

/* ---------------------------------------------------------------- A5: blind picking */
{
  let x = 99;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const scores = POP.starts.map((start) => {
    let running = clone(start);
    const results = BLOCK5_SCENARIOS.map((s) => {
      const lab = labelOptions(s.options, running);
      const pick = lab[Math.floor(rnd() * lab.length)];
      const step = runningStep(s, pick.id, running, running);
      running = step.next;
      return { running: step.record };
    });
    return mean(results.map((r) => r.running.vciScore)) * 100;
  });
  const m = mean(scores);
  /* The labels by place (rankLabel): six options 1 / 2 / 3-4 / 5-6, four options one each. */
  const exact6 = [0, 1, 2, 3, 4, 5].reduce((a, i) => a + labelWeight(["aligned", "weakly_aligned", "misaligned", "misaligned", "strongly_misaligned", "strongly_misaligned"][i], 6), 0) / 6;
  const exact4 = ["aligned", "weakly_aligned", "misaligned", "strongly_misaligned"].reduce((a, l) => a + labelWeight(l, 4), 0) / 4;
  gate("A5", Math.abs(m - 50) <= 1 && Math.abs(exact6 - 0.5) < 1e-9 && Math.abs(exact4 - 0.5) < 1e-9,
    `blind picking in all six gives VCI_all ${m.toFixed(1)}; the place average is exactly 50 on six options and on four`);
}

/* ---------------------------------------------------------------- A6: the derived edges */
{
  const sizes = BLOCK5_SCENARIOS.map((s) => s.options.length);
  const always = (l) => 100 * mean(sizes.map((n) => labelWeight(l, n)));
  const A = always("aligned"), W = always("weakly_aligned"), M = always("misaligned"), S = always("strongly_misaligned");
  const r2 = (v) => Math.round(v * 100) / 100;
  const expected = [r2((A + W) / 2), r2(W), r2((W + M) / 2), r2(M), r2((M + S) / 2)];
  const got = VCI_ALL_LEVELS.slice(0, 5).map((l) => l.from);
  gate("A6", JSON.stringify(expected) === JSON.stringify(got),
    `VCI_all's level edges are derived from this deck: ${got.join(" / ")}`);
}

console.log("");
console.log("==============================================================================");
if (fails) {
  console.log(`### ${fails} VCI_ALL GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("==============================================================================");
  process.exit(1);
}
console.log("### ALL VCI_ALL GATES PASSED ###");
console.log("==============================================================================");
console.log("");
