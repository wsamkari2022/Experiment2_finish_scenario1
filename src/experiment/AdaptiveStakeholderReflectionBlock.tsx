import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ProgressBar } from "./ProgressBar";
import type { MoralProfile } from "./profileAnalysis";
import type { AIWorkforceAnalysis } from "./aiWorkforceAnalysis";
import type { ScenarioContext, SeedCase } from "./scenarioSelection";
import {
  BLOCK4_SCENARIOS,
  pickPerspective,
  renderBlock4Scenario,
  selectBlock4Domain,
  type Block4ScenarioDomain,
  type StakeholderPerspectiveCard,
  type VignetteDirection,
} from "./vignetteLibrary";
import type { Block4DecisionRecord } from "./finalAnalysis";

/** Participant's binary policy choice: approve ("proceed") or reject ("do_not_proceed"). */
type Decision = "proceed" | "do_not_proceed";

/** Identifies one of the three sequential screens shown during Block 4. */
type StepKey = "initial_decision" | "perspective_one" | "perspective_two_final";

/** The three Block 4 screens in the order they are presented to the participant. */
const STEP_ORDER: StepKey[] = [
  "initial_decision",
  "perspective_one",
  "perspective_two_final",
];

/**
 * Complete payload emitted when Block 4 finishes.
 * Captures the scenario shown, all three decision snapshots, the two vignettes
 * displayed, which perspective the participant found most influential, and a
 * timestamp.
 */
export interface Block4CompletionPayload {
  seedCase: SeedCase;
  scenarioDomain: Block4ScenarioDomain;
  scenarioContext: ScenarioContext;
  decisions: Block4DecisionRecord;
  vignettesShown: { id: string; title: string; direction: string }[];
  mostInfluentialPerspective: string;
  completedAt: string;
  /** unified anonymous session id (= getSessionId()); the MongoDB join key. */
  participantId?: string;
}

/** Props for AdaptiveStakeholderReflectionBlock. */
interface Props {
  /** Unique identifier for the current study participant. */
  participantId: string;
  /** Participant's moral profile derived from earlier blocks. */
  profile: MoralProfile;
  /** AI workforce analysis computed from the participant's prior responses; may be null if unavailable. */
  analysis: AIWorkforceAnalysis | null;
  /** The seed case that anchors the scenario presented in this block. */
  seedCase: SeedCase;
  /** Contextual parameters (group size, industry, etc.) used to render the scenario text. */
  scenarioContext: ScenarioContext;
  /** Called with the completed payload once the participant finishes all three screens. */
  onContinue: (payload: Block4CompletionPayload) => void;
}

/**
 * Block 4 — Adaptive Stakeholder Reflection.
 *
 * Presents a policy scenario and guides the participant through three screens:
 *   1. Read the scenario and record an initial approve/reject decision + confidence.
 *   2. Read the first stakeholder perspective (challenges the initial choice) and record a mid-decision.
 *   3. Read the second stakeholder perspective (challenges the mid-decision) and record a
 *      final decision, final confidence, and which perspective was most influential.
 *
 * The block adapts the perspective vignettes to the participant's moral profile and prior
 * analysis, always selecting opposing-direction vignettes to maximise reflective tension.
 */
