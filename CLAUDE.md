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
(since 24 September 2026) and `ALL DATABASE GATES PASSED`. Since 23 September 2026 `validate:position` runs LAST in that chain: it fails on purpose
(see below), and while it ran in the middle the `&&` stopped everything after it, so the three lines
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
alignment label and the counts, the three profiles, and the feedback.

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
| `validate:dbshape` | What reaches MongoDB. 50 gates, including the position rows and the prediction rows recomputed by hand (D45–D48), the gathered copy (D49) and the stored MCF (D50). `--dump` writes a full simulated document |
| `validate:visits` | Working time and visits: one sitting, a 31-minute break, a reload after lunch, a second participant at the same machine, the same participant on a second machine |
| `validate:resume` | Carrying a run to another computer. Replays the run that sent a finished participant back to Block 1 |
| `validate:mcf` | The Moral Commitment Function: the decomposition, the swaps, and every sentence it can produce |
| `validate:profile` | The Blocks 1-4 scoring that feeds Block 5 (`thresholdTree.ts`, `sensitivityCalibration.ts`). Until 24 September 2026 no check ran it at all |
| `validate:position` | The position effect. **Fails on purpose** (2.8× against a 3× gate) until the position calculation pass, which is why it runs LAST in the chain |
| `report:planner` | How often the first card is also the best-fitting option — 48% now, 69% under a weighting planner, 16.7% by chance |
| `export_block5_content.cjs` | Writes every scenario, option, lens and stakeholder story as JSON, for the Word export |

## Two files that carry rules rather than code

- **`src/experiment/storage.ts`** — the only module allowed to talk to the server. Everything is
  written to the browser first and sent afterwards, so a stopped API never costs a participant
  their session. Do not add a second path to the server.
- **`src/experiment/dbShape.ts`** — the only place where the study's internal names are translated
  into database names. If a field name in MongoDB looks wrong, it is defined here and nowhere else.
  It also builds every `analysis.*` section, which means it runs real arithmetic; `npm run
  validate:dbshape` is what stands over that.

## Things that are deliberate, not oversights

- **One simulation fails on purpose until the position pass: `simulate_position` (the 3x ratio).**
  The researcher had the options redesigned to make sense first (18 September 2026), and the
  calculations are being rebuilt on them one at a time; VCI and Stability are done and pass. Do not
  revert an option's content or numbers to make the position gate pass — see
  `docs/BLOCK5_SCENARIO_AUDIT_CHECKLIST.md`, section 2g.
- **A final choice reached through APA is judged on the profile the participant brought into the
  scenario**, exactly like a choice kept after the CVR (since 18 September 2026). Neither path
  re-labels the choice inside its own scenario; both move the profile for the next one. Relabeling
  on the clarified profile would let a participant who changes value every scenario score 56 instead
  of 31. Gate V8 in `simulate_vci.cjs` guards it; ties in fit are broken by `policyDelivery`, never
  by id (V9).
- **VCI's label weights are derived, not chosen (since 19 September 2026).** Each label carries the
  average place score of the places it covers, `b(r) = (n − r) / (n − 1)`: on six options 1.00 /
  0.80 / 0.50 / 0.10, so blind picking is exactly 50. The six levels (Highly Consistent, Mostly
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
- The "How to read the four values in this scenario" section is absent from scenario 6 on purpose:
  its four options are the four values, and naming them would turn the prediction test into "pick
  your value".

- Participants are never shown an alignment verdict ("Misaligned with your values") or the scoring
  arithmetic. Both were removed on purpose: telling someone how they scored, or how the scoring
  works, changes how they answer the remaining scenarios. The last place the verdict survived was a
  badge under each option title in the compare-charts overlay, removed on 15 September 2026, so no
  live scenario prints one anywhere. The level is still computed and still stored — it is simply
  never shown while the participant is still choosing.
- Scenario 5 is a wish rather than a decision. It is excluded from consistency, stability and the
  reflection measures, but included in the position effect.
- The option ordering (the planner) is settled. It has been reviewed and is not to be "fixed".
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
