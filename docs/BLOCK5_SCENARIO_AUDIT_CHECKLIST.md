# Auditing a Block 5 scenario — what was done to scenario 1, and what to repeat

**Written:** 16 September 2026, after finishing the audit of scenario 1
(`chemical_release_escape`). **Passes E and F added 17 September 2026.**
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
| `factBase` | "Every option … **gets you out** within six hours" | "Every option … **keeps you alive for** the six hours" |
| `gains` (convoy) | "You get out well **inside** the six hours" | "You get out well **within** the six hours" |

Scenario 2 got the same first two, plus the closing-claim fix:

| Field | Before | After |
|---|---|---|
| `factBase` | "**Eight hours before** the front reaches the valley floor." (a fragment) | "**You have 8 hours before** the front reaches the valley floor." |
| `factBase` | "gets your household **out inside** the eight hours" | "**keeps your household alive for** the eight hours" |
| `STAKE_VIEW` | "your own way out as well as **theirs**" | "your own way out **and your household's**" |

The reasons generalize:

- **Name the cause, do not describe it.** "Chlorine is coming off it" made the reader carry an *it*
  back two clauses and read "coming off" as detaching rather than leaking.
- **Open the situation box with a sentence, not a label.** A fragment leaves the reader working out
  whose six hours these are, and the first four words should carry the number everything depends on.
- **Watch prepositions doing double duty.** "Gets you out inside the six hours" puts *out* and
  *inside* in one breath. The preposition meant time; a reader hears space. **It hides in `gains`
  and `consequence` too** — scenario 1's convoy card still said "well inside the six hours" a day
  after the situation box was cleared of it, because that pass only looked at `factBase`. Grep the
  whole scenario for the phrase, not just the field you are editing.
- **⚠ The closing claim of `factBase` is usually false, and it is the easiest line to skim past.**
  Both scenarios said every option *gets you out* inside the time — and both have a **shelter-in-place
  option that never leaves**. Scenario 1 said it while its own Pass B had already scored sheltering
  **speed 18** on the grounds that it never gets you out, so the file contradicted itself in two
  places at once. The sentence is doing real work (these six are equally viable and differ only in
  cost), so keep that half and drop the half that is untrue: **"keeps you alive for the N hours."**
  Check this line against the shelter option of every scenario that has one.
- **Avoid category nouns for places people live.** "The housing" is incident-report language.
- **A pronoun in the first row of a card points at nothing.** Scenario 2's role card opened with
  "your own way out as well as theirs" when *theirs* is introduced on the row underneath. Naming the
  group costs a few words and removes the only part of the card that had to be worked out.

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

#### Scenario 2 went further: a world has a SOCIAL shape too

Scenario 1's resolving fact was physical — who owns a vehicle, which road it may use. Scenario 2
needed a second kind, and it turned out to be the stronger one.

**The question that opened it:** *why is your household fifth of nine?* The number was on the card
and meant nothing. Making the blocks run in order of how near the highway junction each one sits,
and saying that the big houses on the cleared shelf have their own road and never needed a slot,
answered four questions at once with a single clause:

- why your slot is fifth — you live in the middle of the valley, and of its prices;
- why two neighbors have no vehicle and three more have none;
- why *the last three blocks* are the ones trapped when the early-highway option jams the road;
- why the ridge road exists at all, and why taking it takes something that money built.

**It also placed the participant in the middle of the structure rather than at either end**, which
is where the choices are actually hard. A participant who is clearly among the privileged, or
clearly among the abandoned, has a much easier time deciding.

#### ⚠ A framing clause must RECALL a fact, never introduce one

Scenario 2's context lens said the ridge road *"was cut for the estates above the treeline"* — and
nothing in the scenario said so. A claim about **why** some households sit further back was therefore
appearing for the first time **in the reflection**: after the choice, under the most persuasive
conditions the block has, and **only for the participants whose choice had been judged misaligned**.

The fact moved into `factBase`, where everyone meets it before choosing, and the clause now points
back at something already read. Fairer, and much harder to argue with.

**Check every `framingClause` against `factBase` before writing a lens.** If the clause knows
something the situation box does not, the fact is in the wrong place.