export function AdaptiveStakeholderReflectionBlock({
  participantId,
  profile,
  analysis,
  seedCase,
  scenarioContext,
  onContinue,
}: Props) {
  /** Index into STEP_ORDER; drives which of the three screens is currently rendered. */
  const [stepIndex, setStepIndex] = useState(0);

  /** Decision recorded before any stakeholder perspectives are shown (Screen 1). */
  const [initialDecision, setInitialDecision] = useState<Decision | null>(null);

  /** Self-reported confidence (1–5) associated with the initial decision. */
  const [initialConfidence, setInitialConfidence] = useState<number | null>(null);

  /** Decision recorded after the first stakeholder perspective (Screen 2). */
  const [midDecision, setMidDecision] = useState<Decision | null>(null);

  /** Decision recorded after both perspectives are shown (Screen 3). */
  const [finalDecision, setFinalDecision] = useState<Decision | null>(null);

  /** Self-reported confidence (1–5) associated with the final decision. */
  const [finalConfidence, setFinalConfidence] = useState<number | null>(null);

  /** Title of the stakeholder perspective the participant found most influential. */
  const [mostInfluential, setMostInfluential] = useState<string | null>(null);

  /**
   * Selects the Block 4 scenario domain based on the participant's profile and analysis.
   * Currently always resolves to "ai_workforce_rollout".
   */
  const scenarioDomain = useMemo(
    () => selectBlock4Domain(profile, analysis),
    [profile, analysis],
  );

  const scenarioTemplate = BLOCK4_SCENARIOS[scenarioDomain];

  /** Renders the scenario body text by injecting scenarioContext values into the domain template. */
  const scenarioBody = useMemo(
    () => renderBlock4Scenario(scenarioDomain, scenarioContext),
    [scenarioDomain, scenarioContext],
  );

  const groupSize = scenarioContext.groupSize as "small" | "medium" | "large";

  /**
   * Direction for the first perspective vignette.
   * Always opposes the participant's initial decision: if they approved, the first
   * perspective pushes toward rejection, and vice versa.
   */
  const firstDirection: VignetteDirection = useMemo(() => {
    if (!initialDecision) return "toward_rejection";
    return initialDecision === "proceed" ? "toward_rejection" : "toward_acceptance";
  }, [initialDecision]);

  /**
   * Direction for the second perspective vignette.
   * Always the opposite of firstDirection, so it challenges the mid-decision.
   */
  const secondDirection: VignetteDirection =
    firstDirection === "toward_rejection" ? "toward_acceptance" : "toward_rejection";

  /**
   * First stakeholder perspective card, selected from the vignette library to push in
   * firstDirection, tailored to the participant's profile and analysis.
   */
  const perspectiveOne = useMemo<StakeholderPerspectiveCard>(() => {
    return pickPerspective(
      scenarioDomain,
      firstDirection,
      groupSize,
      [],
      [],
      profile,
      analysis,
    );
  }, [scenarioDomain, firstDirection, groupSize, profile, analysis]);

  /**
   * Second stakeholder perspective card, selected to push in secondDirection.
   * Excludes perspectiveOne's id and role category to ensure variety.
   */
  const perspectiveTwo = useMemo<StakeholderPerspectiveCard>(() => {
    return pickPerspective(
      scenarioDomain,
      secondDirection,
      groupSize,
      [perspectiveOne.id],
      [perspectiveOne.roleCategory],
      profile,
      analysis,
    );
  }, [
    scenarioDomain,
    secondDirection,
    groupSize,
    perspectiveOne.id,
    perspectiveOne.roleCategory,
    profile,
    analysis,
  ]);

  /**
   * Assembles the Block4CompletionPayload from all collected state and calls onContinue.
   * Guards against incomplete state (missing finalDecision, finalConfidence, or mostInfluential).
   */
  const handleComplete = useCallback(() => {
    if (!finalDecision || !finalConfidence || !mostInfluential) return;
    // Map the most-influential perspective to how its voice is affected by the
    // participant's final decision: a rejection-leaning voice speaks for the harmed
    // workers; an acceptance-leaning voice speaks for the benefiting organisation.
    // This feeds the engine's secondary vulnerability / gain signals (Approved Change 5).
    const influentialDirection =
      mostInfluential === perspectiveOne.title ? firstDirection
        : mostInfluential === perspectiveTwo.title ? secondDirection
          : null;
    const influentialValence: "harmed" | "benefited" | null =
      influentialDirection === "toward_rejection" ? "harmed"
        : influentialDirection === "toward_acceptance" ? "benefited"
          : null;

    const decisions: Block4DecisionRecord = {
      initialDecision,
      midDecision,
      finalDecision,
      confidence: finalConfidence,
      initialConfidence: initialConfidence ?? undefined,
      reportedInfluence: !!mostInfluential,
      influentialValence,
    };
    const payload: Block4CompletionPayload = {
      seedCase,
      scenarioDomain,
      scenarioContext,
      decisions,
      vignettesShown: [
        { id: perspectiveOne.id, title: perspectiveOne.title, direction: firstDirection },
        { id: perspectiveTwo.id, title: perspectiveTwo.title, direction: secondDirection },
      ],
      mostInfluentialPerspective: mostInfluential,
      completedAt: new Date().toISOString(),
      participantId, // unified session id (MongoDB join key)
    };
    onContinue(payload);
  }, [
    participantId,
    initialDecision,
    initialConfidence,
    midDecision,
    finalDecision,
    finalConfidence,
    mostInfluential,
    seedCase,
    scenarioDomain,
    scenarioContext,
    perspectiveOne,
    perspectiveTwo,
    firstDirection,
    secondDirection,
    onContinue,
  ]);

  const currentStep = STEP_ORDER[stepIndex];

  /**
   * Routes rendering to the correct screen component based on the current STEP_ORDER entry.
   * Screen 1 → initial decision, Screen 2 → first perspective + mid-decision,
   * Screen 3 → second perspective + final decision.
   */
  const renderBody = () => {
    if (currentStep === "initial_decision") {
      return (
        <Screen1InitialDecision
          title={scenarioTemplate.title}
          body={scenarioBody}
          onSubmit={(d, conf) => {
            setInitialDecision(d);
            setInitialConfidence(conf);
            setStepIndex(1);
          }}
        />
      );
    }
    if (currentStep === "perspective_one") {
      return (
        <Screen2Perspective
          perspective={perspectiveOne}
          onSubmit={(d) => {
            setMidDecision(d);
            setStepIndex(2);
          }}
        />
      );
    }
    return (
      <Screen3FinalDecision
        perspective={perspectiveTwo}
        perspectiveOneTitle={perspectiveOne.title}
        perspectiveTwoTitle={perspectiveTwo.title}
        onSubmit={(d, conf, influential) => {
          setFinalDecision(d);
          setFinalConfidence(conf);
          setMostInfluential(influential);
        }}
        onComplete={handleComplete}
        finalDecision={finalDecision}
        finalConfidence={finalConfidence}
        mostInfluential={mostInfluential}
      />
    );
  };

  return (
    <Box
      minH="100vh"
      bg="bg"
      display="flex"
      alignItems="flex-start"
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
          <Badge colorPalette="blue" size="lg" rounded="full" px="3">
            Stakeholder Reflection
          </Badge>
          <Heading size="xl" color="fg" fontWeight="semibold">
            {scenarioTemplate.title}
          </Heading>
        </VStack>

        <ProgressBar total={STEP_ORDER.length} current={stepIndex} />

        {renderBody()}
      </VStack>
    </Box>
  );
}

