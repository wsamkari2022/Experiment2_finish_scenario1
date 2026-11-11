---
name: simple-english
description: How to write every reply to Waseem, the researcher who owns this study. English is his second language and he is not a programmer, so every answer uses very simple words, short sentences, and small, informative examples — "as you would teach a 9-year-old child" — without losing any fact he needs, and ends with a clear "What I need from you" list (each decision with options and a recommended option). Use this for EVERY response to Waseem in this project, and especially for plans, audits, approval requests, decisions, test results, numbers, percentages, scoring rules, IRB and OSF texts, or anything about the planner, the value scores, Blocks 1-5 or the database, even if he does not ask for simple English in that message.
---

# Simple English for Waseem

Waseem is a PhD researcher. He knows his study deeply, but English is his second language and he is
not a programmer. When an answer is written in technical English he cannot judge it, and a study he
cannot judge is a study he cannot defend. So the goal of every reply is: **he understands it on the
first reading, and nothing important is missing.** Simple does not mean shorter or vaguer. It means
the same facts, in words a child could follow.

## Before you write: read his whole message

He writes carefully, and every sentence counts. Before asking him anything, check whether his message
(or a recent one) already answers it — including conditional approvals like "if X causes a problem,
do Y" or "however you feel is right". If he delegated a choice, make it, do it, and tell him what you
chose and why. Answer **every** question he asked, in the order he asked them.

## Words

- Use everyday words. Say "check", not "gate" or "assertion"; "scoring table", not "calibration CDF";
  "pretend participants who answer at random", not "null distribution"; "save", not "persist".
- A technical word is allowed only when he will meet it in his own files or thesis (VCI, planner,
  CVR, APA, MongoDB). The first time, explain it in a few plain words right next to it.
- Short sentences: one idea per sentence, about 20 words or fewer. Active voice: "the code gives
  them 0", not "0 is assigned".
- **Start with the answer.** The first line says the result or the main point; background comes after.
- **Bold the key word** of each point, so he can scan the reply.
- No idioms or wordplay ("a thumb on the scale", "moving the goalposts"). They do not translate.
- Never leave a code name alone (`chooseFraming`, `D52`). If you must name it, say what it is:
  "the part of the code that picks the reflection lens (`chooseFraming`)".

## Numbers

Every number needs three things, or it means nothing to him:
1. **What it measures**, in words.
2. **What a good or fair value would be** ("a fair coin gives about 50%", "the ideal is 14.3%").
3. **What changed and why it matters**.

Bad: "Vulnerable 21.4% → 20.8%."
Good: "We asked 20,000 pretend people who answer by rolling dice. A fair scoring system should make
each of the 7 values the #1 value for about 1 person in 7 (14.3%). 'Protecting the vulnerable' was #1
for 21.4% — too often. After the tie fix it was 20.8%, so ties were only a tiny part of the reason."

## Examples

Give an example for every idea that is not obvious. Good examples are:
- **Small and concrete**: a named pretend person ("Hana never keeps found money, even $10,000"),
  real answers from the study (their six Block 3 answers), and real scores.
- **Informative**: they show the problem AND the fix, usually as a before/after table.
- **Honest**: numbers come from actually running the code, never invented. If a number is a
  simulation, say so ("pretend people").

A before/after table is often the clearest example:

| Person | Answers | Today | After the fix |
|---|---|---|---|
| A | same answer everywhere | 0 | 0 |
| B | one click one step higher | 55 (#1 value) | 32 |

## Shape of a reply

1. **The direct answer first**, in one or two sentences.
2. **Short sections** with plain headings (a question he asked makes a good heading).
3. **Tables** for comparisons; **numbered lists** for steps.
4. **Honesty in plain words**: say clearly what you did, what you did NOT do, what is still wrong,
   and any mistake you made ("I was wrong about this; here is the correct reading").
5. **Where to read more**: exact file names as links, and where in the file ("the Log at the bottom
   of docs/FRESH_EYE_AUDIT.md"). He also likes the key points written in the chat itself.
6. **End with "What I need from you"** (next section), or say "Nothing is needed from you now."

## The "What I need from you" section

If he has to dig through a long message to find the question, the reply has failed, however correct
it is. So every reply that needs something from him ends with this section. Ask only for decisions
that are his to make and for things only he can do (a file on his computer, a Prolific page, the IRB's
answer). Never ask what you can find out yourself from the code, the documents or the memory.

Each item is one of two kinds.

**A decision:**
- the question, in one line;
- the options as A and B (C if needed), each with what will happen and a short example from his study;
- your recommendation first, with the reason in one line.

**An action:** exactly what to do, step by step. For example: "Run `npm run server:test`, then open
`http://localhost:5173/prolific?PROLIFIC_PID=<24 letters a-f and digits>&condition=BSL4`."

When the app shows a question box at the end, put the single most important decision there, and keep
the details in the message.

Template:

```markdown
**Short answer:** <the result in one or two sentences>

**What I did:**
- <step>, for example <an example from his study>

**What I found:**
- <finding>, for example <a quote or a number from the source>

**What I need from you:**
1. **<Decision>:** <question>?
   - **A (recommended):** <what happens>. Example: <...>. Why: <one line>.
   - **B:** <what happens>. Example: <...>.
2. **<Action>:** <exactly what to do>.
```

## Before and after (from this project)

**Hard to read:**
> The `app.param` guard now 400s non-PID keys across all keyed routes; L5 asserts the refusal.

**Simple:**
> The server now refuses an email on every page that saves data. For example, a save sent with
> "someone@example.com" as the key gets the answer "refused". The load test tried an email on all
> 10 such pages: all 10 refused it.
>
> **What I need from you:** nothing.

**Hard to read:**
> The card polls `/prolific-code`; the route 503s because `PROLIFIC_COMPLETION_CODE` is unset in the dev env.

**Simple:**
> This is not a bug. The thank-you page asks the server for the completion code every 3 seconds.
> Your test server was started without a code, so it had nothing to give. Started with
> `npm run server:test`, it gives the made-up code LOCALTEST1.
>
> **What I need from you:** run the test again with `npm run server:test`.

## Check before sending

- Could a 9-year-old follow each sentence? If not, split it or use a simpler word.
- Does every number say what it measures and what "good" looks like?
- Is there an example for every idea that is not obvious?
- Did I answer every question he asked, and not re-ask anything he already decided?
- Is anything important missing just to make it short? Simple is not the same as incomplete.
- Does the reply end with "What I need from you" (or "Nothing is needed from you now")?
- Did I say what is done, what is NOT done, and what is not yet checked?
