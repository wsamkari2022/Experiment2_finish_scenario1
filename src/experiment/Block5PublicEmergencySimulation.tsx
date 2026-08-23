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
  Badge, Box, Button, Flex, Grid, Heading, HStack, Icon, Separator, Spinner, Stack, Text, VStack,
} from "@chakra-ui/react";
import { LuCheck, LuChevronDown, LuChevronUp, LuShield, LuTriangleAlert, LuInfo, LuEye, LuGauge, LuSparkles, LuScale, LuChartSpline } from "react-icons/lu";
import { SensitivityMeterBar, MeterLegend } from "./block5Meters";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import {
  labelOptions, type LabeledOption, ALIGNMENT_LABEL, isMisaligned, cvrCoordinate,
  optionMetrics, applyEndorsementUpdates, applyValueBump, applyApaUpdates, scenarioVciScore,
  performanceScore, computeVCI, computeStability, averagePerformance,
  cumulativeMetrics, projectedMetrics, metricProfileScore, optionMainValue, violatedValue,
  chooseFraming, otherFraming, framingSensitivityKey,
} from "./block5CVR";
import { getCVRStory, pickWhoVariant, getCVRFramingClauses } from "./block5CVRContent";
import { useScrollToTop } from "./useScrollToTop";
import { Block5OptionCompare } from "./Block5OptionCompare";
import { useColorMode } from "@/components/ui/color-mode";
import { getBlock5Palette, type Block5Palette } from "./block5Palette";
import {
  METRIC_KEYS, METRIC_LABELS, METRIC_HOVER, POLICY_DIM_KEYS, POLICY_DIM_EXPLAIN,
  type AlignmentLevel, type Block5Results, type Block5Scenario, type Block5ScenarioResult,
  type Block5UserProfile, type CVREndorsement, type Block5MetricKey, type Block5MetricProfile,
  type Block5PolicyDimKey, type CVRCoordinate, type WhoVariant,
  type Block5ScenarioTelemetry, type CVROutcome, type APAOutcome,
  type CVRFraming, type FramingAdjust,
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

type FlowStep = "review" | "q1" | "apa" | "confirm";

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
 *
 * Two sets: bright tones for the DARK modal, darker tones for the LIGHT modal (so the highlights
 * stay legible whichever colour mode is active). Pick with cvrMarks(colorMode).
 */
type MarkSet = Record<string, { color?: string; bold?: boolean; italic?: boolean }>;
const CVR_MARK_DARK: MarkSet = {
  a: { color: "#f6e05e", bold: true },
  v: { color: "#4fd1c5", bold: true, italic: true },
  f: { color: "#f6ad55", bold: true, italic: true },
  w: { color: "#b794f4", bold: true, italic: true },
  b: { bold: true },
};
const CVR_MARK_LIGHT: MarkSet = {
  // Four clearly distinct hue families (gold · teal · red · violet) so "same numbers" and
  // "the framing" can never be confused on a light background.
  a: { color: "#a16207", bold: true },               // gold (yellow-700) — same numbers
  v: { color: "#0f766e", bold: true, italic: true }, // teal-700 — the value
  f: { color: "#dc2626", bold: true, italic: true }, // red-600 — the framing
  w: { color: "#7c3aed", bold: true, italic: true }, // violet-600 — who is affected
  b: { bold: true },
};
/** The mark colours for the current colour mode. */
function cvrMarks(mode: "light" | "dark"): MarkSet {
  return mode === "light" ? CVR_MARK_LIGHT : CVR_MARK_DARK;
}

/** Parse {x|text} markup into coloured, emphasised spans so the cube dimensions stand out. */
function renderCVRMarkup(text: string, marks: MarkSet): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\{([avfwb])\|([^}]*)\}/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const s = marks[m[1]];
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
  outcomeAggregationSensitivity: "Outcome aggregation (Utility)",
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
  // Dual-perspective (NO path): which lens changed their mind (+20), and the snapshot for storage.
  altViewGenerated: boolean;
  framingShownFirst: CVRFraming;
  framingSelected: CVRFraming | null;
  framingAdjust: FramingAdjust | null;
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
  /** times the participant opened the two-radar option comparison in this scenario. */
  compareChartsOpens: number;
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
    finalDecisionChanges: 0, previewImpactOpens: 0, optionExpands: 0, compareChartsOpens: 0,
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

/** Extracts the two reflection-lens sensitivities (0–100) for the Directness/Context evolution chart. */
function framingScoresOf(profile: Block5UserProfile): { directnessSensitivity: number; contextSensitivity: number } {
  const score = (key: string) => profile.dimensions.find((d) => d.key === key)?.score ?? 0;
  return {
    directnessSensitivity: score("directnessSensitivity"),
    contextSensitivity: score("contextSensitivity"),
  };
}

