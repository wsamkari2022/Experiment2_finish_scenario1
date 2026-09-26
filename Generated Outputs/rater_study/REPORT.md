# Blind option-value review: the comparison

AI-assisted blind content review (Claude models, no tools, fresh context each), adjudicated by the researcher. Not human inter-rater reliability.

## 1. The answers

| Rater | Model it reported | Valid | Problems | Notes |
|---|---|---|---|---|
| haiku | claude-haiku-4-5-20251001 | yes | - | scenario 3 vulnerable: E scored above B but ranked below it |
| opus | claude-opus-5-5 | yes | - | - |
| sonnet | claude-sonnet-5 | yes | - | - |

- haiku probe: 1) NONE 2) COULD NOT READ 3) NOTHING ELSE PASSED
- opus probe: PASSED - all three rules held: (1) the only tool listed is SubagentHandback; (2) line 2 says COULD NOT READ and the probe word does not appear in the reply; (3) the only other context was Claude Code's standard user-email line and environment block, with no CLAUDE.md, project notes, memory or file c
- sonnet probe: 1) Tools I am able to call right now: SubagentHandback only — this delivers my final report to the agent that spawned me. I have no file-reading, file-search, bash, or other execution tools available. 2) COULD NOT READ — I have no tool capable of opening or reading probe.txt. 3) NOTHING ELSE — apart

## 2. How much the raters agree with each other

- ICC(2,1), absolute agreement, over 96 option-value scores: **0.861** (0.75 or more is usually called good, 0.90 excellent)
- Mean Spearman correlation between two raters' orders: **0.824**
- Mean distance between two raters' scores: **10.5 points**

## 3. How much the raters agree with the study's numbers

Mean Spearman correlation between the study's order and the raters' order: **0.844** (1 = the same order).

| Scenario | Value | Same order? (Spearman) | Study's top | Raters' top |
|---|---|---|---|---|
| 1 | Protecting the vulnerable | 1.00 | Carry the respirator to the patient it was kept for, and walk them out | Carry the respirator to the patient it was kept for, and walk them out |
| 1 | Reducing harm | 0.83 | Seal your apartment, tell the district office you are staying, and shelter | Seal your apartment, tell the district office you are staying, and shelter |
| 1 | How much is gained | 0.93 | Take the sealed respirator the clinic had reserved | Drive out on the industrial service road |
| 1 | How many are helped | 0.83 | Drive the community shuttle for two loops before you go | Drive the community shuttle for two loops before you go |
| 2 | Protecting the vulnerable | 0.94 | Give your car seats to the two residents with walkers and wait for the lift bus | Give your car seats to the two residents with walkers and wait for the lift bus |
| 2 | Reducing harm | 0.78 | Take your household to the concrete school on the hill | Take your household's assigned place in the staged convoy |
| 2 | How much is gained | 1.00 | Take the closed ridge road | Take the closed ridge road |
| 2 | How many are helped | 0.84 | Fill every seat in the car with neighbors who have none | Fill every seat in the car with neighbors who have none |
| 3 | Protecting the vulnerable | 0.94 | Treat the 20 who are sickest | Treat the 20 who are sickest |
| 3 | Reducing harm | 0.83 | Draw the 20 names from the patients who cannot wait | Draw the 20 names from the patients who cannot wait |
| 3 | How much is gained | 0.89 | Treat the 20 with the most years ahead | Treat the 20 with the most years ahead |
| 3 | How many are helped | 0.94 | Treat the 20 most likely to survive | Treat the 20 most likely to survive |
| 4 | Protecting the vulnerable | 0.94 | Protect full visits for the clients with nobody else | Protect full visits for the clients with nobody else |
| 4 | Reducing harm | 0.09 | Cut only where a family member can cover | Cut only where a family member can cover |
| 4 | How much is gained | 1.00 | Keep the town routes that pay, and drop the rural ones | Keep the town routes that pay, and drop the rural ones |
| 4 | How many are helped | 0.72 | Shorten every visit so nobody is dropped | Redraw the routes to cut the driving |

## 4. Flagged numbers, for the researcher to decide (36)

A number is flagged when it is 20+ points from the raters' mean, or 2+ places from where the raters put it, or when the top option differs. An option is also flagged when the raters are 30+ points apart among themselves: then the card's words, not its number, may be what needs a look.

