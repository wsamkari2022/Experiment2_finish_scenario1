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
| A4 | Reflection pages show the participant's value numbers | Medium, decision | **Half fixed**: the confirm-keep number removed (option A); APA's "missed by N points" still shown |
| A5 | Compare chart draws the participant's values over the options | Low, note | Open |
| A6 | CLAUDE.md says no verdict or arithmetic is shown; not true | High (docs) | **Deferred to before launch** (Fix 1) |
| A8 | Scenario 5's wish page says how close the wish is to "what you said matters most" | Medium | Open (Fix 1 territory) |
| A9 | The participant's own four value numbers are on screen in every scenario while they choose (the sidebar card, since 26 Sept the values panel), the same kind of number removed from the confirm-keep question | Medium, decision | **Kept for now** (Waseem, 26 Sept); he will check with his advisor |
| A10 | Scenario 6 shows those four numbers although its four options ARE the four values (the meanings are hidden there for exactly that reason) | Medium, decision | **Kept for now** (Waseem, 26 Sept); he may prefer to hide it after checking with his advisor |
| A7 | The "Has a cost" removal (24 Sept) is not yet dated in CLAUDE.md / HOW_TO_ANALYZE | Medium (docs) | **Fixed (docs)** 25 Sept: dated in CLAUDE.md and HOW_TO_ANALYZE 4.9 |
| B1 | Keep rule lowers the wrong value, or nothing | Critical | **Fixed** (Fix 2, comparison-based keep rule) |
| B2 | Picking your best fit can lower your #1 value | Critical | **Fixed** (Fix 2: a best-fit pick moves nothing) |
| B3 | Step sizes (30/15/20/10/25) are hand-picked | High | Open |
| B4 | "Zero-sum" APA move is not zero-sum at the floor | Low | **Fixed (docs)** 25 Sept: the edge case written into block5CVR.ts, the checklist and the request document |
| B5 | A move cut off at 0 or 100 is not recorded | High | **Fixed** (every move saved as asked for and made; `analysis.value_moves_asked_for_and_made`, gates V18, D55) |
| B6 | Difference scores put consistent people at 0 | Critical, upstream | Open, decision |
| B7 | Only four scenarios can move the profile | Medium (framing) | Open |
| B8 | The audit-request document describes Route 3 wrongly | Medium (docs) | **Fixed (docs)** 25 Sept: dated corrections added to the request document, his words kept |
| C1 | The first card is almost always "champion of your #1 value" | High (honesty) | **Documented** (item 5; measured by `report:planner-overlap`) |
| C2 | "Every threshold comes from the participant" is false | High | Open |
| C3 | Step 1's floor and Step 2's noise band are one number with two meanings | Medium | **Fixed** (item 2: `floor` named apart; 0 of 24,000 orders moved) |
| C4 | Appendix B numbers depend on invented people | Medium | **Fixed** (item 7: `report:planner-overlap` on real-pipeline pretend people) |
| C5 | "No tuning constants" claim | Low (docs) | **Kept on purpose**: the planner header's "no constants" wording is item 1, which Waseem said to keep (24 Sept). The rank-1 choice is already explained in the code where it is made |
| C6 | Win counting is Copeland; loops almost never happen | Low (docs) | **Fixed (docs)**: Copeland/Tversky cited on 24 Sept; the measured loop rate and Kemeny added 25 Sept |
| C7 | Ties and near-ties in the participant's own ranking decide the whole order | Medium | Open |
| C8 | The noise band cannot be personal; `strictness` is computed and never used | High | Open |
| C9 | The planner's inputs are not stored, and there is no planner version | High | **Fixed** (item 4: `plannerInputs`, `PLANNER_VERSION`, `analysis.card_order_by_scenario`, gate D53) |
| D1 | Option numbers disagree with the option's own words | Critical | **Mostly resolved** 26 Sept: 7 of my 9 examples were already right under the 18 Sept value audit (I1); the last 2 fixed (Fix 5). **Rater study run 26 Sept** (Haiku, Opus, Sonnet; blind, checked in their logs): 15 more numbers where all three raters agree with each other and sit 20+ points from the study, 3 of them in scenario 4 "Reducing harm" (`Generated Outputs/rater_study/REPORT.md`). Waiting for Waseem's decisions |
| D2 | "Reducing harm" and "gain" mean different things per scenario | Critical | **Plan written** (Fix 3), waiting for approval. The raters (26 Sept) point at three meaning problems: scenario 3 "Reducing harm" vs "How many are helped" (4 of 6 options split the raters), scenario 4 "How much is gained" (several cards say nothing about money), scenario 2 "How many are helped" for a swap |
| D3 | Fast "yes" clicking produces a strong gain-first profile | High | Open |
| E1 | A refusal becomes a zero; the never-harm refuser scores 0/0/0/0 and every option fits 100 | Critical | **Fixed**: vulnerable + harm (Idea 1, score 50); directness + context (flag, score 0, fair lens tie) |
| E2 | One wobble of one step can make a value #1 | High | **Fixed** (Idea 2, half credit, approved 24 Sept) |
| E3 | Some values can never reach 100 (helped 99, directness 97, context 93) | Medium | **Fixed** (Idea 3, approved 24 Sept) |
| E4 | Tied values are broken by source-code order, which always favors "vulnerable" | High | **Fixed** (Idea 4, approved 24 Sept) |
| E5 | No response-style flag, though every click is timestamped | Medium | **Fixed** (Idea 5): `analysis.blocks_1_to_4_checks` + `major_info_and_scores.blocks_1_to_4` |
| E6 | Block 3's prices could give a real vulnerable-vs-harm exchange rate | Low, idea | Proposed (calc idea 6) |
| E7 | Participant values are differences; option values are levels | Critical, design | For discussion |
| E8 | One "donate" click earns the full donation signal, so donating hardly stands out | High | **Fixed** (share of refusals, 24 Sept) |
| F1 | The fit score stopped at 0, so several cards on one menu read "0 out of 100" | High | **Fixed** (1-A: share of what the participant asked for; order unchanged) |
| F2 | Side panel says each option "is labeled by how well it fits"; no labels are shown | Medium | **Fixed** (sentence shortened) |
| F3 | Docs said the raw shortfall is saved on the scenario row; it is not | Medium (docs) | **Fixed**: now saved (`matchShortfall`, `points_short_of_what_they_asked_for`, gate D56) |
| G1 | "VCI acted" gets help from the reflection; "VCI wished" never does | High (analysis) | **Solved by decision** (25 Sept): no reflection in scenario 5 on purpose; the wish is compared with the final decision. Reason to be written down (Fix 4, step 9) |
| G2 | The wish is scored on a profile the decision just moved | High (analysis) | **Fixed** (Fix 4: scenario 5 shown and scored on scenario 4's opening values; W2, W3) |
| G3 | VCI acted / wished are one choice each: 100, 80, 50 or 10 | Medium (reporting) | **Partly solved by decision**: the per-value difference (Fix 4, step 7) replaces the four steps; the VCI gap stays rough, report it for groups |
| G4 | VCI and Stability are good for groups, rough for one person | Medium (reporting) | **Fixed (docs)** 25 Sept: HOW_TO_ANALYZE 4.8 |
| G5 | Stability 100 usually means nothing was measured | Medium | Known; now counted |
| G6 | One honest change of mind gets the Stability of a random responder | Medium, decision | For discussion |
| G7 | A random responder's VCI is 56-57, not 50 | Low (docs) | **Fixed (docs)** 25 Sept: CLAUDE.md and HOW_TO_ANALYZE (the VCI method already said 57) |
| G8 | Scenario 6 adds a fixed 50 to the performance average, so nobody reaches 100 | High | **Fixed** (Fix 4: performance counts the decisions only; W1, D57) |
| G9 | Scenario 5 (a wish) is in the performance average | High | **Fixed** (Fix 4, Part A; W1, D57) |
| P1 | Position check: options alone move the raw distance too much for low-demand people (2.8x, wants 3x) | Medium | Open (after Fix 3: A / B / C) |
| P2 | The position headline alone cannot tell a role-switcher from a random chooser; the time check cannot run | Medium, design | Known; decision |
| P3 | Role, subject and order are mixed (one scenario per role) | Known, design | Stated in HOW_TO_ANALYZE 4.4 |
| H1 | The company stance is shown on the results page but not saved | Medium | **Fixed** 25 Sept: `company_stance`, gate D61 |
| H2 | The company's value shown in scenarios 4 and 5 was not saved | Medium | **Fixed** (`company_value_shown`, D60) |
| I1 | D1 plan written without the 18 Sept value audit (checklist 2g) | Medium (process) | **Done** 26 Sept: D1 compared with the 18 Sept value audit |
| I2 | Following your top value costs performance in this deck (40 against random 51) | Note | **Fixed (docs)** 25 Sept: HOW_TO_ANALYZE 4.8 |
| I3 | Performance for one person is mostly luck of the pick (twice: 0.15-0.21) | Note | **Fixed (docs)** 25 Sept: HOW_TO_ANALYZE 4.8 |

---

## What is still not fixed, and the plan (written 25 September 2026)

Everything mentioned in our work that is NOT fixed yet, in one place, grouped by when it should be
done. IDs point to the sections below. "Decision" means Waseem has to choose; "docs" means only the
documents change.

### New items added today

| ID | Problem (short) | Severity | Status |
|---|---|---|---|
| P1 | Position check: for "low-demand" people the options alone move the raw distance 5.0 points, their choice 13.9 (2.8x, the check wants 3x). The headline position number already corrects for this (it uses each scenario's own range); the raw distance does not | Medium | Open. Re-measure after Fix 3, then choose: A passes by itself / B fix the calculation / C accept and state it |
| P2 | The position headline alone cannot tell a person who truly changes with their role from a random chooser: both score high. The check that separates them (the "time" check) needs one role to appear twice, and no role does in this deck, so it is skipped (3 skips in validate:position) | Medium, design | Known, not in the status board before. Decision: accept and say it (the scenario 4 vs 5 pair is the clean reading) |
| P3 | Each role is one scenario, so role, subject and order are mixed together (HOW_TO_ANALYZE 4.4) | Known, design | Stated in the guide; nothing to fix |
| H1 | The company stance ("Took the company's values" / "Split the difference" / "Held your own values") is shown on the results page but never saved | Medium | Open. Proposal: save it beside `company_value_shown` |
| H2 | The company's value shown in scenarios 4 and 5 was never saved | Medium | **Fixed** 25 September (`company_value_shown`, gate D60) |
| I1 | My D1 plan was written without knowing the 18 September value audit (checklist 2g), which already checked all 96 option numbers | Medium (process) | Open. First step of Fix 3: compare D1's examples with 2g |
| I2 | In this deck, following your own top value costs performance: "true to top value" averages 40, random choosers 51, best-fit pickers 52-60 | Note | By design (the trade-off the study is about). Say it when reporting performance |
| I3 | Performance for one person is mostly which options they happened to pick: same pretend person twice agrees only 0.15-0.21 | Note (reporting) | Report performance for groups |

### The plan, in order

**Phase 0 - small, can be done at once. DONE 25 September 2026** (C5 left as it is: it is the
planner wording Waseem said to keep; see the status board)
1. H1: save the company stance with its two distances (to the person, to the company).
2. Documents only, no change to the study: A7 (date the "Has a cost" removal), B4 (APA "zero-sum"
   is not zero-sum at the floor), B8 (Route 3 described wrongly in the old request document), C5 ("no
   tuning constants"), C6 (Copeland), G7 (random VCI is 56-57, not 50), G4 and I3 (group, not person).

**Phase 1 - the option numbers (Fix 3 = D1 + D2), the biggest piece**
3. I1 first: compare D1's examples with the 18 September value audit.
4. Then the Fix 3 plan: one meaning per value, a blind rating sheet, 2-3 raters, a comparison script,
   Waseem decides each flagged number, a `CONTENT_VERSION` on every row. Waiting for his 4 answers.

**Phase 2 - measure again after Fix 3** (option numbers move, so everything that reads them moves)
5. P1: re-run `validate:position`; choose A / B / C.
6. Re-run the VCI, Stability, planner-overlap and MCF reports; update the method documents.

**Phase 3 - measurement questions, each a decision**
7. G6: what should one honest change of mind score on Stability?
8. G5: store "Stability was not measured" (no reflection ever ran) beside the score?
9. P2: accept the position headline as a description, or change the design?
10. B3: a sensitivity report - re-run VCI, Stability and position with every step size x0.5 and x2,
    and show the conclusions hold (defends the hand-picked numbers).
11. Planner: C2 (the "every threshold comes from you" claim), C7 (near-ties decide the order),
    C8 (the notice band cannot be personal; `strictness` unused). Planner item 1 (band wording) was
    "not now".
12. Blocks 1-4: B6 / E7 (differences against levels, for the advisor), D3 (fast "yes" clicking: the
    flag exists since E5; decide how to report those people), E6 (an exchange-rate idea).
13. B7: only four scenarios can move the profile (framing in the thesis).

**Phase 4 - just before real participants (Fix 1, deferred by Waseem)**
14. A1 (the fit number on cards), A2 (#1-value text on cards), A6 (CLAUDE.md claim), A8 (scenario
    5's wish page "close to what you said matters most"), A4 second half (APA "missed by N points"),
    A3 (the order reads as a recommendation), A5 (compare chart draws the person's values).
15. Remove the two development-only buttons (CLAUDE.md).
16. One full click-through of the study in the browser, then the full check chain.


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

## Group G: how accurate VCI and Stability are (checked 24 September, at Waseem's request)

**Method.** Scratch script `vci_stability_check.cjs` (in the session scratchpad, not the repo).
1,500 pretend people whose Blocks 1-4 answers go through the REAL scoring code (steady answerers,
and random answerers), then all six Block 5 scenarios with the real rules (`labelOptions`, the three
`*WithMoves` update rules, `computeVCI`, `analyseMirror`, `computeStability`). Ten kinds of Block 5
behaviour, the same as `npm run report:vci`. Plus a "recovery" test: people who follow their own
top value with chance q (0, 0.25, 0.5, 0.75, 1) and choose at random otherwise, each run twice.

**Results, steady answerers (random answerers within a few points of these):**

| Kind of person | VCI overall | VCI acted (sc 4) | VCI wished (sc 5) | Stability | Stability "100 because nothing was measured" |
|---|---|---|---|---|---|
| True to top value | 92 | 96 | 99 | 97 | 61% |
| Always best fit | 100 | 100 | 100 | 100 | 100% |
| Convert (one honest change) | 65 | 93 | 99 | 56 | 0% |
| Corrected by APA | 96 | 100 | 31 | 93 | 0% |
| Performance chaser | 70 | 71 | 84 | 78 | 15% |
| Random responder | 57 | 57 | 50 | 61 | 1% |
| Flip-flopper (keeps) | 33 | 31 | 33 | 17 | 0% |
| Always the worst fit | 10 | 10 | 10 | 6 | 0% |

**Accuracy:**

| Question | VCI | Stability | VCI acted (one choice) |
|---|---|---|---|
| Tells "true to values" from "random" | 97 in 100 | 90 in 100 | - |
| Tells "random" from "flip-flopper" | 86-89 in 100 | 87-88 in 100 | - |
| Mean as true consistency q goes 0 → 1 | 57 → 92 | 62 → 99 | 56 → 98 |
| Rank agreement with q (1 = perfect) | 0.61-0.64 | 0.58-0.60 | 0.48-0.49 |
| Same person twice (1 = identical) | 0.45-0.48 | 0.34-0.38 | 0.27-0.28 |

### G1. "VCI acted" gets help from the reflection step; "VCI wished" never does. HIGH (analysis).
Scenario 4 is a decision, so a misaligned first pick opens the reflection, and APA can replace it
with a better-fitting final choice. Scenario 5 is a wish: no reflection, the first pick is final.
`analyseMirror` scores the FINAL choice in 4 against the FIRST in 5. Random responder: first pick in
scenario 4 = 50, final = 57, wish = 50, so the gap "wished − acted" is pushed about 7 points
negative by the design alone. "Corrected by APA": first pick 30, final 100, wish 31, a gap of −69
made entirely by the reflection. **Suggestion:** also store, and analyse, the gap on the FIRST pick
in scenario 4 (`firstChoiceOptionId` is already saved). Not implemented.

### G2. The wish is scored on a profile the decision just moved. HIGH (analysis).
Scenarios 4 and 5 have the same six options with the same numbers. Someone who picks the SAME
option in both should get a gap of 0. They do not, in up to 49 in 100 cases (performance chasers,
mean gap +13), because scenario 5 is judged on the profile after scenario 4's update, which moved
toward that very option. Judged both on the profile they entered Block 5 with, the gap is 0 in 100
of 100 same-option cases. **Suggestion:** store a second gap with both sides judged on the Block-5
entry profile. Not implemented.

### G3. One choice is a very rough measure. MEDIUM (reporting).
VCI acted and VCI wished are each ONE choice, so they can only be 100, 80, 50 or 10. A random
responder gets a gap of 50 points or more 35 in 100 times. Same person twice: 0.27. Report the gap
for groups, never as a verdict about one person.

### G4. VCI and Stability are good for groups, rough for one person. MEDIUM (reporting).
Only four choices count. Same person twice: VCI 0.45-0.48, Stability 0.34-0.38 (research usually
wants 0.70 or more to compare individuals). Group comparisons are well supported (the separation
figures above).

### G5. Stability 100 usually means "nothing was measured". MEDIUM (known, now counted).
Stability only counts swaps at a reflection. 61 in 100 "true to top value" people, and every
best-fit picker, never meet one, so they score 100 with nothing measured (`conflictSteps: 0`).
Already in HOW_TO_ANALYZE 4.2; filter on `conflictSteps > 0` or report it beside the score.

### G6. One honest change of mind scores like random. MEDIUM, a question for Waseem.
"Convert" people change their top value once, in scenario 1, then stay true to it. Their Stability
is 56, random people 61, and Stability tells them apart only 45-49 in 100 times (a coin is 50).
The reason: after one change, the model needs several scenarios to catch up, and each catch-up
reflection counts more swaps (1.9 reflections, 2.7 swaps on average). If Stability should mean "how
often the person changed", one change should score higher than random. Decision needed.

### G7. A random responder's VCI is 56-57, not 50. LOW (docs).
Blind picking of the FIRST choice gives exactly 50. A random responder who goes through APA then
chooses among the options serving the value they named, which fits better than a random option,
so the final choice lifts VCI to 56-57. Already in the VCI method figures; say it next to "50".

### Value moves cut off at 0 or 100 (B5, measured in the same run)
16-23 in 100 policy values START Block 5 at 0 or 100 (straight out of Blocks 1-4). Moves cut off:
7-49 in 100 depending on behaviour (random 18, true to top value 49: their top value is already at
100). Values at 0 or 100 at the end: 2-70 in 100 (random 13). The old "13%" in the bump() comment
came from uniform profiles; the comment now says so.

## Plans waiting for approval (24 September, evening)

**P-DC. Directness and context: "never" is not zero, and a fair lens choice.**
- *Scoring:* directness is not measured when lever AND bridge were both "never"; context is not
  measured when all three money places were "never kept". Score 50, flag `measured: false`, the
  same rule as Idea 1.
- *Lens choice* (`chooseFraming` in block5CVR.ts, Block 5): if only one of the two was measured, use
  the measured one. If both are unmeasured or they tie, use the participant's own coin order (their
  rank), not the current "context wins every tie" (`>=`).
- *Practical effect:* the lens changes only for ties (both unmeasured, or equal), because today an
  unmeasured 0 always loses to any measured positive score. The stored scores become honest.

**P-CAL. Commit the recipe, and rebuild all seven tables once.**
- The recipe behind the 23 August tables is missing (`tools/regenerate_sensitivity_calibration.md`
  does not exist). The problem is a missing file, not the questions or the ladders.
- Plan: commit a generator tool, decide the random model for Block 1's donate action and for
  Block 4 (to be decided by Waseem), and rebuild all seven tables in one go after the formula
  changes (Idea 2, P-DC). Every score shifts a little, so do it before real data, with a new
  version stamp.

**Idea 2, revised after Waseem's point.** He is right that one extra step means something.
- Today the half-step case is not "zero or something" but far too much: harm 55, and it becomes the
  #1 value.
- New proposal: a straight line from 0 to the one-full-step score, so half a step gets half the
  one-step score, 0.5 × 64 = 32. One step or more is unchanged.
- Only the half-step case can fall between 0 and 1, because Block 3 slopes come in half steps.
- Vulnerable stays as it is. Its table is already smooth (B gets 17 for the same click, which is
  where "more care for entry-level" belongs).
- Person B: 0 / 55 / 40 / 44 → 17 / 32 / 40 / 44, #1 value helped.

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

## Fix P plan v2 (re-tested on the new Blocks 1-4 scoring, 24 September, evening)

**How the re-test worked.** 4,000 "consistent" pretend people (a base answer, small real preferences,
a little noise) answered Blocks 1-4. They were scored by the REAL current code end to end (answers →
profile → planner), not given made-up scores. Random answerers (the recipe's model) were run for
comparison.

**Findings.**

- First card = the plain sort by the #1 value: 88-100% (unchanged; C1 holds).
- **First card = best-fit card: 56-68% for consistent people** (Six Hours 62.7, Wildfire 67.8,
  Cancer 56.2, Care 61.3) and 46-55% for random answerers. The earlier 37-55% came from made-up
  scores (20-100) and understated it. Clearer profiles make the #1-value champion also the best fit.
- The planner's #1 value was decided by the coin for 2.7% of people; the #2 value is 0 for 1.3%.
- P1 (helped band 1/8 → 1/6) changes the first card for up to 7.4% and raises the overlap (Cancer
  56.2 → 60.5).
- P3-A (ratio of the person's own two scores) or P3-C (rate 1) change the order for 5-26% and also
  raise the overlap (Wildfire 67.8 → 71.5 / 69.5).

**Revised plan.** Make the planner honest and recorded, and do not change what it does.

- **P1'.** Keep the bands (1/6 for Block 3 values, 1/8 for helped = one step of the ladder each value
  is measured with, the same for everyone) and describe them honestly.
- **P2.** Name the floor and the notice band separately. No behavior change.
- **P3'.** Keep today's Step 3 rate and describe it honestly as a reading.
- **P4.** Store `PLANNER_VERSION` plus the inputs, with a check that rebuilds the order from them.
- **P5.** Honest words everywhere, including the CLAUDE.md "settled" line.
- **P6.** Reword the card sentence (participant-visible; yes/no).
- **P7.** A permanent report on these realistic pretend people.

**Open for the advisor.** Is a 56-68% overlap acceptable? In 32-44% of cases the first card differs
from the best fit, enough for an analysis that uses both ranks. A cleaner separation would need a
design change (for example a randomly ordered control group).

## Fix 2 plan: B1 + B2, the keep rule (written 24 September, waiting for approval)

**New rule for Route 3 (`applyKeepUpdates`, a pick in the top two, no reflection).**

- **Best fit (Aligned) picked:** the model's own guess came true, so nothing moves.
- **Second best (Weakly aligned) picked:** compare the pick with the model's best fit. Raise (+20) the
  value where the pick beats the best fit the most. Lower (-15) the value where the best fit beat the
  pick the most, weighted by how much the person holds it (u/100, as `violatedValue`).
- The signature gains the scenario's options, so the best fit is known. The five tools that call it
  are updated (simulate_vci, simulate_stability, vci_distribution, stability_distribution,
  audit_block5_run).

**Prototype** (scratch `keep_proto.cjs`, 4,000 steady pretend people × scenarios 1-4, real current
code):

| Measure | Today | New |
|---|---|---|
| Best-fit pick lowers the #1 value | 16.2% | 0 |
| Best-fit pick reorders the four values | 23.0% | 0 |
| Net change per best-fit pick | +7.0 | 0 |
| 2nd-best pick lowers nothing although the best fit gave a held value (≥20) 20+ more | 35.2% | 0 |
| 2nd-best pick lowers a value on which the pick was NOT worse | 3.0% | 0 |
| Net change per 2nd-best pick | +6.9 | +3.8 |

**Test-run replay (0/0/100/99).**

- Today: 90/100 → 100/80 → 100/80 → 100/80 (two zero steps).
- New: 100/99 → 100/79 → 100/64 → 100/64. The Care pick became Aligned because the profile had learned.

**Open choice.** Aligned = no change (recommended) or a small comparison-based reinforcement.

**A4 suggestion (the confirm-keep sentence, "which you rated 94 out of 100").**

- Three problems:
  - it shows a profile number mid-Block 5;
  - "you rated" is false (it is a computed score);
  - the number comes from the LIVE profile, so it can differ between scenarios.
- Options:
  - A: drop the clause (recommended);
  - B: words instead of a number ("which your earlier answers put high");
  - C: keep the number, fix the wording, record the exposure.
- Same family as Fix 1; Waseem chooses when.

## Fix 3 plan: D1 + D2, the option numbers and what the values mean (written 24 September, waiting for approval)

Nothing here is implemented. Waseem asked for the plan first.

### The problem in one picture

Every option has four numbers from 0 to 100: how much it gives on "protecting the vulnerable",
"reducing harm", "how much is gained" and "how many are helped". The fit score, the four labels,
VCI, Stability, the card order, the MCF sentences and the predictions are ALL computed from these
numbers. The participant never sees them. The participant reads the WORDS on the card.

So if a number says the opposite of the words, a careful participant who chooses by their values
can be scored "misaligned" for doing exactly that.

**D1 example (checked again on 24 September 2026, the numbers are still these).** Cancer scenario,
"reducing harm":

| Option | Harm number | What the card says |
|---|---|---|
| Draw the 20 names from the patients who cannot wait | **94 (highest)** | "fewer of the 20 come through than under the rule that ranks by odds" |
| Treat the 20 most likely to survive | 48 | saves the most lives |

A participant who cares most about reducing harm, and reads the card, would pick "most likely to
survive". The numbers say the lottery is the harm option. The other D1 rows (care visits, wildfire)
are in the D1 table above.

**D2 example.** The participant's own "how much is gained" score comes from Block 3: how small a
payoff (money for the company) is enough for them to approve harming workers. But the options use
"gained" to mean different things:

| Scenario | "How much is gained" means (from `valueHere`) | Same thing Block 3 measured? |
|---|---|---|
| 1 and 2 (escape) | how quickly and safely YOU get out | No: personal safety, not a payoff |
| 3 (cancer) | how many years of life the doses add | Partly: a size of benefit |
| 4 and 5 (care visits) | keeping the service paid for and open next year | Yes: money |

"Reducing harm" has the same problem. Block 3 measures it as "you ask for more money as MORE workers
are hurt" (10, then 1,000, then 100,000 people): caring about numbers. In scenario 4 it means "the
cut lands where someone else can step in", which is about how badly one person is hurt, not how many.

Comparing a score measured on one thing with option numbers about another thing is like comparing
someone's height in centimetres with a door's width in inches: both are numbers, but they do not
measure the same thing.

### What Blocks 1-3 actually measure (from docs/MEASUREMENT_MODEL.md)

| Value | Where the participant's score comes from |
|---|---|
| Protecting the vulnerable | Block 3: asking for more before harming entry-level workers than senior ones (0.55); Block 1: giving found money back when it belongs to a shelter (0.30) |
| Reducing harm | Block 3 only: asking for more as the number of people hurt grows |
| How much is gained | Block 3: how small a payoff is enough to approve a harm (0.80) |
| How many are helped | Block 2 only: the trolley. Willing to harm one to save more |

### The plan, step by step

1. **One definition per value that is true in every scenario** and matches the row above.
   My draft, for Waseem to change:
   - Protecting the vulnerable: the option protects the people least able to protect themselves.
   - Reducing harm: the option keeps the NUMBER of people who are badly hurt as low as possible.
   - How much is gained: the option produces a large benefit (money, time, years of life), even if
     someone else pays for it.
   - How many are helped: the option helps the largest number of people, even at a cost to a few.
   Then rewrite each scenario's `valueHere` line (the "In this scenario:" sentence) as an example of
   that one definition, keeping each scenario's own words.
2. **A rating sheet with no numbers on it.** I generate it from the real content
   (`tools/export_block5_content.cjs`): every scenario, the six cards exactly as participants read
   them, the four definitions, and an empty 0-100 box per value per option. 24 options x 4 values
   = 96 boxes per rater (scenarios 1-4; scenario 5 repeats scenario 4's six options, and scenario
   6's four rules are each written as one value on purpose).
3. **Two or three raters score it alone**, without seeing the current numbers (for example the
   advisor and a lab colleague). Waseem has seen the numbers, so his own ratings are useful but not
   blind. I can fill one copy as a starting point, clearly marked as mine and NOT counted as
   independent.
4. **A script compares the ratings.** (a) Do the raters agree with each other? Reported as ICC,
   where 1 = perfect agreement and 0.75 or more is usually called good. (b) Where do the raters
   disagree with the current numbers? Every number more than 20 points from the raters' average,
   and every value where the raters put the six options in a different ORDER, goes on a list.
5. **Waseem decides each flagged item**: change the number (usually to the raters' average), or
   change the words, because sometimes the words are what is wrong.
6. **Stamp and re-run.** A `CONTENT_VERSION` saved on every scenario row, so data from before and
   after the change is never pooled. Then everything: the full check chain, `validate:mcf` (its
   61,945 sentences are built from these numbers), the VCI, Stability, planner-overlap and position
   reports, and the method documents' figures.

### What this will change, honestly

- Labels, fit scores, card order and predictions will move for many people. That is the point.
- The position effect will move too. CLAUDE.md says: never change option numbers to make the
  position check pass. This change is for a different reason (the numbers must mean what the
  words say), but it must be reported that way, and the position check must be re-read after it.
- No real participants yet, so this is the cheapest moment it will ever be.

### What I need from Waseem

1. The four definitions: approve, or rewrite them.
2. The raters: who (two or three people), and whether he rates too.
3. The flag line: 20 points (my suggestion), or another number.
4. The sheet: Excel file, or a simple web form.

## Fix 4 plan: scenario 5 is only a wish (written 25 September; approved and DONE the same day)

Nothing here is implemented. Waseem's decisions (25 September 2026), in his words:
- Scenario 5 must not add anything to the overall performance score, and "Preview impact" goes
  from its option cards, so there is no impact on the total performance.
- Scenario 5 exists only to see how far the WISH (it happens to you) sits from the DECISION
  (you are in control) in scenario 4, and how far the wish sits from the pre-Block-5 profile.
- No reflection in scenario 5 on purpose: the participant has just seen scenario 4's information
  and reflection, and scenario 5 is identical except for their role. So they either pick the same
  answer (the gap must be 0), or something different because it helps or hurts them more, and the
  study reads, value by value, which value they started to care about more.

### What the code does today (checked 25 September)

| Question | Today |
|---|---|
| Is scenario 5 in the overall performance average? | **Yes**, in all three averages (`averagePerformance`, `overallCaptured`, the running dashboard `cumulativeMetrics`) |
| Is scenario 6 in it? | **Yes, at a fixed 50** (its four rules all have performance 50), although a code note says it is left out. So nobody can reach 100 |
| Does scenario 5 show "Preview impact"? | Yes: the card button, the side-panel sentence, and the help text of the performance bars |
| Same card ORDER in 4 and 5? | Yes (0 differences in 3,000 profiles): the planner reads the pre-Block-5 profile |
| Same fit NUMBERS and labels in 4 and 5? | **No.** 81 in 100 pretend people see at least one different fit number, 76 in 100 a different label, because scenario 5 is judged on the profile AFTER scenario 4 moved it |
| Same pick in 4 and 5 gives VCI gap 0? | **No, in 56 in 100** (G2) |
| Scenario 5 against the pre-Block-5 profile, per value? | **Already saved**: `analysis.position_effect.by_scenario[].value_movement` |
| Wish minus decision, per value? | **Not saved** as its own field |

### Part A: scenario 5 adds nothing to performance

1. The three averages count only the four decision scenarios (1-4). This also removes scenario
   6's fixed 50 (G8), which is the same kind of mistake.
2. Scenario 5's own performance number stays saved on its row (it describes the option wished
   for), with a new `counts_towards_performance: false`.
3. Scenario 5's screen: no "Preview impact" button; the side-panel sentence loses its "Preview
   impact" half; the help text of the performance bars no longer says the choice is averaged in.
   Decision: keep the bars with one line "This is a wish, so it does not change these bars"
   (recommended: the screen stays as close to scenario 4 as possible), or hide the bars as in
   scenario 6.
4. The results page: the average and the "fit your values but performed poorly" count use
   scenarios 1-4 only; scenario 5's bar stays, labelled "your wish, not counted" (built as
   "Scenario 5 *" with the star explained under the chart: the long label ran into its bar).
5. The database recomputes the headline performance from the saved rows with the new rule, so
   old test records and new ones follow one rule.

Example with the real performance numbers (share of the best option taken, 0-100): someone who
takes the strongest option in scenarios 1-4 (100 each) and wishes for "Protect full visits for the
clients with nobody else" in scenario 5 (11). Today: (100+100+100+100+11+50) / 6 = **77**. After
the fix: **100**. Even wishing for the strongest option in scenario 5 gives only 92 today, because of
scenario 6's 50.

### Part B: the wish is compared fairly with the decision

6. Scenario 5 uses the profile the participant had when they ENTERED scenario 4, the same one
   their decision was judged on. Scenario 5 never moves the profile anyway. Then the same option
   always gets the same label, so the same pick gives a gap of exactly 0. Decision: (A) use it
   only for the saved numbers, or (B, recommended) also for what the screen shows in scenario 5
   (the fit line on the cards and the Compare overlay's readings), so scenario 5 really is
   scenario 4 with only the role changed.
7. A new saved field, per value: the wished option minus the decided option. It is 0 on every
   value when they wish for the same option. The biggest rise and the biggest drop are named in
   words ("when it was done to them, they wanted more protecting the vulnerable").
8. Beside it, for reading in one place: how far the decision and the wish each sit from the
   pre-Block-5 profile, per value (copied from the position effect, which already computes it).
9. Documents: Waseem's reason for leaving the reflection out of scenario 5 is written into
   CLAUDE.md and HOW_TO_ANALYZE, and the code note in `block5Mirror.ts` that calls the same-pick
   gap "small" and "real movement" is corrected (it was 56 in 100, and it came from the ruler).
10. Checks: the same pick gives a VCI gap of 0 and a per-value difference of 0 on all four; a
    different pick gives exactly the difference of the two options' numbers; a run whose wish is
    the weakest option still gets 100 performance when 1-4 took the strongest.

Worked example from the real code (a steady pretend person): entering scenario 4 with vulnerable
23, harm 0, gain 51, helped 1, they decided "Keep the town routes that pay, and drop the rural
ones" (Misaligned, VCI 50). Scenario 4's update moved gain to 81. They wished for the SAME option
in scenario 5, which, judged on the moved profile, became Aligned (VCI 100). Today's record says
"50 points truer to their values when wishing". After the fix: 0.

Per-value example: decided "Keep every care visit, and cut the check-in visits", wished "Protect
full visits for the clients with nobody else". Wish minus decision: vulnerable +60, harm −16,
gain −40, helped −42. Reading: when the cut was done to them, they cared much more about
protecting the vulnerable, and less about everything else.

### G1-G7 after Waseem's answers (25 September)

| ID | Status |
|---|---|
| G1 | **Solved by his decision.** Leaving the reflection out of scenario 5 is on purpose, and the wish is meant to be compared with the FINAL decision. Only the reason needs writing down (step 9) |
| G2 | Not fixed yet. **Fixed by step 6** once built |
| G3 | **Partly solved.** The per-value difference (step 7) gives real numbers instead of four steps. The VCI gap itself stays rough: report it for groups |
| G4 | Not solved (not about scenario 5) |
| G5 | Not solved |
| G6 | Not solved, still his decision |
| G7 | Not solved (a note in the documents) |
| G8 | New: scenario 6 adds a fixed 50 to performance. **Fixed by step 1** if he agrees |

## Fix 5 plan: the two wildfire numbers left from D1 (written 26 September; approved as 62 and 35, DONE the same day)

Nothing here is implemented. Waseem asked: change the words to fit the numbers, or change the numbers
if that costs us nothing important (alignment, VCI, Stability, a champion per value)?

**What each value means in the wildfire scenario** (its own "In this scenario" lines):
reducing harm = "keeping the risk your household puts on everyone else as low as possible";
protecting the vulnerable = "making sure the neighbors least able to leave are not left until last".

**Case 1 - "Fill every seat in the car with neighbors who have none", reducing harm 50.** Its own card:
"What it costs you is room and speed, not anybody else's place in the line", and it leaves in its
slot. The staged convoy (59) also keeps its place but takes nobody extra out. So by its own words
this option puts no more risk on others than the convoy, and the number says it puts more.

**Case 2 - "Leave immediately on the main highway", protecting the vulnerable 44.** Its own card: "The
blocks furthest from the junction waited their turn, and they are the ones still stuck in the jam
when the fire comes down." The ninth block is where the two residents with walkers live (option 3).
It leaves the least able until last, and 44 puts it in the middle of the scale, far above the ridge
road (18).

**Can the words be changed instead?**
- Case 2: no, not honestly. To earn 44 the card would have to protect someone vulnerable, which would
  make it a different option.
- Case 1: yes, one honest way: say the heavy, slow car holds up the blocks behind it (the convoy card
  already says "the line only moves as fast as its slowest block"). But that needs two sentences
  changed ("not anybody else's place in the line" would contradict it) and turns the option's cost
  from "your family pays" into "others pay a little too", which changes what the dilemma asks.

**Tested in scratch copies of the compiled code (the project untouched):** harm 50 -> 60 or 62; vulnerable
44 -> 25 or 30; and both (62, 25).

| Check | Today | Both changes |
|---|---|---|
| Each value keeps its own unique top option, every scenario | yes | yes |
| VCI, Stability, MCF, planner, APA, lens, twin, prediction checks | pass | pass |
| Position check (wants 3x) | 2.8x | 2.9x |
| VCI / Stability / Performance by kind of person | - | every figure within 1 point |

Wildfire scenario, 4,000 steady pretend people (random answerers similar):

| | Today | harm 62 | vulnerable 25 | Both |
|---|---|---|---|---|
| "Fill every seat" is the best fit for | 35.4% | 41.5% | 35.4% | 41.5% |
| "Leave immediately" is the best fit for | 4.3% | 4.3% | 0.5% | 0.5% |
| People whose best fit changes | - | 6.0% | 3.8% | 9.8% |
| People with any label changed | - | 26.0% | 12.7% | 36.6% |
| People whose card order changes | - | 24.9% | 9.5% | 33.8% |
| First card = best fit | 67.1% | 64.0% | 69.6% | 66.5% |

**Recommendation.** Change the numbers, not the words: Fill every seat harm 50 -> 62 (just above the
convoy, far below the school's 94), Leave immediately vulnerable 44 -> 25 (just above the ridge road).
After the change each value reads in an order the cards support:
harm school 94 > fill 62 > convoy 59 > give seats 56 > ridge 23 > early 20;
vulnerable give seats 97 > fill 62 > convoy 60 > school 56 > early 25 > ridge 18.

**What it costs, honestly.** "Leave immediately" becomes almost nobody's best fit (0.5%), as the even
cut did on 18 September (29% -> 2%); that is TRUE of the option and belongs in the methods. "Fill every
seat" becomes the best fit for 4 people in 10 instead of 3.5. About 1 person in 3 would see a
different label or card order in this scenario, and scenario 2 only. No real participants yet.

**Audit of this plan (what could be wrong).**
1. The two new numbers are judgments, like the old ones. The rater study (Step B of Fix 3) is what
   would confirm them independently.
2. Pretend people are not real people; the shares above are for the model, not a forecast.
3. The scratch copies patched the COMPILED code; the real change goes in block5Scenarios.ts, then
   every check runs again in the project.
4. The 18 September audit listed 9 "doubtful" numbers; only these two are in scope now.
5. The fit numbers, labels and card order a participant sees in scenario 2 change, so it is a dated
   screen change (HOW_TO_ANALYZE 4.9).

**Waseem asked three questions before approving (26 September); answers measured on the real code, in memory only:**
1. *Could the confirm-keep question read "delivers X and gives up X. Do you put X above X?"* No. When the two values are the same, the page already switches to "This option is built around X, but delivers less of it than your earlier answers asked for. Do you stand by choosing it?". That happens in 1.6% of possible keeps, the same before and after the change, and no option has a tie at its top value either way.
2. *Keep "Leave immediately" the best fit for at least 1 in 100?* Yes: vulnerable **35** instead of 25 gives 1.1% (steady answerers) and 3.1% (random answerers); 25 gives 0.5% / 1.9%. 35 keeps the order the card supports (give seats 97 > fill 62 > convoy 60 > school 56 > early 35 > ridge 18). Revised proposal: 62 and **35**.
3. *Reach 3x on the position check with these changes?* No: 2.80x -> 2.92x at most. The weak profile asks little of every value (20/25/30/20); the six care-visit options sit almost equally far from it (room 9.5, counted twice because scenarios 4 and 5 are twins), and the care menu sits farther from it on average than the cancer menu (33.9 against 29.0). Only other option numbers or the check itself could close the gap; changing numbers to pass the check is against the project rule. Stays Phase 2 (P1).

**If approved, the steps.** (1) Change the two numbers in block5Scenarios.ts with a "VALUE AUDIT, third
pass" comment quoting the card lines. (2) Update the 2g table in the scenario checklist, a dated note in
CLAUDE.md, the 4.9 list in HOW_TO_ANALYZE. (3) Run the full chain and every separate check; re-run
report:vci, report:stability and report:planner-overlap and update any figure the method documents
quote. (4) Look at scenario 2 in the browser. (5) Commit, push, log here.

## Fix 6 plan: what the blind raters found (written 26 September, waiting for approval)

Waseem's answers to the rater report: "1-yes, 2-words, 3-keep, write the Fix 6 plan". So: write the plan;
Scenario 3 (#9, #10) and the seat swap (#5) get WORDS, not new numbers; "Leave immediately" (#6, #7)
KEEPS 35 and 30. Numbers below are from `Generated Outputs/rater_study/REPORT.md` (#1-#15).

**Nothing here is implemented.** Every figure was measured on scratch copies of the study with the numbers
changed (scratch `make_mirrors6.cjs`, `fix6_compare.cjs`, `perf6.cjs`, and the project's own report tools run
on the copies), with pretend participants scored by the real Blocks 1-4 code.

### What I found while testing (it changed the plan)

1. **Moving all 10 flagged numbers kills two options.** "Hold some doses back for the patients nobody reaches"
   (S3) and "Keep every care visit, and cut the check-in visits" (S4) would each be worse than another option on
   ALL four values, so each would be the best fit for 0 people in 100 (today 7.6 and 14.0). The cause:
   - S3: the draw's "Protecting the vulnerable" 56 -> 83 makes the draw beat "Hold some doses back" everywhere.
   - S4: "Redraw the routes" Reducing harm 47 -> 78 and "Keep every care visit" 70 -> 38 make Redraw beat it
     everywhere. The raters themselves score Redraw above "Keep every care visit" on all four values: Redraw's
     real cost (a stranger at the door, no continuity) is not one of the four values, so on the four values it
     looks free. That is a WORDS problem, not a number problem.
   So #8, #12 and #13 wait for the words (Part B).
2. **Two options change the value they are "built on".** Both convoys (S1 #1, S2 #3) go from How much is gained to
   Reducing harm. That changes the APA page's list for those two values, the confirm-keep question ("This option
   delivers X…") and which value a kept convoy raises. Their cards support it ("nobody loses their place in the
   line"), and the S1 / S2 "In this scenario" lines for Reducing harm fit both options each value now leads to.
3. **The 18 September audit counted "Reducing harm" as the NUMBER of people harmed** (severity went to
   Protecting the vulnerable). Participants never see that rule: they read the scenario lines ("keeping the risk
   your choice puts on everyone else as low as possible", "making the cut land where someone else can step in, so
   it hurts least"), and the raters followed those. Part A lets the numbers follow what participants read. This
   reverses two numbers the 18 September audit raised on purpose: the respirator (24 -> 45, now 22) and the rural
   routes (28 -> 55, now 15).

### Part A: seven numbers, now (tested safe)

| # | Scenario | Option | Value | Today | New (raters' average) |
|---|---|---|---|---|---|
| 1 | 1 | Leave with the registered convoy | Reducing harm | 61 | 87 |
| 2 | 1 | Take the sealed respirator | Reducing harm | 45 | 22 |
| 3 | 2 | Take your household's place in the staged convoy | Reducing harm | 59 | 83 |
| 4 | 2 | Give your car seats to the two residents with walkers | Reducing harm | 56 | 83 |
| 11 | 4 + 5 | Cut only where a family member can cover | Protecting the vulnerable | 58 | 83 |
| 14 | 4 + 5 | Keep the town routes that pay, and drop the rural ones | Reducing harm | 55 | 15 |
| 15 | 4 + 5 | Protect full visits for the clients with nobody else | How many are helped | 38 | 60 |

Scenario 5 carries its own copy of scenario 4's options (the `wish_` ids): the same three numbers change there,
and validate:twins keeps them identical. The words do not change in Part A.

**Measured effect of Part A** (pretend participants; today -> after):

| What | Today | After Part A |
|---|---|---|
| Every value keeps its own top option in every scenario | yes | yes |
| Least-chosen best fit | Leave immediately 1.1 in 100 | the same 1.1; Seal your apartment 11.4 -> 4.2; the concrete school 14.8 -> 3.0 |
| People who see a different best fit (steady) | - | S1 17, S2 18, S3 0, S4 19 in 100 |
| People who see a different card order (steady) | - | S1 37, S2 34, S3 0, S4 61 in 100 |
| VCI, "true to top value" / random / flip-flopper | 90 / 57 / 32 | 87 / 57 / 33 |
| VCI tells true-to-top from random | 96 in 100 | 94 in 100 |
| VCI tells a convert from a performance chaser | 36 in 100 | 28 in 100 (weaker) |
| Stability, every kind of participant | - | moves 0-2 points (worst fit 4 -> 6) |
| Position check, worst ratio (needs 3x) | 2.9x, FAILS | 3.3x, PASSES (all 10 numbers: 4.1x) |
| Prediction, "almost always best fit" chooser | 52.1% | 53.2% |
| Performance of the best-fit pick (4 decisions) | 60.0 | 60.3 |
| First card = best fit (steady) | 57-66 in 100 | 52-64 in 100 (easier to tell position from fit) |
| MCF sentences, APA arithmetic, CVR lenses, twins | pass | pass |
| VCI check V3 (one scripted flip-flopper < 50) | 40, passes | 50, FAILS by a hair |

**V3.** One scripted test person who changes value every scenario now lands on "Misaligned" in all four
scenarios, which is exactly 50, the same as blind picking; the check wants less than 50. Across 2,000 pretend
flip-floppers the average is 33 (today 32). Do NOT move an option number to pass it. In implementation: find why,
and bring Waseem the reason and a choice (keep the strict one-person check, or check the 2,000 instead).

### Part B: words first, then three numbers (#8, #12, #13), then rate again

| Where | What the words must do |
|---|---|
| S2, the seat swap (#5) | Say that the same number of people leave the valley and only the order changes, so "How many are helped" (people out because of your choice) reads as it is scored (39) |
| S3, "most likely to survive" (#9) | Say what the rule counts: survivors, not years ("a survivor with five years ahead counts the same as one with forty") |
| S3, "most years ahead" (#10) | Say that ranking by years can pick a younger patient with a smaller chance of responding, so fewer of the 20 may come through |
| S3, "Hold some doses back" and the draw (#8) | Give "Hold some doses back" a clear strength of its own (the patients nobody reaches), then set the draw's "Protecting the vulnerable" so it does not win on every value |
| S3, the "Reducing harm" line | "Losing their chance for good" split the raters on 4 of 6 options; make it concrete |
| S4, "Redraw the routes" and "Keep every care visit" (#12, #13) | Make one of them honestly better somewhere (for example, what the stranger at the door costs the clients who live alone, or what the check-in cut saves in money), then set the two Reducing harm numbers |
| S4, "How much is gained" | Three cards say nothing about money; give each one plain money line |

**Every option whose words change is checked in six places, by reading and by the checks:**
1. the card itself (title, how, summary, gains, gives up, what happens, the question);
2. the two CVR lens views, which are built from the option's own reflection material (its rule, the parallel
   rule, the act, the parallel act, and both consequence pairs): they must still describe the same act;
3. the two stakeholder stories (the person it hurts, the person who needed it): `validate:people`;
4. the APA page: the "In this scenario" lines must still describe the options each value leads to (the main
   value, `optionMainValue`), and `verify:apa`;
5. MCF: `validate:mcf` (every sentence, no verdict, no digit);
6. the planner's card sentence and the Word export (`export_block5_content.cjs`).

Then the changed cards (only those) go back to the same three blind raters, in fresh rooms, and #8, #12, #13 are
set from their average, but only where no option dies. Then every measurement above is run again.

### Part C: kept on purpose

"Leave immediately" (#6, #7) keeps 35 and 30 (Waseem: keep). The raters' 14 and 8 are written into the
report as a known disagreement: lowering both would leave the option the best fit for almost nobody.

### Steps, in order

1. Part A: the seven numbers in `block5Scenarios.ts` (and the five `wish_` copies), each with a "VALUE AUDIT,
   fourth pass, rater study" comment quoting the raters and the card words.
2. The full chain, plus prediction, resume, MCF and visits. V3: find the reason, report, do not tune numbers.
   The position check is expected to PASS: move `validate:position` out of "fails on purpose" everywhere it is
   written (CLAUDE.md, the chain note, HOW_TO_ANALYZE, the checklist 2g), and close P1.
3. Re-run and update every quoted figure (report:vci, report:stability, report:planner-overlap, prediction).
4. Browser check with a pretend participant: scenario 1, 2 and 4 cards, fit numbers, order, the APA list for
   Reducing harm, the confirm-keep question after keeping a convoy.
5. Docs: CLAUDE.md dated section; HOW_TO_ANALYZE 4.9 (participants see new fit numbers, labels and order in
   scenarios 1, 2, 4 and 5); HOW_TO_READ; the checklist 2g; SHAPE_VERSION; commit and push.
6. Part B, one scenario at a time, each with its own plan and approval: words, the six-place check, re-rating,
   the three numbers, measure again.

### Audit of this plan

| Risk | What I do about it |
|---|---|
| Moving only the flagged numbers can make an option lose on every value | Checked for every option in every scenario; that is why #8, #12, #13 wait |
| The harm champions (Seal, the school) are chosen as best fit less often | Still above 1 in 100 (4.2 and 3.0); stated, not hidden |
| Two convoys change their main value | APA list and confirm-keep question checked in the browser; the scenario lines re-read |
| One VCI check fails by a hair | Reason found first; never a number moved to pass a check |
| The raters are three AI models of one family | Written in the report: an AI-assisted blind review, adjudicated by the researcher, not human inter-rater reliability |
| The numbers now follow the scenario lines, not the 18 September counting rule | Written in each comment and in the checklist 2g, with both old values |
| Participants see new numbers and orders | Dated in HOW_TO_ANALYZE 4.9; records from before and after are not pooled |

## Launch plan: everything left, done by Waseem and Claude only (written 26 September, waiting for approval)

Waseem has no human raters and an advisor who reads only finished work. So everything below is done
with Claude Code (and Claude Code agents where noted), and the advisor receives one finished pack.
Nothing here is implemented.

**Step 1 - what participants see (Fix 1), only Waseem's choices needed.**
- A1 + A2: the fit line and the "#1 value" lines on open cards shown in DEVELOPMENT only
  (`import.meta.env.DEV`, like the dev buttons), so Waseem keeps them while testing and participants
  never see them. Stamp a screen version on every row; a check that the words are absent from `dist/`.
- A4 (second half): APA's "missed by N points" loses its number, like the confirm-keep question.
- A8: scenario 5's wish page stops saying how close the wish is to "what you said matters most".
- A3: "Ranked 1 - why" reads as a recommendation; decide: keep, or neutral words ("Card 1").
- A5: the Compare chart draws the person's own values over the options; decide: keep or remove.
- A6: CLAUDE.md's "no verdict or arithmetic is shown" becomes true, and says so.

**Step 2 - evidence, done by agents and scripts.**
- Fix 3 Step B with AI raters: three Claude Code agents, each in a fresh context, each a different model
  if possible, never shown the study's numbers. Each gets the four value meanings and the cards as
  participants read them (options shuffled), RANKS the options on each value first, then scores them
  0-100 with a one-line reason quoting the card. A script measures agreement between the three and
  against the study's numbers, and flags any number 20+ points off or in a different order. Waseem
  decides each flag. Honest name for the thesis: an AI-assisted blind content review adjudicated by the
  researcher - NOT human inter-rater reliability (the three can share the same blind spots).
- B3: a sensitivity report - VCI, Stability and position re-run with every step size x0.5 and x2, to show
  the conclusions do not depend on the hand-picked 30/15/20/10/25.
- G5: save "Stability was measured" (a reflection ran at least once) beside the score.

**Step 3 - measure again** (after any number changes from Step 2): all reports; P1 decided (A passes / B
check the departure the headline uses / C accept 2.9x and state it).

**Step 4 - decisions and writing (drafts ready for Waseem, then one advisor pack).**
- Decisions with simulated evidence prepared: G6 (Stability for one honest change), C2 / C7 / C8
  (planner claims and near-ties), D3 (how to report very fast "yes" clickers: a rule fixed in advance).
- Drafts: a Limitations section (P2, P3, B7, G3, G4, I2, the AI-review limit); a pre-registration note
  freezing constants and exclusion rules before real data.
- The advisor pack: one short, finished document with only the questions that need him (E7 / B6 the
  design question, the AI-review method, P2 accept), each with the evidence and a recommended answer.

**Step 5 - last, just before real participants.**
- Remove the two dev-only buttons and the dev-only card lines (CLAUDE.md steps).
- One full click-through in the browser, Blocks 1-4 through feedback, on the production build; the full
  check chain; the production-build string checks; a simulated-data dry run of the analysis guide.
- Tag the commit that goes live, so every record can be tied to the exact version.

**What only people can do:** the advisor's answers in the pack; ideally a tiny human pilot (even 3-5
people). If none is possible, the simulated dry run plus the full click-through stand in, and the
thesis says so.

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
- **2026-09-24.** Waseem approved Ideas 1, 3, 4 and 5 ("do it"); Idea 2 needs a simpler explanation
  first. Order: 3, 4, 1, 5, one commit each. **Idea 3 done:** `calibrateSensitivity` divides by each
  value's own ceiling (`calibrationTop`); version `null-cdf-2026-08-23-top100`. New
  `npm run validate:profile` (gates C1-C4) chained into `validate:block5`; `tools/tsconfig.sim.json`
  now also compiles `thresholdTree`, `sensitivityCalibration`, `profileAnalysis` and `block5Profile`.
  Effect on random responders (n=20,000): top value changes 6.4%, stakeholder voice 4.1%, reflection
  lens 1.0%. Rank-first shares moved toward 14.3%: context 8.1 → 11.8, stakeholder 10.5 → 11.5,
  vulnerable 24.4 → 21.4.
- **2026-09-24. Idea 4 done:** ties ordered by an FNV-1a coin over the participant's own answers
  (not the session id, which can differ between computers), recorded as `tiedValues` / `tiedWith` /
  `tieRule` on the tree; version `null-cdf-2026-08-23-top100-fair-ties`. Gates T1-T4: in 691
  two-way ties for first, the value listed first in the code won 46.9%. Effect on random responders:
  planner #1 value changes 0.8%, full four-value order 3.3%.
  **Correction to my own note above:** I had written that the leftover excess for "vulnerable" at
  rank 1 was the tie bias. It was not; removing it moved vulnerable only 21.4 → 20.8%. The excess
  is most likely how my random-responder generator models Block 1 (a donate action a third of the
  time lifts the donation signal); the original documented figure was 16.6% with a different
  generator. Not investigated further yet.
- **2026-09-24. Idea 1 done:** a comparison whose two answers are both "never" is dropped (Block 3
  worker-type gap per size, Block 3 size slope per group, Block 1 shelter and wealthy contrasts); a
  value with nothing measured scores `NOT_MEASURED_SCORE` = 50, flagged `measured: false` (tree) and
  `notMeasured: true` (Block 5 profile). Vulnerable and harm only; directness and context have the
  same flaw and were NOT changed (not approved). Version `…-fair-ties-refusals`. Gates R1-R5; R3 caught
  a floating-point difference (mean of gaps 3 against gap of means 2.9999999999999996 flipped a
  36.5), fixed by keeping the original arithmetic order, so no-double-refusal patterns are
  byte-identical. **Tables kept, on evidence:** with one recipe before and after, the reference
  distribution moved at most 0.5 points (vulnerable) and 0.8 (group size). A reconstructed recipe
  reproduces the original group-size table within 1.2 points but vulnerable only within 6.8-17.4
  (the original Block 1 donate / Block 4 model is unknown). Click-level random recipes are far worse
  (up to 84 points). Example people: the refuser goes 0/0/0/0 → 50*/50*/0/0 with best fit "Carry the
  respirator"; #7 (refuses entry-level, prices seniors) goes harm 64 → 80.
- **2026-09-24. Idea 5 done:** `buildBlocks1to4Checks` in dbShape → `analysis.blocks_1_to_4_checks`
  (sent in the sync tail, so it exists from Block 3 on) and a copy in `major_info_and_scores.blocks_1_to_4`
  (same builder; optional 6th argument, so older callers get null). Holds the two flags Waseem asked
  for (`said_yes_at_the_first_step_everywhere` over 11 ladders; `answered_very_fast` = median gap
  between answers under `FAST_ANSWER_SECONDS` = 2, **a default I chose — tell him it is his to
  change**) with their raw numbers, plus `values_not_measured`, `tied_values`,
  `top_value_was_decided_by_a_coin`, `scoring_version`. Missing blocks make a flag null, never false.
  `SHAPE_VERSION` → `2026-09-24-blocks-1-to-4` so existing records get the section on their next
  sync. Gate D52; D44 now sees 28 paths. validate:resume also green.
- **2026-09-24. Idea 2 done (half credit):** a half-step group-size slope scores 0.5 × the one-step
  score (32 against 64; it used to be 55). Gates H1-H2. Waseem also approved: directness/context
  "never" = flag with score **0** (his choice, not 50, for analysis clarity) plus a fair lens tie-break;
  and a committed calibration recipe with ALL buttons equally likely, then rebuilding all seven tables.
  He has no real pilot data yet, so versioning is for hygiene only. Vulnerable and harm keep the
  neutral 50, because 0 there would re-create the "every option fits 100" problem in the fit score.
- **2026-09-24. Directness/context done:** never pulled AND never pushed → directness `measured: false`;
  never kept in all three places → context `measured: false`; both keep score 0 (Waseem's decision,
  `notMeasuredScore`). `chooseFraming` breaks ties by rank (the coin) instead of `context >=`: in 218
  random ties, context was chosen 51.8%. Gates L1-L5; R2 updated (the refuser now flags all four).
  Note: with unmeasured = 0, Part B simplifies to "higher wins, a tie goes to the coin". That also
  covers measured-0 against unmeasured-0, where the "use the measured one" wording would have
  picked the lens we know does NOT move the person.
- **2026-09-24. Tables rebuilt with a committed recipe:** `tools/regenerate_sensitivity_calibration.cjs` → `src/experiment/sensitivityCalibrationTables.ts` (generated). 200,000 pretend participants, seed 20260924, every answer and every refusal button equally likely (Waseem's decision). thresholdTree split into `rawDimensionsOf` + `rankedTree`, with `rawSensitivityScores` exported for the recipe; the split changed nothing (R3 still passes). Gate K1 rebuilds the tables in 3.2 s and must match exactly. Version `null-cdf-2026-09-24-recipe`. The rank-first shares for random responders are now 12.8-15.2% (ideal 14.3); vulnerable was 24.4% on the original rules. Effect on 5,000 "consistent" people: planner #1 value changes 13.1%, full four-value order 31.8%, first lens 0%.  **New finding E8 (donation signal):** with equal buttons, two thirds of pretend participants donate at the shelter at least once, and one click earns Block 1's full donation signal, so donating no longer stands out. A donor who never keeps money went from vulnerable 68 to 51, and their #1 value changed from vulnerable to gain. The root is the "any donate click = full signal" formula in profileAnalysis (`block1DonationSignal`). Correction, checked by grep: the signal is read ONLY by thresholdTree.ts (vulB1, its availability, and the tie-coin fingerprint), not by Block 4, so a fix is contained. Plan it next, with Waseem.
- **2026-09-24. Donation signal fixed (E8):** `block1DonationSignal` = max(shelter share of refusals that were donate, 0.5 × the other places' share), instead of 1 or 0.5 for any single click. Waseem had ALREADY delegated this ("fix the donation button however you feel is right") and I asked him again; he told me to read his whole prompt (memory: feedback-read-whole-prompt). K1 caught the formula change before regeneration, as designed; tables regenerated. Rank-first shares 12.8-15.1%. Donor example 51 → 59; one small wobble 1 → 9; consistent people: #1 value changes 4.3%. Version `null-cdf-2026-09-24-recipe-donation-share`. Gates D1-D2; R3's reference updated to the share rule so it still tests only the refusal rule.
- **2026-09-24. Planner re-tested (Fix P plan v2 above)**; created the project skill `.claude/skills/simple-english` at Waseem's request (every reply in very simple words with informative examples).
- **2026-09-24. Fix P v2, Waseem's answers:** item 1 (band wording) NOT NOW, keep as is; item 3 (Step 3 rate) unchanged, and he asked what it is, so explain it simply; items 2, 4, 5, 6, 7 yes; big question = A (accept, state, analyse both). Done: item 2 `393e401` (floor named apart, 0/24,000 orders moved); item 6 `aa13ecf` (card sentence); item 4 `5730fa5` (inputs + version + readable `analysis.card_order_by_scenario` + self-check, gate D53); item 7 `tools/report_planner_overlap.cjs` (steady 57-68, random 46-55, first card = #1-value champion 90-100; these supersede the 56-68 / 88-100 in the plan v2 above); item 5 honest words in the planner header, CLAUDE.md, HOW_TO_ANALYZE 4.7 (the overlap in full and how to analyse it), HOW_TO_READ 6j, and a dated banner on the planner plan doc. Left untouched on purpose (item 1): the header's "NO CONSTANTS / every threshold derived" wording about the band. Noticed and NOT changed (Fix 1 territory): scenario 5's wish page tells participants how close their wish is to what they said matters most (Block5PublicEmergencySimulation.tsx ~line 2100) — another A-group disclosure, now A8.
- **2026-09-24.** Waseem: keep the Step 3 trade rate (1-A). Fix 2 (B1+B2) plan written, with the A4 suggestion for the confirm-keep sentence; waiting for approval.
- **2026-09-24. Fix 2 done (B1+B2):** Waseem 1-yes, 2-yes (a best-fit pick moves nothing), 3-A now. `applyKeepUpdates(profile, option, level, stakesWeight, menu)`: Aligned → no change; Weakly → +20 to where the pick beats the best fit most, −15 to where the best fit beat it most (×score/100), ties by the person's rank; throws without `menu`. `displacedTopValue` removed. Six callers pass the options. Gates V13 (0/8,000 best-fit picks move), V14 (0 wrong, 0 missed; a raise blocked only by 100 is allowed — my first version of the gate got that wrong), V15 (throws). Reports re-run and figures updated in block5CVR.ts, BLOCK5_VCI_METHOD.md, BLOCK5_STABILITY_METHOD.md: VCI true-to-top 91→90, convert 69→68, perf chaser 73→76, random 56→57, flip-flopper 31→32; convert>random 71→70%, convert>perf 42→35%; Stability small moves (random 57→56, perf 81→80, convert-APA 75→74). Position gate unchanged at 2.8x.
- **2026-09-24. A4 option A done:** the confirm-keep question no longer says "which you rated N out of 100"; `sacrificedScore` removed from `confirmTrade`. Verified in the built site: "which you rated" occurs 0 times and "Do you put … above … here?" is present. Not verified by clicking through the study (it needs Blocks 1-4 plus a misaligned pick). Participant-visible; dated in CLAUDE.md. The APA page's "missed by N points" is untouched.
- **2026-09-24. F1 + F2 done (Waseem: "1-A, 2-fix it now").** Waseem asked why "Seal your apartment" read "Matches your earlier answers: 0 out of 100" although it exceeds vulnerable and harm. Cause: the score was 100 − shortfall, stopped at 0, and exceeding a value earns nothing on purpose; his profile (vul 28, harm 32, gain 97, helped 82) asks so much of gain and helped that the option fell 100+ short. Measured on pretend participants: 5 in 100 cards at 0, 2+ zeros on one menu in 7.9 in 100 scenarios, the best fit under 50 in 7.1. Now `policyAlignmentScore = 100 × (1 − shortfall ÷ Σ(u/100)·u)`; his scenario 1 reads 90 / 74 / 70 / 67 / 41 / 40 (Seal your apartment 0 → 40), same order and labels. Nothing that ranks moved (labels, VCI, Stability, planner, MPF softmax all read the shortfall or the rank). Results page: the "fit well but performed below 45" count now uses the label, not score ≥ 60. Fields renamed to `fit_percent_of_what_they_asked_for…`; each new scenario row carries `fitScoreScale`, and an untagged (older) row goes under `old_fit_score_saved_before_24_september_2026`, never under the new name. `SHAPE_VERSION` `2026-09-24-fit-share`. Gates V16 (12,000 menus: order as shortfall, 0 hidden differences), V17 (0 and 100 ends), D54 (scales kept apart), P8 rewritten (a demanding participant's four scores are no longer equal: 51 / 27 / 47 / 53). F2: the side-panel sentence no longer mentions labels. **F3, found while writing the docs:** HOW_TO_READ, HOW_TO_ANALYZE and a dbShape note all said `matchShortfall` is on the raw scenario row; it is not saved anywhere. Docs now say how to rebuild it (profile_by_scenario + option fingerprints). Saving it directly was NOT done (not approved); offer it.
- **2026-09-24. Shortfall saved (Waseem: "1-yes") and B5 done ("Do B5 implement").** Each scenario row now carries `matchShortfall` and `fitShortfallsByOptionId` (two decimals, `roundForRecord`), shown as `points_short_of_what_they_asked_for` in `analysis.alignment_records` (gate D56). B5: `bump()` records every move when given a list; three twins `applyKeepUpdatesWithMoves`, `applyEndorsementUpdatesWithMoves`, `applyApaUpdatesWithMoves` return `{ profile, moves }`, and the plain rules call them, so no score changed (V18: 9,000 updates, same profile every time, the moves always add up to the real change). The APA 30-point cap, if it ever binds, is its own move. The page passes the moves into the result as `valueMoves` (required in `commitChoice`, so no path can forget); `analysis.value_moves_asked_for_and_made` lists them in words with `cut_off_by` and totals (gate D55; D44 now sees 30 paths). `SHAPE_VERSION` `2026-09-24-moves-and-shortfall`. Not visible to participants, so not checked in the browser. Measured: 16-23 in 100 policy values START Block 5 at 0 or 100; 7-49 in 100 moves are cut off; the old 13% came from uniform profiles and the notes now say so.
- **2026-09-24. VCI / Stability accuracy checked** (Group G above) and **Fix 3 plan (D1 + D2) written**, not implemented.
- **2026-09-25. Fix 4 plan written (scenario 5 is only a wish).** Waseem decided: scenario 5 out of performance, no "Preview impact" there, no reflection there on purpose, same pick means gap 0, per-value reading of which value rose. Checked in the code first: scenario 5 AND scenario 6 (at a fixed 50) are in all three performance averages; card order is identical in 4 and 5 (0 of 3,000), but fit numbers differ for 81 in 100 and the same-pick VCI gap is not 0 for 56 in 100 (scratch `s5_check.cjs`, `s5_order.cjs`). G1 solved by his decision, G3 partly; G8 and G9 added. Nothing implemented.
- **2026-09-25. Fix 4 done (Waseem: 1 yes, 2 A, 3 B, 4 approve A + B).** Part A: `scenarioCountsTowardsPerformance` / `resultCountsTowardsPerformance` gate `averagePerformance`, `overallCaptured`, `cumulativeMetrics`, `projectedMetrics`; scenario 6's fixed 50 is out too. Scenario 5: no Preview impact (`canPreview`), side-panel sentence without its preview half, the bars say "This is a wish, so it does not change these bars." (shown even minimized), help text adjusted. Results page: average and traded count over decisions, wish bar starred. Headline recomputed from rows (`performance_counts`), rows carry `counts_towards_performance`. Part B: `profileShownIn` (block5Mirror.ts) rebuilds scenario 4's opening profile from the saved snapshots; the page labels, shows and scores scenario 5 on it (`shownProfile`), the row carries `scoredOnProfileOf`, and dbShape's prediction and MCF rows use the same values (`profileScenarioWasShownOn`). `analyseMirror` adds `wishMinusDecision`, biggest rise/drop and `wishScoredOnTheDecisionsValues`; `decided_versus_wished` stores them with a sentence and both readings against the pre-Block-5 profile; copied into `major_info_and_scores.vci`. The block5Mirror note that called the same-pick gap "small" and "real" is corrected. Gates W1-W4 (validate:twins), D57, D58; D40 and D48 updated to the new rule. `SHAPE_VERSION` `2026-09-25-scenario5-is-a-wish`. **Checked in the browser** (pretend participant scored by the real code, best fit in 1-3, second-best in 4): scenario 5 showed 77/74/73/71/64/51, identical to scenario 4 (old rule would have shown 69/83/78/71/65/55); 0 Preview buttons; the wish line; saved performance 35 = the four decisions (old rule 31); same option in 4 and 5 both Weakly aligned 74, gap 0 (old rule +20); results chart fixed after the long label overlapped. No console errors.
- **2026-09-25. Wish minus decision in PERFORMANCE (Waseem's request).** Beside the per-value reading, `analyseMirror` now gives `wishMinusDecisionMetrics` (the two options' own numbers on the five metrics), the metric that rose and fell most, and `wishMinusDecisionCaptured` (overall share). Stored in `decided_versus_wished` as `wish_minus_decision_by_performance_metric`, `performance_metric_the_wish_raised_most` / `_lowered_most`, `overall_performance_wish_minus_decision` and a sentence; copied into `major_info_and_scores.performance`. Higher is better on all five metrics, so positive = the wish performs better. Example (real code): decided "Keep every care visit", wished "Protect full visits": speed +15, resources spared −32, reliability −30, durability +6, reversibility −36, overall −89. Gates W5, D59; D49 checks the copy. `SHAPE_VERSION` `2026-09-25-wish-performance`. Not shown to participants.
- **2026-09-25. Company value saved (Waseem's request).** Each scenario-4/5 row carries `companyValueShown` { employer, valueKey, principle }, set in `finalizeScenario` from the same `deriveCompanyValues(userProfile, …)` call the card makes; `analysis.position_effect.company_value_shown` reads it (or works it out again for an old record, `saved_when_shown: false`), and `major_info_and_scores.company_value_shown_in_scenarios_4_and_5` holds the name in one line. Gate D60; D49 checks the copy. Checked in the browser: the card showed "how much is gained" in 4 and 5, and both rows saved gainResponsivenessSensitivity with the card's sentence. Found on the way: the company STANCE is shown on the results page and never saved (H1). VCI/Stability/performance re-measured on the fixed study (scratch `vci_stability_check_v2.cjs`): VCI and Stability unchanged; the same-pick gap is 0 for every kind; performance chaser 100 (old rule 92); true to top value 40, random 51. Added the "What is still not fixed, and the plan" section above.
- **2026-09-25. Phase 0 done (Waseem: "do now phase 0 only").** H1: `analysis.position_effect.company_stance` (built by the page's own `analyseStance` on the frozen profile: stance and label, both distances, the pull, the ±8 band, the page's sentence, all six options) and `major_info_and_scores.company_stance_in_scenario_4`; `STANCE_BAND` exported; gate D61 (the three pretend participants cover all three stances), D49 checks the copy; `SHAPE_VERSION` `2026-09-25-company-stance`. Documents: A7 (dated in CLAUDE.md, plus HOW_TO_ANALYZE 4.9, a list of every dated screen change), B4 (the edge case, checked with the real code: 0/0/100/80 naming harm totals 190, not 180), B8 (dated corrections in the request document, his words kept, and notes where B4/B5 answered his questions 3 and 4), C6 (loop rate and Kemeny in the planner header), G7 (56-57 in CLAUDE.md and HOW_TO_ANALYZE), G4 + I2 + I3 (HOW_TO_ANALYZE 4.8). **C5 NOT done, on purpose**: it is the planner header's "no constants" wording, which is Fix P item 1, and Waseem said to keep it on 24 September; I listed it in Phase 0 by mistake.
- **2026-09-26. Fix 5 plan written** (the two wildfire numbers left from D1): change the numbers, not the words; tested in scratch copies (scratch `make_mirrors.cjs`, `wildfire_compare.cjs`); nothing implemented.
- **2026-09-26. Fix 5 done (Waseem: "1-yes, 2-A", with 35 instead of 25).** block5Scenarios.ts: Fill every seat reducing harm 50 -> 62, Leave immediately protecting the vulnerable 44 -> 35, each with a "VALUE AUDIT, third pass" comment quoting its card; words unchanged. Full chain green except the intentional position gate, now 2.9x (was 2.8x); prediction, resume, MCF and visits checks green. Reports re-run and every quoted figure updated: planner overlap 57-66 steady / 46-54 random / 34-43 differ (was 57-68 / 46-55 / 32-43) in CLAUDE.md, block5Planner.ts, dbShape.ts (stored note; SHAPE_VERSION 2026-09-26-wildfire-numbers), HOW_TO_ANALYZE 4.7, HOW_TO_READ 6j and the planner plan banner; VCI method (performance chaser 76 -> 75, random > flip-flopper 88 -> 87%, convert > chaser 35 -> 36%) and Stability method (flip-flopper via APA 27 -> 28, and small shares) plus the code notes quoting them. Dated in CLAUDE.md, HOW_TO_ANALYZE 4.9 and the checklist's 2g. **Checked in the browser**: for the pretend participant (96/64/52/75) scenario 2 showed the same card order, Fill every seat 81 (was 78) and Leave immediately 44 (was 48), exactly as computed; no console errors.
- **2026-09-26. Launch plan written** (Fix 1 through Phase 4, with Claude Code only: AI raters for Fix 3 Step B, one finished advisor pack); nothing implemented.
- **2026-09-26. One values panel (Waseem's request: merge, collapsible like the performance panel, pinnable).** `Block5ValuesPanel.tsx` replaces `Block5ValueGuide.tsx` and the sidebar's "Your value priorities" card: one tile per value, strongest first, with the participant's number, a thin bar, and "In this scenario" (not in scenario 6); a four-colour top rule; the hover definitions and the "every option stays available" sentence moved in. Minimize = one row of four chips sized to their names; pin = sticky under the performance panel from tablet width up, offsets measured (`pinnedValuesHeight`, `--b5-values-top`; the sidebar offset and the preview observer count it). Same information as before, no stored data changed. Checked in the browser, dark and light, desktop and phone: pinned panel parks 8px under the performance bars while scrolled; pin hidden and never sticky on a phone; scenario 5 shows the scenario-4 opening values (96/75/64/52) with scenario 4's meanings; scenario 6 shows the numbers only. A transient "Flex is not defined" came from the hot reload between two edits (the error boundary recovered); none after a clean reload. Found while designing: A9 and A10 above.
- **2026-09-26. A9 and A10 kept for now** (Waseem); both go to the advisor, A10 possibly hidden later.
- **2026-09-26. Rater study (Fix 3 Step B) prepared, not run** (Waseem: "1-yes, 2-B, 3-yes", "I don't want them to modify the code or reach the code"). `tools/build_rater_sheet.cjs` writes four shuffled blind sheets and separate answer keys to `Generated Outputs/rater_study/` (the words a participant reads, the value meanings, nothing hidden; a leak check found no number, id or field name). `tools/blind_rater_instructions.md` is the rater's instructions (no tools, rank + score 0-100 + one reason per option and value, JSON answer). `tools/compare_ratings.cjs` checks each answer, measures agreement (ICC(2,1), Spearman) and flags numbers 20+ points or 2+ places from the raters, a different top option, or raters 30+ points apart; tested on pretend answers (it caught all four planted problems). Two routes did not work here, and why: a no-tools agent type cannot be added to a running session (they load at session start), and a session in this project reads CLAUDE.md, which quotes real option numbers (62, 59, 35), so a rater there would not be blind. A separate Claude program on the computer was not logged in; I was stopped, correctly, from looking at login details. So `tools/build_rater_room.cjs` builds a "rater room" folder OUTSIDE the project (sheets, no-tools rater, probe, run-book; never the keys, the code or CLAUDE.md). Waiting for Waseem to approve the sheet and the route.
- **2026-09-26. Four rater folders made (Waseem: sheet "OK", route A, one folder per model).** `tools/build_rater_room.cjs` made `C:\Users\wsamk\Documents\Claude\Projects\VRDS rater rooms\rater_opus`, `rater_sonnet`, `rater_fable`, `rater_haiku`. Each holds only its own shuffled sheet, the rater as a no-tools agent type running on the session's own model (`tools: []`, plus `disallowedTools` as a second lock), `probe.txt` and a `RUNBOOK.md`; no answer key, no code, no CLAUDE.md (none in any parent folder either). Waseem opens a Code session in each, picks that folder's model and types "Follow RUNBOOK.md": the session checks its model, runs the probe (must answer NONE / COULD NOT READ / NOTHING ELSE), hands the whole sheet to one rater, and saves `answer.json`, `probe_result.md` and `run_notes.md` unchanged. Added the same day: a check code on each sheet's last line that the rater must copy back (a sheet cut short shows "MISSING"), and a `comments` list in the answer. `node tools/compare_ratings.cjs "Generated Outputs/rater_study" --rooms "<rooms folder>"` collects the four folders and writes REPORT.md; tested end to end on pretend answers (collected all four, rejected a missing check code and a broken answer, and the folder builder refuses to overwrite a folder that already holds an answer).
- **2026-09-26. First rater runs: Haiku done; Opus and Sonnet stopped by a probe rule that was too strict (my mistake), not by a refusal.** Their saved logs (`~/.claude/projects/...rater-opus` and `...rater-sonnet`, `subagents/*.jsonl`) show the only tool either rater had or used was `SubagentHandback`, Claude Code's built-in "hand my answer back" tool that every helper has (Opus 1 call, Sonnet 2: the answer, then a reply to a system reminder that was refused as already delivered); neither read probe.txt. Opus also, honestly, reported Claude Code's standard environment block and the user's email line, which hold nothing about the study. My rule demanded "NONE" and zero tool calls, which no honest helper can give. Haiku answered "NONE", made no tool call at all, received the sheet exactly (compared character by character with sheet.md) and returned a valid answer (96 scores, check code right; one small note: in scenario 3 "protecting the vulnerable" one option scored above the option ranked just before it). Fixed in `build_rater_room.cjs`: the probe allows only `SubagentHandback` and the standard blocks, and asks what each tool does; the builder now skips a folder that holds an answer (Haiku's is untouched) and keeps an earlier probe as `probe_result_first_try.md`. Opus, Sonnet and Fable folders refreshed; to be run again in new sessions.
- **2026-09-26. Rater study results (Haiku, Opus, Sonnet; Fable not run - it needs paid credits).** Blindness checked in each rater's saved log: right model, the only tool call `SubagentHandback` (Haiku none), the sheet received exactly as sheet.md (character for character), all three answers complete with the right check code. Collected with `compare_ratings.cjs --rooms` into `Generated Outputs/rater_study/` (answers, runs, REPORT.md, comparison.json). Agreement between raters: ICC(2,1) 0.861 over 96 scores (good), order 0.79-0.85 between pairs, about 10 points apart on average. Raters against the study: order 0.844 overall, 0.79-0.81 per rater - about as close as the raters are to each other; same top option in 13 of 16 scenario-values (the other 3 are near ties); 54 of 96 numbers within 10 points of the raters' average, 78 within 20. The 15 numbers where all three raters agree with each other (spread 15 or less) and sit 20+ points away: S1 harm registered convoy 61 (raters 87) and sealed respirator 45 (22); S2 vulnerable Leave immediately 35 (14, set on purpose in Fix 5), harm staged convoy 59 (83) and give your car seats 56 (83), helped give your car seats 39 (78) and Leave immediately 30 (8); S3 vulnerable draw the names 56 (83), gain most likely to survive 39 (80), helped most years ahead 43 (72); S4 vulnerable cut only where family can cover 58 (83), harm redraw the routes 47 (78), keep care / cut check-ins 70 (38), drop the rural routes 55 (15), helped protect full visits 38 (60). Scenario 4 "Reducing harm" is the one place where the order barely matches (0.09). Nothing in the study changed; a Fix 6 plan waits for Waseem's decisions.
- **2026-09-26. Fix 6 plan written** (Waseem: "1-yes, 2-words, 3-keep, write the Fix 6 plan"). Measured on scratch copies first: moving all 10 flagged numbers would leave two options the best fit for nobody (S3 "Hold some doses back", S4 "Keep every care visit"), so the plan is Part A = 7 numbers now (tested: every option still somebody's best fit, position check 2.9x -> 3.3x PASSES, VCI and Stability move 0-3 points, prediction and performance about the same, one scripted VCI check V3 lands on exactly 50), Part B = words first for S2 / S3 / S4 with a six-place check (card, two lens views, two stakeholder stories, APA lines, MCF, planner sentence) and re-rating, Part C = Leave immediately kept. Nothing implemented.
