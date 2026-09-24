# How to read the VRDS Experiment 2 database

> **This file is the dictionary: where every field lives and what it literally means.**
> For which analyses the study can support, what you are allowed to claim, and which figures to
> build, read **`HOW_TO_ANALYZE_MY_DATA.md`** next. This one tells you what a number *is*; that one
> tells you what it is *for*.

**For:** anyone — human or AI — analyzing the data from the Human-AI Moral Value Study.
**Written:** 11 September 2026. **Last updated:** 19 September 2026 (VCI: the notes under
`per_scenario_consistency_0_to_1` in section 6d and `consistency_score` in section 4. Stability and
the three sensitivity stabilities: section 4. The decision against the wish: section 6b,
`decided_versus_wished`).

> **What changed on 15 September 2026.** Five things, and the first one removes data:
>
> 1. **The insights page and the final-analysis page are no longer timed.** `insightsMs` and
>    `finalAnalysisMs` are gone from `timings`, and both pages are gone from
>    `active_time.by_stage_minutes`. Totals are unchanged — see section 8.
> 2. **Scenarios 5 and 6 are copied to the top of `blocks`** under their own names, because neither
>    is the same kind of thing as the four around it. Section 5.
> 3. **`analysis.alignment_records`** is new: the alignment label, the fit score, the reflection
>    (CVR) and the clarification (APA) for every scenario, in one table. Section 6d.
> 4. **`analysis.position_effect.between_scenarios`** is new: every scenario against every other
>    one, which is what answers "scenario 1 alone versus scenario 2 with dependents". Section 6b.
> 5. **`analysis.mpf_predictions_every_scenario`** is new: the prediction function run over all six
>    scenarios rather than only the one where it was shown. Section 6e. **Read the warning there
>    first** — only scenario 6's numbers were ever on screen.

Read this before writing a single query. It tells you what each field means, which numbers are
raw and which are calculated, and which fields look similar but are not.

---

## 1. Where the data is

| | |
|---|---|
| Database | `vrds_experiment2` |
| Collection | `participants` |
| Connection (local) | `mongodb://localhost:27017` |

**One document per person.** There are no joins. Everything about one participant is in one
document.

The key is **`email`**, which is always stored trimmed and lower-cased. `Waseem@X.com` and
`waseem@x.com` are the same person, and the database enforces this with a unique index.

---

## 2. The rooms of a document

A document is organized into rooms. Knowing which room a number lives in tells you what kind
of number it is.

```
{
  participant_id, email, age, gender,          <- who
  status, current_stage, consent, timestamps

  headline    { ... }  <- the few numbers you probably came for
  blocks      { ... }  <- RAW: what the person actually did
  analysis    { ... }  <- COMPUTED: what the model made of it
  timings     { ... }  <- clock time per screen (includes idle)
  active_time { ... }  <- REAL working time (idle excluded)
  quality     { ... }  <- engagement checks and payment eligibility
  resume_state{ ... }  <- scaffolding; present only while UNFINISHED
}
```

> **`timings` and `active_time` are not the same number and must never be swapped.**
> `timings` is how long a screen was open — it includes lunch breaks. `active_time` is how long
> the person was really working. Use `active_time` for anything about effort or payment.

Inside `analysis`, the parts most people want are `position_effect.by_scenario` (how far each
choice sat from who they were) and `value_profile_change` (whether Block 5 moved them at all).

### The most important distinction in this dataset

**`blocks` is raw. `analysis` is computed.**

Raw answers can never be recovered if they are lost. Computed results can always be recalculated
from the raw answers. If a number in `analysis` disagrees with `blocks`, **`blocks` wins** — it is
the record of what the person did.

Never treat a field in `analysis` as an independent observation. It is derived from `blocks`, so
correlating the two will produce impressive and meaningless results.

---

## 3. Identity and progress

| Field | Meaning |
|---|---|
| `participant_id` | Unique id for the run (a UUID). **The only id in the database.** |
| `email` | The key. Lower-cased. Also how a participant returns to finish. |
| `age`, `gender` | From the demographic form. Gender is one of Male / Female / Other / Prefer not to say. |
| `status` | `"Study Not Completed"` or `"Study Completed"` — nothing else. |
| `current_stage` | The screen they last reached, e.g. `money`, `block5`, `feedback`. |
| `consent` | `{ agreed, timestamp, version }`. The version records which wording they agreed to. |
| `created_at` | First time this person was seen. Never rewritten. |
| `updated_at` | Last write of any kind. |
| `completed_at` | When they finished, or `null`. Set once, never overwritten. |

### How to select your analysis sample

```js
db.participants.find({ status: "Study Completed" })
```

**Do this in every analysis.** A document with `status: "Study Not Completed"` is somebody who
stopped partway. Their blocks are genuine but incomplete, and including them will silently bias
every average.

`status` becomes `"Study Completed"` at exactly one moment: the participant submitted the feedback
questions and reached the thank-you page. It is written in one place in the code, so it means the
same thing in every document.

---

## 3b. `sessions` — every login, and the machines they came from

Added **20 September 2026**. One row each time the study was **opened with this participant
identified**. A participant who does Block 1 on a laptop on Monday and finishes on a desktop on
Thursday has two logins on two browsers, and this is where that shows.

| Field | Meaning |
|---|---|
| `total_logins` | Every login, including any too old to be listed |
| `logins_listed_here`, `older_logins_counted_but_not_listed` | The browser keeps the most recent 60 rows. Older ones are counted, then dropped, so the total stays true while the document stays small |
| `browsers_used`, `used_more_than_one_browser` | How many different browsers this run was opened in |
| `ever_restored_from_another_device` | True when their answers had to be downloaded onto a machine that did not have them |
| `first_login_at`, `last_login_at`, `days_between_first_and_last_login` | The span of the run |
| `list[]` | `number`, `started_at`, `last_seen_at`, `minutes_open`, `how_it_started`, `stage_at_start`, `stage_at_last_seen`, `browser_number`, `browser_id` |

`how_it_started` is one of three words: `typed_their_email` (they entered the study from the start
screen), `continued_in_this_browser` (the study was reopened where their answers already were), or
`restored_from_another_device` (their answers were downloaded onto this machine first).

> ⚠️ **`sessions.total_logins` is not `active_time.sittings`.** A sitting is a gap of more than
> thirty minutes between activity, which happens while a tab sits open over lunch. A login is the
> study being opened. A run can easily have two logins and five sittings, or five logins and five
> sittings. Use logins for "how many times did they come back", sittings for "how was the work
> spread inside a visit".

> ⚠️ **`minutes_open` is wall-clock, not effort.** It is the time between opening the study and the
> last screen change in that sitting, so a tab left open inflates it. `active_time` is the only
> honest effort number in this database.

**What is deliberately not here:** no user agent, no platform, no screen size, no address. A
browser is a random id generated inside that browser, which can say "the same machine as before" or
"a different one" and nothing else. `browser_number` numbers them in order of first appearance so a
run can be followed across machines without reading UUIDs.

---

## 3c. `major_info_and_scores` — every major score in one room

Added **23 September 2026**, on request: the numbers that matter, gathered where somebody looking
for them will find them. **Everything in it is a copy.** Each line is lifted from the section that
owns it, by calling the same builder that writes that section, and `where_each_number_lives` inside
the field names the original for every line. If a number here ever disagrees with its source, the
source is right and this is wrong — gate D49 checks they agree on every build.

| Field | What it holds |
|---|---|
| `vci` | `overall_score` and label, plus `when_deciding_scenario_4`, `when_wishing_scenario_5` and the gap between them |
| `stability` | The score and label, plus the directness, context and stakeholder stabilities |
| `performance` | `score`, `captured`, `captured_label` |
| `position_effect` | `overall`, a `by_scenario` list (role, distance, departure share) and a `by_role` list |
| `predictions_by_scenario` | One row per scenario: the model's favourite and its chance, their choice and its chance, and how many points behind it sat |
| `total_time` | Active minutes, timed-stage minutes, per-stage minutes, longest idle |
| `visits` | Number of visits, logins, browsers used, whether they ever restored from another device |
| `alignment_by_scenario` | One row per scenario: what they chose and its alignment label · `alignment_counts` totals the four labels |
| `profile_before_block5`, `profile_now`, `profile_after_block5`, `profile_change_during_block5` | The three profiles and the movement between the first and last |
| `feedback` | The feedback answers, grouped as they were asked, each with its question text |
| `blocks_1_to_4` | **Since 24 September 2026.** How Blocks 1-4 were answered: `said_yes_at_the_first_step_everywhere`, `answered_very_fast`, the values the scoring could not measure, and the ties a coin decided. A copy of `analysis.blocks_1_to_4_checks` (section 6i), checked by gate D52 |

