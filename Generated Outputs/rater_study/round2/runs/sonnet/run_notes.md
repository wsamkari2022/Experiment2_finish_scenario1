# Run notes - rater_sonnet

**Model run on:** Claude Sonnet 5 (model id: claude-sonnet-5) — matches the folder's requirement (Claude Sonnet).

## Probe result

Both agent types were probed once, before any rating. Both PASSED all three rules (no reaching tool beyond SubagentHandback; could not read probe.txt; saw no project notes). Full word-for-word replies and the rule-by-rule verdicts are in `probe_result.md`.

## Rating runs

- **blind-value-rater** (values sheet, `sheet.md`, check code `birch-stone-37`): ran ONCE. Its JSON reply was valid, the check code matched, and it contained all three scenarios with all 4 values (vulnerable, harm, gain, helped) and all 6 letters A-F in every ranking and scores list. No second run was needed.
- **blind-measure-rater** (performance sheet, `sheet_measures.md`, check code `willow-quarry-26`): ran ONCE. Its JSON reply was valid, the check code matched, and it contained all four scenarios with all 5 measures (speed, resources, reliability, durability, reversibility) and all 6 letters A-F in every ranking and scores list. No second run was needed.

## Value rater - unclear and comments (copied as they came back)

**unclear:**
- Scenario 2, Option F (helped value): the sheet's headcount-based definition makes it hard to distinguish F from E/B since all three leave total evacuee numbers unchanged - only timing/safety shifts, which the 'helped' value as defined does not capture.
- Scenario 3, Option F (harm value): unclear whether reserved doses correlate at all with the 'cannot wait' progression-risk group, or are simply a separate axis (distance) from timing.

**comments:**
- In Scenario 4, the 'gain' value (financial) and 'reducing harm' value (someone steps in) sometimes pull in the same direction for Option A/C, making it hard to keep the two values fully independent - I rated each strictly on its own card text.
- Scenario 3's 'protecting the vulnerable' definition bundles two distinct criteria (sickest now vs. hardest to reach), which options C, F, and B each satisfy via a different one, complicating a clean single ranking.

## Measure rater - unclear and comments (copied as they came back)

**unclear:**
- Scenario 1, Option D: exact timing of the convoy slot within the six hours is not numerically specified, making precise speed placement against B and E somewhat interpretive.
- Scenario 2, Option D: whether the concrete school on the shelf counts as 'clear of the valley' for the speed measure is ambiguous, since it is a refuge within the valley system rather than an exit route.

**comments:**
- For several 'resources spared' judgments (e.g., Scenario 1 C, Scenario 4 E), an option that helps others directly (using a shared vehicle, shifting burden to family) is hard to separate from one that simply avoids using resources at all; I treated heavier use of a shared/communal resource as lower-scoring even when it benefited others, per the instruction to rate only what is used, not kindness.
- Scenario 3's reversibility measure had little textual basis for most options besides B (explicit hold-back) and C ('a sealed draw'); rankings among A/D/E/F rely on secondary inference about how easily each allocation method could be revised before doses are given.
