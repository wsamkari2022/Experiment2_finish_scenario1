/*
 * validate_prediction.cjs — offline validation of the scenario-6 choice predictor.
 *
 * WHAT THIS CAN AND CANNOT TELL YOU. Read this before quoting any number below.
 *
 * It CAN show that the machinery is correct: that the probabilities are well formed, that they
 * follow the alignment scores, that confidence sharpens them, and that degenerate inputs cannot
 * produce a NaN on a page a participant is reading. Those are the gates, and a failure there is a
 * bug.
 *
 * It CAN also show what the predictor would achieve against a participant whose decision rule is
 * KNOWN, because the simulated choosers below are built from a stated rule. That answers "is the
 * predictor calibrated for someone who behaves like this?" and "how much better is it than
 * guessing?".
 *
 * It CANNOT tell you whether real people behave like any of those rules. No human data exists yet.
 * Every accuracy figure below is conditional on a decision rule this file invented, and must be
 * reported that way or not at all.
 *
 * Run:  npm run validate:prediction
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

const { predictChoice, predictionConfidence, PREDICTION_VERSION } = B("block5Prediction.js");
const { policyAlignmentScore, policyAlignmentShortfall, labelOptions } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity",
             "stakeholderPerspectiveShiftSensitivity"];

const mk = (o) => ({
  generatedAt: "", topThreeKeys: [], topSensitivityKey: "x",
  dimensions: ALL.map((k, i) => ({
    key: k, label: k, score: o[k] === undefined ? 50 : o[k],
    rank: i + 1, weight: 0.1, sourceBlocks: [],
  })),
});

const SEED = 424242;
let seed = SEED;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const draw = () => { const o = {}; for (const k of ALL) o[k] = Math.round(rnd() * 100); return mk(o); };
const scenario = () => BLOCK5_SCENARIOS[Math.floor(rnd() * BLOCK5_SCENARIOS.length)];

let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(3)} ${msg}`);
  if (!ok) fails++;
};
const q = (v, f) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length * f)]; };
const pctS = (n) => (n * 100).toFixed(1) + "%";

console.log("\n=== SCENARIO-6 CHOICE PREDICTOR — OFFLINE VALIDATION ===\n");
console.log("  rule version " + PREDICTION_VERSION + ", seed " + SEED + "\n");

/* ============================================================ 1 · gates on the machinery */
console.log("--- gates ---");

{
  let sumOk = true, monoOk = true, detOk = true;
  for (let i = 0; i < 800; i++) {
    const p = draw(); const s = scenario();
    const pr = predictChoice(s.options, p, { vci: rnd() * 100, stability: rnd() * 100 });
    const total = pr.options.reduce((a, o) => a + o.probability, 0);
    if (Math.abs(total - 1) > 1e-9) sumOk = false;
    /*
      MONOTONIC AGAINST THE UNCENSORED FIT, NOT AGAINST THE DISPLAYED SCORE.

      This used to sort by `alignmentScore`, which stops at 0. For a demanding participant several
      options report the same 0 while having genuinely different shortfalls, so the old form
      demanded that options which merely LOOK equal be given equal probability - the exact bug the
      predictor was changed to stop. Sorting on the shortfall asks the real question: a better fit
      must never receive a lower probability.
    */
    const byFit = [...pr.options]
      .map((o) => ({ o, fit: -policyAlignmentShortfall(s.options.find((x) => x.id === o.optionId), p) }))
      .sort((a, b) => b.fit - a.fit);
    for (let j = 1; j < byFit.length; j++) {
      if (byFit[j].o.probability - byFit[j - 1].o.probability > 1e-12) monoOk = false;
    }
    const again = predictChoice(s.options, p, { vci: 50, stability: 50 });
    const once = predictChoice(s.options, p, { vci: 50, stability: 50 });
    if (JSON.stringify(again) !== JSON.stringify(once)) detOk = false;
  }
  gate("P1", sumOk, "the six probabilities always sum to exactly 1  (800 cases)");
  gate("P2", monoOk, "a better-fitting option never gets a lower probability  (800 cases)");

  {
    /* THE BUG THIS FILE EXISTS TO CATCH AGAIN. A participant who asks a lot of every value pushes
       every option past the floor, so all of them display 0. Before the fix the predictor fed
       those identical zeros to the softmax and returned an even split, which is a confident claim
       that the model knows nothing - made precisely when the participant's values are strongest. */
    const demanding = mk({ vulnerabilityProtectionSensitivity: 94, groupSizeSensitivity: 0,
                           gainResponsivenessSensitivity: 100, outcomeAggregationSensitivity: 87 });
    const veil = BLOCK5_SCENARIOS[BLOCK5_SCENARIOS.length - 1];
    const shown = veil.options.map((o) => policyAlignmentScore(o, demanding));
    const pr = predictChoice(veil.options, demanding, { vci: 70, stability: 80 });
    const probs = pr.options.map((o) => o.probability);
    const spread = Math.max(...probs) - Math.min(...probs);
    gate("P8", shown.every((x) => x === 0) && spread > 0.05,
      `all four options display 0 yet the prediction still separates them  (${probs.map((x) => pctS(x)).join(" ")})`);
  }
  gate("P3", detOk, "the same profile and scenario always give the identical prediction");
}

