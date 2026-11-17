#!/usr/bin/env node
/**
 * simulate_records.cjs — complete PRETEND participant records, made by the study's own code (17 November 2026).
 *
 * WHY. The registration promises that "the analysis code is written and run on simulated participants before the data
 * are opened" (OSF page 6). Records good enough for that must have every field a real record has, in the same shape,
 * made by the same code. So this tool does not write a record by hand. It plays each pretend person through the study
 * in a pretend browser, and lets the study's own code do everything it does in a real browser:
 *
 *   Blocks 1-3   the answers are written as the blocks write them (with a time on every answer); the study's own
 *                deriveAndSaveInsights, saveFinalAnalysis and captureParticipantRecord run after Blocks 3 and 4, and
 *                the Block 5 profile comes from buildThresholdTree + extractBlock5Profile, as in ExperimentFlow.tsx;
 *   Block 5      every scenario runs the page's own rules (Block5PublicEmergencySimulation.tsx: handleSelect,
 *                commitChoice, handleApaCommit, handleKeep, handleConfirmEndorsement, the CVR Rejection page,
 *                finalizeScenario), calling the same functions with the same profiles: labelOptions on the profile the
 *                scenario is shown on (profileShownIn), plannerRank on the profile brought into Block 5, the four
 *                conditions' update rules, runningStep, predictChoice in scenario 6. The few page functions that are
 *                not exported (the telemetry counters, the scenario-6 shuffle) are copied here word for word and marked;
 *   attention    readAttention draws each person's plan; recordAttentionAnswer saves each answer;
 *   feedback     computeWellbeing, assembleFeedbackRecord and saveFeedbackRecord, as UserFeedbackPage.tsx calls them;
 *   timings      the study's own markStage, on a pretend clock;
 *   database     storage.ts's own syncBlocks, with a pretend server that writes every section where the real server
 *                writes it ($set at the dotted path). So every `analysis.*` section, the headline, the major scores,
 *                quality and the rest are built by dbShape.ts exactly as for a real participant.
 *
 * Only the CHOICES are pretend: who picks which option, who keeps a misaligned choice, how fast, how they rate. The
 * behaviour rules are in BEHAVIOUR below, stated so a reader can disagree with them, and every person's settings go
 * into the truth file. The made-up Prolific IDs are 24 letters a-f and digits ("cafe" + 20 more), like the testing IDs
 * of CLAUDE.md; none is a real person.
 *
 * NOT DATA. Nothing this tool writes may be reported as a finding.
 *
 * Run:
 *   node tools/simulate_records.cjs --out=<records.json> [--truth=<truth.json>] [--counts=27,27,26,27] [--seed=20261117]
 *        [--no-compile] [--compact] [--first-number=N]
 * --counts is the number of finished records per condition (CVR+APA, CVR_Only, APA_Only, Baseline); the first analysis
 * uses 107 (27 / 27 / 26 / 27). Same seed, same records, to the byte. --compact writes the JSON without line breaks
 * (for the large pools of check_on_simulated.py).
 */
"use strict";
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");

/* ------------------------------------------------------------------ the command line */
const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const OUT = arg("out", null);
const TRUTH = arg("truth", null);
const COUNTS = arg("counts", "27,27,26,27").split(",").map((x) => Number(x));
const SEED = Number(arg("seed", "20261117"));
const FIRST = Number(arg("first-number", "0"));    // the first pretend person's number (pools made in parts stay unique)
if (!OUT || COUNTS.length !== 4 || COUNTS.some((n) => !Number.isInteger(n) || n < 0) || !Number.isFinite(SEED)) {
  console.error("  Usage: node tools/simulate_records.cjs --out=<records.json> [--truth=<truth.json>] [--counts=27,27,26,27] [--seed=N]");
  process.exit(1);
}

/* ------------------------------------------------------------------ compile the study's code */
if (!process.argv.includes("--no-compile")) {
  for (const cfg of ["tools/tsconfig.sim.json", "tools/tsconfig.dbshape.json"]) {
    try {
      execFileSync("npx", ["tsc", "-p", cfg], { cwd: ROOT, encoding: "utf8", shell: true });
    } catch { /* errors in files this tool does not use are not its business; the artifacts are checked below */ }
  }
}
for (const f of ["storage.js", "dbShape.js", "block5CVR.js", "block5Planner.js", "interBlockData.js", "participantRecord.js",
  "attentionChecks.js", "feedbackTypes.js", "telemetry.js"]) {
  if (!fs.existsSync(path.join(BUILD, f))) {
    console.error(`  .sim-build/${f} was not produced. Run:  npx tsc -p tools/tsconfig.sim.json  and  npx tsc -p tools/tsconfig.dbshape.json`);
    process.exit(1);
  }
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));

/* ------------------------------------------------------------------ a pretend browser, a pretend clock, fixed chance */
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
};
global.window = { addEventListener() {}, removeEventListener() {}, location: { search: "", href: "", pathname: "/" } };
global.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };

/* The clock: every Date the study's code makes reads it, so the same seed gives the same records to the byte. */
const RealDate = Date;
let NOW = RealDate.UTC(2026, 10, 16, 13, 25, 0);
class SimDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
global.Date = SimDate;
const tick = (ms) => { NOW += Math.max(0, Math.round(ms)); };

/** mulberry32: a small seeded generator. One for this tool's choices, one in place of Math.random for the study's code. */
function seeded(a) {
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(SEED);
Math.random = seeded(SEED ^ 0x5bd1e995);
const between = (lo, hi) => lo + rand() * (hi - lo);
const chance = (p) => rand() < p;
const pickOne = (list) => list[Math.floor(rand() * list.length)];
const normal = () => { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const logNormalMs = (medianSeconds, spread) => 1000 * medianSeconds * Math.exp(spread * normal());
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------------------ the study's own code */
const B = (f) => require(path.join(BUILD, f));
const storage = B("storage.js");
const CVR = B("block5CVR.js");
const { capturedOf, menuRange, overallCaptured, capturedLabel } = B("block5Performance.js");
const { plannerRank, PLANNER_VERSION } = B("block5Planner.js");
const { deriveDecisionProfile } = B("block5Thresholds.js");
const { profileShownIn } = B("block5Mirror.js");
const { deriveCompanyValues } = B("block5Company.js");
const { runningStep, computeVciAll } = B("block5VciAll.js");
const { computeStabilityAll } = B("block5StabilityAll.js");
const { predictChoice } = B("block5Prediction.js");
const { pickWhoVariant } = B("block5CVRContent.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");
const { BLOCK5_RESULTS_KEY } = B("block5Types.js");
const { extractBlock5Profile } = B("block5Profile.js");
const { buildThresholdTree } = B("thresholdTree.js");
const { deriveAndSaveInsights, saveFinalAnalysis } = B("interBlockData.js");
const { captureParticipantRecord } = B("participantRecord.js");
const ATT = B("attentionChecks.js");
const FB = B("feedbackTypes.js");
const { markStage } = B("telemetry.js");
const { SESSION_KEY_RESULTS, AMOUNT_LABELS, AMOUNT_VALUES } = B("constants.js");
const { TROLLEY_RESULTS_STORAGE_KEY, SAVED_LIVES_OPTIONS } = B("trolleyTypes.js");
const { AI_WORKFORCE_RESULTS_KEY, GAIN_OPTIONS, WORKER_GROUPS, WORKER_GROUP_SIZES } = B("aiWorkforceTypes.js");
const { ACTIVE_TIME_KEY } = B("activeTime.js");
const { CONDITION_KEY, CONDITIONS } = B("conditions.js");
const { RESULTS_PAGE_KEY } = B("resultsPageRecord.js");
const { SESSION_LOG_KEY } = B("sessionLog.js");
const { SESSION_ID_KEY } = B("session.js");
const { SHOW_STAKEHOLDER_PAGE } = B("blocksLegacyMethodology.js");
const recipe = require("./regenerate_sensitivity_calibration.cjs");

const CONSENT_VERSION = (/PROLIFIC_CONSENT_VERSION = "([^"]+)"/.exec(
  fs.readFileSync(path.join(ROOT, "src", "experiment", "ConsentPage.tsx"), "utf8")) ?? [])[1];
if (!CONSENT_VERSION || !SHOW_STAKEHOLDER_PAGE) {
  console.error("  The consent version or the person page could not be read from the code; this tool would be out of date.");
  process.exit(1);
}
const POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity",
  "gainResponsivenessSensitivity", "outcomeAggregationSensitivity"];
