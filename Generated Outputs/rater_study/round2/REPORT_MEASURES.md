# Blind review of the performance numbers: the comparison

AI-assisted blind content review (Claude models, no tools, fresh context each), adjudicated by the researcher. Not human inter-rater reliability.

## 1. The answers

| Rater | Model it reported | Valid | Problems | Notes |
|---|---|---|---|---|
| haiku | claude-haiku-4-5-20251001 | yes | - | - |
| opus | claude-opus-5-5 | yes | - | - |
| sonnet | claude-sonnet-5 | yes | - | - |

- haiku probe: # Probe Results ## blind-value-rater **PASSED** 1) NONE. I have no tools available; the task explicitly states I have no tools to call. 2) COULD NOT READ. I have no file-reading tools and cannot open files per my instructions. 3) NOTHING ELSE. No project notes, CLAUDE.md, or memory files appear in m
- opus probe: # Probe result (Step 1) Organizer model: Claude Opus 5.5 (claude-opus-5-5). Both probe agents were run in the foreground with no model parameter, using the exact probe prompt from RUNBOOK.md. ## blind-value-rater **Result: PASSED.** All three rules held. Rule 1: the only tool it lists is SubagentHan
- sonnet probe: # Probe results (Claude Sonnet folder) ## blind-value-rater Reply (word for word): 1) Tools I can call: SubagentHandback - delivers my final report/message to the agent that called me; it is a one-way hand-off tool, not for back-and-forth messaging. No other tools (no file read/write, no search, no 

## 2. How much the raters agree with each other

- ICC(2,1), absolute agreement, over 120 option-measure scores: **0.729** (0.75 or more is usually called good, 0.90 excellent)
- Mean Spearman correlation between two raters' orders: **0.662**
- Mean distance between two raters' scores: **13.6 points**

## 3. How much the raters agree with the study's numbers

Mean Spearman correlation between the study's order and the raters' order: **0.737** (1 = the same order).

| Scenario | Measure | Same order? (Spearman) | Study's top | Raters' top |
|---|---|---|---|---|
| 1 | Speed | 0.94 | Drive out on the industrial service road | Drive out on the industrial service road |
| 1 | Resources spared | 0.77 | Seal your apartment, tell the district office you are staying, and shelter | Seal your apartment, tell the district office you are staying, and shelter |
| 1 | Reliability | 0.37 | Leave with the registered convoy at your assigned time | Take the sealed respirator the clinic had reserved |
| 1 | Durability | 0.03 | Seal your apartment, tell the district office you are staying, and shelter | Leave with the registered convoy at your assigned time |
| 1 | Reversibility | 0.37 | Carry the respirator to the patient it was kept for, and walk them out | Take the sealed respirator the clinic had reserved |
| 2 | Speed | 0.94 | Take the closed ridge road | Take the closed ridge road |
| 2 | Resources spared | 0.89 | Take your household to the concrete school on the hill | Take your household to the concrete school on the hill |
| 2 | Reliability | 0.94 | Take your household's assigned place in the staged convoy | Take your household's assigned place in the staged convoy |
| 2 | Durability | 0.49 | Give your car seats to the two residents with walkers and wait for the lift bus | Fill every seat in the car with neighbors who have none |
| 2 | Reversibility | 1.00 | Take your household to the concrete school on the hill | Take your household to the concrete school on the hill |
| 3 | Speed | 0.94 | Draw the 20 names from the patients who cannot wait | Treat the 20 who others depend on |
| 3 | Resources spared | 0.89 | Treat the 20 who others depend on | Treat the 20 who others depend on |
| 3 | Reliability | 0.89 | Treat the 20 most likely to survive | Treat the 20 most likely to survive |
| 3 | Durability | 0.55 | Treat the 20 with the most years ahead | Treat the 20 with the most years ahead |
| 3 | Reversibility | 0.37 | Hold some doses back for the patients nobody reaches | Hold some doses back for the patients nobody reaches |
| 4 | Speed | 0.94 | Protect full visits for the clients with nobody else | Protect full visits for the clients with nobody else |
| 4 | Resources spared | 0.94 | Redraw the routes to cut the driving | Keep the town routes that pay, and drop the rural ones |
| 4 | Reliability | 0.94 | Redraw the routes to cut the driving | Keep the town routes that pay, and drop the rural ones |
| 4 | Durability | 0.60 | Keep the town routes that pay, and drop the rural ones | Redraw the routes to cut the driving |
| 4 | Reversibility | 0.94 | Shorten every visit so nobody is dropped | Shorten every visit so nobody is dropped |

