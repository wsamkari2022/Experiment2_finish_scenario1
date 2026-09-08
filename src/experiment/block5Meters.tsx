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
import { ordinal } from "./block5Performance";

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
  /**
   * The two ticks on a performance bar: the WORST and the BEST any option in this scenario
   * reaches on that metric.
   *
   * Red and green here are not a verdict on the option — they name the TWO ENDS OF THE TABLE, and
   * the legend says so in those words. That is safe where colouring the bar itself would not be
   * (see the note on MetricStandingBar): "worst available" and "best available" are facts about
   * the menu, not opinions about what this participant should want.
   *
   * COLOUR IS NEVER THE ONLY CUE. The red tick is always to the left of the green one, both are
   * named in the legend, and both carry a hover title. A participant who cannot tell red from
   * green loses nothing — which matters at roughly 1 man in 12.
   */
  tickWorst: string;
  tickBest: string;
  /**
   * The fill for the PERFORMANCE bars, and deliberately not the scenario accent.
   *
   * The value bars above them are drawn in the scenario's own accent, which runs olive, orange,
   * red, green and blue across the five scenarios. Drawing performance in that same accent made
   * two different constructs the same colour on the same card, and a participant reading quickly
   * has no way to tell "how well this fits your values" from "how well this option works".
   *
   * It is a DESATURATED steel rather than another hue on purpose. Any saturated colour picked here
   * would collide with at least one of the five accents; low saturation cannot, whatever the
   * scenario. It also reads correctly: the values are the participant's own and are coloured,
   * while performance is the instrument's reading and is neutral.
   */
  metricFill: string;
  /** 1px ring round each tick so it stays visible where it crosses the coloured fill */
  tickHalo: string;
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
        tickWorst: "#dc2626",   // red-600
        tickBest: "#16a34a",    // green-600
        tickHalo: "#ffffff",
        metricFill: "#334155",  // slate-700 - firm against both the pale track and the range band
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
        tickWorst: "#fb7185",   // rose-400; red-600 is too dark to read on the dark card
        tickBest: "#4ade80",    // green-400
        tickHalo: "rgba(0,0,0,0.55)",
        metricFill: "#cbd5e1",  // slate-300 - slate-400 sits too close to the range band here
        gapOpacity: 0.32,
      };
}

interface SensitivityMeterBarProps {
  label: string;
  optionScore: number;
  userScore: number;
  accentColor: string;
  mode: Block5Palette["mode"];
  /**
   * "Higher means MORE harm is prevented" — which way to read this bar.
   *
   * One of the four values used to be named after a bad thing ("how many are harmed"), and a long bar on
   * one of those reads as "this option harms a lot of people" unless it is spelled out. It is the
   * opposite. A participant who misreads the direction on one bar misreads the whole panel.
   */
  higherMeans?: string;
}

