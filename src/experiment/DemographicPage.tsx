/**
 * DemographicPage.tsx — the second entry screen: who is taking part, and how to reach them.
 *
 * WHAT IT ASKS, AND WHAT IT DELIBERATELY DOES NOT
 * Age, gender, and email. That is all.
 *
 * The previous study's version also asked "Dealing with AI Systems" and "Experience with Moral
 * Reasoning" on five-point scales. Both are gone at the researcher's instruction. It is worth
 * recording why that is a defensible cut rather than a loss: neither fed any measure in this
 * study, and asking a participant to rate their own moral reasoning immediately before a moral
 * reasoning task primes exactly the self-consciousness the Block 5 instructions then spend a
 * paragraph trying to remove.
 *
 * THE EMAIL IS THE RETURN KEY, NOT AN AFTERTHOUGHT
 * This study runs 35-50 minutes and is explicitly allowed to be done across several sittings.
 * The email is how a participant is recognised when they come back on a different day or a
 * different machine, and how the gift card reaches them. Both reasons are stated ON the field,
 * not only in the consent document, because the consent page is read once and this is the moment
 * the address is actually typed.
 *
 * emailLocked / initialEmail
 * A start screen will eventually sit in FRONT of the consent page and ask for the email there,
 * so a returning participant can be recognised BEFORE consent is shown and never sees it twice.
 * When that screen exists it passes the address down here as `initialEmail` with
 * `emailLocked`, and this page shows it as confirmation rather than asking twice. Until then the
 * field is editable and this page is where the address is first captured.
 *
 * VALIDATION IS DELIBERATELY GENTLE
 * Nothing is marked wrong while it is being typed. Errors appear on blur, or when Continue is
 * pressed. A form that turns red on the second keystroke of an email address reads as an
 * accusation, and this is the first thing a participant does in the study.
 */

import { useMemo, useState } from "react";
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
import { LuArrowRight, LuCheck, LuLock, LuMail } from "react-icons/lu";
import { Field } from "@/components/ui/field";

/** The gender choices, in the order they are shown. */
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

/** The lowest age this study may enrol. Matches the consent document. */
const MIN_AGE = 18;
const MAX_AGE = 120;

/** What this page produces. Written to storage by the caller. */
export interface DemographicRecord {
  email: string;
  age: number;
  gender: Gender;
  submittedAt: string;
}

/**
 * Deliberately permissive.
 *
 * The job here is to catch a typo — a missing @, a stray space, a forgotten domain — not to
 * decide what a valid address looks like. Strict email patterns reject real addresses, and a
 * participant locked out of a study by a regular expression has no way to argue with it. The
 * real test of an address is whether the gift card arrives.
 */
