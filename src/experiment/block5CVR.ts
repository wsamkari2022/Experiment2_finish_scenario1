/**
 * block5CVR.ts — The CVR Cube engine for Block 5 (v3 spec).
 *
 * Pure functions only (no UI). Implements:
 *  - policy-fit match score + 4-level alignment label (bands 85/75/55), NO option removal
 *  - the CVR Cube coordinate: violated value + framing (context/directness) + who appears
 *  - profile score updates on endorsement (+30/+15 & −20/−10), stakeholder ±25,
 *    weakly-aligned +10 (all clamped 0–100; the caller commits only on Confirm)
 *  - graded + reflective VCI, and the Stability Score
 *  - performance score from the 8 generic metrics (separate from alignment)
 */

import {
  POLICY_DIM_KEYS,
  ALIGNMENT_RANK_RULE,
  METRIC_KEYS,
} from "./block5Types";
import type {
  AlignmentLevel,
  Block5MetricProfile,
  Block5PolicyDimKey,
  Block5ScenarioOption,
  Block5ScenarioResult,
  Block5UserProfile,
  CVRCoordinate,
  CVREndorsement,
  CVRFraming,
  SalienceWho,
} from "./block5Types";

const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

function scoreOf(profile: Block5UserProfile, key: string): number {
  return profile.dimensions.find((d) => d.key === key)?.score ?? 50;
}

/* ---------------- Alignment (policy fit) ---------------- */

/**
 * Threshold-satisfaction alignment (v3.1). Each participant score is a THRESHOLD
 * (a floor). An option is penalized ONLY when it falls BELOW that threshold; meeting
 * or exceeding it costs nothing. Each shortfall is weighted by how much the
 * participant cares about that value (their own score), so missing an important value
 * hurts more than missing one they barely care about.
 *
 *   alignment = 100 − Σ (user/100) × max(0, user − option)
 */
export function policyAlignmentScore(option: Block5ScenarioOption, profile: Block5UserProfile): number {
  let penalty = 0;
  for (const k of POLICY_DIM_KEYS) {
    const u = scoreOf(profile, k);
    const o = option.fingerprint[k];
    const shortfall = Math.max(0, u - o); // only falling BELOW the threshold counts
    penalty += (u / 100) * shortfall;
  }
  return Math.round(clamp(100 - penalty));
}

/**
 * Rank-based label (v3.3): an option's position in the scenario ranking decides its level,
 * which guarantees a spread for any profile. For 6 options with the default rule this gives
 * 1 Aligned / 1 Weakly / 2 Misaligned / 2 Strongly.
 */
export function rankLabel(index: number, total: number): AlignmentLevel {
  const a = ALIGNMENT_RANK_RULE.aligned;
  const w = ALIGNMENT_RANK_RULE.weaklyAligned;
  if (index < a) return "aligned";
  if (index < a + w) return "weakly_aligned";
  const remaining = Math.max(0, total - a - w);
  const posInRest = index - a - w;
  const misalignedCount = Math.ceil(remaining / 2);
  return posInRest < misalignedCount ? "misaligned" : "strongly_misaligned";
}

export function isMisaligned(level: AlignmentLevel): boolean {
  return level === "misaligned" || level === "strongly_misaligned";
}

export const ALIGNMENT_LABEL: Record<AlignmentLevel, string> = {
  aligned: "Aligned",
  weakly_aligned: "Weakly aligned",
  misaligned: "Misaligned",
  strongly_misaligned: "Strongly misaligned",
};

export interface LabeledOption extends Block5ScenarioOption {
  matchScore: number;
  level: AlignmentLevel;
  performance: number;
  rank: number;
}

