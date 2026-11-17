# Results of the registered analysis (SIMULATED)

**SIMULATED: not data.** Every number below comes from pretend participants made by tools/simulate_records.cjs.

## 1. The sample and the self-checks

Records read: 107; included (status "Study Completed", no test session): 107. Per condition: CVR+APA 27, CVR_Only 27, APA_Only 26, Baseline 27.

Every derived number was recomputed with the registered formulas and compared with what the study saved:

- OK   final label from the saved ranking = saved label: 642 of 642 agree.
- OK   saved ranking = ranking recomputed from the opening profile: 642 of 642 agree.
- OK   final shortfall recomputed = saved (2 decimals): 642 of 642 agree.
- OK   performance captured recomputed = saved (rounded): 642 of 642 agree.
- OK   departure recomputed = saved (rounded): 535 of 535 agree.
- OK   first choice = mpf_prediction_percentages' first choice: 535 of 535 agree.
- OK   prediction temperature recomputed = saved: 642 of 642 agree.
- OK   prediction chances recomputed = saved (1 decimal): 642 of 642 agree.
- OK   prediction top pick recomputed = saved: 642 of 642 agree.
- OK   VCI recomputed = saved (rounded): 107 of 107 agree.
- OK   wish gap recomputed = saved: 107 of 107 agree.
- OK   the wish was scored on scenario 4's opening values: 107 of 107 agree.
- OK   position spread recomputed = saved (within 1 point: the saved one is made of rounded parts): 107 of 107 agree.
- OK   scenario 6: the saved test agrees with the row (first rule, top rule, hit): 107 of 107 agree.
- OK   straightlining from the raw ratings = feedback_answer_patterns: 107 of 107 agree.
- OK   scenarios under 15 s recounted = saved: 107 of 107 agree.

## 2. Manipulation (fidelity) checks and exposure

Pages seen outside their own condition: **0**.

| Condition | n | Met their condition's page at least once |
|---|---|---|
| CVR+APA | 27 | reflection 22 (81%); clarification 16 (59%) |
| CVR Only | 27 | reflection 27 (100%); rejection 20 (74%) |
| APA Only | 26 | clarification 21 (81%) |
| Baseline | 27 | confirm misfit 26 (96%); confirm good 27 (100%) |

## 3. Positive controls (Blocks 1-3)

| Control | n | Mean difference (rungs) | Statistic | Effect size [95% CI] | p |
|---|---|---|---|---|---|
| more lives required before pushing than before pulling | 107 | 0.63 | T+ = 1518 | r_rb = .61 [.34, .85] | < .001 |
| money kept less readily outside the shelter | 107 | 1.17 | T+ = 2718 | r_rb = .76 [.57, .94] | < .001 |
| a higher gain before harming entry-level workers | 107 | 0.45 | T+ = 3020 | r_rb = .65 [.46, .82] | < .001 |

## 4. The 23 hypotheses

**SIMULATED: not data.** Every number below comes from pretend participants made by tools/simulate_records.cjs.