const isFit = (level) => level === "aligned" || level === "weakly_aligned";

/* ==================================================================================================================
 * BEHAVIOUR: how the pretend people choose. An assumption, stated in full, and written into the truth file.
 * ================================================================================================================== */
const BEHAVIOUR = {
  randomShare: 0.15,          // answer everything by chance (Blocks 1-3 as the scoring tables' random people; Block 5 at random)
  fitWeight: [0.25, 0.9],     // steady people: how much 10 points of fit add to an option's appeal (drawn per person)
  firstCardWeight: [0, 0.8],  // steady people: extra appeal of the first card (half of it for the second)
  keepAtReflection: 0.55,     // CVR+APA and CVR_Only: "Yes, still" at the reflection
  personMoves: 0.3,           // ... and the person speaking changes their mind
  apaNamesTopValue: 0.6,      // APA page: names their current #1 value ...
  apaNamesOptionValue: { "CVR+APA": 0.15, APA_Only: 0.3 },   // ... or the value the chosen option serves most (APA_Only's box names it)
  apaTakesBestFit: 0.6,       // APA list: takes the option that fits best, otherwise one at random
  apaBails: 0.05,             // leaves the APA page without choosing
  baselineKeeps: 0.6,         // Baseline: "Keep this choice" for a misaligned choice
  baselineGoodFitBacksOut: 0.05,
  reselectFitBoost: { CVR_Only: 1.8, Baseline: 1.3, other: 1.5 },  // how much more fit counts when choosing again
  reflectionBacksOut: 0.04,   // leaves the reflection page
  scenario6ChangesRule: { steady: 0.15, random: 0.3 },
  scenario6ChangeToTop: 0.5,
  fastScenarios: 0.06,        // decides scenarios in 5-14 seconds
  fastBlocks: 0.05,           // answers Blocks 1-3 about a second apart
  straightliner: 0.03,        // the same answer to every feedback rating
  attentionRightSteady: 0.97, // each attention check answered as instructed
  wellbeingFromVci: 0.35,     // the well-being answers lean with VCI (a planted link, so the pipeline sees one)
};

/* ------------------------------------------------------------------ Blocks 1-3: the answers, in the blocks' own shapes */
/** One person's Blocks 1-3 answers as plain numbers (steady people: tools/report_planner_overlap.cjs's steadyAnswers). */
function plainAnswers(kind) {
  if (kind === "random") {
    /* The scoring tables' random people (regenerate_sensitivity_calibration.cjs), read back into plain numbers. */
    const a = recipe.randomAnswers(rand);
    const m = (k) => (a.money.thresholds[`threshold_${k}`].accepted ? a.money.thresholds[`threshold_${k}`].thresholdAmountIndex : 8);
    const refusal = ["sidewalk", "wealthy", "shelter"].map((k) => a.money.history.find((h) => h.contextKey === k)?.action ?? "return");
    const lad = (t) => (t.accepted ? t.thresholdIndex : 8);
    const cell = (g, s) => { const t = a.ai.thresholds[`threshold_${g}_${s}`]; return t.accepted ? t.thresholdGainIndex : 6; };
    return {
      money: [m("sidewalk"), m("wealthy"), m("shelter")], refusal,
      trolley: [lad(a.trolley.leverThreshold), lad(a.trolley.bridgeThreshold)],
      entry: ["small", "medium", "large"].map((s) => cell("lowbuffer", s)),
      senior: ["small", "medium", "large"].map((s) => cell("highbuffer", s)),
      block4: a.block4,
    };
  }
  /* Copied from tools/report_planner_overlap.cjs (steadyAnswers), drawn with this tool's generator. */
  const upTo = (n) => Math.floor(rand() * (n + 1));
  const wobble = () => (rand() < 0.25 ? pickOne([-1, 1]) : 0);
  const base = upTo(6);
  const entryExtra = pickOne([0, 0, 1, 1, 2]);
  const sizeExtra = pickOne([0, 0, 1, 1, 2]);
  const entry = [0, 1, 2].map((s) => clamp(base + entryExtra + Math.round((sizeExtra * s) / 2) + wobble(), 0, 6));
  const senior = [0, 1, 2].map((s) => clamp(base + Math.round((sizeExtra * s) / 2) + wobble(), 0, 6));
  const keep = upTo(8);
  const lever = upTo(8);
  const initial = pickOne(["proceed", "do_not_proceed"]);
  const final = rand() < 0.15 ? (initial === "proceed" ? "do_not_proceed" : "proceed") : initial;
  return {
    money: [keep, clamp(keep - pickOne([0, 0, 1]), 0, 8), clamp(keep + pickOne([0, 1, 2, 3]), 0, 8)],
    refusal: [pickOne(["return", "return", "donate"]), "return", pickOne(["return", "return", "donate"])],
    trolley: [lever, clamp(lever + pickOne([0, 1, 2]), 0, 8)],
    entry, senior,
    block4: {
      initialDecision: initial, midDecision: initial, finalDecision: final,
      confidence: 1 + upTo(4), initialConfidence: 1 + upTo(4), reportedInfluence: rand() < 0.5, influentialValence: null,
    },
  };
}

/** The pause between two answers in Blocks 1-3. */
const answerGap = (fast) => (fast ? logNormalMs(1.1, 0.35) : logNormalMs(4.5, 0.6));

/** Block 1, as the block saves it: three places, an answer per amount until the money is kept (or all eight refused). */
function moneyFile(p, sessionId, fast) {
  const places = ["sidewalk", "wealthy", "shelter"];
  const labels = { sidewalk: "Public sidewalk", wealthy: "Outside a wealthy home", shelter: "Outside a homeless shelter" };
  const history = [];
  const thresholds = {};
  places.forEach((place, i) => {
    const stop = p.money[i];
    for (let step = 0; step < Math.min(stop + 1, 8); step++) {
      tick(answerGap(fast));
      history.push({
        contextKey: place, contextLabel: labels[place], amountIndex: step, amountValue: AMOUNT_VALUES[step],
        amountLabel: AMOUNT_LABELS[step], action: step < stop ? p.refusal[i] : "keep", timestamp: new Date().toISOString(),
      });
    }
    thresholds[`threshold_${place}`] = stop >= 8
      ? { contextKey: place, accepted: false, thresholdAmount: null, thresholdLabel: null, thresholdAmountIndex: null, thresholdBeyondRange: true }
      : { contextKey: place, accepted: true, thresholdAmount: AMOUNT_VALUES[stop], thresholdLabel: AMOUNT_LABELS[stop],
          thresholdAmountIndex: stop, thresholdBeyondRange: false };
  });
  return { participantId: sessionId, completed: true, completedAt: new Date().toISOString(), thresholds, history };
}

/** Block 2: pull the lever, then push; how many lives before acting (8 = never). */
function trolleyFile(p, sessionId, fast) {
  const history = [];
  const ladder = (phase, v) => {
    for (let step = 0; step < Math.min(v + 1, 8); step++) {
      tick(answerGap(fast));
      history.push({ phase, savedLivesIndex: step, savedLivesValue: SAVED_LIVES_OPTIONS[step],
        action: step < v ? "do_not_act" : "act", timestamp: new Date().toISOString() });
    }
    return v >= 8
      ? { scenarioType: phase, accepted: false, thresholdIndex: null, thresholdSavedLives: null }
      : { scenarioType: phase, accepted: true, thresholdIndex: v, thresholdSavedLives: SAVED_LIVES_OPTIONS[v] };
  };
  const leverThreshold = ladder("lever", p.trolley[0]);
  const bridgeThreshold = ladder("bridge", p.trolley[1]);
  return {
    participantId: sessionId, completed: true, completedAt: new Date().toISOString(),
    leverThreshold, bridgeThreshold,
    summary: { leverAcceptedValue: leverThreshold.thresholdSavedLives ?? null, bridgeAcceptedValue: bridgeThreshold.thresholdSavedLives ?? null },
    history,
  };
}

