# Two things in my experiment I would like you to check

Waseem Samkari · 24 September 2026

## What I am asking for

I am building a study about how people make moral decisions under pressure. Two parts of it have
been bothering me, and I have looked at them for long enough that I can no longer tell whether they
are right or whether I have just gotten used to them.

I am not asking you to confirm that the work is correct. I am asking you to read it as somebody who
has never seen it before and tell me where it does not hold up. If you think a rule is arbitrary,
say so. If you think a number was picked because it looked reasonable rather than because something
required it, say that too. I have listed my own doubts at the end of each part, but please do not
treat that list as the boundary — I am more worried about the problems I have not thought of.

You do not need to read any code. Everything you need is in this document.

## The study in one page

A participant answers four short blocks of questions. From those answers the study builds a profile
of **four values**, each scored 0 to 100:

| Value | What a high score means |
|---|---|
| **Protecting the vulnerable** | They are extra reluctant to harm people who are already worse off |
| **Reducing harm** | They demand more before accepting a choice as the harmed group grows |
| **How much is gained** | A bigger payoff moves them more readily |
| **How many are helped** | They are willing to act for the larger total |

Then comes Block 5: six emergency scenarios. Each scenario shows **six option cards** — six
different policies, all of them choosable. Every option carries its own score on those same four
values (0 to 100). The participant reads the cards and picks one.

Two separate things then happen, and they are what I want checked:

1. Something called **the planner** decides what ORDER the six cards appear in.
2. After the choice, the participant's four value scores **move up or down**, and they carry the
   new numbers into the next scenario.

---

# Part 1 — The planner (the order the cards appear in)

## Why there is a planner at all

The obvious thing would be to show the best-matching option first. I deliberately do not, and the
reason is the one measurement the block exists to make.

If the best-matching card is always card number one, then "they picked the top card" and "they
picked the option that matched their values" are **the same event**. When a participant picks card
one, I cannot tell whether they did it because it matched what they care about or because it was
simply first. The data can never separate those two, no matter how many people I run.

So the order is produced by a different rule, and the match is scored separately. The two agree
sometimes and disagree sometimes, and the disagreements are where the measurement lives.

## What the planner actually does

It never scores an option by itself. It takes **two options at a time** and asks one question: for
this pair, do I go with the value this participant ranked first, or set it aside because the two
options are nearly tied on it while being far apart on the participant's second value?

An example. Say the participant ranks *how much is gained* first and *reducing harm* second:

```
Option P:   gained 100,  harm 20
Option Q:   gained  92,  harm 95
```

P wins on *gained*, but only by 8 points. Q wins on *harm* by 75 points — nearly ten times as much.
The planner sets *gained* aside for this one comparison and Q beats P.

So the option that is best on the participant's own top value can still lose. That is intended.

The decision uses three steps, in order:

- **Step 1** — Is the best either option manages on the top value already below this participant's
  own floor for it? Then both are bad on it, and the ranking decides.
- **Step 2** — Is the gap on the top value bigger than the smallest difference this participant has
  shown they actually notice? Then the gap is real, and the ranking decides.
- **Step 3** — The gap on the top value is inside their own noise. Is the gap on their SECOND value
  bigger than their own stated exchange rate makes it worth? Then drop the top value for this pair.

Every threshold in those three steps — the floor, the noise band, the exchange rate — comes from
that participant's own answers in the earlier blocks. There are no tuning constants in the file.

Each option is compared against all five others, wins are counted, and the cards are shown in order
of wins. Wins are counted rather than sorted because the comparison is not transitive: A can beat
B, B beat C, and C beat A. A sort would silently pick one of the possible orders and hide that.

Options are also put in groups: **clear** (inside every limit the participant expressed) and
**blocked** (bottom of the range on a value they refused outright). Blocked options are shown last
but are fully choosable — the study exists partly to measure whether people cross their own stated
lines, which is unmeasurable if the interface will not let them.

Practical performance (speed, reversibility, and three others) plays **no part** in the order.
Nothing in the earlier blocks asks whether speed matters more than reversibility, so there is no
weighting I could honestly derive. I left it out rather than invent one.

## What I would like you to check

1. **Does the three-step rule make sense as a model of a person?** Step 3 says a large gap on the
   second value can override a small gap on the first. Is that how people actually trade off, or is
   it just a rule that produces interesting orderings?
2. **Is "count the wins" the right way to turn pairwise comparisons into a list?** I chose it
   because the relation is not transitive. Is there a standard method I should be using instead?
3. **Look at the option tables in Appendix A and tell me whether the numbers match the words.**
   Each option's four scores are supposed to follow from what the card says it does. If an option
   scores high on *reducing harm* but its own description hands you a worse outcome, that is a real
   defect and I want to know.
