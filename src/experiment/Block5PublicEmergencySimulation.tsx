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
 * AVERAGE of the 5 metrics of the options confirmed so far (starts at 0, can never
 * exceed 100). It is STICKY so it stays visible while scrolling, has an info toggle
 * explaining how it works, and each option has a "Preview impact" button that projects
 * the new overall (also shown inline on the card).
 *
 * Refresh (issue 3): Block 5 does not resume mid-block; it clears its progress key on
 * mount and always starts at Scenario 1, preserving the Blocks 1–4 profile.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Badge, Box, Button, Center, Flex, Grid, Heading, HStack, Icon, Separator, Spinner, Stack, Text, VStack,
} from "@chakra-ui/react";
import { LuCheck, LuChevronDown, LuChevronUp, LuShield, LuTriangleAlert, LuInfo, LuEye, LuGauge, LuSparkles, LuScale, LuChartSpline, LuUserRound, LuUsersRound, LuGlobe, LuBuilding2 } from "react-icons/lu";
import { SensitivityMeterBar, MeterLegend, MetricStandingBar, MetricStandingLegend } from "./block5Meters";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import {
  labelOptions, type LabeledOption, isMisaligned, cvrCoordinate,
  optionMetrics, applyEndorsementUpdates, applyKeepUpdates, applyApaUpdates, scenarioVciScore,
  scenarioIsScored,
  performanceScore, computeVCI, computeStability, averagePerformance,
  cumulativeMetrics, projectedMetrics, metricProfileScore, optionMainValue, violatedValue,
  chooseFraming, otherFraming, framingSensitivityKey,
} from "./block5CVR";
import { getCVRStory, pickWhoVariant, getCVRLensPair } from "./block5CVRContent";
import { SHOW_STAKEHOLDER_PAGE } from "./blocksLegacyMethodology";
import { useScrollToTop } from "./useScrollToTop";
import { Block5OptionCompare } from "./Block5OptionCompare";
import { capturedOf, menuRange, metricStandings, overallCaptured, capturedLabel,
         overallStanding, ordinal,
         type MetricStanding, type OverallStanding } from "./block5Performance";
import { useColorMode } from "@/components/ui/color-mode";
import { Tooltip } from "@/components/ui/tooltip";
import { getBlock5Palette, onAccentText, type Block5Palette } from "./block5Palette";
import { Block5ScenarioIntro } from "./Block5ScenarioIntro";
import { runMorph } from "./block5Morph";
import { deriveCompanyValues, type DerivedCompanyValues } from "./block5Company";
import {
  METRIC_KEYS, METRIC_LABELS, metricMeaning, POLICY_DIM_KEYS, POLICY_DIM_EXPLAIN, POLICY_DIM_HIGHER_MEANS,
  POLICY_DIM_SHORT,
  type AlignmentLevel, type Block5Results, type Block5Scenario, type Block5ScenarioResult,
  type Block5UserProfile, type CVREndorsement, type Block5MetricProfile,
  type Block5PolicyDimKey, type CVRCoordinate, type WhoVariant,
  type Block5ScenarioTelemetry, type CVROutcome, type APAOutcome,
  type CVRFraming, type FramingAdjust, type StakePosition,
  BLOCK5_PROGRESS_KEY, BLOCK5_RESULTS_KEY,
} from "./block5Types";
import { plannerRank, type PlannerResult } from "./block5Planner";
import { deriveDecisionProfile, type DecisionProfile } from "./block5Thresholds";
import { explainOption, plannerPanelText, BIN_DIVIDER, type CardExplanation } from "./block5PlannerText";
import type { MoralProfile } from "./profileAnalysis";

interface Props {
  userProfile: Block5UserProfile;
  /**
   * The raw Blocks 1-3 ladder record, read-only, used ONLY to derive the planner's decision
   * parameters (red lines, exchange rates, tolerance) in block5Thresholds.ts.
   *
   * Optional so the component still renders if it is ever absent — the derivation then falls back
   * to a neutral profile and flags itself as degraded, which is logged rather than hidden. It is
   * never written to, and it never touches alignment.
   */
  moralProfile?: MoralProfile | null;
  onComplete: (results: Block5Results) => void;
}

interface ProgressState {
  currentScenarioIndex: number;
  scenarioResults: Block5ScenarioResult[];
  scenarioStartTime: number;
  profile: Block5UserProfile;
  firstChoiceId: string | null;
}

/**
 * "person" is the page where one affected person argues against the answer just given.
 * review -> person -> (q1 -> confirm)  or  (apa)
 */
type FlowStep = "review" | "person" | "q1" | "apa" | "confirm";

interface PreviewImpact {
  overall: number;
  baseOverall: number;
  changes: { label: string; delta: number }[];
}

/*
 * The alignment-tier color maps used to live here. Nothing renders a tier to the participant any
 * more -- not on the option cards, not on either confirmation page, and not on the final-decision
 * list -- so the colors have no consumer left. The tiers themselves are untouched: they are still
 * computed, still drive whether CVR fires, and are still recorded in the results.
 */

/**
 * Color key for the CVR-cube dimensions inside the vignette text:
 *   a = same-numbers anchor (gold) · v = the violated VALUE (teal) ·
 *   f = the FRAMING context/directness (orange) · w = WHO appears, salience (purple) ·
 *   b = plain bold (e.g. the harm).
 *
 * Two sets: bright tones for the DARK modal, darker tones for the LIGHT modal (so the highlights
 * stay legible whichever color mode is active). Pick with cvrMarks(colorMode).
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
/** The mark colors for the current color mode. */
function cvrMarks(mode: "light" | "dark"): MarkSet {
  return mode === "light" ? CVR_MARK_LIGHT : CVR_MARK_DARK;
}

/** Parse {x|text} markup into colored, emphasized spans so the cube dimensions stand out. */
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
  vulnerabilityProtectionSensitivity: "Protecting the vulnerable",
  groupSizeSensitivity: "Reducing harm",
  gainResponsivenessSensitivity: "How much is gained",
  outcomeAggregationSensitivity: "How many are helped",
};
const VALUE_BENEFIT: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "shielding the people least able to cope",
  groupSizeSensitivity: "how much harm is prevented",
  gainResponsivenessSensitivity: "how large the payoff is",
  outcomeAggregationSensitivity: "how many people are helped",
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
  /** times the person-speaks page was shown, and times it was left without answering. */
  personVisits: number;
  personBackouts: number;
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
    personVisits: 0, personBackouts: 0,
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

/**
 * Plain-English gloss for each reflection lens.
 *
 * THERE IS NO `name` FIELD, AND THAT IS THE POINT. The two lenses are "directness" and "context"
 * everywhere the code and the stored data are concerned, and a participant is never shown either
 * word: they are terms of art from the CVR literature, and someone who does not already know them
 * cannot tell which button they are pressing. They are named by POSITION instead — see VIEW_LABEL.
 *
 * Removing the field rather than leaving it unused is deliberate. It makes showing the internal
 * term a compile error instead of a thing somebody has to remember not to do.
 */
const FRAMING_META: Record<CVRFraming, { gloss: string }> = {
  directness: { gloss: "it's your own rule, your responsibility" },
  context: { gloss: "circumstances shaped the numbers" },
};

/**
 * WHAT THE PARTICIPANT CALLS THE TWO VIEWS.
 *
 * The first one shown is whichever lens the participant's own profile scores highest on — see
 * `chooseFraming`. Which of the two that is varies per participant, so the labels cannot name a
 * lens; they name the ORDER the participant met them in, which is the one thing that is the same
 * for everybody. The gloss beside each still says what the view actually argues, so the two remain
 * tellable apart without the jargon.
 */
const VIEW_LABEL = { first: "Main view", second: "Alternative view" } as const;

/** The label a framing carries, given whichever framing this participant saw first. */
const viewLabelFor = (framing: CVRFraming, mainFraming: CVRFraming): string =>
  framing === mainFraming ? VIEW_LABEL.first : VIEW_LABEL.second;

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
    // Leaving the person-speaks page counts as a switch: the participant reached a decision point
    // and stepped away from it, which is the same behavior the other backout counters record.
    numberOfSwitches: t.optionChanges + t.cvrBackouts + t.apaBackouts + t.personBackouts + t.finalDecisionChanges,
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