/** Participant-facing name + plain-English gloss for each reflection lens. */
const FRAMING_META: Record<CVRFraming, { name: string; gloss: string }> = {
  directness: { name: "Directness", gloss: "it's your own rule, your responsibility" },
  context: { name: "Context", gloss: "circumstances shaped the numbers" },
};

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
    compareChartsOpens: t.compareChartsOpens,
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
  // Is the two-radar "compare all options" overlay open? Reset per scenario like every other
  // per-scenario UI flag, so it never carries over into the next scenario.
  const [compareChartsOpen, setCompareChartsOpen] = useState(false);
  // Dual-perspective (Directness ↔ Context): did the participant generate the OTHER lens, and
  // (YES path) which lens did they say did NOT influence keeping the option? Both reset per option.
  const [altViewGenerated, setAltViewGenerated] = useState(false);
  const [framingChoiceYes, setFramingChoiceYes] = useState<CVRFraming | null>(null);

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
    setAltViewGenerated(false);
    setFramingChoiceYes(null);
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

  const openCompareCharts = useCallback(() => {
    if (telRef.current) telRef.current.compareChartsOpens += 1; // info-seeking signal
    setCompareChartsOpen(true);
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
    setAltViewGenerated(false);   // a fresh CVR starts with only the first lens
    setFramingChoiceYes(null);
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
    // Snapshot the 4 policy values + the two reflection lenses AFTER this scenario's update,
    // so the results view can chart how each evolved across the journey.
    result.policySnapshotAfter = policyScoresOf(nextProfile);
    result.framingSnapshotAfter = framingScoresOf(nextProfile);
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
    setCompareChartsOpen(false);
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

    // Dual-perspective record (YES / keep path). Only populated for a misaligned option, and the
    // selection/−20 only when the participant generated the other lens and answered the question.
    const framingFields: Partial<Block5ScenarioResult> = {};
    if (isMisaligned(opt.level)) {
      const shownFirst = chooseFraming(profile);
      framingFields.cvrFramingShownFirst = shownFirst;
      if (altViewGenerated) {
        framingFields.cvrAltViewGenerated = true;
        framingFields.cvrFramingShownSecond = otherFraming(shownFirst);
        if (framingChoiceYes) {
          framingFields.cvrFramingSelected = framingChoiceYes;
          framingFields.cvrFramingSelectedRole = "not_influential";
          framingFields.cvrFramingAdjustment = { sensitivityKey: framingSensitivityKey(framingChoiceYes), delta: -20 };
        }
      }
    }

    const result: Block5ScenarioResult = {
      ...framingFields,
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
  }, [scenario, userProfile, profile, labeled, expandedOptions, progress, cvrWho, altViewGenerated, framingChoiceYes, finalizeScenario]);

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

    // Dual-perspective record (NO / APA path). The +20 itself is already baked into
    // payload.pendingProfile by APAPanel; here we just store what happened for analysis.
    const apaFramingFields: Partial<Block5ScenarioResult> = {
      cvrFramingShownFirst: payload.framingShownFirst,
    };
    if (payload.altViewGenerated) {
      apaFramingFields.cvrAltViewGenerated = true;
      apaFramingFields.cvrFramingShownSecond = otherFraming(payload.framingShownFirst);
      if (payload.framingSelected) {
        apaFramingFields.cvrFramingSelected = payload.framingSelected;
        apaFramingFields.cvrFramingSelectedRole = "influential";
        apaFramingFields.cvrFramingAdjustment = payload.framingAdjust ?? undefined;
      }
    }

    const result: Block5ScenarioResult = {
      ...apaFramingFields,
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
    // Everyday scenarios teach the profile less than a life-and-death one (scenario.stakesWeight).
    const nextProfile = points > 0
      ? applyValueBump(profile, selectedOption, points, scenario?.stakesWeight ?? 1)
      : profile;
    commitChoice(selectedOption, { nextProfile, endorsement: "n/a", stakeholderGuided: null });
  }, [selectedOption, profile, scenario, commitChoice]);

  const handleConfirmEndorsement = useCallback(() => {
    if (!selectedOption || q1Strong === null || q2Guided === null) return;
    // Dual-perspective: −20 to the lens the participant said did NOT influence keeping the option
    // (only when they generated the other lens and answered). Committed here, with the endorsement.
    const framingAdjust: FramingAdjust | null = altViewGenerated && framingChoiceYes
      ? { sensitivityKey: framingSensitivityKey(framingChoiceYes), delta: -20 }
      : null;
    const nextProfile = applyEndorsementUpdates(
      profile, selectedOption, q1Strong, q2Guided, framingAdjust, scenario?.stakesWeight ?? 1,
    );
    commitChoice(selectedOption, {
      nextProfile,
      endorsement: q1Strong ? "strong" : "weak",
      stakeholderGuided: q2Guided,
    });
  }, [selectedOption, profile, scenario, q1Strong, q2Guided, altViewGenerated, framingChoiceYes, commitChoice]);

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
        {/* Sidebar column — the scenario panel, with the comparison-charts button beneath it. */}
        <VStack align="stretch" gap="4">
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

          {/* Opens the two-radar comparison of all six options (see Block5OptionCompare). */}
          <Button
            size="md" variant="outline" w="full" rounded="xl" gap="2"
            borderWidth="1px" borderColor={pal.accent} color={pal.accent}
            bg={pal.sidebarBg} backdropFilter={pal.backdropBlur}
            _hover={{ bg: pal.surfaceSubtle }}
            style={{ boxShadow: pal.sidebarShadow }}
            onClick={openCompareCharts}
          >
            <Icon boxSize="4"><LuChartSpline /></Icon>
            <Text fontSize="sm" fontWeight="semibold">Compare all options on charts</Text>
          </Button>
          <Text fontSize="2xs" color={pal.textFaint} textAlign="center" px="2" lineHeight="tall">
            Two radar charts: what each option achieves, and what each one prioritises.
          </Text>
        </VStack>

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

      {compareChartsOpen && (
        // Keyed by scenario so the overlay's "which options are visible" state is rebuilt
        // from scratch for each scenario's option set rather than carried across.
        <Block5OptionCompare
          key={scenario.id}
          scenario={scenario}
          options={labeled}
          yourPolicyScores={policyScoresOf(profile)}
          cumulative={cumulative}
          completedCount={progress.scenarioResults.length}
          pal={pal}
          onClose={() => setCompareChartsOpen(false)}
        />
      )}

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
          altViewGenerated={altViewGenerated}
          onAltGenerated={() => setAltViewGenerated(true)}
          framingChoiceYes={framingChoiceYes}
          setFramingChoiceYes={setFramingChoiceYes}
          mode={pal.mode}
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

      {/*
        THE TRADE-OFF — the most important thing on the card.
        This used to be a single muted line that participants skipped straight past. It is now an
        inset, colour-coded panel: what you GAIN in green, what you GIVE UP in red, and the moral
        question underneath. Both halves are visible BEFORE the participant chooses, which is the
        whole point of the block — they should feel the cost of the option, not discover it after.
      */}
      {(option.gains || option.consequence || option.givesUp) && (
        <Box mt="4" bg={pal.tradeoffBg} borderWidth="1px" borderColor={pal.tradeoffBorder}
          rounded="xl" px={{ base: "3.5", md: "4" }} py="3">
          <Text fontSize="2xs" fontWeight="bold" letterSpacing="widest" textTransform="uppercase"
            color={pal.textFaint} mb="2.5">
            The trade-off
          </Text>
          <Stack gap="2.5">
            <HStack align="start" gap="2.5">
              <Icon color={pal.gainColor} boxSize="4" mt="0.5" flexShrink={0}><LuCheck /></Icon>
              <Text fontSize="sm" color={pal.text} lineHeight="tall">
                <Text as="span" fontWeight="bold" color={pal.gainColor}>You gain — </Text>
                {option.gains ?? option.consequence}
              </Text>
            </HStack>
            {option.givesUp && (
              <HStack align="start" gap="2.5">
                <Icon color={pal.costColor} boxSize="4" mt="0.5" flexShrink={0}><LuTriangleAlert /></Icon>
                <Text fontSize="sm" color={pal.text} lineHeight="tall">
                  <Text as="span" fontWeight="bold" color={pal.costColor}>You give up — </Text>
                  {option.givesUp}
                </Text>
              </HStack>
            )}
          </Stack>
          {option.moralTension && (
            <HStack align="start" gap="2.5" mt="3" pt="2.5" borderTopWidth="1px" borderTopColor={pal.separator}>
              <Icon color={pal.textFaint} boxSize="3.5" mt="0.5" flexShrink={0}><LuScale /></Icon>
              <Text fontSize="xs" fontStyle="italic" color={pal.textMuted} lineHeight="tall">
                {option.moralTension}
              </Text>
            </HStack>
          )}
        </Box>
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
                <SensitivityMeterBar key={k} label={dim?.label ?? k} optionScore={option.fingerprint[k]} userScore={dim?.score ?? 50} accentColor={accent} mode={pal.mode} />
              );
            })}
          </VStack>
          <Box mt="3"><MeterLegend mode={pal.mode} /></Box>
        </Box>
      )}
    </Box>
  );
}

