/**
 * block5Types.ts — Type definitions for Block 5: Public Emergency Simulation.
 *
 * Block 5 uses the participant's 7-dimension moral sensitivity profile (derived
 * from Blocks 1–4) to evaluate policy options in emergency scenarios.
 *
 * v3 (CVR Cube) additions — see the Scenario 1 Master Spec:
 *  - Alignment is now a 4-LEVEL label (aligned / weakly / misaligned / strongly),
 *    computed from only the 4 POLICY-FIT dimensions. Options are NEVER removed.
 *  - The 3 presentation dimensions (context, directness, stakeholder) drive the
 *    CVR vignette (framing + who appears), not the ranking.
 *  - Each option carries 8 generic PERFORMANCE metrics (separate from alignment).
 *  - Endorsing a misaligned choice updates the profile (carried to later scenarios).
 *  - Two measures: graded VCI (current profile) + Stability (original profile).
 */

export type Block5SensitivityKey =
  | "directnessSensitivity"
  | "vulnerabilityProtectionSensitivity"
  | "groupSizeSensitivity"
  | "contextSensitivity"
  | "gainResponsivenessSensitivity"
  | "stakeholderPerspectiveShiftSensitivity"
  | "outcomeAggregationSensitivity";

/** The 4 dimensions used to measure POLICY FIT (alignment). Subset of the 7. */
export type Block5PolicyDimKey =
  | "vulnerabilityProtectionSensitivity"
  | "groupSizeSensitivity"
  | "gainResponsivenessSensitivity"
  | "outcomeAggregationSensitivity";

export const POLICY_DIM_KEYS: Block5PolicyDimKey[] = [
  "vulnerabilityProtectionSensitivity",
  "groupSizeSensitivity",
  "gainResponsivenessSensitivity",
  "outcomeAggregationSensitivity",
];

export const POLICY_DIM_SHORT: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "protecting the vulnerable",
  groupSizeSensitivity: "helping the larger group",
  gainResponsivenessSensitivity: "getting the most benefit",
  outcomeAggregationSensitivity: "maximizing the total",
};

/** Plain-English hover explanation of each policy value (shown in the sidebar tooltip). */
export const POLICY_DIM_EXPLAIN: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity:
    "How much you prioritize the people who are worst-off or least able to cope — protecting them first, even when others might gain more.",
  groupSizeSensitivity:
    "How much you favor helping as many people as possible — reaching the largest number, rather than concentrating help on a few.",
  gainResponsivenessSensitivity:
    "How much you favor putting each scarce resource where it does the most good — the biggest improvement for what is given.",
  outcomeAggregationSensitivity:
    "How much you focus on the largest total benefit added up across everyone — maximizing the overall sum.",
};

/** 4-level alignment label (internal — options are never hidden). */
export type AlignmentLevel =
  | "aligned"
  | "weakly_aligned"
  | "misaligned"
  | "strongly_misaligned";

/**
 * Rank-based label rule (v3.3): labels are assigned by an option's RANK within the scenario,
 * not by absolute score cutoffs — this guarantees a spread for any profile. The top `aligned`
 * options become Aligned, the next `weaklyAligned` become Weakly aligned, then the better half
 * of the remaining options become Misaligned and the worse half Strongly misaligned. For 6
 * options this yields a balanced 1 Aligned / 1 Weakly / 2 Misaligned / 2 Strongly. CVR fires on
 * Misaligned / Strongly. Tune the shape here (e.g. aligned: 2) — no per-run band tuning needed.
 */
export const ALIGNMENT_RANK_RULE = { aligned: 1, weaklyAligned: 1 } as const;

/** 8 generic performance metrics, work across any scenario. */
export type Block5MetricKey =
  | "totalBenefit"
  | "harmReduction"
  | "fairnessEquity"
  | "vulnerableProtection"
  | "resourceEfficiency"
  | "feasibility"
  | "longTermImpact"
  | "predictability";

export const METRIC_KEYS: Block5MetricKey[] = [
  "totalBenefit",
  "harmReduction",
  "fairnessEquity",
  "vulnerableProtection",
  "resourceEfficiency",
  "feasibility",
  "longTermImpact",
  "predictability",
];

export const METRIC_LABELS: Record<Block5MetricKey, string> = {
  totalBenefit: "Total Benefit",
  harmReduction: "Harm Reduction",
  fairnessEquity: "Fairness / Equity",
  vulnerableProtection: "Vulnerable Protection",
  resourceEfficiency: "Resource Efficiency",
  feasibility: "Feasibility",
  longTermImpact: "Long-term Impact",
  predictability: "Predictability",
};

