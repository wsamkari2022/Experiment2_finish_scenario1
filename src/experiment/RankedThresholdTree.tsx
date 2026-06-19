import { Badge, Box, Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { describeLevel, type ThresholdTree, type ThresholdTreeDimension } from "./thresholdTree";

/**
 * RankedThresholdTree — displays the seven-dimension sensitivity tree produced by buildThresholdTree.
 *
 * Shows the overall sensitivity index, the primary driver, and one DimensionRow per dimension.
 * Each row includes a labelled score bar, a one-sentence rationale, and the formula
 * derivation string (monospaced, with substituted values) for transparency.
 */

interface Props {
  /** The fully built and ranked threshold tree from thresholdTree.ts. */
  tree: ThresholdTree;
}

/**
 * Maps a 0–100 score to Chakra color tokens for the fill bar, foreground text, and badge.
 * Uses the same breakpoints as describeLevel (strong ≥ 75, moderate ≥ 55, mild ≥ 35).
 */
function toneFor(score: number): { fg: string; bar: string; badge: "green" | "blue" | "yellow" | "gray" } {
  const lvl = describeLevel(score);
  if (lvl === "strong") return { fg: "green.300", bar: "green.400", badge: "green" };
  if (lvl === "moderate") return { fg: "blue.300", bar: "blue.400", badge: "blue" };
  if (lvl === "mild") return { fg: "yellow.300", bar: "yellow.400", badge: "yellow" };
  return { fg: "gray.400", bar: "gray.500", badge: "gray" };
}

/**
 * Renders a single sensitivity dimension: rank badge, label, score bar,
 * rationale sentence, and derivation formula box.
 */
function DimensionRow({ d }: { d: ThresholdTreeDimension }) {
  const tone = toneFor(d.score);
  return (
    <Box
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="xl"
      bg="bg.subtle"
      p={{ base: "4", md: "5" }}
    >
      <HStack justify="space-between" align="start" gap="4" mb="2" wrap="wrap">
        <HStack gap="3" align="center">
          <Badge
            colorPalette="gray"
            variant="subtle"
            px="2.5"
            py="1"
            rounded="md"
            fontFamily="mono"
          >
            #{d.rank}
          </Badge>
          <Heading size="sm" color="fg">
            {d.label}
          </Heading>
        </HStack>
        <HStack gap="3">
          <Text fontSize="sm" color="fg.muted" fontFamily="mono">
            {d.score}/100
          </Text>
          <Badge colorPalette={tone.badge} variant="subtle" rounded="md" px="2">
            {describeLevel(d.score)}
          </Badge>
        </HStack>
      </HStack>

      <Box w="full" h="2" bg="bg.emphasized" rounded="full" overflow="hidden" mb="3">
        <Box
          h="full"
          bg={tone.bar}
          rounded="full"
          style={{ width: `${Math.max(4, d.score)}%` }}
        />
      </Box>

      <Text fontSize="sm" color="fg" lineHeight="tall" mb="2">
        {d.rationale}
      </Text>
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border.subtle"
        rounded="md"
        px="3"
        py="2"
        fontFamily="mono"
        fontSize="xs"
        color="fg.muted"
        whiteSpace="pre-wrap"
      >
        {d.derivation}
      </Box>
    </Box>
  );
}

export function RankedThresholdTree({ tree }: Props) {
  return (
    <VStack align="stretch" gap="5">
      <Box
        borderWidth="1px"
        borderColor="border"
        rounded="xl"
        p={{ base: "5", md: "6" }}
        bg="bg.panel"
      >
        <HStack justify="space-between" align="center" wrap="wrap" gap="3">
          <VStack align="start" gap="0.5">
            <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
              Overall sensitivity index
            </Text>
            <Heading size="lg" color="fg" fontFamily="mono">
              {tree.overallSensitivityIndex}/100
            </Heading>
          </VStack>
          {tree.primaryDriver && (
            <VStack align="end" gap="0.5">
              <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
                Primary driver
              </Text>
              <Text fontSize="sm" fontWeight="semibold" color="fg">
                {tree.primaryDriver.label}
              </Text>
            </VStack>
          )}
        </HStack>
      </Box>

      <Stack gap="3">
        {tree.dimensions.map((d) => (
          <DimensionRow key={d.key} d={d} />
        ))}
      </Stack>
    </VStack>
  );
}
