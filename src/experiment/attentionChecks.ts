/**
 * attentionChecks.ts — three very simple attention checks (since 29 September 2026; the two in the study revised on
 * 30 September 2026).
 *
 * THE RESEARCHER'S REQUEST. Simple attention checks during the study, plus a feedback row, "This question is just to
 * check your attention. Pick the number four." (the number only two, three, four or five, at a random place among the
 * design or learning-insight questions, never among the CVR or APA questions); all of them answered as asked is needed
 * for compensation, among the other rules. Plan answers of 29 September: Q2 yes (the consent page says so), Q3 A (the
 * gift card only; all completed sessions are analysed), Q4 yes (two answer-pattern flags, for analysis only).
 *
 * REVISED 30 SEPTEMBER 2026 (the researcher: a colour question is unfair to colour-blind people, and "tap the letter K"
 * shows that somebody is there, not that they read). The colour and letter checks became ONE question each about what
 * the participant has just finished, in the words the researcher approved (#3 and #6 of the eight drafted; "I approve
 * these only ... so I will have three attention check questions"):
 *   after_block3     its own short screen right after Block 3 (the AI workforce), before Block 4
 *   after_scenario3  its own short screen right after scenario 3 (the cancer treatment), before scenario 4
 *   number           one rating row in the feedback, as before (random place, random number)
 * Each topic question asks only the part's MAIN TOPIC and offers four answers: the right one and three from outside the
 * study, all written the same way, in a random order per participant. Because each question is about one part, its
 * place is fixed. Any pick continues, and nobody is told whether they were right: telling them would teach them to
 * watch for checks. Words only, so it is fair to colour-blind people.
 *
 * THE PLAN IS DRAWN ONCE AND SAVED. The first read makes it from a hash of the participant's session id and email (the
 * answer orders and the feedback row's number and place) and saves it in `vrds_attention_checks`, which travels between
 * browsers (RESUME_FILES). So a refresh, or another device, shows the same check the same way, and an answered check is
 * never asked again. A file made for another email, or under an older version, is replaced.
 *
 * THE PROLIFIC DOOR (since 7 October 2026; the researcher's "3-B", Step 3 of docs/PROLIFIC_CONVERSION_PLAN.md, 4.E).
 * Prolific accepts only INSTRUCTION checks ("pick the number four") as reasons to reject, and only after a person fails
 * TWO of them; a question about what was just finished is memory, which Prolific does not accept. So a Prolific
 * participant gets a SECOND number row: the first ("number") always in "The tools & the experiment design", the second
 * ("number_2") always in "How this experience was for you", each at its own random place and with its own number two to
 * five (never the same number twice, so one answer given everywhere cannot pass both). The two topic questions stay, are
 * saved, and never count for Prolific's rule. Failing BOTH number rows is the "look first" flag
 * (`failed_both_instruction_checks`); Step 4 turns it into the completion path. The university door keeps exactly
 * today's three checks, places and gift-card rule: its plan is drawn exactly as before (no `door`, no `number_2`), and a
 * file saved under the version before this one is still read as a university plan (`STILL_READ_VERSIONS`), so nobody in
 * the middle of a run loses an answered check.
 *
 * WHAT IT FEEDS. `analysis.attention_checks` (every check, what was asked, the answer order, the answer, right or
 * wrong), `quality.passed_all_attention_checks` (the gift card needs all three, with a reason per miss) and a copy in
 * `major_info_and_scores`. The feedback check's answer is kept HERE, never in the feedback record, so it cannot move a
 * well-being score, a tool rating or the "same answer to every rating" flag. `analysis.feedback_answer_patterns` (Q4) is
 * built from the feedback record and is never used for pay. Checked by `npm run validate:attention`.
 */

import { keyDoor, keyOfDemographics, type RecruitmentSource } from "./recruitment";
import { SESSION_ID_KEY } from "./session";
import {
  APA_QUESTIONS, CVR_QUESTIONS, DUAL_VIEW_QUESTIONS, TOOL_CLOSERS, TOOL_RATINGS, WELLBEING_ITEMS,
  WELLBEING_PART_A_SUBSCALES,
} from "./feedbackTypes";

export const ATTENTION_KEY = "vrds_attention_checks";
/** Move whenever the checks, their places or their scoring change; stamped on every saved file. A file under another
 *  version is drawn again (no real data existed when it moved). */
export const ATTENTION_VERSION = "2026-10-07-two-doors";
/** Older versions whose files are still read as they are: the university plan of 30 September 2026 is exactly
 *  today's university plan, so a run that began before the Prolific door must keep its answered checks. */
