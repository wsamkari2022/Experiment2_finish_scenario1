/**
 * audit_block5_run.cjs — walks synthetic participants through all five Block 5 scenarios and
 * checks the two things that have to be right for any of the analysis to mean anything:
 *
 *   1. THE ALIGNMENT LABELS. Are they the documented shape (1 Aligned / 1 Weakly / 2 Misaligned /
 *      2 Strongly for six options), and does the label order always follow the fit-score order?
 *      A label that disagrees with its own score would corrupt VCI, Stability and the CVR trigger
 *      all at once, and would do it silently.
 *
 *   2. THE PROFILE MOVEMENT. Do the four policy values and the stakeholder sensitivity move in the
 *      right DIRECTION, by a sane amount, and stay inside 0-100 across a whole five-scenario run?
 *
 * This is an audit, not a gate: it prints what happened so a human can read it. Run it after any
 * change to labeling or to the bump constants.
 *
 * Run:  node tools/audit_block5_run.cjs
 */
const path = require("node:path");
const fs = require("node:fs");

const BUILD = path.join(__dirname, "..", ".sim-build");
if (!fs.existsSync(BUILD)) {
  console.error("  .sim-build is missing. Run:  npx tsc -p tools/tsconfig.sim.json");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));
const B = (f) => require(path.join(BUILD, f));

const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { POLICY_DIM_KEYS, POLICY_DIM_SHORT } = B("block5Types.js");
const CVR = B("block5CVR.js");

const STAKE = "stakeholderPerspectiveShiftSensitivity";
const ALL_KEYS = [...POLICY_DIM_KEYS, STAKE, "directnessSensitivity", "contextSensitivity"];

let problems = [];
const flag = (msg) => problems.push(msg);

/** A profile shaped the way the app builds it. */
function makeProfile(scores) {
  return {
    dimensions: ALL_KEYS.map((k) => ({
      key: k,
      label: POLICY_DIM_SHORT[k] || k,
      score: scores[k] !== undefined ? scores[k] : 50,
      rank: 0,
      weight: 0,
    })),
  };
}
const scoreOf = (p, k) => p.dimensions.find((d) => d.key === k).score;

const PARTICIPANTS = {
  "protector      ": { vulnerabilityProtectionSensitivity: 90, groupSizeSensitivity: 40, gainResponsivenessSensitivity: 20, outcomeAggregationSensitivity: 45 },
  "maximiser      ": { vulnerabilityProtectionSensitivity: 25, groupSizeSensitivity: 85, gainResponsivenessSensitivity: 75, outcomeAggregationSensitivity: 88 },
  "middle-of-road ": { vulnerabilityProtectionSensitivity: 55, groupSizeSensitivity: 55, gainResponsivenessSensitivity: 50, outcomeAggregationSensitivity: 55 },
  "low demand     ": { vulnerabilityProtectionSensitivity: 18, groupSizeSensitivity: 22, gainResponsivenessSensitivity: 30, outcomeAggregationSensitivity: 20 },
  "very high      ": { vulnerabilityProtectionSensitivity: 96, groupSizeSensitivity: 94, gainResponsivenessSensitivity: 90, outcomeAggregationSensitivity: 97 },
};

/* Four behaviors, so the update paths all get exercised. */
const BEHAVIORS = {
  "always top card":     (labeled) => labeled[0],
  "always bottom card":  (labeled) => labeled[labeled.length - 1],
  "always 3rd card":     (labeled) => labeled[2],
  "alternating":         (labeled, i) => (i % 2 ? labeled[0] : labeled[labeled.length - 1]),
};

