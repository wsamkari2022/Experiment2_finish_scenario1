/**
 * report_planner_overlap.cjs — how often the FIRST card is also the BEST-FIT card (24 September 2026).
 *
 * WHY. The planner exists so that "picked the first card" and "picked the option that fits their
 * values" are different events. If the first card were always the best fit, a choice of card 1 could
 * never be read either way. This report measures how often the two coincide, per scenario, using the
 * REAL code from start to finish: pretend participants answer Blocks 1-4, the real scoring builds
 * their profile, the real planner orders the cards, and the real fit score names the best fit.
 *
 * It replaces, for this question, tools/planner_vs_weighting.cjs, whose pretend participants were
 * given made-up value scores (20-100) instead of answering the questions. Those scores are less
 * clear-cut than real profiles and made the overlap look smaller (37-55 out of 100) than it is.
 *
 * TWO KINDS OF PRETEND PARTICIPANT
 *   steady  answers like a real person: one base answer per block, a small real preference or two
 *           (asking more before harming entry-level workers, or larger groups; needing more lives
 *           to push than to pull), and now and then one answer one step off. The details are in
 *           steadyAnswers() below; they are an assumption, stated so a reader can disagree with it.
 *   random  answers everything by chance, every answer and button equally likely - the same pretend
 *           participants the scoring tables are built on (regenerate_sensitivity_calibration.cjs).
 *
 * WHAT IT PRINTS, per scenario, out of 100 pretend participants:
 *   first card = best fit        the number the planner is meant to keep well below 100
 *   first card = best on #1      how often card 1 is simply the option best on their #1 value
 *   differ                       100 minus the first line: the cases that can tell position from fit
 *
 * Seeded, so it prints the same numbers every time. Reported, not gated: it is a property of the
 * scenario content to be watched, not a rule with a pass mark.
 *
 * Run: npm run report:planner-overlap
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

const { buildThresholdTree } = B("thresholdTree.js");
const { deriveMoralProfile } = B("profileAnalysis.js");
const { extractBlock5Profile } = B("block5Profile.js");
const { deriveDecisionProfile } = B("block5Thresholds.js");
const { labelOptions } = B("block5CVR.js");
const { plannerRank } = B("block5Planner.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const recipe = require("./regenerate_sensitivity_calibration.cjs");

const PEOPLE = 4000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Blocks 1-4 results in the exact shapes the blocks store, from plain answer numbers. */
function answersFrom(p) {
  const places = ["sidewalk", "wealthy", "shelter"];
  const history = [];
  const moneyThresholds = {};
  places.forEach((place, i) => {
    const stop = p.money[i];
    for (let step = 0; step < stop; step++) history.push({ contextKey: place, action: p.refusal[i] });
    moneyThresholds[`threshold_${place}`] = stop >= 8
      ? { contextKey: place, accepted: false, thresholdAmount: null, thresholdLabel: null, thresholdAmountIndex: null, thresholdBeyondRange: true }
      : { contextKey: place, accepted: true, thresholdAmount: 1, thresholdLabel: "x", thresholdAmountIndex: stop, thresholdBeyondRange: false };
  });
  const ladder = (v) => (v >= 8 ? { accepted: false, thresholdIndex: null } : { accepted: true, thresholdIndex: v });
  const cells = {};
  for (const [group, key, list] of [["low_buffer", "lowbuffer", p.entry], ["high_buffer", "highbuffer", p.senior]]) {
    ["small", "medium", "large"].forEach((size, i) => {
      cells[`threshold_${key}_${size}`] = {
        groupTypeKey: group, groupSizeKey: size, accepted: list[i] < 6,
        thresholdGainIndex: list[i] < 6 ? list[i] : null, blockedByPriorNonAcceptance: false,
      };
    });
  }
  return {
    money: { completed: true, completedAt: "report", thresholds: moneyThresholds, history },
    trolley: {
      completed: true, completedAt: "report", summary: {}, history: [],
      leverThreshold: { scenarioType: "lever", ...ladder(p.trolley[0]) },
      bridgeThreshold: { scenarioType: "bridge", ...ladder(p.trolley[1]) },
    },
    ai: { completed: true, completedAt: "report", thresholds: cells, history: [] },
    block4: p.block4,
  };
}

