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
 * The text carries lightweight {markup} so the UI can color the three CVR-cube dimensions:
 *   {a|…} same-numbers anchor (outcome-equivalence)   {v|…} the violated VALUE
 *   {f|…} the FRAMING (context/directness)            {w|…} WHO appears (salience)
 *   {b|…} plain bold (e.g. the harm)
 *
 * Scenario 1 (cancer) is authored concretely; other scenarios use a generic fallback and
 * each option's own `cvrSeed` (or a derived one). No scenario text lives in the logic.
 */

import { SHOW_LENS_VIGNETTES } from "./blocksLegacyMethodology";
import type {
  Block5PolicyDimKey, Block5Scenario, Block5ScenarioOption,
  CVRCoordinate, CVRFraming, CVRLensBlock, CVRStory, OptionCVRSeed, SalienceWho, WhoVariant,
} from "./block5Types";

/**
 * How serious a scenario is. The CONTEXT lens transplants a choice into another setting, and the
 * transplant is only valid if the second place is JUST AS SERIOUS as the first — otherwise a
 * participant who answers differently may be reacting to the change in stakes rather than the
 * change of setting, and the measure would be stakes sensitivity wearing context's name.
 * The validator fails if a scenario and its parallel disagree.
 */
export type CVRRegister = "everyday" | "life_and_death";

/** The parallel world a scenario's CONTEXT lens transplants the participant into. */
interface CVRParallelWorld {
  /** must equal the scenario's own register. */
  register: CVRRegister;
  /** the opening lines that set the scene, with the same shape of scarcity. */
  setting: string;
  /**
   * THE TWO TIME LABELS FOR THIS WORLD, when its clock is not the default one night.
   *
   * The scenario's own `horizon` must not be used here. Scenario 3 hands out a month's supply and
   * labels its consequences "Before the next batch"; its parallel is a flood rescue that is over
   * before morning, and a batch means nothing there. Each world is labeled by its own clock.
   */
  horizon?: { soon: string; later: string };
  /** what each of the four values looks like THERE — same meaning, that world's nouns. */
  valuePhrase: Record<Block5PolicyDimKey, string>;
  /**
   * THE FACT-FOR-FACT CORRESPONDENCE, one row per number, for the table on the APA page.
   *
   * The vignette is not allowed to say that the two worlds match; it prints both sets of numbers
   * and leaves the participant to see it. This is where that is finally made explicit — after the
   * choice and the reflection are over, so it cannot steer either.
   *
   * Authored rather than derived. The numbers appear in prose on both sides, in different
   * sentences and different orders, and any parser clever enough to pair them up would be one
   * rewording away from pairing them up wrongly.
   */
  mirror?: { here: string; there: string }[];
}

interface ScenarioCVRContent {
  /*
   * NO `anchorNoun`. It existed only to build the sentence "The same ${anchorNoun} are
   * committed under the plan you chose", and that sentence is gone — see CVRStory in
   * block5Types.ts. The vignette no longer announces that the numbers match. It prints them and
   * lets the participant notice.
   */
  valuePhrase: Record<Block5PolicyDimKey, string>;
  /**
   * WHAT EACH VALUE MEANS IN THIS SCENARIO, shown on the APA page under the value's general
   * definition as "In this scenario: …" (researcher, 18 September 2026).
   *
   * The general definitions ("how much harm is prevented") are the ones Blocks 1–4 and the results
   * page use, and they stay. But picking a value on the APA page is followed at once by "the
   * options that fit it", and a general definition did not always predict those: in scenario 3,
   * "Reducing harm" led to a draw. EACH LINE IS WRITTEN FROM THE OPTIONS THAT VALUE LEADS TO, so
   * what the participant reads before choosing is what they see after. If an option's value
   * numbers change, re-read these four lines against `optionMainValue` for that scenario.
   *
   * Written to follow "In this scenario:", lower case, no full stop, no option title.
   */
  valueHere?: Record<Block5PolicyDimKey, string>;
  framingClause: Record<CVRFraming, string>;
  /** how serious this scenario is — checked against parallel.register. */
  register?: CVRRegister;
  /** the impersonal agent the DIRECTNESS lens contrasts the participant against. */
  impersonalAgent?: string;
  /**
   * THE TWO TIME LABELS THE CONSEQUENCES SIT UNDER, when this scenario's clock is not one night.
   *
   * Defaults to "Within the hour" / "Before midnight", which is right for an escape and wrong for
   * an allocation: scenario 3 hands out a month's supply, and its real cost is the wait for the
   * next batch. A consequence reading "may wait another month" under a label reading "Before
   * midnight" contradicts itself on one line.
   *
   * The rule this serves is unchanged: a consequence must sit inside the scenario's own decision
   * cycle, near enough that a reader joins it to the choice. Only the length of that cycle differs.
   */
  horizon?: { soon: string; later: string };
  /**
   * THE DIRECTNESS LENS'S CLOSING LINE, when "the way you chose to leave" is the wrong verb.
   *
   * The default denies that a list or a system decided, and attributes the choice to the
   * participant's own departure. That is exactly right for an escape and wrong twice over for an
   * allocation: nobody leaves, and the option the participant picked may literally BE a list.
   *
   * Attribution is what this lens measures, so the sentence has to name something they actually
   * did. Whatever a scenario supplies here must still put the attribution LAST - see the note in
   * buildLens on why attribution before the content is an accusation and after it is a fact.
   */
  closingLine?: string;
  /** the equally-serious second setting the CONTEXT lens moves the same rule into. */
  parallel?: CVRParallelWorld;
}

