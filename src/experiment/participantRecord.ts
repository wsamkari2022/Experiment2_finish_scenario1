/**
 * participantRecord.ts — ONE object holding everything Blocks 1-4 produced, ready to store.
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * Blocks 1-4 each write their own LocalStorage key, in their own shape, at their own moment:
 *
 *   money_block_results          Block 1 raw thresholds
 *   trolley_block_results        Block 2 raw thresholds
 *   ai_workforce_block_results   Block 3 raw thresholds
 *   block4_reflection_results    Block 4 decisions and vignettes
 *   moral_profile_insights       derived: profile + seed case + scenario context
 *   final_moral_analysis         derived: analysis + the seven-sensitivity tree
 *
 * That is fine for driving the app, but it is six separate documents with no shared envelope,
 * no schema version, and no single moment at which "this participant's pre-Block-5 data is
 * complete". Storing that in a database later would mean six inserts and a join, and any
 * participant who dropped out mid-way would leave a partial, ambiguous set.
 *
 * This module assembles all of it into a SINGLE record with one envelope, built at one
 * well-defined moment: immediately before the participant enters Block 5. That is the natural
 * boundary — everything Blocks 1-4 measure is final by then, and nothing Block 5 does can
 * change it.
 *
 * ============================================================================
 * HOW TO MOVE THIS TO A DATABASE LATER
 * ============================================================================
 * Nothing here talks to a network, by design. The migration is deliberately one function:
 *
 *   1. `buildParticipantRecord()` already returns exactly the document you want to store.
 *      Its shape is stable and versioned (`schemaVersion`).
 *   2. Replace the body of `persistParticipantRecord()` — or add a call beside it — with your
 *      POST. Keep the LocalStorage write as well: it is the offline fallback if the request
 *      fails, and it is what lets you recover a session whose upload did not land.
 *   3. `sessionId` is the join key. It is the same anonymous id every block already stamps on
 *      its own record, so old per-block documents and this consolidated one line up.
 *
 * Suggested collection shape: one document per participant, `_id = sessionId`, upserted. The
 * record is self-describing, so no schema needs to be declared up front.
 *
 * ============================================================================
 * WHAT IS DELIBERATELY NOT IN HERE
 * ============================================================================
 * No credentials, no endpoint, no network code. Adding those is a separate, deliberate step —
 * this module cannot leak data on its own.
 */

import { SESSION_KEY_RESULTS } from "./constants";
import type { MoneyBlockResults } from "./types";
import {
  TROLLEY_RESULTS_STORAGE_KEY,
  type TrolleyBlockResults,
} from "./trolleyTypes";
import {
  AI_WORKFORCE_RESULTS_KEY,
  type AIWorkforceBlockResults,
} from "./aiWorkforceTypes";
import {
  computeAIWorkforceAnalysis,
  type AIWorkforceAnalysis,
} from "./aiWorkforceAnalysis";
import { deriveMoralProfile, type MoralProfile } from "./profileAnalysis";
import { buildThresholdTree, type ThresholdTree } from "./thresholdTree";
import { extractBlock5Profile } from "./block5Profile";
import type { Block5UserProfile } from "./block5Types";
import type { Block4CompletionPayload } from "./AdaptiveStakeholderReflectionBlock";
import type { Block4DecisionRecord } from "./finalAnalysis";
import { SENSITIVITY_CALIBRATION_VERSION } from "./sensitivityCalibration";

/** LocalStorage key holding the consolidated record. One document per participant. */
export const PARTICIPANT_RECORD_KEY = "vrds_participant_record";

/** Where Block 4's payload is kept by ExperimentFlow. */
const BLOCK4_KEY = "block4_reflection_results";

/**
 * Bump when the SHAPE of ParticipantRecord changes — a field added, removed or renamed, or a
 * meaning changed. Analysis code can then tell records apart instead of guessing from content.
 * Changing a formula does not require a bump; changing what is stored does.
 */
// v2 (2026-08-23): the Block 5 performance metrics went from eight keys to five, so any record
// written under v1 carries a different metric shape. See docs/BLOCK5_METRIC_REDESIGN_PLAN.md.
export const PARTICIPANT_RECORD_SCHEMA_VERSION = 2;

/**
 * Everything Blocks 1-4 produced for one participant.
 *
 * RAW and DERIVED are kept separate on purpose. Raw is what the participant actually did and can
 * never be recomputed if lost. Derived is what the model made of it, and CAN be recomputed from
 * raw by re-running the pipeline. Storing both means a future change to a formula can be applied
 * retrospectively to already-collected data — you re-derive rather than re-recruit.
 */
export interface ParticipantRecord {
  schemaVersion: number;
  /** Anonymous session id — the join key across every block and the natural database _id. */
  sessionId: string;
  /** When this consolidated record was assembled (immediately before Block 5). */
  assembledAt: string;
  /**
   * Version of the calibration tables in force when the derived scores were computed. Scores are
   * only comparable across participants who share this value.
   */
  calibrationVersion: string;

  /** RAW — what the participant actually did. Cannot be reconstructed if lost. */
  raw: {
    block1Money: MoneyBlockResults | null;
    block2Trolley: TrolleyBlockResults | null;
    block3AIWorkforce: AIWorkforceBlockResults | null;
    block4Reflection: Block4CompletionPayload | null;
  };

