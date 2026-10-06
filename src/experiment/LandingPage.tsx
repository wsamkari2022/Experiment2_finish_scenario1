/**
 * LandingPage.tsx — the first screen a new browser sees, for about a second (since 1 October 2026).
 *
 * It gives the participant one of the four conditions (conditions.ts) and then hands over to the start screen:
 *   - the address names a condition (`?condition=APA_Only`): the researcher is testing that one on purpose, so it is
 *     taken as it is and saved as "address", never counted for balance (his "Q2-yes");
 *   - otherwise the server is asked, and gives the condition with the fewest people (server/conditions.js; his
 *     "Q1-B" says who counts). The request carries an arrival id saved BEFORE it is sent, so a refresh here asks for
 *     the same arrival and is never counted twice;
 *   - no server (local testing without `npm run server`): a condition at random, saved as "random_offline".
 * The condition is then shown in the address bar, so the researcher can see which one he is in.
 *
 * MANY PEOPLE AT ONCE (since 6 October 2026, the advisor's "multiple sessions safe"). In a load test of 100 people
 * arriving together, 33 waited more than the 3 seconds this page used to allow and got an UNCOUNTED random condition.
 * Now the server serves a whole burst from one reading (server/conditions.js), the question is asked up to four times
 * with the same arrival id (requestCondition in storage.ts), a line after 8 seconds says it can take a little longer,
 * and ON THE LIVE SITE the page never picks at random: if the server cannot be reached at all, it says so and offers
 * "Try again", which opens the page afresh with the same arrival id (an answer the server already made is the one
 * given). In development, without the server, it still picks at random as before.
 *
 * TWO DOORS (since 6 October 2026; recruitment.ts). The page is told which door this person came through (the
 * university's, or /prolific), sends it with the question, and the server counts each door on its own (the
 * researcher's "2-A"). The door is kept in the condition file (`recruitmentSource`).
 *
 * Nothing on the screen names the condition: a participant never chooses it and never sees it on the page.
 */

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Heading, Icon, Spinner, Text, VStack } from "@chakra-ui/react";
import { LuRefreshCw, LuWifiOff } from "react-icons/lu";
import {
  CONDITION_ARRIVAL_KEY, conditionByNumber, conditionFromAddress, makeConditionFile, newArrivalId, randomCondition,
  showConditionInAddress, writeConditionFile, type ConditionFile,
} from "./conditions";
import { requestCondition } from "./storage";
import type { RecruitmentSource } from "./recruitment";

/** The live site never gives an uncounted random condition; development (no server) still does. */
const LIVE = import.meta.env.PROD;
/** After this long a second line says it can take a few more seconds. */
const SLOW_AFTER_MS = 8000;

/** The arrival id for this browser's request: the saved one after a refresh, otherwise a new one, saved first. */
function arrivalIdForThisBrowser(): string {
  try {
    const saved = localStorage.getItem(CONDITION_ARRIVAL_KEY);
    if (saved) return saved;
    const made = newArrivalId();
    localStorage.setItem(CONDITION_ARRIVAL_KEY, made);
    return made;
  } catch {
    return newArrivalId();
  }
}

/** The condition file, or null on the live site when the server could not be reached (the page offers "Try again"). */
async function chooseCondition(live: boolean, door: RecruitmentSource): Promise<ConditionFile | null> {
  const fromAddress = conditionFromAddress(window.location.search);
  if (fromAddress) return makeConditionFile(fromAddress, "address", null, "", undefined, door);
  const arrivalId = arrivalIdForThisBrowser();
  /* Live, the page waits for the whole server check (up to about half a minute when it keeps missing). */
  const given = await requestCondition(arrivalId, { waitMs: live ? 30_000 : 6000, recruitmentSource: door });
  const condition = given ? conditionByNumber(given.number) : null;
  if (given && condition) return makeConditionFile(condition, "landing_page", arrivalId, "", given.assignedAt, door);
  if (live) return null;
  return makeConditionFile(randomCondition(), "random_offline", null, "", undefined, door);
}

type Phase = "asking" | "slow" | "unreachable";

export function LandingPage({ onReady, door = "university" }: {
  onReady: (file: ConditionFile) => void;
  /** Which door this person came through (since 6 October 2026). */
  door?: RecruitmentSource;
}) {
  const [phase, setPhase] = useState<Phase>("asking");

  useEffect(() => {
    let cancelled = false;
    const slow = setTimeout(() => {
      if (!cancelled) setPhase("slow");
    }, SLOW_AFTER_MS);
    void chooseCondition(LIVE, door).then((file) => {
      if (cancelled) return;
      clearTimeout(slow);
      if (!file) {
        setPhase("unreachable");
        return;
      }
      writeConditionFile(file);
      try {
        localStorage.removeItem(CONDITION_ARRIVAL_KEY);
      } catch { /* ignore */ }
      showConditionInAddress(file);
      onReady(file);
    });
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, [onReady, door]);

  /* "Try again" opens the page afresh: the server check starts again at once (the page's own check would otherwise
     wait up to 15 seconds for its next look), and the arrival id saved in this browser is asked for again. */
  const tryAgain = useCallback(() => {
    window.location.reload();
  }, []);

  if (phase === "unreachable") {
    return (
      <Box minH="100dvh" bg="bg" display="flex" alignItems="center" justifyContent="center" px="4" py="10">
        <VStack
          data-landing-unreachable
          w="full"
          maxW="md"
          gap="5"
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          rounded="2xl"
          shadow="sm"
          p={{ base: "6", md: "8" }}
          animationName="fade-in"
          animationDuration="moderate"
        >
          <VStack gap="3" textAlign="center">
            <Box
              boxSize="12"
              rounded="full"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.emphasized"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="fg.muted"
            >
              <Icon boxSize="5">
                <LuWifiOff />
              </Icon>
            </Box>
            <Heading as="h1" size={{ base: "lg", md: "xl" }} color="fg" letterSpacing="tight">
              We could not reach the study
            </Heading>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              Your connection or our server may be busy for a moment. Nothing is lost, and your place is kept.
              Please try again.
            </Text>
          </VStack>
          <Button
            size="lg"
            w="full"
            colorPalette="blue"
            bg="blue.solid"
            color="blue.contrast"
            _hover={{ opacity: 0.92 }}
            rounded="lg"
            fontWeight="semibold"
            gap="2"
            onClick={tryAgain}
          >
            <Icon boxSize="4">
              <LuRefreshCw />
            </Icon>
            Try again
          </Button>
          <Text fontSize="xs" color="fg.subtle" textAlign="center" lineHeight="tall">
            If this keeps happening, please wait a minute and try again.
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box minH="100dvh" bg="bg" display="flex" alignItems="center" justifyContent="center" px="4">
      <VStack gap="4" textAlign="center" animationName="fade-in" animationDuration="moderate">
        <Spinner size="lg" color="blue.solid" borderWidth="3px" />
        <Text fontSize="md" color="fg" fontWeight="medium">
          Preparing your study…
        </Text>
        <Text data-landing-slow={phase === "slow" ? "" : undefined} fontSize="sm" color="fg.muted">
          {phase === "slow" ? "This can take a few more seconds." : "This takes a moment."}
        </Text>
      </VStack>
    </Box>
  );
}