// ─── Screen 1: Initial Decision ─────────────────────────────────────────────

/**
 * Screen 1 — Initial Decision.
 * Displays the scenario text, collects the participant's initial approve/reject
 * choice, then reveals a 1–5 confidence rating before advancing to Screen 2.
 */
function Screen1InitialDecision({
  title,
  body,
  onSubmit,
}: {
  /** Scenario title (used by the parent heading; passed here for potential reuse). */
  title: string;
  /** Rendered scenario body text shown to the participant. */
  body: string;
  /** Called with the chosen decision and confidence rating when the participant continues. */
  onSubmit: (d: Decision, confidence: number) => void;
}) {
  /** Participant's approve/reject selection on this screen. */
  const [decision, setDecision] = useState<Decision | null>(null);

  /** Participant's self-reported confidence (1–5) for the initial decision. */
  const [confidence, setConfidence] = useState<number | null>(null);

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      rounded="2xl"
      p={{ base: "6", md: "8" }}
      shadow="lg"
    >
      <VStack gap="6" align="stretch">
        <Heading size="md" color="fg" lineHeight="short">
          {title}
        </Heading>
        <Text color="fg" fontSize="md" lineHeight="tall">
          {body}
        </Text>

        <VStack gap="3" align="stretch">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            Would you approve the policy?
          </Text>
          <HStack gap="4" justify="center" wrap="wrap">
            <Button
              size="lg"
              bg={decision === "proceed" ? "green.600" : "green.subtle"}
              color={decision === "proceed" ? "white" : "green.fg"}
              _hover={{ bg: decision === "proceed" ? "green.700" : "green.muted" }}
              rounded="lg"
              px="8"
              borderWidth="1px"
              borderColor={decision === "proceed" ? "green.600" : "green.muted"}
              onClick={() => setDecision("proceed")}
            >
              Approve the policy
            </Button>
            <Button
              size="lg"
              bg={decision === "do_not_proceed" ? "red.600" : "red.subtle"}
              color={decision === "do_not_proceed" ? "white" : "red.fg"}
              _hover={{ bg: decision === "do_not_proceed" ? "red.700" : "red.muted" }}
              rounded="lg"
              px="8"
              borderWidth="1px"
              borderColor={decision === "do_not_proceed" ? "red.600" : "red.muted"}
              onClick={() => setDecision("do_not_proceed")}
            >
              Do not approve the policy
            </Button>
          </HStack>
        </VStack>

        {decision && (
          <VStack gap="3" align="stretch" animationName="fade-in" animationDuration="moderate">
            <Text fontSize="sm" fontWeight="medium" color="fg.muted">
              How confident are you? (1 = very unsure, 5 = very confident)
            </Text>
            <HStack gap="3" justify="center">
              {[1, 2, 3, 4, 5].map((v) => (
                <Button
                  key={v}
                  size="md"
                  minW="12"
                  onClick={() => setConfidence(v)}
                  bg={confidence === v ? "blue.600" : "blue.subtle"}
                  color={confidence === v ? "white" : "blue.fg"}
                  _hover={{ bg: confidence === v ? "blue.500" : "blue.muted" }}
                  rounded="lg"
                  borderWidth="1px"
                  borderColor={confidence === v ? "blue.600" : "blue.muted"}
                >
                  {v}
                </Button>
              ))}
            </HStack>
          </VStack>
        )}

        {decision && confidence && (
          <HStack justify="center" animationName="fade-in" animationDuration="moderate">
            <Button
              size="lg"
              colorPalette="blue"
              bg="blue.600"
              color="white"
              _hover={{ bg: "blue.500" }}
              rounded="lg"
              px="10"
              onClick={() => onSubmit(decision, confidence)}
            >
              Continue
            </Button>
          </HStack>
        )}
      </VStack>
    </Box>
  );
}

