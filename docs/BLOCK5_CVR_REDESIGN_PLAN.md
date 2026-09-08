# CVR redesign — one page, one question

**Status:** plan updated with your answers. Waiting for your approval before any code changes.

---

## 1. Your four answers, written down

| Question | Your answer |
|---|---|
| Confirm page still asks "do you genuinely value this?" | **Yes.** Both the confirm page and the APA page stay the same — we only take the stakeholder question off them. |
| Keep "Generate the other view"? | **Keep it.** It swaps the lens in section 2. |
| The person always argues against you? | **Yes.** |
| What does "Back to all the options" do? | **Same warning as the APA.** Stay and keep your answers, or leave and throw the CVR answers away as if you never got there. |

---

## 2. The page, after the change

**Three parts, then buttons. One question only, at the bottom.**

| Part | What it holds |
|---|---|
| **1 · What you chose** | The option, the numbers, and what it gives up. Said **once**. |
| **2 · The lens** | *Where it happens* → the same choice in a second place. *Doing it yourself* → your part in it here. **This part only shows. It asks nothing.** |
| **3 · The question** | One short bridge line, then **"Would you still choose this?"** |

Buttons: **Yes, I'd still choose it** · **No, not any more** · **Back to all the options**

Then a **new page**: one affected person speaks, and argues against what you just said.

---

## 3. Getting rid of the repeated words

You spotted this. Right now the page says the same thing twice:

> Part 1: "**The same 1,300 miles and the Friday deadline** are committed under the plan you chose…"
> The question: "Knowing this — **the same 1,300 miles and the Friday deadline**, only a different who — would you still choose this option?"

The numbers are said **once**, in part 1. The question becomes simply:

> **"Would you still choose this?"**

Part 3's bridge line carries the meaning instead, without repeating the numbers:

| Lens | Bridge line |
|---|---|
| Where it happens | "Same choice. Different place." |
| Doing it yourself | "Same choice. Your hand." |

---

## 4. Short buttons, with the full meaning on hover

You are right that the short button must not lose the meaning. Every short button gets the long
sentence as a **tooltip**, so the person can check what they are agreeing to.

| Button | Tooltip (the full meaning) |
|---|---|
| **I still choose this** | "I still choose this option. Hearing this person did not change what matters to me." |
| **I've changed my mind — I don't want this now** | "I do not want this option any more. Hearing this person changed what matters to me." |
| **I still don't want this** | "I still do not want this option. Hearing this person did not change what matters to me." |
| **I've changed my mind — I do want this now** | "I do want this option now. Hearing this person changed what matters to me." |
| **Yes, I'd still choose it** | "Yes — even after seeing this, I would still choose this option." |
| **No, not any more** | "No — after seeing this, I would not choose this option." |
| **Back to all the options** | *(no tooltip — it is already clear)* |

**The tooltip must open on hover, on keyboard focus, and on tap.** Hover alone would hide the
meaning from anyone on a phone or tablet, which would be worse than the long button.

---

## 5. The people who speak — better, and simpler

### What is wrong now

The person's opening line is long and tells the participant to pretend:

> "Imagine this affected person is someone who has been in your life for twenty years, and matters
> to you."
> "Someone you have only just met, who is affected by your decision, considers what it led to, and
> notes the choice was yours alone:"

**Do not ask people to imagine.** Just say who it is.

> "Someone you have known for twenty years."

### The two people we need for every option

| | When it appears | What it says |
|---|---|---|
| **The person it hurts** | after **Yes** | who they are · what your choice does to them |
| **The person who needs it** | after **No** | who they are · what they lose because you said no |

We already have the first one for all 30 options (it needs tightening). The second one is new —
**30 to write** — because the app has never asked anyone to reconsider a rejection before.

Example, for "share a car with three other people":

> **Hurts:** "Someone you have known for twenty years lives on the street the car detours through.
> Splitting the cost four ways does not take those extra miles off their street."
>
> **Needs it:** "Someone you have known for twenty years cannot afford the train or the flight. The
> shared car is the only way they can make this trip — and it only runs if the seats fill."

Both are the same length and the same strength on purpose, so neither side pushes harder.

---

## 6. Counting the switches — most of this already works

Good news: the app is **already counting** almost everything you asked for.

| Already counted | What it means |
|---|---|
| `cvrVisits` | how many times they reached the CVR |
| `apaVisits` | how many times they reached the APA |
| `cvrBackouts` | how many times they left the CVR without answering |
| `apaBackouts` | how many times they left the APA without answering |
| `optionChanges` | how many times they changed which option they picked |
| `numberOfSwitches` | all of the above added together — your switching rate |

**What I will add:** the same two counters for the new person-speaks page —
`stakeholderVisits` and `stakeholderBackouts` — and I will include them in `numberOfSwitches`, so
leaving that page also counts as a switch.

---

## 7. What is removed

| Removed | Why |
|---|---|
| "Did hearing this person influence you?" on the **confirm** page | We now watch what they do instead. |
| The same question on the **APA** page | Same reason. |
| The **second question** on the vignette page | This was the "two questions, one answer" problem. |
| The **stakeholder box** on the vignette page | It moves to its own page. |
| The repeated numbers in the question | Said once, in part 1. |

---

## 8. How I will build it — small and safe first

Backups first; I delete them only when everything passes.

| Step | What | Why this order |
|---|---|---|
| 0 | Back up every file I touch | so anything can be undone |
| 1 | Take the second question off the vignette page, and stop repeating the numbers | smallest change, fixes your main complaint straight away |
| 2 | Shorten the Yes/No buttons and add tooltips | small, visible |
| 3 | Move the person off the vignette page onto a new page | structure change, "Yes" path only |
| 4 | Tighten the 30 "person it hurts" vignettes | writing |
| 5 | Write the 30 "person who needs it" vignettes — the "No" path | the biggest writing job |
| 6 | Take the stakeholder question off the confirm and APA pages, and wire ±25 to the buttons | measurement change — done last, on purpose |
| 7 | Add the two new counters | small |
| 8 | New checks: every option has both people; every path ends somewhere; ±25 happens exactly once per scenario | so this cannot silently break later |
| 9 | Pictures of every page, both lenses, both paths | so you can see it |
| 10 | Delete the backups | |

Everything keeps working at every step. A switch (`SHOW_STAKEHOLDER_PAGE`) lets you turn the whole
thing off in one line if your advisor prefers the old flow.

---

## 9. One thing I must warn you about again

This makes the CVR **stronger**. Everybody now gets argued with once, by someone who disagrees with
them. More people will change their mind than before.

That is what you want — but it means the ±25 partly measures **how well we wrote those 60 little
stories**, not only how movable the person is. Writing both sides at equal strength (section 5) is
the protection, and it belongs in your limitations chapter.

---

## 10. Please confirm

Say "go" and I will start at step 1. If you want any wording in sections 3, 4 or 5 changed, tell me
now — it is much cheaper to change a sentence in this plan than in sixty of them later.