/** Block 3: six cells (two kinds of worker x three group sizes), the gain at which the rollout is approved (6 = never). */
function aiFile(p, sessionId, fast) {
  const history = [];
  const thresholds = {};
  for (const [groupKey, short, list] of [["low_buffer", "lowbuffer", p.entry], ["high_buffer", "highbuffer", p.senior]]) {
    const group = WORKER_GROUPS.find((g) => g.key === groupKey);
    WORKER_GROUP_SIZES.forEach((size, i) => {
      const v = list[i];
      for (let step = 0; step < Math.min(v + 1, 6); step++) {
        tick(answerGap(fast));
        history.push({ groupTypeKey: groupKey, groupTypeLabel: group.label, groupSizeKey: size.key, groupSizeLabel: size.label,
          groupSizeCount: size.count ?? null, gainIndex: step, gainValue: GAIN_OPTIONS[step].value, gainLabel: GAIN_OPTIONS[step].label,
          action: step < v ? "do_not_approve" : "approve", timestamp: new Date().toISOString() });
      }
      thresholds[`threshold_${short}_${size.key}`] = {
        groupTypeKey: groupKey, groupTypeLabel: group.label, groupSizeKey: size.key, groupSizeLabel: size.label,
        groupSizeCount: size.count ?? null, accepted: v < 6,
        thresholdGain: v < 6 ? GAIN_OPTIONS[v].value : null, thresholdGainLabel: v < 6 ? GAIN_OPTIONS[v].label : null,
        thresholdGainIndex: v < 6 ? v : null, thresholdBeyondRange: v >= 6, blockedByPriorNonAcceptance: false, startedAtGainIndex: 0,
      };
    });
  }
  return { participantId: sessionId, completed: true, completedAt: new Date().toISOString(), thresholds, history };
}

/* ------------------------------------------------------------------ the page's own private pieces, copied word for word */
/* From Block5PublicEmergencySimulation.tsx: newTelemetryAccum. */
function newTelemetryAccum() {
  return {
    startedAt: Date.now(),
    cvrVisits: 0, apaVisits: 0, optionChanges: 0, cvrBackouts: 0, apaBackouts: 0,
    personVisits: 0, personBackouts: 0,
    finalDecisionChanges: 0, previewImpactOpens: 0, optionExpands: 0, compareChartsOpens: 0,
    timeToFirstSelectionMs: null, cvrDwellMs: 0, apaDwellMs: 0,
    mcfReadingsOpened: 0, mcfRead: new Set(), mcfDwellMs: 0, mcfOpenedAt: null,
    distinct: new Set(), lastSelectedId: null, cvrShownAt: null, apaShownAt: null,
    cvrRejectionVisits: 0, cvrRejectionBackouts: 0, cvrRejectionDwellMs: 0, cvrRejectionShownAt: null,
    secondViewOpened: false, baselineConfirmVisits: 0, baselineConfirmBackouts: 0,
    baselineGoodFitConfirmVisits: 0, baselineGoodFitConfirmBackouts: 0,
  };
}
/* From Block5PublicEmergencySimulation.tsx: buildScenarioTelemetry. */
function buildScenarioTelemetry(t, opts) {
  const now = Date.now();
  let cvrDwellMs = t.cvrDwellMs;
  let apaDwellMs = t.apaDwellMs;
  if (t.cvrShownAt != null) cvrDwellMs += Math.max(0, now - t.cvrShownAt);
  if (t.apaShownAt != null) apaDwellMs += Math.max(0, now - t.apaShownAt);
  const cvrRejectionDwellMs = t.cvrRejectionDwellMs
    + (t.cvrRejectionShownAt != null ? Math.max(0, now - t.cvrRejectionShownAt) : 0);
  return {
    cvrTriggered: opts.cvrFired || t.cvrVisits > 0,
    apaTriggered: t.apaVisits > 0,
    cvrVisits: t.cvrVisits,
    apaVisits: t.apaVisits,
    cvrOutcome: opts.cvrOutcome,
    apaOutcome: opts.apaOutcome,
    numberOfSwitches: t.optionChanges + t.cvrBackouts + t.apaBackouts + t.personBackouts + t.finalDecisionChanges
      + t.cvrRejectionBackouts + t.baselineConfirmBackouts,
    initialSelections: t.distinct.size,
    optionChanges: t.optionChanges,
    cvrBackouts: t.cvrBackouts,
    apaBackouts: t.apaBackouts,
    finalDecisionChanges: t.finalDecisionChanges,
    timeToFirstSelectionMs: t.timeToFirstSelectionMs,
    previewImpactOpens: t.previewImpactOpens,
    optionExpands: t.optionExpands,
    mcfReadingsOpened: t.mcfReadingsOpened,
    mcfOptionsRead: [...t.mcfRead],
    mcfDwellMs: t.mcfDwellMs + (t.mcfOpenedAt === null ? 0 : Date.now() - t.mcfOpenedAt),
    compareChartsOpens: t.compareChartsOpens,
    cvrDwellMs,
    apaDwellMs,
    ...(t.cvrRejectionVisits > 0 ? { cvrRejectionVisits: t.cvrRejectionVisits, cvrRejectionDwellMs } : {}),
    ...(t.secondViewOpened ? { secondViewOpened: true } : {}),
    ...(t.baselineConfirmVisits > 0
      ? { baselineConfirmVisits: t.baselineConfirmVisits, baselineConfirmBackouts: t.baselineConfirmBackouts } : {}),
    ...(t.baselineGoodFitConfirmVisits > 0
      ? { baselineGoodFitConfirmVisits: t.baselineGoodFitConfirmVisits, baselineGoodFitConfirmBackouts: t.baselineGoodFitConfirmBackouts }
      : {}),
  };
}
/* From Block5PublicEmergencySimulation.tsx: shuffleForParticipant (scenario 6's order, from the session id). */
function shuffleForParticipant(items, scenarioId) {
  let seed = 0;
  const key = (localStorage.getItem("vrds_session_id") ?? "") + scenarioId;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  const next = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0x100000000; };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const policyScoresOf = (profile) => Object.fromEntries(POLICY.map((k) => [k, profile.dimensions.find((d) => d.key === k)?.score ?? 0]));
const framingScoresOf = (profile) => ({
  directnessSensitivity: profile.dimensions.find((d) => d.key === "directnessSensitivity")?.score ?? 0,
  contextSensitivity: profile.dimensions.find((d) => d.key === "contextSensitivity")?.score ?? 0,
});

/* ------------------------------------------------------------------ Block 5, one scenario at a time, as the page does it */
/** Which option a person picks from the cards on screen. */
function pickFrom(display, person, fitBoost = 1) {
  if (person.kind === "random") return pickOne(display);
  let best = null, bestU = -Infinity;
  display.forEach((o, i) => {
    const gumbel = -Math.log(-Math.log(Math.max(1e-12, rand())));
    const u = (person.fitWeight * fitBoost * o.matchScore) / 10 + person.firstCardWeight * (i === 0 ? 1 : i === 1 ? 0.5 : 0) + gumbel;
    if (u > bestU) { bestU = u; best = o; }
  });
  return best;
}

