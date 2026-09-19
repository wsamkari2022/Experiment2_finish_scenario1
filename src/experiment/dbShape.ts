/**
 * dbShape.ts — the translator between how the study stores things and how the database reads.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * The blocks have their own names for things, chosen years of work ago and baked into working
 * code, validation suites and analysis helpers. Renaming them at the source would mean editing
 * the parts of the study that must not break, to satisfy a reader who is not the study.
 *
 * So the study keeps its own language, and everything is translated once, here, on the way into
 * MongoDB. Like a translator at an airport: the traveller speaks their own language, the form
 * gets filled in a language everyone reads.
 *
 * EVERY RENAME IN THE PROJECT IS ON THIS ONE SCREEN. That is the point. If a name in the database
 * looks wrong, this is the only file to open.
 *
 * ============================================================================
 * WHAT A PARTICIPANT DOCUMENT LOOKS LIKE AFTERWARDS
 * ============================================================================
 *   participant_id, email, age, gender, status, current_stage, consent, timestamps
 *   headline  { the few numbers an analyst actually asks for }
 *   blocks    { RAW answers only — what the person did }
 *   analysis  { COMPUTED results only — what the model made of it }
 *   timings   { how long each part took }
 *
 * The split between `blocks` and `analysis` is the important one. Raw answers can never be
 * recovered if lost; computed results can always be recalculated from them. Mixing the two in one
 * box is what makes a dataset hard to trust, because you cannot tell which is which.
 */

import { SESSION_KEY_RESULTS } from "./constants";
import { TROLLEY_RESULTS_STORAGE_KEY } from "./trolleyTypes";
import { AI_WORKFORCE_RESULTS_KEY } from "./aiWorkforceTypes";
import { BLOCK5_RESULTS_KEY } from "./block5Types";
import {
  FEEDBACK_KEY,
  APA_QUESTIONS,
  CVR_QUESTIONS,
  DUAL_VIEW_QUESTIONS,
  TOOL_CLOSERS,
  TOOL_RATINGS,
} from "./feedbackTypes";
import { TELEMETRY_KEY, UNTIMED_DISPLAY_STAGES } from "./telemetry";
import { PARTICIPANT_RECORD_KEY } from "./participantRecord";
import {
  analysePosition, positionEffectLabel, optionDistance, profileDistance, POSITION_LABEL,
} from "./block5Position";
import { ACTIVE_TIME_KEY } from "./activeTime";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { predictChoice, predictionConfidence, PREDICTION_VERSION } from "./block5Prediction";
import { ALIGNMENT_LABEL } from "./block5CVR";
import { analyseMirror, responsibilityGapLabel } from "./block5Mirror";
import { POLICY_DIM_KEYS, POLICY_DIM_SHORT } from "./block5Types";
import type {
  Block5PolicyDimKey,
  Block5Scenario,
  Block5ScenarioOption,
  Block5ScenarioResult,
  Block5UserProfile,
} from "./block5Types";

/**
 * Bump this whenever the SHAPE of the document changes — a field added, renamed, moved, or a
 * derived section introduced.
 *
 * WHY IT HAS TO EXIST
 * The sync only sends a source whose stored content has CHANGED, which is what keeps it cheap.
 * But a new derived section is not a change in any participant's answers: their Block 5 results
 * are byte-for-byte what they were, so nothing looks changed, so nothing is sent — and the new
 * field never appears for anybody who had already been synced.
 *
 * That is exactly what happened when position_effect was added: a completed participant kept the
 * old `block5_visualizations` and never received the new section, because their data had not
 * moved. Raising this version clears the fingerprints, so the next sync re-sends everything and
 * builds the new sections from data that was already there.
 */
export const SHAPE_VERSION = "2026-09-17-apa-single-question";

/* ------------------------------------------------------------------ where each source goes */

/**
 * One row per thing the study saves: where it is kept in the browser, and where it belongs in the
 * database document.
 *
 * `path` is a dotted location in the participant document. The first segment is the room
 * (`blocks`, `analysis`, or `timings`), which is what keeps raw answers and computed results
 * apart.
 */
export interface SourceMapping {
  /** The LocalStorage key the study already writes. Never changed. */
  key: string;
  /** Where it lands in MongoDB. */
  path: string;
  /** Optional clean-up applied on the way, for names that would mislead a reader. */
  transform?: (value: unknown) => unknown;
}

export const SOURCE_MAP: SourceMapping[] = [
  { key: SESSION_KEY_RESULTS, path: "blocks.block1_money" },
  { key: TROLLEY_RESULTS_STORAGE_KEY, path: "blocks.block2_trolley" },
  { key: AI_WORKFORCE_RESULTS_KEY, path: "blocks.block3_ai_workforce", transform: renameThresholdKeys },
  { key: "block4_reflection_results", path: "blocks.block4_stakeholder_reflection" },
  { key: BLOCK5_RESULTS_KEY, path: "blocks.block5_emergency_scenarios" },
  { key: FEEDBACK_KEY, path: "blocks.feedback_answers", transform: attachFeedbackQuestions },

  /* Computed, not answered. These used to sit in `blocks` beside the raw answers, which is what
     made the box a junk drawer. */
  { key: "moral_profile_insights", path: "analysis.post_block3_insights" },
  { key: "final_moral_analysis", path: "analysis.post_block4_final_analysis" },
  { key: PARTICIPANT_RECORD_KEY, path: "analysis.participant_record" },

  { key: TELEMETRY_KEY, path: "timings", transform: dropUntimedStages },
  /* Its own room, not inside `timings`: the whole `timings` object is written as one value, so a
     nested path would be wiped the next time the ledger above was sent. */
  { key: ACTIVE_TIME_KEY, path: "active_time", transform: summariseActiveTime },
];

/**
 * THE TWO READ-ONLY PAGES ARE REMOVED FROM EVERY PER-PAGE TIMING THE DATABASE HOLDS.
 *
 * On the researcher's instruction, 15 September 2026. `telemetry.ts` no longer records them at
 * all, so for a run started after that change there is nothing here to remove. This exists for the
 * runs that were already under way, and for a participant resumed from the server whose ledger was
 * written by the older build: their stored ledger still carries both stages, and without this the
 * two pages would keep appearing in the database for months.
 *
 * WHAT IS DELIBERATELY LEFT ALONE. `firstStartedAt` and `lastEventAt` are untouched, so the total
 * span of the run still covers the whole study including those pages. Removing a per-page number
 * is a decision about what is worth measuring; shortening somebody's total is a different decision
 * and was not the one taken.
 */
function dropUntimedStages(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const ledger = value as { stages?: Record<string, unknown> };
  if (!ledger.stages || typeof ledger.stages !== "object") return value;

  const stages: Record<string, unknown> = {};
  for (const [name, record] of Object.entries(ledger.stages)) {
    if ((UNTIMED_DISPLAY_STAGES as readonly string[]).includes(name)) continue;
    stages[name] = record;
  }
  return {
    ...ledger,
    stages,
    stages_not_timed: [...UNTIMED_DISPLAY_STAGES],
    stages_not_timed_note:
      "The insights page (after Block 3) and the final analysis page (after Block 4) are read, not "
      + "answered, so their durations are not measured and not stored. Time spent on them is still "
      + "inside the run's total span and still inside active_time.total_active_minutes.",
  };
}

/**
 * The active-time ledger, tidied for a reader.
 *
 * The stored version keeps milliseconds and raw timestamps because that is what arithmetic needs.
 * Nobody analyzing a dataset wants to divide by 60000 in their head, so the database gets minutes
 * and ISO dates, plus a sentence stating the counting rule — so a reader never has to guess
 * whether "42" meant minutes of work or minutes of having the tab open.
 *
 * THE PER-STAGE BREAKDOWN NO LONGER SUMS TO THE TOTAL, AND THAT IS STATED RATHER THAN LEFT TO BE
 * DISCOVERED. `by_stage_minutes` used to account for every counted minute, and an analyst could
 * rely on it. The two display pages are now dropped from it while the total still includes them,
 * so the two numbers disagree by exactly the time spent reading those pages. A discrepancy nobody
 * warned you about is how a dataset loses an analyst's trust, so the note below is not optional.
 */
function summariseActiveTime(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const l = value as {
    totalMs?: number; byStage?: Record<string, number>; sittings?: number;
    firstSeenAt?: number; lastActiveAt?: number; longestIdleMs?: number; stopped?: boolean;
  };
  const minutes = (ms: number | undefined) =>
    typeof ms === "number" ? Math.round((ms / 60000) * 10) / 10 : null;
  const byStage: Record<string, number> = {};
  for (const [stage, ms] of Object.entries(l.byStage ?? {})) {
    if ((UNTIMED_DISPLAY_STAGES as readonly string[]).includes(stage)) continue;
    byStage[stage] = Math.round((ms / 60000) * 10) / 10;
  }
  return {
    total_active_minutes: minutes(l.totalMs),
    by_stage_minutes: byStage,
    stages_left_out_of_the_breakdown: [...UNTIMED_DISPLAY_STAGES],
    breakdown_note:
      "by_stage_minutes does NOT sum to total_active_minutes. The insights page and the final "
      + "analysis page are read rather than answered, so they are no longer broken out; the minutes "
      + "spent on them are still inside total_active_minutes and still count toward compensation.",
    sittings: l.sittings ?? null,
    longest_idle_minutes: minutes(l.longestIdleMs),
    first_seen_at: l.firstSeenAt ? new Date(l.firstSeenAt).toISOString() : null,
    last_active_at: l.lastActiveAt ? new Date(l.lastActiveAt).toISOString() : null,
    clock_stopped: l.stopped === true,
    counting_rule:
      "Counts only while the tab was visible AND the participant had moved, typed, clicked or scrolled within the previous 90 seconds. Idle time is never included.",
  };
}

/* ------------------------------------------------------------- carrying a run to another machine */