#### ⚠ Adding a place gives it everything else that is already there

Putting the refuge school on the same shelf as the big houses was the right call — and it instantly
broke the school's own claim. The shelf has a road: the ridge road was cut to serve those houses. So
*"the only way up is a footpath"* was false the moment the school moved there.

The fix is the shape scenario 1 already used: **the road exists and the participant may not use it.**
With the ridge road closed, the footpath is the only way up *for them*, which makes the claim true
instead of merely asserted — and ties two facts together that were sitting adjacent and unrelated.

**When you move something into an existing location, re-read every other fact about that location.**

#### ⚠ The advisor read — four things Passes A–D all missed

Scenario 2 passed every gate, and then a deliberate hostile re-read found six more. **Run this as a
separate step, after B/C/D and before E.** None of these is catchable by a validator.

**1. COUNT THE SEATS. An option's premise can be arithmetically impossible.**
The car holds **seven**. The household is **four**. "Give your car seats to the two frame users"
is **six** — they all fit, and the participant was being asked to sacrifice something the vehicle
never required. The option had no reason to exist. The repair was the two walking frames: the rear
row folds flat for them, a seven-seater becomes a five, two of those five are the neighbors', and
three seats is not four. **Take every capacity stated anywhere in the scenario and check it against
every option that spends it.**

**2. AN OPTION MUST NOT ARGUE AS IF ANOTHER OPTION'S RESOURCE DID NOT EXIST.**
The same card said its seats "were the only ones in the valley they could actually get into" —
while the situation box lists **one bus with a wheelchair lift**, which is exactly what a person
using a frame boards. Admitting the bus turned the option into something better than it had been
pretending to be: a **swap**. They take your slot at the third hour; you take their places on the
last vehicle at the sixth. **Read each option's claim of uniqueness against the full fact base.**

**3. CLOSE THE CLOCK.** Nine slots with the fifth called at three hours puts the ninth at about six.
The lift bus is "the last vehicle scheduled to leave" and the household was waiting **five** hours
for it — which places the last vehicle out in the middle of the queue. **Put every duration in the
scenario on one timeline and check it closes.** Six hours closes this one, and agrees with the
option's own vignette, which already had them "still in the valley at the seventh hour".

**4. ONE VULNERABILITY PER PERSON, AND DO NOT SWAP THEM.** The household has two and they are not
interchangeable: a child who needs an inhaler in smoke, and a mother who walks with a frame. One
vignette made a six-hour wait in a smoky hall cost **the mother her chest** — a respiratory injury
to the person whose established vulnerability is mobility — while the child, whose inhaler the line
directly above says is running low, walked away unharmed.

**Also: do not hand anyone a diagnosis the role did not give.** One card said "an asthmatic child"
where the role says "needs an inhaler in smoke". That is an exposure, not a condition, and the other
five cards all say inhaler.

#### ⚠ One ordering axis, not two

The scene said smoke had reached *the lowest streets*, which invites a reader to order the nine blocks
by height. The situation box ordered them by distance from the junction. Two answers to "why is mine
fifth" is worse than none, and the whole social reading rests on there being exactly one. Height is
now scenery in the scene paragraph and sequence lives only in the facts.

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

#### Scenario 2's parallel world, and how to choose the next one

**A cruise ship being abandoned.** Seven facts, seven partners: eight hours, six hundred people
across nine decks, nine boat groups, one boat lowered by hoist, one crew stair cut for the top-deck
suites and held for the crew, one open deck up a ladder. It replaced a cargo ship that had **three
nouns and no numbers at all**, which cannot mirror seven facts — so the lens was asking a
participant to notice a resemblance that was not on the page.

**It had to be a PASSENGER ship, not a cargo one.** Scenario 2's world is now social: the blocks run
in order of how near the junction each sits, and the big houses on the shelf have their own road.
A ship carrying passengers has exactly that shape already — decks, boat groups, a stair cut for the
suites — and it has it without anybody having to explain it. A cargo ship has a crew and no class
structure to mirror.

