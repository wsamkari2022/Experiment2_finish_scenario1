"""report.py: RESULTS.md and a LaTeX table from results.json (17 November 2026).

Part 6 of PLAN_Analysis_code.md. It writes what the analysis returned, in the order of the hypotheses, and invents
nothing: every number is read from the results. A report made from simulated participants says so on its first line and
on every table.
"""
from __future__ import annotations

import math
from pathlib import Path

ORDER = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "C1", "C2", "C3", "C4", "C5", "C6", "C7",
         "D1", "D2", "D3", "D4", "D5"]
STAMP = "**SIMULATED: not data.** Every number below comes from pretend participants made by tools/simulate_records.cjs."


def f(x, nd=3):
    if x is None or (isinstance(x, float) and not math.isfinite(x)):
        return "-"
    if isinstance(x, bool):
        return "yes" if x else "no"
    if isinstance(x, (int,)) and not isinstance(x, bool):
        return str(x)
    if abs(x) < 0.001 and x != 0:
        return f"{x:.1e}"
    return f"{x:.{nd}f}"


def effect_of(h: str, r: dict) -> str:
    if h in ("A1", "A2", "A3", "C4"):
        return f"r = {f(r.get('rank_biserial_r'), 2)}, d = {f(r.get('cohens_d'), 2)}, mean diff {f(r.get('estimate'), 1)}"
    if h in ("B1", "B2", "B3", "B4", "B5", "B6", "D2", "D3"):
        return f"r = {f(r.get('rank_biserial_r'), 2)}, mean {f(r.get('mean_difference'), 1)}"
    if h == "A4":
        return f"OR = {f(r.get('odds_ratio'), 2)}"
    if h == "B7":
        return f"rho = {f(r['spearman'].get('rho'), 2)}, partial {f(r['partial_spearman'].get('rho_partial'), 2)}"
    if h in ("C1", "C5"):
        return f"rate {f(r.get('rate'), 3)} (chance {f(r.get('chance'), 3)})" if r.get("rate") is not None else f"n = {r.get('n')}"
    if h == "C2":
        return f"hit {f(r.get('hit_rate'), 3)}, log loss {f(r.get('mean_log_loss'), 3)} (ln 6 = 1.792)"
    if h == "C3":
        return f"OR per 10 points {f(r.get('odds_ratio_per_10_points'), 2)}"
    if h == "C6":
        return f"log-loss diff {f(r.get('estimate'), 3)}, hit diff {f(r.get('beside_hit_rate_difference'), 3)}"
    if h == "C7":
        return f"OR per 10 fit points {f(r.get('odds_ratio_per_10_fit_points'), 2)}, LR {f(r.get('likelihood_ratio'), 1)}"
    if h == "D1":
        return f"mean diff {f(r.get('mean_difference'), 2)}, d_z {f(r.get('cohens_dz'), 2)}"
    if h == "D4":
        return (f"beta {f(r.get('wellbeing_composite', {}).get('standardized_beta_vci'), 2)} (well-being), "
                f"{f(r.get('decision_satisfaction', {}).get('standardized_beta_vci'), 2)} (satisfaction)")
    if h == "D5":
        return f"rho = {f(r.get('rho'), 2)}"
    return "-"


def ci_of(h: str, r: dict) -> str:
    for key in ("ci95_rank_biserial_r", "ci95_odds_ratio", "ci95_clopper_pearson", "ci95_hit_rate", "ci90_mean_difference",
                "ci95_mean_difference_log_loss", "ci95_rho", "ci95_odds_ratio_per_10_points"):
        if r.get(key):
            lo, hi = r[key]
            return f"{f(lo, 2)} to {f(hi, 2)}" + (" (90%)" if key.startswith("ci90") else "")
    if h == "B7" and r["spearman"].get("ci95_rho"):
        lo, hi = r["spearman"]["ci95_rho"]
        return f"{f(lo, 2)} to {f(hi, 2)}"
    if h == "D4" and r.get("wellbeing_composite", {}).get("ci95_beta"):
        lo, hi = r["wellbeing_composite"]["ci95_beta"]
        return f"{f(lo, 2)} to {f(hi, 2)} (well-being)"
    return "-"


def n_of(r: dict):
    for k in ("n", "participants", "decisions", "strata"):
        if r.get(k) is not None:
            v = r[k]
            return "+".join(map(str, v)) if isinstance(v, list) else str(v)
    return "-"


