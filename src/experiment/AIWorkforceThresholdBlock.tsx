import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlock123Surfaces } from "./block123Theme";
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuInfo } from "react-icons/lu";
import {
  HoverCardArrow,
  HoverCardContent,
  HoverCardRoot,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ProgressBar } from "./ProgressBar";
import { AIWorkforceCompletionScreen } from "./AIWorkforceCompletionScreen";
import { GlowSpan } from "./GlowSpan";
import {
  AI_WORKFORCE_PROGRESS_KEY,
  AI_WORKFORCE_RESULTS_KEY,
  FIXED_HARM_PHRASE,
  GAIN_OPTIONS,
  WORKER_GROUPS,
  WORKER_GROUP_DISCLAIMER,
  WORKER_GROUP_SIZES,
  aiWorkforceThresholdKeyFor,
  type AIWorkforceBlockResults,
  type AIWorkforceChoiceRecord,
  type AIWorkforceThresholdResult,
  type AIWorkforceThresholdsMap,
  type AIWorkforceThresholdKey,
  type RolloutAction,
} from "./aiWorkforceTypes";

/** Milliseconds to hold the transitioning state when moving between full scenarios. */
const TRANSITION_MS = 900;
/** Milliseconds to hold the transitioning state when only the gain level escalates. */
const QUICK_ADVANCE_MS = 300;

/** Glow color applied to the financial gain value in the scenario sentence. */
const GAIN_COLOR = "green.300";
/** Glow color applied to the worker group type in the scenario sentence. */
const GROUP_TYPE_COLOR = "yellow.300";
/** Glow color applied to the group size in the scenario sentence. */
const GROUP_SIZE_COLOR = "blue.400";

/**
 * Shape of the in-progress session state persisted to localStorage between page loads.
 */
interface InProgressState {
  /** Index into WORKER_GROUPS for the currently active worker group type. */
  currentGroupTypeIndex: number;
  /** Index into WORKER_GROUP_SIZES for the currently active group size. */
  currentGroupSizeIndex: number;
  /** Index into GAIN_OPTIONS for the current gain level being presented. */
  currentGainIndex: number;
  /** Partial map of already-resolved threshold results keyed by threshold key. */
  thresholds: Partial<AIWorkforceThresholdsMap>;
  /** Full ordered history of every individual approve / do_not_approve choice made. */
  history: AIWorkforceChoiceRecord[];
  /** Whether the participant has acknowledged the intro screen (auto-set on mount). */
  introAcknowledged: boolean;
}

/** Starting position for a fresh session with no prior progress. */
const INITIAL_STATE: InProgressState = {
  currentGroupTypeIndex: 0,
  currentGroupSizeIndex: 0,
  currentGainIndex: 0,
  thresholds: {},
  history: [],
  introAcknowledged: false,
};

interface Props {
  participantId?: string;
  onContinue?: (results: AIWorkforceBlockResults) => void;
}

/**
 * Creates a "blocked by prior non-acceptance" threshold result record for a given
 * group type / size combination. Used to fill all larger group sizes in the same
 * worker group when the current size was rejected at max gain, since it would be
 * inconsistent to ask about a larger affected population after rejecting a smaller one.
 */
function makeBlockedResult(
  groupTypeIndex: number,
  groupSizeIndex: number,
  startedAtGainIndex: number,
): AIWorkforceThresholdResult {
  const gt = WORKER_GROUPS[groupTypeIndex];
  const gs = WORKER_GROUP_SIZES[groupSizeIndex];
  return {
    groupTypeKey: gt.key,
    groupTypeLabel: gt.label,
    groupSizeKey: gs.key,
    groupSizeLabel: gs.label,
    groupSizeCount: gs.count,
    accepted: false,
    thresholdGain: null,
    thresholdGainLabel: null,
    thresholdGainIndex: null,
    thresholdBeyondRange: false,
    blockedByPriorNonAcceptance: true,
    startedAtGainIndex,
  };
}

/**
 * Inline hover-card info icon that appears next to a worker group term in the scenario
 * sentence. On hover it surfaces the term's label and plain-English definition so
 * participants can understand the terminology without leaving the page.
 */
