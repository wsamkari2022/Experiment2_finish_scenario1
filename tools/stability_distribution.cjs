/**
 * stability_distribution.cjs — how Stability and the three sensitivity stabilities come out for many
 * kinds of participant, over many random starting profiles, through the REAL scoring code. It
 * reproduces every "measured" figure in the Stability section of src/experiment/block5CVR.ts and in
 * docs/BLOCK5_STABILITY_METHOD.md.
 *
 * It is a REPORT, not a gate: it prints and never fails. The gates are in simulate_stability.cjs.
 *
 *   npm run report:stability           (2,000 profiles, the published figures)
 *   node tools/stability_distribution.cjs 500
 *
 * Seeded, and built on the same starting profiles and the same kinds of participant as
 * `npm run report:vci`, so the two reports describe the same simulated people.
 *
 * PART 3 COMPUTES THE MEASURE STABILITY REPLACED - distance traveled, with a start-versus-end order
 * check beside it - so the reasons given for the replacement can be checked rather than believed.
 * That function lives here and nowhere in the app.
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

const { labelOptions, applyKeepUpdates, applyEndorsementUpdates, applyApaUpdates, optionMainValue,
        scenarioIsScored, performanceScore, computeStability, computeSensitivityStability } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

const N = Number(process.argv[2] || 2000);
const SEED = 20260918;
const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const STAKE = "stakeholderPerspectiveShiftSensitivity";
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity", STAKE];
const mk = (o) => ({ generatedAt: "", topThreeKeys: [], topSensitivityKey: "x",
  dimensions: ALL.map((k, i) => ({ key: k, label: k, score: o[k] ?? 50, rank: i + 1, weight: 0.1, sourceBlocks: [] })) });
const sc = (p, k) => p.dimensions.find((d) => d.key === k).score;
const clone = (p) => JSON.parse(JSON.stringify(p));
const isFit = (l) => l === "aligned" || l === "weakly_aligned";
const topOf = (p) => [...POLICY].sort((a, b) => sc(p, b) - sc(p, a))[0];

let seed = SEED;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pickR = (a) => a[Math.floor(rnd() * a.length)];
const draw = () => { const o = {}; for (const k of ALL) o[k] = Math.round(rnd() * 100); return mk(o); };
const starts = Array.from({ length: N }, draw);
const champion = (ranked, k) => [...ranked].sort((a, b) => b.fingerprint[k] - a.fingerprint[k])[0];

/* The kinds of participant - the same twelve as tools/vci_distribution.cjs. */
const KEEP_STRONG = { path: "keep", strong: true, moved: false };
const BEHAVIORS = {
  "Always aligned":         (r) => ({ opt: r[0], cvr: KEEP_STRONG }),
  "Always weakly aligned":  (r) => ({ opt: r[1], cvr: KEEP_STRONG }),
  "Top-two mixer":          (r) => ({ opt: rnd() < 0.5 ? r[0] : r[1], cvr: KEEP_STRONG }),
  "True to top value":      (r, p, f) => ({ opt: champion(r, topOf(f)), cvr: KEEP_STRONG }),
  "Corrected by APA":       (r, p) => ({ opt: pickR(r.filter((x) => !isFit(x.level))),
    cvr: { path: "apa", value: topOf(p), confidence: 4, moved: true, choose: (m) => m[0] } }),
  "Convert (keeps)":        (r, p, f, i, st) => {
    if (i === 0) { const o = pickR(r.filter((x) => !isFit(x.level))); st.v = optionMainValue(o); return { opt: o, cvr: KEEP_STRONG }; }
    return { opt: champion(r, st.v), cvr: KEEP_STRONG };
  },
  "Convert (via APA)":      (r, p, f, i, st) => {
    if (i === 0) { const o = pickR(r.filter((x) => !isFit(x.level))); st.v = optionMainValue(o); }
    const o = i === 0 ? r.find((x) => optionMainValue(x) === st.v) : champion(r, st.v);
    return { opt: o, cvr: { path: "apa", value: st.v, confidence: 5, moved: false, choose: (m) => champion(m, st.v) } };
  },
  "Performance chaser":     (r) => ({ opt: [...r].sort((a, b) => performanceScore(b) - performanceScore(a))[0],
    cvr: { path: "keep", strong: false, moved: false } }),
  "Random responder":       (r) => ({ opt: pickR(r), cvr: rnd() < 0.5
    ? { path: "keep", strong: rnd() < 0.5, moved: rnd() < 0.5 }
    : { path: "apa", value: pickR(POLICY), confidence: 1 + Math.floor(rnd() * 5), moved: rnd() < 0.5, choose: (m) => pickR(m) } }),
  "Flip-flopper (keeps)":   (r, p, f, i, st) => {
    st.used = st.used || new Set();
    const cand = POLICY.filter((k) => k !== topOf(p) && !st.used.has(k));
    const k = cand.length ? pickR(cand) : pickR(POLICY.filter((x) => x !== topOf(p)));
    st.used.add(k);
    return { opt: champion(r, k), cvr: KEEP_STRONG };
  },
  "Flip-flopper (via APA)": (r, p, f, i, st) => {
    st.used = st.used || new Set();
    const cand = POLICY.filter((k) => k !== topOf(p) && !st.used.has(k));
    const k = cand.length ? pickR(cand) : pickR(POLICY.filter((x) => x !== topOf(p)));
    st.used.add(k);
    return { opt: champion(r, k), cvr: { path: "apa", value: k, confidence: 5, moved: false, choose: (m) => champion(m, k) } };
  },
  "Always the worst fit":   (r) => ({ opt: r[r.length - 1], cvr: KEEP_STRONG }),
};