/**
 * The browser files a half-finished participant needs in order to continue somewhere else.
 *
 * THE PROBLEM THIS SOLVES
 * The consent page promises that a participant may stop and come back. On the SAME browser that
 * works, because their answers are still in it. On a different computer it did not work at all:
 * the start screen recognized them and put them back on the stage they left, but nothing had put
 * their answers there, so Block 5 found no profile and the flow sent them to Block 1 to start
 * again. The promise was real; the software could not keep it.
 *
 * WHY THESE ARE RAW COPIES AND NOT THE TRANSLATED ONES
 * `blocks` already holds most of this, but translated for readability — threshold keys renamed,
 * feedback answers wrapped with their question text. Restoring from those would mean running
 * every translation backwards, and each reverse step is a chance to hand somebody a corrupted
 * version of their own answers. These are byte-for-byte what the browser wrote, so restoring is a
 * copy with no interpretation.
 *
 * WHY IT IS A SEPARATE FIELD THAT DELETES ITSELF
 * It is scaffolding, not data. It lives in `resume_state`, never in `blocks` or `analysis`, so it
 * cannot be mistaken for a measurement — and the server removes it the moment the participant
 * finishes, so a completed document is exactly as clean as it was before this existed.
 *
 * TWO OF THESE HAVE NEVER BEEN SAVED ANYWHERE
 * `experiment_flow_insights` is the file Blocks 4 and 5 actually read to continue — not to be
 * confused with `moral_profile_insights`, which has a similar name and is a different thing. And
 * the three `*_progress` files hold a half-finished block, so without them somebody who stopped
 * at scenario 3 of 5 would restart Block 5 from scenario 1.
 */
export const RESUME_FILES: string[] = [
  "experiment_flow_insights",
  "moral_profile_insights",
  "final_moral_analysis",
  SESSION_KEY_RESULTS,
  TROLLEY_RESULTS_STORAGE_KEY,
  AI_WORKFORCE_RESULTS_KEY,
  "block4_reflection_results",
  BLOCK5_RESULTS_KEY,
  /* half-finished blocks */
  "trolley_block_progress",
  "ai_workforce_block_progress",
  "block5_public_emergency_progress",
  /* so time already spent is not lost by moving machine */
  TELEMETRY_KEY,
  "vrds_active_time",
];

/** Reads every resume file present in this browser. Missing ones are simply left out. */
export function collectResumeFiles(): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  for (const key of RESUME_FILES) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      files[key] = JSON.parse(raw);
    } catch {
      /* Not JSON, or storage unavailable. Skipping one file is better than failing the sync. */
    }
  }
  return files;
}

/**
 * Writes downloaded files back into this browser, and reports how many landed.
 *
 * ONLY KEYS ON THE LIST ARE WRITTEN. The payload comes from the network, and writing arbitrary
 * keys from a network response into storage would let a bad or stale document overwrite anything
 * the app keeps — including the consent record and the participant directory.
 *
 * Existing values are NOT overwritten when the incoming file is missing, and the caller reloads
 * the page afterwards, because the app reads these files once at startup.
 */
export function restoreResumeFiles(files: unknown): number {
  if (!files || typeof files !== "object") return 0;
  let restored = 0;
  for (const [key, value] of Object.entries(files as Record<string, unknown>)) {
    if (!RESUME_FILES.includes(key)) continue;
    if (value === null || value === undefined) continue;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      restored += 1;
    } catch {
      /* Storage full or unavailable; the rest are still worth trying. */
    }
  }
  return restored;
}

/* ------------------------------------------------------------------------- the renames */

/**
 * "lowbuffer" and "highbuffer" describe a design this study no longer has.
 *
 * The keys read `threshold_lowbuffer_small` and so on. Nothing in the current experiment is a
 * buffer; the two conditions are an entry-level role and a senior-level one. A reader who meets
 * "buffer" has to guess, and will guess wrong — which is worse than a name that is merely ugly.
 *
 * The study keeps its own key names internally. Only the database copy is renamed.
 */
const THRESHOLD_RENAMES: [RegExp, string][] = [
  [/lowbuffer/g, "entry_level"],
  [/highbuffer/g, "senior_level"],
];

function renameThresholdKeys(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const thresholds = source.thresholds;
  if (!thresholds || typeof thresholds !== "object") return value;

  const renamed: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(thresholds as Record<string, unknown>)) {
    let name = key;
    for (const [pattern, replacement] of THRESHOLD_RENAMES) name = name.replace(pattern, replacement);
    renamed[name] = v;
  }
  return { ...source, thresholds: renamed };
}

/**
 * Feedback answers are stored under codes like `CVR_helped`. Nobody can read that.
 *
 * The full question is already written beside the code in feedbackTypes.ts, so the answer is
 * wrapped with the question it answers rather than a name being invented for it. Reword a
 * question and the database follows on its own, which a hand-written dictionary never would.
 *
 * The raw value is kept under `answer`, so anything that already reads these numbers still can.
 */
const QUESTION_TEXT: Record<string, { text: string; type: string }> = Object.fromEntries(
  [
    ...TOOL_RATINGS,
    ...TOOL_CLOSERS,
    ...CVR_QUESTIONS,
    ...DUAL_VIEW_QUESTIONS,
    ...APA_QUESTIONS,
  ].map((q) => [q.code, { text: q.text, type: q.type }]),
);

/** Plain-language description of what an answer means, so a reader never guesses a scale. */
function scaleFor(type: string): string {
  switch (type) {
    case "likert":
      return "1 to 7, where 1 = strongly disagree and 7 = strongly agree";
    case "yesno":
      return "true = yes, false = no";
    case "open":
      return "free text written by the participant";
    default:
      return type;
  }
}

function annotate(section: unknown): unknown {
  if (!section || typeof section !== "object") return section;
  const out: Record<string, unknown> = {};
  for (const [code, answer] of Object.entries(section as Record<string, unknown>)) {
    const q = QUESTION_TEXT[code];
    out[code] = q ? { question: q.text, answer, scale: scaleFor(q.type) } : answer;
  }
  return out;
}

function attachFeedbackQuestions(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const answers = record.feedback as Record<string, unknown> | undefined;
  if (!answers) return value;

  const annotated: Record<string, unknown> = {};
  for (const [section, content] of Object.entries(answers)) {
    /* wellbeing is already structured (items, subscales, a composite) rather than a flat list of
       coded questions, so it is passed through untouched. */
    annotated[section] = section === "wellbeing" ? content : annotate(content);
  }
  return { ...record, feedback: annotated };
}

/* ---------------------------------------------------------------------------- quality */

/** Below this, a block was not read. */
const RUSHED_BLOCK_SECONDS = 30;
/** Below this, a Block 5 scenario was not considered — six options and a trade-off in that time. */
const RUSHED_SCENARIO_SECONDS = 15;
/** The compensation bar, in minutes of genuine work. Stated on the consent page. */
export const REQUIRED_ACTIVE_MINUTES = 35;

/**
 * Straightlining: the same answer to every rating, all the way down.
 *
 * Somebody who answers 7, 7, 7, 7, 7 to twenty differently-worded questions — several of which
 * point in opposite directions — has not read them. It is the clearest single signal of a
 * participant who wanted the payment rather than the study, and it costs nothing to detect.
 *
 * Requires at least eight ratings before judging: a section with three questions can honestly be
 * answered identically by somebody who simply agrees with all three.
 */
function isStraightlined(feedbackRecord: unknown): boolean {
  if (!feedbackRecord || typeof feedbackRecord !== "object") return false;
  const answers = (feedbackRecord as { feedback?: Record<string, unknown> }).feedback;
  if (!answers) return false;

  const ratings: number[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "number") {
      ratings.push(value);
      return;
    }
    if (value && typeof value === "object") {
      for (const inner of Object.values(value as Record<string, unknown>)) walk(inner);
    }
  };
  walk(answers);

  if (ratings.length < 8) return false;
  return ratings.every((r) => r === ratings[0]);
}

/**
 * The signals that separate a genuine run from one done for the payment.
 *
 * TIME ALONE IS NOT ENOUGH, WHICH IS THE WHOLE POINT.
 * A participant can reach 35 active minutes by sitting on one page nudging the mouse. What that
 * cannot fake is the shape of the run: real engagement is spread across the blocks, and rushing
 * shows up as blocks finished in seconds. The previous study produced exactly that pattern — 35
 * minutes on one page and 2 seconds on the next — and a time check alone would have paid for it.
 *
 * EVERY RAW NUMBER IS KEPT, not just the verdict. The rule below is a starting point; six months
 * from now a different threshold can be applied to data already collected, which would be
 * impossible if only the true/false had been stored.
 */
