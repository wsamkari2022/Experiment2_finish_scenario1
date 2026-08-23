/**
 * block5CVRContent.ts — Builds the CVR vignette text from the cube coordinate (v3.2).
 *
 * A CVR vignette now has TWO parts so the participant can tell them apart:
 *   1. recontext   — the RECONTEXTUALIZED SCENARIO: the SAME trade-off and numbers as the
 *                    chosen option, re-framed (context vs directness). Outcome-equivalent.
 *   2. stakeholder — the AHA-style STAKEHOLDER VIGNETTE: a concrete, identified person/group
 *                    (chosen by salience) and the concrete harm they experience.
 *   + reendorseQuestion.
 *
 * The text carries lightweight {markup} so the UI can colour the three CVR-cube dimensions:
 *   {a|…} same-numbers anchor (outcome-equivalence)   {v|…} the violated VALUE
 *   {f|…} the FRAMING (context/directness)            {w|…} WHO appears (salience)
 *   {b|…} plain bold (e.g. the harm)
 *
 * Scenario 1 (cancer) is authored concretely; other scenarios use a generic fallback and
 * each option's own `cvrSeed` (or a derived one). No scenario text lives in the logic.
 */

import type {
  Block5PolicyDimKey, Block5Scenario, Block5ScenarioOption,
  CVRCoordinate, CVRFraming, CVRStory, OptionCVRSeed, SalienceWho, WhoVariant,
} from "./block5Types";

interface ScenarioCVRContent {
  anchorNoun: string; // "20 doses" / "resources"
  valuePhrase: Record<Block5PolicyDimKey, string>;
  framingClause: Record<CVRFraming, string>;
  whoLead: Record<SalienceWho, WhoVariant[]>;
}

/**
 * LOW / close salience — a loved one. This list is SHARED across ALL scenarios
 * (per the design: "someone close" stays identical everywhere). One is chosen at random.
 */
/**
 * LOW / close salience — the person the participant feels closest to. SHARED across ALL scenarios.
 *
 * v4 (advisor request): family members were removed. Naming a mother or a son makes the vignette
 * land differently depending on a participant's own family situation, which adds noise we cannot
 * control. It is replaced by a long-standing, chosen relationship of the same emotional weight —
 * someone known for twenty years and cared about — which every participant can picture equally.
 * The three variants say the same thing in different words so repeats do not feel mechanical.
 */
const CLOSE_WHO: WhoVariant[] = [
  { lead: "Imagine this affected person is someone you have known for twenty years, someone you care about.", label: "someone you have known for twenty years" },
  { lead: "Imagine this affected person is someone you have been close to for twenty years, and still care about deeply.", label: "someone you have been close to for twenty years" },
  { lead: "Imagine this affected person is someone who has been in your life for twenty years, and matters to you.", label: "someone who has been in your life for twenty years" },
];

/**
 * v4 (advisor request): two extra voices that extend the social-distance ladder, appended to
 * every scenario. MEDIUM gains a one-year acquaintance; HIGH gains a complete stranger. Together
 * with CLOSE_WHO this gives a clean gradient of social closeness — twenty years, one year, just met.
 */
const KNOWN_A_YEAR: WhoVariant = {
  lead: "Someone you have known for about a year, who is affected by this, raises a concern with you:",
  label: "someone you have known for a year",
};
const JUST_MET: WhoVariant = {
  lead: "Someone you have only just met, who is affected by your decision, considers what it led to, and notes the choice was yours alone:",
  label: "someone you just met",
};

