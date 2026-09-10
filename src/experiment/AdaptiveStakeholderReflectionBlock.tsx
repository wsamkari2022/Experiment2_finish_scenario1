import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Image,
  Separator,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuMessageSquare, LuMessagesSquare, LuScale } from "react-icons/lu";
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
import { useScrollToTop } from "./useScrollToTop";

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
 * analysis, always selecting opposing-direction vignettes to maximize reflective tension.
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

  // Each of the three screens opens at the top of the page.
  useScrollToTop(stepIndex);

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
    // workers; an acceptance-leaning voice speaks for the benefiting organization.
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
/* ─── Artwork ──────────────────────────────────────────────────────────────── */

/**
 * The Block 4 figures, and which screen each belongs to.
 *
 * WHY THE PERSPECTIVE IMAGE IS CHOSEN BY `direction` AND NOT BY SCREEN NUMBER
 * --------------------------------------------------------------------------
 * Which perspective appears first is not fixed: the first vignette always OPPOSES the
 * participant's initial decision (see `firstDirection`), so a participant who approves meets the
 * harmed person first, and one who rejects meets the manager first. Pinning the kneeling figure to
 * screen 2 would therefore have shown roughly half the sample a picture that contradicted the words
 * beside it.
 *
 * `toward_rejection` is the harm side of the library (worker losing hours, family of an affected
 * worker); `toward_acceptance` is the benefit side (operations manager, HR leader). The two
 * pictures follow that, so the figure always matches the voice.
 */
const FIGURE = {
  question: `${import.meta.env.BASE_URL}block4/main-question.webp`,
  toward_rejection: `${import.meta.env.BASE_URL}block4/harm.webp`,
  toward_acceptance: `${import.meta.env.BASE_URL}block4/benefit.webp`,
} as const;

const FIGURE_ALT: Record<VignetteDirection, string> = {
  toward_rejection: "Someone affected by the policy, appealing to the person deciding",
  toward_acceptance: "A manager making the case for the policy to the person deciding",
};

/**
 * A figure on its own plate.
 *
 * WHY THE PLATE IS DARK IN BOTH COLOR MODES. The artwork is white line-art on a transparent
 * background. On the light theme's `bg.panel` it would be white-on-white and effectively invisible,
 * so the plate cannot follow the theme — it has to guarantee the contrast itself. The screen's own
 * accent returns as a glow at the top, which ties the picture to the panel beside it without
 * putting the interface's color behind a figure that is supposed to read as a person.
 *
 * `aria-hidden` and an empty alt where the picture is decorative: on the perspective screens the
 * words carry the meaning, and a screen reader announcing the illustration would interrupt them.
 */
function Block4Figure({ src, alt, accent, minH }: {
  src: string;
  /** Empty string marks the image decorative, which hides it from assistive technology. */
  alt: string;
  /** Hex accent for the glow — the screen's own color. */
  accent: string;
  minH?: Record<string, string> | string;
}) {
  return (
    <Box
      rounded="2xl"
      overflow="hidden"
      borderWidth="1px"
      minH={minH ?? { base: "180px", sm: "170px" }}
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="3"
      py="4"
      style={{
        background:
          `radial-gradient(115% 85% at 50% 0%, ${accent}40 0%, transparent 62%),`
          + " linear-gradient(160deg, #131e31 0%, #1d2b45 100%)",
        borderColor: `${accent}59`,
        boxShadow: `0 10px 26px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255,255,255,0.07)`,
      }}
    >
      {/* `contain` inside a stretched plate: the figure grows to whatever height the text column
          sets, keeps its proportions, and never crops. The cap stops a very long scenario from
          inflating the picture past the point where it reads as an illustration. */}
      <Image
        src={src}
        alt={alt}
        aria-hidden={alt === "" ? true : undefined}
        w="full"
        h="full"
        maxH={{ base: "190px", sm: "290px" }}
        objectFit="contain"
        style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" }}
      />
    </Box>
  );
}

/** Accent per screen — matches the teal/orange the two perspective panels already use. */
const ACCENT_QUESTION = "#60a5fa";
const ACCENT_HARMSIDE = "#14b8a6";
const ACCENT_BENEFIT = "#f97316";