export function buildQuality(
  activeLedger: unknown,
  block5: unknown,
  feedbackRecord: unknown,
  status: string,
): Record<string, unknown> | null {
  if (!activeLedger || typeof activeLedger !== "object") return null;
  const a = activeLedger as {
    totalMs?: number; byStage?: Record<string, number>; sittings?: number; longestIdleMs?: number;
  };

  /*
   * THE TWO DISPLAY PAGES ARE NOT ELIGIBLE TO BE CALLED RUSHED, and that is a correction as much as
   * a consequence of no longer timing them.
   *
   * `rushed_blocks` counts stages finished in under 30 seconds, and three of them costs a
   * participant their compensation. The insights page and the final analysis page are pages to
   * read: somebody who takes them in quickly has done nothing wrong, and every fast reader was
   * collecting two free strikes against a threshold of three.
   */
  const stageSeconds = Object.entries(a.byStage ?? {})
    .filter(([stage]) => !(UNTIMED_DISPLAY_STAGES as readonly string[]).includes(stage))
    .map(([stage, ms]) => ({
      stage,
      seconds: Math.round(ms / 1000),
    }));
  const rushedBlocks = stageSeconds.filter((s) => s.seconds < RUSHED_BLOCK_SECONDS);
  const fastest = stageSeconds.length
    ? stageSeconds.reduce((min, s) => (s.seconds < min.seconds ? s : min))
    : null;

  /* Block 5's per-scenario timer is wall-clock, not active time, so it OVER-states how long a
     scenario took. A scenario flagged as rushed by this measure was therefore rushed on the
     generous reading, which is the right direction for a flag that can cost somebody payment. */
  let rushedScenarios = 0;
  const results = (block5 as { scenarioResults?: { timeMs?: number }[] } | null)?.scenarioResults;
  if (Array.isArray(results)) {
    rushedScenarios = results.filter(
      (r) => typeof r.timeMs === "number" && r.timeMs < RUSHED_SCENARIO_SECONDS * 1000,
    ).length;
  }

  const activeMinutes = typeof a.totalMs === "number" ? Math.round((a.totalMs / 60000) * 10) / 10 : 0;
  const straightlined = isStraightlined(feedbackRecord);
  const completed = status === "Study Completed";

  return {
    active_minutes: activeMinutes,
    required_active_minutes: REQUIRED_ACTIVE_MINUTES,
    met_time_requirement: activeMinutes >= REQUIRED_ACTIVE_MINUTES,
    completed_the_study: completed,

    fastest_block: fastest,
    blocks_under_30_seconds: rushedBlocks.length,
    rushed_blocks: rushedBlocks,
    scenarios_under_15_seconds: rushedScenarios,

    sittings: a.sittings ?? 1,
    longest_idle_minutes:
      typeof a.longestIdleMs === "number" ? Math.round((a.longestIdleMs / 60000) * 10) / 10 : 0,

    straightlined_feedback: straightlined,

    /*
     * The verdict, and the reason. Storing WHY it failed matters as much as the answer: a
     * participant who queries their payment deserves a specific reason, and "eligible: false" on
     * its own cannot give one.
     */
    compensation_eligible:
      completed && activeMinutes >= REQUIRED_ACTIVE_MINUTES && !straightlined && rushedBlocks.length < 3,
    reasons: [
      ...(completed ? [] : ["did not finish the study"]),
      ...(activeMinutes >= REQUIRED_ACTIVE_MINUTES
        ? []
        : [`active time ${activeMinutes} min is under the ${REQUIRED_ACTIVE_MINUTES} min requirement`]),
      ...(straightlined ? ["gave the same answer to every feedback rating"] : []),
      ...(rushedBlocks.length >= 3 ? [`${rushedBlocks.length} blocks finished in under ${RUSHED_BLOCK_SECONDS}s`] : []),
    ],
    rule:
      "Eligible when the study was completed, active time met the requirement, the feedback was not straightlined, and fewer than 3 blocks were finished in under 30 seconds. Raw numbers above allow a different rule to be applied later.",
  };
}

/* --------------------------------------------------------------------------- the headline */

/**
 * The handful of numbers an analyst asks for first, lifted to the top of the document.
 *
 * They all exist already, buried: consistency is called `vci` three levels down inside the Block 5
 * results, and the position effect is not stored at all — the results page works it out and throws
 * it away. Neither is discoverable by somebody opening a document for the first time.
 *
 * Nothing here is a new measurement. It is the same numbers, put where they can be found, with
 * names that say what they are.
 */
/**
 * Runs the position analysis the results page runs, and survives a half-finished run.
 *
 * It needs both the scenario results and the profile the participant started with. A run that
 * stopped early has neither in a usable state, and that is not an error — it simply has no
 * position effect yet, so the fields come back null rather than the whole sync failing.
 */
function positionFor(b5: Record<string, unknown>) {
  try {
    const results = b5.scenarioResults;
    const before = b5.originalProfile;
    if (!Array.isArray(results) || results.length === 0 || !before) return null;
    const report = analysePosition(results as never, before as never);
    return {
      effect: report.effect,
      label: report.effect === null ? null : positionEffectLabel(report.effect),
      rows: report.rows,
      summaries: report.summaries,
      drift: report.drift,
      sentence: report.sentence,
    };
  } catch {
    return null;
  }
}

/** A value profile flattened to `{ value name: score }`, which is what an analyst wants. */
function flattenProfile(profile: unknown): Record<string, number> | null {
  if (!profile || typeof profile !== "object") return null;
  const dims = (profile as { dimensions?: unknown }).dimensions;
  if (!Array.isArray(dims)) return null;
  const out: Record<string, number> = {};
  for (const d of dims as { key?: string; score?: number }[]) {
    if (d?.key) out[d.key] = typeof d.score === "number" ? d.score : 0;
  }
  return out;
}

/**
 * The participant's values before Block 5, after it, and the movement between.
 *
 * Both profiles already exist inside the Block 5 results, under `originalProfile` and
 * `userProfile` — names that do not say which is which to somebody meeting them for the first
 * time, three levels down in a field they had no reason to open. The change is computed here
 * because it is the number the question "did Block 5 move this person?" actually asks for, and
 * working it out by hand means reading two nested objects and subtracting by eye.
 */
export function buildProfileChange(block5: unknown): Record<string, unknown> | null {
  if (!block5 || typeof block5 !== "object") return null;
  const b5 = block5 as Record<string, unknown>;
  const before = flattenProfile(b5.originalProfile);
  const after = flattenProfile(b5.userProfile);
  if (!before || !after) return null;

  const change: Record<string, number> = {};
  for (const key of Object.keys(before)) {
    if (typeof after[key] === "number") change[key] = Math.round((after[key] - before[key]) * 10) / 10;
  }
  return { before, after, change };
}

/**
 * How long the study actually took, in milliseconds.
 *
 * WHY THIS IS NOT SIMPLY `totalExperimentMs`
 * That field exists, but it is assembled into the FEEDBACK record at the very end — it is not
 * part of the raw timing ledger this function is handed, so reading it there always produced
 * null. The headline said "no total time" for every participant, which is how the bug hid.
 *
 * WHY THE SUM OF STAGES, AND NOT LAST-EVENT MINUS FIRST-EVENT
 * This study is explicitly allowed to be done across several sittings. Somebody who starts on
 * Monday and finishes on Wednesday has a wall-clock span of two days and perhaps forty minutes of
 * actual work. Subtracting the first timestamp from the last would report the two days. Summing
 * the time spent on each stage reports the forty minutes, which is the number anybody asking
 * "how long does this take?" means.
 *
 * SINCE 15 SEPTEMBER 2026 IT COVERS THE TIMED STAGES ONLY, AND THAT IS A REAL CHANGE TO THIS
 * NUMBER. The insights page and the final-analysis page are no longer recorded, so the minutes
 * spent reading them are no longer in this sum — measured at about 5 minutes on a typical run,
 * which is not a rounding error.
 *
 * IT WAS LEFT AS A SUM ANYWAY, and the reason is that the alternatives are worse. The span is wrong
 * for a study done across several days, which is the case this function exists to handle. Keeping a
 * hidden total that still included the two pages would mean storing their timing under another
 * name, which is the thing that was asked to stop. So the number narrowed and says so: the
 * companion field below states what it covers, and nothing that matters rests on it —
 * `active_time.total_active_minutes` is a separate ledger, still counts every page, and is what
 * compensation is judged on.
 */
function totalTimeMs(timings: unknown): number | null {
  if (!timings || typeof timings !== "object") return null;
  const t = timings as { totalExperimentMs?: number; stages?: Record<string, { durationMs?: number }> };
  if (typeof t.totalExperimentMs === "number") return t.totalExperimentMs;
  if (!t.stages || typeof t.stages !== "object") return null;
  let sum = 0;
  let seen = false;
  for (const stage of Object.values(t.stages)) {
    if (stage && typeof stage.durationMs === "number") {
      sum += stage.durationMs;
      seen = true;
    }
  }
  return seen ? sum : null;
}

/** One of the three sensitivity stabilities off the stored Block 5 results, or null. */
function sensitivityStabilityOf(
  b5: Record<string, unknown>,
  which: "directness" | "context" | "stakeholder",
): { value: number; level: string } | null {
  const all = b5.sensitivityStability as Record<string, { value?: unknown; level?: unknown } | null> | undefined;
  const one = all?.[which];
  return one && typeof one.value === "number" && typeof one.level === "string"
    ? { value: one.value, level: one.level }
    : null;
}

export function buildHeadline(block5: unknown, timings: unknown): Record<string, unknown> | null {
  if (!block5 || typeof block5 !== "object") return null;
  const b5 = block5 as Record<string, unknown>;

  const position = positionFor(b5);

  const totalMs = totalTimeMs(timings);

  return {
    /* "VCI" is the internal name. It measures how consistent the choices were, so that is what
       it is called here. The original field stays in blocks for anyone checking the maths. */
    consistency_score: b5.vci ?? null,
    consistency_label: b5.vciLevel ?? null,
    /* Stability is the four policy values only: swaps in their order at the conflict steps. */
    stability_score: b5.stability ?? null,
    stability_label: b5.stabilityLevel ?? null,
    /* The three sensitivities each have their own: how far each traveled on its 0-100 scale.
       Null for a run recorded before 19 September 2026, or when a snapshot is missing. */
    directness_stability_score: sensitivityStabilityOf(b5, "directness")?.value ?? null,
    directness_stability_label: sensitivityStabilityOf(b5, "directness")?.level ?? null,
    context_stability_score: sensitivityStabilityOf(b5, "context")?.value ?? null,
    context_stability_label: sensitivityStabilityOf(b5, "context")?.level ?? null,
    stakeholder_stability_score: sensitivityStabilityOf(b5, "stakeholder")?.value ?? null,
    stakeholder_stability_label: sensitivityStabilityOf(b5, "stakeholder")?.level ?? null,
    performance_score: b5.performance ?? null,
    performance_captured: b5.performanceCaptured ?? null,
    position_effect: position?.effect ?? null,
    position_effect_label: position?.label ?? null,
    scenarios_completed: Array.isArray(b5.scenarioResults) ? b5.scenarioResults.length : null,
    reflection_visits: b5.totalCvrVisits ?? null,
    adjustment_visits: b5.totalApaVisits ?? null,
    choice_switches: b5.totalSwitches ?? null,
    total_time_minutes: typeof totalMs === "number" ? Math.round(totalMs / 60000) : null,
    total_time_minutes_covers:
      "The sum of the TIMED stages. The insights page and the final analysis page are not timed "
      + "(see timings.stages_not_timed), so the minutes spent reading those are not in this number. "
      + "For total effort, and for anything about compensation, use active_time.total_active_minutes, "
      + "which is a separate ledger and still counts every page.",
  };
}

