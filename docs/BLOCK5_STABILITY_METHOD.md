# Stability — method

**Adopted:** 19 September 2026, by the researcher.
**Authority:** the code. The Stability section of `src/experiment/block5CVR.ts` is the specification;
this page restates it for reading away from the code. If the two ever disagree, the code is right
and this page is stale.
**Checked by:** `npm run validate:stability` (gates S1–S15) and `npm run report:stability` (every
measured figure below).

> **Since 2 October 2026 Stability has two parts** (section 12). Sections 1 to 11 describe what is now the ORDER part,
> Value_Order_Stability, unchanged; the score itself is the average of that part and a DIFFERENCE part, with new level edges.
> The figures in section 7 are the order part's.

---

## 1. The question Stability answers

> When the participant went against their best fit, did the **order** of their four policy values —
> which comes first, second, third and fourth — change?

100 means no two of their priorities ever traded places.

Stability is about **values**, not choices. VCI asks whether the choices fit the values as they
stood; Stability asks whether the values themselves were reordered. A participant can choose against
their values in every scenario and keep the same priorities (low VCI, high Stability), or change
their priorities once and then choose in line with the new ones (VCI recovers, Stability records the
change). **Stability is descriptive:** a high score is not better than a low one, and a genuine change
of heart is supposed to lower it.

---

## 2. The equations

A **conflict step** is a decider scenario in which the reflection ran (`cvrFired`): the final choice
was Misaligned or Strongly misaligned, and the participant either kept it (the endorsement update)
or clarified through APA (the APA update). Nothing else counts — not keeping an Aligned or Weakly
aligned option, not the wish (scenario 5), not the prediction test (scenario 6).

```
(1) Swaps in one conflict step, over the six pairs (i, j) of the four policy values
        s_ij = 1     the pair's order reversed          i above j before, j above i after
        s_ij = 1/2   a tie opened or closed             equal on one side, ordered on the other
        s_ij = 0     otherwise
        swaps_t = Σ s_ij                                0 to 6 in one step

(2) Total swaps     S = Σ swaps_t over the conflict steps

(3) Stability       Stability = round( 100 × (1 − min(1, S / 6)) )
```

(1) is the **Kendall tau distance** between the ranking before the step and the ranking after it,
with a tie counted as half a disagreement. **6** is the number of pairs among four values: six swaps
is as much reordering as turning the four priorities completely upside down. Each swap costs
100 / 6 = 16.7 points; a half swap, 8.3. Two scores within 0.000001 of each other count as a tie, so
floating-point noise cannot open or close one.

| Code | Equation |
|---|---|
| `rankSwaps(before, after)` | (1) |
| `computeStability(results, originalProfile)` | (2) and (3) |
| `stabilityLevel(value)` | the levels (section 3) |
| `STABILITY_FULL_REVERSAL` | 6 |

**Worked example.** Before a conflict the order is vulnerable > harm > helped > gained. The
participant keeps an option built on "gained", and the endorsement update lifts it to second place:
vulnerable > gained > harm > helped. Two pairs reversed (gained/harm and gained/helped), so this step
is 2 swaps. With no other conflict: Stability = round(100 × (1 − 2/6)) = **67**, "Shifted a little".

---

## 3. The levels

Set by the researcher, by total swaps:

| Level | Stability | Swaps |
|---|---|---|
| **Held steady** | 100 | none |
| **Mostly steady** | 83–99 | more than none, at most one |
| **Shifted a little** | 50–82 | more than one, at most three (one value climbing from last place to first is three) |
| **Shifted a lot** | 17–49 | more than three, at most five |
| **Changed substantially** | 0–16 | more than five — about as much as a complete reversal |

On the stored, rounded value the edges are 100 / 83 / 50 / 17: exactly one, three and five swaps put
through equation (3). The code computes them that way; they are never typed in. Thirteen values are
possible: 100 92 83 75 67 58 50 42 33 25 17 8 0.

---

## 4. Why swaps, and not distance traveled

The obvious alternative adds up how far the values traveled, step by step ("churn"), with a
start-versus-end order check beside it. That is what Stability measured until 19 September 2026. It
was replaced for five reasons. `npm run report:stability` still computes it, so each reason can be
checked.

1. **The order is what the study uses.** Alignment ranks options against the participant's values,
   the CVR aims at the value on top, and the planner orders the cards by the order of the values. A
   move that reorders two values changes all of those; a move of the same size that leaves the order
   alone changes none of them. Swaps count exactly the moves that matter to the instrument.
2. **Distance mostly measures the study's own constants.** Every profile update is a fixed step the
   study chose (+30 / −20 for an endorsement, +30 / −10 for a clarification, +15 / −10 for keeping a
   fit, ±25 for the stakeholder). The distance a profile travels is largely those constants counted
   up. Whether a step reorders two values depends on how close the participant's own scores were —
   which is information about the participant.
