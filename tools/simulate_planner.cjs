/**
 * simulate_planner.cjs — the authoring gate for Block 5's option payoffs.
 *
 * WHAT THIS IS FOR
 * ----------------
 * The planner's job is to put the six option cards in an order that DEPENDS ON WHO THE
 * PARTICIPANT IS. It can only do that if the option payoffs actually discriminate. If every
 * plausible participant gets the same order, the ordering carries no information; if the order the
 * planner produces is usually the order alignment already produced, then "chose rank 1" and "chose
 * the aligned option" are the same event and neither can be interpreted.
 *
 * This script answers those questions with numbers, by running the REAL plannerRank and the REAL
 * labelOptions over the REAL scenarios. It imports the compiled modules rather than
 * re-implementing anything — a simulator carrying its own copy of the maths drifts from the code
 * and then lies.
 *
 * TWO SWEEPS, DO NOT CONFUSE THEM
 * -------------------------------
 *   AUTHORING (this file, offline). Many synthetic participants, spanning the range of people who
 *   might arrive. These are NOT planner defaults and no real participant is ever scored with them.
 *   They exist to ask a question about the SCENARIO CONTENT, not about any individual.
 *
 *   RUNTIME (the live app). Exactly one profile: the participant's own, derived from their Blocks
 *   1–3 ladder answers by block5Thresholds.ts. No sweep, no grid, nothing assumed.
 *
 * Run: npm run validate:planner
 */
const path = require("node:path");
const fs = require("node:fs");

const BUILD = path.join(__dirname, "..", ".sim-build");
if (!fs.existsSync(BUILD)) {
  console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
/* package.json says "type": "module", so tsc's CommonJS output would be read as ESM. Scope it back. */
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const B = (f) => require(path.join(BUILD, f));

const { plannerRank } = B("block5Planner.js");
const { labelOptions } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { POLICY_DIM_KEYS, METRIC_KEYS } = B("block5Types.js");

const SHORT = {
  vulnerabilityProtectionSensitivity: "vulnerable",
  groupSizeSensitivity: "harm",
  gainResponsivenessSensitivity: "gain",
  outcomeAggregationSensitivity: "help",
};
const ALL_KEYS = [
  ...POLICY_DIM_KEYS,
  "directnessSensitivity",
  "contextSensitivity",
  "stakeholderPerspectiveShiftSensitivity",
];

/* ------------------------------------------------------------------ *
 * Synthetic participants
 * ------------------------------------------------------------------ */

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).forEach((rest) => out.push([x, ...rest]));
  });
  return out;
}
const ORDERS = permutations(POLICY_DIM_KEYS);

/** Scores spread far enough apart that "top value" and "second value" are never ambiguous. */
const SCORE_SPREAD = [80, 65, 50, 35];

/**
 * Three strictness archetypes, standing in for the range of ladder behaviour a real sample
 * produces. Each is expressed the way block5Thresholds.ts would have derived it:
 *
 *   lenient  — named a price everywhere, demanded little extra when the target got harder.
 *   moderate — refused outright on their top value; a modest premium elsewhere.
 *   strict   — refused on their top two; a large premium.
 *
 * `tolerance` is the instrument's own resolution (1/6 for the Block 3 ladder, 1/8 for Blocks 1-2);
 * both are represented so the gate is not passed by one convenient band width.
 */
