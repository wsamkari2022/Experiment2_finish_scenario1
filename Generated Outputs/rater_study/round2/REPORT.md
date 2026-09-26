# Blind option-value review: the comparison

AI-assisted blind content review (Claude models, no tools, fresh context each), adjudicated by the researcher. Not human inter-rater reliability.

## 1. The answers

| Rater | Model it reported | Valid | Problems | Notes |
|---|---|---|---|---|
| haiku | claude-haiku-4-5-20251001 | yes | - | scenario 2 vulnerable: D scored above A but ranked below it |
| opus | claude-opus-5-5 (Opus 5.5) | yes | - | - |
| sonnet | claude-sonnet-5 | yes | - | - |

- haiku probe: # Probe Results ## blind-value-rater **PASSED** 1) NONE. I have no tools available; the task explicitly states I have no tools to call. 2) COULD NOT READ. I have no file-reading tools and cannot open files per my instructions. 3) NOTHING ELSE. No project notes, CLAUDE.md, or memory files appear in m
- opus probe: # Probe result (Step 1) Organizer model: Claude Opus 5.5 (claude-opus-5-5). Both probe agents were run in the foreground with no model parameter, using the exact probe prompt from RUNBOOK.md. ## blind-value-rater **Result: PASSED.** All three rules held. Rule 1: the only tool it lists is SubagentHan
- sonnet probe: # Probe results (Claude Sonnet folder) ## blind-value-rater Reply (word for word): 1) Tools I can call: SubagentHandback - delivers my final report/message to the agent that called me; it is a one-way hand-off tool, not for back-and-forth messaging. No other tools (no file read/write, no search, no 

## 2. How much the raters agree with each other

- ICC(2,1), absolute agreement, over 72 option-value scores: **0.9** (0.75 or more is usually called good, 0.90 excellent)
- Mean Spearman correlation between two raters' orders: **0.848**
- Mean distance between two raters' scores: **9 points**

## 3. How much the raters agree with the study's numbers

Mean Spearman correlation between the study's order and the raters' order: **0.834** (1 = the same order).

| Scenario | Value | Same order? (Spearman) | Study's top | Raters' top |
|---|---|---|---|---|
| 2 | Protecting the vulnerable | 0.99 | Give your car seats to the two residents with walkers and wait for the lift bus | Give your car seats to the two residents with walkers and wait for the lift bus |
| 2 | Reducing harm | 0.90 | Take your household to the concrete school on the hill | Give your car seats to the two residents with walkers and wait for the lift bus |
| 2 | How much is gained | 0.89 | Leave immediately on the main highway, before the staging starts | Take the closed ridge road |
| 2 | How many are helped | 0.90 | Fill every seat in the car with neighbors who have none | Fill every seat in the car with neighbors who have none |
| 3 | Protecting the vulnerable | 0.83 | Treat the 20 who are sickest | Treat the 20 who are sickest |
| 3 | Reducing harm | 0.09 | Draw the 20 names from the patients who cannot wait | Draw the 20 names from the patients who cannot wait |
| 3 | How much is gained | 0.94 | Treat the 20 with the most years ahead | Treat the 20 with the most years ahead |
| 3 | How many are helped | 1.00 | Treat the 20 most likely to survive | Treat the 20 most likely to survive |
| 4 | Protecting the vulnerable | 1.00 | Protect full visits for the clients with nobody else | Protect full visits for the clients with nobody else |
| 4 | Reducing harm | 0.77 | Cut only where a family member can cover | Cut only where a family member can cover |
| 4 | How much is gained | 0.94 | Keep the town routes that pay, and drop the rural ones | Keep the town routes that pay, and drop the rural ones |
| 4 | How many are helped | 0.77 | Shorten every visit so nobody is dropped | Keep every care visit, and cut the check-in visits |

## 4. Flagged numbers, for the researcher to decide (22)

