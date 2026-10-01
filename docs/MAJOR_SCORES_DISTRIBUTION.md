# Major scores by kind of participant

> **Generated** by `npm run report:major-scores` on 2026-10-01, from code version `b341859` plus changes not yet committed.
> Do not edit this page by hand: change `tools/report_major_scores.cjs` and run it again. **Run it after every change**
> to an option number, a scoring rule, a step size, the planner or a scenario, and commit the new page with the change.

## How to read this page

These are **pretend participants, not real people**. 2,000 random starting profiles (every value equally likely
between 0 and 100) each go through the six scenarios twelve times, once as each kind of chooser below, using the
study's real scoring code. The same 2,000 profiles and the same random draws are used for every kind, so the kinds
can be compared fairly. The numbers are the same on every run, until the code changes.

| Kind | What this pretend participant does |
|---|---|
| Always aligned | always takes their best-fit option |
| Always weakly aligned | always takes their second-best fit |
| Top-two mixer | takes the best or the second-best fit, half and half |
| True to top value | always takes the option that serves their #1 value (from Blocks 1-4) most |
| Corrected by APA | picks a misaligned option, then names their current top value on the APA page and switches |
| Convert (keeps) | changes their mind once, in scenario 1 (a misaligned pick, kept), then stays true to the new value |
| Convert (via APA) | the same one change, made through the APA page |
| Performance chaser | ignores values: always the option with the best performance numbers |
| Random responder | everything at random: the option, the reflection route and every APA answer |
| Flip-flopper (keeps) | a new value every scenario (never their current top), keeping each choice |
| Flip-flopper (via APA) | the same flip-flopper, saying so on the APA page each time |
| Always the worst fit | always takes their worst-fit option |

| Score | What it measures | What a fair or good value looks like |
|---|---|---|
| **VCI** (0-100) | How well the four decisions fit the participant's own values | Picking blindly gives 50; always the best fit gives 100; always the worst fit 10 |
| **VCI_all** (0-100, since 28 September 2026) | The same over all six scenarios - the four decisions, the wish and the veil (its final choice) - on hidden running values that also move after the wish and the veil | Blind 50; always the best fit 100; its level edges are its own (88.89 / 77.78 / 62.5 / 47.22 / 27.78), derived the same way as VCI's |
| **Stability** (0-100) | Whether the order of the four values changed when the participant went against their best fit | 100 = the order held, or it was never tested (see "not measured") |
| **Stability_all** (0-100, since 29 September 2026) | The same rule over all six scenarios, on the running values: the wish and the veil count when the final choice was not one of the two best fits | Never above Stability; 100 = the order held, or it was never tested |
| **Performance** (0-100, end of study) | How good the chosen options were, inside each scenario | 0 = the weakest option in every decision, 100 = the strongest; random choosing gives about 50 |

"p10 / p50 / p90": 10 in 100 people score at or below the first number, half at or below the second, 90 in 100 at
or below the third. The level columns are the share of people in each named level.

## 1. VCI

| Kind | Mean | p10 | p50 | p90 | Highly Consistent | Mostly Consistent | Moderate | Low | Very Low | Highly Inconsistent |
|---|---|---|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | 100% | 0% | 0% | 0% | 0% | 0% |
| Always weakly aligned | 80 | 80 | 80 | 80 | 0% | 100% | 0% | 0% | 0% | 0% |
| Top-two mixer | 90 | 85 | 90 | 95 | 71% | 30% | 0% | 0% | 0% | 0% |
| True to top value | 85 | 70 | 88 | 95 | 37% | 39% | 20% | 3% | 1% | 0% |
| Corrected by APA | 92 | 78 | 95 | 100 | 68% | 22% | 9% | 1% | 1% | 0% |
| Convert (keeps) | 66 | 43 | 65 | 83 | 0% | 16% | 50% | 21% | 12% | 2% |
| Convert (via APA) | 67 | 45 | 68 | 83 | 1% | 20% | 47% | 21% | 10% | 0% |
| Performance chaser | 76 | 53 | 77 | 90 | 22% | 23% | 39% | 8% | 8% | 0% |
| Random responder | 57 | 33 | 55 | 78 | 2% | 6% | 27% | 33% | 29% | 4% |
| Flip-flopper (keeps) | 34 | 20 | 30 | 50 | 0% | 0% | 1% | 10% | 60% | 29% |
| Flip-flopper (via APA) | 34 | 20 | 30 | 50 | 0% | 0% | 1% | 10% | 60% | 28% |
| Always the worst fit | 10 | 10 | 10 | 10 | 0% | 0% | 0% | 0% | 0% | 100% |

