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
 * THE PURPLE STAYS; THE FLAG DOES NOT
 * The purple accent is what GlobalStepper has been showing for "Main study" all session, so the
 * page that opens the main study wears it. The flag used to be here too, over the words "You have
 * arrived" — and that pairing was the problem. A flag means the end of a race and arriving means
 * you have finished, so the page announced completion at the exact moment the longest part of the
 * study was starting. Participants in the previous run stopped here.
 *
 * The flag now lives at the true end of the rail, after the results and feedback pages. What
 * opens this page instead points forward, above five empty circles — one per scenario still to
 * come — so the page reads as a threshold rather than a finish line.
 */

import { Badge, Box, Button, Grid, HStack, Heading, Icon, Stack, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight, LuBookOpen, LuChartColumn, LuChevronDown, LuChevronUp, LuChevronsDownUp, LuChevronsRight, LuEye, LuMilestone, LuRoute, LuGauge, LuLayers } from "react-icons/lu";

import { ChartLegend, HBarChart, RadarChart } from "./block5Charts";
import { REFERENCE_SERIES_COLOR, SERIES_COLORS } from "./block5ChartColors";
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

/**
 * THE DASHED SHAPE IS THE PARTICIPANT. It used to be a second option here, and that was a
 * teaching error rather than a cosmetic one.
 *
 * On the real chart a dashed gray outline is ALWAYS the participant - their four value priorities
 * on the left chart, their running performance on the right - and every option is a solid colored
 * line. This page existed to make that chart recognizable, and it was teaching the opposite: that
 * a dashed shape is one more option. A participant who learned it here would read their own line
 * as a rival option in every scenario, and the one thing the chart is for - seeing where an option
 * falls short of YOU - would be invisible to them.
 *
 * So the miniature now draws what the real one draws: two solid options and one dashed gray line
 * that is them, with the same series names the real chart uses.
 *
 * These four cross the option shapes rather than sitting inside or outside them, so both readings
 * are visible at once: corners where the option clears the dashed line, and corners where it falls
 * short of it. They are also kept a clear distance from BOTH option shapes on every axis — an
 * earlier set tracked the second option closely on two corners, and a dashed line that hugs a solid
 * one teaches nothing, however well the caption is worded.
 */
const EXAMPLE_YOUR_VALUES = [62, 58, 78, 48];
const EXAMPLE_METRICS = [42, 78, 65, 88, 30];
/* A second, deliberately different shape, so the pair demonstrates what comparing two
   options on one chart actually looks like rather than one shape on its own. */
const EXAMPLE_METRICS_ALT = [80, 38, 50, 45, 74];

/**
 * The running gauge in the left-hand miniature. These five average to exactly 62, which is the
 * figure printed on the badge beside them — an illustration that does not add up is worse than
 * no illustration, because the participant is being taught how to read the real one.
 */
const EXAMPLE_RUNNING = [58, 64, 71, 55, 62];

/**
 * The Preview impact illustration, and it adds up for the same reason.
 *
 * Two situations already confirmed at an average of 62 — the gauge above — plus one option whose
 * own composite is 74 gives (62 + 62 + 74) / 3 = 66. A participant who checks the arithmetic of
 * the example finds it holds, and 74 is in the range the three sample bars beside it describe.
 */
