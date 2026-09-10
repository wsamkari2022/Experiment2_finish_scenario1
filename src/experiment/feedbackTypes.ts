/**
 * feedbackTypes.ts — definitions + scoring + storage shape for the post-experiment
 * User Feedback Page (LocalStorage now, MongoDB-ready).
 *
 * Four sections:
 *   ① CVR (conditional — only if the participant saw a CVR vignette)
 *   ② APA (conditional — only if the APA panel opened)
 *   ③ Decision-support tools & experiment design (always)
 *   ④ Learning Insight & Well-being battery (always) — 20 Likert items, 7 subscales,
 *      with documented reverse-scoring and a computed Well-being Composite.
 *
 * Raw item responses are the source of truth; computed subscale/composite scores are stored
 * for convenience with self-documenting scoring metadata so they are reproducible. No personal
 * identity is collected — only the anonymous session_id.
 */

import type { Block5Results } from "./block5Types";
import { BLOCK5_RESULTS_KEY } from "./block5Types";
import type { TimingSummary } from "./telemetry";
import { buildTimingSummary } from "./telemetry";
import type { ParticipantRecord } from "./participantRecord";
import { buildParticipantRecord } from "./participantRecord";

/** LocalStorage key for the most-recent assembled feedback record. */
export const FEEDBACK_KEY = "vrds_feedback_record";
/**
 * LocalStorage key for the append-only archive of ALL completed feedback records on this
 * device. This survives Start-Over / Finish so that, on a shared lab/kiosk browser, no
 * participant's data is lost before it can be exported to MongoDB.
 */
export const FEEDBACK_ARCHIVE_KEY = "vrds_feedback_archive";
export const FEEDBACK_SCHEMA_VERSION = 3; // v3: timing.block5 is scenarioMs[] (5 scenarios); v2 = 1–7 Likert
export const EXPERIMENT_ID = "vrds_experiment_2";

/* ----------------------------- Question definitions ----------------------------- */

export type FeedbackQuestionType = "likert" | "yesno" | "open";

export interface FeedbackQuestion {
  code: string;            // stable DB code (never reused for a different question)
  text: string;            // the prompt shown to the participant
  type: FeedbackQuestionType;
  /** Optional per-question scale captions for Likert ends (defaults to disagree→agree). */
  likertLow?: string;
  likertHigh?: string;
}

/** An answer to a single feedback question: Likert number, "yes"/"no", or free text. */
export type FeedbackAnswer = number | "yes" | "no" | string;

/** ① CVR — shown only when the participant actually saw a CVR vignette. */
export const CVR_QUESTIONS: FeedbackQuestion[] = [
  { code: "CVR_helped", type: "likert", text: "The value-reflection step (CVR) helped me think more carefully about my decision." },
  { code: "CVR_reconsider", type: "likert", text: "Hearing the affected person's perspective, or the re-framing, made me reconsider my choice." },
  { code: "CVR_clear", type: "yesno", text: "Was the value-reflection step clear and easy to understand?" },
  { code: "CVR_useful", type: "likert", text: "The value-reflection step was useful to me." },
  { code: "CVR_confusing", type: "yesno", text: "Did the value-reflection step feel confusing or distracting?" },
  { code: "CVR_confidence", type: "likert", text: "After the value reflection, my confidence in my choice went…", likertLow: "Much lower", likertHigh: "Much higher" },
  { code: "CVR_changed", type: "yesno", text: "Did the value reflection change your final choice or your values?" },
  { code: "CVR_open", type: "open", text: "What part of the value reflection was most helpful or most confusing?" },
];

/**
 * ① CVR dual-perspective — extra questions shown ONLY if the participant generated the alternate
 * lens (Directness ↔ Context) in at least one reflection. Rendered inside the CVR section.
 */
export const DUAL_VIEW_QUESTIONS: FeedbackQuestion[] = [
  { code: "CVR_dual_helpful", type: "likert", text: "Being able to generate and compare a second perspective helped me reflect more carefully on my choice." },
  { code: "CVR_dual_changed", type: "yesno", text: "Did comparing the two perspectives change how you felt about your choice?" },
];

