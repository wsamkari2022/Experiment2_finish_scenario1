# Scenario 6 — the Veil of Ignorance, and the prediction test

**Status:** DRAFT FOR APPROVAL, 13 September 2026. Nothing in this file is wired into the app.
**Depends on:** `src/experiment/block5Prediction.ts` (built and gated, `npm run validate:prediction`).

---

## 1. What this scenario is, in one paragraph

The first five scenarios ask what a participant would do. Scenario 6 asks something different: it
shows them what the model *expected* them to do, and measures whether they recognize themselves in
it. It is a test **of** the model, not more input **to** it.

Three decisions are already settled and the rest of this document assumes them.

- **It never feeds the model.** No profile update, no churn, no contribution to VCI, Stability or
  Performance. The churn ceiling is a measurement of the scenario deck, so a sixth scenario that
  produced churn would invalidate it and every gate built on it. It is also required scientifically:
  a test of the model cannot be evidence for the model.
- **It is excluded from the position effect.** The five positions are the block's manipulation. The
  veil removes position by construction, which is why it belongs here and nowhere else.
- **The prediction is shown AFTER the choice.** Showing it first would contaminate the very thing
  being measured, and there would be no way to tell a genuine choice from a suggested one.

---

## 2. Why the Veil of Ignorance, and why four options

Rawls's original position asks you to choose a rule for a society **before** you know which person
in it you will be. That is the exact shape this scenario needs, for two independent reasons.

**It removes the position manipulation honestly.** Scenarios 1 to 5 vary who carries the cost. If
scenario 6 simply reused one of those positions, it would sit inside a design it is not part of. The
veil does not dodge the question, it dissolves it: you cannot be told where you stand, because not
knowing is the condition of the exercise.

**It makes four abstract options the faithful form.** In an emergency scenario, four stark options
would be a weakness, because real emergencies are made of specific competing details. Behind the
veil the abstraction is the point. A participant is choosing a principle, not an action, and one
option per value is the cleanest way to ask which principle they hold.

The measured case for four rather than six, at a typical participant's confidence:

| Deck | Chance | Separation | Top option |
|---|---|---|---|
| Six options, as in scenarios 1–5 | 16.7% | 7 | 28.3% |
| Any four of those six | 25.0% | 11 | 39.6% |
| **Four pure champions, 95 against 25** | **25.0%** | **17** | **39.7%** |

**Read the separation column, not the percentage.** Going from six options to four raises separation
from 7 to 11 on its own, which is an artifact: with fewer options the top two sit further apart by
chance. Making the four options strongly differentiated raises it from 11 to 17, and that part is
real discriminating power. The headline percentage rises mostly because chance rose from 16.7% to
25%, so **the chance baseline must be reported everywhere the percentage is.**

For a participant with high VCI and high Stability the same deck gives a median top option of 56%
and 87% at the ninetieth percentile. Those numbers are earned by the differentiation.

---

## 3. The scenario text

> **Title**
> The Rule You Will Live Under

> **Description**
> A regional authority is writing the standing rule for its emergency reserve: the one stock of
> people, equipment and power it can release when the next crisis comes. The rule will be applied
> automatically, to everyone, with no exceptions and no appeal. It is written once and it does not
> get revisited in the moment.

> **The facts, identical under every option**
> One reserve. It covers roughly a third of what a full-scale emergency would need. It will be
> triggered at some point in the next two years. Whatever rule is chosen is the rule that runs, and
> nobody gets to argue with it on the day.

> **Your position — THE VEIL**
> You write the rule today. When the emergency comes, your own place in it will be assigned at
> random, and you will not know it until it happens.
>
> You could be the person whose life depends on the reserve arriving. You could be the nurse who
> has to apply your rule to someone in front of you. You could be the technician who can restore
> power to one building and not the next. You could be a parent held outside the cordon. You could
> be someone who never needs the reserve at all and only pays for it.
>
> You are writing a rule you will have to live under, from a position you do not get to choose.

**Why this wording.** It names five concrete positions rather than saying "you could be anyone",
because an abstraction nobody can picture is not a veil, it is a sentence. It also deliberately
includes the position that costs nothing, so the participant cannot assume they will be the one in
need.

---

## 4. The four options

Each is a pure champion of one value. The value name in brackets is internal and is **never shown**.

### A · "Whoever would suffer most without it" *(protecting the vulnerable)*

- **Summary.** The reserve goes first to the people who would be worst off if it never reached them,
  even when reaching them is slow, expensive, and helps only a few.
- **What it protects.** Nobody is left out because helping them was inconvenient.
- **What it gives up.** The reserve does less in total. It will often be spent on a handful of
  people while many others get nothing.
- **The tension it raises.** Is a rule fair when it knowingly helps fewer people in order to reach
  the people in the worst position?

### B · "Wherever it prevents the most serious harm" *(reducing harm)*

- **Summary.** The reserve goes wherever it stops the largest number of deaths and severe injuries,
  whoever those people turn out to be.
- **What it protects.** The count of people seriously harmed is as low as the reserve can make it.
- **What it gives up.** Someone already in the worst position may be passed over, because saving
  them would use resources that could prevent more severe harm elsewhere.
- **The tension it raises.** If the rule never looks at who a person is, is it fair, or merely
  efficient?

### C · "Wherever it reaches the most people" *(how many are helped)*