> **⚠ NOT THE TITANIC, and this generalizes.** The researcher named it as an example of scale and it
> is the right scale; it is the wrong ship. A participant who recognizes a real disaster brings its
> whole script with them — women and children first, the locked gates, the band — and that script
> does the persuading instead of the structure doing it. Worse, it arrives with a **verdict on the
> class question already reached**, which is the exact variable the lens exists to put in front of
> them unsettled. **Never pick a parallel world a participant can name.**

**Three things only a RENDERED read catches.** All the gates passed and then reading the twelve
lenses as printed text found:

- **the valley's weather in a world that has none.** "An hour in the smoke" walked into a ship that
  floods rather than burns. Check every noun in the parallel consequences against the parallel world.
- **a shortcut that read as a slog.** The ridge road is the FASTEST way out; its partner said "forty
  minutes up to the boat deck", which reads as a long climb. The transplanted option was no longer
  the option being transplanted. It now "puts them at the boats forty minutes ahead of their group".
- **"she" for the ship inside a sentence about people.** The setting establishes the pronoun, but a
  consequence line is a list of what happens to passengers, and a reader meeting "when she lists
  further" there has to stop and work out that it means the vessel.

#### The new instrument: `npm run audit:rules`

`tools/audit_cvr_rules.cjs` checks the **researcher's** ten rules rather than the repo's gates, and
writing scenario 2 the two disagreed twice — both times the repo's gates were the ones missing
something. The repo bans "same" in a heading and prompt only; R1 reads every word of both lenses.
The repo checks the 24-hour rule **nowhere at all**; R2 does.

**It is not in the blocking chain, deliberately.** Scenarios 3 and 4 have not had Pass E, so they
would fail half of it today, and a validator that cannot pass is a validator that gets switched off.
It reports on every scenario and **fails only for scenarios that have finished Pass E**, which it
detects by the presence of an authored `parallelAct`. Each scenario arms itself as its lenses land.

**Its TODO list for scenarios 3 and 4 is their Pass E work queue** — run it first and work the list.

**One gate got stronger because of this pass.** `validate_block5.cjs` used to excuse every option in
scenario 2 from "the context lens never says you", on the grounds that the participant's own
household is the subject there. That was never a reason: it is a reason the DIRECTNESS lens says
"you", not a reason the context lens may. Scenario 2's parallel now says "a passenger", "their
group" and "a crew" throughout, so the exemption had nothing left to excuse and is gone. **All 30
options are held to one rule.**

**Two markup traps.** Do **not** put markup inside `consequences` — `buildLens` wraps those in
`{b|…}` and `{v|…}` itself, and **the parser does not nest**. For the same reason a fully wrapped
`parallelAct` cannot contain `{a|…}` numbers inside it: pick the whole-sentence color or the inner
numbers, not both. Scenario 1 keeps its numbers gold in the *setting* paragraph, which is where the
echo lives, and gives the *act* sentence one unbroken person color.

---

### Pass F — the APA page

Done for scenario 1 on 17 September 2026. Most of this pass is **global** — the page is one
component, so rewriting it rewrote it for all six scenarios at once. Only one piece is per-scenario.

**What was deleted outright:**

- **Question 1**, *"which is closer to the truth — I do put X above Y, or I chose it for this
  situation?"*, and every profile bump behind it;
- **the paragraph that asserted a trade**, *"This option delivers X — which you rated 100 out of 100.
  To do that it gives up Y — which you rated 99 out of 100."* An option usually falls short on
  several of the four values at once, so naming exactly one as the casualty described a swap the
  participant had not made, and then asked them to defend it. Question 1 had no subject without it.

**What the page now does, in order:**

1. keeps *"We noticed something worth a closer look…"* unchanged;
2. **the mirror table** — two columns, *Where you decided* against *The other place*, one row per
   number, with the numbers gold on both sides;
3. **the shortfall** — "this option **missed by N points** in total. It fell short on **two** of your
   four values — *reducing harm* and *how many are helped*";
4. **the one remaining question**, unchanged: pick the value you most want weighted, plus the
   confidence rating.

**Three rules that were decided here:**

