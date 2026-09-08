# Value Consistency Index (VCI) — change plan

**Status:** APPROVED AND IMPLEMENTED, 2026-08-25. Section 8 holds the measured before/after.
**Scope:** VCI only. **Stability is deliberately excluded** and will be discussed separately.
**Written:** 2026-08-25

---

## 1. What VCI is supposed to answer

> *Across the five Block-5 scenarios, did this participant choose options that fitted their own
> values — judged against their values **as they stood at that moment**?*

The profile is not fixed. It moves as the participant makes choices, which is the point of the
block. VCI therefore has to be judged against a moving target, and that is correct.

---

## 2. What is wrong today

### 2.1 The reward for a genuine endorsement is paid twice

When a participant picks an option that clashes with their values and then says *"yes, I genuinely
endorse this"*, two separate things happen:

1. **Their profile moves.** The endorsed value gains **+30**, the value it displaced loses **−20**
   (`applyEndorsementUpdates`). From the next scenario onward, options built on that value are
   labelled aligned or weakly aligned — so choosing it again scores full credit, naturally.
2. **That same scenario's VCI score jumps** from 0.35 to 0.9, via
   `Math.max(BASE_CREDIT[level], reflectiveCredit(endorsement))`.

Step 1 is the design working as intended. Step 2 pays for the same act a second time.

### 2.2 What that lets through

Because the reflective credit is re-earned every time a participant goes against their (newly
moved) profile, a participant who changes what they value **in every single scenario** collects
0.9 five times over.

| Participant | Behaviour | VCI today |
|---|---|---|
| Mixed-loyal | always picks a fitting option | 90 |
| **Flip-flopper** | **a different clashing value every scenario**, endorses each one | **90** |
| **Contrarian** | **always picks the option furthest from their values** | **90** |

The two least consistent participants possible score the same as a consistent one. The single
thing VCI exists to detect is the thing it currently cannot see.

### 2.3 A second, smaller problem

`BASE_CREDIT` gives a second-best-fit option only **0.75**. A participant who always stays inside
their own top two options — never once choosing against themselves — cannot reach 100.

---

## 3. The change

### 3.1 The scale

`scenarioVciScore` stops consulting the endorsement. It becomes the base credit alone:

| What the participant chose | Credit |
|---|---|
| their best-fit option (*aligned*) | **1.00** |
| their second-best option (*weakly aligned*) | **0.85** |
| *misaligned* | **0.35** |
| *strongly misaligned* | **0.00** |

VCI = mean of the five scenario credits × 100.

`reflectiveCredit()` and the `Math.max` are deleted.

**Chosen deliberately over the alternative** of treating best-fit and second-best as equal (both
1.00). That variant would give every "stayed inside my top two" participant a flat 100 and lose
the distinction between *always picked my favourite* and *always picked my second favourite*.
Option B keeps that distinction at a cost of 15 points.

### 3.2 No data is lost

The raw answer is already stored separately as `cvrEndorsement` on each scenario result
(`"strong" | "weak" | "no" | "n/a"`). Removing it from the VCI *formula* does not remove it from
the *record*. Every analysis that wants to relate endorsement to behaviour can still do so, and
the participant record carries it unchanged.

### 3.3 The profile bump, corrected

Raised in review: *"if the user keeps the best-fit option, why decrease the old value by −10? The
best-fit value is the same as the top value."*

Correct, and the current proposal was wrong. Two guards are needed.

**Guard 1 — never subtract from the value just raised.** The CVR path already does this
(`if (displaced && displaced !== endorsed)`). The keep path must do the same.

**Guard 2 — only subtract from a value the option genuinely neglects.** `displacedTopValue()`
looks for the highest-scoring value this option falls short on by more than 5 points — which is
right — but if the option falls short on *nothing*, it falls back to returning the top value
anyway. That fallback must return `null` instead, so an option that satisfies every value costs
the participant nothing.

The corrected rule:

| The participant keeps | Its main value | A value the option actually neglects |
|---|---|---|
| their **best-fit** option | **+15** | **−10**, or nothing if it neglects none |
| their **second-best** option | **+20** | **−15**, or nothing if it neglects none |

**Why the second row moves further.** Keeping your top option tells the system almost nothing it
did not already believe. Keeping your **second** tells it the ordering may be wrong, so it should
move further. This is what makes the value you picked climb toward the top and the previous top
settle beneath it — the behaviour asked for in review.

**Honest limit.** This cannot guarantee the picked value becomes #1 after exactly one choice.
Which options count as fitting depends on all four values together
(`policyAlignmentScore` is threshold satisfaction across the set), not on one value alone. What it
does guarantee is a decisive move, typically overtaking within one or two scenarios. Forcing a
guaranteed swap would make the profile jump, and since the CVR aims at whichever value is on top,
the reflection questions would jump with it.

### 3.4 What the participant is told

The current wording on the results card is about to become false:

> "How consistent your final choices were with your evolving values. **A choice you firmly stood
> by after a recontextualization still counts as consistent.**"

Replaced with:

> "How often your choices matched your own values — judged against your values as they stood at
> that moment. Your values update as you go, so a value you take on during the block counts from
> then on."

---

## 4. What this produces

| Participant | Behaviour across the five scenarios | Now | After |
|---|---|---|---|
| **Loyal** | always the best fit | 100 | **100** |
| **Near-loyal** | always the second best fit | 75 | **85** |
| **Mixed-loyal** | mixes best and second-best | 90 | **94** |
| **Convert** | goes against their values once, genuinely endorses, then stays true to that new value | 98 | **87** |
| **Hesitant convert** | the same, endorsed with doubt, so the value climbs more slowly | 87 | **84** |
| **Flip-flopper** | a different clashing value every scenario | 90 | **35** |
| **Contrarian** | always the furthest option | 90 | **0** |

