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
 *  - Each option carries 5 PERFORMANCE metrics describing what it achieves (see METRIC_DEFS).
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

/**
 * ============================================================================
 * PERFORMANCE METRICS — what an OPTION achieves, never what the participant values.
 * ============================================================================
 *
 * WHY THESE FIVE AND NOT THE PREVIOUS EIGHT
 * -----------------------------------------
 * The original eight were authored as a mirror of the option fingerprints. Measured across the
 * 30 authored options, "Vulnerable Protection" correlated r = 0.98 with the participant's
 * vulnerability-protection VALUE, "Total Benefit" r = 0.80 with outcome aggregation, and
 * "Fairness / Equity" r = 0.80 with vulnerability again. They were not a second view of the
 * option; they were the same numbers under a second heading, and overall performance therefore
 * correlated r = 0.81 with the participant's own profile. Choosing your values was free.
 *
 * THE RULE THAT REPLACES THEM
 * ---------------------------
 *   The four VALUES ask *who* and *how much*.
 *   The METRICS ask *how well it went*.
 *
 * Two axes that cannot collapse into each other, because no metric names a group of people or a
 * quantity of good. That is what makes "did this participant trade moral alignment against
 * practical performance?" a real question rather than a tautology.
 *
 * WHY FIVE, NOT SIX
 * -----------------
 * A sixth, "Practicality" (effort to carry the option out), was authored and then dropped. Two
 * reasons, both fatal:
 *   1. It correlated r = 0.71 with Speed even after honest re-coding — fast options are usually
 *      also easy ones, so it was not carrying its own information.
 *   2. Its referent changed between scenarios. In travel and dinner it means effort on YOU; in
 *      the cancer, flood and water scenarios you are a decision-maker, not the executor, so it
 *      means effort on some organisation. That is two constructs sharing a label — exactly the
 *      cross-scenario ambiguity the readings below exist to prevent.
 * The five that remain keep the same referent in all five scenarios.
 *
 * HIGHER IS ALWAYS BETTER, on every metric. "Resource use 85" means it uses LITTLE.
 *
 * SCORES ARE RELATIVE TO THE SITUATION, NOT ABSOLUTE
 * --------------------------------------------------
 * A score answers: among the six options available in THIS scenario, how well does this one do
 * on this construct? "Speed 90" in the cancer scenario does not claim treatment is as fast as a
 * flight; it claims this option starts treatment about as soon as anything could there. That is
 * what makes averaging across scenarios legitimate, and it is the same rule the Blocks 1-3
 * ladders already follow — only position within the instrument ever carries meaning.
 * Anchors: 90-100 best this situation allows / 70-85 clearly good / 50-65 middling /
 * 30-45 clearly poor / 10-25 the worst this situation allows.
 *
 * See docs/BLOCK5_METRIC_REDESIGN_PLAN.md for the full rationale and the acceptance gates,
 * and tools/validate_block5_metrics.mjs for the gates as executable checks.
 */
export type Block5MetricKey =
  | "speed"
  | "resourceUse"
  | "reliability"
  | "durability"
  | "reversibility";

export const METRIC_KEYS: Block5MetricKey[] = [
  "speed",
  "resourceUse",
  "reliability",
  "durability",
  "reversibility",
];

/** Scenario ids, used to pick the right reading for a metric. */
export type Block5ScenarioId =
  | "travel_mode_choice"
  | "meal_hosting_choice"
  | "cancer_treatment_allocation"
  | "flood_evacuation_priority"
  | "water_contamination_response";

/**
 * One metric: a constant label, the construct it measures, and what that construct looks like in
 * each scenario.
 *
 * `readings` is the answer to "'Speed' in a travel scenario is not 'Speed' in a cancer
 * scenario". The CONSTRUCT is identical everywhere — latency of benefit delivery, input
 * consumed, outcome uncertainty, persistence, recoverability. Only the surface changes, and the
 * participant is shown the surface for the scenario they are actually in, so they are never left
 * guessing what a bar means here.
 */