### Scenario 1, Reducing harm: Leave with the registered convoy at your assigned time

- Study: 61. Raters: 90, 85, 85 (mean 87).
- Why flagged: study 61 vs raters 87 (-26).
  - haiku: Assigned slot; no additional risk to others
  - opus: 'Nobody loses their place in the line so that you can have yours.'
  - sonnet: Takes nothing set aside for anyone; fair line imposes no cost on others.

### Scenario 1, Reducing harm: Take the sealed respirator the clinic had reserved

- Study: 45. Raters: 30, 20, 15 (mean 22).
- Why flagged: study 45 vs raters 22 (+23).
  - haiku: Takes respirator; patient harmed
  - opus: Leaves the tagged patient without a mask: 'there is not another one'.
  - sonnet: Denies the tagged patient their only means of walking out.

### Scenario 1, Reducing harm: Drive the community shuttle for two loops before you go

- Study: 62. Raters: 55, 70, 65 (mean 63).
- Why flagged: place 2 in the study, 4 for the raters.
  - haiku: Helps others by shuttle; doesn't increase their risk
  - opus: Moves waiting people out early, though each loop is 'another trip through the district's air'.
  - sonnet: Uses shuttle/roads but only to help others, no added harm to third parties.

### Scenario 1, How much is gained: Carry the respirator to the patient it was kept for, and walk them out

- Study: 20. Raters: 50, 10, 15 (mean 25).
- Why flagged: the raters themselves are 40 points apart (the words may be unclear on this value).
  - haiku: Four hours at patient's pace, edge of plume
  - opus: 'Four hours', 'the most exposed person on any of these routes', and you 'arrive last'.
  - sonnet: Four-hour walk at patient's pace, breathing plume edge, arrives last.

### Scenario 1, How much is gained: Seal your apartment, tell the district office you are staying, and shelter

- Study: 30. Raters: 5, 30, 55 (mean 30).
- Why flagged: the raters themselves are 50 points apart (the words may be unclear on this value).
  - haiku: Trapped if seal fails; worst case
  - opus: 'If the seal fails there is no way out.' Night inside the plume.
  - sonnet: No travel needed, but success depends on the seal holding.

### Scenario 1, How much is gained: TOP OPTION: study says "Take the sealed respirator the clinic had reserved", raters say "Drive out on the industrial service road"

- Study: 94. Raters: 85, 95, 95 (mean 92).
- Why flagged: the study's top option on this value is not the raters' top option.
  - haiku: Out in 20 minutes; fastest but no turning back
  - opus: 'You are out in twenty minutes', the 'fastest clear route out'.
  - sonnet: 'Out in twenty minutes,' fastest and surest route for self.

### Scenario 1, How many are helped: Leave with the registered convoy at your assigned time

- Study: 56. Raters: 36, 50, 20 (mean 35).
- Why flagged: study 56 vs raters 35 (+21); place 3 in the study, 5 for the raters; the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Assigned slot; nobody else benefits
  - opus: Takes nothing and adds no one. Neutral.
  - sonnet: Follows the line but does nothing extra for anyone else.

### Scenario 1, How many are helped: Drive out on the industrial service road

- Study: 87. Raters: 75, 55, 85 (mean 72).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Opens risky road; everyone behind gets out faster
  - opus: 'So is everyone behind you' out fast, offset by the route past the tanker.
  - sonnet: Opens the service road so 'the streets behind you follow.'

### Scenario 2, Protecting the vulnerable: Leave immediately on the main highway, before the staging starts

- Study: 35. Raters: 15, 8, 20 (mean 14).
- Why flagged: study 35 vs raters 14 (+21).
  - haiku: Breaks staging; walkers stuck in jam
  - opus: Farthest blocks 'are the ones still stuck in the jam when the fire comes down'. Near tie with A.
  - sonnet: Breaks staging, jamming the road that vulnerable/late blocks depend on.

### Scenario 2, Reducing harm: Take your household's assigned place in the staged convoy

- Study: 59. Raters: 80, 85, 85 (mean 83).
- Why flagged: study 59 vs raters 83 (-24).
  - haiku: Assigned slot; no added risk
  - opus: 'Nobody else is pushed down the list', on 'a road that is kept moving'.
  - sonnet: Stays in assigned slot; imposes no extra risk on others.