## 1b. VCI_all (all six scenarios)

The same pretend people; scenario 5 is shown on scenario 4's opening values, as on the page. VCI_all contains VCI's
four decisions, so the two are never correlated; the difference says how the wish and the veil compare with deciding.
It includes the two stated scenario-5 effects (the echo, and the wishes that followed the screen but score below 100).

| Kind | Mean | p10 | p50 | p90 | VCI_all - VCI (mean) | Highly Consistent | Mostly Consistent | Moderate | Low | Very Low | Highly Inconsistent |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | +0.0 | 100% | 0% | 0% | 0% | 0% | 0% |
| Always weakly aligned | 80 | 78 | 81 | 81 | -0.2 | 0% | 95% | 5% | 0% | 0% | 0% |
| Top-two mixer | 88 | 81 | 88 | 94 | -2.2 | 49% | 46% | 5% | 0% | 0% | 0% |
| True to top value | 89 | 77 | 92 | 97 | +4.1 | 53% | 35% | 9% | 2% | 0% | 0% |
| Corrected by APA | 70 | 60 | 71 | 81 | -22.1 | 0% | 17% | 67% | 15% | 1% | 0% |
| Convert (keeps) | 76 | 62 | 77 | 88 | +10.0 | 6% | 36% | 46% | 11% | 2% | 0% |
| Convert (via APA) | 77 | 62 | 77 | 88 | +9.5 | 9% | 34% | 47% | 10% | 1% | 0% |
| Performance chaser | 76 | 55 | 80 | 90 | +0.2 | 16% | 40% | 29% | 11% | 5% | 0% |
| Random responder | 55 | 37 | 55 | 72 | -2.0 | 1% | 4% | 24% | 40% | 28% | 4% |
| Flip-flopper (keeps) | 36 | 22 | 35 | 51 | +1.9 | 0% | 0% | 1% | 14% | 58% | 26% |
| Flip-flopper (via APA) | 36 | 22 | 36 | 51 | +2.1 | 0% | 0% | 1% | 14% | 58% | 27% |
| Always the worst fit | 15 | 8 | 15 | 23 | +5.5 | 0% | 0% | 0% | 0% | 0% | 100% |

## 2. Stability

"Not measured" = the share who never went against their best fit in a decision, so no reflection ran and there
was nothing to count: their Stability is 100 by default. "Mean if measured" leaves them out. The database says
which is which (`headline.stability_was_measured`, since 26 September 2026).
For the random chooser the shares can differ by about one point from `npm run report:stability`, which draws its
random APA answers in a different order; every other kind is identical to that report, and VCI (section 1) is
identical to `npm run report:vci` for every one of the 24,000 pretend people.

| Kind | Mean | p10 | p50 | p90 | Not measured | Mean if measured | Held steady | Mostly steady | Shifted a little | Shifted a lot | Changed substantially |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | 100% | - | 100% | 0% | 0% | 0% | 0% |
| Always weakly aligned | 100 | 100 | 100 | 100 | 100% | - | 100% | 0% | 0% | 0% | 0% |
| Top-two mixer | 100 | 100 | 100 | 100 | 100% | - | 100% | 0% | 0% | 0% | 0% |
| True to top value | 91 | 67 | 100 | 100 | 38% | 85 | 63% | 23% | 12% | 2% | 0% |
| Corrected by APA | 94 | 75 | 100 | 100 | 0% | 94 | 51% | 36% | 13% | 0% | 0% |
| Convert (keeps) | 56 | 17 | 58 | 83 | 0% | 56 | 5% | 25% | 39% | 24% | 8% |
| Convert (via APA) | 74 | 50 | 75 | 100 | 1% | 74 | 19% | 26% | 54% | 1% | 0% |
| Performance chaser | 80 | 50 | 83 | 100 | 26% | 73 | 41% | 26% | 24% | 8% | 2% |
| Random responder | 57 | 8 | 67 | 100 | 2% | 57 | 11% | 20% | 39% | 19% | 10% |
| Flip-flopper (keeps) | 12 | 0 | 0 | 42 | 0% | 12 | 0% | 1% | 9% | 22% | 68% |
| Flip-flopper (via APA) | 29 | 0 | 33 | 67 | 0% | 29 | 0% | 4% | 25% | 38% | 33% |
| Always the worst fit | 10 | 0 | 0 | 33 | 0% | 10 | 0% | 0% | 5% | 28% | 67% |