/**
 * ============================================================================
 * THE THREE VOICES — one per stakeholder level, the same in every scenario
 * ============================================================================
 *
 * chooseWho() reads the participant's "Hearing someone's story" score and picks a level:
 *   under 40  -> close    someone they have known for twenty years
 *   40 to 69  -> group    someone they have known for a year
 *   70 plus   -> system   someone they have only just met
 *
 * The three differ ONLY in social closeness, which is exactly what the dimension measures. An
 * earlier version used a different cast in every scenario — nurses, drivers, transport planners —
 * chosen at random and not matched to the option, so a resident under a flight path could end up
 * objecting to a bus journey. Worse, the story that followed often named a DIFFERENT person than
 * the lead had just introduced. One voice per level removes both problems and lets a single story
 * sit correctly under any of the three.
 *
 * Two leads per level, because the person argues against whatever the participant just said:
 * after "yes" they report what the choice costs; after "no" they report what it would have given.
 *
 * EVERY LEAD OPENS WITH "Imagine", on the researcher's instruction, 18 September 2026. The person
 * is imagined: the page asks the participant to picture someone at that distance from them caught
 * in the situation, and to decide with that person in mind. Without the word, the page stated it
 * as fact, and in scenarios 3 and 4 it then contradicted the role box ("nobody close to you is on
 * the list", "nobody you know is a client"). With it, both are true: nobody you know is involved,
 * and you are asked to imagine that someone were. The roles were deliberately left as written.
 *
 * Only the leads changed. The label, which is what the database stores as stakeholder_text_shown,
 * did not, so records from before and after the change still compare on that field.
 *
 * THE HURT LEAD SAYS "is hurt by", not "is affected by" (researcher, 18 September 2026). "Affected"
 * can be good or bad, so a participant only learned which way the story went from its second
 * sentence, while the need lead had always said "would have helped them" at once. Both sides are
 * now equally clear from the first line.
 */
export interface VoiceLevel {
  /** who they are — used in the leads and in logging. */
  label: string;
  /** opening line when the person is HURT by the choice (shown after "yes"). */
  hurtLead: string;
  /** opening line when the person NEEDED the choice (shown after "no"). */
  needLead: string;
}

const VOICE: Record<SalienceWho, VoiceLevel> = {
  close: {
    label: "someone you have known for twenty years",
    hurtLead: "Imagine someone you have known for twenty years, and care about very much, is hurt by what you chose.",
    needLead: "Imagine someone you have known for twenty years, and care about very much, tells you this choice would have helped them.",
  },
  group: {
    label: "someone you have known for a year",
    hurtLead: "Imagine someone you have known for about a year, and might care about, is hurt by what you chose.",
    needLead: "Imagine someone you have known for about a year, and might care about, tells you this choice would have helped them.",
  },
  system: {
    label: "someone you have just met",
    hurtLead: "Imagine someone you have only just met is hurt by what you chose.",
    needLead: "Imagine someone you have only just met tells you this choice would have helped them.",
  },
};

