# Stability — what it now measures

**Status:** IMPLEMENTED, 2026-08-25.
**Scope:** Stability only. VCI is covered in `BLOCK5_VCI_METHOD.md`.

---

## 1. What it used to measure, and why that was the wrong thing

`computeStability` counted **how many of the participant's choices would still have fitted their
original Blocks 1-4 profile**. That is a question about *choices* — and it is very close to what
VCI already asks. Two headline numbers were answering nearly the same question against two
different baselines, which is a large part of why the results page was hard to read.

## 2. What it measures now

The block updates the participant's values as they go. Stability asks how far that model of them
actually traveled.

> **VCI** — did your choices fit your values, judged as they stood at the time?
> **Stability** — did your values themselves change?

Two genuinely different questions.

### Two halves, averaged

**Order half** — of the six possible pairs among the four policy values, how many swapped places
between the start of Block 5 and the end? `(6 − swapped) / 6 × 100`.

**Movement half** — the total distance the five scored values traveled, summed scenario by
scenario ("churn"), not start-versus-end ("net drift"). `100 × (1 − churn / 35)`.

Half each. Order is the more meaningful event but coarse — only seven possible values, and
insensitive when one value starts far ahead of the others. Movement is fine-grained but less
meaningful. They compensate, so neither takes precedence.

### Why churn and not net drift — the measured reason

| Participant | Net drift | Churn |
|---|---|---|
| Convert — one honest change, then held | 13.6 | 13.6 |
| **Contrarian — furthest option, every scenario** | **10.2** | **33.2** |

Measured start-to-end, the participant who picked the option furthest from their values in **all
five scenarios** scores 10.2 and the one who changed their mind **once** scores 13.6 — so net
drift would report the thrasher as *more stable*. Thrashing cancels out. Churn separates them.

Gate **S4** asserts this and would fail if the measure were ever switched back.

### What is in, and what is out

| | In the order half | In the movement half |
|---|---|---|
| Vulnerability, Group size, Gain, Outcome | yes | yes |
| Stakeholder | no — a list of one has no order | **yes** — it moves ±25 on every CVR, the biggest bump in the block |
| Directness, Context | no | no — see below |

**Directness and Context are reported, not scored.** They only move when a participant clicks the
optional *"Generate the other view"* control **and** answers which lens moved them. Across six
simulated behavior types they were **completely unmoved in every case**. Scoring a variable that
is frozen for most participants dilutes the number without measuring anything. The results page
instead reports how often the participant chose to compare both lenses — which does vary, and is
a fact about them rather than about the button.

## 3. The ceiling is derived, not chosen

`STABILITY_CHURN_CEILING = 35` is the **p99 of 4,000 seeded random responders** run through the
real five scenarios (p50 = 22.0, p90 = 29.2, p99 = 34.9). Movement beyond what 99% of random
answering produces counts as maximum instability.

This is the same null-model calibration the Blocks 1-4 sensitivities already use
(`sensitivityCalibration.ts`), so the whole instrument is anchored the same way. Gate **S7**
re-derives the null distribution on every run and fails if the constant drifts more than 3 points
from it — so a change to the bump magnitudes or the scenario set cannot silently invalidate it.

## 4. Measured results

| Participant | Stability | Level | Order | Movement | Pairs swapped | Churn |
|---|---|---|---|---|---|---|
| Loyal — always their best fit | **92** | Held steady | 100 | 83 | 0 | 6.1 |
| Anchored — always serves their top value | **91** | Held steady | 100 | 81 | 0 | 6.7 |
| Swinger — away two scenarios, then back | **65** | Shifted a little | 83 | 47 | 1 | 18.6 |
| Convert — one change of heart, then held | **64** | Shifted a little | 67 | 61 | 2 | 13.6 |
| Flip-flopper — new value every scenario | **36** | Shifted a lot | 67 | 4 | 2 | 33.5 |
| Contrarian — furthest option every time | **36** | Shifted a lot | 67 | 5 | 2 | 33.2 |

## 5. Its own words

