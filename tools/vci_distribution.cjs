/**
 * vci_distribution.cjs — how VCI and its six levels come out for many kinds of participant, over many
 * random starting profiles, through the REAL scoring code. It reproduces every "measured over 2,000
 * random starting profiles" figure in the VCI section of src/experiment/block5CVR.ts and in
 * docs/BLOCK5_VCI_METHOD.md.
 *
 * It is a REPORT, not a gate: it prints and never fails. The gates are in simulate_vci.cjs.
 *
 *   npm run report:vci                (2,000 profiles, the published figures)
 *   node tools/vci_distribution.cjs 500
 *
 * Seeded, so the output is identical on every run. Change SEED or the behaviors only together with
 * the documents that quote the figures.
 *
 * HOW A SIMULATED PARTICIPANT IS SCORED - the same way the app scores a real one:
 *   - labels come from labelOptions on the profile brought INTO the scenario;
 *   - the per-scenario weight is scenarioVciScore(label, menu size) of the FINAL choice, judged on
 *     that entry profile on the keep path and the APA path alike (mirrors handleApaCommit);
 *   - the profile then moves by applyKeepUpdates, applyEndorsementUpdates or applyApaUpdates, in
 *     the decider scenarios only;
 *   - VCI and its level come from computeVCI.
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
        scenarioIsScored, scenarioVciScore, computeVCI, performanceScore, labelWeight, VCI_LEVELS } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

const N = Number(process.argv[2] || 2000);
const SEED = 20260918;
const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
                "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const ALL = [...POLICY, "directnessSensitivity", "contextSensitivity", "stakeholderPerspectiveShiftSensitivity"];
const mk = (o) => ({ generatedAt: "", topThreeKeys: [], topSensitivityKey: "x",
  dimensions: ALL.map((k, i) => ({ key: k, label: k, score: o[k] ?? 50, rank: i + 1, weight: 0.1, sourceBlocks: [] })) });
const sc = (p, k) => p.dimensions.find((d) => d.key === k).score;
const clone = (p) => JSON.parse(JSON.stringify(p));
const isFit = (l) => l === "aligned" || l === "weakly_aligned";
const topOf = (p) => [...POLICY].sort((a, b) => sc(p, b) - sc(p, a))[0];

let seed = SEED;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pickR = (a) => a[Math.floor(rnd() * a.length)];
/* Starting profiles: every sensitivity uniform on 0-100 - the same null population the Stability
   ceiling is calibrated on. */
const draw = () => { const o = {}; for (const k of ALL) o[k] = Math.round(rnd() * 100); return mk(o); };
const starts = Array.from({ length: N }, draw);

/** The option that serves value k most. */
const champion = (ranked, k) => [...ranked].sort((a, b) => b.fingerprint[k] - a.fingerprint[k])[0];

/* A behavior returns { opt, cvr }. `cvr` is used only when the option is misaligned in a decider
   scenario: { path: "keep", strong, moved } or { path: "apa", value, confidence, moved, choose }. */
const KEEP_STRONG = { path: "keep", strong: true, moved: false };
const BEHAVIORS = {
  "Always aligned":         (r) => ({ opt: r[0], cvr: KEEP_STRONG }),
  "Always weakly aligned":  (r) => ({ opt: r[1], cvr: KEEP_STRONG }),
  "Top-two mixer":          (r) => ({ opt: rnd() < 0.5 ? r[0] : r[1], cvr: KEEP_STRONG }),
  /* True to their Blocks 1-4 top value: always the option that serves it most. */
  "True to top value":      (r, p, f) => ({ opt: champion(r, topOf(f)), cvr: KEEP_STRONG }),
  /* Tempted every time, corrected every time: a misaligned pick, refused, then their top value named. */
  "Corrected by APA":       (r, p) => ({ opt: pickR(r.filter((x) => !isFit(x.level))),
    cvr: { path: "apa", value: topOf(p), confidence: 4, moved: true, choose: (m) => m[0] } }),
  /* One honest change in scenario 1, kept after the CVR; then true to the new value. */
  "Convert (keeps)":        (r, p, f, i, st) => {
    if (i === 0) { const o = pickR(r.filter((x) => !isFit(x.level))); st.v = optionMainValue(o); return { opt: o, cvr: KEEP_STRONG }; }
    return { opt: champion(r, st.v), cvr: KEEP_STRONG };
  },
  /* The same change, made through APA: names the new value and picks what serves it. */
  "Convert (via APA)":      (r, p, f, i, st) => {
    if (i === 0) { const o = pickR(r.filter((x) => !isFit(x.level))); st.v = optionMainValue(o); }
    const o = i === 0 ? r.find((x) => optionMainValue(x) === st.v) : champion(r, st.v);
    return { opt: o, cvr: { path: "apa", value: st.v, confidence: 5, moved: false, choose: (m) => champion(m, st.v) } };
  },
  /* Ignores values: the best average performance numbers every time. */
  "Performance chaser":     (r) => ({ opt: [...r].sort((a, b) => performanceScore(b) - performanceScore(a))[0],
    cvr: { path: "keep", strong: false, moved: false } }),
  /* Random everywhere: the option, the reflection route, and every APA answer. */
  "Random responder":       (r) => ({ opt: pickR(r), cvr: rnd() < 0.5
    ? { path: "keep", strong: rnd() < 0.5, moved: rnd() < 0.5 }
    : { path: "apa", value: pickR(POLICY), confidence: 1 + Math.floor(rnd() * 5), moved: rnd() < 0.5, choose: (m) => pickR(m) } }),
  /* A new value every scenario, never the current top, never one used before; keeps each. */
  "Flip-flopper (keeps)":   (r, p, f, i, st) => {
    st.used = st.used || new Set();
    const cand = POLICY.filter((k) => k !== topOf(p) && !st.used.has(k));
    const k = cand.length ? pickR(cand) : pickR(POLICY.filter((x) => x !== topOf(p)));
    st.used.add(k);
    return { opt: champion(r, k), cvr: KEEP_STRONG };
  },
  /* The same flip-flopper, saying so in APA every time. */
  "Flip-flopper (via APA)": (r, p, f, i, st) => {
    st.used = st.used || new Set();
    const cand = POLICY.filter((k) => k !== topOf(p) && !st.used.has(k));
    const k = cand.length ? pickR(cand) : pickR(POLICY.filter((x) => x !== topOf(p)));
    st.used.add(k);
    return { opt: champion(r, k), cvr: { path: "apa", value: k, confidence: 5, moved: false, choose: (m) => champion(m, k) } };
  },
  "Always the worst fit":   (r) => ({ opt: r[r.length - 1], cvr: KEEP_STRONG }),
};

