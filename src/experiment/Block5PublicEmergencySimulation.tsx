/**
 * Block5PublicEmergencySimulation — Main simulation block for Block 5 (CVR Cube v3.1).
 *
 * Flow per scenario (see Scenario 1 Master Spec):
 *   pick an option (none hidden) → see its consequences →
 *     ALIGNED/WEAKLY  → soft reconsideration (tap the trade-off) → Keep / Change my mind
 *     MISALIGNED      → CVR vignette → "still choose this?"
 *                         YES → Q1 (value) + Q2 (stakeholder) → Confirm / Change my mind
 *                         NO  → APA value-clarification flow (Sections 1–4, all-or-nothing commit)
 *
 * Alignment (v3.1): threshold-satisfaction — an option is only penalized when it falls
 * BELOW the participant's priority on a value; meeting/exceeding costs nothing. Bands
 * 85/75/55 give Aligned / Weakly aligned / Misaligned / Strongly misaligned.
 *
 * Top dashboard (issues 1 & 2): the participant's CUMULATIVE performance — a running
 * AVERAGE of the 8 metrics of the options confirmed so far (starts at 0, can never
 * exceed 100). It is STICKY so it stays visible while scrolling, has an info toggle
 * explaining how it works, and each option has a "Preview impact" button that projects
 * the new overall (also shown inline on the card).
 *
 * Refresh (issue 3): Block 5 does not resume mid-block; it clears its progress key on
 * mount and always starts at Scenario 1, preserving the Blocks 1–4 profile.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Badge, Box, Button, Flex, Grid, Heading, HStack, Icon, Separator, Stack, Text, VStack,
} from "@chakra-ui/react";
import { LuCheck, LuChevronDown, LuChevronUp, LuShield, LuTriangleAlert, LuInfo, LuEye, LuGauge } from "react-icons/lu";
import { SensitivityMeterBar, MeterLegend } from "./block5Meters";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import {
  labelOptions, type LabeledOption, ALIGNMENT_LABEL, isMisaligned, cvrCoordinate,
  optionMetrics, applyEndorsementUpdates, applyValueBump, applyApaUpdates, scenarioVciScore,
  performanceScore, computeVCI, computeStability, averagePerformance,
  cumulativeMetrics, projectedMetrics, metricProfileScore, optionMainValue, violatedValue,
} from "./block5CVR";
import { getCVRStory, pickWhoVariant } from "./block5CVRContent";
import { useScrollToTop } from "./useScrollToTop";
import { useColorMode } from "@/components/ui/color-mode";
import { getBlock5Palette, type Block5Palette } from "./block5Palette";
import {
  METRIC_KEYS, METRIC_LABELS, METRIC_HOVER, POLICY_DIM_KEYS, POLICY_DIM_EXPLAIN,
  type AlignmentLevel, type Block5Results, type Block5Scenario, type Block5ScenarioResult,
  type Block5UserProfile, type CVREndorsement, type Block5MetricKey, type Block5MetricProfile,
  type Block5PolicyDimKey, type CVRCoordinate, type WhoVariant,
  type Block5ScenarioTelemetry, type CVROutcome, type APAOutcome,
  BLOCK5_PROGRESS_KEY, BLOCK5_RESULTS_KEY,
} from "./block5Types";

interface Props {
  userProfile: Block5UserProfile;
  onComplete: (results: Block5Results) => void;
}

interface ProgressState {
  currentScenarioIndex: number;
  scenarioResults: Block5ScenarioResult[];
  scenarioStartTime: number;
  profile: Block5UserProfile;
  firstChoiceId: string | null;
}

type FlowStep = "review" | "q1" | "q2" | "apa" | "confirm";

interface PreviewImpact {
  overall: number;
  baseOverall: number;
  changes: { label: string; delta: number }[];
}

const LEVEL_COLOR: Record<AlignmentLevel, string> = {
  aligned: "#48BB78",
  weakly_aligned: "#ECC94B",
  misaligned: "#ED8936",
  strongly_misaligned: "#F56565",
};

/** Darker alignment colours for legibility on LIGHT cards (the dark decision modal keeps the bright set). */
const LEVEL_COLOR_LIGHT: Record<AlignmentLevel, string> = {
  aligned: "#16a34a",
  weakly_aligned: "#ca8a04",
  misaligned: "#ea580c",
  strongly_misaligned: "#dc2626",
};

/**
 * Colour key for the CVR-cube dimensions inside the vignette text:
 *   a = same-numbers anchor (gold) · v = the violated VALUE (teal) ·
 *   f = the FRAMING context/directness (orange) · w = WHO appears, salience (purple) ·
 *   b = plain bold (e.g. the harm).
 */
const CVR_MARK: Record<string, { color?: string; bold?: boolean; italic?: boolean }> = {
  a: { color: "#f6e05e", bold: true },
  v: { color: "#4fd1c5", bold: true, italic: true },
  f: { color: "#f6ad55", bold: true, italic: true },
  w: { color: "#b794f4", bold: true, italic: true },
  b: { bold: true },
};

/** Parse {x|text} markup into coloured, emphasised spans so the cube dimensions stand out. */
function renderCVRMarkup(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\{([avfwb])\|([^}]*)\}/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const s = CVR_MARK[m[1]];
    nodes.push(
      <Text as="span" key={key++} color={s.color} fontWeight={s.bold ? "bold" : undefined} fontStyle={s.italic ? "italic" : undefined}>
        {m[2]}
      </Text>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const VALUE_NAME: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "Vulnerability protection",
  groupSizeSensitivity: "Group-size",
  gainResponsivenessSensitivity: "Gain responsiveness",
  outcomeAggregationSensitivity: "Outcome aggregation",
};
const VALUE_BENEFIT: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "protecting the patients who are worst-off or least able to cope",
  groupSizeSensitivity: "helping as many people as possible",
  gainResponsivenessSensitivity: "getting the greatest benefit from each scarce dose",
  outcomeAggregationSensitivity: "maximizing the total good across everyone",
};

interface ApaCommitPayload {
  finalOption: LabeledOption;
  pendingProfile: Block5UserProfile;
  q1: "endorse" | "context" | "unsure";
  confidence: number;
  q2Influenced: boolean;
  q3Value: Block5PolicyDimKey;
  originalOptionId: string;
}

function topMetricChanges(current: Block5MetricProfile, projected: Block5MetricProfile, n: number) {
  return METRIC_KEYS
    .map((k) => ({ label: METRIC_LABELS[k], delta: projected[k] - current[k] }))
    .filter((c) => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, n);
}

/* ---------------- Behavioral telemetry (additive; never affects scoring) ---------------- */

/**
 * Mutable per-scenario telemetry accumulator. Kept in a ref and mutated by the existing
 * handlers (select / preview / expand / CVR yes-no-back / APA open-back-confirm). The clean
 * Block5ScenarioTelemetry is assembled from this at commit time, then the accumulator is
 * reset for the next scenario. None of this touches the decision logic or the scoring.
 */
interface TelemetryAccum {
  startedAt: number;
  cvrVisits: number;
  apaVisits: number;
  optionChanges: number;
  cvrBackouts: number;
  apaBackouts: number;
  finalDecisionChanges: number;
  previewImpactOpens: number;
  optionExpands: number;
  timeToFirstSelectionMs: number | null;
  cvrDwellMs: number;
  apaDwellMs: number;
  distinct: Set<string>;     // distinct options opened into the decision view
  lastSelectedId: string | null;
  cvrShownAt: number | null; // timestamp the CVR vignette became visible (null when not showing)
  apaShownAt: number | null; // timestamp the APA panel opened (null when not open)
}

function newTelemetryAccum(): TelemetryAccum {
  return {
    startedAt: Date.now(),
    cvrVisits: 0, apaVisits: 0, optionChanges: 0, cvrBackouts: 0, apaBackouts: 0,
    finalDecisionChanges: 0, previewImpactOpens: 0, optionExpands: 0,
    timeToFirstSelectionMs: null, cvrDwellMs: 0, apaDwellMs: 0,
    distinct: new Set(), lastSelectedId: null, cvrShownAt: null, apaShownAt: null,
  };
}

/** Extracts the 4 policy-value scores (0–100) from a profile, for the evolution snapshot. */
function policyScoresOf(profile: Block5UserProfile): Record<Block5PolicyDimKey, number> {
  const out = {} as Record<Block5PolicyDimKey, number>;
  for (const k of POLICY_DIM_KEYS) {
    out[k] = profile.dimensions.find((d) => d.key === k)?.score ?? 0;
  }
  return out;
}