function WorkerGroupInfoIcon({
  label,
  definition,
}: {
  label: string;
  definition: string;
}) {
  return (
    <HoverCardRoot
      size="sm"
      openDelay={120}
      closeDelay={80}
      positioning={{ placement: "top" }}
    >
      <HoverCardTrigger asChild>
        <Icon
          as="span"
          display="inline-flex"
          verticalAlign="middle"
          cursor="pointer"
          color="fg.subtle"
          _hover={{ color: "fg.muted" }}
          ml="1"
          style={{ position: "relative", top: "-2px" }}
        >
          <LuInfo size={15} />
        </Icon>
      </HoverCardTrigger>
      <HoverCardContent
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        shadow="lg"
        rounded="xl"
        maxW="xs"
        px="4"
        py="4"
        _dark={{ bg: "gray.800", borderColor: "gray.700" }}
      >
        <HoverCardArrow />
        <Stack gap="1.5">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="gray.500"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            What does this worker term mean?
          </Text>
          <Text fontSize="sm" fontWeight="semibold" color="gray.800" _dark={{ color: "gray.100" }}>
            {label}
          </Text>
          <Text fontSize="sm" color="gray.600" lineHeight="tall" _dark={{ color: "gray.300" }}>
            {definition}
          </Text>
        </Stack>
      </HoverCardContent>
    </HoverCardRoot>
  );
}