const CANCER: ScenarioCVRContent = {
  anchorNoun: "20 doses",
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the patients who most need protection",
    groupSizeSensitivity: "much of the larger group who could be reached",
    gainResponsivenessSensitivity: "the patients who would benefit the most",
    outcomeAggregationSensitivity: "the larger total benefit these doses could achieve",
  },
  framingClause: {
    context:
      "the reason some patients rank lower here is context, not worth — late diagnosis, unequal access, and where people live shape the very numbers the rule uses",
    directness:
      "this is not the system deciding — your own rule is what redirects the doses away from them",
  },
  whoLead: {
    close: CLOSE_WHO,
    group: [
      { lead: "A family member of one of the patients pulls you aside about your decision:", label: "a patient's family member" },
      { lead: "The nurse on the ward raises a concern about your decision:", label: "the nurse" },
      { lead: "The treating doctor questions the decision you made:", label: "the treating doctor" },
      { lead: "The ward's oncology doctor, speaking for the patients on the floor, tells you:", label: "the ward's oncology doctor" },
      KNOWN_A_YEAR,
    ],
    system: [
      { lead: "Another member of the allocation board, reviewing the outcome, reminds you the choice was yours to make:", label: "another member of the allocation board" },
      { lead: "The hospital manager points to the consequences of the policy you chose — and that the call was yours:", label: "the hospital manager" },
      { lead: "Someone else in charge weighs the consequences of your decision, and notes it was yours alone:", label: "someone else in charge" },
      JUST_MET,
    ],
  },
};

const FLOOD: ScenarioCVRContent = {
  anchorNoun: "buses and rescue hours",
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the residents who most need help to escape",
    groupSizeSensitivity: "much of the larger population who could be reached",
    gainResponsivenessSensitivity: "the places where each trip would save the most people",
    outcomeAggregationSensitivity: "the largest total number saved from the worst of the flood",
  },
  framingClause: {
    context:
      "the reason some streets rank lower here is circumstance, not worth — where people live, the roads, and who can self-evacuate shape the very numbers the rule uses",
    directness:
      "this is not the flood deciding — your own rule is what sends the boats away from them",
  },
  whoLead: {
    close: CLOSE_WHO,
    group: [
      { lead: "A resident whose street is going under stops you about your decision:", label: "a flooded-out resident" },
      { lead: "A rescue-boat volunteer questions the plan you set:", label: "the rescue volunteer" },
      { lead: "The evacuation-shelter coordinator raises a concern about your decision:", label: "the shelter coordinator" },
      { lead: "The emergency dispatcher pushes back on your decision:", label: "the dispatcher" },
      KNOWN_A_YEAR,
    ],
    system: [
      { lead: "Another member of the emergency-operations command reminds you the call was yours to make:", label: "another command member" },
      { lead: "The city's disaster-response director points to the consequences of the policy you chose — and that the decision was yours:", label: "the disaster-response director" },
      { lead: "Someone else in charge of the evacuation weighs the outcome of your decision, and notes it was yours alone:", label: "someone else in charge" },
      JUST_MET,
    ],
  },
};

const WATER: ScenarioCVRContent = {
  anchorNoun: "crews and clean-water supplies",
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the people whose health is most at risk from unsafe water",
    groupSizeSensitivity: "much of the larger population who could be protected",
    gainResponsivenessSensitivity: "the places where each crew-hour removes the most exposure",
    outcomeAggregationSensitivity: "the largest total amount of illness prevented across the city",
  },
  framingClause: {
    context:
      "the reason some areas rank lower here is circumstance, not worth — where the pipes run, who is already sick, and who can boil water shape the very numbers the rule uses",
    directness:
      "this is not the contamination deciding — your own rule is what sends the clean water away from them",
  },
  whoLead: {
    close: CLOSE_WHO,
    group: [
      { lead: "A parent in an affected household stops you about your decision:", label: "a parent in an affected household" },
      { lead: "A nurse at an affected clinic questions the plan you set:", label: "the clinic nurse" },
      { lead: "The water-utility field engineer raises a concern about your decision:", label: "the utility engineer" },
      { lead: "The neighborhood public-health officer pushes back on your decision:", label: "the public-health officer" },
      KNOWN_A_YEAR,
    ],
    system: [
      { lead: "Another member of the water-response board reminds you the call was yours to make:", label: "another board member" },
      { lead: "The city public-health director points to the consequences of the policy you chose — and that the decision was yours:", label: "the public-health director" },
      { lead: "Someone else in charge of the response weighs the outcome of your decision, and notes it was yours alone:", label: "someone else in charge" },
      JUST_MET,
    ],
  },
};

