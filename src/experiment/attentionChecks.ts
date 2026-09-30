/**
 * attentionChecks.ts — three very simple attention checks (since 29 September 2026).
 *
 * THE RESEARCHER'S REQUEST. "A very simple and obvious question that tests the user's attention to the color,
 * number or a letter during the experiment", and in the feedback "a question in between the design or learning
 * insight questions (not among the CVR or APA questions)": "This question is just to check your attention. Pick
 * the number four." Where it sits and what it asks for are random per participant (the number only two, three,
 * four or five), and "if the user answers all the attention check questions correctly, they will be qualified for
 * compensation among other existing criteria". Plan answers: Q1 any place but the two deleted between-block pages,
 * Q2 yes (the consent page says so), Q3 A (the gift card only; on 30 September 2026 the researcher confirmed that all
 * completed sessions are analysed), Q4 yes (two answer-pattern flags, for analysis only).
 *
 * THE THREE CHECKS, each drawn at random for each participant:
 *   colour  its own short screen after one of the four first parts (after Block 1, 2, 3 or 4)
 *   letter  its own short screen between two scenarios (after scenario 2, 3, 4 or 5)
 *   number  one rating row in the feedback, in "the tools & the experiment design" or "learning insight &
 *           well-being", never the first row of a section and never among the reflection (CVR) or clarification
 *           (APA) questions
 * The colour and the letter are one of four, shown as four buttons in a random order; each colour button carries
 * its name, so a colour-blind participant can pass by reading. Any pick continues, and nobody is told whether
 * they were right: telling them would teach them to watch for checks.
 *
 * THE PLAN IS DRAWN ONCE AND SAVED. The first read makes it from a hash of the participant's session id and
 * email, and saves it in `vrds_attention_checks`, which travels between browsers (RESUME_FILES). So a refresh, or
 * another device, shows the same check in the same place, and an answered check is never asked again. A file made
 * for another email is replaced, so a second person on the same computer gets their own checks.
 *
 * WHAT IT FEEDS. `analysis.attention_checks` (every check, what was asked, the button order, the answer, right or
 * wrong), `quality.passed_all_attention_checks` (the gift card needs all three, with a reason per miss) and a copy in
 * `major_info_and_scores`. The feedback check's answer is kept HERE, never in the feedback record, so it cannot move
 * a well-being score, a tool rating or the "same answer to every rating" flag. `analysis.feedback_answer_patterns`
 * (Q4) is built from the feedback record and is never used for pay. Checked by `npm run validate:attention`.
 */

import { SESSION_ID_KEY } from "./session";
import {
  APA_QUESTIONS, CVR_QUESTIONS, DUAL_VIEW_QUESTIONS, TOOL_CLOSERS, TOOL_RATINGS, WELLBEING_ITEMS,
  WELLBEING_PART_A_SUBSCALES,
} from "./feedbackTypes";

export const ATTENTION_KEY = "vrds_attention_checks";
/** Move whenever the checks, their places or their scoring change; stamped on every saved file. */
export const ATTENTION_VERSION = "2026-09-29-a";
/** The flow stage of the colour check's own screen. Not a block: never timed, never called rushed. */
export const ATTENTION_STAGE = "attention_check";
/** The feedback page's answer code for the number check. Not a feedback question: never in the feedback record. */
export const ATTENTION_FEEDBACK_CODE = "ATTN_number";

export type AttentionCheckId = "colour" | "letter" | "number";
export const ATTENTION_CHECK_IDS: AttentionCheckId[] = ["colour", "letter", "number"];

export const COLOURS = [
  { key: "orange", name: "Orange", swatch: "#f97316" },
  { key: "blue", name: "Blue", swatch: "#3b82f6" },
  { key: "green", name: "Green", swatch: "#22c55e" },
  { key: "purple", name: "Purple", swatch: "#a855f7" },
] as const;
export type ColourKey = (typeof COLOURS)[number]["key"];

/** Four letters that no font draws alike. */
export const LETTERS = ["K", "M", "R", "T"] as const;
export type Letter = (typeof LETTERS)[number];

export const NUMBER_TARGETS = [2, 3, 4, 5] as const;
export const NUMBER_WORDS: Record<number, string> = { 2: "two", 3: "three", 4: "four", 5: "five" };

