# CVR lenses — implementation plan

**Status:** IMPLEMENTED, 2026-08-25. Section 6 records what happened.
**Prerequisite done:** the seven values are renamed to plain English (`BLOCK5_VALUE_NAMING_PLAN.md`).

---

## 1. What is being built

Both reflection lenses stop *asserting* and start *showing*, each along its own axis:

| Lens | Definition | What the participant will see |
|---|---|---|
| **Where it happens** (context) | between contexts only | **Same rule, different place.** Their own rule, their own numbers, running in another setting of equal seriousness. |
| **Doing it yourself** (directness) | within one context, direct harm | **Same place, different hand.** The same outcome shown twice — once as a system could have produced it, once as they in fact produced it. |

### Why directness is being upgraded too

It was not asked for, but it is required for the change to be an improvement rather than a
distortion. If only the context lens becomes a vivid transplant while directness stays a single
clause, the two lenses stop being comparably persuasive — and `chooseFraming()` assigns them by
the participant's own scores. Any difference in outcomes between the two lenses would then partly
measure *which text was stronger*, not *which participant was moved*. Upgrading both keeps them
balanced.

---

## 2. The rule that keeps this a measurement

> **The second place has to be just as serious as the first place.**

A life-and-death scenario gets a life-and-death parallel; an everyday scenario gets an everyday
one. If cancer transplanted into a parking dispute, a participant who answered differently might
be reacting to the drop in stakes, not the change of setting — that would measure stakes
sensitivity while calling it context sensitivity.

**This becomes an executable gate**, not a good intention: every scenario declares a `register`,
every parallel declares one, and the validator fails if they differ.

| Scenario | Register | Parallel setting |
|---|---|---|
| Limited Cancer Treatment | life-and-death | the last helicopter off the flooded rooftops |
| Flood Evacuation | life-and-death | a hospital ward filling with smoke |
| Water Contamination | life-and-death | restoring power in a deep freeze |
| Getting to Fairhaven | everyday | shipping a parcel that must arrive Friday |
| Dinner for Four | everyday | buying four gifts on a fixed budget |

---

## 3. Content to author

| Piece | Count | Lives in |
|---|---|---|
| `register` | 5 | `ScenarioCVRContent` |
| `parallel.setting` | 5 | `ScenarioCVRContent` |
| `parallel.valuePhrase` (4 values each) | 20 | `ScenarioCVRContent` |
| `impersonalAgent` | 5 | `ScenarioCVRContent` |
| `cvrSeed.parallelRule` | **30** | each option in `block5Scenarios.ts` |

**60 pieces.** The 30 rule restatements are the bulk and cannot be shortcut: `cvrSeed.rule` is
written for its own domain ("adds about eight hours by stopping in every town") and does not
transplant.

---

## 4. Stages — simplest first, hardest last

Each stage ends with `npm run typecheck`, `npx eslint`, and the four validators. Nothing moves on
until the stage before it is green.

| # | Stage | Risk |
|---|---|---|
| **0** | **Back up** every file to be touched into `.cvr-backup/`. | none |
| **1** | Add the new type fields, all **optional**. No behaviour change. | none — pure types |
| **2** | Add `register` + `impersonalAgent` (10 pieces) and build the **directness** lens. Smallest content, simplest render. | low |
| **3** | Add `parallel.setting` + `parallel.valuePhrase` (25 pieces). Still not rendered. | low |
| **4** | Author the **30 `parallelRule`** strings. Still not rendered. | medium — bulk content |
| **5** | Build the **context** transplant and **replace** the abstract clause. | medium |
| **6** | Rework the dual-perspective comparison table — it currently shows two matched sentences; it must now show two blocks. | **highest** |
| **7** | Validator gate: registers match, every parallelRule present and distinct from its original. | low |
| **8** | Screenshots of both lenses in all five scenarios. | none |
| **9** | Delete `.cvr-backup/`. | none |