The Convert drops from 98 to 87 and that is intended: in Scenario 1 they genuinely did choose
against their measured values. The system stops pretending otherwise — and then stops holding it
against them, because from Scenario 2 the value is really theirs.

---

## 5. How this gets verified, not just asserted

The table above is a claim. It becomes a test.

**New: `tools/simulate_vci.mjs`.** Runs synthetic participants — one per row above — through the
*real* `labelOptions`, `applyValueBump`, `applyEndorsementUpdates` and `scenarioVciScore`, over
the real five scenarios, and prints each one's VCI. Added to `npm run validate:block5`, with
assertions:

| ID | Gate |
|---|---|
| **V1** | Loyal scores 100. |
| **V2** | Near-loyal scores ≥ 80 — staying inside your own top two is consistent behaviour. |
| **V3** | Flip-flopper scores < 50 — *the gate that today's code fails.* |
| **V4** | Contrarian scores < Flip-flopper — never fitting is worse than sometimes fitting. |
| **V5** | Convert scores ≥ 80 — a genuine change of heart, held to, is consistent. |
| **V6** | Convert > Hesitant convert — doubt should cost something. |
| **V7** | Keeping a best-fit option built on your top value never lowers that value (the review's objection, as an executable check). |

Run against the current code first, to confirm V3 and V4 fail — a gate that cannot fail is not a
gate.

---

## 6. Files touched

| File | Change |
|---|---|
| `block5CVR.ts` | `scenarioVciScore` drops the endorsement argument; delete `reflectiveCredit`; `BASE_CREDIT` weakly-aligned 0.75 → 0.85; `displacedTopValue` returns `null` when nothing is neglected; `applyValueBump` gains the displacement with both guards. |
| `Block5PublicEmergencySimulation.tsx` | two `scenarioVciScore(...)` call sites; the keep-path bump becomes +15 / +20 by level. |
| `Block5SimulationSummaryPage.tsx` | the VCI hint text. |
| `tools/simulate_vci.mjs` | new. |
| `docs/MEASUREMENT_MODEL.md` | the VCI section. |

**Not touched:** `computeStability`, `alignedToOriginal`, and everything else on the Stability
side. Deferred by request.

---

## 7. Two things to settle, and one to note

1. **`consistencyLevel()` is shared between VCI and Stability.** Under the new scale the top band
   (85+, "Highly consistent") holds 85, 87, 94 and 100 — four quite different participants get the
   same word. I would give VCI its own bands, but that function is shared with Stability, so I
   propose leaving it alone until the Stability discussion and revisiting both together.

2. **Should a *misaligned* choice score 0.35 at all?** It is currently partial credit for picking
   your third or fourth best fit. Keeping it means Flip-flopper lands at 35 rather than 0. I
   recommend keeping it — it distinguishes "chose badly" from "chose the worst possible thing" —
   but it is a free parameter and worth one sentence in the methods chapter.

3. **This is a measurement change.** No data is collected yet, so nothing is invalidated. It must
   land before launch.

---

## 8. Measured result

Not predicted — measured, by running each participant through the real scoring code
(`npm run validate:vci`).

| Participant | Before | After | Predicted |
|---|---|---|---|
| Loyal | 100 | **100** | 100 |
| Near-loyal | 75 | **85** | 85 |
| Mixed-loyal | 90 | **94** | 94 |
| Convert | 93 | **84** | 87 |
| Hesitant convert | 87 | **84** | 84 |
| **Flip-flopper** | **90** | **35** | 35 |
| **Contrarian** | **90** | **0** | 0 |

The gates were run against the old code first and **V2 and V3 failed there**, which is the point:
a gate that cannot fail proves nothing.

### Two honest notes

**Convert and Hesitant convert both land on 84.** The plan predicted 87 and 84. The +30 vs +15
difference between a genuine and a doubtful endorsement did move their profiles by different
amounts — but not by enough to change which *alignment band* their later choices fell into, so
the VCI came out identical. Gate V6 passes only because it is written `>=`. The distinction is
real in the profile and in the stored `cvrEndorsement`; it is simply not always visible in VCI.
Whether that matters is a question for the Stability discussion, where the same profile movement
is the thing being measured.

**Convert came out at 84, not the predicted 87**, because scenario 2 landed on *weakly aligned*
(0.85) rather than *aligned* (1.00) — the +30 bump is scaled by headroom (`bump()`), so a value
that is already fairly high climbs more slowly than a flat +30 would suggest. The ordering the
plan argued for is unaffected.

## 9. Files changed

`block5CVR.ts` — `scenarioVciScore(level)` drops the endorsement; `reflectiveCredit` deleted;
weakly-aligned credit 0.75 → 0.85; `displacedTopValue` returns `null` when the option neglects
nothing; `applyValueBump` replaced by `applyKeepUpdates` (+15/−10 best-fit, +20/−15 second-best,
both guards).
`Block5PublicEmergencySimulation.tsx` — two call sites, and the keep path now delegates to
`applyKeepUpdates` instead of holding the point values in the UI layer.
`Block5SimulationSummaryPage.tsx` — the VCI hint no longer claims a firmly-endorsed clashing
choice counts as consistent.
`tools/simulate_vci.cjs`, `tools/tsconfig.sim.json` — new; chained into `npm run validate:block5`.

**Stability untouched**, by request: `computeStability` and `alignedToOriginal` are exactly as
they were.