3. **Distance needs a ceiling that has to be simulated.** To become a 0–100 score, distance needs a
   "this much movement counts as maximal" constant. It could only be taken from simulated random
   responders, and it went stale whenever a scenario, an option or an update constant changed. Swaps
   have a natural maximum — a complete reversal — that needs no simulation and cannot go stale.
4. **Distance could not tell the participants apart.**

   | How often the first scores higher | Swaps | Distance |
   |---|---|---|
   | Flip-flopper > one-time convert | 11% | 34% |
   | Flip-flopper > random responder | 12% | 36% |
   | One-time convert > always the worst fit | 91% | 80% |

5. **Distance counted agreement as change.** (Figures for this point date from before 24 September
   2026. Since then a best-fit pick moves nothing, so that participant scores 100 under both measures;
   one who always takes the second best still scores 63 under distance against 100 under swaps.)
   Keeping an option that already fits still nudged the
   profile, so a participant who chose their best fit every time averaged 86, with 38% of them below
   "Held steady", and "always my second best" averaged 69. Under swaps both score 100.

**What swaps give up.** They are blind to how far a value moved when it moved without overtaking
another, and they come in steps of a half swap. The first is the point — Stability asks whether the
priorities changed, not how hard the model was pushed. The second is the price of measuring an order.

---

## 5. Why only conflict steps, and only the four policy values

**Conflict steps only.** Outside a conflict the profile still moves: keeping a fitting option lifts
the value it is built on (`applyKeepUpdates`), so that a value the participant keeps choosing can
climb. That is the **model** refining its estimate of someone who has just confirmed their values,
not the participant changing them. Only a conflict — choosing against the current best fit, then
standing by it or clarifying — is the participant doing something to their own priorities.

**Four policy values only.** Stability is about priorities, and the four policy values are the only
ones ranked against each other to decide what fits. Stakeholder, directness and context describe
**how** a participant is moved, not **what** they put first. Each has a stability of its own
(section 6).

---

## 6. The three sensitivity stabilities

Directness, context and stakeholder are each **one** value, so there is no order to swap. Each one's
stability is how far it traveled along its own 0–100 scale, with the whole width of the scale as the
maximum:

```
distance_x    = Σ | x after scenario k − x before scenario k |     over the scenarios in order
Stability_x   = round( 100 × (1 − min(1, distance_x / 100)) )
```

Distance is right here, and not for the policy values, because the argument against it does not
apply: a single value is not ranked against anything, so the only way it can change is by moving
along its scale, and the width of the scale is a natural maximum that needs no simulation.

