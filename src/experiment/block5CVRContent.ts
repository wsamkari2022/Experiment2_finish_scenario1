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
  { lead: "Imagine this patient is your mother.", label: "your mother" },
  { lead: "Imagine this patient is your father.", label: "your father" },
  { lead: "Imagine this patient is your son.", label: "your son" },
  { lead: "Imagine this patient is your daughter.", label: "your daughter" },
  { lead: "Imagine this patient is your spouse.", label: "your spouse" },
  { lead: "Imagine this patient is your best friend.", label: "your best friend" },
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