1. **Show the distance, never the fit score.** "Missed by 34" is a distance from their own stated
   values. "Matched 66 out of 100" is a grade — a verdict wearing a number's clothes — and the
   project's standing rule is that no participant is shown an alignment verdict while they are still
   choosing. The shortfall is `policyAlignmentShortfall`, the uncensored penalty, before the clamp.
2. **Name every value it fell short on, in words.** Commonly two or three. Naming one was what made
   the old trade sentence wrong.
3. **The table is shown only when the LAST lens they looked at was the context lens.** Whoever ended
   on the directness lens never met the other world, and a table comparing their district to a place
   they have not read introduces a world rather than reveals one. `lastLensSeen` carries this up from
   `CVRReveal`, which reports on every toggle — `coord.framing` cannot answer it, because that is the
   lens shown **first** and the participant can toggle back.

**Why the table exists at all.** Pass E forbade the lenses from saying *same*: they print the other
world's numbers and leave the participant to notice. That is deliberate and it has a price — somebody
who does not notice gets nothing from the context lens. The table is where the noticing is made free,
**after** the choice and the reflection are over, so it cannot steer either.

#### The only per-scenario part: `mirror`

An optional field on `CVRParallelWorld` in `block5CVRContent.ts`: one `{ here, there }` row per
number, authored, with the numbers wrapped in `{a|…}` on both sides. Scenario 1 has six rows — six
hours, four thousand people, one driverless vehicle, one piece of breathing gear, a list nine long,
one lane past the hazard.

**It is authored and not derived on purpose.** The numbers appear in prose on both sides, in
different sentences and different orders, and a parser clever enough to pair them up would be one
rewording away from pairing them up wrongly.

**A scenario with no `mirror` simply shows no table**, which is correct rather than a gap: a scenario
whose context lens has not been rewritten has no second world worth tabulating. So scenarios 2–6 lose
nothing until their Pass E is done, and gain the table the moment their rows are written.

**Also changed, and not per-scenario:** the profile rule behind the one remaining question is now
**+30 to the value named, −10 to each of the other three** — zero-sum, where the old rule pushed down
only whichever value happened to be on top. `docs/BLOCK5_APA_AUDIT.md` measures the OLD rule and says
so at the top; `tools/verify_apa.cjs` is the live specification.

#### Question numbering: a page that asks one thing must not count it

The APA page printed **"QUESTION 2 OF 1"** — the card kept the position it held when the page asked
two questions, while the total had dropped to one. Fixed on 17 September 2026 by making the count
disappear entirely when there is nothing to count: `QuestionCard` now drops **both** the numbered chip
and the "Question n of m" eyebrow when `index` and `total` are omitted, and the eyebrow reads just
*Question*. It also stops falling back to a literal **"?"** in the chip, which read as a question the
interface could not identify.

Numbers are passed **only** on the pages that really gain a second question — the ones where the
participant generated the other reflection lens. That is the CVR confirm page and the APA page, and on
both of them the condition is exactly `altViewGenerated`.

**When auditing scenarios 2–6, check any screen that asks a question:** the number on a card is a
position in a list, and it goes stale the moment a question is added or removed anywhere above it.

#### ⚠ Gate A5 is expected to be soft until all six scenarios are audited

`A5` in `tools/simulate_stability.cjs` asks whether naming a value changes how the **next** scenario
labels the options. It tests scenario **2**, which still carries its un-audited numbers — so today it
is measuring a clarification made against scenario 1's new profile shape and read against scenario 2's
old option fingerprints. The two are not yet from the same design.

It passes comfortably (**78.0%**, floor 50%), so nothing is blocked. But the honest reading is that
**this gate is not fully meaningful until Passes B and D have been run on scenario 2**, because until
then the fingerprints it reads were not chosen under the rules the audit imposes.

**Re-run it after each scenario's Pass B** (`npm run validate:stability`) and watch the percentage.
It should hold or rise as the option profiles get further apart — Gate G6 pushes them at least 10
points apart, which is exactly what gives a clarification something to cross. If it ever **falls**
after an audit, the new fingerprints have been bunched together, not spread.

The same caution applies to `tools/apa_walkthrough.cjs`, which prints scenario 2's labels before and
after a clarification: a persuasive demo today, built on numbers that are going to move.

