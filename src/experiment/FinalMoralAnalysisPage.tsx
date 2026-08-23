import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Badge,
  Box,
  Button,
  Heading,
  Icon,
  Separator,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuArrowRight, LuRotateCcw } from "react-icons/lu";
import { generateFinalAnalysis, type FinalAnalysis } from "./finalAnalysis";
import type { MoralProfile } from "./profileAnalysis";
import type { Block4CompletionPayload } from "./AdaptiveStakeholderReflectionBlock";
import { buildThresholdTree } from "./thresholdTree";
import { RankedThresholdTree } from "./RankedThresholdTree";
import { FEEDBACK_ARCHIVE_KEY } from "./feedbackTypes";
import {
  AI_WORKFORCE_RESULTS_KEY,
  WORKER_GROUPS,
  WORKER_GROUP_SIZES,
  aiWorkforceThresholdKeyFor,
  type AIWorkforceBlockResults,
} from "./aiWorkforceTypes";

import {
  SHOW_INTER_BLOCK_PAGES,
  useAutoAdvance,
} from "./interBlockPages";
import { InterBlockPause } from "./InterBlockPause";

/** localStorage key used to persist the final analysis payload once it has been generated. */
const STORAGE_KEY_FINAL = "final_moral_analysis";

/**
 * Props for FinalMoralAnalysisPage.
 * All analysis text is derived from `profile` and `block4.decisions` at render time.
 */
interface Props {
  participantId: string;
  profile: MoralProfile;
  block4: Block4CompletionPayload;
  onStartBlock5?: () => void;
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

/** Reusable titled card panel used for each section of the analysis page. */
function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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
      <Heading size="md" mb="4" color="fg">
        {title}
      </Heading>
      {children}
    </Box>
  );
}

/**
 * Renders the Block 3 threshold matrix as a readable table grouped by worker type.
 * Each cell shows the minimum gain level at which the participant approved, or a
 * descriptive label if the threshold was beyond range or blocked.
 */
