/**
 * attentionChecks.ts — the study's attention checks (since 29 September 2026; the two inside the study rewritten as
 * READING checks at random places on 14 October 2026).
 *
 * THE RESEARCHER'S REQUEST (29 September 2026). Simple attention checks during the study, plus a feedback row, "This
 * question is just to check your attention. Pick the number four." (the number only two, three, four or five, at a
 * random place among the design or learning-insight questions, never among the CVR or APA questions); all of them
 * answered as asked was part of the pay rule then. Since the study became Prolific only (10 November 2026) failing two or
 * more of the four is the rejection reason, and a check answered wrongly is one of the four careful-participation signs in
 * `quality`, information for the researcher. Plan answers of 29 September: Q2 yes (the consent page says so), all completed
 * sessions are analysed, Q4 yes (two answer-pattern flags, for analysis only).
 *
 * READING CHECKS, NOT MEMORY CHECKS (14 October 2026). The researcher's advisor: an attention check should test whether
 * the participant is really READING, not what they remember; and the checks "should be (somewhat) randomly placed in the
 * survey". Prolific says the same: a valid check gives an explicit instruction, says it is a check, and "cannot rely on
 * memory recall". The two questions about the part just finished (30 September 2026) were memory questions, so each
 * became an everyday question with the instruction inside it, in the researcher's approved words:
 *   between_blocks     its own short screen after Block 1, 2 or 3 (drawn at random per participant), before the next block
 *   between_scenarios  its own short screen after scenario 1, 2 or 3 (drawn at random), before the next scenario
 *   number, number_2   two rating rows in the feedback (random place, random number)
 * A reading check asks nothing about the study, so it can sit anywhere: never between scenarios 4 and 5 (scenario 5 must
 * follow scenario 4 directly) and never before scenario 6 (the prediction test). Four answers each, in a random order per
 * participant. Any pick continues, and nobody is told whether they were right: telling them would teach them to watch
 * for checks. Words only, so it is fair to colour-blind people.
 *
 * THE PLAN IS DRAWN ONCE AND SAVED. The first read makes it from a hash of the participant's session id and key (the
 * two places, the answer orders, and the feedback row's number and place) and saves it in `vrds_attention_checks`, which
 * travels between browsers (RESUME_FILES). So a refresh, or another device, shows the same check at the same place the
 * same way, and an answered check is never asked again. A file made for another participant, or under another version,
 * is replaced.
 *
 * FOUR CHECKS, PROLIFIC'S RULE (since 7 October 2026; the rule since 14 October 2026; the only plan since 10 November
 * 2026). There are two number rows: the first ("number") always in "The tools & the experiment design", the second ("number_2") always in "How
 * this experience was for you", each at its own random place and with its own number two to five (never the same number
 * twice, so one answer given everywhere cannot pass both). All FOUR checks are reading checks of the kind Prolific
 * accepts, and all four count (the researcher's "1-B", 14 October 2026): failing TWO OR MORE of them is Prolific's
 * rejection reason ("If you fail two or more of them, your submission will be rejected", the Prolific consent page). A
 * check never reached is not a failure (a person who did not finish is handled by Prolific on its own).
 *
 * WHAT IT FEEDS. `analysis.attention_checks` (every check, where it was shown, what was asked, the answer order, the
 * answer, right or wrong), `quality.passed_all_attention_checks` and `quality.careful_participation` (a check answered
 * wrongly is one of its four signs; information only, never pay), the Prolific rule in `quality` and `analysis.attention_checks.prolific_rule`, and a copy in
 * `major_info_and_scores`. The feedback check's answer is kept HERE, never in the feedback record, so it cannot move a
 * well-being score, a tool rating or the "same answer to every rating" flag. `analysis.feedback_answer_patterns` (Q4) is
 * built from the feedback record and is never used for pay. Checked by `npm run validate:attention`.
 */

import { keyOfDemographics } from "./recruitment";
import { SESSION_ID_KEY } from "./session";
import {
  APA_QUESTIONS, CVR_QUESTIONS, DUAL_VIEW_QUESTIONS, TOOL_CLOSERS, TOOL_RATINGS, WELLBEING_ITEMS,
  WELLBEING_PART_A_SUBSCALES,
} from "./feedbackTypes";

export const ATTENTION_KEY = "vrds_attention_checks";
/** Move whenever the checks, their places or their scoring change; stamped on every saved file. A file under another
 *  version is drawn again (no real data existed when it moved). */