/** Label every option (never removes any). Sorted by match score for display only. */
export function labelOptions(
  options: Block5ScenarioOption[],
  profile: Block5UserProfile,
): LabeledOption[] {
  const labeled: LabeledOption[] = options.map((o) => ({
    ...o,
    matchScore: policyAlignmentScore(o, profile),
    level: "misaligned" as AlignmentLevel,
    performance: performanceScore(o),
    rank: 0,
  }));
  // Rank by absolute fit (stable tie-break by id), then label by RANK POSITION (guaranteed spread).
  labeled.sort((a, b) => (b.matchScore - a.matchScore) || a.id.localeCompare(b.id));
  labeled.forEach((o, i) => { o.rank = i + 1; o.level = rankLabel(i, labeled.length); });
  return labeled;
}

/* ---------------- CVR Cube coordinate ---------------- */

/** The option's "main value" = its single highest of the 4 policy dims. */
export function optionMainValue(option: Block5ScenarioOption): Block5PolicyDimKey {
  let best: Block5PolicyDimKey = POLICY_DIM_KEYS[0];
  let bestV = -1;
  for (const k of POLICY_DIM_KEYS) {
    const v = option.fingerprint[k];
    if (v > bestV) { bestV = v; best = k; }
  }
  return best;
}

/** The value with the largest IMPORTANCE-WEIGHTED shortfall (the value the option most under-served). */
export function violatedValue(option: Block5ScenarioOption, profile: Block5UserProfile): Block5PolicyDimKey {
  let best: Block5PolicyDimKey = POLICY_DIM_KEYS[0];
  let bestPenalty = -1;
  for (const k of POLICY_DIM_KEYS) {
    const u = scoreOf(profile, k);
    const penalty = (u / 100) * Math.max(0, u - option.fingerprint[k]);
    if (penalty > bestPenalty) { bestPenalty = penalty; best = k; }
  }
  if (bestPenalty <= 0) {
    // No shortfall (rare when misaligned) — fall back to the most important value.
    return [...POLICY_DIM_KEYS].sort((a, b) => scoreOf(profile, b) - scoreOf(profile, a))[0];
  }
  return best;
}

/** Framing = the participant's bigger of context vs directness sensitivity. */
export function chooseFraming(profile: Block5UserProfile): CVRFraming {
  return scoreOf(profile, "contextSensitivity") >= scoreOf(profile, "directnessSensitivity")
    ? "context"
    : "directness";
}

/** Who appears = INVERSE map of stakeholder sensitivity (low→close, high→system). */
export function chooseWho(profile: Block5UserProfile): SalienceWho {
  const s = scoreOf(profile, "stakeholderPerspectiveShiftSensitivity");
  if (s < 40) return "close";
  if (s < 70) return "group";
  return "system";
}

export function cvrCoordinate(option: Block5ScenarioOption, profile: Block5UserProfile): CVRCoordinate {
  return {
    violatedKey: violatedValue(option, profile),
    framing: chooseFraming(profile),
    who: chooseWho(profile),
  };
}

/* ---------------- Profile updates (pending until the caller commits) ---------------- */

function cloneProfile(p: Block5UserProfile): Block5UserProfile {
  return { ...p, dimensions: p.dimensions.map((d) => ({ ...d })) };
}

function bump(p: Block5UserProfile, key: string, delta: number): void {
  const dim = p.dimensions.find((d) => d.key === key);
  if (dim) dim.score = clamp(dim.score + delta);
}

function recompute(p: Block5UserProfile): void {
  const byScore = [...p.dimensions].sort((a, b) => b.score - a.score);
  byScore.forEach((d, i) => { d.rank = i + 1; d.weight = (8 - d.rank) / 28; });
  const byRank = [...p.dimensions].sort((a, b) => a.rank - b.rank);
  p.topThreeKeys = byRank.slice(0, 3).map((d) => d.key);
  p.topSensitivityKey = byRank[0]?.key ?? p.topSensitivityKey;
}

