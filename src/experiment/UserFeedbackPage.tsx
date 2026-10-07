/**
 * UserFeedbackPage — the post-experiment feedback page (Experiment 2).
 *
 * Shown after the Block-5 results summary. Four sections:
 *   ① Value Reflection (CVR)  — conditional: only if the participant saw a CVR vignette
 *   ② Value Clarification (APA) — conditional: only if the APA panel opened
 *   ③ Decision-support tools & experiment design — always
 *   ④ Learning Insight & Well-being battery — always (24 Likert items, 8 subscales; see feedbackTypes.ts)
 *
 * On submit it computes the Well-being subscales/composite, assembles a MongoDB-ready
 * FeedbackRecord (session_id + timing + Block-5 telemetry + answers), stores it in
 * LocalStorage (latest + archive), then shows a thank-you screen. (Its "Finish" button, which reset the
 * browser, was removed on 28 September 2026 - see the note above the thank-you screen.)
 *
 * Privacy: no name/email/id is requested — only the anonymous session_id is attached.
 * This page never touches Block-5 scoring, the seven sensitivities, or the scenarios.
 */

import { Fragment, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Badge, Box, Button, Center, Heading, HStack, Icon, Separator, Stack, Text, Textarea, VStack,
} from "@chakra-ui/react";
import { LuArrowLeft, LuCheck, LuClock, LuMessageSquare, LuRotateCw, LuSparkles } from "react-icons/lu";
import { JourneyTabs } from "./JourneyTabs";
import type { Block5Results } from "./block5Types";
import { markStage } from "./telemetry";
// DEV ONLY — delete this import and the <DevFillFeedbackButton /> below before the study is live.
import { DevFillFeedbackButton } from "@/components/dev/DevFillFeedbackButton";
import {
  APA_QUESTIONS, CVR_QUESTIONS, DUAL_VIEW_QUESTIONS, TOOL_CLOSERS, TOOL_RATINGS,
  WELLBEING_ITEMS, WELLBEING_OPEN_ENDED, WELLBEING_LIKERT_LOW, WELLBEING_LIKERT_HIGH,
  WELLBEING_PART_A_SUBSCALES,
  assembleFeedbackRecord, computeWellbeing, saveFeedbackRecord,
  shouldShowApaSection, shouldShowCvrSection, usedDualPerspective,
  type FeedbackAnswer, type FeedbackAnswers, type FeedbackQuestion,
} from "./feedbackTypes";
import { getActiveSummary } from "./activeTime";
import { MethodLogo, type Method } from "./MethodLogo";
import {
  numberRowsOf, readAttention, recordAttentionAnswer, type NumberList,
} from "./attentionChecks";

interface Props {
  results: Block5Results | null;
  sessionId: string;
  /** Return to the Block-5 results summary. */
  onBack: () => void;
  /**
   * Called once, at the single moment the study counts as finished: the feedback answers have
   * been accepted and the thank-you screen is about to show.
   *
   * The page does not write the completion status itself. Only the flow does, so that there is
   * exactly one line in the codebase capable of marking someone complete — which is what makes
   * "Study Completed" mean the same thing every time it appears.
   */
  onCompleted?: () => void;
  /**
   * True when this browser already recorded the study as complete (28 September 2026, the researcher's
   * "Q4-yes"). The page then opens on the thank-you screen instead of the form. Before, a reload of the
   * thank-you screen showed the form again - nothing read the saved status - and a second submit would
   * have overwritten the answers already sent. The flow reads the status; this page only shows it.
   */
  alreadyCompleted?: boolean;
}

/* ------------------------------- small inputs ------------------------------- */

/** 1–7 Likert. The end boxes (1 and 7) carry their label INSIDE the box, above the number;
 *  boxes 2–6 show the number only. `invalid` highlights an unanswered required row on submit. */
