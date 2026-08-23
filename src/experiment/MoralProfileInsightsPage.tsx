import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuChartBar } from "react-icons/lu";
import { deriveMoralProfile, describeScore } from "./profileAnalysis";
import type { MoralProfile } from "./profileAnalysis";
import { computeAIWorkforceAnalysis, type AIWorkforceAnalysis } from "./aiWorkforceAnalysis";
import { ProfileCalculationModal } from "./ProfileCalculationModal";
import {
  buildScenarioContext,
  selectDomain,
  selectSeedCase,
  type ScenarioContext,
  type SeedCase,
} from "./scenarioSelection";
import { SESSION_KEY_RESULTS } from "./constants";
import { TROLLEY_RESULTS_STORAGE_KEY } from "./trolleyTypes";
import { AI_WORKFORCE_RESULTS_KEY, type AIWorkforceBlockResults } from "./aiWorkforceTypes";
import type { MoneyBlockResults } from "./types";
import type { TrolleyBlockResults } from "./trolleyTypes";

import {
  SHOW_INTER_BLOCK_PAGES,
  useAutoAdvance,
} from "./interBlockPages";
import { InterBlockPause } from "./InterBlockPause";

/** localStorage key for the summarised insights payload (domain key + timestamp). */
const STORAGE_KEY_INSIGHTS = "moral_profile_insights";

/**
 * Props for MoralProfileInsightsPage.
 * onContinue receives the full profile + scenario context needed by Block 4.
 */
interface MoralProfileInsightsPageProps {
  participantId: string;
  onContinue: (payload: {
    profile: MoralProfile;
    seedCase: SeedCase;
    scenarioContext: ScenarioContext;
    analysis: AIWorkforceAnalysis | null;
  }) => void;
}

/** Safely reads and parses a JSON value from localStorage; returns null on any failure. */
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * MoralProfileInsightsPage — inter-block summary shown between Block 3 and Block 4.
 *
 * Reads completed results for Blocks 1–3 from localStorage, derives the MoralProfile
 * and AIWorkforceAnalysis, selects the seed case and Block 4 scenario context, and
 * presents a five-score pattern summary to the participant. The Continue button
 * forwards the derived data to ExperimentFlow for use in Block 4 and the Final Analysis.
 */
