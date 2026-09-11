/**
 * ActivePauseBadge.tsx — the quiet "we noticed you stepped away" mark.
 *
 * WHY SHOW ANYTHING AT ALL
 * Time spent away is not counted toward the study. A participant who steps out for a phone call
 * and comes back deserves to know that, rather than discovering at the end that twenty minutes
 * they thought they had did not exist. Saying nothing would be cheaper and less honest.
 *
 * WHY IT SAYS SO LITTLE
 * It deliberately does NOT mention minutes, the clock, or the gift card. "You have been idle;
 * this time is not counted toward your 35 minutes" is not a notice, it is an instruction manual
 * for cheating: it tells somebody exactly what to do and how often. The badge says only that the
 * study is waiting, which is true and useful, and reveals no target.
 *
 * It is small, muted, and in a corner. A participant who is genuinely reading and happens to go
 * still for ninety seconds should notice it and move on, not feel told off.
 */

import { useEffect, useState } from "react";
import { Box, HStack, Icon, Text } from "@chakra-ui/react";
import { LuPause } from "react-icons/lu";
import { onPauseChange } from "./activeTime";

export function ActivePauseBadge() {
  const [paused, setPaused] = useState(false);

  useEffect(() => onPauseChange(setPaused), []);

  if (!paused) return null;

  return (
    <Box
      position="fixed"
      bottom={{ base: "4", md: "6" }}
      left="50%"
      transform="translateX(-50%)"
      zIndex="banner"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.emphasized"
      rounded="full"
      px="4"
      py="2"
      shadow="md"
      animationName="fade-in"
      animationDuration="moderate"
      pointerEvents="none"
    >
      <HStack gap="2.5" align="center">
        <Icon boxSize="3.5" color="fg.muted">
          <LuPause />
        </Icon>
        <Text fontSize="xs" color="fg.muted" fontWeight="medium" whiteSpace="nowrap">
          Paused — move your mouse or scroll to continue
        </Text>
      </HStack>
    </Box>
  );
}
