/* Prints the 60 stories exactly as the participant reads them on the person page. */
const { BLOCK5_SCENARIOS } = require("../.sim-build/block5Scenarios.js");
const { getCVRStory, pickWhoVariant } = require("../.sim-build/block5CVRContent.js");

const strip = (t) => t.replace(/\{[avwbf]\|([^}]*)\}/g, "$1");
function wrap(t, w) {
  const out = [];
  let line = "";
  for (const word of t.split(" ")) {
    if (line && (line + " " + word).length > w) { out.push(line); line = word; }
    else line = line ? line + " " + word : word;
  }
  if (line) out.push(line);
  return out.join("\n");
}

for (const sc of BLOCK5_SCENARIOS) {
  console.log("\n" + "#".repeat(90));
  console.log("# " + sc.title.toUpperCase());
  console.log("#".repeat(90));
  for (const op of sc.options) {
    const coord = { framing: "context", who: "close", violatedKey: "vulnerabilityProtection" };
    const story = getCVRStory(sc, op, coord, pickWhoVariant(sc, "close"));
    console.log("\n--- " + op.id + " ---");
    console.log("gives up : " + op.givesUp);
    console.log("\nHURTS:\n" + wrap(strip(story.people.hurt), 88));
    console.log("\nNEEDED IT:\n" + wrap(strip(story.people.need), 88));
  }
}
