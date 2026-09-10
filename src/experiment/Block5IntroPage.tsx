/**
 * Block5IntroPage.tsx — the doorway into the main study.
 *
 * WHY THIS PAGE EXISTS
 * Blocks 1-4 ask short questions and move on quickly. Block 5 does something different: it puts
 * six full options in front of the participant, each with its own values, its own performance
 * readings, and consequences that carry into the scenarios that follow. Dropping someone into
 * that with no warning produces two bad behaviors we want to avoid:
 *
 *   1. Performance anxiety — treating it as a test with a correct answer, and picking what they
 *      think the researcher wants rather than what they want. Every measure in Block 5 (VCI,
 *      stability, performance) is meaningless if the participant is second-guessing us instead
 *      of answering honestly, so the page says plainly that there is no right answer.
 *   2. Missing the instruments — the comparison bars and the radar chart are the whole reason
 *      the block can measure a considered choice rather than a first impression. A participant
 *      who never notices them chooses on the summary text alone.
 *
 * So the page does three jobs, in this order: remove the pressure, show what the tools look like,
 * and name the four values already measured about them.
 *
 * THE MINIATURES ARE REAL COMPONENTS, NOT PICTURES
 * The radar and the bars below are the same RadarChart and HBarChart the scenario pages use, fed
 * with a worked example. A screenshot would drift the moment either chart changed; this cannot.
 * The axis and bar labels are read from POLICY_DIM_SHORT and METRIC_DEFS for the same reason —
 * rename a value and this page renames itself.
 *
 * The purple accent and the flag are deliberate: they are what GlobalStepper has been showing at
 * the end of the rail as "Main study" for the whole session. Arriving at a page in the same
 * color, with the same icon, is the visual full-stop for that promise.
 */

import { Badge, Box, Button, Grid, HStack, Heading, Icon, Stack, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight, LuChartColumn, LuFlag, LuEye, LuMilestone, LuRoute, LuGauge, LuLayers, LuInfo } from "react-icons/lu";

import { HBarChart, RadarChart } from "./block5Charts";
import { SERIES_COLORS } from "./block5ChartColors";
import { MetricStandingBar } from "./block5Meters";
import { useColorMode } from "@/components/ui/color-mode";
import {
  METRIC_DEFS,
  METRIC_KEYS,
  POLICY_DIM_EXPLAIN,
  POLICY_DIM_HIGHER_MEANS,
  POLICY_DIM_KEYS,
  POLICY_DIM_SHORT,
  type Block5MetricKey,
} from "./block5Types";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";

/**
 * How many situations the participant is about to face, spelled out.
 *
 * Read from the deck rather than written into the sentence. This page promises the participant a
 * number, and the scenario list is edited far more often than this paragraph is re-read — a
 * promise of "five situations" in front of a three-scenario block is the first thing that would
 * make a participant distrust everything else on the page.
 */
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const scenarioCountWord = (n: number): string => COUNT_WORDS[n] ?? String(n);

/**
 * The worked example drawn in the miniatures.
 *
 * These are illustrative numbers, not any real option, and they are never scored or stored. They
 * are shaped to make the point the page is making: the two shapes differ, so the charts are worth
 * looking at. "This option" protects strongly and reaches few people; "another option" is its
 * mirror. If they matched, the illustration would argue the opposite of what the text says.
 */
const EXAMPLE_VALUES = [88, 34, 62, 30];
const EXAMPLE_ALTERNATIVE = [36, 84, 45, 78];
const EXAMPLE_METRICS = [42, 78, 65, 88, 30];
/* A second, deliberately different shape, so the pair demonstrates what comparing two
   options on one chart actually looks like rather than one shape on its own. */
const EXAMPLE_METRICS_ALT = [80, 38, 72, 45, 66];

/**
 * The running gauge in the left-hand miniature. These five average to exactly 62, which is the
 * figure printed on the badge beside them — an illustration that does not add up is worse than
 * no illustration, because the participant is being taught how to read the real one.
 */
const EXAMPLE_RUNNING = [58, 64, 71, 55, 62];

