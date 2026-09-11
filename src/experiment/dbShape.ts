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
      summaries: report.summaries,
      drift: report.drift,
      sentence: report.sentence,
    };
  } catch {
    return null;
  }
}

export function buildHeadline(block5: unknown, timings: unknown): Record<string, unknown> | null {
  if (!block5 || typeof block5 !== "object") return null;
  const b5 = block5 as Record<string, unknown>;

  const position = positionFor(b5);

  const totalMs = (timings as { totalExperimentMs?: number } | null)?.totalExperimentMs;

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
export function buildVisualizationData(block5: unknown): Record<string, unknown> | null {
  if (!block5 || typeof block5 !== "object") return null;
  const position = positionFor(block5 as Record<string, unknown>);
  if (!position) return null;
  return {
    position_effect: position.effect,
    position_effect_label: position.label,
    position_effect_explained:
      "How differently the participant chose depending on who the decision was about: themselves, their household, or strangers. Higher means their choices changed more with position.",
    position_by_stake: position.summaries,
    position_drift_check: position.drift,
    position_direction_sentence: position.sentence,
    note: "Computed from blocks.block5_emergency_scenarios. Saved because the results page works these out live and would otherwise discard them.",
  };
}
