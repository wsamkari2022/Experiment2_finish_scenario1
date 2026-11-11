---
name: waseem_skills_strong_study_files
description: Keep every document that describes Waseem's VRDS Experiment 2 strong, accurate and coherent with the code and with each other - the code documentation (CLAUDE.md, README.md, DEPLOYMENT.md, code comments), the data documents (HOW_TO_READ_MY_DATABASE.md, HOW_TO_ANALYZE_MY_DATA.md, ANALYSIS_AND_FIGURES_PLAN.md, DAILY_PAY_CHECK.md, the method docs), the IRB application and modification texts, the consent form, the OSF preregistration answers and Word file, the hypotheses file and the freeze note. Use this whenever writing, rewriting, reviewing or auditing any of them, whenever a code change must be reflected in the documents, whenever deciding how to describe a design choice, a limitation, a hypothesis, a sample size, power or pay, and whenever Waseem says "strong", "solid", "coherent", "consistent", "accurate", "IRB", "OSF", "preregistration", "hypotheses", "documentation" or "reviewer", even if he does not name this skill.
---

# Strong, accurate and coherent study files

A preregistered study persuades when three things hold:
- every statement is true of the code that runs;
- every document agrees with every other document;
- each design choice is stated with its purpose.

A reviewer (the IRB, OSF, the advisor, an examiner) forgives a limitation the author states clearly. It does
not forgive a contradiction it discovers, for example an IRB text that says "one group" next to an analysis
plan that adds "group" as a control. So accuracy is the source of the strength, not a cost to it.

**Where the study stands** (update this paragraph when it changes): Experiment 2 is Prolific only since
10 November 2026 (the IRB refused the student group on 9 November). The IRB modification with the Prolific-
only text is waiting for approval. The OSF registration still describes the two groups and changes through
OSF's Update after the IRB approves. Dr. Eskridge approved the 23 hypotheses A1-D5 (Waseem, 11 November
2026). No participant data exist yet. Nothing is deployed before the IRB approves.

## The rules, and why each one matters

### 1. The code is the truth
A document describes what the code does now. Before writing a sentence about the study, read the code
that does it, and name the field, the page or the check. When code and document disagree, the document is
wrong, unless Waseem decides the code is.

### 2. Each kind of document treats history differently
| Kind | History |
|---|---|
| Code documentation (`CLAUDE.md`, the HOW_TO files, the method docs, code comments) | **Kept and dated.** A dated section says what changed and why ("since 10 November 2026 ..."). Never delete history; label it, so a reader never mistakes it for today |
| IRB protocol text, consent form, OSF answers, hypotheses | **Present tense, the launch version only.** History belongs only in the box made for it: the IRB modification's "What changed" and the OSF Update's justification |
| Plans and notes (`PLAN_*.md`, `PROLIFIC_AND_IRB_NOTES.md`) | Dated working files. Mark them done or superseded; they never become the source of a fact |

### 3. One fact, one wording, one source
The same fact uses the same words everywhere. Copy from the source; never reword a copy.
- **The hypotheses A1-D5 and the analysis rules**: the IRB text of record is the source. The copies are
  `docs/ANALYSIS_AND_FIGURES_PLAN.md` 11.1, `docs/PREREGISTRATION_FREEZE.md` 5.1,
  `VRDS2_Hypotheses_Draft.docx`, `OSF_PREREGISTRATION_ANSWERS.md` and `VRDS2_OSF_Preregistration.docx`.
  They change together, or not at all (the analysis plan's own rule). Check with a script, word for word.
- **The consent form**: `docs/PROLIFIC_CONSENT_FORM_TEXT.txt` is the IRB form; the consent page must equal
  it word for word (check T10). If the IRB changes a word, change both and move `PROLIFIC_CONSENT_VERSION`.
- **Field names**: `src/experiment/dbShape.ts` is the source; HOW_TO_READ_MY_DATABASE.md is the dictionary.
- The key facts and where each one lives: `references/coherence_checklist.md`.

### 4. Registered text is changed only through its own door
Never edit the hypotheses, the analysis rules or an OSF answer silently. A change goes: Waseem's decision,
then the IRB (if it touches the protocol), then OSF's Update with a justification, then every copy at once.
Until then, a copy that must wait gets a dated "pending" note beside it, never inside the registered words.

### 5. State each design choice with its purpose
Pattern: **what the design does, then why that helps.**
Example: "The address says `BSL4`, never 'Baseline', so a participant never reads their condition." A choice
stated with its purpose reads as a decision, not an accident.

### 6. Say who sees it
Every sentence about a screen names the conditions, the scenarios and the answers that lead there. Example:
"The open card shows the fit line and the 'Ranked N - why' box in conditions 1-3, scenarios 1-5." Write
**Baseline has no fit score and no "Ranked N - why" section** in bold every time it comes up: a Baseline
difference mixes the missing help pages with the missing fit line.

### 7. Numbers are recomputed, and each says what it measures
Power, money, counts and percentages are recomputed from their source every time they are written, never
copied from another document (the 14 October power slip). Each number says what it measures and what a
fair or good value would be. Pretend-participant numbers are labelled "pretend participants"; test-run
numbers are examples, never findings.

### 8. Limitations: in the chat and the dissertation, never in the code documentation
Waseem writes the limitations himself, in the dissertation (his decision, 11 November 2026). So:
- **Never** add a limitations list or a new limitation sentence to the code documentation (CLAUDE.md, the
  HOW_TO files, the method docs, code comments) or to `docs/ANALYSIS_AND_FIGURES_PLAN.md`.
- A FALSE statement there is still corrected, with the design fact (for example "APA only and Baseline have
  no reflection"), not with a limitation.
- In the chat, list every limitation a text touches as big headings, so he can take care of it.
- In IRB and OSF texts, keep the registered limitations word for word; lead each new one with how the design
  handles it, then what remains.

### 9. Honest boundaries
- No results before there are data. "Tests whether", "is designed to", never "shows" or "proves".
- Registered versus exploratory is stated exactly. Stability between conditions is exploratory.
- All completed sessions are analysed. Waseem decides any other analysis rule after the experiment; never
  ask him analysis-rule questions, and never write a rule he has not decided.
- Privacy: no Prolific ID, email, completion code, password or database address in any document, commit,
  screenshot or AI tool. Use made-up IDs in examples.

### 10. Waseem's decisions win
His decisions (the project memory) override every document. When a source disagrees with him, follow him,
and do not raise the closed point again.

## When asked to review a document
Report the findings in a table with these columns:
- location (file and line);
- type: inaccurate (disagrees with the code) / incoherent (disagrees with another document) / out of date /
  unsupported / ambiguous / misleading / missing / privacy;
- what it says now;
- the proposed text, ready to paste;
- the source (the code line, the IRB text, the decision).

Rank the findings by how much each one matters to the reader who will act on the document. Then plan and
audit the edits with `/waseem_skills_plan_audit`, and wait for Waseem's approval before changing anything.
Examples of strong and weak wording: `references/strengthening_examples.md`.
