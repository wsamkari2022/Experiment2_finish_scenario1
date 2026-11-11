# Plan template

Copy this structure into `PLAN_<topic>.md` in the project root. Keep the language simple. Every quoted
word must come from a source you read in this round.

```markdown
# Plan: <topic>

**Status:** plan only. Nothing has been changed.
**Read before planning:** <files, with their dates; the commit this plan is based on>
**Waseem's request:** <one line, in his words where possible>
**Scope:** <what is in; what is out, and when the out part happens>

## 1. What I found
<a short table: item | what it says or does now | where | why it matters>

## 2. Proposed changes
| # | Where (file, line / page, condition) | WAS | NOW (exact words or behaviour) | Why | Source | Who sees it |
|---|---|---|---|---|---|---|

**Will not change:** <list, each with its reason>

## 3. Decisions for you
| D | Question | Options, each with a real example | My recommendation (and why, in one line) |
|---|---|---|---|

## 4. Audit pass 1: the six problem types
| Type | Found | Evidence |
|---|---|---|
| Contradiction | | |
| Does not make sense | | |
| Ambiguous | | |
| Missing | | |
| Misleading | | |
| Out of date | | |

## 5. Audit pass 2: perspectives
<one short paragraph per reader that matters for this change; what each one checked and found>

## 6. Audit pass 3: after the fixes
<what changed in the plan because of the audit; the re-checks; the single most likely failure, and its
check>

## 7. Criticize and evaluate my own work
**Criticize:** <each new sentence read as a skeptical examiner would; what was found, even "none", with
evidence>
**Verdict:** <strong: ...; weak or only adequate: ...; what I would change before defending it>
**What the self-critique changed in the plan:** <"the self-critique found X, so the plan now does Y";
open points left for Waseem>

## 8. LIMITATIONS this work touches (for the chat only)
<each as a heading; Baseline in bold when it comes up. These are told to Waseem; they are never written into the
code documentation or the analysis plan (he writes them in the dissertation)>

## 9. Steps after your approval
1. Commit and push the current state
2. Edits, one approved item at a time
3. Checks (code chain / live run / word scan / field check / same-words check / numbers)
4. CLAUDE.md, HOW_TO files, memory
5. Commit and push
6. Criticize and evaluate the result
```
