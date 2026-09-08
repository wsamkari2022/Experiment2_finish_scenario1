# The Context lens — show a different setting, don't just say "different setting"

**Status:** proposed, awaiting approval. Nothing in `src/` changes until this is signed off.
**Follows:** `BLOCK5_VALUE_NAMING_PLAN.md` (Job A — done).

---

## 1. The agreed definitions

| | Varies | Held constant | Direct harm? |
|---|---|---|---|
| **Doing it yourself** (directness) | how direct your causal role is | **one** setting | **yes** — required |
| **Where it happens** (context) | the setting | the act and the numbers | **not required** |

The existing measurement already matches this:

- **Directness** — Block 2, one situation (the trolley), lever *(indirect)* vs bridge *(your hands)*. Within one context, direct harm. ✔
- **Context** — Block 1, one act (keep the found money), three settings (sidewalk / wealthy district / shelter). Between contexts only. ✔

**No measurement change is needed.** This plan is about the CVR only.

---

## 2. What is wrong with the Context lens today

When the CVR picks the Context lens, the participant reads a *sentence about* context:

> "…the reason some patients rank lower here is context, not worth — late diagnosis, unequal
> access, and where people live shape the very numbers the rule uses."

That **asserts** that context matters. It never lets the participant **feel** it. And a dimension
defined as *between contexts* is being probed inside a single context, which is the one thing it
is not supposed to do.

---

## 3. The change: a transplant vignette

When the Context lens fires, show the participant **their own rule, with their own numbers,
running somewhere else.**

Sketch, for the cancer scenario with the "essential workers first" option:

> **Same rule, somewhere else.**
> Twenty places on the last helicopter. A hundred and twenty people on the rooftops.
> The crew is told to lift the ones the town depends on first — the doctor, the two engineers who
> can restart the pumps, the woman who drives the only ambulance.
> A man with a broken hip waits, because nobody depends on him.
>
> **Same numbers. Different place. Would you still write the rule that way?**

Nothing about the choice changed except where it is happening. That is context sensitivity made
visible instead of asserted.

---

## 4. The rule that keeps this a measurement and not a mood

> **The parallel must match the original on stakes, and differ only in setting.**

If the cancer scenario transplanted into a parking dispute, a participant who answered differently
might be responding to the drop in stakes, not to the change of setting. That would measure stakes
sensitivity while calling it context sensitivity.

So each parallel is matched in register:

| Scenario | Anchor kept identical | Parallel setting | Register |
|---|---|---|---|
| Limited Cancer Treatment | 20 of 120 | **the last helicopter off the rooftops** — 20 places, 120 people | life-and-death |
| Flood Evacuation | a small fleet, hours left | **a hospital ward during a fire** — the same triage, indoors | life-and-death |
| Water Contamination | scarce crew-hours | **restoring power in a deep-winter storm** — who gets heat back first | life-and-death |
| Getting to Fairhaven | 1,300 miles, Friday deadline | **shipping a parcel that must arrive Friday** — the same cost, moved onto someone else | everyday |
| Dinner for Four | $80, two hours, four people | **buying four gifts on a fixed budget** | everyday |

The two everyday scenarios stay everyday. Escalating them would confound the measure.

---

## 5. How much content this needs

The vignette is assembled from three parts, and only the third is per-option:

| Part | Count | Example |
|---|---|---|
| The parallel setting | **5** — one per scenario | "Twenty places on the last helicopter. A hundred and twenty people on the rooftops." |
| The value phrase in that setting | **5 × 4 = 20** | what *"how many are helped"* looks like on a rooftop |
| **The option's rule, restated there** | **30** — one per option | "lift the ones the town depends on first" |

Total: **55 new pieces of copy.** The 30 rule restatements are the bulk, and they are the part
that cannot be shortcut — `cvrSeed.rule` is written for its own domain ("adds about eight hours by
stopping in every town") and does not transplant.

A cheaper variant exists: drop the per-option restatement and phrase the parallel at the level of
the *violated value* only (5 + 20 = 25 pieces). It is less pointed — the participant sees their
value neglected elsewhere, but not their own rule doing it. **I would not recommend it**: seeing
your own rule is what makes the transplant land.

---

## 6. Two consequences worth deciding on

### 6.1 The two lenses stop being symmetrical

Directness stays a clause inside the existing paragraph (correct — it must stay *within* one
context). Context becomes a separate vignette box. So the two lenses will no longer look alike.

That is defensible: they measure different things and now look different. But it affects the
**"✨ Generate the other view"** feature, which today swaps one clause for another and shows both
in a comparison table. With one lens a clause and the other a vignette, that table needs redesign —
probably a side-by-side of *"the same choice, seen two ways"* rather than two matched sentences.

### 6.2 The CVR gets longer

The vignette adds roughly 45–60 words to a screen that already carries the recontext paragraph,
the stakeholder paragraph and the question. Options:

- show the transplant **in place of** the abstract context clause (keeps length flat — my preference)
- show it **in addition** (more complete, noticeably longer)

---

## 7. Risk I want on the record

The transplant is a **stronger intervention** than the sentence it replaces. A participant who
would have shrugged at "context shapes the numbers" may well change their answer when they see the
man with the broken hip. That is the point — but it means Context-lens CVRs and Directness-lens
CVRs will no longer be comparably persuasive, and `chooseFraming()` assigns them on the basis of
the participant's own scores.

If the two lenses differ in strength, any difference in outcomes between them partly reflects the
intervention rather than the participant. **This should be measured, not assumed**: the existing
telemetry already records which lens fired and whether the participant changed their mind, so the
comparison is available once there is pilot data. It belongs in the limitations section either way.

---

## 8. Order of work, if approved

1. Author the **cancer** scenario end to end — 1 setting, 4 value phrases, 6 rule restatements —
   and show you the rendered screen before writing anything else.
2. On approval of the shape, author the remaining four.
3. Wire it into `getCVRStory`, behind a flag so it can be reverted like the other methodology
   switches (`blocksLegacyMethodology.ts` pattern).
4. Redesign the dual-perspective comparison table (6.1).
5. Screenshots of both lenses in all five scenarios; re-run all four validators (no numbers should
   move — this is content, not scoring).

---

## 9. Decisions needed

1. **Replace the abstract context clause, or add the transplant alongside it?** (6.2) — I recommend replace.
2. **Per-option rule restatements (30 pieces) or the cheaper value-level variant (25 pieces, less pointed)?** — I recommend per-option.
3. **Do the parallel settings in section 4 look right to you?** Especially the two everyday ones,
   which I deliberately kept everyday rather than escalating.
