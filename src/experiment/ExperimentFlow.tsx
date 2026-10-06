import { useCallback, useEffect, useRef, useState } from "react";
import { StartScreen } from "./StartScreen";
import { ConsentPage } from "./ConsentPage";
import { DemographicPage } from "./DemographicPage";
import { STATUS_COMPLETED, STATUS_NOT_COMPLETED, type DirectoryEntry } from "./participantDirectory";
/* Every participant write goes through storage.ts, never to the directory or a server directly.
   That is what lets the database be switched on in one place. See the header of storage.ts. */
import {
  claimThisBrowser,
  connectLate,
  flushOutbox,
  noRemoteBackend,
  releaseConditionArrival,
  resetSyncState,
  restoreParticipantFiles,
  saveCompletion,
  saveParticipant,
  saveProgress,
  serverCheckPlan,
  setRemoteBackend,
  syncBlocks,
  syncResumeState,
} from "./storage";
import { apiClient, isApiAvailable } from "./apiClient";
import {
  checkActiveBrowser, claimTab, getLock, onLockChange, setLock, setProgressSender, watchTabs,
  type LockReason,
} from "./sessionGuard";
import { SessionLockScreen } from "./SessionLockScreen";
import { LandingPage } from "./LandingPage";
import { ProlificStartScreen } from "./ProlificStartScreen";
import {
  browserParticipantKey, doorFromAddress, isProlificKey, keyDoor, keyOfDemographics, makeRoomForAnotherProlificId, prolificParamsFrom,
  readProlificFile, type RecruitmentSource,
} from "./recruitment";
import {
  CONDITION_KEY, clearConditionFromAddress, conditionByNumber, conditionFields, makeConditionFile, readConditionFile,
  savedFrom, showConditionInAddress, writeConditionFile, type ConditionFile,
} from "./conditions";
import {
  claimActiveClockFor, noteNewVisit, setActiveStage, startActiveClock, stopActiveClock,
} from "./activeTime";
import { MoneyThresholdBlock } from "./MoneyThresholdBlock";
import { TrolleyThresholdBlock } from "./TrolleyThresholdBlock";
import { AIWorkforceThresholdBlock } from "./AIWorkforceThresholdBlock";
import { AdaptiveStakeholderReflectionBlock } from "./AdaptiveStakeholderReflectionBlock";
import type { Block4CompletionPayload } from "./AdaptiveStakeholderReflectionBlock";
import { deriveAndSaveInsights, saveFinalAnalysis, type InsightsPayload } from "./interBlockData";
import { AttentionCheckScreen } from "./AttentionCheckScreen";
import { readAttention } from "./attentionChecks";
import { TRANSITION_TARGET, isTransition, stageToSave } from "./flowStages";
import { Block5IntroPage } from "./Block5IntroPage";
import { Block5PublicEmergencySimulation } from "./Block5PublicEmergencySimulation";
import { Block5SimulationSummaryPage } from "./Block5SimulationSummaryPage";
import { UserFeedbackPage } from "./UserFeedbackPage";
import { GlobalStepper } from "./GlobalStepper";
import { InterBlockPause } from "./InterBlockPause";
import { captureParticipantRecord } from "./participantRecord";
import { getSessionId, SESSION_ID_KEY } from "./session";
import { markStage } from "./telemetry";
import { useScrollToTop } from "./useScrollToTop";
import { extractBlock5Profile } from "./block5Profile";
import { buildThresholdTree } from "./thresholdTree";
import { BLOCK5_RESULTS_KEY } from "./block5Types";
import { STAGE_STORAGE_KEY, announceStage } from "./stageSignal";
import {
  consumeLoginKind, markNextLoginAs, noteLogin, recordVisitOutcome, touchSession,
} from "./sessionLog";
import type { Block5Results } from "./block5Types";
import type { TrolleyBlockResults } from "./trolleyTypes";
import type { MoneyBlockResults } from "./types";
import type { AIWorkforceBlockResults } from "./aiWorkforceTypes";
import { AI_WORKFORCE_RESULTS_KEY } from "./aiWorkforceTypes";

/**
 * All stages in the experiment. "transition_*" stages render a loading spinner
 * and auto-advance to the next content stage after TRANSITION_MS milliseconds.
 * They are never persisted to localStorage so a page refresh lands cleanly.
 */
