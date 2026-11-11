# VRDS Experiment 2: Human-AI Moral Value Decision-making Study

A PhD study. Participants, recruited on Prolific, answer four short blocks that measure
their values, then decide in six emergency scenarios, then see their results, then give feedback. Each participant is
given one of four conditions (CVR+APA, CVR only, APA only, Baseline), balanced by the server.

Built with React 19, Chakra UI v3, Vite and TypeScript; the server is Express with MongoDB.

## Run it on this computer

```bash
npm install
npm run dev          # the study, on http://localhost:5173
npm run server       # the API that saves to the local MongoDB, on port 4000
npm run server:test  # instead of "server": a test database and a made-up completion code
```

Open the study with a made-up Prolific ID (24 letters a-f and digits):
`http://localhost:5173/prolific?PROLIFIC_PID=<made-up id>&condition=CVR_APA` (or `CVR_Only`, `APA_Only`, `BSL4`).

## Before changing anything

```bash
npm run typecheck && npm run lint && npm run validate:block5 && npm run build
```

Every check must print its PASS line. After any change to a document, also run `npm run validate:docs`.

## Where to read more

| File | What it is |
|---|---|
| `CLAUDE.md` | The project's rules and every dated change; read it first |
| `Generated Outputs/HOW_TO_READ_MY_DATABASE.md` | The data dictionary: every field in the database and what it means |
| `Generated Outputs/HOW_TO_ANALYZE_MY_DATA.md` | How to analyse the data, the traps, and the first day with real data |
| `docs/ANALYSIS_AND_FIGURES_PLAN.md` | The analysis plan: the 23 hypotheses, their fields and tests, and the figures |
| `docs/DAILY_PAY_CHECK.md` | The daily Prolific pay check |
| `DEPLOYMENT.md` | How the study is put on the server |
| `docs/HISTORY_OF_CHANGES.md` | Older sections of CLAUDE.md that describe versions nobody took part in |

## Privacy

- `.env` holds the database password and the Prolific completion code. It is never committed, printed or sent.
- `Prolific docs/` holds Prolific IDs and the daily exports. It is never committed, and its files never go to an AI tool;
  use the AI-safe copy (`npm run data:ai-copy`) instead.