function displacedTopValue(p: Block5UserProfile, option: Block5ScenarioOption): Block5PolicyDimKey | null {
  const sorted = [...POLICY_DIM_KEYS].sort((a, b) => scoreOf(p, b) - scoreOf(p, a));
  for (const k of sorted) {
    if (option.fingerprint[k] < scoreOf(p, k) - 5) return k;
  }
  return sorted[0] ?? null;
}

/** Misaligned + YES: endorsed value +30/+15, displaced #1 value −20/−10, stakeholder ±25. */
export function applyEndorsementUpdates(
  profile: Block5UserProfile,
  option: Block5ScenarioOption,
  q1Strong: boolean,
  q2Guided: boolean,
): Block5UserProfile {
  const p = cloneProfile(profile);
  const endorsed = optionMainValue(option);
  const displaced = displacedTopValue(p, option);
  bump(p, endorsed, q1Strong ? 30 : 15);
  if (displaced && displaced !== endorsed) bump(p, displaced, q1Strong ? -20 : -10);
  bump(p, "stakeholderPerspectiveShiftSensitivity", q2Guided ? 25 : -25);
  recompute(p);
  return p;
}

/**
 * APA clarification updates (pending until the participant commits a final choice inside APA).
 * Q1 endorse: option value +15, the value it went against −10. Q1 context: +5 / +10.
 * Q1 unsure: no value change. Q2 stakeholder ±25. Q3 forced prioritization: +10 (stacks with Q1).
 */
export function applyApaUpdates(
  profile: Block5UserProfile,
  misalignedOption: Block5ScenarioOption,
  q1: "endorse" | "context" | "unsure",
  stakeholderInfluenced: boolean,
  prioritizedValue: Block5PolicyDimKey,
): Block5UserProfile {
  const p = cloneProfile(profile);
  const optionValue = optionMainValue(misalignedOption);
  const topValue = violatedValue(misalignedOption, profile);
  if (q1 === "endorse") {
    bump(p, optionValue, 15);
    if (topValue !== optionValue) bump(p, topValue, -10);
  } else if (q1 === "context") {
    bump(p, optionValue, 5);
    if (topValue !== optionValue) bump(p, topValue, 10);
  }
  bump(p, "stakeholderPerspectiveShiftSensitivity", stakeholderInfluenced ? 25 : -25);
  bump(p, prioritizedValue, 10);
  recompute(p);
  return p;
}

/** Keeping an aligned/weakly-aligned option reinforces its main value by `points` (clamped 0–100). */
export function applyValueBump(
  profile: Block5UserProfile,
  option: Block5ScenarioOption,
  points: number,
): Block5UserProfile {
  const p = cloneProfile(profile);
  bump(p, optionMainValue(option), points);
  recompute(p);
  return p;
}

/* ---------------- Performance metrics ---------------- */

export function optionMetrics(option: Block5ScenarioOption): Block5MetricProfile {
  return option.metrics ?? deriveMetrics(option);
}

export function performanceScore(option: Block5ScenarioOption): number {
  const m = optionMetrics(option);
  const sum = METRIC_KEYS.reduce((a, k) => a + (m[k] ?? 0), 0);
  return Math.round(sum / METRIC_KEYS.length);
}

/** Placeholder metric derivation for scenarios whose metrics aren't authored yet (S2/S3). */
function deriveMetrics(option: Block5ScenarioOption): Block5MetricProfile {
  const fp = option.fingerprint;
  return {
    totalBenefit: fp.outcomeAggregationSensitivity,
    harmReduction: Math.round((fp.vulnerabilityProtectionSensitivity + fp.directnessSensitivity) / 2),
    fairnessEquity: Math.round((fp.vulnerabilityProtectionSensitivity + fp.stakeholderPerspectiveShiftSensitivity) / 2),
    vulnerableProtection: fp.vulnerabilityProtectionSensitivity,
    resourceEfficiency: fp.gainResponsivenessSensitivity,
    feasibility: clamp(Math.round((fp.directnessSensitivity + (100 - fp.contextSensitivity)) / 2)),
    longTermImpact: fp.contextSensitivity,
    predictability: Math.round((fp.directnessSensitivity + fp.gainResponsivenessSensitivity) / 2),
  };
}

