import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  Spinner,
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
import type { ProductLaunchBlockResults } from "./productLaunchTypes";

/** localStorage key for the summarised insights payload (domain key + timestamp). */
const STORAGE_KEY_INSIGHTS = "moral_profile_insights";
/** localStorage key for the Block 3 legacy product-launch shape written by AIWorkforceThresholdBlock. */
const PRODUCT_STORAGE_KEY = "product_launch_block_results";

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
  /** True while the profile is being derived from localStorage (shown as spinner). */
  const [loading, setLoading] = useState(true);
  /** Non-null if any required earlier block results are missing. */
  const [error, setError] = useState<string | null>(null);

  /**
   * Derives the MoralProfile, seed case, domain, scenario context, and AI analysis
   * from the saved block results. Returns null if any required results are missing.
   */
  const data = useMemo(() => {
    const money = readJson<MoneyBlockResults>(SESSION_KEY_RESULTS);
    const trolley = readJson<TrolleyBlockResults>(TROLLEY_RESULTS_STORAGE_KEY);
    const product = readJson<ProductLaunchBlockResults>(PRODUCT_STORAGE_KEY);
    if (!money || !trolley || !product) return null;
    const profile = deriveMoralProfile(money, trolley, product);
    const seedCase = selectSeedCase(profile);
    const domain = selectDomain(profile);
    const scenarioContext = buildScenarioContext(profile, domain);
    const aiResults = readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY);
    const analysis = aiResults ? computeAIWorkforceAnalysis(aiResults) : null;
    return { profile, seedCase, domain, scenarioContext, analysis };
  }, []);

  useEffect(() => {
    if (!data) {
      setError(
        "We could not load your earlier responses. Please refresh to try again.",
      );
      setLoading(false);
      return;
    }
    const payload = {
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
    setLoading(false);
  }, [data]);

  if (loading) {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <VStack gap="4">
          <Spinner size="lg" color="fg.muted" />
          <Text color="fg.muted" fontStyle="italic">
            Reviewing your responses so far...
          </Text>
        </VStack>
      </Box>
    );
  }

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

  const { profile, seedCase, domain, scenarioContext } = data;

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
          onClick={() =>
            onContinue({
              profile,
              seedCase,
              scenarioContext,
              analysis: data.analysis,
            })
          }
          bg="gray.900"
          color="white"
          _hover={{ bg: "gray.800" }}
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
