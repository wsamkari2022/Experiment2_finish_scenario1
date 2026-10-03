# How to analyze the VRDS Experiment 2 data

**Who this is for.** Anyone — a person or an AI agent — who has the MongoDB `participants`
collection in front of them and has to turn it into findings and figures for a paper.

**Read `HOW_TO_READ_MY_DATABASE.md` first.** That file is the field dictionary: where every number
lives and what it literally means. This file is the next step: which questions the study can answer,
which analyses answer them, what you are allowed to claim, and what will get the paper rejected.
**Then `docs/ANALYSIS_AND_FIGURES_PLAN.md`** (27 September 2026): the full plan of analyses and figures for the
paper, with the field for each, the test, and the hypotheses to freeze first.

**The single most useful habit:** before reporting any number, ask what it would look like if the
effect were absent. Most of the traps below are cases where the absent-effect version and the
present-effect version produce the same number.

> **Updated 3 October 2026.** **Baseline** (condition 4) now hides the fit score and the ranking reasons on its option
> cards and gives every choice the same confirmation page with "How sure", so it differs from the other three for every
> participant, not only after a misfit (4.9, 9.1, 9.6).

> **Updated 2 October 2026.** The study now has **four conditions** (1 October 2026), and **section 9** says what
> differs between them, what each records and how to analyse them. **Stability** is now the average of two parts (its
> order and how far the values moved; sections 3 and 4.12), and a four-condition audit corrected what a few rows record
> (4.9, 9.6).

> **Updated 15 September 2026.** Three new things can be analyzed that could not be before:
> **`analysis.alignment_records`** (the fit and both reflection steps, one row per scenario),
> **`analysis.position_effect.between_scenarios`** (every scenario against every other one), and
> **`analysis.mpf_predictions_every_scenario`** (the predictor run over all six scenarios), and
> **`analysis.mpf_prediction_percentages`** (the same predictions cut to three numbers per
> scenario: what the model expected, what they took, and the distance between the two).
> Sections 3, 4.5, 5.7 and 6 below. One page of timings was also removed — see
> `HOW_TO_READ_MY_DATABASE.md` section 8.

---

## 1. What the study actually is

A participant answers four question blocks, which build a **value profile**: seven sensitivities,
each 0–100, four of which are the *policy* values that everything downstream uses.

| Internal key | Participant-facing name | What it measures |
|---|---|---|
| `vulnerabilityProtectionSensitivity` | Protecting the vulnerable | WHO is harmed |
| `groupSizeSensitivity` | Reducing harm | HOW MANY are spared |
| `outcomeAggregationSensitivity` | How many are helped | HOW MANY are helped |
| `gainResponsivenessSensitivity` | How much is gained | HOW MUCH is gained |

Then **six scenarios**. The first five are emergencies with six options each. The sixth is different
in every way and has its own section below.

The block's designed manipulation is **who carries the cost** (`stakePosition`), and it is the only
thing deliberately varied across the five emergency scenarios.

**Since 1 October 2026 there is a second manipulation, between participants: the condition.** Each participant is in
one of four (`condition_type`: CVR+APA, CVR_Only, APA_Only, Baseline). They share Blocks 1-4 and differ only in what
happens after a choice that goes against the participant's best fit in scenarios 1-4. Section 9 has the full table.

---

## 2. Choosing your sample

```js
db.participants.find({ status: "Study Completed" })
```

**Always filter on `status`.** Unfinished runs hold real but partial data and will quietly bias
every average. A participant who stopped after Block 2 has a value profile and no scenarios.

Then decide, in advance and in writing, what to do about `quality`:

| Field | What it flags |
|---|---|
| `quality.met_time_requirement` | Reached the 35 active minutes the payment rule requires |
| `quality.straightlined_feedback` | Gave the same rating to everything |
| `quality.blocks_under_30_seconds` | Blocks finished impossibly fast |
| `quality.scenarios_under_15_seconds` | Scenarios clicked through |
| `quality.compensation_eligible` | The combined verdict |

**Group every comparison by `condition_type`** (section 9.2). `condition_source` says how the condition was given:
`landing_page` (the balanced count), `address` (a tester who opened a condition on purpose) or `random_offline` (no
server). A record with no condition was made before 1 October 2026 and ran condition 1.

**`compensation_eligible` is a payment decision, not an analysis decision.** Do not silently use it
as an exclusion rule. Decide your own criteria, state them, and report how many participants each
one removed. A paper that reports one N and no exclusion table invites the question of what was
dropped.

---

## 3. The measures, and the question each one answers

| Measure | The question it answers | Where |
|---|---|---|
| **VCI (consistency)** | Did your choices match your values, judged as they stood at the time? | `headline.consistency_score` |
| **Stability** | Did your values stay the same when you went against your best fit? Since 2 October 2026 the average of two parts: did their order change, and how far did they move | `headline.stability_score` (parts: `value_order_stability`, `value_difference_stability`) |
| **Condition** | Which version of Block 5 did this participant meet? | `condition_type` (section 9) |
| **The condition's own page** | Did they meet it, and what did they do there? | `analysis.alignment_records.by_scenario[i]`: `cvr`, `apa`, `cvr_rejection_page`, `baseline_confirm`; `telemetry` (9.3) |
| **Performance** | How much outcome quality did your **decisions** capture? Scenarios 1-4 only since 25 September 2026: a wish decides nothing, and scenario 6 scores 50 for every rule | `headline.performance_captured` |
| **Position effect** | Did you choose differently depending on who carried the cost? | `analysis.position_effect` |
| **Position, pair by pair** | How far apart were these two particular choices — alone against with dependents, say? | `analysis.position_effect.between_scenarios` |
| **Alignment** | Did the choice fit their values, and what happened when it did not? | `analysis.alignment_records` |
| **MPF accuracy** | Could the model predict a sixth choice? | `analysis.scenario6_mpf_test` |
| **MPF calibration** | Across every scenario, does a 30% prediction come true 30% of the time? | `analysis.mpf_predictions_every_scenario` ⚠️ read 5.7 first |
| **How far off the model was** | When it missed, by how much? | `analysis.mpf_prediction_percentages` → `points_behind_the_most_expected_option_at_final_choice` |
| **Spread of the run** | Did they finish in one sitting or come back across days and machines? | `sessions.total_logins`, `sessions.browsers_used` (not `active_time.sittings`) |
| **Self-recognition** | Did you accept the model's account of you? | same |
| **Reactivity** | Did being shown a prediction change what you did? | same |

**Read VCI against 50, not against 0.** Each scenario scores the chosen option's place in line on
its own menu, so choosing blindly averages exactly 50 and the lowest possible score is 10. (A
responder who ALSO answers the reflection pages at random averages 56-57, not 50: the APA page lists
only the options built on the value they name, which steers some random choices toward a fit.) A VCI of
56 is "a little better than chance", not "56% consistent". Levels: Highly Consistent 90+, Mostly
Consistent 80–89, Moderate 65–79, Low 50–64, Very Low 30–49, Highly Inconsistent below 30. It is
ordinal and built on four scenarios, so it has only 30 possible values; treat small differences
between participants with care. Full method: `docs/BLOCK5_VCI_METHOD.md` in the code.

**VCI and Stability are deliberately different questions**, and this is worth a sentence in the
paper. A participant can be perfectly consistent and still have unstable values: they keep choosing
what fits them *as they currently are*, while what they currently are keeps changing. Do not treat
one as a robustness check on the other.

---

## 4. Things that will produce confident nonsense

### 4.1 Correlating a derived field with what it came from

`headline` and `analysis` are **computed from** `blocks`. Correlating `headline.consistency_score`
with the Block 5 choices it was calculated from is not a finding, it is arithmetic.

### 4.2 Treating a censored measure as continuous

Two measures in this dataset need care before they are averaged: one stops at a bound, the
other is coarse.

