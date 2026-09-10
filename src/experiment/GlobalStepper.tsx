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

/**
 * ============================================================================
 * THE WHOLE JOURNEY — not just the run-up to it
 * ============================================================================
 * The rail used to stop at the four profiling sections and put a finish-line flag immediately
 * after them, captioned "Main study". At the moment a participant finished section four it
 * therefore read:
 *
 *     (check)(check)(check)(check) ┈┈┈ (flag)
 *
 * Four of four complete, then a finish flag. That is a picture of a finished study, and people
 * who skim believe the picture over the caption -- several stopped there in the previous run.
 * The words said "the main study starts now"; every visual said "done".
 *
 * The rail now carries the ENTIRE session, so the main study is the large middle of the journey
 * rather than its terminus, and the flag sits where a flag belongs -- at the actual end:
 *
 *     (1)(2)(3)(4) ── (o o o o o) ── (.)(.)  ┈┈┈ (flag)
 *                      Main study    results  Finish
 *                      5 scenarios   feedback
 *
 * The five empty circles are the load-bearing part. They say "five situations still to come"
 * without a sentence anyone has to read, and they are the same five the participant then sees
 * counted off as "Scenario 1 of 5" inside the block, so the promise matches the experience.
 */
type Stop =
  | { kind: "section"; label: string; stages: string[] }
  /** The main study, drawn as one dot per scenario. */
  | { kind: "main"; label: string; note: string; stages: string[]; dots: number }
  /** What follows the main study: results, then feedback. */
  | { kind: "tail"; label: string; stages: string[] };

const STOPS: Stop[] = [
  ...PHASES.map((p): Stop => ({ kind: "section", label: p.label, stages: p.stages })),
  {
    kind: "main",
    label: "Main study",
    note: "5 scenarios",
    /* block5_intro is the doorway page and block5 the scenarios themselves; both are "here". */
    stages: ["block5_intro", "block5"],
    dots: 5,
  },
  { kind: "tail", label: "Your results", stages: ["block5_summary"] },
  { kind: "tail", label: "Feedback", stages: ["feedback"] },
];

/** Returns the active stop index for a stage, or -1 if the stepper should not show. */
function stopIndexForStage(stage: string): number {
  return STOPS.findIndex((s) => s.stages.includes(stage));
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
 * The main study, drawn as five circles in one capsule.
 *
 * Deliberately the widest thing on the rail. A single node here would make five scenarios look
 * like one more step the size of "Trolley", which is the misreading the whole change exists to
 * prevent. The dots do not fill in one at a time -- the bar is presentational and does not know
 * the scenario index -- so they are empty until the block is behind the participant. That is
 * enough: the count is what has to be legible at the boundary, not live progress.
 */
function MainStudyGroup({
  state,
  dots,
  label,
  note,
}: {
  state: NodeState;
  dots: number;
  label: string;
  note: string;
}) {
  const done = state === "done";
  const current = state === "current";

  return (
    <VStack gap={{ base: "1", md: "1.5" }} flexShrink={0}>
      <Center h={RAIL_ROW_H}>
        <HStack
          gap={{ base: "1", md: "1.5" }}
          px={{ base: "2", md: "2.5" }}
          py={{ base: "1.5", md: "2" }}
          rounded="full"
          bg={done ? "green.subtle" : current ? "purple.subtle" : "bg.muted"}
          borderWidth={current ? "2px" : "1px"}
          borderColor={done ? "green.solid" : current ? "purple.solid" : "border"}
          boxShadow={current ? "0 0 0 4px {colors.purple.muted}" : undefined}
          transition="all 0.35s ease"
          aria-label={`${label}, ${note}`}
        >
          {Array.from({ length: dots }, (_, i) => (
            <Box
              key={i}
              boxSize={{ base: "1.5", md: "2" }}
              rounded="full"
              bg={done ? "green.solid" : "transparent"}
              borderWidth={done ? "0" : "1.5px"}
              borderColor={current ? "purple.solid" : "border"}
              transition="all 0.35s ease"
            />
          ))}
        </HStack>
      </Center>
      <VStack gap="0" display={{ base: "none", md: "flex" }}>
        <Text
          fontSize="xs"
          fontWeight={current ? "bold" : "semibold"}
          color={current ? "purple.fg" : done ? "fg.muted" : "fg.subtle"}
          whiteSpace="nowrap"
          transition="color 0.35s ease"
        >
          {label}
        </Text>
        <Text fontSize="2xs" color="fg.muted" whiteSpace="nowrap">
          {note}
        </Text>
      </VStack>
    </VStack>
  );
}

/**
 * A stop after the main study: the results page, then feedback.
 *
 * Smaller than a section marker and unnumbered on purpose. Numbering them would restart a count
 * the participant already finished at four, and these are short pages rather than sections of
 * work — but they still have to appear, because they are the reason the flag is not next.
 */
function TailNode({ state, label }: { state: NodeState; label: string }) {
  const done = state === "done";
  const current = state === "current";

  return (
    <VStack gap={{ base: "1", md: "1.5" }} flexShrink={0}>
      <Center h={RAIL_ROW_H}>
        <Center
          boxSize={current ? { base: "6", md: "7" } : { base: "5", md: "6" }}
          rounded="full"
          bg={done ? "green.solid" : current ? "blue.solid" : "bg.muted"}
          color={done ? "green.contrast" : current ? "blue.contrast" : "fg.subtle"}
          borderWidth={state === "upcoming" ? "1px" : "0"}
          borderColor="border"
          boxShadow={current ? "0 0 0 4px {colors.blue.muted}" : undefined}
          transition="all 0.35s ease"
        >
          {done ? (
            <Icon boxSize="3">
              <LuCheck />
            </Icon>
          ) : (
            <Box
              boxSize="1.5"
              rounded="full"
              bg={current ? "blue.contrast" : "fg.subtle"}
            />
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
function GoalMarker({ reached }: { reached: boolean }) {
  /*
   * No countdown here any more.
   *
   * It used to read "After N more sections", which is now unsayable without lying in one
   * direction or the other: the main study is ONE stop on the rail but five scenarios of work,
   * so any number either oversells how close the end is or undersells what is left. The rail
   * itself shows the distance, and it is drawn to scale. The flag just names the end.
   */
  const note = reached ? "You are nearly there" : "End of the study";

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
          aria-label={`Finish — the end of the study. ${note}.`}
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
          Finish
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
  const current = stopIndexForStage(stage);
  if (current < 0) return null; // hidden during the transition spinners

  /** True on the last stop, where the flag really is the next thing. */
  const reached = current === STOPS.length - 1;

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
          {STOPS.map((s, i) => {
            const state: NodeState = i < current ? "done" : i === current ? "current" : "upcoming";
            return (
              <HStack
                key={s.label}
                gap={{ base: "2", md: "3" }}
                align="flex-start"
                /* The main study is allowed to take the room its five dots need; everything else
                   shares what is left, so the cluster stays legible on a narrow screen. */
                flex={s.kind === "main" ? "0 0 auto" : "1"}
                minW="fit-content"
              >
                {s.kind === "section" && <PhaseNode state={state} index={i} label={s.label} />}
                {s.kind === "main" && (
                  <MainStudyGroup state={state} dots={s.dots} label={s.label} note={s.note} />
                )}
                {s.kind === "tail" && <TailNode state={state} label={s.label} />}
                <RailSegment filled={i < current} />
              </HStack>
            );
          })}
        </HStack>
        <GoalApproach />
        <GoalMarker reached={reached} />
      </HStack>
    </Box>
  );
}
