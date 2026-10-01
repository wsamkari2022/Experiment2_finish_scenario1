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
 * Nothing on the screen names the condition: a participant never chooses it and never sees it on the page.
 */

import { useEffect } from "react";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";
import {
  CONDITION_ARRIVAL_KEY, conditionByNumber, conditionFromAddress, makeConditionFile, newArrivalId, randomCondition,
  showConditionInAddress, writeConditionFile, type ConditionFile,
} from "./conditions";
import { requestCondition } from "./storage";

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

async function chooseCondition(): Promise<ConditionFile> {
  const fromAddress = conditionFromAddress(window.location.search);
  if (fromAddress) return makeConditionFile(fromAddress, "address", null, "");
  const arrivalId = arrivalIdForThisBrowser();
  const given = await requestCondition(arrivalId);
  const condition = given ? conditionByNumber(given.number) : null;
  if (given && condition) return makeConditionFile(condition, "landing_page", arrivalId, "", given.assignedAt);
  return makeConditionFile(randomCondition(), "random_offline", null, "");
}

export function LandingPage({ onReady }: { onReady: (file: ConditionFile) => void }) {
  useEffect(() => {
    let cancelled = false;
    void chooseCondition().then((file) => {
      if (cancelled) return;
      writeConditionFile(file);
      try {
        localStorage.removeItem(CONDITION_ARRIVAL_KEY);
      } catch { /* ignore */ }
      showConditionInAddress(file);
      onReady(file);
    });
    return () => {
      cancelled = true;
    };
  }, [onReady]);

  return (
    <Box minH="100dvh" bg="bg" display="flex" alignItems="center" justifyContent="center" px="4">
      <VStack gap="4" textAlign="center" animationName="fade-in" animationDuration="moderate">
        <Spinner size="lg" color="blue.solid" borderWidth="3px" />
        <Text fontSize="md" color="fg" fontWeight="medium">
          Preparing your study…
        </Text>
        <Text fontSize="sm" color="fg.muted">
          This takes a moment.
        </Text>
      </VStack>
    </Box>
  );
}