> ⚠️ **`profile_now` is shorter than the other two.** It carries the four policy values only,
> because only those are snapshotted after each scenario. Directness, context and stakeholder are
> in `profile_before_block5` and `profile_after_block5`, and their movement is in
> `profile_change_during_block5`. The field says this itself, in `why_profile_now_is_shorter`.

> ⚠️ **It is a copy, so it duplicates data.** That was the request, and it is stated here so
> nobody counts the same answer twice: never average across this field and its sources together.

---

## 4. `headline` — the numbers most analyses start from

These are copies, lifted to the top so you do not have to dig. The originals stay in `blocks`.

| Field | Meaning | Range |
|---|---|---|
| `consistency_score` | How well their Block 5 choices fit their own values. Internally called **VCI**. The average label weight of the final choices in the four decider scenarios × 100. **50 is what blind picking gives.** Method: `docs/BLOCK5_VCI_METHOD.md` in the code | 10–100, higher = more consistent (0 only if no decider scenario ran) |
| `consistency_label` | One of six levels: Highly Consistent (90+), Mostly Consistent (80–89), Moderate (65–79), Low (50–64), Very Low (30–49), Highly Inconsistent (below 30) | text |
| `stability_score` | Whether the ORDER of their four policy values changed when they went against their best fit: at each conflict step (a scenario where the reflection ran) it counts the pairs of values that traded places, a tie opening or closing as half, and scores 100 × (1 − swaps / 6). Method: `docs/BLOCK5_STABILITY_METHOD.md` in the code | 0–100, 100 = no two priorities traded places |
| `stability_label` | Held steady (100), Mostly steady (83–99), Shifted a little (50–82), Shifted a lot (17–49), Changed substantially (0–16) | text |
| `directness_stability_score`, `directness_stability_label` | How far their directness sensitivity traveled on its 0–100 scale during Block 5, as 100 × (1 − distance / 100). Same five words as Stability. **Usually 100**: it moves only when the second lens was generated and answered | 0–100 |
| `context_stability_score`, `context_stability_label` | The same for context sensitivity | 0–100 |
| `stakeholder_stability_score`, `stakeholder_stability_label` | The same for stakeholder sensitivity, which moves ±25 on every reflection | 0–100 |
| `performance_score` | Average outcome quality of the options they chose | 0–100 |
| `performance_captured` | How much of the available performance they actually captured | 0–100 |
| `performance_captured_label` | Plain-language band for the above. Added 20 September 2026 | text |
| `position_effect` | **How differently they chose depending on who the decision was about** — themselves, their household, or strangers | higher = position mattered more |
| `position_effect_label` | Plain-language band for the above | text |
| `scenarios_completed` | How many Block 5 situations they finished | integer |
| `reflection_visits` | How many times the reflection step (CVR) appeared | integer |
| `adjustment_visits` | How many times the adjustment step (APA) appeared | integer |
| `choice_switches` | How many times they changed their choice after reflecting | integer |
| `total_time_minutes` | The sum of the **timed** stages. ⚠️ Not the whole study — see section 8 | minutes |
| `total_time_minutes_covers` | A sentence saying exactly what that number includes, and which field to use instead for effort | — |

> ⚠️ **Stability changed on 19 September 2026 — do not pool runs across the change.** Before it,
> `stability_score` measured how far the profile traveled (with a start-versus-end order check), over
> every scenario and including the stakeholder. Since, it counts swaps in the order of the four
> policy values at the conflict steps only, and the three sensitivities have their own scores.
> Runs under the new rule carry `rule_version` `2026-09-19-e` or later in section 6c.

> **Note on names.** The study's internal code calls consistency `vci`. The database calls it
> `consistency_score`. They are the same number. `blocks.block5_emergency_scenarios.vci` still
> holds the original if you want to check.

---

## 5. `blocks` — the raw answers

| Field | What it is |
|---|---|
| `block1_money` | Found-money decisions. Would you keep, return, leave or donate, at rising amounts, in three locations. |
| `block2_trolley` | Trolley-problem decisions (lever and footbridge variants). |
| `block3_ai_workforce` | Hiring-policy thresholds. See the warning below. |
| `block4_stakeholder_reflection` | The initial decision, two stakeholder perspectives, and the final decision. |
| `block5_emergency_scenarios` | The main study: five emergency situations with six options each, plus scenario 6. The largest and richest field. |
| `block5_scenario_5_wish_on_the_receiving_end` | **A copy** of the scenario 5 row, lifted out. See below. |
| `block5_scenario_6_veil_of_ignorance` | **A copy** of the scenario 6 row, lifted out. See below. |
| `feedback_answers` | The end-of-study questionnaire. See section 7. |

### The two lifted scenarios, and why they are copies

Both of these are already inside `block5_emergency_scenarios.scenarioResults`. They are copied to
the top of `blocks` because **neither is the same kind of thing as the four scenarios around it**,
and finding them as `scenarioResults[4]` and `scenarioResults[5]` gives no warning of that:

- **Scenario 5 is a wish, not a decision.** The same workplace cut as scenario 4, decided by
  somebody else. Excluded from consistency, stability and both reflection measures; **included** in
  the position effect.
- **Scenario 6 is a test of the model, not of the participant.** It updates nothing and enters no
  score at all, including the position effect.

Each copy carries these keys:

| Key | Meaning |
|---|---|
| `what_this_is` | A sentence saying what kind of scenario this is and which measures it enters |
| `this_is_a_copy_of` | The exact path of the original row, e.g. `blocks.block5_emergency_scenarios.scenarioResults[4]` |
| `scenario_id`, `title`, `order_shown`, `position`, `position_label`, `decision_role` | Header facts, so the row identifies itself |
| `answer` | The raw scenario row, byte for byte |

> ⚠️ **These are duplicates. Never count both.** `answer` and the row it was copied from are the
> same answer. Use one or the other in any aggregate, never both, and never correlate them.

### ⚠️ Warning about `block3_ai_workforce`

The threshold keys read:

```
threshold_entry_level_small / _medium / _large
threshold_senior_level_small / _medium / _large
```

These describe an **entry-level role** and a **senior-level role**.

Older exports of this data used the words `lowbuffer` and `highbuffer`. **Those words describe a
design this study no longer has, and they mean nothing here.** If you meet them, you are looking at
data written before 11 September 2026.

### `block5_emergency_scenarios` — the important sub-fields

| Field | Meaning |
|---|---|
| `scenarioResults` | An array, one entry per situation. The heart of the dataset. |
| `vci`, `vciLevel` | Consistency (also copied to `headline`) |
| `stability`, `stabilityLevel` | Stability (also copied to `headline`) |
| `stabilityDetail` | What Stability is made of: `swaps` (total, in halves), `conflictSteps`, `swapsByScenario` (the swaps at each conflict step), `topValueBefore`, `topValueAfter` |
| `sensitivityStability` | `directness`, `context`, `stakeholder`, each `{ value, level, distance }` — the three sensitivity stabilities, with the points each traveled |
| `performance`, `performanceCaptured` | Performance (also copied to `headline`) |
| `userProfile` | Their value profile **after** Block 5 |
| `originalProfile` | Their value profile **before** Block 5 — compare the two to see movement |

Useful fields inside each `scenarioResults` entry:

| Field | Meaning |
|---|---|
| `selectedOptionId` | What they chose |
| `selectedRank` | Where that option sat in the ordering they were shown (1 = top) |
| `alignmentLevel` | How well the choice matched their values: aligned / weakly_aligned / misaligned / strongly_misaligned |
| `matchScore` | The same idea as a number, 0–100 |
| `cvrFired` | Whether the reflection step appeared (it only appears for misaligned choices) |
| `cvrEndorsement` | Whether they kept or changed their choice after reflecting |
| `cvrAltViewGenerated` | Whether they asked to see the second perspective |
| `decisionRole` | Who the decision was about — this drives the position effect |
| `timeMs` | How long that situation took |

---