const CANCER: ScenarioCVRContent = {
  register: "life_and_death",
  impersonalAgent: "the hospital's scheduling system",
  /* A month's supply, and no more for a month. See `horizon` on ScenarioCVRContent. */
  horizon: { soon: "The same day", later: "Before the next batch" },
  closingLine:
    "{f|No register and no scoring system decided this.} {b|You did.} If it happens, it happens "
    + "because of the rule you chose to hand them out by.",
  /*
   * ───────────────────────────────────────────────────────────────────────────────
   * THE PARALLEL WORLD IS A FLOOD RESCUE, AND IT WAS ALREADY RIGHT.
   *
   * Twenty places on the last helicopter against twenty doses; a hundred and twenty people on the
   * rooftops against a hundred and twenty eligible patients. Whoever wrote it had already solved
   * the hard part - it is a life-and-death shortage of exactly the same shape, and it is NOT A
   * HOSPITAL, which matters more here than anywhere else in the deck because scenario 3 IS one.
   *
   * WHAT PASS E ADDED, 17 September 2026: the numbers now carry {a|...} on both sides, the third
   * and fourth facts of the scenario have partners here (one month before more supply becomes one
   * more pass before the water is too high; a dose with a date on it becomes a winch that can only
   * lift so many times), and every option has an authored act rather than the generic fallback.
   *
   * THE MARKING IS WHAT DOES THE WORK THE BANNED WORD "SAME" USED TO DO. Twenty and a hundred and
   * twenty light up in the color the participant has been reading on their own situation box, and
   * the recognition is theirs to have or to miss. That is part of what the lens measures.
   * ───────────────────────────────────────────────────────────────────────────────
   */
  parallel: {
    register: "life_and_death",
    setting:
      "The water is still rising, and one helicopter is coming back for a last run. {a|Twenty} places on it. {a|A hundred and twenty} people are still on the rooftops. {a|One} more pass before the water is too high to hover. {a|One} winch, with only so many lifts left in it.",
    mirror: [
      { here: "{a|20} doses this month",
        there: "{a|Twenty} places on the last helicopter" },
      { here: "About {a|120} eligible patients",
        there: "{a|A hundred and twenty} people still on the rooftops" },
      { here: "{a|One} month before any further supply",
        there: "{a|One} more pass before the water is too high" },
      { here: "{a|One} batch of doses, with a date on them",
        there: "{a|One} winch, with only so many lifts left in it" },
    ],
    valuePhrase: {
      vulnerabilityProtectionSensitivity: "the people on those roofs who most need lifting",
      groupSizeSensitivity: "much of the larger crowd up there who could have been lifted",
      gainResponsivenessSensitivity: "the good one place on that helicopter could have done for somebody else",
      outcomeAggregationSensitivity: "the greater number those twenty places could have carried",
    },
  },
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the patients who most need protection",
    groupSizeSensitivity: "much of the larger group who could be reached",
    gainResponsivenessSensitivity: "the patients who would benefit the most",
    outcomeAggregationSensitivity: "the larger total benefit these doses could achieve",
  },
  valueHere: {
    vulnerabilityProtectionSensitivity: "treating first the patients who are sickest or hardest to reach",
    groupSizeSensitivity: "keeping as few patients as possible from losing their chance for good",
    gainResponsivenessSensitivity: "how many years of life the 20 doses add",
    outcomeAggregationSensitivity: "how many lives are saved, directly or through the people others depend on",
  },
  framingClause: {
    context:
      "the reason some patients rank lower here is context, not worth — late diagnosis, unequal access, and where people live shape the very numbers the rule uses",
    directness:
      "this is not the system deciding — your own rule is what redirects the doses away from them",
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
 *
 * CHEMICAL — the "alone" scenario. Its register is life_and_death, like every other scenario in
 * the deck. The two everyday scenarios it replaced (a travel booking and a dinner for four) were
 * retired because a scenario at a lower register cannot carry the CONTEXT lens: the transplant is
 * only valid between two settings of equal seriousness, and a participant answering differently
 * across a difference in stakes would be showing stakes sensitivity wearing context's name.
 */
const CHEMICAL: ScenarioCVRContent = {
  register: "life_and_death",
  impersonalAgent: "the district evacuation system's own priority list",
  /*
   * ────────────────────────────────────────────────────────────────────────────────────────────
   * THE PARALLEL WORLD IS AN AIRPORT. It was a hospital under a mass-casualty alert, and that was
   * wrong for a reason that has nothing to do with how it was written: SCENARIO 3 IS A HOSPITAL.
   * A participant met an invented hospital here and then a real one two scenarios later, and the
   * two would blur into each other in memory.
   *
   * THE NUMBERS ARE THE DISTRICT'S NUMBERS, WITH NOTHING SAYING SO. Six hours, about four
   * thousand people, one vehicle nobody is driving, one piece of breathing equipment, a list nine
   * long, one service lane past the hazard. Every fact in the scenario has a partner here. No
   * sentence points at the resemblance; the participant either notices or does not, and which of
   * those happens is part of what the lens measures.
   *
   * THE PERSON AND THE NUMBERS CARRY THEIR OWN COLORS, using two marks the block already has
   * rather than two new ones. {w|...} is the "who is affected" mark - violet, bold and italic -
   * and it is the same color a participant has been reading on the role card and in the
   * stakeholder voice since scenario 1 opened, so the person in the parallel world looks like a
   * person and not like scenery. {a|...} is the numbers anchor, gold and bold.
   *
   * MARKING THE NUMBERS DOES THE ONE JOB THE WORD "SAME" USED TO DO, without saying it. Six hours,
   * four thousand, one vehicle, one piece of breathing gear, nine on the list: they light up in
   * the same color the participant saw on their own situation box, and the recognition is theirs
   * to have or to miss.
   *
   * THE STAKES MATCH, which the validator enforces: a transplant is only valid between two
   * settings of equal seriousness, or a participant answering differently is showing stakes
   * sensitivity wearing context's name.
   * ────────────────────────────────────────────────────────────────────────────────────────────
   */
  parallel: {
    register: "life_and_death",
    setting:
      "An airport terminal is being cleared after a fuel spill on the runway. {a|Six hours} before the fumes reach the gates. About {a|four thousand} travelers are still inside. {a|One} shuttle bus is parked with nobody driving it. {a|One} escape hood sits in the first-aid cabinet. The boarding list is {a|nine} gates long, and {a|one} service lane runs past the spill.",
    mirror: [
      { here: "{a|6 hours} before the plume covers the district",
        there: "{a|Six hours} before the fumes reach the gates" },
      { here: "Around {a|4,000} residents still to move",
        there: "About {a|four thousand} travelers still inside" },
      { here: "{a|One} community minibus, parked with no driver",
        there: "{a|One} shuttle bus, parked with nobody driving it" },
      { here: "{a|One} clinic cabinet holding a single respirator",
        there: "{a|One} escape hood in the first-aid cabinet" },
      { here: "A convoy list {a|nine} streets long",
        there: "A boarding list {a|nine} gates long" },
      { here: "{a|One} service road running past the tanker",
        there: "{a|One} service lane running past the spill" },
    ],
    valuePhrase: {
      vulnerabilityProtectionSensitivity: "the travelers who most need protection from how this terminal is cleared",
      groupSizeSensitivity: "the many others in the terminal who depend on these same few ways out",
      gainResponsivenessSensitivity: "the good this one way out could have done for everything it costs",
      outcomeAggregationSensitivity: "the larger total this terminal could have reached for everyone in it",
    },
  },
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the people who most need protection from the way this district is being cleared",
    groupSizeSensitivity: "much of the wider district that shares these routes and depends on them",
    gainResponsivenessSensitivity: "the good this escape could have done for everything it costs",
    outcomeAggregationSensitivity: "the larger overall good this escape could have done for everyone it touches",
  },
  valueHere: {
    vulnerabilityProtectionSensitivity: "making sure the people who cannot get out on their own still can",
    groupSizeSensitivity: "keeping the risk your choice puts on everyone else as low as possible",
    gainResponsivenessSensitivity: "how quickly and how surely you yourself get out",
    outcomeAggregationSensitivity: "how many other people get out because of what you do",
  },
  framingClause: {
    context:
      "the reason some streets sit further down the list is where the freight line was routed, not what the people on them are worth — the yard was built against the cheapest housing in the district",
    directness:
      "this is not the evacuation system deciding — your own hands are what move this escape's cost onto them",
  },
};