export const ATTENTION_VERSION = "2026-11-10-prolific-only";
/** Older versions whose files are still read as they are. None since 14 October 2026: the files before it hold the two
 *  memory questions, which no longer exist, so they are drawn again (nobody had taken the study yet). */
export const STILL_READ_VERSIONS: readonly string[] = [];
/** The flow stage of the between-blocks check's own screen. Not a block: never timed, never called rushed. */
export const ATTENTION_STAGE = "attention_check";
/** The feedback page's answer code for the number check. Not a feedback question: never in the feedback record. */
export const ATTENTION_FEEDBACK_CODE = "ATTN_number";
/** The second number row's answer code (since 7 October 2026). Never in the feedback record. */
export const ATTENTION_FEEDBACK_CODE_2 = "ATTN_number_2";

export type ReadingCheckId = "between_blocks" | "between_scenarios";
export type NumberCheckId = "number" | "number_2";
export type AttentionCheckId = ReadingCheckId | NumberCheckId;
/** The four checks. All four count for Prolific's rule. */
export const ATTENTION_CHECK_IDS: AttentionCheckId[] = ["between_blocks", "between_scenarios", "number", "number_2"];
/** Prolific's rule: this many failed checks (or more) is the rejection reason the Prolific consent page names. */
export const PROLIFIC_FAILS_TO_REJECT = 2;

/** After which block the between-blocks check may appear (then the next block opens): Block 1, 2 or 3. */
export const BLOCK_CHECK_PLACES = [1, 2, 3] as const;
/** After how many finished scenarios the between-scenarios check may appear: 1, 2 or 3. Never 4 (scenario 5 follows
 *  scenario 4 directly) and never 5 (scenario 6 is the prediction test). */
export const SCENARIO_CHECK_PLACES = [1, 2, 3] as const;
export const BLOCK_NAMES: Record<number, string> = { 1: "Block 1 (found money)", 2: "Block 2 (trolley)", 3: "Block 3 (AI workforce)" };

/**
 * The two reading checks, word for word as the researcher approved them on 14 October 2026 ("2-yes"). On screen the
 * question comes first and its instruction right under it. Do not edit a word without the researcher: validate:attention
 * holds them to this text.
 */
export const READING_CHECKS: Record<ReadingCheckId, { question: string; instruction: string; right: string; wrong: [string, string, string] }> = {
  between_blocks: {
    question: "How do you usually get to work or class?",
    instruction: "This question checks that you are reading: please choose 'By boat', whatever your real answer is.",
    right: "By boat",
    wrong: ["By car", "By bus or train", "On foot or by bike"],
  },
  between_scenarios: {
    question: "Which of these do you enjoy most on a free afternoon?",
    instruction: "This question checks that you are reading: please choose 'Reading a book', whatever your real answer is.",
    right: "Reading a book",
    wrong: ["Listening to music", "Walking outside", "Watching a film"],
  },
};

/** Where a reading check was shown, in words, from its drawn place. */
export function readingCheckWhere(id: ReadingCheckId, after: number): string {
  return id === "between_blocks"
    ? `its own screen right after ${BLOCK_NAMES[after] ?? `Block ${after}`}, before the next block`
    : `its own screen right after scenario ${after}, before scenario ${after + 1}`;
}

export const NUMBER_TARGETS = [2, 3, 4, 5] as const;
export const NUMBER_WORDS: Record<number, string> = { 2: "two", 3: "three", 4: "four", 5: "five" };

/** The three rating lists the number check may sit in. */
export type NumberList = "tools" | "wellbeing_a" | "wellbeing_b";
const WELLBEING_A = WELLBEING_ITEMS.filter((i) => WELLBEING_PART_A_SUBSCALES.includes(i.subscale));
const WELLBEING_B = WELLBEING_ITEMS.filter((i) => !WELLBEING_PART_A_SUBSCALES.includes(i.subscale));
const TOOL_LIKERTS = TOOL_RATINGS.filter((q) => q.type === "likert");
export const NUMBER_LIST_LENGTHS: Record<NumberList, number> = {
  tools: TOOL_LIKERTS.length, wellbeing_a: WELLBEING_A.length, wellbeing_b: WELLBEING_B.length,
};
export const NUMBER_LIST_WORDS: Record<NumberList, string> = {
  tools: "\"The tools & the experiment design\"",
  wellbeing_a: "\"How this experience was for you\", first half",
  wellbeing_b: "\"How this experience was for you\", second half",
};
/** Every place the number check may sit: after row 1, 2, ... of each list, so never first in a section. */
export const NUMBER_SLOTS: { list: NumberList; after: number }[] = (["tools", "wellbeing_a", "wellbeing_b"] as NumberList[])
  .flatMap((list) => Array.from({ length: NUMBER_LIST_LENGTHS[list] }, (_, i) => ({ list, after: i + 1 })));
