/**
 * step_scale_hook.cjs — run the REAL Block 5 code with every value step made bigger or smaller.
 *
 * WHY IT EXISTS (audit B3, 26 September 2026, the researcher's approval). The steps by which Block 5
 * moves a participant's values are hand-picked: +30 / -20 when a misaligned option is kept after the
 * reflection (+15 / -10 when kept less firmly), +30 / -10 when a value is named on the APA page, +20 /
 * -15 when a second-best option is kept, +/-25 for the stakeholder story, and the reflection-view step.
 * Nothing in the data derives them. The defensible answer is to show that the study's conclusions do
 * not depend on them: run everything again with every step at half size and at double size and see
 * whether what we claim still holds. tools/report_step_sensitivity.cjs does that; this file is the part
 * that changes the steps.
 *
 * HOW. Every step in block5CVR.ts goes through one function, `bump(p, key, delta, moves, why)`. When
 * Node loads the compiled `.sim-build/block5CVR.js`, this hook adds ONE line at the top of that function:
 * `delta = delta * factor(why)`. The study's source is never touched, nothing is written to disk, and
 * with every factor at 1 the code behaves exactly as shipped (the report checks that, person by person).
 * `why` is the sentence every step already carries, so each step is sorted into its family by it:
 *
 *   endorse      "kept a misaligned option: ..."          +30 / -20, or +15 / -10
 *   apa          "changed their mind: the value they named / a value they did not name"   +30 / -10
 *   keep         "kept a second-best option: ..."          +20 / -15
 *   stakeholder  "... the other person's story ..."       +/-25
 *   lens         "... the reflection view ..."             +/-20
 *
 * A step whose sentence fits no family STOPS the run: a renamed sentence must not slip past the scaling
 * unnoticed. Two ways to set the factors:
 *   in the same process:  require("./step_scale_hook.cjs").setScale({ apa: 2 })   (others stay 1)
 *   from outside:         STEP_SCALE="all=0.5" node -r ./tools/step_scale_hook.cjs tools/simulate_position.cjs
 *                         STEP_SCALE="apa=2,keep=0.5" ...
 * The hook must be loaded BEFORE anything loads block5CVR.js.
 */
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const TARGET = path.resolve(__dirname, "..", ".sim-build", "block5CVR.js");
const HEAD = 'function bump(p, key, delta, moves, why = "") {';
const FAMILIES = ["endorse", "apa", "keep", "stakeholder", "lens"];

let scale = Object.fromEntries(FAMILIES.map((f) => [f, 1]));
const calls = Object.fromEntries(FAMILIES.map((f) => [f, 0]));

function familyOf(why) {
  if (/story/.test(why)) return "stakeholder";
  if (/reflection view/.test(why)) return "lens";
  if (/second-best/.test(why)) return "keep";
  if (/misaligned/.test(why)) return "endorse";
  if (/changed their mind/.test(why)) return "apa";
  throw new Error(`step_scale_hook: a value step with an unknown reason "${why}" - add it to a family`);
}

function setScale(next) {
  const all = next.all ?? 1;
  scale = Object.fromEntries(FAMILIES.map((f) => [f, next[f] ?? all]));
}

globalThis.__stepScaleFactor = (why) => {
  const family = familyOf(why);
  calls[family]++;
  return scale[family];
};

if (process.env.STEP_SCALE) {
  setScale(Object.fromEntries(process.env.STEP_SCALE.split(",").map((pair) => {
    const [k, v] = pair.split("=");
    return [k.trim(), Number(v)];
  })));
}

const originalLoader = Module._extensions[".js"];
let patched = false;
Module._extensions[".js"] = function load(module, filename) {
  if (path.resolve(filename) !== TARGET) return originalLoader(module, filename);
  const src = fs.readFileSync(filename, "utf8");
  if (src.split(HEAD).length !== 2) {
    throw new Error("step_scale_hook: bump() in .sim-build/block5CVR.js no longer looks as expected - update HEAD");
  }
  patched = true;
  module._compile(src.replace(HEAD, `${HEAD}\n    delta = delta * globalThis.__stepScaleFactor(why);`), filename);
};

module.exports = {
  FAMILIES,
  setScale,
  familyOf,
  current: () => ({ ...scale }),
  callsByFamily: () => ({ ...calls }),
  wasPatched: () => patched,
};
