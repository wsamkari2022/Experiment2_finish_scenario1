# VRDS Experiment 2 — Complete Guide

**Value-Reflective Decision Support · Waseem Samkari · last updated 5 September 2026**

This is the single document that explains what the study measures, how every number is produced,
what data you will collect, and what is still weak. It is written to be read by someone who has
never seen the code — your advisor, an examiner, or you in a year's time.

Every formula here is the one the code actually runs. Where a number is quoted, it was measured on
the scenarios that ship, not estimated.

> ### ⚠ Changelog — 5 September 2026: two scenarios swapped, four new measures
>
> Block 5 still runs **five scenarios**, but not the same five. `flood_evacuation_priority` and
> `water_contamination_response` are gone; a matched **workplace pair** replaces them.
>
> | # | Scenario | Position | Role |
> |---|---|---|---|
> | 1 | Six Hours to Clear the District | self | decides |
> | 2 | Eight Hours Ahead of the Fire | self_and_group | decides |
> | 3 | Cancer Treatment Allocation | others | decides |
> | 4 | **The Care Visits You Have to Cut** | **under_authority** | decides |
> | 5 | **The Same Cut, Decided Without You** | **receiving_end** | **only wishes** |
>
> **Why flood and water went.** Three of five slots were spent on one position. Cancer beat both on
> every count: 16 distinct planner orders (vs 14), the lowest planner/alignment confound (36% vs
> water's 44%), and the only option set that maps onto named ethical positions.
>
> **What the pair adds.** Scenarios 4 and 5 are the same employer, the same decision and *the same
> six options* — only the chair changes. Nothing else in the study holds content constant like that,
> so the contrast between them isolates position and nothing else.
>
> **What was recalibrated.** `STABILITY_CHURN_CEILING` 65 → 43 → **55**; the cancer performance
> ladder (minimum gap 1 → 19); three `speed` values, to keep G3 satisfied. Menu confound re-measured
> at 12.8× worst (gate ≥ 3×).
>
> **What is still missing.** The drift check. Every position now appears exactly once, so
> `driftCheck` returns null — see §9.4.

---

## Table of contents

1. [The question the study asks](#1-the-question-the-study-asks)
2. [The five blocks, end to end](#2-the-five-blocks-end-to-end)
3. [The four values, and how they are measured](#3-the-four-values-and-how-they-are-measured)
4. [From answers to a profile](#4-from-answers-to-a-profile)
5. [The planner — how the six cards are ordered](#5-the-planner--how-the-six-cards-are-ordered)
6. [Alignment labels](#6-alignment-labels)
7. [CVR — the reflection, and its two lenses](#7-cvr--the-reflection-and-its-two-lenses)
8. [APA — how the profile moves](#8-apa--how-the-profile-moves)
9. [The measures](#9-the-measures) — including [the workplace pair](#94b-the-workplace-pair--four-measures-nothing-else-in-the-study-can-produce)
10. [The data you collect — data dictionary](#10-the-data-you-collect--data-dictionary)
11. [The gates that keep it honest](#11-the-gates-that-keep-it-honest)
12. [Limitations to state in the write-up](#12-limitations-to-state-in-the-write-up)
13. [Suggested improvements](#13-suggested-improvements)
14. [The Block 5 interface, and the tools around it](#14-the-block-5-interface-and-the-tools-around-it)

---

## 1. The question the study asks

**Do people hold the same moral priorities when the cost lands on someone else?**

And a second question underneath it: **does making a person look at the consequences of their own
choice change what they choose?**

Everything in the software exists to answer one of those two.

### The everyday version

You are careful with money. Then you find £50 on the pavement outside a homeless shelter, and you
find £50 outside a bank. Same £50, same act of keeping it. Do you behave the same way?

Most people do not. That difference is not hypocrisy — it is **context sensitivity**, and it is
measurable. The study measures it, then asks whether it also appears when the stakes are lives
rather than money, and whether it changes when the person is made to look at who pays.

---

## 2. The five blocks, end to end

| Block | What the participant does | What it produces |
|---|---|---|
| **1 · Money** | Finds money in three places (neutral street, wealthy district, outside a shelter). For each, a ladder from $0.25 to $10,000: keep it, or not? | Three independent thresholds |
| **2 · Trolley** | How many lives must be saved before you would pull a lever? Then: before you would push a person? | Two thresholds on one lives-saved ladder |
| **3 · AI workforce** | Approve a rollout that harms workers? Asked six times: three group sizes × two kinds of worker (little to fall back on / strong safety net) | A six-cell matrix of money thresholds |
| **4 · Reflection** | One scenario, three stakeholder perspectives, decide → hear voices → decide again | Whether hearing others changed the decision |
| **5 · Main study** | Five scenarios, six options each. In four you decide; in the last you only say what you *wish* someone else would do | Choices, one wish, reflections, and the profile's movement |

### Why the ladders stop when they do

Every ladder walks **upward and stops at the first acceptance**. That is deliberate, and it has a
consequence worth knowing: **a participant cannot contradict themselves within a ladder.** They
cannot accept at $10 and refuse at $100, because once they accept, the ladder ends.

This matters when reading Section 9's consistency measures — see [§12](#12-limitations-to-state-in-the-write-up).

---

## 3. The four values, and how they are measured

Block 5 runs on four values. Each is derived from Blocks 1–3, never assumed.

| Value | Plain meaning | Where it comes from |
|---|---|---|
| **Protecting the vulnerable** | How much you shield people least able to cope | Block 3: how much more you demanded when the workers had little to fall back on |
| **Reducing harm** | Preferring fewer people hurt | Block 2: your trolley thresholds |
| **How many are helped** | Preferring more people reached | Block 2, inverted (see below) |
| **How much is gained** | How responsive you are to the size of the payoff | Block 3, inverted (see below) |

### The two inverted ones — a trap worth naming

Two of the four are **inverted ladder levels**, and getting this backwards would corrupt every
alignment label silently:

```
gainB3        = 1 − (overallGain / GAIN_STEPS)
aggregationB2 = 1 − (avgTrolley / TROLLEY_STEPS)
```

**Why.** A *low* bar means a *small* gain was enough to move you. Approving a rollout at $1 means
you are highly gain-responsive, so a low ladder position maps to a **high** score. The same logic
applies to the trolley ladder.

Consequence: **red lines exist only on "protecting the vulnerable" and "reducing harm".**
The other two have no refusal to convert into a hard limit.

---

## 4. From answers to a profile

Blocks 1–3 → `buildThresholdTree()` → seven ranked sensitivities → `extractBlock5Profile()` →
the four values Block 5 uses, each 0–100.

### The three profiles, and which one each calculation reads

This distinction is load-bearing. Confusing them produces numbers that look right and mean nothing.

| Profile | What it is | Changes during Block 5? |
|---|---|---|
| **PRE** (`originalProfile`) | Built from Blocks 1–4 | **Never** |
| **CURRENT** (`progress.profile`) | Starts as a copy of PRE, moves after each choice | Yes |
| **POST** | CURRENT after scenario 5 | — |

| Calculation | Reads | Why |
|---|---|---|
| Alignment label on the card | CURRENT | A running judgement of who you are now |
| Card order (the planner) | **PRE** | A moving ruler cannot measure movement |
| Stability | PRE vs POST | The point is the distance travelled |
| Position Effect | **PRE** vs each chosen option | Same reason as the planner |

---

## 5. The planner — how the six cards are ordered

### Your advisor's flight example

You must be in City X within 15 hours.

| Option | You pay | You arrive | The trade-off |
|---|---|---|---|
| 1 | $5,000 | on time | Safe, expensive |
| 2 | $10,000 | 2 hours early | $5,000 more for time you did not need |
| 3 | $100 | 3 minutes late | Saves $4,900, misses by 3 minutes |
| 4 | $1 | one day late | Almost free, useless |

There is no ordering that is right for everybody. It depends on limits **you** set beforehand:

- **$1 · one day late** — you said 15 hours. Breaks it at any price → **Blocked** (still choosable)
- **$10,000 · 2 hours early** — a big price for a gain you cannot use → ranked low
- **$100 · 3 minutes late** — saves $4,900. Is 3 minutes "late" for you? → **first, if 3 minutes is
  inside your tolerance**

"15 hours" is your **red line**. Whether 3 minutes counts as late is your **tolerance**. Both come
from answers you already gave.

### The same idea in the study's numbers

Participant whose top value is *gain*, second is *harm*:

```
Option P:  gain 1.00   harm 0.20
Option Q:  gain 0.92   harm 0.95
```

P wins on gain by **0.08**. Q wins on harm by **0.75** — about ten times more. The tree sets gain
aside for this pair, and **Q ranks above P**. The best option on the participant's own top value
does not come first, and it should not. That is flight option 2 again.

### The tree — three questions per pair

```
                Compare option X and option Y
                            ↓
   1. Are BOTH options poor on the top value?  ──yes→  use their ranking
                            ↓ no
   2. Is the gap on the top value REAL?        ──yes→  use their ranking
                            ↓ no
   3. Is the gap on the SECOND value           ──yes→  set the top value aside
      much larger?                             ──no →  use their ranking
```

### Where the tree's numbers come from — nothing is invented

| The tree needs | Plain meaning | Source |
|---|---|---|
| **Red line** | A limit you refused at any price | You said NO at every rung of a Block 3 ladder |
| **Tolerance** | The smallest difference you actually noticed | The width of the ladder step your answer sat in |
| **Exchange rate** | How much more you demand when it gets harder | Extra rungs demanded in Block 3's 2×3 grid |
| **Value order** | Which value matters most | Blocks 1–4, taken as they are |

**When something could not be derived, it was removed rather than defaulted.** That is why
performance plays no part in the card order — nothing in Blocks 1–4 asks whether speed matters
more to you than reversibility.

### From pairs to an order

1. Compare every pair — 15 comparisons for 6 options
2. **Count wins** — how many of the other five did each option beat?
3. Group into **Clear · Costed · Blocked**

**Why count wins instead of sorting.** The tree can say A beats B, B beats C, and C beats A. Real
people compare that way. A normal sort would give a different answer each time it ran; counting
wins always gives the same answer.

**All six cards stay selectable, including Blocked.** A card you cannot choose cannot record that
you were willing to cross your own stated limit — which is one of the things worth observing.

---

## 6. Alignment labels

`policyAlignmentScore` is **one-sided**: an option is penalised only when it delivers *less* than
you demand. You are never marked down for an option that protects the vulnerable *more* than you
asked.

Options are then ranked by that score and labelled **by rank position**, so every scenario always
shows the same spread:

| Rank | Label |
|---|---|
| 1 | Aligned |
| 2 | Weakly aligned |
| 3–4 | Misaligned |
| 5–6 | Strongly misaligned |

**Verified (5 Sept 2026):** 4,000 random profiles × 5 scenarios × 6 options = **120,000 labels**. The shape was correct every single time — exactly 1 Aligned / 1 Weakly / 2 Misaligned / 2 Strongly — and no label ever disagreed with the fit-score order. Shape correct every time, label
order never contradicted the fit score, rank 1 was always the true best fit
(`tools/audit_block5_run.cjs`).

The bottom two tiers are the **CVR trigger** — `isMisaligned()` decides who sees a reflection at
all, and therefore which participants can produce CVR and APA data.

---

## 7. CVR — the reflection, and its two lenses

Shown when the chosen option goes against the participant's own values.

```
                CVR vignette  (Directness view  or  Context view)
                     "Do you still endorse this option?"
                    ↓ YES                        ↓ NO
        A person speaks AGAINST it      A person speaks FOR it
                    ↓                            ↓
        Where you land follows your FINAL position:
        keep it → confirmation page      refuse it → APA page
```

### The two lenses, on the same option

Both use the **same option and the same numbers**. Only the framing differs.

**Directness** — inside the same situation, attributed to you:

> *In the first hours:* "The patient on home oxygen stays in a sealed room. The mask tagged for
> them is on your face."
> *Weeks later:* "They spend three weeks in hospital."
> **"No rule and no system decided this. You did."**

**Context** — the same rule somewhere else, and it never says *you*:

> *In the first hours:* "The patient the ventilator was held for stays in a side room without it."
> *Weeks later:* "They spend three weeks longer in hospital."
> **"A different place. The same rule, and the same result."**

### What each path records

| Your first answer | Then the person spoke, and you… | Where you land | Stakeholder sensitivity |
|---|---|---|---|
| Yes, I still endorse it | kept it anyway | Confirmation | **−25** |
| Yes, I still endorse it | changed your mind | APA | **+25** |
| No, I would not | still did not want it | APA | **−25** |
| No, I would not | changed your mind | Confirmation | **+25** |

A change of mind scores the same in either direction. **What is measured is influence, not
agreement.**

---

## 8. APA — how the profile moves

Only these events change the CURRENT profile, and **the amounts are literal**.

| Event | Value affected | Change |
|---|---|---|
| Keep a misaligned option, and you are sure | The value that option serves | **+30** |
| Keep a misaligned option, but unsure | The value that option serves | **+15** |
| …and the value it went against | Your former top value | **−20 / −10** |
| The affected person changed your mind | Stakeholder sensitivity | **+25** |
| The affected person did not | Stakeholder sensitivity | **−25** |
| Keep an *aligned* option | The value it serves / the one neglected | **+15 / −10** |
| Keep a *weakly aligned* option | Same | **+20 / −15** |

### Worked example — exactly what the code produces

```
before   protecting the vulnerable 20    reducing harm 70    stakeholder 50
after    protecting the vulnerable 50    reducing harm 50    stakeholder 75
next     protecting the vulnerable 80                              stakeholder 50
```

### Why flat, and what it costs

Until 31 August 2026 each delta was scaled by the remaining headroom, so "+30" moved a value at 20
by +24 and a value at 96 by **+1.2**. That was changed because:

1. **The documented constant was never the applied one.** Every description of the rule was
   approximately false, and no reader could check the arithmetic against a stored profile.
2. **It discriminated less.** Measured across 5 profiles × 4 behaviours, Stability separated steady
   from drifting participants by **33 points** under headroom and **42** under flat.

**The cost, which belongs in the write-up:** flat deltas pile up on the ends. About **13%** of
values finish a run sitting exactly on 0 or 100, and once pinned they stop contributing movement —
so a participant who keeps drifting after saturating one value looks slightly steadier than they
were.

### The CLARIFICATION path — what the APA page itself does

The table above covers keeping an option. This is the other path: the participant **refused** their
first choice after the vignette, and the APA page asks them to say what they actually want.

| Trigger | Effect |
|---|---|
| Q1 = *I do put X above Y* | **+15** to the value the option served · **−10** to the value it sacrificed |
| Q1 = *just this situation* | **+5** served · **nothing else** *(see below)* |
| Q1 = *not sure* | nothing |
| Q2 — the value they name | **+30**, and **−20** to whatever is currently top |
| Q2 — confidence 1→5 | scales everything above by **0.6 · 0.7 · 0.8 · 0.9 · 1.0** |
| **The cap** | **no policy value moves more than 30 × that scale**, in either direction |
| Switched after meeting the person | **±25** — deliberately *not* scaled by confidence |
| Q3 — the lens that changed their mind | **+20** to that lens |

Two details a reader will ask about:

- **The −20 is skipped if the named value is already top.** Agreeing with yourself is never punished.
- **"Currently top" is read *after* Q1 is applied**, so Q1 can change where the −20 lands.

**Confidence, worked through** (a value starting at 0, no stacking):

| You answer | It becomes |
|---|---|
| 1 — not sure | 18 |
| 3 | 24 |
| 5 — very sure | 30 |

Asserted by `npm run verify:apa` (18 checks), so this table cannot silently drift from the code.

### Why there is a cap

Nothing stops Q1's bump and Q2's bump landing on the **same value**. Without a cap they add: a
participant who endorses an option *and* names the value it served would receive **+45 × w**, not
the +30 this rule is published as. That is the answer pattern an internally consistent participant
naturally gives, so the published constant would be wrong for the most coherent respondents rather
than the most confused ones.

The cap also protects the confidence rating. Uncapped, from confidence **2** upward a
double-counting participant moves further than one who is completely sure and does not:
+45 × 0.7 = **31.5** against +30 × 1.0. With the cap the largest possible move is 30 × w, which
rises with the rating and nothing else.

It applies to the **four policy values only** — the stakeholder ±25 comes from a separate
behavioural observation and is deliberately unscaled, and at low confidence the cap would clip it.
Asserted by gate **A-APA-8**.

**Full worked audit, six participants and the measurement behind every constant:
[`docs/BLOCK5_APA_AUDIT.md`](BLOCK5_APA_AUDIT.md).**

### Why "just this situation" does not raise the sacrificed value

A fair question about this rule: on screen the answer reads *"overall, [sacrificed] still matters
more to me than [served]"*, so why does naming that value not raise it?

**Because Q2 already carries the statement, and applying it twice is self-defeating.** Q2 subtracts
20 from whichever value is top, and it reads "top" *after* Q1. Any bump here promotes the sacrificed
value towards the top — and so into the path of that decrement.

Measured over 2,500 simulated participants (`npm run apa:variants`):

| bump on the sacrificed value | +10 | **0 — the rule in use** |
|---|---|---|
| Sacrificed value becomes top after Q1 | 87.6% | 76.0% |
| …and the −20 then lands on it | 25.7% | 22.0% |
| **Profile ends up agreeing with what they said** | 71.9% | **79.5%** |
| Values pinned at 0 or 100 | 14.3% | **12.0%** |

A +10 followed by the −20 is a net **loss of 10** on the very value the participant has just said
mattered more. **Lowering it scores worse again** (−5 gives 75.8%) *and* records the opposite of
what they said.

The division of labour is therefore clean: **Q1 records what they did, Q2 records what they want.**
The sacrificed value is carried by Q2, where naming it is worth +30.

`STABILITY_CHURN_CEILING` is **57** — the p99 of the null model under this rule. Gate S7 enforces
the pair.

---

## 9. The measures

### 9.1 VCI — Value Consistency Index

*Did your choices fit your values, judged as they stood at that moment?*

Per scenario, the alignment tier of the final choice becomes a 0–1 credit; VCI is their mean × 100.
Judged against **CURRENT**, so a value taken on mid-block counts from then on.

### 9.2 Stability

*Did your values themselves change?* Two halves:

- **Order** — of the six pairs among four values, how many swapped between start and end
- **Movement** — total distance travelled, summed **scenario by scenario** (churn), not start-to-end

**Why churn and not net drift.** A participant who picks the option furthest from their values in
*every* scenario thrashes and ends up near where they began. Net drift would call that person
*stable*. Churn separates them: 33.2 against 13.6.

```
movementPart = 100 × (1 − min(1, churn / STABILITY_CHURN_CEILING))
```

`STABILITY_CHURN_CEILING = 55`, the p99 of a 4,000-responder null model. It went 65 → 43 when the deck shrank to three scenarios, then 43 → **55** when the workplace pair landed — five scenarios again, but only **four** of them can move the profile, because a wish teaches it nothing. **It moves whenever the
bump sizes or the scenario set move** — it went 42 → 65 when deltas became flat. Gate S7 enforces
the pairing.

### 9.3 Performance

**The problem with the raw composite.** Across the five menus:

| A participant who… | scores |
|---|---|
| takes the **best** option in all five | **69.8** |
| takes an **average** option every time | **64.9** |
| takes the **worst** option every time | **55.8** |

So "Performance 65" looks like a middling mark out of 100 and means **dead average** — and the
whole range is **14 points**. Your H3 uses an equivalence margin of 5 points, which against a
14-point range is **36% of everything that can happen**.

**The fix.** Score each choice against what that scenario actually offered:

```
captured = 100 × (chosen − worst available) / (best available − worst available)
```

| | Before | Now |
|---|---|---|
| Range a participant can cover | 14 points | a true 0–100 |
| Your 5-point margin is | 36% of the range | **5% of the range** |

**And this is what makes averaging across scenarios legitimate**: every term is already a share of
what its own scenario offered, so they share a scale **by construction**, not because the five
menus happen to match.

**Equal weights across the five measures are a declared choice, not neutrality.** Nothing in
Blocks 1–4 asks whether speed matters more than reversibility, so any weighting would be the
study's opinion wearing the participant's name.

### 9.4 Position Effect

*Are you the same person when the cost lands elsewhere?*

> "Am I the same driver alone as I am with my children in the car?"

**Step 1 — distance.** For each scenario:

```
D = (1/4) × Σ | your value − the chosen option's value |     over the four values
```

Real worked example from scenario 1:

| Your value, before Block 5 | You said | The option you chose | Gap |
|---|---|---|---|
| Protecting the vulnerable | 78 | 96 | 18 |
| Reducing harm | 52 | 56 | 4 |
| How much is gained | 34 | 26 | 8 |
| How many are helped | 60 | 39 | 21 |

`18 + 4 + 8 + 21 = 51 ÷ 4 = **12.8**`

Direction is ignored — protecting *more* than you asked is still a move. Only the four values
count; speed and reliability are performance.

**Step 2 — departure.** The same distance as a share of the room that scenario offered (0–100).
Scenario 1's six options sat at `12.8 · 17.5 · 18.0 · 23.8 · 28.0 · 42.5`, so choosing 12.8 used
**0%** of the room. **This is why one choice reads 12.8 on chart 5 and 0 on chart 7 — both true,
different units.**

**Step 3 — the headline.**

```
Position Effect = highest position − lowest
```

**The five positions, one scenario each:**

| | Position | Scenario | Who carries the cost |
|---|---|---|---|
| A | `self` — only me | 1 · chemical release | You. Nobody depends on you. |
| B | `self_and_group` — me and my people | 2 · wildfire | You and the people with you. |
| C | `others` — other people | 3 · cancer doses | Other people. You are not at risk. |
| D | `under_authority` — at work | 4 · the care visits you cut | Your colleagues. Your own hours are safe. |
| E | `receiving_end` — done to me | 5 · the same cut, decided without you | You. Someone else holds the pen. |

**Scenario 5 counts here and nowhere else.** VCI, CVR, APA and Stability all exclude it, because
those four ask what a participant DID and hold them answerable for it, and a wish is not a decision.
This measure is a *distance* — |frozen profile − the option| — and that arithmetic is identical
whether the option was chosen or wished for. It is labelled as a wish everywhere it is shown.

### Is a bigger distance good or bad? **Neither.**

It is a description, not a grade. Somebody who moves may have thought harder, not worse.
**What is a finding is the number changing between positions** — 12.8 alone, 40.5 for strangers.

### The gate that matters most

Measured on the shipping deck across five profile types (`npm run validate:position`):

| Participant type | Position Effect | Drift check |
|---|---|---|
| Same person everywhere | **0** | unavailable |
| Switches by position | **100** | unavailable |
| **Chooses without a pattern** | **100** | unavailable |

The first row separates cleanly from the other two — a 100-point gap, on every profile tested. The
second and third do **not** separate from each other.

**A random responder scores the same headline as a genuine position-shifter.** Only the **drift
check** separates them: when two or more scenarios share a position while sitting at different
points in the sequence, movement across them is drift at a *constant* position. On this deck each
position appears once, so it is unavailable — see the box below. **Never report the headline as
evidence of causation.**

> #### ⚠ There is still no drift check
>
> Each of the five positions appears in exactly one scenario, so no position is held constant across
> the sequence and `driftCheck` returns `null`. Scenarios 4 and 5 hold *different* positions by
> design, so the workplace pair does not supply one either.
>
> **What partly replaces it.** The pair is *content-controlled* — same employer, same decision, same
> six options — so the 4-vs-5 contrast isolates position more cleanly than the drift check ever did.
> Use that pair for any inferential claim about position; treat the five-point Position Effect shape
> as descriptive.
>
> **What this means in practice.** The genuine position-shifter and the random responder are
> **indistinguishable**: both score 100 and nothing in the suite tells them apart. Until a position
> repeats, Position Effect is a *description of what a participant did*, not evidence that position
> caused it.
>
> This is stated in three places so it cannot be missed: the caption under the chart itself, the
> `[SKIP]` banner in `tools/simulate_position.cjs`, and here. The gates re-arm automatically the
> moment any position appears twice — and `driftCheck` now discovers *which* position repeats
> rather than assuming it is `others`, so a deck that repeats `self` would arm it too.

**The menu confound, re-measured on the shipping scenarios:** your choice moves the number **12.8
to 78 times** more than the menu does (worst case 12.8×, gate ≥ 3×).

### 9.4b The workplace pair — four measures nothing else in the study can produce

Scenarios 4 and 5 are **one situation met twice**: the same employer, the same cut, the same six
options, the same numbers. In the first the participant decides and it lands on their colleagues. In
the second someone else decides and it lands on *them*, and they only say what they **wish** would
happen.

Because the content is held exactly constant, **any difference between the two is position and
nothing else.** Every other position contrast in Block 5 compares different scenarios, so a
difference could always be the situation. Here it cannot.

#### The employer's values are chosen for each participant

A fixed set of company values would clash hard with some people and not at all with others — and
those two participants cannot be compared, because they were not asked the same question.

So the employer's stated priority is set to **whichever value the participant scored lowest in
Blocks 1–4**, read from the frozen profile. Everyone works under an employer that prizes the thing
they care least about.

```
deriveCompanyValues(frozenProfile) → the value they hold least → the principle shown on screen
```

*Verified across all five archetypes: the employer always names their weakest value.*

#### 1 · Stance — what they did with values that were not theirs

Two distances from the same chosen option, both computed by the **same function** so they are
comparable:

```
ownDistance     = distance(frozen profile   → chosen option)
companyDistance = distance(employer values  → chosen option)
pull            = ownDistance − companyDistance
```

| Result | Stance |
|---|---|
| `pull > +8` | **Adopted** — took the company's values |
| `pull < −8` | **Resisted** — held their own |
| in between | **Compromised** — split the difference |

The ±8 band matters: reading the sign alone would label someone who landed one point nearer their
employer as having *adopted* its values, which is rounding, not a finding.

#### 2 · Wish alignment

The same four-tier label, applied to the wished-for option. A choice that was **Misaligned** paired
with a wish that is **Aligned** is a *self-serving reversal* — they abandoned their values when it
cost colleagues and returned to them when it cost themselves.

#### 3 · Mirror Gap

```
mirrorGap = departure(scenario 4) − departure(scenario 5)
```

Positive = they moved **further from their own values when they held the pen**. Measured against the
frozen profile, so Block 5's own updates cannot move it.

#### 4 · Responsibility Gap

```
responsibilityGap = vciWished − vciActed
```

Both halves come from **the pair only** — scenario 4 against scenario 5. An earlier version averaged
every decider scenario against the single wish, and reported a 25-point gap for a participant who
wished for *exactly what they chose*; it was reading the other three scenarios, not the change of
chair.

> **Read the two gaps together, never one alone.** They use different profiles by design: the mirror
> gap reads the frozen profile, the responsibility gap reads values *as they stood*, exactly as VCI
> does. Endorsing the company's option in scenario 4 moves the profile toward the company, so the
> wish is then judged against those moved values. A participant can therefore show **mirror gap 100
> and responsibility gap 0**. That is APA working, not the measure failing — but it means the
> responsibility gap **understates** a reversal whenever scenario 4 fired a profile update.

#### What scenario 5 does *not* feed

| Measure | Included? | Why |
|---|---|---|
| VCI | **No** | VCI asks whether your *choices* fit your values. A wish is not a choice. |
| CVR reflection | **No** | Nobody is answerable for a wish. |
| Profile update (APA) | **No** | The profile is taught by decisions. |
| Stability / churn | **No** | Follows APA — this is why the ceiling is 55 and not 65. |
| Position Effect distance | **Yes** | Same arithmetic; labelled as a wish everywhere it is shown. |

#### Two design decisions worth defending

**The wish is taken second, on purpose.** Having already committed, participants lean toward
repeating themselves — so the anchor works *against* finding a gap, and **every gap reported is a
lower bound**. A gap found in spite of that pull is evidence.

**The cards are NOT shuffled between the two halves.** Shuffling was the original plan and was
dropped: the order comes from the planner, so reordering one half would mean the halves differ in
the *decision support* the participant received as well as in position — spending the exact control
the measure is built on. Instead: wish second, no reminder of the earlier choice, and the time on
the wish is recorded (`hurried` flags anything under 12 seconds as recall rather than reflection).

---

### 9.5 How Blocks 1–3 were answered (charts 11–14)

Descriptive only, no composite.

- **Money spread** — *"changed your answer by 5 steps. Longest hold-out: Outside a homeless
  shelter. Gave in soonest: Wealthy financial district."*
- **Lever vs bridge** — *"You needed 3 more steps before pushing a person than before pulling a
  lever — the same outcome, but not the same act."*
- **Group-size axis** — a line that rises, falls or stays flat is coherent; one that does **both**
  is flagged
- **Deliberation** — median seconds per answer; below **2.5 s** the text cannot have been read

**Answering differently in different contexts is not inconsistency** — it is the sensitivity this
study measures. Only the zig-zag and the speed are named as problems.

### 9.6 Satisfaction and regret — kept apart

Your advisor's example: *"I'm very satisfied that I ate the cake, because it was delicious, but I
regret eating it, because I probably shouldn't have."*

Until 1 September the regret item was **reverse-scored into satisfaction**, which made regret the
arithmetic opposite of satisfaction *by construction*. The cake person could not exist in the data
— they scored **5.0** satisfaction instead of 7, pulled down purely by their own regret.

Now two separate subscales. Verified against the real scorer:

| Participant | Satisfaction | Regret |
|---|---|---|
| **Cake — satisfied AND regretful** | **7** | **7** |
| Satisfied, no regret | 7 | 1 |
| Dissatisfied and regretful | 1 | 7 |

---

## 10. The data you collect — data dictionary

### The one thing to know

**Everything you will analyse lives in `vrds_feedback_archive`.** When a participant presses
Finish, `localStorage.clear()` runs and only that key is preserved. One entry per completed
participant, joined by `session_id`.

> **This was broken until 2 September 2026.** The archive stored a Block-5 *summary* plus the
> *string* `"block5_public_emergency_results"`, and `buildParticipantRecord()` — which assembles
> the raw Blocks 1–4 answers — was written, documented, and **never called**. Every completed
> participant therefore left behind their questionnaire and a few headline scores while **every
> money-ladder answer, every trolley threshold, the whole six-cell workforce matrix and the full
> Block-5 result were destroyed on the way out.** If you ran a pilot before that date, those rows
> are not recoverable.

### Record structure

```
FeedbackRecord
├── session_id              join key across everything
├── experiment              constant id
├── schemaVersion           bump when the shape changes
├── completedAt             ISO timestamp
├── timing                  per-stage durations
├── block5                  headline numbers + per-scenario telemetry (a SUMMARY)
├── participant             ← RAW BLOCKS 1–4 + what was derived from them
│   ├── raw.block1Money         thresholds + every click, with timestamps
│   ├── raw.block2Trolley       lever + bridge thresholds, history
│   ├── raw.block3AIWorkforce   six-cell matrix, history
│   ├── raw.block4Reflection    decisions before/after the voices
│   ├── derived.moralProfile        the interim snapshot
│   ├── derived.aiWorkforceAnalysis Block 3 quantities
│   ├── derived.thresholdTree       seven ranked sensitivities
│   └── derived.block5Profile       the four values Block 5 actually ran on
├── block5Full              ← THE COMPLETE BLOCK-5 RESULT
│   ├── scenarioResults[]       one per scenario: choice, rank, alignment, CVR/APA, telemetry
│   │   └── decisionRole        "decider" | "recipient"  ← NEW, see below
│   ├── originalProfile         PRE — frozen
│   ├── userProfile             POST
│   └── vci / stability / performanceCaptured
└── feedback
    ├── cvr / apa / decisionSupport
    └── wellbeing.subscales     including decisionSatisfaction and decisionRegret separately
```

**`raw` vs `derived`:** raw is what the participant did and can never be recomputed. Derived is
what the model made of it and **can** be recomputed. Storing both means a future change to a
formula can be applied retrospectively — you re-derive rather than re-recruit.

### `decisionRole` — the one field to filter on before any analysis

Every scenario result now carries **`decisionRole`**, and it separates two things that look alike in
a spreadsheet and are not alike at all:

| Value | Meaning | Counts toward |
|---|---|---|
| `"decider"` | The participant chose, and bears it | VCI, Stability, APA, CVR |
| `"recipient"` | The participant only **wished** | Position Effect distance only |

It is written onto the row rather than looked up from the scenario list, so an exported file stays
self-describing: an analyst in two years can tell choices from wishes without needing the scenario
definitions that were live at the time.

**In practice:** filter `decisionRole == "decider"` for anything about behaviour. The single
`"recipient"` row is the wish, and it belongs in the mirror comparison (§9.4b), not in an average.

On a recipient row, `cvrFired` is `false`, `cvrCoordinate` is absent, and `cvrEndorsement` is
`"n/a"` — no reflection ran. **This was wrong until 5 September 2026**: those rows recorded
`cvrFired: true` and carried a coordinate for a reflection that never happened, so any filter on
`cvrFired` would have counted them in. Pilot data collected before that date has the bug.

**The four workplace-pair measures are computed, not stored.** Stance, wish alignment, mirror gap
and responsibility gap are all derived from these rows on demand (`block5Company.ts`,
`block5Mirror.ts`), so a change to any of their formulas can be applied to data already collected.

### LocalStorage keys during a session

| Key | Holds | Survives Finish? |
|---|---|---|
| `vrds_feedback_archive` | **Every completed participant** | **Yes** |
| `vrds_session_id` | Anonymous join key | recreated |
| `money_block_results` | Block 1 | no — copied into the archive first |
| `trolley_block_results` | Block 2 | no — copied first |
| `ai_workforce_block_results` | Block 3 | no — copied first |
| `block4_reflection_results` | Block 4 | no — copied first |
| `block5_public_emergency_results` | Block 5 | no — copied first |
| `experiment_flow_stage` | Which page to resume on | no |
| `vrds_stage_timings` | Per-stage durations | no — copied first |
| `theme` | Light/dark preference | yes |

### Key fields for analysis

| Field | Meaning |
|---|---|
| `scenarioResults[].selectedRank` | **The main DV.** Which planner rank they chose (1–6) |
| `scenarioResults[].alignmentLevel` | The tier of that choice |
| `scenarioResults[].performanceCaptured` | 0–100 within that scenario |
| `scenarioResults[].cvrEndorsement` | Whether they kept the option after reflection |
| `scenarioResults[].stakeholderGuided` | Whether the affected person changed their mind |
| `scenarioResults[].alignedToOriginal` | Alignment vs the **frozen** profile |
| `originalProfile` | PRE — the anchor for Stability and Position Effect |

---

## 11. The gates that keep it honest

`npm run validate:block5` runs all of these. **Never edit a formula without re-running them.**

| Gate | Checks |
|---|---|
| `validate_block5.cjs` | Scenario content: every option wins somewhere, none dominated, numbers live in `factBase` |
| `validate_block5_metrics.mjs` | Every metric spreads ≥ 30 points across a scenario |
| `simulate_vci.cjs` | VCI discriminates |
| `simulate_stability.cjs` | Stability + **S7: the churn ceiling still matches the null p99** |
| `validate_cvr_lenses.cjs` | Both lenses carry equal weight; the context lens never says "you" |
| `simulate_position.cjs` | Menu confound; drift vs random responder separation |
| `test_planner.cjs` | 22 behavioural assertions on the trade-off tree |
| `simulate_planner.cjs` | Card orders discriminate across 72 synthetic participants |
| `audit_block5_run.cjs` | Labels and profile movement across full runs (run manually) |

---

## 12. Limitations to state in the write-up

Say these before an examiner finds them.

1. **Position is confounded with sequence.** "For others" is always last. The drift check is a
   partial control, not a fix. **Report it beside every position claim.**
2. **n = 1 for two positions.** One scenario each for "alone" and "with dependents", three for
   "others".
3. **Ceiling pile-up.** ~13% of values finish pinned at 0 or 100 and stop contributing movement.
4. **Six invented constants in the profile update** (+30, +15, −20, −10, ±25, and the keeps).
   Nothing in Blocks 1–4 derives them. The planner refuses to invent constants; **the profile
   update does not, and that is an inconsistency in the project's own standard.**
   → The defensible framing: APA's update is the **intervention** (identical constants for
   everyone, so it cannot bias a between-participant comparison). Position Effect is the
   **constant-free** measure. Report Stability as *"how far the system's model of this participant
   moved"*, not as a fact about their morality.
5. **The stakeholder ±25 has no measurement behind it.** It is large enough that two non-switches
   pin a participant at the floor, and it is the one constant in the profile update that was never
   sized against anything. Being unscaled by confidence is deliberate — it is behavioural, not
   self-reported — but the magnitude is judgement alone.
6. **11.9% of policy values sit at 100 after a clarification.** The cap reduces saturation but
   cannot remove it; flat deltas on a bounded scale always pile up at the ends. See
   [`docs/BLOCK5_APA_AUDIT.md`](BLOCK5_APA_AUDIT.md) §7.
7. **Within-ladder coherence is unmeasurable.** The interface enforces monotonicity, so any such
   score would read 100% for everybody.
8. **Stability and behavioural distance are not redundant** (r = −0.17 across 600 simulated
   participants) — they answer different questions, so report both.
9. **The explanation panel is itself an intervention.** Shown identically to everyone, so it cannot
   differ by condition, but it adds information before the choice and may lengthen deliberation (your H4).

---

## 13. Suggested improvements

Ordered by value. None are implemented.

### High value

**0 · Size the stakeholder ±25 against something.** Every other constant in the profile update has
at least a shape argument behind it; this one is judgement alone, and it is large enough that two
non-switches pin a participant at the floor. Either derive it from Block 4's observed switch rate or
state plainly in the write-up that it is set by hand. **Anything that changes it must re-run
`npm run verify:apa` then `npm run validate:block5` — the churn ceiling (56) is calibrated
against current APA behaviour.**

**1 · Delete the dev restart button before launch.**
`src/components/dev/` and two lines in `src/App.tsx`. It cannot ship (`import.meta.env.DEV` folds
it out of a production build, verified by grepping `dist/`), but delete it anyway.

**2 · Export the archive to a file, not just localStorage.**
Right now the archive lives in one browser. A lost browser profile is lost data, and localStorage
caps around 5–10 MB (~20 KB per participant, so roughly 250–500 participants). Add a
"Download all records (JSON)" button on the feedback page. **This is the single highest-value
thing left.**

**3 · Decide whether Position Effect appears on the summary page.**
Currently charts-only, which you chose so a strong statement about moral consistency does not sit
immediately above the feedback form. Worth revisiting once you see pilot data.

### Medium value

**4 · Widen the performance spread in scenarios 1 and 2.** *(cancer done, 4 Sept 2026)*
Three options land within 4 points, so `captured` barely discriminates there:

```
chemical_release_escape        100 · 99 · 96 · 73 · 55 ·  0   ← still bunched
wildfire_household_evacuation  100 · 99 · 78 · 72 · 68 ·  0   ← still bunched
cancer_treatment_allocation    100 · 79 · 60 · 41 · 21 ·  0   ← fixed; the shape you want
```

Cancer was recalibrated on 4 September: its ladder was `100 · 85 · 63 · 62 · 60 · 0` — a minimum
gap of **1 point**, so for half the menu the performance reading carried no information at all. It
is now a minimum gap of **19**, wider than any scenario the study has ever had. Only the *spacing*
was designed: every number still traces to a sentence printed on its own card, and four of the
edits were made because the prose already demanded them (see the calibration note at the top of
the cancer scenario in `block5Scenarios.ts`).

The same treatment is still owed to chemical and wildfire. Arguably their bunching is a *feature*
— morally different options achieving similar performance is a clean control for H3 — but decide
that deliberately rather than by accident.

**5 · Restore the drift check.** *(now urgent — see the changelog)*
With flood and water removed, every position appears exactly once, so `driftCheck` returns null
and the within-position control is **gone**. This was previously a "nice to have"; it is now the
single biggest hole in the design, because a genuine position-shifter and a random responder both
score Position Effect 100 and nothing separates them. Either the replacement scenarios must repeat
a position, or Position Effect must be reported as descriptive only. Both the visualisation
caption and `tools/simulate_position.cjs` already say so out loud.

**6 · Report the direction of value drift, not just the size.**
Already computed (`valueDrift` per position) but only surfaced as one sentence. A small
four-value diverging bar chart per position would show *which* values moved and which way.

### Low value / think about it

**7 · A per-scenario regret question.** Regret is currently measured once, at the end, about the
whole experiment. The advisor's cake example is about a *specific* decision. One regret item per
scenario would let you tie regret to the choice that caused it — at the cost of five more
questions and possible demand characteristics.

**8 · Derive the bump sizes from Block 3's exchange rate** so they stop being invented. It sounds
right, but there is **no justified mapping** from "demanded 2 extra rungs for a larger group" to
"moves 30 points when endorsing". Inventing that mapping would be the same problem in a better
disguise. Only do this if you can defend the mapping independently.

**9 · A second coder for the scenario content.** Strengthens the methods chapter; costs a person.

### Things that do not currently make sense — worth your judgement

- **`block5Ranking.ts`** appears to be superseded by `block5Planner.ts` but still exists. If it is
  dead, delete it; if it is live, document which one governs.
- **`blocksLegacyMethodology.ts`** carries switches for older methodologies (`SHOW_STAKEHOLDER_PAGE`,
  the bridge-ladder start rule). Fine to keep, but the write-up must state which setting was used
  for the data you collected — a reader cannot tell from the results alone.
- **Two performance numbers still coexist**: the raw composite (`performanceScore`) and the
  captured score. Both are stored, which is right, but be explicit in the thesis about which one
  every reported figure uses.

---

## 14. The Block 5 interface, and the tools around it

### 14.1 The scenario intro page

Each Block-5 scenario opens on a **full-screen intro** (`Block5ScenarioIntro.tsx`) carrying the
scene, the situation, the participant's role, and — in scenarios 4 and 5 — the employer's published
principle. **The options are deliberately absent.**

*Why:* the participant's POSITION is the thing Block 5 varies, and on a combined page a participant
can start comparing options before taking in who they are. A manipulation half the sample skims is a
manipulation half the sample did not receive.

- The continue button is disabled for **6 seconds** — a guard against the reflex click, not a
  comprehension test.
- Time spent is recorded as `introSeconds` on each scenario result, so a skimmer can be identified
  in analysis without the interface policing anyone.

### 14.2 The morph transition

The intro's cards travel and shrink onto their counterparts in the scenario sidebar
(`block5Morph.ts`), so the material just read takes up residence beside the options rather than
being replaced by an unfamiliar screen.

- Built as **FLIP** (measure-and-move) rather than the View Transitions API, which Firefox does not
  support. A study is taken by whoever turns up, and "the animation silently does not happen for
  some participants" is a difference nobody chose.
- **`prefers-reduced-motion` is honoured** — those participants get no animation at all. Large
  sliding transitions are a known vestibular trigger.
- Every failure path still advances the participant: if the animation cannot run, the flow
  continues on a timer rather than stranding anyone on a half-faded screen.

### 14.3 The employer principle card

Scenarios 4 and 5 show what the participant's employer has published: an institutional slate
letterhead, a large quote, and the company's value named in **bold amber italic**.

It is deliberately **not** tinted with the scenario accent — an employer's demand rendered in the
interface's own colour reads as the interface agreeing with it.

**It shows no numbers.** The participant's own priorities sit on screen immediately below it, so the
comparison is theirs to draw — which is also what the study is trying to measure. A number here
would additionally have to choose between the frozen and the live profile, and either choice puts
two different figures for the same person on one screen.

*Which value the company champions is read from the frozen pre-Block-5 profile*, so the employer
cannot change its principle between scenarios 4 and 5.

### 14.4 Scroll behaviour around the intro

The intro is a fixed overlay, and the scenario page behind it is **frozen** while it is up, then
reset to its top **before** the morph measures anything. The transition reads where each destination
card sits in the viewport, so both the freeze and the reset are load-bearing: a scrolled page would
send the cards to the wrong place and drop the participant into the middle of the option list.

### 14.5 The confidence rating sits with Question 2

The rating sits directly beneath the value it scales. Its label reads *"How sure are you about your
answers on this page?"*, because it scales Q1's bumps as well as Q2's.

### 14.6 Value names

The four values are shown as **how much is gained · how many are helped · protecting the
vulnerable · reducing harm**, used identically in the interface, the planner prose, the vignettes
and the exports. "Reducing harm" names what the participant is choosing rather than the problem
they are choosing about.

### 14.7 The APA tools

| Command | What it does |
|---|---|
| `npm run verify:apa` | 18 assertions on the APA arithmetic, including the published confidence table. Chained into `validate:block5`. |
| `npm run apa:personas` | Runs six differently-answering participants through the real code and prints what moved. Read-only. |
| `npm run apa:walkthrough` | Follows ONE participant through CVR and APA, and prints how scenario 2's option labels change as a result. Read-only. |
| `npm run apa:variants` | Compares candidate sizes for the Q1 constants against what the participant actually claimed. Asserts it reproduces the shipped function before reporting. Read-only. |

The rule is stated in prose in several places. Prose is a claim; these turn it into a test.

---

*Every number in this document was measured on the scenarios and formulas that ship. If you change
a formula, re-run `npm run validate:block5` and update the affected section here.*
