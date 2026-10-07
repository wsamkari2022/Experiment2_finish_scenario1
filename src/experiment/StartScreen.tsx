/**
 * StartScreen.tsx — the first thing anyone sees, and the reason consent is never shown twice.
 *
 * THE PROBLEM IT SOLVES
 * Consent has to come before the study, and the email has to come before consent. That sounds
 * backwards until you ask what happens when somebody returns on a second day: to skip the consent
 * page you must already know who they are, and the only thing that identifies them is the email
 * they gave last time. Asking for it AFTER consent means a returning participant reads and signs
 * the form again every time — which is not just annoying, it corrupts the consent record, because
 * the second signature is not a second agreement to anything.
 *
 * So the address is collected here, in front of everything, and it decides which of four things
 * happens next.
 *
 *   NEW ADDRESS          -> consent, then the demographic form
 *   KNOWN, UNFINISHED    -> confirm it is really them, then resume exactly where they stopped
 *   KNOWN, FINISHED      -> stop. The study cannot be taken twice
 *   KNOWN, DETAILS WRONG -> "this email does not match the information provided previously"
 *
 * WHY THERE IS AN AGE CHECK
 * The email alone is a weak key: addresses are mistyped, shared, and guessed. Before handing
 * somebody an unfinished session — which contains another person's moral choices — the screen
 * asks for one detail only that person gave. One question is the most that can be asked before
 * the check becomes its own barrier, and age is the one people answer identically every time.
 *
 * A participant on their own machine never sees this screen: the flow resumes them silently. It
 * appears only when the browser does not recognise them, which is exactly the case the email is
 * for.
 *
 * THE AGE IS CHECKED BY THE SERVER (the audit of 6 October 2026, F2). The lookup used to bring the whole record,
 * age included, and this page compared the age itself - so anybody could read the age (and every answer) from the
 * server. Now the lookup says only "new / not finished / finished", the age goes to the server (signIn in
 * storage.ts), and the person's details and answers come down only when it matches.
 */

import { useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuArrowRight, LuCircleCheck, LuMail, LuSparkles, LuTriangleAlert } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { STATUS_COMPLETED, type DirectoryEntry } from "./participantDirectory";
import { findParticipant, signIn } from "./storage";

/** Same permissive test as the demographic page — catch typos, do not police addresses. */
const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/** What the screen is currently doing. */
type Mode =
  | { kind: "askEmail" }
  /** The address is known and unfinished; confirm the person (on the server) before resuming. */
  | { kind: "verify" }
  /** The address is known and the study is already finished. */
  | { kind: "finished" };

