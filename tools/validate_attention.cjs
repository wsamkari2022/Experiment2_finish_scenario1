/*
 * validate_attention.cjs — the attention checks, and the two deleted between-block pages (29 September 2026).
 *
 * The researcher asked for three simple attention checks (a colour and a letter during the study, "Pick the number
 * four" in the feedback), each placed and chosen at random per participant, all three needed for the gift card; and
 * for the "insights" and post-Block-4 pages to be deleted, as long as the data stays safe. These gates run the real
 * code (src/experiment/attentionChecks.ts, interBlockData.ts, dbShape.ts) and read the pages' source:
 *
 *   T1  the plan: the two topic questions carry the researcher's approved words and each answer order comes up about
 *       equally over 4,000 pretend participants; the feedback number is only two to five, at every place about equally,
 *       never first in a section and never among the reflection or clarification questions
 *   T2  the plan is drawn once and saved: the same participant always gets the same checks (a refresh or another
 *       device), another email gets its own, and an answered check stays answered
 *   T3  scoring: right only when the answer is what was asked; a miss or a check never reached has its own reason
 *   T4  the gift card (quality): eligible only with all three right on top of the old rules; the colour check's
 *       screen is never a rushed block; the copy in major_info_and_scores matches
 *   T5  the feedback row stays out of the feedback record: never in a scored list, saved in the attention file on
 *       submit, only in the tools or well-being sections, answered correctly by the development fill button
 *   T6  the two answer-pattern flags (Q4) count runs and steps of one exactly, and say they are not for pay
 *   T7  chance: a random clicker passes all three about 1 time in 112; a same-number answerer and a diagonal
 *       clicker are caught as the plan said
 *   T8  the screens, from the source: they say it is an attention check, never say right or wrong, let any pick
 *       continue, show each colour's name; the flow offers the colour check after the drawn part; Block 5 restarts
 *       the next scenario's clock after the letter check; the consent page names the rule
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
const TOPICS = ["after_block3", "after_scenario3"];
{
  const why = [];
  const share = (list, fn, value) => list.filter((p) => fn(p) === value).length / list.length;
  const within = (x, target, tol) => Math.abs(x - target) <= tol;
  /* The words, exactly as the researcher approved them on 30 September 2026 (#3 and #6). */
  const APPROVED = {
    after_block3: { question: "What was the part you just finished about?",
      right: "Deciding whether to approve an AI system that affects workers' jobs",
      wrong: ["Deciding whether to repaint a school's classrooms", "Deciding which player should captain a team", "Deciding where to put a new flower garden"] },
    after_scenario3: { question: "What was the scenario you just finished about?",
      right: "Sharing out a limited cancer treatment",
      wrong: ["Sharing out prizes at a school quiz", "Sharing out rooms in a holiday house", "Sharing out plots in a community garden"] },
  };
  for (const id of TOPICS) {
    const t = A.TOPIC_CHECKS[id], a = APPROVED[id];
    if (t.question !== a.question || t.right !== a.right || JSON.stringify(t.wrong) !== JSON.stringify(a.wrong)) why.push(`${id}: the words are not the approved ones`);
    const four = [a.right, ...a.wrong];
    if (plans.some((p) => [...p[id].options].sort().join("|") !== [...four].sort().join("|"))) why.push(`${id}: an answer list is not the four approved answers`);
    for (const o of four) if (!within(share(plans, (p) => p[id].options[0], o), 0.25, 0.03)) why.push(`${id}: "${o.slice(0, 30)}" is not first about 1 time in 4`);
  }
  if (A.ATTENTION_CHECK_IDS.join() !== "after_block3,after_scenario3,number") why.push("the checks are not the three approved ones");
  if (A.SCENARIO_CHECK_AFTER !== 3) why.push("the scenario check is not right after scenario 3");
  for (const n of [2, 3, 4, 5]) if (!within(share(plans, (p) => p.number.target, n), 0.25, 0.03)) why.push(`number ${n} not about 1 in 4`);
  if (plans.some((p) => ![2, 3, 4, 5].includes(p.number.target) || A.NUMBER_WORDS[p.number.target] !== p.number.word)) why.push("a number outside two to five, or the wrong word");
  const slotKeys = new Set(plans.map((p) => `${p.number.list}:${p.number.after}`));
  if (slotKeys.size !== A.NUMBER_SLOTS.length) why.push(`only ${slotKeys.size} of ${A.NUMBER_SLOTS.length} feedback places used`);
  if (plans.some((p) => !["tools", "wellbeing_a", "wellbeing_b"].includes(p.number.list))) why.push("the number row in a reflection or clarification section");
  if (plans.some((p) => p.number.after < 1 || p.number.after > A.NUMBER_LIST_LENGTHS[p.number.list])) why.push("the number row first in a section, or past its end");
  const toolLikerts = FB.TOOL_RATINGS.filter((q) => q.type === "likert").length;
  if (A.NUMBER_LIST_LENGTHS.tools !== toolLikerts || A.NUMBER_LIST_LENGTHS.wellbeing_a + A.NUMBER_LIST_LENGTHS.wellbeing_b !== FB.WELLBEING_ITEMS.length) why.push("the three lists do not match the feedback's own questions");
  gate("T1", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
    : `the two topic questions carry the researcher's approved words, each of their four answers comes first about 1 time in 4 over ${N} pretend participants, the scenario check sits after scenario 3; the feedback number is two to five, about equally, over all ${A.NUMBER_SLOTS.length} places, never first in a section, never among the reflection or clarification questions`);
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
  A.recordAttentionAnswer("after_block3", A.TOPIC_CHECKS.after_block3.right, 3.2, 1);
  if (!A.isAttentionAnswered("after_block3") || A.isAttentionAnswered("after_scenario3")) why.push("answered / not answered is wrong");
  store.vrds_pending_email = "ben@example.test";
  const ben = A.readAttention();
  if (ben.owner !== "ben@example.test" || Object.keys(ben.answers).length !== 0) why.push("a second person inherited the first person's checks");
  /* A file saved under the old colour-and-letter version is drawn again, not misread. */
  store = { vrds_pending_email: "cy@example.test", [A.ATTENTION_KEY]: JSON.stringify({ version: "2026-09-29-a", owner: "cy@example.test",
    plan: { colour: { slot: "after_block1", target: "green", options: [] }, letter: {}, number: { list: "tools", after: 1, target: 2, word: "two" } }, answers: { colour: { answer: "green" } } }) };
  const cy = A.readAttention();
  if (cy.version !== A.ATTENTION_VERSION || !Array.isArray(cy.plan.after_block3?.options) || Object.keys(cy.answers).length !== 0) why.push("an old-version file is not drawn again");
  /* And a file shaped exactly like today's but stamped with an older version: only the version can tell. */
  const lookalike = { version: "2026-09-29-a", owner: "dee@example.test", plan: A.planAttentionChecks("dee"), answers: { after_block3: ans0(A.TOPIC_CHECKS.after_block3.right) } };
  store = { vrds_pending_email: "dee@example.test", [A.ATTENTION_KEY]: JSON.stringify(lookalike) };
  const dee = A.readAttention();
  if (dee.version !== A.ATTENTION_VERSION || Object.keys(dee.answers).length !== 0) why.push("a file with an older version stamp is kept");
  gate("T2", why.length === 0, why.length ? why.join(" | ")
    : "the plan is drawn once and saved: the same participant gets the same answer orders after a refresh or on another device, an answered check stays answered, another email gets its own, an old-version file is drawn again");
}