## 4. Flagged numbers, for the researcher to decide (56)

A number is flagged when it is 20+ points from the raters' mean, or 2+ places from where the raters put it, or when the top option differs. An option is also flagged when the raters are 30+ points apart among themselves: then the card's words, not its number, may be what needs a look.

### Scenario 1, Speed: Drive the community shuttle for two loops before you go

- Study: 45. Raters: 30, 25, 18 (mean 24).
- Why flagged: study 45 vs raters 24 (+21).
  - haiku: You are still inside the district when the plume arrives, on the third loop.
  - opus: "still inside the district when the plume arrives", leaving on the third loop.
  - sonnet: "Still inside the district when the plume arrives," on the third loop.

### Scenario 1, Resources spared: Leave with the registered convoy at your assigned time

- Study: 73. Raters: 80, 78, 88 (mean 82).
- Why flagged: place 4 in the study, 2 for the raters.
  - haiku: Nobody loses a seat or place in line to you.
  - opus: "You take nothing that was set aside for anyone else"; uses only your own assigned seat.
  - sonnet: "Takes nothing that was set aside for anyone else," just your own slot.

### Scenario 1, Resources spared: Take the sealed respirator the clinic had reserved

- Study: 45. Raters: 30, 8, 15 (mean 18).
- Why flagged: study 45 vs raters 18 (+27).
  - haiku: The mask was tagged for a patient on home oxygen.
  - opus: Takes "the clinic's only respirator" reserved for the patient; "there is not another one".
  - sonnet: Takes "the clinic's only respirator," the district's single reserved mask stock.

### Scenario 1, Resources spared: Carry the respirator to the patient it was kept for, and walk them out

- Study: 88. Raters: 70, 84, 28 (mean 61).
- Why flagged: study 88 vs raters 61 (+27); the raters themselves are 56 points apart (the words may be unclear on this value).
  - haiku: Patient on home oxygen gets out with mask kept for them.
  - opus: Respirator goes to the patient it was "tagged for"; you take no seat or mask yourself.
  - sonnet: Consumes "the clinic's only respirator," though for its intended patient.

### Scenario 1, Resources spared: Drive the community shuttle for two loops before you go

- Study: 40. Raters: 35, 66, 50 (mean 50).
- Why flagged: the raters themselves are 31 points apart (the words may be unclear on this value).
  - haiku: You drive two full loops carrying people; heavy shuttle use.
  - opus: Occupies the only shuttle, mostly for others, and you ride the third loop. Near tie with F.
  - sonnet: Drives the shuttle three loops, heavy use of the one shared vehicle.

### Scenario 1, Resources spared: Drive out on the industrial service road

- Study: 84. Raters: 25, 70, 76 (mean 57).
- Why flagged: study 84 vs raters 57 (+27); the raters themselves are 51 points apart (the words may be unclear on this value).
  - haiku: Road past tanker is single-track; once committed, no return.
  - opus: Own car on the permitted road; card shows no shuttle, mask or crew used. Near tie with D.
  - sonnet: Own car only; "the streets behind you follow" without using shared stock.

### Scenario 1, Reliability: Take the sealed respirator the clinic had reserved

- Study: 54. Raters: 85, 83, 92 (mean 87).
- Why flagged: study 54 vs raters 87 (-33); place 4 in the study, 1 for the raters.
  - haiku: With respirator you walk out through plume breathing clean air.
  - opus: "breathing clean air the whole distance", "clear of the district within the hour".
  - sonnet: "Breathing clean air the whole way," mask makes the short route dependable.

### Scenario 1, Reliability: Carry the respirator to the patient it was kept for, and walk them out

- Study: 42. Raters: 38, 42, 60 (mean 47).
- Why flagged: place 5 in the study, 3 for the raters.
  - haiku: Most exposed person on any route, breathing plume edge.
  - opus: "the most exposed person on any of these routes", breathing "the edge of the plume the whole way".
  - sonnet: Upwind river path is a clear route, despite four hours of plume-edge exposure.

### Scenario 1, Reliability: Drive the community shuttle for two loops before you go

- Study: 71. Raters: 45, 28, 40 (mean 38).
- Why flagged: study 71 vs raters 38 (+33); place 3 in the study, 5 for the raters.
  - haiku: Each loop you drive is another trip through district's air.
  - opus: Repeated trips through the air; "still inside the district when the plume arrives".
  - sonnet: Multiple loops raise exposure; "the third loop is the one you are on" when plume hits.

### Scenario 1, Reliability: Drive out on the industrial service road