- **Summary.** The reserve is spread so that the largest number of people get some help from it,
  even when nobody gets very much.
- **What it protects.** Almost nobody is left entirely without something.
- **What it gives up.** Spread thin, it may be too little to change the outcome for anyone in real
  danger.
- **The tension it raises.** Is a little help to many worth more than enough help to a few?

### D · "Wherever it achieves the most" *(how much is gained)*

- **Summary.** The reserve goes where each unit of it produces the greatest total result, measured
  across everything it touches.
- **What it protects.** Nothing is wasted. Every unit is placed where it does the most work.
- **What it gives up.** The people hardest and most expensive to reach are, by this rule, exactly
  the people it will pass over.
- **The tension it raises.** When a rule is written to get the most out of what we have, who
  reliably ends up on the wrong side of it?

### Fingerprints

Pure champions, 95 against 25, which is the spread the measurement in section 2 supports.

| Option | Protecting the vulnerable | Reducing harm | How much is gained | How many are helped |
|---|---|---|---|---|
| A | **95** | 25 | 25 | 25 |
| B | 25 | **95** | 25 | 25 |
| C | 25 | 25 | 25 | **95** |
| D | 25 | 25 | **95** | 25 |

The three framing values (doing it yourself, where it happens, hearing someone's story) sit at 50 on
every option. They select the reflection lens, no reflection runs here, and leaving them uneven
would imply a difference this scenario does not contain.

**Performance metrics are all 50.** They are a required field, they feed a measure scenario 6 is
excluded from, and these options are principles rather than actions, so speed and reliability have
no meaning for them. Equal values say "not what this scenario is about" instead of inventing a
difference. The metrics dashboard should be hidden here.

---

## 5. The three steps on screen

**Step 1 — choose.** Four options, the veil text above them, no prediction anywhere on the page.
Identical in feel to the other scenarios so the choice is made under the same conditions.

**Step 2 — the prediction is revealed.** All four options with their probabilities, the chance
baseline stated in the same size type, and one sentence of reasoning drawn from the participant's
own leading values. The engine already grades its own confidence from the separation, so the page
says one of:

- *a clear expectation* — "The option we expected you to pick is built on protecting the vulnerable."
- *a close call* — "Two of these fit you almost equally well, so this was a close call."
- *no expectation* — "These fit you so evenly that we genuinely could not tell them apart."

Proposed wording for the panel:

> **What we expected, before you chose**
> Across your earlier answers you leaned most on *protecting the vulnerable*, and then on *reducing
> harm*. Here is what we expected, and how sure we were.
>
> A · Whoever would suffer most without it — **41%**
> B · Wherever it prevents the most serious harm — **27%**
> D · Wherever it achieves the most — **18%**
> C · Wherever it reaches the most people — **14%**
>
> With four options, a coin-toss guess would be 25% each. **You chose C.** We did not expect that,
> and there is nothing wrong with your answer — this page is a test of our model, not of you.

**Step 3 — respond.** Three questions, then keep or change.

---

## 6. The three new measurements

| Measurement | How it is obtained | What it answers |
|---|---|---|
| **Accuracy** | The predicted probability of the option actually chosen, and whether the top-ranked option was it | Does a profile built from Blocks 1–4 and five scenarios predict a sixth choice? |
| **Self-recognition** | "Does this describe how you decide?" on the study's 1–7 scale | Do people accept a model of their own values, and does accepting it depend on it being right? |
| **Reactivity** | Whether they change their choice after seeing the prediction | Does being shown a prediction of yourself change what you do? |

Reactivity is the finding that only exists because the choice came first. It is also the one to
report most carefully: a participant who changes may be correcting themselves, or may be resisting
being predicted, and the open-text answer is what separates those.

**Store the prediction as it was made**, including `PREDICTION_VERSION`, the temperature, the
confidence, the separation, and all four probabilities. A prediction that cannot be reproduced
cannot be defended.

---

## 7. What must change elsewhere

| Item | Change |
|---|---|
| `Block5DecisionRole` | A third role that returns false from `scenarioIsScored()` |
| `stakePosition` | A veil position, excluded from `block5Position.ts` |
| `tools/validate_block5.cjs` | Require six options of the five scoring scenarios only; keep the four-unique-champions rule everywhere |
| Display copy | "5 scenarios" appears in the stepper, the Block 5 intro and the reflection block |
| Consent form | Duration estimate, and a line describing the prediction step |
| `dbShape.ts` | A `scenario6_prediction` section outside `blocks` |

Unaffected, and verified: `STABILITY_CHURN_CEILING`, VCI, Stability, Performance, the position
effect, and the scenario 4/5 matched pair, which is located by explicit scenario ids.

---

## 8. Open questions for the researcher

1. **Does the participant see the model's reasoning, or only the numbers?** Reasoning makes the
   prediction feel fair and testable. It also teaches them what the model thinks they value, which
   could shape the self-recognition answer. Recommend showing it, and recording the choice as fixed.
2. **Is "keep or change" offered to everyone, or only when the prediction was wrong?** Offering it
   to everyone is cleaner, because a participant whose prediction was right and who is not offered
   the option has been treated differently for a reason they can see.
3. **Should the four options be shown in a fixed order, or ordered by the participant's profile?**
   Recommend a fixed order for everyone, and recorded, so order cannot confound the choice.