/**
 * The two bars in the right-hand miniature, chosen to make the contrast the panel exists to teach.
 *
 * Speed is 1st of 6 AND at the top of the range. Reliability is 5th of 6 while sitting barely
 * above the weakest reading on the table — so a participant sees at once that the place and the
 * bar say different, complementary things, and that neither is "your score".
 */
const SAMPLE_STANDINGS: { key: Block5MetricKey; score: number; worst: number; best: number; rank: number }[] = [
  { key: "speed", score: 89, worst: 30, best: 89, rank: 1 },
  { key: "durability", score: 70, worst: 45, best: 78, rank: 3 },
  { key: "reliability", score: 54, worst: 52, best: 86, rank: 5 },
];

/**
 * METRIC_DEFS.hover is written as a standalone sentence ("How soon the help…"), but on an option
 * card the meaning is a clause following a middot ("the strongest option here · how soon…"). The
 * miniature has to match the thing it is teaching, so the sentence is folded back into a clause.
 * Derived rather than retyped, so renaming a metric still renames this page.
 */
const asClause = (s: string) =>
  (s.charAt(0).toLowerCase() + s.slice(1)).replace(/\.$/, "");

/** Sentence-case for the radar spokes; POLICY_DIM_SHORT is stored lower-case for mid-sentence use. */
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * THE FIVE STEPS, written as what the participant will DO rather than as what the study does.
 *
 * Every line here is checkable against the block: five scenarios in a fixed order, six options
 * each, all six selectable, ordered by the participant's own earlier answers (block5Planner), a
 * reflection stage after the choice, and a real chance to keep or change it. Nothing is promised
 * that the block does not deliver, and nothing is said about what is being measured — a
 * participant who is told "we are checking whether you stay consistent" will stay consistent.
 */
const HOW_IT_WORKS = [
  {
    title: "Read the situation",
    body: "What has happened, the numbers everyone is working from, and who you are in it. Your position changes from one situation to the next.",
  },
  {
    title: "Look at six options",
    body: "Every one of the six can be chosen. They are put in order using your own earlier answers, not by which one we think is best.",
  },
  {
    title: "Choose one",
    body: "The one you would really choose if you were standing there. Take as long as you need.",
  },
  {
    title: "See it from another side",
    body: "After you choose, you will see what your choice means for the people it touches, and one of them will speak to you about it.",
  },
  {
    title: "Keep it or change it",
    body: "Both are fine. Neither is the right answer. Then the next situation begins.",
  },
];

/** One numbered step in "How the main study works". */
function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <VStack
      align="start" gap="2.5" h="full" position="relative" overflow="hidden"
      bg="bg.panel" borderWidth="1px" borderColor="border" rounded="xl"
      px={{ base: "4", md: "4" }} py={{ base: "4", md: "5" }}
    >
      {/* The watermark carries the sequence at a glance; the chip carries it for a screen reader. */}
      <Text
        aria-hidden="true" position="absolute" top="-2" right="1"
        fontSize="6xl" fontWeight="bold" color="purple.fg" opacity={0.1} lineHeight="1"
      >
        {n}
      </Text>
      <Box
        boxSize="7" rounded="lg" bg="purple.solid" color="white"
        display="flex" alignItems="center" justifyContent="center"
        fontSize="xs" fontWeight="bold" flexShrink={0}
      >
        {n}
      </Box>
      <Text fontSize="sm" fontWeight="semibold" color="fg" lineHeight="short">{title}</Text>
      <Text fontSize="xs" color="fg.muted" lineHeight="tall">{body}</Text>
    </VStack>
  );
}