/** Assembles the immutable, stored telemetry for a finished scenario from the accumulator. */
function buildScenarioTelemetry(
  t: TelemetryAccum,
  opts: { cvrFired: boolean; cvrOutcome: CVROutcome; apaOutcome: APAOutcome },
): Block5ScenarioTelemetry {
  const now = Date.now();
  let cvrDwellMs = t.cvrDwellMs;
  let apaDwellMs = t.apaDwellMs;
  // Defensively close any dwell timer left open (e.g. committed straight from a panel).
  if (t.cvrShownAt != null) cvrDwellMs += Math.max(0, now - t.cvrShownAt);
  if (t.apaShownAt != null) apaDwellMs += Math.max(0, now - t.apaShownAt);
  return {
    cvrTriggered: opts.cvrFired,
    apaTriggered: t.apaVisits > 0,
    cvrVisits: t.cvrVisits,
    apaVisits: t.apaVisits,
    cvrOutcome: opts.cvrOutcome,
    apaOutcome: opts.apaOutcome,
    numberOfSwitches: t.optionChanges + t.cvrBackouts + t.apaBackouts + t.finalDecisionChanges,
    initialSelections: t.distinct.size,
    optionChanges: t.optionChanges,
    cvrBackouts: t.cvrBackouts,
    apaBackouts: t.apaBackouts,
    finalDecisionChanges: t.finalDecisionChanges,
    timeToFirstSelectionMs: t.timeToFirstSelectionMs,
    previewImpactOpens: t.previewImpactOpens,
    optionExpands: t.optionExpands,
    cvrDwellMs,
    apaDwellMs,
  };
}

