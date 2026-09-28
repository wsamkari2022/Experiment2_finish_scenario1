# Value Consistency Index (VCI) — method

**Adopted:** 19 September 2026, by the researcher.
**Authority:** the code. The VCI section of `src/experiment/block5CVR.ts` is the specification; this
page restates it for reading away from the code. If the two ever disagree, the code is right and
this page is stale.
**Checked by:** `npm run validate:vci` (gates V1–V12) and `npm run report:vci` (every measured figure
below).

---

## 1. The question VCI answers

> Across the scenarios in which the participant **decided**, how well did the option they finally
> chose fit their own values — judged against their values **as they stood when that scenario
> opened**?

100 means they chose the option that fit them best every time. VCI is about **choices**. Whether the
values themselves moved is Stability; how good the chosen options were on their outcomes is
Performance. The three are kept apart so that one number never answers two questions.

---

## 2. Where the label comes from

VCI scores the **alignment label** of the final choice, so it starts where the label does
(`labelOptions` and `rankLabel` in `block5CVR.ts`).

**Shortfall.** For a participant whose score on policy value *k* is *u_k*, and an option that
delivers *f_k* on it, over the four policy values:

```
shortfall(option) = Σ_k (u_k / 100) × max(0, u_k − f_k)
```

Only falling **below** the participant's score counts, and a miss on a value they hold strongly
counts more.

**Place in line.** The options are ordered from the smallest shortfall (place 1) to the largest
(place *n*). Options with the same shortfall are ordered by how much they give of what the
participant holds, `Σ_k (u_k / 100) × f_k` (`policyDelivery`), and only then by id.

**Label.** On a six-option menu: place 1 **Aligned**, place 2 **Weakly aligned**, places 3–4
**Misaligned**, places 5–6 **Strongly misaligned**. On the four-option menu of scenario 6: one of
each, in that order.

---

## 3. The three equations

```
(1) Place score    b(r) = (n − r) / (n − 1)
                   the share of the OTHER options on the menu that fit worse than place r

(2) Label weight   w(L) = the average of b(r) over the places r that carry label L

(3) VCI            VCI = round( 100 × ( w(L_1) + w(L_2) + … + w(L_K) ) / K )
                   L_k = the label of the final choice in the k-th scenario that counts
                   K   = the number of scenarios that count (the deciders, 1–4, so K = 4)
```

| Code | Equation |
|---|---|
| `placeScore(place, menuSize)` | (1) |
| `labelWeight(level, menuSize)` | (2) |
| `scenarioVciScore(level, menuSize)` | the weight stored on each scenario as `vciScore` |
| `computeVCI(results)` | (3) |
| `consistencyLevel(value)`, `VCI_LEVELS` | the six levels (section 6) |

---

## 4. The weights

| Label | Six options (scenarios 1–5) | Four options (scenario 6) | In words (six options) |
|---|---|---|---|
| Aligned | place 1 → **1.00** | 1.00 | fit better than every other option |
| Weakly aligned | place 2 → **0.80** | 0.67 | fit better than four of the other five |
| Misaligned | places 3–4 → (0.6 + 0.4) / 2 = **0.50** | 0.33 | no better than picking blindly |
| Strongly misaligned | places 5–6 → (0.2 + 0.0) / 2 = **0.10** | 0.00 | worse than picking blindly |

**Worked example.** Final choices Aligned, Weakly aligned, Misaligned, Aligned:

```
VCI = 100 × (1.00 + 0.80 + 0.50 + 1.00) / 4 = 82.5  →  83, "Mostly Consistent"
```

**Anchors.**

| VCI | Means |
|---|---|
| 100 | the best-fitting option in every scenario |
| 80 | the second-best option in every scenario |
| 50 | what blind picking gives, on average |
| 10 | the lowest possible score — a Strongly misaligned option every time. Not 0, because the label cannot tell the 5th option from the 6th, and its weight is their average |

Thirty different values are possible with four scenarios, from 10 to 100.