/** One side of the two-readings comparison: a heading, a live miniature, and the facts about it. */
function ReadingColumn({
  n, where, title, icon, sample, facts,
}: {
  n: number;
  where: string;
  title: string;
  icon: React.ReactNode;
  sample: React.ReactNode;
  facts: { label: string; value: string }[];
}) {
  return (
    <VStack align="stretch" gap="3.5" h="full">
      <HStack gap="2.5" align="center">
        <Box
          boxSize="7" rounded="lg" bg="purple.solid" color="white" flexShrink={0}
          display="flex" alignItems="center" justifyContent="center" fontSize="xs" fontWeight="bold"
        >
          {n}
        </Box>
        <VStack align="start" gap="0" minW="0">
          <Text fontSize="2xs" fontWeight="bold" color="purple.fg" textTransform="uppercase" letterSpacing="wider">
            {where}
          </Text>
          <HStack gap="1.5">
            <Box color="fg.muted" lineHeight="1"><Icon boxSize="3.5">{icon}</Icon></Box>
            <Text fontSize="sm" fontWeight="semibold" color="fg">{title}</Text>
          </HStack>
        </VStack>
      </HStack>

      {/*
        A LIVE MINIATURE, not a screenshot — the same rule the radar and bar charts on this page
        already follow. The right-hand sample is literally MetricStandingBar, so the red and green
        ticks a participant is about to meet on an option card are the ones drawn here.
      */}
      <Box bg="bg" borderWidth="1px" borderColor="border" rounded="lg" px="3.5" py="3.5" flex="1">
        {sample}
      </Box>

      <VStack align="stretch" gap="2">
        {facts.map((f) => (
          <Box key={f.label}>
            <Text fontSize="2xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
              {f.label}
            </Text>
            <Text fontSize="xs" color="fg.muted" lineHeight="tall">{f.value}</Text>
          </Box>
        ))}
      </VStack>
    </VStack>
  );
}

/** One of the three "what you can do" cards. */
function ToolCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <VStack
      align="start"
      gap="2.5"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      rounded="xl"
      p={{ base: "4", md: "5" }}
      h="full"
    >
      <HStack gap="2.5">
        <Box color="purple.fg" fontSize="lg" lineHeight="1">
          <Icon>{icon}</Icon>
        </Box>
        <Text fontWeight="semibold" fontSize="sm" color="fg">
          {title}
        </Text>
      </HStack>
      <Text fontSize="sm" color="fg.muted" lineHeight="tall">
        {body}
      </Text>
    </VStack>
  );
}

/** One of the four value chips, with its plain-English meaning underneath. */
/**
 * One of the four values, with what it means AND which way its bar runs.
 *
 * The direction line is not decoration. Two of the four are named for bad things — "reducing
 * harm", "protecting the vulnerable" — and every fingerprint in the study is drawn HIGHER =
 * BETTER. A participant who reads one long bar as "this option harms a lot of people" has the
 * direction inverted for the whole panel, and will choose against their own values believing they
 * are following them. Saying it here, once, before any option is on screen, is the cheapest place
 * to prevent that.
 */
function ValueChip({ name, meaning, higher }: { name: string; meaning: string; higher: string }) {
  return (
    <VStack
      align="start"
      gap="1"
      bg="bg"
      borderWidth="1px"
      borderColor="border"
      rounded="lg"
      px="3.5"
      py="3"
      h="full"
    >
      <Text fontSize="sm" fontWeight="semibold" color="fg">
        {sentenceCase(name)}
      </Text>
      <Text fontSize="xs" color="fg.muted" lineHeight="tall">
        {meaning}
      </Text>
      <Text fontSize="xs" color="teal.fg" fontWeight="medium" lineHeight="tall" mt="0.5">
        {higher}
      </Text>
    </VStack>
  );
}

