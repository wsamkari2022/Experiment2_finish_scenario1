import { Box, Center, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { LuCheck, LuFlag } from "react-icons/lu";
import { SHOW_INTER_BLOCK_PAGES } from "./interBlockPages";

/**
 * GlobalStepper — the sticky journey bar across the top of Blocks 1-4.
 *
 * ============================================================================
 * WHAT IT SHOWS
 * ============================================================================
 * One continuous rail, left to right, with a node per section and the MAIN STUDY as the
 * destination at the far end:
 *
 *     (check)━━━━━(2)─────(3)─────(4)┈┈┈┈┈(flag)  Main study
 *   Found money  Trolley  AI...  Reflection        after 2 more sections
 *
 * Completed sections carry a green check and a solid green rail behind them; the current one is
 * a blue ring; upcoming ones are muted outlines. The destination is purple, larger than the
 * others, and breathes slowly.
 *
 * ============================================================================
 * WHY IT IS BUILT THIS WAY
 * ============================================================================
 * A progress indicator in a study this long is doing motivational work, not just informational
 * work. Three deliberate choices follow from that:
 *
 *   1. ONE CONTINUOUS RAIL, not separate chips. Disconnected boxes read as a list of tasks;
 *      a rail reads as a route with a start and an end. The eye follows it to the destination.
 *
 *   2. THE DESTINATION SITS ON THE RAIL. "Main study" used to be a pill floating past a divider
 *      on the right, which made it look like a section label rather than somewhere you arrive.
 *      Putting it on the same line, at the end, larger, with a finish-line flag, makes the goal
 *      the visual terminus of the journey.
 *
 *   3. THE LAST SEGMENT IS DASHED. The gap between the final section and the destination is
 *      drawn as a dashed line: it is not work to be ticked off, it is the threshold you cross.
 *
 * The distance to the goal is stated in words ("after 2 more sections") rather than as a bare
 * count, because a number alone was ambiguous about whether the current section was included.
 *
 * ============================================================================
 * MOTION
 * ============================================================================
 * The destination has a slow looping halo (`vrds-goal-beacon`, defined in index.html). This is
 * the ONE looping animation in the experiment; every other glow in the app is a one-shot "this
 * just changed" signal (see GlowSpan), and that meaning is kept distinct on purpose. The loop is
 * slow and low-amplitude so it reads as ambient over a long session, and it is disabled for
 * participants whose OS requests reduced motion.
 *
 * The component is purely presentational: it reads a stage string and nothing else.
 */

interface Phase {
  label: string;
  /** ExperimentFlow stage strings that map to this phase. */
  stages: string[];
  /**
   * True for the two between-block summary pages. These are hidden from participants by
   * default (see interBlockPages.ts) and are then dropped from the bar as well.
   */
  interstitial?: boolean;
}

/** Every pre-Block-5 phase, in order. */
const ALL_PHASES: Phase[] = [
  { label: "Found money", stages: ["money"] },
  { label: "Trolley", stages: ["trolley"] },
  { label: "AI workforce", stages: ["product"] },
  { label: "Profile preview", stages: ["insights"], interstitial: true },
  { label: "Reflection", stages: ["block4"] },
  { label: "Your profile", stages: ["final_analysis"], interstitial: true },
];

/**
 * The phases actually drawn — four when the between-block pages are hidden, six when they are shown.
 *
 * WHY FILTER RATHER THAN LEAVE THEM GRAYED OUT: a progress bar is a promise about how much work
 * is left. Listing two steps the participant never performs would make them expect six pieces of
 * work and then watch two of them tick over to a green check on their own, which invites exactly
 * the question ("what did I just skip?") that hiding the pages was meant to avoid.
 *
 * The numbering follows automatically, so Reflection is step 4 of 4 rather than 5 of 6.
 */
const PHASES: Phase[] = SHOW_INTER_BLOCK_PAGES
  ? ALL_PHASES
  : ALL_PHASES.filter((p) => !p.interstitial);

/** Returns the active phase index for a stage, or -1 if the stepper should not show. */
function phaseIndexForStage(stage: string): number {
  return PHASES.findIndex((p) => p.stages.includes(stage));
}

/**
 * Height of the row every node's circle is vertically centered in.
 *
 * The destination marker is larger than the section markers, so without a shared row their
 * centers would not line up and the rail would visibly kink at the end. Centering every circle
 * inside a fixed-height row puts all centers on the same line, which is also the offset the
 * connectors use (RAIL_ROW_H / 2).
 */
const RAIL_ROW_H = { base: "8", md: "10" };
/** Half of RAIL_ROW_H — the top offset that drops a connector onto the center line. */
const RAIL_CENTER = { base: "4", md: "5" };

type NodeState = "done" | "current" | "upcoming";

/** One section marker: the numbered (or ticked) circle plus its label underneath. */
function PhaseNode({
  state,
  index,
  label,
}: {
  state: NodeState;
  index: number;
  label: string;
}) {
  const done = state === "done";
  const current = state === "current";

  return (
    <VStack gap={{ base: "1", md: "1.5" }} flexShrink={0}>
      <Center h={RAIL_ROW_H}>
        <Center
          boxSize={current ? { base: "7", md: "8" } : { base: "6", md: "7" }}
          rounded="full"
          bg={done ? "green.solid" : current ? "blue.solid" : "bg.muted"}
          color={done ? "green.contrast" : current ? "blue.contrast" : "fg.subtle"}
          borderWidth={state === "upcoming" ? "1px" : "0"}
          borderColor="border"
          // The ring is what makes "you are here" readable at a glance without color alone.
          boxShadow={current ? "0 0 0 4px {colors.blue.muted}" : undefined}
          fontSize="xs"
          fontWeight="bold"
          transition="all 0.35s ease"
        >
          {done ? (
            <Icon boxSize="3.5">
              <LuCheck />
            </Icon>
          ) : (
            index + 1
          )}
        </Center>
      </Center>
      <Text
        fontSize="xs"
        fontWeight={current ? "semibold" : "medium"}
        color={current ? "fg" : done ? "fg.muted" : "fg.subtle"}
        display={{ base: "none", md: "block" }}
        whiteSpace="nowrap"
        transition="color 0.35s ease"
      >
        {label}
      </Text>
    </VStack>
  );
}

/**
 * A stretch of rail between two section markers. `filled` paints it green — that stretch is
 * behind you. The final approach into the destination is a different thing entirely; see
 * GoalApproach.
 */
function RailSegment({ filled }: { filled: boolean }) {
  return (
    <Box
      mt={RAIL_CENTER}
      flex="1"
      minW={{ base: "3", md: "6" }}
      h="0.5"
      rounded="full"
      bg={filled ? "green.solid" : "border"}
      transition="background-color 0.35s ease"
      alignSelf="flex-start"
    />
  );
}

/**
 * The dashed hop from the last section into the destination.
 *
 * Dashed rather than solid because it is not a task to tick off — it is the threshold the
 * participant crosses when the profiling sections are done. It is rendered OUTSIDE the
 * scrolling phase rail (see below) so that it always physically joins the rail to the goal,
 * however narrow the screen is.
 */
function GoalApproach() {
  return (
    <Box
      mt={RAIL_CENTER}
      w={{ base: "5", md: "12" }}
      flexShrink={0}
      borderBottomWidth="2px"
      borderStyle="dashed"
      borderColor="purple.solid"
      opacity="0.55"
    />
  );
}

/**
 * The destination marker — the whole point of the bar.
 *
 * Deliberately different from the section markers in every dimension the eye picks up: bigger,
 * purple rather than blue/green, an icon rather than a number, its label beside it rather than
 * beneath, and the only thing on screen that moves. It should be impossible to mistake for
 * another step in the queue.
 */
function GoalMarker({ remaining }: { remaining: number }) {
  const note =
    remaining === 0
      ? "Up next"
      : `After ${remaining} more section${remaining === 1 ? "" : "s"}`;

  return (
    <HStack gap={{ base: "2", md: "2.5" }} flexShrink={0} align="flex-start">
      <Center h={RAIL_ROW_H}>
        <Center
          className="vrds-goal-beacon"
          boxSize={{ base: "8", md: "10" }}
          rounded="full"
          bgGradient="to-br"
          gradientFrom="purple.400"
          gradientTo="purple.600"
          color="white"
          aria-label={`Main study, the goal of this session. ${note}.`}
        >
          <Icon boxSize={{ base: "4", md: "5" }}>
            <LuFlag />
          </Icon>
        </Center>
      </Center>
      {/*
        Below sm the wording is dropped and the flag speaks for itself. On a 360px phone the
        four section markers, the flag and the floating theme toggle cannot all fit with the
        words as well, and losing a section marker off the rail is worse than losing the caption
        next to a universally readable finish-flag. aria-label keeps it announced either way.
      */}
      <VStack
        gap="0"
        align="start"
        mt={{ base: "1", md: "1.5" }}
        display={{ base: "none", sm: "flex" }}
      >
        <Text
          fontSize={{ base: "xs", md: "sm" }}
          fontWeight="bold"
          color="purple.fg"
          whiteSpace="nowrap"
          letterSpacing="tight"
        >
          Main study
        </Text>
        <Text
          fontSize="2xs"
          color="fg.muted"
          whiteSpace="nowrap"
          display={{ base: "none", md: "block" }}
        >
          {note}
        </Text>
      </VStack>
    </HStack>
  );
}

export function GlobalStepper({ stage }: { stage: string }) {
  const current = phaseIndexForStage(stage);
  if (current < 0) return null; // hidden during transitions, Block 5, and the summary

  /** Sections still to come after the one in progress. Drives the "after N more" line. */
  const remaining = PHASES.length - current - 1;

  return (
    <Box
      position="sticky"
      top="0"
      zIndex="20"
      bg="bg.panel"
      borderBottomWidth="1px"
      borderColor="border"
      /*
       * pl and pr are set separately rather than as px plus a pr override: the emitted order of
       * the padding-inline shorthand against padding-inline-end is not guaranteed, and the
       * shorthand silently won.
       *
       * The larger right padding below xl keeps the goal marker clear of the floating light/dark
       * toggle (App.tsx: pos="fixed" top=4 right=4, so it owns the top-right ~56px). From xl up
       * the maxW="5xl" content is centered well inside that corner and the padding drops back.
       */
      pl={{ base: "3", md: "6" }}
      pr={{ base: "16", xl: "6" }}
      py="2.5"
      backdropFilter="blur(10px)"
      shadow="sm"
    >
      <HStack maxW="5xl" mx="auto" gap="0" align="flex-start">
        {/*
          Only the section rail scrolls. If the whole bar scrolled, a narrow screen would push
          the destination out of view — and the destination is the one part a participant on a
          phone most needs to see.
        */}
        <HStack
          flex="1"
          minW="0"
          gap={{ base: "2", md: "3" }}
          align="flex-start"
          overflowX="auto"
          css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
        >
          {PHASES.map((p, i) => (
            <HStack
              key={p.label}
              gap={{ base: "2", md: "3" }}
              align="flex-start"
              flex="1"
              minW="fit-content"
            >
              <PhaseNode
                state={i < current ? "done" : i === current ? "current" : "upcoming"}
                index={i}
                label={p.label}
              />
              <RailSegment filled={i < current} />
            </HStack>
          ))}
        </HStack>
        <GoalApproach />
        <GoalMarker remaining={remaining} />
      </HStack>
    </Box>
  );
}