/**
 * WILDFIRE — the "self and dependents" scenario. Same construction rules as CHEMICAL and the
 * three allocation scenarios: every value phrase names something that can genuinely be given up,
 * and the framing clauses speak about the people behind the numbers rather than about the options.
 */
const WILDFIRE: ScenarioCVRContent = {
  register: "life_and_death",
  impersonalAgent: "the valley's automated evacuation staging",
  /*
   * ───────────────────────────────────────────────────────────────────────────────
   * THE PARALLEL WORLD IS A PASSENGER SHIP BEING ABANDONED, 17 September 2026.
   *
   * WHAT IT REPLACED. A cargo ship listing in heavy weather, with three facts in it and no numbers
   * at all - one lift-equipped boat, one held davit, one clear ladder. The valley has eight hours,
   * six hundred people, nine blocks, nine slots, a lift bus, a road held for crews and a refuge
   * reached on foot. Three nouns cannot mirror seven facts, so the transplant had nothing to carry
   * and the lens was asking the participant to notice a resemblance that was not on the page.
   *
   * WHY A PASSENGER SHIP AND NOT A CARGO ONE. The valley's whole shape is now social: the blocks
   * run in order of how near the junction each one sits, and the big houses on the shelf have their
   * own road and never needed a slot. A ship carrying passengers has exactly that shape already -
   * decks, boat groups, and a stair cut for the suites at the top - and it has it without anybody
   * having to explain it. A cargo ship has a crew and no class structure to mirror.
   *
   * NOT THE TITANIC, DELIBERATELY. The researcher named it as an example of scale and it is the
   * right scale. It is the wrong ship. A participant who recognizes the Titanic brings a century of
   * script with them - women and children first, the locked gates, the band - and that script does
   * the persuading instead of the structure doing it. Worse, it arrives with a verdict on the class
   * question already reached, which is the exact variable this lens exists to put in front of them
   * unsettled. A large modern ship gives identical machinery and no verdict.
   *
   * SIX FACTS, SIX PARTNERS, AND NOT ONE SENTENCE SAYING SO. The numbers carry {a|...} on both
   * sides, which is the only thing doing the work the banned word "same" used to do.
   *
   * THE STAKES MATCH, which the validator enforces: both are life_and_death. A transplant between
   * two settings of unequal seriousness measures stakes sensitivity wearing context's name.
   * ───────────────────────────────────────────────────────────────────────────────
   */
  parallel: {
    register: "life_and_death",
    setting:
      "A cruise ship is listing after a flood below her waterline. {a|Eight hours} before she goes down. About {a|six hundred} passengers are spread across {a|nine} decks, and they are called to the boats in {a|nine} groups. {a|One} boat is lowered by hoist, for the passengers who cannot climb down to it. {a|One} crew stair was cut for the top-deck suites and is held tonight for the crew. The open deck above is reached by {a|one} ladder, too narrow to carry anybody up.",
    mirror: [
      { here: "{a|8 hours} before the front reaches the valley floor",
        there: "{a|Eight hours} before the ship goes down" },
      { here: "Around {a|600} residents across {a|nine} blocks",
        there: "About {a|six hundred} passengers across {a|nine} decks" },
      { here: "{a|Nine} timed slots on one highway out",
        there: "{a|Nine} boat groups on one boat deck" },
      { here: "{a|One} bus with a wheelchair lift",
        there: "{a|One} boat lowered by hoist" },
      { here: "{a|One} ridge road, cut for the big houses, held for crews",
        there: "{a|One} crew stair, cut for the top-deck suites, held for the crew" },
      { here: "{a|One} refuge reached only on foot",
        there: "{a|One} open deck reached only by ladder" },
    ],
    valuePhrase: {
      vulnerabilityProtectionSensitivity: "the passengers who most need protection from how these boats are filled",
      groupSizeSensitivity: "the many others aboard who depend on these few ways down",
      gainResponsivenessSensitivity: "the good one place in a boat could have done for somebody else aboard",
      outcomeAggregationSensitivity: "the larger total this ship could have reached for everyone still on it",
    },
  },
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the people who most need protection from the way this valley is emptying",
    groupSizeSensitivity: "much of the wider valley that shares these roads and depends on them",
    gainResponsivenessSensitivity: "the good this evacuation could have done for everything it costs",
    outcomeAggregationSensitivity: "the larger overall good this evacuation could have done for everyone it touches",
  },
  /*
   * THE CONTEXT CLAUSE NOW RECALLS A FACT INSTEAD OF INTRODUCING ONE, 17 September 2026.
   *
   * It used to say the ridge road was cut for the estates above the treeline — and nothing in the
   * scenario said so. A claim about WHY some households sit further back was therefore appearing
   * for the first time in the reflection: after the choice, under the most persuasive conditions
   * the block has, and only for the participants whose choice had been judged misaligned.
   *
   * The fact moved into `factBase`, where everyone meets it before choosing: the blocks are ordered
   * by how near the junction each one sits, the participant's is fifth, and the big houses on the
   * shelf have their own road and never needed a slot. The clause below now points back at
   * something the participant has already read, which is both fairer and much harder to argue with.
   *
   * ITS VOCABULARY IS PINNED TO THE SITUATION BOX: big houses, the shelf, near the junction. If the
   * scene wording changes, this has to change with it, or the reflection will be recalling a fact
   * in words the participant never saw.
   */
  valueHere: {
    vulnerabilityProtectionSensitivity: "making sure the neighbors least able to leave are not left until last",
    groupSizeSensitivity: "keeping the risk your household puts on everyone else as low as possible",
    gainResponsivenessSensitivity: "how quickly and how safely your own household gets out",
    outcomeAggregationSensitivity: "how many people get out of the valley because of your choice",
  },
  framingClause: {
    context:
      "the reason your slot is fifth and somebody else's is ninth is how near the junction their family could afford to live, not what they are worth — and the big houses on the shelf never needed a slot at all",
    directness:
      "this is not the staging system deciding — your own vehicle is what moves this evacuation's cost onto them",
  },
};