function Screen1InitialDecision({
  body,
  onSubmit,
}: {
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
        {/*
          NO TITLE HERE. The page header above this card already prints the scenario title, centered
          and at size xl. Repeating it inside the card put a second, smaller, left-aligned copy
          directly beneath the first, which read as the page having two competing headings.
        */}
        <HStack gap="2" color="blue.fg">
          <Icon boxSize="4"><LuScale /></Icon>
          <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
            The decision in front of you
          </Text>
        </HStack>

        {/* The scenario reads first; the figure sits beside it on a wide screen and beneath it on a
            narrow one, so the text is never pushed below the fold by the picture.
            `align="center"` rather than `stretch`: the picture is shorter than a long scenario, and
            stretching its plate to match left a tall empty band beside the last line of text. */}
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "5", md: "7" }}
          align={{ base: "stretch", md: "center" }}
        >
          <Text
            flex="1 1 auto"
            minW="0"
            color="fg"
            fontSize={{ base: "md", md: "lg" }}
            lineHeight="1.85"
          >
            {body}
          </Text>
          <Box flex="0 0 auto" w={{ base: "full", md: "220px" }} alignSelf="center">
            <Block4Figure src={FIGURE.question} alt="" accent={ACCENT_QUESTION} />
          </Box>
        </Stack>

        <Separator borderColor="border" />

        <VStack gap="4" align="stretch">
          <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="fg" textAlign="center">
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
            <Separator borderColor="border" />
            <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="fg" textAlign="center">
              How confident are you?{" "}
              <Text as="span" fontWeight="normal" color="fg.muted">
                1 = very unsure · 5 = very confident
              </Text>
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
  /** Mid-decision (select-then-Continue, matching Screens 1 & 3 for a consistent feel). */
  const [decision, setDecision] = useState<Decision | null>(null);

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
          <HStack gap="2" color="teal.fg">
            <Icon boxSize="4"><LuMessageSquare /></Icon>
            <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
              A perspective to consider
            </Text>
          </HStack>
          <Heading size="md" color="fg">
            {perspective.title}
          </Heading>
        </VStack>

        {/* First perspective — TEAL box, visually distinct from the amber second perspective.
            The figure sits to its left so the picture reads as the person saying the words. */}
        <Stack direction={{ base: "column", sm: "row" }} gap={{ base: "4", sm: "5" }} align="stretch">
          <Box flex="0 0 auto" w={{ base: "full", sm: "196px" }}>
            <Block4Figure
              src={FIGURE[perspective.direction]}
              alt={FIGURE_ALT[perspective.direction]}
              accent={perspective.direction === "toward_rejection" ? ACCENT_HARMSIDE : ACCENT_BENEFIT}
              minH={{ base: "190px", sm: "100%" }}
            />
          </Box>
          <Box
            flex="1 1 auto"
            minW="0"
            bg="teal.subtle"
            borderWidth="1px"
            borderColor="teal.muted"
            borderLeftWidth="4px"
            borderLeftColor="teal.solid"
            rounded="xl"
            px={{ base: "5", md: "6" }}
            py="5"
            display="flex"
            alignItems="center"
          >
            <Text color="fg" fontSize="md" lineHeight="tall" fontStyle="italic">
              {perspective.template}
            </Text>
          </Box>
        </Stack>

        <VStack gap="3" align="stretch">
          <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="fg" textAlign="center">
            Having heard this perspective, would you approve the policy?
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
          <HStack justify="center" animationName="fade-in" animationDuration="moderate">
            <Button
              size="lg"
              colorPalette="blue"
              bg="blue.600"
              color="white"
              _hover={{ bg: "blue.500" }}
              rounded="lg"
              px="10"
              onClick={() => onSubmit(decision)}
            >
              Continue
            </Button>
          </HStack>
        )}
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
          <HStack gap="2" color="orange.fg">
            <Icon boxSize="4"><LuMessagesSquare /></Icon>
            <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
              A second, different perspective
            </Text>
          </HStack>
          <Heading size="md" color="fg">
            {perspective.title}
          </Heading>
        </VStack>

        {/* Second perspective — AMBER box, visually distinct from the teal first perspective.
            Mirrored layout: this figure sits to the RIGHT, so the two voices face each other
            across the two screens rather than lining up on the same side. */}
        <Stack direction={{ base: "column", sm: "row" }} gap={{ base: "4", sm: "5" }} align="stretch">
          <Box
            flex="1 1 auto"
            minW="0"
            bg="orange.subtle"
            borderWidth="1px"
            borderColor="orange.muted"
            borderLeftWidth="4px"
            borderLeftColor="orange.solid"
            rounded="xl"
            px={{ base: "5", md: "6" }}
            py="5"
            display="flex"
            alignItems="center"
          >
            <Text color="fg" fontSize="md" lineHeight="tall" fontStyle="italic">
              {perspective.template}
            </Text>
          </Box>
          <Box flex="0 0 auto" w={{ base: "full", sm: "196px" }}>
            <Block4Figure
              src={FIGURE[perspective.direction]}
              alt={FIGURE_ALT[perspective.direction]}
              accent={perspective.direction === "toward_rejection" ? ACCENT_HARMSIDE : ACCENT_BENEFIT}
              minH={{ base: "190px", sm: "100%" }}
            />
          </Box>
        </Stack>

        <VStack gap="3" align="stretch">
          <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="fg" textAlign="center">
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
            <Separator borderColor="border" />
            <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="fg" textAlign="center">
              How confident are you?{" "}
              <Text as="span" fontWeight="normal" color="fg.muted">
                1 = very unsure · 5 = very confident
              </Text>
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
            <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="fg" textAlign="center">
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
