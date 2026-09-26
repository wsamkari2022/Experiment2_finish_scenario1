# How to analyze the VRDS Experiment 2 data

**Who this is for.** Anyone — a person or an AI agent — who has the MongoDB `participants`
collection in front of them and has to turn it into findings and figures for a paper.

**Read `HOW_TO_READ_MY_DATABASE.md` first.** That file is the field dictionary: where every number
lives and what it literally means. This file is the next step: which questions the study can answer,
which analyses answer them, what you are allowed to claim, and what will get the paper rejected.

**The single most useful habit:** before reporting any number, ask what it would look like if the
effect were absent. Most of the traps below are cases where the absent-effect version and the
present-effect version produce the same number.

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

**`compensation_eligible` is a payment decision, not an analysis decision.** Do not silently use it
as an exclusion rule. Decide your own criteria, state them, and report how many participants each
one removed. A paper that reports one N and no exclusion table invites the question of what was
dropped.

---

## 3. The measures, and the question each one answers

| Measure | The question it answers | Where |
|---|---|---|
| **VCI (consistency)** | Did your choices match your values, judged as they stood at the time? | `headline.consistency_score` |
| **Stability** | Did the order of your priorities change when you went against your best fit? | `headline.stability_score` |
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
| Stability | Ordinal and coarse: 13 possible values (100 down to 0 in steps of 8.3), and everyone who never met a conflict piles up at 100 | Do not model it as continuous; show its distribution |
| Value movement | Scores stop at 0 and 100, so a move past an edge is cut off. A value at the edge "does not move" whatever the participant does | Check `analysis.value_moves_asked_for_and_made` (since 24 September 2026) and report participants with cut-off moves separately |

**The alignment floor used to matter more than it does.** Until 14 September 2026 the ranking itself
was computed from the floored score, which meant options tied at 0 were ordered alphabetically by
their internal id. That is fixed — ranking now uses the uncensored shortfall — but if you ever load
data written before that date, check `shapeVersion` and do not pool it with later records.

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
their best fit. Measured on 24 September 2026 (`npm run report:planner-overlap`, 4,000 pretend
participants of each kind, real scoring from Blocks 1-4 to the card order), out of 100 people:

| Scenario | First card = best fit (steady answerers) | They differ | First card = best fit (random answerers) |
|---|---|---|---|
| Six Hours to Clear the District | 62 | 38 | 50 |
| Eight Hours Ahead of the Fire | 68 | 32 | 55 |
| Limited Cancer Treatment Allocation | 57 | 43 | 46 |
| The Care Visits You Have to Cut | 62 | 38 | 50 |
| The Same Cut, Decided Without You | 62 | 38 | 50 |

Chance would be about 17 (one card in six). "Steady" pretend participants answer like a real person:
one base answer, a small real preference, and sometimes one answer one step off. Their profiles are
clearer, so the #1-value champion is more often also their best fit. Real participants are expected
to sit nearer the steady numbers.

**What this means for analysis** (the researcher's decision, 24 September 2026: accept, state and
analyse both):

- A choice of card 1 is **ambiguous in 57-66 cases out of 100**: first place and best fit are the same
  card, so either could explain it.
- The **34-43 cases out of 100 where they differ** are the ones that can separate a position effect
  from a values effect. Say so, and report how many such cases the sample actually had
  (`analysis.card_order_by_scenario.by_scenario[].the_first_card_was_also_the_best_fit_card`).
- Put **both** in the same model: the chosen card's position on screen (`choiceRank`, or
  `position_of_the_card_chosen`) and its fit place (`selectedRank`, or `is_the_best_fit_card`). Never
  use one as a stand-in for the other.
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

The reason is simple: only four choices count, and one person's four choices carry a lot of luck. The
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
| 26 September 2026 | Scenario 2: two option numbers changed ("Fill every seat" harm 50 -> 62, "Leave immediately" vulnerable 44 -> 35), so fit numbers, labels and card order there differ for about 1 person in 3 |

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
| `shapeVersion` | The database layout and field names |
| `calibrationVersion` | The common ruler that makes the seven sensitivities comparable |
| `analysis.scenario6_mpf_test.rule_version` | The MPF prediction rule |
| `feedback_answers.schemaVersion` | Which feedback questions existed |
| `consent.version` | Which consent text they agreed to |

These commands regenerate the study's own figures from the real scoring code:

```bash
npm run validate:block5       # the scoring model: champions, domination, CVR content, planner
npm run validate:stability    # Stability (swaps) and the three sensitivity stabilities
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