export const STILL_READ_VERSIONS: readonly string[] = ["2026-09-30-topics"];
/** The flow stage of the Block 3 check's own screen. Not a block: never timed, never called rushed. */
export const ATTENTION_STAGE = "attention_check";
/** The feedback page's answer code for the number check. Not a feedback question: never in the feedback record. */
export const ATTENTION_FEEDBACK_CODE = "ATTN_number";
/** The second number row's answer code (the Prolific door only, since 7 October 2026). Never in the feedback record. */
export const ATTENTION_FEEDBACK_CODE_2 = "ATTN_number_2";

export type TopicCheckId = "after_block3" | "after_scenario3";
export type NumberCheckId = "number" | "number_2";
export type AttentionCheckId = TopicCheckId | NumberCheckId;
/** The university door's three checks (unchanged). */
export const ATTENTION_CHECK_IDS: AttentionCheckId[] = ["after_block3", "after_scenario3", "number"];
/** The Prolific door's four: the same three, and the second number row. */
export const PROLIFIC_ATTENTION_CHECK_IDS: AttentionCheckId[] = ["after_block3", "after_scenario3", "number", "number_2"];
/** The checks Prolific accepts as reasons to reject (instruction checks), in the Prolific door. */
export const INSTRUCTION_CHECK_IDS: NumberCheckId[] = ["number", "number_2"];

/** After how many finished scenarios the scenario check appears (then scenario 4 opens). */
export const SCENARIO_CHECK_AFTER = 3;

/**
 * The two topic questions, word for word as the researcher approved them on 30 September 2026 (#3 and #6). Do not
 * edit a word without the researcher: validate:attention holds them to this text.
 */
export const TOPIC_CHECKS: Record<TopicCheckId, { question: string; right: string; wrong: [string, string, string]; where: string }> = {
  after_block3: {
    question: "What was the part you just finished about?",
    right: "Deciding whether to approve an AI system that affects workers' jobs",
    wrong: [
      "Deciding whether to repaint a school's classrooms",
      "Deciding which player should captain a team",
      "Deciding where to put a new flower garden",
    ],
    where: "its own screen right after the AI-workforce part (Block 3), before Block 4",
  },
  after_scenario3: {
    question: "What was the scenario you just finished about?",
    right: "Sharing out a limited cancer treatment",
    wrong: [
      "Sharing out prizes at a school quiz",
      "Sharing out rooms in a holiday house",
      "Sharing out plots in a community garden",
    ],
    where: "its own screen right after scenario 3 (the cancer treatment), before scenario 4",
  },
};

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
/** The Prolific door's places: the first row in the tools section, the second in the well-being section. */
export const TOOLS_SLOTS = NUMBER_SLOTS.filter((s) => s.list === "tools");
export const WELLBEING_SLOTS = NUMBER_SLOTS.filter((s) => s.list !== "tools");

export interface NumberRow { list: NumberList; after: number; target: number; word: string }

export interface AttentionPlan {
  /** Which door the plan was drawn for; absent = the university door (every plan drawn before 7 October 2026). */
  door?: RecruitmentSource;
  /** The four answers of each topic question, in the order this participant sees them. */
  after_block3: { options: string[] };
  after_scenario3: { options: string[] };
  number: NumberRow;
  /** The second number row: the Prolific door only. */
  number_2?: NumberRow;
}

/** A plan's door. */
export const planDoor = (plan: AttentionPlan): RecruitmentSource => (plan.door === "prolific" ? "prolific" : "university");
/** The checks a plan asks: three in the university door, four in the Prolific door. */
export const checksOf = (plan: AttentionPlan): AttentionCheckId[] =>
  planDoor(plan) === "prolific" ? PROLIFIC_ATTENTION_CHECK_IDS : ATTENTION_CHECK_IDS;
