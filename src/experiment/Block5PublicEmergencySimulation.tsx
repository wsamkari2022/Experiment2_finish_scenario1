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
import { LuCheck, LuChevronDown, LuChevronUp, LuChevronsDownUp, LuChevronsUpDown, LuShield, LuTriangleAlert, LuInfo, LuEye, LuGauge, LuSparkles, LuScale, LuChartSpline, LuUserRound, LuUsersRound, LuGlobe, LuBuilding2, LuCar, LuBus, LuTruck, LuFootprints, LuHouse, LuListOrdered, LuShuffle, LuLock, LuRoute, LuClipboardList, LuClock } from "react-icons/lu";
import { SensitivityMeterBar, MeterLegend, MetricStandingBar, MetricStandingLegend } from "./block5Meters";
import { predictChoice, type ChoicePrediction } from "./block5Prediction";
import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import {
  labelOptions, type LabeledOption, isMisaligned, cvrCoordinate,
  optionMetrics, applyEndorsementUpdates, applyKeepUpdates, applyApaUpdates, scenarioVciScore,
  scenarioShowsPerformance,
  scenarioIsScored, isPredictionTest,
  performanceScore, computeVCI, computeStability, computeSensitivityStability, averagePerformance,
  cumulativeMetrics, projectedMetrics, metricProfileScore, optionMainValue, violatedValue,
  chooseFraming, otherFraming, framingSensitivityKey, policyAlignmentShortfall, policyShortfallByValue,
} from "./block5CVR";
import { getCVRStory, pickWhoVariant, getCVRLensPair, getCVRMirror, getCVRValueHere } from "./block5CVRContent";
import { SHOW_STAKEHOLDER_PAGE } from "./blocksLegacyMethodology";
import { useScrollToTop } from "./useScrollToTop";
import { Block5OptionCompare } from "./Block5OptionCompare";
import { capturedOf, menuRange, metricStandings, overallCaptured, capturedLabel,
         overallStanding, ordinal,
         type MetricStanding, type OverallStanding } from "./block5Performance";
