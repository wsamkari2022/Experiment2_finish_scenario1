import type { AIWorkforceAnalysis } from "./aiWorkforceAnalysis";
import type { MoralProfile } from "./profileAnalysis";
import type { ScenarioContext } from "./scenarioSelection";

export type Block4ScenarioDomain =
  | "ai_shift_scheduling_policy"
  | "ai_promotion_screening_policy"
  | "ai_retraining_allocation_policy"
  | "ai_performance_monitoring_policy";

export interface Block4ScenarioTemplate {
  key: Block4ScenarioDomain;
  title: string;
  body: string;
}

export const BLOCK4_SCENARIOS: Record<Block4ScenarioDomain, Block4ScenarioTemplate> = {
  ai_shift_scheduling_policy: {
    key: "ai_shift_scheduling_policy",
    title: "AI Shift Scheduling Policy",
    body: "You are the final decision-maker on whether to approve a new AI shift-scheduling policy in your organization. Approving it would improve efficiency and create about [GAIN] in organizational value, but it may produce unstable schedules, loss of hours, and financial strain for [GROUP_TYPE] across a [GROUP_SIZE]. Would you approve the policy?",
  },
  ai_promotion_screening_policy: {
    key: "ai_promotion_screening_policy",
    title: "AI Promotion Screening Policy",
    body: "You are the final decision-maker on whether to approve a new AI promotion-screening policy in your organization. Approving it would improve efficiency and create about [GAIN] in organizational value, but it may unfairly deprioritize [GROUP_TYPE] across a [GROUP_SIZE], reducing advancement opportunities. Would you approve the policy?",
  },
  ai_retraining_allocation_policy: {
    key: "ai_retraining_allocation_policy",
    title: "AI Retraining Allocation Policy",
    body: "You are the final decision-maker on whether to approve a new AI policy for allocating retraining opportunities in your organization. Approving it would improve efficiency and create about [GAIN] in organizational value, but it may leave [GROUP_TYPE] across a [GROUP_SIZE] with fewer opportunities to transition into safer or more stable roles. Would you approve the policy?",
  },
  ai_performance_monitoring_policy: {
    key: "ai_performance_monitoring_policy",
    title: "AI Performance Monitoring Policy",
    body: "You are the final decision-maker on whether to approve a new AI performance-monitoring policy in your organization. Approving it would improve efficiency and create about [GAIN] in organizational value, but it may increase pressure, reduce autonomy, and create job insecurity for [GROUP_TYPE] across a [GROUP_SIZE]. Would you approve the policy?",
  },
};

export function renderBlock4Scenario(
  domain: Block4ScenarioDomain,
  ctx: ScenarioContext,
): string {
  const template = BLOCK4_SCENARIOS[domain];
  const groupLabel =
    ctx.groupType === "low_buffer"
      ? "low-buffer workers with limited alternatives"
      : "high-buffer workers with stronger alternatives";
  const sizeLabel =
    ctx.groupSize === "small"
      ? "a small group of about 10 workers"
      : ctx.groupSize === "medium"
        ? "a medium group of about 1,000 workers"
        : "a large group of about 100,000 workers";
  return template.body
    .replace("[GAIN]", ctx.gainLabel)
    .replace("[GROUP_TYPE]", groupLabel)
    .replace("[GROUP_SIZE]", sizeLabel);
}

export type VignetteDirection = "toward_rejection" | "toward_acceptance";

export interface StakeholderPerspectiveCard {
  id: string;
  title: string;
  direction: VignetteDirection;
  roleCategory: string;
  scenarioDomains: Block4ScenarioDomain[];
  applicableGroupTypes: Array<"low_buffer" | "high_buffer" | "any">;
  applicableGroupSizes: Array<"small" | "medium" | "large" | "any">;
  template: string;
}