## 6. `analysis` — the computed results

| Field | What it is |
|---|---|
| `value_profile_before_block5` | Their four values as `{ name: score }`, **before** Block 5 |
| `value_profile_after_block5` | The same four values **after** Block 5 |
| `value_profile_change` | `after − before`, per value. Positive = that value grew |
| `position_effect` | Everything about position. **See section 6b — this is the richest part of the dataset.** |
| `alignment_records` | Alignment label, fit score, CVR and APA for every scenario, in one table. **See section 6d.** |
| `scenario6_mpf_test` | The prediction test. **See section 6c.** |
| `mpf_predictions_every_scenario` | The prediction function run over all six scenarios. **See section 6e, and read its warning first.** |
| `post_block3_insights` | The value profile worked out from Blocks 1–3. Feeds Block 4. |
| `post_block4_final_analysis` | The analysis produced after Block 4, including the threshold tree. |
| `participant_record` | A consolidated record of everything from Blocks 1–4, raw and derived together. Has its own `schemaVersion`. |

`value_profile_change` is the direct answer to "did Block 5 move this person?". Without it you
would have to open two nested profiles and subtract by eye.

---

## 6b. `analysis.position_effect` — how much the chair mattered

Block 5 puts the participant in **five different chairs**, one per scenario:

| # | `position` | Meaning |
|---|---|---|
| 1 | `self` | Only me |
| 2 | `self_and_group` | Me and my people |
| 3 | `others` | Other people; I am not affected |
| 4 | `under_authority` | I decide, under my employer's rules |
| 5 | `receiving_end` | Someone else decides, and it lands on me |

### `by_scenario` — one row per situation

This is usually the field you want.

| Field | Meaning |
|---|---|
| `scenario_id`, `title` | Which situation |
| `order_shown` | 1–5, the order they met it |
| `position`, `position_label` | Which chair |
| `distance_from_profile_before_block5` | **How far that choice sat from the person they were before Block 5**, 0–100 |
| `departure_share` | The same gap, as a share of how far that scenario's six options *allowed* anyone to move, 0–100 |
| `nearest_possible_distance` | The closest any option there could have been |
| `farthest_possible_distance` | The furthest any option there could have been |
| `value_movement` | Per value, signed. Positive = the chosen option sat **above** their profile on that value |

### ⚠️ The single most misread pair of numbers in this dataset

**`distance_from_profile_before_block5` and `departure_share` are not the same thing, and the
share is not a distance.**

- **distance** = how far that choice actually sat from who they were. A real gap, 0–100.
- **departure_share** = *out of all the room that scenario offered*, how much of it they used.

A worked example from a real run:

| | Scenario 4 | Scenario 5 |
|---|---|---|
| distance from their pre-Block-5 profile | 25.8 | 25.8 |
| closest any of the six options could have been | 25.8 | 25.8 |
| furthest any of the six options could have been | 51.5 | 51.5 |
| **departure_share** | **0** | **0** |

A share of 0 does **not** mean "no distance". It means they chose the option that sat **closest to
their own values** out of the six available. The real gap was still 25.8, because even the nearest
option was 25.8 away.

Likewise, a share of 100 does not mean "maximum possible disagreement with themselves" — it means
they chose the furthest option **that this scenario offered**.

**The playground picture.** Two playgrounds: one 10 meters wide, one 100 meters wide. A child walks
10 meters in each. In the small one they reached the far wall; in the big one they barely left the
door. Same 10 meters, completely different behavior. `distance` is the meters walked.
`departure_share` is how much of the playground they crossed.

**So:** compare **share** across scenarios, because the scenarios offer different amounts of room.
Use **distance** when you want the real size of the gap. Both are stored, so one can always be
checked against the other, and `nearest_possible_distance` / `farthest_possible_distance` show you
the room that produced the share.

### ⚠️ `behind_the_veil` will never appear here

Scenario 6's position is `behind_the_veil`, and `positionRows()` drops it before a row can reach
this section. That is deliberate and not a gap in the data.

The other five positions vary WHO CARRIES THE COST. The veil removes the question: there is no
position to occupy, because not knowing is the condition of the exercise. A row for it would be an
average over a variable that was deliberately not set.

If you are counting rows and find five where you expected six, this is why.

### `by_position` — the same rows averaged per chair

Fields: `mean_distance_from_profile_before_block5`, `mean_departure_share`,
`scenarios_at_this_position`, `mean_value_movement`.

In the current deck each position appears exactly once, so these match `by_scenario`. That will
stop being true if scenarios are ever added.

### `authority_vs_receiving` — the cleanest reading in the study

```json
{
  "when_i_decided_under_my_employers_rules": 16,
  "when_the_same_decision_was_done_to_me": 100,
  "difference": 84,
  "moved_further": "receiving_end"
}
```

**Why this pair is special.** Scenarios 4 and 5 are a matched pair by design: same employer, same
decision, same six options, same numbers. **Only the chair changes.**

Everywhere else in Block 5, position and content change together, so a difference could be either.
Here a difference can only be position. If you report one position finding, report this one.

`difference` is `receiving_end − under_authority`. Positive means they departed further from their
own values when the decision was being **done to them**.

**A difference of 0 is a real result, not a missing value.** It means the participant chose the
same distance from their own values in both chairs — that position made no difference to them.
Check `by_scenario` for those two rows to see the distances behind it before concluding anything.

### `between_scenarios` — every scenario against every other one

`by_scenario` says how far each choice sat from **one fixed point**: the profile the participant
entered Block 5 with. That is a distance to a landmark, so two scenarios with the same distance can
still be in opposite directions — somebody who moved 30 points *towards* protecting the vulnerable
and somebody who moved 30 points *away* from it look identical there.

`between_scenarios` compares the choices **with each other**, which is the study's opening question
asked directly: *am I the same driver alone as I am with my children in the car?*

`pairs` holds one row per pair (10 rows for five positioned scenarios), each with:

| Field | Meaning |
|---|---|
| `pair` | A readable label, e.g. `"scenario 1 vs scenario 2"` |
| `from_*` / `to_*` | Scenario id, order shown, position and position label for each side |
| `distance_between_the_two_choices` | **Symmetric, 0–100.** How far apart the two chosen options are in value space. Large means they chose differently; it says nothing about which was more like them |
| `difference_in_distance_from_profile` | **Signed**, `to` minus `from`. Positive means the second choice sat further from who they were before Block 5 |
| `difference_in_departure_share` | The same comparison after each distance is expressed as a share of the room its own scenario offered. **This is the one to compare across pairs** |
| `moved_further_from_themselves` | **The scenario id** of whichever of the two sat further from the frozen profile, or `"neither"`. An id rather than a position, so it stays unambiguous if a position ever appears twice |

`alone_vs_with_dependents` is the scenario 1 versus scenario 2 row lifted out of the list, because
it is the pair most often asked for. It carries the same fields plus `why_this_pair_matters`.

> ⚠️ **Compare on `difference_in_departure_share`, never on the raw distance.** The five menus do
> not allow the same amount of movement. In a real run the same pair can read −0.2 on the raw
> distance and −17 on the share; the second is the honest one.

> ⚠️ **One pair from one participant is a description, not a finding.** Two scenarios differ in
> subject matter as well as in who carries the cost, so a difference is position **or** content.
> Scenarios 4 and 5 are the only pair in the deck that holds the content constant — which is what
> `authority_vs_receiving` above is for.

Scenario 6 is **not** in this table. It has no position by construction. Its distance from the
frozen profile is stored alone in `analysis.scenario6_mpf_test`.

### `decided_versus_wished` — scenario 4's decision against scenario 5's wish

The same employer, the same cut and the same six options, met twice: in scenario 4 the participant
decides and it lands on their colleagues; in scenario 5 someone else decides, it lands on them, and
they only say what they wish. The numbers the results page shows under the mirror chart, saved.
Each side is judged on the profile the participant brought into its own scenario, exactly as VCI is.
`null` for a participant who stopped before scenario 5.