### Scenario 2, Reducing harm: Give your car seats to the two residents with walkers and wait for the lift bus

- Study: 56. Raters: 90, 78, 80 (mean 83).
- Why flagged: study 56 vs raters 83 (-27).
  - haiku: Swaps fairly; no additional risk
  - opus: A seat swap with the residents. The car keeps your slot, so no one is displaced.
  - sonnet: Costs only the household itself; no harm imposed on others.

### Scenario 2, Reducing harm: Fill every seat in the car with neighbors who have none

- Study: 62. Raters: 65, 83, 65 (mean 71).
- Why flagged: place 2 in the study, 4 for the raters.
  - haiku: Heavier vehicle might slow convoy slightly
  - opus: 'Not anybody else's place in the line.' Keeps to 'the staged line'. Near tie with E.
  - sonnet: Stays in staged slot despite extra passengers; minimal added risk.

### Scenario 2, Reducing harm: Take your household to the concrete school on the hill

- Study: 94. Raters: 100, 60, 90 (mean 83).
- Why flagged: the raters themselves are 40 points apart (the words may be unclear on this value).
  - haiku: Takes no road; zero risk imposed
  - opus: Takes no road, but 'a crew comes back into the valley to find out'.
  - sonnet: Uses no road capacity, takes nothing from anyone else.

### Scenario 2, Reducing harm: TOP OPTION: study says "Take your household to the concrete school on the hill", raters say "Take your household's assigned place in the staged convoy"

- Study: 94. Raters: 80, 85, 85 (mean 83).
- Why flagged: the study's top option on this value is not the raters' top option.
  - haiku: Assigned slot; no added risk
  - opus: 'Nobody else is pushed down the list', on 'a road that is kept moving'.
  - sonnet: Stays in assigned slot; imposes no extra risk on others.

### Scenario 2, How many are helped: Give your car seats to the two residents with walkers and wait for the lift bus

- Study: 39. Raters: 70, 78, 85 (mean 78).
- Why flagged: study 39 vs raters 78 (-39).
  - haiku: Two residents out fifth instead of ninth
  - opus: Two walker users get out hours sooner, and nobody who needs the lift is left behind.
  - sonnet: Two residents who'd have gone last now leave fifth of nine.

### Scenario 2, How many are helped: Leave immediately on the main highway, before the staging starts

- Study: 30. Raters: 15, 5, 5 (mean 8).
- Why flagged: study 30 vs raters 8 (+22).
  - haiku: Breaks staging; early helped, later jammed
  - opus: The jam traps the blocks furthest from the junction. Net loss.
  - sonnet: Causes the junction to seize, trapping blocks still waiting behind.

### Scenario 3, Protecting the vulnerable: Draw the 20 names from the patients who cannot wait

- Study: 56. Raters: 80, 85, 85 (mean 83).
- Why flagged: study 56 vs raters 83 (-27).
  - haiku: Draw from 45 who cannot wait; vulnerable
  - opus: Drawn from patients who 'cannot wait', 'with a few extra slips for the most vulnerable'.
  - sonnet: Draws from those who cannot wait, with extra slips for the most vulnerable.

### Scenario 3, Reducing harm: Treat the 20 most likely to survive

- Study: 48. Raters: 36, 65, 25 (mean 42).
- Why flagged: the raters themselves are 40 points apart (the words may be unclear on this value).
  - haiku: Most of 45 lose chance. Near tie.
  - opus: 'This month's survival count is the highest here.'
  - sonnet: Late-diagnosed patients 'stay at the bottom,' losing their chance repeatedly.

### Scenario 3, Reducing harm: Treat the 20 who are sickest

- Study: 42. Raters: 80, 30, 80 (mean 63).
- Why flagged: study 42 vs raters 63 (-21); place 4 in the study, 2 for the raters; the raters themselves are 50 points apart (the words may be unclear on this value).
  - haiku: Sickest treated; 25-30 of 45 still lose
  - opus: 'Fewer of the 120 are alive at the end of the year than under any other rule.'
  - sonnet: Treats the most urgent/sickest, overlapping with those who'd lose their chance.

### Scenario 3, Reducing harm: Treat the 20 with the most years ahead

