/**
 * StudyErrorBoundary.tsx — the safety net under the whole study.
 *
 * WHAT IT IS FOR
 * If any component throws while rendering, React unmounts the entire tree. With nothing to catch
 * that, the participant is left looking at a blank white page, 30 minutes into a study, with no
 * button, no message, and no way to carry on. They close the tab, and that session is gone.
 *
 * This catches the error and puts a page in front of them instead: what happened, that their
 * answers are safe, and a button that carries on.
 *
 * WHY "CONTINUE" IS SAFE, AND WHY IT IS A RELOAD
 * Every answer is written to the browser as it is given, and the current screen is written with
 * it. So reloading returns the participant to the screen they were on with everything they have
 * already answered intact. The reload is the point: it rebuilds the app from stored state, which
 * is exactly what clears whatever bad in-memory state caused the crash.
 *
 * IT MUST NEVER CLEAR ANYTHING.
 * The instinct when something breaks is to reset it. Here that instinct would delete the
 * participant's work and their place in the study — turning a recoverable hiccup into the exact
 * loss this component exists to prevent. It only ever reads.
 *
 * A class component on purpose: React provides no hook equivalent of componentDidCatch.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Heading, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { LuLifeBuoy, LuRefreshCw } from "react-icons/lu";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  /** Kept for the researcher, shown in small print. Participants are not asked to read it. */
  componentStack: string | null;
}

/** Where the last crash is recorded, so it can be found after the participant has moved on. */
export const CRASH_LOG_KEY = "vrds_last_crash";

export class StudyErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });

    /*
     * Leave a note behind. A participant who hits this will not report it, and the session they
     * were in carries on afterwards as if nothing happened — so without a record there is nothing
     * to find later. Written defensively: a boundary that throws while handling an error would
     * take the page down in the one place that is supposed to be unbreakable.
     */
    try {
      localStorage.setItem(
        CRASH_LOG_KEY,
        JSON.stringify({
          message: error.message,
          stack: error.stack ?? null,
          componentStack: info.componentStack ?? null,
          stage: localStorage.getItem("experiment_flow_stage"),
          at: new Date().toISOString(),
        }),
      );
    } catch {
      /* ignore */
    }
    console.error("[study] recovered from a render error:", error);
  }

  private handleContinue = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box
        minH="100dvh"
        bg="bg"
        px={{ base: "4", md: "6" }}
        py={{ base: "10", md: "16" }}
        display="flex"
        alignItems="flex-start"
        justifyContent="center"
      >
        <VStack gap="6" align="stretch" maxW="lg" w="full">
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
              mx="auto"
              color="fg.muted"
            >
              <Icon boxSize="5">
                <LuLifeBuoy />
              </Icon>
            </Box>
            <Heading size={{ base: "lg", md: "xl" }} color="fg" letterSpacing="tight">
              Something went wrong on this page
            </Heading>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              This is our fault, not yours, and nothing you have done has been lost. Your answers
              and your place in the study are saved. Press the button below to carry on from where
              you were.
            </Text>
          </VStack>

          <Button
            size="lg"
            w="full"
            colorPalette="green"
            bg="green.solid"
            color="green.contrast"
            _hover={{ opacity: 0.92 }}
            rounded="lg"
            fontWeight="semibold"
            gap="2"
            onClick={this.handleContinue}
          >
            <Icon boxSize="4">
              <LuRefreshCw />
            </Icon>
            Continue where I left off
          </Button>

          <Text fontSize="xs" color="fg.subtle" textAlign="center" lineHeight="tall">
            If this keeps happening, please contact the researcher at wsamkari2022@my.fit.edu and
            mention what you were doing when it appeared.
          </Text>

          {/* Small print for the researcher. A participant has no reason to read it, and it is
              styled so it does not invite them to. */}
          <Box borderTopWidth="1px" borderColor="border.subtle" pt="3">
            <HStack gap="2" align="start">
              <Text fontSize="2xs" color="fg.subtle" fontFamily="mono" lineHeight="tall">
                {this.state.error.message}
              </Text>
            </HStack>
          </Box>
        </VStack>
      </Box>
    );
  }
}
