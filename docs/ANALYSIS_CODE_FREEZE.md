# The analysis code freeze (Experiment 2)

**Frozen on:** 17 November 2026, code commit `559765a` (the tag points to the commit that adds this file, which changes no code), Git tag **`analysis-v1`**, before any analysis read the real data.
**Registered promise kept (OSF https://osf.io/jvxcz/, page 6):** "the analysis code is written and run on simulated
participants before the data are opened."
**Who decided:** Waseem Samkari approved the plan (PLAN_Analysis_code.md: "approve, D2-A, D3-A", 17 November 2026) and the
freeze ("about the code please freeze", 17 November 2026).

This file does not change the registration or the freeze note (docs/PREREGISTRATION_FREEZE.md). It records which code
runs the registered analysis, the checks it passed on simulated participants, and the few details the registration leaves
to the software, each fixed here before the data are opened.

Before this freeze the collected records were read only by two tools that never show a study score: the data check
(`tools/data_check.cjs`: whether each saved part is present) and the daily pay check (`tools/pay_check.cjs`: time, pay and
Prolific's rules), as the registration's plan for data collection describes. The coded copies (`participants_ai_safe.json`)
were made by `tools/ai_safe_copy.cjs`, which prints counts only, and no analysis read them before this freeze.

## 1. What is frozen

Everything in `analysis/` (the programs, `option_numbers_deploy-v9.json`, `requirements.txt`, `requirements-lock.txt`,
`R-packages.txt`) except the outputs of the simulated run in `analysis/simulation/`, and the two tools that feed it:
`tools/simulate_records.cjs` and `tools/export_option_numbers.cjs`. `analysis/run_on_real.py` refuses to open the real data
unless every one of these files is exactly the tagged version, and refuses any file holding a Prolific ID or an email.

| Program | What it does |
|---|---|
| `build_tables.py` | the analysis tables (participants, scenario choices, options, value moves) and 16 self-checks |
| `stats_tools.py` | the statistical pieces (rank tests, bootstrap, TOST, the A4 mixed model, the conditional logit) |
| `registered_tests.py` | fidelity and exposure, the three positive controls, the 23 tests, Holm, robustness |
| `pipeline.py`, `report.py`, `figures.py` | the one path from a coded file to RESULTS.md, a LaTeX table and the figures |
| `crosscheck.R` | the same tests again in R (lme4, survival, sandwich, lmtest); every shared number is compared |
| `check_on_simulated.py`, `simulation_report.py` | the run on simulated participants (S1-S8 and the breaks) |
| `run_on_real.py` | the only way the real coded data are analysed |

Tools: Python 3.14.6 with the packages in `requirements-lock.txt` (scipy 1.18.1, pandas 3.1.1, statsmodels 0.15.0,
matplotlib 3.11.2); R 4.0.4 with lme4 1.1-29, survival 3.2-7, sandwich 3.0-1, lmtest 0.9-40, jsonlite 1.8.0. Bootstrap:
10,000 resamples, percentile intervals, master seed 20261117 (each test's resamples seeded by the master seed and the
test's name).

## 2. The run on simulated participants

The registered promise was kept on 17 November 2026 by `analysis/check_on_simulated.py` (seed 20261117). The pretend
participants were made by the study's own code (`tools/simulate_records.cjs`), and the study's own data check calls all of
them complete. All of the following results are SIMULATED, and none is a finding.

| Check | Result |
|---|---|
| S1 the shape: every table built, no needed field missing, all four conditions present (107 people, 27 / 27 / 26 / 27) | passed |
| S2 the 16 self-checks: every recomputed number equals what the study saved | passed |
| S3 no effect, 2,000 simulated studies of 107: false claims per test at most 5.6% (C3; the limit allowed for chance is 6.5%); with Holm, at most 4.5% in any family and 3.4% among the four primary hypotheses; C5 (an exact test) at most 5.0% for every group size from 20 to 107 | passed |
| S4 planted effects, 500 studies: the estimates land on the planted sizes (A1 9.98 for 10 points; B1 7.86 for 8; C1 .400 for .40; D1 -0.05 for 0; D4 .303 for .30) | passed |
| S5 the A4 model, 300 studies with an odds ratio of 2: mean log odds ratio 0.730 (planted 0.693), 95% intervals held the planted value in 96%; the same data through R's lme4 agree to 5 decimals; the registered fallback runs when the model is singular | passed |
| S6 two runs on the same input give identical results | passed |
| S7 a file holding a Prolific ID or an email is refused; the real-data runner stops before this freeze; no output names anything but the codes | passed |
| S8 Python and R agree on all 42 numbers both compute | passed |
| Each check broken on purpose once (7 breaks) | all 7 caught |

The full report: `analysis/simulation/SIMULATION_REPORT.md`.

## 3. Details the registration leaves to the software, fixed before the data are opened

None of these changes a registered test, measure, sample or decision rule; each is the standard reading, stated so a
reader can repeat the analysis exactly.

| # | Where | What is done |
|---|---|---|
| 1 | Derived scores | VCI, performance captured, departure share, fit and the MPF chances are recomputed exactly with the registered formulas (OSF Variables page, Indices 2, 4, 6, 7, 10) from the stored profiles and the launch option numbers. The study stored them rounded; on every run, 16 self-checks compare the exact values with the stored ones for every participant and report any difference on the first page of the results. The sums are made in the same order as the study's code, so ties and exact halves fall the same way |
| 2 | Mann-Whitney U (A1-A3, C4) | normal approximation with continuity correction (VCI has many ties, so no exact test exists); rank-biserial r and Cohen's d |
| 3 | Wilcoxon signed-rank (B1-B5, D2, D3, the controls) | zero differences dropped, as in the standard test (B6 keeps them by Pratt's method, as registered); exact when fewer than 50 differences, none zero and no ties, otherwise the normal approximation with the tie-corrected variance and no continuity correction (R's own default rule); matched-pairs rank-biserial r and Cohen's d_z |
| 4 | Bootstrap p-values (C2, C6) | one-sided: (1 + the resamples on the wrong side of the null value) / (1 + 10,000); resampling whole participants |
| 5 | C7 | "one-sided likelihood-ratio test with the coefficient in the predicted direction": half the 1-df likelihood-ratio p when the fit coefficient is positive; the conditional likelihood with one chosen option per stratum (R: clogit, "breslow", which is exact here) |
| 6 | A4 | maximum likelihood with adaptive Gauss-Hermite quadrature (25 points), Wald test on the help-step coefficient; "singular" means a random-intercept SD below 0.0001 (lme4's own limit); then the registered fallback, logistic regression with participant-clustered errors (with the usual small-sample factor, as R's sandwich::vcovCL type "HC1") |
| 7 | D4 | p from the t distribution with the residual degrees of freedom (as R's lmtest::coeftest with HC3); Stability z-scored within condition (0 for a condition where every Stability is equal); the reference categories cannot change VCI's coefficient |
| 8 | D2 | "help step" as A4 defines it: the decisions of CVR+APA, CVR only and APA only (Baseline's confirmation page is not a help step; D1 names it separately) |
| 9 | C1, C5 | Clopper-Pearson intervals are the two-sided 95% intervals |
| 10 | Positive controls | the rung at which the answer turned (never = one past the last rung: 8 in Blocks 1-2, 6 in Block 3); Block 3 compares each participant's mean over the three group sizes |
| 11 | Robustness: "the same answer to every feedback rating (at least 8 ratings)" | counted from the participant's own 1-7 ratings (tool ratings, the 24 statements, the reflection and clarification ratings), as `analysis.feedback_answer_patterns` counts them. The stored flag `quality.straightlined_feedback` is built differently (it also counts the study's computed averages) and is not used for this check |
| 12 | Robustness: the other three | `analysis.blocks_1_to_4_checks.answered_very_fast`; two or more of the six scenarios under 15 seconds (`timeMs`); any of the four attention checks answered against its instruction (`analysis.attention_checks.checks[].correct`) |
| 13 | First pick | `firstChoiceOptionId` (scenario 6: the rule chosen before the prediction); its label is its place in the scenario's saved ranking (`rankedOptionIds`), the same rule that gives the stored label of the final choice for every row |
| 14 | The condition's page after a first pick against the values (D1) | read from the page's own counters on the row (`telemetry.cvrVisits`, `apaVisits`, `baselineConfirmVisits`) |
| 15 | B7 on the menu-adjusted departure (robustness) | the position spread is the largest minus the smallest menu-adjusted departure over Scenarios 1-5 |
| 16 | Figures | the intervals drawn are 95% percentile bootstrap intervals (10,000 resamples) or exact intervals for proportions; a fitted line in a scatter plot is for orientation only; each figure is drawn from the same tables as its test |

## 4. The order from here

1. `run_on_real.py` on `Prolific docs/analysis/2026-11-17_budget107/participants_ai_safe.json` (the first analysis, 107
   participants; the dated deviation of 17 November 2026 in the freeze note). Waseem reads the results first.
2. The same frozen code on all 113 who completed (the registered sample), reported beside the first.
3. The exploratory analyses and the rest of the figure catalog, labelled exploratory, in a later plan.

## 5. After the freeze (dated notes; no frozen file changed)

**17 November 2026, the first run on the coded data (107 participants).** `run_on_real.py` ran the frozen code. All 16
self-checks agreed for every participant; 38 of the 42 shared numbers agreed between Python and R at once. The other four
were D4's two HC3 standard errors and their p-values, which R returned as "not a number": one participant is the only
member of the gender category "other or prefer not to say", so that person's leverage is 1 and residual 0, and their HC3
term is 0/0. That term is multiplied by exactly 0 in the variance of VCI's coefficient (the person's own gender term fits
them), so the registered HC3 error of VCI is well defined; R propagates the "not a number" through the multiplication.
A one-off R check outside the frozen code (`d4_hc3_r_check.R`, kept with the results), with that single term set to 0,
gives the same coefficients, standard errors and p-values as Python to 10 decimals. With it, all 42 numbers agree.
