/**
 * Block5ValueGuide — "How to read the four values in this scenario".
 *
 * WHY IT EXISTS (researcher, 18 September 2026). Every option is scored on the same four values in
 * every scenario, but what a value MEANS changes with the scenario: "How much is gained" is how fast
 * and how safely you get out in the escapes, the years of life a dose adds in the cancer scenario,
 * and keeping the service paid for in the care scenario. The advisor's objection was that a
 * participant reading an option's bars had no way to know that. This section says it, once, under
 * the cumulative performance bar, before any option is read.
 *
 * WHERE THE WORDS COME FROM. `valueHere` in block5CVRContent.ts — the same four lines the APA page
 * prints as "In this scenario: …". One source, so the two places can never disagree. Each line was
 * written from the options that value actually leads to, so it describes the scenario's options
 * rather than an abstract definition.
 *
 * WHERE IT IS SHOWN. Scenarios 1 to 5. Scenario 5 borrows scenario 4's lines, because its six
 * options are scenario 4's (see getCVRValueHere). NOT scenario 6, on the researcher's decision:
 * there the four options ARE the four values, so naming them would turn a test of the prediction
 * model into "pick your value", and the one thing scenario 6 measures would be lost. A scenario
 * with no lines renders nothing.
 *
 * WHAT IT DOES NOT SAY. No scores, no fit, no ranking — only what a HIGHER number means here. The
 * standing rule that a participant never sees an alignment verdict or the scoring arithmetic holds.
 */
import { useState, type ReactNode } from "react";
import { Box, Button, Grid, HStack, Icon, Text } from "@chakra-ui/react";
import { LuChevronDown, LuChevronUp, LuHeartPulse, LuShield, LuTrendingUp, LuUsersRound } from "react-icons/lu";
import { POLICY_DIM_KEYS, type Block5PolicyDimKey, type Block5Scenario } from "./block5Types";
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

/** Remembers, per viewer, whether the section is folded. Browser-only; losing it costs nothing. */
const OPEN_KEY = "vrds_b5_value_guide_open";

export function Block5ValueGuide({ scenario, pal }: { scenario: Block5Scenario; pal: Block5Palette }) {
  const here = getCVRValueHere(scenario);
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; }
  });
  if (!here) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* browser storage is optional */ }
  };

  return (
    <Box maxW="7xl" mx="auto" mb="6" bg={pal.cardBg} borderWidth="1px" borderColor={pal.cardBorder}
      rounded="xl" px={{ base: "4", md: "5" }} py="4">
      <HStack justify="space-between" align="center" gap="3" mb={open ? "1" : "0"}>
        <Text fontSize="md" fontWeight="semibold" color={pal.text}>
          How to read the four values in this scenario
        </Text>
        <Button size="xs" variant="ghost" color={pal.textMuted} onClick={toggle} aria-expanded={open}>
          {open ? "Hide" : "Show"}
          <Icon boxSize="3.5">{open ? <LuChevronUp /> : <LuChevronDown />}</Icon>
        </Button>
      </HStack>
      {open && (
        <>
          <Text fontSize="sm" color={pal.textMuted} mb="3">
            Each option is scored on the same four values in every scenario. Here is what each one means in this one.
          </Text>
          <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap="2.5">
            {POLICY_DIM_KEYS.map((k) => (
              <Box key={k} bg={`${LOOK[k].palette}.subtle`} rounded="lg" px="3" py="2.5">
                <HStack gap="1.5" mb="1" color={`${LOOK[k].palette}.fg`}>
                  <Icon boxSize="3.5">{LOOK[k].icon}</Icon>
                  <Text fontSize="sm" fontWeight="semibold">{NAME[k]}</Text>
                </HStack>
                <Text fontSize="sm" color={`${LOOK[k].palette}.fg`} lineHeight="1.5">
                  {here[k].charAt(0).toUpperCase() + here[k].slice(1)}.
                </Text>
              </Box>
            ))}
          </Grid>
          <Text fontSize="xs" color={pal.textFaint} mt="3">
            A higher number on an option means it does more of that value here.
          </Text>
        </>
      )}
    </Box>
  );
}