function runBlock5(person, userProfile, moralProfile, condition, attentionFile) {
  const apaOnly = condition === "APA_Only";
  const baseline = condition === "Baseline";
  const cvrOnly = condition === "CVR_Only";
  const frozen = apaOnly || baseline;              // freezesReflectionScores
  const decisionProfile = deriveDecisionProfile(userProfile, moralProfile);
  const progress = { results: [], profile: userProfile, runningProfile: undefined };
  const fastHere = person.fastScenarios;

  for (let index = 0; index < BLOCK5_SCENARIOS.length; index++) {
    const scenario = BLOCK5_SCENARIOS[index];
    /* The reading check between scenarios (Block5PublicEmergencySimulation: readingCheckBeforeScenario), before the clock. */
    if (ATT.readingCheckBeforeScenario(ATT.readAttention(), index)) answerReadingCheck(person, "between_scenarios");
    const scenarioStartTime = Date.now();
    const tel = newTelemetryAccum();
    const introSeconds = Math.round(fastHere ? between(2, 5) : between(8, 35));
    tick(introSeconds * 1000);
    const plan = plannerRank(scenario, decisionProfile);
    const predictionTest6 = CVR.isPredictionTest(scenario);
    let firstChoiceId = null;
    const rejection = { scenarioId: null, moved: false, moves: [], visits: [], openedAt: null };
    let attempts = 0;
    let fitBoost = 1;
    let committed = null;     // { row, nextProfile }
    /* Scenario 6's log and its frozen guess (computed once, from the profile before this scenario). */
    const predLog = { guessShownAt: null, lastId: null, switchesBefore: 0, switchesAfter: 0, openedBefore: new Set(), openedAfter: new Set(), events: [] };
    const logPred = (what, extra) => { if (predictionTest6) predLog.events.push({ atMs: Date.now() - scenarioStartTime, what, ...(extra ?? {}) }); };
    const prediction = predictionTest6
      ? predictChoice(scenario.options, progress.profile, {
          vci: CVR.computeVCI(progress.results).value, stability: CVR.computeStability(progress.results, userProfile).value,
        })
      : null;
    let predFirstChoiceId = null, predSoundsLike = null, predSurprised = null, predShownAt = null;
    const expanded = new Set();
    /* What the participant looked at before choosing: counted, never part of a rule. */
    const readingMs = fastHere ? logNormalMs(6, 0.3) : logNormalMs(45, 0.5);
    tel.optionExpands = person.kind === "random" ? Math.floor(between(0, 3)) : Math.floor(between(0, 5));
    tel.previewImpactOpens = scenario.decisionRole === "recipient" || predictionTest6 ? 0 : Math.floor(between(0, 3));
    tel.compareChartsOpens = chance(0.35) ? 1 : 0;

    while (!committed) {
      attempts += 1;
      const profile = progress.profile;
      const shown = profileShownIn(scenario.id, progress.results, userProfile, profile);
      const labeled = CVR.labelOptions(scenario.options, shown.profile);
      const byId = new Map(labeled.map((o) => [o.id, o]));
      const display = predictionTest6 ? shuffleForParticipant(labeled, scenario.id) : plan.orderedIds.map((id) => byId.get(id)).filter(Boolean);
      tick(attempts === 1 ? readingMs : logNormalMs(fastHere ? 3 : 15, 0.4));
      if (attempts === 1 && tel.compareChartsOpens && CVR.scenarioShowsPerformance(scenario) && !predictionTest6) {
        /* The MCF readings inside the Compare overlay (never in scenario 6). */
        const n = Math.floor(between(0, 3));
        for (let k = 0; k < n; k++) { tel.mcfReadingsOpened += 1; tel.mcfRead.add(pickOne(display).id); tel.mcfDwellMs += Math.round(logNormalMs(8, 0.4)); }
      }
      const opt = pickFrom(display, person, fitBoost);
      expanded.add(opt.id);

      /* handleSelect */
      if (tel.timeToFirstSelectionMs === null) tel.timeToFirstSelectionMs = Date.now() - tel.startedAt;
      if (tel.lastSelectedId !== null && tel.lastSelectedId !== opt.id) tel.optionChanges += 1;
      tel.lastSelectedId = opt.id;
      tel.distinct.add(opt.id);
      if (predictionTest6) {
        const afterGuess = predLog.guessShownAt !== null;
        const changed = predLog.lastId !== null && predLog.lastId !== opt.id;
        if (afterGuess) { if (changed) predLog.switchesAfter += 1; predLog.openedAfter.add(opt.id); }
        else { if (changed) predLog.switchesBefore += 1; predLog.openedBefore.add(opt.id); }
        predLog.lastId = opt.id;
      }
      logPred("selected", { optionId: opt.id });
      if (firstChoiceId === null) firstChoiceId = opt.id;
      const scored = CVR.scenarioIsScored(scenario);
      const misaligned = scored && CVR.isMisaligned(opt.level);
      const stakes = scenario.stakesWeight ?? 1;
      const lastTry = attempts >= 4;     // a person never loops for ever: the fourth choice is kept

      /* ---------------- a good fit, or a scenario that is not a decision: the review page, then Keep ---------------- */
      if (!misaligned) {
        if (baseline && scored) {
          tel.baselineGoodFitConfirmVisits += 1;
          if (!lastTry && chance(BEHAVIOUR.baselineGoodFitBacksOut)) { tel.baselineGoodFitConfirmBackouts += 1; tick(logNormalMs(5, 0.3)); continue; }
        }
        let predictionTest;
        if (predictionTest6 && predFirstChoiceId === null) {
          /* openPrediction, the two answers, then keep or change (the guess is never shown twice). */
          tick(logNormalMs(fastHere ? 2 : 6, 0.3));
          predFirstChoiceId = opt.id;
          predShownAt = Date.now();
          predLog.guessShownAt = Date.now();
          logPred("guess_shown", { optionId: opt.id });
          const top = prediction.options.find((o) => o.rank === 1);
          const hit = top.optionId === opt.id;
          tick(logNormalMs(fastHere ? 3 : 12, 0.4));
          predSoundsLike = person.kind === "random" ? 1 + Math.floor(rand() * 7) : clamp(Math.round((hit ? 5 : 3.5) + 1.2 * normal()), 1, 7);
          logPred("answered_sounds_like", { value: predSoundsLike });
          predSurprised = person.kind === "random" ? chance(0.5) : chance(hit ? 0.2 : 0.55);
          logPred("answered_surprised", { value: predSurprised ? "yes" : "no" });
          if (chance(BEHAVIOUR.scenario6ChangesRule[person.kind])) {
            logPred("changed_answer");
            const others = display.filter((o) => o.id !== opt.id);
            const target = top.optionId !== opt.id && chance(BEHAVIOUR.scenario6ChangeToTop) ? byId.get(top.optionId) : pickOne(others);
            tick(logNormalMs(fastHere ? 2 : 8, 0.4));
            /* handleSelect again (after the guess), then Keep */
            if (tel.lastSelectedId !== target.id) tel.optionChanges += 1;
            tel.lastSelectedId = target.id;
            tel.distinct.add(target.id);
            if (predLog.lastId !== null && predLog.lastId !== target.id) predLog.switchesAfter += 1;
            predLog.openedAfter.add(target.id);
            predLog.lastId = target.id;
            logPred("selected", { optionId: target.id });
            expanded.add(target.id);
            committed = keepRow(target, labeled, shown, scenario, profile, { predictionFor: target });
            break;
          }
          logPred("kept_answer");
        }
        committed = keepRow(opt, labeled, shown, scenario, profile, { predictionFor: predictionTest6 ? opt : null });
        break;
      }

      /* ---------------- a misaligned choice in a decision ---------------- */
      if (apaOnly) {
        tel.apaVisits += 1; tel.apaShownAt = Date.now();
        tick(logNormalMs(fastHere ? 4 : 30, 0.4));
        if (!lastTry && chance(BEHAVIOUR.apaBails)) {
          tel.apaDwellMs += Math.max(0, Date.now() - tel.apaShownAt); tel.apaShownAt = null; tel.apaBackouts += 1;
          fitBoost = BEHAVIOUR.reselectFitBoost.other; continue;
        }
        committed = apaCommit(opt, labeled, scenario, profile, { moved: false, saidYes: null, straightToApa: true });
        break;
      }
      if (baseline) {
        tel.baselineConfirmVisits += 1;
        tick(logNormalMs(fastHere ? 3 : 12, 0.4));
        const keeps = lastTry || (person.kind === "random" ? chance(0.5) : chance(BEHAVIOUR.baselineKeeps));
        if (keeps) {
          committed = keepRow(opt, labeled, shown, scenario, profile, { baselineMisfit: true });
          break;
        }
        tel.baselineConfirmBackouts += 1;   // handleChangeMyMind
        fitBoost = BEHAVIOUR.reselectFitBoost.Baseline;
        continue;
      }
      /* CVR+APA and CVR_Only: the reflection, then the person speaking. */
      tel.cvrVisits += 1; tel.cvrShownAt = Date.now();
      const who = pickWhoVariant(scenario, CVR.cvrCoordinate(opt, profile).who);
      tick(logNormalMs(fastHere ? 4 : 25, 0.4));
      if (!lastTry && chance(BEHAVIOUR.reflectionBacksOut)) {
        tel.cvrDwellMs += Math.max(0, Date.now() - tel.cvrShownAt); tel.cvrShownAt = null; tel.cvrBackouts += 1;
        fitBoost = BEHAVIOUR.reselectFitBoost.other; continue;
      }
      const saidYes = lastTry ? true : person.kind === "random" ? chance(0.5) : chance(BEHAVIOUR.keepAtReflection);
      tel.cvrDwellMs += Math.max(0, Date.now() - tel.cvrShownAt); tel.cvrShownAt = null;
      tel.personVisits += 1;
      tick(logNormalMs(fastHere ? 3 : 18, 0.4));
      const moved = lastTry ? false : chance(BEHAVIOUR.personMoves);
      const endsUpKeeping = saidYes ? !moved : moved;
      if (endsUpKeeping) {
        /* q1 (how firmly), then handleConfirmEndorsement */
        const q1Strong = person.kind === "random" ? chance(0.5) : chance(0.6);
        tick(logNormalMs(fastHere ? 2 : 8, 0.3));
        const update = CVR.applyEndorsementUpdatesWithMoves(profile, opt, q1Strong, moved, null, stakes);
        committed = commitChoice(opt, labeled, shown, scenario, profile, {
          nextProfile: update.profile, valueMoves: update.moves, endorsement: q1Strong ? "strong" : "weak", stakeholderGuided: moved,
          cvrWho: who,
        });
        break;
      }
      /* openRefusalPage */
      if (!cvrOnly) {
        tel.apaVisits += 1; tel.apaShownAt = Date.now();
        tick(logNormalMs(fastHere ? 4 : 30, 0.4));
        if (!lastTry && chance(BEHAVIOUR.apaBails)) {
          tel.apaDwellMs += Math.max(0, Date.now() - tel.apaShownAt); tel.apaShownAt = null; tel.apaBackouts += 1;
          fitBoost = BEHAVIOUR.reselectFitBoost.other; continue;
        }
        committed = apaCommit(opt, labeled, scenario, profile, { moved, saidYes, straightToApa: false, cvrWho: who });
        break;
      }
      /* CVR_Only: the CVR Rejection page, its moves on the first visit only, then back to all the options. */
      tel.cvrRejectionVisits += 1; tel.cvrRejectionShownAt = Date.now();
      if (rejection.scenarioId !== scenario.id) Object.assign(rejection, { scenarioId: scenario.id, moved: false, moves: [], visits: [], openedAt: null });
      const firstView = CVR.cvrCoordinate(opt, shown.profile).framing;
      let moves = [];
      if (!rejection.moved) {
        const update = CVR.applyCvrRejectionUpdatesWithMoves(profile, { stakeholderMoved: moved, bothViewsSeen: false, lastViewSeen: firstView, stakesWeight: stakes });
        moves = update.moves; rejection.moved = true; rejection.moves = update.moves;
        progress.profile = update.profile;
      }
      rejection.visits.push({ optionId: opt.id, at: new Date().toISOString(), firstViewShown: firstView, bothViewsSeen: false,
        lastViewSeen: firstView, saidYesAtReflection: saidYes, personChangedTheirMind: moved, movedValues: moves.length > 0, moves, seconds: null });
      rejection.openedAt = Date.now();
      tick(logNormalMs(fastHere ? 2 : 10, 0.3));
      /* handleRejectionBack */
      tel.cvrRejectionDwellMs += Math.max(0, Date.now() - tel.cvrRejectionShownAt); tel.cvrRejectionShownAt = null;
      tel.cvrRejectionBackouts += 1;
      const last = rejection.visits[rejection.visits.length - 1];
      last.seconds = Math.round((Date.now() - rejection.openedAt) / 100) / 10;
      rejection.openedAt = null;
      fitBoost = BEHAVIOUR.reselectFitBoost.CVR_Only;
    }

    /* ---------- the row's makers: commitChoice, handleKeep, handleApaCommit (the page's code, in its order) ---------- */
    function commitChoice(opt, labeled, shown, scenario, profile, opts) {
      const origLabeled = CVR.labelOptions(scenario.options, userProfile);
      const origLevel = origLabeled.find((o) => o.id === opt.id)?.level;
      const alignedToOriginal = origLevel === "aligned" || origLevel === "weakly_aligned";
      const cvrRan = CVR.scenarioIsScored(scenario) && CVR.isMisaligned(opt.level);
      const reflectionRan = cvrRan && !opts.baselineConfirm;
      const coord = reflectionRan ? CVR.cvrCoordinate(opt, profile) : undefined;
      const framingFields = {};
      if (reflectionRan) framingFields.cvrFramingShownFirst = CVR.chooseFraming(profile);
      tick(logNormalMs(fastHere ? 1 : 3, 0.3));
      const row = {
        ...framingFields,
        scenarioId: scenario.id,
        selectedOptionId: opt.id,
        selectedRank: opt.rank,
        topRankedOptionId: labeled[0]?.id ?? opt.id,
        selectedWasTopCandidate: opt.rank === 1,
        selectedWasCandidate: opt.level === "aligned" || opt.level === "weakly_aligned",
        rankedOptionIds: labeled.map((o) => o.id),
        fitScoresByOptionId: Object.fromEntries(labeled.map((o) => [o.id, o.matchScore])),
        candidateStatusByOptionId: Object.fromEntries(labeled.map((o) => [o.id, o.level === "aligned" || o.level === "weakly_aligned"])),
        viewedExplanationOptionIds: [...expanded],
        timeMs: Date.now() - scenarioStartTime,
        alignmentLevel: opt.level,
        matchScore: opt.matchScore,
        fitScoreScale: CVR.FIT_SCORE_SCALE,
        matchShortfall: CVR.roundForRecord(opt.matchShortfall),
        fitShortfallsByOptionId: Object.fromEntries(labeled.map((o) => [o.id, CVR.roundForRecord(o.matchShortfall)])),
        valueMoves: opts.valueMoves,
        scoredOnProfileOf: shown.borrowedFrom ?? undefined,
        firstChoiceOptionId: firstChoiceId ?? opt.id,
        postCVRChoiceOptionId: opt.id,
        cvrFired: cvrRan,
        reflectionShown: tel.cvrVisits > 0,
        ...(opts.baselineConfirm ? { reflectionShown: false, baselineConfirm: opts.baselineConfirm } : {}),
        ...(opts.howSureOnConfirm !== undefined ? { howSureOnConfirm: opts.howSureOnConfirm } : {}),
        cvrEndorsement: opts.endorsement,
        cvrCoordinate: coord,
        stakeholderGuided: opts.stakeholderGuided,
        alignedToOriginal,
        decisionRole: scenario.decisionRole ?? "decider",
        predictionTest: opts.predictionTest,
        introSeconds,
        vciScore: CVR.scenarioVciScore(opt.level, scenario.options.length),
        performanceScore: CVR.performanceScore(opt),
        performanceCaptured: capturedOf(scenario, opt),
        performanceMenu: { worst: Math.round(menuRange(scenario).worst), best: Math.round(menuRange(scenario).best) },
        metrics: CVR.optionMetrics(opt),
        cvrStakeholderShown: opts.cvrWho?.label,
        telemetry: buildScenarioTelemetry(tel, {
          cvrFired: reflectionRan,
          cvrOutcome: !CVR.isMisaligned(opt.level) ? "none" : opts.endorsement === "strong" ? "endorsed-strong"
            : opts.endorsement === "weak" ? "endorsed-weak" : "none",
          apaOutcome: "none",
        }),
      };
      return { row: JSON.parse(JSON.stringify(row)), nextProfile: opts.nextProfile };
    }

    function keepRow(opt, labeled, shown, scenario, profile, how) {
      const baselineMisfit = !!how.baselineMisfit;
      const scored = CVR.scenarioIsScored(scenario);
      const asksHowSure = baselineMisfit || (baseline && scored);
      const sure = asksHowSure ? (person.kind === "random" ? 1 + Math.floor(rand() * 5) : clamp(Math.round(3.8 + normal()), 1, 5)) : null;
      const baselineConfirm = baselineMisfit
        ? { confidence: sure, valueRaised: CVR.optionMainValue(opt), stepDownForTheOtherThree: CVR.baselineStepDown(opt.level) } : undefined;
      const update = !scored ? { profile, moves: [] }
        : baselineConfirm ? CVR.applyBaselineConfirmUpdatesWithMoves(profile, opt, opt.level, scenario.stakesWeight ?? 1, baselineConfirm.confidence)
          : CVR.applyKeepUpdatesWithMoves(profile, opt, opt.level, scenario.stakesWeight ?? 1, scenario.options ?? []);
      let predictionTest;
      if (prediction && how.predictionFor) {
        const selected = how.predictionFor;
        const firstChoice = predFirstChoiceId ?? selected.id;
        const onFirst = prediction.options.find((o) => o.optionId === firstChoice);
        const top = prediction.options.find((o) => o.rank === 1);
        tick(logNormalMs(fastHere ? 1 : 3, 0.3));
        predictionTest = {
          version: prediction.version, temperature: prediction.temperature, confidence: prediction.confidence, separation: prediction.separation,
          shownProbabilities: prediction.options.map((o) => ({ optionId: o.optionId, probability: o.probability, rank: o.rank, alignmentScore: o.alignmentScore })),
          predictedTopOptionId: top?.optionId ?? "",
          firstChoiceOptionId: firstChoice,
          probabilityOfFirstChoice: onFirst?.probability ?? 0,
          predictionWasRight: top?.optionId === firstChoice,
          soundsLikeMe: predSoundsLike, surprised: predSurprised,
          shownOrder: shuffleForParticipant(labeled, scenario.id).map((o) => o.id),
          switchesBeforeGuess: predLog.switchesBefore, switchesAfterGuess: predLog.switchesAfter,
          rulesOpenedBeforeGuess: predLog.openedBefore.size, rulesOpenedAfterGuess: predLog.openedAfter.size,
          interactions: [...predLog.events, { atMs: Date.now() - scenarioStartTime, what: "committed", optionId: selected.id }],
          changedAfterSeeing: selected.id !== firstChoice,
          finalChoiceOptionId: selected.id,
          probabilityOfFinalChoice: prediction.options.find((o) => o.optionId === selected.id)?.probability ?? 0,
          pressedChangeAnswer: predLog.events.some((e) => e.what === "changed_answer"),
          secondsViewingPrediction: predShownAt ? Math.round((Date.now() - predShownAt) / 1000) : 0,
        };
      }
      return commitChoice(opt, labeled, shown, scenario, profile, {
        nextProfile: update.profile, valueMoves: update.moves, endorsement: "n/a", stakeholderGuided: null, predictionTest, baselineConfirm,
        howSureOnConfirm: asksHowSure && sure !== null ? sure : undefined,
      });
    }

    function apaCommit(original, labeled, scenario, profile, how) {
      /* The APA page (APAPanel): the value named, how sure, the list built on that value, the final option. */
      const currentTop = [...POLICY].sort((a, b) => profile.dimensions.find((d) => d.key === b).score - profile.dimensions.find((d) => d.key === a).score)[0];
      const nameOption = BEHAVIOUR.apaNamesOptionValue[apaOnly ? "APA_Only" : "CVR+APA"];
      const q3 = person.kind === "random" ? pickOne(POLICY)
        : chance(BEHAVIOUR.apaNamesTopValue) ? currentTop
          : chance(nameOption / (1 - BEHAVIOUR.apaNamesTopValue)) ? CVR.optionMainValue(original) : pickOne(POLICY);
      const confidence = person.kind === "random" ? 1 + Math.floor(rand() * 5) : clamp(Math.round(3.6 + normal()), 1, 5);
      const q2Influenced = how.moved === true;
      const pendingUpdate = CVR.applyApaUpdatesWithMoves(profile, q2Influenced, q3, null, scenario.stakesWeight ?? 1, confidence, !frozen);
      const pendingLabeled = CVR.labelOptions(scenario.options, pendingUpdate.profile);
      let matching = pendingLabeled.filter((o) => CVR.optionMainValue(o) === q3);
      if (!matching.length) matching = [...pendingLabeled].sort((a, b) => b.fingerprint[q3] - a.fingerprint[q3]).slice(0, 1);
      const pick = person.kind !== "random" && chance(BEHAVIOUR.apaTakesBestFit)
        ? [...matching].sort((a, b) => labeled.find((x) => x.id === a.id).matchShortfall - labeled.find((x) => x.id === b.id).matchShortfall)[0]
        : pickOne(matching);
      const mainValueShortSaid = how.straightToApa && CVR.mainValueFallsShort(original, profile);
      tick(logNormalMs(fastHere ? 2 : 10, 0.3));
      /* handleApaCommit: the final choice judged on the profile the scenario opened with (`labeled`). */
      const opt = labeled.find((o) => o.id === pick.id);
      const origLabeled = CVR.labelOptions(scenario.options, userProfile);
      const origLevel = origLabeled.find((o) => o.id === opt.id)?.level;
      const alignedToOriginal = origLevel === "aligned" || origLevel === "weakly_aligned";
      const apaFramingFields = apaOnly ? {} : { cvrFramingShownFirst: CVR.cvrCoordinate(original, profile).framing };
      const row = {
        ...apaFramingFields,
        scenarioId: scenario.id,
        selectedOptionId: opt.id,
        selectedRank: opt.rank,
        topRankedOptionId: labeled[0]?.id ?? opt.id,
        selectedWasTopCandidate: opt.rank === 1,
        selectedWasCandidate: opt.level === "aligned" || opt.level === "weakly_aligned",
        rankedOptionIds: labeled.map((o) => o.id),
        fitScoresByOptionId: Object.fromEntries(labeled.map((o) => [o.id, o.matchScore])),
        candidateStatusByOptionId: Object.fromEntries(labeled.map((o) => [o.id, o.level === "aligned" || o.level === "weakly_aligned"])),
        viewedExplanationOptionIds: [...expanded],
        timeMs: Date.now() - scenarioStartTime,
        alignmentLevel: opt.level,
        matchScore: opt.matchScore,
        fitScoreScale: CVR.FIT_SCORE_SCALE,
        matchShortfall: CVR.roundForRecord(opt.matchShortfall),
        fitShortfallsByOptionId: Object.fromEntries(labeled.map((o) => [o.id, CVR.roundForRecord(o.matchShortfall)])),
        valueMoves: pendingUpdate.moves,
        firstChoiceOptionId: firstChoiceId ?? original.id,
        ...(apaOnly
          ? { reflectionShown: false, stakeholderGuided: null }
          : { postCVRChoiceOptionId: opt.id, cvrEndorsement: "no", stakeholderGuided: q2Influenced }),
        cvrFired: true,
        alignedToOriginal,
        decisionRole: scenario.decisionRole ?? "decider",
        introSeconds,
        vciScore: CVR.scenarioVciScore(opt.level, scenario.options.length),
        performanceScore: CVR.performanceScore(opt),
        performanceCaptured: capturedOf(scenario, opt),
        performanceMenu: { worst: Math.round(menuRange(scenario).worst), best: Math.round(menuRange(scenario).best) },
        metrics: CVR.optionMetrics(opt),
        apa: {
          confidence,
          stakeholderInfluenced: apaOnly ? null : q2Influenced,
          prioritizedValue: q3,
          originalOptionId: original.id,
          ...(apaOnly ? { mainValueShown: CVR.optionMainValue(original) } : {}),
          ...(apaOnly ? { mainValueShortSaid } : {}),
        },
        ...(apaOnly ? {} : { cvrStakeholderShown: how.cvrWho?.label }),
        telemetry: buildScenarioTelemetry(tel, { cvrFired: !apaOnly, cvrOutcome: apaOnly ? "none" : "went-to-APA", apaOutcome: "committed" }),
      };
      return { row: JSON.parse(JSON.stringify(row)), nextProfile: pendingUpdate.profile };
    }

    /* ---------- finalizeScenario ---------- */
    const result = committed.row;
    const nextProfile = committed.nextProfile;
    if (rejection.scenarioId === result.scenarioId && rejection.visits.length > 0) {
      result.valueMoves = [...rejection.moves, ...(result.valueMoves ?? [])];
      result.cvrRejections = rejection.visits.map((v) => ({ ...v, moves: [...v.moves] }));
    }
    result.fitAndReasonsShown = !baseline && CVR.scenarioShowsPerformance(scenario);
    const p = plan.byId[result.selectedOptionId];
    result.plannerOrder = plan.orderedIds;
    result.plannerBins = Object.fromEntries(plan.orderedIds.map((id) => [id, plan.byId[id].bin]));
    result.plannerWins = Object.fromEntries(plan.orderedIds.map((id) => [id, plan.byId[id].wins]));
    result.plannerTopOptionId = plan.orderedIds[0];
    result.plannerCleanReferenceId = plan.cleanReferenceId ?? undefined;
    result.plannerValueOrder = plan.order;
    result.plannerDegradedProfile = decisionProfile.degraded;
    result.plannerVersion = PLANNER_VERSION;
    result.plannerInputs = {
      valueOrder: decisionProfile.order,
      thresholds: Object.fromEntries(Object.entries(decisionProfile.thresholds).map(([key, t]) => [key, {
        hasRedLine: t.hasRedLine, floor: t.floor ?? t.tolerance, tolerance: t.tolerance, exchange: t.exchange,
      }])),
      degraded: decisionProfile.degraded,
    };
    if (p) {
      const labeledNow = CVR.labelOptions(scenario.options, profileShownIn(scenario.id, progress.results, userProfile, progress.profile).profile);
      result.choiceRank = p.rank;
      result.choiceBin = p.bin;
      result.choiceMatchedPlannerTop = p.rank === 1;
      result.choiceMatchedAlignedTop = labeledNow[0]?.id === result.selectedOptionId;
      result.choiceCrossedOwnRedLine = p.breaches.some((b) => b.hard);
      result.choiceBreaches = p.breaches.map((b) => ({ key: b.key, amount: b.amount, hard: b.hard }));
      result.choiceUsedTradeOff = p.ignoredTopValueAgainst.length > 0;
    }
    if (scenario.employer) {
      const shownCompany = deriveCompanyValues(userProfile, scenario.employer);
      result.companyValueShown = { employer: shownCompany.name, valueKey: shownCompany.statedKey, principle: shownCompany.principle };
    }
    const runningWhenOpened = progress.runningProfile ?? progress.profile;
    const step = runningStep(scenario, result.selectedOptionId, runningWhenOpened, nextProfile);
    result.running = step.record;
    result.policySnapshotAfter = policyScoresOf(nextProfile);
    result.framingSnapshotAfter = framingScoresOf(nextProfile);
    result.stakeholderSnapshotAfter = nextProfile.dimensions.find((d) => d.key === "stakeholderPerspectiveShiftSensitivity")?.score ?? 50;
    progress.results = [...progress.results, JSON.parse(JSON.stringify(result))];
    progress.profile = nextProfile;
    progress.runningProfile = step.next;
  }

  /* The finished block, as finalizeScenario writes it. */
  const nextResults = progress.results;
  const vci = CVR.computeVCI(nextResults);
  const vciAll = computeVciAll(nextResults);
  const stabilityAll = computeStabilityAll(nextResults);
  const stab = CVR.computeStability(nextResults, userProfile);
  const finalResults = {
    ...(frozen ? { reflectionScoresFrozen: true } : {}),
    completed: true,
    completedAt: new Date().toISOString(),
    userProfile: progress.profile,
    originalProfile: userProfile,
    scenarioResults: nextResults,
    vci: vci.value, vciLevel: vci.level,
    vciAll: vciAll.value, vciAllLevel: vciAll.level,
    ...(stabilityAll ? {
      stabilityAll: stabilityAll.value, stabilityAllLevel: stabilityAll.level,
      valueOrderStabilityAll: stabilityAll.orderValue, valueDifferenceStabilityAll: stabilityAll.differenceValue,
    } : {}),
    stability: stab.value, stabilityLevel: stab.level,
    valueOrderStability: stab.orderValue, valueDifferenceStability: stab.differenceValue, stabilityVersion: CVR.STABILITY_VERSION,
    stabilityDetail: {
      swaps: stab.swaps, conflictSteps: stab.conflictSteps, swapsByScenario: stab.swapsByScenario,
      topValueBefore: stab.topValueBefore, topValueAfter: stab.topValueAfter,
      orderValue: stab.orderValue, differenceValue: stab.differenceValue, averageMove: stab.averageMove,
      movesAtCountedSteps: stab.movesAtCountedSteps,
    },
    sensitivityStability: CVR.computeSensitivityStability(nextResults, userProfile),
    performance: CVR.averagePerformance(nextResults),
    performanceCaptured: overallCaptured(nextResults),
    performanceCapturedLevel: capturedLabel(overallCaptured(nextResults)),
    totalCvrVisits: nextResults.reduce((s, r) => s + (r.telemetry?.cvrVisits ?? 0), 0),
    totalApaVisits: nextResults.reduce((s, r) => s + (r.telemetry?.apaVisits ?? 0), 0),
    totalSwitches: nextResults.reduce((s, r) => s + (r.telemetry?.numberOfSwitches ?? 0), 0),
  };
  return JSON.parse(JSON.stringify(finalResults));
}

