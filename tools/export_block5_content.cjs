/*
 * export_block5_content.cjs — every word of Block 5, as JSON, for the Word export.
 *
 * WHY IT EXISTS. The option cards, the two reflection views and the two people who speak
 * afterwards are assembled at run time from several modules. Reading them means walking the study
 * scenario by scenario in a browser. This writes the whole set out in one pass, from the same
 * compiled modules the study itself runs, so a document built from it cannot quietly drift from
 * what participants actually see.
 *
 * WHAT IT DOES NOT DO. It does not interpret anything. Fill tokens like {a|forty} are flattened to
 * the words a participant reads, and nothing else is changed.
 *
 * Run:  node tools/export_block5_content.cjs [outfile.json]
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
const { getCVRStory, pickWhoVariant, getCVRValueHere } = B("block5CVRContent.js");
/* Performance, added 27 September 2026 (the researcher asked for every option's performance numbers in the Word
   export). Everything comes from the functions the cards themselves call: the five numbers, each one's place
   among the scenario's options (metricStandings), the overall place and its 0-100 captured score
   (overallStanding), and the three chips the card prints (explainOption). The chips do not depend on the
   participant, so any decision profile gives the same ones; a neutral one is used. */
const { METRIC_KEYS, METRIC_LABELS, metricMeaning, POLICY_DIM_KEYS } = B("block5Types.js");
const { metricStandings, overallStanding, rawComposite } = B("block5Performance.js");
const { scenarioShowsPerformance } = B("block5CVR.js");
const { plannerRank } = B("block5Planner.js");
const { explainOption } = B("block5PlannerText.js");
const NEUTRAL = {
  order: [...POLICY_DIM_KEYS],
  thresholds: Object.fromEntries(POLICY_DIM_KEYS.map((k) => [k, {
    hasRedLine: false, strictness: 0.5, tolerance: 0.15, floor: 0.15, exchange: 2, source: "export",
  }])),
  degraded: false,
};
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] ?? "th"}`;

function performanceOf(scenario, option, plan) {
  if (!scenarioShowsPerformance(scenario)) return null;
  const standings = metricStandings(scenario, option);
  const overall = overallStanding(scenario, option);
  return {
    measures: standings.map((m) => ({
      key: m.key, label: METRIC_LABELS[m.key], score: m.score, place: `${ordinal(m.rank)} of ${m.total}`,
    })),
    overallMean: Math.round(rawComposite(option) * 10) / 10,
    overallPlace: `${ordinal(overall.rank)} of ${overall.total}`,
    captured: overall.captured,
    chips: explainOption(scenario, plan, NEUTRAL, option.id).chips,
  };
}

/** The participant reads the words, not the markup. */
const flat = (s) => String(s ?? "").replace(/\{[avwbf]\|([^{}]*)\}/g, "$1").trim();

/** One reflection view, as it appears on the page. */
function view(scenario, option, framing) {
  const story = getCVRStory(
    scenario, option,
    { framing, who: "system", violatedKey: "vulnerabilityProtectionSensitivity" },
    pickWhoVariant(scenario, "system"),
  );
  return {
    framing,
    heading: flat(story.lens.heading),
    body: flat(story.lens.body),
    points: (story.lens.points ?? []).map((p) => ({ label: flat(p.label), text: flat(p.text) })),
    closing: flat(story.lens.closing),
    question: flat(story.reendorseQuestion),
    hurt: flat(story.people.hurt),
    need: flat(story.people.need),
  };
}

const out = BLOCK5_SCENARIOS.map((s, si) => ({
  number: si + 1,
  id: s.id,
  title: s.title ?? "",
  decisionRole: s.decisionRole ?? "decider",
  stakePosition: s.stakePosition ?? null,
  methodLabel: s.methodLabel ?? null,
  scene: flat(s.description),
  situation: flat(s.factBase),
  role: flat(s.role),
  showsPerformance: scenarioShowsPerformance(s),
  /* What each of the four values means in THIS scenario, as the "Your values in this scenario" panel says it
     (getCVRValueHere). null for scenario 6, on purpose: its four options are the four values. */
  valueMeanings: (() => {
    const here = getCVRValueHere(s);
    if (!here) return null;
    const NAME = { vulnerabilityProtectionSensitivity: "Protecting the vulnerable", groupSizeSensitivity: "Reducing harm",
      gainResponsivenessSensitivity: "How much is gained", outcomeAggregationSensitivity: "How many are helped" };
    return POLICY_DIM_KEYS.map((k) => ({ value: NAME[k], meaning: flat(here[k]) }));
  })(),
  /* What each of the five measures means in THIS scenario, as the performance panel explains it. */
  measureMeanings: METRIC_KEYS.map((k) => ({ key: k, label: METRIC_LABELS[k], meaning: metricMeaning(k, s.id) })),
  options: s.options.map((o, oi) => {
    const hasReflection = Boolean(o.cvrSeed);
    const plan = plannerRank(s, NEUTRAL);
    return {
      number: oi + 1,
      id: o.id,
      title: flat(o.title),
      summary: flat(o.summary),
      method: o.method ? flat(o.method.by) + (o.method.detail ? " — " + flat(o.method.detail) : "") : null,
      gains: flat(o.gains),
      givesUp: flat(o.givesUp),
      moralTension: flat(o.moralTension),
      values: {
        "Protecting the vulnerable": o.fingerprint.vulnerabilityProtectionSensitivity,
        "Reducing harm": o.fingerprint.groupSizeSensitivity,
        "How much is gained": o.fingerprint.gainResponsivenessSensitivity,
        "How many are helped": o.fingerprint.outcomeAggregationSensitivity,
      },
      performance: performanceOf(s, o, plan),
      views: hasReflection ? [view(s, o, "directness"), view(s, o, "context")] : [],
    };
  }),
}));

const target = process.argv[2] ?? path.join(ROOT, "block5_content.json");
fs.writeFileSync(target, JSON.stringify(out, null, 1));
console.log(`written: ${target}`);
console.log(`${out.length} scenarios, ${out.reduce((a, s) => a + s.options.length, 0)} options, `
  + `${out.reduce((a, s) => a + s.options.reduce((b, o) => b + o.views.length, 0), 0)} reflection views`);
