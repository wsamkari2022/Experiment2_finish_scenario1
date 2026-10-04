/**
 * Block5SimulationSummaryPage — the results page: after all six scenarios, before the feedback.
 *
 * REDESIGNED 29 SEPTEMBER 2026 (the researcher's request and plan answers "Q1-A, Q2-A, Q3-A, Q4-yes", with his
 * wording notes). Written for somebody who knows nothing about how the study was built: no "Block 5", no "VCI"
 * without a plain name beside it.
 *   1. "What your results show": what the study measured about them, and how (the first parts measured their values,
 *      the six scenarios their choices, the scores compare the two) - worded for somebody who has just FINISHED.
 *   2. Their major scores in three colored families (colors by family, never red-to-green grading: "Q2-A"):
 *      value alignment (VCI, VCI_all: did your choices match your values?), stability (Stability, Stability_all: did
 *      your values stay the same, before the scenarios and after?), performance (how good were the outcomes?). A
 *      "not tested" note under a stability number that no moment tested ("Q4").
 *   3. Their four values before and after the scenarios, which is what stability watches.
 *   4. The "One last step" card (Block5FeedbackNudge.tsx).
 *   5. Every scenario's choice with its label, fit and badges, as a compact grid ("Q3-A"): two rows instead of six
 *      tall boxes.
 *   6. What they will see after the feedback: the charts moved to the thank-you page (JourneyTabs, "Q1-A").
 * The charts button and the charts view are gone from this page.
 *
 * WHAT A SCENARIO CARD SAYS, CONDITION BY CONDITION (conditions.ts; the four-condition audit, 2 October 2026)
 *   "Reflection shown"      the reflection was shown in that scenario (conditions 1 and 2), also when the participant then
 *                           went back to a good fit (reflectionWasShown)
 *   "Clarification shown"   the APA page opened with no reflection before it (condition 3), also when they went back
 *   "Kept after reflection" a misfit kept after the reflection (conditions 1 and 2)
 *   the note under the card a good fit: "This choice fit your earlier values."; a misfit kept after the reflection: how
 *                           strongly; a misfit confirmed on condition 3's page: "The clarification page opened, and this
 *                           is the option you confirmed there."; a misfit kept on condition 4's page: "...and you kept
 *                           it."; a misfit reached through the APA page after a refusal (condition 1): "you chose to
 *                           reconsider". Baseline shows no reflection badge: nothing extra was shown.
 * STABILITY'S BOX says it looks at two things (since 2 October 2026): whether the four values kept their order and how far
 * they moved - the two parts the score is the average of (block5CVR.ts).
 *
 * REVISED 4 OCTOBER 2026 (the researcher; plan answers "Q1-B, Q2-A, Q3-yes", in every condition):
 *   - "What your results show" TEACHES the three scores: alignment is built choice by choice (it rose or fell with every
 *     scenario's choice), stability compares who they were before the main study with how far they moved by its end,
 *     performance is the outcomes. The "1. What matters to you / 2. What you chose / 3. Your scores" strip is gone (his
 *     advisor could not read it, "Q2-A").
 *   - A new box above the scores, "Your 4 decisions and all 6 scenarios" (ScenariosExplained): what scenarios 1-4, the
 *     wish (5) and the rule (6) are, and what each kind of score counts ("Q3-yes").
 *   - Every level word is a traffic-light badge ("Q1-B": green high, yellow middle, orange and red low), and each thin bar
 *     is the score's own LEVEL SCALE with the participant's level lit and its range under it (block5LevelScale.ts). The
 *     "random = 50" mark is gone: a 57 sat above it and read "Low", and nobody knows what a random chooser is. The
 *     alignment box now says how a choice earns its points (the colored labels on the scenario cards below), which is
 *     why 57 is low. Until this date the families' colors carried no verdict (29 September, "Q2-A"); the score NUMBERS
 *     keep their family colors, the level badges and bars now carry the traffic light.
 *   - THE ⓘ BESIDE EVERY LEVEL BADGE (the same day; "Q1-A, Q2-A, Q3-A, Q4-yes"; LevelInfo): it opens that score's level
 *     ladder - every level's badge, range and a few words, the participant's own level marked "you are here" - so a
 *     reader who takes 50 for "medium" sees where 50 really falls on this scale (a line spelling out what a 50 means was
 *     drafted and removed at the researcher's request the same day). A tap or a click opens it everywhere, a hover too on a computer (a phone has no hover); ✕, a tap outside or Escape
 *     closes it. Nothing about it is recorded, and the words come from block5LevelScale.ts (levelMeaning, SCALE_NAME).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Box, Button, Center, Grid, Heading, HStack, Icon, SimpleGrid, Stack, Text, VStack, chakra,
} from "@chakra-ui/react";
import {
  LuArrowRight, LuCheck, LuEye, LuEyeOff, LuHeartHandshake, LuInfo, LuRotateCcw, LuScale, LuSparkles, LuTarget, LuTrendingUp,
} from "react-icons/lu";
import type { ReactNode } from "react";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { ALIGNMENT_LABEL, labelWeight, reflectionWasShown } from "./block5CVR";
import {
  SCALE_NAME, TRAFFIC_LIGHT, levelCaption, levelMeaning, levelOf, type LevelBand, type ScoreScale,
} from "./block5LevelScale";
import { PopoverArrow, PopoverBody, PopoverCloseTrigger, PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { computeStabilityAll } from "./block5StabilityAll";
import { secondViewWasOpened } from "./feedbackTypes";
import { ROLE_BADGE } from "./block5RoleWords";
import { valueJourney, type PolicyValues } from "./block5Journey";
import { POLICY_DIM_KEYS } from "./block5Types";
import type { AlignmentLevel, Block5Results, Block5ScenarioResult, StakePosition } from "./block5Types";
import { FeedbackBar, LastStepCard } from "./Block5FeedbackNudge";
import { noteFeedbackButton, type FeedbackButton } from "./resultsPageRecord";

interface Props {
  results: Block5Results;
  /** Advance to the post-experiment feedback page. */
  onContinueToFeedback: () => void;
}