// ─── Screen 2: Stakeholder Perspective + Compact Decision ───────────────────

/**
 * Screen 2 — First Stakeholder Perspective.
 * Presents perspectiveOne (which challenges the participant's initial decision)
 * and immediately collects a mid-decision without a confidence rating.
 */
function Screen2Perspective({
  perspective,
  onSubmit,
}: {
  /** The first stakeholder perspective card to display. */
  perspective: StakeholderPerspectiveCard;
  /** Called with the participant's updated decision after reading the perspective. */
  onSubmit: (d: Decision) => void;
}) {
  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      rounded="2xl"
      p={{ base: "6", md: "8" }}
      shadow="lg"
    >
      <VStack gap="6" align="stretch">
        <VStack gap="2" align="stretch">
          <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
            A perspective to consider
          </Text>
          <Heading size="md" color="fg">
            {perspective.title}
          </Heading>
        </VStack>

        <Box
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="xl"
          px={{ base: "5", md: "6" }}
          py="5"
        >
          <Text color="fg" fontSize="md" lineHeight="tall" fontStyle="italic">
            {perspective.template}
          </Text>
        </Box>

        <VStack gap="3" align="stretch">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            Having heard this perspective, would you approve the policy?
          </Text>
          <HStack gap="4" justify="center" wrap="wrap">
            <Button
              size="lg"
              bg="green.700"
              color="white"
              _hover={{ bg: "green.600" }}
              rounded="lg"
              px="8"
              onClick={() => onSubmit("proceed")}
            >
              Approve the policy
            </Button>
            <Button
              size="lg"
              bg="red.700"
              color="white"
              _hover={{ bg: "red.600" }}
              rounded="lg"
              px="8"
              onClick={() => onSubmit("do_not_proceed")}
            >
              Do not approve
            </Button>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
}

// ─── Screen 3: Second Perspective + Final Decision + Confidence + Influence ─

/**
 * Screen 3 — Second Stakeholder Perspective + Final Decision.
 * Displays perspectiveTwo (which challenges the mid-decision), then sequentially
 * reveals: a final approve/reject choice, a 1–5 confidence rating, and a prompt
 * asking which perspective was most influential. Submits all data on completion.
 */