export function Block5PublicEmergencySimulation({ userProfile, onComplete }: Props) {
  // Issue 3: always start fresh at Scenario 1 on mount/refresh (no mid-block resume).
  const [progress, setProgress] = useState<ProgressState>(() => ({
    currentScenarioIndex: 0,
    scenarioResults: [],
    scenarioStartTime: Date.now(),
    profile: userProfile,
    firstChoiceId: null,
  }));

  useEffect(() => {
    try { localStorage.removeItem(BLOCK5_PROGRESS_KEY); } catch { /* ignore */ }
  }, []);

  // Per-scenario behavioral telemetry accumulator (additive observation only — never affects
  // the decision logic or scoring). Reset for each new scenario in finalizeScenario.
  const telRef = useRef<TelemetryAccum | null>(null);
  if (telRef.current === null) telRef.current = newTelemetryAccum();

  // Each scenario opens at the top of the page.
  useScrollToTop(progress.currentScenarioIndex);

  // Colour-mode-aware palette source (resolved after the scenario guard below).
  const { colorMode } = useColorMode();

  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [previewOptionId, setPreviewOptionId] = useState<string | null>(null);
  const [step, setStep] = useState<FlowStep | null>(null);
  const [tradeoffAck, setTradeoffAck] = useState(false);
  const [q1Strong, setQ1Strong] = useState<boolean | null>(null);
  const [q2Guided, setQ2Guided] = useState<boolean | null>(null);
  // The stakeholder voice shown for the current misaligned selection (random, stable while reading).
  const [cvrWho, setCvrWho] = useState<WhoVariant | null>(null);
  // Which sidebar value the user is hovering, to show its plain-English explanation.
  const [hoveredDim, setHoveredDim] = useState<string | null>(null);

  const scenario = BLOCK5_SCENARIOS[progress.currentScenarioIndex];
  const profile = progress.profile;

  const labeled = useMemo<LabeledOption[]>(
    () => (scenario ? labelOptions(scenario.options, profile) : []),
    [scenario, profile],
  );

  const selectedOption = labeled.find((o) => o.id === selectedOptionId) ?? null;
  const previewOption = labeled.find((o) => o.id === previewOptionId) ?? null;

  const cumulative = useMemo(() => cumulativeMetrics(progress.scenarioResults), [progress.scenarioResults]);
  const projected = useMemo<Block5MetricProfile | null>(
    () => (previewOption ? projectedMetrics(progress.scenarioResults, optionMetrics(previewOption)) : null),
    [previewOption, progress.scenarioResults],
  );

  const resetFlow = useCallback(() => {
    setSelectedOptionId(null);
    setStep(null);
    setTradeoffAck(false);
    setQ1Strong(null);
    setQ2Guided(null);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (telRef.current) telRef.current.optionExpands += 1; // info-seeking signal
      }
      return next;
    });
  }, []);

  const togglePreview = useCallback((id: string) => {
    setPreviewOptionId((cur) => {
      const opening = cur !== id;
      if (opening && telRef.current) telRef.current.previewImpactOpens += 1; // info-seeking signal
      return opening ? id : null;
    });
  }, []);

  const handleSelect = useCallback((id: string) => {
    // --- telemetry (observation only): first-selection time, distinct opens, genuine changes ---
    const t = telRef.current;
    if (t) {
      if (t.timeToFirstSelectionMs === null) t.timeToFirstSelectionMs = Date.now() - t.startedAt;
      if (t.lastSelectedId !== null && t.lastSelectedId !== id) t.optionChanges += 1;
      t.lastSelectedId = id;
      t.distinct.add(id);
    }

    setSelectedOptionId(id);
    setPreviewOptionId(null);
    setStep("review");
    setTradeoffAck(false);
    setQ1Strong(null);
    setQ2Guided(null);
    setProgress((p) => (p.firstChoiceId ? p : { ...p, firstChoiceId: id }));
    // Lock in a random stakeholder voice now (only for a misaligned choice that triggers CVR),
    // so the vignette and the Q2 questions all reference the SAME person and it won't change on re-render.
    const opt = labeled.find((o) => o.id === id);
    const misaligned = !!(scenario && opt && isMisaligned(opt.level));
    if (misaligned && t) {
      t.cvrVisits += 1;          // the CVR vignette is about to be shown
      t.cvrShownAt = Date.now(); // start CVR dwell timer
    }
    setCvrWho(misaligned && scenario && opt
      ? pickWhoVariant(scenario, cvrCoordinate(opt, profile).who)
      : null);
  }, [labeled, scenario, profile]);

  // --- CVR / APA telemetry handlers (wrap the existing step transitions; logic unchanged) ---
  const handleCvrYes = useCallback(() => {
    const t = telRef.current;
    if (t && t.cvrShownAt != null) { t.cvrDwellMs += Math.max(0, Date.now() - t.cvrShownAt); t.cvrShownAt = null; }
    setStep("q1");
  }, []);

  const handleCvrNo = useCallback(() => {
    const t = telRef.current;
    const now = Date.now();
    if (t) {
      if (t.cvrShownAt != null) { t.cvrDwellMs += Math.max(0, now - t.cvrShownAt); t.cvrShownAt = null; }
      t.apaVisits += 1;     // the APA panel is opening
      t.apaShownAt = now;   // start APA dwell timer
    }
    setStep("apa");
  }, []);

  const handleCvrBackout = useCallback(() => {
    const t = telRef.current;
    if (t) {
      if (t.cvrShownAt != null) { t.cvrDwellMs += Math.max(0, Date.now() - t.cvrShownAt); t.cvrShownAt = null; }
      t.cvrBackouts += 1;
    }
    resetFlow();
  }, [resetFlow]);

  const handleApaBail = useCallback(() => {
    const t = telRef.current;
    if (t) {
      if (t.apaShownAt != null) { t.apaDwellMs += Math.max(0, Date.now() - t.apaShownAt); t.apaShownAt = null; }
      t.apaBackouts += 1;
    }
    resetFlow();
  }, [resetFlow]);

  const handleFinalDecisionChange = useCallback(() => {
    if (telRef.current) telRef.current.finalDecisionChanges += 1;
  }, []);

  // Records a finished scenario and advances (or completes Block 5). Shared by all paths.
  const finalizeScenario = useCallback((result: Block5ScenarioResult, nextProfile: Block5UserProfile) => {
    // Snapshot the 4 policy values AFTER this scenario's update, for the evolution chart.
    result.policySnapshotAfter = policyScoresOf(nextProfile);
    const nextResults = [...progress.scenarioResults, result];
    const nextIndex = progress.currentScenarioIndex + 1;
    if (nextIndex >= BLOCK5_SCENARIOS.length) {
      const vci = computeVCI(nextResults);
      const stab = computeStability(nextResults);
      const finalResults: Block5Results = {
        completed: true,
        completedAt: new Date().toISOString(),
        userProfile: nextProfile,
        originalProfile: userProfile,
        scenarioResults: nextResults,
        vci: vci.value, vciLevel: vci.level,
        stability: stab.value, stabilityLevel: stab.level,
        performance: averagePerformance(nextResults),
        // Behavioral telemetry totals (additive; do not affect scoring).
        totalCvrVisits: nextResults.reduce((s, r) => s + (r.telemetry?.cvrVisits ?? 0), 0),
        totalApaVisits: nextResults.reduce((s, r) => s + (r.telemetry?.apaVisits ?? 0), 0),
        totalSwitches: nextResults.reduce((s, r) => s + (r.telemetry?.numberOfSwitches ?? 0), 0),
      };
      try {
        localStorage.setItem(BLOCK5_RESULTS_KEY, JSON.stringify(finalResults));
        localStorage.removeItem(BLOCK5_PROGRESS_KEY);
      } catch { /* ignore */ }
      onComplete(finalResults);
      return;
    }
    setProgress({
      currentScenarioIndex: nextIndex,
      scenarioResults: nextResults,
      scenarioStartTime: Date.now(),
      profile: nextProfile,
      firstChoiceId: null,
    });
    telRef.current = newTelemetryAccum(); // fresh telemetry for the next scenario
    setExpandedOptions(new Set());
    setPreviewOptionId(null);
    resetFlow();
  }, [progress, userProfile, onComplete, resetFlow]);

  const commitChoice = useCallback((opt: LabeledOption, opts: {
    nextProfile: Block5UserProfile;
    endorsement: CVREndorsement;
    stakeholderGuided: boolean | null;
  }) => {
    if (!scenario) return;

    const origLabeled = labelOptions(scenario.options, userProfile);
    const origLevel = origLabeled.find((o) => o.id === opt.id)?.level;
    const alignedToOriginal = origLevel === "aligned" || origLevel === "weakly_aligned";
    const coord = isMisaligned(opt.level) ? cvrCoordinate(opt, profile) : undefined;

    const result: Block5ScenarioResult = {
      scenarioId: scenario.id,
      selectedOptionId: opt.id,
      selectedRank: opt.rank,
      topRankedOptionId: labeled[0]?.id ?? opt.id,
      selectedWasTopCandidate: opt.rank === 1,
      selectedWasCandidate: opt.level === "aligned" || opt.level === "weakly_aligned",
      rankedOptionIds: labeled.map((o) => o.id),
      fitScoresByOptionId: Object.fromEntries(labeled.map((o) => [o.id, o.matchScore])),
      candidateStatusByOptionId: Object.fromEntries(
        labeled.map((o) => [o.id, o.level === "aligned" || o.level === "weakly_aligned"]),
      ),
      viewedExplanationOptionIds: [...expandedOptions],
      timeMs: Date.now() - progress.scenarioStartTime,
      alignmentLevel: opt.level,
      matchScore: opt.matchScore,
      firstChoiceOptionId: progress.firstChoiceId ?? opt.id,
      postCVRChoiceOptionId: opt.id,
      cvrFired: isMisaligned(opt.level),
      cvrEndorsement: opts.endorsement,
      cvrCoordinate: coord,
      stakeholderGuided: opts.stakeholderGuided,
      alignedToOriginal,
      vciScore: scenarioVciScore(opt.level, opts.endorsement),
      performanceScore: performanceScore(opt),
      metrics: optionMetrics(opt),
      cvrStakeholderShown: cvrWho?.label,
      telemetry: telRef.current
        ? buildScenarioTelemetry(telRef.current, {
            cvrFired: isMisaligned(opt.level),
            cvrOutcome: !isMisaligned(opt.level)
              ? "none"
              : opts.endorsement === "strong"
                ? "endorsed-strong"
                : opts.endorsement === "weak"
                  ? "endorsed-weak"
                  : "none",
            apaOutcome: "none",
          })
        : undefined,
    };

    finalizeScenario(result, opts.nextProfile);
  }, [scenario, userProfile, profile, labeled, expandedOptions, progress, cvrWho, finalizeScenario]);

  // APA committed a final decision: apply the (pending) APA profile updates and record the chosen option.
  const handleApaCommit = useCallback((payload: ApaCommitPayload) => {
    if (!scenario) return;
    const nextProfile = payload.pendingProfile;
    const finalLabeled = labelOptions(scenario.options, nextProfile);
    const opt = finalLabeled.find((o) => o.id === payload.finalOption.id);
    if (!opt) return;
    const origLabeled = labelOptions(scenario.options, userProfile);
    const origLevel = origLabeled.find((o) => o.id === opt.id)?.level;
    const alignedToOriginal = origLevel === "aligned" || origLevel === "weakly_aligned";

    const result: Block5ScenarioResult = {
      scenarioId: scenario.id,
      selectedOptionId: opt.id,
      selectedRank: opt.rank,
      topRankedOptionId: finalLabeled[0]?.id ?? opt.id,
      selectedWasTopCandidate: opt.rank === 1,
      selectedWasCandidate: opt.level === "aligned" || opt.level === "weakly_aligned",
      rankedOptionIds: finalLabeled.map((o) => o.id),
      fitScoresByOptionId: Object.fromEntries(finalLabeled.map((o) => [o.id, o.matchScore])),
      candidateStatusByOptionId: Object.fromEntries(
        finalLabeled.map((o) => [o.id, o.level === "aligned" || o.level === "weakly_aligned"]),
      ),
      viewedExplanationOptionIds: [...expandedOptions],
      timeMs: Date.now() - progress.scenarioStartTime,
      alignmentLevel: opt.level,
      matchScore: opt.matchScore,
      firstChoiceOptionId: progress.firstChoiceId ?? payload.originalOptionId,
      postCVRChoiceOptionId: opt.id,
      cvrFired: true,
      cvrEndorsement: "no",
      stakeholderGuided: payload.q2Influenced,
      alignedToOriginal,
      vciScore: scenarioVciScore(opt.level, "no"),
      performanceScore: performanceScore(opt),
      metrics: optionMetrics(opt),
      apa: {
        q1: payload.q1,
        confidence: payload.confidence,
        stakeholderInfluenced: payload.q2Influenced,
        prioritizedValue: payload.q3Value,
        originalOptionId: payload.originalOptionId,
      },
      cvrStakeholderShown: cvrWho?.label,
      telemetry: telRef.current
        ? buildScenarioTelemetry(telRef.current, {
            cvrFired: true,
            cvrOutcome: "went-to-APA",
            apaOutcome: "committed",
          })
        : undefined,
    };
    finalizeScenario(result, nextProfile);
  }, [scenario, userProfile, expandedOptions, progress, cvrWho, finalizeScenario]);

  const handleKeep = useCallback(() => {
    if (!selectedOption) return;
    // Keeping the relative best fit (now labeled "Aligned") reinforces its value by +15;
    // weakly-aligned by +10. Both clamped to 100.
    const points = selectedOption.level === "aligned" ? 15 : selectedOption.level === "weakly_aligned" ? 10 : 0;
    const nextProfile = points > 0 ? applyValueBump(profile, selectedOption, points) : profile;
    commitChoice(selectedOption, { nextProfile, endorsement: "n/a", stakeholderGuided: null });
  }, [selectedOption, profile, commitChoice]);

  const handleConfirmEndorsement = useCallback(() => {
    if (!selectedOption || q1Strong === null || q2Guided === null) return;
    const nextProfile = applyEndorsementUpdates(profile, selectedOption, q1Strong, q2Guided);
    commitChoice(selectedOption, {
      nextProfile,
      endorsement: q1Strong ? "strong" : "weak",
      stakeholderGuided: q2Guided,
    });
  }, [selectedOption, profile, q1Strong, q2Guided, commitChoice]);

  if (!scenario) return null;

  // Resolved colour palette for the current mode (fresh light theme / cleaned dark theme).
  const pal = getBlock5Palette(scenario, colorMode === "light" ? "light" : "dark");

  // Show ONLY the 4 policy/value sensitivities (these drive policy fit), strongest first.
  // Directness, Context, and Stakeholder are CVR-framing dimensions — they only shape the
  // vignette, so they are deliberately not shown to the participant here.
  const topDimensions = profile.dimensions
    .filter((d) => (POLICY_DIM_KEYS as string[]).includes(d.key))
    .sort((a, b) => b.score - a.score);

  const baseOverall = metricProfileScore(cumulative);
  const impactFor = (opt: LabeledOption): PreviewImpact => {
    const proj = projectedMetrics(progress.scenarioResults, optionMetrics(opt));
    return { overall: metricProfileScore(proj), baseOverall, changes: topMetricChanges(cumulative, proj, 3) };
  };

  return (
    <Box minH="100dvh" style={{ background: pal.pageBg }} px={{ base: "4", md: "6", lg: "8" }} py={{ base: "6", md: "8" }}>
      {/* Header */}
      <VStack gap="2" mb="5" maxW="7xl" mx="auto">
        <HStack gap="3" justify="center" wrap="wrap">
          <Badge bg={pal.badgeBg} color={pal.text} px="3" py="1" rounded="full" fontSize="xs" fontWeight="semibold" letterSpacing="wider" textTransform="uppercase">
            Scenario {progress.currentScenarioIndex + 1} of {BLOCK5_SCENARIOS.length}
          </Badge>
          <Badge bg={pal.surfaceSubtle} color={pal.textMuted} px="3" py="1" rounded="full" fontSize="xs">
            Block 5: Public Emergency Simulation
          </Badge>
        </HStack>
        <Heading size={{ base: "xl", md: "2xl" }} color={pal.headerText} fontWeight="bold" textAlign="center" letterSpacing="tight">
          {scenario.title}
        </Heading>
        <HStack gap="2" mt="1">
          {BLOCK5_SCENARIOS.map((_, i) => (
            <Box key={i} w="3" h="3" rounded="full"
              bg={i < progress.currentScenarioIndex ? pal.dotDone : i === progress.currentScenarioIndex ? pal.accent : pal.dotTodo}
              transition="background 0.3s ease" />
          ))}
        </HStack>
      </VStack>

      {/* Sticky cumulative performance dashboard (issues 1 & 2) */}
      <Box position="sticky" top="2" zIndex="30" maxW="7xl" mx="auto" mb="6">
        <MetricsDashboard current={cumulative} projected={projected} previewTitle={previewOption?.title ?? null}
          accent={pal.accent} completedCount={progress.scenarioResults.length} pal={pal} />
      </Box>

      <Grid templateColumns={{ base: "1fr", lg: "320px 1fr" }} gap={{ base: "6", lg: "8" }} maxW="7xl" mx="auto" alignItems="start">
        {/* Sidebar (not sticky, to avoid overlapping the pinned dashboard) */}
        <Box bg={pal.sidebarBg} backdropFilter={pal.backdropBlur} borderWidth="1px" borderColor={pal.sidebarBorder} rounded="2xl" p={{ base: "5", md: "6" }} style={{ boxShadow: pal.sidebarShadow }}>
          <VStack align="stretch" gap="5">
            <Box>
              <Text fontSize="2xs" fontWeight="bold" color={pal.accent} textTransform="uppercase" letterSpacing="widest" mb="2">
                The scenario
              </Text>
              <Text fontSize="sm" color={pal.textMuted} lineHeight="tall">{scenario.description}</Text>
            </Box>
            {scenario.factBase && (
              <Box bg={pal.panelDeep} borderWidth="1px" borderColor={pal.accent} borderLeftWidth="4px" rounded="lg" px="4" py="3">
                <HStack gap="2" mb="1.5">
                  <Icon color={pal.accent} boxSize="4"><LuTriangleAlert /></Icon>
                  <Text fontSize="2xs" fontWeight="bold" color={pal.textMuted} textTransform="uppercase" letterSpacing="wider">The situation right now</Text>
                </HStack>
                <Text fontSize="sm" color={pal.text} lineHeight="tall" fontWeight="medium">{scenario.factBase}</Text>
              </Box>
            )}
            <Separator borderColor={pal.separator} />
            <Box>
              <HStack gap="2" mb="3">
                <Icon color={pal.accent}><LuShield /></Icon>
                <Text fontSize="xs" fontWeight="semibold" color={pal.textMuted} textTransform="uppercase" letterSpacing="wider">Your value priorities</Text>
              </HStack>
              <VStack align="stretch" gap="2">
                {topDimensions.map((d) => (
                  <Box key={d.key} position="relative" cursor="help"
                    onMouseEnter={() => setHoveredDim(d.key)} onMouseLeave={() => setHoveredDim(null)}>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color={hoveredDim === d.key ? pal.text : pal.textMuted}
                        style={{ textDecoration: "underline dotted", textDecorationColor: pal.textFaint, textUnderlineOffset: "2px" }}>
                        {d.label}
                      </Text>
                      <Badge bg={pal.badgeBg} color={pal.text} rounded="md" px="2" fontSize="xs" fontFamily="mono">{d.score}</Badge>
                    </HStack>
                    {hoveredDim === d.key && (
                      <Box position="absolute" top="100%" left="0" mt="1.5" zIndex="20"
                        bg={pal.tooltipBg} color={pal.tooltipText}
                        borderWidth="1px" borderColor={pal.tooltipBorder} rounded="lg" px="3" py="2"
                        fontSize="2xs" lineHeight="tall" w="240px" shadow="xl">
                        {POLICY_DIM_EXPLAIN[d.key as Block5PolicyDimKey]}
                      </Box>
                    )}
                  </Box>
                ))}
              </VStack>
            </Box>
            <Box bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder} rounded="xl" px="4" py="3">
              <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
                Every option stays available. Each is labeled by how well it fits your earlier
                responses — but you can choose any of them. Use “Preview impact” to see how an
                option would change your performance above.
              </Text>
            </Box>
          </VStack>
        </Box>

        {/* Options */}
        <VStack align="stretch" gap="4">
          <Box>
            <Text fontSize="2xs" fontWeight="bold" color={pal.accent} textTransform="uppercase" letterSpacing="widest">
              The options — choose one policy
            </Text>
            <Text fontSize="xs" color={pal.textFaint} mt="1">
              All {labeled.length} options are available. Each shows how well it fits your value priorities (left).
            </Text>
          </Box>
          {labeled.map((opt) => (
            <OptionCard key={opt.id} option={opt} profile={profile} accent={pal.accent} pal={pal}
              expanded={expandedOptions.has(opt.id)} onToggle={() => toggleExpand(opt.id)}
              onSelect={() => handleSelect(opt.id)}
              isPreviewing={previewOptionId === opt.id} onPreview={() => togglePreview(opt.id)}
              impact={previewOptionId === opt.id ? impactFor(opt) : null}
              disabled={step !== null} />
          ))}
        </VStack>
      </Grid>

      {selectedOption && step && (
        <FlowOverlay
          option={selectedOption} profile={profile} scenario={scenario} accent={pal.accent}
          whoVariant={cvrWho}
          step={step} setStep={setStep}
          tradeoffAck={tradeoffAck} setTradeoffAck={setTradeoffAck}
          q1Strong={q1Strong} setQ1Strong={setQ1Strong}
          q2Guided={q2Guided} setQ2Guided={setQ2Guided}
          onKeep={handleKeep}
          onConfirmEndorsement={handleConfirmEndorsement}
          onApaCommit={handleApaCommit}
          onChangeMyMind={resetFlow}
          onCvrYes={handleCvrYes}
          onCvrNo={handleCvrNo}
          onCvrBackout={handleCvrBackout}
          onApaBail={handleApaBail}
          onFinalDecisionChange={handleFinalDecisionChange}
        />
      )}
    </Box>
  );
}