---

## 2b. THE SEVEN AUDITS — what to run, in what order, and what each one catches

The six passes are the WORK. These seven are the CHECKING, and they are not the same thing: every
one of them has caught something after all six passes were finished and every gate was green.

Four are automated and four are read by a person (the rendered read counts twice). **Run them in
this order**, because each one assumes the one before it has already passed.

| # | Audit | How | What only this one catches |
|---|---|---|---|
| **A1** | The gate suite | `npm run validate:block5` | numbers outside 0–100, metrics that restate a value, options too alike, the G5 trade-off collapsing |
| **A2** | Candidate scoring | scratch script, **before** editing | a number that breaks a gate you would otherwise discover three edits later |
| **A3** | The researcher's rules | `npm run audit:rules` | the 24-hour rule, "same" anywhere in a lens, a context lens that says "you", a missing mirror row |
| **A4** | The six-in-a-row read | by eye, all six cards in order | capacities that do not add up, an option arguing as if another's resource did not exist, a clock that does not close, harms on the wrong person |
| **A5** | The rendered-lens read | print all 12 lenses as plain text | the first world's nouns in the second world, a fast option that reads slow, a pronoun that needs working out |
| **A6** | Card-versus-story | print card next to both lenses | a card that claims something its own reflection disproves |
| **A7** | Run it backwards | every audit, on the scenarios already signed off | the defect you only learned to see while doing the NEXT scenario |
| **A8** | The matched pair | `npm run validate:twins` | scenario 4 and scenario 5 drifting apart, which nothing else can see |

### A8 — scenarios 4 and 5 are one option set written twice

**Read this before touching scenario 4.** From block5Mirror.ts, on the measure the pair exists for:

> Because the content is held exactly constant, ANY difference between the two is attributable to
> position and to nothing else.

That sentence is the claim, and `tools/validate_twins.cjs` is the only thing that makes it true.
Edit one half alone and **every number downstream still computes** — the position effect, the
decided-versus-wished comparison, the whole matched pair — and silently starts measuring CONTENT
instead of POSITION, which is the single confound the design was built to remove.

**A check already existed and compared TITLES ONLY.** Mutation-tested against five deliberate
one-sided edits, that version would have passed three of them: a rewritten `givesUp`, a changed
performance number and a changed fingerprint. All five are caught now, and the gate names the
option and the field.

It compares every authored field by reading the objects' own keys rather than a list written down
somewhere, so a field added to `Block5ScenarioOption` later cannot slip through un-compared. What it
deliberately ignores: the prefixed ids, the recipient half's absent `cvrSeed`, and the two
scenarios' own situation boxes, roles and titles — those are meant to differ.

**ONE PERMITTED DIFFERENCE, since 18 September 2026: the method box's detail line.** The
researcher's decision. Scenario 4's detail lines were shortened so none repeats its own card;
scenario 5 keeps its longer ones. Scenarios 5 and 6 are kept deliberately light - they test the
position effect and nothing else, with no reflection and no clarification - and scenario 5 already
differs from 4 in running no misaligned check at all. **Only the detail line is exempt:** the
method's icon and bold name are still compared, and a mutation test confirms a one-sided change to
either, or to any other field, still fails the gate.

**In the blocking chain**, unlike `audit:rules`, because it passes today. A validator that cannot
pass gets switched off; one that can, and does, is worth stopping a build for.

### A1 — the gate suite

`npm run validate:block5`, and it must print all nine PASS banners. It is the guard on the scoring
model and on what reaches MongoDB; treat a failure as a blocker, not a warning.

### A2 — score candidate numbers BEFORE editing the file

`validate_block5_metrics.mjs` reads `src/experiment/block5Scenarios.ts` **relative to the current
working directory**, so a scratch directory holding a patched copy of that one file runs the shipped
gates over numbers that have not been committed to anything:

1. copy `block5Scenarios.ts` into `<scratch>/src/experiment/`, with the candidate numbers in it;
2. `node <repo>/tools/validate_block5_metrics.mjs` with `cwd` set to the scratch directory.

**Do not reimplement the gates in the scratch script.** A checker carrying its own copy of the math
drifts from the code and then certifies the drift.