import { useColorMode } from "@/components/ui/color-mode";
import { MethodLogo } from "./MethodLogo";
import { Tooltip } from "@/components/ui/tooltip";
import { getBlock5Palette, onAccentText, type Block5Palette } from "./block5Palette";
import { Block5ScenarioIntro } from "./Block5ScenarioIntro";
import { Block5ValueGuide } from "./Block5ValueGuide";
import { runMorph } from "./block5Morph";
import { deriveCompanyValues, type DerivedCompanyValues } from "./block5Company";
import {
  METRIC_KEYS, METRIC_LABELS, metricMeaning, POLICY_DIM_KEYS, POLICY_DIM_EXPLAIN, POLICY_DIM_HIGHER_MEANS,
  POLICY_DIM_SHORT,
  type AlignmentLevel, type Block5Results, type Block5Scenario, type Block5ScenarioResult,
  type PredictionTestRecord,
  type Block5UserProfile, type CVREndorsement, type Block5MetricProfile,
  type Block5PolicyDimKey, type CVRCoordinate, type WhoVariant,
  type Block5ScenarioTelemetry, type CVROutcome, type APAOutcome,
  type CVRLensBlock,
  type CVRFraming, type FramingAdjust, type StakePosition,
  BLOCK5_PROGRESS_KEY, BLOCK5_RESULTS_KEY,
  type Block5MethodKind,
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
/*
 * "prediction" is scenario 6's extra screen, and it sits AFTER the confirmation on purpose.
 *
 * The participant picks, confirms, and only then sees what the model expected. Putting it any
 * earlier would contaminate the one thing the scenario exists to measure: there would be no way to
 * tell a choice they made from a choice the guess suggested.
 */
type FlowStep = "review" | "person" | "q1" | "apa" | "confirm" | "prediction";

/**
 * A stable shuffle for one participant and one scenario.
 *
 * DETERMINISTIC ON PURPOSE. `Math.random()` would reshuffle on every render, so a participant who
 * opened a card and closed it would find the list rearranged underneath them. Seeding from the
 * session id and the scenario id gives one order per participant that never moves, and that can be
 * recreated from the stored record.
 *
 * Fisher-Yates, so every ordering is equally likely. A naive `sort(() => Math.random() - 0.5)` is
 * not uniform and quietly favours some orders over others, which in a four-option scenario built to
 * measure order effects is exactly the bias that must not be there.
 */
/**
 * A section header that opens and closes what is under it.
 *
 * WHY THESE SECTIONS START CLOSED.
 * The scene, the numbers and the participant's role are read in full on the intro page that comes
 * immediately before this one. Repeating all three, open, at the top of the options column pushes
 * the options themselves below the fold and asks the participant to scroll past text they read
 * fifteen seconds ago. Closed, the column opens on the thing they are actually there to do, and the
 * text is one click away for anyone who wants it again.
 *
 * NOTHING IS HIDDEN, and that distinction matters for the study. Every heading stays visible, so a
 * participant always knows the information is there; only the body is folded. A design that removed
 * the role would be removing the block's independent variable from the page.
 */
/**
 * A folding section header. The chevron on the right is the whole affordance.
 *
 * NO COLLAPSIBLE IN BLOCK 5 GLOWS (researcher's instruction, 20 September 2026). The scene, the
 * situation box and the role card used to breathe until they had been opened once. With three of
 * them breathing on every scenario the page read as an alarm, and a participant cannot tell which
 * of three pulsing panels matters. The one control that still glows is the compare-charts button,
 * which opens something a participant would otherwise never know existed.
 */
function CollapsibleHeader({ open, onToggle, children, style, px, py }: {
  open: boolean; onToggle: () => void; children: ReactNode;
  style?: React.CSSProperties; px?: unknown; py?: unknown;
}) {
  return (
    <HStack
      as="button" w="full" gap="2.5" px={px as never} py={py as never} style={style}
      onClick={onToggle} cursor="pointer" textAlign="left"
      aria-expanded={open}
    >
      {children}
      <Box flex="1" />
      <Icon boxSize="4" transition="transform 0.2s ease"
        style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
        <LuChevronDown />
      </Icon>
    </HStack>
  );
}

function shuffleForParticipant<T extends { id: string }>(items: T[], scenarioId: string): T[] {
  let seed = 0;
  const key = (() => {
    try { return (localStorage.getItem("vrds_session_id") ?? "") + scenarioId; }
    catch { return scenarioId; }
  })();
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  const next = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0x100000000; };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

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

/**
 * One icon per method, so a participant scanning six cards can tell them apart before reading a
 * word. The kinds are a closed union, so adding one to the type without an icon here is a compile
 * error rather than a blank square on a card.
 */
const METHOD_ICON: Record<Block5MethodKind, ReactNode> = {
  car: <LuCar />,
  bus: <LuBus />,
  van: <LuTruck />,
  foot: <LuFootprints />,
  stay: <LuHouse />,
  /* The allocation scenarios: nobody travels, so the icon shows how the choosing is done. */
  score: <LuGauge />,
  list: <LuListOrdered />,
  draw: <LuShuffle />,
  hold: <LuLock />,
  /* Scenario 4: how the 400 cut hours are found. */
  route: <LuRoute />,
  task: <LuClipboardList />,
  trim: <LuClock />,
};

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
 *
 * THE GLOSSES SAY WHAT EACH VIEW SHOWED (researcher, 18 September 2026). They used to read "it's
 * your own rule, your responsibility" and "circumstances shaped the numbers". The first is wrong in
 * scenarios 1 and 2, where the participant picked a way out rather than a rule; the second is
 * jargon, and not what the context view shows — the same choice, made in another place.
 */
const FRAMING_META: Record<CVRFraming, { gloss: string }> = {
  directness: { gloss: "what your choice does, and that it was yours" },
  context: { gloss: "the same choice, made somewhere else" },
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
   * WHICH LENS WAS ON SCREEN WHEN THEY LEFT THE VIGNETTE — not which one came first.
   *
   * The APA page's mirror table only makes sense to somebody who has just read the second world.
   * A participant who generated the other lens and then toggled BACK ended on the directness
   * lens, which never mentions that world, so for them the table would introduce a place rather
   * than explain one. `coord.framing` cannot answer this: it is the lens shown FIRST, and the
   * toggle moves freely after that. CVRReveal reports every change, so this always holds what is
   * actually in front of them.
   */
  const [lastLensSeen, setLastLensSeen] = useState<CVRFraming | null>(null);
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
   * running judgment, the ordering is a fixed frame. Keeping them on different clocks is what
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
  /*
   * SCENARIO 6 IS SHUFFLED, ONCE PER PARTICIPANT, AND THE ORDER IS RECORDED.
   *
   * The other five scenarios are ordered by the planner, which is a deliberate part of the design.
   * Scenario 6 must not be: its four rules are one per value, so a planner order would put the rule
   * the model favours in a position that CORRELATES with the prediction. Any general preference for
   * the top of a list would then be indistinguishable from agreement with the MPF, which is the one
   * thing the scenario exists to measure.
   *
   * A fixed order was the first plan and is worse than a shuffle. Fixed, an order effect is
   * constant and therefore built into every participant's data with no way to separate it out.
   * Shuffled, it is spread evenly across participants, and because the order is stored it can also
   * be checked directly.
   *
   * ONCE, not per render. The shuffle is seeded from the session id so the same participant sees
   * the same order every time this component re-renders, and from the scenario id so it does not
   * change if they navigate away and back.
   */
  const displayOptions = useMemo<LabeledOption[]>(() => {
    if (scenario && isPredictionTest(scenario)) return shuffleForParticipant(labeled, scenario.id);
    if (!plan) return labeled;
    const byId = new Map(labeled.map((o) => [o.id, o]));
    return plan.orderedIds.map((id) => byId.get(id)).filter((o): o is LabeledOption => !!o);
  }, [plan, labeled, scenario]);

  /*
   * SCENARIO 6: THE GUESS, COMPUTED ONCE AND FROZEN.
   *
   * Built from the profile as it stands BEFORE this scenario, which is also the profile after it,
   * because scenario 6 never updates anything. Its confidence comes from the VCI and Stability the
   * participant has earned across the five real scenarios: a profile that has been predicting them
   * correctly, and that held still while doing it, is allowed a sharper guess.
   *
   * Frozen in a memo keyed on the inputs so the number shown on screen and the number written to
   * the record can never drift apart between renders.
   */
  const runningVci = useMemo(
    () => computeVCI(progress.scenarioResults).value,
    [progress.scenarioResults],
  );
  const runningStability = useMemo(
    () => computeStability(progress.scenarioResults, userProfile).value,
    [progress.scenarioResults, userProfile],
  );
  const prediction = useMemo<ChoicePrediction | null>(
    () => (scenario && isPredictionTest(scenario)
      ? predictChoice(scenario.options, profile, { vci: runningVci, stability: runningStability })
      : null),
    [scenario, profile, runningVci, runningStability],
  );

  /* The participant's answers on the prediction screen, and the clock on it. */
  const [predSoundsLike, setPredSoundsLike] = useState<number | null>(null);
  const [predSurprised, setPredSurprised] = useState<boolean | null>(null);
  const predShownAtRef = useRef<number | null>(null);
  /*
   * Once the guess has been answered it is never shown again. A participant who goes back and picks
   * differently is exercising the reactivity measure, and showing them a second guess would turn
   * one clean before-and-after into an argument with the software.
   */
  /*
   * WHICH SIDEBAR SECTIONS ARE OPEN. The scene, the situation and the role all open by default
   * (researcher's instruction, 20 September 2026), and they reopen for each scenario.
   *
   * WHY ALL THREE ARE OPEN. Every option on the page is built on exactly these facts, and an
   * option card cannot be judged without them: which route is closed, how many hours are left, who
   * else is in the car. Folded, they read as an index of things already dealt with - and they were
   * shown on the intro page a minute earlier, which makes skipping them feel reasonable. The role
   * in particular is the block's independent variable, the one thing that genuinely differs between
   * scenario 1 and scenario 2, and it must have been read for an answer to mean anything.
   *
   * They still fold, because a participant who has taken them in wants the options higher up the
   * page. That is what the chevron is for.
   *
   * AND THEY OPEN AGAIN FOR EVERY SCENARIO. This component is not remounted between scenarios, so
   * a fold carried over would silently hide scenario 4's facts - different numbers, a different
   * route, a different role, never seen. The fold therefore remembers WHICH scenario it was made
   * on, and any other scenario reads as open. That is why this is one piece of state carrying the
   * index rather than three booleans reset in an effect: nothing has to fire for the next page to
   * be correct, and the page cannot render for one frame with the previous page's folds.
   */
  const [folds, setFolds] = useState<{ index: number; scene: boolean; facts: boolean; role: boolean }>(
    { index: progress.currentScenarioIndex, scene: true, facts: true, role: true },
  );
  const foldsAreThisScenario = folds.index === progress.currentScenarioIndex;
  const openScene = foldsAreThisScenario ? folds.scene : true;
  const openFacts = foldsAreThisScenario ? folds.facts : true;
  const openRole = foldsAreThisScenario ? folds.role : true;
  const toggleFold = useCallback((key: "scene" | "facts" | "role") => {
    setFolds((f) => {
      const here = f.index === progress.currentScenarioIndex
        ? f
        : { index: progress.currentScenarioIndex, scene: true, facts: true, role: true };
      return { ...here, index: progress.currentScenarioIndex, [key]: !here[key] };
    });
  }, [progress.currentScenarioIndex]);

  /**
   * WHICH OPTION CARDS THE PARTICIPANT HAS OPENED. Everything else is folded to its title.
   *
   * EVERY CARD STARTS FOLDED (researcher's instruction, 23 September 2026). Six open cards make a
   * page most of which is scrolled past, so the scenario now opens as a list of six titles in
   * planner order and the participant opens the ones they want to read.
   *
   * THIS IS A REAL CHANGE TO WHAT THE STUDY SHOWS PEOPLE, not a cosmetic one, and it is stated
   * here so nobody has to rediscover it. Reading an option is now an act the participant chooses,
   * so a card they never opened is a card they never read - which is a different thing from an
   * open card they scrolled past. Any comparison with data collected before this date has to
   * account for it.
   *
   * WHY THE STATE IS "OPENED" RATHER THAN "FOLDED": with folded stored, every new scenario would
   * need its six ids folding before the first paint. Storing what has been OPENED makes folded
   * the natural default everywhere, including a scenario nobody has touched yet.
   *
   * It carries the scenario index for the same reason the scene boxes above do: nothing has to
   * fire for the next scenario to be correct, and no frame can render with the last page's state.
   */
  const [openedCards, setOpenedCards] = useState<{ index: number; ids: Set<string> }>(
    { index: progress.currentScenarioIndex, ids: new Set() },
  );
  const openedHere = openedCards.index === progress.currentScenarioIndex
    ? openedCards.ids
    : EMPTY_FOLDS;
  /* Not logged, deliberately. `optionExpands` counts information-seeking - opening the DETAILS
     panel of a card is evidence somebody wanted to know more. Unfolding a card is now simply how
     it is read at all, so counting it would fill a clean measure with the act of reading. */
  const toggleFolded = useCallback((id: string) => {
    setOpenedCards((prev) => {
      const here = prev.index === progress.currentScenarioIndex ? prev.ids : new Set<string>();
      const next = new Set(here);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { index: progress.currentScenarioIndex, ids: next };
    });
  }, [progress.currentScenarioIndex]);

  const [openOrdering, setOpenOrdering] = useState(false);

  /*
   * WHICH FOLDABLE THINGS HAVE EVER BEEN OPENED.
   *
   * Only "charts" still reads this: the compare-charts button glows until the participant has
   * opened the comparison once, because nothing else on the page hints that the six options can be
   * seen side by side. The sidebar sections used to glow too and no longer do - they are open from
   * the start (researcher's instruction, 20 September 2026), and an open panel that breathes at the
   * participant is an instruction to do something already done for them.
   */
  const [everOpened, setEverOpened] = useState<Set<string>>(() => new Set(["role"]));
  const markOpened = useCallback((key: string) => {
    setEverOpened((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const [predAnswered, setPredAnswered] = useState(false);
  const [predFirstChoiceId, setPredFirstChoiceId] = useState<string | null>(null);

  /*
   * THE SCENARIO-6 INTERACTION LOG.
   *
   * A ref rather than state on purpose: every entry is an observation, nothing on screen depends on
   * it, and putting it in state would re-render the page on each keystroke of behavior we record.
   *
   * It is kept separate from the shared `telRef` telemetry because those fields are defined for all
   * six scenarios and mean the same thing in each; these exist only where there is a guess to be on
   * one side or the other of.
   */
  const predLogRef = useRef<{
    guessShownAt: number | null;
    /** The last rule opened, kept here because resetFlow clears the component's own selection. */
    lastId: string | null;
    switchesBefore: number;
    switchesAfter: number;
    openedBefore: Set<string>;
    openedAfter: Set<string>;
    events: PredictionTestRecord["interactions"];
  }>({ guessShownAt: null, lastId: null, switchesBefore: 0, switchesAfter: 0,
       openedBefore: new Set(), openedAfter: new Set(), events: [] });

  /** Append one observation. Time is measured from the moment this scenario opened. */
  const logPred = useCallback((
    what: PredictionTestRecord["interactions"][number]["what"],
    extra?: { optionId?: string; value?: string | number },
  ) => {
    if (!scenario || !isPredictionTest(scenario)) return;
    predLogRef.current.events.push({
      atMs: Date.now() - progress.scenarioStartTime,
      what,
      ...extra,
    });
  }, [scenario, progress.scenarioStartTime]);

  /** Per-card explanation text, generated from planner state. Keyed by option id. */
  const explanations = useMemo<Record<string, CardExplanation>>(() => {
    if (!plan || !scenario) return {};
    /* The chips are metric placings ("Durability 2nd of 6"). Scenario 6 keeps the explanation
       text, which is about values, and drops the chips, which are about performance. */
    const showPerf = scenarioShowsPerformance(scenario);
    return Object.fromEntries(
      plan.orderedIds.map((id) => {
        const ex = explainOption(scenario, plan, decisionProfile, id);
        return [id, showPerf ? ex : { ...ex, chips: [] }];
      }),
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
    /* Scenario 6 shows no performance at all. Returning nothing here removes the "Performance Nth
       of M" badge, the five metric bars inside the expanded card and the combined-standing
       paragraph in one move, because every one of them is already guarded on `standing`. */
    if (!scenarioShowsPerformance(scenario)) return {};
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

  /* Backing out of the confirm view is NOT logged. It is navigation rather than a decision, and
     the switch counters already hold the part of it that means anything — see the note on
     `interactions` in block5Types.ts. */
  const resetFlow = useCallback(() => {
    setSelectedOptionId(null);
    setStep(null);
    setTradeoffAck(false);
    setQ1Strong(null);
    setAltViewGenerated(false);
    setLastLensSeen(null);
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
    /*
     * OPENING A CARD'S DETAILS IS NOT LOGGED IN SCENARIO 6 EITHER, for the same reason as backing
     * out: it is reading, not deciding. `expandedOptions` above still records which options were
     * inspected, for every scenario, which is where that fact belongs.
     */
  }, []);

  const togglePreview = useCallback((id: string) => {
    setPreviewOptionId((cur) => {
      const opening = cur !== id;
      if (opening && telRef.current) telRef.current.previewImpactOpens += 1; // info-seeking signal
      return opening ? id : null;
    });
  }, []);

  /*
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * A PREVIEW BELONGS TO ITS OPTION, AND ENDS WHEN THE PARTICIPANT LEAVES IT.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   *
   * THE PROBLEM, as the advisor put it: press "Preview impact" on one option, scroll on to read
   * the others, and the dashboard at the top is still showing that option's projection. It is
   * sticky, so it follows you down the page — a number attached to an option you can no longer
   * see, sitting above the option you are actually reading. The honest reading of that screen is
   * "your overall performance has changed", and it has not: nothing is recorded until the choice
   * is confirmed.
   *
   * THE RULE: the preview lives exactly as long as its card is on screen. Scroll the card away and
   * the dashboard returns to the real running total by itself.
   *
   * WHY AN OBSERVER AND NOT A SCROLL HANDLER. A scroll handler would have to measure the card on
   * every frame of every scroll, on a page that is several thousand pixels long, and it would miss
   * a card that leaves the viewport for any other reason — a section collapsing above it, the
   * window resizing, another card expanding. The browser already tracks exactly this and reports
   * it once, when it changes.
   *
   * THE TOP MARGIN IS THE DASHBOARD'S OWN HEIGHT, measured rather than guessed. The dashboard is
   * sticky, so a card sliding underneath it is technically still inside the viewport while being
   * completely hidden behind the very panel showing its numbers. Shrinking the observed area by
   * that height makes "hidden behind the dashboard" count as gone, which is what a participant
   * sees.
   */
  useEffect(() => {
    if (!previewOptionId) return;
    if (typeof IntersectionObserver === "undefined") return; // very old browser: preview simply stays
    const card = document.querySelector(`[data-option-id="${previewOptionId}"]`);
    if (!card) return;

    const dashH = Math.round(dashRef.current?.getBoundingClientRect().height ?? 0);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) setPreviewOptionId(null);
        }
      },
      { threshold: 0, rootMargin: `-${dashH}px 0px 0px 0px` },
    );
    io.observe(card);
    return () => io.disconnect();
  }, [previewOptionId]);

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

    /*
     * SCENARIO 6 COUNTS THE SAME SWITCH TWICE OVER: once in the shared telemetry, and once on the
     * correct side of the guess. `guessShownAt` is the divider, and it is null until the prediction
     * screen has actually been opened, so a participant who never reaches it records everything as
     * "before" - which is exactly right.
     */
    if (scenario && isPredictionTest(scenario)) {
      const pl = predLogRef.current;
      const afterGuess = pl.guessShownAt !== null;
      /*
       * COMPARED AGAINST THE LOG'S OWN `lastId`, NOT AGAINST `selectedOptionId`.
       *
       * "Change my answer" runs resetFlow, which clears `selectedOptionId` before the participant
       * picks again. Reading that state here therefore saw null and recorded no switch - which
       * silently zeroed the one number the reactivity measure is built on, in exactly the case it
       * exists to capture.
       */
      const changed = pl.lastId !== null && pl.lastId !== id;
      if (afterGuess) {
        if (changed) pl.switchesAfter += 1;
        pl.openedAfter.add(id);
      } else {
        if (changed) pl.switchesBefore += 1;
        pl.openedBefore.add(id);
      }
      pl.lastId = id;
    }
    logPred("selected", { optionId: id });

    setSelectedOptionId(id);
    setPreviewOptionId(null);
    setStep("review");
    setTradeoffAck(false);
    setQ1Strong(null);
    setAltViewGenerated(false);   // a fresh CVR starts with only the first lens
    setLastLensSeen(null);        // and with no lens read yet
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
     * endorsement question, therefore no APA update, therefore no profile movement.
     */
    const misaligned = !!(scenario && opt && scenarioIsScored(scenario) && isMisaligned(opt.level));
    if (misaligned && t) {
      t.cvrVisits += 1;          // the CVR vignette is about to be shown
      t.cvrShownAt = Date.now(); // start CVR dwell timer
    }
    setCvrWho(misaligned && scenario && opt
      ? pickWhoVariant(scenario, cvrCoordinate(opt, profile).who)
      : null);
  }, [labeled, scenario, profile, logPred]);

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

    // Snapshot the 4 policy values + the two reflection lenses AFTER this scenario's update. The
    // policy snapshot is what Stability counts swaps on; the lens snapshot is what the directness
    // and context stabilities measure distance on; both feed the results charts.
    result.policySnapshotAfter = policyScoresOf(nextProfile);
    result.framingSnapshotAfter = framingScoresOf(nextProfile);
    // Stakeholder too, for the stakeholder stability: it moves ±25 on every reflection.
    result.stakeholderSnapshotAfter = nextProfile.dimensions
      .find((d) => d.key === "stakeholderPerspectiveShiftSensitivity")?.score ?? 50;
    const nextResults = [...progress.scenarioResults, result];
    const nextIndex = progress.currentScenarioIndex + 1;
    if (nextIndex >= BLOCK5_SCENARIOS.length) {
      const vci = computeVCI(nextResults);
      // Both measured against the profile as it entered Block 5 — the Blocks 1-4 baseline.
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
          swaps: stab.swaps, conflictSteps: stab.conflictSteps, swapsByScenario: stab.swapsByScenario,
          topValueBefore: stab.topValueBefore, topValueAfter: stab.topValueAfter,
        },
        sensitivityStability: computeSensitivityStability(nextResults, userProfile),
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
    /** Scenario 6 only. */
    predictionTest?: PredictionTestRecord;
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
      predictionTest: opts.predictionTest,
      introSeconds: introSecondsRef.current[scenario.id],
      vciScore: scenarioVciScore(opt.level, scenario.options.length),
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
    /*
     * THE FINAL CHOICE IS JUDGED ON THE PROFILE THE PARTICIPANT BROUGHT INTO THIS SCENARIO - the same
     * `labeled` the options were shown with, and the same one the keep path uses in commitChoice.
     * NOT `nextProfile`, the profile AFTER this clarification has moved it.
     *
     * WHY. The keep path never re-labels: an endorsement moves the profile for the NEXT scenario and
     * the choice itself keeps the label it had. Relabeling here would let the same choice, for the
     * same reason, earn more when the participant walks through APA instead - naming a value lifts it
     * by 30 and lowers the rest by 10, and the option they then pick would be scored on the profile
     * they just moved. Measured over 2,000 random starting profiles: a participant who takes up a new
     * value in every scenario scores VCI 31 by either route; relabeled here, the APA route would give
     * 56 - a random responder's score, for the one behavior VCI exists to catch. Gate V8 guards it.
     *
     * NOTHING IS LOST. What the participant said is stored in `apa`, and the moved profile in
     * `policySnapshotAfter`, so the post-clarification label can be recomputed whenever it is wanted.
     */
    const finalLabeled = labeled;
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
      vciScore: scenarioVciScore(opt.level, scenario.options.length),
      performanceScore: performanceScore(opt),
      performanceCaptured: capturedOf(scenario, opt),
      performanceMenu: { worst: Math.round(menuRange(scenario).worst), best: Math.round(menuRange(scenario).best) },
      metrics: optionMetrics(opt),
      apa: {
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
  }, [scenario, userProfile, labeled, expandedOptions, progress, cvrWho, finalizeScenario]);

  /*
   * THE PICK MADE BEFORE THE GUESS APPEARED.
   *
   * Recorded the first time the participant confirms in scenario 6, and never overwritten. If they
   * go back and choose differently, that later pick is the reaction; this one is the answer they
   * gave when nothing had been suggested to them, and it is the only uncontaminated choice the
   * scenario produces.
   */
  const openPrediction = useCallback(() => {
    if (!selectedOption) return;
    if (predFirstChoiceId === null) setPredFirstChoiceId(selectedOption.id);
    predShownAtRef.current = Date.now();
    predLogRef.current.guessShownAt = Date.now();
    logPred("guess_shown", { optionId: selectedOption.id });
    setStep("prediction");
  }, [selectedOption, predFirstChoiceId, logPred]);

  const handleKeep = useCallback(() => {
    if (!selectedOption) return;
    // Keeping an option that already fits reinforces the value it is built on, and eases off a
    // value it neglects. The amounts and the guards live in applyKeepUpdates so the scoring rule
    // sits with the other scoring rules and can be simulated (tools/simulate_vci.cjs).
    // Everyday scenarios teach the profile less than a life-and-death one (scenario.stakesWeight).
    /*
     * A WISH TEACHES THE PROFILE NOTHING. In a recipient scenario the profile is carried through
     * untouched, so the profile - and Stability, which reads it - moves only on actual decisions.
     */
    const nextProfile = scenario && !scenarioIsScored(scenario)
      ? profile
      : applyKeepUpdates(
          profile, selectedOption, selectedOption.level, scenario?.stakesWeight ?? 1,
        );

    /*
     * SCENARIO 6 attaches what the participant was shown and what they did about it. `firstChoice`
     * is the pick they made BEFORE the guess appeared, which is the only uncontaminated choice in
     * this scenario; `selectedOption` is what they ended on.
     */
    let predictionTest: PredictionTestRecord | undefined;
    if (prediction && scenario && isPredictionTest(scenario)) {
      const firstChoice = predFirstChoiceId ?? selectedOption.id;
      const onFirst = prediction.options.find((o) => o.optionId === firstChoice);
      const top = prediction.options.find((o) => o.rank === 1);
      predictionTest = {
        version: prediction.version,
        temperature: prediction.temperature,
        confidence: prediction.confidence,
        separation: prediction.separation,
        shownProbabilities: prediction.options.map((o) => ({
          optionId: o.optionId,
          probability: o.probability,
          rank: o.rank,
          alignmentScore: o.alignmentScore,
        })),
        predictedTopOptionId: top?.optionId ?? "",
        firstChoiceOptionId: firstChoice,
        probabilityOfFirstChoice: onFirst?.probability ?? 0,
        predictionWasRight: top?.optionId === firstChoice,
        soundsLikeMe: predSoundsLike,
        surprised: predSurprised,
        shownOrder: displayOptions.map((o) => o.id),
        switchesBeforeGuess: predLogRef.current.switchesBefore,
        switchesAfterGuess: predLogRef.current.switchesAfter,
        rulesOpenedBeforeGuess: predLogRef.current.openedBefore.size,
        rulesOpenedAfterGuess: predLogRef.current.openedAfter.size,
        interactions: [...predLogRef.current.events,
          { atMs: Date.now() - progress.scenarioStartTime, what: "committed" as const,
            optionId: selectedOption.id }],
        changedAfterSeeing: selectedOption.id !== firstChoice,
        finalChoiceOptionId: selectedOption.id,
        probabilityOfFinalChoice:
          prediction.options.find((o) => o.optionId === selectedOption.id)?.probability ?? 0,
        /* Read from the log rather than from the final rule: a participant who pressed "Change my
           answer" and then chose their first rule again still reacted to the guess. */
        pressedChangeAnswer: predLogRef.current.events.some((e) => e.what === "changed_answer"),
        secondsViewingPrediction: predShownAtRef.current
          ? Math.round((Date.now() - predShownAtRef.current) / 1000)
          : 0,
      };
    }
    commitChoice(selectedOption, {
      nextProfile, endorsement: "n/a", stakeholderGuided: null, predictionTest,
    });
  }, [selectedOption, profile, scenario, commitChoice, prediction, predFirstChoiceId,
      predSoundsLike, predSurprised, progress.scenarioStartTime, displayOptions]);

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

      {/* Sticky cumulative performance dashboard (issues 1 & 2). Absent in scenario 6. */}
      {scenarioShowsPerformance(scenario) && (
        <Box ref={dashRef} position="sticky" top="2" zIndex="30" maxW="7xl" mx="auto" mb="6">
          <MetricsDashboard current={cumulative} projected={projected} previewTitle={previewOption?.title ?? null}
            accent={pal.accent} completedCount={progress.scenarioResults.length} pal={pal} scenarioId={scenario.id} />
        </Box>
      )}

      {/* What the four values mean in THIS scenario (researcher, 18 September 2026). Scenarios 1-5;
          renders nothing in scenario 6, on purpose. See Block5ValueGuide. */}
      <Block5ValueGuide scenario={scenario} pal={pal} />

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
            THE COLUMN SAYS WHAT IT IS, on the advisor's instruction (16 September 2026).

            The objection was that this column reads as a summary of something that happened
            elsewhere, when it is in fact the whole scenario: the scene, the numbers every option
            shares, and the participant's role, which is the block's entire manipulation. Three
            folded headings stacked in a narrow column look like a table of contents, and a reader
            who takes it for a recap never opens any of it.

            Two things fix that and neither of them un-folds the column. This header names the
            column as the source material and says outright that it is not a summary — and the role
            card below now opens by default, so the column always shows real content rather than a
            list of titles.
          */}
          <Box px="1">
            <HStack gap="2" mb="1">
              <Icon color={pal.accent} boxSize="4"><LuScale /></Icon>
              <Text fontSize="2xs" fontWeight="bold" letterSpacing="widest"
                textTransform="uppercase" color={pal.accent}>
                What you are deciding on
              </Text>
            </HStack>
            <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
              The complete scenario, not a summary. Every option is built on exactly these facts.
              {" "}
              {/* SAYING IT BOTH WAYS, on the researcher's instruction. "Open any section" told a
                  participant how to get the facts back and left them to discover that the same
                  header closes it again - so somebody who opened all three to check something was
                  left with a column they could not shorten. */}
              <Text as="span" color={pal.text} fontWeight="semibold">
                Open and close these three sections as often as you like
              </Text>{" "}
              — closing one only hides it from view; nothing is lost, and it opens again on the
              same heading.
            </Text>
          </Box>

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
            <CollapsibleHeader
              open={openScene}
              onToggle={() => { markOpened("scene"); toggleFold("scene"); }}
              px={{ base: "5", md: "6" }} py="3"
              style={{ background: pal.accent, color: onAccentText(pal.accent) }}
            >
              <Icon boxSize="4"><LuScale /></Icon>
              <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="widest">
                The scenario
              </Text>
            </CollapsibleHeader>
            <VStack align="stretch" gap="5" px={{ base: "5", md: "6" }}
              py={openScene || openFacts ? { base: "5", md: "5" } : "0"}>
              {openScene && (
                <Text fontSize="md" color={pal.text} lineHeight="tall">{scenario.description}</Text>
              )}
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
                  borderWidth="1px" borderLeftWidth="5px" rounded="lg" px="4"
                  py={openFacts ? "3.5" : "2.5"}
                  mt={openScene ? "0" : "5"}
                  style={{
                    background: `${pal.accent}1F`,
                    borderColor: `${pal.accent}59`,
                    borderLeftColor: pal.accent,
                  }}
                >
                  <CollapsibleHeader
                    open={openFacts}
                    onToggle={() => { markOpened("facts"); toggleFold("facts"); }}
                    px="0" py="0"
                  >
                    <Center boxSize="5" minW="5" rounded="full"
                      style={{ background: pal.accent, color: onAccentText(pal.accent) }}>
                      <Icon boxSize="3"><LuTriangleAlert /></Icon>
                    </Center>
                    <Text fontSize="2xs" fontWeight="bold" color={pal.text} textTransform="uppercase" letterSpacing="wider">
                      The situation right now
                    </Text>
                  </CollapsibleHeader>
                  {openFacts && (
                    <Text mt="2" fontSize="md" color={pal.text} lineHeight="tall" fontWeight="semibold">{scenario.factBase}</Text>
                  )}
                </Box>
              )}
            </VStack>
          </Box>

          {/*
            YOUR ROLE — its own card, and the loudest one in the column. See ScenarioRoleCard for
            why the block's independent variable is no longer a clause inside the scene.
          */}
          {scenario.role && (
            <ScenarioRoleCard scenario={scenario} pal={pal}
              open={openRole}
              onToggle={() => { markOpened("role"); toggleFold("role"); }} />
          )}

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
            className={everOpened.has("charts") ? undefined : "vrds-glow-ring"}
            animation={everOpened.has("charts") ? undefined : "glow-ring 2.4s ease-in-out infinite"}
            onClick={() => { markOpened("charts"); openCompareCharts(); }}
          >
            <Icon boxSize="4"><LuChartSpline /></Icon>
            <Text fontSize="sm" fontWeight="semibold">Compare all options</Text>
          </Button>
          <Text fontSize="2xs" color={pal.textFaint} textAlign="center" px="2" lineHeight="tall">
            Two radar charts: what each option achieves, and what each one prioritizes.
          </Text>
        </VStack>

        {/* Options */}
        <VStack align="stretch" gap="4">
          {/*
            THE PLANNER PANEL. Shown identically in every SCORED scenario, for every participant,
            whether or not anything is actually blocked. It must NOT appear only when a limit is
            crossed: an explanation that fires exactly where the measurement is most sensitive would
            be an uncontrolled manipulation. See docs/BLOCK5_PLANNER_ORDERING_PLAN.md §10.

            ABSENT IN SCENARIO 6, because there is no order to explain. Those four rules are
            shuffled, and a panel headed "why these are in this order" above a random list would be
            telling the participant something untrue.

            IT SITS ABOVE THE HEADING, AND IT NO LONGER LOOKS LIKE A CARD (researcher, 23 September
            2026). Between the heading and the six cards, in a panel surface with card-like
            corners, it read as a seventh option - the one thing it must never look like on a page
            whose whole task is choosing one of six. It now carries the accent spine this file
            already uses for "an explanation you can open", sits before the heading that introduces
            the list, and is separated from it by the same gap as everything else.
          */}
          {scenarioShowsPerformance(scenario) && (
          <Box bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder}
            borderLeftWidth="4px" rounded="lg" style={{ borderLeftColor: pal.accent }}
            px={{ base: "3.5", md: "4" }} py="3">
            {/* NO GLOW ON THIS ONE, on the advisor's instruction. Every other foldable section
                holds something the participant needs — the scene, the numbers, their role. This one
                holds a single sentence about how the list below was sorted, and a control that
                breathes until it is opened is an instruction to open it. Drawing attention to the
                ordering is the last thing this panel should do. */}
            <CollapsibleHeader
              open={openOrdering}
              onToggle={() => { markOpened("ordering"); setOpenOrdering((v) => !v); }}
              px="0" py="0"
            >
              <Icon color={pal.accent} boxSize="3.5"><LuScale /></Icon>
              <Text fontSize="2xs" fontWeight="bold" letterSpacing="widest" textTransform="uppercase" color={pal.accent}>
                Why these are in this order
              </Text>
            </CollapsibleHeader>
            <Stack gap="1.5" mt={openOrdering ? "2" : "0"} display={openOrdering ? "flex" : "none"}>
              <Text fontSize="xs" color={pal.text} lineHeight="tall">{panelText.noteLine}</Text>
            </Stack>
          </Box>
          )}

          <Box>
            <Text fontSize="2xs" fontWeight="bold" color={pal.accent} textTransform="uppercase" letterSpacing="widest">
              The options — choose one policy
            </Text>
            <Text fontSize="xs" color={pal.textFaint} mt="1">
              All {displayOptions.length} options are available, and every one of them can be chosen.
            </Text>
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
                  methodLabel={scenario.methodLabel}
                  copy={decisionCopy}
                  expanded={openOptionId === opt.id} onToggle={() => toggleExpand(opt.id)}
                  folded={!openedHere.has(opt.id)} onFoldToggle={() => toggleFolded(opt.id)}
                  /* Every card stops hinting the moment ANY of them has been opened. */
                  hintDetails={expandedOptions.size === 0}
                  onSelect={() => handleSelect(opt.id)}
                  showPerformance={scenarioShowsPerformance(scenario)}
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
          prediction={prediction}
          onOpenPrediction={openPrediction}
          predSoundsLike={predSoundsLike} setPredSoundsLike={setPredSoundsLike}
          predSurprised={predSurprised} setPredSurprised={setPredSurprised}
          predAnswered={predAnswered} setPredAnswered={setPredAnswered}
          onLogPred={logPred}
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
          lastLensSeen={lastLensSeen}
          onLensShown={setLastLensSeen}
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
 * LocalStorage key remembering whether the participant minimized the dashboard to its bars.
 *
 * Remembered for the same reason the definitions are: this panel reappears on every scenario, and
 * a participant who has decided they want the room back should not have to say so six times.
 */
