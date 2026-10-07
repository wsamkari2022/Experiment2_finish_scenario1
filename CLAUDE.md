# VRDS Experiment 2 — notes for anyone working in this repo

A PhD study: participants answer four short blocks, then five emergency scenarios, then see their
results, then give feedback. React 19 + Chakra UI v3 + Vite + TypeScript.

## Before analyzing any collected data

**Read these three, in this order.**

1. `Generated Outputs/HOW_TO_READ_MY_DATABASE.md` — the data dictionary for the MongoDB
   `participants` collection: every field, what it means, which numbers are raw and which are
   computed, and a list of traps that produce confident but meaningless findings.
2. `Generated Outputs/HOW_TO_ANALYZE_MY_DATA.md` — which questions the data can answer, which
   analyses answer them, what may and may not be claimed, and which figures to build. Written for a
   person or an AI agent arriving with no other context.
3. `docs/ANALYSIS_AND_FIGURES_PLAN.md` (since 27 September 2026) — the full plan for the paper: the analysis
   tables to build, every analysis and figure with its database field and test, how the measures relate, the
   feedback links, and the hypotheses to freeze in `docs/PREREGISTRATION_FREEZE.md` before the data is opened.

**The document carries no stamp of the study code's version** (`SHAPE_VERSION` lives only in the browser's sync
state; found 27 September 2026). Date records by `completed_at`.

Two of those traps matter enough to repeat here:

- **Filter on `status: "Study Completed"`.** Unfinished runs hold real but partial data and will
  quietly bias every average.
- **`headline` and `analysis` are derived from `blocks`.** Correlating a derived field with the raw
  field it came from is not a finding.

## The four conditions and the landing page (since 1 October 2026)

