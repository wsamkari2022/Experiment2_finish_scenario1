"""figures.py: the figures for the registered hypotheses, each drawn from the same numbers as its test (17 November 2026).

Part 5 of PLAN_Analysis_code.md. Static figures for the dissertation (PNG at 200 dpi and PDF). The four conditions keep one
fixed color each everywhere (the first four slots of the validated categorical palette: blue, orange, aqua, yellow; checked
with the dataviz validator, light mode: every gate passes, and the two lighter colors are always named on the axis, so a
color is never the only clue). Text is in neutral ink, the grid is faint, the marks are thin. A figure made from simulated
participants carries "SIMULATED: not data" across its top.
"""
from __future__ import annotations

import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt   # noqa: E402
import numpy as np                # noqa: E402

import registered_tests as rt     # noqa: E402

CONDITIONS = ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"]
LABEL = {"CVR+APA": "CVR+APA", "CVR_Only": "CVR only", "APA_Only": "APA only", "Baseline": "Baseline"}
COLOR = {"CVR+APA": "#2a78d6", "CVR_Only": "#eb6834", "APA_Only": "#1baf7a", "Baseline": "#eda100"}
INK, INK2, GRID, SURFACE, ACCENT = "#0b0b0b", "#52514e", "#e4e3df", "#ffffff", "#2a78d6"
SCENARIO_LABEL = {1: "1 Alone", 2: "2 Household", 3: "3 Others", 4: "4 Employer's\nrules", 5: "5 Receiving\n(wish)",
                  6: "6 Veil\n(first rule)"}

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": GRID, "axes.labelcolor": INK2,
    "axes.titlecolor": INK, "axes.titlesize": 10, "axes.titleweight": "bold", "xtick.color": INK2, "ytick.color": INK2,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.6, "axes.axisbelow": True, "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE, "axes.spines.top": False, "axes.spines.right": False, "legend.frameon": False,
})


def _save(fig, out: Path, name: str, simulated: bool) -> None:
    if simulated:
        fig.text(0.5, 0.995, "SIMULATED: not data", ha="center", va="top", color="#e34948", fontsize=11, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.96 if simulated else 1))
    out.mkdir(parents=True, exist_ok=True)
    fig.savefig(out / f"{name}.png", dpi=200)
    fig.savefig(out / f"{name}.pdf")
    plt.close(fig)


def _jitter(n, seed):
    return np.random.default_rng(seed).uniform(-0.18, 0.18, n)


def vci_by_condition(P, out, simulated):
    """A1-A3 and D3: each participant's VCI by condition; the dashed line is the condition's random-chooser level."""
    fig, ax = plt.subplots(figsize=(6.2, 3.8))
    for i, c in enumerate(CONDITIONS):
        v = P.loc[P["condition"] == c, "vci"].dropna().to_numpy()
        ax.scatter(i + _jitter(len(v), i), v, s=12, color=COLOR[c], alpha=0.75, linewidths=0)
        if len(v):
            q1, med, q3 = np.percentile(v, [25, 50, 75])
            ax.plot([i - 0.28, i + 0.28], [med, med], color=INK, lw=2)
            ax.plot([i, i], [q1, q3], color=INK, lw=1)
            ax.text(i + 0.31, med, f"{med:.0f}", va="center", fontsize=8, color=INK)
        lvl = rt.RANDOM_LEVEL[c]
        ax.plot([i - 0.38, i + 0.38], [lvl, lvl], color=INK2, lw=1, ls=(0, (3, 2)))
    ax.set_xticks(range(4), [f"{LABEL[c]}\n(n = {int((P['condition'] == c).sum())})" for c in CONDITIONS])
    ax.set_ylim(0, 102)
    ax.set_ylabel("Value Consistency Index (VCI, 0-100)")
    ax.set_title("A1-A3, D3: VCI by condition (dashed: random-chooser level)")
    _save(fig, out, "A1-A3_D3_vci_by_condition", simulated)