---

## 5. Why these weights

1. **No number is chosen by hand.** All four weights follow from equation (1) and the label rule.
   *b(r)* is a percentile rank within the option's own menu: the share of the other options it
   beats.
2. **A label that covers two places gets their average.** The label does not say whether a
   Misaligned choice was the 3rd or the 4th option, and their average is the fair, unbiased guess.
   It is the mid-rank rule that rank statistics use for ties (Mann–Whitney U, Spearman's rho).
   Taking the worse place would short-change everyone who took the better one; taking the better
   place would flatter everyone who took the worse one.
3. **Blind picking scores exactly 50, on a menu of any size.** The average of *b(r)* over the
   places 1…*n* is one half, and averaging within labels does not move an average. So 50 is a
   fixed yardstick: above it, the choices fit the participant better than chance; below it, worse.
   Gate V11 checks it for menus of 3 to 10 options.
4. **The fit numbers agree with the rule.** Over 2,000 random starting profiles on scenarios 1–4,
   the options carrying each label come this close, on average, to the participant's best
   available fit — closeness = 1 − (its shortfall − the best shortfall) / (the worst shortfall −
   the best shortfall):

   | Label | Rule weight | Measured closeness |
   |---|---|---|
   | Aligned | 1.00 | 1.00 |
   | Weakly aligned | 0.80 | 0.83 |
   | Misaligned | 0.50 | 0.57 |
   | Strongly misaligned | 0.10 | 0.13 |

   Within 0.07 everywhere. The rule is used rather than the measurement because a measurement
   would have to be redone every time an option changed.
5. **One rule for every menu.** Scenario 6 takes its weights from the same two equations. If
   `ALIGNMENT_RANK_RULE` ever changes, `labelWeight` follows it; gate V10 then reports that the
   published table in this page and in the code is stale.

### Alternatives considered and not used

| Alternative | Why not |
|---|---|
| The worse place of each label: 1.00 / 0.80 / 0.40 / 0.00 | Lets 0 be reached, but short-changes everyone who took the better of a label's two places, and moves blind picking to 43, an anchor with no meaning |
| The measured closeness itself: 1.00 / 0.83 / 0.57 / 0.13 | Almost the same numbers, but tied to today's option numbers and to one population draw |
| Closeness scored choice by choice, against the participant's own total demand | Pushes everyone toward the top: blind picking scored 82 and always choosing the worst option 66 |

None of the three told the kinds of participant apart better than the rule. The weights change
what the numbers read, not the order in which participants fall. (These comparisons were run once,
on the same 2,000 profiles, while the rule was being chosen; `report:vci` reproduces the rule, not
the alternatives.)

---

## 6. The six levels

A level says which label the participant's **average** choice sits nearest. The edges are the four
"the same label every time" scores and the midpoints between neighbors, computed from the weights
(`VCI_LEVELS`), so they follow the weights and are never tuned by hand.

| Level | VCI | Meaning | Edge |
|---|---|---|---|
| **Highly Consistent** | 90–100 | nearer the best fit than the second best | midpoint of always-Aligned (100) and always-Weakly (80) |
| **Mostly Consistent** | 80–89 | about the second-best fit, on average | always-Weakly (80) |
| **Moderate** | 65–79 | between the second best and a misaligned choice | midpoint of always-Weakly (80) and always-Misaligned (50) |
| **Low** | 50–64 | nearer a misaligned choice | always-Misaligned (50), which is also blind picking |
| **Very Low** | 30–49 | worse than picking blindly | midpoint of always-Misaligned (50) and always-Strongly (10) |
| **Highly Inconsistent** | 10–29 | nearer the options that fit worst | — |

The level is shown on the results page and stored as `vciLevel` (`consistency_label` in the
database). It is presentation only and never feeds any calculation.

---

## 7. What counts, and against what

**Which scenarios.** Only the scenarios in which the participant decides — scenarios 1–4
(`scenarioIsScored`, `resultIsScored`). Scenario 5 asks for a wish and scenario 6 tests the model.
Both still **record** a per-scenario weight (`vciScore`); scenario 5's feeds the responsibility gap
(`block5Mirror.ts`), and neither is ever averaged into VCI.

**Which profile.** The profile the participant brought **into** the scenario: Blocks 1–4, as moved
by the CVR and APA answers of **earlier** scenarios. This holds on every path. Keeping an option
after the reflection (CVR) and finishing through the clarification (APA) both move the profile for
the **next** scenario, and neither re-labels the choice made in this one (`commitChoice`,
`handleApaCommit`). A value taken on during the block therefore counts from the next scenario on.
Relabeling the APA route on the profile it had just moved would lift a participant who takes up
a new value in every scenario from 31 to 56, a random responder's score. Gate V8 guards it.

**What VCI does not read.** The endorsement answer after the CVR, the APA answers, whether the
stakeholder moved them, and the performance metrics. All are stored per scenario and can be analyzed
next to VCI. The endorsement is rewarded once, through the profile update: the endorsed value is
raised, so from the next scenario on, choosing it earns full weight. Crediting it again inside VCI
would let a participant who endorses a different clashing value in every scenario score like one
who never chose against themselves — the one pattern VCI exists to catch.

---

## 8. How it behaves

*Figures re-run 26 September 2026, after two wildfire option numbers changed (audit Fix 5).*

`npm run report:vci` — 2,000 seeded random starting profiles, every one of them run through the real
scoring code by each kind of participant.

| Kind of participant | Mean VCI | Most common level |
|---|---|---|
| Always the best fit | 100 | Highly Consistent (100%) |
| Corrected by APA — tempted every time, then names their top value | 92 | Highly Consistent (68%) |
| Mixes their best and second-best fit | 90 | Highly Consistent (71%) |
| True to their Blocks 1–4 top value | 85 | Mostly Consistent (39%) |
| Always the second-best fit | 80 | Mostly Consistent (100%) |
| Chases the best performance numbers | 76 | Moderate (39%) |
| Changes value once, through APA, then holds it | 67 | Moderate (47%) |
| Changes value once, keeps it after the CVR, then holds it | 66 | Moderate (50%) |
| Random everywhere | 57 | Low (33%) |
| Takes up a new value every scenario (either route) | 34 | Very Low (60%) |
| Always the worst fit | 10 | Highly Inconsistent (100%) |

**Separation** — how often the first kind outscores the second:

| Pair | |
|---|---|
| True to top value > random | 92% |
| Random > flip-flopper | 86% |
| One-time convert > random | 67% |
| One-time convert > flip-flopper | 94% |
| One-time convert > performance chaser | 28% |

*(Re-measured 26 September 2026 after the Fix 7 option numbers (rater round 2). After Fix 6 they were: true to top value 86, performance chaser 79, flip-floppers 33, separations 93 / 87 / 69 / 95 / 26%; the chaser fell because scenario 3's top performer changed. Before Fix 6: true to top value 90, performance
chaser 75, flip-floppers 31–32; separations 96 / 87 / 70 / 97 / 36%. The performance chaser rose because
both convoys, which perform well, now also fit many profiles.)*

---

## 9. Known limits — to state in the write-up

1. **It is ordinal.** The weight follows the option's place, not how much worse it fit. When two
   neighboring options fit almost equally well, the boundary between their labels can move one
   scenario by up to 0.40 of weight, which is 10 VCI points. 28–33% of label boundaries are decided
   by under 3 points of fit.
2. **Four scenarios count,** so the scale is coarse: 30 possible values.
3. **A change of heart is learned over about two scenarios.** One strong endorsement makes the
   newly endorsed value the participant's top value in 58% of profiles, so a genuine convert usually
   loses part of the next scenario as well as the one in which they changed. They average 66, and
   come out ahead of a performance chaser only 28% of the time (ties counted half).
4. **Random answering.** Blind picking averages exactly 50. A responder who also answers the CVR and
   APA at random averages 57, because APA lists only the options built on the value they name,
   which steers some random choices toward a fit.
5. **Gate V5 tests a convert who adopts one clear value.** A change of heart is a change to a value,
   so V5's convert takes up, in scenario 1, an option built on one value (its strongest value 85 or
   more) and then holds to it: it loses only that scenario and scores 88. A participant who
   "converts" through a middle-of-the-road option, and then follows its largest number into an
   extreme option later, loses more - that is limit 3, not a failure of the gate.