function ThresholdRecap({ results }: { results: AIWorkforceBlockResults }) {
  return (
    <Stack gap="3">
      {WORKER_GROUPS.map((gt) => (
        <Box key={gt.key}>
          <Text fontSize="sm" fontWeight="semibold" color="fg" mb="1.5">
            {gt.shortLabel}
          </Text>
          <Stack gap="2">
            {WORKER_GROUP_SIZES.map((gs) => {
              const key = aiWorkforceThresholdKeyFor(gt.key, gs.key);
              const r = results.thresholds[key];
              let text = "—";
              let tone: "ok" | "range" | "blocked" = "ok";
              if (!r) {
                text = "—";
                tone = "blocked";
              } else if (r.blockedByPriorNonAcceptance) {
                text = "Blocked by prior non-acceptance";
                tone = "blocked";
              } else if (r.thresholdBeyondRange || !r.accepted) {
                text = "No acceptance within range";
                tone = "range";
              } else {
                text = r.thresholdGainLabel ?? "—";
              }
              return (
                <Box
                  key={key}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                  pb="2"
                  _last={{ borderBottomWidth: 0, pb: 0 }}
                >
                  <Text fontSize="sm" color="fg.muted">
                    {gs.shortLabel}
                  </Text>
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    color={
                      tone === "ok"
                        ? "green.300"
                        : tone === "blocked"
                          ? "gray.500"
                          : "orange.300"
                    }
                    fontStyle={tone === "blocked" ? "italic" : "normal"}
                  >
                    {text}
                  </Text>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

/**
 * Wipes all localStorage and sessionStorage to reset the experiment for a fresh run,
 * but PRESERVES the append-only feedback archive so previously-completed participants'
 * data on a shared device is never lost before it can be exported.
 */
function clearAllSessionData() {
  try {
    const archive = localStorage.getItem(FEEDBACK_ARCHIVE_KEY);
    localStorage.clear();
    if (archive) localStorage.setItem(FEEDBACK_ARCHIVE_KEY, archive);
  } catch {
    // ignore
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

/**
 * FinalMoralAnalysisPage — the closing page of the experiment.
 *
 * Synthesises the MoralProfile from Blocks 1–3 with the Block 4 decision record to
 * produce the full FinalAnalysis text and the ranked ThresholdTree. All seven sections
 * are shown sequentially in PanelCard wrappers. The page persists the analysis to
 * localStorage once on mount, and offers a "Start Over" button that wipes all session
 * data and reloads the page.
 */
export function FinalMoralAnalysisPage({
  profile,
  block4,
  onStartBlock5,
}: Props) {
  /** Clears all session data and reloads so the participant can run the experiment again. */
  const handleStartOver = useCallback(() => {
    clearAllSessionData();
    window.location.reload();
  }, []);
  /** Full plain-language analysis derived from profile + Block 4 decisions. */
  const analysis: FinalAnalysis = useMemo(
    () => generateFinalAnalysis(profile, block4.decisions),
    [profile, block4.decisions],
  );

  /** Block 3 results loaded from localStorage; used by ThresholdRecap and buildThresholdTree. */
  const aiResults = useMemo(
    () => readJson<AIWorkforceBlockResults>(AI_WORKFORCE_RESULTS_KEY),
    [],
  );

  /** Seven-dimension ranked sensitivity tree; passed to RankedThresholdTree for display. */
  const tree = useMemo(
    () => buildThresholdTree(profile, aiResults, block4.decisions),
    [profile, aiResults, block4.decisions],
  );

  /**
   * Guards the one-time localStorage write.
   *
   * A REF, not state: this flag is never read during render — it only stops the effect below
   * from writing twice. Holding it in state meant every mount paid for an extra render whose
   * only effect was to flip a boolean nothing displays, and setting state synchronously inside
   * an effect is what `react-hooks/set-state-in-effect` warns about (it can cascade renders).
   * Reading and writing a ref inside an effect is safe; only reading one during RENDER is not.
   */
  const persistedRef = useRef(false);

  useEffect(() => {
    if (persistedRef.current) return;
    const completedAt = new Date().toISOString();
    const payload = {
      analysis,
      tentative_style: analysis.tentativeStyle,
      threshold_tree: tree,
      completed_at: completedAt,
    };
    try {
      localStorage.setItem(STORAGE_KEY_FINAL, JSON.stringify(payload));
    } catch {
      // ignore
    }
    persistedRef.current = true;
  }, [analysis, tree]);

  /** Stable wrapper so the auto-advance effect below does not see a new function every render. */
  const handleAutoStartBlock5 = useCallback(() => {
    onStartBlock5?.();
  }, [onStartBlock5]);

  /**
   * HIDDEN PAGE — presses "Start main simulation" automatically.
   *
   * Placed AFTER the persist effect, so the threshold tree is written before Block 5 starts.
   * Guarded on onStartBlock5 as well: without that prop this page is a terminal screen with
   * nowhere to advance to, and auto-advancing would leave a spinner forever.
   *
   * This page is the most important one to hide. It displays the ranked seven-sensitivity tree,
   * which is the very quantity Block 5 then uses to decide which options are labelled misaligned
   * for this participant. Showing someone the scoring key immediately before scoring them with
   * it would compromise Block 5 as a measurement. See interBlockPages.ts.
   */
  useAutoAdvance(!SHOW_INTER_BLOCK_PAGES && !!onStartBlock5, handleAutoStartBlock5);

  const { initialDecision, midDecision, finalDecision, confidence } =
    block4.decisions;

  // Inline computed strings for the "Ethical reading" section; derived from profile scores.
  const utilitarianReading =
    profile.scaleSensitivityScore >= 0.55 && profile.harmReluctanceScore <= 0.5
      ? "Your responses suggest some weight on aggregate outcomes: thresholds appeared to shift with the number of people affected, which tentatively indicates an outcome-oriented streak."
      : "Your responses tentatively suggest a modest weight on aggregate outcomes — the number of people affected did not appear to dominate your decisions.";

  const deontologicalReading = profile.refusedBridge
    ? "At the same time, you declined direct-harm actions in Block 2 even when the numeric outcome was better, which tentatively suggests a deontological concern with being the direct cause of harm."
    : profile.directnessAversionScore >= 0.55
      ? "At the same time, you appeared more hesitant about direct action than indirect action of similar consequence, which tentatively suggests some deontological weight on authorship of harm."
      : "Deontological concerns about direct authorship of harm did not appear to dominate, though this is a rough read from a short exercise.";

  const block4InfluenceNote =
    initialDecision && finalDecision && initialDecision !== finalDecision
      ? "Hearing from the two stakeholders in Block 4 appeared to shift your final decision. This tentatively suggests openness to revising a view when a concrete human perspective is introduced."
      : midDecision && initialDecision && midDecision !== initialDecision
        ? "You briefly shifted after the first stakeholder but returned to your initial view. This may suggest an empathetic pull balanced against a stable underlying value."
        : "Your decision remained stable across both stakeholder vignettes. This can reflect a settled value, though it is also worth considering whether each perspective was given equal weight.";

  /*
   * Hidden mode. The analysis and the threshold tree are computed and saved above; the advance
   * to Block 5 is queued. Only the participant-facing report is withheld.
   *
   * Note the onStartBlock5 condition: when this page is rendered with no onward destination it
   * is a terminal results screen, and it is always shown.
   */
  if (!SHOW_INTER_BLOCK_PAGES && onStartBlock5) {
    return <InterBlockPause />;
  }

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
        maxW="4xl"
        w="full"
        animationName="fade-in"
        animationDuration="moderate"
      >
        {/* 1. Header + caution */}
        <VStack gap="3" textAlign="center">
          <Badge
            colorPalette="blue"
            variant="subtle"
            textTransform="uppercase"
            letterSpacing="wider"
            fontWeight="medium"
            px="3"
            py="1"
            rounded="md"
          >
            Final interpretation
          </Badge>
          <Heading size="2xl" color="fg" fontWeight="semibold">
            Your reflection, summarized
          </Heading>
          <Text color="fg.muted" fontSize="lg" maxW="2xl" mx="auto">
            The notes below describe patterns we observed across the four
            blocks. They are tentative, and they do not constitute a diagnosis
            or a judgement about your character.
          </Text>
        </VStack>

        {/* 2. Pattern cards (alignment, consistency, sensitivity) */}
        <PanelCard title="Alignment between your initial and final view">
          <Text color="fg" fontSize="md" lineHeight="tall">
            {analysis.alignmentNote}
          </Text>
        </PanelCard>

        <PanelCard title="Consistency across the blocks">
          <Text color="fg" fontSize="md" lineHeight="tall">
            {analysis.consistencyNote}
          </Text>
        </PanelCard>

        <PanelCard title="Sensitivity patterns">
          <Stack gap="3">
            {analysis.sensitivityNotes.map((note, i) => (
              <Text key={i} color="fg" fontSize="md" lineHeight="tall">
                {note}
              </Text>
            ))}
          </Stack>
        </PanelCard>

        {/* 3. Ranked threshold tree */}
        <PanelCard title="Ranked sensitivity tree">
          <Text color="fg.muted" fontSize="sm" mb="5" lineHeight="tall">
            The seven dimensions below are ordered by how strongly they shaped
            your responses. Each score is computed directly from your earlier
            answers, and the derivation is shown so you can see where the
            number came from.
          </Text>
          <RankedThresholdTree tree={tree} />
        </PanelCard>

        {/* 4. Raw threshold recap from Block 3 */}
        {aiResults && (
          <PanelCard title="Your AI workforce thresholds">
            <Text color="fg.muted" fontSize="sm" mb="4" lineHeight="tall">
              The minimum financial gain at which you would have approved the
              rollout in each sub-context. Values labelled "no acceptance
              within range" mean the maximum offered gain was not enough.
            </Text>
            <ThresholdRecap results={aiResults} />
          </PanelCard>
        )}

        {/* 5. Ethical reading */}
        <PanelCard title="A tentative ethical reading">
          <Stack gap="3">
            <Text color="fg" fontSize="md" lineHeight="tall">
              {utilitarianReading}
            </Text>
            <Text color="fg" fontSize="md" lineHeight="tall">
              {deontologicalReading}
            </Text>
          </Stack>
        </PanelCard>

        {/* 6. Block 4 influence */}
        <PanelCard title="How Block 4 appeared to influence your view">
          <Text color="fg" fontSize="md" lineHeight="tall">
            {block4InfluenceNote}
          </Text>
          {typeof confidence === "number" && (
            <Text color="fg.muted" fontSize="sm" mt="3" fontStyle="italic">
              You reported a confidence of {confidence} out of 5 in your final
              decision.
            </Text>
          )}
        </PanelCard>

        {/* 7. Tentative label */}
        <PanelCard title="A tentative descriptive label">
          <Badge
            colorPalette="blue"
            size="lg"
            rounded="full"
            px="4"
            py="1"
            mb="3"
          >
            {analysis.tentativeStyle}
          </Badge>
          <Text color="fg.muted" fontSize="sm" fontStyle="italic">
            This label is a rough descriptor, not a diagnosis. Many thoughtful
            people sit across more than one style depending on the situation.
          </Text>
        </PanelCard>

        {/* 8. Important context / caveats */}
        <Box
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="xl"
          p={{ base: "5", md: "6" }}
        >
          <Heading size="sm" mb="3" color="fg.muted">
            Important context
          </Heading>
          <Stack gap="2">
            {analysis.caveats.map((c, i) => (
              <Text key={i} color="fg.muted" fontSize="sm" lineHeight="tall">
                {c}
              </Text>
            ))}
            <Text color="fg.muted" fontSize="sm" lineHeight="tall">
              The ranked sensitivity tree is a summary of observed patterns,
              not a ranking of moral correctness. A higher score on a dimension
              does not mean that dimension is more valid — it means it shaped
              your answers more visibly in this short exercise.
            </Text>
          </Stack>
        </Box>

        <Separator borderColor="border.subtle" />

        {onStartBlock5 && (
          <Box textAlign="center" py="2">
            <Text color="fg.muted" fontSize="md" mb="5">
              Your sensitivity profile is ready. Continue to the main simulation
              where your profile will personalise public emergency scenarios.
            </Text>
            <Button
              onClick={onStartBlock5}
              size="lg"
              colorPalette="blue"
              bg="blue.600"
              color="white"
              _hover={{ bg: "blue.500" }}
              rounded="lg"
              px="8"
              gap="2"
            >
              Start main simulation
              <Icon><LuArrowRight /></Icon>
            </Button>
          </Box>
        )}

        {!onStartBlock5 && (
          <Text color="fg.muted" fontSize="md" textAlign="center" mt="2">
            Thank you for taking part.
          </Text>
        )}

        <Separator borderColor="border.subtle" />

        <Box textAlign="center" pb="4">
          <Text color="fg.subtle" fontSize="sm" mb="4">
            Want to run through the experiment again?
          </Text>
          <Button
            onClick={handleStartOver}
            variant="outline"
            size="md"
            colorPalette="gray"
            rounded="lg"
            px="6"
            gap="2"
            _hover={{ bg: "bg.subtle" }}
          >
            <Icon>
              <LuRotateCcw />
            </Icon>
            Start Over
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}