/** The number rows a plan puts in the feedback, with their answer codes, in page order. */
export function numberRowsOf(plan: AttentionPlan): { check: NumberCheckId; code: string; row: NumberRow }[] {
  return [
    { check: "number" as const, code: ATTENTION_FEEDBACK_CODE, row: plan.number },
    ...(planDoor(plan) === "prolific" && plan.number_2 ? [{ check: "number_2" as const, code: ATTENTION_FEEDBACK_CODE_2, row: plan.number_2 }] : []),
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
  /** The email it was made for, lower case ("" when the study runs without one). */
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

const answersOf = (id: TopicCheckId) => [TOPIC_CHECKS[id].right, ...TOPIC_CHECKS[id].wrong];

/**
 * The whole plan from one seed: pure, so the checks can hold it to its rules over thousands of seeds. The university
 * door's plan is drawn exactly as it was before the Prolific door existed (the same seed gives the same plan).
 */
export function planAttentionChecks(seed: string, door: RecruitmentSource = "university"): AttentionPlan {
  const topics = {
    after_block3: { options: shuffled(answersOf("after_block3"), seed, "block3-order") },
    after_scenario3: { options: shuffled(answersOf("after_scenario3"), seed, "scenario3-order") },
  };
  const target = pick(NUMBER_TARGETS, seed, "number");
  if (door !== "prolific") {
    const slot = pick(NUMBER_SLOTS, seed, "number-place");
    return { ...topics, number: { list: slot.list, after: slot.after, target, word: NUMBER_WORDS[target] } };
  }
  /* The Prolific door: one row in each section, two different numbers. */
  const first = pick(TOOLS_SLOTS, seed, "number-place-tools");
  const second = pick(WELLBEING_SLOTS, seed, "number-2-place");
  const target2 = pick(NUMBER_TARGETS.filter((n) => n !== target), seed, "number-2");
  return {
    door: "prolific",
    ...topics,
    number: { list: first.list, after: first.after, target, word: NUMBER_WORDS[target] },
    number_2: { list: second.list, after: second.after, target: target2, word: NUMBER_WORDS[target2] },
  };
}

/** The participant this browser is working for: the email the flow keeps (the same one it saves under). */
function currentOwner(): string {
  try {
    const pending = localStorage.getItem("vrds_pending_email");
    if (pending) return pending.trim().toLowerCase();
    /* The demographic record names the key as `email`, or as `prolificPid` in the Prolific door (since 6 October 2026). */
    return String(keyOfDemographics(JSON.parse(localStorage.getItem("vrds_demographics") ?? "null")) ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function isFile(value: unknown): value is AttentionFile {
  const f = value as AttentionFile | null;
  if (!f || typeof f !== "object") return false;
  /* An older version is read only as the university plan it was (no door, no second row). */
  const versionOk = f.version === ATTENTION_VERSION || (STILL_READ_VERSIONS.includes(f.version) && f.plan?.door === undefined && !f.plan?.number_2);
  return versionOk
    && Array.isArray(f.plan?.after_block3?.options) && Array.isArray(f.plan?.after_scenario3?.options) && !!f.plan?.number
    && (planDoor(f.plan) !== "prolific" || !!f.plan?.number_2)
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
    /* The owner's key decides the door; a file drawn for the other door is drawn again. */
    if (isFile(saved) && saved.owner === owner && planDoor(saved.plan) === keyDoor(owner)) return saved;
  } catch { /* unreadable: made again below */ }
  let session = "";
  try { session = localStorage.getItem(SESSION_ID_KEY) ?? ""; } catch { /* ignore */ }
  const file: AttentionFile = {
    version: ATTENTION_VERSION, owner, plan: planAttentionChecks(`${session}|${owner}`, keyDoor(owner)), answers: {},
  };
  try { localStorage.setItem(ATTENTION_KEY, JSON.stringify(file)); } catch { /* the run goes on */ }
  return file;
}

export function isAttentionAnswered(id: AttentionCheckId): boolean {
  return !!readAttention().answers[id];
}

/** The answer that counts as right for each check. */
export function attentionTarget(plan: AttentionPlan, id: AttentionCheckId): string | number {
  if (id === "number") return plan.number.target;
  if (id === "number_2") return plan.number_2?.target ?? NaN;
  return TOPIC_CHECKS[id].right;
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
  door: RecruitmentSource;
  /** How many checks this door asks (three, or four in the Prolific door). */
  asked: number;
  passedAll: boolean;
  passedCount: number;
  answeredCount: number;
  /** One sentence per check that was missed or never answered, for the pay reasons. */
  misses: string[];
  /** Prolific's rule (the Prolific door only; null in the university door): the two number rows. */
  instruction: { answered: number; failed: number; failedBoth: boolean } | null;
}

const CHECK_WORDS: Record<AttentionCheckId, string> = {
  after_block3: "the check after Block 3",
  after_scenario3: "the check after scenario 3",
  number: "the feedback check",
  number_2: "the second feedback check",
};
/** In the Prolific door the two number rows are named by their order. */
const checkWords = (plan: AttentionPlan, id: AttentionCheckId): string =>
  id === "number" && planDoor(plan) === "prolific" ? "the first feedback check" : CHECK_WORDS[id];

/** What the check asked, in words, for the database and the pay reasons. */
function asked(plan: AttentionPlan, id: AttentionCheckId): string {
  if (id === "number") return `pick the number ${plan.number.word}`;
  if (id === "number_2") return `pick the number ${plan.number_2?.word ?? "?"}`;
  return TOPIC_CHECKS[id].question;
}

/** The verdict over every check the door asks. A check never reached counts as not passed. */
export function scoreAttention(raw: unknown): AttentionScore | null {
  if (!isFile(raw)) return null;
  const misses: string[] = [];
  let passed = 0;
  let answered = 0;
  const ids = checksOf(raw.plan);
  for (const id of ids) {
    const a = raw.answers[id];
    if (!a) {
      misses.push(`did not answer ${CHECK_WORDS[id]}`);
      continue;
    }
    answered += 1;
    const right = a.answer === attentionTarget(raw.plan, id);
    if (right) passed += 1;
    else misses.push(`missed ${checkWords(raw.plan, id)} (the right answer was "${attentionTarget(raw.plan, id)}", picked "${a.answer}")`);
  }
  const door = planDoor(raw.plan);
  /* Prolific's rule: only the number rows count, and a row "failed" is one ANSWERED wrongly (a row never reached is a
     person who did not finish, which Prolific handles on its own). */
  let instruction: AttentionScore["instruction"] = null;
  if (door === "prolific") {
    const rows = INSTRUCTION_CHECK_IDS.map((id) => raw.answers[id]
      ? { answered: true, wrong: raw.answers[id]!.answer !== attentionTarget(raw.plan, id) } : { answered: false, wrong: false });
    const failed = rows.filter((r) => r.wrong).length;
    instruction = { answered: rows.filter((r) => r.answered).length, failed, failedBoth: failed === INSTRUCTION_CHECK_IDS.length };
  }
  return { door, asked: ids.length, passedAll: passed === ids.length, passedCount: passed, answeredCount: answered, misses, instruction };
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
  const prolific = score.door === "prolific";
  return {
    version: raw.version,
    door: score.door,
    passed_all: score.passedAll,
    passed_count: score.passedCount,
    answered_count: score.answeredCount,
    checks_asked: score.asked,
    misses: score.misses,
    checks: [
      row("after_block3", TOPIC_CHECKS.after_block3.where, plan.after_block3.options),
      row("after_scenario3", TOPIC_CHECKS.after_scenario3.where, plan.after_scenario3.options),
      row("number", numberWhere(plan.number), [1, 2, 3, 4, 5, 6, 7]),
      ...(prolific && plan.number_2 ? [row("number_2", numberWhere(plan.number_2), [1, 2, 3, 4, 5, 6, 7])] : []),
    ],
    ...(prolific && score.instruction ? {
      prolific_rule: {
        instruction_checks: INSTRUCTION_CHECK_IDS.length,
        instruction_checks_answered: score.instruction.answered,
        instruction_checks_failed: score.instruction.failed,
        failed_both_instruction_checks: score.instruction.failedBoth,
        topic_checks_count_for_pay: false,
        how_to_read:
          "Prolific accepts only instruction checks as reasons to reject, and only after a person fails two of them. The "
          + "two 'Pick the number ...' rows are those checks (one in 'The tools & the experiment design', one in 'How this "
          + "experience was for you', two different numbers). failed_both_instruction_checks is the 'look first' flag; a "
          + "row never answered is not counted as failed. The two topic questions are memory checks, which Prolific does "
          + "not accept, so they are saved here and never count for pay.",
      },
    } : {}),
    how_to_read: prolific
      ? "The Prolific door (since 7 October 2026): the two topic questions (after Block 3 and after scenario 3) and two "
        + "'Pick the number ...' rows in the feedback. Only the number rows count for Prolific's rule (prolific_rule "
        + "above); passed_all says whether all four were right and is information only. Participants were never told "
        + "whether they were right."
      :
      "Three very simple checks: what the part just finished was about (right after Block 3, the AI workforce), what the "
      + "scenario just finished was about (right after scenario 3, the cancer treatment), each with four answers in a "
      + "random order, and 'Pick the number ...' on the 1-7 scale at a random place in the feedback. passed_all is what "
      + "the gift card needs (quality.passed_all_attention_checks); a check never reached counts as missed. Participants "
      + "were never told whether they were right. A miss affects the gift card only: all completed sessions are analysed "
      + "(the researcher, 30 September 2026).",
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
      + "analysis only (the researcher's Q4); never part of the gift-card verdict. Any cut-off must be fixed before "
      + "the data is opened.",
  };
}
