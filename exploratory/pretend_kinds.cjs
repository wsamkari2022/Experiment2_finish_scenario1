#!/usr/bin/env node
/**
 * pretend_kinds.cjs: the pretend kinds of chooser in each condition, for exploratory Figure 2 (17 November 2026).
 *
 * The same pretend people and rules as docs/MAJOR_SCORES_BY_CONDITION.md (tools/condition_sim.cjs, principle A): 2,000
 * starting profiles x 12 kinds of chooser, through each condition's own update rules. Writes, per condition and kind, the
 * median and the quartiles of VCI, of Stability among those it measured, and of performance. PRETEND, never data.
 *
 * Run: node exploratory/pretend_kinds.cjs <out.json>   (needs .sim-build: npx tsc -p tools/tsconfig.sim.json)
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
/* tools/vci_distribution.cjs reads the number of pretend people from process.argv[2], so the output path is taken first
   and the command line emptied before it loads (otherwise the path is read as the number and gives none). */
const OUT = process.argv[2];
process.argv.length = 2;
const CS = require(path.join(__dirname, "..", "tools", "condition_sim.cjs"));
const SIM = require(path.join(__dirname, "..", "tools", "behavior_sim.cjs"));

const q = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  if (!s.length) return null;
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const out = { what_this_is: "PRETEND people (tools/condition_sim.cjs, principle A), never data", conditions: {} };
for (const run of CS.RUNS.filter((r) => !r.randomB && !r.principleB)) {
  out.conditions[run.condition] = {};
  for (const kind of SIM.KINDS) {
    const people = CS.measureRun(run, kind);
    const vci = people.map((p) => p.vci);
    const stab = people.filter((p) => p.measured).map((p) => p.stability);
    const perf = people.map((p) => p.performance);
    const summary = (a) => ({ n: a.length, q1: q(a, 0.25), median: q(a, 0.5), q3: q(a, 0.75) });
    out.conditions[run.condition][kind] = { vci: summary(vci), stability_measured: summary(stab), performance: summary(perf) };
  }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`  pretend kinds written: ${Object.keys(out.conditions).length} conditions x ${SIM.KINDS.length} kinds`);