const GENERIC: ScenarioCVRContent = {
  register: "everyday",
  impersonalAgent: "a standard procedure",
  parallel: {
    register: "everyday",
    setting: "The same shortage, somewhere else entirely, with the same amount to go around.",
    valuePhrase: {
      vulnerabilityProtectionSensitivity: "the people who most need protection",
      groupSizeSensitivity: "much of the larger group who could be reached",
      gainResponsivenessSensitivity: "the people who could have been helped most easily",
      outcomeAggregationSensitivity: "the greater number this could have reached",
    },
  },
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
};

const CARE: ScenarioCVRContent = {
  register: "life_and_death",
  impersonalAgent: "the scheduling system",
  /* A three-month cut. See `horizon` on ScenarioCVRContent. */
  horizon: { soon: "The first week", later: "Before the three months are out" },
  /*
   * THE PARTICIPANT SETS A SCHEDULE; THEY DO NOT LEAVE ANYWHERE. The default closing line ends on
   * "the way you chose to leave", written for the two escapes. See `closingLine`.
   *
   * It still says YOU DID, although this scenario is set under a principle the employer published.
   * That is deliberate and it matches the directness framing clause below ("this is not head office
   * deciding"): the under-authority manipulation asks whether the participant owns the principle or
   * defers to it, and this lens is where they are told the schedule is theirs.
   */
  closingLine:
    "{f|No scheduling system decided this.} {b|You did.} If it happens, it happens because of the "
    + "schedule you chose to set.",
  /*
   * ───────────────────────────────────────────────────────────────────────────────
   * THE PARALLEL WORLD IS A WINTER NIGHT SHELTER, AND ITS NUMBERS NOW MATCH, 17 September 2026.
   *
   * THE WORLD WAS RIGHT AND THE NUMBERS WERE NOT. A shelter losing a quarter of its capacity in the
   * cold is the same shape as a care service losing a quarter of its hours, it is life and death,
   * and it collides with no other scenario's parallel (an airport, a ship, a flood rescue). But it
   * had 200 people where the scenario has 240, beds where the scenario has hours, two weeks where
   * the scenario has three months, and "a two weeks of hard frost" as a sentence.
   *
   * THE SCARCE THING IS NOW STAFF TIME ON BOTH SIDES, cut by a quarter for three months, with a
   * share of it spent on overhead: driving between homes there, paperwork and handovers here. That
   * is what lets "redraw the routes to cut the driving" transplant at all.
   *
   * AND THE REVENUE FACT HAS A PARTNER: city-paid beds and donation-run beds, as the scenario has
   * city-contract routes and pay-by-visit routes. Without it "drop the rural routes" has nothing
   * to become over here.
   *
   * The clock is the parallel's own — see `horizon` on CVRParallelWorld. A night shelter's first
   * cost lands on the first night, not in the first week.
   * ───────────────────────────────────────────────────────────────────────────────
   */
  parallel: {
    register: "life_and_death",
    horizon: { soon: "The first night", later: "Before the cold months end" },
    setting:
      "A winter night shelter has lost a quarter of its funding. {a|240} people rely on it, and {a|40} staff keep it open. {a|1,600} staff-hours a week, cut to {a|1,200} for the {a|three} coldest months. About {a|500} of those hours go to paperwork and handovers. The city pays for some of the beds, and the rest run on donations that no longer cover them.",
    mirror: [
      { here: "{a|240} clients",
        there: "{a|240} people who rely on the shelter" },
      { here: "{a|40} caregivers",
        there: "{a|40} staff" },
      { here: "{a|1,600} caregiver-hours a week, cut to {a|1,200}",
        there: "{a|1,600} staff-hours a week, cut to {a|1,200}" },
      { here: "About {a|500} of those hours spent driving",
        there: "About {a|500} of those hours on paperwork and handovers" },
      { here: "For the next {a|three} months",
        there: "For the {a|three} coldest months" },
    ],
    valuePhrase: {
      vulnerabilityProtectionSensitivity: "the people who would not survive a night outside",
      groupSizeSensitivity: "much of the larger group who could have been let in",
      gainResponsivenessSensitivity: "the funding that keeps the doors open at all",
      outcomeAggregationSensitivity: "the greater number those staff-hours could have sheltered",
    },
  },
  valuePhrase: {
    vulnerabilityProtectionSensitivity: "the clients who have nobody else at all",
    groupSizeSensitivity: "much of the larger group who could have kept their visits",
    gainResponsivenessSensitivity: "the money that keeps the service running",
    outcomeAggregationSensitivity: "the greater number of clients these hours could reach",
  },
  valueHere: {
    vulnerabilityProtectionSensitivity: "protecting the clients who have nobody else at home",
    groupSizeSensitivity: "making the cut land where someone else can step in, so it hurts least",
    gainResponsivenessSensitivity: "keeping the service paid for and open next year",
    outcomeAggregationSensitivity: "keeping as many clients as possible visited, as often as possible",
  },
  framingClause: {
    context:
      "the reason some clients rank lower here is where they live and who they happen to have nearby — not how much they need you",
    directness:
      "this is not head office deciding — the schedule you set is what takes the hours off them",
  },
};

