"""make_writer_package.py: the results package for the dissertation writer agent (17 November 2026).

PLAN_Exploratory_analysis.md section 2.5 and D3-A: the writer receives RESULTS only (tables, figures, captions, notes), never
a data file, a participant code or a Prolific ID. This tool copies the result files of the first analysis (107 participants)
into the writer's folder, writes the note on how to write them, and then scans every copied file; it deletes the package and
stops if any file names a participant code (P001 ...), a 24-letter ID, an email, or says "SIMULATED".

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
PKG = WRITER / "Results (first analysis, 107 participants)"
BAD = [re.compile(r"\bP\d{3}\b"), re.compile(r"\b[0-9a-f]{24}\b", re.I), re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
       re.compile(r"SIMULATED")]


def main() -> int:
    for f in (REG / "RESULTS.md", EXP / "EXPLORATORY_RESULTS.md"):
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
approved sending these results to you (17 November 2026).

## 1. What is in this folder

| Folder | What it holds |
|---|---|
| `registered/` | The preregistered analysis: `RESULTS.md` (the sample, the manipulation checks, the positive controls, the 23 hypotheses, robustness), `tables_apa.tex` (four APA tables; needs `\\usepackage{{booktabs,threeparttable}}`), and the figures (PDF for LaTeX, PNG) with their captions in `figures/figure_captions.tex` and `.md` |
| `exploratory/` | Round 1 of the exploratory analyses, the nine the registration lists: `EXPLORATORY_RESULTS.md` and its figures with captions. Round 2 (the further exploratory analyses of the analysis plan) follows in a later note |

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

## 5. What is not here yet

- Round 2 of the exploratory analyses (a later note).
- Anything about the analysis of all 113 who completed: not part of this package.
"""


if __name__ == "__main__":
    sys.exit(main())
