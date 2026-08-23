/**
 * Block5VisualizationsView — the optional "Your Experiment in Charts" view, opened from
 * the final results page (after the last Block-5 scenario, before the Feedback Page).
 *
 * Seven charts, each showing ONE idea, with clear plain-English labels, a "How to read this"
 * hint, a meaningful legend, and a short personalized caption:
 *   1. Radar   — your value profile before vs after Block 5 (shape + stability)
 *   2. Line    — how your four values shifted across the journey (Before → after each scenario)
 *   3. Bars    — your final choice & how well it fit your values, per scenario
 *   4. Line    — how consistent your choices were across the scenarios
 *   5. Bars    — how much you reconsidered inside each scenario
 *   6. Bars    — where your time went across the whole experiment
 *   7. Line    — how your two reflection lenses (Directness vs Context) shifted
 *
 * Read-only: it renders values already stored in the Block-5 results + the stage timer.
 * It computes no experiment logic and changes nothing about scoring or the flow.
 */

import type { ReactNode } from "react";
import {
  Badge, Box, Button, Heading, HStack, Icon, SimpleGrid, Stack, Text, VStack,
} from "@chakra-ui/react";
import { LuArrowLeft, LuArrowRight, LuInfo } from "react-icons/lu";
import {
  RadarChart, HBarChart, VBarChart, LineChart, ChartLegend,
  type RadarSeries, type HBar, type VBar, type LineSeries,
} from "./block5Charts";
import { SERIES_COLORS, ALIGN_COLORS } from "./block5ChartColors";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { ALIGNMENT_LABEL } from "./block5CVR";
import { buildTimingSummary } from "./telemetry";
import {
  POLICY_DIM_KEYS,
  type Block5PolicyDimKey, type Block5Results, type Block5UserProfile,
} from "./block5Types";

interface Props {
  results: Block5Results;
  onBack: () => void;
  onContinueToFeedback: () => void;
}

/** Clear, jargon-free names for the four policy values (no bare word like "total"). */
const VALUE_LABEL: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "Protect those worst-off",
  groupSizeSensitivity: "Reach the most people",
  gainResponsivenessSensitivity: "Most good per resource",
  outcomeAggregationSensitivity: "Greatest overall benefit",
};

const PHASE_COLOR = { profiling: "#6366f1", simulation: "#0d9488" };

function scoreOf(profile: Block5UserProfile | undefined, key: Block5PolicyDimKey): number {
  return profile?.dimensions.find((d) => d.key === key)?.score ?? 0;
}

/** Reads any sensitivity score by key (used for the Directness/Context reflection lenses). */
function dimScoreOf(profile: Block5UserProfile | undefined, key: string): number {
  return profile?.dimensions.find((d) => d.key === key)?.score ?? 0;
}