const LEVEL_PALETTE: Record<AlignmentLevel, string> = {
  aligned: "green",
  weakly_aligned: "yellow",
  misaligned: "orange",
  strongly_misaligned: "red",
};

/**
 * WHAT THE PARTICIPANT DID AFTER SEEING THE SCENARIO-6 GUESS - one of three things:
 *   "kept"          never pressed "Change my answer"
 *   "changed"       pressed it and ended on a DIFFERENT rule
 *   "reconsidered"  pressed it, went back through the rules, and chose the SAME rule again
 * A record made before 19 September 2026 has no `pressedChangeAnswer`; its log still shows the
 * press as a "changed_answer" entry, so that is read instead.
 */
type AfterTheGuess = "kept" | "changed" | "reconsidered";
function afterTheGuess(pt: NonNullable<Block5ScenarioResult["predictionTest"]>): AfterTheGuess {
  if (pt.changedAfterSeeing) return "changed";
  const pressed = pt.pressedChangeAnswer
    ?? (pt.interactions ?? []).some((e) => e.what === "changed_answer");
  return pressed ? "reconsidered" : "kept";
}

/** A scenario-6 rule's title from its id, falling back to the id so the page never prints "undefined". */
function ruleTitle(scenarioId: string, optionId: string): string {
  return BLOCK5_SCENARIOS.find((s) => s.id === scenarioId)?.options.find((o) => o.id === optionId)?.title
    ?? optionId;
}

