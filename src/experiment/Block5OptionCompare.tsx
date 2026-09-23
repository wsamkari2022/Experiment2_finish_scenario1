/**
 * Block5OptionCompare.tsx — the "Compare all options" overlay for a Block 5 scenario.
 *
 * WHAT IT SHOWS
 * Two radar (spider) charts drawn from data that already exists on every scenario option —
 * nothing here computes or alters experiment logic, it only visualizes what the option
 * objects already declare:
 *
 *   Chart 1 — PERFORMANCE IMPACT: the 8 generic metrics on `option.metrics`
 *             (METRIC_KEYS). This is the same data the top dashboard aggregates, so an
 *             option's shape here explains exactly how it would move that dashboard.
 *
 *   Chart 2 — THE FOUR VALUE PRIORITIES: the 4 POLICY dimensions on `option.fingerprint`
 *             (POLICY_DIM_KEYS). This is the data the alignment score is computed from, so
 *             this chart is the visual explanation of each option's alignment label.
 *
 * WHY A DASHED REFERENCE LINE ON EACH CHART
 * A radar of options alone tells the participant how the options differ from each other but
 * not where THEY stand. Each chart therefore overlays one dashed reference series:
 *   - Chart 2 overlays the participant's own four value priorities. Because the alignment
 *     rule only penalizes an option for falling BELOW the participant on a value, any option
 *     corner sitting inside the dashed shape is precisely a shortfall the score charges for.
 *     The chart is, literally, a picture of the alignment computation.
 *   - Chart 1 overlays the participant's cumulative performance so far, and only once at
 *     least one scenario is committed (it is a running average that starts at 0, so drawing
 *     it in Scenario 1 would just be a flat zero polygon).
 *
 * READABILITY WITH SIX OVERLAID SERIES
 * Six filled polygons on one radar is unreadable, so the overlay lets the participant toggle
 * options on and off, and the fill/vertex-dot density adapts to how many are visible: solid
 * fills and dots for a focused 1-2 option comparison, near-transparent fills and no dots when
 * everything is shown at once. Meaning is never carried by color alone — every series is
 * also named in the toggle list and in the legend.
 *
 * EXPERIMENT NOTE
 * Opening this panel is recorded in scenario telemetry (`compareChartsOpens`) so the analysis
 * can distinguish participants who consulted the comparison from those who did not.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Box, Button, Grid, HStack, Heading, Icon, Separator, Text, VStack } from "@chakra-ui/react";
import { LuChartSpline, LuX, LuInfo } from "react-icons/lu";
import { RadarChart, ChartLegend, type RadarSeries } from "./block5Charts";
import { Block5MCFPanel } from "./Block5MCFPanel";
import { OPTION_SERIES_COLORS, REFERENCE_SERIES_COLOR } from "./block5ChartColors";
import type { Block5Palette } from "./block5Palette";
import type { LabeledOption } from "./block5CVR";
import {
  METRIC_KEYS, POLICY_DIM_KEYS,
  type Block5MetricKey, type Block5MetricProfile, type Block5PolicyDimKey, type Block5Scenario,
} from "./block5Types";

/**
 * Short axis captions. The full METRIC_LABELS / POLICY_DIM_SHORT strings are written for
 * running prose and are too long for a radar spoke, where they would wrap into three lines
 * and collide with their neighbors. These say the same thing in one or two words.
 */
const METRIC_AXIS_LABEL: Record<Block5MetricKey, string> = {
  speed: "Speed",
  resourceUse: "Resources spared",
  reliability: "Reliability",
  durability: "Durability",
  reversibility: "Reversibility",
};

const POLICY_AXIS_LABEL: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "Protect the vulnerable",
  groupSizeSensitivity: "Reducing harm",
  gainResponsivenessSensitivity: "How much gained",
  outcomeAggregationSensitivity: "How many helped",
};

/** Plain-English one-liner under each chart title. */
const CHART_HELP = {
  performance:
    "What each option actually achieves. Five measures of how well a plan performs — the further a corner reaches from the middle, the better that option does on that measure. These describe the outcome, not who it favors; that is the second chart.",
  policy:
    "What each option is built to prioritize. These are the same four values your own answers were scored on, so wherever an option's corner falls inside your dashed shape, that is something you said mattered and this option gives up.",
} as const;

interface Props {
  scenario: Block5Scenario;
  /** All six options, already carrying their alignment label and rank. */
  options: LabeledOption[];
  /** The participant's current four policy scores, for the dashed reference shape. */
  yourPolicyScores: Record<Block5PolicyDimKey, number>;
  /** Running average performance across committed scenarios (starts at 0). */
  cumulative: Block5MetricProfile;
  /** How many scenarios are already committed — gates the performance reference line. */
  completedCount: number;
  pal: Block5Palette;
  onClose: () => void;
}

