# Fresh-eye audit of VRDS Experiment 2

Started 24 September 2026 by Claude (Opus 5.5), at Waseem's request, as a reader who had never seen
the study before. **This file is my working memory.** It holds every problem I found, why it is a
problem, the evidence, what I suggest, and where each fix stands. Update it after every fix.

## How we work (agreed with Waseem, 24 September 2026)

1. One problem at a time.
2. I write a full plan for the fix. Waseem reads it. **Nothing is implemented until he approves.**
3. I implement, run the full check chain, update this file, commit, and push to
   `Dev-Prod-branch-Edit_9_23`. Waseem has said to keep committing and pushing until he says stop.
4. Waseem's first language is not English: write to him in simple words, with small examples.
5. The goal is a study that is **strong, solid and defensible** in a thesis.

Check chain before every commit (from CLAUDE.md):

```
npm run typecheck && npm run lint && npm run validate:block5 && npm run build
```

`validate:block5` must print `ALL TESTS PASS`, `ALL APA CHECKS PASS` and `ALL DATABASE GATES PASSED`.
`validate:position` fails on purpose (2.8x against a 3x gate) and runs last.

**Uncommitted work found on 24 September 2026, not mine.** When this audit started, eight files had
changes from an earlier session (dates 24 → 23 September, the "Has a cost" tag removed,
`profile_by_scenario` + gate D51 added), plus the untracked audit request. At Waseem's request I
reviewed it, ran the full chain (all green except the intentional position gate), and committed it
as found in `60db800`. Findings from that review: A7, and the note on `MCF_VERSION` in the log.

## How the evidence was measured

I compiled the real scoring modules into a scratch folder, never into the repo:

```
npx tsc -p tools/tsconfig.sim.json --outDir <scratch>/sim
echo {"type":"commonjs"} > <scratch>/sim/package.json
```

Then small scripts `require()`d the compiled `block5CVR.js`, `block5Planner.js`,
`block5Thresholds.js` and `block5Scenarios.js`. Nothing re-implemented the math. The scripts were
temporary; each finding below says what was run so it can be rebuilt. Simulated participants
followed `tools/planner_vs_weighting.cjs` (random order of the four values, scores 20-100), and
where noted, thresholds came from the REAL `deriveDecisionProfile` fed random ladder answers
(Block 3 cells 0-6, trolley 0-8).

## Status board

| ID | Problem (short) | Severity | Status |
|---|---|---|---|
| A1 | Open cards print the fit score out of 100 | Critical | **Deferred to before launch** (Fix 1) |
| A2 | Card text reveals the participant's #1 value | High | **Deferred to before launch** (Fix 1) |
| A3 | The order is presented as a judgment, so "position" is really "recommendation" | High | Open |
| A4 | Reflection pages show the participant's value numbers | Medium, decision | Open |
| A5 | Compare chart draws the participant's values over the options | Low, note | Open |
| A6 | CLAUDE.md says no verdict or arithmetic is shown; not true | High (docs) | **Deferred to before launch** (Fix 1) |
| A7 | The "Has a cost" removal (24 Sept) is not yet dated in CLAUDE.md / HOW_TO_ANALYZE | Medium (docs) | Open |
| B1 | Keep rule lowers the wrong value, or nothing | Critical | Open |
| B2 | Picking your best fit can lower your #1 value | Critical | Open |
| B3 | Step sizes (30/15/20/10/25) are hand-picked | High | Open |
| B4 | "Zero-sum" APA move is not zero-sum at the floor | Low | Open |
| B5 | A move cut off at 0 or 100 is not recorded | High | Open |
| B6 | Difference scores put consistent people at 0 | Critical, upstream | Open, decision |
| B7 | Only four scenarios can move the profile | Medium (framing) | Open |
| B8 | The audit-request document describes Route 3 wrongly | Medium (docs) | Open |
| C1 | The first card is almost always "champion of your #1 value" | High (honesty) | Open |
| C2 | "Every threshold comes from the participant" is false | High | Open |
| C3 | Step 1's floor and Step 2's noise band are one number with two meanings | Medium | Open (was "contradiction"; reclassified) |
| C4 | Appendix B numbers depend on invented people | Medium | Open |
| C5 | "No tuning constants" claim | Low (docs) | Open |
| C6 | Win counting is Copeland; loops almost never happen | Low (docs) | Open |
| C7 | Ties and near-ties in the participant's own ranking decide the whole order | Medium | Open |
| C8 | The noise band cannot be personal; `strictness` is computed and never used | High | Open |
| C9 | The planner's inputs are not stored, and there is no planner version | High | Open |
| D1 | Option numbers disagree with the option's own words | Critical | Open |
| D2 | "Reducing harm" and "gain" mean different things per scenario | Critical | Open |
| D3 | Fast "yes" clicking produces a strong gain-first profile | High | Open |
| E1 | A refusal becomes a zero; the never-harm refuser scores 0/0/0/0 and every option fits 100 | Critical | Proposed (calc idea 1) |
| E2 | One wobble of one step can make a value #1 | High | Proposed (calc idea 2) |
| E3 | Some values can never reach 100 (helped 99, directness 97, context 93) | Medium | Proposed (calc idea 3) |
| E4 | Tied values are broken by source-code order, which always favors "vulnerable" | High | Proposed (calc idea 4) |
| E5 | No response-style flag, though every click is timestamped | Medium | Proposed (calc idea 5) |
| E6 | Block 3's prices could give a real vulnerable-vs-harm exchange rate | Low, idea | Proposed (calc idea 6) |
| E7 | Participant values are differences; option values are levels | Critical, design | For discussion |