/* ---------------- Cumulative performance dashboard ---------------- */

function MetricsDashboard({ current, projected, previewTitle, accent, completedCount, pal }: {
  current: Block5MetricProfile;
  projected: Block5MetricProfile | null;
  previewTitle: string | null;
  accent: string;
  completedCount: number;
  pal: Block5Palette;
}) {
  const [hovered, setHovered] = useState<Block5MetricKey | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [infoOpened, setInfoOpened] = useState(false); // stops the glow once the user opens the explanation
  const isPreview = !!projected;
  const display = projected ?? current;
  const overall = metricProfileScore(display);
  const baseOverall = metricProfileScore(current);
  const overallDelta = overall - baseOverall;
  // Delta colours tuned for legibility in each mode.
  const pos = pal.mode === "light" ? "#15803d" : "#86efac";
  const neg = pal.mode === "light" ? "#b91c1c" : "#fca5a5";

  const label = isPreview
    ? `Projected if you choose: ${previewTitle}`
    : completedCount === 0
      ? "Your performance — starts at 0, fills in as you choose"
      : `Your performance — average of ${completedCount} scenario${completedCount > 1 ? "s" : ""} so far`;

  return (
    <Box bg={pal.dashBg} backdropFilter={pal.backdropBlur} borderWidth="1px"
      borderColor={isPreview ? accent : pal.dashBorder}
      borderTopWidth="3px" borderTopColor={isPreview ? accent : pal.dashTopBorder}
      rounded="2xl" p={{ base: "4", md: "5" }} style={{ boxShadow: pal.dashShadow }} transition="border-color 0.2s ease">
      <HStack justify="space-between" mb="2" wrap="wrap" gap="2">
        <HStack gap="2">
          <Icon color={accent}>{isPreview ? <LuEye /> : <LuGauge />}</Icon>
          <Text fontSize="xs" fontWeight="bold" color={pal.dashTitleColor} textTransform="uppercase" letterSpacing="wider">{label}</Text>
          <Button
            aria-label="How this works"
            size="2xs"
            variant="ghost"
            color={infoOpened ? pal.textMuted : accent}
            _hover={{ bg: pal.surfaceSubtle, color: pal.text }}
            rounded="full"
            px="1"
            minW="auto"
            animation={infoOpened ? undefined : "glow-ring 1.6s ease-in-out infinite"}
            onClick={() => { setShowInfo((s) => !s); setInfoOpened(true); }}
          >
            <Icon boxSize="3.5"><LuInfo /></Icon>
          </Button>
        </HStack>
        <HStack gap="2">
          {isPreview && overallDelta !== 0 && (
            <Badge bg="transparent" borderWidth="1px" rounded="md" px="2" fontSize="2xs" fontWeight="bold"
              color={overallDelta > 0 ? pos : neg} borderColor={overallDelta > 0 ? pos : neg}>
              {overallDelta > 0 ? `▲ +${overallDelta}` : `▼ ${overallDelta}`}
            </Badge>
          )}
          <Badge bg={accent} color="white" rounded="md" px="2.5" py="1" fontSize="xs" fontWeight="bold">Overall {overall}/100</Badge>
        </HStack>
      </HStack>

      {showInfo && (
        <Box bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder} rounded="lg" px="4" py="3" mb="3">
          <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
            These 8 bars show how good your chosen policies are overall (total benefit, fairness, protecting the
            vulnerable, and so on), each 0–100. When you confirm a choice, its scores are <b>averaged</b> into these
            bars — so they can never go above 100. “Preview impact” shows what the average <b>would become</b> if you
            picked an option. This measures <b>outcome quality</b>, which is separate from how well an option matches
            <b> your values</b> (the alignment label on each card).
          </Text>
        </Box>
      )}

      {!showInfo && (
        <Text fontSize="xs" color={pal.textFaint} mb="3" lineHeight="tall">
          {isPreview
            ? "Preview only — your choice isn't saved until you confirm it."
            : completedCount === 0
              ? "This is the average outcome quality of the policies you choose. Hover a metric to learn what it means."
              : "Average across the scenarios you've completed. Hover a metric to learn what it means."}
        </Text>
      )}

      <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap="3">
        {METRIC_KEYS.map((k) => {
          const val = display[k];
          const delta = val - current[k];
          return (
            <Box key={k} position="relative" onMouseEnter={() => setHovered(k)} onMouseLeave={() => setHovered(null)} cursor="default">
              <HStack justify="space-between" mb="1">
                <Text fontSize="2xs" color={pal.textMuted} lineClamp={1}>{METRIC_LABELS[k]}</Text>
                <HStack gap="1">
                  {isPreview && delta !== 0 && (
                    <Text fontSize="2xs" fontWeight="bold" color={delta > 0 ? pos : neg}>
                      {delta > 0 ? `+${delta}` : delta}
                    </Text>
                  )}
                  <Text fontSize="2xs" color={pal.text} fontFamily="mono">{val}</Text>
                </HStack>
              </HStack>
              <Box h="2" bg={pal.metricTrack} rounded="full" overflow="visible" position="relative">
                <Box h="full" w={`${val}%`} bg={accent} rounded="full" transition="width 0.4s ease" />
                {isPreview && (
                  <Box position="absolute" top="-1px" h="calc(100% + 2px)" w="2px" bg={pal.textMuted} rounded="full" style={{ left: `${current[k]}%` }} title={`Now: ${current[k]}`} />
                )}
              </Box>
              {hovered === k && (
                <Box position="absolute" top="100%" left="0" mt="1" zIndex="10" bg={pal.tooltipBg} color={pal.tooltipText}
                  borderWidth="1px" borderColor={pal.tooltipBorder} rounded="md" px="3" py="2" fontSize="2xs" w="220px" shadow="xl">
                  {METRIC_HOVER[k]}
                </Box>
              )}
            </Box>
          );
        })}
      </Grid>
    </Box>
  );
}