This is not optional bookkeeping. Scenario 2's first candidate set priced the ridge road's two deaths
into its durability and sent `vulnerability x performance` to **r = 0.50** against a ceiling of 0.30.
The harness caught it before a single character was written to the repo.

### A3 — `npm run audit:rules`

Ten rules, the ones the researcher actually stated, in `tools/audit_cvr_rules.cjs`. See §2 Pass E.
**It disagreed with the repo's own gates twice while scenario 2 was being written, and both times the
repo's gates were the ones missing something.**

### A4 — the six-in-a-row read

Read all six cards in one sitting, in order, as a participant would, hunting for four specific
things. See the "advisor read" box in §2 Pass D for what each one found. **Scenario 2 passed every
gate and this step still found six defects, one of which had left an option with no reason to exist.**

### A5 — read the lenses RENDERED, not in the source

Print all twelve with the markup stripped and the lines wrapped. Reading them in the source file does
not work: the `{w|...}` and `{a|...}` marks break up the sentences, and the setting paragraph is
stored once and repeated twelve times, so it is invisible until it is rendered beside each act.

Three defects in scenario 2 survived every gate and every source read, and all three were obvious
within a minute of the rendered text:

- **the first world's weather in the second.** "An hour in the smoke" walked into a ship that floods
  rather than burns. **Check every noun in the parallel consequences against the parallel world.**
- **a fast option that read as slow.** The ridge road is the FASTEST way out; its partner said "forty
  minutes up to the boat deck", which reads as a long climb, so the transplanted option was no longer
  the option being transplanted.
- **a pronoun that needed working out.** "when she lists further" means the vessel, in a sentence that
  is otherwise a list of what happens to people.

### A6 — card versus story

Print each option's `method`, `gains`, `givesUp` and `moralTension` directly above its `act` +
consequences and its `parallelAct` + parallel consequences. **A card that claims something its own
reflection disproves is the single most common defect found so far, and it has now appeared in both
finished scenarios:**

| | scenario 1, shelter | scenario 2, hill school |
|---|---|---|
| the card said | "no seat, no mask, no road, **no crew time**" | "no seat, no lane, no fuel and **no crew time**" |
| its own lens said | "a sweep team breaks into your block… **two of them may spend forty minutes** in the worst air of the night" | "a crew comes back into the valley… **two of them may spend an hour** in the smoke" |

Both were fixed the same way: drop the false clause from `gains`, and move the real cost into
`givesUp`, where the option's costs belong. **Neither number moved** — resources spared was already
97 and 93 rather than 100, and the Pass B notes already said the crew check is why. Only the cards
were claiming to be free.

> **The shape to look for: an option that says it takes NOTHING.** There is one in most scenarios —
> the shelter, the refuge, the do-nothing. It is the option most likely to overclaim, because
> "takes nothing" is its whole pitch, and the sweep team that comes looking for it is exactly the
> cost its pitch forgets.

### A7 — run every audit BACKWARDS over the scenarios already finished

**This is the one that is easiest to skip and it has already paid for itself.** A4, A5 and A6 were
all invented while auditing scenario 2, which means scenario 1 was signed off without them. Running
A6 backwards over scenario 1 found the crew-time defect above, in a scenario that had passed every
gate for two days.

**Every time an audit finds a new KIND of defect, re-run that audit on every scenario already done.**
The instrument is new; the defect is not.

---

## 2c. WHAT AN ALLOCATION SCENARIO NEEDS THAT AN ESCAPE DOES NOT

Scenarios 1 and 2 are escapes: somebody travels, and it is over in a night. Scenarios 3, 4 and 5
hand out a short supply and nobody goes anywhere. Six things in the shared code were written for an
escape and had to be taught the difference. **Scenarios 4 and 5 are the same shape as 3, so expect
all six again.**

| What | Escape | Allocation |
|---|---|---|
| `methodLabel` | "How you travel" | **"How the doses are picked"** |
| `method.kind` | car / bus / van / foot / stay | **score / list / draw / hold** (added for scenario 3) |
| `horizon` | Within the hour / Before midnight | **The same day / Before the next batch** |
| `closingLine` | "the way you chose to leave" | **"the rule you chose to hand them out by"** |
| what counts as "soon" | minutes | the same day |
| what counts as "too far" | a week | **a year** — a month is inside the cycle |