## 2b. Stability_all (all six scenarios)

Stability's own rule over all six scenarios, on the hidden running values behind VCI_all (since 29 September 2026):
the four decisions count exactly as in Stability, the wish and the veil when the final choice was not one of the two
best fits. It contains Stability, so it is never higher and the two are never correlated; the difference says what
the wish and the veil added. "Not measured" = no step counted in any of the six.

| Kind | Mean | p10 | p50 | p90 | Stability_all - Stability (mean) | Not measured | Held steady | Mostly steady | Shifted a little | Shifted a lot | Changed substantially |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | +0.0 | 100% | 100% | 0% | 0% | 0% | 0% |
| Always weakly aligned | 99 | 100 | 100 | 100 | -1.3 | 95% | 95% | 3% | 2% | 0% | 0% |
| Top-two mixer | 96 | 83 | 100 | 100 | -4.0 | 87% | 88% | 4% | 6% | 1% | 0% |
| True to top value | 89 | 67 | 100 | 100 | -1.1 | 38% | 61% | 22% | 14% | 2% | 1% |
| Corrected by APA | 71 | 42 | 75 | 100 | -22.2 | 0% | 11% | 35% | 36% | 18% | 0% |
| Convert (keeps) | 54 | 17 | 58 | 83 | -1.3 | 0% | 5% | 24% | 38% | 24% | 9% |
| Convert (via APA) | 74 | 50 | 75 | 100 | -0.6 | 1% | 18% | 27% | 54% | 2% | 0% |
| Performance chaser | 69 | 8 | 83 | 100 | -10.6 | 24% | 34% | 21% | 23% | 11% | 11% |
| Random responder | 39 | 0 | 33 | 83 | -18.5 | 0% | 4% | 10% | 33% | 24% | 28% |
| Flip-flopper (keeps) | 3 | 0 | 0 | 17 | -8.2 | 0% | 0% | 0% | 2% | 9% | 89% |
| Flip-flopper (via APA) | 13 | 0 | 0 | 50 | -16.3 | 0% | 0% | 1% | 10% | 25% | 65% |
| Always the worst fit | 3 | 0 | 0 | 17 | -6.4 | 0% | 0% | 0% | 1% | 12% | 87% |

## 2c. Top-value choices (saved, never shown)

In how many of the six scenarios the final choice was the option that does most for the #1 value brought into
Block 5, and for the #1 or #2 value (since 29 September 2026; analysis.top_value_choices). Choosing blindly gives
1.08 and 2.17 of 6 on these menus (worked out for these same people). It looks at the top value(s) only, so it is not VCI.

| Kind | #1 value (mean, of 6) | #1 or #2 value (mean, of 6) | 6 of 6 on the #1 value |
|---|---|---|---|
| Always aligned | 2.7 | 3.1 | 8% |
| Always weakly aligned | 1.3 | 2.2 | 0% |
| Top-two mixer | 1.7 | 2.6 | 0% |
| True to top value | 6.0 | 6.0 | 100% |
| Corrected by APA | 3.5 | 3.8 | 0% |
| Convert (keeps) | 0.8 | 2.4 | 11% |
| Convert (via APA) | 0.8 | 2.4 | 10% |
| Performance chaser | 0.5 | 0.8 | 0% |
| Random responder | 1.2 | 2.3 | 0% |
| Flip-flopper (keeps) | 1.3 | 2.8 | 0% |
| Flip-flopper (via APA) | 1.2 | 2.7 | 0% |
| Always the worst fit | 1.1 | 2.2 | 0% |