- Study: 76. Raters: 50, 58, 25 (mean 44).
- Why flagged: study 76 vs raters 44 (+32); place 2 in the study, 4 for the raters; the raters themselves are 33 points apart (the words may be unclear on this value).
  - haiku: Clear road, fast, but once committed past tanker cannot turn back.
  - opus: Out in twenty minutes, but single-track and "closer to the tanker than any other route".
  - sonnet: Single-track road passes "closer to the tanker than any other route" here.

### Scenario 1, Reliability: TOP OPTION: study says "Leave with the registered convoy at your assigned time", raters say "Take the sealed respirator the clinic had reserved"

- Study: 86. Raters: 85, 83, 92 (mean 87).
- Why flagged: the study's top option on this measure is not the raters' top option.
  - haiku: With respirator you walk out through plume breathing clean air.
  - opus: "breathing clean air the whole distance", "clear of the district within the hour".
  - sonnet: "Breathing clean air the whole way," mask makes the short route dependable.

### Scenario 1, Durability: Leave with the registered convoy at your assigned time

- Study: 66. Raters: 80, 74, 82 (mean 79).
- Why flagged: place 5 in the study, 1 for the raters.
  - haiku: Fair system means blocks keep their slots after you.
  - opus: Keeps the timed line intact; "nobody loses their place in the line".
  - sonnet: Timed slots keep running for the streets still waiting after yours.

### Scenario 1, Durability: Take the sealed respirator the clinic had reserved

- Study: 76. Raters: 25, 12, 15 (mean 17).
- Why flagged: study 76 vs raters 17 (+59); place 3 in the study, 6 for the raters.
  - haiku: Mask was reserved for patient on home oxygen who cannot walk without.
  - opus: Only respirator gone; the tagged patient "cannot walk out without it".
  - sonnet: Takes the mask "tagged for" the patient, closing that person's only way out.

### Scenario 1, Durability: Drive the community shuttle for two loops before you go

- Study: 72. Raters: 20, 88, 32 (mean 47).
- Why flagged: study 72 vs raters 47 (+25); the raters themselves are 68 points apart (the words may be unclear on this value).
  - haiku: You use shuttle three times; less available for others.
  - opus: "Two full streets" cleared; "more people out than any other option here manages".
  - sonnet: You are the only driver and leave on the third loop; shuttle service ends.

### Scenario 1, Durability: Seal your apartment, tell the district office you are staying, and shelter

- Study: 82. Raters: 85, 68, 50 (mean 68).
- Why flagged: place 1 in the study, 3 for the raters; the raters themselves are 35 points apart (the words may be unclear on this value).
  - haiku: Nobody loses a seat; way out stays open for others.
  - opus: Uses nothing others need, but opens nothing for those behind either.
  - sonnet: No route touched; neither closes nor opens anything for people behind you.

### Scenario 1, Durability: Drive out on the industrial service road

- Study: 45. Raters: 15, 58, 93 (mean 55).
- Why flagged: place 6 in the study, 4 for the raters; the raters themselves are 78 points apart (the words may be unclear on this value).
  - haiku: Car coming up single-track road turns fire engine away from duty.
  - opus: "the streets behind you follow", but that road "takes everyone else past the leak".
  - sonnet: "The streets behind you follow" — opening the service road stays open for others.

### Scenario 1, Durability: TOP OPTION: study says "Seal your apartment, tell the district office you are staying, and shelter", raters say "Leave with the registered convoy at your assigned time"

- Study: 82. Raters: 80, 74, 82 (mean 79).
- Why flagged: the study's top option on this measure is not the raters' top option.
  - haiku: Fair system means blocks keep their slots after you.
  - opus: Keeps the timed line intact; "nobody loses their place in the line".
  - sonnet: Timed slots keep running for the streets still waiting after yours.

### Scenario 1, Reversibility: Take the sealed respirator the clinic had reserved

- Study: 52. Raters: 15, 85, 90 (mean 63).
- Why flagged: place 3 in the study, 1 for the raters; the raters themselves are 75 points apart (the words may be unclear on this value).
  - haiku: Once you take the mask, patient cannot have it.
  - opus: On foot with the mask, "by whichever route is shortest", so you can change route freely.
  - sonnet: Mask gives freedom of movement; nothing stops changing route while protected.

### Scenario 1, Reversibility: Carry the respirator to the patient it was kept for, and walk them out