---

## Group A: what participants see while they are still choosing

### A1. Open cards print the fit score. CRITICAL.

**What.** Every option card, once opened, has a "Ranked N — why" panel. Its values section ends with
`Matches your earlier answers: {option.matchScore} out of 100.`
(`Block5PublicEmergencySimulation.tsx` ~line 3181). `matchScore` is the alignment score
(100 − weighted shortfall) on the LIVE profile, the same number VCI grades.

It shows in scenarios 1-5 (`showPerformance` is false only in scenario 6). The panel is in the
open card, not behind "details". Cards start folded and must be opened to be read, and opening is
**not logged** ("Unfolding is deliberately not logged", CLAUDE.md). So nearly every participant
sees the number, and the data cannot tell who did.

The scenario page even points to it (~line 2766): "How well it matches your values ... You will
find that inside an open card, on the line that reads 'Matches your earlier answers'."

**Why it is a problem.**
- The planner exists so that "picked the first card" and "picked the best fit" are different
  events. If the fit is printed, a participant can pick the biggest number. VCI then measures
  "followed the printed number", not "acted on their values".
- CLAUDE.md: participants are never shown an alignment verdict or the arithmetic. This is both.
- The code already accepts the argument for scenario 6: showing the fit score "would be marking the
  participant's answer before they had given it" (comment above the panel, ~line 3108).
- It puts the two-ruler problem on screen: "Ranked 1" (frozen profile) next to a smaller "Matches"
  number than a lower card (live profile). In scenario 1 that happens whenever the first card is
  not the best fit, which is about half the time.

**Suggestion.** Remove the line and the pointer sentence. Keep computing and storing `matchScore`.
Stamp a screen version on every scenario result, so records made before and after the change are
never pooled (records with no stamp = saw the number).

**DEFERRED (Waseem, 24 September 2026).** He uses this information himself while developing, and
will ask for Fix 1 before the study goes to real participants. The full Fix 1 plan (keep/remove
table per panel line, screen-version stamp, source + `dist/` guard, docs) was written on 24
September and is summarized under "Fix 1 plan" below. **Idea to offer then:** keep every developer
line, but render it only when `import.meta.env.DEV` is true, exactly like `DevResetButton`. The
developer keeps the information, participants never see it, and `dist/` can be checked for the
strings after every build.

### A2. The card text reveals the participant's #1 value. HIGH.

**What.** In the same panel:
- `breachLine` on a costed option: "...sits at the bottom of this scenario's range on X, **the value
  you ranked first**" (`block5PlannerText.ts:201`).
- `decidedLine`: "Most often decided on X." On the first card this is nearly always the #1 value
  (see C1).