/** ② APA — shown only when the APA value-clarification panel opened. */
export const APA_QUESTIONS: FeedbackQuestion[] = [
  { code: "APA_clarify", type: "likert", text: "The value-clarification step (APA) helped me clarify what I actually value." },
  { code: "APA_tradeoff", type: "likert", text: "It helped me see the trade-off between my earlier profile and my chosen option." },
  { code: "APA_clear", type: "yesno", text: "Were the value-clarification questions clear?" },
  { code: "APA_prioritization", type: "likert", text: "The value-prioritization step was useful." },
  { code: "APA_better", type: "likert", text: "The value-clarification step helped me make a better final decision." },
  { code: "APA_toolong", type: "yesno", text: "Did the value-clarification step feel too long?" },
  { code: "APA_confidence_helpful", type: "yesno", text: "Was the confidence rating helpful?" },
  { code: "APA_open", type: "open", text: "What part of the value-clarification step was most helpful or most confusing?" },
];

/** ③ Decision-support tools — rate how helpful each tool the participant saw was (always shown). */
export const TOOL_RATINGS: FeedbackQuestion[] = [
  { code: "TOOL_optionCards", type: "likert", text: "The option cards", likertLow: "Not helpful", likertHigh: "Very helpful" },
  { code: "TOOL_consequences", type: "likert", text: "The consequence / “what it gives up” lines", likertLow: "Not helpful", likertHigh: "Very helpful" },
  { code: "TOOL_tradeoffs", type: "likert", text: "The trade-off explanations", likertLow: "Not helpful", likertHigh: "Very helpful" },
  { code: "TOOL_metricsDashboard", type: "likert", text: "The performance metrics dashboard", likertLow: "Not helpful", likertHigh: "Very helpful" },
  { code: "TOOL_previewImpact", type: "likert", text: "The “Preview impact” button", likertLow: "Not helpful", likertHigh: "Very helpful" },
  { code: "TOOL_alignmentLabels", type: "likert", text: "The alignment labels on each option", likertLow: "Not helpful", likertHigh: "Very helpful" },
  { code: "TOOL_resultsPage", type: "likert", text: "The final results page", likertLow: "Not helpful", likertHigh: "Very helpful" },
];

/** ③ Decision-support — closing questions (always shown). */
export const TOOL_CLOSERS: FeedbackQuestion[] = [
  { code: "TOOLS_clear", type: "yesno", text: "Was the scenario information clear?" },
  { code: "TOOLS_thoughtful", type: "likert", text: "The information provided helped me make a thoughtful decision." },
  { code: "TOOLS_open", type: "open", text: "Which tool helped most, and what would you improve?" },
];

/* ----------------------- ④ Learning Insight & Well-being battery ----------------------- */

export type WellbeingSubscale =
  | "learningInsight"
  | "decisionSatisfaction"
  | "decisionRegret"
  | "valueCongruence"
  | "decisionConfidence"
  | "cognitiveBurden"
  | "perceivedSupport"
  | "overallWellbeing";

export interface WellbeingItem {
  code: string;
  text: string;
  subscale: WellbeingSubscale;
  /** reverse-scored for well-being (8 − response on the 1–7 scale, so higher always = better). */
  reverse: boolean;
}