A number is flagged when it is 20+ points from the raters' mean, or 2+ places from where the raters put it, or when the top option differs. An option is also flagged when the raters are 30+ points apart among themselves: then the card's words, not its number, may be what needs a look.

### Scenario 2, Reducing harm: Fill every seat in the car with neighbors who have none

- Study: 62. Raters: 78, 90, 58 (mean 75).
- Why flagged: the raters themselves are 32 points apart (the words may be unclear on this value).
  - haiku: Uses seven spots efficiently in your slot.
  - opus: Takes "not anybody else's place in the line" and removes three neighbors from danger.
  - sonnet: Extra riders added within own slot; takes no resource from others.

### Scenario 2, Reducing harm: TOP OPTION: study says "Take your household to the concrete school on the hill", raters say "Give your car seats to the two residents with walkers and wait for the lift bus"

- Study: 94. Raters: 82, 86, 90 (mean 86).
- Why flagged: the study's top option on this value is not the raters' top option.
  - haiku: Follows convoy system; helps vulnerable faster without extra risk.
  - opus: Nobody is displaced. The household takes the bus places the residents left, and the two most at-risk leave earlier.
  - sonnet: Gives up car and slot, actively lowering risk carried by two neighbors.

### Scenario 2, How much is gained: TOP OPTION: study says "Leave immediately on the main highway, before the staging starts", raters say "Take the closed ridge road"

- Study: 95. Raters: 92, 90, 95 (mean 92).
- Why flagged: the study's top option on this value is not the raters' top option.
  - haiku: Forty minutes over ridge, out before fire reaches floor.
  - opus: "Out of the valley in forty minutes", but up a lane where the engines are coming down. Near tie with F.
  - sonnet: "Over the ridge in forty minutes" on an empty, fast road.

### Scenario 2, How many are helped: Take the closed ridge road

- Study: 25. Raters: 45, 15, 20 (mean 27).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Takes rescuer road; makes fewer people reachable.
  - opus: Delays engines on their way to the nursing home, so fewer others are likely to get out.
  - sonnet: Reversing engines may slow rescues elsewhere, reducing others helped.

### Scenario 2, How many are helped: Give your car seats to the two residents with walkers and wait for the lift bus

- Study: 39. Raters: 80, 70, 50 (mean 67).
- Why flagged: study 39 vs raters 67 (-28); the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Gets two walkers out six hours earlier than possible.
  - opus: Two walker users go "fifth of nine instead of last", but the total number leaving is roughly the same.
  - sonnet: Near tie: swaps car/bus roles, same six people out, no headcount change.

### Scenario 3, Protecting the vulnerable: Treat the 20 with the most years ahead

- Study: 18. Raters: 18, 32, 40 (mean 30).
- Why flagged: place 6 in the study, 4 for the raters.
  - haiku: Youngest get doses; sickest pushed back.
  - opus: Ranks by years ahead and ignores illness and access. "Older patients" lose.
  - sonnet: Years-ahead metric pushes older, sicker patients down the ranking.

### Scenario 3, Reducing harm: Treat the 20 most likely to survive

- Study: 48. Raters: 20, 28, 22 (mean 23).
- Why flagged: study 48 vs raters 23 (+25); place 3 in the study, 6 for the raters.
  - haiku: System-found-late patients stay at back; remain at risk.
  - opus: Favors good odds. The late-diagnosed patients, likely the most urgent, stay "at the bottom".
  - sonnet: Deprioritizes late-diagnosed patients, plausibly closest to the untreatable threshold.

### Scenario 3, Reducing harm: Treat the 20 who are sickest

- Study: 42. Raters: 45, 55, 65 (mean 55).
- Why flagged: place 4 in the study, 2 for the raters.
  - haiku: Sickest treated but some waiting will cross threshold.
  - opus: Some of the sickest cannot wait, but "some who wait... will be past treating by then."
  - sonnet: Severity overlaps with urgency but is "not the same as running out of time."

### Scenario 3, Reducing harm: Treat the 20 with the most years ahead

