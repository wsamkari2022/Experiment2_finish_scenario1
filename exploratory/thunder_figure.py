"""thunder_figure.py: the "thunder" figure for the DIS 2027 paper (27 November 2026; exploratory, descriptive).

Waseem's design: every participant is one line through Scenarios 1-6; the y-axis is the VCI_all score of the option they
chose in each scenario (the running fit, analysis.vci_all.by_scenario.running_score_0_to_100: 100 / 80 / 50 / 10 on the
six-option menus, 100 / 67 / 33 / 0 on the four rules of Scenario 6); each version has its color; the bold lines are the
version means. Two zones: help steps on (Scenarios 1-4, where each version's own page follows a choice) and off (5-6).
Brackets name the two indexes: VCI is the mean of Scenarios 1-4, VCI_all the mean of all six.

Two self-checks before drawing: each participant's six scores average to their stored VCI_all (rounded), and their
Scenario 1-4 scores average to their stored VCI. Small sideways offsets separate the versions and the people; the
scores themselves are never moved. A dark ("thunder") and a light version of the same design are written.

Run: analysis\\.venv\\Scripts\\python.exe exploratory\\thunder_figure.py <participants_ai_safe.json> <output folder>
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import explore as ex                       # noqa: E402  (loads the frozen modules read-only)
from explore import bt, plt                # noqa: E402
from matplotlib import patheffects as pe   # noqa: E402

get = bt.get
VERSIONS = ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"]
NAMES = {"CVR+APA": "CVR + APA", "CVR_Only": "CVR only", "APA_Only": "APA only", "Baseline": "Baseline"}
THEMES = {
    "dark": {"bg": "#0b1020", "zone_on": "#121b36", "zone_off": "#0b1020", "ink": "#e8ecf4", "ink2": "#9aa4b8",
             "grid": "#1d2747", "divider": "#55607a",
             "color": {"CVR+APA": "#5b9cf0", "CVR_Only": "#ff8a5c", "APA_Only": "#3fd39b", "Baseline": "#ffc53d"},
             "line_alpha": 0.30, "glow_alpha": 0.06, "dot_alpha": 0.55, "outline": "#0b1020"},
    "light": {"bg": "#ffffff", "zone_on": "#eef4fc", "zone_off": "#ffffff", "ink": "#1a1a1a", "ink2": "#555555",
              "grid": "#e6e6e6", "divider": "#9a9a9a",
              "color": {"CVR+APA": "#2a78d6", "CVR_Only": "#eb6834", "APA_Only": "#1baf7a", "Baseline": "#eda100"},
              "line_alpha": 0.22, "glow_alpha": 0.0, "dot_alpha": 0.45, "outline": "#ffffff"},
}
OFFSET = {"CVR+APA": -0.21, "CVR_Only": -0.07, "APA_Only": 0.07, "Baseline": 0.21}
X_LABELS = ["1\nAlone", "2\nHousehold", "3\nOthers", "4\nEmployer's\nrules", "5\nWish", "6\nVeil"]
LEVELS = [0, 10, 33, 50, 67, 80, 100]


def js_round(x):
    return math.floor(x + 0.5)


def load(path):
    docs = bt.load_records(Path(path))
    T = bt.build(docs)
    keep = set(T["P"]["pid"])
    cond = T["P"].set_index("pid")["condition"].to_dict()
    people, bad6, bad4 = [], 0, 0
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid not in keep:
            continue
        rows = sorted(get(d, "analysis.vci_all.by_scenario") or [], key=lambda r: r.get("order_shown", 0))
        s = [float(r["running_score_0_to_100"]) for r in rows]
        if len(s) != 6:
            continue
        bad6 += js_round(np.mean(s)) != get(d, "analysis.vci_all.vci_all")
        # the study stores VCI from a floating-point sum: a mean of exactly 57.5 can be stored as 57 (57.4999...)
        bad4 += abs(np.mean(s[:4]) - get(d, "headline.consistency_score")) > 0.5 + 1e-9
        people.append({"condition": cond[pid], "scores": s, "vci_all_stored": float(get(d, "analysis.vci_all.vci_all"))})
    return people, {"participants": len(people), "six_score_mean_differs_from_stored_vci_all": int(bad6),
                    "four_score_mean_differs_from_stored_vci": int(bad4)}


def summary(people):
    out = {}
    for v in VERSIONS:
        S = np.array([p["scores"] for p in people if p["condition"] == v])
        stored = [p["vci_all_stored"] for p in people if p["condition"] == v]
        out[v] = {"n": int(len(S)), "by_scenario": [float(x) for x in S.mean(0)], "vci": float(S[:, :4].mean()),
                  "vci_all_exact": float(S.mean()), "vci_all": float(np.mean(stored))}   # vci_all: the stored whole numbers
    return out


def draw(people, summ, theme, out, name):
    th = THEMES[theme]
    plt.rcParams.update({"axes.edgecolor": th["ink2"], "xtick.color": th["ink2"], "ytick.color": th["ink2"],
                         "axes.labelcolor": th["ink"], "text.color": th["ink"]})
    fig = plt.figure(figsize=(6.9, 4.35), facecolor=th["bg"])
    gs = fig.add_gridspec(1, 2, width_ratios=[4.25, 1.5], wspace=0.04, left=0.085, right=0.995, top=0.80, bottom=0.17)
    ax, sb = fig.add_subplot(gs[0]), fig.add_subplot(gs[1])
    for a in (ax, sb):
        a.set_facecolor(th["bg"])
    ax.grid(False)
    # the two zones
    ax.axvspan(0.5, 4.5, color=th["zone_on"], zorder=0, lw=0)
    ax.axvspan(4.5, 6.5, color=th["zone_off"], zorder=0, lw=0)
    ax.axvline(4.5, color=th["divider"], lw=0.9, ls=(0, (4, 3)), zorder=1)
    for lv in LEVELS:
        ax.axhline(lv, color=th["grid"], lw=0.6, zorder=1)
    ax.text(2.5, 104.5, "HELP STEPS ON", ha="center", va="bottom", fontsize=7.2, color=th["ink2"], fontweight="bold")
    ax.text(5.5, 104.5, "HELP STEPS OFF", ha="center", va="bottom", fontsize=7.2, color=th["ink2"], fontweight="bold")
    # every participant: a faint line (with a soft glow in the dark version)
    rng = np.random.default_rng(20261127)
    order = rng.permutation(len(people))
    for i in order:
        p = people[i]
        c = th["color"][p["condition"]]
        xs = np.arange(1, 7) + OFFSET[p["condition"]] + rng.uniform(-0.035, 0.035)
        if th["glow_alpha"]:
            ax.plot(xs, p["scores"], color=c, lw=2.6, alpha=th["glow_alpha"], solid_capstyle="round", zorder=2)
        ax.plot(xs, p["scores"], color=c, lw=0.65, alpha=th["line_alpha"], zorder=3)
        ax.scatter(xs, p["scores"], s=4, color=c, alpha=th["dot_alpha"], lw=0, zorder=3)
    # the version means
    for v in VERSIONS:
        xs = np.arange(1, 7) + OFFSET[v]
        ax.plot(xs, summ[v]["by_scenario"], color=th["color"][v], lw=2.4, zorder=5,
                path_effects=[pe.Stroke(linewidth=4.2, foreground=th["outline"]), pe.Normal()])
        ax.scatter(xs, summ[v]["by_scenario"], s=22, color=th["color"][v], edgecolor=th["outline"], lw=0.9, zorder=6)
    ax.set_xlim(0.5, 6.5)
    ax.set_ylim(-4, 104)
    ax.set_xticks(range(1, 7), X_LABELS, fontsize=7.6)
    ax.set_yticks(LEVELS, [str(v) for v in LEVELS], fontsize=7.6)
    ax.tick_params(length=0)
    ax.set_ylabel("Fit of the chosen option (VCI_all score, 0-100)", fontsize=8.2)
    ax.set_xlabel("Scenario", fontsize=8.2, labelpad=4)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    # the two brackets, above the plot
    def bracket(x0, x1, y, text):
        kw = dict(transform=ax.get_xaxis_transform(), clip_on=False, color=th["ink"], lw=0.9)
        ax.plot([x0, x0, x1, x1], [y - 0.025, y, y, y - 0.025], **kw)
        ax.text((x0 + x1) / 2, y + 0.012, text, transform=ax.get_xaxis_transform(), ha="center", va="bottom", fontsize=7.6,
                color=th["ink"])
    bracket(0.62, 4.38, 1.085, "VCI  =  mean of Scenarios 1-4")
    bracket(0.62, 6.38, 1.19, "VCI_all  =  mean of all six scenarios")
    # the scoreboard
    sb.axis("off")
    sb.set_xlim(0, 1)
    sb.set_ylim(0, 1)
    # each version: its name on one line; its n, VCI and VCI_all on the line below, under the column heads
    sb.text(0.06, 0.955, "Version", fontsize=7.4, color=th["ink2"], fontweight="bold", va="center")
    sb.text(0.655, 0.955, "VCI", fontsize=7.4, color=th["ink2"], fontweight="bold", va="center", ha="right")
    sb.text(0.99, 0.955, "VCI_all", fontsize=7.4, color=th["ink2"], fontweight="bold", va="center", ha="right")
    for k, v in enumerate(VERSIONS):
        y = 0.865 - k * 0.11
        sb.plot([0.06, 0.15], [y + 0.022, y + 0.022], color=th["color"][v], lw=2.6, solid_capstyle="round")
        sb.text(0.19, y + 0.022, NAMES[v], fontsize=7.6, va="center", fontweight="bold")
        sb.text(0.19, y - 0.030, f"n = {summ[v]['n']}", fontsize=6.6, va="center", color=th["ink2"])
        sb.text(0.655, y - 0.030, f"{summ[v]['vci']:.1f}", fontsize=7.6, va="center", ha="right")
        sb.text(0.99, y - 0.030, f"{summ[v]['vci_all']:.1f}", fontsize=7.6, va="center", ha="right")
    sb.text(0.06, 0.38, "Thin lines: one participant.\nBold lines: the version mean.\n\nScores: 100 / 80 / 50 / 10\n"
                        "on six options (S1-S5),\n100 / 67 / 33 / 0 on the\nfour rules of S6.", fontsize=6.6, va="top",
            color=th["ink2"], linespacing=1.35)
    out.mkdir(parents=True, exist_ok=True)
    fig.savefig(out / f"{name}.pdf", facecolor=th["bg"])
    fig.savefig(out / f"{name}.png", dpi=300, facecolor=th["bg"])
    plt.close(fig)


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    people, checks = load(argv[1])
    out = Path(argv[2])
    summ = summary(people)
    draw(people, summ, "dark", out, "DIS27_fig_thunder_dark")
    draw(people, summ, "light", out, "DIS27_fig_thunder_light")
    res = {"checks": checks, "means": summ}
    (out / "DIS27_thunder_numbers.json").write_text(json.dumps(res, indent=1), encoding="utf8")
    print(json.dumps(res, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
