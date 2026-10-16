/*
 * validate_attention.cjs — the attention checks, and the two deleted between-block pages (29 September 2026).
 *
 * The researcher asked for simple attention checks during the study and "Pick the number four" in the feedback, all
 * needed for the gift card; and for the "insights" and post-Block-4 pages to be deleted, as long as the data stays safe.
 * Since 14 October 2026 the two checks inside the study are READING checks (his advisor: test reading, not memory, and
 * place them "(somewhat) randomly"), after Block 1, 2 or 3 and after scenario 1, 2 or 3, drawn per participant; and in
 * the Prolific door all four checks count, two or more failed being the rejection reason ("1-B"). These gates run the
 * real code (src/experiment/attentionChecks.ts, interBlockData.ts, dbShape.ts) and read the pages' source:
 *
 *   T1  the plan: the two reading checks carry the researcher's approved words (the instruction names the right answer)
 *       and each answer order and each place comes up about equally over 4,000 pretend participants (never between
 *       scenarios 4 and 5, never before scenario 6); the feedback number is only two to five, at every place about
 *       equally, never first in a section and never among the reflection or clarification questions
 *   T2  the plan is drawn once and saved: the same participant always gets the same checks (a refresh or another
 *       device), another email gets its own, and an answered check stays answered
 *   T3  scoring: right only when the answer is what was asked; a miss or a check never reached has its own reason
 *   T4  course credit and careful participation (quality, since 16 October 2026; the gift card until then): credit =
 *       completion, the university door only, never taken away by behaviour; careful participation = none of the four OSF
 *       robustness signs; the check's own screen is never a rushed block; the copy in major_info_and_scores matches
 *   T5  the feedback row stays out of the feedback record: never in a scored list, saved in the attention file on
 *       submit, only in the tools or well-being sections, answered correctly by the development fill button
 *   T6  the two answer-pattern flags (Q4) count runs and steps of one exactly, and say they are not for pay
 *   T7  chance: a random clicker passes all three about 1 time in 112; a same-number answerer and a diagonal
 *       clicker are caught as the plan said
 *   T8  the screens, from the source: they say it is an attention check, ask the approved question and instruction
 *       once (the old repeated line is gone), never say right or wrong, let any pick continue; the placement rules over
 *       every pretend plan (the check follows exactly one of Blocks 1-3, comes before exactly one of scenarios 2-4, and
 *       never again once answered); the flow asks the rule at the end of Blocks 1, 2 and 3 and goes on to the right
 *       next block; Block 5 asks it before each scenario and restarts the next scenario's clock; the consent page
 *       names the rule
 *   T9  (since 7 October 2026) the Prolific door's two number rows: one in each section at every place about equally,
 *       two different numbers two to five; the university plan's fingerprint; the door follows the key; since 14
 *       October 2026 all four checks count for Prolific's rule, two or more failed is the flag, a check never reached is
 *       not a failure; the database rows, quality and the major copy; the chance a random clicker fails two or more;
 *       the page draws every row
 *   T10 the consent page of each door: the university wording kept, the Prolific wording (paid through Prolific, one
 *       sitting, the Prolific ID instead of the email, "If you fail two or more of them, your submission will be
 *       rejected.", one box, "I do not agree" with the way to return the study), its own version stamp, and the flow
 *       passing the door
 *   P1  the deleted pages' data: the new functions make exactly the files the pages made (the pages' own recipe,
 *       written out again here) for 300 pretend participants, and write nothing when an earlier block is missing
 *   P2  the deleted pages, from the source: the four files are gone, the flow derives the files when Block 3 and
 *       Block 4 finish (the analysis before the participant record), the database still receives both sections and
 *       they still travel between browsers, and a browser stopped on a deleted page lands on the next stage
 *
 * Run:  npm run validate:attention
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");
try {
  execFileSync("npx", ["tsc", "-p", "tools/tsconfig.dbshape.json"], { cwd: ROOT, encoding: "utf8", shell: true });
} catch { /* errors in files this tool does not use are not its business */ }
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));

/* A pretend browser store. */
let store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { store = {}; },
  key: (i) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
};

const B = (f) => require(path.join(BUILD, f));
const A = B("attentionChecks.js");
const db = B("dbShape.js");
const IB = B("interBlockData.js");
const { deriveMoralProfile } = B("profileAnalysis.js");
const { selectSeedCase, selectDomain, buildScenarioContext } = B("scenarioSelection.js");
const { computeAIWorkforceAnalysis } = B("aiWorkforceAnalysis.js");
const { generateFinalAnalysis } = B("finalAnalysis.js");
const { buildThresholdTree } = B("thresholdTree.js");
const FB = B("feedbackTypes.js");
const recipe = require("./regenerate_sensitivity_calibration.cjs");

const src = (f) => fs.readFileSync(path.join(ROOT, "src", "experiment", f), "utf8");
const bare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let fails = 0;
function gate(id, ok, text) {
  if (!ok) fails += 1;
  console.log(`  ${ok ? "  ok " : " FAIL"}  ${id.padEnd(3)} ${text}`);
}

console.log("");
console.log("==============================================================================");
console.log("  ATTENTION CHECKS, AND THE TWO DELETED BETWEEN-BLOCK PAGES");
console.log("==============================================================================");

/* ------------------------------------------------------------------ T1 the plan, and the approved words */
const N = 4000;
const plans = Array.from({ length: N }, (_, i) => A.planAttentionChecks(`pretend-session-${i}|person${i}@example.test`));
const READING = ["between_blocks", "between_scenarios"];
{
  const why = [];
  const share = (list, fn, value) => list.filter((p) => fn(p) === value).length / list.length;
  const within = (x, target, tol) => Math.abs(x - target) <= tol;
  /* The words, exactly as the researcher approved them on 14 October 2026 ("2-yes"): one text on screen, the question
     then its instruction. */
  const APPROVED = {
    between_blocks: {
      text: "How do you usually get to work or class? This question checks that you are reading: please choose 'By boat', whatever your real answer is.",
      right: "By boat", wrong: ["By car", "By bus or train", "On foot or by bike"] },
    between_scenarios: {
      text: "Which of these do you enjoy most on a free afternoon? This question checks that you are reading: please choose 'Reading a book', whatever your real answer is.",
      right: "Reading a book", wrong: ["Listening to music", "Walking outside", "Watching a film"] },
  };
  for (const id of READING) {
    const t = A.READING_CHECKS[id], a = APPROVED[id];
    if (`${t.question} ${t.instruction}` !== a.text || t.right !== a.right || JSON.stringify(t.wrong) !== JSON.stringify(a.wrong)) why.push(`${id}: the words are not the approved ones`);
    /* Prolific's valid check: an explicit instruction naming the answer, said to be a check, nothing to remember. */
    if (!t.instruction.includes(`please choose '${t.right}'`) || !/^This question checks that you are reading:/.test(t.instruction)) why.push(`${id}: the instruction does not name the answer, or does not say it is a check`);
    const four = [a.right, ...a.wrong];
    if (plans.some((p) => [...p[id].options].sort().join("|") !== [...four].sort().join("|"))) why.push(`${id}: an answer list is not the four approved answers`);
    for (const o of four) if (!within(share(plans, (p) => p[id].options[0], o), 0.25, 0.03)) why.push(`${id}: "${o}" is not first about 1 time in 4`);
  }
  /* The places: after Block 1, 2 or 3; after scenario 1, 2 or 3 (never 4: scenario 5 follows 4 directly; never 5:
     scenario 6 is the prediction test); each about 1 time in 3, and every pair of places used. */
  if (A.BLOCK_CHECK_PLACES.join() !== "1,2,3" || A.SCENARIO_CHECK_PLACES.join() !== "1,2,3") why.push("the places are not after Blocks 1-3 and scenarios 1-3");
  for (const n of [1, 2, 3]) {
    if (!within(share(plans, (p) => p.between_blocks.after, n), 1 / 3, 0.03)) why.push(`the block check is not after Block ${n} about 1 time in 3`);
    if (!within(share(plans, (p) => p.between_scenarios.after, n), 1 / 3, 0.03)) why.push(`the scenario check is not after scenario ${n} about 1 time in 3`);
  }
  if (new Set(plans.map((p) => `${p.between_blocks.after}-${p.between_scenarios.after}`)).size !== 9) why.push("not every pair of places is used");
  if (plans.some((p) => p.between_scenarios.after >= 4)) why.push("a scenario check between scenarios 4 and 5, or before scenario 6");
  if (A.ATTENTION_CHECK_IDS.join() !== "between_blocks,between_scenarios,number") why.push("the checks are not the three approved ones");
  for (const n of [2, 3, 4, 5]) if (!within(share(plans, (p) => p.number.target, n), 0.25, 0.03)) why.push(`number ${n} not about 1 in 4`);
  if (plans.some((p) => ![2, 3, 4, 5].includes(p.number.target) || A.NUMBER_WORDS[p.number.target] !== p.number.word)) why.push("a number outside two to five, or the wrong word");
  const slotKeys = new Set(plans.map((p) => `${p.number.list}:${p.number.after}`));
  if (slotKeys.size !== A.NUMBER_SLOTS.length) why.push(`only ${slotKeys.size} of ${A.NUMBER_SLOTS.length} feedback places used`);
  if (plans.some((p) => !["tools", "wellbeing_a", "wellbeing_b"].includes(p.number.list))) why.push("the number row in a reflection or clarification section");
  if (plans.some((p) => p.number.after < 1 || p.number.after > A.NUMBER_LIST_LENGTHS[p.number.list])) why.push("the number row first in a section, or past its end");
  const toolLikerts = FB.TOOL_RATINGS.filter((q) => q.type === "likert").length;
  if (A.NUMBER_LIST_LENGTHS.tools !== toolLikerts || A.NUMBER_LIST_LENGTHS.wellbeing_a + A.NUMBER_LIST_LENGTHS.wellbeing_b !== FB.WELLBEING_ITEMS.length) why.push("the three lists do not match the feedback's own questions");
  gate("T1", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
    : `the two reading checks carry the researcher's approved words (the instruction names the right answer and says it is a check); over ${N} pretend participants each of their four answers comes first about 1 time in 4, the block check sits after Block 1, 2 or 3 and the scenario check after scenario 1, 2 or 3, each about 1 time in 3 (all 9 pairs used, never between scenarios 4 and 5 or before 6); the feedback number is two to five, about equally, over all ${A.NUMBER_SLOTS.length} places, never first in a section, never among the reflection or clarification questions`);
}