/** One participant, stored exactly as the app stores a run: snapshots after every scenario, and
    `cvrFired` on every decider scenario whose final choice was misaligned (keep and APA alike). */
function run(start, beh) {
  const frozen = clone(start);
  let p = clone(start);
  const st = {};
  const results = [];
  let tiedConflicts = 0, conflicts = 0;
  BLOCK5_SCENARIOS.forEach((s, i) => {
    const ranked = labelOptions(s.options, p);
    const { opt, cvr } = BEHAVIORS[beh](ranked, p, frozen, i, st);
    const w = s.stakesWeight ?? 1;
    const scored = scenarioIsScored(s);
    const cvrFired = scored && !isFit(opt.level);
    if (scored) {
      if (isFit(opt.level)) p = applyKeepUpdates(p, opt, opt.level, w, s.options);
      else if (cvr.path === "keep") p = applyEndorsementUpdates(p, opt, cvr.strong, cvr.moved, null, w);
      else p = applyApaUpdates(p, cvr.moved, cvr.value, null, w, cvr.confidence);
    }
    if (cvrFired) {
      conflicts++;
      const v = POLICY.map((k) => sc(p, k));
      if (new Set(v).size < v.length) tiedConflicts++;
    }
    results.push({
      scenarioId: s.id, decisionRole: s.decisionRole ?? "decider", cvrFired,
      policySnapshotAfter: Object.fromEntries(POLICY.map((k) => [k, sc(p, k)])),
      framingSnapshotAfter: { directnessSensitivity: sc(p, "directnessSensitivity"), contextSensitivity: sc(p, "contextSensitivity") },
      stakeholderSnapshotAfter: sc(p, STAKE),
    });
  });
  return {
    stab: computeStability(results, frozen),
    sens: computeSensitivityStability(results, frozen),
    dist: distanceMeasure(results, frozen),
    tiedConflicts, conflicts,
  };
}

/**
 * THE MEASURE STABILITY REPLACED, reproduced for comparison only: an order half (pairs of the four
 * values reordered between the start and the end, strictly) and a movement half (the mean absolute
 * step of the four values and the stakeholder, summed over every scenario, against a ceiling of 56
 * measured on simulated random responders), averaged. Its "Held steady" began at 85.
 */
function distanceMeasure(results, original) {
  const MOVE = [...POLICY, STAKE];
  const at = (r, k) => (k === STAKE ? r.stakeholderSnapshotAfter : r.policySnapshotAfter[k]);
  let prev = Object.fromEntries(MOVE.map((k) => [k, sc(original, k)]));
  let churn = 0;
  for (const r of results) {
    const now = Object.fromEntries(MOVE.map((k) => [k, at(r, k)]));
    churn += MOVE.reduce((a, k) => a + Math.abs(now[k] - prev[k]), 0) / MOVE.length;
    prev = now;
  }
  const order = (get) => [...POLICY].sort((x, y) => get(y) - get(x));
  const a = order((k) => sc(original, k));
  const last = results[results.length - 1].policySnapshotAfter;
  const b = order((k) => last[k]);
  let inv = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (b.indexOf(a[i]) > b.indexOf(a[j])) inv++;
  const orderPart = 100 * (6 - inv) / 6;
  const movementPart = 100 * (1 - Math.min(1, churn / 56));
  return Math.round((orderPart + movementPart) / 2);
}

