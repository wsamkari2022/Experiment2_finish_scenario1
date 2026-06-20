/**
 * thresholdTree.ts — The User Value Profile engine (single source of truth)
 * ════════════════════════════════════════════════════════════════════════════
 * Blocks 1–4 are a PRE-EXPERIMENT value-profiling stage. Their only job is to
 * build one integrated User Value Profile — the seven moral "sensitivities" —
 * that Block 5 (the real experiment) then uses. This module is where that
 * profile is assembled. It is intentionally the ONE place the seven scores are
 * computed, so the maths can be audited and explained in the dissertation.
 *
 * DESIGN (Approved Changes 2, 3, 7, 8) — the multi-block contribution model.
 * Every block contributes, directly or indirectly, and every sensitivity is
 * estimated from the richest available evidence. Each block has a clear "home"
 * sensitivity (so no single block dominates unjustifiably) plus justified
 * secondary signals. The two meaningless duplications the audit flagged
 * (context≡vulnerability, outcome≡group-size) are removed: each sensitivity now
 * draws on a DISTINCT signal.
 *
 *   Sensitivity              Primary signal                     Secondary signal(s)
 *   ───────────────────────  ─────────────────────────────────  ───────────────────────────
 *   Vulnerability protection B3 low- vs high-buffer gain gap     B1 shelter-vs-neutral; B4 moved-by-harmed
 *   Group size               B3 threshold spread across sizes    —
 *   Gain responsiveness      B3 overall gain level (inverted)    B4 moved-by-beneficiary
 *   Outcome aggregation      B2 trolley sacrifice-willingness     —
 *   Directness               B2 bridge-vs-lever gap              —
 *   Context                  B1 spread across the 3 contexts     —
 *   Stakeholder shift        B4 decision change + confidence     B4 reported influence
 *
 *   Block "homes":  B1 → Context, B2 → Directness + Outcome aggregation,
 *                   B3 → Vulnerability + Group size + Gain responsiveness,
 *                   B4 → Stakeholder shift.  (B1 and B4 are no longer near-unused.)
 *
 * All scores are integers 0–100; higher always means "more of that sensitivity". Every
 * sensitivity is on a common 0-BASELINE scale: 0 = the factor did not move the participant at
 * all. The gap-based dimensions (vulnerability, directness) count only the value-relevant
 * direction and are NOT centred at 50 — so a participant who, e.g., treats direct and indirect
 * harm identically scores 0 directness (not 50), and a spread-based dimension like context can
 * legitimately rank above directness. The full rationale + every weight is in userValueModel.md.
 *
 * The tree is displayed on FinalMoralAnalysisPage (RankedThresholdTree.tsx) and
 * converted into the Block5UserProfile by extractBlock5Profile (block5Profile.ts).
 */

import { computeAIWorkforceAnalysis, GAIN_STEPS as AI_GAIN_STEPS } from "./aiWorkforceAnalysis";
import type { AIWorkforceBlockResults } from "./aiWorkforceTypes";
import { MONEY_STEPS, TROLLEY_STEPS, type MoralProfile } from "./profileAnalysis";
import type { Block4DecisionRecord } from "./finalAnalysis";

/** Re-exported for callers that referenced the Block-3 gain-ladder length here. */
export const GAIN_STEPS = AI_GAIN_STEPS;

/** Clamp to [0,1]; NaN → 0. */
function clamp01(v: number): number {
  return Number.isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
}
/** Scale a [0,1] value to an integer 0–100. */
function to100(v: number): number {
  return Math.round(clamp01(v) * 100);
}

/**
 * One piece of evidence for a sensitivity: a normalised [0,1] value, a relative
 * weight, whether it is actually available for this participant, and a label.
 */
interface Signal {
  block: "Block 1" | "Block 2" | "Block 3" | "Block 4";
  label: string;
  value: number;   // normalised 0–1 (higher = stronger sensitivity)
  weight: number;  // relative importance among this sensitivity's signals
  available: boolean;
}

