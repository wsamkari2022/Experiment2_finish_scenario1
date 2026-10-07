/**
 * SessionLockScreen — shown in place of the study when it is open somewhere newer (since 29 September 2026;
 * sessionGuard.ts has the rules).
 *
 * Two cases, one calm message each. It never blames the participant: opening the study on a phone after
 * starting on a laptop is ordinary. The button is the researcher's "Q2-yes": the participant can bring the
 * study back HERE, but only by the safe route.
 *   - another browser or device: back through the start screen's email-and-age check, which makes this
 *     browser the active one and downloads the newest answers before anything is shown (in the Prolific door, since 6
 *     October 2026, its first page, which asks the age - the researcher's "1-B" after the audit);
 *   - another tab of this browser: this tab claims the study again and reloads, so it reads the newest
 *     answers the other tab saved.
 */

import { Box, Button, Center, Heading, Icon, Stack, Text } from "@chakra-ui/react";
import { LuMonitorSmartphone, LuLayers } from "react-icons/lu";
import type { LockReason } from "./sessionGuard";

export function SessionLockScreen({ reason, onContinueHere, prolificDoor = false }: {
  reason: LockReason;
  onContinueHere: () => void;
  /** The Prolific door asks nothing on the way back (its key is the Prolific ID). */
  prolificDoor?: boolean;
}) {
  const browser = reason === "browser";
  return (
    <Center minH="100dvh" bg="bg" px="4" py="10">
      <Box role="alertdialog" aria-labelledby="lock-title" aria-describedby="lock-text"
        maxW="lg" w="full" bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" shadow="lg"
        px={{ base: "6", md: "8" }} py={{ base: "7", md: "8" }}>
        <Stack gap="4" align="center" textAlign="center">
          <Center boxSize="14" rounded="full" bg="blue.subtle" color="blue.fg">
            <Icon boxSize="7">{browser ? <LuMonitorSmartphone /> : <LuLayers />}</Icon>
          </Center>
          <Heading id="lock-title" size="lg" color="fg">
            {browser ? "This study is open somewhere else" : "This study is open in another tab"}
          </Heading>
          <Text id="lock-text" color="fg.muted" lineHeight="tall">
            {browser
              ? "Your study was opened on another browser or device, so this window has stopped to keep your answers safe. Please continue there. Your answers so far are saved."
              : "To keep your answers safe, the study runs in one tab at a time, and it was opened in another tab of this browser. Please continue in that tab."}
          </Text>
          <Box pt="2" w="full">
            <Button onClick={onContinueHere} variant="outline" colorPalette="blue" rounded="lg" w={{ base: "full", sm: "auto" }} px="6">
              {browser ? "Continue here instead" : "Continue in this tab instead"}
            </Button>
            <Text fontSize="xs" color="fg.subtle" mt="2.5" lineHeight="tall">
              {browser
                ? prolificDoor
                  ? "You will be asked for your age again, and your newest answers will be brought here."
                  : "You will be asked for your email and age again, and your newest answers will be brought here."
                : "The other tab will stop, and this one will load your newest answers."}
            </Text>
          </Box>
        </Stack>
      </Box>
    </Center>
  );
}