/** 20 items across 7 subscales. Order = presentation order (two grouped matrices in the UI). */
export const WELLBEING_ITEMS: WellbeingItem[] = [
  // A · Learning Insight
  { code: "LI1", subscale: "learningInsight", reverse: false, text: "I learned something about my own values during this experiment." },
  { code: "LI2", subscale: "learningInsight", reverse: false, text: "I gained insight into how I make difficult decisions." },
  { code: "LI3", subscale: "learningInsight", reverse: false, text: "This experience helped me understand moral trade-offs more clearly." },
  { code: "LI4", subscale: "learningInsight", reverse: false, text: "I believe this process improved the quality of my decision-making." },
  /*
    B - Decision Satisfaction. THREE PURE SATISFACTION ITEMS: the outcome, the process, and what
    the decisions achieved.

    The old third item was "I have doubts or regrets about some of the decisions I made", and it
    was reverse-scored INTO this subscale. That made regret the arithmetic opposite of
    satisfaction BY CONSTRUCTION - a participant could not be recorded as satisfied and regretful
    at once, because the instrument added the two together as one number.

    That is precisely the case the advisor's example describes: "I am very satisfied that I ate the
    cake, because it was delicious, but I regret eating it, because I probably shouldn't have."
    Under the old scoring that person's satisfaction was pulled down by their regret and the
    dissociation - the finding - disappeared into a subscale mean. The item now lives in its own
    subscale below, and this one measures only satisfaction.
  */
  { code: "DS1", subscale: "decisionSatisfaction", reverse: false, text: "I am satisfied with the final decisions I made." },
  { code: "DS2", subscale: "decisionSatisfaction", reverse: false, text: "I am satisfied with the way I reached my decisions (the process)." },
  { code: "DS4", subscale: "decisionSatisfaction", reverse: false, text: "I am satisfied with what my decisions achieved." },
  /*
    B2 - Decision Regret, measured SEPARATELY so it can disagree with satisfaction.

    Every item is worded so that AGREEING means MORE regret, which keeps the raw subscale
    single-directional (the same shape cognitiveBurden already uses). DR3 is the one reverse-worded
    item, kept as a guard against straight-lining down the column.

    DR2 and DR4 are the two that let the two constructs come apart: both explicitly grant that the
    choice felt right at the time, and still ask about regret now. Without an item that allows
    both to be true, the scale cannot record the person in the cake example.
  */
  { code: "DR1", subscale: "decisionRegret", reverse: true, text: "Looking back, I wish I had decided differently in at least one situation." },
  { code: "DR2", subscale: "decisionRegret", reverse: true, text: "Some of my choices felt right at the time, but I am not comfortable with them now." },
  { code: "DR3", subscale: "decisionRegret", reverse: false, text: "If I faced these situations again, I would make the same choices." },
  { code: "DR4", subscale: "decisionRegret", reverse: true, text: "I regret at least one decision, even though I understood why I made it at the time." },
  // C · Value Congruence
  { code: "VC1", subscale: "valueCongruence", reverse: false, text: "My final decisions reflected what I truly value." },
  { code: "VC2", subscale: "valueCongruence", reverse: false, text: "My choices were consistent with the kind of person I want to be." },
  // D · Decision Confidence
  { code: "DC1", subscale: "decisionConfidence", reverse: false, text: "I felt confident in the decisions I made." },
  { code: "DC2", subscale: "decisionConfidence", reverse: false, text: "Reflecting during the task made me more confident in my final choices." },
  // E · Cognitive Burden / Overwhelm (all reverse for well-being)
  { code: "CB1", subscale: "cognitiveBurden", reverse: true, text: "I felt overwhelmed during the experiment." },
  { code: "CB2", subscale: "cognitiveBurden", reverse: true, text: "Making these decisions felt mentally exhausting." },
  { code: "CB3", subscale: "cognitiveBurden", reverse: true, text: "The process left me more confused than before." },
  // F · Perceived Support / Autonomy
  { code: "SA1", subscale: "perceivedSupport", reverse: false, text: "The system supported me in making my own decision." },
  { code: "SA2", subscale: "perceivedSupport", reverse: false, text: "I felt free to choose what I genuinely believed, rather than being pushed toward an answer." },
  { code: "SA3", subscale: "perceivedSupport", reverse: false, text: "The tools helped me think more clearly, rather than telling me what to do." },
  // G · Overall Well-being
  { code: "OW1", subscale: "overallWellbeing", reverse: false, text: "Overall, this was a positive experience." },
  { code: "OW2", subscale: "overallWellbeing", reverse: false, text: "I felt emotionally comfortable during the experiment." },
  { code: "OW3", subscale: "overallWellbeing", reverse: false, text: "I feel good about how I approached these decisions." },
];