const EXAMPLE_PREVIEW_FROM = 62;
const EXAMPLE_PREVIEW_TO = 66;

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
    /* "Your role in the story", not "your position". POSITION is the study's own word for the
       block's manipulation, and it is the one word on this page a participant could read as a
       ranking - a position in a list, a position in a queue - which is the opposite of what it
       means here. "Role in the story" cannot be read that way and says the same thing. */
    body: "What has happened, the numbers everyone is working from, and who you are in it. Your role in the story changes from one situation to the next.",
  },
  {
    title: "Look at six options",
    /* "Ordered using the preferences shown by your earlier answers" rather than "put in order
       using your own earlier answers". The old wording named the source but not the mechanism, and
       a participant could reasonably read it as the study having ranked them somehow. This says
       WHAT was taken from those answers - the preferences - and the second clause still says what
       the order is not. */
    /* THE FOLD IS NAMED IN THE STEP ITSELF, not only in the panel below it. A participant who
       skims the five steps and starts reading has met six closed lines by then, and "click one to
       open it" has to have been said before that moment, not merely shown somewhere on the page. */
    body: "They arrive as a list of six titles. Click one to open it and read what it does, what it costs, and the question it raises. Every one can be chosen, and they are ordered using the preferences shown by your earlier answers, not by which one we think is best.",
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

/**
 * THE HEADING EVERY SECTION OF THIS PAGE WEARS, AND WHY IT IS NUMBERED.
 *
 * The page is six things a participant has to hold at once: how a scenario runs, how the option
 * cards open, two charts, two
 * different performance readings, three habits, and the four values. Unnumbered, they read as five
 * separate notices and a reader who looks away has no way back to their place. Numbered, the page
 * becomes a list with a length - and a participant who can see there are six can pace themselves
 * through them.
 *
 * IT LOOKS DELIBERATELY UNLIKE THE STEP CHIPS INSIDE THE SECTIONS. Two of these sections contain
 * their own numbered items - the five steps of a scenario, the two performance readings - so the
 * page carries two counting systems at once, and if they looked alike, section 4 containing an item
 * numbered 1 would read as a contradiction.
 *
 * So a section marker is OUTLINED, tinted and set in mono: a chapter number. A step chip is a
 * FILLED solid purple square: an item in a sequence. One says where you are on the page; the other
 * says where you are inside a section.
 *
 * The hairline rule is what makes it read as a divider rather than a label, and it is dropped on
 * phones where there is no width to spare for it.
 */
function SectionHeading({ n, icon, title, children }: {
  n: number;
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <VStack align="start" gap="1.5" mb="4">
      <HStack gap="2.5" align="center" w="full">
        <Box
          minW="6" h="6" px="1.5" rounded="md" flexShrink={0}
          borderWidth="1px" borderColor="purple.muted" bg="purple.subtle" color="purple.fg"
          display="flex" alignItems="center" justifyContent="center"
          fontSize="2xs" fontWeight="bold" fontFamily="mono" lineHeight="1"
        >
          {n}
        </Box>
        {icon ? (
          <Box color="purple.fg" lineHeight="1" flexShrink={0}><Icon boxSize="4">{icon}</Icon></Box>
        ) : null}
        <Text fontSize="xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
          {title}
        </Text>
        <Box flex="1" minW="6" h="1px" bg="border" display={{ base: "none", sm: "block" }} />
      </HStack>
      {children ? (
        <Text fontSize="sm" color="fg.muted" lineHeight="tall">{children}</Text>
      ) : null}
    </VStack>
  );
}

/** One numbered step in "How the main study works". */
function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <VStack
      align="start" gap="2" h="full" position="relative" overflow="hidden"
      bg="bg.panel" borderWidth="1px" borderColor="border" rounded="xl"
      px={{ base: "4", md: "4" }} py={{ base: "4", md: "5" }}
    >
      {/*
        ONE NUMBER PER CARD, AND IT IS THE BIG ONE.

        There used to be two: a large watermark numeral and a small filled chip saying the same
        thing an inch apart. Two printings of one number is not emphasis, it is a reader wondering
        whether they mean different things.

        THE WATERMARK IS NOW REAL TEXT, not decoration. It carried `aria-hidden` while the chip
        carried the number for a screen reader; with the chip gone, hiding it would have deleted the
        sequence for anyone not reading by eye. It is also darker than it was — a 0.1 opacity
        numeral is fine as a background flourish and far too faint to be the only copy of a fact.

        The title reserves the top-right corner so a two-line heading cannot run underneath it.
      */}
      <Text
        position="absolute" top="-2" right="1"
        fontSize="6xl" fontWeight="bold" color="purple.fg" opacity={0.22} lineHeight="1"
      >
        {n}
      </Text>
      <Text fontSize="sm" fontWeight="semibold" color="fg" lineHeight="short" pr={{ base: "9", md: "11" }}>
        {title}
      </Text>
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


/**
 * WHAT AN OPTION LOOKS LIKE — the fold, shown rather than described.
 *
 * Every option card in a scenario now opens folded: one line carrying its place in the list and
 * its title. That is a good way to meet six options and a bad thing to discover by accident, so
 * the page that already shows the charts and the meters shows this too, in the shape the
 * participant is about to see.
 *
 * THE EXAMPLE IS INVENTED, and the caption says so. It has to be: an option lifted from a real
 * scenario would put a decision in front of somebody before their first situation, and the whole
 * page is built on showing the INSTRUMENTS without showing the content they will be used on. A
 * flood and a sandbag truck appear nowhere in the block.
 */
function FoldedCardDemo() {
  const line = (n: number, title: string) => (
    <HStack
      key={n} gap="3" align="center" bg="bg.panel" borderWidth="1px" borderColor="border"
      rounded="xl" px="3.5" py="2.5"
    >
      <Box
        minW="7" h="7" rounded="lg" borderWidth="1px" borderColor="border" bg="bg.subtle"
        display="flex" alignItems="center" justifyContent="center"
      >
        <Text fontSize="sm" fontWeight="bold" color="fg" fontFamily="mono" lineHeight="1">{n}</Text>
      </Box>
      <Text fontSize="sm" color="fg" fontWeight="semibold" lineHeight="short" flex="1" minW="0">
        {title}
      </Text>
      <Icon boxSize="4" color="fg.muted"><LuChevronDown /></Icon>
    </HStack>
  );

  return (
    <Box>
      <Stack gap="2.5">
        {line(1, "Send the second truck by the river road")}
        {line(2, "Wait for the bridge to be cleared")}
      </Stack>

      <HStack gap="2" justify="center" my="3">
        <Icon boxSize="4" color="teal.fg"><LuChevronsRight /></Icon>
        <Text fontSize="xs" fontStyle="italic" color="fg.muted">
          clicking the first one opens it
        </Text>
      </HStack>

      {/* The same option, open. Deliberately the same three lines a real card carries — what it
          achieves, what it costs, and the question underneath — so the shape is already familiar
          when the first real scenario arrives. */}
      <Box bg="bg.panel" borderWidth="2px" borderColor="teal.muted" rounded="xl"
        px="3.5" py="3.5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <HStack gap="3" align="center" mb="2.5">
          <Box minW="7" h="7" rounded="lg" borderWidth="1px" borderColor="border" bg="bg.subtle"
            display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="sm" fontWeight="bold" color="fg" fontFamily="mono" lineHeight="1">1</Text>
          </Box>
          <Text fontSize="sm" color="fg" fontWeight="semibold" lineHeight="short" flex="1" minW="0">
            Send the second truck by the river road
          </Text>
          <Icon boxSize="4" color="fg.muted"><LuChevronUp /></Icon>
        </HStack>

        <Text fontSize="sm" color="fg.muted" lineHeight="tall" mb="3">
          The river road is twice as long and it is the only way still open. Everything on the truck
          arrives late, and it arrives.
        </Text>

        <Stack gap="1.5">
          <HStack gap="2" align="start">
            <Text fontSize="xs" fontWeight="bold" color="green.fg" minW="20">You gain</Text>
            <Text fontSize="xs" color="fg.muted" lineHeight="tall" flex="1">
              Every sandbag reaches the village, even if it is after dark.
            </Text>
          </HStack>
          <HStack gap="2" align="start">
            <Text fontSize="xs" fontWeight="bold" color="red.fg" minW="20">You give up</Text>
            <Text fontSize="xs" color="fg.muted" lineHeight="tall" flex="1">
              Two hours, and the light. The crew unloads in the dark.
            </Text>
          </HStack>
          <HStack gap="2" align="start">
            <Text fontSize="xs" fontWeight="bold" color="fg" minW="20">The question</Text>
            <Text fontSize="xs" color="fg.muted" lineHeight="tall" flex="1" fontStyle="italic">
              Is late help still help, when the water is already rising?
            </Text>
          </HStack>
        </Stack>
      </Box>

      <Text fontSize="xs" color="fg.subtle" lineHeight="tall" mt="3">
        A made-up example. There is no flood and no truck in this study — it is here only to show
        the shape of a card.
      </Text>
    </Box>
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
  /* The exact gray the real charts use for the participant's own dashed line. Taken from the same
     constant rather than picked by eye, so the shape taught here and the shape drawn in a scenario
     are the same color in both light and dark mode. */
  const referenceColor = REFERENCE_SERIES_COLOR[meterMode];
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
          HERO — a threshold, not an arrival.

          This page used to open with the finish-line flag from the end of the progress rail, over
          the words "You have arrived". Both were wrong in the same direction: the flag is the
          symbol for the end of a race, and arriving is what you do when you have finished. A
          participant who read nothing else took the picture at face value and stopped -- which is
          exactly what happened in the previous run.

          The flag has moved to the real end of the rail. What sits here now points forward, and
          the line above the heading states the size of what is ahead instead of announcing an
          arrival.
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
              <LuChevronsRight />
            </Icon>
          </Box>

          {/*
            Five empty circles, at hero size. This is the one element on the page that a
            participant who reads nothing at all still receives: five things are still to come.
          */}
          <HStack gap="2" justify="center" aria-label="Five scenarios ahead">
            {[0, 1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                boxSize="2.5"
                rounded="full"
                borderWidth="2px"
                borderColor="purple.solid"
              />
            ))}
          </HStack>
          <VStack gap="2">
            <Text
              fontSize="xs"
              fontWeight="bold"
              color="purple.fg"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              {scenarioCountWord(BLOCK5_SCENARIOS.length)} scenarios ahead
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
          THE LINE THAT SAYS THE REST OF THE PAGE IS INSTRUCTIONS.

          Everything above this point is welcome and reassurance - there are no right answers, we
          are not testing you - and everything below it is how the study is operated. Without a
          line between the two, the six sections read as more reassurance and get skimmed, and a
          participant meets the folded cards, the compare button and the two performance readings
          without having been told what any of them are.

          IT IS SET APART RATHER THAN SHOUTED. A serif italic among a page of sans-serif is a
          change of voice, which is what a reader notices; a red box with an exclamation mark is an
          alarm, and nothing here is an emergency. The two rules and the small caps do the work of
          a chapter break, and the colored words carry the three facts worth keeping: that these
          are instructions, that there are six of them, and that reading them now means nothing
          later is a surprise.
        */}
        <Box textAlign="center" py={{ base: "1", md: "2" }}>
          <HStack justify="center" align="center" gap="3" mb="3.5">
            <Box h="1px" w={{ base: "8", md: "16" }} bg="border" />
            <HStack gap="2">
              <Icon boxSize="4" color="teal.fg"><LuBookOpen /></Icon>
              <Text fontSize="xs" fontWeight="bold" letterSpacing="widest" textTransform="uppercase"
                color="teal.fg">
                Read this first
              </Text>
            </HStack>
            <Box h="1px" w={{ base: "8", md: "16" }} bg="border" />
          </HStack>

          <Text fontFamily="serif" fontStyle="italic" fontSize={{ base: "lg", md: "xl" }}
            lineHeight="tall" color="fg.muted" maxW="3xl" mx="auto">
            What follows are the{" "}
            <Text as="span" fontStyle="normal" fontWeight="bold" color="teal.fg">
              important instructions
            </Text>{" "}
            for how the main study works —{" "}
            <Text as="span" fontStyle="normal" fontWeight="semibold" color="fg">
              six short sections
            </Text>{" "}
            covering what happens in each situation, how the option cards open, how to read the two
            charts, and what we already know about you. Read them once now, and nothing in the
            study will take you by surprise.
          </Text>
        </Box>

        {/*
          HOW IT WORKS — the shape of the next few minutes, before any of it starts.

          Blocks 1-4 were one question at a time, so a participant arrives with no model of what a
          Block 5 scenario involves. Without one they cannot pace themselves: the commonest failure
          is treating the first choice as the whole task, then being surprised by the reflection
          stage and reading it as a correction. Saying the reflection is coming, and that changing
          or keeping the choice are equally fine, removes that surprise before it can bias anything.
        */}
        <Box>
          <SectionHeading n={1} icon={<LuRoute />} title="How the main study works">
            {scenarioCountWord(BLOCK5_SCENARIOS.length).replace(/^./, (c) => c.toUpperCase())}{" "}
            situations, one after another. Each one runs the same {HOW_IT_WORKS.length} steps.
          </SectionHeading>
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr", lg: "repeat(5, 1fr)" }} gap="3">
            {HOW_IT_WORKS.map((s, i) => (
              <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} />
            ))}
          </Grid>
        </Box>

        {/*
          THE FOLD — shown, for the same reason the charts are. Step 2 above says the options
          arrive as a list of titles; this section shows what that list looks like and what opening
          one gives back, so the shape is familiar before the first real scenario.

          IT IS A NUMBERED SECTION LIKE THE REST. It arrived as an unnumbered panel inside section
          1 and read as an aside, which is the wrong weight for the first thing a participant will
          have to do in every scenario.
        */}
        <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
          <SectionHeading n={2} icon={<LuChevronsDownUp />} title="How the option cards open">
            Each option arrives folded — its place in the list and its title, nothing more. Click
            the line, or the arrow, and it opens. Click again and it folds away, so the ones you
            have finished with stop taking up the page.
          </SectionHeading>
          <FoldedCardDemo />
        </Box>

        {/*
          THE INSTRUMENTS — shown, not described. A participant who has already seen the shape of
          a radar chart on a calm page recognizes it on a page where a decision is waiting.
        */}
        <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
          <SectionHeading n={3} icon={<LuChartColumn />} title="The two charts, and how to open them">
            On every scenario page there is a button marked{" "}
            <Text as="span" color="fg" fontWeight="semibold">“Compare all options”</Text>.
            It draws all six options on these two shapes at once.
          </SectionHeading>

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
              {/* LIGHTER FILLS THAN THE DEFAULT, because there are three shapes here rather than
                  two. At 0.14 each, three translucent fills stack in the middle and the dashed gray
                  line — the one thing this panel exists to point at — disappears into them. The
                  real chart solves the same problem by fading its fills as more options are shown. */}
              <RadarChart
                fillOpacity={0.07}
                axes={axes}
                series={[
                  { name: "This option", color: SERIES_COLORS[1], values: EXAMPLE_VALUES },
                  { name: "Another option", color: SERIES_COLORS[2], values: EXAMPLE_ALTERNATIVE },
                  /* Dashed, gray, and named exactly as the real chart names it. */
                  { name: "Your value priorities", color: referenceColor, values: EXAMPLE_YOUR_VALUES, dashed: true },
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
                fillOpacity={0.07}
                axes={METRIC_KEYS.map((k) => METRIC_DEFS[k].label)}
                series={[
                  { name: "This option", color: SERIES_COLORS[1], values: EXAMPLE_METRICS },
                  { name: "Another option", color: SERIES_COLORS[2], values: EXAMPLE_METRICS_ALT },
                  /* The same five numbers as the running gauge further down this page, on purpose:
                     one imaginary participant runs through every illustration here, so the gauge
                     and this dashed line are the same fact drawn two ways. */
                  { name: "Your performance so far", color: referenceColor, values: EXAMPLE_RUNNING, dashed: true },
                ]}
              />
            </VStack>
          </Grid>

          {/* The real chart's own legend component, so a solid line and a dashed line are drawn
              here exactly as they will be drawn there. A colored square would have taught the
              participant to look for a square. */}
          <ChartLegend
            items={[
              { label: "An option", color: SERIES_COLORS[1] },
              { label: "Another option", color: SERIES_COLORS[2] },
              { label: "You", color: referenceColor, dashed: true },
            ]}
          />

          <Box bg="bg" borderWidth="1px" borderColor="border" rounded="lg" px="4" py="3" mt="4">
            <Text fontSize="xs" color="fg" lineHeight="tall" textAlign="center">
              <Text as="span" fontWeight="semibold">The dashed gray shape is you.</Text>{" "}
              Every option is a solid colored line; the dashed one is your own answers, drawn on top
              so you can see where an option reaches past what you asked for and where it falls
              short of it.
            </Text>
            <Text fontSize="2xs" color="fg.subtle" lineHeight="tall" textAlign="center" mt="1.5">
              These are example shapes, not real options. Your line on the right-hand chart appears
              from the second situation onward, once there is something to average.
            </Text>
          </Box>
        </Box>

        {/*
          THREE PERFORMANCE THINGS, NOT TWO — the part of the scenario page that is genuinely easy
          to misread, cleared up before the participant meets any of it.

          The same five measure names appear three times, meaning three different things:

            1. THE GAUGE AT THE TOP is the average of the options ALREADY CONFIRMED. It is a running
               total for the whole block and says nothing about the situation on screen.
            2. THE BARS INSIDE A CARD are the option the participant currently has OPEN, placed
               against what the other five on that table manage. A forecast, not a record.
            3. PREVIEW IMPACT is a button that shows what (1) would become if (2) were confirmed —
               and changes nothing at all.

          This panel used to present only the first two, with the button mentioned in a footnote.
          The advisor's objection was that the section read as two readings plus an aside, when the
          button is the thing that JOINS them, and the one place a participant can most easily
          believe they have already committed to something. It is now the third numbered item, with
          its own worked example.

          A participant who thinks the card's numbers are their score reads every card as a verdict
          on themselves. A participant who thinks pressing Preview has chosen for them stops
          pressing it, and loses the one tool on the page for comparing consequences.

          Every miniature is a live component. The bars in item 2 are the real MetricStandingBar, so
          the red and green ticks introduced here are the same marks, drawn by the same code, that
          appear on every option card.
        */}
        <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
          <SectionHeading n={4} icon={<LuGauge />} title="Performance shows up in three places, and they mean different things">
            The same five measure names appear three times on a scenario page. One is{" "}
            <Text as="span" color="fg" fontWeight="semibold">your running total</Text>, one is{" "}
            <Text as="span" color="fg" fontWeight="semibold">the option you are looking at</Text>, and
            one is a button that shows{" "}
            <Text as="span" color="fg" fontWeight="semibold">what would happen if you took it</Text>.
            Nothing moves your total until you confirm a choice.
          </SectionHeading>

          <Grid
            templateColumns={{ base: "1fr", md: "1fr 1px 1fr" }}
            gap={{ base: "7", md: "6" }}
            alignItems="stretch"
          >
            <ReadingColumn
              n={1}
              where="At the top of every page"
              title="Your cumulative performance"
              icon={<LuGauge />}
              sample={
                <VStack align="stretch" gap="2.5">
                  <HStack justify="space-between">
                    <Text fontSize="2xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="bold">
                      Your cumulative performance
                    </Text>
                    <Badge colorPalette="purple" rounded="md" px="2" fontSize="2xs" fontWeight="bold">
                      Overall 62/100
                    </Badge>
                  </HStack>
                  <HBarChart bars={runningBars} max={100} unitHint="average of what you have confirmed" />
                </VStack>
              }
              facts={[
                { label: "What it is about", value: "Every option you have already confirmed, added up and averaged. It is a running total for the whole block — not a score for the situation on screen." },
                { label: "When it changes", value: "Only when you confirm a choice. It starts at zero and updates once with each scenario — never while you are still looking." },
                { label: "What it is measured against", value: "Nothing. It simply reports how the options you confirmed have performed." },
              ]}
            />

            <Box display={{ base: "none", md: "block" }} bg="border" w="1px" />

            <ReadingColumn
              n={2}
              where="Inside the option you select"
              title="What the selected option achieves"
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
                { label: "What it is about", value: "The one option whose details you have opened. Selecting it here only means looking at it — you have not chosen anything yet." },
                { label: "When it changes", value: "It changes when you open a different option, and each option's own bars never move. They are a forecast for that option, not a record of what you did." },
                { label: "What it is measured against", value: "Only the five options beside it. That is what a place like “1st of 6” counts — 1st is the strongest of the six there, 6th the weakest." },
              ]}
            />
          </Grid>

          {/*
            THE THIRD ITEM, AND THE ONE MOST WORTH GETTING RIGHT.

            It is laid out across the full width rather than as a third column, because it is not a
            third reading — it is the bridge between the two above it. The worked example is the
            real widget's own wording and arithmetic, so a participant meets "62 → 66" here and
            recognizes it on a card.
          */}
          <Box
            mt="7" bg="bg" borderWidth="1px" borderColor="purple.muted" borderLeftWidth="4px"
            borderLeftColor="purple.solid" rounded="xl" px={{ base: "4", md: "5" }} py="4"
          >
            <HStack gap="2.5" align="center" mb="3">
              <Box
                boxSize="7" rounded="lg" bg="purple.solid" color="white" flexShrink={0}
                display="flex" alignItems="center" justifyContent="center" fontSize="xs" fontWeight="bold"
              >
                3
              </Box>
              <VStack align="start" gap="0" minW="0">
                <Text fontSize="2xs" fontWeight="bold" color="purple.fg" textTransform="uppercase" letterSpacing="wider">
                  A button on the option you are looking at
                </Text>
                <HStack gap="1.5">
                  <Box color="fg.muted" lineHeight="1"><Icon boxSize="3.5"><LuEye /></Icon></Box>
                  <Text fontSize="sm" fontWeight="semibold" color="fg">Preview impact</Text>
                </HStack>
              </VStack>
            </HStack>

            <Grid templateColumns={{ base: "1fr", md: "auto 1fr" }} gap={{ base: "4", md: "6" }} alignItems="center">
              {/* The real widget, in miniature. Same label, same arrow, same footnote. */}
              <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="lg" px="4" py="3" minW={{ md: "56" }}>
                <Text fontSize="2xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="bold" mb="1.5">
                  Impact on your cumulative performance
                </Text>
                <HStack gap="2.5" align="center">
                  <Text fontSize="xl" fontWeight="bold" color="fg.muted" lineHeight="1">{EXAMPLE_PREVIEW_FROM}</Text>
                  <Box color="fg.subtle" lineHeight="1"><Icon boxSize="4"><LuArrowRight /></Icon></Box>
                  <Text fontSize="xl" fontWeight="bold" color="fg" lineHeight="1">{EXAMPLE_PREVIEW_TO}</Text>
                  <Badge colorPalette="green" rounded="md" px="2" fontSize="2xs" fontWeight="bold">
                    ▲ +{EXAMPLE_PREVIEW_TO - EXAMPLE_PREVIEW_FROM}
                  </Badge>
                </HStack>
                <Text fontSize="2xs" color="fg.subtle" mt="2" lineHeight="tall">
                  Preview only — not saved until you confirm.
                </Text>
              </Box>

              <VStack align="start" gap="2.5">
                <Text fontSize="sm" color="fg" lineHeight="tall">
                  <Text as="span" fontWeight="semibold">What it does.</Text> It takes the option you
                  are looking at and shows what your{" "}
                  <Text as="span" fontWeight="semibold">cumulative performance</Text> at the top of
                  the page would become if you confirmed it. The number moves so you can see the
                  size of the difference instead of imagining it.
                </Text>
                <Text fontSize="sm" color="fg" lineHeight="tall">
                  <Text as="span" fontWeight="semibold">What it does not do.</Text> It does not
                  choose anything, and your cumulative performance does not really move.{" "}
                  <Text as="span" fontWeight="semibold">
                    Nothing is recorded until you confirm your choice for that situation.
                  </Text>{" "}
                  Press it on as many options as you like, in any order.
                </Text>
              </VStack>
            </Grid>

            <Text fontSize="2xs" color="fg.subtle" lineHeight="tall" mt="4">
              All three use the same 0–100 scale, so a 65 in one is the same size as a 65 in another.
              The one exception is the sentence at the foot of an option card: the “out of 100” there
              is a position between the weakest and strongest option on that table, not a reading.
            </Text>
          </Box>
        </Box>

        {/*
          THE THREE THINGS TO DO — read, compare, look ahead.

          This was the one section on the page with no heading, which is why it read as three loose
          cards rather than as advice. Numbering the page made the gap obvious: a list of five with
          a silent fourth item is worse than no list.
        */}
        <Box>
          <SectionHeading n={5} icon={<LuEye />} title="Three things that help">
            None of this is required. They are the habits that make the options easier to tell
            apart.
          </SectionHeading>
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
        </Box>

        {/*
          WHAT WE ALREADY KNOW — naming the four values does two things: it tells the participant
          their earlier answers were used for something, and it introduces the exact four words
          they are about to meet on every option card.
        */}
        <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
          <SectionHeading n={6} icon={<LuLayers />} title="What we already know about you">
            Your earlier answers measured four values. Each option will show you how closely it
            matches them.
          </SectionHeading>
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
