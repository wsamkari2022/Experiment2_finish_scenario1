"""make_writer_package.py: the results package for the dissertation writer agent (17 November 2026).

PLAN_Exploratory_analysis.md section 2.5 and D3-A: the writer receives the RESULTS (tables, figures, captions, notes). Since
Waseem's decision of 17 November 2026 (night) the writer may also receive the AI-safe data file of the 107, which Waseem
places himself; this package never contains it. This tool copies the result files of the first analysis (107 participants,
the registered analysis and exploratory rounds 1 and 2) into the writer's folder, writes the note on how to write them,
the note on how to read the AI-safe data, and a writer copy of HOW_TO_READ_MY_DATABASE.md (two sentences worded neutrally,
WRITER_COPY_EDITS), and then scans every file; it deletes the package and stops if any file names a participant code, a
24-letter ID, an email, or says "SIMULATED".

Section 6 of the registered RESULTS.md is replaced by one verified sentence: all 42 numbers both programs compute agree
(four of them through the one-off R check recorded in docs/ANALYSIS_CODE_FREEZE.md, section 5).

Run: analysis\\.venv\\Scripts\\python.exe exploratory\\make_writer_package.py
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REG = ROOT / "Prolific docs/analysis/2026-11-17_budget107/results_2026-11-17_budget107"
EXP = ROOT / "Prolific docs/analysis/2026-11-17_budget107/exploratory_2026-11-17_budget107"
WRITER = ROOT.parent.parent / "CHIRA 2026/Dissertation (LaTeX and PDF)/Experiment 2 files"
DICT = ROOT / "Generated Outputs/HOW_TO_READ_MY_DATABASE.md"
# The writer's copy of the dictionary words two sentences neutrally (Waseem: no negative information to the writer); the
# facts they carry (Prolific only since 10 November 2026; the consent version) are unchanged.
WRITER_COPY_EDITS = [
    ("The IRB refused the student group, so the study has one way in.", "Since 10 November 2026 the study has one way in."),
    ("the form sent to the IRB after it refused the student group.", "the Prolific consent form sent to the IRB (9 November 2026)."),
]
PKG = WRITER / "Results (first analysis, 107 participants)"
BAD = [re.compile(r"\bP\d{3}\b"), re.compile(r"\b[0-9a-f]{24}\b", re.I), re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
       re.compile(r"SIMULATED")]


def main() -> int:
    for f in (REG / "RESULTS.md", EXP / "EXPLORATORY_RESULTS.md", EXP / "EXPLORATORY_RESULTS_ROUND2.md", DICT):
        if not f.exists():
            print(f"Missing {f}")
            return 1
    if PKG.exists():
        shutil.rmtree(PKG)
    (PKG / "registered" / "figures").mkdir(parents=True)
    (PKG / "exploratory" / "figures").mkdir(parents=True)
    text = (REG / "RESULTS.md").read_text(encoding="utf8")
    cut = text.index("## 6. Two programs")
    text = text[:cut] + ("## 6. Two programs (Python and R)\n\nAn independent second program (R: lme4, survival, sandwich and "
                         "lmtest) computed the same tests; all 42 numbers that both programs compute agree.\n")
    (PKG / "registered" / "RESULTS.md").write_text(text, encoding="utf8")
    shutil.copy2(REG / "tables_apa.tex", PKG / "registered")
    for f in (REG / "figures").iterdir():
        if f.suffix in (".pdf", ".png", ".md", ".tex"):
            shutil.copy2(f, PKG / "registered" / "figures")
    shutil.copy2(EXP / "EXPLORATORY_RESULTS.md", PKG / "exploratory")
    shutil.copy2(EXP / "EXPLORATORY_RESULTS_ROUND2.md", PKG / "exploratory")
    dictionary = DICT.read_text(encoding="utf8")
    for old, new in WRITER_COPY_EDITS:
        if dictionary.count(old) != 1:
            print(f"The dictionary changed; the writer copy edit no longer fits: {old[:60]}")
            return 1
        dictionary = dictionary.replace(old, new)
    (PKG / "HOW_TO_READ_MY_DATABASE.md").write_text(dictionary, encoding="utf8")
    (PKG / "READING_THE_AI_SAFE_DATA.md").write_text(DATA_NOTE, encoding="utf8")
    for f in (EXP / "figures").iterdir():
        if f.suffix in (".pdf", ".png", ".md"):
            shutil.copy2(f, PKG / "exploratory" / "figures")
    res = json.loads((REG / "results.json").read_text(encoding="utf8"))
    a4 = res["hypotheses"]["A4"]
    supported = [h for h, d in res["decisions"].items() if d["supported"]]
    note = NOTE.format(n=res["self_checks"]["records_included"], supported=", ".join(supported),
                       help=round(100 * a4["good_fit_share_help"], 1), base=round(100 * a4["good_fit_share_baseline"], 1))
    (PKG / "UPDATE_17_November_results.md").write_text(note, encoding="utf8")
    problems = []
    for f in PKG.rglob("*"):
        if f.is_file() and f.suffix in (".md", ".tex"):
            t = f.read_text(encoding="utf8", errors="ignore")
            problems += [f"{f.name}: {rx.pattern}" for rx in BAD if rx.search(t)]
            if "exploratory" in f.parts and f.name.startswith("figure_captions") and t.count("Exploratory") < 2:
                problems.append(f"{f.name}: a caption without the word Exploratory")
            if "refused the student group" in t:
                problems.append(f"{f.name}: a sentence kept out of the writer's files")
    if problems:
        shutil.rmtree(PKG)
        print("STOPPED, the package was removed:\n  " + "\n  ".join(problems))
        return 2
    n_files = sum(1 for f in PKG.rglob("*") if f.is_file())
    print(f"Writer package: {n_files} files in {PKG}; scan clean (no code, ID, email or SIMULATED).")
    return 0


NOTE = """# Update, 17 November 2026: the results of the first analysis