/** Open-ended prompts in the Well-being section. */
export const WELLBEING_OPEN_ENDED = [
  { code: "OE_values", text: "What did you learn about your values?" },
  { code: "OE_change", text: "Did anything change in how you think about difficult moral decisions?" },
  { code: "OE_affect", text: "What part of the process made you feel more confident, less confident, satisfied, or uncomfortable?" },
  { code: "OE_regret", text: "Was there a decision you felt good about at the time, but would change now? What was it, and what changed your mind?" },
  { code: "OE_additional", text: "Any additional feedback?" },
] as const;

/** The codes that are reverse-scored (6 − x) before entering the composite. */
export const WELLBEING_REVERSE_CODES = WELLBEING_ITEMS.filter((i) => i.reverse).map((i) => i.code);

export const WELLBEING_LIKERT_LOW = "Strongly disagree";
export const WELLBEING_LIKERT_HIGH = "Strongly agree";

/* ------------------------------- Well-being scoring ------------------------------- */

export interface WellbeingSubscaleScores {
  learningInsight: number;
  decisionSatisfaction: number;
  /** raw regret (higher = MORE regret); reported on its own, not in the composite. */
  decisionRegret: number;
  /** inverted regret (higher = LESS regret); this is what enters the composite. */
  lowDecisionRegret: number;
  valueCongruence: number;
  decisionConfidence: number;
  /** raw burden (higher = MORE burden); not in the composite. */
  cognitiveBurden: number;
  /** inverted burden (higher = LESS burden); this is what enters the composite. */
  lowCognitiveBurden: number;
  perceivedSupport: number;
  overallWellbeing: number;
}

export interface WellbeingResult {
  /** raw 1–5 responses keyed by item code — the source of truth. */
  items: Record<string, number>;
  subscales: WellbeingSubscaleScores;
  /** mean of the six affective/process subscales (Learning Insight reported separately). */
  wellbeingComposite: number;
  /** optional broad index including Learning Insight (mean of all seven subscales). */
  wellbeingPlusInsight: number;
  scoring: {
    scale: string;
    reverseScored: string[];
    reverseFormula: string;
    compositeSubscales: string[];
    compositeFormula: string;
  };
  openEnded: Record<string, string>;
}

/** The six subscales that make up the Well-being Composite (Learning Insight excluded). */
export const WELLBEING_COMPOSITE_SUBSCALES: (keyof WellbeingSubscaleScores)[] = [
  "decisionSatisfaction", "lowDecisionRegret", "valueCongruence", "decisionConfidence",
  "lowCognitiveBurden", "perceivedSupport", "overallWellbeing",
];

/**
 * Which subscales appear in each half of the questionnaire.
 *
 * The UI used to split the item list with a hard-coded `slice(11)`. Adding one item silently moved
 * the boundary and put a question under the wrong heading, so the split is derived from the
 * subscale instead - add an item and it lands in the right half on its own.
 */
export const WELLBEING_PART_A_SUBSCALES: WellbeingSubscale[] = [
  "learningInsight", "decisionSatisfaction", "decisionRegret", "valueCongruence", "decisionConfidence",
];

/** Two decimal places, applied ONCE at storage time. Composites are computed from unrounded
 *  means so that rounding never compounds through a chain of averages. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mean of the finite numbers in the list; 0 if none are present. */
function mean(values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return 0;
  return finite.reduce((s, v) => s + v, 0) / finite.length;
}

/** Reverse a 1–7 Likert response so higher = better well-being (1↔7, 2↔6, 3↔5, 4 stays). */
export function reverseLikert(x: number): number {
  return 8 - x;
}

/**
 * Computes subscale means and composites from raw 1–7 item responses.
 * Reverse items are inverted (8 − x) before they enter a subscale. Cognitive Burden is stored
 * BOTH as raw `cognitiveBurden` (higher = more burden) and inverted `lowCognitiveBurden`
 * (used in the composite). Items left unanswered are simply ignored in their subscale mean.
 */
