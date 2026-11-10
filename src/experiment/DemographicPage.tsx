/**
 * DemographicPage.tsx — the entry screen after consent: who is taking part.
 *
 * WHAT IT ASKS, AND WHAT IT DELIBERATELY DOES NOT
 * Age, gender, country (since 30 September 2026, the researcher's request; CountryField.tsx; asked as "Where are you
 * from?" since 4 October 2026, it was "Country") and "Is English your first language?" (Yes / No, since 4 October 2026,
 * the researcher's request; every condition sees this page). That is all.
 *
 * The previous study's version also asked "Dealing with AI Systems" and "Experience with Moral
 * Reasoning" on five-point scales. Both are gone at the researcher's instruction. It is worth
 * recording why that is a defensible cut rather than a loss: neither fed any measure in this
 * study, and asking a participant to rate their own moral reasoning immediately before a moral
 * reasoning task primes exactly the self-consciousness the Block 5 instructions then spend a
 * paragraph trying to remove.
 *
 * NO EMAIL. Prolific forbids asking for a participant's email, and their key is their Prolific ID, which the first page
 * brought (recruitment.ts). The email question went with the student group on 10 November 2026.
 *
 * VALIDATION IS DELIBERATELY GENTLE
 * Nothing is marked wrong while it is being typed. Errors appear on blur, or when Continue is
 * pressed. A form that turns red on the second keystroke reads as an accusation, and this is the first thing a
 * participant does in the study.
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
import { LuArrowRight, LuCheck } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { CountryField, type CountryValue } from "./CountryField";

/** The gender choices, in the order they are shown. */
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

/** "Is English your first language?" - the researcher's two answers, in his order (since 4 October 2026). */
const ENGLISH_OPTIONS = [{ label: "Yes", value: true }, { label: "No", value: false }] as const;

/** The lowest age this study may enrol. Matches the consent document. */
const MIN_AGE = 18;
const MAX_AGE = 120;

/** What this page produces. Written to storage by the caller. */
export interface DemographicRecord {
  age: number;
  gender: Gender;
  /** Their country, as its English name, or "Prefer not to say" (since 30 September 2026). */
  country: string;
  /** Its ISO 3166-1 alpha-2 code (XK for Kosovo); null for "Prefer not to say". */
  countryCode: string | null;
  /** "Is English your first language?": true = Yes, false = No (since 4 October 2026). */
  englishFirstLanguage: boolean;
  submittedAt: string;
}

export function DemographicPage({ onSubmit }: { onSubmit: (record: DemographicRecord) => void }) {
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [country, setCountry] = useState<CountryValue | null>(null);
  /** null until answered: the question has no default, so nobody is counted as "Yes" by not touching it. */
  const [englishFirst, setEnglishFirst] = useState<boolean | null>(null);

  /** Which fields have been left once, so errors appear after the participant, not during. */
  const [touched, setTouched] = useState<{ age?: boolean; country?: boolean }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const ageNumber = Number.parseInt(age, 10);

  const ageError = useMemo(() => {
    if (!age.trim()) return "Please enter your age.";
    if (Number.isNaN(ageNumber)) return "Please enter your age as a number.";
    if (ageNumber < MIN_AGE) return `You must be ${MIN_AGE} or older to take part.`;
    if (ageNumber > MAX_AGE) return "Please check this age.";
    return null;
  }, [age, ageNumber]);

  const genderError = gender ? null : "Please choose one.";
  const countryError = country ? null : "Please choose your country from the list, or “Prefer not to say”.";
  const englishError = englishFirst === null ? "Please choose Yes or No." : null;
  const valid = !ageError && !genderError && !countryError && !englishError;

  /* An error is shown only once the participant has moved on from the field, or pressed Continue. */
  const showAgeError = (touched.age || submitAttempted) && ageError;
  const showGenderError = submitAttempted && genderError;
  const showCountryError = (touched.country || submitAttempted) && countryError;
  const showEnglishError = submitAttempted && englishError;

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!valid) return;
    onSubmit({
      age: ageNumber,
      gender: gender as Gender,
      country: country?.name ?? "",
      countryCode: country?.code ?? null,
      englishFirstLanguage: englishFirst === true,
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
            Four short questions. Your answers are stored with your
            results and reported only as group data.
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

            {/* COUNTRY (since 30 September 2026; asked as "Where are you from?" since 4 October 2026 - it was "Country").
                The answer and its field names are unchanged (country, country_code). */}
            <Field
              label="Where are you from?"
              invalid={!!showCountryError}
              errorText={showCountryError || undefined}
              helperText="Type a few letters and pick it from the list."
            >
              <Box w="full">
                <CountryField
                  value={country}
                  onChange={setCountry}
                  onBlur={() => setTouched((t) => ({ ...t, country: true }))}
                  invalid={!!showCountryError}
                />
              </Box>
            </Field>

            {/* ENGLISH AS A FIRST LANGUAGE (since 4 October 2026, the researcher: "Is English your first language?"
                Yes/No). Required, with no default, and drawn like the gender buttons so the page has one way to pick. */}
            <Field
              label="Is English your first language?"
              invalid={!!showEnglishError}
              errorText={showEnglishError || undefined}
            >
              <HStack gap="2" w="full" data-english-first>
                {ENGLISH_OPTIONS.map((option) => {
                  const selected = englishFirst === option.value;
                  return (
                    <Button
                      key={option.label}
                      size="sm"
                      variant="outline"
                      rounded="lg"
                      fontSize="xs"
                      fontWeight="semibold"
                      flex={{ base: "1 1 0", sm: "0 0 auto" }}
                      minW={{ sm: "24" }}
                      borderWidth={selected ? "2px" : "1px"}
                      borderColor={selected ? "green.solid" : "border.emphasized"}
                      bg={selected ? "green.subtle" : "transparent"}
                      color={selected ? "green.fg" : "fg.muted"}
                      _hover={{ borderColor: selected ? "green.solid" : "border.emphasized", bg: selected ? "green.subtle" : "bg.subtle" }}
                      gap="1.5"
                      aria-pressed={selected}
                      onClick={() => setEnglishFirst(option.value)}
                    >
                      {selected && (
                        <Icon boxSize="3.5">
                          <LuCheck />
                        </Icon>
                      )}
                      {option.label}
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
              Please complete all four questions to continue.
            </Text>
          )}
        </VStack>
      </VStack>
    </Box>
  );
}
