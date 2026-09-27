# Analysis and figures plan for the paper — VRDS Experiment 2

Written 27 September 2026, at the researcher's request: *"I may forget some great ideas of analyzing my data ...
create an MD file ... what are the good information and strong analysis I can get ... the strong and smart
visualizations ... how to show the strength of measurements ... and connect everything with users' feedback."*

**What this file is.** A menu of every analysis and figure the collected data can support, with the exact database
field for each, the right statistic, what it can prove, and what it cannot. It is a plan and an idea bank; it does
not replace the two rule books:

| File | Role |
|---|---|
| `Generated Outputs/HOW_TO_READ_MY_DATABASE.md` | The dictionary: where every field is and what it literally means |
| `Generated Outputs/HOW_TO_ANALYZE_MY_DATA.md` | The rules: what may be claimed, the traps, the screen changes not to pool across |
| **this file** | The plan: which analyses and figures to build, in which order, to make the paper strong |
| `docs/MAJOR_SCORES_DISTRIBUTION.md` | The pretend-participant benchmarks every real result is compared with (`npm run report:major-scores`) |
| `docs/PREREGISTRATION_FREEZE.md` | What is fixed before the data is seen: constants, exclusion rules, cut-offs, the hypotheses of section 11 |

Field paths are written from the document root, for example `headline.consistency_score`. "Per scenario" fields are
inside `blocks.block5_emergency_scenarios.scenarioResults[]` unless another section is named. The production database
is `VRDS2` (from `MONGO_URL` in `.env`, never printed); the local development database is `vrds_experiment2`. Same
collection (`participants`), same shape.

---

## 0. Twelve rules that make every analysis below sound

1. **Sample:** `status: "Study Completed"` only. Report the drop-off separately (section 2.1).
2. **Pre-register first.** Fix the hypotheses (section 11), the exclusion rules, the cut-offs and the tests in
   `docs/PREREGISTRATION_FREEZE.md` before opening the real data. Everything not listed there is exploratory, and
   the paper says so.
3. **Never pool records made under two versions** (`analysis.participant_record.calibrationVersion`,
   `analysis.scenario6_mpf_test.rule_version`, `analysis.mcf.rule_version`,
   `analysis.card_order_by_scenario.by_scenario[].card_order_rule_version`, `blocks.feedback_answers.schemaVersion`,
   `fitScoreScale` on each scenario row, `consent.version`), nor across the screen changes of HOW_TO_ANALYZE 4.9.
   **The document carries no version of the study code itself** (the `SHAPE_VERSION` stamp lives only in the
   browser's sync state, found 27 September 2026), so date every record by `completed_at` against the dated tables.
   Real participants should all come after the final launch commit; check it anyway and show the check in a
   supplementary table.
4. **Raw beats derived.** `blocks` is what people did; `headline`, `analysis` and `major_info_and_scores` are
   computed from it. Never correlate a derived field with the field it was computed from (section 5.2 lists every
   such "mechanical" link).
5. **Decisions only for VCI, Stability, performance and the reflection measures:** filter per-scenario rows on
   `decisionRole` (absent = `decider`) or `analysis.alignment_records.by_scenario[].counts_towards_consistency_and_stability`.
   Scenario 5 is a wish; scenario 6 is a test of the model.
6. **Draw the baseline, always:** 50 for VCI (blind picking), 16.7% / 25% for the MPF, the pretend-participant
   kinds for every score (docs/MAJOR_SCORES_DISTRIBUTION.md). A number without its reference invites the reader to
   supply a flattering one.
7. **Groups, not verdicts on people.** One person's VCI, Stability or performance is rough (same pretend person
   twice agrees only 0.15-0.48; HOW_TO_ANALYZE 4.8). Report distributions, means with confidence intervals, and
   comparisons between groups.
8. **Effect sizes with 95% confidence intervals, not p-values alone.** Bootstrap by resampling PARTICIPANTS (not
   rows), because each person contributes several scenarios.
9. **Correct for many tests:** Holm within the primary family, Benjamini-Hochberg (FDR 5%) for exploratory
   families. Say how many tests each family had.
10. **Flags are robustness checks, not silent exclusions:** run the main result with and without each flag
    (section 2.4) and report both.
11. **Participants saw their scores before the feedback.** The results page (`Block5SimulationSummaryPage`) shows
    VCI, Stability and Performance with their labels, then the charts of their journey, and only then the
    feedback questions. Every feedback-score link is therefore "how people rated the experience after seeing
    their results" (section 6.1).
12. **No control group without reflection.** The reflection (CVR) fires only after a misaligned choice, for
    everyone. Reflection results are within-person before/after descriptions, not causal effects against a
    no-reflection condition (section 3.2). Say so in the limitations.

---

## 1. Build the analysis tables first

Every analysis below reads one of five flat tables. Build them once, from the database, with one script, and keep
the script with the paper (it is part of the reproducibility claim).

