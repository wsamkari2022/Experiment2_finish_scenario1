import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ProgressBar } from "./ProgressBar";
import { ProductLaunchCompletionScreen } from "./ProductLaunchCompletionScreen";
import {
  GROUP_SIZES,
  GROUP_TYPES,
  PROFIT_OPTIONS,
  type LaunchAction,
  type LaunchThresholdResult,
  type ProductLaunchBlockResults,
  type ProductLaunchChoiceRecord,
  type ThresholdKey,
  type ThresholdsMap,
  thresholdKeyFor,
} from "./productLaunchTypes";

const TRANSITION_MS = 900;
const QUICK_ADVANCE_MS = 300;
const STORAGE_KEY_PROGRESS = "product_launch_block_progress";
const STORAGE_KEY_RESULTS = "product_launch_block_results";

const PROFIT_COLOR = "green.300";
const GROUP_TYPE_COLOR = "yellow.300";
const GROUP_SIZE_COLOR = "blue.400";

interface InProgressState {
  currentGroupTypeIndex: number;
  currentGroupSizeIndex: number;
  currentProfitIndex: number;
  thresholds: Partial<ThresholdsMap>;
  history: ProductLaunchChoiceRecord[];
}

const INITIAL_STATE: InProgressState = {
  currentGroupTypeIndex: 0,
  currentGroupSizeIndex: 0,
  currentProfitIndex: 0,
  thresholds: {},
  history: [],
};

interface ProductLaunchThresholdBlockProps {
  participantId?: string;
  onContinue?: (results: ProductLaunchBlockResults) => void;
}

function makeBlockedResult(
  groupTypeIndex: number,
  groupSizeIndex: number,
  startedAtProfitIndex: number,
): LaunchThresholdResult {
  const gt = GROUP_TYPES[groupTypeIndex];
  const gs = GROUP_SIZES[groupSizeIndex];
  return {
    groupTypeKey: gt.key,
    groupTypeLabel: gt.label,
    groupSizeKey: gs.key,
    groupSizeLabel: gs.label,
    groupSizeCount: gs.count,
    accepted: false,
    thresholdProfit: null,
    thresholdProfitLabel: null,
    thresholdProfitIndex: null,
    thresholdBeyondRange: false,
    blockedByPriorNonAcceptance: true,
    startedAtProfitIndex,
  };
}