/** Plain-English note for a scenario, based on alignment + reflection outcome. */
function scenarioNote(sr: Block5ScenarioResult): string {
  /*
   * SCENARIO 6 IS NOT DESCRIBED BY HOW WELL IT FIT. Every other sentence is a verdict on the choice against the
   * participant's own values, the raw material the software's guess was built from; right under a badge about the
   * guess it would read as the software marking their answer twice. So it describes what THEY did.
   */
  const pt = sr.predictionTest;
  if (pt) {
    const after = afterTheGuess(pt);
    if (after === "changed") {
      return `You first chose “${ruleTitle(sr.scenarioId, pt.firstChoiceOptionId)}”, saw what our software `
        + `expected, and then changed to “${ruleTitle(sr.scenarioId, pt.finalChoiceOptionId)}”.`;
    }
    if (after === "reconsidered") {
      return "You saw what our software expected, went back to reconsider, and chose the same rule again.";
    }
    return "You saw what our software expected of you, and kept the rule you had already chosen.";
  }

  const level = sr.alignmentLevel;
  if (level === "aligned" || level === "weakly_aligned") {
    return "This choice fit your earlier values.";
  }
  /* APA_Only (the audit, 2 October 2026): the clarification page opened at once, with no reflection before it, so the
     participant never "chose to reconsider" (the sentence below); they confirmed this option on that page. */
  if (sr.apa && !reflectionWasShown(sr)) {
    return "This went against your usual values. The clarification page opened, and this is the option you confirmed there.";
  }
  /* Baseline (since 1 October 2026): kept on the confirmation page, with no reflection before it. */
  if (sr.baselineConfirm) {
    return "This went against your usual values, and you kept it.";
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
  return "Your choice favored a different moral trade-off than your earlier answers predicted.";
}

/* ------------------------------------------------------------------ the score boxes */

/**
 * THE LEVEL BAR (since 4 October 2026; block5LevelScale.ts). The 0-100 line cut into the score's own levels, each in its
 * traffic-light color, the participant's level lit and the rest faint, and a ring at their number. It answers "why is
 * 57 low?" by showing where 57 sits among the levels; the caption under it gives the level's range.
 */
function LevelBar({ bands, index, value }: { bands: LevelBand[]; index: number; value: number }) {
  const at = Math.max(0, Math.min(100, value));
  const lit = bands[index].tone.bg;
  return (
    <Box position="relative" h="3.5" mt="3" data-level-bar>
      <HStack position="absolute" left="0" right="0" top="3px" h="2" gap="2px">
        {bands.map((b, i) => (
          <Box key={b.label} h="full" rounded="full" flex={`${b.hi - b.lo + 1} 1 0`} title={`${b.label}: ${b.lo}–${b.hi}`}
            style={{ background: b.tone.bg, opacity: i === index ? 1 : 0.22, transition: "opacity 0.3s ease" }} />
        ))}
      </HStack>
      <Box position="absolute" top="0" boxSize="3.5" rounded="full" bg="bg.panel" borderWidth="3px"
        style={{ left: `calc(${at}% - 7px)`, borderColor: lit, boxShadow: `0 0 0 2px ${lit}33` }} />
    </Box>
  );
}

/**
 * THE ⓘ AND ITS PANEL (since 4 October 2026; see the header). A real button, so a keyboard opens it and a screen reader
 * names it. Tap or click opens and closes it on every device ("Q1-A"); on a computer a hover opens it as well and leaving
 * closes it again, unless the participant clicked, which pins it open. Drawn in the badge's own color, right after it
 * ("Q2-A"). The panel is built only when first opened (lazyMount).
 */
function LevelInfo({ scale, value, label, bands, index }: {
  scale: ScoreScale; value: number; label: string; bands: LevelBand[]; index: number;
}) {
  const [open, setOpen] = useState(false);
  /* How it is open: "hover" closes when the pointer leaves; "click" stays until ✕, a tap outside, Escape or a click. */
  const mode = useRef<"hover" | "click" | null>(null);
  const pressing = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const cancelClose = () => { if (closeTimer.current !== undefined) { window.clearTimeout(closeTimer.current); closeTimer.current = undefined; } };
  const hoverIn = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    cancelClose();
    if (!open) { mode.current = "hover"; setOpen(true); }
  };
  const hoverOut = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || mode.current !== "hover") return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => { if (mode.current === "hover") { mode.current = null; setOpen(false); } }, 220);
  };
  useEffect(() => () => cancelClose(), []);
  const tone = bands[index].tone;
  const ladder = [...bands].map((b, i) => ({ ...b, mine: i === index })).reverse();
  return (
    <PopoverRoot open={open} lazyMount positioning={{ placement: "bottom-start", gutter: 10 }}
      onOpenChange={(e) => {
        /* A click on a panel the hover opened pins it, instead of closing it under the pointer. */
        if (!e.open && pressing.current && mode.current === "hover") { mode.current = "click"; return; }
        mode.current = e.open ? "click" : null;
        setOpen(e.open);
      }}>
      <PopoverTrigger asChild>
        <chakra.button type="button" display="inline-flex" alignItems="center" justifyContent="center" boxSize="6" rounded="full"
          flexShrink={0} cursor="pointer" aria-label={`What the ${SCALE_NAME[scale]} levels mean`} data-level-info={scale}
          transition="transform 0.15s ease" _hover={{ transform: "scale(1.08)" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "colorPalette.focusRing", outlineOffset: "2px" }}
          style={{ background: tone.bg, color: tone.fg, boxShadow: `0 2px 8px ${tone.bg}40` }}
          onPointerDown={() => { pressing.current = true; window.setTimeout(() => { pressing.current = false; }, 400); }}
          onPointerEnter={hoverIn} onPointerLeave={hoverOut}>
          <Icon boxSize="3.5"><LuInfo /></Icon>
        </chakra.button>
      </PopoverTrigger>
      <PopoverContent w="min(360px, calc(100vw - 32px))" rounded="xl" shadow="lg" borderWidth="1px" borderColor="border"
        onPointerEnter={(e) => { if (e.pointerType === "mouse") cancelClose(); }} onPointerLeave={hoverOut}>
        <PopoverArrow />
        <PopoverBody p="4" data-level-info-panel={scale}>
          <PopoverCloseTrigger />
          <Text fontSize="md" fontWeight="semibold" color="fg" pe="8" lineHeight="short">What your {value} means</Text>
          <Text fontSize="2xs" color="fg.subtle" mt="0.5">{SCALE_NAME[scale]} · {label.toLowerCase()}</Text>
          <Grid mt="3.5" templateColumns="auto auto minmax(0, 1fr)" columnGap="2.5" rowGap="2" alignItems="center">
            {ladder.map((b) => {
              const meaning = levelMeaning(scale, b.label);
              return (
                <Box key={b.label} display="contents" data-ladder-row={b.mine ? "mine" : undefined}>
                  <Box justifySelf="start" px="2.5" py="0.5" rounded="full" fontSize="2xs" fontWeight="semibold" lineHeight="1.7"
                    whiteSpace="nowrap"
                    style={{ background: b.tone.bg, color: b.tone.fg, outline: b.mine ? `2px solid ${b.tone.bg}` : undefined, outlineOffset: "2px" }}>
                    {b.label}
                  </Box>
                  <Text fontSize="xs" color={b.mine ? "fg" : "fg.muted"} fontWeight={b.mine ? "semibold" : "normal"}
                    style={{ fontVariantNumeric: "tabular-nums" }}>{b.lo}–{b.hi}</Text>
                  <Text fontSize="xs" color={b.mine ? "fg" : "fg.muted"} fontWeight={b.mine ? "semibold" : "normal"} lineHeight="short">
                    {meaning}{b.mine && <>{meaning ? " · " : ""}<Text as="span" color="fg" fontWeight="bold">you are here</Text></>}
                  </Text>
                </Box>
              );
            })}
          </Grid>
        </PopoverBody>
      </PopoverContent>
    </PopoverRoot>
  );
}

/** One score: its plain name, a big number in the family's color, its level as a traffic-light badge, its level bar. */
function ScoreNumber({ label, code, value, level, palette, scale, note }: {
  label: string; code: string; value: number; level?: string; palette: string; scale: ScoreScale; note?: string;
}) {
  const { bands, index } = levelOf(scale, value, level);
  const tone = bands[index].tone;
  return (
    <Box flex="1" minW="0">
      {/* Two lines, always, so the two numbers of a box stand level ("All 6 scenarios · VCI_all" on one line
          wrapped in a narrow box and pushed its number down). */}
      <Text fontSize="xs" color="fg.muted" fontWeight="medium" lineClamp={1}>{label}</Text>
      <Text fontSize="2xs" color="fg.subtle">{code}</Text>
      <Text fontSize={{ base: "3xl", md: "4xl" }} fontWeight="bold" color={`${palette}.fg`} lineHeight="1" mt="1.5"
        letterSpacing="tight" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
      {/* The level, in its traffic-light color ("Q1-B", 4 October 2026); the same color lights its piece of the bar. */}
      {level && (
        <HStack gap="1.5" mt="2" align="center">
          <Box display="inline-flex" alignItems="center" px="2.5" py="0.5" rounded="full" fontSize="xs"
            fontWeight="semibold" lineHeight="1.6" data-level-badge={tone.name}
            style={{ background: tone.bg, color: tone.fg, boxShadow: `0 2px 10px ${tone.bg}40` }}>
            {level}
          </Box>
          {/* The ⓘ right after the badge ("Q2-A"): this score's level ladder and what 50 means here. */}
          <LevelInfo scale={scale} value={value} label={label} bands={bands} index={index} />
        </HStack>
      )}
      <LevelBar bands={bands} index={index} value={value} />
      <Text fontSize="2xs" color="fg.muted" mt="1" style={{ fontVariantNumeric: "tabular-nums" }} data-level-caption>
        {levelCaption(bands, index)}
      </Text>
      {note && <Text fontSize="xs" color="fg.muted" mt="2" lineHeight="short">{note}</Text>}
    </Box>
  );
}