4. **Per scenario, does the ordering behave consistently?** Appendix B shows how often the first
   card is also the best-matching card, measured over 3,000 simulated participants per scenario.

## What I already suspect is wrong here

- **My own target was "under 50%" and two scenarios are above it.** Appendix B shows *Eight Hours
  Ahead of the Fire* at 55.4% and *Limited Cancer Treatment Allocation* at 53.2%. Random chance
  with six options is 16.7%. I do not know whether being above my own line by five points matters
  or whether the line was arbitrary in the first place.
- **The spread across scenarios is wide** — from 43.4% to 55.4%. I do not know whether that
  variation is a problem or just what six different option sets naturally produce.
- **The last scenario is not planner-ordered at all.** Its four options are shuffled randomly for
  each participant, because that scenario is a test of my prediction model rather than of the
  person. The 68.1% in Appendix B is what the planner WOULD have done and is not what anybody sees.
  I left the row in so you can see I am not hiding it, but it should not be read with the others.
- **There are two different copies of the participant's values, and they can disagree badly.** The
  card ORDER uses the profile the participant entered Block 5 with, frozen. The match score uses
  the live profile, which moves as they go. I did that on purpose — if the order chased the live
  profile, the ordering would re-rank itself to match whatever the last scenario just taught the
  system, and I would be measuring drift against a moving ruler. But it means a participant can see
  a sidebar saying they care most about protecting the vulnerable while the cards are ordered for
  someone who cared most about gain. I have seen it happen in my own test run, and the best-matching
  option landed sixth out of six. **Is the frozen ruler defensible, or is the confusion it creates
  worse than the problem it solves?**

---

# Part 2 — How the four values move up and down

## The idea

After a participant chooses, the study nudges their four value scores and carries the new numbers
into the next scenario. The claim behind it is that deciding something changes what you say you
care about, at least a little, and that the change is measurable across six scenarios.

Every score is held between 0 and 100. Anything that would push past either end stops at the end.

## The exact numbers

There are three ways a profile can move. All three are fixed step sizes, not anything learned.

**Route 1 — they answer the reflection questions after choosing.**

| What moves | By how much |
|---|---|
| The value their chosen option serves most | **+30** if they endorsed it strongly, **+15** otherwise |
| The value their chosen option under-serves most | **−20** if they endorsed it strongly, **−10** otherwise |
| A separate "hearing someone's story" score | **+25** if guided by it, **−25** if not |

**Route 2 — they go through the clarification step and confirm a value.**

| What moves | By how much |
|---|---|
| The value they prioritized | **+30 × w** |
| Each of the other three values | **−10 × w** each |

`w` scales with how confident they said they were: **0.6** at the lowest confidence rating, rising
to **1.0** at the highest.

**Route 3 — they keep their answer after seeing a different view.**

| Their match level | Value they kept | Value they set aside |
|---|---|---|
| Aligned | **+15** | **−10** |
| Weakly aligned | **+20** | **−15** |
| Misaligned | **0** | **0** |
| Strongly misaligned | **0** | **0** |

> **Correction, 25 September 2026 (from the audit, B8).** Route 3 is not "they keep their answer after
> seeing a different view". It runs only when the pick is one of the participant's two best fits, and
> then **no reflection runs at all**. A Misaligned or Strongly misaligned pick in scenarios 1-4 always
> opens the reflection, and if they keep it, it goes through Route 1. The two 0 / 0 rows are reached
> only in scenarios 5 and 6, where nothing moves anyway. The rule itself was also changed on 24
> September (audit B1 + B2): an Aligned pick now moves nothing, and a Weakly aligned pick is compared
> with the best fit it was chosen over (+20 where it beats the best fit most, −15 where the best fit
> beat it most). See CLAUDE.md, "The keep rule, revised 24 September 2026".

All five decision scenarios run at the same weight. An earlier version varied the stakes between
scenarios, and I removed that because stakes and the participant's position in the scenario were
changing together, so neither could be read on its own.

## What I would like you to check

1. **Where do 30, 15, 20, 10 and 25 come from?** Honest answer: I chose them so that a value could
   move meaningfully across six scenarios without saturating immediately. They are not derived from
   anything. Is that defensible in a thesis, and if not, what would you do instead?
2. **Route 3 gives a misaligned participant zero movement.** Somebody who picks an option that
   contradicts their stated values, sees a different view, and keeps their answer anyway has told me
   something quite strong — and the model records nothing. That looks backwards to me now. I would
   like a second opinion before I change it.
   *Answered 25 September 2026 (audit B8): this does not happen. That participant goes through the
   reflection and Route 1, which moves their values. See the correction under the Route 3 table.*
