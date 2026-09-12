/**
 * ActivePauseBadge.tsx — the "we noticed you stepped away" notice.
 *
 * WHY SHOW ANYTHING AT ALL
 * Time spent away is not counted toward the study. A participant who takes a phone call and comes
 * back deserves to know the clock stopped, rather than discovering at the end that twenty minutes
 * they thought they had never existed. Saying nothing would be cheaper and less honest.
 *
 * WHY IT SAYS SO LITTLE
 * It deliberately does NOT mention minutes, the clock, or the gift card. "You have been idle; this
 * time is not counted toward your 35 minutes" is not a notice, it is an instruction manual for
 * cheating — it tells somebody exactly what to do and how often. This says only that the study is
 * waiting, which is true, useful, and reveals no target.
 *
 * WHY IT IS BIG AND IN THE MIDDLE
 * A small mark in a corner is exactly what somebody returning to a tab does not look at. They look
 * at the middle of the screen. The point of the notice is that it is impossible to miss and
 * disappears the instant they do anything at all, so its size costs nothing.
 *
 * IT NEVER BLOCKS THE STUDY
 * `pointerEvents="none"` throughout: the notice cannot swallow a click meant for a button
 * underneath it, and the scrim behind it is decoration rather than a door. Any movement dismisses
 * it, including the movement of reaching for something to click.
 */

import { useEffect, useState } from "react";
import { Box, Heading, Icon, Text, VStack } from "@chakra-ui/react";
import { LuPause } from "react-icons/lu";
import { onPauseChange } from "./activeTime";

export function ActivePauseBadge() {
  const [paused, setPaused] = useState(false);

  useEffect(() => onPauseChange(setPaused), []);

  if (!paused) return null;

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      display="flex"
      alignItems="center"
      justifyContent="center"
      /* A light veil so the notice reads as being in front of the study rather than part of it.
         It is see-through: the participant can still see where they were. */
      bg="blackAlpha.400"
      backdropFilter="blur(2px)"
      pointerEvents="none"
      animationName="fade-in"
      animationDuration="moderate"
      px="4"
    >
      <VStack
        gap="4"
        bg="bg.panel"
        borderWidth="4px"
        borderColor="orange.solid"
        rounded="2xl"
        px={{ base: "8", md: "12" }}
        py={{ base: "8", md: "10" }}
        maxW="lg"
        textAlign="center"
        boxShadow="0 0 0 6px rgba(237, 137, 54, 0.25), 0 20px 50px rgba(0,0,0,0.35)"
      >
        <Box
          boxSize="16"
          rounded="full"
          bg="orange.subtle"
          display="flex"
          alignItems="center"
          justifyContent="center"
          /* The one moving thing on the notice, slow and low-amplitude — enough to catch the eye
             of somebody glancing back at the tab, not enough to feel like an alarm. */
          className="vrds-hint-breathe"
          css={{ "--hint-c": "rgba(237, 137, 54, 0.45)" }}
        >
          <Icon boxSize="8" color="orange.fg">
            <LuPause />
          </Icon>
        </Box>

        <Heading size={{ base: "xl", md: "2xl" }} color="fg" letterSpacing="tight">
          Paused
        </Heading>

        <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted" lineHeight="tall">
          Move your mouse, scroll, or press a key to continue where you left off.
        </Text>
      </VStack>
    </Box>
  );
}