/**
 * The numbers behind the charts on the results page, saved instead of discarded.
 *
 * The page calculates these live and forgets them, which is why they cannot be found in the
 * database. An analyst who wants to know what a participant was SHOWN — as opposed to what can be
 * recomputed later from raw answers — has no way back to it otherwise.
 */
/**
 * Everything about position, in one section, in words a reader does not have to decode.
 *
 * WHY PER-SCENARIO ROWS ARE THE POINT
 * The overall effect is one number: the widest gap between any two positions. It answers "did
 * position matter?" and nothing else. The per-scenario rows answer the question an analyst
 * actually has — how far did THIS choice sit from the person they were before Block 5 — and they
 * were being discarded. analysePosition already computes them; only the saving was missing.
 *
 * DISTANCE VERSUS SHARE, AND WHY BOTH ARE KEPT
 * `distance_from_profile_before_block5` is the raw gap. `departure_share` is that gap as a
 * proportion of how far the six options in that scenario ALLOWED anyone to move. One scenario may
 * only permit a move of 10; another permits 60. A distance of 10 is everything in the first case
 * and almost nothing in the second, so the raw number alone is not comparable across scenarios.
 * The share is what the headline compares; the raw distance is kept so the share can be audited.
 */
/* ============================================================================================
 * BLOCK 5 — SHARED READERS
 *
 * Everything below rebuilds, at sync time, things the study computed live and discarded. All of it
 * reads `blocks.block5_emergency_scenarios` and the scenario definitions, and none of it can
 * change what a participant saw or what any score came out as: these functions run on the way into
 * the database, after every decision has been made and stored.
 * ============================================================================================ */

/** The scenario definition behind a stored result, or undefined for an id no longer in the deck. */
function scenarioOf(scenarioId: unknown): Block5Scenario | undefined {
  return BLOCK5_SCENARIOS.find((s) => s.id === scenarioId);
}

function optionOf(scenario: Block5Scenario | undefined, optionId: unknown): Block5ScenarioOption | undefined {
  return scenario?.options.find((o) => o.id === optionId);
}

/** The scenario results, if this run got far enough to have any. */
function resultsOf(block5: unknown): Block5ScenarioResult[] {
  if (!block5 || typeof block5 !== "object") return [];
  const rows = (block5 as { scenarioResults?: unknown }).scenarioResults;
  return Array.isArray(rows) ? (rows as Block5ScenarioResult[]) : [];
}

/**
 * A profile object built from four policy scores and nothing else.
 *
 * WHY A PARTIAL PROFILE IS THE HONEST ONE. `policySnapshotAfter` records the four policy values and
 * only those, so the other three sensitivities at that moment are not recoverable. Filling them
 * with 50 would invent a number and put it in a field an analyst would reasonably read as measured.
 *
 * IT IS SAFE FOR EXACTLY ONE PURPOSE. Everything downstream of this — `policyAlignmentShortfall`,
 * `predictChoice`, `profileDistance` — reads POLICY_DIM_KEYS and nothing else, so the missing three
 * are never consulted. Do not hand this object to anything that reads a wider profile.
 */
function policyProfile(scores: Record<string, number> | undefined | null): Block5UserProfile | null {
  if (!scores) return null;
  const dimensions = POLICY_DIM_KEYS.map((key, i) => ({
    key,
    label: POLICY_DIM_SHORT[key],
    score: typeof scores[key] === "number" ? scores[key] : 0,
    rank: i + 1,
    weight: 1 / POLICY_DIM_KEYS.length,
    sourceBlocks: [] as string[],
  }));
  const strongest = [...dimensions].sort((a, b) => b.score - a.score);
  return {
    generatedAt: "",
    dimensions,
    topThreeKeys: strongest.slice(0, 3).map((d) => d.key),
    topSensitivityKey: strongest[0]?.key ?? POLICY_DIM_KEYS[0],
  };
}

/** The four policy values pulled out of a full profile. */
function policyScoresOfProfile(profile: unknown): Record<string, number> | null {
  if (!profile || typeof profile !== "object") return null;
  const dims = (profile as { dimensions?: unknown }).dimensions;
  if (!Array.isArray(dims)) return null;
  const out: Record<string, number> = {};
  for (const k of POLICY_DIM_KEYS) {
    const found = (dims as { key?: string; score?: number }[]).find((d) => d?.key === k);
    out[k] = typeof found?.score === "number" ? found.score : 0;
  }
  return out;
}

/**
 * The participant's values AS THEY STOOD WHEN SCENARIO `index` OPENED.
 *
 * Scenario 1 opens on the frozen pre-Block-5 profile. Every later scenario opens on whatever the
 * one before it left behind, which is exactly what `policySnapshotAfter` records. This is the
 * profile the study itself was using at that moment, so a prediction built from it is a prediction
 * the model could genuinely have made at the time rather than one made with hindsight.
 */
/**
 * IT REPORTS WHICH PROFILE IT USED, and that is the whole reason this returns an object.
 *
 * An earlier version returned the profile alone and fell back to the frozen one when a snapshot was
 * missing — while the row it fed still printed "the participant's four values after scenario 2".
 * The number would have been the pre-Block-5 profile and the sentence beside it would have been
 * false, which is worse than a missing row: a reader has no way to notice.
 *
 * A snapshot CAN be missing. `policySnapshotAfter` is optional on the stored type, records written
 * before it existed do not carry it, and a run restored from the server carries whatever was saved.
 */
function profileWhenScenarioOpened(
  index: number,
  results: Block5ScenarioResult[],
  originalProfile: unknown,
): { profile: Block5UserProfile | null; usedFrozen: boolean; snapshotWasMissing: boolean } {
  const frozen = policyProfile(policyScoresOfProfile(originalProfile));
  if (index <= 0) return { profile: frozen, usedFrozen: true, snapshotWasMissing: false };

  const previous = policyProfile(results[index - 1]?.policySnapshotAfter as Record<string, number> | undefined);
  if (previous) return { profile: previous, usedFrozen: false, snapshotWasMissing: false };
  return { profile: frozen, usedFrozen: true, snapshotWasMissing: true };
}

/** The seven kinds of scenario-6 moment that survive into the database. See `what_they_did`. */
const DECISION_EVENTS = [
  "selected", "guess_shown", "answered_sounds_like", "answered_surprised",
  "kept_answer", "changed_answer", "committed",
];

const pct1 = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n * 1000) / 10 : null;
const round1 = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n * 10) / 10 : null;

/* ------------------------------------------------------- lifting scenarios 5 and 6 into `blocks` */

/**
 * SCENARIOS 5 AND 6, COPIED TO THE TOP OF `blocks` WHERE THEY CAN BE FOUND.
 *
 * WHY THESE TWO AND NOT THE OTHER FOUR. Scenarios 1 to 4 are the same kind of thing as each other —
 * a decision, scored, contributing to every headline — and reading them as an array is the right
 * way to read them. These two are not:
 *
 *   Scenario 5 is a WISH. The participant has no say; they say what they would want. It is excluded
 *              from consistency, stability and both reflection measures, and included in the
 *              position effect. An analyst who averages it in with the decisions has made a real
 *              mistake, and finding it as `scenarioResults[4]` gives no warning that it is one.
 *   Scenario 6 is a TEST OF THE MODEL. It never updates the profile and enters no score at all.
 *
 * THIS IS A COPY, AND THE COPY SAYS SO. The array remains the one true record; these are the same
 * bytes under a name that can be found. `this_is_a_copy_of` is on both, because two fields holding
 * the same numbers is exactly how somebody ends up correlating a column with itself.
 */
function liftedScenario(
  results: Block5ScenarioResult[],
  role: "recipient" | "predicted",
  whatThisIs: string,
): Record<string, unknown> | null {
  const index = results.findIndex((r) => (r?.decisionRole ?? "decider") === role);
  if (index < 0) return null;
  const row = results[index];
  const scenario = scenarioOf(row.scenarioId);
  return {
    what_this_is: whatThisIs,
    this_is_a_copy_of: `blocks.block5_emergency_scenarios.scenarioResults[${index}]`,
    scenario_id: row.scenarioId ?? null,
    title: scenario?.title ?? null,
    order_shown: index + 1,
    position: scenario?.stakePosition ?? null,
    position_label: scenario?.stakePosition ? POSITION_LABEL[scenario.stakePosition] : null,
    decision_role: row.decisionRole ?? "decider",
    answer: row,
  };
}

export function buildLiftedScenarios(block5: unknown): {
  scenario5: Record<string, unknown> | null;
  scenario6: Record<string, unknown> | null;
} {
  const results = resultsOf(block5);
  return {
    scenario5: liftedScenario(
      results,
      "recipient",
      "Scenario 5 — the same workplace cut as scenario 4, decided by somebody else. The participant "
      + "is on the receiving end and has no say, so this is a WISH rather than a decision. It is "
      + "excluded from consistency (VCI), stability and both reflection measures, and it IS included "
      + "in the position effect, where the distance arithmetic is the same for a wish as for a choice.",
    ),
    scenario6: liftedScenario(
      results,
      "predicted",
      "Scenario 6 — the Veil of Ignorance. The participant writes a rule without knowing which "
      + "person in the situation they will be, and is then shown what the Moral Prediction Function "
      + "expected. It is a test OF the model: it never updates the value profile and contributes to "
      + "no score, including the position effect. The prediction itself is in analysis.scenario6_mpf_test.",
    ),
  };
}

/* ----------------------------------------------------------------------- alignment records */

