/**
 * validate_block5_metrics.mjs — guards the separation between what an OPTION achieves and what
 * the PARTICIPANT values.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The original eight performance metrics were authored as a mirror of the option fingerprints.
 * "Vulnerable Protection" correlated r = 0.98 with the vulnerability-protection VALUE; overall
 * performance correlated r = 0.81 with the participant's own profile, so choosing your values
 * cost nothing. Nothing caught it, because validate_block5.cjs never looked at metrics at all.
 * These gates are that missing check.
 *
 * Run: npm run validate:block5   (chained after the scenario validator)
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src/experiment/block5Scenarios.ts");
const s = fs.readFileSync(SRC, "utf8");

const MK = ["speed", "resourceUse", "reliability", "durability", "reversibility"];
const POL = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
             "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const ALL7 = [...POL, "directnessSensitivity", "contextSensitivity",
              "stakeholderPerspectiveShiftSensitivity"];
const SH = { vulnerabilityProtectionSensitivity: "Vulnerability", groupSizeSensitivity: "Group size",
             gainResponsivenessSensitivity: "Gain", outcomeAggregationSensitivity: "Outcome",
             directnessSensitivity: "Directness", contextSensitivity: "Context",
             stakeholderPerspectiveShiftSensitivity: "Stakeholder" };
const SCEN = ["travel_mode_choice", "meal_hosting_choice", "cancer_treatment_allocation",
              "flood_evacuation_priority", "water_contamination_response"];

/* ---------------- parse ---------------- */
const bounds = SCEN.map((id) => ({ id, at: s.indexOf(`id: "${id}"`) }));
bounds.push({ id: "END", at: s.length });
const scenarioAt = (i) => {
  for (let k = 0; k < bounds.length - 1; k++) if (i >= bounds[k].at && i < bounds[k + 1].at) return bounds[k].id;
  return "?";
};
const nums = (t) => Object.fromEntries([...t.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], +m[2]]));
const titleOf = (seg) => (/title:\s*"((?:[^"\\]|\\.)*)"/.exec(seg) ?? [, ""])[1];

const marks = [...s.matchAll(/\{\s*id: "([a-z0-9_]+)",\s*cvrSeed/g)];
const rows = marks.map((m, i) => {
  const seg = s.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : s.length);
  const fp = /fingerprint: \{([\s\S]*?)\}/.exec(seg);
  const me = /metrics: \{([\s\S]*?)\}/.exec(seg);
  return {
    id: m[1], scenario: scenarioAt(m.index), title: titleOf(seg),
    fp: fp ? nums(fp[1]) : null, m: me ? nums(me[1]) : null,
  };
});

/* ---------------- stats ---------------- */
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let sn = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; sn += x * y; da += x * x; db += y * y; }
  return da && db ? sn / Math.sqrt(da * db) : 0;
};
const col = (k) => rows.map((r) => r.m[k]);
const perf = (r) => mean(MK.map((k) => r.m[k]));
const inScenario = (sc) => rows.filter((r) => r.scenario === sc);