/** The two rows' places: the first in the tools section, the second in the well-being section. */
export const TOOLS_SLOTS = NUMBER_SLOTS.filter((s) => s.list === "tools");
export const WELLBEING_SLOTS = NUMBER_SLOTS.filter((s) => s.list !== "tools");

export interface NumberRow { list: NumberList; after: number; target: number; word: string }

export interface ReadingPlan { after: number; options: string[] }

export interface AttentionPlan {
  /** Each reading check: where it is shown (after Block 1, 2 or 3; after scenario 1, 2 or 3) and its four answers in
   *  the order this participant sees them. */
  between_blocks: ReadingPlan;
  between_scenarios: ReadingPlan;
  number: NumberRow;
  number_2: NumberRow;
}

/** The number rows a plan puts in the feedback, with their answer codes, in page order. */
export function numberRowsOf(plan: AttentionPlan): { check: NumberCheckId; code: string; row: NumberRow }[] {
  return [
    { check: "number" as const, code: ATTENTION_FEEDBACK_CODE, row: plan.number },
    { check: "number_2" as const, code: ATTENTION_FEEDBACK_CODE_2, row: plan.number_2 },
  ];
}

export interface AttentionAnswer {
  answer: string | number;
  correct: boolean;
  answeredAt: string;
  /** From the check appearing to Continue (the topic questions); null for the feedback row, which is not timed. */
  secondsToAnswer: number | null;
  /** How many times the pick changed before it was kept. */
  timesChanged: number;
}

export interface AttentionFile {
  version: string;
  /** The Prolific ID it was made for, lower case ("" when the study runs without one). */
  owner: string;
  plan: AttentionPlan;
  answers: Partial<Record<AttentionCheckId, AttentionAnswer>>;
}

/**
 * FNV-1a, 32-bit, then a finishing mix: the same on every machine. The mix matters. FNV-1a's lowest bits barely
 * change between seeds that differ only in their last characters, and "one of four" reads exactly those bits:
 * without the mix, 4,000 pretend participants were only ever given two of four choices (validate:attention T1 caught
 * it). The mix is MurmurHash3's finaliser, which spreads every input bit over every output bit.
 */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function pick<T>(items: readonly T[], seed: string, what: string): T {
  return items[fnv1a(`${seed}#${what}`) % items.length];
}

function shuffled<T extends string>(items: readonly T[], seed: string, what: string): T[] {
  return [...items].sort((a, b) => fnv1a(`${seed}#${what}#${a}`) - fnv1a(`${seed}#${what}#${b}`) || (a < b ? -1 : 1));
}

const answersOf = (id: ReadingCheckId) => [READING_CHECKS[id].right, ...READING_CHECKS[id].wrong];

/**
 * The whole plan from one seed: pure, so the checks can hold it to its rules over thousands of seeds.
 */
export function planAttentionChecks(seed: string): AttentionPlan {
  const topics = {
    between_blocks: { after: pick(BLOCK_CHECK_PLACES, seed, "block-check-place"), options: shuffled(answersOf("between_blocks"), seed, "block-check-order") },
    between_scenarios: { after: pick(SCENARIO_CHECK_PLACES, seed, "scenario-check-place"), options: shuffled(answersOf("between_scenarios"), seed, "scenario-check-order") },
  };
  const target = pick(NUMBER_TARGETS, seed, "number");
  /* One row in each section, two different numbers. */
  const first = pick(TOOLS_SLOTS, seed, "number-place-tools");
  const second = pick(WELLBEING_SLOTS, seed, "number-2-place");
  const target2 = pick(NUMBER_TARGETS.filter((n) => n !== target), seed, "number-2");
  return {
    ...topics,
    number: { list: first.list, after: first.after, target, word: NUMBER_WORDS[target] },
    number_2: { list: second.list, after: second.after, target: target2, word: NUMBER_WORDS[target2] },
  };
}

