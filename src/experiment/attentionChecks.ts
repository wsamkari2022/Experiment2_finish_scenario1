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
 * WHAT IT FEEDS. `analysis.attention_checks` (every check, what was asked, the answer order, the answer, right or
 * wrong), `quality.passed_all_attention_checks` (the gift card needs all three, with a reason per miss) and a copy in
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
export const ATTENTION_VERSION = "2026-09-30-topics";
/** The flow stage of the Block 3 check's own screen. Not a block: never timed, never called rushed. */
export const ATTENTION_STAGE = "attention_check";
/** The feedback page's answer code for the number check. Not a feedback question: never in the feedback record. */
export const ATTENTION_FEEDBACK_CODE = "ATTN_number";

export type TopicCheckId = "after_block3" | "after_scenario3";
export type AttentionCheckId = TopicCheckId | "number";
export const ATTENTION_CHECK_IDS: AttentionCheckId[] = ["after_block3", "after_scenario3", "number"];

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

export interface AttentionPlan {
  /** The four answers of each topic question, in the order this participant sees them. */
  after_block3: { options: string[] };
  after_scenario3: { options: string[] };
  number: { list: NumberList; after: number; target: number; word: string };
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

/** The whole plan from one seed: pure, so the checks can hold it to its rules over thousands of seeds. */
export function planAttentionChecks(seed: string): AttentionPlan {
  const slot = pick(NUMBER_SLOTS, seed, "number-place");
  const target = pick(NUMBER_TARGETS, seed, "number");
  return {
    after_block3: { options: shuffled(answersOf("after_block3"), seed, "block3-order") },
    after_scenario3: { options: shuffled(answersOf("after_scenario3"), seed, "scenario3-order") },
    number: { list: slot.list, after: slot.after, target, word: NUMBER_WORDS[target] },
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
  return !!f && typeof f === "object" && f.version === ATTENTION_VERSION
    && Array.isArray(f.plan?.after_block3?.options) && Array.isArray(f.plan?.after_scenario3?.options) && !!f.plan?.number
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

/** The answer that counts as right for each check. */
export function attentionTarget(plan: AttentionPlan, id: AttentionCheckId): string | number {
  return id === "number" ? plan.number.target : TOPIC_CHECKS[id].right;
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
  passedAll: boolean;
  passedCount: number;
  answeredCount: number;
  /** One sentence per check that was missed or never answered, for the pay reasons. */
  misses: string[];
}

const CHECK_WORDS: Record<AttentionCheckId, string> = {
  after_block3: "the check after Block 3",
  after_scenario3: "the check after scenario 3",
  number: "the feedback check",
};

/** What the check asked, in words, for the database and the pay reasons. */
function asked(plan: AttentionPlan, id: AttentionCheckId): string {
  return id === "number" ? `pick the number ${plan.number.word}` : TOPIC_CHECKS[id].question;
}

/** The verdict over all three. A check never reached counts as not passed. */
export function scoreAttention(raw: unknown): AttentionScore | null {
  if (!isFile(raw)) return null;
  const misses: string[] = [];
  let passed = 0;
  let answered = 0;
  for (const id of ATTENTION_CHECK_IDS) {
    const a = raw.answers[id];
    if (!a) {
      misses.push(`did not answer ${CHECK_WORDS[id]}`);
      continue;
    }
    answered += 1;
    const right = a.answer === attentionTarget(raw.plan, id);
    if (right) passed += 1;
    else misses.push(`missed ${CHECK_WORDS[id]} (the right answer was "${attentionTarget(raw.plan, id)}", picked "${a.answer}")`);
  }
  return { passedAll: passed === ATTENTION_CHECK_IDS.length, passedCount: passed, answeredCount: answered, misses };
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
  return {
    version: raw.version,
    passed_all: score.passedAll,
    passed_count: score.passedCount,
    answered_count: score.answeredCount,
    checks_asked: ATTENTION_CHECK_IDS.length,
    misses: score.misses,
    checks: [
      row("after_block3", TOPIC_CHECKS.after_block3.where, plan.after_block3.options),
      row("after_scenario3", TOPIC_CHECKS.after_scenario3.where, plan.after_scenario3.options),
      row("number", `the feedback, in ${NUMBER_LIST_WORDS[plan.number.list]}, after rating row ${plan.number.after}`,
        [1, 2, 3, 4, 5, 6, 7]),
    ],
    how_to_read:
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