export function Block5OptionCompare({
  scenario, options, yourPolicyScores, cumulative, completedCount, pal, onClose,
}: Props) {
  // Every option is visible on first open, so the participant sees the whole field at once
  // and narrows down from there rather than having to build the comparison up themselves.
  const [visibleOptionIds, setVisibleOptionIds] = useState<Set<string>>(
    () => new Set(options.map((o) => o.id)),
  );

  // Escape closes, matching the app's other overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /*
    FREEZE THE PAGE BEHIND THIS OVERLAY.

    The panel scrolls on its own, but the scenario page underneath keeps its own scrollbar — a few
    thousand pixels of it. Reaching the top or the bottom of the panel hands the rest of the wheel
    gesture to that page, so it creeps up and down behind the charts and the participant returns to
    a scenario scrolled somewhere they did not put it.

    Locking the root removes the thing being scrolled. `overscroll-behavior: contain` on the panel
    is the matching half: it stops the chain at the panel's own edges, including on touch, where a
    locked root alone is not always enough.
  */
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = prev; };
  }, []);

  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    const palette = OPTION_SERIES_COLORS[pal.mode];
    options.forEach((o, i) => { map[o.id] = palette[i % palette.length]; });
    return map;
  }, [options, pal.mode]);

  const shown = options.filter((o) => visibleOptionIds.has(o.id));
  const referenceColor = REFERENCE_SERIES_COLOR[pal.mode];

  // Dense overlays need lighter fills and no vertex dots, or the shapes stop being separable.
  const fillOpacity = shown.length <= 2 ? 0.16 : shown.length <= 4 ? 0.09 : 0.05;
  const showDots = shown.length <= 3;

  const performanceSeries: RadarSeries[] = [
    // `metrics` is optional on the option type. Every shipped option defines all eight (the
    // structural validation suite enforces it), but an option authored later without them
    // must not crash the overlay — it simply contributes a flat zero shape.
    ...shown.map((o) => ({
      name: o.title,
      color: colorOf[o.id],
      values: METRIC_KEYS.map((k) => o.metrics?.[k] ?? 0),
    })),
    ...(completedCount > 0
      ? [{
          name: "Your performance so far",
          color: referenceColor,
          values: METRIC_KEYS.map((k) => cumulative[k]),
          dashed: true,
        }]
      : []),
  ];

  const policySeries: RadarSeries[] = [
    ...shown.map((o) => ({
      name: o.title,
      color: colorOf[o.id],
      values: POLICY_DIM_KEYS.map((k) => o.fingerprint[k]),
    })),
    {
      name: "Your value priorities",
      color: referenceColor,
      values: POLICY_DIM_KEYS.map((k) => yourPolicyScores[k]),
      dashed: true,
    },
  ];

  const toggle = (id: string) => {
    setVisibleOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allShown = shown.length === options.length;

  return (
    <Box position="fixed" inset="0" bg="blackAlpha.700" backdropFilter="blur(4px)" zIndex="60"
      display="flex" alignItems="center" justifyContent="center" p={{ base: "2", md: "4" }}
      onClick={onClose}>
      <Box bg={pal.cardBg} borderWidth="1px" borderColor={pal.cardBorder} rounded="2xl"
        maxW="6xl" w="full" maxH="94dvh" overflowY="auto" overscrollBehavior="contain"
        style={{ boxShadow: pal.sidebarShadow }}
        onClick={(e) => e.stopPropagation()}>

        {/* ---------------- Header ---------------- */}
        <Box px={{ base: "5", md: "7" }} pt={{ base: "5", md: "6" }} pb="4"
          borderBottomWidth="1px" borderColor={pal.separator}>
          <HStack justify="space-between" align="start" gap="4">
            <Box>
              <HStack gap="2" mb="1">
                <Icon color={pal.accent} boxSize="4"><LuChartSpline /></Icon>
                <Text fontSize="2xs" fontWeight="bold" color={pal.accent}
                  textTransform="uppercase" letterSpacing="widest">
                  Compare the options
                </Text>
              </HStack>
              <Heading size="md" color={pal.text}>{scenario.title}</Heading>
              <Text fontSize="sm" color={pal.textMuted} mt="1" lineHeight="tall">
                All {options.length} options on the same two charts — what each one achieves, and
                what each one prioritizes. Nothing here is a recommendation; every option stays
                available to you.
              </Text>
            </Box>
            <Button aria-label="Close comparison" size="sm" variant="ghost" rounded="full"
              color={pal.textMuted} _hover={{ bg: pal.surfaceSubtle, color: pal.text }}
              onClick={onClose} flexShrink="0">
              <Icon boxSize="4"><LuX /></Icon>
            </Button>
          </HStack>
        </Box>

        {/* ---------------- Option toggles ---------------- */}
        <Box px={{ base: "5", md: "7" }} py="4" bg={pal.surfaceSubtle}
          borderBottomWidth="1px" borderColor={pal.separator}>
          <HStack justify="space-between" mb="2.5" gap="3" flexWrap="wrap">
            <Text fontSize="2xs" fontWeight="bold" color={pal.textMuted}
              textTransform="uppercase" letterSpacing="wider">
              Tap an option to show or hide it on both charts
            </Text>
            <Button size="2xs" variant="ghost" rounded="md" fontSize="2xs" color={pal.accent}
              _hover={{ bg: pal.cardBg }}
              onClick={() => setVisibleOptionIds(
                allShown ? new Set() : new Set(options.map((o) => o.id)),
              )}>
              {allShown ? "Hide all" : "Show all"}
            </Button>
          </HStack>
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }} gap="2">
            {options.map((o) => {
              const on = visibleOptionIds.has(o.id);
              const color = colorOf[o.id];
              // No `type` prop: Chakra v3's Box does not accept the intrinsic button
              // attribute even with as="button", and passing it is a type error. It is safe to
              // omit — `type` only matters inside a <form>, and this overlay has none.
              return (
                <Box key={o.id} as="button" onClick={() => toggle(o.id)}
                  textAlign="left" cursor="pointer"
                  bg={on ? pal.cardBg : "transparent"}
                  borderWidth="1px" borderColor={on ? color : pal.cardBorder}
                  opacity={on ? 1 : 0.55} rounded="lg" px="3" py="2.5"
                  transition="all 0.15s" _hover={{ opacity: 1, borderColor: color }}>
                  <HStack gap="2.5" align="start">
                    <Box mt="1" flexShrink="0" w="3" h="3" rounded="sm"
                      bg={on ? color : "transparent"}
                      borderWidth={on ? "0" : "2px"} borderColor={color} />
                    {/*
                      NO ALIGNMENT VERDICT HERE. A badge reading "Aligned" or "Strongly misaligned"
                      used to sit under each title in this list.

                      It was the last place in a live scenario where a participant was told how an
                      option scored against their own values, and it undid what the option cards
                      are careful about. VCI asks whether someone's choices match what they said
                      mattered, so printing the answer on the option turns that into a
                      reading-comprehension test: anyone who wants to look consistent only has to
                      pick the badge.

                      Nothing is lost. The chart on the right IS the verdict, drawn rather than
                      pronounced - the dashed shape is the participant, and any corner sitting
                      inside it is exactly a shortfall. Someone who wants to know where an option
                      stands can still see it, without being handed a word for it.
                    */}
                    <Box flex="1" minW="0">
                      <Text fontSize="xs" fontWeight="medium" color={pal.text} lineHeight="short" lineClamp={3}>
                        {o.title}
                      </Text>
                    </Box>
                  </HStack>
                </Box>
              );
            })}
          </Grid>
        </Box>

        {/* ---------------- The two radar charts ---------------- */}
        <Box px={{ base: "4", md: "7" }} py={{ base: "5", md: "6" }}>
          {shown.length === 0 ? (
            <Box textAlign="center" py="12">
              <Text fontSize="sm" color={pal.textMuted}>
                No options selected. Tap an option above to draw it on the charts.
              </Text>
            </Box>
          ) : (
            <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={{ base: "5", lg: "6" }}>
              <ChartCard
                pal={pal}
                title="Performance impact"
                help={CHART_HELP.performance}
                axes={METRIC_KEYS.map((k) => METRIC_AXIS_LABEL[k])}
                series={performanceSeries}
                fillOpacity={fillOpacity}
                showDots={showDots}
              />
              <ChartCard
                pal={pal}
                title="The four value priorities"
                help={CHART_HELP.policy}
                axes={POLICY_DIM_KEYS.map((k) => POLICY_AXIS_LABEL[k])}
                series={policySeries}
                fillOpacity={fillOpacity}
                showDots={showDots}
              />
            </Grid>
          )}

          {/*
            ---------------- The same chart, in words ----------------

            THE MORAL COMMITMENT FUNCTION. The values chart above says, in shape, what each option
            gives and what it asks of this participant; the caption under it already says that a
            corner inside their dashed shape is something they said mattered and the option gives
            up. This panel says the same thing in sentences, so the disclosure does not depend on
            being able to read a radar.

            IT SITS UNDER THE CHART IT EXPLAINS, and only here. On an option card it would become
            something a participant is told while choosing rather than something they opened.
          */}
          <Box mt="6">
            <Block5MCFPanel
              scenario={scenario}
              yourPolicyScores={yourPolicyScores}
              pal={pal}
            />
          </Box>

          {/* ---------------- How to read this ---------------- */}
          <Box mt="6" bg={pal.panelDeep} borderWidth="1px" borderColor={pal.cardBorder}
            borderLeftWidth="4px" borderLeftColor={pal.accent} rounded="lg" px="4" py="3.5">
            <HStack gap="2" mb="1.5">
              <Icon color={pal.accent} boxSize="4"><LuInfo /></Icon>
              <Text fontSize="2xs" fontWeight="bold" color={pal.textMuted}
                textTransform="uppercase" letterSpacing="wider">
                How to read these charts
              </Text>
            </HStack>
            {/*
              THE EMPHASIS CARRIES MEANING. IT IS NOT DECORATION.

              Three colors, each one already in use elsewhere and meaning the same thing here.
              Green is what an option DOES WELL and red is what it GIVES UP - the two colors of
              the trade-off panel on every option card, and of the ticks on the metric bars. The
              gray is not a third invention at all: it is the literal color of the dashed shape
              the sentence is describing, so the word and the line on the chart match.

              Everything else that is emphasized is bold and in full-contrast text rather than the
              muted body, so a participant skimming three sentences still lands on the load-bearing
              words: what a shape is, where 0 and 100 are, and that the dashed one is them.

              THE SCENARIO ACCENT IS DELIBERATELY NOT USED. It is a different hue in each scenario,
              so the same sentence would emphasize in six different colors, and in scenario 6 it is
              a dark navy that would sit nearly invisible on this panel.
            */}
            <VStack align="stretch" gap="2">
              <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
                Each colored shape is <Key pal={pal}>one option</Key>. Every corner is one measure,
                scored <Key pal={pal}>0 at the center</Key> and{" "}
                <Key pal={pal}>100 at the outer ring</Key>. The further a corner stretches out, the
                higher that option scores on that measure.
              </Text>
              <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
                No option reaches the outer ring everywhere — a shape that bulges on one side is{" "}
                <Key pal={pal} color={pal.gainColor}>strong there</Key> and{" "}
                <Key pal={pal} color={pal.costColor}>weaker on the opposite side</Key>. That is the{" "}
                <Key pal={pal}>trade-off you are being asked to make</Key>.
              </Text>
              <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
                The{" "}
                <Key pal={pal} color={REFERENCE_SERIES_COLOR[pal.mode]}>dashed gray shape</Key>{" "}
                on the right-hand chart is <Key pal={pal}>you</Key> — your own four value
                priorities. Wherever an option's corner falls short of your dashed line, that
                option{" "}
                <Key pal={pal} color={pal.costColor}>gives up something you said mattered</Key>.
              </Text>
            </VStack>
          </Box>
        </Box>

        {/* ---------------- Footer ---------------- */}
        <Box px={{ base: "5", md: "7" }} py="4" borderTopWidth="1px" borderColor={pal.separator}
          position="sticky" bottom="0" bg={pal.cardBg}>
          <HStack justify="space-between" gap="3" flexWrap="wrap">
            <Text fontSize="2xs" color={pal.textFaint}>
              Close this to go back to the options — your choice is still open.
            </Text>
            <Button size="sm" bg={pal.accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg"
              fontSize="xs" fontWeight="semibold" onClick={onClose}>
              Back to the options
            </Button>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * A load-bearing phrase inside the closing note.
 *
 * BOLD AND a color change, never color alone: the bold survives a color-blind reader, a
 * grayscale print and a screenshot in a paper, which leaves the color free to ADD the meaning
 * rather than to carry it.
 */
function Key({ children, color, pal }: { children: ReactNode; color?: string; pal: Block5Palette }) {
  return <Text as="span" fontWeight="bold" color={color ?? pal.text}>{children}</Text>;
}

/** One titled radar panel with its plain-English caption and a named legend. */
function ChartCard({ pal, title, help, axes, series, fillOpacity, showDots }: {
  pal: Block5Palette;
  title: string;
  help: string;
  axes: string[];
  series: RadarSeries[];
  fillOpacity: number;
  showDots: boolean;
}) {
  // The overlay paints its own surfaces from the scenario palette rather than from the global
  // Chakra tokens, so the radar axes are given that palette's text color explicitly.
  return (
    <Box bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder} rounded="xl"
      px={{ base: "3", md: "4" }} py="4">
      <Text fontSize="sm" fontWeight="bold" color={pal.text} mb="1">{title}</Text>
      <Text fontSize="2xs" color={pal.textMuted} lineHeight="tall" mb="3">{help}</Text>
      <Separator borderColor={pal.separator} mb="3" />
      <RadarChart axes={axes} series={series} fillOpacity={fillOpacity} showDots={showDots}
        axisColor={pal.text} />
      <Box mt="3" pt="3" borderTopWidth="1px" borderColor={pal.separator}>
        <ChartLegend items={series.map((s) => ({ label: s.name, color: s.color, dashed: s.dashed }))} />
      </Box>
    </Box>
  );
}