function run(start, beh) {
  const frozen = clone(start);
  let p = clone(start);
  const st = {};
  const rows = [];
  BLOCK5_SCENARIOS.forEach((s, i) => {
    const ranked = labelOptions(s.options, p);
    const { opt, cvr } = BEHAVIORS[beh](ranked, p, frozen, i, st);
    const w = s.stakesWeight ?? 1;
    const n = s.options.length;
    let finalId = opt.id;
    let relabeled = null; // what relabeling on the moved profile would give; VCI never uses it
    if (scenarioIsScored(s)) {
      if (isFit(opt.level)) p = applyKeepUpdates(p, opt, opt.level, w);
      else if (cvr.path === "keep") p = applyEndorsementUpdates(p, opt, cvr.strong, cvr.moved, null, w);
      else {
        const pending = applyApaUpdates(p, cvr.moved, cvr.value, null, w, cvr.confidence);
        const lab = labelOptions(s.options, pending);
        let matching = lab.filter((o) => optionMainValue(o) === cvr.value);
        if (!matching.length) matching = [...lab].sort((a, b) => b.fingerprint[cvr.value] - a.fingerprint[cvr.value]).slice(0, 1);
        const fin = cvr.choose(matching);
        finalId = fin.id;
        relabeled = fin.level;
        p = pending;
      }
    }
    const level = ranked.find((o) => o.id === finalId).level; // judged at entry, on every path
    rows.push({ vciScore: scenarioVciScore(level, n), relabeledScore: scenarioVciScore(relabeled ?? level, n),
                decisionRole: s.decisionRole ?? "decider" });
  });
  const vci = computeVCI(rows);
  const relabeled = computeVCI(rows.map((r) => ({ vciScore: r.relabeledScore, decisionRole: r.decisionRole }))).value;
  return { vci: vci.value, level: vci.level, relabeled };
}

/* ---------------------------------------------------------------------------------------------- */
const LEVEL_NAMES = VCI_LEVELS.map((l) => l.label);
const SHORT = { "Highly Consistent": "HC", "Mostly Consistent": "MC", "Moderate": "Mod", "Low": "Low",
                "Very Low": "VL", "Highly Inconsistent": "HI" };
const q = (a, t) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(t * (s.length - 1))]; };
const pct = (x) => `${(100 * x).toFixed(0)}%`;

console.log(`\n=== VCI DISTRIBUTION — ${N} random starting profiles, real scoring code, seed ${SEED} ===`);
console.log(`  Label weights (six options): ${["aligned", "weakly_aligned", "misaligned", "strongly_misaligned"]
  .map((l) => labelWeight(l).toFixed(2)).join(" / ")}    Level edges: ${VCI_LEVELS.slice(0, -1).map((l) => l.from).join(" / ")}`);

