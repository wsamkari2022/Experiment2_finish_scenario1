/**
 * Block5ValuesPanel — "Your values in this scenario".
 *
 * ONE PANEL WHERE THERE WERE TWO (researcher's request, 26 September 2026). The page used to say
 * the same thing in two places that never met: "How to read the four values in this scenario"
 * under the performance bars (what each value MEANS here) and "Your value priorities" in the
 * sidebar (how much the participant HOLDS each one). A participant had to read one, find the
 * other, and put them together. Now each value is one tile that says both, in the value's own
 * color, strongest first.
 *
 * IT BEHAVES LIKE THE PERFORMANCE PANEL ABOVE IT, on purpose, so there is one set of controls to
 * learn:
 *   - MINIMIZE keeps the measurement and drops the explanation: one row of four chips, each with
 *     the value's name and the participant's number. The meanings, the subtitle and the footer are
 *     what fold away. Remembered across scenarios.
 *   - PIN keeps the panel on screen while the page scrolls, parked directly under the performance
 *     panel. The sticky positioning lives in the parent (it has to be measured against the
 *     performance panel and the sidebar below both); this component only draws the button.
 *     Tablet width and up: on a phone a pinned panel would cover most of the screen.
 *
 * WHAT IT SHOWS, UNCHANGED FROM THE TWO SECTIONS IT REPLACES - no more, no less:
 *   - the participant's four value numbers, as the sidebar showed them (scenario 5 passes the
 *     values scenario 4 opened with - see profileShownIn);
 *   - each value's meaning in THIS scenario from `valueHere` (getCVRValueHere), as the old guide
 *     did. NOT in scenario 6, on the researcher's decision: there the four options ARE the four
 *     values, so the meanings would turn the prediction test into "pick your value". The numbers
 *     stay in scenario 6 exactly as the sidebar showed them there; see the audit (A9, scenario 6).
 *   - the general definition of each value, on hover, as the sidebar did (POLICY_DIM_EXPLAIN);
 *   - the sidebar's closing sentence about every option staying available.
 * No fit, no ranking of options, no verdict - the standing rule holds.
 */
import { useState, type ReactNode } from "react";
import { Box, Button, Flex, Grid, HStack, Icon, Text } from "@chakra-ui/react";
import {
  LuChevronsDownUp, LuChevronsUpDown, LuCompass, LuHeartPulse, LuPin, LuPinOff, LuShield,
  LuTrendingUp, LuUsersRound,
} from "react-icons/lu";
import { POLICY_DIM_EXPLAIN, type Block5PolicyDimKey, type Block5Scenario } from "./block5Types";
import { getCVRValueHere } from "./block5CVRContent";
import type { Block5Palette } from "./block5Palette";

/** The same four names every other Block 5 surface uses. */
const NAME: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "Protecting the vulnerable",
  groupSizeSensitivity: "Reducing harm",
  gainResponsivenessSensitivity: "How much is gained",
  outcomeAggregationSensitivity: "How many are helped",
};

/** One icon and one color family per value; Chakra's semantic tokens follow light and dark mode. */
const LOOK: Record<Block5PolicyDimKey, { icon: ReactNode; palette: string }> = {
  vulnerabilityProtectionSensitivity: { icon: <LuShield />, palette: "purple" },
  groupSizeSensitivity: { icon: <LuHeartPulse />, palette: "teal" },
  gainResponsivenessSensitivity: { icon: <LuTrendingUp />, palette: "orange" },
  outcomeAggregationSensitivity: { icon: <LuUsersRound />, palette: "pink" },
};

/** Remembers, per viewer, whether the panel is minimized. Browser-only; losing it costs nothing. */
const MINIMIZED_KEY = "vrds_b5_values_minimized";

export interface ValuesPanelValue {
  key: Block5PolicyDimKey;
  /** 0-100, full precision; rounded only for display. */
  score: number;
}