function Screen3FinalDecision({
  perspective,
  perspectiveOneTitle,
  perspectiveTwoTitle,
  onSubmit,
  onComplete,
  finalDecision,
  finalConfidence,
  mostInfluential,
}: {
  /** The second stakeholder perspective card to display. */
  perspective: StakeholderPerspectiveCard;
  /** Title of the first perspective, used as an influence option label. */
  perspectiveOneTitle: string;
  /** Title of the second perspective, used as an influence option label. */
  perspectiveTwoTitle: string;
  /** Called with the final decision, confidence, and most-influential choice when the participant submits. */
  onSubmit: (d: Decision, conf: number, influential: string) => void;
  /** Called immediately after onSubmit to trigger payload assembly and block completion. */
  onComplete: () => void;
  /** Controlled final decision value lifted from the parent (supports re-render stability). */
  finalDecision: Decision | null;
  /** Controlled final confidence value lifted from the parent. */
  finalConfidence: number | null;
  /** Controlled most-influential value lifted from the parent. */
  mostInfluential: string | null;
}) {
  const [decision, setDecision] = useState<Decision | null>(finalDecision);
  const [confidence, setConfidence] = useState<number | null>(finalConfidence);
  const [influential, setInfluential] = useState<string | null>(mostInfluential);

  const influenceOptions = [
    perspectiveOneTitle,
    perspectiveTwoTitle,
    "Neither changed my thinking much",
  ];

  const allSelected = decision && confidence && influential;

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      rounded="2xl"
      p={{ base: "6", md: "8" }}
      shadow="lg"
    >
      <VStack gap="6" align="stretch">
        <VStack gap="2" align="stretch">
          <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
            A second perspective
          </Text>
          <Heading size="md" color="fg">
            {perspective.title}
          </Heading>
        </VStack>

        <Box
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="xl"
          px={{ base: "5", md: "6" }}
          py="5"
        >
          <Text color="fg" fontSize="md" lineHeight="tall" fontStyle="italic">
            {perspective.template}
          </Text>
        </Box>

        <VStack gap="3" align="stretch">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            Your final decision: would you approve the policy?
          </Text>
          <HStack gap="4" justify="center" wrap="wrap">
            <Button
              size="lg"
              bg={decision === "proceed" ? "green.600" : "green.subtle"}
              color={decision === "proceed" ? "white" : "green.fg"}
              _hover={{ bg: decision === "proceed" ? "green.700" : "green.muted" }}
              rounded="lg"
              px="8"
              borderWidth="1px"
              borderColor={decision === "proceed" ? "green.600" : "green.muted"}
              onClick={() => setDecision("proceed")}
            >
              Approve the policy
            </Button>
            <Button
              size="lg"
              bg={decision === "do_not_proceed" ? "red.600" : "red.subtle"}
              color={decision === "do_not_proceed" ? "white" : "red.fg"}
              _hover={{ bg: decision === "do_not_proceed" ? "red.700" : "red.muted" }}
              rounded="lg"
              px="8"
              borderWidth="1px"
              borderColor={decision === "do_not_proceed" ? "red.600" : "red.muted"}
              onClick={() => setDecision("do_not_proceed")}
            >
              Do not approve
            </Button>
          </HStack>
        </VStack>

        {decision && (
          <VStack gap="3" align="stretch" animationName="fade-in" animationDuration="moderate">
            <Text fontSize="sm" fontWeight="medium" color="fg.muted">
              How confident are you? (1 = very unsure, 5 = very confident)
            </Text>
            <HStack gap="3" justify="center">
              {[1, 2, 3, 4, 5].map((v) => (
                <Button
                  key={v}
                  size="md"
                  minW="12"
                  onClick={() => setConfidence(v)}
                  bg={confidence === v ? "blue.600" : "blue.subtle"}
                  color={confidence === v ? "white" : "blue.fg"}
                  _hover={{ bg: confidence === v ? "blue.500" : "blue.muted" }}
                  rounded="lg"
                  borderWidth="1px"
                  borderColor={confidence === v ? "blue.600" : "blue.muted"}
                >
                  {v}
                </Button>
              ))}
            </HStack>
          </VStack>
        )}

        {decision && confidence && (
          <VStack gap="3" align="stretch" animationName="fade-in" animationDuration="moderate">
            <Text fontSize="sm" fontWeight="medium" color="fg.muted">
              Which perspective influenced you the most?
            </Text>
            <VStack gap="2" align="stretch">
              {influenceOptions.map((opt) => (
                <Button
                  key={opt}
                  size="md"
                  variant="outline"
                  justifyContent="flex-start"
                  textAlign="left"
                  bg={influential === opt ? "purple.600" : "purple.subtle"}
                  color={influential === opt ? "white" : "purple.fg"}
                  borderColor={influential === opt ? "purple.600" : "purple.muted"}
                  _hover={{ bg: influential === opt ? "purple.700" : "purple.muted" }}
                  rounded="lg"
                  px="5"
                  py="3"
                  h="auto"
                  whiteSpace="normal"
                  onClick={() => setInfluential(opt)}
                >
                  {opt}
                </Button>
              ))}
            </VStack>
          </VStack>
        )}

        {allSelected && (
          <Box
            animationName="fade-in"
            animationDuration="moderate"
            borderWidth="2px"
            borderColor="purple.400"
            bg="purple.subtle"
            rounded="xl"
            p={{ base: "4", md: "5" }}
            mt="1"
          >
            <Badge colorPalette="purple" variant="solid" rounded="md" mb="2" px="2">
              Final step
            </Badge>
            <Text fontWeight="semibold" color="fg" fontSize="md" mb="1">
              This is your final decision.
            </Text>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall" mb="4">
              Recording it saves your decision and confidence and continues to your profile.
              You won't be able to change it afterward.
            </Text>
            <Button
              size="lg"
              w="full"
              colorPalette="purple"
              bg="purple.solid"
              color="purple.contrast"
              _hover={{ opacity: 0.9 }}
              rounded="lg"
              fontWeight="semibold"
              onClick={() => {
                onSubmit(decision, confidence, influential);
                setTimeout(() => onComplete(), 50);
              }}
            >
              Record my final decision
            </Button>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
