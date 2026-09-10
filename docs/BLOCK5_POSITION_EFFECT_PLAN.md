# Block 5 — Position Effect

> **SUPERSEDED IN PART — 4 September 2026.** This document describes the five-scenario deck.
> `flood_evacuation_priority` and `water_contamination_response` have since been removed; Block 5
> now runs chemical, wildfire and cancer. The reasoning below is kept as the design record of the
> decision made at the time — it is history, not a description of what ships. See the changelog at
> the top of `docs/VRDS_EXPERIMENT_GUIDE.md`.


**Status:** plan, awaiting approval. Nothing implemented yet.
**Date:** 2026-08-29

**Decisions locked (2026-08-29):**
1. Distance is measured on the **4 policy values** only.
2. **Reflection Pull is included** — see §4b.
3. The headline is called **Position Effect**, to avoid colliding with the existing Stability score.

---

## 1. The question this answers

Block 5 already asks *what* a participant chooses. It does not ask whether they are **the same
person** when the cost lands somewhere else.

The five scenarios are already built as a ladder of who bears the cost:

| Position | Scenario | Who is affected |
|---|---|---|
| **A — Only me** | 1. Getting to Fairhaven | The participant, and nobody else |
| **B — Me and my people** | 2. Dinner for Four | The participant and the group in the room with them |
| **C — Other people** | 3. Cancer · 4. Flood · 5. Water | Other people. The participant is not among them |

The measure below asks: **as you move down that ladder, do your choices stay close to who you were
before Block 5 started — or do you become someone else?**

This is the driving example: *"Am I the same driver alone as I am with my children in the car?"*

---

## 2. What gets measured

For every scenario, we compare **the option they finally chose** with **the profile they had before
Block 5 started** (`Block5Results.originalProfile`, already captured and never mutated —
`applyKeepUpdates` clones, so the pre-Block-5 snapshot is genuinely frozen).

### 2a. Raw distance — `profileDistance`

```
D = (1/4) × Σ | user_k − option_k |     over the 4 policy values
```

Range 0–100. Observed range across real options: about 5–55.

**Why mean absolute difference and not Euclidean.** It is readable as a sentence — *"on average
each of your four values sat 24 points away from what you chose"* — and it does not let one large
gap dominate three small ones. For a within-person comparison we want an even-handed summary,
not a worst-case one.

**Why only the 4 policy values.** The other three sensitivities are not policy demands: context
and directness pick the CVR's reflection lens, and stakeholder picks whose voice appears. This is
the same boundary `policyAlignmentScore` already draws, and for the same documented reason.

### 2b. Why this is a distance and alignment is not

`policyAlignmentScore` is deliberately **one-sided**: an option is penalized only when it delivers
*less* than the participant demands, because you should not be punished for an option protecting
the vulnerable more than you asked.

That reasoning is correct **for judging an option** and wrong **for this measure**. If someone
whose profile reads *protect the vulnerable = 30* chooses an option that reads 95, they **have**
moved away from who they were. That movement is the finding, not an error. So Position Effect
uses a **symmetric** distance, and the two measures answer different questions:

| | Question | Shape |
|---|---|---|
| `policyAlignmentScore` | Does this option meet my demands? | One-sided (shortfalls only) |
| `profileDistance` | How far is this choice from who I was? | Symmetric (both directions) |

Alignment is untouched. Nothing in scoring changes.

### 2c. Menu-normalized departure — `departureIndex`

```
E = 100 × (D_chosen − D_nearest) / (D_farthest − D_nearest)
```
over the six options that scenario actually offered. Range 0–100:
*"of the room this scenario gave you, how much of it did you use?"*

---

## 3. The confound — and the measurement that shows it is handled

**The risk.** The five scenarios have different options. If scenario 3's menu simply sits further
from a given profile than scenario 1's, then a raw distance would partly measure *which scenario
you were in* rather than *how you responded to it*. An advisor will ask this immediately.