export function computeWellbeing(
  items: Record<string, number>,
  openEnded: Record<string, string>,
): WellbeingResult {
  // For a subscale, average the items (inverting reverse items so higher = better).
  const subscaleMean = (subscale: WellbeingSubscale, invertReverse: boolean): number => {
    const vals = WELLBEING_ITEMS
      .filter((i) => i.subscale === subscale)
      .map((i) => {
        const raw = items[i.code];
        if (!Number.isFinite(raw)) return NaN;
        return invertReverse && i.reverse ? reverseLikert(raw) : raw;
      });
    return mean(vals);
  };

  const learningInsight = subscaleMean("learningInsight", true);
  const decisionSatisfaction = subscaleMean("decisionSatisfaction", true);
  /*
    Regret carries mixed wording (three items where agreeing means regret, one where it means the
    opposite), so the raw score cannot be read straight off the responses the way cognitiveBurden's
    can. `subscaleMean(_, true)` already resolves every item into the "higher = better well-being"
    direction, which for this subscale is "higher = LESS regret". Flipping that on the 1-7 scale
    gives the raw regret score, and the two stay consistent by construction rather than by a second
    hand-written rule that could drift from the first.
  */
  const lowDecisionRegret = subscaleMean("decisionRegret", true);
  const decisionRegret = Number.isFinite(lowDecisionRegret) && lowDecisionRegret > 0
    ? reverseLikert(lowDecisionRegret)
    : 0;
  const valueCongruence = subscaleMean("valueCongruence", true);
  const decisionConfidence = subscaleMean("decisionConfidence", true);
  // Raw burden = items as entered (reverse NOT applied); inverted = 6 − raw.
  const cognitiveBurden = subscaleMean("cognitiveBurden", false);
  const lowCognitiveBurden = subscaleMean("cognitiveBurden", true);
  const perceivedSupport = subscaleMean("perceivedSupport", true);
  const overallWellbeing = subscaleMean("overallWellbeing", true);

  // Unrounded subscale means (used to compute composites at full precision).
  const raw: WellbeingSubscaleScores = {
    learningInsight,
    decisionSatisfaction,
    decisionRegret,
    lowDecisionRegret,
    valueCongruence,
    decisionConfidence,
    cognitiveBurden,
    lowCognitiveBurden,
    perceivedSupport,
    overallWellbeing,
  };

  // Composite = mean of the six subscale MEANS (computed from unrounded means, rounded once).
  const composite = mean(WELLBEING_COMPOSITE_SUBSCALES.map((k) => raw[k]));
  const plusInsight = mean([raw.learningInsight, ...WELLBEING_COMPOSITE_SUBSCALES.map((k) => raw[k])]);

  // Rounded copies for storage/display.
  const subscales: WellbeingSubscaleScores = {
    learningInsight: round2(raw.learningInsight),
    decisionSatisfaction: round2(raw.decisionSatisfaction),
    decisionRegret: round2(raw.decisionRegret),
    lowDecisionRegret: round2(raw.lowDecisionRegret),
    valueCongruence: round2(raw.valueCongruence),
    decisionConfidence: round2(raw.decisionConfidence),
    cognitiveBurden: round2(raw.cognitiveBurden),
    lowCognitiveBurden: round2(raw.lowCognitiveBurden),
    perceivedSupport: round2(raw.perceivedSupport),
    overallWellbeing: round2(raw.overallWellbeing),
  };

  return {
    items,
    subscales,
    wellbeingComposite: round2(composite),
    wellbeingPlusInsight: round2(plusInsight),
    scoring: {
      scale: "1to7_agree",
      reverseScored: WELLBEING_REVERSE_CODES,
      reverseFormula: "8 - x",
      compositeSubscales: WELLBEING_COMPOSITE_SUBSCALES as string[],
      compositeFormula: "mean of subscale means",
    },
    openEnded,
  };
}

/* ------------------------------- The feedback record ------------------------------- */

/** Flattened per-scenario telemetry stored on the feedback record (joined to Block-5 results). */
export interface FeedbackScenarioTelemetry {
  scenarioId: string;
  cvrTriggered: boolean;
  apaTriggered: boolean;
  cvrVisits: number;
  apaVisits: number;
  cvrOutcome: string;
  apaOutcome: string;
  numberOfSwitches: number;
  optionChanges: number;
  cvrBackouts: number;
  apaBackouts: number;
  finalDecisionChanges: number;
  timeToFirstSelectionMs: number | null;
  cvrDwellMs: number;
  apaDwellMs: number;
  timeMs: number;
}

