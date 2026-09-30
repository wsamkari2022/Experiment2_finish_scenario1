/**
 * interBlockData.ts — what the two deleted between-block pages used to compute (since 29 September 2026).
 *
 * WHY THIS FILE EXISTS. The "insights" page (after Block 3) and the post-Block-4 "final analysis" page were
 * hidden from participants since September (interBlockPages.ts), but they still RAN: each mounted behind a
 * pause spinner, computed, saved, and pressed its own Continue button. The researcher asked for both pages to
 * be deleted ("They existed for me to know what exists in my experiment before I connect my work with the
 * database"), on one condition: that all the data stays safe. The data they made is:
 *
 *   after Block 3  the value profile, the Block 4 seed case, the domain, the scenario context and the AI-workforce
 *                  analysis -> `experiment_flow_insights` (what Blocks 4 and 5 are built from) and
 *                  `moral_profile_insights` (-> analysis.post_block3_insights in the database)
 *   after Block 4  the plain-language analysis and the seven-value threshold tree -> `final_moral_analysis`
 *                  (-> analysis.post_block4_final_analysis)
 *
 * The two functions below make EXACTLY those files, with the same library calls, the same fields and in the same
 * order as the pages did, and ExperimentFlow calls them when Block 3 and Block 4 finish. So the database receives
 * what it always received; only the pages and their stages are gone. validate:attention P1 holds the two functions
 * to the pages' recipe on 300 pretend participants, and P2 checks the flow calls them before Block 4 and Block 5.
 */

import { deriveMoralProfile, type MoralProfile } from "./profileAnalysis";
import { computeAIWorkforceAnalysis, type AIWorkforceAnalysis } from "./aiWorkforceAnalysis";
import {
  buildScenarioContext, selectDomain, selectSeedCase, type ScenarioContext, type SeedCase,
} from "./scenarioSelection";
import { generateFinalAnalysis } from "./finalAnalysis";
import { buildThresholdTree } from "./thresholdTree";
import { SESSION_KEY_RESULTS } from "./constants";
import { TROLLEY_RESULTS_STORAGE_KEY, type TrolleyBlockResults } from "./trolleyTypes";
import { AI_WORKFORCE_RESULTS_KEY, type AIWorkforceBlockResults } from "./aiWorkforceTypes";
import type { MoneyBlockResults } from "./types";
import type { Block4DecisionRecord } from "./finalAnalysis";

/** What Blocks 4 and 5 are built from (the payload the insights page used to hand on). */
export interface InsightsPayload {
  profile: MoralProfile;
  seedCase: SeedCase;
  scenarioContext: ScenarioContext;
  analysis: AIWorkforceAnalysis | null;
}

/** The file Blocks 4 and 5 read to continue; travels between browsers (RESUME_FILES). */
export const FLOW_INSIGHTS_KEY = "experiment_flow_insights";
/** The after-Block-3 snapshot (-> analysis.post_block3_insights). */
export const PROFILE_INSIGHTS_KEY = "moral_profile_insights";
/** The after-Block-4 analysis and threshold tree (-> analysis.post_block4_final_analysis). */
export const FINAL_ANALYSIS_KEY = "final_moral_analysis";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full or blocked: the run goes on; the next sync sends what exists */ }
}

/**
 * The derivation itself, pure: Blocks 1-3's answers in, the payload and the after-Block-3 snapshot out.
 * Null when an earlier block's results are missing (the page then showed "We could not load your earlier
 * responses").
 */
export function deriveInsights(
  money: MoneyBlockResults | null, trolley: TrolleyBlockResults | null, aiResults: AIWorkforceBlockResults | null,
  participantId: string, now: Date = new Date(),
): { payload: InsightsPayload; snapshot: Record<string, unknown> } | null {
  if (!money || !trolley || !aiResults) return null;
  const profile = deriveMoralProfile(money, trolley, aiResults);
  const seedCase = selectSeedCase(profile);
  const domain = selectDomain(profile);
  const scenarioContext = buildScenarioContext(profile, domain);
  const analysis = computeAIWorkforceAnalysis(aiResults);
  return {
    payload: { profile, seedCase, scenarioContext, analysis },
    snapshot: { participantId, profile, seedCase, domain: domain.key, generatedAt: now.toISOString() },
  };
}

/** After Block 3: derive from the saved answers, write both files, and return what Block 4 needs. */
export function deriveAndSaveInsights(participantId: string): InsightsPayload | null {
  const made = deriveInsights(
    readJson<MoneyBlockResults>(SESSION_KEY_RESULTS),
    readJson<TrolleyBlockResults>(TROLLEY_RESULTS_STORAGE_KEY),
    readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY),
    participantId,
  );
  if (!made) return null;
  write(PROFILE_INSIGHTS_KEY, made.snapshot);
  write(FLOW_INSIGHTS_KEY, made.payload);
  return made.payload;
}

/** The after-Block-4 file, pure: the profile, Block 3's answers and Block 4's decisions in. */
export function buildFinalAnalysisFile(
  profile: MoralProfile, aiResults: AIWorkforceBlockResults | null, decisions: Block4DecisionRecord,
  now: Date = new Date(),
): Record<string, unknown> {
  const analysis = generateFinalAnalysis(profile, decisions);
  const tree = buildThresholdTree(profile, aiResults, decisions);
  return {
    analysis,
    tentative_style: analysis.tentativeStyle,
    threshold_tree: tree,
    completed_at: now.toISOString(),
  };
}

/** After Block 4: write the final-analysis file (before the participant record is captured, as before). */
export function saveFinalAnalysis(profile: MoralProfile, decisions: Block4DecisionRecord): void {
  write(FINAL_ANALYSIS_KEY, buildFinalAnalysisFile(
    profile, readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY), decisions));
}