**So it was measured, not assumed.** Across five archetype profiles (protector, maximiser,
middle-of-road, low-demand, high-demand):

| | Points |
|---|---|
| How much the **menu alone** shifts the mean distance between scenarios | **1.0 – 2.4** |
| Room to move **inside** one scenario (farthest option − nearest option) | **18.5 – 21.8** |

The scenario menus are balanced to within about 2 points, while each scenario gives roughly 20
points of room. **The signal is about ten times the confound.** The five menus were built well.

Two consequences:

1. The **raw distance is already broadly comparable** across scenarios — worth reporting, because
   it is the interpretable number.
2. The **normalized departure is used for the position comparison** anyway. It costs nothing, it
   removes the remaining 1–2 points, and it means the claim survives the question being asked.

---

## 4. The headline

```
positionEffect = max(A, B, C) − min(A, B, C)
```
where `A = E₁`, `B = E₂`, `C = mean(E₃, E₄, E₅)`. Range 0–100. **0 = the same person in every
position.**

### It discriminates — simulated on the real option set

| Participant | Only me | Me + my people | Other people | Position Effect |
|---|---:|---:|---:|---:|
| Same person everywhere | 0 | 0 | 0 | **0** |
| Drifts when it is not their cost | 0 | 0 | 94 | **94** |
| Protects own group only | 61 | 0 | 94 | **94** |
| Chooses without pattern | 100 | 0 | 67 | **100** |

### The most important thing in this table

Rows 2 and 3 **both score 94** — but they are completely different people. One is consistent until
strangers are involved; the other is loyal only to the people in the room with them.

**The single number is a summary. The three-point shape is the finding.** That is why the hero
visualization is the shape across the three positions, and the number is secondary.

### Direction, not just size

Per position we also store the **signed** mean movement on each of the four values
(`chosen − profile`). That is what turns *"they moved 94"* into
*"when other people carry the cost, this person protects the vulnerable 30 points less than their
own profile says."* This is the sentence the driving example is asking for.

### 4b. Reflection Pull — does the CVR move them back toward themselves?

`firstChoiceOptionId` is already recorded on both result paths, so this costs one subtraction:

```
reflectionPull = D(first choice) − D(final choice)
```

* **positive** — reflection pulled them **closer** to the profile they arrived with
* **negative** — reflection pushed them **further** from it
* **zero** — they never reconsidered (first and final are the same option)

**Why this one is the cleanest measure in the plan.** The first and the final choice are drawn
from the *same six options in the same scenario*. The menu is identical on both sides of the
subtraction, so it cancels completely — Reflection Pull carries **none** of the confound discussed
in §3, and needs no normalization at all.

It is also rolled up **per position**, which asks a question worth asking on its own: *does
reflection work better when the cost is not yours?*

---

## 5. The visualizations (new cards on the Block 5 charts page)

**Card 8 — "Does your position change what you choose?"** *(the hero)*
A slope chart across the three positions, 0–100. One line. The Position Effect number beside it,
and a plain-English caption. The shape is the point: flat means one person, a rising line means
someone who changes when the cost moves away from them.

**Card 9 — "Your first choice, your final choice, and the range you were given"** *(the honest one)*
Five rows, one per scenario, grouped by position. Each row draws the full range the menu offered
(nearest option → farthest option) and a faint tick at the menu's average, then a **hollow marker
at the first choice and a solid marker at the final one, with an arrow between them**. The reader
sees the menu, the choice, and the effect of reflection in a single row.

Folding Reflection Pull into this card rather than giving it a card of its own is deliberate: both
facts live on the same axis and the same track, so a separate chart would redraw the identical
scale to say less. Needs one new chart primitive, `RangeDotChart`.

**Card 10 — "Which values moved, and which way"**
A radar with the pre-Block-5 profile as a dashed gray reference and three solid shapes — the mean
of the options chosen at each position. Uses the existing `RadarChart` unchanged. This is where
*direction* becomes visible.

