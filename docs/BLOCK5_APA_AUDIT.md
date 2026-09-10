# The APA — what the follow-up questions do to a profile

**Reproduce every number here:**
`npm run verify:apa` (19 assertions) · `npm run apa:personas` (§3) · `npm run apa:variants` (§5) ·
`npm run apa:walkthrough` (one participant end to end)

---

## 0. What this document is for

The APA rule fits in a sentence:

> *+30 to the value you name, −20 to the value currently on top, everything scaled 0.6–1.0 by how
> sure you say you are, and no value moves more than 30 × that scale in one clarification.*

A sentence is a claim. This document is the measurement behind it: what the questions are, what each
one applies, what happens to six different people who answer differently, and where the mechanism is
still weak.

---

## 1. What the APA asks

The APA page is reached only when a participant **refuses** the option they first chose, after
seeing the CVR short story. It records four things — three questions and one observation.

| # | What is asked | Answers |
|---|---|---|
| **Q1** | *"When you made this choice, which is closer to the truth?"* | *I do put X above Y* · *I chose it for this particular situation* · *I'm honestly not sure* |
| **Q2** | *"Pick the one value you most want the system to weight for you"* — plus **"How sure are you about your answers on this page?" (1–5)** | one of the four values, and a confidence rating |
| **Q3** | *"Which view most changed your mind?"* — shown **only** if they opened the second lens | Directness · Context |
| **—** | **Not asked.** Whether they switched after meeting the affected person | observed, not self-reported |

Q3 is conditional, so most participants answer three things, not four.

---

## 2. The exact rules

| Trigger | Effect |
|---|---|
| Q1 = *I do put X above Y* (endorse) | **+15** to the value the option served · **−10** to the value it sacrificed |
| Q1 = *just this situation* (context) | **+5** to the value served · **nothing else** *(see §5)* |
| Q1 = *not sure* | nothing |
| Q2 — the value named | **+30**, and **−20** to whichever value is currently top |
| Q2 — confidence 1 → 5 | multiplies everything above by **0.6 · 0.7 · 0.8 · 0.9 · 1.0** |
| **The cap** | **no policy value moves more than 30 × that scale**, in either direction *(see §4)* |
| Switched after the person | **±25** to stakeholder sensitivity — never scaled, never capped |
| Q3 — lens named | **+20** to that lens's sensitivity |

Three details a reader will ask about:

- **The −20 is skipped when the named value is already top.** Agreeing with yourself is never
  punished.
- **"Currently top" is evaluated *after* Q1 has been applied**, not before. Q1 can therefore change
  which value the −20 lands on.
- **The cap applies to the four policy values only.** The stakeholder move comes from a separate
  behavioral observation and is deliberately unscaled; at low confidence the cap would clip it
  (30 × 0.6 = 18 against a ±25 move) and quietly alter a different measure.

All five shipped scenarios run at `stakesWeight = 1`, so nothing else scales these numbers.
(Asserted by gate **A-APA-1**.)

### What confidence is worth

A value starting at 0, with the participant naming it in Q2:

| You answer | It becomes |
|---|---|
| 1 — not sure | 18 |
| 2 | 21 |
| 3 | 24 |
| 4 | 27 |
| 5 — very sure | 30 |

Asserted by **A-APA-3**, so this table cannot drift from the code without a test failing.

---

## 3. Six participants, same start, different answers

Every persona begins from the **identical** profile, so every difference below is caused purely by
their answers.

```
START (all six)   gained 79 · helped 66 · harm 60 · vulnerable 30
Order             gained > helped > harm > vulnerable
Option refused    "Take the sealed respirator the clinic had reserved"
                  serves: how much is gained   ·   sacrifices: reducing harm
```

| | Their answers | What moved | Next scenario sees |
|---|---|---|---|
| **A** | endorse · sure **5** · names *vulnerable* · switched · Context lens | vulnerable **30→60 (+30)** · gained −5 · harm −10 · context +20 · stake +25 | `gained > helped > vulnerable > harm` — **order changed** |
| **B** | endorse · **not sure 1** · names *gained* (already top) · no switch | gained **79→97 (+18)** · harm −6 · stake −25 | `gained > helped > harm > vulnerable` — unchanged |
| **C** | just-this-time · sure **5** · names *harm* · switched | harm **60→90 (+30)** · gained −15 · stake +25 | `harm > helped > gained > vulnerable` — **order changed** |
| **D** | not sure · mid **3** · names *helped* · no switch | helped **66→90 (+24)** · gained −16 · stake −25 | `helped > gained > harm > vulnerable` — **order changed** |
| **E** | not sure · sure **5** · names *vulnerable* · switched · Directness lens | vulnerable **+30** · gained **79→59 (−20)** · direct +20 · stake +25 | `helped > vulnerable > harm > gained` — **order changed** |
| **F** | just-this-time · **not sure 1** · names *vulnerable* · no switch | vulnerable **30→48 (+18)** · gained −9 · stake −25 | `gained > helped > harm > vulnerable` — unchanged |

**Four of six re-rank**, which is what matters: the alignment label a participant sees in the *next*
scenario is read off this order, not off the raw scores.

**None of the six reaches 100.** Persona B is the most extreme case — endorsing a choice built on
the value they already hold highest — and stops at 97 because of the cap.

---

## 4. Why there is a cap

Nothing stops Q1's bump and Q2's bump landing on the **same value**. Without a cap they add:

| Answer pattern | Q1 | Q2 | Would apply |
|---|---|---|---|
| Endorses the option **and** names the value it served | +15 × w | +30 × w | **+45 × w** |

This is what an **internally consistent participant naturally answers** — someone who defends a
choice tends to go on to name the value that choice protected. So without the cap, the published
constant would be wrong for the most coherent respondents rather than the most confused ones.