| Measure | How it is censored | What to do |
|---|---|---|
| Alignment / fit score | Until 24 September 2026 it stopped at 0, and a demanding participant pushed several options there. It is now a share of each participant's own maximum | Across participants use `points_short_of_what_they_asked_for` (saved since 24 September 2026), which is on one scale for everybody |
| Stability | Coarse, and everyone who never met a conflict piles up at 100. Its order part has 13 possible values (100 down to 0 in steps of 8.3); since 2 October 2026 the score averages it with a difference part, so it takes more values but still comes from at most four steps | Do not model it as continuous; show its distribution. **Since 26 September 2026 `headline.stability_was_measured` says who never met a conflict** (their 100 measures nothing): filter on it before averaging, or report the two groups apart. In the pretend-participant report, 38 in 100 people true to their top value are never measured |
| Value movement | Scores stop at 0 and 100, so a move past an edge is cut off. A value at the edge "does not move" whatever the participant does | Check `analysis.value_moves_asked_for_and_made` (since 24 September 2026) and report participants with cut-off moves separately |

**The alignment floor used to matter more than it does.** Until 14 September 2026 the ranking itself
was computed from the floored score, which meant options tied at 0 were ordered alphabetically by
their internal id. That is fixed — ranking now uses the uncensored shortfall — but if you ever load
data written before that date, check its date (`completed_at`; the document carries no stamp of the study code's
version) and do not pool it with later records.

### 4.3 Reading `departure` as distance from values

The position section carries both a raw `distance` and a `departure_share`. **They answer different
questions and the share is almost always the one you want.** The raw distance depends on how far
apart that scenario's six options happen to sit, so a participant can look more extreme in one
scenario purely because its menu was wider. `departure_share` divides by the room the menu allowed.
The database guide has the long version of this under "the single most misread pair of numbers".

### 4.4 Claiming a position effect the design cannot support

**Read this before writing anything about the position effect.** No `stakePosition` appears in more
than one scenario. Each of the five positions occurs exactly once, which means position is perfectly
confounded with scenario content and with order. "Deciding for others" is always the cancer
scenario, and it is always third.

The Position Effect number is therefore **descriptive**. It says this participant behaved
differently across these five situations. It cannot say that the *chair* caused it rather than the
subject matter or fatigue. The validation suite says so itself: three of its gates skip for exactly
this reason.

**The one exception, and it is a good one.** Scenarios 4 and 5 are a matched pair: the same employer,
the same decision, the same six options. Only the chair changes — deciding for colleagues, versus
having it done to you. `analysis.position_effect.authority_vs_receiving` is the cleanest causal
reading in the whole study, because everything except position is held constant. **Lead with this
comparison, and present the five-scenario number as description.**

**The five-scenario number cannot tell a person who truly changes with their role from a random
chooser** (audit P2; accepted and stated by the researcher, 26 September 2026). Both reach a Position
Effect of 100 in `npm run validate:position`. The check that would separate them (does the SAME role,
met twice, give the same answer?) needs one role to appear twice, and in this deck none does, so the
suite skips those three gates on purpose. So: never read a high five-scenario number as "this person
changes with their role"; report it as a description of the group, next to VCI (a random chooser also
scores near 57 on VCI, a person who follows their values higher), and lead with the scenario 4/5 pair.

**What scenario 5 is for** (the researcher's design, written down 25 September 2026). The participant
has just decided scenario 4, including its reflection; scenario 5 shows the same six options with
only their role changed, so no reflection runs there on purpose. Either they wish for what they
decided (every gap is 0), or they wish for something else because it helps or hurts them more. The
reading is `analysis.position_effect.decided_versus_wished.wish_minus_decision_by_value`: which value
rose and which fell when the decision landed on them. Beside it,
`wish_minus_decision_by_performance_metric` says the same for the five performance metrics: whether
the option they wished for performs better or worse than the one they decided, and where (positive
= better on every metric). Both choices are judged on the same values
(those they opened scenario 4 with), so a difference is the person, not a moved ruler. The wish is
never averaged into VCI, Stability or performance. One person's wish is one choice: report the
per-value shifts for groups (for example the mean shift in "protecting the vulnerable" across
participants, with its spread), not as a verdict on one person. Records saved before 25 September
2026 were judged on different values (`wish_scored_on_the_same_values_as_the_decision: false`);
analyse them separately.

---

### 4.5 Counting a lifted scenario twice

`blocks.block5_scenario_5_wish_on_the_receiving_end` and `blocks.block5_scenario_6_veil_of_ignorance`
are **copies** of rows that are also inside `scenarioResults`. They exist because neither scenario is
the same kind of thing as the four around it and both were easy to miss.

An aggregate that walks `scenarioResults` *and* reads the lifted copies counts those two
participants' answers twice. Each copy names its source in `this_is_a_copy_of`; use one or the
other.

### 4.6 Treating an Aligned label as a good fit

In `analysis.alignment_records` the label is **rank-based**. The best-fitting option in a scenario is
labeled Aligned even when it fits the participant badly, and every scenario produces exactly one
Aligned option by construction.

So "this participant made 4 Aligned choices out of 4" means *they took the top of the menu every
time*, not *the options suited them*. If you want the second claim, use
`fit_percent_of_what_they_asked_for`: the share of what the participant's four values asked for that
the option gives (since 24 September 2026; it no longer stops at 0). It is a share of each
participant's own maximum, so compare it within a participant. Across participants use
`points_short_of_what_they_asked_for`, the raw shortfall, which is on one scale for everybody (saved
since 24 September 2026; for older rows rebuild it, HOW_TO_READ_MY_DATABASE.md, section 6d, trap 2).
Rows saved before 24 September 2026 are on the old scale, under
`old_fit_score_saved_before_24_september_2026`: never pool the two.

### 4.7 Reading "chose card 1" as "chose by their values" (or the other way round)

The planner orders the cards so that the first card is **not simply the best fit**. It is, in
practice, almost always **the option that is best on the participant's #1 value**. Often that is also
their best fit. Measured on 26 September 2026, after the Fix 7 option numbers (`npm run report:planner-overlap`, 4,000 pretend
participants of each kind, real scoring from Blocks 1-4 to the card order), out of 100 people:

| Scenario | First card = best fit (steady answerers) | They differ | First card = best fit (random answerers) |
|---|---|---|---|
| Six Hours to Clear the District | 56 | 44 | 50 |
| Eight Hours Ahead of the Fire | 62 | 38 | 47 |
| Limited Cancer Treatment Allocation | 62 | 38 | 52 |
| The Care Visits You Have to Cut | 50 | 50 | 41 |
| The Same Cut, Decided Without You | 50 | 50 | 41 |

Chance would be about 17 (one card in six). "Steady" pretend participants answer like a real person:
one base answer, a small real preference, and sometimes one answer one step off. Their profiles are
clearer, so the #1-value champion is more often also their best fit. Real participants are expected
to sit nearer the steady numbers.

**What this means for analysis** (the researcher's decision, 24 September 2026: accept, state and
analyse both):

- A choice of card 1 is **ambiguous in 50-62 cases out of 100**: first place and best fit are the same
  card, so either could explain it.
- The **38-50 cases out of 100 where they differ** are the ones that can separate a position effect
  from a values effect. Say so, and report how many such cases the sample actually had
  (`analysis.card_order_by_scenario.by_scenario[].the_first_card_was_also_the_best_fit_card`).
- Put **both** in the same model: the chosen card's position on screen (`choiceRank`, or
  `position_of_the_card_chosen`) and its fit place (`selectedRank`, or `is_the_best_fit_card`). Never
  use one as a stand-in for the other.

**How the participant's own ranking is used, ties included** (audit C7, written down 26 September 2026).
The planner orders every scenario's cards by ONE ranking of the four values: the one the participant
brought into Block 5. It counts a 1-point lead of value #1 over value #2 exactly like a 50-point lead,
so when the two are close, the whole card order rests on a small difference in the Blocks 1-4 answers.
An exact tie in the Blocks 1-4 scores is broken by a coin made from the participant's own answers (since
24 September 2026; `analysis.blocks_1_to_4_checks.tied_values` names the tied values); a near-tie counts
in full. The gap is saved for every record, old and new:
`analysis.card_order_by_scenario.how_close_the_top_two_values_were.gap_in_points` (whole points). With
4,000 pretend participants answering Blocks 1-4 (`npm run report:planner-overlap`, 26 September 2026):

| Pretend participants | Same score | Within 2 points | Within 5 | Within 10 | Median gap |
|---|---|---|---|---|---|
| Steady | 2 in 100 | 7 | 16 | 28 | 20 points |
| Random | 2 in 100 | 7 | 18 | 31 | 18 points |