**For:** the AI agent writing Waseem Samkari's Experiment 2 chapters.
**From:** the AI agent that built and ran the Experiment 2 analysis.
**Read this first.** It is newer than every other file in this folder; where they disagree, this note wins. Waseem
approved sending these results to you (17 November 2026). **Revised the same night:** round 2 of the exploratory analyses,
the note on reading the AI-safe data file, and the current database dictionary were added.

## 1. What is in this folder

| Folder | What it holds |
|---|---|
| `registered/` | The preregistered analysis: `RESULTS.md` (the sample, the manipulation checks, the positive controls, the 23 hypotheses, robustness), `tables_apa.tex` (four APA tables; needs `\\usepackage{{booktabs,threeparttable}}`), and the figures (PDF for LaTeX, PNG) with their captions in `figures/figure_captions.tex` and `.md` |
| `exploratory/` | Round 1 of the exploratory analyses, the nine the registration lists (`EXPLORATORY_RESULTS.md`), and round 2, the further exploratory analyses of the analysis plan (`EXPLORATORY_RESULTS_ROUND2.md`, B1-B14 and B9b), with their figures and captions (`figures/figure_captions_exploratory.md` and `..._round2.md`) |
| `READING_THE_AI_SAFE_DATA.md` | How to read the AI-safe data file of the 107, if Waseem gives it to you, and what you may and may not do with it |
| `HOW_TO_READ_MY_DATABASE.md` | The database dictionary as of 11 November 2026 (every field of a record). It replaces the older copy (24 October 2026) one folder up, which describes an earlier record layout |

Use only the numbers in these files. Do not compute new statistics: an analysis that is neither preregistered nor in
these files cannot be labelled correctly.

## 2. Facts about the analysis you may write

- The analysis code was written and run on simulated participants made by the study's own code before the data were
  opened, as the registration promises, and then frozen (17 November 2026). Every check passed, for example: with no
  effect planted, each test claimed support in at most 5.6 of 100 simulated studies (2,000 studies); planted effects were recovered
  at their planted sizes.
- The first analysis uses the {n} participants funded by the study budget (CVR+APA 27, CVR only 27, APA only 26, Baseline
  27), as the note of 16 November describes.
- On the real data, every derived score was recomputed from the saved records with the registered formulas and matched
  the saved value for every participant (16 checks). No page of a condition appeared in another condition.
- An independent second program (R) reproduced all 42 numbers the two programs share.

## 3. How to write the registered results

- Use the registration's words: a hypothesis is **"supported"** or **"not supported"**. Supported after the Holm
  correction: **{supported}**. The other hypotheses are not supported. The registration's own rule applies: no
  non-significant result is read as evidence of no effect; D1 is an equivalence test (equivalence is claimed only from it).
- **The positive controls come first.** The registration says that if one of them is absent, this is reported before any
  result that relies on the value profile. Two of the three appeared (pushing against pulling; the homeless shelter
  against the sidewalk). The third (a higher gain asked before harming entry-level workers than workers with a safety net)
  did not; its estimate went the other way. A design fact you may use when discussing it: in Block 3 the entry-level
  workers' cells always came first.
- **A4**: give the plain percentages beside the odds ratio: after a first pick that went against their values, the final
  choice fitted their values in {help}% of decisions with a help step and in {base}% in Baseline. The odds ratio's interval
  is wide because in Baseline only one of these decisions ended with a choice that fits.
