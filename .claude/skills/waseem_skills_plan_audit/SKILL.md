---
name: waseem_skills_plan_audit
description: Plan first, then audit the plan several times from different points of view before anything is changed, then criticize your own work as a skeptical examiner would. The audit hunts for contradictions, things that do not make sense, ambiguous wording, missing information, misleading information and out-of-date content. Use this for every change to Waseem's VRDS Experiment 2 project - the study's code, what participants see, the database, the checks, the documentation (CLAUDE.md, HOW_TO_READ_MY_DATABASE.md, HOW_TO_ANALYZE_MY_DATA.md, ANALYSIS_AND_FIGURES_PLAN.md, DAILY_PAY_CHECK.md, DEPLOYMENT.md), the IRB texts, the OSF preregistration texts, the hypotheses and the consent form - and for any multi-step task. Use it whenever Waseem says "plan", "plan first", "audit", "audit your plan", "check twice", "make sure", "be accurate", "carefully", "profoundly", "from different perspectives", "criticize", "evaluate" or "before you change anything", even if he does not name this skill.
---

# Plan first, then audit the plan

Experiment 2 is a preregistered PhD study. Its code, its documents, the IRB application and the OSF
registration must all say the same true things. One wrong fact costs more trust than any single
improvement gains. Three examples from this project:
- the analysis plan said students would be "analysed together, with the group as a covariate" after the
  IRB text of 9 November 2026 had already made the study Prolific only;
- CLAUDE.md's table of checks said check C14 tests "Not you?", while C14 now tests that only a Prolific ID
  is accepted;
- the "limit" words on the cards were thought to be gone, but participants with a red line (about 31 in 100
  steady pretend participants) still saw them, and in Baseline and scenario 6 too (found on 23 October 2026).

A plan written down and then attacked from several sides catches these before they reach the study, the
database, the IRB or OSF. Waseem's standing rule: **nothing changes without his approval of a written
plan**, one fix at a time. This skill turns that rule into a routine.

## The workflow

Scale the audit to the change:
- a one-word fix gets a short pass 1, a short pass 3 and a short self-critique;
- a new page, a scoring rule, a database field, an IRB or OSF text, or a document rewrite gets all three
  passes and the full criticize-and-evaluate step.

The goal is to catch real problems, not to make the report longer.