/* ------------------------------------------------------------------ T3 scoring */
function fileWith(plan, answers) {
  return { version: A.ATTENTION_VERSION, owner: "x", plan, answers };
}
const at = "2026-09-30T10:00:00.000Z";
const ans = (answer) => ({ answer, correct: false, answeredAt: at, secondsToAnswer: 2, timesChanged: 0 });
const P = plans[7];
const R3 = A.TOPIC_CHECKS.after_block3.right, W3 = A.TOPIC_CHECKS.after_block3.wrong[1], RS = A.TOPIC_CHECKS.after_scenario3.right;
const allRight = fileWith(P, { after_block3: ans(R3), after_scenario3: ans(RS), number: ans(P.number.target) });
const oneWrong = fileWith(P, { after_block3: ans(W3), after_scenario3: ans(RS), number: ans(P.number.target) });
const oneMissing = fileWith(P, { after_block3: ans(R3), after_scenario3: ans(RS) });
{
  const why = [];
  const s1 = A.scoreAttention(allRight), s2 = A.scoreAttention(oneWrong), s3 = A.scoreAttention(oneMissing);
  if (!s1.passedAll || s1.passedCount !== 3 || s1.misses.length) why.push("all right does not pass");
  if (s2.passedAll || s2.passedCount !== 2 || !(s2.misses[0] ?? "").startsWith("missed the check after Block 3") || !(s2.misses[0] ?? "").includes(W3)) why.push(`a wrong answer reads wrong: ${JSON.stringify(s2)}`);
  if (s3.passedAll || s3.answeredCount !== 2 || s3.misses[0] !== "did not answer the feedback check") why.push("a check never reached does not count as missed");
  const textFour = fileWith(P, { after_block3: ans(R3), after_scenario3: ans(RS), number: ans(String(P.number.target)) });
  if (A.scoreAttention(textFour).passedAll) why.push("the number check accepted text for a number");
  if (A.scoreAttention(null) !== null || A.buildAttentionSection({}) !== null) why.push("no file should give no verdict");
  const sec = A.buildAttentionSection(oneWrong);
  if (sec.passed_all !== false || sec.checks.length !== 3 || sec.checks[0].correct !== false || sec.checks[1].correct !== true
      || sec.checks[0].right_answer !== R3 || sec.checks[1].asked !== A.TOPIC_CHECKS.after_scenario3.question
      || JSON.stringify(sec.checks[0].options_in_the_order_shown) !== JSON.stringify(P.after_block3.options)
      || sec.checks[2].right_answer !== P.number.target || !/after rating row/.test(sec.checks[2].where_it_was_shown)) why.push("analysis.attention_checks rows are wrong");
  gate("T3", why.length === 0, why.length ? why.join(" | ")
    : "right only when the answer is exactly the right one (a number as a number); a wrong pick names the right answer and the pick; a check never reached counts as missed; the rows keep the question, the answer order and the answer");
}

