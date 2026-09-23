/*
 * validate_mcf.cjs — the guard on the Moral Commitment Function, stage 1.
 *
 * MCF tells a participant what an option serves among their four values, what it gives up, which
 * option on the table serves each value most, and what taking that one instead would cost. Stage 1
 * is the arithmetic only: no wording, no panel, nothing stored. These gates settle the numbers
 * before anybody argues about sentences.
 *
 * THE ONE THAT MATTERS IS M1. MCF is a DECOMPOSITION of the shortfall the study already scores an
 * option on. If its four parts ever stop summing to that shortfall, MCF and the alignment label
 * are telling a participant two different things about the same option.
 *
 * Run:  npm run validate:mcf
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
const { POLICY_DIM_KEYS } = B("block5Types.js");
const { policyAlignmentShortfall } = B("block5CVR.js");
const { mcfForScenario, mcfForOption, MCF_VERSION } = B("block5MCF.js");
const { mcfSentences } = B("block5MCFWords.js");

const ALL_KEYS = [...POLICY_DIM_KEYS, "directnessSensitivity", "contextSensitivity",
  "stakeholderPerspectiveShiftSensitivity"];

/* ------------------------------------------------------------------ the sample of participants */

const SEED = 20260924;
let seed = SEED;
function rand() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A profile whose four values are drawn independently, so demanding and modest people both appear. */
function profileOf(scores) {
  return {
    generatedAt: "sim",
    topThreeKeys: POLICY_DIM_KEYS.slice(0, 3),
    topSensitivityKey: POLICY_DIM_KEYS[0],
    dimensions: ALL_KEYS.map((key, i) => ({
      key, label: key, score: scores[key] === undefined ? 50 : scores[key],
      rank: i + 1, weight: 1 / ALL_KEYS.length, sourceBlocks: [],
    })),
  };
}

function randomProfile() {
  const scores = {};
  for (const k of POLICY_DIM_KEYS) scores[k] = Math.round(rand() * 100);
  return profileOf(scores);
}

const PEOPLE = [
  ["everything at the ceiling", profileOf(Object.fromEntries(POLICY_DIM_KEYS.map((k) => [k, 100])))],
  ["everything at the floor", profileOf(Object.fromEntries(POLICY_DIM_KEYS.map((k) => [k, 0])))],
  ["all four at fifty", profileOf(Object.fromEntries(POLICY_DIM_KEYS.map((k) => [k, 50])))],
];
const RANDOM_RUNS = 400;

/* ------------------------------------------------------------------------------- the gates */