/* ---------------- Option card ---------------- */

function OptionCard({ option, profile, accent, pal, expanded, onToggle, onSelect, isPreviewing, onPreview, impact, disabled }: {
  option: LabeledOption; profile: Block5UserProfile; accent: string; pal: Block5Palette;
  expanded: boolean; onToggle: () => void; onSelect: () => void;
  isPreviewing: boolean; onPreview: () => void; impact: PreviewImpact | null; disabled: boolean;
}) {
  const levelColor = (pal.mode === "light" ? LEVEL_COLOR_LIGHT : LEVEL_COLOR)[option.level];
  const pos = pal.mode === "light" ? "#15803d" : "#86efac";
  const neg = pal.mode === "light" ? "#b91c1c" : "#fca5a5";
  return (
    <Box bg={pal.cardBg} backdropFilter={pal.backdropBlur} borderWidth={isPreviewing ? "2px" : "1px"}
      borderColor={isPreviewing ? accent : pal.cardBorder} rounded="2xl" p={{ base: "5", md: "6" }} style={{ boxShadow: pal.cardShadow }}
      opacity={disabled ? 0.5 : 1} transition="all 0.2s ease" _hover={disabled ? {} : { borderColor: pal.cardHoverBorder }}>
      <Flex justify="space-between" align="start" gap="4" wrap="wrap">
        <VStack align="start" gap="1" minW="0" flex="1">
          <Text color={pal.text} fontWeight="semibold" fontSize="md" lineHeight="short">{option.title}</Text>
          <Text color={pal.textMuted} fontSize="sm" lineHeight="tall">{option.summary}</Text>
        </VStack>
        <VStack align="end" gap="1" flexShrink={0}>
          <Badge bg="transparent" color={levelColor} borderWidth="1px" borderColor={levelColor} rounded="md" px="2" py="0.5" fontSize="2xs" fontWeight="bold">
            {ALIGNMENT_LABEL[option.level]}
          </Badge>
          <Badge bg={pal.badgeBg} color={pal.badgeText} rounded="md" px="2" py="0.5" fontSize="2xs" fontFamily="mono">Align {option.matchScore}</Badge>
          <Badge bg={pal.badgeBg} color={pal.badgeText} rounded="md" px="2" py="0.5" fontSize="2xs" fontFamily="mono">Perf {option.performance}</Badge>
        </VStack>
      </Flex>

      {option.consequence && (
        <HStack mt="3" gap="2" align="start">
          <Icon color={pal.textFaint} mt="0.5" boxSize="3.5"><LuTriangleAlert /></Icon>
          <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">{option.consequence}</Text>
        </HStack>
      )}

      {/* Inline impact (issue 1: visible without scrolling to the top dashboard) */}
      {impact && (
        <Box mt="3" bg={pal.panelDeep} borderWidth="1px" borderColor={accent} rounded="lg" px="3" py="2">
          <HStack justify="space-between" mb="1" wrap="wrap" gap="1">
            <Text fontSize="2xs" color={pal.textMuted} textTransform="uppercase" letterSpacing="wider">Impact on your overall performance</Text>
            <Text fontSize="xs" fontWeight="bold" color={pal.text}>
              {impact.baseOverall} → {impact.overall}{" "}
              <Text as="span" color={impact.overall >= impact.baseOverall ? pos : neg}>
                ({impact.overall >= impact.baseOverall ? `▲ +${impact.overall - impact.baseOverall}` : `▼ ${impact.overall - impact.baseOverall}`})
              </Text>
            </Text>
          </HStack>
          {impact.changes.length > 0 && (
            <HStack gap="2" wrap="wrap">
              {impact.changes.map((c) => (
                <Badge key={c.label} bg={pal.badgeBg} rounded="md" px="2" fontSize="2xs" color={c.delta > 0 ? pos : neg}>
                  {c.label} {c.delta > 0 ? `+${c.delta}` : c.delta}
                </Badge>
              ))}
            </HStack>
          )}
          <Text fontSize="2xs" color={pal.textFaint} mt="1">Preview only — not saved until you confirm.</Text>
        </Box>
      )}

      <HStack mt="4" gap="3" wrap="wrap">
        <Button size="sm" variant="ghost" color={pal.textMuted} _hover={{ bg: pal.surfaceSubtle, color: pal.text }} rounded="lg" onClick={onToggle} gap="1" fontSize="xs">
          {expanded ? "Hide details" : "See value & metric details"}
          <Icon boxSize="3.5">{expanded ? <LuChevronUp /> : <LuChevronDown />}</Icon>
        </Button>
        <Button size="sm" variant="outline"
          borderColor={isPreviewing ? accent : pal.cardBorder} color={isPreviewing ? accent : pal.textMuted}
          bg={isPreviewing ? pal.surfaceSubtle : "transparent"}
          _hover={{ bg: pal.surfaceSubtle }} rounded="lg" onClick={onPreview} disabled={disabled} gap="1" fontSize="xs">
          <Icon boxSize="3.5"><LuEye /></Icon>
          {isPreviewing ? "Previewing impact" : "Preview impact"}
        </Button>
        <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" onClick={onSelect} disabled={disabled} fontSize="xs" fontWeight="semibold">
          Choose this option
        </Button>
      </HStack>

      {expanded && (
        <Box mt="4" pt="4" borderTopWidth="1px" borderColor={pal.separator}>
          <Text fontSize="xs" fontWeight="semibold" color={pal.textMuted} textTransform="uppercase" letterSpacing="wider" mb="2">
            How this option fits your values
          </Text>
          <Text fontSize="2xs" color={pal.textFaint} mb="3" lineHeight="tall">
            The marker line is your priority for each value. A bar that reaches or passes the line satisfies that value;
            a gap below the line is a shortfall that lowers alignment.
          </Text>
          <VStack align="stretch" gap="3">
            {POLICY_DIM_KEYS.map((k) => {
              const dim = profile.dimensions.find((d) => d.key === k);
              return (
                <SensitivityMeterBar key={k} label={dim?.label ?? k} optionScore={option.fingerprint[k]} userScore={dim?.score ?? 50} accentColor={accent} />
              );
            })}
          </VStack>
          <Box mt="3"><MeterLegend /></Box>
        </Box>
      )}
    </Box>
  );
}