type Stage =
  /* The landing page (since 1 October 2026; LandingPage.tsx): a new browser gets one of the four conditions, the one
     with the fewest people, before anything else. Never saved as a stage: a refresh there simply asks again. */
  | "landing"
  /* Asks the email, and decides whether this is a new participant or a returning one. Seen only
     when the browser does not already recognise them. */
  | "start"
  /* Informed consent. A participant who has already agreed never returns here: the restored
     stage, or their directory entry, carries them past it. See getRestoredStage. */
  | "consent"
  /* Age, gender, country (since 30 September 2026) and the email that lets a participant return. Follows consent, once. */
  | "demographics"
  | "money"
  | "transition_money_trolley"
  | "trolley"
  | "transition_trolley_product"
  | "product"
  /* The "insights" page after Block 3 and the "final_analysis" page after Block 4 were deleted on 29 September
     2026 (the researcher's request). They had been hidden since September and only computed; that work now runs
     in interBlockData.ts when Block 3 and Block 4 finish, so the same files reach the database. */
  | "transition_product_block4"
  | "block4"
  | "transition_block4_block5"
  | "block5_intro"
  | "block5"
  | "transition_block5_summary"
  | "block5_summary"
  | "feedback"
  /* The attention check's own screen right after Block 3 (since 29 September 2026; a question about the part just
     finished since 30 September 2026; attentionChecks.ts). Not a block: never timed, never counted as a rushed block. */
  | "attention_check";

/** Lookup set used to detect whether the current stage is a transient spinner. */
const STAGES_WITH_TRANSITION: Stage[] = [
  "transition_money_trolley",
  "transition_trolley_product",
  "transition_product_block4",
  "transition_block4_block5",
  "transition_block5_summary",
];

/** Where the flow goes after the attention check that follows Block 3 (attentionChecks.ts). */
const AFTER_ATTENTION_CHECK: Stage = "transition_product_block4";

/**
 * A browser that stopped on one of the two deleted pages opens on the stage that followed it. Only a test run can
 * hold one (no real data exists); the files those pages wrote are made again by interBlockData.ts where needed.
 */
const DELETED_STAGE_NEXT: Record<string, Stage> = { insights: "block4", final_analysis: "block5_intro" };

/** Pause (ms) shown on transition spinner screens before advancing. */
const TRANSITION_MS = 900;
/** localStorage key that persists the current non-transition stage across refreshes. Defined in
 *  stageSignal.ts, which is also where anything outside the flow reads it. */
const STORAGE_KEY_STAGE = STAGE_STORAGE_KEY;
/** localStorage key for the InsightsPayload Blocks 4 and 5 are built from (written by interBlockData.ts). */
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

/** The three screens before the study proper: a browser on one of them without a condition sees the landing page. */
const ENTRY_STAGES: string[] = ["start", "consent", "demographics"];

/**
 * Where the landing page leads: back to the entry screen this browser was on (a refresh, or a browser from before
 * 1 October 2026 that had no condition yet), otherwise the start screen.
 */
function stageAfterLanding(): Stage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_STAGE);
    if (saved === "consent" || saved === "demographics") return saved;
    if (!saved && localStorage.getItem(STORAGE_KEY_CONSENT)) return "demographics";
  } catch {
    /* ignore */
  }
  return "start";
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
      /* No condition yet: the landing page first (since 1 October 2026), which then leads on (stageAfterLanding). */
      if (!readConditionFile()) return "landing";
      if (localStorage.getItem(STORAGE_KEY_CONSENT)) return "demographics";
      return "start";
    }
    /* Somebody still on the way in (start, consent, the form) with no condition: the landing page first. */
    if (ENTRY_STAGES.includes(saved) && !readConditionFile()) return "landing";
    /* A pause is never restored as itself: it leads to the part after it (flowStages.ts). This used to send the
       participant back to Block 1; since 30 September 2026 a pause is saved as that next part anyway. */
    if (isTransition(saved)) return stageToSave(saved) as Stage;
    if (DELETED_STAGE_NEXT[saved]) return DELETED_STAGE_NEXT[saved];
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
 * (profile, seedCase, scenarioContext) from Blocks 1-3 through to Block 4 and Block 5.
 *
 * Stage transitions:
 *   money → (transition) → trolley → (transition) → product →
 *   (transition) → block4 → (transition) → block5_intro → block5 → results → feedback
 * with the attention check's screen right after Block 3 (attentionChecks.ts).
 */
