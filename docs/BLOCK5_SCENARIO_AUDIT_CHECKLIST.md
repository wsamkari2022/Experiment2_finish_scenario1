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

#### ⚠ A lens is ALLOWED to say something the card never said (19 September 2026)

The advisor audit of scenario 2 flagged the hill school for never explaining why a crew would
search a valley for a household sitting in the designated refuge - the reason, "Nobody is told you
are up there", appears only in the directness view. **The researcher kept it as it is.** The two
views are where the participant meets the consequence they did not foresee; a card that already
contained every consequence would leave the CVR nothing to reveal. This is the same reason gate R4
requires every later consequence to hedge with *may* or *could*. A lens fact missing from its card
is therefore not a defect. A STORY is still held to card facts (§2f): the hill school's hurt story
is safe because the search itself is on the card, in `givesUp`.


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
only whichever value happened to be on top. (Zero-sum except at the edges: a value at 0 cannot come
down and one at 100 cannot go up. Since 25 September 2026 every such cut is recorded; see audit B4.) `docs/BLOCK5_APA_AUDIT.md` measures the OLD rule and says
so at the top; `tools/verify_apa.cjs` is the live specification.

#### The second per-scenario part: `valueHere` (18 September 2026)

Under each value's general definition the APA page now prints **"In this scenario: …"**, from
`valueHere` on the scenario's `ScenarioCVRContent`. The general definitions stay, because Blocks 1–4
and the results page use them. But choosing a value is followed at once by *the options that fit
it*, and in scenario 3 "Reducing harm — how much harm is prevented" used to lead to a draw.
**Each line is written from the options that value leads to** (`value_audit.cjs` prints them), so
what the participant reads before choosing is what they see after. `validate_block5.cjs` fails a
scenario that runs the reflection without all four lines. If an option's numbers change, re-read
the four lines for its scenario.

#### The APA and keep pages, as the researcher reviewed them on 18 September 2026

| Was | Now | Why |
|---|---|---|
| "Which one did **NOT** play a part in your decision to keep this option?" | "Which one **mattered less** in your decision to keep it?" | a question built on NOT is the one most often answered backwards; stored value and −20 unchanged |
| "Which one most changed your mind toward not keeping this option?" | "Which one did more to make you **drop** this option?" | said the same thing twice; stored value and +20 unchanged |
| "two perspectives" | "two views" | the study calls them views everywhere else; *perspective* is kept for the stakeholder |
| each box: the lens's LAST line ("She may wait hours… the hood…") | each box: the lens's OPENING sentence (`act`, `parallelAct`), in plain type | the last line needed the lens beside it; the violet box shouted louder than the plain one, a nudge |
| boxes fixed as directness, then context | boxes in the order the participant met them | the answers below were already in that order |
| "it's your own rule, your responsibility" / "circumstances shaped the numbers" | "what your choice does, and that it was yours" / "the same choice, made somewhere else" | "rule" is wrong in the escapes; the other was jargon |
| "How sure are you about your answers on this page?" | "…about the value you picked?" | it scales the value only, never the lens answer |
| the missed values in two colors, in a fixed order | every missed value, one color, biggest miss first | same kind of thing; ranked by its share of the "missed by" total (`policyShortfallByValue`) |

Kept on purpose: who is asked the lens question. A participant who kept the option after the views
and was then moved by the stakeholder still answers it — the researcher's decision.

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

## 2b. THE ELEVEN AUDITS — what to run, in what order, and what each one catches

The six passes are the WORK. These seven are the CHECKING, and they are not the same thing: every
one of them has caught something after all six passes were finished and every gate was green.

A1, A2, A3 and A8 are automated. A4 to A7 are read by a person. A9, A10 and A11 are both: a
script prints, and a person reads what it printed. **Run them in this order**, because each one assumes the
one before it has already passed.

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
| **A9** | The whole block | the checks in §2e, over all six at once | a defect that only exists ACROSS scenarios |
| **A11** | The value numbers | `value_audit.cjs` in the `/my-advisor` skill, then every number read against its card and against what Blocks 1–4 measure | a number the card does not earn — read against the value's NAME it looked fine |
| **A10** | The stakeholder stories | `npm run validate:people`, then `/my-advisor stakeholder stories` — every story printed under its card, in all three voices | a story about a different option, a person who cannot be a stranger, a timeline the scenario contradicts |

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

## 2e. SCENARIO 6, AND THE AUDIT OF ALL SIX TOGETHER

