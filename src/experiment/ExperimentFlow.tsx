import { useCallback, useEffect, useState } from "react";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";
import { MoneyThresholdBlock } from "./MoneyThresholdBlock";
import { TrolleyThresholdBlock } from "./TrolleyThresholdBlock";
import { AIWorkforceThresholdBlock } from "./AIWorkforceThresholdBlock";
import { MoralProfileInsightsPage } from "./MoralProfileInsightsPage";
import { AdaptiveStakeholderReflectionBlock } from "./AdaptiveStakeholderReflectionBlock";
import type { Block4CompletionPayload } from "./AdaptiveStakeholderReflectionBlock";
import { FinalMoralAnalysisPage } from "./FinalMoralAnalysisPage";
import { Block5PublicEmergencySimulation } from "./Block5PublicEmergencySimulation";
import { Block5SimulationSummaryPage } from "./Block5SimulationSummaryPage";
import { UserFeedbackPage } from "./UserFeedbackPage";
import { GlobalStepper } from "./GlobalStepper";
import { getSessionId } from "./session";
import { markStage } from "./telemetry";
import { useScrollToTop } from "./useScrollToTop";
import { extractBlock5Profile } from "./block5Profile";
import { buildThresholdTree } from "./thresholdTree";
import { BLOCK5_RESULTS_KEY } from "./block5Types";
import type { Block5Results } from "./block5Types";
import type { TrolleyBlockResults } from "./trolleyTypes";
import type { MoneyBlockResults } from "./types";
import type { AIWorkforceBlockResults } from "./aiWorkforceTypes";
import { AI_WORKFORCE_RESULTS_KEY } from "./aiWorkforceTypes";
import type { AIWorkforceAnalysis } from "./aiWorkforceAnalysis";
import type { MoralProfile } from "./profileAnalysis";
import type {
  ScenarioContext,
  SeedCase,
} from "./scenarioSelection";

/**
 * All stages in the experiment. "transition_*" stages render a loading spinner
 * and auto-advance to the next content stage after TRANSITION_MS milliseconds.
 * They are never persisted to localStorage so a page refresh lands cleanly.
 */
type Stage =
  | "money"
  | "transition_money_trolley"
  | "trolley"
  | "transition_trolley_product"
  | "product"
  | "transition_product_insights"
  | "insights"
  | "transition_insights_block4"
  | "block4"
  | "transition_block4_final"
  | "final_analysis"
  | "transition_final_block5"
  | "block5"
  | "transition_block5_summary"
  | "block5_summary"
  | "feedback";

/** Lookup set used to detect whether the current stage is a transient spinner. */
const STAGES_WITH_TRANSITION: Stage[] = [
  "transition_money_trolley",
  "transition_trolley_product",
  "transition_product_insights",
  "transition_insights_block4",
  "transition_block4_final",
  "transition_final_block5",
  "transition_block5_summary",
];

/** Pause (ms) shown on transition spinner screens before advancing. */
const TRANSITION_MS = 900;
/** localStorage key that persists the current non-transition stage across refreshes. */
const STORAGE_KEY_STAGE = "experiment_flow_stage";
/** localStorage key for the InsightsPayload forwarded from the Insights page to Block 4. */
const STORAGE_KEY_INSIGHTS = "experiment_flow_insights";
/** localStorage key for the completed Block4CompletionPayload. */
const STORAGE_KEY_BLOCK4 = "block4_reflection_results";

/**
 * Payload passed from MoralProfileInsightsPage to Block 4 and onwards.
 * Holds everything Block 4 and FinalMoralAnalysisPage need from Blocks 1–3.
 */
interface InsightsPayload {
  profile: MoralProfile;
  seedCase: SeedCase;
  scenarioContext: ScenarioContext;
  analysis: AIWorkforceAnalysis | null;
}

/** Safely reads and parses a JSON value from localStorage; returns null on any failure. */
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Returns the stage to restore on mount. Rolls back to "money" if localStorage
 * held a transition stage (spinners should never be the restored landing point).
 */
function getRestoredStage(): Stage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_STAGE) as Stage | null;
    if (!saved) return "money";
    // Never restore to a transition stage — roll back one step
    if (STAGES_WITH_TRANSITION.includes(saved as Stage)) return "money";
    return saved ?? "money";
  } catch {
    return "money";
  }
}