{
  /* Confidence must sharpen, on the same profile and scenario. */
  let sharper = 0, total = 0;
  for (let i = 0; i < 400; i++) {
    const p = draw(); const s = scenario();
    const lo = predictChoice(s.options, p, { vci: 0, stability: 0 });
    const hi = predictChoice(s.options, p, { vci: 100, stability: 100 });
    /* Equal only when every option scores the same, where there is nothing to sharpen. */
    if (hi.separation === 0) continue;
    total++;
    if (hi.topProbability > lo.topProbability) sharper++;
  }
  gate("P4", sharper === total,
    `a confident prediction is always sharper than an unsure one  (${sharper}/${total})`);
}

{
  /* Six identical options must produce a flat prediction, whatever the confidence. */
  const flatScenario = {
    options: BLOCK5_SCENARIOS[0].options.map((o, i) => ({
      ...o, id: "same_" + i,
      fingerprint: { ...BLOCK5_SCENARIOS[0].options[0].fingerprint },
    })),
  };
  const pr = predictChoice(flatScenario.options, draw(), { vci: 100, stability: 100 });
  const spread = Math.max(...pr.options.map((o) => o.probability))
               - Math.min(...pr.options.map((o) => o.probability));
  gate("P5", spread < 1e-9 && pr.separation === 0,
    `six identical options give six equal probabilities  (spread ${spread.toExponential(1)}, each ${pctS(pr.options[0].probability)})`);
}

{
  /* Nothing a broken record can carry may reach a participant as NaN. */
  const bad = [
    { vci: null, stability: null }, { vci: undefined, stability: undefined },
    { vci: NaN, stability: 50 }, { vci: -20, stability: 400 },
    { vci: "40", stability: {} },
  ];
  let ok = true;
  for (const inputs of bad) {
    const pr = predictChoice(BLOCK5_SCENARIOS[0].options, draw(), inputs);
    const total = pr.options.reduce((a, o) => a + o.probability, 0);
    if (!Number.isFinite(total) || Math.abs(total - 1) > 1e-9) ok = false;
    if (!Number.isFinite(pr.confidence) || pr.confidence < 0 || pr.confidence > 1) ok = false;
    if (pr.options.some((o) => !Number.isFinite(o.probability))) ok = false;
  }
  gate("P6", ok, "missing or malformed VCI/Stability cannot produce a NaN probability");
  const none = predictChoice(BLOCK5_SCENARIOS[0].options, draw(), { vci: null, stability: null });
  gate("P7", none.confidence === 0,
    "an unknown confidence is treated as NO confidence, not as average confidence");
}

/* P9 — the MPF's "most likely" option is the option labeled Aligned, ties included. Both rank an
   exact tie in fit by what the option delivers, then by id; were the prediction to break ties by
   card position instead, the two would disagree whenever two options fit identically. Required to
   meet real ties, so the gate cannot pass by finding none. */
{
  let cases = 0, tiesMet = 0, disagree = 0;
  for (let n = 0; n < 2000; n++) {
    const p = draw();
    for (const s of BLOCK5_SCENARIOS) {
      const lab = labelOptions(s.options, p);
      const pr = predictChoice(s.options, p, { vci: 70, stability: 70 });
      cases++;
      if (lab[0].matchShortfall === lab[1].matchShortfall) tiesMet++;
      if (pr.options.find((o) => o.rank === 1).optionId !== lab[0].id) disagree++;
    }
  }
  gate("P9", tiesMet > 0 && disagree === 0,
    `the most likely option is always the Aligned one  (${cases} cases, ${tiesMet} with a tie at the top, ${disagree} disagreements)`);
}

/* ================================================= 2 · what the predictions actually look like */
console.log("\n--- what the predictor actually claims, over 3000 random profiles ---\n");
{
  const tops = [], seps = [], confs = [];
  for (let i = 0; i < 3000; i++) {
    const p = draw(); const s = scenario();
    const pr = predictChoice(s.options, p, { vci: rnd() * 100, stability: rnd() * 100 });
    tops.push(pr.topProbability); seps.push(pr.separation); confs.push(pr.confidence);
  }
  console.log("    top option's probability   p10 " + pctS(q(tops, 0.10))
    + "   median " + pctS(q(tops, 0.5)) + "   p90 " + pctS(q(tops, 0.90)));
  console.log("    separation (best - 2nd)    p10 " + q(seps, 0.10)
    + "     median " + q(seps, 0.5) + "       p90 " + q(seps, 0.90));
  console.log("    chance alone would be     " + pctS(1 / 6));
  const overclaim = tops.filter((t) => t > 0.6).length / tops.length;
  console.log("\n    predictions claiming more than 60% for one option: " + pctS(overclaim));
  console.log("    (the model rarely separates the top two, so a confident claim should be rare)");
}

