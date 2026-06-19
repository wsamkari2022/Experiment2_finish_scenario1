/**
 * finalAnalysis.ts — Generate the plain-language final analysis
 *
 * This module synthesises the MoralProfile (from Blocks 1–3) with the
 * Block 4 decision record to produce a FinalAnalysis object. The analysis
 * is shown on FinalMoralAnalysisPage after all four blocks are complete.
 *
 * The output intentionally uses measured, non-diagnostic language. It presents
 * observations and patterns, not verdicts. Every generated text string
 * acknowledges the limitations of abstract scenario-based reasoning.
 */

import type { MoralProfile } from "./profileAnalysis";
import { describeScore } from "./profileAnalysis";

/**
 * A broad classification of the participant's apparent moral reasoning style,
 * derived from the combined pattern across all four blocks.
 * These are labelled "tentative" — they are observations, not diagnoses.
 */
export type TentativeMoralStyle =
  | "more outcome-focused / utilitarian-leaning"
  | "more rule-focused / deontological-leaning"
  | "mixed or context-sensitive"
  | "high reluctance to sacrificial harm"
  | "insufficient data";

/**
 * The three decision snapshots recorded during Block 4, plus the
 * final confidence rating. All decisions are nullable because Block 4
 * has not always been completed when this type is referenced.
 */
export interface Block4DecisionRecord {
  initialDecision: "proceed" | "do_not_proceed" | null;
  midDecision:     "proceed" | "do_not_proceed" | null;
  finalDecision:   "proceed" | "do_not_proceed" | null;
  confidence: number;   // 1–5, where 5 is most confident
}

/**
 * The complete plain-language analysis produced by generateFinalAnalysis.
 * Each field maps to a section of the FinalMoralAnalysisPage.
 */
export interface FinalAnalysis {
  /** Compares initial vs. final Block-4 decision and notes any mid-point shift. */
  alignmentNote: string;

  /** Plain-language description of the cross-domain consistency score. */
  consistencyNote: string;

  /** 1–5 specific observations derived from profile flags and score thresholds. */
  sensitivityNotes: string[];

  /** The single tentative moral style label (priority-ordered classification). */
  tentativeStyle: TentativeMoralStyle;

  /** 2–3 standard disclaimers about interpreting the results. */
  caveats: string[];
}

/**
 * classifyStyle — assigns a tentative moral style label.
 *
 * Priority order (first matching rule wins):
 * 1. "high reluctance to sacrificial harm"   — refused bridge AND harmReluctance ≥ 0.65
 * 2. "more rule-focused / deontological-leaning" — directnessAversion ≥ 0.65 AND protectsVulnerable
 * 3. "more outcome-focused / utilitarian-leaning" — scaleSensitivity ≥ 0.55 AND harmReluctance ≤ 0.45 AND accepted bridge
 * 4. "mixed or context-sensitive"            — Block-4 decision changed OR consistency < 0.4
 *
 * A fourth "mixed" path is the default: if no rule fires, the participant's
 * pattern doesn't fit neatly into any of the three named styles.
 */
export function classifyStyle(
  profile: MoralProfile,
  decisions: Block4DecisionRecord,
): TentativeMoralStyle {
  if (profile.refusedBridge && profile.harmReluctanceScore >= 0.65) {
    return "high reluctance to sacrificial harm";
  }
  if (
    profile.directnessAversionScore >= 0.65 &&
    profile.protectsVulnerableStrongly
  ) {
    return "more rule-focused / deontological-leaning";
  }
  if (
    profile.scaleSensitivityScore >= 0.55 &&
    profile.harmReluctanceScore <= 0.45 &&
    !profile.refusedBridge
  ) {
    return "more outcome-focused / utilitarian-leaning";
  }
  if (
    decisions.initialDecision &&
    decisions.finalDecision &&
    decisions.initialDecision !== decisions.finalDecision
  ) {
    return "mixed or context-sensitive";
  }
  if (profile.consistencyAcrossDomainsScore < 0.4) {
    return "mixed or context-sensitive";
  }
  return "mixed or context-sensitive";
}

