/**
 * UserFeedbackPage — the post-experiment feedback page (Experiment 2).
 *
 * Shown after the Block-5 results summary. Four sections:
 *   ① Value Reflection (CVR)  — conditional: only if the participant saw a CVR vignette
 *   ② Value Clarification (APA) — conditional: only if the APA panel opened
 *   ③ Decision-support tools & experiment design — always
 *   ④ Learning Insight & Well-being battery — always (20 Likert items, 7 subscales)
 *
 * On submit it computes the Well-being subscales/composite, assembles a MongoDB-ready
 * FeedbackRecord (session_id + timing + Block-5 telemetry + answers), stores it in
 * LocalStorage (latest + archive), then shows a thank-you screen with Finish.
 *
 * Privacy: no name/email/id is requested — only the anonymous session_id is attached.
 * This page never touches Block-5 scoring, the seven sensitivities, or the scenarios.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Badge, Box, Button, Heading, HStack, Icon, Separator, Stack, Text, Textarea, VStack,
} from "@chakra-ui/react";
import { LuArrowLeft, LuCheck, LuMessageSquare, LuRotateCcw, LuSparkles } from "react-icons/lu";
import type { Block5Results } from "./block5Types";
import { markStage } from "./telemetry";
import {
  APA_QUESTIONS, CVR_QUESTIONS, DUAL_VIEW_QUESTIONS, TOOL_CLOSERS, TOOL_RATINGS,
  WELLBEING_ITEMS, WELLBEING_OPEN_ENDED, WELLBEING_LIKERT_LOW, WELLBEING_LIKERT_HIGH,
  WELLBEING_PART_A_SUBSCALES,
  assembleFeedbackRecord, computeWellbeing, saveFeedbackRecord,
  shouldShowApaSection, shouldShowCvrSection, usedDualPerspective,
  FEEDBACK_ARCHIVE_KEY,
  type FeedbackAnswer, type FeedbackAnswers, type FeedbackQuestion,
} from "./feedbackTypes";
import { PARTICIPANT_DIRECTORY_KEY } from "./participantDirectory";

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

function SectionCard({ accent, eyebrow, title, subtitle, children }: {
  accent: string; eyebrow: string; title: string; subtitle?: string; children: ReactNode;
}) {
  return (
    <Box bg="bg.panel" borderWidth="1px" borderColor="border" borderLeftWidth="5px"
      borderLeftColor={`${accent}.solid`} rounded="2xl" p={{ base: "5", md: "7" }} shadow="sm">
      <Badge colorPalette={accent} variant="subtle" rounded="md" px="2" py="0.5" fontSize="2xs"
        textTransform="uppercase" letterSpacing="wider" mb="2">{eyebrow}</Badge>
      <Heading size="md" color="fg" mb={subtitle ? "1" : "4"}>{title}</Heading>
      {subtitle && <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">{subtitle}</Text>}
      <Stack gap="5">{children}</Stack>
    </Box>
  );
}

/* ------------------------------- the page ------------------------------- */