export function Block5ValuesPanel({ scenario, pal, values, note, pinned, onTogglePinned }: {
  scenario: Block5Scenario;
  pal: Block5Palette;
  /** The participant's four values, strongest first. */
  values: ValuesPanelValue[];
  /** The closing sentence the sidebar used to carry (differs by scenario; built by the parent). */
  note: ReactNode;
  pinned: boolean;
  onTogglePinned: () => void;
}) {
  const here = getCVRValueHere(scenario);
  const [minimized, setMinimized] = useState<boolean>(() => {
    try { return localStorage.getItem(MINIMIZED_KEY) === "1"; } catch { return false; }
  });
  const [hovered, setHovered] = useState<Block5PolicyDimKey | null>(null);
  const toggleMinimized = () => {
    setMinimized((v) => {
      const next = !v;
      try { localStorage.setItem(MINIMIZED_KEY, next ? "1" : "0"); } catch { /* browser storage is optional */ }
      return next;
    });
  };

  /* The two controls, identical in both states and always in the top-right corner. */
  const controls = (
    <HStack gap="1" flexShrink={0}>
      <Button size="2xs" variant="ghost" rounded="md" px="1.5" minW="auto"
        display={{ base: "none", md: "inline-flex" }}
        color={pinned ? pal.accent : pal.textMuted}
        bg={pinned ? pal.surfaceSubtle : "transparent"}
        _hover={{ bg: pal.surfaceSubtle, color: pinned ? pal.accent : pal.text }}
        onClick={onTogglePinned}
        aria-pressed={pinned}
        aria-label={pinned ? "Unpin: let this panel scroll away with the page" : "Pin: keep this panel on screen while you scroll"}
        title={pinned ? "Unpin: let this panel scroll away with the page" : "Pin: keep this panel on screen while you scroll"}>
        <Icon boxSize="3.5">{pinned ? <LuPinOff /> : <LuPin />}</Icon>
      </Button>
      <Button size="2xs" variant="ghost" rounded="md" px="1.5" minW="auto"
        color={pal.textMuted} _hover={{ bg: pal.surfaceSubtle, color: pal.text }}
        onClick={toggleMinimized}
        aria-expanded={!minimized}
        aria-label={minimized ? "Show the whole values panel" : "Minimize to your four values only"}
        title={minimized ? "Show the whole values panel" : "Minimize to your four values only"}>
        <Icon boxSize="3.5">{minimized ? <LuChevronsUpDown /> : <LuChevronsDownUp />}</Icon>
      </Button>
    </HStack>
  );

  /* The general definition of a value, on hover - what the sidebar used to show. */
  const definition = (k: Block5PolicyDimKey) => hovered === k && (
    <Box position="absolute" top="100%" left="0" mt="1.5" zIndex="40"
      bg={pal.tooltipBg} color={pal.tooltipText}
      borderWidth="1px" borderColor={pal.tooltipBorder} rounded="lg" px="3" py="2"
      fontSize="2xs" lineHeight="tall" w="240px" shadow="xl" pointerEvents="none">
      {POLICY_DIM_EXPLAIN[k]}
    </Box>
  );
  const hoverable = (k: Block5PolicyDimKey) => ({
    onMouseEnter: () => setHovered(k),
    onMouseLeave: () => setHovered(null),
  });

  return (
    <Box bg={pal.dashBg} backdropFilter={pal.backdropBlur} borderWidth="1px" borderColor={pal.dashBorder}
      rounded="2xl" overflow="visible" position="relative"
      style={{ boxShadow: pal.dashShadow }} transition="padding 0.2s ease">
      {/* The four value colors as one thin rule along the top edge: the panel's signature, and the
          quickest way to tell it from the performance panel above, which carries one accent. */}
      <HStack gap="0" h="3px" roundedTop="2xl" overflow="hidden" aria-hidden>
        {values.map((v) => <Box key={v.key} flex="1" h="full" bg={`${LOOK[v.key].palette}.solid`} />)}
      </HStack>

      <Box px={{ base: "3.5", md: "5" }} pt={minimized ? "2.5" : "4"} pb={minimized ? "3" : "4"}>
        {minimized ? (
          /* ---- MINIMIZED: the four values and the participant's numbers, nothing else ---- */
          <HStack align="center" gap="3">
            {/* Each chip is as wide as its own name, so "Protecting the vulnerable" is never cut:
                four equal columns wasted the short names' room and clipped the long one. The row
                wraps onto a second line only when the screen is too narrow for all four. */}
            <Flex flex="1" minW="0" wrap="wrap" gap="2">
              {values.map((v) => {
                const look = LOOK[v.key];
                return (
                  <HStack key={v.key} position="relative" cursor="help" gap="2" flex="1 1 auto"
                    bg={`${look.palette}.subtle`} borderWidth="1px" borderColor={`${look.palette}.muted`}
                    rounded="lg" px="2.5" py="1.5" {...hoverable(v.key)}>
                    <Icon boxSize="3.5" color={`${look.palette}.fg`} flexShrink={0}>{look.icon}</Icon>
                    <Text fontSize="xs" fontWeight="semibold" color={`${look.palette}.fg`} whiteSpace="nowrap" flex="1">
                      {NAME[v.key]}
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" fontFamily="mono" color={`${look.palette}.fg`}>
                      {Math.round(v.score)}
                    </Text>
                    {definition(v.key)}
                  </HStack>
                );
              })}
            </Flex>
            {controls}
          </HStack>
        ) : (
          /* ---- OPEN: what each value means here, and how much the participant holds it ---- */
          <>
            <HStack justify="space-between" align="start" gap="3" mb="3">
              <HStack gap="2.5" align="start" minW="0">
                <Icon color={pal.accent} boxSize="4" mt="0.5" flexShrink={0}><LuCompass /></Icon>
                <Box minW="0">
                  <Text fontSize="xs" fontWeight="bold" color={pal.dashTitleColor}
                    textTransform="uppercase" letterSpacing="wider">
                    Your values in this scenario
                  </Text>
                  <Text fontSize="sm" color={pal.textMuted} mt="0.5" lineHeight="tall">
                    {here
                      ? "Every option is scored on the same four values. Here is how much each one matters to you, and what it means in this scenario."
                      : "How much each of the four values matters to you."}
                  </Text>
                </Box>
              </HStack>
              {controls}
            </HStack>

            <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap="2.5">
              {values.map((v) => {
                const look = LOOK[v.key];
                const n = Math.round(v.score);
                return (
                  <Box key={v.key} bg={`${look.palette}.subtle`} borderWidth="1px" borderColor={`${look.palette}.muted`}
                    rounded="xl" px="3.5" py="3" display="flex" flexDirection="column" gap="2">
                    <HStack justify="space-between" align="start" gap="2" position="relative"
                      cursor="help" {...hoverable(v.key)}>
                      {/* The name WRAPS rather than being cut: at four tiles across,
                          "Protecting the vulnerable" does not fit on one line. */}
                      <HStack gap="1.5" minW="0" align="start" color={`${look.palette}.fg`}>
                        <Icon boxSize="3.5" flexShrink={0} mt="0.5">{look.icon}</Icon>
                        <Text fontSize="sm" fontWeight="semibold" lineHeight="1.3"
                          style={{ textDecoration: "underline dotted", textUnderlineOffset: "3px" }}>
                          {NAME[v.key]}
                        </Text>
                      </HStack>
                      <Text fontSize="lg" fontWeight="bold" fontFamily="mono" lineHeight="1" color={`${look.palette}.fg`}>
                        {n}
                      </Text>
                      {definition(v.key)}
                    </HStack>
                    {/* How much the participant holds it, 0-100: the same number, drawn. */}
                    <Box h="1.5" rounded="full" bg={`${look.palette}.muted`} overflow="hidden" aria-hidden>
                      <Box h="full" rounded="full" bg={`${look.palette}.solid`} style={{ width: `${n}%` }}
                        transition="width 0.4s ease" />
                    </Box>
                    {here && (
                      <Box>
                        <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider"
                          color={`${look.palette}.fg`} opacity={0.75} mb="0.5">
                          In this scenario
                        </Text>
                        <Text fontSize="sm" color={`${look.palette}.fg`} lineHeight="1.5">
                          {here[v.key].charAt(0).toUpperCase() + here[v.key].slice(1)}.
                        </Text>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Grid>

            <Box mt="3" pt="3" borderTopWidth="1px" borderColor={pal.separator}>
              {here && (
                <Text fontSize="xs" color={pal.textFaint} lineHeight="tall">
                  A higher number on an option means it does more of that value here.
                </Text>
              )}
              <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">{note}</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
