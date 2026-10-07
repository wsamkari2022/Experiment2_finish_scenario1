/**
 * ProlificStartScreen.tsx — the first page of the Prolific door (since 6 October 2026; recruitment.ts).
 *
 * The researcher's answers: "2-A" a welcome page with the participant's Prolific ID and a Start button (the same
 * welcome and study name as the university door's first page, StartScreen.tsx, so both doors look like one study).
 * A returning participant continued with no question ("1-A") until the audit of 6 October 2026 (F2): a Prolific ID alone
 * then opened a record, and Prolific IDs travel in links. Since then ("1-B") somebody continuing on ANOTHER device gives
 * their age, which the server checks (signIn in storage.ts) before anything comes down. On their own device the run is
 * already there and this page never shows.
 *
 * Nobody types an email here. The ID comes in the link (PROLIFIC_PID); the page looks it up and shows one of:
 *   NEW            -> "Your Prolific ID ✓" and Start, then consent and "A little about you" (four questions)
 *   KNOWN, UNFINISHED -> "Welcome back", their age, and Continue where I stopped (checked by the server; only then does
 *                        this browser take the record and the answers come down)
 *   KNOWN, FINISHED   -> "You have already finished"; their age (checked by the server, as above) shows the completion
 *                        code again (since 7 October 2026, Step 4, the researcher's "2-A": somebody who lost it can still
 *                        submit on Prolific)
 *   NO ID IN THE LINK -> a box to paste it (letters and digits); it is then written into the address, so a refresh keeps it
 *
 * The welcome's words are the university page's, word for word (validate:session C13 holds the two together).
 */

import { useEffect, useState } from "react";
import { Box, Button, Heading, HStack, Icon, Input, Spinner, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight, LuBadgeCheck, LuCircleCheck, LuSparkles, LuTriangleAlert } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { STATUS_COMPLETED, type DirectoryEntry } from "./participantDirectory";
import { findParticipant, readSavedCompletionCode, signIn, whenServerKnown } from "./storage";
import { ProlificCompletionCard } from "./ProlificCompletionCard";
import { addressWithProlificId, normalizeProlificId, writeProlificFile, type ProlificParams } from "./recruitment";

type Mode =
  | { kind: "paste" }
  | { kind: "checking" }
  | { kind: "new" }
  | { kind: "resume" }
  | { kind: "finished" };