export function MoralProfileInsightsPage({
  participantId,
  onContinue,
}: MoralProfileInsightsPageProps) {
  /**
   * Derives the MoralProfile, seed case, domain, scenario context, and AI analysis from the
   * saved block results. Returns null if any required results are missing.
   *
   * A lazy `useState` initialiser rather than `useMemo(fn, [])`: both compute exactly once on
   * mount, but the state form says so honestly. `useMemo` is a performance hint that React is
   * free to discard and recompute, which is the wrong contract for a one-time read of an
   * external store — and it is what `react-hooks/preserve-manual-memoization` was objecting to.
   */
  const [data] = useState(() => {
    const money = readJson<MoneyBlockResults>(SESSION_KEY_RESULTS);
    const trolley = readJson<TrolleyBlockResults>(TROLLEY_RESULTS_STORAGE_KEY);
    const aiResults = readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY);
    if (!money || !trolley || !aiResults) return null;
    const profile = deriveMoralProfile(money, trolley, aiResults);
    const seedCase = selectSeedCase(profile);
    const domain = selectDomain(profile);
    const scenarioContext = buildScenarioContext(profile, domain);
    const analysis = computeAIWorkforceAnalysis(aiResults);
    return { profile, seedCase, domain, scenarioContext, analysis };
  });

  /**
   * Derived, not stored. `data` is computed synchronously above, so whether the earlier blocks
   * are missing is already known on the first render — there is nothing to wait for.
   *
   * There used to be a `loading` state initialised to true, plus an effect that set it false
   * (and set an error message) immediately after mount. That produced a spinner which was
   * painted for a single frame before being replaced, i.e. a loading indicator for work that
   * was already finished, and it was what tripped `react-hooks/set-state-in-effect`. Deriving
   * the message removes the state, the effect and the phantom spinner in one go.
   */
  const error = data
    ? null
    : "We could not load your earlier responses. Please refresh to try again.";

  /** Persists the derived snapshot for later blocks. Side effect only — no state updates. */
  useEffect(() => {
    if (!data) return;
    const payload = {
      participantId,
      profile: data.profile,
      seedCase: data.seedCase,
      domain: data.domain.key,
      generatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY_INSIGHTS, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [data, participantId]);

  /**
   * Hands Blocks 1-3's derived data to Block 4.
   *
   * Lifted out of the Continue button's onClick so that the human click and the automatic
   * advance below share ONE implementation. If they were separate, hiding the page could
   * silently forward a different payload than showing it does — the exact class of bug that
   * would be invisible until the data was analysed months later.
   */
  const handleContinue = useCallback(() => {
    if (!data) return;
    onContinue({
      profile: data.profile,
      seedCase: data.seedCase,
      scenarioContext: data.scenarioContext,
      analysis: data.analysis,
    });
  }, [data, onContinue]);

  /**
   * HIDDEN PAGE — presses Continue automatically.
   *
   * Deliberately placed AFTER the persist effect above: effects run in declaration order, so
   * the insights snapshot is guaranteed to be in LocalStorage before Block 4 begins. Every
   * derivation on this page still runs; only the display is suppressed. See interBlockPages.ts.
   */
  useAutoAdvance(!SHOW_INTER_BLOCK_PAGES && !!data, handleContinue);

  if (error || !data) {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px="6"
      >
        <Text color="fg.muted">{error ?? "Missing earlier responses."}</Text>
      </Box>
    );
  }

  /*
   * Hidden mode. Everything above has already happened — profile, seed case, domain and
   * scenario context are derived, the snapshot is saved, and the move to Block 4 is queued.
   * Only the reading of it is withheld from the participant.
   */
  if (!SHOW_INTER_BLOCK_PAGES) {
    return <InterBlockPause />;
  }

  const { profile, seedCase, domain } = data;

  return (
    <Box
      minH="100vh"
      bg="bg"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={{ base: "4", md: "6" }}
      py={{ base: "8", md: "12" }}
    >
      <VStack
        gap="8"
        align="stretch"
        maxW="3xl"
        w="full"
        animationName="fade-in"
        animationDuration="moderate"
      >
        <VStack gap="3" textAlign="center">
          <Heading size="2xl" color="fg" fontWeight="semibold">
            A brief look at your responses so far
          </Heading>
          <Text color="fg.muted" fontSize="lg" maxW="2xl" mx="auto">
            These are tentative observations, not conclusions. They are only
            meant to orient the next section.
          </Text>
        </VStack>

        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          rounded="2xl"
          p={{ base: "6", md: "8" }}
          shadow="lg"
        >
          <Heading size="md" mb="5" color="fg">
            Patterns we noticed
          </Heading>
          <Stack gap="4">
            <PatternRow
              label="Sensitivity to vulnerable contexts"
              level={describeScore(profile.vulnerabilitySensitivityScore)}
            />
            <PatternRow
              label="Reluctance to cause harm"
              level={describeScore(profile.harmReluctanceScore)}
            />
            <PatternRow
              label="Preference for indirect over direct action"
              level={describeScore(profile.directnessAversionScore)}
            />
            <PatternRow
              label="Responsiveness to the number of people affected"
              level={describeScore(profile.scaleSensitivityScore)}
            />
            <PatternRow
              label="Consistency across the blocks"
              level={describeScore(profile.consistencyAcrossDomainsScore)}
            />
          </Stack>
        </Box>

        {/* ── Calculation breakdown trigger ── */}
        <Box
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="xl"
          px={{ base: "5", md: "6" }}
          py="4"
          bg="bg.subtle"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap="4"
          flexWrap="wrap"
        >
          <HStack gap="3" flex="1" minW="0">
            <Icon color="fg.muted" flexShrink={0}>
              <LuChartBar />
            </Icon>
            <Box minW="0">
              <Text fontSize="sm" fontWeight="semibold" color="fg">
                Want to see how these scores were calculated?
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="0.5">
                Every formula, data point, and threshold — pulled directly from your responses.
              </Text>
            </Box>
          </HStack>
          <ProfileCalculationModal profile={profile} />
        </Box>

        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          rounded="2xl"
          p={{ base: "6", md: "8" }}
          shadow="lg"
        >
          <Heading size="md" mb="4" color="fg">
            One pattern worth revisiting
          </Heading>
          <Text color="fg" fontSize="md" lineHeight="tall">
            {seedCase.descriptor}.
          </Text>
          <Text color="fg.muted" fontSize="md" mt="3" fontStyle="italic">
            {seedCase.note}.
          </Text>
        </Box>

        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          rounded="2xl"
          p={{ base: "6", md: "8" }}
          shadow="lg"
        >
          <Heading size="md" mb="4" color="fg">
            What comes next
          </Heading>
          <Text color="fg" fontSize="md" lineHeight="tall">
            In the next section, you will consider a short scenario in the area
            of{" "}
            <Text as="span" fontWeight="semibold" color="blue.300">
              {domain.label}
            </Text>
            . You will make an initial decision, then hear from two people
            affected by it, and you will be invited to revisit your view.
          </Text>
          <Text color="fg.muted" fontSize="sm" mt="3" fontStyle="italic">
            There are no right or wrong answers, and changing your mind is
            encouraged if new information shifts how the question feels.
          </Text>
        </Box>

        <Button
          size="xl"
          onClick={handleContinue}
          colorPalette="blue"
          bg="blue.600"
          color="white"
          _hover={{ bg: "blue.500" }}
          rounded="lg"
          fontWeight="medium"
          alignSelf="center"
          px="10"
        >
          Continue
        </Button>
      </VStack>
    </Box>
  );
}

/**
 * Single row in the "Patterns we noticed" card.
 * `level` is one of "strong" | "moderate" | "mild" | "low" and drives the colour.
 */
function PatternRow({ label, level }: { label: string; level: string }) {
  const color =
    level === "strong"
      ? "green.300"
      : level === "moderate"
        ? "blue.300"
        : level === "mild"
          ? "yellow.300"
          : "gray.400";
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      pb="3"
      _last={{ borderBottomWidth: 0, pb: 0 }}
    >
      <Text color="fg.muted" fontSize="md">
        {label}
      </Text>
      <Text fontSize="md" fontWeight="semibold" color={color}>
        {level}
      </Text>
    </Box>
  );
}