export interface MetricDef {
  key: Block5MetricKey;
  /** Constant across scenarios — this is what makes the dashboard comparable. */
  label: string;
  /** The construct. Governs authoring; never shown to the participant. */
  invariant: string;
  /** Fallback wording when no scenario is in context. */
  hover: string;
  /** What this construct means in each scenario. Shown to the participant. */
  readings: Record<Block5ScenarioId, string>;
}

export const METRIC_DEFS: Record<Block5MetricKey, MetricDef> = {
  speed: {
    key: "speed",
    label: "Speed",
    invariant: "Latency of benefit delivery — how soon the help reaches the people it is for.",
    hover: "How soon the help actually reaches the people it is meant to help.",
    readings: {
      travel_mode_choice: "how soon you arrive, and how much of your own time comes back",
      meal_hosting_choice: "how soon everyone is actually eating",
      cancer_treatment_allocation: "how soon treatment begins for those who receive it",
      flood_evacuation_priority: "how soon people are out of danger",
      water_contamination_response: "how soon safe water is back",
    },
  },
  resourceUse: {
    key: "resourceUse",
    label: "Resource use",
    invariant: "How little of the limited supply the option consumes. Higher means leaner.",
    hover: "How little of the limited supply this uses — higher means leaner.",
    readings: {
      travel_mode_choice: "how little money and fuel it spends per person",
      meal_hosting_choice: "how little of the $80 and the two hours it uses",
      cancer_treatment_allocation: "how little of the 20 doses and staff time it wastes",
      flood_evacuation_priority: "how few boats, crews and fuel-hours it ties up",
      water_contamination_response: "how little budget and crew time it consumes",
    },
  },
  reliability: {
    key: "reliability",
    label: "Reliability",
    invariant: "Probability the intended outcome actually happens.",
    hover: "How likely this is to work as intended rather than go wrong.",
    readings: {
      travel_mode_choice: "how likely you are to arrive without delay or a missed connection",
      meal_hosting_choice: "how likely the meal works and everyone can eat it",
      cancer_treatment_allocation: "how likely the treatment achieves what is hoped",
      flood_evacuation_priority: "how likely the plan really gets people out",
      water_contamination_response: "how likely the fix really clears the contamination",
    },
  },
  durability: {
    key: "durability",
    label: "Durability",
    invariant: "Whether the benefit persists past the immediate moment.",
    hover: "Whether the benefit lasts beyond the immediate moment.",
    readings: {
      travel_mode_choice: "whether the route survives for the people who will need it next",
      meal_hosting_choice: "leftovers, and whether it is something you could repeat",
      cancer_treatment_allocation: "how long the benefit lasts, not just the first weeks",
      flood_evacuation_priority: "whether it builds lasting resilience or only works this once",
      water_contamination_response: "a permanent repair rather than a temporary supply",
    },
  },
  reversibility: {
    key: "reversibility",
    label: "Reversibility",
    invariant: "Recoverability — how easily course can be changed if the choice proves wrong.",
    hover: "If this turns out to be wrong, how easily you can change course.",
    readings: {
      travel_mode_choice: "whether you can rebook or change your plans",
      meal_hosting_choice: "whether you can order something else if it fails",
      cancer_treatment_allocation: "whether doses can be reallocated, or the decision is final",
      flood_evacuation_priority: "whether you can redirect resources mid-operation",
      water_contamination_response: "whether you can switch approach without wasting the work",
    },
  },
};

/** Constant labels, for places that only need the name. */
export const METRIC_LABELS: Record<Block5MetricKey, string> = Object.fromEntries(
  METRIC_KEYS.map((k) => [k, METRIC_DEFS[k].label]),
) as Record<Block5MetricKey, string>;

/**
 * Scenario-aware definition line for a metric.
 *
 * Falls back to the scenario-independent wording when the scenario is unknown, so this can never
 * render an empty string.
 */