They move only at a conflict step: the stakeholder by ±25 whenever the reflection runs (up if the
person's story moved the participant, down if not); directness or context by 20 × weight when the
participant compared both lenses and said which one moved them. The same five words as Stability,
on the same edges of the 0–100 value (100 / 83 / 50 / 17).

`computeSensitivityStability(results, originalProfile)` in `block5CVR.ts`.

**Limits.** Directness and context move only when the optional second lens is generated and
answered, so most participants hold both at 100 — a fact about the button, recorded per scenario
as `cvrAltViewGenerated`. The stakeholder moves 25 points on every reflection, so its stability
mostly counts reflections and whether the person's story moved the participant each time.

---

## 7. How it behaves

`npm run report:stability` — 2,000 seeded random starting profiles, the same simulated participants
as `npm run report:vci`.

*Figures re-run 26 September 2026, after two wildfire option numbers changed (audit Fix 5).*

| Kind of participant | Stability | Most common level | Stakeholder stability |
|---|---|---|---|
| Always the best fit | 100 | Held steady (100%) | 100 |
| Always the second best | 100 | Held steady (100%) | 100 |
| Mixes best and second best | 100 | Held steady (100%) | 100 |
| True to their Blocks 1–4 top value | 91 | Held steady (63%) | 84 |
| Corrected by APA — tempted every time, names their top value | 94 | Held steady (51%) | 49 |
| Chases the best performance numbers | 80 | Held steady (41%) | 76 |
| Changes value once, through APA | 74 | Shifted a little (54%) | 67 |
| Changes value once, keeps it after the CVR | 56 | Shifted a little (39%) | 65 |
| Random everywhere | 57 | Shifted a little (40%) | 44 |
| Takes up a new value every scenario, through APA | 29 | Shifted a lot (38%) | 53 |
| Takes up a new value every scenario, by keeping | 12 | Changed substantially (68%) | 53 |
| Always the worst fit | 10 | Changed substantially (67%) | 51 |

*(Re-measured 26 September 2026 after the Fix 7 option numbers (rater round 2); every row moved by 0–3 points
against Fix 6.)*

Directness and context stability are 100 for every kind here, because the simulated participants
never open the second lens.

---

## 8. Known limits — to state in the write-up

1. **Coarse.** Thirteen possible values, in steps of a half swap.
2. **The route matters a little.** A clarification moves the named value +30 and each other value
   −10; an endorsement moves the served value +30 and the sacrificed one −20. So the same change of
   heart reorders less through APA: a participant who takes up a new value every scenario averages 29
   through APA and 12 by keeping.
3. **A change of heart is a large reordering.** A one-time convert averages 56, about the same as a
   random responder (57). Stability measures change, not quality.
4. **Ties are common.** After 11% of conflict steps two of the four values are exactly equal — the
   updates are round numbers and stop at 0 and 100 — which is why a tie opening or closing counts
   half rather than being ignored or counted whole.
5. **A 100 can mean "never tested".** With no conflict step there is nothing to count, and the formula
   gives 100. In `npm run report:stability` (columns "not measured" and "mean if measured", 26 September
   2026): every best-fit and second-best picker, 38 in 100 people true to their top value (their mean is
   85 over the other 62), 26 in 100 performance chasers (73 over the rest), about 1 in 100 random
   responders. Since 26 September 2026 the record says which (`headline.stability_was_measured`, audit G5);
   report Stability over the measured participants, or the two groups apart. **Still true, and stated:**
   Stability sets half of scenario 6's prediction confidence, so a never-tested 100 raises that confidence
   too. Not changed (it would change the prediction and `PREDICTION_VERSION`).

---

## 9. The gates (`npm run validate:stability`)

| Gate | Asserts |
|---|---|
| S1 | Always the best fit scores 100, "Held steady" |
| S2 | Always serving your top value is at least "Mostly steady" |
| S3 | Taking up a new value every scenario scores below 50 |
| S4 | A thrasher scores below someone who changed once and held |
| S5 | A round trip counts every swap on the way, not only where it ended |
| S6 | Swaps respond: a convert reorders, a loyal participant does not |
| S7 | Keep steps never count: always the second best scores 100 |
| S8 | `rankSwaps` is the Kendall tau distance with a tie at one half (seven cases) |
| S9 | The levels sit at 100 / 83 / 50 / 17 |
| S10 | Only a decider scenario in which the reflection ran can add swaps |
| S11 | A sensitivity's stability is the distance it traveled on its scale |
| A1–A6 | The APA clarification moves the profile the way `applyApaUpdates` promises |

---

## 10. In the stored data

| In the app | In MongoDB | Holds |
|---|---|---|
| `stability`, `stabilityLevel` | `headline.stability_score`, `stability_label` | Stability and its level |
| `stabilityDetail` | `blocks…stabilityDetail` | total swaps, conflict steps, swaps at each conflict step, top value before and after |
| `stabilityDetail.conflictSteps` | `headline.stability_was_measured`, `stability_conflict_steps_counted` (since 26 September 2026; also in `major_info_and_scores.stability`) | whether any conflict step was counted, and how many; false = the score measures nothing |
| `sensitivityStability` | `headline.directness_stability_score` / `_label`, `context_…`, `stakeholder_…` | the three sensitivity stabilities; `blocks…sensitivityStability` also holds each one's distance |

Stability sets half of the scenario-6 prediction's confidence (`predictionConfidence` in
`block5Prediction.ts`), which is why `PREDICTION_VERSION` moved to `2026-09-19-e` with this method.
Records made under an earlier version must not be pooled with these.

## 11. Stability_all: the same rule over all six scenarios (29 September 2026)

The researcher's request ("Stability_all for all 6 scenarios"; plan answers "Q1-yes, Q2-recommended, Q3-recommended,
Q4-A"). `block5StabilityAll.ts`. Equations (1) to (3) are unchanged and reused (`rankSwaps`, `stabilityFromSwaps`); only
the list of steps grows:

- **Values read:** the hidden running values behind VCI_all (block5VciAll.ts), which equal the study's values through
  scenario 4 and also move after the wish and the veil (the running rule, +20 / −15, for any pick that is not the best fit).
- **Steps counted:** scenarios 1-4 exactly as Stability (a decision where the reflection ran, `cvrFired`); scenarios 5 and
  6 when the final choice was not one of the two best fits on the running values the scenario opened with. A second-best
  pick never counts, as in Stability (the model refining its estimate).
- **Consequences:** the decisions' part equals Stability's swaps, so Stability_all ≤ Stability, with equality when scenarios
  5 and 6 add nothing (gate A9 over 24,000 pretend runs). It contains Stability: never correlate the two.