/** Short, plain-English hover text for each metric (line 1 of the tooltip). */
export const METRIC_HOVER: Record<Block5MetricKey, string> = {
  totalBenefit: "How much overall good this choice produces.",
  harmReduction: "How well this choice avoids or limits harm.",
  fairnessEquity: "How evenly the benefits and harms are shared.",
  vulnerableProtection: "How well this choice protects the weakest people.",
  resourceEfficiency: "How well it uses limited resources, with little waste.",
  feasibility: "How realistic and easy it is to carry out.",
  longTermImpact: "How much good it does beyond the immediate moment.",
  predictability: "How sure we are the plan works as intended (higher = safer).",
};

export type Block5MetricProfile = Record<Block5MetricKey, number>;

export interface Block5UserProfileDimension {
  key: Block5SensitivityKey;
  label: string;
  score: number;
  rank: number;
  weight: number;
  sourceBlocks: string[];
}

export interface Block5UserProfile {
  generatedAt: string;
  dimensions: Block5UserProfileDimension[];
  topThreeKeys: Block5SensitivityKey[];
  topSensitivityKey: Block5SensitivityKey;
}

export type Block5OptionFingerprint = Record<Block5SensitivityKey, number>;

/**
 * v3.2: per-option "CVR seed" — the concrete material the CVR vignette re-presents.
 * The recontextualized scenario keeps the SAME trade-off (the option's rule against the
 * shared fact base), and the stakeholder vignette names a concrete, identified case + harm.
 */
export interface OptionCVRSeed {
  /** what the option does to the shared pool, phrased to follow "it …" (e.g. "gives them to the highest-odds patients"). */
  rule: string;
  /** the concrete, identified person/group the option leaves out (AHA, gender-neutral). */
  identifiedCase: string;
  /** the concrete harm that case experiences. */
  harm: string;
}

export interface Block5ScenarioOption {
  id: string;
  title: string;
  summary: string;
  fingerprint: Block5OptionFingerprint;
  /** v3: the 8 performance metrics for this option (separate from alignment). */
  metrics?: Block5MetricProfile;
  /** v3: one-line "what it gives / what it gives up" shown on every selection. */
  consequence?: string;
  /** v3: longer card fields (optional). */
  givesUp?: string;
  moralTension?: string;
  /** v3.2: concrete material for the CVR vignette (see OptionCVRSeed). */
  cvrSeed?: OptionCVRSeed;
  // populated by ranking/labeling:
  fitScore?: number;
  candidate?: boolean;
  rank?: number;
  topMatchReasons?: string[];
  tensionPoints?: string[];
}

export interface Block5ScenarioTheme {
  gradient: string;
  accent: string;
  shadow: string;
}

export interface Block5Scenario {
  id: string;
  title: string;
  description: string;
  theme: Block5ScenarioTheme;
  options: Block5ScenarioOption[];
  /** v3.2: the shared, fixed "world" (same numbers for every option) that the CVR re-presents. */
  factBase?: string;
}

/** ---- CVR Cube ---- */
export type CVRFraming = "context" | "directness";
/** Who appears in the vignette (derived from stakeholder sensitivity, inverse map). */
export type SalienceWho = "close" | "group" | "system";

export interface CVRCoordinate {
  violatedKey: Block5PolicyDimKey;
  framing: CVRFraming;
  who: SalienceWho;
}

export interface CVRStory {
  coordinateKey: string;
  /** the recontextualized scenario: same trade-off + numbers, re-framed (with {markup}). */
  recontext: string;
  /** the AHA-style stakeholder vignette: who appears + identified case + harm (with {markup}). */
  stakeholder: string;
  /** the re-endorsement question (with {markup}). */
  reendorseQuestion: string;
}

/** One randomly-chosen stakeholder "voice" for a CVR vignette (picked per misaligned selection). */
export interface WhoVariant {
  /** the full vignette lead sentence shown to the participant (wrapped in {w|…}). */
  lead: string;
  /** the short subject reused in the matching Q2 stakeholder question (e.g. "your mother", "the nurse"). */
  label: string;
}

/** What the participant answered on the CVR endorsement + follow-ups. */
export type CVREndorsement = "strong" | "weak" | "no" | "n/a";