/* ---------------- Flow overlay (the decision steps) ---------------- */

function FlowOverlay({
  option, profile, scenario, accent, whoVariant, step, setStep,
  tradeoffAck, setTradeoffAck, q1Strong, setQ1Strong, q2Guided, setQ2Guided,
  onKeep, onConfirmEndorsement, onApaCommit, onChangeMyMind,
  onCvrYes, onCvrNo, onCvrBackout, onApaBail, onFinalDecisionChange,
}: {
  option: LabeledOption; profile: Block5UserProfile; scenario: Block5Scenario; accent: string;
  whoVariant: WhoVariant | null;
  step: FlowStep; setStep: (s: FlowStep) => void;
  tradeoffAck: boolean; setTradeoffAck: (b: boolean) => void;
  q1Strong: boolean | null; setQ1Strong: (b: boolean) => void;
  q2Guided: boolean | null; setQ2Guided: (b: boolean) => void;
  onKeep: () => void; onConfirmEndorsement: () => void; onApaCommit: (p: ApaCommitPayload) => void; onChangeMyMind: () => void;
  // Telemetry wrappers for the CVR/APA transitions (observation only — same navigation).
  onCvrYes: () => void; onCvrNo: () => void; onCvrBackout: () => void;
  onApaBail: () => void; onFinalDecisionChange: () => void;
}) {
  const misaligned = isMisaligned(option.level);
  const coord = misaligned ? cvrCoordinate(option, profile) : null;
  const story = coord && whoVariant ? getCVRStory(scenario, option, coord, whoVariant) : null;

  // Backdrop is intentionally NOT click-to-close: the participant must use an explicit,
  // recorded button to leave CVR/APA, so we never lose or corrupt their interaction data.
  return (
    <Box position="fixed" inset="0" bg="blackAlpha.700" backdropFilter="blur(4px)" zIndex="50"
      display="flex" alignItems="center" justifyContent="center" p="4">
      <Box bg="gray.900" bgImage="linear-gradient(160deg, #1b1e28, #13151c)" borderWidth="1px" borderColor="whiteAlpha.200" rounded="2xl" p={{ base: "5", md: "7" }}
        maxW="2xl" w="full" maxH="90dvh" overflowY="auto" shadow="2xl">
        <Text fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider" mb="1">Your choice</Text>
        <Heading size="md" color="white" mb="2">{option.title}</Heading>
        {option.consequence && <Text fontSize="sm" color="whiteAlpha.600" mb="4" lineHeight="tall">{option.consequence}</Text>}
        <Separator borderColor="whiteAlpha.100" mb="4" />

        {step === "review" && !misaligned && (
          <Stack gap="4">
            <Badge alignSelf="start" bg="transparent" color={LEVEL_COLOR[option.level]} borderWidth="1px" borderColor={LEVEL_COLOR[option.level]} rounded="md" px="2" py="0.5" fontSize="2xs" fontWeight="bold">
              {ALIGNMENT_LABEL[option.level]} with your values
            </Badge>
            <Text fontSize="sm" color="whiteAlpha.800" lineHeight="tall">
              This option fits your earlier priorities. Before you confirm, take a moment with what it gives up.
            </Text>
            <Box bg="whiteAlpha.50" borderWidth="1px" borderColor="whiteAlpha.100" rounded="xl" px="4" py="3">
              <Text fontSize="xs" color="whiteAlpha.500" mb="1">What this trades away</Text>
              <Text fontSize="sm" color="whiteAlpha.800">{option.givesUp ?? option.consequence}</Text>
            </Box>
            <Button size="sm" variant="outline" alignSelf="start"
              borderColor={tradeoffAck ? accent : "whiteAlpha.300"} color={tradeoffAck ? accent : "whiteAlpha.700"}
              bg={tradeoffAck ? "whiteAlpha.100" : "transparent"} rounded="lg" onClick={() => setTradeoffAck(!tradeoffAck)} gap="2" fontSize="xs">
              <Icon boxSize="3.5"><LuCheck /></Icon>
              {tradeoffAck ? "I've considered the trade-off" : "Tap to acknowledge the trade-off"}
            </Button>
            <HStack gap="3" pt="1" wrap="wrap">
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg" onClick={onKeep} disabled={!tradeoffAck} fontSize="xs">
                Keep this choice
              </Button>
              <Button size="sm" variant="ghost" color="whiteAlpha.600" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" onClick={onChangeMyMind} fontSize="xs">
                Change my mind
              </Button>
            </HStack>
          </Stack>
        )}

        {step === "review" && misaligned && story && (
          <Stack gap="4">
            <Badge alignSelf="start" bg="transparent" color={LEVEL_COLOR[option.level]} borderWidth="1px" borderColor={LEVEL_COLOR[option.level]} rounded="md" px="2" py="0.5" fontSize="2xs" fontWeight="bold">
              {ALIGNMENT_LABEL[option.level]} with your values
            </Badge>
            {/* The recontextualized scenario — same trade-off & numbers, re-framed. */}
            <Box bg="whiteAlpha.50" borderLeftWidth="3px" borderLeftColor={accent} rounded="lg" px="4" py="3">
              {scenario.factBase && (
                <Text fontSize="2xs" color="whiteAlpha.500" fontStyle="italic" mb="2">{scenario.factBase}</Text>
              )}
              <Text fontSize="sm" color="whiteAlpha.900" lineHeight="tall">{renderCVRMarkup(story.recontext)}</Text>
            </Box>

            {/* A distinct, unlabeled box: the stakeholder vignette + the re-endorsement question. */}
            <Box bg="rgba(122,79,208,0.16)" borderWidth="1px" borderColor="rgba(183,148,244,0.45)" rounded="xl" px="4" py="4">
              <Text fontSize="sm" color="whiteAlpha.900" lineHeight="tall" mb="3">{renderCVRMarkup(story.stakeholder)}</Text>
              <Text fontSize="md" color="white" fontWeight="semibold" lineHeight="tall">{renderCVRMarkup(story.reendorseQuestion)}</Text>
            </Box>

            {/* Subtle key so the colours map to the CVR-cube dimensions. */}
            <HStack gap="3" wrap="wrap">
              <Text fontSize="2xs" color="#f6e05e" fontWeight="bold">▍ same numbers</Text>
              <Text fontSize="2xs" color="#4fd1c5" fontWeight="bold">▍ the value</Text>
              <Text fontSize="2xs" color="#f6ad55" fontWeight="bold">▍ the framing</Text>
              <Text fontSize="2xs" color="#b794f4" fontWeight="bold">▍ who is affected</Text>
            </HStack>
            <HStack gap="3" wrap="wrap">
              <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" onClick={onCvrYes} fontSize="xs">
                Yes, I would still choose this
              </Button>
              <Button size="sm" variant="outline" borderColor="whiteAlpha.300" color="whiteAlpha.800" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" onClick={onCvrNo} fontSize="xs">
                No, I would not
              </Button>
              <Button size="sm" variant="ghost" color="whiteAlpha.500" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" onClick={onCvrBackout} fontSize="xs">
                Change my mind
              </Button>
            </HStack>
          </Stack>
        )}

        {step === "q1" && (
          <Stack gap="4">
            <Text fontSize="sm" color="whiteAlpha.800" lineHeight="tall">
              This option focuses most on <b style={{ color: "white" }}>{shortMainValue(option)}</b>. Do you really value this?
            </Text>
            <HStack gap="3" wrap="wrap">
              <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" onClick={() => { setQ1Strong(true); setStep("q2"); }} fontSize="xs">
                Yes, I really value this
              </Button>
              <Button size="sm" variant="outline" borderColor="whiteAlpha.300" color="whiteAlpha.800" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" onClick={() => { setQ1Strong(false); setStep("q2"); }} fontSize="xs">
                Not really, but I keep my choice
              </Button>
            </HStack>
          </Stack>
        )}

        {step === "q2" && coord && whoVariant && (
          <Stack gap="4">
            <Text fontSize="sm" color="whiteAlpha.800" lineHeight="tall">
              {coord.who === "close"
                ? `Did imagining this patient as ${whoVariant.label} guide your decision?`
                : `Did hearing from ${whoVariant.label} guide your decision?`}
            </Text>
            <HStack gap="3" wrap="wrap">
              <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" onClick={() => { setQ2Guided(true); setStep("confirm"); }} fontSize="xs">
                Yes, it guided me
              </Button>
              <Button size="sm" variant="outline" borderColor="whiteAlpha.300" color="whiteAlpha.800" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" onClick={() => { setQ2Guided(false); setStep("confirm"); }} fontSize="xs">
                No, it did not
              </Button>
            </HStack>
          </Stack>
        )}

        {step === "confirm" && (
          <Stack gap="4">
            <Text fontSize="sm" color="whiteAlpha.800" lineHeight="tall">
              You're confirming <b style={{ color: "white" }}>{option.title}</b>. Your value profile will be updated to reflect this for the next scenario.
            </Text>
            <Box bg="whiteAlpha.50" borderWidth="1px" borderColor="whiteAlpha.100" rounded="xl" px="4" py="3">
              <Text fontSize="xs" color="whiteAlpha.600" lineHeight="tall">
                {q1Strong ? "Strong endorsement (+30 to this value, −20 to your previous top value)." : "Kept choice (+15 to this value, −10 to your previous top value)."}{" "}
                {q2Guided ? "Stakeholder sensitivity +25." : "Stakeholder sensitivity −25."}
              </Text>
            </Box>
            <HStack gap="3" wrap="wrap">
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg" onClick={onConfirmEndorsement} fontSize="xs">
                Confirm choice and continue
              </Button>
              <Button size="sm" variant="ghost" color="whiteAlpha.600" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" onClick={onChangeMyMind} fontSize="xs">
                Change my mind
              </Button>
            </HStack>
          </Stack>
        )}

        {step === "apa" && coord && whoVariant && (
          <APAPanel
            option={option}
            profile={profile}
            scenario={scenario}
            accent={accent}
            coord={coord}
            whoVariant={whoVariant}
            onBail={onApaBail}
            onCommit={onApaCommit}
            onFinalDecisionChange={onFinalDecisionChange}
          />
        )}
      </Box>
    </Box>
  );
}

