/**
 * scenarioSelection.ts — Select the seed case and Block-4 scenario context
 *
 * This module answers two questions after Blocks 1–3 are complete:
 *
 * 1. selectSeedCase(profile)
 *    Which single decision from Blocks 1–3 best represents the participant's
 *    most salient pattern? This is shown on the Insights page and used as the
 *    framing anchor for Block 4.
 *
 * 2. selectDomain(profile)
 *    Which domain should Block 4 use? Currently always "ai_workforce_rollout"
 *    (i.e. Block 4 revisits the same context as Block 3).
 *
 * 3. buildScenarioContext(profile, domain)
 *    Which specific (worker group type × group size × gain level) should the
 *    Block-4 scenario use? Personalized to the participant's profile.
 */

import type { MoralProfile } from "./profileAnalysis";
import type { WorkerGroupKey, WorkerGroupSizeKey } from "./aiWorkforceTypes";

/**
 * All available scenario domains. Only "ai_workforce_rollout" is currently
 * active; the others are reserved for future expansion of Block 4.
 */
export type ScenarioDomain =
  | "housing"
  | "healthcare"
  | "labor"
  | "data_privacy"
  | "environment"
  | "finance"
  | "ai_workforce_rollout";

/**
 * Human-readable framing for a scenario domain.
 * `harmFraming` describes how affected people experience the downside.
 * `benefitFraming` describes the upside to the decision-maker's organization.
 * Both are used in Block-4 stakeholder perspective card templates.
 */
export interface DomainDescriptor {
  key: ScenarioDomain;
  label: string;
  harmFraming: string;
  benefitFraming: string;
}

/**
 * Descriptors for all available domains. Only ai_workforce_rollout is
 * shown in Block 4; others are preserved for future use.
 */
export const DOMAINS: Record<ScenarioDomain, DomainDescriptor> = {
  housing: {
    key: "housing",
    label: "housing",
    harmFraming: "being priced out of their neighborhood",
    benefitFraming: "new housing development jobs and tax revenue",
  },
  healthcare: {
    key: "healthcare",
    label: "healthcare access",
    harmFraming: "losing access to an affordable medication",
    benefitFraming: "funding for a new medical research program",
  },
  labor: {
    key: "labor",
    label: "workplace conditions",
    harmFraming: "harder working conditions and lower wages",
    benefitFraming: "preserved jobs and expanded hiring",
  },
  data_privacy: {
    key: "data_privacy",
    label: "data privacy",
    harmFraming: "their personal data being used without full understanding",
    benefitFraming: "a free service that many people rely on",
  },
  environment: {
    key: "environment",
    label: "environmental impact",
    harmFraming: "pollution and reduced air quality in their area",
    benefitFraming: "regional economic growth and affordable energy",
  },
  finance: {
    key: "finance",
    label: "financial products",
    harmFraming: "debt pressure from a high-fee financial product",
    benefitFraming: "access to credit for people otherwise excluded",
  },
  ai_workforce_rollout: {
    key: "ai_workforce_rollout",
    label: "an AI workforce rollout",
    harmFraming:
      "serious job displacement, reduced work opportunities, and financial instability",
    benefitFraming:
      "substantial financial gain for the organization and room for reinvestment",
  },
};

/**
 * A seed case is the single decision from Blocks 1–3 that most clearly
 * represents the participant's dominant moral pattern. It is shown on the
 * Insights page ("based on your pattern of X...") and used to personalize
 * the Block-4 framing.
 *
 * - `source`      — which block and phase the seed comes from
 * - `descriptor`  — a plain-English description of the specific decision pattern
 * - `indexSignal` — the comparable index at the seed threshold (used for display)
 * - `note`        — a short interpretive sentence about what this seed suggests
 */
export interface SeedCase {
  source: "money" | "trolley_lever" | "trolley_bridge" | "ai_workforce";
  descriptor: string;
  indexSignal: number;
  note: string;
}