let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${String(id).padEnd(3)} ${msg}`);
  if (!ok) fails += 1;
};

console.log("");
console.log("==============================================================================");
console.log("  THE MORAL COMMITMENT FUNCTION — stage 1, the arithmetic");
console.log(`  rule ${MCF_VERSION} · every scenario × every option × ${RANDOM_RUNS + PEOPLE.length} profiles`);
console.log("==============================================================================");
console.log("");

const everyProfile = [
  ...PEOPLE.map(([, p]) => p),
  ...Array.from({ length: RANDOM_RUNS }, () => randomProfile()),
];

let m1 = true, worstGap = 0, checked = 0;
let m2 = true, m3 = true, m4 = true, m5 = true, m6 = true;
const WORDS = ["aligned", "misaligned", "best fit", "recommend", "should", "better choice", "score"];
const problems = [];

for (const scenario of BLOCK5_SCENARIOS) {
  for (const profile of everyProfile) {
    const mcf = mcfForScenario(scenario, profile);

    for (const row of mcf.options) {
      const option = scenario.options.find((o) => o.id === row.optionId);
      checked += 1;

      /* M1 — the four parts sum to the shortfall the study scores this option on. */
      const parts = row.lines.reduce((a, l) => a + l.costOfFallingShort, 0);
      const whole = policyAlignmentShortfall(option, profile);
      worstGap = Math.max(worstGap, Math.abs(parts - whole));
      if (Math.abs(parts - whole) > 0.25) {          // four values, each rounded to one decimal
        m1 = false;
        problems.push(`${scenario.id}/${row.optionId}: parts ${parts.toFixed(2)} vs whole ${whole.toFixed(2)}`);
      }
      if (Math.abs(row.totalCostOfFallingShort - whole) > 0.25) m1 = false;

      for (const line of row.lines) {
        /* M2 — "served most here" really is the maximum on that value, in this scenario. */
        const max = Math.max(...scenario.options.map((o) => o.fingerprint[line.value]));
        const named = scenario.options.find((o) => o.id === line.servedMostHere);
        if (named.fingerprint[line.value] !== max) m2 = false;
        if (line.servedMostHereDelivers !== max) m2 = false;
        if (Math.abs(line.headroomHere - Math.max(0, max - line.thisOptionDelivers)) > 0.11) m2 = false;
        if (line.thisOptionIsStrongestHere !== (line.servedMostHere === row.optionId)) m2 = false;

        /* M4 — a value is either short or surplus, never both, and the split matches the gap. */
        if (line.costOfFallingShort > 0 && line.surplus > 0) m4 = false;
        if (Math.abs(line.gap - (line.thisOptionDelivers - line.youHold)) > 0.11) m4 = false;
        if (line.thisOptionDelivers >= line.youHold && line.costOfFallingShort !== 0) m4 = false;
      }

      /* M3 — every swap fixes the value it claims to fix, and is the cheapest that does. */
      for (const swap of row.swaps) {
        const line = row.lines.find((l) => l.value === swap.value);
        if (line.costOfFallingShort <= 0) { m3 = false; continue; }   // only short values get a swap
        if (!swap.optionId) continue;
        const pick = scenario.options.find((o) => o.id === swap.optionId);
        const clears = pick.fingerprint[swap.value] >= line.youHold;
        if (swap.clearsWhatYouHold !== clears) m3 = false;
        if (swap.optionId === row.optionId) m3 = false;

        if (clears) {
          const cheapest = Math.min(...scenario.options
            .filter((o) => o.id !== row.optionId && o.fingerprint[swap.value] >= line.youHold)
            .map((o) => policyAlignmentShortfall(o, profile)));
          if (Math.abs(policyAlignmentShortfall(pick, profile) - cheapest) > 0.25) m3 = false;
        } else {
          /* Nothing clears it: the named option must be the strongest available on that value. */
          const best = Math.max(...scenario.options
            .filter((o) => o.id !== row.optionId).map((o) => o.fingerprint[swap.value]));
          if (pick.fingerprint[swap.value] !== best) m3 = false;
        }
      }

      /* M5 — the vocabulary stays neutral. No verdicts anywhere in what MCF emits. */
      const text = JSON.stringify(row).toLowerCase();
      for (const w of WORDS) if (text.includes(w)) { m5 = false; problems.push(`word "${w}"`); }
    }
  }
}

/* M7 — THE SENTENCES A PARTICIPANT ACTUALLY READS.
 *
 * Every reading, for every option, in every scenario, against every profile in the sample: no
 * verdict word, and no digit. The digit rule is the strict one - a value number, a shortfall or a
 * percentage reaching the page would be the scoring arithmetic, which this study never shows. */
let m7 = true;
let sentencesChecked = 0;
const sample = [];
for (const scenario of BLOCK5_SCENARIOS) {
  const titleOf = (id) => scenario.options.find((o) => o.id === id).title;
  for (const profile of everyProfile) {
    for (const row of mcfForScenario(scenario, profile).options) {
      const said = mcfSentences(row, titleOf);
      const all = [said.gives, said.asks, said.servedMost, ...said.inExchange].filter(Boolean);
      sentencesChecked += all.length;
      for (const sentence of all) {
        const lower = sentence.toLowerCase();
        if (WORDS.some((w) => lower.includes(w))) {
          m7 = false; problems.push(`verdict word in: ${sentence.slice(0, 60)}`);
        }
        /* An option's own title is quoted content the participant is already reading elsewhere -
           "Draw the 20 names from the patients who cannot wait" has a number in it and always
           did. The rule is that MCF never prints ARITHMETIC of its own, so the quoted titles come
           out before the digits are counted. */
        const withoutTitles = sentence.replace(/“[^”]*”/g, "");
        if (/[0-9]/.test(withoutTitles)) {
          m7 = false; problems.push(`a digit reached the page: ${sentence.slice(0, 60)}`);
        }
      }
      if (sample.length < 1 && scenario.id.includes("wildfire") && row.optionId.includes("ridge")) {
        sample.push({ scenario: scenario.title, option: titleOf(row.optionId), said });
      }
    }
  }
}

/* M6 — same inputs, same output, every time. */
{
  const s = BLOCK5_SCENARIOS[0];
  const p = everyProfile[7];
  const a = JSON.stringify(mcfForScenario(s, p));
  const b = JSON.stringify(mcfForScenario(s, p));
  const one = JSON.stringify(mcfForOption(s, s.options[2], p));
  const inside = JSON.stringify(mcfForScenario(s, p).options[2]);
  m6 = a === b && one === inside;
}

gate("M1", m1,
  m1 ? `the four parts sum to the shortfall the study already scores  (${checked} option readings, `
       + `worst gap ${worstGap.toFixed(3)})`
     : `MCF disagrees with the alignment shortfall: ${problems.slice(0, 3).join(" | ")}`);
gate("M2", m2, "\"served most here\" is the strongest option on that value, and the headroom is the difference");
gate("M3", m3, "every swap fixes the value it names, and is the cheapest option that does");
gate("M4", m4, "a value is short or surplus, never both, and the gap is delivers minus holds");
gate("M5", m5, m5 ? "no verdict words: nothing MCF emits says aligned, best fit, recommend or score"
                  : `a verdict word reached MCF: ${problems.slice(-1)[0]}`);
gate("M6", m6, "the same scenario and profile give a byte-identical reading, every time");
gate("M7", m7,
  m7 ? `no verdict word and no digit in any sentence a participant can read  (${sentencesChecked} sentences)`
     : `a forbidden word or number reached the page: ${problems.slice(-1)[0]}`);

if (process.argv.includes("--show") && sample.length) {
  const s = sample[0];
  console.log("");
  console.log("  ----------------------------------------------------------------------------");
  console.log(`  A READING AS A PARTICIPANT SEES IT — ${s.scenario}`);
  console.log(`  Option: ${s.option}`);
  console.log("  ----------------------------------------------------------------------------");
  console.log(`    IT GIVES         ${s.said.gives}`);
  console.log(`    IT ASKS          ${s.said.asks}`);
  if (s.said.servedMost) console.log(`    SERVED MOST HERE ${s.said.servedMost}`);
  for (const line of s.said.inExchange) console.log(`    IN EXCHANGE      ${line}`);
}

console.log("");
console.log("==============================================================================");
if (fails) {
  console.log(`### ${fails} MCF GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("==============================================================================");
  console.log("");
  process.exit(1);
}
console.log("### ALL MCF GATES PASSED ###");
console.log("==============================================================================");
console.log("");
