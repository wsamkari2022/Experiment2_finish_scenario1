# The analysis code, run on simulated participants (SIMULATED: not data)

The registration (OSF page 6) promises: "the analysis code is written and run on simulated participants before the data are opened." This is that run. The pretend participants were made by the study's own code (tools/simulate_records.cjs), so their records have exactly the shape of real ones. **No number here is a finding.**

Seed 20261117; the whole run took 28.1 minutes.

## Summary

| Check | What it proves | Result |
|---|---|---|
| S1 the shape | every table is built, no needed field is missing, all four conditions present | PASS |
| S2 self-checks | every number the analysis recomputes equals what the study saved | PASS |
| S3 no effect | with nothing planted, each test claims support in at most about 5 in 100 studies | PASS |
| S4 planted effects | planted effects are found, and the estimates land near the planted sizes | see section 4 |
| S5 the A4 model | the hand-written model recovers a planted odds ratio and agrees with R's lme4 | PASS |
| S6 repeatable | two runs on the same input give identical results | PASS |
| S7 privacy | a file with a Prolific ID or an email is refused; the real-data runner stops before the freeze | PASS |
| S8 two programs | Python and R agree on every number they both compute (42 numbers) | PASS |

## 1. The pretend records

The study's own data check on them: "Data check sim107: 107 Prolific records - complete 107, something missing 0, not finished 0."

Rows built: P 107, S 642, O 2568, V 795.

Self-checks (S2):

- Records read: 107; included: 107.
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

## 2. Each check broken on purpose once (it must catch it)

| Break | Caught |
|---|---|
| S2: one saved label changed | yes |
| S2: one saved departure changed | yes |
| S2: one saved prediction chance changed | yes |
| S7: a 24-character Prolific ID in the file | yes |
| S7: an email address in the file | yes |
| S7: the real-data runner before the freeze | yes |
| S8: one Python p-value moved slightly | yes |

## 3. S3: 2000 simulated studies with no effect

Each study: 107 people drawn from a pool of 1,004 pretend people (27 / 27 / 26 / 27). For each test the data were made to hold no effect in the way that fits the test (condition labels shuffled for A1-A4; each participant's difference given a random sign for the paired tests; choices made at random for C1 and C2; values shuffled for the correlations; D1 with the true difference exactly at the +/-5 margin). A fair one-sided test claims support in about 5 of 100 such studies; the upper limit allowed for chance in 2000 studies is 6.5%.

| Test | Studies where it ran | False claims (raw alpha .05) | Within the limit |
|---|---|---|---|
| A1 | 2000 | 4.8% | yes |
| A2 | 2000 | 5.2% | yes |
| A3 | 2000 | 4.9% | yes |
| A4 | 2000 | 5.1% | yes |
| B1 | 2000 | 4.1% | yes |
| B2 | 2000 | 4.0% | yes |
| B3 | 2000 | 5.2% | yes |
| B4 | 2000 | 4.7% | yes |
| B5 | 2000 | 4.5% | yes |
| B6 | 2000 | 4.2% | yes |
| B7 | 2000 | 3.3% | yes |
| C1 | 2000 | 4.7% | yes |
| C2 | 2000 | 0.0% | yes |
| C3 | 2000 | 5.6% | yes |
| C4 | 2000 | 4.8% | yes |
| C5 | 0 | - | yes |
| C6 | 2000 | 5.5% | yes |
| C7 | 2000 | 5.1% | yes |
| D1 | 2000 | 0.1% | yes |
| D2 | 2000 | 4.9% | yes |
| D3 | 2000 | 4.8% | yes |
| D4 | 2000 | 3.2% | yes |
| D5 | 2000 | 4.8% | yes |

With Holm's correction (any false claim in the group):

| Group | False claims | Within the limit |
|---|---|---|
| primary | 3.4% | yes |
| family A | 4.3% | yes |
| family B | 3.5% | yes |
| family C | 3.8% | yes |
| family D | 4.5% | yes |

C5 ran (20 or more people who changed after seeing the prediction) in 0 of 2000 studies; otherwise it is described, as registered. Because C5 is an exact binomial test, its false-claim rate is known exactly for every group size from 20 to 107: at most 5.0% (at 43 people), never above 5%.

## 4. S4: planted effects

| Test | Planted | Found in | Mean estimate (planted size) |
|---|---|---|---|
| A1 | VCI 10 points higher in CVR+APA | 74.4% | 9.976 (10.0) |
| B1 | departure 8 points higher in scenario 5 | 70.6% | 7.860 (8.0) |
| C1 | hit rate 40% in scenario 6 | 95.8% (an exact calculation expects 95.1%) | 0.400 (0.4) |
| D1 | true mean difference 0 (equivalent) | 1.6% | -0.049 (0.0) |
| D4 | standardized beta 0.3 for VCI | 38.4% | 0.303 (0.3) |

## 5. S5: the A4 model

300 studies with a planted log odds ratio of 0.693 (odds ratio 2) and a random-intercept SD of 1.0: mean estimate 0.730 (SD 0.499); the 95% interval held the planted value in 96.0% of studies (about 95% expected); the registered fallback was needed in 19.

The same data through R's lme4 (glmer, 25 quadrature points):

- Python 0.706203 (SE 0.607799); R 0.706210 (SE 0.607799): agree
- Python 0.736476 (SE 0.406422); R 0.736472 (SE 0.406421): agree
- Python 0.551236 (SE 0.400180); R 0.551221 (SE 0.400179): agree
- Python 1.682554 (SE 0.568787); R 1.682551 (SE 0.568788): agree
- Python 0.760192 (SE 0.480295); R 0.760193 (SE 0.480293): agree

With no person-to-person variation at all, the model is singular and the fallback ran: yes.

## 6. Two programs (S8)

42 of 42 numbers agree.

## 7. Privacy (S7)

- The raw file (with the pretend Prolific IDs) was refused: yes.
- Output files naming an ID: none.
- The real-data runner refuses now, because: the freeze tag analysis-v1 does not exist yet (the code has not been frozen).