### ⚠ The time labels and the consequence text must agree

Every lens prints its two consequences under time labels, and they were **hardcoded to one night**.
Scenario 3's clock is a month, so the page said, on one line:

> **Before midnight:** the people found too late may wait another month.

`horizon` on `ScenarioCVRContent` fixes the directness lens. **Then it broke the context lens the
other way**, because the parallel world is a flood rescue that is over before morning:

> **Before the next batch:** the ones who cannot grip may wait for a pass that never comes.

There are no batches in a flood. **The horizon belongs to the WORLD, not the scenario** — there is a
second `horizon` on `CVRParallelWorld` for exactly this. Check both when the clocks differ.

### ⚠ The closing line names an action the participant may not have taken

The directness lens ends "*No list and no system decided this. You did. If it happens, it happens
because of the way you chose to **leave**.*" Scenario 3's participant sits on an allocation team.
They leave nowhere, and the option they picked may literally **be** a list — so the line denied the
thing the card had just described and attributed an act they never performed. Attribution is the
whole instrument of this lens. `closingLine` overrides it.

### ⚠ The concreteness gate only sees a SINGLE digit

`CONCRETE` in validate_block5.cjs is `/\b(\d|two…ten|one|month|week|day|hour|year|night|…)\b/i`.
`\b\d\b` matches **one** digit between word boundaries, so **"20" and "120" do not satisfy it**, and
neither does "twenty". Scenarios 1 and 2 never noticed because they say "four hours" and "nine
groups". A scenario whose numbers are all in the twenties and hundreds must carry a **timescale**
in every `soon` + `later` pair. "tonight", "morning" and "dawn" do not match either — `\bnight\b`
does not fire inside "tonight".

### ⚠ Re-read the FINGERPRINT after rewriting a card

Pass B audits the five performance metrics. **It does not look at the four policy values**, and a
rewritten card can end up contradicting them. Scenario 3's reserve option carried
`gainResponsivenessSensitivity: 82` — second highest in the scenario — on the one option whose
defining feature is that some of its doses are never used, directly under a `givesUp` line reading
"Certainty. Fewer than 20 patients may be treated this month." Now 45.

**Also watch for an option that is runner-up on three values of four.** That gives a participant
very little to choose against, and no gate measures it.

### ⚠ The vulnerability champion must not be the WORST performer

No metric gate says so — G5 asks only for 3rd or worse — and `npm run validate:position` fails if it
is. That suite builds a **protector** who deliberately takes the weakest option and checks that the
results page reports them as having given up both values and performance. If the weakest option is
the protector's own best fit, their departure is zero, the sentence cannot be produced, and a whole
quadrant of the position analysis becomes unreachable for the archetype the study cares most about.

**Put the champion 3rd, 4th or 5th, and make the worst performer the option furthest from a
protector** — in scenario 3, the rule that maximizes the value a protector scores lowest.

---

## 2d. WHAT SCENARIOS 4 AND 5 TAUGHT

### ⚠ A6 has to cover the STAKEHOLDER story, and every "only" in it

The person who speaks after the lens makes the case for an option by saying **nobody else would
have helped them**. That word *only* is the whole force of the story, and it is the easiest thing
in the scenario to make false: rewrite one card precisely and a story on another card stops being
true. **Scenario 4 had six of these, and running the check backwards found a seventh in scenario 3.**

| The story said | Why it was false |
|---|---|
| "Every other option leaves that driving time exactly where it is" | dropping 60 clients, or the rural rounds, also cuts driving |
| "the only rule under which they are still a client at all" | four of the six rules keep every client |
| "Every other rule here takes their hours" | the protected list keeps the hours of anyone who lives alone |
| "the only rule here that does not rank them at all" | shortening every visit ranks nobody either |
| "Under every other rule their visit is cut" | the family rule also protects somebody with nobody nearby |
| (scenario 3) "Every other rule reads their condition as a reason to treat someone else" | the draw gives the sickest EXTRA slips |

