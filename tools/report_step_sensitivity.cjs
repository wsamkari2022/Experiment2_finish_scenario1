/**
 * report_step_sensitivity.cjs — do the study's conclusions depend on the hand-picked step sizes? (audit B3)
 *
 * THE QUESTION. Block 5 moves a participant's values in fixed steps (+30 / -20 after keeping a
 * misaligned option, +30 / -10 after naming a value on the APA page, +20 / -15 after keeping a second-best
 * option, +/-25 for the stakeholder story). The numbers were chosen by hand, and nothing in the data
 * derives them. A reviewer will ask: "would your results change if you had picked +15, or +60?"
 *
 * THE ANSWER THIS PRINTS. The same 2,000 pretend starting profiles and the same twelve kinds of chooser
 * as `npm run report:vci` and `report:stability` (tools/vci_distribution.cjs), run through the REAL code
 * eleven times: as shipped, with EVERY step at half size and at double size, and with each family of
 * steps alone at half and double. For each run it prints VCI, Stability, the end-of-study performance
 * (captured, 0-100) and the stakeholder stability of every kind, and checks a fixed list of conclusions
 * the method documents state. The steps are changed by tools/step_scale_hook.cjs, which multiplies the
 * one `bump()` every step goes through; the study's source is never touched.
 *
 * THE CONCLUSIONS CHECKED (written before the runs; the line for "clearly" is a separation of 0.75, i.e.
 * the first kind scores higher in at least 75 of 100 random pairings - a coin is 0.50):
 *   C1  VCI: people true to their top value score clearly above random choosers
 *   C2  VCI: random choosers score clearly above people who take up a new value every scenario
 *   C3  VCI: the order of the kinds holds - best fit > true to top value > random > flip-flopper > worst fit
 *   C4  Stability: picking the best fit or the second best never costs Stability (100): keep steps never count
 *   C5  Stability: people true to their top value score clearly above random choosers
 *   C6  Stability: flip-floppers (keeping) score below random choosers
 *   C7  Performance: the performance chaser scores 100, and following your top value costs performance
 *       (true to top value below random choosers) - the trade-off the study is built on
 * Not checked, only shown: the one-time convert against random choosers on Stability (audit G6, a known
 * limit: they sit close together at every step size).
 *
 * WHAT CANNOT CHANGE, AND WHY (so it is not re-measured here): the position effect is measured against the
 * profile the participant brought INTO Block 5, which the steps never touch (block5Position.ts), and the
 * card order is made from that same profile (block5Planner.ts). Step sizes can reach them only through
 * what a real participant chooses. `STEP_SCALE="all=2" node -r ./tools/step_scale_hook.cjs
 * tools/simulate_position.cjs` gives the same output as the shipped steps.
 *
 * SAFETY CHECKS BEFORE ANY NUMBER IS BELIEVED: the hook really patched the code; with every factor at 1
 * the VCI of every one of the 24,000 pretend people equals `report:vci`'s exactly; every family of steps
 * was actually used (a family never called would "pass" at any size and prove nothing).
 *
 * A report, not a gate: it prints and never fails the build. Seeded; the same numbers every run.
 * Run: npm run report:step-sensitivity        (about a minute)
 */
const HOOK = require("./step_scale_hook.cjs"); // must come before anything loads block5CVR.js
const { KINDS, POP, runPerson: run, measureAll: measure } = require("./behavior_sim.cjs"); // the shared simulation

if (!HOOK.wasPatched()) { console.error("  the step hook did not patch block5CVR.js - stopping"); process.exit(1); }

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sep = (a, b) => { let w = 0, t = 0; for (const x of a) for (const y of b) { if (x > y) w++; else if (x === y) t++; } return (w + t / 2) / (a.length * b.length); };
const col = (res, beh, k) => res[beh].map((r) => r[k]);

/* ---------------------------------------------------------------- safety checks */
HOOK.setScale({ all: 1 });
let mismatches = 0;
for (const beh of KINDS) {
  POP.reseed(777); const mine = POP.starts.map((s) => run(s, beh).vci);
  POP.reseed(777); const theirs = POP.starts.map((s) => POP.run(s, beh).vci);
  mismatches += mine.filter((v, i) => v !== theirs[i]).length;
}
const before = HOOK.callsByFamily();
measure();
const used = HOOK.callsByFamily();
const unused = ["endorse", "apa", "keep", "stakeholder"].filter((f) => used[f] === before[f]);
console.log("\n=== DO THE CONCLUSIONS DEPEND ON THE STEP SIZES? (audit B3) — 2,000 pretend starting profiles x 12 kinds, real code ===\n");
console.log(`  safety: the hook patched block5CVR.js: yes; at the shipped sizes, VCI differs from report:vci for ${mismatches} of ${KINDS.length * POP.starts.length} people`);
console.log(`  safety: steps used per family in one full pass: ${["endorse", "apa", "keep", "stakeholder", "lens"].map((f) => `${f} ${used[f] - before[f]}`).join(", ")}`
  + " (lens is 0 by design: these pretend people answer no reflection view, and that step moves only directness/context)");
if (mismatches || unused.length) {
  console.log(`  STOPPING: ${mismatches ? "the harness does not reproduce report:vci" : ""} ${unused.length ? `unused families: ${unused.join(", ")}` : ""}`);
  process.exit(1);
}