| Table | One row per | Key columns (database path) |
|---|---|---|
| **P** participants | participant | `participant_id`, `age`, `gender`, `completed_at`; the `headline.*` scores; `major_info_and_scores.*`; `quality.*`; `active_time.total_active_minutes`, `.sittings`; `sessions.total_logins`, `.used_more_than_one_browser`; `analysis.blocks_1_to_4_checks.*`; the seven sensitivities before Block 5 (`blocks.block5_emergency_scenarios.originalProfile.dimensions[]`: `key`, `score`, `rank`, `notMeasured`); `analysis.value_profile_change.*`; the feedback (section 6); the versions of rule 3 |
| **S** scenario choices | participant × scenario (6 per person) | from `scenarioResults[]`: `scenarioId`, `decisionRole`, `selectedOptionId`, `firstChoiceOptionId`, `alignmentLevel`, `selectedRank`, `matchShortfall`, `choiceRank`, `choiceBin`, `choiceMatchedPlannerTop`, `choiceCrossedOwnRedLine`, `choiceUsedTradeOff`, `cvrFired`, `cvrEndorsement`, `stakeholderGuided`, `performanceCaptured`, `vciScore`, `timeMs`, `introSeconds`, the whole `telemetry` object; joined by `scenario_id` to `analysis.alignment_records.by_scenario[]` (`cvr.*`, `apa.*`), `analysis.position_effect.by_scenario[]` (`departure_share`, `distance_from_profile_before_block5`, `value_movement`), `analysis.mpf_predictions_every_scenario.by_scenario[]` (`participant.*`, `using_profile_before_block5.*`, `gap_between_top_two`, `was_shown_to_the_participant`), `analysis.card_order_by_scenario.by_scenario[]` and `analysis.mcf.by_scenario[]` (`was_read`, `readings_opened`, `seconds_reading`, `read_the_option_they_chose`) |
| **O** options | participant × scenario × option (6 per scenario) | every option on the menu, whether it was chosen, and its attributes for that person: fit (`analysis.alignment_records.by_scenario[].points_short_of_what_they_asked_for_every_option`), card position (`analysis.card_order_by_scenario.by_scenario[].cards_from_first_to_last[]`), MPF chance (`analysis.mpf_predictions_every_scenario.by_scenario[].by_option[]`), performance (the option's `metrics` in the scenario content, `tools/export_block5_content.cjs`), which value it is built on (`by_option[].built_on`), whether its MCF reading was opened (`analysis.mcf.by_scenario[].by_option[].was_read`). **This is the table for the strongest analysis in the study** (the choice model, section 5.4) |
| **V** value moves | participant × scenario × move | `analysis.value_moves_asked_for_and_made.by_scenario[].moves[]` (`value`, `score_before_the_move`, `asked_for`, `made`, `cut_off_by`, `why`) |
| **T** the scenario-6 test | participant | `analysis.scenario6_mpf_test.*`: `mpf_prediction.*`, `participant.*`, `wavering.*`, `order_rules_were_shown_in`, `what_they_did` |

A starting sketch (Python; `MONGO_URL` is read from the environment, never written in the script):

```python
import os, pandas as pd
from pymongo import MongoClient

db = MongoClient(os.environ["MONGO_URL"])["VRDS2"]        # "vrds_experiment2" for local test runs
docs = list(db.participants.find({"status": "Study Completed"}))

P = pd.json_normalize(docs, sep=".")                        # columns like "headline.consistency_score"

rows = []
for d in docs:
    align = {r["scenario_id"]: r for r in d["analysis"]["alignment_records"]["by_scenario"]}
    pos = {r["scenario_id"]: r for r in d["analysis"]["position_effect"]["by_scenario"]}
    mpf = {r["scenario_id"]: r for r in d["analysis"]["mpf_predictions_every_scenario"]["by_scenario"]}
    for i, r in enumerate(d["blocks"]["block5_emergency_scenarios"]["scenarioResults"]):
        a, p, m = align.get(r["scenarioId"], {}), pos.get(r["scenarioId"], {}), mpf.get(r["scenarioId"], {})
        rows.append({
            "participant_id": d["participant_id"], "order_shown": i + 1, "scenario_id": r["scenarioId"],
            "decision_role": r.get("decisionRole", "decider"),
            "alignment_level": r.get("alignmentLevel"), "points_short": r.get("matchShortfall"),
            "card_position_chosen": r.get("choiceRank"), "cvr_fired": r.get("cvrFired", False),
            "changed_after_reflection": a.get("cvr", {}).get("changed_their_choice"),
            "apa_ran": a.get("apa", {}).get("ran", False),
            "performance_captured": r.get("performanceCaptured"),
            "departure_share": p.get("departure_share"),
            "mpf_chance_first_choice": m.get("participant", {}).get("mpf_chance_of_their_first_choice_percent"),
            "seconds": r.get("timeMs", 0) / 1000, **{f"tel_{k}": v for k, v in (r.get("telemetry") or {}).items()},
        })
S = pd.DataFrame(rows)
```

**Build and test the whole pipeline on simulated records before the real data exists:** `node
tools/validate_dbshape.cjs --dump=sim.json` writes a complete document with the real shape. A pipeline that runs
on it will run on the real collection, and every figure can be drafted before the first participant.

---

## 2. Show that the data can be trusted (the "strength of the data" section)

Reviewers decide in the first page of the results whether to believe the rest. These analyses answer that before
it is asked.

### 2.1 Where people stopped: a CONSORT-style flow diagram

Everyone who started → consented (`consent.agreed`) → finished each block (`current_stage` of the unfinished) →
completed (`status`) → met each quality rule → analysed. One box per step with its N; the drop-off stage of
unfinished runs as a bar chart. **Figure S1.** It shows the design did not lose a selected group (compare the
Blocks 1-4 profile of finishers and non-finishers: if the dropouts differ, say how).

### 2.2 An exclusion table, fixed in advance

One row per rule, with the number each removes, applied in a stated order. Candidate rules (the freeze note picks
the final list): `quality.met_time_requirement`, `quality.rushed_blocks`, `quality.scenarios_under_15_seconds`,
`quality.straightlined_feedback`. `quality.compensation_eligible` is a payment rule, not an analysis rule
(HOW_TO_ANALYZE 2): never use it silently.

### 2.3 Evidence of real engagement

| Question a reviewer asks | Evidence | Field |
|---|---|---|
| Did they work, or leave the tab open? | active minutes, not clock minutes | `active_time.total_active_minutes`, `.by_stage_minutes` |
| Did they take in the role, the one thing Block 5 varies? | seconds on each scenario's intro page | `introSeconds` |
| Did they deliberate before choosing? | time to the first pick | `telemetry.timeToFirstSelectionMs` |
| Did they read the options? | cards' details opened, explanations viewed | `telemetry.optionExpands`, `viewedExplanationOptionIds` |
| Did they use the tools? | compare charts, preview, MCF readings | `telemetry.compareChartsOpens`, `.previewImpactOpens`, `.mcfReadingsOpened` |
| Did they think in the reflection? | dwell in the CVR and APA pages | `telemetry.cvrDwellMs`, `.apaDwellMs` |
| Was the wish considered? | wish time, and the hurried flag (under 12 s) | `analysis.position_effect.decided_versus_wished.wish_seconds`, `.wish_was_hurried` |
| Did they read the prediction? | time looking at it | `analysis.scenario6_mpf_test.participant.seconds_looking_at_the_guess` |

**Figure S2:** raincloud plots (a half-violin, a box and every participant's dot) of these times, one panel per
measure, with the quality thresholds drawn. It shows the whole sample, not a mean.

### 2.4 Robustness: the result must survive every flag

Re-run each primary result (section 3) in each of these subsamples and show them together in one forest plot
(**Figure S3**: the effect and its 95% CI, one line per subsample). A result that holds everywhere is strong; one
that holds only in the full sample is a warning.

| Flag | Field | Why it matters |
|---|---|---|
| Said yes at the first step everywhere | `analysis.blocks_1_to_4_checks.said_yes_at_the_first_step_everywhere` | A clicking habit scored as "gain first" (audit D3) |
| Answered very fast in Blocks 1-3 | `analysis.blocks_1_to_4_checks.answered_very_fast` | Median under 2 s between answers |
| #1 value decided by a coin | `analysis.blocks_1_to_4_checks.top_value_was_decided_by_a_coin` | The card order rests on a tie |
| #1 and #2 values close | `analysis.card_order_by_scenario.how_close_the_top_two_values_were.gap_in_points` ≤ the frozen cut-off | The card order rests on a small gap (audit C7) |
| A value not measured | `analysis.blocks_1_to_4_checks.values_not_measured` | A 50 (or 0) that says nothing |
| Stability never measured | `headline.stability_was_measured` = false | Its 100 counts nothing (audit G5) |
| Value moves cut off at 0 / 100 | `analysis.value_moves_asked_for_and_made.totals.moves_cut_off` > 0 | Pinned values cannot move |
| More than one browser, or restored | `sessions.used_more_than_one_browser`, `.ever_restored_from_another_device` | A technical path that could, in principle, alter a run |
| Hurried wish | `decided_versus_wished.wish_was_hurried` | For the scenario 4/5 results only |

### 2.5 Versions and screen changes

A supplementary table of every version stamp (rule 3) with the count of records under each. If all real records
share one set, one sentence says so; if not, analyse the groups apart.

---

## 3. The research questions and their primary analyses

The study asks two questions (docs/VRDS_EXPERIMENT_GUIDE.md, section 1): **do people hold the same moral priorities
when the cost lands on someone else?**, and **does making a person look at the consequences of their own choice
change what they choose?** A third comes from the prior paper: **does reflection cost performance?** A fourth
tests the model itself: **can the MPF predict a choice?**

### 3.1 RQ1 — position: does it matter who carries the cost?

**The primary test: the matched pair.** Scenarios 4 and 5 are the same employer, the same cut and the same six
options; only the chair changes. Everything else in Block 5 changes position and content together.

| Analysis | Field | Statistic | Figure |
|---|---|---|---|
| Did they depart further from their values when it landed on them? | `analysis.position_effect.authority_vs_receiving.difference` (receiving − deciding, in departure share) | Wilcoxon signed-rank against 0; effect size: rank-biserial r with bootstrap CI; also the paired mean difference | **Figure 3a**: a paired slope chart, one line per participant from "I decided" to "done to me", the median line bold |
| Did they wish for the same option they decided? | `decided_versus_wished.wished_for_the_same_option` | share with a Wilson 95% CI | a single bar with its CI, in Figure 3 |
| Which value rises when the decision lands on them? | `decided_versus_wished.wish_minus_decision_by_value` (four values) | a one-sample test per value against 0, Holm across the four; report the mean shift and CI | **Figure 3b**: four bars (one per value, the same colors as everywhere in the paper) with CIs and the 0 line |
| The same in performance terms | `decided_versus_wished.wish_minus_decision_by_performance_metric` (five metrics), `overall_performance_wish_minus_decision` | the same tests | Figure 3c: five bars |
| How much truer to their values when it was not their decision? | `decided_versus_wished.responsibility_gap` (a label gap), `labels_apart` | the distribution (it takes few values) and a sign test | a stacked bar of −3…+3 labels apart |
| The "self-serving reversal" | decision `acted_alignment_label` Misaligned or Strongly misaligned AND wish `wished_alignment_label` Aligned | share with CI | named in the text: abandoning your values when it costs colleagues, returning to them when it costs you |
| What they did with the employer's values | `analysis.position_effect.company_stance.stance` (adopted / compromised / resisted), `.pull_toward_the_company` | shares with CIs; `pull` against how much they held the company's value (`analysis.position_effect.company_value_shown.participant_score_on_this_value_before_block5`, Spearman) | **Figure 4**: the distribution of `pull` with the ±8 bands shaded, and the three shares |

**The five chairs, descriptively.** `analysis.position_effect.by_scenario[].departure_share` by `position` (self,
self_and_group, others, under_authority, receiving_end). Each chair is one scenario, so chair and content are the
same thing here (HOW_TO_ANALYZE 4.4): show it, describe it, do not test it as position. **Figure 5:** a dot-and-CI
plot of departure share per chair in the order shown, with every participant's dots faint behind it. Beside it,
`between_scenarios.alone_vs_with_dependents.difference_in_departure_share` (the study's opening question, alone
against with your family) as one paired comparison, and a heat map of the mean
`between_scenarios.pairs[].difference_in_departure_share` for all ten pairs (**Figure S5**).

**Position and performance together.** The results page's sentence "Where other people carried the cost, you moved
furthest from your own values and took N points MORE performance" asks: when the cost is on strangers, do people
trade their values for performance? Test it on table S: a mixed model
`performanceCaptured ~ position + departure_share + position × departure_share + (1 | participant)`, descriptive
because position is confounded with content. **Figure 6:** departure share (x) against performance captured (y),
one small panel per chair.

**What the position number cannot do** (audit P2): the five-scenario `analysis.position_effect.overall_effect` is
100 for a real role-switcher and for a random chooser alike. Report it only as a description, next to VCI.

### 3.2 RQ2 — reflection: does looking at the consequences change the choice?

The reflection (CVR) fires after a misaligned first choice; the participant keeps the choice (firmly or less
firmly) or goes to the clarification (APA), names the value they want weighted and chooses again.

| Analysis | Field | Statistic |
|---|---|---|
| How often a first choice was misaligned (the reflection's reach) | `cvrFired` over decision rows | share per scenario and overall, with CIs |
| What people did after the reflection | `telemetry.cvrOutcome` (`endorsed-strong`, `endorsed-weak`, `went-to-APA`, `exited`) | shares; **Figure 7**: a Sankey diagram, first choice → misaligned? → reflection → kept firmly / kept less firmly / went to APA → final choice changed or not, with counts on every band |
| Did the reflection change the choice? | `analysis.alignment_records.by_scenario[].cvr.changed_their_choice` | share with CI, among reflected rows |
| When it changed, did it move toward their values? | fit of `cvr.choice_before_reflection` against the final choice, on the SAME profile (the one the scenario opened with), in `points_short_of_what_they_asked_for_every_option` | paired Wilcoxon on the shortfall; share that improved / worsened / stayed |
| Did the value named in APA guide the NEXT decision? ("learning transfer") | `apa.value_they_prioritized` against the value the next scenario's choice is built on (`by_option[].built_on` of the chosen option) | share of next choices built on the named value, against the share expected if choices ignored it (the base rate of that value among choices) |
| Does fit improve across the four decisions? | `alignment_rank_within_the_scenario` or `points_short_of_what_they_asked_for` by `order_shown` | a mixed model with a random intercept per participant |

**Two rulers, and why both are needed.** A choice's fit is judged on the profile the scenario opened with, and
earlier reflections moved that profile. So "fit improved over the scenarios" can mean the person moved toward their
values, or the model moved toward the person. Answer it twice: on the moving profile (`alignmentLevel`) and on the
frozen pre-Block-5 profile (`analysis.alignment_records.by_scenario[].choice_was_still_aligned_to_the_pre_block5_profile`,
and `analysis.position_effect.by_scenario[].departure_share`, which is always against the frozen profile). If fit
improves on the moving ruler only, the model learned the person; if it improves on both, the person changed too.
**Figure 8:** the two lines side by side over `order_shown`.

**The two reflection views and the stakeholder.** `cvr.lens_shown_first`, `cvr.second_lens_was_generated`,
`cvr.lens_the_participant_picked`, `cvr.what_picking_it_meant`; `cvr.whose_view_was_shown`,
`apa.the_stakeholder_influenced_them`, `stakeholderGuided`. These test the sensitivities (section 4.3).

**What may not be claimed:** that reflection *caused* better choices compared with no reflection. There is no group
without it (rule 12), the reflection only reaches misaligned choices (a selected group; HOW_TO_READ trap 4), and a
change after reflection can also be ordinary second thoughts. Claim the within-person before/after pattern, and name
a randomized no-reflection arm as the design for a future study.

### 3.3 H3 of the prior paper — does reflection cost performance?

An equivalence question, so an equivalence test (TOST), with the prior paper's margin of **±5 points** on the
captured scale (0-100 inside each scenario; `block5Performance.ts` explains why the raw composite would make this
margin 36% of its range). The cleanest comparison is within the reflected scenarios: the performance captured by the
first choice (`cvr.choice_before_reflection`) against the final choice. Paired TOST; report the 90% CI of the
difference inside (or outside) ±5. A second, weaker version: `performanceCaptured` of scenarios with and without a
reflection, within person (mixed model). **Figure 9:** the 90% CI against the ±5 band (an equivalence plot).

### 3.4 The model's own test — can the MPF predict a choice?

| Analysis | Field | Statistic |
|---|---|---|
| Top-pick accuracy against chance | `analysis.scenario6_mpf_test.participant.mpf_guessed_right` (chance 25%); pooled decisions: `analysis.mpf_predictions_every_scenario.by_scenario[].participant.mpf_named_their_first_choice` (chance 16.7%) | exact binomial CI for scenario 6; for the pooled decisions a cluster bootstrap (by participant) |
| Calibration: does 30% happen 30% of the time? | `participant.mpf_chance_of_their_first_choice_percent` and every option's `by_option[].mpf_chance_percent` | a reliability diagram (bins of predicted chance against the observed share chosen), Brier score and log loss, each against the uniform predictor as a **skill score** (1 − model loss / uniform loss); the Brier score split into its reliability and resolution parts says whether the model is honest (reliability) and whether it tells people apart (resolution) |
| Did learning during Block 5 help? | the main prediction against `using_profile_before_block5` (the predictor that never learns) | the difference in log loss and hit rate, paired by participant, with bootstrap CI |
| Where the model had no opinion | `gap_between_top_two` | calibration split by a frozen cut-off; a histogram (**Figure S7**) |
| Order effect in scenario 6 | `order_rules_were_shown_in` | choice by display position: chi-square against uniform, or a conditional logit with position as the only predictor; a flat line is the result |
| Self-recognition against accuracy | `participant.does_this_sound_like_me_1_to_7` × `participant.mpf_guessed_right` | a 2 × 7 table and an ordinal model |
| Reactivity | `participant.what_happened_after_the_guess`, `wavering.switches_after_the_guess`, `participant.were_you_surprised` | shares; reactivity = changed after the guess among those who did not waver before it |

**Figure 10:** the reliability diagram, pooled over the four decisions with scenario 6 as its own marked points,
the diagonal, and the two chance levels (16.7% and 25%) drawn. The caption says only scenario 6 was shown.

**Circularity to state:** the MPF's sharpness uses the participant's own end-of-block VCI and Stability
(`confidence_dial`), which it could not have known at scenarios 1-4. It changes how sharp the probabilities are,
never which option leads, so **top-pick accuracy is free of it and log loss is not**. Report accuracy as the primary
number. Also (audit R6, kept and stated by the researcher on 27 September 2026): a never-tested Stability of 100
raises that sharpness too.

### 3.5 More analyses worth having (exploratory, each cheap)

| Idea | Field | Why it is strong |
|---|---|---|
| **Principle against practice.** Does the rule written behind the veil match the value the person lives by? | `analysis.scenario6_mpf_test.participant.rule_chosen_before_seeing_the_guess` (one rule per value) against the pre-Block-5 #1 value (`originalProfile`, rank 1 among the four) and against the value most of their four decisions were built on | agreement (kappa) between what people say should happen to anyone and what they chose knowing where they stood; the veil's own question (HOW_TO_ANALYZE 5.3) |
| **Crossing one's own red line.** How often does a choice cross a limit the person refused outright in Blocks 1-3, and in which chair? | `choiceCrossedOwnRedLine`, `choiceBreaches`, by `position` | a vivid, easily understood measure of values giving way; more crossings when strangers carry the cost would be a striking descriptive result |
| **Trading away the #1 value** | `choiceUsedTradeOff` by scenario and chair | the planner's own record of a person taking an option that gives up the value they ranked first |
| **Which way did Block 5 move people?** | `analysis.value_profile_change.*` per value | the mean shift per value with CI (a group moved toward protecting the vulnerable, say); **Figure S11**: four bars |
| **Data-driven chooser types** | the value each decision was built on, across the four decisions (and the wish) | latent class analysis on those choice patterns, then compare the classes with the pretend kinds (section 7) |
| **Fast choices against considered ones** | `telemetry.timeToFirstSelectionMs` against `alignmentLevel` and `cvrFired` (mixed logistic) | are quick first picks more or less value-consistent? A dual-process question the data can answer |
| **Who the results page helped** | `TOOL_resultsPage` against `consistency_score` | if people with low scores rate the results page lower, the page's labels are doing work (section 6.1) |
| **Age and gender** | `age`, `gender` as moderators of the primary results | exploratory unless pre-registered; report as such |

---

## 4. Show that each contribution measures what it claims

For each contribution: what it claims, the evidence the data can give (validity in the standard sense: content,
construct, convergent, discriminant, predictive), the analysis, and the figure. **Table 5** of the paper can be this
section in one table (section 10).

### 4.1 VCI — consistency with one's own values (`headline.consistency_score`)

- **Known-groups validity against the simulation.** Place the real distribution on top of the pretend kinds of
  docs/MAJOR_SCORES_DISTRIBUTION.md (always the best fit 100, true to their top value 85, random 57, a new value
  every scenario 34, the worst fit 10). **Figure 2a:** the real participants' histogram with the pretend kinds as
  labelled reference lines. It shows at a glance whether real people behave like value-followers or like chance.
- **Better than chance:** real VCI against 50 (Wilcoxon), and against 56-57, the random chooser who also answers
  the reflection at random.
- **Convergent validity:** Spearman with the self-reported value congruence (`blocks.feedback_answers.feedback.wellbeing.subscales.valueCongruence`,
  items VC1 "My final decisions reflected what I truly value", VC2).
- **Internal consistency:** the four decisions' `vciScore` as four items (McDonald's omega, or Cronbach's alpha);
  low values are expected (four choices, different scenarios) and are part of why it is a group measure.
- **Watch:** VCI has 30 possible values; treat it as ordinal (Spearman, ordinal models).

### 4.2 Stability — whether the order of the four values held (`headline.stability_score`)

- **Only where measured:** analyse `stability_score` among `stability_was_measured` = true, and report the share
  never measured (it is a result in itself: how many people never went against their best fit).
- **Known groups:** the real distribution against the pretend kinds (Figure 2b).
- **What it depends on** (docs/BLOCK5_STEP_SIZE_SENSITIVITY.md): its absolute level moves with the step sizes;
  comparisons between groups do not. Report group comparisons, never one person's level word.
- **Convergent:** with decision confidence (`subscales.decisionConfidence`) and low regret (`subscales.lowDecisionRegret`)
  — people whose priorities held should feel surer; exploratory.
- **Descriptive gold:** the top value at the start and at the end (`blocks.block5_emergency_scenarios.stabilityDetail.topValueBefore`,
  `.topValueAfter`). **Figure 11:** an alluvial (Sankey) chart of the #1 value before → after Block 5, with the
  widths as counts. Few charts say "values held, or not" as clearly.

### 4.3 The seven sensitivities — the profile from Blocks 1-4

`blocks.block5_emergency_scenarios.originalProfile.dimensions[]` (policy: vulnerability, group size, gain, outcome;
framing: directness, context; voice: stakeholder), with `analysis.participant_record.derived.thresholdTree.dimensions[].measured`.

- **They are not noise:** the scoring ruler is built so that people answering at random spread about evenly over 0-100
  (roughly: the scores are whole numbers and some answers tie; `tools/regenerate_sensitivity_calibration.cjs`). A real
  distribution that is NOT flat (a chi-square over tenths of the scale against the random-answer distribution, per
  sensitivity) is evidence that real answers carry structure. **Figure 12:** seven violins with the flat
  line of random answering drawn.
- **They are not the same thing:** the 7 × 7 Spearman matrix (discriminant validity); a high correlation between two
  would mean one is redundant.
- **Blocks 1-3 replicate effects the literature already knows** (the strongest check that an instrument works):
  - more lives must be saved before people will PUSH someone (the footbridge) than before they will PULL a lever
    (`blocks.block2_trolley`: the lever and bridge `thresholdSavedLives`, and `directnessGap`) — the classic
    push/pull asymmetry;
  - people keep found money less readily outside a shelter than on a neutral street or in a wealthy district
    (`blocks.block1_money`, the three places);
  - people ask more before approving a rollout that harms entry-level workers than protected ones, and more for
    larger groups (`blocks.block3_ai_workforce`, `threshold_entry_level_*` against `threshold_senior_level_*`).
  Paired tests with effect sizes; **Figure S12**, three small paired panels. If the known effects appear, the
  instrument is measuring what the literature measures; if not, say so before interpreting Block 5.
- **Predictive validity — the strongest test:** do the Blocks 1-4 values predict the Block 5 choices, value by
  value? A conditional logit on table O (section 5.4) with, for each policy value k, the term (person's score on k ×
  the option's number on k). A positive coefficient for k means people who hold k more choose options that give k
  more. Four coefficients with CIs: **Figure 13**, a coefficient plot. This is the validity argument for the whole
  profile, and it does not use VCI.
- **The framing and voice sensitivities have their own behavioural checks:**
  - directness and context (`directnessSensitivity`, `contextSensitivity`) against the lens the participant picked
    as mattering (`cvr.lens_the_participant_picked`, `cvr.what_picking_it_meant`);
  - stakeholder (`stakeholderPerspectiveShiftSensitivity`) against being influenced by the stakeholder in Block 5
    (`stakeholderGuided`, `apa.the_stakeholder_influenced_them`) and against the self-report `CVR_reconsider`.
  Logistic models; state that directness and stakeholder are the two weakest sources (docs/MEASUREMENT_MODEL.md 10).
- **Flags first:** `notMeasured` values and coin-decided ties (section 2.4) are excluded or modelled separately.

### 4.4 CVR — the value reflection

Claims: it reaches the choices that went against the person's values, and it makes people reconsider.

- Reach: `cvrFired` rate per scenario (section 3.2).
- Engagement: `telemetry.cvrDwellMs`, `cvr.second_lens_was_generated`.
- Outcome: `telemetry.cvrOutcome`, `cvr.changed_their_choice`, the fit change (section 3.2).
- Self-report agreement: `blocks.feedback_answers.feedback.cvr.CVR_changed.answer` ("yes"/"no") against whether any
  reflection actually changed a choice → Cohen's kappa. Do people know when they changed? A strong, rarely reported
  analysis.
- Perceived value: `CVR_helped`, `CVR_useful`, `CVR_reconsider`, `CVR_confidence` (1-7) against the behavior
  (changed or not, dwell); `CVR_dual_helpful` among those who generated the second view.

### 4.5 APA — the value clarification

Claims: it lets a person say which value they want weighted, and the model then follows them.

- Use: `headline.adjustment_visits`, `apa.ran`, `telemetry.apaDwellMs`, `telemetry.apaBackouts`.
- What they named: `apa.value_they_prioritized` against their pre-Block-5 #1 value (named their own top value, or
  another one?) — a cross-table, and `apa.confidence_1_to_5` by that.
- Does the model follow? After APA the named value rises (the rule guarantees it: mechanical). The evidence is the
  NEXT choice (the learning-transfer line of section 3.2) and the fit of later choices.
- Self-report: `APA_clarify`, `APA_tradeoff`, `APA_better`, `APA_prioritization` against the behavior.

### 4.6 MCF — the moral commitment function

Claims: it puts into words what an option asks of the person's own values, and that information is used.

- **Exposure is the first result:** `analysis.mcf.scenarios_where_it_was_read`, and per scenario `was_read`,
  `options_read`, `readings_opened`, `seconds_reading`, `compare_overlay_opens`. Who reads it (a logistic model with
  the flags, active time, the sensitivities)?
- **Does reading go with the choice?** Within person (a person read in some scenarios and not in others): is the
  chosen option more often one whose reading was opened (`read_the_option_they_chose`), and is the final choice's
  fit better in scenarios where MCF was read (mixed model)? Self-selection is the trap: people who read may be
  different people. A within-person comparison removes the stable differences; say that it cannot remove the rest.
- **Content validity is built in:** its per-value costs add up exactly to the alignment shortfall (gate M1); every
  sentence passes the no-verdict, no-number check (`npm run validate:mcf`). Say this in the methods.

### 4.7 MPF — the moral prediction function

Section 3.4. The evidence of strength is calibration and skill against the uniform predictor, the learning test
(moving against frozen predictor), and the fact that scenario 6's prediction was fixed BEFORE it was shown.

### 4.8 Position effect

Section 3.1. Its strength rests on the matched pair (4 vs 5) and on `departure_share` being scaled to the room each
menu allowed. Check `analysis.position_effect.drift_check` before any five-scenario reading.

### 4.9 Overall performance (`headline.performance_captured`)

- Its scale is honest: 0 = the weakest option in every decision, 100 = the strongest (the chaser 100, random 52 in
  the simulation).
- **The trade-off result:** how people resolve values against performance (section 5.3). **Figure 14:** VCI (x)
  against performance captured (y), every participant a dot, the pretend kinds as labelled reference points (best
  fit 100/67, true to top value 85/40, random 57/52, chaser 76/100). It is the single figure that shows what the
  study is about.

---

## 5. How the measures relate to each other

### 5.1 The correlation map

A pre-specified Spearman matrix over table P, **Figure 15**: `consistency_score`, `stability_score` (measured only),
`performance_captured`, `authority_vs_receiving.difference`, `responsibility_gap`, the MPF accuracy per person
(`analysis.mpf_predictions_every_scenario.totals.hit_rate_percent`), `reflection_visits`, `adjustment_visits`,
`choice_switches`, MCF readings (sum of `readings_opened`), `active_time.total_active_minutes`, the seven
sensitivities, the size of the value change (sum of |`analysis.value_profile_change.*`|), and the feedback
subscales. Show it as a clustered heat map with the coefficient in each cell, cells that survive FDR marked, and the
mechanical links of 5.2 hatched out so no reader mistakes them for findings.

### 5.2 Mechanical links: related by construction, not findings

| Pair | Why they move together by construction |
|---|---|
| `consistency_score` and `alignment_counts` / `per_scenario_consistency_0_to_1` | the same labels |
| `stability_score` and `reflection_visits` / conflict steps | Stability counts only at reflections; no reflection = 100 |
| MPF sharpness or log loss and VCI / Stability | confidence is the mean of VCI and Stability |
| `value_profile_change` and `value_moves_asked_for_and_made` | the same moves |
| `headline.*` and `major_info_and_scores.*` and `blocks.*` copies | the same numbers |
| `wellbeingComposite` and its subscales | the composite is their mean |
| `responsibility_gap` and `vci_acted` / `vci_wished` | their difference |
| VCI and performance (partly) | each option champions a value and champions are rarely the top performers, so the deck itself makes them trade off |

### 5.3 Simulation-calibrated correlations: the smart step

Some correlation between two scores exists even for people who choose at random, simply because both come from the
same choices. So compare every real correlation with **its value among pretend random choosers** (and the other
kinds): run `tools/behavior_sim.cjs` (the same code as the major-scores page) and compute the same Spearman on the
pretend people. Report "real r = −0.35; random choosers r = −0.10; the difference is behavior, the −0.10 is the deck."
The same trick gives a p-value for any score by permutation: where does the real mean fall among thousands of
simulated samples of the same size? This turns the study's pretend participants from a check into a statistical
null model, and few papers can do it.

### 5.4 The choice model: what drives a choice?

The ambiguity of HOW_TO_ANALYZE 4.7 (the first card is often also the best fit) is answered by one model on table
O: a **conditional (multinomial) logit** of which of the six options was chosen, with option attributes as
predictors:

- card position on screen (1-6, or first-card yes/no);
- fit to the person (`points_short_of_what_they_asked_for`, lower is better), or the four value terms of 4.3;
- performance (the option's captured score in its scenario);
- the MPF chance (in a separate model, as its test);
- whether its MCF reading was opened;
- scenario fixed effects; random effects per participant (a mixed logit) if the sample allows.

The coefficients say, all else equal, how much being first on screen, fitting one's values and performing well each
raise the odds of being chosen. **Figure 16:** the odds ratios with CIs. Compare nested models (position only;
+ fit; + performance) by likelihood ratio and AIC: "the Blocks 1-4 profile predicts choices beyond the card order"
is the claim this can prove or disprove.

### 5.5 A path model, if the sample is large enough

Exploratory: reflection use → value congruence → satisfaction, and VCI → value congruence → well-being, as a
structural equation model or a simple mediation with bootstrap CIs. Needs roughly 150-200 participants for a stable
SEM; below that, report the two regressions and say it is exploratory.

---

## 6. Connecting everything with the feedback answers

### 6.1 The feedback, and the one fact that shapes every link to it

**What was asked** (`blocks.feedback_answers.feedback`; the same answers are copied in `major_info_and_scores.feedback`,
never count both):

| Section | Items | Scale | Shown to |
|---|---|---|---|
| `decisionSupport` | `TOOL_optionCards`, `TOOL_consequences`, `TOOL_tradeoffs`, `TOOL_metricsDashboard`, `TOOL_previewImpact`, `TOOL_resultsPage` (not helpful → very helpful), `TOOLS_thoughtful`, `TOOLS_clear` (yes/no), `TOOLS_open` | 1-7 | everyone |
| `cvr` | `CVR_helped`, `CVR_reconsider`, `CVR_useful`, `CVR_confidence` (much lower → much higher), `CVR_clear`, `CVR_confusing`, `CVR_changed` (yes/no), `CVR_open`; `CVR_dual_helpful`, `CVR_dual_changed` if the second view was generated | 1-7 / yes-no | only those who met a reflection |
| `apa` | `APA_clarify`, `APA_tradeoff`, `APA_prioritization`, `APA_better`, `APA_clear`, `APA_toolong`, `APA_confidence_helpful` (yes/no), `APA_open` | 1-7 / yes-no | only those who opened APA |
| `wellbeing` | 24 items in 8 subscales: learning insight (LI1-4), decision satisfaction (DS1, DS2, DS4), decision regret (DR1-4, stored raw as `decisionRegret`, higher = more regret, and inverted as `lowDecisionRegret`), value congruence (VC1-2), decision confidence (DC1-2), cognitive burden (CB1-3, raw `cognitiveBurden` and inverted `lowCognitiveBurden`), perceived support / autonomy (SA1-3), overall well-being (OW1-3); `wellbeingComposite` = the mean of seven subscales (satisfaction, low regret, value congruence, confidence, low burden, support, overall), `wellbeingPlusInsight` adds learning insight; five open questions (`openEnded.OE_values`, `OE_change`, `OE_affect`, `OE_regret`, `OE_additional`) | 1-7 | everyone |

Closed items read `….<CODE>.answer`; well-being reads `….wellbeing.items.<CODE>` (raw) and
`….wellbeing.subscales.<name>`. Yes/no answers are stored as the words `"yes"` and `"no"`.

**The fact:** every participant saw their VCI, Stability and Performance, with their level words, and the charts of
their journey, on the results page just before the feedback. So a link between satisfaction and VCI can be (a)
people who follow their values feel better, or (b) people who were TOLD they were "Highly Consistent" feel better.
The data cannot fully separate them. Three things make the reading honest:

1. **Test the link with behavior that was never shown as a score:** `points_short_of_what_they_asked_for` (never on
   screen as a number), the frozen-profile fit, the MPF accuracy, switching and time. If satisfaction follows these
   as it follows VCI, the link is not only the label.
2. **Check whether the label's cut-offs matter:** people just above and just below a level boundary (for example VCI
   79 against 80, "Moderate" against "Mostly Consistent") differ by one point of VCI but by a whole label. A jump in
   satisfaction at the boundary is the label talking (a regression-discontinuity style check; needs a large N).
3. **Say it in the limitations,** and consider (a researcher's decision, a screen change) asking the satisfaction,
   regret, congruence and confidence items BEFORE the results page in future runs.

### 6.2 The researcher's hypotheses about well-being

*"Users who were highly satisfied or had high well-being have better VCI and Stability, whereas people who get high
performance show low satisfaction or well-being."*

The right test, and the trap it avoids:

- **The trap:** VCI and performance trade off by design (section 5.2). A positive VCI-satisfaction correlation will
  show up as a negative performance-satisfaction correlation even if performance itself does nothing. Two simple
  correlations cannot tell which one is real.
- **The test:** one regression with both, `wellbeingComposite ~ consistency_score + performance_captured +
  stability_score (measured) + stability_was_measured + age + gender + total_active_minutes`, standardized
  coefficients with bootstrap CIs; the same for `decisionSatisfaction`, `lowDecisionRegret`, `valueCongruence`,
  `overallWellbeing` (Holm or FDR across the family). Each coefficient is the link of one score **holding the others
  fixed**. Add `consistency_score × performance_captured` to ask whether those who get both feel best.
- **Satisfaction is not the opposite of regret** (the "cake" design of the battery): look at them apart. **Figure
  17:** satisfaction (x) against regret (y), one dot per person, quadrants marked; the "satisfied and regretful"
  corner is a finding the old scale could not record. Then: do people in that corner have a larger wish-decision gap
  (`responsibility_gap`, `wished_for_the_same_option` = false) or more switches? That links regret to the choices.
- **Figure 18:** the trade-off map of Figure 14 with each dot colored by `wellbeingComposite` (a sequential,
  colorblind-safe scale). Where on the values-performance map do people feel best?

### 6.3 Self-report against behavior (convergent validity, one table)

| Self-report | Behavior it should follow | Expected |
|---|---|---|
| `valueCongruence` (VC1-2) | `consistency_score`; the frozen-profile fit | positive |
| `decisionConfidence` (DC1-2), `CVR_confidence` | `telemetry.timeToFirstSelectionMs`, `numberOfSwitches` (fewer), `cvrEndorsement` `strong` | positive / negative |
| `cognitiveBurden` (raw CB1-3) | `total_active_minutes`, switches, reflections, `cvrDwellMs` + `apaDwellMs` | positive |
| `learningInsight` (LI1-4) | the size of the value change; APA use; reflections met | positive |
| `perceivedSupport` (SA1-3; SA2 "free to choose ... rather than being pushed") | share of first cards chosen (`choiceMatchedPlannerTop`); MPF reactivity | negative with being led |
| `CVR_changed` (yes/no) | any `cvr.changed_their_choice` | agreement (kappa) |
| `TOOL_previewImpact`, `TOOL_metricsDashboard` | `telemetry.previewImpactOpens`, use of the performance panel | positive among users |
| `decisionRegret` (DR1-4), `OE_regret` | a wish different from the decision; choices changed after reflection | positive |

**Figure 19:** these correlations as a dot plot with CIs, ordered by size, the expected sign marked. A battery whose
self-reports line up with behavior is a validated battery, and the paper can say so.

### 6.4 The feedback scales themselves

- Reliability per subscale (omega or alpha; for the two-item subscales, the Spearman-Brown coefficient) — reported
  before any correlation that uses them.
- Straight-lining (`quality.straightlined_feedback`) and the reverse-worded items (DR3; the reverse items are listed
  in `wellbeing.scoring.reverseScored`) as attention evidence.
- The conditional sections (`cvr`, `apa`) exist only for people who met the step, so their means describe those
  people, not the sample.

### 6.5 The open answers

Qualitative content analysis of `CVR_open`, `APA_open`, `TOOLS_open` and the five `OE_*` answers: a codebook written
before reading (or built on a 20% subsample and then frozen), two coders (or one coder and a checked AI pass) with
Cohen's kappa, theme frequencies. Link themes to scores (for example: do people who describe learning something
about their values have larger value changes?). **Figure S19:** theme frequencies as a bar chart with two short
quotes per theme. Word clouds are not evidence; do not use them.

---

## 7. One participant at a time: what is legitimate

- **Case studies, chosen by a stated rule** (for example the participant nearest the median on VCI, Stability and
  performance; the one with the largest matched-pair difference; one "self-serving reversal"). **Figure 20:** a
  one-page "journey" for each: the four values before and after every scenario (`major_info_and_scores.profile_by_scenario`,
  `policySnapshotAfter`), the card chosen and its position, the reflection path, the MCF readings, the wish against
  the decision, the scenario-6 prediction against the choice, and their feedback in their own words. It makes the
  mechanics concrete for a reader; it proves nothing alone.
- **Which kind of chooser is each person most like?** Using the pretend kinds as templates: the likelihood of the
  person's (VCI, Stability, performance) under each kind's simulated distribution gives a probability of membership.
  At group level, "about X in 100 real participants look most like value-followers, Y like random choosers" is a
  strong, readable result; for one person it is a soft description, never a label on them.
- **Never:** "participant 12 is inconsistent". One person's score is too rough (rule 7).

---

## 8. The figure catalog

**The main figures** (a paper usually carries 6-8; pick from these):

| # | Figure | Shows | Built from |
|---|---|---|---|
| 1 | The study at a glance: Blocks 1-4 → seven sensitivities → five scenarios (with each chair) → CVR / APA / MCF → the scores | the design, the contributions and the data flow in one picture | a schematic |
| 2 | Real participants against the pretend kinds, for VCI, Stability (measured) and performance | the measures discriminate, and where real people sit | table P + docs/MAJOR_SCORES_DISTRIBUTION.md |
| 3 | The matched pair: paired slopes of departure share (a), the four-value wish shift with CIs (b) | RQ1's cleanest answer | `authority_vs_receiving`, `decided_versus_wished` |
| 7 | The reflection Sankey | what happens after a misaligned choice | `cvrOutcome`, `changed_their_choice`, APA |
| 8 | Fit over the four decisions on two rulers | the person changing against the model learning | `alignmentLevel`, frozen fit |
| 10 | The MPF reliability diagram with the chance lines | the model's predictive honesty | `mpf_predictions_every_scenario` |
| 13 | The profile predicts the choices: four coefficients | the seven-sensitivity profile is valid | the conditional logit |
| 14 / 18 | The values-performance trade-off map, dots colored by well-being | what the study is about, and how people feel about their place on it | table P |

**Supplementary:** the flow diagram (S1), engagement rainclouds (S2), the robustness forest plot (S3), the five chairs
(5) and the pairs heat map (S5), position against performance per chair (6), the equivalence plot (9), the MPF
separation histogram (S7), the #1-value alluvial (11), the sensitivity violins (12), the correlation map (15), the
choice-model odds ratios (16), satisfaction against regret (17), the self-report/behavior dot plot (19), the open
themes (S19), case-study journeys (20), the company stance (4), the scenario-6 order-effect and reactivity charts.

**Design rules for every figure:**

1. Show the data, not only the mean: dots, rainclouds or violins with the summary on top.
2. Every estimate with its 95% CI (90% on the equivalence plot); every panel with its n.
3. Draw the reference: chance, 50, the pretend kinds, the ±8 stance band, the ±5 equivalence band.
4. One color per value everywhere in the paper (vulnerable, harm, gain, helped) and one per chair; a colorblind-safe
   palette (for example Okabe-Ito); never red for "low" (a low Stability is a reordering, not a failure).
5. Scenarios in the order shown (`order_shown`), labelled by their chair and short title.
6. Axis titles are questions or plain words ("How far the choice sat from their values, as a share of the room the
   menu allowed"), not field names; the field names go in the caption or the supplement.
7. No 3-D, no pie charts, no dual y-axes; small multiples instead of crowded panels.

---

## 9. The statistical toolkit

| Kind of data | Examples | Use |
|---|---|---|
| Bounded 0-100, often skewed | VCI, performance captured, departure share | medians and IQRs; Wilcoxon / Mann-Whitney; Spearman; bootstrap CIs; for models, fractional or beta regression (score / 100) |
| Ordinal, few values | Stability (13 values), VCI levels, labels apart | ordinal (cumulative-link) models; Spearman; stacked bars |
| Repeated per scenario | table S rows | mixed-effects models with a random intercept per participant; scenario as a fixed effect |
| A choice among options | table O | conditional logit; mixed logit |
| Yes / no | changed after reflection, MPF hit | Wilson CIs; mixed logistic models; kappa for agreement |
| An equivalence claim | reflection's cost to performance | TOST with the ±5 margin |
| A null result that matters | "the wish equals the decision" | a Bayes factor beside the p-value, so absence of evidence is not read as evidence of absence |
| Likert scales | the feedback subscales | means with CIs for composites; ordinal models for single items; omega for reliability |

**Effect sizes to report:** rank-biserial r or Cliff's delta (nonparametric), Cohen's dz (paired), odds ratios,
Spearman rho, skill scores (MPF), all with CIs.

**How many participants are needed** (two-sided α = 0.05, power 0.80; standard values):

| To detect | Needs about |
|---|---|
| a correlation of 0.3 (moderate) | 84 participants |
| a correlation of 0.2 (small) | 194 |
| a paired difference of dz = 0.5 (matched pair, moderate) | 34 |
| a paired difference of dz = 0.3 | 90 |
| a stable structural equation model | 150-200 |

For the MPF and the choice model, estimate power by simulation: `tools/validate_prediction.cjs` already simulates
choosers; run it at the planned sample size.

---

## 10. How to show the strength of the experiment (Table 5 of the paper)

| Kind of evidence | What this study has | Where to cite |
|---|---|---|
| Content validity of the options | three blind AI raters scored every option from its words alone; numbers that all three read 20+ points differently were moved to their average, the rest kept with stated reasons | `Generated Outputs/rater_study/REPORT.md`, `round2/REPORT_MEASURES.md`; CLAUDE.md (Fix 6, 7, 7b) |
| Construct validity (known groups) | twelve pretend kinds of chooser through the real code; the measures separate them (VCI: value-followers above random choosers 92 times in 100) | docs/MAJOR_SCORES_DISTRIBUTION.md |
| Robustness to design constants | every value step at half and double size: every conclusion held | docs/BLOCK5_STEP_SIZE_SENSITIVITY.md |
| Convergent validity | self-report against behavior | section 6.3 (with the real data) |
| Predictive validity | the profile predicts the choices; the MPF against chance and against a model that never learns | sections 4.3, 3.4 |
| A design-held comparison | the scenario 4/5 matched pair | section 3.1 |
| An honest prediction test | scenario 6's prediction fixed before it was shown; order shuffled and stored | section 3.4 |
| Correctness of the software | 63 database gates, the scoring suites, self-checks stored in each record (the card order rebuilt from its inputs; the MPF recomputed within 0.1 points) | CLAUDE.md, "Every check"; `order_rebuilt_from_these_inputs_matches_the_order_stored`, `self_check.passed` |
| Reproducibility | every rule versioned in the record; the analysis script kept; simulated records to test it | rule 3; section 1 |
| No tuning after the fact | the freeze note, dated before the data | docs/PREREGISTRATION_FREEZE.md |

**How to write it:** the AI raters are "an AI-assisted blind content review adjudicated by the researcher", not
human inter-rater reliability (they may share blind spots). The pretend participants are simulations, and their
figures are benchmarks, not findings.

---

## 11. Hypotheses to fix before the data (they go into the freeze note)

**Primary** (Holm-corrected as one family):

- **H1 (position, matched pair).** Departure from the pre-Block-5 values differs between deciding for colleagues
  (scenario 4) and having the same decision done to oneself (scenario 5): `authority_vs_receiving.difference` ≠ 0.
  Two-sided; Wilcoxon signed-rank; rank-biserial r.
- **H2 (reflection redirects).** Among reflected decisions whose choice changed, the final choice fits the person's
  values better than the first choice on the same profile (`points_short` lower). One-sided; paired Wilcoxon.
- **H3 (no performance cost, the prior paper).** Within reflected decisions, performance captured of the final
  choice is equivalent to that of the first choice within ±5 points. TOST.
- **H4 (the MPF predicts).** Pooled over the four decisions, the MPF names the first choice more often than 16.7%,
  and its log loss beats the uniform predictor (skill > 0). One-sided; cluster bootstrap.

**Secondary** (FDR across the family):

- **H5 (value-followers).** Real VCI is above 50 and above the random chooser's 57.
- **H6 (the profile predicts choices).** In the conditional logit, the value terms of 4.3 are positive, beyond card
  position and performance.
- **H7 (learning helps the MPF).** The moving predictor beats the frozen one (`using_profile_before_block5`).
- **H8 (well-being, the researcher's hypotheses).** Holding the other scores fixed, `wellbeingComposite` and
  `decisionSatisfaction` rise with `consistency_score` and with `stability_score` (measured participants), and fall
  with `performance_captured` (section 6.2). With the stated caveat that the scores had been shown (6.1).
- **H9 (convergent validity).** `valueCongruence` correlates positively with `consistency_score`.

**Exploratory** (reported as such): the wish shift per value; the company stance; the five chairs; MCF reading and
choice; the lens and stakeholder checks; the feedback links of 6.3; the case studies; the chooser types.

---

## 12. Order of work

1. Write and date the freeze note (`docs/PREREGISTRATION_FREEZE.md`), with the hypotheses of section 11.
2. Build the tables of section 1 and every figure on simulated records (`--dump`), before real data.
3. When the data is in: the flow diagram, the exclusion table, the version table (section 2).
4. The primary hypotheses, exactly as frozen; then the secondary; then the exploratory, labelled.
5. The robustness forest plot for every primary result (section 2.4).
6. The measurement evidence (section 4) and the correlation map with its mechanical links (section 5).
7. The feedback analyses, with the results-page caveat in the same paragraph as each finding (section 6).
8. Regenerate `docs/MAJOR_SCORES_DISTRIBUTION.md` from the final code, so the benchmarks match the data.
9. Write the limitations from HOW_TO_ANALYZE 8 and rules 11-12 of this file.

---

## How this plan was checked

- **Every field name** was taken from the code that writes it (`src/experiment/dbShape.ts`, `block5Types.ts`,
  `feedbackTypes.ts`) or from HOW_TO_READ_MY_DATABASE.md, and checked by a script against those files after writing.
- **Found while checking:** the database document carries no version of the study code (rule 3); the two guides
  said it did and were corrected the same day.
- **Design facts** were checked in the code: the results page comes before the feedback (`ExperimentFlow.tsx`), and
  shows VCI, Stability and Performance with their labels (`Block5SimulationSummaryPage.tsx`); the pages between
  blocks are hidden (docs/MEASUREMENT_MODEL.md 10b); yes/no answers are stored as `"yes"` / `"no"`; the well-being
  battery has 24 items in 8 subscales and its composite averages 7 of them.
- **Traps looked for:** derived against raw, scores built from each other (5.2), selection (reflection, MCF readers,
  conditional feedback sections), position confounded with content, per-person unreliability, versions, many tests,
  the score display before the feedback, and the missing no-reflection control.