/*
 * Only the DECIDER scenario has an entry. `care_rota_receiving` deliberately has none: it runs
 * with decisionRole "recipient", so no reflection ever fires there and content for it would be
 * dead weight that still had to pass every content gate. If it were ever reached by accident,
 * GENERIC covers it rather than throwing.
 */
const CONTENT: Record<string, ScenarioCVRContent> = {
  chemical_release_escape: CHEMICAL,
  wildfire_household_evacuation: WILDFIRE,
  cancer_treatment_allocation: CANCER,
  care_rota_reduction: CARE,
};

function genericSeed(): OptionCVRSeed {
  return {
    rule: "follows the rule you chose",
    identifiedCase: "Some of those your choice leaves unprotected are the people who can least absorb the harm",
    harm: "They bear the cost while help goes elsewhere",
  };
}

/** Remembers the last voice index per "scenarioId|who" so we never repeat it twice in a row. */

/**
 * Pick a stakeholder voice at random for this scenario + salience level, avoiding an immediate
 * repeat of the last voice used for the same (scenario, level). Call ONCE per misaligned
 * selection (not on every render) so the chosen voice stays stable while the participant reads.
 */
/**
 * The voice for this participant's stakeholder level. No longer random: with one voice per level
 * there is nothing to choose between, so the same participant hears the same kind of person all
 * the way through Block 5. That consistency is what makes a change of mind attributable to the
 * PERSON rather than to which voice happened to come up.
 */
export function pickWhoVariant(_scenario: Block5Scenario, who: SalienceWho): WhoVariant {
  const v = VOICE[who];
  return { lead: v.hurtLead, label: v.label };
}

/** The opening line for a voice, on the side that argues against the participant. */
export function voiceLead(who: SalienceWho, side: "hurt" | "need"): string {
  const v = VOICE[who];
  return side === "hurt" ? v.hurtLead : v.needLead;
}

/** Short label for a voice, used by the follow-up questions and by logging. */
export function voiceLabel(who: SalienceWho): string {
  return VOICE[who].label;
}