/* ------------------------------------------------------------------ T2 drawn once, saved, per participant */
{
  const ans0 = (answer) => ({ answer, correct: true, answeredAt: "2026-09-30T09:00:00.000Z", secondsToAnswer: 2, timesChanged: 0 });
  const why = [];
  if (JSON.stringify(A.planAttentionChecks("same")) !== JSON.stringify(A.planAttentionChecks("same"))) why.push("the same seed gave two plans");
  store = { vrds_session_id: "s-1", vrds_pending_email: "Ana@Example.test" };
  const first = A.readAttention();
  if (JSON.stringify(A.readAttention().plan) !== JSON.stringify(first.plan)) why.push("a second read drew a new plan");
  if (first.owner !== "ana@example.test" || first.version !== A.ATTENTION_VERSION) why.push("the owner or the version is wrong");
  const travelled = store[A.ATTENTION_KEY];
  store = { vrds_session_id: "s-1", vrds_pending_email: "ana@example.test", [A.ATTENTION_KEY]: travelled };
  if (JSON.stringify(A.readAttention().plan) !== JSON.stringify(first.plan)) why.push("another device drew a new plan");
  if (A.readAttention().plan.between_blocks.after !== first.plan.between_blocks.after || A.readAttention().plan.between_scenarios.after !== first.plan.between_scenarios.after) why.push("the places moved between two reads");
  A.recordAttentionAnswer("between_blocks", A.READING_CHECKS.between_blocks.right, 3.2, 1);
  if (!A.isAttentionAnswered("between_blocks") || A.isAttentionAnswered("between_scenarios")) why.push("answered / not answered is wrong");
  store.vrds_pending_email = "ben@example.test";
  const ben = A.readAttention();
  if (ben.owner !== "ben@example.test" || Object.keys(ben.answers).length !== 0) why.push("a second person inherited the first person's checks");
  /* A file saved under the old colour-and-letter version is drawn again, not misread. */
  store = { vrds_pending_email: "cy@example.test", [A.ATTENTION_KEY]: JSON.stringify({ version: "2026-09-29-a", owner: "cy@example.test",
    plan: { colour: { slot: "after_block1", target: "green", options: [] }, letter: {}, number: { list: "tools", after: 1, target: 2, word: "two" } }, answers: { colour: { answer: "green" } } }) };
  const cy = A.readAttention();
  if (cy.version !== A.ATTENTION_VERSION || !Array.isArray(cy.plan.between_blocks?.options) || Object.keys(cy.answers).length !== 0) why.push("an old-version file is not drawn again");
  /* And a file shaped exactly like today's but stamped with an older version: only the version can tell. */
  const lookalike = { version: "2026-09-29-a", owner: "dee@example.test", plan: A.planAttentionChecks("dee"), answers: { between_blocks: ans0(A.READING_CHECKS.between_blocks.right) } };
  store = { vrds_pending_email: "dee@example.test", [A.ATTENTION_KEY]: JSON.stringify(lookalike) };
  const dee = A.readAttention();
  if (dee.version !== A.ATTENTION_VERSION || Object.keys(dee.answers).length !== 0) why.push("a file with an older version stamp is kept");
  /* The two memory-question versions (30 September and 7 October 2026) are no longer read: their questions are gone, so a
     test run saved under them is drawn again, answers and all (nobody had taken the study; STILL_READ_VERSIONS is empty). */
  if (A.STILL_READ_VERSIONS.length !== 0) why.push("an older version is still read as it is");
  for (const [version, door] of [["2026-09-30-topics", "university"], ["2026-10-07-two-doors", "university"], ["2026-10-07-two-doors", "prolific"]]) {
    const owner = door === "prolific" ? "5f8a9b0c1d2e3f4a5b6c7d80" : "eve@example.test";
    const memory = { version, owner, plan: { ...(door === "prolific" ? { door } : {}), after_block3: { options: ["a", "b", "c", "d"] }, after_scenario3: { options: ["a", "b", "c", "d"] },
      number: { list: "tools", after: 1, target: 2, word: "two" }, ...(door === "prolific" ? { number_2: { list: "wellbeing_a", after: 1, target: 3, word: "three" } } : {}) },
      answers: { after_block3: ans0("a") } };
    store = { vrds_pending_email: owner, [A.ATTENTION_KEY]: JSON.stringify(memory) };
    const redrawn = A.readAttention();
    if (redrawn.version !== A.ATTENTION_VERSION || "after_block3" in redrawn.plan || Object.keys(redrawn.answers).length !== 0 || A.planDoor(redrawn.plan) !== door) why.push(`a ${version} ${door} file is kept`);
    if (A.scoreAttention(memory) !== null || A.buildAttentionSection(memory) !== null) why.push(`a ${version} file is still scored`);
  }
  /* A file with a place outside 1-3 is never read (it would put the check where it must never be). */
  const bad = { ...A.readAttention(), plan: { ...A.readAttention().plan, between_scenarios: { after: 4, options: A.readAttention().plan.between_scenarios.options } } };
  if (A.scoreAttention(bad) !== null) why.push("a plan with the scenario check after scenario 4 is read");
  gate("T2", why.length === 0, why.length ? why.join(" | ")
    : "the plan is drawn once and saved: the same participant gets the same places and answer orders after a refresh or on another device, an answered check stays answered, another email gets its own, an old-version file is drawn again (also the two memory-question versions, in both doors), and a plan with a place outside 1-3 is never read");
}

