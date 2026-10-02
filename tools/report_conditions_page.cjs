/**
 * report_conditions_page.cjs — writes docs/MAJOR_SCORES_BY_CONDITION.md: every major score for every kind of pretend
 * participant in each of the four conditions (since 1 October 2026), with an explanation and an example after every
 * table (the researcher: "I want to see your explanations and examples after each table so I can understand if my work
 * is good so far or need some modifications").
 *
 * Called by tools/report_major_scores.cjs (`npm run report:major-scores`), which writes both pages from the same code.
 * The runs and their rules are in tools/condition_sim.cjs. Every number and every "larger / smaller" in the text is
 * computed here; the explanations that are not numbers describe the rules themselves, which only change with the code.
 */
const fs = require("node:fs");
const path = require("node:path");
const C = require("./condition_sim.cjs");
const { KINDS } = require("./behavior_sim.cjs");
const { COMBINED_STABILITY_EDGES } = require(path.join(__dirname, "..", ".sim-build", "block5CVR.js"));

const RUNS = C.RUNS;
const R = Object.fromEntries(RUNS.map((r) => [r.id, r]));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pct = (x) => `${Math.round(100 * x)}%`;
const sgn = (x, d = 0) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(d)}`;
/** "+1 point", "−22 points": a signed whole number with its word. */
const pts = (x) => `${sgn(x)} point${Math.round(Math.abs(x)) === 1 ? "" : "s"}`;
const sep = (a, b) => { let w = 0, t = 0; for (const x of a) for (const y of b) { if (x > y) w++; else if (x === y) t++; } return (w + t / 2) / (a.length * b.length); };
const SHORT = {
  vulnerabilityProtectionSensitivity: "vulnerable", groupSizeSensitivity: "harm", gainResponsivenessSensitivity: "gained",
  outcomeAggregationSensitivity: "helped", stakeholderPerspectiveShiftSensitivity: "person speaking",
};

/** The kinds sorted into the three groups the rules treat differently. */
const NEVER_MISFIT = ["Always aligned", "Always weakly aligned", "Top-two mixer"];
const KEEPERS = ["True to top value", "Convert (keeps)", "Performance chaser", "Flip-flopper (keeps)", "Always the worst fit"];

function writeConditionsPage({ root, head, dirty, date, mainResults }) {
  const res = C.measureConditions();
  const col = (run, k, key) => res[run][k].map((r) => r[key]).filter((v) => v !== null && v !== undefined);
  const m = (run, k, key) => mean(col(run, k, key));
  const notMeasured = (run, k) => res[run][k].filter((r) => !r.measured).length / res[run][k].length;
  const L = [];
  const line = (s = "") => L.push(s);

  /* ---------------------------------------------------------------- the checks before any number */
  const KEYS = ["vci", "vciAll", "stability", "measured", "stabilityAll", "stabilityAllMeasured", "topValue", "topOrSecond", "performance", "stakeholder"];
  let cond1Diff = 0;
  for (const k of KINDS) mainResults[k].forEach((x, i) => { for (const key of KEYS) if (x[key] !== res.CVR_APA[k][i][key]) cond1Diff += 1; });
  const sameEverywhere = KINDS.filter((k) => RUNS.every((r) => res[r.id][k].every((x, i) => ["vci", "vciAll", "stability", "stabilityAll", "performance", "topValue"]
    .every((key) => x[key] === res.CVR_APA[k][i][key]))));
  const identical = (a, b, k) => res[a][k].every((x, i) => KEYS.every((key) => x[key] === res[b][k][i][key]));

  /* ---------------------------------------------------------------- the example people */
  /** The first of the 2,000 for whom this kind shows the difference its example is about (the first person otherwise). */
  const firstWhere = (k, pred) => { const i = res.CVR_APA[k].findIndex((_, j) => pred(j)); return i < 0 ? 0 : i; };
  const EXAMPLES = [
    { n: 1, kind: "Always the worst fit", person: firstWhere("Always the worst fit", (i) => { const s = (r) => res[r]["Always the worst fit"][i].stability; return s("CVR_APA") < s("Baseline") && s("Baseline") < s("APA_Only"); }), runs: ["CVR_APA", "APA_Only", "Baseline"],
      why: "keeps a misfit in every decision, so it shows how each condition's own rule moves the values" },
    { n: 2, kind: "Corrected by APA", person: 0, runs: ["CVR_APA", "CVR_Only", "Baseline", "Baseline_B"],
      why: "is tempted by a misfit in every decision and corrected, so it shows principle A against principle B" },
    { n: 3, kind: "Random responder", person: firstWhere("Random responder", (i) => res.APA_Only["Random responder"][i].vci !== res.APA_Only_RB["Random responder"][i].vci), runs: ["CVR_APA", "APA_Only", "APA_Only_RB"],
      why: "answers at random, so it shows the two random-responder rules in APA_Only (your Q3)" },
    { n: 4, kind: "True to top value", person: firstWhere("True to top value", (i) => res.CVR_APA["True to top value"][i].stability !== res.Baseline["True to top value"][i].stability), runs: ["CVR_APA", "Baseline"],
      why: "always takes the option that serves their #1 value; sometimes that option is a misfit, and the conditions treat keeping it differently" },
    { n: 5, kind: "Flip-flopper (keeps)", person: 0, runs: ["CVR_APA", "APA_Only", "Baseline"],
      why: "takes a new value in every decision and keeps it, so it shows what each condition's Stability sees in an unsteady person" },
  ];
  for (const ex of EXAMPLES) ex.paths = C.traceAll(ex.kind, ex.person);
  const exScore = (ex, run, key) => ex.paths[run].result[key];
  const exLine = (ex, key, runs = ex.runs) => runs.map((r) => `${R[r].label} ${exScore(ex, r, key)}`).join(", ");

  /* ---------------------------------------------------------------- page head */
  line("# Major scores in the four conditions");
  line("");
  line(`> **Generated** by \`npm run report:major-scores\` on ${date}, from code version \`${head}\`${dirty ? " plus changes not yet committed" : ""}, together`);
  line("> with docs/MAJOR_SCORES_DISTRIBUTION.md. Do not edit this page by hand: change `tools/condition_sim.cjs` (the rules) or");
  line("> `tools/report_conditions_page.cjs` (the page) and run the command again.");
  line("");
  line("## How to read this page");
  line("");
  line("These are **pretend participants, not real people**: the same 2,000 random starting profiles and the same twelve kinds");
  line("of chooser as docs/MAJOR_SCORES_DISTRIBUTION.md, through the study's real scoring code. This page lets each of them");
  line("through Block 5 in every condition, so the conditions can be compared on **the same people**. Real participants will");
  line("behave as they do; this page shows what each condition's **rules** do to the scores when the behaviour is known.");
  line("");
  line("Every table has six columns: the four conditions, and the two extra versions you asked for (1 October 2026: \"Do the");
  line("two of them, so I can see the differences\").");
  line("");
  line("| Column | What it is |");
  line("|---|---|");
  line("| **CVR+APA** | Condition 1, the full version. The numbers of docs/MAJOR_SCORES_DISTRIBUTION.md |");
  line("| **CVR_Only** | Condition 2: a refusal after the reflection opens the CVR Rejection page, then the person chooses again |");
  line("| **APA_Only** | Condition 3: a misfit opens the APA page at once. Principle A, random responder rule A |");
  line("| **APA_Only, random B** | The same, with random responder rule B (only the random responder can differ) |");
  line("| **Baseline (A)** | Condition 4: a misfit opens the confirmation page with \"How sure\". Principle A |");
  line("| **Baseline (B)** | The same under principle B (only the three refusing kinds can differ) |");
  line("");
  line("A \"misfit\" is a misaligned or strongly misaligned choice in one of the four decisions (scenarios 1-4).");
  line("");
  line("### The two principles (your Q1: both)");
  line("");
  line("- **Principle A, \"the same person, a different page\":** each kind makes the choices it makes in condition 1; only the");
  line("  page it meets, and that page's value moves, change. Any difference between the columns then comes from the rules.");
  line("- **Principle B, \"the pages change behaviour\":** a person refuses a misfit only when a page asks them to think again.");
  line("  CVR_Only (the reflection) and APA_Only (the APA page) have such a page, so B is the same as A there. Baseline has");
  line("  none, so in Baseline (B) the three kinds that refuse in condition 1 **keep their first pick**.");
  line("");
  line("### What each kind does in each condition");
  line("");
  line("| Kinds | CVR+APA (today) | CVR_Only | APA_Only | Baseline |");
  line("|---|---|---|---|---|");
  line(`| **Never pick a misfit** (${NEVER_MISFIT.length}): ${NEVER_MISFIT.join(", ")} | Confirmation page; the keep rule | Same | Same | Same |`);
  line(`| **Keep their misfit** (${KEEPERS.length}): ${KEEPERS.join(", ")} | Reflection: stand by it, "strongly" (the chaser "with some doubt"): +30 to the value it serves, −20 to the value it gives up most, ±25 person speaking | Same as today | APA page: name the value the box says the option serves most, pick their own option from the list. How sure 5 (the chaser 3): +30 × weight to it, −10 × weight to the other three | Confirmation page: Keep. How sure 5 (the chaser 3): +30 × weight to the value it serves most, −10 (misaligned) or −15 (strongly misaligned) × weight to the other three |`);
  line(`| **Refuse their misfit** (${C.REFUSERS.length}): ${C.REFUSERS.join(", ")} | Reflection: refuse; APA page: name a value (their top value / their new value / a new value each time), how sure 4 / 5 / 5, pick from the list | CVR Rejection page (person speaking ±25), go back, choose the option they end on today; a misfit is kept "strongly" | **As today** on the APA page (the person-speaking score no longer moves) | **A:** Change my mind, choose the option they end on today; a misfit is kept with how sure 4 / 5 / 5. **B:** Keep the first pick, how sure 4 / 5 / 5 |`);
  line("| **Random responder** (1) | Half stand by it, half refuse; every answer random | Half stand by it, half refuse and choose again at random (and may refuse again) | **A:** every answer random (value, how sure, option from the list). **B:** half the time it names the box's value and keeps its own option (random how sure); otherwise as A | Half Keep (random how sure), half Change my mind and pick again at random (a misfit is then kept or dropped at random) |");
  line("");
  line("\"Weight\" is the APA page's own sureness weight: how sure 1, 2, 3, 4, 5 gives 0.6, 0.7, 0.8, 0.9, 1.0.");
  line("");
  line("### Checks made before any number on this page");
  line("");
  line(`- **Condition 1 is today's study:** the CVR+APA column was compared with docs/MAJOR_SCORES_DISTRIBUTION.md person by person, for all ${KINDS.length * mainResults[KINDS[0]].length} pretend people: **${cond1Diff} differences**.`);
  line(`- **Kinds that score the same in all six columns, person by person:** ${sameEverywhere.length ? sameEverywhere.join(", ") : "none"}. They never pick a misfit, so no condition's own page ever opens for them.`);
  line(`- **APA_Only, random B changes only the random responder:** ${KINDS.filter((k) => k !== "Random responder").every((k) => identical("APA_Only", "APA_Only_RB", k)) ? "checked, every other kind is identical" : "NOT TRUE - another kind differs"}.`);
  line(`- **Baseline (B) changes only the three refusing kinds:** ${KINDS.filter((k) => !C.REFUSERS.includes(k)).every((k) => identical("Baseline", "Baseline_B", k)) ? "checked, every other kind is identical" : "NOT TRUE - another kind differs"}.`);
  line("- **Draws:** every kind meets the same random draws in every column, so its first pick in scenario 1 is the same; later");
  line("  first picks can differ when a condition has moved the values differently (the list of misfits is then different). The");
  line("  random responder's later answers can also differ between columns, so compare it as a group.");
  line("");

  /* ---------------------------------------------------------------- the examples */
  line("## Five pretend people, step by step (the examples used under every table)");
  line("");
  line("Each example is one pretend person in the columns that matter for it (the first of the 2,000, or the first who shows");
  line("the difference the example is about; its number is given). Each cell: their first pick");
  line("in that decision and its fit, the page they met and what they did there, the final choice when it changed, and what");
  line("moved (vulnerable = protecting the vulnerable, harm = reducing harm, gained = how much is gained, helped = how many are");
  line("helped). \"Step\" = counted for Stability.");
  line("");
  for (const ex of EXAMPLES) {
    line(`### Example ${ex.n}: ${ex.kind} (pretend person ${ex.person + 1} of 2,000)`);
    line("");
    line(`This person ${ex.why}.`);
    line("");
    line(`| Decision | ${ex.runs.map((r) => R[r].label).join(" | ")} |`);
    line(`|---|${ex.runs.map(() => "---").join("|")}|`);
    for (let i = 0; i < 4; i++) {
      const cells = ex.runs.map((r) => {
        const t = ex.paths[r].trace[i];
        const moved = t.moved.length ? t.moved.map(([k, d]) => `${SHORT[k]} ${sgn(d, Number.isInteger(d) ? 0 : 1)}`).join(", ") : "nothing";
        return `${t.first}<br>→ ${t.page}${t.final !== "the same" ? `<br>→ final: ${t.final}` : ""}<br>moved: ${moved}${t.countedForStability ? " · **step**" : ""}`;
      });
      line(`| ${i + 1}. ${ex.paths.CVR_APA.trace[i].scenarioTitle} | ${cells.join(" | ")} |`);
    }
    line(`| **Scores** | ${ex.runs.map((r) => { const x = ex.paths[r].result; return `VCI ${x.vci} · VCI_all ${x.vciAll} · Stability ${x.stability} (${x.conflictSteps} step${x.conflictSteps === 1 ? "" : "s"}) · Stability_all ${x.stabilityAll} · performance ${x.performance}`; }).join(" | ")} |`);
    line("");
  }

  /* ---------------------------------------------------------------- a score table, with its explanation */
  const table = (key, { digits = 0, extra } = {}) => {
    line(`| Kind | ${RUNS.map((r) => r.label).join(" | ")} | Largest change from CVR+APA |`);
    line(`|---|${RUNS.map(() => "---").join("|")}|---|`);
    for (const k of KINDS) {
      const base = m("CVR_APA", k, key);
      const cells = RUNS.map((r) => { const v = m(r.id, k, key); return Number.isNaN(v) ? "not measured" : `${v.toFixed(digits)}${extra ? extra(r.id, k) : ""}`; });
      const changes = RUNS.slice(1).map((r) => ({ r, d: m(r.id, k, key) - base })).filter((x) => !Number.isNaN(x.d));
      const big = changes.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      line(`| ${k} | ${cells.join(" | ")} | ${big && Math.abs(big.d) >= 0.5 * 10 ** -digits ? `${sgn(big.d, digits)} (${big.r.label})` : "none"} |`);
    }
    line("");
  };
  /** The biggest change for the same behaviour (principle A, random responder left out), as words. */
  const biggestA = (key) => {
    let best = { d: 0 };
    for (const k of KINDS.filter((x) => x !== "Random responder")) for (const r of ["CVR_Only", "APA_Only", "Baseline"]) {
      const d = m(r, k, key) - m("CVR_APA", k, key);
      if (Math.abs(d) > Math.abs(best.d)) best = { k, r, d };
    }
    return best;
  };

  /* ---------------------------------------------------------------- 1. VCI */
  line("## 1. VCI (the four decisions)");
  line("");
  line("How well the four final choices fit the person's own values. Blind picking gives 50, always the best fit 100.");
  line("");
  table("vci");
  const vA = biggestA("vci");
  const rndV = RUNS.map((r) => `${r.label} ${m(r.id, "Random responder", "vci").toFixed(0)}`).join(", ");
  line("**What it shows.**");
  line("");
  line(`- **Under principle A, VCI hardly depends on the condition.** The largest change for the same behaviour (the random responder left out) is ${pts(vA.d)} (${vA.k}, ${R[vA.r].label}). VCI reads only the final choices, and under A they are the same or nearly the same (the refusing kinds choose again from all the options instead of from the APA list); it also moves a little because each choice is judged on the values the person brought into that scenario, and each condition's rule moved those values differently in the scenarios before.`);
  line(`- **The random responder's VCI is not the same in every condition:** ${rndV}. Each page changes what a random person ends with: the APA list offers only options built on the value named, and going back and picking again stops at a good fit but keeps a misfit only half the time. So the "random" line is not 50 in any condition, and not the same line in all four.`);
  line(`- **Principle B shows the size of a real correction effect:** Corrected by APA scores ${m("CVR_APA", "Corrected by APA", "vci").toFixed(0)} when corrected and ${m("Baseline_B", "Corrected by APA", "vci").toFixed(0)} when nobody asks them to think again (Baseline (B)). If your pages really correct people, VCI can see it.`);
  line("");
  { const ex = EXAMPLES[1]; line(`**Example.** Example ${ex.n} (${ex.kind}): VCI ${exLine(ex, "vci")}. In Baseline (B) they kept their tempting pick in all four decisions (see their table above), so every decision was a misfit.`); }
  line("");

  /* ---------------------------------------------------------------- 1b. VCI_all */
  line("## 1b. VCI_all (all six scenarios)");
  line("");
  line("The same idea over all six scenarios, on the hidden running values that also move after the wish (scenario 5) and the");
  line("rule (scenario 6). Scenarios 5 and 6 are the same in every condition (no condition page opens there).");
  line("");
  table("vciAll");
  const vaA = biggestA("vciAll");
  line("**What it shows.**");
  line("");
  line(`- **The same pattern as VCI.** The largest change for the same behaviour under A is ${pts(vaA.d)} (${vaA.k}, ${R[vaA.r].label}). The random responder and Baseline (B) move it for the same reasons as VCI.`);
  line("");
  { const ex = EXAMPLES[1]; line(`**Example.** Example ${ex.n} (${ex.kind}): VCI_all ${exLine(ex, "vciAll")}.`); }
  line("");

  /* ---------------------------------------------------------------- 2. Stability */
  line("## 2. Stability (the four decisions)");
  line("");
  line("Whether the four values stayed the same at the decisions that went against the best fit (100 = they did, or never");
  line("tested). Since 2 October 2026 it is the **average of two parts** (the researcher's names): **Value_Order_Stability**,");
  line("whether their ORDER changed (pairs that swapped places), and **Value_Difference_Stability**, how far they MOVED there");
  line("(100 minus the average points moved). In brackets: the share **not measured** (no decision counted, so 100 means");
  line("\"never tested\").");
  line("");
  table("stability", { extra: (run, k) => ` (${pct(notMeasured(run, k))})` });
  const sA = biggestA("stability");
  const oA = biggestA("stabilityOrder"), dA = biggestA("stabilityDifference");
  line("### The two parts");
  line("");
  line("**The order part** (Value_Order_Stability; Stability's whole rule until 2 October 2026):");
  line("");
  table("stabilityOrder");
  line("**The difference part** (Value_Difference_Stability):");
  line("");
  table("stabilityDifference");
  line("**What it shows.**");
  line("");
  line(`- **Stability still depends a little on the condition for the same behaviour, less than either part alone.** The largest change under A is ${pts(sA.d)} (${sA.k}, ${R[sA.r].label}); the order part alone moves up to ${pts(oA.d)} (${oA.k}, ${R[oA.r].label}), the difference part alone up to ${pts(dA.d)} (${dA.k}, ${R[dA.r].label}). The reason is the rules, not the people, and the two parts lean opposite ways:`);
  line("  - **the order part** is higher in APA_Only and Baseline: after the reflection (CVR+APA, CVR_Only) keeping a misfit moves **two** values in opposite directions (+30 to the value the option serves, −20 to the value it gives up most), and both can pass other values; the APA page and Baseline's Keep move **one** value up and the **other three down together** (−10 or −15 each), so the three keep their order and fewer pairs swap;");
  {
    /* Which way the difference part leans, kind by kind (Baseline (A) against CVR+APA), from the numbers. */
    const meets = KINDS.filter((k) => !NEVER_MISFIT.includes(k) && k !== "Random responder");
    const lower = meets.filter((k) => m("Baseline", k, "stabilityDifference") < m("CVR_APA", k, "stabilityDifference") - 0.5);
    const higher = meets.filter((k) => m("Baseline", k, "stabilityDifference") > m("CVR_APA", k, "stabilityDifference") + 0.5);
    line(`  - **the difference part** usually leans the other way: keeping a misfit adds up to more points in APA_Only and Baseline (+30 and 3 × −10 or −15, against +30 and −20), so the values end further from where they began. In Baseline (A) it is lower than in CVR+APA for ${lower.length ? lower.join(", ") : "no kind"}${higher.length ? `, and higher for ${higher.join(", ")} (a new value each time spreads the moves so more of them cancel; a kind that goes back and takes a good fit in Baseline makes no move at all)` : ""};`);
  }
  line("  - averaged, the two partly cancel.");
  line(`- **\"Not measured\" also depends on the condition:** Corrected by APA is not measured in ${pct(notMeasured("CVR_APA", "Corrected by APA"))} of people in CVR+APA, but in ${pct(notMeasured("CVR_Only", "Corrected by APA"))} in CVR_Only and ${pct(notMeasured("Baseline", "Corrected by APA"))} in Baseline (A): going back and taking a good fit is not a Stability step, while an APA visit always is (your Q2-yes for APA_Only).`);
  line(`- **Principle B:** Corrected by APA keeps a misfit in every decision in Baseline (B), so every decision is a step and Stability falls to ${m("Baseline_B", "Corrected by APA", "stability").toFixed(0)}.`);
  line("");
  { const ex = EXAMPLES[0]; const parts = ex.runs.map((r) => `${R[r].label} ${exScore(ex, r, "stability")} (order ${exScore(ex, r, "stabilityOrder")}, difference ${exScore(ex, r, "stabilityDifference")})`).join(", "); line(`**Example.** Example ${ex.n} (${ex.kind}) makes the same four choices in every column, yet Stability is ${parts}. In their table, CVR+APA moves two values at each keep (+30 and −20, so both can cross other values); APA_Only and Baseline raise one value and lower the other three together (−10 or −15 each)${["APA_Only", "Baseline"].every((r) => exScore(ex, r, "stabilityOrder") > exScore(ex, "CVR_APA", "stabilityOrder")) ? ", so fewer pairs swap and the order part is higher" : ""}; how far the values end from where they began sets the difference part.`); }
  { const ex = EXAMPLES[3]; line(`Example ${ex.n} (${ex.kind}): Stability ${exLine(ex, "stability")}. When their #1 value's option is a misfit and they keep it, CVR+APA also lowers the value the option gives up most, which can swap two of their other values; Baseline raises the option's main value (usually their #1, already first) and lowers the other three together, which cannot change the order of those three.`); }
  line("");

  line("### 2a. Stability steps per person (of 4)");
  line("");
  line("How many of the four decisions counted for Stability. This is what \"not measured\" is made of.");
  line("");
  table("conflictSteps", { digits: 2 });
  line("**What it shows.** A step is a decision that ended on a misfit after a page about it (CVR+APA: the reflection ran; APA_Only:");
  line("every APA visit; Baseline: a misfit kept on the confirmation page; CVR_Only: a misfit kept after the reflection). Kinds");
  line("that refuse and then take a good fit lose their steps in CVR_Only and Baseline (A).");
  line("");
  { const ex = EXAMPLES[1]; line(`**Example.** Example ${ex.n} (${ex.kind}): steps ${exLine(ex, "conflictSteps")}.`); }
  line("");

  /* ---------------------------------------------------------------- 2b. Stability_all */
  line("## 2b. Stability_all (all six scenarios)");
  line("");
  table("stabilityAll");
  line("**What it shows.** Stability's rule over all six scenarios (the wish and the rule count when the final choice was not one");
  line("of the two best fits on the running values). Its decisions part is Stability's, so it moves with Stability for the same");
  line("reasons; scenarios 5 and 6 add the same steps in every condition.");
  line("");
  { const ex = EXAMPLES[4]; line(`**Example.** Example ${ex.n} (${ex.kind}): Stability_all ${exLine(ex, "stabilityAll")} (Stability ${exLine(ex, "stability")}).`); }
  line("");

  /* ---------------------------------------------------------------- 2c. top-value choices */
  line("## 2c. Top-value choices (of 6; saved, never shown)");
  line("");
  line("In how many of the six scenarios the final choice was the option that does most for the #1 value brought into Block 5.");
  line("");
  table("topValue", { digits: 2 });
  line("**What it shows.** It counts final choices only, so it changes only where a column changes a final choice: the refusing");
  line("kinds (what they choose after going back, or keeping their first pick in Baseline (B)) and the random responder.");
  line("");
  { const ex = EXAMPLES[1]; line(`**Example.** Example ${ex.n} (${ex.kind}): ${exLine(ex, "topValue")} of 6.`); }
  line("");

  /* ---------------------------------------------------------------- 3. performance */
  line("## 3. Performance at the end of the study");
  line("");
  line("How good the chosen options were inside each decision: 0 = the weakest option every time, 100 = the strongest.");
  line("");
  table("performance");
  line("**What it shows.** Performance reads the final choices only, so under A it changes only for the kinds whose final");
  line("choice is made differently: the refusing kinds choose from all the options after going back (CVR_Only, Baseline) instead");
  line("of from the APA list, and the random responder. It does not depend on any value-move rule.");
  line("");
  { const ex = EXAMPLES[1]; line(`**Example.** Example ${ex.n} (${ex.kind}): performance ${exLine(ex, "performance")}.`); }
  line("");

  /* ---------------------------------------------------------------- 3b. the three reflection scores */
  line("## 3b. The stakeholder, directness and context scores");
  line("");
  line("Only the reflection pages move them, so in APA_Only and Baseline they never move and the study saves their stabilities as");
  line("\"Not measured in this condition\". The person-speaking (stakeholder) score's stability, where it is measured:");
  line("");
  line(`| Kind | ${RUNS.map((r) => r.label).join(" | ")} |`);
  line(`|---|${RUNS.map(() => "---").join("|")}|`);
  for (const k of KINDS) line(`| ${k} | ${RUNS.map((r) => { const v = col(r.id, k, "stakeholder"); return v.length ? mean(v).toFixed(0) : "not measured"; }).join(" | ")} |`);
  line("");
  line("**What it shows.** These three scores can be compared between CVR+APA and CVR_Only only. In CVR_Only the CVR Rejection");
  line("page moves the person-speaking score once per scenario, as the APA page does in CVR+APA.");
  line("");

  /* ---------------------------------------------------------------- 4. separation */
  line("## 4. Do the scores still tell the kinds apart in every condition?");
  line("");
  line("How often the first kind scores higher than the second when one person of each is picked at random (ties count half).");
  line("0.50 is a coin; 1.00 always. Each cell: VCI / Stability.");
  line("");
  const PAIRS = [["True to top value", "Random responder"], ["Always aligned", "Random responder"], ["Random responder", "Flip-flopper (keeps)"],
    ["Convert (keeps)", "Flip-flopper (keeps)"], ["Corrected by APA", "Random responder"], ["Random responder", "Always the worst fit"]];
  line(`| First kind | Second kind | ${RUNS.map((r) => r.label).join(" | ")} |`);
  line(`|---|---|${RUNS.map(() => "---").join("|")}|`);
  for (const [a, b] of PAIRS) {
    line(`| ${a} | ${b} | ${RUNS.map((r) => `${sep(col(r.id, a, "vci"), col(r.id, b, "vci")).toFixed(2)} / ${sep(col(r.id, a, "stability"), col(r.id, b, "stability")).toFixed(2)}`).join(" | ")} |`);
  }
  line("");
  const tt = RUNS.map((r) => sep(col(r.id, "True to top value", "vci"), col(r.id, "Random responder", "vci")));
  line("**What it shows.**");
  line("");
  line(`- **VCI separates a value-follower from a random person in every condition** (True to top value over Random responder: ${Math.min(...tt).toFixed(2)} to ${Math.max(...tt).toFixed(2)}).`);
  const ts = RUNS.map((r) => sep(col(r.id, "True to top value", "stability"), col(r.id, "Random responder", "stability")));
  line(`- **Stability separates them by different amounts in different conditions** (True to top value over Random responder: ${ts.map((x, i) => `${RUNS[i].label} ${x.toFixed(2)}`).join(", ")}), because each condition's rule moves the values differently (section 2). Compare Stability between kinds inside one condition; between conditions, read section 2 first.`);
  line(`- **Corrected by APA against the random responder** shows principle B again: ${R.Baseline.label} ${sep(col("Baseline", "Corrected by APA", "vci"), col("Baseline", "Random responder", "vci")).toFixed(2)}, ${R.Baseline_B.label} ${sep(col("Baseline_B", "Corrected by APA", "vci"), col("Baseline_B", "Random responder", "vci")).toFixed(2)} on VCI.`);
  line("");

  /* ---------------------------------------------------------------- 5. what does not change */
  line("## 5. What is the same in every condition");
  line("");
  line("- **Card order** (main page, section 5) and **the position check** (section 6): the planner orders the cards from the");
  line("  values brought into Block 5, and Blocks 1-4 are the same in all four conditions.");
  line("- **The prediction in scenario 6** (section 7): its favourite is always the best fit on the values at that moment; how");
  line("  SURE it is uses VCI and Stability, so it follows the changes above.");
  line("");

  /* ---------------------------------------------------------------- 6. what it means */
  line("## 6. What this means for comparing the conditions");
  line("");
  const tA = biggestA("topValue");
  line(`1. **VCI, VCI_all, performance and the top-value choices are fair rulers between conditions** for the same behaviour: under principle A they move at most ${pts(Math.abs(vA.d)).slice(1)} (VCI), ${Math.abs(vaA.d).toFixed(0)} (VCI_all), ${Math.abs(biggestA("performance").d).toFixed(0)} (performance) and ${Math.abs(tA.d).toFixed(2)} of 6 (top-value choices, ${tA.k}, who chooses again from all the options after going back). A difference between conditions in these scores comes from what people chose.`);
  line(`2. **Stability is still not a perfectly fair ruler between conditions:** the same behaviour can score up to ${Math.abs(sA.d).toFixed(0)} points apart in two conditions (${sA.k}: ${R.CVR_APA.label} ${m("CVR_APA", sA.k, "stability").toFixed(0)}, ${R[sA.r].label} ${m(sA.r, sA.k, "stability").toFixed(0)}), from the value-move rules alone (each part alone: up to ${Math.abs(oA.d).toFixed(0)} and ${Math.abs(dA.d).toFixed(0)}). Compare Stability inside a condition, or between conditions against the gaps in section 2.`);
  line("3. **The \"random\" line is different in each condition** (section 1): the pages themselves help a random person a little, by");
  line("   different amounts.");
  line(`4. **Principle B shows what a real correction effect looks like:** when the refusing kinds are not corrected, VCI falls by about ${Math.abs(m("Baseline_B", "Corrected by APA", "vci") - m("Baseline", "Corrected by APA", "vci")).toFixed(0)} points for Corrected by APA. The study can see an effect of that size.`);
  line("");

  /* ---------------------------------------------------------------- 7. the level edges, derived again */
  /* Stability's five words sit on COMBINED_STABILITY_EDGES (block5CVR.ts): each edge is where a pretend participant
     sitting EXACTLY on today's edge (no swap but tested, one, three, five swaps) lands on the combined score - the median
     over 2,000 profiles x 12 kinds x the four conditions (principle A). Derived again here on every run; the command stops
     when an edge is more than one point from the code's. */
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN; };
  const pool = ["CVR_APA", "CVR_Only", "APA_Only", "Baseline"].flatMap((r) => KINDS.flatMap((k) => res[r][k]));
  const edgeRows = COMBINED_STABILITY_EDGES.filter((e) => Number.isFinite(e.todaysEdgeInSwaps)).map((e) => {
    const order = Math.round(100 * (1 - Math.min(1, e.todaysEdgeInSwaps / 6)));
    const on = pool.filter((x) => x.stabilityOrder === order && (e.todaysEdgeInSwaps > 0 || x.measured));
    const onAll = pool.filter((x) => x.stabilityAllOrder === order && (e.todaysEdgeInSwaps > 0 || x.stabilityAllMeasured));
    return { e, order, n: on.length, med: median(on.map((x) => x.stability)), medAll: median(onAll.map((x) => x.stabilityAll)) };
  });
  const edgesOk = edgeRows.every((x) => Math.abs(x.med - x.e.from) <= 1);
  line("## 7. Stability's level edges, derived again");
  line("");
  line("Each of the five words keeps today's meaning: a pretend participant sitting exactly on today's edge (no swap but tested,");
  line("one, three, five swaps) is put on the new combined score, and the edge is where such people typically land (the");
  line("median, over the four conditions). The command stops if an edge here is more than one point from the code's.");
  line("");
  line("| Level from | Today's edge | People exactly on it | Typical combined Stability | Typical Stability_all | The code's edge |");
  line("|---|---|---|---|---|---|");
  for (const x of edgeRows) line(`| ${x.e.label} | ${x.e.todaysEdgeInSwaps} swap${x.e.todaysEdgeInSwaps === 1 ? "" : "s"}${x.e.todaysEdgeInSwaps === 0 ? " (tested)" : ""} = ${x.order} | ${x.n} | ${x.med} | ${x.medAll} | **${x.e.from}**${Math.abs(x.med - x.e.from) <= 1 ? "" : " (DRIFTED)"} |`);
  line("");
  const shareLine = (key, levelKey) => {
    const L5 = COMBINED_STABILITY_EDGES.map((e) => e.label);
    return L5.map((l) => `${l} ${pct(pool.filter((x) => x[levelKey] === l).length / pool.length)}`).join(" · ");
  };
  line(`All kinds and the four conditions together, the share in each level: Stability ${shareLine("stability", "stabilityLevel")}; Stability_all ${shareLine("stabilityAll", "stabilityAllLevel")}.`);
  line("");

  const OUT = path.join(root, "docs", "MAJOR_SCORES_BY_CONDITION.md");
  fs.writeFileSync(OUT, L.join("\n") + "\n");
  return { file: path.relative(root, OUT), lines: L.length, cond1Diff, edgesOk, edges: edgeRows.map((x) => `${x.e.label} ${x.med} (code ${x.e.from})`).join(", ") };
}

module.exports = { writeConditionsPage };