## 3. Performance at the end of the study

The mean of the four decisions' captured scores (scenario 5, a wish, and scenario 6, a test, are not counted).
Following your own top value costs performance in this deck (true to top value against random choosers): that is
the trade-off the study is built on, not a flaw in the score (HOW_TO_ANALYZE_MY_DATA.md 4.8).

| Kind | Mean | p10 | p50 | p90 |
|---|---|---|---|---|
| Always aligned | 67 | 27 | 73 | 95 |
| Always weakly aligned | 61 | 28 | 66 | 85 |
| Top-two mixer | 64 | 30 | 67 | 91 |
| True to top value | 40 | 19 | 36 | 55 |
| Corrected by APA | 45 | 19 | 36 | 74 |
| Convert (keeps) | 47 | 19 | 52 | 71 |
| Convert (via APA) | 46 | 19 | 52 | 74 |
| Performance chaser | 100 | 100 | 100 | 100 |
| Random responder | 52 | 28 | 52 | 75 |
| Flip-flopper (keeps) | 40 | 23 | 40 | 63 |
| Flip-flopper (via APA) | 41 | 23 | 40 | 63 |
| Always the worst fit | 28 | 22 | 25 | 42 |

## 4. How well the scores tell kinds apart

How often the first kind scores higher than the second when one person of each is picked at random (ties count
half). 0.50 is a coin; 1.00 is always.

| First kind | Second kind | VCI | Stability | Performance |
|---|---|---|---|---|
| True to top value | Random responder | 0.92 | 0.84 | 0.32 |
| Random responder | Flip-flopper (keeps) | 0.86 | 0.88 | 0.68 |
| Convert (keeps) | Random responder | 0.67 | 0.48 | 0.44 |
| Convert (keeps) | Flip-flopper (keeps) | 0.94 | 0.89 | 0.61 |
| Always aligned | Random responder | 1.00 | 0.94 | 0.70 |

Read the Convert row as a known limit (audit G6): one honest change of mind scores about like random choosing on
Stability. Stability's absolute level also depends on the step sizes (docs/BLOCK5_STEP_SIZE_SENSITIVITY.md); its
comparisons between kinds do not.

## 5. Card order: how often the first card is also the best fit, and how close the top two values are

From `npm run report:planner-overlap` (pretend participants who answer Blocks 1-4, then the real planner):

```
How often the first card is also the best-fit card, out of 100 pretend participants (4000 of each kind)
  Chance would be about 17 out of 100 (1 card in 6). 100 would mean first place and best fit can never be told apart.

  STEADY pretend participants (answer like a real person)
    Six Hours to Clear the District          first card = best fit  56   first card = best on their #1 value  87   differ  44
    Eight Hours Ahead of the Fire            first card = best fit  62   first card = best on their #1 value  72   differ  38
    Limited Cancer Treatment Allocation      first card = best fit  62   first card = best on their #1 value  91   differ  38
    The Care Visits You Have to Cut          first card = best fit  50   first card = best on their #1 value  86   differ  50
    The Same Cut, Decided Without You        first card = best fit  50   first card = best on their #1 value  86   differ  50

  RANDOM pretend participants (answer everything by chance)
    Six Hours to Clear the District          first card = best fit  50   first card = best on their #1 value  78   differ  50
    Eight Hours Ahead of the Fire            first card = best fit  47   first card = best on their #1 value  90   differ  53
    Limited Cancer Treatment Allocation      first card = best fit  52   first card = best on their #1 value 100   differ  48
    The Care Visits You Have to Cut          first card = best fit  41   first card = best on their #1 value  87   differ  59
    The Same Cut, Decided Without You        first card = best fit  41   first card = best on their #1 value  87   differ  59

  Read the 'differ' column as the cases that can tell position from fit. Analyse choice position and fit
  together (HOW_TO_ANALYZE_MY_DATA.md), never one as a stand-in for the other.

  How close each pretend participant's #1 and #2 values are (whole points, the profile brought into Block 5)
  The planner counts a 1-point lead exactly like a 50-point one (audit C7).

    STEADY   same score   2   within 2 points   7   within 5  16   within 10  28   median gap 20   (out of 100)
    RANDOM   same score   2   within 2 points   7   within 5  18   within 10  31   median gap 18   (out of 100)
```

