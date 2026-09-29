/**
 * Block5FeedbackNudge — the two reminders that the feedback is still to come: a "One last step" card
 * on the results page and a slim bar at the bottom of the screen on the results and charts pages.
 *
 * WHY THEY EXIST (28 September 2026, the researcher's plan answers "Q1-A, Q2-yes, Q3-yes, Q4-yes,
 * Q5-yes"). In the previous experiment participants reached the results page, took it for the end,
 * and never gave feedback. The page itself said so: a green "Complete" badge over "Main Simulation
 * Complete", and its only "Continue to feedback" button at the very bottom, after every scenario's
 * summary. The header now says "1 step left", these two carry the way on, and the progress bar marks
 * Feedback as next (GlobalStepper).
 *
 * HOW THEY BEHAVE, AND WHY
 *   - They INVITE and never warn: no red, no "Don't leave", no pop-up when the tab closes. The consent
 *     page promises the participant may stop at any time without consequence.
 *   - The card sits UNDER the four score cards ("Q1-A"), so everyone sees their main scores first -
 *     the advisor's design is results before feedback - and it asks them to look through their results
 *     first. The feedback asks them to rate "The final results page".
 *   - The gift-card sentence says what the consent page says: finishing the feedback completes the
 *     study, and the gift card needs a completed study. It does NOT say the feedback alone earns it,
 *     because the consent page names a second rule (the active minutes).
 *   - The bar shows only while neither the card nor a page's bottom button is on screen, so there is
 *     never a second button beside the first. It slides in, and nothing loops: the flag in the progress
 *     bar keeps the study's one looping animation.
 *   - Which button was used is recorded (resultsPageRecord.ts -> analysis.results_page).
 */

import { useEffect, useState, type Ref, type RefObject } from "react";
import { Box, Button, Center, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuArrowRight, LuMessageCircle } from "react-icons/lu";

/** The "One last step" card, placed under the four score cards on the results page. */
export function LastStepCard({ onContinue, ref }: { onContinue: () => void; ref?: Ref<HTMLDivElement> }) {
  return (
    <Box
      ref={ref}
      role="region"
      aria-label="One last step"
      bg="bg.panel"
      borderWidth="1.5px"
      borderColor="pink.muted"
      rounded="2xl"
      shadow="sm"
      px={{ base: "5", md: "6" }}
      py={{ base: "5", md: "5" }}
    >
      <Stack direction={{ base: "column", md: "row" }} gap={{ base: "4", md: "5" }} align={{ base: "stretch", md: "center" }}>
        <HStack gap="4" align="start" flex="1" minW="0">
          <Center boxSize="11" rounded="full" bg="pink.subtle" color="pink.fg" flexShrink={0}>
            <Icon boxSize="5"><LuMessageCircle /></Icon>
          </Center>
          <Box minW="0">
            <Text fontSize="md" fontWeight="semibold" color="fg" lineHeight="short">
              One last step: a few questions about your experience
            </Text>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall" mt="1">
              About 5 to 10 minutes. Answering them completes the study, which you need for
              your $5 gift card. Look through your results first; this button is also at the
              bottom of the page.
            </Text>
          </Box>
        </HStack>
        <Button onClick={onContinue} colorPalette="pink" rounded="lg" px="6" gap="2" flexShrink={0}
          alignSelf={{ base: "stretch", md: "center" }}>
          Continue to feedback
          <Icon><LuArrowRight /></Icon>
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * The slim bar at the bottom of the screen. `watch` holds the card and the page's own bottom button:
 * the bar shows only while none of them is on screen. Pass a stable array (useMemo), or the watching
 * starts again on every render.
 */
export function FeedbackBar({ watch, onContinue }: {
  watch: RefObject<HTMLElement | null>[]; onContinue: () => void;
}) {
  /* No way to tell what is on screen (a very old browser): the bar simply stays up. The pages keep
     room under their last button, so it covers nothing. */
  const [show, setShow] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const els = watch.map((r) => r.current).filter((e): e is HTMLElement => !!e);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const onScreen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) onScreen.set(e.target, e.isIntersecting);
      setShow(els.every((el) => onScreen.get(el) === false));
    });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [watch]);

  return (
    <Box
      role="region"
      aria-label="One step left"
      aria-hidden={!show}
      position="fixed"
      left="0"
      right="0"
      bottom="0"
      zIndex="20"
      bg="bg.panel"
      borderTopWidth="1px"
      borderColor="border"
      shadow="0 -6px 20px -12px rgba(0, 0, 0, 0.25)"
      backdropFilter="blur(10px)"
      px={{ base: "4", md: "6" }}
      pt="2.5"
      pb="calc(0.625rem + env(safe-area-inset-bottom, 0px))"
      transform={show ? "translateY(0)" : "translateY(110%)"}
      opacity={show ? 1 : 0}
      visibility={show ? "visible" : "hidden"}
      transition={show
        ? "transform 0.3s ease, opacity 0.3s ease, visibility 0s linear 0s"
        : "transform 0.3s ease, opacity 0.3s ease, visibility 0s linear 0.3s"}
      _motionReduce={{ transition: "none" }}
    >
      <HStack maxW="4xl" mx="auto" gap="3">
        <Icon color="pink.fg" boxSize="5" flexShrink={0}><LuMessageCircle /></Icon>
        <Text fontSize="sm" flex="1" minW="0" lineHeight="short">
          <Text as="span" fontWeight="semibold" color="fg">1 step left</Text>
          {/* One line on every screen: a phone gets "1 step left · feedback", wider screens the rest. */}
          <Text as="span" color="fg.muted">
            {" · "}feedback<Text as="span" display={{ base: "none", sm: "inline" }}> questions</Text>
            <Text as="span" display={{ base: "none", md: "inline" }}>, about 5 to 10 minutes</Text>
          </Text>
        </Text>
        <Button onClick={onContinue} size="sm" colorPalette="pink" rounded="lg" px="4" gap="1.5" flexShrink={0}
          tabIndex={show ? 0 : -1}>
          Continue
          <Icon><LuArrowRight /></Icon>
        </Button>
      </HStack>
    </Box>
  );
}
