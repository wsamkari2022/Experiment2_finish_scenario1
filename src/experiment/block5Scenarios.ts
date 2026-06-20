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
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(56,161,105,0.20), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(20,75,54,0.35), transparent 55%), linear-gradient(155deg, #06140E, #0f2a1d 50%, #1C4B36)",
      accent: "#38A169",
      shadow: "0 8px 32px rgba(56, 161, 105, 0.15)",
    },
    options: [
      {
        id: "flood_largest_neighborhoods",
        cvrSeed: {
          rule: "sends the buses to the largest neighborhoods first",
          identifiedCase: "A wheelchair-using resident on a quiet outer street the buses are scheduled to reach last",
          harm: "The water is already at the windowsill before any bus turns onto their road",
        },
        title: "Evacuate the largest neighborhoods first",
        summary: "Send the buses where they can move the greatest number of people in the hours that remain.",
        consequence: "Moves the most people to safety overall — but the few who cannot self-evacuate are reached last, if at all.",
        givesUp: "The worst-off: disabled, elderly, and isolated residents who depend on a bus that may never come.",
        moralTension: "Is saving the greatest number worth knowingly leaving behind the ones who most needed help to escape?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 32, groupSizeSensitivity: 96,
          gainResponsivenessSensitivity: 48, outcomeAggregationSensitivity: 78,
          directnessSensitivity: 45, contextSensitivity: 40, stakeholderPerspectiveShiftSensitivity: 30,
        },
        metrics: {
          totalBenefit: 94, harmReduction: 78, fairnessEquity: 40, vulnerableProtection: 26,
          resourceEfficiency: 90, feasibility: 90, longTermImpact: 64, predictability: 86,
        },
      },
      {
        id: "flood_vulnerable_groups_first",
        cvrSeed: {
          rule: "sends the rescue teams to the least-mobile residents first",
          identifiedCase: "A packed apartment block of able-bodied residents told to wait while a team carries out one bedridden patient",
          harm: "Dozens sit in rising water for the hour it takes to evacuate a single household",
        },
        title: "Evacuate those who cannot escape on their own first",
        summary: "Send rescue teams first to hospitals, care homes, and low-mobility families — the people who cannot flee without help.",
        consequence: "Protects those who literally cannot save themselves — but each rescue is slow, so far fewer people are moved per hour.",
        givesUp: "Total reach and speed: many who could have been saved wait as resources go to a difficult few.",
        moralTension: "Do you protect those who cannot flee, even if more people drown in the time it takes to carry a few to safety?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 97, groupSizeSensitivity: 48,
          gainResponsivenessSensitivity: 45, outcomeAggregationSensitivity: 48,
          directnessSensitivity: 65, contextSensitivity: 70, stakeholderPerspectiveShiftSensitivity: 55,
        },
        metrics: {
          totalBenefit: 60, harmReduction: 80, fairnessEquity: 84, vulnerableProtection: 97,
          resourceEfficiency: 50, feasibility: 66, longTermImpact: 66, predictability: 56,
        },
      },
      {
        id: "flood_highest_risk_zones",
        cvrSeed: {
          rule: "throws the whole fleet at the deadliest zones to prevent the most deaths",
          identifiedCase: "A reachable street rated 'lower risk' that is cut from the plan and told help is not coming",
          harm: "Its residents are left to the rising water while every boat goes elsewhere",
        },
        title: "Evacuate the deadliest zones first",
        summary: "Concentrate everything on the areas where the flood is most likely to kill, to prevent the greatest number of deaths.",
        consequence: "Prevents the most deaths — but whole lower-risk streets are skipped entirely, even ones you could have reached.",
        givesUp: "Reachable 'safer' areas get nothing; people there are written off because their danger score was lower.",
        moralTension: "If you can prevent the most deaths by ignoring the 'safer' streets, is it right to abandon them completely?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 58, groupSizeSensitivity: 50,
          gainResponsivenessSensitivity: 46, outcomeAggregationSensitivity: 96,
          directnessSensitivity: 92, contextSensitivity: 95, stakeholderPerspectiveShiftSensitivity: 44,
        },
        metrics: {
          totalBenefit: 90, harmReduction: 95, fairnessEquity: 46, vulnerableProtection: 56,
          resourceEfficiency: 82, feasibility: 70, longTermImpact: 60, predictability: 58,
        },
      },
      {
        id: "flood_efficient_rescue",
        cvrSeed: {
          rule: "sends each boat wherever it can rescue the most people per trip",
          identifiedCase: "An elderly couple at the end of a long flooded lane the dispatcher calls 'not worth the fuel'",
          harm: "Every boat passes their road by because the numbers point elsewhere",
        },
        title: "Send each rescue boat where it saves the most people per trip",
        summary: "Direct every scarce boat-hour to wherever it pulls the most people out of danger for the effort spent.",
        consequence: "Squeezes the most rescues from a tiny fleet — but anyone hard to reach is passed over because they 'cost too much' per trip.",
        givesUp: "The isolated and far-flung: long flooded lanes and lone houses the math says are not worth the trip.",
        moralTension: "Efficiency saves more people overall — but is it just to abandon someone simply because reaching them is expensive?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 35, groupSizeSensitivity: 60,
          gainResponsivenessSensitivity: 95, outcomeAggregationSensitivity: 70,
          directnessSensitivity: 60, contextSensitivity: 50, stakeholderPerspectiveShiftSensitivity: 35,
        },
        metrics: {
          totalBenefit: 84, harmReduction: 76, fairnessEquity: 38, vulnerableProtection: 32,
          resourceEfficiency: 97, feasibility: 84, longTermImpact: 64, predictability: 82,
        },
      },
      {
        id: "flood_balanced_mixed_plan",
        cvrSeed: {
          rule: "splits the fleet thinly across every priority at once",
          identifiedCase: "Families in every group who fall just outside their share of the divided effort",
          harm: "Each group is only half-reached as the water rises, and the boats finish no rescue in time",
        },
        title: "Split the fleet across every priority at once",
        summary: "Divide resources so vulnerable groups, the deadliest zones, and the largest neighborhoods all receive some help.",
        consequence: "No group is completely abandoned — but spread this thin, the fleet reaches none of them in time, and likely saves fewer overall than a focused plan.",
        givesUp: "Decisiveness and total rescues: refusing to prioritize can cost lives a committed plan would have saved.",
        moralTension: "Is refusing to choose who matters most a fair compromise — or an indecision that quietly costs the most lives of all?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 60, groupSizeSensitivity: 60,
          gainResponsivenessSensitivity: 56, outcomeAggregationSensitivity: 58,
          directnessSensitivity: 72, contextSensitivity: 82, stakeholderPerspectiveShiftSensitivity: 90,
        },
        metrics: {
          totalBenefit: 64, harmReduction: 70, fairnessEquity: 80, vulnerableProtection: 64,
          resourceEfficiency: 50, feasibility: 54, longTermImpact: 66, predictability: 52,
        },
      },
      {
        id: "flood_reserve_capacity",
        cvrSeed: {
          rule: "holds part of the fleet back for the second surge that is forecast",
          identifiedCase: "A family trapped right now on a street the reserved boats could reach this very hour",
          harm: "They wait as rescue capacity sits idle for a flood that may never arrive",
        },
        title: "Hold back part of the fleet for the predicted second surge",
        summary: "Commit part of the response now, but reserve capacity for the larger flooding the forecast says is still to come.",
        consequence: "Could save more across the whole disaster — but people in danger right now wait while rescue boats sit idle for a surge that may not arrive.",
        givesUp: "Certain help for people endangered now, traded for protection against an uncertain worse tomorrow.",
        moralTension: "Do you gamble present lives on a forecast, sparing capacity for a second wave that might never come?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 46, groupSizeSensitivity: 46,
          gainResponsivenessSensitivity: 58, outcomeAggregationSensitivity: 66,
          directnessSensitivity: 70, contextSensitivity: 92, stakeholderPerspectiveShiftSensitivity: 50,
        },
        metrics: {
          totalBenefit: 66, harmReduction: 64, fairnessEquity: 56, vulnerableProtection: 50,
          resourceEfficiency: 64, feasibility: 62, longTermImpact: 88, predictability: 50,
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
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(49,130,206,0.20), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(11,39,64,0.40), transparent 55%), linear-gradient(155deg, #05111E, #0b2740 50%, #14476B)",
      accent: "#3182CE",
      shadow: "0 8px 32px rgba(49, 130, 206, 0.15)",
    },
    options: [
      {
        id: "water_protect_critical_sites",
        cvrSeed: {
          rule: "reserves the crews and clean water for hospitals, dialysis centers, and care homes first",
          identifiedCase: "A large apartment block of otherwise-healthy families told safe water is still days away",
          harm: "Thousands keep drinking contaminated water while a few critical sites are secured",
        },
        title: "Protect hospitals, dialysis centers, and elder-care first",
        summary: "Send the crews and clean water first to the institutions serving people who would be harmed most by unsafe water.",
        consequence: "Shields those whose health is most fragile — but far fewer households are reached, and most of the city waits.",
        givesUp: "Total reach: the majority keep drinking unsafe water while resources protect a vulnerable few.",
        moralTension: "Do you guard the people unsafe water would harm most, even though it leaves the great majority exposed?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 97, groupSizeSensitivity: 46,
          gainResponsivenessSensitivity: 44, outcomeAggregationSensitivity: 48,
          directnessSensitivity: 70, contextSensitivity: 74, stakeholderPerspectiveShiftSensitivity: 56,
        },
        metrics: {
          totalBenefit: 60, harmReduction: 80, fairnessEquity: 84, vulnerableProtection: 97,
          resourceEfficiency: 50, feasibility: 66, longTermImpact: 66, predictability: 56,
        },
      },
      {
        id: "water_largest_neighborhoods",
        cvrSeed: {
          rule: "sends the crews and clean water to the largest neighborhoods first",
          identifiedCase: "A dialysis patient in a small clinic that never makes the priority list",
          harm: "They are left relying on contaminated water for a treatment that cannot use it",
        },
        title: "Protect the largest neighborhoods first",
        summary: "Reach the greatest number of residents with clean water as quickly as the crews allow.",
        consequence: "Gets safe water to the most people fastest — but fragile institutions and small clinics are overlooked.",
        givesUp: "The most fragile: hospitals, dialysis, and care homes serving those least able to cope with exposure.",
        moralTension: "Is reaching the most people worth leaving the sites that protect the most fragile until last?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 34, groupSizeSensitivity: 96,
          gainResponsivenessSensitivity: 50, outcomeAggregationSensitivity: 80,
          directnessSensitivity: 48, contextSensitivity: 42, stakeholderPerspectiveShiftSensitivity: 32,
        },
        metrics: {
          totalBenefit: 94, harmReduction: 78, fairnessEquity: 42, vulnerableProtection: 28,
          resourceEfficiency: 90, feasibility: 90, longTermImpact: 64, predictability: 86,
        },
      },
      {
        id: "water_shutoff_highest_contamination",
        cvrSeed: {
          rule: "throws the crews at the highest-contamination zones to prevent the most illness overall",
          identifiedCase: "A lightly-contaminated district cut from the plan because its exposure 'scores' lower",
          harm: "Its residents are told no crew is coming, even though one easily could",
        },
        title: "Treat the highest-contamination zones first",
        summary: "Concentrate the crews where contamination is worst, to prevent the greatest total amount of illness across the city.",
        consequence: "Prevents the most illness overall — but lower-contamination areas are skipped entirely, even ones easily reached.",
        givesUp: "Reachable lower-risk districts get nothing; people there are written off because their exposure was smaller.",
        moralTension: "If you can prevent the most illness by ignoring the 'cleaner' districts, is it right to abandon them completely?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 58, groupSizeSensitivity: 50,
          gainResponsivenessSensitivity: 46, outcomeAggregationSensitivity: 96,
          directnessSensitivity: 95, contextSensitivity: 92, stakeholderPerspectiveShiftSensitivity: 44,
        },
        metrics: {
          totalBenefit: 90, harmReduction: 95, fairnessEquity: 46, vulnerableProtection: 56,
          resourceEfficiency: 82, feasibility: 70, longTermImpact: 60, predictability: 58,
        },
      },
      {
        id: "water_efficient_exposure",
        cvrSeed: {
          rule: "sends each crew wherever it removes the most exposure per hour",
          identifiedCase: "A cluster of isolated homes on the edge of town the planner calls 'too few per stop'",
          harm: "No crew is routed to them because the per-hour numbers point elsewhere",
        },
        title: "Send each crew where it removes the most exposure per hour",
        summary: "Direct every scarce crew-hour to wherever it cuts the most contamination exposure for the effort spent.",
        consequence: "Prevents the most illness per crew-hour — but scattered, hard-to-reach households are passed over as 'low yield.'",
        givesUp: "The isolated and far-flung: small clusters the math judges are not worth a crew's time.",
        moralTension: "Efficiency protects more people overall — but is it fair to skip households simply because reaching them is costly?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 35, groupSizeSensitivity: 58,
          gainResponsivenessSensitivity: 96, outcomeAggregationSensitivity: 70,
          directnessSensitivity: 58, contextSensitivity: 50, stakeholderPerspectiveShiftSensitivity: 36,
        },
        metrics: {
          totalBenefit: 84, harmReduction: 76, fairnessEquity: 38, vulnerableProtection: 32,
          resourceEfficiency: 97, feasibility: 84, longTermImpact: 64, predictability: 82,
        },
      },
      {
        id: "water_balanced_targeted_response",
        cvrSeed: {
          rule: "issues a broad advisory and splits delivery thinly across every group",
          identifiedCase: "A bedridden resident who cannot boil water and receives only a leaflet",
          harm: "The advisory they cannot act on arrives instead of the clean water they needed",
        },
        title: "Citywide boil-water advisory plus thin targeted delivery",
        summary: "Warn the whole city and divide clean-water delivery across vulnerable, high-contamination, and large areas alike.",
        consequence: "No group is fully abandoned — but a boil order many cannot follow, plus delivery spread this thin, likely prevents less illness than a focused plan.",
        givesUp: "Effectiveness and decisiveness: hedging can protect fewer people than committing to one clear priority.",
        moralTension: "Is a fair-to-everyone compromise the responsible choice — or an indecision that quietly protects the fewest?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 60, groupSizeSensitivity: 60,
          gainResponsivenessSensitivity: 56, outcomeAggregationSensitivity: 58,
          directnessSensitivity: 68, contextSensitivity: 80, stakeholderPerspectiveShiftSensitivity: 90,
        },
        metrics: {
          totalBenefit: 64, harmReduction: 70, fairnessEquity: 80, vulnerableProtection: 64,
          resourceEfficiency: 50, feasibility: 54, longTermImpact: 66, predictability: 52,
        },
      },
      {
        id: "water_restore_system_first",
        cvrSeed: {
          rule: "puts the crews on repairing the central treatment plant first",
          identifiedCase: "An immunocompromised resident exposed right now while every crew works at the plant",
          harm: "They drink unsafe water for days while the long-term fix is built",
        },
        title: "Restore the central treatment system first",
        summary: "Put the crews on fixing the source so the whole city gets safe water sooner overall, accepting longer exposure in the meantime.",
        consequence: "Solves it at the root for everyone sooner — but while crews repair the plant, people, especially the vulnerable, stay exposed now.",
        givesUp: "Immediate protection: people in danger today wait while effort goes to the system-wide fix.",
        moralTension: "Do you fix the source for everyone's sake, even though it leaves the most vulnerable exposed the longest right now?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 46, groupSizeSensitivity: 50,
          gainResponsivenessSensitivity: 58, outcomeAggregationSensitivity: 66,
          directnessSensitivity: 66, contextSensitivity: 94, stakeholderPerspectiveShiftSensitivity: 50,
        },
        metrics: {
          totalBenefit: 70, harmReduction: 64, fairnessEquity: 58, vulnerableProtection: 46,
          resourceEfficiency: 66, feasibility: 60, longTermImpact: 92, predictability: 52,
        },
      },
    ],
  },
];
