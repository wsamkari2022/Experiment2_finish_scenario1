# VRDS Experiment 2 — notes for anyone working in this repo

A PhD study: participants answer four short blocks, then five emergency scenarios, then see their
results, then give feedback. React 19 + Chakra UI v3 + Vite + TypeScript.

## Before analyzing any collected data

**Read these two, in this order.**

1. `Generated Outputs/HOW_TO_READ_MY_DATABASE.md` — the data dictionary for the MongoDB
   `participants` collection: every field, what it means, which numbers are raw and which are
   computed, and a list of traps that produce confident but meaningless findings.
2. `Generated Outputs/HOW_TO_ANALYZE_MY_DATA.md` — which questions the data can answer, which
   analyses answer them, what may and may not be claimed, and which figures to build. Written for a
   person or an AI agent arriving with no other context.

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
(since 24 September 2026) and `ALL DATABASE GATES PASSED`. Since 23 September 2026 `validate:position` runs LAST in that chain: it failed on purpose
until 26 September 2026 (it passes since Fix 6, see below), and while it ran in the middle the `&&` stopped everything after it, so the three lines
above were never printed and four suites never ran. It is the guard on the scoring model and on what reaches MongoDB; treat a failure there as
a blocker, not a warning.

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
can produce is inspectable, and `npm run validate:mcf` generates all of them — 61,945 across every
option in every scenario against 403 profiles — and fails on a verdict word or a digit. Quoted
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
| `validate:dbshape` | What reaches MongoDB. 61 gates, including the position rows and the prediction rows recomputed by hand (D45–D48), the gathered copy (D49), the stored MCF (D50), the per-scenario profile (D51), the Blocks 1-4 checks (D52), the readable card order (D53), the two fit scales kept apart (D54), every value move (D55), the saved shortfall (D56), performance over the decisions only (D57), what the wish changed in values (D58) and in performance (D59), the company value shown (D60) and the company stance (D61). `--dump` writes a full simulated document |
| `validate:twins` | Scenarios 4 and 5 are the same six options, and scenario 5 is only a wish: performance counts the decisions only, scenario 5 is shown on scenario 4's opening values, the same wish gives 0, a different one reads as the options' difference, in values and in performance (W1-W5) |
| `validate:visits` | Working time and visits: one sitting, a 31-minute break, a reload after lunch, a second participant at the same machine, the same participant on a second machine |
| `validate:resume` | Carrying a run to another computer. Replays the run that sent a finished participant back to Block 1 |
| `validate:mcf` | The Moral Commitment Function: the decomposition, the swaps, and every sentence it can produce |
| `validate:profile` | The Blocks 1-4 scoring that feeds Block 5 (`thresholdTree.ts`, `sensitivityCalibration.ts`). Until 24 September 2026 no check ran it at all |
| `calibration:regenerate` / `calibration:check` | The recipe for the common ruler's tables. Regenerate after any raw-formula change; the check (also gate K1) fails if the tables and the formulas disagree |
| `validate:position` | The position effect: a choice must move the fit number at least 3× more than the menu does. **Passes since 26 September 2026** (3.3×, after the Fix 6 option numbers); it failed on purpose before (2.9×), which is why it still runs LAST in the chain |
| `report:planner` | Planner against a weighting planner, on MADE-UP value scores — understates the overlap; use `report:planner-overlap` for the real figure |
| `report:planner-overlap` | How often the first card is also the best-fit card, with pretend participants answering Blocks 1-4 (real code end to end): 52-62 in 100 steady, 42-50 random, chance about 17 (26 September 2026, after Fix 6) |
| `export_block5_content.cjs` | Writes every scenario, option, lens and stakeholder story as JSON, for the Word export |
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
  calculations were rebuilt on them one at a time. It passes since the Fix 6 option numbers (3.3x):
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
- The "In this scenario" meanings (the "Your values in this scenario" panel, formerly "How to read
  the four values in this scenario") are absent from scenario 6 on purpose: its four options are the
  four values, and naming them would turn the prediction test into "pick your value". The
  participant's own four numbers are still shown there, as the sidebar always showed them; whether
  scenario 6 should show them at all is an open decision (audit A9).

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
  72-100 people in 100, and is ALSO their best-fit card for 52-62 in 100 who answer steadily (42-50
  at random; chance about 17; re-measured 26 September 2026, after Fix 6). The researcher's decision (24 September 2026): accept it, state it,
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
  scenario 6's probabilities were ever on screen. Every row carries
  `was_shown_to_the_participant`, and `self_check` re-derives scenario 6 by the same route to prove
  the recomputation still matches the live one. If that check ever fails, the section is wrong.