console.log("\n1. VCI BY KIND OF PARTICIPANT (scenarios 1-4)\n");
console.log("  " + "participant".padEnd(24) + "mean  p10  p50  p90   " + LEVEL_NAMES.map((l) => SHORT[l].padStart(5)).join(""));
const RES = {};
for (const beh of Object.keys(BEHAVIORS)) {
  seed = 777; // every behavior meets the same random draws for its own choices
  const res = starts.map((s) => run(s, beh));
  RES[beh] = res;
  const v = res.map((r) => r.vci);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const share = LEVEL_NAMES.map((l) => res.filter((r) => r.level === l).length / res.length);
  console.log("  " + beh.padEnd(24) + mean.toFixed(0).padStart(4) + String(q(v, 0.1)).padStart(5) +
    String(q(v, 0.5)).padStart(5) + String(q(v, 0.9)).padStart(5) + "   " + share.map((x) => pct(x).padStart(5)).join(""));
}
console.log("  (HC Highly Consistent, MC Mostly Consistent, Mod Moderate, VL Very Low, HI Highly Inconsistent)");

console.log("\n2. SEPARATION — how often the first kind scores ABOVE the second (ties count half)\n");
const auc = (a, b) => { let w = 0, t = 0; for (const x of a) for (const y of b) { if (x > y) w++; else if (x === y) t++; } return (w + t / 2) / (a.length * b.length); };
const V = (b) => RES[b].map((r) => r.vci);
[["True to top value", "Random responder"], ["Random responder", "Flip-flopper (keeps)"],
 ["Convert (keeps)", "Random responder"], ["Convert (keeps)", "Flip-flopper (keeps)"],
 ["Convert (keeps)", "Performance chaser"]].forEach(([a, b]) =>
  console.log("  " + `${a} > ${b}`.padEnd(52) + pct(auc(V(a), V(b)))));

console.log("\n3. BLIND PICKING — one option at random from every menu, no reflection\n");
{
  let sum = 0, n = 0;
  for (const p of starts) for (const s of BLOCK5_SCENARIOS.filter(scenarioIsScored)) {
    for (const o of labelOptions(s.options, p)) { sum += scenarioVciScore(o.level, s.options.length); n++; }
  }
  console.log(`  expected VCI ${(100 * sum / n).toFixed(1)}`);
}

console.log("\n4. DO THE FIT NUMBERS AGREE WITH THE WEIGHTS?\n");
{
  /* closeness = 1 - (shortfall - best shortfall) / (worst shortfall - best shortfall), averaged over
     every option carrying each label, on the starting profiles and scenarios 1-4. */
  const L = ["aligned", "weakly_aligned", "misaligned", "strongly_misaligned"];
  const sum = Object.fromEntries(L.map((l) => [l, 0])), cnt = Object.fromEntries(L.map((l) => [l, 0]));
  for (const p of starts) for (const s of BLOCK5_SCENARIOS.filter(scenarioIsScored)) {
    const r = labelOptions(s.options, p);
    const best = r[0].matchShortfall, worst = r[r.length - 1].matchShortfall;
    for (const o of r) { sum[o.level] += worst - best > 1e-9 ? 1 - (o.matchShortfall - best) / (worst - best) : 1; cnt[o.level]++; }
  }
  console.log("  label                  rule weight   measured closeness");
  for (const l of L) console.log("  " + l.padEnd(22) + labelWeight(l).toFixed(2).padStart(11) + (sum[l] / cnt[l]).toFixed(2).padStart(21));
}

console.log("\n5. NEAR-TIES — label boundaries decided by under 3 points of fit (on the starting profiles)\n");
{
  const edges = { 1: ["Aligned | Weakly", 0, 0], 2: ["Weakly | Misaligned", 0, 0], 4: ["Misaligned | Strongly", 0, 0] };
  for (const p of starts) for (const s of BLOCK5_SCENARIOS.filter(scenarioIsScored)) {
    const r = labelOptions(s.options, p);
    for (const i of [1, 2, 4]) { edges[i][1]++; if (r[i].matchShortfall - r[i - 1].matchShortfall < 3) edges[i][2]++; }
  }
  for (const i of [1, 2, 4]) console.log("  " + edges[i][0].padEnd(24) + pct(edges[i][2] / edges[i][1]));
}

console.log("\n6. THE APA ROUTE — what relabeling on the moved profile WOULD give (VCI does not do it)\n");
for (const b of ["Flip-flopper (keeps)", "Flip-flopper (via APA)", "Convert (via APA)", "Random responder"]) {
  const m = (f) => (RES[b].reduce((a, r) => a + f(r), 0) / RES[b].length).toFixed(0);
  console.log("  " + b.padEnd(24) + `judged at entry ${m((r) => r.vci)}   relabeled ${m((r) => r.relabeled)}`);
}

console.log("\n7. HOW FAST A CHANGE OF HEART IS LEARNED\n");
{
  seed = 4242;
  let top = 0, n = 0;
  for (const start of starts) {
    const r = labelOptions(BLOCK5_SCENARIOS[0].options, start);
    const o = pickR(r.filter((x) => !isFit(x.level)));
    const after = applyEndorsementUpdates(start, o, true, false, null, 1);
    n++; if (topOf(after) === optionMainValue(o)) top++;
  }
  console.log(`  one strong endorsement in scenario 1 makes the endorsed value the top value in ${pct(top / n)} of profiles`);
}
console.log("");