console.log("\n================================================================================");
console.log("  1. ALIGNMENT LABELS  —  shape and ordering, every profile x every scenario");
console.log("================================================================================");
const EXPECTED = { aligned: 1, weakly_aligned: 1, misaligned: 2, strongly_misaligned: 2 };
let labelChecks = 0;
for (const [pname, scores] of Object.entries(PARTICIPANTS)) {
  const profile = makeProfile(scores);
  for (const sc of BLOCK5_SCENARIOS) {
    const labeled = CVR.labelOptions(sc.options, profile);
    labelChecks++;

    const counts = {};
    labeled.forEach((o) => { counts[o.level] = (counts[o.level] || 0) + 1; });
    for (const [lvl, n] of Object.entries(EXPECTED)) {
      if ((counts[lvl] || 0) !== n) {
        flag(`label shape wrong: ${pname.trim()} / ${sc.id} -> ${lvl} appeared ${counts[lvl] || 0}x, expected ${n}`);
      }
    }
    // the label order must never contradict the fit-score order
    for (let i = 1; i < labeled.length; i++) {
      if (labeled[i].matchScore > labeled[i - 1].matchScore + 1e-9) {
        flag(`label order contradicts fit score: ${pname.trim()} / ${sc.id} at rank ${i + 1}`);
      }
    }
    // the top-ranked option must be the highest scorer, and it must be labeled "aligned"
    const best = Math.max(...labeled.map((o) => o.matchScore));
    if (Math.abs(labeled[0].matchScore - best) > 1e-9 || labeled[0].level !== "aligned") {
      flag(`rank 1 is not the best-fitting option: ${pname.trim()} / ${sc.id}`);
    }
  }
}
console.log(`  ${labelChecks} profile x scenario label sets checked ` +
            `(${labelChecks * 6} option labels).`);
console.log(`  Expected shape per scenario: 1 Aligned, 1 Weakly, 2 Misaligned, 2 Strongly.`);
console.log(`  ${problems.length === 0 ? "All correct." : problems.length + " problem(s) - see below."}`);

console.log("\n================================================================================");
console.log("  2. PROFILE MOVEMENT ACROSS A FULL FIVE-SCENARIO RUN");
console.log("================================================================================");
console.log("  columns: vuln / harm / gain / helped  |  stakeholder\n");