export function StartScreen({
  onNewParticipant,
  onResume,
  onFinishedSeen,
}: {
  /** A new address: carry it forward to consent and the demographic form. */
  onNewParticipant: (email: string) => void;
  /** A confirmed returning participant: resume at the stage they stopped on (`restored` files came down). */
  onResume: (entry: DirectoryEntry, restored: number) => void;
  /** The address has already finished: the condition this browser was just given is handed back (since 7 October 2026). */
  onFinishedSeen?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "askEmail" });
  const [ageAnswer, setAgeAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** True while the lookup is in flight. Local today; a server round trip once one exists. */
  const [checking, setChecking] = useState(false);

  const emailValid = looksLikeEmail(email);

  const handleContinue = async () => {
    if (!emailValid || checking) {
      if (!emailValid) setError("Please check this address — it does not look complete.");
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const entry = await findParticipant(email);
      if (!entry) {
        onNewParticipant(email.trim().toLowerCase());
        return;
      }
      if (entry.status === STATUS_COMPLETED) {
        setMode({ kind: "finished" });
        onFinishedSeen?.();
        return;
      }
      setMode({ kind: "verify" });
    } finally {
      setChecking(false);
    }
  };

  const handleVerify = async () => {
    if (mode.kind !== "verify" || checking) return;
    const given = Number.parseInt(ageAnswer, 10);
    if (Number.isNaN(given)) {
      setError("Please enter your age as a number.");
      return;
    }
    setError(null);
    setChecking(true);
    try {
      /* The server compares the age; only a match brings their details and answers down. */
      const result = await signIn(email.trim().toLowerCase(), given);
      if (!result.ok) {
        /* Requirement: the wording names the email, not the age, so a wrong guess does not
           tell the guesser which detail was wrong. */
        setError(result.reason === "mismatch"
          ? "This email does not match the information provided previously."
          : "We could not reach the study just now. Please try again in a moment.");
        return;
      }
      onResume(result.entry, result.restored);
    } finally {
      setChecking(false);
    }
  };

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
      <VStack
        gap={{ base: "6", md: "8" }}
        align="stretch"
        maxW="md"
        w="full"
        animationName="fade-in"
        animationDuration="moderate"
      >
        {/*
          THE WELCOME (since 3 October 2026, the researcher: "write a brief welcoming the user and show my study name
          'Human-AI Moral Value Decision-making Study' so the first page will a little bit nicer and not crowded and
          professional"; every condition sees this page). The study's name is the page's heading; a short welcome under
          it says what the study is about in the consent page's own terms (moral choices where every option costs
          something, a computer system that supports without pushing) and nothing the consent page does not say. The
          welcome is shown only while the email is asked for: a returning participant gets "Welcome back" in the card.
          "Start or continue" and its instruction moved INTO the card, so the page reads welcome first, task second.
          The study name on the consent page ("Study Title") and in the browser tab are separate decisions.
        */}
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
          <Heading
            as="h1"
            size={{ base: "2xl", md: "3xl" }}
            color="fg"
            letterSpacing="tight"
            lineHeight="short"
            data-study-name
          >
            {/* Two unbreakable halves, so the name never splits at a hyphen ("Decision-" / "making"): it reads
                "Human-AI Moral Value" / "Decision-making Study" when it needs two lines, and one line when it fits. */}
            <Text as="span" whiteSpace="nowrap">Human-AI Moral Value</Text>{" "}
            <Text as="span" whiteSpace="nowrap">Decision-making Study</Text>
          </Heading>
          {mode.kind === "askEmail" && (
            <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted" lineHeight="tall" maxW="md" data-welcome>
              Thank you for your interest in this study. It explores how people make moral choices when every
              option has a cost, and how a computer system can support those choices without telling you what to
              choose. There are no right or wrong answers.
            </Text>
          )}
        </VStack>

        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          rounded="2xl"
          p={{ base: "5", md: "6" }}
          shadow="sm"
        >
          {/* -------------------------------------------- THE CARD'S OWN TITLE (moved here 3 October 2026) */}
          {mode.kind !== "verify" && (
            <VStack align="start" gap="1" mb="5">
              <Heading as="h2" size="md" color="fg" letterSpacing="tight">
                {mode.kind === "finished" ? "You have already finished" : "Start or continue"}
              </Heading>
              {mode.kind === "askEmail" && (
                <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                  Enter your email to begin. If you have started before, this is how we find where you
                  stopped.
                </Text>
              )}
            </VStack>
          )}
          {/* ---------------------------------------------------------------- ASK FOR EMAIL */}
          {mode.kind === "askEmail" && (
            <VStack align="stretch" gap="5">
              <Field
                label="Email address"
                invalid={!!error}
                errorText={error || undefined}
                helperText="Used only to save your place and to send your gift card when you finish."
              >
                <Box position="relative" w="full">
                  <Box
                    position="absolute"
                    left="3"
                    top="50%"
                    transform="translateY(-50%)"
                    pointerEvents="none"
                    color="fg.subtle"
                    display="flex"
                  >
                    <Icon boxSize="4">
                      <LuMail />
                    </Icon>
                  </Box>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && emailValid) void handleContinue();
                    }}
                    pl="9"
                    rounded="lg"
                    color="fg"
                    size="lg"
                  />
                </Box>
              </Field>

              <Button
                size="lg"
                w="full"
                colorPalette="green"
                bg={emailValid ? "green.solid" : "bg.muted"}
                color={emailValid ? "green.contrast" : "fg.subtle"}
                _hover={emailValid ? { opacity: 0.92 } : {}}
                rounded="lg"
                fontWeight="semibold"
                gap="2"
                disabled={!emailValid || checking}
                loading={checking}
                loadingText="Checking"
                onClick={() => void handleContinue()}
              >
                Continue
                <Icon boxSize="4">
                  <LuArrowRight />
                </Icon>
              </Button>
            </VStack>
          )}

          {/* ------------------------------------------------------------------- VERIFY */}
          {mode.kind === "verify" && (
            <VStack align="stretch" gap="5">
              {/*
                The address is repeated back deliberately. A returning participant may not
                remember which of their addresses they used, and seeing the right one is the
                difference between "this is my session" and "whose session is this?" — which is
                the question the age check is about to ask them anyway.
              */}
              <Box
                bg="green.subtle"
                borderWidth="1px"
                borderColor="green.solid"
                rounded="xl"
                px="4"
                py="3.5"
              >
                <HStack gap="3" align="center">
                  <Icon boxSize="5" color="green.fg">
                    <LuCircleCheck />
                  </Icon>
                  <VStack align="start" gap="0.5" minW="0">
                    <Text fontSize="md" color="fg" fontWeight="bold" letterSpacing="tight">
                      Welcome back
                    </Text>
                    <Text
                      fontSize="sm"
                      color="green.fg"
                      fontWeight="semibold"
                      wordBreak="break-all"
                    >
                      {email.trim().toLowerCase()}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                We found your earlier session and can continue from exactly where you stopped —
                your answers are all still here. To confirm it is you, please enter your age.
              </Text>

              <Field label="Your age" invalid={!!error} errorText={error || undefined}>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Age"
                  value={ageAnswer}
                  onChange={(e) => {
                    setAgeAnswer(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleVerify();
                  }}
                  rounded="lg"
                  color="fg"
                  size="lg"
                  maxW="40"
                />
              </Field>

              <HStack gap="3">
                <Button
                  size="lg"
                  flex="1"
                  colorPalette="green"
                  bg="green.solid"
                  color="green.contrast"
                  _hover={{ opacity: 0.92 }}
                  rounded="lg"
                  fontWeight="semibold"
                  gap="2"
                  loading={checking}
                  loadingText="Checking"
                  onClick={() => void handleVerify()}
                >
                  Continue where I stopped
                  <Icon boxSize="4">
                    <LuArrowRight />
                  </Icon>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  color="fg.muted"
                  rounded="lg"
                  fontSize="sm"
                  onClick={() => {
                    setMode({ kind: "askEmail" });
                    setAgeAnswer("");
                    setError(null);
                  }}
                >
                  Back
                </Button>
              </HStack>
            </VStack>
          )}

          {/* ----------------------------------------------------------------- FINISHED */}
          {mode.kind === "finished" && (
            <VStack align="stretch" gap="4">
              <HStack gap="2.5" align="center">
                <Icon boxSize="4" color="fg.muted">
                  <LuTriangleAlert />
                </Icon>
                <Text fontSize="sm" color="fg" fontWeight="semibold">
                  This study has already been completed with this email
                </Text>
              </HStack>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                Thank you — your answers are already recorded, and the study can only be taken
                once. If you believe this is a mistake, please contact the researcher at{" "}
                <Text as="span" color="fg" fontWeight="semibold">
                  wsamkari2022@my.fit.edu
                </Text>
                .
              </Text>
              <Button
                size="sm"
                variant="outline"
                alignSelf="start"
                rounded="lg"
                color="fg.muted"
                onClick={() => {
                  setMode({ kind: "askEmail" });
                  setEmail("");
                  setError(null);
                }}
              >
                Use a different email
              </Button>
            </VStack>
          )}
        </Box>
      </VStack>
    </Box>
  );
}