/**
 * Availability-aware weighted mean. Absent signals are EXCLUDED and the weights
 * of the present signals are renormalised — so a missing optional signal never
 * silently drags a score toward zero. If nothing is available we return the
 * neutral midpoint 0.5 (documented behaviour; in practice the primary signals
 * are always present because Blocks 1–3 are mandatory).
 */
function blend(signals: Signal[]): number {
  const active = signals.filter((s) => s.available && Number.isFinite(s.value));
  if (active.length === 0) return 0.5;
  const wsum = active.reduce((a, s) => a + s.weight, 0);
  if (wsum <= 0) return 0.5;
  return active.reduce((a, s) => a + s.weight * clamp01(s.value), 0) / wsum;
}

/** A single sensitivity in the ranked User Value Profile. */
export interface ThresholdTreeDimension {
  key: string;        // internal snake_case key (mapped to a Block5SensitivityKey)
  label: string;
  score: number;      // 0–100
  rank: number;       // 1 = strongest
  rationale: string;  // one plain-English sentence
  derivation: string; // formula with the participant's real values substituted
  /** The signals that fed this score, for transparency/CVR-cube display. */
  contributions: { block: string; label: string; value: number; weight: number }[];
}

/** The complete ranked User Value Profile. */
export interface ThresholdTree {
  dimensions: ThresholdTreeDimension[];
  overallSensitivityIndex: number;
  primaryDriver: ThresholdTreeDimension | null;
  secondaryDriver: ThresholdTreeDimension | null;
}

/**
 * Rank-proportional weight used for the overall composite index.
 *   weight(rank) = (N + 1 − rank) / (N(N+1)/2)
 * The strongest sensitivity gets the largest share, decreasing linearly; the N
 * weights sum to exactly 1.0 by construction. Derived from the dimension count —
 * no magic numbers. (block5Profile.ts mirrors this for profile metadata.)
 */
export function rankWeight(rank: number, dimensionCount: number): number {
  const triangular = (dimensionCount * (dimensionCount + 1)) / 2;
  return (dimensionCount + 1 - rank) / triangular;
}

/** Human-readable intensity band for a 0–100 score. */
export function describeLevel(score: number): "strong" | "moderate" | "mild" | "low" {
  if (score >= 75) return "strong";
  if (score >= 55) return "moderate";
  if (score >= 35) return "mild";
  return "low";
}

function pct(v: number): string {
  return (clamp01(v) * 100).toFixed(0) + "%";
}

/**
 * buildThresholdTree — assemble the seven sensitivities from all four blocks.
 *
 * Inputs:
 *  - profile   : the interim Blocks-1–3 snapshot (provides Block-1 money indices
 *                and Block-2 trolley indices, already normalised once upstream).
 *  - aiResults : raw Block-3 results; Block-3 quantities are derived ONCE via
 *                computeAIWorkforceAnalysis (single source of truth). null → the
 *                three B3-primary signals fall back to neutral and are flagged.
 *  - block4    : the (possibly enriched) Block-4 decision record.
 */
