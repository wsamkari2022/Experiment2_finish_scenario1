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
The server check happens once at page load, so if you start the API afterwards, **refresh the page**
or that session stays local-only.

## Before changing anything

```
npm run typecheck && npm run lint && npm run validate:block5 && npm run build
```

`validate:block5` must print `ALL TESTS PASS`, `ALL APA CHECKS PASS`, `ALL PROFILE GATES PASSED`
(since 24 September 2026), `ALL DATABASE GATES PASSED`, `ALL VCI_ALL GATES PASSED`, `ALL JOURNEY GATES PASSED` (both since 28 September 2026) and `ALL SESSION GATES PASSED` (since 29 September 2026). Since 23 September 2026 `validate:position` runs LAST in that chain: it failed on purpose
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
and the panel's four numbers, strongest first, pointed the same way. The two charts in the Compare overlay
stay (the researcher's choice). Gate M11 (`validate:mcf`) reads the source; `analysis.mcf` rows carry
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
  bars." The results page stars scenario 5's performance bar ("Scenario 5 *", explained in the
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

## The charts page ("A picture of your journey"), refreshed 28 September 2026

The researcher: "most of the visualization cards are stale". The page (`Block5VisualizationsView.tsx`, opened from
the results page, after every choice) had stopped at scenario 5 and predated a week of changes. Refreshed card by
card on the approved plan ("Q1-A, Q2-final, Q3-yes, Q4-yes"); its new numbers live in `block5Journey.ts` (pure, no
React), which `npm run validate:journey` checks (J1-J8, in the chain; every gate shown to fail on a deliberate break).

- **Scenario 6 on the page:** a row in the choice card; the value line runs to S6 (S5 and S6 flat, explained);
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
- **A slim bar at the bottom of the screen** (`FeedbackBar`) on the results page and the charts page. It shows only while
  neither the card nor the page's own bottom button is on screen (IntersectionObserver), slides in, never loops, and
  reads "1 step left · feedback" on a phone. It invites and never warns: no leave pop-up (the consent page promises the
  participant may stop at any time).
- **The progress bar** (GlobalStepper): on the results page the Feedback dot is pink with "next" under it and the flag's
  note reads "After the feedback" (it said "End of the study"). Static, not clickable; the flag keeps the one looping
  animation. **On a phone the rail now slides to the current stop** (and the "next" one): it always opened at its left
  end, so on a 375px phone the results page showed neither "Your results" nor Feedback. This affects every stage on a
  narrow screen; on a wide one everything fits and nothing moves.
- **Recorded:** `analysis.results_page` (resultsPageRecord.ts -> SOURCE_MAP in dbShape.ts): which button first took them
  to the feedback (`card_under_scores`, `bar_on_results`, `bar_on_charts`, `bottom_of_results`, `bottom_of_charts`), how
  often they went, and whether they opened the charts first. The time on the page is already
  `active_time.by_stage_minutes.block5_summary`. The browser file travels with `resume_state`. `SHAPE_VERSION`
  "2026-09-28-results-page". Gates D66 (`validate:dbshape`) and J9 (`validate:journey`, from the source); each was shown
  to fail on a deliberate break (7 breaks, 7 caught).
- **Testing note:** the bar's "is it on screen?" signal fires only when the page draws a frame, so in a hidden browser
  pane it can look stuck until something is drawn. Not a bug on a real screen.

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
- **Deploying:** the page and the server may go up in either order; a page without the new server fails open (no lock), a
  server without the new page sees no browser id and allows. Restart the local `npm run server` after pulling: Node does
  not reload by itself.

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
| `validate:dbshape` | What reaches MongoDB. 66 gates, including the position rows and the prediction rows recomputed by hand (D45–D48), the gathered copy (D49), the stored MCF (D50), the per-scenario profile (D51), the Blocks 1-4 checks (D52), the readable card order (D53), the two fit scales kept apart (D54), every value move (D55), the saved shortfall (D56), performance over the decisions only (D57), what the wish changed in values (D58) and in performance (D59), the company value shown (D60), the company stance (D61), whether Stability measured anything (D62), how close the top two values were (D63) and whether an MCF reading could be opened in that scenario (D64, false in scenario 6), VCI_all with its running fits, saved against rebuilt and recomputed by hand (D65), and which button took them from the results page to the feedback (D66). `--dump` writes a full simulated document |
| `validate:vciall` | VCI_all and the hidden running values (since 28 September 2026): the keep rule unchanged by the refactor (A1), the running rule (A2), running values = the study's through scenario 4 (A3), no choice judged on its own move (A4), blind 50 (A5), derived level edges (A6), a value-follower scores 100 (A7), decisions' running fit = the study's fit and the wish and veil move only the running values (A8). Prints the echo and the screen-against-yardstick shares |
| `validate:journey` | The charts page's numbers (since 28 September 2026): consistency points = VCI_all's parts and average to it (J1), the fallback for old runs (J2), the veil row by the final rule and the study's distance (J3), the guess card (J4), reconsidering with scenario 6 split (J5), the deck's five positions (J6), Block 4 (J7), and from the source: every card reads all six, no Finish button, a finished participant opens on the thank-you screen (J8); the way on to the feedback: "1 step left" instead of "Complete", the card under the score cards, the bar on both pages, every button recorded, an honest gift-card line, no leave warning, Feedback "next" in the progress bar and the rail sliding to it on a phone (J9); the MPF card: the database's own numbers, the gap, a first choice only when it changed, scenario 6 as shown, the favourite = the best fit, and scenario 6 a striped bar apart from the positions (J10) |
| `validate:session` | Continue where you left off, and one place at a time (since 29 September 2026): the server's one-browser rule (C1), every write route asks it and the claim checks the age (C2), Block 5's progress comes back exactly with the same fit numbers (C3) and only for its owner and profile (C4), a failed save waits and is sent once, in order, even with saves arriving as the queue drains (C5), a 409 from another browser locks the page and sets the queue aside (C6), the tab rule and the progress sends (C7), and from the source: Blocks 2, 3 and 5 save and restore with an owner, the claim comes first, the lock screen before any page (C8) |
| `validate:twins` | Scenarios 4 and 5 are the same six options, and scenario 5 is only a wish: performance counts the decisions only, scenario 5 is shown on scenario 4's opening values, the same wish gives 0, a different one reads as the options' difference, in values and in performance (W1-W5) |
| `validate:visits` | Working time and visits: one sitting, a 31-minute break, a reload after lunch, a second participant at the same machine, the same participant on a second machine |
| `validate:resume` | Carrying a run to another computer. Replays the run that sent a finished participant back to Block 1 |
| `validate:mcf` | The Moral Commitment Function: the decomposition, the swaps, and every sentence and tag it can produce (M1-M7); since 27 September 2026 also that every size word matches its gap (M8), the "because you hold it more strongly" reason is said exactly when it should be and is true (M9), every reading names all four values once in the participant's order (M10), and scenario 6 renders neither the MCF nor "Your values in this scenario" (M11) |
| `validate:profile` | The Blocks 1-4 scoring that feeds Block 5 (`thresholdTree.ts`, `sensitivityCalibration.ts`). Until 24 September 2026 no check ran it at all |
| `calibration:regenerate` / `calibration:check` | The recipe for the common ruler's tables. Regenerate after any raw-formula change; the check (also gate K1) fails if the tables and the formulas disagree |
| `validate:position` | The position effect: a choice must move the fit number at least 3× more than the menu does. **Passes since 26 September 2026** (3.3× after Fix 6, 5.4× after Fix 7); it failed on purpose before (2.9×), which is why it still runs LAST in the chain |
| `report:major-scores` | Writes docs/MAJOR_SCORES_DISTRIBUTION.md: VCI, VCI_all (section 1b, since 28 September 2026), Stability (with "not measured"), end-of-study performance and the separations for all twelve kinds of pretend participant, plus the card-order overlap, the position ratios and the prediction calibration, stamped with the code version. **Run it after every change** (since 26 September 2026) |
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
  figures: `npm run report:stability`; gates S1–S11.
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
  September 2026: they are pages a participant reads, so their duration measures reading speed and
  nothing the study asks about. The totals still include the time — only the two per-page numbers
  are gone. `UNTIMED_DISPLAY_STAGES` in `telemetry.ts` is the list, and `dbShape.ts` uses it to
  strip the two from any ledger written before the change.
- **`analysis.mpf_predictions_every_scenario` is computed after the fact for scenarios 1–5.** Only
  scenario 6's probabilities were on screen while anybody was choosing. Since 28 September 2026 the
  charts page shows all six AFTER every choice ("What our software expected, and what you chose"), for
  those who open it (`analysis.results_page.times_charts_opened`); `was_shown_to_the_participant` still
  means "while choosing". `self_check` re-derives scenario 6 by the same route to prove
  the recomputation still matches the live one. If that check ever fails, the section is wrong.