---

## 6. What gets stored

All fields **optional and additive**. No existing field changes meaning, no sensitivity key is
renamed, and no score (VCI, Stability, Performance) is affected.

**On `Block5Scenario`** — the ladder becomes data, not an array index:
```ts
stakePosition?: "self" | "self_and_group" | "others";
```

**On `Block5ScenarioResult`** — computed once in `finalizeScenario`, which both result-construction
paths (direct choice and APA) already funnel through:
```ts
profileDistance?: number;        // D, 0-100
departureIndex?: number;         // E, 0-100
menuDistance?: { nearest: number; farthest: number; mean: number };
signedDeltas?: Record<Block5PolicyDimKey, number>;   // chosen - profile
firstChoiceDistance?: number;    // D of the first choice, same scale
reflectionPull?: number;         // firstChoiceDistance - profileDistance
```

**On `Block5Results`**:
```ts
positionAnalysis?: {
  byPosition: Record<StakePosition, { departure: number; distance: number; n: number }>;
  positionEffect: number;
  signedByPosition: Record<StakePosition, Record<Block5PolicyDimKey, number>>;
  driftCheck: number;   // trend across S3-S5, all one position - see limits
  reflectionPull: { overall: number; byPosition: Record<StakePosition, number> };
};
```

---

## 7. Honest limits (state these in the write-up)

1. **Unequal n.** Position A and B rest on one scenario each; position C averages three. A and B
   are noisier. This is descriptive, not a significance test, and must not be written as one.
2. **Position is confounded with order.** Scenarios always run 1→5, so anyone who drifts simply
   because they are tired or practiced will look position-sensitive. **Partial control:** the three
   position-C scenarios sit at three different points in time, so a trend across S3→S4→S5 measures
   drift *within a constant position*. That is `driftCheck`, and a large value is a warning that
   the effect may be time, not position.
3. **Content differs.** Travel is not cancer. Some of any difference is subject matter, not stake
   position. Not removable with five scenarios; state it.
4. **Five data points per person.** This describes an individual's pattern. Claims about
   populations need the between-subjects sample, not this.

---

## 8. Build order

| Stage | Work | Check |
|---|---|---|
| 1 | `stakePosition` on all five scenarios; types for the new fields | validator gate: all 5 tagged, exactly one `self`, one `self_and_group`, three `others` |
| 2 | `positionDistance.ts` — D, E, signed deltas, the rollup | new `simulate_position.cjs` reproducing the table in §4 |
| 3 | Wire into `finalizeScenario` + block completion | typecheck, existing validators still green |
| 4 | `RangeDotChart` primitive | renders at 5 rows, both color modes |
| 5 | Cards 8, 9, 10 on the charts page | screenshots, light + dark + mobile |
| 6 | Docs + Simple English Explanation | — |

Nothing in stages 1–3 is visible to a participant. Block 5 behavior is unchanged.

---

## 9. Simple English Explanation

Imagine you are driving. **Alone**, you might drive fast. With **your children in the back**, you
probably slow down. With **a stranger's children** in the back — what then? Most people believe
they would drive the same way. Many do not.

Block 5 already puts the participant in exactly those three seats:

1. **Only me** — the travel scenario. If it goes wrong, only they suffer.
2. **Me and my people** — the dinner. They and the people at the table.
3. **Other people** — cancer, flood, water. Other people suffer, not them.

Before Block 5, we already know what they say they value. So for every scenario we ask one simple
question: **how far is the option they picked from the person they said they were?**

Then we line up the three answers. If the three are about the same, they are one person no matter
who pays. If the third is much bigger than the first, then they are careful with their own
skin and looser with everyone else's — and now we can show it, with a number and a picture.

One honest note: this is five decisions from one person. It describes *that* person clearly. It
does not prove anything about people in general — that needs many participants.