| Field | Meaning |
|---|---|
| `acted_option_title`, `wished_option_title` | What they chose, and what they wished for |
| `acted_alignment_label`, `wished_alignment_label` | The alignment label of each (Aligned / Weakly aligned / Misaligned / Strongly misaligned) |
| `acted_choice_was_aligned` | `true` only when the decision was the option labeled **Aligned** — their best fit |
| `wished_choice_was_aligned` | `true` only when the wish was the option labeled **Aligned**. A Weakly aligned wish reads `false`; read the label beside it |
| `vci_acted` | 100 × the VCI weight of the decision's label: 100 / 80 / 50 / 10 |
| `vci_wished` | The same for the wish |
| `responsibility_gap` | `vci_wished − vci_acted`. Positive = truer to their values when the decision was not theirs |
| `labels_apart` | 0–3: how many labels separate the two choices |
| `responsibility_gap_reading` | The words: "About the same…" (0 apart), "Somewhat truer…" (1 apart), "Much truer…" (2–3 apart) |
| `wished_for_the_same_option` | They wished for exactly what they chose |
| `mirror_gap` | The decision's `departure_share` minus the wish's. Positive = further from their own frozen values when deciding. Read it beside `responsibility_gap`: the two use different profiles on purpose |
| `wish_seconds`, `wish_was_hurried` | Time on the wish; under 12 seconds is flagged as likely recall rather than reflection |

### The rest

| Field | Meaning |
|---|---|
| `overall_effect` | The widest gap in `departure_share` between any two positions |
| `overall_effect_label` | Plain-language band for it |
| `drift_check` | Whether departure grew simply because the study went on, rather than because position changed. **A large value here weakens any position reading** |
| `direction_sentence` | A readable summary of the pattern |

---

## 6c. `analysis.scenario6_mpf_test` — the prediction test

**This is the only section in the document that measures the SOFTWARE rather than the
participant.** Everything else asks what the person did. This asks whether the model could predict
them, and what happened when they were told.

Scenario 6 is the Veil of Ignorance. The participant writes one rule for an emergency before
knowing which person in it they will be. Four rules, one per value. After they choose, the **Moral
Prediction Function (MPF)** shows them what it had expected, as a percentage on each rule. Then they
say whether it sounds like them, whether it surprised them, and whether they want to change.

**It never feeds anything.** No profile update, no contribution to VCI, Stability, Performance or
the position effect. Two reasons, both binding: a sixth scenario that moved the profile would add
swaps to Stability that no decision of the participant's produced, and a test of the model cannot
also be evidence for it.

### The parts

| Key | What it holds |
|---|---|
| `what_this_is` | A sentence of context, stored in every record so the section explains itself |
| `rule_version` | Which prediction rule produced these numbers. **Never pool across versions** |
| `mpf_prediction` | What the model said, before the participant saw anything |
| `participant` | What they picked, what they answered, and whether they moved |
| `wavering` | Switches and rules opened, split either side of the guess |
| `what_they_did` | The decisions in order, in seconds from the scenario opening. **Renamed from `every_interaction` on 15 September 2026, and it is now shorter** — see below |
| `distance_from_profile_before_block5` | How far the rule they wrote sat from who they were before Block 5. **Not part of the position effect** — see below |

### `mpf_prediction`

| Field | Meaning |
|---|---|
| `chance_if_guessing_percent` | **25 for four rules. Report this next to every percentage.** A 40% prediction is a modest claim, not a strong one, and the number means nothing without its baseline |
| `by_rule` | Each rule with the percentage shown, its rank, and the fit score the participant saw |
| `most_expected_rule` | The model's top pick |
| `gap_between_top_two` | How far apart the top two were on the uncensored fit. **Near zero means the MPF had no real opinion, whatever the percentages look like.** Filter on this before treating a prediction as a commitment |
| `how_sure_the_mpf_was` | 0 to 1, from the participant's own VCI and Stability at equal weight |
| `sharpness_setting` | The softmax temperature actually used, so the prediction can be recomputed |

### `participant`

`rule_chosen_before_seeing_the_guess` is the important one. **It is the only uncontaminated choice
in this scenario**, because it was made with nothing on screen about a prediction.
`rule_chosen_in_the_end` may differ, and `changed_after_seeing_the_guess` says whether it did. Each
also has a `..._title`, so the rule can be read without looking the id up.

**Three things can happen after the guess, and two fields are needed to tell them apart** (added
19 September 2026). Pressing "Change my answer" sends the participant back through the four rules,
and they may well choose the rule they started with — a real reaction to the guess that
`changed_after_seeing_the_guess` alone records as if nothing happened.

| `pressed_change_my_answer` | `changed_after_seeing_the_guess` | `what_happened_after_the_guess` |
|---|---|---|
| false | false | `kept their first rule` |
| true | true | `changed to a different rule` |
| true | false | `reconsidered, then came back to their first rule` |

`what_happened_after_the_guess` is the field to group on. For runs recorded before that date the
flag is absent, and it is read from the `what_they_did` log instead (a `changed_answer` entry), so
every record answers the same question.

`mpf_chance_of_their_first_choice_percent` is the chance the model gave the rule they picked
**before** the guess — the number `mpf_guessed_right` is about.
`mpf_chance_of_their_final_choice_percent` is the chance it gave the rule they ended on. They are
the same number unless the participant changed rules.

`does_this_sound_like_me_1_to_7` is self-recognition. `mpf_guessed_right` is accuracy. They are
different questions and a participant can answer 7 to a wrong guess or 1 to a right one.

### `order_rules_were_shown_in`

The four rules are **shuffled for every participant**, so unlike every other scenario the display
order cannot be recovered from the scenario definition. This array is what they actually saw, top to
bottom.

Keep it. Without this column an order effect could not be checked at all, which would make the
shuffle a decision taken on faith. With it, you can regress choice on display position and show the
line is flat.

### `what_they_did` — decisions only

Seven kinds of moment reach the database, and every one of them is a choice, the guess arriving, or
an answer:

`selected` · `guess_shown` · `answered_sounds_like` · `answered_surprised` · `kept_answer` ·
`changed_answer` · `committed`

Two kinds used to be logged and are **no longer recorded anywhere**: expanding a rule's details
(`opened_details`) and leaving the confirm view without committing (`backed_out`). Both were
navigation rather than decision. The informative part of them — how many distinct rules were opened
on each side of the guess — is in `wavering`, which is counted separately and is unaffected.

If you meet `every_interaction`, or either of those two event names, you are looking at a record
written before 15 September 2026.

### `distance_from_profile_before_block5`

The same arithmetic as the position effect — mean absolute difference over the four values — and
**deliberately not part of it**. Scenario 6 has no position: the whole point of the veil is that the
participant cannot be told where they stand. The number is here because it is worth having, and
nowhere else because it must not be averaged into the five position rows.

### `wavering` — and why it is split

`switches_before_the_guess` and `switches_after_the_guess` separate two people the single
`changed_after_seeing_the_guess` flag would record identically: one who agonised through all four
rules and then held firm, and one who went straight to a rule and only moved once told what we
expected. **The second is reactivity. The first is not.**

### ⚠️ Three traps in this section

1. **A percentage without its baseline.** Chance is 25%, not 0%. Always report both.
2. **A tiny `gap_between_top_two`.** Two rules at 27% and 26% is a coin flip wearing percentages.
   An analysis that averages those in with a 76% prediction is treating a shrug as a commitment.
3. **Reading a change as agreement or defiance.** A participant who changes may be correcting
   themselves or resisting being predicted. `does_this_sound_like_me_1_to_7` is what separates
   those, and neither field means much alone.

---

## 6d. `analysis.alignment_records` — the fit, and what happened when it was poor

One row per scenario, answering one question in four parts: **how did this choice sit against the
participant's own values, and what happened when it did not?**

Those four parts used to be four scattered optional fields on a scenario row. Here they are one
table.

### `by_scenario` — the columns

| Field | Meaning |
|---|---|
| `scenario_id`, `order_shown`, `title`, `position`, `position_label` | Which situation this was |
| `decision_role` | `decider` · `recipient` (the wish) · `predicted` (the model test) |
| `counts_towards_consistency_and_stability` | True only for `decider`. **Filter on this before averaging anything** |
| `chosen_option_id`, `chosen_option_title` | What they chose |
| `alignment_label` | `Aligned` / `Weakly aligned` / `Misaligned` / `Strongly misaligned` |
| `alignment_level` | The same thing as the internal enum, for joins |
| `alignment_score_0_to_100` | The fit score. ⚠️ **Floors at 0** — see below |
| `alignment_rank_within_the_scenario` | 1 = best-fitting option available |
| `alignment_score_of_every_option` | `{ option id: score }` for the whole menu, so the choice can be read in context |
| `chose_the_best_fitting_option` | Whether they took the top of the menu |
| `choice_was_still_aligned_to_the_pre_block5_profile` | The chosen option landed in the **top two** alignment tiers (Aligned or Weakly aligned) when scored against the frozen pre-Block-5 profile. ⚠️ **Not** "they chose what they would have chosen before" |