- **Measured** (report:major-scores 2b): best-fit pickers 100; true to their top value 89 (Stability 90.5); random choosers
  39 (57.5); flip-floppers 3-13 (12-29); corrected by APA 71 (94), because scenarios 5 and 6 offer no APA.
- **Limits:** smaller steps in 5 and 6; scenario 5's echo (about 5 in 100 second-best pickers get a counted step there);
  the level depends on the step sizes (section 8, R7).
- **Beside it, never shown:** the top-value choices (`analysis.top_value_choices`): how often the final choice did most for
  the #1 value brought into Block 5 (blind 1.08 of 6), and for the #1 or #2 (blind 2.17).

## 12. Since 2 October 2026: two parts, averaged

The researcher asked whether Stability could compare the values brought into Block 5 with the values after it, so that it
would not depend on whether one value goes down alone or the other three go down together. His decision, after the studies
below: "1-A, counted steps only, keep today's edges but make sure the level is distributed well".

```
(4) Moves     m_k = Σ ( value k after − value k before )        over the same conflict steps as (2), per value
(5) Difference part   Value_Difference_Stability = round( 100 − (|m_1| + |m_2| + |m_3| + |m_4|) / 4 )
(6) Order part        Value_Order_Stability = equation (3), unchanged
(7) Stability         round( (order part + difference part) / 2 )
```

| Code | Equation |
|---|---|
| `differenceStabilityFromMoves(moves)` | (5) |
| `combineStability(order, difference)` | (7) |
| `computeStability` / `computeStabilityAll` | (4) to (7), returning `orderValue`, `differenceValue`, `averageMove` |
| `COMBINED_STABILITY_EDGES`, `stabilityLevel` | the levels below; `levelOnSwapEdges` keeps today's (order part, three sensitivities) |

**Why not the difference alone.** Before against after cannot see a back-and-forth: a participant who takes up a new value
in every scenario ends near where they began. On the pretend participants the difference alone scored that flip-flopper ABOVE a
one-time convert (82 against 75; the convert scored higher only 27 times in 100), counted keeping a second-best fit as change
(83 instead of 100, the same as a random person), and scored somebody who keeps naming their #1 value below a random person
(their order never changed; the value just rose). It is also section 4's distance in a new form. Averaged with the order part,
which sees every change of direction, these do not survive: the flip-flopper 47 against the convert's 67.

**Why both.** The four conditions bias the two parts in opposite directions. The order part is higher in APA_Only and Baseline
(one value up and three down together: fewer swaps); the difference part is usually lower there (more points moved in total).
Averaged they partly cancel: the largest gap between conditions for the same behaviour falls from 22 points to 13 (Stability_all
17 to about 7; docs/MAJOR_SCORES_BY_CONDITION.md section 2).

**The levels.** The same five words. Each edge is where a pretend participant sitting exactly on today's edge lands on the new
score (the median over 2,000 profiles x 12 kinds x the four conditions):

| Level | Today's edge (order part) | New edge (combined) |
|---|---|---|
| Held steady | 0 swaps (tested) | 94 |
| Mostly steady | 1 swap (83) | 85 |
| Shifted a little | 3 swaps (50) | 63 |
| Shifted a lot | 5 swaps (17) | 49 |
| Changed substantially | below | below 49 |

The five levels then hold 39 / 12 / 23 / 12 / 14 in 100 (all kinds, all four conditions), against 44 / 12 / 19 / 12 / 13 for
the order rule on today's edges. `npm run report:major-scores` derives them again on every run and stops if one drifts by more
than a point.

**How it behaves** (condition 1, 2,000 pretend people of each kind; Stability / Stability_all): always the best fit 100 / 100;
true to their top value 92 / 91; corrected by APA 84 / 77; performance chaser 86 / 80; changes value once through APA 76 / 75,
by keeping 67 / 66; random 71 / 61; a new value every scenario through APA 60 / 49, by keeping 47 / 41; always the worst fit 44 /
40. The convert scores above the flip-flopper 84 times in 100 (order rule 89), a value follower above a random person 87
(84), corrected by APA above a random person 77 (88).

**The prediction** (`PREDICTION_VERSION` "2026-10-02-f") reads the combined score. The option it puts first cannot change; the
average chance it gives the person's own scenario-6 pick moves by at most 0.2 points; and a higher Stability marks a person it
guesses right more clearly: CVR+APA 61% against 36% for the people above and below the middle (order rule 54% against 43%),
never worse in any condition.

**Limits.** Stability_all can now be a little above Stability (about 5 in 100 runs), when scenario 5 or 6 moves a value back
toward where it began; its order part never is. The difference part still reads the study's own step sizes (section 4 point 2),
so compare groups. Never correlate Stability with either part.