Stability does not borrow VCI's labels. Words about consistency are the wrong phrase for a drift
measure — consistent with what? It reads **Held steady / Mostly steady / Shifted a little /
Shifted a lot / Changed substantially** (`stabilityLevel()`). `consistencyLevel()` belongs to VCI
alone; its six levels are described in `BLOCK5_VCI_METHOD.md`.

## 6. A limitation worth stating in the methods chapter

**Re-measured 2026-09-13 against the current code.** The limitation recorded here in August was a
consequence of headroom scaling. `bump()` has used flat deltas since 2026-08-31, and the old
limitation is now not merely stale but inverted. A different one has taken its place, and it is the
one to put in the chapter.

### What used to be recorded here, kept as a record and not to be quoted

> The order half is less sensitive than it looks when one value starts far ahead. The Contrarian
> picks against their top value in every scenario and it *still* ends up ranked first, because
> `bump()` scales by headroom, so pushing a value down from 82 is slow. The order half caught only
> 2 of 6 pairs for that participant.

### What the same participant does now

Same Contrarian, same starting profile, same deck, run through the current scoring code:

| | vulnerable | harm | gained | helped | top value |
|---|---|---|---|---|---|
| start | 82 | 64 | 38 | 46 | vulnerable |
| after scenario 1 | 62 | 64 | 68 | 46 | gained |
| after scenario 2 | 42 | 64 | 98 | 46 | gained |
| after scenario 3 | 72 | 64 | 78 | 46 | gained |
| after scenario 4 | 52 | 64 | 100 | 46 | gained |
| after scenario 5 | 52 | 64 | 100 | 46 | gained |

Scenario 5 is a wish and runs no update, which is why the last two rows are identical.

Vulnerability starts at 82 ranked first and finishes at 52 ranked **third of four**. The starting
order `vulnerable > harm > helped > gained` ends as `gained > harm > vulnerable > helped`, and
**4 of the 6 pairs swap**, against 2 under the old rule. The order half is no longer the
insensitive one: it scores 33/100 here and does most of the work.

### The limitation that replaces it

**At the unstable end, the movement half saturates and stops discriminating.** Movement is
`100 × (1 − min(1, churn / STABILITY_CHURN_CEILING))` with the ceiling at 56, so any participant
whose churn reaches 56 scores exactly 0 however much further they travelled.

| Participant | churn | movement half | order half | Stability |
|---|---|---|---|---|
| Swinger | 48.6 | 13 | 100 | 57 |
| Flip-flopper | 60.0 | **0** | 67 | 34 |
| Contrarian | 58.4 | **0** | 33 | 17 |

The two most unstable archetypes receive the same movement score despite visibly different
behavior. They are still separated overall, but only because the order half ranks them 67 against
33. **Report Stability as a composite, and do not report the movement half on its own as an
interval measure at the unstable end — it is censored above the ceiling.**

A second, related effect is visible in the trace above. Flat deltas let a value reach a bound:
`gained` hits 100 after scenario 4 and stops moving, so part of that scenario's update is swallowed
by `clamp` and contributes no churn. A participant who keeps drifting after saturating a value
therefore looks slightly steadier than they were. This is the same cost recorded against `bump()`
in `MEASUREMENT_MODEL.md`, seen here in one participant.

**Both halves are still needed, and the reason has reversed.** In August the order half was the
coarse one and movement carried the signal. Now movement is the half that censors, and order is the
half that separates the badly drifting participants from each other.

*Reproduce: `npm run validate:stability`. The table above is the Contrarian row of its output.*

## 7. Files changed

`block5CVR.ts` — `computeStability(results, originalProfile)` rewritten; `stabilityLevel()` added;
`STABILITY_CHURN_CEILING` added.
`block5Types.ts` — `stakeholderSnapshotAfter` per scenario; `stabilityDetail` on the results.
`Block5PublicEmergencySimulation.tsx` — snapshot stakeholder; pass the original profile; store the detail.
`Block5SimulationSummaryPage.tsx` — Stability card wording; the two-lenses report.
`tools/simulate_stability.cjs` — new; chained into `npm run validate:block5`.

`alignedToOriginal` is still recorded per scenario — the old signal is kept as data, it simply no
longer drives the headline.