export function metricMeaning(key: Block5MetricKey, scenarioId?: string): string {
  const def = METRIC_DEFS[key];
  const reading = scenarioId ? def.readings[scenarioId as Block5ScenarioId] : undefined;
  return reading ?? def.hover;
}

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
  /**
   * The five performance metrics for this option. REQUIRED, deliberately: the previous
   * optional field let a scenario fall back to deriveMetrics(), which copied the fingerprint
   * into the metrics and is exactly how the duplication got in. See METRIC_DEFS above.
   */
  metrics: Block5MetricProfile;
  /**
   * v4 — the TRADE-OFF block shown prominently on every option card. Participants were
   * overlooking a single muted `consequence` line, so the gain and the cost are now separate,
   * colour-coded fields rendered before the choice is made.
   */
  /** What the participant clearly WINS by choosing this. One short sentence. */
  gains?: string;
  /** v3: one-line "what it gives / what it gives up" shown on every selection. */
  consequence?: string;
  /** What the participant clearly LOSES — the other half of the trade-off. */
  givesUp?: string;
  /** The moral question the option raises, shown under the trade-off block. */
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
  /**
   * How much this scenario's decisions are allowed to teach the profile, 0–1 (default 1).
   *
   * Every profile update the scenario can produce is multiplied by this weight, so the strength
   * of the evidence scales with what is actually at stake. The everyday scenarios (travel, food)
   * use 0.5: a participant's dinner choice is real evidence about their moral priorities, but it
   * should not move the profile as far as a decision about who receives a scarce cancer dose.
   * Applied in block5CVR.ts by applyValueBump / applyEndorsementUpdates / applyApaUpdates.
   */
  stakesWeight?: number;
}

/** ---- CVR Cube ---- */
export type CVRFraming = "context" | "directness";

/**
 * A pending one-off adjustment to a reflection-lens sensitivity (Directness or Context),
 * produced by the dual-perspective question and applied only when the participant confirms.
 *  - YES path: −20 to the lens that did NOT influence keeping the option.
 *  - NO  path: +20 to the lens that DID change their mind to reject it.
 */
export interface FramingAdjust {
  sensitivityKey: "directnessSensitivity" | "contextSensitivity";
  delta: number;
}
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
  compareChartsOpens: number; // opened the two-radar "compare all options" charts
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
  /** the chosen option's 5 metrics, stored so the cumulative dashboard/summary don't re-look-up. */
  metrics?: Block5MetricProfile;
  /** APA clarification, when the scenario was resolved through the APA flow. */
  apa?: APARecord;
  /** the exact stakeholder voice text shown in the CVR vignette this scenario (for analysis). */
  cvrStakeholderShown?: string;
  /** behavioral telemetry for this scenario (visits, switches, dwell) — does not affect scoring. */
  telemetry?: Block5ScenarioTelemetry;
  /**
   * The participant's 4 policy-value scores (0–100) AFTER this scenario's profile update.
   * Captured so the results view can plot how each value evolved across the journey
   * (Before Block 5 → after S1 → after S2 → after S3). Additive; does not affect scoring.
   */
  policySnapshotAfter?: Record<Block5PolicyDimKey, number>;

  /* ---- CVR dual-perspective (Directness ↔ Context) — see block5CVR + CVRReveal ----
   * All optional and only populated when the participant engaged the dual-perspective feature.
   * If the alternate view is never generated, these stay undefined and behaviour is unchanged. */

  /** Which reflection lens was shown FIRST (the larger of Directness/Context at the time). */
  cvrFramingShownFirst?: CVRFraming;
  /** True only if the participant generated the OTHER lens (gate for all dual-perspective logic). */
  cvrAltViewGenerated?: boolean;
  /** The lens generated SECOND (the opposite of the first), if any. */
  cvrFramingShownSecond?: CVRFraming;
  /** The lens the participant SELECTED in the dual-perspective question. */
  cvrFramingSelected?: CVRFraming;
  /**
   * What the selection meant:
   *  - "not_influential" → YES path: the lens that did NOT influence keeping the option (→ −20)
   *  - "influential"     → NO path: the lens that DID change their mind to reject it (→ +20)
   */
  cvrFramingSelectedRole?: "not_influential" | "influential";
  /** The committed sensitivity change for the selected lens (e.g. {key:"contextSensitivity", delta:-20}). */
  cvrFramingAdjustment?: FramingAdjust;

  /**
   * Snapshot of the two reflection-lens sensitivities (0–100) AFTER this scenario's update,
   * so the results view can chart how Directness vs Context evolved across the scenarios.
   */
  framingSnapshotAfter?: { directnessSensitivity: number; contextSensitivity: number };
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