def a4_funnel(S, out, simulated):
    """A4: decisions whose first pick went against the values, and the share whose final choice fit them."""
    dec = S[S["decision"] & S["first_misfit"]]
    fig, ax = plt.subplots(figsize=(6.2, 3.4))
    for i, c in enumerate(CONDITIONS):
        d = dec[dec["condition"] == c]
        share = float(d["final_good_fit"].mean()) if len(d) else 0.0
        ax.bar(i, share * 100, width=0.55, color=COLOR[c])
        ax.text(i, share * 100 + 2, f"{share * 100:.0f}%\n{int(d['final_good_fit'].sum())} of {len(d)}", ha="center",
                va="bottom", fontsize=8, color=INK)
    ax.set_xticks(range(4), [LABEL[c] for c in CONDITIONS])
    ax.set_ylim(0, 115)
    ax.set_ylabel("Final choice fits their values (%)")
    ax.set_title("A4: final choice fits, after a misfit first pick")
    _save(fig, out, "A4_final_fit_after_a_misfit_first_pick", simulated)


def departure_by_scenario(S, out, simulated, col="departure"):
    """B1-B5: mean departure share in each scenario with a 95% bootstrap interval (scenario 6: the rule before the guess)."""
    fig, ax = plt.subplots(figsize=(6.6, 3.6))
    g = np.random.default_rng(1)
    for o in range(1, 7):
        v = S.loc[S["order"] == o, col].dropna().to_numpy()
        if not len(v):
            continue
        boots = v[g.integers(0, len(v), (4000, len(v)))].mean(1)
        lo, hi = np.percentile(boots, [2.5, 97.5])
        ax.plot([o, o], [lo, hi], color=INK2, lw=1.2)
        ax.scatter([o], [v.mean()], s=36, color=ACCENT if o <= 5 else INK2, zorder=3)
        ax.text(o + 0.12, v.mean(), f"{v.mean():.0f}", va="center", fontsize=8, color=INK)
    ax.set_xticks(range(1, 7), [SCENARIO_LABEL[o] for o in range(1, 7)])
    ax.set_ylabel("Departure share (0 = closest to own values)" if col == "departure" else "Menu-adjusted departure")
    ax.set_title("B1-B5: departure from own values, by scenario")
    _save(fig, out, "B1-B5_departure_by_scenario" + ("" if col == "departure" else "_menu_adjusted"), simulated)


def wish_gap(P, out, simulated):
    """B6: the wish gap (scenario 5 wish minus scenario 4 decision, on the same values), one bar per value."""
    v = P["wish_gap"].dropna().round().astype(int)
    counts = v.value_counts().sort_index()
    fig, ax = plt.subplots(figsize=(6.2, 3.2))
    ax.bar(counts.index, counts.values, width=7, color=ACCENT)
    ax.axvline(0, color=INK2, lw=1, ls=(0, (3, 2)))
    ax.set_xlabel("Wish gap (points; above 0 = the wish fits their values better)")
    ax.set_ylabel("Participants")
    ax.set_title("B6: the wish against the decision in scenario 4")
    _save(fig, out, "B6_wish_gap", simulated)


def scatter(x, y, xlabel, ylabel, title, name, out, simulated, P=None):
    fig, ax = plt.subplots(figsize=(5.2, 3.8))
    if P is not None:
        for c in CONDITIONS:
            m = P["condition"] == c
            ax.scatter(x[m], y[m], s=14, color=COLOR[c], alpha=0.8, linewidths=0, label=LABEL[c])
        ax.legend(fontsize=8, loc="best")
    else:
        ax.scatter(x, y, s=14, color=ACCENT, alpha=0.8, linewidths=0)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    _save(fig, out, name, simulated)


