"""report.py: RESULTS.md and APA-style LaTeX tables from results.json (17 November 2026).

Part 6 of PLAN_Analysis_code.md. It writes what the analysis returned, in the order of the hypotheses, and invents nothing:
every number is read from the results. The LaTeX tables follow APA style (booktabs rules, p as ".042" or "< .001", no
leading zero for correlations and p, effect sizes with their intervals, a note under each table) and need
\\usepackage{booktabs,threeparttable}. A report made from simulated participants says so on its first line and on every
table.
"""
from __future__ import annotations

import math
import re
from pathlib import Path

ORDER = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "C1", "C2", "C3", "C4", "C5", "C6", "C7",
         "D1", "D2", "D3", "D4", "D5"]
STAMP = "**SIMULATED: not data.** Every number below comes from pretend participants made by tools/simulate_records.cjs."
TEST_NAME = {"A1": "Mann-Whitney U", "A2": "Mann-Whitney U", "A3": "Mann-Whitney U", "A4": "Mixed logistic regression",
             "B1": "Wilcoxon signed-rank (two-sided)", "B2": "Wilcoxon signed-rank", "B3": "Wilcoxon signed-rank",
             "B4": "Wilcoxon signed-rank", "B5": "Wilcoxon signed-rank", "B6": "Wilcoxon signed-rank (Pratt)",
             "B7": "Spearman and partial Spearman", "C1": "Exact binomial", "C2": "Bootstrap (hit rate, log loss)",
             "C3": "Logistic regression", "C4": "Mann-Whitney U", "C5": "Exact binomial", "C6": "Bootstrap (log loss)",
             "C7": "Conditional logit (LR test)", "D1": "TOST (+/-5 points)", "D2": "Wilcoxon signed-rank",
             "D3": "One-sample Wilcoxon", "D4": "Two OLS regressions (HC3)", "D5": "Spearman"}


def finite(x):
    return x is not None and not isinstance(x, bool) and isinstance(x, (int, float)) and math.isfinite(x)


def apa_p(p):
    if not finite(p):
        return "-"
    if p < 0.001:
        return "< .001"
    if p > 0.999:
        return "> .999"
    return f"{p:.3f}".lstrip("0") if p < 1 else "1.000"


def no0(x, nd=2):
    """A number that cannot exceed 1 in size (r, rho, a proportion): no leading zero (APA)."""
    if not finite(x):
        return "-"
    s = f"{x:.{nd}f}"
    return s.replace("0.", ".", 1) if s.startswith(("0.", "-0.")) else s


def num(x, nd=2):
    return f"{x:.{nd}f}" if finite(x) else "-"


def ci(pair, fmt=num, nd=2):
    if not pair or not all(finite(v) for v in pair):
        return ""
    return f" [{fmt(pair[0], nd)}, {fmt(pair[1], nd)}]"


def statistic(h, r):
    if h in ("A1", "A2", "A3", "C4"):
        return f"U = {num(r.get('U'), 0)}" if finite(r.get("U")) else "-"
    if h in ("B1", "B2", "B3", "B4", "B5", "B6", "D2", "D3"):
        return f"T+ = {num(r.get('T_plus'), 0)}" if finite(r.get("T_plus")) else "-"
    if h == "A4":
        return f"z = {num(r.get('z'))}"
    if h == "B7":
        return f"rho = {no0(r['spearman'].get('rho'))}; partial = {no0(r['partial_spearman'].get('rho_partial'))}"
    if h in ("C1", "C5"):
        return f"{r.get('successes')}/{r.get('n')}" if r.get("successes") is not None else f"n = {r.get('n')} (not run)"
    if h == "C2":
        return f"hit = {no0(r.get('hit_rate'))}; log loss = {num(r.get('mean_log_loss'))}"
    if h == "C3":
        return f"z = {num(r.get('z'))}"
    if h == "C6":
        return f"diff = {num(r.get('estimate'), 3)}"
    if h == "C7":
        return f"chi2(1) = {num(r.get('likelihood_ratio'))}"
    if h == "D1":
        return f"t({r.get('df')}) = {num(r.get('t_lower'))}, {num(r.get('t_upper'))}" if r.get("df") else "-"
    if h == "D4":
        return (f"t = {num(r.get('wellbeing_composite', {}).get('t'))}; "
                f"{num(r.get('decision_satisfaction', {}).get('t'))}")
    if h == "D5":
        return f"rho = {no0(r.get('rho'))}"
    return "-"