| H | Test | n | Statistic | Effect size [95% CI] | p | Holm p | Supported |
|---|---|---|---|---|---|---|---|
| A1 | Mann-Whitney U | 27+27 | U = 431 | r_rb = .18 [-.13, .49] | .126 | .378 | no |
| A2 | Mann-Whitney U | 27+26 | U = 330 | r_rb = -.06 [-.37, .25] | .650 | .650 | no |
| A3 | Mann-Whitney U | 27+27 | U = 492 | r_rb = .35 [.04, .63] | .014 | .042 | yes |
| A4 | Mixed logistic regression | 176 (96) | z = 1.90 | OR = 2.02 [0.98, 4.17] | .029 | .058 | no |
| B1 | Wilcoxon signed-rank (two-sided) | 107 | T+ = 940 | r_rb = -.15 [-.43, .13] | .292 | .440 | no |
| B2 | Wilcoxon signed-rank | 107 | T+ = 2725 | r_rb = .08 [-.15, .30] | .246 | > .999 | no |
| B3 | Wilcoxon signed-rank | 107 | T+ = 2054 | r_rb = .05 [-.19, .28] | .345 | > .999 | no |
| B4 | Wilcoxon signed-rank | 107 | T+ = 3078 | r_rb = .44 [.22, .64] | < .001 | < .001 | yes |
| B5 | Wilcoxon signed-rank | 107 | T+ = 1470 | r_rb = -.34 [-.54, -.11] | .998 | > .999 | no |
| B6 | Wilcoxon signed-rank (Pratt) | 107 | T+ = 1839 | r_rb = -.26 [-.53, .00] | .973 | > .999 | no |
| B7 | Spearman and partial Spearman | 107 | rho = .10; partial = .01 | rho = .10 [-.09, .28] | .451 | > .999 | no |
| C1 | Exact binomial | 107 | 62/107 | rate = .58 [.48, .67] | < .001 | < .001 | yes |
| C2 | Bootstrap (hit rate, log loss) | 107 | hit = .36; log loss = 1.53 | hit = .36 [.32, .40] | < .001 | < .001 | yes |
| C3 | Logistic regression | 107 | z = 2.27 | OR(10 pts) = 1.29 [1.04, 1.62] | .012 | .012 | yes |
| C4 | Mann-Whitney U | 62+45 | U = 2063 | r_rb = .48 [.28, .66] | < .001 | < .001 | yes |
| C5 | Exact binomial | 7 | n = 7 (not run) | - | - | - | not run |
| C6 | Bootstrap (log loss) | 107 | diff = -0.061 | diff = -0.061 [-0.101, -0.024] | < .001 | .002 | yes |
| C7 | Conditional logit (LR test) | 428 sets | chi2(1) = 58.28 | OR(10 pts) = 1.46 [1.32, 1.62] | < .001 | < .001 | yes |
| D1 | TOST (+/-5 points) | 96 | t(95) = 0.78, -1.71 | M = -1.88 [-8.56, 4.79] (90%) | .220 | .440 | no |
| D2 | Wilcoxon signed-rank | 57 | T+ = 1292 | r_rb = .88 [.71, 1.00] | < .001 | < .001 | yes |
| D3 | One-sample Wilcoxon | 107 | T+ = 5236 | r_rb = .88 [.78, .96] | < .001 | < .001 | yes |
| D4 | Two OLS regressions (HC3) | 107 | t = 3.25; 2.86 | beta = .55 [.21, .89]; .51 [.16, .86] | .003 | .003 | yes |
| D5 | Spearman | 107 | rho = .34 | rho = .34 [.15, .50] | < .001 | < .001 | yes |

*Note.* SIMULATED: not data. One-sided tests in the predicted direction, except B1 (two-sided) and D1 (equivalence within +/-5 points by two one-sided tests; its interval is 90%). Holm correction: A1, B1, C1 and D1 together; the secondary hypotheses within their family (C5 leaves family C when fewer than 20 participants qualify). B7, C2 and D4 require both of their tests and use the larger p. Intervals are 95% percentile bootstrap intervals over participants (10,000 resamples), exact Clopper-Pearson intervals for single proportions, and Wald intervals for odds ratios and regression coefficients (C7: participant-clustered). r_rb = rank-biserial correlation; OR = odds ratio; OR(10 pts) = odds ratio per 10 points; rho = Spearman's correlation; beta = standardized coefficient (well-being; decision satisfaction). A4: decisions (participants).

What each hypothesis claims (the registered words are in the OSF registration):