3. **The +30 / −10 asymmetry in Route 2.** One value goes up 30 while three go down 10 each, so the
   total is flat by construction. Is a zero-sum move the right model, or should confirming a value
   be able to raise the overall intensity?
   *Note, 25 September 2026 (audit B4): it is flat except at the edges. A value at 0 cannot come
   down, so the total can rise; every such cut is now recorded.*
4. **The ceiling and the floor.** A participant whose value is already at 0 cannot go lower, and one
   at 100 cannot go higher, so their row shows "no movement" for a reason that has nothing to do
   with them. In my own test run two of the four values sat at 0 the entire way through and never
   moved once. I do not currently distinguish "did not move" from "could not move," and I think
   that is a real problem for any analysis of stability.
   *Fixed 24 September 2026 (audit B5): every move is now saved as asked for and as made, in
   analysis.value_moves_asked_for_and_made.*
5. **Is six scenarios enough to see movement at all?** In my last test run two of the six scenarios
   moved nothing whatsoever, and the total movement across the whole block was 41 points spread
   over two values.

## What the data actually looked like in my last test run

This is one real run through the study, with the four values after each scenario. Two values were
at the floor the whole way.

| # | Scenario | vulnerable | harm | gained | helped | moved this step |
|---|---|---|---|---|---|---|
| — | entering Block 5 | 0 | 0 | 100 | 99 | — |
| 1 | Six Hours to Clear the District | 0 | 0 | 90 | 100 | 11 |
| 2 | Eight Hours Ahead of the Fire | 0 | 0 | 100 | 80 | 30 |
| 3 | Limited Cancer Treatment Allocation | 0 | 0 | 100 | 80 | 0 |
| 4 | The Care Visits You Have to Cut | 0 | 0 | 100 | 80 | 0 |
| 5 | The Same Cut, Decided Without You | 0 | 0 | 100 | 80 | 0 |
| 6 | The Rule You Will Live Under | 0 | 0 | 100 | 80 | 0 |

Scenario 6 is required to move nothing — it is a test of my prediction model, not of the person, and
if it moved the profile it would add instability that no decision of the participant's produced.
Scenario 5 is a wish rather than a decision. The zeros in scenarios 3 and 4 are not required by
anything, and those are the ones I would like you to look at.

I clicked through the early blocks quickly to reach Block 5, which is probably why two values came
out at 0. A real participant's numbers should be less extreme — but that is a guess, and it is one
of the things I would like a second pair of eyes on.

---

# How to reply

Anything is useful, in any form. If it helps, these are the three answers I would find most
valuable:

1. One thing in Part 1 that you think is actually wrong, not just unusual.
2. One thing in Part 2 that you would not accept if you were reviewing this.
3. Anything I have presented as settled that you think I should still be arguing about.

Thank you for reading it.

---

# Appendix

The tables below are generated from the study itself, not typed by hand.

Appendix A lists every option in every scenario with its four value scores, so you can read the
numbers against what the option says it does. Appendix B is the simulation described in Part 1.

## A. What each option promises on the four values

### Six Hours to Clear the District

| # | Option | protecting the vulnerable | reducing harm | how much is gained | how many are helped |
|---|---|---|---|---|---|
| 1 | Leave with the registered convoy at your assigned time | 55 | 61 | 70 | 56 |
| 2 | Take the sealed respirator the clinic had reserved | 15 | 45 | 94 | 25 |
| 3 | Carry the respirator to the patient it was kept for, and walk them out | 96 | 60 | 20 | 45 |
| 4 | Drive the community shuttle for two loops before you go | 62 | 62 | 36 | 94 |
| 5 | Seal your apartment, tell the district office you are staying, and shelter | 50 | 93 | 30 | 30 |
| 6 | Drive out on the industrial service road | 43 | 25 | 80 | 87 |

Highest on each value: protecting the vulnerable -> Carry the respirator to the patient it was kept for, and walk them out; reducing harm -> Seal your apartment, tell the district office you are staying, and shelter; how much is gained -> Take the sealed respirator the clinic had reserved; how many are helped -> Drive the community shuttle for two loops before you go

### Eight Hours Ahead of the Fire

| # | Option | protecting the vulnerable | reducing harm | how much is gained | how many are helped |
|---|---|---|---|---|---|
| 1 | Take your household's assigned place in the staged convoy | 60 | 59 | 65 | 53 |
| 2 | Take the closed ridge road | 18 | 23 | 92 | 25 |
| 3 | Give your car seats to the two residents with walkers and wait for the lift bus | 97 | 56 | 19 | 39 |
| 4 | Fill every seat in the car with neighbors who have none | 62 | 50 | 40 | 94 |
| 5 | Take your household to the concrete school on the hill | 56 | 94 | 26 | 39 |
| 6 | Leave immediately on the main highway, before the staging starts | 44 | 20 | 80 | 30 |

