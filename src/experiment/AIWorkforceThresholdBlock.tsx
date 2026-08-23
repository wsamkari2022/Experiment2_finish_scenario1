import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ScenarioImage } from "./ScenarioImage";
import {
  aiWorkforceScenarioImage,
  aiWorkforceScenarioImagesFor,
} from "./scenarioImages";
import {
  BLOCK3_LEGACY_CARRYOVER_AND_AUTOBLOCK,
  BLOCKS_23_METHODOLOGY_VERSION,
} from "./blocksLegacyMethodology";
import { AIWorkforceCompletionScreen } from "./AIWorkforceCompletionScreen";
import {
  SHOW_INTER_BLOCK_PAGES,
  useAutoAdvance,
} from "./interBlockPages";
import { InterBlockPause } from "./InterBlockPause";
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
  /**
   * Which Block-2/3 methodology this session was STARTED under.
   *
   * Block 3 is the only threshold block that can resume an interrupted session from
   * localStorage. A session begun under one methodology must never be finished under the
   * other — the resulting record would mix a carry-over ladder with an independent one and
   * silently corrupt that participant's data, with nothing in the output to show it.
   * Saved progress carrying a different stamp is therefore discarded on load.
   *
   * Optional so that progress written before this field existed still parses; such a save
   * has no stamp, does not match, and is correctly discarded.
   */
  methodologyVersion?: string;
}