  /** DERIVED — what the model made of the raw answers. Recomputable from `raw`. */
  derived: {
    moralProfile: MoralProfile | null;
    aiWorkforceAnalysis: AIWorkforceAnalysis | null;
    /** The seven sensitivities, ranked — the input Block 5 runs on. */
    thresholdTree: ThresholdTree | null;
    /**
     * The flattened profile Block 5 is actually driven by.
     *
     * Stored even though it is derivable from thresholdTree, because it is the precise input
     * that decided which options each participant saw labelled aligned or misaligned, and which
     * CVR framing and which stakeholder voice they were given. Keeping it means an analyst can
     * reconstruct what a participant was shown without re-running the extraction and hoping it
     * still behaves the way it did on the day.
     */
    block5Profile: Block5UserProfile | null;
  };

  /** Which of the four blocks produced usable results. Lets you filter partial sessions. */
  completeness: {
    block1: boolean;
    block2: boolean;
    block3: boolean;
    block4: boolean;
    /** True only when all four are present — the rows safe to analyse. */
    readyForBlock5: boolean;
  };
}

/** Reads and parses a LocalStorage value; null on anything unexpected. */
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Assembles the record from whatever Blocks 1-4 have written so far.
 *
 * Never throws and never returns null: a participant who dropped out after Block 2 still yields
 * a valid record with `completeness` describing exactly how far they got. Losing partial data
 * because an assembler was strict would be worse than storing it and filtering later.
 *
 * The derived section is computed only when all three threshold blocks are present, because
 * `deriveMoralProfile` needs all three. Block 4 may be missing — the tree is still built, with
 * its Block 4 signals marked unavailable and dropped from the blend (see `blend()`).
 */
export function buildParticipantRecord(sessionId: string): ParticipantRecord {
  const block1Money = readJson<MoneyBlockResults>(SESSION_KEY_RESULTS);
  const block2Trolley = readJson<TrolleyBlockResults>(TROLLEY_RESULTS_STORAGE_KEY);
  const block3AIWorkforce = readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY);
  const block4Reflection = readJson<Block4CompletionPayload>(BLOCK4_KEY);

  const haveThresholdBlocks = !!(block1Money && block2Trolley && block3AIWorkforce);

  let moralProfile: MoralProfile | null = null;
  let aiWorkforceAnalysis: AIWorkforceAnalysis | null = null;
  let thresholdTree: ThresholdTree | null = null;
  let block5Profile: Block5UserProfile | null = null;

  if (haveThresholdBlocks) {
    try {
      moralProfile = deriveMoralProfile(block1Money, block2Trolley, block3AIWorkforce);
      aiWorkforceAnalysis = computeAIWorkforceAnalysis(block3AIWorkforce);
      // Block 4 may legitimately be missing (a participant who stopped before it). The tree is
      // still built: its Block 4 signals are simply marked unavailable and dropped from the
      // blend, rather than being scored zero. See blend() in thresholdTree.ts.
      const noBlock4: Block4DecisionRecord = {
        initialDecision: null, midDecision: null, finalDecision: null, confidence: 3,
      };
      thresholdTree = buildThresholdTree(
        moralProfile,
        block3AIWorkforce,
        block4Reflection?.decisions ?? noBlock4,
      );
      block5Profile = extractBlock5Profile(thresholdTree);
    } catch {
      // A derivation failure must not cost us the raw answers, which are irreplaceable.
      // The record is still returned with derived left null and completeness telling the story.
    }
  }

  return {
    schemaVersion: PARTICIPANT_RECORD_SCHEMA_VERSION,
    sessionId,
    assembledAt: new Date().toISOString(),
    calibrationVersion: SENSITIVITY_CALIBRATION_VERSION,
    raw: { block1Money, block2Trolley, block3AIWorkforce, block4Reflection },
    derived: { moralProfile, aiWorkforceAnalysis, thresholdTree, block5Profile },
    completeness: {
      block1: !!block1Money,
      block2: !!block2Trolley,
      block3: !!block3AIWorkforce,
      block4: !!block4Reflection,
      readyForBlock5: haveThresholdBlocks && !!thresholdTree,
    },
  };
}

/**
 * Stores the record. Today that means LocalStorage; see the header for the database step.
 *
 * Returns the record so a caller can build and store in one expression, and so the eventual
 * network version can return a result without changing any call site.
 */
export function persistParticipantRecord(record: ParticipantRecord): ParticipantRecord {
  try {
    localStorage.setItem(PARTICIPANT_RECORD_KEY, JSON.stringify(record));
  } catch {
    // Quota or a private-browsing block. The per-block keys are already written independently,
    // so nothing is lost that cannot be reassembled by calling buildParticipantRecord again.
  }
  return record;
}

/** Convenience: assemble and store in one call, at the Block 4 → Block 5 boundary. */
export function captureParticipantRecord(sessionId: string): ParticipantRecord {
  return persistParticipantRecord(buildParticipantRecord(sessionId));
}

/** Reads back the stored record, if any. For the export/debug view and for a later upload retry. */
export function readParticipantRecord(): ParticipantRecord | null {
  return readJson<ParticipantRecord>(PARTICIPANT_RECORD_KEY);
}