- **A1**: VCI higher in CVR+APA than in Baseline
- **A2**: VCI higher in CVR+APA than in APA_Only
- **A3**: VCI higher in CVR+APA than in CVR_Only
- **A4**: after a first pick that went against their values, the final choice fits more often with a help step
- **B1**: departure differs between receiving (5) and deciding under an employer (4)
- **B2**: larger when their own safety is at stake (1, 2) than for others only (3)
- **B3**: larger deciding for the household (2) than alone (1)
- **B4**: larger under an employer's rules (4) than deciding freely for others (3)
- **B5**: smaller behind the veil (6, the rule chosen before the prediction) than in 1 and 2
- **B6**: the wish fits their values better than their own decision in scenario 4
- **B7**: a larger Block 1 place spread goes with a larger position spread, also with VCI held fixed
- **C1**: the MPF's top pick matches the rule chosen before the prediction more often than 25%
- **C2**: over the four decisions the MPF's top pick matches the first choice more than 1/6, and beats a uniform guess on log loss
- **C3**: the higher the probability the MPF gives its top rule, the more likely the participant chose it
- **C4**: 'sounds like me' is rated higher when the MPF named the chosen rule
- **C5**: those who change after seeing the prediction move to the MPF's top rule more than 1 in 3
- **C6**: predictions from the updated profile beat predictions from the profile before the scenarios (log loss)
- **C7**: the values from Blocks 1-4 predict the first choice beyond card position and performance
- **D1**: after a first pick against their values and the condition's page, performance stays within +/-5 points (equivalence)
- **D2**: when a choice changes after a help step, the final choice fits better than the first (shortfall)
- **D3**: VCI is above the random-chooser level of the participant's own condition (57, 60, 63, 60)
- **D4**: with Stability and performance held fixed, well-being and satisfaction rise with VCI
- **D5**: self-reported value congruence rises with VCI

Missing-data rule (a participant lacking a value a test needs leaves that test only): no participant was left out of any test.

A4: the mixed model was singular or did not converge, so the registered fallback (logistic regression with participant-clustered robust errors) was used.

## 5. Robustness (shown beside each result, never replacing it)

| H | Main p | without fast blocks | without fast scenarios | without straightliners | without attention wrong | family B menu adjusted |
|---|---|---|---|---|---|---|
| A1 | .126 | .140 | .091 | .126 | .385 |  |
| A2 | .650 | .647 | .669 | .650 | .831 |  |
| A3 | .014 | .018 | .010 | .014 | .108 |  |
| A4 | .029 | .027 | .021 | .029 | .057 |  |
| B1 | .292 | .347 | .388 | .292 | .337 | .292 |
| B2 | .246 | .282 | .325 | .246 | .406 | .241 |
| B3 | .345 | .465 | .541 | .345 | .609 | .201 |
| B4 | < .001 | < .001 | < .001 | < .001 | .002 | < .001 |
| B5 | .998 | .997 | .998 | .998 | .977 | .899 |
| B6 | .973 | .978 | .966 | .973 | .936 |  |
| B7 | .451 | .472 | .333 | .451 | .154 | .698 |
| C1 | < .001 | < .001 | < .001 | < .001 | < .001 |  |
| C2 | < .001 | < .001 | < .001 | < .001 | < .001 |  |
| C3 | .012 | .015 | .010 | .012 | .070 |  |
| C4 | < .001 | < .001 | < .001 | < .001 | < .001 |  |
| C5 | - | - | - | - | - |  |
| C6 | < .001 | < .001 | .001 | < .001 | .005 |  |
| C7 | < .001 | < .001 | < .001 | < .001 | < .001 |  |
| D1 | .220 | .223 | .261 | .220 | .203 |  |
| D2 | < .001 | < .001 | < .001 | < .001 | < .001 |  |
| D3 | < .001 | < .001 | < .001 | < .001 | < .001 |  |
| D4 | .003 | .004 | .005 | .003 | .012 |  |
| D5 | < .001 | < .001 | .001 | < .001 | < .001 |  |

Participants left out in each check: without fast blocks 2, without fast scenarios 7, without straightliners 0, without attention wrong 26.

## 6. Two programs (Python and R)

42 of 42 numbers agree within their stated tolerance.
