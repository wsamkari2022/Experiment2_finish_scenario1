# Auditing a Block 5 scenario — what was done to scenario 1, and what to repeat

**Written:** 16 September 2026, after finishing the audit of scenario 1
(`chemical_release_escape`). **Pass E added 17 September 2026.**
**For:** whoever runs the same passes over scenarios 2, 3, 4, 5 and 6.

> **Scenario 1 is the worked example. Nothing here has been done to the other five yet.**
> Waseem's plan: finish every remaining change to scenario 1 first, then apply all of it to the
> other scenarios in one go.

---

## 0. The one habit that found almost everything

**Read all six options of a scenario in one sitting, in order, as a participant would.** Every
defect below was found that way and none of them was visible while looking at a single option.

The advisor read six cards in a row and asked two questions — *who exactly has no transport?* and
*drive out in what?* — and those two questions unpicked seven numbers and three sentences.

---

## 1. What is GLOBAL and already applies to every scenario

Do **not** redo these. They are in shared components or shared types and scenarios 2–6 already have
them:

| Change | Where |
|---|---|
| The metric label **"Resource use" → "Resources spared"**, and all five scenario readings reworded to "how much … it leaves for other people" | `block5Types.ts` → `METRIC_DEFS` |
| The cumulative dashboard's two foldable explanations (*What a high or low number means here* / *Where these numbers come from*), both closed by default, no glow | `Block5PublicEmergencySimulation.tsx` → `MetricsDashboard` |
| **"Your cumulative performance — starts at 0, updates with each scenario"** | same |
| **Preview impact clears itself** when its card scrolls out of view, and the dashboard shows a `PREVIEWING` chip with the option's title | same |
| The ordering panel no longer prints the participant's value ranking, and no longer glows | `block5PlannerText.ts` |
| The sidebar header *"What you are deciding on — the complete scenario, not a summary"*, and the role card open by default | `Block5PublicEmergencySimulation.tsx` |
| The `method` / `methodLabel` **types** exist and the card renders the box whenever a scenario supplies them | `block5Types.ts`, `OptionCard` |
| The vignette page no longer shows the faint recap or the `recontext` paragraph; both lens headings, prompts and time labels are rewritten | `block5CVRContent.ts`, `CVRReveal` |

---

## 2. What is PER-SCENARIO and must be repeated

### Pass A — the wording of the scene and the situation

What changed in scenario 1:

| Field | Before | After |
|---|---|---|
| `description` | "Chlorine is coming off it as a low plume … into **the housing**" | "**A chlorine leak is causing** a low plume … into **a housing neighborhood**" |
| `factBase` | "**Six hours before** the plume covers the district." (a fragment) | "**You have 6 hours before** the plume covers the district." |
| `factBase` | "gets you out **inside** the six hours" | "gets you out **within** six hours" |

The reasons generalize:

- **Name the cause, do not describe it.** "Chlorine is coming off it" made the reader carry an *it*
  back two clauses and read "coming off" as detaching rather than leaking.
- **Open the situation box with a sentence, not a label.** A fragment leaves the reader working out
  whose six hours these are, and the first four words should carry the number everything depends on.
- **Watch prepositions doing double duty.** "Gets you out inside the six hours" puts *out* and
  *inside* in one breath. The preposition meant time; a reader hears space.
- **Avoid category nouns for places people live.** "The housing" is incident-report language.

### Pass B — the performance numbers, read against each option's own text

**The method.** For each option, read its `summary`, `gains` and `givesUp`, then ask of each of its
five numbers: *does this agree with what the card says this option does?*

In scenario 1, **ten numbers across five options** disagreed. The final table:

| option | speed | resources spared | reliability | durability | reversibility | composite |
|---|---|---|---|---|---|---|
| registered convoy | 52 | 73 | 86 | 66 | 67 | 68.8 |
| reserved respirator | 85 | **45** | 54 | 76 | 52 | 62.4 |
| walk out on foot | 30 | **92** | **48** | 78 | 81 | 65.8 |
| shuttle loop | 45 | **40** | 71 | 72 | 37 | 53.0 |
| seal and shelter | **18** | **97** | **40** | **82** | **30** | 53.4 |
| service road | 89 | **84** | 76 | 45 | 45 | 67.8 |

Bold = moved. The convoy was the only option whose numbers survived untouched.

The two patterns worth carrying over:

1. **An option whose text says it takes nothing must be top of the resource metric.** Sheltering's
   gains line reads *"You take absolutely nothing from anyone — no seat, no mask, no road, no crew
   time"* and it was ranked second.
