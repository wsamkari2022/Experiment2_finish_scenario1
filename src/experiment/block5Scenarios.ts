/**
 * block5Scenarios.ts — The public-emergency scenarios and their options.
 *
 * v3 (CVR Cube): Scenario 1 (cancer) now has 6 trade-off-heavy options, each with:
 *   - a 4-dimension POLICY fingerprint (vulnerability, group-size, gain, aggregation)
 *     used for alignment (the other 3 fingerprint dims are kept for back-compat only),
 *   - 8 generic PERFORMANCE metrics (separate from alignment),
 *   - a one-line "consequence" (what it gives / gives up), plus card detail fields.
 * Scenarios 2 & 3 keep their original options with a consequence line added; their
 * performance metrics are auto-derived until they are authored (Scenario 1 first).
 */

import type { Block5Scenario } from "./block5Types";

export const BLOCK5_SCENARIOS: Block5Scenario[] = [
  {
    id: "cancer_treatment_allocation",
    factBase:
      "This month there are about 120 eligible patients and only 20 doses. Every option gives out all 20 — they differ only in who receives them.",
    title: "Limited Cancer Treatment Allocation",
    description:
      "A hospital system has access to a promising new cancer treatment, but the supply is far too limited for all patients who could benefit this month. You are part of the emergency allocation team and must choose the policy that will determine how the available treatment is allocated.",
    theme: {
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(229,62,62,0.22), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(120,20,30,0.30), transparent 55%), linear-gradient(155deg, #1c0c0e, #2a0f14 50%, #43131c)",
      accent: "#E53E3E",
      shadow: "0 8px 32px rgba(229, 62, 62, 0.15)",
    },
    options: [
      {
        id: "cancer_max_total_lives",
        cvrSeed: {
          rule: "gives them to the patients with the highest survival odds",
          identifiedCase: "One patient's lower ranking comes only from a late diagnosis — the nearest screening clinic is a 90-minute drive, and they have no car",
          harm: "Their tumour will keep growing while they wait",
        },
        title: "Maximize total lives saved",
        summary: "Give the treatment to the mix of patients that saves the most lives overall.",
        consequence: "Saves the most lives overall, but skips the worst-off.",
        givesUp: "The worst-off: low-odds and late-diagnosed patients are passed over.",
        moralTension: "Efficiency vs. fairness.",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 25,
          groupSizeSensitivity: 75,
          gainResponsivenessSensitivity: 80,
          outcomeAggregationSensitivity: 95,
          directnessSensitivity: 55,
          contextSensitivity: 45,
          stakeholderPerspectiveShiftSensitivity: 35,
        },
        metrics: {
          totalBenefit: 95, harmReduction: 80, fairnessEquity: 45, vulnerableProtection: 30,
          resourceEfficiency: 90, feasibility: 85, longTermImpact: 70, predictability: 82,
        },
      },
      {
        id: "cancer_prioritize_vulnerable",
        cvrSeed: {
          rule: "reserves them for the most vulnerable patients first",
          identifiedCase: "One patient who is passed over would almost certainly have been cured — they simply were not among the most vulnerable",
          harm: "A near-certain recovery is lost, and fewer lives are saved overall",
        },
        title: "Protect the most vulnerable first",
        summary: "Give the treatment to the sickest and least-served patients first.",
        consequence: "Helps those most in need, but saves fewer overall.",
        givesUp: "Total lives saved may be lower; some doses go to low-odds patients.",
        moralTension: "Compassion vs. total benefit.",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 95,
          groupSizeSensitivity: 45,
          gainResponsivenessSensitivity: 30,
          outcomeAggregationSensitivity: 25,
          directnessSensitivity: 70,
          contextSensitivity: 60,
          stakeholderPerspectiveShiftSensitivity: 55,
        },
        metrics: {
          totalBenefit: 65, harmReduction: 78, fairnessEquity: 80, vulnerableProtection: 95,
          resourceEfficiency: 55, feasibility: 70, longTermImpact: 65, predictability: 58,
        },
      },
      {
        id: "cancer_max_life_years",
        cvrSeed: {
          rule: "gives them to the patients who would gain the most years of life",
          identifiedCase: "A 70-year-old who would gain four good years is passed over in favour of younger patients",
          harm: "Those four years are lost because of age, not need",
        },
        title: "Maximize life-years (treat the best responders)",
        summary: "Give the treatment to patients who would gain the most years of life.",
        consequence: "Most years of life saved, but deprioritizes older patients.",
        givesUp: "Older and lower-response patients are deprioritized (feels like ageism).",
        moralTension: "Life-years vs. equal worth.",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 30,
          groupSizeSensitivity: 55,
          gainResponsivenessSensitivity: 92,
          outcomeAggregationSensitivity: 80,
          directnessSensitivity: 55,
          contextSensitivity: 50,
          stakeholderPerspectiveShiftSensitivity: 35,
        },
        metrics: {
          totalBenefit: 90, harmReduction: 75, fairnessEquity: 50, vulnerableProtection: 35,
          resourceEfficiency: 88, feasibility: 80, longTermImpact: 90, predictability: 80,
        },
      },
      {
        id: "cancer_weighted_lottery",
        cvrSeed: {
          rule: "draws the recipients at random, with only a small boost for vulnerable patients",
          identifiedCase: "One patient who would have responded exceptionally well simply lost the draw",
          harm: "A life that could have been saved is left to chance",
        },
        title: "Equal-chance lottery (small boost for vulnerable)",
        summary: "Everyone eligible gets a chance; vulnerable patients get slightly better odds.",
        consequence: "Fair and unbiased, but ignores who would benefit most.",
        givesUp: "Ignores who would benefit most; the outcome is left to luck.",
        moralTension: "Equality vs. outcomes.",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 60,
          groupSizeSensitivity: 85,
          gainResponsivenessSensitivity: 25,
          outcomeAggregationSensitivity: 45,
          directnessSensitivity: 82,
          contextSensitivity: 70,
          stakeholderPerspectiveShiftSensitivity: 85,
        },
        metrics: {
          totalBenefit: 60, harmReduction: 65, fairnessEquity: 92, vulnerableProtection: 65,
          resourceEfficiency: 60, feasibility: 90, longTermImpact: 55, predictability: 50,
        },
      },
      {
        id: "cancer_reserve_underserved",
        cvrSeed: {
          rule: "holds part of them back for hard-to-reach patients",
          identifiedCase: "Treatable patients on the ward are passed over while some reserved doses are never claimed",
          harm: "Doses that could have saved reachable patients sit unused",
        },
        title: "Reserve a share for hard-to-reach / underserved patients",
        summary: "Hold back some doses for rural and underserved patients others miss.",
        consequence: "Reaches the overlooked, but helps fewer and may waste doses.",
        givesUp: "Helps fewer people; some reserved doses may go unused.",
        moralTension: "Equity vs. efficiency / waste.",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 85,
          groupSizeSensitivity: 35,
          gainResponsivenessSensitivity: 35,
          outcomeAggregationSensitivity: 30,
          directnessSensitivity: 68,
          contextSensitivity: 88,
          stakeholderPerspectiveShiftSensitivity: 65,
        },
        metrics: {
          totalBenefit: 58, harmReduction: 70, fairnessEquity: 85, vulnerableProtection: 90,
          resourceEfficiency: 45, feasibility: 55, longTermImpact: 75, predictability: 45,
        },
      },
      {
        id: "cancer_essential_workers",
        cvrSeed: {
          rule: "gives them first to key workers and caregivers",
          identifiedCase: "A sicker retired patient is passed over because they are not classed as 'essential'",
          harm: "The person who needed it most is treated as less useful",
        },
        title: "Prioritize essential workers / caregivers",
        summary: "Give the treatment first to people others depend on (key workers, caregivers).",
        consequence: "Keeps society running, but can skip the sickest.",
        givesUp: "Can skip the sickest; treats people as 'useful'.",
        moralTension: "Social value vs. equal worth.",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 40,
          groupSizeSensitivity: 78,
          gainResponsivenessSensitivity: 60,
          outcomeAggregationSensitivity: 70,
          directnessSensitivity: 60,
          contextSensitivity: 55,
          stakeholderPerspectiveShiftSensitivity: 50,
        },
        metrics: {
          totalBenefit: 75, harmReduction: 70, fairnessEquity: 55, vulnerableProtection: 45,
          resourceEfficiency: 78, feasibility: 75, longTermImpact: 82, predictability: 72,
        },
      },
    ],
  },
  {
    id: "flood_evacuation_priority",
    factBase:
      "There are not enough buses or rescue hours for every neighborhood. Every option uses the same limited fleet — they differ only in who is reached first.",
    title: "Flood Evacuation Priority",
    description:
      "Severe flooding is approaching several neighborhoods, and evacuation resources are limited. There are not enough buses, rescue teams, or hours left to evacuate everyone immediately. You must choose the evacuation policy that should guide the next phase of the emergency response.",
    theme: {
      gradient: "linear-gradient(to bottom right, #06140E, #113122, #1C4B36)",
      accent: "#38A169",
      shadow: "0 8px 32px rgba(56, 161, 105, 0.15)",
    },
    options: [
      {
        id: "flood_largest_neighborhoods",
        title: "Evacuate the largest neighborhoods first",
        summary: "Prioritize the areas where the largest number of people can be moved most quickly.",
        consequence: "Reaches the most people fast, but overlooks those who can't self-evacuate.",
        fingerprint: {
          directnessSensitivity: 45, vulnerabilityProtectionSensitivity: 35, groupSizeSensitivity: 95,
          contextSensitivity: 40, gainResponsivenessSensitivity: 55, stakeholderPerspectiveShiftSensitivity: 30,
          outcomeAggregationSensitivity: 90,
        },
      },
      {
        id: "flood_vulnerable_groups_first",
        title: "Evacuate hospitals, elderly residents, disabled residents, and low-mobility families first",
        summary: "Prioritize the people least able to self-protect or evacuate without help.",
        consequence: "Protects those least able to flee, but moves fewer people per hour.",
        fingerprint: {
          directnessSensitivity: 65, vulnerabilityProtectionSensitivity: 98, groupSizeSensitivity: 45,
          contextSensitivity: 70, gainResponsivenessSensitivity: 30, stakeholderPerspectiveShiftSensitivity: 55,
          outcomeAggregationSensitivity: 50,
        },
      },
      {
        id: "flood_highest_risk_zones",
        title: "Evacuate the highest-risk flood zones first",
        summary: "Prioritize the areas facing the most immediate physical danger, even if they contain fewer people overall.",
        consequence: "Targets the deadliest danger first, but may save fewer people overall.",
        fingerprint: {
          directnessSensitivity: 92, vulnerabilityProtectionSensitivity: 60, groupSizeSensitivity: 55,
          contextSensitivity: 95, gainResponsivenessSensitivity: 35, stakeholderPerspectiveShiftSensitivity: 45,
          outcomeAggregationSensitivity: 60,
        },
      },
      {
        id: "flood_balanced_mixed_plan",
        title: "Use a balanced mixed plan",
        summary: "Split resources across vulnerable groups, highest-risk zones, and large-population areas to avoid overcommitting to one principle.",
        consequence: "Spreads effort across priorities, but does none of them fully.",
        fingerprint: {
          directnessSensitivity: 75, vulnerabilityProtectionSensitivity: 82, groupSizeSensitivity: 78,
          contextSensitivity: 85, gainResponsivenessSensitivity: 45, stakeholderPerspectiveShiftSensitivity: 88,
          outcomeAggregationSensitivity: 75,
        },
      },
      {
        id: "flood_reserve_capacity",
        title: "Keep a reserve fleet for likely secondary flooding while evacuating the most exposed areas first",
        summary: "Use part of the response immediately, but reserve part of the system for expected worsening conditions.",
        consequence: "Prepares for worse flooding, but commits less to people in danger now.",
        fingerprint: {
          directnessSensitivity: 70, vulnerabilityProtectionSensitivity: 58, groupSizeSensitivity: 52,
          contextSensitivity: 90, gainResponsivenessSensitivity: 60, stakeholderPerspectiveShiftSensitivity: 50,
          outcomeAggregationSensitivity: 68,
        },
      },
    ],
  },
  {
    id: "water_contamination_response",
    factBase:
      "Crews and clean-water supplies are limited. Every option uses the same resources — they differ only in who is protected first.",
    title: "Water Contamination Response",
    description:
      "A city discovers dangerous contamination in its water system. Officials cannot protect every area and every institution at once. You must choose the response policy that will guide the first phase of protection and emergency distribution.",
    theme: {
      gradient: "linear-gradient(to bottom right, #05111E, #0B2740, #14476B)",
      accent: "#3182CE",
      shadow: "0 8px 32px rgba(49, 130, 206, 0.15)",
    },
    options: [
      {
        id: "water_protect_critical_sites",
        title: "Protect hospitals, schools, elder-care facilities, and dialysis centers first",
        summary: "Prioritize institutions serving people who face the greatest health risk from unsafe water.",
        consequence: "Shields the most fragile patients, but reaches fewer households.",
        fingerprint: {
          directnessSensitivity: 72, vulnerabilityProtectionSensitivity: 97, groupSizeSensitivity: 40,
          contextSensitivity: 68, gainResponsivenessSensitivity: 35, stakeholderPerspectiveShiftSensitivity: 55,
          outcomeAggregationSensitivity: 48,
        },
      },
      {
        id: "water_shutoff_highest_contamination",
        title: "Shut off the highest-contamination zones immediately and deliver emergency clean water there",
        summary: "Take the strongest immediate action where danger is most direct, even if it creates disruption.",
        consequence: "Stops the worst exposure fast, but disrupts many.",
        fingerprint: {
          directnessSensitivity: 95, vulnerabilityProtectionSensitivity: 72, groupSizeSensitivity: 55,
          contextSensitivity: 92, gainResponsivenessSensitivity: 28, stakeholderPerspectiveShiftSensitivity: 42,
          outcomeAggregationSensitivity: 62,
        },
      },
      {
        id: "water_largest_neighborhoods",
        title: "Protect the largest neighborhoods first",
        summary: "Prioritize the approach that reaches the largest number of residents as quickly as possible.",
        consequence: "Protects the most residents quickly, but overlooks fragile institutions.",
        fingerprint: {
          directnessSensitivity: 50, vulnerabilityProtectionSensitivity: 38, groupSizeSensitivity: 96,
          contextSensitivity: 44, gainResponsivenessSensitivity: 55, stakeholderPerspectiveShiftSensitivity: 35,
          outcomeAggregationSensitivity: 92,
        },
      },
      {
        id: "water_balanced_targeted_response",
        title: "Issue a citywide boil-water advisory plus targeted clean-water delivery to high-risk households",
        summary: "Combine a broad warning with more focused aid to reduce both total risk and unequal burden.",
        consequence: "Warns everyone and helps the most at-risk, but is harder to run.",
        fingerprint: {
          directnessSensitivity: 80, vulnerabilityProtectionSensitivity: 88, groupSizeSensitivity: 74,
          contextSensitivity: 87, gainResponsivenessSensitivity: 46, stakeholderPerspectiveShiftSensitivity: 82,
          outcomeAggregationSensitivity: 72,
        },
      },
      {
        id: "water_restore_system_first",
        title: "Stabilize the central treatment plant first to restore safe water sooner citywide",
        summary: "Prioritize the option most likely to restore system-wide safety faster, even if some households remain exposed longer in the short term.",
        consequence: "Fixes it for everyone sooner, but leaves some exposed longer now.",
        fingerprint: {
          directnessSensitivity: 58, vulnerabilityProtectionSensitivity: 52, groupSizeSensitivity: 84,
          contextSensitivity: 78, gainResponsivenessSensitivity: 70, stakeholderPerspectiveShiftSensitivity: 40,
          outcomeAggregationSensitivity: 86,
        },
      },
    ],
  },
];
