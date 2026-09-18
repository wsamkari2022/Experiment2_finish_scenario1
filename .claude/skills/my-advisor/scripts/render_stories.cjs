/*
 * render_stories.cjs — every Block 5 option printed the way the advisor has to read it:
 * the scene first, then each option's card, its lens, and both stakeholder stories.
 *
 * READ-ONLY. It builds nothing and writes nothing except a one-line package.json inside
 * .sim-build (so Node loads the compiled files as CommonJS).
 *
 * Run from the repo root, after compiling the study for Node:
 *   npx tsc -p tools/tsconfig.sim.json
 *   node .claude/skills/my-advisor/scripts/render_stories.cjs                 # every scenario
 *   node .claude/skills/my-advisor/scripts/render_stories.cjs cancer          # ids containing "cancer"
 *   node .claude/skills/my-advisor/scripts/render_stories.cjs --voices        # stories in all 3 voices
 *
 * Why the stories are printed next to the card: a story is only wrong in relation to something
 * else — its own card, its method, its lens, or the scene's clock. Printed alone, a wrong story
 * reads perfectly well.
 */
const path = require("path");
const fs = require("fs");

const BUILD = path.join(process.cwd(), ".sim-build");
if (!fs.existsSync(path.join(BUILD, "block5Scenarios.js"))) {
  console.error("No .sim-build found. Run first:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const { BLOCK5_SCENARIOS } = require(path.join(BUILD, "block5Scenarios.js"));
const { getCVRStory } = require(path.join(BUILD, "block5CVRContent.js"));

const args = process.argv.slice(2);
const allVoices = args.includes("--voices");
const only = args.find((a) => !a.startsWith("--"));
const strip = (s) => (s || "").replace(/\{[avfwb]\|([^{}]*)\}/g, "$1");
const VOICES = allVoices ? ["system", "group", "close"] : ["system"];

for (const S of BLOCK5_SCENARIOS) {
  if (only && !S.id.includes(only)) continue;
  const role = S.decisionRole ?? "decider";
  console.log("\n" + "#".repeat(100));
  console.log(S.id + "   (" + role + ")   " + (S.title || ""));
  console.log("#".repeat(100));
  console.log("SCENE      " + strip(S.description));
  console.log("SITUATION  " + strip(S.factBase));
  console.log("ROLE       " + strip(S.role));

  for (const o of S.options) {
    const seed = o.cvrSeed;
    console.log("\n  ── " + o.title + "   [" + o.id + "]");
    console.log("     SUMMARY    " + strip(o.summary));
    if (o.method) console.log("     METHOD     " + o.method.by + (o.method.detail ? " — " + o.method.detail : ""));
    console.log("     GAINS      " + strip(o.gains));
    if (o.consequence) console.log("     PREVIEW    " + strip(o.consequence));
    console.log("     GIVES UP   " + strip(o.givesUp));
    if (o.moralTension) console.log("     TENSION    " + strip(o.moralTension));
    if (!seed) { console.log("     (no cvrSeed — this option has no lens and no stakeholder stories)"); continue; }
    if (seed.act) console.log("     LENS ACT   " + strip(seed.act));
    if (seed.consequences) {
      console.log("     LENS SOON  " + strip(seed.consequences.soon));
      console.log("     LENS LATER " + strip(seed.consequences.later));
    }
    for (const who of VOICES) {
      const st = getCVRStory(S, o, { violatedKey: "vulnerabilityProtectionSensitivity", framing: "context", who },
        { lead: "", label: "" });
      const tag = allVoices ? " [" + who + "]" : "";
      console.log("   😟 HURT" + tag + "   " + strip(st.people.hurt));
      console.log("   🙂 NEED" + tag + "   " + strip(st.people.need));
    }
  }
}