export function Block5IntroPage({ onStart }: { onStart: () => void }) {
  const { colorMode } = useColorMode();
  /* MetricStandingBar resolves its own colors per mode; this page has no Block5Palette. */
  const meterMode = colorMode === "dark" ? "dark" : "light";
  const axes = POLICY_DIM_KEYS.map((k) => sentenceCase(POLICY_DIM_SHORT[k]));
  const runningBars = METRIC_KEYS.map((k, i) => ({
    label: METRIC_DEFS[k].label,
    value: EXAMPLE_RUNNING[i],
    color: SERIES_COLORS[0],
    valueLabel: String(EXAMPLE_RUNNING[i]),
  }));

  return (
    <Box
      minH="100dvh"
      bg="bg"
      px={{ base: "4", md: "6" }}
      py={{ base: "8", md: "12" }}
      display="flex"
      alignItems="flex-start"
      justifyContent="center"
    >
      <VStack
        gap={{ base: "7", md: "9" }}
        align="stretch"
        maxW="4xl"
        w="full"
        animationName="fade-in"
        animationDuration="moderate"
      >
        {/*
          HERO — the same flag, in the same purple, that has sat at the end of the progress bar
          all session. This is the arrival it was pointing at.
        */}
        <VStack gap="4" textAlign="center">
          <Box
            boxSize="14"
            rounded="full"
            bgGradient="to-br"
            gradientFrom="purple.400"
            gradientTo="purple.600"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mx="auto"
            shadow="md"
          >
            <Icon boxSize="6">
              <LuFlag />
            </Icon>
          </Box>
          <VStack gap="2">
            <Text
              fontSize="xs"
              fontWeight="bold"
              color="purple.fg"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              You have arrived
            </Text>
            <Heading size={{ base: "2xl", md: "3xl" }} color="fg" letterSpacing="tight">
              The main study starts now
            </Heading>
          </VStack>
          <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted" lineHeight="tall" maxW="2xl">
            There are no right or wrong choices here. We are not testing you. We are looking for
            the option that <Text as="span" color="fg" fontWeight="semibold">truly reflects you and
            your values</Text> — the one you would really choose if you were standing in that
            situation yourself.
          </Text>
        </VStack>

        {/*
          HOW IT WORKS — the shape of the next few minutes, before any of it starts.

          Blocks 1-4 were one question at a time, so a participant arrives with no model of what a
          Block 5 scenario involves. Without one they cannot pace themselves: the commonest failure
          is treating the first choice as the whole task, then being surprised by the reflection
          stage and reading it as a correction. Saying the reflection is coming, and that changing
          or keeping the choice are equally fine, removes that surprise before it can bias anything.
        */}
        <Box>
          <VStack align="start" gap="1" mb="4">
            <HStack gap="2">
              <Box color="purple.fg" lineHeight="1"><Icon boxSize="4"><LuRoute /></Icon></Box>
              <Text fontSize="xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
                How the main study works
              </Text>
            </HStack>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              {scenarioCountWord(BLOCK5_SCENARIOS.length).replace(/^./, (c) => c.toUpperCase())}{" "}
              situations, one after another. Each one runs the same {HOW_IT_WORKS.length} steps.
            </Text>
          </VStack>
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr", lg: "repeat(5, 1fr)" }} gap="3">
            {HOW_IT_WORKS.map((s, i) => (
              <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} />
            ))}
          </Grid>
        </Box>

        {/*
          THE INSTRUMENTS — shown, not described. A participant who has already seen the shape of
          a radar chart on a calm page recognizes it on a page where a decision is waiting.
        */}
        <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
          <VStack align="start" gap="1" mb="4">
            <Text fontSize="xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
              The two charts, and how to open them
            </Text>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              On every scenario page there is a button marked{" "}
              <Text as="span" color="fg" fontWeight="semibold">“Compare all options on charts”</Text>.
              It draws all six options on these two shapes at once.
            </Text>
          </VStack>

          {/*
            ONE RULE FOR BOTH CHARTS, STATED BEFORE EITHER IS SHOWN.

            Both are drawn HIGHER = BETTER, including the two value spokes named for bad things.
            A participant who reads "reducing harm" reaching far out as "this harms a lot of
            people" has the direction inverted for every option they will see.
          */}
          <Box bg="teal.subtle" borderWidth="1px" borderColor="teal.muted" borderLeftWidth="4px"
            borderLeftColor="teal.solid" rounded="lg" px="4" py="3" mb="5">
            <Text fontSize="sm" color="fg" lineHeight="tall">
              <Text as="span" fontWeight="semibold">How to read both charts:</Text>{" "}
              each corner is one measure. The further a shape reaches toward that corner, the{" "}
              <Text as="span" fontWeight="semibold">better</Text> that option does on it. A wide,
              even shape is strong on everything; a spiky shape is strong on some things and weak
              on others.
            </Text>
          </Box>

          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={{ base: "7", md: "8" }} alignItems="start">
            <VStack gap="2" align="stretch">
              <Text fontSize="sm" fontWeight="semibold" color="fg" textAlign="center">
                The four value priorities
              </Text>
              <Text fontSize="xs" color="fg.muted" textAlign="center" lineHeight="tall" minH={{ md: "10" }}>
                What the option is built to protect. The same four values your earlier answers were
                scored on.
              </Text>
              <RadarChart
                axes={axes}
                series={[
                  { name: "This option", color: SERIES_COLORS[1], values: EXAMPLE_VALUES },
                  { name: "Another option", color: SERIES_COLORS[2], values: EXAMPLE_ALTERNATIVE, dashed: true },
                ]}
              />
            </VStack>

            <VStack gap="2" align="stretch">
              <Text fontSize="sm" fontWeight="semibold" color="fg" textAlign="center">
                Performance impact
              </Text>
              <Text fontSize="xs" color="fg.muted" textAlign="center" lineHeight="tall" minH={{ md: "10" }}>
                What the option actually achieves. This describes the outcome, not who it favors.
              </Text>
              <RadarChart
                axes={METRIC_KEYS.map((k) => METRIC_DEFS[k].label)}
                series={[
                  { name: "This option", color: SERIES_COLORS[1], values: EXAMPLE_METRICS },
                  { name: "Another option", color: SERIES_COLORS[2], values: EXAMPLE_METRICS_ALT, dashed: true },
                ]}
              />
            </VStack>
          </Grid>

          <HStack gap="5" justify="center" mt="4">
            {[
              { name: "This option", color: SERIES_COLORS[1] },
              { name: "Another option", color: SERIES_COLORS[2] },
            ].map((sr) => (
              <HStack key={sr.name} gap="1.5">
                <Box boxSize="2.5" rounded="sm" bg={sr.color} />
                <Text fontSize="2xs" color="fg.muted">{sr.name}</Text>
              </HStack>
            ))}
          </HStack>

          <Text fontSize="xs" color="fg.subtle" mt="3" textAlign="center" lineHeight="tall">
            An example, not a real option. Every option in the study has a shape of its own.
          </Text>
        </Box>

        {/*
          TWO PERFORMANCE READINGS — the one thing on the scenario page that is genuinely easy to
          misread, cleared up before the participant meets either of them.

          The page shows performance in two places that share five names and answer different
          questions: the running gauge at the top is the AVERAGE OF THE OPTIONS ALREADY CONFIRMED,
          and the panel inside a card is ONE OPTION THE PARTICIPANT HAS NOT CHOSEN, placed against
          what the other five on that table manage. A participant who thinks the card's numbers
          are their score reads every card as a verdict on themselves.

          Both miniatures are live components. The right-hand one is the real MetricStandingBar,
          so the red and green ticks introduced here are the same marks, drawn by the same code,
          that appear on every option card.
        */}
        <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
          <VStack align="start" gap="1" mb="5">
            <Text fontSize="xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
              Two performance readings, and they are not the same thing
            </Text>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              You will see the same five measure names in two places. One is about{" "}
              <Text as="span" color="fg" fontWeight="semibold">you</Text>. The other is about{" "}
              <Text as="span" color="fg" fontWeight="semibold">one option</Text>.
            </Text>
          </VStack>

          <Grid
            templateColumns={{ base: "1fr", md: "1fr 1px 1fr" }}
            gap={{ base: "7", md: "6" }}
            alignItems="stretch"
          >
            <ReadingColumn
              n={1}
              where="At the top of every page"
              title="Your performance"
              icon={<LuGauge />}
              sample={
                <VStack align="stretch" gap="2.5">
                  <HStack justify="space-between">
                    <Text fontSize="2xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="bold">
                      Your performance
                    </Text>
                    <Badge colorPalette="purple" rounded="md" px="2" fontSize="2xs" fontWeight="bold">
                      Overall 62/100
                    </Badge>
                  </HStack>
                  <HBarChart bars={runningBars} max={100} unitHint="average of what you have confirmed" />
                </VStack>
              }
              facts={[
                { label: "What it is about", value: "Every option you have already confirmed, averaged together." },
                { label: "When it changes", value: "Only when you confirm a choice. It starts at zero and fills in as you go." },
                { label: "What it is measured against", value: "Nothing. It simply reports how the options you picked have performed." },
              ]}
            />

            <Box display={{ base: "none", md: "block" }} bg="border" w="1px" />

            <ReadingColumn
              n={2}
              where="Inside every option card"
              title="What this option achieves"
              icon={<LuLayers />}
              sample={
                <VStack align="stretch" gap="3">
                  {SAMPLE_STANDINGS.map((m) => (
                    <MetricStandingBar
                      key={m.key}
                      label={METRIC_DEFS[m.key].label}
                      reading={asClause(METRIC_DEFS[m.key].hover)}
                      score={m.score}
                      worst={m.worst}
                      best={m.best}
                      rank={m.rank}
                      total={6}
                      mode={meterMode}
                    />
                  ))}
                </VStack>
              }
              facts={[
                { label: "What it is about", value: "One option you have not chosen yet — a forecast, not a record." },
                { label: "When it changes", value: "Never. It is fixed for that situation, whatever you decide." },
                { label: "What it is measured against", value: "Only the five options beside it. That is what a place like “1st of 6” counts — 1st is the strongest of the six there, 6th the weakest." },
              ]}
            />
          </Grid>

          <Box mt="6" bg="bg" borderWidth="1px" borderColor="border" rounded="xl" px="4" py="3.5">
            <HStack gap="2.5" align="start">
              <Box color="purple.fg" lineHeight="1" pt="0.5"><Icon boxSize="4"><LuInfo /></Icon></Box>
              <VStack align="start" gap="1.5">
                <Text fontSize="xs" color="fg" lineHeight="tall">
                  <Text as="span" fontWeight="semibold">The two are linked.</Text> Press{" "}
                  <Text as="span" fontWeight="semibold">Preview impact</Text> on any card and the number at
                  the top will show what it would become if you chose that option — without choosing it.
                </Text>
                <Text fontSize="2xs" color="fg.subtle" lineHeight="tall">
                  The measure readings use the same 0–100 scale in both places, so a 65 in one is the same
                  size as a 65 in the other. The one exception is the sentence at the foot of an option card:
                  the “out of 100” there is a position between the weakest and strongest option on that
                  table, not a reading.
                </Text>
              </VStack>
            </HStack>
          </Box>
        </Box>

        {/* THE THREE THINGS TO DO — read, compare, look ahead. */}
        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="4">
          <ToolCard
            icon={<LuEye />}
            title="Read it first"
            body="Take your time with the option you are thinking about. Each one tells you what it protects and what it gives up."
          />
          <ToolCard
            icon={<LuChartColumn />}
            title="Compare, don't guess"
            body="The bars and the radar chart put your option next to the others, so you can see the difference instead of imagining it."
          />
          <ToolCard
            icon={<LuMilestone />}
            title="Look ahead"
            body="You can see the impact in the situation in front of you, and how your choice shapes the situations that come after it."
          />
        </Grid>

        {/*
          WHAT WE ALREADY KNOW — naming the four values does two things: it tells the participant
          their earlier answers were used for something, and it introduces the exact four words
          they are about to meet on every option card.
        */}
        <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
          <VStack align="start" gap="1" mb="4">
            <Text fontSize="xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
              What we already know about you
            </Text>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              Your earlier answers measured four values. Each option will show you how closely it
              matches them.
            </Text>
          </VStack>
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
            {POLICY_DIM_KEYS.map((k) => (
              <ValueChip key={k} name={POLICY_DIM_SHORT[k]} meaning={POLICY_DIM_EXPLAIN[k]}
                higher={POLICY_DIM_HIGHER_MEANS[k]} />
            ))}
          </Grid>
        </Box>

        <Stack align="center" gap="3" pt="1">
          <Button
            size="lg"
            colorPalette="purple"
            rounded="xl"
            px="8"
            onClick={onStart}
          >
            Start the main study
            <Icon ml="1">
              <LuArrowRight />
            </Icon>
          </Button>
          <Text fontSize="xs" color="fg.subtle">
            Answer as yourself. That is the whole task.
          </Text>
        </Stack>
      </VStack>
    </Box>
  );
}

export default Block5IntroPage;