def effect(h, r):
    if h in ("A1", "A2", "A3", "C4", "B1", "B2", "B3", "B4", "B5", "B6", "D2", "D3"):
        return f"r_rb = {no0(r.get('rank_biserial_r'))}{ci(r.get('ci95_rank_biserial_r'), no0)}"
    if h == "A4":
        return f"OR = {num(r.get('odds_ratio'))}{ci(r.get('ci95_odds_ratio'))}"
    if h == "B7":
        return f"rho = {no0(r['spearman'].get('rho'))}{ci(r['spearman'].get('ci95_rho'), no0)}"
    if h in ("C1", "C5"):
        return f"rate = {no0(r.get('rate'))}{ci(r.get('ci95_clopper_pearson'), no0)}" if finite(r.get("rate")) else "-"
    if h == "C2":
        return f"hit = {no0(r.get('hit_rate'))}{ci(r.get('ci95_hit_rate'), no0)}"
    if h == "C3":
        return f"OR(10 pts) = {num(r.get('odds_ratio_per_10_points'))}{ci(r.get('ci95_odds_ratio_per_10_points'))}"
    if h == "C6":
        return f"diff = {num(r.get('estimate'), 3)}{ci(r.get('ci95_mean_difference_log_loss'), num, 3)}"
    if h == "C7":
        b, se = r.get("fit_coefficient"), r.get("beside_clustered_wald", {}).get("se_clustered")
        if finite(b) and finite(se):
            return f"OR(10 pts) = {num(math.exp(10 * b))} [{num(math.exp(10 * (b - 1.959964 * se)))}, {num(math.exp(10 * (b + 1.959964 * se)))}]"
        return "-"
    if h == "D1":
        return f"M = {num(r.get('mean_difference'))}{ci(r.get('ci90_mean_difference'))} (90%)"
    if h == "D4":
        w, s = r.get("wellbeing_composite", {}), r.get("decision_satisfaction", {})
        return f"beta = {no0(w.get('standardized_beta_vci'))}{ci(w.get('ci95_beta'), no0)}; {no0(s.get('standardized_beta_vci'))}{ci(s.get('ci95_beta'), no0)}"
    if h == "D5":
        return f"rho = {no0(r.get('rho'))}{ci(r.get('ci95_rho'), no0)}"
    return "-"


def n_of(h, r):
    if h == "A4":
        return f"{r.get('decisions')} ({r.get('participants')})"
    if h == "C7":
        return f"{r.get('strata')} sets"
    for k in ("n", "participants", "decisions"):
        v = r.get(k)
        if v is not None:
            return "+".join(map(str, v)) if isinstance(v, list) else str(v)
    return "-"


def supported(h, r, d):
    if h == "C5" and not r.get("run", True):
        return "not run"
    if not d:
        return "-"
    return "yes" if d.get("supported") else "no"


def tex_escape(s: str) -> str:
    s = s.replace("\\", r"\textbackslash{}").replace("%", r"\%").replace("_", r"\_").replace("&", r"\&").replace("#", r"\#")
    s = s.replace("+/-", r"$\pm$").replace("chi2(1)", r"$\chi^2$(1)").replace("rho", r"$\rho$").replace("beta", r"$\beta$")
    s = s.replace("r\\_rb", r"$r_{rb}$").replace("T+", r"$T^{+}$").replace("< .001", r"$<$ .001").replace("> .999", r"$>$ .999")
    # a true minus sign before a number (not after a digit or a letter, so "Blocks 1-3" keeps its dash)
    s = re.sub(r"(?:(?<=^)|(?<=[\s\[(,=]))-(?=[\d.])", r"$-$", s)
    return s


def tex_table(caption: str, label: str, header: list[str], rows: list[list[str]], note: str, colspec: str, small=True) -> str:
    out = [r"\begin{table}[htbp]", r"\centering", r"\begin{threeparttable}", rf"\caption{{{caption}}}", rf"\label{{{label}}}",
           r"\footnotesize" if small else "", rf"\begin{{tabular}}{{{colspec}}}", r"\toprule",
           " & ".join(header) + r" \\", r"\midrule"]
    out += [" & ".join(tex_escape(c) for c in row) + r" \\" for row in rows]
    out += [r"\bottomrule", r"\end{tabular}", r"\begin{tablenotes}[flushleft]", r"\footnotesize",
            rf"\item \textit{{Note.}} {tex_escape(note)}", r"\end{tablenotes}", r"\end{threeparttable}", r"\end{table}", ""]
    return "\n".join(x for x in out if x != "")


