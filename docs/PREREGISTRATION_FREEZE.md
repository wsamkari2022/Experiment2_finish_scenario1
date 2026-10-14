# Pre-registration freeze note — VRDS Experiment 2

**Status: DRAFT, written 27 September 2026** at the researcher's request ("Q2-Yes": write the note that fixes the
numbers before any real data). It records every constant, rule and analysis choice **as the code stands at the commit
that adds this file**. Fix 1 (what participants see while choosing) is still to come, by the researcher's decision
the very last change before launch. **At launch:** re-check every value below against the launch commit, fill in the
two lines at the end, and do not change this file afterwards except by an appended, dated "Deviations" entry.

**Since 14 October 2026 the MAIN hypotheses are the 23 in section 5.1 (A1-D5)**, still awaiting the advisor's
approval. The earlier hypotheses of 27 September 2026 (H1-H13) are kept in section 5.2 for possible future use.
Sections 1-4 and 6 were written on 27 September 2026 and have not yet been brought up to date for the four
conditions (to be done once the advisor has approved the hypotheses).

**Why it exists.** Every number here was chosen by the researcher or derived from simulation, not estimated from the
data. Freezing them, dated, before the data is opened is what answers the question "were these tuned after you saw
the results?". The analysis plan is in `docs/ANALYSIS_AND_FIGURES_PLAN.md`; its section 11 holds the same two sets
of hypotheses as section 5 below (the main 23, and the earlier set kept for possible future use).

---

## 1. The study code and content

| Item | Value | Where it is defined |
|---|---|---|
| Blocks 1-4 scoring (the seven sensitivities) | `null-cdf-2026-09-24-recipe-donation-share` | `SENSITIVITY_CALIBRATION_VERSION`, sensitivityCalibration.ts; saved as `analysis.participant_record.calibrationVersion` |
| Card order (planner) | `2026-09-24-a` | `PLANNER_VERSION`, block5Planner.ts; saved per scenario |
| Prediction rule (MPF) | `2026-09-19-e` | `PREDICTION_VERSION`, block5Prediction.ts; saved as `rule_version` |
| Moral Commitment Function | `2026-09-23-a` | `MCF_VERSION`, block5MCF.ts; saved as `analysis.mcf.rule_version` |
| Running values and VCI_all | `2026-09-28-a` | `RUNNING_VERSION`, block5VciAll.ts; saved on every running fit and as `analysis.vci_all.rule_version` |
| Stability_all and the top-value choices | `2026-09-29-a` | `STABILITY_ALL_VERSION`, block5StabilityAll.ts; saved as `analysis.stability_all.rule_version` and `analysis.top_value_choices.rule_version` |
| Fit score scale | `share-of-what-they-asked-for-2026-09-24` | `FIT_SCORE_SCALE`, block5CVR.ts; saved as `fitScoreScale` per row |
| Feedback questions | schema 4 | `FEEDBACK_SCHEMA_VERSION`, feedbackTypes.ts; saved as `blocks.feedback_answers.schemaVersion` |
| Option numbers and words | as of the launch commit (after Fix 7, 7b, 7c) | block5Scenarios.ts. **At launch, save the export** `node tools/export_block5_content.cjs` beside this file, so the exact content is frozen with it |

The code does not change after deployment (the researcher's decision, 27 September 2026: the deployed version is
the final one), so every real record comes from the launch commit. The database document carries no stamp of the
code version itself, so the launch commit and date below are what tie the records to this code.

## 2. How Block 5 moves the values (the step sizes)

Every scenario runs at stakes weight 1. `w` below is the weight of one step.

| When | Step | Notes |
|---|---|---|
| The participant picks their best fit | nothing moves | the keep rule, revised 24 September 2026 |
| They pick their second-best fit | +20 to the value where it beats the best fit most, −15 where the best fit beats it most | `applyKeepUpdates` |
| They keep a misaligned option after the reflection, firmly | +30 to the value it serves most, −20 to the value it gives up most | `applyEndorsementUpdates` |
| The same, less firmly | +15 / −10 | the same |
| They name a value on the APA page | +30 × w to the named value, −10 × w to each of the other three; w = the confidence weight 0.6, 0.7, 0.8, 0.9, 1.0 for confidence 1-5 | `applyApaUpdates`, `confidenceWeight`. A cap of 30 × w on any value's net move exists and never binds under this rule |
| After every reflection | stakeholder sensitivity +25 if the other person's story guided them, −25 if not (never scaled by confidence) | both paths |
| When a reflection view is answered | directness or context ±20 (× w on the APA path) | both paths |