- Study: 78. Raters: 45, 50, 45 (mean 47).
- Why flagged: study 78 vs raters 47 (+31); place 1 in the study, 4 for the raters.
  - haiku: Walking river path, you might turn back if forced to.
  - opus: On foot you can turn, but you are held to "the patient's pace", and the car is unusable.
  - sonnet: Slow, on foot, but you could still stop or turn back at the patient's pace.

### Scenario 1, Reversibility: Drive the community shuttle for two loops before you go

- Study: 37. Raters: 25, 66, 75 (mean 55).
- Why flagged: place 5 in the study, 3 for the raters; the raters themselves are 50 points apart (the words may be unclear on this value).
  - haiku: Once committed to driving loops, you are in district.
  - opus: You control a vehicle and could cut the loops short, though you are in the district's air.
  - sonnet: Driving the shuttle yourself, no stated block on turning the vehicle around.

### Scenario 1, Reversibility: Drive out on the industrial service road

- Study: 45. Raters: 10, 5, 10 (mean 8).
- Why flagged: study 45 vs raters 8 (+37); place 4 in the study, 6 for the raters.
  - haiku: Single-track past tanker; once committed there is no turning around.
  - opus: "once you are committed to it there is no turning around".
  - sonnet: "There is no turning around" on the single-track road — stated explicitly.

### Scenario 1, Reversibility: TOP OPTION: study says "Carry the respirator to the patient it was kept for, and walk them out", raters say "Take the sealed respirator the clinic had reserved"

- Study: 78. Raters: 15, 85, 90 (mean 63).
- Why flagged: the study's top option on this measure is not the raters' top option.
  - haiku: Once you take the mask, patient cannot have it.
  - opus: On foot with the mask, "by whichever route is shortest", so you can change route freely.
  - sonnet: Mask gives freedom of movement; nothing stops changing route while protected.

### Scenario 2, Speed: Take your household to the concrete school on the hill

- Study: 15. Raters: 30, 8, 65 (mean 34).
- Why flagged: the raters themselves are 57 points apart (the words may be unclear on this value).
  - haiku: Walk up footpath slowly with mother using walker.
  - opus: Never leaves the valley; "inside the fire's path in a building".
  - sonnet: 20-minute path, no slot to wait for, though "slow with the walker."

### Scenario 2, Resources spared: Give your car seats to the two residents with walkers and wait for the lift bus

- Study: 80. Raters: 60, 55, 60 (mean 58).
- Why flagged: study 80 vs raters 58 (+22).
  - haiku: Two residents with walkers leave fifth instead of last.
  - opus: Car leaves with two people in five seats, and your four take lift-bus places.
  - sonnet: Reallocates your car to two residents, though still uses lift-bus capacity for four.

### Scenario 2, Reliability: Take the closed ridge road

- Study: 62. Raters: 75, 74, 35 (mean 61).
- Why flagged: the raters themselves are 40 points apart (the words may be unclear on this value).
  - haiku: Clear ridge road forty-minute route is fast and direct.
  - opus: Out in forty minutes, but on a closed one-lane road with engines coming down it.
  - sonnet: Fast empty road, but shares the lane with oncoming fire engines.

### Scenario 2, Reliability: Take your household to the concrete school on the hill

- Study: 40. Raters: 50, 28, 20 (mean 33).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: You are inside fire's path in building; children watch front.
  - opus: Stay "inside the fire's path", trusting "a building to hold".
  - sonnet: Narrow path, slow with a walker — more room for something to go wrong.

### Scenario 2, Reliability: Leave immediately on the main highway, before the staging starts

- Study: 84. Raters: 65, 80, 50 (mean 65).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Empty highway is fast, but becomes jam when others follow.
  - opus: "out early on an open highway" before the jam forms.
  - sonnet: "Your household is out early" ahead of the jam it later causes.

### Scenario 2, Durability: Take the closed ridge road

- Study: 70. Raters: 15, 18, 35 (mean 23).
- Why flagged: study 70 vs raters 23 (+47).
  - haiku: Ridge road blocked; engines cannot reach nursing home.
  - opus: Turns engines back from the fire and from "the nursing home on the far side".
  - sonnet: Repeatedly pulls engines from the fire line, away from "the nursing home."

### Scenario 2, Durability: Give your car seats to the two residents with walkers and wait for the lift bus

- Study: 86. Raters: 85, 85, 63 (mean 78).
- Why flagged: place 1 in the study, 3 for the raters.
  - haiku: Two with walkers go fifth; system continues for residents.
  - opus: Walker users "go fifth instead of last"; "Nobody who needs the lift is left behind."
  - sonnet: Reallocated car and slot cause no lasting damage to the system for others.

### Scenario 2, Durability: Fill every seat in the car with neighbors who have none