| `per_scenario_consistency_0_to_1` | That scenario's contribution to VCI: the weight of the chosen option's alignment label. Six options: Aligned 1.00, Weakly aligned 0.80, Misaligned 0.50, Strongly misaligned 0.10. Scenario 6 (four options): 1.00 / 0.67 / 0.33 / 0.00. Recorded for scenarios 5 and 6 too, never averaged into VCI |
| `cvr` | The reflection step — 14 fields, below |
| `apa` | The clarification step — `{ ran: false }` when it did not happen |

**Which profile the alignment columns are judged on.** Always the profile the participant brought
INTO that scenario (Blocks 1–4, as moved by earlier CVR and APA answers), on every path. Keeping
the option after the reflection, and reaching a final choice through the clarification, both move
the profile for the NEXT scenario; neither re-judges the choice made in this one.

⚠️ **Two changes on 18 September 2026 — do not pool runs across them.** (1) On rows where
`apa.ran` is true, the alignment columns and `per_scenario_consistency_0_to_1` used to be judged on
the profile AFTER the clarification had moved it, which could lift a misaligned choice into Aligned.
(2) Options that fit equally well used to be ordered by their id, alphabetically; they are now
ordered by how much they give of what the participant holds. That changes at least one option's
label in 7.8% of scenario-profile pairs, and the Aligned option itself in 7.1%. Both change VCI, so
the prediction rule's version moved with them: `rule_version` in section 6c reads `2026-09-18-c` or
later under the new rule.

⚠️ **A third change on 19 September 2026 — do not pool runs across it either.** The weight each
alignment label carries in `per_scenario_consistency_0_to_1`, and so `consistency_score` and
`consistency_label`, changed to the values in the table above, and the labels became the six listed
under `consistency_label`. Runs made under the current weights carry `rule_version` `2026-09-19-d` or
later in section 6c; earlier runs used a different weighting and are not comparable.

### `cvr` — the reflection that fires on a poor fit

`fired` · `endorsement_after_reflection` · `value_the_option_undercut` (+ `_label`) · `lens` ·
`whose_view_was_shown` · `stakeholder_text_shown` · `second_lens_was_generated` ·
`lens_shown_first` · `lens_the_participant_picked` · `what_picking_it_meant` ·
`sensitivity_change_committed` · `choice_before_reflection` · `choice_after_reflection` ·
`changed_their_choice`

### `apa` — the clarification when reflection did not settle it

`ran` · `confidence_1_to_5` · `the_stakeholder_influenced_them` ·
`value_they_prioritized` (+ `_label`) · `option_that_triggered_it`

**`what_they_said` is gone, and runs collected before 17 September 2026 still have it.** It held
the APA page's first question — `endorse` / `context` / `unsure` — asking whether the participant
really ranks the option's value above the one it undercut, or only did so for that situation. Both
the question and the profile movement behind it were removed, so a run is now on one side or the
other of the change:

| | before 17 Sep 2026 | after |
|---|---|---|
| `apa.what_they_said` | present | absent |
| questions that move the profile | two (the endorsement, then the value they name) | one (the value they name) |
| what naming a value does | +30 to it, −20 to whichever value was on top | +30 to it, −10 to each of the other three |

**Do not pool the two.** `value_they_prioritized` looks identical across the change and means the
same thing, but it moves the profile by a different rule, so `policy_snapshot_after` and everything
derived from it — stability, the position effect, later alignment scores — are not comparable.
`shape_version` on the document is what tells them apart.

### `totals`

Counted over the **decision** scenarios only; the wish and the prediction test are in
`by_scenario` and excluded here. Holds `scenarios_counted`, `alignment_level_counts`,
`mean_alignment_score`, `times_reflection_fired`, `times_clarification_ran`,
`times_they_changed_their_choice`.

`alignment_level_counts` is keyed by the **internal level** — `aligned`, `weakly_aligned`,
`misaligned`, `strongly_misaligned` — rather than by the display words, so a query never has to
quote a phrase with a space in it and nothing breaks if the wording on screen ever changes. The
readable form is on every row as `alignment_label`.

The section header also carries `what_aligned_to_the_pre_block5_profile_means`, stated once rather
than repeated on all six rows.

### ⚠️ Two traps, both stored in the record itself

1. **The label is RANK-BASED, not absolute.** The best-fitting option in a scenario is labeled
   Aligned *even when it fits the participant badly*, and every scenario produces exactly one.
   Counting Aligned choices measures how often somebody took the top of the menu — never how well
   the menu suited them.
2. **`alignment_score_0_to_100` floors at 0.** Two options that missed by 104 and by 154 both read
   0. Safe to report; unsafe to rank or subtract with. The uncensored quantity is `matchShortfall`
   on the raw scenario row in `blocks`.

---

## 6e. `analysis.mpf_predictions_every_scenario` — the predictor, run everywhere

> ### ⚠️ READ THIS BEFORE USING ANY NUMBER IN THIS SECTION
>
> **Only scenario 6's probabilities were ever shown to a participant.** Every other row was
> computed afterwards, on the way into this database, from data the study had already stored. No
> probability for scenarios 1–5 was on screen while anybody was deciding, and nothing about their
> run changed because of it.
>
> The row tells you which is which: **`was_shown_to_the_participant`**. Check it before describing
> anything here as a prediction the study made in advance.

### What it is for

Scenario 6 asks the MPF one question and gets one answer per participant. That is a single data
point per person. Running the same rule over the other five scenarios turns one observation into
six, so calibration can be looked at at all — and it costs nothing, because every input was already
in the database.

### `confidence_dial` — and the one honest caveat

| Field | Meaning |
|---|---|
| `consistency_score`, `stability_score` | The participant's VCI and Stability |
| `confidence_0_to_1` | The mean of `VCI/100` and `Stability/100`, at equal weight |
| `how_it_works` | The rule, stored in the record |

Confidence sets the softmax temperature between **60 (flat)** and **18 (sharp)**. Both inputs are
end-of-block figures that **do not exist until Block 5 has finished**, so there is no honest "VCI as
it stood at scenario 2" and every row uses the same pair — the same pair scenario 6's live
prediction used.

**So scenarios 1–5 use one number from the participant's future.** It affects only how *sharp* the
probabilities are, never which option leads, because temperature is a single divisor applied to
every option alike.

### `by_scenario` — the columns

| Field | Meaning |
|---|---|
| `was_shown_to_the_participant` | **True for scenario 6 only** |
| `this_was_a_wish_not_a_decision` | True for scenario 5 |
| `options_on_the_table` | 6 for scenarios 1–5, 4 for scenario 6 |
| `chance_if_guessing_percent` | **16.7 or 25. Report it next to every percentage** |
| `profile_used` | A sentence: which profile this row was predicted from |
| `profile_used_values` | The four values used, so the row can be recomputed |
| `by_option` | One entry per option, ranked: `option_id`, `option_title`, `mpf_chance_percent`, `rank`, `fit_score_0_to_100`, `built_on` (+ `_label`). ⚠️ Each percentage is rounded to one decimal, so six of them can sum to 100.1 rather than 100. That is rounding, not an error |
| `most_expected_option_id`, `most_expected_option_chance_percent` | The model's top pick |
| `gap_between_top_two` | On the uncensored fit. **Near zero means the MPF had no real opinion, whatever the percentages look like** |
| `how_sure_the_mpf_was`, `sharpness_setting` | Confidence, and the softmax temperature it produced. The temperature is stored **unrounded** so the probabilities can be reproduced exactly |
| `participant` | Their first and final choice, the chance given to each, the rank the MPF gave their pick, and whether the MPF named it |
| `using_profile_before_block5` | The same arithmetic from the frozen profile — a predictor that never learns |
| `self_check` | Scenario 6 only — see below |

**The profile each row uses is the one that scenario opened on.** Scenario 1 is predicted from the
pre-Block-5 profile, scenario 2 from what scenario 1 left behind, and so on. That makes each row a
forecast the model could genuinely have made at the time, rather than a retrofit that already knows
how the run ended.

