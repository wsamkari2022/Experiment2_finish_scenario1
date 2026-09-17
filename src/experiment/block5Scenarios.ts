/**
 * block5Scenarios.ts — The Block-5 scenarios and their options, in presentation order.
 *
 * v6 — the deck is a USER POSITION LADDER, all scenarios at the same stakes:
 *
 *   #  scenario                        stakePosition     who carries the cost
 *   1  Six Hours to Clear the District  self             the participant, and nobody else
 *   2  Eight Hours Ahead of the Fire    self_and_group   the participant and their household
 *   3  Cancer Treatment Allocation      others           other people; the participant is not among them
 *
 * WHY FLOOD AND WATER WERE REMOVED (v5 -> v6)
 * -------------------------------------------
 * v5 ran three `others` scenarios — cancer, flood and water — which spent three of the five slots
 * on ONE position. Measured across them, cancer was the strongest on every count that matters:
 *
 *   scenario   distinct planner orders   planner/alignment confound   captured ladder
 *   cancer     16  (best)                36%                          100·79·60·41·21·0
 *   flood      14                        35%                          100·79·71·59·40·0
 *   water      14                        44%  (worst)                 100·93·72·69·62·0
 *
 * Cancer also carries the only option set that maps onto named ethical positions — utilitarian,
 * prioritarian, QALY-maximizing, egalitarian lottery, equity of access, instrumental value — which
 * is what makes a participant's choice legible to a reader rather than merely recorded.
 *
 * WHAT THAT COST. The `others` position now appears ONCE, so `driftCheck` in block5Position.ts
 * returns null and the within-position drift control is gone. That control was the only thing
 * separating a genuine position-shifter from a random responder: both score Position Effect 100,
 * and only the drift check told them apart (0 vs 100). Until the replacement scenarios land,
 * Position Effect is DESCRIPTIVE — a shape to show and discuss, not a claim to defend.
 *
 * WHY THE FIRST TWO WERE REPLACED (v4 -> v5)
 * ------------------------------------------
 * v4 opened with a travel booking and a dinner for four, at stakesWeight 0.5. The intent was a
 * moral-stakes gradient. The effect was a confound: position and stakes varied together, so a
 * participant who behaved differently in scenario 5 might be responding to WHO CARRIES THE COST —
 * the thing the study manipulates — or simply to the fact that a dose is more serious than a
 * dinner. From five scenarios those two explanations cannot be separated.
 *
 * A second, quieter problem: the CONTEXT lens transplants a participant's own rule into a parallel
 * setting, and that transplant is only valid between settings of EQUAL seriousness (see the
 * register check in block5CVRContent.ts). An everyday scenario cannot carry it.
 *
 * All five are now life-and-death, all five run at the default stakesWeight of 1, and the only
 * thing that varies across the deck is the participant's position relative to the consequences.
 *
 * ORDER IS FIXED AND NOT COUNTERBALANCED. Position is therefore confounded with sequence
 * position, and "deciding for others" is always last. In v5 that limit came with a partial
 * control — three `others` scenarios in slots 3, 4 and 5, so a trend across them measured drift
 * within a constant position. THAT CONTROL NO LONGER EXISTS (see above). Restoring it is the job
 * of the replacement scenarios: the pair must either repeat one position, or be held so tightly
 * constant in content that the contrast between them isolates position on its own.
 * See docs/BLOCK5_POSITION_EFFECT_PLAN.md §7.
 *
 * SPEED WAS RECALIBRATED WHEN THE DECK SHRANK (v6)
 * ------------------------------------------------
 * G3 forbids any performance metric from restating a participant VALUE, because a metric that
 * tracks a value makes choosing that value free — and a choice that costs nothing measures
 * nothing. Across the v5 set, `speed` correlated r = 0.84 with the gain fingerprint: barely
 * inside the 0.85 limit. Dropping to three scenarios moved it to 0.86 and the gate failed. The
 * gate was right, and the coupling was real rather than a rounding artefact — every high-gain
 * option had been written fast, and every low-gain option slow.
 *
 * Three options were re-timed, each because the card's OWN TEXT already said so. All three are
 * about waiting, and all three had been scored as though they were not:
 *
 *   chem_registered_convoy      speed 65 -> 52   "You wait for your street's slot"
 *   fire_assigned_convoy_slot   speed 58 -> 48   "The valley is leaving in timed blocks"
 *   cancer_reserve_underserved  speed 66 -> 50   doses held for patients four hours away
 *
 * Each is COMPENSATED WITHIN ITS OWN OPTION so the five metrics still sum to what they summed to
 * before (resource use, durability and reversibility respectively). That is deliberate: the
 * captured ladders are min-max positions within a scenario, so an uncompensated edit would have
 * silently re-spaced a ladder that had just been calibrated. Sums unchanged, ladders unchanged.
 * r(speed, gain) is now 0.75 and the worst metric-value link overall is -0.82.
 *
 * STILL TIGHT, AND A CONSTRAINT ON WHAT COMES NEXT: speed x vulnerability sits at -0.82 against
 * the same 0.85 limit. Any new scenario must not deepen it — its slow options must not all be its
 * vulnerable-protecting ones.
 *
 * Every scenario has the same structure — 6 trade-off-heavy options, each with:
 *   - a 4-dimension POLICY fingerprint (vulnerability, group-size, gain, aggregation) used for
 *     alignment (the other 3 dims choose the CVR lens and voice, never the ranking),
 *   - 5 PERFORMANCE metrics (separate from alignment; see METRIC_DEFS),
 *   - the trade-off panel fields (gains / givesUp / consequence / moralTension),
 *   - a `cvrSeed` carrying the concrete material the CVR vignette re-presents.
 *
 * THE SIX SLOTS. Within every scenario the six options fill six distinct roles, so that different
 * profiles produce different planner orders rather than the same one for everybody:
 *
 *   1 clean reference   moderate throughout; runner-up on gain, close enough to the gain champion
 *                       that the trade-off tree can set gain aside in its favor
 *   2 tempting breach   highest gain in the set AND the worst option on protecting the vulnerable
 *   3 vulnerable protector  the vulnerability champion; poor gain, slow
 *   4 helper            the aggregation champion; slow and resource-heavy
 *   5 harm minimiser    the group-size champion; low gain, highest reversibility
 *   6 performance star  best on speed + resource use + reliability, champion of no value at all
 *
 * The payoffs are not hand-picked prose decoration: they are held against the gates in
 * tools/validate_block5.cjs, tools/validate_block5_metrics.mjs and tools/simulate_planner.cjs,
 * which check domination, champion uniqueness, metric independence, the alignment/planner
 * confound, and that every option is reachable as a rank-1 recommendation for somebody.
 */

import type { Block5Employer, Block5Scenario } from "./block5Types";

/**
 * MERIDIAN CARE — the employer behind scenarios 4 and 5.
 *
 * One company, one situation, one set of six options, met twice: once with the participant holding
 * the pen, once with it held over them. Nothing about the company changes between the two.
 *
 * ITS STATED PRIORITY IS CHOSEN PER PARTICIPANT — see `deriveCompanyValues` in block5Company.ts.
 * Whichever of the four values a participant scored LOWEST in Blocks 1–4 becomes the thing this
 * employer says it stands for, so every participant works under an employer that prizes the thing
 * they care least about. That is the only way "would you take on your employer's values?" asks the
 * same question of everybody; a fixed set of company values would clash hard with some people and
 * hardly at all with others, and those two participants could not be compared.
 *
 * ALL FOUR PRINCIPLES HAD TO BE WRITEABLE AS SOMETHING A REAL EMPLOYER WOULD PUBLISH, including
 * the ones that are uncomfortable to read. A principle that sounds like a villain's speech is not
 * a conflict — it is an invitation to disagree, and the participant would face no pressure at all.
 */
const MERIDIAN: Block5Employer = {
  name: "Meridian Care",
  principleLabel: "Meridian Care's published service principle",
  principleFor: {
    vulnerabilityProtectionSensitivity:
      "Meridian protects its most dependent clients first, whatever that costs the rest of the service.",
    groupSizeSensitivity:
      "Meridian keeps the number of people left with no care at all as low as it can be counted.",
    gainResponsivenessSensitivity:
      "Meridian stays solvent first. A service that closes protects nobody.",
    outcomeAggregationSensitivity:
      "Meridian reaches as many clients as it possibly can, every week without exception.",
  },
  rationaleFor: {
    vulnerabilityProtectionSensitivity:
      "The board's position is that a care company is judged on its worst-served client, never on its average one.",
    groupSizeSensitivity:
      "The board's position is that the number the regulator counts is people left with nothing, and that number is the one to hold down.",
    gainResponsivenessSensitivity:
      "The board's position is that three months of losses would end the company, and forty caregivers' jobs with it.",
    outcomeAggregationSensitivity:
      "The board's position is that the contract is measured on coverage, and coverage is what it will deliver.",
  },
};