/**
 * selectSeedCase — chooses the most salient single pattern from Blocks 1–3.
 *
 * Priority order (first matching rule wins):
 * 1. Refused ALL low-buffer products → seed from Block 3 (firm boundary)
 * 2. Refused bridge → seed from Block 2 bridge (strong no-direct-harm rule)
 * 3. Protects vulnerable strongly → seed from Block 1 shelter context
 * 4. Directness aversion ≥ 0.6 AND lever was accepted → seed from Block 2 lever
 * 5. Default → seed from Block 1 sidewalk (baseline found-money pattern)
 */
export function selectSeedCase(profile: MoralProfile): SeedCase {
  const { moneyIndices, trolleyIndices, protectsVulnerableStrongly } = profile;

  if (profile.refusedAllLowBufferRollouts) {
    return {
      source: "ai_workforce",
      descriptor:
        "your pattern of not approving AI workforce rollouts that would seriously displace entry-level workers, across every level of financial gain offered",
      indexSignal: 0,
      note:
        "this tentatively suggests a firm boundary around foreseeable harm to workers with limited alternatives",
    };
  }

  if (profile.refusedBridge) {
    return {
      source: "trolley_bridge",
      descriptor:
        "your decision not to physically push someone off a bridge even to save many lives",
      indexSignal: trolleyIndices.bridge,
      note:
        "this points to a strong reluctance to directly cause harm, even for larger benefits",
    };
  }

  if (protectsVulnerableStrongly) {
    return {
      source: "money",
      descriptor:
        "your higher bar for keeping money found outside a homeless shelter compared to a neutral sidewalk",
      indexSignal: moneyIndices.shelter,
      note:
        "this suggests you weight the context of the people affected, not only the amount",
    };
  }

  if (profile.directnessAversionScore >= 0.6 && !profile.refusedLever) {
    return {
      source: "trolley_lever",
      descriptor:
        "your willingness to redirect the trolley by pulling a lever, while being more hesitant about more direct physical action",
      indexSignal: trolleyIndices.lever,
      note:
        "this suggests directness of action matters to you, not only the outcome",
    };
  }

  return {
    source: "money",
    descriptor:
      "your overall pattern across the found-money scenarios",
    indexSignal: moneyIndices.sidewalk,
    note:
      "this gives a baseline sense of how you weigh small personal gains against ownership and context",
  };
}

/**
 * selectDomain — always returns the AI workforce rollout domain.
 *
 * Block 4 revisits the same context as Block 3 so participants can reflect on
 * a decision type they have already reasoned about numerically. The `_profile`
 * parameter is accepted for future personalization but is currently unused.
 */
export function selectDomain(_profile: MoralProfile): DomainDescriptor {
  return DOMAINS.ai_workforce_rollout;
}

/**
 * The specific scenario parameters used to construct the Block-4 vignette.
 * - `domain`      — always ai_workforce_rollout currently
 * - `groupType`   — which worker group type to foreground (vulnerable if profile suggests it)
 * - `groupSize`   — which group size to use (dominant group size from Block 3, or medium)
 * - `profitLabel` — fixed at "$10 million" (mid-range gain level)
 */
export interface ScenarioContext {
  domain: DomainDescriptor;
  groupType: WorkerGroupKey;
  groupSize: WorkerGroupSizeKey;
  gainLabel: string;
}

/**
 * buildScenarioContext — personalizes the Block-4 scenario parameters from the profile.
 *
 * Group type: "vulnerable" if the participant protects vulnerable workers strongly
 * or has vulnerability sensitivity ≥ 0.5; otherwise "wealthy".
 *
 * Group size: the group size where the vulnerable threshold was highest (most restrictive)
 * in Block 3 — this picks the dimension that seemed to matter most. Falls back to "medium".
 *
 * Gain level: fixed at $10 million (index 2 in GAIN_OPTIONS) — a mid-range value
 * that has appeared in most participants' decision paths.
 */
export function buildScenarioContext(
  profile: MoralProfile,
  domain: DomainDescriptor,
): ScenarioContext {
  const groupType: WorkerGroupKey =
    profile.protectsVulnerableStrongly || profile.vulnerabilitySensitivityScore >= 0.5
      ? "low_buffer"
      : "high_buffer";
  const groupSize: WorkerGroupSizeKey = profile.mostRestrictiveLowBufferSize ?? "medium";
  const gainLabel = "$10 million";
  return { domain, groupType, groupSize, gainLabel };
}