def prediction(res, out, simulated):
    """C1 and C2: the MPF's hit rate against chance, with intervals."""
    H = res["hypotheses"]
    rows = [("Scenario 6\n(rule before the guess)", H["C1"].get("rate"), H["C1"].get("ci95_clopper_pearson"), 0.25),
            ("Decisions 1-4\n(first picks)", H["C2"].get("hit_rate"), H["C2"].get("ci95_hit_rate"), 1 / 6)]
    fig, ax = plt.subplots(figsize=(5.4, 3.2))
    for i, (lab, rate, ci, chance) in enumerate(rows):
        if rate is None:
            continue
        ax.bar(i, rate * 100, width=0.5, color=ACCENT)
        if ci:
            ax.plot([i, i], [ci[0] * 100, ci[1] * 100], color=INK, lw=1.2)
        ax.plot([i - 0.32, i + 0.32], [chance * 100, chance * 100], color=INK2, lw=1, ls=(0, (3, 2)))
        ax.text(i + 0.3, rate * 100, f"{rate * 100:.0f}%", va="center", fontsize=8, color=INK)
        ax.text(i - 0.3, chance * 100 + 1.5, f"chance {chance * 100:.0f}%", fontsize=7, color=INK2)
    ax.set_xticks(range(2), [r[0] for r in rows])
    ax.set_ylim(0, 100)
    ax.set_ylabel("The MPF's top pick was their choice (%)")
    ax.set_title("C1, C2: how often the prediction named the choice")
    _save(fig, out, "C1-C2_prediction_hit_rates", simulated)


def calibration(res, out, simulated):
    cal = res["hypotheses"]["C3"].get("calibration") or []
    if not cal:
        return
    fig, ax = plt.subplots(figsize=(4.6, 4.0))
    xs = [c["mean_predicted"] * 100 for c in cal]
    ys = [c["observed_hit_rate"] * 100 for c in cal]
    ax.plot([0, 100], [0, 100], color=GRID, lw=1)
    ax.axhline(25, color=INK2, lw=1, ls=(0, (3, 2)))
    ax.plot(xs, ys, color=ACCENT, lw=2, marker="o", ms=5)
    for x, y, c in zip(xs, ys, cal):
        ax.text(x + 1.5, y, f"n={c['n']}", fontsize=7, color=INK2, va="center")
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.set_xlabel("The MPF's probability for its top rule (%)")
    ax.set_ylabel("Observed: chose that rule (%)")
    ax.set_title("C3: calibration in scenario 6")
    _save(fig, out, "C3_calibration", simulated)


def d1(S, res, out, simulated):
    d = rt.d1_differences(S).to_numpy()
    if not len(d):
        return
    ci = res["hypotheses"]["D1"].get("ci90_mean_difference")
    fig, ax = plt.subplots(figsize=(6.2, 2.8))
    ax.axvspan(-5, 5, color="#cde2fb", alpha=0.6, lw=0)
    ax.scatter(d, _jitter(len(d), 3), s=10, color=INK2, alpha=0.6, linewidths=0)
    if ci:
        ax.plot(ci, [0.32, 0.32], color=ACCENT, lw=3)
        ax.scatter([float(np.mean(d))], [0.32], color=ACCENT, s=30, zorder=3)
        ax.text(ci[1] + 1, 0.32, f"mean {np.mean(d):.1f}, 90% CI {ci[0]:.1f} to {ci[1]:.1f}", va="center", fontsize=8, color=INK)
    ax.set_yticks([])
    ax.set_xlabel("Performance captured: final choice minus first pick (points; shaded: the +/-5 margin)")
    ax.set_title("D1: final minus first pick, after a misfit first pick")
    _save(fig, out, "D1_performance_difference", simulated)


def make_all(tables: dict, res: dict, out: Path, simulated: bool) -> None:
    P, S = tables["P"], tables["S"]
    vci_by_condition(P, out, simulated)
    a4_funnel(S, out, simulated)
    departure_by_scenario(S, out, simulated)
    departure_by_scenario(S, out, simulated, col="departure_menu_adjusted")
    wish_gap(P, out, simulated)
    scatter(P["place_spread"], P["position_spread"], "Block 1 place spread (rungs)", "Position spread (points)",
            "B7: two kinds of spread", "B7_place_spread_vs_position_spread", out, simulated)
    prediction(res, out, simulated)
    calibration(res, out, simulated)
    d1(S, res, out, simulated)
    scatter(P["vci"], P["wellbeing"], "VCI", "Well-being composite (1-7)", "D4: VCI and well-being",
            "D4_vci_vs_wellbeing", out, simulated, P)
    scatter(P["vci"], P["value_congruence"], "VCI", "Value congruence (1-7)", "D5: VCI and value congruence",
            "D5_vci_vs_value_congruence", out, simulated, P)