2. **An option can contradict itself on a metric its own `givesUp` line already answers.** Sheltering
   held the scenario's **highest** reversibility (94) while its `givesUp` read *"If the seal does not
   hold you are inside the worst air in the district with no way out."* Reversibility asks exactly
   that question. It is now 30.

#### ⚠️ The trap. Read this before changing a single number.

The first pass scored "take the respirator" at **21** because it takes the one irreplaceable item
*from a named person who cannot breathe outside air*.

That is a statement about **who the taking lands on**. The metric measures **how much is consumed**.
Loading moral weight into a performance metric is exactly what gate **G5** exists to catch, and it
did: `vulnerability × performance` went to **0.54** against a ceiling of **0.30**. That would have
made the study's central trade-off free — protecting the vulnerable would also have been the best
performing choice, and Block 5 data would say nothing.

**Moral weight belongs in the option's fingerprint and its `givesUp` line. Never in a metric as
well.**

#### The four gates any new numbers must clear

Run `npm run validate:metrics`.

| Gate | Requirement |
|---|---|
| G5 | `vulnerability × performance` **r < 0.30** |
| G5 | the vulnerability champion ranks **3rd or worse** of 6 on performance |
| G6 | the six option profiles differ by **≥ 10** points (mean absolute) |
| G6 | **≥ 4 of 6** options lead at least one metric |

Scenario 1 finished at r = 0.22, champion 3rd, profiles 16.0 apart, 4 of 6 leading.

**Score candidate numbers against the gates BEFORE editing the file.** Guessing cost several rounds.
A throwaway script that loads `.sim-build/block5Scenarios.js` and prints all four figures for a set
of proposed overrides pays for itself immediately.

Also check the anchors in `block5Types.ts`: 90–100 the best this situation allows · 70–85 clearly
good · 50–65 middling · 30–45 clearly poor · 10–25 the worst this situation allows.

### Pass C — every option says how it is carried out

Add `methodLabel` to the scenario and `method: { kind, by, detail }` to each option.
`kind` is `car | bus | van | foot | stay` and picks the icon.

Scenario 1's six:

| option | `by` | `detail` |
|---|---|---|
| convoy | The convoy bus | in your street's assigned slot. Your car stays parked where it is. |
| respirator | On foot, wearing the clinic's respirator | straight out by the shortest street, breathing clean air the whole way. |
| walk out | On foot, with nothing | by the river path, upwind and slow. No seat, no mask, and your car left behind. |
| shuttle | The district minibus, with you driving | two loops carrying other people out, and you leave on the third. |
| shelter | You do not travel at all | you stay in your own apartment and let the plume pass over you. |
| service road | Your own car | down the freight yard's service road, the only road a private car may use today. |

`by` carries the emphasis on the card; `detail` is the qualifying clause. `methodLabel` is authored
per scenario ("How you travel") because a treatment rota or a care schedule needs different words —
**scenarios 3, 4 and 5 will need their own label, not this one.**

### Pass D — the six options must describe ONE world

This is the pass that does not exist until you read all six together.

Scenario 1's two collisions and the single fact that resolved both:

- *"two streets of people who have **no transport of their own**"* against *"a convoy list nine
  streets long"* — so does everybody have transport or not?
- *"**Drive** out on the industrial service road"* when the only vehicle named anywhere in the
  scenario was the minibus that a **different option** uses.

**The fix was one sentence in `factBase`:** the participant has a car, the cleared streets are closed
to private cars, and the service road is the only road it may use.

That one sentence did three jobs:

1. "Drive out" plainly means the participant's own car.
2. Walking four hours stays rational — a car that may only go one way, past a leaking tanker,
   single-track, no turning back, is not a free pass out. Without the sentence, owning a car and
   choosing to walk looks absurd.
3. The minibus line became sayable: those two streets have no car **and** their convoy slot is hours
   off. The text now says that, and its `gains` line changed from "people who had no way out" to
   "people who would still be waiting for their slot".

> **Choose the resolving fact so that no performance number has to move.** A private car takes
> nothing from the shared pool, which is exactly what the service road's *Resources spared 84*
> already assumed. Had the answer instead been that the service road uses the minibus, the whole
> column audited the day before would have needed redoing.

### Pass E — the two CVR lenses

Done for scenario 1 on 16–17 September 2026. **Scenarios 2–6 still have the old vignettes.**

**What was deleted outright:**

- the faint italic recap of the situation box at the top of the vignette page;
- the whole `recontext` paragraph — *"The same six hours and one plume are committed under the plan
  you chose…"* Three jobs in one sentence, nothing in it happening to anybody, and the advisor could
  not read it;
- the `anchorNoun` field, which existed only to build that sentence, and the gate that checked it.

**The five rules both lenses now follow:**