export function Block5PublicEmergencySimulation({ userProfile, moralProfile, onComplete }: Props) {
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

  // Color-mode-aware palette source (resolved after the scenario guard below).
  const { colorMode } = useColorMode();

  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  /** Which single option's detail panel is open. Display only — see toggleExpand. */
  const [openOptionId, setOpenOptionId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [previewOptionId, setPreviewOptionId] = useState<string | null>(null);
  const [step, setStep] = useState<FlowStep | null>(null);
  const [tradeoffAck, setTradeoffAck] = useState(false);
  const [q1Strong, setQ1Strong] = useState<boolean | null>(null);
  // The stakeholder voice shown for the current misaligned selection (random, stable while reading).
  const [cvrWho, setCvrWho] = useState<WhoVariant | null>(null);
  // Which sidebar value the user is hovering, to show its plain-English explanation.
  const [hoveredDim, setHoveredDim] = useState<string | null>(null);

  /**
   * Keeps the scenario panel parked immediately below the sticky performance dashboard.
   *
   * WHY: the scenario and the live situation are what every option has to be judged against,
   * but they sat in a column that scrolled away as soon as the participant started reading the
   * six option cards — so the thing being decided ABOUT was off-screen for most of the decision.
   * Making the panel sticky keeps it in view the whole time.
   *
   * WHY IT IS MEASURED RATHER THAN A FIXED NUMBER: the dashboard above is itself sticky, and its
   * height changes with the viewport (its metric grid rewraps) and with whether a preview is
   * active. A hard-coded offset would either leave a gap or let the panel slide under it.
   *
   * WHY A CSS VARIABLE AND NOT STATE: this writes straight to the DOM, so a resize repositions
   * the panel without re-rendering a component that owns the whole simulation — and it keeps
   * the observer out of React's render cycle entirely.
   */
  const dashRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dash = dashRef.current;
    const grid = gridRef.current;
    const side = sideRef.current;
    if (!dash || !grid || !side) return;

    const apply = () => {
      const dashH = Math.round(dash.getBoundingClientRect().height);
      grid.style.setProperty("--b5-dash-h", `${dashH}px`);

      /*
       * Stick ONLY if the whole panel fits in what is left of the viewport.
       *
       * A sticky element taller than its available space is a trap: it pins to the top and its
       * overflowing bottom can never be scrolled to. Capping its height and giving it an inner
       * scrollbar looked like the fix, but it is worse — it silently truncated "The situation
       * right now" mid-sentence and buried the value priorities behind a scrollbar most people
       * will never notice. Nothing on this panel is optional enough to hide.
       *
       * So the measurement decides. When it fits, the participant gets the scenario alongside
       * every option. When it does not, the column simply scrolls with the page, which is how it
       * behaved before and hides nothing. LG-and-up only; below that the layout is one column.
       *
       * scrollHeight (not offsetHeight) is the natural content height, which is what we need
       * even while the element is currently stuck.
       */
      const available = window.innerHeight - dashH - 48;
      const fits = side.scrollHeight <= available;
      const next = fits ? "on" : "off";
      // Only write on change: this element is observed below, and a no-op write would still
      // schedule another observer callback.
      if (side.dataset.stick !== next) side.dataset.stick = next;
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(dash);
    ro.observe(side);
    // The fit also changes when the window gets shorter, which no ResizeObserver here sees.
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);
  // Is the two-radar "compare all options" overlay open? Reset per scenario like every other
  // per-scenario UI flag, so it never carries over into the next scenario.
  const [compareChartsOpen, setCompareChartsOpen] = useState(false);
  // Dual-perspective (Directness ↔ Context): did the participant generate the OTHER lens, and
  // (YES path) which lens did they say did NOT influence keeping the option? Both reset per option.
  const [altViewGenerated, setAltViewGenerated] = useState(false);
  /**
   * Which side the participant took on the vignette page, and whether the person who spoke
   * afterwards moved them off it.
   *
   * Together these ARE the stakeholder measurement. It used to be a self-report question — "did
   * hearing this influence you?" — which asks people to know something about themselves that they
   * generally do not. Now it is simply whether they switched.
   */
  const [cvrSaidYes, setCvrSaidYes] = useState<boolean | null>(null);
  const [stakeholderMoved, setStakeholderMoved] = useState<boolean | null>(null);
  const [framingChoiceYes, setFramingChoiceYes] = useState<CVRFraming | null>(null);

  const scenario = BLOCK5_SCENARIOS[progress.currentScenarioIndex];

  /* Which scenarios have had their intro page read. Kept in memory: re-reading is available from
     the sidebar, and persisting it would mean a participant who refreshed mid-scenario silently
     skipped the scene they had not finished. */
  const [introSeen, setIntroSeen] = useState<Set<string>>(new Set());
  /* Seconds spent on each intro. A ref, not state — it is written once per scenario and read only
     when the result is assembled, so it must never trigger a re-render. */
  const introSecondsRef = useRef<Record<string, number>>({});
  /* Measured by the morph: the overlay it animates FROM, and the page it animates INTO. */
  const introRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const profile = progress.profile;

  /**
   * ALIGNMENT — unchanged. `labelOptions` still sorts by match score and assigns the four-level
   * tier BY RANK POSITION, so this array must never be reordered: its order IS the tier
   * computation. It is no longer the display order, only the label source.
   */
  const labeled = useMemo<LabeledOption[]>(
    () => (scenario ? labelOptions(scenario.options, profile) : []),
    [scenario, profile],
  );

  /**
   * THE PLANNER — a second, independent computation that decides the display ORDER.
   *
   * Derived from `userProfile` (the ORIGINAL pre-Block-5 profile), deliberately, not from
   * `progress.profile`. The profile carried between scenarios is mutated by CVR and APA, and if
   * the planner followed it the ordering would chase the participant's own drift: options would be
   * re-ranked to match whatever the last scenario had just taught the system. Drift would then be
   * measured against a moving instrument, and Stability would become uninterpretable. The ruler
   * has to stay still while the thing being measured moves.
   *
   * (The alignment tier above DOES follow the live profile. That is intended — the tier is a
   * running judgement, the ordering is a fixed frame. Keeping them on different clocks is what
   * lets the analysis ask whether the two came apart.)
   */
  const decisionProfile = useMemo<DecisionProfile>(
    () => deriveDecisionProfile(userProfile, moralProfile),
    [userProfile, moralProfile],
  );
  const plan = useMemo<PlannerResult | null>(
    () => (scenario ? plannerRank(scenario, decisionProfile) : null),
    [scenario, decisionProfile],
  );

  /** The cards in the order the planner produced: clear first, then costed, then blocked. */
  const displayOptions = useMemo<LabeledOption[]>(() => {
    if (!plan) return labeled;
    const byId = new Map(labeled.map((o) => [o.id, o]));
    return plan.orderedIds.map((id) => byId.get(id)).filter((o): o is LabeledOption => !!o);
  }, [plan, labeled]);

  /** Per-card explanation text, generated from planner state. Keyed by option id. */
  const explanations = useMemo<Record<string, CardExplanation>>(() => {
    if (!plan || !scenario) return {};
    return Object.fromEntries(
      plan.orderedIds.map((id) => [id, explainOption(scenario, plan, decisionProfile, id)]),
    );
  }, [plan, scenario, decisionProfile]);

  const panelText = useMemo(() => plannerPanelText(decisionProfile), [decisionProfile]);

  /**
   * Per-option performance standing, computed once for the scenario rather than per card.
   *
   * Every entry is relative to THIS scenario's six options, which is the only frame in which a
   * metric score means anything (see the scale note in block5Types.ts and MetricStandingBar).
   */
  const standings = useMemo<Record<string, { rows: MetricStanding[]; overall: OverallStanding }>>(() => {
    if (!scenario) return {};
    return Object.fromEntries(scenario.options.map((o) => [
      o.id,
      { rows: metricStandings(scenario, o), overall: overallStanding(scenario, o) },
    ]));
  }, [scenario]);

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
    setAltViewGenerated(false);
    setFramingChoiceYes(null);
    setCvrSaidYes(null);
    setStakeholderMoved(null);
  }, []);

  /**
   * Opening one option's detail panel CLOSES whichever was open before.
   *
   * WHY AN ACCORDION. Six panels open at once turns the scenario into a page several screens long,
   * and the participant loses the comparison they opened the panels to make — the cards they want
   * side by side end up scrolled apart.
   *
   * WHY THE RECORD IS A SEPARATE PIECE OF STATE. `expandedOptions` is not a display flag: it is
   * written into every scenario result as `viewedExplanationOptionIds`, the record of which options
   * a participant actually inspected. If the accordion drove that Set, closing a panel would erase
   * the fact it had ever been opened, and the field would only ever hold the last card looked at.
   * So `openOptionId` says what is on screen, `expandedOptions` keeps everything ever opened, and
   * the two never overwrite each other.
   */
  const toggleExpand = useCallback((id: string) => {
    setOpenOptionId((cur) => (cur === id ? null : id));
    setExpandedOptions((prev) => {
      if (prev.has(id)) return prev;              // already recorded; nothing to add
      const next = new Set(prev);
      next.add(id);
      if (telRef.current) telRef.current.optionExpands += 1; // info-seeking signal
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
    setAltViewGenerated(false);   // a fresh CVR starts with only the first lens
    setFramingChoiceYes(null);
    setProgress((p) => (p.firstChoiceId ? p : { ...p, firstChoiceId: id }));
    // Lock in a random stakeholder voice now (only for a misaligned choice that triggers CVR),
    // so the vignette and the Q2 questions all reference the SAME person and it won't change on re-render.
    const opt = labeled.find((o) => o.id === id);
    /*
     * CVR NEVER FIRES IN A RECIPIENT SCENARIO, however misaligned the wish looks.
     *
     * The reflection re-presents the consequences of a decision back to the person who made it.
     * In a recipient scenario the participant made no decision — they said what they hoped someone
     * else would do — so there is nothing to hold them to. Running it anyway would ask them to
     * account for an outcome they were explicitly denied any control over, which is both unfair to
     * the participant and meaningless as data.
     *
     * This one guard is what keeps the whole reflection path out: no vignette, therefore no
     * endorsement question, therefore no APA update, therefore no churn.
     */
    const misaligned = !!(scenario && opt && scenarioIsScored(scenario) && isMisaligned(opt.level));
    if (misaligned && t) {
      t.cvrVisits += 1;          // the CVR vignette is about to be shown
      t.cvrShownAt = Date.now(); // start CVR dwell timer
    }
    setCvrWho(misaligned && scenario && opt
      ? pickWhoVariant(scenario, cvrCoordinate(opt, profile).who)
      : null);
  }, [labeled, scenario, profile]);

  // --- CVR / APA telemetry handlers (wrap the existing step transitions; logic unchanged) ---
  /**
   * The participant's answer to the vignette. It does NOT go straight to the next page any more —
   * one affected person speaks first, and argues the other way. `cvrSaidYes` remembers which
   * side they took, because it decides which person appears and what a switch means.
   */
  const handleCvrYes = useCallback(() => {
    const t = telRef.current;
    if (t && t.cvrShownAt != null) { t.cvrDwellMs += Math.max(0, Date.now() - t.cvrShownAt); t.cvrShownAt = null; }
    setCvrSaidYes(true);
    if (SHOW_STAKEHOLDER_PAGE) {
      if (t) t.personVisits += 1;
      setStep("person");
    } else {
      setStep("q1");
    }
  }, []);

  const handleCvrNo = useCallback(() => {
    const t = telRef.current;
    const now = Date.now();
    if (t && t.cvrShownAt != null) { t.cvrDwellMs += Math.max(0, now - t.cvrShownAt); t.cvrShownAt = null; }
    setCvrSaidYes(false);
    if (SHOW_STAKEHOLDER_PAGE) {
      if (t) t.personVisits += 1;
      setStep("person");
      return;
    }
    if (t) { t.apaVisits += 1; t.apaShownAt = now; }
    setStep("apa");
  }, []);

  /**
   * The answer on the person-speaks page. `moved` is the whole stakeholder measurement: it is
   * true when the participant ends up on the opposite side from where they started, which is the
   * only thing that tells us the person reached them.
   *
   * Where they land follows their FINAL position, not their first one:
   *   ends up keeping the option    -> the confirm flow
   *   ends up refusing it           -> the APA flow
   */
  const handlePersonAnswer = useCallback((moved: boolean) => {
    const t = telRef.current;
    const now = Date.now();
    setStakeholderMoved(moved);
    const endsUpKeeping = cvrSaidYes ? !moved : moved;
    if (endsUpKeeping) { setStep("q1"); return; }
    if (t) { t.apaVisits += 1; t.apaShownAt = now; }
    setStep("apa");
  }, [cvrSaidYes]);

  const handlePersonBackout = useCallback(() => {
    const t = telRef.current;
    if (t) t.personBackouts += 1;
    resetFlow();
  }, [resetFlow]);

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
    /*
      PLANNER LOG. Attached here because both result paths — a direct choice and an APA-committed
      choice — funnel through this one function, so neither can silently ship without it.

      `choiceRank` is the study's key dependent variable, and it is recorded ALONGSIDE
      `selectedRank` (the alignment position) rather than instead of it. The two are allowed to
      disagree, and the analysis is the question of when they do.
    */
    if (plan) {
      const p = plan.byId[result.selectedOptionId];
      result.plannerOrder = plan.orderedIds;
      result.plannerBins = Object.fromEntries(plan.orderedIds.map((id) => [id, plan.byId[id].bin]));
      result.plannerWins = Object.fromEntries(plan.orderedIds.map((id) => [id, plan.byId[id].wins]));
      result.plannerTopOptionId = plan.orderedIds[0];
      result.plannerCleanReferenceId = plan.cleanReferenceId ?? undefined;
      result.plannerValueOrder = plan.order;
      result.plannerDegradedProfile = decisionProfile.degraded;
      if (p) {
        result.choiceRank = p.rank;
        result.choiceBin = p.bin;
        result.choiceMatchedPlannerTop = p.rank === 1;
        result.choiceMatchedAlignedTop = labeled[0]?.id === result.selectedOptionId;
        result.choiceCrossedOwnRedLine = p.breaches.some((b) => b.hard);
        result.choiceBreaches = p.breaches.map((b) => ({ key: b.key, amount: b.amount, hard: b.hard }));
        result.choiceUsedTradeOff = p.ignoredTopValueAgainst.length > 0;
      }
    }

    // Snapshot the 4 policy values + the two reflection lenses AFTER this scenario's update,
    // so the results view can chart how each evolved across the journey.
    result.policySnapshotAfter = policyScoresOf(nextProfile);
    result.framingSnapshotAfter = framingScoresOf(nextProfile);
    // Stakeholder too: Stability measures movement across all five scored values, and this is
    // the largest single mover in the block.
    result.stakeholderSnapshotAfter = nextProfile.dimensions
      .find((d) => d.key === "stakeholderPerspectiveShiftSensitivity")?.score ?? 50;
    const nextResults = [...progress.scenarioResults, result];
    const nextIndex = progress.currentScenarioIndex + 1;
    if (nextIndex >= BLOCK5_SCENARIOS.length) {
      const vci = computeVCI(nextResults);
      // Measured against the profile as it entered Block 5 — the Blocks 1-4 baseline.
      const stab = computeStability(nextResults, userProfile);
      const finalResults: Block5Results = {
        completed: true,
        completedAt: new Date().toISOString(),
        userProfile: nextProfile,
        originalProfile: userProfile,
        scenarioResults: nextResults,
        vci: vci.value, vciLevel: vci.level,
        stability: stab.value, stabilityLevel: stab.level,
        stabilityDetail: {
          orderPart: stab.orderPart, movementPart: stab.movementPart,
          pairsSwapped: stab.pairsSwapped, churn: stab.churn,
          topValueBefore: stab.topValueBefore, topValueAfter: stab.topValueAfter,
        },
        performance: averagePerformance(nextResults),
        // Share of the performance actually on the table, averaged over the scenarios that ran.
        // Kept beside the raw mean rather than replacing it — see block5Performance.ts.
        performanceCaptured: overallCaptured(nextResults),
        performanceCapturedLevel: capturedLabel(overallCaptured(nextResults)),
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
    setOpenOptionId(null);
    setPreviewOptionId(null);
    setCompareChartsOpen(false);
    resetFlow();
  }, [progress, userProfile, onComplete, resetFlow, plan, decisionProfile, labeled]);

  const commitChoice = useCallback((opt: LabeledOption, opts: {
    nextProfile: Block5UserProfile;
    endorsement: CVREndorsement;
    stakeholderGuided: boolean | null;
  }) => {
    if (!scenario) return;

    const origLabeled = labelOptions(scenario.options, userProfile);
    const origLevel = origLabeled.find((o) => o.id === opt.id)?.level;
    const alignedToOriginal = origLevel === "aligned" || origLevel === "weakly_aligned";

    /*
     * DID A REFLECTION ACTUALLY RUN? Not "is this option misaligned?".
     *
     * These are the same question everywhere except a recipient scenario, which is why writing
     * `isMisaligned(opt.level)` here went unnoticed. On a wish no reflection ever opens, so every
     * field below that describes one has to be recorded as absent — otherwise the stored row says a
     * participant was shown a vignette they never saw, carries a CVR coordinate for a reflection
     * that did not happen, and would be counted in by any analysis filtering on `cvrFired`.
     *
     * A measure can survive a wrong pixel. It cannot survive data that misdescribes what occurred.
     */
    const cvrRan = scenarioIsScored(scenario) && isMisaligned(opt.level);
    const coord = cvrRan ? cvrCoordinate(opt, profile) : undefined;

    // Dual-perspective record (YES / keep path). Only populated when a reflection actually ran, and
    // the selection/−20 only when the participant generated the other lens and answered the question.
    const framingFields: Partial<Block5ScenarioResult> = {};
    if (cvrRan) {
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
      cvrFired: cvrRan,
      cvrEndorsement: opts.endorsement,
      cvrCoordinate: coord,
      stakeholderGuided: opts.stakeholderGuided,
      alignedToOriginal,
      decisionRole: scenario.decisionRole ?? "decider",
      introSeconds: introSecondsRef.current[scenario.id],
      vciScore: scenarioVciScore(opt.level),
      performanceScore: performanceScore(opt),
      performanceCaptured: capturedOf(scenario, opt),
      performanceMenu: { worst: Math.round(menuRange(scenario).worst), best: Math.round(menuRange(scenario).best) },
      metrics: optionMetrics(opt),
      cvrStakeholderShown: cvrWho?.label,
      telemetry: telRef.current
        ? buildScenarioTelemetry(telRef.current, {
            cvrFired: cvrRan,
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
      decisionRole: scenario.decisionRole ?? "decider",
      introSeconds: introSecondsRef.current[scenario.id],
      vciScore: scenarioVciScore(opt.level),
      performanceScore: performanceScore(opt),
      performanceCaptured: capturedOf(scenario, opt),
      performanceMenu: { worst: Math.round(menuRange(scenario).worst), best: Math.round(menuRange(scenario).best) },
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
    // Keeping an option that already fits reinforces the value it is built on, and eases off a
    // value it neglects. The amounts and the guards live in applyKeepUpdates so the scoring rule
    // sits with the other scoring rules and can be simulated (tools/simulate_vci.cjs).
    // Everyday scenarios teach the profile less than a life-and-death one (scenario.stakesWeight).
    /*
     * A WISH TEACHES THE PROFILE NOTHING. In a recipient scenario the profile is carried through
     * untouched, so Stability measures only the movement that actual decisions produced.
     *
     * This is also why the null model behind STABILITY_CHURN_CEILING had to be re-measured after
     * these scenarios landed: a deck where one scenario cannot move the profile produces less
     * accumulated churn than a deck where every scenario can, and the ceiling is a measurement of
     * the deck rather than a threshold anyone chose.
     */
    const nextProfile = scenario && !scenarioIsScored(scenario)
      ? profile
      : applyKeepUpdates(
          profile, selectedOption, selectedOption.level, scenario?.stakesWeight ?? 1,
        );
    commitChoice(selectedOption, { nextProfile, endorsement: "n/a", stakeholderGuided: null });
  }, [selectedOption, profile, scenario, commitChoice]);

  const handleConfirmEndorsement = useCallback(() => {
    // stakeholderMoved replaces the old "did hearing this influence you?" answer. It is set on
    // the person-speaks page by whether they switched sides, which is an observation rather than
    // a self-report. Under the legacy flow the page is skipped, so fall back to "not moved".
    const moved = SHOW_STAKEHOLDER_PAGE ? stakeholderMoved : false;
    if (!selectedOption || q1Strong === null || moved === null) return;
    // Dual-perspective: −20 to the lens the participant said did NOT influence keeping the option
    // (only when they generated the other lens and answered). Committed here, with the endorsement.
    const framingAdjust: FramingAdjust | null = altViewGenerated && framingChoiceYes
      ? { sensitivityKey: framingSensitivityKey(framingChoiceYes), delta: -20 }
      : null;
    const nextProfile = applyEndorsementUpdates(
      profile, selectedOption, q1Strong, moved, framingAdjust, scenario?.stakesWeight ?? 1,
    );
    commitChoice(selectedOption, {
      nextProfile,
      endorsement: q1Strong ? "strong" : "weak",
      stakeholderGuided: moved,
    });
  }, [selectedOption, profile, scenario, q1Strong, stakeholderMoved, altViewGenerated, framingChoiceYes, commitChoice]);

  if (!scenario) return null;

  /*
   * THE SCENE COMES BEFORE THE OPTIONS.
   *
   * Every scenario opens on a page of its own carrying the description, the numbers, the
   * participant's role and — in the workplace pair — the employer's published principle, with
   * nothing to click but "continue". Position is the one thing Block 5 varies, and on the
   * simulation page that material sits in a sidebar next to six clickable cards, where a
   * participant in a hurry can miss it entirely. A manipulation half the sample skims is a
   * manipulation half the sample never received.
   *
   * Shown once per scenario. Re-reading is available from the sidebar, but the gate does not
   * re-fire on a re-render or a mid-scenario refresh.
   */
  /*
   * The intro is drawn OVER the scenario page rather than instead of it. That is what makes the
   * transition possible: both screens exist at the same moment, so each intro card can be measured
   * against the sidebar card it is about to become. Rendered as a replacement, there would be
   * nothing on screen to travel to.
   *
   * The page underneath is inert while the overlay is up — it is covered, and the overlay owns the
   * scroll.
   */
  const introOpen = !introSeen.has(scenario.id);

  // Resolved color palette for the current mode (fresh light theme / cleaned dark theme).
  const pal = getBlock5Palette(scenario, colorMode === "light" ? "light" : "dark");

  /** Deciding or wishing — every string that differs between the two. See DECISION_COPY. */
  const decisionCopy = DECISION_COPY[scenario.decisionRole ?? "decider"];

  /**
   * The employer's published principle, chosen from the participant's FROZEN profile.
   *
   * Derived here rather than inside the card so it is computed once per scenario and so the card
   * stays a presentational component. `userProfile` is the pre-Block-5 snapshot: reading the live
   * profile would let the company's values drift along with the participant's, and the conflict
   * this scenario is built on would quietly dissolve exactly when they started to move.
   */
  const company = scenario.employer
    ? deriveCompanyValues(userProfile, scenario.employer)
    : null;

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
    <>
      {/*
        THE OVERLAY IS A SIBLING OF THE PAGE, NOT A CHILD OF IT.

        Nested inside, every `[data-morph]` lookup on the page root would find the OVERLAY's own
        cards first — they come earlier in document order — and each card would be measured against
        itself, producing a transition that travels nowhere. As siblings, the two subtrees are
        disjoint and each lookup can only find what it is meant to.
      */}
      {introOpen && (
        <Block5ScenarioIntro
          rootRef={introRef}
          scenario={scenario}
          frozenProfile={userProfile}
          index={progress.currentScenarioIndex + 1}
          total={BLOCK5_SCENARIOS.length}
          onBegin={(secondsSpent) => {
            introSecondsRef.current[scenario.id] = secondsSpent;
            /* Put the page at its top BEFORE the morph measures anything. The transition reads
               each destination card's position in the viewport, so a page left scrolled would send
               the cards flying to coordinates that are about to change — and would drop the
               participant into the middle of the option list. */
            window.scrollTo({ top: 0, behavior: "auto" });
            /* The cards fly to their sidebar positions FIRST; the overlay is dismissed only once
               they have arrived. Unmounting first would delete the elements being animated. */
            runMorph(introRef.current, pageRef.current, () => {
              setIntroSeen((prev) => new Set(prev).add(scenario.id));
            });
          }}
        />
      )}
    <Box ref={pageRef} minH="100dvh" style={{ background: pal.pageBg }} px={{ base: "4", md: "6", lg: "8" }} py={{ base: "6", md: "8" }}>
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
      <Box ref={dashRef} position="sticky" top="2" zIndex="30" maxW="7xl" mx="auto" mb="6">
        <MetricsDashboard current={cumulative} projected={projected} previewTitle={previewOption?.title ?? null}
          accent={pal.accent} completedCount={progress.scenarioResults.length} pal={pal} scenarioId={scenario.id} />
      </Box>

      <Grid ref={gridRef} templateColumns={{ base: "1fr", lg: "352px 1fr" }} gap={{ base: "6", lg: "8" }} maxW="7xl" mx="auto" alignItems="start">
        {/*
          Sidebar column.

          It has NO height cap and NO inner scroll: everything in it is always fully rendered.
          It becomes sticky only when the effect above has measured that it fits in the space
          below the dashboard — see the comment there for why that measurement matters.
        */}
        <VStack
          ref={sideRef}
          align="stretch" gap="4"
          css={{
            "@media (min-width: 62em)": {
              "&[data-stick='on']": {
                position: "sticky",
                top: "calc(var(--b5-dash-h, 132px) + 1.5rem)",
              },
            },
          }}
        >
          {/*
            The scenario card. The advisor's note was that this did not catch the eye, and it did
            not: a 5%-white panel, a 2xs label and body copy in the muted text color made the
            most important content on the page the faintest thing on it. It now leads with a
            solid accent header band — the only fully saturated surface in the column — and the
            description is set at full text color, one size up.
          */}
          <Box
            data-morph="scene"
            bg={pal.sidebarBg} backdropFilter={pal.backdropBlur}
            borderWidth="1px" borderColor={pal.accent}
            rounded="2xl" overflow="hidden"
            style={{ boxShadow: pal.sidebarShadow }}
          >
            <HStack
              gap="2.5" px={{ base: "5", md: "6" }} py="3"
              style={{ background: pal.accent, color: onAccentText(pal.accent) }}
            >
              <Icon boxSize="4"><LuScale /></Icon>
              <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="widest">
                The scenario
              </Text>
            </HStack>
            <VStack align="stretch" gap="5" px={{ base: "5", md: "6" }} py={{ base: "5", md: "5" }}>
              <Text fontSize="md" color={pal.text} lineHeight="tall">{scenario.description}</Text>
              {scenario.factBase && (
                /*
                  THREE FIELDS, THREE JOBS — and they used to be two that said the same thing.
                    description  the general problem: what has happened, and where.
                    factBase     the numbers, identical for every option.
                    role         who the participant is, and who carries the cost.

                  Before this split, `description` restated the scarcity that `factBase` was
                  supposed to own, four of the five scenarios had no numbers at all, and the
                  participant's position — the block's entire manipulation — was a clause buried
                  mid-paragraph where a skimming reader would miss it. `role` is now the last thing
                  read before the options, with its own rule above it.
                */
                <Box
                  borderWidth="1px" borderLeftWidth="5px" rounded="lg" px="4" py="3.5"
                  style={{
                    background: `${pal.accent}1F`,
                    borderColor: `${pal.accent}59`,
                    borderLeftColor: pal.accent,
                  }}
                >
                  <HStack gap="2" mb="2">
                    <Center boxSize="5" minW="5" rounded="full"
                      style={{ background: pal.accent, color: onAccentText(pal.accent) }}>
                      <Icon boxSize="3"><LuTriangleAlert /></Icon>
                    </Center>
                    <Text fontSize="2xs" fontWeight="bold" color={pal.text} textTransform="uppercase" letterSpacing="wider">
                      The situation right now
                    </Text>
                  </HStack>
                  <Text fontSize="md" color={pal.text} lineHeight="tall" fontWeight="semibold">{scenario.factBase}</Text>
                </Box>
              )}
            </VStack>
          </Box>

          {/*
            YOUR ROLE — its own card, and the loudest one in the column. See ScenarioRoleCard for
            why the block's independent variable is no longer a clause inside the scene.
          */}
          {scenario.role && <ScenarioRoleCard scenario={scenario} pal={pal} />}

          {/*
            THE EMPLOYER'S PUBLISHED PRINCIPLE — only in the workplace pair, and placed directly
            under the role card because it is the second half of the same fact: this is who you
            are, and this is what you are being asked to work under.
          */}
          {company && <CompanyPrincipleCard company={company} pal={pal} />}

          {/*
            YOUR VALUE PRIORITIES — split out of the scene card at the same time. Three cards that
            each answer one question (what is happening / who am I in it / what do I care about)
            read faster than one card that answers all three behind two separators, and it lets
            the role card sit between the situation and the priorities, which is the order the
            participant actually needs them in.
          */}
          <Box
            bg={pal.sidebarBg} backdropFilter={pal.backdropBlur}
            borderWidth="1px" borderColor={pal.cardBorder}
            rounded="2xl" overflow="hidden"
            style={{ boxShadow: pal.sidebarShadow }}
          >
            <VStack align="stretch" gap="5" px={{ base: "5", md: "6" }} py={{ base: "5", md: "5" }}>
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
                        {/*
                          DISPLAY rounding only — d.score keeps its full precision everywhere it
                          is scored against. The APA and CVR bumps are weighted by scenario
                          stakes, so a score can land on 99.075, and printing that next to a
                          clean 100 and 26 reads as a glitch rather than as precision.
                        */}
                        <Badge bg={pal.badgeBg} color={pal.text} rounded="md" px="2" fontSize="xs" fontFamily="mono">{Math.round(d.score)}</Badge>
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
            Two radar charts: what each option achieves, and what each one prioritizes.
          </Text>
        </VStack>

        {/* Options */}
        <VStack align="stretch" gap="4">
          <Box>
            <Text fontSize="2xs" fontWeight="bold" color={pal.accent} textTransform="uppercase" letterSpacing="widest">
              The options — choose one policy
            </Text>
            <Text fontSize="xs" color={pal.textFaint} mt="1">
              All {displayOptions.length} options are available, and every one of them can be chosen.
            </Text>
          </Box>

          {/*
            THE PLANNER PANEL. Shown identically in every scenario, for every participant, whether
            or not anything is actually blocked. It must NOT appear only when a limit is crossed:
            an explanation that fires exactly where the measurement is most sensitive would be an
            uncontrolled manipulation. See docs/BLOCK5_PLANNER_ORDERING_PLAN.md §10.
          */}
          <Box bg={pal.panelDeep} borderWidth="1px" borderColor={pal.cardBorder} rounded="xl"
            px={{ base: "3.5", md: "4" }} py="3">
            <HStack gap="2" mb="2" align="center">
              <Icon color={pal.accent} boxSize="3.5"><LuScale /></Icon>
              <Text fontSize="2xs" fontWeight="bold" letterSpacing="widest" textTransform="uppercase" color={pal.accent}>
                Why these are in this order
              </Text>
            </HStack>
            <Stack gap="1.5">
              <Text fontSize="xs" color={pal.text} lineHeight="tall">{panelText.rankingLine}</Text>
              <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">{panelText.limitsLine}</Text>
              <Text fontSize="xs" color={pal.textFaint} lineHeight="tall">{panelText.noteLine}</Text>
            </Stack>
          </Box>

          {displayOptions.map((opt, i) => {
            const ex = explanations[opt.id];
            const prev = i > 0 ? explanations[displayOptions[i - 1].id] : null;
            // A divider is drawn the first time the bin changes, so the three groups read as one
            // continuous numbered list rather than three separate lists.
            const divider = ex && ex.bin !== "clear" && (!prev || prev.bin !== ex.bin)
              ? BIN_DIVIDER[ex.bin]
              : null;
            return (
              <Box key={opt.id}>
                {divider && (
                  <HStack gap="3" mb="4" mt="1" align="center">
                    <Box flex="1" h="1px" bg={pal.separator} />
                    <Text fontSize="2xs" color={pal.textFaint} textTransform="uppercase"
                      letterSpacing="wider" textAlign="center" lineHeight="tall">
                      {divider}
                    </Text>
                    <Box flex="1" h="1px" bg={pal.separator} />
                  </HStack>
                )}
                <OptionCard option={opt} profile={profile} accent={pal.accent} pal={pal}
                  explanation={ex ?? null}
                  standing={standings[opt.id] ?? null}
                  scenarioId={scenario.id}
                  copy={decisionCopy}
                  expanded={openOptionId === opt.id} onToggle={() => toggleExpand(opt.id)}
                  /* Every card stops hinting the moment ANY of them has been opened. */
                  hintDetails={expandedOptions.size === 0}
                  onSelect={() => handleSelect(opt.id)}
                  isPreviewing={previewOptionId === opt.id} onPreview={() => togglePreview(opt.id)}
                  impact={previewOptionId === opt.id ? impactFor(opt) : null}
                  disabled={step !== null} />
              </Box>
            );
          })}
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
          stakeholderMoved={stakeholderMoved}
          onKeep={handleKeep}
          onConfirmEndorsement={handleConfirmEndorsement}
          onApaCommit={handleApaCommit}
          onChangeMyMind={resetFlow}
          cvrSaidYes={cvrSaidYes}
          onPersonAnswer={handlePersonAnswer}
          onPersonBackout={handlePersonBackout}
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
    </>
  );
}

/* ---------------- Cumulative performance dashboard ---------------- */

/** LocalStorage key remembering whether the participant hid the metric definitions. */
const METRIC_MEANINGS_KEY = "block5_show_metric_meanings";

/**
 * EVERY PIECE OF COPY THAT DIFFERS BETWEEN DECIDING AND WISHING, in one table.
 *
 * A recipient scenario asks a genuinely different question — not "what will you do?" but "what do
 * you want done to you?" — and the interface has to say so consistently or the manipulation leaks.
 * A participant who is told they are powerless and then handed a button marked "Choose this option"
 * has been given two contradictory accounts of their own position, and the one they believe is the
 * one the button implies.
 *
 * Collected here rather than spread across a dozen ternaries because the failure mode is a single
 * missed string: five places saying "wish" and one saying "choose" reads as a bug to a participant
 * and, worse, quietly restores the sense of agency the scenario exists to remove.
 */
const DECISION_COPY = {
  decider: {
    cardAction: "Choose this option",
    dialogEyebrow: "Your choice",
    fitsIntro: "This option fits your earlier priorities. Before you confirm, take a moment with what it gives up.",
    commit: "Keep this choice",
    reconsider: "Change my mind",
  },
  recipient: {
    cardAction: "I wish for this one",
    dialogEyebrow: "What you wish for",
    /*
     * NOT USED ON THE RECIPIENT PATH — see RecipientConfirm below, which replaces this whole
     * paragraph. Kept only so both roles share one shape.
     *
     * The recipient page cannot reuse the decider's line. That line says "this option fits your
     * earlier priorities", which is true on the decider path because the page only appears there
     * when the option DOES fit. On the recipient path the page appears for every wish, including
     * ones that go against the participant's own values — and telling somebody their choice matches
     * their values when it does not is simply a false statement shown to a participant.
     */
    fitsIntro: "",
    commit: "Yes, this is what I hope they choose",
    reconsider: "Go back and look again",
  },
} as const;

/**
 * The sentence under the badge. Says the same thing twice — once as a label, once as a sentence —
 * because the badge is easy to skim past and this is the fact the participant most needs.
 *
 * The misaligned wording matters most. A participant who wishes for something that goes against
 * their own stated values must not be made to feel caught out: the point of this scenario is to
 * find out what people want when it lands on them, and a page that reads like a telling-off
 * teaches them to answer the way the software seems to want. "You can still wish for it" is there
 * to make the permission explicit.
 */
const WISH_FIT_SENTENCE: Record<AlignmentLevel, string> = {
  aligned:
    "This is close to what you said matters most to you in the earlier questions.",
  weakly_aligned:
    "This is fairly close to what you said matters most to you in the earlier questions.",
  misaligned:
    "This is not what you said matters most to you in the earlier questions. That is fine — you can still wish for it.",
  strongly_misaligned:
    "This is quite far from what you said matters most to you in the earlier questions. That is fine — you can still wish for it.",
};

/**
 * WHERE THE PARTICIPANT STANDS, drawn as three fixed rows.
 *
 * `stakePosition` is the ONLY thing Block 5 deliberately varies across its five scenarios — the
 * participant decides alone, then for a household that depends on them, then three times for
 * people they will never meet. Every other moving part of the block exists to be held constant
 * against it. It had been carried by one clause of prose inside a callout inside the scene card,
 * which is a fragile place to put the manipulation: a participant who skims the scene misses it
 * entirely, and then the position contrast the whole design rests on never happened for them.
 *
 * The three rows are the SAME THREE IN THE SAME ORDER in every scenario, so what changes between
 * scenarios is only which of them is lit. That is what makes the contrast visible rather than
 * merely present — a participant who reads the card in scenario 1 and again in scenario 3 sees
 * the emphasis move from the top row to the bottom one.
 *
 * The wording is deliberately careful about the third row. In the two scenarios where the
 * participant is themselves at risk, other residents are still affected by what the participant
 * takes on the way out — the sidebar's own fact base says so — so the row says that rather than
 * claiming nobody else is involved. Overstating the isolation would be a tidier graphic and a
 * false one.
 */
const STAKE_VIEW: Record<StakePosition, {
  badge: string;
  headline: string;
  actors: { key: string; icon: ReactNode; label: string; state: string; strong: boolean }[];
}> = {
  self: {
    badge: "Deciding alone",
    headline: "You are one of the people at risk here — and you are the only one.",
    actors: [
      { key: "you", icon: <LuUserRound />, label: "You",
        state: "At risk. The way out you are choosing is your own.", strong: true },
      { key: "with", icon: <LuUsersRound />, label: "People with you",
        state: "Nobody. No one depends on you here, and no one is coming for you.", strong: false },
      { key: "other", icon: <LuGlobe />, label: "Everyone else",
        state: "Not yours to save — but affected by whatever you use and whatever you leave.", strong: false },
    ],
  },
  self_and_group: {
    badge: "Deciding for your household",
    headline: "You are at risk, and so are the people who depend on you.",
    actors: [
      { key: "you", icon: <LuUserRound />, label: "You",
        state: "At risk. You are choosing your own way out as well as theirs.", strong: true },
      { key: "with", icon: <LuUsersRound />, label: "Your household",
        state: "At risk with you, and they cannot make this choice for themselves.", strong: true },
      { key: "other", icon: <LuGlobe />, label: "Everyone else",
        state: "Not yours to save — but affected by whatever you use and whatever you leave.", strong: false },
    ],
  },
  others: {
    badge: "Deciding for other people",
    headline: "You are not at risk. Every consequence of this choice lands on someone else.",
    actors: [
      { key: "you", icon: <LuUserRound />, label: "You",
        state: "Not at risk. Nothing you decide here reaches you.", strong: false },
      { key: "with", icon: <LuUsersRound />, label: "People close to you",
        state: "Not involved. Nobody you know is on the receiving end of this.", strong: false },
      { key: "other", icon: <LuGlobe />, label: "The people affected",
        state: "They carry all of it. Every cost of this decision is theirs.", strong: true },
    ],
  },
  /*
   * The workplace pair. These two differ from the three above on a second axis: not who pays, but
   * WHOSE VALUES GOVERN and WHETHER THE PARTICIPANT HOLDS THE PEN. The rows are worded so the
   * contrast between them is unmissable when the same six options appear a second time — in the
   * first, the participant's own row is the one that decides; in the second, it is the one that
   * waits.
   */
  under_authority: {
    badge: "Deciding inside your employer's rules",
    headline: "You are making this call at work, under values your employer has already published.",
    actors: [
      { key: "you", icon: <LuUserRound />, label: "You",
        state: "You decide. Your own hours are not touched, so none of this cost is yours.", strong: false },
      { key: "with", icon: <LuUsersRound />, label: "Your colleagues",
        state: "They carry it. The other caregivers work whatever schedule you set.", strong: true },
      { key: "other", icon: <LuGlobe />, label: "Your employer",
        state: "Sets the rule you work under. It carries none of the cost itself.", strong: false },
    ],
  },
  receiving_end: {
    badge: "It is being decided for you",
    headline: "Someone else will decide this. This time, it happens to you.",
    actors: [
      { key: "you", icon: <LuUserRound />, label: "You",
        state: "You have no say. You will be told what was decided, and you will work it.", strong: true },
      { key: "with", icon: <LuUsersRound />, label: "The coordinator",
        state: "They decide. They are choosing from the same six options you can see here.", strong: false },
      { key: "other", icon: <LuGlobe />, label: "Your clients",
        state: "They carry it with you. These are the same visits, seen from the other side.", strong: true },
    ],
  },
};

/**
 * ScenarioRoleCard — "who you are in this one", as a card of its own.
 *
 * It is the loudest thing in the sidebar on purpose: a 2px accent border, an accent ring, a solid
 * accent header and a tinted body, where the scene card beside it has a solid header and a plain
 * body. Nothing else in the column competes with it, because nothing else in the column is the
 * study's independent variable.
 */
/**
 * CompanyPrincipleCard — what the employer says it stands for, and what the participant scored.
 *
 * DELIBERATELY QUIETER THAN THE ROLE CARD, and drawn in neutral grey rather than the scenario
 * accent. The role card is the study's independent variable and should shout; this one is a
 * document the participant has been handed. Giving it the same emphasis would make the sidebar two
 * competing headlines, and — more to the point — an employer principle rendered in the interface's
 * own celebratory color reads as the interface endorsing it. The dotted border and the muted
 * palette say "this is their position, not ours", which is exactly the distance the scenario needs.
 *
 * THE PARTICIPANT'S OWN SCORE IS SHOWN NEXT TO IT, from the frozen profile. Without it the conflict
 * is something the participant has to reconstruct from memory of Blocks 1–3; with it, the gap is on
 * the screen. That matters because the whole scenario turns on their noticing it.
 */
/**
 * THE EMPLOYER'S PUBLISHED PRINCIPLE — scenarios 4 and 5 only.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS CARD IS THE LOUDEST THING ON THE PAGE
 *
 * Scenarios 4 and 5 are not about a fire or a ward. They are about being asked to work under a
 * value you do not hold. If the participant does not NOTICE the employer's principle, and does
 * not notice that it is the value they personally rated LOWEST, they are not in the dilemma — they
 * are just picking options. The conflict is the manipulation, so the conflict has to be legible in
 * about two seconds.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY IT DOES NOT USE THE SCENARIO'S OWN COLOR
 *
 * Every other card on the page is tinted with the scenario accent. An employer's demand rendered
 * in the interface's own color reads as the interface AGREEING with it, and this study must not
 * put a thumb on that scale. So the chrome is deliberately institutional — a slate letterhead that
 * belongs to the company, not to us.
 *
 * Amber appears in exactly one place: the strip that names the disagreement. That is semantic, not
 * decorative — it marks a mismatch, the same way a warning does everywhere else in the interface.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THE PARTICIPANT'S OWN SCORE IS NOT SHOWN HERE
 *
 * This card briefly drew the company's position against the participant's own, and said this was
 * the value they rated lowest. Both numbers came from the FROZEN pre-Block-5 profile, while the
 * "your value priorities" card directly below it shows the LIVE one. A participant whose score had
 * moved therefore saw two different numbers for themselves, stacked, on the same screen.
 *
 * Switching to the live number would have fixed that and broken two other things: "the one you
 * rated lowest" stops being true once the profile moves, and the gap would then differ between
 * scenarios 4 and 5 — a pair deliberately built to present identically.
 *
 * So the card states what the COMPANY holds and says nothing about the participant. Their own
 * priorities are already on screen immediately below it, and the comparison is theirs to draw.
 * That is also the more honest position for an instrument whose whole purpose is to measure
 * whether they draw it.
 */
const PRINCIPLE_CONFLICT = { light: "#b45309", dark: "#fbbf24" } as const;
const PRINCIPLE_LETTERHEAD = { light: "#334155", dark: "#0f172a" } as const;

export function CompanyPrincipleCard({ company, pal, variant = "sidebar" }: {
  company: DerivedCompanyValues; pal: Block5Palette; variant?: "hero" | "sidebar";
}) {
  const hero = variant === "hero";
  const warn = PRINCIPLE_CONFLICT[pal.mode];
  const head = PRINCIPLE_LETTERHEAD[pal.mode];
  const px = hero ? { base: "5", md: "8" } : { base: "5", md: "6" };

  return (
    <Box
      data-morph="employer"
      rounded="2xl" overflow="hidden"
      borderWidth={hero ? "2px" : "1px"} borderColor={head}
      bg={pal.panelDeep}
      style={{ boxShadow: hero ? `0 0 0 5px ${warn}26, 0 18px 40px rgba(0,0,0,0.28)` : pal.cardShadow }}
    >
      {/* ---- letterhead: this is the COMPANY speaking, not the interface ---- */}
      <HStack gap="2.5" px={px} py={hero ? "3.5" : "2.5"} style={{ background: head, color: "#ffffff" }}>
        <Icon boxSize={hero ? "4.5" : "3.5"}><LuBuilding2 /></Icon>
        <Text fontSize={hero ? "xs" : "2xs"} fontWeight="bold"
          textTransform="uppercase" letterSpacing="widest" lineHeight="short">
          {company.principleLabel}
        </Text>
      </HStack>

      {/* ---- the published sentence ---- */}
      <HStack align="start" gap={hero ? "3" : "2"} px={px} pt={hero ? "5" : "4"} pb={hero ? "4" : "3"}>
        <Text flex="0 0 auto" aria-hidden="true" color={warn} lineHeight="0.8"
          fontSize={hero ? "5xl" : "3xl"} fontFamily="Georgia, 'Times New Roman', serif">
          &ldquo;
        </Text>
        <Stack gap={hero ? "2.5" : "1.5"} minW="0">
          <Text fontSize={hero ? { base: "lg", md: "xl" } : "sm"} fontWeight="bold"
            color={pal.text} lineHeight="tall">
            {company.principle}
          </Text>
          <Text fontSize={hero ? "sm" : "xs"} color={pal.textMuted} lineHeight="tall">
            {company.rationale}
          </Text>
        </Stack>
      </HStack>

      {/* ---- the value the company puts first: stated, not scored ---- */}
      <Box px={px} py={hero ? "4" : "3"} borderTopWidth="1px"
        style={{ background: `${warn}14`, borderTopColor: `${warn}4D` }}>
        <Text fontSize="2xs" fontWeight="bold" color={warn}
          textTransform="uppercase" letterSpacing="widest" mb={hero ? "2" : "1.5"}>
          The value {company.name} puts first
        </Text>
        <Text fontSize={hero ? { base: "xl", md: "2xl" } : "md"} fontWeight="bold" fontStyle="italic"
          color={warn} lineHeight="short">
          {POLICY_DIM_SHORT[company.statedKey]}
        </Text>
      </Box>
    </Box>
  );
}

export function ScenarioRoleCard({ scenario, pal }: { scenario: Block5Scenario; pal: Block5Palette }) {
  const view = scenario.stakePosition ? STAKE_VIEW[scenario.stakePosition] : null;
  const onAccent = onAccentText(pal.accent);
  return (
    <Box
      data-morph="role"
      bg={pal.sidebarBg} backdropFilter={pal.backdropBlur}
      borderWidth="2px" borderColor={pal.accent}
      rounded="2xl" overflow="hidden"
      style={{ boxShadow: `0 0 0 4px ${pal.accent}1F, ${pal.sidebarShadow}` }}
    >
      <HStack gap="2" px={{ base: "4", md: "5" }} py="3" justify="space-between" align="center"
        style={{ background: pal.accent, color: onAccent }}>
        <HStack gap="2.5" minW="0">
          <Icon boxSize="4"><LuUserRound /></Icon>
          <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="widest">
            Your role
          </Text>
        </HStack>
        {view && (
          <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider"
            px="2" py="0.5" rounded="md" textAlign="right" lineHeight="short"
            style={{ background: onAccent === "#ffffff" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.3)" }}>
            {view.badge}
          </Text>
        )}
      </HStack>

      <VStack align="stretch" gap="3.5" px={{ base: "5", md: "6" }} py={{ base: "4", md: "5" }}
        style={{ background: `${pal.accent}14` }}>
        {view && (
          <Text fontSize="md" fontWeight="bold" color={pal.text} lineHeight="tall">{view.headline}</Text>
        )}
        {/* The people are marked with {w|…} — the same "who is affected" color the CVR uses — so
            the person a decision lands on looks the same everywhere in the block, from this
            sidebar through to the vignette. */}
        <Text fontSize="sm" color={pal.text} lineHeight="tall">
          {renderCVRMarkup(scenario.role ?? "", cvrMarks(pal.mode))}
        </Text>

        {view && (
          <Box borderTopWidth="1px" pt="3.5" style={{ borderTopColor: `${pal.accent}59` }}>
            <Text fontSize="2xs" fontWeight="bold" color={pal.textMuted}
              textTransform="uppercase" letterSpacing="wider" mb="2.5">
              Who this choice lands on
            </Text>
            <VStack align="stretch" gap="2.5">
              {view.actors.map((a) => (
                <HStack key={a.key} gap="2.5" align="start">
                  <Center boxSize="6" minW="6" rounded="lg" flexShrink={0}
                    style={a.strong
                      ? { background: pal.accent, color: onAccent }
                      : { background: pal.surfaceSubtle, color: pal.textFaint, border: `1px solid ${pal.separator}` }}>
                    <Icon boxSize="3.5">{a.icon}</Icon>
                  </Center>
                  <Box minW="0">
                    <Text fontSize="xs" fontWeight={a.strong ? "bold" : "semibold"}
                      color={a.strong ? pal.text : pal.textMuted}>
                      {a.label}
                    </Text>
                    <Text fontSize="2xs" lineHeight="tall" color={a.strong ? pal.text : pal.textFaint}>
                      {a.state}
                    </Text>
                  </Box>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
}

function MetricsDashboard({ current, projected, previewTitle, accent, completedCount, pal, scenarioId }: {
  current: Block5MetricProfile;
  projected: Block5MetricProfile | null;
  previewTitle: string | null;
  accent: string;
  completedCount: number;
  pal: Block5Palette;
  /** Which scenario is on screen — decides which reading of each metric is shown. */
  scenarioId: string;
}) {
  /**
   * Definitions are shown UNDER each metric by default rather than hidden behind a hover.
   *
   * With the earlier eight metrics there was no room and hover was the only option, which meant the meaning
   * was invisible to anyone who did not think to hover — and invisible on touch entirely. Five
   * metrics leave room to simply say what each one means. The participant can collapse them once
   * they know, and that choice is remembered across scenarios.
   */
  const [showMeanings, setShowMeanings] = useState<boolean>(() => {
    try { return localStorage.getItem(METRIC_MEANINGS_KEY) !== "0"; } catch { return true; }
  });
  const toggleMeanings = useCallback(() => {
    setShowMeanings((v) => {
      const next = !v;
      try { localStorage.setItem(METRIC_MEANINGS_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const [showInfo, setShowInfo] = useState(false);
  const [infoOpened, setInfoOpened] = useState(false); // stops the glow once the user opens the explanation
  const isPreview = !!projected;
  const display = projected ?? current;
  const overall = metricProfileScore(display);
  const baseOverall = metricProfileScore(current);
  const overallDelta = overall - baseOverall;
  // Delta colors tuned for legibility in each mode.
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
            className={infoOpened ? undefined : "vrds-glow-ring"}
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
          {/* Lets the participant collapse the definitions once they know them, without
              hiding them from anyone who never thinks to hover. */}
          <Button size="2xs" variant="ghost" rounded="md" fontSize="2xs" fontWeight="medium"
            color={pal.textMuted} _hover={{ bg: pal.surfaceSubtle, color: pal.text }}
            onClick={toggleMeanings}>
            {showMeanings ? "Hide definitions" : "Show definitions"}
          </Button>
          <Badge bg={accent} color={onAccentText(accent)} rounded="md" px="2.5" py="1" fontSize="xs" fontWeight="bold">Overall {overall}/100</Badge>
        </HStack>
      </HStack>

      {showInfo && (
        <Box bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder} rounded="lg" px="4" py="3" mb="3">
          {/*
            THIS PANEL USED TO DESCRIBE A BLOCK THAT NO LONGER EXISTS. It said "these 8 bars" when
            there are five, and it named the four VALUES — total benefit, fairness, protecting the
            vulnerable — as though they were the performance measures. Those are the two things a
            participant most needs kept apart, and the one explanation offered for the gauge was
            running them together.

            It now says the three things that are actually true and are actually confusable: this
            is a record of choices already made, the same five names inside a card are a forecast
            for one option not yet chosen, and neither has anything to do with the alignment label.
          */}
          <VStack align="start" gap="2">
            <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
              These five bars are a running record of <b>your own choices</b> — not a score for any option
              in front of you. Each time you confirm a choice, that option's five readings are
              <b> averaged</b> in, so the bars start at zero, fill in as you go, and can never pass 100.
              “Preview impact” on a card shows what they <b>would become</b> if you picked it, without
              picking it.
            </Text>
            <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
              The same five names appear inside each option card, under “What this option achieves”. Those
              describe <b>one option you have not chosen</b>, placed against the other five on this table.
              They are not your score.
            </Text>
            <Text fontSize="xs" color={pal.textFaint} lineHeight="tall">
              All of this is <b>outcome quality</b>. How well an option matches <b>your values</b> is a
              separate thing entirely — that is the alignment label on each card.
            </Text>
          </VStack>
        </Box>
      )}

      {!showInfo && (
        <Text fontSize="xs" color={pal.textFaint} mb="3" lineHeight="tall">
          {isPreview
            ? "Preview only — your choice isn't saved until you confirm it."
            : completedCount === 0
              ? "This is the average outcome quality of the policies you choose. Each measure says what it means for this scenario."
              : "Average across the scenarios you've completed. Each measure says what it means for this scenario."}
        </Text>
      )}

      <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(5, 1fr)" }} gap={{ base: "3", md: "4" }}>
        {METRIC_KEYS.map((k) => {
          const val = display[k];
          const delta = val - current[k];
          return (
            <Box key={k} position="relative" cursor="default">
              <HStack justify="space-between" mb="1">
                <Text fontSize="xs" fontWeight="semibold" color={pal.text} lineClamp={1}>{METRIC_LABELS[k]}</Text>
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
              {showMeanings && (
                /* The reading for THIS scenario — "how soon safe water is back", not a generic
                   gloss. The label above stays constant so the dashboard remains comparable. */
                <Text fontSize="2xs" color={pal.textFaint} lineHeight="tall" mt="1.5">
                  {metricMeaning(k, scenarioId)}
                </Text>
              )}
            </Box>
          );
        })}
      </Grid>
    </Box>
  );
}

/* ---------------- Option card ---------------- */

function OptionCard({ option, profile, accent, pal, explanation, standing, scenarioId, copy, expanded, onToggle, onSelect, isPreviewing, onPreview, impact, disabled, hintDetails }: {
  option: LabeledOption; profile: Block5UserProfile; accent: string; pal: Block5Palette;
  /** Planner state for this card, or null before the planner has run. */
  explanation: CardExplanation | null;
  /** Where this option's five metrics sit inside the range its scenario offers. */
  standing: { rows: MetricStanding[]; overall: OverallStanding } | null;
  /** Chooses which reading of each metric to show — "speed" is not the same thing in every scenario. */
  scenarioId: string;
  /** Deciding-versus-wishing wording for this scenario. See DECISION_COPY. */
  copy: (typeof DECISION_COPY)[keyof typeof DECISION_COPY];
  expanded: boolean; onToggle: () => void; onSelect: () => void;
  isPreviewing: boolean; onPreview: () => void; impact: PreviewImpact | null; disabled: boolean;
  /**
   * True until the participant has opened ANY option's details in this scenario.
   *
   * Drives the slow ring on the details button. It is deliberately a property of the scenario
   * rather than of this card: the six cards teach the same control, so once one of them has been
   * opened the lesson has landed and all six go quiet together. Leaving them all breathing would
   * put six pulsing controls on one screen, competing with the primary action.
   */
  hintDetails: boolean;
}) {
  /* No alignment color on this card — the tier is not shown to the participant anywhere now. */
  const pos = pal.mode === "light" ? "#15803d" : "#86efac";
  const neg = pal.mode === "light" ? "#b91c1c" : "#fca5a5";
  /*
    BIN TREATMENT. A blocked card is recessed, never disabled and never red. The study exists to
    measure whether people cross lines they drew themselves, which is unmeasurable if the interface
    refuses the click — and a warning color would be the interface expressing disapproval, which
    is a variable nobody meant to introduce. It recedes; it does not object.
  */
  const recessed = explanation?.bin === "blocked";
  /*
    THE OPEN CARD IS TINTED, not merely taller.

    Only one detail panel can be open at a time, so when a participant opens a second card the
    first one silently collapses somewhere off-screen. Without a mark on the card itself, the only
    evidence of which one is open is a panel they may have to scroll to find. The tint and the ring
    travel with the card, so the answer is visible wherever it happens to sit.

    `isPreviewing` keeps its 2px accent border and wins when both are true: a preview is a live
    calculation the participant triggered, and it should not be visually outranked by a panel
    being open.

    The four properties that CHANGE with the open state are set through `style` rather than as
    Chakra props, so the open and closed appearances sit next to each other in one object and can
    be read as a pair. `data-card-open` carries the same state as an attribute, which is what makes
    the whole thing inspectable from a test without reaching into React.

    A shadow LIST containing "none" is invalid CSS and the browser drops the entire declaration, so
    the ring is filtered before it is joined — `pal.cardShadow` is "none" in dark mode.
  */
  return (
    <Box data-card-open={expanded ? "1" : "0"}
      backdropFilter={pal.backdropBlur}
      rounded="2xl" p={{ base: "5", md: "6" }}
      style={{
        background: expanded && !isPreviewing ? pal.panelDeep : pal.cardBg,
        borderStyle: "solid",
        borderWidth: isPreviewing || expanded ? "2px" : "1px",
        borderColor: isPreviewing ? accent : expanded ? `${accent}80` : pal.cardBorder,
        boxShadow: expanded && !isPreviewing
          ? [`0 0 0 4px ${accent}1F`, pal.cardShadow].filter((v) => v && v !== "none").join(", ")
          : pal.cardShadow,
      }}
      opacity={disabled ? 0.5 : recessed ? 0.82 : 1} transition="all 0.2s ease" _hover={disabled ? {} : { opacity: 1 }}>
      <Flex justify="space-between" align="start" gap="4" wrap="wrap">
        <HStack align="start" gap="3" minW="0" flex="1">
          {explanation && (
            /* The planner's position. Deliberately NOT merged with the alignment tier beside it:
               a participant must be able to see a card labelled "Aligned" sitting at rank 4. */
            <Flex flexShrink={0} align="center" justify="center" w="7" h="7" rounded="lg"
              borderWidth="1px" borderColor={pal.cardBorder} bg={pal.panelDeep} mt="0.5">
              <Text fontSize="sm" fontWeight="bold" color={pal.text} fontFamily="mono" lineHeight="1">
                {explanation.rank}
              </Text>
            </Flex>
          )}
          <VStack align="start" gap="1" minW="0" flex="1">
            <Text color={pal.text} fontWeight="semibold" fontSize="md" lineHeight="short">{option.title}</Text>
            <Text color={pal.textMuted} fontSize="sm" lineHeight="tall">{option.summary}</Text>
          </VStack>
        </HStack>
        {/*
          NO TAG CLUSTER IN THIS CORNER.

          Four badges used to sit here before the participant had read a word of the option: the
          alignment tier, the planner bin, an "Align NN" score and a "Perf Nth of 6" placing.

          WHY THE ALIGNMENT TIER IS GONE. VCI asks whether a participant's choices fit their own
          values. Printing "Misaligned" on the card answers that question for them, so a compliant
          participant scores well on VCI by reading a label rather than by holding a position —
          the measure stops being about them.

          WHY THE NUMBERS ARE GONE. "Align 62" and "Perf 4th of 6" are summaries of material the
          card already states in words, and a number at the top of a card reads as a mark out of
          100 before anything explains it.

          NOTHING WAS DELETED, ONLY MOVED. The bin ("Has a cost" / "Crosses a limit you set") and
          the performance placing now sit inside the "Ranked N — why" panel below, each under a
          heading that says which of the two things it belongs to. The bin still has to be visible
          somewhere: choosing an option that crosses a limit only records a willingness to cross
          it if the participant could see that it did.
        */}
      </Flex>

      {/*
        THE TRADE-OFF — the most important thing on the card.
        This used to be a single muted line that participants skipped straight past. It is now an
        inset, color-coded panel: what you GAIN in green, what you GIVE UP in red, and the moral
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

      {/*
        WHY IT RANKED HERE — generated entirely from planner state (block5PlannerText.ts).
        Nothing here is authored per option: an explanation written by hand could disagree with the
        ordering it is explaining, and a participant who notices that stops believing any of it.
      */}
      {explanation && (
        <Box mt="3" bg={pal.panelDeep} borderWidth="1px" borderColor={pal.separator}
          rounded="xl" px={{ base: "3.5", md: "4" }} py="3">
          <Text fontSize="2xs" fontWeight="bold" letterSpacing="widest" textTransform="uppercase"
            color={pal.textFaint} mb="2.5">
            Ranked {explanation.rank} — why
          </Text>

          {/*
            TWO HEADINGS, BECAUSE THESE ARE TWO DIFFERENT SUBJECTS.

            The prose above the chips is about VALUES — which of the participant's priorities this
            option honors and which it sets aside. The chips below are about PERFORMANCE — how the
            option does on the five outcome measures. Unlabeled, they read as one continuous
            explanation, and a participant can finish the panel believing a strong performance
            placing is a statement about their values.
          */}
          <Text fontSize="2xs" fontWeight="bold" letterSpacing="wider" textTransform="uppercase"
            color={pal.textMuted} mb="1.5">
            What it does for your values
          </Text>
          <Stack gap="1.5">
            <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
              {explanation.winsLine}{explanation.decidedLine ? ` ${explanation.decidedLine}` : ""}
            </Text>
            {explanation.referenceLine && (
              <Text fontSize="xs" color={pal.text} lineHeight="tall">{explanation.referenceLine}</Text>
            )}
            {explanation.tradeLine && (
              <Text fontSize="xs" color={pal.text} lineHeight="tall" fontStyle="italic">
                {explanation.tradeLine}
              </Text>
            )}
            {explanation.breachLine && (
              <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">{explanation.breachLine}</Text>
            )}
            {/* The planner bin — moved down from the card corner, kept where the values live. */}
            {explanation.binLabel && (
              <Box>
                <Badge bg="transparent" color={pal.textFaint} borderWidth="1px" borderColor={pal.separator}
                  rounded="md" px="2" py="0.5" fontSize="2xs" fontWeight="semibold">
                  {explanation.binLabel}
                </Badge>
              </Box>
            )}

            {/*
              THE FIT SCORE, SAID QUIETLY.

              This is the same `matchScore` that used to sit in the card corner as a mono "Align
              62" badge. Up there it read as a mark out of 100 awarded to the participant, and it
              was the first thing on the card — a verdict before a word of the option had been
              read.

              Here it is the last line of the values section, in the faintest text on the card, as
              a sentence rather than a score. It is available to a participant who wants a number
              and easy to pass over for one who does not, which is the correct weight for a
              summary of the four statements printed directly above it.
            */}
            <Text fontSize="2xs" color={pal.textFaint} lineHeight="tall" pt="0.5">
              Matches your earlier answers: {option.matchScore} out of 100.
            </Text>
          </Stack>

          {(explanation.chips.length > 0 || standing) && (
            <Box mt="3" pt="2.5" borderTopWidth="1px" borderColor={pal.separator}>
              <Text fontSize="2xs" fontWeight="bold" letterSpacing="wider" textTransform="uppercase"
                color={pal.textMuted} mb="1.5">
                How it performs
              </Text>
              <HStack gap="2" wrap="wrap">
                {/*
                  The overall placing, spelled out rather than abbreviated to "Perf". It leads the
                  row because the five chips beside it are placings on single measures, and the
                  combined standing is what they add up to.
                */}
                {/*
                  Tinted, while the five beside it stay neutral. This one is the COMBINED standing
                  and the others are single measures, so they are different kinds of fact sitting
                  in one row. Identically styled, the row reads as six equal chips and the summary
                  disappears into its own components.
                */}
                {standing && (
                  <Badge rounded="md" px="2" py="0.5" fontSize="2xs" fontWeight="bold"
                    color={accent} borderWidth="1px"
                    style={{ background: `${accent}1A`, borderColor: `${accent}59` }}
                    title={`On the five outcome measures combined, this is the ${ordinal(standing.overall.rank)} strongest of the ${standing.overall.total} options in this scenario`}>
                    Performance {ordinal(standing.overall.rank)} of {standing.overall.total}
                  </Badge>
                )}
                {explanation.chips.map((c) => (
                  <Badge key={c} bg={pal.badgeBg} color={pal.badgeText} rounded="md" px="2" py="0.5" fontSize="2xs">
                    {c}
                  </Badge>
                ))}
              </HStack>
            </Box>
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
        {/*
          THE DETAILS CONTROL — dressed as a control.

          This was a ghost button in muted text, sitting between an outlined "Preview impact" and
          a solid "Choose this option". It was the only thing in a row of buttons with no border
          and no background, in the lowest-contrast text on the card, and participants read it as
          a caption rather than something to press — which meant the values and the metrics, the
          two things this block is built to have them weigh, went unopened.

          It now has a surface, a border, full-contrast text, and its chevron in a chip of its
          own. It stays quieter than "Choose this option", which is still the primary action.

          THE RING is the discovery aid, and it removes itself. It breathes slowly (3.2s, the
          beacon's tempo) rather than pulsing (1.6s), because a fast pulse reads as a warning and
          this is an invitation. The moment the participant opens any card's details, hintDetails
          goes false for all six and the ring never returns in this scenario.
        */}
        <Button
          size="sm"
          variant="outline"
          className={hintDetails && !expanded ? "vrds-hint-breathe" : undefined}
          css={hintDetails && !expanded ? { "--hint-c": `${accent}59` } : undefined}
          bg={expanded ? pal.surfaceSubtle : pal.cardBg}
          borderColor={hintDetails && !expanded ? accent : pal.cardBorder}
          color={pal.text}
          _hover={{ bg: pal.surfaceSubtle, borderColor: accent }}
          rounded="lg"
          onClick={onToggle}
          gap="2"
          fontSize="xs"
          fontWeight="semibold"
        >
          {expanded ? "Hide details" : "See value & metric details"}
          <Center
            boxSize="4"
            rounded="md"
            bg={pal.surfaceSubtle}
            color={hintDetails && !expanded ? accent : pal.textMuted}
            flexShrink={0}
          >
            <Icon boxSize="3">{expanded ? <LuChevronUp /> : <LuChevronDown />}</Icon>
          </Center>
        </Button>
        <Button size="sm" variant="outline"
          borderColor={isPreviewing ? accent : pal.cardBorder} color={isPreviewing ? accent : pal.textMuted}
          bg={isPreviewing ? pal.surfaceSubtle : "transparent"}
          _hover={{ bg: pal.surfaceSubtle }} rounded="lg" onClick={onPreview} disabled={disabled} gap="1" fontSize="xs">
          <Icon boxSize="3.5"><LuEye /></Icon>
          {isPreviewing ? "Previewing impact" : "Preview impact"}
        </Button>
        <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" onClick={onSelect} disabled={disabled} fontSize="xs" fontWeight="semibold">
          {copy.cardAction}
        </Button>
      </HStack>

      {expanded && (
        <Box mt="4" pt="4" borderTopWidth="1px" borderColor={pal.separator}>
          <Text fontSize="xs" fontWeight="semibold" color={pal.textMuted} textTransform="uppercase" letterSpacing="wider" mb="2">
            How this option fits your values
          </Text>
          <Text fontSize="2xs" color={pal.textFaint} mb="3" lineHeight="tall">
            The marker line is your priority for each value. A bar that reaches or passes the line satisfies that value;
            a gap below the line is a shortfall that lowers alignment. On every bar here a LONGER bar is better.
          </Text>
          <VStack align="stretch" gap="3">
            {POLICY_DIM_KEYS.map((k) => {
              const dim = profile.dimensions.find((d) => d.key === k);
              return (
                <SensitivityMeterBar key={k} label={dim?.label ?? k} optionScore={option.fingerprint[k]}
                  userScore={dim?.score ?? 50} accentColor={accent} mode={pal.mode}
                  higherMeans={POLICY_DIM_HIGHER_MEANS[k]} />
              );
            })}
          </VStack>
          <Box mt="3"><MeterLegend mode={pal.mode} /></Box>

          {/*
            WHAT IT ACHIEVES — the other half of the same question, in the same panel.

            The card already says what the option IS (title, summary, trade-off) and how it meets
            the participant's VALUES (bars above). Until now the five outcome measures lived only
            as three word-chips and a session dashboard at the top of the page, so the connection
            between "this is what I believe", "this is what this option does to those beliefs" and
            "this is what it actually achieves" was never on screen at once.

            Every bar is drawn against the range this scenario's six options span, because a metric
            score is only ever a position within its own scenario — see MetricStandingBar.
          */}
          {standing && (
            <Box mt="5" pt="4" borderTopWidth="1px" borderColor={pal.separator}>
              <Text fontSize="xs" fontWeight="semibold" color={pal.textMuted} textTransform="uppercase" letterSpacing="wider" mb="2">
                What this option achieves
              </Text>
              <Text fontSize="2xs" color={pal.textFaint} mb="3" lineHeight="tall">
                These five say how well the option works, never who it helps — that is what the values above
                are for. Each one is scored against the other {standing.overall.total - 1} options on this
                table, so a bar reaching the green tick is the best this situation allows, and one sitting at
                the red tick is the weakest anything here manages.
              </Text>
              <VStack align="stretch" gap="3">
                {standing.rows.map((m) => (
                  <MetricStandingBar key={m.key}
                    label={METRIC_LABELS[m.key]}
                    reading={metricMeaning(m.key, scenarioId)}
                    score={m.score} worst={m.worst} best={m.best}
                    rank={m.rank} total={m.total} mode={pal.mode} />
                ))}
              </VStack>
              <Box mt="3"><MetricStandingLegend mode={pal.mode} total={standing.overall.total} /></Box>

              {/*
                THE CLOSING LINE LEADS WITH THE PLACING, NOT THE PERCENTAGE.

                `captured` is a min-max position, so on every table the weakest option scores
                exactly 0 and the strongest exactly 100. On its own, "takes 0% of the outcome
                quality" reads as "this option achieves nothing" — which is false: the 0% option
                in scenario 1 scores 45/46/71/72/37 and is simply last of six.

                Leading with "6th of 6" says the true thing in the same grammar as the five bars
                above, and the percentage then does the job a placing cannot: it says HOW FAR APART
                the placings are. In scenario 1 the top three options land on 100, 99 and 96 — near
                enough identical overall while reaching it by completely different routes — and a
                bare ranking would hide that the participant is choosing between near-equals.
              */}
              <Box mt="3" bg={pal.tradeoffBg} borderWidth="1px" borderColor={pal.tradeoffBorder}
                rounded="lg" px="3.5" py="2.5">
                <Text fontSize="xs" color={pal.text} lineHeight="tall">
                  Taken together, this is the{" "}
                  <Text as="span" fontWeight="bold">
                    {ordinal(standing.overall.rank)} strongest of the {standing.overall.total} options here
                  </Text>{" "}
                  on the five measures combined.
                </Text>
                <Text fontSize="2xs" color={pal.textFaint} mt="1" lineHeight="tall">
                  It scores <Text as="span" fontWeight="semibold">{standing.overall.captured} out of 100</Text>{" "}
                  on a scale where the strongest option on this table is 100 and the weakest is 0. That is a
                  comparison inside this scenario only — it says nothing about the other four.
                </Text>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/* ---------------- CVR vignette: LLM-style "thinking → streaming" reveal ---------------- */

interface CVRSeg { text: string; color?: string; bold?: boolean; italic?: boolean }

/** Parses {x|…} CVR markup into styled segments (same color key as renderCVRMarkup). */
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

/** Renders the first `shown` characters across styled segments (preserving per-segment color). */
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
      <Icon color={accent} boxSize="4" className="vrds-glow-ring"
        animation="glow-ring 1.6s ease-in-out infinite"><LuSparkles /></Icon>
      <Text fontSize="sm" color="fg.muted" fontStyle="italic">
        {label}<AnimatedDots />
      </Text>
    </HStack>
  );
}

/**
 * Two-pill segmented control to switch box 1 between the two reflection views.
 *
 * It takes no framing any more: the pills are named by POSITION, so which lens sits behind each one
 * is not something this component needs to know or could usefully say.
 */
function ViewToggle({ current, accent, onSelect }: {
  current: "first" | "second"; accent: string;
  onSelect: (v: "first" | "second") => void;
}) {
  const pill = (view: "first" | "second") => {
    const active = current === view;
    return (
      <Button size="2xs" rounded="full" px="3" fontSize="2xs" fontWeight="bold"
        bg={active ? accent : "transparent"} color={active ? "white" : "fg.muted"}
        _hover={active ? {} : { bg: "bg.muted", color: "fg" }}
        onClick={() => onSelect(view)}>
        {VIEW_LABEL[view]}
      </Button>
    );
  };
  return (
    <HStack gap="0.5" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="full" p="0.5">
      {pill("first")}
      {pill("second")}
    </HStack>
  );
}

/**
 * Side-by-side comparison of the two reflection lenses, using the exact framing clauses the
 * participant saw. Shown next to the dual-perspective question so the choice is unmistakable.
 */
function FramingComparisonTable({ scenario, option, coord, mode }: {
  scenario: Block5Scenario; option: LabeledOption; coord: CVRCoordinate; mode: "light" | "dark";
}) {
  const marks = cvrMarks(mode);
  const lenses = getCVRLensPair(scenario, option, coord);
  const markColor = marks.f.color;
  const cell = (framing: CVRFraming) => (
    <Box flex="1" minW="0" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="lg" px="3" py="2.5">
      <Text fontSize="2xs" fontWeight="bold" color="fg" mb="1">
        <Text as="span" color={markColor}>▍</Text> {viewLabelFor(framing, coord.framing)}
        <Text as="span" color="fg.subtle" fontWeight="normal"> — {FRAMING_META[framing].gloss}</Text>
      </Text>
      <Text fontSize="2xs" color="fg.subtle" fontWeight="semibold" mb="1">{lenses[framing].heading}</Text>
      <Text fontSize="2xs" color="fg.muted" lineHeight="tall">{renderCVRMarkup(lenses[framing].prompt, marks)}</Text>
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
function CVRReveal({ story, altStory, factBase, accent, mode, onAltGenerated, onCvrYes, onCvrNo, onCvrBackout }: {
  story: ReturnType<typeof getCVRStory>;
  /** the SAME vignette with the framing flipped (the other reflection lens). */
  altStory: ReturnType<typeof getCVRStory>;
  factBase?: string;
  level: AlignmentLevel;
  accent: string;
  /** color mode — picks the bright (dark) vs darker (light) CVR highlight colors. */
  mode: "light" | "dark";
  /** called once when the participant generates the alternate lens (lifts state to FlowOverlay). */
  onAltGenerated: () => void;
  onCvrYes: () => void; onCvrNo: () => void; onCvrBackout: () => void;
}) {
  type Phase = "thinking" | "box1" | "box2" | "settle" | "done";
  const [phase, setPhase] = useState<Phase>("thinking");
  const [b2Step, setB2Step] = useState(0); // the re-endorse question: 0 = typing, 2 = done
  /**
   * How far the LENS BLOCK has streamed.
   *
   * 0 = its opening paragraph is typing · 1..n = the nth consequence is typing ·
   * n+1 = the closing line is typing · n+2 = the whole block is on screen.
   *
   * The block used to appear whole, in one frame, immediately under a paragraph that had just
   * typed itself out character by character. The seam was obvious: the first half looked like it
   * was being written and the second half looked like it had been sitting there all along. The
   * consequences are also the part the reflection actually turns on, so they are the last thing
   * that should arrive without being read.
   */
  const [b2Part, setB2Part] = useState(0);
  const [skipped, setSkipped] = useState(false);

  // Dual-perspective: alt-view generation state + which lens box 1 currently shows.
  type AltState = "none" | "regenThinking" | "regenTyping" | "ready";
  const [altState, setAltState] = useState<AltState>("none");
  const [currentView, setCurrentView] = useState<"first" | "second">("first");
  /* Nothing on screen names a lens any more, so the second framing is no longer needed here —
     `altStory` is passed in already built. */
  const marks = cvrMarks(mode); // mode-aware highlight colors for the vignette markup

  // Random "thinking" wait (2–5s) on every arrival, then begin generating the first view.
  useEffect(() => {
    const ms = 2000 + Math.random() * 3000;
    const id = setTimeout(() => setPhase("box1"), ms);
    return () => clearTimeout(id);
  }, []);

  // A short beat after the question finishes typing, then the answer buttons arrive. The pause
  // is kept: without it the buttons appear on the same frame as the last character of the
  // question, which reads as the interface hurrying the participant into answering.
  useEffect(() => {
    if (phase !== "settle") return;
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

  const skip = useCallback(() => { setSkipped(true); setB2Step(2); setB2Part(999); setPhase("done"); }, []);
  /**
   * Generating the second lens.
   *
   * onAltGenerated fires HERE, on the click — not when the new text finishes typing, which is
   * where it used to fire. The CVR answer buttons stay live during that typing, so a participant
   * who pressed generate and then answered straight away was recorded as never having generated
   * the second view: they were not asked which lens moved them, and the framing adjustment could
   * not be applied. Nothing was corrupted, but an observation was silently lost. Pressing the
   * button IS the act being recorded, so the click is the honest moment to record it.
   */
  const generateAlt = useCallback(() => {
    setAltState("regenThinking");
    onAltGenerated();
  }, [onAltGenerated]);

  /**
   * Which story is on screen: the first lens, or the second once the participant generated it.
   * Both the recontext paragraph and the lens block read from this, so they can never disagree.
   */
  const shownStory = altState === "ready" && currentView === "second" ? altStory : story;

  /** The lens block's parts, and the cursor value that means "all of it is on screen". */
  const lensPoints = shownStory.lens?.points ?? [];
  const b2Done = lensPoints.length + 2;
  /** A vignette with no lens block has nothing to wait for, so it must not gate what follows. */
  const b2Complete = skipped || !shownStory.lens || b2Part >= b2Done;

  /* Generating the second lens re-streams the whole block, not just its first paragraph — the
     consequences are what actually differ between the two lenses. */
  useEffect(() => {
    if (altState === "regenTyping") setB2Part(0);
  }, [altState]);

  /* The second lens is "ready" once its LAST line has typed, not its first. */
  useEffect(() => {
    if (altState === "regenTyping" && b2Part >= b2Done) {
      setAltState("ready");
      setCurrentView("second");
    }
  }, [altState, b2Part, b2Done]);

  const showBox1 = skipped || phase !== "thinking";
  const showBox2 = skipped || phase === "box2" || phase === "settle" || phase === "done";
  const showButtons = skipped || phase === "done";
  const revealComplete = skipped || phase === "done";

  /*
   * Box 1 — the facts and the trade-off. It no longer changes when the second lens is generated.
   *
   * It used to re-type itself, because the framing clause lived inside this paragraph. The
   * framing now has its own block, so the two versions of this paragraph are IDENTICAL — the
   * animation was re-typing the same sentence while the actual change happened silently below.
   * The regeneration now plays where the change really is: in the lens block.
   */
  let box1Inner: ReactNode;
  if (phase === "box1" && !skipped && altState === "none") {
    box1Inner = (
      <Typed text={story.recontext} marks={marks} accent={accent} fontSize="sm" color="fg" lineHeight="tall"
        onComplete={() => setPhase("box2")} />
    );
  } else {
    box1Inner = <Text fontSize="sm" color="fg" lineHeight="tall">{renderCVRMarkup(shownStory.recontext, marks)}</Text>;
  }

  return (
    <Stack gap="4">
      {/* No alignment verdict is shown here. This page asks the participant to re-read the choice
          they already made; stamping "Misaligned with your values" across the top of it answers
          the question for them before they have started thinking. */}
      <HStack justify="flex-end" align="center" gap="2">
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
              boxShadow="0 0 0 1px rgba(124,58,237,0.4)" className="vrds-glow-ring"
              animation="glow-ring 1.8s ease-in-out infinite"
              onClick={generateAlt}>
              ✨ Generate the {VIEW_LABEL.second.toLowerCase()}
            </Button>
          )}
          {(altState === "regenThinking" || altState === "regenTyping") && (
            <Text fontSize="2xs" color="fg.subtle" fontStyle="italic">Generating…</Text>
          )}
          {altState === "ready" && (
            <ViewToggle current={currentView} accent={accent} onSelect={setCurrentView} />
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

      {/*
        THE LENS — the reflection made visible rather than asserted.

        CONTEXT shows the participant's own rule running in an equally serious second setting;
        DIRECTNESS shows the same list produced by their own hand rather than by a process. Which
        one appears is chooseFraming()'s decision; generating the other view swaps this whole
        block, which is why the alt-view toggle now reads shownStory instead of story.
      */}
      {showBox2 && shownStory.lens && (
        <Box
          bg="bg.subtle" borderWidth="1px" borderColor="border.emphasized"
          borderLeftWidth="4px" borderLeftColor={accent}
          rounded="xl" px="4" py="4"
          animationName="fade-in" animationDuration="moderate"
        >
          <Text fontSize="2xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
            {altState === "regenThinking" || altState === "regenTyping"
              ? (altStory.lens ? altStory.lens.heading : shownStory.lens.heading)
              : shownStory.lens.heading}
          </Text>
          {altState === "regenThinking" ? (
            <CVRThinking accent={accent} label={`Building the ${VIEW_LABEL.second.toLowerCase()}`} />
          ) : (
            <>
              {/* the opening paragraph */}
              {skipped || b2Part > 0 ? (
                <Text fontSize="sm" color="fg" lineHeight="tall" mb="3">
                  {renderCVRMarkup(shownStory.lens.body, marks)}
                </Text>
              ) : (
                <Typed
                  text={shownStory.lens.body} marks={marks} accent={accent}
                  fontSize="sm" color="fg" lineHeight="tall" mb="3"
                  onComplete={() => setB2Part(1)}
                />
              )}

              {/*
                The consequences, one per line with its own time label. A paragraph would bury the
                second one, and separate short lines are far easier to read in a second language
                than a single sentence carrying two clauses.

                They arrive ONE AT A TIME. Revealing both at once put the delayed consequence on
                screen before the immediate one had been read, which is the wrong way round for a
                block whose whole point is that the second follows from the first.
              */}
              {lensPoints.length > 0 && (skipped || b2Part >= 1) && (
                <Stack gap="2.5" mb="3">
                  {lensPoints.map((pt, i) => {
                    if (!skipped && b2Part < i + 1) return null;
                    const settled = skipped || b2Part > i + 1;
                    return (
                      <Box key={pt.label} borderLeftWidth="2px" borderLeftColor={accent} pl="3"
                        animationName="fade-in" animationDuration="fast">
                        <Text fontSize="2xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="0.5">
                          {pt.label}
                        </Text>
                        {settled ? (
                          <Text fontSize="sm" color="fg" lineHeight="tall">
                            {renderCVRMarkup(pt.text, marks)}
                          </Text>
                        ) : (
                          <Typed
                            text={pt.text} marks={marks} accent={accent}
                            fontSize="sm" color="fg" lineHeight="tall"
                            onComplete={() => setB2Part(i + 2)}
                          />
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}

              {/* the closing line — who decided this */}
              {(skipped || b2Part >= lensPoints.length + 1) && (
                skipped || b2Part > lensPoints.length + 1 ? (
                  <Text fontSize="sm" color="fg" fontWeight="semibold" lineHeight="tall">
                    {renderCVRMarkup(shownStory.lens.prompt, marks)}
                  </Text>
                ) : (
                  <Typed
                    text={shownStory.lens.prompt} marks={marks} accent={accent}
                    fontSize="sm" color="fg" fontWeight="semibold" lineHeight="tall"
                    onComplete={() => setB2Part(lensPoints.length + 2)}
                  />
                )
              )}
            </>
          )}
        </Box>
      )}

      {/*
        THE QUESTION — and only the question.
        ---------------------------------------------------------------------------------------
        The person who is affected used to appear here, above this line. They now have a page of
        their own, AFTER the answer, so that this page asks exactly one thing. Two questions with
        one set of buttons was the complaint that started this redesign; the lens above states,
        this asks, and nothing else on the page is a question.
      */}
      {/* Waits for the lens block to finish streaming. `b2Step >= 2` keeps it on screen afterwards:
          generating the second lens rewinds the block above, and a question that vanished from
          under a participant who had already read it would be worse than one that arrives late. */}
      {showBox2 && (b2Step >= 2 || b2Complete) && (
        <Box animationName="fade-in" animationDuration="moderate">
          {skipped || b2Step >= 2 ? (
            <Text fontSize="md" color="fg" fontWeight="semibold" lineHeight="tall">{renderCVRMarkup(story.reendorseQuestion, marks)}</Text>
          ) : (
            <Typed text={story.reendorseQuestion} marks={marks} accent={accent} fontSize="md" color="fg" fontWeight="semibold" lineHeight="tall"
              onComplete={() => { setB2Step(2); setPhase("settle"); }} />
          )}
        </Box>
      )}

      {/* The color key that used to sit here is gone along with the verdict badge. It named the
          highlight colors, and one of the things it named was the framing — the very thing this
          page is asking the participant to notice for themselves. The highlights stay in the
          prose, where they do their work without being labelled. */}

      {showButtons && (
        <HStack gap="3" wrap="wrap" animationName="fade-in" animationDuration="moderate">
          <ChoiceWithMeaning
            accent={accent} primary
            label="Yes, I'd still choose it"
            meaning="Yes — even after seeing this, I would still choose this option."
            onClick={onCvrYes}
          />
          <ChoiceWithMeaning
            accent={accent}
            label="No, not any more"
            meaning="No — after seeing this, I would not choose this option."
            onClick={onCvrNo}
          />
          {/* No tooltip: this one already says exactly what it does. */}
          <Button size="sm" variant="ghost" color="fg.subtle" _hover={{ bg: "bg.subtle" }} rounded="lg" onClick={onCvrBackout} fontSize="xs">
            Back to all the options
          </Button>
        </HStack>
      )}
    </Stack>
  );
}

/**
 * A short label plus the long sentence it stands for.
 *
 * The buttons were originally written out in full ("I still endorse this option even though after
 * seeing the stakeholder perspective didn't change my priority"). That is precise but hard to read
 * at a glance, and it asks the participant to narrate WHY they are choosing — which the system
 * already knows, and which can nudge them. The button is short; the full sentence is one hover,
 * tap or keyboard-focus away, so nothing is hidden.
 */
function ChoiceWithMeaning({ label, meaning, accent, primary, onClick }: {
  label: string; meaning: string; accent: string; primary?: boolean; onClick: () => void;
}) {
  return (
    <Tooltip content={meaning} showArrow openDelay={120} closeDelay={80} contentProps={{ maxW: "sm" }}>
      <Button
        onClick={onClick}
        size="sm" rounded="lg" fontSize="xs" whiteSpace="normal" height="auto" py="2.5" px="3.5"
        textAlign="left"
        bg={primary ? accent : "bg.subtle"}
        color={primary ? onAccentText(accent) : "fg"}
        borderWidth={primary ? "0" : "1px"}
        borderColor="border.emphasized"
        _hover={primary ? { opacity: 0.9 } : { bg: "bg.muted" }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

/**
 * THE PERSON WHO SPEAKS — shown after the participant answers the vignette.
 *
 * The person always argues AGAINST the answer just given: after "yes" they are the person the
 * choice costs, after "no" the person who needed it. Everyone is therefore pushed exactly once,
 * which makes "did they switch?" a fair comparison between participants.
 *
 * Whether they switch is the entire stakeholder measurement — see handlePersonAnswer.
 */
function PersonSpeaksPage({ story, saidYes, accent, marks, onAnswer, onBack }: {
  story: ReturnType<typeof getCVRStory>;
  saidYes: boolean;
  accent: string;
  marks: MarkSet;
  onAnswer: (moved: boolean) => void;
  onBack: () => void;
}) {
  const text = saidYes ? story.people?.hurt : story.people?.need;
  return (
    <Stack gap="4">
      <Text fontSize="xs" color={accent} textTransform="uppercase" letterSpacing="wider" fontWeight="bold">
        Someone this affects
      </Text>

      <Box bg="purple.subtle" borderWidth="1px" borderColor="purple.muted" rounded="xl" px="4" py="4">
        <Text fontSize="sm" color="fg" lineHeight="tall">
          {renderCVRMarkup(text ?? "", marks)}
        </Text>
      </Box>

      <Text fontSize="md" color="fg" fontWeight="semibold" lineHeight="tall">
        {renderCVRMarkup("Now that you have heard this — {b|what do you think}?", marks)}
      </Text>

      <Stack gap="2.5">
        {saidYes ? (
          <>
            <ChoiceWithMeaning
              accent={accent} primary
              label="I still choose this"
              meaning="I still choose this option. Hearing this person did not change what matters to me."
              onClick={() => onAnswer(false)}
            />
            <ChoiceWithMeaning
              accent={accent}
              label="I've changed my mind — I don't want this now"
              meaning="I do not want this option any more. Hearing this person changed what matters to me."
              onClick={() => onAnswer(true)}
            />
          </>
        ) : (
          <>
            <ChoiceWithMeaning
              accent={accent} primary
              label="I still don't want this"
              meaning="I still do not want this option. Hearing this person did not change what matters to me."
              onClick={() => onAnswer(false)}
            />
            <ChoiceWithMeaning
              accent={accent}
              label="I've changed my mind — I do want this now"
              meaning="I do want this option now. Hearing this person changed what matters to me."
              onClick={() => onAnswer(true)}
            />
          </>
        )}
      </Stack>

      <Button size="sm" variant="ghost" color="fg.subtle" _hover={{ bg: "bg.subtle" }} rounded="lg"
        alignSelf="start" fontSize="xs" onClick={onBack}>
        Back to all the options
      </Button>
    </Stack>
  );
}

/* ---------------- Flow overlay (the decision steps) ---------------- */

function FlowOverlay({
  option, profile, scenario, accent, whoVariant, step, setStep,
  tradeoffAck, setTradeoffAck, q1Strong, setQ1Strong, stakeholderMoved,
  onKeep, onConfirmEndorsement, onApaCommit, onChangeMyMind,
  onCvrYes, onCvrNo, onCvrBackout, onApaBail, onFinalDecisionChange,
  cvrSaidYes, onPersonAnswer, onPersonBackout,
  altViewGenerated, onAltGenerated, framingChoiceYes, setFramingChoiceYes, mode,
}: {
  option: LabeledOption; profile: Block5UserProfile; scenario: Block5Scenario; accent: string;
  /** color mode for the modal (light/dark-aware surfaces + CVR highlight colors). */
  mode: "light" | "dark";
  whoVariant: WhoVariant | null;
  step: FlowStep; setStep: (s: FlowStep) => void;
  tradeoffAck: boolean; setTradeoffAck: (b: boolean) => void;
  q1Strong: boolean | null; setQ1Strong: (b: boolean) => void;
  /** whether the person who spoke moved them — replaces the old self-report question. */
  stakeholderMoved: boolean | null;
  onKeep: () => void; onConfirmEndorsement: () => void; onApaCommit: (p: ApaCommitPayload) => void; onChangeMyMind: () => void;
  // Telemetry wrappers for the CVR/APA transitions (observation only — same navigation).
  onCvrYes: () => void; onCvrNo: () => void; onCvrBackout: () => void;
  onApaBail: () => void; onFinalDecisionChange: () => void;
  /** which side they took on the vignette, and the answer on the person page. */
  cvrSaidYes: boolean | null;
  onPersonAnswer: (moved: boolean) => void;
  onPersonBackout: () => void;
  // Dual-perspective (Directness ↔ Context): generation flag + the YES-path "did NOT influence" answer.
  altViewGenerated: boolean; onAltGenerated: () => void;
  framingChoiceYes: CVRFraming | null; setFramingChoiceYes: (f: CVRFraming) => void;
}) {
  /*
   * "MISALIGNED" HERE MEANS "OPEN THE REFLECTION", NOT "SCORES BADLY".
   *
   * This read `isMisaligned(option.level)` alone, and that was a bug with teeth. The selection
   * handler guards the same question with `scenarioIsScored`, so on a recipient scenario it decides
   * NO reflection and never sets up the vignette. This line disagreed with it and said yes — so a
   * misaligned wish matched neither branch below: not the reflection (no vignette had been built)
   * and not the confirmation page (which tested `!misaligned`). The participant got a dialog with a
   * title, a sentence, and no buttons at all. Four of the six options are misaligned for every
   * archetype, so this was the majority path through scenario 5, not a corner.
   *
   * Both places now ask `scenarioIsScored` first, so they cannot disagree again.
   */
  const misaligned = scenarioIsScored(scenario) && isMisaligned(option.level);

  /*
   * The trade this option makes, for the confirm question — the same two values the APA page names
   * and the same two `applyEndorsementUpdates` moves. Built here so all three cannot drift apart.
   *
   * Value names are drawn in the CVR "violated value" color, bold and italic, exactly as they are
   * on the APA page: a participant who sees the same words styled the same way in both places can
   * tell they are being asked about the same thing twice, rather than about two different things.
   */
  const confirmTrade = (() => {
    const cm = cvrMarks(mode);
    const servedKey = optionMainValue(option);
    const sacrificedKey = violatedValue(option, profile);
    const span = (k: Block5PolicyDimKey, color: string) => (
      <Text as="span" color={color} fontWeight="bold" fontStyle="italic">{POLICY_DIM_SHORT[k]}</Text>
    );
    const score = (k: Block5PolicyDimKey) =>
      Math.round(profile.dimensions.find((d) => d.key === k)?.score ?? 0);
    return {
      noTrade: servedKey === sacrificedKey,
      servedSpan: span(servedKey, cm.f.color as string),
      sacrificedSpan: span(sacrificedKey, cm.v.color as string),
      sacrificedScore: score(sacrificedKey),
    };
  })();
  /* Deciding or wishing. Derived from the scenario this overlay already holds rather than passed
     as a prop, so the two can never be handed different scenarios. */
  const copy = DECISION_COPY[scenario.decisionRole ?? "decider"];
  /* Scenario 5. Gates the wish-confirmation page below, which replaces the decider version rather
     than restyling it — the two make different claims and only one of them is true here. */
  const isRecipient = scenario.decisionRole === "recipient";
  const coord = misaligned ? cvrCoordinate(option, profile) : null;
  const story = coord && whoVariant ? getCVRStory(scenario, option, coord, whoVariant) : null;
  // The same vignette through the OTHER lens (framing flipped) — used for the generate/compare feature.
  const framingFirst: CVRFraming | null = coord ? coord.framing : null;
  const altStory = coord && whoVariant
    ? getCVRStory(scenario, option, { ...coord, framing: otherFraming(coord.framing) }, whoVariant)
    : null;

  /*
    FREEZE THE SCENARIO PAGE BEHIND THIS OVERLAY.

    This panel scrolls on its own and the participant reads a long way down it — the vignette, the
    consequences, the questions. Every time they reach its top or bottom edge the rest of the wheel
    gesture goes to the page underneath, which quietly scrolls the scenario somewhere else. They
    then answer, the overlay closes, and they are looking at a part of the page they never chose.

    `overscroll-behavior: contain` on the panel stops the chain at its own edges, including on
    touch; locking the root removes the thing that would be scrolled at all.
  */
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = prev; };
  }, []);

  // Backdrop is intentionally NOT click-to-close: the participant must use an explicit,
  // recorded button to leave CVR/APA, so we never lose or corrupt their interaction data.
  return (
    <Box position="fixed" inset="0" bg="blackAlpha.700" backdropFilter="blur(4px)" zIndex="50"
      display="flex" alignItems="center" justifyContent="center" p="4">
      <Box bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" p={{ base: "5", md: "7" }}
        maxW="2xl" w="full" maxH="90dvh" overflowY="auto" overscrollBehavior="contain" shadow="2xl">
        <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="1">{copy.dialogEyebrow}</Text>
        <Heading size="md" color="fg" mb="2">{option.title}</Heading>
        {option.consequence && <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">{option.consequence}</Text>}
        <Separator borderColor="border" mb="4" />

        {/*
          SCENARIO 5 ONLY — the wish confirmation, and the LAST page of that scenario.
          ────────────────────────────────────────────────────────────────────────────
          A recipient scenario never opens a reflection, whatever the participant wishes for: they
          made no decision, so there is nothing to hold them to and nobody they have to answer for.
          Every wish therefore arrives here, including ones that go against their own values — which
          is exactly why this page cannot be the decider's page with different button labels. The
          decider's version only ever appears for an option that FITS, so it says so; saying that
          over a misaligned wish would be a plain untruth on screen.

          The whole page is written for a wide range of English. Short sentences, ordinary words, no
          research vocabulary, and the fit stated twice — as a badge and as a sentence — because the
          badge is the easiest thing on the page to skim past.
        */}
        {step === "review" && !misaligned && isRecipient && (
          <Stack gap="4">
            {/* The verdict badge is not shown. See the note on the misaligned reflection page:
                a tier label read before the trade-off is read answers the question for them. */}
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              {WISH_FIT_SENTENCE[option.level]}
            </Text>
            <Box bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" rounded="xl" px="4" py="3">
              <Text fontSize="xs" color="fg.subtle" mb="1">What this option gives up</Text>
              <Text fontSize="sm" color="fg.muted">{option.givesUp ?? option.consequence}</Text>
            </Box>
            <Text fontSize="sm" color="fg" lineHeight="tall">
              Remember: <b>you are not choosing this.</b> Someone else decides. You are only saying
              what you hope they will do. This is the last question in this situation.
            </Text>
            <Button size="sm" variant="outline" alignSelf="start"
              borderColor={tradeoffAck ? accent : "border.emphasized"} color={tradeoffAck ? accent : "fg.muted"}
              bg={tradeoffAck ? "bg.subtle" : "transparent"} rounded="lg" onClick={() => setTradeoffAck(!tradeoffAck)} gap="2" fontSize="xs">
              <Icon boxSize="3.5"><LuCheck /></Icon>
              {tradeoffAck ? "I have read what it gives up" : "Tap here to show you have read this"}
            </Button>
            <HStack gap="3" pt="1" wrap="wrap">
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg" onClick={onKeep} disabled={!tradeoffAck} fontSize="xs">
                {copy.commit}
              </Button>
              <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" onClick={onChangeMyMind} fontSize="xs">
                {copy.reconsider}
              </Button>
            </HStack>
          </Stack>
        )}

        {step === "review" && !misaligned && !isRecipient && (
          <Stack gap="4">
            {/* The verdict badge is not shown here either -- same reason. */}
            <Text fontSize="sm" color="fg.muted" lineHeight="tall">
              {copy.fitsIntro}
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
                {copy.commit}
              </Button>
              <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" onClick={onChangeMyMind} fontSize="xs">
                {copy.reconsider}
              </Button>
            </HStack>
          </Stack>
        )}

        {/*
          The person who argues against the answer just given. Its own page, on purpose: the
          vignette page now asks exactly one question, and the person is what tests that answer.

          NOTE: everything from here down is the CVR path, which a recipient scenario never reaches
          — `misaligned` is forced false for them at selection time. Its copy is therefore left in
          the deciding voice deliberately, rather than made conditional for a state that cannot occur.
        */}
        {step === "person" && story && cvrSaidYes !== null && (
          <PersonSpeaksPage
            story={story}
            saidYes={cvrSaidYes}
            accent={accent}
            marks={cvrMarks(mode)}
            onAnswer={onPersonAnswer}
            onBack={onPersonBackout}
          />
        )}

        {step === "review" && misaligned && story && altStory && framingFirst && (
          <CVRReveal
            story={story}
            altStory={altStory}
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
          <Stack gap="4">
            <Text fontSize="xs" color={accent} textTransform="uppercase" letterSpacing="wider" fontWeight="bold">
              Confirm keeping this option
            </Text>

            {/* Question count is 3 only when the participant generated the second lens. */}
            <QuestionCard
              accent={accent} index={1} total={altViewGenerated ? 2 : 1} answered={q1Strong !== null}
              /*
                THE SAME TRADE THE APA PAGE NAMES, AND THE SAME PAIR THE PROFILE UPDATE MOVES.
                "This option focuses most on X. Do you genuinely value this?" was a fair question
                only when X was not already the participant's strongest value. It often is — 10.5%
                of misaligned choices — and then it reads as "you rated this 100, do you value it?",
                which teaches the participant that the software is not reading their answers.
              */
              question={confirmTrade.noTrade ? (
                <>This option is built around {confirmTrade.servedSpan}, but delivers less of it than
                  your earlier answers asked for. Do you stand by choosing it?</>
              ) : (
                <>This option delivers {confirmTrade.servedSpan} and gives up {confirmTrade.sacrificedSpan},
                  which you rated <b>{confirmTrade.sacrificedScore} out of 100</b>. Do you put{" "}
                  {confirmTrade.servedSpan} above {confirmTrade.sacrificedSpan} here?</>
              )}
            >
              <Stack gap="2">
                <ApaChoice selected={q1Strong === true} accent={accent} onClick={() => setQ1Strong(true)}>
                  {confirmTrade.noTrade
                    ? <>Yes, I stand by it</>
                    : <>Yes — {confirmTrade.servedSpan} comes first for me here</>}
                </ApaChoice>
                <ApaChoice selected={q1Strong === false} accent={accent} onClick={() => setQ1Strong(false)}>
                  Not really, but I'm keeping my choice
                </ApaChoice>
              </Stack>
            </QuestionCard>

            {altViewGenerated && (
              <QuestionCard
                accent={accent} index={2} total={2} answered={framingChoiceYes !== null}
                question={<>You looked at this from two perspectives. <Text as="span" color={accent}>Which one did NOT play a part</Text> in your decision to keep this option?</>}
              >
                <Box mb="3"><FramingComparisonTable scenario={scenario} option={option} coord={coord} mode={mode} /></Box>
                {/*
                  Listed in the order the participant met them, and named for that order. The value
                  written to state is still the framing itself, so the record is unchanged — only
                  the words on the button differ.
                */}
                <Stack gap="2">
                  {[coord.framing, otherFraming(coord.framing)].map((f) => (
                    <ApaChoice key={f} selected={framingChoiceYes === f} accent={accent}
                      onClick={() => setFramingChoiceYes(f)}>
                      The <b>{viewLabelFor(f, coord.framing)}</b> didn't influence me —{" "}
                      <Text as="span" color="fg.subtle">{FRAMING_META[f].gloss}</Text>
                    </ApaChoice>
                  ))}
                </Stack>
              </QuestionCard>
            )}

            <HStack gap="3" wrap="wrap" pt="1">
              <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" fontSize="xs"
                disabled={q1Strong === null || (altViewGenerated && framingChoiceYes === null)}
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
            {/*
              THE ADJUSTMENT LEDGER IS NOT SHOWN.

              This used to print the exact APA arithmetic -- "+15 to this value, -10 to your
              previous top value", the stakeholder's ±25, the lens −20. It handed the participant
              the scoring rules of the instrument mid-study, which is the one thing that reliably
              changes how people answer: once someone can see what raises and lowers a value, the
              remaining scenarios measure their theory of the scoring rather than their values.

              Nothing about the update itself changed. The numbers are still applied, still
              recorded, and still reported in the results at the end -- they are simply not
              narrated to the participant while the study is still running.
            */}
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
            stakeholderMoved={stakeholderMoved}
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

/**
 * QuestionCard — the shared container for EVERY question Block 5 asks the participant.
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * Questions used to be plain <Text> lines in the same flat stack as the narrative around them,
 * and in every case the thing being ASKED was less prominent than the thing being read:
 *
 *   - CVR: the pivotal "would you still choose this?" was the closing sentence of the
 *     stakeholder paragraph, with its answer buttons two elements further down and a color
 *     legend sitting in between them.
 *   - Keep-confirmation and APA: the questions were muted grey prose, visually LIGHTER than
 *     the answer buttons underneath them.
 *
 * ============================================================================
 * WHAT IT DOES
 * ============================================================================
 * Gives every question one unmistakable signature — a raised surface, a solid accent rail down
 * the left edge, a numbered chip, and the question set larger and heavier than any prose on the
 * page — and keeps the ANSWERS INSIDE THE SAME CARD, so a question and its options read as one
 * object instead of two loose ones.
 *
 * The answered state (accent-tinted border + tick) is not decoration. These screens require
 * every question to be answered before Continue enables, and previously nothing told the
 * participant which one they had missed.
 *
 * The scenario accent is passed in rather than read from a token because Block 5 recolors
 * itself per scenario (see block5Palette.ts).
 */
function QuestionCard({ accent, index, total, label, question, answered, children }: {
  accent: string;
  /** 1-based position. Omit along with `total` on a screen that asks only one thing. */
  index?: number;
  total?: number;
  /** Overrides the default "Question n of m" eyebrow. */
  label?: string;
  question: ReactNode;
  /** Drives the tick and the border tint. Omit where the answer is not a required field. */
  answered?: boolean;
  children: ReactNode;
}) {
  const eyebrow = label ?? (index && total ? `Question ${index} of ${total}` : "Question");
  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor={answered ? `${accent}66` : "border.emphasized"}
      borderLeftWidth="4px"
      borderLeftColor={accent}
      rounded="xl"
      px={{ base: "4", md: "5" }}
      py={{ base: "3.5", md: "4" }}
      shadow="sm"
      transition="border-color 0.2s ease"
    >
      <HStack gap="2.5" mb="2.5" align="center">
        <Center boxSize="6" minW="6" rounded="md" bg={accent} color={onAccentText(accent)}
          fontSize="2xs" fontWeight="bold" lineHeight="1">
          {index ?? "?"}
        </Center>
        <Text fontSize="2xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
          {eyebrow}
        </Text>
        {answered && <Icon boxSize="3.5" color="green.fg"><LuCheck /></Icon>}
      </HStack>
      <Box fontSize="md" fontWeight="semibold" color="fg" lineHeight="tall" mb="3">
        {question}
      </Box>
      {children}
    </Box>
  );
}

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
      bg="bg.subtle"
      borderColor="border"
      borderWidth={selected ? "2px" : "1px"}
      transition="all 0.15s ease"
      style={selected ? {
        background: `${accent}26`,
        borderColor: accent,
        boxShadow: `0 0 0 1px ${accent}55`,
      } : undefined}
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
          {selected && <Icon boxSize="3" style={{ color: onAccentText(accent) }}><LuCheck /></Icon>}
        </Box>
        <Box flex="1">{children}</Box>
      </HStack>
    </Button>
  );
}

function APAPanel({ option, profile, scenario, accent, coord, stakeholderMoved, onBail, onCommit, onFinalDecisionChange, altViewGenerated, framingFirst, mode }: {
  option: LabeledOption;
  profile: Block5UserProfile;
  scenario: Block5Scenario;
  accent: string;
  coord: CVRCoordinate;
  /** whether the person who spoke moved them — the stakeholder signal, observed not reported. */
  stakeholderMoved: boolean | null;
  onBail: () => void;
  onCommit: (p: ApaCommitPayload) => void;
  /** telemetry: called when the user picks an APA final option then backs out to choose again. */
  onFinalDecisionChange: () => void;
  /** dual-perspective: did the participant generate the other lens, and which lens was shown first. */
  altViewGenerated: boolean;
  framingFirst: CVRFraming;
  /** color mode — light/dark-aware surfaces + highlight colors. */
  mode: "light" | "dark";
}) {
  // Highlight colors for the value-name spans, tuned for the current modal background.
  const marks = cvrMarks(mode);
  const TEAL = marks.v.color as string;     // the participant's leaning value
  const ORANGE = marks.f.color as string;   // the option's value
  const PURPLE = marks.w.color as string;   // the stakeholder

  /*
   * THE TWO VALUES THIS PAGE IS ABOUT — named for what they are.
   *
   * `sacrificed` was previously called `topValue` and described to the participant as "what you
   * leaned most toward". It is not that. It is `violatedValue`: the value this option most
   * under-serves, weighted by how much the participant said they care. Across 60,000 misaligned
   * choices it was NOT the participant's highest-scoring value 20.9% of the time, so one reader in
   * five was told a plain untruth about their own answers.
   *
   * The page now states the TRADE instead of guessing at a priority: this option delivers X and
   * gives up Y, and here is what you scored on each. That is true in every case, including the one
   * that broke the old wording — where the option's own value IS the participant's top value, so
   * "you leaned toward something else" was doubly wrong.
   *
   * These are the same two values `applyEndorsementUpdates` moves, deliberately: the sentence and
   * the arithmetic now describe one trade rather than two different ones.
   */
  const sacrificed = violatedValue(option, profile);
  const served = optionMainValue(option);
  const scoreOfDim = (k: Block5PolicyDimKey) =>
    Math.round(profile.dimensions.find((d) => d.key === k)?.score ?? 0);
  /* True only when the option's strongest value is also the one it most under-serves. There is no
     two-sided trade to describe then, so the page asks the simpler question instead. */
  const noTrade = served === sacrificed;

  const [stage, setStage] = useState<"questions" | "options" | "confirm">("questions");
  const [q1, setQ1] = useState<"endorse" | "context" | "unsure" | null>(null);
  // No default — the participant must choose a confidence level (it is a required answer).
  const [confidence, setConfidence] = useState<number | null>(null);
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

  // q2 (the stakeholder question) is gone from this page: the ±25 now comes from whether the
  // participant switched after the person spoke, which happens before they ever get here.
  const ready = q1 !== null && confidence !== null && q3 !== null && (!altViewGenerated || framingInfluential !== null);

  /** 3 questions, or 4 when the participant generated the second CVR lens. Drives "n of m". */
  const apaTotal = altViewGenerated ? 3 : 2;
  /**
   * How many are still outstanding. Continue stays disabled until this reaches 0, and a disabled
   * button with no explanation is the classic way to strand someone who scrolled past one card.
   */
  const unanswered =
    (q1 === null || confidence === null ? 1 : 0) +
    (q3 === null ? 1 : 0) +
    (altViewGenerated && framingInfluential === null ? 1 : 0);

  const pending = useMemo(
    () => (q1 !== null && q3 !== null
      ? applyApaUpdates(profile, option, q1, stakeholderMoved === true, q3, framingAdjust,
          scenario.stakesWeight ?? 1, confidence ?? 3)
      : profile),
    [q1, q3, stakeholderMoved, profile, option, framingAdjust, scenario],
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
                      {/* No alignment tier here. This list is filtered by the value the participant
                          JUST prioritized, while the tier scores against their ORIGINAL profile —
                          so the badge could read "Strongly misaligned" directly under a heading
                          saying these options best fit them. The participant has no way to tell
                          the two are measured against different things; it just reads as the
                          software recommending and condemning the same option at once. */}
                      <Text color="fg" fontWeight="semibold" fontSize="sm" lineHeight="short">{o.title}</Text>
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
        {stage === "confirm" && section4 && q1 !== null && confidence !== null && q3 !== null && (
          <Stack gap="4">
            <Box bg="bg.subtle" borderLeftWidth="3px" borderLeftColor={accent} rounded="lg" px="4" py="3">
              <Text fontSize="xs" color="fg.subtle" mb="1">Your final decision</Text>
              <Text fontSize="sm" color="fg" fontWeight="semibold">{section4.title}</Text>
            </Box>
            <QuestionCard accent={accent} label="Confirm" question="Make this your final decision for this scenario?">
            <HStack gap="3" wrap="wrap">
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg" fontSize="xs"
                onClick={() => onCommit({
                  finalOption: section4, pendingProfile: pending,
                  q1, confidence, q2Influenced: stakeholderMoved === true, q3Value: q3, originalOptionId: option.id,
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
            </QuestionCard>
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
          {noTrade ? (
            <>
              This option is built around {vSpan(served, ORANGE)} — {VALUE_BENEFIT[served]} — but it
              delivers less of it than your earlier answers asked for. You rated {vSpan(served, ORANGE)}{" "}
              <b>{scoreOfDim(served)} out of 100</b>. That is what we would like you to confirm.
            </>
          ) : (
            <>
              This option delivers {vSpan(served, ORANGE)} — {VALUE_BENEFIT[served]} — which you rated{" "}
              <b>{scoreOfDim(served)} out of 100</b>.
              {" "}To do that it gives up {vSpan(sacrificed, TEAL)} — {VALUE_BENEFIT[sacrificed]} — which you
              rated <b>{scoreOfDim(sacrificed)} out of 100</b>.
              {" "}<b>That trade is what we would like you to clarify.</b>
            </>
          )}
        </Text>
      </Box>

      <QuestionCard
        accent={accent} index={1} total={apaTotal} answered={q1 !== null}
        question="When you made this choice, which is closer to the truth?"
      >
        <Stack gap="2">
          <ApaChoice selected={q1 === "endorse"} accent={accent} onClick={() => setQ1("endorse")}>
            {noTrade
              ? <>Yes — I stand by choosing {vSpan(served, ORANGE)} here.</>
              : <>I do put {vSpan(served, ORANGE)} above {vSpan(sacrificed, TEAL)}.</>}
          </ApaChoice>
          <ApaChoice selected={q1 === "context"} accent={accent} onClick={() => setQ1("context")}>
            {noTrade
              ? <>I chose it for <i>this particular situation</i> — it is not how I usually think.</>
              : <>I chose it for <i>this particular situation</i> — overall, {vSpan(sacrificed, TEAL)} still
                 matters more to me than {vSpan(served, ORANGE)}.</>}
          </ApaChoice>
          <ApaChoice selected={q1 === "unsure"} accent={accent} onClick={() => setQ1("unsure")}>
            I'm honestly not sure.
          </ApaChoice>
        </Stack>
      </QuestionCard>

      {/*
        THE CONFIDENCE RATING BELONGS TO THIS QUESTION, NOT THE ONE ABOVE.
        It scales how far the value named here moves the profile (see applyApaUpdates), so asking
        it under Question 1 meant the participant was rating their certainty about one thing while
        the number was applied to another. Now the question that uses it is the question that asks
        for it.
      */}
      <QuestionCard
        accent={accent} index={2} total={apaTotal} answered={q3 !== null && confidence !== null}
        question="Pick the one value you most want the system to weight for you — you'll then see the options that fit it:"
      >
        <Stack gap="2">
          {POLICY_DIM_KEYS.map((k) => (
            <ApaChoice key={k} selected={q3 === k} accent={accent} onClick={() => setQ3(k)}>
              <b>{VALUE_NAME[k]}</b> — <Text as="span" color="fg.subtle">{VALUE_BENEFIT[k]}</Text>
            </ApaChoice>
          ))}
        </Stack>
        <HStack gap="2" mt="3.5" pt="3" borderTopWidth="1px" borderColor="border.subtle" wrap="wrap">
          <Text fontSize="xs" color="fg.muted" fontWeight="medium">How sure are you about your answers on this page?</Text>
          {[1, 2, 3, 4, 5].map((n) => (
            <Button key={n} minW="9" h="9" px="0" rounded="lg" fontSize="sm" fontWeight="semibold"
              borderWidth="1px" borderColor="border" bg="bg.subtle" color="fg"
              _hover={{ bg: "bg.muted" }}
              style={confidence === n ? {
                background: accent, borderColor: accent, color: onAccentText(accent),
                boxShadow: `0 4px 12px ${accent}66`,
              } : undefined}
              onClick={() => setConfidence(n)}>{n}</Button>
          ))}
          <Text fontSize="2xs" color="fg.subtle">(1 = not sure · 5 = very sure)</Text>
        </HStack>
      </QuestionCard>

      {altViewGenerated && (
        <QuestionCard
          accent={accent} index={3} total={apaTotal} answered={framingInfluential !== null}
          question={<>You looked at this from two perspectives. Which one most <Text as="span" color={PURPLE} fontWeight="bold">changed your mind</Text> toward not keeping this option?</>}
        >
          <Box mb="3"><FramingComparisonTable scenario={scenario} option={option} coord={coord} mode={mode} /></Box>
          {/* Same as the confirm-page question above: ordered and named by position, storing the
              framing. See VIEW_LABEL. */}
          <Stack gap="2">
            {[coord.framing, otherFraming(coord.framing)].map((f) => (
              <ApaChoice key={f} selected={framingInfluential === f} accent={accent}
                onClick={() => setFramingInfluential(f)}>
                The <b>{viewLabelFor(f, coord.framing)}</b> changed my mind —{" "}
                <Text as="span" color="fg.subtle">{FRAMING_META[f].gloss}</Text>
              </ApaChoice>
            ))}
          </Stack>
        </QuestionCard>
      )}

      <HStack gap="3" pt="1" wrap="wrap" align="center">
        <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" fontSize="xs" disabled={!ready} onClick={() => setStage("options")}>
          Continue
        </Button>
        {!ready && (
          <Text fontSize="xs" color="fg.subtle">
            {unanswered} question{unanswered === 1 ? "" : "s"} left to answer
          </Text>
        )}
        <Button size="sm" variant="ghost" color="fg.muted" _hover={{ bg: "bg.subtle" }} rounded="lg" fontSize="xs" onClick={() => setConfirmBail(true)}>
          Take me back to all options
        </Button>
      </HStack>
    </Stack>
  );
}