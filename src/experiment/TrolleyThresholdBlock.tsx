import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TrolleyCompletionScreen } from "./TrolleyCompletionScreen";
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

  // Refs used to detect whether a value change is a genuine within-phase increment
  // or an artifact of a phase transition resetting the index.
  /** Last rendered lives value, used to detect real increments. */
  const prevValue = useRef<number | null>(null);
  /** Last rendered phase, used to detect phase transitions. */
  const prevPhase = useRef<string | null>(null);
  /** Monotonically incrementing key passed to GlowSpan to retrigger the animation. */
  const valueGlowKey = useRef(0);
  /** Dummy state toggle whose sole purpose is to force a re-render after valueGlowKey is mutated. */
  const [, forceGlowRender] = useState(0);

  /**
   * Controls the people-count glow animation.
   *
   * The phaseChanged guard is necessary because the lever→bridge transition resets
   * currentSavedLivesIndex back to leverAcceptedIndex, which changes currentValue.
   * Without the guard that reset would fire a glow even though the participant hasn't
   * escalated — only genuine within-phase increments should trigger the effect.
   */
  useEffect(() => {
    // When phase transitions (lever→bridge), the index resets to the lever accepted index.
    // We only want to glow on genuine value increments within a phase, not on phase reset.
    const phaseChanged = prevPhase.current !== null && prevPhase.current !== state.currentPhase;
    const valueChanged = prevValue.current !== null && prevValue.current !== currentValue;

    if (!phaseChanged && valueChanged) {
      valueGlowKey.current += 1;
      forceGlowRender((n) => n + 1);
    }
    prevValue.current = currentValue;
    prevPhase.current = state.currentPhase;
  }, [currentValue, state.currentPhase]);

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

      let bridgeThreshold: BridgeThresholdResult | null = null;
      if (finalState.leverAcceptedIndex != null) {
        const bridgeAccepted = finalState.bridgeAcceptedIndex != null;
        const leverValue = finalState.leverAcceptedValue;
        const bridgeValue = finalState.bridgeAcceptedValue;
        const consistencyAtSameNumber = bridgeAccepted
          ? bridgeValue === leverValue
          : false;
        // How many additional lives were required to cross the bridge threshold vs the lever threshold.
        const directnessGap =
          bridgeAccepted && bridgeValue != null && leverValue != null
            ? bridgeValue - leverValue
            : null;
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
        };
      }

      const summary: TrolleyBlockSummary = {
        leverAcceptedValue: finalState.leverAcceptedValue,
        bridgeAcceptedValue: finalState.bridgeAcceptedValue,
        consistencyAtSameNumber: bridgeThreshold
          ? bridgeThreshold.consistencyAtSameNumber
          : null,
        directnessGap: bridgeThreshold ? bridgeThreshold.directnessGap : null,
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
   * - "pull"         → records lever threshold, transitions to bridge phase starting at the same
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
        // Accepted: move to bridge phase, starting at the same index for direct comparison.
        const nextState: InProgressState = {
          ...state,
          currentPhase: "bridge",
          leverAcceptedIndex: index,
          leverAcceptedValue: value,
          bridgeStartIndex: index,
          currentSavedLivesIndex: index,
          trolleyChoiceHistory: updatedHistory,
        };
        setState(nextState);
        setIsTransitioning(true);
        setTransitionMessage(
          "Lever threshold recorded. Testing the bridge version at the same number...",
        );
        setTimeout(() => {
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

  /** Human-readable label for the phase badge — shown in the UI to orient the participant. */
  const phaseBadgeLabel =
    state.currentPhase === "bridge" ? "Bridge scenario" : "Lever scenario";
  /** Colour palette for the phase badge: blue for lever, orange for bridge. */
  const phaseBadgePalette =
    state.currentPhase === "bridge" ? "orange" : "blue";

  /**
   * Renders the scenario prompt text appropriate for the current phase.
   *
   * The people-count figure is wrapped in a GlowSpan keyed to valueGlowKey so it
   * briefly glows green whenever the count escalates within a phase. Memoized on
   * phase and currentValue (plus the glow key) to avoid unnecessary re-renders.
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
          <GlowSpan glowKey={valueGlowKey.current} glowColor="green.400" fontWeight="bold" color="green.400">
            {currentValue.toLocaleString()}{" "}
            {currentValue === 1 ? "person" : "people"}
          </GlowSpan>
          . You can{" "}
          <Text as="span" fontWeight="bold" color="blue.400">
            pull a lever
          </Text>{" "}
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
          <GlowSpan glowKey={valueGlowKey.current} glowColor="green.400" fontWeight="bold" color="green.400">
            {currentValue.toLocaleString()}{" "}
            {currentValue === 1 ? "person" : "people"}
          </GlowSpan>
          . You can stop it only by{" "}
          <Text as="span" fontWeight="bold" color="yellow.400">
            pushing
          </Text>{" "}
          <Text as="span" fontWeight="semibold" color="red.400">
            1 person
          </Text>{" "}
          <Text as="span" fontWeight="bold" color="yellow.400">
            off a bridge
          </Text>
          , causing that person's death. What would you do?
        </Text>
      );
    }
    return null;
  }, [state.currentPhase, currentValue, valueGlowKey.current]);

  if (trolleyBlockCompleted && finalResults) {
    return (
      <Box
        minH="100vh"
        bg="bg"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={{ base: "4", md: "6" }}
        py="12"
      >
        <Box
          w="full"
          maxW="3xl"
          bg="bg.panel"
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
      bg="bg"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={{ base: "4", md: "6" }}
      py="12"
    >
      <Box
        w="full"
        maxW="3xl"
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        shadow="lg"
        rounded="2xl"
        p={{ base: "6", md: "10" }}
      >
        <VStack gap="8" align="stretch">
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
            {state.currentPhase === "bridge" && (
              <Text
                fontSize="sm"
                color="fg.muted"
                fontStyle="italic"
                maxW="xl"
              >
                This scenario begins at the same number of people you accepted
                in the lever scenario.
              </Text>
            )}
          </VStack>

          <Box
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            p={{ base: "6", md: "8" }}
            textAlign="center"
            minH="180px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            key={`${state.currentPhase}-${state.currentSavedLivesIndex}-${transitionMessage ?? ""}`}
            animationName="fade-in"
            animationDuration="moderate"
          >
            {transitionMessage ? (
              <Text fontSize="lg" color="fg.muted" fontStyle="italic">
                {transitionMessage}
              </Text>
            ) : (
              scenarioElements
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