---

## 10. The gates (`npm run validate:vci`)

| Gate | Asserts |
|---|---|
| V1 | Always the best fit scores 100 |
| V2 | Always the second best scores 80 and reads "Mostly Consistent" |
| V3 | Flip-floppers score below 50, below blind picking, as a group: the 2,000 pretend flip-floppers of `report:vci` (since 26 September 2026; before, one scripted flip-flopper, which scores exactly 50 whenever none of its picks happens to be strongly misaligned) |
| V4 | Always the worst fit scores 10, the floor, and no more than a flip-flopper |
| V5 | A one-time convert who adopts one clear value scores at least 100 × ((K − 1) + 0.10) / K — the lowest label once and the best every time after (it scores 88) |
| V6 | A convert who endorses firmly scores at least as much as one who endorses with doubt |
| V7 | Keeping your best-fit option never lowers the value it is built on |
| V8 | The APA route does not rescue a flip-flopper: the 2,000 pretend flip-floppers who change value through APA stay below 50 as a group (since 26 September 2026, as for V3) |
| V9 | Ties in fit are ordered by what the option delivers, never by name |
| V10 | The weights are the published ones on six and four options |
| V11 | Blind picking scores exactly 50 on every menu size from 3 to 10 |
| V12 | The level edges are 90 / 80 / 65 / 50 / 30, and twelve test scores land in the right level |