export function ExperimentFlow() {
  /*
   * ANOTHER PROLIFIC ID IN THE LINK (since 6 October 2026; recruitment.ts). The link names a Prolific ID and this
   * browser holds a different person's run (a shared computer): that run is set aside BEFORE anything below reads
   * storage, so the newcomer never sees or continues it and gets their own session id. Their unsent saves stay queued,
   * each naming its owner; the browser's list of people and the machine's id stay. Runs once, on the first render.
   */
  useState(() => makeRoomForAnotherProlificId(window.location.search));
  /*
   * A CONDITION FROM THE OTHER DOOR THAT NOBODY OWNS YET (found in the live check, 6 October 2026). A browser that opened
   * the university address got a condition counted among the university's people; if, before anybody was known, it
   * then arrives through Prolific's link, that condition is not theirs to keep: it goes, and the landing page gives one
   * counted among the Prolific people. (Its arrival stops counting after 30 minutes, as any unused arrival does.)
   */
  useState(() => {
    const file = readConditionFile();
    if (!browserParticipantKey() && file && !file.owner && file.recruitmentSource !== "prolific"
        && doorFromAddress(window.location.pathname, window.location.search) === "prolific") {
      try {
        localStorage.removeItem(CONDITION_KEY);
      } catch { /* ignore */ }
    }
    return null;
  });

  /**
   * The unified, anonymous session id for this participant (see session.ts). Generated once and
   * persisted in LocalStorage, so it stays stable across refreshes — giving one id per participant
   * for the whole run. A new participant begins only on Start-Over / Finish (which clears storage).
   * Threaded into every block as `participantId` and stored as `session_id` on the new records.
   */
  const [participantId] = useState<string>(() => getSessionId());

  /** Current stage; restored from localStorage so refresh resumes where the user left off. */
  const [stage, setStage] = useState<Stage>(getRestoredStage);

  /* Where the landing page leads (since 1 October 2026): the start screen, or the entry screen a refresh left. */
  const afterLanding = useRef<Stage>(stageAfterLanding());
  const handleLandingReady = useCallback(() => {
    setStage(afterLanding.current);
  }, []);

  /* The address always shows the saved condition (the researcher's request: he sees which one he is testing). An
     address naming another condition is corrected: the saved one never changes. */
  useEffect(() => {
    showConditionInAddress(readConditionFile());
  }, [stage]);

  /**
   * The participant's email once it is known — from the start screen, the demographic form, or a
   * previous visit to this browser. It is the key the participant directory is written under, so
   * without it the run cannot be attached to a person and cannot be resumed elsewhere.
   */
  const [pendingEmail, setPendingEmail] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem(STORAGE_KEY_PENDING_EMAIL) ??
        keyOfDemographics(readJson(STORAGE_KEY_DEMOGRAPHICS)) ??
        null
      );
    } catch {
      return null;
    }
  });

  /*
   * WHICH DOOR (since 6 October 2026; recruitment.ts): the person's own key decides once it is known. Before that, an
   * address that names the Prolific door (/prolific, or a Prolific ID in the link) wins; then the door the landing page
   * counted them in (the condition file); otherwise the university's.
   */
  const door: RecruitmentSource = pendingEmail
    ? keyDoor(pendingEmail)
    : doorFromAddress(window.location.pathname, window.location.search) === "prolific"
      ? "prolific"
      : readConditionFile()?.recruitmentSource ?? "university";

  /**
   * WAS THIS PARTICIPANT ALREADY KNOWN WHEN THE PAGE LOADED?
   *
   * It is the difference between somebody typing their address into the start screen and somebody
   * opening the study again on a machine that already has their run. Both end with an email in
   * hand a moment later, so by the time the login is recorded the two are indistinguishable —
   * unless the answer is captured at load, which is what this does. Read once, never updated.
   */
  const knownAtPageLoad = useRef(pendingEmail !== null);

  /*
   * ONE PLACE AT A TIME (since 29 September 2026; sessionGuard.ts). This tab claims the study as it opens,
   * so any older tab of this browser locks; and the page follows the lock, which the server sets when
   * another browser or device has taken this participant's record.
   */
  const [lock, setLockState] = useState<LockReason | null>(getLock);
  useEffect(() => {
    claimTab();
    watchTabs();
    return onLockChange(setLockState);
  }, []);

  /* Progress saved inside a block (Block 5 after every scenario, Blocks 2 and 3 as they go) is sent to
     the server as it is made, with the same "is this browser still the active one?" question. */
  useEffect(() => {
    if (!pendingEmail) {
      setProgressSender(null);
      return;
    }
    setProgressSender(() => {
      syncResumeState(pendingEmail);
      void checkActiveBrowser(pendingEmail);
    });
    return () => setProgressSender(null);
  }, [pendingEmail]);

  /*
   * ONE LOGIN ROW PER PAGE LOAD, WRITTEN THE MOMENT A PARTICIPANT IS IDENTIFIED.
   *
   * Not on mount: at mount a first-time visitor has no email, and a row written then would belong
   * to nobody. Not per stage either — noteLogin ignores every call after the first in a load, so
   * this effect can run as often as React likes and still record one sitting. See sessionLog.ts.
   */
  useEffect(() => {
    if (!pendingEmail) return;
    /*
     * THE CLOCK IS CLAIMED BEFORE ANYTHING IS COUNTED. Until 23 September 2026 the active-time
     * ledger belonged to the browser, so a second participant on the same computer inherited the
     * first one's minutes and their finished-study flag, and counted no working time at all. See
     * claimActiveClockFor.
     */
    claimActiveClockFor(pendingEmail);

    const login = noteLogin(
      consumeLoginKind()
        ?? (knownAtPageLoad.current ? "continued_in_this_browser"
          : isProlificKey(pendingEmail) ? "arrived_with_their_prolific_id" : "typed_their_email"),
      stage,
    );
    /* Opening the study on a different machine is a new visit by the study's own rule, and the
       clock cannot see machines. sessionLog can, so it says so. The answer is written back into the
       login row, so a record whose visit count looks wrong says which login produced it. */
    if (login.recorded) {
      const counted = login.browserChanged ? noteNewVisit() : false;
      recordVisitOutcome(counted);
    }
  }, [pendingEmail, stage]);

  /** Profile + seed case data derived when Block 3 finishes (interBlockData.ts); needed by Blocks 4 and 5. */
  const [insights, setInsights] = useState<InsightsPayload | null>(() =>
    readJson<InsightsPayload>(STORAGE_KEY_INSIGHTS),
  );
  /** Block 4 completion data; needed by Block 5. */
  const [block4Payload, setBlock4Payload] =
    useState<Block4CompletionPayload | null>(() =>
      readJson<Block4CompletionPayload>(STORAGE_KEY_BLOCK4),
    );

  /** Block 5 results; loaded from localStorage on mount if already completed. */
  const [block5Results, setBlock5Results] = useState<Block5Results | null>(() =>
    readJson<Block5Results>(BLOCK5_RESULTS_KEY),
  );

  /*
   * Persist stage changes. A PAUSE IS SAVED AS THE PART IT LEADS TO (since 30 September 2026; flowStages.ts): the flow
   * used to save nothing for a pause, so during the 0.9 s after a block finished the saved stage still named that
   * block, whose progress was already deleted, and a refresh then restarted it at its first question. The same stage is
   * not saved twice in a row (the pause and the part after it save the same thing).
   */
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    /* The landing page is never saved: a refresh there asks again, with the same arrival id (LandingPage.tsx). */
    if (stage === "landing") return;
    const saveAs = stageToSave(stage) as Stage;
    const key = `${saveAs}|${pendingEmail ?? ""}`;
    if (lastSaved.current === key) return;
    lastSaved.current = key;
    try {
      localStorage.setItem(STORAGE_KEY_STAGE, saveAs);
    } catch {
      // ignore
    }
    /* Say so out loud, for the parts of the page that live ABOVE the flow and cannot be handed
       this state - today, the light/dark toggle, which stops asking for attention once the
       participant reaches Block 5. See stageSignal.ts. */
    announceStage(saveAs);
    /* Keep this login's row current, so a run abandoned mid-study still records where it got
       to and how long the sitting lasted. See sessionLog.ts. */
    touchSession(saveAs);
    /*
     * Mirror the stopping point into the participant directory as well.
     *
     * The line above records where THIS BROWSER is; this one records where the PERSON is. They
     * are the same thing until somebody opens the study on a second machine, and at that moment
     * only the directory can answer "where did I get to?". Writing it on every stage change is
     * what makes the resume accurate rather than approximate — a returning participant lands on
     * the screen they left, not back at the first block.
     */
    if (pendingEmail && saveAs !== "start" && saveAs !== "consent" && saveAs !== "demographics") {
      /* After every page: is this browser still the one holding the participant's record? */
      void checkActiveBrowser(pendingEmail);
      saveProgress(pendingEmail, saveAs);
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
   *
   * HOW PATIENTLY (since 6 October 2026, the advisor's "multiple sessions safe"; serverCheckPlan in
   * storage.ts): in development the question is asked once, as before. On the live site it is asked
   * again after 1, 2 and 4 seconds, and then every 15 seconds until the server answers: one missed
   * answer used to keep a participant's whole session out of the database. A server that answers
   * LATE is installed by connectLate, which sends the participant's record first.
   */
  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    void (async () => {
      const plan = serverCheckPlan(import.meta.env.PROD);
      let available = await isApiAvailable();
      for (const ms of plan.pausesMs) {
        if (available || cancelled) break;
        await wait(ms);
        if (!cancelled) available = await isApiAvailable();
      }
      if (cancelled) return;
      let late = false;
      if (!available) {
        /* No server: the landing page stops waiting for one. In development it picks a condition at random (since
           1 October 2026); on the live site it offers "Try again" (LandingPage.tsx). */
        noRemoteBackend();
        if (plan.thenEveryMs === null) return;
        while (!available) {
          await wait(plan.thenEveryMs);
          if (cancelled) return;
          available = await isApiAvailable();
        }
        if (cancelled) return;
        late = true;
      }
      /*
       * The email is read from storage rather than from `pendingEmail`, because this callback
       * closed over the value from first render and may be looking at a stale null.
       */
      const email =
        localStorage.getItem(STORAGE_KEY_PENDING_EMAIL) ??
        keyOfDemographics(readJson(STORAGE_KEY_DEMOGRAPHICS)) ??
        null;
      if (late) await connectLate(apiClient, email);
      else setRemoteBackend(apiClient);
      if (cancelled) return;
      void flushOutbox();
      /*
       * Sync immediately, because this effect finishes AFTER the first stage effect has already
       * run. At that earlier moment there was no backend yet, so the sync it attempted did
       * nothing — and without this line the data on screen would not reach the server until the
       * participant happened to change stage. For somebody who opens the study on its last
       * screen and finishes there, that stage change never comes.
       */
      syncBlocks(email);
      /* And the copy that carries them to another machine — same reason, same moment. The
         stage effect that normally sends it ran before this backend existed. */
      syncResumeState(email);
      /* And, as the page opens: is this browser still the one holding the record? (sessionGuard.ts) */
      void checkActiveBrowser(email);
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
    setActiveStage(stage === "start" || stage === "landing" ? "" : stage);
  }, [stage]);

  // Telemetry: time each content stage. Marks "start" when a stage renders and "end" when we
  // leave it (effect cleanup). markStage ignores transition spinners, so only real stages count.
  useEffect(() => {
    markStage(stage, "start");
    return () => markStage(stage, "end");
  }, [stage]);

  // Every stage opens at the top of the page (not wherever the previous stage was scrolled).
  useScrollToTop(stage);

  /**
   * After Block 3: the attention check about the part just finished, unless it is answered already, then on towards
   * Block 4 (attentionChecks.ts; its place is fixed since 30 September 2026).
   */
  const goOnAfterBlock3 = useCallback(() => {
    setStage(readAttention().answers.after_block3 ? AFTER_ATTENTION_CHECK : "attention_check");
  }, []);

  /** Called when Block 1 completes; moves to the transition spinner before Block 2. */
  const handleMoneyContinue = useCallback((_results: MoneyBlockResults) => {
    setStage("transition_money_trolley");
  }, []);

  /** Called when Block 2 completes; moves to the transition spinner before Block 3. */
  const handleTrolleyContinue = useCallback((_results: TrolleyBlockResults) => {
    setStage("transition_trolley_product");
  }, []);

  /**
   * Called when Block 3 completes. Derives what Blocks 4 and 5 are built from and writes the same two files the
   * deleted "insights" page wrote (interBlockData.ts), then moves on towards Block 4.
   */
  const handleProductContinue = useCallback(
    (_results: AIWorkforceBlockResults) => {
      const payload = deriveAndSaveInsights(participantId);
      if (payload) setInsights(payload);
      goOnAfterBlock3();
    },
    [participantId, goOnAfterBlock3],
  );

  /**
   * Called when Block 4 completes. THE DATA HAND-OFF POINT.
   *
   * Persists Block 4's payload (carrying session_id), then writes the after-Block-4 analysis and threshold tree
   * the deleted "final analysis" page used to write (interBlockData.ts), and only then assembles the whole
   * participant record: everything Blocks 1-4 measure is final here, and nothing Block 5 does can change it. The
   * order is the pages' order, so the record reads the analysis file exactly as it did before.
   *
   * The try/catch is deliberate. A failure to SAVE must never stop a participant from reaching Block 5 — their
   * answers are already written under the per-block keys, so the record can be rebuilt later.
   */
  const handleBlock4Continue = useCallback(
    (payload: Block4CompletionPayload) => {
      try {
        localStorage.setItem(STORAGE_KEY_BLOCK4, JSON.stringify(payload));
      } catch {
        // ignore
      }
      setBlock4Payload(payload);
      const profile = insights?.profile ?? readJson<InsightsPayload>(STORAGE_KEY_INSIGHTS)?.profile;
      if (profile) saveFinalAnalysis(profile, payload.decisions);
      try {
        captureParticipantRecord(participantId);
      } catch {
        // Storage failures are logged nowhere and blocked nothing, by design.
      }
      setStage("transition_block4_block5");
    },
    [insights, participantId],
  );

  /** Intro page -> the scenarios themselves. A button, not a timer: the page is meant to be read. */
  const handleStartBlock5Scenarios = useCallback(() => {
    setStage("block5");
  }, []);

  /** Called when every Block 5 scenario is completed. The count lives in block5Scenarios.ts. */
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

  // Auto-advance from each transition stage to its target stage after TRANSITION_MS (the targets: flowStages.ts).
  useEffect(() => {
    const next = isTransition(stage) ? (TRANSITION_TARGET[stage] as Stage) : undefined;
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
  /*
   * LOCKED: THE STUDY IS OPEN SOMEWHERE NEWER (sessionGuard.ts). Nothing else renders, so nothing else can
   * run or write. "Continue here instead" goes back through the email-and-age check (another browser or
   * device), or claims the study for this tab and reloads (another tab of this browser).
   */
  if (lock) {
    return (
      <SessionLockScreen
        reason={lock}
        prolificDoor={door === "prolific"}
        onContinueHere={() => {
          if (lock === "tab") {
            claimTab();
            window.location.reload();
            return;
          }
          setLock(null);
          setStage("start");
        }}
      />
    );
  }

  if (stage === "landing") {
    return <LandingPage onReady={handleLandingReady} door={door} />;
  }

  if (stage === "start") {
    /* The two doors' first pages share these two steps (since 6 October 2026): the key is an email or a Prolific ID. */
    const onNewParticipant = (email: string) => {
      try {
        localStorage.setItem(STORAGE_KEY_PENDING_EMAIL, email);
      } catch {
        /* Storage unavailable; the form will simply ask for the address again. */
      }
      setPendingEmail(email);
      /*
       * THE CONDITION BECOMES THIS PERSON'S (since 1 October 2026). A condition this browser holds for somebody
       * else (a shared computer) is not theirs: it goes, and the landing page gives them their own before consent.
       */
      const file = readConditionFile();
      if (file && file.owner && file.owner !== email.trim().toLowerCase()) {
        try {
          localStorage.removeItem(CONDITION_KEY);
        } catch { /* ignore */ }
        /* The address still names the first person's condition; without this the landing page would take it as a
           tester's choice and never ask the server. */
        clearConditionFromAddress();
        afterLanding.current = "consent";
        setStage("landing");
        return;
      }
      if (file && !file.owner) writeConditionFile({ ...file, owner: email.trim().toLowerCase() });
      setStage("consent");
    };
    const onResume = (entry: DirectoryEntry) => {
      /* Rebuild just enough local state for the study to continue, then jump to the stage
         they stopped on. On this machine that stage is usually already present; on a new
         machine the directory is the only thing that knows it. */
      /*
       * THEIR CONDITION IS THE ONE ON THEIR RECORD (since 1 October 2026; conditions.ts). The landing page gave this
       * browser a new one a moment ago; it is replaced, and its arrival stops counting at once. A record from before
       * conditions existed takes the one this browser holds (the server sets it only on a record that has none).
       */
      const owner = entry.email.trim().toLowerCase();
      const provisional = readConditionFile();
      const saved = entry.condition ? conditionByNumber(entry.condition.number) : null;
      let condition: ConditionFile | null = null;
      if (entry.condition && saved) {
        condition = makeConditionFile(saved, entry.condition.source, null, owner, entry.condition.assignedAt);
        if (provisional?.arrivalId && provisional.owner !== owner) releaseConditionArrival(provisional.arrivalId);
      } else if (provisional && (!provisional.owner || provisional.owner === owner)) {
        condition = { ...provisional, owner };
      }
      if (condition) {
        writeConditionFile(condition);
        showConditionInAddress(condition);
      }
      try {
        localStorage.setItem(STORAGE_KEY_PENDING_EMAIL, entry.email);
        if (entry.consent) {
          localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(entry.consent));
        }
        localStorage.setItem(
          STORAGE_KEY_DEMOGRAPHICS,
          JSON.stringify({
            ...(isProlificKey(entry.email) ? { prolificPid: entry.email, recruitmentSource: "prolific" } : { email: entry.email }),
            age: entry.age, gender: entry.gender,
            ...(entry.country !== undefined ? { country: entry.country, countryCode: entry.countryCode ?? null } : {}),
            ...(typeof entry.englishFirstLanguage === "boolean" ? { englishFirstLanguage: entry.englishFirstLanguage } : {}),
            ...(conditionFields(condition) ?? {}),
          }),
        );
        localStorage.setItem(STORAGE_KEY_STATUS, entry.status);
        /* Their own participant id, not a new one made by this browser (since 29 September 2026). It
           seeds scenario 6's rule order (shuffleForParticipant), so without it the four rules could
           come in another order on a new device, and the blocks would record a second id. */
        if (entry.sessionId) localStorage.setItem(SESSION_ID_KEY, entry.sessionId);
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
      /* The sync fingerprints in this browser describe whoever used it last, not this
         participant, so forget them and let the next sync re-send from scratch. */
      resetSyncState();
      setPendingEmail(entry.email);
      /* Nothing is left locked on this page: it is about to become the active one. */
      setLock(null);

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
        /*
         * THIS BROWSER TAKES THE RECORD FIRST (since 29 September 2026; sessionGuard.ts). The
         * email and age were just checked, so this is the participant. Claimed before anything is
         * written or downloaded: every write from here on is accepted, and any other browser still
         * open on this run is refused from now on and shows "open somewhere else".
         */
        await claimThisBrowser(entry.email, entry.age);
        saveParticipant({
          email: entry.email,
          sessionId: entry.sessionId,
          age: entry.age,
          gender: entry.gender,
          ...(entry.country !== undefined ? { country: entry.country, countryCode: entry.countryCode ?? null } : {}),
          ...(typeof entry.englishFirstLanguage === "boolean" ? { englishFirstLanguage: entry.englishFirstLanguage } : {}),
          condition: savedFrom(condition),
          /* The Prolific door: this link's study and submission ids, else the record's (since 6 October 2026). */
          prolificStudyId: readProlificFile(entry.email)?.studyId ?? entry.prolificStudyId ?? null,
          prolificSessionId: readProlificFile(entry.email)?.sessionId ?? entry.prolificSessionId ?? null,
          stage: entry.stage,
          consent: entry.consent,
        });
        const restored = await restoreParticipantFiles(entry.email);
        try {
          localStorage.setItem(STORAGE_KEY_STAGE, entry.stage || "money");
        } catch {
          /* ignore */
        }
        if (restored > 0) {
          /* Their answers came down from the server, so this browser did not have them: they
             are arriving from somewhere else. Said now, because the reload below makes the
             next load look like any other. See sessionLog.ts. */
          markNextLoginAs("restored_from_another_device");
          window.location.reload();
          return;
        }
        /* Nothing came back — either there is no server, or this participant has nothing
           stored yet. Continue in this tab; the stage guards will place them safely. */
        setStage((entry.stage as Stage) || "money");
      })();
    };
    /* The Prolific door's first page (the researcher's "2-A"): the ID from the link, Start, or Continue with no
       question ("1-A"). The university door's is unchanged. */
    if (door === "prolific") {
      return (
        <ProlificStartScreen
          params={prolificParamsFrom(window.location.search)}
          onNewParticipant={onNewParticipant}
          onResume={onResume}
        />
      );
    }
    return <StartScreen onNewParticipant={onNewParticipant} onResume={onResume} />;
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
        initialEmail={door === "prolific" ? "" : pendingEmail ?? ""}
        emailLocked={!!pendingEmail}
        askEmail={door !== "prolific"}
        onSubmit={(submitted) => {
          /*
           * THE KEY (since 6 October 2026): the email confirmed here, or in the Prolific door (no email question) the
           * Prolific ID the first page brought. Its record names it truthfully (prolificPid, never email) with the door and
           * Prolific's two ids. Without a key there is nobody to save: back to the first page.
           */
          const key = submitted.email ?? pendingEmail;
          if (!key) {
            setStage("start");
            return;
          }
          const prolific = isProlificKey(key) ? readProlificFile(key) : null;
          const record = isProlificKey(key)
            ? { ...submitted, prolificPid: key, recruitmentSource: "prolific" as const,
                prolificStudyId: prolific?.studyId ?? null, prolificSessionId: prolific?.sessionId ?? null }
            : submitted;
          /*
           * "CONDITION NUMBER" AND "CONDITION TYPE" BESIDE THE ANSWERS (the researcher's request, 1 October 2026). Saved,
           * never asked: the participant does not see their condition. The browser's condition becomes theirs here if
           * the start screen did not already make it so.
           */
          const owner = key.trim().toLowerCase();
          let condition = readConditionFile();
          if (condition && condition.owner && condition.owner !== owner) condition = null;
          if (condition && !condition.owner) {
            condition = { ...condition, owner };
            writeConditionFile(condition);
          }
          try {
            localStorage.setItem(STORAGE_KEY_DEMOGRAPHICS, JSON.stringify({ ...record, ...(conditionFields(condition) ?? {}) }));
            localStorage.setItem(STORAGE_KEY_STATUS, STATUS_NOT_COMPLETED);
            localStorage.setItem(STORAGE_KEY_PENDING_EMAIL, key);
          } catch {
            /* Storage unavailable; the study still runs. See the note on the consent record. */
          }
          setPendingEmail(key);
          saveParticipant({
            email: key,
            prolificStudyId: prolific?.studyId ?? null,
            prolificSessionId: prolific?.sessionId ?? null,
            sessionId: participantId,
            age: record.age,
            gender: record.gender,
            country: record.country,
            countryCode: record.countryCode,
            englishFirstLanguage: record.englishFirstLanguage,
            condition: savedFrom(condition),
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
          owner={pendingEmail}
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
          owner={pendingEmail}
        />
      </>
    );
  }

  /*
   * The attention check right after Block 3 (since 29 September 2026; a question about the part just finished since
   * 30 September 2026; attentionChecks.ts). Its own screen, with no progress bar: it is not a part of the study. A
   * refresh or another device lands back here and goes on to Block 4; once answered it is never shown again.
   */
  if (stage === "attention_check") {
    if (readAttention().answers.after_block3) {
      setStage(AFTER_ATTENTION_CHECK);
      return null;
    }
    return <AttentionCheckScreen check="after_block3" onDone={() => setStage(AFTER_ATTENTION_CHECK)} />;
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
        /* The saved progress belongs to this email and is restored only for it (block5Progress.ts). */
        owner={pendingEmail}
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
          /* A finished participant who reloads sees the thank-you screen, never the form again
             (28 September 2026). The status is the one onCompleted below writes. */
          alreadyCompleted={(() => {
            try { return localStorage.getItem(STORAGE_KEY_STATUS) === STATUS_COMPLETED; } catch { return false; }
          })()}
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
  /* Block 4 without its payload in memory: derive it again from the saved Blocks 1-3 answers (what the deleted
     "insights" page did on this path), or start again when those are missing too. */
  if (stage === "block4" && !insights) {
    const payload = deriveAndSaveInsights(participantId);
    if (payload) setInsights(payload);
    else setStage("money");
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