Scenario 6 is a test of the model, not the participant, and it is kept deliberately light: four
options, no method box, no performance numbers, no reflection and no clarification. **Its passes are
A and D and the A4 read only.** B, C, E and F do not apply. Every edit to it was TEXT ONLY — no
fingerprint moved, so the prediction it exists to test is untouched and `PREDICTION_VERSION` did not
have to move (CLAUDE.md).

### ⚠ The veil only works if the event has not happened yet

The scene said the storm **had torn down** the lines; the role said "you do not know who you will be
**when the storm comes**", and the scene itself said the city decides "**in advance**". Once the lines
are down a participant knows whether their own power is out, and the veil is gone. **Check the tense
of every sentence against the design, not only against the other sentences.**

### ⚠ Two titles built from the same words

"Help the people who would be **hurt the most**" and "Stop the **most** people from being badly
**hurt**" are the worst-off and the fewest-harmed — the two options that most need telling apart —
spelled with the same four words. Each title now says the one thing that separates it.

### ⚠ The mechanism has to fit the scenario's shortage

"Each place gets only a few hours a day" is rationing — rolling cuts when there is not enough power
to go round. Scenario 6's shortage is **one repair crew**. A crew trying to reach everyone makes quick
temporary repairs that keep failing. Same trade-off, a mechanism that belongs to this scenario.

### A9 — the whole-block audit

Some defects only exist ACROSS scenarios, and three passes over one scenario at a time will never
see them. After the last scenario, run these over all six at once:

| Check | Found on 18 September 2026 |
|---|---|
| two titles in one scenario sharing most of their words | scenario 6 only, fixed |
| a percent sign in anything a participant reads | scenario 6's "33%", fixed |
| every situation box opens with a sentence | **3, 4 and 5 still opened with a label** after 1, 2 and 6 were fixed |
| every closing claim of a situation box is true of all its options | all six hold |
| the same title in two scenarios, other than the 4/5 twins | none |
| no two parallel worlds send a participant to the same place | airport, cruise ship, flood rescue, night shelter |
| British spelling in anything a participant reads | none (one false alarm: "folding the rear row **flat**" is the adjective) |

**Read the output rather than trusting it.** The sentence check passed scenario 3's opener — "About
120 eligible patients this month, and 20 doses with a date on them" — because it is long enough. It
has no verb. It was caught by reading the line, not by the rule.

---

## 2f. THE STAKEHOLDER STORIES — audit A10

After the lens, the participant answers yes or no, and then **one person speaks**. They always
argue against the answer just given:

| The participant said | The story shown | What it must be about |
|---|---|---|
| **yes**, I still choose this | the **hurt** story — `identifiedCase` + `harm` | somebody this option costs |
| **no**, I do not want it | the **need** story — `benefitCase` + `benefitLost` | somebody this option would have helped |

Only scenarios 1 to 4 have stories: 24 options, 48 stories. Scenario 5 is a wish and scenario 6 is a
test of the model, so neither runs the reflection. **Whether the participant switches after hearing
this person is the whole stakeholder measurement**, so a story that is untrue, or about the wrong
option, moves a number that goes into the paper.

### The researcher's rules, 18 September 2026

1. **A story is about the option the participant chose** — its title, its summary and its method.
2. **The voice levels are settled and are not to be changed.** The page opens with one of three
   leads, picked from the participant's "Hearing someone's story" score: *Imagine* someone you have
   **only just met** (high), someone you have known for **about a year** (medium), or someone you
   have known for **twenty years** (low). The word *Imagine* was added on 18 September 2026 — see
   below.
3. The other stakeholder rules are settled. What needed checking was whether the stories still
   matched the options after six scenarios' worth of rewriting.
4. **Both stories must follow from the option.** The hurt story from what it costs, the need story
   from what it gives.

### What a script can check, and what it cannot

`npm run validate:people` checks five mechanical things: both stories exist, neither repeats the
option's `givesUp` line, neither opens on a new person ("A child…"), both read correctly after
"They", and the two are similar in length. **All five passed before this audit, and 21 of the 48
stories were still wrong.** Everything below has to be read by a person:

| Read for | Why no script sees it |
|---|---|
| **The story fits ALL THREE voices.** Read it once as someone you just met. | "They are eight years old, sitting behind you" is the participant's own child. Nobody has *just met* their own child, and nobody has known an eight-year-old for twenty years. |
| **The story agrees with the card, the method and the lens.** | The hill-school crew was "checking the school roll" while the card and the lens both send it to "search the blocks". |
| **Every time and number agrees with the situation box.** | Slot nine left "as the fire crossed the valley floor", about the sixth hour, in a valley told it has 8 hours before the front reaches the floor. |
| **The person is the one who is hurt, or the one who is helped.** | The draw's hurt story was told by the patient who WON a place. The person hurt was "the person behind them". |
| **Every *only*, *every other* and *no other* is tested against all six cards** (§2d). | Written once, true once. One rewrite of a different card later and it is false. |

### What the audit found

**21 stories changed across the four scenarios. 27 were read and left alone.** Every fix changed
the story's words only. No voice, gate, fingerprint, number, card or lens moved.

| Kind of defect | Stories |
|---|---|
| **The person could not be a stranger** — the participant's own child | scenario 2: the ridge road's need story, the lift bus's hurt story |
| **Disagreed with its own card or lens** | scenario 1: walking out ("a street you had **cleared**" is the minibus option's word), the minibus's hurt story (it "filled before it reached them"; the lens says it **never came**); scenario 2: the hill school's both stories (the crew, "four households", car seats from a car that stays at the house); scenario 3: the reserve's both stories (the patient "arrives"; the method sends a **nurse** to them) |
| **A time the scenario contradicts** | scenario 2: slot nine and the fire front; the hill-school crew "at the ninth hour", after the front has arrived; the early leaver over the county line "before the smoke", when the scene says smoke has already reached the valley floor |
| **An *only* that is false** | scenario 4: redrawing the rounds (a quarter of the cut still comes off visits), the family rule (the rural cut keeps every town client's visits), shortening every visit (unprovable against the redraw); scenario 3: the reserve (a far-away patient can also be drawn) |
| **A claim the card never makes** | scenario 4: "short by **March**" (the scenario has no calendar), the protected list's hurt story ("managing well is what the rule reads" — the rule reads **living alone**) |
| **The wrong person, or too vague to picture** | scenario 3: the draw's hurt story, "the kind of patient this rule protects", "forty other people lose their week", "counts those decades as worth anything"; scenario 2: "nobody coming for **you**" in a story about them; scenario 1: "no way out of **either** of the two streets", when a person lives on one |

### ⚠ Two options may share a beneficiary, and that is allowed

In scenario 2 the ridge road and the hill school both help the same kind of person: somebody further
back in the convoy line, who has one car fewer ahead of them. Both options take your car off the
highway, so both stories are true. **A participant only ever hears the story for the option they
chose**, so the overlap is never seen. Do not invent a weaker beneficiary to keep them apart.

### ⚠ A self-interested option still needs a stranger who gains

The ridge road helps your own household, and nobody in your household can be someone you have *just
met*. The need story therefore has to find a person OUTSIDE the household whom the option still
helps. Scenario 1's respirator had already solved this — the person behind you in the convoy line
moves up a place — and scenario 2 now uses the same shape.

### The advisor's second read, 18 September 2026

The same day, the stories were read again as a PhD advisor would read them: every mismatch,
contradiction, thing that makes no sense, unclear sentence, missing fact and British word. That read
is now a skill — **`/my-advisor`** (`.claude/skills/my-advisor/`) — with two read-only scripts: one
prints every option exactly as a participant sees it, the other finds British English.

**It found 47 more story fields to change, in stories that had passed the first audit and all five
gates.** The kinds, with one example each:

| Kind | Example, before → after |
|---|---|
| **One word in two senses** | "waiting since the **order** came… the **order** holds" (an evacuation order, then a queue) → "since the district was told to clear out… the **list** holds" |
| **No cause from the participant** | the convoy's ninth block "waited three hours longer" — but nothing said what YOUR choice did → "the line moved only as fast as the blocks ahead of them, and yours was one of those blocks" |
| **A fact the lens contradicts** | the early leaver's staging "collapsed three hours before" — the lens says it **never started** |
| **A person the card cannot have** | "cannot walk **unaided**" for the oxygen patient — their problem is breathing, and the mask is what lets them walk |
| **Missing why** | the minibus's third run "carried you out" — why not the third street? → "by the third run the plume was on the road" |
| **An unclear pronoun** | "They were on the sweep team… **Two of them** spent forty minutes" → "They and a partner spent forty minutes" |
| **A sentence that stops early** | "never asked him whether he was" → "nobody asked him whether he could do it" |
| **British English** | "care home", "walking frame", "standard coaches", "stationary traffic", "any more", "round" (a caregiver's round) |

### ⚠ The stakeholder is IMAGINED — and now the page says so

Scenario 3's role says "nobody close to you is on the list" and scenario 4's says "nobody you know is
a client". The twenty-year voice then said "Someone you have known for twenty years… **is affected**".
Read as fact, that is a contradiction. **The researcher's intent is that the person is imagined**:
picture someone at that distance from you in this situation, and decide with them in mind. The page
never said so. **Every lead now opens with "Imagine"**, and the roles are left exactly as written.
Only the six leads changed; the voice **label**, which is what the database stores as
`stakeholder_text_shown`, did not.

### ⚠ American English is swept from the whole study, not just the stories

The researcher's rule is *always American English*. A story cannot say "walker" while its card says
"walking frame", so the sweep covered every card, lens, scene and role that a story leans on — and
then the scanner ran over every file in `src/`.

| British | American | Where |
|---|---|---|
| walking frame, frame | walker | scenario 2: role, title, cards, lenses, the cruise-ship world |
| care home | nursing home | scenario 2: the ridge road's cost, lens and story |
| standard coaches | regular buses | scenario 2: the lift bus's card and story |
| needs a lift (a ride) | needs the lift (the wheelchair lift) | scenario 2 |
| the fast line through the bends | take the curves fast | scenario 2 |
| signed off (sick) | on sick leave | scenario 2's cruise-ship world |
| key worker, keyworker register | essential worker, essential-worker register | scenario 3 |
| sign off (approve) | approve | scenario 3's lenses |
| round, rounds | route, routes | scenarios 4 and 5 — titles, cards, lenses, the scene, the role |
| council contract | city contract | scenarios 4 and 5, and the night-shelter world |
| washing, medicines | bathing, medications | scenario 4's scene ("washing" is laundry in America) |
| a wash · three days running · queue · member of staff · go on paperwork | being washed · in a row · line · staff member · go to paperwork | scenario 4 and its world |
| turning round · the long way round · to go round | around | scenario 1, the reversibility meter, the fallback lens |
| leave the kit where it is | leave the seats and the mask for others | scenario 1's title |
| breaks into your block (of flats) | breaks into your building | scenario 1's lens |
| any more (meaning "now") | anymore | two Block 5 buttons participants click |
| towards · afterwards | toward · afterward | two notes the database stores for the analyst |

Scenario 4's preview had said "the new **rounds**… the **routes** cannot be redrawn" in one sentence;
the sweep made it one word. Scenarios 4 and 5 moved together, and `npm run validate:twins` held.

**The scanner is a word list, not a reader.** It found "any more" only because reading scenario 3
had turned it up first. Read, then scan, then read what the scanner printed.

### The participant's read, and three more decisions — 18 September 2026

The researcher read the minibus story on screen as a participant would, and asked three things:
what does it mean, is it positive or negative, and why is "you" inside it. Reading it that way
turned up three problems, and he decided each one:

| Problem found by reading as a participant | His decision |
|---|---|
| "Is **affected** by what you chose" does not say good or bad; the reader finds out from the second sentence. The need lead says "would have helped them" at once. | The hurt lead now says **"is hurt by what you chose"**, in all three voices. |
| The minibus story's "third street" is on no card — only the directness lens mentions it. A participant who saw only the context lens meets it for the first time in the story. The walking story's sweep team was the same. | **Card facts only.** A story may use only what the scene, situation, role or option cards say. Both stories were rewritten. |
| Some stories left the participant's part to be inferred ("yours was one of those streets"), which reads as bad luck. | **Keep the "you", and say the blame plainly**: "because you chose the long way out", "the rule you chose". 15 hurt stories changed (11 in scenarios 1 and 2, 4 in scenarios 3 and 4); the need stories already said "would have helped them". |

⚠ **The blame is deliberate — do not "fix" it.** The advisor's first instinct was that "you" in the
story mixes the stakeholder measure with the directness lens, which is the lens that names the
participant. The researcher weighed that and kept the blame, made plain. The rules are written on
`identifiedCase` in `block5Types.ts`.

---

## 2g. THE VALUE AUDIT — every option's four numbers against its own card (audit A11)

**Why it was needed.** Earlier passes read each value number against how the value's NAME sounds.
"Reducing harm" was read loosely as *nobody is singled out*, and on that reading a draw scored 94
looked right. Blocks 1–4 measure something else: **Reducing harm is how much more a person demands
as the harmed group grows** — so an option scores high when the fewest people end up harmed. Read
that way, the draw's own card gave up "Results". The table of what each value measures is in the
`/my-advisor` skill; read every number against it.

**What was checked.** All 96 numbers in scenarios 1–4 (scenario 5 copies 4; scenario 6's pure
champions all fit). 78 fit, 9 contradicted their own card, 9 were doubtful.

| Found | Fixed by |
|---|---|
| S3 draw: Reducing harm 94, card gives up "Results" | **words, not numbers** — now *Draw the 20 names from the patients who cannot wait*: nobody who would lose their chance for good is passed over for someone who could wait |
| S4 even cut (+ S5 twin): its top value was How much is gained 74, card claims no payoff | gained 74 → 50, harm 60 → 44 |
| S3 sickest: helped 40, card says fewer alive "than under any other rule here" | 40 → 35 |
| S3 hold doses back: helped 52, card says "fewer than 20 may be treated" | 52 → 37; gained 45 → 30 (doses may expire) |
| S2 early highway: helped 85 and harm 43 with far blocks "still sitting in the jam" | helped 85 → 45, harm 43 → 20, gained 68 → 80 ("quickest, cleanest run") |
| S2 staged convoy: gained 81, card: "three hours of waiting… air steadily worse" | 81 → 65 |
| S1 respirator harms one person, service road sends four streets past the leak | harm 24 → 45 and 39 → 25; service road gained 71 → 80 ("fastest clear route"), convoy 82 → 70 |
| S1 walking out and sealing in both take nothing from anyone | walk harm 56 → 65, seal vulnerable 53 → 60 — **partly**, see below |
| S3 most likely to survive: vulnerable 53, cost is "the patients the system already failed" | 53 → 30 |
| S4 family cover keeps 180 clients whole; town routes harm the fewest people | helped 41 → 65; harm 28 → 55 (+ S5 twins) |

Every changed number carries a `VALUE AUDIT, 18 September 2026` comment in `block5Scenarios.ts`
quoting the card that justifies it. All eleven checks passed, the random one eight runs in eight.

### ⚠ One champion per value — a fix must name the successor

`validate_block5.cjs` requires each value's highest option to be unique and different for each
value. Every fix above kept all four champions in every scenario. An honest re-score of the whole
scenario 3 harm column was also tested; it passed, but moved the champion and made the draw the best
fit for 0.1% of people — it was set aside for the rewrite, which keeps every number.

### ⚠ Two options that are the same underneath cannot be separated by numbers

Walking out and sealing in both take nothing from anyone. Closing their gap on harm and on the
vulnerable made them near-twins, and **the stability simulation (S4) and the VCI simulation (V5)
failed**: the instrument needs its options to differ. The gentler fix passed. The real remedy, if
wanted later, is in the WORDS — give the two cards a difference as clear as their numbers claim.

### ⚠ "Treat everyone the same" has no value to live on

The even cut and the old draw were both *equal treatment* options, and none of the four values
measures equal treatment. Each had been given a high score on some value to give it a home. With
honest numbers such an option is rarely anyone's best fit (the even cut: 29% of random profiles
before, 2.0% after), which is TRUE of this instrument and belongs in the methods section.

### The redesign pass — options first, calculations later (18 September 2026)

The researcher's decision, in his words: *what is the benefit of the current calculation if the
options don't make sense?* So the options were made to make sense FIRST, and the stability, VCI and
position simulations are to be re-tuned to them afterwards. **Until that pass, three simulations
fail on purpose** — `simulate_vci` (V5), `simulate_stability` (S3, S4) and `simulate_position` (the
3x ratio). Every check on the OPTIONS themselves passes: structure and champions, the metric gates
G1–G7, lenses, stakeholder stories, the scenario 4/5 twin, the APA checks, the planner, the
database and all of the researcher's rules. **Do not undo an option to make a simulation pass.**

**Update, 19 September 2026.** The calculation pass has rebuilt VCI (`docs/BLOCK5_VCI_METHOD.md`) and
Stability (`docs/BLOCK5_STABILITY_METHOD.md`) on these options, and both simulations now pass. Only
`simulate_position` (the 3x ratio) still fails, until its own pass.

| Changed | What it is now | Why |
|---|---|---|
| S1 walking out | **Carry the respirator to the patient it was kept for, and walk them out** (96 · 60 · 20 · 45) | it and sealing in both "took nothing"; now it DOES something for the most vulnerable person |
| S1 sealing in | **Seal your apartment, tell the district office you are staying, and shelter** (50 · 93 · 30 · 30) | its card said nobody is worse off while its cost line sent a sweep team in; now nobody has to come looking |
| S4 even cut (+ S5 twin) | **Keep every care visit, and cut the check-in visits** (35 · 70 · 62 · 80); the card defines a check-in | it sat in the middle of every value and every metric — the choice with no consequence |
| eight numbers | minibus 51→62 vulnerable, 45→62 harm; respirator 41→25 helped; convoy 67→55 vulnerable (S1); ridge road 48→25 and early highway 45→30 helped, fill every seat 54→62 vulnerable (S2); sickest 57→42 harm (S3) | each rank order now matches its card |

**Third pass, 26 September 2026** (fresh-eye audit D1 / Fix 5, the researcher's approval): two numbers the
cards did not earn, both in scenario 2. *Fill every seat* reducing harm 50 → **62** ("not anybody else's
place in the line"; it cannot put more risk on others than the convoy at 59). *Leave immediately*
protecting the vulnerable 44 → **35** (it leaves the farthest blocks, where the walker residents live, in the
jam; 35 rather than lower keeps it the best fit for about 1 person in 100). Words unchanged; every check
passed before and after.

**Fourth pass, 26 September 2026** (blind rater study, audit Fix 6 Parts A and C, the researcher's
approval): nine numbers where three blind raters agreed with each other and sat 20+ points from the study,
each moved to their average - convoy 61→87 and respirator 45→22 harm (S1); staged convoy 59→83 and give
your seats 56→83 harm, Leave immediately 35→14 vulnerable and 30→8 helped (S2); cut only where family covers
58→83 vulnerable, the rural routes 55→15 harm, protect full visits 38→60 helped (S4, and S5's copies).
Reducing harm now follows the scenario's own line, not the head count of the first pass. "Leave
immediately" is kept at the raters' reading although it now loses to the ridge road on every value (the
researcher's choice). **The position check passes since this pass (3.3x)**; the numbers moved because the
raters read the cards that way, not for the check. Three more numbers wait for new words (Part B).

Numbers are vulnerable · harm · gained · helped. Each redesigned option carries a `REDESIGNED`
comment with every number and metric justified from its card; the eight numbers carry `VALUE AUDIT,
second pass` comments. The ids did not change, because the database stores them. The method kind
"even" became "task" (and `audit_cvr_rules.cjs` R3 learned its words).

*(Since 26 September 2026 this section and the sidebar's "Your value priorities" are one panel, "Your
values in this scenario", in `Block5ValuesPanel.tsx`; the meanings below are unchanged.)*

**A new section, "How to read the four values in this scenario"** (`Block5ValueGuide.tsx`), sits
under the cumulative performance bar in scenarios 1–5 and prints each value's meaning in that
scenario from `valueHere` — the same lines the APA page uses. Scenario 5 borrows scenario 4's.
**Scenario 6 has none on purpose**: its four options ARE the four values, and naming them would turn
the prediction test into "pick your value".

After the pass, card-to-number rank correlation (by the method of audit A11): scenarios 1 and 2
0.99 (the only gaps are pairs the cards treat as equal), scenarios 3, 4 and 6 1.00.

### ⚠ Changing numbers moves who is aligned — check the best-fit shares

`value_audit.cjs` prints how often each option is the best fit. After this audit, for example,
scenario 3's essential-worker rule fits 39% of profiles (was 26%) and most-likely-to-survive 12%
(was 22%). Nothing failed, but these shares decide who meets the reflection, so read them after
every change to a number.

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
9. **Audits A1, A3, A5, A6, A10, A11** — the gate suite, the researcher's rules, the rendered-lens
   read, the card-versus-story read, the stakeholder stories and the value numbers. See §2b; A5, A6 and A10 are read by a
   person and are the ones that keep finding things after everything is green.
10. `npm run typecheck && npm run validate:block5 && npm run audit:rules && npm run lint && npm run build`
11. Check it in the browser at desktop and at 375px.
12. **Audit A7** — if any audit above found a NEW KIND of defect, re-run that audit over every
    scenario already finished. The instrument is new; the defect is not.
13. **Audit A9**, once the last scenario is done — the whole-block checks in §2e, over all six.

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
