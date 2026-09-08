# The seven values — overlap check and plain-language renaming

**Status:** proposed, awaiting approval. Nothing in `src/` changes until this is signed off.
**Raised by:** the advisor, on two points — (1) *Outcome aggregation* and *Gain responsiveness*
seem to mean the same thing; (2) the terms are too hard for ordinary participants.

---

## 1. What IS the difference between the two?

They are measured from **different ladders, in different blocks, counting different things.**

| | Gain responsiveness | Outcome aggregation (Utility) |
|---|---|---|
| Measured in | **Block 3** (AI workforce) | **Block 2** (Trolley) |
| The ladder counts | **money**: $1 → $100,000,000 | **people saved**: 1 → 10,000 lives |
| The question it answers | *How large must the payoff be before you accept the harm?* | *How many people must be helped before you act?* |
| Formula | `1 − avg(Block 3 approval threshold) / steps` | `1 − avg(Block 2 threshold) / steps` |

So: one is about **the size of the reward**, the other about **the number of people helped**.

### The advisor is right that they LOOK identical — and here is exactly why

Both formulas have the same shape (`1 − your average bar`), and, worse, the words we show
participants are near-synonyms:

> Gain responsiveness — *"getting the most benefit"*
> Outcome aggregation — *"maximizing the total"*

Nothing there tells anyone that one counts dollars and the other counts people. The overlap is
real — but it is in **the wording, not the measurement**.

### Evidence that the measurement does not overlap

1. **Different source blocks.** Outcome aggregation is `clamp01(aggregationB2)` — Block 2 only.
   Gain responsiveness is `blend(Block 3 ×0.8, Block 4 ×0.2)`. They share no input, so nothing
   mechanically forces them to move together.
2. **Across the 30 authored Block-5 options they correlate r = −0.21** — essentially independent.

For comparison, here is the full fingerprint correlation matrix over those 30 options:

|  | Vuln | Group | Gain | Outcome | Direct | Context | Stake |
|---|---|---|---|---|---|---|---|
| **Vuln** | · | −0.38 | **−0.69** | −0.23 | 0.22 | 0.41 | 0.50 |
| **Group** | −0.38 | · | −0.12 | 0.26 | −0.47 | −0.48 | −0.14 |
| **Gain** | −0.69 | −0.12 | · | **−0.21** | −0.12 | −0.45 | −0.46 |
| **Outcome** | −0.23 | 0.26 | −0.21 | · | −0.12 | 0.05 | −0.30 |
| **Direct** | 0.22 | −0.47 | −0.12 | −0.12 | · | **+0.72** | 0.36 |
| **Context** | 0.41 | −0.48 | −0.45 | 0.05 | **+0.72** | · | 0.58 |
| **Stake** | 0.50 | −0.14 | −0.46 | −0.30 | 0.36 | 0.58 | · |

**The pair the advisor asked about is the second-weakest link in the whole table.** The strongest
overlap is elsewhere — see section 5.

### Conclusion

**Do not delete or merge a dimension.** Rename them so the real difference is visible. That fixes
the advisor's first point and his second point in a single change, and it touches no data.

---

## 2. What each of the four policy values actually counts

Once written plainly, they are four obviously different questions:

| Value | Its ladder varies | So it asks |
|---|---|---|
| Vulnerability protection | **who** is harmed (entry-level vs senior-level; shelter vs sidewalk) | *Who pays?* |
| Group size | **how many** are harmed (10 → 100,000 workers) | *How many pay?* |
| Outcome aggregation | **how many** are helped (1 → 10,000 lives saved) | *How many gain?* |
| Gain responsiveness | **how much** money is gained ($1 → $100M) | *How much is gained?* |

Who pays · how many pay · how many gain · how much is gained. Four different things.

---

## 3. Proposed plain-language names

Chosen so the four sit in an obvious parallel — **harmed / harmed / helped / gained** — which is
what makes the difference visible at a glance rather than needing to be explained.