/**
 * EVERY ALIGNMENT FACT ABOUT EVERY SCENARIO, IN ONE TABLE.
 *
 * WHAT WAS WRONG WITH WHERE THESE LIVED. The alignment label, the fit score, whether CVR fired and
 * what the participant said to it, and whether APA ran and what they clarified are four different
 * answers to one question — "how did this choice sit against their own values, and what happened
 * when it did not?" — and they were four scattered fields on a scenario row, three of them
 * optional and one of them an enum nobody outside the code can read.
 *
 * THE LABEL IS RANK-BASED, WHICH IS THE SINGLE MOST MISREAD THING IN THIS STUDY. "Aligned" does not
 * mean the option met the participant's values; it means it was the BEST FIT AVAILABLE in that
 * scenario. Every scenario therefore produces exactly one Aligned option no matter how badly its
 * whole menu fits, so counting Aligned choices across scenarios measures how often somebody took
 * the top of the menu, never how well the menu suited them. The note travels in the record.
 *
 * `alignment_score_0_to_100` FLOORS AT ZERO and is not an interval measure at the bottom. Two
 * options that missed by 104 and by 154 both read 0. Use it for reporting; for anything that
 * ranks or subtracts, the uncensored quantity is `matchShortfall` on the raw row.
 */
export function buildAlignmentRecords(block5: unknown): Record<string, unknown> | null {
  const results = resultsOf(block5);
  if (results.length === 0) return null;

  const byScenario = results.map((r, index) => {
    const scenario = scenarioOf(r.scenarioId);
    const chosen = optionOf(scenario, r.selectedOptionId);
    const role = r.decisionRole ?? "decider";
    const level = r.alignmentLevel ?? null;

    return {
      scenario_id: r.scenarioId ?? null,
      order_shown: index + 1,
      title: scenario?.title ?? null,
      position: scenario?.stakePosition ?? null,
      position_label: scenario?.stakePosition ? POSITION_LABEL[scenario.stakePosition] : null,
      decision_role: role,
      counts_towards_consistency_and_stability: role === "decider",

      chosen_option_id: r.selectedOptionId ?? null,
      chosen_option_title: chosen?.title ?? null,

      /* ---- alignment ---- */
      alignment_label: level ? ALIGNMENT_LABEL[level] : null,
      alignment_level: level,
      alignment_score_0_to_100: r.matchScore ?? null,
      alignment_rank_within_the_scenario: r.selectedRank ?? null,
      options_on_the_table: scenario?.options.length ?? null,
      alignment_score_of_every_option: r.fitScoresByOptionId ?? null,
      chose_the_best_fitting_option: r.selectedWasTopCandidate ?? null,
      /*
       * RENAMED FROM `matched_the_pre_block5_profile`, which promised more than it holds. It is not
       * "they chose what they would have chosen before"; it is the boolean the study calls
       * `alignedToOriginal` — the chosen option landed in the top TWO alignment tiers (Aligned or
       * Weakly aligned) when scored against the frozen pre-Block-5 profile. That is the quantity
       * Stability is built on, and the name now says which one it is.
       */
      choice_was_still_aligned_to_the_pre_block5_profile: r.alignedToOriginal ?? null,
      per_scenario_consistency_0_to_1: r.vciScore ?? null,

      /* ---- CVR: the reflection that fires on a misaligned choice ---- */
      cvr: {
        fired: r.cvrFired ?? false,
        endorsement_after_reflection: r.cvrEndorsement ?? null,
        value_the_option_undercut: r.cvrCoordinate?.violatedKey ?? null,
        value_the_option_undercut_label: r.cvrCoordinate?.violatedKey
          ? POLICY_DIM_SHORT[r.cvrCoordinate.violatedKey]
          : null,
        lens: r.cvrCoordinate?.framing ?? null,
        whose_view_was_shown: r.cvrCoordinate?.who ?? null,
        stakeholder_text_shown: r.cvrStakeholderShown ?? null,
        second_lens_was_generated: r.cvrAltViewGenerated ?? false,
        lens_shown_first: r.cvrFramingShownFirst ?? null,
        lens_the_participant_picked: r.cvrFramingSelected ?? null,
        what_picking_it_meant: r.cvrFramingSelectedRole ?? null,
        sensitivity_change_committed: r.cvrFramingAdjustment ?? null,
        choice_before_reflection: r.firstChoiceOptionId ?? null,
        choice_after_reflection: r.postCVRChoiceOptionId ?? null,
        changed_their_choice:
          r.firstChoiceOptionId && r.selectedOptionId
            ? r.firstChoiceOptionId !== r.selectedOptionId
            : null,
      },

      /* ---- APA: the clarification that follows when reflection did not settle it ---- */
      apa: r.apa
        ? {
            ran: true,
            /*
             * `what_they_said` IS GONE from this section as of 17 September 2026.
             *
             * It held the APA page's first question — "endorse" / "context" / "unsure" — and that
             * question was removed along with the two-way trade it rested on. See APARecord in
             * block5Types.ts for what it meant.
             *
             * RUNS COLLECTED BEFORE THAT DATE STILL HAVE THE FIELD, because this builder only writes
             * what it is given and older stored runs still carry the answer. Do not pool the two:
             * the profile arithmetic behind an APA commit is different on either side of the change,
             * so `value_they_prioritized` moves the profile by a different rule. `shape_version` on
             * the document is what tells the two apart.
             */
            confidence_1_to_5: r.apa.confidence,
            the_stakeholder_influenced_them: r.apa.stakeholderInfluenced,
            value_they_prioritized: r.apa.prioritizedValue,
            value_they_prioritized_label: POLICY_DIM_SHORT[r.apa.prioritizedValue],
            option_that_triggered_it: r.apa.originalOptionId,
          }
        : { ran: false },
    };
  });

  const scored = byScenario.filter((r) => r.counts_towards_consistency_and_stability);
  /* KEYED BY THE ENUM, NOT BY THE DISPLAY WORDS. "Weakly aligned" as a key means every query that
     touches this object has to quote a phrase with a space and a capital in it, and one day somebody
     will change the display wording and silently break those queries. The readable form is on every
     row as `alignment_label`. */
  const labelCounts: Record<string, number> = {};
  for (const r of scored) {
    if (r.alignment_level) labelCounts[r.alignment_level] = (labelCounts[r.alignment_level] ?? 0) + 1;
  }
  const scores = scored
    .map((r) => r.alignment_score_0_to_100)
    .filter((n): n is number => typeof n === "number");

  return {
    what_this_is:
      "One row per Block 5 scenario: how the chosen option sat against the participant's own four "
      + "values, and what happened in the reflection (CVR) and clarification (APA) steps that follow "
      + "a choice which did not fit. Assembled from blocks.block5_emergency_scenarios; nothing here "
      + "is a new measurement.",
    read_this_before_using_the_label:
      "The alignment label is RANK-BASED, not absolute. The best-fitting option in a scenario is "
      + "labeled Aligned even when it fits the participant badly, and every scenario produces "
      + "exactly one. Counting Aligned choices measures how often somebody took the top of the menu, "
      + "not how well the menu suited them.",
    what_aligned_to_the_pre_block5_profile_means:
      "The chosen option scored in the top two alignment tiers (Aligned or Weakly aligned) against "
      + "the profile the participant entered Block 5 with. It is NOT a claim that they chose the same "
      + "option they would have chosen before. Stated once here rather than repeated on every row.",
    read_this_before_using_the_score:
      "alignment_score_0_to_100 floors at 0, so two options that missed by 104 and by 154 both read "
      + "0. It is safe to report and unsafe to rank or subtract with. The uncensored quantity is "
      + "matchShortfall on the raw scenario row.",
    by_scenario: byScenario,
    totals: {
      counted_over:
        "The scenarios that asked for a decision. The wish (scenario 5) and the prediction test "
        + "(scenario 6) are in by_scenario and excluded from these totals.",
      scenarios_counted: scored.length,
      alignment_level_counts: labelCounts,
      alignment_level_counts_note:
        "Keyed by the internal level (aligned / weakly_aligned / misaligned / strongly_misaligned) so "
        + "it can be queried without quoting display text. The display words are on every row.",
      mean_alignment_score: scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null,
      times_reflection_fired: scored.filter((r) => r.cvr.fired).length,
      times_clarification_ran: scored.filter((r) => r.apa.ran).length,
      times_they_changed_their_choice: scored.filter((r) => r.cvr.changed_their_choice === true).length,
    },
  };
}

/* --------------------------------------------- the prediction function, run on every scenario */

/**
 * WHAT THE MPF WOULD HAVE EXPECTED IN EVERY SCENARIO, NOT ONLY IN SCENARIO 6.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * ONLY SCENARIO 6's NUMBERS WERE EVER SHOWN TO ANYBODY. Scenarios 1 to 5 are computed here, after
 * the fact, from data the study had already stored. Nothing about the participant's run changes,
 * and no probability below was on screen while they were deciding. The row says which is which:
 * `was_shown_to_the_participant`.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * THE PROFILE USED IS THE ONE THE SCENARIO OPENED ON, never the end-of-block profile. Scenario 1
 * is predicted from the pre-Block-5 profile, scenario 2 from the profile scenario 1 left behind,
 * and so on. That makes each row a forecast the model could genuinely have made at the time rather
 * than a retrofit that already knows how the participant ended up.
 *
 * THE CONFIDENCE DIAL IS THE SAME FOR EVERY ROW, and that is a limitation worth stating. The
 * softmax temperature comes from VCI and Stability, and neither exists until Block 5 has finished —
 * there is no honest "VCI as it stood at scenario 2". Every row therefore uses the end-of-block
 * pair, which is also exactly what scenario 6's live prediction used. The consequence: scenarios 1
 * to 5 use one number from the participant's future. It affects only how SHARP the probabilities
 * are, never which option leads, because temperature is a single divisor applied to every option.
 *
 * `using_profile_before_block5` IS THE SECOND, SIMPLER PREDICTOR, kept because the two answer
 * different questions. The main columns ask "could the model have called this at the time?"; this
 * one asks "how much did the updating during Block 5 actually buy?" — a fixed predictor that never
 * learns, against the moving one.
 *
 * `self_check` IS NOT DECORATION. Scenario 6's probabilities are recomputed here by the same route
 * as the other five and compared with the ones actually shown and stored. They must match to a
 * tenth of a percentage point. If they ever stop matching, the recomputation has drifted from the
 * live path and every number in this section for every other scenario is suspect.
 */