**The method:** print every `benefitLost` containing *only*, *every other*, *no other* or *any
other*, and test it against all six cards. The fix is always the same — find the person that
option, and that option alone, would help. It usually makes a better story than the one it replaces.

### ⚠ A fix can create the next contradiction — re-read after every fix

The A6 fix for the protected list gave its stakeholder "a daughter nearby", to make the story true.
The card still said the protected 50 "live alone **with no other support**" — and a daughter nearby
IS support. The fix had made the card and its own story disagree. **After fixing a story, re-read the
card it belongs to.**

### ⚠ Two options can be the same option in different words

"Cut every round by the same share" and "Shorten every visit" read differently and **did the same
thing**: the first one's own reflection said *every visit is a quarter shorter*. G6 did not notice,
because their NUMBERS were far enough apart. Now one takes whole visits away and keeps the rest full
length; the other keeps every visit and shortens each. **Three full visits against four short ones
is a difference a reader can see.** Check the MECHANISM of every pair, not just the metrics.

### ⚠ The unit has to work for every option's arithmetic

The box said 1,600 **visit**-hours. One option recovers 300 of the lost hours from **driving**, and
driving is not visit time, so under the box's own unit that option could not work. The budget is
caregiver-hours, driving included — exactly 40 caregivers at 40 hours. Stating how much of it is
driving then exposed a hidden cost: shortening every visit keeps every trip, so the visits absorb
the whole cut and come out **a third** shorter, not a quarter.

### ⚠ Count every "about N people" against the capacity it has to absorb

"Twelve clients lose a visit" cannot find 400 hours a week — that is over thirty hours each, and
nobody gets thirty hours of home care. A client is about five visit-hours plus their share of the
driving, so it takes about 60.

### ⚠ The twins are read from TWO chairs

Scenario 4's reader is the coordinator; scenario 5's is a caregiver who decides nothing. A shared card
that asks **"Do you protect a few people completely, or many a little?"** is asking the caregiver
about a power they were explicitly told they do not have. **Every "you" on a shared card has to be
true from both seats** — ask the question impersonally.

### ⚠ The time label and the line under it must not repeat each other, or disagree

Satisfying the concreteness gate by adding "in the first week" to a line printed under the label
**"The first night"** produced *The first night: 60 people are turned away in the first week.* **The
gate reads `soon` and `later` together**, so as long as the `later` line carries a timescale, the
`soon` line does not need one of its own — and should not echo the label above it.

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
6. **Audit A4**, the six-in-a-row read — see §2b. Do it before the lenses, because a lens written
   on top of a card that does not add up inherits the fault.
7. **Pass E** — `npm run audit:rules` first to see the work queue, then rewrite the two CVR lenses. Last of the scene work, because it reuses the method
   from C and the world from D.
8. **Pass F** — write the scenario's `mirror` rows. Nothing else in Pass F is per-scenario, so this
   is a short step: one `{ here, there }` pair per number, taken from the world Pass E just built.
9. **Audits A1, A3, A5, A6** — the gate suite, the researcher's rules, the rendered-lens read and
   the card-versus-story read. See §2b; A5 and A6 are read by a person and are the two that keep
   finding things after everything is green.
10. `npm run typecheck && npm run validate:block5 && npm run audit:rules && npm run lint && npm run build`
11. Check it in the browser at desktop and at 375px.
12. **Audit A7** — if any audit above found a NEW KIND of defect, re-run that audit over every
    scenario already finished. The instrument is new; the defect is not.

---

## 5. Scenario 1's commits, for reference

| commit | what |
|---|---|
| `4b5622f` | the pre-Block-5 page, the dashed "you" line on the example charts |
| `a6eb12b` | the performance audit, Resources spared, the dashboard explanations |
| `5c7f18e` | Preview impact ends with its option |
| `d19425b` | every option says how it is carried out |
| `08f0b67` | both CVR lenses rewritten, and this checklist |

Scenario 1's own reasoning is kept where it is used: the long comment above
`id: "chemical_release_escape"` in `block5Scenarios.ts` records the number audit and the method
decision in full.