Put the gap in any model of card position as a covariate, or check that a position finding holds when
the closest cases are left out. **Fix the cut-off before looking at the data** (for example "within 5
points"), and say which one was used. The order rule itself was not changed (counting wins under both
orders when #1 and #2 are close would change the order, and is a separate decision).
- Do not claim the order is independent of fit. It is not, by design, and the numbers above are the
  size of the dependence.
- A cleaner separation would need a design change (for example a randomly ordered control group).
  It was considered and not adopted; name it as a limitation.

### 4.8 Reading one person's score as a verdict about them

VCI, Stability and Performance are **good for comparing groups and rough for one person**. Checked
on 24-25 September 2026 with pretend participants scored by the real code (Blocks 1-4 answers, then
all six scenarios): the same pretend person run through Block 5 twice gets scores that agree only
this much (1 = identical every time, 0 = no relation; research usually wants 0.70 or more before
judging one person):

| Score | Same person twice |
|---|---|
| VCI (overall) | 0.45-0.48 |
| Stability | 0.34-0.38 |
| VCI acted (scenario 4, one choice) | 0.27-0.28 |
| Performance | 0.15-0.21 |

The reason is simple: only four choices count, and one person's four choices carry a lot of luck.
**Only scenarios 1-4 can move the profile** (audit B7, written down 26 September 2026): scenario 5 is a
wish and scenario 6 a test of the model, and neither updates anything. So a person's value movement is
at most four steps, Stability has only 13 possible values, and many people never meet a step that
counts at all (`stability_was_measured`). Describe value movement for groups and compare groups (kinds
of chooser, conditions, the scenario 4/5 pair), never as the story of one person's changing values. The
same scores separate KINDS of people well: someone who follows their own top value scores above a
random chooser on VCI 97 times in 100, and on Stability 90 times in 100. So report means and spreads
for groups, and never write "participant 12 is inconsistent" from one VCI.

**Following your own values costs performance in this deck.** Pretend participants who always take
the option that serves their top value average 40 on performance; random choosers 51; best-fit
pickers 52-60; a performance chaser 100. That is the trade-off the study is built on (each option
champions a value, and the champions are rarely the strongest performers), not a flaw in the score.
Say it whenever performance is reported beside VCI.

### 4.9 Screens that changed while the study was running - do not pool across them

Each line changed what participants saw, so records made before the date are not directly comparable
on that point. Check each record's own dates (for example `completedAt` in
`blocks.block5_emergency_scenarios`) before pooling.

| Since | What changed on screen |
|---|---|
| 23 September 2026 | Option cards start folded; a card never opened is a card never read |
| 24 September 2026 | The "Has a cost" tag and the divider "These cost you something on the value you ranked first" came off costed cards (the bin is still computed, sorted and stored) |
| 24 September 2026 | The "confirm keeping" question no longer shows "which you rated N out of 100" |
| 24 September 2026 | One planner card sentence reworded (the trade line) |
| 24 September 2026 | The fit number on cards became a share of what the participant asked for (the order of options did not change) |
| 24 September 2026 | The side-panel sentence no longer says each option "is labeled by how well it fits" |
| 25 September 2026 | Scenario 5: no "Preview impact", the wish line on the performance bars, and fit numbers shown on the values scenario 4 opened with |
| 26 September 2026 | "How to read the four values" and the sidebar's "Your value priorities" merged into one panel, "Your values in this scenario", which can be minimized and pinned. Same information, one place |
| 26 September 2026 | Scenario 2: two option numbers changed ("Fill every seat" harm 50 -> 62, "Leave immediately" vulnerable 44 -> 35), so fit numbers, labels and card order there differ for about 1 person in 3 |
| 26 September 2026 (later the same day) | Fix 6, the blind-rater numbers: nine option numbers in scenarios 1, 2 and 4 (and scenario 5's copies), listed in CLAUDE.md. Fit numbers, labels and card order change: the best fit for about 1 person in 5 or 6 in scenarios 1, 2 and 4, the card order for about 7 in 10 in scenario 2 and 6 in 10 in scenario 4. "Leave immediately" went to 14 / 20 / 95 / 8 (its gain 95 is the researcher's reading of its card, above the ridge road), so it is scenario 2's gain champion and the best fit for about 1 person in 100; both convoys now count as built on Reducing harm |
| 26 September 2026 (evening) | Fix 6 Part B: new words on seven cards (scenarios 3, 4 and 5) and on two value meanings (scenario 2 "How many are helped", scenario 3 "Reducing harm"), listed in CLAUDE.md. No number changed with them |
| 26 September 2026 (evening) | Scenario 3: "Protecting the vulnerable" now means the patients "most ill right now"; the "sickest" card and the draw card each say how being most ill today differs from running out of time. No number changed |
| 26 September 2026 (night) | Fix 7, rater round 2: eight value numbers in scenarios 3-5 and fifteen performance numbers in scenarios 1-5 (listed in CLAUDE.md). Fit numbers, labels and card order change in scenario 3 (best fit for about 1 person in 5) and scenario 4 (about 1 in 4), and the performance bars, the performance chips on the cards and scenario 3's top performer change in all four decisions |
| 26 September 2026 (night, later) | Fix 7b: two reliability numbers (scenario 1, Seal your apartment 40→23; scenario 3, Treat the 20 who are sickest 35→26; listed in CLAUDE.md). No fit number, label or card order changes. "Performance Nth of 6" changes on four cards (scenario 1: the sealed respirator 5th→4th, Seal 4th→5th; scenario 3: the sickest 5th→6th, Hold some doses back 6th→5th), the shuttle's "Least reliable" chip becomes "Resources spared 5th of 6", and the two options' reliability bars change. Scenario 3's worst performer changed, so its end-of-study performance scale moved (0.5 points or less on average, one person at most 4) |
| 26 September 2026 (night, last) | Fix 7c: when two of an option's measures share a place, its card now shows the one furthest from the scenario's average instead of the one the alphabet picked. One performance chip changes on 12 cards (scenario 1: the convoy "Resources spared 4th" → "Durability 4th", Seal "Slowest" → "Least reliable"; scenario 2: Leave immediately "Hardest to undo" → "Shortest-lived"; scenario 3: the survival rule and the essential workers "Durability" → "Speed", the sickest "Durability 5th · Hardest to undo" → "Speed 5th · Least reliable"; scenarios 4 and 5: Keep every care visit, Cut only where family covers, Protect full visits "Heaviest on resources" → "Least reliable"), and 4 cards swap the order of their two best chips. No number, score, card order or saved field changes; chips are not saved, so a record's date is the only way to tell which chips it saw |

| 27 September 2026 | The MCF readings (Compare all options) have new words: three sizes each way ("slightly", plain, "well" above or below where you stand), "Most of all on X, because you hold it more strongly than Y" when X is not the biggest gap, "exactly where you stand", "where you stand" instead of "what you asked for", a new intro that says what above and below mean, and a value-by-value row for each of the four values, strongest first, with colored tags. Same numbers underneath (`analysis.mcf` unchanged apart from one new field). In the same overlay, the values chart's caption and the "How to read these charts" note now say an option "falls below where you stand on that value" (was "gives up something you said mattered"); the dashed shapes are unchanged. The page before Block 5 (section 3) now says the dashed line shows "where an option reaches above where you stand and where it falls below it" (was "past what you asked for"), and adds one sentence naming the MCF panel: in the first five situations it lets you open any option and read, value by value, whether it sits above or below where you stand, and how far, and it never tells you which option to choose |
| 27 September 2026 | Scenario 6: no MCF inside Compare all options (the two charts stay), and no "Your values in this scenario" panel at all. Before this date both were on that page, so a scenario-6 choice made before it may have been made after reading which rule meets the person's values. `analysis.mcf.by_scenario[].could_be_opened_in_this_scenario` is false for scenario 6 |