/**
 * TRAVEL — everyday scenario 1.
 *
 * The four `valuePhrase` entries follow the same rule as the crisis scenarios: each one names a
 * PERSON, GROUP or SHARED GOOD that the chosen option sacrifices, phrased positively so it reads
 * correctly after "What it trades away is …". They must never describe a benefit to the
 * participant themselves, and never be phrased as a negative ("the least pollution"), because
 * neither can be sacrificed in a sentence.
 *
 * `framingClause` mirrors the crisis wording too: the CONTEXT clause explains why some people
 * rank lower through circumstance rather than worth; the DIRECTNESS clause puts the responsibility
 * on the participant's own rule rather than on the system.
 */
const TRAVEL: ScenarioCVRContent = {
  anchorNoun: "1,300 miles and the Friday deadline",
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the people who most need protection from what this journey leaves behind",
    groupSizeSensitivity: "much of the wider public who share this route and depend on it",
    gainResponsivenessSensitivity: "the good this journey could have done for everything it costs",
    outcomeAggregationSensitivity: "the larger overall good this journey could have done for everyone it touches",
  },
  framingClause: {
    context:
      "the reason some places rank lower here is circumstance, not worth — the railway was never built there, and the motorway was routed through the poorest streets",
    directness:
      "this is not the transport system deciding — your own booking is what moves this journey's cost onto them",
  },
  whoLead: {
    close: CLOSE_WHO,
    group: [
      { lead: "A parent whose child's school sits beside the motorway stops you about your decision:", label: "a parent beside the motorway" },
      { lead: "The driver of the service you did not take questions the choice you made:", label: "the driver of the route you skipped" },
      { lead: "A resident living under the approach path raises a concern about your decision:", label: "a resident under the flight path" },
      { lead: "Someone from a town that has just lost its last bus pushes back on your decision:", label: "someone from the town with no bus" },
      KNOWN_A_YEAR,
    ],
    system: [
      { lead: "A regional transport planner, reviewing the outcome, reminds you the choice was yours to make:", label: "the regional transport planner" },
      { lead: "The city's air-quality director points to the consequences of the option you chose — and that the decision was yours:", label: "the air-quality director" },
      { lead: "Someone else responsible for the corridor weighs the outcome of your decision, and notes it was yours alone:", label: "someone else responsible for the corridor" },
      JUST_MET,
    ],
  },
};

/**
 * MEAL — everyday scenario 2. Same construction rules as TRAVEL and the crisis scenarios: every
 * value phrase names something that can genuinely be given up, and the framing clauses speak
 * about the people behind the numbers rather than about the options.
 */
const MEAL: ScenarioCVRContent = {
  anchorNoun: "four plates and the $80",
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the people in this food chain who most need protection",
    groupSizeSensitivity: "much of the larger number this budget could have fed",
    gainResponsivenessSensitivity: "the good this evening could have done for the money and the hours it costs",
    outcomeAggregationSensitivity: "the larger overall good this meal could have done for everyone it touches",
  },
  framingClause: {
    context:
      "the reason some people rank lower here is circumstance, not worth — who is paid by the piece, and whose water grew the food, shape the numbers the rule uses",
    directness:
      "this is not the food system deciding — your own order is what takes this meal's cost out of them",
  },
  whoLead: {
    close: CLOSE_WHO,
    group: [
      { lead: "The driver who carried your order up three floors pushes back on your decision:", label: "the driver who carried it" },
      { lead: "A cook at the kitchen you passed over questions the choice you made:", label: "a cook" },
      { lead: "A worker from the field that grew this food raises a concern about your decision:", label: "a worker in the field" },
      { lead: "A farmer from the market you walked past stops you about your decision:", label: "a farmer at the market" },
      KNOWN_A_YEAR,
    ],
    system: [
      { lead: "A food-policy researcher, reviewing the outcome, reminds you the choice was yours to make:", label: "a food-policy researcher" },
      { lead: "The city's food director points to the consequences of the option you chose — and that the decision was yours:", label: "the city food director" },
      { lead: "Someone else responsible for the food supply weighs the outcome of your decision, and notes it was yours alone:", label: "someone else responsible for the food supply" },
      JUST_MET,
    ],
  },
};

