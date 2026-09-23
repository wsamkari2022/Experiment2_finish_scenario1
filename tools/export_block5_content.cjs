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
const { getCVRStory, pickWhoVariant } = B("block5CVRContent.js");

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
  options: s.options.map((o, oi) => {
    const hasReflection = Boolean(o.cvrSeed);
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
      views: hasReflection ? [view(s, o, "directness"), view(s, o, "context")] : [],
    };
  }),
}));

const target = process.argv[2] ?? path.join(ROOT, "block5_content.json");
fs.writeFileSync(target, JSON.stringify(out, null, 1));
console.log(`written: ${target}`);
console.log(`${out.length} scenarios, ${out.reduce((a, s) => a + s.options.length, 0)} options, `
  + `${out.reduce((a, s) => a + s.options.reduce((b, o) => b + o.views.length, 0), 0)} reflection views`);