export interface FeedbackBlock5Summary {
  totalCvrVisits: number;
  totalApaVisits: number;
  totalSwitches: number;
  vci: number | null;
  stability: number | null;
  performance: number | null;
  scenarios: FeedbackScenarioTelemetry[];
  /**
   * The LocalStorage key the full Block-5 results USED to live under.
   *
   * KEPT FOR REFERENCE ONLY - do not analyze from it. Storing a key rather than the data was a
   * data-loss bug: "Finish" calls localStorage.clear(), which deletes exactly the entry this
   * points at, so every archived record referred to something that no longer existed. The data
   * itself now travels in `FeedbackRecord.block5Full`.
   */
  finalResultsKey: string;
}

export interface FeedbackAnswers {
  cvr?: Record<string, FeedbackAnswer>;
  apa?: Record<string, FeedbackAnswer>;
  decisionSupport: Record<string, FeedbackAnswer>;
  wellbeing: WellbeingResult;
}

/**
 * ONE RECORD PER PARTICIPANT, AND IT CONTAINS EVERYTHING.
 *
 * This is the row you will analyze. It is the only structure that survives a participant pressing
 * "Finish", because that handler clears LocalStorage and preserves the archive alone - so anything
 * not physically inside this object is gone.
 *
 * It did not always contain everything, and the gap was serious enough to name here so it is never
 * reintroduced: until 2026-09-02 the record held a Block-5 SUMMARY plus the string
 * "block5_public_emergency_results", and `buildParticipantRecord()` - which assembles the raw
 * Blocks 1-4 answers - was written, documented, and never called by anything. A completed
 * participant therefore left behind their questionnaire and a handful of headline scores, while
 * every money-ladder answer, every trolley threshold, the whole six-cell workforce matrix and the
 * full Block-5 result were destroyed on the way out. The two fields below close that.
 */
export interface FeedbackRecord {
  session_id: string;
  experiment: typeof EXPERIMENT_ID;
  schemaVersion: number;
  completedAt: string;
  timing: TimingSummary;
  /** Headline Block-5 numbers and per-scenario telemetry. A summary, not the source. */
  block5: FeedbackBlock5Summary;
  /**
   * THE RAW BLOCKS 1-4 ANSWERS, plus what the model derived from them.
   * `raw.*` is what the participant did and can never be recomputed; `derived.*` can.
   */
  participant: ParticipantRecord | null;
  /** THE COMPLETE BLOCK-5 RESULT: every scenario, every choice, both profiles, all telemetry. */
  block5Full: Block5Results | null;
  feedback: FeedbackAnswers;
}

/** Whether the CVR feedback section should be shown (participant saw at least one CVR vignette). */
export function shouldShowCvrSection(results: Block5Results | null): boolean {
  if (!results) return false;
  if ((results.totalCvrVisits ?? 0) > 0) return true;
  return results.scenarioResults.some((r) => r.cvrFired || (r.telemetry?.cvrVisits ?? 0) > 0);
}

/** Whether the dual-perspective questions should be shown (alt lens generated in any scenario). */
export function usedDualPerspective(results: Block5Results | null): boolean {
  return !!results && results.scenarioResults.some((r) => r.cvrAltViewGenerated);
}

/** Whether the APA feedback section should be shown (the APA panel opened at least once). */
export function shouldShowApaSection(results: Block5Results | null): boolean {
  if (!results) return false;
  if ((results.totalApaVisits ?? 0) > 0) return true;
  return results.scenarioResults.some((r) => (r.telemetry?.apaVisits ?? 0) > 0 || !!r.apa);
}