const GENERIC: ScenarioCVRContent = {
  anchorNoun: "resources",
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the people who most need protection",
    groupSizeSensitivity: "much of the larger group who could be reached",
    gainResponsivenessSensitivity: "the cases that would benefit the most",
    outcomeAggregationSensitivity: "the larger total benefit these resources could achieve",
  },
  framingClause: {
    context:
      "the reason some are ranked lower here is context, not worth — unequal access and circumstances shape the very numbers the rule uses",
    directness:
      "this is not the system deciding — your own rule is what directs help away from them",
  },
  whoLead: {
    close: CLOSE_WHO,
    group: [
      { lead: "A frontline responder, speaking for those affected, tells you:", label: "a frontline responder" },
      { lead: "Someone directly affected raises a concern about your decision:", label: "someone directly affected" },
      KNOWN_A_YEAR,
    ],
    system: [
      { lead: "Another decision-maker, reviewing the outcome, reminds you the choice was yours:", label: "another decision-maker" },
      { lead: "Someone else in charge weighs the consequences of your decision, and notes it was yours alone:", label: "someone else in charge" },
      JUST_MET,
    ],
  },
};

const CONTENT: Record<string, ScenarioCVRContent> = {
  travel_mode_choice: TRAVEL,
  meal_hosting_choice: MEAL,
  cancer_treatment_allocation: CANCER,
  flood_evacuation_priority: FLOOD,
  water_contamination_response: WATER,
};

function genericSeed(): OptionCVRSeed {
  return {
    rule: "follows the rule you chose",
    identifiedCase: "Some of those your choice leaves unprotected are the people who can least absorb the harm",
    harm: "They bear the cost while help goes elsewhere",
  };
}

/** Remembers the last voice index per "scenarioId|who" so we never repeat it twice in a row. */
const lastWhoIdx: Record<string, number> = {};

/**
 * Pick a stakeholder voice at random for this scenario + salience level, avoiding an immediate
 * repeat of the last voice used for the same (scenario, level). Call ONCE per misaligned
 * selection (not on every render) so the chosen voice stays stable while the participant reads.
 */
export function pickWhoVariant(scenario: Block5Scenario, who: SalienceWho): WhoVariant {
  const c = CONTENT[scenario.id] ?? GENERIC;
  const list = c.whoLead[who];
  const key = `${scenario.id}|${who}`;
  const last = lastWhoIdx[key] ?? -1;
  let idx = Math.floor(Math.random() * list.length);
  if (list.length > 1 && idx === last) {
    idx = (last + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  }
  lastWhoIdx[key] = idx;
  return list[idx];
}

export function getCVRStory(
  scenario: Block5Scenario,
  option: Block5ScenarioOption,
  coord: CVRCoordinate,
  who: WhoVariant,
): CVRStory {
  const c = CONTENT[scenario.id] ?? GENERIC;
  const seed = option.cvrSeed ?? genericSeed();

  const recontext =
    `{a|The same ${c.anchorNoun}} are committed under the plan you chose — it ${seed.rule}. ` +
    `What it trades away is {v|${c.valuePhrase[coord.violatedKey]}}: {f|${c.framingClause[coord.framing]}}.`;

  const stakeholder =
    `{w|${who.lead}} ${seed.identifiedCase}. {b|${seed.harm}.}`;

  const reendorseQuestion =
    `Knowing this — {a|the same ${c.anchorNoun}, only a different who} — would you {b|still choose this option}?`;

  return {
    coordinateKey: `${coord.violatedKey}|${coord.framing}|${coord.who}`,
    recontext,
    stakeholder,
    reendorseQuestion,
  };
}

/**
 * Returns the two framing clauses (context + directness) for a scenario, exactly as they appear
 * in the CVR vignette. Used by the dual-perspective comparison table so the participant sees the
 * precise wording of each lens when answering which one did / did not influence them.
 */
export function getCVRFramingClauses(scenario: Block5Scenario): Record<CVRFraming, string> {
  return (CONTENT[scenario.id] ?? GENERIC).framingClause;
}

/** Short label for who appeared (used by the Q2 stakeholder question + logging). */
export const WHO_LABEL: Record<SalienceWho, string> = {
  close: "someone close to you",
  group: "a directly affected group / professional",
  system: "the wider population",
};
