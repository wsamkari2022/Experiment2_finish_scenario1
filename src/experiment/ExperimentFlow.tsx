import { useCallback, useEffect, useState } from "react";
import { StartScreen } from "./StartScreen";
import { ConsentPage } from "./ConsentPage";
import { DemographicPage } from "./DemographicPage";
import { STATUS_COMPLETED, STATUS_NOT_COMPLETED } from "./participantDirectory";
/* Every participant write goes through storage.ts, never to the directory or a server directly.
   That is what lets the database be switched on in one place. See the header of storage.ts. */
import {
  flushOutbox,
  resetSyncState,
  restoreParticipantFiles,
  saveCompletion,
  saveParticipant,
  saveProgress,
  syncBlocks,
  syncResumeState,
  useRemoteBackend,
} from "./storage";
import { apiClient, isApiAvailable } from "./apiClient";
import { setActiveStage, startActiveClock, stopActiveClock } from "./activeTime";
import { MoneyThresholdBlock } from "./MoneyThresholdBlock";
import { TrolleyThresholdBlock } from "./TrolleyThresholdBlock";
import { AIWorkforceThresholdBlock } from "./AIWorkforceThresholdBlock";
import { MoralProfileInsightsPage } from "./MoralProfileInsightsPage";
import { AdaptiveStakeholderReflectionBlock } from "./AdaptiveStakeholderReflectionBlock";
import type { Block4CompletionPayload } from "./AdaptiveStakeholderReflectionBlock";
import { FinalMoralAnalysisPage } from "./FinalMoralAnalysisPage";
import { Block5IntroPage } from "./Block5IntroPage";
import { Block5PublicEmergencySimulation } from "./Block5PublicEmergencySimulation";
import { Block5SimulationSummaryPage } from "./Block5SimulationSummaryPage";
import { UserFeedbackPage } from "./UserFeedbackPage";
import { GlobalStepper } from "./GlobalStepper";
import { SHOW_INTER_BLOCK_PAGES } from "./interBlockPages";
import { InterBlockPause } from "./InterBlockPause";
import { captureParticipantRecord } from "./participantRecord";
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
  /* Asks the email, and decides whether this is a new participant or a returning one. Seen only
     when the browser does not already recognise them. */
  | "start"
  /* Informed consent. A participant who has already agreed never returns here: the restored
     stage, or their directory entry, carries them past it. See getRestoredStage. */
  | "consent"
  /* Age, gender and the email that lets a participant return. Follows consent, once. */
  | "demographics"
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
  | "block5_intro"
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
 * localStorage key for the signed consent record.
 *
 * Written once, never cleared by the app. It is what lets a returning participant skip the
 * consent page, and it is the evidence of what they agreed to and when. It moves to MongoDB
 * later; until then this is the only copy, so nothing in the app may delete it.
 */
const STORAGE_KEY_CONSENT = "vrds_consent";
/** localStorage key for the demographic answers, including the return email. */
const STORAGE_KEY_DEMOGRAPHICS = "vrds_demographics";
/**
 * localStorage key for the completion status.
 *
 * Set to NOT_COMPLETED the moment the demographic form is submitted, which is the point a
 * participant exists as a record at all. It is flipped to COMPLETED in exactly one place — after
 * the feedback answers are submitted — and nowhere else may write it.
 */
const STORAGE_KEY_STATUS = "vrds_status";
/**
 * The email of the participant currently being enrolled, held between the start screen and the
 * demographic form so the address is asked for once and confirmed rather than typed twice.
 */