export function SensitivityMeterBar({ label, optionScore, userScore, accentColor, mode, higherMeans }: SensitivityMeterBarProps) {
  // The label tracks the picture exactly: the bar must REACH the marker line to count
  // as "meeting" your priority. Falling even slightly short reads "Below your priority
  // by X" (and shows the red gap), so the words always match what the bar shows.
  /* Both scores can arrive as floats — the participant's line is a weighted blend, so it lands on
     values like 67.19999999999999. Rounded once, here, so the number the participant reads, the
     number in the status line and the position of the marker can never disagree with each other. */
  const opt = Math.round(optionScore * 10) / 10;
  const line = Math.round(userScore * 10) / 10;
  const shortfall = Math.round(Math.max(0, line - opt) * 10) / 10;
  const below = opt < line;      // bar does not reach the line
  const exceeds = opt > line;    // bar passes the line

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
          <Text fontSize="xs" color={c.optionScore}>Option: {opt}</Text>
          <Text fontSize="xs" color={c.userScore} fontWeight="semibold">Your line: {line}</Text>
        </HStack>
      </HStack>

      <Box position="relative" h="3.5" bg={c.track} rounded="full" overflow="visible">
        {/* Option fill (how much the option delivers this value) */}
        <Box
          position="absolute" top="0" left="0" h="full" rounded="full" bg={fillColor} opacity={0.85}
          style={{ width: `${Math.max(2, opt)}%` }} transition="width 0.4s ease"
        />
        {/* Shortfall gap: from the bar's end up to the user's line (only when below) */}
        {below && (
          <Box
            position="absolute" top="0" h="full" bg="red.500" opacity={c.gapOpacity}
            style={{ left: `${opt}%`, width: `${shortfall}%` }}
            title={`Shortfall: ${shortfall} below your line`}
          />
        )}
        {/* The participant's priority line (threshold) */}
        <Box
          position="absolute" top="-3px" h="calc(100% + 6px)" w="2px" bg={c.marker} rounded="full" shadow="sm"
          style={{ left: `${line}%` }} title={`Your priority line: ${line}`}
        />
      </Box>

      <Text fontSize="2xs" color={statusColor} fontStyle="italic" fontWeight="medium">{status}</Text>
      {higherMeans && (
        <Text fontSize="2xs" color={c.legend} lineHeight="tall">{higherMeans}</Text>
      )}
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

/**
 * MetricStandingBar — one performance metric, shown against WHAT THIS SCENARIO OFFERED.
 *
 * WHY THIS IS NOT JUST A NUMBER
 * -----------------------------
 * `block5Types.ts` states the authoring rule plainly: metric scores are RELATIVE TO THE SITUATION,
 * not absolute. "Speed 90" in the cancer scenario does not claim treatment is as fast as a flight;
 * it claims this option starts treatment about as soon as anything could there. That rule has
 * always been documented and never been visible — a bare "89" on a card invites the participant to
 * read it as a percentage of something absolute, which is precisely what it is not.
 *
 * So the bar draws the RANGE THE SIX OPTIONS ACTUALLY SPAN as a shaded band, with ticks at the
 * worst and the best on the table, and puts this option inside it. The sentence underneath says
 * where it sits in words. A participant can then see that 89 means "near the top of what is
 * possible here", which is the only thing it ever meant.
 *
 * IT MIRRORS SensitivityMeterBar ON PURPOSE. The value bars show "your line" against "what this
 * option delivers"; these show "what was available" against the same thing. Same visual grammar,
 * two different constructs, so the participant reads them the same way without being taught twice.
 *
 * THE BAR IS DELIBERATELY NOT COLOUR-CODED GOOD/BAD. The value bars turn orange on a shortfall
 * because falling below a threshold the participant themselves set IS a shortfall. A performance
 * metric has no such threshold — nothing in Blocks 1-4 says how much speed is worth to this
 * person — so colouring the FILL would be the system expressing a preference it has no basis for,
 * on exactly the trade-off the study exists to watch the participant make. It stays neutral.
 *
 * THE TWO TICKS ARE COLOURED, AND THAT IS A DIFFERENT CLAIM. Red marks the weakest and green the
 * strongest score any option on this table reaches. Those are facts about the MENU — who is at
 * each end of it — not a verdict on the option in front of the participant, and the legend names
 * them in exactly those words. Without them the ticks were two identical grey lines and the
 * participant had no way to tell which end was which.
 */
export function MetricStandingBar({
  label, reading, score, worst, best, rank, total, mode,
}: {
  label: string;
  /** what this metric means in THIS scenario (METRIC_DEFS.readings) */
  reading: string;
  score: number;
  worst: number;
  best: number;
  rank: number;
  total: number;
  mode: Block5Palette["mode"];
}) {
  const c = meterColors(mode);
  const lo = Math.min(worst, best);
  const hi = Math.max(worst, best);

  /*
   * THE WORDS COME FROM THE RANK, NOT FROM `captured`.
   *
   * Rank ("4 of 6") and captured position ("13% of the way from worst to best") are both true and
   * they are NOT the same thing: an option can be 4th and still sit near the bottom if the three
   * above it are bunched at the top. Across the real option set the two disagree on 9% of the 150
   * metric readings, which produced cards saying "5 of 6 here" beside "above the middle" — a
   * participant reads that as a bug, and stops trusting the panel.
   *
   * So the sentence is derived from the same quantity as the number printed beside it, and the BAR
   * carries the magnitude. Words and number can never contradict; the bar adds what neither says.
   */
  const where =
    rank === 1 ? "the strongest option here"
    : rank === total ? "the weakest option here"
    : rank <= Math.ceil(total / 3) ? "among the stronger options here"
    : rank <= Math.ceil((2 * total) / 3) ? "middle of the options here"
    : "among the weaker options here";

  return (
    <VStack align="stretch" gap="1" w="full">
      <HStack justify="space-between" align="baseline">
        <Text fontSize="xs" color={c.label} fontWeight="medium">{label}</Text>
        <HStack gap="3">
          <Text fontSize="2xs" color={c.optionScore}
            title={`${ordinal(rank)} strongest of the ${total} options in this scenario on this measure`}>
            {ordinal(rank)} of {total}
          </Text>
          <Text fontSize="xs" color={c.userScore} fontWeight="semibold" fontFamily="mono">{Math.round(score)}</Text>
        </HStack>
      </HStack>

      <Box position="relative" h="3" bg={c.track} rounded="full" overflow="visible">
        {/* the band the six options actually span — "what this scenario put on the table" */}
        <Box position="absolute" top="0" h="full" rounded="full" bg={c.marker} opacity={0.14}
          style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%` }} />
        {/* this option */}
        <Box position="absolute" top="0" left="0" h="full" rounded="full" bg={c.metricFill} opacity={0.92}
          style={{ width: `${Math.max(2, score)}%` }} transition="width 0.4s ease" />
        {/*
          The two ends of the table. Red = the weakest of the six on this measure, green = the
          strongest, and the legend says so in those words.

          The halo ring matters: both ticks cross the coloured fill for some options, and a red
          line on an orange bar is close to invisible without it. `pointerEvents` stays on so the
          hover title still works, and the tick is nudged left by half its width so it sits ON the
          value rather than starting at it.
        */}
        {[lo, hi].map((v, i) => (
          <Box key={i} position="absolute" top="-3px" h="calc(100% + 6px)" w="3px" rounded="full"
            bg={i === 0 ? c.tickWorst : c.tickBest}
            boxShadow={`0 0 0 1px ${c.tickHalo}`}
            style={{ left: `${v}%`, marginLeft: "-1.5px" }}
            title={i === 0
              ? `Weakest of the ${total} options here on this measure: ${Math.round(lo)}`
              : `Strongest of the ${total} options here on this measure: ${Math.round(hi)}`} />
        ))}
      </Box>

      <Text fontSize="2xs" color={c.legend} lineHeight="tall">
        {where} · {reading}
      </Text>
    </VStack>
  );
}

/**
 * Legend for the metric bars — says once what the band, the two ticks and the placings mean.
 *
 * The placing line is here rather than only in the intro paragraph because it is the piece a
 * participant is most likely to get backwards, and it is the one they will look back for.
 */
export function MetricStandingLegend({ mode, total }: { mode: Block5Palette["mode"]; total: number }) {
  const c = meterColors(mode);
  return (
    <VStack align="stretch" gap="1.5" py="1">
      <HStack gap="4" wrap="wrap">
        <HStack gap="1.5">
          {/*
            The swatch has to be built the way the bar is — the band painted ON the track — or it
            comes out a different colour from the thing it is labelling. On the light card the
            band alone over white is visibly paler than the same band over slate-200, which is
            exactly the sort of small mismatch that makes a legend useless.
          */}
          <Box w="6" h="2" rounded="sm" bg={c.track} position="relative" overflow="hidden">
            <Box position="absolute" inset="0" bg={c.marker} opacity={0.14} />
          </Box>
          <Text fontSize="2xs" color={c.legend}>The range these {total} options actually cover</Text>
        </HStack>
        <HStack gap="1.5">
          <Box w="3px" h="3" bg={c.tickWorst} rounded="full" boxShadow={`0 0 0 1px ${c.tickHalo}`} />
          <Text fontSize="2xs" color={c.legend}>Weakest of the {total} here</Text>
        </HStack>
        <HStack gap="1.5">
          <Box w="3px" h="3" bg={c.tickBest} rounded="full" boxShadow={`0 0 0 1px ${c.tickHalo}`} />
          <Text fontSize="2xs" color={c.legend}>Strongest of the {total} here</Text>
        </HStack>
      </HStack>
      <HStack gap="1.5">
        <Box w="6" h="2" rounded="sm" bg={c.metricFill} />
        <Text fontSize="2xs" color={c.legend}>This option, on that measure</Text>
      </HStack>
      <Text fontSize="2xs" color={c.legend} lineHeight="tall">
        Places read like a race result: <b>1st of {total}</b> is the strongest of these {total} options on that
        measure, <b>{ordinal(total)} of {total}</b> is the weakest. They compare this option with the other{" "}
        {total - 1} in front of you — never with any other scenario.
      </Text>
    </VStack>
  );
}