let fails = 0;
const gate = (ok, id, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(4)} ${msg}`);
  if (!ok) fails++;
};
const head = (t) => console.log(`\n${t}\n${"-".repeat(t.length)}`);

console.log("\n=== BLOCK 5 PERFORMANCE-METRIC GATES ===");

/* G1 — completeness */
head("G1  every option carries all five metrics as integers 0-100");
const bad = rows.filter((r) => !r.m || MK.some((k) => !Number.isInteger(r.m[k]) || r.m[k] < 0 || r.m[k] > 100));
gate(rows.length === 30 && bad.length === 0, "G1",
  `${rows.length} options parsed, ${bad.length} malformed${bad.length ? ": " + bad.map((b) => b.id).join(", ") : ""}`);
if (bad.length || rows.length !== 30) { console.log("\n### CANNOT CONTINUE ###"); process.exit(1); }

/* G2 — discriminates inside a scenario */
head("G2  each metric separates the six options: within-scenario range >= 30 in >= 4 of 5 scenarios");
MK.forEach((k) => {
  const ranges = SCEN.map((sc) => {
    const v = inScenario(sc).map((r) => r.m[k]);
    return Math.max(...v) - Math.min(...v);
  });
  gate(ranges.filter((r) => r >= 30).length >= 4, "G2", `${k.padEnd(14)} ranges ${ranges.join(", ")}`);
});

/* G3 — no metric restates a value */
head("G3  no metric may restate a participant value: |r| < 0.85   (the old set hit 0.98)");
let worst = 0, worstLbl = "";
MK.forEach((k) => ALL7.forEach((p) => {
  const r = corr(col(k), rows.map((x) => x.fp[p]));
  if (Math.abs(r) > Math.abs(worst)) { worst = r; worstLbl = `${k} x ${SH[p]}`; }
}));
gate(Math.abs(worst) < 0.85, "G3", `strongest metric-value link: ${worstLbl} r = ${worst.toFixed(2)}`);

/* G4 — the metrics are distinct from each other */
head("G4  the five metrics must be distinct from each other: |r| < 0.70");
let w4 = 0, l4 = "";
for (let i = 0; i < MK.length; i++) for (let j = i + 1; j < MK.length; j++) {
  const r = corr(col(MK[i]), col(MK[j]));
  if (Math.abs(r) > Math.abs(w4)) { w4 = r; l4 = `${MK[i]} x ${MK[j]}`; }
}
gate(Math.abs(w4) < 0.70, "G4", `strongest metric-metric link: ${l4} r = ${w4.toFixed(2)}`);

/* G5 — the thesis-critical trade-off */
head("G5  protecting the vulnerable must COST performance, in every scenario");
console.log("      This is the dimension the whole dissertation turns on. If the option that best");
console.log("      protects the vulnerable is also the best performer, the participant is never");
console.log("      asked to give anything up, and their Block 5 data says nothing.");
SCEN.forEach((sc) => {
  const g = inScenario(sc);
  const champ = g.reduce((a, b) => (b.fp.vulnerabilityProtectionSensitivity > a.fp.vulnerabilityProtectionSensitivity ? b : a));
  const rank = [...g].sort((a, b) => perf(b) - perf(a)).findIndex((r) => r.id === champ.id) + 1;
  gate(rank >= 3, "G5", `${sc.padEnd(30)} "${champ.title.slice(0, 32)}" ranks ${rank}/6 on performance`);
});
SCEN.forEach((sc) => {
  const g = inScenario(sc);
  const r = corr(g.map((x) => x.fp.vulnerabilityProtectionSensitivity), g.map(perf));
  gate(r < 0.30, "G5", `${sc.padEnd(30)} vulnerability x performance r = ${r.toFixed(2)}`);
});

/* G5b — no value may be systematically rewarded */
head("G5b no value may be rewarded to the point of dominance: champion ranks 1st in <= 2 of 5");
POL.forEach((p) => {
  const ranks = SCEN.map((sc) => {
    const g = inScenario(sc);
    const champ = g.reduce((a, b) => (b.fp[p] > a.fp[p] ? b : a));
    return [...g].sort((a, b) => perf(b) - perf(a)).findIndex((r) => r.id === champ.id) + 1;
  });
  const firsts = ranks.filter((r) => r === 1).length;
  gate(firsts <= 2, "G5b", `${SH[p].padEnd(13)} champion ranks ${ranks.join(" ")}  — 1st in ${firsts}/5`);
});

/* G6 — six distinguishable options, none obviously best */
head("G6  six distinguishable options, none obviously best");
SCEN.forEach((sc) => {
  const g = inScenario(sc);
  let closest = 999, pair = "";
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const d = mean(MK.map((k) => Math.abs(g[i].m[k] - g[j].m[k])));
    if (d < closest) { closest = d; pair = `${g[i].id} / ${g[j].id}`; }
  }
  gate(closest >= 10, "G6", `${sc.padEnd(30)} closest profiles differ by ${closest.toFixed(1)} pts (${pair})`);
});
SCEN.forEach((sc) => {
  const g = inScenario(sc);
  const leads = new Set(MK.map((k) => g.reduce((a, b) => (b.m[k] > a.m[k] ? b : a)).id));
  gate(leads.size >= 4, "G6", `${sc.padEnd(30)} ${leads.size}/6 options lead on at least one metric`);
});
SCEN.forEach((sc) => {
  const p = inScenario(sc).map(perf).sort((a, b) => b - a);
  gate(p[0] - p[1] <= 8, "G6", `${sc.padEnd(30)} top performer beats 2nd by ${(p[0] - p[1]).toFixed(1)} pts`);
});

/* G7 — no systematically easy or hard metric */
head("G7  no metric systematically easy or hard: grand mean within 50-80");
MK.forEach((k) => {
  const m = mean(col(k));
  gate(m >= 50 && m <= 80, "G7", `${k.padEnd(14)} grand mean ${m.toFixed(1)}`);
});

console.log("\n" + "=".repeat(72));
console.log(fails === 0 ? "### ALL METRIC GATES PASSED ###" : `### ${fails} METRIC GATE FAILURE(S) ###`);
console.log("=".repeat(72) + "\n");
process.exit(fails ? 1 : 0);
