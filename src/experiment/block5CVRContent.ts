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
const CLOSE_WHO: WhoVariant[] = [
  { lead: "Imagine this affected person is your mother.", label: "your mother" },
  { lead: "Imagine this affected person is your father.", label: "your father" },
  { lead: "Imagine this affected person is your son.", label: "your son" },
  { lead: "Imagine this affected person is your daughter.", label: "your daughter" },
  { lead: "Imagine this affected person is your spouse.", label: "your spouse" },
  { lead: "Imagine this affected person is your best friend.", label: "your best friend" },
];

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
    ],
    system: [
      { lead: "Another member of the allocation board, reviewing the outcome, reminds you the choice was yours to make:", label: "another member of the allocation board" },
      { lead: "The hospital manager points to the consequences of the policy you chose — and that the call was yours:", label: "the hospital manager" },
      { lead: "Someone else in charge weighs the consequences of your decision, and notes it was yours alone:", label: "someone else in charge" },
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
    ],
    system: [
      { lead: "Another member of the emergency-operations command reminds you the call was yours to make:", label: "another command member" },
      { lead: "The city's disaster-response director points to the consequences of the policy you chose — and that the decision was yours:", label: "the disaster-response director" },
      { lead: "Someone else in charge of the evacuation weighs the outcome of your decision, and notes it was yours alone:", label: "someone else in charge" },
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
    ],
    system: [
      { lead: "Another member of the water-response board reminds you the call was yours to make:", label: "another board member" },
      { lead: "The city public-health director points to the consequences of the policy you chose — and that the decision was yours:", label: "the public-health director" },
      { lead: "Someone else in charge of the response weighs the outcome of your decision, and notes it was yours alone:", label: "someone else in charge" },
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
    ],
    system: [
      { lead: "Another decision-maker, reviewing the outcome, reminds you the choice was yours:", label: "another decision-maker" },
      { lead: "Someone else in charge weighs the consequences of your decision, and notes it was yours alone:", label: "someone else in charge" },
    ],
  },
};

const CONTENT: Record<string, ScenarioCVRContent> = {
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

/** Short label for who appeared (used by the Q2 stakeholder question + logging). */
export const WHO_LABEL: Record<SalienceWho, string> = {
  close: "someone close to you",
  group: "a directly affected group / professional",
  system: "the wider population",
};