1. **Never say "same"**, or *also*, or *just like*. Print the numbers and let the participant
   notice. Whether they do is part of what is being measured.
2. **Nothing happens more than 24 hours later.** Time labels are *Within the hour* and
   *Before midnight*. The old text had smoke hanging over a district for three weeks.
3. **Name the travel method.** "You take the wheel of the district minibus" is a fact they can
   check against the card they clicked; "you picked this option" is not.
4. **Write consequences with *may* and *could*.** Nobody knows what happens next, and a page that
   predicts the future in the indicative is making a claim it cannot support.
5. **Colors carry the meaning.** The **whole** parallel-world sentence is `{w|…}` — violet, bold,
   italic, the same "who is affected" color used on the role card — not just the person's name. Every
   echoing number in the setting paragraph is `{a|…}` — gold, bold. Marking the numbers does the
   job the word "same" used to do, silently.
6. **The context lens closes on nothing.** It ends on its last consequence. It used to end "A
   different place, a different night, and nobody to blame for how it ends", and a line insisting
   nobody is to blame raises blame as surely as naming somebody would. Only the **directness** lens
   has a closing line, and that line names the participant.

**The parallel world for scenario 1 is an airport**, with one partner for every fact: six hours,
four thousand people, one vehicle nobody is driving, one piece of breathing gear, a list nine long,
one lane past the hazard. It was a hospital, which collided with scenario 3 being a real hospital.
**Pick each scenario's parallel so it does not collide with another scenario in the deck.**

**Per-option fields to author:** `act` (the directness opening, naming the method, containing "you")
and `parallelAct` (the same act in the parallel world, containing no "you"), plus rewritten
`consequences` and `parallelConsequences`.

**Gates that bite here:**

| Gate | Requirement |
|---|---|
| lens | the context lens never says *you* or *your*; the directness lens always says *you* |
| lens | neither lens **heading or prompt** says *same* — the body is exempt, because an option can legitimately be *about* sameness |
| lens | the **directness** lens has a closing line; the **context** lens has none |
| content | no sentence over **20 words** |
| content | each `soon` + `later` pair names a **number or a timescale** — and `night` matches, `tonight` does not |
| content | the two pairs stay within **35%** of each other in length |

**Two markup traps.** Do **not** put markup inside `consequences` — `buildLens` wraps those in
`{b|…}` and `{v|…}` itself, and **the parser does not nest**. For the same reason a fully wrapped
`parallelAct` cannot contain `{a|…}` numbers inside it: pick the whole-sentence color or the inner
numbers, not both. Scenario 1 keeps its numbers gold in the *setting* paragraph, which is where the
echo lives, and gives the *act* sentence one unbroken person color.

---

## 3. Two gates that bite when editing scene text

- **`description` may contain no digits; `factBase` must contain some.** Numbers live in the
  situation box.
- **Word overlap between `description` and `factBase` must stay under 30%.** Scenario 1 sits at 21%
  (*tanker, district, plume*). Adding a sentence to `factBase` can push this.

### ⚠️ And the one that has caught me three times

`tools/validate_block5.cjs` finds a field by taking **the first quoted string after the field name**.
A comment placed above `description:` or `factBase:` that quotes anything **becomes the text the gate
measures**, and the gate goes on printing PASS while scoring a comment.

Once, this reported *"0% of description's words reappear in factBase"* — which was nonsense — and the
real figure was 21%.

**Never put double quotes in a comment sitting above one of those fields.** Both scenario-1 comments
now carry a line saying so.

---

## 4. Running order for a scenario

1. Read all six options in one sitting. Write down every question a reader would ask.
2. **Pass D** first — decide the world and the resolving fact, because it constrains everything else.
3. **Pass C** — give each option its method.
4. **Pass B** — audit the numbers against the (now coherent) text. Score candidates against the gates
   before editing.
5. **Pass A** — tidy the scene and situation wording.
6. **Pass E** — rewrite the two CVR lenses. Last, because it reuses the method from C and the
   world from D.
7. `npm run typecheck && npm run validate:block5 && npm run lint && npm run build`
8. Check it in the browser at desktop and at 375px.

---

## 5. Scenario 1's commits, for reference

| commit | what |
|---|---|
| `4b5622f` | the pre-Block-5 page, the dashed "you" line on the example charts |
| `a6eb12b` | the performance audit, Resources spared, the dashboard explanations |
| `5c7f18e` | Preview impact ends with its option |
| `d19425b` | every option says how it is carried out |

Scenario 1's own reasoning is kept where it is used: the long comment above
`id: "chemical_release_escape"` in `block5Scenarios.ts` records the number audit and the method
decision in full.