| 28 September 2026 | The results page shows a second consistency card, "Value Consistency, all six (VCI_all)", beside VCI, and VCI's card now says it covers "the four scenarios where you made the decision and knew your position (scenarios 1-4)". Two columns of cards instead of three. Nothing on the scenario pages changed |
| 28 September 2026 | The thank-you page has no "Finish" button any more (it reset the browser to the start screen). No data changes: completion is recorded when the feedback is submitted |
| 28 September 2026 | The charts page ("A picture of your journey", after all choices, before the feedback) was refreshed: scenario 6 appears (a choice row, the value line to S6, a "behind the veil" row drawn apart, a card with the rule and the MPF's guess, reconsidering), the consistency card shows VCI and VCI_all with VCI_all's six parts, the wish's value-by-value change is drawn, and Block 4 has a card. A finished participant who reloads now sees the thank-you page, not the form. No stored data changes |
| 28 September 2026 | The results page no longer says "Complete" / "Main Simulation Complete": it says "Scenarios done · 1 step left" over "Here are your results", shows a "One last step" card with a Continue button under the four score cards (about 5 to 10 minutes; it completes the study, which the $5 gift card needs), and a slim "1 step left" bar at the bottom of the screen on the results and charts pages. The progress bar marks Feedback "next" there, and on a phone it now slides to the current step. **Compare feedback completion and `TOOL_resultsPage` across this date with care**: before it, the only way on was the button at the very bottom. `analysis.results_page` records which button was used (HOW_TO_READ 6m) |
| 28 September 2026 | The charts page, after all choices: scenario 6 is now a gray bar of its own in "How far each choice sat from the person you were" (still outside the Position Effect), and a new card, "What our software expected, and what you chose", shows the MPF's favourite and the final choice in all six scenarios with the percentage points between them. **From this date the MPF's numbers for scenarios 1-5 were on screen after the choices** for anybody who opened the charts page (`analysis.results_page.times_charts_opened`); the feedback asks nothing about the MPF. No stored data changes |
| 29 September 2026 | A refresh, or a new browser or device, now continues Block 5 at the unfinished scenario (it restarted at scenario 1) and continues Blocks 2 and 3 where they stopped (Block 2 restarted). A half-done Block 5 scenario starts again and its row carries `restartedAfterLeaving`. A browser or tab that is no longer the participant's shows "This study is open somewhere else" / "open in another tab" and stops. No score changes |
| 29 September 2026 | The results page shows a Stability_all card beside Stability (Stability over all six scenarios), and the Stability card now says it covers scenarios 1-4. Performance spans the full width under the four. No other score or screen changes |
| 29 September 2026 | The results page is redesigned, and the charts move after the feedback. The results page opens with "What your results show" (what the first parts measured, what the six scenarios measured, and that the scores compare the two), then shows the scores in three colored boxes: value alignment (VCI and VCI_all, "We call it your value consistency"), stability (Stability and Stability_all, "who you were before the scenarios with who you became", with "Not tested" when no moment tested it) and performance. Then come the four values before and after the scenarios, the "One last step" card, every scenario as a compact card (its title, the place the participant stood, the choice, the label, "Reflection shown" instead of "CVR shown", "Kept after reflection", Fit, and the note; scenario 6 says "our software" instead of "the MPF"), and a note naming what the thank-you page will show. The "View your results as charts" button is gone: the charts are on the thank-you page, after the feedback, in five tabs ("Your values", "Your choices", "Who carried the cost", "Our predictions", "Your first answers"). A feedback answer can therefore no longer follow a look at the charts. `analysis.results_page` lost its chart fields. No score changes |
| 2 October 2026 | **The four-condition audit:** a scenario card now says "Reflection shown" when the reflection was shown and the participant then went back to a good fit (most often condition 2, after the CVR Rejection page); in condition 3 a card says "Clarification shown" also when the participant went back from the APA page to a good fit, and a misfit confirmed on that page reads "This went against your usual values. The clarification page opened, and this is the option you confirmed there." (it said "you chose to reconsider", which was untrue there). A second view opened before going back now counts for the two-views feedback questions and the results page's sentence about it. Nothing else on screen changed; in the data, `cvr.fired` and `telemetry.cvrTriggered` are true on those rows, and Baseline's page visits are counted (9.3, 9.6) |
| 2 October 2026 | **Stability and Stability_all, every condition:** the score is now the average of the old swap count (the order part) and how far the four values moved at the same steps (the difference part), with the same five words on new edges (94 / 85 / 63 / 49), so participants see different Stability numbers and often a different level word. The results page's stability box says "It looks at two things: did your four values keep their order, and how far did they move? 100 = no two values swapped places and none moved."; the before-and-after card "Stability watches this order, and how far the numbers moved."; the charts' caption and radar note say the same. The scenario-6 prediction reads the new score (its chances sharpen or flatten slightly; the option it puts first never changes) |
| 3 October 2026 | **Baseline only (condition 4): no fit score and no ranking reasons while choosing, and one confirmation page for every choice.** The open option cards no longer show "Matches your earlier answers: N out of 100" or the "Ranked N - why" reasons (beat N of the others, decided on X, against Y, the trade line, the limit line and its label); "How it performs" stays. The note under the performance bars now ends "It does not tell you how well an option fits your values."; the page before Block 5, section 6, says "You will see your number for each one beside every situation."; the wish page (scenario 5) says "Before you confirm, take a moment with what this option gives up." instead of how close the wish is to what they said matters most. Every choice in scenarios 1-4 opens the same confirmation page with that sentence and "How sure are you about this choice?" (a good fit used to read "This option fits your earlier priorities" with no question). A good fit's "How sure" is recorded only. Conditions 1-3 unchanged. **From this date Baseline differs for every participant, not only after a misfit** (9.1, 9.6) |
| 3 October 2026 | **Scenario 5, all four conditions:** the line above the performance bars, "This is a wish, so it does not change these bars.", is now in the scenario's own color, semibold, in a lightly tinted box with an info mark (it was small grey text). Same words; nothing else changed |
| 1 October 2026 | **Condition 4 (Baseline) only:** a misaligned choice opens the confirmation page a good fit gets (no reflection, no person, no APA page), with its own first sentence, "Before you confirm, take a moment with what this option gives up." (a good fit still reads "This option fits your earlier priorities"), and "How sure are you about this choice?" (1-5), needed before keeping it. Keeping it moves the four values: +30 to the value the option serves most and -10 (misaligned) or -15 (strongly misaligned) to each other one, all x 0.6-1.0 by "how sure"; each such keep counts as a Stability step; the stakeholder, directness and context scores never move; the results page shows no reflection badge and says "This went against your usual values, and you kept it."; no CVR or APA feedback questions. Until this row, Baseline ran the full version (condition 1). Conditions 1, 2 and 3 unchanged |
| 1 October 2026 | **Condition 3 (APA_Only) only:** a misaligned choice opens the APA page at once: no reflection page and no person speaking; the APA page shows only its value question (with "How sure"), the options built on that value and the confirm (no two-situations table, no "which view" question), and opens with its own sentence: "This step just helps the system represent your priorities the way you truly mean them. There are no right or wrong answers here." Under it, a box: "The option you chose serves X more than any of the other three values" (X saved as apa.mainValueShown); going back to all the options needs no confirmation (no "Go back and clear your answers?" warning) The stakeholder, directness and context scores never move; each APA visit counts as a Stability step; the results page says "Clarification shown"; the feedback asks the APA questions but never the CVR or two-views questions. Conditions 1, 2 and 4 unchanged |
| 1 October 2026 | **Condition 2 (CVR_Only) only:** a refusal after the reflection opens the CVR Rejection page ("A closer look at your choice") instead of the APA page: the same explanation (the two situations, how far the option fell short), no question, no APA logo, one button back to all the options. On its first visit in a scenario it moves the person-speaking score +25 / -25 and, when both views were seen, the last view +20, inside the scenario. Conditions 1, 3 and 4 unchanged |
| 1 October 2026 | The four conditions exist (1 CVR+APA, 2 CVR_Only, 3 APA_Only, 4 Baseline): a new browser first sees a one-second page, "Preparing your study…", which gives the condition with the fewest people, and the address bar then shows it (`?condition=CVR_APA`). **All four still run the same study** (the full version) until the researcher builds each condition's difference; each of those will get its own row here. Records carry `condition_number` and `condition_type` from this date |
| 30 September 2026 | The two attention checks inside the study changed: instead of tapping a named colour (after Block 1-4) and a letter (after scenario 2-5), each person answers "What was the part you just finished about?" right after Block 3 and "What was the scenario you just finished about?" right after scenario 3, choosing among four answers (the right topic and three from outside the study) in a random order. The feedback row is unchanged. No score changes |
| 30 September 2026 | A refresh (or a closed tab) in the 0.9 s pause after a block now opens the next part; it used to reopen the finished block at its first question, and answering it again overwrote that block's results. Block 3's cards show the "Scenario N of 6" tag closer to the text below it (spacing only). No score changes |
| 30 September 2026 | The value pictures include the wish and the rule. "How your four values shifted along the way" (thank-you page) now moves in S5 and S6 on the running values instead of staying flat; the radar's "after the scenarios" shape and the results page's "Your four values, before and after the scenarios" card now show the values after all six scenarios (they showed scenario 4's). What a participant saw as "after" is therefore not `analysis.value_profile_after_block5` (the study's values after scenario 4). No score changes |
| 30 September 2026 | "A little about you" asks a fourth question, **Country**: one box where typing a few letters narrows a list of 243 countries and territories (names that start with the letters first, then names with a word that does; other names such as UK, USA, KSA, Holland work; accents do not matter), or "Prefer not to say". Required. Stored as `country` (English name) and `country_code` (ISO 3166-1 alpha-2; null for "Prefer not to say") on the participant document. Records made before this date have no country. No score changes |
| 29 September 2026 | Three attention checks, each drawn at random per participant: a "Quick attention check" screen asking for a named colour after Block 1, 2, 3 or 4; the same for a letter between two scenarios (after scenario 2, 3, 4 or 5); and one feedback row, "This question is just to check your attention. Pick the number four" (two to five), among the tools or well-being questions. The consent page names the rule ("Answer the quick attention checks as asked"). The gift card needs all three right (`quality.passed_all_attention_checks`); a miss removes nobody from the analysis (all completed sessions are analysed, the researcher, 30 September 2026). The hidden insights and post-Block-4 pages were deleted (participants never saw them; the brief pause where they ran is now the ordinary one, and the same data is still stored). No score changes |
| 29 September 2026 | Scenario 6's "Compare all options" overlay no longer shows the performance chart (its four rules all score 50, so it drew four identical flat shapes); only the values chart remains, and the overlay says "one chart". Scenarios 1-5 unchanged. No score changes |

### 4.11 Stability_all contains Stability, and what the top-value choices can say

`headline.stability_all_score` (since 29 September 2026) is Stability's rule over all six scenarios: its four decisions
are Stability's, so its order part is never above Stability's (since 2 October 2026 the combined score can be a little
above, about 5 in 100, when scenario 5 or 6 moves a value back toward where it began). Never correlate the two; report `stability_all_minus_stability`, which
says what the wish and the veil added. As with Stability, filter on `stability_all_was_measured` and compare groups
(the level depends on the step sizes). `analysis.top_value_choices` answers a different, simpler question - how often
the final choice did most for the #1 value brought into Block 5 - and was never on screen; compare it with its blind
baseline (about 1.1 of 6), not with VCI. Pretend-participant figures: docs/MAJOR_SCORES_DISTRIBUTION.md sections 2b, 2c.

### 4.10 VCI_all contains VCI, and judges the wish on values the screen did not show

Since 28 September 2026 `headline.consistency_score_all_six` (VCI_all) is VCI over all six scenarios, on hidden running values that also move after the wish and the veil (HOW_TO_READ 6l). Three rules follow. **Never correlate VCI_all with VCI**: four of its six parts ARE VCI; compare `vci_all_minus_vci` instead. **Do not mix the two scenario-5 fits**: `vci_wished` (hypothesis H12) is judged on the values scenario 4 opened with, the running fit on the values after scenario 4's choice. **State the two effects** the researcher accepted: the echo (35 in 100 wishes for the decided option score higher) and the 8 in 100 wishes for the best-looking card that score below 100. VCI_all is described, not tested (no hypothesis). Read scenario 6's part knowing it is the FINAL rule, chosen after the MPF's guess.

### 4.12 Comparing the four conditions: Stability is moved by the rules, not only by the people

Since 1 October 2026 the four conditions move the values by different rules after a misfit choice (CLAUDE.md, the
three condition sections). `docs/MAJOR_SCORES_BY_CONDITION.md` (generated by `npm run report:major-scores`) lets the same
pretend people through all four, and finds (figures of 1 October 2026; the page has the current ones):

- **VCI, VCI_all, performance and the top-value choices compare fairly between conditions.** For the same behaviour they
  move by at most about 1 point (VCI), so a difference between conditions there comes from what people chose.
- **Stability less so.** Under the order rule alone the same behaviour scored up to 22 points apart (always keeping the
  worst fit: CVR+APA 10, Baseline 24, APA_Only 32), because keeping a misfit after the reflection moves TWO values (+30 /
  -20, so both can cross others), while the APA page and Baseline's Keep raise ONE value and lower the other three together
  (the three keep their order, so fewer pairs swap). Since 2 October 2026 Stability averages that order part with a
  difference part, which the conditions usually push the other way, and the gap is 13 points (Stability_all about 7).
  Still compare Stability inside a condition, or between conditions against the gaps on that page.
- **"Not measured" depends on the condition too.** Going back and taking a good fit (CVR_Only, Baseline) is not a Stability
  step; a choice confirmed on the APA page always is (APA_Only). So the share with `stability_was_measured: false`
  differs by design. Section 9.4 has the whole comparison table.
- **The random line differs:** a random chooser's VCI is about 57 in CVR+APA, 60 in CVR_Only and Baseline, and 57-63 in
  APA_Only, because each page changes what a random person ends with. Do not use 50 as "chance" for any condition.
- **The stakeholder, directness and context stabilities** exist only in CVR+APA and CVR_Only ("not measured" in the other
  two); compare them between those two conditions only.
- **What a real effect looks like:** if the pages correct people who would otherwise keep a tempting misfit, VCI differs by
  about 60 points for such a person (the page's "principle B"); the study can see an effect of that size.

---

## 5. Scenario 6: the veil, and the MPF

### 5.1 What it is

The sixth scenario is Rawls's **Veil of Ignorance**. A storm has cut the power; one repair crew;
the participant writes the rule for which streets come back first, **before** learning who they will
be — the person on a breathing machine, the nurse with no lights, the shop owner, a parent with a
baby, or someone whose power never went out.

Four options, one per policy value, each a pure champion at 95 against 25 on the others.

After they choose, the **Moral Prediction Function (MPF)** shows them what it expected, as a
percentage on each rule. Then two questions and a chance to keep or change.

### 5.2 It is in the deck but in none of the measures

| Measure | Does scenario 6 enter it? |
|---|---|
| Value profile | **No.** It cannot move the profile at all |
| VCI | **No** |
| Stability | **No** |
| Performance | **No** |
| Position effect | **No.** Its position is `behind_the_veil`, which `positionRows()` drops |
| Results charts | **No**, except the time chart |

Two reasons, and both belong in the methods section. A sixth scenario that moved the profile would
add swaps to Stability that no decision of the participant's produced. And a scenario built to test
the model cannot also be evidence for the model.

**So do not put scenario 6 rows into any five-scenario analysis.** Filter on
`decisionRole === "predicted"` to find it, or on `scenarioId` if you prefer.

### 5.3 Why the veil is not a sixth position

It is tempting to treat `behind_the_veil` as a sixth rung on the position ladder. It is not. The
other five vary *who carries the cost*. This one removes the question: there is no position to
occupy, because not knowing is the condition of the exercise. A row for it on a position chart would
be an average over a variable that was deliberately not set.

What it *is* good for is a **within-participant comparison of principle against practice**: the rule
they write behind the veil, against the values they revealed in the five scenarios where they knew
where they stood. That comparison is legitimate and interesting. Calling it a position effect is
not.

### 5.4 The three MPF measures

**Accuracy.** `participant.mpf_guessed_right` is the top-pick hit. `mpf_chance_of_their_first_choice_percent`
is the probability the model assigned to the rule they actually chose, which is the better measure
because it is continuous and can be calibrated.

> **Report the chance baseline every single time.** With four rules a coin toss is 25%. It is stored
> as `mpf_prediction.chance_if_guessing_percent` precisely so nobody has to remember it. A 40%
> prediction is a real claim and a modest one, and a reader who sees 40% without the 25% will credit
> the model with far more than it did.

**Calibration is the stronger analysis than accuracy.** Bin predictions by the probability given, and
compare the mean predicted probability in each bin against the observed selection frequency. A model
that says 40% and is right 40% of the time is well calibrated even if its top-pick accuracy is
modest. `tools/validate_prediction.cjs` already does this against simulated choosers; the same
procedure on real data is the headline result.

**Filter on `gap_between_top_two` before treating a prediction as a commitment.** A separation near
zero means the model had no real opinion, whatever the percentages looked like. Two rules at 27% and
26% is a coin flip dressed up in numbers, and pooling those with a 76% prediction treats a shrug as
a commitment. Report the distribution of separations, and consider a pre-registered cut.

**Self-recognition.** `does_this_sound_like_me_1_to_7`. This is **not** accuracy, and the two can
disagree in both directions: a participant can rate a wrong guess 7 because it describes how they
think, or rate a right guess 1 because they resent being predicted. **The interaction between
accuracy and self-recognition is the interesting result**, not either one alone.

**Reactivity.** `changed_after_seeing_the_guess`, and the reason it exists is that the guess is shown
**after** the choice. Shown before, there would be no way to tell a choice the participant made from
a choice the guess suggested.

> A change alone is ambiguous. Someone may be correcting themselves or resisting being predicted,
> and the flag cannot tell those apart. Read it together with `does_this_sound_like_me_1_to_7` and
> with `wavering`.

**`wavering` is what makes reactivity interpretable.** `switches_before_the_guess` and
`switches_after_the_guess` separate two people the single flag records identically: one who agonised
through all four rules and then held firm, and one who went straight to a rule and only moved once
told what we expected. **The second is reactivity. The first is not.**

### 5.5 Order effects, and why they are checkable

The four rules are **shuffled per participant**, and `order_rules_were_shown_in` stores what each
person actually saw, top to bottom.

This is better than a fixed order and the reason is worth stating in the methods. Fixed, an order
effect is constant and built into every record with no way to separate it out. Shuffled, it is
spread evenly across participants — and because the order is stored, you can test it directly:
regress choice on display position and show it is flat.

**Run that test and report it.** It is cheap, and it closes off the obvious objection that people
just pick the first thing they see.

### 5.6 `what_they_did`

The decisions, in order, in seconds from the moment the scenario opened: each rule they opened,
every switch, the guess appearing, both answers, keep or change, and the commit.

Useful for: time-to-first-choice, how long they sat with the guess before answering, and whether the
answer came before or after they decided to change. `seconds_looking_at_the_guess` is the summary; a
two-second answer is not a judgment and is worth flagging.

**It is shorter than it used to be, and it used to be called `every_interaction`.** Expanding a
rule's details and backing out of the confirm view are no longer recorded anywhere — they were
navigation, not decision. The part of them worth having is in `wavering`, which counts distinct
rules opened on each side of the guess and was never built from this log. Records written before
15 September 2026 carry the old name and the two extra event kinds.

---

### 5.7 The MPF on every scenario — and the warning that goes with it

`analysis.mpf_predictions_every_scenario` runs the same prediction rule over all six scenarios.

> **Only scenario 6's numbers were ever shown to anybody.** The other five were computed afterwards
> from stored data. Every row carries `was_shown_to_the_participant`; a paper that describes a
> scenario-3 probability as a prediction the study made in advance is making a false claim.

**Why it is still worth having.** Scenario 6 gives one prediction per participant, which is one
point on a calibration curve. Six scenarios give six, from data that was already collected. With a
few dozen participants that is the difference between a calibration plot and an anecdote.

**What you may claim from it.**

- *Calibration.* Bin `mpf_chance_of_their_first_choice_percent` and plot observed frequency against
  it, with the chance line (16.7% for six options, 25% for four) drawn. This is the headline use.
- *Whether updating helps.* Compare the main columns against `using_profile_before_block5` — the
  same arithmetic from the profile they walked in with. If a predictor that never learns does as
  well, the block's updating bought nothing, and that is a real and publishable finding.
- *Where the model is blind.* Group by scenario. A scenario the MPF never gets right is telling you
  something about that scenario's menu.

**What you may not claim.**

- *That this is out-of-sample prediction.* It is not. The profile driving scenario 3's row was
  shaped by scenarios 1 and 2, and `confidence_dial` uses end-of-block VCI and Stability — one
  number from the participant's future. It changes only sharpness, never which option leads, but it
  has to be stated.
- *Anything from one participant's `hit_rate_percent`.* Four decisions give 0, 25, 50, 75 or 100.
- *That scenario 5 is a prediction of a decision.* It is a wish. `this_was_a_wish_not_a_decision`
  marks it, and the totals already exclude it.

**Check `profile_snapshot_was_missing` too.** A record written before the study stored per-scenario
value snapshots — or restored incompletely — has no profile for a middle scenario. That row falls
back to the pre-Block-5 profile, `profile_used` says so in words, and this flag is how you filter
those rows out of a calibration plot rather than quietly averaging a different predictor into it.

**Check `self_check.passed` before you use any of it.** It recomputes scenario 6 by the same route
as the other five and compares with what was actually shown; they must agree to 0.1 percentage
points. False means the recomputation has drifted and the whole section is suspect.

---

## 6. Figures worth building

| Figure | What it shows | Watch out for |
|---|---|---|
| Value profile before vs after Block 5, per participant | How far the four values moved | Radar is intuitive but hides magnitude; pair it with a numeric delta |
| Distribution of Stability, not its mean | It piles up at 100 for everyone who never met a conflict and spreads below for those who did | A single mean hides who moved |
| VCI against Stability, scattered | The two questions are different; show it rather than assert it | Label the axes with the *questions*, not the names |
| `authority_vs_receiving`, paired per participant | The study's cleanest causal comparison | Use a paired plot, not two group means |
| MPF calibration curve | Predicted probability against observed frequency, with the 25% baseline drawn | Draw the chance line. Always |
| MPF calibration across **all** scenarios | The same curve with six points per participant instead of one | Only scenario 6 was shown; say so in the caption. Two baselines (16.7% and 25%), not one |
| Moving predictor vs frozen predictor | Whether the block's updating bought any accuracy | If they match, the updating bought nothing — report that, do not bury it |
| `between_scenarios` heat map, per participant | Which two chairs pulled the same person furthest apart | Use `difference_in_departure_share`; raw distance compares the menus |
| Alone vs with-dependents, paired across participants | The study's opening question | Subject matter differs too — it is a description, not a causal claim |
| Alignment label counts per scenario | How often people took the top of the menu | Exactly one Aligned option exists per scenario by construction |
| MPF separation histogram | How often the model had a real opinion | Do not average predictions across very different separations |
| Accuracy × self-recognition, 2×2 or scatter | The interesting MPF result | Neither axis means much alone |
| Choice by display position in scenario 6 | The order-effect check | A flat line here is a result worth reporting |
| Time per stage | Where the session went | Scenario 6 *is* included in the time chart, unlike every other chart |
| The conditions | Five figures for comparing them | Section 9.7 |

**Two rules for every figure in this study.**

1. **Do not color low scores as bad.** Stability is descriptive: a low score means the priorities were reordered,
   not that the participant failed. The app deliberately avoids this framing and an analysis that
   reintroduces it is making a claim the measure does not support.
2. **Draw the baseline.** Chance for the MPF, 100 (no reorder) for Stability, and the menu range
   for departure. A number without its reference invites the reader to supply their own, and they
   will supply a flattering one.

---

## 7. Reproducibility

Every number in this study comes from a rule that is versioned. **Never pool records whose versions
differ without checking what changed.**

| Stamp | Governs |
|---|---|
| (none) | **The document carries no stamp of the study code's version**: `SHAPE_VERSION` lives only in the browser's sync state (found 27 September 2026; an earlier version of this table listed a `shapeVersion` field that does not exist). Date records by `completed_at` against the dated tables (4.9, CLAUDE.md) |
| `calibrationVersion` | The common ruler that makes the seven sensitivities comparable |
| `analysis.scenario6_mpf_test.rule_version` | The MPF prediction rule |
| `headline.stability_rule_version` | Since 2 October 2026: the Stability rule (the order part and the difference part averaged); absent before |
| `condition_type`, `condition_source` | Since 1 October 2026: the condition and how it was given (section 9) |
| `blocks.feedback_answers.schemaVersion` | Which feedback questions existed |
| `consent.version` | Which consent text they agreed to |

These commands regenerate the study's own figures from the real scoring code:

```bash
npm run validate:block5       # the scoring model: champions, domination, CVR content, planner
npm run validate:stability    # Stability (its order part, its difference part, their average) and the three sensitivity stabilities
npm run validate:conditions   # the four conditions: the balance, every condition's page, what each records
npm run report:major-scores   # every major score by kind of pretend participant, and the same people in all four conditions
npm run validate:prediction    # the MPF: seven gates plus a calibration study
npm run report:stability      # Stability by kind of participant, and swaps against distance
```

`validate:prediction` and `report:stability` are the two whose output belongs in a paper. Quote them
from a fresh run rather than from this document: they are measurements of the current deck and they
move when the deck moves.

---

## 8. What this study cannot tell you

State these in the limitations section rather than waiting to be asked.

1. **Position is confounded with scenario content and order** in the five-scenario analysis. Only the
   scenario 4/5 pair isolates it.
2. **The option values are authored, not estimated.** They were written to create the trade-offs.
   That is normal for vignette materials and is a design input, not a measurement.
3. **The MPF's temperature range is a judgment.** With no pilot data it could not be calibrated from
   evidence, so it was set to be modest and stated openly rather than tuned to look impressive.
4. **Equal weight on VCI and Stability** inside the MPF's confidence is a declared choice. Nothing in
   the study measures which is the better predictor.
5. **Flat profile updates pile up on the bounds.** About 13% of values finish a run sitting exactly
   on 0 or 100, so a participant who keeps drifting after saturating one value looks slightly
   steadier than they were.
6. **Scenario 6 is one scenario.** Reactivity measured once is not a reactivity trait.
7. **Only four scenarios can move the profile** (audit B7): value movement and Stability rest on at most
   four steps per person; describe them for groups (4.8).
8. **The five-scenario position number cannot tell a role-switcher from a random chooser** (audit P2):
   no role appears twice, so the check that separates them cannot run (4.4).
9. **A close #1 and #2 value decides the card order as firmly as a clear one** (audit C7): the gap is
   saved; in pretend participants about 16 in 100 are within 5 points (4.7).
10. **The conditions act only on the participants who choose against their best fit**, and only at those moments: a
    participant who always chooses a good fit meets the same study in all four (9.1).
11. **Stability is not perfectly comparable between conditions**: the conditions move values by different rules, so the
    same behaviour can score up to about 13 points apart (9.4, docs/MAJOR_SCORES_BY_CONDITION.md).

---

## 9. The four conditions: what differs, what is recorded, and how to analyse them

Since 1 October 2026 every participant is in one of four conditions. This section is everything an analyst needs to
compare them. The design, in the researcher's words: four conditions that share Blocks 1-4 and differ from Block 5 to
the end - **1 CVR+APA** (the full version), **2 CVR_Only**, **3 APA_Only**, **4 Baseline** (no CVR or APA).

### 9.1 What differs, and what does not

Blocks 1-4, the rule (scenario 6), the card order, the scores' rules, the results page's layout and the feedback page are
the same in all four. **In conditions 1-3 only what happens after a misaligned or strongly misaligned choice in one of the
four decisions (scenarios 1-4) differs.** **Baseline (4) also differs before any choice, since 3 October 2026:** its open
option cards show no fit line and no ranking reasons, the wish page says no "close to what you said matters most", and
every choice in a decision, good fit or not, opens the same confirmation page with "How sure".

| | 1 CVR+APA | 2 CVR_Only | 3 APA_Only | 4 Baseline |
|---|---|---|---|---|
| **While choosing: the open card** | the fit line ("Matches your earlier answers: N out of 100") and the "Ranked N - why" reasons, then "How it performs" | the same | the same | **"How it performs" only** (since 3 October 2026) |
| **A good fit opens** | the confirmation page: "This option fits your earlier priorities...", no question | the same | the same | **the same page as a misfit**: "Before you confirm...", and "How sure" (recorded only; since 3 October 2026) |
| **A misfit opens** | the reflection (two views), then the person speaking | the same | the APA page at once (no reflection, no person), with its own opening sentence and a box naming the value the option serves most | the confirmation page a good fit gets, with its own first sentence and "How sure are you about this choice?" |
| **Keeping the misfit moves** | +30 to the value it serves, −20 to the value it gives up most, person ±25 | the same | naming the option's own value on the APA page: +30 × sure to it, −10 × sure to each other value | "Keep": +30 × sure to the value it serves most, −10 (misaligned) or −15 (strongly misaligned) × sure to each other value |
| **Refusing / going back** | the APA page: name a value, how sure, pick from its list (+30 × sure, −10 × sure each, person ±25, the view that moved them +20 × sure) | the CVR Rejection page: no question, one button back; first visit in a scenario moves the person score ±25 and the last view +20 (only if both views were seen); then they choose again | "Take me back to all options" (no warning) | "Change my mind" |
| **A Stability step** | a misfit kept after the reflection, or a choice confirmed on the APA page | a misfit kept after the reflection | a choice confirmed on the APA page | a misfit kept on the confirmation page |
| **Stakeholder, directness, context stabilities** | measured | measured | **not measured** (never shown, never moved) | **not measured** |
| **Feedback: CVR questions** | after a reflection | after a reflection | never | never |
| **Feedback: APA questions** | after an APA page | never | after an APA page | never |
| **Feedback: two-views questions** | after a second view was opened | the same | never | never |
| **Results page card** | "Reflection shown", "Kept after reflection" | "Reflection shown", "Kept after reflection" | "Clarification shown"; a confirmed misfit's note: "The clarification page opened, and this is the option you confirmed there." | no badge; a kept misfit's note: "This went against your usual values, and you kept it." |

**The single most important fact for the analysis:** among conditions 1-3, a participant who never chooses a misfit in
scenarios 1-4 meets exactly the same study. Those three conditions can only act on the people who choose against their best
fit, and only at those moments. Count, per condition, how many participants ever met their condition's page (9.3)
before reading any difference between conditions as the pages' effect. **Baseline is different since 3 October 2026:
everybody in it chooses without the fit line and the ranking reasons**, so a difference between Baseline and another
condition can come from the missing reflection and APA pages, or from the missing fit line and reasons on the cards, or
from both. The design does not separate the two; say so wherever Baseline is compared (9.6).

### 9.2 Who is in which condition, and how they got there

| Field | What it says |
|---|---|
| `condition_number`, `condition_type` | 1-4 and its name (`CVR+APA`, `CVR_Only`, `APA_Only`, `Baseline`). Set ONCE by the server, never changed; also beside the demographic answers (`blocks…vrds_demographics.conditionNumber` / `conditionType`) |
| `condition_source` | `landing_page` (the server's balanced count gave it), `address` (somebody opened `?condition=...` on purpose: a tester), `random_offline` (no server; local testing). Only `landing_page` is counted for balance |
| `condition_assigned_at` | When it was given |
| `major_info_and_scores.condition` | A copy, with `counted_for_balance` |

A record without these fields was made before 1 October 2026 and ran condition 1. The landing page gives the condition
with the fewest people (finished, plus still working in the last 2 hours, plus arrived in the last 30 minutes), so the
finished numbers come out about equal; the live counts are at `/api/conditions/report`.

### 9.3 What each condition's page records

Everything below is per scenario, in `analysis.alignment_records.by_scenario[i]` (field dictionary:
HOW_TO_READ_MY_DATABASE.md) and in the raw row's `telemetry` (`blocks.block5_emergency_scenarios.scenarioResults[i]`).

| What you want | Field | Conditions |
|---|---|---|
| Was the reflection shown in this scenario? | `cvr.fired` (since the audit of 2 October 2026 also when the participant then went back to a good fit) | 1, 2 |
| Did this scenario count for Stability? | `cvr.counted_as_a_stability_step` | all |
| What happened on the APA page | `apa` (`ran`, the value named, how sure; in 3 also `value_the_page_said_the_option_serves_most` and `named_the_value_the_page_said`) | 1, 3 |
| Every CVR Rejection page visit, and the moves of the first | `cvr_rejection_page` (`shown`, `visits`, `every_visit[]`: option refused, views seen, the reflection answer, whether the person moved them, seconds) | 2 |
| Baseline's page | `baseline_confirm` (`kept`, `how_sure_1_to_5`, the steps asked for, `page_opened_times`, `changed_their_mind_times`; since 3 October 2026 `how_sure_on_the_confirmation_page_1_to_5` for EVERY choice kept there, good fit or not, and a good fit's page counts `good_fit_page_opened_times`, `good_fit_changed_their_mind_times`) | 4 |
| Could the cards show the fit line and the ranking reasons? | `fit_line_and_ranking_reasons_shown` (false in Baseline since 3 October 2026, and always in scenario 6) | all |
| How often each page opened, and was left | `telemetry.cvrVisits`, `apaVisits`, `cvrRejectionVisits`, `baselineConfirmVisits`, `baselineConfirmBackouts` (a misfit's page), `baselineGoodFitConfirmVisits`, `baselineGoodFitConfirmBackouts` (a good fit's, since 3 October 2026), `cvrBackouts`, `apaBackouts` | as the page exists |
| Was the second view opened (at any point) | `cvr.second_lens_was_generated` (since the audit: also a view opened before going back), `telemetry.secondViewOpened` | 1, 2 |
| Did the participant end on a different option than their first pick | `cvr.changed_their_choice` (first pick against final) | all |
| Every value move, with its reason in words | `analysis.value_moves_asked_for_and_made` (reasons "CVR Rejection page: ...", "Baseline confirm: ...", "changed their mind: ...") | all |

Per participant: the totals in `analysis.alignment_records.totals` (`times_reflection_fired`, `times_clarification_ran`,
`times_cvr_rejection_page_shown`, `times_kept_misaligned_on_the_baseline_confirm_page`,
`times_the_baseline_confirm_page_opened`, and since 3 October 2026 `times_a_good_fit_was_kept_on_the_baseline_confirm_page`
and `times_the_fit_line_and_ranking_reasons_were_hidden`), and the feedback record's Block 5 summary, which carries each
scenario's `cvrVisits`, `apaVisits`, `cvrRejectionVisits`, `baselineConfirmVisits`, `baselineGoodFitConfirmVisits` and
`secondViewOpened`.

### 9.4 Which measures compare fairly between conditions

`docs/MAJOR_SCORES_BY_CONDITION.md` (written by `npm run report:major-scores`) lets the same 2,000 pretend people x 12
kinds of chooser through all four conditions, so any difference there comes from the conditions' own rules, not from
behaviour. Read it before comparing real conditions. In short (figures of 2 October 2026):

| Measure | Fair between conditions? | Why |
|---|---|---|
| VCI, VCI_all | **Yes** - the same behaviour moves at most about 1 point | They read the choices, and the choices are what the conditions change. The pretend people choose the same with or without the fit line, so for Baseline this holds for the rules only: real people may choose differently without it (9.1) |
| Performance, top-value choices | **Yes** - at most about 4 points / 0.6 of 6, only where a final choice is made differently | They read the final choices only |
| Stability, Stability_all | **Mostly** - up to 13 points (Stability) and about 7 (Stability_all) for the same behaviour | The conditions move values by different rules. Since 2 October 2026 Stability averages an order part (higher in 3 and 4) with a difference part (usually lower there), which halves the gap; compare against the gaps on that page (4.12) |
| The three sensitivity stabilities | **Only 1 against 2** | "Not measured" in 3 and 4 |
| "Not measured" share of Stability | **No, by design** | Going back to a good fit is not a step (2, 4); a choice confirmed on the APA page always is (3) |
| A random chooser's VCI | **Differs**: about 57 (1), 60 (2, 4), 57-63 (3) | Each page changes what a random person ends with; never use 50 as "chance" here |
| Card order, the position check | **Identical** | They read the values brought into Block 5, which Blocks 1-4 make the same way everywhere |
| The scenario-6 prediction | Its favourite works the same; its confidence follows VCI and Stability | (5.4) |

### 9.5 Analyses that answer the condition questions

These are the analyses the design supports. Which ones go into the paper, and with which exclusion rules, is the
researcher's decision after the experiment.

1. **Who met their condition's page.** Per condition: how many participants ever opened it, how many times, and what
   they did there (kept / went back / named which value). Without this, a null difference cannot be told from a page
   nobody met.
2. **VCI and VCI_all by condition** - distributions, not only means, each against its own condition's random line
   (9.4). The cleanest comparison of whether the pages change how well choices follow values.
3. **Stability by condition, with its two parts** (`value_order_stability`, `value_difference_stability`): report the
   parts beside the score, filter on or split by `stability_was_measured`, and read any difference against the
   mechanical gap on the conditions page. **Never correlate Stability with either part** (it is their average).
4. **Changing the choice after the page.** `cvr.changed_their_choice` and first-against-final pick, per condition and
   per scenario: how often each page led to a different option, and whether that option fit better (its label).
5. **How sure, where it is asked** (conditions 1 and 3 on the APA page, 4 on the confirmation page): its distribution,
   and whether surer people moved further (it scales the moves). In Baseline, since 3 October 2026, it is asked for EVERY
   choice in a decision (`how_sure_on_the_confirmation_page_1_to_5`), so how sure people are can be compared between good
   fits and misfits inside one condition; only a misfit's answer moves values.
6. **APA_Only's box** (`named_the_value_the_page_said`): how often people named the value the box showed. **Trap:**
   naming it is also how a participant keeps their own option, so a high share is expected and is not, on its own,
   evidence of a value.
7. **Feedback by condition.** Compare only the questions every condition could see (the design and experience
   sections); the CVR questions compare 1 with 2, the APA questions 1 with 3; Baseline answers neither.
8. **The prediction by condition** (scenario 6): accuracy and calibration per condition (5.4), knowing its confidence
   reads VCI and Stability.

### 9.6 Traps that belong to the conditions

- **"Was the reflection shown" and "did it count for Stability" are two different fields** (`cvr.fired`,
  `cvr.counted_as_a_stability_step`). APA_Only and Baseline have Stability steps with no reflection; conditions 1 and 2
  have reflections that were followed by a good fit and so are not steps.
- **Records made before the audit (2 October 2026)** read `cvr.fired: false` when the reflection was shown and the
  participant then went back to a good fit (most often condition 2), did not keep a second view opened before going back,
  and did not count Baseline's page. Date records by `completed_at`.
- **Records made before 2 October 2026** have Stability as the order part alone; `headline.stability_rule_version`
  says which rule made the score. Do not pool.
- **CVR_Only's page moves the person score inside the scenario**, so a second reflection in the same scenario opens on
  moved values.
- **Baseline's strongly misaligned keep lowers the four values overall** (+30, three times −15): compare their ORDER
  across conditions, not their sum.
- **Baseline differs for everybody since 3 October 2026** (no fit line, no ranking reasons, the same confirmation page for
  every choice). A Baseline-against-condition-1 difference mixes the missing pages with the missing card information; the
  design cannot separate them. Comparisons among conditions 1-3 are not affected.
- **Baseline records before 3 October 2026** showed the fit line and the reasons and asked "How sure" only after a misfit;
  `fit_line_and_ranking_reasons_shown` is absent on them (it reads true). Do not pool across the date.
- **A good fit's "How sure" in Baseline moves nothing** (the keep rule, as everywhere); a misfit's scales its moves. Never
  read a good fit's answer into the value moves.
- **`condition_source: "address"`** marks a tester who opened a condition on purpose.

### 9.7 Figures worth building for the conditions

| Figure | What it shows | Watch out for |
|---|---|---|
| VCI by condition, distributions side by side | Whether the pages change how well choices follow values | Draw each condition's own random line (9.4) |
| Stability by condition, with its order and difference parts | Which part moves | Draw the mechanical gap from the conditions page as a reference band |
| A funnel per condition: chose a misfit → page opened → kept / went back → final label | What people did at their condition's page | One funnel per condition; the pages differ, so do not stack them |
| "How sure" by condition (APA page against Baseline's page) | Whether the two "how sure" questions are answered alike | Different pages ask it after different things |
| Baseline: "How sure" for good fits against misfits (since 3 October 2026) | Whether people are less sure when they choose against their values, on an identical page | Only a misfit's answer moves values |
| APA_Only: named value against the box's value | How often the box was followed | Naming it is also the way to keep the option (9.5) |