/** Starting position for a fresh session with no prior progress. */
const INITIAL_STATE: InProgressState = {
  currentGroupTypeIndex: 0,
  currentGroupSizeIndex: 0,
  currentGainIndex: 0,
  thresholds: {},
  history: [],
  // Starts true: the intro screen was removed, so there is nothing to acknowledge. The field
  // is kept on the state (and therefore in the saved session) so that any future intro-gating
  // logic still has a reliable signal to read. It used to be flipped from false by an effect
  // on mount, which cost a render and tripped react-hooks/set-state-in-effect for no benefit.
  introAcknowledged: true,
  methodologyVersion: BLOCKS_23_METHODOLOGY_VERSION,
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
      if (saved) {
        const parsed = JSON.parse(saved) as InProgressState;
        // Only resume a session that was started under the methodology now in force.
        // Anything else (including pre-stamp saves) restarts the block cleanly rather than
        // producing a record that is half one design and half the other.
        if (parsed.methodologyVersion === BLOCKS_23_METHODOLOGY_VERSION) return parsed;
        localStorage.removeItem(AI_WORKFORCE_PROGRESS_KEY);
      }
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
  /** The gain, worker group and group size shown last render, for detecting changes. */
  const [prevGainLabel, setPrevGainLabel] = useState(currentGain.label);
  const [prevGroupTypeKey, setPrevGroupTypeKey] = useState(currentGroupType.key);
  const [prevGroupSizeKey, setPrevGroupSizeKey] = useState(currentGroupSize.key);
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
  /** Bumped on every gain change; drives the gain GlowSpan re-animation. */
  const [gainGlowKey, setGainGlowKey] = useState(0);
  /** Bumped on every worker-group change; drives the group-type GlowSpan re-animation. */
  const [groupTypeGlowKey, setGroupTypeGlowKey] = useState(0);
  /** Bumped on every group-size change; drives the group-size GlowSpan re-animation. */
  const [groupSizeGlowKey, setGroupSizeGlowKey] = useState(0);

  /*
   * Highlights whatever just changed, so the participant can see how this question differs
   * from the last one. Three fields vary independently in this block — the financial gain, the
   * worker group and the group size — so each has its own counter and only the field that
   * actually changed lights up.
   */
  if (
    prevGainLabel !== currentGain.label ||
    prevGroupTypeKey !== currentGroupType.key ||
    prevGroupSizeKey !== currentGroupSize.key
  ) {
    if (prevGainLabel !== currentGain.label) setGainGlowKey((n) => n + 1);
    if (prevGroupTypeKey !== currentGroupType.key) setGroupTypeGlowKey((n) => n + 1);
    if (prevGroupSizeKey !== currentGroupSize.key) setGroupSizeGlowKey((n) => n + 1);
    setPrevGainLabel(currentGain.label);
    setPrevGroupTypeKey(currentGroupType.key);
    setPrevGroupSizeKey(currentGroupSize.key);
  }

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
   * METHODOLOGY — see blocksLegacyMethodology.ts for the rationale and the one-line revert.
   *   CURRENT  ("independent"): all six (group type × size) cells start at the lowest gain
   *            and every one of them is presented. No answer is ever inferred from another.
   *   ORIGINAL ("carry-over + auto-block"): the next size opened at the gain accepted for the
   *            previous size, and refusing at max gain auto-filled every LARGER size in that
   *            group as `blockedByPriorNonAcceptance` without ever asking.
   *
   * approve:
   *   - Records the current gain level as the accepted threshold for this (type, size) cell.
   *   - If more sizes remain for the current group type, advances to the next size — at the
   *     lowest gain (CURRENT) or at the accepted gain (ORIGINAL).
   *   - If all sizes are exhausted, moves to the next group type and resets gain to the
   *     lowest option.
   *   - If all group types are exhausted, calls completeBlock.
   *
   * do_not_approve:
   *   - If a higher gain option exists, escalates to the next gain level and re-presents
   *     the same (type, size) scenario (quick transition, no message).
   *   - If max gain has been reached, marks the current cell as thresholdBeyondRange and then
   *     continues to the NEXT SIZE (CURRENT), or auto-blocks the remaining larger sizes and
   *     jumps to the next group type (ORIGINAL).
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

        // Next size within the same group type.
        //   CURRENT  — restart the gain ladder at the lowest option, so this size's threshold
        //              is measured independently of the previous size's answer.
        //   ORIGINAL — continue from the gain just accepted, which made each size's threshold
        //              conditional on the one before it and unable to fall below it.
        if (gsIdx < WORKER_GROUP_SIZES.length - 1) {
          const nextState: InProgressState = {
            ...state,
            currentGroupSizeIndex: gsIdx + 1,
            currentGainIndex: BLOCK3_LEGACY_CARRYOVER_AND_AUTOBLOCK ? gIdx : 0,
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

      // ORIGINAL methodology only: infer every LARGER size in this worker group from this
      // refusal and never present them. The assumption was that refusing to displace 10
      // workers at $100M implies refusing to displace 1,000 — plausible, but it filled up to
      // four of the six cells with an inferred value rather than a measured one.
      if (BLOCK3_LEGACY_CARRYOVER_AND_AUTOBLOCK) {
        for (let i = gsIdx + 1; i < WORKER_GROUP_SIZES.length; i++) {
          const key = aiWorkforceThresholdKeyFor(gt.key, WORKER_GROUP_SIZES[i].key);
          updatedThresholds[key] = makeBlockedResult(gtIdx, i, 0);
        }
      } else if (gsIdx < WORKER_GROUP_SIZES.length - 1) {
        // CURRENT methodology: a refusal settles THIS cell only. Continue to the next size,
        // restarting the gain ladder, so every cell is answered by the participant.
        const nextState: InProgressState = {
          ...state,
          currentGroupSizeIndex: gsIdx + 1,
          currentGainIndex: 0,
          thresholds: updatedThresholds,
          history: updatedHistory,
        };
        setIsTransitioning(true);
        setTransitionMessage(
          "No approval within range for this group. Moving to a larger group size...",
        );
        setTimeout(() => {
          setState(nextState);
          setIsTransitioning(false);
          setTransitionMessage(null);
        }, TRANSITION_MS);
        return;
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
          BLOCK3_LEGACY_CARRYOVER_AND_AUTOBLOCK
            ? "No approval within range. Skipping larger sizes in this worker context..."
            : "Switching to a new worker group context...",
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
   * HIDDEN COMPLETION SCREEN — presses Continue automatically.
   *
   * Placed AFTER the effect that writes this block's results to LocalStorage, so the save is
   * guaranteed to have happened before the flow advances (effects run in declaration order).
   * When SHOW_INTER_BLOCK_PAGES is true this never fires and the summary screen is shown as
   * originally built. See interBlockPages.ts.
   */
  useAutoAdvance(!SHOW_INTER_BLOCK_PAGES && completed && !!finalResults, handleContinue);

  /**
   * Background for the small static-context panel inside the scenario card.
   *
   * `cardBg` is correct here and is deliberate: this panel is nested inside the animated
   * scenario box, which is itself painted with `subtleBg`. The panel therefore reads as a
   * RAISED surface sitting on a recessed one (light mode: white on #eef2fb; dark mode:
   * bg.panel on bg.subtle). Do not "simplify" it to `subtleBg` — that makes the panel and
   * the box around it the same colour and the nesting disappears.
   *
   * It is hoisted out of the memo below and read as a plain string so it can be listed as a
   * dependency. `surf` itself must NOT be used as a dependency: `useBlock123Surfaces()`
   * returns a fresh object every render, so depending on the object would recompute the memo
   * on every render and defeat the glow-key memoisation entirely. The resolved colour is a
   * stable string within a colour mode, which is exactly the granularity that is needed.
   */
  const scenarioPanelBg = surf.cardBg;

  /**
   * Illustration for the current (worker group, group size, gain) triple, or null when that
   * cell has no artwork — in which case the question renders full-width and centred.
   *
   * Block 3 needs all three coordinates because each picture shows the gain and the affected
   * group together on two signposts; unlike Blocks 1 and 2 the artwork is specific to the cell
   * as well as to the rung.
   */
  const scenarioImageSrc = aiWorkforceScenarioImage(
    currentGroupType.key,
    currentGroupSize.key,
    currentGain.value,
  );

  /**
   * Preload the six illustrations for the current cell when the cell opens. Each is ~60 KB, so
   * the whole cell is well under half a megabyte and the picture swap between gain levels is a
   * cache hit rather than a network round trip.
   */
  useEffect(() => {
    const sources = aiWorkforceScenarioImagesFor(
      currentGroupType.key,
      currentGroupSize.key,
      GAIN_OPTIONS.map((g) => g.value),
    );
    const preloaded = sources.map((src) => {
      const img = new window.Image();
      img.src = src;
      return img;
    });
    return () => { preloaded.length = 0; };
  }, [currentGroupType.key, currentGroupSize.key]);

  /**
   * Builds the three-line scenario card content shown inside the animated scenario box.
   * Wraps each of the three dynamic values — gain amount, worker group type, and group
   * size — in a GlowSpan keyed by its respective glow counter so only the value(s) that
   * changed since the last render animate.
   *
   * COLOUR-MODE BUG (fixed): this memo closes over a surface colour, but that colour was not
   * in the dependency array. Toggling light/dark therefore did not recompute the memo, so the
   * panel kept whatever colour was resolved on first render — which is why the box stayed
   * white after switching to Dark Mode. `scenarioPanelBg` is now a listed dependency, so the
   * panel repaints with the rest of the block. (ESLint had flagged this as a missing
   * `react-hooks/exhaustive-deps` dependency.)
   */
  /**
   * The standing framing that is identical on all 36 Block 3 questions.
   *
   * LAYOUT EXCEPTION (Block 3 only): this is rendered as a full-width bar ACROSS THE TOP of the
   * scenario card, above both the illustration and the question — not inside the text column
   * beside the picture, which is how Blocks 1 and 2 are laid out.
   *
   * The reason is that Block 3 is the only block whose scenario panel carries a second, static
   * block of prose. Once the illustration took half the width, that prose was squeezed into a
   * narrow column where it wrapped onto four lines and sat directly above the question it is
   * meant to frame, so it read as part of the question rather than as background. Spanning it
   * across the top restores the reading order — first the standing situation, then the specific
   * trade-off shown as a picture and described in words.
   *
   * It is deliberately NOT inside `scenarioContent`: that memo is keyed to the values that
   * change per question, and this text never changes.
   */
  const staticContextPanel = (
    <Box
      bg={scenarioPanelBg}
      borderWidth="1px"
      // `border`, not `border.subtle`: in Chakra dark mode bg.panel, bg.subtle and
      // border.subtle all resolve to #111111, so a subtle border left this panel with no
      // visible edge at all against the scenario box behind it. `border` is #27272a in
      // dark and #e4e4e7 in light, giving a clean outline in both modes.
      borderColor="border"
      rounded="lg"
      px={{ base: "4", md: "5" }}
      py="3"
      mb={{ base: "4", md: "5" }}
      textAlign="center"
    >
      <Text fontSize="sm" color="fg.muted" lineHeight="tall">
        You are the final decision-maker on whether to approve a rollout plan for a new AI
        workforce system in your organization.
      </Text>
    </Box>
  );

  const scenarioContent = useMemo(() => {
    return (
      <Stack gap="4" w="full">
        {/* Dynamic scenario sentence */}
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          color="fg"
          lineHeight="tall"
          textAlign="center"
        >
          Approving it would generate{" "}
          <GlowSpan glowKey={gainGlowKey} glowColor={GAIN_COLOR} fontWeight="bold" color={GAIN_COLOR}>
            {currentGain.label}
          </GlowSpan>{" "}
          in financial gain for the company, but it is expected to cause{" "}
          <Text as="span" color="fg">
            {FIXED_HARM_PHRASE}
          </Text>{" "}
          for{" "}
          <GlowSpan glowKey={groupTypeGlowKey} glowColor={GROUP_TYPE_COLOR} fontWeight="bold" color={GROUP_TYPE_COLOR}>
            {currentGroupType.label}
          </GlowSpan>
          <WorkerGroupInfoIcon
            label={currentGroupType.shortLabel}
            definition={currentGroupType.definition}
          />{" "}
          in a{" "}
          <GlowSpan glowKey={groupSizeGlowKey} glowColor={GROUP_SIZE_COLOR} fontWeight="bold" color={GROUP_SIZE_COLOR}>
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
  }, [currentGain, currentGroupType, currentGroupSize, gainGlowKey, groupTypeGlowKey, groupSizeGlowKey]);

  /*
   * Hidden mode: skip this block's summary screen and show the same pause the flow itself uses,
   * so the participant sees one continuous spinner into the next block rather than a flash of a
   * summary they were not meant to read. useAutoAdvance above is what moves us on.
   */
  if (completed && finalResults && !SHOW_INTER_BLOCK_PAGES) {
    return <InterBlockPause />;
  }

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

          {/*
            * Scenario panel. With an illustration it is a two-column row (picture beside the
            * question on md+, stacked on a phone); without one it is the original centred
            * single column, so a cell with no artwork is unchanged.
            *
            * The `key` deliberately does NOT include the gain index. Re-keying on every gain
            * level remounted the whole panel including the picture, which restarted the image
            * element from scratch and undid the point of preloading. Keying on the CELL lets
            * the picture cross-fade in place while the sentence keeps its own glow animation.
            */}
          <Box
            bg={surf.subtleBg}
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            p={{ base: "5", md: "6" }}
            minH="220px"
            key={`${state.currentGroupTypeIndex}-${state.currentGroupSizeIndex}-${transitionMessage ?? ""}`}
            animationName="fade-in"
            animationDuration="moderate"
          >
            {transitionMessage ? (
              <Box minH="180px" display="flex" alignItems="center" justifyContent="center">
                <Text fontSize="lg" color="fg.muted" fontStyle="italic">
                  {transitionMessage}
                </Text>
              </Box>
            ) : scenarioImageSrc ? (
              <>
                {staticContextPanel}
                <SimpleGrid
                  columns={{ base: 1, md: 2 }}
                  gap={{ base: "5", md: "6" }}
                  alignItems="center"
                >
                  <ScenarioImage
                    src={scenarioImageSrc}
                    alt={`Illustration: a choice between ${currentGain.label} in financial gain and the jobs of a ${currentGroupSize.label} of ${currentGroupType.label}`}
                    bg={surf.cardBg}
                  />
                  <Box textAlign={{ base: "center", md: "left" }}>{scenarioContent}</Box>
                </SimpleGrid>
              </>
            ) : (
              <Box minH="180px" textAlign="center">
                {staticContextPanel}
                {scenarioContent}
              </Box>
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
              {wg.shortLabel} — {wg.tagline}
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
