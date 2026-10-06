/**
 * NotYouLink.tsx — "This study is open for w•••@my.fit.edu · Not you?" (since 6 October 2026).
 *
 * The audit of 6 October 2026 and the researcher's "4-Yes": on a SHARED computer (a university lab) the browser
 * reopens the first student's run, or their thank-you page, and the next student had no way to start their own. This
 * thin strip at the top of the page appears only when the page OPENS with a university-door run already in the browser - exactly that
 * moment - names whose it is (masked, so the next student never sees the full address), and offers to start as
 * someone else, after a confirmation. It goes away once the person moves to another page (it is theirs), or with ×.
 *
 * Starting as someone else sets this browser's run aside (recruitment.ts, the same rule as a different Prolific ID):
 * the first student's answers stay on the server, and they continue later with their email and age. Their unsent
 * saves stay queued, each naming its owner. The Prolific door never shows this: a different Prolific ID in the link
 * already starts fresh.
 */

import { useEffect, useState } from "react";
import { Box, Button, HStack, Icon, Text, VStack, chakra } from "@chakra-ui/react";
import { LuUserRound, LuX } from "react-icons/lu";
import { maskEmail, setAsideThisBrowsersRun, universityRunHeld } from "./recruitment";
import { loginKindNoted } from "./sessionLog";

const STAGE_KEY = "experiment_flow_stage";
const readStage = () => {
  try {
    return localStorage.getItem(STAGE_KEY);
  } catch {
    return null;
  }
};

export function NotYouLink() {
  /* Read once, when the page opens: somebody who types their email later never sees it, and neither does somebody whose
     page was reloaded because they just proved who they are (email and age; found in the live check). This runs before
     the flow reads (and clears) that note. */
  const [held] = useState(() => (loginKindNoted() ? null : universityRunHeld()));
  const [openedOn] = useState(readStage);
  const [hidden, setHidden] = useState(false);
  const [confirming, setConfirming] = useState(false);

  /* The person moved on to another page: the run is theirs, the note goes. */
  useEffect(() => {
    if (!held || hidden) return;
    const timer = setInterval(() => {
      if (readStage() !== openedOn) setHidden(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [held, hidden, openedOn]);

  if (!held || hidden) return null;

  /*
   * A STRIP IN THE PAGE, NOT A FLOATING BOX (the live check of 6 October 2026: floating at the bottom it covered part of
   * Block 1's first answer button). It sits above the sticky progress bar, pushes the page down instead of covering it,
   * and scrolls away with the page; the right side stays clear of the light/dark button.
   */
  return (
    <Box
      data-not-you
      role="region"
      aria-label="Whose study this is"
      bg="bg.subtle"
      borderBottomWidth="1px"
      borderColor="border"
      ps={{ base: "4", md: "6" }}
      pe={{ base: "16", md: "20" }}
      py="2.5"
      animationName="fade-in"
      animationDuration="moderate"
    >
      <Box maxW="3xl" mx="auto">
      {!confirming ? (
        <HStack gap="3" align="center" justify="center">
          <Icon boxSize="4" color="fg.muted">
            <LuUserRound />
          </Icon>
          <Text fontSize="sm" color="fg.muted" minW="0">
            This study is open for{" "}
            <Text as="span" color="fg" fontWeight="semibold" overflowWrap="anywhere">
              {maskEmail(held)}
            </Text>
            .{" "}
            <chakra.button
              type="button"
              color="blue.fg"
              fontWeight="semibold"
              textDecoration="underline"
              textUnderlineOffset="2px"
              cursor="pointer"
              onClick={() => setConfirming(true)}
            >
              Not you?
            </chakra.button>
          </Text>
          <chakra.button
            type="button"
            aria-label="Close"
            color="fg.subtle"
            _hover={{ color: "fg" }}
            cursor="pointer"
            display="flex"
            onClick={() => setHidden(true)}
          >
            <Icon boxSize="4">
              <LuX />
            </Icon>
          </chakra.button>
        </HStack>
      ) : (
        <VStack align="stretch" gap="3" data-not-you-confirm>
          <Text fontSize="sm" color="fg" fontWeight="semibold">
            Start the study as someone else?
          </Text>
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">
            This computer will forget {maskEmail(held)}&apos;s place. Their answers stay saved, and they can continue
            later by entering their email.
          </Text>
          <HStack gap="2" justify="flex-end">
            <Button size="sm" variant="ghost" rounded="lg" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              rounded="lg"
              colorPalette="blue"
              onClick={() => {
                setAsideThisBrowsersRun();
                window.location.assign(`${window.location.origin}/`);
              }}
            >
              Start as someone else
            </Button>
          </HStack>
        </VStack>
      )}
      </Box>
    </Box>
  );
}
