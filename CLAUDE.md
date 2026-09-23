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

`validate:block5` must print `ALL TESTS PASS`, `ALL APA CHECKS PASS` and `ALL DATABASE GATES
PASSED`. Since 23 September 2026 `validate:position` runs LAST in that chain: it fails on purpose
(see below), and while it ran in the middle the `&&` stopped everything after it, so the three lines
above were never printed and four suites never ran. It is the guard on the scoring model and on what reaches MongoDB; treat a failure there as
a blocker, not a warning.

The last of those three comes from `npm run validate:dbshape`, which runs the real `dbShape.ts`
builders over three simulated participants. It is the only check on `analysis` — nothing in there is
ever displayed, so a wrong number would otherwise sit unnoticed until somebody opened the collection
to write a paper.

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