Scores stay between 0 and 100; a step past an edge is cut off and recorded. Tested at half and double size
(`docs/BLOCK5_STEP_SIZE_SENSITIVITY.md`): every conclusion held; Stability's absolute level did not.

## 3. How the scores are computed

| Score | Rule | Levels / cut-offs |
|---|---|---|
| **VCI** (`consistency_score`) | the mean over the four decisions of the chosen option's label weight: Aligned 1.00, Weakly aligned 0.80, Misaligned 0.50, Strongly misaligned 0.10 (six options), judged on the profile the scenario opened with, × 100 | Highly Consistent 90+, Mostly Consistent 80-89, Moderate 65-79, Low 50-64, Very Low 30-49, Highly Inconsistent below 30 |
| **Stability** (`stability_score`) | 100 × (1 − min(1, swaps / 6)), swaps counted among the four policy values at conflict steps only (a decision where the reflection ran), a tie opening or closing counts half | Held steady 100, Mostly steady 83-99, Shifted a little 50-82, Shifted a lot 17-49, Changed substantially 0-16. `stability_was_measured` false = no conflict step |
| **Performance** (`performance_captured`) | per decision 100 × (chosen − worst option) / (best − worst), on the mean of the five metrics; averaged over the four decisions | 0 = the weakest option every time, 100 = the strongest |
| **Fit** | 100 × (1 − shortfall ÷ the most this participant could lose); labels by rank within the scenario | the raw `points_short_of_what_they_asked_for` compares across people |
| **Position** | `departure_share` against the frozen pre-Block-5 profile; the matched pair `authority_vs_receiving.difference` | company stance: `pull_toward_the_company` above +8 adopted, below −8 resisted, between compromised |
| **MPF** | a softmax over the options' fit; confidence = the mean of VCI/100 and Stability/100; temperature = 60 − 42 × confidence (60 flat to 18 sharp) | strength by the top-two separation: 15 or more "clear", 5-14 "slight", under 5 "none" (`predictionStrength`) |
| **Well-being** | subscale = the mean of its items, reverse items as 8 − x; `wellbeingComposite` = the mean of seven subscales (satisfaction, low regret, value congruence, confidence, low burden, support, overall) | 1-7 |

## 4. The sample (decided by the researcher, 27 September 2026)

- **Who is analysed:** everyone who completed the study (`status: "Study Completed"`) by the end of data collection.
  **Everyone who did not complete is excluded.** No one who completed is removed for any other reason.
- **Extra checks, shown beside each main result** (they remove nobody from the main analysis; each shows the same
  result again without one group, so a reader can see it does not depend on them; the analysis plan, section 2.4):
  without `said_yes_at_the_first_step_everywhere`; without `answered_very_fast` (median under 2 seconds between
  answers, `FAST_ANSWER_SECONDS`); without `top_value_was_decided_by_a_coin`; without a top-two gap within
  **5 points** (`how_close_the_top_two_values_were.gap_in_points` ≤ 5); without any value `notMeasured`; without any
  `moves_cut_off`; without more than one browser or a restore; for Block 5, without 2 or more scenarios under 15
  seconds (`quality.scenarios_under_15_seconds` ≥ 2); for the feedback, without `quality.straightlined_feedback`; for
  the matched pair, without `decided_versus_wished.wish_was_hurried` (under 12 seconds); for the MPF calibration,
  without predictions whose top-two separation is under 5 ("none").
- **Stability** is analysed among `stability_was_measured` = true; the share never measured is reported.
- Payment is decided separately by `quality.compensation_eligible` (completed, 35 active minutes or more, not
  straight-lined, fewer than 3 blocks under 30 seconds, and since 29 September 2026 all three attention checks right)
  and is never used as an analysis rule.