| # | Current name | **Proposed name** | Shown underneath |
|---|---|---|---|
| 1 | Vulnerability protection sensitivity | **Protecting the vulnerable** | Do you shield the people least able to cope, even when others would gain more? |
| 2 | Group-size sensitivity | **How many are harmed** | Does it matter to you whether 10 people are affected or 100,000? |
| 3 | Outcome-aggregation (Utility) sensitivity | **How many are helped** | How many people must benefit before you accept the cost? |
| 4 | Gain-responsiveness sensitivity | **How much is gained** | How large must the payoff be before you accept the cost? |
| 5 | Directness sensitivity | **Doing it yourself** | Does it matter that your own hand caused it, rather than a rule or a system? |
| 6 | Context sensitivity | **Where it happens** | Does the situation change your answer, even when the numbers are the same? |
| 7 | Stakeholder-perspective-shift sensitivity | **Hearing someone's story** | Does hearing from an affected person change your mind? |

Every word is one an ordinary participant already owns. No "aggregation", no "responsiveness",
no "sensitivity", no "utility".

### They also have to read well inside sentences

The names appear mid-sentence in the APA and the CVR, so they were checked there:

- *"Across your responses you've leaned most toward **how many are helped**."* ✔
- *"In this scenario you chose an option built around **how much is gained**."* ✔
- *"Pick the one value you most want the system to weight for you: **Protecting the vulnerable** —
  do you shield the people least able to cope…"* ✔

---

## 4. What changes, and what does not

**Display only.** The seven internal keys (`Block5SensitivityKey`) are frozen and stay exactly as
they are, so:

- no stored data changes shape
- no fingerprint values change
- alignment, the CVR cube, VCI, Stability and Performance are all untouched
- `npm run validate:block5` should pass unchanged

Files carrying participant-facing names (all label tables, no logic):

| File | What it holds |
|---|---|
| `block5Types.ts` | `POLICY_DIM_SHORT`, `POLICY_DIM_EXPLAIN` |
| `block5Profile.ts` | `SENSITIVITY_LABELS` (all seven) |
| `thresholdTree.ts` | the `label` on each of the seven dimensions |
| `Block5PublicEmergencySimulation.tsx` | `VALUE_NAME`, `VALUE_BENEFIT`, and the summary map |
| `Block5OptionCompare.tsx` | `POLICY_AXIS_LABEL` (radar axes — needs short forms) |
| `Block5VisualizationsView.tsx` | `VALUE_LABEL` |
| `Block5SimulationSummaryPage.tsx` | the value-priority badges |

Radar axes need shorter forms, since long labels collide:
**Worst-off · How many harmed · How many helped · How much gained**

---

## 5. One overlap nobody has raised, which is larger

**Directness × Context correlate at r = +0.72** across the 30 options — by far the strongest pair
in the table, and three times the Gain/Outcome link the advisor asked about.

Those two are the FRAMING pair: `chooseFraming()` picks whichever is higher to decide which
reflection lens the CVR uses. The correlation above is between the *option fingerprints*, not
between participants' own scores, so it does not automatically break that choice — but it does
mean the option set barely distinguishes them.

I have **not** folded this into the plan, because it is a different kind of problem (it would mean
re-authoring fingerprints, which is a measurement change) and because the advisor did not ask
about it. Flagging it so the decision is yours.

---

## 6. How this gets checked

1. `npm run validate:block5` — all four validators must pass unchanged. If any number moves, the
   change was not display-only and something is wrong.
2. A grep gate: no participant-facing string may contain *aggregation*, *responsiveness*,
   *sensitivity* or *utility*. Added to the validator so the old vocabulary cannot creep back.
3. Screenshots of the four places a participant meets these names — the Block 5 sidebar, the APA
   value question, the results page, and the two radar charts — to confirm nothing overflows.

---

## 7. Decisions needed

1. **Approve the seven names?** Any you want reworded — particularly #1, which is the only one
   that is not a plain question.
2. **Keep "(Utility)" anywhere?** It was added earlier at the advisor's request so participants
   saw both words. Under the new naming, *How many are helped* says it better, and carrying
   "Utility" alongside would reintroduce exactly the jargon he now wants removed. **My
   recommendation: drop it** — but it was his word, so it is his call.
3. **Do anything about Directness × Context (section 5)?** Separate piece of work if so.