export function buildThresholdTree(
  profile: MoralProfile,
  aiResults: AIWorkforceBlockResults | null,
  block4: Block4DecisionRecord,
): ThresholdTree {
  // ── BLOCK 1 (Money) signals ───────────────────────────────────────────────
  const { sidewalk, wealthy, shelter } = profile.moneyIndices;
  const ctxIdx = [sidewalk, wealthy, shelter];
  // Context sensitivity = how much the keep-threshold moved across the 3 contexts.
  const contextSpread = (Math.max(...ctxIdx) - Math.min(...ctxIdx)) / MONEY_STEPS;
  // Vulnerability (B1 facet) — the participant's need-sensitivity from Block 1 (0-baseline):
  //  • PRIMARY: more reluctant to keep money outside a shelter than on a neutral sidewalk.
  //  • Idea A (light, ×0.20): keeps money more readily from a WEALTHY owner than a neutral one
  //    (sidewalk − wealthy) — a small supporting facet of need-sensitivity, from already-collected data.
  //  • Idea B (light, ×0.20): chose to DONATE the money (esp. near the shelter) — a small
  //    prosocial-toward-the-vulnerable signal (profile.block1DonationSignal). Return/Leave map to
  //    no sensitivity and are kept for descriptive analysis only.
  // Additive-and-capped: the two light signals only REINFORCE the shelter base (never dilute it),
  // and each adds at most 0.20 × 0.30 ≈ 6% to total vulnerability. BOTH are routed into Vulnerability
  // (NOT Context), so context sensitivity is not inflated and the context↔directness balance is kept.
  const shelterContrast = Math.max(0, shelter - sidewalk) / MONEY_STEPS;
  const wealthyPermissiveness = Math.max(0, sidewalk - wealthy) / MONEY_STEPS; // Idea A
  const vulnB1 = clamp01(
    shelterContrast + 0.2 * wealthyPermissiveness + 0.2 * profile.block1DonationSignal, // + Idea B
  );

  // ── BLOCK 2 (Trolley) signals ─────────────────────────────────────────────
  const leverIdx = profile.trolleyIndices.lever;
  const bridgeIdx = profile.trolleyIndices.bridge;
  // Directness = how much MORE justification you needed for the DIRECT act (push) than the
  // indirect one (pull). 0-baseline: a participant who treats them identically (bridge == lever)
  // has NO directness sensitivity → 0 (not 0.5). Only aversion (bridge > lever) counts. This
  // keeps directness on the same "0 = no sensitivity" footing as context / group-size, so it is
  // not structurally inflated above them (fixes the previous centred-at-0.5 artifact).
  const directnessB2 = Math.max(0, bridgeIdx - leverIdx) / TROLLEY_STEPS;
  // Outcome aggregation = willingness to act for FEWER saved lives (low threshold)
  // = trades a small harm for a net-positive aggregate. The canonical utilitarian test.
  const avgTrolley = (leverIdx + bridgeIdx) / 2;
  const aggregationB2 = 1 - avgTrolley / TROLLEY_STEPS;

  // ── BLOCK 3 (AI-Workforce) signals — ONE source of truth ──────────────────
  const ai = aiResults ? computeAIWorkforceAnalysis(aiResults) : null;
  const aiAvailable = ai !== null;
  const avgLB = ai ? ai.avgLowBufferIndex : GAIN_STEPS / 2;
  const avgHB = ai ? ai.avgHighBufferIndex : GAIN_STEPS / 2;
  const avgSpread = ai ? (ai.lowBufferSpread + ai.highBufferSpread) / 2 : 0;
  const overallGain = (avgLB + avgHB) / 2;
  // Vulnerability (B3 facet) = demanded MORE gain before harming low-buffer than high-buffer
  // workers → protective of the more vulnerable group. 0-baseline: treating both groups equally
  // = 0 sensitivity (not 0.5). Only the protective direction (LB needs more) counts.
  const vulnB3 = Math.max(0, avgLB - avgHB) / GAIN_STEPS;
  // Group size = how much the threshold shifted as the harmed group grew.
  const groupSizeB3 = avgSpread / GAIN_STEPS;
  // Gain responsiveness = approved at LOW gain overall → readily moved by gain.
  const gainB3 = 1 - overallGain / GAIN_STEPS;

  // ── BLOCK 4 (Stakeholder reflection) signals ──────────────────────────────
  const { initialDecision, midDecision, finalDecision, confidence } = block4;
  const hasDecisions = !!(initialDecision && finalDecision);
  // Decision movement: a full flip (final ≠ initial) = 1.0; a wobble that
  // returned (mid differed, final same) = 0.5; no movement = 0.
  let decisionShift = 0;
  if (hasDecisions && initialDecision !== finalDecision) decisionShift = 1;
  else if (initialDecision && midDecision && midDecision !== initialDecision) decisionShift = 0.5;
  // Confidence movement (engagement): any shift in confidence after hearing the
  // stakeholders shows the perspectives registered. Normalised over the 1–5 range.
  const hasInitialConf = typeof block4.initialConfidence === "number";
  const confidenceMovement = hasInitialConf
    ? Math.abs((confidence ?? 3) - (block4.initialConfidence as number)) / 4
    : 0;
  // Reported influence: the participant named a perspective as most influential.
  const reportedInfluence = block4.reportedInfluence === true ? 1 : 0;

  // B4 secondary signals (only when the influential voice's valence is recorded).
  const hasValence =
    block4.reportedInfluence === true &&
    (block4.influentialValence === "harmed" || block4.influentialValence === "benefited");
  // Moved-by-harmed → vulnerability: influential voice is the harmed party AND the
  // final decision protected them (do_not_proceed). Heard-but-not-protected = 0.3.
  const b4Vuln =
    hasValence && block4.influentialValence === "harmed"
      ? finalDecision === "do_not_proceed"
        ? 1
        : 0.3
      : 0;
  // Moved-by-beneficiary → gain responsiveness: influential voice is the
  // beneficiary AND the final decision proceeded (captured the gain). Else 0.3.
  const b4Gain =
    hasValence && block4.influentialValence === "benefited"
      ? finalDecision === "proceed"
        ? 1
        : 0.3
      : 0;
  const b4VulnAvailable = hasValence && block4.influentialValence === "harmed";
  const b4GainAvailable = hasValence && block4.influentialValence === "benefited";

  // ── Assemble each sensitivity from its signals ────────────────────────────
  // Weights encode EVIDENCE STRENGTH, not preference: a rich direct measure
  // (a 2×3 gain matrix) outweighs a single contextual contrast, which outweighs
  // a soft reflective signal. The tiers (≈0.55 / 0.30 / 0.15) are documented.

  const vulnSignals: Signal[] = [
    { block: "Block 3", label: "Low- vs high-buffer gain gap", value: vulnB3, weight: 0.55, available: true },
    { block: "Block 1", label: "Need-sensitivity (shelter, wealthy-leniency, donations)", value: vulnB1, weight: 0.30, available: true },
    { block: "Block 4", label: "Moved by the harmed stakeholder", value: b4Vuln, weight: 0.15, available: b4VulnAvailable },
  ];
  const gainSignals: Signal[] = [
    { block: "Block 3", label: "Overall gain level required (inverted)", value: gainB3, weight: 0.8, available: true },
    { block: "Block 4", label: "Moved by the benefiting stakeholder", value: b4Gain, weight: 0.2, available: b4GainAvailable },
  ];
  const stakeholderSignals: Signal[] = [
    { block: "Block 4", label: "Decision changed after stakeholders", value: decisionShift, weight: 0.5, available: hasDecisions },
    { block: "Block 4", label: "Confidence shifted", value: confidenceMovement, weight: 0.3, available: hasInitialConf },
    { block: "Block 4", label: "Named an influential perspective", value: reportedInfluence, weight: 0.2, available: block4.reportedInfluence !== undefined },
  ];

  const vulnerability = blend(vulnSignals);
  const groupSize = clamp01(groupSizeB3);
  const gain = blend(gainSignals);
  const outcome = clamp01(aggregationB2);
  const directness = clamp01(directnessB2);
  const context = clamp01(contextSpread);
  const stakeholder = blend(stakeholderSignals);

  const single = (block: Signal["block"], label: string, value: number): Signal[] => [
    { block, label, value, weight: 1, available: true },
  ];

  // ── Build the seven dimensions (key matches block5Profile KEY_MAP) ────────
  const raw: Omit<ThresholdTreeDimension, "rank">[] = [
    {
      key: "vulnerability_protection",
      label: "Vulnerability protection sensitivity",
      score: to100(vulnerability),
      rationale:
        "How strongly you protect the worse-off — drawn mainly from demanding more gain before harming low-buffer workers (Block 3), reinforced by your Block-1 need-sensitivity (shelter reluctance, plus light support from leniency toward a wealthy owner and any donations).",
      derivation:
        `blend(  B3 buffer-gap ${pct(vulnB3)} ×0.55,  B1 need-signal ${pct(vulnB1)} ×0.30` +
        (b4VulnAvailable ? `,  B4 moved-by-harmed ${pct(b4Vuln)} ×0.15 ) = ${to100(vulnerability)}/100` : ` ) = ${to100(vulnerability)}/100  (B4 signal absent → excluded)`),
      contributions: vulnSignals.filter((s) => s.available).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "group_size",
      label: "Group-size sensitivity",
      score: to100(groupSize),
      rationale:
        "How much your approval threshold moved as the harmed group grew from ~10 to ~100,000 workers (Block 3). The one-directional (carry-forward) design means this captures how much MORE gain you demanded for larger groups.",
      derivation: `avg threshold spread ${avgSpread.toFixed(2)} / ${GAIN_STEPS} steps = ${to100(groupSize)}/100` + (aiAvailable ? "" : "  (Block 3 data missing → neutral)"),
      contributions: single("Block 3", "Threshold spread across group sizes", groupSizeB3).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "gain_responsiveness",
      label: "Gain responsiveness",
      score: to100(gain),
      rationale:
        "How readily financial gain moved you toward approving harm — mainly the overall gain level you required across Block 3.",
      derivation:
        `blend(  B3 gain-level ${pct(gainB3)} ×0.8` +
        (b4GainAvailable ? `,  B4 moved-by-beneficiary ${pct(b4Gain)} ×0.2 ) = ${to100(gain)}/100` : ` ) = ${to100(gain)}/100  (B4 signal absent → excluded)`),
      contributions: gainSignals.filter((s) => s.available).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "outcome_aggregation",
      label: "Outcome-aggregation sensitivity",
      score: to100(outcome),
      rationale:
        "How much you weigh the total/aggregate outcome — measured by your willingness in Block 2 to act for fewer saved lives (trading a small harm for a net-positive result).",
      derivation: `1 − avg(lever ${leverIdx}, bridge ${bridgeIdx}) / ${TROLLEY_STEPS} = ${to100(outcome)}/100`,
      contributions: single("Block 2", "Trolley sacrifice-willingness", aggregationB2).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "directness",
      label: "Directness sensitivity",
      score: to100(directness),
      rationale:
        "How much being the DIRECT cause of harm matters — needing more lives at stake to push someone (direct) than to pull a lever (indirect) in Block 2.",
      derivation: `max(0, bridge ${bridgeIdx} − lever ${leverIdx}) / ${TROLLEY_STEPS} = ${to100(directness)}/100   (0 = no direct-vs-indirect distinction)`,
      contributions: single("Block 2", "Bridge-vs-lever gap", directnessB2).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "context",
      label: "Context sensitivity",
      score: to100(context),
      rationale:
        "How much surrounding circumstances reshape your choice — measured by how far your keep-threshold moved across the neutral, wealthy, and shelter contexts in Block 1.",
      derivation: `(max−min of [sidewalk ${sidewalk}, wealthy ${wealthy}, shelter ${shelter}]) / ${MONEY_STEPS} = ${to100(context)}/100`,
      contributions: single("Block 1", "Spread across the three contexts", contextSpread).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
    {
      key: "stakeholder_shift",
      label: "Stakeholder perspective-shift sensitivity",
      score: to100(stakeholder),
      rationale:
        "How much hearing a named person's perspective moves you — combining whether your Block-4 decision changed, how your confidence shifted, and whether you named an influential voice.",
      derivation:
        `blend(  decision-shift ${pct(decisionShift)} ×0.5` +
        (hasInitialConf ? `,  confidence-move ${pct(confidenceMovement)} ×0.3` : "") +
        (block4.reportedInfluence !== undefined ? `,  influence ${pct(reportedInfluence)} ×0.2` : "") +
        ` ) = ${to100(stakeholder)}/100`,
      contributions: stakeholderSignals.filter((s) => s.available).map((s) => ({ block: s.block, label: s.label, value: s.value, weight: s.weight })),
    },
  ];

  // ── Sort, rank, composite ─────────────────────────────────────────────────
  const sorted = [...raw]
    .sort((a, b) => b.score - a.score)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  const n = sorted.length;
  const overall = sorted.reduce((sum, d) => sum + rankWeight(d.rank, n) * d.score, 0);

  return {
    dimensions: sorted,
    overallSensitivityIndex: Math.round(overall),
    primaryDriver: sorted[0] ?? null,
    secondaryDriver: sorted[1] ?? null,
  };
}