/* ---------------------------------------------------------------------------------------------- */
const RES = {};
for (const beh of Object.keys(BEHAVIORS)) { seed = 777; RES[beh] = starts.map((s) => run(s, beh)); }
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a, t) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(t * (s.length - 1))]; };
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const auc = (a, b) => { let w = 0, t = 0; for (const x of a) for (const y of b) { if (x > y) w++; else if (x === y) t++; } return (w + t / 2) / (a.length * b.length); };
const LEVELS = ["Held steady", "Mostly steady", "Shifted a little", "Shifted a lot", "Changed substantially"];
const SHORT = { "Held steady": "Held", "Mostly steady": "Mostly", "Shifted a little": "Little", "Shifted a lot": "Lot", "Changed substantially": "Changed" };

console.log(`\n=== STABILITY DISTRIBUTION — ${N} random starting profiles, real scoring code, seed ${SEED} ===`);

console.log("\n1. STABILITY (the four policy values) BY KIND OF PARTICIPANT\n");
console.log("  participant             mean  p10  p50  p90  swaps  conflicts   " + LEVELS.map((l) => SHORT[l].padStart(8)).join(""));
for (const beh of Object.keys(BEHAVIORS)) {
  const r = RES[beh];
  const v = r.map((x) => x.stab.value);
  const share = LEVELS.map((l) => r.filter((x) => x.stab.level === l).length / r.length);
  console.log("  " + beh.padEnd(24) + avg(v).toFixed(0).padStart(4) + String(q(v, .1)).padStart(5) + String(q(v, .5)).padStart(5) +
    String(q(v, .9)).padStart(5) + avg(r.map((x) => x.stab.swaps)).toFixed(2).padStart(7) + avg(r.map((x) => x.stab.conflictSteps)).toFixed(1).padStart(11) +
    "   " + share.map((x) => pct(x).padStart(8)).join(""));
}

console.log("\n2. THE THREE SENSITIVITY STABILITIES (mean score)\n");
console.log("  participant               directness   context   stakeholder");
for (const beh of Object.keys(BEHAVIORS)) {
  const m = (w) => avg(RES[beh].map((x) => x.sens[w].value)).toFixed(0);
  console.log("  " + beh.padEnd(24) + m("directness").padStart(12) + m("context").padStart(10) + m("stakeholder").padStart(14));
}

console.log("\n3. SWAPS AGAINST DISTANCE TRAVELED (the measure Stability replaced)\n");
{
  const S = (b) => RES[b].map((x) => x.stab.value);
  const D = (b) => RES[b].map((x) => x.dist);
  console.log("  participant                 swaps   distance");
  for (const beh of Object.keys(BEHAVIORS)) console.log("  " + beh.padEnd(26) + avg(S(beh)).toFixed(0).padStart(6) + avg(D(beh)).toFixed(0).padStart(11));
  console.log("\n  how often the FIRST scores higher (ties half)       swaps   distance");
  for (const [a, b] of [["Flip-flopper (keeps)", "Convert (keeps)"], ["Flip-flopper (keeps)", "Random responder"],
                        ["Always aligned", "Random responder"], ["Convert (keeps)", "Always the worst fit"]])
    console.log("  " + `${a} > ${b}`.padEnd(50) + pct(auc(S(a), S(b))).padStart(6) + pct(auc(D(a), D(b))).padStart(11));
  const best = D("Always aligned");
  console.log(`\n  always the best fit under distance: mean ${avg(best).toFixed(0)}, below 85 (its "Held steady") ${pct(best.filter((v) => v < 85).length / best.length)}`);
  console.log(`  always the second best under distance: mean ${avg(D("Always weakly aligned")).toFixed(0)}`);
}

console.log("\n4. THE ROUTE — the same change of heart through APA or by keeping\n");
for (const b of ["Flip-flopper (keeps)", "Flip-flopper (via APA)", "Convert (keeps)", "Convert (via APA)"])
  console.log("  " + b.padEnd(26) + `Stability ${avg(RES[b].map((x) => x.stab.value)).toFixed(0)}, ${avg(RES[b].map((x) => x.stab.swaps)).toFixed(2)} swaps`);

console.log("\n5. TIES — two of the four values exactly equal after a conflict step\n");
{
  let tied = 0, n = 0;
  for (const b of Object.keys(BEHAVIORS)) for (const x of RES[b]) { tied += x.tiedConflicts; n += x.conflicts; }
  console.log(`  ${pct(tied / n)} of ${n} conflict steps across every kind of participant`);
}

console.log("\n6. THE SCALE — every value Stability can take\n");
{
  const vals = [...new Set(Array.from({ length: 13 }, (_, i) => Math.round(100 * (1 - Math.min(1, (i / 2) / 6)))))];
  console.log(`  ${vals.length} values: ${vals.join(" ")}`);
}
console.log("");
