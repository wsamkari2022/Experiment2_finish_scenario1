/**
 * Block5SimulationSummaryPage — Summary after all Block 5 scenarios (CVR Cube v3).
 *
 * Shows the two headline measures (graded VCI + Stability) and the average
 * Performance, then a per-scenario recap with the 4-level alignment label and the
 * CVR outcome (whether the participant kept a misaligned choice after seeing the
 * recontextualized vignette).
 */

import { useState } from "react";
import {
  Badge, Box, Button, Grid, Heading, HStack, Icon, Separator, Stack, Text, VStack,
} from "@chakra-ui/react";
import { LuCheck, LuArrowRight, LuChartColumn, LuTrendingUp, LuScale, LuTarget } from "react-icons/lu";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { ALIGNMENT_LABEL } from "./block5CVR";
import { POLICY_DIM_KEYS } from "./block5Types";
import type { AlignmentLevel, Block5Results, Block5ScenarioResult } from "./block5Types";
import { Block5VisualizationsView } from "./Block5VisualizationsView";
import { useScrollToTop } from "./useScrollToTop";

interface Props {
  results: Block5Results;
  /** Advance to the post-experiment feedback page (the finish/reset now lives after feedback). */
  onContinueToFeedback: () => void;
}

const LEVEL_PALETTE: Record<AlignmentLevel, string> = {
  aligned: "green",
  weakly_aligned: "yellow",
  misaligned: "orange",
  strongly_misaligned: "red",
};

/** Plain-English note for a scenario, based on alignment + CVR outcome. */
function scenarioNote(sr: Block5ScenarioResult): string {
  const level = sr.alignmentLevel;
  if (level === "aligned" || level === "weakly_aligned") {
    return "This choice fit your earlier values.";
  }
  if (sr.cvrFired) {
    if (sr.cvrEndorsement === "strong") {
      return "This went against your usual values, but you firmly stood by it after seeing it up close — recorded as a genuine value.";
    }
    if (sr.cvrEndorsement === "weak") {
      return "This went against your usual values; you kept it after reflection, but with some doubt.";
    }
    return "This went against your usual values, and you chose to reconsider.";
  }
  return "Your choice favored a different moral trade-off than your earlier profile predicted.";
}

function MeasureCard({ icon, label, value, sub, hint, palette }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; hint: string; palette: string;
}) {
  return (
    <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
      <HStack gap="2" mb="2">
        <Icon color={`${palette}.500`}>{icon}</Icon>
        <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">{label}</Text>
      </HStack>
      <HStack align="baseline" gap="2">
        <Heading size="2xl" color="fg">{value}</Heading>
        {sub && <Badge variant="subtle" colorPalette={palette} rounded="md" px="2" fontSize="xs">{sub}</Badge>}
      </HStack>
      <Text fontSize="xs" color="fg.muted" mt="2" lineHeight="tall">{hint}</Text>
    </Box>
  );
}