/* ---------------- APA (value clarification) ---------------- */

function ApaChoice({ selected, accent, onClick, compact, children }: {
  selected: boolean; accent: string; onClick: () => void; compact?: boolean; children: ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      justifyContent="flex-start"
      textAlign="left"
      whiteSpace="normal"
      height="auto"
      py={selected ? "3" : "3.5"}
      px={selected ? "3.5" : "4"}
      rounded="xl"
      fontSize="sm"
      fontWeight="normal"
      lineHeight="1.55"
      w={compact ? "auto" : "full"}
      color="whiteAlpha.900"
      bgImage={selected
        ? `linear-gradient(145deg, ${accent}52, ${accent}1f)`
        : "linear-gradient(145deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))"}
      borderColor={selected ? accent : "whiteAlpha.300"}
      borderWidth={selected ? "2px" : "1px"}
      boxShadow={selected ? `0 0 0 1px ${accent}73, 0 10px 26px ${accent}4d` : "0 2px 10px rgba(0,0,0,0.35)"}
      transition="all 0.15s ease"
      _hover={selected ? {} : {
        bgImage: "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
        borderColor: "whiteAlpha.400",
        transform: "translateY(-1px)",
        boxShadow: "0 8px 18px rgba(0,0,0,0.45)",
      }}
    >
      <HStack gap="3" align="flex-start" w="full">
        <Box flexShrink={0} mt="0.5" w="5" h="5" rounded="full"
          borderWidth="2px" borderColor={selected ? accent : "whiteAlpha.400"}
          bg={selected ? accent : "transparent"}
          display="flex" alignItems="center" justifyContent="center">
          {selected && <Icon boxSize="3" color="white"><LuCheck /></Icon>}
        </Box>
        <Box flex="1">{children}</Box>
      </HStack>
    </Button>
  );
}

