# The audit perspectives (pass 2)

Read the plan as each of these readers. Each one has its own questions. Under "for this project" are the
points that came up before; check them first.

## The future analyst (a person or an AI with no other context)
- Could they analyse the real data correctly using only CLAUDE.md, the two HOW_TO files and the analysis
  plan?
- Is every field name real, and is it clear which fields are raw (`blocks`) and which are computed
  (`headline`, `analysis`, `major_info_and_scores`)?
- For this project:
  - filter on `status: "Study Completed"`;
  - group every comparison by `condition_type`;
  - scenario 5 is a wish and scenario 6 is a test of the model;
  - never correlate a score with a part it is made of (VCI_all contains VCI; Stability is made of its two
    parts);
  - date records by `completed_at` (the record carries no version of the study code).

## Statistician
- Do formulas, levels, ranges, rounding and counts agree everywhere? Recompute one example by hand.
- For this project:
  - the random-chooser level differs by condition (57, 60, 63 and 60 for VCI in CVR+APA, CVR only, APA only
    and Baseline; hypothesis D3), so "50 = random" is true only for the blind-picking rule;
  - VCI weights 1.00 / 0.80 / 0.50 / 0.10 with six options;
  - Stability compares fairly between conditions only as exploratory (each condition moves the values by
    different rules);
  - 104 completers, 26 per condition: power .93 for a large difference (f = .40) and .54 for a medium one
    (f = .25), one-way ANOVA, α = .05 (checked by simulation, 11 November 2026);
  - Holm across the four primary hypotheses (A1, B1, C1, D1) and within each family.

## Preregistration (OSF) reviewer
- Are the hypotheses A1-D5 and the analysis rules word for word the same in every copy (the IRB text, the
  analysis plan 11.1, the freeze note 5.1, `VRDS2_Hypotheses_Draft.docx`, the OSF answers and the OSF Word
  file)?
- Is anything new labelled "exploratory"?
- For this project: the OSF registration still has the student group; it changes through OSF's Update
  feature (a justification plus the edited answers) after the IRB approves, once, before the first
  participant.

## IRB and privacy reviewer
- No Prolific ID, email, completion code, password or database address in any document, commit, screenshot
  or AI tool.
- Does the change keep every promise of the consent form (pay, five-year rule, withdrawal, technical
  problems, "confidential, not anonymous")?
- Is the consent page still the IRB form word for word (check T10)?
- Nothing is deployed before the IRB approves.

## Prolific's rules
- A rejection only for a valid reason: two or more of the four attention checks failed. Never for being
  slow, one failed check, a wrong code or the study's own measures.
- Pay at least $8 an hour (the reward is $7.00 for 35 minutes).
- Prolific approves by itself on day 21.

## The participant, in each condition
- What exactly does a participant see in CVR+APA, CVR only, APA only and **Baseline (no fit score and no
  "Ranked N - why" section)**, in each scenario, after each kind of answer?
- Does the change tell them their condition, their scores before the end, or a verdict on a choice? It
  must not.

## The code maintainer (a future Claude session)
- Does CLAUDE.md still describe the code as it is? Does the table of checks describe what each check
  checks today?
- Is a new database section allowed in both places (`dbShape.ts` and `WRITABLE_ROOTS` in
  `server/index.js`)?
- Does a new module that the checks compile appear in `tools/tsconfig.sim.json`?

## The advisor and the dissertation writer
- Is the design described as it is, with each choice's purpose?
- Will the writer's copies (the Source Pack, the update notes) need a refresh, and does the plan say so?

## Waseem himself
- Does the plan follow his standing rules (the memory), and stay inside the scope he set?
- Does it state what he must decide, in simple English, with a real example and a recommendation?
- Does it avoid raising points he has closed, and analysis-rule questions?

## Devil's advocate
- What is the single most likely way this change goes wrong?
- What would an unfriendly reviewer quote back?
- Add a check for each answer.