/* ------------------------------------------------------------------ attention checks: answered as the screens save them */
function answerReadingCheck(person, id) {
  const file = ATT.readAttention();
  tick(logNormalMs(person.fastBlocks ? 2 : 7, 0.4));
  const right = ATT.READING_CHECKS[id].right;
  const answer = chance(person.attentionRight) ? right : pickOne(file.plan[id].options.filter((o) => o !== right));
  ATT.recordAttentionAnswer(id, answer, Math.round((logNormalMs(6, 0.3)) / 100) / 10, 0);
}

/* ------------------------------------------------------------------ the feedback page */
function feedbackAnswers(person, results) {
  const zVci = ((results.vci ?? 70) - 70) / 15;
  const latent = BEHAVIOUR.wellbeingFromVci * zVci + normal();
  const likert = (shift = 0) => {
    if (person.straightliner) return person.straightValue;
    if (person.kind === "random") return 1 + Math.floor(rand() * 7);
    return clamp(Math.round(4.7 + 1.1 * (latent + shift + 0.6 * normal())), 1, 7);
  };
  const items = {};
  for (const item of FB.WELLBEING_ITEMS) {
    const extra = item.subscale === "valueCongruence" ? 0.3 * zVci : 0;
    const agree = likert(extra);
    items[item.code] = item.reverse && !person.straightliner ? 8 - agree : agree;
  }
  const collect = (list) => Object.fromEntries(list.filter((q) => q.type !== "open").map((q) => [q.code,
    q.type === "yesno" ? (chance(0.8) ? "yes" : "no") : person.straightliner ? person.straightValue : clamp(Math.round(5 + 1.2 * normal()), 1, 7)]));
  const answers = { decisionSupport: { ...collect(FB.TOOL_RATINGS), ...collect(FB.TOOL_CLOSERS) }, wellbeing: FB.computeWellbeing(items, {}) };
  if (FB.shouldShowCvrSection(results)) answers.cvr = { ...collect(FB.CVR_QUESTIONS), ...(FB.usedDualPerspective(results) ? collect(FB.DUAL_VIEW_QUESTIONS) : {}) };
  if (FB.shouldShowApaSection(results)) answers.apa = collect(FB.APA_QUESTIONS);
  /* The two "pick the number" rows: their answers go to the attention file, never into the feedback record. */
  const plan = ATT.readAttention().plan;
  for (const a of ATT.numberRowsOf(plan)) {
    const target = ATT.attentionTarget(plan, a.check);
    const answer = person.straightliner ? person.straightValue
      : chance(person.attentionRight) ? target : pickOne([1, 2, 3, 4, 5, 6, 7].filter((n) => n !== target));
    ATT.recordAttentionAnswer(a.check, answer, null, 0);
  }
  return answers;
}