/* ======================================================= 3 · calibration against known choosers */
console.log("\n--- calibration against simulated choosers ---\n");
console.log("  A simulated participant picks option i with probability proportional to");
console.log("  exp(alignment_i / T_true). SMALL T_true = picks their best fit almost always.");
console.log("  LARGE T_true = close to random. The predictor does not get told T_true.\n");
console.log("    T_true | behaves like                | conf | top-1 hit | mean p of the");
console.log("           |                             |      |           | option chosen");
console.log("    -------+-----------------------------+------+-----------+---------------");

const DESCRIBE = {
  10: "almost always the best fit",
  20: "usually the best fit",
  40: "leans to fit, often strays",
  80: "barely guided by fit",
  1e9: "completely at random",
};

const calBins = new Map();
for (const tTrue of [10, 20, 40, 80, 1e9]) {
  /*
   * THE SAME DRAWS ARE SCORED AT ALL THREE CONFIDENCE LEVELS.
   *
   * Temperature is a monotone transform: it changes how far apart the six probabilities sit, and
   * it can never reorder them. So top-1 accuracy CANNOT depend on confidence, and the column must
   * come out identical across the three rows. An earlier version drew fresh profiles for each row
   * and produced 53.9 / 52.5 / 51.8, which is pure sampling noise and invites a reader to see a
   * trend that the arithmetic forbids. Sharing the draws makes the constancy visible instead.
   */
  const CONFS = [0, 0.5, 1];
  const acc = CONFS.map(() => ({ hits: 0, pChosen: 0, n: 0 }));

  for (let i = 0; i < 1200; i++) {
    const p = draw();
    const s = scenario();

    /* The simulated participant's own choice, made once and judged by all three predictions. */
    const a = s.options.map((o) => policyAlignmentScore(o, p));
    const m = Math.max(...a);
    const w = a.map((x) => Math.exp((x - m) / tTrue));
    const tot = w.reduce((x, y) => x + y, 0);
    let r = rnd() * tot, pick = 0;
    for (let j = 0; j < w.length; j++) { r -= w[j]; if (r <= 0) { pick = j; break; } }
    const chosenId = s.options[pick].id;

    CONFS.forEach((conf, ci) => {
      const pr = predictChoice(s.options, p, { vci: conf * 100, stability: conf * 100 });
      const predTop = pr.options.find((o) => o.rank === 1);
      if (predTop && predTop.optionId === chosenId) acc[ci].hits++;
      const chosen = pr.options.find((o) => o.optionId === chosenId);
      acc[ci].pChosen += chosen ? chosen.probability : 0;
      acc[ci].n++;

      if (conf === 0.5) {
        for (const o of pr.options) {
          const b = Math.min(9, Math.floor(o.probability * 20));
          const cur = calBins.get(b) || { pred: 0, obs: 0, n: 0 };
          cur.pred += o.probability;
          cur.obs += o.optionId === chosenId ? 1 : 0;
          cur.n++;
          calBins.set(b, cur);
        }
      }
    });
  }

  CONFS.forEach((conf, ci) => {
    const c = acc[ci];
    console.log("    " + String(tTrue >= 1e9 ? "random" : tTrue).padStart(6)
      + " | " + DESCRIBE[tTrue].padEnd(27)
      + " | " + conf.toFixed(1).padStart(4)
      + " | " + pctS(c.hits / c.n).padStart(9)
      + " | " + pctS(c.pChosen / c.n).padStart(13));
  });
}

console.log("\n  Top-1 is identical down each block of three, and that is arithmetic rather than");
console.log("  luck: confidence stretches the probabilities but never reorders them. Only the");
console.log("  right-hand column can respond to confidence.");

console.log("\n  RELIABILITY — when the predictor says X%, does it happen X% of the time?\n");
console.log("  POOLED ACROSS ALL FIVE SIMULATED BEHAVIORS ABOVE, in equal parts, at confidence 0.5.");
console.log("  That equal weighting is an assumption and not a finding: it says a real sample would");
console.log("  contain as many people who barely follow their values as people who follow them");
console.log("  closely. Re-read this table once real data says otherwise.\n");
console.log("    predicted | actually chosen | cases");
console.log("    ----------+-----------------+-------");
for (const b of [...calBins.keys()].sort((a, c) => a - c)) {
  const v = calBins.get(b);
  if (v.n < 50) continue;
  console.log("    " + pctS(v.pred / v.n).padStart(9) + " | " + pctS(v.obs / v.n).padStart(15)
    + " | " + String(v.n).padStart(6));
}

console.log("\n  Read the two columns against each other. They match when the simulated chooser");
console.log("  happens to behave the way the shipped temperature assumes, and diverge when it");
console.log("  does not. Nothing here says which column real participants will produce.\n");

console.log("=".repeat(72));
console.log(fails === 0 ? "### ALL PREDICTION GATES PASSED ###"
                        : `### ${fails} PREDICTION GATE(S) FAILED ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails === 0 ? 0 : 1);