def md_table(header, rows):
    return ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)] + ["| " + " | ".join(r) + " |" for r in rows]


def write(res: dict, out: Path, simulated: bool) -> None:
    H, D = res["hypotheses"], res["decisions"]
    sim_word = "SIMULATED: not data. " if simulated else ""
    hyp_rows = [[h, TEST_NAME[h], n_of(h, H[h]), statistic(h, H[h]), effect(h, H[h]), apa_p(H[h].get("p")),
                 apa_p(D.get(h, {}).get("p_holm_adjusted")), supported(h, H[h], D.get(h))] for h in ORDER]
    hyp_note = (sim_word + "One-sided tests in the predicted direction, except B1 (two-sided) and D1 (equivalence within +/-5 "
                "points by two one-sided tests; its interval is 90%). Holm correction: A1, B1, C1 and D1 together; the secondary "
                "hypotheses within their family (C5 leaves family C when fewer than 20 participants qualify). B7, C2 and D4 "
                "require both of their tests and use the larger p. Intervals are 95% percentile bootstrap intervals over "
                "participants (10,000 resamples), exact Clopper-Pearson intervals for single proportions, and Wald intervals for "
                "odds ratios and regression coefficients (C7: participant-clustered). r_rb = rank-biserial correlation; OR = odds "
                "ratio; OR(10 pts) = odds ratio per 10 points; rho = Spearman's correlation; beta = standardized coefficient "
                "(well-being; decision satisfaction). A4: decisions (participants).")
    fid = res["fidelity"]
    fid_rows = []
    for c, e in fid["exposure"].items():
        pages = "; ".join(f"{k.replace('met_', '').replace('_page', '').replace('confirm misfit', 'confirmation (misfit)').replace('_', ' ')} "
                          f"{v['n']} ({v['share'] * 100:.0f}%)" for k, v in e.items() if k.startswith("met_"))
        fid_rows.append([c.replace("_", " "), str(e["participants"]), pages])
    ctl_rows = [[r["claim"], str(r.get("n")), num(r.get("mean_difference")), f"T+ = {num(r.get('T_plus'), 0)}",
                 f"r_rb = {no0(r.get('rank_biserial_r'))}{ci(r.get('ci95_rank_biserial_r'), no0)}", apa_p(r.get("p"))]
                for r in res["positive_controls"].values()]

    # ---------------------------------------------------------------- RESULTS.md
    L = ["# Results of the registered analysis" + (" (SIMULATED)" if simulated else ""), ""]
    if simulated:
        L += [STAMP, ""]
    sc = res["self_checks"]
    L += ["## 1. The sample and the self-checks", "",
          f"Records read: {sc['records_read']}; included (status \"Study Completed\", no test session): {sc['records_included']}. "
          "Per condition: " + ", ".join(f"{k} {v}" for k, v in res["per_condition"].items()) + "."]
    L += [f"- Left out: {n} ({reason})." for reason, n in sc["left_out"].items()]
    L += ["", "Every derived number was recomputed with the registered formulas and compared with what the study saved:", ""]
    L += [f"- {line}" for line in sc["lines"][1:]]
    L += ["", "## 2. Manipulation (fidelity) checks and exposure", "",
          f"Pages seen outside their own condition: **{fid['exceptions_count']}**.", ""]
    L += md_table(["Condition", "n", "Met their condition's page at least once"], fid_rows)
    L += ["", "## 3. Positive controls (Blocks 1-3)", ""]
    L += md_table(["Control", "n", "Mean difference (rungs)", "Statistic", "Effect size [95% CI]", "p"], ctl_rows)
    L += ["", "## 4. The 23 hypotheses", ""]
    if simulated:
        L += [STAMP, ""]
    L += md_table(["H", "Test", "n", "Statistic", "Effect size [95% CI]", "p", "Holm p", "Supported"], hyp_rows)
    L += ["", f"*Note.* {hyp_note}", ""]
    claims = [f"- **{h}**: {H[h].get('claim', '')}" for h in ORDER]
    L += ["What each hypothesis claims (the registered words are in the OSF registration):", ""] + claims
    lom = [f"{h} {H[h].get('left_out_missing', 0)}" for h in ORDER if H.get(h, {}).get("left_out_missing")]
    L += ["", "Missing-data rule (a participant lacking a value a test needs leaves that test only): " +
          (", ".join(lom) if lom else "no participant was left out of any test") + "."]
    if H.get("A4", {}).get("mixed_model_tried"):
        L += ["", "A4: the mixed model was singular or did not converge, so the registered fallback (logistic regression with "
                  "participant-clustered robust errors) was used."]
    if "robustness" in res:
        keys = list(res["robustness"].keys())
        L += ["", "## 5. Robustness (shown beside each result, never replacing it)", ""]
        rob_rows = [[h, apa_p(H.get(h, {}).get("p"))] + [apa_p(res["robustness"][k]["p"].get(h)) if h in res["robustness"][k]["p"] else ""
                                                       for k in keys] for h in ORDER]
        L += md_table(["H", "Main p"] + [k.replace("_", " ") for k in keys], rob_rows)
        L += ["", "Participants left out in each check: " + ", ".join(
            f"{k.replace('_', ' ')} {v.get('left_out')}" for k, v in res["robustness"].items() if "left_out" in v) + "."]
    if "two_programs" in res:
        tp = res["two_programs"]
        bad = [r for r in tp if not r.get("agree")]
        L += ["", "## 6. Two programs (Python and R)", "", f"{len(tp) - len(bad)} of {len(tp)} numbers agree within their stated tolerance."]
        L += [f"- DISAGREES: {r['what']}: Python {r.get('python')}, R {r.get('R')}" for r in bad]
    (out / "RESULTS.md").write_text("\n".join(L) + "\n", encoding="utf8")

    # ---------------------------------------------------------------- APA LaTeX tables
    title_sim = " (SIMULATED: not data)" if simulated else ""
    tex = [f"% Tables of the registered analysis{title_sim}. Needs \\usepackage{{booktabs,threeparttable}}.", ""]
    tex.append(tex_table(f"Tests of the Preregistered Hypotheses{title_sim}", "tab:hypotheses",
                         ["H", "Test", "$n$", "Statistic", "Effect size [95\\% CI]", "$p$", "$p_{\\text{Holm}}$", "Supported"],
                         hyp_rows, hyp_note, "llllllll"))
    tex.append(tex_table(f"Manipulation Checks and Exposure by Condition{title_sim}", "tab:fidelity",
                         ["Condition", "$n$", "Participants who met their condition's page at least once"], fid_rows,
                         sim_word + f"Pages seen outside their own condition: {fid['exceptions_count']}. "
                         "CVR = the reflection step; APA = the clarification step; the rejection page returns to all options "
                         "(CVR only); Baseline's confirmation page asks how sure the participant is.", "lll"))
    tex.append(tex_table(f"Positive Controls in Blocks 1-3{title_sim}", "tab:controls",
                         ["Known effect", "$n$", "$M_{\\text{diff}}$ (rungs)", "Statistic", "Effect size [95\\% CI]", "$p$"],
                         ctl_rows, sim_word + "One-sided Wilcoxon signed-rank tests on the rung at which each answer turned "
                         "(never = one past the last rung); Block 3 compares each participant's mean over the three group sizes.",
                         "llllll"))
    if "robustness" in res:
        keys = [k for k in res["robustness"].keys()]
        names = {"without_fast_blocks": "w/o fast Blocks 1-3", "without_fast_scenarios": "w/o fast scenarios",
                 "without_straightliners": "w/o same answers", "without_attention_wrong": "w/o attention misses",
                 "family_B_menu_adjusted": "menu-adjusted (B)"}
        rob_rows = [[h, apa_p(H.get(h, {}).get("p"))] + [apa_p(res["robustness"][k]["p"].get(h)) if h in res["robustness"][k]["p"] else "" for k in keys]
                    for h in ORDER]
        left = "; ".join(f"{names.get(k, k)}: {v.get('left_out')} left out" for k, v in res["robustness"].items() if "left_out" in v)
        tex.append(tex_table(f"Robustness of Each Test{title_sim}", "tab:robustness",
                             ["H", "Main"] + [names.get(k, k) for k in keys], rob_rows,
                             sim_word + "Uncorrected p-values of each test without each preregistered group of participants "
                             f"({left}), and family B on the menu-adjusted departure. Shown beside the main results, never "
                             "replacing them.", "l" * (2 + len(keys))))
    (out / "tables_apa.tex").write_text("\n".join(tex) + "\n", encoding="utf8")