/* ------------------------------------------------------------------ one pretend person, start to finish */
async function onePerson(index, condition) {
  store.clear();
  const pid = `cafe${(0x10000000 + index * 7919).toString(16).padStart(8, "0")}${"0123456789ab".slice(index % 12)}`.slice(0, 24).padEnd(24, "0");
  const sessionId = `sim-session-${String(index).padStart(4, "0")}`;
  const kind = chance(BEHAVIOUR.randomShare) ? "random" : "steady";
  const person = {
    kind,
    fitWeight: kind === "random" ? 0 : between(...BEHAVIOUR.fitWeight),
    firstCardWeight: kind === "random" ? 0 : between(...BEHAVIOUR.firstCardWeight),
    fastScenarios: chance(BEHAVIOUR.fastScenarios),
    fastBlocks: chance(BEHAVIOUR.fastBlocks),
    straightliner: chance(BEHAVIOUR.straightliner),
    straightValue: 4,
    attentionRight: kind === "random" ? 0.25 : BEHAVIOUR.attentionRightSteady,
    age: 18 + Math.floor(Math.pow(rand(), 1.6) * 52),
    gender: rand() < 0.47 ? "Male" : rand() < 0.92 ? "Female" : rand() < 0.5 ? "Other" : "Prefer not to say",
  };
  person.straightValue = 1 + Math.floor(rand() * 7);
  NOW = RealDate.UTC(2026, 10, 16, 13, 25, 0) + index * 137_000;
  const cond = CONDITIONS.find((c) => c.type === condition);
  const arrivedAt = new Date().toISOString();

  /* The landing page, the first page, the consent, "A little about you". */
  localStorage.setItem(SESSION_ID_KEY, sessionId);
  localStorage.setItem("vrds_pending_email", pid);
  localStorage.setItem(CONDITION_KEY, JSON.stringify({ version: 1, number: cond.number, type: cond.type, source: "landing_page",
    assignedAt: arrivedAt, arrivalId: `sim-arrival-${index}`, owner: pid, recruitmentSource: "prolific" }));
  ATT.readAttention();
  tick(between(60, 150) * 1000);
  const consentAt = new Date().toISOString();
  tick(between(30, 70) * 1000);
  const createdAt = new Date().toISOString();

  /* Blocks 1-3, with the reading check after the block the plan drew. */
  const answers = plainAnswers(kind);
  const afterBlock = (n) => { if (ATT.readingCheckFollowsBlock(ATT.readAttention(), n)) answerReadingCheck(person, "between_blocks"); };
  markStage("money", "start");
  localStorage.setItem(SESSION_KEY_RESULTS, JSON.stringify(moneyFile(answers, sessionId, person.fastBlocks)));
  markStage("money", "end"); afterBlock(1);
  markStage("trolley", "start");
  localStorage.setItem(TROLLEY_RESULTS_STORAGE_KEY, JSON.stringify(trolleyFile(answers, sessionId, person.fastBlocks)));
  markStage("trolley", "end"); afterBlock(2);
  markStage("product", "start");
  const ai = aiFile(answers, sessionId, person.fastBlocks);
  localStorage.setItem(AI_WORKFORCE_RESULTS_KEY, JSON.stringify(ai));
  markStage("product", "end");
  const insights = deriveAndSaveInsights(sessionId);   // ExperimentFlow: handleProductContinue
  afterBlock(3);

  /* Block 4: ExperimentFlow's handleBlock4Continue. */
  markStage("block4", "start");
  tick(logNormalMs(person.fastBlocks ? 40 : 160, 0.4));
  const decisions = answers.block4;
  const payload = {
    seedCase: insights.seedCase, scenarioDomain: insights.scenarioContext?.domain ?? null, scenarioContext: insights.scenarioContext,
    decisions, vignettesShown: [], mostInfluentialPerspective: decisions.reportedInfluence ? "the affected workers" : "",
    completedAt: new Date().toISOString(), participantId: sessionId,
  };
  localStorage.setItem("block4_reflection_results", JSON.stringify(payload));
  saveFinalAnalysis(insights.profile, payload.decisions);
  captureParticipantRecord(sessionId);
  markStage("block4", "end");

  /* Block 5: ExperimentFlow builds the profile from the threshold tree, then the page runs. */
  tick(between(30, 90) * 1000);    // the page before the main study
  const tree = buildThresholdTree(insights.profile, JSON.parse(localStorage.getItem(AI_WORKFORCE_RESULTS_KEY)), payload.decisions);
  const userProfile = extractBlock5Profile(tree);
  markStage("block5", "start");
  const results = runBlock5(person, userProfile, insights.profile, condition, ATT.readAttention());
  localStorage.setItem(BLOCK5_RESULTS_KEY, JSON.stringify(results));
  markStage("block5", "end");

  /* The results page, then the feedback page. */
  markStage("block5_summary", "start");
  tick(logNormalMs(person.fastScenarios ? 20 : 100, 0.4));
  localStorage.setItem(RESULTS_PAGE_KEY, JSON.stringify({ toFeedback: [{ button: "card_under_scores", at: new Date().toISOString() }] }));
  markStage("block5_summary", "end");
  markStage("feedback", "start");
  tick(logNormalMs(person.fastScenarios ? 60 : 330, 0.35));
  const feedback = feedbackAnswers(person, results);
  markStage("feedback", "end");
  FB.saveFeedbackRecord(FB.assembleFeedbackRecord({ sessionId, results, answers: feedback }));
  const completedAt = new Date().toISOString();
  localStorage.setItem("vrds_status", "Study Completed");

  /* Working time and the login history, in the shapes activeTime.ts and sessionLog.ts keep. */
  const timings = JSON.parse(localStorage.getItem("vrds_stage_timings"));
  const byStage = Object.fromEntries(Object.entries(timings.stages).map(([k, v]) => [k, Math.round((v.durationMs ?? 0) * 0.92)]));
  const totalMs = Object.values(byStage).reduce((a, b) => a + b, 0) + Math.round(between(60, 200) * 1000);
  localStorage.setItem(ACTIVE_TIME_KEY, JSON.stringify({ totalMs, byStage, sittings: 1, firstSeenAt: RealDate.parse(arrivedAt),
    lastActiveAt: NOW, lastInputAt: NOW, longestIdleMs: Math.round(between(20, 85) * 1000), stopped: true }));
  localStorage.setItem(SESSION_LOG_KEY, JSON.stringify({ dropped: 0, sessions: [{ browserId: `sim-browser-${index}`,
    startedAt: RealDate.parse(arrivedAt), lastSeenAt: NOW, stageAtStart: "start", stageAtLastSeen: "feedback", how: "arrived_with_their_prolific_id" }] }));

  /* The database: storage.ts's own syncBlocks, with a pretend server that writes every section where the real one does. */
  const doc = {};
  const setAt = (dotted, value) => {
    const parts = dotted.split(".");
    let o = doc;
    for (const k of parts.slice(0, -1)) { if (!o[k] || typeof o[k] !== "object") o[k] = {}; o = o[k]; }
    o[parts[parts.length - 1]] = JSON.parse(JSON.stringify(value));
  };
  const sent = [];
  storage.setRemoteBackend({
    findParticipant: async () => null, upsertParticipant: async () => {}, updateStage: async () => {}, markCompleted: async () => {},
    saveSection: async (p, data, owner) => { if (owner && owner !== pid) throw new Error(`a save for ${owner}`); sent.push(p); setAt(p, data); },
    signIn: async () => { throw new Error("not used"); }, isActiveBrowser: async () => true, getProlificCode: async () => null,
  });
  await new Promise((r) => setImmediate(r));
  storage.syncBlocks(pid, { force: true });
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  await storage.flushOutbox();
  storage.setRemoteBackend(null);

  /* What the server itself writes on the participant document (server/index.js: create, stage, complete, the code). */
  const record = {
    prolific_pid: pid, prolific_study_id: "simstudy0000000000000001", prolific_session_id: `simsession${String(index).padStart(14, "0")}`,
    recruitment_source: "prolific", participant_id: sessionId,
    age: person.age, gender: person.gender, country: "Prefer not to say", country_code: null, english_first_language: chance(0.6),
    consent: { agreed: true, timestamp: consentAt, version: CONSENT_VERSION },
    condition_number: cond.number, condition_type: cond.type, condition_source: "landing_page", condition_assigned_at: arrivedAt,
    condition_arrival_id: `sim-arrival-${index}`,
    status: "Study Completed", current_stage: "feedback", created_at: createdAt, updated_at: completedAt, completed_at: completedAt,
    prolific_code_given_at: completedAt, prolific_code_last_given_at: completedAt, prolific_code_given_times: 1,
    ...doc,
  };
  const truth = {
    prolific_pid: pid, condition: condition, kind: person.kind, fit_weight: Math.round(person.fitWeight * 1000) / 1000,
    first_card_weight: Math.round(person.firstCardWeight * 1000) / 1000, fast_scenarios: person.fastScenarios,
    fast_blocks: person.fastBlocks, straightliner: person.straightliner, attention_right_chance: person.attentionRight,
    sections_sent: sent.length,
  };
  return { record, truth };
}