/** The participant this browser is working for: the Prolific ID the flow keeps (the same one it saves under). */
function currentOwner(): string {
  try {
    const pending = localStorage.getItem("vrds_pending_email");
    if (pending) return pending.trim().toLowerCase();
    return String(keyOfDemographics(JSON.parse(localStorage.getItem("vrds_demographics") ?? "null")) ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function isFile(value: unknown): value is AttentionFile {
  const f = value as AttentionFile | null;
  if (!f || typeof f !== "object") return false;
  const versionOk = f.version === ATTENTION_VERSION || STILL_READ_VERSIONS.includes(f.version);
  const reading = (r: ReadingPlan | undefined, places: readonly number[]) =>
    !!r && Array.isArray(r.options) && r.options.length === 4 && places.includes(r.after);
  return versionOk
    && reading(f.plan?.between_blocks, BLOCK_CHECK_PLACES) && reading(f.plan?.between_scenarios, SCENARIO_CHECK_PLACES) && !!f.plan?.number
    && !!f.plan?.number_2
    && typeof f.answers === "object" && f.answers !== null;
}

/**
 * This participant's checks: the saved file when it is theirs, otherwise a new plan (saved at once, so it never
 * changes afterwards).
 */
export function readAttention(): AttentionFile {
  const owner = currentOwner();
  try {
    const saved = JSON.parse(localStorage.getItem(ATTENTION_KEY) ?? "null") as unknown;
    if (isFile(saved) && saved.owner === owner) return saved;
  } catch { /* unreadable: made again below */ }
  let session = "";
  try { session = localStorage.getItem(SESSION_ID_KEY) ?? ""; } catch { /* ignore */ }
  const file: AttentionFile = {
    version: ATTENTION_VERSION, owner, plan: planAttentionChecks(`${session}|${owner}`), answers: {},
  };
  try { localStorage.setItem(ATTENTION_KEY, JSON.stringify(file)); } catch { /* the run goes on */ }
  return file;
}

export function isAttentionAnswered(id: AttentionCheckId): boolean {
  return !!readAttention().answers[id];
}

/**
 * Whether the between-blocks reading check comes right after Block `block` (1-3) for this participant: drawn there and
 * not answered yet. The flow asks it at the end of Blocks 1, 2 and 3, so the check appears once, after the drawn block.
 */
export function readingCheckFollowsBlock(file: AttentionFile, block: number): boolean {
  return file.plan.between_blocks.after === block && !file.answers.between_blocks;
}

/**
 * Whether the between-scenarios reading check comes before the next scenario, once `finishedScenarios` scenarios are
 * finished (Block 5's currentScenarioIndex): drawn there (after scenario 1, 2 or 3) and not answered yet.
 */
export function readingCheckBeforeScenario(file: AttentionFile, finishedScenarios: number): boolean {
  return file.plan.between_scenarios.after === finishedScenarios && !file.answers.between_scenarios;
}

/** The answer that counts as right for each check. */
export function attentionTarget(plan: AttentionPlan, id: AttentionCheckId): string | number {
  if (id === "number") return plan.number.target;
  if (id === "number_2") return plan.number_2?.target ?? NaN;
  return READING_CHECKS[id].right;
}

/** Saves one answer (the kept pick). Right or wrong is worked out here and never shown. */
export function recordAttentionAnswer(
  id: AttentionCheckId, answer: string | number, secondsToAnswer: number | null, timesChanged: number,
): void {
  const file = readAttention();
  file.answers[id] = {
    answer,
    correct: answer === attentionTarget(file.plan, id),
    answeredAt: new Date().toISOString(),
    secondsToAnswer: secondsToAnswer === null ? null : Math.round(secondsToAnswer * 10) / 10,
    timesChanged,
  };
  try { localStorage.setItem(ATTENTION_KEY, JSON.stringify(file)); } catch { /* the run goes on */ }
}

/* ------------------------------------------------------------------ scoring and the database */

export interface AttentionScore {
  /** How many checks there are (four). */
  asked: number;
  passedAll: boolean;
  passedCount: number;
  answeredCount: number;
  /** One sentence per check that was missed or never answered, for the pay reasons. */
  misses: string[];
  /** Prolific's rule: all four checks count, and failing two or more is the rejection reason. */
  prolific: { counted: number; answered: number; failed: number; failedTwoOrMore: boolean };
}

/** Each check in words, for the misses and the pay reasons: a reading check by where it was shown, the two number rows
 *  by their order. */
function checkWords(plan: AttentionPlan, id: AttentionCheckId): string {
  if (id === "between_blocks") return `the reading check after Block ${plan.between_blocks.after}`;
  if (id === "between_scenarios") return `the reading check after scenario ${plan.between_scenarios.after}`;
  if (id === "number_2") return "the second feedback check";
  return "the first feedback check";
}

/** What the check asked, in words, for the database and the pay reasons. */
function asked(plan: AttentionPlan, id: AttentionCheckId): string {
  if (id === "number") return `pick the number ${plan.number.word}`;
  if (id === "number_2") return `pick the number ${plan.number_2.word}`;
  return `${READING_CHECKS[id].question} ${READING_CHECKS[id].instruction}`;
}

/** The verdict over the four checks. A check never reached counts as not passed. */
export function scoreAttention(raw: unknown): AttentionScore | null {
  if (!isFile(raw)) return null;
  const misses: string[] = [];
  let passed = 0;
  let answered = 0;
  const ids = ATTENTION_CHECK_IDS;
  for (const id of ids) {
    const a = raw.answers[id];
    if (!a) {
      misses.push(`did not answer ${checkWords(raw.plan, id)}`);
      continue;
    }
    answered += 1;
    const right = a.answer === attentionTarget(raw.plan, id);
    if (right) passed += 1;
    else misses.push(`missed ${checkWords(raw.plan, id)} (the right answer was "${attentionTarget(raw.plan, id)}", picked "${a.answer}")`);
  }
  /* Prolific's rule (the researcher's "1-B", 14 October 2026): all four checks count, and a check "failed" is one
     ANSWERED against its instruction (a check never reached is a person who did not finish, which Prolific handles on
     its own). Two or more failed is the rejection reason the consent page names. */
  const failed = answered - passed;
  const prolific = { counted: ids.length, answered, failed, failedTwoOrMore: failed >= PROLIFIC_FAILS_TO_REJECT };
  return { asked: ids.length, passedAll: passed === ids.length, passedCount: passed, answeredCount: answered, misses, prolific };
}

/** analysis.attention_checks: every check in full, and the verdict. Nothing here was on screen but the checks. */
export function buildAttentionSection(raw: unknown): Record<string, unknown> | null {
  if (!isFile(raw)) return null;
  const score = scoreAttention(raw);
  if (!score) return null;
  const plan = raw.plan;
  const row = (id: AttentionCheckId, where: string, options: (string | number)[]) => {
    const a = raw.answers[id];
    return {
      check: id,
      where_it_was_shown: where,
      /* The drawn place in numbers (a reading check only): after Block 1-3, or after scenario 1-3. */
      shown_after_block: id === "between_blocks" ? plan.between_blocks.after : null,
      shown_after_scenario: id === "between_scenarios" ? plan.between_scenarios.after : null,
      asked: asked(plan, id),
      right_answer: attentionTarget(plan, id),
      options_in_the_order_shown: options,
      answer: a?.answer ?? null,
      correct: a ? a.answer === attentionTarget(plan, id) : null,
      seconds_to_answer: a?.secondsToAnswer ?? null,
      times_changed: a?.timesChanged ?? null,
      answered_at: a?.answeredAt ?? null,
    };
  };
  const numberWhere = (r: NumberRow) => `the feedback, in ${NUMBER_LIST_WORDS[r.list]}, after rating row ${r.after}`;
  return {
    version: raw.version,
    passed_all: score.passedAll,
    passed_count: score.passedCount,
    answered_count: score.answeredCount,
    checks_asked: score.asked,
    misses: score.misses,
    checks: [
      row("between_blocks", readingCheckWhere("between_blocks", plan.between_blocks.after), plan.between_blocks.options),
      row("between_scenarios", readingCheckWhere("between_scenarios", plan.between_scenarios.after), plan.between_scenarios.options),
      row("number", numberWhere(plan.number), [1, 2, 3, 4, 5, 6, 7]),
      row("number_2", numberWhere(plan.number_2), [1, 2, 3, 4, 5, 6, 7]),
    ],
    prolific_rule: {
      attention_checks_counted: score.prolific.counted,
      attention_checks_answered: score.prolific.answered,
      attention_checks_failed: score.prolific.failed,
      failed_two_or_more_attention_checks: score.prolific.failedTwoOrMore,
      how_to_read:
        "Prolific's rule (since 14 October 2026, the researcher's '1-B'): all four checks are reading checks of the kind "
        + "Prolific accepts (an explicit instruction, said to be a check, no memory needed), and all four count. Failing "
        + "two or more of them is the rejection reason the consent page names ('If you fail two or more of them, your "
        + "submission will be rejected'); failed_two_or_more_attention_checks says so. A check never answered is not "
        + "counted as failed. The researcher rejects on Prolific himself (npm run pay:check lists them).",
    },
    how_to_read:
      "Two reading checks on their own screens (one after Block 1, 2 or 3, one after scenario 1, 2 or 3, each place drawn "
      + "at random per participant; shown_after_block / shown_after_scenario) and two 'Pick the number ...' rows in the "
      + "feedback. All four count for Prolific's rule (prolific_rule above); passed_all says whether all four were right. "
      + "A check answered wrongly is also one of the four careful-participation signs (quality.careful_participation). "
      + "Participants were never told whether they were right. All completed sessions are analysed (the researcher, 30 "
      + "September 2026).",
  };
}

/* ------------------------------------------------------------------ answer patterns (Q4, analysis only) */

/**
 * The feedback's 1-7 ratings in the order they were on screen: reflection, second view, clarification, tools,
 * the closing rating, then the well-being statements. Yes/no and written answers are left out.
 */
export function feedbackRatingsInOrder(feedbackRecord: unknown): number[] {
  const f = (feedbackRecord as { feedback?: Record<string, unknown> } | null)?.feedback;
  if (!f) return [];
  const cvr = (f.cvr ?? {}) as Record<string, unknown>;
  const apa = (f.apa ?? {}) as Record<string, unknown>;
  const tools = (f.decisionSupport ?? {}) as Record<string, unknown>;
  const wb = ((f.wellbeing as { items?: Record<string, unknown> } | undefined)?.items ?? {}) as Record<string, unknown>;
  const take = (codes: string[], from: Record<string, unknown>) =>
    codes.map((c) => from[c]).filter((v): v is number => typeof v === "number");
  return [
    ...take([...CVR_QUESTIONS, ...DUAL_VIEW_QUESTIONS].map((q) => q.code), cvr),
    ...take(APA_QUESTIONS.map((q) => q.code), apa),
    ...take([...TOOL_RATINGS, ...TOOL_CLOSERS].map((q) => q.code), tools),
    ...take(WELLBEING_ITEMS.map((i) => i.code), wb),
  ];
}

/**
 * analysis.feedback_answer_patterns (Q4): two flags that a single "same answer everywhere" test cannot see, saved
 * for the analysis and NEVER used for pay. Example: 5,5,5,5,5,5,5,5 then varied answers is not "the same answer to
 * every rating", but its longest run is 8; 1,2,3,4,5,6,7,1,2 walks the scale in steps of one (a diagonal).
 */
export function buildFeedbackPatterns(feedbackRecord: unknown): Record<string, unknown> | null {
  const r = feedbackRecord ? feedbackRatingsInOrder(feedbackRecord) : [];
  if (r.length === 0) return null;
  let run = 1, longestRun = 1, stair = 0, stairRun = 1, longestStair = 1;
  for (let i = 1; i < r.length; i++) {
    run = r[i] === r[i - 1] ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
    const step = Math.abs(r[i] - r[i - 1]) === 1;
    if (step) stair += 1;
    stairRun = step ? stairRun + 1 : 1;
    longestStair = Math.max(longestStair, stairRun);
  }
  const counts = new Map<number, number>();
  for (const v of r) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [mostCommon, mostCount] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return {
    ratings_counted: r.length,
    longest_run_of_the_same_answer: longestRun,
    most_common_answer: mostCommon,
    share_of_the_most_common_answer: Math.round((mostCount / r.length) * 100) / 100,
    share_of_steps_of_exactly_one: r.length > 1 ? Math.round((stair / (r.length - 1)) * 100) / 100 : 0,
    longest_run_of_steps_of_exactly_one: longestStair,
    used_for_pay: false,
    how_to_read:
      "The 1-7 feedback ratings in the order they were on screen (the attention check's row is not among them). "
      + "longest_run_of_the_same_answer: e.g. 8 for 5,5,5,5,5,5,5,5. share_of_steps_of_exactly_one: how often the next "
      + "answer was one more or one less than the last, 1.0 for a diagonal like 1,2,3,4,5,6,7,6,5. Saved for the "
      + "analysis only (the researcher's Q4); never used for credit or pay. Any cut-off must be fixed before "
      + "the data is opened.",
  };
}