/** How a decision earns its alignment points: the scenario cards' own labels and colors, the points from labelWeight. */
function PointsLegend() {
  const levels: AlignmentLevel[] = ["aligned", "weakly_aligned", "misaligned", "strongly_misaligned"];
  return (
    <HStack gap="1.5" wrap="wrap" mt="1.5" mb="1" data-points-legend>
      {levels.map((l) => (
        <Badge key={l} size="sm" variant="subtle" colorPalette={LEVEL_PALETTE[l]} rounded="md" px="2">
          {ALIGNMENT_LABEL[l]} <Text as="span" fontWeight="bold" ms="1">{Math.round(100 * labelWeight(l))}</Text>
        </Badge>
      ))}
    </HStack>
  );
}

/**
 * "YOUR 4 DECISIONS AND ALL 6 SCENARIOS" (since 4 October 2026, the researcher: "explain what '4 decisions' means and what
 * '6 scenarios' means ... in a different box above the major scores"). Six numbered stops under two brackets - the
 * decisions in the color of "Your 4 decisions" (blue, as VCI), the wish and the rule in the color of "All 6" (cyan, as
 * VCI_all) - and one line for each kind. The places are the badges each scenario wore (ROLE_BADGE); every claim is the
 * design's: scenario 5 is scenario 4 decided for them, scenario 6 a rule set before knowing who they would be, its
 * guess shown after the choice; performance reads the decisions only.
 */
function ScenariosExplained() {
  const stop = (n: number, palette: string, icon?: ReactNode) => (
    <Center key={n} boxSize={{ base: "8", md: "9" }} rounded="full" bg={`${palette}.subtle`} color={`${palette}.fg`}
      borderWidth="1px" borderColor={`${palette}.muted`} fontSize="sm" fontWeight="bold" flexShrink={0}
      title={BLOCK5_SCENARIOS[n - 1]?.title}>
      {icon ? <Icon boxSize="4">{icon}</Icon> : n}
    </Center>
  );
  const row = (palette: string, tag: string, head: string, body: string) => (
    <HStack align="start" gap="3">
      <Box flexShrink={0} minW="12" textAlign="center" px="2" py="0.5" rounded="md" bg={`${palette}.subtle`} color={`${palette}.fg`}
        fontSize="xs" fontWeight="bold">{tag}</Box>
      <Text fontSize="sm" color="fg.muted" lineHeight="tall"><Text as="span" color="fg" fontWeight="semibold">{head}</Text> {body}</Text>
    </HStack>
  );
  return (
    <Box rounded="2xl" borderWidth="1px" borderColor="border" bg="bg.panel" shadow="sm" px={{ base: "5", md: "7" }} py={{ base: "5", md: "6" }}
      data-scenarios-explained>
      <Heading size="md" color="fg" fontWeight="semibold">Your 4 decisions and all 6 scenarios</Heading>
      <Text fontSize="sm" color="fg.muted" mt="1">Most scores are counted two ways. Here is the difference.</Text>

      {/* The six stops: 1-4 under one bracket, 5 and 6 beside them, one dashed bracket under all six. */}
      <Box mt="5" maxW="xl" mx="auto">
        <HStack gap={{ base: "2", md: "3" }} align="end">
          <Box flex="4" minW="0">
            <HStack justify="space-around">{[1, 2, 3, 4].map((n) => stop(n, "blue"))}</HStack>
            <Box h="2.5" mx="3" mt="2" borderWidth="2px" borderTopWidth="0" borderColor="blue.solid" roundedBottom="md" />
            <Text textAlign="center" fontSize="xs" fontWeight="bold" color="blue.fg" mt="1">Your 4 decisions</Text>
          </Box>
          <Box flex="1" minW="0" textAlign="center">
            <Center>{stop(5, "cyan", <LuHeartHandshake />)}</Center>
            <Text fontSize={{ base: "2xs", md: "xs" }} fontWeight="semibold" color="cyan.fg" mt="2" whiteSpace="nowrap">5 · Wish</Text>
          </Box>
          <Box flex="1" minW="0" textAlign="center">
            <Center>{stop(6, "cyan", <LuEyeOff />)}</Center>
            <Text fontSize={{ base: "2xs", md: "xs" }} fontWeight="semibold" color="cyan.fg" mt="2" whiteSpace="nowrap">6 · Rule</Text>
          </Box>
        </HStack>
        <Box h="2.5" mx="3" mt="2.5" borderWidth="2px" borderTopWidth="0" borderStyle="dashed" borderColor="cyan.solid" roundedBottom="md" />
        <Text textAlign="center" fontSize="xs" fontWeight="bold" color="cyan.fg" mt="1">All 6 scenarios</Text>
      </Box>

      <Stack gap="3" mt="5">
        {row("blue", "1–4", "Your 4 decisions.",
          "You made the choice yourself, and you knew where you stood: deciding alone, for your household, for other people, and inside your employer's rules.")}
        {row("cyan", "5", "A wish.",
          "The same situation as scenario 4, but the decision was made for you. You said what you hoped would be chosen.")}
        {row("cyan", "6", "A rule.",
          "You set a rule before knowing who you would be. Afterwards, our software showed what it had expected you to pick.")}
      </Stack>
      <Text fontSize="sm" color="fg.muted" lineHeight="tall" mt="4" pt="4" borderTopWidth="1px" borderColor="border">
        <b>“Your 4 decisions”</b> counts scenarios 1–4. <b>“All 6 scenarios”</b> adds the wish and the rule, to show
        whether you chose the same way when you were not the one deciding, or did not know your place. Performance counts
        your 4 decisions only: a wish and a rule have no outcome of their own.
      </Text>
    </Box>
  );
}