**The cap also protects the confidence rating.** Uncapped, from confidence **2** upward a
double-counting participant moves further than one who is completely sure and does not:
45 × 0.7 = **31.5** against 30 × 1.0 = **30**. That is precisely backwards. With the cap the largest
possible move is 30 × w, which rises with confidence and nothing else.

**It is applied to the net change, not to each bump.** The bumps are not independent — the −20 is
meant to be able to cancel part of a +30. Capping each separately would leave the sum uncapped and
change nothing.

Asserted by gate **A-APA-8**, swept across every answer combination, both stakeholder answers and
all five confidence levels.

---

## 5. Why "just this situation" does not raise the sacrificed value

A fair question about this rule: on screen the answer reads *"overall, [sacrificed] still matters
more to me than [served]"*, so why does naming that value not raise it?

**Because Q2 already carries the statement, and applying it twice is self-defeating.** Q2 subtracts
20 from whichever value is top, read *after* Q1. Any bump here promotes the sacrificed value towards
the top — and so into the path of that decrement.

Four sizes were measured over 2,500 simulated participants, scored on the only claim the participant
makes: that the sacrificed value outranks the served one.

| bump on the sacrificed value | profile ends up agreeing | at the ceiling | −20 lands on it |
|---|---|---|---|
| +10 | 71.9% | 12.1% | 25.7% |
| +5 | 78.5% | 12.0% | 24.2% |
| **0 — the rule in use** | **79.5%** | **11.9%** | 22.0% |
| −5 | 75.8% | 10.6% | 20.2% |
| +10, "top" read before Q1 | 79.8% | 12.0% | 23.2% |

A +10 promotes the sacrificed value to top **87.6%** of the time, against 76.0% at 0 — and +10
followed by −20 is a net **loss of 10** on the value the participant has just defended.

**Lowering it is worse still**, and not only on the numbers: −5 would record the opposite of what
the participant said.

**Why 0 rather than reading "top" before Q1**, which ties on fidelity (79.8%): zeroing is the
smaller rule, and one fewer invented constant.

So the division of labor is clean: **Q1 records what the participant did, Q2 records what they
want.** The sacrificed value is carried by Q2, where naming it is worth +30.

---

## 6. What works

- **The ordering changes.** The decrement is what lets a value at 0 overtake values at 100. Four of
  the six personas in §3 re-rank.
- **Confidence behaves.** A low rating gives a small move (persona F: +18, no re-ranking), and the
  largest possible move rises with the rating and nothing else.
- **Naming your current top never costs you.** The decrement is skipped in that case.
- **The framing measures stay clean.** The lens and stakeholder dimensions move independently of the
  four policy values, so they are not contaminated by the priority question.
- **The published rule is the applied rule.** The cap makes "+30 × confidence" the true maximum for
  every participant on every answer path.

---

## 7. Where it is still weak

### 7.1 The ceiling

**11.9%** of policy values sit at 100 after a clarification, and about **13%** finish a full
five-scenario run pinned at 0 or 100 (guide §12.3). A pinned value cannot show further endorsement,
the ranking loses resolution exactly where alignment labels are decided, and Stability under-reports
later drift because a pinned value cannot move.

This is inherent to flat deltas on a bounded scale. The cap reduces it; nothing removes it.

### 7.2 The stakeholder ±25 is large, unscaled and underived

Personas B, D and F each lose 25 points on stakeholder sensitivity from a single non-switch. Two
non-switches pin a participant at the floor. Being unscaled by confidence is deliberate and
defensible — it is a behavioral observation, not a self-report — but the **magnitude** has never
been derived from anything. It is the constant in this mechanism with the least behind it.

### 7.3 Six invented constants

+30, +15, −20, −10, ±25 and the cap are set by judgment, not derived from Blocks 1–4. The
defensible framing: they are identical for every participant, so they cannot bias a
between-participant comparison. Report Stability as *"how far the system's model of this participant
moved"*, not as a fact about their morality.

---

## 8. Rating

### **9 / 10**

| | |
|---|---|
| **Mechanism** | Sound. The decrement is what allows a participant's ranking to change at all. |
| **Confidence rating** | Works. The largest possible move rises with the rating and nothing else. |
| **Documentation honesty** | The published constant is the applied one on every path. |
| **Saturation** | 11.9% of values reach 100. The weakest part of the mechanism. |
| **Constants** | Six are set by judgment. Identical for everyone, so they cannot bias a comparison — but the stakeholder ±25 has no measurement behind it. |

---

## 9. What to say to an examiner

> The profile update applies fixed constants, identical for every participant, so it cannot bias a
> between-participant comparison. We audited its behavior across six answer patterns and 2,500
> simulated participants, and capped the per-value movement so the published constant is the applied
> one on every answer path. We report the rule, the audited behavior, and the saturation rate
> together.

---

## 10. Related files

| File | What it holds |
|---|---|
| `src/experiment/block5CVR.ts` | `applyApaUpdates()` — the rule itself |
| `tools/verify_apa.cjs` | 19 assertions on the arithmetic, including the cap (`npm run verify:apa`) |
| `tools/apa_personas.cjs` | the six runs in §3 (`npm run apa:personas`) |
| `tools/apa_context_variants.cjs` | the comparison in §5 (`npm run apa:variants`) |
| `tools/apa_walkthrough.cjs` | one participant through CVR and APA, and the next scenario's labels changing |
| `docs/VRDS_EXPERIMENT_GUIDE.md` §8 | the participant-facing description of the same rule |
| `docs/MEASUREMENT_MODEL.md` §9 | where Block 5 uses the sensitivities |