---

## 11. In the stored data

| In the app | In MongoDB | Holds |
|---|---|---|
| `result.vciScore` | `per_scenario_consistency_0_to_1` | the label weight of that scenario's final choice |
| `vci` | `consistency_score` (in `headline`) | VCI, 10–100 (0 only when no decider scenario ran) |
| `vciLevel` | `consistency_label` | one of the six levels |

VCI also sets part of the scenario-6 prediction's confidence (`predictionConfidence` in
`block5Prediction.ts`), which is why `PREDICTION_VERSION` moved to `2026-09-19-d` with this method.
Records made under an earlier version must not be pooled with these.

---

## 12. VCI_all: the same measure over all six scenarios (since 28 September 2026)

**The question.** VCI asks how well the choices fit the participant's own values in the four scenarios where they
decide and know their position. The researcher also wanted to know whether they hold to their values when the
decision lands on them (scenario 5, the wish) and when they do not know their position (scenario 6, the veil).
VCI_all is the same measure over all six. Both are shown on the results page; VCI is unchanged.

**The hidden running values** (the researcher's design). A second copy of the four policy values that moves after
EVERY final decision: in scenarios 1-4 by the study's own update (so it IS the study's values there), and ALSO
after the wish and the veil, where the study's own values never move. No reflection runs in scenarios 5 and 6, so
they use the **running rule**: the keep rule's comparison with the best fit for every pick that is not the best fit
(+20 to the value where the pick beats the best fit most, -15 to the value where the best fit beat it most, weighted
by how much the participant holds it; the best fit moves nothing). It was chosen ("Q1-A") over a weak endorsement
(+15 / -10, as if a reflection had happened), which gave VCI_all within about one point for every pretend kind but
assumed an answer never given. `applyRunningMoveWithMoves` in block5CVR.ts; the keep rule itself is unchanged
(its comparison moved into `moveByComparisonWithBestFit`, proven identical on 60,000 cases, gate A1).