export function ProductLaunchThresholdBlock({
  participantId,
  onContinue,
}: ProductLaunchThresholdBlockProps) {
  const [state, setState] = useState<InProgressState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (saved) return JSON.parse(saved) as InProgressState;
    } catch {
      // ignore
    }
    return INITIAL_STATE;
  });
  const [productLaunchBlockCompleted, setProductLaunchBlockCompleted] =
    useState(false);
  const [finalResults, setFinalResults] =
    useState<ProductLaunchBlockResults | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(
    null,
  );

  // Persist progress
  useEffect(() => {
    if (productLaunchBlockCompleted) return;
    try {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, productLaunchBlockCompleted]);

  const currentGroupType = GROUP_TYPES[state.currentGroupTypeIndex];
  const currentGroupSize = GROUP_SIZES[state.currentGroupSizeIndex];
  const currentProfit = PROFIT_OPTIONS[state.currentProfitIndex];

  const currentSubcontextIndex =
    state.currentGroupTypeIndex * GROUP_SIZES.length +
    state.currentGroupSizeIndex;

  const completeProductLaunchBlock = useCallback(
    (finalState: InProgressState) => {
      // Fill in any missing thresholds as blocked (shouldn't normally happen)
      const thresholds: ThresholdsMap = {} as ThresholdsMap;
      for (let gti = 0; gti < GROUP_TYPES.length; gti++) {
        for (let gsi = 0; gsi < GROUP_SIZES.length; gsi++) {
          const key = thresholdKeyFor(
            GROUP_TYPES[gti].key,
            GROUP_SIZES[gsi].key,
          );
          thresholds[key] =
            finalState.thresholds[key] ?? makeBlockedResult(gti, gsi, 0);
        }
      }

      const results: ProductLaunchBlockResults = {
        completed: true,
        completedAt: new Date().toISOString(),
        thresholds,
        history: finalState.history,
      };

      try {
        localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(results));
        localStorage.removeItem(STORAGE_KEY_PROGRESS);
      } catch {
        // ignore
      }

      setFinalResults(results);
      setProductLaunchBlockCompleted(true);
    },
    [],
  );

  const handleLaunchChoice = useCallback(
    (action: LaunchAction) => {
      if (isTransitioning || productLaunchBlockCompleted) return;

      const gtIdx = state.currentGroupTypeIndex;
      const gsIdx = state.currentGroupSizeIndex;
      const pIdx = state.currentProfitIndex;
      const gt = GROUP_TYPES[gtIdx];
      const gs = GROUP_SIZES[gsIdx];
      const p = PROFIT_OPTIONS[pIdx];

      const record: ProductLaunchChoiceRecord = {
        groupTypeKey: gt.key,
        groupTypeLabel: gt.label,
        groupSizeKey: gs.key,
        groupSizeLabel: gs.label,
        groupSizeCount: gs.count,
        profitIndex: pIdx,
        profitValue: p.value,
        profitLabel: p.label,
        action,
        timestamp: new Date().toISOString(),
      };
      const updatedHistory = [...state.history, record];
      const thresholdKey: ThresholdKey = thresholdKeyFor(gt.key, gs.key);

      if (action === "launch") {
        // Record acceptance threshold for this subcontext
        const acceptedThreshold: LaunchThresholdResult = {
          groupTypeKey: gt.key,
          groupTypeLabel: gt.label,
          groupSizeKey: gs.key,
          groupSizeLabel: gs.label,
          groupSizeCount: gs.count,
          accepted: true,
          thresholdProfit: p.value,
          thresholdProfitLabel: p.label,
          thresholdProfitIndex: pIdx,
          thresholdBeyondRange: false,
          blockedByPriorNonAcceptance: false,
          startedAtProfitIndex:
            state.thresholds[thresholdKey]?.startedAtProfitIndex ?? pIdx,
        };
        const nextThresholds: Partial<ThresholdsMap> = {
          ...state.thresholds,
          [thresholdKey]: acceptedThreshold,
        };

        // Decide next subcontext
        if (gsIdx < GROUP_SIZES.length - 1) {
          // Move to next size within same group type, starting at same profit index
          const nextState: InProgressState = {
            ...state,
            currentGroupSizeIndex: gsIdx + 1,
            currentProfitIndex: pIdx,
            thresholds: nextThresholds,
            history: updatedHistory,
          };
          setIsTransitioning(true);
          setTransitionMessage(
            "Threshold recorded. Moving to the next group size...",
          );
          setTimeout(() => {
            setState(nextState);
            setIsTransitioning(false);
            setTransitionMessage(null);
          }, TRANSITION_MS);
          return;
        }

        // Last size for this group type complete, move to next group type or finish
        if (gtIdx < GROUP_TYPES.length - 1) {
          const nextState: InProgressState = {
            ...state,
            currentGroupTypeIndex: gtIdx + 1,
            currentGroupSizeIndex: 0,
            currentProfitIndex: 0,
            thresholds: nextThresholds,
            history: updatedHistory,
          };
          setIsTransitioning(true);
          setTransitionMessage(
            "Switching to a new affected group context...",
          );
          setTimeout(() => {
            setState(nextState);
            setIsTransitioning(false);
            setTransitionMessage(null);
          }, TRANSITION_MS);
          return;
        }

        // All done
        const finalState: InProgressState = {
          ...state,
          thresholds: nextThresholds,
          history: updatedHistory,
        };
        setIsTransitioning(true);
        setTransitionMessage("Threshold recorded. Preparing summary...");
        setTimeout(() => {
          completeProductLaunchBlock(finalState);
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
      }

      // action === "do_not_launch"
      const nextProfitIndex = pIdx + 1;
      if (nextProfitIndex < PROFIT_OPTIONS.length) {
        // Just advance profit quickly and silently
        const nextState: InProgressState = {
          ...state,
          currentProfitIndex: nextProfitIndex,
          history: updatedHistory,
        };
        setIsTransitioning(true);
        setTimeout(() => {
          setState(nextState);
          setIsTransitioning(false);
        }, QUICK_ADVANCE_MS);
        return;
      }

      // Reached max profit and still rejected: threshold beyond range
      const beyondRange: LaunchThresholdResult = {
        groupTypeKey: gt.key,
        groupTypeLabel: gt.label,
        groupSizeKey: gs.key,
        groupSizeLabel: gs.label,
        groupSizeCount: gs.count,
        accepted: false,
        thresholdProfit: null,
        thresholdProfitLabel: null,
        thresholdProfitIndex: null,
        thresholdBeyondRange: true,
        blockedByPriorNonAcceptance: false,
        startedAtProfitIndex:
          state.thresholds[thresholdKey]?.startedAtProfitIndex ?? 0,
      };
      const updatedThresholds: Partial<ThresholdsMap> = {
        ...state.thresholds,
        [thresholdKey]: beyondRange,
      };

      // Block all larger sizes within this group type
      for (let i = gsIdx + 1; i < GROUP_SIZES.length; i++) {
        const key = thresholdKeyFor(gt.key, GROUP_SIZES[i].key);
        updatedThresholds[key] = makeBlockedResult(gtIdx, i, 0);
      }

      // Move to next group type if any
      if (gtIdx < GROUP_TYPES.length - 1) {
        const nextState: InProgressState = {
          ...state,
          currentGroupTypeIndex: gtIdx + 1,
          currentGroupSizeIndex: 0,
          currentProfitIndex: 0,
          thresholds: updatedThresholds,
          history: updatedHistory,
        };
        setIsTransitioning(true);
        setTransitionMessage(
          "No launch decision was accepted within range. Skipping larger group sizes in this context...",
        );
        setTimeout(() => {
          setState(nextState);
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
      }

      // No more group types, complete
      const finalState: InProgressState = {
        ...state,
        thresholds: updatedThresholds,
        history: updatedHistory,
      };
      setIsTransitioning(true);
      setTransitionMessage(
        "No launch decision was accepted within range. Preparing summary...",
      );
      setTimeout(() => {
        completeProductLaunchBlock(finalState);
        setIsTransitioning(false);
        setTransitionMessage(null);
      }, TRANSITION_MS);
    },
    [
      state,
      isTransitioning,
      productLaunchBlockCompleted,
      completeProductLaunchBlock,
    ],
  );

  const handleContinue = useCallback(() => {
    if (!finalResults) return;
    console.log("Product launch block results:", finalResults);
    onContinue?.(finalResults);
  }, [finalResults, onContinue]);

  const scenarioSentence = useMemo(() => {
    return (
      <Text
        fontSize={{ base: "xl", md: "2xl" }}
        color="fg"
        lineHeight="tall"
      >
        You are responsible for deciding whether to launch a new product.
        Launching it would generate{" "}
        <Text as="span" fontWeight="bold" color={PROFIT_COLOR}>
          {currentProfit.label}
        </Text>{" "}
        in profit for the company, but it is expected to cause serious harm to{" "}
        <Text as="span" fontWeight="bold" color={GROUP_TYPE_COLOR}>
          {currentGroupType.label}
        </Text>{" "}
        in a{" "}
        <Text as="span" fontWeight="bold" color={GROUP_SIZE_COLOR}>
          {currentGroupSize.label}
        </Text>
        . Would you launch the product?
      </Text>
    );
  }, [currentProfit, currentGroupType, currentGroupSize]);

  if (productLaunchBlockCompleted && finalResults) {
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
          <ProductLaunchCompletionScreen
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
            total={GROUP_TYPES.length * GROUP_SIZES.length}
            current={currentSubcontextIndex}
          />

          <VStack gap="3" textAlign="center">
            <Heading
              size="xl"
              color="fg"
              fontWeight="semibold"
              letterSpacing="tight"
            >
              Product Launch Decisions
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
              Scenario {currentSubcontextIndex + 1} of {GROUP_TYPES.length * GROUP_SIZES.length}
            </Badge>
          </VStack>

          <HStack gap="2" justify="center" wrap="wrap">
            <Badge colorPalette="green" variant="subtle" px="3" py="1" rounded="md">
              Profit
            </Badge>
            <Badge colorPalette="yellow" variant="subtle" px="3" py="1" rounded="md">
              Group Type
            </Badge>
            <Badge colorPalette="blue" variant="subtle" px="3" py="1" rounded="md">
              Group Size
            </Badge>
          </HStack>

          <Box
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            p={{ base: "6", md: "8" }}
            textAlign="center"
            minH="200px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            key={`${state.currentGroupTypeIndex}-${state.currentGroupSizeIndex}-${state.currentProfitIndex}-${transitionMessage ?? ""}`}
            animationName="fade-in"
            animationDuration="moderate"
          >
            {transitionMessage ? (
              <Text fontSize="lg" color="fg.muted" fontStyle="italic">
                {transitionMessage}
              </Text>
            ) : (
              scenarioSentence
            )}
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {[
              { key: "launch" as LaunchAction, label: "Launch the product" },
              {
                key: "do_not_launch" as LaunchAction,
                label: "Do not launch the product",
              },
            ].map((btn) => (
              <Button
                key={btn.key}
                size="xl"
                onClick={() => handleLaunchChoice(btn.key)}
                disabled={isTransitioning || !!transitionMessage}
                bg="gray.900"
                color="white"
                _hover={{ bg: "gray.800" }}
                _active={{ bg: "gray.950" }}
                _disabled={{
                  bg: "gray.900",
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

export default ProductLaunchThresholdBlock;