const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export function DemographicPage({
  initialEmail = "",
  emailLocked = false,
  onSubmit,
}: {
  /** Pre-filled by the start screen once that exists. */
  initialEmail?: string;
  /** True when the address was already given and this page is only confirming it. */
  emailLocked?: boolean;
  onSubmit: (record: DemographicRecord) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");

  /** Which fields have been left once, so errors appear after the participant, not during. */
  const [touched, setTouched] = useState<{ email?: boolean; age?: boolean }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const ageNumber = Number.parseInt(age, 10);

  const emailError = useMemo(() => {
    if (!email.trim()) return "Please enter your email address.";
    if (!looksLikeEmail(email)) return "Please check this address — it does not look complete.";
    return null;
  }, [email]);

  const ageError = useMemo(() => {
    if (!age.trim()) return "Please enter your age.";
    if (Number.isNaN(ageNumber)) return "Please enter your age as a number.";
    if (ageNumber < MIN_AGE) return `You must be ${MIN_AGE} or older to take part.`;
    if (ageNumber > MAX_AGE) return "Please check this age.";
    return null;
  }, [age, ageNumber]);

  const genderError = gender ? null : "Please choose one.";
  const valid = !emailError && !ageError && !genderError;

  /* An error is shown only once the participant has moved on from the field, or pressed Continue. */
  const showEmailError = (touched.email || submitAttempted) && emailError;
  const showAgeError = (touched.age || submitAttempted) && ageError;
  const showGenderError = submitAttempted && genderError;

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!valid) return;
    onSubmit({
      email: email.trim().toLowerCase(),
      age: ageNumber,
      gender: gender as Gender,
      submittedAt: new Date().toISOString(),
    });
  };

  return (
    <Box
      minH="100dvh"
      bg="bg"
      px={{ base: "4", md: "6" }}
      py={{ base: "8", md: "12" }}
      display="flex"
      alignItems="flex-start"
      justifyContent="center"
    >
      <VStack
        gap={{ base: "6", md: "8" }}
        align="stretch"
        maxW="xl"
        w="full"
        animationName="fade-in"
        animationDuration="moderate"
      >
        {/* Header */}
        <VStack gap="2" textAlign="center">
          <Text
            fontSize="xs"
            fontWeight="bold"
            color="fg.subtle"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Before we begin
          </Text>
          <Heading size={{ base: "xl", md: "2xl" }} color="fg" letterSpacing="tight">
            A little about you
          </Heading>
          <Text fontSize="sm" color="fg.muted" maxW="md">
            Three short questions. Your answers are stored with your results and reported only as
            group data.
          </Text>
        </VStack>

        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          rounded="2xl"
          p={{ base: "5", md: "7" }}
        >
          <VStack align="stretch" gap="6">
            {/* EMAIL */}
            <Field
              label="Email address"
              invalid={!!showEmailError}
              errorText={showEmailError || undefined}
              helperText={
                emailLocked
                  ? "This is the address you started with."
                  : "Used to save your place if you leave, and to send your $5 gift card when you finish. Nothing else."
              }
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
                  <Icon boxSize="4">{emailLocked ? <LuLock /> : <LuMail />}</Icon>
                </Box>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  readOnly={emailLocked}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  pl="9"
                  rounded="lg"
                  bg={emailLocked ? "bg.subtle" : undefined}
                  color="fg"
                  size="lg"
                />
              </Box>
            </Field>

            {/* AGE */}
            <Field
              label="Age"
              invalid={!!showAgeError}
              errorText={showAgeError || undefined}
              helperText={`You must be ${MIN_AGE} or older to take part.`}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_AGE}
                max={MAX_AGE}
                placeholder="Enter your age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, age: true }))}
                rounded="lg"
                color="fg"
                size="lg"
                maxW="40"
              />
            </Field>

            {/* GENDER */}
            <Field
              label="Gender"
              invalid={!!showGenderError}
              errorText={showGenderError || undefined}
            >
              <HStack gap="2" wrap="wrap" w="full">
                {GENDER_OPTIONS.map((option) => {
                  const selected = gender === option;
                  return (
                    <Button
                      key={option}
                      size="sm"
                      variant="outline"
                      rounded="lg"
                      fontSize="xs"
                      fontWeight="semibold"
                      flex={{ base: "1 1 45%", sm: "0 0 auto" }}
                      borderWidth={selected ? "2px" : "1px"}
                      borderColor={selected ? "green.solid" : "border.emphasized"}
                      bg={selected ? "green.subtle" : "transparent"}
                      color={selected ? "green.fg" : "fg.muted"}
                      _hover={{ borderColor: selected ? "green.solid" : "border.emphasized", bg: selected ? "green.subtle" : "bg.subtle" }}
                      gap="1.5"
                      onClick={() => setGender(option)}
                    >
                      {selected && (
                        <Icon boxSize="3.5">
                          <LuCheck />
                        </Icon>
                      )}
                      {option}
                    </Button>
                  );
                })}
              </HStack>
            </Field>
          </VStack>
        </Box>

        <VStack align="stretch" gap="2">
          <Button
            size="lg"
            w="full"
            colorPalette="green"
            bg={valid ? "green.solid" : "bg.muted"}
            color={valid ? "green.contrast" : "fg.subtle"}
            _hover={valid ? { opacity: 0.92 } : {}}
            rounded="lg"
            fontWeight="semibold"
            gap="2"
            disabled={!valid}
            onClick={handleSubmit}
          >
            Start the study
            <Icon boxSize="4">
              <LuArrowRight />
            </Icon>
          </Button>
          {!valid && (
            <Text fontSize="xs" color="fg.subtle" textAlign="center">
              Please complete all three questions to continue.
            </Text>
          )}
        </VStack>
      </VStack>
    </Box>
  );
}