const ARCHETYPES = [
  { name: "lenient", redLines: [], exchange: 1, tolerance: 1 / 8 },
  { name: "moderate", redLines: ["vulnerabilityProtectionSensitivity"], exchange: 2, tolerance: 1 / 6 },
  { name: "strict", redLines: ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity"], exchange: 4, tolerance: 1 / 6 },
];

/**
 * Red lines are named explicitly rather than assigned to "the top N values", because
 * block5Thresholds.ts can only ever produce them on the two "who gets hurt" values. Refusing every
 * rung on gain or help is not a line about gain or help — it lands as a ZERO on those dimensions.
 * A sweep that put red lines on whichever value happened to rank first would be testing a
 * participant the derivation cannot generate.
 */
function makeDecisionProfile(order, arch) {
  const thresholds = {};
  order.forEach((key, i) => {
    thresholds[key] = {
      hasRedLine: arch.redLines.includes(key),
      strictness: 1 - i * 0.2,
      tolerance: arch.tolerance,
      exchange: arch.exchange,
      source: `synthetic:${arch.name}`,
    };
  });
  return { order, thresholds, degraded: false };
}

/** The Block5UserProfile shape that labelOptions() consumes, matching the same value ranking. */
function makeUserProfile(order) {
  const scores = {};
  order.forEach((k, i) => { scores[k] = SCORE_SPREAD[i]; });
  const dimensions = ALL_KEYS.map((key) => {
    const policyRank = order.indexOf(key);
    const rank = policyRank >= 0 ? policyRank + 1 : 5 + ALL_KEYS.indexOf(key) - POLICY_DIM_KEYS.length;
    return { key, label: key, score: scores[key] ?? 50, rank, weight: 1 / 7, sourceBlocks: [] };
  });
  const sorted = [...dimensions].sort((a, b) => a.rank - b.rank);
  return {
    generatedAt: "sim",
    dimensions,
    topThreeKeys: sorted.slice(0, 3).map((d) => d.key),
    topSensitivityKey: sorted[0].key,
  };
}

/* ------------------------------------------------------------------ *
 * Structural checks that do not depend on a participant
 * ------------------------------------------------------------------ */

function normalise(options, key, from) {
  const vals = options.map((o) => (from === "fp" ? o.fingerprint[key] : o.metrics[key]));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  return vals.map((v) => (hi === lo ? 0.5 : (v - lo) / (hi - lo)));
}

/** No option may be worse than another on all four values AND all five metrics. */
function dominatedPairs(options) {
  const bad = [];
  for (const a of options) {
    for (const b of options) {
      if (a === b) continue;
      const fpWorse = POLICY_DIM_KEYS.every((k) => b.fingerprint[k] >= a.fingerprint[k]);
      const mWorse = METRIC_KEYS.every((k) => b.metrics[k] >= a.metrics[k]);
      const strict = POLICY_DIM_KEYS.some((k) => b.fingerprint[k] > a.fingerprint[k])
        || METRIC_KEYS.some((k) => b.metrics[k] > a.metrics[k]);
      if (fpWorse && mWorse && strict) bad.push(`${a.id} < ${b.id}`);
    }
  }
  return bad;
}

/**
 * The six planner slots. Each must be filled by a DISTINCT option, or the option set does not span
 * the space the planner sorts over and it cannot produce many different orders.
 */
function slotReport(options) {
  const champ = (k) => options.reduce((a, b) => (b.fingerprint[k] > a.fingerprint[k] ? b : a));
  const perfSum = (o) => o.metrics.speed + o.metrics.resourceUse + o.metrics.reliability;
  const star = options.reduce((a, b) => (perfSum(b) > perfSum(a) ? b : a));
  const slots = {
    "3 vulnerable-protector": champ("vulnerabilityProtectionSensitivity").id,
    "5 harm-minimiser": champ("groupSizeSensitivity").id,
    "2 tempting-breach": champ("gainResponsivenessSensitivity").id,
    "4 helper": champ("outcomeAggregationSensitivity").id,
    "6 performance-star": star.id,
  };
  const used = new Set(Object.values(slots));
  const spare = options.filter((o) => !used.has(o.id)).map((o) => o.id);

  // A tempting breach must ALSO be the worst on harm or vulnerable, or it tempts nobody.
  const gainChamp = champ("gainResponsivenessSensitivity");
  const worst = (k) => options.reduce((a, b) => (b.fingerprint[k] < a.fingerprint[k] ? b : a)).id;
  const breachValid = gainChamp.id === worst("vulnerabilityProtectionSensitivity")
    || gainChamp.id === worst("groupSizeSensitivity");

  return { slots, distinct: used.size, spare, breachValid };
}

/**
 * The "small gain, big loss" pair — the tension the whole design rests on. There must exist a pair
 * whose gap on the top value is inside the tolerance band while the gap on the second value
 * exceeds the exchange premium. Without it the tree degenerates into a plain lexicographic sort.
 */
function hasSmallGainBigLossPair(options, order, arch) {
  const nTop = normalise(options, order[0], "fp");
  const nSecond = normalise(options, order[1], "fp");
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const dTop = Math.abs(nTop[i] - nTop[j]);
      const dSecond = Math.abs(nSecond[i] - nSecond[j]);
      if (dTop < arch.tolerance && dSecond > arch.exchange * dTop) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * The sweep
 * ------------------------------------------------------------------ */

const pad = (s, n) => String(s).padEnd(n);
const pct = (a, b) => `${Math.round((100 * a) / b)}%`;

let failures = 0;
const gate = (ok) => { if (!ok) failures++; return ok ? "PASS" : "FAIL"; };

console.log("\n" + "=".repeat(78));
console.log("  BLOCK 5 PLANNER — AUTHORING SWEEP");
console.log(`  ${ORDERS.length} value orderings x ${ARCHETYPES.length} strictness archetypes = ` +
            `${ORDERS.length * ARCHETYPES.length} synthetic participants per scenario`);
console.log("=".repeat(78));

const summary = [];

for (const scenario of BLOCK5_SCENARIOS) {
  const options = scenario.options;
  const orders = new Map();
  const topCount = {};
  const binTally = { clear: 0, costed: 0, blocked: 0 };
  let matchTop = 0;
  let sgblProfiles = 0;
  let ignoreLeafFired = 0;
  let total = 0;

  for (const order of ORDERS) {
    const userProfile = makeUserProfile(order);
    const aligned = labelOptions(options, userProfile);
    for (const arch of ARCHETYPES) {
      total++;
      const dp = makeDecisionProfile(order, arch);
      const r = plannerRank(scenario, dp);

      orders.set(r.orderedIds.join(">"), (orders.get(r.orderedIds.join(">")) ?? 0) + 1);
      topCount[r.orderedIds[0]] = (topCount[r.orderedIds[0]] ?? 0) + 1;
      if (aligned[0].id === r.orderedIds[0]) matchTop++;
      for (const id of r.orderedIds) binTally[r.byId[id].bin]++;
      if (r.orderedIds.some((id) => r.byId[id].ignoredTopValueAgainst.length > 0)) ignoreLeafFired++;
      if (hasSmallGainBigLossPair(options, order, arch)) sgblProfiles++;
    }
  }

  const dom = dominatedPairs(options);
  const slots = slotReport(options);
  const alwaysTop = Object.entries(topCount).filter(([, c]) => c === total).map(([k]) => k);
  const binSlots = binTally.clear + binTally.costed + binTally.blocked;

  const g = {
    distinctOrders: orders.size >= 6,
    confound: matchTop / total <= 0.5,
    noDominated: dom.length === 0,
    noDictator: alwaysTop.length === 0,
    blockedRate: binTally.blocked / binSlots >= 0.10 && binTally.blocked / binSlots <= 0.25,
    sgbl: sgblProfiles >= total / 2,
    slots: slots.distinct === 5 && slots.spare.length === 1 && slots.breachValid,
    ignoreLeaf: ignoreLeafFired > 0,
  };

  console.log(`\n${"-".repeat(78)}\n  ${scenario.id}   (${options.length} options)\n${"-".repeat(78)}`);
  console.log(`  [${gate(g.distinctOrders)}] distinct orders produced      ${pad(orders.size, 20)} need >= 6`);
  console.log(`  [${gate(g.confound)}] planner #1 == alignment #1    ${pad(`${matchTop}/${total} = ${pct(matchTop, total)}`, 20)} need <= 50%`);
  console.log(`  [${gate(g.ignoreLeaf)}] trade-off leaf ever fires     ${pad(`${ignoreLeafFired}/${total} profiles`, 20)} need > 0`);
  console.log(`  [${gate(g.sgbl)}] small-gain/big-loss pair      ${pad(`${sgblProfiles}/${total} profiles`, 20)} need >= half`);
  console.log(`  [${gate(g.noDominated)}] no dominated option           ${pad(dom.length ? dom.join("; ") : "none", 20)} need none`);
  console.log(`  [${gate(g.noDictator)}] no option #1 for everyone     ${pad(alwaysTop.length ? alwaysTop.join(",") : "none", 20)} need none`);
  console.log(`  [${gate(g.blockedRate)}] blocked-bin rate              ${pad(`${pct(binTally.blocked, binSlots)} of card slots`, 20)} need 10-25%`);
  console.log(`      bins: clear ${pct(binTally.clear, binSlots)} / costed ${pct(binTally.costed, binSlots)} / blocked ${pct(binTally.blocked, binSlots)}`);
  console.log(`  [${gate(g.slots)}] six slots, all distinct       ${pad(`${slots.distinct}/5 champions + ${slots.spare.length} spare`, 20)} need 5 + 1`);
  if (!slots.breachValid) {
    console.log(`      ! tempting breach invalid: the gain champion (${slots.slots["2 tempting-breach"]}) is`);
    console.log(`        not also the worst option on harm or on vulnerable, so it tempts nobody`);
  }
  if (slots.spare.length !== 1) {
    console.log(`      ! ${slots.spare.length} options carry no slot: ${slots.spare.join(", ")}`);
    const dupes = Object.entries(slots.slots).filter(([, id], i, a) => a.some(([, o], j) => o === id && j !== i));
    if (dupes.length) console.log(`      ! slot collision: ${dupes.map(([s, id]) => `${s}=${id}`).join("  ")}`);
  }
  console.log(`      distinct #1 options: ${Object.entries(topCount).map(([k, c]) => `${k.replace(/^[a-z]+_/, "")}:${c}`).join("  ")}`);

  summary.push({ id: scenario.id, orders: orders.size, confound: pct(matchTop, total),
                 blocked: pct(binTally.blocked, binSlots), slots: `${slots.distinct}+${slots.spare.length}` });
}

/* ------------------------------------------------------------------ *
 * Determinism + non-transitivity, on the real scenarios
 * ------------------------------------------------------------------ */

console.log(`\n${"=".repeat(78)}\n  INVARIANTS\n${"=".repeat(78)}`);

const dp = makeDecisionProfile(ORDERS[0], ARCHETYPES[1]);
const first = plannerRank(BLOCK5_SCENARIOS[0], dp).orderedIds.join(">");
let stable = true;
for (let i = 0; i < 100; i++) {
  if (plannerRank(BLOCK5_SCENARIOS[0], dp).orderedIds.join(">") !== first) stable = false;
}
console.log(`  [${gate(stable)}] deterministic: identical output across 100 runs`);

/* Every option must be reachable — rank 1 for at least one synthetic participant somewhere, or it
   is dead weight on the card stack and can never be chosen for a defensible reason. */
let unreachable = [];
for (const scenario of BLOCK5_SCENARIOS) {
  const seen = new Set();
  for (const order of ORDERS) {
    for (const arch of ARCHETYPES) {
      seen.add(plannerRank(scenario, makeDecisionProfile(order, arch)).orderedIds[0]);
    }
  }
  for (const o of scenario.options) {
    if (!seen.has(o.id)) unreachable.push(`${scenario.id}/${o.id}`);
  }
}
console.log(`  [${gate(unreachable.length === 0)}] every option reaches rank 1 for some profile` +
            (unreachable.length ? `\n      never #1: ${unreachable.join(", ")}` : ""));

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

console.log(`\n${"=".repeat(78)}\n  SUMMARY\n${"=".repeat(78)}`);
console.log(`  ${pad("scenario", 32)}${pad("orders", 9)}${pad("confound", 11)}${pad("blocked", 10)}slots`);
for (const s of summary) {
  console.log(`  ${pad(s.id, 32)}${pad(s.orders, 9)}${pad(s.confound, 11)}${pad(s.blocked, 10)}${s.slots}`);
}
console.log(`\n  ${failures === 0 ? "ALL GATES PASS" : `${failures} GATE FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