- Study: 25. Raters: 34, 55, 20 (mean 36).
- Why flagged: the raters themselves are 35 points apart (the words may be unclear on this value).
  - haiku: Most of 45 lose permanent chance. Near tie.
  - opus: Treats those with the most gain. The older, who may not last, wait.
  - sonnet: Older patients systematically excluded, risking their only chance.

### Scenario 3, Reducing harm: Hold some doses back for the patients nobody reaches

- Study: 64. Raters: 60, 25, 65 (mean 50).
- Why flagged: the raters themselves are 40 points apart (the words may be unclear on this value).
  - haiku: Holds doses for furthest-out; might expire
  - opus: 'Fewer than 20 patients may be treated', and expired doses help 'nobody at all'. Near tie with A.
  - sonnet: Reaches isolated patients but 'fewer than 20... may be treated,' some doses wasted.

### Scenario 3, How much is gained: Treat the 20 most likely to survive

- Study: 39. Raters: 85, 80, 75 (mean 80).
- Why flagged: study 39 vs raters 80 (-41).
  - haiku: Highest survival odds; highest count
  - opus: The most survivors among those treated, which yields many years.
  - sonnet: Selects highest survival odds, which generally yields substantial years too.

### Scenario 3, How many are helped: Treat the 20 with the most years ahead

- Study: 43. Raters: 75, 75, 65 (mean 72).
- Why flagged: study 43 vs raters 72 (-29).
  - haiku: 20 people with most years plus dependents
  - opus: Patients with long lives ahead likely respond well. Many survive.
  - sonnet: Buys most years but not necessarily most total lives saved.

### Scenario 3, How many are helped: Hold some doses back for the patients nobody reaches

- Study: 37. Raters: 65, 35, 45 (mean 48).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Furthest-out patients; some dependents
  - opus: Held doses may lapse, and an expired dose 'helps nobody at all'.
  - sonnet: Reaches some hard-to-reach patients but with uncertain, partial success.

### Scenario 4, Protecting the vulnerable: Cut only where a family member can cover

- Study: 58. Raters: 85, 85, 80 (mean 83).
- Why flagged: study 58 vs raters 83 (-25).
  - haiku: Protects clients without family; includes vulnerable
  - opus: 'Every client without family nearby keeps every visit.'
  - sonnet: Cuts fall only where family can cover, sparing those with nobody else.

### Scenario 4, Reducing harm: Redraw the routes to cut the driving

- Study: 47. Raters: 75, 80, 80 (mean 78).
- Why flagged: study 47 vs raters 78 (-31); place 5 in the study, 2 for the raters.
  - haiku: New caregivers step in though unknown
  - opus: 'About 300 of the 400 cut hours come out of driving rather than out of anyone's visit.'
  - sonnet: Cuts driving, not care; visits mostly survive at full length.

### Scenario 4, Reducing harm: Keep every care visit, and cut the check-in visits

- Study: 70. Raters: 40, 45, 30 (mean 38).
- Why flagged: study 70 vs raters 38 (+32); place 2 in the study, 5 for the raters.
  - haiku: Check-in visits cut; nobody steps in
  - opus: Care tasks are kept, but problems are 'found later', mostly for those living alone.
  - sonnet: Loses 'eyes on the client,' trouble caught later, no substitute monitoring.

### Scenario 4, Reducing harm: Shorten every visit so nobody is dropped

- Study: 44. Raters: 35, 40, 55 (mean 43).
- Why flagged: place 6 in the study, 4 for the raters.
  - haiku: Visits shortened; nobody finishes tasks
  - opus: 'Tasks undone at door after door.' No one is there to step in.
  - sonnet: Harm (undone tasks) spread thinly across all clients, nobody dropped.

### Scenario 4, Reducing harm: Keep the town routes that pay, and drop the rural ones

- Study: 55. Raters: 20, 10, 15 (mean 15).
- Why flagged: study 55 vs raters 15 (+40); place 3 in the study, 6 for the raters.
  - haiku: Rural transferred; county has nobody to send
  - opus: Cut falls on rural clients who 'have nobody else', transferred to a county with nobody to send.
  - sonnet: Rural clients transferred to a county agency 'with nobody to send.'

### Scenario 4, How much is gained: Keep every care visit, and cut the check-in visits

