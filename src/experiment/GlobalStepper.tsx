import { Box, HStack, Icon, Text } from "@chakra-ui/react";
import { LuCheck } from "react-icons/lu";

/**
 * GlobalStepper — a slim, sticky progress bar across the whole pre-experiment
 * value-profiling journey (Blocks 1–4 + the two summary pages) that leads into
 * Block 5. Completed phases show a green check; the current phase is accented;
 * upcoming phases are muted. A trailing "Main study" marker shows the destination.
 *
 * It is purely presentational and does not touch experiment state or Block 5.
 */

interface Phase {
  label: string;
  /** ExperimentFlow stage strings that map to this phase. */
  stages: string[];
}

/** The six pre-Block-5 phases, in order. */
const PHASES: Phase[] = [
  { label: "Found money", stages: ["money"] },
  { label: "Trolley", stages: ["trolley"] },
  { label: "AI workforce", stages: ["product"] },
  { label: "Profile preview", stages: ["insights"] },
  { label: "Reflection", stages: ["block4"] },
  { label: "Your profile", stages: ["final_analysis"] },
];

/** Returns the active phase index for a stage, or -1 if the stepper should not show. */
function phaseIndexForStage(stage: string): number {
  return PHASES.findIndex((p) => p.stages.includes(stage));
}

function Node({
  state,
  index,
  label,
}: {
  state: "done" | "current" | "upcoming";
  index: number;
  label: string;
}) {
  const circleBg = state === "done" ? "green.500" : state === "current" ? "blue.500" : "bg.muted";
  const circleColor = state === "upcoming" ? "fg.subtle" : "white";
  const ring = state === "current" ? "0 0 0 4px {colors.blue.subtle}" : undefined;
  return (
    <HStack gap="2" flexShrink={0}>
      <Box
        w="6.5" h="6.5" minW="6.5" rounded="full" bg={circleBg} color={circleColor}
        display="flex" alignItems="center" justifyContent="center"
        fontSize="xs" fontWeight="bold" boxShadow={ring} transition="all 0.2s"
      >
        {state === "done" ? <Icon boxSize="3.5"><LuCheck /></Icon> : index + 1}
      </Box>
      <Text
        fontSize="xs"
        fontWeight={state === "current" ? "semibold" : "normal"}
        color={state === "current" ? "fg" : state === "done" ? "fg.muted" : "fg.subtle"}
        display={{ base: "none", md: "block" }}
        whiteSpace="nowrap"
      >
        {label}
      </Text>
    </HStack>
  );
}

export function GlobalStepper({ stage }: { stage: string }) {
  const current = phaseIndexForStage(stage);
  if (current < 0) return null; // hidden during transitions, Block 5, and the summary

  return (
    <Box
      position="sticky"
      top="0"
      zIndex="20"
      bg="bg.panel"
      borderBottomWidth="1px"
      borderColor="border"
      px={{ base: "3", md: "6" }}
      py="2.5"
      backdropFilter="blur(8px)"
    >
      <HStack maxW="5xl" mx="auto" gap={{ base: "1.5", md: "3" }} justify="space-between" align="center">
        <HStack gap={{ base: "1.5", md: "3" }} align="center" flex="1" overflowX="auto" css={{ scrollbarWidth: "none" }}>
          {PHASES.map((p, i) => {
            const state = i < current ? "done" : i === current ? "current" : "upcoming";
            return (
              <HStack key={p.label} gap={{ base: "1.5", md: "3" }} flexShrink={0}>
                <Node state={state} index={i} label={p.label} />
                {i < PHASES.length - 1 && (
                  <Box h="0.5" w={{ base: "3", md: "6" }} rounded="full" bg={i < current ? "green.400" : "border"} flexShrink={0} />
                )}
              </HStack>
            );
          })}
        </HStack>
        <HStack gap="2" flexShrink={0} pl={{ base: "1", md: "3" }} borderLeftWidth="1px" borderColor="border">
          <Text fontSize="xs" color="fg.subtle" display={{ base: "none", sm: "block" }} whiteSpace="nowrap">
            {PHASES.length - current - 1} before
          </Text>
          <Box rounded="full" bg="purple.solid" color="purple.contrast" px="3" py="1" fontSize="xs" fontWeight="bold" whiteSpace="nowrap">
            Main study
          </Box>
        </HStack>
      </HStack>
    </Box>
  );
}