function LikertRow({ q, value, onChange, accent, invalid }: {
  q: FeedbackQuestion; value: number | undefined; onChange: (v: number) => void; accent: string; invalid?: boolean;
}) {
  const low = q.likertLow ?? WELLBEING_LIKERT_LOW;
  const high = q.likertHigh ?? WELLBEING_LIKERT_HIGH;
  return (
    <Box id={`fq-${q.code}`} rounded="lg" transition="all 0.15s"
      borderWidth={invalid ? "1px" : "0"} borderColor={invalid ? "red.solid" : "transparent"}
      bg={invalid ? "red.subtle" : "transparent"} p={invalid ? "3" : "0"}>
      <Text fontSize="sm" color="fg" mb="2.5" lineHeight="tall">{q.text}</Text>
      <HStack gap="1.5" wrap="wrap" align="stretch">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => {
          const selected = value === n;
          const isEnd = n === 1 || n === 7;
          return (
            <Button key={n} onClick={() => onChange(n)}
              colorPalette={accent} variant={selected ? "solid" : "outline"}
              rounded="lg" h="14" py="1.5" px={isEnd ? "2" : "0"} minW={isEnd ? "20" : "10"}
              display="flex" flexDirection="column" justifyContent="center" gap="0.5">
              {isEnd && (
                <Text fontSize="2xs" lineHeight="1.15" fontWeight="semibold" textAlign="center"
                  whiteSpace="normal" color={selected ? "white" : "fg.muted"}>
                  {n === 1 ? low : high}
                </Text>
              )}
              <Text fontSize="md" fontWeight="bold" lineHeight="1">{n}</Text>
            </Button>
          );
        })}
      </HStack>
      {invalid && <Text fontSize="2xs" color="red.fg" mt="1.5" fontWeight="medium">Please choose a rating to continue.</Text>}
    </Box>
  );
}

function YesNoRow({ q, value, onChange, accent, invalid }: {
  q: FeedbackQuestion; value: FeedbackAnswer | undefined; onChange: (v: "yes" | "no") => void; accent: string; invalid?: boolean;
}) {
  return (
    <Box id={`fq-${q.code}`} rounded="lg" transition="all 0.15s"
      borderWidth={invalid ? "1px" : "0"} borderColor={invalid ? "red.solid" : "transparent"}
      bg={invalid ? "red.subtle" : "transparent"} p={invalid ? "3" : "0"}>
      <Text fontSize="sm" color="fg" mb="2" lineHeight="tall">{q.text}</Text>
      <HStack gap="2">
        <Button onClick={() => onChange("yes")} size="sm" colorPalette={accent}
          variant={value === "yes" ? "solid" : "outline"} rounded="lg" px="5">Yes</Button>
        <Button onClick={() => onChange("no")} size="sm" colorPalette={accent}
          variant={value === "no" ? "solid" : "outline"} rounded="lg" px="5">No</Button>
      </HStack>
      {invalid && <Text fontSize="2xs" color="red.fg" mt="1.5" fontWeight="medium">Please choose Yes or No to continue.</Text>}
    </Box>
  );
}

function OpenRow({ q, value, onChange }: {
  q: FeedbackQuestion | { code: string; text: string }; value: string | undefined; onChange: (v: string) => void;
}) {
  return (
    <Box>
      <Text fontSize="sm" color="fg" mb="2" lineHeight="tall">{q.text}</Text>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        placeholder="Optional — your answer helps us improve the experience"
        rows={3} bg="bg.subtle" borderColor="border" rounded="lg" fontSize="sm" resize="vertical" />
    </Box>
  );
}