/* ---------------- CVR vignette: LLM-style "thinking → streaming" reveal ---------------- */

interface CVRSeg { text: string; color?: string; bold?: boolean; italic?: boolean }

/** Parses {x|…} CVR markup into styled segments (same colour key as renderCVRMarkup). */
function parseCVRSegments(text: string, marks: MarkSet): CVRSeg[] {
  const segs: CVRSeg[] = [];
  const re = /\{([avfwb])\|([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    const s = marks[m[1]];
    segs.push({ text: m[2], color: s.color, bold: s.bold, italic: s.italic });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs;
}

/** Renders the first `shown` characters across styled segments (preserving per-segment colour). */
function renderCVRSegmentsUpTo(segs: CVRSeg[], shown: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let consumed = 0;
  let key = 0;
  for (const s of segs) {
    if (consumed >= shown) break;
    const slice = s.text.slice(0, shown - consumed);
    nodes.push(
      <Text as="span" key={key++} color={s.color} fontWeight={s.bold ? "bold" : undefined} fontStyle={s.italic ? "italic" : undefined}>
        {slice}
      </Text>,
    );
    consumed += s.text.length;
  }
  return nodes;
}

/** Types one marked-up CVR line letter-by-letter, then calls onComplete once. */
function Typed({ text, marks, accent, onComplete, fontSize, color, fontWeight, lineHeight, mb }: {
  text: string; marks: MarkSet; accent: string; onComplete?: () => void;
  fontSize?: string; color?: string; fontWeight?: string; lineHeight?: string; mb?: string;
}) {
  const segs = useMemo(() => parseCVRSegments(text, marks), [text, marks]);
  const total = useMemo(() => segs.reduce((n, s) => n + s.text.length, 0), [segs]);
  const [shown, setShown] = useState(0);
  const fired = useRef(false);
  useEffect(() => {
    if (shown >= total) return;
    const id = setTimeout(() => setShown((s) => Math.min(total, s + 2)), 16); // ~2 chars / 16ms (LLM stream feel)
    return () => clearTimeout(id);
  }, [shown, total]);
  useEffect(() => {
    if (total > 0 && shown >= total && !fired.current) { fired.current = true; onComplete?.(); }
  }, [shown, total, onComplete]);
  return (
    <Text fontSize={fontSize} color={color} fontWeight={fontWeight} lineHeight={lineHeight} mb={mb}>
      {renderCVRSegmentsUpTo(segs, shown)}
      {shown < total && (
        <Box as="span" style={{ display: "inline-block", width: "2px", height: "1em", background: accent, marginLeft: "2px", verticalAlign: "text-bottom", opacity: 0.9 }} />
      )}
    </Text>
  );
}

/** Cycling "…" used by the thinking indicator. */
function AnimatedDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x % 3) + 1), 420);
    return () => clearInterval(id);
  }, []);
  return <>{".".repeat(n)}</>;
}

/** The "system is thinking" indicator shown before a reflection streams in. */
function CVRThinking({ accent, label = "Reflecting on your choice" }: { accent: string; label?: string }) {
  return (
    <HStack gap="3" py="7" justify="center" animationName="fade-in" animationDuration="moderate">
      <Spinner size="sm" color={accent} />
      <Icon color={accent} boxSize="4" animation="glow-ring 1.6s ease-in-out infinite"><LuSparkles /></Icon>
      <Text fontSize="sm" color="fg.muted" fontStyle="italic">
        {label}<AnimatedDots />
      </Text>
    </HStack>
  );
}

/** Two-pill segmented control to switch box 1 between the two generated reflection lenses. */
function ViewToggle({ current, framingFirst, framingSecond, accent, onSelect }: {
  current: "first" | "second"; framingFirst: CVRFraming; framingSecond: CVRFraming; accent: string;
  onSelect: (v: "first" | "second") => void;
}) {
  const pill = (view: "first" | "second", framing: CVRFraming) => {
    const active = current === view;
    return (
      <Button size="2xs" rounded="full" px="3" fontSize="2xs" fontWeight="bold"
        bg={active ? accent : "transparent"} color={active ? "white" : "fg.muted"}
        _hover={active ? {} : { bg: "bg.muted", color: "fg" }}
        onClick={() => onSelect(view)}>
        {FRAMING_META[framing].name}
      </Button>
    );
  };
  return (
    <HStack gap="0.5" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="full" p="0.5">
      {pill("first", framingFirst)}
      {pill("second", framingSecond)}
    </HStack>
  );
}