export const STAKEHOLDER_PERSPECTIVES: StakeholderPerspectiveCard[] = [
  // ─── HARM-SIDE (toward_rejection) ─────────────────────────────────
  {
    id: "harm_family_of_worker_schedule_1",
    title: "Family member of an affected worker",
    direction: "toward_rejection",
    roleCategory: "affected_family",
    scenarioDomains: ["ai_shift_scheduling_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A family member of an affected worker may worry that unstable scheduling creates problems far beyond the workplace, including childcare disruptions, transportation problems, and constant financial uncertainty at home.",
  },
  {
    id: "harm_worker_losing_hours_1",
    title: "Worker losing hours",
    direction: "toward_rejection",
    roleCategory: "affected_individual",
    scenarioDomains: ["ai_shift_scheduling_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A worker affected by the policy may experience reduced hours as a direct loss of income, even if the policy improves efficiency for the organization overall.",
  },
  {
    id: "harm_household_dependency_1",
    title: "Household depending on worker income",
    direction: "toward_rejection",
    roleCategory: "affected_family",
    scenarioDomains: ["ai_shift_scheduling_policy", "ai_performance_monitoring_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A household that depends on the worker's income may experience the consequences as missed bills, reduced stability, and heightened stress rather than as a neutral policy adjustment.",
  },
  {
    id: "harm_worker_overlooked_promotion_1",
    title: "Worker overlooked for advancement",
    direction: "toward_rejection",
    roleCategory: "affected_individual",
    scenarioDomains: ["ai_promotion_screening_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A worker affected by the promotion-screening policy may lose advancement opportunities despite being qualified, weakening long-term career growth rather than only a single decision.",
  },
  {
    id: "harm_employee_mentor_1",
    title: "Mentor of an affected employee",
    direction: "toward_rejection",
    roleCategory: "community_role",
    scenarioDomains: ["ai_promotion_screening_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A mentor or supervisor who knows the employee's abilities may view the policy as unfair if it quietly deprioritizes strong candidates who have fewer institutional advantages.",
  },
  {
    id: "harm_denied_retraining_1",
    title: "Worker denied retraining access",
    direction: "toward_rejection",
    roleCategory: "affected_individual",
    scenarioDomains: ["ai_retraining_allocation_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A worker excluded from retraining may experience the policy not only as a missed opportunity, but as the loss of a practical path into safer or more stable work.",
  },
  {
    id: "harm_older_worker_fewer_options_1",
    title: "Worker with fewer alternatives",
    direction: "toward_rejection",
    roleCategory: "affected_individual",
    scenarioDomains: ["ai_retraining_allocation_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A worker with fewer realistic options for starting over may be affected much more severely than someone with stronger savings, broader networks, or easier mobility.",
  },
  {
    id: "harm_constant_monitoring_1",
    title: "Employee under monitoring pressure",
    direction: "toward_rejection",
    roleCategory: "affected_individual",
    scenarioDomains: ["ai_performance_monitoring_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "An employee affected by the monitoring policy may experience constant evaluation as pressure, reduced autonomy, and growing insecurity rather than as neutral productivity support.",
  },
  {
    id: "harm_team_climate_1",
    title: "Team leader concerned about morale",
    direction: "toward_rejection",
    roleCategory: "community_role",
    scenarioDomains: ["ai_performance_monitoring_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A team leader may worry that the policy changes the culture of work by making people feel watched, less trusted, and more disposable.",
  },
  {
    id: "harm_worker_representative_1",
    title: "Worker representative",
    direction: "toward_rejection",
    roleCategory: "community_role",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A worker representative may argue that the people carrying the burden of the policy are not the same people who directly benefit from the efficiency gains.",
  },
  {
    id: "harm_another_decision_maker_1",
    title: "Another decision-maker in the organization",
    direction: "toward_rejection",
    roleCategory: "decision_responsibility",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "Another decision-maker in your organization might ask whether the organizational gain is worth approving a policy that predictably destabilizes the lives of workers who have less room to absorb harm.",
  },
  {
    id: "harm_public_interest_view_1",
    title: "Community advocate",
    direction: "toward_rejection",
    roleCategory: "community_role",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A community advocate may point out that when many workers with limited buffers are affected at once, the harm no longer remains individual; it becomes a wider social and economic burden.",
  },
  {
    id: "harm_small_group_vivid_1",
    title: "Small group, serious burden",
    direction: "toward_rejection",
    roleCategory: "affected_individual",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["small"],
    template:
      "Even when the affected group is small, each worker in that group may experience the consequences as a serious disruption to daily life rather than a minor statistical effect.",
  },
  {
    id: "harm_medium_group_repeated_1",
    title: "Repeated burden across many workers",
    direction: "toward_rejection",
    roleCategory: "community_role",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["medium"],
    template:
      "A medium-sized affected group may look manageable on paper, but the same burden would be repeated across many separate workers and households.",
  },
  {
    id: "harm_large_group_structural_1",
    title: "Structural workforce impact",
    direction: "toward_rejection",
    roleCategory: "community_role",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["large"],
    template:
      "When the affected group is very large, the issue is no longer only about individual workers; it becomes a structural workforce decision with broader consequences.",
  },

  // ─── BENEFIT-SIDE (toward_acceptance) ─────────────────────────────
  {
    id: "benefit_executive_survival_1",
    title: "Executive responsible for long-term viability",
    direction: "toward_acceptance",
    roleCategory: "company_role",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "An executive responsible for the long-term viability of the organization may argue that approving the policy protects operations, strengthens financial stability, and preserves room for future action.",
  },
  {
    id: "benefit_operations_manager_1",
    title: "Operations manager",
    direction: "toward_acceptance",
    roleCategory: "company_role",
    scenarioDomains: ["ai_shift_scheduling_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "An operations manager may argue that more effective scheduling reduces coverage gaps and helps the organization function more reliably.",
  },
  {
    id: "benefit_service_reliability_1",
    title: "Service continuity perspective",
    direction: "toward_acceptance",
    roleCategory: "future_benefit",
    scenarioDomains: ["ai_shift_scheduling_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A service continuity perspective may emphasize that rejecting the policy may preserve one kind of protection while also allowing avoidable instability elsewhere in the organization.",
  },
  {
    id: "benefit_hr_consistency_1",
    title: "HR leader seeking consistency",
    direction: "toward_acceptance",
    roleCategory: "institutional_role",
    scenarioDomains: ["ai_promotion_screening_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "An HR leader may argue that a structured screening policy can reduce backlog and create more consistent promotion review when the organization faces large case volumes.",
  },
  {
    id: "benefit_org_fairness_standardization_1",
    title: "Standardization perspective",
    direction: "toward_acceptance",
    roleCategory: "institutional_role",
    scenarioDomains: ["ai_promotion_screening_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A standardization perspective may argue that a structured policy can reduce arbitrary variation, even if it does not perfectly resolve all fairness concerns.",
  },
  {
    id: "benefit_training_budget_1",
    title: "Retraining budget manager",
    direction: "toward_acceptance",
    roleCategory: "company_role",
    scenarioDomains: ["ai_retraining_allocation_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A manager responsible for limited retraining resources may argue that the policy helps allocate scarce support more efficiently across the organization.",
  },
  {
    id: "benefit_future_transition_capacity_1",
    title: "Future transition planning",
    direction: "toward_acceptance",
    roleCategory: "future_benefit",
    scenarioDomains: ["ai_retraining_allocation_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A future-planning perspective may argue that the gains from the policy could make broader retraining or transition support possible later, even if the current allocation is imperfect.",
  },
  {
    id: "benefit_performance_stability_1",
    title: "Senior manager concerned with stability",
    direction: "toward_acceptance",
    roleCategory: "company_role",
    scenarioDomains: ["ai_performance_monitoring_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A senior manager may argue that stronger performance visibility helps the organization detect problems earlier and avoid larger instability later.",
  },
  {
    id: "benefit_preventing_cuts_1",
    title: "Manager trying to prevent cuts elsewhere",
    direction: "toward_acceptance",
    roleCategory: "company_role",
    scenarioDomains: ["ai_performance_monitoring_policy", "ai_shift_scheduling_policy"],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A manager may argue that rejecting the policy could increase pressure for cuts in other parts of the organization, shifting harm rather than avoiding it.",
  },
  {
    id: "benefit_board_perspective_1",
    title: "Board or governance perspective",
    direction: "toward_acceptance",
    roleCategory: "institutional_role",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A governance perspective may emphasize that leadership is responsible not only for avoiding localized harm, but also for sustaining the organization's long-term mission and resilience.",
  },
  {
    id: "benefit_future_worker_support_1",
    title: "Future worker support perspective",
    direction: "toward_acceptance",
    roleCategory: "future_benefit",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A future-support perspective may argue that the organizational value created by the policy could later fund stronger safeguards, transition support, or fairer revisions.",
  },
  {
    id: "benefit_another_decision_maker_1",
    title: "Another decision-maker in the organization",
    direction: "toward_acceptance",
    roleCategory: "decision_responsibility",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "Another decision-maker in your organization might argue that leadership sometimes requires choosing a difficult policy if it helps protect the organization and the many people who depend on it.",
  },
  {
    id: "benefit_opportunity_cost_1",
    title: "Opportunity-cost perspective",
    direction: "toward_acceptance",
    roleCategory: "future_benefit",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A stakeholder focused on opportunity cost may argue that rejecting the policy also has consequences, because the lost organizational value could have supported staffing, transition support, or future protections.",
  },
  {
    id: "benefit_many_workers_depend_1",
    title: "Employees depending on organizational survival",
    direction: "toward_acceptance",
    roleCategory: "workforce_role",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A workforce-wide perspective may emphasize that many employees depend on the organization remaining financially strong, not only the subgroup immediately affected by the policy.",
  },
  {
    id: "benefit_public_facing_value_1",
    title: "Broader organizational mission",
    direction: "toward_acceptance",
    roleCategory: "institutional_role",
    scenarioDomains: [
      "ai_shift_scheduling_policy",
      "ai_promotion_screening_policy",
      "ai_retraining_allocation_policy",
      "ai_performance_monitoring_policy",
    ],
    applicableGroupTypes: ["any"],
    applicableGroupSizes: ["any"],
    template:
      "A mission-focused perspective may argue that the policy should be evaluated not only by its immediate harms, but also by what it allows the organization to continue doing in the future.",
  },
];

export function selectBlock4Domain(
  profile: MoralProfile,
  analysis: AIWorkforceAnalysis | null,
): Block4ScenarioDomain {
  const directness = Math.round(profile.directnessAversionScore * 100);
  const lowBufferProtection = analysis?.lowBufferProtectionScore ?? 50;
  const vulnSensitivity = Math.round(profile.vulnerabilitySensitivityScore * 100);
  const gainResponsiveness = analysis?.organizationalGainResponsivenessScore ?? 50;
  const sizeEscalation = analysis?.sizeEscalationSensitivityScore ?? 50;

  const isRuleFocused =
    profile.refusedBridge && profile.directnessAversionScore >= 0.6;

  if (directness >= 60 || isRuleFocused) {
    return "ai_performance_monitoring_policy";
  }
  if (lowBufferProtection >= 60 || vulnSensitivity >= 60) {
    return "ai_shift_scheduling_policy";
  }
  const outcomeWillingness = gainResponsiveness;
  if (outcomeWillingness >= 55 && gainResponsiveness >= 50) {
    return "ai_promotion_screening_policy";
  }
  if (sizeEscalation >= 60) {
    return "ai_retraining_allocation_policy";
  }
  return "ai_shift_scheduling_policy";
}

export function pickPerspective(
  domain: Block4ScenarioDomain,
  direction: VignetteDirection,
  groupSize: "small" | "medium" | "large",
  excludeIds: string[],
  excludeRoleCategories: string[],
  profile: MoralProfile,
  analysis: AIWorkforceAnalysis | null,
): StakeholderPerspectiveCard {
  const candidates = STAKEHOLDER_PERSPECTIVES.filter(
    (p) =>
      p.direction === direction &&
      p.scenarioDomains.includes(domain) &&
      (p.applicableGroupSizes.includes("any") ||
        p.applicableGroupSizes.includes(groupSize)) &&
      !excludeIds.includes(p.id) &&
      !excludeRoleCategories.includes(p.roleCategory),
  );

  if (candidates.length === 0) {
    const fallback = STAKEHOLDER_PERSPECTIVES.filter(
      (p) => p.direction === direction && !excludeIds.includes(p.id),
    );
    return fallback[0] ?? STAKEHOLDER_PERSPECTIVES[0];
  }

  const scored = candidates.map((card) => {
    let score = 0;
    if (direction === "toward_rejection") {
      score += (analysis?.lowBufferProtectionScore ?? 50) * 0.3;
      score += Math.round(profile.directnessAversionScore * 100) * 0.2;
      score += (analysis?.sizeEscalationSensitivityScore ?? 50) * 0.2;
      if (card.scenarioDomains.length === 1) score += 15;
    } else {
      score += (analysis?.organizationalGainResponsivenessScore ?? 50) * 0.3;
      score += (1 - profile.harmReluctanceScore) * 100 * 0.2;
      if (card.scenarioDomains.length === 1) score += 15;
    }
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].card;
}