export function Block5SimulationSummaryPage({ results, onContinueToFeedback }: Props) {
  /** When true, swap this summary for the full-screen "Your experiment in charts" view. */
  const [showCharts, setShowCharts] = useState(false);
  // Opening or closing the charts view starts at the top.
  useScrollToTop(showCharts);
  if (showCharts) {
    return (
      <Block5VisualizationsView
        results={results}
        onBack={() => setShowCharts(false)}
        onContinueToFeedback={onContinueToFeedback}
      />
    );
  }

  // Only the 4 policy/value sensitivities (not the CVR-framing dimensions), strongest first.
  const topDimensions = results.userProfile.dimensions
    .filter((d) => (POLICY_DIM_KEYS as string[]).includes(d.key))
    .sort((a, b) => b.score - a.score);

  const vci = results.vci ?? 0;
  const stability = results.stability ?? 0;
  /*
   * PERFORMANCE IS REPORTED AS A SHARE OF WHAT WAS AVAILABLE, not as the raw mean of the metrics.
   *
   * The raw mean spans only ~14 points across a whole session — a participant who takes the worst
   * option in every scenario still scores 56 — so it reads as a percentage while behaving like a
   * narrow band, and any equivalence test run against it is testing a window a third as wide as
   * the entire scale. `performanceCaptured` is 0-100 by construction. The raw figure is still
   * shown, in the hint, so nothing already collected becomes unreadable.
   * See block5Performance.ts.
   */
  const performance = results.performance ?? 0;
  const captured = results.performanceCaptured;
  const hasCaptured = typeof captured === "number";

  return (
    <Box minH="100dvh" bg="bg" px={{ base: "4", md: "6" }} py={{ base: "8", md: "12" }} display="flex" alignItems="flex-start" justifyContent="center">
      <VStack gap="8" align="stretch" maxW="4xl" w="full" animationName="fade-in" animationDuration="moderate">
        {/* Header */}
        <VStack gap="3" textAlign="center">
          <Badge colorPalette="green" variant="subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="medium" px="3" py="1" rounded="md">
            Complete
          </Badge>
          <Heading size="2xl" color="fg" fontWeight="semibold">Main Simulation Complete</Heading>
          <Text color="fg.muted" fontSize="lg" maxW="2xl" mx="auto">
            Here is how consistent your decisions were with your own moral values.
          </Text>
        </VStack>

        {/* Headline measures */}
        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="4">
          <MeasureCard icon={<LuTrendingUp />} palette="blue" label="Value Consistency (VCI)"
            value={`${vci}`} sub={results.vciLevel ?? "—"}
            hint="How often your choices matched your own values — judged against your values as they stood at that moment. Your values update as you go, so a value you take on during the block counts from then on." />
          <MeasureCard icon={<LuScale />} palette="purple" label="Stability"
            value={`${stability}`} sub={results.stabilityLevel ?? "—"}
            hint="How much your own values moved during Block 5, compared with where they stood after Blocks 1-4. It combines whether your priorities changed order with how far they travelled along the way." />
          <MeasureCard icon={<LuTarget />} palette="teal"
            label={hasCaptured ? "Performance taken" : "Performance"}
            value={hasCaptured ? `${captured}` : `${performance}`}
            sub={hasCaptured ? results.performanceCapturedLevel : undefined}
            hint={hasCaptured
              ? `Of the outcome quality each scenario actually put on the table, this is how much your choices took. 100 would mean you picked the strongest-performing option every time, 0 the weakest. (Raw metric average: ${performance}.)`
              : "Average outcome quality of the policies you chose (separate from how well they matched your values)."} />
        </Grid>

        {/*
          The two reflection lenses (Directness / Context) are reported here rather than folded
          into Stability. They only move when a participant opens the second view, which is an
          optional control — across six simulated behaviour types they never moved once. Scoring
          a variable that is frozen for most people would dilute the number without measuring
          anything, whereas how often someone chose to look through both lenses genuinely varies.
        */}
        {(() => {
          const withCvr = results.scenarioResults.filter((r) => r.cvrFired).length;
          const bothLenses = results.scenarioResults.filter((r) => r.cvrAltViewGenerated).length;
          if (withCvr === 0) return null;
          return (
            <Box bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="xl" px="5" py="4">
              <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="1">
                Looking at it two ways
              </Text>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                {bothLenses === 0
                  ? `You were offered a second way of seeing your choice in ${withCvr} scenario${withCvr === 1 ? "" : "s"}, and stayed with the first view each time.`
                  : `In ${bothLenses} of ${withCvr} scenario${withCvr === 1 ? "" : "s"} you generated the second perspective and compared both ways of seeing the same choice.`}
              </Text>
            </Box>
          );
        })()}

        {/* See-your-journey-in-charts entry point */}
        <Box textAlign="center">
          <Button onClick={() => setShowCharts(true)} size="lg" colorPalette="purple" variant="outline"
            rounded="xl" gap="2" px="7">
            <Icon><LuChartColumn /></Icon>
            View your results as charts
          </Button>
          <Text fontSize="xs" color="fg.muted" mt="2">
            See your full journey — values, choices, consistency, and time — in seven simple charts.
          </Text>
        </Box>

        {/* Profile recap */}
        <Box bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" rounded="xl" p={{ base: "5", md: "6" }}>
          <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="3">
            Your value priorities (after this block)
          </Text>
          <HStack gap="3" wrap="wrap">
            {topDimensions.map((d) => (
              <Badge key={d.key} variant="subtle" colorPalette="blue" px="3" py="1" rounded="md" fontSize="xs">
                {/* Display rounding only — see the same note in Block5PublicEmergencySimulation. */}
                {d.label} ({Math.round(d.score)})
              </Badge>
            ))}
          </HStack>
        </Box>

        {/* Per-scenario panels */}
        {results.scenarioResults.map((sr) => {
          const scenario = BLOCK5_SCENARIOS.find((s) => s.id === sr.scenarioId);
          if (!scenario) return null;
          const selectedOption = scenario.options.find((o) => o.id === sr.selectedOptionId);
          const level = sr.alignmentLevel;

          return (
            <Box key={sr.scenarioId} bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "6", md: "8" }} shadow="lg">
              <Heading size="md" color="fg" mb="4">{scenario.title}</Heading>
              <Stack gap="3">
                <HStack gap="2" align="start">
                  <Icon color="green.400" mt="0.5"><LuCheck /></Icon>
                  <VStack align="start" gap="0.5">
                    <Text fontSize="sm" color="fg.muted">Your choice</Text>
                    <Text fontSize="md" color="fg" fontWeight="medium">{selectedOption?.title ?? sr.selectedOptionId}</Text>
                  </VStack>
                </HStack>

                <HStack gap="3" wrap="wrap">
                  {level && (
                    <Badge variant="subtle" colorPalette={LEVEL_PALETTE[level]} rounded="md" px="2" fontSize="xs">
                      {ALIGNMENT_LABEL[level]}
                    </Badge>
                  )}
                  {sr.cvrFired && (
                    <Badge variant="subtle" colorPalette="orange" rounded="md" px="2" fontSize="xs">
                      CVR shown
                    </Badge>
                  )}
                  {sr.cvrFired && (sr.cvrEndorsement === "strong" || sr.cvrEndorsement === "weak") && (
                    <Badge variant="subtle" colorPalette="green" rounded="md" px="2" fontSize="xs">
                      Kept after reflection
                    </Badge>
                  )}
                  {typeof sr.matchScore === "number" && (
                    <Badge variant="subtle" colorPalette="gray" rounded="md" px="2" fontSize="xs">
                      Fit {sr.matchScore}
                    </Badge>
                  )}
                </HStack>

                <Text fontSize="sm" color="fg.muted" fontStyle="italic" mt="1">{scenarioNote(sr)}</Text>
              </Stack>
            </Box>
          );
        })}

        <Separator borderColor="border.subtle" />

        <Box textAlign="center" pb="4">
          <Text color="fg.muted" fontSize="md" mb="6">
            One last step — please share your feedback on the experience.
          </Text>
          <Button onClick={onContinueToFeedback} size="lg" colorPalette="pink" rounded="lg" px="8" gap="2">
            Continue to feedback
            <Icon><LuArrowRight /></Icon>
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}