## 6. Position check

From `npm run validate:position`: for each kind of scripted participant, how much the menu alone moves the
fit number ("menu spread") against how much their choice can ("room inside a scenario"). The check wants the
ratio to be at least 3.

```
  protector   menu spread   3.7 pts   room inside a scenario  38.5 pts   ratio 10.3x
  maximiser   menu spread   5.9 pts   room inside a scenario  32.9 pts   ratio 5.6x
  middle      menu spread   3.1 pts   room inside a scenario  21.6 pts   ratio 7.0x
  lowDemand   menu spread   3.9 pts   room inside a scenario  20.9 pts   ratio 5.4x
  highDemand  menu spread   6.0 pts   room inside a scenario  37.2 pts   ratio 6.2x
  [PASS] choice moves the number several times more than the menu does  — worst ratio 5.4x (gate: >= 3x)
  ### POSITION GATES PASSED (3 skipped — see the banner above) ###
```

## 7. Prediction (scenario 6)

From `npm run validate:prediction`: how sure the prediction is, and how often it names the option a simulated
chooser actually takes. Chance is 1 in 6 (16.7%) on six options.

```
    top option's probability   p10 20.5%   median 29.4%   p90 44.9%
    chance alone would be     16.7%
    predictions claiming more than 60% for one option: 1.6%

--- calibration against simulated choosers ---

  A simulated participant picks option i with probability proportional to
  exp(alignment_i / T_true). SMALL T_true = picks their best fit almost always.
  LARGE T_true = close to random. The predictor does not get told T_true.

    T_true | behaves like                | conf | top-1 hit | mean p of the
           |                             |      |           | option chosen
    -------+-----------------------------+------+-----------+---------------
        10 | almost always the best fit  |  0.0 |     53.2% |         24.2%
        10 | almost always the best fit  |  0.5 |     53.2% |         27.4%
        10 | almost always the best fit  |  1.0 |     53.2% |         36.1%
        20 | usually the best fit        |  0.0 |     36.8% |         22.2%
        20 | usually the best fit        |  0.5 |     36.8% |         24.2%
        20 | usually the best fit        |  1.0 |     36.8% |         29.5%
        40 | leans to fit, often strays  |  0.0 |     25.1% |         19.8%
        40 | leans to fit, often strays  |  0.5 |     25.1% |         20.6%
        40 | leans to fit, often strays  |  1.0 |     25.1% |         22.3%
        80 | barely guided by fit        |  0.0 |     22.1% |         19.2%
        80 | barely guided by fit        |  0.5 |     22.1% |         19.7%
        80 | barely guided by fit        |  1.0 |     22.1% |         20.8%
    random | completely at random        |  0.0 |     17.1% |         17.9%
    random | completely at random        |  0.5 |     17.1% |         17.8%
    random | completely at random        |  1.0 |     17.1% |         17.5%
```

## 8. What these numbers already include

The changes in force when this page was generated, most recent last (full records: docs/FRESH_EYE_AUDIT.md,
the Log, and the dated sections of CLAUDE.md):

- **Fix 6** (26 Sep 2026): nine option numbers moved to the blind raters' average; new words on several cards.
- **Fix 7** (26 Sep 2026): eight value numbers and fourteen performance numbers from the second rater round.
- **Fix 7b** (26 Sep 2026): two reliability numbers (Seal your apartment 23, the sickest 26).
- **Fix 7c** (26 Sep 2026): which chip a card shows when two measures tie. Changes what cards say, no score.
- **G5** (26 Sep 2026): the record says whether Stability measured anything. No score changed.
- **C7** (26 Sep 2026): the gap between the #1 and #2 values is saved. No score or card order changed.
- **B3** (26 Sep 2026): the step sizes were tested at half and double size; every conclusion held
  (docs/BLOCK5_STEP_SIZE_SENSITIVITY.md). Nothing in the study changed.

When a new change is made, add one line here (in `tools/report_major_scores.cjs`) and run the generator again.
