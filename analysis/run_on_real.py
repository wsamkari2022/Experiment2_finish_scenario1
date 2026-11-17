"""run_on_real.py: the registered analysis on the REAL coded data, and only after the code is frozen (17 November 2026).

Part 9 of PLAN_Analysis_code.md. It keeps the registered order ("the analysis code is written and run on simulated
participants before the data are opened"): it stops, and opens nothing, unless

  1. the Git tag `analysis-v1` exists (the freeze; docs/ANALYSIS_CODE_FREEZE.md), and every analysis file on disk is
     exactly the tagged one (the code that ran on the simulated participants is the code that runs on the data), and
  2. the file is a CODED copy: build_tables.load_records refuses any record holding a real-looking Prolific ID (24 letters
     a-f and digits) or an email.

Run (Waseem, in the project folder):
  analysis\\.venv\\Scripts\\python.exe analysis\\run_on_real.py "Prolific docs\\analysis\\2026-11-17_budget107\\participants_ai_safe.json"
The results go into a folder `results_<date of the data folder>` beside the data file, inside `Prolific docs/` (which Git
ignores). Nothing is sent anywhere.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
FREEZE_TAG = "analysis-v1"
# What the freeze covers: everything in analysis/ (the programs, the option numbers, the package lists) except the outputs of
# the simulated run (its report states how long the run took, which differs each time), and the two tools that feed it.
FROZEN = ["analysis", ":(exclude)analysis/simulation", "tools/simulate_records.cjs", "tools/export_option_numbers.cjs"]


def freeze_problems() -> list[str]:
    """Why the code on disk is not the frozen code (empty when it is)."""
    def git(*a):
        return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True)
    if git("rev-parse", "-q", "--verify", f"refs/tags/{FREEZE_TAG}").returncode != 0:
        return [f"the freeze tag {FREEZE_TAG} does not exist yet (the code has not been frozen)"]
    problems = []
    diff = git("diff", "--name-only", FREEZE_TAG, "--", *FROZEN).stdout.split()
    problems += [f"{f} differs from the frozen code" for f in diff]
    untracked = git("ls-files", "--others", "--exclude-standard", "--", *FROZEN).stdout.splitlines()
    problems += [f"{f} is not part of the frozen code" for f in untracked]
    return problems


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 1
    data = Path(argv[1]).resolve()
    problems = freeze_problems()
    if problems:
        print("STOPPED. The analysis code is not the frozen code, so the real data are not opened:")
        for p in problems:
            print(f"  - {p}")
        return 2
    if "prolific docs" not in str(data).lower():
        print("STOPPED. The real data must be in the 'Prolific docs' folder (Git ignores it).")
        return 2
    sys.path.insert(0, str(HERE))
    import pipeline as pl
    out = data.parent / f"results_{data.parent.name}"
    result = pl.analyse(data, out, simulated=False)
    res = result["results"]
    tp = res.get("two_programs", [])
    print(f"Done. {res['self_checks']['records_included']} participants analysed; "
          f"{sum(1 for r in tp if r.get('agree'))} of {len(tp)} numbers agree between Python and R.")
    print(f"Results: {out / 'RESULTS.md'} (figures in {out / 'figures'}).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