/* ---------------------------------------------------------------- the variants */
const VARIANTS = [
  ["as shipped", { all: 1 }],
  ["every step x0.5", { all: 0.5 }], ["every step x2", { all: 2 }],
  ["kept misaligned x0.5", { endorse: 0.5 }], ["kept misaligned x2", { endorse: 2 }],
  ["APA named value x0.5", { apa: 0.5 }], ["APA named value x2", { apa: 2 }],
  ["kept second-best x0.5", { keep: 0.5 }], ["kept second-best x2", { keep: 2 }],
  ["stakeholder x0.5", { stakeholder: 0.5 }], ["stakeholder x2", { stakeholder: 2 }],
];
const SHOW = ["Always aligned", "True to top value", "Corrected by APA", "Convert (keeps)", "Performance chaser",
  "Random responder", "Flip-flopper (keeps)", "Flip-flopper (via APA)", "Always the worst fit"];
const ABBR = { "Always aligned": "best", "True to top value": "top", "Corrected by APA": "APA", "Convert (keeps)": "conv",
  "Performance chaser": "perf", "Random responder": "rand", "Flip-flopper (keeps)": "flipK", "Flip-flopper (via APA)": "flipA",
  "Always the worst fit": "worst" };

const rows = [];
for (const [label, factors] of VARIANTS) {
  HOOK.setScale(factors);
  const res = measure();
  const m = (beh, k) => mean(col(res, beh, k).filter((v) => v !== null));
  const checks = {
    C1: sep(col(res, "True to top value", "vci"), col(res, "Random responder", "vci")),
    C2: sep(col(res, "Random responder", "vci"), col(res, "Flip-flopper (keeps)", "vci")),
    C3: m("Always aligned", "vci") >= m("True to top value", "vci") && m("True to top value", "vci") > m("Random responder", "vci")
      && m("Random responder", "vci") > m("Flip-flopper (keeps)", "vci") && m("Flip-flopper (keeps)", "vci") > m("Always the worst fit", "vci"),
    C4: ["Always aligned", "Always weakly aligned", "Top-two mixer"].every((b) => col(res, b, "stability").every((v) => v === 100)),
    C5: sep(col(res, "True to top value", "stability"), col(res, "Random responder", "stability")),
    C6: m("Flip-flopper (keeps)", "stability") < m("Random responder", "stability"),
    C7: col(res, "Performance chaser", "performance").every((v) => v === 100) && m("True to top value", "performance") < m("Random responder", "performance"),
    G6: sep(col(res, "Convert (keeps)", "stability"), col(res, "Random responder", "stability")),
  };
  rows.push({ label, res, m, checks });
}

const f0 = (x) => x.toFixed(0);
for (const [title, key] of [["VCI (mean)", "vci"], ["STABILITY (mean)", "stability"], ["END-OF-STUDY PERFORMANCE (captured, mean)", "performance"],
  ["STAKEHOLDER STABILITY (mean)", "stakeholder"]]) {
  console.log(`\n  ${title}`);
  console.log("  " + "run".padEnd(24) + SHOW.map((b) => ABBR[b].padStart(7)).join(""));
  for (const r of rows) console.log("  " + r.label.padEnd(24) + SHOW.map((b) => f0(r.m(b, key)).padStart(7)).join(""));
}
console.log("\n  STABILITY NOT MEASURED (share of people who never met a conflict step)");
console.log("  " + "run".padEnd(24) + SHOW.map((b) => ABBR[b].padStart(7)).join(""));
for (const r of rows) console.log("  " + r.label.padEnd(24) + SHOW.map((b) => `${f0(100 * mean(col(r.res, b, "measured").map((x) => (x ? 0 : 1))))}%`.padStart(7)).join(""));

console.log("\n  THE CONCLUSIONS (separation: how often the first kind scores higher; a coin is 0.50, the line is 0.75)");
console.log("  " + "run".padEnd(24) + ["C1 VCI top>rand", "C2 VCI rand>flip", "C3 order", "C4 keep=100", "C5 Stab top>rand", "C6 flip<rand", "C7 perf", "G6 conv vs rand"].map((h) => h.padStart(17)).join(""));
let allHold = true;
for (const r of rows) {
  const c = r.checks;
  const ok = { C1: c.C1 >= 0.75, C2: c.C2 >= 0.75, C3: c.C3, C4: c.C4, C5: c.C5 >= 0.75, C6: c.C6, C7: c.C7 };
  if (!Object.values(ok).every(Boolean)) allHold = false;
  const cell = (v, pass) => `${typeof v === "number" ? v.toFixed(2) : ""} ${pass ? "holds" : "FAILS"}`.trim();
  console.log("  " + r.label.padEnd(24) + [cell(c.C1, ok.C1), cell(c.C2, ok.C2), cell("", ok.C3), cell("", ok.C4), cell(c.C5, ok.C5),
    cell("", ok.C6), cell("", ok.C7), `${c.G6.toFixed(2)} (shown)`].map((x) => x.padStart(17)).join(""));
}
console.log(`\n  ${allHold ? "EVERY CONCLUSION HOLDS AT EVERY STEP SIZE TESTED" : "AT LEAST ONE CONCLUSION DEPENDS ON THE STEP SIZE - see FAILS above"}`);
console.log("  Kinds: best = always the best fit, top = true to their top value, APA = corrected by APA, conv = one honest change");
console.log("  (keeps), perf = performance chaser, rand = random responder, flipK / flipA = a new value every scenario (keeping /");
console.log("  through APA), worst = always the worst fit. Written up in docs/BLOCK5_STEP_SIZE_SENSITIVITY.md.\n");