/** What the participant clarified in APA (recorded for analysis; committed only on a final decision). */
export interface APARecord {
  q1: "endorse" | "context" | "unsure";
  confidence: number;               // 1–5
  stakeholderInfluenced: boolean;
  prioritizedValue: Block5PolicyDimKey;
  originalOptionId: string;         // the misaligned option that triggered APA
}

/** ---- Behavioral telemetry (additive; does NOT affect scoring) ---- */

/** How a scenario's CVR step ended (final committed path). */
export type CVROutcome =
  | "endorsed-strong"
  | "endorsed-weak"
  | "went-to-APA"
  | "exited"
  | "none";

/** How a scenario's APA step ended (final committed path). */
export type APAOutcome = "committed" | "exited" | "none";

/**
 * Per-scenario behavioral telemetry, captured inside the Block-5 component from the handlers
 * it already has (select, preview, expand, CVR yes/no/back, APA open/back/confirm). These are
 * pure observation counters + timestamps — they never change the decision logic or scoring.
 */
export interface Block5ScenarioTelemetry {
  cvrTriggered: boolean;     // the chosen path showed a CVR vignette at least once
  apaTriggered: boolean;     // the APA panel opened at least once
  cvrVisits: number;         // times the CVR vignette was shown (incl. re-entries)
  apaVisits: number;         // times the APA panel opened
  cvrOutcome: CVROutcome;
  apaOutcome: APAOutcome;
  /** = optionChanges + cvrBackouts + apaBackouts + finalDecisionChanges (clean "how much did they waver"). */
  numberOfSwitches: number;
  initialSelections: number; // distinct options opened into the decision view
  optionChanges: number;     // went back and chose a DIFFERENT option
  cvrBackouts: number;       // left the CVR vignette via "change my mind"
  apaBackouts: number;       // left APA via "take me back to all options"
  finalDecisionChanges: number; // picked an APA final option, then changed it before committing
  timeToFirstSelectionMs: number | null; // deliberation before the first pick
  previewImpactOpens: number; // used "Preview impact"
  optionExpands: number;     // expanded an option card to read details
  cvrDwellMs: number;        // time reflecting inside the CVR vignette
  apaDwellMs: number;        // time reflecting inside the APA flow
}

/** ---- Results ---- */
export interface Block5ScenarioResult {
  scenarioId: string;
  selectedOptionId: string;
  selectedRank: number;
  topRankedOptionId: string;
  selectedWasTopCandidate: boolean;
  selectedWasCandidate: boolean;
  rankedOptionIds: string[];
  fitScoresByOptionId: Record<string, number>;
  candidateStatusByOptionId: Record<string, boolean>;
  viewedExplanationOptionIds: string[];
  timeMs: number;

  // v3 additions:
  alignmentLevel?: AlignmentLevel;
  matchScore?: number;
  firstChoiceOptionId?: string;
  postCVRChoiceOptionId?: string;
  cvrFired?: boolean;
  cvrEndorsement?: CVREndorsement;
  cvrCoordinate?: CVRCoordinate;
  stakeholderGuided?: boolean | null;
  /** alignment of the FINAL choice vs the ORIGINAL pre-Block-5 profile (for Stability). */
  alignedToOriginal?: boolean;
  /** per-scenario VCI contribution S_i (0–1). */
  vciScore?: number;
  performanceScore?: number;
  /** the chosen option's 8 metrics, stored so the cumulative dashboard/summary don't re-look-up. */
  metrics?: Block5MetricProfile;
  /** APA clarification, when the scenario was resolved through the APA flow. */
  apa?: APARecord;
  /** the exact stakeholder voice text shown in the CVR vignette this scenario (for analysis). */
  cvrStakeholderShown?: string;
  /** behavioral telemetry for this scenario (visits, switches, dwell) — does not affect scoring. */
  telemetry?: Block5ScenarioTelemetry;
}

export interface Block5Results {
  completed: boolean;
  completedAt: string;
  userProfile: Block5UserProfile;
  originalProfile?: Block5UserProfile;
  scenarioResults: Block5ScenarioResult[];
  vci?: number;
  vciLevel?: string;
  stability?: number;
  stabilityLevel?: string;
  performance?: number;
  /** behavioral telemetry totals across all scenarios (additive; does not affect scoring). */
  totalCvrVisits?: number;
  totalApaVisits?: number;
  totalSwitches?: number;
}

export const BLOCK5_PROGRESS_KEY = "block5_public_emergency_progress";
export const BLOCK5_RESULTS_KEY = "block5_public_emergency_results";