/** A family of scores: one color, one question, one plain explanation. */
function ScoreFamily({ palette, icon, title, question, explain, children }: {
  palette: string; icon: ReactNode; title: string; question: string; explain: ReactNode; children: ReactNode;
}) {
  return (
    <Box rounded="2xl" borderWidth="1px" borderColor="border" bg="bg.panel" shadow="sm" overflow="hidden"
      display="flex" flexDirection="column">
      <Box h="1" bgGradient="to-r" gradientFrom={`${palette}.300`} gradientTo={`${palette}.600`} />
      <Box flex="1" display="flex" flexDirection="column" px={{ base: "5", md: "6" }} py="5"
        bgGradient="to-b" gradientFrom={`${palette}.subtle`} gradientTo="bg.panel">
        <HStack gap="3" align="center">
          <Center boxSize="9" rounded="xl" bg="bg.panel" color={`${palette}.fg`} borderWidth="1px" borderColor={`${palette}.muted`}
            flexShrink={0}>
            <Icon boxSize="4.5">{icon}</Icon>
          </Center>
          <Box minW="0">
            <Text fontSize="md" fontWeight="semibold" color="fg" lineHeight="short">{title}</Text>
            <Text fontSize="sm" color="fg.muted">{question}</Text>
          </Box>
        </HStack>
        <HStack mt="5" gap="5" align="start">{children}</HStack>
        <Text fontSize="xs" color="fg.muted" mt="auto" pt="4" lineHeight="tall">{explain}</Text>
      </Box>
    </Box>
  );
}

/**
 * The four values, strongest first, with their numbers: before the scenarios, and after all six (since 30 September
 * 2026 the wish and the rule included, the same "after" as the charts' value line and radar; valueJourney).
 */