- `tradeLine`: "This ranks above Y even though that option is slightly better on X [the #1 value] ...
  the gap on Z [the #2 value] is about N times larger." It names the top two values and the
  planner's reasoning.

**Why.** On 16 September the advisor had the panel's printed value ranking removed, because a person
who reads their own ranking and then picks to match it "has been told the answer". These lines put
the same information back, one card at a time.

**Suggestion.** Remove the costed `breachLine`, `decidedLine` and `tradeLine` from what renders.
Keep the blocked `breachLine` ("Crosses a limit you set"); it is deliberate, because crossing a
stated limit is only measurable if the person can see it. Keep the functions and their test output
for the methods write-up.

### A3. The order is presented as a judgment. HIGH.

**What.** The panel note says: "These are ordered using the preferences shown by your earlier
answers, not by which one we think is best." Each card says "Ranked N — why", "What it does for your
values", "Beat 4 of the other 5 options."

**Why.** A participant reads "ranked 1, using my own preferences" as "the system thinks this fits me
best". The position effect Block 5 measures is then the effect of **a system recommendation**, not of
where a card sits on the page. That is a legitimate thing to study, but it is a different claim, and
the thesis must name it correctly. It also sharpens the frozen-ruler confusion (C-side), because the
"ranking from your preferences" was made on the frozen profile.

**Suggestion.** Decide which claim the study makes:
(a) a pure position effect: show the order without reasons ("Ranked N — why" goes, the numbers stay
or become plain list positions); or
(b) a recommendation effect: keep the framing, and rename the measure everywhere.
Discuss with Waseem after Fix 1.

### A4. Reflection pages show the participant's value numbers. MEDIUM, a design decision.

**What.** The CVR "confirm keeping" question says "...gives up Y, **which you rated N out of 100**"
(~line 4450). The APA page says "this option **missed by N points**" (~line 5055).

**Why.** Both come after a misaligned choice and are part of a designed confrontation, so they are not
the same case as A1. But they teach the participant their own numbers mid-block, and that can shape
scenarios 2-4. CLAUDE.md's rule covers "the scoring arithmetic", and "missed by 34 points" is
arithmetic.

**Suggestion.** Keep for now. Record it as a declared exposure in the methods. Revisit after A1-A3.

### A5. The Compare overlay draws the participant's own four values. LOW, a note.

**What.** Chart 2 overlays a dashed "your values" series on the option shapes. Its own comment calls
it "literally a picture of the alignment computation". MCF sits under it.

**Why acceptable.** It is behind a deliberate act (open the overlay), and opening is logged
(`compare_overlay_opens`, `analysis.mcf.was_read`). An exposure that is chosen and recorded can be
analyzed. **Analyses of VCI must split by compare-overlay use.** Put that in HOW_TO_ANALYZE.

### A6. The documentation says no verdict is shown. HIGH (docs).

CLAUDE.md ("Participants are never shown an alignment verdict ... or the scoring arithmetic") and
the feedback schema note ("labels are no longer shown") are not true while A1 stands. Fix with A1.

### A7. The "Has a cost" removal is not dated where analysts look. MEDIUM (docs).

Commit `60db800` (work found uncommitted, 24 September) removed the "Has a cost" tag and the
divider "These cost you something on the value you ranked first" from costed cards. That is a
change to what participants see, of the same kind CLAUDE.md dates ("Option cards start folded,
since 23 September"). Records before 24 September saw both. Add a dated line to CLAUDE.md and
HOW_TO_ANALYZE so no one pools across it for costed-card choices.

### Fix 1 plan (written 24 September, deferred)

Remove from the open-card panel in scenarios 1-5: the fit line, `decidedLine`, `tradeLine`, and the
costed `breachLine`. Keep `winsLine`, `referenceLine`, the blocked `breachLine` and its label, and
the performance section. Replace the scenario-page pointer sentence with "All of this is outcome
quality — how well an option works. It does not tell you how well an option fits your values."
Keep `explainOption` producing every line, and change only what renders. Stamp
`screen_version = "…-no-fit-on-cards"` on every scenario result, add a dbshape gate, a source guard
in `test:planner`, and a `dist/` string check. Document in CLAUDE.md and HOW_TO_READ. Consider
the DEV-only variant above.

---

## Group B: how the four values move

The code has three live routes (`block5CVR.ts`):
- **Route 1, `applyEndorsementUpdates`.** Misaligned pick, reflection runs, the person keeps it.
  +30/+15 to the option's main value, −20/−10 to `violatedValue`, stakeholder ±25.
- **Route 2, `applyApaUpdates`.** The person changes their mind in APA. +30w to the named value,
  −10w to each other value, w = 0.6-1.0 from confidence, capped at 30w net.
- **Route 3, `applyKeepUpdates`.** The person picks their #1 or #2 fit, so **no reflection runs**.
  Aligned +15/−10, weakly aligned +20/−15.

### B1. The keep rule lowers the wrong value, or nothing at all. CRITICAL (a bug).

**What.** Route 3 picks the value to lower with `displacedTopValue` (`block5CVR.ts:775`): "your
highest-scoring value that the option misses by more than 5". If that is the same value it just
raised, the guard `neglected !== kept` skips the decrement. It never looks at the next value, even
when the option misses that one badly.

**Evidence: Waseem's own test run, replayed exactly.** Profile at scenario 3 was vulnerable 0,
harm 0, gain 100, helped 80. The only choice that reproduces his table is "Treat the 20 with the
most years ahead" (weakly aligned; gain 92, helped 43).
- +20 to gain → lost at the ceiling (100).
- `displacedTopValue` → gain (92 < 95) = the kept value → −15 skipped.
- Helped (43 against 80, a weighted shortfall of about 30) is never touched.
- Net movement 0.

Scenario 4 is the same with "Keep the town routes that pay" (gain 93, helped 45).

Route 1 had exactly this bug and it was fixed by switching to `violatedValue` (see the comment at
`block5CVR.ts:503-525`, which even uses gain 100 / helped 99). Route 3 was never switched.

Measured over 4,000 simulated profiles × scenarios 1-4 × the two keep-route options: in 8.2% of keep
updates nothing is lowered although the option misses a value by more than 20 (scores 20-100).

**Suggestion.** Lower `violatedValue` (the largest importance-weighted shortfall), skipping only
when it equals the raised value, then taking the next one. That is the same rule as Route 1, so the
two routes read as one. Better still, fold this into B2's redesign.

### B2. Picking your best fit can lower your #1 value. CRITICAL (a design flaw).

**What.** Route 3 raises `optionMainValue(option)`, the option's highest fingerprint number, chosen
from the option alone. It lowers a value the option falls short on, also judged from the option
alone. Neither step asks what else was on the table.

**Evidence: the test run, scenario 1.** Profile gain 100, helped 99. The pick was "Drive out on the
industrial service road", labeled Aligned, which the study itself calls the best fit. The rule gave
helped +15 (the option's main value is helped, 87) and gain −10 (80 < 100). Gain went 100 → 90 and
the #1 and #2 values **swapped**. Scenario 2 then swapped them back.

Measured (same simulation as B1): **32.3% of Aligned picks lowered the participant's #1 value**
(18.3% when 30% of values sit at 0).

**Why it is wrong.** An Aligned pick is the model's own best guess coming true. It should confirm
the profile, not reorder it. Every option falls short somewhere; choosing the best one available is
not evidence that you care less about what it lacks. Example for Waseem: no chocolate ice cream in
the shop, you take vanilla, and that does not mean you like chocolate less. Stability does not count
keep steps, but the next scenario's labels (and so VCI) are computed on the moved profile.

**Suggestion (a real redesign, needs its own plan).** Update from the **comparison**: what the
chosen option beat, and what beat it.
- If the pick is what the model predicted, move little.
- If it surprises the model, move more, toward the values on which the chosen option beat the ones
  above it in fit.

This is the logic of an Elo rating. The scenario-6 MPF already has a probability model
(`block5Prediction.ts`) that could supply "how surprising was this pick". Minimum version: an
Aligned pick moves nothing, or only reinforces a value the option leads on *and* the participant
already holds in their top two.

### B3. The step sizes are hand-picked. HIGH (defensibility).

**What.** 30/15/20/10 and the stakeholder ±25 have no derivation (the code says so for ±25 at
`block5CVR.ts:605`).

**Suggestion.**
1. Declare them as design parameters in the methods.
2. Build a sensitivity tool: re-run VCI, Stability and the position effect with every step ×0.5 and
   ×2, and show the conclusions hold. `tools/apa_context_variants.cjs` is a start.
3. Freeze them before real data (pre-registration).

If B2's redesign happens, reduce the many constants to one learning rate.

### B4. The "zero-sum" APA move is not zero-sum at the floor. LOW.

**What.** +30 to the named value and −10 × 3 is zero-sum only if no value is at 0. Example: profile
0/0/100/80, name "reducing harm", w = 1. Vulnerable cannot drop below 0, so the total goes up by 10.

**Thought.** Zero-sum is the right spirit: choices reveal which value beats which, not overall
intensity. The natural form is shares that sum to 1 (a pizza cut four ways). Fix the claim in the
docs now; consider shares only if B2's redesign happens.

### B5. A move cut off at 0 or 100 is not recorded. HIGH.

**What.** `bump()` clamps silently. `dbShape.ts` has no field for "asked for +20, got +0". The code's
own notes: about 13% of values end a run exactly at 0 or 100, and 11.9% sit at 100 after an APA
clarification.

**Why.** "Did not move" and "could not move" look the same, so Stability and movement analyses mix a
measurement artefact with behavior.

**Suggestion.** Record every bump as `{value, requested, applied}` on the scenario result, surface it
in `analysis` (for example `moves_cut_off_by_the_ceiling_or_floor`), and add a dbshape gate. Report
Stability separately for values at an edge.

### B6. Difference scores put consistent people at 0. CRITICAL, upstream (Blocks 1-4 are "frozen").

**What.**
- "Reducing harm" is `max(0, size slope) / 6`: did you ask for more money as more workers were
  hurt?
- The Block 3 part of "protecting the vulnerable" is `max(0, avgLB − avgHB) / 6`.

Anyone who gives the **same** answer in every cell scores 0. That includes the fast yes-clicker
**and** the person who refuses to hurt workers at any price. In `sensitivityCalibration.ts:106`,
55.2% of all possible answer patterns score raw 0 on group size (calibrated 0), and the next
possible calibrated score is 55. So "reducing harm" is close to a two-value variable.

A value at 0 is **invisible** to the fit score, because the penalty weight is u/100 = 0. The planner
sees a refuser (a red line), but the fit score and every movement rule see a 0.

**Why.** The kindest possible answer pattern ("never, at any price") gets "Reducing harm: 0". Waseem
guessed real participants would be less extreme than his test run. I think the opposite: many will
sit at 0.

**Suggestion (Waseem's decision).**
- Option 1: when the person refused every cell, treat the value as maximal, not 0.
- Option 2: use level + difference.
- Option 3 (minimum): flag and report these participants separately.

This changes Blocks 1-4 scoring and the calibration tables, so it is its own plan.

### B7. Only four scenarios can move the profile. MEDIUM (framing).

Scenario 5 is a wish and scenario 6 is a test, so movement comes from at most four steps.
Stability then has few possible values per person. Frame movement results at group level
(compare conditions), not as a description of one person. Docs only.

### B8. The audit-request document describes Route 3 wrongly. MEDIUM (docs).

`Generated Outputs/PLANNER_AND_VALUE_MOVEMENT_AUDIT_REQUEST.md` says Route 3 is "they keep their
answer after seeing a different view", with Misaligned 0/0. In the code, Route 3 runs only for the
#1/#2 fit with no reflection. A misaligned pick in scenarios 1-4 **always** opens the reflection
(`Block5PublicEmergencySimulation.tsx:1049`) and, if kept, goes through Route 1. The 0/0 rows are
reached only in scenarios 5 and 6, where nothing moves anyway. Waseem's worry #2 ("a misaligned
keeper records nothing") is not real. Correct the document.

---

## Group C: the planner (card order)

### C1. The first card is almost always "the champion of your #1 value". HIGH (honesty).

**Evidence.** 3,000 simulated people per scenario, real `plannerRank`, compared with a plain sort
(same bins, then lexicographic on the person's value order):

| Scenario | Same first card | Pairs where Step 3 fired |
|---|---|---|
| Six Hours | 92.9% | 14.1% |
| Eight Hours | 100% | 12.2% |
| Cancer | 100% | 12.0% |
| Care Visits | 100% | 11.1% |

The whole order was identical in 42-58% of cases, so Step 3 does reorder the lower cards. It
almost never changes card 1.

**Re-tested 24 September on three populations**, because Step 3's exchange rate depends on how
consistently a person answered Block 3. The result holds: the first card matched the plain sort
91.7-100% of the time with random ladder answers, with "consistent people" (base rung ± small
noise, small LB and size offsets), and with the Appendix B archetypes.

One knife-edge worth knowing. In the wildfire scenario, the highway option against the ridge road
on gain is 0.1644 of the range, just under the 1/6 band. With exchange 2 and vulnerable second,
Step 3 fires by a margin of 0.0003. A one-point edit to either option would flip it.

**Why.** Each scenario was authored with one champion per value, far ahead of the rest (for example
vulnerable 97 against 62), so Step 2 always says "the gap is real". The P-against-Q example
(100 vs 92) never occurs at the top.

**Suggestion.** Describe the planner honestly: "the first card is the option strongest on your #1
value; below it, a tie rule can let a large gap on your #2 value override a small gap on your #1."
That is simple and defensible. Update `docs/BLOCK5_PLANNER_ORDERING_PLAN.md`, the methods text and
the audit request.

### C2. "Every threshold comes from the participant" is false. HIGH.

**What.**
- **Tolerance is a constant**: 1/6 for vulnerable, harm and gain, 1/8 for helped, for everyone.
  Every call is `toleranceFromInterval(1, …)` (`block5Thresholds.ts:242, 272, 312, 343`); the
  comment about a per-participant interval is not implemented.
- **The floor is a constant**: the bottom 1/6 of the scenario's own range.
- **Unit mismatch**: a ladder rung is roughly a 10× money jump, but it is applied to 1/6 of a
  scenario's option-score range. Not noticing $10k against $100k says nothing about 60 against 72
  on an option card.
- **Wrong exchange rate in Step 3**: `tTop.exchange` is the top value's own money premium (for
  vulnerable, LB − HB rungs). Step 3 needs "how much of value #2 for one unit of value #1", which no
  block asks.

Only `hasRedLine` and `exchange` are personal.

**Suggestion.** Either (a) say this honestly (one fixed tolerance, a documented reading of the
exchange), or (b) drop Step 3 and ship the plain lexicographic order, which is what card 1 already
is. My lean is (a) plus C1's honest description, because CLAUDE.md says the planner is settled and
its lower-card behavior is part of the position data. Waseem decides.

### C3. Step 1's floor and Step 2's noise band are one number with two meanings. MEDIUM.

**First reading (24 September, morning).** Step 1 trusts a gap that Step 2 calls invisible: both
options below the floor means their gap is under the tolerance, yet the #1 value still decides.

**Corrected reading, after reading LEAP §3.1 in docs/BLOCK5_PLANNER_ORDERING_PLAN.md §4d.** Step 1
is LEAP's `A(+)` node, an aspiration level: the swap in Step 3 is meant for two options that are
both good enough on the #1 value, and an option in the bottom band of the #1 value is exactly the
one the costed bin already demotes. So Step 1 says "options that fail your #1 floor cannot be
rescued by your #2 value", which is coherent and consistent with the bins.

**What is really wrong** is that the floor (an aspiration level) and the notice band (a
discrimination limit) are the same variable, `tolerance`, so the code reads as a contradiction.
Fix: two named constants, explained separately, even if both are 1/6.

### C4. Appendix B numbers depend on invented people. MEDIUM.

`tools/planner_vs_weighting.cjs` uses three invented archetypes (tolerances 1/8 or 1/6, invented
exchanges and red lines) and scores drawn from 20-100 (real profiles have many 0s, see B6). With
the REAL `deriveDecisionProfile` and random ladder answers, first card = best fit came out at
37-43% (against 43-55% in Appendix B). The 50% line is arbitrary and a 5-point gap means nothing.
Say "far above chance (16.7%), far below always (100%)" and measure on pilot data.

### C5. The "no tuning constants" claim. LOW (docs).

The soft floor applies to the #1 value only because covering the top two "demoted roughly a third
of all cards" (`block5Planner.ts:258`). That is a choice made by looking at the outcome. Fine to
do; wrong to claim otherwise.

### C6. Win counting is the Copeland method; loops almost never happen. LOW (docs).

A>B>C>A loops in 0-0.6% of simulated people, and tied win counts in 0-0.6%. So counting wins and
sorting give the same list almost always; the non-transitivity argument is true but rarely matters.
Cite: Copeland method; Tversky (1969), *Intransitivity of preferences*, for the lexicographic
semiorder; the Kemeny ranking if loops ever matter.

**The frozen ruler itself is defensible** (one seating chart for the whole exam). The confusion
comes from A1-A3 putting both rulers on screen in the language of "your values".

### C7. Ties and near-ties in the participant's own ranking decide the whole order. MEDIUM.

**What.** The planner's value order is the rank from `thresholdTree.ts`: a stable sort on the
calibrated score. So:
- **Exact ties** are broken by the order the dimensions happen to be listed in the source
  (vulnerability, group size, gain, outcome, …). A participant with vulnerable 0 and harm 0 is
  treated as "vulnerable #3, harm #4" for no reason about them.
- **Near-ties** count fully. Waseem's test run had gain 100 and helped 99. That one point made gain
  #1, and card 1 is the gain champion. Worse, the one point comes from the calibration tables: the
  highest attainable helped score maps to 98.8 (the "strictly exceeds" convention in
  `sensitivityCalibration.ts`), while gain's maps to 100. A yes-clicker is gain-first because of a
  table convention.

**Why it matters.** The planner applies a noise band to option differences but none to the
person's own ranking, which drives everything else.

**Suggestion.** Minimum: record the gap between the planner's #1 and #2 values on every result
(`plannerTopTwoGap`) and say in the methods how ties are broken. Better, later: when #1 and #2 are
within a stated margin, count wins under both orders and add them. That changes the upstream
ranking's meaning, so it needs its own decision.

### C8. The noise band cannot be personal; `strictness` is computed and never used. HIGH.

**What.**
- The original plan (§4b) made tolerance personal through Block 3's carry-forward start rung
  (`startedAtGainIndex`). Block 3 was later changed so **every cell restarts at the lowest rung**
  (`AIWorkforceThresholdBlock.tsx` ~line 445, "CURRENT — restart the gain ladder at the lowest
  option"). Every interval is now one rung, so tolerance is 1/6 (or 1/8 for helped) for everyone,
  and it can never be personal with the current instruments.
- `ValueThreshold.strictness` is computed for all four values, and its comment says "Used for the
  soft Bin-B floor". **Nothing reads it.** The soft floor uses `tolerance`.
- The comments in `block5Thresholds.ts` (`toleranceFromInterval`: "Block 3 carries a start index
  forward … genuinely per-participant") and plan §4b describe a mechanism that no longer exists.
- The helped band is 1/8 only because the trolley ladder has 8 rungs. In option space, that is an
  accident of the instrument, not a property of the options.

**Suggestion.** Make it one named design constant for all four values, say so, and test
sensitivity (1/8, 1/6, 1/4). Remove `strictness`, or mark it unused. Fix the comments and the plan.

### C9. The planner's inputs are not stored, and there is no planner version. HIGH.

**What.** Each scenario result stores `plannerOrder`, `plannerBins`, `plannerWins`,
`plannerValueOrder` and `plannerDegradedProfile`. Nothing stores the red lines, tolerance or
exchange rates the tree used, and there is no `PLANNER_VERSION`. `PREDICTION_VERSION` and
`MCF_VERSION` exist for exactly this reason.

**Why.** Any change to the planner (including the one now planned) silently mixes two orderings in
the data, and no reviewer can check why a card landed where it did.

**Suggestion.** Add `PLANNER_VERSION` and a compact `plannerInputs` record (value order, top-two gap,
red lines, notice band, floor band, trade rate) to every scenario result. Surface both in the
database via dbShape with a gate. Records without a version = the original planner.

---

## Group D: option content (the numbers on each option)

### D1. Option numbers disagree with the option's own words. CRITICAL.

| Scenario | Option | Number | What the card says |
|---|---|---|---|
| Care Visits | Keep the town routes that pay, drop the rural ones | harm 55 (3rd highest) | 45 rural clients lose everything, "most of them have nobody else" |
| Care Visits | Redraw the routes to cut the driving | harm 47 (2nd lowest) | 300 of 400 hours come from driving, "most visits survive at full length" |
| Wildfire | Fill every seat with neighbors | harm 50 | Below "take your assigned place" (59), yet it saves 3 people and takes no one's place |
| Wildfire | Leave immediately on the main highway | vulnerable 44 | Traps the farthest blocks, where the walker residents live (option 3's text); the ridge road gets 18 |
| Wildfire | Walk to the concrete school | harm 94 (highest) | Puts your children (one on an inhaler) and your mother in the fire's path; a crew must come back |
| Cancer | Draw names from those who cannot wait | harm 94 (highest) | "fewer of the 20 come through than under the rule that ranks by odds" |
| Cancer | Treat the 20 most likely to survive | harm 48 | Saves the most lives |
| Cancer | Hold some doses back | harm 64 (2nd highest) | "Fewer than 20 patients may be treated", expired doses help nobody |

Also scenario 1: "Drive out on the industrial service road" has helped 87 but harm 25, and the card
never says who is harmed.

### D2. The values mean different things in different scenarios. CRITICAL.

- **"Reducing harm"**: "take nothing from others" (scenarios 1-2), "nobody loses their last chance"
  (3), "the cost lands on those who can carry it" (4).
- **"How much is gained"**: your own safety (1-2), life-years (3), company money (4).

But the participant's scores each come from one instrument. Reducing harm is Block 3's size slope;
gain is Block 3's money level (how readily money moves you to approve harm). The fit score compares
the two, so the construct has to be the same on both sides.

**Suggestion.** Write one operational definition per value that holds in every scenario, tied to
what Blocks 1-3 measure. Have 2-3 independent raters score every option blind, report agreement
(for example ICC), and re-author the options where the raters and the words disagree. I can prepare
a rating sheet (options without numbers, the definitions, a form). CLAUDE.md warns: do not change an
option's numbers to make the position gate pass. This is a content-validity fix, which is a
different reason, but it moves the position numbers, so re-run everything afterwards.

### D3. Fast "yes" clicking produces a strong gain-first profile. HIGH.

Accepting at the first rung everywhere gives:
- gain raw 1.0 → 100
- trolley lever = bridge = 0 → helped 99
- no Block 3 differences → vulnerable 0, harm 0
- no Block 1 shelter contrast → vulnerable 0

That is exactly Waseem's test-run profile (0/0/100/99). A response style is scored as a specific
moral position: gain first, helped second.

**Suggestion.** Add a data-quality flag: all-first-rung answering, per-page time under a floor.
Report those participants separately; consider an attention check in Blocks 1-3.

---

## Group E: the Blocks 1-4 calculations that feed the planner (added 24 September)

Waseem's constraint: **keep every Blocks 1-4 question and screen exactly as it is.** Only the
calculations may change. The inter-block pages that show the profile are hidden
(`SHOW_INTER_BLOCK_PAGES = false`), so changing the calculations changes nothing a participant sees.

**Method.** The real chain (`deriveMoralProfile` → `buildThresholdTree` → `extractBlock5Profile` →
`deriveDecisionProfile` / `labelOptions`) was compiled into the scratchpad with
`npx tsc --outDir <scratch>/tree --module commonjs … src/experiment/thresholdTree.ts
block5Profile.ts block5Thresholds.ts block5CVR.ts block5Planner.ts block5Scenarios.ts`, then fed
hand-built answer patterns. The prototypes of the proposals were written as separate scratch
formulas, with fresh null tables (100,000 uniform random answer patterns). They are prototypes,
not the code.

**Today, through the real code:**

| Person (answer pattern) | vulnerable / harm / gain / helped | Planner order | Scenario 1 fit |
|---|---|---|---|
| 1 Fast yes-clicker (first rung everywhere) | 0 / 0 / 100 / 99 | gain > helped | 68 / 31 / 27 … |
| 2 Never-harm refuser (never keeps, never acts, never approves) | **0 / 0 / 0 / 0** | vulnerable > harm > gain > helped (**code order**) | **100 on all six**; "Aligned" = first in the list |
| 3 Protects entry-level (LB 4,4,5 / HB 1,1,2) | 98 / 64 / 56 / 43 | vulnerable > harm | Carry the respirator |
| 4 Counts heads (both groups 1,3,5) | 0 / 97 / 48 / 65 | harm > helped | Seal your apartment |
| 5 Same middle answer (rung 3 everywhere) | 0 / 0 / 48 / 43 | gain > helped | 100 / 100 / 94 … |
| 6 Like 5, one answer one step higher (LB large 4) | 17 / **55** / 40 / 43 | **harm** > helped | 100 / 98 / 92 … |
| 7 Refuses entry-level, prices seniors (HB 2,3,4) | 98 / 64 / 2 / 25 | vulnerable > harm | — |

### E1. A refusal becomes a zero. CRITICAL.

"Never, at any price" is stored as the rung after the top. Two refusals subtract to 0, so person 2
scores 0 on everything. With every score 0, every shortfall is 0 and every option fits 100, so the
labels come from the tie-breaks (`policyDelivery` is 0 too), which means id order. The planner
order is the source-code order. The most principled pattern in the study gets the least meaningful
profile.

**Idea 1.** When both answers in a comparison are refusals, the comparison is "not measured"
(dropped), not 0. `blend()` already drops unavailable signals. A value with no measured signal gets
the neutral 50 and a flag. That matches the codebase's own rule in `block5CVR.ts` `scoreOf`: missing
= 50, because "cares not at all" would invent a position.

**Prototype.** Person 2 becomes 50 (not measured) / 50 (not measured) / 0 / 0, and their scenario 1
best fit becomes "Carry the respirator to the patient".

### E2. One wobble can make a value #1. HIGH.

Person 6 differs from person 5 by one click, one step. Harm goes 0 → 55 (the smallest positive
slope maps to 55, because 55% of random patterns sit at exactly 0) and becomes the #1 value, which
flips the planner order.

**Idea 2.** Count an effect only when it repeats:
- **Harm:** the smaller of the two worker groups' slopes, so both groups must show it.
- **Vulnerable (Block 3):** the median of the three sizes' LB − HB, so two of three must show it.

**Prototype.** Person 6 → harm 0 (same order as person 5). Person 3 → harm 80. Person 4 is
unchanged (98).

**Side effect.** With a stricter formula, 79.9% of random patterns score 0, so the first positive
step maps near 80. That is the "strictly exceeds" convention and is honest, but state it.

### E3. Some values can never reach 100. MEDIUM.

The calibration tables cap the best possible answer below 100 on some values:

| Value | Highest possible score |
|---|---|
| helped | 98.8 |
| directness | 97.4 |
| stakeholder | 97.3 |
| context | 93.1 |

The yes-clicker is therefore gain-first (100 against 99) because of a table convention, not an
answer. It also affects the CVR lens: context can never beat directness at the very top.

**Idea 3.** Divide each calibrated value by its own highest attainable value, so the strongest
possible answer is 100 everywhere. Prototype: person 1 → gain 100, helped 100 (a tie → idea 4).

### E4. Tied values are broken by source-code order. HIGH.

`thresholdTree.ts` sorts with a stable sort over the order the dimensions are written in, so ties
always go vulnerable > group size > gain > outcome. That systematically favors "protecting the
vulnerable", the value the thesis is about, and a reviewer can call that a thumb on the scale.

**Idea 4.** Break ties by a coin flip seeded from the participant id (reproducible and unbiased
across people), and record `tied_values`. Alternative: let the planner count wins under each tied
order (a Block 5 change).

### E5. There is no response-style flag, although every click is timestamped. MEDIUM.

`timestamp` exists on every Blocks 1-3 history record, and per-block durations exist in
telemetry. **Idea 5.** Store flags such as `answered_first_step_everywhere`,
`refused_every_step_everywhere` and `faster_than_X_per_question`. They change no score; they let
analysis separate a response style from a value.

### E6. Block 3 prices as a real exchange rate. LOW, an idea for Fix P P3.

All six Block 3 answers are priced in one currency, so LB − HB (in rungs) against the size slope (in
rungs) is a unitless, genuinely elicited rate between "vulnerable" and "harm". Person 3: 3 rungs
against 1 → a rate of 3. It only works for that pair; helped (trolley) shares no currency.

### E7. Participant values are differences; option values are levels. CRITICAL, a design question.

"Protecting the vulnerable" for a participant is EXTRA care for entry-level over senior workers,
and "reducing harm" is EXTRA demand as groups grow. For an option, the same names mean how much
the option delivers. The fit score compares the two as one scale. Person 2 shows maximal care for
everyone and 0 extra care. This is the root of B6 and D2. It is not a calculation fix; discuss it
with the advisor.

**Size of ideas 1-4 together** (4,000 simulated "consistent" people: base rung ± small noise, small
LB and size offsets, related money and trolley answers):
- 58% have at least one of the four values at exactly 0 today.
- The #1 value changes for 18%.
- #1 and #2 are tied for 1.3% today and 1.6% after.
- 11.8% get a "not measured" value.

**Costs.**
- Blocks 1-4 scoring is marked FROZEN (planner plan, decision 4, 30 August), so this needs Waseem's
  and probably the advisor's OK.
- The calibration tables must be regenerated, with a new `SENSITIVITY_CALIBRATION_VERSION`; records
  on the old and new tables cannot be pooled.
- Every Block 5 number moves for some people.
- The validators' persona expectations will need re-checking.

**Sequencing.** Fix the inputs (Group E) before Fix P, because Fix P's P3-A uses these scores.

## Proposed fix order

Revised 24 September: Waseem wants the technical problems first, starting with the planner. Fix 1
waits until just before real participants.

1. **Fix P: the planner.** C2, C3, C8, C9, with C7 recorded, and C1, C4, C5, C6 made honest in the
   docs and the gates. Plan sent 24 September.
2. **Fix 2: B1 + B2.** Redesign the keep rule (Route 3).
3. **Fix 3: B5.** Record requested against applied moves.
4. **Fix 4: docs honesty.** B8, B4, B7, A7.
5. **Fix 5: A3.** Decide pure position effect or recommendation effect.
6. **Fix 6: D1 + D2.** Value definitions, blind rating sheet, re-author options.
7. **Fix 7: B6 + D3.** Upstream scoring and data-quality flags (touches the frozen Blocks 1-4).
8. **Fix 8: B3.** Sensitivity-analysis tool and pre-registration of the constants.
9. **Before launch: Fix 1 (A1 + A2 + A6)**, then A4 and A5.

## Fix P plan (sent 24 September, waiting for approval)

**What stays exactly the same:**
- LEAP's three-step tree and win counting.
- The clear/costed/blocked groups, the red lines, and the frozen ruler.
- The fit score, VCI and Stability.
- Blocks 1-4, and the scenario 6 shuffle.

**The changes:**
- **P1.** One `NOTICE_BAND` = 1/6 for all four values (helped was 1/8), declared a design
  constant.
- **P2.** A separate `FLOOR_BAND` (1/6) for Step 1 and the costed bin. No behavior change.
- **P3.** Step 3's trade rate. Recommended: the ratio of the participant's own #1 and #2 scores.
  Alternatives: keep the Block 3 premium and document it, or use 1 for everyone.
- **P4.** `PLANNER_VERSION` plus `plannerInputs` (value order, top-two gap, red lines, the two
  bands, trade rate) on every result; dbshape gate D52 re-runs the planner from the stored inputs
  and must reproduce the stored order.
- **P5.** Honest comments and docs, including the CLAUDE.md "settled" line.
- **P6** (participant-visible, yes/no). Reword the trade line's "too small for you to have separated
  it in the earlier questions".
- **P7.** Reports and gates on realistic simulated people, with a band sensitivity check.

**Simulated effect** (3,000 "consistent people" per scenario, real `deriveDecisionProfile`):

| Scenario | Order changes, P1 only | Order changes, P1 + P3 | First card changes, P1 + P3 | First = best fit, today → P1 + P3 |
|---|---|---|---|---|
| Six Hours | 7.6% | 13.3% | 0.3% | 39.1 → 39.2% |
| Eight Hours | 0.0% | 5.1% | 4.6% | 44.8 → 45.2% |
| Cancer | 7.0% | 18.7% | 11.2% | 40.7 → 51.0% |
| Care Visits | 6.6% | 8.5% | 7.2% | 39.7 → 44.5% |

## Log

- **2026-09-24.** Audit written (`a2ecc01`). Nothing fixed yet. Fix 1 plan sent to Waseem.
- **2026-09-24.** Waseem deferred Fix 1 to before launch. At his request I reviewed the other
  session's uncommitted work and ran the full chain on it: typecheck, lint and build clean; ALL
  TESTS PASS, ALL APA CHECKS PASS, ALL DATABASE GATES PASSED (D51 new, 18 rows, gap 0.00); only the
  intentional position gate fails (2.8x). "Fill feedback" appears 0 times in `dist/`, and so do
  "Has a cost" and "These cost you something". Committed as found: `60db800`.
  Note for analysts: `MCF_VERSION` "2026-09-24-a" and "2026-09-23-a" are the same rule; only the
  date label was corrected (the running code carried "24-a" from 18:16 to 21:29 on 23 September).
- **2026-09-24.** Read the planner's design record (LEAP trade-off tree). Re-tested C1 on three
  populations (it holds), reclassified C3, added C7, C8 and C9. Simulated candidate parameter
  changes before planning Fix P (numbers are in the Fix P plan).