export function UserFeedbackPage({ results, sessionId, onBack, onCompleted }: Props) {
  const [answers, setAnswers] = useState<Record<string, FeedbackAnswer>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const showCvr = useMemo(() => shouldShowCvrSection(results), [results]);
  const showApa = useMemo(() => shouldShowApaSection(results), [results]);
  const showDual = useMemo(() => usedDualPerspective(results), [results]); // dual-perspective questions

  const setAnswer = useCallback((code: string, value: FeedbackAnswer) => {
    setAnswers((prev) => ({ ...prev, [code]: value }));
  }, []);

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
    codes.push(...choice(TOOL_RATINGS));
    codes.push(...choice(TOOL_CLOSERS));
    codes.push(...WELLBEING_ITEMS.map((i) => i.code));
    return codes;
  }, [showCvr, showApa, showDual]);

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

    // Close out the feedback-stage timer so feedbackMs / totalExperimentMs include this page.
    markStage("feedback", "end");
    const record = assembleFeedbackRecord({ sessionId, results, answers: feedback });
    saveFeedbackRecord(record);
    /* The answers are saved BEFORE the study is marked complete, and never the other way round.
       If anything failed in between, a participant would be left recorded as unfinished with
       their answers safe — recoverable. The reverse would mark them finished with nothing to
       show for it, which is not. */
    onCompleted?.();
    setSubmitted(true);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ }
  }, [answers, collect, isAnswered, onCompleted, requiredCodes, results, sessionId, showApa, showCvr, showDual]);

  /**
   * Finish: reset for a fresh participant, but PRESERVE two things that outlive the run.
   *
   * The archived feedback records, as before — and the participant directory. The directory is
   * every person this machine has enrolled, and it is what the start screen reads to recognise a
   * returning participant and to refuse a second attempt. Clearing it with everything else would
   * mean that finishing one session quietly erased the record of everyone who had used the
   * machine before, and that each of them could then take the study again.
   *
   * Anything that must survive a reset goes in this list. Nothing else does.
   */
  const handleFinish = useCallback(() => {
    try {
      const preserved: Array<[string, string | null]> = [
        [FEEDBACK_ARCHIVE_KEY, localStorage.getItem(FEEDBACK_ARCHIVE_KEY)],
        [PARTICIPANT_DIRECTORY_KEY, localStorage.getItem(PARTICIPANT_DIRECTORY_KEY)],
      ];
      localStorage.clear();
      sessionStorage.clear();
      for (const [key, value] of preserved) {
        if (value) localStorage.setItem(key, value);
      }
    } catch { /* ignore */ }
    window.location.reload();
  }, []);

  if (submitted) {
    return (
      <Box minH="100dvh" bg="bg" px={{ base: "4", md: "6" }} py={{ base: "10", md: "16" }} display="flex" alignItems="flex-start" justifyContent="center">
        <VStack gap="6" maxW="lg" w="full" textAlign="center" animationName="fade-in" animationDuration="moderate">
          <Box w="16" h="16" rounded="full" bg="green.subtle" display="flex" alignItems="center" justifyContent="center">
            <Icon boxSize="8" color="green.fg"><LuCheck /></Icon>
          </Box>
          <Heading size="2xl" color="fg">Thank you</Heading>
          <Text color="fg.muted" fontSize="lg" lineHeight="tall">
            Your feedback has been recorded. We're grateful for the time and thought you gave
            to this experiment — it genuinely helps improve how these decision-support tools work.
          </Text>
          <Button onClick={handleFinish} size="lg" bg="gray.900" color="white" _hover={{ bg: "gray.800" }} rounded="lg" px="8" gap="2">
            <Icon><LuRotateCcw /></Icon>
            Finish
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Box minH="100dvh" bg="bg" px={{ base: "4", md: "6" }} py={{ base: "8", md: "12" }} display="flex" alignItems="flex-start" justifyContent="center">
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
          <SectionCard accent="teal" eyebrow="Value reflection"
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
                  Comparing the two perspectives
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
          <SectionCard accent="purple" eyebrow="Value clarification"
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
            {TOOL_RATINGS.map((q) => (
              <LikertRow key={q.code} q={q} value={num(q.code)} onChange={(v) => setAnswer(q.code, v)} accent="orange" invalid={showValidation && !isAnswered(q.code)} />
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
            {WELLBEING_ITEMS.filter((i) => WELLBEING_PART_A_SUBSCALES.includes(i.subscale)).map((item) => (
              <LikertRow key={item.code} q={{ code: item.code, text: item.text, type: "likert" }}
                value={num(item.code)} onChange={(v) => setAnswer(item.code, v)} accent="pink"
                invalid={showValidation && !isAnswered(item.code)} />
            ))}
            <Separator borderColor="border.subtle" />
            <HStack gap="2" color="pink.fg">
              <Icon><LuSparkles /></Icon>
              <Text fontSize="xs" fontWeight="semibold">Part B — Your experience & well-being</Text>
            </HStack>
            {WELLBEING_ITEMS.filter((i) => !WELLBEING_PART_A_SUBSCALES.includes(i.subscale)).map((item) => (
              <LikertRow key={item.code} q={{ code: item.code, text: item.text, type: "likert" }}
                value={num(item.code)} onChange={(v) => setAnswer(item.code, v)} accent="pink"
                invalid={showValidation && !isAnswered(item.code)} />
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