/* ------------------------------------------------------------------ T3 scoring */
function fileWith(plan, answers) {
  return { version: A.ATTENTION_VERSION, owner: "x", plan, answers };
}
const at = "2026-09-30T10:00:00.000Z";
const ans = (answer) => ({ answer, correct: false, answeredAt: at, secondsToAnswer: 2, timesChanged: 0 });
const P = plans[7];
const RB = A.READING_CHECKS.between_blocks.right, WB = A.READING_CHECKS.between_blocks.wrong[1], RS = A.READING_CHECKS.between_scenarios.right;
const allRight = fileWith(P, { between_blocks: ans(RB), between_scenarios: ans(RS), number: ans(P.number.target) });
const oneWrong = fileWith(P, { between_blocks: ans(WB), between_scenarios: ans(RS), number: ans(P.number.target) });
const oneMissing = fileWith(P, { between_blocks: ans(RB), between_scenarios: ans(RS) });
{
  const why = [];
  const s1 = A.scoreAttention(allRight), s2 = A.scoreAttention(oneWrong), s3 = A.scoreAttention(oneMissing);
  if (!s1.passedAll || s1.passedCount !== 3 || s1.misses.length) why.push("all right does not pass");
  if (s2.passedAll || s2.passedCount !== 2 || !(s2.misses[0] ?? "").startsWith(`missed the reading check after Block ${P.between_blocks.after}`) || !(s2.misses[0] ?? "").includes(WB)) why.push(`a wrong answer reads wrong: ${JSON.stringify(s2)}`);
  if (s3.passedAll || s3.answeredCount !== 2 || s3.misses[0] !== "did not answer the feedback check") why.push("a check never reached does not count as missed");
  const textFour = fileWith(P, { between_blocks: ans(RB), between_scenarios: ans(RS), number: ans(String(P.number.target)) });
  if (A.scoreAttention(textFour).passedAll) why.push("the number check accepted text for a number");
  if (A.scoreAttention(null) !== null || A.buildAttentionSection({}) !== null) why.push("no file should give no verdict");
  const sec = A.buildAttentionSection(oneWrong);
  if (sec.passed_all !== false || sec.checks.length !== 3 || sec.checks[0].correct !== false || sec.checks[1].correct !== true
      || sec.checks[0].right_answer !== RB || sec.checks[1].asked !== `${A.READING_CHECKS.between_scenarios.question} ${A.READING_CHECKS.between_scenarios.instruction}`
      || JSON.stringify(sec.checks[0].options_in_the_order_shown) !== JSON.stringify(P.between_blocks.options)
      || sec.checks[0].shown_after_block !== P.between_blocks.after || sec.checks[0].shown_after_scenario !== null
      || sec.checks[1].shown_after_scenario !== P.between_scenarios.after || sec.checks[1].shown_after_block !== null
      || !sec.checks[0].where_it_was_shown.includes(`after Block ${P.between_blocks.after}`) || !sec.checks[1].where_it_was_shown.includes(`after scenario ${P.between_scenarios.after}, before scenario ${P.between_scenarios.after + 1}`)
      || sec.checks[2].right_answer !== P.number.target || !/after rating row/.test(sec.checks[2].where_it_was_shown)) why.push("analysis.attention_checks rows are wrong");
  gate("T3", why.length === 0, why.length ? why.join(" | ")
    : "right only when the answer is exactly the right one (a number as a number); a wrong pick names the check's place, the right answer and the pick; a check never reached counts as missed; the rows keep where each check was shown (in words and as a number), the question with its instruction, the answer order and the answer");
}

/* ------------------------------------------------------------------ T4 course credit, and careful participation */
{
  /* Since 16 October 2026 (the researcher's "1-yes, 2-yes"): course credit = completion, the university door only (the
     consent page: "the course credit is given when I complete the study"); careful participation = none of the four OSF
     robustness signs, for the researcher only, never taking credit away. */
  const why = [];
  const ledger = { totalMs: 2_400_000, sittings: 1, longestIdleMs: 0, byStage: { money: 300_000, block5: 900_000, attention_check: 5_000 } };
  const varied = { feedback: { decisionSupport: { TOOL_optionCards: 3, TOOL_consequences: 6 }, wellbeing: { items: { LI1: 5, LI2: 2, LI3: 7, LI4: 4, DS1: 5, DS2: 3, DS4: 6, DR1: 2 } } } };
  const same = { feedback: { decisionSupport: { TOOL_optionCards: 4, TOOL_consequences: 4 }, wellbeing: { items: { LI1: 4, LI2: 4, LI3: 4, LI4: 4, DS1: 4, DS2: 4, DS4: 4, DR1: 4 } } } };
  const b5 = (fast) => ({ scenarioResults: Array.from({ length: 6 }, (_, i) => ({ timeMs: i < fast ? 9_000 : 60_000 })) });
  const steady = { answered_very_fast: false, median_seconds_between_answers: 3.4 };
  const hasty = { answered_very_fast: true, median_seconds_between_answers: 1.2 };
  const q = (over = {}) => db.buildQuality(over.ledger ?? ledger, "b5" in over ? over.b5 : b5(0), "fb" in over ? over.fb : varied,
    over.status ?? "Study Completed", "att" in over ? over.att : allRight, "b14" in over ? over.b14 : steady, over.door ?? "university");
  const ok = q();
  if (ok.course_credit_earned !== true || ok.careful_participation !== true || ok.careful_participation_reasons.length !== 0
      || ok.careful_participation_cannot_tell.length !== 0 || ok.careful_participation_signs.length !== 4 || ok.passed_all_attention_checks !== true) why.push(`a careful finisher reads wrong: ${JSON.stringify(ok).slice(0, 200)}`);
  const cases = [
    ["an attention check answered wrongly", { att: oneWrong }, /answered 1 attention check wrongly/],
    ["answered very fast in Blocks 1-3", { b14: hasty }, /answered very fast in Blocks 1-3/],
    ["two scenarios under 15 seconds", { b5: b5(2) }, /2 scenarios decided in under 15 seconds/],
    ["the same answer to every rating", { fb: same }, /same answer to every feedback rating/],
  ];
  for (const [label, over, reason] of cases) {
    const r = q(over);
    if (r.careful_participation !== false || !r.careful_participation_reasons.some((x) => reason.test(x))) why.push(`${label}: careful ${r.careful_participation}, ${r.careful_participation_reasons}`);
    if (r.course_credit_earned !== true) why.push(`${label} took the course credit away`);
  }
  if (q({ b5: b5(1) }).careful_participation !== true) why.push("one fast scenario counts as a sign");
  const unknown = q({ b14: null });
  if (unknown.careful_participation !== null || !unknown.careful_participation_cannot_tell.includes("Blocks 1-3 timing not on record") || unknown.course_credit_earned !== true) why.push("a sign that cannot be read does not give null");
  if (q({ att: null }).careful_participation !== null || !q({ att: null }).attention_check_misses.includes("no attention checks on record")) why.push("no attention file does not give null");
  if (q({ status: "Study Not Completed" }).course_credit_earned !== false) why.push("an unfinished student earned the credit");
  if (q({ door: "prolific" }).course_credit_earned !== null) why.push("the Prolific door got a course credit");
  const slow = q({ ledger: { ...ledger, totalMs: 600_000 } });
  if (slow.course_credit_earned !== true || slow.under_the_estimated_length !== true || slow.careful_participation !== true) why.push("ten working minutes changed the credit or the careful verdict");
  const rushed = q({ ledger: { ...ledger, byStage: { money: 10_000, trolley: 9_000, product: 8_000, block5: 900_000 } } });
  if (rushed.blocks_under_30_seconds !== 3 || rushed.careful_participation !== true || rushed.course_credit_earned !== true) why.push("three rushed parts became a careful sign (it is the pay check's, not the OSF's)");
  if (ok.blocks_under_30_seconds !== 0 || ok.rushed_blocks.some((b) => b.stage === "attention_check")) why.push("the check's screen counted as a rushed block");
  for (const gone of ["compensation_eligible", "reasons", "rule", "required_active_minutes", "met_time_requirement"]) if (gone in ok) why.push(`the gift-card field ${gone} is still saved`);
  /* The page passes what the verdict reads: the Blocks 1-3 speed flag (built first) and the participant's door. */
  const storage = bare(src("storage.ts"));
  const iB14 = storage.indexOf("const blocks1to4 = buildBlocks1to4Checks({"), iQ = storage.indexOf("const quality = buildQuality(");
  if (!(iB14 > 0 && iQ > iB14) || !/const quality = buildQuality\(\s*readKey\(ACTIVE_TIME_KEY\),\s*readKey\(BLOCK5_RESULTS_KEY\),\s*readKey\(FEEDBACK_KEY\),\s*localStorage\.getItem\("vrds_status"\) \?\? "",\s*readKey\(ATTENTION_KEY\),\s*blocks1to4,\s*keyDoor\(browserParticipantKey\(\) \?\? ""\),\s*\);/.test(storage)) why.push("the page does not pass the speed flag and the door to the verdict");
  if (!/course_credit_earned \(the university door only; null in the Prolific door\) is exactly completed_the_study/.test(ok.how_to_read)) why.push("how_to_read does not say what decides the credit");
  const block5 = { scenarioResults: [], originalProfile: { dimensions: [] } };
  const major = db.buildMajorScores(block5, null, null, null, null, null, oneWrong);
  if (!major || JSON.stringify(major.attention_checks) !== JSON.stringify({ passed_all: false, passed_count: 2, answered_count: 3, misses: A.scoreAttention(oneWrong).misses })) why.push("the copy in major_info_and_scores is wrong");
  if (!/analysis\.attention_checks/.test(major?.where_each_number_lives?.attention_checks ?? "")) why.push("where_each_number_lives does not name the source");
  gate("T4", why.length === 0, why.length ? why.join(" | ")
    : "course credit = completion in the university door (null in the Prolific door), never taken away by behaviour; careful participation false with its reason for each of the four OSF signs (an attention check wrong, very fast in Blocks 1-3, two scenarios under 15 s, the same answer to every rating), null when a sign cannot be read, unmoved by ten working minutes or three rushed parts; the gift-card fields gone; the check's screen never a rushed block; major_info_and_scores copies the checks");
}