`using_profile_before_block5` is the second, simpler predictor, kept because the two answer
different questions. The main columns ask *could the model have called this at the time?*; this one
asks *how much did the updating during Block 5 actually buy?*

### `self_check` — the guarantee this section rests on

Scenario 6's probabilities are recomputed here by the same route as the other five, then compared
with the ones actually shown and stored during the run. They must agree to within **0.1 percentage
points**.

| Field | Meaning |
|---|---|
| `passed` | True when the recomputation reproduced what was shown |
| `largest_difference_in_percentage_points` | The worst gap found |

**If `passed` is ever false, do not use this section.** It means the recomputation has drifted from
the live prediction path, and every number here for every other scenario is suspect. The same check
runs offline in `npm run validate:dbshape`, over three very different simulated participants.

### `totals`

Counted over the decision scenarios only. `scenarios_counted`,
`times_the_mpf_named_their_first_choice`, `hit_rate_percent`, `hit_rate_if_guessing_percent`,
`mean_chance_given_to_their_first_choice_percent`.

> ⚠️ **One participant's hit rate is noise.** With four decisions it can only be 0, 25, 50, 75 or
> 100. Pool across participants before reading it, and report `hit_rate_if_guessing_percent` beside
> it every single time.

---

## 6f. `analysis.mpf_prediction_percentages` — the three numbers, per scenario

Added **20 September 2026**. Section 6e holds every prediction in full, spread across a `by_option`
array of six entries inside each of six rows. This is the same predictions cut down to the three
numbers that actually get asked for, one row per scenario, in the order they were shown.

> ⚠️ **Only scenario 6's percentages were ever on screen.** Every other row was computed afterward,
> exactly as in section 6e, and each row carries `was_shown_to_the_participant`. Check it before
> describing any of this as a prediction the study made in advance.

### `by_scenario` — the columns

| Field | Meaning |
|---|---|
| `order_shown`, `scenario_id`, `title` | Which situation, and where it came in the run |
| `position`, `position_label` | Whose decision it was — the same chair as in section 6b |
| `decision_role`, `was_shown_to_the_participant`, `this_was_a_wish_not_a_decision` | What kind of row this is |
| `options_on_the_table`, `chance_if_guessing_percent` | 6 options / 16.7%, except scenario 6 at 4 / 25% |
| `most_expected_option_id`, `most_expected_option_title`, `most_expected_option_chance_percent` | **1. What the model expected**, and the chance it gave it |
| `their_first_choice_*` / `their_final_choice_*` (`option_id`, `title`, `chance_percent`) | **2. What they took**, before and after any reflection, and the chance the model had given it |
| `points_behind_the_most_expected_option_at_first_choice` / `..._at_final_choice` | **3. The distance between the two, in percentage points.** 0 means the model named their choice |
| `rank_the_mpf_gave_their_first_choice`, `mpf_named_their_first_choice`, `mpf_named_their_final_choice` | Where their option sat in the model's ranking |
| `they_changed_their_choice` | True when reflection or clarification moved them off their first answer — the two sets of percentages are then a before and an after |

### `totals`

Over the decision scenarios only: `scenarios_counted`,
`times_the_mpf_named_their_final_choice`, `mean_points_behind_the_most_expected_option`,
`largest_points_behind_the_most_expected_option`.

> ⚠️ **The distance is in percentage POINTS, not a percentage.** Read it against
> `chance_if_guessing_percent`: on a six-option scenario every option starts at 16.7%, so a gap of
> 5 points is a large share of the spread the model had to work with. On scenario 6, where guessing
> is 25%, the same 5 points means something smaller.

**This section is a copy, not a second measurement.** It is built from
`analysis.mpf_predictions_every_scenario` rather than predicted again, and `npm run
validate:dbshape` checks the two agree row for row (gate D39). If they ever disagree, 6e is the
original and this is the one that is wrong.

---

## 6g. `analysis.mcf` — the Moral Commitment Function

Added **23 September 2026**. For every option in every scenario: what it gives beyond what the
participant asked for on each of their four values, what it asks of them instead, which option on
that table serves each value most, and what taking that one would ask in exchange.

> ### ⚠️ MOST OF THIS WAS NEVER ON SCREEN
>
> MCF lives inside the **Compare all options** overlay, under the values chart, and every option's
> reading starts closed. Seeing any of it takes two deliberate acts: open the overlay, then open a
> reading. Check **`was_read`** on the scenario row and on the option before treating a single
> number here as something the participant was told.

| Field | What it holds |
|---|---|
| `was_read`, `options_read`, `readings_opened`, `seconds_reading` | The exposure. `read_the_option_they_chose` says whether one of the readings was for the option they took |
| `compare_overlay_opens` | How many times the overlay itself was opened in that scenario |
| `profile_used`, `profile_used_values` | The four values the reading was built on — the profile that scenario opened on, which is the profile the reading used |
| `by_option[].values[]` | Per value: `you_hold`, `this_option_delivers`, `gap`, `direction`, `cost_of_falling_short`, `more_than_you_asked_for`, `served_most_here_by`, `how_much_more_that_one_delivers` |
| `by_option[].in_exchange[]` | For each value the option falls short on: which option to take instead, whether it meets what they hold, and what it asks instead |
| `rule_version` | The MCF arithmetic that produced the row. **Never pool rows made under two versions** |

**It cannot disagree with the alignment label.** `cost_of_falling_short` is the study's own
per-value shortfall, taken from the function that produces the alignment score rather than
recomputed, and the four parts sum to that score's shortfall. `npm run validate:mcf` checks it
(gate M1), and `npm run validate:dbshape` checks the stored copy (gate D50).

> ⚠️ **`it_asks_less_or_more_overall` is stored and was never shown.** It compares two options'
> total shortfall for this participant — a fit comparison — and the study never shows a fit verdict
> to somebody who is still choosing. It is here for analysis only.

**No sentence is stored.** The wording a participant read is derived from these numbers by
`block5MCFWords`, so a stored copy would only be a second thing to keep in step.

---

## 6h. How the value scores are made, and the versions that must never be pooled

Added **24 September 2026**. The seven value scores (and so the four policy values Block 5 uses)
come from one file, `thresholdTree.ts`. They appear in three places:

- `analysis.participant_record.derived.thresholdTree`
- `blocks.block5_emergency_scenarios.originalProfile`
- `analysis.value_profile_before_block5`

The rules that make them have changed, so **`analysis.participant_record.calibrationVersion` says
which rules made a record.**