function APAPanel({ option, profile, scenario, accent, coord, whoVariant, onBail, onCommit, onFinalDecisionChange }: {
  option: LabeledOption;
  profile: Block5UserProfile;
  scenario: Block5Scenario;
  accent: string;
  coord: CVRCoordinate;
  whoVariant: WhoVariant;
  onBail: () => void;
  onCommit: (p: ApaCommitPayload) => void;
  /** telemetry: called when the user picks an APA final option then backs out to choose again. */
  onFinalDecisionChange: () => void;
}) {
  const TEAL = "#4fd1c5";
  const ORANGE = "#f6ad55";
  const PURPLE = "#b794f4";

  const topValue = violatedValue(option, profile);
  const optValue = optionMainValue(option);

  const [stage, setStage] = useState<"questions" | "options" | "confirm">("questions");
  const [q1, setQ1] = useState<"endorse" | "context" | "unsure" | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [q2, setQ2] = useState<boolean | null>(null);
  const [q3, setQ3] = useState<Block5PolicyDimKey | null>(null);
  const [section4, setSection4] = useState<LabeledOption | null>(null);
  // When true, show the "you'll lose your answers" warning instead of leaving immediately.
  const [confirmBail, setConfirmBail] = useState(false);

  const ready = q1 !== null && q2 !== null && q3 !== null;

  const pending = useMemo(
    () => (q1 !== null && q2 !== null && q3 !== null ? applyApaUpdates(profile, option, q1, q2, q3) : profile),
    [q1, q2, q3, profile, option],
  );

  const matching = useMemo<LabeledOption[]>(() => {
    if (q3 === null) return [];
    const labeled = labelOptions(scenario.options, pending);
    const m = labeled.filter((o) => optionMainValue(o) === q3);
    return m.length > 0 ? m : [...labeled].sort((a, b) => b.fingerprint[q3] - a.fingerprint[q3]).slice(0, 1);
  }, [q3, pending, scenario]);

  const vSpan = (k: Block5PolicyDimKey, color: string) => (
    <Text as="span" color={color} fontWeight="bold" fontStyle="italic">{VALUE_NAME[k]}</Text>
  );

  // ----- Warning before leaving APA: bailing discards every answer on this page -----
  if (confirmBail) {
    return (
      <Stack gap="5" align="center" textAlign="center" py="4">
        <Box w="14" h="14" rounded="full" bg="rgba(246,173,85,0.16)" borderWidth="1px" borderColor="rgba(246,173,85,0.5)"
          display="flex" alignItems="center" justifyContent="center">
          <Icon boxSize="7" color="#f6ad55"><LuTriangleAlert /></Icon>
        </Box>
        <Box>
          <Text fontSize="lg" color="white" fontWeight="semibold" mb="2">Go back and clear your answers?</Text>
          <Text fontSize="sm" color="whiteAlpha.700" lineHeight="tall" maxW="sm" mx="auto">
            If you go back to all the options, everything you selected on this page will be cleared. None of it will be saved.
          </Text>
        </Box>
        <Stack gap="2.5" w="full" maxW="xs">
          <Button bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="xl" fontWeight="semibold"
            boxShadow={`0 8px 20px ${accent}59`} onClick={() => setConfirmBail(false)}>
            Stay on this page
          </Button>
          <Button variant="ghost" color="whiteAlpha.600" _hover={{ bg: "whiteAlpha.100" }} rounded="xl" fontSize="sm" onClick={onBail}>
            Go back anyway
          </Button>
        </Stack>
      </Stack>
    );
  }

  // ----- Section 4: choose a final option, or bail (nothing commits unless they finish) -----
  if (stage === "options" || stage === "confirm") {
    return (
      <Stack gap="4">
        <Text fontSize="xs" color={accent} textTransform="uppercase" letterSpacing="wider" fontWeight="bold">Make your decision</Text>
        {stage === "options" && q3 !== null && (
          <Stack gap="3">
            <Text fontSize="sm" color="whiteAlpha.800" lineHeight="tall">
              These options best fit {vSpan(q3, accent)} — the value you just prioritized.
            </Text>
            <Stack gap="2">
              {matching.map((o) => (
                <Box key={o.id} bg="whiteAlpha.50" borderWidth="1px" borderColor="whiteAlpha.200" rounded="xl" px="4" py="3">
                  <HStack justify="space-between" align="start" gap="3" wrap="wrap">
                    <VStack align="start" gap="1" flex="1" minW="0">
                      <Text color="white" fontWeight="semibold" fontSize="sm" lineHeight="short">{o.title}</Text>
                      <Badge bg="transparent" color={LEVEL_COLOR[o.level]} borderWidth="1px" borderColor={LEVEL_COLOR[o.level]} rounded="md" px="2" fontSize="2xs" fontWeight="bold">
                        {ALIGNMENT_LABEL[o.level]}
                      </Badge>
                    </VStack>
                    <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" fontSize="xs" flexShrink={0}
                      onClick={() => { setSection4(o); setStage("confirm"); }}>
                      Select as my final decision
                    </Button>
                  </HStack>
                </Box>
              ))}
            </Stack>
            <Button size="sm" variant="ghost" color="whiteAlpha.600" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" alignSelf="start" fontSize="xs" onClick={() => setConfirmBail(true)}>
              None of these — take me back to all options
            </Button>
          </Stack>
        )}
        {stage === "confirm" && section4 && q1 !== null && q2 !== null && q3 !== null && (
          <Stack gap="4">
            <Box bg="whiteAlpha.50" borderLeftWidth="3px" borderLeftColor={accent} rounded="lg" px="4" py="3">
              <Text fontSize="xs" color="whiteAlpha.500" mb="1">Your final decision</Text>
              <Text fontSize="sm" color="white" fontWeight="semibold">{section4.title}</Text>
            </Box>
            <Text fontSize="md" color="white" fontWeight="semibold">Make this your final decision for this scenario?</Text>
            <HStack gap="3" wrap="wrap">
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg" fontSize="xs"
                onClick={() => onCommit({
                  finalOption: section4, pendingProfile: pending,
                  q1, confidence, q2Influenced: q2, q3Value: q3, originalOptionId: option.id,
                })}>
                Yes, this is my decision
              </Button>
              <Button size="sm" variant="ghost" color="whiteAlpha.600" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" fontSize="xs"
                onClick={() => { onFinalDecisionChange(); setSection4(null); setStage("options"); }}>
                No, let me pick a different option
              </Button>
            </HStack>
          </Stack>
        )}
      </Stack>
    );
  }

  // ----- Sections 1–3: clarification -----
  return (
    <Stack gap="4">
      <Box bg="whiteAlpha.100" borderWidth="1px" borderColor="whiteAlpha.200" rounded="xl" px="4" py="3">
        <Text fontSize="xs" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="wider" fontWeight="bold" mb="1">Value clarification</Text>
        <Text fontSize="sm" color="whiteAlpha.800" lineHeight="tall">
          We noticed something worth a closer look — a couple of your choices point in different directions.
          There are <b>no right or wrong answers</b> here; this step just helps the system represent your
          priorities the way you truly mean them.
        </Text>
      </Box>

      <Box bg="whiteAlpha.50" borderLeftWidth="3px" borderLeftColor={accent} rounded="lg" px="4" py="3">
        <Text fontSize="sm" color="whiteAlpha.800" lineHeight="tall">
          Across your responses you've leaned most toward {vSpan(topValue, TEAL)} — caring about <i>{VALUE_BENEFIT[topValue]}</i>.
          In this scenario you chose an option built around {vSpan(optValue, ORANGE)}, which prioritizes <i>{VALUE_BENEFIT[optValue]}</i>.
          That's the tension we'd like you to clarify.
        </Text>
      </Box>

      <Box>
        <Text fontSize="sm" color="white" fontWeight="semibold" mb="2">When you made this choice, which is closer to the truth?</Text>
        <Stack gap="2">
          <ApaChoice selected={q1 === "endorse"} accent={accent} onClick={() => setQ1("endorse")}>
            I genuinely value {vSpan(optValue, ORANGE)} more than {vSpan(topValue, TEAL)} now.
          </ApaChoice>
          <ApaChoice selected={q1 === "context"} accent={accent} onClick={() => setQ1("context")}>
            I leaned toward {vSpan(optValue, ORANGE)} because of <i>this particular situation</i> — overall, my priority is still {vSpan(topValue, TEAL)}.
          </ApaChoice>
          <ApaChoice selected={q1 === "unsure"} accent={accent} onClick={() => setQ1("unsure")}>
            I'm honestly not sure.
          </ApaChoice>
        </Stack>
        <HStack gap="2" mt="3" wrap="wrap">
          <Text fontSize="xs" color="whiteAlpha.600">How sure are you?</Text>
          {[1, 2, 3, 4, 5].map((n) => (
            <Button key={n} minW="9" h="9" px="0" rounded="lg" fontSize="sm" fontWeight="semibold"
              borderWidth="1px" borderColor={confidence === n ? accent : "whiteAlpha.200"}
              bg={confidence === n ? accent : "whiteAlpha.100"} color="white"
              boxShadow={confidence === n ? `0 4px 12px ${accent}66` : "none"}
              _hover={{ bg: confidence === n ? accent : "whiteAlpha.200" }}
              onClick={() => setConfidence(n)}>{n}</Button>
          ))}
          <Text fontSize="2xs" color="whiteAlpha.400">(1 = not sure · 5 = very sure)</Text>
        </HStack>
      </Box>

      <Box>
        <Text fontSize="sm" color="white" fontWeight="semibold" mb="2">
          {coord.who === "close" ? "Did imagining this patient as " : "Did hearing from "}
          <Text as="span" color={PURPLE} fontWeight="bold" fontStyle="italic">{whoVariant.label}</Text>
          {" influence your thinking here?"}
        </Text>
        <HStack gap="2" wrap="wrap">
          <ApaChoice selected={q2 === true} accent={accent} onClick={() => setQ2(true)} compact>Yes, it did.</ApaChoice>
          <ApaChoice selected={q2 === false} accent={accent} onClick={() => setQ2(false)} compact>No, it didn't.</ApaChoice>
        </HStack>
      </Box>

      <Box>
        <Text fontSize="sm" color="white" fontWeight="semibold" mb="2">
          Pick the one value you most want the system to weight for you — you'll then see the options that fit it:
        </Text>
        <Stack gap="2">
          {POLICY_DIM_KEYS.map((k) => (
            <ApaChoice key={k} selected={q3 === k} accent={accent} onClick={() => setQ3(k)}>
              <b>{VALUE_NAME[k]}</b> — <Text as="span" color="whiteAlpha.600">{VALUE_BENEFIT[k]}</Text>
            </ApaChoice>
          ))}
        </Stack>
      </Box>

      <HStack gap="3" pt="1" wrap="wrap">
        <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" fontSize="xs" disabled={!ready} onClick={() => setStage("options")}>
          Continue
        </Button>
        <Button size="sm" variant="ghost" color="whiteAlpha.600" _hover={{ bg: "whiteAlpha.100" }} rounded="lg" fontSize="xs" onClick={() => setConfirmBail(true)}>
          Take me back to all options
        </Button>
      </HStack>
    </Stack>
  );
}

function shortMainValue(option: LabeledOption): string {
  let best = POLICY_DIM_KEYS[0];
  let bestV = -1;
  for (const k of POLICY_DIM_KEYS) { const v = option.fingerprint[k]; if (v > bestV) { bestV = v; best = k; } }
  const SHORT: Record<string, string> = {
    vulnerabilityProtectionSensitivity: "protecting the most vulnerable",
    groupSizeSensitivity: "helping the larger group",
    gainResponsivenessSensitivity: "getting the most benefit per dose",
    outcomeAggregationSensitivity: "maximizing the total benefit",
  };
  return SHORT[best] ?? "this value";
}