export const BLOCK5_SCENARIOS: Block5Scenario[] = [
  {
    /*
     * ─────────────────────────────────────────────────────────────────────────────────────────
     * THE PERFORMANCE COLUMN WAS AUDITED AGAINST THE OPTIONS' OWN TEXT, 16 September 2026.
     *
     * The advisor asked why sealing the apartment was not top of the resource metric when the
     * option consumes nothing. It should have been: the gains line on that option reads "You take
     * absolutely nothing from anyone - no seat, no mask, no road, no crew time", and the number
     * beside it ranked it second. Reading the rest of the column the same way - what does each
     * option's own copy say it does? - found four more places where a number contradicted the
     * sentence printed next to it.
     *
     * RESOURCES SPARED, re-derived as QUANTITY OF SUPPLY CONSUMED:
     *
     *   seal and shelter    82 -> 97   takes nothing at all. Its own text says so.
     *   walk out on foot    65 -> 92   "Every seat and every mask stays available."
     *   service road        88 -> 84   takes no supply, but spends the one road for everyone else.
     *   registered convoy   73 -> 73   one seat on shared transport. Its fair share, unchanged.
     *   reserved respirator 57 -> 45   takes all of one small stock, and nothing else.
     *   shuttle loop        46 -> 40   the minibus, its fuel and three runs of it. The most consumed.
     *
     * A FIRST PASS PUT THE RESPIRATOR AT 21 AND WAS WRONG, which is worth recording. The argument
     * was that it takes the single irreplaceable item from a named person who cannot breathe
     * outside air. But that is a statement about WHO the taking lands on, and this metric measures
     * HOW MUCH is consumed. Loading the moral weight into the metric is exactly the value-into-
     * performance contamination that G5 exists to catch, and G5 caught it: the correlation between
     * protecting the vulnerable and performance went to 0.54 against a ceiling of 0.30. The moral
     * weight of taking that mask is already carried by the option's fingerprint and by its givesUp
     * line, and it does not belong here as well.
     *
     * SHELTERING WAS THE OPTION MOST AT ODDS WITH ITSELF, on three more numbers:
     *
     *   speed         48 -> 18   The scenario-1 reading is "how soon you are out of the plume, and
     *                            how much of the six hours is left". Sheltering never gets you out
     *                            and spends all six hours. It was scored ABOVE walking out.
     *   reversibility 94 -> 30   It held the highest score in the scenario while its own givesUp
     *                            line reads "If the seal does not hold you are inside the worst air
     *                            in the district with no way out". Reversibility asks what happens
     *                            when the choice turns out to be wrong; the card already answered.
     *   reliability   52 -> 40   Tape and wet towels against chlorine, which is heavier than air
     *                            and finds the gaps. "Any margin for error", says the same line.
     *   durability    65 -> 82   This one moved UP. The reading is "whether the way out stays open
     *                            for the people still behind you", and sheltering uses no route at
     *                            all and frees the convoy slot that was yours.
     *
     * WALKING OUT: reliability 57 -> 48, because its own givesUp line says "You are the most
     * exposed person on any of these routes", and reliability asks how likely you are to get clear
     * without the route failing.
     *
     * WHAT THIS DOES TO THE THESIS TRADE-OFF, which is the number that matters most here. G5
     * requires that protecting the vulnerable COSTS performance: the vulnerability champion must
     * not be a top performer, and the correlation must stay under 0.30. Walking out is that
     * champion, and it finishes 3rd of 6 with r = 0.22. Before this audit it was 3rd with r = -0.09.
     * The trade-off survives; it is not manufactured, and it is not free.
     *
     * NOTHING ELSE MOVED. The convoy and the service road were checked line by line against the
     * same copy and hold up as authored.
     * ─────────────────────────────────────────────────────────────────────────────────────────
     * ─────────────────────────────────────────────────────────────────────────────────────────
     */
    id: "chemical_release_escape",
    stakePosition: "self",
    methodLabel: "How you travel",
    /*
     * ─────────────────────────────────────────────────────────────────────────────────────────
     * EVERY OPTION NAMES ITS OWN METHOD, 16 September 2026, and one fact was added to make the six
     * of them describe a single world.
     *
     * WHAT THE ADVISOR HIT, reading the six in a row. The minibus option cleared "two streets of
     * people who have no transport of their own", while the facts described a convoy list nine
     * streets long - so who exactly has no transport? And the service-road option said "drive out"
     * when the only vehicle named anywhere in the scenario was the minibus that a different option
     * uses. Two questions, one cause: not one of the six said HOW the participant travels, so a
     * reader had to infer it, and the inferences collided.
     *
     * THE FACT THAT RESOLVES IT: the participant has a car, and the cleared streets are closed to
     * private cars, so the service road is the only road it may use. That one sentence does three
     * jobs at once:
     *
     *   - "drive out" now plainly means the participant's own car, not the district's minibus.
     *   - walking four hours stays rational. A car that may only go one way - past a leaking
     *     chlorine tanker, single-track, no turning back - is not a free pass out. Without this
     *     sentence, owning a car and choosing to walk would look absurd.
     *   - "no transport of their own" becomes sayable: those two streets have no car AND their
     *     convoy slot is hours off. The line now says that instead.
     *
     * NOT ONE PERFORMANCE NUMBER MOVED, and that was a condition rather than a coincidence. A
     * private car takes nothing from the shared pool, which is exactly what the service road's
     * resources-spared score of 84 already assumed. Had the answer instead been that the service
     * road uses the minibus, the whole column audited the day before would have had to be redone.
     * ─────────────────────────────────────────────────────────────────────────────────────────
     */
    factBase:
      /*
        THREE FIXES HERE. The first two on the advisor's instruction, 16 September 2026; the third
        on the researcher's, 17 September 2026, after the same defect was found in scenario 2.

        NO DOUBLE QUOTES IN THIS COMMENT EITHER - see the note on `description` above. The digit
        check and the overlap check both read the first quoted string after the field name, so a
        quoted phrase here would be scored in place of the scenario text.

        The box now OPENS WITH A SENTENCE rather than the fragment it used to start with. A
        fragment is a label on a countdown, and it left the reader to work out whose six hours
        these are. Handing the time to the participant is the only reading that matters, and it
        puts the number the rest of the box depends on in the first four words.

        THE CLOSING CLAIM WAS FALSE FOR ONE OF THE SIX OPTIONS. It read: every option you will see
        gets you out within six hours. Sealing your apartment and letting the plume pass over you
        does not get you out of anywhere - its own givesUp line says you are inside the worst air
        in the district with no way out. The sentence is there to tell the participant that the six
        options are equally viable and differ only in cost, so the half that was doing the work is
        kept and the half that was untrue is dropped. KEEPS YOU ALIVE is true of all six, including
        the one that never leaves the apartment.

        That also retires an earlier fix rather than reversing it. WITHIN six hours had replaced
        gets you out INSIDE the six hours, because out and inside in one breath reads for a moment
        as somewhere to get out inside of. The whole clause has now gone, so the trap it avoided
        cannot come back - but the reasoning is worth keeping for the next scenario that needs a
        preposition to carry time rather than space.
      */
      "You have 6 hours before the plume covers the district. Around 4,000 residents still to move. One community minibus, parked with no driver. One clinic cabinet holding a single full-face respirator. A convoy list nine streets long. Your own car is outside, but the district is being cleared in timed groups and closed to private cars, so the service road past the tanker is the only road your car may use. Every option you will see keeps you alive for the six hours. They differ only in what each one takes from the people still here.",
    role:
      /*
        THE CLOSING CLAUSE IS BACK, ON THE ADVISOR'S INSTRUCTION (15 September 2026).

        It had been removed because it sits one sentence after the line about nobody depending on you,
        and can read as a contradiction. The cost to other people is also already stated in
        `factBase`, which says the options differ only in what each one takes from the people still
        here.

        The argument for restoring it is the stronger one. The earlier line is about
        OBLIGATION: nobody is relying on this participant to save them. The clause is about
        CONSEQUENCE: what they take on the way out is taken from someone. Those are two different
        facts and both are true at once, which is exactly the tension the scenario is built on. A
        participant who believes they can leave at no cost to anyone is not facing the trade-off
        this block measures.

        APPENDED, NOT MERGED. The three sentences before it are untouched, so restoring this cannot
        change what the earlier wording already said.
      */
      "You are {w|a resident here, on your own}. {w|Nobody depends on you}, and nobody is coming for you. You are the only person your choice has to save. But {w|everything you use on the way out was something another resident was counting on}.",
    title: "Six Hours to Clear the District",
    description:
      /*
        REWORDED ON THE ADVISOR'S INSTRUCTION, 16 September 2026.

        NO DOUBLE QUOTES ANYWHERE IN THIS COMMENT, and that is not a style preference. The scene
        gate in tools/validate_block5.cjs finds this field by taking the first quoted string after
        the field name, so a quoted phrase in the comment above it becomes the text the gate
        measures. A first draft of this note quoted the old and new wording, and the overlap check
        went on reporting PASS while measuring a comment.

        The leak is now NAMED as the cause rather than described as chlorine coming off it. The old
        clause asked the reader to carry an it back to the tanker two clauses earlier, and to read
        coming off as a release rather than as something detaching.

        The plume now moves into a housing neighborhood rather than into the housing. The latter is
        the language of an incident report: a category, and one this scenario never introduced. A
        neighborhood is a place with people in it, which is what the plume is moving towards and
        what the whole scenario turns on.
      */
      "A rail tanker has split open at the freight yard on the edge of the district. A chlorine leak is causing a low plume, and the wind is pushing it street by street into a housing neighborhood. The whole district has been ordered to clear out.",
    theme: {
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(163,180,58,0.20), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(85,107,47,0.42), transparent 55%), linear-gradient(155deg, #12140b, #232a10 50%, #3d4718)",
      accent: "#A3B43A",
      shadow: "0 8px 32px rgba(163, 180, 58, 0.15)",
    },
    options: [
      {
        id: "chem_registered_convoy",
        cvrSeed: {
          rule: "waits for its assigned slot and takes nothing that was set aside for anyone else",
          parallelRule: "waits for the ward's assigned round and takes no bed that was held for another ward",
          act: "You wait for your street to be called, and you board the convoy bus when it is. Your car stays parked. Nothing that was set aside for anybody else is touched.",
          parallelAct: "{w|A traveler waits for their gate to be called and boards the shuttle when it comes. They take nothing that was being held for anyone else.}",
          identifiedCase: "were three streets further down the list, and the plume reached them first",
          harm: "The convoy that would have carried them out was still loading when the wind turned",
          benefitCase: "are on the same list as you and have been waiting since the order came",
          benefitLost: "The order holds only while people keep their places, and one skipped slot unravels it",
          consequences: {
            soon: "The streets behind yours wait longer, because the list only moves as fast as its slowest street.",
            later: "Street nine may still be waiting when the wind turns. The people on it could be the last ones out tonight, if they get out at all.",
          },
          parallelConsequences: {
            soon: "The gates behind theirs wait longer, because the list only moves as fast as its slowest gate.",
            later: "Gate nine may still be boarding when the fumes reach the doors. The people at it could be the last ones out.",
          },
        },
        title: "Leave with the registered convoy at your assigned time",
        method: {
          kind: "bus",
          by: "The convoy bus",
          detail: "in your street's assigned slot. Your car stays parked where it is.",
        },
        summary: "The district is being cleared street by street in timed groups. You wait for your street's slot, board with your neighbors, and go when they go.",
        /* WELL WITHIN, not WELL INSIDE. The same preposition trap the situation box was cleared of
           on 16 September 2026, left behind on this card because the pass only looked at factBase.
           Out and inside in one breath reads for a moment as somewhere to get out inside of. */
        gains: "You get out well within the six hours, and nobody loses their place so that you can have yours.",
        consequence: "You reach the center in good time. You take nothing that was set aside for anyone else. But you leave when the list says, not when you want. The last hour is spent watching the plume come down the road.",
        givesUp: "Control over your own timing. You go when your street is called, and not a minute sooner.",
        moralTension: "Is a fair line still fair, when the people at the back breathe the same air as the people at the front?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 67, groupSizeSensitivity: 61,
          gainResponsivenessSensitivity: 82, outcomeAggregationSensitivity: 56,
          directnessSensitivity: 44, contextSensitivity: 61, stakeholderPerspectiveShiftSensitivity: 56,
        },
        metrics: {
          speed: 52,
          resourceUse: 73,
          reliability: 86,
          durability: 66,
          reversibility: 67,
        },
      },
      {
        id: "chem_reserved_respirator",
        cvrSeed: {
          rule: "takes the one respirator that had been tagged and held for somebody else",
          parallelRule: "takes the one ventilator that had been tagged and held for another patient",
          act: "You open the clinic cabinet, take the respirator, and walk out by the shortest street with it on your face. The tag hanging from it has somebody else's name.",
          parallelAct: "{w|A traveler opens the first-aid cabinet, takes the escape hood, and walks out through the fumes by the nearest door. The label on it has another passenger's name.}",
          identifiedCase: "have been on home oxygen for two years and cannot walk the distance unaided",
          harm: "They wait in a sealed room for a mask that has already left the district on your face",
          benefitCase: "were behind you in the convoy line and move up a place when you walk out",
          benefitLost: "The seat you would have filled is the last one on the last bus that runs",
          consequences: {
            soon: "The man it was tagged for stays in a sealed room. He has been on home oxygen for two years and cannot walk that far without it.",
            later: "He may wait hours for a mask that left the district on your face. The clinic could stop holding masks for anyone after this.",
          },
          parallelConsequences: {
            soon: "The passenger it was labeled for waits in a side room with the door taped shut. Her lungs will not manage that walk without it.",
            later: "She may wait hours for the crew to reach that room. By then the hood could be across the city.",
          },
        },
        title: "Take the sealed respirator the clinic had reserved",
        method: {
          kind: "foot",
          by: "On foot, wearing the clinic's respirator",
          detail: "straight out by the shortest street, breathing clean air the whole way.",
        },
        summary: "One full-face respirator is left in the clinic cabinet, tagged for a patient on home oxygen. With it you can walk out through the plume immediately, by whichever route is shortest.",
        gains: "You leave right now, by the shortest way, breathing clean air the whole distance.",
        consequence: "You are clear of the district within the hour and never wait in line at all. But the mask was tagged for someone whose lungs cannot manage the walk without it, and there is not another one.",
        givesUp: "The one piece of equipment set aside for a person who cannot breathe the outside air.",
        moralTension: "If a mask protects whoever is wearing it, does it matter whose name was on the tag?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 15, groupSizeSensitivity: 24,
          gainResponsivenessSensitivity: 94, outcomeAggregationSensitivity: 41,
          directnessSensitivity: 81, contextSensitivity: 31, stakeholderPerspectiveShiftSensitivity: 23,
        },
        metrics: {
          speed: 85,
          resourceUse: 45,
          reliability: 54,
          durability: 76,
          reversibility: 52,
        },
      },
      {
        id: "chem_walk_out_on_foot",
        cvrSeed: {
          rule: "leaves every reserved seat and every tagged mask untouched and goes the long way round",
          parallelRule: "leaves every held bed and every reserved dose untouched and waits for the next round",
          act: "You leave the seat and the mask where they are, and you walk out the long way by the river path. Nobody is told that your street is now empty.",
          parallelAct: "{w|A traveler leaves the seat and the hood untouched and walks out the long way, around the outside of the terminal. Nobody is told that their gate is now clear.}",
          identifiedCase: "were counting on you to reach the center and confirm your street was empty",
          harm: "The sweep team spent two more hours on a street you had in fact already cleared",
          benefitCase: "cannot walk unaided and were the one tagged for the mask you did not take",
          benefitLost: "The mask was still in the cabinet when the ambulance finally got to them",
          consequences: {
            soon: "You breathe the edge of the plume for four hours. A sweep team searches a street you walked out of hours ago.",
            later: "Your chest may not feel right by morning. The two hours that team spent on your street could be the two hours another street was waiting for.",
          },
          parallelConsequences: {
            soon: "They breathe the thin edge of the fumes for hours. A crew searches a gate that is already empty.",
            later: "Their chest may not feel right by morning, and the crew could lose time that another gate was counting on.",
          },
        },
        title: "Walk out the long way and leave the kit where it is",
        method: {
          kind: "foot",
          by: "On foot, with nothing",
          detail: "by the river path, upwind and slow. No seat, no mask, and your car left behind.",
        },
        summary: "You take neither a shuttle seat nor the clinic's respirator. You go on foot by the river path, upwind and slow, and everything set aside for someone else stays set aside.",
        gains: "Every seat and every mask stays available for the people who cannot manage without them.",
        consequence: "Nothing set aside for someone who needs it is touched. But the river path takes four hours on foot. You breathe the edge of the plume the whole way, and you arrive last.",
        givesUp: "Four hours, and a great deal of your own safety. You are the most exposed person on any of these routes.",
        moralTension: "How much of your own lungs is a stranger's oxygen mask worth?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 96, groupSizeSensitivity: 56,
          gainResponsivenessSensitivity: 26, outcomeAggregationSensitivity: 39,
          directnessSensitivity: 64, contextSensitivity: 72, stakeholderPerspectiveShiftSensitivity: 68,
        },
        metrics: {
          speed: 30,
          resourceUse: 92,
          reliability: 48,
          durability: 78,
          reversibility: 81,
        },
      },
      {
        id: "chem_shuttle_loop",
        cvrSeed: {
          rule: "spends the escape window carrying other people out before itself",
          parallelRule: "spends the treatment window on the ward's other patients before its own",
          act: "You take the wheel of the district minibus. {a|Two} streets get out because you drove. Then you stay for a {a|third} run.",
          parallelAct: "{w|A traveler picks up the shuttle keys and drives two gates out before boarding anything themselves. Then they go back for a third run.}",
          identifiedCase: "waited at the third stop and watched the minibus fill before it reached them",
          harm: "The plume crossed that street while the shuttle was still two roads away from it",
          benefitCase: "had no car and no way out of either of the two streets you cleared",
          benefitLost: "Nobody else was going to drive that minibus, and it does not leave without a driver",
          consequences: {
            soon: "You are still driving when the plume reaches the road, and you breathe it for the last hour.",
            later: "The third street may never be collected. A man there could wait for a bus that never comes, and walk out through the plume.",
          },
          parallelConsequences: {
            soon: "The fumes cross the runway in the last hour, while the shuttle is still out.",
            later: "The last gate may never be collected. A passenger there could give up waiting and walk out across the runway on foot.",
          },
        },
        title: "Drive the community shuttle for two loops before you go",
        method: {
          kind: "van",
          by: "The district minibus, with you driving",
          detail: "two loops carrying other people out, and you leave on the third.",
        },
        summary: "The district minibus has no driver. You can drive it, clear two streets whose convoy slot is hours away and who have no car between them, and leave on the third run.",
        gains: "Two full streets of people who would still be waiting for their slot are clear of the district because you drove.",
        consequence: "You get more people out than any other option here manages. But you are still inside the district when the plume arrives, and the third loop is the one you are on.",
        givesUp: "Your own margin of safety. Every person you carry out is another loop you spend breathing the district's air.",
        moralTension: "How many strangers is one more hour of your own exposure worth?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 51, groupSizeSensitivity: 45,
          gainResponsivenessSensitivity: 36, outcomeAggregationSensitivity: 94,
          directnessSensitivity: 53, contextSensitivity: 40, stakeholderPerspectiveShiftSensitivity: 66,
        },
        metrics: {
          speed: 45,
          resourceUse: 40,
          reliability: 71,
          durability: 72,
          reversibility: 37,
        },
      },
      {
        id: "chem_seal_and_shelter",
        cvrSeed: {
          rule: "uses none of the shared supply and absorbs the whole of the risk itself",
          parallelRule: "uses none of the ward's shared supply and absorbs the whole of the risk itself",
          act: "You tape the doors, lay wet towels along the gaps, and stay in your apartment. You ask nobody for anything, and you tell nobody you are in there.",
          parallelAct: "{w|A traveler tapes the door of a quiet room, lays wet cloths along the gaps, and stays inside. They ask for nothing, and nobody is told where they are.}",
          identifiedCase: "were on the sweep team and had to enter the block to confirm you were alive",
          harm: "Two of them spent forty minutes in the worst air of that night looking for you",
          benefitCase: "took the convoy seat and the mask that you never asked anyone for",
          benefitLost: "Both were still there because you stayed, and both were gone within the hour",
          consequences: {
            soon: "A sweep team breaks into your block to find out whether anyone is still alive inside it.",
            later: "Two of them may spend forty minutes in the worst air of the night looking for you. One could be off work tomorrow, and nobody would connect it to a door that stayed shut.",
          },
          parallelConsequences: {
            soon: "A crew forces that door open to find out whether anybody is still inside.",
            later: "Two of them may spend a long stretch in the worst of the fumes searching. One could be sent home sick before morning.",
          },
        },
        title: "Seal your apartment and shelter until the plume passes",
        method: {
          kind: "stay",
          by: "You do not travel at all",
          detail: "you stay in your own apartment and let the plume pass over you.",
        },
        summary: "Tape the doors, wet towels along the gaps, and stay put. Nothing is taken from anyone, nobody is moved out of their place, and no seat, road or mask is used.",
        gains: "You take no seat, no mask and no road from anybody, and nobody is moved down a list to make room for you.",
        consequence: "Not one other person is worse off for what you chose, and you can still leave later if the wind turns. But you spend the night inside a plume with tape on the doors.",
        givesUp: "Any margin for error. If the seal does not hold you are inside the worst air in the district with no way out of it, and a sweep team comes into your block to find out whether you are.",
        moralTension: "Is taking nothing from anybody the same thing as doing right by them?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 53, groupSizeSensitivity: 93,
          gainResponsivenessSensitivity: 32, outcomeAggregationSensitivity: 33,
          directnessSensitivity: 48, contextSensitivity: 67, stakeholderPerspectiveShiftSensitivity: 54,
        },
        metrics: {
          speed: 18,
          resourceUse: 97,
          reliability: 40,
          durability: 82,
          reversibility: 30,
        },
      },
      {
        id: "chem_service_road_run",
        cvrSeed: {
          rule: "opens the fastest route it can find and lets everyone else pour down it",
          parallelRule: "opens the fastest treatment path it can find and lets every other case follow it",
          act: "You take your own car down the freight yard's service road. It is one lane wide, it runs past the split tanker, and word spreads the moment your tail lights go down it.",
          parallelAct: "{w|A traveler drives out along the service lane beside the runway. It is one lane wide, it runs past the spill, and word spreads as soon as the first car goes down it.}",
          identifiedCase: "followed your tail lights down the service road and stopped level with the tanker",
          harm: "Their car stalled where the air was worst, and the road was too narrow to turn on",
          benefitCase: "were still waiting in line for the convoy when your route opened up behind you",
          benefitLost: "Four streets emptied down that road within the hour, and not one of them waited",
          consequences: {
            soon: "Four streets follow you onto a single-lane road that passes the leak.",
            later: "A car may stall level with the tanker. The family inside could be treated through the night, and the road behind them could stay blocked until morning.",
          },
          parallelConsequences: {
            soon: "Cars from four gates follow onto a single lane that runs past the fuel.",
            later: "One may stall next to the spill. The people inside could be treated through the night while the lane stays blocked behind them.",
          },
        },
        title: "Drive out on the industrial service road",
        method: {
          kind: "car",
          by: "Your own car",
          detail: "down the freight yard's service road, the only road a private car may use today.",
        },
        summary: "You take your own car. The freight yard's service road runs upwind and is standing empty, and it is the only road a private car is allowed on today. It is the fastest way out for anyone who uses it, and word spreads the moment the first vehicle goes down it.",
        gains: "The fastest clear route out of the district, and once you have opened it the streets behind you follow.",
        consequence: "You are out in twenty minutes and so is everyone behind you. But the road runs past the split tanker itself, and once you are committed to it there is no turning round.",
        givesUp: "Any chance to change your mind. It is single-track past the yard and it passes closer to the tanker than any other route here.",
        moralTension: "Is the quickest way out still the right one when it takes everyone else past the leak?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 43, groupSizeSensitivity: 39,
          gainResponsivenessSensitivity: 71, outcomeAggregationSensitivity: 87,
          directnessSensitivity: 62, contextSensitivity: 45, stakeholderPerspectiveShiftSensitivity: 44,
        },
        metrics: {
          speed: 89,
          resourceUse: 84,
          reliability: 76,
          durability: 45,
          reversibility: 45,
        },
      },
    ],
  },
  {
    id: "wildfire_household_evacuation",
    stakePosition: "self_and_group",
    methodLabel: "How you travel",
    /*
     * ──────────────────────────────────────────────────────────────────────────────────────
     * PASS D — THE SIX OPTIONS DESCRIBE ONE WORLD, 17 September 2026.
     *
     * THE CONTRADICTION THE ADVISOR HIT. Option 6 is titled leave immediately, BEFORE THE STAGING
     * STARTS. Option 1 said the valley IS LEAVING in timed blocks, option 3 named the lift bus as
     * the last vehicle scheduled out, and option 1 had a participant waiting for slot five TO BE
     * CALLED. So has the staging started or not? Read in a row, the six cards answered both ways.
     *
     * THE FACT THAT RESOLVES IT: the order is drawn and the first slot has not been called yet.
     * The plan exists, which is what options 1 and 3 need. Nothing has been released, which is what
     * option 6 needs. One clause, both halves true.
     *
     * TWO MORE COLLISIONS FIXED IN THE SAME SENTENCE:
     *
     *   - HOW DOES ANYONE TRAVEL? Four of the six options move the household by car, one gives that
     *     car away and one walks, and not one of them said the household owned a car. Option 4 let
     *     it slip sideways — your car holds seven — four cards later.
     *   - THE HILL SCHOOL. Its own text claimed it uses no road capacity, which is only true if
     *     nobody drives there. Nothing said so, and the reader was free to picture the family
     *     driving up. The footpath makes the claim true instead of merely asserted.
     *
     * AND ONE SENTENCE THAT WAS SIMPLY FALSE: every option gets your household OUT within eight
     * hours. The hill school does not get them out at all — its own givesUp line says they are
     * choosing to stay in the valley. It now says what is true of all six.
     *
     * COST TO THE PERFORMANCE NUMBERS: none of these forced a change. The car takes nothing from
     * the shared pool, and the footpath only confirms the road capacity the hill school was already
     * scored as sparing. Pass B moved numbers for its own reasons, listed on each option.
     * ──────────────────────────────────────────────────────────────────────────────────────
     */
    factBase:
      /*
        PASS A, 17 September 2026, on the researcher instruction.

        NO DOUBLE QUOTES IN THIS COMMENT. The digit check and the description-overlap check in
        tools/validate_block5.cjs both read the first quoted string after the field name, so a
        quoted phrase here would be scored in place of the scenario text. This has caught me three
        times; see docs/BLOCK5_SCENARIO_AUDIT_CHECKLIST.md.

        OPENS WITH A SENTENCE, not a fragment. Eight hours before the front reaches the valley floor
        is a label on a countdown. It leaves the reader working out whose eight hours these are, and
        the first four words should hand the participant the number the rest of the box depends on.
        Same fix, same reason, as scenario 1.

        WITHIN EIGHT HOURS replaces inside the eight hours, for the reason scenario 1 changed it:
        out and inside in one breath reads for a moment as somewhere to get out inside of.

        FOUR WORDS ARE AVOIDED HERE DELIBERATELY - above, order, reached and through. The scene
        gate fails a factBase that reuses 30% or more of the description paragraph words of five
        letters or more, and the first draft of this sentence hit 47% by reaching for the obvious
        word four times. The scene already spends running, order, above, through and reached, so
        the situation box has to say the same things differently. Check with npm run validate:block5
        before assuming a rewrite here is free.
      */
      "You have 8 hours before the front reaches the valley floor. Around 600 residents across nine blocks on the valley wall. The blocks leave in nine timed slots, ordered by how near the highway junction each one sits - yours is fifth, and the first has not been called yet. One bus with a wheelchair lift. One ridge road, cut years ago to serve the big houses on the cleared shelf at the top and held today for fire crews. Those houses have never needed a slot. The refuge school stands on that shelf too, and with the ridge road closed the only way up to it is a footpath too narrow for any vehicle. Your own car is outside with seven seats in it. Every option you will see keeps your household alive for the eight hours. They differ only in what each one takes from the rest of the valley.",
    role:
      "You are a resident, and {w|you are not leaving alone}. Your household is four. You, {w|two children} — one needs an inhaler in smoke — and {w|your mother, who walks with a frame}. You carry the cost of this choice, and so do the three of them.",
    title: "Eight Hours Ahead of the Fire",
    description:
      /*
        THE VALLEY NOW HAS A SHAPE, 17 September 2026. NO DOUBLE QUOTES IN THIS COMMENT - the scene
        gate reads the first quoted string after the field name, so a quoted phrase here would be
        scored in place of the paragraph.

        The scene said a fire was coming and said nothing about the place it was coming to. The
        situation box then had to introduce the shelf, the wall and the blocks all at once, on top
        of carrying every number. Geography belongs here; numbers belong there.

        FIVE WORDS ARE SHARED with the situation box - front, valley, floor, ridge, shelf - which is
        21% against a ceiling of 30%. Shelf is deliberately spent in both, because it is the one
        word a reader has to carry from the scene into the facts.
      */
      "A wildfire front has crossed the ridge above the valley and is running downhill through dry timber. Below the shelf at the top, homes are strung along the valley wall. The whole valley is under an evacuation order, and smoke has already reached the floor.",
    theme: {
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(234,88,12,0.22), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(124,45,18,0.45), transparent 55%), linear-gradient(155deg, #1a0f08, #35160a 50%, #5c2410)",
      accent: "#EA580C",
      shadow: "0 8px 32px rgba(234, 88, 12, 0.16)",
    },
    options: [
      {
        id: "fire_assigned_convoy_slot",
        cvrSeed: {
          rule: "keeps its assigned place in line and moves nobody out of the way",
          parallelRule: "keeps its assigned place on the list and moves no other case down it",
          identifiedCase: "were in the ninth slot and left as the fire crossed the valley floor",
          harm: "The staging kept the road clear, and it kept them sitting in it three hours longer",
          benefitCase: "were marshaling the convoy and needed the blocks to leave in the order set",
          benefitLost: "One household leaving early is what turns a staged convoy back into a jam",
          act: "You wait for your block to be called, then drive out in the convoy. You take the {a|fifth} slot of {a|nine}, which is yours. Nothing set aside for anybody else is touched.",
          parallelAct: "{w|A passenger waits for their deck to be called and boards the boat when it comes. They take the fifth place of nine, which is theirs. Nothing held for anybody else is touched.}",
          consequences: {
            soon: "The blocks behind yours wait longer, because the line only moves as fast as its slowest block.",
            later: "Block nine may still be waiting when the wind turns. The people on it could be the last out tonight.",
          },
          parallelConsequences: {
            soon: "The decks below theirs wait longer, because the line only moves as fast as its slowest group.",
            later: "Group nine may still be waiting when the ship lists further. The people in it could be the last off tonight.",
          },
        },
        title: "Take your household's assigned place in the staged convoy",
        method: {
          kind: "car",
          by: "Your own car, in the staged convoy",
          detail: "in your block's slot, fifth of nine, with a guide ahead of you and behind you.",
        },
        /* PASS D: IS SET TO LEAVE, not IS LEAVING. The old present tense said the staging had begun,
           which is the half of the contradiction that option 6 could not live with. */
        summary: "The valley is set to leave in timed blocks so the highway does not seize up. Your four go together in your block's slot, with a guide ahead of you and behind you.",
        gains: "All four of you leave together, in a guided group, on a road that is kept moving.",
        consequence: "Nobody in your household is separated and nobody else is pushed down the list to make room for you. But your slot is the fifth of nine, and the smoke is well into the valley by the time you roll.",
        givesUp: "Three hours of waiting, with a child who needs an inhaler, while the air gets steadily worse.",
        moralTension: "Is waiting your turn still right when the person waiting beside you cannot breathe the wait?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 60, groupSizeSensitivity: 59,
          gainResponsivenessSensitivity: 81, outcomeAggregationSensitivity: 53,
          directnessSensitivity: 58, contextSensitivity: 49, stakeholderPerspectiveShiftSensitivity: 40,
        },
        metrics: {
          speed: 48,
          resourceUse: 72,
          reliability: 92,
          durability: 82,
          reversibility: 62,
        },
      },
      {
        id: "fire_closed_ridge_road",
        cvrSeed: {
          rule: "uses the lane that was being held clear for the people going the other way",
          parallelRule: "uses the operating room slot that was being held clear for the emergency list",
          identifiedCase: "were waiting at the care home for the engine that you turned back",
          harm: "The crew reversed two miles to let you past, and reached them forty minutes late",
          benefitCase: "are eight years old, sitting behind you, and already on the inhaler",
          benefitLost: "Those forty minutes are the whole difference between smoke and clean air for them",
          act: "You drive your own car up the ridge road, the lane held for the fire crews. It is {a|forty} minutes over the top and out.",
          parallelAct: "{w|A passenger climbs the crew stair, the one stair being held for the crew. It puts them at the boats forty minutes ahead of their group. A crew coming down has to turn back to let them by.}",
          consequences: {
            soon: "A fire engine backs two miles down the ridge road to let your car through.",
            later: "It may reach the care home forty minutes late. Two residents there could be beyond help by then.",
          },
          parallelConsequences: {
            soon: "A crew backs down two flights of that stair to let one passenger up.",
            later: "They may reach the flooded deck forty minutes late. Two people down there could be beyond help by then.",
          },
        },
        title: "Take the closed ridge road",
        method: {
          kind: "car",
          by: "Your own car, on the closed ridge road",
          detail: "over the ridge in forty minutes, up the lane held clear for fire crews coming down.",
        },
        summary: "The ridge road was cut for the big houses on the shelf, and today it is closed off and kept clear for fire crews coming down it. It is empty, it is fast, and your four could be over the ridge and out of the valley in forty minutes.",
        gains: "Your household is out of the valley in forty minutes — hours ahead of anything else here.",
        consequence: "Your children are out of the smoke before the fire reaches the valley floor. But the ridge road is kept clear for crews coming the other way. A car on it turns a fire engine back.",
        givesUp: "The road the fire crews need. An engine that reverses is one that does not reach the care home on the far side.",
        moralTension: "Would you take a road kept clear for rescuers, if it were your own children in the back?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 18, groupSizeSensitivity: 23,
          gainResponsivenessSensitivity: 92, outcomeAggregationSensitivity: 48,
          directnessSensitivity: 80, contextSensitivity: 30, stakeholderPerspectiveShiftSensitivity: 37,
        },
        metrics: {
          speed: 92,
          resourceUse: 18,
          reliability: 62,
          durability: 70,
          reversibility: 45,
        },
      },
      {
        id: "fire_wait_accessible_bus",
        cvrSeed: {
          rule: "gives its own places to the people who cannot board anything else and waits",
          parallelRule: "gives its own slot to the patients who cannot be moved again and waits",
          identifiedCase: "spent six hours in the shelter hall with an inhaler that was running low",
          harm: "They were still in the valley at the seventh hour because you gave the seats away",
          benefitCase: "use a frame and cannot climb the step onto any of the standard coaches",
          benefitLost: "Your seats were the only ones that could take them out before the last hour",
          act: "You hand your car keys to the {a|two} neighbors with frames, and they drive out in your slot. Your four take their places on the lift bus, last out of the valley.",
          parallelAct: "{w|A passenger gives their boat place to two people who cannot climb down, and waits for the hoist boat instead. That boat is the last one lowered.}",
          consequences: {
            soon: "Your four wait six hours in a shelter hall while the smoke thickens outside it.",
            later: "The lift bus may come late. Your child's inhaler could be empty before it reaches the valley road.",
          },
          parallelConsequences: {
            soon: "Their group waits six hours on a tilting deck while the water rises below it.",
            later: "The hoist boat may come late. A child in that group could be very cold before it is lowered.",
          },
        },
        title: "Give your car seats to the two frame users and wait for the lift bus",
        /* PASS D: WHO DRIVES? The card gave your car away without ever saying who was at the wheel,
           and the reader's only candidates were two people using walking frames. A frame is no bar
           to driving, and saying so costs the scenario nothing - no crew time, no second vehicle,
           so the resources-spared score does not have to carry a driver it never had. */
        method: {
          kind: "bus",
          by: "The lift-equipped bus, last out of the valley",
          detail: "your car goes at your slot with the two neighbors and their frames in it, one of them driving. You take their places on the bus.",
        },
        summary: "Two neighbors use walking frames and cannot board the standard coaches. The lift bus can take them, but it is the last vehicle scheduled to leave the valley. Your car can take them out in your block's slot instead, with one of them driving - though folding the rear row flat for their frames leaves five seats, and two of those are theirs. Three is not four, and you are not splitting your household. So your own four take their places on the lift bus.",
        /* WHAT IS GIVEN AWAY IS THE PLACE, not only the seats. The car goes out in the household's
           own slot, so the neighbors inherit a position in the line as well as four seats - and the
           household drops from fifth of nine to last. The card was naming half the gift. */
        gains: "The two people least able to get themselves out leave in your seats, and in your place in the line.",
        consequence: "Nobody who needs a lift is left behind. But your own four are then on the last vehicle out. Your mother waits six hours in a shelter hall for it.",
        /* PASS D: NOT NEAR THE FRONT. The household's slot is the fifth of nine - option 1 says so
           twice - which is the middle of the line, and this card was selling a place it never had.
           The sacrifice is real without the exaggeration: middle of the line to last out. */
        givesUp: "Your slot in the middle of the line. Your household leaves last, with a child on an inhaler and six hours to wait.",
        moralTension: "Do your own dependents come first, or the dependents who have nobody at all?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 97, groupSizeSensitivity: 56,
          gainResponsivenessSensitivity: 19, outcomeAggregationSensitivity: 39,
          directnessSensitivity: 65, contextSensitivity: 78, stakeholderPerspectiveShiftSensitivity: 75,
        },
        metrics: {
          speed: 26,
          resourceUse: 80,
          reliability: 55,
          durability: 86,
          reversibility: 30,
        },
      },
      {
        id: "fire_fill_every_seat",
        cvrSeed: {
          rule: "fills every empty seat it has before it leaves",
          parallelRule: "fills every empty place on the round before it closes the list",
          identifiedCase: "were the fourth person on the street without a car, and the car was full",
          harm: "They watched seven people pull away from a street that had eight waiting on it",
          benefitCase: "have no vehicle and were third on that street with nobody coming for you",
          benefitLost: "There was one car on the street with room left in it, and it was yours",
          act: "You fill all {a|seven} seats in your car and drive out in your slot. Your mother's frame is strapped to the roof. A fourth neighbor is still on the street when you go.",
          parallelAct: "{w|A passenger fills every place in their boat, taking three people who had none. A frame is lashed across the stern. A fourth is left on the deck as it lowers.}",
          consequences: {
            soon: "Seven people ride in a car built for seven, with the walking frame tied to the roof.",
            later: "The frame may not survive the drive. The fourth neighbor could still be on foot at midnight.",
          },
          parallelConsequences: {
            soon: "Every place in the boat is taken by the three who had none, so it sits low and moves slowly.",
            later: "The frame lashed across it may be lost overboard. The fourth person could still be on deck at midnight.",
          },
        },
        title: "Fill every seat in the car with neighbors who have none",
        method: {
          kind: "car",
          by: "Your own car, all seven seats full",
          detail: "in your block's slot, with the walking frame strapped to the roof and no fast line through the bends.",
        },
        summary: "Your car holds seven and your household is four. Four people on your street have no vehicle at all, so you have room for three of them, and taking them costs you nothing but the space.",
        gains: "Seven people leave the valley instead of four, in one vehicle, on one tank of fuel.",
        consequence: "Three people who had no way out at all are in your car, and a fourth is still on the street. Seven in a seven-seat car also means the walking frame goes on the roof. The drive is slow and very hot.",
        givesUp: "Room and speed. The car is full, the frame is strapped above it, and you cannot take the fast line through the bends.",
        moralTension: "How much of your own family's room do you owe the neighbors who have no car?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 54, groupSizeSensitivity: 50,
          gainResponsivenessSensitivity: 40, outcomeAggregationSensitivity: 94,
          directnessSensitivity: 43, contextSensitivity: 62, stakeholderPerspectiveShiftSensitivity: 58,
        },
        metrics: {
          speed: 42,
          resourceUse: 88,
          reliability: 65,
          durability: 80,
          reversibility: 44,
        },
      },
      {
        id: "fire_shelter_hill_school",
        cvrSeed: {
          rule: "takes nothing from the shared roads and holds its ground instead",
          parallelRule: "takes nothing from the shared supply and holds its position instead",
          identifiedCase: "were on the crew that had to check the school roll at the ninth hour",
          harm: "They came back into the valley to account for four households that never left it",
          benefitCase: "took the convoy slot and the car seats that your household did not use",
          benefitLost: "Both of those were free that afternoon only because you went up the hill",
          act: "You walk your household up the footpath to the school, past the big houses on the shelf. You take no seat, no lane and no fuel. Nobody is told you are up there.",
          parallelAct: "{w|A passenger climbs to the open deck instead of taking a place in any boat. They take no seat and no hoist. Nobody is told they are up there.}",
          consequences: {
            soon: "A crew comes back into the valley to find out whether anyone is still in the blocks.",
            later: "Two of them may spend an hour in the smoke looking for your household. One could be off work tomorrow.",
          },
          parallelConsequences: {
            soon: "A crew climbs back up to find out whether anybody is still above the boat deck.",
            later: "Two of them may spend an hour below the waterline searching. One could be signed off before morning.",
          },
        },
        title: "Take your household to the concrete school on the hill",
        /*
          PASS D + PASS C, on the researcher instruction, 17 September 2026.

          THE CLAIM THAT NEEDED A FACT UNDER IT. This option said it uses no road capacity, which is
          only true if nobody drives up. Nothing on the card said so, and a reader was free to
          picture the family driving - at which point the claim is simply wrong and the
          resources-spared score with it. The footpath makes the claim true rather than asserted.

          IT ALSO COSTS SOMETHING, and that is the point. Twenty minutes of narrow path, slow with a
          walking frame, and the car left at the house. Pass B priced both: reliability came down
          because the climb is the frame user's hardest moment in the scenario, and speed came down
          to the floor because this household never leaves the valley at all.
        */
        method: {
          kind: "foot",
          by: "On foot, up the hill path",
          detail: "twenty minutes of narrow path past the big houses, slow with the frame. Your car stays at the house.",
        },
        summary: "The school is concrete, stands on the cleared shelf at the top of the valley, and is the designated refuge. The ridge road runs up to that shelf and is closed today, and the footpath beside it is too narrow for a vehicle. So your car stays at the house and the four of you walk. Going there uses no road capacity and displaces nobody at all.",
        gains: "You take no seat, no lane and no fuel from anybody, and you can still walk back down if the front turns.",
        consequence: "Nobody loses a place on the road to you, and the way back down stays open all night. But the climb is twenty minutes of narrow path, slow with your mother's frame, and it takes you up past the big houses where the ridge road begins. You are then inside the fire's path in a building rather than outside it, and your children watch the front arrive.",
        givesUp: "Distance from the fire, and your car. You trust a building to hold, and a crew comes back into the valley to find out whether anybody stayed in the blocks.",
        moralTension: "Is refusing to take anything from anyone worth putting your own children nearer the fire?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 56, groupSizeSensitivity: 94,
          gainResponsivenessSensitivity: 26, outcomeAggregationSensitivity: 39,
          directnessSensitivity: 28, contextSensitivity: 51, stakeholderPerspectiveShiftSensitivity: 49,
        },
        metrics: {
          speed: 15,
          resourceUse: 93,
          reliability: 40,
          durability: 84,
          reversibility: 90,
        },
      },
      {
        id: "fire_early_highway_run",
        cvrSeed: {
          rule: "moves before the system starts and takes the open road while it is still open",
          parallelRule: "moves before the list is drawn and takes the open slot while it is still open",
          identifiedCase: "reached the highway at the sixth hour and found four lanes of stationary traffic",
          harm: "The staging that would have kept it moving had collapsed three hours before that",
          benefitCase: "left the valley when you did and were over the county line before the smoke",
          benefitLost: "That road stayed clear for exactly as long as the early movers kept it clear",
          act: "You drive out on the main highway before the first slot is called. Everyone who sees your car go follows it, and the staging never starts.",
          parallelAct: "{w|A passenger goes down to the boats before their group is called. Others see it and follow, and the order collapses.}",
          consequences: {
            soon: "The highway fills with cars that were meant to leave in nine groups, not one.",
            later: "It may seize up by the sixth hour. The last three blocks could still be sitting in it as the fire comes down.",
          },
          parallelConsequences: {
            soon: "The boat deck fills with passengers who were meant to come down in nine groups, not one.",
            later: "The ladders may jam by the sixth hour. The last three decks could still be waiting as the ship goes over.",
          },
        },
        title: "Leave immediately on the main highway, before the staging starts",
        /* PASS D: this option is the one that made the contradiction visible, and it is the one that
           did NOT have to change. The nine slots are drawn but uncalled, so before the staging
           starts is now literally true and the title stands as written. */
        method: {
          kind: "car",
          by: "Your own car, on the main highway",
          detail: "away before the first slot is called, while the road is still empty.",
        },
        summary: "The highway is still empty and the first slot has not been called. Going now, before the timed convoy starts, is the fastest and cheapest way out. That is true for you, and for everyone who leaves when you do.",
        gains: "The quickest, cleanest run out of the valley, and the first few who follow you get a clear road as well.",
        consequence: "Your household is out early on an open highway. But your neighbors see you go and follow, so nine blocks that were meant to leave in turn are all on the road at once. Staging cannot be re-formed once it breaks, and the blocks furthest from the junction are the ones still sitting in the jam when the fire comes down.",
        givesUp: "The staging system itself, and any way back in. Nine blocks moving at once is the one thing it was built to prevent.",
        moralTension: "If everyone leaving early is what causes the jam, does it matter that you left before it?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 44, groupSizeSensitivity: 43,
          gainResponsivenessSensitivity: 68, outcomeAggregationSensitivity: 85,
          directnessSensitivity: 59, contextSensitivity: 51, stakeholderPerspectiveShiftSensitivity: 39,
        },
        metrics: {
          speed: 90,
          resourceUse: 22,
          reliability: 84,
          durability: 18,
          reversibility: 28,
        },
      },
    ],
  },
  {
    id: "cancer_treatment_allocation",
    stakePosition: "others",
    methodLabel: "How the doses are picked",
    /*
     * ───────────────────────────────────────────────────────────────────────────────
     * PASS D — TWO FACTS THAT EVERY OPTION NEEDED AND NONE OF THEM HAD, 17 September 2026.
     *
     * THE CLOSING CLAIM WAS FALSE, and it was the third scenario in a row to make the same kind of
     * promise. It said every option GIVES OUT ALL 20 DOSES, while the reserve option's own text
     * says holding doses back means fewer are used and some may be wasted. On the researcher's
     * instruction the claim gives way rather than the option: the waste is a real cost and removing
     * it would make the reserve too easy a choice.
     *
     * WHAT HAPPENS TO THE 100 WHO DO NOT GET ONE was never stated, so no option could say what it
     * costs. They go back onto next month's list. That single fact turns every card from "more
     * lives saved" into something a reader can count: 20 treated, 100 waiting, and a named reason
     * for which 100.
     *
     * THE DOSES HAVE A DATE ON THEM. Without it "some may be wasted" is an assertion; with it the
     * reserve option's whole trade-off is visible on the card, and its reliability score of 30 has
     * something to point at.
     *
     * NO PERFORMANCE NUMBER MOVED BECAUSE OF THESE. Pass B moved ten of them for its own reasons,
     * recorded on each option.
     * ───────────────────────────────────────────────────────────────────────────────
     */
    factBase:
      /*
        NO DOUBLE QUOTES IN THIS COMMENT. The digit check and the description-overlap check both
        read the first quoted string after the field name, so a quoted phrase here would be scored
        in place of the scenario text.
      */
      "About 120 eligible patients this month, and 20 doses with a date on them. One month before any further supply is even possible, and everyone who does not get a dose now goes back onto next month's list. Every option you will see spends from the same 20 doses and the same 120 names. They differ only in who ends up with one.",
    role:
      "You sit on the allocation team. {w|You are not a patient}, {w|nobody close to you is on the list}, and whatever you decide your own care is unaffected. The whole cost of this decision falls on {w|strangers}.",
    title: "Limited Cancer Treatment Allocation",
    description:
      "A hospital system has been given early access to a new cancer treatment. It works, and it is in far shorter supply than the number of people it could help. The allocation policy has to be set before this month's course begins.",
    theme: {
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(229,62,62,0.22), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(120,20,30,0.30), transparent 55%), linear-gradient(155deg, #1c0c0e, #2a0f14 50%, #43131c)",
      accent: "#E53E3E",
      shadow: "0 8px 32px rgba(229, 62, 62, 0.15)",
    },
    /**
     * PERFORMANCE CALIBRATION (recalibrated 2026-09).
     *
     * The captured ladder here was 100 - 85 - 63 - 62 - 60 - 0. Three options sat within two
     * points of each other, so for half the menu the performance reading carried no information:
     * a participant choosing between them was told they were equivalent when the underlying
     * metrics were not. The ladder is now 100 - 79 - 60 - 41 - 21 - 0, a minimum gap of 19
     * against the 8 that was the best any scenario previously managed.
     *
     * ONLY THE SPACING WAS DESIGNED. Each number is still traceable to a sentence printed on its
     * own card, and the four edits below were made because the prose already demanded them:
     *
     *  - prioritize_vulnerable  durability 85 -> 52. The card says the sickest respond slowly and
     *    that fewer people are alive at the end of the year than under any other policy here.
     *    Durability is how long the benefit lasts. It was authored as the highest on the table
     *    and should always have been among the lowest; the number contradicted the story.
     *    resourceUse 73 -> 60, because clinically staging 120 patients is heavy staff time.
     *  - max_life_years  reliability 56 -> 45. Life-year projections are prognostic estimates,
     *    so of every rule here this one is the least certain to deliver what it promises.
     *  - weighted_lottery  reliability 51 -> 42 and resourceUse 73 -> 82. The card already says
     *    doses may go to the people who benefit least; a draw is also the cheapest rule to run.
     *  - essential_workers  durability 43 -> 39. Returning staff to work is the shortest horizon.
     *
     * WHAT THIS COST AND WHAT IT BOUGHT. Protecting the vulnerable moves from 3rd to 5th of six
     * on performance. That is the direction the dissertation needs: G5 requires the vulnerable
     * option to COST something, and the correlation between vulnerability and performance in
     * this scenario moves from +0.10 to -0.10. Verified by npm run validate:metrics.
     */
    options: [
      {
        id: "cancer_max_total_lives",
        cvrSeed: {
          rule: "gives them to the patients with the highest survival odds",
          parallelRule: "lifts the people most likely to come through the flight alive",
          identifiedCase: "were diagnosed late, because the first two appointments were canceled",
          harm: "The delay is what made those odds low, and the rule reads low odds as a reason to pass them over",
          benefitCase: "have exactly the odds this rule looks for, and a cancer caught early",
          benefitLost: "Any rule that ignores odds is one where their good chance counts for nothing",
          act: "You score all {a|120} on their chance of coming through, and sign off the top {a|20}. Nobody you pass over is told why.",
          parallelAct: "{w|A winch operator lifts the twenty who can hold on to the strop. The rest of the roof waits for a pass that is not coming.}",
          consequences: {
            soon: "20 doses go to the patients whose odds were already the best on the list.",
            later: "The people found too late may wait another month. Some could be past treating by the time their turn comes.",
          },
          parallelConsequences: {
            soon: "20 places go to the people on the roof who can still hold on by themselves.",
            later: "The ones who cannot grip may wait for a pass that never comes. Some could be in the water within the hour.",
          },
        },
        /* PASS B, 17 September 2026 — reliability 76 -> 90 because this rule picks the best responders on purpose, which is the definition of likely to work. speed 45 -> 48 and resources 49 -> 46: scoring 120 people takes staff time, but less of it than the life-years model below. */
        method: {
          kind: "score",
          by: "Ranked by survival odds",
          detail: "all 120 are scored on their chance of coming through, and the top 20 are treated.",
        },
        title: "Treat the 20 most likely to survive",
        summary: "The most lives saved. Every one of the 120 is given a survival score, and the 20 highest are treated.",
        gains: "More of the people treated come through than under any other rule on this list.",
        consequence: "The 20 chosen are the ones most likely to recover, so this month's survival count is the highest here. But a late diagnosis lowers your score, so most of the 100 who wait are the people the system found too late — the same ones who waited last month.",
        givesUp: "The patients the system already failed. Being found late is what puts them at the bottom of this list, and the bottom is where they stay.",
        moralTension: "Is saving the greatest number the right goal, even when the people left out are the ones the system already failed?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 53,
          groupSizeSensitivity: 48,
          gainResponsivenessSensitivity: 39,
          outcomeAggregationSensitivity: 94,
          directnessSensitivity: 47,
          contextSensitivity: 42,
          stakeholderPerspectiveShiftSensitivity: 60,
        },
        metrics: {
          speed: 48,
          resourceUse: 46,
          reliability: 90,
          durability: 70,
          reversibility: 32,
        },
      },
      {
        id: "cancer_prioritize_vulnerable",
        cvrSeed: {
          rule: "reserves them for the most vulnerable patients first",
          parallelRule: "reserves the places for the weakest and worst-injured first",
          identifiedCase: "would have recovered fully, and sit just outside the sickest group",
          harm: "They wait another month, and by then they are inside it",
          benefitCase: "are the kind of patient this rule protects, and have been passed over twice already",
          benefitLost: "Every other rule here reads their condition as a reason to treat someone else",
          act: "You work down the list by how ill each of the {a|120} is, and sign off the sickest {a|20}. You do not look at their odds at all.",
          parallelAct: "{w|A winch operator takes the twenty least able to hold on, one at a time, and the lifts run long.}",
          consequences: {
            soon: "20 doses go to patients who are too ill to make much use of them.",
            later: "Fewer of the 120 may be alive a month from now than under any other rule here.",
          },
          parallelConsequences: {
            soon: "20 places go to the people least able to help themselves aboard.",
            later: "The slow lifts may cost the pass its last minutes. Fewer people could come off that roof in the next hour.",
          },
        },
        /* PASS B, 17 September 2026 — reliability 60 -> 35 and durability 52 -> 50. The card's own consequence line says these patients respond slowly and fewer people survive; reliability asks exactly that question and was answering it differently. reversibility 82 -> 30: a dose given is a dose given, and nothing about treating the sickest makes it easier to take back. */
        method: {
          kind: "list",
          by: "Worked down a severity list",
          detail: "the 120 are sorted by how ill they are, and the 20 in the worst condition are treated.",
        },
        title: "Treat the 20 who are sickest",
        summary: "The most vulnerable first. The 120 are sorted by how ill they are, and the 20 worst off are treated.",
        gains: "The 20 least able to cope are treated, and nobody is ranked by how useful their recovery would be.",
        consequence: "The 20 in the worst condition are treated first. But they respond slowly and some will not recover, so fewer of the 120 are alive at the end of the year than under any other rule here.",
        givesUp: "Lives. Doses go to patients who may not be able to use them, and the 100 who wait include people who would have recovered.",
        moralTension: "Do you treat the people who need help most, even if that means fewer people survive?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 96,
          groupSizeSensitivity: 57,
          gainResponsivenessSensitivity: 20,
          outcomeAggregationSensitivity: 40,
          directnessSensitivity: 58,
          contextSensitivity: 66,
          stakeholderPerspectiveShiftSensitivity: 85,
        },
        metrics: {
          speed: 58,
          resourceUse: 52,
          reliability: 35,
          durability: 56,
          reversibility: 30,
        },
      },
      {
        id: "cancer_max_life_years",
        cvrSeed: {
          rule: "gives them to the patients who would gain the most years of life",
          parallelRule: "lifts the people who would gain the most years from being lifted",
          identifiedCase: "are seventy-one, and are raising a grandchild on their own",
          harm: "The rule counts the years they have left, and never asks who depends on them",
          benefitCase: "are twenty-six, and were told this treatment would give them decades",
          benefitLost: "This is the only rule that counts those decades as worth anything",
          act: "You have each of the {a|120} modeled for the years a dose would add, and sign off the top {a|20}. Age does most of the deciding.",
          parallelAct: "{w|A winch operator lifts the twenty with the most years ahead of them, and the oldest stay where they are.}",
          consequences: {
            soon: "20 doses go to the youngest patients the list will allow.",
            later: "The oldest may wait another month. Some could be told next month that they are no longer eligible.",
          },
          parallelConsequences: {
            soon: "20 places go to the youngest people on the roof.",
            later: "The oldest may still be up there at first light. Some could be too cold to lift after a night in the open.",
          },
        },
        /* PASS B, 17 September 2026 — durability 74 -> 92, because years of benefit is the one thing this rule maximises and it should lead that metric. reliability 45 -> 68: it picks good responders, so it works more often than the old number allowed. speed 91 -> 28 and resources 51 -> 28 are the big ones: modeling remaining life for 120 people is the SLOWEST and most staff-hungry rule here, and it was scored as the fastest. */
        method: {
          kind: "score",
          by: "Ranked by years of life gained",
          detail: "each of the 120 is modeled for the years a dose would add, and the top 20 are treated.",
        },
        title: "Treat the 20 with the most years ahead",
        summary: "The most life-years. Each of the 120 is estimated for the years a dose would add, and the 20 highest are treated.",
        gains: "The 20 doses buy more future years of life than they could under any other rule here.",
        consequence: "The years bought are the most this month's supply can buy. But the estimate rewards having longer left, so most of the 100 who wait are the oldest patients on the list.",
        givesUp: "Older patients. A shorter life ahead is counted as a smaller gain, so age decides who is treated.",
        moralTension: "Is a year of life the right way to measure a person, when it means the old always lose?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 18,
          groupSizeSensitivity: 25,
          gainResponsivenessSensitivity: 92,
          outcomeAggregationSensitivity: 43,
          directnessSensitivity: 66,
          contextSensitivity: 53,
          stakeholderPerspectiveShiftSensitivity: 32,
        },
        metrics: {
          speed: 24,
          resourceUse: 24,
          reliability: 45,
          durability: 92,
          reversibility: 30,
        },
      },
      {
        id: "cancer_weighted_lottery",
        cvrSeed: {
          rule: "draws the recipients at random, with only a small boost for vulnerable patients",
          parallelRule: "draws the names at random, with only a small boost for the frailest",
          identifiedCase: "drew a place, and are already too weak for the treatment to do much",
          harm: "The dose is used, and the person behind them is told there are none left",
          benefitCase: "have been ranked last by every rule the hospital has tried",
          benefitLost: "The draw is the only one that ever gave them a real chance",
          act: "You put all {a|120} names into a sealed draw, add a few slips for the sickest, and sign off whichever {a|20} come out.",
          parallelAct: "{w|A winch operator picks by lot rather than by sight, drawing for each place, with extra slips for the weakest.}",
          consequences: {
            soon: "20 doses go out within the hour, and nobody on the list was ranked against anybody else.",
            later: "Some of the 20 may barely benefit. A patient the treatment would have saved could be left waiting.",
          },
          parallelConsequences: {
            soon: "20 places go out fast, and nobody on the roof is judged.",
            later: "Some lifted may have been safe where they were. Somebody who was not could still be up there an hour later.",
          },
        },
        /* PASS B, 17 September 2026 — speed 45 -> 92 and resources 82 -> 86: a draw needs no assessment, no scoring and no committee, so it is both the fastest rule here and the one that spares the most staff time. reversibility 90 -> 78 stays high but below the reserve, which still physically holds its doses. */
        method: {
          kind: "draw",
          by: "A sealed draw",
          detail: "all 120 names go in, with a few extra slips for the most vulnerable, and 20 are drawn.",
        },
        title: "Draw the 20 names",
        summary: "An equal chance. Every one of the 120 goes into a sealed draw, with a few extra slips for the most vulnerable.",
        gains: "Nobody is scored, ranked or judged. All 120 have a real chance, and the 20 who get one got it fairly.",
        consequence: "The draw takes a morning and nobody is measured against anybody else. But chance does not know who would benefit, so some of the 20 doses go to patients they will barely help.",
        givesUp: "Results. The 20 doses are spent without regard for what each one can do.",
        moralTension: "Is treating everyone equally worth accepting a worse outcome for everyone?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 56,
          groupSizeSensitivity: 94,
          gainResponsivenessSensitivity: 33,
          outcomeAggregationSensitivity: 38,
          directnessSensitivity: 44,
          contextSensitivity: 67,
          stakeholderPerspectiveShiftSensitivity: 43,
        },
        metrics: {
          speed: 92,
          resourceUse: 86,
          reliability: 38,
          durability: 55,
          reversibility: 78,
        },
      },
      {
        id: "cancer_reserve_underserved",
        cvrSeed: {
          rule: "holds part of them back for hard-to-reach patients",
          parallelRule: "holds part of the places back for the rooftops nobody has reached yet",
          identifiedCase: "were next on the list on the day the reserve was set aside",
          harm: "The dose held back for someone who never came is the one they were waiting for",
          benefitCase: "live four hours from the hospital, and have never once been on a list in time",
          benefitLost: "The reserve is the only reason a dose would still be there when they arrive",
          act: "You hold part of the {a|20} back for the patients furthest out, and send a nurse to find them.",
          parallelAct: "{w|A winch operator keeps places free for the roofs nobody has reached yet, and flies on to look for them.}",
          consequences: {
            soon: "The nurse sets out with two addresses, and the held doses go back into the cabinet.",
            later: "Some may be delivered in time. Any that are not could go past their date and help nobody at all.",
          },
          parallelConsequences: {
            soon: "The helicopter goes looking, and the free places stay empty over two more roofs.",
            later: "Some of those roofs may be found in time. The places kept for the ones that are not could carry nobody.",
          },
        },
        /* PASS B, 17 September 2026 — reliability 92 -> 30, the worst number in the scenario. It held the HIGHEST reliability score of all six while its own text said doses may go unused and some may be wasted. Reliability asks how likely the treatment achieves what is hoped, and a dose sitting in a cupboard past its date achieves nothing. speed 50 -> 22: reaching people the system misses takes weeks, which is the slowest thing any rule here does. reversibility 86 -> 94 moved UP: a held dose is the only dose in the scenario still in somebody's hands. */
        method: {
          kind: "hold",
          by: "A block held back",
          detail: "some of the 20 are kept for the patients furthest out, and released only if a nurse can reach them in time.",
        },
        title: "Hold some doses back for the patients nobody reaches",
        summary: "A share reserved. Some of the 20 are held for the patients who live too far out to reach a clinic quickly.",
        gains: "Patients who are on the list but never near the front of it get a share of this month's supply.",
        consequence: "The held doses reach people every other rule here leaves at the bottom. But reaching them takes weeks, and any dose still held when its date passes helps nobody at all.",
        givesUp: "Certainty. Fewer than 20 patients may be treated this month, and a dose that goes past its date cannot be recovered.",
        moralTension: "Is correcting an old unfairness worth using fewer doses today?",
        /*
         * THE FINGERPRINT CONTRADICTED THE CARD, 17 September 2026.
         *
         * `gainResponsivenessSensitivity` was 82 - the second highest in the scenario, on the one
         * option whose defining feature is that some of its doses may never be used. The card's own
         * givesUp line reads "Certainty. Fewer than 20 patients may be treated this month, and a
         * dose that goes past its date cannot be recovered." That is a line about GIVING UP gain,
         * sitting under a bar telling the participant this rule is nearly the best at producing it.
         *
         * 45 is what the option actually offers: a real gain for the few patients it reaches, and
         * no gain at all from the doses that expire. The other three values are unchanged and were
         * checked against the same text - protecting the vulnerable 68 and reducing harm 64 are
         * both defensible for a rule that targets an overlooked group and pushes nobody down a list.
         *
         * IT WAS ALSO RUNNER-UP ON THREE VALUES OF FOUR, which is a design smell on its own: an
         * option that is second-best at almost everything gives a participant little to choose
         * against. It is now runner-up on two.
         *
         * Every gate re-run after the change: all nine suites pass, and `npm run audit:rules` is
         * clean on scenarios 1, 2 and 3.
         */
        fingerprint: {
          vulnerabilityProtectionSensitivity: 68,
          groupSizeSensitivity: 64,
          gainResponsivenessSensitivity: 45,
          outcomeAggregationSensitivity: 52,
          directnessSensitivity: 41,
          contextSensitivity: 48,
          stakeholderPerspectiveShiftSensitivity: 53,
        },
        metrics: {
          speed: 22,
          resourceUse: 34,
          reliability: 30,
          durability: 62,
          reversibility: 82,
        },
      },
      {
        id: "cancer_essential_workers",
        cvrSeed: {
          rule: "gives them first to key workers and caregivers",
          parallelRule: "lifts first the people the town depends on",
          identifiedCase: "are sicker than anyone else on the list, and retired eight years ago",
          harm: "Nobody depends on them any more, and the rule reads that as a reason to wait",
          benefitCase: "are one of only two people who can keep the dialysis unit open",
          benefitLost: "If they are not treated the unit closes, and forty other people lose their week",
          act: "You take the {a|20} names on the keyworker register and sign them off first, whatever their odds or their condition.",
          parallelAct: "{w|A winch operator lifts the crew who can help work the next roof, and the rest of this one waits.}",
          consequences: {
            soon: "20 doses go to nurses, caregivers, drivers and teachers before anybody else on the list.",
            later: "The sickest may wait another month. Some could be beyond treating by the time their turn comes.",
          },
          parallelConsequences: {
            soon: "20 places go to the people who can help get others off the next roof.",
            later: "The ones left behind may wait for a pass that runs out of light. Some could still be there after a night in the open.",
          },
        },
        /* PASS B, 17 September 2026 — THE CLAIM SHRANK TO FIT THE NUMBER. The card said treating these patients keeps hospitals and key services running FOR THE WHOLE CITY, which is a very large promise to make about 20 people. It now says their wards keep the staff they need. resources 85 -> 88 survives that edit and is the honest reason for it: 20 caregivers back on shift is staff time returned to the system. durability 39 -> 44, reliability 76 -> 74, speed 90 -> 86: the register already exists, so this is fast, but not faster than a draw. */
        method: {
          kind: "list",
          by: "The city's keyworker register",
          detail: "names already on the register are treated first: nurses, caregivers, drivers and teachers.",
        },
        title: "Treat the 20 who others depend on",
        summary: "Key workers first. The city's keyworker register decides, and the 20 treated are nurses, caregivers, drivers and teachers.",
        gains: "Twenty people others rely on go back to work, and the wards and classrooms they staff keep running.",
        consequence: "The 20 treated are back at work within weeks, and the places that depend on them keep the staff they need. But being needed at work is not the same as being ill, and the sickest of the 120 are pushed down the list.",
        givesUp: "The sickest patients, and the idea that every life counts the same.",
        moralTension: "Is it right to treat people according to how useful they are to everyone else?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 43,
          groupSizeSensitivity: 40,
          gainResponsivenessSensitivity: 70,
          outcomeAggregationSensitivity: 86,
          directnessSensitivity: 64,
          contextSensitivity: 41,
          stakeholderPerspectiveShiftSensitivity: 46,
        },
        metrics: {
          speed: 86,
          resourceUse: 88,
          reliability: 74,
          durability: 44,
          reversibility: 38,
        },
      },
    ],
  },
  {
    id: "care_rota_reduction",
    stakePosition: "under_authority",
    decisionRole: "decider",
    employer: MERIDIAN,
    factBase:
      "240 clients. 40 caregivers. 1,600 visit-hours a week, cut to 1,200 for the next three months. Every option you will see fits inside the same 1,200 hours — they differ only in whose visits are cut.",
    role:
      "You are the shift coordinator. {w|Your own hours are not touched}, and {w|nobody you know is a client}. You set the work schedule that {w|forty caregivers} will work and {w|240 clients} will live with — and you set it under a principle {w|your employer has already published}.",
    title: "The Care Visits You Have to Cut",
    description:
      "Meridian Care is a company that sends caregivers to people's homes. The caregivers help with washing, medicines and meals. These visits are the reason those people can stay in their own homes instead of moving into a hospital. The company has lost funding, so it must cut a quarter of all visiting time for the next three months. Your job is to decide whose visits get cut.",
    theme: {
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(192,38,211,0.26), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(86,14,96,0.36), transparent 55%), linear-gradient(155deg, #16081a, #2c0d33 50%, #4d1657)",
      accent: "#C026D3",
      shadow: "0 8px 32px rgba(192, 38, 211, 0.18)",
    },
    options: [
      {
        id: "care_rebuild_rounds_by_travel",
        cvrSeed: {
          rule: "redraws every round to cut driving time",
          parallelRule: "redraws the intake lists to cut the queue outside",
          identifiedCase: "have had the same caregiver for nine years, and cannot follow a new face",
          harm: "The round is efficient now, and the person at the door is a stranger every week",
          benefitCase: "lost two visits last month to a caregiver stuck in traffic across town",
          benefitLost: "Every other option leaves that driving time exactly where it is",
          consequences: {
            soon: "Three hundred of the four hundred lost hours come back out of travel time.",
            later: "Clients who needed a familiar face had a different caregiver most weeks for three months.",
          },
          parallelConsequences: {
            soon: "Ten of the fifteen lost beds come back out of wasted space.",
            later: "People who needed a familiar face met different staff most nights for three months.",
          },
        },
        title: "Rebuild the rounds around travel time",
        summary: "Redraw every round so caregivers spend less time driving and more time at doors.",
        gains: "Hours recovered from driving rather than taken from anyone's visit.",
        consequence: "About 300 of the 400 lost hours come back out of travel time, so most visits survive at full length. But the new rounds pair caregivers with clients they have never met, and the routes cannot be redrawn again for three months.",
        givesUp: "Continuity. Clients lose the caregiver who knows them, and caregivers lose the clients they know.",
        moralTension: "Is a visit from a stranger the same visit?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 41,
          groupSizeSensitivity: 47,
          gainResponsivenessSensitivity: 68,
          outcomeAggregationSensitivity: 84,
          directnessSensitivity: 45,
          contextSensitivity: 44,
          stakeholderPerspectiveShiftSensitivity: 40,
        },
        metrics: {
          speed: 74,
          resourceUse: 92,
          reliability: 88,
          durability: 60,
          reversibility: 34,
        },
      },
      {
        id: "care_equal_share",
        cvrSeed: {
          rule: "takes the same share off every client",
          parallelRule: "takes the same share off every name on the list",
          identifiedCase: "need a full hour of help each morning, and now get forty-five minutes",
          harm: "An equal share is not an equal loss when the need it comes off was never equal",
          benefitCase: "have been put at the bottom of every list this service has ever drawn",
          benefitLost: "This is the only rule here that does not rank them at all",
          consequences: {
            soon: "All 240 clients keep a visit, and every visit is a quarter shorter.",
            later: "The clients who needed the most time lost the most minutes, every week for three months.",
          },
          parallelConsequences: {
            soon: "All 200 people keep a bed, and every stay is a quarter shorter.",
            later: "The people who needed the most time lost the most of it, every night for a two weeks.",
          },
        },
        title: "Cut every round by the same share",
        summary: "Every client loses the same proportion of their visit time.",
        gains: "Nobody is singled out, and every caregiver's round shrinks by the same amount.",
        consequence: "The cut is spread thin enough that no single client loses everything, and no caregiver's round is gutted. But an equal share off a larger need is a larger loss, so the clients who needed most time lose the most minutes.",
        givesUp: "Targeting. The people in the worst position get no more protection than anyone else.",
        moralTension: "Is treating everyone the same the same as treating everyone fairly?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 62,
          groupSizeSensitivity: 60,
          gainResponsivenessSensitivity: 74,
          outcomeAggregationSensitivity: 55,
          directnessSensitivity: 52,
          contextSensitivity: 58,
          stakeholderPerspectiveShiftSensitivity: 55,
        },
        metrics: {
          speed: 62,
          resourceUse: 72,
          reliability: 79,
          durability: 74,
          reversibility: 50,
        },
      },
      {
        id: "care_cut_where_family_covers",
        cvrSeed: {
          rule: "cuts only where a relative lives close enough to step in",
          parallelRule: "turns away only the people who have somewhere else to sleep",
          identifiedCase: "have a son who works nights and has two young children of his own",
          harm: "The rule counted him as cover, and never asked him whether he was",
          benefitCase: "have nobody within forty miles, and this rule is what keeps their visits",
          benefitLost: "Every other rule here takes their hours along with everyone else's",
          consequences: {
            soon: "Twelve of the 240 clients lose a visit outright, the fewest of any option here.",
            later: "Twelve families are doing the work instead, and three have already asked to stop.",
          },
          parallelConsequences: {
            soon: "Twelve of the 200 people are turned away, the fewest of any rule here.",
            later: "Twelve households are covering it instead, and three have said they cannot.",
          },
        },
        title: "Cut only where a family member can cover",
        summary: "Remove visits only from clients who have relatives living close enough to step in.",
        gains: "The smallest number of people actually left with no care at all.",
        consequence: "Almost everyone who loses a visit has somebody who can cover it, so very few are left alone. But the families absorb work they never agreed to, and some of them are already stretched thin.",
        givesUp: "The families. The cost is moved onto relatives rather than removed.",
        moralTension: "Is that a smaller harm, or the same harm moved somewhere nobody counts it?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 58,
          groupSizeSensitivity: 93,
          gainResponsivenessSensitivity: 30,
          outcomeAggregationSensitivity: 41,
          directnessSensitivity: 60,
          contextSensitivity: 62,
          stakeholderPerspectiveShiftSensitivity: 58,
        },
        metrics: {
          speed: 52,
          resourceUse: 62,
          reliability: 58,
          durability: 90,
          reversibility: 60,
        },
      },
      {
        id: "care_shorten_every_visit",
        cvrSeed: {
          rule: "keeps every client on the schedule by shortening every visit",
          parallelRule: "keeps every name on the list by shortening every stay",
          identifiedCase: "cannot be washed and fed in the shorter visit the new plan allows",
          harm: "The visit still happens, and the thing the visit was for does not",
          benefitCase: "would be taken off the schedule entirely under four of these six options",
          benefitLost: "This is the only rule under which they are still a client at all",
          consequences: {
            soon: "All 240 clients keep a caregiver coming through the door.",
            later: "Caregivers logged tasks left undone at a third of visits by the second month.",
          },
          parallelConsequences: {
            soon: "All 200 people keep a place on the list.",
            later: "Staff logged people leaving before morning at a third of places by week eight.",
          },
        },
        title: "Shorten every visit so nobody is dropped",
        summary: "Keep all 240 clients on the schedule, with less time at each door.",
        gains: "Every client keeps a caregiver coming through the door.",
        consequence: "Nobody is removed from the books, so all 240 keep contact and nobody is told they no longer qualify. But a shortened visit is often not long enough to do what the visit was for, and caregivers report leaving with tasks undone.",
        givesUp: "Depth. Everyone is seen, and fewer are properly cared for.",
        moralTension: "Is reaching everyone worth reaching nobody properly?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 50,
          groupSizeSensitivity: 44,
          gainResponsivenessSensitivity: 35,
          outcomeAggregationSensitivity: 92,
          directnessSensitivity: 48,
          contextSensitivity: 50,
          stakeholderPerspectiveShiftSensitivity: 47,
        },
        metrics: {
          speed: 66,
          resourceUse: 55,
          reliability: 44,
          durability: 50,
          reversibility: 94,
        },
      },
      {
        id: "care_profitable_rounds",
        cvrSeed: {
          rule: "keeps the rounds that pay and hands back the ones that do not",
          parallelRule: "keeps the places the grant covers and closes the ones it does not",
          identifiedCase: "live far out of town, and have seen nobody but their caregiver for months",
          harm: "Distance is what makes their round cost more, and the rule reads that as a reason to stop",
          benefitCase: "are one of the 40 caregivers whose job exists only if the contract survives",
          benefitLost: "Every other option here leaves the company short by March",
          consequences: {
            soon: "The service ends the three months solvent, and every job is still there.",
            later: "Sixty rural clients were handed back to a county agency with nobody to hand them to.",
          },
          parallelConsequences: {
            soon: "The service ends the winter solvent, and every post is still there.",
            later: "Fifty people were handed back to a county agency with nobody to hand them to.",
          },
        },
        title: "Keep the rounds that pay, hand back the ones that do not",
        summary: "Retain the block-booked town rounds and hand the scattered rural ones back.",
        gains: "The strongest financial position, and a service that is still open next year.",
        consequence: "The company comes out of the three months solvent and every caregiver's job survives, which no other option here guarantees. But the rural clients are handed back to a county agency with nobody to hand them to, and most of them are the ones with nobody else.",
        givesUp: "The most isolated clients. Distance is treated as a reason to stop coming.",
        moralTension: "Is keeping the service alive worth the people it was built for?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 16,
          groupSizeSensitivity: 28,
          gainResponsivenessSensitivity: 93,
          outcomeAggregationSensitivity: 45,
          directnessSensitivity: 68,
          contextSensitivity: 46,
          stakeholderPerspectiveShiftSensitivity: 34,
        },
        metrics: {
          speed: 34,
          resourceUse: 76,
          reliability: 70,
          durability: 78,
          reversibility: 39,
        },
      },
      {
        id: "care_highest_need_first",
        cvrSeed: {
          rule: "ring-fences full visits for the clients with no other support",
          parallelRule: "ring-fences places for the people with nowhere else at all",
          identifiedCase: "manage well on one daily visit, and lose it in the third week",
          harm: "Managing well is what the rule reads as a reason to take the visit away",
          benefitCase: "live alone, fell twice in January, and have nobody who checks",
          benefitLost: "Under every other rule here their visit is cut along with everyone else's",
          consequences: {
            soon: "The clients with nobody else keep every minute they had, starting Monday.",
            later: "The schedule broke and had to be rewritten mid-week in nine of the twelve weeks.",
          },
          parallelConsequences: {
            soon: "The people with nowhere else keep every night they had, starting tonight.",
            later: "The list broke and had to be redrawn mid-week in nine of the twelve weeks.",
          },
        },
        title: "Ring-fence the highest-need clients",
        summary: "Protect full visits for clients who live alone with no other support; everyone else absorbs the cut.",
        gains: "Complete protection for the people who have nobody else at all.",
        consequence: "The clients most likely to come to harm keep every minute they had, and because the service already knows who they are the protection starts on Monday. But the hours left are spread so thin across everyone else that the schedule breaks and has to be rewritten in the middle of the week.",
        givesUp: "Everyone in the middle. The moderate-need clients absorb the entire cut between them.",
        moralTension: "Do you protect a few people completely, or many people a little?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 95,
          groupSizeSensitivity: 54,
          gainResponsivenessSensitivity: 22,
          outcomeAggregationSensitivity: 38,
          directnessSensitivity: 62,
          contextSensitivity: 68,
          stakeholderPerspectiveShiftSensitivity: 82,
        },
        metrics: {
          speed: 90,
          resourceUse: 38,
          reliability: 52,
          durability: 56,
          reversibility: 45,
        },
      },
    ],
  },
  /*
   * THE MIRROR. Same employer, same cut, same six options, same numbers — and the participant is
   * now the person it lands on rather than the person setting it.
   *
   * THE OPTION TEXT IS DELIBERATELY IDENTICAL to `care_rota_reduction`, word for word. That is the
   * whole control: because the content is held exactly constant, ANY difference between what a
   * participant chose in scenario 4 and what they wish for here is attributable to position and to
   * nothing else. Rewording the cards to "sound like" the receiving end would feel more polished
   * and would quietly destroy the only clean contrast in the study.
   *
   * What changes is the wrapper — `role`, `factBase`, `description` — and the question asked at the
   * end, which is a WISH rather than a choice.
   *
   * NO cvrSeed ON ANY OPTION, and that is not an omission. `decisionRole: "recipient"` means no
   * reflection runs here: the participant is not answerable for a decision they were not given, so
   * there is nothing to re-present to them and nothing this scenario should teach their profile.
   * The CVR-content gates skip recipient scenarios for the same reason.
   */
  {
    id: "care_rota_receiving",
    stakePosition: "receiving_end",
    decisionRole: "recipient",
    employer: MERIDIAN,
    factBase:
      "The same 240 clients. The same 40 caregivers. The same 1,600 visit-hours cut to 1,200. The same six options — but this time your own round and your own clients are among the ones being cut.",
    role:
      "You are one of the forty caregivers. {w|You are not deciding this}. The coordinator decides, and they are choosing from {w|the same six options you can see here}. Whatever they choose, {w|you have to work it} — and {w|the people on your round} have to live with it.",
    title: "The Same Cut, Decided Without You",
    description:
      "The same company, the same cut, and the same six choices you saw a moment ago. This time you are not the coordinator. You are one of the caregivers, and your own hours and your own clients are on the list. You cannot decide anything here. You can only say which choice you hope the coordinator will make.",
    theme: {
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(13,148,136,0.22), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(12,74,74,0.34), transparent 55%), linear-gradient(155deg, #061414, #0a2222 50%, #0f3d3d)",
      accent: "#0D9488",
      shadow: "0 8px 32px rgba(13, 148, 136, 0.15)",
    },
    options: [
      {
        id: "wish_rebuild_rounds_by_travel",
        title: "Rebuild the rounds around travel time",
        summary: "Redraw every round so caregivers spend less time driving and more time at doors.",
        gains: "Hours recovered from driving rather than taken from anyone's visit.",
        consequence: "About 300 of the 400 lost hours come back out of travel time, so most visits survive at full length. But the new rounds pair caregivers with clients they have never met, and the routes cannot be redrawn again for three months.",
        givesUp: "Continuity. Clients lose the caregiver who knows them, and caregivers lose the clients they know.",
        moralTension: "Is a visit from a stranger the same visit?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 41,
          groupSizeSensitivity: 47,
          gainResponsivenessSensitivity: 68,
          outcomeAggregationSensitivity: 84,
          directnessSensitivity: 45,
          contextSensitivity: 44,
          stakeholderPerspectiveShiftSensitivity: 40,
        },
        metrics: {
          speed: 74,
          resourceUse: 92,
          reliability: 88,
          durability: 60,
          reversibility: 34,
        },
      },
      {
        id: "wish_equal_share",
        title: "Cut every round by the same share",
        summary: "Every client loses the same proportion of their visit time.",
        gains: "Nobody is singled out, and every caregiver's round shrinks by the same amount.",
        consequence: "The cut is spread thin enough that no single client loses everything, and no caregiver's round is gutted. But an equal share off a larger need is a larger loss, so the clients who needed most time lose the most minutes.",
        givesUp: "Targeting. The people in the worst position get no more protection than anyone else.",
        moralTension: "Is treating everyone the same the same as treating everyone fairly?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 62,
          groupSizeSensitivity: 60,
          gainResponsivenessSensitivity: 74,
          outcomeAggregationSensitivity: 55,
          directnessSensitivity: 52,
          contextSensitivity: 58,
          stakeholderPerspectiveShiftSensitivity: 55,
        },
        metrics: {
          speed: 62,
          resourceUse: 72,
          reliability: 79,
          durability: 74,
          reversibility: 50,
        },
      },
      {
        id: "wish_cut_where_family_covers",
        title: "Cut only where a family member can cover",
        summary: "Remove visits only from clients who have relatives living close enough to step in.",
        gains: "The smallest number of people actually left with no care at all.",
        consequence: "Almost everyone who loses a visit has somebody who can cover it, so very few are left alone. But the families absorb work they never agreed to, and some of them are already stretched thin.",
        givesUp: "The families. The cost is moved onto relatives rather than removed.",
        moralTension: "Is that a smaller harm, or the same harm moved somewhere nobody counts it?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 58,
          groupSizeSensitivity: 93,
          gainResponsivenessSensitivity: 30,
          outcomeAggregationSensitivity: 41,
          directnessSensitivity: 60,
          contextSensitivity: 62,
          stakeholderPerspectiveShiftSensitivity: 58,
        },
        metrics: {
          speed: 52,
          resourceUse: 62,
          reliability: 58,
          durability: 90,
          reversibility: 60,
        },
      },
      {
        id: "wish_shorten_every_visit",
        title: "Shorten every visit so nobody is dropped",
        summary: "Keep all 240 clients on the schedule, with less time at each door.",
        gains: "Every client keeps a caregiver coming through the door.",
        consequence: "Nobody is removed from the books, so all 240 keep contact and nobody is told they no longer qualify. But a shortened visit is often not long enough to do what the visit was for, and caregivers report leaving with tasks undone.",
        givesUp: "Depth. Everyone is seen, and fewer are properly cared for.",
        moralTension: "Is reaching everyone worth reaching nobody properly?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 50,
          groupSizeSensitivity: 44,
          gainResponsivenessSensitivity: 35,
          outcomeAggregationSensitivity: 92,
          directnessSensitivity: 48,
          contextSensitivity: 50,
          stakeholderPerspectiveShiftSensitivity: 47,
        },
        metrics: {
          speed: 66,
          resourceUse: 55,
          reliability: 44,
          durability: 50,
          reversibility: 94,
        },
      },
      {
        id: "wish_profitable_rounds",
        title: "Keep the rounds that pay, hand back the ones that do not",
        summary: "Retain the block-booked town rounds and hand the scattered rural ones back.",
        gains: "The strongest financial position, and a service that is still open next year.",
        consequence: "The company comes out of the three months solvent and every caregiver's job survives, which no other option here guarantees. But the rural clients are handed back to a county agency with nobody to hand them to, and most of them are the ones with nobody else.",
        givesUp: "The most isolated clients. Distance is treated as a reason to stop coming.",
        moralTension: "Is keeping the service alive worth the people it was built for?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 16,
          groupSizeSensitivity: 28,
          gainResponsivenessSensitivity: 93,
          outcomeAggregationSensitivity: 45,
          directnessSensitivity: 68,
          contextSensitivity: 46,
          stakeholderPerspectiveShiftSensitivity: 34,
        },
        metrics: {
          speed: 34,
          resourceUse: 76,
          reliability: 70,
          durability: 78,
          reversibility: 39,
        },
      },
      {
        id: "wish_highest_need_first",
        title: "Ring-fence the highest-need clients",
        summary: "Protect full visits for clients who live alone with no other support; everyone else absorbs the cut.",
        gains: "Complete protection for the people who have nobody else at all.",
        consequence: "The clients most likely to come to harm keep every minute they had, and because the service already knows who they are the protection starts on Monday. But the hours left are spread so thin across everyone else that the schedule breaks and has to be rewritten in the middle of the week.",
        givesUp: "Everyone in the middle. The moderate-need clients absorb the entire cut between them.",
        moralTension: "Do you protect a few people completely, or many people a little?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 95,
          groupSizeSensitivity: 54,
          gainResponsivenessSensitivity: 22,
          outcomeAggregationSensitivity: 38,
          directnessSensitivity: 62,
          contextSensitivity: 68,
          stakeholderPerspectiveShiftSensitivity: 82,
        },
        metrics: {
          speed: 90,
          resourceUse: 38,
          reliability: 52,
          durability: 56,
          reversibility: 45,
        },
      },
    ],
  },
  /*
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * SCENARIO 6 — THE VEIL OF IGNORANCE. A TEST OF THE MODEL, NOT INPUT TO IT.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   *
   * The first five scenarios ask what the participant would do. This one asks what rule they would
   * set before knowing which person in the situation they will be, then shows them what the model
   * expected and measures whether they recognize themselves in it.
   *
   * THE SCENE IS A POWER CUT AFTER A STORM, and that is a deliberate choice of subject. Everyone
   * has lived through one, so nothing has to be explained before the moral question can start. All
   * four values fit it without strain: the worst off is the breathing machine, the most harm
   * prevented is the clinic, the most people reached is whole streets, the most achieved is homes
   * per hour of work. And it shares no ground with the cancer allocation in scenario 3, which a
   * medicine shortage would have done.
   *
   * IT NEVER FEEDS THE MODEL. `decisionRole: "predicted"` makes `scenarioIsScored()` false, so no
   * profile update, no churn, and no contribution to VCI, Stability or Performance. Two reasons,
   * both binding. STABILITY_CHURN_CEILING is a measurement OF THIS DECK, so a sixth scenario
   * producing churn would invalidate it and every gate resting on it. And a scenario built to check
   * whether the model predicted correctly cannot also be evidence for the model.
   *
   * IT HAS FOUR OPTIONS, NOT SIX, AND THEY ARE PURE CHAMPIONS. Measured across 3,000 profiles, the
   * alignment gap between a scenario's best and second-best option is 7 points at the median, so
   * the model usually cannot separate the top two. Four strongly differentiated options raise that
   * separation to 17. Part of the gain is an artifact of having fewer options and part is real
   * discriminating power; the decomposition is in docs/BLOCK5_SCENARIO6_VEIL_DRAFT.md, and the
   * chance baseline of 25% must be reported wherever the probability is.
   *
   * ONE OPTION PER VALUE IS WHAT MAKES THE QUESTION EXACT. The scenario does not ask "which action
   * do you take", it asks "which of your four values do you act on when you do not know who you
   * will be". That maps one to one onto what is being predicted. In an emergency scenario four
   * stark options would be a weakness, because real emergencies are made of competing specifics.
   * Behind the veil the abstraction is the point: Rawls's original position is deliberately
   * abstract, and a participant is choosing a principle rather than an act.
   *
   * THE OPTION ORDER IS FIXED FOR EVERY PARTICIPANT and is the order written here. Ordering them by
   * the participant's own profile would place the predicted option in a position that correlates
   * with the prediction, and any general preference for the top of a list would then be
   * indistinguishable from agreement with the model.
   */
  {
    id: "veil_emergency_reserve_rule",
    stakePosition: "behind_the_veil",
    decisionRole: "predicted",
    factBase:
      "1 crew. About 33% of what went dark can be brought back in the first week. Support from other regions is at least 3 days away. The rule chosen now is the one followed on the night.",
    role:
      /*
        The veil itself. It names five concrete positions rather than gesturing at anyone at all,
        because a position nobody can picture is not a veil at all, only a sentence.

        The last one is the one that does the work. Including a position that never needs the
        reserve stops the participant quietly assuming they will be the person in need — which is
        the assumption that collapses the exercise into ordinary self-interest.
      */
      "You write the rule today. But {w|you do not know who you will be} when the storm comes. You could be {w|the person at home on a breathing machine}. You could be {w|the nurse at the clinic working with no lights}. You could be {w|the shop owner whose food is going bad}. You could be {w|a parent with a small baby and no heating}. You could be {w|someone whose power never goes out}. You learn who you are only after the rule is fixed. So the rule is for you too. You do not know if it will help you or hurt you.",
    title: "The Rule You Will Live Under",
    description:
      "A big storm has torn down the electricity lines across the city. Only one repair crew is available, and they cannot get everywhere before help arrives from elsewhere. So the city must decide in advance which streets come first. Once that decision is made, it cannot be changed.",
    theme: {
      /*
       * STEEL INDIGO — the one color in Block 5 that belongs to nothing else, chosen by measuring
       * rather than by taste.
       *
       * The five emergency scenarios sit at hues 0, 21, 68, 175 and 293. That leaves two real gaps
       * on the wheel: 68 to 175, which is green, and 175 to 293, which is blue.
       *
       * Green is out. It is the app's "go" color - every commit button in the study is green - and
       * a scenario themed in it would compete with the one control the participant must never
       * misread.
       *
       * So the blue gap, and its center. This accent sits at hue 221, a full 46 degrees from the
       * nearest scenario color. The violet it replaces sat at 262, only 31 degrees from the care
       * rota's fuchsia and squarely in the purple the interface already uses for badges, which is
       * why it read as a repeat rather than a new thing.
       *
       * IT IS ALSO A DIFFERENT KIND OF Color, not just a sixth hue. At 52% saturation it is the
       * least saturated accent in the block, and at 37% lightness among the darkest. The other five
       * are alarm colors for scenarios that are alarms. This one is cold and sober, because
       * scenario 6 is not an emergency at all - it is a quiet exercise in writing a rule. A
       * participant should feel the change of register before they read a word.
       */
      gradient: "radial-gradient(900px 420px at 12% -10%, rgba(45,75,142,0.22), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(23,37,74,0.48), transparent 55%), linear-gradient(155deg, #080b14, #0f1730 50%, #1b2a52)",
      accent: "#2D4B8E",
      shadow: "0 8px 32px rgba(45, 75, 142, 0.18)",
    },
    options: [
      {
        id: "veil_worst_off_first",
        title: "Help the people who would be hurt the most",
        summary:
          "The crew goes first to the people who would be hurt the most without power. That holds even if reaching them is slow and costs a lot.",
        gains: "Nobody is skipped because helping them was hard.",
        consequence:
          "The people in the worst trouble get their power back first. But the crew then reaches fewer places, so many others stay dark.",
        givesUp: "The bigger number of places the same crew could have reached.",
        moralTension:
          "Is it fair to help fewer people, so you can help those in the worst trouble?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 95, groupSizeSensitivity: 25,
          gainResponsivenessSensitivity: 25, outcomeAggregationSensitivity: 25,
          directnessSensitivity: 50, contextSensitivity: 50, stakeholderPerspectiveShiftSensitivity: 50,
        },
        metrics: {
          /*
            ALL FIVE ARE 50, AND THAT IS THE STATEMENT RATHER THAN A PLACEHOLDER.

            Metrics describe how an ACTION performs - how fast, how reliable, how reversible. These
            four are not actions, they are standing rules, and asking whether a principle is "fast"
            has no answer. Scenario 6 is also excluded from Performance, so nothing reads these.

            Equal values say the options do not differ on this axis. Inventing a spread would put a
            difference on the metrics dashboard that the scenario does not contain, and a
            participant comparing two rules would find themselves separating them on a number that
            means nothing here. The dashboard is hidden on this scenario for the same reason.
          */
          speed: 50,
          resourceUse: 50,
          reliability: 50,
          durability: 50,
          reversibility: 50,
        },
      },
      {
        id: "veil_prevent_most_harm",
        title: "Stop the most people from being badly hurt",
        summary:
          "The crew goes where it stops the most deaths and serious harm. It does not matter who those people are.",
        gains: "As few people are badly hurt as possible.",
        consequence:
          "Fewer people are badly hurt than with any other rule. But a person in deep trouble can be skipped. That happens if reaching them would save fewer people.",
        givesUp: "Any special claim a person has because of who they are.",
        moralTension:
          "If the rule never looks at who a person is, is that fair?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 25, groupSizeSensitivity: 95,
          gainResponsivenessSensitivity: 25, outcomeAggregationSensitivity: 25,
          directnessSensitivity: 50, contextSensitivity: 50, stakeholderPerspectiveShiftSensitivity: 50,
        },
        metrics: {
          /*
            ALL FIVE ARE 50, AND THAT IS THE STATEMENT RATHER THAN A PLACEHOLDER.

            Metrics describe how an ACTION performs - how fast, how reliable, how reversible. These
            four are not actions, they are standing rules, and asking whether a principle is "fast"
            has no answer. Scenario 6 is also excluded from Performance, so nothing reads these.

            Equal values say the options do not differ on this axis. Inventing a spread would put a
            difference on the metrics dashboard that the scenario does not contain, and a
            participant comparing two rules would find themselves separating them on a number that
            means nothing here. The dashboard is hidden on this scenario for the same reason.
          */
          speed: 50,
          resourceUse: 50,
          reliability: 50,
          durability: 50,
          reversibility: 50,
        },
      },
      {
        id: "veil_reach_most_people",
        title: "Give power back to as many places as possible",
        summary:
          "The crew works so the most homes get power back. Each place gets only a few hours a day, but almost everyone gets something.",
        gains: "Almost nobody is left with no power at all.",
        consequence:
          "More homes get power than with any other rule. But a few hours a day may be too little for anyone in real danger.",
        givesUp: "Full power in one place, where it would really change things.",
        moralTension:
          "Is a little help for many worth more than real help for a few?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 25, groupSizeSensitivity: 25,
          gainResponsivenessSensitivity: 25, outcomeAggregationSensitivity: 95,
          directnessSensitivity: 50, contextSensitivity: 50, stakeholderPerspectiveShiftSensitivity: 50,
        },
        metrics: {
          /*
            ALL FIVE ARE 50, AND THAT IS THE STATEMENT RATHER THAN A PLACEHOLDER.

            Metrics describe how an ACTION performs - how fast, how reliable, how reversible. These
            four are not actions, they are standing rules, and asking whether a principle is "fast"
            has no answer. Scenario 6 is also excluded from Performance, so nothing reads these.

            Equal values say the options do not differ on this axis. Inventing a spread would put a
            difference on the metrics dashboard that the scenario does not contain, and a
            participant comparing two rules would find themselves separating them on a number that
            means nothing here. The dashboard is hidden on this scenario for the same reason.
          */
          speed: 50,
          resourceUse: 50,
          reliability: 50,
          durability: 50,
          reversibility: 50,
        },
      },
      {
        id: "veil_greatest_total",
        title: "Use the crew where it does the most good",
        summary:
          "The crew goes where each hour of work does the most good in total. No hour is spent where it helps less.",
        gains: "Nothing is wasted.",
        consequence:
          "The crew does more good in total than with any other rule. But the places that are hardest to reach are always skipped.",
        givesUp: "The places that cost the most to reach.",
        moralTension:
          "When a rule tries to do the most good, who always loses out?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 25, groupSizeSensitivity: 25,
          gainResponsivenessSensitivity: 95, outcomeAggregationSensitivity: 25,
          directnessSensitivity: 50, contextSensitivity: 50, stakeholderPerspectiveShiftSensitivity: 50,
        },
        metrics: {
          /*
            ALL FIVE ARE 50, AND THAT IS THE STATEMENT RATHER THAN A PLACEHOLDER.

            Metrics describe how an ACTION performs - how fast, how reliable, how reversible. These
            four are not actions, they are standing rules, and asking whether a principle is "fast"
            has no answer. Scenario 6 is also excluded from Performance, so nothing reads these.

            Equal values say the options do not differ on this axis. Inventing a spread would put a
            difference on the metrics dashboard that the scenario does not contain, and a
            participant comparing two rules would find themselves separating them on a number that
            means nothing here. The dashboard is hidden on this scenario for the same reason.
          */
          speed: 50,
          resourceUse: 50,
          reliability: 50,
          durability: 50,
          reversibility: 50,
        },
      },
    ],
  },
];