- Study: 25. Raters: 40, 38, 45 (mean 41).
- Why flagged: place 6 in the study, 3 for the raters.
  - haiku: Sickest remain untreated; some become too ill by next month.
  - opus: Ranks by years left, not by who is running out of time. Near tie with D.
  - sonnet: Near tie: unrelated to progression speed, but all 20 doses still used.

### Scenario 3, Reducing harm: Hold some doses back for the patients nobody reaches

- Study: 64. Raters: 50, 22, 12 (mean 28).
- Why flagged: study 64 vs raters 28 (+36); place 2 in the study, 5 for the raters; the raters themselves are 38 points apart (the words may be unclear on this value).
  - haiku: Reaches unreachable but doses may be wasted.
  - opus: "Fewer than 20 patients may be treated". "Reaching them takes weeks", and expired doses help nobody.
  - sonnet: Held doses risk expiring; a lapsed dose "helps nobody at all."

### Scenario 3, How much is gained: Treat the 20 most likely to survive

- Study: 39. Raters: 80, 80, 78 (mean 79).
- Why flagged: study 39 vs raters 79 (-40).
  - haiku: High survival odds; counts lives not years.
  - opus: The most survivors, but it "counts lives, not years."
  - sonnet: Highest survivor count, though it "counts lives, not years."

### Scenario 3, How many are helped: Treat the 20 with the most years ahead

- Study: 43. Raters: 70, 68, 55 (mean 64).
- Why flagged: study 43 vs raters 64 (-21).
  - haiku: Optimizes years; doesn't directly state lives saved.
  - opus: "Fewer of the 20 come through than under the rule that ranks by odds."
  - sonnet: Fewer survivors than the odds-based rule, but still treats 20 with fair outcomes.

### Scenario 3, How many are helped: Hold some doses back for the patients nobody reaches

- Study: 37. Raters: 50, 32, 20 (mean 34).
- Why flagged: the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Reaches unreachable but wastes doses.
  - opus: "Fewer than 20 patients may be treated", and an expired dose "helps nobody at all."
  - sonnet: Fewer than 20 may even be treated, shrinking the total helped.

### Scenario 4, Reducing harm: Redraw the routes to cut the driving

- Study: 47. Raters: 75, 78, 75 (mean 76).
- Why flagged: study 47 vs raters 76 (-29); place 4 in the study, 2 for the raters.
  - haiku: Cuts only driving; most visits intact, harm minimized.
  - opus: "About 300 of the 400 cut hours come out of driving rather than out of anyone's visit."
  - sonnet: About "300 of the 400 cut hours come out of driving," not visits.

### Scenario 4, Reducing harm: Keep every care visit, and cut the check-in visits

- Study: 70. Raters: 40, 60, 30 (mean 43).
- Why flagged: study 70 vs raters 43 (+27); place 2 in the study, 4 for the raters; the raters themselves are 30 points apart (the words may be unclear on this value).
  - haiku: Check-in loss means trouble found late.
  - opus: Care tasks are kept, but trouble is "found later", and nobody steps in for those who live alone.
  - sonnet: Losing check-ins removes the "eyes on the client"; trouble "found later."

### Scenario 4, Reducing harm: Shorten every visit so nobody is dropped

- Study: 44. Raters: 10, 38, 55 (mean 34).
- Why flagged: the raters themselves are 45 points apart (the words may be unclear on this value).
  - haiku: All 240 harmed equally; nobody steps in.
  - opus: Every visit is shortened, with "tasks undone at door after door", and nobody steps in.
  - sonnet: Uniform shortening leaves "tasks undone at door after door"; nobody substitutes.

### Scenario 4, Reducing harm: Protect full visits for the clients with nobody else

- Study: 54. Raters: 80, 45, 45 (mean 57).
- Why flagged: the raters themselves are 35 points apart (the words may be unclear on this value).
  - haiku: 190 with support absorb cut; harm where stepping in possible.
  - opus: The cut falls on the 190 who have others at home, but they lose a third of visits and the schedule breaks down.
  - sonnet: 190 absorb the whole cut; schedule "rewritten," strain compounds with no substitute.