A revert flag (`SHOW_LENS_VIGNETTES`) follows the existing `blocksLegacyMethodology.ts` pattern, so
the whole change can be turned off in one line if the advisor dislikes it.

---

## 5. Why this should make the experiment better, not worse

| Concern | How it is handled |
|---|---|
| The CVR gets longer and participants tire | The transplant **replaces** the abstract clause rather than adding to it. Net length roughly flat. |
| The two lenses differ in strength | Both upgraded together (section 1). |
| Context measured inside one context — the thing it must not do | Fixed: the context lens now genuinely crosses contexts. |
| A transplant that changes stakes as well as setting | Blocked by the matched-register gate (section 2). |
| Content drifting from the original meaning | Each `parallelRule` must restate its own option's rule; the validator checks presence and distinctness, and every one is reviewed against the option's `rule` and `givesUp` text. |
| The change cannot be undone | Backups during the work; a one-line revert flag afterwards. |

**No scoring changes.** Fingerprints, alignment, VCI, Stability and Performance are untouched, so
all four validators must report identical numbers at every stage. If any number moves, something
is wrong and the stage is reverted.

---

## 6. What happened

All nine stages completed. Every stage ended green before the next began.

### Caught by the staged approach

**Stage 4 broke an existing validator check**, and the reason matters. Checks 5 and 6 scan a fixed
window from the start of each scenario block and take the FIRST match for each value key. The new
`parallel` block carries its own `valuePhrase` map and now sits earlier in the block, so both
checks were silently reading the parallel phrases instead of the originals. Two fixes:

1. The parallel phrases were reworded to the original style. The old gate forbids "least" in a
   value phrase for a good reason — the phrase is dropped into "What it trades away is …", so it
   must name a good thing being given up, not a group described by what they lack.
2. **Checks 5 and 6 now strip the parallel block before testing**, so they see exactly what they
   were written to see. Without this they would have kept passing while no longer testing the
   originals at all.

### New gates

- **`validate_block5.cjs` check 7** — every scenario's parallel exists, has a setting and four
  value phrases, and **its register matches the scenario's own**. The "second place must be just
  as serious as the first" rule is now executable, not an intention.
- **`tools/validate_cvr_lenses.cjs`** — builds all **240** lens combinations (5 scenarios x 4
  violated values x 6 options x 2 lenses) and fails on a missing field, an unresolved value, a
  framing clause left behind in the recontext, a context lens that does not transplant, or a
  directness lens that wanders out of its own context.

### Revert path verified in both directions

`SHOW_LENS_VIGNETTES = false` restores the original single-clause framing; typechecked clean with
the flag off, and the lens validator correctly skips itself and says why.

### A bug found while testing — now fixed

`altViewGenerated` was set when the second lens finished *typing*, not when the participant
*clicked* to generate it. The CVR answer buttons stay live during that typing, so anyone who
generated the second view and answered straight away was recorded as never having generated it:
they were not asked which lens moved them, and the framing adjustment could not fire. Nothing was
corrupted — an observation was silently lost.

It now records on the click. Pressing the button is the act being measured, so the click is the
honest moment to record it. Verified with a deliberately impatient run (generate, then answer
immediately with no pause): the dual-perspective question now appears — "Question 2 of 3" where it
previously read "1 of 2".

### A second defect the fix surfaced

Moving the framing out of the recontext paragraph (stage 5) had an unnoticed consequence: the two
versions of that paragraph became **identical**. The "generate the other view" animation was
therefore re-typing the very same sentence in box 1 while the actual change happened silently in
the lens block below.

The regeneration now plays where the change really is. Box 1 no longer re-types; the lens block
shows the "reframing…" indicator, then types the new lens. Confirmed on screen: box 1 holds still
and the lens swaps.

### Result

typecheck clean · 0 lint errors · all five validators pass · build OK. No scoring changed:
fingerprints, alignment, VCI, Stability and Performance report identical numbers throughout.