/* ------------------------------------------------------------------ T5 the feedback row */
{
  const why = [];
  const page = bare(src("UserFeedbackPage.tsx"));
  /* Never in a list that is collected into the feedback record. */
  if (/collect\([^)]*(ATTENTION_FEEDBACK_CODE|attentionRows)/.test(page)) why.push("the check is collected into the feedback");
  /* Whatever builds the feedback record may not touch the check's code, nor copy every answer wholesale. */
  const iBuilt = page.indexOf("const feedback: FeedbackAnswers = {"), iAttn = page.indexOf("for (const a of attentionRows) {\n      const attentionAnswer = answers[a.code];");
  const iSave = page.indexOf("saveFeedbackRecord(record)");
  const built = iBuilt > 0 && iAttn > iBuilt ? page.slice(iBuilt, iAttn) : "";
  const after = iAttn > 0 && iSave > iAttn ? page.slice(iAttn, iSave) : "";
  if (!built || /ATTENTION_FEEDBACK_CODE|attentionRows|ATTN_|\.\.\.answers\b/.test(built) || /feedback\.\w+\s*=/.test(after)) why.push("the feedback record can carry the check's answer");
  if (!/recordAttentionAnswer\(a\.check, attentionAnswer, null, attentionChanges\.current\[a\.code\] \?\? 0\)/.test(page)) why.push("the answer is not saved in the attention file on submit");
  const submitAt = page.indexOf("recordAttentionAnswer(a.check"), saveAt = page.indexOf("saveFeedbackRecord(record)");
  if (!(submitAt > 0 && saveAt > submitAt)) why.push("the answer is saved after the feedback record, or not at all");
  /* Only in the tools and well-being sections. */
  const calls = [...page.matchAll(/attentionAfter\("(\w+)"/g)].map((m) => m[1]);
  if (calls.sort().join() !== "tools,wellbeing_a,wellbeing_b") why.push(`the row can appear in: ${calls.join(", ")}`);
  const cvrCard = page.slice(page.indexOf('method="cvr"'), page.indexOf('eyebrow="Decision-support tools"'));
  if (/attentionAfter|ATTENTION_FEEDBACK_CODE|attentionRows/.test(cvrCard)) why.push("the row can appear in the reflection or clarification sections");
  if (!page.includes("for (const a of attentionRows) filled[a.code] = a.row.target;")) why.push("the development fill button answers it wrong");
  if (!/text: `This question is just to check your attention\. Pick the number \$\{at\.row\.word\}\.`/.test(page)) why.push("the wording is not the researcher's");
  if (!page.includes("const [attentionRows] = useState(() => numberRowsOf(readAttention().plan));")) why.push("the page does not draw the rows the plan drew");
  /* The feedback record never sees it: the ratings read back from a record carry only real questions. */
  const record = { feedback: { decisionSupport: { TOOL_optionCards: 4, [A.ATTENTION_FEEDBACK_CODE]: 4, [A.ATTENTION_FEEDBACK_CODE_2]: 5 }, wellbeing: { items: { LI1: 4, [A.ATTENTION_FEEDBACK_CODE_2]: 3 } } } };
  if (A.feedbackRatingsInOrder(record).length !== 2) why.push("a stray check answer would be read as a rating");
  gate("T5", why.length === 0, why.length ? why.join(" | ")
    : "the row is never collected into the feedback record (so no score or 'same answer' flag can move), is saved in the attention file before the record, sits only in the tools or well-being sections, uses the researcher's words, and the dev fill answers it right");
}

/* ------------------------------------------------------------------ T6 answer patterns */
{
  const why = [];
  const rec = (tools, items) => ({ feedback: { decisionSupport: tools, wellbeing: { items } } });
  const codes = FB.WELLBEING_ITEMS.map((i) => i.code);
  const same = A.buildFeedbackPatterns(rec({}, Object.fromEntries(codes.map((c) => [c, 5]))));
  if (same.longest_run_of_the_same_answer !== codes.length || same.share_of_the_most_common_answer !== 1 || same.most_common_answer !== 5
      || same.share_of_steps_of_exactly_one !== 0 || same.longest_run_of_steps_of_exactly_one !== 1) why.push("all 5s read wrong");
  const diag = [1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2];
  const d = A.buildFeedbackPatterns(rec({}, Object.fromEntries(codes.map((c, i) => [c, diag[i]]))));
  if (d.share_of_steps_of_exactly_one !== 1 || d.longest_run_of_steps_of_exactly_one !== codes.length || d.longest_run_of_the_same_answer !== 1) why.push("a diagonal reads wrong");
  const mixed = [5, 5, 5, 5, 5, 5, 5, 5, 2, 7, 1, 4, 6, 3, 7, 2, 5, 1, 6, 4, 3, 7, 2, 6];
  const m = A.buildFeedbackPatterns(rec({}, Object.fromEntries(codes.map((c, i) => [c, mixed[i]]))));
  if (m.longest_run_of_the_same_answer !== 8) why.push("a run of eight 5s is not found");
  /* Counted by hand: of its 23 steps only 4 -> 3 is a step of exactly one. */
  if (m.share_of_steps_of_exactly_one !== Math.round((1 / 23) * 100) / 100 || m.longest_run_of_steps_of_exactly_one !== 2) why.push(`the mixed answers' steps read wrong: ${m.share_of_steps_of_exactly_one}`);
  if (same.used_for_pay !== false || A.buildFeedbackPatterns(null) !== null) why.push("not marked as not for pay, or an empty record gives a section");
  const pay = bare(src("dbShape.ts"));
  if (/buildFeedbackPatterns|longest_run_of_the_same_answer/.test(pay.slice(pay.indexOf("export function buildQuality"), pay.indexOf("/* ------------------------------------------------------------ blocks 1 to 4, the checks */")))) why.push("the patterns reach the gift-card verdict");
  gate("T6", why.length === 0, why.length ? why.join(" | ")
    : "the longest run of one answer and the share of steps of exactly one are counted right (all 5s, a diagonal, eight 5s then varied), and neither reaches the gift-card verdict");
}

/* ------------------------------------------------------------------ T7 chance */
{
  const why = [];
  const rand = recipe.seededRandom(20260929);
  const R = 200_000;
  let passAll = 0;
  for (let i = 0; i < R; i++) {
    const colour = rand() < 0.25, letter = rand() < 0.25, number = Math.floor(rand() * 7) + 1 === 4;
    if (colour && letter && number) passAll += 1;
  }
  const rate = passAll / R;
  if (Math.abs(rate - 1 / 112) > 0.001) why.push(`random clickers pass ${(rate * 100).toFixed(2)}%, not about 0.89%`);
  /* A same-number answerer passes the number check only when the number asked is theirs. */
  const sameRate = (c) => plans.filter((p) => p.number.target === c).length / plans.length;
  if (sameRate(1) !== 0 || sameRate(6) !== 0 || sameRate(7) !== 0 || Math.abs(sameRate(4) - 0.25) > 0.03) why.push("same-number answerers are not caught as planned");
  /* A diagonal clicker: 1,2,...,7,1,2,... down the page; where the check row lands decides their answer to it. */
  const toolsN = A.NUMBER_LIST_LENGTHS.tools, aN = A.NUMBER_LIST_LENGTHS.wellbeing_a;
  const before = (p) => p.number.list === "tools" ? p.number.after : p.number.list === "wellbeing_a" ? toolsN + 1 + p.number.after : toolsN + 1 + aN + p.number.after;
  const diagPass = plans.filter((p) => (before(p) % 7) + 1 === p.number.target).length / plans.length;
  if (diagPass > 0.2) why.push(`diagonal clickers pass the number check ${(diagPass * 100).toFixed(0)}% of the time`);
  gate("T7", why.length === 0, why.length ? why.join(" | ")
    : `a random clicker passes all three ${(rate * 100).toFixed(2)}% of the time (1 in 112 = 0.89%); a same-number answerer on 1, 6 or 7 always fails the number check, on 4 passes it ${(sameRate(4) * 100).toFixed(0)}%; a diagonal clicker passes it ${(diagPass * 100).toFixed(0)}%`);
}

/* ------------------------------------------------------------------ T8 the screens, from the source */
{
  const why = [];
  const screen = bare(src("AttentionCheckScreen.tsx"));
  const words = screen.replace(/import[\s\S]*?from "[^"]+";/g, "");
  if (!/Quick attention check/.test(words) || !words.includes("{READING_CHECKS[check].question}") || !words.includes("{READING_CHECKS[check].instruction}")) why.push("the screen does not say it is an attention check, or does not ask the approved question and instruction");
  /* The instruction is said once: the old line under the heading would repeat it (the researcher's "2-yes"). */
  if (/check that you are reading|checks that you are reading/i.test(words)) why.push("the screen repeats the instruction in words of its own");
  if (/\b(correct|wrong|right|well done|oops|try again)\b/i.test(words.replace(/aria-pressed|data-attention-\w+/g, ""))) why.push("the screen can say right or wrong");
  if (!screen.includes("disabled={picked === null}")) why.push("Continue waits for something other than a pick");
  if (!screen.includes("readAttention().plan[check].options")) why.push("the answers are not shown in the order drawn for this participant");
  /* The placement rules, run over every pretend plan: unanswered, the block check follows exactly the drawn block of
     1-3 and the scenario check comes before exactly the drawn scenario (after 1, 2 or 3 finished); answered, never. */
  for (const p of plans) {
    const open = { version: A.ATTENTION_VERSION, owner: "x", plan: p, answers: {} };
    const done = { ...open, answers: { between_blocks: ans(RB), between_scenarios: ans(RS) } };
    const blocks = [1, 2, 3, 4].filter((b) => A.readingCheckFollowsBlock(open, b));
    const scen = [0, 1, 2, 3, 4, 5].filter((i) => A.readingCheckBeforeScenario(open, i));
    if (blocks.join() !== String(p.between_blocks.after) || scen.join() !== String(p.between_scenarios.after)) { why.push(`a plan's check would show at blocks ${blocks} / scenarios ${scen}`); break; }
    if ([1, 2, 3].some((b) => A.readingCheckFollowsBlock(done, b)) || [0, 1, 2, 3, 4, 5].some((i) => A.readingCheckBeforeScenario(done, i))) { why.push("an answered check would show again"); break; }
  }
  const flow = bare(src("ExperimentFlow.tsx"));
  /* The end of Blocks 1, 2 and 3 asks the rule; Block 4 goes straight on; each block goes on to its own next pause. */
  if (!/const goOnAfterBlock = useCallback\(\(block: 1 \| 2 \| 3\) => \{\s*setStage\(readingCheckFollowsBlock\(readAttention\(\), block\) \? "attention_check" : AFTER_BLOCK\[block\]\);/.test(flow)) why.push("the end of a block does not ask the placement rule");
  if (!/const handleMoneyContinue[\s\S]{0,120}goOnAfterBlock\(1\)/.test(flow) || !/const handleTrolleyContinue[\s\S]{0,120}goOnAfterBlock\(2\)/.test(flow) || !/const handleProductContinue[\s\S]{0,400}goOnAfterBlock\(3\)/.test(flow)) why.push("Block 1, 2 or 3 does not offer the check");
  if (!/const AFTER_BLOCK: Record<number, Stage> = \{\s*1: "transition_money_trolley",\s*2: "transition_trolley_product",\s*3: "transition_product_block4",\s*\};/.test(flow)) why.push("a block does not go on to its own next pause");
  if (!flow.includes('setStage("transition_block4_block5");') || /setStage\("transition_(money_trolley|trolley_product|product_block4)"\)/.test(flow)) why.push("Block 4 does not go straight on, or another block skips the rule");
  if ((flow.match(/"attention_check"/g) ?? []).length !== 3) why.push("the check's stage is reached from somewhere else");
  if (!/if \(stage === "attention_check"\) \{\s*const \{ plan, answers \} = readAttention\(\);\s*const next = AFTER_BLOCK\[plan\.between_blocks\.after\];\s*if \(answers\.between_blocks\) \{\s*setStage\(next\);/.test(flow)
      || !flow.includes('<AttentionCheckScreen check="between_blocks" onDone={() => setStage(next)} />')) why.push("the check does not lead on to the block after the drawn one, or can be shown again");
  const sim = bare(src("Block5PublicEmergencySimulation.tsx"));
  if (!sim.includes("const [attentionFile] = useState(() => readAttention());")
      || !/if \(!scenarioCheckDone && readingCheckBeforeScenario\(attentionFile, progress\.currentScenarioIndex\)\)[\s\S]{0,300}check="between_scenarios"[\s\S]{0,120}telRef\.current = newTelemetryAccum\(\);[\s\S]{0,120}scenarioStartTime: Date\.now\(\)[\s\S]{0,80}setScenarioCheckDone\(true\)/.test(sim)) why.push("the scenario check is not asked before each scenario by the rule, or does not restart the next scenario's clock");
  const consent = bare(src("ConsentPage.tsx"));
  /* Since 16 October 2026 only the Prolific page names an attention rule (the university page: course credit on completion). */
  if (!/Answer the attention checks as asked\./.test(consent) || !/the attention checks must be answered as asked/.test(consent) || /Answer the quick attention checks as asked/.test(consent)) why.push("the consent pages do not name the rule where they should");
  const telemetry = bare(src("telemetry.ts"));
  if (/"attention_check"/.test(telemetry.slice(telemetry.indexOf("const TIMED_STAGES"), telemetry.indexOf("];", telemetry.indexOf("const TIMED_STAGES"))))) why.push("the check's screen is timed as a stage");
  gate("T8", why.length === 0, why.length ? why.join(" | ")
    : `the screens say it is an attention check, ask the approved question and its instruction once (no repeated line), never say right or wrong, keep the drawn answer order and continue after any pick; over ${N} pretend plans the block check follows exactly the drawn one of Blocks 1-3 and the scenario check comes before exactly the drawn one of scenarios 2-4, never again once answered; the end of Blocks 1, 2 and 3 asks the rule and goes on to its own next pause, Block 4 goes straight on; Block 5 asks the rule before each scenario and restarts the next scenario's clock; the consent page names the rule`);
}

/* ------------------------------------------------------------------ T9 the Prolific door's two number rows */
{
  const why = [];
  const within = (x, target, tol) => Math.abs(x - target) <= tol;
  const pro = Array.from({ length: N }, (_, i) => A.planAttentionChecks(`pretend-session-${i}|pid${String(i).padStart(20, "0")}`, "prolific"));
  /* The university plan: the default door, no second row. */
  if (plans.some((p, i) => JSON.stringify(A.planAttentionChecks(`pretend-session-${i}|person${i}@example.test`, "university")) !== JSON.stringify(p))
      || plans.some((p) => "door" in p || "number_2" in p)) why.push("the university plan changed");
  /* ...drawn exactly as the reading-check version draws it (14 October 2026): the fingerprint of 200 plans. A change to
     the draw moves every participant's places and orders, so it must be deliberate (and ATTENTION_VERSION moved). */
  const fingerprint = require("node:crypto").createHash("sha256")
    .update(JSON.stringify(Array.from({ length: 200 }, (_, i) => A.planAttentionChecks(`fingerprint-${i}`)))).digest("hex");
  if (fingerprint !== "8c27c70d8c771a4e7fd026df4efbf7adc67796ccfffa324b310d80af663be859") why.push(`the university plan is not drawn as the reading-check version draws it (${fingerprint})`);
  /* The two reading checks are drawn the same way in both doors: the same seed gives the same places and orders. */
  if (pro.some((p, i) => JSON.stringify([p.between_blocks, p.between_scenarios]) !== JSON.stringify((() => { const u = A.planAttentionChecks(`pretend-session-${i}|pid${String(i).padStart(20, "0")}`); return [u.between_blocks, u.between_scenarios]; })()))) why.push("the reading checks are drawn differently in the two doors");
  if (pro.some((p) => p.door !== "prolific" || !p.number_2)) why.push("a Prolific plan has no second row");
  if (pro.some((p) => p.number.list !== "tools")) why.push("the first row is not in the tools section");
  if (pro.some((p) => !["wellbeing_a", "wellbeing_b"].includes(p.number_2.list))) why.push("the second row is not in the well-being section");
  if (pro.some((p) => p.number.target === p.number_2.target)) why.push("the two rows ask the same number");
  if (pro.some((p) => [p.number, p.number_2].some((r) => ![2, 3, 4, 5].includes(r.target) || A.NUMBER_WORDS[r.target] !== r.word || r.after < 1 || r.after > A.NUMBER_LIST_LENGTHS[r.list]))) why.push("a number outside two to five, the wrong word, or a row first in a section");
  for (const n of [2, 3, 4, 5]) {
    if (!within(pro.filter((p) => p.number.target === n).length / N, 0.25, 0.03)) why.push(`first row: ${n} not about 1 in 4`);
    if (!within(pro.filter((p) => p.number_2.target === n).length / N, 0.25, 0.03)) why.push(`second row: ${n} not about 1 in 4`);
  }
  const toolsUsed = new Set(pro.map((p) => p.number.after)), wbUsed = new Set(pro.map((p) => `${p.number_2.list}:${p.number_2.after}`));
  if (toolsUsed.size !== A.TOOLS_SLOTS.length || wbUsed.size !== A.WELLBEING_SLOTS.length) why.push(`places used: ${toolsUsed.size}/${A.TOOLS_SLOTS.length} tools, ${wbUsed.size}/${A.WELLBEING_SLOTS.length} well-being`);
  for (const sl of A.TOOLS_SLOTS) if (!within(pro.filter((p) => p.number.after === sl.after).length / N, 1 / A.TOOLS_SLOTS.length, 0.03)) why.push(`tools place ${sl.after} not about equally likely`);
  for (const sl of A.WELLBEING_SLOTS) if (!within(pro.filter((p) => p.number_2.list === sl.list && p.number_2.after === sl.after).length / N, 1 / A.WELLBEING_SLOTS.length, 0.015)) why.push(`well-being place ${sl.list}:${sl.after} not about equally likely`);
  /* The key decides the door: a Prolific ID draws the Prolific plan, an email the university's. */
  store = { vrds_session_id: "s-9", vrds_pending_email: "5f8a9b0c1d2e3f4a5b6c7d8e" };
  const pf = A.readAttention();
  if (A.planDoor(pf.plan) !== "prolific" || !pf.plan.number_2) why.push("a Prolific ID did not draw the Prolific plan");
  store = { vrds_session_id: "s-9", vrds_pending_email: "gil@example.test", [A.ATTENTION_KEY]: JSON.stringify({ ...pf, owner: "gil@example.test" }) };
  const gil = A.readAttention();
  if (A.planDoor(gil.plan) !== "university" || gil.plan.number_2) why.push("a Prolific plan was kept for an email");
  /* Scoring (since 14 October 2026, "1-B"): all four checks count for Prolific's rule; two or more failed is the flag;
     a check never reached is not a failure. */
  const pp = pro[3], t1 = pp.number.target, t2 = pp.number_2.target, wrong = (t) => (t === 7 ? 1 : 7);
  const WS = A.READING_CHECKS.between_scenarios.wrong[0];
  const pfile = (answers) => ({ version: A.ATTENTION_VERSION, owner: "x", plan: pp, answers });
  const readRight = { between_blocks: ans(RB), between_scenarios: ans(RS) };
  const cases = [
    ["all right", { ...readRight, number: ans(t1), number_2: ans(t2) }, 4, 0, false],
    ["the first row wrong", { ...readRight, number: ans(wrong(t1)), number_2: ans(t2) }, 3, 1, false],
    ["the second row wrong", { ...readRight, number: ans(t1), number_2: ans(wrong(t2)) }, 3, 1, false],
    ["one reading check wrong", { between_blocks: ans(WB), between_scenarios: ans(RS), number: ans(t1), number_2: ans(t2) }, 3, 1, false],
    ["both rows wrong", { ...readRight, number: ans(wrong(t1)), number_2: ans(wrong(t2)) }, 2, 2, true],
    ["both reading checks wrong", { between_blocks: ans(WB), between_scenarios: ans(WS), number: ans(t1), number_2: ans(t2) }, 2, 2, true],
    ["one reading check and one row wrong", { between_blocks: ans(RB), between_scenarios: ans(WS), number: ans(wrong(t1)), number_2: ans(t2) }, 2, 2, true],
    ["three wrong", { between_blocks: ans(WB), between_scenarios: ans(WS), number: ans(wrong(t1)), number_2: ans(t2) }, 1, 3, true],
    ["all four wrong", { between_blocks: ans(WB), between_scenarios: ans(WS), number: ans(wrong(t1)), number_2: ans(wrong(t2)) }, 0, 4, true],
    ["the second row never reached, one wrong", { ...readRight, number: ans(wrong(t1)) }, 2, 1, false],
    ["two wrong, the rows never reached", { between_blocks: ans(WB), between_scenarios: ans(WS) }, 0, 2, true],
    ["the first row's number given to the second", { ...readRight, number: ans(t1), number_2: ans(t1) }, 3, 1, false],
  ];
  for (const [label, answers, passed, failed, flag] of cases) {
    const sc = A.scoreAttention(pfile(answers));
    if (!sc || sc.door !== "prolific" || sc.asked !== 4 || sc.passedCount !== passed || sc.prolific?.counted !== 4 || sc.prolific?.failed !== failed
        || sc.prolific?.answered !== Object.keys(answers).length || sc.prolific?.failedTwoOrMore !== flag) why.push(`${label}: ${JSON.stringify(sc).slice(0, 160)}`);
  }
  if (A.PROLIFIC_FAILS_TO_REJECT !== 2) why.push("the Prolific line is not two failed checks");
  const bothWrong = pfile(cases[4][1]);
  const sec = A.buildAttentionSection(bothWrong);
  if (sec.door !== "prolific" || sec.checks.length !== 4 || sec.checks[3].check !== "number_2" || sec.checks[3].right_answer !== t2 || sec.checks[3].correct !== false
      || !/How this experience was for you/.test(sec.checks[3].where_it_was_shown) || !/The tools & the experiment design/.test(sec.checks[2].where_it_was_shown)
      || sec.prolific_rule?.failed_two_or_more_attention_checks !== true || sec.prolific_rule?.attention_checks_failed !== 2 || sec.prolific_rule?.attention_checks_counted !== 4
      || "topic_checks_count_for_pay" in (sec.prolific_rule ?? {}) || !/will be rejected/.test(sec.prolific_rule?.how_to_read ?? "")
      || !sec.misses.some((m) => m.startsWith("missed the first feedback check")) || !sec.misses.some((m) => m.startsWith("missed the second feedback check"))) why.push("analysis.attention_checks for the Prolific door is wrong");
  const readingWrong = A.buildAttentionSection(pfile(cases[5][1]));
  if (readingWrong.prolific_rule?.failed_two_or_more_attention_checks !== true || !readingWrong.misses.some((m) => m.startsWith(`missed the reading check after Block ${pp.between_blocks.after}`))) why.push("two failed reading checks are not the flag");
  const uniSec = A.buildAttentionSection(allRight);
  if (uniSec.door !== "university" || uniSec.checks.length !== 3 || "prolific_rule" in uniSec) why.push("the university section gained the Prolific rule");
  const ledger = { totalMs: 2_400_000, sittings: 1, longestIdleMs: 0, byStage: { money: 300_000 } };
  const varied = { feedback: { decisionSupport: { TOOL_optionCards: 3, TOOL_consequences: 6 }, wellbeing: { items: { LI1: 5, LI2: 2, LI3: 7 } } } };
  const qp = db.buildQuality(ledger, null, varied, "Study Completed", bothWrong), qu = db.buildQuality(ledger, null, varied, "Study Completed", allRight);
  if (qp.prolific_failed_two_or_more_attention_checks !== true || qp.prolific_attention_checks_failed !== 2 || qp.attention_checks_asked !== 4) why.push("quality does not carry the Prolific rule");
  if (qu.prolific_failed_two_or_more_attention_checks !== null || qu.prolific_attention_checks_failed !== null || qu.attention_checks_asked !== 3) why.push("the university quality gained Prolific fields");
  if (Object.keys(qp).some((k) => /instruction_checks|failed_both/.test(k))) why.push("quality still carries the two-row rule's fields");
  const block5 = { scenarioResults: [], originalProfile: { dimensions: [] } };
  const mp = db.buildMajorScores(block5, null, null, null, null, null, bothWrong)?.attention_checks;
  if (mp?.door !== "prolific" || mp?.failed_two_or_more_attention_checks !== true || mp?.attention_checks_failed !== 2) why.push("the major copy does not carry the Prolific rule");
  /* Chance: a random clicker passes a reading check 1 time in 4 and a number row 1 in 7, so fails two or more of the four
     765 times in 784 (97.6%): 1 - (1/4)^2 (1/7)^2 - [2 (3/4)(1/4)(1/7)^2 + (1/4)^2 2 (6/7)(1/7)] = 1 - 1/784 - 18/784.
     Someone who gives one number everywhere can never pass both rows (the two numbers differ). */
  const rand = recipe.seededRandom(20261007);
  let failTwo = 0;
  for (let i = 0; i < 100_000; i++) {
    const p = pro[i % N];
    const answers = {
      between_blocks: ans(p.between_blocks.options[Math.floor(rand() * 4)]), between_scenarios: ans(p.between_scenarios.options[Math.floor(rand() * 4)]),
      number: ans(Math.floor(rand() * 7) + 1), number_2: ans(Math.floor(rand() * 7) + 1),
    };
    if (A.scoreAttention({ version: A.ATTENTION_VERSION, owner: "x", plan: p, answers }).prolific.failedTwoOrMore) failTwo += 1;
  }
  const failBoth = failTwo;
  if (!within(failTwo / 100_000, 765 / 784, 0.004)) why.push(`random clickers fail two or more ${(failTwo / 1000).toFixed(1)}%, not about 97.6%`);
  if ([1, 2, 3, 4, 5, 6, 7].some((c) => pro.some((p) => p.number.target === c && p.number_2.target === c))) why.push("one number everywhere can pass both rows");
  /* The page draws every row the plan drew, each with its own code, and saves each. */
  const page = bare(src("UserFeedbackPage.tsx"));
  if (!page.includes("const at = attentionRows.find((a) => a.row.list === list && a.row.after === after);")
      || !page.includes("for (const a of here) out.splice(a.row.after, 0, a.code);")) why.push("the page does not draw and require every row");
  const rows = A.numberRowsOf(pp), uniRows = A.numberRowsOf(plans[0]);
  if (rows.map((r) => r.code).join() !== `${A.ATTENTION_FEEDBACK_CODE},${A.ATTENTION_FEEDBACK_CODE_2}` || uniRows.length !== 1 || rows[1].check !== "number_2") why.push("the rows or their codes are wrong");
  gate("T9", why.length === 0, why.slice(0, 5).join(" | ") ||
    `the Prolific door: over ${N} pretend participants one row in "The tools & the experiment design" (all ${A.TOOLS_SLOTS.length} places) and one in "How this experience was for you" (all ${A.WELLBEING_SLOTS.length}), each place and each number two to five about equally, never the same number twice; the reading checks drawn the same way in both doors; the university plan's fingerprint; the key decides the door; all four checks count for Prolific's rule, two or more failed is the flag (both rows, both reading checks, one of each, three, four), one failed is not, a check never reached is not a failure; the database rows, quality and the major copy; a random clicker fails two or more ${(failBoth / 1000).toFixed(1)}% (765 in 784), one number everywhere never passes both rows; the page draws and saves every row`);
}

/* ------------------------------------------------------------------ T10 the consent page of each door */
{
  const why = [];
  const raw = src("ConsentPage.tsx");
  const consent = bare(raw);
  /* The university page (since 16 October 2026) = the Florida Tech consent submitted to the IRB on 14 October 2026: its key
     places, and every sentence that changed from the gift card, compared letter by letter (the page splits sentences
     across formatting tags). */
  for (const kept of ['export const CONSENT_VERSION = "2026-10-16-course-credit";', 'title="You Can Stop and Come Back"', 'title="Privacy and Your Email"',
    "Course Credit", "What completes the study:", "Tick both boxes above to continue.", "You do not have to finish in one sitting — see below."]) {
    if (!raw.includes(kept)) why.push(`the university page lost: ${kept.slice(0, 50)}`);
  }
  const letters = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const pageLetters = letters(raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<[^>]*>/g, " "));
  for (const said of [
    "If you are taking part for CSE4301/CSE5290 Introduction to Artificial Intelligence: when you complete the study, you receive 50 points averaged into your assignments grade for the course. Taking part is your choice. If you prefer not to take part, or you start and decide to stop, you can complete an alternative assignment for the same 50 points; ask your instructor. Your instructor is told only whether you completed the study, never your answers.",
    "Answer the feedback questions and arrive at the thank-you page. That is the point at which the study counts as complete.",
    "We collect your email address for two reasons only: so you can return and finish the study, and to give your course credit.",
    "Your email is stored with your answers so that you can continue later, and it is seen only by the research team. It is never shared, never sold, and never shown to anyone else taking part. If you take part for course credit, your instructor is told only that you completed the study, never your answers. Your answers are analyzed and reported as group results, so no individual can be identified in anything we publish.",
    "Your participation is completely voluntary. There is no penalty for not taking part. Questions with answer choices need an answer before you can move on (the written answers at the end are optional); if you do not wish to answer a question, you may stop at any time.",
    "You may stop at any time, without giving a reason and without consequence. If you take part for course credit, stopping does not affect your grade: you can complete the alternative assignment instead. If you would like your data removed after taking part, contact the researcher below and it will be deleted.",
    "I have read the procedure described above. I voluntarily agree to take part, and I understand that my email address will be collected so I can return to finish the study and receive my course credit.",
    "I understand that the course credit is given when I complete the study, and that I may complete an alternative assignment instead.",
  ]) if (!pageLetters.includes(letters(said))) why.push(`the university page does not say: ${said.slice(0, 60)}`);
  if ((raw.match(/<Rule title="Reach the end\.">/g) ?? []).length !== 2) why.push("the university page lost its rule \"Reach the end.\" (one in each door)");
  if (/gift card|Amazon|\$5|REQUIRED_ACTIVE_MINUTES|skip questions|stored separately/i.test(consent)) why.push("the consent page still names the gift card, the minutes rule, skipping questions or a separate email");
  if (!/export const PROLIFIC_CONSENT_VERSION = "2026-10-14-prolific-will-be-rejected";/.test(consent)) why.push("the Prolific wording has no version stamp of its own, or the stamp did not move with the attention sentence");
  /* The study's length, the same sentence in both doors (the researcher, 7 October 2026: "the minimum time for this study is
     35 minutes"; Prolific's listing says 35): not inside a door switch, and the old "40 to 55 minutes" gone. */
  if (!/The whole study takes\{" "\}\s*<Text[^>]*>\s*at least 35 minutes\s*<\/Text>\s*\{prolific \? "\. Please complete it in one sitting — see below\." : "\. You do not have to finish in one sitting — see below\."\}/.test(consent)) why.push("the consent page does not say \"at least 35 minutes\" in both doors");
  if (/40 to 55/.test(consent)) why.push("the old \"40 to 55 minutes\" is still on the consent page");
  const block = (name) => consent.slice(consent.indexOf(`function ${name}(`), consent.indexOf("\nfunction ", consent.indexOf(`function ${name}(`) + 10) > 0 ? consent.indexOf("\nfunction ", consent.indexOf(`function ${name}(`) + 10) : consent.indexOf("export function ConsentPage"));
  const prolificText = ["ProlificSitting", "ProlificPayment", "ProlificPrivacy", "ProlificAgreement"].map(block).join("\n").replace(/\s+/g, " ");
  for (const said of ["One Sitting, Within Prolific's Time Limit", "open the study again from Prolific", "Your Payment Through Prolific",
    "If you fail two or more of them, your submission will be rejected.", "We never ask for your name or your email.",
    "Your answers are stored with your Prolific ID", "I do not agree", "Stop without completing", "No completion code is needed.",
    "version: PROLIFIC_CONSENT_VERSION"]) {
    if (!prolificText.includes(said)) why.push(`the Prolific page does not say: ${said}`);
  }
  if (/gift card|Amazon|\$5|REQUIRED_ACTIVE_MINUTES|active minutes|your email address/i.test(prolificText)) why.push("the Prolific page names the gift card, the email or the minutes rule");
  if (/two or more of them, your submission may be rejected/.test(prolificText)) why.push("the Prolific page still says \"may be rejected\" for the attention checks");
  if ((block("ProlificAgreement").match(/<Checkbox\b/g) ?? []).length !== 1) why.push("the Prolific agreement does not have exactly one box");
  if (!/disabled=\{!checked\}/.test(block("ProlificAgreement"))) why.push("the Prolific button works before the box is ticked");
  const page = consent.slice(consent.indexOf("export function ConsentPage"));
  for (const sw of ["{prolific ? <ProlificSitting /> : (", "{prolific ? <ProlificPayment /> : (", "{prolific ? <ProlificPrivacy /> : (", "{prolific ? <ProlificAgreement onAgree={onAgree} /> : ("]) {
    if (!page.includes(sw)) why.push(`the page does not switch: ${sw}`);
  }
  if (!/door = "university"/.test(page) || !/const prolific = door === "prolific";/.test(page)) why.push("the page does not default to the university door");
  if (!/You may stop at any time, without giving a reason and without consequence, by returning the study on Prolific\./.test(page) || !/with your Prolific ID, and it will be deleted\./.test(page)) why.push("the Prolific withdrawal does not go through Prolific with the ID");
  const flow = bare(src("ExperimentFlow.tsx"));
  if (!/<ConsentPage\s+door=\{door\}/.test(flow)) why.push("the flow does not tell the consent page its door");
  gate("T10", why.length === 0, why.slice(0, 5).join(" | ") ||
    "the consent page: the university wording = the Florida Tech consent submitted on 14 October 2026 (course credit, its eight changed sentences letter by letter, no gift card, no minutes rule); the Prolific door says paid through Prolific, one sitting within Prolific's time limit, the Prolific ID instead of the email, \"If you fail two or more of them, your submission will be rejected.\", withdrawal through Prolific with the ID, one box, \"I do not agree\" with \"Stop without completing\"; no gift card, email or minutes there; its own version stamp; the flow passes the door");
}

/* ------------------------------------------------------------------ P1 the deleted pages' data */
{
  const why = [];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = recipe.seededRandom(92);
  const upTo = (n) => Math.floor(rand() * (n + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  /* Blocks 1-4 in the shapes the blocks store (the recipe of report_planner_overlap.cjs), at random. */
  function person() {
    const places = ["sidewalk", "wealthy", "shelter"];
    const history = [], moneyThresholds = {};
    places.forEach((place) => {
      const stop = upTo(8), action = pick(["return", "donate"]);
      for (let s = 0; s < stop; s++) history.push({ contextKey: place, action });
      moneyThresholds[`threshold_${place}`] = stop >= 8
        ? { contextKey: place, accepted: false, thresholdAmount: null, thresholdLabel: null, thresholdAmountIndex: null, thresholdBeyondRange: true }
        : { contextKey: place, accepted: true, thresholdAmount: 1, thresholdLabel: "x", thresholdAmountIndex: stop, thresholdBeyondRange: false };
    });
    const ladder = (v) => (v >= 8 ? { accepted: false, thresholdIndex: null } : { accepted: true, thresholdIndex: v });
    const cells = {};
    for (const [group, key] of [["low_buffer", "lowbuffer"], ["high_buffer", "highbuffer"]]) {
      ["small", "medium", "large"].forEach((size) => {
        const v = upTo(6);
        cells[`threshold_${key}_${size}`] = { groupTypeKey: group, groupSizeKey: size, accepted: v < 6, thresholdGainIndex: v < 6 ? v : null, blockedByPriorNonAcceptance: false };
      });
    }
    const initial = pick(["proceed", "do_not_proceed"]);
    return {
      money: { completed: true, completedAt: "x", thresholds: moneyThresholds, history },
      trolley: { completed: true, completedAt: "x", summary: {}, history: [], leverThreshold: { scenarioType: "lever", ...ladder(upTo(8)) }, bridgeThreshold: { scenarioType: "bridge", ...ladder(clamp(upTo(8) + 1, 0, 8)) } },
      ai: { completed: true, completedAt: "x", thresholds: cells, history: [] },
      decisions: { initialDecision: initial, midDecision: initial, finalDecision: rand() < 0.2 ? "proceed" : initial, confidence: 1 + upTo(4), initialConfidence: 1 + upTo(4), reportedInfluence: rand() < 0.5, influentialValence: null },
    };
  }
  const now = new Date("2026-09-29T12:00:00.000Z");
  let checked = 0;
  for (let i = 0; i < 300; i++) {
    const p = person();
    /* The deleted insights page's own recipe, written out again. */
    const profile = deriveMoralProfile(p.money, p.trolley, p.ai);
    const seedCase = selectSeedCase(profile);
    const domain = selectDomain(profile);
    const pagePayload = { profile, seedCase, scenarioContext: buildScenarioContext(profile, domain), analysis: computeAIWorkforceAnalysis(p.ai) };
    const pageSnapshot = { participantId: "pid", profile, seedCase, domain: domain.key, generatedAt: now.toISOString() };
    const made = IB.deriveInsights(p.money, p.trolley, p.ai, "pid", now);
    if (JSON.stringify(made.payload) !== JSON.stringify(pagePayload) || JSON.stringify(made.snapshot) !== JSON.stringify(pageSnapshot)) { why.push(`person ${i}: the after-Block-3 files differ from the page's`); break; }
    /* The deleted final-analysis page's own recipe. */
    const analysis = generateFinalAnalysis(profile, p.decisions);
    const pageFinal = { analysis, tentative_style: analysis.tentativeStyle, threshold_tree: buildThresholdTree(profile, p.ai, p.decisions), completed_at: now.toISOString() };
    if (JSON.stringify(IB.buildFinalAnalysisFile(profile, p.ai, p.decisions, now)) !== JSON.stringify(pageFinal)) { why.push(`person ${i}: the after-Block-4 file differs from the page's`); break; }
    checked += 1;
  }
  /* The writers: both files after Block 3, the analysis file after Block 4; nothing when a block is missing. */
  const p = person();
  store = { money_threshold_results: null };
  const keys = { money: "money_threshold_results", trolley: "trolley_threshold_results", ai: "ai_workforce_block_results" };
  const constants = B("constants.js"), trolleyTypes = B("trolleyTypes.js"), aiTypes = B("aiWorkforceTypes.js");
  keys.money = constants.SESSION_KEY_RESULTS; keys.trolley = trolleyTypes.TROLLEY_RESULTS_STORAGE_KEY; keys.ai = aiTypes.AI_WORKFORCE_RESULTS_KEY;
  store = { [keys.money]: JSON.stringify(p.money), [keys.trolley]: JSON.stringify(p.trolley) };
  if (IB.deriveAndSaveInsights("pid") !== null || IB.FLOW_INSIGHTS_KEY in store || IB.PROFILE_INSIGHTS_KEY in store) why.push("a missing Block 3 still wrote files");
  store[keys.ai] = JSON.stringify(p.ai);
  const payload = IB.deriveAndSaveInsights("pid");
  if (!payload || !(IB.FLOW_INSIGHTS_KEY in store) || !(IB.PROFILE_INSIGHTS_KEY in store)) why.push("after Block 3 the two files were not written");
  IB.saveFinalAnalysis(payload.profile, p.decisions);
  const final = JSON.parse(store[IB.FINAL_ANALYSIS_KEY] ?? "null");
  if (!final || !final.threshold_tree || final.tentative_style !== final.analysis.tentativeStyle) why.push("after Block 4 the analysis file was not written");
  if (IB.FLOW_INSIGHTS_KEY !== "experiment_flow_insights" || IB.PROFILE_INSIGHTS_KEY !== "moral_profile_insights" || IB.FINAL_ANALYSIS_KEY !== "final_moral_analysis") why.push("a file name changed, so the database would stop receiving it");
  gate("P1", why.length === 0, why.length ? why.join(" | ")
    : `for ${checked} pretend participants the new functions make exactly the files the two deleted pages made (their recipe written out again); both writers write, and nothing is written when an earlier block is missing`);
}

/* ------------------------------------------------------------------ P2 the deleted pages, from the source */
{
  const why = [];
  for (const f of ["MoralProfileInsightsPage.tsx", "FinalMoralAnalysisPage.tsx", "RankedThresholdTree.tsx", "ProfileCalculationModal.tsx"]) {
    if (fs.existsSync(path.join(ROOT, "src", "experiment", f))) why.push(`${f} is back`);
  }
  const flow = bare(src("ExperimentFlow.tsx"));
  if (/stage === "insights"|stage === "final_analysis"|\| "insights"|\| "final_analysis"/.test(flow)) why.push("a deleted stage is still in the flow");
  if (!/const DELETED_STAGE_NEXT: Record<string, Stage> = \{ insights: "block4", final_analysis: "block5_intro" \}/.test(flow)
      || !flow.includes("if (DELETED_STAGE_NEXT[saved]) return DELETED_STAGE_NEXT[saved];")) why.push("a browser stopped on a deleted page does not land on the next stage");
  const product = flow.slice(flow.indexOf("const handleProductContinue"), flow.indexOf("const handleBlock4Continue"));
  if (!/deriveAndSaveInsights\(participantId\)[\s\S]*goOnAfterBlock\(3\)/.test(product)) why.push("Block 3's end does not derive the files before moving on");
  const block4 = flow.slice(flow.indexOf("const handleBlock4Continue"), flow.indexOf("const handleStartBlock5Scenarios"));
  const iSave = block4.indexOf("saveFinalAnalysis("), iCapture = block4.indexOf("captureParticipantRecord(participantId)"), iGo = block4.indexOf('setStage("transition_block4_block5")');
  if (!(iSave > 0 && iCapture > iSave && iGo > iCapture)) why.push("Block 4's end does not write the analysis, then the participant record, then move on");
  const rows = Object.fromEntries(db.SOURCE_MAP.map((s) => [s.key, s.path]));
  if (rows.moral_profile_insights !== "analysis.post_block3_insights" || rows.final_moral_analysis !== "analysis.post_block4_final_analysis") why.push("the database no longer receives the two sections");
  for (const k of ["experiment_flow_insights", "moral_profile_insights", "final_moral_analysis", A.ATTENTION_KEY]) if (!db.RESUME_FILES.includes(k)) why.push(`${k} no longer travels between browsers`);
  if (rows[A.ATTENTION_KEY] !== "analysis.attention_checks") why.push("the attention file does not reach analysis.attention_checks");
  const stepper = bare(src("GlobalStepper.tsx"));
  if (/"insights"|"final_analysis"/.test(stepper)) why.push("the progress bar still lists a deleted page");
  gate("P2", why.length === 0, why.length ? why.join(" | ")
    : "the four page files are gone; Block 3's end derives both files and Block 4's end writes the analysis before the participant record; the database still receives both sections, they and the attention file travel between browsers; a browser stopped on a deleted page lands on the next stage");
}

console.log("");
console.log("==============================================================================");
if (fails) {
  console.log(`### ${fails} ATTENTION GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("==============================================================================");
  process.exit(1);
}
console.log("### ALL ATTENTION GATES PASSED ###");
console.log("==============================================================================");