| `calibrationVersion` | What changed |
|---|---|
| `null-cdf-2026-08-23` | The original common ruler |
| `null-cdf-2026-08-23-top100` | **Every value can reach 100.** Helped, directness, context and stakeholder are divided by their ceiling (98.8, 97.4, 93.1, 97.3), so each can be up to 7% higher than under the original ruler. Vulnerable, harm and gain are unchanged |
| `null-cdf-2026-09-24-recipe-donation-share` | **Block 1's donation signal is a share, not one click.** It used to be full (1) for any single donate click at the shelter and 0.5 for any single one elsewhere; it is now the share of the participant's refusals that were donations (shelter in full, elsewhere at half). Tables rebuilt to match. **This is the version every record made from 24 September 2026 on carries** |
| `null-cdf-2026-09-24-recipe` | **All of the rules above, plus tables rebuilt by a committed recipe.** The 23 August tables came from a recipe that was never saved, so they were replaced whole by `src/experiment/sensitivityCalibrationTables.ts`, generated from 200,000 pretend participants answering everything by chance with every answer and every button equally likely. Every value can move a few points, and the vulnerability scores of donors drop, because random button-pressing donates often (fixed by the next version) |
| `null-cdf-2026-08-23-top100-fair-ties-refusals-halfstep-dc` | **Directness and context: "never" is flagged.** Never pulling and never pushing makes directness `measured: false`; never keeping the money in any of the three places makes context `measured: false`. **Both still score 0** (researcher's choice: a 50 here would read as a real middle answer), so **always check the flag before reading a 0 as "did not move them"**. The CVR lens now breaks a context/directness tie with the participant's own coin instead of always showing context first |
| `null-cdf-2026-08-23-top100-fair-ties-refusals-halfstep` | **Half a step gets half the credit.** On reducing harm (group size), an average of half a step (one click, one rung, in one group) scores half of the one-full-step score (32 against 64) instead of jumping to 55. One step or more is unchanged |
| `null-cdf-2026-08-23-top100-fair-ties-refusals` | **A refusal is not a zero.** When both answers in a comparison are "never" (never kept the money in both places; never approved the rollout for both worker groups at a size; never approved it at both the smallest and the largest size), that comparison is dropped instead of counting as a difference of 0. A value with no measured comparison is marked `measured: false` in the tree and `notMeasured: true` in the Block 5 profile, and scores the neutral **50**. Everyone without a double refusal scores exactly as before |
| `null-cdf-2026-08-23-top100-fair-ties` | **Ties are decided by a coin, not by list order.** Before, a tie always went vulnerable > group size > gain > outcome > …; now a coin made from the participant's own answers decides, and every tie is recorded in the tree as `tiedValues` (groups) and `tiedWith` (per value), with the rule in `tieRule`. Scores are unchanged; only the rank of tied values can differ |

> ⚠️ **Never pool value scores made under two versions.** The same answers give different numbers,
> and on a tie at the top, a different #1 value.

> ⚠️ **A 0 on directness or context may be "not measured", not "did not move them".** Check
> `measured` (tree) or `notMeasured` (Block 5 profile) first. Unlike the two policy values, these two
> keep a score of 0 when not measured, by the researcher's choice.

> ⚠️ **A 50 marked not measured is not a measured 50.** Find these values in
> `derived.thresholdTree.dimensions[].measured` (false) or in
> `blocks.block5_emergency_scenarios.originalProfile.dimensions[].notMeasured` (true). The typical
> case is the participant who refused to harm anybody at any price. Their answers say nothing about
> *extra* concern for entry-level workers or for larger groups, because both answers of every
> comparison were "never". Exclude these values, or analyse them separately, whenever the analysis
> is about how strongly somebody holds a value.

**Which rankings a coin decided.** `analysis.participant_record.derived.thresholdTree.tiedValues`
lists every group of values that shared a score. A #1 value that sits in a tied group was chosen by
the coin, not by the answers; an analysis that leans on "their top value" can check it, or drop
those participants as a robustness test.

---

## 6i. `analysis.blocks_1_to_4_checks` — how Blocks 1-4 were answered

Added **24 September 2026**, on request. **Nothing here changes a score.** It lets an analysis tell
a response style from a value. Somebody who says "yes" at the very first step of every ladder, fast,
gets a strong and specific profile (gain first, helped second) out of a clicking habit, not out of
their values. Copied into `major_info_and_scores.blocks_1_to_4`.

| Field | What it holds |
|---|---|
| `said_yes_at_the_first_step_everywhere` | true when all **11** ladders were accepted at their first rung: kept $0.25 in all three places, acted to save 1 life on the lever and on the bridge, approved all six workforce rollouts for $1. **null** (not false) when a block is missing |
| `first_step_yes_count`, `ladders_answered`, `first_step_yes_by_block` | The raw counts behind it |
| `answered_very_fast` | true when the median time between two consecutive answers in Blocks 1-3 is under **2 seconds**. null when no answers were timed |
| `median_seconds_between_answers`, `…_by_block`, `answers_timed` | The raw times behind it. **2 seconds is a stated default**, so apply another line to these medians if needed |
| `values_not_measured` | Values whose every comparison was two refusals (see 6h). Vulnerability and group size then score 50; directness and context keep 0 |
| `tied_values`, `top_value_was_decided_by_a_coin`, `tie_rule` | Which values shared a score, and whether the #1 value was one of them |
| `scoring_version` | The same as `analysis.participant_record.calibrationVersion` |

> ⚠️ **A flag is a reason to look, not a verdict.** Somebody can genuinely accept at the first rung
> everywhere. Report results with and without flagged participants rather than silently dropping
> them. For payment decisions, `quality` (section 8c) is the section to use; this one is for analysis.

---

## 7. `feedback_answers` — and why it is readable

Every closed question is stored with **the question text next to the answer**:

```json
"CVR_helped": {
  "question": "The value-reflection step (CVR) helped me think more carefully about my decision.",
  "answer": 5,
  "scale": "1 to 7, where 1 = strongly disagree and 7 = strongly agree"
}
```

You do not need a codebook. The question text is copied automatically from the study's own source,
so it always matches what the participant actually read.

The sections are:

| Section | About |
|---|---|
| `decisionSupport` | The interface: option cards, consequences, trade-offs, metrics, preview, results page |
| `cvr` | The reflection step |
| `apa` | The adjustment step |
| `wellbeing` | A validated well-being scale — **structured differently** (see below) |

**`wellbeing` is the exception.** It is not a flat list of coded questions; it holds `items`
(the raw answers), `subscales`, a `wellbeingComposite`, and `openEnded` text. It is passed through
unchanged because it already has its own meaningful structure.

Answer types:
- `likert` → a number 1–7
- `yesno` → `true` / `false`
- `open` → free text the participant typed

---

## 8. `timings`

Milliseconds per part: `block1Ms`, `block2Ms`, `block3Ms`, `block4Ms`, `block5TotalMs`,
`summaryMs`, `feedbackMs`, and `totalExperimentMs`.

Useful for spotting participants who rushed. `headline.total_time_minutes` is the **sum of these
stages** converted to minutes — not `totalExperimentMs`, and not the whole study. See the table
below.

### ⚠️ Two pages are deliberately not timed

Since **15 September 2026** the study does not measure how long anyone spends on:

- the **insights** page, shown after Block 3
- the **final analysis** page, shown after Block 4

Both are pages a participant *reads*. Their duration measures reading speed and nothing this study
asks about, so it is neither recorded nor stored. `timings.stages` carries
`stages_not_timed: ["insights", "final_analysis"]` so the absence explains itself.

### What this did and did not change in the totals

An earlier draft of this document said flatly that "the totals did not change". **That was wrong for
one of them**, and the correction matters more than the original claim:

| Total | Changed? | Why |
|---|---|---|
| `active_time.total_active_minutes` | **No** | A separate ledger that counts on every page. This is what compensation is judged on |
| `timings.totalExperimentMs` | **No** | The span from the first stage to the last event, so reading time is still inside it |
| `headline.total_time_minutes` | **Yes — it got smaller** | It is the *sum of the timed stages*, and two stages are no longer timed. Measured at about **5 minutes** on a typical run |

`headline.total_time_minutes` was left as a sum because the alternatives are worse: a span is wrong
for a study done across several days, and keeping a hidden total that still included those pages
would mean storing their timing under another name. So the number narrowed, and it now travels with
a field that says so — `headline.total_time_minutes_covers`.

**For total effort, or anything about payment, use `active_time.total_active_minutes`.**

`insightsMs` and `finalAnalysisMs` no longer exist. If you meet them, that record was written
before 15 September 2026.

---

## 8b. `active_time` — real working time

Counted by a heartbeat every 5 seconds that adds time **only** when the tab was visible **and**
there had been a mouse move, key, click or scroll within the previous **90 seconds**. Idle time is
never included, and the rule itself is stored in the record as `counting_rule`.

| Field | Meaning |
|---|---|
| `total_active_minutes` | Real working time, added up across every visit |
| `by_stage_minutes` | The same, per screen. ⚠️ **These no longer sum to the total** — see below |
| `stages_left_out_of_the_breakdown` | The two pages that are not broken out: `insights`, `final_analysis` |
| `breakdown_note` | The same warning, stored in the record |
| `sittings` | Separate visits **inside** the run. A gap of more than 30 minutes starts a new one. **Not the number of logins** — see section 3b |
| `longest_idle_minutes` | The biggest single gap between activity |
| `first_seen_at`, `last_active_at` | ISO timestamps |
| `clock_stopped` | True once the study was finished. The clock never restarts |

> ⚠️ **`by_stage_minutes` does not add up to `total_active_minutes`,** and the gap is exactly the
> time spent on the insights page and the final-analysis page. Those two are no longer broken out
> (section 8), while the total still includes them because it is what compensation is judged on.
> Shortening somebody's total would have been a different decision from deciding what is worth
> measuring, and it was not the one taken.

**A participant may finish across several days.** Their wall-clock span could be a week while
`total_active_minutes` is 38. That is not an error — check `sittings`.

---

## 8c. `quality` — engagement checks and eligibility

Time alone cannot tell a genuine run from one done for the payment: somebody can reach 35 minutes
by nudging a mouse on one page. What they cannot fake is the *shape* of the run.

| Field | What it catches |
|---|---|
| `active_minutes`, `met_time_requirement` | The 35-minute rule |
| `fastest_block` | The classic tell: 2 seconds on a page |
| `blocks_under_30_seconds`, `rushed_blocks` | Which blocks were skimmed, by name |
| `scenarios_under_15_seconds` | Block 5 choices made without reading |
| `straightlined_feedback` | The same rating to every question |
| `longest_idle_minutes`, `sittings` | How the work was spread |
| `compensation_eligible` | The verdict |
| `reasons` | **Why** it failed, in plain words |
| `rule` | The rule that was applied, stored with the record |

**Every raw number is kept, not just the verdict.** A different rule can be applied later to data
already collected. `reasons` exists so a participant querying their payment can be given a
specific answer.

> `scenarios_under_15_seconds` uses Block 5's own per-scenario timer, which is **clock** time and
> therefore generous. A scenario flagged here was rushed even on the kindest reading.

> Since 15 September 2026 the **insights** and **final analysis** pages cannot appear in
> `rushed_blocks` or as `fastest_block`. They are pages to read, so taking them in quickly is not a
> fault — and every fast reader had been collecting two free strikes against a threshold of three.
> This makes eligibility slightly more generous, never less.

---

## 8d. `resume_state` — scaffolding, not data

Raw copies of the browser files a **half-finished** participant needs to continue on another
computer. It is **deleted the moment they finish**, so a completed document never contains it.

If you see it, that participant is unfinished. Never analyze it: it is an untranslated duplicate
of data that appears properly in `blocks`.

> Since **23 September 2026** the server MERGES this field per file instead of replacing it, and
> refuses it altogether once the study is completed. Before that, whichever browser synced last
> overwrote the whole thing, so a tab left open on an earlier machine could replace a complete
> snapshot with a half-finished one — and a participant resuming on a third machine was sent back
> to Block 1. A completed document should therefore never carry `resume_state`; one collected
> before that date might.

---

## 9. Example queries

**Everyone who finished:**
```js
db.participants.find({ status: "Study Completed" })
```

**Average consistency among finishers:**
```js
db.participants.aggregate([
  { $match: { status: "Study Completed" } },
  { $group: { _id: null, avg: { $avg: "$headline.consistency_score" } } }
])
```

**The headline numbers as a table:**
```js
db.participants.find(
  { status: "Study Completed" },
  { _id: 0, participant_id: 1, age: 1, gender: 1, headline: 1 }
)
```

**People whose choices depended most on who was affected:**
```js
db.participants.find({ "headline.position_effect": { $gt: 20 } })
```

**How far each choice sat from who they were, one row per scenario:**
```js
db.participants.aggregate([
  { $match: { status: "Study Completed" } },
  { $unwind: "$analysis.position_effect.by_scenario" },
  { $project: {
      _id: 0,
      participant_id: 1,
      scenario: "$analysis.position_effect.by_scenario.title",
      chair: "$analysis.position_effect.by_scenario.position_label",
      distance: "$analysis.position_effect.by_scenario.distance_from_profile_before_block5",
      share: "$analysis.position_effect.by_scenario.departure_share"
  } }
])
```

**The matched pair — deciding for others versus having it done to you:**
```js
db.participants.aggregate([
  { $match: { status: "Study Completed" } },
  { $group: {
      _id: null,
      mean_when_deciding: { $avg: "$analysis.position_effect.authority_vs_receiving.when_i_decided_under_my_employers_rules" },
      mean_when_receiving: { $avg: "$analysis.position_effect.authority_vs_receiving.when_the_same_decision_was_done_to_me" },
      mean_difference:     { $avg: "$analysis.position_effect.authority_vs_receiving.difference" }
  } }
])
```

**Did Block 5 move people's values?**
```js
db.participants.aggregate([
  { $match: { status: "Study Completed" } },
  { $group: { _id: null,
      protecting_the_vulnerable: { $avg: "$analysis.value_profile_change.vulnerabilityProtectionSensitivity" },
      reducing_harm:             { $avg: "$analysis.value_profile_change.groupSizeSensitivity" },
      how_much_is_gained:        { $avg: "$analysis.value_profile_change.gainResponsivenessSensitivity" },
      how_many_are_helped:       { $avg: "$analysis.value_profile_change.outcomeAggregationSensitivity" }
  } }
])
```

**How often the reflection step changed a choice:**
```js
db.participants.aggregate([
  { $match: { status: "Study Completed" } },
  { $unwind: "$blocks.block5_emergency_scenarios.scenarioResults" },
  { $match: { "blocks.block5_emergency_scenarios.scenarioResults.cvrFired": true } },
  { $group: { _id: "$blocks.block5_emergency_scenarios.scenarioResults.cvrEndorsement",
              n: { $sum: 1 } } }
])
```

---

## 10. Traps — read this list before you conclude anything

1. **Filter on `status`.** Unfinished runs have real but partial data.
2. **`headline` is copied, not independent.** Do not correlate `headline.consistency_score` with
   `blocks...vci` and report a finding. They are the same number.
3. **`analysis` is derived from `blocks`.** Same trap, one level up.
4. **`cvrFired` is not random.** The reflection step only appears when somebody chose against their
   own values, so any group defined by `cvrFired: true` is already a selected group.
5. **`originalProfile` vs `userProfile`.** Before and after Block 5. Mixing them up reverses the
   direction of every change you measure.
6. **Scenario 5 is deliberately different.** It is a wish rather than a decision — the same
   employer's rule is applied *to* the participant — and it is excluded from consistency,
   stability, and the reflection measures, but **included** in the position effect, because
   position is the thing it exists to vary.
7. **Compare with `departure_share`, not `distance`.** Scenarios differ in how far their six
   options let anyone move. Comparing raw distances across scenarios compares the menus, not the
   people.
8. **Check `drift_check` before reporting a position finding.** If departure simply grew as the
   study went on, the position pattern may be fatigue or practice rather than position.
9. **`by_position` currently equals `by_scenario`.** Each position appears exactly once in today's
   deck. Do not write analysis code that assumes one row per position forever.
10. **`lowbuffer` / `highbuffer` are dead names.** If you see them, the data predates 11 Sept 2026.
11. **Never use `timings` for effort.** It includes idle time. `active_time` is the real one.
12. **Filter payment analyses on `quality.compensation_eligible`,** and read `quality.reasons`
    before telling anyone why they did not qualify.
13. **`resume_state` is not data.** If present, the participant is unfinished.
14. **The two lifted scenarios are copies.** `blocks.block5_scenario_5_wish_on_the_receiving_end`
    and `blocks.block5_scenario_6_veil_of_ignorance` hold the same answers as the rows inside
    `scenarioResults`. Count one or the other, never both. Each says which row it came from in
    `this_is_a_copy_of`.
15. **Only scenario 6's MPF numbers were shown to anyone.** Every other row in
    `analysis.mpf_predictions_every_scenario` was computed afterwards. Check
    `was_shown_to_the_participant` before calling any of it a prediction the study made in advance.
16. **An MPF hit rate from one participant means nothing.** Four decisions give a rate of 0, 25, 50,
    75 or 100. Pool across participants, and report the guessing baseline beside it every time.
17. **The alignment label is rank-based.** Exactly one option per scenario is labeled Aligned, no
    matter how badly the whole menu fits. Counting Aligned choices measures how often somebody took
    the top of the menu, not how well the menu suited them.
18. **`insightsMs` and `finalAnalysisMs` are gone,** and so are those two pages in
    `active_time.by_stage_minutes`. The totals still include the time. See section 8.
19. **`participant_id` is the only id.** Older exports also had `session_id`, `sessionId` and
   `participantId` for the same value. They are gone from the top level; you may still meet
   `sessionId` deep inside `analysis.participant_record`, where it means the same thing.
20. **Value scores carry a version.** Read `analysis.participant_record.calibrationVersion` and
    never pool records made under two versions. Section 6h lists what each one changed.

---

## 11. If a field is not where this document says

Open `src/experiment/dbShape.ts` in the study's source. **Every rename between the study's internal
names and this database is in that one file**, as a list. Nothing is renamed anywhere else.
