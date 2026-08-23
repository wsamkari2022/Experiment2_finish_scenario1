import { useCallback, useEffect, useMemo, useState } from "react";
import { useBlock123Surfaces } from "./block123Theme";
import {
  Badge,
  Box,
  Button,
  Heading,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ProgressBar } from "./ProgressBar";
import { ScenarioImage } from "./ScenarioImage";
import {
  trolleyScenarioImage,
  trolleyScenarioImagesFor,
  TROLLEY_IMAGE_ASPECT,
} from "./scenarioImages";
import { BLOCK2_LEGACY_PAIRED_BRIDGE } from "./blocksLegacyMethodology";
import type { DirectnessDirection } from "./trolleyTypes";
import { TrolleyCompletionScreen } from "./TrolleyCompletionScreen";
import {
  SHOW_INTER_BLOCK_PAGES,
  useAutoAdvance,
} from "./interBlockPages";
import { InterBlockPause } from "./InterBlockPause";
import { GlowSpan } from "./GlowSpan";
import {
  SAVED_LIVES_OPTIONS,
  TROLLEY_RESULTS_STORAGE_KEY,
  type BridgeAction,
  type BridgeThresholdResult,
  type LeverAction,
  type LeverThresholdResult,
  type TrolleyAction,
  type TrolleyBlockResults,
  type TrolleyBlockSummary,
  type TrolleyChoiceRecord,
  type TrolleyPhase,
} from "./trolleyTypes";

/** Delay (ms) used for meaningful phase transitions and summary transitions — long enough for the user to read the message. */
const TRANSITION_MS = 900;
/** Delay (ms) used when simply advancing to the next index within a phase — kept short so the escalation feels snappy. */
const QUICK_ADVANCE_MS = 300;

/** Tracks all mutable state for an in-progress trolley block session. */
interface InProgressState {
  /** Which scenario phase is currently active: "lever", "bridge", or "complete". */
  currentPhase: TrolleyPhase;
  /** Index into SAVED_LIVES_OPTIONS for the number of lives currently being presented. */
  currentSavedLivesIndex: number;
  /** Index at which the participant first accepted the lever scenario (pulled); null if not yet accepted. */
  leverAcceptedIndex: number | null;
  /** The lives value at which the participant accepted the lever scenario; null if not yet accepted. */
  leverAcceptedValue: number | null;
  /** The index at which the bridge phase started — always equal to leverAcceptedIndex to ensure paired comparison. */
  bridgeStartIndex: number | null;
  /** Index at which the participant first accepted the bridge scenario (pushed); null if not yet accepted. */
  bridgeAcceptedIndex: number | null;
  /** The lives value at which the participant accepted the bridge scenario; null if not yet accepted. */
  bridgeAcceptedValue: number | null;
  /** True when the participant rejected every lever option — no threshold found within the defined range. */
  leverBeyondRange: boolean;
  /** True when the participant rejected every bridge option — no threshold found within the defined range. */
  bridgeBeyondRange: boolean;
  /** Ordered log of every individual choice made during the session, used for detailed analysis. */
  trolleyChoiceHistory: TrolleyChoiceRecord[];
}

/** Starting state: begin in the lever phase at the lowest index with no recorded thresholds. */
const INITIAL_STATE: InProgressState = {
  currentPhase: "lever",
  currentSavedLivesIndex: 0,
  leverAcceptedIndex: null,
  leverAcceptedValue: null,
  bridgeStartIndex: null,
  bridgeAcceptedIndex: null,
  bridgeAcceptedValue: null,
  leverBeyondRange: false,
  bridgeBeyondRange: false,
  trolleyChoiceHistory: [],
};

interface TrolleyThresholdBlockProps {
  participantId?: string;
  onContinue?: (results: TrolleyBlockResults) => void;
}