### Scenario 4, How much is gained: Protect full visits for the clients with nobody else

- Study: 22. Raters: 58, 24, 25 (mean 36).
- Why flagged: the raters themselves are 34 points apart (the words may be unclear on this value).
  - haiku: Saves no driving; week rewritten constantly.
  - opus: No driving is saved, and "the schedule is being rewritten by the middle of the week."
  - sonnet: Near tie: "none of the money-losing driving is saved"; internal rewrite only.

### Scenario 4, How many are helped: Keep every care visit, and cut the check-in visits

- Study: 80. Raters: 84, 92, 88 (mean 88).
- Why flagged: place 3 in the study, 1 for the raters.
  - haiku: All 240 keep essential care tasks and professional contact.
  - opus: "Every client keeps the care they are assessed for". Nobody loses a bath, a meal or a dose.
  - sonnet: Every bathing, feeding, medication visit kept for all 240 clients.

### Scenario 4, How many are helped: Shorten every visit so nobody is dropped

- Study: 92. Raters: 75, 75, 65 (mean 72).
- Why flagged: study 92 vs raters 72 (+20); place 1 in the study, 3 for the raters.
  - haiku: All 240 kept with shortened visits; reach maintained.
  - opus: "All 240 keep contact", but with "tasks undone" at every door. Near tie with E.
  - sonnet: All 240 keep contact, though visits come out "about a third shorter."

### Scenario 4, How many are helped: Keep the town routes that pay, and drop the rural ones

- Study: 45. Raters: 42, 18, 15 (mean 25).
- Why flagged: study 45 vs raters 25 (+20).
  - haiku: 195 kept fully; 45 completely abandoned.
  - opus: About 45 clients lose their care entirely, and the county has "nobody to send."
  - sonnet: About 45 rural clients lose company service completely, "nobody to send."

### Scenario 4, How many are helped: TOP OPTION: study says "Shorten every visit so nobody is dropped", raters say "Keep every care visit, and cut the check-in visits"

- Study: 92. Raters: 84, 92, 88 (mean 88).
- Why flagged: the study's top option on this value is not the raters' top option.
  - haiku: All 240 keep essential care tasks and professional contact.
  - opus: "Every client keeps the care they are assessed for". Nobody loses a bath, a meal or a dose.
  - sonnet: Every bathing, feeding, medication visit kept for all 240 clients.

## 5. What each rater said in its own words

Each rater had its own letters; its legend is under its notes.

### haiku (claude-haiku-4-5-20251001)

Unclear:
- nothing

Comments:
- nothing

Letters:
- Scenario 2: A = Leave immediately on the main highway, before the staging starts; B = Take your household to the concrete school on the hill; C = Fill every seat in the car with neighbors who have none; D = Take the closed ridge road; E = Take your household's assigned place in the staged convoy; F = Give your car seats to the two residents with walkers and wait for the lift bus
- Scenario 3: A = Treat the 20 with the most years ahead; B = Treat the 20 who others depend on; C = Draw the 20 names from the patients who cannot wait; D = Treat the 20 who are sickest; E = Treat the 20 most likely to survive; F = Hold some doses back for the patients nobody reaches
- Scenario 4: A = Cut only where a family member can cover; B = Shorten every visit so nobody is dropped; C = Protect full visits for the clients with nobody else; D = Keep the town routes that pay, and drop the rural ones; E = Keep every care visit, and cut the check-in visits; F = Redraw the routes to cut the driving

### opus (claude-opus-5-5 (Opus 5.5))

