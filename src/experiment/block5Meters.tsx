/**
 * block5Meters.tsx — SensitivityMeterBar for Block 5 (CVR Cube v3.1).
 *
 * Visualizes threshold satisfaction so the participant can SEE why an option is
 * aligned or not:
 *  - the marker line = the participant's PRIORITY (threshold) for that value;
 *  - the colored bar = how much the option delivers that value;
 *  - if the bar reaches/passes the marker → the value is satisfied (no penalty);
 *  - if the bar stops short → a red "shortfall" gap is drawn from the bar up to the
 *    line, and the label reads "Below your priority by X" (this is what lowers alignment).
 *
 * COLOUR MODE
 * This panel was originally authored for Dark Mode only: every label used a `whiteAlpha.*`
 * token, the track was `whiteAlpha.100` and the priority marker was solid white. On a light
 * card that is white-on-white — the four value names, the "Option / Your line" numbers and
 * the whole legend were invisible, and the marker disappeared wherever the bar had not
 * reached it. Colours are now resolved per mode through `meterColors()`.
 *
 * The DARK values below are exactly the tokens the component used before, so Dark Mode is
 * unchanged; only the light branch is new. The light status colours are the 700-level greens
 * and oranges rather than the 300-level ones, which are far too pale to read on white.
 */

import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { Block5Palette } from "./block5Palette";

interface MeterColors {
  /** the value's name, e.g. "Vulnerability protection sensitivity" */
  label: string;
  /** the "Option: 97" figure — deliberately quieter than the participant's own number */
  optionScore: string;
  /** the "Your line: 39" figure — the participant's own threshold, so the louder of the two */
  userScore: string;
  /** unfilled portion of the meter */
  track: string;
  /** the vertical priority marker; must read against BOTH the track and the coloured bar */
  marker: string;
  /** status line when the option meets or exceeds the participant's priority */
  statusMet: string;
  /** status line when the option falls short */
  statusBelow: string;
  /** legend caption text */
  legend: string;
  /** alpha of the red shortfall gap */
  gapOpacity: number;
}

function meterColors(mode: Block5Palette["mode"]): MeterColors {
  return mode === "light"
    ? {
        label: "#334155",       // slate-700
        optionScore: "#64748b", // slate-500
        userScore: "#0f172a",   // slate-900 — the participant's own figure, strongest
        track: "#e2e8f0",       // slate-200, same track the dashboard meters use
        marker: "#0f172a",      // dark marker reads on the pale track AND on the orange fill
        statusMet: "#15803d",   // green-700 (green.300 is unreadable on white)
        statusBelow: "#c2410c", // orange-700
        legend: "#475569",      // slate-600
        gapOpacity: 0.3,
      }
    : {
        label: "rgba(255,255,255,0.7)",
        optionScore: "rgba(255,255,255,0.6)",
        userScore: "rgba(255,255,255,0.8)",
        track: "rgba(255,255,255,0.1)",
        marker: "#ffffff",
        statusMet: "#68d391",   // green.300
        statusBelow: "#f6ad55", // orange.300
        legend: "rgba(255,255,255,0.5)",
        gapOpacity: 0.32,
      };
}

interface SensitivityMeterBarProps {
  label: string;
  optionScore: number;
  userScore: number;
  accentColor: string;
  mode: Block5Palette["mode"];
}

export function SensitivityMeterBar({ label, optionScore, userScore, accentColor, mode }: SensitivityMeterBarProps) {
  // The label tracks the picture exactly: the bar must REACH the marker line to count
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

  const c = meterColors(mode);
  const statusColor = below ? c.statusBelow : c.statusMet;
  const fillColor = below ? "#ED8936" : accentColor;

  return (
    <VStack align="stretch" gap="1" w="full">
      <HStack justify="space-between">
        <Text fontSize="xs" color={c.label} fontWeight="medium">{label}</Text>
        <HStack gap="3">
          <Text fontSize="xs" color={c.optionScore}>Option: {optionScore}</Text>
          <Text fontSize="xs" color={c.userScore} fontWeight="semibold">Your line: {userScore}</Text>
        </HStack>
      </HStack>

      <Box position="relative" h="3.5" bg={c.track} rounded="full" overflow="visible">
        {/* Option fill (how much the option delivers this value) */}
        <Box
          position="absolute" top="0" left="0" h="full" rounded="full" bg={fillColor} opacity={0.85}
          style={{ width: `${Math.max(2, optionScore)}%` }} transition="width 0.4s ease"
        />
        {/* Shortfall gap: from the bar's end up to the user's line (only when below) */}
        {below && (
          <Box
            position="absolute" top="0" h="full" bg="red.500" opacity={c.gapOpacity}
            style={{ left: `${optionScore}%`, width: `${shortfall}%` }}
            title={`Shortfall: ${shortfall} below your line`}
          />
        )}
        {/* The participant's priority line (threshold) */}
        <Box
          position="absolute" top="-3px" h="calc(100% + 6px)" w="2px" bg={c.marker} rounded="full" shadow="sm"
          style={{ left: `${userScore}%` }} title={`Your priority line: ${userScore}`}
        />
      </Box>

      <Text fontSize="2xs" color={statusColor} fontStyle="italic" fontWeight="medium">{status}</Text>
    </VStack>
  );
}

export function MeterLegend({ mode }: { mode: Block5Palette["mode"] }) {
  const c = meterColors(mode);
  return (
    <HStack gap="4" py="2" wrap="wrap">
      <HStack gap="1.5">
        <Box w="2px" h="3" bg={c.marker} rounded="full" />
        <Text fontSize="2xs" color={c.legend}>Your priority line — the bar should reach it</Text>
      </HStack>
      <HStack gap="1.5">
        <Box w="3" h="2" rounded="sm" bg="red.500" opacity={0.4} />
        <Text fontSize="2xs" color={c.legend}>Shortfall below your line = what lowers alignment</Text>
      </HStack>
    </HStack>
  );
}
