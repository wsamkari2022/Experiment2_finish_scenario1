#!/usr/bin/env node
/**
 * export_option_numbers.cjs — every option's numbers, exactly as the launch code holds them (17 November 2026).
 *
 * The analysis (analysis/) needs each option's four values and five performance numbers, and the few fixed numbers
 * of the formulas (the menu label rule, the prediction's two temperatures). They were not saved beside the freeze
 * note at launch, but `src/` has not changed since the launch tag `deploy-v9`, so the compiled code gives them
 * exactly. This tool refuses to write anything if `src/` differs from `deploy-v9`, and stamps the file with the tag
 * and the commit it was made from.
 *
 * Run: node tools/export_option_numbers.cjs analysis/option_numbers_deploy-v9.json
 */
"use strict";
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const out = process.argv[2];
if (!out) { console.error("  Usage: node tools/export_option_numbers.cjs <file.json>"); process.exit(1); }

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const changed = git("diff", "--name-only", "deploy-v9", "--", "src");
if (changed) {
  console.error("  src/ differs from the launch tag deploy-v9, so these would not be the launch numbers:\n" + changed);
  process.exit(1);
}
try { execFileSync("npx", ["tsc", "-p", "tools/tsconfig.sim.json"], { cwd: ROOT, encoding: "utf8", shell: true }); } catch { /* checked below */ }
const BUILD = path.join(ROOT, ".sim-build");
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const B = (f) => require(path.join(BUILD, f));
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const CVR = B("block5CVR.js");
const { ALIGNMENT_RANK_RULE } = B("block5Types.js");
const { METRIC_KEYS } = B("block5Types.js");
const predictionSource = fs.readFileSync(path.join(ROOT, "src", "experiment", "block5Prediction.ts"), "utf8");
const temp = (name) => Number((new RegExp(`const ${name} = ([0-9.]+)`).exec(predictionSource) ?? [])[1]);

const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
  "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const metricKeys = METRIC_KEYS ?? Object.keys(BLOCK5_SCENARIOS[0].options[0].metrics);
const file = {
  what_this_is: "Every Block 5 option's four values and five performance numbers, as the launch code (deploy-v9) holds them. "
    + "Made by tools/export_option_numbers.cjs from the compiled code; never edit by hand.",
  launch_tag: "deploy-v9",
  made_from_commit: git("rev-parse", "HEAD"),
  src_differs_from_launch_tag: false,
  policy_value_keys: POLICY,
  metric_keys: metricKeys,
  label_rule: { aligned_ranks: ALIGNMENT_RANK_RULE.aligned, weakly_aligned_ranks: ALIGNMENT_RANK_RULE.weaklyAligned,
    the_rest: "split in two, the first half (rounded up) Misaligned, the rest Strongly misaligned" },
  label_weights: Object.fromEntries([6, 4].map((n) => [n, Object.fromEntries(["aligned", "weakly_aligned", "misaligned", "strongly_misaligned"]
    .map((l) => [l, CVR.labelWeight(l, n)]))])),
  prediction_temperature_flat: temp("TEMPERATURE_FLAT"),
  prediction_temperature_sharp: temp("TEMPERATURE_SHARP"),
  scenarios: BLOCK5_SCENARIOS.map((s, i) => ({
    order: i + 1,
    id: s.id,
    title: s.title,
    decision_role: s.decisionRole ?? "decider",
    stake_position: s.stakePosition ?? null,
    stakes_weight: s.stakesWeight ?? 1,
    scored: CVR.scenarioIsScored(s),
    options: s.options.map((o) => ({
      id: o.id,
      title: o.title,
      values: Object.fromEntries(POLICY.map((k) => [k, o.fingerprint[k]])),
      metrics: Object.fromEntries(metricKeys.map((k) => [k, o.metrics[k]])),
      built_on: CVR.optionMainValue(o),
    })),
  })),
};
if (!Number.isFinite(file.prediction_temperature_flat) || !Number.isFinite(file.prediction_temperature_sharp)) {
  console.error("  The prediction's temperatures could not be read from block5Prediction.ts.");
  process.exit(1);
}
fs.writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
console.log(`  ${file.scenarios.length} scenarios, ${file.scenarios.reduce((a, s) => a + s.options.length, 0)} options written to ${out} (launch tag deploy-v9, commit ${file.made_from_commit.slice(0, 7)}).`);