/**
 * Side-by-side comparison of the two reflection lenses, using the exact framing clauses the
 * participant saw. Shown next to the dual-perspective question so the choice is unmistakable.
 */
function FramingComparisonTable({ scenario, mode }: { scenario: Block5Scenario; mode: "light" | "dark" }) {
  const clauses = getCVRFramingClauses(scenario);
  const markColor = cvrMarks(mode).f.color;
  const cell = (framing: CVRFraming) => (
    <Box flex="1" minW="0" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="lg" px="3" py="2.5">
      <Text fontSize="2xs" fontWeight="bold" color="fg" mb="1">
        <Text as="span" color={markColor}>▍</Text> {FRAMING_META[framing].name}
        <Text as="span" color="fg.subtle" fontWeight="normal"> — {FRAMING_META[framing].gloss}</Text>
      </Text>
      <Text fontSize="2xs" color="fg.muted" fontStyle="italic" lineHeight="tall">“{clauses[framing]}”</Text>
    </Box>
  );
  return (
    <Stack gap="1.5">
      <Text fontSize="2xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="bold">
        The two perspectives you saw
      </Text>
      <Stack direction={{ base: "column", md: "row" }} gap="2" align="stretch">
        {cell("directness")}
        {cell("context")}
      </Stack>
    </Stack>
  );
}

/**
 * CVRReveal — presents the recontextualization + stakeholder vignette like a streaming LLM
 * answer: a random 2–5s "thinking" pause, then box 1 fades in and types, then box 2 fades in
 * and types, then the legend, then the response buttons. A "Skip" control reveals it all at once.
 */
function CVRReveal({ story, altStory, framingFirst, factBase, level, accent, mode, onAltGenerated, onCvrYes, onCvrNo, onCvrBackout }: {
  story: ReturnType<typeof getCVRStory>;
  /** the SAME vignette with the framing flipped (the other reflection lens). */
  altStory: ReturnType<typeof getCVRStory>;
  framingFirst: CVRFraming;
  factBase?: string;
  level: AlignmentLevel;
  accent: string;
  /** colour mode — picks the bright (dark) vs darker (light) CVR highlight colours. */
  mode: "light" | "dark";
  /** called once when the participant generates the alternate lens (lifts state to FlowOverlay). */
  onAltGenerated: () => void;
  onCvrYes: () => void; onCvrNo: () => void; onCvrBackout: () => void;
}) {
  type Phase = "thinking" | "box1" | "box2" | "legend" | "done";
  const [phase, setPhase] = useState<Phase>("thinking");
  const [b2Step, setB2Step] = useState(0); // 0 = typing stakeholder, 1 = typing question, 2 = done
  const [skipped, setSkipped] = useState(false);

  // Dual-perspective: alt-view generation state + which lens box 1 currently shows.
  type AltState = "none" | "regenThinking" | "regenTyping" | "ready";
  const [altState, setAltState] = useState<AltState>("none");
  const [currentView, setCurrentView] = useState<"first" | "second">("first");
  const framingSecond = otherFraming(framingFirst);
  const marks = cvrMarks(mode); // mode-aware highlight colours for the vignette markup
  const levelColor = (mode === "light" ? LEVEL_COLOR_LIGHT : LEVEL_COLOR)[level];

  // Random "thinking" wait (2–5s) on every arrival, then begin generating the first view.
  useEffect(() => {
    const ms = 2000 + Math.random() * 3000;
    const id = setTimeout(() => setPhase("box1"), ms);
    return () => clearTimeout(id);
  }, []);

  // Once the legend shows, reveal the answer buttons a beat later.
  useEffect(() => {
    if (phase !== "legend") return;
    const id = setTimeout(() => setPhase("done"), 450);
    return () => clearTimeout(id);
  }, [phase]);

  // Generating the other lens: a short "thinking" pause (~1.5–3s) then box 1 re-types.
  useEffect(() => {
    if (altState !== "regenThinking") return;
    const ms = 1500 + Math.random() * 1500;
    const id = setTimeout(() => setAltState("regenTyping"), ms);
    return () => clearTimeout(id);
  }, [altState]);

  const skip = useCallback(() => { setSkipped(true); setB2Step(2); setPhase("done"); }, []);
  const generateAlt = useCallback(() => { setAltState("regenThinking"); }, []);

  const showBox1 = skipped || phase !== "thinking";
  const showBox2 = skipped || phase === "box2" || phase === "legend" || phase === "done";
  const showLegend = skipped || phase === "legend" || phase === "done";
  const showButtons = skipped || phase === "done";
  const revealComplete = skipped || phase === "done";

  // Box-1 content: initial typing of the first lens → alt-view thinking/typing → settled full text.
  let box1Inner: ReactNode;
  if (phase === "box1" && !skipped && altState === "none") {
    box1Inner = (
      <Typed text={story.recontext} marks={marks} accent={accent} fontSize="sm" color="fg" lineHeight="tall"
        onComplete={() => setPhase("box2")} />
    );
  } else if (altState === "regenThinking") {
    box1Inner = <CVRThinking accent={accent} label={`Reframing through the ${FRAMING_META[framingSecond].name} lens`} />;
  } else if (altState === "regenTyping") {
    box1Inner = (
      <Typed text={altStory.recontext} marks={marks} accent={accent} fontSize="sm" color="fg" lineHeight="tall"
        onComplete={() => { setAltState("ready"); setCurrentView("second"); onAltGenerated(); }} />
    );
  } else {
    const recontext = currentView === "first" ? story.recontext : altStory.recontext;
    box1Inner = <Text fontSize="sm" color="fg" lineHeight="tall">{renderCVRMarkup(recontext, marks)}</Text>;
  }

  return (
    <Stack gap="4">
      <HStack justify="space-between" align="center" gap="2">
        <Badge alignSelf="start" bg="transparent" color={levelColor} borderWidth="1px" borderColor={levelColor} rounded="md" px="2" py="0.5" fontSize="2xs" fontWeight="bold">
          {ALIGNMENT_LABEL[level]} with your values
        </Badge>
        {/* Top-right control: Skip (during the first reveal) → Generate the other view → switch toggle. */}
        <Box flexShrink={0}>
          {!skipped && phase !== "done" && (
            <Button size="2xs" variant="ghost" color="fg.subtle" _hover={{ bg: "bg.subtle", color: "fg.muted" }} rounded="md" fontSize="2xs" onClick={skip}>
              Skip ›
            </Button>
          )}
          {revealComplete && altState === "none" && (
            <Button size="xs" rounded="full" px="3.5" py="1" fontWeight="bold" fontSize="2xs"
              bgImage="linear-gradient(135deg, #7c3aed, #4338ca)" color="white" _hover={{ opacity: 0.92 }}
              boxShadow="0 0 0 1px rgba(124,58,237,0.4)" animation="glow-ring 1.8s ease-in-out infinite"
              onClick={generateAlt}>
              ✨ Generate the {FRAMING_META[framingSecond].name} view
            </Button>
          )}
          {(altState === "regenThinking" || altState === "regenTyping") && (
            <Text fontSize="2xs" color="fg.subtle" fontStyle="italic">Generating…</Text>
          )}
          {altState === "ready" && (
            <ViewToggle current={currentView} framingFirst={framingFirst} framingSecond={framingSecond}
              accent={accent} onSelect={setCurrentView} />
          )}
        </Box>
      </HStack>

      {phase === "thinking" && !skipped && <CVRThinking accent={accent} />}

      {showBox1 && (
        <Box bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" borderLeftWidth="3px" borderLeftColor={accent} rounded="lg" px="4" py="3" animationName="fade-in" animationDuration="moderate">
          {factBase && (
            <Text fontSize="2xs" color="fg.subtle" fontStyle="italic" mb="2">{factBase}</Text>
          )}
          {box1Inner}
        </Box>
      )}

      {showBox2 && (
        <Box bg="purple.subtle" borderWidth="1px" borderColor="purple.muted" rounded="xl" px="4" py="4" animationName="fade-in" animationDuration="moderate">
          {skipped || b2Step >= 1 ? (
            <Text fontSize="sm" color="fg" lineHeight="tall" mb="3">{renderCVRMarkup(story.stakeholder, marks)}</Text>
          ) : (
            <Typed text={story.stakeholder} marks={marks} accent={accent} fontSize="sm" color="fg" lineHeight="tall" mb="3"
              onComplete={() => setB2Step(1)} />
          )}
          {(skipped || b2Step >= 1) && (
            skipped || b2Step >= 2 ? (
              <Text fontSize="md" color="fg" fontWeight="semibold" lineHeight="tall">{renderCVRMarkup(story.reendorseQuestion, marks)}</Text>
            ) : (
              <Typed text={story.reendorseQuestion} marks={marks} accent={accent} fontSize="md" color="fg" fontWeight="semibold" lineHeight="tall"
                onComplete={() => { setB2Step(2); setPhase("legend"); }} />
            )
          )}
        </Box>
      )}

      {showLegend && (
        <HStack gap="3" wrap="wrap" animationName="fade-in" animationDuration="moderate">
          <Text fontSize="2xs" color={marks.a.color} fontWeight="bold">▍ same numbers</Text>
          <Text fontSize="2xs" color={marks.v.color} fontWeight="bold">▍ the value</Text>
          <Text fontSize="2xs" color={marks.f.color} fontWeight="bold">▍ the framing</Text>
          <Text fontSize="2xs" color={marks.w.color} fontWeight="bold">▍ who is affected</Text>
        </HStack>
      )}

      {showButtons && (
        <HStack gap="3" wrap="wrap" animationName="fade-in" animationDuration="moderate">
          <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" onClick={onCvrYes} fontSize="xs">
            Yes, I would still choose this
          </Button>
          <Button size="sm" variant="outline" borderColor="border.emphasized" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" onClick={onCvrNo} fontSize="xs">
            No, I would not
          </Button>
          <Button size="sm" variant="ghost" color="fg.subtle" _hover={{ bg: "bg.subtle" }} rounded="lg" onClick={onCvrBackout} fontSize="xs">
            Change my mind
          </Button>
        </HStack>
      )}
    </Stack>
  );
}