- Study: 80. Raters: 85, 90, 75 (mean 83).
- Why flagged: place 4 in the study, 1 for the raters.
  - haiku: Seven people leave in one car; system works for rest.
  - opus: "Three people who had no way out at all are in your car", and you keep the staged line.
  - sonnet: Doesn't disrupt the staged order, adds capacity without harming others' access.

### Scenario 2, Durability: Take your household to the concrete school on the hill

- Study: 84. Raters: 25, 64, 95 (mean 61).
- Why flagged: study 84 vs raters 61 (+23); place 2 in the study, 4 for the raters; the raters themselves are 70 points apart (the words may be unclear on this value).
  - haiku: Crews must come back into valley to check who stayed.
  - opus: Takes no road space, but a crew must come back into the valley to check the blocks.
  - sonnet: "The way back down stays open all night," takes nothing from anyone.

### Scenario 2, Durability: TOP OPTION: study says "Give your car seats to the two residents with walkers and wait for the lift bus", raters say "Fill every seat in the car with neighbors who have none"

- Study: 86. Raters: 85, 90, 75 (mean 83).
- Why flagged: the study's top option on this measure is not the raters' top option.
  - haiku: Seven people leave in one car; system works for rest.
  - opus: "Three people who had no way out at all are in your car", and you keep the staged line.
  - sonnet: Doesn't disrupt the staged order, adds capacity without harming others' access.

### Scenario 2, Reversibility: Take the closed ridge road

- Study: 45. Raters: 25, 38, 55 (mean 39).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Single-track ridge road; once committed there is no turning back.
  - opus: Unclear: a light car could turn back, but it costs "time nobody can give back". Near tie with B.
  - sonnet: One-lane road shared with oncoming engines, hard to reverse mid-route.

### Scenario 3, Speed: Treat the 20 most likely to survive

- Study: 48. Raters: 80, 62, 65 (mean 69).
- Why flagged: study 48 vs raters 69 (-21).
  - haiku: All 120 scored on chance of coming through; top 20 treated.
  - opus: Every one of the 120 "is given a survival score" before anyone is treated.
  - sonnet: Scoring all 120 for survival odds adds modest administrative delay.

### Scenario 3, Speed: Treat the 20 with the most years ahead

- Study: 24. Raters: 79, 55, 50 (mean 61).
- Why flagged: study 24 vs raters 61 (-37).
  - haiku: Each of 120 estimated for years a dose would add.
  - opus: Each of the 120 is "modeled for the years a dose would add", the most analysis.
  - sonnet: "Modeled for the years a dose would add" for all 120 — a slower process.

### Scenario 3, Speed: TOP OPTION: study says "Draw the 20 names from the patients who cannot wait", raters say "Treat the 20 who others depend on"

- Study: 92. Raters: 85, 88, 90 (mean 88).
- Why flagged: the study's top option on this measure is not the raters' top option.
  - haiku: City's essential-worker register already identifies candidates.
  - opus: "names already on the register", so no scoring is needed. Near tie with A.
  - sonnet: Uses the existing "essential-worker register," likely the fastest to act on.

### Scenario 3, Resources spared: Treat the 20 most likely to survive

- Study: 46. Raters: 85, 62, 55 (mean 67).
- Why flagged: study 46 vs raters 67 (-21); the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: More people treated come through than any other rule.
  - opus: Scoring all 120 costs staff time; the patients treated are the likeliest to recover.
  - sonnet: Scoring all 120 for survival odds takes more analytical staff time.

### Scenario 3, Resources spared: Treat the 20 with the most years ahead

- Study: 24. Raters: 86, 50, 40 (mean 59).
- Why flagged: study 24 vs raters 59 (-35); the raters themselves are 46 points apart (the words may be unclear on this value).
  - haiku: The doses buy more future years of life than other rules.
  - opus: Modeling life-years for all 120 is the heaviest staff workload.
  - sonnet: Modeling years for all 120 is the most staff-time intensive option here.

### Scenario 3, Resources spared: Hold some doses back for the patients nobody reaches

- Study: 34. Raters: 50, 22, 12 (mean 28).
- Why flagged: the raters themselves are 38 points apart (the words may be unclear on this value).
  - haiku: Any dose still held when date passes helps nobody at all.
  - opus: Weeks of nurse outreach; "any dose still held when its date passes helps nobody".
  - sonnet: Doses may expire "unused," plus weeks of staff time reaching remote patients.

### Scenario 3, Reliability: Treat the 20 with the most years ahead