export function TrolleyThresholdBlock({
  participantId,
  onContinue,
}: TrolleyThresholdBlockProps) {
  const surf = useBlock123Surfaces(); // coordinated light-mode surfaces (dark unchanged)
  /** Core session state machine — updated on every choice. */
  const [state, setState] = useState<InProgressState>(INITIAL_STATE);
  /** Whether the full block (both phases) has been completed and results are ready. */
  const [trolleyBlockCompleted, setTrolleyBlockCompleted] = useState(false);
  /** Frozen results object produced by completeTrolleyBlock; passed to the completion screen. */
  const [finalResults, setFinalResults] =
    useState<TrolleyBlockResults | null>(null);
  /** Guards against double-submissions: true while an animated transition delay is in progress. */
  const [isTransitioning, setIsTransitioning] = useState(false);
  /** Optional message shown during transition delays in place of the scenario text. */
  const [transitionMessage, setTransitionMessage] = useState<string | null>(
    null,
  );

  /** Convenience alias for the lives count currently on screen. */
  const currentValue = SAVED_LIVES_OPTIONS[state.currentSavedLivesIndex];

  /**
   * Illustration for the current (phase, lives) pair, or null when the phase has no artwork —
   * in which case the question renders full-width and centred, as it did before illustrations.
   */
  const scenarioImageSrc = trolleyScenarioImage(state.currentPhase, currentValue);
  /** Each phase keeps its own native frame shape — see TROLLEY_IMAGE_ASPECT for why. */
  const scenarioImageAspect = TROLLEY_IMAGE_ASPECT[state.currentPhase] ?? 4 / 3;

  /**
   * Preload every illustration for the current phase as soon as the phase opens.
   *
   * The set is ~290 KB per phase, so fetching it up front is cheap and it makes the picture
   * swap between rungs a cache hit rather than a network round trip. Without it the participant
   * would see a blank frame for a moment on each choice, which reads as lag at exactly the
   * point where their answer is being recorded.
   */
  useEffect(() => {
    const sources = trolleyScenarioImagesFor(state.currentPhase, SAVED_LIVES_OPTIONS);
    const preloaded = sources.map((src) => {
      const img = new window.Image();
      img.src = src;
      return img;
    });
    return () => { preloaded.length = 0; };
  }, [state.currentPhase]);


  // Refs used to detect whether a value change is a genuine within-phase increment
  // or an artifact of a phase transition resetting the index.
  /** The lives count shown last render, for detecting a change. */
  const [prevValue, setPrevValue] = useState(currentValue);
  /** The phase shown last render, for detecting a scenario change. */
  const [prevPhase, setPrevPhase] = useState<string>(state.currentPhase);
  /**
   * Glow counter.
   *
   * Plain STATE, not a ref. It is read during render (passed to GlowSpan as its `key`, which is
   * what replays the highlight animation), and a value that render depends on is state by
   * definition — React does not re-render when a ref is mutated, which is why the earlier
   * ref-based version needed a dummy `forceGlowRender` state alongside it purely to schedule
   * the render. Using state directly does the same job in one step.
   *
   * Behaviour is unchanged: the same integer sequence reaches GlowSpan, at the same moments.
   */
  const [valueGlowKey, setValueGlowKey] = useState(0);
  /**
   * Bumped when the block moves from the lever scenario to the bridge scenario, so the ACTION
   * phrase ("pull a lever" / "pushing … off a bridge") lights up. That phrase is what actually
   * distinguishes the two scenarios, so it is Block 2's equivalent of the context phrase that
   * glows in Block 1 when the money scenario changes location.
   */
  const [phaseGlowKey, setPhaseGlowKey] = useState(0);

  /**
   * Glow bookkeeping — done DURING RENDER, not in an effect.
   *
   * This is React's documented "adjusting state when a prop changes" pattern: compare the value
   * this render against the value last render, and if it moved, bump the counter immediately.
   * Setting state during render of the SAME component is legal and cheap — React throws the
   * in-progress render away and re-runs it before committing anything to the DOM, so the
   * participant never sees an intermediate frame.
   *
   * It replaces an effect that did the same comparison after paint. That version worked, but it
   * committed one render with the new value and the OLD glow counter, then a second render to
   * correct it — the extra pass `react-hooks/set-state-in-effect` warns about. Doing it during
   * render means the counter is already right in the first committed frame.
   *
   * The "previous" trackers must be state rather than refs for the same reason the counters
   * are: a ref cannot be written during render. Each is seeded with the CURRENT value, so
   * nothing glows on first mount — there is no earlier question to contrast against.
   */
  /*
   * The glow animations tell the participant what changed between the previous question and
   * this one:
   *   - the COUNT glows whenever the number of people at stake changes;
   *   - the ACTION phrase glows when the scenario itself changes (lever → bridge).
   *
   * HISTORY: the count used to be suppressed on a phase change, via a `!phaseChanged` guard.
   * That was correct under the ORIGINAL methodology, where the bridge phase opened at the rung
   * the lever was accepted at — the count could shift there for procedural reasons rather than
   * because the participant had escalated, and glowing would have been misleading. Under the
   * current methodology the bridge restarts at 1, so the count genuinely changes and the
   * participant is genuinely entering a new scenario; both facts are worth showing. The guard
   * was therefore removed and a second counter added for the scenario itself.
   */
  if (prevValue !== currentValue || prevPhase !== state.currentPhase) {
    if (prevValue !== currentValue) setValueGlowKey((n) => n + 1);
    if (prevPhase !== state.currentPhase) setPhaseGlowKey((n) => n + 1);
    setPrevValue(currentValue);
    setPrevPhase(state.currentPhase);
  }

  /**
   * Assembles the final TrolleyBlockResults from the completed session state.
   *
   * Key derived metric — directnessGap = bridgeAcceptedValue − leverAcceptedValue:
   *   - 0  → participant pushed at the exact same number they pulled (no directness effect)
   *   - >0 → participant required more lives to be at stake before accepting the direct action
   *   - null → bridge was never accepted or lever was never accepted
   *
   * Also computes consistencyAtSameNumber (whether bridge threshold === lever threshold)
   * and persists results to localStorage for recovery.
   */
  const completeTrolleyBlock = useCallback(
    (finalState: InProgressState) => {
      const leverThreshold: LeverThresholdResult = {
        scenarioType: "lever",
        accepted: finalState.leverAcceptedIndex != null,
        thresholdSavedLives: finalState.leverAcceptedValue,
        thresholdIndex: finalState.leverAcceptedIndex,
        thresholdBeyondRange: finalState.leverBeyondRange,
      };

      // Was the bridge phase actually presented to this participant?
      //   CURRENT  — always, so a bridge result is always produced.
      //   ORIGINAL — only when the lever had been accepted; refusers produced no bridge row.
      const bridgePhaseRan = BLOCK2_LEGACY_PAIRED_BRIDGE
        ? finalState.leverAcceptedIndex != null
        : finalState.bridgeStartIndex != null;

      let bridgeThreshold: BridgeThresholdResult | null = null;
      if (bridgePhaseRan) {
        const bridgeAccepted = finalState.bridgeAcceptedIndex != null;
        const leverValue = finalState.leverAcceptedValue;
        const bridgeValue = finalState.bridgeAcceptedValue;
        const consistencyAtSameNumber = bridgeAccepted
          ? bridgeValue === leverValue
          : false;
        // Gap in LIVES. Signed: negative means the participant pushed at a LOWER number
        // than they pulled — impossible under the original design, measurable under this one.
        const directnessGap =
          bridgeAccepted && bridgeValue != null && leverValue != null
            ? bridgeValue - leverValue
            : null;
        // Gap in ladder RUNGS. Preferred for analysis: the lives ladder runs 1 → 10,000, so
        // differences in lives are wildly non-linear, whereas rungs are evenly spaced.
        //
        // Computed from COMPARABLE indices — a phase that was refused at every rung counts as
        // SAVED_LIVES_OPTIONS.length, the same "never accepted" sentinel used by
        // toTrolleyComparableIndex / toBridgeComparableIndex and by the Directness sensitivity
        // in thresholdTree.ts. Using the raw accepted indices instead would throw away the most
        // striking pattern this redesign makes visible: a participant who refuses the lever at
        // every rung but WILL push at a low one. That is a strong reverse-directness finding,
        // and it must not be filed as "incomplete" just because one phase has no accepted value.
        const leverComparable =
          finalState.leverAcceptedIndex ?? SAVED_LIVES_OPTIONS.length;
        const bridgeComparable =
          finalState.bridgeAcceptedIndex ?? SAVED_LIVES_OPTIONS.length;
        const directnessGapIndex = bridgeComparable - leverComparable;
        // The sign of the gap, recorded as a label so no downstream analysis has to
        // reconstruct it — and so it survives the ABSOLUTE VALUE taken by the Directness
        // sensitivity formula in thresholdTree.ts (see blocksLegacyMethodology.ts).
        //   "aversion" — needed MORE lives at stake to push than to pull (the classic result)
        //   "reverse"  — needed FEWER; only observable now that the phases are independent
        //   "none"     — identical thresholds, including "refused both phases entirely"
        const directnessDirection: DirectnessDirection =
          directnessGapIndex > 0
            ? "aversion"
            : directnessGapIndex < 0
              ? "reverse"
              : "none";
        bridgeThreshold = {
          scenarioType: "bridge",
          accepted: bridgeAccepted,
          thresholdSavedLives: finalState.bridgeAcceptedValue,
          thresholdIndex: finalState.bridgeAcceptedIndex,
          thresholdBeyondRange: finalState.bridgeBeyondRange,
          startedAtSameValueAsLever:
            finalState.bridgeStartIndex != null
              ? SAVED_LIVES_OPTIONS[finalState.bridgeStartIndex]
              : null,
          consistencyAtSameNumber: bridgeAccepted
            ? consistencyAtSameNumber
            : false,
          directnessGap,
          directnessGapIndex,
          directnessDirection,
        };
      }

      const summary: TrolleyBlockSummary = {
        leverAcceptedValue: finalState.leverAcceptedValue,
        bridgeAcceptedValue: finalState.bridgeAcceptedValue,
        consistencyAtSameNumber: bridgeThreshold
          ? bridgeThreshold.consistencyAtSameNumber
          : null,
        directnessGap: bridgeThreshold ? bridgeThreshold.directnessGap : null,
        directnessGapIndex: bridgeThreshold ? bridgeThreshold.directnessGapIndex : null,
        directnessDirection: bridgeThreshold
          ? bridgeThreshold.directnessDirection
          : "incomplete",
      };

      const results: TrolleyBlockResults = {
        participantId,
        completed: true,
        completedAt: new Date().toISOString(),
        leverThreshold,
        bridgeThreshold,
        summary,
        history: finalState.trolleyChoiceHistory,
      };

      try {
        localStorage.setItem(TROLLEY_RESULTS_STORAGE_KEY, JSON.stringify(results));
      } catch {
        // ignore
      }

      setFinalResults(results);
      setTrolleyBlockCompleted(true);
    },
    [participantId],
  );

  /**
   * State-machine handler for lever-phase choices.
   *
   * - "pull"         → records lever threshold, transitions to bridge phase starting at rung 0
   *                    (ORIGINAL methodology: starting at the same
   *                    index so the two scenarios are directly comparable.
   * - "do_not_pull"  → escalates to the next index; if already at the last index, marks
   *                    leverBeyondRange and completes the block without entering the bridge phase.
   */
  const handleLeverChoice = useCallback(
    (action: LeverAction) => {
      if (isTransitioning || trolleyBlockCompleted) return;

      const index = state.currentSavedLivesIndex;
      const value = SAVED_LIVES_OPTIONS[index];
      const record: TrolleyChoiceRecord = {
        phase: "lever",
        savedLivesIndex: index,
        savedLivesValue: value,
        action,
        timestamp: new Date().toISOString(),
      };
      const updatedHistory = [...state.trolleyChoiceHistory, record];

      if (action === "pull") {
        // Move to the bridge phase.
        //   CURRENT  — the bridge walks the ladder independently, from rung 0, so its
        //              threshold may land above, equal to, or below the lever's.
        //   ORIGINAL — the bridge opened at the rung the lever was accepted at, which made
        //              a bridge threshold below the lever's structurally impossible.
        // See blocksLegacyMethodology.ts to switch back.
        const bridgeStart = BLOCK2_LEGACY_PAIRED_BRIDGE ? index : 0;
        const nextState: InProgressState = {
          ...state,
          currentPhase: "bridge",
          leverAcceptedIndex: index,
          leverAcceptedValue: value,
          bridgeStartIndex: bridgeStart,
          currentSavedLivesIndex: bridgeStart,
          trolleyChoiceHistory: updatedHistory,
        };
        setState(nextState);
        setIsTransitioning(true);
        setTransitionMessage(
          BLOCK2_LEGACY_PAIRED_BRIDGE
            ? "Lever threshold recorded. Testing the bridge version at the same number..."
            : "Lever threshold recorded. Now the same question in a different form...",
        );
        setTimeout(() => {
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
      }

      // Rejected: try the next (higher) value, or handle the exhausted ladder.
      const nextIndex = index + 1;
      if (nextIndex >= SAVED_LIVES_OPTIONS.length) {
        // The participant refused the lever at all 8 rungs.
        //   ORIGINAL — the block ended here and the bridge phase never ran, so these
        //              participants produced no bridge data at all.
        //   CURRENT  — the bridge phase still runs, independently, from rung 0. This is the
        //              only way to learn whether someone who will not pull a lever would
        //              nonetheless push a person, which is a real and interesting pattern.
        if (BLOCK2_LEGACY_PAIRED_BRIDGE) {
          const finalState: InProgressState = {
            ...state,
            currentPhase: "complete",
            leverBeyondRange: true,
            trolleyChoiceHistory: updatedHistory,
          };
          setState(finalState);
          setIsTransitioning(true);
          setTransitionMessage(
            "No acceptance threshold found in the lever scenario. Moving to summary...",
          );
          setTimeout(() => {
            completeTrolleyBlock(finalState);
            setIsTransitioning(false);
            setTransitionMessage(null);
          }, TRANSITION_MS);
          return;
        }

        const nextState: InProgressState = {
          ...state,
          currentPhase: "bridge",
          leverBeyondRange: true,
          bridgeStartIndex: 0,
          currentSavedLivesIndex: 0,
          trolleyChoiceHistory: updatedHistory,
        };
        setState(nextState);
        setIsTransitioning(true);
        setTransitionMessage(
          "No acceptance threshold found in the lever scenario. Now the same question in a different form...",
        );
        setTimeout(() => {
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
      }

      const nextState: InProgressState = {
        ...state,
        currentSavedLivesIndex: nextIndex,
        trolleyChoiceHistory: updatedHistory,
      };
      setIsTransitioning(true);
      setTimeout(() => {
        setState(nextState);
        setIsTransitioning(false);
      }, QUICK_ADVANCE_MS);
    },
    [state, isTransitioning, trolleyBlockCompleted, completeTrolleyBlock],
  );

  /**
   * State-machine handler for bridge-phase choices.
   *
   * - "push"         → records bridge threshold and completes the block.
   * - "do_not_push"  → escalates to the next index; if already at the last index, marks
   *                    bridgeBeyondRange and completes the block.
   */
  const handleBridgeChoice = useCallback(
    (action: BridgeAction) => {
      if (isTransitioning || trolleyBlockCompleted) return;

      const index = state.currentSavedLivesIndex;
      const value = SAVED_LIVES_OPTIONS[index];
      const record: TrolleyChoiceRecord = {
        phase: "bridge",
        savedLivesIndex: index,
        savedLivesValue: value,
        action,
        timestamp: new Date().toISOString(),
      };
      const updatedHistory = [...state.trolleyChoiceHistory, record];

      if (action === "push") {
        // Accepted: record threshold and finalize the block.
        const finalState: InProgressState = {
          ...state,
          currentPhase: "complete",
          bridgeAcceptedIndex: index,
          bridgeAcceptedValue: value,
          trolleyChoiceHistory: updatedHistory,
        };
        setState(finalState);
        setIsTransitioning(true);
        setTransitionMessage("Bridge response recorded. Preparing summary...");
        setTimeout(() => {
          completeTrolleyBlock(finalState);
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
      }

      // Rejected: try the next (higher) value, or close out if exhausted.
      const nextIndex = index + 1;
      if (nextIndex >= SAVED_LIVES_OPTIONS.length) {
        const finalState: InProgressState = {
          ...state,
          currentPhase: "complete",
          bridgeBeyondRange: true,
          trolleyChoiceHistory: updatedHistory,
        };
        setState(finalState);
        setIsTransitioning(true);
        setTransitionMessage(
          "You rejected every bridge value. Moving to summary...",
        );
        setTimeout(() => {
          completeTrolleyBlock(finalState);
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
      }

      const nextState: InProgressState = {
        ...state,
        currentSavedLivesIndex: nextIndex,
        trolleyChoiceHistory: updatedHistory,
      };
      setIsTransitioning(true);
      setTimeout(() => {
        setState(nextState);
        setIsTransitioning(false);
      }, QUICK_ADVANCE_MS);
    },
    [state, isTransitioning, trolleyBlockCompleted, completeTrolleyBlock],
  );

  /** Forwards the completed results to the parent and logs for debugging. */
  const handleContinue = useCallback(() => {
    if (!finalResults) return;
    console.log("Trolley block results:", finalResults);
    onContinue?.(finalResults);
  }, [finalResults, onContinue]);

  /**
   * HIDDEN COMPLETION SCREEN — presses Continue automatically.
   *
   * Placed AFTER the effect that writes this block's results to LocalStorage, so the save is
   * guaranteed to have happened before the flow advances (effects run in declaration order).
   * When SHOW_INTER_BLOCK_PAGES is true this never fires and the summary screen is shown as
   * originally built. See interBlockPages.ts.
   */
  useAutoAdvance(!SHOW_INTER_BLOCK_PAGES && trolleyBlockCompleted && !!finalResults, handleContinue);

  /** Human-readable label for the phase badge — shown in the UI to orient the participant. */
  const phaseBadgeLabel =
    state.currentPhase === "bridge" ? "Bridge scenario" : "Lever scenario";
  /** Colour palette for the phase badge: blue for lever, orange for bridge. */
  const phaseBadgePalette =
    state.currentPhase === "bridge" ? "orange" : "blue";

  /**
   * Renders the scenario prompt text appropriate for the current phase.
   *
   * Two things can glow. The people-count figure is keyed to valueGlowKey and lights up green
   * whenever the number changes. The action phrase — "pull a lever" or "pushing … off a
   * bridge" — is keyed to phaseGlowKey and lights up when the scenario changes, in the colour
   * that already identifies that scenario (blue for the lever, yellow for the bridge).
   */
  const scenarioElements = useMemo(() => {
    if (state.currentPhase === "lever") {
      return (
        <Text
          fontSize={{ base: "xl", md: "2xl" }}
          color="fg"
          lineHeight="tall"
        >
          A runaway trolley is heading toward{" "}
          <GlowSpan glowKey={valueGlowKey} glowColor="green.400" fontWeight="bold" color="green.400">
            {currentValue.toLocaleString()}{" "}
            {currentValue === 1 ? "person" : "people"}
          </GlowSpan>
          . You can{" "}
          <GlowSpan glowKey={phaseGlowKey} glowColor="blue.400" fontWeight="bold" color="blue.400">
            pull a lever
          </GlowSpan>{" "}
          to redirect it onto another track, where it will kill{" "}
          <Text as="span" fontWeight="semibold" color="red.400">
            1 person
          </Text>{" "}
          instead. What would you do?
        </Text>
      );
    }
    if (state.currentPhase === "bridge") {
      return (
        <Text
          fontSize={{ base: "xl", md: "2xl" }}
          color="fg"
          lineHeight="tall"
        >
          A runaway trolley is heading toward{" "}
          <GlowSpan glowKey={valueGlowKey} glowColor="green.400" fontWeight="bold" color="green.400">
            {currentValue.toLocaleString()}{" "}
            {currentValue === 1 ? "person" : "people"}
          </GlowSpan>
          . You can stop it only by{" "}
          <GlowSpan glowKey={phaseGlowKey} glowColor="yellow.400" fontWeight="bold" color="yellow.400">
            pushing
          </GlowSpan>{" "}
          <Text as="span" fontWeight="semibold" color="red.400">
            1 person
          </Text>{" "}
          <GlowSpan glowKey={phaseGlowKey} glowColor="yellow.400" fontWeight="bold" color="yellow.400">
            off a bridge
          </GlowSpan>
          , causing that person's death. What would you do?
        </Text>
      );
    }
    return null;
  }, [state.currentPhase, currentValue, valueGlowKey, phaseGlowKey]);

  /*
   * Hidden mode: skip this block's summary screen and show the same pause the flow itself uses,
   * so the participant sees one continuous spinner into the next block rather than a flash of a
   * summary they were not meant to read. useAutoAdvance above is what moves us on.
   */
  if (trolleyBlockCompleted && finalResults && !SHOW_INTER_BLOCK_PAGES) {
    return <InterBlockPause />;
  }

  if (trolleyBlockCompleted && finalResults) {
    return (
      <Box
        minH="100vh"
        bg={surf.pageBg}
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={{ base: "4", md: "6" }}
        py="12"
      >
        <Box
          w="full"
          maxW="3xl"
          bg={surf.cardBg}
          borderWidth="1px"
          borderColor="border"
          shadow="lg"
          rounded="2xl"
          p={{ base: "6", md: "10" }}
        >
          <TrolleyCompletionScreen
            results={finalResults}
            onContinue={handleContinue}
          />
        </Box>
      </Box>
    );
  }

  const leverButtons: { key: LeverAction; label: string }[] = [
    { key: "pull", label: "Pull the lever" },
    { key: "do_not_pull", label: "Do not pull the lever" },
  ];
  const bridgeButtons: { key: BridgeAction; label: string }[] = [
    { key: "push", label: "Push the person" },
    { key: "do_not_push", label: "Do not push" },
  ];

  return (
    <Box
      minH="100vh"
      bg={surf.pageBg}
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={{ base: "4", md: "6" }}
      py="12"
    >
      <Box
        w="full"
        maxW="3xl"
        bg={surf.cardBg}
        borderWidth="1px"
        borderColor="border"
        shadow="lg"
        rounded="2xl"
        p={{ base: "6", md: "10" }}
      >
        <VStack gap="8" align="stretch">
          {/*
            * Progress bar — same convention as Block 1 (MoneyThresholdBlock): the bar shows the
            * participant's position on the ESCALATION LADDER for the sub-scenario they are
            * currently answering, and it restarts whenever a new sub-scenario begins. Block 1
            * resets it at each of its three money contexts; Block 2 resets it when the lever
            * phase hands over to the bridge phase.
            *
            * The reset is intentional and is the honest picture: the bridge phase really does
            * begin again at 1 person under the current methodology, so a bar that kept climbing
            * across both phases would imply the two ladders are one continuous scale.
            */}
          <ProgressBar
            total={SAVED_LIVES_OPTIONS.length}
            current={state.currentSavedLivesIndex}
          />

          <VStack gap="3" textAlign="center">
            <Heading
              size="xl"
              color="fg"
              fontWeight="semibold"
              letterSpacing="tight"
            >
              Trolley Problem Decisions
            </Heading>
            <Badge
              colorPalette={phaseBadgePalette}
              variant="subtle"
              textTransform="uppercase"
              letterSpacing="wider"
              fontWeight="medium"
              px="3"
              py="1"
              rounded="md"
            >
              {phaseBadgeLabel}
            </Badge>
            {/*
              * The bridge phase used to carry an explanatory line here ("This is a new scenario.
              * It starts again from the beginning…"). It was removed deliberately: telling the
              * participant how the instrument is structured invites them to reason about the
              * PROCEDURE rather than the scenario, and the restart is already obvious from the
              * count returning to 1 and the picture changing. The phase badge above still
              * identifies which scenario they are in.
              *
              * To restore it, re-add a <Text> here keyed off state.currentPhase === "bridge".
              */}
          </VStack>

          {/*
            * Scenario panel. With an illustration it is a two-column row (picture beside the
            * question on md+, stacked on a phone); without one it is the original centred
            * single column, so a phase with no artwork is unchanged.
            *
            * The `key` deliberately does NOT include the rung index. Re-keying on every rung
            * remounted the whole panel including the picture, which restarted the image element
            * from scratch and undid the point of preloading. Keying on the phase alone lets the
            * picture cross-fade in place while the question text keeps its own animation.
            */}
          <Box
            bg={surf.subtleBg}
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            p={{ base: "5", md: "6" }}
            minH="180px"
            key={`${state.currentPhase}-${transitionMessage ?? ""}`}
            animationName="fade-in"
            animationDuration="moderate"
          >
            {transitionMessage ? (
              <Box minH="140px" display="flex" alignItems="center" justifyContent="center">
                <Text fontSize="lg" color="fg.muted" fontStyle="italic">
                  {transitionMessage}
                </Text>
              </Box>
            ) : scenarioImageSrc ? (
              <SimpleGrid
                columns={{ base: 1, md: 2 }}
                gap={{ base: "5", md: "6" }}
                alignItems="center"
              >
                <ScenarioImage
                  src={scenarioImageSrc}
                  alt={
                    state.currentPhase === "bridge"
                      ? `Illustration: a runaway trolley heading toward ${currentValue.toLocaleString()} ${currentValue === 1 ? "person" : "people"}, with one person on a bridge above the track`
                      : `Illustration: a runaway trolley heading toward ${currentValue.toLocaleString()} ${currentValue === 1 ? "person" : "people"}, with a lever that would divert it onto a track with one person`
                  }
                  bg={surf.cardBg}
                  aspect={scenarioImageAspect}
                />
                <Box textAlign={{ base: "center", md: "left" }}>{scenarioElements}</Box>
              </SimpleGrid>
            ) : (
              <Box
                minH="140px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                textAlign="center"
              >
                {scenarioElements}
              </Box>
            )}
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {(state.currentPhase === "lever"
              ? leverButtons
              : bridgeButtons
            ).map((btn) => (
              <Button
                key={btn.key}
                size="xl"
                onClick={() => {
                  if (state.currentPhase === "lever") {
                    handleLeverChoice(btn.key as LeverAction);
                  } else {
                    handleBridgeChoice(btn.key as BridgeAction);
                  }
                }}
                disabled={isTransitioning || !!transitionMessage}
                bg="blue.600"
                color="white"
                _hover={{ bg: "blue.500" }}
                _active={{ bg: "gray.950" }}
                _disabled={{
                  bg: "blue.600",
                  color: "white",
                  opacity: 0.6,
                  cursor: "not-allowed",
                }}
                rounded="lg"
                fontWeight="medium"
                fontSize="md"
                py="7"
              >
                {btn.label}
              </Button>
            ))}
          </SimpleGrid>

          <Text fontSize="xs" color="fg.subtle" textAlign="center">
            Please respond based on what you would genuinely do in this
            situation.
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}

export default TrolleyThresholdBlock;

export type { TrolleyAction };
