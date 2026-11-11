# Strengthening examples (from this project)

Each pair shows a weaker version and a stronger one. Use them as patterns, not as text to copy.

## 1. A limitation, strength first
**Weaker:**
> The sample is too small to find a medium effect between conditions.

**Stronger:**
> The four conditions are balanced by the server (the condition with the fewest people is given next), and
> the four primary hypotheses are Holm-corrected together. The planned sample, 104 completed Prolific
> participants (26 per condition), has power of .93 for a large effect and .54 for a medium effect; smaller
> effects are reported as exploratory, with confidence intervals.

**Pattern:** how the design handles the issue, then the exact remaining limit, with its numbers.

## 2. A design choice stated with its purpose
**Weaker:** "Baseline's address uses BSL4."
**Stronger:** "The address names Baseline `BSL4`, so a participant never reads the name of their condition
and the blind holds."

## 3. Who sees it
**Weaker:** "Participants see the fit line on the cards."
**Stronger:** "In conditions 1-3, an opened card in scenarios 1-5 shows 'Matches your earlier answers: N out
of 100'. **Baseline has no fit score and no 'Ranked N - why' section**, and scenario 6 shows neither."

## 4. Code documentation keeps history, dated
**Weaker (history lost):** "Every participant has four attention checks."
**Stronger (in HOW_TO_READ):** "Every participant has four attention checks (since 10 November 2026; before
that, test versions had three in the university door). Records made before that date are test records."

## 5. An IRB or OSF text describes the launch version only
**Weaker (history in the protocol):** "The student group was removed, so the study now recruits only on
Prolific."
**Stronger (protocol text):** "Participants are recruited on Prolific."
**And in the 'What changed' box:** "One group, through Prolific. Course credit and the class announcement
removed."

## 6. A number with its reference
**Weaker:** "Their VCI was 57, which is low."
**Stronger:** "VCI 57 is the level a random chooser reaches in CVR+APA (hypothesis D3); blind picking alone
gives 50. So 57 says nothing about consistency in that condition."

## 7. Registered versus exploratory, stated exactly
**Weaker:** "Stability is compared between the conditions."
**Stronger:** "Stability is compared between conditions only as exploratory, because each condition moves
the values by different rules."

## 8. A pending change to registered text
**Weaker (silent edit):** D4's controls changed in the analysis plan alone.
**Stronger:** the hypothesis keeps its registered words, and a dated note beside it says: "Pending (IRB text
of 9 November 2026): D4 without 'group'; changed in every copy at the OSF Update."

## Words to watch
| Weak or risky | Better |
|---|---|
| "participants see X" (alone) | name the conditions, scenarios and answers |
| "checked" (when only read) | say which check ran and what it printed |
| "proves", "shows" (before data) | "tests whether", "is designed to" |
| "random = 50" (in a condition with help pages) | the condition's own random level |
| "fixed", "bug", "no longer" in an IRB or OSF text | the launch version, present tense |
| a copied number | the number recomputed from its source |