/** A pretend participant who answers like a real person. The assumption, in full. */
function steadyAnswers(rand) {
  const upTo = (n) => Math.floor(rand() * (n + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const wobble = () => (rand() < 0.25 ? pick([-1, 1]) : 0);          // now and then one step off
  const base = upTo(6);                                               // their usual Block 3 answer
  const entryExtra = pick([0, 0, 1, 1, 2]);                           // more before harming entry-level
  const sizeExtra = pick([0, 0, 1, 1, 2]);                            // more as the group grows
  const entry = [0, 1, 2].map((s) => clamp(base + entryExtra + Math.round((sizeExtra * s) / 2) + wobble(), 0, 6));
  const senior = [0, 1, 2].map((s) => clamp(base + Math.round((sizeExtra * s) / 2) + wobble(), 0, 6));
  const keep = upTo(8);                                               // Block 1: sidewalk, wealthy lower, shelter higher
  const lever = upTo(8);                                              // Block 2: pushing needs as many or more lives
  const initial = pick(["proceed", "do_not_proceed"]);
  const final = rand() < 0.15 ? (initial === "proceed" ? "do_not_proceed" : "proceed") : initial;
  return answersFrom({
    money: [keep, clamp(keep - pick([0, 0, 1]), 0, 8), clamp(keep + pick([0, 1, 2, 3]), 0, 8)],
    refusal: [pick(["return", "return", "donate"]), "return", pick(["return", "return", "donate"])],
    trolley: [lever, clamp(lever + pick([0, 1, 2]), 0, 8)],
    entry, senior,
    block4: {
      initialDecision: initial, midDecision: initial, finalDecision: final,
      confidence: 1 + upTo(4), initialConfidence: 1 + upTo(4), reportedInfluence: rand() < 0.5, influentialValence: null,
    },
  });
}

function measure(makeAnswers, seed) {
  const rand = recipe.seededRandom(seed);
  const people = [];
  for (let i = 0; i < PEOPLE; i++) {
    const a = makeAnswers(rand);
    const mp = deriveMoralProfile(a.money, a.trolley, a.ai);
    const profile = extractBlock5Profile(buildThresholdTree(mp, a.ai, a.block4));
    people.push({ profile, decision: deriveDecisionProfile(profile, mp) });
  }
  return BLOCK5_SCENARIOS.filter((s) => (s.decisionRole ?? "decider") !== "predicted").map((scenario) => {
    let bestFirst = 0, champFirst = 0;
    for (const { profile, decision } of people) {
      const plan = plannerRank(scenario, decision);
      if (labelOptions(scenario.options, profile)[0].id === plan.orderedIds[0]) bestFirst++;
      const top = decision.order[0];
      const champion = [...scenario.options].sort((a, b) => b.fingerprint[top] - a.fingerprint[top])[0].id;
      if (plan.orderedIds[0] === champion) champFirst++;
    }
    return {
      title: scenario.title,
      bestFirst: Math.round((100 * bestFirst) / PEOPLE),
      champFirst: Math.round((100 * champFirst) / PEOPLE),
    };
  });
}

const randomAnswers = (rand) => recipe.randomAnswers(rand);
const groups = [
  ["STEADY pretend participants (answer like a real person)", measure(steadyAnswers, 4242)],
  ["RANDOM pretend participants (answer everything by chance)", measure(randomAnswers, 99)],
];

console.log(`\n  How often the first card is also the best-fit card, out of 100 pretend participants (${PEOPLE} of each kind)`);
console.log("  Chance would be about 17 out of 100 (1 card in 6). 100 would mean first place and best fit can never be told apart.\n");
for (const [label, rows] of groups) {
  console.log(`  ${label}`);
  for (const r of rows) {
    console.log(`    ${r.title.padEnd(40)} first card = best fit ${String(r.bestFirst).padStart(3)}   `
      + `first card = best on their #1 value ${String(r.champFirst).padStart(3)}   differ ${String(100 - r.bestFirst).padStart(3)}`);
  }
  console.log("");
}
console.log("  Read the 'differ' column as the cases that can tell position from fit. Analyse choice position and fit");
console.log("  together (HOW_TO_ANALYZE_MY_DATA.md), never one as a stand-in for the other.\n");