### 1. Understand the request
Read his whole message first (he often decides or delegates something in it). Restate the request in one
line. Then list:
- what is asked;
- what is not asked (his scope limits count: for example "only the code documentation and the files that
  read and analyse the data", or "the OSF files after the IRB approves");
- what is unclear.

If the request mixes several jobs, split them. If something is truly unclear and you cannot find the
answer yourself, it becomes a decision for Waseem (step 3). Do not guess it.

### 2. Collect the facts before you plan
Read the real sources, at the exact places, now. Do not rely on memory of earlier turns or on a summary.

| Source | What to do |
|---|---|
| The code (`src/`, `server/`, `tools/`) | The code is the truth about what the study does. Read the exact lines. Search for every other place that does or says the same thing |
| `CLAUDE.md` | The project's rules and every dated change. The newest dated section wins over older ones |
| The data documents (`Generated Outputs/HOW_TO_READ_MY_DATABASE.md`, `HOW_TO_ANALYZE_MY_DATA.md`, `docs/ANALYSIS_AND_FIGURES_PLAN.md`, `docs/DAILY_PAY_CHECK.md`) | Check every field name against a record (step 2b) |
| The IRB text of record (the newest folder in `Downloads\Consent forms\`, for example `Ready to upload (9 November)`), and `docs/PROLIFIC_CONSENT_FORM_TEXT.txt` | The consent page must equal the form word for word (check T10). The hypotheses and analysis rules come from the IRB text |
| The OSF texts (`OSF_PREREGISTRATION_ANSWERS.md`, `VRDS2_OSF_Preregistration.docx`, `VRDS2_Hypotheses_Draft.docx`, `docs/PREREGISTRATION_FREEZE.md`) | Registered words change only together, through OSF's Update, after the IRB approves |
| Waseem's decisions (the project memory) | These win over every document |
| `git log` and `git status` | Know what was already done and what is uncommitted |

Check the modification dates before you use any file. Treat every file name and number you saw earlier as
possibly changed.

**2b. Compute rather than eyeball.** Sums, counts, money, power, word-for-word matches and field names are
checked with a search or a short script, and reported as evidence ("22 of 23 hypotheses match the IRB
text word for word; D4 differs by ', group'"). Useful tools:
- a full pretend record: `node tools/validate_dbshape.cjs --dump=<file in the scratchpad>`;
- the check chain: `npm run typecheck && npm run lint && npm run validate:block5 && npm run build`;
- a word scan of every document for words that describe a removed feature;
- recompute every number from its source (power by simulation or G*Power, money from the reward and the
  fee). Matching another file is not a check: the other file may be wrong too.

### 3. Write the plan
Write it as a file in the project root: `PLAN_<topic>.md` (or `PLAN_<topic>_<date>.md`). Do not commit it
unless Waseem asks. Use the template in `references/plan_template.md`. For each change the plan says:
- where it is (file and line, page and condition);
- the words or the behaviour now (WAS);
- the exact new words, ready to paste, or the exact new behaviour (NOW);
- why;
- the source;
- **who sees it**: which conditions, which scenarios, which answers. "Participants see it" alone is not
  enough. "Nobody sees it: documentation only" is a valid answer.

It also lists:
- what will **not** change, and why;
- each decision for Waseem, with options, a real before/after example, and your recommended option first;
- the steps after approval (commit first, edit, checks, live test, documents, memory, commit and push).

### 4. Audit pass 1: the six problem types
Read the whole plan once for each problem type, and look at every claim. Write down what you found, even
when it is "none", with the evidence.

| Type | Ask | An example from this project |
|---|---|---|
| **Contradiction** | Does anything disagree with the code, another document, the IRB text, the OSF text, the consent form or an approved decision? | The analysis plan's D4 lists "group" as a control; the IRB text of 9 November does not |
| **Does not make sense** | Do the numbers add up? Do counts, totals, ranges, levels and check names still hold? | "$7.00 for 104 people with the fee is $970.67, leaving $29.33 of $1,000": recompute it, never copy it |
| **Ambiguous** | Could a reader understand it two ways? Is "it", "this", "the group" or "the door" clear? | "Analyse the two groups apart" in the Stability method means measured and not-measured people, not two recruitment groups |
| **Missing** | Is a file, a field, a condition, a step (commit, check, live test, document, memory) missing? | The first documentation plan forgot README.md, which is still the Vite template |
| **Misleading** | Could a true sentence leave a wrong impression? | "Stability 100" for somebody never tested; a pretend-participant number that reads like a finding |
| **Out of date** | Does anything describe an older version: old wording, old field, old count, a finished note? | HOW_TO_READ said "three simple reading checks"; every participant now has four |

### 5. Audit pass 2: the perspectives
Read the plan again as each reader in `references/perspectives.md`:
- the future analyst (a person or an AI with no other context);
- the statistician;
- the preregistration (OSF) reviewer;
- the IRB and privacy reviewer;
- Prolific's rules;
- the participant, in each of the four conditions;
- the code maintainer (a future Claude session);
- the advisor and the dissertation writer;
- Waseem himself;
- a devil's advocate.

Spend the most time on the reader whose concerns this change touches.

### 6. Audit pass 3: audit the audit
Every fix to the plan can create a new problem. After you change the plan:
- read the changed parts again;
- re-run the counts, searches and scripts;
- check that numbering, section names and cross-references still hold.

Then ask: "What is the single most likely thing to go wrong when this is applied?" Add a check for it to
the steps after approval. Example: when old sections of CLAUDE.md move to another file, search for every
"see '...' above" that pointed at them.

### 7. Criticize and evaluate your own work
The three passes check the plan against the sources. This step checks **your own work**, as a skeptical
examiner would. Your own wording is the easiest thing to miss, because you know what you meant.

**1. Criticize.** Read every new or changed sentence on its own, and ask:
- **Overclaim:** does it claim more than the code, the check or the source shows? ("checked" when only
  read; "every participant" when only one condition).
- **Who sees it:** is every screen change tied to its conditions, scenarios and answers?
- **The study's own commitments:** does it break one? These are:
  - the hypotheses and registered text change only together, in every copy, through the OSF Update;
  - all completed sessions are analysed, and Waseem decides other analysis rules after the experiment
    (never ask him analysis-rule questions);
  - no results before there are data; pretend-participant numbers are labelled as such;
  - no Prolific ID, email, completion code or password in any document, commit or AI tool;
  - nothing is deployed before the IRB approves;
  - **Baseline has no fit score and no "Ranked N - why" section** (write this in bold every time);
  - limitations are told to Waseem in the chat and written by him in the dissertation, never added to the
    code documentation or the analysis plan.
- **Terms:** is every field name real (step 2b) and every term explained the first time?
- **Coherence:** does it still agree with every other document that says the same thing
  (`/waseem_skills_strong_study_files`)?

**2. Evaluate.** Write a short, honest verdict in the plan:
- what is strong, with evidence;
- what is weak or only adequate, and why;
- what you would change if you had to defend it to the advisor tomorrow.

A verdict of "no weaknesses" needs evidence, because it is rarely true.

**3. Act.**
- Fix what you can inside the plan, and say so: "the self-critique found X, so the plan now does Y".
- Anything you cannot fix becomes a decision for Waseem or a named open point.
- Never hide a weakness to make the report look clean.

### 8. Present, then wait
- Give Waseem the plan file as a link.
- In the chat, write a short summary in simple English (`/simple-english`), with the limitations the work
  touches as a big heading.
- List the decisions, each with your recommendation, and end with "What I need from you".

Then stop. Nothing changes until he approves. If his answer changes the plan, re-plan and re-audit the
changed parts, and tell him what changed.

## Honesty in the audit
- Report what the audit found, including your own earlier mistakes: "my first plan said X; the audit
  found Y, so the plan now does Z".
- Never claim a check you did not run. Say which checks ran and what they printed.
- When a check could not be done, say so, and say what would settle it.
- A short audit with real evidence is better than a long one with general words.

## After approval (Waseem approves each step)
1. Commit and push the current state first, so the change can be compared with it.
2. Make the edits, one approved item at a time.
3. Audit the result:
   - code: `npm run typecheck && npm run lint && npm run validate:block5 && npm run build`, every check
     printing its PASS line; a new check is proved by breaking the code on purpose and seeing it fail;
   - what participants see: a live run in the browser (light and dark, a 375px phone), with the test
     browser's storage restored exactly afterwards;
   - documents: the word scan, the field-name check against a record, the same-words check against the
     IRB text, every number recomputed;
   - the removed words are gone and the new words are present.
4. Update CLAUDE.md, the two HOW_TO files (a dated row in HOW_TO_ANALYZE 4.9 when participants see a
   change), and the memory.
5. Commit and push on the working branch, the message ending with the attribution line. Never commit
   `.env`, `Prolific docs/`, or the untracked notes and Word copies in the project root.
6. Criticize and evaluate the result (step 7 again, on the real files), report the verdict, and plan a new
   round if a fix is needed.