/* ---------------- Measures: graded VCI + Stability ---------------- */

const BASE_CREDIT: Record<AlignmentLevel, number> = {
  aligned: 1.0,
  weakly_aligned: 0.75,
  misaligned: 0.35,
  strongly_misaligned: 0.0,
};

function reflectiveCredit(e: CVREndorsement): number {
  if (e === "strong") return 0.9;
  if (e === "weak") return 0.6;
  return 0;
}

/** Per-scenario VCI contribution S_i = max(base credit, reflective credit). */
export function scenarioVciScore(level: AlignmentLevel, endorsement: CVREndorsement): number {
  return Math.max(BASE_CREDIT[level], reflectiveCredit(endorsement));
}

export function consistencyLevel(value0to100: number): string {
  if (value0to100 >= 85) return "Highly consistent";
  if (value0to100 >= 70) return "Consistent";
  if (value0to100 >= 50) return "Moderately consistent";
  if (value0to100 >= 30) return "Low consistency";
  return "Very low consistency";
}

export function computeVCI(results: Block5ScenarioResult[]): { value: number; level: string } {
  if (results.length === 0) return { value: 0, level: "—" };
  const sum = results.reduce((a, r) => a + (r.vciScore ?? 0), 0);
  const value = Math.round((sum / results.length) * 100);
  return { value, level: consistencyLevel(value) };
}

export function computeStability(results: Block5ScenarioResult[]): { value: number; level: string } {
  if (results.length === 0) return { value: 0, level: "—" };
  const aligned = results.filter((r) => r.alignedToOriginal).length;
  const value = Math.round((aligned / results.length) * 100);
  return { value, level: consistencyLevel(value) };
}

export function averagePerformance(results: Block5ScenarioResult[]): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((a, r) => a + (r.performanceScore ?? 0), 0);
  return Math.round(sum / results.length);
}

/* ---------------- Cumulative / projected performance (top dashboard) ---------------- */

/** A zeroed metric profile (the participant's performance at the very start of Block 5). */
export const EMPTY_METRICS: Block5MetricProfile = METRIC_KEYS.reduce(
  (acc, k) => { acc[k] = 0; return acc; },
  {} as Block5MetricProfile,
);

function averageMetricProfiles(list: Block5MetricProfile[]): Block5MetricProfile {
  if (list.length === 0) return { ...EMPTY_METRICS };
  const out: Block5MetricProfile = { ...EMPTY_METRICS };
  for (const m of list) for (const k of METRIC_KEYS) out[k] += m[k] ?? 0;
  for (const k of METRIC_KEYS) out[k] = Math.round(out[k] / list.length);
  return out;
}

/** Running-average performance across the scenarios confirmed so far (0 when none). */
export function cumulativeMetrics(results: Block5ScenarioResult[]): Block5MetricProfile {
  const list = results.map((r) => r.metrics).filter((m): m is Block5MetricProfile => !!m);
  return averageMetricProfiles(list);
}

/** What the running average would become if one more option's metrics were added. */
export function projectedMetrics(
  results: Block5ScenarioResult[],
  optionMetricsProfile: Block5MetricProfile,
): Block5MetricProfile {
  const list = results.map((r) => r.metrics).filter((m): m is Block5MetricProfile => !!m);
  list.push(optionMetricsProfile);
  return averageMetricProfiles(list);
}

/** Overall 0–100 score for a metric profile (mean of the 8 metrics). */
export function metricProfileScore(m: Block5MetricProfile): number {
  const sum = METRIC_KEYS.reduce((a, k) => a + (m[k] ?? 0), 0);
  return Math.round(sum / METRIC_KEYS.length);
}