- Study: 45. Raters: 70, 74, 75 (mean 73).
- Why flagged: study 45 vs raters 73 (-28).
  - haiku: Younger patients likely to respond, but estimates vary.
  - opus: "fewer of the 20 come through than under the rule that ranks by odds". Near tie with E.
  - sonnet: Trades some odds for years; "fewer... come through" than the odds-based rule.

### Scenario 3, Durability: Treat the 20 who are sickest

- Study: 56. Raters: 45, 20, 15 (mean 27).
- Why flagged: study 56 vs raters 27 (+29); place 4 in the study, 6 for the raters; the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Sickest patients have shorter lives ahead even if treated.
  - opus: Fewest alive "at the end of the year".
  - sonnet: "Some will not recover" — the sickest group least likely to sustain benefit.

### Scenario 3, Durability: Treat the 20 who others depend on

- Study: 44. Raters: 75, 74, 68 (mean 72).
- Why flagged: study 44 vs raters 72 (-28); place 6 in the study, 3 for the raters.
  - haiku: Workers return to essential roles; benefit lasts in work.
  - opus: Workers return and "the wards and classrooms they staff keep running".
  - sonnet: "The wards and classrooms they staff keep running" — ongoing societal benefit.

### Scenario 3, Reversibility: Treat the 20 who are sickest

- Study: 30. Raters: 35, 32, 58 (mean 42).
- Why flagged: place 5.5 in the study, 3.5 for the raters.
  - haiku: Severity ranking set; hard to reverse later.
  - opus: Final; "some who wait... will be past treating by then".
  - sonnet: Straightforward severity list, some room to reassess before doses are given.

### Scenario 3, Reversibility: Draw the 20 names from the patients who cannot wait

- Study: 78. Raters: 30, 56, 20 (mean 35).
- Why flagged: study 78 vs raters 35 (+43); place 2 in the study, 6 for the raters; the raters themselves are 36 points apart (the words may be unclear on this value).
  - haiku: Random draw is final; participants back to waiting list.
  - opus: Sealed draw is final, but those deferred "can wait" and are still treatable next month.
  - sonnet: "A sealed draw" — deliberately designed to be locked in, least reversible.

### Scenario 3, Reversibility: Treat the 20 who others depend on

- Study: 38. Raters: 40, 28, 65 (mean 44).
- Why flagged: the raters themselves are 37 points apart (the words may be unclear on this value).
  - haiku: Register sets allocation; could adjust but difficult.
  - opus: Final; the register ignores illness, so the "sickest... are pushed down the list".
  - sonnet: An administrative register could be revised, though given doses stay final.

### Scenario 4, Speed: Cut only where a family member can cover

- Study: 40. Raters: 80, 78, 65 (mean 74).
- Why flagged: study 40 vs raters 74 (-34).
  - haiku: Next-of-kin check from file; done without asking relatives.
  - opus: Uses "next-of-kin on file, without asking the relatives".
  - sonnet: Uses the existing next-of-kin file, a quick check before cutting visits.

### Scenario 4, Speed: Keep the town routes that pay, and drop the rural ones

- Study: 55. Raters: 75, 60, 45 (mean 60).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Transfer rural clients to county service.
  - opus: Rural clients must be transferred to the county, which takes arranging.
  - sonnet: Handing rural clients to a county agency needs some external coordination time.

### Scenario 4, Resources spared: TOP OPTION: study says "Redraw the routes to cut the driving", raters say "Keep the town routes that pay, and drop the rural ones"

- Study: 92. Raters: 90, 90, 95 (mean 92).
- Why flagged: the study's top option on this measure is not the raters' top option.
  - haiku: Company comes out solvent; saves money-losing rural driving.
  - opus: "The strongest financial position"; drops the money-losing rural driving. Near tie with A.
  - sonnet: "The strongest financial position," dropping the money-losing rural routes entirely.

### Scenario 4, Reliability: Keep the town routes that pay, and drop the rural ones

- Study: 72. Raters: 60, 78, 92 (mean 77).
- Why flagged: the raters themselves are 32 points apart (the words may be unclear on this value).
  - haiku: City contract routes reliable; rural transfer uncertain.
  - opus: "The company comes out of the three months solvent."
  - sonnet: "The company comes out of the three months solvent" — most guaranteed outcome.

### Scenario 4, Reliability: Protect full visits for the clients with nobody else

- Study: 30. Raters: 54, 18, 20 (mean 31).
- Why flagged: the raters themselves are 36 points apart (the words may be unclear on this value).
  - haiku: 50 protected reliable; other 190 become fragile mid-week.
  - opus: "the schedule is being rewritten by the middle of the week".
  - sonnet: "The schedule is being rewritten by the middle of the week" — unstable.