const METRICS_MINIMIZED_KEY = "block5_metrics_minimized";

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
  /*
   * SCENARIO 6. The participant is not choosing an ACTION, they are setting a RULE that will be
   * applied to a situation whose place in it they do not yet know. "Choose this option" would be
   * wrong twice over: nothing is being done now, and the thing being picked outlives the moment.
   *
   * `fitsIntro` deliberately does NOT say the rule fits their values. The decider version can say
   * that because it only appears when the option genuinely fits. Here every rule reaches this page,
   * including ones that cut against the participant's own profile, and the whole point of the
   * scenario is to find out which rule they set without being told how well it matches them.
   */
  predicted: {
    cardAction: "Set this as the rule",
    dialogEyebrow: "The rule you are setting",
    fitsIntro: "This is the rule you are about to set. Before you confirm, take a moment with what it gives up.",
    commit: "Yes, this is my rule",
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
      /*
        "AS WELL AS THEIRS" NAMED NOBODY. Changed on the researcher's instruction, 17 September 2026.
        A pronoun in the FIRST row pointed at a group the reader had not met yet — the household is
        introduced on the row below it. Naming them costs four words and removes the only piece of
        this card that had to be worked out rather than read.
      */
      { key: "you", icon: <LuUserRound />, label: "You",
        state: "At risk. You are choosing your own way out and your household's.", strong: true },
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
  /*
   * SCENARIO 6 — THE VEIL. Every row is lit, and every row says the same thing: not known yet.
   *
   * The other five entries answer "where do you stand?". This one answers it by refusing, which is
   * the manipulation rather than an absence of one. All three rows are marked strong on purpose:
   * emphasising one would hint at which position the participant is most likely to occupy, and the
   * exercise only works while every position is equally possible.
   */
  behind_the_veil: {
    badge: "You do not know who you will be",
    headline: "You are writing a rule you will live under, from a position you do not get to choose.",
    actors: [
      { key: "you", icon: <LuUserRound />, label: "You",
        state: "Unknown. Your place in this is assigned at random once the rule is set.", strong: true },
      { key: "with", icon: <LuUsersRound />, label: "The people around you",
        state: "Unknown. You may be the one who needs help, or the one who has to apply your rule.", strong: true },
      { key: "other", icon: <LuGlobe />, label: "Everyone else",
        state: "All of them. The rule applies to every person here, with no exceptions — including you.", strong: true },
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

export function ScenarioRoleCard({ scenario, pal, open = true, onToggle }: {
  scenario: Block5Scenario; pal: Block5Palette;
  /** Collapsed on the options page, where the intro has just shown this in full. Open elsewhere. */
  open?: boolean; onToggle?: () => void;
}) {
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
      {/* The badge stays on the header so the participant's position is legible even closed: it is
          the block's independent variable, and folding it away entirely would hide the manipulation
          rather than merely tidy the page. */}
      <HStack gap="2" px={{ base: "4", md: "5" }} py="3" justify="space-between" align="center"
        as={onToggle ? "button" : undefined} w={onToggle ? "full" : undefined}
        onClick={onToggle} cursor={onToggle ? "pointer" : undefined}
        aria-expanded={onToggle ? open : undefined}
        style={{ background: pal.accent, color: onAccent }}>
        <HStack gap="2.5" minW="0">
          <Icon boxSize="4"><LuUserRound /></Icon>
          <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="widest">
            Your role
          </Text>
        </HStack>
        <HStack gap="2" minW="0">
          {view && (
            <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider"
              px="2" py="0.5" rounded="md" textAlign="right" lineHeight="short"
              style={{ background: onAccent === "#ffffff" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.3)" }}>
              {view.badge}
            </Text>
          )}
          {onToggle && (
            <Icon boxSize="4" transition="transform 0.2s ease"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
              <LuChevronDown />
            </Icon>
          )}
        </HStack>
      </HStack>

      {open && (
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
      )}
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
  /*
   * TWO EXPLANATIONS, EACH WITH ITS OWN ICON AND ITS OWN OPEN/CLOSED STATE.
   *
   * They used to be mutually exclusive — pressing the info button swapped one for the other — which
   * is why they read as two unrelated things rather than as one explanation and its detail. Each is
   * now a foldable panel that opens and closes on its own heading.
   *
   * BOTH START CLOSED. Their headings stay on screen either way, so what a closed panel hides is
   * the text and never the offer — a participant can always see that an explanation of a high or
   * low number exists, and open it the moment they want it. Two open panels on a dashboard that
   * reappears on all six scenarios pushes the numbers they explain off the top of the page, which
   * is the opposite of helping.
   */
  const [showHighLow, setShowHighLow] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  /**
   * MINIMIZED KEEPS THE MEASUREMENT AND DROPS THE EXPLANATION OF IT.
   *
   * A plain collapsible would hide the five bars as well, which is the one thing on this panel a
   * participant might want in view while they read six option cards — it is the running record of
   * their own choices, and it is why the panel is sticky in the first place. What costs them room
   * is everything around it: the heading, the overall badge, the two explanation panels and a line
   * of meaning under every bar. So minimizing removes exactly that and leaves the labels and the
   * bars, and the panel comes back whole on the next press.
   *
   * The dashboard's height is watched by a ResizeObserver in the simulation (see dashRef), so the
   * scenario panel below re-parks itself against the shorter dashboard with nothing to do here.
   */
  const [minimized, setMinimized] = useState<boolean>(() => {
    try { return localStorage.getItem(METRICS_MINIMIZED_KEY) === "1"; } catch { return false; }
  });
  const toggleMinimized = useCallback(() => {
    setMinimized((v) => {
      const next = !v;
      try { localStorage.setItem(METRICS_MINIMIZED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const isPreview = !!projected;
  const display = projected ?? current;
  const overall = metricProfileScore(display);
  const baseOverall = metricProfileScore(current);
  const overallDelta = overall - baseOverall;
  // Delta colors tuned for legibility in each mode.
  const pos = pal.mode === "light" ? "#15803d" : "#86efac";
  const neg = pal.mode === "light" ? "#b91c1c" : "#fca5a5";

  /*
   * "CUMULATIVE", NOT JUST "PERFORMANCE", on the advisor's instruction (16 September 2026).
   *
   * This dashboard and the bars inside an option card carry the same five measure names and mean
   * completely different things: this one is the average of everything already CONFIRMED, and the
   * card's bars are a forecast for one option that has been chosen by nobody. Two panels titled
   * "performance" invite a participant to read the card's numbers as their score, which turns every
   * option into a verdict on them.
   *
   * The word is the cheapest possible fix and it has to match the pre-Block-5 page, which now
   * teaches the same three things under the same names.
   */
  /*
     ONE CONTROL, RENDERED IN WHICHEVER PLACE IS ON SCREEN. Open, it sits with the other controls in
     the title row. Minimized, that row is gone, so it moves beside the bars — the same icon in the
     same corner of the panel either way, which is what keeps it findable. An icon rather than a
     label, so it cannot be confused with "Hide definitions", which is text and does something
     smaller.
  */
  const minimizeButton = (
    <Button size="2xs" variant="ghost" rounded="md" px="1.5" minW="auto"
      color={pal.textMuted} _hover={{ bg: pal.surfaceSubtle, color: pal.text }}
      onClick={toggleMinimized}
      aria-expanded={!minimized}
      aria-label={minimized ? "Show the whole performance panel" : "Minimize to the bars only"}
      title={minimized ? "Show the whole performance panel" : "Minimize to the bars only"}>
      <Icon boxSize="3.5">{minimized ? <LuChevronsUpDown /> : <LuChevronsDownUp />}</Icon>
    </Button>
  );

  const label = isPreview
    ? `Projected if you choose: ${previewTitle}`
    : completedCount === 0
      /* UPDATES WITH EACH SCENARIO, not "fills in as you choose". "As you choose" describes
         something happening while the participant browses, which is exactly what Preview impact
         does and exactly what this number does NOT do: it moves once per scenario, when a choice
         is confirmed. The old wording promised the behavior of the other control. */
      ? "Your cumulative performance — starts at 0, updates with each scenario"
      : `Your cumulative performance — average of ${completedCount} scenario${completedCount > 1 ? "s" : ""} so far`;

  return (
    <Box bg={pal.dashBg} backdropFilter={pal.backdropBlur} borderWidth="1px"
      borderColor={isPreview ? accent : pal.dashBorder}
      borderTopWidth="3px" borderTopColor={isPreview ? accent : pal.dashTopBorder}
      rounded="2xl" p={minimized ? { base: "3", md: "3.5" } : { base: "4", md: "5" }}
      style={{ boxShadow: pal.dashShadow }} transition="border-color 0.2s ease, padding 0.2s ease">
      {!minimized && (
      <HStack justify="space-between" mb="2" wrap="wrap" gap="2">
        <HStack gap="2" minW="0" flex="1">
          <Icon color={accent} flexShrink={0}>{isPreview ? <LuEye /> : <LuGauge />}</Icon>
          {isPreview ? (
            /*
              THE PREVIEW STATE NAMES THE OPTION, AS A CHIP RATHER THAN AS A TITLE.
              It used to read "Projected if you choose: Drive out on the industrial service road" in
              the same small uppercase type as the real heading, which is how a temporary state ends
              up looking like a new permanent one. A tinted chip beside the option's own title, in
              the option's own sentence case, reads as something switched on — and switched on by
              the participant, over there, on that card.
            */
            <HStack gap="2" minW="0">
              <Badge bg={accent} color={onAccentText(accent)} rounded="md" px="2" py="0.5"
                fontSize="2xs" fontWeight="bold" letterSpacing="wider" textTransform="uppercase"
                flexShrink={0}>
                Previewing
              </Badge>
              <Text fontSize="xs" fontWeight="semibold" color={pal.dashTitleColor} lineClamp={1}>
                {previewTitle}
              </Text>
            </HStack>
          ) : (
            <Text fontSize="xs" fontWeight="bold" color={pal.dashTitleColor} textTransform="uppercase" letterSpacing="wider">{label}</Text>
          )}
          {/* NO INFO BUTTON HERE ANY MORE. It opened a panel that now carries its own heading and
              its own chevron, so a second control for the same thing in the title row was one
              control too many — and the one further from what it opened. */}
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
          {minimizeButton}
        </HStack>
      </HStack>
      )}

      {/*
        ═══════════════════════════════════════════════════════════════════════════════════════
        THE TWO EXPLANATIONS OF THIS DASHBOARD, AS A MATCHED, FOLDABLE PAIR.
        ═══════════════════════════════════════════════════════════════════════════════════════

        WHAT WAS WRONG. There were two explanations of the same five numbers and they were mutually
        exclusive: the short one showed until you pressed an info button in the title row, and then
        it was replaced by the long one. Only the short one had a heading. So a participant pressing
        the button saw one block of text vanish and a different block appear, with nothing to say
        that the second was the first one going deeper.

        WHAT THEY ARE NOW. Two panels, stacked, sharing a container, an accent spine and a heading
        shape, each opening and closing on its own heading:

          [dial]  What a high or low number means here   how to READ the number.
          [info]  Where these numbers come from          the MECHANICS behind it.

        BOTH START CLOSED, and both headings stay on screen either way, so a closed panel hides its
        text and never the offer. The dashboard reappears on all six scenarios; two open panels of
        explanation above the numbers they explain is the opposite of helping.

        The info mark is the same icon that used to sit in the title row, so the control a
        participant learned is still the control - it has just moved onto the thing it opens.
        ═══════════════════════════════════════════════════════════════════════════════════════
      */}
      {!minimized && (isPreview ? (
        /* The second sentence exists so the automatic clear reads as a rule rather than a glitch.
           A number that disappears on its own, unexplained, is the kind of thing a participant
           quietly stops trusting. */
        <Text fontSize="xs" color={pal.textFaint} mb="3" lineHeight="tall">
          Preview only — your choice isn&apos;t saved until you confirm it. This goes back to your real
          total as soon as you scroll away from that option.
        </Text>
      ) : (
        <VStack align="stretch" gap="2" mb="3">
          {/* ---- 1 - how to read the number ------------------------------------------------ */}
          <Box bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder}
            borderLeftWidth="4px" rounded="lg" px={{ base: "3.5", md: "4" }} py="2.5"
            style={{ borderLeftColor: accent }}>
            <CollapsibleHeader
              open={showHighLow} onToggle={() => setShowHighLow((s) => !s)} px="0" py="0"
            >
              <Icon color={accent} boxSize="3.5"><LuGauge /></Icon>
              <Text fontSize="2xs" fontWeight="bold" letterSpacing="wider" textTransform="uppercase"
                color={pal.textMuted}>
                What a high or low number means here
              </Text>
            </CollapsibleHeader>
            {showHighLow && (
              <Box mt="2.5">
                {/*
                  WHY THIS IS PHRASED SO CAREFULLY. The honest reading of a high number is that the
                  options this participant kept choosing scored well on that measure. It is NOT a
                  claim about what they consciously intended: somebody can finish the block with a
                  high speed score having never once thought about speed. The copy describes the
                  pattern in the choices and stops there.

                  THE SECOND PARAGRAPH IS NOT DECORATION. Telling somebody mid-block that these five
                  are a picture of what has been mattering to them is a mirror, and a mirror invites
                  tidying: a participant who reads a low bar as a gap in themselves starts choosing
                  to fill it, and the block stops measuring what they value and starts measuring
                  what they think looks balanced. Saying plainly that no shape is the right one is
                  what keeps an explanation from becoming an instruction.

                  THE COLORS ARE THE PAIR USED EVERYWHERE ELSE IN THE BLOCK: green for what an
                  option achieves, red for what it gives up - the same two on every card's trade-off
                  panel and under the radar charts.
                */}
                <Text fontSize="xs" color={pal.text} lineHeight="tall">
                  {completedCount === 0
                    ? "These five are empty until you confirm your first choice. After that they are the average of every option you have confirmed. "
                    : "These five are the average of every option you have already confirmed. "}
                  <Text as="span" fontWeight="bold" color={pal.gainColor}>A high number</Text> means
                  the options you kept choosing scored well on that measure.{" "}
                  <Text as="span" fontWeight="bold" color={pal.costColor}>A low number</Text> means
                  you kept choosing options that gave it up to get something else. Together they are
                  a picture of{" "}
                  <Text as="span" fontWeight="bold" color={pal.text}>
                    what has been weighing most in your decisions across the whole block
                  </Text>
                  {" "}— not a mark on this situation.
                </Text>
                <Text fontSize="xs" color={pal.textMuted} lineHeight="tall" mt="2">
                  <Text as="span" fontWeight="bold" color={pal.text}>No shape is the right one</Text>,
                  and there is nothing here to even out. Someone who always takes the fastest way out
                  and someone who always takes the one they can undo are both answering honestly.
                </Text>
              </Box>
            )}
          </Box>

          {/* ---- 2 - where the number comes from -------------------------------------------- */}
          <Box bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder}
            borderLeftWidth="4px" rounded="lg" px={{ base: "3.5", md: "4" }} py="2.5"
            style={{ borderLeftColor: accent }}>
            {/* NO GLOW, on the researcher's instruction. Both panels carry a heading, an icon and a
                chevron sitting directly above the numbers they explain, which is affordance enough
                — and a control that breathes on a dashboard the participant meets on every one of
                six scenarios is nagging rather than helping. The `infoOpened` flag that used to stop
                the glow after the first open went with it; it fed nothing else. */}
            <CollapsibleHeader
              open={showInfo}
              onToggle={() => setShowInfo((s) => !s)}
              px="0" py="0"
            >
              <Icon color={accent} boxSize="3.5"><LuInfo /></Icon>
              <Text fontSize="2xs" fontWeight="bold" letterSpacing="wider" textTransform="uppercase"
                color={pal.textMuted}>
                Where these numbers come from
              </Text>
            </CollapsibleHeader>
            {showInfo && (
              <VStack align="start" gap="2" mt="2.5">
                {/*
                  THIS PANEL ONCE DESCRIBED A BLOCK THAT NO LONGER EXISTS. It said "these 8 bars"
                  when there are five, and it named the four VALUES as though they were the
                  performance measures - the two things a participant most needs kept apart.

                  It now says the three things that are true and are genuinely confusable: this is a
                  record of choices already made, the same five names inside a card are a forecast
                  for one option not yet chosen, and neither of them is about the participant's
                  values.
                */}
                <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
                  These five bars are a running record of <b>your own choices</b> — not a score for
                  any option in front of you. Each time you confirm a choice, that option&apos;s five
                  readings are <b>averaged</b> in, so the bars start at zero, update with each
                  scenario, and can never pass 100. “Preview impact” on a card shows what they{" "}
                  <b>would become</b> if you picked it, without picking it.
                </Text>
                <Text fontSize="xs" color={pal.textMuted} lineHeight="tall">
                  The same five names appear inside each option card, under “What this option
                  achieves”. Those describe <b>one option you have not chosen</b>, placed against the
                  other five on this table. They are not your score.
                </Text>
                {/*
                  IT NO LONGER POINTS AT A LABEL THAT IS NOT THERE. This sentence used to end with
                  the alignment label on each card, and there is no alignment label on a card any
                  more: the tier badge came off the card corner, and the last copy of it came off the
                  compare-charts overlay on 15 September 2026. An explanation that sends a
                  participant looking for something that does not exist is worse than no explanation,
                  because they conclude they have missed it.

                  The one place their values are still reported to them is the quiet line at the foot
                  of an open card's values section, so that is what it names now, in the card's own
                  words.
                */}
                <Text fontSize="xs" color={pal.textFaint} lineHeight="tall">
                  All of this is <b>outcome quality</b> — how well an option works. How well it
                  matches <b>your values</b> is a separate thing entirely. You will find that inside
                  an open card, on the line that reads <b>“Matches your earlier answers”</b>.
                </Text>
              </VStack>
            )}
          </Box>
        </VStack>
      ))}

      {/* The bars, and — when the panel is minimized — the one control that brings it back. */}
      <HStack align="start" gap="3">
        <Box flex="1" minW="0">
          <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(5, 1fr)" }} gap={{ base: "3", md: "4" }}>
            {METRIC_KEYS.map((k) => {
              const val = display[k];
              const delta = val - current[k];
              return (
                <Box key={k} position="relative" cursor="default">
                  <HStack justify="space-between" mb="1">
                    <Text fontSize="xs" fontWeight="semibold" color={pal.text} lineClamp={1}>{METRIC_LABELS[k]}</Text>
                    {/* THE NUMBER STAYS WHEN MINIMIZED (researcher, 23 September 2026). A bar
                        without its reading makes the strip something to squint at rather than
                        something to glance at, and the number is the measurement itself — the
                        explanation of it is what minimizing puts away. */}
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
                  {showMeanings && !minimized && (
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
        {minimized && minimizeButton}
      </HStack>
    </Box>
  );
}

/** One shared empty set for "nothing has been opened in this scenario yet". Never mutated. */
const EMPTY_FOLDS: ReadonlySet<string> = new Set();

/* ---------------- Option card ---------------- */

function OptionCard({ option, profile, accent, pal, explanation, standing, scenarioId, methodLabel, copy, expanded, onToggle, folded, onFoldToggle, onSelect, isPreviewing, onPreview, impact, disabled, hintDetails, showPerformance }: {
  option: LabeledOption; profile: Block5UserProfile; accent: string; pal: Block5Palette;
  /** The scenario's own heading for the method box ("How you travel"). Absent hides the box. */
  methodLabel?: string;
  /** Planner state for this card, or null before the planner has run. */
  explanation: CardExplanation | null;
  /** Where this option's five metrics sit inside the range its scenario offers. */
  standing: { rows: MetricStanding[]; overall: OverallStanding } | null;
  /** Chooses which reading of each metric to show — "speed" is not the same thing in every scenario. */
  scenarioId: string;
  /** Deciding-versus-wishing wording for this scenario. See DECISION_COPY. */
  copy: (typeof DECISION_COPY)[keyof typeof DECISION_COPY];
  expanded: boolean; onToggle: () => void; onSelect: () => void;
  /** True while this card is folded to its title. Every card starts folded (23 September 2026). */
  folded: boolean;
  onFoldToggle: () => void;
  isPreviewing: boolean; onPreview: () => void; impact: PreviewImpact | null; disabled: boolean;
  /** False in scenario 6: no performance exists there, so there is nothing to preview. */
  showPerformance: boolean;
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
  /**
   * THE FOLD CONTROL, rendered in both states so it never moves.
   *
   * A chevron with no label: the card's title is beside it and says what it belongs to, and a
   * worded button here would compete with "Choose this option" further down, which is the one
   * action on this card that matters.
   */
  const foldButton = (
    <Button size="2xs" variant="ghost" rounded="md" px="1.5" minW="auto" flexShrink={0}
      color={pal.textMuted} _hover={{ bg: pal.surfaceSubtle, color: pal.text }}
      onClick={(e) => { e.stopPropagation(); onFoldToggle(); }}
      aria-expanded={!folded}
      aria-label={folded ? "Open this option" : "Fold this option down to its title"}
      title={folded ? "Open this option" : "Fold this option down to its title"}>
      <Icon boxSize="4">{folded ? <LuChevronDown /> : <LuChevronUp />}</Icon>
    </Button>
  );

  /*
   * FOLDED - THE STATE EVERY CARD STARTS IN: the title, its place in the order, and the way in.
   *
   * The rank square stays because the order is the one thing a folded card still has to carry -
   * without it a folded card is a title in a list with no position, and the planner's ordering is
   * part of what a participant is reading. The preview border stays too, so a card being previewed
   * is still recognisable when folded.
   */
  if (folded) {
    return (
      <Box data-card-open="0" data-option-id={option.id}
        backdropFilter={pal.backdropBlur}
        rounded="2xl" px={{ base: "4", md: "5" }} py="3"
        style={{
          background: pal.cardBg,
          borderStyle: "solid",
          borderWidth: isPreviewing ? "2px" : "1px",
          borderColor: isPreviewing ? accent : pal.cardBorder,
          boxShadow: pal.cardShadow,
        }}
        opacity={disabled ? 0.5 : recessed ? 0.82 : 1} transition="all 0.2s ease"
        _hover={disabled ? {} : { opacity: 1 }}>
        <Flex align="center" gap="3">
          {explanation && showPerformance && (
            <Flex flexShrink={0} align="center" justify="center" w="7" h="7" rounded="lg"
              borderWidth="1px" borderColor={pal.cardBorder} bg={pal.panelDeep}>
              <Text fontSize="sm" fontWeight="bold" color={pal.text} fontFamily="mono" lineHeight="1">
                {explanation.rank}
              </Text>
            </Flex>
          )}
          <Text color={pal.text} fontWeight="semibold" fontSize="md" lineHeight="short"
            minW="0" flex="1" lineClamp={2}>
            {option.title}
          </Text>
          {foldButton}
        </Flex>
      </Box>
    );
  }

  return (
    <Box data-card-open={expanded ? "1" : "0"}
      /* The preview watcher in the parent finds this card by its option id. See the effect that
         clears a preview once its card scrolls out of sight. */
      data-option-id={option.id}
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
          {explanation && showPerformance && (
            /* The planner's position. Deliberately NOT merged with the alignment tier beside it:
               a participant must be able to see a card labeled "Aligned" sitting at rank 4.

               ABSENT IN SCENARIO 6. Those four rules are shuffled, so a number beside them would be
               read as a ranking that does not exist - and worse, as a ranking the MPF is about to
               show a prediction against. A participant who sees "3" next to a rule has been told
               something about it before they have decided anything. */
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

            {/*
              HOW THIS OPTION IS ACTUALLY CARRIED OUT — see Block5OptionMethod in block5Types.ts for
              the reading that produced it.

              IT SITS DIRECTLY UNDER THE SUMMARY, above the trade-off, because it is part of what
              the option IS rather than part of what it costs. A participant comparing two cards is
              comparing two methods first and two trade-offs second.

              THE METHOD ITSELF CARRIES THE EMPHASIS and the qualifying clause does not. On a page
              of six cards the one word that has to survive a skim is the vehicle.
            */}
            {methodLabel && option.method && (
              <HStack
                gap="2.5" align="start" mt="0.5" px="3" py="2" rounded="lg"
                borderWidth="1px" borderLeftWidth="3px"
                style={{
                  background: `${accent}12`,
                  borderColor: `${accent}33`,
                  borderLeftColor: accent,
                }}
              >
                <Center boxSize="5" minW="5" rounded="md" flexShrink={0} mt="0.5"
                  style={{ background: accent, color: onAccentText(accent) }}>
                  <Icon boxSize="3">{METHOD_ICON[option.method.kind]}</Icon>
                </Center>
                <Box minW="0">
                  <Text fontSize="2xs" fontWeight="bold" letterSpacing="wider" textTransform="uppercase"
                    color={pal.textMuted} mb="0.5">
                    {methodLabel}
                  </Text>
                  <Text fontSize="sm" color={pal.textMuted} lineHeight="tall">
                    <Text as="span" fontWeight="bold" color={pal.text}>{option.method.by}</Text>
                    {/* No dash when there is no detail: the name alone is the whole box. See the
                        note on `detail` in block5Types.ts for when a card should have one. */}
                    {option.method.detail && <>{" — "}{option.method.detail}</>}
                  </Text>
                </Box>
              </HStack>
            )}
          </VStack>
        </HStack>
        {/* The way to fold this card away, in the corner the tag cluster used to occupy. */}
        {foldButton}
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
          {/*
            THE QUESTION IS SET AT THE SIZE OF THE THINGS IT ASKS ABOUT, on the researcher's
            instruction, 17 September 2026.

            It was `xs` and `textMuted` under a hairline rule - the smallest, faintest text on a card
            whose gain and cost lines are both `sm`. That is the one line that asks the participant
            something instead of telling them something, and it was set like a footnote, so it read
            as decoration after the decision rather than as part of it.

            Now `sm` and `pal.text`, matching the gain and the cost. The italic still separates it,
            so it cannot be mistaken for a third fact.
          */}
          {option.moralTension && (
            <HStack align="start" gap="2.5" mt="3" pt="2.5" borderTopWidth="1px" borderTopColor={pal.separator}>
              <Icon color={pal.textMuted} boxSize="4" mt="0.5" flexShrink={0}><LuScale /></Icon>
              <Text fontSize="sm" fontStyle="italic" color={pal.text} lineHeight="tall">
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

        ABSENT IN SCENARIO 6. Every line of it describes a rank that scenario does not have: "beat
        all 3 of the other options", "this is the option that stays inside every limit you set", and
        the fit score out of 100. The rules there are shuffled, and the fit score is the raw material
        the MPF's guess is built from - showing it beside the options and then showing the guess
        would be marking the participant's answer before they had given it.
      */}
      {explanation && showPerformance && (
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
              {/*
                THE PERFORMANCE ROW IS ONE STEP LARGER THAN IT WAS, on the advisor's instruction.

                These chips carry the only outcome information on a collapsed card, and at 2xs they
                were the smallest type on a page that already asks a great deal of reading. The
                padding grows with the type so a chip keeps its proportions rather than becoming
                text with a box drawn tightly round it.
              */}
              <Text fontSize="xs" fontWeight="bold" letterSpacing="wider" textTransform="uppercase"
                color={pal.textMuted} mb="2">
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
                  <Badge rounded="md" px="2.5" py="1" fontSize="xs" fontWeight="bold"
                    color={accent} borderWidth="1px"
                    style={{ background: `${accent}1A`, borderColor: `${accent}59` }}
                    title={`On the five outcome measures combined, this is the ${ordinal(standing.overall.rank)} strongest of the ${standing.overall.total} options in this scenario`}>
                    Performance {ordinal(standing.overall.rank)} of {standing.overall.total}
                  </Badge>
                )}
                {explanation.chips.map((c) => (
                  <Badge key={c} bg={pal.badgeBg} color={pal.badgeText} rounded="md" px="2.5" py="1" fontSize="xs">
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
            {/* Same wording as the worked example on the pre-Block-5 page, so the widget is recognized
                rather than met for the first time here. */}
            <Text fontSize="2xs" color={pal.textMuted} textTransform="uppercase" letterSpacing="wider">Impact on your cumulative performance</Text>
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
        {/* Previewing impact means projecting this option's METRICS onto the running totals.
            Scenario 6 has no metrics worth projecting and no running total to project onto. */}
        {showPerformance && (
          <Button size="sm" variant="outline"
            borderColor={isPreviewing ? accent : pal.cardBorder} color={isPreviewing ? accent : pal.textMuted}
            bg={isPreviewing ? pal.surfaceSubtle : "transparent"}
            _hover={{ bg: pal.surfaceSubtle }} rounded="lg" onClick={onPreview} disabled={disabled} gap="1" fontSize="xs">
            <Icon boxSize="3.5"><LuEye /></Icon>
            {isPreviewing ? "Previewing impact" : "Preview impact"}
          </Button>
        )}
        <Button size="sm" bg={accent} color="white" _hover={{ opacity: 0.9 }} rounded="lg" onClick={onSelect} disabled={disabled} fontSize="xs" fontWeight="semibold">
          {copy.cardAction}
        </Button>
      </HStack>

      {expanded && (
        <Box mt="4" pt="4" borderTopWidth="1px" borderColor={pal.separator}>
          {/*
            THE TWO EXPLAINERS INSIDE AN OPEN CARD, RAISED TWICE ON THE ADVISOR'S INSTRUCTION.
            2xs on textFaint originally, then xs on textMuted, and now sm under md headings.

            Each is the instruction for reading the chart directly beneath it. A participant who
            cannot comfortably read "a bar that reaches the line satisfies that value" is left to
            guess what the bars mean, and a misread chart is worse than no chart at all.

            THE BODY NOW SITS AT `sm`, WHICH IS THE CARD'S OWN READING SIZE - the same size as the
            option summary and the two trade-off lines. That is the reason for stopping here: these
            sentences are prose to be read, so they belong at the size everything else that is read
            rather than scanned is set in, and no larger.

            THE HEADINGS TAKE `md` AND LOSE A STEP OF TRACKING. Wide letter-spacing is what makes a
            10px all-caps label legible; at 16px it only makes the line long enough to wrap on a
            phone. Bigger type needs less of it, not the same amount.
          */}
          <Text fontSize="md" fontWeight="semibold" color={pal.textMuted} textTransform="uppercase" letterSpacing="wide" mb="2.5">
            How this option fits your values
          </Text>
          <Text fontSize="sm" color={pal.textMuted} mb="4" lineHeight="tall">
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
              {/* The same two sizes as the values explainer above it. They are read one after the
                  other, and a difference between them would say that one mattered more. */}
              <Text fontSize="md" fontWeight="semibold" color={pal.textMuted} textTransform="uppercase" letterSpacing="wide" mb="2.5">
                What this option achieves
              </Text>
              <Text fontSize="sm" color={pal.textMuted} mb="4" lineHeight="tall">
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

/**
 * The one line that best stands for a lens, for the comparison card.
 *
 * The directness lens closes by naming the participant, so that is its line. The context lens
 * closes on nothing at all (see CVRLensBlock.prompt), so its last consequence speaks for it.
 */
function lensClosingLine(lens: CVRLensBlock): string {
  if (lens.prompt) return lens.prompt;
  const pts = lens.points ?? [];
  return pts.length ? pts[pts.length - 1].text : lens.body;
}

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
  const seed = option.cvrSeed;
  /*
   * THE LINE THAT STANDS FOR EACH VIEW is the view's OPENING sentence — what somebody does there
   * (researcher, 18 September 2026).
   *
   * It used to be the view's LAST line, cut out on its own: "She may wait hours for the crew to
   * reach that room. By then the hood could be across the city." Nothing in the box said who she
   * was, which room, or what hood, and the directness box read "If it happens…" with no "it".
   * The authored `act` and `parallelAct` each name who, what and where in one sentence, so each
   * box can be read without the lens beside it. The last line stays as the fallback for an option
   * written before those fields existed, because an empty half would make the question unanswerable.
   *
   * BOTH BOXES ARE SET IN THE SAME PLAIN STYLE: the lens markup is stripped. On the lens page the
   * whole other-place sentence is violet, bold and italic, which is right there. Here the
   * participant is asked to CHOOSE between the two boxes, and one printed louder than the other is
   * a nudge toward it (found on screen, 18 September 2026).
   */
  const line = (framing: CVRFraming) =>
    ((framing === "directness" ? seed?.act : seed?.parallelAct) ?? lensClosingLine(lenses[framing]))
      .replace(/\{[a-z]\|([^{}]*)\}/g, "$1");
  const cell = (framing: CVRFraming) => (
    <Box flex="1" minW="0" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="lg" px="3.5" py="3">
      <Text fontSize="xs" fontWeight="bold" color="fg" mb="1">
        <Text as="span" color={markColor}>▍</Text> {viewLabelFor(framing, coord.framing)}
        <Text as="span" color="fg.subtle" fontWeight="normal"> — {FRAMING_META[framing].gloss}</Text>
      </Text>
      <Text fontSize="xs" color="fg.subtle" fontWeight="semibold" mb="1">{lenses[framing].heading}</Text>
      <Text fontSize="sm" color="fg.muted" lineHeight="tall">
        {renderCVRMarkup(line(framing), marks)}
      </Text>
    </Box>
  );
  /*
   * IN THE ORDER THE PARTICIPANT MET THEM — the Main view first — which is also the order of the
   * answers underneath. The boxes used to be fixed as directness-then-context, so whenever the
   * context view came first the two rows ran in opposite directions ("Alternative | Main" above,
   * "Main, Alternative" below).
   */
  return (
    <Stack gap="1.5">
      <Text fontSize="2xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="bold">
        The two views you saw
      </Text>
      <Stack direction={{ base: "column", md: "row" }} gap="2" align="stretch">
        {cell(coord.framing)}
        {cell(otherFraming(coord.framing))}
      </Stack>
    </Stack>
  );
}

/**
 * CVRReveal — presents the recontextualization + stakeholder vignette like a streaming LLM
 * answer: a random 2–5s "thinking" pause, then box 1 fades in and types, then box 2 fades in
 * and types, then the legend, then the response buttons. A "Skip" control reveals it all at once.
 */
function CVRReveal({ story, altStory, accent, mode, onAltGenerated, onLensShown, onCvrYes, onCvrNo, onCvrBackout }: {
  story: ReturnType<typeof getCVRStory>;
  /** the SAME vignette with the framing flipped (the other reflection lens). */
  altStory: ReturnType<typeof getCVRStory>;
  level: AlignmentLevel;
  accent: string;
  /** color mode — picks the bright (dark) vs darker (light) CVR highlight colors. */
  mode: "light" | "dark";
  /** called once when the participant generates the alternate lens (lifts state to FlowOverlay). */
  onAltGenerated: () => void;
  /** called with the lens now on screen, every time the toggle moves it. */
  onLensShown: (f: CVRFraming) => void;
  onCvrYes: () => void; onCvrNo: () => void; onCvrBackout: () => void;
}) {
  /*
   * NO "box1" PHASE ANY MORE. It typed out the recontext paragraph, and both the paragraph and the
   * faint recap of the situation above it were removed on 16 September 2026 — see CVRStory in
   * block5Types.ts. The page now goes straight from the thinking pause to the lens.
   */
  type Phase = "thinking" | "box2" | "settle" | "done";
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
  /* Nothing on screen names a lens anymore, so the second framing is no longer needed here —
     `altStory` is passed in already built. */
  const marks = cvrMarks(mode); // mode-aware highlight colors for the vignette markup

  // Random "thinking" wait (2–5s) on every arrival, then begin generating the first view.
  useEffect(() => {
    const ms = 2000 + Math.random() * 3000;
    const id = setTimeout(() => setPhase("box2"), ms);
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

  /*
   * REPORT THE LENS UPWARD, on arrival and on every toggle.
   *
   * The APA page asks a question only the CURRENT lens can answer — see `lastLensSeen`. Reporting
   * on the toggle rather than once at the start is the whole point: a participant may read the
   * second lens and go back, and the last thing they read is the one that counts.
   */
  const shownFraming = shownStory.lens?.framing;
  useEffect(() => {
    if (shownFraming) onLensShown(shownFraming);
  }, [shownFraming, onLensShown]);

  /** The lens block's parts, and the cursor value that means "all of it is on screen". */
  const lensPoints = shownStory.lens?.points ?? [];
  /* The body, then one step per point, then the closing line IF there is one. The context lens
     has none, so without this the reveal would wait forever for a line that never types. */
  const b2Done = lensPoints.length + (shownStory.lens?.prompt ? 2 : 1);
  /** A vignette with no lens block has nothing to wait for, so it must not gate what follows. */
  const b2Complete = skipped || !shownStory.lens || b2Part >= b2Done;

  /* Generating the second lens re-streams the whole block, not just its first paragraph — the
     consequences are what actually differ between the two lenses. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- part of the lens reveal's sequencing, which participants see; moving it out of the effect would change the reveal, so it is left as is.
    if (altState === "regenTyping") setB2Part(0);
  }, [altState]);

  /* The second lens is "ready" once its LAST line has typed, not its first. */
  useEffect(() => {
    if (altState === "regenTyping" && b2Part >= b2Done) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- same as above: the lens reveal's sequencing is left as is.
      setAltState("ready");
      setCurrentView("second");
    }
  }, [altState, b2Part, b2Done]);

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
  return (
    <Stack gap="4">
      {/* No alignment verdict is shown here. This page asks the participant to re-read the choice
          they already made; stamping "Misaligned with your values" across the top of it answers
          the question for them before they have started thinking. */}
      <HStack justify="space-between" align="center" gap="2">
        {/*
          The mark for this step, so the feedback question that asks about it later can carry the
          same one. The participant is never told the acronym; they are given something to
          recognize. See MethodLogo.
        */}
        <MethodLogo method="cvr" />
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

      {/*
        THE FAINT RECAP OF THE SITUATION IS GONE, with the paragraph it sat above. It restated the
        situation box the participant had read minutes earlier, in the smallest and lowest-contrast
        text on the page — a recap nobody reads, above a paragraph nobody could parse. The vignette
        now opens on the lens itself.
      */}
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

              {/* the closing line — who decided this. Absent on the context lens, on purpose. */}
              {shownStory.lens.prompt && (skipped || b2Part >= lensPoints.length + 1) && (
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
          prose, where they do their work without being labeled. */}

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
            label="No, not anymore"
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
              meaning="I do not want this option anymore. Hearing this person changed what matters to me."
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
  altViewGenerated, onAltGenerated, lastLensSeen, onLensShown, framingChoiceYes, setFramingChoiceYes, mode,
  prediction, onOpenPrediction, predSoundsLike, setPredSoundsLike, predSurprised, setPredSurprised,
  predAnswered, setPredAnswered, onLogPred,
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
  /** Scenario 6 only: the frozen guess, and the three pieces of state its screen owns. */
  prediction: ChoicePrediction | null; onOpenPrediction: () => void;
  predSoundsLike: number | null; setPredSoundsLike: (n: number) => void;
  predSurprised: boolean | null; setPredSurprised: (b: boolean) => void;
  predAnswered: boolean; setPredAnswered: (b: boolean) => void;
  onLogPred: (what: PredictionTestRecord["interactions"][number]["what"],
              extra?: { optionId?: string; value?: string | number }) => void;
  // Telemetry wrappers for the CVR/APA transitions (observation only — same navigation).
  onCvrYes: () => void; onCvrNo: () => void; onCvrBackout: () => void;
  onApaBail: () => void; onFinalDecisionChange: () => void;
  /** which side they took on the vignette, and the answer on the person page. */
  cvrSaidYes: boolean | null;
  onPersonAnswer: (moved: boolean) => void;
  onPersonBackout: () => void;
  // Dual-perspective (Directness ↔ Context): generation flag + the YES-path "did NOT influence" answer.
  altViewGenerated: boolean; onAltGenerated: () => void;
  /** which lens is in front of them right now, and the reporter that keeps it current. */
  lastLensSeen: CVRFraming | null; onLensShown: (f: CVRFraming) => void;
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

        {step === "prediction" && prediction && (
          <Stack gap="5">
            <Box>
              <Text fontSize="2xs" fontWeight="bold" color={accent} textTransform="uppercase" letterSpacing="widest">
                Before you chose, this is what we expected
              </Text>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall" mt="2">
                You picked <Text as="span" color="fg" fontWeight="semibold">{option.title}</Text>.
                Here is how likely our Moral Prediction Function (MPF) thought each rule was, for you.
              </Text>
            </Box>

            {/*
              NO REASONING IS SHOWN, by decision. Explaining the guess would teach the participant
              what the model thinks they value, and they would then answer "does this sound like
              you?" against a sentence we had just supplied rather than against themselves.

              THE CHANCE BASELINE IS PRINTED IN THE SAME SIZE AS THE PERCENTAGES. With four options
              a coin toss is already 25%, so a number like 33% is a far weaker claim than it looks,
              and a participant reading it without that anchor would credit the model with more than
              it did.
            */}
            <Stack gap="2">
              {[...prediction.options].sort((a, b) => a.rank - b.rank).map((o) => {
                const isChoice = o.optionId === option.id;
                const pct = Math.round(o.probability * 100);
                return (
                  <Box key={o.optionId} borderWidth="1px" rounded="lg" px="3" py="2.5"
                    borderColor={isChoice ? accent : "border.subtle"}
                    bg={isChoice ? "bg.subtle" : "transparent"}>
                    <HStack justify="space-between" gap="3" align="start">
                      <Text fontSize="xs" color={isChoice ? "fg" : "fg.muted"} fontWeight={isChoice ? "semibold" : "normal"}>
                        {o.optionTitle}
                        {isChoice && (
                          <Text as="span" color={accent} fontWeight="bold"> — you picked this</Text>
                        )}
                      </Text>
                      <Text fontSize="sm" fontWeight="bold" color={isChoice ? accent : "fg.muted"} flexShrink={0}>
                        {pct}%
                      </Text>
                    </HStack>
                    <Box mt="1.5" h="1.5" bg="bg.muted" rounded="full" overflow="hidden">
                      <Box h="100%" w={`${pct}%`} bg={isChoice ? accent : "fg.subtle"} rounded="full" />
                    </Box>
                  </Box>
                );
              })}
            </Stack>

            <Text fontSize="xs" color="fg.subtle" lineHeight="tall">
              With four rules, a coin toss would give <Text as="span" fontWeight="bold">25%</Text> to
              each one. The MPF can be wrong, and there is nothing wrong with your answer. This
              page is a test of the MPF, not of you.
            </Text>

            <Separator />

            <Stack gap="3">
              <Text fontSize="sm" color="fg" fontWeight="semibold">
                Does this guess sound like how you decide?
              </Text>
              <HStack gap="1.5" wrap="wrap">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Button key={n} size="sm" rounded="lg" minW="9" fontSize="xs"
                    variant={predSoundsLike === n ? "solid" : "outline"}
                    bg={predSoundsLike === n ? accent : "transparent"}
                    color={predSoundsLike === n ? "white" : "fg.muted"}
                    borderColor={predSoundsLike === n ? accent : "border.emphasized"}
                    onClick={() => { setPredSoundsLike(n); onLogPred("answered_sounds_like", { value: n }); }}>
                    {n}
                  </Button>
                ))}
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="2xs" color="fg.subtle">1 = not like me at all</Text>
                <Text fontSize="2xs" color="fg.subtle">7 = very much like me</Text>
              </HStack>
            </Stack>

            <Stack gap="3">
              <Text fontSize="sm" color="fg" fontWeight="semibold">
                Were you surprised by the guess?
              </Text>
              <HStack gap="2">
                {[["Yes", true], ["No", false]].map(([label, val]) => (
                  <Button key={String(label)} size="sm" rounded="lg" fontSize="xs"
                    variant={predSurprised === val ? "solid" : "outline"}
                    bg={predSurprised === val ? accent : "transparent"}
                    color={predSurprised === val ? "white" : "fg.muted"}
                    borderColor={predSurprised === val ? accent : "border.emphasized"}
                    onClick={() => { setPredSurprised(val as boolean); onLogPred("answered_surprised", { value: String(label) }); }}>
                    {label as string}
                  </Button>
                ))}
              </HStack>
            </Stack>

            <Separator />

            {/*
              KEEP OR CHANGE IS OFFERED TO EVERYONE, whether the guess was right or wrong. Offering
              it only after a wrong guess would treat two groups differently in a way they can see,
              and would make the reactivity measure depend on the accuracy it is meant to be read
              against.
            */}
            <Stack gap="2">
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                You can keep your answer, or change it. Both are completely fine.
              </Text>
              <HStack gap="3" wrap="wrap">
                <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg"
                  fontSize="xs" disabled={predSoundsLike === null || predSurprised === null}
                  onClick={() => { onLogPred("kept_answer"); setPredAnswered(true); onKeep(); }}>
                  Keep my answer
                </Button>
                <Button size="sm" variant="outline" color="fg.muted" borderColor="border.emphasized"
                  rounded="lg" fontSize="xs" disabled={predSoundsLike === null || predSurprised === null}
                  onClick={() => { onLogPred("changed_answer"); setPredAnswered(true); onChangeMyMind(); }}>
                  Change my answer
                </Button>
              </HStack>
              {(predSoundsLike === null || predSurprised === null) && (
                <Text fontSize="2xs" color="fg.subtle">Please answer both questions to continue.</Text>
              )}
            </Stack>
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
              {/*
                SCENARIO 6 GOES TO THE GUESS FIRST, and only the FIRST time through. Once the
                participant has answered the guess, confirming again commits straight away: showing
                a second guess would turn one clean before-and-after into an argument.
              */}
              <Button size="sm" bg="green.600" color="white" _hover={{ bg: "green.500" }} rounded="lg"
                onClick={prediction && !predAnswered ? onOpenPrediction : onKeep}
                disabled={!tradeoffAck} fontSize="xs">
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
            onLensShown={onLensShown}
            story={story}
            altStory={altStory}
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
              /* Numbered only when the second lens has added a second question — see QuestionCard. */
              accent={accent} index={altViewGenerated ? 1 : undefined} total={altViewGenerated ? 2 : undefined}
              answered={q1Strong !== null}
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
                accent={accent} index={2} total={2} answered={framingChoiceYes !== null} size="lg"
                /*
                  NO "NOT" IN THE QUESTION (researcher, 18 September 2026). It read "Which one did NOT
                  play a part…", and a question built on a negative is the one most often answered
                  backwards. "Mattered less" asks the same thing: the view picked is still stored as
                  "not_influential" and still takes the −20, exactly as before.
                */
                question={<>You looked at this option from two views. Which one <Text as="span" color={accent} fontWeight="bold">mattered less</Text> in your decision to keep it?</>}
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
                      The <b>{viewLabelFor(f, coord.framing)}</b> mattered less —{" "}
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
            lastLensSeen={lastLensSeen ?? coord.framing}
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
function QuestionCard({ accent, index, total, label, question, answered, size, children }: {
  accent: string;
  /**
   * 1-based position. OMIT IT, ALONG WITH `total`, ON A SCREEN THAT ASKS ONLY ONE THING.
   *
   * The numbered chip and the "Question n of m" eyebrow then disappear entirely and the eyebrow
   * reads just "Question". Counting to one tells the participant nothing, and it used to tell them
   * something wrong: the APA page printed "QUESTION 2 OF 1" for months, because the question kept
   * the position it held when the page asked two and the total had since dropped to one.
   *
   * Pass both only where the count is real — the pages that gain a second question when the
   * participant generates the other reflection lens.
   */
  index?: number;
  total?: number;
  /** Overrides the default "Question n of m" eyebrow. */
  label?: string;
  question: ReactNode;
  /** Drives the tick and the border tint. Omit where the answer is not a required field. */
  answered?: boolean;
  /**
   * "lg" sets the question one step larger. Used by the two lens questions only (researcher, 18
   * September 2026): they ask the participant to compare two boxes of text, and are the hardest
   * questions on either page to read at a glance.
   */
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const numbered = Boolean(index && total);
  const eyebrow = label ?? (numbered ? `Question ${index} of ${total}` : "Question");
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
        {/* The chip is the position, so a card with no position has no chip. It used to fall back
            to a literal "?", which read as a question the interface could not identify. */}
        {numbered && (
          <Center boxSize="6" minW="6" rounded="md" bg={accent} color={onAccentText(accent)}
            fontSize="2xs" fontWeight="bold" lineHeight="1">
            {index}
          </Center>
        )}
        <Text fontSize="2xs" fontWeight="bold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
          {eyebrow}
        </Text>
        {answered && <Icon boxSize="3.5" color="green.fg"><LuCheck /></Icon>}
      </HStack>
      <Box fontSize={size ?? "md"} fontWeight="semibold" color="fg" lineHeight="tall" mb="3">
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

function APAPanel({ option, profile, scenario, accent, coord, stakeholderMoved, onBail, onCommit, onFinalDecisionChange, altViewGenerated, framingFirst, lastLensSeen, mode }: {
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
  /** the lens on screen when they left the vignette — decides whether the table shows. */
  lastLensSeen: CVRFraming;
  /** color mode — light/dark-aware surfaces + highlight colors. */
  mode: "light" | "dark";
}) {
  // Highlight colors for the value-name spans, tuned for the current modal background.
  const marks = cvrMarks(mode);
  const TEAL = marks.v.color as string;     // the participant's leaning value
  const PURPLE = marks.w.color as string;   // the stakeholder

  /*
   * ═════════════════════════════════════════════
   * WHAT THIS PAGE MEASURES THE OPTION AGAINST, AND WHAT IT NO LONGER CLAIMS.
   *
   * GONE (17 September 2026): `served` and `sacrificed` — the option's strongest value and the one
   * it most under-serves — and the sentence built on them, "this option delivers X and gives up Y".
   * That sentence described a two-way trade, and the arithmetic does not have one. An option
   * usually falls short on SEVERAL of the four values at once, and naming exactly one as the
   * casualty made the other shortfalls invisible while asking the participant to defend a swap
   * they never made.
   *
   * HERE INSTEAD: the total distance, and an honest count of how many values it fell short on.
   * ═════════════════════════════════════════════
   */

  /**
   * HOW FAR THIS OPTION LANDED FROM WHAT THEY ASKED FOR, in points.
   *
   * This is `policyAlignmentShortfall` — the UNCENSORED penalty: summed over the four values,
   * (score / 100) × (score − what the option delivers), counting only the values the option falls
   * BELOW. It is the same quantity the alignment score is built from, before that score is clamped
   * into 0–100.
   *
   * THE SHORTFALL IS SHOWN AND THE FIT SCORE IS NOT, on the researcher's instruction. "Missed by
   * 34" is a distance from their own stated values; "matched 66 out of 100" is a grade, with a
   * ceiling to be measured against and a passing mark to be inferred. The project's standing rule
   * is that no participant is shown an alignment verdict while they are still choosing, and a score
   * out of 100 is a verdict wearing a number's clothes. The distance says what this cost them
   * without ranking them.
   *
   * It is deliberately NOT stored from here — `analysis.alignment_records` computes it again from
   * the same function, so the database never depends on what a screen happened to render.
   */
  const shortfallPoints = Math.round(policyAlignmentShortfall(option, profile));

  /**
   * WHICH values it fell short on — every one of them, not the worst one.
   *
   * The same test the shortfall uses: the participant's score for that value is above what the
   * option delivers. Naming all of them is the correction to the old single-trade sentence; there
   * are commonly two or three, and a participant told about one of three was told something true
   * and badly incomplete.
   */
  const shortValues = (() => {
    /*
     * BIGGEST MISS FIRST (researcher, 18 September 2026). Each value is ranked by its own share of
     * the total above — the same term `policyAlignmentShortfall` adds up — so the list reads in the
     * order the points were lost, and the shares sum to the "missed by" number on screen.
     */
    const by = policyShortfallByValue(option, profile);
    return POLICY_DIM_KEYS.filter((k) => by[k] > 0).sort((a, b) => by[b] - by[a]);
  })();

  /**
   * THE MIRROR TABLE'S ROWS, and whether this participant gets to see them.
   *
   * Only for somebody who ended on the CONTEXT lens: the table is the plain statement of the thing
   * that lens leaves unsaid, and it is meaningless — worse, confusing — to anyone who never met
   * the other world. See `lastLensSeen`.
   */
  const mirrorRows = getCVRMirror(scenario);
  const showMirror = lastLensSeen === "context";
  /** Each value's meaning in THIS scenario, shown under its general definition. See `valueHere`. */
  const valueHere = getCVRValueHere(scenario);

  const [stage, setStage] = useState<"questions" | "options" | "confirm">("questions");
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
  const ready = confidence !== null && q3 !== null && (!altViewGenerated || framingInfluential !== null);

  /*
   * NO `apaTotal` ANY MORE. It held "1 question, or 2 when the participant generated the second CVR
   * lens", and fed the "n of m" eyebrow on both cards. The cards now take their own numbers, and
   * take none at all when there is only one question to count — see QuestionCard. `altViewGenerated`
   * is the whole condition, so a second name for it was one more thing to keep in step.
   */
  /**
   * How many are still outstanding. Continue stays disabled until this reaches 0, and a disabled
   * button with no explanation is the classic way to strand someone who scrolled past one card.
   */
  const unanswered =
    (confidence === null || q3 === null ? 1 : 0) +
    (altViewGenerated && framingInfluential === null ? 1 : 0);

  const pending = useMemo(
    () => (q3 !== null
      ? applyApaUpdates(profile, stakeholderMoved === true, q3, framingAdjust, scenario.stakesWeight ?? 1, confidence ?? 3)
      : profile),
    /*
     * `confidence` MUST be listed here even though it is only read inside the call above.
     *
     * It scales how far the profile moves, and this result is not a preview: it is handed to
     * onCommit as `pendingProfile` and becomes the participant's real profile for every later
     * scenario. Without it in this list, the profile kept whatever confidence happened to be set
     * the last time one of the OTHER values changed. A participant who answered the confidence
     * slider last, or who went back and revised it, was scored with the placeholder 3 instead of
     * their own answer - silently, and only sometimes, which is the worst kind of wrong number.
     *
     * `option` IS NO LONGER HERE. The update used to be computed from the misaligned option — it
     * read the option's own strongest value and the value it most under-served. It does not any
     * more: the only thing that moves the profile is the value the participant names. Leaving the
     * option in the list would recompute on a change that cannot alter the answer.
     */
    [q3, confidence, stakeholderMoved, profile, framingAdjust, scenario],
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
                          JUST prioritized, while the tier scores against the profile they brought
                          INTO this scenario (see handleApaCommit) — so the badge could read
                          "Strongly misaligned" directly under a heading saying these options best
                          fit them. The participant has no way to tell the two are measured against
                          different things; it just reads as the software recommending and
                          condemning the same option at once. */}
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
        {stage === "confirm" && section4 && confidence !== null && q3 !== null && (
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
                  confidence, q2Influenced: stakeholderMoved === true, q3Value: q3, originalOptionId: option.id,
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
        <HStack justify="space-between" align="center" gap="3" mb="1">
          <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" fontWeight="bold">Value clarification</Text>
          {/* The same mark the feedback question about this step will carry. See MethodLogo. */}
          <MethodLogo method="apa" />
        </HStack>
        <Text fontSize="sm" color="fg.muted" lineHeight="tall">
          We noticed something worth a closer look — a couple of your choices point in different directions.
          There are <b>no right or wrong answers</b> here; this step just helps the system represent your
          priorities the way you truly mean them.
        </Text>
      </Box>

      {/*
        ══════════════════════════════════════════════════════════════════════════════════════
        WHAT USED TO SIT HERE, AND WHY IT IS GONE (17 September 2026).

        A PARAGRAPH ASSERTING A TWO-WAY TRADE: "This option delivers How much is gained - which you
        rated 100 out of 100. To do that it gives up How many are helped - which you rated 99 out of
        100." It named one value served and one sacrificed. An option usually falls short on SEVERAL
        of the four at once, so that sentence described a trade the participant had not made and
        then asked them to defend it.

        AND A FIRST QUESTION BUILT ON THAT TRADE: "which is closer to the truth - I do put X above Y,
        or I chose it for this situation?" With the trade gone the question has no subject, so it
        went too, along with the profile movement behind it. See applyApaUpdates.

        WHAT REPLACES THEM: the mirror table below, and one number.
        ══════════════════════════════════════════════════════════════════════════════════════
      */}

      {/*
        THE MIRROR TABLE — shown only to participants whose LAST lens was the context one.

        THE COST IT PAYS BACK. The CVR vignette is forbidden from saying "same": it prints the
        second world's numbers and leaves the participant to notice that they match their own. That
        is deliberate, and it has a price - somebody who does not notice gets nothing from the
        context lens at all. This table is where the noticing is finally made free, AFTER the choice
        and the reflection are behind them, so it cannot steer either one.

        NOT SHOWN TO EVERYONE. Whoever ended on the directness lens never met the airport, and a
        table comparing their district to a terminal they have not read would introduce a world
        rather than reveal one.
      */}
      {showMirror && mirrorRows.length > 0 && (
        <Box bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="xl" px="4" py="3.5">
          <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider"
            fontWeight="bold" mb="2.5">
            The two situations you were shown
          </Text>
          <Box overflowX="auto">
            <Box as="table" w="full" style={{ borderCollapse: "collapse" }}>
              <Box as="thead">
                <Box as="tr">
                  <Box as="th" textAlign="left" pb="2" pr="3" borderBottomWidth="1px" borderColor="border">
                    <Text fontSize="2xs" fontWeight="bold" color={accent} textTransform="uppercase" letterSpacing="wider">
                      Where you decided
                    </Text>
                  </Box>
                  <Box as="th" textAlign="left" pb="2" borderBottomWidth="1px" borderColor="border">
                    <Text fontSize="2xs" fontWeight="bold" color={PURPLE} textTransform="uppercase" letterSpacing="wider">
                      The other place
                    </Text>
                  </Box>
                </Box>
              </Box>
              <Box as="tbody">
                {mirrorRows.map((row) => (
                  <Box as="tr" key={row.here}>
                    <Box as="td" verticalAlign="top" py="1.5" pr="4" borderBottomWidth="1px" borderColor="border.subtle">
                      <Text fontSize="xs" color="fg" lineHeight="tall">{renderCVRMarkup(row.here, marks)}</Text>
                    </Box>
                    <Box as="td" verticalAlign="top" py="1.5" borderBottomWidth="1px" borderColor="border.subtle">
                      <Text fontSize="xs" color="fg" lineHeight="tall">{renderCVRMarkup(row.there, marks)}</Text>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/*
        HOW FAR THIS OPTION FELL SHORT — the number, and which values it fell short on, in words.

        IT SHOWS THE SHORTFALL AND NOT THE FIT SCORE, on the researcher's instruction. "Missed by
        34" is a distance; "matched 66 out of 100" is a verdict with a ceiling to be graded
        against, and the project's standing rule is that no participant is shown one of those while
        they are still choosing. The distance answers the question this page is actually asking -
        what did this cost you against what you asked for - without handing them a mark.

        THE VALUES ARE NAMED IN WORDS, not listed with their arithmetic, for the same reason.
      */}
      <Box bg="bg.subtle" borderLeftWidth="3px" borderLeftColor={accent} rounded="lg" px="4" py="3">
        <Text fontSize="sm" color="fg.muted" lineHeight="tall">
          Against what your earlier answers asked for, this option{" "}
          <Text as="span" color="fg" fontWeight="bold">missed by {shortfallPoints} points</Text>
          {shortValues.length === 0 ? (
            <> in total. It met every one of your four values.</>
          ) : (
            <>
              {" "}in total. It fell short on{" "}
              <Text as="span" color="fg" fontWeight="bold">
                {shortValues.length === 1 ? "one" : shortValues.length === 2 ? "two" : shortValues.length === 3 ? "three" : "all four"}
              </Text>{" "}
              of your four values — {shortValues.map((k, i) => (
                <Text as="span" key={k}>
                  {i > 0 && (i === shortValues.length - 1 ? " and " : ", ")}
                  {/* ONE COLOR FOR ALL OF THEM: they are one kind of thing, the participant's own
                      values that this option missed. The first used to be orange and the rest teal,
                      and on the lens pages those two colors mean different things. */}
                  {vSpan(k, TEAL)}
                </Text>
              ))}.
            </>
          )}
        </Text>
      </Box>

      {/*
        THE CONFIDENCE RATING BELONGS TO THIS QUESTION, NOT THE ONE ABOVE.
        It scales how far the value named here moves the profile (see applyApaUpdates), so asking
        it under Question 1 meant the participant was rating their certainty about one thing while
        the number was applied to another. Now the question that uses it is the question that asks
        for it.
      */}
      <QuestionCard
        /* Numbered only when the second lens has added a second question — see QuestionCard. This
           card was hard-coded to 2 from when the page opened with a first question; that question
           was removed on 17 September 2026 and the eyebrow went on saying "Question 2 of 1". */
        accent={accent} index={altViewGenerated ? 1 : undefined} total={altViewGenerated ? 2 : undefined}
        answered={q3 !== null && confidence !== null}
        question="Which one value should the system give the most weight to for you? After you pick it, you'll see the options that fit it."
      >
        <Stack gap="2">
          {POLICY_DIM_KEYS.map((k) => (
            <ApaChoice key={k} selected={q3 === k} accent={accent} onClick={() => setQ3(k)}>
              <b>{VALUE_NAME[k]}</b> — <Text as="span" color="fg.subtle">{VALUE_BENEFIT[k]}</Text>
              {/* A span, not a paragraph: the choice is a <button>, which may hold phrasing content only. */}
              {valueHere && (
                <Text as="span" display="block" fontSize="xs" color="fg.muted" mt="1" lineHeight="1.5">
                  <Text as="span" fontStyle="italic">In this scenario:</Text> {valueHere[k]}
                </Text>
              )}
            </ApaChoice>
          ))}
        </Stack>
        <HStack gap="2" mt="3.5" pt="3" borderTopWidth="1px" borderColor="border.subtle" wrap="wrap">
          {/* It scales the value move only, never the lens answer below (see applyApaUpdates), so it
              asks about the value. It used to say "your answers on this page", which counted both. */}
          <Text fontSize="xs" color="fg.muted" fontWeight="medium">How sure are you about the value you picked?</Text>
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
          accent={accent} index={2} total={2} answered={framingInfluential !== null} size="lg"
          /* "…changed your mind toward not keeping this option" said the same thing twice, awkwardly
             (researcher, 18 September 2026). The view picked is still stored as "influential" and
             still takes the +20. "Views", not "perspectives": the study calls them views everywhere
             else, and keeps "perspective" for the person on the stakeholder page. */
          question={<>You looked at this option from two views. Which one did more to make you <Text as="span" color={PURPLE} fontWeight="bold">drop</Text> this option?</>}
        >
          <Box mb="3"><FramingComparisonTable scenario={scenario} option={option} coord={coord} mode={mode} /></Box>
          {/* Same as the confirm-page question above: ordered and named by position, storing the
              framing. See VIEW_LABEL. */}
          <Stack gap="2">
            {[coord.framing, otherFraming(coord.framing)].map((f) => (
              <ApaChoice key={f} selected={framingInfluential === f} accent={accent}
                onClick={() => setFramingInfluential(f)}>
                The <b>{viewLabelFor(f, coord.framing)}</b> did more —{" "}
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