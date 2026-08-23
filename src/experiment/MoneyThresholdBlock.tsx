import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ScenarioImage } from "./ScenarioImage";
import { moneyScenarioImage, moneyScenarioImagesFor } from "./scenarioImages";
import { CompletionScreen } from "./CompletionScreen";
import {
  SHOW_INTER_BLOCK_PAGES,
  useAutoAdvance,
} from "./interBlockPages";
import { InterBlockPause } from "./InterBlockPause";
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

  /**
   * Illustration for the current (context, amount) pair, or null when this context has no
   * artwork — in which case the question below renders full-width exactly as it always did.
   */
  const scenarioImageSrc = moneyScenarioImage(currentContext.key, currentAmountValue);

  /**
   * Preload every illustration for the current context as soon as the context opens.
   *
   * The images are only ~50 KB each (the whole Block 1 set is ~420 KB), so fetching them up
   * front is cheap and it means the picture swap between questions is a cache hit rather than
   * a network round trip. Without this the participant would see a blank frame for a moment on
   * each choice, which reads as lag at exactly the point where their answer is being recorded.
   */
  useEffect(() => {
    const sources = moneyScenarioImagesFor(currentContext.key, AMOUNT_VALUES);
    const preloaded = sources.map((src) => {
      const img = new window.Image();
      img.src = src;
      return img;
    });
    // Dropping the references is enough to cancel any in-flight decode on unmount.
    return () => { preloaded.length = 0; };
  }, [currentContext.key]);

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
  /** The amount shown last render, for detecting a change. */
  const [prevAmountLabel, setPrevAmountLabel] = useState(currentAmountLabel);
  /** The context shown last render, for detecting a change. */
  const [prevContextKey, setPrevContextKey] = useState<string | null>(
    currentContext?.key ?? null,
  );
  /**
   * Glow counters.
   *
   * These are plain STATE, not refs. They are read during render (passed to GlowSpan as its
   * `key`, which is what replays the highlight animation), and a value that render depends on
   * is state by definition — React does not re-render when a ref is mutated, which is why the
   * earlier ref-based version also needed a dummy `forceGlowRender` state alongside it purely
   * to schedule the render. Using state directly does the same job in one step: the update IS
   * the re-render trigger, so the extra hook is gone.
   *
   * Behaviour is unchanged — the same integer sequence reaches GlowSpan, at the same moments.
   * (Reading a ref during render is also what `react-hooks/refs` flags: it is unsafe under
   * StrictMode's double-render and under concurrent rendering, where the value read during
   * render may not be the value that gets committed.)
   */
  /** Bumped each time the displayed amount changes; drives GlowSpan re-animation. */
  const [amountGlowKey, setAmountGlowKey] = useState(0);
  /** Bumped each time the context changes; drives GlowSpan re-animation. */
  const [contextGlowKey, setContextGlowKey] = useState(0);

  /*
   * Highlights whatever just changed, so the participant can see at a glance how this question
   * differs from the last one:
   *   - the AMOUNT glows when the ladder escalates (they declined, so the sum went up);
   *   - the CONTEXT phrase glows when the scenario moves to a new location.
   * The two are tracked separately so only the part that actually changed lights up.
   */
  const currentContextKey = currentContext?.key ?? null;
  if (prevAmountLabel !== currentAmountLabel || prevContextKey !== currentContextKey) {
    if (prevAmountLabel !== currentAmountLabel) setAmountGlowKey((n) => n + 1);
    if (prevContextKey !== currentContextKey) setContextGlowKey((n) => n + 1);
    setPrevAmountLabel(currentAmountLabel);
    setPrevContextKey(currentContextKey);
  }

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

  /**
   * HIDDEN COMPLETION SCREEN — presses Continue automatically.
   *
   * Placed AFTER the effect that writes this block's results to LocalStorage, so the save is
   * guaranteed to have happened before the flow advances (effects run in declaration order).
   * When SHOW_INTER_BLOCK_PAGES is true this never fires and the summary screen is shown as
   * originally built. See interBlockPages.ts.
   */
  useAutoAdvance(!SHOW_INTER_BLOCK_PAGES && moneyBlockCompleted && !!finalResults, handleContinue);

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
          <GlowSpan glowKey={amountGlowKey} glowColor="green.400" fontWeight="bold" color="green.400">
            {currentAmountLabel}
          </GlowSpan>
          {phraseParts[0]}
          <GlowSpan glowKey={contextGlowKey} glowColor={contextPhraseColor} fontWeight="semibold" color={contextPhraseColor}>
            {contextPhrase}
          </GlowSpan>
          {phraseParts[1]}
        </Text>
      );
    }

    return (
      <Text fontSize={{ base: "xl", md: "2xl" }} color="fg" lineHeight="tall">
        {beforeAmount}
        <GlowSpan glowKey={amountGlowKey} glowColor="green.400" fontWeight="bold" color="green.400">
          {currentAmountLabel}
        </GlowSpan>
        {afterAmount}
      </Text>
    );
  }, [currentContext, currentAmountLabel, contextPhrase, contextPhraseColor, amountGlowKey, contextGlowKey]);

  /*
   * Hidden mode: skip this block's summary screen and show the same pause the flow itself uses,
   * so the participant sees one continuous spinner into the next block rather than a flash of a
   * summary they were not meant to read. useAutoAdvance above is what moves us on.
   */
  if (moneyBlockCompleted && finalResults && !SHOW_INTER_BLOCK_PAGES) {
    return <InterBlockPause />;
  }

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

          {/*
            * Scenario panel. With an illustration it is a two-column row (picture beside the
            * question on md+, stacked on a phone); without one it is the original centred
            * single column, so contexts that have no artwork are unchanged.
            *
            * The `key` deliberately does NOT include the amount index any more. Re-keying on
            * every amount remounted the whole panel — including the picture — which restarted
            * the image element from scratch and undid the point of preloading. Keying on the
            * context alone keeps the fade for the part that should fade (the question text,
            * which carries its own key) while letting the picture cross-fade in place.
            */}
          <Box
            bg={surf.subtleBg}
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            p={{ base: "5", md: "6" }}
            minH="160px"
            key={`${currentContextIndex}-${transitionMessage ?? ""}`}
            animationName="fade-in"
            animationDuration="moderate"
          >
            {transitionMessage ? (
              <Box minH="120px" display="flex" alignItems="center" justifyContent="center">
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
                  alt={`Illustration of the scenario: ${currentContext.scenario(currentAmountLabel)}`}
                  bg={surf.cardBg}
                />
                <Box textAlign={{ base: "center", md: "left" }}>{scenarioElements}</Box>
              </SimpleGrid>
            ) : (
              <Box
                minH="120px"
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
