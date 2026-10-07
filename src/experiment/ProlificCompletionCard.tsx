/**
 * ProlificCompletionCard.tsx — the Prolific completion code and the way back to Prolific (since 7 October 2026; Step 4 of
 * docs/PROLIFIC_CONVERSION_PLAN.md).
 *
 * The researcher's "1-A": a button, never an automatic jump, so the journey charts stay below and nobody is moved on
 * before they have the code. Shown on the final page of the Prolific door (UserFeedbackPage) and, after the age check, on
 * the Prolific first page of somebody who already finished on another device ("2-A", ProlificStartScreen).
 *
 * THE CODE IS NEVER IN THE PAGE'S CODE. Anyone can read a web page's JavaScript, so the code (and Prolific's completion
 * address, which contains it) comes only from the server (fetchCompletionCode in storage.ts), which gives it to the
 * browser holding a FINISHED Prolific record. Right after "Submit feedback" the completion may still be on its way, so
 * the card asks again every few seconds; without a server it keeps asking every 15 seconds and, after a minute, says what
 * to do. It never sends anybody anywhere by itself, and it is the same for everybody who finishes (every submission is
 * "Manually review" on Prolific; a rejection is decided in the review, never by withholding the code).
 */

import { useEffect, useState } from "react";
import { Box, Button, Clipboard, HStack, Icon, Spinner, Stack, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight, LuTicket } from "react-icons/lu";
import { ClipboardButton } from "@/components/ui/clipboard";
import { fetchCompletionCode, readSavedCompletionCode } from "./storage";

/** Ask again soon while the completion is on its way; less often while there is no server; speak up after a minute. */
const SOON_MS = 3_000;
const LATER_MS = 15_000;
const TELL_AFTER_MS = 60_000;

export function ProlificCompletionCard({ prolificId }: { prolificId: string }) {
  const [given, setGiven] = useState<{ code: string; url: string } | null>(() => {
    const saved = readSavedCompletionCode(prolificId);
    return saved ? { code: saved.code, url: saved.url } : null;
  });
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (given) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const ask = async () => {
      const answer = await fetchCompletionCode(prolificId);
      if (stopped) return;
      if (answer.kind === "ready") {
        setGiven({ code: answer.code, url: answer.url });
        return;
      }
      if (Date.now() - started >= TELL_AFTER_MS) setSlow(true);
      timer = setTimeout(() => void ask(), answer.kind === "waiting" ? SOON_MS : LATER_MS);
    };
    void ask();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [prolificId, given]);

  return (
    <Box
      data-prolific-completion
      w="full"
      maxW="xl"
      mx="auto"
      textAlign="left"
      rounded="2xl"
      borderWidth="2px"
      borderColor="green.solid"
      bg="bg.panel"
      shadow="md"
      p={{ base: "5", md: "6" }}
    >
      <HStack gap="2.5" mb="3.5" align="center">
        <Icon boxSize="4" color="green.fg">
          <LuTicket />
        </Icon>
        <Text fontSize="xs" fontWeight="bold" color="green.fg" textTransform="uppercase" letterSpacing="wider">
          Your Prolific completion code
        </Text>
      </HStack>

      {given ? (
        <VStack align="stretch" gap="4">
          <Clipboard.Root value={given.code}>
            {/* One line, always: on a 375px phone a code split over two lines could be copied by halves (seen in the
                live check), so on a narrow screen Copy goes under the code. */}
            <Stack
              direction={{ base: "column", sm: "row" }}
              justify="space-between"
              align={{ base: "stretch", sm: "center" }}
              gap="3"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border"
              rounded="xl"
              px={{ base: "4", md: "5" }}
              py="3"
            >
              <Text
                data-completion-code
                fontFamily="mono"
                fontSize={{ base: "2xl", md: "3xl" }}
                fontWeight="bold"
                letterSpacing={{ base: "wider", md: "widest" }}
                color="fg"
                whiteSpace="nowrap"
                overflowX="auto"
                textAlign={{ base: "center", sm: "start" }}
              >
                {given.code}
              </Text>
              <ClipboardButton flexShrink={0} />
            </Stack>
          </Clipboard.Root>
          <Button asChild size="lg" w="full" colorPalette="green" rounded="lg" fontWeight="semibold" gap="2">
            <a data-return-to-prolific href={given.url}>
              Return to Prolific
              <Icon boxSize="4">
                <LuArrowRight />
              </Icon>
            </a>
          </Button>
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">
            The button takes you back to Prolific with your code. You can also copy the code and paste it on Prolific
            yourself.
          </Text>
        </VStack>
      ) : (
        <VStack align="stretch" gap="2.5">
          <HStack gap="3" align="center">
            <Spinner size="sm" color="green.fg" flexShrink={0} />
            <Text fontSize="sm" color="fg" lineHeight="tall">
              Getting your code. It will appear here in a moment; please keep this page open.
            </Text>
          </HStack>
          {slow && (
            <Text data-completion-slow fontSize="sm" color="fg.muted" lineHeight="tall">
              This is taking longer than usual. Your answers are saved, and the code will appear here as soon as we
              reach the study. If it has not appeared after a few minutes, please send the researcher a message through
              Prolific with your Prolific ID.
            </Text>
          )}
        </VStack>
      )}
    </Box>
  );
}