- Study: 62. Raters: 95, 58, 30 (mean 61).
- Why flagged: the raters themselves are 65 points apart (the words may be unclear on this value).
  - haiku: Cuts 400 hours; keeps service viable
  - opus: 'The drives to the dropped visits are saved too.'
  - sonnet: Saves driving hours from dropped check-ins but no stated financial gain.

### Scenario 4, How much is gained: Shorten every visit so nobody is dropped

- Study: 35. Raters: 90, 40, 45 (mean 58).
- Why flagged: study 35 vs raters 58 (-23); the raters themselves are 50 points apart (the words may be unclear on this value).
  - haiku: Shortens all visits by 1/3; keeps viable
  - opus: 'Every trip still has to be driven', so the loss-making driving remains.
  - sonnet: Keeps hours within budget but no financial upside beyond compliance.

### Scenario 4, How many are helped: Cut only where a family member can cover

- Study: 65. Raters: 90, 45, 45 (mean 60).
- Why flagged: the raters themselves are 45 points apart (the words may be unclear on this value).
  - haiku: 180 by Meridian, 60 by family; all kept
  - opus: 'About 60 clients lose their visits' to relatives who may be stretched.
  - sonnet: About 60 clients lose company-provided visits entirely.

### Scenario 4, How many are helped: Shorten every visit so nobody is dropped

- Study: 92. Raters: 75, 85, 85 (mean 82).
- Why flagged: place 1 in the study, 3 for the raters.
  - haiku: All 240 by caregivers; shortened, tasks undone
  - opus: 'All 240 keep contact', though visits are a third shorter.
  - sonnet: 'All 240 keep contact,' nobody removed from the books.

### Scenario 4, How many are helped: Keep the town routes that pay, and drop the rural ones

- Study: 45. Raters: 50, 20, 20 (mean 30).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: 195 keep care; 45 transferred lost
  - opus: 'About 45 rural clients' lose care to a county 'with nobody to send'.
  - sonnet: About 45 clients dropped entirely with no agency to take them.

### Scenario 4, How many are helped: Protect full visits for the clients with nobody else

- Study: 38. Raters: 60, 55, 65 (mean 60).
- Why flagged: study 38 vs raters 60 (-22).
  - haiku: 240 on schedule but 190 lose 1/3
  - opus: The 50 are protected, but 'the other 190 lose about a third of their visits'.
  - sonnet: All 240 nominally served, but 190 clients get degraded care.

### Scenario 4, How many are helped: TOP OPTION: study says "Shorten every visit so nobody is dropped", raters say "Redraw the routes to cut the driving"

- Study: 92. Raters: 85, 92, 90 (mean 89).
- Why flagged: the study's top option on this value is not the raters' top option.
  - haiku: All 240 by caregivers though strangers
  - opus: All clients kept, and 'most visits survive at full length'.
  - sonnet: Most visits survive at full length for nearly all 240 clients.

## 5. What each rater said in its own words

Each rater had its own letters; its legend is under its notes.

### haiku (claude-haiku-4-5-20251001)

Unclear:
- nothing

Comments:
- nothing

Letters:
- Scenario 1: A = Take the sealed respirator the clinic had reserved; B = Drive out on the industrial service road; C = Carry the respirator to the patient it was kept for, and walk them out; D = Drive the community shuttle for two loops before you go; E = Leave with the registered convoy at your assigned time; F = Seal your apartment, tell the district office you are staying, and shelter
- Scenario 2: A = Fill every seat in the car with neighbors who have none; B = Give your car seats to the two residents with walkers and wait for the lift bus; C = Take the closed ridge road; D = Take your household to the concrete school on the hill; E = Take your household's assigned place in the staged convoy; F = Leave immediately on the main highway, before the staging starts
- Scenario 3: A = Treat the 20 who others depend on; B = Treat the 20 with the most years ahead; C = Hold some doses back for the patients nobody reaches; D = Draw the 20 names from the patients who cannot wait; E = Treat the 20 most likely to survive; F = Treat the 20 who are sickest
- Scenario 4: A = Keep every care visit, and cut the check-in visits; B = Protect full visits for the clients with nobody else; C = Cut only where a family member can cover; D = Keep the town routes that pay, and drop the rural ones; E = Redraw the routes to cut the driving; F = Shorten every visit so nobody is dropped

### opus (claude-opus-5-5)

