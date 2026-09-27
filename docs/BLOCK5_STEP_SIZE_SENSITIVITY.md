# Step sizes: do the study's conclusions depend on them? (audit B3)

Written 26 September 2026, at the researcher's request ("you can do also (B7, P2, C7 B3)"). Nothing in the study
changed: this is a test of the code as it stands. Re-run it with `npm run report:step-sensitivity` (about 30
seconds); the numbers below are its output.

## 1. The question

Block 5 moves a participant's value scores in fixed steps. The steps were chosen by hand; nothing in the data
derives them. A reviewer can fairly ask: *"If you had picked +15 instead of +30, or +60, would your results be
different?"* The honest answer has to come from running the study again with other steps, not from argument.

| When it happens | What moves | Step | Where in the code |
|---|---|---|---|
| The participant keeps a misaligned option after the reflection, firmly | the value the option serves most / the value it gives up most | +30 / -20 | `applyEndorsementUpdates`, block5CVR.ts |
| The same, less firmly | the same two values | +15 / -10 | the same |
| The participant names a value on the APA page | the named value / each of the other three | +30 / -10 | `applyApaUpdates` |
| The participant keeps their second-best fit | where it beats the best fit most / where the best fit beats it most | +20 / -15 | `applyKeepUpdates` |
| After every reflection | the stakeholder sensitivity | +25 or -25 | both reflection paths |
| When a reflection view is answered | directness or context | +20 or -20 | both reflection paths |

Every step is multiplied by the scenario's stakes weight, and scores stay between 0 and 100 (a step past an edge is
cut off there and recorded, `analysis.value_moves_asked_for_and_made`). Picking the best fit moves nothing.

## 2. How it was tested

- **The same pretend people as every other report**: 2,000 random starting profiles, each run as the twelve kinds of
  chooser of `npm run report:vci` (always the best fit, true to their top value, random, a new value every scenario,
  and so on; the list is in docs/MAJOR_SCORES_DISTRIBUTION.md), through the real Block 5 code.
- **Eleven runs**: as shipped; every step at half size; every step at double size; and each family of steps alone
  at half and at double size (kept misaligned, APA named value, kept second-best, stakeholder).
- **How the steps were changed**: every step in block5CVR.ts passes through one function, `bump()`.
  `tools/step_scale_hook.cjs` multiplies the step inside that function while the report runs. The study's source is
  never edited.
- **Safety checks before believing any number**:
  - the hook really changed the code;
  - at the shipped sizes, the VCI of all 24,000 pretend people equals `report:vci` exactly (0 differ);
  - every family of steps was actually used: 51,951 kept-misaligned steps, 84,032 APA steps, 42,362
    kept-second-best steps and 47,094 stakeholder steps in one pass;
  - the reflection-view step is 0 by design: these pretend people answer no reflection view, and that step moves
    only directness and context, which neither VCI nor Stability reads.
- **The conclusions were written down before the runs.** "Clearly" means a separation of at least 0.75: pick one
  person of each kind at random, and the first scores higher at least 75 times in 100 (a coin gives 0.50).

## 3. The answer: every conclusion holds at every step size tested

| Conclusion | Shipped | Every step x0.5 | Every step x2 | Weakest of the one-family runs |
|---|---|---|---|---|
| C1 VCI: true to top value clearly above random choosers | 0.92 | 0.89 | 0.94 | 0.89 (kept misaligned x0.5) |
| C2 VCI: random choosers clearly above flip-floppers | 0.86 | 0.84 | 0.88 | 0.84 (kept misaligned x0.5) |
| C3 VCI order: best fit > true to top > random > flip-flopper > worst fit | holds | holds | holds | holds in all |
| C4 Stability: best-fit and second-best pickers always 100 | holds | holds | holds | holds in all |
| C5 Stability: true to top value clearly above random choosers | 0.84 | **0.75** | 0.88 | 0.80 (APA x0.5) |
| C6 Stability: flip-floppers below random choosers | holds | holds | holds | holds in all |
| C7 Performance: the chaser scores 100; following your top value costs performance | holds | holds | holds | holds in all |

**One result sits exactly on the line:** with every step halved, Stability separates people true to their top value
from random choosers at 0.75. Smaller steps move the values less, so fewer orders change, and random choosers start
to look steady too. The conclusion still holds, but more weakly.