export function buildMpfPredictions(block5: unknown): Record<string, unknown> | null {
  if (!block5 || typeof block5 !== "object") return null;
  const b5 = block5 as Record<string, unknown>;
  const results = resultsOf(block5);
  if (results.length === 0) return null;

  const vci = typeof b5.vci === "number" ? b5.vci : null;
  const stability = typeof b5.stability === "number" ? b5.stability : null;
  const confidence = predictionConfidence(vci, stability);

  let worstSelfCheckGap: number | null = null;

  const byScenario = results.map((r, index) => {
    const scenario = scenarioOf(r.scenarioId);
    const opened = profileWhenScenarioOpened(index, results, b5.originalProfile);
    const profileThen = opened.profile;
    if (!scenario || !profileThen) {
      return { scenario_id: r.scenarioId ?? null, order_shown: index + 1, could_not_be_computed: true };
    }

    const role = r.decisionRole ?? "decider";
    /* Present on scenario 6 only. Its existence is what makes a row a prediction the participant
       actually saw rather than one reconstructed here. */
    const live = r.predictionTest;
    const prediction = predictChoice(scenario.options, profileThen, { vci, stability });

    /* The choice BEFORE any reflection, which is the one a prediction is entitled to be judged on.
       Scenario 6 stores it separately because there the guess itself could have moved them. */
    const firstChoice = live?.firstChoiceOptionId
      ?? r.firstChoiceOptionId
      ?? r.selectedOptionId
      ?? null;
    const finalChoice = r.selectedOptionId ?? null;

    const byOption = [...prediction.options]
      .sort((a, b) => a.rank - b.rank)
      .map((o) => ({
        option_id: o.optionId,
        option_title: o.optionTitle,
        mpf_chance_percent: pct1(o.probability),
        rank: o.rank,
        fit_score_0_to_100: o.alignmentScore,
        built_on: o.builtOn,
        built_on_label: POLICY_DIM_SHORT[o.builtOn as Block5PolicyDimKey],
      }));

    const chanceOf = (id: string | null) =>
      pct1(prediction.options.find((o) => o.optionId === id)?.probability);
    const top = prediction.options.find((o) => o.rank === 1) ?? null;

    /* The fixed predictor: the same arithmetic, always from the profile they walked in with. */
    const frozen = policyProfile(policyScoresOfProfile(b5.originalProfile));
    const frozenPrediction = frozen ? predictChoice(scenario.options, frozen, { vci, stability }) : null;
    const frozenTop = frozenPrediction?.options.find((o) => o.rank === 1) ?? null;

    /* Scenario 6 only: does recomputing reproduce what was shown? */
    let selfCheck: Record<string, unknown> | null = null;
    if (live && Array.isArray(live.shownProbabilities)) {
      let worst = 0;
      for (const wasShown of live.shownProbabilities) {
        const here = prediction.options.find((o) => o.optionId === wasShown.optionId);
        const a = pct1(wasShown.probability);
        const b = pct1(here?.probability);
        if (a === null || b === null) { worst = 100; break; }
        worst = Math.max(worst, Math.abs(a - b));
      }
      worstSelfCheckGap = worstSelfCheckGap === null ? worst : Math.max(worstSelfCheckGap, worst);
      selfCheck = {
        recomputed_matches_what_was_shown: worst <= 0.1,
        largest_difference_in_percentage_points: Math.round(worst * 100) / 100,
      };
    }

    return {
      scenario_id: r.scenarioId ?? null,
      order_shown: index + 1,
      title: scenario.title,
      position: scenario.stakePosition ?? null,
      position_label: scenario.stakePosition ? POSITION_LABEL[scenario.stakePosition] : null,
      decision_role: role,
      was_shown_to_the_participant: Boolean(live),
      this_was_a_wish_not_a_decision: role === "recipient",

      options_on_the_table: scenario.options.length,
      chance_if_guessing_percent: Math.round((100 / scenario.options.length) * 10) / 10,

      /* The sentence describes the numbers actually used, including when a missing snapshot forced
         a fall back to the frozen profile. See profileWhenScenarioOpened. */
      profile_used: opened.snapshotWasMissing
        ? `the participant's four values as they entered Block 5 — the snapshot after scenario ${index} `
          + "is missing from this record, so the frozen profile was used instead"
        : index === 0
          ? "the participant's four values as they entered Block 5"
          : `the participant's four values after scenario ${index}`,
      profile_used_values: policyScoresOfProfile(profileThen),
      profile_snapshot_was_missing: opened.snapshotWasMissing,

      by_option: byOption,
      most_expected_option_id: top?.optionId ?? null,
      most_expected_option_chance_percent: pct1(top?.probability),
      gap_between_top_two: prediction.separation,
      how_sure_the_mpf_was: Math.round(prediction.confidence * 1000) / 1000,
      /* NOT ROUNDED. This is a reproducibility parameter, not a number to read: it is stored so the
         probabilities above can be recomputed exactly. Rounded to one decimal it was 33.8 against a
         true 33.75, and anyone recomputing from the stored value would get probabilities that
         disagreed with the stored ones in the third decimal. Small, and the wrong kind of small. */
      sharpness_setting: prediction.temperature,

      participant: {
        first_choice_option_id: firstChoice,
        mpf_chance_of_their_first_choice_percent: chanceOf(firstChoice),
        rank_the_mpf_gave_their_first_choice:
          prediction.options.find((o) => o.optionId === firstChoice)?.rank ?? null,
        mpf_named_their_first_choice: top ? top.optionId === firstChoice : null,
        final_choice_option_id: finalChoice,
        mpf_chance_of_their_final_choice_percent: chanceOf(finalChoice),
        mpf_named_their_final_choice: top ? top.optionId === finalChoice : null,
      },

      using_profile_before_block5: frozenPrediction
        ? {
            what_this_is:
              "The same arithmetic run from the profile the participant entered Block 5 with, "
              + "ignoring everything the block moved. A predictor that never learns.",
            most_expected_option_id: frozenTop?.optionId ?? null,
            mpf_chance_of_their_first_choice_percent:
              pct1(frozenPrediction.options.find((o) => o.optionId === firstChoice)?.probability),
            mpf_named_their_first_choice: frozenTop ? frozenTop.optionId === firstChoice : null,
          }
        : null,

      self_check: selfCheck,
    };
  });

  const decisions = byScenario.filter(
    (r) => r.decision_role === "decider" && !r.could_not_be_computed,
  ) as Record<string, unknown>[];
  const named = decisions.filter(
    (r) => (r.participant as Record<string, unknown>)?.mpf_named_their_first_choice === true,
  ).length;
  const chances = decisions
    .map((r) => (r.participant as Record<string, unknown>)?.mpf_chance_of_their_first_choice_percent)
    .filter((n): n is number => typeof n === "number");
  const baseline = decisions
    .map((r) => r.chance_if_guessing_percent)
    .filter((n): n is number => typeof n === "number");

  return {
    what_this_is:
      "The Moral Prediction Function run over every Block 5 scenario: the chance it gave each option, "
      + "and the chance it had given the option the participant actually took.",
    the_other_mpf_section:
      "analysis.scenario6_mpf_test holds the SAME scenario-6 prediction in more detail, together with "
      + "what the participant answered when they were shown it. It is the same numbers, not a second "
      + "measurement; `self_check` below proves the two agree.",
    read_this_first:
      "ONLY SCENARIO 6 WAS SHOWN TO THE PARTICIPANT. Every other row was computed afterward from "
      + "stored data and was never on screen while they decided. Check was_shown_to_the_participant "
      + "before describing any of this as a prediction the study made in advance.",
    rule_version: PREDICTION_VERSION,
    confidence_dial: {
      consistency_score: vci,
      stability_score: stability,
      confidence_0_to_1: Math.round(confidence * 1000) / 1000,
      how_it_works:
        "Confidence is the mean of VCI/100 and Stability/100, and it sets the softmax temperature "
        + "between 60 (flat) and 18 (sharp). Both inputs are end-of-block figures that do not exist "
        + "until Block 5 finishes, so every row uses the same pair — the same pair scenario 6's live "
        + "prediction used. Temperature changes how sharp the probabilities are, never which option "
        + "leads.",
    },
    by_scenario: byScenario,
    totals: {
      counted_over:
        "The scenarios that asked for a decision. The wish (scenario 5) and the prediction test "
        + "(scenario 6) are in by_scenario and excluded here.",
      scenarios_counted: decisions.length,
      times_the_mpf_named_their_first_choice: named,
      hit_rate_percent: decisions.length
        ? Math.round((named / decisions.length) * 1000) / 10
        : null,
      hit_rate_if_guessing_percent: baseline.length
        ? Math.round((baseline.reduce((a, b) => a + b, 0) / baseline.length) * 10) / 10
        : null,
      mean_chance_given_to_their_first_choice_percent: chances.length
        ? Math.round((chances.reduce((a, b) => a + b, 0) / chances.length) * 10) / 10
        : null,
      read_this_before_quoting_the_hit_rate:
        "With four decisions per participant, one person's hit rate is 0, 25, 50, 75 or 100 and "
        + "carries almost no information. Pool across participants before reading it, and report the "
        + "guessing baseline beside it every time.",
    },
    self_check: {
      what_this_is:
        "Scenario 6's probabilities recomputed by the route used for the other five, compared with "
        + "the ones actually shown and stored. They must agree to within 0.1 percentage points.",
      largest_difference_in_percentage_points:
        worstSelfCheckGap === null ? null : Math.round(worstSelfCheckGap * 100) / 100,
      passed: worstSelfCheckGap === null ? null : worstSelfCheckGap <= 0.1,
    },
  };
}