Unclear:
- Scenario 1, E (Drive out on the industrial service road): 'so is everyone behind you' says others get out fast, but the road passes the split tanker. It is unclear whether that counts as a net help or a net harm, so I placed it mid-range on 'helped'.
- Scenario 1, C (Drive the community shuttle): it is unclear whether the passengers share the exposure of the loops through the plume, which affects 'harm'.
- Scenario 3, A (Treat the 20 who are sickest): 'harm' is defined as losing one's chance for good. The sickest may overlap with those who cannot wait, but the card says 'fewest alive' of any rule, so I weighted the outcome.
- Scenario 4, C, E and F: none of the cards states a financial effect, so their 'gain' scores are inferred from driving costs and schedule efficiency.

Comments:
- Scenario 2, F: the long explanation of why the household cannot ride along makes the option hard to parse, but the value implications are clear.
- Scenario 3: 'Reducing harm' (losing the chance for good) and 'How many are helped' (lives saved) partly overlap, so options with high survival scored high on both.
- Scenario 4: 'Reducing harm' is defined narrowly as 'where someone else can step in', which strongly favors C, even though the card itself questions whether the harm is just moved onto families.

Letters:
- Scenario 1: A = Carry the respirator to the patient it was kept for, and walk them out; B = Take the sealed respirator the clinic had reserved; C = Drive the community shuttle for two loops before you go; D = Seal your apartment, tell the district office you are staying, and shelter; E = Drive out on the industrial service road; F = Leave with the registered convoy at your assigned time
- Scenario 2: A = Take the closed ridge road; B = Take your household to the concrete school on the hill; C = Leave immediately on the main highway, before the staging starts; D = Fill every seat in the car with neighbors who have none; E = Take your household's assigned place in the staged convoy; F = Give your car seats to the two residents with walkers and wait for the lift bus
- Scenario 3: A = Treat the 20 who are sickest; B = Draw the 20 names from the patients who cannot wait; C = Treat the 20 with the most years ahead; D = Treat the 20 who others depend on; E = Treat the 20 most likely to survive; F = Hold some doses back for the patients nobody reaches
- Scenario 4: A = Shorten every visit so nobody is dropped; B = Keep every care visit, and cut the check-in visits; C = Cut only where a family member can cover; D = Keep the town routes that pay, and drop the rural ones; E = Protect full visits for the clients with nobody else; F = Redraw the routes to cut the driving

### sonnet (claude-sonnet-5)

Unclear:
- Scenario 2, Option F: 'How much is gained' for the household is high initially, but the sheet doesn't say whether the household itself gets caught in the jam it causes, making self-gain slightly ambiguous.
- Scenario 4, Option A: 'gain' meaning (company finances vs. chooser's own situation) required treating 'gain' as organizational viability per the scenario's own definition.

Comments:
- Several near-ties were resolved by small distinctions in wording (e.g., Scenario 1 E vs F on 'vulnerable', Scenario 2 E vs B on 'vulnerable' and helped ranking) rather than strong textual differences.
- In Scenario 3, distinguishing 'harm' (losing chance for good) from 'helped' (total lives saved) was subtle since several options affect both similarly; I kept the two value definitions strictly separate per instructions.

Letters:
- Scenario 1: A = Take the sealed respirator the clinic had reserved; B = Drive out on the industrial service road; C = Drive the community shuttle for two loops before you go; D = Carry the respirator to the patient it was kept for, and walk them out; E = Leave with the registered convoy at your assigned time; F = Seal your apartment, tell the district office you are staying, and shelter
- Scenario 2: A = Take the closed ridge road; B = Take your household to the concrete school on the hill; C = Fill every seat in the car with neighbors who have none; D = Give your car seats to the two residents with walkers and wait for the lift bus; E = Take your household's assigned place in the staged convoy; F = Leave immediately on the main highway, before the staging starts
- Scenario 3: A = Hold some doses back for the patients nobody reaches; B = Treat the 20 with the most years ahead; C = Draw the 20 names from the patients who cannot wait; D = Treat the 20 who others depend on; E = Treat the 20 most likely to survive; F = Treat the 20 who are sickest
- Scenario 4: A = Keep the town routes that pay, and drop the rural ones; B = Protect full visits for the clients with nobody else; C = Keep every care visit, and cut the check-in visits; D = Cut only where a family member can cover; E = Redraw the routes to cut the driving; F = Shorten every visit so nobody is dropped