/** Builds the Block-5 telemetry summary embedded in the feedback record. */
export function buildBlock5Summary(results: Block5Results | null): FeedbackBlock5Summary {
  const scenarios: FeedbackScenarioTelemetry[] = (results?.scenarioResults ?? []).map((r) => {
    const t = r.telemetry;
    return {
      scenarioId: r.scenarioId,
      cvrTriggered: t?.cvrTriggered ?? !!r.cvrFired,
      apaTriggered: t?.apaTriggered ?? !!r.apa,
      cvrVisits: t?.cvrVisits ?? 0,
      apaVisits: t?.apaVisits ?? 0,
      cvrOutcome: t?.cvrOutcome ?? "none",
      apaOutcome: t?.apaOutcome ?? (r.apa ? "committed" : "none"),
      numberOfSwitches: t?.numberOfSwitches ?? 0,
      optionChanges: t?.optionChanges ?? 0,
      cvrBackouts: t?.cvrBackouts ?? 0,
      apaBackouts: t?.apaBackouts ?? 0,
      finalDecisionChanges: t?.finalDecisionChanges ?? 0,
      timeToFirstSelectionMs: t?.timeToFirstSelectionMs ?? null,
      cvrDwellMs: t?.cvrDwellMs ?? 0,
      apaDwellMs: t?.apaDwellMs ?? 0,
      timeMs: r.timeMs ?? 0,
    };
  });

  return {
    totalCvrVisits: results?.totalCvrVisits ?? scenarios.reduce((s, x) => s + x.cvrVisits, 0),
    totalApaVisits: results?.totalApaVisits ?? scenarios.reduce((s, x) => s + x.apaVisits, 0),
    totalSwitches: results?.totalSwitches ?? scenarios.reduce((s, x) => s + x.numberOfSwitches, 0),
    vci: results?.vci ?? null,
    stability: results?.stability ?? null,
    performance: results?.performance ?? null,
    scenarios,
    finalResultsKey: BLOCK5_RESULTS_KEY,
  };
}

/** Assembles the full feedback record (does not persist — caller stores it). */
export function assembleFeedbackRecord(args: {
  sessionId: string;
  results: Block5Results | null;
  answers: FeedbackAnswers;
}): FeedbackRecord {
  const scenarioMs = (args.results?.scenarioResults ?? []).map((r) => r.timeMs ?? 0);
  /*
    Assembled HERE, at the last moment before the record is archived, rather than at the Block 4
    boundary where it was originally meant to happen. Building it late costs nothing - it reads
    the same per-block LocalStorage entries either way - and it removes the failure mode where a
    participant who never reached the feedback page left no raw data at all.
  */
  let participant: ParticipantRecord | null = null;
  try {
    participant = buildParticipantRecord(args.sessionId);
  } catch {
    // A malformed block should cost that block, not the whole record.
  }
  return {
    session_id: args.sessionId,
    experiment: EXPERIMENT_ID,
    schemaVersion: FEEDBACK_SCHEMA_VERSION,
    completedAt: new Date().toISOString(),
    timing: buildTimingSummary(scenarioMs),
    block5: buildBlock5Summary(args.results),
    participant,
    block5Full: args.results,
    feedback: args.answers,
  };
}

/**
 * Persists the feedback record to LocalStorage (MongoDB-ready shape):
 *  - `vrds_feedback_record` holds the latest record (per the plan), and
 *  - `vrds_feedback_archive` accumulates every completed record so a shared browser never
 *    loses earlier participants' data on Start-Over.
 */
export function saveFeedbackRecord(record: FeedbackRecord): void {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(record));
  } catch {
    // ignore — storage unavailable
  }
  try {
    const raw = localStorage.getItem(FEEDBACK_ARCHIVE_KEY);
    const archive: FeedbackRecord[] = raw ? (JSON.parse(raw) as FeedbackRecord[]) : [];
    archive.push(record);
    localStorage.setItem(FEEDBACK_ARCHIVE_KEY, JSON.stringify(archive));
  } catch {
    // ignore — archive is best-effort; the latest record above is the primary store
  }
}

/** Reads every archived feedback record on this device (for export to MongoDB later). */
export function getFeedbackArchive(): FeedbackRecord[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_ARCHIVE_KEY);
    return raw ? (JSON.parse(raw) as FeedbackRecord[]) : [];
  } catch {
    return [];
  }
}