export function AIWorkforceThresholdBlock({ participantId, onContinue }: Props) {
  const surf = useBlock123Surfaces(); // coordinated light-mode surfaces (dark unchanged)
  // Restore in-progress session from localStorage, falling back to INITIAL_STATE.
  const [state, setState] = useState<InProgressState>(() => {
    try {
      const saved = localStorage.getItem(AI_WORKFORCE_PROGRESS_KEY);
      if (saved) return JSON.parse(saved) as InProgressState;
    } catch {
      // ignore
    }
    return INITIAL_STATE;
  });
  /** True once completeBlock has been called and final results are ready. */
  const [completed, setCompleted] = useState(false);
  /** Holds the finalised results object after the block completes. */
  const [finalResults, setFinalResults] =
    useState<AIWorkforceBlockResults | null>(null);
  /** Prevents double-submission while an animated transition is in flight. */
  const [isTransitioning, setIsTransitioning] = useState(false);
  /** Message shown in place of the scenario card during a transition animation. */
  const [transitionMessage, setTransitionMessage] = useState<string | null>(
    null,
  );

  /**
   * Persists in-progress state to localStorage on every state change so the
   * participant can resume an interrupted session. Skips writes once the block
   * is complete (the progress key is cleaned up inside completeBlock instead).
   */
  useEffect(() => {
    if (completed) return;
    try {
      localStorage.setItem(AI_WORKFORCE_PROGRESS_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, completed]);

  // Derived shortcuts for the currently active scenario values.
  const currentGroupType = WORKER_GROUPS[state.currentGroupTypeIndex];
  const currentGroupSize = WORKER_GROUP_SIZES[state.currentGroupSizeIndex];
  const currentGain = GAIN_OPTIONS[state.currentGainIndex];

  // Glow key tracking: only glow the field(s) that actually changed after initial mount
  const prevGainLabel = useRef<string | null>(null);
  const prevGroupTypeKey = useRef<string | null>(null);
  const prevGroupSizeKey = useRef<string | null>(null);
  /** Monotonically increasing counter passed as glowKey to the gain GlowSpan; incremented on every gain change. */
  const gainGlowKey = useRef(0);
  /** Monotonically increasing counter passed as glowKey to the group-type GlowSpan; incremented on every group type change. */
  const groupTypeGlowKey = useRef(0);
  /** Monotonically increasing counter passed as glowKey to the group-size GlowSpan; incremented on every group size change. */
  const groupSizeGlowKey = useRef(0);
  // Dummy state used solely to trigger a re-render after glow counters are mutated via refs.
  const [, forceGlowRender] = useState(0);

  /**
   * Tracks three independent glow counters — one each for gain, group type, and group
   * size. On each render, compares the current values against the previous ones; only
   * the counters whose values actually changed are incremented, so GlowSpan only
   * animates the specific field(s) that transitioned. A forced re-render is scheduled
   * when at least one counter changed so React picks up the mutated ref values.
   */
  useEffect(() => {
    let changed = false;
    if (prevGainLabel.current !== null && prevGainLabel.current !== currentGain.label) {
      gainGlowKey.current += 1;
      changed = true;
    }
    if (prevGroupTypeKey.current !== null && prevGroupTypeKey.current !== currentGroupType.key) {
      groupTypeGlowKey.current += 1;
      changed = true;
    }
    if (prevGroupSizeKey.current !== null && prevGroupSizeKey.current !== currentGroupSize.key) {
      groupSizeGlowKey.current += 1;
      changed = true;
    }
    prevGainLabel.current = currentGain.label;
    prevGroupTypeKey.current = currentGroupType.key;
    prevGroupSizeKey.current = currentGroupSize.key;
    if (changed) forceGlowRender((n) => n + 1);
  }, [currentGain.label, currentGroupType.key, currentGroupSize.key]);

  /** Total number of (group type × group size) subcontexts; drives the progress bar denominator. */
  const totalSubcontexts = WORKER_GROUPS.length * WORKER_GROUP_SIZES.length;
  /** Zero-based index of the current subcontext; drives the progress bar numerator. */
  const currentSubcontextIndex =
    state.currentGroupTypeIndex * WORKER_GROUP_SIZES.length +
    state.currentGroupSizeIndex;

  /**
   * Finalises the threshold matrix by filling any cells that were never explicitly
   * resolved (e.g. gaps left by early termination) with blocked results. Serialises
   * the completed AIWorkforceBlockResults to AI_WORKFORCE_RESULTS_KEY (the single,
   * canonical Block-3 storage key) and cleans up the in-progress key afterward.
   */
  const completeBlock = useCallback((finalState: InProgressState) => {
    const thresholds: AIWorkforceThresholdsMap = {} as AIWorkforceThresholdsMap;
    for (let gti = 0; gti < WORKER_GROUPS.length; gti++) {
      for (let gsi = 0; gsi < WORKER_GROUP_SIZES.length; gsi++) {
        const key = aiWorkforceThresholdKeyFor(
          WORKER_GROUPS[gti].key,
          WORKER_GROUP_SIZES[gsi].key,
        );
        thresholds[key] =
          finalState.thresholds[key] ?? makeBlockedResult(gti, gsi, 0);
      }
    }
    const results: AIWorkforceBlockResults = {
      completed: true,
      completedAt: new Date().toISOString(),
      thresholds,
      history: finalState.history,
      participantId, // unified session id (MongoDB join key)
    };
    try {
      localStorage.setItem(AI_WORKFORCE_RESULTS_KEY, JSON.stringify(results));
      localStorage.removeItem(AI_WORKFORCE_PROGRESS_KEY);
    } catch {
      // ignore
    }
    setFinalResults(results);
    setCompleted(true);
  }, [participantId]);

  /**
   * State machine for the two possible participant actions on each scenario.
   *
   * approve:
   *   - Records the current gain level as the accepted threshold for this (type, size) cell.
   *   - If more sizes remain for the current group type, advances to the next size at the
   *     same gain level (sizes are shown in ascending order within a group type).
   *   - If all sizes are exhausted, moves to the next group type and resets gain to the
   *     lowest option.
   *   - If all group types are exhausted, calls completeBlock.
   *
   * do_not_approve:
   *   - If a higher gain option exists, escalates to the next gain level and re-presents
   *     the same (type, size) scenario (quick transition, no message).
   *   - If max gain has been reached, marks the current cell as thresholdBeyondRange and
   *     auto-blocks all remaining larger sizes in the same group type via makeBlockedResult,
   *     then moves to the next group type or completes the block.
   */
  const handleChoice = useCallback(
    (action: RolloutAction) => {
      if (isTransitioning || completed) return;

      const gtIdx = state.currentGroupTypeIndex;
      const gsIdx = state.currentGroupSizeIndex;
      const gIdx = state.currentGainIndex;
      const gt = WORKER_GROUPS[gtIdx];
      const gs = WORKER_GROUP_SIZES[gsIdx];
      const g = GAIN_OPTIONS[gIdx];

      const record: AIWorkforceChoiceRecord = {
        groupTypeKey: gt.key,
        groupTypeLabel: gt.label,
        groupSizeKey: gs.key,
        groupSizeLabel: gs.label,
        groupSizeCount: gs.count,
        gainIndex: gIdx,
        gainValue: g.value,
        gainLabel: g.label,
        action,
        timestamp: new Date().toISOString(),
      };
      const updatedHistory = [...state.history, record];
      const thresholdKey: AIWorkforceThresholdKey = aiWorkforceThresholdKeyFor(
        gt.key,
        gs.key,
      );

      if (action === "approve") {
        const accepted: AIWorkforceThresholdResult = {
          groupTypeKey: gt.key,
          groupTypeLabel: gt.label,
          groupSizeKey: gs.key,
          groupSizeLabel: gs.label,
          groupSizeCount: gs.count,
          accepted: true,
          thresholdGain: g.value,
          thresholdGainLabel: g.label,
          thresholdGainIndex: gIdx,
          thresholdBeyondRange: false,
          blockedByPriorNonAcceptance: false,
          startedAtGainIndex:
            state.thresholds[thresholdKey]?.startedAtGainIndex ?? gIdx,
        };
        const nextThresholds: Partial<AIWorkforceThresholdsMap> = {
          ...state.thresholds,
          [thresholdKey]: accepted,
        };

        // Next size within same group type (escalate sizes at the accepted gain)
        if (gsIdx < WORKER_GROUP_SIZES.length - 1) {
          const nextState: InProgressState = {
            ...state,
            currentGroupSizeIndex: gsIdx + 1,
            currentGainIndex: gIdx,
            thresholds: nextThresholds,
            history: updatedHistory,
          };
          setIsTransitioning(true);
          setTransitionMessage(
            "Threshold recorded. Moving to a larger group size...",
          );
          setTimeout(() => {
            setState(nextState);
            setIsTransitioning(false);
            setTransitionMessage(null);
          }, TRANSITION_MS);
          return;
        }

        // Move to next worker group type; reset gain to $1M
        if (gtIdx < WORKER_GROUPS.length - 1) {
          const nextState: InProgressState = {
            ...state,
            currentGroupTypeIndex: gtIdx + 1,
            currentGroupSizeIndex: 0,
            currentGainIndex: 0,
            thresholds: nextThresholds,
            history: updatedHistory,
          };
          setIsTransitioning(true);
          setTransitionMessage(
            "Switching to a new worker group context...",
          );
          setTimeout(() => {
            setState(nextState);
            setIsTransitioning(false);
            setTransitionMessage(null);
          }, TRANSITION_MS);
          return;
        }

        const finalState: InProgressState = {
          ...state,
          thresholds: nextThresholds,
          history: updatedHistory,
        };
        setIsTransitioning(true);
        setTransitionMessage("Threshold recorded. Preparing summary...");
        setTimeout(() => {
          completeBlock(finalState);
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
      }

      // do_not_approve → escalate gain
      const nextGainIndex = gIdx + 1;
      if (nextGainIndex < GAIN_OPTIONS.length) {
        const nextState: InProgressState = {
          ...state,
          currentGainIndex: nextGainIndex,
          history: updatedHistory,
        };
        setIsTransitioning(true);
        setTimeout(() => {
          setState(nextState);
          setIsTransitioning(false);
        }, QUICK_ADVANCE_MS);
        return;
      }

      // Reached max gain — threshold beyond range, block larger sizes within same worker group
      const beyondRange: AIWorkforceThresholdResult = {
        groupTypeKey: gt.key,
        groupTypeLabel: gt.label,
        groupSizeKey: gs.key,
        groupSizeLabel: gs.label,
        groupSizeCount: gs.count,
        accepted: false,
        thresholdGain: null,
        thresholdGainLabel: null,
        thresholdGainIndex: null,
        thresholdBeyondRange: true,
        blockedByPriorNonAcceptance: false,
        startedAtGainIndex:
          state.thresholds[thresholdKey]?.startedAtGainIndex ?? 0,
      };
      const updatedThresholds: Partial<AIWorkforceThresholdsMap> = {
        ...state.thresholds,
        [thresholdKey]: beyondRange,
      };
      for (let i = gsIdx + 1; i < WORKER_GROUP_SIZES.length; i++) {
        const key = aiWorkforceThresholdKeyFor(gt.key, WORKER_GROUP_SIZES[i].key);
        updatedThresholds[key] = makeBlockedResult(gtIdx, i, 0);
      }

      if (gtIdx < WORKER_GROUPS.length - 1) {
        const nextState: InProgressState = {
          ...state,
          currentGroupTypeIndex: gtIdx + 1,
          currentGroupSizeIndex: 0,
          currentGainIndex: 0,
          thresholds: updatedThresholds,
          history: updatedHistory,
        };
        setIsTransitioning(true);
        setTransitionMessage(
          "No approval within range. Skipping larger sizes in this worker context...",
        );
        setTimeout(() => {
          setState(nextState);
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
      }

      const finalState: InProgressState = {
        ...state,
        thresholds: updatedThresholds,
        history: updatedHistory,
      };
      setIsTransitioning(true);
      setTransitionMessage(
        "No approval within range. Preparing summary...",
      );
      setTimeout(() => {
        completeBlock(finalState);
        setIsTransitioning(false);
        setTransitionMessage(null);
      }, TRANSITION_MS);
    },
    [state, isTransitioning, completed, completeBlock],
  );

  const handleContinue = useCallback(() => {
    if (!finalResults) return;
    onContinue?.(finalResults);
  }, [finalResults, onContinue]);

  /**
   * Builds the three-line scenario card content shown inside the animated scenario box.
   * Wraps each of the three dynamic values — gain amount, worker group type, and group
   * size — in a GlowSpan keyed by its respective glow counter so only the value(s) that
   * changed since the last render animate. Re-computed whenever any of those three
   * current values or their glow counters change.
   */
  const scenarioContent = useMemo(() => {
    return (
      <Stack gap="4" w="full">
        {/* Static context — smaller, neutral box */}
        <Box
          bg={surf.cardBg}
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="lg"
          px={{ base: "4", md: "5" }}
          py="3"
          textAlign="center"
        >
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">
            You are the final decision-maker on whether to approve a rollout
            plan for a new AI workforce system in your organization.
          </Text>
        </Box>

        {/* Dynamic scenario sentence */}
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          color="fg"
          lineHeight="tall"
          textAlign="center"
        >
          Approving it would generate{" "}
          <GlowSpan glowKey={gainGlowKey.current} glowColor={GAIN_COLOR} fontWeight="bold" color={GAIN_COLOR}>
            {currentGain.label}
          </GlowSpan>{" "}
          in financial gain for the company, but it is expected to cause{" "}
          <Text as="span" color="fg">
            {FIXED_HARM_PHRASE}
          </Text>{" "}
          for{" "}
          <GlowSpan glowKey={groupTypeGlowKey.current} glowColor={GROUP_TYPE_COLOR} fontWeight="bold" color={GROUP_TYPE_COLOR}>
            {currentGroupType.label}
          </GlowSpan>
          <WorkerGroupInfoIcon
            label={currentGroupType.shortLabel}
            definition={currentGroupType.definition}
          />{" "}
          in a{" "}
          <GlowSpan glowKey={groupSizeGlowKey.current} glowColor={GROUP_SIZE_COLOR} fontWeight="bold" color={GROUP_SIZE_COLOR}>
            {currentGroupSize.label}
          </GlowSpan>
          .
        </Text>

        {/* Separated question */}
        <Text
          fontSize={{ base: "md", md: "lg" }}
          color="fg.muted"
          fontStyle="italic"
          textAlign="center"
          letterSpacing="wide"
        >
          Would you approve the rollout plan?
        </Text>
      </Stack>
    );
  }, [currentGain, currentGroupType, currentGroupSize, gainGlowKey.current, groupTypeGlowKey.current, groupSizeGlowKey.current]);

  /**
   * Skips the intro screen entirely by immediately setting introAcknowledged on mount.
   * The flag remains in state (and in localStorage) so that any future intro-gating
   * logic has a reliable signal, but participants are never blocked by an interstitial.
   */
  useEffect(() => {
    if (!state.introAcknowledged && !completed) {
      setState((s) => ({ ...s, introAcknowledged: true }));
    }
  }, [state.introAcknowledged, completed]);

  if (completed && finalResults) {
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
          <AIWorkforceCompletionScreen
            results={finalResults}
            onContinue={handleContinue}
          />
        </Box>
      </Box>
    );
  }

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
          <ProgressBar
            total={totalSubcontexts}
            current={currentSubcontextIndex}
          />

          <VStack gap="3" textAlign="center">
            <Heading
              size="xl"
              color="fg"
              fontWeight="semibold"
              letterSpacing="tight"
            >
              AI Workforce Rollout Decisions
            </Heading>
            <Badge
              colorPalette="orange"
              variant="subtle"
              textTransform="uppercase"
              letterSpacing="wider"
              fontWeight="medium"
              px="3"
              py="1"
              rounded="md"
            >
              Scenario {currentSubcontextIndex + 1} of {totalSubcontexts}
            </Badge>
          </VStack>

          <HStack gap="2" justify="center" wrap="wrap">
            <Badge colorPalette="green" variant="subtle" px="3" py="1" rounded="md">
              Financial gain
            </Badge>
            <Badge colorPalette="yellow" variant="subtle" px="3" py="1" rounded="md">
              Worker group
            </Badge>
            <Badge colorPalette="blue" variant="subtle" px="3" py="1" rounded="md">
              Group size
            </Badge>
          </HStack>

          <Box
            bg={surf.subtleBg}
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            p={{ base: "6", md: "8" }}
            textAlign="center"
            minH="220px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            key={`${state.currentGroupTypeIndex}-${state.currentGroupSizeIndex}-${state.currentGainIndex}-${transitionMessage ?? ""}`}
            animationName="fade-in"
            animationDuration="moderate"
          >
            {transitionMessage ? (
              <Text fontSize="lg" color="fg.muted" fontStyle="italic">
                {transitionMessage}
              </Text>
            ) : (
              scenarioContent
            )}
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {[
              { key: "approve" as RolloutAction, label: "Approve the rollout plan" },
              {
                key: "do_not_approve" as RolloutAction,
                label: "Do not approve the rollout plan",
              },
            ].map((btn) => (
              <Button
                key={btn.key}
                size="xl"
                onClick={() => handleChoice(btn.key)}
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

/**
 * Standalone panel listing definitions for all worker group terms used throughout the
 * block. Exported separately so the insights page can render it independently of the
 * main threshold-gathering UI, giving participants a reference after they complete the
 * block. Accepts an optional `compact` prop to reduce padding in tighter layouts.
 */
export function WorkerTermsPanel({ compact = false }: { compact?: boolean }) {
  const surf = useBlock123Surfaces();
  return (
    <Box
      bg={surf.subtleBg}
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="xl"
      p={{ base: "5", md: compact ? "5" : "6" }}
    >
      <Heading size="sm" color="fg" mb="3">
        What do these worker terms mean?
      </Heading>
      <VStack gap="3" align="stretch">
        {WORKER_GROUPS.map((wg) => (
          <Box key={wg.key}>
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {wg.shortLabel} — {wg.key === "low_buffer"
                ? "workers with limited alternatives"
                : "workers with stronger alternatives"}
            </Text>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              {wg.definition}
            </Text>
          </Box>
        ))}
      </VStack>
      <Text fontSize="xs" color="fg.subtle" mt="3" fontStyle="italic">
        {WORKER_GROUP_DISCLAIMER}
      </Text>
    </Box>
  );
}

export default AIWorkforceThresholdBlock;
