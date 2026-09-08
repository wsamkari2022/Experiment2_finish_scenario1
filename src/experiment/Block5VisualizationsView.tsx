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
import { analysePosition, positionEffectLabel, POSITION_SHORT } from "./block5Position";
import { analyseStance, STANCE_LABEL } from "./block5Company";
import { analyseMirror, responsibilityGapLabel } from "./block5Mirror";
import { ordinal } from "./block5Performance";
import { readBlocks123, moneySentence, trolleySentence, workforceSentence } from "./blocks123Consistency";
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
  vulnerabilityProtectionSensitivity: "Protecting the vulnerable",
  groupSizeSensitivity: "Reducing harm",
  gainResponsivenessSensitivity: "How much is gained",
  outcomeAggregationSensitivity: "How many are helped",
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
  /*
   * WHETHER THIS CHART IS WORTH DRAWING AT ALL.
   *
   * Both lenses only move when a participant opens the alternate view AND says which one reached
   * them, which most people never do. For everyone else this card is two flat lines along zero:
   * it occupies the same space as a real finding, and it teaches the reader that a flat line is
   * normal here - which is exactly the wrong lesson for a chart whose whole content is movement.
   *
   * So it is not drawn unless something actually moved. The test walks EVERY point against that
   * series' own first point rather than comparing start with end, because a lens that rose after
   * scenario 2 and fell back by scenario 5 did move, and a start-versus-end check would call it
   * unchanged and hide the one participant whose data is most interesting.
   */
  const lensHasMovement = lensSeries.some((series) =>
    series.values.some((v) => Math.abs(v - series.values[0]) >= 1));

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

  /*
   * PERFORMANCE PER SCENARIO, on the same rows as the value-fit chart above it.
   *
   * Deliberately a sibling chart rather than a second series inside the fit chart: the two answer
   * different questions and share only their row labels, so reading ACROSS the pair is the point.
   * A scenario with a long fit bar and a short performance bar is a decision where the participant
   * held to their values and gave up outcome quality — which is the trade-off the whole study is
   * about, and it has never been visible in one place before.
   *
   * The bar is `performanceCaptured`: a share of what that scenario's six options actually
   * offered, so a long bar always means "took a strong option here" regardless of menu.
   */
  const perfBars: HBar[] = scenarios.map((r, i) => {
    const v = r.performanceCaptured;
    return {
      label: `Scenario ${i + 1}`,
      value: v ?? 0,
      color: v === undefined ? SERIES_COLORS[1]
        : v >= 70 ? "#0d9488" : v >= 45 ? "#2563eb" : "#7c3aed",
      valueLabel: v === undefined ? "—" : `${v}`,
    };
  });
  const perfVals = scenarios.map((r) => r.performanceCaptured).filter((v): v is number => typeof v === "number");
  const perfMean = perfVals.length ? Math.round(perfVals.reduce((a, b) => a + b, 0) / perfVals.length) : 0;
  const tradedCount = scenarios.filter((r) =>
    typeof r.performanceCaptured === "number" && (r.matchScore ?? 0) >= 60 && r.performanceCaptured < 45).length;
  const perfCaption = perfVals.length === 0
    ? "No performance data recorded for these scenarios."
    : `On average you took ${perfMean}% of the outcome quality each scenario offered.` +
      (tradedCount > 0
        ? ` In ${tradedCount} scenario${tradedCount === 1 ? "" : "s"} you chose an option that fit your values well but performed poorly.`
        : "");
  const choiceCaption = `Your final choice fit your values in ${alignedCount} of ${n} scenario${n === 1 ? "" : "s"}.`;

  /* 5 · Position Effect — how far each choice sat from the pre-Block-5 profile.
   *
   * Read this one ACROSS the three position bands, not down the five bars. The single headline
   * number is a summary; the SHAPE across "only me" / "me and my people" / "other people" is the
   * finding, because two participants can reach the same headline by completely different routes
   * (one consistent until strangers are involved, one loyal only to the people in the room).
   *
   * The drift check below it is not decoration. When two or more scenarios SHARE a position but
   * sit at different points in the sequence, movement across them is drift at a CONSTANT position
   * - i.e. time on task rather than position. It is reported next to the effect, never after it.
   *
   * WHEN NO POSITION REPEATS, THE CHECK CANNOT BE RUN, and the caption says so in place of it.
   * That line is the most important one on the card in that case: without the check, a genuine
   * position-shifter and a participant answering at random both score 100, and the headline alone
   * cannot tell them apart. Printing the effect with no caveat would be the one reading of this
   * chart that is actually wrong.
   */
  /* Blocks 1-3 are read straight from their own storage; Block 5 never rewrites them. */
  const b123 = readBlocks123();

  const position = analysePosition(scenarios, before);

  /*
    The heading promises a number of views, and four of them are conditional, so the number is
    counted rather than written. A hard-coded word here would promise a chart that is not drawn -
    which is exactly what happened when the lens chart first became conditional.
  */
  const hasMoney = !!b123.money;
  const hasTrolley = !!b123.trolley && b123.trolley.gap !== null;
  const hasWorkforce = !!b123.workforce;
  const hasDeliberation = !!b123.deliberation;

  /*
    The workplace pair. Both are conditional on the participant having REACHED those scenarios, so
    an incomplete run draws neither card rather than a card about a decision that never happened.
  */
  /* Both measure movement AWAY FROM the frozen profile, so without one there is nothing to measure
     from. Data collected before that snapshot existed draws neither card, which is the same rule
     analysePosition already follows — a fabricated origin would draw a chart claiming the
     participant never moved. */
  const stance = before ? analyseStance(scenarios, before, BLOCK5_SCENARIOS) : null;
  const mirror = before ? analyseMirror(scenarios, before) : null;
  const hasStance = !!stance;
  const hasMirror = !!mirror;

  const chartCount = 10 + (hasStance ? 1 : 0) + (hasMirror ? 1 : 0)
    + (hasMoney ? 1 : 0) + (hasTrolley ? 1 : 0)
    + (hasWorkforce ? 1 : 0) + (hasDeliberation ? 1 : 0);

  /*
    Card numbers are counted forward through the cards that will actually render, so hiding one
    never leaves a gap in the sequence. Hard-coded indices would print "10, 12, 13" the moment a
    participant had no Block 1 data.
  */
  const iStance = 8;
  const iMirror = iStance + (hasStance ? 1 : 0);
  const iConsistency = iMirror + (hasMirror ? 1 : 0);
  const iReconsidered = iConsistency + 1;
  const iTime = iReconsidered + 1;
  const iLens = iTime + 1;
  const iMoney = iLens + (lensHasMovement ? 1 : 0);
  const iTrolley = iMoney + (hasMoney ? 1 : 0);
  const iWorkforce = iTrolley + (hasTrolley ? 1 : 0);
  const iDeliberation = iWorkforce + (hasWorkforce ? 1 : 0);
  const POSITION_BAND_COLOR: Record<string, string> = {
    self: "#0d9488",
    self_and_group: "#2563eb",
    others: "#7c3aed",
    under_authority: "#c026d3",
    receiving_end: "#0f766e",
  };
  /** Own values vs the employer's, kept apart so the two are never drawn in one another's colour. */
  const OWN_COLOR = "#7c3aed";
  const COMPANY_COLOR = "#b45309";
  const positionBars: HBar[] = position.rows.map((r) => ({
    label: `S${r.index} · ${POSITION_SHORT[r.position]}`,
    value: r.distance,
    color: POSITION_BAND_COLOR[r.position] ?? SERIES_COLORS[0],
    valueLabel: `${r.distance}`,
  }));
  const positionMax = Math.max(20, ...position.rows.map((r) => r.farthest));
  /*
   * THE CAPTION NAMES ITS OWN QUANTITY, on each of its three lines.
   *
   * The three facts under this chart are measured on three DIFFERENT things, and a run-on sentence
   * that mixes them invites the obvious question: "what do you mean by 'furthest'?" The headline
   * compares positions on the share of the room used; the direction line reports the largest signed
   * move on ONE value; the drift check reports spread among same-position scenarios. Any of them
   * can point at a different position from the others, and that is not a contradiction - it is
   * three questions. Each line now says which question it answers.
   */
  /*
   * Which position repeats, and how many times. Derived rather than written down: the caption used
   * to say "your three 'other people' scenarios", which was true of one particular deck and became
   * false the moment the deck changed. `repeatedPosition` is null when nothing repeats, which is
   * also the condition under which `position.drift` is null.
   */
  const positionCounts = position.rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.position] = (acc[r.position] ?? 0) + 1;
    return acc;
  }, {});
  const repeatedEntry = Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0];
  const repeatedPosition = repeatedEntry && repeatedEntry[1] >= 2 ? repeatedEntry : null;
  const bandCount = Object.keys(positionCounts).length;

  const positionCaption = position.effect === null ? (
    "Not enough scenarios to compare positions."
  ) : (
    <>
      <b>Position Effect {position.effect}/100</b> — {positionEffectLabel(position.effect).toLowerCase()}.
      {" "}This compares the {bandCount} positions on the <b>share of the room</b> each one used.
      {position.sentence && (<><br /><b>Largest single move on one value:</b> {position.sentence}</>)}
      {position.drift !== null && repeatedPosition ? (
        <><br /><b>Drift check</b> (the same position, {repeatedPosition[1]} times over): your{" "}
          {repeatedPosition[1]} “{POSITION_SHORT[repeatedPosition[0] as keyof typeof POSITION_SHORT]}”
          {" "}scenarios varied by {position.drift} points among themselves
          {position.drift >= 35
            ? " — that is large, so part of the effect above may be time on task rather than position."
            : ", so the pattern above is unlikely to be time on task alone."}
        </>
      ) : (
        <><br /><b>No drift check available.</b> Every position appears only once in this run, so
          there is no way to tell a real response to position apart from movement that would have
          happened anyway as the session went on. Read the number above as a{" "}
          <b>description of what this participant did</b>, not as evidence that position caused it.
        </>
      )}
    </>
  );


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
    { label: "Block 4", value: timing.block4Ms, color: PHASE_COLOR.profiling, phase: "profiling" },
    /*
      "Insights" and "Final analysis" are deliberately absent. They are read-only pages the
      participant scrolls through rather than stages where they decide anything, so their times are
      a few hundred milliseconds and render as a hairline labelled "0s" - a row that carries no
      information while taking a full line of the chart. The `.value > 0` filter below does not
      catch them, because a 400ms page is greater than zero and only LOOKS like zero once rounded
      to seconds. The times are still recorded and still counted in the total below the chart;
      only the two rows are dropped.
    */
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
              {chartCount + (lensHasMovement ? 1 : 0)} views of how you decided — your values, your
              choices, your consistency, and your time.
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

          {/* 3b · Performance captured per scenario — read across from card 3 */}
          <ChartCard index={4} title="How much performance you took in each scenario"
            howTo={<>Each bar is one scenario, on the <b>same rows</b> as the chart beside it. The length is how much of the outcome quality that scenario actually offered you took: <b>100</b> would be the strongest-performing option on the table, <b>0</b> the weakest. Compare the two charts row by row — a long bar there and a short bar here is a decision where you kept your values and gave up performance.</>}
            caption={perfCaption}>
            <HBarChart bars={perfBars} max={100} unitHint="performance taken (0–100)" />
            <ChartLegend items={[
              { label: "took a strong option", color: "#0d9488" },
              { label: "took a middle option", color: "#2563eb" },
              { label: "took a weaker option", color: "#7c3aed" },
            ]} />
          </ChartCard>

          {/* 5 · Position Effect — the study's independent variable, seen from the outside */}
          <ChartCard index={5} title="How far each choice sat from the person you were"
            howTo={<>Each bar is one scenario. The length is how far the option you chose sat from your profile <b>before Block 5 started</b> — averaged over your four values, so <b>0</b> would mean you chose an option that matched you exactly. The bars are coloured by <b>who carried the cost</b>. Read <b>across the three colours</b>, not down the five bars: that is where the finding is.</>}
            caption={positionCaption}>
            {position.rows.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">No position data recorded for these scenarios.</Text>
            ) : (
              <>
                <HBarChart bars={positionBars} max={positionMax} unitHint="distance from your earlier profile" />
                <ChartLegend items={[
                  { label: "only me", color: POSITION_BAND_COLOR.self },
                  { label: "me and my people", color: POSITION_BAND_COLOR.self_and_group },
                  { label: "other people", color: POSITION_BAND_COLOR.others },
                ]} />
                <Stack gap="1.5" mt="3">
                  {position.summaries.map((sm) => (
                    <HStack key={sm.position} gap="3" align="baseline">
                      <Box flex="none" w="3" h="3" rounded="sm" bg={POSITION_BAND_COLOR[sm.position]} />
                      <Text fontSize="sm" color="fg" fontWeight="medium" minW="44">{sm.label}</Text>
                      <Text fontSize="sm" color="fg.muted">
                        average distance {sm.distance}
                        {sm.scenarioCount > 1 ? ` across ${sm.scenarioCount} scenarios` : ""}
                      </Text>
                    </HStack>
                  ))}
                </Stack>
                {/*
                  "GOOD OR BAD?" ANSWERED ON THE PAGE, not only in a write-up.
                  A number with no stated direction gets read as a grade by default, and this one
                  is not a grade. The formula is shown for the same reason: a measure whose
                  arithmetic is hidden invites the question "what do you actually mean by distance",
                  and the honest answer is short enough to print.
                */}
                <Box mt="4" bg="bg" borderWidth="1px" borderColor="border" rounded="lg" px="4" py="3.5">
                  <Text fontSize="2xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase"
                    letterSpacing="wider" mb="2">How to read these numbers</Text>
                  <Text fontSize="xs" color="fg.muted" fontFamily="mono" mb="2.5">
                    distance = average of | your value − the option's value | , over your four values
                  </Text>
                  <Stack gap="1.5">
                    <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                      <Text as="span" fontWeight="semibold" color="fg">0</Text> would mean you chose an
                      option that matched the values you arrived with, exactly.
                    </Text>
                    <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                      <Text as="span" fontWeight="semibold" color="fg">A bigger number is not worse.</Text>{" "}
                      This is a description, not a grade — somebody who moves may have thought harder,
                      not less carefully. Moving further <i>up</i> a value than you asked for counts the
                      same as moving down.
                    </Text>
                    <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                      <Text as="span" fontWeight="semibold" color="fg">What matters is whether it changes
                      between the three colours.</Text> One number on its own says very little; the same
                      person scoring 13 alone and 40 for strangers is the finding.
                    </Text>
                  </Stack>
                </Box>
              </>
            )}
          </ChartCard>

          {/* 6 · The receipts — what was actually chosen, grouped by who carried the cost */}
          <ChartCard index={6} title="What you chose in each position"
            howTo={<>The five decisions, grouped by <b>who carried the cost</b>. For each one: how far that option sat from your earlier profile, and how much of the outcome quality that scenario offered it took. This is the raw record the two charts around it are built from.</>}
            caption={position.tradeoffSentence ?? undefined}>
            {position.choices.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">No choices recorded.</Text>
            ) : (
              <Stack gap="4">
                {position.tradeoffs.map((band) => (
                  <Box key={band.position} borderLeftWidth="3px" borderLeftColor={POSITION_BAND_COLOR[band.position]} pl="3.5">
                    <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase"
                      letterSpacing="wider" mb="2">{band.label}</Text>
                    <Stack gap="2.5">
                      {position.choices.filter((c) => c.position === band.position).map((c) => (
                        <Box key={c.scenarioId}>
                          <HStack gap="2" align="baseline" wrap="wrap">
                            <Text fontSize="xs" color="fg.subtle" fontFamily="mono" flex="none">S{c.index}</Text>
                            <Text fontSize="sm" color="fg" fontWeight="medium">{c.optionTitle}</Text>
                          </HStack>
                          <HStack gap="4" pl="6" wrap="wrap">
                            <Text fontSize="xs" color="fg.muted">
                              distance from your profile <Text as="span" color="fg" fontWeight="semibold">{c.distance}</Text>
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                              performance <Text as="span" color="fg" fontWeight="semibold">{c.performance}</Text>
                              {" "}({ordinal(c.performanceRank)} of {c.performanceTotal})
                            </Text>
                          </HStack>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </ChartCard>

          {/*
            7 · THE TRADE-OFF, on one axis.

            Both measures are already 0-100 and both are already normalised within a scenario, so
            they can share an axis honestly. That is the whole reason this card can exist: a paired
            chart whose two bars used different scales would invite exactly the comparison it
            cannot support.
          */}
          <ChartCard index={7} title="Your values against your performance, in each position"
            howTo={<>Two bars for each position, on the <b>same 0–100 scale</b>. The first is how far your choices sat from your own values, as a share of the room that scenario gave you. The second is how much of the available outcome quality those same choices took. <b>Read the pair</b>: if the first bar grows while the second grows too, you let outcome quality pull you away from your values once somebody else was paying.</>}
            caption={position.tradeoffSentence ?? undefined}>
            {position.tradeoffs.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">No positions recorded.</Text>
            ) : (
              <Stack gap="4">
                {position.tradeoffs.map((t) => (
                  <Box key={t.position}>
                    <HStack gap="2" mb="1.5" align="baseline">
                      <Box flex="none" w="3" h="3" rounded="sm" bg={POSITION_BAND_COLOR[t.position]} />
                      <Text fontSize="sm" fontWeight="semibold" color="fg">{t.label}</Text>
                      <Text fontSize="xs" color="fg.subtle">
                        {t.scenarioCount} scenario{t.scenarioCount > 1 ? "s" : ""}
                      </Text>
                    </HStack>
                    <Stack gap="1.5" pl="5">
                      {[
                        // The labels name the UNIT, not just the quantity. Chart 5 shows the raw
                        // distance in points (23.8); this shows the share of the room available
                        // (0). Same scenario, two true numbers - and "moved from your values" on
                        // both would read as a contradiction rather than as two views.
                        { label: "share of the room you used", value: t.departure, color: POSITION_BAND_COLOR[t.position] },
                        { label: "share of the performance you took", value: t.performance, color: "#d97706" },
                      ].map((bar) => (
                        <HStack key={bar.label} gap="3">
                          <Text fontSize="xs" color="fg.muted" flex="none" w={{ base: "32", md: "40" }}>{bar.label}</Text>
                          <Box flex="1" h="2.5" bg="bg.subtle" rounded="full" overflow="hidden">
                            <Box h="full" rounded="full" bg={bar.color}
                              style={{ width: `${Math.max(1, Math.min(100, bar.value))}%` }} />
                          </Box>
                          <Text fontSize="xs" color="fg" fontWeight="semibold" fontFamily="mono"
                            flex="none" w="8" textAlign="right">{bar.value}</Text>
                        </HStack>
                      ))}
                    </Stack>
                  </Box>
                ))}
                <Text fontSize="2xs" color="fg.subtle" lineHeight="tall">
                  Both bars answer “how much of what was available?”, which is why they share a scale.
                  They are not the same as the point distances in chart 5: an option can sit 23.8 points
                  from your profile and still be the closest one that scenario had, which is 0% of the
                  room to move.
                </Text>
              </Stack>
            )}
          </ChartCard>

          {/*
            STANCE — what you did with an employer's values that were not yours.
            Drawn as two bars per option rather than a scatter: a scatter plots six unlabelled dots
            and asks the reader to find theirs, while paired bars put the chosen row's two distances
            side by side with the five it was chosen over.
          */}
          {stance && (
            <ChartCard index={iStance} title="What you did with your employer's values"
              howTo={<>Your employer published one priority: <b>{stance.company.principle}</b> Each row is one option that was on the table, with <b>two distances</b> — how far it sat from <b>your own</b> values (purple) and from <b>your employer's</b> stated priority (amber). Shorter is closer. <b>The row you chose is highlighted.</b> If its purple bar is short you held your own line; if its amber bar is short you took theirs.</>}
              caption={<>
                <b>{STANCE_LABEL[stance.stance]}.</b> {stance.sentence}
                {" "}The employer's priority was set to <b>{VALUE_LABEL[stance.company.statedKey].toLowerCase()}</b>,
                which is the value you rated <b>lowest</b> in the earlier blocks ({stance.company.participantScore}/100) —
                so this was always going to be a value you had to argue with.
              </>}>
              <Stack gap="2.5">
                {stance.field.map((f) => (
                  <Box key={f.optionId}
                    bg={f.chosen ? "bg.subtle" : "transparent"}
                    borderWidth="1px" borderColor={f.chosen ? "border.emphasized" : "transparent"}
                    rounded="lg" px="3" py="2">
                    <HStack gap="2" mb="1.5" align="baseline">
                      <Text fontSize="xs" fontWeight={f.chosen ? "bold" : "medium"} color={f.chosen ? "fg" : "fg.muted"}>
                        {f.title}
                      </Text>
                      {f.chosen && (
                        <Badge size="sm" bg="transparent" borderWidth="1px" borderColor="border.emphasized"
                          color="fg.muted" rounded="md" px="1.5" fontSize="2xs">your choice</Badge>
                      )}
                    </HStack>
                    <Stack gap="1">
                      {[
                        { label: "from your values", value: f.own, color: OWN_COLOR },
                        { label: `from ${stance.company.name}'s`, value: f.theirs, color: COMPANY_COLOR },
                      ].map((bar) => (
                        <HStack key={bar.label} gap="3">
                          <Text fontSize="2xs" color="fg.subtle" flex="none" w={{ base: "24", md: "32" }}>{bar.label}</Text>
                          <Box flex="1" h="2" bg="bg.subtle" rounded="full" overflow="hidden">
                            <Box h="full" rounded="full" bg={bar.color}
                              style={{ width: `${Math.max(1, Math.min(100, bar.value))}%`, opacity: f.chosen ? 1 : 0.45 }} />
                          </Box>
                          <Text fontSize="2xs" color="fg.muted" fontFamily="mono" flex="none" w="8" textAlign="right">
                            {bar.value}
                          </Text>
                        </HStack>
                      ))}
                    </Stack>
                  </Box>
                ))}
                <ChartLegend items={[
                  { label: "distance from your own values", color: OWN_COLOR },
                  { label: "distance from your employer's stated priority", color: COMPANY_COLOR },
                ]} />
              </Stack>
            </ChartCard>
          )}

          {/*
            THE MIRROR — the one contrast in the study where content is held exactly constant.
            Its caption has to carry that, because a reader who does not know the two scenarios were
            identical will read the gap as "two different situations produced two different answers",
            which is the one conclusion the card is built to rule out.
          */}
          {mirror && (
            <ChartCard index={iMirror} title="What you chose for them, and what you wished for yourself"
              howTo={<>These two scenarios were <b>the same company, the same decision, and the same six options</b> — the only thing that changed was whether you were making the call or living with it. Each bar is how far your answer sat from <b>your own</b> values, as a share of the room that menu allowed. Because nothing else differed, <b>any gap between them is about position and nothing else.</b></>}
              caption={<>
                {mirror.sentence}
                {" "}<b>Consistency when deciding {mirror.vciActed}/100, when only wishing {mirror.vciWished}/100</b> — {responsibilityGapLabel(mirror.responsibilityGap).toLowerCase()}.
                {mirror.hurried && (
                  <> <b>Read with care:</b> the wish came back in {mirror.wished.seconds} seconds, which is fast
                  enough to be recall of the earlier screen rather than a fresh judgement.</>
                )}
              </>}>
              <Stack gap="3">
                {[
                  { key: "decided", label: "When you decided", who: "it landed on your colleagues",
                    side: mirror.decided, color: POSITION_BAND_COLOR.under_authority },
                  { key: "wished", label: "When you wished", who: "it landed on you",
                    side: mirror.wished, color: POSITION_BAND_COLOR.receiving_end },
                ].map((row) => (
                  <Box key={row.key}>
                    <HStack gap="2" mb="1.5" align="baseline" wrap="wrap">
                      <Box flex="none" w="3" h="3" rounded="sm" bg={row.color} />
                      <Text fontSize="sm" fontWeight="semibold" color="fg">{row.label}</Text>
                      <Text fontSize="xs" color="fg.subtle">— {row.who}</Text>
                    </HStack>
                    <HStack gap="3" pl="5">
                      <Text fontSize="xs" color="fg.muted" flex="none" w={{ base: "32", md: "44" }}>
                        “{row.side.optionTitle}”
                      </Text>
                      <Box flex="1" h="2.5" bg="bg.subtle" rounded="full" overflow="hidden">
                        <Box h="full" rounded="full" bg={row.color}
                          style={{ width: `${Math.max(1, Math.min(100, row.side.departure))}%` }} />
                      </Box>
                      <Text fontSize="xs" color="fg" fontWeight="semibold" fontFamily="mono"
                        flex="none" w="8" textAlign="right">{row.side.departure}</Text>
                    </HStack>
                  </Box>
                ))}
                <Box borderTopWidth="1px" borderColor="border.subtle" pt="2.5">
                  <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                    <b>Gap: {mirror.mirrorGap > 0 ? "+" : ""}{mirror.mirrorGap}.</b>{" "}
                    {mirror.mirrorGap > 0
                      ? "You moved further from your own values when you were the one holding the pen."
                      : mirror.mirrorGap < 0
                        ? "You moved further from your own values when the decision was being made about you."
                        : "You were the same distance from your own values in both chairs."}
                  </Text>
                  <Text fontSize="2xs" color="fg.subtle" lineHeight="tall" mt="1.5">
                    You answered the deciding version first. That order makes this a cautious test:
                    having already committed, most people lean towards repeating themselves, so a gap
                    found here is a floor rather than a ceiling.
                  </Text>
                </Box>
              </Stack>
            </ChartCard>
          )}

          {/* 4 · Consistency */}
          <ChartCard index={iConsistency} title="How consistent your choices were"
            howTo={<>Each point is one scenario, scored 0–100 for how well your choice matched your values <b>as they stood at that moment</b> — your values update as you go, so a value you take on during the block counts from then on. The <b>dashed line</b> is your overall consistency across all five.</>}
            caption={consistencyCaption}>
            <LineChart xLabels={scenarios.map((_, i) => `Scenario ${i + 1}`)} series={consistencySeries}
              max={100} refLine={{ value: vci, label: "overall" }} />
          </ChartCard>

          {/* 5 · Reconsideration */}
          <ChartCard index={iReconsidered} title="How much you reconsidered"
            howTo={<>Each bar counts the times you genuinely <b>changed your mind</b> inside a scenario — switching to a different option, stepping back out of a reflection step, or changing a final pick before confirming. Taller means more back-and-forth.</>}
            caption={switchCaption}>
            <VBarChart bars={switchBars} max={switchMax} />
          </ChartCard>

          {/* 6 · Time */}
          <ChartCard index={iTime} title="Where your time went"
            howTo={<>Each bar is the time you spent in one part of the experiment. <b>Indigo</b> bars are the value-profiling stages (Blocks 1–4); <b>teal</b> bars are the Block-5 scenarios.</>}
            caption={timeCaption}>
            <HBarChart bars={timeBars} max={timeMax} unitHint="time per stage" />
            <ChartLegend items={[
              { label: "Value profiling (Blocks 1–4)", color: PHASE_COLOR.profiling },
              { label: "Simulation (Block 5)", color: PHASE_COLOR.simulation },
            ]} />
          </ChartCard>

          {/* 7 · Reflection lenses — only when they actually moved. See lensHasMovement. */}
          {lensHasMovement && (
          <ChartCard index={iLens} title="How your two reflection lenses shifted"
            howTo={<>When a choice went against your values, the reflection could be framed two ways — <b>Directness</b> (it's your own rule, your responsibility) and <b>Context</b> (circumstances shaped the numbers). If you generated and compared both, the lens that swayed (or didn't) you was nudged. Each line traces one lens from before Block 5 through each scenario.</>}
            caption={lensCaption}>
            <LineChart xLabels={lensX} series={lensSeries} max={100} />
            <ChartLegend items={lensSeries.map((s) => ({ label: s.name, color: s.color }))} />
          </ChartCard>
          )}
          {/*
            12-14 · HOW THE EARLIER BLOCKS WERE ANSWERED.

            Deliberately descriptive and deliberately un-scored. Answering differently in different
            contexts is the sensitivity this study measures, not a defect, so nothing here is
            labelled good or bad except the two things that really are defects of ANSWERING rather
            than positions about the world: clicking faster than the text can be read, and moving
            in both directions on an axis that only moves one way.
          */}
          {b123.available && (
            <>
              {hasMoney && b123.money && (
                <ChartCard index={iMoney} title="Where the money was found, and what you did"
                  howTo={<>Block 1 asked the same question in three places, and each place started again from $0.25. A <b>longer bar</b> means you held out through more amounts before keeping the money. A short bar means you kept it early. There is no right answer here — the point is whether the <b>place</b> changed you.</>}
                  caption={moneySentence(b123.money)}>
                  <HBarChart
                    bars={b123.money.points.map((p) => ({
                      label: p.shortLabel,
                      value: p.rung,
                      color: SERIES_COLORS[1],
                      valueLabel: p.kept ? `kept at ${p.amountLabel}` : "never kept it",
                    }))}
                    max={b123.money.maxRung}
                    unitHint={`steps up the ladder (0 = kept it at $0.25, ${b123.money.maxRung} = never kept it)`} />
                </ChartCard>
              )}

              {hasTrolley && b123.trolley && (
                <ChartCard index={iTrolley} title="The same outcome, two different acts"
                  howTo={<>Block 2 asked how many lives had to be saved before you would act — first by <b>pulling a lever</b>, then by <b>pushing a person</b>. Both ladders started from one life. A longer bar means you needed a bigger number before you were willing.</>}
                  caption={trolleySentence(b123.trolley)}>
                  <HBarChart
                    bars={[
                      { label: "Pull a lever", value: b123.trolley.leverRung ?? 0,
                        color: SERIES_COLORS[0], valueLabel: b123.trolley.leverLabel ?? "—" },
                      { label: "Push a person", value: b123.trolley.bridgeRung ?? 0,
                        color: SERIES_COLORS[4], valueLabel: b123.trolley.bridgeLabel ?? "—" },
                    ]}
                    max={b123.trolley.maxRung}
                    unitHint="steps up the ladder before you would act" />
                </ChartCard>
              )}

              {hasWorkforce && b123.workforce && (
                <ChartCard index={iWorkforce} title="As the group got bigger, what did you ask for?"
                  howTo={<>Block 3 asked the same question six times: how much financial gain justified a rollout that harms workers, for <b>three group sizes</b> and <b>two kinds of worker</b>. Higher means you demanded more before agreeing. <b>Read each line left to right</b> — a line that rises, falls, or stays flat is all coherent; a line that does both is the one thing here worth a second look.</>}
                  caption={workforceSentence(b123.workforce)}>
                  <LineChart
                    xLabels={b123.workforce.sizeLabels}
                    series={b123.workforce.series.map((s, i) => ({
                      name: s.label,
                      color: i === 0 ? SERIES_COLORS[4] : SERIES_COLORS[0],
                      values: s.rungs,
                    }))}
                    max={b123.workforce.maxRung} />
                  <ChartLegend items={b123.workforce.series.map((s, i) => ({
                    label: s.label, color: i === 0 ? SERIES_COLORS[4] : SERIES_COLORS[0] }))} />
                </ChartCard>
              )}

              {hasDeliberation && b123.deliberation && (
                <ChartCard index={iDeliberation} title="How long you took over each answer"
                  howTo={<>The time between one answer and the next, across Blocks 1–3, reported as a <b>median</b> so that one interruption cannot hide the rest. This is the only thing on this page that can be answered wrongly rather than differently: below about 2.5 seconds the question text cannot have been read.</>}
                  caption={b123.deliberation.hurried
                    ? `A median of ${b123.deliberation.medianSeconds}s per answer is quicker than the questions can be read. Worth knowing when you read everything else on this page.`
                    : `A median of ${b123.deliberation.medianSeconds}s per answer, across ${b123.deliberation.decisions} decisions — enough time to read and consider each one.`}>
                  <Stack gap="2">
                    <HStack gap="3" align="baseline">
                      <Text fontSize="2xl" fontWeight="bold"
                        color={b123.deliberation.hurried ? "orange.fg" : "fg"}>
                        {b123.deliberation.medianSeconds}s
                      </Text>
                      <Text fontSize="sm" color="fg.muted">median time per answer</Text>
                    </HStack>
                    <Text fontSize="sm" color="fg.muted">
                      across {b123.deliberation.decisions} decisions in Blocks 1–3
                    </Text>
                  </Stack>
                </ChartCard>
              )}
            </>
          )}

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