const STORAGE_KEY_PENDING_EMAIL = "vrds_pending_email";

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
    if (!saved) {
      /*
       * Order matters here, and each branch is a real situation:
       *
       *   consent + form done  -> they are enrolled on this browser; the stage key was lost, so
       *                           put them back in the study rather than through the door again.
       *   consent only         -> they agreed and stopped mid-enrolment. Back to the FORM: asking
       *                           for consent a second time would record an agreement they have
       *                           already given.
       *   nothing              -> a browser that does not know them. Ask for the email, which is
       *                           the only thing that can tell a new participant from a returning
       *                           one on a machine with no history.
       */
      if (localStorage.getItem(STORAGE_KEY_DEMOGRAPHICS)) return "money";
      if (localStorage.getItem(STORAGE_KEY_CONSENT)) return "demographics";
      return "start";
    }
    // Never restore to a transition stage — roll back one step
    if (STAGES_WITH_TRANSITION.includes(saved as Stage)) return "money";
    return saved ?? "money";
  } catch {
    return "start";
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

  /**
   * The participant's email once it is known — from the start screen, the demographic form, or a
   * previous visit to this browser. It is the key the participant directory is written under, so
   * without it the run cannot be attached to a person and cannot be resumed elsewhere.
   */
  const [pendingEmail, setPendingEmail] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem(STORAGE_KEY_PENDING_EMAIL) ??
        readJson<{ email?: string }>(STORAGE_KEY_DEMOGRAPHICS)?.email ??
        null
      );
    } catch {
      return null;
    }
  });

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
    /*
     * Mirror the stopping point into the participant directory as well.
     *
     * The line above records where THIS BROWSER is; this one records where the PERSON is. They
     * are the same thing until somebody opens the study on a second machine, and at that moment
     * only the directory can answer "where did I get to?". Writing it on every stage change is
     * what makes the resume accurate rather than approximate — a returning participant lands on
     * the screen they left, not back at the first block.
     */
    if (pendingEmail && stage !== "start" && stage !== "consent" && stage !== "demographics") {
      saveProgress(pendingEmail, stage);
      /*
       * And push whatever the blocks have written since the last screen.
       *
       * A stage change is the natural moment: a block has just finished and saved its results,
       * and the participant is between screens rather than mid-answer. Only blocks whose stored
       * content actually changed are sent, so this is cheap to call on every transition.
       */
      syncBlocks(pendingEmail);
      /*
       * And keep the copy that lets them continue on another machine up to date. A participant
       * never announces that they are leaving — they close the tab — so the most recent stage
       * boundary is the best moment there is.
       */
      syncResumeState(pendingEmail);
    }
  }, [stage, pendingEmail]);

  /*
   * Switch the database on, if it is there.
   *
   * The study is asked to run with or without the API: the researcher tests it without starting
   * the server, and a participant must not be stopped by a server that is down. So the backend is
   * only installed once /api/health answers — until then every write stays local and nothing is
   * queued for a server that does not exist.
   *
   * Once it IS installed, the outbox is flushed: a participant who closed the tab while the API
   * was down comes back with writes still waiting, and this is the moment to deliver them.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const available = await isApiAvailable();
      if (cancelled) return;
      if (available) {
        useRemoteBackend(apiClient);
        void flushOutbox();
        /*
         * Sync immediately, because this effect finishes AFTER the first stage effect has already
         * run. At that earlier moment there was no backend yet, so the sync it attempted did
         * nothing — and without this line the data on screen would not reach the server until the
         * participant happened to change stage. For somebody who opens the study on its last
         * screen and finishes there, that stage change never comes.
         *
         * The email is read from storage rather than from `pendingEmail`, because this callback
         * closed over the value from first render and may be looking at a stale null.
         */
        const email =
          localStorage.getItem(STORAGE_KEY_PENDING_EMAIL) ??
          readJson<{ email?: string }>(STORAGE_KEY_DEMOGRAPHICS)?.email ??
          null;
        syncBlocks(email);
        /* And the copy that carries them to another machine — same reason, same moment. The
           stage effect that normally sends it ran before this backend existed. */
        syncResumeState(email);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * The active-time clock. Started once, then told which screen is showing on every change.
   *
   * It counts only while the participant is really working — see activeTime.ts. The entry screen
   * is excluded because typing an email is not participation; everything from the consent page
   * onwards counts, including reading the consent, which is genuine effort.
   */
  useEffect(() => {
    startActiveClock();
  }, []);

  useEffect(() => {
    setActiveStage(stage === "start" ? "" : stage);
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

  /**
   * Block 4 → Block 5 boundary. THE DATA HAND-OFF POINT.
   *
   * Everything Blocks 1-4 measure is final by the time this runs, and nothing Block 5 does can
   * change it, so this is where the whole participant record is assembled into one document and
   * stored. Today that means LocalStorage; participantRecord.ts documents the single-function
   * change that turns it into a database write.
   *
   * Note this fires whether the Final Analysis page was shown or hidden: in hidden mode the page
   * still mounts, still derives and persists the threshold tree, and then calls this itself.
   *
   * The try/catch is deliberate. A failure to SAVE must never stop a participant from reaching
   * Block 5 — their answers are already written under the per-block keys, so the record can be
   * rebuilt later from the same browser by calling buildParticipantRecord again.
   */
  const handleStartBlock5 = useCallback(() => {
    try {
      captureParticipantRecord(participantId);
    } catch {
      // Storage failures are logged nowhere and blocked nothing, by design.
    }
    setStage("transition_final_block5");
  }, [participantId]);

  /** Intro page -> the scenarios themselves. A button, not a timer: the page is meant to be read. */
  const handleStartBlock5Scenarios = useCallback(() => {
    setStage("block5");
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
      transition_final_block5: "block5_intro",
      transition_block5_summary: "block5_summary",
    };
    const next = transitions[stage];
    if (next) {
      const timer = setTimeout(() => setStage(next), TRANSITION_MS);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  /*
   * Consent comes before every other screen and before the progress rail: the rail describes the
   * study, and at this point the participant has not agreed to take part in it yet.
   *
   * The demographic page (which collects the email) follows this one, and a start screen that
   * asks for the email will eventually sit in FRONT of consent — that is what lets a returning
   * participant be recognised before the consent page is reached, so they never see it twice.
   * Until then, the consent record itself is what keeps them past it.
   */
  /*
   * The door. It asks the email and then decides: a new address goes on to consent, a known and
   * unfinished one resumes after an identity check, and a finished one is stopped.
   *
   * The address is parked in storage rather than only in React state, because the consent page
   * sits between here and the form: a refresh in that gap would otherwise lose it and ask for it
   * a second time.
   */
  if (stage === "start") {
    return (
      <StartScreen
        onNewParticipant={(email) => {
          try {
            localStorage.setItem(STORAGE_KEY_PENDING_EMAIL, email);
          } catch {
            /* Storage unavailable; the form will simply ask for the address again. */
          }
          setPendingEmail(email);
          setStage("consent");
        }}
        onResume={(entry) => {
          /* Rebuild just enough local state for the study to continue, then jump to the stage
             they stopped on. On this machine that stage is usually already present; on a new
             machine the directory is the only thing that knows it. */
          try {
            localStorage.setItem(STORAGE_KEY_PENDING_EMAIL, entry.email);
            if (entry.consent) {
              localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(entry.consent));
            }
            localStorage.setItem(
              STORAGE_KEY_DEMOGRAPHICS,
              JSON.stringify({ email: entry.email, age: entry.age, gender: entry.gender }),
            );
            localStorage.setItem(STORAGE_KEY_STATUS, entry.status);
          } catch {
            /* Storage unavailable; the resume still works for this tab. */
          }
          /*
           * Copy the participant into this browser's own directory.
           *
           * When the entry came from the SERVER, nothing local knows this person yet. Without
           * this, a participant who resumed on a new machine and then lost the server would have
           * no local record to fall back on — their progress would stop being tracked locally,
           * which is exactly the situation the local-first rule exists to prevent. Writing it
           * here makes the browser self-sufficient again from the first moment of the session.
           */
          saveParticipant({
            email: entry.email,
            sessionId: entry.sessionId,
            age: entry.age,
            gender: entry.gender,
            stage: entry.stage,
            consent: entry.consent,
          });
          /* The sync fingerprints in this browser describe whoever used it last, not this
             participant, so forget them and let the next sync re-send from scratch. */
          resetSyncState();
          setPendingEmail(entry.email);

          /*
           * BRING THEIR ANSWERS DOWN BEFORE SHOWING THEM ANYTHING.
           *
           * Everything above restores who they are. None of it restores what they DID, and the
           * later stages refuse to render without it: Block 5 with no profile falls through to
           * `setStage("money")` and the participant starts the whole study again. That is the
           * bug this fixes, and it is why the stage is not set here.
           *
           * The page is reloaded rather than continued, because every one of these files is read
           * once when the app starts. Writing them into storage under a running app would leave
           * it using the empty versions it already loaded. A reload is the only honest way to
           * pick them up, and it is also what makes this safe: nothing half-restored is ever on
           * screen.
           */
          void (async () => {
            const restored = await restoreParticipantFiles(entry.email);
            try {
              localStorage.setItem(STORAGE_KEY_STAGE, entry.stage || "money");
            } catch {
              /* ignore */
            }
            if (restored > 0) {
              window.location.reload();
              return;
            }
            /* Nothing came back — either there is no server, or this participant has nothing
               stored yet. Continue in this tab; the stage guards will place them safely. */
            setStage((entry.stage as Stage) || "money");
          })();
        }}
      />
    );
  }

  if (stage === "consent") {
    return (
      <ConsentPage
        onAgree={(record) => {
          try {
            localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(record));
          } catch {
            /* Storage unavailable (private mode). The study still runs; the record is lost,
               which is why this moves to the database in a later step. */
          }
          setStage("demographics");
        }}
      />
    );
  }

  /*
   * The demographic form. Submitting it is the moment a participant becomes a record: it is where
   * the details arrive, where the status is created as NOT COMPLETED, and where the entry in the
   * participant directory is written — the entry the start screen will find next time.
   *
   * The address comes down from the start screen and is shown locked. It is asked for there, not
   * here, because the start screen has to know it before consent in order to skip consent for
   * somebody who has already agreed.
   */
  if (stage === "demographics") {
    return (
      <DemographicPage
        initialEmail={pendingEmail ?? ""}
        emailLocked={!!pendingEmail}
        onSubmit={(record) => {
          try {
            localStorage.setItem(STORAGE_KEY_DEMOGRAPHICS, JSON.stringify(record));
            localStorage.setItem(STORAGE_KEY_STATUS, STATUS_NOT_COMPLETED);
            localStorage.setItem(STORAGE_KEY_PENDING_EMAIL, record.email);
          } catch {
            /* Storage unavailable; the study still runs. See the note on the consent record. */
          }
          setPendingEmail(record.email);
          saveParticipant({
            email: record.email,
            sessionId: participantId,
            age: record.age,
            gender: record.gender,
            stage: "money",
            consent: readJson<{ agreed: boolean; timestamp: string; version: string }>(
              STORAGE_KEY_CONSENT,
            ),
          });
          setStage("money");
        }}
      />
    );
  }

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

  /*
   * The same pause component the hidden between-block pages render. Sharing one definition is
   * what makes a hidden page indistinguishable from an ordinary transition: the spinner never
   * changes appearance, so there is no visual seam where a summary screen used to be.
   */
  if (STAGES_WITH_TRANSITION.includes(stage)) {
    return <InterBlockPause />;
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
        {/* The stepper is suppressed while this page is hidden: it is sticky and would otherwise
            appear over the pause spinner, showing a phase that is not in the visible bar. */}
        {SHOW_INTER_BLOCK_PAGES && <GlobalStepper stage={stage} />}
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
        {/* Suppressed while hidden — see the note on the insights stage above. */}
        {SHOW_INTER_BLOCK_PAGES && <GlobalStepper stage={stage} />}
        <FinalMoralAnalysisPage
          participantId={participantId}
          profile={insights.profile}
          block4={block4Payload}
          onStartBlock5={handleStartBlock5}
        />
      </>
    );
  }

  /*
   * The doorway into Block 5. It is its own stage rather than a panel inside the simulation so
   * that a refresh lands here cleanly, and so the simulation component keeps one job.
   *
   * It needs no participant data of its own, but it is still gated on insights + block4Payload:
   * without them the block5 branch below would bounce the participant back to the start, and
   * showing "the main study starts now" one click before that happens would be a lie.
   */
  if (stage === "block5_intro" && insights && block4Payload) {
    return (
      <>
        {/* The rail matters most HERE. This is the page that used to read as an arrival. */}
        <GlobalStepper stage={stage} />
        <Block5IntroPage onStart={handleStartBlock5Scenarios} />
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
        /* Read-only. The planner derives its red lines, exchange rates and tolerance from the
           Blocks 1-3 ladder answers held here; nothing in Block 5 writes back to it. */
        moralProfile={insights.profile}
        onComplete={handleBlock5Complete}
      />
    );
  }

  if (stage === "block5_summary" && block5Results) {
    return (
      <>
        <GlobalStepper stage={stage} />
        <Block5SimulationSummaryPage
          results={block5Results}
          onContinueToFeedback={handleContinueToFeedback}
        />
      </>
    );
  }

  if (stage === "feedback") {
    return (
      <>
        <GlobalStepper stage={stage} />
        <UserFeedbackPage
          results={block5Results}
          sessionId={participantId}
          onBack={handleBackToSummary}
          /*
           * THE ONLY PLACE THE STUDY IS MARKED COMPLETE.
           *
           * Not when Block 5 ends, not when the results page is reached — here, once the feedback
           * answers have been accepted. Keeping it to a single call site is what lets
           * "Study Completed" be trusted later: every record carrying it got there the same way.
           */
          onCompleted={() => {
            try {
              localStorage.setItem(STORAGE_KEY_STATUS, STATUS_COMPLETED);
            } catch {
              /* Storage unavailable; the directory write below still records it. */
            }
            /* The clock stops here and never restarts: sitting on the thank-you page, or
               reopening it tomorrow, must not earn a single second more. */
            stopActiveClock();
            if (pendingEmail) {
              saveCompletion(pendingEmail);
              /*
               * One last sync, and the most important one: the feedback answers were written a
               * moment ago, and this is the last screen. Without it the final block would sit in
               * the browser until a stage change that is never coming.
               *
               * Forced, because nothing in the earlier blocks has CHANGED and the ordinary sync
               * only sends what changed — yet the derived sections must be rebuilt here. The study
               * total time is only totalled at this moment, so a headline built when Block 5
               * finished still says total_time_minutes: null.
               */
              syncBlocks(pendingEmail, { force: true });
            }
          }}
        />
      </>
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

  if (stage === "block5_intro" && (!insights || !block4Payload)) {
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