/**
 * ExperimentFlow — top-level orchestrator for the four-block experiment.
 *
 * Manages which stage is currently shown, persists the stage in localStorage
 * so a browser refresh returns to the same block, and threads result data
 * (profile, seedCase, scenarioContext) from the Insights page through to
 * Block 4 and the Final Analysis page.
 *
 * Stage transitions:
 *   money → (transition) → trolley → (transition) → product →
 *   (transition) → insights → (transition) → block4 →
 *   (transition) → final_analysis
 */
export function ExperimentFlow() {
  /**
   * The unified, anonymous session id for this participant (see session.ts). Generated once and
   * persisted in LocalStorage, so it stays stable across refreshes — giving one id per participant
   * for the whole run. A new participant begins only on Start-Over / Finish (which clears storage).
   * Threaded into every block as `participantId` and stored as `session_id` on the new records.
   */
  const [participantId] = useState<string>(() => getSessionId());

  /** Current stage; restored from localStorage so refresh resumes where the user left off. */
  const [stage, setStage] = useState<Stage>(getRestoredStage);

  /** Profile + seed case data produced by the Insights page; needed by Block 4. */
  const [insights, setInsights] = useState<InsightsPayload | null>(() =>
    readJson<InsightsPayload>(STORAGE_KEY_INSIGHTS),
  );
  /** Block 4 completion data; needed by FinalMoralAnalysisPage. */
  const [block4Payload, setBlock4Payload] =
    useState<Block4CompletionPayload | null>(() =>
      readJson<Block4CompletionPayload>(STORAGE_KEY_BLOCK4),
    );

  /** Block 5 results; loaded from localStorage on mount if already completed. */
  const [block5Results, setBlock5Results] = useState<Block5Results | null>(() =>
    readJson<Block5Results>(BLOCK5_RESULTS_KEY),
  );

  // Persist stage changes (skip transition stages so a refresh never lands on a spinner)
  useEffect(() => {
    if (STAGES_WITH_TRANSITION.includes(stage)) return;
    try {
      localStorage.setItem(STORAGE_KEY_STAGE, stage);
    } catch {
      // ignore
    }
  }, [stage]);

  // Telemetry: time each content stage. Marks "start" when a stage renders and "end" when we
  // leave it (effect cleanup). markStage ignores transition spinners, so only real stages count.
  useEffect(() => {
    markStage(stage, "start");
    return () => markStage(stage, "end");
  }, [stage]);

  // Every stage opens at the top of the page (not wherever the previous stage was scrolled).
  useScrollToTop(stage);

  /** Called when Block 1 completes; moves to the transition spinner before Block 2. */
  const handleMoneyContinue = useCallback((_results: MoneyBlockResults) => {
    setStage("transition_money_trolley");
  }, []);

  /** Called when Block 2 completes; moves to the transition spinner before Block 3. */
  const handleTrolleyContinue = useCallback((_results: TrolleyBlockResults) => {
    setStage("transition_trolley_product");
  }, []);

  /** Called when Block 3 completes; moves to the transition spinner before Insights. */
  const handleProductContinue = useCallback(
    (_results: AIWorkforceBlockResults) => {
      setStage("transition_product_insights");
    },
    [],
  );

  /** Called when the Insights page is dismissed; persists the payload and moves to Block 4. */
  const handleInsightsContinue = useCallback((payload: InsightsPayload) => {
    try {
      localStorage.setItem(STORAGE_KEY_INSIGHTS, JSON.stringify(payload));
    } catch {
      // ignore
    }
    setInsights(payload);
    setStage("transition_insights_block4");
  }, []);

  /** Called when Block 4 completes; persists the payload (carrying session_id) and moves on. */
  const handleBlock4Continue = useCallback(
    (payload: Block4CompletionPayload) => {
      try {
        localStorage.setItem(STORAGE_KEY_BLOCK4, JSON.stringify(payload));
      } catch {
        // ignore
      }
      setBlock4Payload(payload);
      setStage("transition_block4_final");
    },
    [],
  );

  /** Called when FinalMoralAnalysisPage user clicks "Start main simulation"; advances to Block 5. */
  const handleStartBlock5 = useCallback(() => {
    setStage("transition_final_block5");
  }, []);

  /** Called when all 3 Block 5 scenarios are completed. */
  const handleBlock5Complete = useCallback((results: Block5Results) => {
    setBlock5Results(results);
    setStage("transition_block5_summary");
  }, []);

  /** Results summary → feedback page (direct; it's a deliberate button, not an auto-advance). */
  const handleContinueToFeedback = useCallback(() => {
    setStage("feedback");
  }, []);

  /** Feedback page → back to the results summary. */
  const handleBackToSummary = useCallback(() => {
    setStage("block5_summary");
  }, []);

  // Auto-advance from each transition stage to its target stage after TRANSITION_MS.
  useEffect(() => {
    const transitions: Partial<Record<Stage, Stage>> = {
      transition_money_trolley: "trolley",
      transition_trolley_product: "product",
      transition_product_insights: "insights",
      transition_insights_block4: "block4",
      transition_block4_final: "final_analysis",
      transition_final_block5: "block5",
      transition_block5_summary: "block5_summary",
    };
    const next = transitions[stage];
    if (next) {
      const timer = setTimeout(() => setStage(next), TRANSITION_MS);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  if (stage === "money") {
    return (
      <>
        <GlobalStepper stage={stage} />
        <MoneyThresholdBlock
          participantId={participantId}
          onContinue={handleMoneyContinue}
        />
      </>
    );
  }

  if (STAGES_WITH_TRANSITION.includes(stage)) {
    return (
      <Box
        minH="100vh"
        bg="bg"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={{ base: "4", md: "6" }}
      >
        <VStack gap="4" animationName="fade-in" animationDuration="moderate">
          <Spinner size="lg" color="fg.muted" />
          <Text color="fg.muted" fontSize="lg" fontStyle="italic">
            Moving to the next section...
          </Text>
        </VStack>
      </Box>
    );
  }

  if (stage === "trolley") {
    return (
      <>
        <GlobalStepper stage={stage} />
        <TrolleyThresholdBlock
          participantId={participantId}
          onContinue={handleTrolleyContinue}
        />
      </>
    );
  }

  if (stage === "product") {
    return (
      <>
        <GlobalStepper stage={stage} />
        <AIWorkforceThresholdBlock
          participantId={participantId}
          onContinue={handleProductContinue}
        />
      </>
    );
  }

  if (stage === "insights") {
    return (
      <>
        <GlobalStepper stage={stage} />
        <MoralProfileInsightsPage
          participantId={participantId}
          onContinue={handleInsightsContinue}
        />
      </>
    );
  }

  if (stage === "block4" && insights) {
    return (
      <>
        <GlobalStepper stage={stage} />
        <AdaptiveStakeholderReflectionBlock
          participantId={participantId}
          profile={insights.profile}
          analysis={insights.analysis}
          seedCase={insights.seedCase}
          scenarioContext={insights.scenarioContext}
          onContinue={handleBlock4Continue}
        />
      </>
    );
  }

  if (stage === "final_analysis" && insights && block4Payload) {
    return (
      <>
        <GlobalStepper stage={stage} />
        <FinalMoralAnalysisPage
          participantId={participantId}
          profile={insights.profile}
          block4={block4Payload}
          onStartBlock5={handleStartBlock5}
        />
      </>
    );
  }

  if (stage === "block5" && insights && block4Payload) {
    const aiResults = readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY);
    const tree = buildThresholdTree(insights.profile, aiResults, block4Payload.decisions);
    const userProfile = extractBlock5Profile(tree);
    return (
      <Block5PublicEmergencySimulation
        userProfile={userProfile}
        onComplete={handleBlock5Complete}
      />
    );
  }

  if (stage === "block5_summary" && block5Results) {
    return (
      <Block5SimulationSummaryPage
        results={block5Results}
        onContinueToFeedback={handleContinueToFeedback}
      />
    );
  }

  if (stage === "feedback") {
    return (
      <UserFeedbackPage
        results={block5Results}
        sessionId={participantId}
        onBack={handleBackToSummary}
      />
    );
  }

  // Fallback: if we're on a later stage but required data isn't in memory
  // (e.g., page refresh lost in-memory state), fall back gracefully
  if (stage === "block4" && !insights) {
    setStage("insights");
    return null;
  }

  if (stage === "final_analysis" && (!insights || !block4Payload)) {
    setStage("money");
    return null;
  }

  if (stage === "block5" && (!insights || !block4Payload)) {
    setStage("money");
    return null;
  }

  if (stage === "block5_summary" && !block5Results) {
    setStage("block5");
    return null;
  }

  // Catch-all: if no stage matched (should not happen), reset to start
  setStage("money");
  return null;
}

export default ExperimentFlow;