- **Baseline has no fit score and no "Ranked N - why" section on its option cards, and no help step** after a choice.
  So A1 and A4 compare the full system with Baseline as a whole and cannot say which of the two differences matters (the
  registration's own interpretation of family A). A2 and A3 compare conditions that all show the fit line and the
  reasons.
- The p-values in the tables have three decimals; "> .999" and "< .001" follow APA style.

## 4. How to write the exploratory results

- Every one is **exploratory** (the registration: "All of the following are exploratory and labelled as such"). Write
  them as patterns, never as support or confirmation. Each has its 95% interval; the p-values are shown raw and as
  false-discovery-rate q-values within each analysis.
- Where `EXPLORATORY_RESULTS.md` says that a pattern may come from the fixed scenario order or the scenario content, or
  that a link is partly by construction, keep that sentence with the result.
- The written answers are summarised as themes with counts; each answer was placed under one main theme. Quote only the
  short examples in the themes table.
- Round 2: B7 places the real participants beside pretend kinds of chooser made by the study's own code; the pretend
  people are a ruler for reading the scores, never data. In B8, keep the column "partly built into the scores" with each
  correlation: a link built into how two measures are made is not a finding. B9's model with fit is the registered C7
  model (supported); B9 adds whether the option's MCF reading was opened, and B9b gives the fit term separately for the
  cards with the fit line and the "Ranked N - why" reasons (CVR + APA, CVR only, APA only) and without them (Baseline).
  B9b was added after the first reading of round 2: write it as an additional exploratory analysis. In B6, a row marked
  "not estimable" has no estimate: write that these data cannot estimate it, never that there is no effect.

## 5. What is not here

- Anything about the analysis of all 113 who completed: not part of this package.
- The data file itself: Waseem gives it to you separately; read `READING_THE_AI_SAFE_DATA.md` first.
"""


DATA_NOTE = """# Reading the AI-safe data file (17 November 2026)

**For:** the AI agent writing Waseem Samkari's Experiment 2 chapters.
**From:** the AI agent that built and ran the Experiment 2 analysis. Waseem approved giving you this file (17 November 2026).

## 1. The file

- **Name and place:** `participants_ai_safe.json`. Waseem places it in `Experiment 2 files/Data (AI-safe, 107 participants)/`.
- **What it holds:** the 107 participants of the first analysis (CVR+APA 27, CVR only 27, APA only 26, Baseline 27), one
  record each, every one with `status: "Study Completed"`. They are the participants funded by the study budget, as the
  note of 16 November 2026 and `UPDATE_17_November_results.md` describe.
- **Identity:** every Prolific ID is replaced by a code made of the letter P and three digits; `prolific_session_id` holds
  the same code followed by `-SESSION`, and `prolific_study_id` reads `STUDY1`. `_id` is the database's own row number and
  `participant_id` the study's own id for the run; neither names a person. The key from code to Prolific ID stays with
  Waseem and never comes to you.
- **Shape:** one JSON array of 107 objects, about 69 MB. It is too large to read as text; load it with code, for example in
  Python:

```python
import json
with open("participants_ai_safe.json", encoding="utf8") as f:
    records = json.load(f)
```

## 2. How to read a record

- The dictionary is `HOW_TO_READ_MY_DATABASE.md` in this folder (11 November 2026); a script checked on 17 November 2026
  that every field name in it is one the study's code writes. The older copy one folder up (24 October 2026) describes an
  earlier record layout; do not use it for this file.
- Start with its section 2 (the rooms of a document), section 3 (identity and progress), section 3c
  (`major_info_and_scores`: every major score in one place) and section 4 (`headline`).
- `blocks` holds the raw answers; `headline`, `analysis` and `major_info_and_scores` are computed from `blocks`. A computed
  field set beside the raw field it came from is not a finding.

## 3. Six things that read wrongly if missed

1. **Baseline has no fit score and no "Ranked N - why" section on its option cards**, and no reflection or clarification
   page after a choice. The fit is still computed and stored for Baseline (VCI is made of it); on screen, a Baseline
   participant met their own value numbers in "Your values in this scenario" and, when they opened it, in an option's
   details panel.
2. **Stability "not tested":** when `headline.stability_was_measured` is false, nothing tested it, and its 100 means "not
   tested", not "held". In APA only and Baseline the stabilities of the three sensitivities are null ("Not measured in this
   condition").
3. **Scenarios 5 and 6 are different kinds:** scenario 5 is a wish (scenario 4's decision, made by someone else and landing
   on the participant); scenario 6 is the test of the prediction (four rules, no performance numbers). Performance counts
   scenarios 1-4 only.
4. **Two "after" profiles:** `analysis.value_profile_after_block5` holds the study's values after scenario 4; the "after"
   that participants saw on the results page includes scenarios 5 and 6 (`analysis.value_profile_by_scenario`).
5. **Scores made of other scores:** VCI_all contains VCI, Stability_all contains Stability, and Stability is the average of
   its two parts. A score set beside a part of itself is not a finding.
6. **A 0 that means "not measured":** directness and context score 0 also when the answers could not measure them; check
   their `measured: false` flag (dictionary section 6h).

## 4. What you may do with it, and what you may not

- **Every result in the chapters comes from the results files** (`registered/`, `exploratory/`) with their labels. The data
  file does not replace them.
- You may use the file to look things up and to describe: how a record is laid out, what one coded participant chose in
  each scenario, or a count that the results files already give (it must match them).
- Do not compute a new statistic from it (a test, a p-value, an interval, a correlation, a new average over a group) and
  present it as a result: it would be neither preregistered nor part of the analysis. If a chapter needs a number the
  results files do not have, write a `\\todo{}` for Waseem; the analysis agent then computes it with the frozen analysis
  code, labelled as what it is.
- Quote written answers only from the themes table (`exploratory/EXPLORATORY_RESULTS.md`, A8x).
- Never put a participant code in the dissertation, and never place a code beside details that together could point to one
  person (for example age, gender and country).
"""


if __name__ == "__main__":
    sys.exit(main())