/** After which first part the colour check appears. */
export const COLOUR_SLOTS = ["after_block1", "after_block2", "after_block3", "after_block4"] as const;
export type ColourSlot = (typeof COLOUR_SLOTS)[number];
export const COLOUR_SLOT_WORDS: Record<ColourSlot, string> = {
  after_block1: "after the found-money part (Block 1)",
  after_block2: "after the trolley part (Block 2)",
  after_block3: "after the AI-workforce part (Block 3)",
  after_block4: "after the reflection part (Block 4)",
};

/** After how many finished scenarios the letter check appears (then the next scenario opens). */
export const LETTER_SLOTS = [2, 3, 4, 5] as const;

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
  colour: { slot: ColourSlot; target: ColourKey; options: ColourKey[] };
  letter: { afterScenarios: number; target: Letter; options: Letter[] };
  number: { list: NumberList; after: number; target: number; word: string };
}

export interface AttentionAnswer {
  answer: string | number;
  correct: boolean;
  answeredAt: string;
  /** From the check appearing to Continue (colour, letter); null for the feedback row, which is not timed. */
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
 * without the mix, 4,000 pretend participants were only ever asked for two of the four colours, letters and
 * numbers (validate:attention T1 caught it). The mix is MurmurHash3's finaliser, which spreads every input bit
 * over every output bit.
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

/** The whole plan from one seed: pure, so the checks can hold it to its rules over thousands of seeds. */
export function planAttentionChecks(seed: string): AttentionPlan {
  const slot = pick(NUMBER_SLOTS, seed, "number-place");
  const target = pick(NUMBER_TARGETS, seed, "number");
  return {
    colour: {
      slot: pick(COLOUR_SLOTS, seed, "colour-place"),
      target: pick(COLOURS.map((c) => c.key), seed, "colour"),
      options: shuffled(COLOURS.map((c) => c.key), seed, "colour-order"),
    },
    letter: {
      afterScenarios: pick(LETTER_SLOTS, seed, "letter-place"),
      target: pick(LETTERS, seed, "letter"),
      options: shuffled(LETTERS, seed, "letter-order"),
    },
    number: { list: slot.list, after: slot.after, target, word: NUMBER_WORDS[target] },
  };
}

/** The participant this browser is working for: the email the flow keeps (the same one it saves under). */
function currentOwner(): string {
  try {
    const pending = localStorage.getItem("vrds_pending_email");
    if (pending) return pending.trim().toLowerCase();
    const demo = JSON.parse(localStorage.getItem("vrds_demographics") ?? "null") as { email?: string } | null;
    return String(demo?.email ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function isFile(value: unknown): value is AttentionFile {
  const f = value as AttentionFile | null;
  return !!f && typeof f === "object" && !!f.plan?.colour && !!f.plan?.letter && !!f.plan?.number
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

/** What each check asked for, as the answer that counts as right. */
export function attentionTarget(plan: AttentionPlan, id: AttentionCheckId): string | number {
  return id === "colour" ? plan.colour.target : id === "letter" ? plan.letter.target : plan.number.target;
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

function asked(plan: AttentionPlan, id: AttentionCheckId): string {
  if (id === "colour") return COLOURS.find((c) => c.key === plan.colour.target)?.name.toLowerCase() ?? plan.colour.target;
  if (id === "letter") return plan.letter.target;
  return plan.number.word;
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
      misses.push(`did not answer the ${id} check`);
      continue;
    }
    answered += 1;
    const right = a.answer === attentionTarget(raw.plan, id);
    if (right) passed += 1;
    else misses.push(`missed the ${id} check (asked for ${asked(raw.plan, id)}, picked ${a.answer})`);
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
      asked_for: asked(plan, id),
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
      row("colour", `its own screen ${COLOUR_SLOT_WORDS[plan.colour.slot]}`, plan.colour.options),
      row("letter", `its own screen after scenario ${plan.letter.afterScenarios}, before scenario ${plan.letter.afterScenarios + 1}`,
        plan.letter.options),
      row("number", `the feedback, in ${NUMBER_LIST_WORDS[plan.number.list]}, after rating row ${plan.number.after}`,
        [1, 2, 3, 4, 5, 6, 7]),
    ],
    how_to_read:
      "Three very simple checks, each drawn at random for this participant: tap a named colour (after one of the four "
      + "first parts), tap a letter (between two scenarios), and 'Pick the number ...' on the 1-7 scale in the feedback. "
      + "passed_all is what the gift card needs (quality.passed_all_attention_checks); a check never reached counts as "
      + "missed. Participants were never told whether they were right. A miss affects the gift card only: all completed "
      + "sessions are analysed (the researcher, 30 September 2026).",
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
