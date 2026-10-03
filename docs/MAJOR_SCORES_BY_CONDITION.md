# Major scores in the four conditions

> **Generated** by `npm run report:major-scores` on 2026-10-03, from code version `48fc2d1` plus changes not yet committed, together
> with docs/MAJOR_SCORES_DISTRIBUTION.md. Do not edit this page by hand: change `tools/condition_sim.cjs` (the rules) or
> `tools/report_conditions_page.cjs` (the page) and run the command again.

## How to read this page

These are **pretend participants, not real people**: the same 2,000 random starting profiles and the same twelve kinds
of chooser as docs/MAJOR_SCORES_DISTRIBUTION.md, through the study's real scoring code. This page lets each of them
through Block 5 in every condition, so the conditions can be compared on **the same people**. Real participants will
behave as they do; this page shows what each condition's **rules** do to the scores when the behaviour is known.

Every table has six columns: the four conditions, and the two extra versions you asked for (1 October 2026: "Do the
two of them, so I can see the differences").

| Column | What it is |
|---|---|
| **CVR+APA** | Condition 1, the full version. The numbers of docs/MAJOR_SCORES_DISTRIBUTION.md |
| **CVR_Only** | Condition 2: a refusal after the reflection opens the CVR Rejection page, then the person chooses again |
| **APA_Only** | Condition 3: a misfit opens the APA page at once. Principle A, random responder rule A |
| **APA_Only, random B** | The same, with random responder rule B (only the random responder can differ) |
| **Baseline (A)** | Condition 4: a misfit opens the confirmation page with "How sure". Principle A |
| **Baseline (B)** | The same under principle B (only the three refusing kinds can differ) |

A "misfit" is a misaligned or strongly misaligned choice in one of the four decisions (scenarios 1-4).

### The two principles (your Q1: both)

- **Principle A, "the same person, a different page":** each kind makes the choices it makes in condition 1; only the
  page it meets, and that page's value moves, change. Any difference between the columns then comes from the rules.
- **Principle B, "the pages change behaviour":** a person refuses a misfit only when a page asks them to think again.
  CVR_Only (the reflection) and APA_Only (the APA page) have such a page, so B is the same as A there. Baseline has
  none, so in Baseline (B) the three kinds that refuse in condition 1 **keep their first pick**.

### What each kind does in each condition

| Kinds | CVR+APA (today) | CVR_Only | APA_Only | Baseline |
|---|---|---|---|---|
| **Never pick a misfit** (3): Always aligned, Always weakly aligned, Top-two mixer | Confirmation page; the keep rule | Same | Same | Same |
| **Keep their misfit** (5): True to top value, Convert (keeps), Performance chaser, Flip-flopper (keeps), Always the worst fit | Reflection: stand by it, "strongly" (the chaser "with some doubt"): +30 to the value it serves, −20 to the value it gives up most, ±25 person speaking | Same as today | APA page: name the value the box says the option serves most, pick their own option from the list. How sure 5 (the chaser 3): +30 × weight to it, −10 × weight to the other three | Confirmation page: Keep. How sure 5 (the chaser 3): +30 × weight to the value it serves most, −10 (misaligned) or −15 (strongly misaligned) × weight to the other three |
| **Refuse their misfit** (3): Corrected by APA, Convert (via APA), Flip-flopper (via APA) | Reflection: refuse; APA page: name a value (their top value / their new value / a new value each time), how sure 4 / 5 / 5, pick from the list | CVR Rejection page (person speaking ±25), go back, choose the option they end on today; a misfit is kept "strongly" | **As today** on the APA page (the person-speaking score no longer moves) | **A:** Change my mind, choose the option they end on today; a misfit is kept with how sure 4 / 5 / 5. **B:** Keep the first pick, how sure 4 / 5 / 5 |
| **Random responder** (1) | Half stand by it, half refuse; every answer random | Half stand by it, half refuse and choose again at random (and may refuse again) | **A:** every answer random (value, how sure, option from the list). **B:** half the time it names the box's value and keeps its own option (random how sure); otherwise as A | Half Keep (random how sure), half Change my mind and pick again at random (a misfit is then kept or dropped at random) |

"Weight" is the APA page's own sureness weight: how sure 1, 2, 3, 4, 5 gives 0.6, 0.7, 0.8, 0.9, 1.0.

### Checks made before any number on this page

- **Condition 1 is today's study:** the CVR+APA column was compared with docs/MAJOR_SCORES_DISTRIBUTION.md person by person, for all 24000 pretend people: **0 differences**.
- **Kinds that score the same in all six columns, person by person:** Always aligned, Always weakly aligned, Top-two mixer. They never pick a misfit, so no condition's own page ever opens for them.
- **Stability and Stability_all are the average of their two parts for every person in every column** (since 2 October 2026): **0 differences**.
- **APA_Only, random B changes only the random responder:** checked, every other kind is identical.
- **Baseline (B) changes only the three refusing kinds:** checked, every other kind is identical.
- **Draws:** every kind meets the same random draws in every column, so its first pick in scenario 1 is the same; later
  first picks can differ when a condition has moved the values differently (the list of misfits is then different). The
  random responder's later answers can also differ between columns, so compare it as a group.

## Five pretend people, step by step (the examples used under every table)

Each example is one pretend person in the columns that matter for it (the first of the 2,000, or the first who shows
the difference the example is about; its number is given). Each cell: their first pick
in that decision and its fit, the page they met and what they did there, the final choice when it changed, and what
moved (vulnerable = protecting the vulnerable, harm = reducing harm, gained = how much is gained, helped = how many are
helped). "Step" = counted for Stability.

### Example 1: Always the worst fit (pretend person 3 of 2,000)

This person keeps a misfit in every decision, so it shows how each condition's own rule moves the values.

| Decision | CVR+APA | APA_Only | Baseline (A) |
|---|---|---|---|
| 1. Six Hours to Clear the District | Take the sealed respirator the clinic had reserved (Strongly misaligned)<br>→ reflection; stood by it (strongly)<br>moved: vulnerable −20, gained +30, person speaking −3 · **step** | Take the sealed respirator the clinic had reserved (Strongly misaligned)<br>→ APA page: named how much is gained, sure 5<br>moved: vulnerable −10, harm −10, gained +30, helped −10 · **step** | Take the sealed respirator the clinic had reserved (Strongly misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable −15, harm −15, gained +30, helped −15 · **step** |
| 2. Eight Hours Ahead of the Fire | Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>→ reflection; stood by it (strongly)<br>moved: vulnerable −20, gained +27 · **step** | Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>→ APA page: named how much is gained, sure 5<br>moved: vulnerable −10, harm −10, gained +27, helped −10 · **step** | Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable −15, harm −15, gained +27, helped −15 · **step** |
| 3. Limited Cancer Treatment Allocation | Treat the 20 who are sickest (Strongly misaligned)<br>→ reflection; stood by it (strongly)<br>moved: vulnerable +30, gained −20 · **step** | Treat the 20 who are sickest (Strongly misaligned)<br>→ APA page: named protecting the vulnerable, sure 5<br>moved: vulnerable +27, harm −10, gained −10, helped −10 · **step** | Treat the 20 who are sickest (Strongly misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable +30, harm −15, gained −15, helped −13 · **step** |
| 4. The Care Visits You Have to Cut | Keep the town routes that pay, and drop the rural ones (Strongly misaligned)<br>→ reflection; stood by it (strongly)<br>moved: vulnerable −20, gained +20 · **step** | Shorten every visit so nobody is dropped (Strongly misaligned)<br>→ APA page: named how many are helped, sure 5<br>moved: vulnerable −10, harm −10, gained −10, helped +30 · **step** | Shorten every visit so nobody is dropped (Strongly misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable −15, harm −15, gained −15, helped +30 · **step** |
| **Scores** | VCI 10 · VCI_all 15 · Stability 39 (4 steps) · Stability_all 37 · performance 25 | VCI 10 · VCI_all 8 · Stability 53 (4 steps) · Stability_all 40 · performance 28 | VCI 10 · VCI_all 8 · Stability 48 (4 steps) · Stability_all 39 · performance 28 |

### Example 2: Corrected by APA (pretend person 1 of 2,000)

This person is tempted by a misfit in every decision and corrected, so it shows principle A against principle B.

| Decision | CVR+APA | CVR_Only | Baseline (A) | Baseline (B) |
|---|---|---|---|---|
| 1. Six Hours to Clear the District | Drive out on the industrial service road (Misaligned)<br>→ reflection, refused; APA page: named reducing harm, sure 4<br>→ final: Leave with the registered convoy at your assigned time (Aligned)<br>moved: vulnerable −4, harm +15, gained −9, helped −9, person speaking +25 · **step** | Drive out on the industrial service road (Misaligned)<br>→ reflection, refused; CVR Rejection page; chose again<br>→ final: Leave with the registered convoy at your assigned time (Aligned)<br>moved: person speaking +25 | Drive out on the industrial service road (Misaligned)<br>→ confirmation page: Change my mind; then a good fit<br>→ final: Leave with the registered convoy at your assigned time (Aligned)<br>moved: nothing | Drive out on the industrial service road (Misaligned)<br>→ confirmation page: Keep, sure 4<br>moved: vulnerable −4, harm −9, gained −9, helped +27 · **step** |
| 2. Eight Hours Ahead of the Fire | Fill every seat in the car with neighbors who have none (Misaligned)<br>→ reflection, refused; APA page: named reducing harm, sure 4<br>→ final: Take your household's assigned place in the staged convoy (Aligned)<br>moved: gained −9, helped −9, person speaking +21 · **step** | Take your household to the concrete school on the hill (Misaligned)<br>→ reflection, refused; CVR Rejection page; chose again<br>→ final: Take your household's assigned place in the staged convoy (Aligned)<br>moved: person speaking +21 | Take your household to the concrete school on the hill (Misaligned)<br>→ confirmation page: Change my mind; then a good fit<br>→ final: Take your household's assigned place in the staged convoy (Aligned)<br>moved: nothing | Take your household to the concrete school on the hill (Misaligned)<br>→ confirmation page: Keep, sure 4<br>moved: harm +24, gained −9, helped −9 · **step** |
| 3. Limited Cancer Treatment Allocation | Treat the 20 who others depend on (Misaligned)<br>→ reflection, refused; APA page: named reducing harm, sure 4<br>→ final: Draw the 20 names from the patients who cannot wait (Aligned)<br>moved: gained −9, helped −9 · **step** | Treat the 20 most likely to survive (Misaligned)<br>→ reflection, refused; CVR Rejection page; chose again<br>→ final: Draw the 20 names from the patients who cannot wait (Weakly aligned)<br>moved: harm +15, helped −15 | Treat the 20 most likely to survive (Misaligned)<br>→ confirmation page: Change my mind; then a good fit<br>→ final: Draw the 20 names from the patients who cannot wait (Weakly aligned)<br>moved: harm +15, helped −15 | Treat the 20 most likely to survive (Misaligned)<br>→ confirmation page: Keep, sure 4<br>moved: harm −9, gained −9, helped +10 · **step** |
| 4. The Care Visits You Have to Cut | Keep every care visit, and cut the check-in visits (Strongly misaligned)<br>→ reflection, refused; APA page: named reducing harm, sure 4<br>→ final: Cut only where a family member can cover (Aligned)<br>moved: gained −9, helped −9 · **step** | Shorten every visit so nobody is dropped (Strongly misaligned)<br>→ reflection, refused; CVR Rejection page; chose again<br>→ final: Cut only where a family member can cover (Aligned)<br>moved: nothing | Shorten every visit so nobody is dropped (Strongly misaligned)<br>→ confirmation page: Change my mind; then a good fit<br>→ final: Cut only where a family member can cover (Aligned)<br>moved: nothing | Protect full visits for the clients with nobody else (Strongly misaligned)<br>→ confirmation page: Keep, sure 4<br>moved: vulnerable +27, harm −13.5, gained −13.5, helped −13.5 · **step** |
| **Scores** | VCI 100 · VCI_all 68 · Stability 89 (4 steps) · Stability_all 81 · performance 81 | VCI 95 · VCI_all 65 · Stability 100 (0 steps) · Stability_all 75 · performance 81 | VCI 95 · VCI_all 65 · Stability 100 (0 steps) · Stability_all 75 · performance 81 | VCI 40 · VCI_all 28 · Stability 56 (4 steps) · Stability_all 39 · performance 53 |

### Example 3: Random responder (pretend person 1 of 2,000)

This person answers at random, so it shows the two random-responder rules in APA_Only (your Q3).

| Decision | CVR+APA | APA_Only | APA_Only, random B |
|---|---|---|---|
| 1. Six Hours to Clear the District | Drive the community shuttle for two loops before you go (Weakly aligned)<br>→ confirmation page, a good fit<br>moved: harm −15, helped +20 | Drive the community shuttle for two loops before you go (Weakly aligned)<br>→ confirmation page, a good fit<br>moved: harm −15, helped +20 | Drive the community shuttle for two loops before you go (Weakly aligned)<br>→ confirmation page, a good fit<br>moved: harm −15, helped +20 |
| 2. Eight Hours Ahead of the Fire | Give your car seats to the two residents with walkers and wait for the lift bus (Misaligned)<br>→ reflection, refused; APA page: named how much is gained, sure 5<br>→ final: Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>moved: vulnerable −4, harm −10, gained +30, helped −10, person speaking −25 · **step** | Give your car seats to the two residents with walkers and wait for the lift bus (Misaligned)<br>→ APA page: named how much is gained, sure 5<br>→ final: Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>moved: vulnerable −4, harm −10, gained +30, helped −10 · **step** | Give your car seats to the two residents with walkers and wait for the lift bus (Misaligned)<br>→ APA page: named how much is gained, sure 5<br>→ final: Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>moved: vulnerable −4, harm −10, gained +30, helped −10 · **step** |
| 3. Limited Cancer Treatment Allocation | Draw the 20 names from the patients who cannot wait (Misaligned)<br>→ reflection, refused; APA page: named how many are helped, sure 1<br>→ final: Treat the 20 most likely to survive (Weakly aligned)<br>moved: harm −6, gained −6, helped +18, person speaking −25 · **step** | Draw the 20 names from the patients who cannot wait (Misaligned)<br>→ APA page: named how many are helped, sure 1<br>→ final: Treat the 20 most likely to survive (Weakly aligned)<br>moved: harm −6, gained −6, helped +18 · **step** | Draw the 20 names from the patients who cannot wait (Misaligned)<br>→ APA page: named how many are helped, sure 1<br>→ final: Treat the 20 most likely to survive (Weakly aligned)<br>moved: harm −6, gained −6, helped +18 · **step** |
| 4. The Care Visits You Have to Cut | Cut only where a family member can cover (Misaligned)<br>→ reflection; stood by it (strongly)<br>moved: harm +30, gained −20, person speaking +25 · **step** | Cut only where a family member can cover (Misaligned)<br>→ APA page: named how many are helped, sure 5<br>→ final: Keep every care visit, and cut the check-in visits (Weakly aligned)<br>moved: harm −10, gained −10 · **step** | Cut only where a family member can cover (Misaligned)<br>→ APA page: named reducing harm, sure 5<br>moved: harm +30, gained −10, helped −10 · **step** |
| **Scores** | VCI 55 · VCI_all 53 · Stability 63 (3 steps) · Stability_all 62 · performance 24 | VCI 63 · VCI_all 55 · Stability 69 (3 steps) · Stability_all 59 · performance 41 | VCI 55 · VCI_all 53 · Stability 63 (3 steps) · Stability_all 51 · performance 24 |

### Example 4: True to top value (pretend person 1 of 2,000)

This person always takes the option that serves their #1 value; sometimes that option is a misfit, and the conditions treat keeping it differently.

| Decision | CVR+APA | Baseline (A) |
|---|---|---|
| 1. Six Hours to Clear the District | Seal your apartment, tell the district office you are staying, and shelter (Misaligned)<br>→ reflection; stood by it (strongly)<br>moved: harm +15, helped −20, person speaking −25 · **step** | Seal your apartment, tell the district office you are staying, and shelter (Misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable −4, harm +15, gained −10, helped −10 · **step** |
| 2. Eight Hours Ahead of the Fire | Take your household to the concrete school on the hill (Weakly aligned)<br>→ confirmation page, a good fit<br>moved: gained −15 | Take your household to the concrete school on the hill (Weakly aligned)<br>→ confirmation page, a good fit<br>moved: gained −15 |
| 3. Limited Cancer Treatment Allocation | Draw the 20 names from the patients who cannot wait (Aligned)<br>→ confirmation page, a good fit<br>moved: nothing | Draw the 20 names from the patients who cannot wait (Aligned)<br>→ confirmation page, a good fit<br>moved: nothing |
| 4. The Care Visits You Have to Cut | Cut only where a family member can cover (Aligned)<br>→ confirmation page, a good fit<br>moved: nothing | Cut only where a family member can cover (Aligned)<br>→ confirmation page, a good fit<br>moved: nothing |
| **Scores** | VCI 83 · VCI_all 88 · Stability 87 (1 step) · Stability_all 87 · performance 55 | VCI 83 · VCI_all 88 · Stability 95 (1 step) · Stability_all 95 · performance 55 |

### Example 5: Flip-flopper (keeps) (pretend person 1 of 2,000)

This person takes a new value in every decision and keeps it, so it shows what each condition's Stability sees in an unsteady person.

| Decision | CVR+APA | APA_Only | Baseline (A) |
|---|---|---|---|
| 1. Six Hours to Clear the District | Carry the respirator to the patient it was kept for, and walk them out (Strongly misaligned)<br>→ reflection; stood by it (strongly)<br>moved: vulnerable +30, gained −20, person speaking −25 · **step** | Carry the respirator to the patient it was kept for, and walk them out (Strongly misaligned)<br>→ APA page: named protecting the vulnerable, sure 5<br>moved: vulnerable +30, harm −10, gained −10, helped −10 · **step** | Carry the respirator to the patient it was kept for, and walk them out (Strongly misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable +30, harm −15, gained −15, helped −15 · **step** |
| 2. Eight Hours Ahead of the Fire | Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>→ reflection; stood by it (strongly)<br>moved: harm −20, gained +30, person speaking −25 · **step** | Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>→ APA page: named how much is gained, sure 5<br>moved: vulnerable −10, harm −10, gained +30, helped −10 · **step** | Leave immediately on the main highway, before the staging starts (Strongly misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable −15, harm −15, gained +30, helped −15 · **step** |
| 3. Limited Cancer Treatment Allocation | Draw the 20 names from the patients who cannot wait (Misaligned)<br>→ reflection; stood by it (strongly)<br>moved: harm +30, helped −20, person speaking −4 · **step** | Draw the 20 names from the patients who cannot wait (Misaligned)<br>→ APA page: named reducing harm, sure 5<br>moved: vulnerable −10, harm +30, gained −10, helped −10 · **step** | Draw the 20 names from the patients who cannot wait (Misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable −10, harm +30, gained −10, helped −10 · **step** |
| 4. The Care Visits You Have to Cut | Shorten every visit so nobody is dropped (Strongly misaligned)<br>→ reflection; stood by it (strongly)<br>moved: harm −20, helped +30 · **step** | Shorten every visit so nobody is dropped (Strongly misaligned)<br>→ APA page: named how many are helped, sure 5<br>moved: vulnerable −10, harm −10, gained −10, helped +30 · **step** | Shorten every visit so nobody is dropped (Strongly misaligned)<br>→ confirmation page: Keep, sure 5<br>moved: vulnerable −9, harm −15, gained −15, helped +30 · **step** |
| **Scores** | VCI 20 · VCI_all 32 · Stability 43 (4 steps) · Stability_all 41 · performance 58 | VCI 20 · VCI_all 26 · Stability 67 (4 steps) · Stability_all 46 · performance 58 | VCI 20 · VCI_all 26 · Stability 62 (4 steps) · Stability_all 44 · performance 58 |

## 1. VCI (the four decisions)

How well the four final choices fit the person's own values. Blind picking gives 50, always the best fit 100.

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | 100 | 100 | none |
| Always weakly aligned | 80 | 80 | 80 | 80 | 80 | 80 | none |
| Top-two mixer | 90 | 90 | 90 | 90 | 90 | 90 | none |
| True to top value | 85 | 85 | 85 | 85 | 85 | 85 | none |
| Corrected by APA | 92 | 91 | 92 | 92 | 91 | 31 | −62 (Baseline (B)) |
| Convert (keeps) | 66 | 66 | 65 | 65 | 67 | 67 | +1 (Baseline (A)) |
| Convert (via APA) | 67 | 67 | 67 | 67 | 68 | 70 | +2 (Baseline (B)) |
| Performance chaser | 76 | 76 | 75 | 75 | 75 | 75 | −1 (APA_Only) |
| Random responder | 57 | 60 | 63 | 57 | 60 | 60 | +7 (APA_Only) |
| Flip-flopper (keeps) | 34 | 34 | 34 | 34 | 34 | 34 | none |
| Flip-flopper (via APA) | 34 | 34 | 34 | 34 | 34 | 34 | none |
| Always the worst fit | 10 | 10 | 10 | 10 | 10 | 10 | none |

**What it shows.**

- **Under principle A, VCI hardly depends on the condition.** The largest change for the same behaviour (the random responder left out) is +1 point (Convert (keeps), Baseline (A)). VCI reads only the final choices, and under A they are the same or nearly the same (the refusing kinds choose again from all the options instead of from the APA list); it also moves a little because each choice is judged on the values the person brought into that scenario, and each condition's rule moved those values differently in the scenarios before.
- **The random responder's VCI is not the same in every condition:** CVR+APA 57, CVR_Only 60, APA_Only 63, APA_Only, random B 57, Baseline (A) 60, Baseline (B) 60. Each page changes what a random person ends with: the APA list offers only options built on the value named, and going back and picking again stops at a good fit but keeps a misfit only half the time. So the "random" line is not 50 in any condition, and not the same line in all four.
- **Principle B shows the size of a real correction effect:** Corrected by APA scores 92 when corrected and 31 when nobody asks them to think again (Baseline (B)). If your pages really correct people, VCI can see it.

**Example.** Example 2 (Corrected by APA): VCI CVR+APA 100, CVR_Only 95, Baseline (A) 95, Baseline (B) 40. In Baseline (B) they kept their tempting pick in all four decisions (see their table above), so every decision was a misfit.

## 1b. VCI_all (all six scenarios)

The same idea over all six scenarios, on the hidden running values that also move after the wish (scenario 5) and the
rule (scenario 6). Scenarios 5 and 6 are the same in every condition (no condition page opens there).

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | 100 | 100 | none |
| Always weakly aligned | 80 | 80 | 80 | 80 | 80 | 80 | none |
| Top-two mixer | 88 | 88 | 88 | 88 | 88 | 88 | none |
| True to top value | 89 | 89 | 89 | 89 | 89 | 89 | none |
| Corrected by APA | 70 | 70 | 70 | 70 | 70 | 31 | −40 (Baseline (B)) |
| Convert (keeps) | 76 | 76 | 76 | 76 | 77 | 77 | +1 (Baseline (A)) |
| Convert (via APA) | 77 | 77 | 77 | 77 | 78 | 78 | +2 (Baseline (B)) |
| Performance chaser | 76 | 76 | 76 | 76 | 76 | 76 | none |
| Random responder | 55 | 56 | 59 | 54 | 56 | 56 | +4 (APA_Only) |
| Flip-flopper (keeps) | 36 | 36 | 36 | 36 | 36 | 36 | none |
| Flip-flopper (via APA) | 36 | 36 | 36 | 36 | 36 | 36 | none |
| Always the worst fit | 15 | 15 | 14 | 14 | 16 | 16 | −1 (APA_Only) |

**What it shows.**

- **The same pattern as VCI.** The largest change for the same behaviour under A is +1 point (Convert (keeps), Baseline (A)). The random responder and Baseline (B) move it for the same reasons as VCI.

**Example.** Example 2 (Corrected by APA): VCI_all CVR+APA 68, CVR_Only 65, Baseline (A) 65, Baseline (B) 28.

## 2. Stability (the four decisions)

Whether the four values stayed the same at the decisions that went against the best fit (100 = they did, or never
tested). Since 2 October 2026 it is the **average of two parts** (the researcher's names): **Value_Order_Stability**,
whether their ORDER changed (pairs that swapped places), and **Value_Difference_Stability**, how far they MOVED there
(100 minus the average points moved). In brackets: the share **not measured** (no decision counted, so 100 means
"never tested").

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | none |
| Always weakly aligned | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | none |
| Top-two mixer | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | 100 (100%) | none |
| True to top value | 92 (38%) | 92 (38%) | 96 (38%) | 96 (38%) | 96 (38%) | 96 (38%) | +4 (APA_Only) |
| Corrected by APA | 84 (0%) | 96 (67%) | 84 (0%) | 84 (0%) | 98 (67%) | 57 (0%) | −28 (Baseline (B)) |
| Convert (keeps) | 67 (0%) | 67 (0%) | 73 (0%) | 73 (0%) | 73 (0%) | 73 (0%) | +6 (APA_Only) |
| Convert (via APA) | 76 (1%) | 70 (1%) | 76 (1%) | 76 (1%) | 75 (1%) | 75 (1%) | −6 (CVR_Only) |
| Performance chaser | 86 (26%) | 86 (26%) | 82 (26%) | 82 (26%) | 82 (26%) | 82 (26%) | −4 (Baseline (A)) |
| Random responder | 71 (2%) | 74 (6%) | 75 (2%) | 74 (2%) | 76 (6%) | 76 (6%) | +5 (Baseline (A)) |
| Flip-flopper (keeps) | 47 (0%) | 47 (0%) | 60 (0%) | 60 (0%) | 56 (0%) | 56 (0%) | +13 (APA_Only) |
| Flip-flopper (via APA) | 60 (0%) | 47 (0%) | 60 (0%) | 60 (0%) | 56 (0%) | 56 (0%) | −13 (CVR_Only) |
| Always the worst fit | 44 (0%) | 44 (0%) | 53 (0%) | 53 (0%) | 47 (0%) | 47 (0%) | +9 (APA_Only) |

### The two parts

**The order part** (Value_Order_Stability; Stability's whole rule until 2 October 2026):

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | 100 | 100 | none |
| Always weakly aligned | 100 | 100 | 100 | 100 | 100 | 100 | none |
| Top-two mixer | 100 | 100 | 100 | 100 | 100 | 100 | none |
| True to top value | 91 | 91 | 99 | 99 | 99 | 99 | +9 (APA_Only) |
| Corrected by APA | 94 | 95 | 94 | 94 | 100 | 35 | −59 (Baseline (B)) |
| Convert (keeps) | 56 | 56 | 71 | 71 | 71 | 71 | +16 (APA_Only) |
| Convert (via APA) | 74 | 60 | 74 | 74 | 74 | 74 | −14 (CVR_Only) |
| Performance chaser | 80 | 80 | 78 | 78 | 78 | 78 | −2 (Baseline (A)) |
| Random responder | 57 | 59 | 67 | 64 | 67 | 67 | +9 (Baseline (A)) |
| Flip-flopper (keeps) | 12 | 12 | 29 | 29 | 25 | 25 | +17 (APA_Only) |
| Flip-flopper (via APA) | 29 | 12 | 29 | 29 | 25 | 25 | −17 (CVR_Only) |
| Always the worst fit | 10 | 10 | 32 | 32 | 24 | 24 | +22 (APA_Only) |

**The difference part** (Value_Difference_Stability):

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | 100 | 100 | none |
| Always weakly aligned | 100 | 100 | 100 | 100 | 100 | 100 | none |
| Top-two mixer | 100 | 100 | 100 | 100 | 100 | 100 | none |
| True to top value | 93 | 93 | 91 | 91 | 91 | 91 | −2 (Baseline (A)) |
| Corrected by APA | 75 | 96 | 75 | 75 | 96 | 78 | +22 (CVR_Only) |
| Convert (keeps) | 78 | 78 | 74 | 74 | 73 | 73 | −5 (Baseline (A)) |
| Convert (via APA) | 77 | 80 | 77 | 77 | 75 | 76 | +3 (CVR_Only) |
| Performance chaser | 93 | 93 | 87 | 87 | 86 | 86 | −6 (Baseline (A)) |
| Random responder | 85 | 87 | 84 | 84 | 84 | 84 | +2 (CVR_Only) |
| Flip-flopper (keeps) | 82 | 82 | 90 | 90 | 87 | 87 | +8 (APA_Only) |
| Flip-flopper (via APA) | 90 | 82 | 90 | 90 | 87 | 87 | −8 (CVR_Only) |
| Always the worst fit | 78 | 78 | 75 | 75 | 68 | 68 | −10 (Baseline (A)) |

**What it shows.**

- **Stability still depends a little on the condition for the same behaviour, less than either part alone.** The largest change under A is +13 points (Corrected by APA, Baseline (A)); the order part alone moves up to +22 points (Always the worst fit, APA_Only), the difference part alone up to +22 points (Corrected by APA, CVR_Only). The reason is the rules, not the people, and the two parts lean opposite ways:
  - **the order part** is higher in APA_Only and Baseline: after the reflection (CVR+APA, CVR_Only) keeping a misfit moves **two** values in opposite directions (+30 to the value the option serves, −20 to the value it gives up most), and both can pass other values; the APA page and Baseline's Keep move **one** value up and the **other three down together** (−10 or −15 each), so the three keep their order and fewer pairs swap;
  - **the difference part** usually leans the other way: keeping a misfit adds up to more points in APA_Only and Baseline (+30 and 3 × −10 or −15, against +30 and −20), so the values end further from where they began. In Baseline (A) it is lower than in CVR+APA for True to top value, Convert (keeps), Convert (via APA), Performance chaser, Flip-flopper (via APA), Always the worst fit, and higher for Corrected by APA, Flip-flopper (keeps) (a new value each time spreads the moves so more of them cancel; a kind that goes back and takes a good fit in Baseline makes no move at all);
  - averaged, the two partly cancel.
- **"Not measured" also depends on the condition:** Corrected by APA is not measured in 0% of people in CVR+APA, but in 67% in CVR_Only and 67% in Baseline (A): going back and taking a good fit is not a Stability step, while a choice confirmed on the APA page always is (your Q2-yes for APA_Only).
- **Principle B:** Corrected by APA keeps a misfit in every decision in Baseline (B), so every decision is a step and Stability falls to 57.

**Example.** Example 1 (Always the worst fit) makes the same four choices in every column, yet Stability is CVR+APA 39 (order 0, difference 78), APA_Only 53 (order 25, difference 80), Baseline (A) 48 (order 25, difference 71). In their table, CVR+APA moves two values at each keep (+30 and −20, so both can cross other values); APA_Only and Baseline raise one value and lower the other three together (−10 or −15 each), so fewer pairs swap and the order part is higher; how far the values end from where they began sets the difference part.
Example 4 (True to top value): Stability CVR+APA 87, Baseline (A) 95. When their #1 value's option is a misfit and they keep it, CVR+APA also lowers the value the option gives up most, which can swap two of their other values; Baseline raises the option's main value (usually their #1, already first) and lowers the other three together, which cannot change the order of those three.

### 2a. Stability steps per person (of 4)

How many of the four decisions counted for Stability. This is what "not measured" is made of.

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | none |
| Always weakly aligned | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | none |
| Top-two mixer | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | none |
| True to top value | 0.81 | 0.81 | 0.81 | 0.81 | 0.78 | 0.78 | −0.03 (Baseline (A)) |
| Corrected by APA | 4.00 | 0.41 | 4.00 | 4.00 | 0.40 | 4.00 | −3.60 (Baseline (A)) |
| Convert (keeps) | 2.00 | 2.00 | 1.99 | 1.99 | 1.90 | 1.90 | −0.09 (Baseline (A)) |
| Convert (via APA) | 1.82 | 1.84 | 1.82 | 1.82 | 1.74 | 1.75 | −0.07 (Baseline (A)) |
| Performance chaser | 1.35 | 1.35 | 1.41 | 1.41 | 1.41 | 1.41 | +0.06 (APA_Only) |
| Random responder | 2.61 | 2.03 | 2.61 | 2.61 | 2.04 | 2.04 | −0.57 (CVR_Only) |
| Flip-flopper (keeps) | 3.48 | 3.48 | 3.48 | 3.48 | 3.50 | 3.50 | +0.02 (Baseline (A)) |
| Flip-flopper (via APA) | 3.48 | 3.48 | 3.48 | 3.48 | 3.50 | 3.50 | +0.02 (Baseline (A)) |
| Always the worst fit | 4.00 | 4.00 | 4.00 | 4.00 | 4.00 | 4.00 | none |

**What it shows.** A step is a decision that ended on a misfit after a page about it (CVR+APA: the reflection ran; APA_Only:
every APA visit; Baseline: a misfit kept on the confirmation page; CVR_Only: a misfit kept after the reflection). Kinds
that refuse and then take a good fit lose their steps in CVR_Only and Baseline (A).

**Example.** Example 2 (Corrected by APA): steps CVR+APA 4, CVR_Only 0, Baseline (A) 0, Baseline (B) 4.

## 2b. Stability_all (all six scenarios)

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | 100 | 100 | 100 | 100 | none |
| Always weakly aligned | 99 | 99 | 99 | 99 | 99 | 99 | none |
| Top-two mixer | 97 | 97 | 97 | 97 | 97 | 97 | none |
| True to top value | 91 | 91 | 95 | 95 | 95 | 95 | +4 (APA_Only) |
| Corrected by APA | 77 | 76 | 77 | 77 | 79 | 48 | −29 (Baseline (B)) |
| Convert (keeps) | 66 | 66 | 73 | 73 | 72 | 72 | +7 (APA_Only) |
| Convert (via APA) | 75 | 69 | 75 | 75 | 75 | 75 | −6 (CVR_Only) |
| Performance chaser | 80 | 80 | 78 | 78 | 78 | 78 | −2 (Baseline (A)) |
| Random responder | 61 | 61 | 66 | 64 | 65 | 65 | +5 (APA_Only) |
| Flip-flopper (keeps) | 41 | 41 | 49 | 49 | 47 | 47 | +7 (APA_Only) |
| Flip-flopper (via APA) | 49 | 41 | 49 | 49 | 47 | 47 | −7 (CVR_Only) |
| Always the worst fit | 40 | 40 | 43 | 43 | 41 | 41 | +4 (APA_Only) |

**What it shows.** Stability's rule over all six scenarios (the wish and the rule count when the final choice was not one
of the two best fits on the running values). Its decisions part is Stability's, so it moves with Stability for the same
reasons; scenarios 5 and 6 add the same steps in every condition.

**Example.** Example 5 (Flip-flopper (keeps)): Stability_all CVR+APA 41, APA_Only 46, Baseline (A) 44 (Stability CVR+APA 43, APA_Only 67, Baseline (A) 62).

## 2c. Top-value choices (of 6; saved, never shown)

In how many of the six scenarios the final choice was the option that does most for the #1 value brought into Block 5.

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 2.71 | 2.71 | 2.71 | 2.71 | 2.71 | 2.71 | none |
| Always weakly aligned | 1.27 | 1.27 | 1.27 | 1.27 | 1.27 | 1.27 | none |
| Top-two mixer | 1.73 | 1.73 | 1.73 | 1.73 | 1.73 | 1.73 | none |
| True to top value | 6.00 | 6.00 | 6.00 | 6.00 | 6.00 | 6.00 | none |
| Corrected by APA | 3.55 | 2.91 | 3.55 | 3.55 | 2.92 | 0.87 | −2.68 (Baseline (B)) |
| Convert (keeps) | 0.78 | 0.78 | 0.78 | 0.78 | 0.78 | 0.78 | none |
| Convert (via APA) | 0.77 | 0.77 | 0.77 | 0.77 | 0.77 | 0.77 | none |
| Performance chaser | 0.49 | 0.49 | 0.49 | 0.49 | 0.49 | 0.49 | none |
| Random responder | 1.19 | 1.16 | 1.26 | 1.22 | 1.16 | 1.16 | +0.07 (APA_Only) |
| Flip-flopper (keeps) | 1.32 | 1.32 | 1.18 | 1.18 | 1.21 | 1.21 | −0.14 (APA_Only) |
| Flip-flopper (via APA) | 1.18 | 1.32 | 1.18 | 1.18 | 1.21 | 1.21 | +0.14 (CVR_Only) |
| Always the worst fit | 1.07 | 1.07 | 0.72 | 0.72 | 0.86 | 0.86 | −0.36 (APA_Only) |

**What it shows.** It counts final choices only, so it changes only where a column changes a final choice: the refusing
kinds (what they choose after going back, or keeping their first pick in Baseline (B)) and the random responder.

**Example.** Example 2 (Corrected by APA): CVR+APA 2, CVR_Only 2, Baseline (A) 2, Baseline (B) 1 of 6.

## 3. Performance at the end of the study

How good the chosen options were inside each decision: 0 = the weakest option every time, 100 = the strongest.

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) | Largest change from CVR+APA |
|---|---|---|---|---|---|---|---|
| Always aligned | 67 | 67 | 67 | 67 | 67 | 67 | none |
| Always weakly aligned | 61 | 61 | 61 | 61 | 61 | 61 | none |
| Top-two mixer | 64 | 64 | 64 | 64 | 64 | 64 | none |
| True to top value | 40 | 40 | 40 | 40 | 40 | 40 | none |
| Corrected by APA | 45 | 49 | 45 | 45 | 49 | 45 | +4 (Baseline (A)) |
| Convert (keeps) | 47 | 47 | 47 | 47 | 47 | 47 | none |
| Convert (via APA) | 46 | 46 | 46 | 46 | 46 | 50 | +4 (Baseline (B)) |
| Performance chaser | 100 | 100 | 100 | 100 | 100 | 100 | none |
| Random responder | 52 | 54 | 53 | 51 | 54 | 54 | +2 (CVR_Only) |
| Flip-flopper (keeps) | 40 | 40 | 41 | 41 | 41 | 41 | none |
| Flip-flopper (via APA) | 41 | 40 | 41 | 41 | 41 | 41 | none |
| Always the worst fit | 28 | 28 | 30 | 30 | 27 | 27 | +2 (APA_Only) |

**What it shows.** Performance reads the final choices only, so under A it changes only for the kinds whose final
choice is made differently: the refusing kinds choose from all the options after going back (CVR_Only, Baseline) instead
of from the APA list, and the random responder. It does not depend on any value-move rule.

**Example.** Example 2 (Corrected by APA): performance CVR+APA 81, CVR_Only 81, Baseline (A) 81, Baseline (B) 53.

## 3b. The stakeholder, directness and context scores

Only the reflection pages move them, so in APA_Only and Baseline they never move and the study saves their stabilities as
"Not measured in this condition". The person-speaking (stakeholder) score's stability, where it is measured:

| Kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) |
|---|---|---|---|---|---|---|
| Always aligned | 100 | 100 | not measured | not measured | not measured | not measured |
| Always weakly aligned | 100 | 100 | not measured | not measured | not measured | not measured |
| Top-two mixer | 100 | 100 | not measured | not measured | not measured | not measured |
| True to top value | 84 | 84 | not measured | not measured | not measured | not measured |
| Corrected by APA | 49 | 48 | not measured | not measured | not measured | not measured |
| Convert (keeps) | 65 | 65 | not measured | not measured | not measured | not measured |
| Convert (via APA) | 67 | 56 | not measured | not measured | not measured | not measured |
| Performance chaser | 76 | 76 | not measured | not measured | not measured | not measured |
| Random responder | 45 | 46 | not measured | not measured | not measured | not measured |
| Flip-flopper (keeps) | 53 | 53 | not measured | not measured | not measured | not measured |
| Flip-flopper (via APA) | 53 | 51 | not measured | not measured | not measured | not measured |
| Always the worst fit | 51 | 51 | not measured | not measured | not measured | not measured |

**What it shows.** These three scores can be compared between CVR+APA and CVR_Only only. In CVR_Only the CVR Rejection
page moves the person-speaking score once per scenario, as the APA page does in CVR+APA.

## 4. Do the scores still tell the kinds apart in every condition?

How often the first kind scores higher than the second when one person of each is picked at random (ties count half).
0.50 is a coin; 1.00 always. Each cell: VCI / Stability.

| First kind | Second kind | CVR+APA | CVR_Only | APA_Only | APA_Only, random B | Baseline (A) | Baseline (B) |
|---|---|---|---|---|---|---|---|
| True to top value | Random responder | 0.92 / 0.87 | 0.89 / 0.82 | 0.87 / 0.94 | 0.92 / 0.94 | 0.90 / 0.90 | 0.90 / 0.90 |
| Always aligned | Random responder | 1.00 / 0.99 | 1.00 / 0.97 | 1.00 / 0.99 | 1.00 / 0.99 | 1.00 / 0.97 | 1.00 / 0.97 |
| Random responder | Flip-flopper (keeps) | 0.86 / 0.89 | 0.89 / 0.89 | 0.92 / 0.80 | 0.86 / 0.78 | 0.89 / 0.84 | 0.89 / 0.84 |
| Convert (keeps) | Flip-flopper (keeps) | 0.94 / 0.84 | 0.94 / 0.84 | 0.95 / 0.78 | 0.95 / 0.78 | 0.97 / 0.82 | 0.97 / 0.82 |
| Corrected by APA | Random responder | 0.96 / 0.77 | 0.94 / 0.89 | 0.94 / 0.72 | 0.96 / 0.75 | 0.95 / 0.94 | 0.08 / 0.18 |
| Random responder | Always the worst fit | 1.00 / 0.92 | 1.00 / 0.92 | 1.00 / 0.87 | 1.00 / 0.85 | 1.00 / 0.93 | 1.00 / 0.93 |

**What it shows.**

- **VCI separates a value-follower from a random person in every condition** (True to top value over Random responder: 0.87 to 0.92).
- **Stability separates them by different amounts in different conditions** (True to top value over Random responder: CVR+APA 0.87, CVR_Only 0.82, APA_Only 0.94, APA_Only, random B 0.94, Baseline (A) 0.90, Baseline (B) 0.90), because each condition's rule moves the values differently (section 2). Compare Stability between kinds inside one condition; between conditions, read section 2 first.
- **Corrected by APA against the random responder** shows principle B again: Baseline (A) 0.95, Baseline (B) 0.08 on VCI.

## 5. What is the same in every condition

- **Card order** (main page, section 5) and **the position check** (section 6): the planner orders the cards from the
  values brought into Block 5, and Blocks 1-4 are the same in all four conditions.
- **The prediction in scenario 6** (section 7): its favourite is always the best fit on the values at that moment; how
  SURE it is uses VCI and Stability, so it follows the changes above.

## 6. What this means for comparing the conditions

1. **VCI, VCI_all, performance and the top-value choices are fair rulers between conditions** for the same behaviour: under principle A they move at most 1 point (VCI), 1 (VCI_all), 4 (performance) and 0.64 of 6 (top-value choices, Corrected by APA, who chooses again from all the options after going back). A difference between conditions in these scores comes from what people chose.
2. **Stability is still not a perfectly fair ruler between conditions:** the same behaviour can score up to 13 points apart in two conditions (Corrected by APA: CVR+APA 84, Baseline (A) 98), from the value-move rules alone (each part alone: up to 22 and 22). Compare Stability inside a condition, or between conditions against the gaps in section 2.
3. **The "random" line is different in each condition** (section 1): the pages themselves help a random person a little, by
   different amounts.
4. **Principle B shows what a real correction effect looks like:** when the refusing kinds are not corrected, VCI falls by about 61 points for Corrected by APA. The study can see an effect of that size.

## 7. Stability's level edges, derived again

Each of the five words keeps today's meaning: a pretend participant sitting exactly on today's edge (no swap but tested,
one, three, five swaps) is put on the new combined score, and the edge is where such people typically land (the
median, over the four conditions). The command stops if an edge here is more than one point from the code's.

| Level from | Today's edge | People exactly on it | Typical combined Stability | Typical Stability_all | The code's edge |
|---|---|---|---|---|---|
| Held steady | 0 swaps (tested) = 100 | 10093 | 94 | 94 | **94** |
| Mostly steady | 1 swap = 83 | 8807 | 85 | 85 | **85** |
| Shifted a little | 3 swaps = 50 | 7480 | 63 | 63 | **63** |
| Shifted a lot | 5 swaps = 17 | 3951 | 49 | 48 | **49** |

All kinds and the four conditions together, the share in each level: Stability Held steady 39% · Mostly steady 12% · Shifted a little 23% · Shifted a lot 12% · Changed substantially 14%; Stability_all Held steady 33% · Mostly steady 10% · Shifted a little 23% · Shifted a lot 10% · Changed substantially 25%.

