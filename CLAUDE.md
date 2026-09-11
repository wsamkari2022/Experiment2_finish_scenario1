# VRDS Experiment 2 — notes for anyone working in this repo

A PhD study: participants answer four short blocks, then five emergency scenarios, then see their
results, then give feedback. React 19 + Chakra UI v3 + Vite + TypeScript.

## Before analysing any collected data

**Read `Generated Outputs/HOW_TO_READ_MY_DATABASE.md` first.** It is the data dictionary for the
MongoDB `participants` collection: every field, what it means, which numbers are raw and which are
computed, and a list of traps that produce confident but meaningless findings.

Two of those traps matter enough to repeat here:

- **Filter on `status: "Study Completed"`.** Unfinished runs hold real but partial data and will
  quietly bias every average.
- **`headline` and `analysis` are derived from `blocks`.** Correlating a derived field with the raw
  field it came from is not a finding.

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

`validate:block5` must print `ALL TESTS PASS` and `ALL APA CHECKS PASS`. It is the guard on the
scoring model; treat a failure there as a blocker, not a warning.

## Two files that carry rules rather than code

- **`src/experiment/storage.ts`** — the only module allowed to talk to the server. Everything is
  written to the browser first and sent afterwards, so a stopped API never costs a participant
  their session. Do not add a second path to the server.
- **`src/experiment/dbShape.ts`** — the only place where the study's internal names are translated
  into database names. If a field name in MongoDB looks wrong, it is defined here and nowhere else.

## Things that are deliberate, not oversights

- Participants are never shown an alignment verdict ("Misaligned with your values") or the scoring
  arithmetic. Both were removed on purpose: telling someone how they scored, or how the scoring
  works, changes how they answer the remaining scenarios.
- Scenario 5 is a wish rather than a decision. It is excluded from consistency, stability and the
  reflection measures, but included in the position effect.
- The option ordering (the planner) is settled. It has been reviewed and is not to be "fixed".