function SectionCard({ accent, eyebrow, title, subtitle, method, children }: {
  accent: string; eyebrow: string; title: string; subtitle?: string;
  /**
   * The mark the participant saw on that step during the study.
   *
   * These sections ask about screens they met half an hour ago under no name at all — the study
   * never says "CVR" or "APA" in front of a participant. The mark is the only thing linking the
   * question to the memory, so it sits at the top of the card where the question begins.
   */
  method?: Method;
  children: ReactNode;
}) {
  return (
    <Box bg="bg.panel" borderWidth="1px" borderColor="border" borderLeftWidth="5px"
      borderLeftColor={`${accent}.solid`} rounded="2xl" p={{ base: "5", md: "7" }} shadow="sm">
      <HStack justify="space-between" align="center" gap="3" mb="2">
        <Badge colorPalette={accent} variant="subtle" rounded="md" px="2" py="0.5" fontSize="2xs"
          textTransform="uppercase" letterSpacing="wider">{eyebrow}</Badge>
        {method && <MethodLogo method={method} size="sm" />}
      </HStack>
      <Heading size="md" color="fg" mb={subtitle ? "1" : "4"}>{title}</Heading>
      {subtitle && <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">{subtitle}</Text>}
      <Stack gap="5">{children}</Stack>
    </Box>
  );
}

/* ------------------------------- the page ------------------------------- */

export function UserFeedbackPage({ results, sessionId, onBack, onCompleted, alreadyCompleted = false }: Props) {
  const [answers, setAnswers] = useState<Record<string, FeedbackAnswer>>({});
  const [submitted, setSubmitted] = useState(alreadyCompleted);
  /** The active-time summary, frozen at the moment of submission. On a return to a finished study it is
   *  read again: the clock stopped at submission, so it is the same number. */
  const [activeSummary, setActiveSummary] =
    useState<ReturnType<typeof getActiveSummary> | null>(() => (alreadyCompleted ? getActiveSummary() : null));
  const [showValidation, setShowValidation] = useState(false);

  const showCvr = useMemo(() => shouldShowCvrSection(results), [results]);
  const showApa = useMemo(() => shouldShowApaSection(results), [results]);
  const showDual = useMemo(() => usedDualPerspective(results), [results]); // dual-perspective questions

  const setAnswer = useCallback((code: string, value: FeedbackAnswer) => {
    setAnswers((prev) => ({ ...prev, [code]: value }));
  }, []);

  /*
   * THE NUMBER ATTENTION CHECK (since 29 September 2026; attentionChecks.ts). One rating row, "This question is
   * just to check your attention. Pick the number four.", at the place and with the number drawn for this
   * participant: after a row of "The tools & the experiment design" or of "How this experience was for you",
   * never first in a section, never among the reflection or clarification questions. It looks like its neighbours
   * (same scale, same end labels). It is required like them, but its answer is saved in the attention file on
   * submit, never in the feedback record, so it cannot move any score or the "same answer everywhere" flag.
   *
   * THE PROLIFIC DOOR HAS TWO (since 7 October 2026; the researcher's "3-B"): one in "The tools & the experiment
   * design" and one in "How this experience was for you", each with its own number, the same words. The university
   * door keeps its one row. `numberRowsOf` gives the rows the plan drew, each with its own answer code.
   */
  const [attentionRows] = useState(() => numberRowsOf(readAttention().plan));
  const attentionChanges = useRef<Record<string, number>>({});
  const setAttentionAnswer = useCallback((code: string, v: number) => {
    setAnswers((prev) => {
      if (typeof prev[code] === "number" && prev[code] !== v) attentionChanges.current[code] = (attentionChanges.current[code] ?? 0) + 1;
      return { ...prev, [code]: v };
    });
  }, []);
  /** The check row, when one was drawn to follow row `after` (1-based) of `list` (at most one: the rows never share a place). */
  const attentionAfter = (list: NumberList, after: number, accent: string, labels?: { low: string; high: string }) => {
    const at = attentionRows.find((a) => a.row.list === list && a.row.after === after);
    return at ? (
      <LikertRow q={{
        code: at.code, type: "likert",
        text: `This question is just to check your attention. Pick the number ${at.row.word}.`,
        likertLow: labels?.low, likertHigh: labels?.high,
      }} value={num(at.code)} onChange={(v) => setAttentionAnswer(at.code, v)} accent={accent}
        invalid={showValidation && !isAnswered(at.code)} />
    ) : null;
  };
  /** A list's codes with each check's code placed where its row is, so "first unanswered" follows the page. */
  const withAttention = (codes: string[], list: NumberList) => {
    const here = attentionRows.filter((a) => a.row.list === list).sort((x, y) => y.row.after - x.row.after);
    const out = [...codes];
    for (const a of here) out.splice(a.row.after, 0, a.code);
    return out;
  };

  const num = (code: string): number | undefined =>
    typeof answers[code] === "number" ? (answers[code] as number) : undefined;
  const str = (code: string): string | undefined =>
    typeof answers[code] === "string" ? (answers[code] as string) : undefined;

  /** A choice answer is present when it's a Likert number or "yes"/"no". */
  const isAnswered = useCallback((code: string): boolean => {
    const v = answers[code];
    return v !== undefined && v !== "";
  }, [answers]);

  /**
   * Every VISIBLE choice question (Likert + Yes/No) is required. Open-ended questions are
   * optional, and conditional sections that aren't shown (CVR/APA) are never required.
   */
  const requiredCodes = useMemo(() => {
    const choice = (qs: FeedbackQuestion[]) => qs.filter((q) => q.type !== "open").map((q) => q.code);
    const codes: string[] = [];
    if (showCvr) codes.push(...choice(CVR_QUESTIONS));
    if (showDual) codes.push(...choice(DUAL_VIEW_QUESTIONS));
    if (showApa) codes.push(...choice(APA_QUESTIONS));
    codes.push(...withAttention(choice(TOOL_RATINGS), "tools"));
    codes.push(...choice(TOOL_CLOSERS));
    codes.push(...withAttention(
      WELLBEING_ITEMS.filter((i) => WELLBEING_PART_A_SUBSCALES.includes(i.subscale)).map((i) => i.code), "wellbeing_a"));
    codes.push(...withAttention(
      WELLBEING_ITEMS.filter((i) => !WELLBEING_PART_A_SUBSCALES.includes(i.subscale)).map((i) => i.code), "wellbeing_b"));
    return codes;
    // withAttention reads `attentionRows`, which never changes after the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCvr, showApa, showDual]);

  /*
   * DEV ONLY — answers every question the page is currently asking, so a tester does not refill
   * this form on every run. Delete this with the button that calls it; nothing else uses it.
   *
   * It fills from `requiredCodes`, the page's own list, so it can never drift out of step with
   * what is on screen: a question added tomorrow is filled tomorrow, and a section that is hidden
   * for this participant is left alone. The open-ended boxes are filled too, even though they are
   * optional, because a tester checking what reaches the database wants them to carry something.
   */
  const devFillEveryAnswer = useCallback(() => {
    const filled: Record<string, FeedbackAnswer> = {};
    const isYesNo = new Set(
      [...CVR_QUESTIONS, ...DUAL_VIEW_QUESTIONS, ...APA_QUESTIONS, ...TOOL_RATINGS, ...TOOL_CLOSERS]
        .filter((q) => q.type === "yesno").map((q) => q.code),
    );
    requiredCodes.forEach((code, i) => {
      /* A spread of Likert answers rather than the same number everywhere: a form filled with
         nothing but 4s hides a straightlining check that is supposed to notice exactly that. */
      filled[code] = isYesNo.has(code) ? (i % 2 === 0 ? "yes" : "no") : ((i % 7) + 1);
    });
    for (const q of [...CVR_QUESTIONS, ...DUAL_VIEW_QUESTIONS, ...APA_QUESTIONS, ...TOOL_CLOSERS]) {
      if (q.type === "open") filled[q.code] = "Dev fill — written by the development button.";
    }
    /* The attention checks are answered as asked, or every test run would fail them. */
    for (const a of attentionRows) filled[a.code] = a.row.target;
    setAnswers((prev) => ({ ...prev, ...filled }));
    setShowValidation(false);
  }, [requiredCodes, attentionRows]);

  const missingCount = requiredCodes.filter((c) => !isAnswered(c)).length;
  const answeredCount = requiredCodes.length - missingCount;
  const allRequiredAnswered = missingCount === 0;

  const collect = useCallback((qs: FeedbackQuestion[]): Record<string, FeedbackAnswer> => {
    const out: Record<string, FeedbackAnswer> = {};
    for (const q of qs) {
      const v = answers[q.code];
      if (v !== undefined && v !== "") out[q.code] = v;
    }
    return out;
  }, [answers]);

  const handleSubmit = useCallback(() => {
    // Block submission until every VISIBLE choice question is answered; send the user to the
    // first unanswered one. Open-ended and hidden conditional questions are never required.
    const missing = requiredCodes.filter((c) => !isAnswered(c));
    if (missing.length > 0) {
      setShowValidation(true);
      try {
        document.getElementById(`fq-${missing[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch { /* ignore */ }
      return;
    }

    // Well-being: raw items + open-ended → computed subscales/composite.
    const wbItems: Record<string, number> = {};
    for (const i of WELLBEING_ITEMS) {
      const v = answers[i.code];
      if (typeof v === "number") wbItems[i.code] = v;
    }
    const wbOpen: Record<string, string> = {};
    for (const oe of WELLBEING_OPEN_ENDED) {
      const v = answers[oe.code];
      if (typeof v === "string" && v.trim() !== "") wbOpen[oe.code] = v.trim();
    }

    const feedback: FeedbackAnswers = {
      decisionSupport: { ...collect(TOOL_RATINGS), ...collect(TOOL_CLOSERS) },
      wellbeing: computeWellbeing(wbItems, wbOpen),
    };
    if (showCvr) feedback.cvr = { ...collect(CVR_QUESTIONS), ...(showDual ? collect(DUAL_VIEW_QUESTIONS) : {}) };
    if (showApa) feedback.apa = collect(APA_QUESTIONS);

    /* The attention checks' answers go to the attention file, never into the feedback record below. */
    for (const a of attentionRows) {
      const attentionAnswer = answers[a.code];
      if (typeof attentionAnswer === "number") {
        recordAttentionAnswer(a.check, attentionAnswer, null, attentionChanges.current[a.code] ?? 0);
      }
    }

    // Close out the feedback-stage timer so feedbackMs / totalExperimentMs include this page.
    markStage("feedback", "end");
    const record = assembleFeedbackRecord({ sessionId, results, answers: feedback });
    saveFeedbackRecord(record);
    /* The answers are saved BEFORE the study is marked complete, and never the other way round.
       If anything failed in between, a participant would be left recorded as unfinished with
       their answers safe — recoverable. The reverse would mark them finished with nothing to
       show for it, which is not. */
    /* Read before the flow stops the clock, so the number shown is the one that was earned. */
    setActiveSummary(getActiveSummary());
    onCompleted?.();
    setSubmitted(true);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ }
  }, [answers, attentionRows, collect, isAnswered, onCompleted, requiredCodes, results, sessionId, showApa, showCvr, showDual]);

  /*
   * NO "FINISH" BUTTON ON THE THANK-YOU PAGE (removed 28 September 2026, the researcher's request).
   * It cleared this browser's copy of the run and reloaded to the start screen, which looked like an
   * invitation to take the study again. It never recorded anything: the study is marked complete when
   * the feedback is submitted (onCompleted, ExperimentFlow), so removing it changes no data. For
   * testing, the development-only "Restart from Block 1" button still resets a browser.
   */

  if (submitted) {
    /*
     * THE THANK-YOU PAGE (redesigned 29 September 2026, the researcher's request: "more visually elegant and
     * attractive and well organized", and home of the charts since the same day). On top: the thanks, and the time
     * they actually worked - no eligibility, no threshold, no "you needed X more minutes": a page that reports how
     * close somebody is to a target teaches them how to reach it without doing the work; whether a participant
     * qualifies is decided later, from the data. Below: their journey, in five tabs (JourneyTabs), when this browser
     * holds their results.
     */
    const minutes = activeSummary && activeSummary.total_active_minutes > 0
      ? Math.round(activeSummary.total_active_minutes) : null;
    const visits = activeSummary && activeSummary.sittings > 1 ? activeSummary.sittings : null;
    return (
      <Box minH="100dvh" bg="bg" px={{ base: "4", md: "6" }} pt={{ base: "10", md: "14" }} pb="16">
        <VStack gap={{ base: "10", md: "12" }} maxW="6xl" mx="auto" w="full" animationName="fade-in" animationDuration="moderate">
          <Box w="full" rounded="3xl" borderWidth="1px" borderColor="border" shadow="sm" overflow="hidden"
            bgGradient="to-br" gradientFrom="green.subtle" gradientVia="bg.panel" gradientTo="teal.subtle">
            <VStack gap="4" textAlign="center" px={{ base: "6", md: "10" }} py={{ base: "8", md: "10" }} maxW="3xl" mx="auto">
              {/* Its own colors, written out: a Chakra bgGradient here inherits the card's three-color gradient
                  (gradientVia leaks into children), which turned the circle almost white in light mode and hid
                  the white check (the researcher's screenshot, 29 September 2026). */}
              <Center boxSize={{ base: "16", md: "20" }} rounded="full" bg="green.600" color="white" shadow="lg"
                style={{ backgroundImage: "linear-gradient(135deg, var(--chakra-colors-green-500), var(--chakra-colors-teal-600))" }}>
                <Icon boxSize={{ base: "8", md: "10" }}><LuCheck /></Icon>
              </Center>
              <Heading size={{ base: "2xl", md: "3xl" }} color="fg" fontWeight="semibold" letterSpacing="tight">
                Thank you — the study is complete
              </Heading>
              <Text color="fg.muted" fontSize={{ base: "md", md: "lg" }} lineHeight="tall">
                Your answers are saved. We are grateful for the time and thought you gave: it helps us understand
                how people make hard choices. Below is the story of yours.
              </Text>
              {(minutes !== null || visits !== null) && (
                <HStack gap="3" wrap="wrap" justify="center" pt="1">
                  {minutes !== null && (
                    <HStack gap="2.5" bg="bg.panel" borderWidth="1px" borderColor="border" rounded="xl" px="4" py="2.5" shadow="xs">
                      <Icon boxSize="4" color="teal.fg"><LuClock /></Icon>
                      <Text fontSize="sm" color="fg.muted">
                        <Text as="span" color="fg" fontWeight="bold" fontSize="md">{minutes}</Text> minutes of work
                      </Text>
                    </HStack>
                  )}
                  {visits !== null && (
                    <HStack gap="2.5" bg="bg.panel" borderWidth="1px" borderColor="border" rounded="xl" px="4" py="2.5" shadow="xs">
                      <Icon boxSize="4" color="teal.fg"><LuRotateCw /></Icon>
                      <Text fontSize="sm" color="fg.muted">
                        <Text as="span" color="fg" fontWeight="bold" fontSize="md">{visits}</Text> visits
                      </Text>
                    </HStack>
                  )}
                </HStack>
              )}
            </VStack>
          </Box>

          {results?.scenarioResults?.length ? (
            <JourneyTabs results={results} />
          ) : (
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              Your journey charts are kept in the browser where you finished the scenarios.
            </Text>
          )}
        </VStack>
      </Box>
    );
  }

  return (
    <Box minH="100dvh" bg="bg" px={{ base: "4", md: "6" }} py={{ base: "8", md: "12" }} display="flex" alignItems="flex-start" justifyContent="center">
      {/* DEV ONLY — renders nothing in a production build. See DevFillFeedbackButton for how to
          remove it, and why it cannot ship even if that is forgotten. */}
      <DevFillFeedbackButton onFill={devFillEveryAnswer} />
      <VStack gap="6" align="stretch" maxW="3xl" w="full" animationName="fade-in" animationDuration="moderate">
        {/* Header */}
        <VStack gap="3" textAlign="center">
          <Box w="14" h="14" rounded="full" bg="pink.subtle" display="flex" alignItems="center" justifyContent="center">
            <Icon boxSize="7" color="pink.fg"><LuMessageSquare /></Icon>
          </Box>
          <Heading size="2xl" color="fg" fontWeight="semibold">Your Feedback</Heading>
          <Text color="fg.muted" fontSize="lg" maxW="2xl" mx="auto" lineHeight="tall">
            We value your experience. This is the final step — your answers are anonymous and help
            us understand what worked and what to improve.
          </Text>
          <Button onClick={onBack} variant="ghost" size="sm" colorPalette="gray" gap="2" rounded="lg">
            <Icon><LuArrowLeft /></Icon>
            View your results again
          </Button>
        </VStack>

        {/* ① CVR (conditional) */}
        {showCvr && (
          <SectionCard accent="teal" eyebrow="Value reflection" method="cvr"
            title="The reflection step"
            subtitle="In some scenarios, after you chose an option that went against your usual values, you saw a short reflection: the same decision re-framed, plus the perspective of an affected person. These questions are about that step.">
            {CVR_QUESTIONS.map((q) =>
              q.type === "likert" ? (
                <LikertRow key={q.code} q={q} value={num(q.code)} onChange={(v) => setAnswer(q.code, v)} accent="teal" invalid={showValidation && !isAnswered(q.code)} />
              ) : q.type === "yesno" ? (
                <YesNoRow key={q.code} q={q} value={answers[q.code]} onChange={(v) => setAnswer(q.code, v)} accent="teal" invalid={showValidation && !isAnswered(q.code)} />
              ) : (
                <OpenRow key={q.code} q={q} value={str(q.code)} onChange={(v) => setAnswer(q.code, v)} />
              ),
            )}
            {/* Dual-perspective questions — only if the participant generated the alternate lens. */}
            {showDual && (
              <>
                <Separator borderColor="border.subtle" />
                <Text fontSize="xs" fontWeight="semibold" color="teal.fg" textTransform="uppercase" letterSpacing="wider">
                  Comparing the two views
                </Text>
                {DUAL_VIEW_QUESTIONS.map((q) =>
                  q.type === "likert" ? (
                    <LikertRow key={q.code} q={q} value={num(q.code)} onChange={(v) => setAnswer(q.code, v)} accent="teal" invalid={showValidation && !isAnswered(q.code)} />
                  ) : (
                    <YesNoRow key={q.code} q={q} value={answers[q.code]} onChange={(v) => setAnswer(q.code, v)} accent="teal" invalid={showValidation && !isAnswered(q.code)} />
                  ),
                )}
              </>
            )}
          </SectionCard>
        )}

        {/* ② APA (conditional) */}
        {showApa && (
          <SectionCard accent="purple" eyebrow="Value clarification" method="apa"
            title="The clarification step"
            subtitle="In some scenarios you went through a short value-clarification step that asked which value you wanted the system to weight, then showed you the options that fit it. These questions are about that step.">
            {APA_QUESTIONS.map((q) =>
              q.type === "likert" ? (
                <LikertRow key={q.code} q={q} value={num(q.code)} onChange={(v) => setAnswer(q.code, v)} accent="purple" invalid={showValidation && !isAnswered(q.code)} />
              ) : q.type === "yesno" ? (
                <YesNoRow key={q.code} q={q} value={answers[q.code]} onChange={(v) => setAnswer(q.code, v)} accent="purple" invalid={showValidation && !isAnswered(q.code)} />
              ) : (
                <OpenRow key={q.code} q={q} value={str(q.code)} onChange={(v) => setAnswer(q.code, v)} />
              ),
            )}
          </SectionCard>
        )}

        {/* ③ Decision-support tools (always) */}
        <SectionCard accent="orange" eyebrow="Decision-support tools"
          title="The tools & the experiment design"
          subtitle="How helpful was each tool you saw while making your decisions? (1 = not helpful, 7 = very helpful)">
          <Stack gap="4">
            {TOOL_RATINGS.map((q, i) => (
              <Fragment key={q.code}>
                <LikertRow q={q} value={num(q.code)} onChange={(v) => setAnswer(q.code, v)} accent="orange" invalid={showValidation && !isAnswered(q.code)} />
                {attentionAfter("tools", i + 1, "orange", { low: q.likertLow ?? WELLBEING_LIKERT_LOW, high: q.likertHigh ?? WELLBEING_LIKERT_HIGH })}
              </Fragment>
            ))}
          </Stack>
          <Separator borderColor="border.subtle" />
          {TOOL_CLOSERS.map((q) =>
            q.type === "likert" ? (
              <LikertRow key={q.code} q={q} value={num(q.code)} onChange={(v) => setAnswer(q.code, v)} accent="orange" invalid={showValidation && !isAnswered(q.code)} />
            ) : q.type === "yesno" ? (
              <YesNoRow key={q.code} q={q} value={answers[q.code]} onChange={(v) => setAnswer(q.code, v)} accent="orange" invalid={showValidation && !isAnswered(q.code)} />
            ) : (
              <OpenRow key={q.code} q={q} value={str(q.code)} onChange={(v) => setAnswer(q.code, v)} />
            ),
          )}
        </SectionCard>

        {/* ④ Learning Insight & Well-being (always) */}
        <Box id="wellbeing-section">
          <SectionCard accent="pink" eyebrow="Learning insight & well-being"
            title="How this experience was for you"
            subtitle="Please rate how much you agree with each statement (1 = strongly disagree, 7 = strongly agree). Every statement is required.">
            <HStack gap="2" color="pink.fg">
              <Icon><LuSparkles /></Icon>
              <Text fontSize="xs" fontWeight="semibold">Part A — Learning & decisions</Text>
            </HStack>
            {WELLBEING_ITEMS.filter((i) => WELLBEING_PART_A_SUBSCALES.includes(i.subscale)).map((item, i) => (
              <Fragment key={item.code}>
                <LikertRow q={{ code: item.code, text: item.text, type: "likert" }}
                  value={num(item.code)} onChange={(v) => setAnswer(item.code, v)} accent="pink"
                  invalid={showValidation && !isAnswered(item.code)} />
                {attentionAfter("wellbeing_a", i + 1, "pink")}
              </Fragment>
            ))}
            <Separator borderColor="border.subtle" />
            <HStack gap="2" color="pink.fg">
              <Icon><LuSparkles /></Icon>
              <Text fontSize="xs" fontWeight="semibold">Part B — Your experience & well-being</Text>
            </HStack>
            {WELLBEING_ITEMS.filter((i) => !WELLBEING_PART_A_SUBSCALES.includes(i.subscale)).map((item, i) => (
              <Fragment key={item.code}>
                <LikertRow q={{ code: item.code, text: item.text, type: "likert" }}
                  value={num(item.code)} onChange={(v) => setAnswer(item.code, v)} accent="pink"
                  invalid={showValidation && !isAnswered(item.code)} />
                {attentionAfter("wellbeing_b", i + 1, "pink")}
              </Fragment>
            ))}
            <Separator borderColor="border.subtle" />
            <Stack gap="4">
              {WELLBEING_OPEN_ENDED.map((oe) => (
                <OpenRow key={oe.code} q={oe} value={str(oe.code)} onChange={(v) => setAnswer(oe.code, v)} />
              ))}
            </Stack>
          </SectionCard>
        </Box>

        {/* Submit */}
        <Box textAlign="center" pt="2" pb="8">
          {showValidation && !allRequiredAnswered && (
            <Text color="red.fg" fontSize="sm" mb="3" fontWeight="medium">
              Please answer the {missingCount} highlighted question{missingCount === 1 ? "" : "s"} before submitting —
              we've taken you to the first one. (Open-ended questions are optional.)
            </Text>
          )}
          <Button onClick={handleSubmit} size="lg" colorPalette="pink" rounded="lg" px="10" gap="2">
            <Icon><LuCheck /></Icon>
            Submit feedback
          </Button>
          <Text fontSize="xs" color="fg.muted" mt="3">
            {allRequiredAnswered
              ? "All required questions answered — thank you."
              : `Required questions answered: ${answeredCount}/${requiredCodes.length} (open-ended are optional)`}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}

export default UserFeedbackPage;