The researcher's design (his words): four conditions - **1 CVR+APA** (the current, full version), **2 CVR_Only**,
**3 APA_Only**, **4 Baseline** (no CVR or APA). All four share Blocks 1-4 (building the profile) and differ from Block 5
to the end. **What each condition does differently is built one task at a time**, when he gives it ("do this task to
CVR_Only"); a condition without a built task runs exactly today's study. Built: **CVR_Only's CVR Rejection page**,
**APA_Only's straight-to-APA flow** and **Baseline's confirmation page** (the next three sections), so all four now differ;
since 3 October 2026 also **Baseline's cards without the fit score and the ranking reasons, with one confirmation page for
every choice** (its own section below).
Code that makes a condition differ reads `currentCondition()` through one rule per task in `conditions.ts`
(`showsCvrRejectionPage`, `skipsCvrReflection`, `confirmsMisalignedChoices`, `freezesReflectionScores`, and since 3 October
2026 `hidesFitAndRankingReasons`, `confirmsEveryChoiceAlike`); a participant with no condition on record (a test run from before this date) counts as
condition 1.
Plan answers "Q1-B, Q2-yes, Q3-yes". **Participants see it** (a one-second landing page; the address); HOW_TO_ANALYZE 4.9.

- **The landing page** (`LandingPage.tsx`, flow stage `landing`, never saved as a stage): a browser without a
  condition sees "Preparing your study…" for about a second before the start screen. It asks the server
  (`POST /api/conditions/assign`), which gives the condition with the FEWEST people and a tie at random
  (`server/conditions.js`). **Who counts ("Q1-B"):** finished, plus still working (the record changed in the last 2
  hours, `updated_at`), plus just arrived (given in the last 30 minutes, not yet at the demographic page, where the
  record is first made). A drop-out stops counting after 2 hours, so the finished numbers come out equal. **One at a
  time**: assignments take turns, so two people in the same second never both get the same one (since 6 October 2026
  everybody waiting when a turn starts is served from ONE reading of the database, still one after another; see "Many
  people at once" below). The arrival id is saved before the request, so a refresh asks for the same arrival
  (`condition_arrivals`, unique).
- **The address shows it** (`?condition=CVR_APA`, `CVR_Only`, `APA_Only`, `Baseline`; "+" would read as a space),
  always the SAVED condition: an address naming another one is corrected. **A tester may open a condition's address
  directly ("Q2-yes")**: saved with source `address` and never counted. No server: a random one, source
  `random_offline`, never counted - **in development only since 6 October 2026**; the live site never picks at random
  (it offers "Try again"). Participants never see their condition on the page.
- **Saved once, never changed.** The browser file `vrds_condition` (with `owner`, the email once known); the server sets
  `condition_number`, `condition_type`, `condition_source`, `condition_assigned_at` on the participant document only
  when it has none (`condition_type: { $exists: false }`), and links the landing page's arrival. A returning participant
  on a new browser gets THEIR condition from the record and the new arrival is released (`/api/conditions/release`).
  **Since 7 October 2026 (the researcher's "A") so does somebody who already FINISHED**: when either first page sees a
  finished email or Prolific ID, the condition the landing page just gave this browser is released (`onFinishedSeen` in
  ExperimentFlow, only a condition nobody owns; storage gives each arrival back once). Before, it counted as "just arrived"
  for 30 minutes and the balance was off by one; the file stays, so a next person on that computer counts once their
  record is made. `validate:conditions` N26 (5 breaks, 5 caught); live in both doors (the two arrivals released, neither
  counted).
  A second person on the same computer gets their own (`clearConditionFromAddress` first: the address still named the
  first person's condition, and the landing page would have taken it as a tester's, uncounted - found on re-reading
  and checked live). The file does NOT travel in `resume_state` (a new browser's
  provisional condition would be merged over the saved one).
- **"Condition number" and "condition type" beside the demographic data** (his request): `conditionNumber` and
  `conditionType` in `vrds_demographics`, the four top-level fields above on the document, and a copy in
  `major_info_and_scores.condition` (with `counted_for_balance`). `SHAPE_VERSION` "2026-10-01-conditions".
- **The count page ("Q3-yes"):** `/api/conditions/report` (also `/api/conditions/counts` as data): counted now,
  finished, working, just arrived, and every record ever by source; numbers only, refreshes every 30 seconds.
- **The same list lives twice** (`src/experiment/conditions.ts` and `server/conditions.js`, which cannot import
  TypeScript); N1 fails if they differ. `conditions.ts` is listed in `tools/tsconfig.dbshape.json`.
- **Checked:** `npm run validate:conditions` (N1-N10, in the chain before `validate:position`); 14 deliberate breaks, 14
  caught. Live against the local database: 8 new visitors gave 2 in each condition; a full enrolment saved the fields in
  the demographic file and on the record and moved the person from "just arrived" to "working" without counting twice; the
  same person on a cleared browser got their own condition back and the new arrival was released; a second person on the
  same computer got a fresh, counted condition; an address naming
  another condition was corrected; a tester's `?condition=APA_Only` was not counted; the count page showed it all.
- **For Prolific later** (docs/PROLIFIC_CONVERSION_PLAN.md): the address keeps every other parameter when the condition is
  written into it (N7 tests a Prolific ID), and the owner of the condition becomes the Prolific ID instead of the email.

## CVR_Only: the CVR Rejection page instead of the APA page (since 1 October 2026)

The researcher's first task for a condition: in **condition 2 (CVR_Only)** a participant who refuses their choice after the
reflection (CVR) - "No, not anymore", or a switch after the person speaks - reaches the **CVR Rejection page** instead of the
APA page. Plan answers "Q1-A, Q2-B, Q3-A, Q4-A, Q5-OK", plus "remove 'APA' logo from this page". Conditions 1, 3 and 4 still
get the APA page, unchanged. **Participants in condition 2 see it** (HOW_TO_ANALYZE 4.9).

- **The page** (`CvrRejectionPanel` in Block5PublicEmergencySimulation.tsx, step `cvr_rejection`): the title "A closer look at
  your choice" ("Q3-A"; "CVR Rejection page" is its name in the code and the data, never on screen), an opening in the APA
  page's spirit without its "helps the system represent your priorities" (nothing is asked here), the two situations side by
  side for somebody whose last view was the context one, how far the option fell short ("missed by N points ... fell short on
  X and Y"), "You can go back to all the options and choose again. Every option stays available, including this one.", and
  ONE button, "Go back to all options and choose again" (no warning: nothing to lose). **No question** (no value to name, no
  "how sure", no "which view did more", no option list) and **no method logo**. The two shared parts (`SituationsTable`,
  `ShortfallNote`) moved out of `APAPanel` unchanged, so both pages say them the same way.
- **The moves, automatic, on the FIRST visit in a scenario only ("Q1-A")**, before the page is drawn, on the LIVE profile -
  the researcher: "the changes will happen even if the user [is] still in the same scenario" (`applyCvrRejectionUpdatesWithMoves`
  in block5CVR.ts): the person speaking +25 when their story changed the participant's mind, -25 when it did not (the APA
  page's own rule); the **last** view seen +20 and the other untouched, **only when both views were seen ("Q2-B")**, at the full
  +20 (the APA page scales it by its "how sure" answer, which this page does not ask); the four policy values never, so no
  fit number, label, card order, VCI or four-value Stability moves. A second reflection in the same scenario already uses the
  moved values (seen live: context 8 -> 28 above directness 10, and the next reflection opened on the context view). A refresh
  mid-scenario restarts it from the values it opened with (progress is saved only when a scenario ends), so nothing is counted
  twice.
- **Saved:** the moves lead the scenario's `valueMoves` (reasons "CVR Rejection page: ..."), every visit in `cvrRejections`
  (`CvrRejectionVisit`: option refused, first and last view, both views seen, the reflection answer, whether the person moved
  them, moved or not, seconds), `cvrRejectionVisits` / `cvrRejectionDwellMs` in the timing record (never APA's numbers, so the
  APA feedback section stays hidden - "Q4-A", no feedback questions about this page), leaving it counts in
  `numberOfSwitches`, and `analysis.alignment_records` rows carry `cvr_rejection_page` (shown false elsewhere) with
  `times_cvr_rejection_page_shown` in the totals. `SHAPE_VERSION` "2026-10-01-cvr-rejection-page".
- **Checked:** `validate:conditions` N11 (the moves, both signs, one view or two, the cut at the edges, the four values
  untouched, condition 2 only), N12 (from the source: the routes into it, once per scenario on the live profile, saved, no
  question, no logo, one button, the approved words, the APA page unchanged), N13 (the database rows); 12 deliberate breaks,
  12 caught. Live in condition 2: the page as approved, two refusals in one scenario (the first moved, the second did not),
  the record above; and condition 1 still opened the APA page with its logo and question. `report:major-scores`: only the
  stamp changed (the pretend participants run the full version).

## APA_Only: straight to the APA page, no reflection (since 1 October 2026)

The researcher's task for **condition 3 (APA_Only)**: a misaligned or strongly misaligned choice opens the **APA page at
once** - no reflection (CVR) page and no person speaking - and the APA page shows only its value question ("as it is now
(without context view table, and without two view question)"). Plan answers "Q1-A, Q2-yes, Q3-yes". Conditions 1, 2 and 4
unchanged. **Participants in condition 3 see it** (HOW_TO_ANALYZE 4.9).

- **The flow** (`handleSelect` in Block5PublicEmergencySimulation.tsx): `skipsCvrReflection()` sends a misaligned choice
  in a decision to step `apa` directly, counted as an APA visit (never a CVR one), with no person picked. The APA page is
  unchanged (its logo, the "missed by N points" box, the value question with "How sure", the list of options built on that
  value, the confirm); the two-situations table and the "which view did more" question cannot appear (no view was seen:
  `lastLensSeen` is null). A good-fit choice works as today. To keep a misaligned option, a participant names the value it
  is built on: it is then in the list.
- **The stakeholder, directness and context scores are frozen ("Q1-A")**: nothing in this condition shows or learns them,
  so nothing moves them. The APA rule moved the stakeholder score -25 automatically when no person had changed the
  participant's mind; `applyApaUpdatesWithMoves(..., moveStakeholder)` now leaves it when told to (`freezeReflectionScores`
  on the APA page), and the four values move exactly as before. The finished block carries `reflectionScoresFrozen: true`,
  and the headline writes the three stabilities as null with the label "Not measured in this condition" and
  `reflection_scores_measured: false` (never a 100 that would read "held").
- **Each choice confirmed on the APA page is a Stability step ("Q2-yes")**: the row keeps `cvrFired: true` (what Stability
  and Stability_all count) and says honestly `reflectionShown: false` (going back from the APA page to a good fit is not a
  step; since the audit of 2 October 2026 its card still says "Clarification shown"). **`cvrFired` now means "counted as a Stability step"; "was the
  reflection SHOWN" is `reflectionWasShown(r)`** (block5CVR.ts), which every such reader uses: the results page's badges
  and its second-view sentence, the CVR feedback questions (`shouldShowCvrSection`), and the database's `cvr.fired` (beside
  the new `cvr.counted_as_a_stability_step`). No view, person or reflection answer is stored for these rows, and the APA
  record's `stakeholderInfluenced` is null.
- **The APA page's opening sentence in APA_Only** (the researcher's words, the same day): "This step just helps the system
  represent your priorities the way you truly mean them. There are **no right or wrong answers** here." No reflection came
  before it, so it does not say "a couple of your choices point in different directions"; the other conditions keep that
  sentence (`straightToApa` on APAPanel; N15 holds both).
- **A box naming the value the chosen option serves most** (the researcher's request, the same day: "this selected option
  serves X value more than the rest of the other three values"), APA_Only only, right under the opening sentence: "The
  option you chose serves *X* more than any of the other three values." X is `optionMainValue` (the value the APA list
  groups options by), so somebody who wants to keep their option knows which value brings it into the list. No option in
  the four decisions ties for its strongest value (N14 holds it), so the sentence is always true. Saved as
  `apa.mainValueShown`; the database adds `value_the_page_said_the_option_serves_most` and `named_the_value_the_page_said`
  (the obvious question: did the box steer the value they named?). `SHAPE_VERSION` "2026-10-01-apa-only-main-value".
  Live: the sealed respirator's box said How much is gained; naming it listed the respirator itself; both saved.
- **No "Go back and clear your answers?" warning in APA_Only** (the researcher: "remove the warning ... it will go back the
  all options immediately without the warning message"): both back buttons ("Take me back to all options" and "None of
  these - take me back to all options") leave at once (`leave` in APAPanel). The other conditions keep the warning. N15;
  2 breaks, 2 caught; live: straight back to the six options.
- **The results page says "Clarification shown" ("Q3-yes")** on those scenario cards, never "Reflection shown".
- **Feedback (the researcher: "in APA_only, APA feedback question will appear but no CVR feedback questions"):** the APA
  questions appear after any APA visit; the CVR questions and the two-views questions never do (no reflection, no view).
- `SHAPE_VERSION` "2026-10-01-apa-only".
- **Checked:** `validate:conditions` N14 (the rules, the stakeholder score left alone at every confidence, the four values
  as before, reflectionWasShown, Stability counting the step), N15 (the flow, the page, the honest row, the badge, no CVR
  feedback questions, from the source), N16 (the database rows, the three stabilities, and the feedback: APA questions yes,
  CVR and two-views questions no, also after an APA visit that went back); N12 was taught to set aside
  APA_Only's own route into the APA page. 15 deliberate breaks, 15 caught. Live in condition 3: the sealed respirator opened
  the APA page at once with no table and no view question; naming Reducing harm (sure 4) saved the four values' moves only
  (+27, -9, -9, -9), the stakeholder, directness and context scores unchanged, `reflectionShown: false`, `cvrFired: true`,
  reflection visits 0, APA visits 1. The test browser was restored from a page that does not run the study.

## Baseline: the confirmation page for a misaligned choice (since 1 October 2026)

The researcher's task for **condition 4 (Baseline)**, which has no reflection (CVR) and no APA page: "when the user selects a
misaligned or strong misaligned option, the user will see the confirmation page similar to the aligned or weakly aligned
option but the values will moves if the user confirms ... +30 for the top value of the selected option and -10 for all other
values if it is a misaligned and -15 for strongly misaligned". Plan answers "Q1-B" (the sentence), "scale all moves" (a "How
sure" question, his idea) and "Q2-yes". Conditions 1-3 unchanged. **Participants in condition 4 see it** (HOW_TO_ANALYZE 4.9).

- **The page** (`handleSelect`; the overlay's confirmation page with `confirmOnly`): a misaligned choice in a decision opens
  the confirmation page a good fit gets - no reflection, no person, no APA page, never counted as a reflection visit - with
  two differences: its first sentence is "Before you confirm, take a moment with what this option gives up."
  (`BASELINE_CONFIRM_INTRO`, called `BASELINE_MISFIT_INTRO` until 3 October 2026; "This option fits your earlier
  priorities" would be untrue; "Q1-B" - since 3 October 2026 a good fit gets this page too, see the next section), and
  "How sure are you about this choice?" 1-5 (the APA page's buttons), needed before "Keep this choice" works. "Change my
  mind" goes back and moves nothing. Scenarios 5 and 6 are unchanged (no reflection ran there anyway).
- **The moves on "Keep"** (`applyBaselineConfirmUpdatesWithMoves` in block5CVR.ts): +30 x w to the value the option serves
  most (`optionMainValue`; no option ties for its top value, N14), -10 x w (misaligned) or -15 x w (strongly misaligned) to
  each of the other three; w = the APA page's own sureness weight, 0.6-1.0, so +18 to +30, -6 to -10, -9 to -15. A strongly
  misaligned keep is not zero-sum (+30 in, -45 out): his design, every move recorded. A good fit uses the keep rule, as in
  every condition.
- **The stakeholder, directness and context scores never move** (`freezesReflectionScores` is now APA_Only and Baseline):
  the headline writes their stabilities as null, "Not measured in this condition" (`NOT_MEASURED_IN_THIS_CONDITION`; it was
  `NOT_MEASURED_IN_APA_ONLY`, whose words named APA_Only).
- **Each such keep is a Stability step ("Q2-yes")**: the row has `cvrFired: true`, `reflectionShown: false`, no reflection
  coordinate or views, a timing record that says no reflection was shown, `baselineConfirm` (`confidence`, `valueRaised`,
  `stepDownForTheOtherThree`), and `valueMoves` with reasons "Baseline confirm: ...".
- **The results page:** no badge on those cards ("Clarification shown" now needs the APA page to have run, `!!sr.apa`), and the
  note "This went against your usual values, and you kept it." (the old fallback would have said "you chose to reconsider").
- **Feedback:** no CVR, APA or two-views questions (none of those pages ran).
- **Database:** every `analysis.alignment_records` row has `baseline_confirm` (`kept`, how sure, its weight, the value raised,
  the step up and the step down; `kept: false` elsewhere), and the totals `times_kept_misaligned_on_the_baseline_confirm_page`.
  `SHAPE_VERSION` "2026-10-01-baseline".
- **Checked:** `validate:conditions` N17 (the rule at every sureness and both levels, the researcher's ranges, a good fit
  nothing, the edges recorded, a Stability step), N18 (the flow, the page, the honest row, the results page, from the
  source), N19 (the database, "not measured", no CVR or APA feedback questions); N14 and N15 adjusted for the new route. 16
  deliberate breaks, 16 caught. Live in condition 4: the sealed respirator (strongly misaligned for that test profile)
  opened the confirmation page with the new sentence and "How sure"; "Keep" stayed locked until it was answered; at sure 4
  How much is gained went 52 -> 79 (+27) and each other value -13.5; directness, context and stakeholder unchanged (10, 8,
  0); no reflection or APA visit; in scenario 2 a good fit still read "This option fits your earlier priorities" with no
  question, and "Change my mind" moved nothing. The test browser was restored from a page that does not run the study.

## The major scores in the four conditions (since 1 October 2026)

The researcher's request: the same major-scores page for all four conditions, "after APA_Only and Baseline are built", with
"your explanations and examples after each table". `npm run report:major-scores` now also writes
**docs/MAJOR_SCORES_BY_CONDITION.md**: the 2,000 pretend people x 12 kinds of docs/MAJOR_SCORES_DISTRIBUTION.md through each
condition (`tools/condition_sim.cjs`), with six columns: the four conditions plus the two extra versions he asked for
("Q1: A and B", "Q3: A and B"; Q2-yes the "How sure" answers):

- **Principle A** ("the same person, a different page"): each kind makes its condition-1 choices; only the page and its moves
  change. **Principle B** ("the pages change behaviour"): a refusal needs a page that asks the person to think again, so in
  Baseline (B) the three refusing kinds keep their first pick (B = A in CVR_Only and APA_Only).
- **Random responder in APA_Only:** A every answer random; B half the time names the box's value and keeps its own option.
- **Checks in the generator:** condition 1 reproduces the main page person by person (0 differences, or the command fails);
  the three kinds that never pick a misfit are identical in all six columns; each B column changes only the kinds it should.
  CVR_Only reproduces the scratch figures of 1 October 2026 person by person (0 differences, checked once).
- **What it found** (HOW_TO_ANALYZE 4.12): VCI, VCI_all, performance and the top-value choices compare fairly between
  conditions (at most about 1 point for VCI); **Stability did not on its own** (up to 22 points for the same behaviour,
  because keeping a misfit after the reflection moves two values while the APA page and Baseline's Keep move one up and the
  rest down together) - which led to "Stability from two parts" (2 October 2026): now up to 13 points (Stability_all about
  7); "not measured" and the random line differ by condition; principle B shows that a real correction effect moves VCI by
  about 60 points for a tempted person.
- After every table the page explains what it shows and why, with an example from five traced pretend people (each shown
  decision by decision in the columns that matter for it). Every number and every "larger / smaller" in that text is computed.

## Stability from two parts, since 2 October 2026

The researcher asked whether Stability could compare the values before Block 5 with the values after it, so that it would
not depend on "if one value go down alone or go down with other three together". Tested on the pretend people of all four
conditions (scratch studies sent to him the same day): a before-against-after DISTANCE alone made a participant who takes up
a new value every scenario look steadier than a one-time convert (their back-and-forth cancels), counted agreeing with
yourself as change, and gave the prediction nothing; but AVERAGED with today's swap rule it was better than either alone. His
answers: "1-A" (one combined score shown and used by the prediction, both parts saved under his names), "counted steps only",
"keep today's edges but make sure the level is distributed well in the new numbers". **Participants see it** (HOW_TO_ANALYZE 4.9).

- **The rule** (`computeStability` in block5CVR.ts; `computeStabilityAll` in block5StabilityAll.ts): the ORDER part
  (**Value_Order_Stability**) is today's rule unchanged, swaps at the conflict steps; the DIFFERENCE part
  (**Value_Difference_Stability**) is `round(100 - the average, over the four values, of |the points that value moved at the
  same conflict steps, added up|)` (`differenceStabilityFromMoves`); Stability = `round((order + difference) / 2)`
  (`combineStability`). Keep steps never count in either part ("counted steps only"); with no counted step both parts are 100,
  so "not tested" is unchanged. Stability_all does the same over all six scenarios on the running values. `STABILITY_VERSION`
  "2026-10-02-order-and-difference", `STABILITY_ALL_VERSION` "2026-10-02-b".
- **The level edges** (`COMBINED_STABILITY_EDGES`): the same five words; each edge is where a pretend participant sitting EXACTLY
  on today's edge (no swap but tested, one, three, five swaps) lands on the combined score - the median over 2,000 profiles x 12
  kinds x the four conditions: **94 / 85 / 63 / 49** (Stability_all the same, to one point). The five levels then hold 39 / 12 /
  23 / 12 / 14 in 100 (all kinds, all four conditions), against 44 / 12 / 19 / 12 / 13 on today's edges for the order rule; on
  today's edges the combined score would never reach "Changed substantially". **`npm run report:major-scores` derives the
  edges again from the same people and stops if one drifts by more than a point** (MAJOR_SCORES_BY_CONDITION.md section 7).
  The three sensitivity stabilities and the order part keep today's edges (`levelOnSwapEdges`, was `stabilityLevel`).
- **What it changed** (condition 1, 2,000 pretend people of each kind): best-fit, second-best and top-two pickers 100; true to
  their top value 92 (was 91); corrected by APA 84 (94); one-time convert 67 (56); random 71 (57); flip-floppers 47-60 (12-29);
  always the worst fit 44 (10). The biggest gap between conditions for the same behaviour falls from 22 to 13 points (Stability)
  and from 17 to about 7 (Stability_all). The flip-flopper still scores below the convert (separation 0.84, was 0.89); a value
  follower above a random person 0.87 (0.84); corrected by APA above a random person 0.77 (0.88: confirming the #1 value moves
  it further, which the difference part counts).
- **Stability_all can now be a little above Stability** (about 5 in 100 runs: a move in scenario 5 or 6 that brings a value back
  toward where it began). Its ORDER part is still never above Stability's; with nothing counted in 5 or 6 the two are equal.
- **The prediction** reads the combined Stability (`PREDICTION_VERSION` "2026-10-02-f"): the option it puts first cannot change,
  the average chance given to the person's own scenario-6 pick moves by at most 0.2 points, and a higher Stability marks a
  person it guesses right more clearly (CVR+APA 61% against 36%, was 54% against 43%; never worse in any condition).
- **Saved:** `stability` (combined), `valueOrderStability`, `valueDifferenceStability`, `valueOrderStabilityAll`,
  `valueDifferenceStabilityAll`, `stabilityVersion`, and in `stabilityDetail` the two parts, the average points moved and each
  value's moves. Database: `headline.value_order_stability`, `value_difference_stability`, `stability_average_points_moved`,
  `stability_rule_version`, `value_order_stability_all`, `value_difference_stability_all` (recounted from the rows for a record
  that did not save them), the same in `major_info_and_scores.stability`, and in `analysis.stability_all` both parts, the points
  moved at every counted step and a self-check that the score is their average. `SHAPE_VERSION` "2026-10-02-stability-two-parts".
  **Never correlate Stability with either part: it is made of them.**
- **On screen:** the results page's stability box says "It looks at two things: did your four values keep their order, and how
  far did they move? 100 = no two values swapped places and none moved."; the before-and-after card "Stability watches this
  order, and how far the numbers moved."; the charts' caption and radar note say the same.
- **Checked:** `validate:stability` S9 (both sets of edges), S12-S15 (the order part is today's rule, the difference part
  recounted by hand with keep steps never counted, the average and its words, a round trip cancelling only in the difference
  part); `validate:dbshape` D67 (Stability_all's parts by hand) and new D69 (Stability's parts by hand, the headline, the copy, a
  record without saved parts); `validate:vciall` A9 (the order part never above) and new A13 (Stability_all's difference part by
  hand); `validate:journey` J11 (the words, both parts saved); the report's edge check. 11 deliberate breaks, 11 caught.
  Method: docs/BLOCK5_STABILITY_METHOD.md section 12.

## Baseline: no fit score, no ranking reasons, one confirmation page (since 3 October 2026)

The researcher's second task for **condition 4 (Baseline)**, from his advisor: do not "show the alignment score or ranking
reasoning in the baseline condition only", and give "the aligned and weakly aligned option ... similar confirmation with
confident level question and same as misaligned and strongly misaligned confirmation message". Plan answers "Q1-A" (hide
the whole values part of the card), "Q2-A" (a good fit's "How sure" is recorded only) and "Q3-yes" (the three new
sentences). Conditions 1-3 unchanged. **Participants in condition 4 see it** (HOW_TO_ANALYZE 4.9). This is audit Fix 1's
card part (A1, A2, A8), for Baseline only; the other conditions keep Fix 1 for later.

- **Two rules** (`conditions.ts`): `hidesFitAndRankingReasons` and `confirmsEveryChoiceAlike`, Baseline only; a participant
  with no condition is condition 1.
- **The open card** (`OptionCard`, `showValueReasons`): the whole "Ranked N - why" values part is not drawn - the title,
  "Beat N of the other options", "Most often decided on", "Against ...", the trade line, the limit line and its label, and
  "Matches your earlier answers: N out of 100". "How it performs" stays, without the rule above it. The card ORDER, its
  numbers 1-6, "Compare all options" with the MCF and "Your values in this scenario" are unchanged.
- **Three sentences** (the approved words): under the performance bars "All of this is outcome quality - how well an option
  works. It does not tell you how well an option fits your values." (`fitLineOnCards`; it pointed at the fit line); the
  page before Block 5, section 6, "Your earlier answers measured four values. You will see your number for each one beside
  every situation." (was "Each option will show you how closely it matches them."; scenario 6 has no values panel, so
  "every" is a little broad - the researcher kept the words as they are, "B", 3 October 2026); the wish page (scenario 5) "Before you
  confirm, take a moment with what this option gives up." (was "This is close to what you said matters most...", the fit
  in words; `hideWishFit`).
- **One confirmation page** (`askHowSureOnEveryChoice`, `baselineAsk` in FlowOverlay): every choice in scenarios 1-4 opens
  the same page - the same sentence and "How sure are you about this choice?", needed before "Keep" - so the page no longer
  tells the participant which kind of choice it was. A misfit's answer scales its moves as before; **a good fit's is recorded
  only** (`howSureOnConfirm`): the keep rule moves the values exactly as in the other conditions, and keeping a good fit is
  never a Stability step. Scenarios 5 and 6 ask no "How sure" (nothing there is scaled).
- **Saved:** every row `fitAndReasonsShown` (false in Baseline and in scenario 6; added in finalizeScenario), and in Baseline
  `howSureOnConfirm` for every choice kept in a decision; the timing record counts a good fit's page apart
  (`baselineGoodFitConfirmVisits` / `Backouts`, never in `numberOfSwitches`, as in no other condition), so
  `baselineConfirmVisits` keeps its meaning (a misfit's page). Database: `fit_line_and_ranking_reasons_shown` on every
  `analysis.alignment_records` row (an older row without the flag reads true except in scenario 6),
  `baseline_confirm.how_sure_on_the_confirmation_page_1_to_5`, `good_fit_page_opened_times`,
  `good_fit_changed_their_mind_times`, the totals `times_a_good_fit_was_kept_on_the_baseline_confirm_page` and
  `times_the_fit_line_and_ranking_reasons_were_hidden`; the feedback summary's `baselineGoodFitConfirmVisits`.
  `SHAPE_VERSION` "2026-10-03-baseline-no-fit".
- **For the analysis:** since this date Baseline differs from the other three for EVERY participant (the cards), not only
  for those who choose a misfit, so a difference between Baseline and condition 1 mixes two things: the missing reflection
  and APA pages, and the missing fit line and reasons (HOW_TO_ANALYZE 9.1, 9.6). No score's rule changed:
  `report:major-scores` changed only its stamp.
- **Checked:** `validate:conditions` N21 (new; the rules, the whole values part behind one switch and nothing of it outside,
  the approved words, the page, a good fit's answer recorded only, the counts apart and never switches, every row, the
  database, the totals and the feedback summary), N17 (the two rules Baseline's only), N18 (the page for every choice), N15
  and N18 taught the one new counting line; 12 deliberate breaks, 12 caught. Live in condition 4 (on the local test browser,
  restored exactly afterwards): the page before Block 5 and the note under the bars said the new words; all six open cards in
  scenario 1 showed only "How it performs"; a best fit's page had the sentence and "How sure", "Keep" locked until answered,
  "Change my mind" then a keep at sure 4 saved howSureOnConfirm 4, no moves, not a Stability step, the page opened 2 times
  and left 1, no switch; a strongly misaligned choice in scenario 2 opened the same page and moved +24 / -12 x3 at sure 3;
  scenarios 3 and 4 saved the same way; the wish page said the new sentence with no "How sure". Condition 1 unchanged: the
  fit line and "Ranked N - why" on all six cards, a good fit's "fits your earlier priorities", no "How sure", the old note.

## The results page explains itself (since 4 October 2026)

The researcher (screenshots of the results page): explain what "Your 4 decisions" and "All 6 scenarios" mean, in a box
above the scores; teach in the first box what alignment is (it changes with every choice in every scenario) and what
stability is ("who was the user before the main study and how far off the user now"); colorful level badges; do not show
"50 = random" (a 57 sat above the mark and read "Low", and nobody knows what a random chooser is: "show why it is low");
remove the "1. What matters to you / 2. What you chose / 3. Your scores" strip (his advisor could not read it). Plan
answers "Q1-B, Q2-A, Q3-yes", every condition (one shared page). **Participants see it** (HOW_TO_ANALYZE 4.9). No score,
no stored field and no rule changed.

- **"What your results show"** (`data-results-teach`): the paragraph (the four values, measured in the first parts; three
  scores; "None of them is right or wrong."), then three tiles that TEACH: Value alignment, "choice by choice" ("In every
  scenario, the option you chose was compared with your four values. Each choice adds to this score, so it rose or fell
  with every scenario."); Stability, "before and after" ("Who you were before the main study, and how far you moved by its
  end. When a choice went against your values, your values were updated; stability shows whether they kept their order and
  how far they moved."); Performance, "the outcomes". The 1-2-3 strip is gone ("Q2-A").
- **"Your 4 decisions and all 6 scenarios"** (`ScenariosExplained`, right above the scores, "Q3-yes"): six numbered stops,
  1-4 under a blue bracket "Your 4 decisions" (VCI's color), 5 (a wish) and 6 (a rule) in cyan (VCI_all's), a dashed
  bracket under all six "All 6 scenarios"; one line for each kind (the places are the badges each scenario wore,
  `ROLE_BADGE`: deciding alone, for your household, for other people, inside your employer's rules; 5 = scenario 4 decided
  for them; 6 = a rule set before knowing who they would be, the guess shown after); and what each kind of score counts
  (performance the decisions only).
- **Levels** (`block5LevelScale.ts`, "Q1-B"): each level word is a solid traffic-light badge (green high, lime, yellow
  middle, orange, red low; VCI's sixth level deep red), and each thin bar is the score's own LEVEL SCALE - the 0-100 line
  cut into its levels in those colors, the participant's level lit, a ring at their number - with "This level: 50–64 ·
  next at 65" under it. The bands are built from the lists the level words come from (VCI_LEVELS, VCI_ALL_LEVELS,
  COMBINED_STABILITY_EDGES, CAPTURED_LEVELS - the last new in block5Performance.ts, capturedLabel unchanged), never typed.
  Every badge's text reaches 4.5 : 1 contrast (the first orange, #ea580c, did not; now #c2410c). A legend beside "Your
  scores": Level ● high ● middle ● low. **This reverses the 29 September "Q2-A" ("never red-to-green") for the level
  badges and bars only**; the score numbers keep their family colors.
- **No random mark.** The alignment box now says how a decision earns its points, with the scenario cards' own colored
  labels and the points from `labelWeight`: Aligned 100, Weakly aligned 80, Misaligned 50, Strongly misaligned 10; "Your
  score is the average, so it is high only when most choices were Aligned or Weakly aligned." So a 57 reads "Low" with its
  reason on the page.
- **"Value Consistency Index" (VCI)**, the researcher's name, the same day: the alignment box says "We call it your Value
  Consistency Index (VCI)" (it said "value consistency"), and so does the charts page's consistency card after the
  feedback, which also lost "50 is what choosing blindly gives" (his reason holds there too). J15 holds both.
- **An ⓘ beside every level badge** (the same day; the researcher: "instead of changing the level labels and ranges ...
  an information icon ... because our numbers has different meaning from universal scale when 50 means Medium score";
  plan answers "Q1-A, Q2-A, Q3-A, Q4-yes"): a small round button in the badge's color, right after it (`LevelInfo`), opens
  that score's level ladder - "What your 57 means", the full name ("Value Consistency Index · your 4 decisions"), every
  level as its traffic-light badge with its range and a few words (`levelMeaning`: "Mostly your best fit" ... "Near a
  full reversal"; performance's words speak for themselves), the participant's level outlined and "you are here". Each
  number has its own ladder (VCI and VCI_all edges differ). Tap or click opens it on every device; on a computer a hover
  opens it too and leaving closes it, unless a click pinned it; ✕, a tap outside or Escape closes it. Nothing recorded. A
  line on what a 50 means was drafted ("Here, 50 is not the middle: ...") and removed at the researcher's request. The
  caption under each bar stays ("Q3-A"). Checked: J16 (7 breaks, 7 caught); live on a computer (hover, click to pin,
  Escape) and a 375px phone in dark mode (the panel fits); the test browser restored exactly.
- **Checked:** `validate:journey` J15 (new: the teaching, the box's place and words, every whole score 0-100 landing in the
  band its own level word names on all four scales, the traffic-light order, each color distinct, every badge's contrast,
  the points from labelWeight, no random mark, no strip; 9 deliberate breaks, 9 caught) and J11 (now the new stability
  words). `block5LevelScale.ts` and `block5RoleWords.ts` are listed in `tools/tsconfig.sim.json`. Live on the local test
  browser (restored exactly): a computer and a 375px phone, light and dark; the researcher's example (VCI 57: an orange
  "Low", its piece of the bar lit, "This level: 50–64 · next at 65"). On a phone "5 · A wish" broke over two lines, so the
  stops read "5 · Wish" / "6 · Rule".

## The first page's welcome, and the performance panel's title on a phone (3 October 2026)

The researcher: "in the first page while checking the email ... write a brief welcoming the user and show my study name
'Human-AI Moral Value Decision-making Study' so the first page will a little bit nicer and not crowded and professional ...
for all conditions", and "fix the title overlap on the phone". **Participants see both** (HOW_TO_ANALYZE 4.9); no score,
no stored field and no rule changed.

- **The first page** (`StartScreen.tsx`, the same in every condition): a small "Welcome" pill, the study's name as the
  page's heading ("Human-AI Moral Value Decision-making Study", in two unbreakable halves so it never splits at a hyphen:
  "Human-AI Moral Value" / "Decision-making Study"), and three sentences under it, in the consent page's own terms: "Thank
  you for your interest in this study. It explores how people make moral choices when every option has a cost, and how a
  computer system can support those choices without telling you what to choose. There are no right or wrong answers."
  The welcome shows only while the email is asked for (a returning participant gets "Welcome back" in the card; a finished
  one "You have already finished"). "Start or continue" and its instruction moved INTO the card, as its title. The email
  step itself (the lookup, the age check, the finished message, the helper text) is unchanged. The old eyebrow said
  "Human-AI Moral Value Study"; **the consent page's "Study Title" still says that** (left for the ethics board). **The
  browser tab** said "Moral Decision-Making Study" and carries the new name since 4 October 2026 (the researcher's "A":
  the tab only; `index.html`, held by J14).
- **The performance panel's title row** (`MetricsDashboard`, every scenario, every condition): the title was `flex="1"`
  beside controls that could shrink, so on a 375px phone the row never wrapped - the title folded into five lines and
  "Hide definitions" overflowed its button onto it (the researcher's screenshot). Now the title asks for 14rem before it
  shares the row and the controls keep their size, so on a phone they drop to their own line at the right; on a computer
  the row is unchanged (`data-dash-title-row`).
- **Checked:** `validate:journey` J14 (new; 6 deliberate breaks, 6 caught). Live: the first page in light and dark mode, on
  a computer and a 375px phone (two clean lines, no sideways scroll); a finished email showed "You have already finished"
  under the name, a new one led to consent and saved nothing; the panel on a 375px phone (title 184-238 px, controls
  246-270 px, no overlap, no overflowing text) and on a computer (one line, as before). The test browser was restored exactly.

## The four-condition audit (2 October 2026)

The researcher: "audit your work in all four conditions. I'm afraid that you missed a condition update by mistake." Every
path through Block 5 was traced in each condition, every reader of the rows checked, and each condition played live. The
two-part Stability (built the same day) proved the same in all four: it reads the saved rows, and the report checks every
pretend person in every condition (MAJOR_SCORES_BY_CONDITION.md, "0 differences"). Six things were wrong, all from the
condition work of 1 October, all fixed:

- **F1 - a reflection followed by a good fit read "no reflection shown"** (conditions 1 and 2; in condition 2 it is the
  commonest refusal path: the CVR Rejection page, then a good fit). `cvrFired` is the FINAL path, and `reflectionShown` was
  set only for APA_Only and Baseline, so `reflectionWasShown` was false there: no "Reflection shown" badge, `cvr.fired:
  false`, `telemetry.cvrTriggered: false`, while `cvr_rejection_page.shown` said true. Now every row carries
  `reflectionShown: (cvrVisits > 0)`, and `cvrTriggered` is true when a vignette was shown. Stability is unchanged (it
  reads `cvrFired`).
- **F2 - a second view opened before going back was lost**, so the two-views feedback questions could be skipped and the
  results page could say "you stayed with the first view". Now `telemetry.secondViewOpened`, and `secondViewWasOpened`
  (feedbackTypes.ts) also reads condition 2's rejection visits; the feedback rule, the results page and
  `cvr.second_lens_was_generated` use it.
- **F3 - APA_Only's note said "you chose to reconsider"** under a misfit confirmed on the APA page; the page opened by
  itself. Now "This went against your usual values. The clarification page opened, and this is the option you confirmed
  there." (the researcher kept these words, 2 October 2026: "A, keep it").
- **F4 - APA_Only's "Clarification shown" badge** was missing when the participant went back from the APA page to a good
  fit; it now reads the APA visit too.
- **F5 - Baseline's own page was not counted** anywhere (every other condition counts its page). Now
  `telemetry.baselineConfirmVisits` / `baselineConfirmBackouts` (`handleChangeMyMind`), "Change my mind" there is a step
  back in `numberOfSwitches`, and `baseline_confirm.page_opened_times` / `changed_their_mind_times` /
  `totals.times_the_baseline_confirm_page_opened` in the database.
- **F6 - the feedback record's Block 5 summary** had no CVR Rejection page or Baseline page; each scenario now carries
  `cvrRejectionVisits`, `baselineConfirmVisits`, `secondViewOpened`.
- **One wording corrected everywhere:** a Stability step in APA_Only is a choice CONFIRMED on the APA page, not every APA
  visit (going back to a good fit is not a step).

**Participants see** F1 (a "Reflection shown" badge on such cards), F3, F4 and F2's sentence (HOW_TO_ANALYZE 4.9).
`SHAPE_VERSION` "2026-10-02-condition-audit". **Checked:** `validate:conditions` N20 (new) with N15 and N18 adjusted; 10
deliberate breaks, 10 caught. Live: CVR_Only (both views, refused, the CVR Rejection page, back, a good fit kept: the row
reads shown, not a step, second view opened, one rejection visit), Baseline ("Change my mind" on the confirmation page,
then a good fit: one visit, one back-out, no reflection), and a full APA_Only run (the badge after going back, the new note
on three cards). Documentation: the headers of conditions.ts, Block5PublicEmergencySimulation.tsx (it still said Block 5
restarts at scenario 1, wrong since 29 September), Block5SimulationSummaryPage.tsx and dbShape.ts now describe all four
conditions; HOW_TO_ANALYZE_MY_DATA.md has a new section 9 (the four conditions in full); HOW_TO_READ_MY_DATABASE.md "The
four-condition audit".

## Many people at once ("multiple sessions safe"), since 6 October 2026

The researcher's advisor: what if 100 people enter at once - does each get a unique session id, and does the server
spread them properly over the four conditions? Answered with a LOAD TEST of the real server (production mode, a
throw-away local database): 400 pretend people in bursts of 100, 100 and 200 arriving in the same instant, each saving
far more often than a real browser. Before the fix: 0 errors in 17,600 requests, 400 people saved with 400 different
session ids, exactly 100 per condition - but the condition queue served one person per database reading, so 33 of 100
(41, 67 of 200) waited longer than the page's 3 seconds, and the page then gave them a RANDOM, UNCOUNTED condition. Plan
answer "implement Step 0". No score, stored field or screen of a working run changed.

- **F2, the server** (`server/conditions.js`): still one after another, but everybody waiting when a turn starts is
  served from ONE reading of the counts, each counted with the people before them in that turn (as if already stored),
  and their arrivals stored in one insert (`findArrivals` / `insertArrivals` on the database store). Same rule, same
  answers. **Trap found by the load test, not by the checks:** the route builds a new store object per request, so
  grouping by object served everybody alone; the store now carries a `key` (its collections' names) and turns group by
  key (`sameStore`). After: the slowest wait for a condition 0.14 s (was 4.8 s).
- **F1, the landing page** (`LandingPage.tsx`, `requestCondition` in storage.ts): asks up to four times (after 1, 2 and
  4 seconds) with the SAME arrival id (the server answers what it already made), a refusal (4xx) once; after 8 seconds
  "This can take a few more seconds."; **on the live site never a random condition**: "We could not reach the study"
  with "Try again", which reloads the page (the server check starts again at once) and keeps the arrival id.
  `random_offline` is now development only.
- **F3, the server check** (`serverCheckPlan` in storage.ts, ExperimentFlow): development asks `/api/health` once, as
  before; the live site asks again after 1, 2 and 4 seconds, lets the landing page stop waiting, and then asks every 15
  seconds until the server answers. One missed answer used to keep a whole session out of the database (a paid person
  with no data). A server that answers LATE is installed by `connectLate`, which sends the participant's record FIRST
  and installs the backend only once it has landed (the section route updates, never creates, and answers "ok" either
  way), then the blocks, then the completion of a finished run; a record it cannot send waits first in the queue.
- **Waiting limits** (apiClient.ts): a request is given up after 10 seconds (was 3; a busy server or a slow line
  answers late but answers, and a large save on a slow line could be cut off on every retry); the server check 5.
  A server that is really down still fails at once (the connection is refused, or nginx answers 502).
- **An older bug, found by C12:** a save made right after a flush had looked at an empty queue was queued, found the
  flush still "running" and waited for the 15-second retry - on EVERY page opening (switching the server on starts a
  flush, the first syncs follow at once). Nothing was lost; it arrived 15 s late. `flushOutbox` now goes round again.
- **Every person counted once** (found the same day, when the load test ran on a busy machine: a burst ended 26 / 24).
  A person moves from "just arrived" to "working" in two writes (the condition on their record, then the arrival
  marked as linked), and a turn reading the counts between them saw the person twice, or with the two collections read
  in the other order not at all. Now the record keeps its arrival id (`condition_arrival_id`, written WITH the
  condition by `conditionFieldsFrom`), `tally` never counts an arrival that is already on a record, and a turn reads the
  arrivals before the records (so does the count page). Older records without the id count as before.
- **`npm run test:load`** (`tools/load_test.mjs`, not in the chain: it needs MongoDB on this computer): starts the real
  server itself on port 4100 against a database `vrds_load_test_<time>` (deleted at the end, whatever happens), sends
  the three bursts and checks L1 no request refused or failed, L2 everybody saved with their own session id, every save
  landed, everybody finished, L3 the conditions exactly even in every burst, L4 nobody waited 3 seconds for a condition.
  After the fix: 17,600 requests, 0 errors, 25 / 25 / 25 / 25 per 100, slowest condition 0.14 s. Run it after any
  change to the server or the landing page. The live server is another machine, so Prolific places open in batches too.
- **Checked:** `validate:conditions` N22 (100 at once = one at a time person by person, from 1 reading instead of 100;
  repeats in a burst; a new store object per request grouped by key; a failed turn never stops the next) and N23 (the
  four questions, the refusal, the live page never random, "Try again" keeps the arrival id), N24 (every person once:
  all six orders of the two writes and the two readings); `validate:session` C12 (the plan, the late connection's order,
  the queue race, the 10 s / 5 s limits); 22 deliberate breaks, 22 caught (one only after N22 compared bursts with
  repeats against one at a time; two for the key; four for N24). The load test then passed 7 runs in a row (2,800
  pretend people), two of them with the whole check chain running beside it. Live, on the built site behind a
  stand-in for the web server that could be switched to 502: a new visitor got a counted condition; with the server
  down the page showed "We could not reach the study" after about 7 seconds and saved no condition; "Try again" with the
  server back gave a counted condition under the same arrival id; a participant who went through the email, consent and
  demographic pages while the server was down appeared in the database about 13 seconds after it came back, with
  every answer, the condition and the stage. Throw-away databases dropped; the test browser's own address not used.
- **Deploying:** restart the server (build-and-run.sh does): the grouped turns are server code.

## Two doors: the university version and the Prolific version (since 6 October 2026)

The researcher: two versions, "the first version is as it is right now (log in through email), and the other one will be
the Prolific version", because he also wants FIT students and employees. Plan answers "1-A" (one website, two doors),
"2-A" (each door balanced on its own), "4-A" (the Prolific demographic page without the email), and for Step 1 "1-A" (a
returning Prolific person continues with no question; **since 7 October 2026 "1-B": on ANOTHER device they are asked their
age**, see the next section), "2-A" (a welcome page with the ID and Start), "3-A" (deploy only
after Step 4, with a database backup first). **Participants see it** (HOW_TO_ANALYZE 4.9, 9.8).

- **The doors** (`recruitment.ts`; the server's twin `server/recruitment.js`, C13 holds them together):
  https://moonlander.fit.edu is the university door, **unchanged**; `/prolific`, or a `PROLIFIC_PID` in the link, is the
  Prolific door. Once somebody is known, their key decides; before that a Prolific address wins over a condition nobody
  owns yet (the live check found an unowned university condition keeping a Prolific arrival at the wrong door).
- **The key.** The browser carries "the participant's key" where it always carried the email (`DirectoryEntry.email`,
  `vrds_pending_email`, every owner): an email, or a Prolific ID (letters and digits, 8-64; Prolific's help pages do not
  state the format, in practice 24 hex; an email always has an @, so the two never mix). The SERVER stores a Prolific ID
  as `prolific_pid`, never in `email`: `whoIs(key)` in every route (`/:key/...`), `identityOnInsert` on a new record
  (with `recruitment_source`), `prolificIdsFrom` for Prolific's `STUDY_ID` / `SESSION_ID` (`prolific_study_id`,
  `prolific_session_id`; never the study's own `participant_id`). The API client sends `prolificPid`, never `email`.
- **The Prolific first page** (`ProlificStartScreen.tsx`): the university page's welcome and study name word for word,
  "Your Prolific ID" with the ID, and Start (new), "Welcome back" + Continue where I stopped (no question), or "You have
  already finished" (since 7 October 2026 with "Your age" to see the completion code again: "The Prolific completion code"); a paste box when the link has no ID (written into the address). It waits
  for the server check before looking the person up (the live check: asked earlier, a finished person read "new").
- **"A little about you"** in the Prolific door: four questions, no email (`askEmail={false}`); the record names its key
  as `prolificPid` with the door and Prolific's two ids. The university door: five questions, as before.
- **Balance per door** (`server/conditions.js`): `tally(..., door)`; the landing page sends its door, the arrival row
  keeps it (`recruitment_source`), a Prolific arrival is linked by `linked_prolific_pid`; a record or arrival from before
  has no door and counts as the university's. The count page shows one table per door.
- **The database rules** (`server/db.js`): "one email = one person" now covers only records WITH an email (a partial
  index; the old one treated "no email" as one shared value and would refuse the second Prolific person), plus "one
  Prolific ID = one person". The old index is replaced at startup, before the server listens; **without that swap the
  server could not start** on a database with the old rule (a deliberate break proved it).
- **Found and fixed on the way:** a queued save found its owner only when it was SENT, so a save waiting for the server
  could land on whoever started next on that computer (now stamped when made: `sendOrQueue`, `saveSection(path, data,
  owner)`); a second person on a shared computer would have reused the first one's session id, refused by the unique
  `participant_id` rule - a DIFFERENT Prolific ID in the link now sets the other person's run aside before the page reads
  anything (`makeRoomForAnotherProlificId`; the machine's files, the list of people and the unsent saves stay).
- **"Not you?" on the university door** (the audit, the researcher's "4-Yes"; `NotYouLink.tsx` in App): on a shared
  computer the browser reopened the first student's run or thank-you page and a second student could not start. When the
  page OPENS with a university run in the browser, a thin strip at the top (above the progress bar, so it covers
  nothing; floating at the bottom it covered Block 1's first button in the live check) says "This study is open for
  w•••@my.fit.edu. Not you?" (`maskEmail`); it goes once the person moves to another page (the stage changes) or with ×.
  "Not you?" asks to confirm, then `setAsideThisBrowsersRun()` (the rule a different Prolific ID uses: the machine's files,
  the list of people and the unsent saves stay) and the plain university address opens afresh; the first student
  continues later with their email and age. Not shown on the page that reloads right after somebody proved who they are
  (`loginKindNoted()`, read before the flow clears it). Never in the Prolific door. Nothing recorded.
- **The audit of 6 October 2026** (the researcher: "fully audit your work ... from several perspectives"): seven findings,
  answers "1-Yes, 2-A, 3-Yes, 4-Yes". Fixed: a resumed Prolific person's condition file lost its door (F1; the record was
  right, `major_info_and_scores.condition` said "university"); `quality.compensation_eligible` is documented as the
  university gift-card rule, never a Prolific pay verdict (F3); the Prolific first page uses the ID the browser knows when
  the link lost it (F4); `connectLate` reads the entry again after its wait, so a completion made meanwhile is sent (F5);
  an unowned condition from the other door is dropped either way and the address forgets it (F6); every test run, also
  Prolific's Preview, uses `?condition=` and test records are deleted before launch (F7, the launch list). **F2 was the
  next step, fixed on 7 October 2026** (the next section): `/api/participants/lookup` returned the WHOLE record (answers,
  age) to anyone who knew a key, so "email and age" was weaker than it looked and a Prolific ID alone opened a record. C12 and C13 extended, C14 new;
  12 breaks, 12 caught. Live: the doors both ways, "Not you?" (start afresh, the first student's record intact, a new
  session id, the first student back in with email and age), the strip gone on moving on, a resumed Prolific person's
  condition file "prolific", a link without the ID recognised; three found and fixed in that check: the floating note
  covered Block 1's first button (now a strip above the progress bar), it asked "Not you?" right after a sign-in, and a
  phone broke the masked email mid-word.
- **All five steps built on 7 October 2026** (Steps 2-3, the consent page and the second number row; Step 4, the end page
  with the code; Step 5, the daily pay check): the next three sections. Left before Prolific: the ethics board, the
  deploy with the code in the server's `.env`, and one Prolific Preview run to the end (docs/PROLIFIC_CONVERSION_PLAN.md 5). The visit log says
  `arrived_with_their_prolific_id` in the Prolific door. `SHAPE_VERSION` "2026-10-06-two-doors"
  (`major_info_and_scores.condition.recruitment_source`).
- **Checked:** `validate:session` C13 (new) with C2, C8 and C11 taught the new routes and page; `validate:conditions` N25
  (new) with N3, N6, N9, N10, N23 and N24 taught the doors; `npm run test:load` L5 (100 students and 100 Prolific people
  at once: 25 per condition inside each door; every Prolific record under `prolific_pid` with no email) and L6 (the rule
  swap on a copy with today's rule; the old record kept). 17 deliberate breaks, 17 caught. Live on the built site with a
  throw-away database: the university door unchanged; a Prolific link opened the Prolific first page; Start, consent,
  four questions, Block 1, and a record with `prolific_pid`, no email, the door and both ids; a refresh continued; a
  second browser with the same ID continued with no question and the first one locked ("Your newest answers will be
  brought here."); a different Prolific ID on that browser started fresh (new session id, the machine's files kept); the
  paste box (a wrong ID refused calmly); a finished ID read "You have already finished"; a 375px phone, light and dark; the
  count page with both doors. All test storage and databases removed.

## Privacy, the Prolific consent page and the second number row (since 7 October 2026)

The researcher: "implement the privacy fix now and also do 'Prolific consent page' and 'Second "pick the number" row'",
with the privacy plan's answers "1-B" (a Prolific person continuing on ANOTHER device is asked their age) and "2 - no
limits" (no lock after wrong ages). **Participants see all three** (HOW_TO_ANALYZE 4.9). No score changed.

- **Privacy (the audit's F2; `server/index.js`, `server/activeBrowser.js`, `storage.ts`, `apiClient.ts`, both start
  screens).** The lookup (`POST /api/participants/lookup`) answers only `{ status }`, so a key alone tells nothing but
  "finished or not". The person's details and saved run come ONLY from the claim (`/participants/:key/claim`), which checks
  the age on the server first (403 otherwise; 404 for no record) and answers `{ participant, files }`: the sign-in fields
  (`SIGN_IN_FIELDS`: who they are, age, gender, country, English, condition, status, stage, consent, dates) and the resume
  files - never `blocks`, `analysis`, `headline`, `quality` or any other section. The create/update route answers
  `{ ok: true }`. A write without the browser's id (`X-VRDS-Browser`) is refused with 400 (it used to be allowed). CORS is
  gone (the page and the API share one address in both environments). The page's `signIn(key, age)` (storage.ts) replaces
  the old lookup-then-compare: it sets aside that person's queued saves (`setAsideQueuedFor`, never anybody else's), asks
  the server, and brings the run down; "mismatch" and "unreachable" have their own words on both start screens
  ("Checking" while it asks). The Prolific first page's "Welcome back" now asks "Your age" on a new device ("1-B");
  the lock screen says so. Without a server (development) the local copy's age is compared, as before.
- **The Prolific consent page** (`ConsentPage.tsx`, `door` from ExperimentFlow): the same page and design; eight parts
  in Prolific's terms - one sitting within Prolific's time limit (a closed page continues from Prolific's link), paid
  through Prolific (no gift card, no minutes rule: Prolific forbids both as reasons), "If you fail two or more of them,
  your submission may be rejected.", the Prolific ID instead of the email, voluntary and withdrawal through Prolific with
  the ID, ONE box, and "I do not agree" (a calm panel: return the study with "Stop without completing", no code needed).
  `PROLIFIC_CONSENT_VERSION` "2026-10-06-prolific"; the university page is unchanged word for word. **The ethics board must
  approve the text first:** docs/PROLIFIC_CONSENT_FOR_ETHICS_BOARD.md (side by side with the university's).
- **The second "pick the number" row, Prolific only ("3-B"; `attentionChecks.ts`, `UserFeedbackPage.tsx`).** Prolific
  accepts only instruction checks, and only after TWO fails; the topic questions are memory. A Prolific plan (`door:
  "prolific"`) puts `number` in "The tools & the experiment design" and `number_2` in "How this experience was for you",
  each at a random place, two DIFFERENT numbers two to five (one answer everywhere never passes both); the page draws every
  row the plan drew (`numberRowsOf`, codes `ATTN_number`, `ATTN_number_2`), saves each in the attention file, never in the
  feedback record. The door follows the key (`keyDoor(owner)`). Scoring: only the number rows count for Prolific's rule; a
  row "failed" is one ANSWERED wrongly; failing both is the "look first" flag (`analysis.attention_checks.prolific_rule`,
  `quality.prolific_instruction_checks_failed` / `prolific_failed_both_instruction_checks`, the major copy; Step 4 makes it
  the completion path). **The university door is untouched:** its plan is drawn exactly as before (20,000 plans compared
  with the committed code, 0 different; T9 holds a fingerprint), and a file of the previous version ("2026-09-30-topics")
  is still read as the university plan it was (`STILL_READ_VERSIONS`), so a run in progress keeps its answered checks.
  `ATTENTION_VERSION` "2026-10-07-two-doors", `SHAPE_VERSION` "2026-10-07-prolific-checks". A random clicker fails both
  rows 36 times in 49.
- **Checked:** `validate:session` C15 (new: the lookup's answer, the claim's order and fields, the saved run only as
  `files`, no-id 400, no cross-site header, no age compared on the page, signIn's three outcomes and its queue) with C1, C6,
  C8, C13 and J14 taught the new sign-in; `validate:attention` T9 (new: the Prolific plan, the door, the rule, the
  database, chance, the page) and T10 (new: both consent pages), T2 and T5 extended; `npm run test:load` L7 (new, the real
  server: the lookup gives only the status for both doors, a wrong age 403, the right age the details without any section,
  the create route "ok", no-id 400, no cross-site header). 26 deliberate breaks, 26 caught (two only after C15 was
  tightened: the run handed back inside the person's details, a hand-written cross-site header). **Live** (the built site,
  a throw-away database, deleted afterwards): the Prolific consent page as written, "I do not agree" and back, one box,
  `consent.version` "2026-10-06-prolific"; the feedback page with two rows (four in the tools section, five in the
  well-being one), the record's `prolific_rule` (one failed, not both) and no row in the feedback record; the university
  consent page and its one row unchanged; on an emptied browser both doors asked the age, a wrong one refused calmly, the
  right one opened Block 1 with the person's own condition; the old browser's lock screen in Prolific's words; a 375px
  phone. **The live check found one bug, fixed:** after the right age the page set the participant BEFORE its reload,
  which re-ran the stage-saving effect and wrote "start" over the saved stage, so the reload opened "Welcome back" again
  (both doors; the privacy change had moved the sign-in before `onResume`). Now nothing on the page changes before that
  reload; C15 holds the order (broken on purpose: caught).
- **Deploying:** the page and the server must go up TOGETHER (build-and-run.sh does): an old page's sign-in compares the
  age itself and finds none in the new lookup's answer. A tab left open from before the deploy should be refreshed.

## The Prolific completion code (Step 4), since 7 October 2026

The researcher: "start step 4", plan answers "1-A" (a "Return to Prolific" button, never an automatic jump), "2-A" (a
Prolific person who already finished gets the code again on another device after the age check) and "3-A" (the feedback
page says "confidential", not "anonymous", in both doors). **Participants see it** (HOW_TO_ANALYZE 4.9). No score changed.

- **The code lives only in the server's `.env`** (`PROLIFIC_COMPLETION_CODE`, letters and digits; never in Git, the page's
  code or the database; `.env.example` holds a placeholder the server refuses). `ecosystem.config.cjs` passes it to PM2,
  `build-and-run.sh` warns when it is missing and never prints it, and `/api/health` says `prolific_code_configured`
  (true / false, never the code). One code for everybody, "Manually review" on Prolific.
- **`POST /api/participants/:key/prolific-code`** (server/index.js) gives `{ ready: true, code, url }` (the url is Prolific's
  completion address with the code, built on the server) only when the key is a Prolific ID, the request comes from the
  browser holding the record (409 otherwise, 400 without an id), and the status is "Study Completed" (`{ ready: false }`
  before it: the completion may still be in the queue); 404 for a university key, 503 when no code is set. It writes
  `prolific_code_given_at` (the first time), `prolific_code_last_given_at` and `prolific_code_given_times` on the record,
  never the code. Everybody who finishes gets it: Prolific allows a rejection only in the review.
- **The page** (`ProlificCompletionCard.tsx`): on the Prolific door's thank-you screen, inside the hero
  (`prolificId` from ExperimentFlow by the key; the university door shows nothing new): "Your Prolific completion code",
  the code on one line in large letters with Copy (on a phone Copy goes under it: a code split over two lines could be
  copied by halves - found live), a green "Return to Prolific" button (a link, never an automatic jump), and one line on
  pasting it yourself. While the completion is on its way: "Getting your code..." and it asks again every 3 seconds (every
  15 without a server); after a minute "This is taking longer than usual ... send the researcher a message through
  Prolific with your Prolific ID". `fetchCompletionCode` (storage.ts) keeps the code given (`vrds_prolific_completion`,
  with its owner; not a resume file), so a reload shows it at once; a 409 locks the page like any other write.
- **Another device** (`ProlificStartScreen`, "2-A"): "You have already finished" adds "Need your completion code again? To
  confirm it is you, please enter your age." and "Show my completion code"; the age goes through `signIn` (the server
  checks it and this browser then holds the record), then the card. A browser that was already given the code shows it at
  once.
- **Also:** the results page's "One last step" card says, in the Prolific door, "Answering them finishes the study and
  gives you your Prolific completion code." (`LastStepCard`; the university door keeps its gift-card sentence); and the
  feedback page's header says "your answers are confidential" in both doors (it said "anonymous", which the consent pages
  contradict: "3-A").
- **Checked:** `validate:session` C16 (new: the route's order of checks, the code from .env only and never stored, the
  health flag, PM2 and the deploy script, no code and no completion address anywhere in `src/` or `dist/`,
  `fetchCompletionCode` with a pretend server, the card asking again and never jumping, the final page in the Prolific
  door only, the age before the code on another device, the results-page sentence, "confidential"; since the audit the answers
  needed, the code kept letter for letter, the screen-reader announcement); `npm run test:load`
  L8 (new, the real server with a made-up code: not before the completion, then the code and the address, only to the
  holding browser, never for a university key, never in a lookup or sign-in answer, the times on the record and never the
  code, the health flag). 18 deliberate breaks, 18 caught (one only after C16 learned that the card must wait for the age).
  Live (the built site, a made-up code, a throw-away database, deleted afterwards): the code appeared within a second of
  "Submit feedback", Copy said "Copied", the button pointed to Prolific's address with the code, a reload showed it again;
  an emptied browser was locked out of it (another browser held the record) until the age; a wrong age refused, the right
  one showed the code; the record had the three times and never the code; the university thank-you page showed no code;
  a 375px phone (after the one-line fix) and light mode. Two found and fixed live: the code split over two lines on a
  phone, and a reload of the "already finished" page asked the age again although the browser held the code.
- **Hardened after the audit of 7 October 2026** (the researcher's "1-yes, 2-yes"): **H1** the route also needs the study's
  own answers on the record (`HOLDS_THE_STUDY`: `blocks.feedback_answers` and all six scenarios of
  `blocks.block5_emergency_scenarios`); before, a script could make a record, mark it finished and get the code in three
  requests, without the study (confirmed in the audit). A real participant notices nothing: both travel with the
  completion and the card asks again every 3 seconds. A script must now fake the whole study, which the daily pay check
  reads. **H2** the code is kept exactly as written in `.env` (letters and digits, small or capital: Prolific compares it
  letter for letter; it used to be turned into capitals). **H3** the card is `role="status" aria-live="polite"`, so a
  screen reader announces the code. **H4** the launch list now ends with one Prolific "Preview as participant" run to the
  end, pressing "Return to Prolific" (docs/PROLIFIC_CONVERSION_PLAN.md, section 5). C16 and L8 taught all three (L8 with a
  made-up code in small and capital letters; a finished record without answers, and one with five scenarios of six, get
  no code); 6 breaks, 6 caught. Live (before the hardening): with no code set the card says "Getting your code...", then
  after a minute "This is taking longer than usual ... send the researcher a message through Prolific".
- **Deploying:** add `PROLIFIC_COMPLETION_CODE=<the code from Prolific>` to the server's `.env` (DEPLOYMENT.md, Part C), run
  `./build-and-run.sh`, and check `/api/health` says `"prolific_code_configured": true`.

## The daily Prolific pay check (Step 5), since 7 October 2026

The researcher: "1-A 2-A 3-A 4-A" on the plan (and the audit's three additions, "3-yes"). **Nothing participants see.**
How to do it, for the researcher: docs/DAILY_PAY_CHECK.md.

- **`npm run pay:check -- "Prolific docs/daily/<date>" [--reward 10] [--today <date>]`** (`tools/pay_check.cjs`, plain
  Node, no packages). It reads `participants.json` (Compass's export of `participants`: an array, one per line, or
  Extended JSON) and `prolific.csv` (Prolific's submissions file: Participant id, Status, Time taken, Completed at,
  Completion code; columns found by name, and it STOPS with the columns it saw when a needed one is missing), and writes
  `PAY_CHECK.md` and `approve_ids.txt` (one comma-separated line for Prolific's bulk approve) beside them. It never
  rejects, contacts anybody or touches the database.
- **The groups** (only Prolific's valid reasons, researcher-help "Who should I reject?"): PAY (Awaiting review, finished,
  every answer, nothing below; ONE failed number row is not enough); LOOK FIRST with Prolific's wording ("3-A": failed
  BOTH number rows; "2-A" clear low effort = the same answer to every rating or 3+ blocks under 30 seconds; "1-A"
  exceptionally fast on Prolific's own "Time taken", mean - 3 x the sample standard deviation over finished submissions,
  read only once 10 have a time; our record begun 15+ minutes before Prolific's clock); PROBLEM (no record, not
  finished, answers missing - Blocks 1-4, all six scenarios, the feedback, the attention checks -, the code never shown,
  under 5 working minutes, our clock shorter than half of Prolific's minus 5 minutes); NOT FINISHED (returned, timed
  out, active); DECIDED (approved, rejected). Plus: "Decide soon" from day 18 (Prolific approves by itself on day 21),
  the code each person typed compared with most people's (information only, never printed), the median time and the
  hourly pay at `--reward`, and the Prolific records that are not in Prolific's file (tests, previews). All the numbers
  live in `RULES` at the top of the tool.
- **Privacy:** only records with a Prolific ID are read (the Compass file holds university emails); a report or approve
  line that would contain an email is refused; the completion code is never printed.
- **Checked:** `npm run validate:pay` (`tools/validate_pay_check.cjs`, in the chain before `validate:position`): Y1 every
  group with one pretend person each, Y2 the speed line recounted by hand and not read with nine, Y3 the files (Extended
  JSON, quoted CSV, BOM, CRLF, h:mm:ss, GMT dates, a missing column), Y4 privacy, Y5 the command end to end in a
  temporary folder. 12 deliberate breaks, 12 caught (one only after Y4 learned to read the whole result and to count a
  refused report as a failure).

## Three fixes from the Prolific rehearsal (7 October 2026)

The researcher: "Ok do A and tell how much my code is ready" (A = a full local rehearsal of the Prolific version), then
"1-A 2-A 3-A, implement". The rehearsal (the built site in production mode on port 4100, a throw-away database, a made-up
code) worked end to end and found three things, all fixed. **Participants see 2 and 3** (HOW_TO_ANALYZE 4.9).

- **1, the rushed-blocks rule ("1-A"; `REAL_BLOCK_STAGES` in dbShape.ts).** `quality.rushed_blocks` counted EVERY timed
  page: the consent page, "A little about you", the page before the main study, the results page and the 0.9-second
  pauses. Working time is added every 5 seconds to the page on screen at that moment, so a pause caught a tick about 1
  time in 5.5 and became "a block finished in 5 seconds" (an honest person: one such strike in 63 runs of 100, two in 22);
  with a quick consent or four-question page that made the three strikes that cost the gift card and put a Prolific person
  in "Look first: low effort". Now only the six real parts can be called rushed (Blocks 1-4, the main study, the
  feedback); the other pages under 30 seconds are kept in `quality.short_pages_not_counted`, and the record says which
  parts count (`blocks_that_can_be_called_rushed`). `fastest_block` is the fastest real part. The pay check follows by
  itself (it reads `blocks_under_30_seconds`). More generous, never less.
- **2, APA_Only's box ("2-A"; `mainValueFallsShort` in block5CVR.ts).** The box said "The option you chose serves Reducing
  harm more than any of the other three values." while the line under it said "It fell short on ... Reducing harm" (true
  both: the participant holds that value even higher than the option gives). When the value the box names is also short
  (the shortfall line's own test, so the two never disagree), the box adds "It still gives less on X than your earlier
  answers asked for." (the approved example's words, with "on" added so every value name reads well). Saved as
  `apa.mainValueShortSaid`; database `apa.page_said_the_option_falls_short_on_that_value` (null elsewhere and for older
  rows). **Both doors** (the main study never reads the door; N27 fails if it ever does; seen live in each door).
  **Only APA_Only has the box**, so this exact clash cannot happen in condition 1 (its APA page says only "It fell short
  on ..."; seen live). **The APA list heading, conditions 1 and 3 (the researcher's "B", the same day):** it said "These
  options best fit X - the value you just prioritized.", which could list the person's own option one screen after "It
  fell short on ... X" (both true, but it read like the same clash, and "best fit" sounds like a fit verdict). It now says
  "These options are built on X - the value you just prioritized." - what the list is (the options whose strongest value
  is X, the idea of APA_Only's box). Every value has an option built on it in all four decision scenarios, so the heading
  is always true. N28 (5 breaks, 5 caught); seen live in condition 1. The question above it ("... you'll see the options
  that fit it.") is unchanged. Nothing stored changed.
- **3, the thank-you page's progress bar ("3-A"; `GlobalStepper` `finished`).** The thank-you page is still the feedback
  stage, so the bar said "Finish · You are nearly there" with Feedback current. Once the feedback is sent (or a reload
  reads the saved status) every step is drawn done, the flag says "Done" and stops its looping animation. Both doors.
- `SHAPE_VERSION` "2026-10-07-rehearsal-fixes". **Checked:** `validate:dbshape` D70 (the six, an honest fast reader with
  every short page under 30 s keeps the gift card, a rusher of three real parts loses it), `validate:conditions` N27 (the
  rule recounted by hand over every option and 400 pretend profiles, the words from the source, saved, the database),
  `validate:journey` J17 (and J8 taught the finished check's new form); 16 deliberate breaks, 16 caught (one only after
  J17 counted every spelling of `finished`), and 2 more for the both-doors line of N27, 2 caught. Live, a second full rehearsal: scenario 1 showed the sentence and scenario 2
  did not (both saved as shown), the bar said "After the feedback", "You are nearly there", then "Done" after sending,
  after a reload and on a 375px phone; the record's rushed list held only real parts and the short pages apart.

## Prolific: planned, not built (since 1 October 2026)

**Decided 6 October 2026** (the researcher, after his advisor): TWO versions on one website - the email version as it
is for FIT students and employees at https://moonlander.fit.edu, and a Prolific version at
https://moonlander.fit.edu/prolific ("1-A"); the conditions balanced within each group on its own ("2-A"); the second
"pick the number" row in the Prolific version only ("3-B"); the Prolific demographic page without the email only
("4-A"); `Prolific docs/` in .gitignore ("5-yes", done); the first Prolific batch 40 places ("6-40"). **No pilot**
(budget: every participant's data is kept). **Every Prolific submission is "Manually review"** (one completion code,
on the server only); every day the researcher exports the participants collection (Compass, JSON) and Prolific's
submissions file into `Prolific docs/daily/`, and Claude says which Prolific IDs to pay, which to look at and which did
not finish, by Prolific's own valid reasons only. Build order: Step 0 (done, above), Step 1 the two doors and the
Prolific ID (done, "Two doors" above; it took the demographic page without the email), Step 2 the consent page and Step 3
the number row (both done 7 October 2026, with the privacy fix), Step 4 the end page with the code and Step 5 the daily pay check
(both done the same day: "The Prolific completion code", "The daily Prolific pay check").

The study will be recruited on Prolific, but only AFTER the four conditions are built and tested (the researcher's
order, 1 October 2026). The full plan - Prolific's rules with their sources, the answers for Prolific's study form,
every place the email is the participant's key, the consent, demographics, completion-code and attention-check changes,
the checks to add, the audit and the decisions still open - is `docs/PROLIFIC_CONVERSION_PLAN.md`. Read it before
changing identity, consent, the demographic page, the thank-you page, attention checks or any payment wording, and
build the conditions so they read "the participant's key" rather than the email. Never commit `Prolific docs/`: it
holds the Prolific completion code.

## One folder, two environments (since 23 September 2026)

**This folder is both the development copy and the production copy.** Work here. There is no second
folder to convert afterwards, and nothing needs to be "made ready to deploy" — the deployment agent's
only job is to copy this folder to the server and run it.

| | How it runs | What it talks to |
|---|---|---|
| Development | `npm run dev` (Vite, port 5173) + `npm run server` (API, port 4000) | local MongoDB at `127.0.0.1:27017`, database `vrds_experiment2` |
| Production | `NODE_ENV=production node server/index.js` after `npm run build` | the server's MongoDB from `MONGO_URL` in `.env`, database `VRDS2` |

`server/index.js` serves the built site from `dist/` **only** when `NODE_ENV=production`. In
development that block never runs, Vite serves the pages and proxies `/api` to the same API server,
and nothing about the local workflow changes. `./build-and-run.sh`, `stop-project.sh`,
`ecosystem.config.cjs`, `.env.example` and `DEPLOYMENT.md` are the server's side of it. `.env` holds
the database password and is git-ignored — never commit it and never print it (`server/db.js` masks
it in logs and on `/api/health`).

### Resume state is MERGED by the server, never replaced

Every browser a participant has open syncs its own copy of `resume_state`. Written with `$set` that
was a whole-object replace, so the last browser to sync won - and a tab left open on an earlier
machine, holding the run as it stood an hour before, silently replaced the complete snapshot with
its own. On 23 September 2026 a participant who had finished all four blocks signed in on a third
browser, received a Block-3 snapshot, and was sent back to Block 1 because Block 5 found no
profile.

`server/resumeMerge.js` now merges by file: a browser may update the files it holds and may not
delete the ones it has never heard of. One named exception - `vrds_active_time` keeps the larger
`totalMs`, because a running total of working minutes must never go backwards. Resume writes are
refused outright once `status` is `Study Completed`, since the completion route unsets the field on
purpose and a stale tab must not put it back.

`npm run validate:resume` stands over it, replaying that exact run: a Block-3 browser syncing over
a finished one must keep every file.

### A new database section has to be allowed in two places

`dbShape.ts` decides where a section lands; `WRITABLE_ROOTS` in `server/index.js` decides whether the
API will accept it. A path in one and not the other is refused with a 400, and until 23 September
2026 that was worse than losing the section: the outbox stopped at its first failure, so a refused
write sat at the head of the queue and held back **every** write behind it, in production and in
local development alike. `sessions` shipped that way.

Two things now stand over it. **Gate D44** in `npm run validate:dbshape` reads the server's own
source and fails if any path the browser writes is not a root the server accepts. And `storage.ts`
now separates "the server is down" (keep, retry, preserve order) from "the server refused this"
(park it in `vrds_outbox_refused`, log loudly, and let the queue drain).

## What counts as a visit, and what counts as working time

Both numbers are reported to the participant on the thank-you page, stored in `active_time`, and
used to judge compensation, so the rules are written here rather than left in the code.

**Working time** advances only while the tab is visible AND something was moved, typed, clicked or
scrolled within the last 90 seconds. The 90 seconds are counted as work on purpose: somebody
reading a long scenario without touching anything is still working.

**A visit** ends when the participant is away for more than 30 minutes and begins when they come
back. It is measured input to input — from the participant, never from the heartbeat — and counted
at the moment they return, or at the page load that follows. Opening the study on a different
browser is also a visit; `sessionLog.ts` sees the change of machine and calls `noteNewVisit`.

**The ledger belongs to the participant, not the browser.** `claimActiveClockFor(email)` replaces it
when a different person is identified in the same browser. Until 23 September 2026 it did not, and
the local database showed what that costs: seven participants with identical time (3.8 minutes,
first seen twelve days earlier) and visit counts of 26, 28, 31, 77, 90, 96 and 99. Two people
sharing a computer would have had the second one's entire run recorded as no work at all, because
`stopped` survived in storage from the first one's finished study.

`npm run validate:visits` holds all of this: it runs the real `activeTime.ts` against a faked
browser with a clock it moves by hand, over ten scenarios — one sitting, a 31-minute break, a
reload after lunch, a second participant at the same machine, the same participant on a second
machine, and a finished study that must earn nothing more.

## Running it

```
npm run dev       # the study, on http://localhost:5173
npm run server    # the API that writes to local MongoDB, on port 4000
```

The study runs **without** the server — it then saves to the browser only, and nothing is queued.
In development the server check happens once at page load, so if you start the API afterwards, **refresh the page**
or that session stays local-only. (The live site keeps asking until the server answers: "Many people at once".)

## Before changing anything

```
npm run typecheck && npm run lint && npm run validate:block5 && npm run build
```

`validate:block5` must print `ALL TESTS PASS`, `ALL APA CHECKS PASS`, `ALL PROFILE GATES PASSED`
(since 24 September 2026), `ALL DATABASE GATES PASSED`, `ALL VCI_ALL GATES PASSED`, `ALL JOURNEY GATES PASSED` (both since 28 September 2026), `ALL SESSION GATES PASSED` and `ALL ATTENTION GATES PASSED` (both since 29 September 2026), `ALL CONDITION GATES PASSED` (since 1 October 2026) and `ALL PAY CHECK GATES PASSED` (since 7 October 2026). Since 23 September 2026 `validate:position` runs LAST in that chain: it failed on purpose
until 26 September 2026 (it passes since Fix 6, see below), and while it ran in the middle the `&&` stopped everything after it, so the three lines
above were never printed and four suites never ran. It is the guard on the scoring model and on what reaches MongoDB; treat a failure there as
a blocker, not a warning.

**After any change to an option number, a scoring rule, a step size, the planner or a scenario, also run
`npm run report:major-scores`** and commit the regenerated `docs/MAJOR_SCORES_DISTRIBUTION.md` with the change
(the researcher's standing request, 26 September 2026: "update this table when we update anything"). It is the one
page that shows every major score for every kind of pretend participant, and it says which code version made it.

The last of those three comes from `npm run validate:dbshape`, which runs the real `dbShape.ts`
builders over three simulated participants. It is the only check on `analysis` — nothing in there is
ever displayed, so a wrong number would otherwise sit unnoticed until somebody opened the collection
to write a paper.

## The Moral Commitment Function (MCF), since 23 September 2026

For one option in one scenario, MCF says what it gives beyond what the participant asked for on
each of their four values, what it asks of them instead, which option on that table serves each of
those values most, and what taking that one would ask in exchange. It lives inside the **Compare
all options** overlay, under the values chart, and every option's reading starts closed.

**It is a decomposition, not a second opinion.** The study already scores an option as one
shortfall, and `policyShortfallByValue` in `block5CVR.ts` already breaks that sum into its four
parts. `block5MCF.ts` CALLS that function rather than repeating the formula, so MCF cannot
disagree with the alignment label — it is the same number read one value at a time.

**Two rules govern every word of it, and both are enforced by a gate, not by good intentions:**

- **No verdict.** Never "aligned", "misaligned", "best fit", "recommended", "should".
- **No arithmetic.** Never a value number, a shortfall, a percentage or a rank.

That is why the sentences live in `block5MCFWords.ts` rather than inside the panel: a rule that
lives in JSX can only be checked by reading JSX. Built as plain strings, every sentence the study
can produce is inspectable, and `npm run validate:mcf` generates all of them — 61,509 across every
option in every scenario against 403 profiles on 29 September 2026 (61,945 before the words were revised on 27
September; the run prints the current count) — and fails on a verdict word or a digit. Quoted
option titles are exempt from the digit rule: "Draw the 20 names from the patients who cannot wait"
is content the participant is already reading.

**One thing is computed and deliberately never shown:** whether the swap option costs this
participant more or less overall. That is exactly a fit comparison between two options, so it is
stored for analysis and never becomes a sentence.

**Exposure is recorded because MCF can change a choice.** It is the only place in Block 5 where a
participant's own values are put into words while they are still deciding, and seeing it takes two
deliberate acts — open the overlay, open a reading. `analysis.mcf` therefore leads with `was_read`,
`options_read`, `readings_opened` and `seconds_reading`, and most of what that section stores was
never on screen. `MCF_VERSION` is stamped on every row; rows made under two versions must not be
pooled.

**MCF is shown on purpose, as one of the study's contributions** (the researcher's decision, 27
September 2026, after checking with the advisor). Fix 1 does not remove it: Fix 1 takes four lines off
the open option cards and never touched MCF. It stays inside the Compare overlay, each reading closed
until opened.

**The words, revised 27 September 2026 (the researcher's approval).** An audit over 4,000 pretend
participants found the old words gave the side of a gap but not its size ("More than you asked for" for
1 point and for 60; "a little below" up to 24 points; 28 in 100 "It asks" sentences read "a little below
on X" with no "where you stand"), and that "Most of all on X" could read as a contradiction because it
weighs the gap by how strongly the value is held. Now: three sizes each way from the bands block5MCF
already has (SLIGHTLY under 10, plain 10-24, WELL 25+); "exactly where you stand"; "because you hold it
more strongly than Y" when the costliest value is not the biggest gap (true by arithmetic, and checked);
"where you stand" instead of "what you asked for"; an intro that says what above and below mean; and a
value-by-value row per value, strongest first, with a colored tag. Each value keeps the color and icon of
"Your values in this scenario" (`block5ValueLook.tsx`), above is green and below red, and each option
carries its chart color. The words are built as colored spans in `block5MCFWords.ts` (`mcfWords`;
`plainText` joins them), so the gates still read plain text. The values chart's caption and the "How to read these charts" note in the same overlay now
say an option "falls below where you stand on that value" (was "gives up something you said mattered"), so
the overlay says it one way; the dashed "you" shapes on both charts stay, in every scenario (the researcher's
decision, with the advisor). The page before Block 5 teaches the same words: its example chart says the
dashed line shows "where an option reaches above where you stand and where it falls below it", and one
sentence under it names the MCF panel ("The same comparison, in words", in the first five situations only). The arithmetic and `MCF_VERSION` did not
change. Gates M8 (every size word matches its gap), M9 (the "because" is said exactly when it should be,
and is true), M10 (every reading names all four values once) in `validate:mcf`; each was checked by
breaking the code on purpose.

**Not in scenario 6, and neither is "Your values in this scenario"** (the researcher's decision, 27
September 2026: "scenario 6 no MCF and no 'Your values in this scenario' section. Hide both"). There the
four rules ARE the four values, so a reading told the participant which rule meets where they stand before
they chose (74-84 in 100 readings of a rule that was not their best fit named exactly their best-fit rule),
and the panel's four numbers, strongest first, pointed the same way. The values chart in the Compare overlay
stays (the researcher's choice); **since 29 September 2026 the performance chart does not** (the researcher: "Scenario 6
should not have performance radar chart"): scenario 6 shows no performance numbers anywhere, and its four rules all
score 50, so the chart drew four identical flat shapes (`showPerformance` in Block5OptionCompare.tsx; the overlay then
says "one chart"). Gate M11 (`validate:mcf`) reads the source; `analysis.mcf` rows carry
`could_be_opened_in_this_scenario` (false in scenario 6; gate D64, `SHAPE_VERSION`
"2026-09-27-mcf-not-in-scenario-6").

## The keep rule, revised 24 September 2026

When a participant picks one of their two best-fit options, no reflection runs and
`applyKeepUpdates` (block5CVR.ts) moves the profile. It now learns from the COMPARISON:

- a **best-fit (Aligned) pick moves nothing** — the model's own guess came true;
- a **second-best (Weakly aligned) pick** is compared with the best fit it was chosen over: +20 to
  the value where the pick beats the best fit most, −15 to the value where the best fit beat the
  pick most (weighted by how much the participant holds it).

It replaced a rule that read the option alone, which let a best-fit pick lower the #1 value (16 in
100 best-fit picks) and let a second-best pick lower nothing (35 in 100). It needs the scenario's
options as its fifth argument; every caller passes them. Gates V13-V15 in `validate:vci`. VCI and
Stability figures in the method docs were re-run and updated the same day.

## No profile number on the "confirm keeping" question, since 24 September 2026

After a participant keeps a misaligned option, the question used to read "…gives up X, which you
rated 94 out of 100. Do you put Y above X here?". The number is gone (the researcher's choice): it
showed a profile score while Block 5 was still running, "you rated" was untrue (the score is
computed, never rated), and it came from the live profile, so the same value could read differently
in two scenarios. The question still names the trade. **Participants see this change**; records
before 24 September 2026 were made with the number on screen. The APA page's "missed by N points"
is a separate case and is unchanged.

## The fit score is a share of what the participant asked for, since 24 September 2026

`policyAlignmentScore` used to be 100 minus the weighted shortfall, stopped at 0. A demanding
participant falls more than 100 short on many options, so several cards read "0 out of 100" at once
(5 in 100 cards; two or more on one menu in 8 in 100 scenarios; the best fit under 50 in 7 in 100).
It is now `100 × (1 − shortfall ÷ the most this participant could lose)`: 100 = the option meets
every value they hold, 0 = it gives nothing on any. For one participant the denominator is one
number, so **no order, label, VCI, Stability, planner or MPF number moves** (the MPF reads the
shortfall). **Participants see different numbers**: the card line "Matches your earlier answers",
and the results page's fit bars and "Fit N" badges. The results page's "fit your values well but
performed below 45" count now uses the label (Aligned or Weakly aligned) instead of "score 60 or
more", a line that meant something else on the new scale. Every new scenario row carries
`fitScoreScale`; `dbShape.ts` puts an untagged (older) row's numbers under
`old_fit_score_saved_before_24_september_2026`, never under the new field names. Gates V16–V17
(`validate:vci`) and D54 (`validate:dbshape`). The raw shortfall itself is saved too, as
`matchShortfall` / `fitShortfallsByOptionId` on the row and `points_short_of_what_they_asked_for`
in `analysis.alignment_records`: it is on one scale for every participant, which the share is not
(gate D56).

The same day, the side-panel sentence "Each is labeled by how well it fits your earlier responses"
was removed: the labels came off the cards on 15 September, so it sent participants looking for
something that is not there, and it pointed them at their own fit. It now reads "Every option stays
available, and you can choose any of them."

## Every value move is recorded, since 24 September 2026

Block 5 moves the profile in flat steps and `bump()` keeps every score between 0 and 100, so a step
past an edge is cut off there. Until this date the cut left no trace: "did not move" and "could not
move, it was already at 100" looked the same. Each update rule now has a twin that also returns its
moves (`applyKeepUpdatesWithMoves`, `applyEndorsementUpdatesWithMoves`, `applyApaUpdatesWithMoves`
in `block5CVR.ts`); the plain versions call the twins and return the same profile, so no score
changed. Each scenario row carries `valueMoves` (`{ value, from, requested, applied, why }`), and
`analysis.value_moves_asked_for_and_made` lists them in words and counts the ones cut off. Gates V18
(`validate:vci`: 9,000 updates, the record always adds up to the real change) and D55
(`validate:dbshape`).

## Scenario 5 is only a wish, since 25 September 2026

The researcher's design: scenario 5 exists only to see how far the WISH (the same decision, made by
somebody else and landing on the participant) sits from the DECISION they made in scenario 4, and
from their pre-Block-5 values. No reflection runs there on purpose: the participant has just seen
scenario 4's information and reflection, and scenario 5 is identical except for their role. So they
either wish for what they decided (every gap must be 0) or for something that helps or hurts them
more, and the study reads, value by value, which value rose.

- **Performance counts the four decisions only.** `scenarioCountsTowardsPerformance` /
  `resultCountsTowardsPerformance` (block5CVR.ts) gate all three averages (`averagePerformance`,
  `overallCaptured`, the running bars). This also took out scenario 6, whose rules all score 50 and
  had kept everybody below 100: the strongest option in every scenario read 92. The database headline
  is worked out again from the rows, so old records follow the same rule.
- **Participants see it:** no "Preview impact" on scenario 5's cards; the side-panel sentence drops
  its preview half; the performance bars carry one line, "This is a wish, so it does not change these
  bars." (since 3 October 2026, the researcher's request, in all four conditions: in the scenario's own color, semibold, in
  a lightly tinted box with the info mark - it was the faintest grey text in the panel; `data-wish-note`). The results page stars scenario 5's performance bar ("Scenario 5 *", explained in the
  sentence under the chart: the label column is too narrow for more) and leaves it out of the average.
- **Scenario 5 is shown and scored on the values scenario 4 OPENED with** (`profileShownIn` in
  block5Mirror.ts), on screen and in the saved numbers; the live profile is still the one updated,
  and scenario 5 updates nothing. Before, the same six options showed different fit numbers in the
  two scenarios for 81 in 100 pretend participants, and wishing for the option they decided gave a
  non-zero gap for 56 in 100. The card ORDER was already identical (it comes from the frozen
  profile). The row carries `scoredOnProfileOf`, and the database rebuilds the wish's prediction
  and MCF rows on the same values.
- **What the wish changed, value by value:** `analysis.position_effect.decided_versus_wished.
  wish_minus_decision_by_value`, with the biggest rise and drop in words, copied into
  `major_info_and_scores.vci`. **And in performance, metric by metric** (the researcher's request):
  `wish_minus_decision_by_performance_metric` over the five metrics, plus
  `overall_performance_wish_minus_decision`, copied into `major_info_and_scores.performance`.
  Positive = the wish performs better there; all 0 for the same option.

**The company's value, as shown, is saved** (the researcher's request): each scenario-4 and -5 row
carries `companyValueShown` (set in `finalizeScenario`, from the same `deriveCompanyValues` call the
card makes), read into `analysis.position_effect.company_value_shown` and, in one line,
`major_info_and_scores.company_value_shown_in_scenarios_4_and_5`. **So is what they did with it**
in scenario 4 - "Took the company's values" / "Split the difference" / "Held your own values",
the verdict the results page shows - in `analysis.position_effect.company_stance` (built by the same
`analyseStance` the page calls) and `major_info_and_scores.company_stance_in_scenario_4`.

Gates W1-W5 (`validate:twins`) and D57-D61 (`validate:dbshape`).

## VCI_all and the hidden running values, since 28 September 2026

The researcher's design, approved plan 3 ("Q1-A, Q2-yes, Q3-yes, Q4-described"). The results page shows two consistency
cards: **VCI** (scenarios 1-4, where the participant decided and knew their position; unchanged) and **VCI_all** (all
six). Nothing on the scenario pages changed, and no existing score moved (every line of MAJOR_SCORES_DISTRIBUTION.md
other than the new section 1b is identical).

- **The running values** (`block5VciAll.ts`): a hidden copy of the four policy values, equal to the study's values
  through scenario 4 and ALSO moved after the final choice in scenario 5 (the wish) and scenario 6 (the veil), where the
  study's own values never move. Kept in `progress.runningProfile`; every result saves `running` (hidden).
- **The running rule** for scenarios 5 and 6 (no reflection runs there): the keep rule's comparison with the best fit
  for every non-best pick, +20 / -15; the best fit moves nothing (`applyRunningMoveWithMoves`). The keep rule's
  comparison moved into `moveByComparisonWithBestFit`, unchanged (gate A1 proves it on 60,000 cases).
- **The running fit** = the FINAL choice's label on the running values when the scenario opened (never on values its
  own choice moved - the V8 circularity). Scenario 6 counts its final choice. **VCI_all** = 100 × the mean of the six;
  blind 50; levels derived like VCI's: 88.89 / 77.78 / 62.5 / 47.22 / 27.78 (`VCI_ALL_LEVELS`).
- **Stated, not corrected (the researcher accepted both):** scenario 5's cards show fit on scenario 4's OPENING values,
  the running fit judges the wish on the values AFTER scenario 4's choice, so (a) the echo: 35 in 100 wishes for the
  decided option score higher; (b) 8 in 100 wishes for the best-looking card score below 100 (seen on a real browser
  run: 85 on screen, second-best on the running values).
- **Traps:** VCI_all contains VCI - never correlate them; two scenario-5 fits (`vci_wished` for H12 is the study's).
- **Stored:** `headline.consistency_score_all_six` / `_label_all_six`, `analysis.vci_all` (with a self-check that
  REBUILDS every running fit from the saved record and must agree; old records get rebuilt values),
  `running_*` on `analysis.alignment_records` rows, a copy in `major_info_and_scores.vci`. `SHAPE_VERSION`
  "2026-09-28-vci-all", `RUNNING_VERSION` "2026-09-28-a". Gates: `validate:vciall` A1-A8 (in the chain) and D65; every
  gate was shown to fail on a deliberate break. Method: `docs/BLOCK5_VCI_METHOD.md` section 12.
- **A lesson from building it:** a new module the check tools `require` from `.sim-build` must be listed in
  `tools/tsconfig.sim.json`. `block5VciAll.ts` was first missing there, so a check ran on a stale compiled copy left
  over from a deliberate-break test and failed on the correct code. It is listed now.

## Stability_all and the top-value choices, since 29 September 2026

The researcher: "Stability_all for all 6 scenarios, so we can see if the user will pick the most top value or values as
pre-block5 user profile?" Approved plan answers "Q1-yes, Q2-recommended, Q3-recommended, Q4-A". The question has two
halves, so there are two things. **Participants see the first** (a new card; HOW_TO_ANALYZE 4.9). No existing score moved.

- **Stability_all** (`block5StabilityAll.ts`): Stability's own rule (swaps in the order of the four values, a tie as
  half; `rankSwaps`, `stabilityFromSwaps`, the same level words) over all six scenarios, on the hidden running values
  behind VCI_all. Scenarios 1-4 count exactly as Stability does (a decision where the reflection ran), so that part equals
  Stability swap for swap; scenarios 5 and 6 count when the FINAL choice was not one of the two best fits on the running
  values the scenario opened with ("Q2-recommended": the moment a reflection would run in a decision; a second-best pick
  never counts, as in Stability). So Stability_all is never above Stability and equals it when 5 and 6 add nothing:
  **it contains Stability - never correlate the two, compare the difference.** Steps in 5 and 6 are smaller (+20/-15);
  scenario 5 has VCI_all's echo (about 5 in 100 second-best pickers get a counted step there); its level depends on the
  step sizes, like Stability's (R7). Saved on the finished block (`stabilityAll`, `stabilityAllLevel`), shown on the
  results page as a card beside Stability ("Q3"); since the redesign the same day, as the second number in the purple
  stability box ("All 6 scenarios", beside Stability's "Your 4 decisions"). Stored: `headline.stability_all_score` / `_label` /
  `_was_measured` / `_conflict_steps_counted`, `analysis.stability_all` (every step, why it counted, its swaps, and a
  self-check: the score recomputed equals the saved one, and the decisions' part equals Stability's swaps), a copy in
  `major_info_and_scores.stability`. `STABILITY_ALL_VERSION` "2026-09-29-a"; `SHAPE_VERSION` "2026-09-29-stability-all".
  Example (a real test run): Stability 100 (no reflection in 1-4), Stability_all 50 "Shifted a little": scenario 6's rule
  was strongly misaligned and moved gained +20, vulnerable -15, and three pairs traded places.
- **Top-value choices** (`computeTopValueChoices`; "Q4-A": saved, never shown): in how many of the six scenarios the
  final choice was the option that does most for the #1 value brought into Block 5 (a tie counts for every tied option),
  and for the #1 or #2. Blind choosing gives 1.08 and 2.17 of 6 on these menus; someone true to their top value 6; a
  best-fit picker about 2.7 (the best fit balances all four values). `analysis.top_value_choices`, copied into
  `major_info_and_scores.top_value_choices`.
- **Measured** (2,000 pretend people of each kind; `npm run report:major-scores` sections 2b and 2c): Stability ->
  Stability_all, best-fit pickers 100 -> 100, true to their top value 90.5 -> 89.4, random 57.5 -> 39, flip-floppers
  11.7 -> 3.4, corrected by APA 93.6 -> 71.4 (scenarios 5 and 6 have no APA).
- **Checked:** `validate:vciall` A9-A12 (the decisions' part equals Stability's swaps, which steps count, a best-fit
  picker 100 and not measured, the top-value counts recounted by hand), `validate:dbshape` D67 (every step and score
  recounted by hand, the headline and the copy, a case where Stability and Stability_all disagree on "measured", a record
  without running fits rebuilt), `validate:journey` J11 (the card beside Stability; the top-value choices on no page).
  Ten deliberate breaks, all caught (one only after D67 gained the disagreeing-flags case).
- `block5StabilityAll.ts` is listed in `tools/tsconfig.sim.json` (the lesson of VCI_all).

## The charts page ("A picture of your journey"), refreshed 28 September 2026

The researcher: "most of the visualization cards are stale". The page (`Block5VisualizationsView.tsx`, then opened
from the results page, after every choice; **since 29 September 2026 drawn on the thank-you page, after the feedback,
in five tabs**, see "The results page and the thank-you page, redesigned" below) had stopped at scenario 5 and predated
a week of changes. Refreshed card by
card on the approved plan ("Q1-A, Q2-final, Q3-yes, Q4-yes"); its new numbers live in `block5Journey.ts` (pure, no
React), which `npm run validate:journey` checks (J1-J8, in the chain; every gate shown to fail on a deliberate break).

- **Scenario 6 on the page:** a row in the choice card; the value line runs to S6 (flat in S5 and S6 until 30 September
  2026, now moved by the running values: see "The value line moves in scenarios 5 and 6");
  a "behind the veil" reference drawn APART from the five positions, never a sixth bar (its FINAL rule's
  `profileDistance` from the values brought into Block 5, the four rules' range; the H13 idea); its own card,
  "Behind the veil: your rule and our guess" (the MPF's chances, first and final rule, the "sounds like me"
  answer); reconsidering split before/after the guess; a note that it had no performance numbers.
- **Consistency shows VCI and VCI_all** as two dashed lines (blue and cyan, the results page's colors); the six
  points are VCI_all's parts, the hidden running fits, so they average to VCI_all ("Q1-A": shown after all choices).
  A run without running fits falls back to the study's fits and draws no VCI_all.
- **Stale text fixed:** five position colors from the deck (`DECK_POSITIONS`), not "three"; the wish is not called a
  decision; VCI is "your four decisions"; Stability says "not tested" when no conflict step ran (G5).
- **Added:** what the wish changed, value by value and in performance (analyseMirror had it since 25 September);
  a Block 4 card ("Would you approve the policy?" before any voice, after each, with confidence). Card numbers and the
  header count come from one ordered list (`cardOrder`), so a hidden card never leaves a gap.
- **The thank-you page after a reload:** a finished participant (status "Study Completed") opens on the thank-you
  screen, never the form again (`alreadyCompleted`, ExperimentFlow -> UserFeedbackPage); before, a second submit
  could overwrite the answers. The "Finish" button was removed the same day.
- `block5Journey.ts` is listed in `tools/tsconfig.sim.json` (the lesson of VCI_all above).
- **Scenario 6 is a bar of its own in "How far each choice sat from the person you were"** (the researcher's
  "Q2-yes", later the same day): it was a text box under the explanation and easy to miss. It is the last bar,
  drawn APART under a dashed line labelled "Behind the veil · no position" (`HBar.apartLabel` in block5Charts.tsx),
  solid slate (`VEIL_COLOR`), on the same scale; the sentence under the chart gives the four rules' range and says
  it is not part of the comparison between positions. The first version was striped with a range line under the
  bar and a 63-character label in capitals: in dark mode the label ran off the chart and the bar looked like a
  second bar behind it (the researcher's screenshot), so both went. J10 holds the label to 36 characters. The
  Position Effect and the per-position averages still leave it out.
- **A new card, "What our software expected, and what you chose"** ("Q3-yes, Q4-yes"), right after the scenario-6
  guess card: for each of the six scenarios, the MPF's favourite (violet) and the final choice (teal) on one
  0-100% line at the chance the MPF gave each, joined by the percentage points between them; one ringed dot when
  they are the same option; a hollow dot for a first choice that later changed; a dashed tick for a blind guess
  (`DumbbellChart`). Its numbers ARE `analysis.mpf_prediction_percentages`: the page calls
  `buildMpfPercentages(buildMpfPredictions(results))` from dbShape.ts and `predictionReading` (block5Journey.ts)
  only picks fields. The card says scenarios 1-5 were worked out afterwards, that the favourite is always the best
  fit (so it is the consistency story told as chances), and that the chances use the end-of-block VCI and
  Stability. The two "hurried" notes (the wish card under 12 seconds, Blocks 1-3 under 2.5 seconds) were kept on
  screen (the researcher's "Q1-C"). Gate J10; 6 deliberate breaks, 6 caught.

## The way on from the results page to the feedback, since 28 September 2026

The researcher: in the previous experiment participants reached the results page, took it for the end, and never gave
feedback. The page said so itself: a green "Complete" badge over "Main Simulation Complete", and its only "Continue to
feedback" button at the very bottom. Built on the approved plan ("Q1-A, Q2-yes, Q3-yes, Q4-yes, Q5-yes").
**Participants see it** (HOW_TO_ANALYZE 4.9). No score and no stored scoring number changed.

- **Header:** a pink "Scenarios done · 1 step left" badge over "Here are your results".
- **A "One last step" card** (`Block5FeedbackNudge.tsx`, `LastStepCard`) right UNDER the four score cards ("Q1-A"): every
  participant sees their main scores first (the advisor's design is results before feedback), and it asks them to look
  through their results first. "About 5 to 10 minutes" (32 required answers, up to 48 with the reflection sections, plus
  up to 8 optional written ones). The gift-card line says "Answering them completes the study, which you need for your
  $5 gift card": NEEDED, never "earns", because the consent page names a second rule (the active minutes).
- **A slim bar at the bottom of the screen** (`FeedbackBar`) on the results page (and, until 29 September 2026, the charts
  page). It shows only while
  neither the card nor the page's own bottom button is on screen (IntersectionObserver), slides in, never loops, and
  reads "1 step left · feedback" on a phone. It invites and never warns: no leave pop-up (the consent page promises the
  participant may stop at any time).
- **The progress bar** (GlobalStepper): on the results page the Feedback dot is pink with "next" under it and the flag's
  note reads "After the feedback" (it said "End of the study"). Static, not clickable; the flag keeps the one looping
  animation. **On a phone the rail now slides to the current stop** (and the "next" one): it always opened at its left
  end, so on a 375px phone the results page showed neither "Your results" nor Feedback. This affects every stage on a
  narrow screen; on a wide one everything fits and nothing moves.
- **Recorded:** `analysis.results_page` (resultsPageRecord.ts -> SOURCE_MAP in dbShape.ts): which button first took them
  to the feedback (`card_under_scores`, `bar_on_results`, `bottom_of_results`; the two chart-page buttons and "opened the
  charts first" went on 29 September 2026, when the charts moved after the feedback) and how often they went. The time
  on the page is already
  `active_time.by_stage_minutes.block5_summary`. The browser file travels with `resume_state`. `SHAPE_VERSION`
  "2026-09-28-results-page". Gates D66 (`validate:dbshape`) and J9 (`validate:journey`, from the source); each was shown
  to fail on a deliberate break (7 breaks, 7 caught).
- **Testing note:** the bar's "is it on screen?" signal fires only when the page draws a frame, so in a hidden browser
  pane it can look stuck until something is drawn. Not a bug on a real screen.

## The results page and the thank-you page, redesigned 29 September 2026

The researcher: show the study's purpose and the major scores "in very nice and elegant content and coloring numbers",
keep every choice with its label and fit, less scrolling, and move the charts to the thank-you page "so the user can
enjoy of their Journey results after finishing the feedback". Plan answers "1-A 2-A 3-A 4-Yes", with his wording notes:
write for somebody who knows nothing of how the study was built (no "Block 1-4", no "CVR", no "MPF" on the results
page), stability is "who they were before the main study and who they are after", say briefly how alignment and
stability differ, and not "Why this study" (it reads as if they are about to take it). **Participants see it**
(HOW_TO_ANALYZE 4.9). No score and no scoring number changed.

- **Results page** (`Block5SimulationSummaryPage.tsx`), top to bottom: the "1 step left" header; **"What your results
  show"** (the first parts measured their four values, the six scenarios their choices, the scores compare the two: "a
  mirror of how you decide, not a grade"); **three score boxes, one color per family** ("2-A"): value alignment, blue
  (VCI, VCI_all; "We call it your value consistency (VCI)", a mark at 50 for random choosing - removed 4 October 2026, see
  "The results page explains itself"), stability, purple
  (Stability, Stability_all; "Not tested" under a number when no moment tested it, "4-Yes"), performance, teal; a line
  that says alignment looks at the choices, stability at the values, performance at the results; **the four values
  before and after**; the "One last step" card; **every scenario as a compact card** ("3-A"), keeping everything the old
  tall boxes held (the researcher: "I like all the information in the current 'your choices, scenario by scenario'"):
  title, the place they stood (`ROLE_BADGE`, `block5RoleWords.ts`, the scenario page's own badges), ✓ "Your choice" (or
  "Your wish", or "Your first choice, before you saw the guess" / "Your final choice" in scenario 6), the label,
  "Reflection shown" (was "CVR shown"), "Kept after reflection", Fit, the note; scenario 6 "Our software expected this" /
  "guessed right / wrong"; and a note naming what the thank-you page will show. The "View your results as charts" button,
  the charts view and "Raw metric average" are gone.
- **Thank-you page** (`UserFeedbackPage.tsx`): a hero with the thanks and the minutes and visits, then **`JourneyTabs.tsx`**:
  the charts in five tabs ("Your values", "Your choices", "Who carried the cost", "Our predictions", "Your first
  answers"; `JOURNEY_TABS` in block5Journey.ts), each a small card with its own color, icon and one line, the open one
  filled; each tab draws only its own cards (`tab` on `Block5VisualizationsView`) and only when opened (lazyMount). On a
  phone the row slides and snaps. The charts' words were made plain too ("the first parts of the study", "Found money",
  "Trolley", ...).
- **A Chakra trap found on the way:** `bgGradient` + `gradientFrom`/`gradientTo` on an element INSIDE a box that sets
  `gradientVia` inherits the outer box's gradient (its `--gradient-via-stops` is resolved on the outer box). The
  thank-you check circle turned almost white in light mode and hid its white check (the researcher's screenshot). It now
  sets its own `backgroundImage`. Do not nest a Chakra gradient inside a `gradientVia` box.
- **Recorded:** `analysis.results_page` keeps the three results-page buttons; the chart buttons and chart counts are
  gone (`resultsPageRecord.ts`, `buildResultsPageSection`). `SHAPE_VERSION` "2026-09-29-results-redesign".
- **Checked:** D66 (rewritten: three buttons, an old chart-page button dropped, no chart field), J9 (the bar on the
  results page only, the charts page has no way to the feedback), J11 (the three families in order and in their colors,
  each "all six" beside its "four decisions", the "not tested" notes, stability as before and after), J12 (new: no charts
  on the results page, the thank-you page draws the tabs after the feedback is sent, every chart card in exactly one tab,
  no block numbers, "CVR", "MPF", "Why this study" or "Raw metric average" on the results page). 8 deliberate breaks, 8
  caught. Seen in the browser in light and dark mode, on a desktop and a 375px phone (the page never scrolls sideways).

## Continue where you left off, and one place at a time (since 29 September 2026)

The researcher: a refresh, or a new browser, sent a participant back to scenario 1 of Block 5; and somebody could keep
working in an old browser after opening a new one, so one record had two writers. Approved plan answers "Q1-yes, Q2-yes,
Q3-yes, Q4-A, Q5-yes". No real data exists yet, so nothing here handles old records. **Participants see it**
(HOW_TO_ANALYZE 4.9). No score changed.

- **Block 5 continues at the unfinished scenario** (`block5Progress.ts`). The component used to start at scenario 1 on
  every load and delete its progress ("Issue 3: always start fresh", from the first commit, no reason given), and never
  saved any. Now, after every finished scenario, it saves the next index, the finished results, the values and the hidden
  running values, and sends them at once. It opens at the start of the unfinished scenario, built from the saved values,
  so its cards, order and fit numbers are the same (checked live: 80, 81, 76, 64, 36, 27 after a refresh, equal to what the
  saved values give). A half-done scenario starts again, and its row carries `restartedAfterLeaving: true` (its own timing
  covers the second try only; the first try's minutes are still in the working-time total).
- **Blocks 2 and 3 continue too, and every progress file has an owner.** Block 2 saved nothing before (a refresh restarted
  it); it now saves like Block 3 always has. Each file carries the participant's email and is restored only for it, so a
  second person on the same computer never continues the first person's run. Block 5's file must also match the values
  brought into Block 5.
- **Progress reaches the server as it is made** (`sessionGuard.ts`, `progressSaved`): Block 5 at once after every
  scenario; Blocks 2 and 3 gathered over a few seconds, and at once when the tab is hidden. Until now the server heard of a
  block only when it ended.
- **One browser per participant** (`server/activeBrowser.js`). Every request carries the browser's random id
  (`X-VRDS-Browser`). The document holds `active_browser`; the first writer takes it (a new participant), and the start
  screen's email-and-age check takes it on a new browser (`/claim`, which checks the age on the server too) BEFORE
  anything is written or downloaded. Every write route asks first; a write from another browser gets 409
  `another_browser_active`. The page asks `/active` when it opens, after every page and with every progress send. Either
  answer covers the page with `SessionLockScreen` ("This study is open somewhere else"); "Continue here instead" goes back
  through the email-and-age check, which downloads the newest answers first. A network problem never locks anybody.
  The rule is as strong as the email-and-age check, which is not a password.
- **One tab per browser** (`sessionGuard.ts`): each page load writes a claim to `vrds_active_tab`; a tab that sees a newer
  claim locks ("open in another tab", with "Continue in this tab instead").
- **Two older bugs fixed on the way.** `sendOrQueue` tested `!ok` on a word that is never false, so a write that failed
  because the server could not be reached was NEVER queued (lost until the completion re-send; a lost "completed" was never
  retried). It is now queued, retried every 15 seconds while anything waits, and a new write never overtakes a waiting one.
  And because queued writes now exist, `flushOutbox` runs one at a time and removes only the write it sent (two overlapping
  flushes sent the same write twice and dropped another; C5 catches it). Also, a new device now takes the participant's own
  `vrds_session_id` (it seeds scenario 6's rule order).
- **Checked:** `npm run validate:session` (C1-C8, in the chain; 9 deliberate breaks, all caught once the pretend server
  was made to answer as slowly as a real one). Live, against the local database, on a second copy of the new server: the
  old browser's saves were refused and never landed, a wrong age could not take the record, the lock screen appeared, "Continue
  here instead" brought the browser back, and the tab rule worked both ways.
- **A refresh in the pause after a block (fixed 30 September 2026; the checklist's open row).** A finished block saves
  its results and deletes its progress, then the flow shows a 0.9 s pause. The flow used to save NOTHING for a pause, so
  the browser's stage and the server's still named the finished block, and a refresh, a closed tab or a crash in that
  moment reopened it at its first question (answering it again overwrote the results). It followed EVERY block, Block 5
  included (the main study restarted at scenario 1). Now a pause is saved as the part it leads to the moment it starts
  (`flowStages.ts`: `TRANSITION_TARGET`, `stageToSave`), in the browser and on the server, and a restored pause leads
  there too (it used to fall back to Block 1). Every block saves what the next part needs before its pause. The same
  stage is not saved twice in a row. Left: the block's own last instant (about two redraws), which nobody can refresh
  in. `validate:session` C10 (5 breaks, 5 caught, one after the route was written into the check). Live: during the
  pause after Block 4 the saved stage was already `block5_intro`, and a refresh there opened "The main study starts now".
- **Block 3's card, tighter (30 September 2026, the researcher):** the title, the "Scenario N of 6" tag and the scenario
  panel are 12px apart, and the panel's top padding is 12px: the tag sat about 56px above "You are the final
  decision-maker..." (the page's 32px section gap plus the panel's padding, one blank band in dark mode); now 25px.
- **Deploying:** the page and the server may go up in either order; a page without the new server fails open (no lock), a
  server without the new page sees no browser id and allows (since 7 October 2026 it refuses a write without the id, and
  the two go up together: see "Privacy, the Prolific consent page and the second number row"). Restart the local
  `npm run server` after pulling: Node does not reload by itself.

## Attention checks, and the two between-block pages deleted (29 September 2026)

The researcher: "an attention check that tests the user's attention ... to the color, number or a letter during the
experiment", plus a feedback row "This question is just to check your attention. Pick the number four", placed at random
among the design or learning-insight questions (never CVR or APA), the number only two, three, four or five, each user
getting their own; all checks right needed for compensation "among other existing criteria". Plan answers: Q1 any place
but the insights and post-Block-4 pages ("delete them entirely ... if all the data are safe"), Q2 yes, Q3 A, Q4 yes.
**Participants see it** (HOW_TO_ANALYZE 4.9). No score changed.

- **Three checks** (`attentionChecks.ts`; revised 30 September 2026, the researcher: a colour question is unfair to
  colour-blind people and "tap the letter K" shows somebody is there, not that they read; of eight drafted topic
  questions he approved #3 and #6 only): a question about the PART JUST FINISHED on its own screen right after Block 3
  (`AttentionCheckScreen.tsx`, flow stage `attention_check`: "What was the part you just finished about?", right answer
  "Deciding whether to approve an AI system that affects workers' jobs"); the same kind of question right after scenario
  3, before scenario 4 opens ("What was the scenario you just finished about?", "Sharing out a limited cancer
  treatment"; it restarts scenario 4's clock and telemetry); and the NUMBER row in the feedback, unchanged (random place
  among "The tools & the experiment design" and "How this experience was for you", 30 places, never first in a section;
  random number two to five). Each topic question has the right answer and three from outside the study, written the
  same way, in a random order per participant; the words live in `TOPIC_CHECKS` and T1 holds them to the approved text.
  Their places are fixed (each asks about one part). Words only, so fair to colour-blind people. The screens say it is
  an attention check, never say right or wrong, and let any pick continue. `ATTENTION_VERSION` "2026-09-30-topics"; a
  file saved under another version is drawn again. (The first version, 29 September: a named colour after Block 1-4 and
  a letter after scenario 2-5, each drawn at random.)
- **Drawn once and saved** in `vrds_attention_checks` (with the owner email), which travels between browsers
  (RESUME_FILES): the same checks in the same places after a refresh or on another device; an answered check is never
  asked again; a second person on the same computer gets their own. The draw hashes the session id and the email;
  **the hash needs its finishing mix** - plain FNV-1a gave only 2 of every 4 options to 4,000 pretend participants
  (T1 caught it before anybody saw it).
- **The feedback row's answer never enters the feedback record** (saved to the attention file on submit), so no
  well-being score, tool rating or straightlining flag can move. The dev fill button answers it correctly.
- **The gift card** (`quality`, `buildQuality`): `compensation_eligible` now also needs `passed_all_attention_checks`;
  each miss, a check never reached, or no file gives its own reason. The check's own stage is never a rushed block.
  **Stored:** `analysis.attention_checks` (every check: where, asked for, button order, answer, right or wrong, seconds,
  changes), `quality.attention_checks_passed` / `passed_all_attention_checks`, a copy in `major_info_and_scores`, and
  (Q4) `analysis.feedback_answer_patterns` (longest run of one answer, share of steps of exactly one; for the analysis
  only, never for pay). `SHAPE_VERSION` "2026-09-29-attention-checks", `ATTENTION_VERSION` "2026-09-29-a".
- **Q3-A, confirmed 30 September 2026:** a miss affects the gift card only; all completed sessions are analysed. Do not ask
  the researcher analysis-rule questions: he decides them after the experiment.
- **The consent page** gained the rule "Answer the quick attention checks as asked" and the same words in the gift-card
  checkbox (Q2). **The Prolific door (since 7 October 2026)** has a second number row and Prolific's rule (failing both
  number rows), and its own consent wording: see "Privacy, the Prolific consent page and the second number row". The researcher should ask the ethics board whether this change needs approval before launch.
- **Chance:** a random clicker passes all three about 1 time in 112; a same-number answerer on 1, 6 or 7 always fails the
  number row (on 2-5 passes it 1 time in 4, but the old "same answer to every rating" flag catches them); a diagonal
  clicker passes it about 1 time in 6.
- **The insights page (after Block 3) and the post-Block-4 "final analysis" page are deleted** (with their helpers
  RankedThresholdTree and ProfileCalculationModal). They had been hidden since September and only computed; that work
  now runs in `interBlockData.ts` when Block 3 and Block 4 finish, writing the SAME files (`experiment_flow_insights`,
  `moral_profile_insights` -> analysis.post_block3_insights, `final_moral_analysis` -> analysis.post_block4_final_analysis),
  the analysis before the participant record as before. The stages `insights`, `final_analysis` and their two transitions
  are gone; a browser stopped on one lands on the next stage (`DELETED_STAGE_NEXT`). `interBlockPages.ts` now governs only
  the three completion screens.
- **Checked:** `npm run validate:attention` (T1-T8 the checks, P1-P2 the deleted pages; in the chain before
  `validate:position`); 13 deliberate breaks, 13 caught (two gates were first too weak and were strengthened). Live in
  the browser: pretend Blocks 1-3 answers, Block 4 clicked through, the three files and the participant record written;
  the feedback row after the third tool row, the record without it; a phone layout without sideways scrolling. After the
  30 September revision: 8 more breaks, 8 caught (T2 was tightened so only the version stamp could catch an old file);
  live, the Block 3 question led on to Block 4 with its answer saved, and the scenario-3 question took a wrong pick in
  silence and opened scenario 4.

## The value line moves in scenarios 5 and 6, since 30 September 2026

The researcher (a screenshot of "How your four values shifted along the way"): "scenarios 5 and 6 always straight line
from scenario 4, whatever I chose in scenarios 5 and 6 ... which totally wrong". The line drew the STUDY's values, which by
design never move on the wish or the rule (Stability, the next scenario's cards and the database read them). It now draws
the RUNNING values (block5VciAll.ts), stored on every result as `running.valuesAfter`: the study's values through
scenario 4, then moved by the wish and the rule (the best fit moves nothing; any other pick +20 to the value where it
beats the best fit most, -15 where the best fit beats it most). VCI_all and Stability_all already use them.
**Participants see it** (HOW_TO_ANALYZE 4.9). No score and no stored number changed.

- **One "after" everywhere** (`valueJourney`, block5Journey.ts): the line, the radar's dashed "after the scenarios" shape
  and the results page's "Your four values, before and after the scenarios" card all end at the values after scenario 6
  (they used to show scenario 4's). The radar caption now names Stability_all beside Stability (read from the stored
  steps when an older run did not save it) and no longer says the two shapes differ only "a little". The card's words
  say the wish and the rule count, and that the best fit moves nothing, so a flat S5 or S6 is still possible and right.
- **Trap for an analyst:** what participants saw as "after" (the running values after six) is not
  `analysis.value_profile_after_block5` (the study's values after scenario 4). Both are right for what they are.
- A run saved before the running values falls back to the study's snapshots (flat 5 and 6) and the old words.
- **Checked:** `validate:journey` J13 (the line = the study's values through S4 and the stored running values in S5 and
  S6, a best fit moves nothing, one shared "after", the fallback, and from the source); 4 deliberate breaks, 4 caught
  (one only after the check was tightened). Live on a real test run: S5 moved reducing harm 49 -> 69 and the vulnerable
  100 -> 85, S6 moved gain 52 -> 72 and the vulnerable 85 -> 70; the radar, the caption ("moved the most ... by 26
  points") and the results page's card (75 / 72 / 70 / 69) all agree.

## The profile after every scenario, in one place, since 30 September 2026

The researcher: "store the user profile after every scenario in block 5 ... keep track of the current user profile as
VCI_all", plan answers "Q1-A, Q2-yes", and "nothing change in my experiment ... everything the same as now". **Database
only**: `dbShape.ts` and one more write in `storage.ts`; no page, scenario or score changed.

- **`analysis.value_profile_by_scenario`** (`buildValueProfileByScenario`): the participant's profile, all seven values,
  after every Block 5 scenario, tracked like VCI_all (the study's values through scenario 4, then moved by the wish and
  the rule). Per row: opened, after, change, the order of the four (ties share a rank), whether it equals the study's
  values, what moved it in words, the moves, the source. Plus before, after all six, the change over Block 5, and a
  `self_check` (saved running values against rebuilt ones, decisions against the study's snapshots).
- **Built only from what was already saved**: the four policy values from `running.valuesAfter` (rebuilt with
  `rebuildRunningFits` for a record without them); directness, context and stakeholder from the study's own snapshots,
  which the running rule never moves. An old note in dbShape said those three were not snapshotted per scenario; it was
  wrong and is corrected.
- **`major_info_and_scores`** ("Q2-yes"): `profile_by_scenario` is now a copy of this table and `profile_now` its last
  row (all seven values); the study's own four-value list is `study_profile_by_scenario` (D51 and D58 read it there, and
  D51 still holds that scenario 6 never moves the STUDY's values). `SHAPE_VERSION` "2026-09-30-value-profile-by-scenario".
- **Checked:** `validate:dbshape` D68 (every row against the record, chained step to step, the other three from the
  snapshots including a hand-made record where they move, the order, what moved it, the self-check catching a changed
  value, the major copy, an old record rebuilt to the same table); 6 deliberate breaks, 6 caught (one only after the
  hand-made record was added: the pretend people never move those three).

## "Is English your first language?", and "Where are you from?", since 4 October 2026

The researcher: "add a new question to the demographic page for all four conditions: 'Is English your first language?'
Yes/No question, and make the country question to 'Where are you from?'". **Participants see it** (HOW_TO_ANALYZE 4.9). No
score changed. The demographic page is the same in every condition.

- **"A little about you" asks five questions** ("Five short questions", "Please complete all five questions to continue."):
  email, age, gender, **"Where are you from?"** (the country box, unchanged except its label and its screen-reader name;
  it said "Country"), and **"Is English your first language?"** - two buttons, Yes and No, drawn like the gender buttons,
  required, with no default (nobody is counted as Yes by not touching it).
- **Saved like the country:** `englishFirstLanguage` (true / false) in `vrds_demographics` (so also in
  `blocks…vrds_demographics`) and the browser's directory; the API client sends it only when known and reads it back;
  the server sets **`english_first_language`** on the participant document, beside age, gender and country, ONLY when the
  page sends a true or false, so a resume from a browser that does not know it never erases it. Absent on records made
  before this date. The country's field names did not change (`country`, `country_code`); only the question's words did.
- **Checked:** `validate:session` C11 (new; the words, Yes then No, required with no default, true / false, the directory
  keeping it through a resume, the flow, the API client, the server; 7 deliberate breaks, 7 caught). Live on a second copy
  of the new server (the built site in production mode, a throw-away database, deleted afterwards): the page showed the five
  questions in order, "Start the study" stayed locked until the English question was answered, a "No" was saved as
  `english_first_language: false` beside the country; the same email on an emptied browser (email, age, continue) got it
  back and the server still held `false` after the resume; on a 375px phone Yes and No share the row, no sideways scroll.
- **Deploying:** restart the API server (Node does not reload by itself); until then an old server ignores the new field.

## The country question, since 30 September 2026

The researcher: "a drop list of the country with ability to write some letters and the list will try to match what the
user wrote ... smart and elegant", and then: no example in the box and no "the country you live in", "just the country".
**Participants see it** (HOW_TO_ANALYZE 4.9). No score changed.

- **"A little about you" asked four questions** (five since 4 October 2026, and asked as "Where are you from?": see the
  section above); the fourth, **Country**, is one box (`CountryField.tsx`, Chakra's
  Combobox: arrow keys, Enter, Escape and screen readers work). Placeholder "Start typing to search", hint "Type a few
  letters and pick it from the list." Required; only a listed country or "Prefer not to say" (always last) can be chosen.
- **The list and the matching** (`countries.ts`, pure): 243 inhabited countries and territories under common English
  names with their ISO codes (Kosovo XK; uninhabited places left out), written out rather than taken from the browser so a
  stored answer never depends on the browser. Order: a whole other name typed in full ("uk", "usa", "ksa", "uae"), then
  names starting with the letters, then names with a word starting with them (El Salvador for "sa"), then other names
  starting with them ("holland", "ivory", "turkey"), then the two-letter code, then (3+ letters) anywhere. Accents,
  capitals, apostrophes and hyphens never matter. The typed letters are bold in each row; each row shows its code.
- **Stored** as `country` and `country_code` on the participant document (top level, beside age and gender), carried by
  the browser's directory, the API client and the resume. **The server sets them only when the page sends them**, so a
  resume from a browser that does not know the country never erases it (MongoDB's `$set` would otherwise write null);
  a malformed code is stored as null. Checked live on a second copy of the server: saved, kept through a resume without
  it, "Prefer not to say" with a null code, a bad code refused.
- **Checked:** `validate:session` C9 (the list, the ranking for "Sa" and 16 other searches, the bold part, the directory
  keeping the country through a resume, the server and the client from the source); 6 deliberate breaks, 6 caught. Seen
  in the browser on a computer and a phone, light and dark. Found on the way: the list was see-through (the page showed
  behind it) until it got its own background, and a Windows tool had written the accent range as invisible characters
  instead of `\u0300-\u036f` (it worked, but invisible characters in code are a trap; fixed and scanned for).
- The consent page does not list the demographic fields one by one, so it did not change.

## The planner, revised 24 September 2026

The tree, its three steps and the win counting are unchanged; no card order moved (24,000 orders
compared before and after, 0 different). What changed:

- **Two bands, two names.** `floor` (the bottom of a value's range: costed/blocked groups and Step 1)
  and the notice band `tolerance` (the smallest gap that counts: Step 2) are separate fields in
  `block5Thresholds.ts`. Today they carry the same number; they may now be read and changed apart.
- **One card sentence reworded (participants see this).** The trade line no longer says the gap was
  "too small for you to have separated it in the earlier questions" — a claim about the person the
  code cannot make. It now says "the gap there is small, while the gap on X is about N times larger."
  Records before 24 September 2026 were made with the old sentence.
- **Every order is saved with what made it.** Each scenario result carries `plannerVersion`
  (`PLANNER_VERSION` in block5Planner.ts — move it whenever the tree, its inputs or its tie-breaks
  change) and `plannerInputs` (the value order and, per value, red line, both bands and trade
  rate). `analysis.card_order_by_scenario` is the readable version, with a self-check that
  rebuilds the order from the saved inputs. Gate D53.
- **The overlap is reported, and written into the analysis guide.** `npm run report:planner-overlap`
  measures, per scenario, how often the first card is also the best-fit card, with pretend
  participants who answer Blocks 1-4 steadily and at random (real code end to end). It replaces the
  made-up-score figures of `report:planner` for this question, which understated the overlap.

## One values panel, since 26 September 2026

"How to read the four values in this scenario" (under the performance bars) and the sidebar's "Your
value priorities" card are now one panel, "Your values in this scenario" (`Block5ValuesPanel.tsx`;
`Block5ValueGuide.tsx` is gone). One tile per value, strongest first: the participant's number with a
thin bar, and what the value means in this scenario; the sidebar's hover definitions and its "every
option stays available" sentence moved with it. Like the performance panel it MINIMIZES to one row of
four chips (name and number), and it can be PINNED to stay on screen under the performance panel
while the page scrolls (tablet width and up; remembered per browser). The sticky wrapper and its
offsets live in the simulation: when pinned, the sidebar's sticky offset and the preview observer
count its height (`pinnedValuesHeight`). **Participants see it**: same information, one place.
Nothing stored changed.

## Two wildfire option numbers, since 26 September 2026

The last two questionable numbers from the audit's D1 list, both in scenario 2 (the researcher's
approval): "Fill every seat in the car with neighbors who have none" reducing harm 50 -> 62 (its card
says its cost is "room and speed, not anybody else's place in the line", so it cannot put more risk on
others than the staged convoy at 59), and "Leave immediately on the main highway" protecting the
vulnerable 44 -> 35 (its card leaves the farthest blocks, where the two residents with walkers live, in
the jam). The words did not change. Tested first on scratch copies: every check passes, every value
keeps its own champion, VCI / Stability / performance move by at most 1-2 points, the position check
goes 2.8x -> 2.9x, and "Leave immediately" stays the best fit for 1.1 in 100 steady pretend participants
(35 rather than a lower number, on purpose). **Participants see it**: in scenario 2 the fit numbers,
labels and card order change for about 1 person in 3. Both numbers carry a "VALUE AUDIT, third pass"
comment in block5Scenarios.ts; the figures the method documents quote were re-run.

## Blind-rater option numbers (Fix 6), since 26 September 2026

Three blind raters (Claude Haiku, Opus and Sonnet, each in its own folder outside this project, with no
tools; `Generated Outputs/rater_study/REPORT.md`) scored every option of scenarios 1-4 from its words
alone. Where all three agreed with each other and sat 20+ points from the study, the number moved to
their average (the researcher's approval, audit Fix 6 Parts A and C):

| Scenario | Option | Value | Was | Now |
|---|---|---|---|---|
| 1 | Leave with the registered convoy | Reducing harm | 61 | 87 |
| 1 | Take the sealed respirator | Reducing harm | 45 | 22 |
| 2 | Take your household's place in the staged convoy | Reducing harm | 59 | 83 |
| 2 | Give your car seats to the two residents with walkers | Reducing harm | 56 | 83 |
| 2 | Leave immediately on the main highway | Protecting the vulnerable / How many are helped | 35 / 30 | 14 / 8 |
| 2 | Leave immediately on the main highway | How much is gained (the researcher's decision, not the raters') | 80 | 95 |
| 4 + 5 | Cut only where a family member can cover | Protecting the vulnerable | 58 | 83 |
| 4 + 5 | Keep the town routes that pay, and drop the rural ones | Reducing harm | 55 | 15 |
| 4 + 5 | Protect full visits for the clients with nobody else | How many are helped | 38 | 60 |

- **Reducing harm now follows the scenario's own line**, which is what participants read ("keeping the
  risk your choice puts on everyone else as low as possible", "making the cut land where someone else can
  step in, so it hurts least"), not the 18 September rule of counting heads. Two numbers that audit raised
  on purpose went back down (the respirator, the rural routes); both comments say so.
- **Both convoys are now built on Reducing harm** (they were built on How much is gained): the APA page's
  list, the confirm-keep question and which value a kept convoy raises follow `optionMainValue`.
- **"Leave immediately" How much is gained 80 -> 95 is the researcher's reading, not the raters'.** Its card
  calls it "the fastest, cheapest way out - for you"; the raters put it just below the ridge road (88 against
  95). At the raters' 14 and 8 alone it lost to the ridge road on every value and fitted nobody; at 95 it is
  scenario 2's gain champion and the best fit for about 1 person in 100. 95 rather than 93: a one-point lead
  read as a tie to the planner.
- **Two accepted exceptions, both written next to the check they relax.** In scenario 2 protecting the
  vulnerable no longer costs performance as clearly (r = 0.38 against the 0.30 line; `G5_R_ACCEPTED` in
  `validate_block5_metrics.mjs`; 25 was the lowest vulnerable number that kept it). And somebody who holds
  only gain still fits the ridge road better than the new gain champion, which does almost nothing on the
  other values (`CHAMPION_MAPPING_ACCEPTED` in `validate_block5.cjs`). Every other option, value and
  scenario is still held to every check; `ACCEPTED_DOMINATED` is empty again.
- **VCI check V3 tests the flip-floppers as a group** (the 2,000 of `report:vci`, mean 33), not one scripted
  person, who lands on exactly 50 whenever none of its picks happens to be strongly misaligned.
- **The position check passes** (2.9x -> 3.3x). VCI and Stability move by 0-4 points for every kind of
  pretend participant; the prediction and the performance of a best-fit pick are about the same.
- **Participants see it**: fit numbers, labels and card order change in scenarios 1, 2, 4 and 5 (the best
  fit changes for about 1 steady pretend participant in 5 or 6; the card order for about 7 in 10 in scenario 2
  and 6 in 10 in scenario 4). Do
  not pool records across this date (HOW_TO_ANALYZE_MY_DATA.md 4.9).
- **Part B, the words (the researcher's approval, B1-B6). Participants see them.** Scenario 2's "How many
  are helped" now reads "how many **more** people get out of the valley because of your choice" (a seat swap
  moves nobody extra out); scenario 3's "Reducing harm" reads "keeping as few patients as possible from
  becoming too sick to treat before next month's supply comes". "Treat the 20 most likely to survive" adds
  "It counts lives, not years…"; "Treat the 20 with the most years ahead" adds that a younger patient with a
  modest chance can come ahead of an older one who would almost surely recover; "Redraw the routes" adds "The
  other 100 still come out of visits" and a money line; "Cut only where a family member can cover" and
  "Protect full visits" each add that none of the money-losing driving is saved (scenario 5's copies too).
  Every changed option's two reflection views and two stakeholder stories were re-read against the new
  words; the lens, story, APA and MCF checks pass. No number moved with the words.
- **"Most ill today" is not "running out of time" (C1-C5, same evening, the researcher's approval).** In
  scenario 3 the two ideas had read as one ("sickest" = "cannot wait"). Now "Protecting the vulnerable" means
  "treating first the patients who are most ill right now, or hardest to reach"; "Treat the 20 who are
  sickest" adds "Being the most ill today is not the same as running out of time. Some of the 20 could have
  waited a month, and some who wait are less ill today but will be past treating by then."; the draw's 45 are
  "the ones whose cancer is moving fastest, whether or not they are the most ill today"; the draw's own
  reflection now says "extra slips for the most vulnerable" as its card does (it said "for the sickest"); and
  the years rule's long new sentence is split in two. Read side by side with both cards' reflections and
  stories: no contradiction (each new sentence says "some"; the stories already describe one patient of
  each kind).
- **Still open**: the scenario-3 draw (#8) stays 56 (the researcher's choice), now with words that say why it
  is not the "most ill" option. Scenarios 2-4 are being re-rated by the same three raters
  on the new words (round 2, `Generated Outputs/rater_study/round2`); #12 and #13 (scenario 4, Reducing harm
  of "Redraw the routes" and "Keep every care visit") wait for them. Plan: docs/FRESH_EYE_AUDIT.md, "Fix 6 plan".

## Rater round 2 numbers (Fix 7), since 26 September 2026

The same three blind raters re-read scenarios 2-4 on the new words and, for the first time, scored the five
PERFORMANCE numbers of every option in scenarios 1-4 (`Generated Outputs/rater_study/round2/`). Where they
agreed with each other and sat 20+ points away, the number moved to their average, unless that made an option
lose on every value or broke a design check (the researcher's approval, audit Fix 7). Every number carries a
"VALUE AUDIT, fifth pass" or "METRIC AUDIT" comment quoting its card and the raters; scenario 5's copies move
with scenario 4.

- **Values (8):** Redraw the routes harm 47 -> 76 and helped 84 -> 81; Keep every care visit harm 70 -> 43 and
  helped 80 -> 88 (the four move together, or Keep every care visit loses on every value); Treat the 20 most
  likely to survive harm 48 -> 23 and gain 39 -> 79 (together; harm alone broke the position check); Treat the 20
  with the most years ahead helped 43 -> 64; Keep the town routes that pay helped 45 -> 25.
- **Performance (14, 15 with scenario 5's copy):** S1 shuttle speed 45 -> 24 and reliability 71 -> 38; S1 sealed
  respirator resources 45 -> 18, reliability 54 -> 87, durability 76 -> 17 (together, or G5 fails); S1 carry the
  respirator reversibility 78 -> 62 (half way to the raters' 47; further breaks G6 and G7); S1 service road
  reversibility 45 -> 20 (its card: "there is no turning around", so it must be the least reversible option; 20,
  not the raters' 8, keeps G6 and G7); S2 give your car seats resources 80 -> 58; S2 ridge road durability 70 -> 23;
  S3 survival speed 48 -> 69; S3 years speed 24 -> 61 and reliability 45 -> 73; S3 essential workers durability
  44 -> 72 (now scenario 3's top performer); S4 cut only where family covers speed 40 -> 74.
- **Kept as stated disagreements:** Shorten every visit helped 92 (raters 72; at 82 or lower it loses on every
  value); Hold some doses back harm 64 (raters split).
- **VCI check V8 now tests the group** of 2,000 pretend flip-floppers through APA (mean 34), like V3.
- **Measured:** the position check 3.3x -> 5.4x; VCI and Stability move 0-3 points for every kind of pretend
  participant; the end-of-study performance (`performanceCaptured`) moves 0-6 points and the performance chaser
  still scores 100. G3 (a metric restating a value) is now 0.78 against its 0.85 limit, G4 (two metrics alike)
  -0.65 against 0.70, and reversibility's grand mean 50.4 against the 50 floor: all pass, closer to the lines.
- **Participants see it:** fit numbers, labels and card order in scenarios 3-5, and the performance bars and the
  cards' performance chips ("Fastest", "Hardest to undo", ...) in all four decisions. The chips are computed from
  the numbers, so they always match them; six best or worst places still went to a different option than the
  raters read (listed in docs/FRESH_EYE_AUDIT.md, Fix 7 "What was done"); Fix 7b below moved two of them. Do not
  pool records across this date.

## Two reliability numbers (Fix 7b), since 26 September 2026

After Fix 7, the three raters agreed (spread under 30) that two options were the LEAST reliable in their scenario,
but the numbers gave that place to another option. Both moved to the raters' average (the researcher's approval,
audit Fix 7b); each carries a "METRIC AUDIT ... audit Fix 7b" comment in block5Scenarios.ts.

- **S1 Seal your apartment, reliability 40 -> 23** (raters 40 / 18 / 12). Reliability there is "how likely you
  are to get clear without the route failing", and this option does not get clear at all. The shuttle (38) had held
  the last place.
- **S3 Treat the 20 who are sickest, reliability 35 -> 26** (raters 40 / 20 / 18). Its card says "they respond
  slowly and some will not recover". Hold some doses back (30) had held the last place. The sickest rule, scenario
  3's vulnerable champion, is now also its weakest performer.
- **One scripted test corrected, not loosened.** The "gives up both" person in `simulate_position.cjs` now takes
  the weakest performer among the options that are NOT the closest to its values, which is what its comment always
  said. With the sickest at 26, the old code picked this person's own best fit in scenario 3, so the person no
  longer gave up values and the line tested nothing. Result: 26 / 6, PASS.
- **Measured:** VCI, Stability, the prediction check and the planner overlap unchanged (0 lines differ); the card
  order cannot change (the planner reads performance numbers only for the chips); position 5.4x. End-of-study
  performance (`performanceCaptured`): every kind of pretend participant's average moves 0.5 points or less, one
  person at most 4 (scenario 3's worst performer changed, and that rescales the scenario); the chaser still 100.
  G3 0.77 (limit 0.85), reliability's grand mean 57.6.
- **Participants see it:** "Performance Nth of 6" on four cards (S1: the sealed respirator 5th -> 4th, Seal 4th ->
  5th; S3: the sickest 5th -> 6th, Hold some doses back 6th -> 5th); the shuttle's third chip "Least reliable" is now
  "Resources spared 5th of 6"; the reliability bars of the two options. Checked on screen for scenario 1.
- **Why no card said "Least reliable" in S1 or S3 after this fix** (answered the same night by Fix 7c below: both cards now say it). A card shows its two best places and ONE worst, and when
  two measures tie for last, `buildPerfChips` (block5Planner.ts) shows the one later in the alphabet. Seal is also
  the slowest, so it shows "Slowest" (the raters agree: last on both). The sickest shows "Hardest to undo", itself a
  30-30 tie with the years rule broken by id (the raters put it 3rd).
- **Against the raters now:** of the 40 best and worst places (5 measures x best/worst x scenarios 1-4), 27 go to
  the option the raters picked (25 before), 9 are near-ties (under 10 points), 4 are clear disagreements left: S1
  "Longest-lasting", S2 "Slowest", S3 "Heaviest on resources", S3 "Shortest-lived" (split readings, or G6 blocks
  the move). Of the 72 chips the cards show in scenarios 1-4, 39 sit at the raters' place (38 before), 26 one place
  off, 7 two or more places off.

## Which chip a card shows when two measures tie (Fix 7c), since 26 September 2026

A card's "How it performs" row shows three chips: the option's two best places and its one worst place, out of
five measures. An option often holds the same place on two measures (23 of the 30 cards in scenarios 1-5 have
such a tie at the edge of what they show), and until this date the ALPHABET of the measure's code name chose
which one appeared. Now `buildPerfChips` (block5Planner.ts) shows the measure where the option stands furthest
from the scenario's average: furthest above it for the two best chips, furthest below it for the worst (the
researcher's approval, audit Fix 7c). Example: Seal your apartment is last on speed (18, 30 below the average)
and on reliability (23, 36 below), so it now says "Least reliable" instead of "Slowest".

- **Participants see it:** one chip changes on 12 cards (S1 the convoy and Seal; S2 Leave immediately; S3 the
  survival rule, the sickest and the essential workers; S4 and S5 Keep every care visit, Cut only where family
  covers, Protect full visits), and 4 cards swap the order of their two best chips. HOW_TO_ANALYZE 4.9 has the row.
- **Nothing else moves:** the places are the same, the distance is never shown, and chips are never scored or
  saved, so no score, card order or database field changes. Tested on a compiled scratch copy first: all 14 check
  scripts gave the same output apart from the chip lines. No version stamp: `PLANNER_VERSION` is for the ORDER
  (unchanged) and `SHAPE_VERSION` re-sends saved sections (none changed); the date in 4.9 marks the screen change.
- **`tools/test_planner.cjs` section 7** writes the rule again independently and holds every card to it, for two
  different participants; it fails on the code as it was before (4 failures), so it tests the rule.
- **Equal numbers (Part 2, the researcher's choice B):** two OPTIONS with the same number still get places by
  code name. It happens once (scenario 3, the sickest and the years rule, both 30 on reversibility; only their
  details bars show "6th of 6" and "5th of 6"). Kept and written down; new check **G8** in
  `validate_block5_metrics.mjs` stops the build if a later number change creates another pair
  (`EQUAL_NUMBERS_ACCEPTED` holds the one accepted pair and its reason).
- The card's comment said the row had "five chips"; it has three, and now says so.

## Stability says whether it measured anything (audit G5), since 26 September 2026

Stability counts swaps only at the conflict steps (a decider scenario where the final choice went against the
best fit and the reflection ran). Somebody who never meets one scores 100 with nothing counted, so a 100 could
mean "held when tested" or "never tested". Two fields now say which, beside the score (the researcher's
approval): `headline.stability_was_measured` (true / false / null) and `headline.stability_conflict_steps_counted`,
copied into `major_info_and_scores.stability` as `was_measured` and `conflict_steps_counted` with a sentence on
how to read them.

- **A copy, not a new calculation.** Both come from `stabilityDetail.conflictSteps`, saved on every finished Block 5
  since 8 September 2026 (`stabilityConflictStepsOf` in dbShape.ts). `computeStability` is untouched. Proved on the
  full simulated record (`validate:dbshape --dump`, old code against new): only the six new or extended fields
  differ; every existing number, `stability_score` included, is the same. null = no stored detail (never false).
- **How common "not measured" is** (`npm run report:stability`, new columns): every best-fit and second-best
  picker, 38 in 100 people true to their top value, 26 in 100 performance chasers, about 1 in 100 random
  responders. Filter on `stability_was_measured` before averaging Stability, or report the groups apart.
- **Gate D62** (`validate:dbshape`): the flag follows the stored steps for every pretend participant and for one
  built to never meet a reflection (Stability 100, measured false); the score is untouched; a record without the
  detail reads null. `SHAPE_VERSION` moved to "2026-09-26-stability-was-measured" so records already synced get
  the new fields on their next sync.
- **Not changed, stated:** Stability still sets half of scenario 6's prediction confidence, so a never-tested 100
  raises it too. Changing that would change the prediction (and `PREDICTION_VERSION`); it is an open item in the
  audit, not part of this fix. Nothing on screen changed.

## Three limits written down: the top-two gap, four moving scenarios, the position headline (audit C7, B7, P2), 26 September 2026

The researcher's approval ("you can do also (B7, P2, C7 ...)"). Nothing participants see changed, and no score.

- **C7, the safe part.** The planner orders every scenario by one ranking of the four values and counts a 1-point
  lead like a 50-point one. `analysis.card_order_by_scenario.how_close_the_top_two_values_were` now saves the gap
  between #1 and #2 (read from `originalProfile`, so every record has it; `topTwoValueGap` in dbShape.ts; gate D63).
  About 16 in 100 steady pretend participants are within 5 points. HOW_TO_ANALYZE 4.7 says how ties are broken
  (a coin from the participant's own answers; near-ties count in full) and asks for a cut-off fixed in advance.
  The order rule is unchanged; counting both orders when close is a separate decision.
  `SHAPE_VERSION` "2026-09-26-top-two-value-gap".
- **B7.** Only scenarios 1-4 can move the profile, so movement and Stability rest on at most four steps per
  person: describe them for groups (HOW_TO_ANALYZE 4.8 and section 8).
- **P2, accepted.** The five-scenario position number is 100 for a real role-switcher and for a random chooser
  alike; the check that would separate them needs a role met twice, which this deck does not have (the 3 skips in
  `validate:position`). Report it as description, beside VCI, and lead with the scenario 4/5 pair (4.4, section 8).

## The step sizes tested, and one page of major scores (audit B3), 26 September 2026

The researcher's approval ("you can do also (... B3)", "create an MD file for Major Scores user's behavior
distribution after today's fixes and update this table when we update anything"). Nothing participants see changed,
and no score: these are reports.

- **B3, the hand-picked steps** (+30/-20, +15/-10, +30/-10, +20/-15, +/-25): `npm run report:step-sensitivity` runs
  the twelve kinds of pretend participant eleven times - as shipped, every step at half and double size, and each
  family alone at half and double. Safety first: at the shipped sizes it reproduces `report:vci` for all 24,000
  pretend people, and every family of steps is used. **Every conclusion the method documents state holds at every
  size** (VCI and Stability separate followers of their top value from random choosers, the order of the kinds, keep
  steps never cost Stability, following your values costs performance). With every step halved, Stability's
  separation of top-value followers from random choosers sits exactly on the 0.75 line. **What does depend on the
  steps:** Stability's absolute level (random choosers 57 as shipped, 77 at half, 36 at double), so report Stability
  as group comparisons and never one person's level word; and the one-time convert (audit G6), whose VCI moves up to 12 points and Stability up to 9 with
  the kept-misaligned step. For the other kinds VCI moves 1-3 points; performance 2 at most; the position effect and the card order not at all (they read the profile brought
  into Block 5; `simulate_position` gives identical output at x0.5 and x2). Write-up with every table:
  docs/BLOCK5_STEP_SIZE_SENSITIVITY.md. Freeze the steps before real data.
- **docs/MAJOR_SCORES_DISTRIBUTION.md** is GENERATED by `npm run report:major-scores` (tools/report_major_scores.cjs):
  every major score for every kind of pretend participant, the separations, the card-order overlap, the position
  ratios and the prediction calibration, stamped with the code version. Never edit it by hand. `tools/behavior_sim.cjs`
  is the one simulated path it shares with the B3 report.

## No "Has a cost" tag on costed cards, since 24 September 2026

The "Has a cost" tag and the divider "These cost you something on the value you ranked first" no
longer show on costed cards (commit 60db800). The bin is still computed, still sorts the cards and is
still stored. **Participants see this change**: records before 24 September 2026 saw both, so do not
pool costed-card choices across that date. All the dated screen changes are listed in
HOW_TO_ANALYZE_MY_DATA.md, section 4.9.

## Option cards start folded, since 23 September 2026

A scenario opens as a list of six titles in planner order, each with its rank, and the participant
opens the ones they want to read. **This is a real change to what the study shows people.** A card
never opened is a card never read, which is a different thing from an open card scrolled past, and
any comparison with data collected before that date has to account for it.

Unfolding is deliberately **not** logged: `optionExpands` counts opening a card's DETAILS, which is
information-seeking, and unfolding is now simply how a card is read at all. The state stores which
cards have been OPENED rather than which are folded, so folded is the natural default in every
scenario. Section 2 of the pre-Block-5 page teaches it, with an invented example — a sandbag truck
on a flooded road appears nowhere in the block, because an option from a real scenario would put a
decision in front of somebody before their first situation.

## `major_info_and_scores`, since 23 September 2026

One room holding the twelve things most often asked of a participant record: the three VCIs,
stability with its three sensitivities, performance, the position effect per scenario and per role,
a prediction row per scenario, total time, visits, what was chosen in each scenario with its
alignment label and the counts, the three profiles, and the feedback. Since 24 September 2026 a
thirteenth, `blocks_1_to_4`: how Blocks 1-4 were answered (`said_yes_at_the_first_step_everywhere`,
`answered_very_fast` at a stated 2-second median, the values not measured, the ties a coin decided),
copied from `analysis.blocks_1_to_4_checks` by the same builder and checked by gate D52. It changes
no score.

**Everything in it is a copy.** Each line is lifted from the section that owns it by calling that
section's own builder, `where_each_number_lives` names the original for every line, and gate D49
checks the copy against its sources on every build. The name is snake_case because the server
refuses any path that is not — a field with spaces would be rejected with a 400.

## Blocks 1-4 scoring, revised 24 September 2026

The questions and the screens of Blocks 1-4 are unchanged; only the arithmetic that turns the
answers into the seven value scores has changed, one rule at a time, each approved by the
researcher and each stamped with a new `calibrationVersion`
(`analysis.participant_record.calibrationVersion`). Never pool records made under two versions.
Full list: `Generated Outputs/HOW_TO_READ_MY_DATABASE.md` section 6h. `npm run validate:profile`
stands over every rule. Background and evidence: `docs/FRESH_EYE_AUDIT.md`, group E.

- **Every value can reach 100** (`null-cdf-2026-08-23-top100`). Each calibrated value is divided by
  its own ceiling, so helped, directness, context and stakeholder are no longer capped at 93-99.
- **Ties are decided by a coin** (`…-fair-ties`). Before, a stable sort always put vulnerability first.
  The coin is a hash of the participant's own answers — deliberately NOT the session id, which can
  differ between computers and would change the card order mid-study. Every tie is recorded on the
  tree (`tiedValues`, `tiedWith`). During Block 5, `recompute()` in `block5CVR.ts` still breaks new
  ties by array order, which is now the participant's own pre-Block-5 rank order, not code order.
- **A refusal is not a zero** (`…-refusals`). A comparison whose two answers are both "never" is
  dropped instead of scoring a difference of 0; a value with nothing measured scores the neutral 50
  (`NOT_MEASURED_SCORE`) and is flagged `measured: false` on the tree and `notMeasured: true` on the
  Block 5 profile. Applies to vulnerability and group size, the two policy values built from
  differences; gain and helped are levels, where a refusal is a real 0. Directness and context have
  the same issue and were NOT changed (not approved yet). The calibration tables were deliberately
  kept; the evidence is in the note under `SENSITIVITY_CALIBRATION_VERSION`.
- **Half a step gets half the credit** (`…-halfstep`). On group size, a half-step slope scores half of
  the one-step score (32, not 55); one step or more is unchanged. Before, one click in one cell made
  "reducing harm" jump to 55 and often become the #1 value. Gates H1-H2.
- **Directness and context: "never" is flagged, the score stays 0** (`…-dc`). Never pulling and never
  pushing, or never keeping the money anywhere, gives `measured: false` — but a score of **0**, not 50
  (researcher's choice, for analysis clarity; `notMeasuredScore` in thresholdTree.ts). `chooseFraming`
  now breaks a context/directness tie by the participant's own rank order (the coin) instead of
  `context >=`. Gates L1-L5.
- **Tables rebuilt by a committed recipe** (`null-cdf-2026-09-24-recipe`). The 23 August recipe was
  never saved. `tools/regenerate_sensitivity_calibration.cjs` (`npm run calibration:regenerate`) now
  writes `src/experiment/sensitivityCalibrationTables.ts` — GENERATED, never edit by hand — from
  200,000 pretend participants with every answer and button equally likely. `npm run
  calibration:check` (gate K1) fails if a formula changes without its ruler: after ANY change to a
  raw formula in `thresholdTree.ts`, run `calibration:regenerate` and commit both files together.
- **Donation signal is a share, not one click** (`null-cdf-2026-09-24-recipe-donation-share`). Block 1's
  `block1DonationSignal` (profileAnalysis.ts; read only by thresholdTree.ts) is the share of refusals
  that were donations — shelter in full, elsewhere at half — instead of 1 for any single click. With
  equal buttons, random pressing had earned the full signal two times in three. Gates D1-D2.
- **Response-style flags** (no score change): `analysis.blocks_1_to_4_checks`, copied into
  `major_info_and_scores.blocks_1_to_4`. `FAST_ANSWER_SECONDS` (2) in `dbShape.ts` is a stated
  default; the medians are stored so another line can be drawn later.

## The two development-only controls

Both live in `src/components/dev/` and both disappear from a production build because
`import.meta.env.DEV` becomes the literal `false`, which makes the whole control unreachable and
drops it from the bundle:

- **DevResetButton** — wipes every answer and restarts at Block 1.
- **DevFillFeedbackButton** — answers every feedback question the page is currently asking, so a
  run can be finished without refilling the form. It fills from the page's own `requiredCodes`, so
  it cannot drift from what is on screen, and it does not submit.

To remove both before launch: delete `src/components/dev/`, the two imports and the two lines that
render them (`src/App.tsx` and `src/experiment/UserFeedbackPage.tsx`). Checked after every build:
"Fill feedback" appears zero times in `dist/`.

## Every check, and what each one stands over

```
npm run typecheck && npm run lint && npm run validate:block5 && npm run build
```

| Command | What it guards |
|---|---|
| `validate:block5` | The scoring model end to end. Runs the chain below and must print `ALL TESTS PASS`, `ALL APA CHECKS PASS`, `ALL PROFILE GATES PASSED` and `ALL DATABASE GATES PASSED` |
| `validate:dbshape` | What reaches MongoDB. 70 gates, including the position rows and the prediction rows recomputed by hand (D45–D48), the gathered copy (D49), the stored MCF (D50), the per-scenario profile (D51), the Blocks 1-4 checks (D52), the readable card order (D53), the two fit scales kept apart (D54), every value move (D55), the saved shortfall (D56), performance over the decisions only (D57), what the wish changed in values (D58) and in performance (D59), the company value shown (D60), the company stance (D61), whether Stability measured anything (D62), how close the top two values were (D63) and whether an MCF reading could be opened in that scenario (D64, false in scenario 6), VCI_all with its running fits, saved against rebuilt and recomputed by hand (D65), which button took them from the results page to the feedback (D66), and Stability_all with the top-value choices, recounted by hand (D67), and the profile after every scenario tracked like VCI_all, in one place (D68, since 30 September 2026), and Stability's two parts recounted by hand (D69, since 2 October 2026), and only the six real parts called rushed (D70, since 7 October 2026). `--dump` writes a full simulated document |
| `validate:vciall` | VCI_all and the hidden running values (since 28 September 2026): the keep rule unchanged by the refactor (A1), the running rule (A2), running values = the study's through scenario 4 (A3), no choice judged on its own move (A4), blind 50 (A5), derived level edges (A6), a value-follower scores 100 (A7), decisions' running fit = the study's fit and the wish and veil move only the running values (A8); since 29 September 2026 Stability_all: its decisions' part equals Stability's swaps (A9), which steps count (A10), a best-fit picker 100 and not measured, the kinds in order (A11), the top-value choices recounted by hand (A12); since 2 October 2026 Stability_all's difference part recounted by hand (A13). Prints the echo and the screen-against-yardstick shares, and Stability / Stability_all / top-value choices by kind |
| `validate:journey` | The charts page's numbers (since 28 September 2026): consistency points = VCI_all's parts and average to it (J1), the fallback for old runs (J2), the veil row by the final rule and the study's distance (J3), the guess card (J4), reconsidering with scenario 6 split (J5), the deck's five positions (J6), Block 4 (J7), and from the source: every card reads all six, no Finish button, a finished participant opens on the thank-you screen (J8); the way on to the feedback: "1 step left" instead of "Complete", the card under the score boxes, the bar on the results page (the charts page, now after the feedback, has no way to it), every button recorded, an honest gift-card line, no leave warning, Feedback "next" in the progress bar and the rail sliding to it on a phone (J9); the MPF card: the database's own numbers, the gap, a first choice only when it changed, scenario 6 as shown, the favourite = the best fit, and scenario 6 a slate bar apart from the positions (J10); since 30 September 2026 the value line moves in scenarios 5 and 6 on the running values, with one shared "after" for the line, the radar and the results page (J13); the results page's three score families in order and in their colors, each "all six" beside its "four decisions", the "not tested" notes, and the top-value choices on no page (J11); since 29 September 2026 the charts after the feedback: none on the results page, the thank-you page's five tabs after the feedback is sent, every chart card in exactly one tab, and plain words on the results page (J12); since 4 October 2026 the results page explains itself: the scores taught, the 4-decisions / 6-scenarios box, traffic-light level badges on level bars built from the code's own levels, no random mark (J15); an ⓘ beside every level badge opening its own level ladder (J16); since 3 October 2026 the first page's study name and welcome, and the performance panel's title row on a phone (J14); since 7 October 2026 the progress bar on the thank-you page says "Done" (J17) |
| `validate:session` | Continue where you left off, and one place at a time (since 29 September 2026): the server's one-browser rule (C1), every write route asks it and the claim checks the age (C2), Block 5's progress comes back exactly with the same fit numbers (C3) and only for its owner and profile (C4), a failed save waits and is sent once, in order, even with saves arriving as the queue drains (C5), a 409 from another browser locks the page and sets the queue aside (C6), the tab rule and the progress sends (C7), and from the source: Blocks 2, 3 and 5 save and restore with an owner, the claim comes first, the lock screen before any page (C8); since 30 September 2026 a pause after a block is saved as the part it leads to, so a refresh there never restarts the finished block (C10), and the country question: the list, the ranking, the bold part, and the country kept through a resume (C9); since 4 October 2026 "Is English your first language?" (Yes / No, required, kept through a resume) and the country asked as "Where are you from?" (C11); since 6 October 2026 the server check (once in development, live again and again), a server that answers late getting the participant's record first, the queue that no longer leaves a save for the 15-second retry, and the 10 s / 5 s waiting limits (C12); the two doors: the address, the Prolific ID never an email (page and server agree), sent as prolificPid and stored as prolific_pid, every save to the owner it was made for, another person's run set aside, the Prolific first page and the four-question page, the database rules swapped safely (C13); "Not you?" on a shared computer (C14); since 7 October 2026 privacy: the lookup gives only the status, the claim checks the age before it hands back the details and the run, no write without the browser's id, no cross-site access, the age never compared on the page (C15); the Prolific completion code: only for a finished Prolific record to the browser holding it, from .env only, never in the page's code, a button and never a jump, after the age on another device (C16) |
| `validate:attention` | The attention checks and the two deleted between-block pages (since 29 September 2026): the two topic questions in the researcher's approved words with each answer order about equally over 4,000 pretend participants, the scenario check after scenario 3, the feedback number only two to five and never among CVR/APA (T1); drawn once, saved, per participant (T2); right means exactly what was asked (T3); the gift card needs all three, each miss with a reason, the check's screen never a rushed block, the major copy (T4); the feedback row never in the feedback record (T5); the two pattern flags, not for pay (T6); chance 1 in 112 (T7); the screens and the consent page from the source (T8); the deleted pages' files made exactly as the pages made them for 300 pretend participants (P1) and still written, sent and carried (P2); since 7 October 2026 the Prolific door's two number rows, one per section, two different numbers, the university plan drawn exactly as before, failing both the flag (T9), and the consent page of each door (T10) |
| `validate:conditions` | The four conditions and the landing page (since 1 October 2026): one list on the page and the server (N1), the fewest wins and ties are fair (N2), who counts - finished, working 2 h, arrived 30 min; drop-outs, tests by address and offline runs never (N3), 40 arrivals at once give 10 each (N4), the same arrival gets the same answer (N5), the server sets the condition once and links the arrival (N6), every spelling of the address and the rest of it kept (N7), the browser file, the first condition kept, the arrival id sent once (N8), the flow from the source: landing first, never saved, the two demographic fields, a return keeps its own (N9), and the copy in major_info_and_scores (N10); since the same day condition 2's CVR Rejection page: its automatic moves (N11), the page and the flow from the source, APA unchanged for the others (N12), and its database rows (N13); condition 3's straight-to-APA flow: its rules (N14), the flow and the page from the source (N15), and the database (N16); condition 4's confirmation page: its rule (N17), the flow and the page from the source (N18), and the database and the feedback (N19); the four-condition audit of 2 October 2026 (N20); since 3 October 2026 Baseline's cards without the fit line and the ranking reasons, and one confirmation page with "How sure" for every choice (N21); since 6 October 2026 many people at once: a burst served from one reading in turns, person by person equal to one at a time (N22), the landing page asking four times with one arrival id and never picking at random on the live site (N23), every person counted once while their record is being made (N24), and each door balanced on its own (N25); since 7 October 2026 somebody who already finished gives back the condition their browser was just given (N26), and APA_Only's box saying the option still gives less on the value it serves most exactly when it does (N27), and the APA list heading "These options are built on X", always true (N28) |
| `test:load` | Many people at once, on the REAL server (since 6 October 2026; not in the chain: needs MongoDB on this computer). Starts `server/index.js` itself on port 4100 against a throw-away `vrds_load_test_<time>` database (always deleted), sends 100, 100 and 200 pretend people in the same instant and checks no request refused (L1), everybody saved with their own session id and every save landed (L2), the conditions exactly even in every burst (L3), nobody waited 3 s for a condition (L4), and since the two doors 100 students and 100 Prolific people at once, 25 per condition inside each door with every Prolific record under prolific_pid and no email (L5), and the database rule swap on a copy with today's rule (L6), and since 7 October 2026 privacy on the real server: the lookup gives only the status, a wrong age is refused, the right age brings no analysis, the create route answers "ok", a write without the browser's id is refused, no cross-site header (L7), and the Prolific completion code with a made-up code: not before the completion, only to the holding browser, never for a university key or in another answer, never stored (L8). Run after any change to the server or the landing page |
| `validate:pay` | The daily Prolific pay check (since 7 October 2026; `tools/pay_check.cjs`, run as `npm run pay:check`): every group with a pretend person each (Y1), exceptionally fast recounted by hand (Y2), the two files in every shape they come in (Y3), no email and no code in the output (Y4), the command end to end (Y5) |
| `validate:twins` | Scenarios 4 and 5 are the same six options, and scenario 5 is only a wish: performance counts the decisions only, scenario 5 is shown on scenario 4's opening values, the same wish gives 0, a different one reads as the options' difference, in values and in performance (W1-W5) |
| `validate:visits` | Working time and visits: one sitting, a 31-minute break, a reload after lunch, a second participant at the same machine, the same participant on a second machine |
| `validate:resume` | Carrying a run to another computer. Replays the run that sent a finished participant back to Block 1 |
| `validate:mcf` | The Moral Commitment Function: the decomposition, the swaps, and every sentence and tag it can produce (M1-M7); since 27 September 2026 also that every size word matches its gap (M8), the "because you hold it more strongly" reason is said exactly when it should be and is true (M9), every reading names all four values once in the participant's order (M10), and scenario 6 renders neither the MCF nor "Your values in this scenario" (M11; since 29 September 2026 nor the Compare overlay's performance chart) |
| `validate:profile` | The Blocks 1-4 scoring that feeds Block 5 (`thresholdTree.ts`, `sensitivityCalibration.ts`). Until 24 September 2026 no check ran it at all |
| `calibration:regenerate` / `calibration:check` | The recipe for the common ruler's tables. Regenerate after any raw-formula change; the check (also gate K1) fails if the tables and the formulas disagree |
| `validate:position` | The position effect: a choice must move the fit number at least 3× more than the menu does. **Passes since 26 September 2026** (3.3× after Fix 6, 5.4× after Fix 7); it failed on purpose before (2.9×), which is why it still runs LAST in the chain |
| `report:major-scores` | Writes docs/MAJOR_SCORES_DISTRIBUTION.md and, since 1 October 2026, docs/MAJOR_SCORES_BY_CONDITION.md (the same pretend people in all four conditions, rules in `tools/condition_sim.cjs`, page in `tools/report_conditions_page.cjs`; it stops if condition 1 does not reproduce the main page person by person). The main page: VCI, VCI_all (section 1b, since 28 September 2026), Stability (with "not measured"), Stability_all and the top-value choices (sections 2b and 2c, since 29 September 2026), end-of-study performance and the separations for all twelve kinds of pretend participant, plus the card-order overlap, the position ratios and the prediction calibration, stamped with the code version. **Run it after every change** (since 26 September 2026) |
| `report:step-sensitivity` | Audit B3: every value step at half and double size, all together and one family at a time, through the real code (`tools/step_scale_hook.cjs` scales `bump()`; the source is not touched). Every conclusion holds; Stability's absolute level does not (random choosers 36-77; the APA cap scales with the APA steps since 27 September 2026). Write-up: docs/BLOCK5_STEP_SIZE_SENSITIVITY.md |
| `report:planner` | Planner against a weighting planner, on MADE-UP value scores — understates the overlap; use `report:planner-overlap` for the real figure |
| `report:planner-overlap` | How often the first card is also the best-fit card, with pretend participants answering Blocks 1-4 (real code end to end): 50-62 in 100 steady, 41-52 random, chance about 17 (26 September 2026, after Fix 7). Since 26 September 2026 also how close each person's #1 and #2 values are (16 in 100 steady within 5 points; audit C7) |
| `export_block5_content.cjs` / `make_block5_content_docx.py` | Writes every scenario, option, lens and stakeholder story as JSON (since 27 September 2026 also each option's five performance numbers with their places, the overall place and the card's chips, and each scenario's value and measure meanings), and builds `docs/Block5_All_Options_and_Reflections.docx` from it: `node tools/export_block5_content.cjs x.json` then `python tools/make_block5_content_docx.py x.json docs/Block5_All_Options_and_Reflections.docx`. Rebuild after any change to an option's words or numbers |
| `make_accuracy_checklist_docx.py` | Builds `docs/VRDS_Accuracy_Checklist.docx` (since 29 September 2026, for the researcher and Claude): what is accurate now, each item with the check that stands over it, what is still open, and the limits to state. It RUNS every check first (about five minutes) and ticks each row from that run, stamped with the date and commit; a failed check turns its rows red. When something is fixed or opened, update its lists (`SECTIONS`, `OPEN`, `LIMITS`) and rebuild: `python tools/make_accuracy_checklist_docx.py docs/VRDS_Accuracy_Checklist.docx` |
| `make_feedback_questions_docx.py` | Builds `docs/VRDS_Experiment2_Feedback_Questions.docx` (every feedback question, word for word, with a column for comments) straight from `src/experiment/feedbackTypes.ts`; it stops if a question list changes size, so a new question cannot be left out silently |
| `build_rater_sheet.cjs` / `build_rater_room.cjs` / `compare_ratings.cjs` | The blind option-value review (audit Fix 3 Step B, 26 September 2026): shuffled sheets and answer keys in `Generated Outputs/rater_study`, one rater folder per model OUTSIDE this project (a rater run here would read this file, which quotes option numbers), and the comparison with the study's numbers. Round 2 (only the scenarios whose words changed): `--scenarios 2,3,4 --round 2`, `--study <dir> --raters opus,sonnet,haiku`. Round 2 also rates the five PERFORMANCE numbers of every option in scenarios 1-4 (the researcher's request): `--measures` on the sheet builder and on the comparison (REPORT_MEASURES.md), a second no-tools rater in each folder |

## Two files that carry rules rather than code

- **`src/experiment/storage.ts`** — the only module allowed to talk to the server. Everything is
  written to the browser first and sent afterwards, so a stopped API never costs a participant
  their session. Do not add a second path to the server.
- **`src/experiment/dbShape.ts`** — the only place where the study's internal names are translated
  into database names. If a field name in MongoDB looks wrong, it is defined here and nowhere else.
  It also builds every `analysis.*` section, which means it runs real arithmetic; `npm run
  validate:dbshape` is what stands over that.

## Things that are deliberate, not oversights

- **The position simulation (`simulate_position`, the 3x ratio) failed on purpose from 18 to 26
  September 2026.** The researcher had the options redesigned to make sense first, and the
  calculations were rebuilt on them one at a time. It passes since the Fix 6 option numbers (3.3x; 5.4x after Fix 7):
  those numbers moved because blind raters read the cards that way, not to pass the check. Never move
  an option's content or numbers to make a check pass — see
  `docs/BLOCK5_SCENARIO_AUDIT_CHECKLIST.md`, section 2g.
- **A final choice reached through APA is judged on the profile the participant brought into the
  scenario**, exactly like a choice kept after the CVR (since 18 September 2026). Neither path
  re-labels the choice inside its own scenario; both move the profile for the next one. Relabeling
  on the clarified profile would let a participant who changes value every scenario score 56 instead
  of 31. Gate V8 in `simulate_vci.cjs` guards it; ties in fit are broken by `policyDelivery`, never
  by id (V9).
- **VCI's label weights are derived, not chosen (since 19 September 2026).** Each label carries the
  average place score of the places it covers, `b(r) = (n − r) / (n − 1)`: on six options 1.00 /
  0.80 / 0.50 / 0.10, so blind picking is exactly 50 (a responder who also answers the reflection
  pages at random averages 56-57, because the APA page lists only options built on the value they
  name). The six levels (Highly Consistent, Mostly
  Consistent, Moderate, Low, Very Low, Highly Inconsistent) sit at 90 / 80 / 65 / 50 / 30, computed
  from the same weights. Do not hand-tune either; gates V10–V12 check both. Method:
  `docs/BLOCK5_VCI_METHOD.md`; figures: `npm run report:vci`.
- **Stability counts swaps, not distance (since 19 September 2026).** It is the four policy values
  only: at each conflict step (a decider scenario where the CVR ran) it counts the pairs of values
  that traded places, a tie opening or closing as half, and Stability = 100 × (1 − min(1,
  swaps / 6)). Keep steps never count — they are the model refining its estimate. Directness,
  context and stakeholder each have their own stability (distance on their 0–100 scale, the full
  scale = 0). Do not reintroduce a churn ceiling. Method: `docs/BLOCK5_STABILITY_METHOD.md`;
  figures: `npm run report:stability`; gates S1–S11. **Since 2 October 2026 that swap count is the ORDER part, and
  Stability is its average with a DIFFERENCE part** (how far the four values moved at the same steps; see "Stability from
  two parts"): the difference part is not a churn ceiling - it has its own natural scale (points on 0-100) and never
  stands alone, because alone it hides a back-and-forth. Gates S12–S15, D69, A13.
- The "Your values in this scenario" panel is absent from scenario 6 on purpose (the whole panel
  since 27 September 2026; its meanings were already absent): its four options are the four values, and
  the meanings or the participant's four numbers, strongest first, would turn the prediction test into
  "pick your value". The MCF is absent there for the same reason (audit A10, closed).

- Participants are never shown an alignment verdict ("Misaligned with your values") or the scoring
  arithmetic. Both were removed on purpose: telling someone how they scored, or how the scoring
  works, changes how they answer the remaining scenarios. The last place the verdict survived was a
  badge under each option title in the compare-charts overlay, removed on 15 September 2026, so no
  live scenario prints one anywhere. The level is still computed and still stored — it is simply
  never shown while the participant is still choosing.
- Scenario 5 is a wish rather than a decision. It is excluded from consistency, stability, the
  reflection measures and (since 25 September 2026) performance, but included in the position
  effect. See "Scenario 5 is only a wish" above.
- The planner's tree is settled (LEAP's trade-off tree, reviewed with the advisor) and its card order
  is not to be "fixed" without the researcher. What it does in practice is MEASURED
  (`npm run report:planner-overlap`): card 1 is the option best on the participant's #1 value for
  72-100 people in 100, and is ALSO their best-fit card for 50-62 in 100 who answer steadily (41-52
  at random; chance about 17; re-measured 26 September 2026, after Fix 7). The researcher's decision (24 September 2026): accept it, state it,
  and analyse position and fit together (HOW_TO_ANALYZE_MY_DATA.md 4.7).
- **Scenario 6 is a test of the model, not of the participant.** It runs four options rather than
  six, shows no performance numbers, runs no reflection, and must never update the profile. If it
  ever did, it would add swaps to Stability that no decision of the participant's produced.
  `decisionRole: "predicted"` is what keeps it out; do not remove it.
- **The scenario-6 prediction is shown AFTER the choice.** Moving it earlier destroys the only
  measurement the scenario exists for, because a choice made after seeing a guess cannot be told
  from a choice suggested by it.
- **`PREDICTION_VERSION` must move whenever the prediction rule does.** It is stamped on stored
  predictions, and records made under different rules must not be pooled.
- **The insights page and the post-Block-4 final analysis page are not timed.** Removed on 15
  September 2026, and the pages themselves were deleted on 29 September 2026 (their data is still made; see
  "Attention checks, and the two between-block pages deleted"). They were pages a participant reads, so their duration
  measured reading speed and nothing the study asks about. The totals still include the time — only the two per-page numbers
  are gone. `UNTIMED_DISPLAY_STAGES` in `telemetry.ts` is the list, and `dbShape.ts` uses it to
  strip the two from any ledger written before the change.
- **`analysis.mpf_predictions_every_scenario` is computed after the fact for scenarios 1–5.** Only
  scenario 6's probabilities were on screen while anybody was choosing. Since 28 September 2026 the
  charts show all six AFTER every choice ("What our software expected, and what you chose"); since 29
  September 2026 on the thank-you page, AFTER the feedback (the "Our predictions" tab; opening it is not
  recorded); `was_shown_to_the_participant` still means "while choosing". `self_check` re-derives scenario 6 by the same route to prove
  the recomputation still matches the live one. If that check ever fails, the section is wrong.