/* ------------------------------------------------------------------ run */
(async () => {
  const conditions = ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"];
  /* Interleaved, as the server's balance gives them out: one of each in turn while each still needs people. */
  const order = [];
  const left = [...COUNTS];
  while (left.some((n) => n > 0)) conditions.forEach((c, i) => { if (left[i] > 0) { order.push(c); left[i] -= 1; } });
  const records = [], truths = [];
  for (let i = 0; i < order.length; i++) {
    const { record, truth } = await onePerson(FIRST + i, order[i]);
    records.push(record); truths.push(truth);
  }
  fs.writeFileSync(OUT, process.argv.includes("--compact") ? JSON.stringify(records) : JSON.stringify(records, null, 2));
  if (TRUTH) {
    fs.writeFileSync(TRUTH, JSON.stringify({
      what_this_is: "The settings of every PRETEND participant in the records file beside it. NOT DATA.",
      made_by: "tools/simulate_records.cjs", seed: SEED, counts: Object.fromEntries(conditions.map((c, i) => [c, COUNTS[i]])),
      behaviour: BEHAVIOUR, people: truths,
    }, null, 2));
  }
  const per = conditions.map((c) => `${c} ${records.filter((r) => r.condition_type === c).length}`).join(", ");
  console.log(`  ${records.length} pretend records written to ${OUT} (${per}). NOT DATA.`);
})().catch((e) => { console.error(e); process.exit(1); });
