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
 */

import { useMemo, useRef } from "react";
import {
  Badge, Box, Button, Center, Grid, Heading, HStack, Icon, SimpleGrid, Stack, Text, VStack,
} from "@chakra-ui/react";
import {
  LuArrowRight, LuChartColumn, LuCheck, LuCompass, LuEye, LuRotateCcw, LuRoute, LuScale, LuSparkles, LuTarget, LuTrendingUp,
} from "react-icons/lu";
import type { ReactNode } from "react";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { ALIGNMENT_LABEL, reflectionWasShown } from "./block5CVR";
import { computeStabilityAll } from "./block5StabilityAll";
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

/** One score: its plain name, a big number in the family's color, its level word, a thin 0-100 bar. */
function ScoreNumber({ label, code, value, level, palette, blindMark = false, note }: {
  label: string; code: string; value: number; level?: string; palette: string; blindMark?: boolean; note?: string;
}) {
  const width = Math.max(2, Math.min(100, value));
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
      {level && (
        <Badge mt="2" size="sm" variant="subtle" colorPalette={palette} rounded="md" px="2">{level}</Badge>
      )}
      <Box position="relative" mt="3">
        <Box h="1.5" rounded="full" bg="bg.muted" overflow="hidden">
          <Box h="full" rounded="full" bg={`${palette}.solid`} style={{ width: `${width}%` }} />
        </Box>
        {/* Where choosing at random lands, on the alignment scores. */}
        {blindMark && (
          <Box position="absolute" left="50%" top="-1" h="3.5" w="0.5" rounded="full" bg="fg.subtle"
            title="50 = what choosing at random would give" />
        )}
      </Box>
      {note && <Text fontSize="xs" color="fg.muted" mt="2" lineHeight="short">{note}</Text>}
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
          {sr.cvrFired && !reflectionWasShown(sr) && !!sr.apa && (
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
  const bothLenses = results.scenarioResults.filter((r) => r.cvrAltViewGenerated).length;

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

        {/* 1 · What your results show, and how the study measured it (for somebody who has just finished). */}
        <Box rounded="3xl" borderWidth="1px" borderColor="border" shadow="sm" overflow="hidden"
          bgGradient="to-br" gradientFrom="blue.subtle" gradientVia="purple.subtle" gradientTo="teal.subtle">
          <Box px={{ base: "5", md: "8" }} py={{ base: "6", md: "7" }}>
            <Heading size="lg" color="fg" fontWeight="semibold">What your results show</Heading>
            <Text color="fg.muted" fontSize={{ base: "sm", md: "md" }} lineHeight="tall" mt="2" maxW="4xl">
              You have finished all six emergency scenarios. In the first parts of the study (found money, the
              trolley, the AI workforce and the reflection), your answers showed what matters most to you, across four
              values: <b>protecting the vulnerable</b>, <b>how many are helped</b>, <b>reducing harm</b> and <b>how much
              is gained</b>. In the six scenarios you then made real choices. Your scores put the two side by side:
              a mirror of how you decide, not a grade.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="3" mt="5">
              {[
                { icon: <LuCompass />, head: "What matters to you", sub: "measured in the first parts", palette: "blue" },
                { icon: <LuRoute />, head: "What you chose", sub: "in the six scenarios", palette: "purple" },
                { icon: <LuChartColumn />, head: "Your scores", sub: "the two, side by side", palette: "teal" },
              ].map((step, i) => (
                <HStack key={step.head} gap="3" bg="bg.panel" rounded="xl" px="4" py="3" borderWidth="1px" borderColor="border">
                  <Center boxSize="8" rounded="lg" bg={`${step.palette}.subtle`} color={`${step.palette}.fg`} flexShrink={0}>
                    <Icon boxSize="4">{step.icon}</Icon>
                  </Center>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" color="fg">{i + 1}. {step.head}</Text>
                    <Text fontSize="xs" color="fg.muted">{step.sub}</Text>
                  </Box>
                </HStack>
              ))}
            </SimpleGrid>
          </Box>
        </Box>

        {/* 2 · The major scores, in three families ("Q2-A": colors by family, never a red-to-green verdict). */}
        <Box>
          <Heading size="md" color="fg" fontWeight="semibold">Your scores</Heading>
          <Text fontSize="sm" color="fg.muted" mt="1" mb="4">
            In short: <b>alignment</b> looks at your choices, <b>stability</b> looks at your values themselves, and
            {" "}<b>performance</b> looks at the results.
          </Text>
          <Grid templateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }} gap="4">
            <ScoreFamily palette="blue" icon={<LuTrendingUp />} title="Value alignment"
              question="Did your choices match your values?"
              explain={<>We call it your <b>value consistency</b> (VCI): how closely the options you chose matched what matters most to you. <b>100</b> = the option closest to your values every time; <b>50</b> (the small mark) = what choosing at random would give. “All 6” adds scenario 5, where the decision was made for you, and scenario 6, where you did not know your place.</>}>
              <ScoreNumber label="Your 4 decisions" code="VCI" value={vci} level={results.vciLevel} palette="blue" blindMark />
              {hasVciAll && (
                <ScoreNumber label="All 6 scenarios" code="VCI_all" value={vciAll} level={results.vciAllLevel} palette="cyan" blindMark />
              )}
            </ScoreFamily>
            <ScoreFamily palette="purple" icon={<LuScale />} title="Stability"
              question="Did your values stay the same?"
              explain={<>Compares who you were before the scenarios with who you became, at the moments you chose against what fit you best. It looks at two things: did your four values keep their order, and how far did they move? <b>100</b> = no two values swapped places and none moved.</>}>
              <ScoreNumber label="Your 4 decisions" code="Stability" value={stability} level={results.stabilityLevel} palette="purple"
                note={stabilityUntested ? "Not tested: you always chose one of your two best fits." : undefined} />
              {hasStabilityAll && (
                <ScoreNumber label="All 6 scenarios" code="Stability_all" value={stabilityAll} level={results.stabilityAllLevel} palette="purple"
                  note={stabilityAllUntested ? "Not tested: you always chose one of your two best fits." : undefined} />
              )}
            </ScoreFamily>
            <ScoreFamily palette="teal" icon={<LuTarget />} title="Performance"
              question="How good were the outcomes?"
              explain={<>How much of the best outcome each scenario offered your choices achieved. <b>100</b> = the strongest option every time; <b>0</b> = the weakest. It is separate from your values: an option can match you well and still work out less well.</>}>
              <ScoreNumber label="Your 4 decisions" code="Performance" value={performance}
                level={typeof captured === "number" ? results.performanceCapturedLevel : undefined} palette="teal" />
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
