import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlock123Surfaces } from "./block123Theme";
import {
  Box,
  Button,
  Heading,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  AMOUNT_LABELS,
  AMOUNT_VALUES,
  CONTEXTS,
  SESSION_KEY_RESULTS,
} from "./constants";
import type {
  ActionKey,
  MoneyBlockResults,
  MoneyChoiceRecord,
  ThresholdResult,
} from "./types";
import { ProgressBar } from "./ProgressBar";
import { CompletionScreen } from "./CompletionScreen";
import { GlowSpan } from "./GlowSpan";

/** Duration in milliseconds for between-context transition pauses. */
const TRANSITION_MS = 900;

/** Holds the threshold result for each of the three location contexts. */
type ThresholdsState = {
  threshold_sidewalk: ThresholdResult | null;
  threshold_wealthy: ThresholdResult | null;
  threshold_shelter: ThresholdResult | null;
};

/** Initial thresholds state with all contexts unresolved. */
const EMPTY_THRESHOLDS: ThresholdsState = {
  threshold_sidewalk: null,
  threshold_wealthy: null,
  threshold_shelter: null,
};

/** Ordered list of participant action choices rendered as buttons. */
const ACTION_BUTTONS: { key: ActionKey; label: string }[] = [
  { key: "keep", label: "Keep it" },
  { key: "return", label: "Try to return it" },
  { key: "leave", label: "Leave it" },
  { key: "donate", label: "Donate it nearby" },
];

/** Maps a context key string to its corresponding ThresholdsState property name. */
function thresholdKey(contextKey: string): keyof ThresholdsState {
  return `threshold_${contextKey}` as keyof ThresholdsState;
}

/** Props accepted by the MoneyThresholdBlock component. */
interface MoneyThresholdBlockProps {
  /** Optional participant identifier for data attribution. */
  participantId?: string;
  /** Callback invoked with aggregated results when the participant finishes all contexts. */
  onContinue?: (results: MoneyBlockResults) => void;
}

/**
 * Runs the found-money threshold experiment across three location contexts.
 * Presents escalating monetary amounts and records the first amount the
 * participant chooses to keep, establishing a threshold per context.
 */
