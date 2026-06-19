/**
 * block5Meters.tsx — SensitivityMeterBar for Block 5 (CVR Cube v3.1).
 *
 * Visualizes threshold satisfaction so the participant can SEE why an option is
 * aligned or not:
 *  - the white line = the participant's PRIORITY (threshold) for that value;
 *  - the colored bar = how much the option delivers that value;
 *  - if the bar reaches/passes the white line → the value is satisfied (no penalty);
 *  - if the bar stops short → a red "shortfall" gap is drawn from the bar up to the
 *    line, and the label reads "Below your priority by X" (this is what lowers alignment).
 */

import { Box, HStack, Text, VStack } from "@chakra-ui/react";

interface SensitivityMeterBarProps {
  label: string;
  optionScore: number;
  userScore: number;
  accentColor: string;
}

export function SensitivityMeterBar({ label, optionScore, userScore, accentColor }: SensitivityMeterBarProps) {
  // The label tracks the picture exactly: the bar must REACH the white line to count
  // as "meeting" your priority. Falling even slightly short reads "Below your priority
  // by X" (and shows the red gap), so the words always match what the bar shows.
  const shortfall = Math.max(0, userScore - optionScore);
  const below = optionScore < userScore;    // bar does not reach the line
  const exceeds = optionScore > userScore;   // bar passes the line

  const status = below
    ? `Below your priority by ${shortfall}`
    : exceeds
      ? "Exceeds your priority"
      : "Meets your priority";
  const statusColor = below ? "orange.300" : "green.300";
  const fillColor = below ? "#ED8936" : accentColor;

  return (
    <VStack align="stretch" gap="1" w="full">
      <HStack justify="space-between">
        <Text fontSize="xs" color="whiteAlpha.700" fontWeight="medium">{label}</Text>
        <HStack gap="3">
          <Text fontSize="xs" color="whiteAlpha.600">Option: {optionScore}</Text>
          <Text fontSize="xs" color="whiteAlpha.800" fontWeight="semibold">Your line: {userScore}</Text>
        </HStack>
      </HStack>

      <Box position="relative" h="3.5" bg="whiteAlpha.100" rounded="full" overflow="visible">
        {/* Option fill (how much the option delivers this value) */}
        <Box
          position="absolute" top="0" left="0" h="full" rounded="full" bg={fillColor} opacity={0.85}
          style={{ width: `${Math.max(2, optionScore)}%` }} transition="width 0.4s ease"
        />
        {/* Shortfall gap: from the bar's end up to the user's line (only when below) */}
        {below && (
          <Box
            position="absolute" top="0" h="full" bg="red.500" opacity={0.32}
            style={{ left: `${optionScore}%`, width: `${shortfall}%` }}
            title={`Shortfall: ${shortfall} below your line`}
          />
        )}
        {/* The participant's priority line (threshold) */}
        <Box
          position="absolute" top="-3px" h="calc(100% + 6px)" w="2px" bg="white" rounded="full" shadow="sm"
          style={{ left: `${userScore}%` }} title={`Your priority line: ${userScore}`}
        />
      </Box>

      <Text fontSize="2xs" color={statusColor} fontStyle="italic">{status}</Text>
    </VStack>
  );
}

export function MeterLegend() {
  return (
    <HStack gap="4" py="2" wrap="wrap">
      <HStack gap="1.5">
        <Box w="2px" h="3" bg="white" rounded="full" />
        <Text fontSize="2xs" color="whiteAlpha.500">Your priority line — the bar should reach it</Text>
      </HStack>
      <HStack gap="1.5">
        <Box w="3" h="2" rounded="sm" bg="red.500" opacity={0.4} />
        <Text fontSize="2xs" color="whiteAlpha.500">Shortfall below your line = what lowers alignment</Text>
      </HStack>
    </HStack>
  );
}
