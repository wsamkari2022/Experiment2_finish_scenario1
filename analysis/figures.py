"""figures.py: the figures for the registered hypotheses, each drawn from the same numbers as its test (17 November 2026).

Part 5 of PLAN_Analysis_code.md. Academic figures for the dissertation, in the APA manner: no title inside the picture (the
number, title and note go in the document; `figure_captions.md` and `figure_captions.tex` hold them, written from the same
numbers), clear axis labels with units, the sample size on the figure, 95% intervals, faint grid on the value axis only.
Each figure is saved as a vector PDF (for LaTeX) and a 300-dpi PNG, 6.5 inches wide (a full text width).

The four conditions keep one fixed color each everywhere (the first four slots of the validated categorical palette: blue,
orange, aqua, yellow; the dataviz validator passes every gate in light mode, and every condition is also named on its axis,
so color is never the only clue). A figure made from simulated participants carries "SIMULATED: not data" across its top.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt   # noqa: E402
import numpy as np                # noqa: E402

import registered_tests as rt     # noqa: E402

CONDITIONS = ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"]
LABEL = {"CVR+APA": "CVR + APA", "CVR_Only": "CVR only", "APA_Only": "APA only", "Baseline": "Baseline"}
COLOR = {"CVR+APA": "#2a78d6", "CVR_Only": "#eb6834", "APA_Only": "#1baf7a", "Baseline": "#eda100"}
INK, INK2, GRID, SURFACE, ACCENT, BAND = "#1a1a1a", "#555555", "#e6e6e6", "#ffffff", "#2a78d6", "#dbe8f8"
SCENARIO_LABEL = {1: "1\nAlone", 2: "2\nHousehold", 3: "3\nOthers", 4: "4\nEmployer's\nrules", 5: "5\nReceiving\n(wish)",
                  6: "6\nVeil\n(first rule)"}
WIDTH = 6.5

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9, "axes.labelsize": 9.5, "xtick.labelsize": 8.5, "ytick.labelsize": 8.5,
    "axes.edgecolor": "#9a9a9a", "axes.linewidth": 0.8, "axes.labelcolor": INK, "xtick.color": INK2, "ytick.color": INK2,
    "axes.grid": True, "axes.grid.axis": "y", "grid.color": GRID, "grid.linewidth": 0.6, "axes.axisbelow": True,
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "axes.spines.top": False, "axes.spines.right": False,
    "legend.frameon": False, "legend.fontsize": 8.5, "pdf.fonttype": 42, "savefig.bbox": "tight", "savefig.pad_inches": 0.05,
})
CAPTIONS: list[tuple[str, str, str]] = []   # (file name, title, note)


def _save(fig, out: Path, name: str, simulated: bool, title: str, note: str) -> None:
    if simulated:
        fig.text(0.5, 1.0, "SIMULATED: not data", ha="center", va="bottom", color="#c0392b", fontsize=10, fontweight="bold")
    out.mkdir(parents=True, exist_ok=True)
    fig.savefig(out / f"{name}.pdf")
    fig.savefig(out / f"{name}.png", dpi=300)
    plt.close(fig)
    CAPTIONS.append((name, title, note))


def _jitter(n, seed, width=0.16):
    return np.random.default_rng(seed).uniform(-width, width, n)


def _ci_mean(v, seed=1):
    v = np.asarray(v, float)
    v = v[~np.isnan(v)]
    b = v[np.random.default_rng(seed).integers(0, len(v), (4000, len(v)))].mean(1)
    return v.mean(), np.percentile(b, 2.5), np.percentile(b, 97.5)


def vci_by_condition(P, out, simulated):
    fig, ax = plt.subplots(figsize=(WIDTH, 3.4))
    for i, c in enumerate(CONDITIONS):
        v = P.loc[P["condition"] == c, "vci"].dropna().to_numpy()
        ax.scatter(i + _jitter(len(v), i), v, s=11, color=COLOR[c], alpha=0.55, linewidths=0, zorder=2)
        if len(v):
            m, lo, hi = _ci_mean(v, i)
            ax.errorbar(i + 0.30, m, yerr=[[m - lo], [hi - m]], fmt="o", color=INK, ms=4.5, lw=1.2, capsize=2.5, zorder=3)
            ax.text(i + 0.38, m, f"{m:.1f}", va="center", fontsize=8.5, color=INK)
        lvl = rt.RANDOM_LEVEL[c]
        ax.plot([i - 0.32, i + 0.24], [lvl, lvl], color=INK2, lw=1, ls=(0, (3, 2)), zorder=1)
    ax.set_xticks(range(4), [f"{LABEL[c]}\n(n = {int((P['condition'] == c).sum())})" for c in CONDITIONS])
    ax.set_xlim(-0.6, 3.75)
    ax.set_ylim(0, 103)
    ax.set_ylabel("Value Consistency Index (0-100)")
    _save(fig, out, "fig_A1-A3_D3_vci_by_condition", simulated,
          "Value Consistency Index by Condition",
          "Dots are participants. Black points with bars are condition means with 95% bootstrap confidence intervals "
          "(4,000 resamples). Dashed lines mark the level a random chooser reaches in each condition (57, 60, 63 and 60), "
          "the reference of Hypothesis D3. Hypotheses A1-A3 compare CVR + APA with each other condition.")


def a4_final_fit(S, out, simulated):
    dec = S[S["decision"] & S["first_misfit"]]
    fig, ax = plt.subplots(figsize=(WIDTH, 3.2))
    for i, c in enumerate(CONDITIONS):
        d = dec[dec["condition"] == c]
        k, n = int(d["final_good_fit"].sum()), len(d)
        share = k / n if n else 0.0
        ax.bar(i, share * 100, width=0.56, color=COLOR[c], zorder=2)
        if n:
            from scipy import stats
            ci = stats.binomtest(k, n).proportion_ci(confidence_level=0.95, method="exact")
            ax.errorbar(i, share * 100, yerr=[[share * 100 - ci.low * 100], [ci.high * 100 - share * 100]],
                        fmt="none", ecolor=INK, lw=1.1, capsize=2.5, zorder=3)
            ax.text(i + 0.31, share * 100, f"{share * 100:.0f}%\n({k}/{n})", va="center", fontsize=8, color=INK)
    ax.set_xticks(range(4), [LABEL[c] for c in CONDITIONS])
    ax.set_xlim(-0.55, 3.85)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Final choice fits own values (%)")
    _save(fig, out, "fig_A4_final_fit_after_misfit_first_pick", simulated,
          "Final Choices That Fit the Participant's Values After a First Pick Against Them",
          "Decisions in Scenarios 1-4 whose first pick was Misaligned or Strongly misaligned. Bars show the share whose final "
          "choice was Aligned or Weakly aligned, with exact (Clopper-Pearson) 95% confidence intervals; counts are decisions. "
          "Hypothesis A4 compares the three conditions with a help step with Baseline.")


def departure_by_scenario(S, out, simulated, col="departure"):
    fig, ax = plt.subplots(figsize=(WIDTH, 3.3))
    for o in range(1, 7):
        v = S.loc[S["order"] == o, col].dropna().to_numpy()
        if not len(v):
            continue
        m, lo, hi = _ci_mean(v, o)
        color = ACCENT if o <= 5 else INK2
        ax.errorbar(o, m, yerr=[[m - lo], [hi - m]], fmt="o", color=color, ms=5, lw=1.2, capsize=2.5)
        ax.text(o + 0.12, m, f"{m:.1f}", va="center", fontsize=8, color=INK)
    if col != "departure":
        ax.axhline(0, color=INK2, lw=0.8)
    ax.axvline(5.5, color=GRID, lw=1)
    ax.set_xticks(range(1, 7), [SCENARIO_LABEL[o] for o in range(1, 7)])
    ax.set_xlim(0.5, 6.6)
    ax.set_ylabel("Departure share (0-100)" if col == "departure" else "Menu-adjusted departure")
    adj = "" if col == "departure" else "_menu_adjusted"
    _save(fig, out, f"fig_B1-B5_departure_by_scenario{adj}", simulated,
          "Departure From the Participant's Own Values in Each Scenario" + ("" if col == "departure" else " (Menu-Adjusted)"),
          "Means with 95% bootstrap confidence intervals. Departure share: 0 = the option closest to the values brought into the "
          "scenarios, 100 = the farthest" + ("" if col == "departure" else "; the menu-adjusted value subtracts the mean departure "
          "share of all options on that menu") + ". Scenario 6 uses the rule chosen before the prediction was shown (Hypothesis "
          "B5). The scenarios came in one fixed order.")


def wish_gap(P, out, simulated):
    v = P["wish_gap"].dropna().round().astype(int)
    counts = v.value_counts().sort_index()
    fig, ax = plt.subplots(figsize=(WIDTH, 2.9))
    ax.bar(counts.index, counts.values, width=6, color=ACCENT, zorder=2)
    ax.axvline(0, color=INK2, lw=1, ls=(0, (3, 2)))
    ax.set_xlabel("Wish gap (points): the wish in Scenario 5 minus the decision in Scenario 4")
    ax.set_ylabel("Participants")
    n_pos, n_neg, n0 = int((v > 0).sum()), int((v < 0).sum()), int((v == 0).sum())
    ax.text(0.99, 0.95, f"above 0: {n_pos}   equal: {n0}   below 0: {n_neg}", transform=ax.transAxes, ha="right",
            va="top", fontsize=8, color=INK)
    _save(fig, out, "fig_B6_wish_gap", simulated,
          "The Wish on the Receiving End Compared With the Participant's Own Decision",
          "Both choices are judged on the values the participant held when Scenario 4 opened. Positive values: the wish fits "
          "the participant's values better than the decision (Hypothesis B6).")


def scatter(P, x, y, xlabel, ylabel, name, title, note, out, simulated, by_condition=False):
    fig, ax = plt.subplots(figsize=(WIDTH * 0.72, 3.5))
    ax.grid(True, axis="both")
    if by_condition:
        for c in CONDITIONS:
            m = P["condition"] == c
            ax.scatter(P.loc[m, x], P.loc[m, y], s=14, color=COLOR[c], alpha=0.8, linewidths=0, label=LABEL[c])
        ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=4, handletextpad=0.2, columnspacing=1.0)
    else:
        ax.scatter(P[x], P[y], s=14, color=ACCENT, alpha=0.75, linewidths=0)
    d = P[[x, y]].dropna()
    if len(d) > 3 and d[x].std() > 0:
        b, a = np.polyfit(d[x].astype(float), d[y].astype(float), 1)
        xs = np.linspace(d[x].min(), d[x].max(), 50)
        ax.plot(xs, a + b * xs, color=INK, lw=1)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    _save(fig, out, name, simulated, title, note)


def prediction(res, out, simulated):
    H = res["hypotheses"]
    rows = [("Scenario 6\n(rule before the prediction)", H["C1"].get("rate"), H["C1"].get("ci95_clopper_pearson"), 0.25),
            ("Scenarios 1-4\n(first picks)", H["C2"].get("hit_rate"), H["C2"].get("ci95_hit_rate"), 1 / 6)]
    fig, ax = plt.subplots(figsize=(WIDTH * 0.72, 3.2))
    for i, (lab, rate, ci, chance) in enumerate(rows):
        if rate is None:
            continue
        ax.bar(i, rate * 100, width=0.5, color=ACCENT, zorder=2)
        if ci:
            ax.errorbar(i, rate * 100, yerr=[[rate * 100 - ci[0] * 100], [ci[1] * 100 - rate * 100]], fmt="none",
                        ecolor=INK, lw=1.1, capsize=2.5, zorder=3)
        ax.plot([i - 0.42, i + 0.27], [chance * 100, chance * 100], color=INK2, lw=1.1, ls=(0, (3, 2)), zorder=4)
        ax.text(i + 0.29, rate * 100, f"{rate * 100:.1f}%", va="center", fontsize=8, color=INK)
        ax.text(i - 0.44, chance * 100, f"chance\n{chance * 100:.1f}%", fontsize=7.5, color=INK2, va="center", ha="right")
    ax.set_xticks(range(2), [r[0] for r in rows])
    ax.set_xlim(-0.95, 1.75)
    ax.set_ylim(0, 100)
    ax.set_ylabel("MPF's top pick was the choice (%)")
    _save(fig, out, "fig_C1-C2_prediction_hit_rates", simulated,
          "How Often the Moral Prediction Function Named the Participant's Choice",
          "Bars: hit rates; intervals: exact 95% (Scenario 6, Hypothesis C1) and 95% bootstrap over participants (Scenarios "
          "1-4, Hypothesis C2). Dashed lines: chance (one in four rules; one in six options).")


def calibration(res, out, simulated):
    cal = res["hypotheses"]["C3"].get("calibration") or []
    if not cal:
        return
    fig, ax = plt.subplots(figsize=(WIDTH * 0.62, 3.5))
    ax.grid(True, axis="both")
    xs = [c["mean_predicted"] * 100 for c in cal]
    ys = [c["observed_hit_rate"] * 100 for c in cal]
    ax.plot([0, 100], [0, 100], color="#bbbbbb", lw=1, label="perfect calibration")
    ax.axhline(25, color=INK2, lw=1, ls=(0, (3, 2)), label="chance (25%)")
    ax.plot(xs, ys, color=ACCENT, lw=1.6, marker="o", ms=4.5, label="observed")
    for x, y, c in zip(xs, ys, cal):
        ax.annotate(f"n = {c['n']}", (x, y), textcoords="offset points", xytext=(0, 7), ha="center", fontsize=7.5, color=INK2,
                    bbox={"boxstyle": "round,pad=0.15", "fc": "white", "ec": "none", "alpha": 0.9})
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.set_xlabel("MPF probability for its top rule (%)")
    ax.set_ylabel("Chose that rule (%)")
    ax.legend(loc="upper left")
    _save(fig, out, "fig_C3_calibration", simulated, "Calibration of the Prediction in Scenario 6",
          "Participants grouped by the probability the Moral Prediction Function gave its top rule; the observed share who "
          "chose that rule (before seeing the prediction) in each group (Hypothesis C3).")


def d1(S, res, out, simulated):
    d = rt.d1_differences(S).to_numpy()
    if not len(d):
        return
    ci = res["hypotheses"]["D1"].get("ci90_mean_difference")
    fig, ax = plt.subplots(figsize=(WIDTH, 2.6))
    ax.grid(True, axis="x")
    ax.grid(False, axis="y")
    ax.axvspan(-5, 5, color=BAND, lw=0, zorder=0, label="equivalence margin (+/-5)")
    ax.scatter(d, _jitter(len(d), 3, 0.22), s=9, color=INK2, alpha=0.55, linewidths=0, zorder=2)
    if ci:
        m = float(np.mean(d))
        ax.errorbar(m, 0.42, xerr=[[m - ci[0]], [ci[1] - m]], fmt="o", color=ACCENT, ms=5, lw=2, capsize=3, zorder=3)
        ax.text(ci[1] + 2, 0.42, f"mean {m:.1f}, 90% CI [{ci[0]:.1f}, {ci[1]:.1f}]", va="center", fontsize=8, color=INK)
    ax.set_ylim(-0.35, 0.6)
    ax.set_yticks([])
    ax.spines["left"].set_visible(False)
    ax.set_xlabel("Performance captured: final choice minus first pick (points, per participant)")
    _save(fig, out, "fig_D1_performance_difference", simulated,
          "Performance of the Final Choice Compared With the First Pick",
          "Each dot is one participant's mean difference over their decisions whose first pick went against their values and "
          "was followed by the condition's page. The shaded band is the preregistered equivalence margin; the interval is the "
          "90% confidence interval of the two one-sided tests (Hypothesis D1).")


def make_all(tables: dict, res: dict, out: Path, simulated: bool) -> None:
    CAPTIONS.clear()
    P, S = tables["P"], tables["S"]
    vci_by_condition(P, out, simulated)
    a4_final_fit(S, out, simulated)
    departure_by_scenario(S, out, simulated)
    departure_by_scenario(S, out, simulated, col="departure_menu_adjusted")
    wish_gap(P, out, simulated)
    scatter(P, "place_spread", "position_spread", "Block 1 place spread (rungs)", "Position spread (points)",
            "fig_B7_place_spread_vs_position_spread", "Two Kinds of Spread",
            "Each dot is one participant; the line is a least-squares fit for orientation only (Hypothesis B7 uses rank "
            "correlations).", out, simulated)
    prediction(res, out, simulated)
    calibration(res, out, simulated)
    d1(S, res, out, simulated)
    scatter(P, "vci", "wellbeing", "Value Consistency Index", "Well-being composite (1-7)", "fig_D4_vci_vs_wellbeing",
            "Value Consistency and Well-Being", "Each dot is one participant; the line is a least-squares fit for orientation "
            "only (Hypothesis D4 adjusts for Stability, performance, age, gender, active minutes and condition).",
            out, simulated, by_condition=True)
    scatter(P, "vci", "value_congruence", "Value Consistency Index", "Value congruence (1-7)",
            "fig_D5_vci_vs_value_congruence", "Value Consistency and Self-Reported Value Congruence",
            "Each dot is one participant; the line is a least-squares fit for orientation only (Hypothesis D5 uses Spearman's "
            "rank correlation).", out, simulated, by_condition=True)
    stamp = "SIMULATED: not data. " if simulated else ""
    md = [f"# Figure captions{' (SIMULATED: not data)' if simulated else ''}", ""]
    tex = []
    for name, title, note in CAPTIONS:
        md += [f"**{name}**: *{title}*. Note. {stamp}{note}", ""]
        esc = lambda s: s.replace("%", r"\%").replace("_", r"\_").replace("+/-", r"$\pm$")   # noqa: E731
        tex += [r"\begin{figure}[ht]", r"\centering", rf"\includegraphics[width=\textwidth]{{figures/{name}.pdf}}",
                rf"\caption{{{esc(title)}}}", rf"\label{{fig:{name}}}",
                rf"\par\smallskip\begin{{minipage}}{{\textwidth}}\footnotesize\textit{{Note.}} {esc(stamp + note)}\end{{minipage}}",
                r"\end{figure}", ""]
    (out / "figure_captions.md").write_text("\n".join(md), encoding="utf8")
    (out / "figure_captions.tex").write_text("\n".join(tex), encoding="utf8")