Unclear:
- Scenario 2, C (Give your car seats to the two residents with walkers): for 'How many are helped', the two residents would have left on the lift bus anyway. They get out sooner, not in addition, so the count of 'more people out' is unclear.
- Scenario 2, B (Take your household to the concrete school on the hill): for 'How much is gained', the household shelters in place and never gets out of the valley. The value is worded as 'gets out', so it is unclear how to score an option that does not leave.
- Scenario 3, A (Hold some doses back for the patients nobody reaches): the card does not say how the doses that are not held back are allocated. That affects its harm, gain and helped scores.
- Scenario 3, D (Treat the 20 who others depend on): 'How many are helped' explicitly counts lives saved through people others depend on, but the card gives no direct survival comparison with E or B.
- Scenario 4, E (Redraw the routes to cut the driving): the card does not say whose visits the remaining 100 cut hours come from, so it is unclear who bears them.

Comments:
- Scenario 4, 'Reducing harm' ('cut lands where someone else can step in') almost restates Option B's mechanism. B scores high even though its card says families 'absorb work they never agreed to'.
- Scenario 4, D: protecting the 50 who live alone means the cut falls on clients who do have someone at home. That partly fits the 'Reducing harm' definition, even though the card stresses the scheduling disruption.
- Scenario 2, A vs F on 'How much is gained': both are very fast. F's card calls itself 'the fastest', while A is timed at 'forty minutes' on a lane with engines coming down. I ranked them as a near tie.
- Scenario 3, F's card says it leaves fewer alive at year end 'than under any other rule here'. I used that to put F below A and C on gain and helped, even though A may leave doses unused.

Letters:
- Scenario 2: A = Take the closed ridge road; B = Take your household to the concrete school on the hill; C = Give your car seats to the two residents with walkers and wait for the lift bus; D = Fill every seat in the car with neighbors who have none; E = Take your household's assigned place in the staged convoy; F = Leave immediately on the main highway, before the staging starts
- Scenario 3: A = Hold some doses back for the patients nobody reaches; B = Treat the 20 with the most years ahead; C = Draw the 20 names from the patients who cannot wait; D = Treat the 20 who others depend on; E = Treat the 20 most likely to survive; F = Treat the 20 who are sickest
- Scenario 4: A = Keep the town routes that pay, and drop the rural ones; B = Cut only where a family member can cover; C = Keep every care visit, and cut the check-in visits; D = Protect full visits for the clients with nobody else; E = Redraw the routes to cut the driving; F = Shorten every visit so nobody is dropped

### sonnet (claude-sonnet-5)

Unclear:
- Scenario 2, Option F (helped value): the sheet's headcount-based definition makes it hard to distinguish F from E/B since all three leave total evacuee numbers unchanged - only timing/safety shifts, which the 'helped' value as defined does not capture.
- Scenario 3, Option F (harm value): unclear whether reserved doses correlate at all with the 'cannot wait' progression-risk group, or are simply a separate axis (distance) from timing.

Comments:
- In Scenario 4, the 'gain' value (financial) and 'reducing harm' value (someone steps in) sometimes pull in the same direction for Option A/C, making it hard to keep the two values fully independent - I rated each strictly on its own card text.
- Scenario 3's 'protecting the vulnerable' definition bundles two distinct criteria (sickest now vs. hardest to reach), which options C, F, and B each satisfy via a different one, complicating a clean single ranking.

Letters:
- Scenario 2: A = Fill every seat in the car with neighbors who have none; B = Take your household to the concrete school on the hill; C = Leave immediately on the main highway, before the staging starts; D = Take the closed ridge road; E = Take your household's assigned place in the staged convoy; F = Give your car seats to the two residents with walkers and wait for the lift bus
- Scenario 3: A = Treat the 20 with the most years ahead; B = Draw the 20 names from the patients who cannot wait; C = Treat the 20 who are sickest; D = Treat the 20 who others depend on; E = Treat the 20 most likely to survive; F = Hold some doses back for the patients nobody reaches
- Scenario 4: A = Cut only where a family member can cover; B = Shorten every visit so nobody is dropped; C = Keep the town routes that pay, and drop the rural ones; D = Keep every care visit, and cut the check-in visits; E = Protect full visits for the clients with nobody else; F = Redraw the routes to cut the driving