### Scenario 4, Reliability: TOP OPTION: study says "Redraw the routes to cut the driving", raters say "Keep the town routes that pay, and drop the rural ones"

- Study: 80. Raters: 60, 78, 92 (mean 77).
- Why flagged: the study's top option on this measure is not the raters' top option.
  - haiku: City contract routes reliable; rural transfer uncertain.
  - opus: "The company comes out of the three months solvent."
  - sonnet: "The company comes out of the three months solvent" — most guaranteed outcome.

### Scenario 4, Durability: Keep every care visit, and cut the check-in visits

- Study: 50. Raters: 70, 60, 35 (mean 55).
- Why flagged: the raters themselves are 35 points apart (the words may be unclear on this value).
  - haiku: Check-ins cut; can restore when budget restored.
  - opus: Care kept, but "trouble a check-in would have caught early is found later".
  - sonnet: Losing "the eyes on the client" lets problems compound unnoticed over time.

### Scenario 4, Durability: Shorten every visit so nobody is dropped

- Study: 52. Raters: 75, 45, 60 (mean 60).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Visits shortened; can lengthen when budget restored.
  - opus: Tasks left undone at every door build up over time.
  - sonnet: Repeatedly leaving "tasks undone" is a chronic, cumulative quality problem over time.

### Scenario 4, Durability: Keep the town routes that pay, and drop the rural ones

- Study: 90. Raters: 30, 93, 93 (mean 72).
- Why flagged: the raters themselves are 63 points apart (the words may be unclear on this value).
  - haiku: Rural clients transferred; very hard to resume service.
  - opus: "a service that is still open next year"; "every caregiver's job survives".
  - sonnet: Explicitly "a service that is still open next year" — clearest long-term survival.

### Scenario 4, Durability: Protect full visits for the clients with nobody else

- Study: 56. Raters: 65, 30, 15 (mean 37).
- Why flagged: place 3 in the study, 6 for the raters; the raters themselves are 50 points apart (the words may be unclear on this value).
  - haiku: 50 protected; protection expands when budget restored.
  - opus: Unstable schedule; the 190 "lose about a third of their visits".
  - sonnet: Cascading rescheduling instability from week one suggests it will not hold up.

### Scenario 4, Durability: TOP OPTION: study says "Keep the town routes that pay, and drop the rural ones", raters say "Redraw the routes to cut the driving"

- Study: 90. Raters: 60, 84, 80 (mean 75).
- Why flagged: the study's top option on this measure is not the raters' top option.
  - haiku: New routes permanent for three months.
  - opus: Tighter routes keep saving driving after the three months.
  - sonnet: Permanent route redesign likely persists and works beyond the three months.

## 5. What each rater said in its own words

Each rater had its own letters; its legend is under its notes.

### haiku (claude-haiku-4-5-20251001)

Unclear:
- nothing

Comments:
- All four scenarios and all options were clear and explicitly described. Card text detailed the consequences of each choice. No inconsistencies detected in measure definitions or option descriptions that impeded rating.

Letters:
- Scenario 1: A = Seal your apartment, tell the district office you are staying, and shelter; B = Take the sealed respirator the clinic had reserved; C = Drive the community shuttle for two loops before you go; D = Leave with the registered convoy at your assigned time; E = Drive out on the industrial service road; F = Carry the respirator to the patient it was kept for, and walk them out
- Scenario 2: A = Take the closed ridge road; B = Take your household's assigned place in the staged convoy; C = Leave immediately on the main highway, before the staging starts; D = Fill every seat in the car with neighbors who have none; E = Give your car seats to the two residents with walkers and wait for the lift bus; F = Take your household to the concrete school on the hill
- Scenario 3: A = Hold some doses back for the patients nobody reaches; B = Draw the 20 names from the patients who cannot wait; C = Treat the 20 who are sickest; D = Treat the 20 most likely to survive; E = Treat the 20 with the most years ahead; F = Treat the 20 who others depend on
- Scenario 4: A = Redraw the routes to cut the driving; B = Protect full visits for the clients with nobody else; C = Keep the town routes that pay, and drop the rural ones; D = Shorten every visit so nobody is dropped; E = Cut only where a family member can cover; F = Keep every care visit, and cut the check-in visits

### opus (claude-opus-5-5)