const headroomNotes = [];
for (const [pname, scores] of Object.entries(PARTICIPANTS)) {
  for (const [bname, pick] of Object.entries(BEHAVIORS)) {
    let profile = makeProfile(scores);
    let misalignedPicks = 0;
    const start = POLICY_DIM_KEYS.map((k) => scoreOf(profile, k));
    const startStake = scoreOf(profile, STAKE);

    BLOCK5_SCENARIOS.forEach((sc, i) => {
      const labeled = CVR.labelOptions(sc.options, profile);
      const chosen = pick(labeled, i);
      const w = sc.stakesWeight === undefined ? 1 : sc.stakesWeight;

      const before = ALL_KEYS.reduce((a, k) => (a[k] = scoreOf(profile, k), a), {});
      if (CVR.isMisaligned(chosen.level)) {
        misalignedPicks++;
        // half the time they keep it after the vignette, half they end in APA
        if (i % 2 === 0) {
          profile = CVR.applyEndorsementUpdates(profile, chosen, true, i % 4 === 0, null, w);
        } else {
          profile = CVR.applyApaUpdates(profile, chosen, "endorse", i % 3 === 0,
            POLICY_DIM_KEYS[i % POLICY_DIM_KEYS.length], null, w);
        }
      } else {
        profile = CVR.applyKeepUpdates(profile, chosen, chosen.level, w);
      }

      for (const k of ALL_KEYS) {
        const v = scoreOf(profile, k);
        if (!Number.isFinite(v)) flag(`NaN/Inf on ${k}: ${pname.trim()} / ${bname} / ${sc.id}`);
        if (v < 0 || v > 100) flag(`out of range (${v}) on ${k}: ${pname.trim()} / ${bname} / ${sc.id}`);
      }

      /*
       * DIRECTION CHECK. When a misaligned option is endorsed, the value that option SERVES must
       * rise and the value it went AGAINST must fall. A sign error here would be invisible on the
       * screen and would invert every drift finding in the study.
       */
      if (CVR.isMisaligned(chosen.level) && i % 2 === 0) {
        const served = CVR.optionMainValue(chosen);
        const against = CVR.violatedValue(chosen, { dimensions: Object.keys(before).map((k) => ({ key: k, score: before[k] })) });
        if (scoreOf(profile, served) < before[served] - 1e-9) {
          flag(`endorsed value FELL: ${pname.trim()} / ${bname} / ${sc.id} / ${served}`);
        }
        if (against && against !== served && scoreOf(profile, against) > before[against] + 1e-9) {
          flag(`displaced value ROSE: ${pname.trim()} / ${bname} / ${sc.id} / ${against}`);
        }
      }
    });

    const end = POLICY_DIM_KEYS.map((k) => scoreOf(profile, k));
    const endStake = scoreOf(profile, STAKE);
    const moved = end.map((v, j) => v - start[j]);
    const totalMove = moved.reduce((a, b) => a + Math.abs(b), 0);

    console.log(`  ${pname} ${bname.padEnd(19)} ` +
      start.map((v) => String(Math.round(v)).padStart(3)).join(" ") + "  ->  " +
      end.map((v) => String(Math.round(v)).padStart(3)).join(" ") +
      `   | stake ${String(Math.round(startStake)).padStart(3)} -> ${String(Math.round(endStake)).padStart(3)}` +
      `   | total move ${totalMove.toFixed(1).padStart(5)}`);

    if (totalMove < 0.5) flag(`profile did not move at all: ${pname.trim()} / ${bname}`);
    /*
     * Stakeholder sensitivity is only expected to move when a stakeholder actually spoke, and one
     * only speaks after a MISALIGNED choice. A participant who picks the aligned card five times
     * never meets one, so a flat 50 is the correct answer, not a bug - the earlier version of this
     * check flagged all five of those runs and was wrong to.
     */
    if (misalignedPicks > 0 && Math.abs(endStake - startStake) < 0.5) {
      flag(`stakeholder sensitivity never moved despite ${misalignedPicks} misaligned pick(s): ${pname.trim()} / ${bname}`);
    }
    if (misalignedPicks === 0 && Math.abs(endStake - startStake) > 0.5) {
      flag(`stakeholder sensitivity moved with NO misaligned pick: ${pname.trim()} / ${bname}`);
    }
    headroomNotes.push({ name: pname.trim(), behavior: bname, start: start.slice(), totalMove });
  }
  console.log("");
}

console.log("================================================================================");
console.log("  3. MOVEMENT BY STARTING POSITION  —  a property worth stating in the write-up");
console.log("================================================================================");
/*
 * Deltas are FLAT since 2026-08-31: +30 means +30 wherever the value sits. The remaining
 * difference between participants is the CEILING - somebody starting at 96 can only rise 4 points
 * before `clamp` swallows the rest, so their later movement stops registering. That is the cost of
 * the flat rule and the reason this section still exists.
 */
const byName = {};
headroomNotes.forEach((h) => {
  byName[h.name] = byName[h.name] || [];
  byName[h.name].push(h.totalMove);
});
for (const [name, moves] of Object.entries(byName)) {
  const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
  const startMean = PARTICIPANTS[Object.keys(PARTICIPANTS).find((k) => k.trim() === name)];
  const avgStart = POLICY_DIM_KEYS.reduce((a, k) => a + startMean[k], 0) / POLICY_DIM_KEYS.length;
  console.log(`  ${name.padEnd(15)} starts at an average of ${avgStart.toFixed(0).padStart(3)}` +
              `  ->  moves ${mean.toFixed(1).padStart(5)} points over the run`);
}

console.log("\n================================================================================");
if (problems.length === 0) {
  console.log("  VERDICT: no problems found.\n");
} else {
  console.log(`  VERDICT: ${problems.length} problem(s)\n`);
  problems.slice(0, 25).forEach((p) => console.log("   - " + p));
  console.log("");
}