/**
 * SCENARIO 6, THE MPF PREDICTION TEST, LIFTED OUT AND WRITTEN IN PLAIN WORDS.
 *
 * WHY IT GETS ITS OWN SECTION. Buried where it is produced, this sits four levels down inside
 * `blocks.block5_emergency_scenarios.scenarioResults[5].predictionTest`, beside five scenarios that
 * measure something else entirely. An analyst opening the document would have to know it was there
 * to find it. It is also a different KIND of thing: the other five measure the participant, and
 * this one measures the model. Mixing the two in one box is how a junk drawer starts.
 *
 * WHY THE NAMES CHANGE HERE AND NOWHERE ELSE. This file is the one translator between the study's
 * internal names and the database's. `probabilityOfFirstChoice` is precise and unreadable; the
 * column is called `mpf_chance_of_your_pick` because six months from now that is the question being
 * asked of it.
 *
 * WHAT IS DELIBERATELY REPEATED. `chance_if_guessing` is 25% for a four-option scenario and is
 * written into every record rather than left to be remembered. A probability without its baseline
 * invites a reader to credit the model with more than it did, and a stored number that needs an
 * external fact to interpret is a number that will eventually be interpreted wrongly.
 */
export function buildScenario6Section(block5: unknown): Record<string, unknown> | null {
  if (!block5 || typeof block5 !== "object") return null;
  const results = (block5 as { scenarioResults?: unknown }).scenarioResults;
  if (!Array.isArray(results)) return null;

  const row = results.find(
    (r) => r && typeof r === "object" && (r as { predictionTest?: unknown }).predictionTest,
  ) as Record<string, unknown> | undefined;
  if (!row) return null;

  const p = row.predictionTest as Record<string, unknown>;
  const shown = Array.isArray(p.shownProbabilities) ? p.shownProbabilities : [];
  const pct = (n: unknown) => (typeof n === "number" ? Math.round(n * 1000) / 10 : null);

  /* How far the rule they settled on sat from the profile they entered Block 5 with. Computed here
     rather than in the position section, and the field below says why. */
  const frozen = policyProfile(policyScoresOfProfile((block5 as Record<string, unknown>).originalProfile));
  const veilOption = optionOf(scenarioOf(row.scenarioId), row.selectedOptionId);
  const veilDistance = frozen && veilOption ? profileDistance(frozen, veilOption) : null;

  /* The rule titles, so a reader of the record sees what was chosen without looking ids up. */
  const titleOfRule = (id: unknown): string | null =>
    (typeof id === "string" ? optionOf(scenarioOf(row.scenarioId), id)?.title : undefined) ?? null;
  const pressedChange = typeof p.pressedChangeAnswer === "boolean"
    ? p.pressedChangeAnswer
    : (Array.isArray(p.interactions) ? p.interactions : [])
        .some((e) => (e as Record<string, unknown>)?.what === "changed_answer");

  return {
    what_this_is:
      "Scenario 6 asks which principle the participant acts on when they do not know who they will "
      + "be. After they chose, the Moral Prediction Function (MPF) showed them what it had expected. "
      + "It is a test OF the model: it never updates the value profile and never enters VCI, "
      + "Stability, Performance or the position effect.",

    rule_version: p.version ?? null,
    scenario_id: row.scenarioId ?? null,
    the_other_mpf_section:
      "analysis.mpf_predictions_every_scenario runs the same rule over ALL six scenarios. Its "
      + "scenario-6 row is these same numbers, not a second measurement; only scenario 6 was ever "
      + "shown to anybody.",

    /* ---- what the MPF said, before the participant saw anything ---- */
    mpf_prediction: {
      chance_if_guessing_percent: shown.length ? Math.round((100 / shown.length) * 10) / 10 : null,
      by_rule: shown
        .map((o) => {
          const e = o as Record<string, unknown>;
          return {
            rule: e.optionId ?? null,
            mpf_chance_percent: pct(e.probability),
            rank: e.rank ?? null,
            fit_score_shown: e.alignmentScore ?? null,
          };
        })
        .sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99)),
      most_expected_rule: p.predictedTopOptionId ?? null,
      /* How far apart the top two were, on the uncensored fit. Near zero means the MPF had no real
         opinion, whatever the percentages looked like. */
      gap_between_top_two: p.separation ?? null,
      how_sure_the_mpf_was: p.confidence ?? null,
      sharpness_setting: p.temperature ?? null,
    },

    /* ---- what the participant did ---- */
    participant: {
      rule_chosen_before_seeing_the_guess: p.firstChoiceOptionId ?? null,
      rule_chosen_before_seeing_the_guess_title: titleOfRule(p.firstChoiceOptionId),
      rule_chosen_in_the_end: p.finalChoiceOptionId ?? null,
      rule_chosen_in_the_end_title: titleOfRule(p.finalChoiceOptionId),
      changed_after_seeing_the_guess: p.changedAfterSeeing ?? null,
      /* Pressing "Change my answer" is its own fact: a participant can press it and come back to the
         rule they first chose. Records made before 19 September 2026 carry no flag, so the log's
         "changed_answer" entry is read for those. */
      pressed_change_my_answer: pressedChange,
      what_happened_after_the_guess: p.changedAfterSeeing === true
        ? "changed to a different rule"
        : pressedChange
          ? "reconsidered, then came back to their first rule"
          : "kept their first rule",
      mpf_chance_of_their_final_choice_percent: pct(p.probabilityOfFinalChoice
        ?? (shown.find((o) => (o as Record<string, unknown>).optionId === p.finalChoiceOptionId) as
             Record<string, unknown> | undefined)?.probability),
      /* Same name as the identical quantity in analysis.mpf_predictions_every_scenario. It used to
         read `..._first_pick_percent` here and `..._first_choice_percent` there — one number under
         two names in adjacent sections, which is how a reader ends up believing they are two
         different measurements. */
      mpf_chance_of_their_first_choice_percent: pct(p.probabilityOfFirstChoice),
      mpf_guessed_right: p.predictionWasRight ?? null,
      does_this_sound_like_me_1_to_7: p.soundsLikeMe ?? null,
      were_you_surprised: p.surprised ?? null,
      seconds_looking_at_the_guess: p.secondsViewingPrediction ?? null,
    },

    /* The order the four rules appeared in, top to bottom. Shuffled per participant, so an order
       effect can only be checked because this column exists. */
    order_rules_were_shown_in: p.shownOrder ?? null,

    /* ---- how much they wavered, on each side of the guess ---- */
    wavering: {
      switches_before_the_guess: p.switchesBeforeGuess ?? null,
      switches_after_the_guess: p.switchesAfterGuess ?? null,
      rules_opened_before_the_guess: p.rulesOpenedBeforeGuess ?? null,
      rules_opened_after_the_guess: p.rulesOpenedAfterGuess ?? null,
    },

    /*
     * ---- the decisions, in order ----
     *
     * DECISIONS ONLY, ON THE RESEARCHER'S INSTRUCTION (15 September 2026). Seven kinds of moment
     * reach this list and every one of them is a choice, the guess arriving, or an answer: which
     * rule they opened and every time they switched, the moment the prediction appeared, the two
     * questions they answered, whether they kept or changed their mind, and the commit.
     *
     * Two kinds of event were removed and are no longer recorded anywhere: expanding a rule's
     * details, and backing out of the confirm view. Both were navigation rather than decision, and
     * the informative part of them — how many distinct rules were opened on each side of the guess
     * — is already in `wavering` above, counted independently of this list.
     *
     * THE FILTER IS HERE AS WELL AS AT THE SOURCE because a participant who started before the
     * change still has both kinds in their stored record, and the database should not carry them
     * for some people and not others.
     */
    what_they_did: Array.isArray(p.interactions)
      ? (p.interactions as Record<string, unknown>[])
          .filter((e) => DECISION_EVENTS.includes(String(e.what)))
          .map((e) => ({
            seconds_in: typeof e.atMs === "number" ? Math.round(e.atMs / 100) / 10 : null,
            what_happened: e.what ?? null,
            rule: e.optionId ?? null,
            answer: e.value ?? null,
          }))
      : [],

    /*
     * HOW FAR THE RULE THEY WROTE SAT FROM WHO THEY WERE BEFORE BLOCK 5.
     *
     * The same arithmetic as the position effect — mean absolute difference over the four values —
     * and deliberately NOT part of it. Scenario 6 has no position by construction: the whole point
     * of the veil is that the participant cannot be told where they stand, so it carries no rung of
     * the ladder that analysis.position_effect is built on. The number is here because it is worth
     * having and nowhere else because it must not be averaged in.
     */
    distance_from_profile_before_block5: round1(veilDistance),
    distance_from_profile_before_block5_note:
      "Same arithmetic as analysis.position_effect, and NOT part of it. Scenario 6 has no position, "
      + "so it is excluded from every position figure. Do not pool this with the five rows there.",
  };
}


export function buildPositionSection(block5: unknown): Record<string, unknown> | null {
  if (!block5 || typeof block5 !== "object") return null;
  const position = positionFor(block5 as Record<string, unknown>);
  if (!position) return null;

  const byScenario = position.rows.map((row) => ({
    scenario_id: row.scenarioId,
    order_shown: row.index,
    title: row.title,
    position: row.position,
    position_label: row.positionLabel,
    distance_from_profile_before_block5: row.distance,
    departure_share: row.departure,
    nearest_possible_distance: row.nearest,
    farthest_possible_distance: row.farthest,
    value_movement: row.valueDrift,
  }));

  const byPosition = position.summaries.map((s) => ({
    position: s.position,
    position_label: s.label,
    scenarios_at_this_position: s.scenarioCount,
    mean_distance_from_profile_before_block5: s.distance,
    mean_departure_share: s.departure,
    mean_value_movement: s.valueDrift,
  }));

  return {
    overall_effect: position.effect,
    overall_effect_label: position.label,
    overall_effect_explained:
      "The widest gap in departure_share between any two positions. Higher means the participant's choices depended more on who the decision was about.",
    by_scenario: byScenario,
    between_scenarios: betweenScenarios(block5, byScenario),
    by_position: byPosition,
    authority_vs_receiving: authorityVsReceiving(byPosition),
    drift_check: position.drift,
    drift_check_explained:
      "Whether departure grew simply because the study went on, rather than because position changed. A large value here weakens any position reading.",
    direction_sentence: position.sentence,
    decided_versus_wished: decidedVersusWished(block5 as Record<string, unknown>),
    source: "Computed from blocks.block5_emergency_scenarios. Saved because the results page works these out live and would otherwise discard them.",
  };
}