/**
 * generateFinalAnalysis — the main entry point for this module.
 *
 * Produces all text fields for the FinalMoralAnalysisPage. The function is
 * pure: given the same inputs it returns the same output.
 */
export function generateFinalAnalysis(
  profile: MoralProfile,
  decisions: Block4DecisionRecord,
): FinalAnalysis {
  const {
    initialDecision,
    midDecision,
    finalDecision,
    confidence,
  } = decisions;

  // ── Alignment note ────────────────────────────────────────────────────────
  // Compares initial Block-4 decision to final, noting any mid-point shift.
  let alignmentNote: string;
  if (!initialDecision || !finalDecision) {
    alignmentNote =
      "There is not quite enough information here to say whether your final view aligned with your initial one.";
  } else if (initialDecision === finalDecision) {
    alignmentNote =
      midDecision && midDecision !== initialDecision
        ? "Your final decision returned to your initial position, after briefly shifting in between. This can suggest that the first perspective moved you, but a second perspective brought you back toward your original view."
        : "Your final decision matched your initial one. That kind of stability can reflect a settled value, though it can also be worth asking whether the perspectives landed with equal weight.";
  } else {
    alignmentNote =
      "Your final decision differed from your initial one. That is not unusual: additional perspectives often reshape how a question feels, and changing your mind in light of new information is not the same as being inconsistent.";
  }

  // ── Consistency note ──────────────────────────────────────────────────────
  const consistencyStrength = describeScore(profile.consistencyAcrossDomainsScore);
  const consistencyNote = `Across the earlier blocks, your sensitivity to vulnerable contexts, harm, and scale appeared ${consistencyStrength}ly consistent. This is only a rough signal, and a small number of items can pull it in either direction.`;

  // ── Sensitivity observations ──────────────────────────────────────────────
  // Up to 5 specific bullets, each triggered by a profile flag or score threshold.
  const sensitivityNotes: string[] = [];
  if (profile.protectsVulnerableStrongly) {
    sensitivityNotes.push(
      "You showed a noticeable bias toward protecting people in vulnerable circumstances, even when the immediate incentives pulled the other way.",
    );
  }
  if (profile.wealthContextPermissivenessScore >= 0.6) {
    sensitivityNotes.push(
      "You appeared somewhat more willing to act in your own interest when the counterparty was wealthy. Many people show this pattern; it may reflect an intuition about relative need.",
    );
  }
  if (profile.refusedBridge) {
    sensitivityNotes.push(
      "You declined to cause direct physical harm even when the numeric outcome would have been better, which often reflects a strong weight on not being the direct cause of harm.",
    );
  }
  if (
    profile.directnessAversionScore >= 0.6 &&
    !profile.refusedBridge &&
    !profile.refusedLever
  ) {
    sensitivityNotes.push(
      "You appeared more open to harm at a distance than to harm caused directly by your own hand, even when the consequences were comparable.",
    );
  }
  if (profile.scaleSensitivityScore >= 0.55) {
    sensitivityNotes.push(
      "Your responses suggested the number of people affected shifted your thresholds noticeably, which is a signal that scale played a role in your reasoning.",
    );
  }
  // Default fallback: no single pattern stood out strongly
  if (sensitivityNotes.length === 0) {
    sensitivityNotes.push(
      "No single pattern stood out strongly across the blocks. This can reflect a context-dependent approach rather than a fixed rule.",
    );
  }

  const tentativeStyle = classifyStyle(profile, decisions);

  // ── Caveats ───────────────────────────────────────────────────────────────
  const caveats: string[] = [
    "These are tentative observations from a short exercise, not a verdict about your character.",
    "People often respond differently to real situations than to abstract scenarios, and your judgment in life may be shaped by factors not captured here.",
  ];
  if (confidence <= 2) {
    caveats.push(
      "You reported low confidence in your final decision, which is itself useful information and does not suggest anything is wrong.",
    );
  }

  return {
    alignmentNote,
    consistencyNote,
    sensitivityNotes,
    tentativeStyle,
    caveats,
  };
}
