"""simulation_report.py: SIMULATION_REPORT.md from simulation_results.json, in plain words (17 November 2026).

Every number in it is SIMULATED: pretend participants made by the study's own code. None is a finding.
"""
from __future__ import annotations

from pathlib import Path


def pct(x):
    return "-" if x is None or x != x else f"{100 * x:.1f}%"


def write(s: dict, path: Path) -> None:
    ok = lambda b: "PASS" if b else "FAIL"   # noqa: E731
    L = ["# The analysis code, run on simulated participants (SIMULATED: not data)", "",
         "The registration (OSF page 6) promises: \"the analysis code is written and run on simulated participants before the "
         "data are opened.\" This is that run. The pretend participants were made by the study's own code "
         "(tools/simulate_records.cjs), so their records have exactly the shape of real ones. **No number here is a finding.**", "",
         f"Seed {s['seed']}; the whole run took {s.get('minutes')} minutes.", "",
         "## Summary", "",
         "| Check | What it proves | Result |", "|---|---|---|",
         f"| S1 the shape | every table is built, no needed field is missing, all four conditions present | {ok(s['S1']['ok'])} |",
         f"| S2 self-checks | every number the analysis recomputes equals what the study saved | {ok(s['S2']['ok'])} |",
         f"| S3 no effect | with nothing planted, each test claims support in at most about 5 in 100 studies | {ok(s['S3']['ok'])} |",
         "| S4 planted effects | planted effects are found, and the estimates land near the planted sizes | see section 4 |",
         f"| S5 the A4 model | the hand-written model recovers a planted odds ratio and agrees with R's lme4 | {ok(s['S5']['ok'])} |",
         f"| S6 repeatable | two runs on the same input give identical results | {ok(s['S6']['ok'])} |",
         f"| S7 privacy | a file with a Prolific ID or an email is refused; the real-data runner stops before the freeze | {ok(s['S7']['ok'])} |",
         f"| S8 two programs | Python and R agree on every number they both compute ({s['S8']['numbers_compared']} numbers) | {ok(s['S8']['ok'])} |",
         "", "## 1. The pretend records", "",
         f"The study's own data check on them: \"{s['data_check']}\"", "",
         "Rows built: " + ", ".join(f"{k} {v}" for k, v in s["S1"]["rows"].items()) + ".", "",
         "Self-checks (S2):", ""]
    L += [f"- {line}" for line in s["S2"]["lines"]]
    L += ["", "## 2. Each check broken on purpose once (it must catch it)", "", "| Break | Caught |", "|---|---|"]
    L += [f"| {b['break']} | {'yes' if b['caught'] else '**NO**'} |" for b in s["breaks"]]
    s3 = s["S3"]
    L += ["", f"## 3. S3: {s3['studies']} simulated studies with no effect", "",
          f"Each study: 107 people drawn from a pool of 1,004 pretend people (27 / 27 / 26 / 27). For each test the data were made "
          f"to hold no effect in the way that fits the test (condition labels shuffled for A1-A4; each participant's difference "
          f"given a random sign for the paired tests; choices made at random for C1 and C2; values shuffled for the correlations; "
          f"D1 with the true difference exactly at the +/-5 margin). A fair one-sided test claims support in about 5 of 100 "
          f"such studies; the upper limit allowed for chance in {s3['studies']} studies is {pct(s3['upper_band'])}.", "",
          "| Test | Studies where it ran | False claims (raw alpha .05) | Within the limit |", "|---|---|---|---|"]
    for h, v in s3["per_test"].items():
        L.append(f"| {h} | {v['studies_run']} | {pct(v['false_claims_raw_alpha'])} | {'yes' if v['within_band'] else '**no**'} |")
    L += ["", "With Holm's correction (any false claim in the group):", "", "| Group | False claims | Within the limit |", "|---|---|---|"]
    for g, v in s3["family_wise"].items():
        L.append(f"| {g} | {pct(v['family_wise_false_claims'])} | {'yes' if v['within_band'] else '**no**'} |")
    c5 = s3["c5_exact_false_claim_rate"]
    L += ["", f"C5 ran (20 or more people who changed after seeing the prediction) in {s3['c5_run_in']} of {s3['studies']} studies; "
          "otherwise it is described, as registered. Because C5 is an exact binomial test, its false-claim rate is known exactly "
          f"for every group size from 20 to 107: at most {pct(c5['largest'])} (at {c5['at_size']} people), "
          f"{'never above' if c5['all_at_or_below_5_percent'] else '**above**'} 5%."]
    L += ["", "## 4. S4: planted effects", "", "| Test | Planted | Found in | Mean estimate (planted size) |", "|---|---|---|---|"]
    for h, v in s["S4"].items():
        extra = f" (an exact calculation expects {pct(v['expected_share_exact_binomial'])})" if "expected_share_exact_binomial" in v else ""
        L.append(f"| {h} | {v['planted']} | {pct(v['found_in_share_of_studies'])}{extra} | "
                 f"{v['mean_estimate']:.3f} ({v['planted_size']}) |")
    s5 = s["S5"]
    L += ["", "## 5. S5: the A4 model", "",
          f"{s5['replicates']} studies with a planted log odds ratio of {s5['planted_log_odds_ratio']:.3f} (odds ratio 2) and a "
          f"random-intercept SD of {s5['planted_random_intercept_sd']}: mean estimate {s5['mean_estimate']:.3f} "
          f"(SD {s5['sd_estimate']:.3f}); the 95% interval held the planted value in {pct(s5['ci95_coverage'])} of studies "
          f"(about 95% expected); the registered fallback was needed in {s5['fallback_used']}.", "",
          "The same data through R's lme4 (glmer, 25 quadrature points):", ""]
    L += [f"- Python {x['python_coefficient']:.6f} (SE {x['python_se']:.6f}); R {x['R_coefficient']:.6f} (SE {x['R_se']:.6f}): "
          f"{'agree' if x['agree'] else '**differ**'}" for x in s5["agreement_with_lme4"]]
    L += ["", f"With no person-to-person variation at all, the model is singular and the fallback ran: "
          f"{'yes' if s5['no_variation_case']['fallback_used'] else '**no**'}."]
    L += ["", "## 6. Two programs (S8)", "",
          f"{s['S8']['numbers_compared'] - len(s['S8']['disagreements'])} of {s['S8']['numbers_compared']} numbers agree."]
    L += [f"- DISAGREES: {d['what']}" for d in s["S8"]["disagreements"]]
    L += ["", "## 7. Privacy (S7)", "",
          f"- The raw file (with the pretend Prolific IDs) was refused: {'yes' if s['S7']['raw_file_with_prolific_ids_refused'] else 'NO'}.",
          f"- Output files naming an ID: {', '.join(s['S7']['outputs_naming_an_id']) or 'none'}.",
          "- The real-data runner refuses now, because: " + "; ".join(s["S7"]["runner_refuses_before_the_freeze"]) + "."]
    path.write_text("\n".join(L) + "\n", encoding="utf8")
