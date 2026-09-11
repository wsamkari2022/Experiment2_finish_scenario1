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
import { TELEMETRY_KEY } from "./telemetry";
import { PARTICIPANT_RECORD_KEY } from "./participantRecord";
import { analysePosition, positionEffectLabel } from "./block5Position";

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
export const SHAPE_VERSION = "2026-09-11-position-b";

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

  { key: TELEMETRY_KEY, path: "timings" },
];

/* ------------------------------------------------------------- carrying a run to another machine */

/**
 * The browser files a half-finished participant needs in order to continue somewhere else.
 *
 * THE PROBLEM THIS SOLVES
 * The consent page promises that a participant may stop and come back. On the SAME browser that
 * works, because their answers are still in it. On a different computer it did not work at all:
 * the start screen recognised them and put them back on the stage they left, but nothing had put
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
    stability_score: b5.stability ?? null,
    stability_label: b5.stabilityLevel ?? null,
    performance_score: b5.performance ?? null,
    performance_captured: b5.performanceCaptured ?? null,
    position_effect: position?.effect ?? null,
    position_effect_label: position?.label ?? null,
    scenarios_completed: Array.isArray(b5.scenarioResults) ? b5.scenarioResults.length : null,
    reflection_visits: b5.totalCvrVisits ?? null,
    adjustment_visits: b5.totalApaVisits ?? null,
    choice_switches: b5.totalSwitches ?? null,
    total_time_minutes: typeof totalMs === "number" ? Math.round(totalMs / 60000) : null,
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
    by_position: byPosition,
    authority_vs_receiving: authorityVsReceiving(byPosition),
    drift_check: position.drift,
    drift_check_explained:
      "Whether departure grew simply because the study went on, rather than because position changed. A large value here weakens any position reading.",
    direction_sentence: position.sentence,
    source: "Computed from blocks.block5_emergency_scenarios. Saved because the results page works these out live and would otherwise discard them.",
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