/**
 * THE DECISION AND THE WISH, SIDE BY SIDE: scenario 4 (the participant decides, it lands on their
 * colleagues) against scenario 5 (someone else decides, it lands on them, and they only wish).
 *
 * The same numbers the results page shows under the mirror chart - "consistency when deciding" and
 * "when only wishing" - which until now were worked out live and discarded. They come from
 * analyseMirror (block5Mirror.ts), the function the page itself calls, so the page and the record
 * cannot disagree.
 *
 *   vci_acted                   100 × the VCI weight of the decision's label   (100 / 80 / 50 / 10)
 *   vci_wished                  100 × the VCI weight of the wish's label
 *   acted_choice_was_aligned    the decision was the option labeled Aligned (the best fit)
 *   wished_choice_was_aligned   the wish was the option labeled Aligned
 *   responsibility_gap          vci_wished − vci_acted; positive = truer to their values when the
 *                               decision was not theirs
 *   labels_apart                0-3; what the reading's "somewhat" or "much" counts
 *
 * "Aligned" means exactly the Aligned label. A Weakly aligned choice reads false, and its label is
 * stored beside the flag so the two can be told apart. Each side is judged on the profile the
 * participant brought into its own scenario, exactly as VCI is.
 *
 * Null when either half is missing - a participant who stopped before scenario 5.
 */
function decidedVersusWished(b5: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const results = b5.scenarioResults;
    const before = b5.originalProfile;
    if (!Array.isArray(results) || !before) return null;
    const m = analyseMirror(results as never, before as never);
    if (!m) return null;
    return {
      what_this_is:
        "Scenario 4 (you decide, it lands on your colleagues) against scenario 5 (someone else "
        + "decides, it lands on you, and you only wish). The same employer, cut and six options; "
        + "only the position changed.",
      acted_scenario_id: m.decided.scenarioId,
      acted_option_title: m.decided.optionTitle,
      acted_alignment_label: ALIGNMENT_LABEL[m.decided.level],
      acted_choice_was_aligned: m.decisionWasAligned,
      vci_acted: m.vciActed,
      wished_scenario_id: m.wished.scenarioId,
      wished_option_title: m.wished.optionTitle,
      wished_alignment_label: ALIGNMENT_LABEL[m.wished.level],
      wished_choice_was_aligned: m.wishWasAligned,
      vci_wished: m.vciWished,
      responsibility_gap: m.responsibilityGap,
      labels_apart: m.labelSteps,
      responsibility_gap_reading: responsibilityGapLabel(m.responsibilityGap, m.labelSteps),
      wished_for_the_same_option: m.sameOption,
      mirror_gap: m.mirrorGap,
      wish_seconds: m.wished.seconds,
      wish_was_hurried: m.hurried,
    };
  } catch {
    return null;
  }
}

/**
 * EVERY SCENARIO AGAINST EVERY OTHER SCENARIO.
 *
 * THE QUESTION THIS ANSWERS, which `by_scenario` could not. Each row there says how far one choice
 * sat from the frozen profile. That is a distance to a fixed point, so two scenarios with the same
 * distance can still be in completely different directions — a participant who moved 30 points
 * towards protecting the vulnerable and one who moved 30 points away from it are indistinguishable
 * in that table. Comparing the two choices with each other is what makes "am I the same person
 * alone as I am with my family in the car?" a number instead of a phrase.
 *
 * THREE COLUMNS, BECAUSE THEY ARE THREE DIFFERENT QUESTIONS.
 *
 *   distance_between_the_two_choices     symmetric, 0-100. How far apart the two OPTIONS are in
 *                                        value space. Large means they chose differently; it says
 *                                        nothing about which was more like them.
 *   difference_in_distance_from_profile  signed, `to` minus `from`. Positive means the second
 *                                        choice sat further from who they were before Block 5.
 *   difference_in_departure_share        the same comparison after each distance is expressed as a
 *                                        share of the room its own scenario offered. THIS is the
 *                                        one to compare across pairs, because the five menus do not
 *                                        allow the same amount of movement.
 *
 * SCENARIO 6 IS NOT IN HERE. It has no position by construction and is excluded from every position
 * figure; `analysePosition` drops it before these rows are built. Its distance from the frozen
 * profile is in analysis.scenario6_mpf_test, on its own, where it cannot be averaged in by accident.
 *
 * ONE PARTICIPANT'S PAIR IS A DESCRIPTION, NOT A FINDING. Two scenarios differ in their content as
 * well as in who carries the cost, so a difference here is position OR subject matter and this
 * table cannot separate them. Scenarios 4 and 5 are the one exception in the deck, which is why
 * they also get a field of their own below.
 */
function betweenScenarios(
  block5: unknown,
  rows: {
    scenario_id: string; order_shown: number; title: string; position: string;
    position_label: string; distance_from_profile_before_block5: number; departure_share: number;
  }[],
): Record<string, unknown> | null {
  if (rows.length < 2) return null;
  const results = resultsOf(block5);

  const chosenOptionFor = (scenarioId: string): Block5ScenarioOption | undefined => {
    const result = results.find((r) => r.scenarioId === scenarioId);
    return optionOf(scenarioOf(scenarioId), result?.selectedOptionId);
  };

  const pairs: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      const optionA = chosenOptionFor(a.scenario_id);
      const optionB = chosenOptionFor(b.scenario_id);
      const distanceApart = optionA && optionB ? optionDistance(optionA, optionB) : null;

      /*
       * THE VERDICT IS DECIDED ON THE NUMBER THAT IS STORED, not on the one before rounding.
       *
       * `difference_in_departure_share` is rounded to one decimal place. Deciding the direction on
       * the raw value let a row store 0.1 and say "neither" — a stored number disagreeing with the
       * stored sentence beside it. Nobody would ever chase that down; they would simply stop
       * trusting the table. Rounding first makes the two impossible to disagree.
       */
      const departureGap = round1(b.departure_share - a.departure_share) ?? 0;

      pairs.push({
        pair: `scenario ${a.order_shown} vs scenario ${b.order_shown}`,
        from_scenario_id: a.scenario_id,
        from_order_shown: a.order_shown,
        from_position: a.position,
        from_position_label: a.position_label,
        to_scenario_id: b.scenario_id,
        to_order_shown: b.order_shown,
        to_position: b.position,
        to_position_label: b.position_label,

        distance_between_the_two_choices: round1(distanceApart),
        difference_in_distance_from_profile:
          round1(b.distance_from_profile_before_block5 - a.distance_from_profile_before_block5),
        difference_in_departure_share: departureGap,
        /*
         * NAMED BY SCENARIO ID, NOT BY POSITION. Each position appears exactly once in today's deck,
         * so a position would identify the row today — and the moment a position repeats, which the
         * design notes explicitly plan for, "self" would no longer say WHICH of two scenarios moved
         * further. An id is unambiguous whatever the deck becomes, and both positions are already on
         * the row for anyone who wants to read it in words.
         */
        moved_further_from_themselves:
          departureGap === 0 ? "neither" : departureGap > 0 ? b.scenario_id : a.scenario_id,
      });
    }
  }

  const alone = rows.find((r) => r.position === "self");
  const withGroup = rows.find((r) => r.position === "self_and_group");
  const alonePair = pairs.find(
    (p) => p.from_scenario_id === alone?.scenario_id && p.to_scenario_id === withGroup?.scenario_id,
  );

  return {
    what_this_is:
      "Every scenario compared with every other one: how far apart the two choices were, and which "
      + "of the two sat further from the participant's pre-Block-5 profile.",
    compare_on: "difference_in_departure_share — the only column that is comparable across pairs.",
    scenario_6_is_excluded:
      "Scenario 6 has no position by construction and is excluded from every position figure. Its "
      + "distance from the frozen profile is in analysis.scenario6_mpf_test.",
    a_single_pair_is_not_evidence:
      "Two scenarios differ in subject matter as well as in who carries the cost, so a difference "
      + "here is position OR content. Only scenarios 4 and 5 hold the content constant.",
    pairs,
    alone_vs_with_dependents: alonePair
      ? {
          ...alonePair,
          why_this_pair_matters:
            "Scenario 1 puts the participant alone with nobody depending on them; scenario 2 puts "
            + "the same person in a household of four. It is the study's opening question — am I the "
            + "same person when somebody else is in the car — and it is the pair most often asked "
            + "for, so it is lifted out of the list above rather than left to be found in it. The "
            + "subject matter differs too (a chemical release against a wildfire), so read it as a "
            + "description of this participant, not as proof that dependents caused the difference.",
        }
      : null,
  };
}

/**
 * Scenarios 4 and 5 side by side — the cleanest position reading in the study.
 *
 * Everywhere else in Block 5, the position and the situation change together, so a difference
 * could be either. These two are a matched pair by design: the same employer, the same decision,
 * the same six options and the same numbers. The only thing that differs is whether the
 * participant is the one deciding or the one it is being done to. A difference here is position,
 * and it cannot be anything else — which is why it gets a field of its own rather than being
 * left for a reader to work out from the array above.
 */
function authorityVsReceiving(
  byPosition: { position: string; mean_departure_share: number }[],
): Record<string, unknown> | null {
  const deciding = byPosition.find((p) => p.position === "under_authority");
  const receiving = byPosition.find((p) => p.position === "receiving_end");
  if (!deciding || !receiving) return null;

  const difference = Math.round((receiving.mean_departure_share - deciding.mean_departure_share) * 10) / 10;
  return {
    when_i_decided_under_my_employers_rules: deciding.mean_departure_share,
    when_the_same_decision_was_done_to_me: receiving.mean_departure_share,
    difference,
    moved_further: difference === 0 ? "neither" : difference > 0 ? "receiving_end" : "under_authority",
    why_this_pair_matters:
      "Scenarios 4 and 5 are a matched pair: same employer, same decision, same six options, same numbers. Only the chair the participant sits in changes, so a difference between them is a clean read of position rather than of content.",
  };
}