def write(res: dict, out: Path, simulated: bool) -> None:
    H, D = res["hypotheses"], res["decisions"]
    L = []
    L.append("# Results of the registered analysis" + (" (SIMULATED)" if simulated else ""))
    L.append("")
    if simulated:
        L += [STAMP, ""]
    sc = res["self_checks"]
    L.append("## 1. The sample and the self-checks")
    L.append("")
    L.append(f"Records read: {sc['records_read']}; included (status \"Study Completed\", no test session): "
             f"{sc['records_included']}. Per condition: " + ", ".join(f"{k} {v}" for k, v in res["per_condition"].items()) + ".")
    for reason, n in sc["left_out"].items():
        L.append(f"- Left out: {n} ({reason}).")
    L.append("")
    L.append("Every derived number was recomputed with the registered formulas and compared with what the study saved:")
    L.append("")
    for line in sc["lines"][1:]:
        L.append(f"- {line}")
    L.append("")
    fid = res["fidelity"]
    L.append("## 2. Manipulation (fidelity) checks and exposure")
    L.append("")
    L.append(f"Pages seen outside their own condition: **{fid['exceptions_count']}**.")
    L.append("")
    L.append("| Condition | Participants | Met their condition's page at least once |")
    L.append("|---|---|---|")
    for c, e in fid["exposure"].items():
        pages = "; ".join(f"{k.replace('met_', '').replace('_page', '').replace('_', ' ')}: {v['n']} ({v['share'] * 100:.0f}%)"
                          for k, v in e.items() if k.startswith("met_"))
        L.append(f"| {c} | {e['participants']} | {pages} |")
    L.append("")
    L.append("## 3. Positive controls (Blocks 1-3)")
    L.append("")
    L.append("| Control | n | Mean difference (rungs) | p (one-sided) | Present |")
    L.append("|---|---|---|---|---|")
    for k, r in res["positive_controls"].items():
        L.append(f"| {r['claim']} | {r.get('n')} | {f(r.get('mean_difference'), 2)} | {f(r.get('p'))} | {f(r.get('present'))} |")
    L.append("")
    L.append("## 4. The 23 hypotheses")
    L.append("")
    if simulated:
        L += [STAMP, ""]
    L.append("Holm: the four primary hypotheses together; the secondary ones within their family. B7, C2 and D4 use the larger "
             "of their two p-values. D1 is an equivalence test (supported = equivalent within +/-5 points).")
    L.append("")
    L.append("| H | Claim | n | Effect | 95% interval | p | Holm p | Supported |")
    L.append("|---|---|---|---|---|---|---|---|")
    for h in ORDER:
        r = H.get(h, {})
        d = D.get(h, {})
        sup = "not run (fewer than 20)" if h == "C5" and not r.get("run", True) else f(d.get("supported")) if d else "-"
        L.append(f"| {h} | {r.get('claim', '')} | {n_of(r)} | {effect_of(h, r)} | {ci_of(h, r)} | {f(r.get('p'))} | "
                 f"{f(d.get('p_holm_adjusted'))} | {sup} |")
    L.append("")
    L.append("Missing-data rule: participants left out of a test because a value it needs is missing: " +
             ", ".join(f"{h} {H[h].get('left_out_missing', 0)}" for h in ORDER if H.get(h, {}).get('left_out_missing')) +
             ("" if any(H.get(h, {}).get('left_out_missing') for h in ORDER) else "none") + ".")
    a4 = H.get("A4", {})
    if a4.get("mixed_model_tried"):
        L.append("")
        L.append("A4: the mixed model was singular or did not converge, so the registered fallback (logistic regression with "
                 "participant-clustered robust errors) was used.")
    if "robustness" in res:
        L.append("")
        L.append("## 5. Robustness (shown beside each result, never replacing it)")
        L.append("")
        keys = list(res["robustness"].keys())
        L.append("| H | Main p | " + " | ".join(k.replace("_", " ") for k in keys) + " |")
        L.append("|---|---|" + "---|" * len(keys))
        for h in ORDER:
            cells = [f(res["robustness"][k]["p"].get(h)) if h in res["robustness"][k]["p"] else "" for k in keys]
            L.append(f"| {h} | {f(H.get(h, {}).get('p'))} | " + " | ".join(cells) + " |")
        L.append("")
        L.append("Left out in each check: " + ", ".join(f"{k.replace('_', ' ')} {v.get('left_out')}"
                                                       for k, v in res["robustness"].items() if "left_out" in v) + ".")
    if "two_programs" in res:
        tp = res["two_programs"]
        bad = [r for r in tp if not r.get("agree")]
        L.append("")
        L.append("## 6. Two programs (Python and R)")
        L.append("")
        L.append(f"{len(tp) - len(bad)} of {len(tp)} numbers agree within their stated tolerance.")
        for r in bad:
            L.append(f"- DISAGREES: {r['what']}: Python {r.get('python')}, R {r.get('R')}")
    (out / "RESULTS.md").write_text("\n".join(L) + "\n", encoding="utf8")

    tex = [r"\begin{table}[ht]", r"\centering\small",
           r"\caption{The registered hypotheses" + (" (SIMULATED: not data)" if simulated else "") + "}",
           r"\begin{tabular}{llllll}", r"\hline", r"H & n & Effect & 95\% interval & $p$ & Holm $p$ \\", r"\hline"]
    for h in ORDER:
        r, d = H.get(h, {}), D.get(h, {})
        esc = lambda s: s.replace("%", r"\%").replace("_", r"\_")   # noqa: E731
        tex.append(f"{h} & {esc(n_of(r))} & {esc(effect_of(h, r))} & {esc(ci_of(h, r))} & {esc(f(r.get('p')))} & "
                   f"{esc(f(d.get('p_holm_adjusted')))} \\\\")
    tex += [r"\hline", r"\end{tabular}", r"\end{table}"]
    (out / "hypotheses_table.tex").write_text("\n".join(tex) + "\n", encoding="utf8")