## 4. What the step sizes DO change

The conclusions are comparisons between kinds of chooser. Some absolute levels move a lot with the steps, and
these must not be reported as if they were fixed facts.

**Stability's level, and so its level words.**

| Mean Stability | Best fit | True to top | Corrected by APA | Convert (keeps) | Chaser | Random | Flip-flopper (keeps) | Flip-flopper (APA) | Worst fit |
|---|---|---|---|---|---|---|---|---|---|
| As shipped | 100 | 91 | 94 | 56 | 80 | 57 | 12 | 29 | 10 |
| Every step x0.5 | 100 | 94 | 98 | 63 | 90 | 77 | 41 | 57 | 36 |
| Every step x2 | 100 | 85 | 80 | 48 | 66 | 40 | 1 | 17 | 2 |
| Kept misaligned x0.5 | 100 | 95 | 94 | 64 | 91 | 71 | 43 | 29 | 36 |
| Kept misaligned x2 | 100 | 85 | 94 | 47 | 63 | 42 | 0 | 29 | 2 |
| APA named value x0.5 | 100 | 91 | 98 | 56 | 80 | 63 | 12 | 58 | 10 |
| APA named value x2 | 100 | 91 | 80 | 56 | 80 | 55 | 12 | 17 | 10 |

A random chooser averages 57 as shipped, 77 with half steps and 40 with double steps. So a single participant's
"Shifted a little" or "Held steady" depends partly on a number we chose.

**What this means:**
- Report Stability as comparisons between groups or conditions.
- Never report the level word of one person as a finding.

The step that matters most is the kept-misaligned step: it alone moves the random chooser from 71 to 42.

**One honest change of mind (audit G6).** The convert, who changes value once and then holds it, scores between
47 and 64 on Stability and between 54 and 74 on VCI, depending on the kept-misaligned step. Against random choosers
on Stability it separates at only 0.33 to 0.57 across the runs. This is the known limit G6: at no step size does
one change of mind read clearly better than random. It is a question about what Stability should mean, not about
the step size.

**The stakeholder stability** moves with its own step, by construction: random choosers 45 as shipped, 70 at half,
24 at double. Only the stakeholder step changes it.

## 5. What the step sizes do NOT change

| Score | Shipped | Range over the eleven runs |
|---|---|---|
| VCI, always the best fit | 100 | 100 |
| VCI, random chooser | 57 | 56-57 |
| VCI, always the worst fit | 10 | 10 |
| VCI, true to top value | 85 | 82-87 |
| Performance, true to top value | 40 | 40 |
| Performance, random chooser | 52 | 51-52 |
| Performance, the chaser | 100 | 100 |
| Stability "not measured", true to top value | 38% | 36-38% |

- **VCI barely moves.** VCI judges each choice on the profile the scenario opened with. Steps change that profile
  only for the NEXT scenario, and only through the labels.
- **Performance moves by 2 points at most.** It depends on the options chosen, and the steps change choices only
  indirectly.
- **The position effect and the card order cannot move at all.** Both read the profile the participant brought INTO
  Block 5, which the steps never touch (block5Position.ts, block5Planner.ts). Checked:
  `STEP_SCALE="all=2" node -r ./tools/step_scale_hook.cjs tools/simulate_position.cjs` gives exactly the same output
  as the shipped steps, and so does `all=0.5`.

## 6. What to write in the thesis

1. Declare the steps as design parameters (the table in section 1), chosen by the researcher and not estimated.
2. Say they were tested at half and double size, each family alone and all together, and that every comparison the
   thesis makes held (section 3). Cite this file and the command.
3. State the two things that do depend on them:
   - Stability's absolute level, so it is reported as group comparisons;
   - the convert's reading (G6).
4. Freeze the steps before real data (the pre-registration note), so they cannot be tuned after seeing results.

## 7. The tools

- `tools/step_scale_hook.cjs`: the loader that changes the steps. It stops the run if a step carries a reason that
  fits no family, so a renamed step cannot slip past unscaled.
- `tools/report_step_sensitivity.cjs`: the eleven runs, the tables and the conclusions (`npm run report:step-sensitivity`).
- `tools/behavior_sim.cjs`: the one simulated path shared with docs/MAJOR_SCORES_DISTRIBUTION.md.