export function ProlificStartScreen({
  params,
  onNewParticipant,
  onResume,
}: {
  /** Prolific's three values from the link (pid null when missing or malformed). */
  params: ProlificParams;
  /** A new Prolific participant: carry the ID forward to consent and the demographic page. */
  onNewParticipant: (prolificId: string) => void;
  /** A returning one, after the server checked their age: resume where they stopped (`restored` files came down). */
  onResume: (entry: DirectoryEntry, restored: number) => void;
}) {
  const [pid, setPid] = useState<string | null>(params.pid);
  const [mode, setMode] = useState<Mode>(params.pid ? { kind: "checking" } : { kind: "paste" });
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ageAnswer, setAgeAnswer] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  /* Finished on another device: the age is checked, then the code is shown again (since 7 October 2026, "2-A"). A
     browser that was already given the code for this person (after that check, or on finishing) shows it at once. */
  const [showCode, setShowCode] = useState(() => !!params.pid && readSavedCompletionCode(params.pid) !== null);

  /* Look the ID up as soon as it is known: new, unfinished or finished. */
  useEffect(() => {
    if (!pid) return;
    let cancelled = false;
    /* Only once the page knows whether there is a server: asked earlier, it would find nobody in this browser. */
    void whenServerKnown().then(() => findParticipant(pid)).then((entry) => {
      if (cancelled) return;
      if (!entry) setMode({ kind: "new" });
      else if (entry.status === STATUS_COMPLETED) setMode({ kind: "finished" });
      else setMode({ kind: "resume" });
    });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  /* The study and submission ids go with the person to the demographic page, where their record is made. */
  const keepProlificIds = (id: string) => writeProlificFile({ owner: id, studyId: params.studyId, sessionId: params.sessionId });

  /* The age goes to the server; only a match brings their details and answers down (the researcher's "1-B"). */
  const continueWithAge = async () => {
    if (!pid || signingIn) return;
    const given = Number.parseInt(ageAnswer, 10);
    if (Number.isNaN(given)) {
      setError("Please enter your age as a number.");
      return;
    }
    setError(null);
    setSigningIn(true);
    try {
      const result = await signIn(pid, given);
      if (!result.ok) {
        setError(result.reason === "mismatch"
          ? "This does not match the information given before. Please check your age."
          : "We could not reach the study just now. Please try again in a moment.");
        return;
      }
      keepProlificIds(pid);
      onResume(result.entry, result.restored);
    } finally {
      setSigningIn(false);
    }
  };

  /* The same age check (signIn), for somebody who already finished: this browser then holds the record, and the server
     gives it the code. Nothing of the run comes down (a finished run keeps no resume state). */
  const showCodeAfterAge = async () => {
    if (!pid || signingIn) return;
    const given = Number.parseInt(ageAnswer, 10);
    if (Number.isNaN(given)) {
      setError("Please enter your age as a number.");
      return;
    }
    setError(null);
    setSigningIn(true);
    try {
      const result = await signIn(pid, given);
      if (!result.ok) {
        setError(result.reason === "mismatch"
          ? "This does not match the information given before. Please check your age."
          : "We could not reach the study just now. Please try again in a moment.");
        return;
      }
      setShowCode(true);
    } finally {
      setSigningIn(false);
    }
  };

  const submitPasted = () => {
    const id = normalizeProlificId(typed);
    if (!id) {
      setError("Please check this ID: it should be letters and numbers only, as Prolific shows it.");
      return;
    }
    setError(null);
    try {
      window.history.replaceState(window.history.state, "", addressWithProlificId(window.location.href, id));
    } catch { /* the address keeps its old form; the study still runs */ }
    setMode({ kind: "checking" });
    setPid(id);
  };

  const cardTitle =
    mode.kind === "resume" ? "Welcome back"
      : mode.kind === "finished" ? "You have already finished"
        : mode.kind === "paste" ? "Your Prolific ID"
          : "Start";

  return (
    <Box
      minH="100dvh"
      bg="bg"
      px={{ base: "4", md: "6" }}
      py={{ base: "10", md: "16" }}
      display="flex"
      alignItems="flex-start"
      justifyContent="center"
      data-prolific-start
    >
      <VStack gap={{ base: "6", md: "8" }} align="stretch" maxW="md" w="full" animationName="fade-in" animationDuration="moderate">
        {/* The same welcome and study name as the university door's first page (StartScreen.tsx). */}
        <VStack gap="3" textAlign="center" px={{ base: "1", md: "2" }}>
          <HStack
            gap="1.5"
            px="3"
            py="1"
            rounded="full"
            bg="bg.muted"
            color="fg.muted"
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="wider"
            textTransform="uppercase"
          >
            <Icon boxSize="3.5">
              <LuSparkles />
            </Icon>
            Welcome
          </HStack>
          <Heading as="h1" size={{ base: "2xl", md: "3xl" }} color="fg" letterSpacing="tight" lineHeight="short" data-study-name>
            <Text as="span" whiteSpace="nowrap">Human-AI Moral Value</Text>{" "}
            <Text as="span" whiteSpace="nowrap">Decision-making Study</Text>
          </Heading>
          {mode.kind !== "resume" && mode.kind !== "finished" && (
            <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted" lineHeight="tall" maxW="md" data-welcome>
              Thank you for your interest in this study. It explores how people make moral choices when every
              option has a cost, and how a computer system can support those choices without telling you what to
              choose. There are no right or wrong answers.
            </Text>
          )}
        </VStack>

        <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "6" }} shadow="sm">
          <Heading as="h2" size="md" color="fg" letterSpacing="tight" mb="4">
            {cardTitle}
          </Heading>

          {/* ------------------------------------------------------------ THE ID, ONCE KNOWN */}
          {pid && mode.kind !== "paste" && (
            <Box
              data-prolific-id
              bg={mode.kind === "finished" ? "bg.subtle" : "green.subtle"}
              borderWidth="1px"
              borderColor={mode.kind === "finished" ? "border.emphasized" : "green.solid"}
              rounded="xl"
              px="4"
              py="3"
              mb="4"
            >
              <HStack gap="3" align="center">
                <Icon boxSize="5" color={mode.kind === "finished" ? "fg.muted" : "green.fg"}>
                  <LuBadgeCheck />
                </Icon>
                <VStack align="start" gap="0" minW="0">
                  <Text fontSize="xs" color="fg.muted" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
                    Your Prolific ID
                  </Text>
                  <Text fontSize="sm" color="fg" fontFamily="mono" fontWeight="semibold" wordBreak="break-all">
                    {pid}
                  </Text>
                </VStack>
              </HStack>
            </Box>
          )}

          {mode.kind === "checking" && (
            <HStack gap="2.5" color="fg.muted" fontSize="sm">
              <Spinner size="sm" color="blue.solid" />
              <Text>Finding your place in the study…</Text>
            </HStack>
          )}

          {mode.kind === "new" && (
            <VStack align="stretch" gap="5">
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                Your Prolific ID came with the link from Prolific, so there is nothing to type. Press Start when you
                are ready.
              </Text>
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
                onClick={() => {
                  if (!pid) return;
                  keepProlificIds(pid);
                  onNewParticipant(pid);
                }}
              >
                Start
                <Icon boxSize="4">
                  <LuArrowRight />
                </Icon>
              </Button>
            </VStack>
          )}

          {mode.kind === "resume" && (
            <VStack align="stretch" gap="5">
              <HStack gap="2.5" align="start">
                <Icon boxSize="4" color="green.fg" mt="0.5">
                  <LuCircleCheck />
                </Icon>
                <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                  We found your earlier session and can continue from exactly where you stopped. Your answers are all
                  still here. To confirm it is you, please enter your age.
                </Text>
              </HStack>
              <Field label="Your age" invalid={!!error} errorText={error || undefined}>
                <Input
                  data-prolific-age
                  type="number"
                  inputMode="numeric"
                  placeholder="Age"
                  value={ageAnswer}
                  onChange={(e) => {
                    setAgeAnswer(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void continueWithAge();
                  }}
                  rounded="lg"
                  color="fg"
                  size="lg"
                  maxW="40"
                />
              </Field>
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
                loading={signingIn}
                loadingText="Checking"
                onClick={() => void continueWithAge()}
              >
                Continue where I stopped
                <Icon boxSize="4">
                  <LuArrowRight />
                </Icon>
              </Button>
            </VStack>
          )}

          {mode.kind === "finished" && (
            <VStack align="stretch" gap="3">
              <HStack gap="2.5" align="center">
                <Icon boxSize="4" color="fg.muted">
                  <LuTriangleAlert />
                </Icon>
                <Text fontSize="sm" color="fg" fontWeight="semibold">
                  This study has already been completed with this Prolific ID
                </Text>
              </HStack>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                Thank you, your answers are already recorded, and the study can only be taken once. If you believe
                this is a mistake, please send the researcher a message through Prolific.
              </Text>
              {pid && showCode ? (
                <ProlificCompletionCard prolificId={pid} />
              ) : (
                <VStack align="stretch" gap="4" pt="1">
                  <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                    Need your completion code again? To confirm it is you, please enter your age.
                  </Text>
                  <Field label="Your age" invalid={!!error} errorText={error || undefined}>
                    <Input
                      data-prolific-finished-age
                      type="number"
                      inputMode="numeric"
                      placeholder="Age"
                      value={ageAnswer}
                      onChange={(e) => {
                        setAgeAnswer(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void showCodeAfterAge();
                      }}
                      rounded="lg"
                      color="fg"
                      size="lg"
                      maxW="40"
                    />
                  </Field>
                  <Button
                    size="lg"
                    w="full"
                    variant="outline"
                    rounded="lg"
                    fontWeight="semibold"
                    gap="2"
                    loading={signingIn}
                    loadingText="Checking"
                    onClick={() => void showCodeAfterAge()}
                  >
                    Show my completion code
                  </Button>
                </VStack>
              )}
            </VStack>
          )}

          {mode.kind === "paste" && (
            <VStack align="stretch" gap="5">
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                The link did not include your Prolific ID. Please paste it here; you can find it in your Prolific
                account.
              </Text>
              <Field label="Prolific ID" invalid={!!error} errorText={error || undefined}>
                <Input
                  data-prolific-paste
                  placeholder="Letters and numbers, as Prolific shows it"
                  value={typed}
                  autoComplete="off"
                  spellCheck={false}
                  fontFamily="mono"
                  onChange={(e) => {
                    setTyped(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitPasted();
                  }}
                  rounded="lg"
                  color="fg"
                  size="lg"
                />
              </Field>
              <Button
                size="lg"
                w="full"
                colorPalette="green"
                bg={typed.trim() ? "green.solid" : "bg.muted"}
                color={typed.trim() ? "green.contrast" : "fg.subtle"}
                _hover={typed.trim() ? { opacity: 0.92 } : {}}
                rounded="lg"
                fontWeight="semibold"
                gap="2"
                disabled={!typed.trim()}
                onClick={submitPasted}
              >
                Continue
                <Icon boxSize="4">
                  <LuArrowRight />
                </Icon>
              </Button>
            </VStack>
          )}
        </Box>
      </VStack>
    </Box>
  );
}