**The running fit** of a scenario = the label of its FINAL choice on the running values as they stood when that
scenario OPENED, weighted as in section 4 (six options 1.00 / 0.80 / 0.50 / 0.10; scenario 6's four 1.00 / 0.67 /
0.33 / 0.00). Never on values its own choice moved: that is the circularity section 7 rules out (gate V8). Scenario
6 counts its final choice, the one made after the MPF's guess (the researcher's decision); the rule chosen before
the guess stays on the record.

**VCI_all** = 100 × the mean of the six running fits, rounded. Blind picking gives 50 on either menu (gate A5:
50.2 over 2,000 pretend runs), 100 = the best fit every time.

**Its six levels** use VCI's names and are derived the same way (never hand-tuned, "Q3-yes"): the score of choosing
the same label in every scenario, averaged over this deck's menus (five of six options, one of four), and the
midpoints between neighbors:

| Level | VCI_all from | (VCI from) |
|---|---|---|
| Highly Consistent | 88.89 | 90 |
| Mostly Consistent | 77.78 | 80 |
| Moderate | 62.5 | 65 |
| Low | 47.22 | 50 |
| Very Low | 27.78 | 30 |
| Highly Inconsistent | below | below |

They sit lower than VCI's only because scenario 6's four-option weights are lower for every label but the best fit.

**How it behaves** (docs/MAJOR_SCORES_DISTRIBUTION.md, section 1b):

| Pretend participant (report:vci's people) | VCI (1-4) | VCI_all (1-6) |
|---|---|---|
| Always the best fit | 100 | 100 |
| Always the second-best | 80 | 80 |
| True to their top value | 85 | 89 |
| Performance chaser | 76 | 76 |
| Random responder | 57 | 55 |
| A new value every scenario (flip-flopper) | 34 | 36 |
| Always the worst fit | 10 | 15 |

**Two effects, measured and stated, not corrected** (the researcher accepted both, "Q2-yes"). Scenario 5's cards are
shown and scored on the values scenario 4 OPENED with; the running fit judges the wish on the values AFTER scenario
4's choice.
- **The echo.** Scenario 4's choice moves the values toward the option chosen, and scenario 5 offers the same six
  options, so wishing for the option one decided often scores higher: 35 in 100 of such wishes (example: "Protect
  full visits" 80 in scenario 4, 100 as the wish).
- **Screen against yardstick.** 8 in 100 wishes for the card that LOOKED best on screen score below 100 on the
  running values. Checked on a real run in the browser on 28 September 2026: "Cut only where a family member can
  cover" read 85 out of 100 (the best) on screen and scored 80 (second-best) on the running values.

**Traps for the analysis.** VCI_all contains VCI's four scenarios: never correlate the two, compare their
difference (`vci_all_minus_vci`). There are two scenario-5 fits and two scenario-6 fits (the study's and the running
one) and two sets of values; `vci_wished` (hypothesis H12) is the study's scenario-5 fit. VCI_all is described, not
tested: no hypothesis rests on it ("Q4-described").

**Gates.** `npm run validate:vciall` (A1-A8: the keep rule unchanged, the running rule, running values = the study's
through scenario 4, no choice judged on its own move, blind 50, derived edges, 100 for a value-follower, decisions'
running fit = the study's fit and the wish and veil move only the running values), in the `validate:block5` chain;
`validate:dbshape` gate D65 (saved running fits = the ones rebuilt from the record, VCI_all recomputed by hand in the
section, the headline and the copy, an old record rebuilt to the same number). Each gate was shown to fail on a
deliberate break of the code.

**In the stored data.** `result.running` on every scenario (hidden: level, weight, the running values when the
scenario opened and after, how they moved, the running rule's moves); `vciAll` / `vciAllLevel` on the results;
`headline.consistency_score_all_six` / `consistency_label_all_six`; `analysis.vci_all` (every part, with a self-check
that rebuilds the running fits from the saved record); `running_level` and `running_per_scenario_consistency_0_to_1`
on each row of `analysis.alignment_records`; a copy in `major_info_and_scores.vci`. `RUNNING_VERSION` 2026-09-28-a.