export function getCVRStory(
  scenario: Block5Scenario,
  option: Block5ScenarioOption,
  coord: CVRCoordinate,
  who: WhoVariant,
): CVRStory {
  const c = CONTENT[scenario.id] ?? GENERIC;
  const seed = option.cvrSeed ?? genericSeed();

  const stakeholder =
    `{w|${who.lead}} ${seed.identifiedCase}. {b|${seed.harm}.}`;

  /*
   * The question no longer repeats the numbers.
   *
   * It used to read "Knowing this — the same 20 doses, only a different who — would you still
   * choose this option?", while the paragraph above had ALREADY said "The same 20 doses are
   * committed under the plan you chose". The same fact twice on one short page is noise, and the
   * page is now carrying a lens as well. The anchor is stated once, at the top.
   */
  const reendorseQuestion = `Would you {b|still choose this}?`;

  /* The two people, for the page that follows the yes/no. Neither appears on the vignette page. */
  const people = {
    // "They" supplies the subject the lead does not carry, so every case below is written to
    // agree with it. Without this the page read "...is affected by what you chose: is unwell".
    hurt: `{w|${voiceLead(coord.who, "hurt")}} They ${seed.identifiedCase}. {b|${seed.harm}.}`,
    need: seed.benefitCase && seed.benefitLost
      ? `{w|${voiceLead(coord.who, "need")}} They ${seed.benefitCase}. {b|${seed.benefitLost}.}`
      : `{w|${voiceLead(coord.who, "need")}} this option would have made a real difference to them. {b|Refusing it takes that away.}`,
  };

  return {
    coordinateKey: `${coord.violatedKey}|${coord.framing}|${coord.who}`,
    stakeholder,
    reendorseQuestion,
    people,
    lens: SHOW_LENS_VIGNETTES ? buildLens(c, seed, coord) : undefined,
  };
}

/**
 * The lens, made visible.
 *
 * CONTEXT — between contexts only. The participant's own rule, their own numbers, running in a
 * second setting of EQUAL seriousness (the matched register is enforced by the validator). Only
 * the place changes, which is exactly what this dimension is defined to vary.
 *
 * DIRECTNESS — within one context, direct harm. The same place, the same numbers, the same people
 * missed; what changes is whose hand did it. An impersonal process could have produced the very
 * same list, and did not.
 *
 * Both are the same shape and roughly the same length, so neither is persuasive merely by being
 * bigger than the other.
 */