/* ---------------- Flow overlay (the decision steps) ---------------- */

function FlowOverlay({
  option, profile, scenario, accent, whoVariant, step, setStep,
  tradeoffAck, setTradeoffAck, q1Strong, setQ1Strong, q2Guided, setQ2Guided,
  onKeep, onConfirmEndorsement, onApaCommit, onChangeMyMind,
  onCvrYes, onCvrNo, onCvrBackout, onApaBail, onFinalDecisionChange,
  altViewGenerated, onAltGenerated, framingChoiceYes, setFramingChoiceYes, mode,
}: {
  option: LabeledOption; profile: Block5UserProfile; scenario: Block5Scenario; accent: string;
  /** colour mode for the modal (light/dark-aware surfaces + CVR highlight colours). */
  mode: "light" | "dark";
  whoVariant: WhoVariant | null;
  step: FlowStep; setStep: (s: FlowStep) => void;
  tradeoffAck: boolean; setTradeoffAck: (b: boolean) => void;
  q1Strong: boolean | null; setQ1Strong: (b: boolean) => void;
  q2Guided: boolean | null; setQ2Guided: (b: boolean) => void;
  onKeep: () => void; onConfirmEndorsement: () => void; onApaCommit: (p: ApaCommitPayload) => void; onChangeMyMind: () => void;
  // Telemetry wrappers for the CVR/APA transitions (observation only — same navigation).
  onCvrYes: () => void; onCvrNo: () => void; onCvrBackout: () => void;
  onApaBail: () => void; onFinalDecisionChange: () => void;
  // Dual-perspective (Directness ↔ Context): generation flag + the YES-path "did NOT influence" answer.
  altViewGenerated: boolean; onAltGenerated: () => void;
  framingChoiceYes: CVRFraming | null; setFramingChoiceYes: (f: CVRFraming) => void;
}) {
  const misaligned = isMisaligned(option.level);
  const coord = misaligned ? cvrCoordinate(option, profile) : null;
  const story = coord && whoVariant ? getCVRStory(scenario, option, coord, whoVariant) : null;
  // The same vignette through the OTHER lens (framing flipped) — used for the generate/compare feature.
  const framingFirst: CVRFraming | null = coord ? coord.framing : null;
  const altStory = coord && whoVariant
    ? getCVRStory(scenario, option, { ...coord, framing: otherFraming(coord.framing) }, whoVariant)
    : null;
  // Alignment colour tuned for the current modal background (bright on dark, darker on light).
  const levelColor = (mode === "light" ? LEVEL_COLOR_LIGHT : LEVEL_COLOR)[option.level];

  // Backdrop is intentionally NOT click-to-close: the participant must use an explicit,
  // recorded button to leave CVR/APA, so we never lose or corrupt their interaction data.
  return (
    <Box position="fixed" inset="0" bg="blackAlpha.700" backdropFilter="blur(4px)" zIndex="50"
      display="flex" alignItems="center" justifyContent="center" p="4">
      <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "7" }}
        maxW="2xl" w="full" maxH="90dvh" overflowY="auto" shadow="2xl">
        <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="1">Your choice</Text>
        <Heading size="md" color="fg" mb="2">{option.title}</Heading>
        {option.consequence && <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">{option.consequence}</Text>}
        <Separator borderColor="border" mb="4" />

        {step === "review" && !misaligned && (
          <Stack gap="4">
            <Badge alignSelf="start" bg="transparent" color={levelColor} borderWidth="1px" borderColor={levelColor} rounded="md" px="2" py="0.5" fontSize="2xs" fontWeight="bold">
              {ALIGNMENT_LABEL[option.level]} with your values
            </Badge>
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              This option fits your earlier priorities. Before you confirm, take a moment with what it gives up.
            </Text>
            <Box bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" rounded="xl" px="4" py="3">
              <Text fontSize="xs" color="fg.subtle" mb="1">What this trades away</Text>
              <Text fontSize="sm" color="fg.muted">{option.givesUp ?? option.consequence}</Text>
            </Box>
            <Button size="sm" variant="outline" alignSelf="start"
              borderColor={tradeoffAck ? accent : "border.emphasized"} color={tradeoffAck ? accent : "fg.muted"}
              bg={tradeoffAck ? "bg.subtle" : "transparent"} rounded="lg" onClick={() => setTradeoffAck(!tradeoffAck)} gap="2" fontSize="xs">
              <Icon boxSize="3.5"><LuCheck /></Icon>
              {tradeoffAck ? "I've considered the trade-off" : "Tap to acknowledge the trade-off"}
            </Button>
            <HStack gap="3" pt="1" wrap="wrap">
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg" onClick={onKeep} disabled={!tradeoffAck} fontSize="xs">
                Keep this choice
              </Button>
              <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" onClick={onChangeMyMind} fontSize="xs">
                Change my mind
              </Button>
            </HStack>
          </Stack>
        )}

        {step === "review" && misaligned && story && altStory && framingFirst && (
          <CVRReveal
            story={story}
            altStory={altStory}
            framingFirst={framingFirst}
            factBase={scenario.factBase}
            level={option.level}
            accent={accent}
            mode={mode}
            onAltGenerated={onAltGenerated}
            onCvrYes={onCvrYes}
            onCvrNo={onCvrNo}
            onCvrBackout={onCvrBackout}
          />
        )}

        {/* Unified YES page: the former q1 + q2 on one page, plus the dual-perspective question
            (only if the participant generated the other lens). Then → confirm. */}
        {step === "q1" && coord && whoVariant && (
          <Stack gap="5">
            <Text fontSize="xs" color={accent} textTransform="uppercase" letterSpacing="wider" fontWeight="bold">
              Confirm keeping this option
            </Text>

            <Box>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall" mb="2">
                This option focuses most on <Text as="span" fontWeight="bold" color="fg">{shortMainValue(option)}</Text>. Do you genuinely value this?
              </Text>
              <Stack gap="2">
                <ApaChoice selected={q1Strong === true} accent={accent} onClick={() => setQ1Strong(true)}>Yes, I value this</ApaChoice>
                <ApaChoice selected={q1Strong === false} accent={accent} onClick={() => setQ1Strong(false)}>Not really, but I'm keeping my choice</ApaChoice>
              </Stack>
            </Box>

            <Box>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall" mb="2">
                {coord.who === "close"
                  ? `Did imagining this person as ${whoVariant.label} guide your decision?`
                  : `Did hearing from ${whoVariant.label} guide your decision?`}
              </Text>
              <HStack gap="2" wrap="wrap">
                <ApaChoice selected={q2Guided === true} accent={accent} onClick={() => setQ2Guided(true)} compact>Yes, it guided me</ApaChoice>
                <ApaChoice selected={q2Guided === false} accent={accent} onClick={() => setQ2Guided(false)} compact>No, it did not</ApaChoice>
              </HStack>
            </Box>

            {altViewGenerated && (
              <Box>
                <FramingComparisonTable scenario={scenario} mode={mode} />
                <Text fontSize="sm" color="fg.muted" lineHeight="tall" mt="3" mb="2">
                  You looked at this from two perspectives. <Text as="span" fontWeight="bold" color="fg">Which one did NOT play a part</Text> in your decision to keep this option?
                </Text>
                <Stack gap="2">
                  <ApaChoice selected={framingChoiceYes === "directness"} accent={accent} onClick={() => setFramingChoiceYes("directness")}>
                    The <b>Directness</b> view didn't influence me — <Text as="span" color="fg.subtle">{FRAMING_META.directness.gloss}</Text>
                  </ApaChoice>
                  <ApaChoice selected={framingChoiceYes === "context"} accent={accent} onClick={() => setFramingChoiceYes("context")}>
                    The <b>Context</b> view didn't influence me — <Text as="span" color="fg.subtle">{FRAMING_META.context.gloss}</Text>
                  </ApaChoice>
                </Stack>
              </Box>
            )}

            <HStack gap="3" wrap="wrap" pt="1">
              <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" fontSize="xs"
                disabled={q1Strong === null || q2Guided === null || (altViewGenerated && framingChoiceYes === null)}
                onClick={() => setStep("confirm")}>
                Continue
              </Button>
              <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" fontSize="xs" onClick={onChangeMyMind}>
                Change my mind
              </Button>
            </HStack>
          </Stack>
        )}

        {step === "confirm" && (
          <Stack gap="4">
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              You're confirming <Text as="span" fontWeight="bold" color="fg">{option.title}</Text>. Your value profile will be updated to reflect this for the next scenario.
            </Text>
            <Box bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" rounded="xl" px="4" py="3">
              <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                {q1Strong ? "Strong endorsement (+30 to this value, −20 to your previous top value)." : "Kept choice (+15 to this value, −10 to your previous top value)."}{" "}
                {q2Guided ? "Stakeholder sensitivity +25." : "Stakeholder sensitivity −25."}
                {altViewGenerated && framingChoiceYes && ` ${FRAMING_META[framingChoiceYes].name} lens −20 (it didn't affect this choice).`}
              </Text>
            </Box>
            <HStack gap="3" wrap="wrap">
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg" onClick={onConfirmEndorsement} fontSize="xs">
                Confirm choice and continue
              </Button>
              <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" onClick={onChangeMyMind} fontSize="xs">
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
            altViewGenerated={altViewGenerated}
            framingFirst={coord.framing}
            mode={mode}
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
      color="fg"
      bg={selected ? `${accent}22` : "bg.subtle"}
      borderColor={selected ? accent : "border"}
      borderWidth={selected ? "2px" : "1px"}
      boxShadow={selected ? `0 0 0 1px ${accent}55` : "none"}
      transition="all 0.15s ease"
      _hover={selected ? {} : {
        bg: "bg.muted",
        borderColor: "border.emphasized",
        transform: "translateY(-1px)",
      }}
    >
      <HStack gap="3" align="flex-start" w="full">
        <Box flexShrink={0} mt="0.5" w="5" h="5" rounded="full"
          borderWidth="2px" borderColor={selected ? accent : "border.emphasized"}
          bg={selected ? accent : "transparent"}
          display="flex" alignItems="center" justifyContent="center">
          {selected && <Icon boxSize="3" color="white"><LuCheck /></Icon>}
        </Box>
        <Box flex="1">{children}</Box>
      </HStack>
    </Button>
  );
}

function APAPanel({ option, profile, scenario, accent, coord, whoVariant, onBail, onCommit, onFinalDecisionChange, altViewGenerated, framingFirst, mode }: {
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
  /** dual-perspective: did the participant generate the other lens, and which lens was shown first. */
  altViewGenerated: boolean;
  framingFirst: CVRFraming;
  /** colour mode — light/dark-aware surfaces + highlight colours. */
  mode: "light" | "dark";
}) {
  // Highlight colours for the value-name spans, tuned for the current modal background.
  const marks = cvrMarks(mode);
  const TEAL = marks.v.color as string;     // the participant's leaning value
  const ORANGE = marks.f.color as string;   // the option's value
  const PURPLE = marks.w.color as string;   // the stakeholder

  const topValue = violatedValue(option, profile);
  const optValue = optionMainValue(option);

  const [stage, setStage] = useState<"questions" | "options" | "confirm">("questions");
  const [q1, setQ1] = useState<"endorse" | "context" | "unsure" | null>(null);
  // No default — the participant must choose a confidence level (it is a required answer).
  const [confidence, setConfidence] = useState<number | null>(null);
  const [q2, setQ2] = useState<boolean | null>(null);
  const [q3, setQ3] = useState<Block5PolicyDimKey | null>(null);
  // Dual-perspective (NO path): which lens changed the participant's mind toward rejecting (→ +20).
  const [framingInfluential, setFramingInfluential] = useState<CVRFraming | null>(null);
  const [section4, setSection4] = useState<LabeledOption | null>(null);
  // When true, show the "you'll lose your answers" warning instead of leaving immediately.
  const [confirmBail, setConfirmBail] = useState(false);

  // The +20 to the lens that changed their mind — only when generated AND answered. Pending until commit.
  const framingAdjust = useMemo<FramingAdjust | null>(
    () => (altViewGenerated && framingInfluential
      ? { sensitivityKey: framingSensitivityKey(framingInfluential), delta: 20 }
      : null),
    [altViewGenerated, framingInfluential],
  );

  const ready = q1 !== null && confidence !== null && q2 !== null && q3 !== null && (!altViewGenerated || framingInfluential !== null);

  const pending = useMemo(
    () => (q1 !== null && q2 !== null && q3 !== null
      ? applyApaUpdates(profile, option, q1, q2, q3, framingAdjust, scenario.stakesWeight ?? 1)
      : profile),
    [q1, q2, q3, profile, option, framingAdjust, scenario],
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
        <Box w="14" h="14" rounded="full" bg="orange.subtle" borderWidth="1px" borderColor="orange.muted"
          display="flex" alignItems="center" justifyContent="center">
          <Icon boxSize="7" color="orange.fg"><LuTriangleAlert /></Icon>
        </Box>
        <Box>
          <Text fontSize="lg" color="fg" fontWeight="semibold" mb="2">Go back and clear your answers?</Text>
          <Text fontSize="sm" color="fg.muted" lineHeight="tall" maxW="sm" mx="auto">
            If you go back to all the options, everything you selected on this page will be cleared. None of it will be saved.
          </Text>
        </Box>
        <Stack gap="2.5" w="full" maxW="xs">
          <Button bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="xl" fontWeight="semibold"
            boxShadow={`0 8px 20px ${accent}59`} onClick={() => setConfirmBail(false)}>
            Stay on this page
          </Button>
          <Button variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="xl" fontSize="sm" onClick={onBail}>
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
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              These options best fit {vSpan(q3, accent)} — the value you just prioritized.
            </Text>
            <Stack gap="2">
              {matching.map((o) => (
                <Box key={o.id} bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="xl" px="4" py="3">
                  <HStack justify="space-between" align="start" gap="3" wrap="wrap">
                    <VStack align="start" gap="1" flex="1" minW="0">
                      <Text color="fg" fontWeight="semibold" fontSize="sm" lineHeight="short">{o.title}</Text>
                      <Badge bg="transparent" color={(mode === "light" ? LEVEL_COLOR_LIGHT : LEVEL_COLOR)[o.level]} borderWidth="1px" borderColor={(mode === "light" ? LEVEL_COLOR_LIGHT : LEVEL_COLOR)[o.level]} rounded="md" px="2" fontSize="2xs" fontWeight="bold">
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
            <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" alignSelf="start" fontSize="xs" onClick={() => setConfirmBail(true)}>
              None of these — take me back to all options
            </Button>
          </Stack>
        )}
        {stage === "confirm" && section4 && q1 !== null && confidence !== null && q2 !== null && q3 !== null && (
          <Stack gap="4">
            <Box bg="bg.subtle" borderLeftWidth="3px" borderLeftColor={accent} rounded="lg" px="4" py="3">
              <Text fontSize="xs" color="fg.subtle" mb="1">Your final decision</Text>
              <Text fontSize="sm" color="fg" fontWeight="semibold">{section4.title}</Text>
            </Box>
            <Text fontSize="md" color="fg" fontWeight="semibold">Make this your final decision for this scenario?</Text>
            <HStack gap="3" wrap="wrap">
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg" fontSize="xs"
                onClick={() => onCommit({
                  finalOption: section4, pendingProfile: pending,
                  q1, confidence, q2Influenced: q2, q3Value: q3, originalOptionId: option.id,
                  altViewGenerated, framingShownFirst: framingFirst,
                  framingSelected: framingInfluential, framingAdjust,
                })}>
                Yes, this is my decision
              </Button>
              <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" fontSize="xs"
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
      <Box bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="xl" px="4" py="3">
        <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="bold" mb="1">Value clarification</Text>
        <Text fontSize="sm" color="fg.muted" lineHeight="tall">
          We noticed something worth a closer look — a couple of your choices point in different directions.
          There are <b>no right or wrong answers</b> here; this step just helps the system represent your
          priorities the way you truly mean them.
        </Text>
      </Box>

      <Box bg="bg.subtle" borderLeftWidth="3px" borderLeftColor={accent} rounded="lg" px="4" py="3">
        <Text fontSize="sm" color="fg.muted" lineHeight="tall">
          Across your responses you've leaned most toward {vSpan(topValue, TEAL)} — caring about <i>{VALUE_BENEFIT[topValue]}</i>.
          In this scenario you chose an option built around {vSpan(optValue, ORANGE)}, which prioritizes <i>{VALUE_BENEFIT[optValue]}</i>.
          That's the tension we'd like you to clarify.
        </Text>
      </Box>

      <Box>
        <Text fontSize="sm" color="fg" fontWeight="semibold" mb="2">When you made this choice, which is closer to the truth?</Text>
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
          <Text fontSize="xs" color="fg.muted">How sure are you?</Text>
          {[1, 2, 3, 4, 5].map((n) => (
            <Button key={n} minW="9" h="9" px="0" rounded="lg" fontSize="sm" fontWeight="semibold"
              borderWidth="1px" borderColor={confidence === n ? accent : "border"}
              bg={confidence === n ? accent : "bg.subtle"} color={confidence === n ? "white" : "fg"}
              boxShadow={confidence === n ? `0 4px 12px ${accent}66` : "none"}
              _hover={{ bg: confidence === n ? accent : "bg.muted" }}
              onClick={() => setConfidence(n)}>{n}</Button>
          ))}
          <Text fontSize="2xs" color="fg.subtle">(1 = not sure · 5 = very sure)</Text>
        </HStack>
      </Box>

      <Box>
        <Text fontSize="sm" color="fg" fontWeight="semibold" mb="2">
          {coord.who === "close" ? "Did imagining this person as " : "Did hearing from "}
          <Text as="span" color={PURPLE} fontWeight="bold" fontStyle="italic">{whoVariant.label}</Text>
          {" influence your thinking here?"}
        </Text>
        <HStack gap="2" wrap="wrap">
          <ApaChoice selected={q2 === true} accent={accent} onClick={() => setQ2(true)} compact>Yes, it did.</ApaChoice>
          <ApaChoice selected={q2 === false} accent={accent} onClick={() => setQ2(false)} compact>No, it didn't.</ApaChoice>
        </HStack>
      </Box>

      <Box>
        <Text fontSize="sm" color="fg" fontWeight="semibold" mb="2">
          Pick the one value you most want the system to weight for you — you'll then see the options that fit it:
        </Text>
        <Stack gap="2">
          {POLICY_DIM_KEYS.map((k) => (
            <ApaChoice key={k} selected={q3 === k} accent={accent} onClick={() => setQ3(k)}>
              <b>{VALUE_NAME[k]}</b> — <Text as="span" color="fg.subtle">{VALUE_BENEFIT[k]}</Text>
            </ApaChoice>
          ))}
        </Stack>
      </Box>

      {altViewGenerated && (
        <Box>
          <FramingComparisonTable scenario={scenario} mode={mode} />
          <Text fontSize="sm" color="fg" fontWeight="semibold" mt="3" mb="2">
            You looked at this from two perspectives. Which one most <Text as="span" color={PURPLE} fontWeight="bold">changed your mind</Text> toward not keeping this option?
          </Text>
          <Stack gap="2">
            <ApaChoice selected={framingInfluential === "directness"} accent={accent} onClick={() => setFramingInfluential("directness")}>
              The <b>Directness</b> view changed my mind — <Text as="span" color="fg.subtle">{FRAMING_META.directness.gloss}</Text>
            </ApaChoice>
            <ApaChoice selected={framingInfluential === "context"} accent={accent} onClick={() => setFramingInfluential("context")}>
              The <b>Context</b> view changed my mind — <Text as="span" color="fg.subtle">{FRAMING_META.context.gloss}</Text>
            </ApaChoice>
          </Stack>
        </Box>
      )}

      <HStack gap="3" pt="1" wrap="wrap">
        <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" fontSize="xs" disabled={!ready} onClick={() => setStage("options")}>
          Continue
        </Button>
        <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" fontSize="xs" onClick={() => setConfirmBail(true)}>
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