export function MoneyThresholdBlock({ participantId, onContinue }: MoneyThresholdBlockProps = {}) {
  const surf = useBlock123Surfaces(); // coordinated light-mode surfaces (dark unchanged)
  /** Index into CONTEXTS for the location scenario currently being presented. */
  const [currentContextIndex, setCurrentContextIndex] = useState(0);
  /** Index into AMOUNT_LABELS/AMOUNT_VALUES for the amount currently on screen. */
  const [currentAmountIndex, setCurrentAmountIndex] = useState(0);
  /** Accumulated threshold results keyed by context, updated as each context resolves. */
  const [thresholds, setThresholds] = useState<ThresholdsState>(EMPTY_THRESHOLDS);
  /** Full ordered log of every choice the participant has made so far. */
  const [history, setHistory] = useState<MoneyChoiceRecord[]>([]);
  /** Whether all contexts have been completed and results are ready. */
  const [moneyBlockCompleted, setMoneyBlockCompleted] = useState(false);
  /** Locks the UI during animated transitions between amounts or contexts. */
  const [isTransitioning, setIsTransitioning] = useState(false);
  /** Temporary feedback message shown during a context transition, or null when idle. */
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  /** Final aggregated results object, populated once the block is complete. */
  const [finalResults, setFinalResults] = useState<MoneyBlockResults | null>(null);

  /** Resolved context object for the current scenario. */
  const currentContext = CONTEXTS[currentContextIndex];
  /** Human-readable label for the amount currently displayed (e.g. "$20"). */
  const currentAmountLabel = AMOUNT_LABELS[currentAmountIndex];
  /** Numeric value of the amount currently displayed, used for threshold records. */
  const currentAmountValue = AMOUNT_VALUES[currentAmountIndex];

  // Glow key tracking: increment only when a value changes after initial mount
  /** Previous amount label, stored to detect changes for glow animation triggers. */
  const prevAmountLabel = useRef<string | null>(null);
  /** Previous context key, stored to detect changes for glow animation triggers. */
  const prevContextKey = useRef<string | null>(null);
  /** Counter incremented each time the displayed amount changes; drives GlowSpan re-animation. */
  const amountGlowKey = useRef(0);
  /** Counter incremented each time the context changes; drives GlowSpan re-animation. */
  const contextGlowKey = useRef(0);
  /** Dummy state used solely to force a re-render after mutating glow key refs. */
  const [, forceGlowRender] = useState(0);

  /**
   * Tracks changes to the displayed amount and context between renders,
   * incrementing the corresponding glow key refs to trigger glow animations
   * on GlowSpan elements whenever those values change.
   */
  useEffect(() => {
    let changed = false;
    if (prevAmountLabel.current !== null && prevAmountLabel.current !== currentAmountLabel) {
      amountGlowKey.current += 1;
      changed = true;
    }
    if (prevContextKey.current !== null && prevContextKey.current !== currentContext?.key) {
      contextGlowKey.current += 1;
      changed = true;
    }
    prevAmountLabel.current = currentAmountLabel;
    prevContextKey.current = currentContext?.key ?? null;
    if (changed) forceGlowRender((n) => n + 1);
  }, [currentAmountLabel, currentContext?.key]);

  /**
   * Finalises the experiment: assembles the MoneyBlockResults object,
   * persists it to localStorage for session recovery, and marks the block done.
   */
  const completeMoneyBlock = useCallback(
    (finalThresholds: ThresholdsState, finalHistory: MoneyChoiceRecord[]) => {
      const results: MoneyBlockResults = {
        participantId,
        completed: true,
        completedAt: new Date().toISOString(),
        thresholds: finalThresholds,
        history: finalHistory,
      };
      try {
        localStorage.setItem(SESSION_KEY_RESULTS, JSON.stringify(results));
      } catch {
        // ignore
      }
      setFinalResults(results);
      setMoneyBlockCompleted(true);
    },
    [participantId],
  );

  /**
   * Advances to the next context after a TRANSITION_MS delay.
   * If all contexts are exhausted, calls completeMoneyBlock instead.
   */
  const moveToNextContext = useCallback(
    (updatedThresholds: ThresholdsState, updatedHistory: MoneyChoiceRecord[]) => {
      const nextIndex = currentContextIndex + 1;
      setIsTransitioning(true);
      setTimeout(() => {
        if (nextIndex >= CONTEXTS.length) {
          completeMoneyBlock(updatedThresholds, updatedHistory);
        } else {
          setCurrentContextIndex(nextIndex);
          setCurrentAmountIndex(0);
        }
        setIsTransitioning(false);
        setTransitionMessage(null);
      }, TRANSITION_MS);
    },
    [currentContextIndex, completeMoneyBlock],
  );

  /**
   * Handles a participant's action button press.
   * - "keep" records the current amount as the threshold and moves to the next context.
   * - Any other action at the final amount marks the context as beyond-range and advances.
   * - Any other action at a non-final amount advances to the next (higher) amount with a brief delay.
   */
  const handleChoice = useCallback(
    (action: ActionKey) => {
      if (isTransitioning || moneyBlockCompleted) return;

      const record: MoneyChoiceRecord = {
        contextKey: currentContext.key,
        contextLabel: currentContext.label,
        amountIndex: currentAmountIndex,
        amountValue: currentAmountValue,
        amountLabel: currentAmountLabel,
        action,
        timestamp: new Date().toISOString(),
      };
      const updatedHistory = [...history, record];
      setHistory(updatedHistory);

      if (action === "keep") {
        const threshold: ThresholdResult = {
          contextKey: currentContext.key,
          accepted: true,
          thresholdAmount: currentAmountValue,
          thresholdLabel: currentAmountLabel,
          thresholdAmountIndex: currentAmountIndex,
          thresholdBeyondRange: false,
        };
        const updatedThresholds: ThresholdsState = {
          ...thresholds,
          [thresholdKey(currentContext.key)]: threshold,
        };
        setThresholds(updatedThresholds);
        setTransitionMessage("Your response is recorded");
        moveToNextContext(updatedThresholds, updatedHistory);
        return;
      }

      if (currentAmountIndex >= AMOUNT_LABELS.length - 1) {
        const threshold: ThresholdResult = {
          contextKey: currentContext.key,
          accepted: false,
          thresholdAmount: null,
          thresholdLabel: null,
          thresholdAmountIndex: null,
          thresholdBeyondRange: true,
        };
        const updatedThresholds: ThresholdsState = {
          ...thresholds,
          [thresholdKey(currentContext.key)]: threshold,
        };
        setThresholds(updatedThresholds);
        setTransitionMessage(
          'No "Keep it" choice was made in this location. Moving to the next location...',
        );
        moveToNextContext(updatedThresholds, updatedHistory);
        return;
      }

      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentAmountIndex((i) => i + 1);
        setIsTransitioning(false);
      }, 280);
    },
    [
      isTransitioning,
      moneyBlockCompleted,
      currentContext,
      currentAmountIndex,
      currentAmountValue,
      currentAmountLabel,
      history,
      thresholds,
      moveToNextContext,
    ],
  );

  /** Forwards the completed results to the parent via the onContinue prop. */
  const handleContinue = useCallback(() => {
    if (!finalResults) return;
    console.log("Money block results:", finalResults);
    onContinue?.(finalResults);
  }, [finalResults, onContinue]);

  /** Resolves the Chakra color token for the context location phrase highlight. */
  const contextPhraseColor = useMemo(() => {
    const colors: Record<string, string> = {
      sidewalk: "blue.400",
      wealthy: "orange.400",
      shelter: "red.400",
    };
    return colors[currentContext?.key ?? ""] ?? "fg";
  }, [currentContext]);

  /** Resolves the human-readable location phrase embedded in the scenario sentence. */
  const contextPhrase = useMemo(() => {
    const phrases: Record<string, string> = {
      sidewalk: "the sidewalk in a public street",
      wealthy: "the ground outside a major financial district office building",
      shelter: "the ground outside a homeless shelter",
    };
    return phrases[currentContext?.key ?? ""] ?? null;
  }, [currentContext]);

  /**
   * Builds the styled scenario sentence as a React element tree.
   * Splits the sentence around the amount and context phrase so each can be
   * wrapped in a GlowSpan with its own color and animation key.
   */
  const scenarioElements = useMemo(() => {
    if (!currentContext) return null;
    const sentence = currentContext.scenario(currentAmountLabel);
    const amountParts = sentence.split(currentAmountLabel);
    const beforeAmount = amountParts[0];
    const afterAmount = amountParts[1] ?? "";

    if (contextPhrase && afterAmount.includes(contextPhrase)) {
      const phraseParts = afterAmount.split(contextPhrase);
      return (
        <Text fontSize={{ base: "xl", md: "2xl" }} color="fg" lineHeight="tall">
          {beforeAmount}
          <GlowSpan glowKey={amountGlowKey.current} glowColor="green.400" fontWeight="bold" color="green.400">
            {currentAmountLabel}
          </GlowSpan>
          {phraseParts[0]}
          <GlowSpan glowKey={contextGlowKey.current} glowColor={contextPhraseColor} fontWeight="semibold" color={contextPhraseColor}>
            {contextPhrase}
          </GlowSpan>
          {phraseParts[1]}
        </Text>
      );
    }

    return (
      <Text fontSize={{ base: "xl", md: "2xl" }} color="fg" lineHeight="tall">
        {beforeAmount}
        <GlowSpan glowKey={amountGlowKey.current} glowColor="green.400" fontWeight="bold" color="green.400">
          {currentAmountLabel}
        </GlowSpan>
        {afterAmount}
      </Text>
    );
  }, [currentContext, currentAmountLabel, contextPhrase, contextPhraseColor, amountGlowKey.current, contextGlowKey.current]);

  /* Render the completion screen once all contexts are done. */
  if (moneyBlockCompleted && finalResults) {
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
          <CompletionScreen results={finalResults} onContinue={handleContinue} />
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
            total={AMOUNT_LABELS.length}
            current={currentAmountIndex}
          />

          <VStack gap="3" textAlign="center">
            <Heading
              size="xl"
              color="fg"
              fontWeight="semibold"
              letterSpacing="tight"
            >
              Found Money Decisions
            </Heading>
            <Text
              fontSize="sm"
              color="fg.muted"
              textTransform="uppercase"
              letterSpacing="wider"
              fontWeight="medium"
            >
              Context {currentContextIndex + 1}: {currentContext.label}
            </Text>
          </VStack>

          <Box
            bg={surf.subtleBg}
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            p={{ base: "6", md: "8" }}
            textAlign="center"
            minH="160px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            key={`${currentContextIndex}-${currentAmountIndex}-${transitionMessage ?? ""}`}
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
            {ACTION_BUTTONS.map((btn) => (
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
            Please respond based on what you would genuinely do in this situation.
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}

export default MoneyThresholdBlock;