- **The attention checks do not remove anybody from the analysis** (the researcher, 30 September 2026: "all completed
  sessions will be included in the analysis"). A missed check affects the gift card only
  (`quality.passed_all_attention_checks`). Any further analysis rule is the researcher's to decide after the experiment.

## 5. The hypotheses and their tests

### 5.1 The main hypotheses: 23 in four families (since 14 October 2026)

**Status: draft 2, awaiting Dr. Eskridge's approval.** Word for word the same as the IRB application's Hypothesis box, `VRDS2_Hypotheses_Draft.docx` (project folder; it adds each hypothesis's power, the reason it is attainable and the limit to state) and the OSF preregistration answers (`OSF_PREREGISTRATION_ANSWERS.md`). Change them in all four places together, or in none.

The study tests 23 hypotheses in four families. Each family has one primary hypothesis; the four primary hypotheses are Holm-corrected together, and the secondary hypotheses are Holm-corrected within their family. Directional hypotheses are tested one-sided; all others two-sided, α = .05.

**Primary** (Holm-corrected together):

| | Hypothesis | Measure (database field) | Test |
|---|---|---|---|
| A1 (conditions) | Participants in the full CVR+APA condition will have a higher Value Consistency Index (VCI: how well their four decisions fit their own values) than participants in the Baseline condition. | VCI (headline.consistency_score), one score per participant. | one-sided Mann-Whitney U. |
| B1 (position) | How far a choice departs from the participant's own values will differ between deciding the care-visit cuts inside an employer's rules (scenario 4) and receiving the same cuts decided by someone else (scenario 5); the two scenarios are identical except for the participant's position. Measure: departure share (0 = the option closest to the values they brought into the main study, 100 = the farthest). | Departure share in scenario 5 minus scenario 4 (analysis.position_effect.authority_vs_receiving; by_scenario[].departure_share). Both are measured from the same values (those brought into the main study). | two-sided Wilcoxon signed-rank. |
| C1 (prediction) | The Moral Prediction Function's top pick will match the rule each participant chooses behind the veil of ignorance (scenario 6, before seeing the prediction) more often than chance (25%). | analysis.scenario6_mpf_test.participant.mpf_guessed_right; the chance level in mpf_prediction.chance_if_guessing_percent. | one-sided exact binomial. |
| D1 (performance) | In decisions where the first pick went against the participant's values and a reflection, clarification or confirmation step followed, the performance of the final choice will be equivalent to that of the first choice, within ±5 points on a 0-100 scale. | performanceCaptured of the first pick and of the final choice, per decision where the step ran (scenarios 1-4). | paired two one-sided tests (TOST). |

**Family A, the conditions (measure: VCI unless stated)** (Holm-corrected within the family):

| | Hypothesis | Measure (database field) | Test |
|---|---|---|---|
| A2 | VCI is higher in CVR+APA than in APA only: the reflection step adds to the clarification step. | VCI. | one-sided Mann-Whitney U. |
| A3 | VCI is higher in CVR+APA than in CVR only: the clarification step adds to the reflection step. | VCI. | one-sided Mann-Whitney U. |
| A4 | Among decisions whose first pick goes against the participant's values (Misaligned or Strongly misaligned), the final choice fits their values (Aligned or Weakly aligned) more often in the three conditions with a help step than in Baseline. | Per decision in scenarios 1-4: the first pick's fit and the final choice's fit (analysis.alignment_records.by_scenario[]: cvr.changed_their_choice, the fit of every option). | mixed logistic regression at the decision level, participant as a random effect. |

**Family B, position (measure: departure share; every contrast is also tested on the menu-adjusted departure, which removes differences between the scenarios' menus)** (Holm-corrected within the family):

| | Hypothesis | Measure (database field) | Test |
|---|---|---|---|
| B2 | Departure is larger when the participant's own safety is at stake (scenarios 1 and 2) than when only other people bear the cost (scenario 3). | Departure share; menu-adjusted departure as the robustness check. | one-sided Wilcoxon signed-rank. |
| B3 | Departure is larger when deciding for one's household (scenario 2) than when deciding alone (scenario 1). | Departure share; menu-adjusted departure. | one-sided Wilcoxon signed-rank. |
| B4 | Departure is larger when deciding inside an employer's rules (scenario 4) than when deciding freely for other people (scenario 3). | Departure share; menu-adjusted departure. | one-sided Wilcoxon signed-rank. |
| B5 | Departure is smaller behind the veil of ignorance (scenario 6, the rule chosen before seeing the prediction) than when the participant's own safety is at stake (scenarios 1 and 2). | Scenario 6: departure share of the first rule, on its own four-rule menu (computed with the same distance rule from analysis.scenario6_mpf_test.participant.rule_chosen_before_seeing_the_guess); scenarios 1 and 2: departure share. | one-sided Wilcoxon signed-rank. |
| B6 | The wish on the receiving end (scenario 5) fits the participant's values better than their own decision in scenario 4, both judged on the same values. | analysis.position_effect.decided_versus_wished.responsibility_gap (fit of the wish minus fit of the decision, both on the values scenario 4 opened with). | one-sided Wilcoxon signed-rank. |
| B7 | Participants whose found-money answers change more between the three places also change more between the positions of the main study. | Block 1 place spread (the highest minus the lowest acceptance rung over the three places); Block 5 position spread (analysis.position_effect.overall_effect). | one-sided Spearman correlation, supported only if the partial correlation controlling for VCI is also positive. |

**Family C, prediction** (Holm-corrected within the family):

| | Hypothesis | Measure (database field) | Test |
|---|---|---|---|
| C2 | Over the four decisions, the MPF's top pick matches the participant's first choice more often than chance (16.7%), and its probabilities beat a uniform guess on log loss. | analysis.mpf_predictions_every_scenario.by_scenario[].participant (mpf_named_their_first_choice, mpf_chance_of_their_first_choice_percent). | one-sided, bootstrap over participants. |
| C3 | The MPF's confidence tracks its accuracy: the higher the probability it gives its own top rule in scenario 6, the more likely the participant chose that rule. | Probability of the MPF's top rule (mpf_prediction.by_rule for most_expected_rule) and mpf_guessed_right. | logistic regression, one-sided on the slope. |
| C4 | Participants rate the prediction as sounding more like them (1-7) when the MPF named the rule they chose than when it did not. | does_this_sound_like_me_1_to_7, by mpf_guessed_right. | one-sided Mann-Whitney U. |
| C5 | Participants who change their rule after seeing the prediction move to the MPF's top rule more often than chance (one in three of the other rules). | rule_chosen_before_seeing_the_guess, rule_chosen_in_the_end, changed_after_seeing_the_guess, most_expected_rule; wavering separates real reactivity from earlier doubt. | one-sided exact binomial, only if at least 20 participants change; otherwise reported as description. |
| C6 | Predictions made from the value profile as it is updated during the study beat predictions made from the profile measured before the study's main part. | mpf_predictions_every_scenario: the main columns against using_profile_before_block5. | paired difference in log loss and hit rate, bootstrap over participants, one-sided. |
| C7 | The values measured in the first four blocks predict the choices in the four decisions beyond each option's position on the screen and its performance. | Per decision and option: the option's fit to the values brought into the main study (points_short_of_what_they_asked_for_every_option), its place in the card order, and its performance. | conditional logit regression, likelihood-ratio test of the value terms. |

**Family D, reflection and experience** (Holm-corrected within the family):

| | Hypothesis | Measure (database field) | Test |
|---|---|---|---|
| D2 | When a choice changes after a help step, the final choice fits the participant's values better than the first choice, on the same values. | points_short_of_what_they_asked_for_every_option for the first and the final choice (analysis.alignment_records). | one-sided paired Wilcoxon signed-rank on the shortfall. |
| D3 | VCI is above the level a random chooser reaches in the participant's own condition (57, 60, 63 and 60 in CVR+APA, CVR only, APA only and Baseline). | VCI minus the random line of the participant's condition. | one-sided one-sample Wilcoxon. |
| D4 | Holding Stability and performance fixed, the well-being composite and decision satisfaction rise with VCI (controls: age, gender, active minutes, condition, group). | wellbeingComposite and decisionSatisfaction; predictors VCI, Stability, performance; controls age, gender, active minutes, condition, group. | linear regression, one-sided on VCI. |
| D5 | Self-reported value congruence rises with VCI. | subscales.valueCongruence and VCI. | one-sided Spearman correlation. |

**Analysis rules.** The sample is every participant who completes the study; people who do not complete are excluded, and no one who completes is removed for any other reason. Prolific participants and students are analysed together, with the group as a covariate, and every primary result is also reported for the Prolific participants alone. Every test is reported with an effect size and a 95% bootstrap confidence interval. All other analyses are labelled exploratory. All hypotheses, measures, tests and the sample plan are preregistered on OSF Registries before data collection begins.

### 5.2 The earlier hypotheses (27 September 2026), kept for possible future use

**These are not the main hypotheses.** They were frozen on 27 September 2026, before the four conditions existed, and
are kept unchanged below in case the researcher wants any of them later; what happens to them is his decision after
the advisor's review. Where each one went in the main set:

| Earlier hypothesis | In the main set |
|---|---|
| H1 (scenario 4 against 5) | B1 (primary) |
| H2 (the fit after reflection) | D2 |
| H3 (no performance cost) | D1 (primary) |
| H4 (MPF on the four decisions) | C2 |
| H5 (VCI above chance) | D3, with the lines of the four conditions |
| H6 (value terms predict choices beyond card position) | C7 |
| H7 (learning predictor) | C6 |
| H8 (experience) | D4 |
| H9 (value congruence) | D5 |
| H10 (context sensitivity) | B7 |
| H11 (reconsidering is a trait) | Exploratory: only about 15 in 100 people are expected to change their Block 4 decision, too few for a test |
| H12 (truer when not one's decision) | B6 |
| H13 (the veil against the positions) | B5, now directional (against the self-stake positions) |

A1-A4 (the four conditions), B2, B3, B4, C1, C3, C4 and C5 are new; they have no earlier counterpart.

The earlier set, as written on 27 September 2026:

Two-sided α = 0.05 unless stated. 95% confidence intervals by bootstrap over participants (10,000 resamples).
Effect sizes with every test.

**Primary family** (Holm correction across H1-H4):

| | Hypothesis | Field | Test |
|---|---|---|---|
| H1 | Departure from one's pre-Block-5 values differs between deciding for colleagues (scenario 4) and the same decision done to oneself (scenario 5) | `analysis.position_effect.authority_vs_receiving.difference` | Wilcoxon signed-rank against 0; rank-biserial r |
| H2 | Among reflected decisions whose choice changed, the final choice fits better than the first choice, on the same profile | `points_short_of_what_they_asked_for_every_option` for `cvr.choice_before_reflection` against the final choice | one-sided paired Wilcoxon |
| H3 | Reflection costs no performance: within reflected decisions, the final choice's performance captured is within ±5 points of the first choice's | `performanceCaptured` of the two options | paired TOST, margin ±5, α = 0.05 each side (90% CI) |
| H4 | The MPF names the first choice more often than chance (16.7%) over the four decisions, and beats the uniform predictor on log loss | `analysis.mpf_predictions_every_scenario.by_scenario[].participant.mpf_named_their_first_choice`, `mpf_chance_of_their_first_choice_percent` | one-sided, cluster bootstrap by participant |

**Secondary family** (Benjamini-Hochberg, FDR 5%, across H5-H13):

| | Hypothesis | Test |
|---|---|---|
| H5 | Real VCI is above 50 (blind picking) and above 57 (a random chooser who also answers the reflection at random) | one-sample Wilcoxon, one-sided |
| H6 | The Blocks 1-4 value terms predict the Block 5 choices beyond card position and performance | conditional logit; likelihood-ratio test of the value terms |
| H7 | The learning predictor beats the frozen one (`using_profile_before_block5`) | paired difference in log loss and hit rate |
| H8 | Holding the other scores fixed, `wellbeingComposite` and `decisionSatisfaction` rise with `consistency_score` and with `stability_score` (measured participants), and fall with `performance_captured` | linear regression with standardized coefficients, controls age, gender, active minutes |
| H9 | Self-reported value congruence (`subscales.valueCongruence`) rises with `consistency_score` | Spearman, one-sided |
| H10 | **Context with money carries over to lives.** People whose Block 1 answers change more between the three places also change more between the chairs of Block 5. Block 1 place spread = the highest minus the lowest rung over the three places (rung = `thresholdAmountIndex` 0-7 when `accepted`, 8 when `thresholdBeyondRange`; range 0-8). Block 5: `analysis.position_effect.overall_effect` (the widest gap in `departure_share` between any two chairs). Added 27 September 2026 | Spearman ρ, one-sided (positive), **and** the partial Spearman controlling for `consistency_score` must also be positive; H10 is supported only if both are. Why the second: answering at random in both blocks makes both spreads large (a random chooser also reaches a high `overall_effect`, audit P2) and gives a low VCI, so controlling for VCI keeps randomness from producing the result. Also reported without `said_yes_at_the_first_step_everywhere` and `answered_very_fast` |
| H11 | **Reconsidering is a trait.** People who changed their Block 4 decision after hearing the voices (`decisions.finalDecision` ≠ `decisions.initialDecision`) change their choice after the reflection in Block 5 more often (`analysis.alignment_records.by_scenario[].cvr.changed_their_choice` on the decisions where `cvrFired` is true). Added 27 September 2026 | mixed logistic regression on the reflected decisions, `changed_their_choice` ~ Block 4 changed + (1 \| participant), one-sided on the coefficient; a simple check beside it: Mann-Whitney on each person's share of reflected decisions changed. Only participants with at least one reflected decision. The measurement model estimates that about 15 in 100 change their Block 4 decision (docs/MEASUREMENT_MODEL.md 5), so the group is likely small: report the odds ratio and its CI whatever the p-value |
| H12 | **Truer to one's values when the decision is not theirs.** VCI wished (scenario 5) is higher than VCI acted (scenario 4): `analysis.position_effect.decided_versus_wished.responsibility_gap` (wished − acted) > 0. Both are judged on the values the participant opened scenario 4 with. Added 27 September 2026 | Wilcoxon signed-rank on the gap with the zeros kept (Pratt), one-sided; the sign test beside it |
| H13 | **Not knowing one's position.** The departure from one's own values behind the veil (scenario 6) differs from the mean departure over the five positions. Measure: the veil's departure share = 100 × (distance of the rule chosen BEFORE seeing the guess − the nearest of the four rules) ÷ (the farthest − the nearest), every distance from the frozen pre-Block-5 profile by the study's own position arithmetic (`profileDistance` and the menu range in block5Position.ts, the four rules' numbers from `tools/export_block5_content.cjs`). The first rule is `analysis.scenario6_mpf_test.participant.rule_chosen_before_seeing_the_guess`; the stored `analysis.scenario6_mpf_test.distance_from_profile_before_block5` is for the FINAL rule, the same number unless the person changed after the guess. Compared with the participant's mean `analysis.position_effect.by_scenario[].departure_share`. Added 27 September 2026 | Paired Wilcoxon signed-rank, two-sided. The veil stays out of the Position Effect itself; both shares are scaled to their own menu (four rules; six actions) |

**Exploratory** (labelled as such, FDR within each family): everything else in the analysis plan, including the wish
shift per value, the company stance, the five chairs, MCF reading and choice, VCI_all (described only, no hypothesis:
the researcher's decision, 28 September 2026), the lens and stakeholder checks, the
feedback-behavior links, the known-effect replications of Blocks 1-3, the chooser types and the case studies.

## 6. What is known in advance and stated, not tested

- Position is confounded with scenario content in the five-scenario reading; only the 4/5 pair holds content constant.
- There is no no-reflection control group; reflection results are within-person descriptions.
- The MPF's sharpness uses the participant's end-of-block VCI and Stability, including a never-tested Stability of
  100 (audit R6, kept and stated by the researcher on 27 September 2026); top-pick accuracy is free of it.
- One person's scores are rough; results are reported for groups.
- The option numbers are authored and were checked by a blind AI content review, not by human raters.

## 7. To fill in at launch

- Launch commit: `__________`   Launch date: `__________`
- End of data collection (the deadline that defines the sample): `__________`

## Deviations

*(none yet; any change after launch is appended here with its date and reason)*