function ValuesBeforeAfter({ results }: { results: Block5Results }) {
  const labelOf = (k: string) => results.userProfile.dimensions.find((d) => d.key === k)?.label ?? k;
  const journey = valueJourney(results.scenarioResults, results.originalProfile, results.userProfile);
  const before = results.originalProfile ? journey.before : undefined;
  const after = journey.after;
  const ranked = (p: PolicyValues) => POLICY_DIM_KEYS
    .map((k) => ({ key: k, label: labelOf(k), score: p[k] }))
    .sort((a, b) => b.score - a.score);
  const column = (title: string, p: PolicyValues) => (
    <Box flex="1" minW="0">
      <Text fontSize="2xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">{title}</Text>
      <Stack gap="1.5">
        {ranked(p).map((d, i) => (
          <HStack key={d.key} gap="2.5">
            <Center boxSize="5" rounded="md" bg="purple.subtle" color="purple.fg" fontSize="2xs" fontWeight="bold" flexShrink={0}>
              {i + 1}
            </Center>
            <Text fontSize="sm" color="fg" flex="1" minW="0" lineClamp={1}>{d.label}</Text>
            <Text fontSize="sm" color="fg.muted" fontWeight="semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.round(d.score)}
            </Text>
          </HStack>
        ))}
      </Stack>
    </Box>
  );
  return (
    <Box rounded="2xl" borderWidth="1px" borderColor="border" bg="bg.panel" px={{ base: "5", md: "6" }} py="5">
      <Text fontSize="md" fontWeight="semibold" color="fg">Your four values, before and after the scenarios</Text>
      <Text fontSize="sm" color="fg.muted" mb="4">
        Stability watches this order, and how far the numbers moved. Your numbers moved when your choices told us
        something new about you.
      </Text>
      <Stack direction={{ base: "column", sm: "row" }} gap={{ base: "5", sm: "8" }} align={{ sm: "center" }}>
        {before && column("Before", before)}
        {before && (
          <Icon boxSize="5" color="fg.subtle" display={{ base: "none", sm: "block" }}><LuArrowRight /></Icon>
        )}
        {column(before ? "After" : "Now", after)}
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------------ one scenario */

/**
 * ONE SCENARIO, AS A COMPACT CARD ("Q3-A"), HOLDING EVERYTHING THE OLD TALL BOX HELD (the researcher: "I like all
 * the information in the current 'your choices, scenario by scenario' to have these information in the new cards
 * style"): the scenario's title, the choice with its check mark, the alignment label, "Reflection shown" (was "CVR
 * shown"), "Kept after reflection" and "Fit N" in that order, and the italic note. New: the scenario's number and
 * the participant's place in it (ROLE_BADGE, the words the scenario page used).
 *
 * SCENARIO 6 GETS ITS OWN BADGES, and deliberately not the fit ones: the label and the fit score are the raw material
 * the software's guess was built from, and printed right after the guess they read as the software marking the answer.
 * When the participant changed their rule after the guess, the card shows BOTH picks: the guess is judged on the FIRST
 * pick, so "Our software expected this" and "guessed right / wrong" sit under that pick, and the final rule gets its
 * own percentage.
 */
function ScenarioTile({ sr, index }: { sr: Block5ScenarioResult; index: number }) {
  const scenario = BLOCK5_SCENARIOS.find((s) => s.id === sr.scenarioId);
  if (!scenario) return null;
  const selectedOption = scenario.options.find((o) => o.id === sr.selectedOptionId);
  const level = sr.alignmentLevel;
  const pt = sr.predictionTest;
  const isWish = sr.decisionRole === "recipient";
  const role = scenario.stakePosition ? ROLE_BADGE[scenario.stakePosition as StakePosition] : null;
  const changedRule = !!pt && afterTheGuess(pt) === "changed";
  const pctOf = (p: number | undefined) => Math.round((p ?? 0) * 100);
  const finalPct = pt
    ? pctOf(pt.probabilityOfFinalChoice
        ?? pt.shownProbabilities.find((o) => o.optionId === pt.finalChoiceOptionId)?.probability)
    : 0;
  /* The guess, judged on the first pick: what the software expected of it, and whether it was right. */
  const guessBadges = pt && (
    <HStack gap="1.5" wrap="wrap">
      <Badge size="sm" variant="subtle" colorPalette="purple" rounded="md">
        Our software expected this: {pctOf(pt.probabilityOfFirstChoice)}%
      </Badge>
      <Badge size="sm" variant="subtle" colorPalette={pt.predictionWasRight ? "green" : "orange"} rounded="md">
        {pt.predictionWasRight ? "Our software guessed right" : "Our software guessed wrong"}
      </Badge>
    </HStack>
  );

  return (
    <Box rounded="xl" borderWidth="1px" borderColor={pt ? "purple.muted" : "border"} bg="bg.panel" shadow="xs"
      px="4" py="4" display="flex" flexDirection="column" gap="3">
      <Box>
        <HStack justify="space-between" gap="2" align="baseline">
          <Text fontSize="2xs" fontWeight="bold" color={pt ? "purple.fg" : "fg.subtle"} textTransform="uppercase" letterSpacing="wider"
            flexShrink={0}>
            Scenario {index}
          </Text>
          {role && <Text fontSize="2xs" color="fg.muted" textAlign="right" lineClamp={1}>{role}</Text>}
        </HStack>
        <Text fontSize="md" fontWeight="semibold" color="fg" lineHeight="short" mt="1">{scenario.title}</Text>
      </Box>

      {changedRule && pt && (
        <HStack gap="2" align="start">
          <Icon boxSize="4" color="fg.subtle" mt="0.5" flexShrink={0}><LuRotateCcw /></Icon>
          <VStack align="start" gap="1.5" minW="0">
            <Box>
              <Text fontSize="xs" color="fg.muted">Your first choice, before you saw the guess</Text>
              <Text fontSize="sm" color="fg.muted" fontWeight="medium" lineHeight="short">
                {ruleTitle(sr.scenarioId, pt.firstChoiceOptionId)}
              </Text>
            </Box>
            {guessBadges}
          </VStack>
        </HStack>
      )}

      <HStack gap="2" align="start">
        <Icon boxSize="4" color="green.500" mt="0.5" flexShrink={0}><LuCheck /></Icon>
        <Box minW="0">
          <Text fontSize="xs" color="fg.muted">{changedRule ? "Your final choice" : isWish ? "Your wish" : "Your choice"}</Text>
          <Text fontSize="sm" color="fg" fontWeight="semibold" lineHeight="short">
            {selectedOption?.title ?? sr.selectedOptionId}
          </Text>
        </Box>
      </HStack>

      {pt ? (
        changedRule ? (
          <HStack gap="1.5" wrap="wrap">
            <Badge size="sm" variant="subtle" colorPalette="purple" rounded="md">Our software expected this: {finalPct}%</Badge>
            <Badge size="sm" variant="subtle" colorPalette="blue" rounded="md">You changed after seeing the guess</Badge>
          </HStack>
        ) : guessBadges
      ) : (
        <HStack gap="1.5" wrap="wrap">
          {level && (
            <Badge size="sm" variant="subtle" colorPalette={LEVEL_PALETTE[level]} rounded="md">{ALIGNMENT_LABEL[level]}</Badge>
          )}
          {reflectionWasShown(sr) && (
            <Badge size="sm" variant="subtle" colorPalette="orange" rounded="md">Reflection shown</Badge>
          )}
          {/* APA_Only (since 1 October 2026, the researcher's "Q3-yes"): the APA page opened with no reflection before it.
              Only when the APA page ran: Baseline's misaligned keep is also a Stability step with no reflection, and there
              nothing extra was shown, so it gets no badge. */}
          {/* The audit, 2 October 2026: also when the clarification page opened and the participant went back to a good
              fit (no APA record then, but an APA visit). */}
          {!reflectionWasShown(sr) && (!!sr.apa || (sr.telemetry?.apaVisits ?? 0) > 0) && (
            <Badge size="sm" variant="subtle" colorPalette="orange" rounded="md">Clarification shown</Badge>
          )}
          {sr.cvrFired && (sr.cvrEndorsement === "strong" || sr.cvrEndorsement === "weak") && (
            <Badge size="sm" variant="subtle" colorPalette="green" rounded="md">Kept after reflection</Badge>
          )}
          {typeof sr.matchScore === "number" && (
            <Badge size="sm" variant="subtle" colorPalette="gray" rounded="md">Fit {sr.matchScore}</Badge>
          )}
        </HStack>
      )}

      <Text fontSize="xs" color="fg.muted" fontStyle="italic" lineHeight="short" mt="auto">{scenarioNote(sr)}</Text>
    </Box>
  );
}

/* ------------------------------------------------------------------ the page */

export function Block5SimulationSummaryPage({ results, onContinueToFeedback }: Props) {
  /* The "One last step" card and the bottom button: the bottom bar shows only while neither is on
     screen (Block5FeedbackNudge.tsx). */
  const cardRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const watch = useMemo(() => [cardRef, bottomRef], []);
  /* Every way to the feedback goes through here, so the record says which one was used (since
     28 September 2026; resultsPageRecord.ts). */
  const toFeedback = (button: FeedbackButton) => {
    noteFeedbackButton(button);
    onContinueToFeedback();
  };

  const vci = results.vci ?? 0;
  const vciAll = results.vciAll;
  const hasVciAll = typeof vciAll === "number";
  const stability = results.stability ?? 0;
  const stabilityAll = results.stabilityAll;
  const hasStabilityAll = typeof stabilityAll === "number";
  /* "Not tested" ("Q4"): Stability counts only the moments a choice went against the best fit. */
  const stabilityUntested = results.stabilityDetail?.conflictSteps === 0;
  const stabilityAllUntested = hasStabilityAll && computeStabilityAll(results.scenarioResults)?.measured === false;
  /* Performance is the share of the best outcome each scenario offered (block5Performance.ts), 0-100. */
  const captured = results.performanceCaptured;
  const performance = typeof captured === "number" ? captured : (results.performance ?? 0);
  /* The reflection actually shown (APA_Only's clarifications count as Stability steps but showed no second view). */
  const withCvr = results.scenarioResults.filter((r) => reflectionWasShown(r)).length;
  /* The audit, 2 October 2026: a second view opened before going back counts too (usedDualPerspective's rule). */
  const bothLenses = results.scenarioResults.filter((r) => secondViewWasOpened(r)).length;

  return (
    <Box minH="100dvh" bg="bg" px={{ base: "4", md: "6" }} pt={{ base: "8", md: "12" }} pb="24">
      <VStack gap={{ base: "8", md: "10" }} align="stretch" maxW="6xl" mx="auto" animationName="fade-in" animationDuration="moderate">
        {/* Header: the scenarios are done and one step is left (28 September 2026; Block5FeedbackNudge.tsx). */}
        <VStack gap="3" textAlign="center">
          <Badge colorPalette="pink" variant="subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="medium" px="3" py="1" rounded="md">
            Scenarios done · 1 step left
          </Badge>
          <Heading size={{ base: "2xl", md: "3xl" }} color="fg" fontWeight="semibold" letterSpacing="tight">Here are your results</Heading>
        </VStack>

        {/* 1 · What your results show: the three scores TAUGHT (4 October 2026, the researcher: alignment changes with
            every choice in every scenario; stability is who they were before the main study and how far they are from
            it now). The "1-2-3" strip that stood here is gone ("Q2-A"): its three titles said nothing on their own. */}
        <Box rounded="3xl" borderWidth="1px" borderColor="border" shadow="sm" overflow="hidden"
          bgGradient="to-br" gradientFrom="blue.subtle" gradientVia="purple.subtle" gradientTo="teal.subtle" data-results-teach>
          <Box px={{ base: "5", md: "8" }} py={{ base: "6", md: "7" }}>
            <Heading size="lg" color="fg" fontWeight="semibold">What your results show</Heading>
            <Text color="fg.muted" fontSize={{ base: "sm", md: "md" }} lineHeight="tall" mt="2" maxW="4xl">
              You have finished all six scenarios. The first parts of the study (found money, the trolley, the AI workforce
              and the reflection) measured what matters most to you, across four values: <b>protecting the
              vulnerable</b>, <b>how many are helped</b>, <b>reducing harm</b> and <b>how much is gained</b>. Your three
              scores describe how your choices in the scenarios relate to those values. None of them is right or wrong.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="3" mt="5">
              {[
                { icon: <LuTrendingUp />, palette: "blue", head: "Value alignment", tag: "choice by choice",
                  body: "In every scenario, the option you chose was compared with your four values. Each choice adds to this score, so it rose or fell with every scenario." },
                { icon: <LuScale />, palette: "purple", head: "Stability", tag: "before and after",
                  body: "Who you were before the main study, and how far you moved by its end. When a choice went against your values, your values were updated; stability shows whether they kept their order and how far they moved." },
                { icon: <LuTarget />, palette: "teal", head: "Performance", tag: "the outcomes",
                  body: "How well your choices worked out in each situation, whatever your values. A choice can fit you well and still work out less well." },
              ].map((t) => (
                <Box key={t.head} bg="bg.panel" rounded="xl" px="4" py="4" borderWidth="1px" borderColor="border"
                  borderTopWidth="3px" borderTopColor={`${t.palette}.solid`}>
                  <HStack gap="2.5">
                    <Center boxSize="8" rounded="lg" bg={`${t.palette}.subtle`} color={`${t.palette}.fg`} flexShrink={0}>
                      <Icon boxSize="4">{t.icon}</Icon>
                    </Center>
                    <Box minW="0">
                      <Text fontSize="sm" fontWeight="semibold" color="fg" lineHeight="short">{t.head}</Text>
                      <Text fontSize="2xs" fontWeight="bold" color={`${t.palette}.fg`} textTransform="uppercase" letterSpacing="wider">{t.tag}</Text>
                    </Box>
                  </HStack>
                  <Text fontSize="sm" color="fg.muted" lineHeight="tall" mt="2.5">{t.body}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        </Box>

        {/* 1b · What "Your 4 decisions" and "All 6 scenarios" mean, right above the scores that use them. */}
        <ScenariosExplained />

        {/* 2 · The major scores, in three families ("Q2-A": colors by family, never a red-to-green verdict). */}
        <Box>
          <HStack justify="space-between" align="end" wrap="wrap" gap="2" mb="4">
            <Heading size="md" color="fg" fontWeight="semibold">Your scores</Heading>
            {/* The traffic light's key ("Q1-B"): what the badge colors and the lit piece of each bar mean. */}
            <HStack gap="3" fontSize="xs" color="fg.muted" data-level-legend>
              <Text>Level:</Text>
              {[[TRAFFIC_LIGHT[0], "high"], [TRAFFIC_LIGHT[2], "middle"], [TRAFFIC_LIGHT[4], "low"]].map(([t, w]) => (
                <HStack key={(t as LevelBand["tone"]).name} gap="1.5">
                  <Box boxSize="2.5" rounded="full" style={{ background: (t as LevelBand["tone"]).bg }} />
                  <Text>{w as string}</Text>
                </HStack>
              ))}
            </HStack>
          </HStack>
          <Grid templateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }} gap="4">
            <ScoreFamily palette="blue" icon={<LuTrendingUp />} title="Value alignment"
              question="Did your choices match your values?"
              explain={<>We call it your <b>Value Consistency Index</b> (VCI). Each decision earns points for how close the option you chose came to your values, with the same labels as your scenario cards below:<PointsLegend />Your score is the average, so it is high only when most choices were Aligned or Weakly aligned. “All 6” adds your wish and your rule.</>}>
              <ScoreNumber label="Your 4 decisions" code="VCI" value={vci} level={results.vciLevel} palette="blue" scale="vci" />
              {hasVciAll && (
                <ScoreNumber label="All 6 scenarios" code="VCI_all" value={vciAll} level={results.vciAllLevel} palette="cyan" scale="vciAll" />
              )}
            </ScoreFamily>
            <ScoreFamily palette="purple" icon={<LuScale />} title="Stability"
              question="Did your values stay the same?"
              explain={<>Who you were before the main study against who you are now, counted at the moments a choice went against your values: did your four values keep their order, and how far did they move? <b>100</b> = no two values swapped places and none moved.</>}>
              <ScoreNumber label="Your 4 decisions" code="Stability" value={stability} level={results.stabilityLevel} palette="purple"
                scale="stability" note={stabilityUntested ? "Not tested: you always chose one of your two best fits." : undefined} />
              {hasStabilityAll && (
                <ScoreNumber label="All 6 scenarios" code="Stability_all" value={stabilityAll} level={results.stabilityAllLevel} palette="purple"
                  scale="stability" note={stabilityAllUntested ? "Not tested: you always chose one of your two best fits." : undefined} />
              )}
            </ScoreFamily>
            <ScoreFamily palette="teal" icon={<LuTarget />} title="Performance"
              question="How good were the outcomes?"
              explain={<>How much of the best outcome each scenario offered your choices achieved. <b>100</b> = the strongest option every time; <b>0</b> = the weakest. It is separate from your values: an option can match you well and still work out less well.</>}>
              <ScoreNumber label="Your 4 decisions" code="Performance" value={performance}
                level={typeof captured === "number" ? results.performanceCapturedLevel : undefined} palette="teal" scale="performance" />
            </ScoreFamily>
          </Grid>
        </Box>

        {/* 3 · The four values, before and after: what stability watches (the researcher's note). */}
        <ValuesBeforeAfter results={results} />

        {/* The way on, right under the scores ("Q1-A" of 28 September): every participant sees their results first,
            and long before the bottom of the page. */}
        <LastStepCard ref={cardRef} onContinue={() => toFeedback("card_under_scores")} />

        {/* 4 · Every choice, as a compact grid ("Q3-A"). */}
        <Box>
          <Heading size="md" color="fg" fontWeight="semibold">Your choices, scenario by scenario</Heading>
          <Text fontSize="sm" color="fg.muted" mt="1" mb="4">
            The colored label says how well each choice matched your values; <b>Fit</b> says the same out of 100.
          </Text>
          {/* How often the reflection offered a second way of seeing a choice, with the count named. */}
          {withCvr > 0 && (
            <HStack gap="2.5" align="start" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="lg" px="4" py="3" mb="4">
              <Icon boxSize="4" color="fg.muted" mt="0.5"><LuEye /></Icon>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                {bothLenses === 0
                  ? `In ${withCvr} of the ${results.scenarioResults.length} scenarios you were offered a second way of seeing your choice, and you stayed with the first view each time.`
                  : `In ${withCvr} of the ${results.scenarioResults.length} scenarios you were offered a second way of seeing your choice. You opened it in ${bothLenses} of those, and compared both ways of seeing the same decision.`}
              </Text>
            </HStack>
          )}
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="4">
            {results.scenarioResults.map((sr, i) => <ScenarioTile key={sr.scenarioId} sr={sr} index={i + 1} />)}
          </SimpleGrid>
        </Box>

        {/* 5 · What comes after the feedback: the charts moved to the thank-you page ("Q1-A"). */}
        <Box rounded="2xl" borderWidth="1px" borderStyle="dashed" borderColor="purple.muted" bg="bg.panel" px={{ base: "5", md: "6" }} py="5">
          <HStack gap="3" align="start">
            <Center boxSize="9" rounded="xl" bg="purple.subtle" color="purple.fg" flexShrink={0}>
              <Icon boxSize="4.5"><LuSparkles /></Icon>
            </Center>
            <Box>
              <Text fontSize="md" fontWeight="semibold" color="fg">After your feedback: your journey in pictures</Text>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall" mt="1">
                It opens on the thank-you page, right after the feedback questions.
              </Text>
              <HStack gap="2" wrap="wrap" mt="3">
                {["How your values moved", "Who carried the cost (the position effect)", "What our software predicted",
                  "Your time and your first answers"].map((chip) => (
                  <Badge key={chip} variant="outline" colorPalette="purple" rounded="full" px="2.5" py="0.5" fontSize="xs"
                    fontWeight="medium">{chip}</Badge>
                ))}
              </HStack>
            </Box>
          </HStack>
        </Box>

        <Box ref={bottomRef} textAlign="center" pb="4">
          <Text color="fg.muted" fontSize="md" mb="5">
            One last step — please share your feedback on the experience.
          </Text>
          <Button onClick={() => toFeedback("bottom_of_results")} size="lg" colorPalette="pink" rounded="lg" px="8" gap="2">
            Continue to feedback
            <Icon><LuArrowRight /></Icon>
          </Button>
        </Box>
      </VStack>
      <FeedbackBar watch={watch} onContinue={() => toFeedback("bar_on_results")} />
    </Box>
  );
}