/** Formats a duration in ms as "2m 5s" / "45s". */
function fmtDur(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

/* --------------------------- small presentational bits --------------------------- */

function HowTo({ children }: { children: ReactNode }) {
  return (
    <HStack gap="2" align="start" mb="3" bg="bg.subtle" rounded="md" px="3" py="2">
      <Icon color="fg.muted" mt="0.5" boxSize="3.5"><LuInfo /></Icon>
      <Text fontSize="xs" color="fg.muted" lineHeight="tall">{children}</Text>
    </HStack>
  );
}

function ChartCard({ index, title, howTo, caption, children }: {
  index: number; title: string; howTo: ReactNode; caption?: ReactNode; children: ReactNode;
}) {
  return (
    <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
      <HStack gap="2.5" mb="1" align="center">
        <Box flex="none" w="7" h="7" rounded="lg" bg="bg.subtle" display="flex" alignItems="center" justifyContent="center"
          fontSize="sm" fontWeight="bold" color="fg.muted">{index}</Box>
        <Heading size="sm" color="fg">{title}</Heading>
      </HStack>
      <Box pl="9">
        <HowTo>{howTo}</HowTo>
        {children}
        {caption && (
          <Text fontSize="sm" color="fg" fontStyle="italic" mt="3" borderLeftWidth="3px"
            borderLeftColor="border.emphasized" pl="3">{caption}</Text>
        )}
      </Box>
    </Box>
  );
}

/* ----------------------------------- the view ----------------------------------- */

export function Block5VisualizationsView({ results, onBack, onContinueToFeedback }: Props) {
  const scenarios = results.scenarioResults;
  const n = scenarios.length;
  const before = results.originalProfile;
  const after = results.userProfile;

  const scenarioTitle = (id: string, i: number): string =>
    BLOCK5_SCENARIOS.find((s) => s.id === id)?.title ?? `Scenario ${i + 1}`;
  const optionTitle = (scenId: string, optId: string): string => {
    const sc = BLOCK5_SCENARIOS.find((s) => s.id === scenId);
    return sc?.options.find((o) => o.id === optId)?.title ?? optId;
  };

  /* 1 · Radar: before vs after */
  const radarAxes = POLICY_DIM_KEYS.map((k) => VALUE_LABEL[k]);
  const radarSeries: RadarSeries[] = [];
  if (before) radarSeries.push({ name: "Before Block 5", color: SERIES_COLORS[1], values: POLICY_DIM_KEYS.map((k) => scoreOf(before, k)) });
  radarSeries.push({ name: "After Block 5", color: SERIES_COLORS[4], dashed: true, values: POLICY_DIM_KEYS.map((k) => scoreOf(after, k)) });
  const stability = results.stability ?? null;
  const stabilityCaption = stability === null
    ? null
    : `Stability ${stability}/100 — ${stability >= 80 ? "your values stayed very steady from start to finish." : stability >= 60 ? "your values shifted only a little." : "your values shifted noticeably as you decided."}`;

  /* 2 · Line: how each value shifted across the journey */
  const evoX = ["Before", ...scenarios.map((_, i) => `After S${i + 1}`)];
  const evoSeries: LineSeries[] = POLICY_DIM_KEYS.map((k, idx) => ({
    name: VALUE_LABEL[k],
    color: SERIES_COLORS[idx],
    values: [scoreOf(before, k), ...scenarios.map((r) => r.policySnapshotAfter?.[k] ?? scoreOf(after, k))],
  }));
  // biggest mover, for the caption
  let moverLabel = ""; let moverDelta = 0;
  for (const k of POLICY_DIM_KEYS) {
    const d = Math.abs(scoreOf(after, k) - scoreOf(before, k));
    if (d > moverDelta) { moverDelta = d; moverLabel = VALUE_LABEL[k]; }
  }
  const evoCaption = moverDelta < 3
    ? `Your four values held remarkably steady across all ${n} scenarios.`
    : `“${moverLabel}” moved the most across the journey (by ${Math.round(moverDelta)} points).`;

  /* 7 · Line: how your two reflection lenses (Directness vs Context) shifted across the journey.
     These only move when you generated and compared the alternate perspective inside a reflection. */
  const lensX = ["Before", ...scenarios.map((_, i) => `After S${i + 1}`)];
  const lensSeries: LineSeries[] = [
    {
      name: "Directness — your responsibility",
      color: SERIES_COLORS[3],
      values: [
        dimScoreOf(before, "directnessSensitivity"),
        ...scenarios.map((r) => r.framingSnapshotAfter?.directnessSensitivity ?? dimScoreOf(after, "directnessSensitivity")),
      ],
    },
    {
      name: "Context — circumstances",
      color: SERIES_COLORS[0],
      values: [
        dimScoreOf(before, "contextSensitivity"),
        ...scenarios.map((r) => r.framingSnapshotAfter?.contextSensitivity ?? dimScoreOf(after, "contextSensitivity")),
      ],
    },
  ];
  const lensMoved =
    Math.abs(dimScoreOf(after, "directnessSensitivity") - dimScoreOf(before, "directnessSensitivity")) +
    Math.abs(dimScoreOf(after, "contextSensitivity") - dimScoreOf(before, "contextSensitivity"));
  const finalDirectness = dimScoreOf(after, "directnessSensitivity");
  const finalContext = dimScoreOf(after, "contextSensitivity");
  const lensCaption = lensMoved < 1
    ? "Your two reflection lenses stayed exactly where they started — you didn't lean on one over the other."
    : finalContext >= finalDirectness
      ? "By the end, your Context lens (the circumstances behind the numbers) carried more weight."
      : "By the end, your Directness lens (your own responsibility for the outcome) carried more weight.";

  /* 3 · Bars: final choice & alignment per scenario */
  const choiceBars: HBar[] = scenarios.map((r, i) => ({
    label: `Scenario ${i + 1}`,
    value: r.matchScore ?? 0,
    color: ALIGN_COLORS[r.alignmentLevel ?? "misaligned"] ?? SERIES_COLORS[0],
    valueLabel: `${r.matchScore ?? 0}`,
  }));
  const alignedCount = scenarios.filter((r) => r.alignmentLevel === "aligned" || r.alignmentLevel === "weakly_aligned").length;
  const choiceCaption = `Your final choice fit your values in ${alignedCount} of ${n} scenario${n === 1 ? "" : "s"}.`;

  /* 4 · Line: consistency across scenarios */
  const consistencyValues = scenarios.map((r) => Math.round((r.vciScore ?? 0) * 100));
  const consistencySeries: LineSeries[] = [{ name: "Consistency", color: SERIES_COLORS[0], values: consistencyValues }];
  const vci = results.vci ?? 0;
  const consistencyCaption = `Overall, your choices were ${vci}/100 consistent with your values${results.vciLevel ? ` (${results.vciLevel.toLowerCase()})` : ""}.`;

  /* 5 · Bars: reconsideration per scenario */
  const switchBars: VBar[] = scenarios.map((r, i) => ({
    label: `S${i + 1}`,
    value: r.telemetry?.numberOfSwitches ?? 0,
    color: SERIES_COLORS[1],
  }));
  const totalSwitches = switchBars.reduce((a, b) => a + b.value, 0);
  let maxSwitchI = 0;
  switchBars.forEach((b, i) => { if (b.value > switchBars[maxSwitchI].value) maxSwitchI = i; });
  const switchCaption = totalSwitches === 0
    ? "You settled quickly — little back-and-forth in any scenario."
    : `You reconsidered most in Scenario ${maxSwitchI + 1}.`;
  const switchMax = Math.max(3, ...switchBars.map((b) => b.value));

  /* 6 · Bars: time per stage */
  const timing = buildTimingSummary(scenarios.map((r) => r.timeMs ?? 0));
  const rawTimeBars: (HBar & { phase: keyof typeof PHASE_COLOR })[] = [
    { label: "Block 1", value: timing.block1Ms, color: PHASE_COLOR.profiling, phase: "profiling" },
    { label: "Block 2", value: timing.block2Ms, color: PHASE_COLOR.profiling, phase: "profiling" },
    { label: "Block 3", value: timing.block3Ms, color: PHASE_COLOR.profiling, phase: "profiling" },
    { label: "Insights", value: timing.insightsMs, color: PHASE_COLOR.profiling, phase: "profiling" },
    { label: "Block 4", value: timing.block4Ms, color: PHASE_COLOR.profiling, phase: "profiling" },
    { label: "Final analysis", value: timing.finalAnalysisMs, color: PHASE_COLOR.profiling, phase: "profiling" },
    // One row per Block-5 scenario, however many the deck holds (was hardcoded to three).
    ...timing.block5.scenarioMs.map((ms, i) => ({
      label: `Scenario ${i + 1}`,
      value: ms,
      color: PHASE_COLOR.simulation,
      phase: "simulation" as const,
    })),
  ];
  const timeBars: HBar[] = rawTimeBars
    .filter((b) => b.value > 0)
    .map((b) => ({ label: b.label, value: b.value, color: b.color, valueLabel: fmtDur(b.value) }));
  const timeMax = Math.max(1, ...timeBars.map((b) => b.value));
  const totalMs = timing.totalExperimentMs;
  const timeCaption = `You spent about ${fmtDur(totalMs)} on the whole experiment.`;

  return (
    <Box minH="100dvh" bg="bg" px={{ base: "4", md: "6" }} py={{ base: "6", md: "10" }}>
      <VStack gap="6" align="stretch" maxW="6xl" mx="auto" animationName="fade-in" animationDuration="moderate">
        {/* Header */}
        <Stack direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "stretch", md: "center" }} gap="4">
          <Box>
            <Badge colorPalette="purple" variant="subtle" rounded="md" px="2" py="0.5" fontSize="2xs"
              textTransform="uppercase" letterSpacing="wider" mb="2">Your experiment in charts</Badge>
            <Heading size="2xl" color="fg" fontWeight="semibold">A picture of your journey</Heading>
            <Text color="fg.muted" fontSize="md" mt="1" maxW="2xl">
              Six views of how you decided — your values, your choices, your consistency, and your time.
              Each chart shows one thing, with a short note on how to read it.
            </Text>
          </Box>
          <Button onClick={onBack} variant="outline" colorPalette="gray" rounded="lg" gap="2" flexShrink={0} alignSelf={{ base: "start", md: "center" }}>
            <Icon><LuArrowLeft /></Icon>
            Back to results
          </Button>
        </Stack>

        {/* Charts */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: "5", md: "6" }}>
          {/* 1 · Radar */}
          <ChartCard index={1} title="Your values: before vs after Block 5"
            howTo={<>Each spoke is one of your four values, scored 0–100. The <b>solid</b> shape is where you started (from Blocks 1–4); the <b>dashed</b> shape is where you ended after the scenarios. The closer the two shapes match, the more <b>stable</b> your values stayed.</>}
            caption={stabilityCaption}>
            <RadarChart axes={radarAxes} series={radarSeries} max={100} />
            <ChartLegend items={radarSeries.map((s) => ({ label: s.name, color: s.color, dashed: s.dashed }))} />
          </ChartCard>

          {/* 2 · Evolution line */}
          <ChartCard index={2} title="How your four values shifted along the way"
            howTo={<>Follow each coloured line left to right to see how that value rose or fell — from <b>before</b> Block 5, then after each scenario. Lines that stay flat mean that value didn't change; lines that climb or dip show where a decision moved you.</>}
            caption={evoCaption}>
            <LineChart xLabels={evoX} series={evoSeries} max={100} />
            <ChartLegend items={evoSeries.map((s) => ({ label: s.name, color: s.color }))} />
          </ChartCard>

          {/* 3 · Choice & alignment */}
          <ChartCard index={3} title="Your choice in each scenario"
            howTo={<>Each bar is one scenario. The bar length is how well your <b>final choice</b> fit your values (0–100), and its colour shows the fit: <b>green</b> = aligned, <b>yellow</b> = weak, <b>orange/red</b> = against your values. Your actual choices are listed below.</>}
            caption={choiceCaption}>
            <HBarChart bars={choiceBars} max={100} unitHint="value fit (0–100)" />
            <ChartLegend items={[
              { label: "Aligned", color: ALIGN_COLORS.aligned },
              { label: "Weakly aligned", color: ALIGN_COLORS.weakly_aligned },
              { label: "Misaligned", color: ALIGN_COLORS.misaligned },
              { label: "Strongly misaligned", color: ALIGN_COLORS.strongly_misaligned },
            ]} />
            <Stack gap="2" mt="4">
              {scenarios.map((r, i) => (
                <HStack key={r.scenarioId} gap="2" align="start">
                  <Badge flexShrink={0} variant="subtle" rounded="md" px="2" fontSize="2xs"
                    style={{ color: ALIGN_COLORS[r.alignmentLevel ?? "misaligned"], borderColor: ALIGN_COLORS[r.alignmentLevel ?? "misaligned"] }}
                    borderWidth="1px" bg="transparent">
                    {ALIGNMENT_LABEL[r.alignmentLevel ?? "misaligned"]}
                  </Badge>
                  <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                    <Text as="span" color="fg" fontWeight="medium">{scenarioTitle(r.scenarioId, i)}:</Text>{" "}
                    {optionTitle(r.scenarioId, r.selectedOptionId)}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </ChartCard>

          {/* 4 · Consistency */}
          <ChartCard index={4} title="How consistent your choices were"
            howTo={<>Each point is one scenario, scored 0–100 for how well your choice matched your values (a choice you firmly stood by after reflection still counts as consistent). The <b>dashed line</b> is your overall consistency across all three.</>}
            caption={consistencyCaption}>
            <LineChart xLabels={scenarios.map((_, i) => `Scenario ${i + 1}`)} series={consistencySeries}
              max={100} refLine={{ value: vci, label: "overall" }} />
          </ChartCard>

          {/* 5 · Reconsideration */}
          <ChartCard index={5} title="How much you reconsidered"
            howTo={<>Each bar counts the times you genuinely <b>changed your mind</b> inside a scenario — switching to a different option, stepping back out of a reflection step, or changing a final pick before confirming. Taller means more back-and-forth.</>}
            caption={switchCaption}>
            <VBarChart bars={switchBars} max={switchMax} />
          </ChartCard>

          {/* 6 · Time */}
          <ChartCard index={6} title="Where your time went"
            howTo={<>Each bar is the time you spent in one part of the experiment. <b>Indigo</b> bars are the value-profiling stages (Blocks 1–4); <b>teal</b> bars are the Block-5 scenarios.</>}
            caption={timeCaption}>
            <HBarChart bars={timeBars} max={timeMax} unitHint="time per stage" />
            <ChartLegend items={[
              { label: "Value profiling (Blocks 1–4)", color: PHASE_COLOR.profiling },
              { label: "Simulation (Block 5)", color: PHASE_COLOR.simulation },
            ]} />
          </ChartCard>

          {/* 7 · Reflection lenses (Directness vs Context) evolution */}
          <ChartCard index={7} title="How your two reflection lenses shifted"
            howTo={<>When a choice went against your values, the reflection could be framed two ways — <b>Directness</b> (it's your own rule, your responsibility) and <b>Context</b> (circumstances shaped the numbers). If you generated and compared both, the lens that swayed (or didn't) you was nudged. Each line traces one lens from before Block 5 through each scenario.</>}
            caption={lensCaption}>
            <LineChart xLabels={lensX} series={lensSeries} max={100} />
            <ChartLegend items={lensSeries.map((s) => ({ label: s.name, color: s.color }))} />
          </ChartCard>
        </SimpleGrid>

        {/* Footer actions */}
        <HStack justify="space-between" pt="2" pb="8" wrap="wrap" gap="3">
          <Button onClick={onBack} variant="ghost" colorPalette="gray" rounded="lg" gap="2">
            <Icon><LuArrowLeft /></Icon>
            Back to results
          </Button>
          <Button onClick={onContinueToFeedback} colorPalette="pink" rounded="lg" px="8" gap="2">
            Continue to feedback
            <Icon><LuArrowRight /></Icon>
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}

export default Block5VisualizationsView;