Highest on each value: protecting the vulnerable -> Give your car seats to the two residents with walkers and wait for the lift bus; reducing harm -> Take your household to the concrete school on the hill; how much is gained -> Take the closed ridge road; how many are helped -> Fill every seat in the car with neighbors who have none

### Limited Cancer Treatment Allocation

| # | Option | protecting the vulnerable | reducing harm | how much is gained | how many are helped |
|---|---|---|---|---|---|
| 1 | Treat the 20 most likely to survive | 30 | 48 | 39 | 94 |
| 2 | Treat the 20 who are sickest | 96 | 42 | 20 | 35 |
| 3 | Treat the 20 with the most years ahead | 18 | 25 | 92 | 43 |
| 4 | Draw the 20 names from the patients who cannot wait | 56 | 94 | 33 | 38 |
| 5 | Hold some doses back for the patients nobody reaches | 68 | 64 | 30 | 37 |
| 6 | Treat the 20 who others depend on | 43 | 40 | 70 | 86 |

Highest on each value: protecting the vulnerable -> Treat the 20 who are sickest; reducing harm -> Draw the 20 names from the patients who cannot wait; how much is gained -> Treat the 20 with the most years ahead; how many are helped -> Treat the 20 most likely to survive

### The Care Visits You Have to Cut

| # | Option | protecting the vulnerable | reducing harm | how much is gained | how many are helped |
|---|---|---|---|---|---|
| 1 | Redraw the routes to cut the driving | 41 | 47 | 68 | 84 |
| 2 | Keep every care visit, and cut the check-in visits | 35 | 70 | 62 | 80 |
| 3 | Cut only where a family member can cover | 58 | 93 | 30 | 65 |
| 4 | Shorten every visit so nobody is dropped | 38 | 44 | 35 | 92 |
| 5 | Keep the town routes that pay, and drop the rural ones | 16 | 55 | 93 | 45 |
| 6 | Protect full visits for the clients with nobody else | 95 | 54 | 22 | 38 |

Highest on each value: protecting the vulnerable -> Protect full visits for the clients with nobody else; reducing harm -> Cut only where a family member can cover; how much is gained -> Keep the town routes that pay, and drop the rural ones; how many are helped -> Shorten every visit so nobody is dropped

### The Same Cut, Decided Without You

| # | Option | protecting the vulnerable | reducing harm | how much is gained | how many are helped |
|---|---|---|---|---|---|
| 1 | Redraw the routes to cut the driving | 41 | 47 | 68 | 84 |
| 2 | Keep every care visit, and cut the check-in visits | 35 | 70 | 62 | 80 |
| 3 | Cut only where a family member can cover | 58 | 93 | 30 | 65 |
| 4 | Shorten every visit so nobody is dropped | 38 | 44 | 35 | 92 |
| 5 | Keep the town routes that pay, and drop the rural ones | 16 | 55 | 93 | 45 |
| 6 | Protect full visits for the clients with nobody else | 95 | 54 | 22 | 38 |

Highest on each value: protecting the vulnerable -> Protect full visits for the clients with nobody else; reducing harm -> Cut only where a family member can cover; how much is gained -> Keep the town routes that pay, and drop the rural ones; how many are helped -> Shorten every visit so nobody is dropped

### The Rule You Will Live Under

| # | Option | protecting the vulnerable | reducing harm | how much is gained | how many are helped |
|---|---|---|---|---|---|
| 1 | Help the people in the worst trouble first | 95 | 25 | 25 | 25 |
| 2 | Keep the number of people badly hurt as low as possible | 25 | 95 | 25 | 25 |
| 3 | Give power back to as many places as possible | 25 | 25 | 25 | 95 |
| 4 | Use the crew where it does the most good | 25 | 25 | 95 | 25 |

Highest on each value: protecting the vulnerable -> Help the people in the worst trouble first; reducing harm -> Keep the number of people badly hurt as low as possible; how much is gained -> Use the crew where it does the most good; how many are helped -> Give power back to as many places as possible


## B. How often the first card is also the best-fitting option

| Scenario | first card = best fit | best fit is in the bottom half |
|---|---|---|
| Six Hours to Clear the District | 49.8% | 14.1% |
| Eight Hours Ahead of the Fire | 55.4% | 7.4% |
| Limited Cancer Treatment Allocation | 53.2% | 8.5% |
| The Care Visits You Have to Cut | 44.3% | 23.1% |
| The Same Cut, Decided Without You | 43.4% | 23.9% |
| The Rule You Will Live Under | 68.1% | 0.1% |