Unclear:
- Scenario 1, F (Drive out on the industrial service road), durability: the card says 'the streets behind you follow' (a way out that stays open) but also that the road 'takes everyone else past the leak'. The two point in opposite directions.
- Scenario 1, D (Drive the community shuttle), resources: it uses the only shuttle, but mostly to carry other people. It is unclear whether that counts as using the supply or leaving it for others.
- Scenario 2, A (Take the closed ridge road), reversibility: the card does not say whether your own car could turn back on the ridge road. 'time nobody can give back' refers to the crews.
- Scenario 2, C (Take your household to the concrete school), resources: 'a crew comes back into the valley' could mean crew time spent because of you, or a sweep that happens anyway.
- Scenario 3, all options, reversibility: once given, every dose is final. I separated the options mainly by whether the patients deferred can still be treated next month, and by C's held block.

Comments:
- Scenario 1's speed and reliability measures ask about getting 'out', but A does not travel at all. I rated it by time spent inside the plume.
- Scenario 3's speed and resources cards say little about the time or staff cost of each selection method. I inferred it from how complex the method is (a draw, a register, a sort, a score, a model).
- Scenario 4, resources: none of the cards gives a budget figure except F ('strongest financial position') and A (300 driving hours saved), so the order below the top two is partly inferred.

Letters:
- Scenario 1: A = Seal your apartment, tell the district office you are staying, and shelter; B = Leave with the registered convoy at your assigned time; C = Carry the respirator to the patient it was kept for, and walk them out; D = Drive the community shuttle for two loops before you go; E = Take the sealed respirator the clinic had reserved; F = Drive out on the industrial service road
- Scenario 2: A = Take the closed ridge road; B = Fill every seat in the car with neighbors who have none; C = Take your household to the concrete school on the hill; D = Leave immediately on the main highway, before the staging starts; E = Give your car seats to the two residents with walkers and wait for the lift bus; F = Take your household's assigned place in the staged convoy
- Scenario 3: A = Draw the 20 names from the patients who cannot wait; B = Treat the 20 most likely to survive; C = Hold some doses back for the patients nobody reaches; D = Treat the 20 who are sickest; E = Treat the 20 who others depend on; F = Treat the 20 with the most years ahead
- Scenario 4: A = Redraw the routes to cut the driving; B = Shorten every visit so nobody is dropped; C = Protect full visits for the clients with nobody else; D = Keep every care visit, and cut the check-in visits; E = Cut only where a family member can cover; F = Keep the town routes that pay, and drop the rural ones

### sonnet (claude-sonnet-5)

Unclear:
- Scenario 1, Option D: exact timing of the convoy slot within the six hours is not numerically specified, making precise speed placement against B and E somewhat interpretive.
- Scenario 2, Option D: whether the concrete school on the shelf counts as 'clear of the valley' for the speed measure is ambiguous, since it is a refuge within the valley system rather than an exit route.

Comments:
- For several 'resources spared' judgments (e.g., Scenario 1 C, Scenario 4 E), an option that helps others directly (using a shared vehicle, shifting burden to family) is hard to separate from one that simply avoids using resources at all; I treated heavier use of a shared/communal resource as lower-scoring even when it benefited others, per the instruction to rate only what is used, not kindness.
- Scenario 3's reversibility measure had little textual basis for most options besides B (explicit hold-back) and C ('a sealed draw'); rankings among A/D/E/F rely on secondary inference about how easily each allocation method could be revised before doses are given.

Letters:
- Scenario 1: A = Seal your apartment, tell the district office you are staying, and shelter; B = Take the sealed respirator the clinic had reserved; C = Drive the community shuttle for two loops before you go; D = Leave with the registered convoy at your assigned time; E = Drive out on the industrial service road; F = Carry the respirator to the patient it was kept for, and walk them out
- Scenario 2: A = Take your household's assigned place in the staged convoy; B = Leave immediately on the main highway, before the staging starts; C = Take the closed ridge road; D = Take your household to the concrete school on the hill; E = Give your car seats to the two residents with walkers and wait for the lift bus; F = Fill every seat in the car with neighbors who have none
- Scenario 3: A = Treat the 20 who are sickest; B = Hold some doses back for the patients nobody reaches; C = Draw the 20 names from the patients who cannot wait; D = Treat the 20 most likely to survive; E = Treat the 20 with the most years ahead; F = Treat the 20 who others depend on
- Scenario 4: A = Redraw the routes to cut the driving; B = Protect full visits for the clients with nobody else; C = Keep the town routes that pay, and drop the rural ones; D = Shorten every visit so nobody is dropped; E = Cut only where a family member can cover; F = Keep every care visit, and cut the check-in visits
