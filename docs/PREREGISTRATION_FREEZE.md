# Pre-registration freeze note — VRDS Experiment 2

**Status: DRAFT, written 27 September 2026** at the researcher's request ("Q2-Yes": write the note that fixes the
numbers before any real data). It records every constant, rule and analysis choice **as the code stands at the commit
that adds this file**. Fix 1 (what participants see while choosing) is still to come, by the researcher's decision
the very last change before launch. **At launch:** re-check every value below against the launch commit, fill in the
two lines at the end, and do not change this file afterwards except by an appended, dated "Deviations" entry.

**Why it exists.** Every number here was chosen by the researcher or derived from simulation, not estimated from the
data. Freezing them, dated, before the data is opened is what answers the question "were these tuned after you saw
the results?". The analysis plan is in `docs/ANALYSIS_AND_FIGURES_PLAN.md`; section 11 there is the source of the
hypotheses below.

---

## 1. The study code and content

| Item | Value | Where it is defined |
|---|---|---|
| Blocks 1-4 scoring (the seven sensitivities) | `null-cdf-2026-09-24-recipe-donation-share` | `SENSITIVITY_CALIBRATION_VERSION`, sensitivityCalibration.ts; saved as `analysis.participant_record.calibrationVersion` |
| Card order (planner) | `2026-09-24-a` | `PLANNER_VERSION`, block5Planner.ts; saved per scenario |
| Prediction rule (MPF) | `2026-09-19-e` | `PREDICTION_VERSION`, block5Prediction.ts; saved as `rule_version` |
| Moral Commitment Function | `2026-09-23-a` | `MCF_VERSION`, block5MCF.ts; saved as `analysis.mcf.rule_version` |
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
  straight-lined, fewer than 3 blocks under 30 seconds) and is never used as an analysis rule.

## 5. The hypotheses and their tests

Two-sided α = 0.05 unless stated. 95% confidence intervals by bootstrap over participants (10,000 resamples).
Effect sizes with every test.

**Primary family** (Holm correction across H1-H4):

| | Hypothesis | Field | Test |
|---|---|---|---|
| H1 | Departure from one's pre-Block-5 values differs between deciding for colleagues (scenario 4) and the same decision done to oneself (scenario 5) | `analysis.position_effect.authority_vs_receiving.difference` | Wilcoxon signed-rank against 0; rank-biserial r |
| H2 | Among reflected decisions whose choice changed, the final choice fits better than the first choice, on the same profile | `points_short_of_what_they_asked_for_every_option` for `cvr.choice_before_reflection` against the final choice | one-sided paired Wilcoxon |
| H3 | Reflection costs no performance: within reflected decisions, the final choice's performance captured is within ±5 points of the first choice's | `performanceCaptured` of the two options | paired TOST, margin ±5, α = 0.05 each side (90% CI) |
| H4 | The MPF names the first choice more often than chance (16.7%) over the four decisions, and beats the uniform predictor on log loss | `analysis.mpf_predictions_every_scenario.by_scenario[].participant.mpf_named_their_first_choice`, `mpf_chance_of_their_first_choice_percent` | one-sided, cluster bootstrap by participant |

**Secondary family** (Benjamini-Hochberg, FDR 5%, across H5-H11):

| | Hypothesis | Test |
|---|---|---|
| H5 | Real VCI is above 50 (blind picking) and above 57 (a random chooser who also answers the reflection at random) | one-sample Wilcoxon, one-sided |
| H6 | The Blocks 1-4 value terms predict the Block 5 choices beyond card position and performance | conditional logit; likelihood-ratio test of the value terms |
| H7 | The learning predictor beats the frozen one (`using_profile_before_block5`) | paired difference in log loss and hit rate |
| H8 | Holding the other scores fixed, `wellbeingComposite` and `decisionSatisfaction` rise with `consistency_score` and with `stability_score` (measured participants), and fall with `performance_captured` | linear regression with standardized coefficients, controls age, gender, active minutes |
| H9 | Self-reported value congruence (`subscales.valueCongruence`) rises with `consistency_score` | Spearman, one-sided |
| H10 | **Context with money carries over to lives.** People whose Block 1 answers change more between the three places also change more between the chairs of Block 5. Block 1 place spread = the highest minus the lowest rung over the three places (rung = `thresholdAmountIndex` 0-7 when `accepted`, 8 when `thresholdBeyondRange`; range 0-8). Block 5: `analysis.position_effect.overall_effect` (the widest gap in `departure_share` between any two chairs). Added 27 September 2026 | Spearman ρ, one-sided (positive), **and** the partial Spearman controlling for `consistency_score` must also be positive; H10 is supported only if both are. Why the second: answering at random in both blocks makes both spreads large (a random chooser also reaches a high `overall_effect`, audit P2) and gives a low VCI, so controlling for VCI keeps randomness from producing the result. Also reported without `said_yes_at_the_first_step_everywhere` and `answered_very_fast` |
| H11 | **Reconsidering is a trait.** People who changed their Block 4 decision after hearing the voices (`decisions.finalDecision` ≠ `decisions.initialDecision`) change their choice after the reflection in Block 5 more often (`analysis.alignment_records.by_scenario[].cvr.changed_their_choice` on the decisions where `cvrFired` is true). Added 27 September 2026 | mixed logistic regression on the reflected decisions, `changed_their_choice` ~ Block 4 changed + (1 | participant), one-sided on the coefficient; a simple check beside it: Mann-Whitney on each person's share of reflected decisions changed. Only participants with at least one reflected decision. The measurement model estimates that about 15 in 100 change their Block 4 decision (docs/MEASUREMENT_MODEL.md 5), so the group is likely small: report the odds ratio and its CI whatever the p-value |

**Exploratory** (labelled as such, FDR within each family): everything else in the analysis plan, including the wish
shift per value, the company stance, the five chairs, MCF reading and choice, the lens and stakeholder checks, the
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