/* ------------------------------------------------------------------ T4 the gift card */
{
  const why = [];
  const ledger = { totalMs: 2_400_000, sittings: 1, longestIdleMs: 0, byStage: { money: 300_000, block5: 900_000, attention_check: 5_000 } };
  const varied = { feedback: { decisionSupport: { TOOL_optionCards: 3, TOOL_consequences: 6 }, wellbeing: { items: { LI1: 5, LI2: 2, LI3: 7, LI4: 4, DS1: 5, DS2: 3, DS4: 6, DR1: 2 } } } };
  const q = (attention) => db.buildQuality(ledger, null, varied, "Study Completed", attention);
  const ok = q(allRight), miss = q(oneWrong), none = q(null), missing = q(oneMissing);
  if (ok.compensation_eligible !== true || ok.passed_all_attention_checks !== true || ok.attention_checks_passed !== 3) why.push(`all rules met reads not eligible: ${JSON.stringify(ok.reasons)}`);
  if (miss.compensation_eligible !== false || !miss.reasons.some((r) => /missed the check after Block 3/.test(r))) why.push("a wrong answer is still eligible, or has no reason");
  if (missing.compensation_eligible !== false || !missing.reasons.includes("did not answer the feedback check")) why.push("a check never reached is still eligible");
  if (none.compensation_eligible !== false || !none.reasons.includes("no attention checks on record")) why.push("no attention file is still eligible");
  if (ok.blocks_under_30_seconds !== 0 || ok.rushed_blocks.some((b) => b.stage === "attention_check")) why.push("the check's screen counted as a rushed block");
  const slow = db.buildQuality({ ...ledger, totalMs: 600_000 }, null, varied, "Study Completed", allRight);
  if (slow.compensation_eligible !== false) why.push("too few minutes is eligible once the checks pass");
  if (!/all three attention checks/.test(ok.rule)) why.push("the rule sentence does not name the checks");
  const block5 = { scenarioResults: [], originalProfile: { dimensions: [] } };
  const major = db.buildMajorScores(block5, null, null, null, null, null, oneWrong);
  if (!major || JSON.stringify(major.attention_checks) !== JSON.stringify({ passed_all: false, passed_count: 2, answered_count: 3, misses: A.scoreAttention(oneWrong).misses })) why.push("the copy in major_info_and_scores is wrong");
  if (!/analysis\.attention_checks/.test(major?.where_each_number_lives?.attention_checks ?? "")) why.push("where_each_number_lives does not name the source");
  gate("T4", why.length === 0, why.length ? why.join(" | ")
    : "the gift card needs all three right on top of the old rules, each miss and a missing file give their own reason, the check's screen is never a rushed block, and major_info_and_scores copies the verdict");
}