function buildLens(
  c: ScenarioCVRContent,
  seed: OptionCVRSeed,
  coord: CVRCoordinate,
): CVRLensBlock {
  /*
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * TWO RULES NOW GOVERN BOTH LENSES. Set by the researcher, 16 September 2026.
   *
   * 1. NEITHER LENS MAY SAY "SAME". No "same", no "also", no "just like", no "too". The old text
   *    told the participant that the numbers matched, which did the noticing for them. Both
   *    lenses now simply PRINT the numbers, the method and the trade-off, and leave the
   *    recognition to the reader. Whether they make the connection is part of what is being
   *    measured; a sentence announcing it destroys that.
   *
   * 2. NOTHING HAPPENS MORE THAN 24 HOURS LATER. The old second consequence sat weeks or months
   *    out — "three weeks in hospital", "still unwell in the spring" — and one of them left smoke
   *    hanging over a district for three weeks, which a reader simply does not believe. A reader
   *    who stops believing the page stops engaging with any of it.
   *
   *    THE COST OF THIS, STATED HONESTLY. The directness lens was built on a gap: show a harm far
   *    enough away in time that nobody would connect it to a decision made this afternoon, then
   *    attribute it. Inside a day that gap mostly closes and the lens hits a little softer. The
   *    trade is worth it, because a vivid harm nobody believes is worth less than a smaller one
   *    they do.
   *
   * BOTH ALSO NAME THE TRAVEL METHOD, which is now printed on the option card. "You take the
   * wheel of the district minibus" is a fact the participant can check against the card they
   * just clicked. "You picked this option" is not.
   *
   * CONSEQUENCES ARE WRITTEN WITH "MAY" AND "COULD", not as certainties. Nobody knows what
   * happens next, and a page that predicts the future in the indicative is making a claim it
   * cannot support — which is also the first thing a careful reader stops trusting.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  if (coord.framing === "context") {
    /*
     * CONTEXT — the same rule, running somewhere else, with nobody blamed.
     *
     * WHAT THIS REPLACED. The previous version transplanted the rule correctly but then said what
     * it costs in the abstract: "What it trades away there is the patients who most need protection
     * from how the ward is cleared." That is a CATEGORY of person, not an outcome. A participant
     * had nothing to react to except a phrase, so the lens tested how a sentence was worded rather
     * than whether the setting changed their answer.
     *
     * It now shows the same two consequences the directness lens shows — same shape, same time
     * labels, comparable length — but they happen in the second setting, and no sentence anywhere
     * says the participant caused them.
     *
     * THAT OMISSION IS THE WHOLE INSTRUMENT. Context and directness are compared against each
     * other, so they must differ in exactly ONE respect. Here that respect is authorship: the
     * directness block ends with "You did"; this one ends with nobody at all. If this block also
     * pointed at the participant it would be a second directness lens wearing another name, and
     * the difference between the two measures would mean nothing.
     */
    const p = c.parallel;
    const rule = seed.parallelRule ?? seed.rule;
    const pc = seed.parallelConsequences;
    return {
      framing: "context",
      heading: "Somewhere else tonight",
      /*
       * `parallelAct` is the authored version: a whole sentence naming what somebody does there,
       * with the method in it. The older construction is kept as a fallback so scenarios that have
       * not been rewritten yet still build — see docs/BLOCK5_SCENARIO_AUDIT_CHECKLIST.md.
       */
      body: seed.parallelAct && p
        ? `${p.setting} ${seed.parallelAct}`
        : p
          ? `${p.setting} A rule decides there too — it ${rule}.`
          : `A shortage of the very same shape, somewhere else entirely, where a rule would ${rule}.`,
      /* THE PARALLEL WORLD'S OWN CLOCK, never the scenario's - see `horizon` on CVRParallelWorld. */
      points: pc
        ? [
            { label: p?.horizon?.soon ?? "Within the hour", text: `{b|${pc.soon}}` },
            { label: p?.horizon?.later ?? "Before midnight", text: `{v|${pc.later}}` },
          ]
        : undefined,
      /*
       * IT CLOSES ON NOTHING, and that silence is the instrument.
       *
       * There was a closing line here: "A different place, a different night, and nobody to blame
       * for how it ends." It was removed on the researcher's instruction, and the instruction is
       * the right one. A sentence insisting nobody is to blame raises blame as surely as naming
       * somebody would, and it told the reader what to feel about a scene that should have been
       * left to speak for itself.
       *
       * NO "YOU" ANYWHERE IN THIS BLOCK either. The directness lens ends by naming the
       * participant; this one ends. If this block also pointed at them it would be a second
       * directness lens under another name, and the difference between the two measures would
       * mean nothing.
       */
    };
  }
  /*
   * DIRECTNESS — what this option does, and who made it happen.
   *
   * WHAT THIS REPLACED, AND WHY. The previous version was one abstract paragraph, identical on
   * every option: "If the booking site's default had produced this list, the same people would be
   * missed — and nobody would have chosen them. It did not produce it. You did." It named no
   * person, no consequence and no number. It asked the participant to follow a counterfactual
   * about a system that never acted, in order to arrive at a feeling of authorship. Participants
   * reported not understanding what it was about, and that is the correct reaction: there was
   * nothing concrete in it to understand.
   *
   * The lens now does the thing its name promises. It shows the harm this specific option causes —
   * once immediately, once long enough afterwards that nobody would still connect it to a decision
   * made on a Tuesday — and only then attributes it. Consequence first, authorship second. The
   * order matters: attribution before content is an accusation, attribution after content is a
   * fact the participant can check.
   *
   * LANGUAGE. Short sentences, ordinary words, one idea each. Participants read this in a second
   * language, and a lens nobody can parse measures reading ability rather than moral response.
   */
  const cons = seed.consequences;
  return {
    framing: "directness",
    heading: "What your choice does",
    body: seed.act
      ?? "You picked this option. Here is what it does to other people — the part you were not "
        + "shown when you picked it.",
    points: cons
      ? [
          { label: c.horizon?.soon ?? "Within the hour", text: `{b|${cons.soon}}` },
          { label: c.horizon?.later ?? "Before midnight", text: `{v|${cons.later}}` },
        ]
      : undefined,
    /*
     * ATTRIBUTION LAST, NEVER FIRST. Attribution before the content is an accusation the reader
     * braces against; attribution after it is a fact they can check against what they just read.
     */
    prompt: c.closingLine
      ?? "{f|No list and no system decided this.} {b|You did.} If it happens, it happens because of "
         + "the way you chose to leave.",
  };
}

/**
 * The two worlds side by side, or nothing when this scenario has not been given a mirror.
 *
 * Only scenarios whose CONTEXT lens has been rewritten carry one. The APA table simply does not
 * render for the others, which is the correct behavior rather than a gap: a scenario with no
 * authored mirror has no second world worth tabulating.
 */
export function getCVRMirror(scenario: Block5Scenario): { here: string; there: string }[] {
  return (CONTENT[scenario.id] ?? GENERIC).parallel?.mirror ?? [];
}

/** The "In this scenario" line for each value on the APA page, or null for a scenario with none. */
export function getCVRValueHere(scenario: Block5Scenario): Record<Block5PolicyDimKey, string> | null {
  return CONTENT[scenario.id]?.valueHere ?? null;
}

/**
 * Both lenses for the same option and the same violated value, so the dual-perspective question
 * can show the participant the two views they actually read rather than a summary of them.
 * Only the framing differs between the pair — everything else is held constant, which is what
 * makes "which of these moved you?" a fair question.
 */
export function getCVRLensPair(
  scenario: Block5Scenario,
  option: Block5ScenarioOption,
  coord: CVRCoordinate,
): Record<CVRFraming, CVRLensBlock> {
  const c = CONTENT[scenario.id] ?? GENERIC;
  const seed = option.cvrSeed ?? genericSeed();
  return {
    context: buildLens(c, seed, { ...coord, framing: "context" }),
    directness: buildLens(c, seed, { ...coord, framing: "directness" }),
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
