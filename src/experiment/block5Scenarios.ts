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
    id: "chemical_release_escape",
    stakePosition: "self",
    factBase:
      "Six hours before the plume covers the district. Around 4,000 residents still to move. One community minibus, parked with no driver. One clinic cabinet holding a single full-face respirator. A convoy list nine streets long, and one service road running past the tanker. Every option you will see gets you out inside the six hours. They differ only in what each one takes from the people still here.",
    role:
      /*
        The closing clause — "but everything you use on the way out was something another resident
        was counting on" — is gone. It sat one sentence after "nobody depends on you" and read as a
        contradiction, and the cost to other people is already stated in `factBase`: "they differ
        only in what each one takes from the people still here." Saying it twice, in opposite
        directions, cost more than it added.
      */
      "You are {w|a resident here, on your own}. {w|Nobody depends on you}, and nobody is coming for you. You are the only person your choice has to save.",
    title: "Six Hours to Clear the District",
    description:
      "A rail tanker has split open at the freight yard on the edge of the district. Chlorine is coming off it as a low plume, and the wind is pushing it street by street into the housing. The whole district has been ordered to clear out.",
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
          identifiedCase: "were three streets further down the list, and the plume reached them first",
          harm: "The convoy that would have carried them out was still loading when the wind turned",
          benefitCase: "are on the same list as you and have been waiting since the order came",
          benefitLost: "The order holds only while people keep their places, and one skipped slot unravels it",
          consequences: {
            soon: "The streets after yours wait longer, because the list moves at the speed of its slowest street.",
            later: "Two families from street nine still have breathing trouble a month later. They left last.",
          },
          parallelConsequences: {
            soon: "The wards after this one wait longer, because the round moves at the speed of its slowest ward.",
            later: "Two patients from the last ward are still recovering a month on. They were seen last.",
          },
        },
        title: "Leave with the registered convoy at your assigned time",
        summary: "The district is being cleared street by street in timed groups. You wait for your street's slot, board with your neighbors, and go when they go.",
        gains: "You get out well inside the six hours, and nobody loses their place so that you can have yours.",
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
          identifiedCase: "have been on home oxygen for two years and cannot walk the distance unaided",
          harm: "They wait in a sealed room for a mask that has already left the district on your face",
          benefitCase: "were behind you in the convoy line and move up a place when you walk out",
          benefitLost: "The seat you would have filled is the last one on the last bus that runs",
          consequences: {
            soon: "The patient on home oxygen stays in a sealed room. The mask tagged for them is on your face.",
            later: "They spend three weeks in hospital. The clinic stops reserving masks for anyone after that.",
          },
          parallelConsequences: {
            soon: "The patient the ventilator was held for stays in a side room without it.",
            later: "They spend three weeks longer in hospital. The ward stops holding equipment for anyone.",
          },
        },
        title: "Take the sealed respirator the clinic had reserved",
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
          resourceUse: 57,
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
          identifiedCase: "were counting on you to reach the center and confirm your street was empty",
          harm: "The sweep team spent two more hours on a street you had in fact already cleared",
          benefitCase: "cannot walk unaided and were the one tagged for the mask you did not take",
          benefitLost: "The mask was still in the cabinet when the ambulance finally got to them",
          consequences: {
            soon: "You breathe the edge of the plume for four hours. A sweep team searches a street you already left.",
            later: "Your chest is never quite the same. That team lost two hours they needed on another street.",
          },
          parallelConsequences: {
            soon: "Nothing reserved is touched. This case waits through the whole round untreated.",
            later: "The delay leaves lasting damage. Two porters spent hours looking for a case already moved.",
          },
        },
        title: "Walk out the long way and leave the kit where it is",
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
          resourceUse: 65,
          reliability: 57,
          durability: 78,
          reversibility: 81,
        },
      },
      {
        id: "chem_shuttle_loop",
        cvrSeed: {
          rule: "spends the escape window carrying other people out before itself",
          parallelRule: "spends the treatment window on the ward's other patients before its own",
          identifiedCase: "waited at the third stop and watched the minibus fill before it reached them",
          harm: "The plume crossed that street while the shuttle was still two roads away from it",
          benefitCase: "had no car and no way out of either of the two streets you cleared",
          benefitLost: "Nobody else was going to drive that minibus, and it does not leave without a driver",
          consequences: {
            soon: "You are still inside the district on your third loop, when the plume reaches the road.",
            later: "The third street was never collected. Two people from it are still unwell in the spring.",
          },
          parallelConsequences: {
            soon: "The treatment window is spent on other patients. This case is still waiting when it closes.",
            later: "The third bay was never reached. Two patients from it are still unwell in the spring.",
          },
        },
        title: "Drive the community shuttle for two loops before you go",
        summary: "The district minibus has no driver. You can drive it, clear two streets of people who have no transport of their own, and leave on the third run.",
        gains: "Two full streets of people who had no way out are clear of the district because you drove.",
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
          resourceUse: 46,
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
          identifiedCase: "were on the sweep team and had to enter the block to confirm you were alive",
          harm: "Two of them spent forty minutes in the worst air of that night looking for you",
          benefitCase: "took the convoy seat and the mask that you never asked anyone for",
          benefitLost: "Both were still there because you stayed, and both were gone within the hour",
          consequences: {
            soon: "A sweep team breaks into your block to check you are alive. They breathe the worst air of the night.",
            later: "One of them is off work for two months. Nobody links it back to the apartment that stayed shut.",
          },
          parallelConsequences: {
            soon: "No shared supply is used. A team has to break in to check the room is safe.",
            later: "One of them is off work for two months. Nobody links it back to the room that stayed shut.",
          },
        },
        title: "Seal your apartment and shelter until the plume passes",
        summary: "Tape the doors, wet towels along the gaps, and stay put. Nothing is taken from anyone, nobody is moved out of their place, and no seat, road or mask is used.",
        gains: "You take absolutely nothing from anyone — no seat, no mask, no road, no crew time.",
        consequence: "Not one other person is worse off for what you chose, and you can still leave later if the wind turns. But you spend the night inside a plume with tape on the doors.",
        givesUp: "Any margin for error. If the seal does not hold you are inside the worst air in the district with no way out of it.",
        moralTension: "Is taking nothing from anybody the same thing as doing right by them?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 53, groupSizeSensitivity: 93,
          gainResponsivenessSensitivity: 32, outcomeAggregationSensitivity: 33,
          directnessSensitivity: 48, contextSensitivity: 67, stakeholderPerspectiveShiftSensitivity: 54,
        },
        metrics: {
          speed: 48,
          resourceUse: 82,
          reliability: 52,
          durability: 65,
          reversibility: 94,
        },
      },
      {
        id: "chem_service_road_run",
        cvrSeed: {
          rule: "opens the fastest route it can find and lets everyone else pour down it",
          parallelRule: "opens the fastest treatment path it can find and lets every other case follow it",
          identifiedCase: "followed your tail lights down the service road and stopped level with the tanker",
          harm: "Their car stalled where the air was worst, and the road was too narrow to turn on",
          benefitCase: "were still waiting in line for the convoy when your route opened up behind you",
          benefitLost: "Four streets emptied down that road within the hour, and not one of them waited",
          consequences: {
            soon: "Four streets follow your tail lights onto a single-track road that runs past the split tanker.",
            later: "A car stalls level with the leak. The family inside are still being treated months later.",
          },
          parallelConsequences: {
            soon: "Four wards follow the same fast path, which runs straight past the damaged wing.",
            later: "One trolley stalls in the worst of the smoke. That patient is treated for months after.",
          },
        },
        title: "Drive out on the industrial service road",
        summary: "The freight yard's service road runs upwind and is standing empty. It is the fastest way out for anyone who uses it, and word spreads the moment the first vehicle goes down it.",
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
          resourceUse: 88,
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
    factBase:
      "Eight hours before the front reaches the valley floor. Around 600 residents across nine blocks. One highway out, released in nine timed slots. One bus with a wheelchair lift. One ridge road, closed off and kept clear for fire crews. Every option you will see gets your household out inside the eight hours. They differ only in what each one takes from the rest of the valley.",
    role:
      "You are a resident, and {w|you are not leaving alone}. Your household is four. You, {w|two children} — one needs an inhaler in smoke — and {w|your mother, who walks with a frame}. You carry the cost of this choice, and so do they.",
    title: "Eight Hours Ahead of the Fire",
    description:
      "A wildfire front has crossed the ridge above the valley and is running downhill through dry timber. The valley is under an evacuation order, and smoke has already reached the valley floor.",
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
          consequences: {
            soon: "Your child uses the inhaler twice while you wait for slot five to be called.",
            later: "The wait goes down as normal, so the same nine slots are used again next fire season.",
          },
          parallelConsequences: {
            soon: "Your group waits for boat five while the deck tilts further under you.",
            later: "The wait is written down as normal, so the same nine boats are loaded that way next time.",
          },
        },
        title: "Take your household's assigned place in the staged convoy",
        summary: "The valley is leaving in timed blocks so the highway does not seize up. Your four go together in your block's slot, with a guide ahead of you and behind you.",
        gains: "All four of you leave together, in a guided group, on a road that is kept moving.",
        consequence: "Nobody in your household is separated and nobody else is pushed down the list to make room for you. But your slot is the fifth of nine, and the smoke is well into the valley by the time you roll.",
        givesUp: "Three hours of waiting, with an asthmatic child, while the air gets steadily worse.",
        moralTension: "Is waiting your turn still right when the person waiting beside you cannot breathe the wait?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 60, groupSizeSensitivity: 59,
          gainResponsivenessSensitivity: 81, outcomeAggregationSensitivity: 53,
          directnessSensitivity: 58, contextSensitivity: 49, stakeholderPerspectiveShiftSensitivity: 40,
        },
        metrics: {
          speed: 48,
          resourceUse: 57,
          reliability: 92,
          durability: 73,
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
          consequences: {
            soon: "A fire engine reverses two miles down the ridge road to let your car through.",
            later: "It reaches the care home forty minutes late. Two residents there do not recover.",
          },
          parallelConsequences: {
            soon: "A crew has to clear the davit they were holding so your group can board.",
            later: "They reach the lower deck forty minutes late. Two people down there do not recover.",
          },
        },
        title: "Take the closed ridge road",
        summary: "The ridge road is closed off and kept clear for fire crews coming the other way. It is empty, it is fast, and your four could be over the ridge and out of the valley in forty minutes.",
        gains: "Your household is out of the valley in forty minutes — hours ahead of anything else here.",
        consequence: "Your children are out of the smoke before the fire reaches the valley floor. But the ridge road is kept open for crews coming the other way. A car on it turns a fire engine back.",
        givesUp: "The road the fire crews need. An engine that reverses is one that does not reach the care home on the far side.",
        moralTension: "Would you take a road kept clear for rescuers, if it were your own children in the back?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 18, groupSizeSensitivity: 23,
          gainResponsivenessSensitivity: 92, outcomeAggregationSensitivity: 48,
          directnessSensitivity: 80, contextSensitivity: 30, stakeholderPerspectiveShiftSensitivity: 37,
        },
        metrics: {
          speed: 92,
          resourceUse: 51,
          reliability: 62,
          durability: 72,
          reversibility: 51,
        },
      },
      {
        id: "fire_wait_accessible_bus",
        cvrSeed: {
          rule: "gives its own places to the people who cannot board anything else and waits",
          parallelRule: "gives its own slot to the patients who cannot be moved again and waits",
          identifiedCase: "spent five hours in the shelter hall with an inhaler that was running low",
          harm: "They were still in the valley at the seventh hour because you gave the seats away",
          benefitCase: "use a frame and cannot climb the step onto any of the standard coaches",
          benefitLost: "Your two seats were the only ones in the valley they could actually get into",
          consequences: {
            soon: "Your household waits five hours in a shelter hall. Your child's inhaler runs low.",
            later: "Both neighbors who took your seats are safe. Your mother's chest is worse all winter.",
          },
          parallelConsequences: {
            soon: "Your group gives up its places and waits five hours for the last boat.",
            later: "Both people who took your places are safe. One of yours is ill all winter from the wait.",
          },
        },
        title: "Give your car seats to the two frame users and wait for the lift bus",
        summary: "Two neighbors use walking frames and cannot board the standard coaches. Your car can take them out now. Your own household then waits for the lift-equipped bus, which is the last vehicle scheduled to leave the valley.",
        gains: "The two people least able to get themselves out of the valley leave first, in your seats.",
        consequence: "Nobody who needs a lift is left behind. But your own four are then on the last vehicle out. Your mother waits five hours in a shelter hall for it.",
        givesUp: "Your place near the front of the line. Your household leaves last, with a child on an inhaler and five hours to wait.",
        moralTension: "Do your own dependents come first, or the dependents who have nobody at all?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 97, groupSizeSensitivity: 56,
          gainResponsivenessSensitivity: 19, outcomeAggregationSensitivity: 39,
          directnessSensitivity: 65, contextSensitivity: 78, stakeholderPerspectiveShiftSensitivity: 75,
        },
        metrics: {
          speed: 31,
          resourceUse: 64,
          reliability: 64,
          durability: 85,
          reversibility: 81,
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
          consequences: {
            soon: "Seven people ride in a car built for seven, with the walking frame tied to the roof.",
            later: "The frame is broken and takes two months to replace. Your mother cannot leave the house.",
          },
          parallelConsequences: {
            soon: "Every seat in the boat is filled, so it sits low and moves slowly in the swell.",
            later: "The frame lashed on top is smashed in the crossing. It takes two months to replace.",
          },
        },
        title: "Fill every seat in the car with neighbors who have none",
        summary: "Your car holds seven and your household is four. Three people on your street have no vehicle at all, and taking them costs you nothing but the space.",
        gains: "Seven people leave the valley instead of four, in one vehicle, on one tank of fuel.",
        consequence: "Three people who had no way out at all are in your car. But seven in a seven-seat car means the walking frame goes on the roof. The drive is slow and very hot.",
        givesUp: "Room and speed. The car is full, the frame is strapped above it, and you cannot take the fast line through the bends.",
        moralTension: "How much of your own family's room do you owe the neighbors who have no car?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 54, groupSizeSensitivity: 50,
          gainResponsivenessSensitivity: 40, outcomeAggregationSensitivity: 94,
          directnessSensitivity: 43, contextSensitivity: 62, stakeholderPerspectiveShiftSensitivity: 58,
        },
        metrics: {
          speed: 47,
          resourceUse: 45,
          reliability: 76,
          durability: 70,
          reversibility: 40,
        },
      },
      {
        id: "fire_shelter_hill_school",
        cvrSeed: {
          rule: "takes nothing from the shared roads and holds its ground instead",
          parallelRule: "takes nothing from the shared supply and holds its position instead",
          identifiedCase: "were on the crew that had to check the school roll at the ninth hour",
          harm: "They came back into the valley for a building never meant to hold four households",
          benefitCase: "took the convoy slot and the car seats that your household did not use",
          benefitLost: "Both of those were free that afternoon only because you went up the hill",
          consequences: {
            soon: "Your children watch the fire front arrive from inside a school building.",
            later: "Both sleep badly for months. A crew came back into the valley to check the building held.",
          },
          parallelConsequences: {
            soon: "Your group takes no boat and no place. You wait it out on the upper deck.",
            later: "The children sleep badly for months. A crew came back up to check you were alive.",
          },
        },
        title: "Take your household to the concrete school on the hill",
        summary: "The school is concrete, stands on cleared ground above the treeline, and is the valley's designated refuge. Going there uses no road capacity and displaces nobody at all.",
        gains: "You take no seat, no lane and no crew time from anybody, and you can still leave later if the front turns.",
        consequence: "Nothing you do makes anyone else's evacuation harder, and the option of leaving stays open all night. But you are inside the fire's path in a building rather than outside it, and your children watch the front arrive.",
        givesUp: "Distance from the fire. You are choosing to stay in the valley and trust a building to hold.",
        moralTension: "Is refusing to take anything from anyone worth putting your own children nearer the fire?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 56, groupSizeSensitivity: 94,
          gainResponsivenessSensitivity: 26, outcomeAggregationSensitivity: 39,
          directnessSensitivity: 28, contextSensitivity: 51, stakeholderPerspectiveShiftSensitivity: 49,
        },
        metrics: {
          speed: 48,
          resourceUse: 75,
          reliability: 56,
          durability: 72,
          reversibility: 95,
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
          consequences: {
            soon: "You are gone before the staging starts, and so is everyone who saw you leave.",
            later: "The highway jams at hour six. The last three blocks sit in stopped traffic as the fire comes down.",
          },
          parallelConsequences: {
            soon: "You board before the list is called, and so does everyone who sees you do it.",
            later: "The ladder jams at hour six. The last groups are still on deck as the water comes over.",
          },
        },
        title: "Leave immediately on the main highway, before the staging starts",
        summary: "The highway is still empty. Going now, before the timed convoy starts, is the fastest and cheapest way out. That is true for you, and for everyone who leaves when you do.",
        gains: "The quickest, cleanest run out of the valley, and the ones who follow you get the same clear road.",
        consequence: "Your household is out early on an open highway, and so is everybody who moves when you move. But once the highway fills there is no staging left to organize it, and no way back in for anything you forgot.",
        givesUp: "The staging system, and any way back. Once the highway is moving unstaged it cannot be re-formed.",
        moralTension: "If everyone leaving early is what causes the jam, does it matter that you left before it?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 44, groupSizeSensitivity: 43,
          gainResponsivenessSensitivity: 68, outcomeAggregationSensitivity: 85,
          directnessSensitivity: 59, contextSensitivity: 51, stakeholderPerspectiveShiftSensitivity: 39,
        },
        metrics: {
          speed: 90,
          resourceUse: 89,
          reliability: 79,
          durability: 43,
          reversibility: 46,
        },
      },
    ],
  },
  {
    id: "cancer_treatment_allocation",
    stakePosition: "others",
    factBase:
      "About 120 eligible patients this month. 20 doses. One month before any further supply is even possible. Every option you will see gives out all 20 doses — they differ only in who receives them.",
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
          consequences: {
            soon: "The mix of patients chosen saves more lives this month than any other mix would.",
            later: "Late-diagnosed patients are passed over again, as they were last year and the year before.",
          },
          parallelConsequences: {
            soon: "The mix chosen brings more people through the flight than any other mix would.",
            later: "The people found late are passed over again, as they were in the last two floods.",
          },
        },
        title: "Maximize total lives saved",
        summary: "Give the treatment to the mix of patients that saves the most lives overall.",
        gains: "The largest number of lives saved this month.",
        consequence: "More people survive than with any other policy. But patients whose odds are low, often because they were diagnosed late, are passed over.",
        givesUp: "The most vulnerable. Patients with low survival odds and late diagnoses receive nothing.",
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
          speed: 45,
          resourceUse: 49,
          reliability: 76,
          durability: 75,
          reversibility: 37,
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
          consequences: {
            soon: "The sickest patients are treated first, and they respond slowly.",
            later: "Fewer people are alive at the end of the year than under any other policy on this list.",
          },
          parallelConsequences: {
            soon: "The weakest are lifted first, and they take the longest to move.",
            later: "Fewer people are alive at the end of the night than under any other rule here.",
          },
        },
        title: "Protect the most vulnerable first",
        summary: "Give the treatment to the sickest and least-served patients first.",
        gains: "Protection for the patients who are sickest and least able to cope.",
        consequence: "The patients in the worst condition are treated first. But because their odds are lower, fewer people survive overall.",
        givesUp: "Total lives saved. Some doses go to patients who are unlikely to recover.",
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
          speed: 42,
          resourceUse: 60,
          reliability: 60,
          durability: 52,
          reversibility: 82,
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
          consequences: {
            soon: "All 20 doses go to the patients most likely to do well on them.",
            later: "Nobody diagnosed late gets anything, this month or next. The gap widens every year it runs.",
          },
          parallelConsequences: {
            soon: "All 20 places go to the people expected to live longest afterwards.",
            later: "Nobody found late is lifted, that night or the next. The gap grows every time it runs.",
          },
        },
        title: "Maximize life-years (treat the best responders)",
        summary: "Give the treatment to patients who would gain the most years of life.",
        gains: "The greatest number of future years of life saved.",
        consequence: "Each dose is used where it adds the most years of life. But this favors younger patients, and older patients are pushed down the list.",
        givesUp: "Older patients. A life with fewer years left is counted as worth less.",
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
          speed: 91,
          resourceUse: 51,
          reliability: 45,
          durability: 74,
          reversibility: 49,
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
          consequences: {
            soon: "All 20 names are drawn. Some very ill patients get nothing, and some mild cases are treated.",
            later: "Families are still asking a year later why a draw decided it. The hospital has no answer.",
          },
          parallelConsequences: {
            soon: "All 20 names are drawn. Some badly hurt people get nothing, some barely hurt are lifted.",
            later: "Families are still asking a year later why a draw decided it. Nobody has an answer.",
          },
        },
        title: "Equal-chance lottery (small boost for vulnerable)",
        summary: "Everyone eligible gets a chance; vulnerable patients get slightly better odds.",
        gains: "An equal, unbiased chance for every eligible patient.",
        consequence: "Nobody is judged or ranked, and every patient has a real chance. But doses may go to the people who benefit least.",
        givesUp: "Results. Chance decides, so doses can be used where they do very little good.",
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
          speed: 45,
          resourceUse: 82,
          reliability: 42,
          durability: 64,
          reversibility: 90,
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
          consequences: {
            soon: "Twenty doses go out. Four are held for patients who live too far to come in easily.",
            later: "Three patients with better odds were passed over. Two of them do not live out the year.",
          },
          parallelConsequences: {
            soon: "Twenty people are lifted. Four places are held for rooftops nobody has reached yet.",
            later: "Three people with a better chance were passed over. Two do not last the night.",
          },
        },
        title: "Reserve a share for patients who are hard to reach",
        summary: "Hold back some doses for country patients and others the system usually misses.",
        gains: "Doses finally reach communities that are usually overlooked.",
        consequence: "Groups that normally miss out finally get a share. But holding doses in reserve means fewer are used, and some may be wasted.",
        givesUp: "Reach and certainty. Fewer patients are treated, and reserved doses may go unused.",
        moralTension: "Is correcting an old unfairness worth using fewer doses today?",
        fingerprint: {
          vulnerabilityProtectionSensitivity: 68,
          groupSizeSensitivity: 64,
          gainResponsivenessSensitivity: 82,
          outcomeAggregationSensitivity: 52,
          directnessSensitivity: 41,
          contextSensitivity: 48,
          stakeholderPerspectiveShiftSensitivity: 53,
        },
        metrics: {
          speed: 50,
          resourceUse: 56,
          reliability: 92,
          durability: 66,
          reversibility: 86,
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
          consequences: {
            soon: "Doses go to nurses and caregivers first. Most are back at work within weeks.",
            later: "Patients with no job to return to wait another month. Some of them stop asking.",
          },
          parallelConsequences: {
            soon: "The pilots, medics and engineers go first. Most are working again within weeks.",
            later: "People with no job to go back to wait another night. Some of them stop signaling.",
          },
        },
        title: "Prioritize essential workers / caregivers",
        summary: "Give the treatment first to people others depend on (key workers, caregivers).",
        gains: "Hospitals and key services keep running for everyone.",
        consequence: "Protecting key workers keeps the whole health system running for the whole city. But it can push the sickest patients down the list.",
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
          speed: 90,
          resourceUse: 85,
          reliability: 76,
          durability: 39,
          reversibility: 46,
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
];
