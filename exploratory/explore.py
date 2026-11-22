"""explore.py: the EXPLORATORY analyses, round 1 (Tier A: the nine the registration lists) (17 November 2026).

PLAN_Exploratory_analysis.md, approved by Waseem ("D1-A, D2-A, D3-A, D4-A", 17 November 2026). OSF page 6: "All of the
following are exploratory and labelled as such". Every result here is EXPLORATORY: it describes a pattern and never
confirms a hypothesis. The rules (plan 2.3), the same for every analysis:
  1. "Exploratory" in every table title, figure caption and heading;
  2. every estimate with its 95% interval (percentile bootstrap, 10,000 resamples, seeded by the master seed and the
     analysis's name, as the frozen code does; exact intervals for proportions);
  3. p-values raw and as Benjamini-Hochberg FDR q-values within each analysis; no result is called "supported";
  4. nothing is dropped: the index lists every analysis with its result;
  5. a pattern the fixed scenario order or the scenario content could explain says so.

This folder is OUTSIDE analysis/, so the freeze guard of the registered runs (analysis/run_on_real.py) is untouched. The
frozen modules are imported and never changed. It reads a CODED file only (build_tables.load_records refuses a Prolific ID).

Run:
  analysis\\.venv\\Scripts\\python.exe exploratory\\explore.py <participants_ai_safe.json> <output folder> [--simulated]
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "analysis"))
import build_tables as bt          # noqa: E402  (frozen, read-only)
import registered_tests as rt      # noqa: E402
import stats_tools as st           # noqa: E402
import report as rp                # noqa: E402

import matplotlib                  # noqa: E402
matplotlib.use("Agg")
import matplotlib.pyplot as plt    # noqa: E402
import figures as fg               # noqa: E402  (the frozen figures' style and condition colors)

CONDITIONS = ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"]
POLICY = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity", "gainResponsivenessSensitivity",
          "outcomeAggregationSensitivity"]
# One color per value (validated with the dataviz validator in this order, light mode: every check passes, worst
# colour-blind distance 17.6); each line or bar is also labelled with the value's name.
VALUE_COLOR = dict(zip(POLICY, ["#e34948", "#6250d6", "#008300", "#e87ba4"]))
METRICS = ["speed", "resourceUse", "reliability", "durability", "reversibility"]
METRIC_NAME = {"speed": "Speed", "resourceUse": "Resources spared", "reliability": "Reliability", "durability": "Durability",
               "reversibility": "Reversibility"}
B = st.B


# ------------------------------------------------------------------------------------------------- small tools
def fdr(ps):
    from statsmodels.stats.multitest import multipletests
    ps = [p for p in ps]
    ok = [i for i, p in enumerate(ps) if p is not None and np.isfinite(p)]
    q = [float("nan")] * len(ps)
    if ok:
        adj = multipletests([ps[i] for i in ok], method="fdr_bh")[1]
        for i, v in zip(ok, adj):
            q[i] = float(v)
    return q


def boot_mean(v, name):
    v = np.asarray(v, float)
    v = v[~np.isnan(v)]
    if len(v) < 2:
        return float(np.mean(v)) if len(v) else float("nan"), [float("nan"), float("nan")]
    g = st.rng_for("exploratory:" + name)
    return float(v.mean()), st.percentile_ci(v[g.integers(0, len(v), (B, len(v)))].mean(1))


def cp(k, n):
    if n == 0:
        return [float("nan"), float("nan")]
    ci = stats.binomtest(int(k), int(n)).proportion_ci(confidence_level=0.95, method="exact")
    return [float(ci.low), float(ci.high)]


def kruskal(groups):
    groups = [np.asarray(g, float)[~np.isnan(np.asarray(g, float))] for g in groups]
    groups = [g for g in groups if len(g)]
    if len(groups) < 2 or all(len(set(g)) <= 1 for g in groups) and len({x for g in groups for x in g}) <= 1:
        return float("nan"), float("nan")
    res = stats.kruskal(*groups)
    n = sum(len(g) for g in groups)
    eps2 = float(res.statistic * (n + 1) / (n ** 2 - 1))   # epsilon-squared
    return float(res.pvalue), eps2


def save(fig, out, name, simulated, title, note, captions):
    fg._save(fig, out, name, simulated, "Exploratory: " + title, "Exploratory. " + note)
    captions.append(fg.CAPTIONS[-1])


def get(d, dotted, default=None):
    return bt.get(d, dotted, default)


# ------------------------------------------------------------------------------------------------- the analyses
def a1x(T, out, sim, caps):
    """The CVR x APA interaction on VCI, and the same 2 x 2 analysis of overall performance (as description)."""
    import statsmodels.api as sm
    P = T["P"].dropna(subset=["vci", "performance"])
    cells, terms = [], []
    for y in ("vci", "performance"):
        for c in CONDITIONS:
            m, ci = boot_mean(P.loc[P["condition"] == c, y], f"A1x:{y}:{c}")
            cells.append({"outcome": y, "condition": c, "n": int((P["condition"] == c).sum()), "mean": m, "ci95": ci})
        X = pd.DataFrame({"CVR": np.where(P["cvr"], 0.5, -0.5), "APA": np.where(P["apa"], 0.5, -0.5)})
        X["CVR x APA"] = X["CVR"] * X["APA"]
        f = sm.OLS(P[y].to_numpy(float), sm.add_constant(X.to_numpy(float))).fit(cov_type="HC3")
        for i, name in enumerate(["CVR", "APA", "CVR x APA"]):
            b, se = float(f.params[i + 1]), float(f.bse[i + 1])
            terms.append({"outcome": y, "term": name, "estimate": b, "ci95": [b - 1.959964 * se, b + 1.959964 * se],
                          "p": float(f.pvalues[i + 1])})
    for t, q in zip(terms, fdr([t["p"] for t in terms])):
        t["q"] = q
    fig, axes = plt.subplots(1, 2, figsize=(fg.WIDTH, 3.0))
    for ax, y, lab in zip(axes, ("vci", "performance"), ("Value Consistency Index", "Overall performance captured")):
        for cvr, color, name in ((False, fg.INK2, "CVR absent"), (True, fg.ACCENT, "CVR present")):
            xs, ms, los, his = [], [], [], []
            for apa in (False, True):
                cond = {(False, False): "Baseline", (False, True): "APA_Only", (True, False): "CVR_Only", (True, True): "CVR+APA"}[(cvr, apa)]
                cell = next(c for c in cells if c["outcome"] == y and c["condition"] == cond)
                xs.append(int(apa)); ms.append(cell["mean"]); los.append(cell["mean"] - cell["ci95"][0]); his.append(cell["ci95"][1] - cell["mean"])
            ax.errorbar(np.array(xs) + (0.04 if cvr else -0.04), ms, yerr=[los, his], color=color, marker="o", ms=4.5, lw=1.5,
                        capsize=2.5, label=name)
        ax.set_xticks([0, 1], ["APA absent", "APA present"])
        ax.set_xlim(-0.3, 1.3)
        ax.set_ylabel(lab)
    axes[0].legend(loc="best", fontsize=8)
    save(fig, out, "xfig_A1x_cvr_by_apa", sim, "Value Consistency and Performance in the 2 x 2 of the Two Help Steps",
         "Means with 95% bootstrap confidence intervals. CVR = the reflection step; APA = the clarification step. Baseline is "
         "the cell with neither, and Baseline has no fit score and no \"Ranked N - why\" section on its option cards.", caps)
    return {"id": "A1x", "cells": cells, "terms": terms}


def stability_kind(r):
    if r["stability_measured"] is False or (isinstance(r["stability_measured"], float) and math.isnan(r["stability_measured"])):
        return "not tested"
    if r["stability_order"] < 100:
        return "reordered"
    if r["stability_difference"] < 100:
        return "moved without reordering"
    return "held"


KINDS = ["not tested", "held", "moved without reordering", "reordered"]


def a2x(T, out, sim, caps):
    """Condition differences in Stability, by its two parts and by kind, as description only (no test)."""
    P = T["P"].copy()
    P["kind"] = P.apply(stability_kind, axis=1)
    rows = []
    for c in CONDITIONS:
        s = P[P["condition"] == c]
        meas = s[s["kind"] != "not tested"]
        rows.append({"condition": c, "n": int(len(s)),
                     **{k: int((s["kind"] == k).sum()) for k in KINDS},
                     "median_stability_measured": float(meas["stability"].median()) if len(meas) else float("nan"),
                     "median_order_part_measured": float(meas["stability_order"].median()) if len(meas) else float("nan"),
                     "median_difference_part_measured": float(meas["stability_difference"].median()) if len(meas) else float("nan")})
    fig, ax = plt.subplots(figsize=(fg.WIDTH, 2.6))
    shades = ["#cfcfcf", "#9ec5f4", "#3987e5", "#184f95"]
    for i, r in enumerate(rows):
        left = 0
        for k, col in zip(KINDS, shades):
            w = r[k] / r["n"] * 100 if r["n"] else 0
            ax.barh(i, w, left=left, color=col, edgecolor="white", linewidth=1.5, height=0.62)
            if w >= 7:
                ax.text(left + w / 2, i, f"{r[k]}", ha="center", va="center", fontsize=8,
                        color="white" if col in ("#3987e5", "#184f95") else fg.INK)
            left += w
    ax.set_yticks(range(len(rows)), [fg.LABEL[r["condition"]] for r in rows])
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("Participants (%)")
    ax.grid(True, axis="x")
    ax.grid(False, axis="y")
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in shades]
    ax.legend(handles, KINDS, loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=4)
    save(fig, out, "xfig_A2x_stability_kinds", sim, "Kinds of Stability by Condition",
         "Not tested = no counted step; held = both parts 100; moved without reordering = order part 100, difference part "
         "below 100; reordered = order part below 100. Description only: each condition moves the values by its own rules, so "
         "Stability is not compared between conditions as a test.", caps)
    return {"id": "A2x", "rows": rows, "note": "description only, as registered"}


def a3x(T, docs, out, sim, caps):
    """VCI_all and Stability_all; the profile after every scenario."""
    P = T["P"]
    by = {str(d.get("prolific_pid")): d for d in docs}
    rows, diffs = [], {"vci_all_minus_vci": [], "stability_all_minus_stability": []}
    extra = []
    for _, r in P.iterrows():
        d = by.get(r["pid"])
        va, sa = get(d, "headline.consistency_score_all_six"), get(d, "headline.stability_all_score")
        extra.append({"pid": r["pid"], "condition": r["condition"], "vci_all": va, "stability_all": sa,
                      "d_vci": (va - r["vci_saved"]) if va is not None else np.nan,
                      "d_stab": (sa - r["stability"]) if sa is not None else np.nan})
    E = pd.DataFrame(extra)
    for c in CONDITIONS:
        s = E[E["condition"] == c]
        m1, c1 = boot_mean(s["vci_all"], f"A3x:vciall:{c}")
        m2, c2 = boot_mean(s["stability_all"], f"A3x:staball:{c}")
        rows.append({"condition": c, "n": int(len(s)), "vci_all_mean": m1, "vci_all_ci95": c1, "stability_all_mean": m2,
                     "stability_all_ci95": c2})
    md, cd = boot_mean(E["d_vci"], "A3x:dvci")
    ms, cs = boot_mean(E["d_stab"], "A3x:dstab")
    # the profile path: before Block 5, then after each scenario (the running values, as the study tracks them)
    path = {k: [] for k in POLICY}
    names = {}
    for d in docs:
        if d.get("status") != "Study Completed" or str(d.get("prolific_pid")) not in set(P["pid"]):
            continue
        vp = get(d, "analysis.value_profile_by_scenario") or {}
        names = vp.get("value_names", names)
        seq = [vp.get("before_block5") or {}] + [row.get("values_after") or {} for row in vp.get("by_scenario") or []]
        if len(seq) == 7:
            for k in POLICY:
                path[k].append([s.get(k, np.nan) for s in seq])
    fig, ax = plt.subplots(figsize=(fg.WIDTH, 3.3))
    means = {}
    for k in POLICY:
        a = np.asarray(path[k], float)
        if not len(a):
            continue
        m = np.nanmean(a, axis=0)
        means[k] = [float(x) for x in m]
        ax.plot(range(7), m, color=VALUE_COLOR[k], lw=1.8, marker="o", ms=3.5)
        ax.text(6.12, m[-1], names.get(k, k), color=VALUE_COLOR[k], fontsize=8, va="center")
    ax.set_xticks(range(7), ["Before", "1", "2", "3", "4", "5\n(wish)", "6\n(veil)"])
    ax.set_xlim(-0.2, 7.6)
    ax.set_ylabel("Mean value score (0-100)")
    ax.set_xlabel("After scenario")
    save(fig, out, "xfig_A3x_profile_path", sim, "The Four Values From Before the Scenarios to After Scenario 6",
         "Means over participants. Scenarios 1-4 move the study's values; after Scenarios 5 and 6 the running values move as the "
         "study tracks them for VCI_all. The scenarios came in one fixed order.", caps)
    return {"id": "A3x", "by_condition": rows, "vci_all_minus_vci": {"mean": md, "ci95": cd},
            "stability_all_minus_stability": {"mean": ms, "ci95": cs}, "mean_path": means, "value_names": names}


def a4x(T, docs, out, sim, caps):
    """Which value rises in the wish (scenario 5), value by value and in performance; the company stance in scenario 4."""
    P = T["P"]
    keep = set(P["pid"])
    rows = []
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid not in keep:
            continue
        dvw = get(d, "analysis.position_effect.decided_versus_wished") or {}
        rows.append({"pid": pid, "condition": d.get("condition_type"), "same": dvw.get("wished_for_the_same_option"),
                     **{f"v:{k}": (dvw.get("wish_minus_decision_by_value") or {}).get(k) for k in POLICY},
                     **{f"m:{k}": (dvw.get("wish_minus_decision_by_performance_metric") or {}).get(k) for k in METRICS},
                     "stance": get(d, "analysis.position_effect.company_stance.stance_label")})
    W = pd.DataFrame(rows)
    names = {}
    for d in docs:
        names = (get(d, "analysis.value_profile_by_scenario.value_names") or names)
        if names:
            break
    diff = W[W["same"] == False]   # noqa: E712
    tests = []
    for kind, keys in (("value", POLICY), ("metric", METRICS)):
        for k in keys:
            col = f"{'v' if kind == 'value' else 'm'}:{k}"
            v = diff[col].astype(float).to_numpy()
            m, ci = boot_mean(v, f"A4x:{col}")
            r = st.signed_rank(v, "unused", "two-sided", boot=False) if len(v) > 2 else {"p": float("nan")}
            tests.append({"kind": kind, "what": names.get(k, METRIC_NAME.get(k, k)), "key": k, "n": int(len(v)),
                          "mean_change": m, "ci95": ci, "p": r.get("p")})
    stance_by_condition = pd.crosstab(W["condition"], W["stance"]).reindex(CONDITIONS).fillna(0).astype(int)
    chi = stats.chi2_contingency(stance_by_condition.to_numpy()) if stance_by_condition.to_numpy().sum() else None
    vci = P.set_index("pid")["vci"]
    groups = [vci.reindex(W.loc[W["stance"] == s, "pid"]).to_numpy() for s in sorted(W["stance"].dropna().unique())]
    p_kw, eps2 = kruskal(groups)
    tests.append({"kind": "stance by condition", "what": "chi-square", "p": float(chi.pvalue) if chi else float("nan"),
                  "statistic": float(chi.statistic) if chi else float("nan"), "df": int(chi.dof) if chi else None})
    tests.append({"kind": "VCI by stance", "what": "Kruskal-Wallis", "p": p_kw, "epsilon_squared": eps2})
    for t, q in zip(tests, fdr([t["p"] for t in tests])):
        t["q"] = q
    fig, axes = plt.subplots(1, 2, figsize=(fg.WIDTH, 2.9), gridspec_kw={"width_ratios": [1, 1], "wspace": 0.9})
    for ax, kind, xlabel in ((axes[0], "value", "Value score: wish minus decision"),
                             (axes[1], "metric", "Performance: wish minus decision")):
        rows_k = [t for t in tests if t["kind"] == kind]
        for i, t in enumerate(rows_k):
            color = VALUE_COLOR[t["key"]] if kind == "value" else fg.ACCENT
            ax.barh(i, t["mean_change"], color=color, height=0.6, zorder=2)
            ax.errorbar(t["mean_change"], i, xerr=[[t["mean_change"] - t["ci95"][0]], [t["ci95"][1] - t["mean_change"]]],
                        fmt="none", ecolor=fg.INK, lw=1, capsize=2.5, zorder=3)
        ax.axvline(0, color=fg.INK2, lw=0.8)
        ax.set_yticks(range(len(rows_k)), [t["what"][0].upper() + t["what"][1:] for t in rows_k], fontsize=8)
        ax.invert_yaxis()
        ax.grid(True, axis="x")
        ax.grid(False, axis="y")
        ax.set_xlabel(xlabel + " (points)")
    save(fig, out, "xfig_A4x_wish_value_and_performance", sim, "What the Wish Changed, Value by Value and in Performance",
         f"Among the {len(diff)} participants whose wish in Scenario 5 differed from their decision in Scenario 4: mean change "
         "(wish minus decision) of the option's four value scores (left) and five performance scores (right), with 95% "
         "bootstrap confidence intervals.", caps)
    fig, ax = plt.subplots(figsize=(fg.WIDTH, 2.6))
    stances = list(stance_by_condition.columns)
    shades = ["#3987e5", "#cfcfcf", "#eb6834"][:len(stances)]
    for i, c in enumerate(CONDITIONS):
        left = 0
        tot = stance_by_condition.loc[c].sum()
        for s, col in zip(stances, shades):
            w = stance_by_condition.loc[c, s] / tot * 100 if tot else 0
            ax.barh(i, w, left=left, color=col, edgecolor="white", linewidth=1.5, height=0.62)
            if w >= 7:
                ax.text(left + w / 2, i, str(stance_by_condition.loc[c, s]), ha="center", va="center", fontsize=8,
                        color="white" if col != "#cfcfcf" else fg.INK)
            left += w
    ax.set_yticks(range(4), [fg.LABEL[c] for c in CONDITIONS])
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("Participants (%)")
    ax.grid(True, axis="x")
    ax.grid(False, axis="y")
    ax.legend([plt.Rectangle((0, 0), 1, 1, color=c) for c in shades], stances, loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=3)
    save(fig, out, "xfig_A4x_company_stance", sim, "Where the Decision in Scenario 4 Stood Between the Company's Values and One's Own",
         "The stance the study records for the decision under the employer's rules: closer to the company's stated value, in "
         "between, or closer to the participant's own values.", caps)
    return {"id": "A4x", "wished_for_the_same_option": int((W["same"] == True).sum()), "n": int(len(W)),   # noqa: E712
            "tests": tests, "stance_by_condition": stance_by_condition.to_dict(orient="index"),
            "stance_counts": W["stance"].value_counts().to_dict()}


def a5x(T, out, sim, caps):
    """Departure across all five positions."""
    S = T["S"]
    res = {"id": "A5x"}
    for col in ("departure", "departure_menu_adjusted"):
        w = S[S["order"] <= 5].pivot_table(index="pid", columns="order", values=col, aggfunc="first").dropna()
        fr = stats.friedmanchisquare(*[w[o] for o in range(1, 6)])
        n, k = len(w), 5
        kendall_w = float(fr.statistic / (n * (k - 1)))
        pairs = []
        for a in range(1, 6):
            for b in range(a + 1, 6):
                r = st.signed_rank((w[b] - w[a]).to_numpy(), "unused", "two-sided", boot=False)
                pairs.append({"from": a, "to": b, "mean_difference": float((w[b] - w[a]).mean()), "p": r["p"],
                              "rank_biserial_r": r.get("rank_biserial_r")})
        for pr, q in zip(pairs, fdr([p["p"] for p in pairs])):
            pr["q"] = q
        means = {o: boot_mean(w[o], f"A5x:{col}:{o}") for o in range(1, 6)}
        res[col] = {"n": n, "friedman_chi2": float(fr.statistic), "friedman_p": float(fr.pvalue), "kendalls_w": kendall_w,
                    "means": {o: {"mean": m, "ci95": ci} for o, (m, ci) in means.items()}, "pairs": pairs}
    # the pairs heat map (catalog S5), on the departure share
    pairs = res["departure"]["pairs"]
    M = np.full((5, 5), np.nan)
    for p in pairs:
        M[p["to"] - 1, p["from"] - 1] = p["mean_difference"]
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.62, 3.4))
    ax.grid(False)
    lim = max(5.0, np.nanmax(np.abs(M)))
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list("div", ["#2a78d6", "#f2f2f2", "#eb6834"])
    im = ax.imshow(M, cmap=cmap, vmin=-lim, vmax=lim)
    for p in pairs:
        mark = "*" if p["q"] < 0.05 else ""
        ax.text(p["from"] - 1, p["to"] - 1, f"{p['mean_difference']:+.1f}{mark}", ha="center", va="center", fontsize=8, color=fg.INK)
    labels = ["1 Alone", "2 Household", "3 Others", "4 Employer", "5 Receiving"]
    ax.set_xticks(range(5), labels, rotation=30, ha="right")
    ax.set_yticks(range(5), labels)
    ax.set_xlabel("From scenario")
    ax.set_ylabel("To scenario")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="Departure difference (points)")
    save(fig, out, "xfig_A5x_position_pairs", sim, "Differences in Departure Between Every Pair of Positions",
         "Each cell: the mean departure share in the row's scenario minus that in the column's scenario. * = FDR q below .05 "
         "(Wilcoxon signed-rank). The scenarios came in one fixed order and each position has its own story, so a difference "
         "may come from order or content as well as position.", caps)
    return res


def a6x(T, docs, out, sim, caps):
    """Reading of the comparison view (MCF) and whether it relates to the choice; the time per decision and the number of
    option changes."""
    import statsmodels.api as sm
    S = T["S"]
    keep = set(T["P"]["pid"])
    mrows = []
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid not in keep:
            continue
        for r in get(d, "analysis.mcf.by_scenario") or []:
            if r.get("could_be_opened_in_this_scenario"):
                mrows.append({"pid": pid, "condition": d.get("condition_type"), "scenario_id": r.get("scenario_id"),
                              "read": bool(r.get("was_read")), "read_chosen": bool(r.get("read_the_option_they_chose")),
                              "seconds": r.get("seconds_reading") or 0})
    M = pd.DataFrame(mrows)
    per = M.groupby(["pid", "condition"])["read"].any().reset_index()
    readers = {c: {"n": int((per["condition"] == c).sum()), "read_at_least_once": int(per.loc[per["condition"] == c, "read"].sum())}
               for c in CONDITIONS}
    for c in readers:
        readers[c]["ci95"] = cp(readers[c]["read_at_least_once"], readers[c]["n"])
    dec = S[S["decision"]].merge(M[["pid", "scenario_id", "read"]], on=["pid", "scenario_id"], how="left")
    dec["read"] = dec["read"].fillna(False).astype(int)
    tests = []
    if dec["read"].nunique() > 1:
        codes = pd.factorize(dec["pid"])[0]
        X = sm.add_constant(dec[["read"]].astype(float))
        f = sm.Logit(dec["final_good_fit"].astype(float), X).fit(disp=0, cov_type="cluster", cov_kwds={"groups": codes})
        b, se = float(f.params["read"]), float(f.bse["read"])
        tests.append({"what": "final choice fits (Aligned or Weakly aligned) ~ comparison view read, decisions 1-4",
                      "odds_ratio": math.exp(b), "ci95": [math.exp(b - 1.959964 * se), math.exp(b + 1.959964 * se)],
                      "p": float(f.pvalues["read"]),
                      "share_good_fit_read": float(dec.loc[dec["read"] == 1, "final_good_fit"].mean()),
                      "share_good_fit_not_read": float(dec.loc[dec["read"] == 0, "final_good_fit"].mean())})
    secs = S.assign(seconds=S["time_ms"] / 1000)
    per_p = secs.groupby(["pid", "condition"]).agg(seconds=("seconds", "median")).reset_index()
    p1, e1 = kruskal([per_p.loc[per_p["condition"] == c, "seconds"] for c in CONDITIONS])
    tests.append({"what": "median seconds per scenario, by condition (Kruskal-Wallis)", "p": p1, "epsilon_squared": e1})
    wide = secs[secs["order"] <= 6].pivot_table(index="pid", columns="order", values="seconds", aggfunc="first").dropna()
    fr = stats.friedmanchisquare(*[wide[o] for o in wide.columns])
    tests.append({"what": "seconds per scenario across the six scenarios (Friedman)", "p": float(fr.pvalue),
                  "kendalls_w": float(fr.statistic / (len(wide) * (len(wide.columns) - 1)))})
    changes = []
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid in keep:
            for r in get(d, "blocks.block5_emergency_scenarios.scenarioResults") or []:
                changes.append({"pid": pid, "condition": d.get("condition_type"), "switches": (r.get("telemetry") or {}).get("numberOfSwitches")})
    Cg = pd.DataFrame(changes).groupby(["pid", "condition"])["switches"].sum().reset_index()
    p2, e2 = kruskal([Cg.loc[Cg["condition"] == c, "switches"] for c in CONDITIONS])
    tests.append({"what": "option changes over the six scenarios, by condition (Kruskal-Wallis)", "p": p2, "epsilon_squared": e2})
    for t, q in zip(tests, fdr([t["p"] for t in tests])):
        t["q"] = q
    time_table = {c: {"median_seconds_per_scenario": float(per_p.loc[per_p["condition"] == c, "seconds"].median()),
                      "median_option_changes_total": float(Cg.loc[Cg["condition"] == c, "switches"].median())} for c in CONDITIONS}
    by_scen = {int(o): float(secs.loc[secs["order"] == o, "seconds"].median()) for o in range(1, 7)}
    fig, ax = plt.subplots(figsize=(fg.WIDTH, 3.1))
    for o in range(1, 7):
        v = secs.loc[secs["order"] == o, "seconds"].dropna().to_numpy()
        ax.scatter(o + fg._jitter(len(v), o, 0.18), v, s=8, color=fg.ACCENT, alpha=0.4, linewidths=0)
        q1, med, q3 = np.percentile(v, [25, 50, 75])
        ax.plot([o - 0.25, o + 0.25], [med, med], color=fg.INK, lw=2)
        ax.plot([o, o], [q1, q3], color=fg.INK, lw=1)
        ax.text(o + 0.28, med, f"{med:.0f}", va="center", fontsize=8, color=fg.INK)
    ax.set_yscale("log")
    ax.set_xticks(range(1, 7), [fg.SCENARIO_LABEL[o] for o in range(1, 7)])
    ax.set_ylabel("Seconds in the scenario (log scale)")
    save(fig, out, "xfig_A6x_time_per_scenario", sim, "Time Spent in Each Scenario",
         "Dots are participants; black lines are medians with the middle half. Time runs from the scenario's opening, including "
         "its introduction page. The scenarios came in one fixed order.", caps)
    return {"id": "A6x", "readers_by_condition": readers, "tests": tests, "time_and_changes_by_condition": time_table,
            "median_seconds_by_scenario": by_scen}


def a7x(T, docs, out, sim, caps):
    """The other known effects in the first four blocks; whether reconsidering is a trait."""
    import statsmodels.api as sm
    P, S = T["P"], T["S"]
    keep = set(P["pid"])
    tests = []
    w = P.dropna(subset=["money_sidewalk", "money_wealthy", "money_shelter"])
    fr = stats.friedmanchisquare(w["money_sidewalk"], w["money_wealthy"], w["money_shelter"])
    tests.append({"what": "Block 1: the rung differs across the three places (Friedman)", "p": float(fr.pvalue),
                  "kendalls_w": float(fr.statistic / (len(w) * 2)),
                  "median_rungs": {k: float(w[f"money_{k}"].median()) for k in ("sidewalk", "wealthy", "shelter")}})
    r = st.signed_rank((w["money_sidewalk"] - w["money_wealthy"]).to_numpy(), "unused", "two-sided", boot=False)
    tests.append({"what": "Block 1: sidewalk against wealthy district building (Wilcoxon)", "p": r["p"], "mean_difference": r.get("mean_difference")})
    acts = {}
    for d in docs:
        if str(d.get("prolific_pid")) in keep:
            for h in get(d, "blocks.block1_money.history") or []:
                if h.get("action") != "keep":
                    acts.setdefault(h.get("contextKey"), {}).setdefault(h.get("action"), 0)
                    acts[h["contextKey"]][h["action"]] += 1
    never_l = (P["trolley_lever"] == 8).astype(int)
    never_b = (P["trolley_bridge"] == 8).astype(int)
    b01, b10 = int(((never_l == 0) & (never_b == 1)).sum()), int(((never_l == 1) & (never_b == 0)).sum())
    mc = stats.binomtest(b01, b01 + b10, 0.5).pvalue if b01 + b10 else float("nan")
    tests.append({"what": "Block 2: never acting, push against pull (exact McNemar)", "p": float(mc),
                  "never_pull_only": b10, "never_push_only": b01, "never_both": int(((never_l == 1) & (never_b == 1)).sum())})
    sizes = []
    for d in docs:
        if str(d.get("prolific_pid")) in keep:
            th = get(d, "blocks.block3_ai_workforce.thresholds") or {}
            rung = lambda t: (t.get("thresholdGainIndex") if t.get("accepted") else 6)   # noqa: E731
            g = {(v.get("groupTypeKey"), v.get("groupSizeKey")): rung(v) for v in th.values() if isinstance(v, dict)}
            if len(g) == 6:
                sizes.append(np.mean([g[(t, "large")] for t in ("low_buffer", "high_buffer")]) -
                             np.mean([g[(t, "small")] for t in ("low_buffer", "high_buffer")]))
    r = st.signed_rank(np.asarray(sizes, float), "unused", "greater", boot=False)
    tests.append({"what": "Block 3: a higher gain asked before harming a larger group (large minus small, Wilcoxon)",
                  "p": r["p"], "mean_difference": r.get("mean_difference"), "share_pricing_larger_lower": float(np.mean(np.asarray(sizes) < 0))})
    b4 = []
    for d in docs:
        if str(d.get("prolific_pid")) in keep:
            dd = get(d, "blocks.block4_stakeholder_reflection.decisions") or {}
            b4.append({"pid": str(d.get("prolific_pid")), "changed": dd.get("finalDecision") != dd.get("initialDecision"),
                       "wobbled": dd.get("midDecision") != dd.get("initialDecision") and dd.get("finalDecision") == dd.get("initialDecision"),
                       "conf_before": dd.get("initialConfidence"), "conf_after": dd.get("confidence"),
                       "first": dd.get("initialDecision"), "final": dd.get("finalDecision")})
    B4 = pd.DataFrame(b4)
    r = st.signed_rank((B4["conf_after"] - B4["conf_before"]).astype(float).to_numpy(), "unused", "two-sided", boot=False)
    tests.append({"what": "Block 4: confidence after the stories against before (Wilcoxon)", "p": r["p"],
                  "mean_difference": r.get("mean_difference")})
    # reconsidering as a trait: Block 4 changers against choices changed after the condition's page in the scenarios
    el = S[S["decision"] & S["first_misfit"] & S["page_opened"]].merge(B4[["pid", "changed"]].rename(columns={"changed": "b4"}), on="pid")
    per = el.groupby("pid").agg(changes=("changed", "sum"), b4=("b4", "first")).reset_index()
    mw = st.mann_whitney(per.loc[per["b4"], "changes"], per.loc[~per["b4"], "changes"], "unused", "two-sided", boot=False)
    tests.append({"what": "Reconsidering: choices changed after the condition's page, Block 4 changers against the rest (Mann-Whitney)",
                  "p": mw.get("p"), "rank_biserial_r": mw.get("rank_biserial_r"),
                  "mean_changes_block4_changers": float(per.loc[per["b4"], "changes"].mean()) if per["b4"].any() else float("nan"),
                  "mean_changes_others": float(per.loc[~per["b4"], "changes"].mean())})
    if el["b4"].nunique() > 1 and el["changed"].nunique() > 1:
        codes = pd.factorize(el["pid"])[0]
        f = sm.Logit(el["changed"].astype(float), sm.add_constant(el[["b4"]].astype(float))).fit(disp=0, cov_type="cluster",
                                                                                                  cov_kwds={"groups": codes})
        b, se = float(f.params["b4"]), float(f.bse["b4"])
        tests.append({"what": "Reconsidering, decision level: changed ~ Block 4 changer (logistic, clustered by participant)",
                      "p": float(f.pvalues["b4"]), "odds_ratio": math.exp(b),
                      "ci95": [math.exp(b - 1.959964 * se), math.exp(b + 1.959964 * se)]})
    for t, q in zip(tests, fdr([t["p"] for t in tests])):
        t["q"] = q
    path = B4.groupby(["first", "final"]).size().to_dict()
    return {"id": "A7x", "tests": tests, "block1_instead_of_keeping": acts,
            "block4": {"changed": int(B4["changed"].sum()), "wobbled": int(B4["wobbled"].sum()), "n": int(len(B4)),
                       "first_to_final": {f"{a} -> {b}": int(v) for (a, b), v in path.items()}}}


def a8x(T, docs, out, sim, caps):
    """The feedback questions on the reflection and clarification steps, the learning-insight subscale, and the optional
    written answers (themes are added by hand in a separate file, themes.json, after reading the answers)."""
    keep = set(T["P"]["pid"])
    items = {}
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid not in keep:
            continue
        fb = get(d, "blocks.feedback_answers.feedback") or {}
        for section in ("cvr", "apa"):
            for code, v in (fb.get(section) or {}).items():
                if code.endswith("_open"):
                    continue          # a written answer: read and themed below, never counted as a rating
                a = v.get("answer") if isinstance(v, dict) else v
                q = v.get("question") if isinstance(v, dict) else code
                items.setdefault((section, code, q), []).append((d.get("condition_type"), a))
    table = []
    for (section, code, q), answers in sorted(items.items()):
        nums = [a for _, a in answers if isinstance(a, (int, float)) and not isinstance(a, bool)]
        yes = [a for _, a in answers if a in ("yes", "no")]
        row = {"section": section, "code": code, "question": q, "n": len(answers)}
        if nums:
            m, ci = boot_mean(nums, f"A8x:{code}")
            row.update({"mean": m, "ci95": ci, "median": float(np.median(nums)), "agree_5_to_7": float(np.mean(np.asarray(nums) >= 5)),
                        "disagree_1_to_3": float(np.mean(np.asarray(nums) <= 3)),
                        "by_condition_mean": {c: float(np.mean([a for cc, a in answers if cc == c])) for c in CONDITIONS
                                              if any(cc == c for cc, _ in answers)}})
        elif yes:
            k = sum(a == "yes" for a in yes)
            row.update({"yes": k, "of": len(yes), "share_yes": k / len(yes), "ci95": cp(k, len(yes))})
        table.append(row)
    P = T["P"]
    li = {}
    for d in docs:
        if str(d.get("prolific_pid")) in keep:
            li[str(d.get("prolific_pid"))] = get(d, "blocks.feedback_answers.feedback.wellbeing.subscales.learningInsight")
    P = P.assign(li=P["pid"].map(li))
    p_li, e_li = kruskal([P.loc[P["condition"] == c, "li"] for c in CONDITIONS])
    li_rows = {c: dict(zip(("mean", "ci95"), boot_mean(P.loc[P["condition"] == c, "li"], f"A8x:li:{c}"))) for c in CONDITIONS}
    tests = [{"what": "learning insight by condition (Kruskal-Wallis)", "p": p_li, "epsilon_squared": e_li}]
    for t, q in zip(tests, fdr([t["p"] for t in tests])):
        t["q"] = q
    likert = [r for r in table if "mean" in r]
    if likert:
        fig, ax = plt.subplots(figsize=(fg.WIDTH, 0.42 * len(likert) + 1.0))
        for i, r in enumerate(likert):
            dis, agr = r["disagree_1_to_3"] * 100, r["agree_5_to_7"] * 100
            neu = 100 - dis - agr
            ax.barh(i, -dis - neu / 2, color="#eb6834", height=0.6, edgecolor="white")
            ax.barh(i, neu, left=-neu / 2, color="#cfcfcf", height=0.6, edgecolor="white")
            ax.barh(i, agr, left=neu / 2, color="#2a78d6", height=0.6, edgecolor="white")
            ax.text(neu / 2 + agr + 1.5, i, f"{agr:.0f}% rated 5-7 (n = {r['n']})", va="center", fontsize=7.5, color=fg.INK)
        short = {"CVR_helped": "Reflection helped me think carefully", "CVR_reconsider": "Reflection made me reconsider",
                 "CVR_useful": "Reflection was useful", "CVR_confidence": "Confidence after reflection (higher)",
                 "CVR_dual_helpful": "Comparing two views helped", "APA_clarify": "Clarification: what I value",
                 "APA_tradeoff": "Clarification: saw the trade-off", "APA_prioritization": "Prioritizing a value was useful",
                 "APA_better": "Clarification: a better decision"}
        ax.set_yticks(range(len(likert)), [short.get(r["code"], r["code"]) for r in likert], fontsize=8)
        ax.axvline(0, color=fg.INK2, lw=0.8)
        left = max(r["disagree_1_to_3"] * 100 + (100 - r["disagree_1_to_3"] * 100 - r["agree_5_to_7"] * 100) / 2 for r in likert)
        ax.set_xlim(-max(20.0, left + 5), 135)
        ax.set_xlabel("Participants (%): 1-3 left of the line, 4 centred, 5-7 right")
        ax.invert_yaxis()
        ax.grid(True, axis="x")
        ax.grid(False, axis="y")
        save(fig, out / "figures", "xfig_A8x_help_step_feedback", sim, "How Participants Rated the Reflection and Clarification Steps",
             "Only participants who met a step were asked about it. Orange: 1-3; grey: 4; blue: 5-7 on the 1-7 scale.", caps)
    written = []
    for d in docs:
        if str(d.get("prolific_pid")) in keep:
            oe = get(d, "blocks.feedback_answers.feedback.wellbeing.openEnded") or {}
            for code, text in oe.items():
                if isinstance(text, str) and text.strip():
                    written.append({"pid": str(d.get("prolific_pid")), "condition": d.get("condition_type"), "question": code, "text": text.strip()})
    # The written answers on the help steps and the tools (saved with their question text), AFTER the well-being ones, so
    # the numbering of the answers already coded never changes.
    for d in docs:
        if str(d.get("prolific_pid")) in keep:
            fb = get(d, "blocks.feedback_answers.feedback") or {}
            for section in ("cvr", "apa", "decisionSupport"):
                for code, v in (fb.get(section) or {}).items():
                    text = v.get("answer") if isinstance(v, dict) else v
                    if code.endswith("_open") and isinstance(text, str) and text.strip():
                        written.append({"pid": str(d.get("prolific_pid")), "condition": d.get("condition_type"), "question": code,
                                        "text": text.strip()})
    themes_file = out / "themes.json"
    themes = json.loads(themes_file.read_text(encoding="utf8")) if themes_file.exists() else None
    return {"id": "A8x", "questions": table, "learning_insight_by_condition": li_rows, "tests": tests,
            "written_answers": {"people": len({w["pid"] for w in written}), "answers": len(written),
                                "by_question": pd.Series([w["question"] for w in written]).value_counts().to_dict() if written else {}},
            "themes": themes, "_written_for_reading": written}


def a9x(T, out, sim, caps):
    """A1-A3 among participants whose first pick was a misfit at least once (defined after randomization: read with caution)."""
    S, P = T["S"], T["P"]
    sub = set(S[S["decision"] & S["first_misfit"]]["pid"])
    Ps = P[P["pid"].isin(sub)]
    res = []
    for hid, other in (("A1", "Baseline"), ("A2", "APA_Only"), ("A3", "CVR_Only")):
        r = st.mann_whitney(Ps.loc[Ps["condition"] == "CVR+APA", "vci"], Ps.loc[Ps["condition"] == other, "vci"],
                            f"A9x:{hid}", "greater", boot=True)
        res.append({"as": hid, "against": other, **{k: r.get(k) for k in ("n", "U", "p", "rank_biserial_r",
                                                                           "ci95_rank_biserial_r", "mean_x", "mean_y")}})
    for r, q in zip(res, fdr([r["p"] for r in res])):
        r["q"] = q
    return {"id": "A9x", "participants_in_subgroup": int(len(Ps)), "per_condition": Ps["condition"].value_counts().to_dict(),
            "tests": res}


# ------------------------------------------------------------------------------------------------- the report
def write_report(R: dict, out: Path, simulated: bool, n: int) -> None:
    f = lambda x, nd=2: rp.num(x, nd)   # noqa: E731
    ci = lambda c, nd=2: rp.ci(c, rp.num, nd).strip()   # noqa: E731
    stamp = "**SIMULATED: not data.** Every number below comes from pretend participants.\n\n" if simulated else ""
    L = [f"# Exploratory results, round 1: the nine analyses the registration lists{' (SIMULATED)' if simulated else ''}", "",
         stamp + f"{n} participants. **Every result here is exploratory** (OSF page 6: \"All of the following are exploratory and "
         "labelled as such\"). Each estimate has its 95% interval; p-values are shown raw and as Benjamini-Hochberg FDR "
         "q-values within each analysis. No exploratory result confirms a hypothesis. Nothing has been left out: the index "
         "lists every analysis.", "", "## Index", ""]
    L += ["| # | Registered words | Section |", "|---|---|---|"]
    words = {"A1x": "The CVR × APA interaction on VCI, and the same 2 × 2 analysis of overall performance",
             "A2x": "Condition differences in Stability, by its two parts and by the kind of stability (description only)",
             "A3x": "VCI_all and Stability_all; the profile after every scenario",
             "A4x": "Which value rises in the wish; the company stance in scenario 4", "A5x": "Departure across all five positions",
             "A6x": "Reading of the comparison view (MCF); time per decision; option changes",
             "A7x": "The other known effects in Blocks 1-4; reconsidering as a trait",
             "A8x": "Feedback on the reflection and clarification steps; learning insight; written answers",
             "A9x": "A1-A3 among participants whose first pick was a misfit at least once"}
    L += [f"| {k} | {v} | below |" for k, v in words.items()]
    a = R["A1x"]
    L += ["", "## A1x. The two help steps as a 2 × 2 (exploratory)", "", "| Outcome | Condition | n | Mean [95% CI] |", "|---|---|---|---|"]
    L += [f"| {c['outcome']} | {c['condition']} | {c['n']} | {f(c['mean'], 1)} {ci(c['ci95'], 1)} |" for c in a["cells"]]
    L += ["", "| Outcome | Term | Estimate [95% CI] | p | q (FDR) |", "|---|---|---|---|---|"]
    L += [f"| {t['outcome']} | {t['term']} | {f(t['estimate'], 1)} {ci(t['ci95'], 1)} | {rp.apa_p(t['p'])} | {rp.apa_p(t['q'])} |" for t in a["terms"]]
    L += ["", "Note. CVR and APA coded −0.5 / +0.5; HC3 errors. **Baseline has no fit score and no \"Ranked N - why\" section, and no "
          "help step**, so the \"neither\" cell differs from the others in both ways."]
    a = R["A2x"]
    L += ["", "## A2x. Kinds of Stability by condition (exploratory, description only)", "",
          "| Condition | n | Not tested | Held | Moved without reordering | Reordered | Median Stability (tested) | Median order part | Median difference part |",
          "|---|---|---|---|---|---|---|---|---|"]
    L += [f"| {r['condition']} | {r['n']} | {r['not tested']} | {r['held']} | {r['moved without reordering']} | {r['reordered']} | "
          f"{f(r['median_stability_measured'], 0)} | {f(r['median_order_part_measured'], 0)} | {f(r['median_difference_part_measured'], 0)} |" for r in a["rows"]]
    L += ["", "Note. No test, as registered: each condition moves the values by its own rules, so Stability is not a fair ruler between conditions."]
    a = R["A3x"]
    L += ["", "## A3x. VCI_all, Stability_all and the profile after every scenario (exploratory)", "",
          "| Condition | n | VCI_all mean [95% CI] | Stability_all mean [95% CI] |", "|---|---|---|---|"]
    L += [f"| {r['condition']} | {r['n']} | {f(r['vci_all_mean'], 1)} {ci(r['vci_all_ci95'], 1)} | {f(r['stability_all_mean'], 1)} {ci(r['stability_all_ci95'], 1)} |"
          for r in a["by_condition"]]
    L += ["", f"VCI_all minus VCI (per participant): mean {f(a['vci_all_minus_vci']['mean'], 1)} {ci(a['vci_all_minus_vci']['ci95'], 1)}; "
          f"Stability_all minus Stability: mean {f(a['stability_all_minus_stability']['mean'], 1)} {ci(a['stability_all_minus_stability']['ci95'], 1)}.",
          "", "Mean value scores (before the scenarios, then after Scenarios 1-6):", ""]
    L += [f"- {a['value_names'].get(k, k)}: " + ", ".join(f(x, 1) for x in v) for k, v in a["mean_path"].items()]
    a = R["A4x"]
    L += ["", "## A4x. The wish and the company stance (exploratory)", "",
          f"{a['wished_for_the_same_option']} of {a['n']} participants wished for the option they had decided in Scenario 4. Among the others:", "",
          "| Kind | What | n | Mean change, wish minus decision [95% CI] | p | q (FDR) |", "|---|---|---|---|---|---|"]
    L += [f"| {t['kind']} | {t['what']} | {t.get('n', '')} | {f(t.get('mean_change'), 1)} {ci(t.get('ci95'), 1)} | {rp.apa_p(t['p'])} | {rp.apa_p(t['q'])} |"
          for t in a["tests"] if t["kind"] in ("value", "metric")]
    L += ["", "Company stance in Scenario 4: " + ", ".join(f"{k} {v}" for k, v in a["stance_counts"].items()) + ".", ""]
    L += ["| Condition | " + " | ".join(next(iter(a["stance_by_condition"].values())).keys()) + " |",
          "|---|" + "---|" * len(next(iter(a["stance_by_condition"].values())))]
    L += [f"| {c} | " + " | ".join(str(v) for v in row.values()) + " |" for c, row in a["stance_by_condition"].items()]
    for t in a["tests"]:
        if t["kind"] not in ("value", "metric"):
            L.append(f"- {t['kind']} ({t['what']}): p {rp.apa_p(t['p'])}, q {rp.apa_p(t['q'])}" +
                     (f", epsilon-squared {f(t.get('epsilon_squared'), 3)}" if t.get("epsilon_squared") is not None else "") +
                     (". Partly by construction: the Scenario 4 choice that defines the stance is also one of the four parts of "
                      "VCI, so this link is not a finding on its own" if t["kind"] == "VCI by stance" else ""))
    a = R["A5x"]
    L += ["", "## A5x. Departure across the five positions (exploratory)", ""]
    for col, lab in (("departure", "Departure share"), ("departure_menu_adjusted", "Menu-adjusted departure")):
        r = a[col]
        L += [f"**{lab}** (n = {r['n']}): Friedman chi-square {f(r['friedman_chi2'])}, p {rp.apa_p(r['friedman_p'])}, Kendall's W {f(r['kendalls_w'], 3)}. "
              "Means: " + "; ".join(f"{o}: {f(v['mean'], 1)} {ci(v['ci95'], 1)}" for o, v in r["means"].items()) + ".", "",
              "| From | To | Mean difference | r_rb | p | q (FDR) |", "|---|---|---|---|---|---|"]
        L += [f"| {p['from']} | {p['to']} | {f(p['mean_difference'], 1)} | {rp.no0(p.get('rank_biserial_r'))} | {rp.apa_p(p['p'])} | {rp.apa_p(p['q'])} |"
              for p in r["pairs"]]
        L.append("")
    L.append("Note. The scenarios came in one fixed order and each position has its own story, so a difference may come from order "
             "or content as well as from position.")
    a = R["A6x"]
    L += ["", "## A6x. The comparison view (MCF), time and option changes (exploratory)", "",
          "| Condition | n | Read the comparison view at least once [95% CI] | Median seconds per scenario | Median option changes (total) |",
          "|---|---|---|---|---|"]
    pc = lambda c: f"[{100 * c[0]:.0f}%, {100 * c[1]:.0f}%]"   # noqa: E731
    L += [f"| {c} | {v['n']} | {v['read_at_least_once']} of {v['n']} ({100 * v['read_at_least_once'] / v['n']:.0f}%) {pc(v['ci95'])} | "
          f"{f(a['time_and_changes_by_condition'][c]['median_seconds_per_scenario'], 0)} | "
          f"{f(a['time_and_changes_by_condition'][c]['median_option_changes_total'], 0)} |" for c, v in a["readers_by_condition"].items()]
    L += ["", "Median seconds by scenario: " + ", ".join(f"{o}: {f(s, 0)}" for o, s in a["median_seconds_by_scenario"].items()) + ".", ""]
    for t in a["tests"]:
        extra = (f", odds ratio {f(t['odds_ratio'])} {ci(t['ci95'])}; good fit {f(100 * t['share_good_fit_read'], 0)}% when read, "
                 f"{f(100 * t['share_good_fit_not_read'], 0)}% when not") if "odds_ratio" in t else ""
        L.append(f"- {t['what']}: p {rp.apa_p(t['p'])}, q {rp.apa_p(t['q'])}{extra}")
    a = R["A7x"]
    L += ["", "## A7x. Other known effects in Blocks 1-4, and reconsidering as a trait (exploratory)", ""]
    for t in a["tests"]:
        extras = ", ".join(f"{k.replace('_', ' ')} {f(v) if isinstance(v, float) else v}" for k, v in t.items()
                           if k not in ("what", "p", "q") and not isinstance(v, (dict, list)))
        L.append(f"- {t['what']}: p {rp.apa_p(t['p'])}, q {rp.apa_p(t['q'])}" + (f"; {extras}" if extras else ""))
    b4 = a["block4"]
    L += ["", f"Block 4: {b4['changed']} of {b4['n']} changed their decision from first to last; {b4['wobbled']} wobbled and came back. "
          "Paths: " + ", ".join(f"{k} {v}" for k, v in b4["first_to_final"].items()) + ".",
          "", "Block 1, what people did instead of keeping (answers, all amounts): " +
          "; ".join(f"{place}: " + ", ".join(f"{k} {v}" for k, v in acts.items()) for place, acts in a["block1_instead_of_keeping"].items()) + "."]
    a = R["A8x"]
    L += ["", "## A8x. Feedback on the help steps, learning insight and written answers (exploratory)", "",
          "| Step | Question | n | Mean [95% CI] or yes | Rated 5-7 |", "|---|---|---|---|---|"]
    for r in a["questions"]:
        step = "Reflection" if r["section"] == "cvr" else "Clarification"
        val = f"{f(r['mean'], 2)} {ci(r['ci95'])}" if "mean" in r else f"{r.get('yes')} of {r.get('of')} yes"
        L.append(f"| {step} | {r['question']} | {r['n']} | {val} | {rp.no0(r.get('agree_5_to_7')) if 'agree_5_to_7' in r else ''} |")
    L += ["", "Learning insight (1-7) by condition: " + "; ".join(f"{c} {f(v['mean'])} {ci(v['ci95'])}" for c, v in a["learning_insight_by_condition"].items()) +
          f" (Kruskal-Wallis p {rp.apa_p(a['tests'][0]['p'])}).", "",
          f"Written answers: {a['written_answers']['answers']} answers from {a['written_answers']['people']} participants."]
    if a.get("themes"):
        L += ["", "| Theme | Answers | Example (shortened, no personal detail) |", "|---|---|---|"]
        L += [f"| {t['theme']} | {t['count']} | {t.get('example', '')} |" for t in a["themes"]]
    else:
        L += ["", "The themes are added after the answers are read (themes.json)."]
    a = R["A9x"]
    L += ["", "## A9x. A1-A3 among participants with a misfit first pick at least once (exploratory; a subgroup defined after randomization)", "",
          f"{a['participants_in_subgroup']} participants: " + ", ".join(f"{k} {v}" for k, v in a["per_condition"].items()) + ".", "",
          "| As | Against | n | CVR+APA mean | Other mean | r_rb [95% CI] | p | q (FDR) |", "|---|---|---|---|---|---|---|---|"]
    L += [f"| {t['as']} | {t['against']} | {'+'.join(map(str, t['n']))} | {f(t['mean_x'], 1)} | {f(t['mean_y'], 1)} | "
          f"{rp.no0(t['rank_biserial_r'])} {rp.ci(t.get('ci95_rank_biserial_r'), rp.no0).strip()} | {rp.apa_p(t['p'])} | {rp.apa_p(t['q'])} |" for t in a["tests"]]
    (out / "EXPLORATORY_RESULTS.md").write_text("\n".join(L) + "\n", encoding="utf8")


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    data, out = Path(argv[1]), Path(argv[2])
    simulated = "--simulated" in argv
    out.mkdir(parents=True, exist_ok=True)
    docs = bt.load_records(data)
    T = bt.build(docs)
    included = set(T["P"]["pid"])
    docs_in = [d for d in docs if str(d.get("prolific_pid")) in included]
    figs = out / "figures"
    fg.CAPTIONS.clear()
    caps = []
    R = {"A1x": a1x(T, figs, simulated, caps), "A2x": a2x(T, figs, simulated, caps), "A3x": a3x(T, docs_in, figs, simulated, caps),
         "A4x": a4x(T, docs_in, figs, simulated, caps), "A5x": a5x(T, figs, simulated, caps),
         "A6x": a6x(T, docs_in, figs, simulated, caps), "A7x": a7x(T, docs_in, figs, simulated, caps),
         "A8x": a8x(T, docs_in, out, simulated, caps), "A9x": a9x(T, figs, simulated, caps)}
    written = R["A8x"].pop("_written_for_reading")
    (out / "written_answers_for_reading.json").write_text(json.dumps(written, indent=1, ensure_ascii=False), encoding="utf8")
    import pipeline as pl
    (out / "exploratory_results.json").write_text(json.dumps(pl.to_jsonable(R), indent=2), encoding="utf8")
    write_report(pl.to_jsonable(R), out, simulated, len(included))
    md = [f"# Figure captions, exploratory{' (SIMULATED: not data)' if simulated else ''}", ""]
    md += [f"**{name}**: *{title}*. Note. {note}" for name, title, note in caps]
    (figs / "figure_captions_exploratory.md").write_text("\n\n".join(md) + "\n", encoding="utf8")
    print(f"Exploratory round 1: {len(R)} analyses, {len(caps)} figures, {len(included)} participants -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