/* ------------------------------------------------------------------ T5 the feedback row */
{
  const why = [];
  const page = bare(src("UserFeedbackPage.tsx"));
  /* Never in a list that is collected into the feedback record. */
  if (/collect\([^)]*ATTENTION_FEEDBACK_CODE/.test(page)) why.push("the check is collected into the feedback");
  /* Whatever builds the feedback record may not touch the check's code, nor copy every answer wholesale. */
  const iBuilt = page.indexOf("const feedback: FeedbackAnswers = {"), iAttn = page.indexOf("const attentionAnswer = answers[ATTENTION_FEEDBACK_CODE]");
  const iSave = page.indexOf("saveFeedbackRecord(record)");
  const built = iBuilt > 0 && iAttn > iBuilt ? page.slice(iBuilt, iAttn) : "";
  const after = iAttn > 0 && iSave > iAttn ? page.slice(iAttn, iSave) : "";
  if (!built || /ATTENTION_FEEDBACK_CODE|\.\.\.answers\b/.test(built) || /feedback\.\w+\s*=/.test(after)) why.push("the feedback record can carry the check's answer");
  if (!/recordAttentionAnswer\("number", attentionAnswer, null, attentionChanges\.current\)/.test(page)) why.push("the answer is not saved in the attention file on submit");
  const submitAt = page.indexOf('recordAttentionAnswer("number"'), saveAt = page.indexOf("saveFeedbackRecord(record)");
  if (!(submitAt > 0 && saveAt > submitAt)) why.push("the answer is saved after the feedback record, or not at all");
  /* Only in the tools and well-being sections. */
  const calls = [...page.matchAll(/attentionAfter\("(\w+)"/g)].map((m) => m[1]);
  if (calls.sort().join() !== "tools,wellbeing_a,wellbeing_b") why.push(`the row can appear in: ${calls.join(", ")}`);
  const cvrCard = page.slice(page.indexOf('method="cvr"'), page.indexOf('eyebrow="Decision-support tools"'));
  if (/attentionAfter|ATTENTION_FEEDBACK_CODE/.test(cvrCard)) why.push("the row can appear in the reflection or clarification sections");
  if (!page.includes("filled[ATTENTION_FEEDBACK_CODE] = attention.target;")) why.push("the development fill button answers it wrong");
  if (!/text: `This question is just to check your attention\. Pick the number \$\{attention\.word\}\.`/.test(page)) why.push("the wording is not the researcher's");
  /* The feedback record never sees it: the ratings read back from a record carry only real questions. */
  const record = { feedback: { decisionSupport: { TOOL_optionCards: 4, [A.ATTENTION_FEEDBACK_CODE]: 4 }, wellbeing: { items: { LI1: 4 } } } };
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
  if (!/Quick attention check/.test(words) || !/only to check that you are reading/.test(words) || !words.includes("{TOPIC_CHECKS[check].question}")) why.push("the screen does not say it is an attention check, or does not ask the approved question");
  if (/\b(correct|wrong|right|well done|oops|try again)\b/i.test(words.replace(/aria-pressed|data-attention-\w+/g, ""))) why.push("the screen can say right or wrong");
  if (!screen.includes("disabled={picked === null}")) why.push("Continue waits for something other than a pick");
  if (!screen.includes("readAttention().plan[check].options")) why.push("the answers are not shown in the order drawn for this participant");
  const flow = bare(src("ExperimentFlow.tsx"));
  /* Only Block 3's end can lead to the check; the other blocks go straight on. */
  if (!/const handleProductContinue[\s\S]{0,400}goOnAfterBlock3\(\)/.test(flow)) why.push("Block 3's end does not offer the check");
  if (!flow.includes('setStage("transition_money_trolley");') || !flow.includes('setStage("transition_trolley_product");') || !flow.includes('setStage("transition_block4_block5");')) why.push("another block's end does not go straight on");
  if ((flow.match(/"attention_check"/g) ?? []).length !== 3) why.push("the check's stage is reached from somewhere else");
  if (!flow.includes('const AFTER_ATTENTION_CHECK: Stage = "transition_product_block4";') || !flow.includes('<AttentionCheckScreen check="after_block3"')) why.push("the check after Block 3 does not lead on to Block 4");
  if (!/if \(stage === "attention_check"\) \{\s*if \(readAttention\(\)\.answers\.after_block3\) \{\s*setStage\(AFTER_ATTENTION_CHECK\)/.test(flow)) why.push("an answered check can be shown again");
  const sim = bare(src("Block5PublicEmergencySimulation.tsx"));
  if (!/if \(!scenarioCheckDone && progress\.currentScenarioIndex === SCENARIO_CHECK_AFTER\)[\s\S]{0,300}check="after_scenario3"[\s\S]{0,120}telRef\.current = newTelemetryAccum\(\);[\s\S]{0,120}scenarioStartTime: Date\.now\(\)[\s\S]{0,80}setScenarioCheckDone\(true\)/.test(sim)) why.push("the scenario check is not after scenario 3, or does not restart scenario 4's clock");
  const consent = bare(src("ConsentPage.tsx"));
  if (!/Answer the quick attention checks as asked\./.test(consent) || !/answer the attention checks as asked/.test(consent)) why.push("the consent page does not name the rule");
  const telemetry = bare(src("telemetry.ts"));
  if (/"attention_check"/.test(telemetry.slice(telemetry.indexOf("const TIMED_STAGES"), telemetry.indexOf("];", telemetry.indexOf("const TIMED_STAGES"))))) why.push("the check's screen is timed as a stage");
  gate("T8", why.length === 0, why.length ? why.join(" | ")
    : "the screens say it is an attention check, ask the approved question, never say right or wrong, keep the drawn answer order and continue after any pick; only Block 3's end leads to the first, which leads on to Block 4 and is never shown twice; the second sits after scenario 3 and restarts scenario 4's clock; the consent page names the rule");
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
  if (!/deriveAndSaveInsights\(participantId\)[\s\S]*goOnAfterBlock3\(\)/.test(product)) why.push("Block 3's end does not derive the files before moving on");
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
