"""posthoc_chiwork.py: POST HOC analyses for the CHIWORK 2027 paper (22 November 2026).

Waseem's request (22 November 2026): relationships, tables and figures about the prediction (MPF), the company's value in
Scenarios 4 and 5, well-being, decision satisfaction and process satisfaction, and the feedback answers, for the paper
agent. Every result is POST HOC (computed after the registered and the exploratory analyses). Each estimate has its 95%
interval; p-values are shown raw and as Benjamini-Hochberg q-values within each section. Group counts and test results
only, never a participant row. Reads the frozen analysis modules (tag analysis-v1) read-only; changes nothing.

Run:
  analysis\\.venv\\Scripts\\python.exe exploratory\\posthoc_chiwork.py <participants_ai_safe.json> <output folder> \\
      [--registered <results.json of the registered analysis>] [--simulated]
"""
from __future__ import annotations

import json
import math
import sys
import textwrap
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import explore as ex                       # noqa: E402  (round 1's tools; it loads the frozen modules, read-only)
from explore import bt, st, rp, fg, plt    # noqa: E402

get = bt.get
DIV = ["#b84513", "#eb6834", "#f3b394", "#d9d9d9", "#9ec4ef", "#2a78d6", "#1a5fb4"]   # 1..7: low (orange) to high (blue)
VEIL = "veil_emergency_reserve_rule"
COMPANY_HI, COMPANY_LO, BAND = 88.0, 34.0, 8.0     # block5Company.ts: the company profile and the stance band
STANCE_WORDS = {"resisted": "Held their own values", "compromised": "Split the difference", "adopted": "Took the company's value"}
TOOK = STANCE_WORDS["adopted"]
VALUE_WORDS = {"vulnerabilityProtectionSensitivity": "Protecting the vulnerable", "groupSizeSensitivity": "Reducing harm",
               "gainResponsivenessSensitivity": "How much is gained", "outcomeAggregationSensitivity": "How many are helped"}
SUB_WORDS = {"decisionSatisfaction": "Decision satisfaction", "valueCongruence": "Value congruence",
             "decisionConfidence": "Decision confidence", "perceivedSupport": "Perceived support",
             "overallWellbeing": "Overall well-being", "learningInsight": "Learning insight",
             "decisionRegret": "Decision regret (higher = more regret)", "cognitiveBurden": "Cognitive burden (higher = more burden)",
             "wellbeingComposite": "Well-being composite"}
ITEM_WORDS = {   # short forms of the items, for the figures; the full wording is in the tables
    "DS1": "Satisfied with my final decisions", "DS2": "Satisfied with how I reached my decisions (the process)",
    "DS4": "Satisfied with what my decisions achieved", "VC1": "My decisions reflected what I truly value",
    "VC2": "Consistent with the kind of person I want to be", "DC1": "Confident in the decisions I made",
    "DC2": "Reflecting made me more confident in my final choices", "SA1": "The system supported me in making my own decision",
    "SA2": "Free to choose what I believed, not pushed", "SA3": "The tools helped me think, rather than telling me what to do",
    "OW1": "Overall, a positive experience", "OW2": "Emotionally comfortable", "OW3": "I feel good about how I approached the decisions",
    "LI1": "I learned something about my own values", "LI2": "Insight into how I make difficult decisions",
    "LI3": "Understand moral trade-offs more clearly", "LI4": "The process improved my decision-making"}
ITEM_FULL = {
    "DS1": "I am satisfied with the final decisions I made.", "DS2": "I am satisfied with the way I reached my decisions (the process).",
    "DS4": "I am satisfied with what my decisions achieved.", "VC1": "My final decisions reflected what I truly value.",
    "VC2": "My choices were consistent with the kind of person I want to be.", "DC1": "I felt confident in the decisions I made.",
    "DC2": "Reflecting during the task made me more confident in my final choices.",
    "SA1": "The system supported me in making my own decision.",
    "SA2": "I felt free to choose what I genuinely believed, rather than being pushed toward an answer.",
    "SA3": "The tools helped me think more clearly, rather than telling me what to do.",
    "OW1": "Overall, this was a positive experience.", "OW2": "I felt emotionally comfortable during the experiment.",
    "OW3": "I feel good about how I approached these decisions.",
    "LI1": "I learned something about my own values during this experiment.", "LI2": "I gained insight into how I make difficult decisions.",
    "LI3": "This experience helped me understand moral trade-offs more clearly.",
    "LI4": "I believe this process improved the quality of my decision-making."}
TOOLS = [("TOOL_optionCards", "The option cards"), ("TOOL_consequences", "The consequence / \"what it gives up\" lines"),
         ("TOOL_tradeoffs", "The trade-off explanations"), ("TOOL_metricsDashboard", "The performance metrics dashboard"),
         ("TOOL_previewImpact", "The \"Preview impact\" button"), ("TOOL_resultsPage", "The final results page")]
CVR_ITEMS = [("CVR_helped", "The value-reflection step helped me think more carefully about my decision."),
             ("CVR_useful", "The value-reflection step was useful to me."),
             ("CVR_reconsider", "Hearing the affected person's perspective, or the re-framing, made me reconsider my choice."),
             ("CVR_confidence", "After the value reflection, my confidence in my choice went ... (1 = much lower, 7 = much higher)")]
APA_ITEMS = [("APA_clarify", "The value-clarification step helped me clarify what I actually value."),
             ("APA_tradeoff", "It helped me see the trade-off between my earlier profile and my chosen option."),
             ("APA_prioritization", "The value-prioritization step was useful."),
             ("APA_better", "The value-clarification step helped me make a better final decision.")]
YESNO = [("cvr_CVR_clear", "Was the value-reflection step clear and easy to understand?", "cvr"),
         ("cvr_CVR_confusing", "Did the value-reflection step feel confusing or distracting?", "cvr"),
         ("cvr_CVR_changed", "Did the value reflection change your final choice or your values?", "cvr"),
         ("apa_APA_clear", "Were the value-clarification questions clear?", "apa"),
         ("apa_APA_toolong", "Did the value-clarification step feel too long?", "apa"),
         ("apa_APA_confidence_helpful", "Was the confidence rating helpful?", "apa"),
         ("tool_TOOLS_clear", "Was the scenario information clear?", "all")]


def ans(v):
    return v.get("answer") if isinstance(v, dict) else v


def texq(s: str) -> str:
    """Straight double quotes as LaTeX opening and closing quotes."""
    import re
    return re.sub(r'"([^"]*)"', r"``\1''", s)


def save(fig, out, name, sim, title, note, caps):
    fg._save(fig, out, name, sim, "Post hoc: " + title, "Post hoc. " + note)
    caps.append(fg.CAPTIONS[-1])


def pct(x, nd=0):
    return f"{100 * x:.{nd}f}%"


def binom_greater(k, n, p0):
    return float(stats.binomtest(int(k), int(n), p0, alternative="greater").pvalue)


def boot_ci_rate(hits_by_person, n_by_person, name):
    """Participant-clustered 95% interval of a pooled rate (10,000 resamples, the registered seed rule)."""
    g = st.rng_for(name)
    h, m = np.asarray(hits_by_person, float), np.asarray(n_by_person, float)
    idx = g.integers(0, len(h), (10_000, len(h)))
    r = h[idx].sum(1) / m[idx].sum(1)
    return [float(np.percentile(r, 2.5)), float(np.percentile(r, 97.5))]


def boot_ci_spearman(a, b, name, reps=2_000):
    g = st.rng_for(name)
    a, b = np.asarray(a, float), np.asarray(b, float)
    idx = g.integers(0, len(a), (reps, len(a)))
    rs = [stats.spearmanr(a[i], b[i]).statistic for i in idx]
    return [float(np.nanpercentile(rs, 2.5)), float(np.nanpercentile(rs, 97.5))]


def one_sample_vs_4(v):
    """Wilcoxon signed-rank against the scale midpoint 4 (two-sided), with the matched-pairs rank-biserial r."""
    v = pd.to_numeric(pd.Series(v), errors="coerce").dropna().to_numpy(float) - 4.0
    nz = v[v != 0]
    if len(nz) < 2:
        return float("nan"), float("nan")
    r = stats.wilcoxon(nz)
    ranks = stats.rankdata(np.abs(nz))
    t_plus, t_minus = ranks[nz > 0].sum(), ranks[nz < 0].sum()
    return float(r.pvalue), float((t_plus - t_minus) / (t_plus + t_minus))


def add_q(rows, key="p"):
    for r, q in zip(rows, ex.fdr([r.get(key) for r in rows])):
        r["q"] = q
    return rows


# ------------------------------------------------------------------------------------------------- one row per person
def person_frame(T, docs):
    P = T["P"].set_index("pid")
    S = T["S"]
    hits = S[S["decision"]].groupby("pid")["mpf_hit_first_updated"].mean()
    rows = []
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid not in P.index:
            continue
        fb = get(d, "blocks.feedback_answers.feedback") or {}
        wb = fb.get("wellbeing") or {}
        cs = get(d, "analysis.position_effect.company_stance") or {}
        cv = get(d, "analysis.position_effect.company_value_shown") or {}
        dvw = get(d, "analysis.position_effect.decided_versus_wished") or {}
        r6 = next((r for r in get(d, "blocks.block5_emergency_scenarios.scenarioResults") or [] if r.get("scenarioId") == VEIL), {})
        pt = r6.get("predictionTest") or {}
        ranks = {x.get("optionId"): x.get("rank") for x in pt.get("shownProbabilities") or []}
        rows.append({
            "pid": pid, "condition": P.loc[pid, "condition"], "vci": P.loc[pid, "vci"], "performance": P.loc[pid, "performance"],
            "mpf_hit_rate": float(hits.get(pid, np.nan)),
            "stance": cs.get("stance"), "pull": cs.get("pull_toward_the_company"), "company_value": cv.get("value"),
            "wish_same": dvw.get("wished_for_the_same_option"),
            "s6_first_is_top": pt.get("firstChoiceOptionId") == pt.get("predictedTopOptionId"),
            "s6_first_rank": ranks.get(pt.get("firstChoiceOptionId")),
            "s6_changed": bool(pt.get("changedAfterSeeing")),
            "s6_final_is_top": pt.get("finalChoiceOptionId") == pt.get("predictedTopOptionId"),
            "sounds_like_me": pt.get("soundsLikeMe"), "surprised": pt.get("surprised"),
            **{f"item_{k}": v for k, v in (wb.get("items") or {}).items()},
            **{f"sub_{k}": v for k, v in (wb.get("subscales") or {}).items()},
            "sub_wellbeingComposite": wb.get("wellbeingComposite"),
            **{f"tool_{k}": ans(v) for k, v in (fb.get("decisionSupport") or {}).items()},
            **{f"cvr_{k}": ans(v) for k, v in (fb.get("cvr") or {}).items()},
            **{f"apa_{k}": ans(v) for k, v in (fb.get("apa") or {}).items()},
        })
    return pd.DataFrame(rows)


# ------------------------------------------------------------------------------------------------- figures: Likert bars
def likert_figure(rows, low, high, out, name, sim, title, note, caps, height_per_row=0.34):
    """Diverging stacked bars for 1-7 answers: 1-3 to the left, 4 split around zero in gray, 5-7 to the right."""
    rows = sorted(rows, key=lambda r: -float((pd.to_numeric(pd.Series(r[1]), errors="coerce").dropna() >= 5).mean()))
    fig, ax = plt.subplots(figsize=(fg.WIDTH, height_per_row * len(rows) + 1.25))
    ax.grid(True, axis="x")
    ax.grid(False, axis="y")
    lefts = []
    for i, (lab, vals) in enumerate(rows):
        v = pd.to_numeric(pd.Series(vals), errors="coerce").dropna()
        sh = [float((v == k).mean() * 100) for k in range(1, 8)]
        left = -(sum(sh[:3]) + sh[3] / 2)
        for k in range(7):
            ax.barh(i, sh[k], left=left, color=DIV[k], height=0.66, edgecolor="white", linewidth=0.8)
            left += sh[k]
        ax.text(left + 1.5, i, f"{sum(sh[4:]):.0f}%", va="center", ha="left", fontsize=7.5, color=fg.INK)
        lefts.append(-(sum(sh[:3]) + sh[3] / 2))
    ax.axvline(0, color=fg.INK2, lw=0.8)
    ax.set_yticks(range(len(rows)), [r[0] for r in rows], fontsize=7.8)
    ax.invert_yaxis()
    lo = min(-50, 25 * math.floor(min(lefts) / 25))
    ax.set_xlim(lo, 112)
    ticks = list(range(int(lo), 101, 25))
    ax.set_xticks(ticks, [str(abs(t)) for t in ticks])
    ax.set_xlabel("Percent of answers (left: 1-3; right: 5-7; gray: 4, split at the middle)")
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in DIV]
    labels = [f"1 {low}"] + ["2", "3", "4", "5", "6"] + [f"7 {high}"]
    ax.legend(handles, labels, loc="lower center", bbox_to_anchor=(0.45, 1.0), ncol=7, fontsize=7, handlelength=1.0,
              columnspacing=0.8)
    save(fig, out, name, sim, title, note + " The number at the right of each bar is the share answering 5, 6 or 7.", caps)


# ------------------------------------------------------------------------------------------------- P1: the prediction
def p1(T, X, registered, out, sim, caps, docs):
    S = T["S"]
    menus = bt.Menus()
    # the prediction's order of the options = the study's own ranking on the profile each scenario opened with (lowest
    # shortfall first; a tie broken by what the option delivers, then by its id: labelOptions and the MPF, the same order)
    u_open = {}
    for d in docs:
        pid = str(d.get("prolific_pid"))
        for m in get(d, "analysis.mpf_predictions_every_scenario.by_scenario") or []:
            u = m.get("profile_used_values")
            if isinstance(u, dict) and all(isinstance(u.get(k), (int, float)) for k in menus.policy):
                u_open[(pid, m.get("scenario_id"))] = {k: float(u[k]) for k in menus.policy}
    dec = S[S["decision"]].copy()
    tops = []
    for _, r in dec.iterrows():
        u = u_open.get((r["pid"], r["scenario_id"]))
        order = menus.ranking(r["scenario_id"], u) if u else []
        tops.append((order[:1], order[:2]))
    dec["top1"] = [r["first_id"] in t1 for (t1, _), (_, r) in zip(tops, dec.iterrows())]
    dec["top2"] = [r["first_id"] in t2 for (_, t2), (_, r) in zip(tops, dec.iterrows())]
    ch = dec
    check_top1 = bool((dec["top1"] == dec["mpf_hit_first_updated"].astype(bool)).all())
    rows = []
    for o in (1, 2, 3, 4):
        g = ch[ch["order"] == o]
        for what, col, p0 in (("top pick", "top1", 1 / 6), ("top two", "top2", 2 / 6)):
            k, n = int(g[col].sum()), int(len(g))
            rows.append({"group": f"Scenario {o}", "measure": what, "k": k, "n": n, "rate": k / n, "ci95": ex.cp(k, n),
                         "chance": p0, "p": binom_greater(k, n, p0)})
    per = ch.groupby("pid").agg(top1=("top1", "sum"), top2=("top2", "sum"), n=("top1", "size"))
    for what, col, p0 in (("top pick", "top1", 1 / 6), ("top two", "top2", 2 / 6)):
        k, n = int(per[col].sum()), int(per["n"].sum())
        rows.append({"group": "All four decisions", "measure": what, "k": k, "n": n, "rate": k / n,
                     "ci95": boot_ci_rate(per[col], per["n"], f"PH1:{col}"), "chance": p0, "p": binom_greater(k, n, p0)})
    k1, k2, n6 = int(X["s6_first_is_top"].sum()), int((X["s6_first_rank"] <= 2).sum()), int(X["s6_first_rank"].notna().sum())
    rows.append({"group": "Scenario 6 (first rule)", "measure": "top pick", "k": k1, "n": n6, "rate": k1 / n6, "ci95": ex.cp(k1, n6),
                 "chance": 1 / 4, "p": binom_greater(k1, n6, 1 / 4)})
    rows.append({"group": "Scenario 6 (first rule)", "measure": "top two", "k": k2, "n": n6, "rate": k2 / n6, "ci95": ex.cp(k2, n6),
                 "chance": 2 / 4, "p": binom_greater(k2, n6, 2 / 4)})
    add_q(rows)
    # after seeing the prediction (Scenario 6)
    chg = X[X["s6_changed"]]
    chg_from_other = chg[~chg["s6_first_is_top"]]
    moved = int(chg_from_other["s6_final_is_top"].sum())
    after = {"changed": int(len(chg)), "kept": int((~X["s6_changed"]).sum()), "changed_from_another_rule": int(len(chg_from_other)),
             "moved_to_the_prediction": moved,
             "p_vs_one_in_three": binom_greater(moved, len(chg_from_other), 1 / 3) if len(chg_from_other) else float("nan")}
    # "Does this guess sound like how you decide?" and surprise
    sl = X.dropna(subset=["sounds_like_me"])
    right, wrong = sl[sl["s6_first_is_top"]], sl[~sl["s6_first_is_top"]]
    sounds = {"n": int(len(sl)), "mean_all": float(sl["sounds_like_me"].mean()), "share_5_to_7_all": float((sl["sounds_like_me"] >= 5).mean()),
              "right": {"n": int(len(right)), "mean": float(right["sounds_like_me"].mean()), "median": float(right["sounds_like_me"].median()),
                        "share_5_to_7": float((right["sounds_like_me"] >= 5).mean())},
              "wrong": {"n": int(len(wrong)), "mean": float(wrong["sounds_like_me"].mean()), "median": float(wrong["sounds_like_me"].median()),
                        "share_5_to_7": float((wrong["sounds_like_me"] >= 5).mean())}}
    if registered:
        c4 = registered["hypotheses"].get("C4", {})
        sounds["registered_C4"] = {k: c4.get(k) for k in ("statistic", "U", "rank_biserial_r", "r_rb", "p", "estimate") if k in c4}
        sounds["registered_C4_holm_p"] = (registered.get("decisions", {}).get("C4") or {}).get("holm_p")
    su = X.dropna(subset=["surprised"])
    tab = pd.crosstab(su["s6_first_is_top"], su["surprised"].astype(bool)).reindex(index=[True, False], columns=[True, False], fill_value=0)
    surprise = {"n": int(len(su)), "share_surprised": float(su["surprised"].astype(bool).mean()),
                "right_surprised": int(tab.loc[True, True]), "right_n": int(tab.loc[True].sum()),
                "wrong_surprised": int(tab.loc[False, True]), "wrong_n": int(tab.loc[False].sum()),
                "p_fisher": float(stats.fisher_exact(tab.to_numpy()).pvalue)}
    links = []
    for col, lab in (("sub_valueCongruence", "Value congruence"), ("sub_perceivedSupport", "Perceived support"),
                     ("sub_decisionSatisfaction", "Decision satisfaction"), ("item_DS2", "Process satisfaction (DS2)"),
                     ("sub_learningInsight", "Learning insight"), ("sub_overallWellbeing", "Overall well-being")):
        d2 = X[["sounds_like_me", col]].apply(pd.to_numeric, errors="coerce").dropna()
        r = stats.spearmanr(d2["sounds_like_me"], d2[col])
        links.append({"with": lab, "n": int(len(d2)), "rho": float(r.statistic), "p": float(r.pvalue),
                      "ci95": boot_ci_spearman(d2["sounds_like_me"], d2[col], f"PH1:sl:{col}")})
    add_q(links)
    # Figure: hit rates against chance
    groups = [f"Scenario {o}" for o in (1, 2, 3, 4)] + ["All four decisions", "Scenario 6 (first rule)"]
    xl = ["1\nAlone", "2\nHousehold", "3\nOthers", "4\nEmployer's\nrules", "All four\ndecisions", "6\nVeil\n(first rule)"]
    fig, ax = plt.subplots(figsize=(fg.WIDTH, 3.3))
    w = 0.36
    for j, (what, color) in enumerate((("top pick", fg.ACCENT), ("top two", "#9ec4ef"))):
        for i, gname in enumerate(groups):
            r = next(x for x in rows if x["group"] == gname and x["measure"] == what)
            x = i + (j - 0.5) * w
            ax.bar(x, 100 * r["rate"], width=w * 0.92, color=color, edgecolor="white", linewidth=0.6,
                   label=("The prediction's top option" if what == "top pick" else "Its two most likely options") if i == 0 else None)
            ax.errorbar(x, 100 * r["rate"], yerr=[[100 * (r["rate"] - r["ci95"][0])], [100 * (r["ci95"][1] - r["rate"])]],
                        fmt="none", ecolor=fg.INK2, capsize=2, lw=0.9)
            ax.plot([x - w * 0.46, x + w * 0.46], [100 * r["chance"]] * 2, color=fg.INK, lw=1.1, ls=(0, (2, 1.5)),
                    label="Chance (random choice)" if (i == 0 and j == 0) else None)
    for xv in (3.5, 4.5):
        ax.axvline(xv, color="#cccccc", lw=0.6)
    ax.set_xticks(range(len(groups)), xl, fontsize=8)
    ax.set_ylabel("Participant's first choice (%)")
    ax.set_ylim(0, 75)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.0), fontsize=7.5, ncol=3)
    save(fig, out, "pfig_P1_prediction_hit_rates", sim, "How Often the Prediction Named the Participant's First Choice",
         "Share of first choices that were the Moral Prediction Function's (MPF's) top option (dark bars) or one of its two "
         "most likely options (light bars), with 95% intervals (Clopper-Pearson per scenario; participant bootstrap for all "
         "four decisions). Dashed lines: the rate expected from random choice (six options in Scenarios 1-4, four rules in "
         "Scenario 6). Scenarios 1-4: the prediction from the profile as each scenario opened, computed for the analysis; "
         "Scenario 6: the prediction shown to the participant after their first choice.", caps)
    likert_figure([(f"The prediction named their rule (n = {len(right)})", right["sounds_like_me"]),
                   (f"The prediction named another rule (n = {len(wrong)})", wrong["sounds_like_me"])],
                  "not like me at all", "very much like me", out, "pfig_P1_sounds_like_me", sim,
                  "\"Does This Guess Sound Like How You Decide?\"",
                  "Answers on the Scenario 6 prediction page (1 = not like me at all, 7 = very much like me), by whether the "
                  "prediction's top rule was the rule the participant had chosen first.", caps, height_per_row=0.55)
    return {"hit_rates": rows, "top_pick_matches_the_stored_hits": check_top1,
            "after_seeing_the_prediction": after, "sounds_like_me": sounds, "surprised": surprise, "sounds_like_me_links": links}


# ------------------------------------------------------------------------------------------------- P2: the company's value
def p2(T, docs, X, out, sim, caps):
    menus = bt.Menus()
    pol = list(VALUE_WORDS)
    rows = []
    for d in docs:
        pid = str(d.get("prolific_pid"))
        dims = {x["key"]: x["score"] for x in get(d, "blocks.block5_emergency_scenarios.originalProfile.dimensions") or []}
        if not all(k in dims for k in pol):
            continue
        u0 = {k: float(dims[k]) for k in pol}
        lowest = pol[0]
        for k in pol:
            if u0[k] < u0[lowest]:
                lowest = k
        comp = {k: (COMPANY_HI if k == lowest else COMPANY_LO) for k in pol}
        r4 = (get(d, "blocks.block5_emergency_scenarios.scenarioResults") or [])[3]
        groups = []
        for o in menus.by_id[r4["scenarioId"]]["options"]:
            pull = menus.distance(u0, o) - menus.distance(comp, o)
            groups.append("adopted" if pull > BAND else "resisted" if pull < -BAND else "compromised")
        rows.append({"pid": pid, "lowest": lowest, **{f"n_{g}": groups.count(g) for g in STANCE_WORDS}})
    G = pd.DataFrame(rows).merge(X[["pid", "stance", "company_value", "wish_same", "pull"]], on="pid")

    def block(Y):
        obs = {g: int((Y["stance"] == g).sum()) for g in STANCE_WORDS}
        exp = {g: float((Y[f"n_{g}"] / 6).sum()) for g in STANCE_WORDS}
        ps = (Y["n_adopted"] / 6).to_numpy()
        dist = np.zeros(len(ps) + 1)
        dist[0] = 1.0
        for p in ps:
            dist[1:] = dist[1:] * (1 - p) + dist[:-1] * p
            dist[0] *= (1 - p)
        return {"n": int(len(Y)), "observed": obs, "expected": exp, "p_fewer_took_the_company_value": float(dist[: obs["adopted"] + 1].sum())}
    overall = block(G)
    by_value = []
    for k in pol:
        Y = G[G["lowest"] == k]
        if len(Y):
            by_value.append({"company_value": VALUE_WORDS[k], **block(Y)})
    by_value.sort(key=lambda r: -r["n"])
    for r, q in zip(by_value, ex.fdr([r["p_fewer_took_the_company_value"] for r in by_value])):
        r["q"] = q
    # the wish (Scenario 5) against the decision (Scenario 4)
    W = G.dropna(subset=["wish_same"])
    k, n = int(W["wish_same"].astype(bool).sum()), int(len(W))
    wish = {"same": k, "n": n, "rate": k / n, "ci95": ex.cp(k, n), "chance": 1 / 6, "p": binom_greater(k, n, 1 / 6)}
    ct = pd.crosstab(W["stance"], W["wish_same"].astype(bool)).reindex(index=list(STANCE_WORDS), columns=[True, False], fill_value=0)
    chi = stats.chi2_contingency(ct.to_numpy())
    wish["by_stance"] = {STANCE_WORDS[s]: {"same": int(ct.loc[s, True]), "n": int(ct.loc[s].sum())} for s in STANCE_WORDS}
    wish["p_by_stance"] = float(chi.pvalue)
    # the stance and the feedback
    outs = (("sub_valueCongruence", "Value congruence"), ("sub_decisionSatisfaction", "Decision satisfaction"),
            ("item_DS2", "Process satisfaction (DS2)"), ("sub_decisionRegret", "Decision regret"),
            ("sub_perceivedSupport", "Perceived support"), ("sub_overallWellbeing", "Overall well-being"))
    F = G.merge(X[["pid"] + [c for c, _ in outs]], on="pid")
    fb_rows = []
    for col, lab in outs:
        v = pd.to_numeric(F[col], errors="coerce")
        p_kw, eps2 = ex.kruskal([v[F["stance"] == s] for s in STANCE_WORDS])
        d2 = pd.DataFrame({"pull": pd.to_numeric(F["pull"], errors="coerce"), "y": v}).dropna()
        r = stats.spearmanr(d2["pull"], d2["y"])
        fb_rows.append({"outcome": lab, **{STANCE_WORDS[s]: float(v[F["stance"] == s].mean()) for s in STANCE_WORDS},
                        "p": p_kw, "epsilon_squared": eps2, "rho_pull": float(r.statistic), "p_rho": float(r.pvalue)})
    add_q(fb_rows)
    for r, q in zip(fb_rows, ex.fdr([r["p_rho"] for r in fb_rows])):
        r["q_rho"] = q
    # Figure: observed against blind choosing, and the wish by stance
    fig, axes = plt.subplots(1, 2, figsize=(fg.WIDTH, 3.0), gridspec_kw={"width_ratios": [1.3, 1], "wspace": 0.6})
    ax = axes[0]
    xs = np.arange(3)
    ax.bar(xs - 0.19, [overall["observed"][s] for s in STANCE_WORDS], width=0.36, color=fg.ACCENT, label="Observed")
    ax.bar(xs + 0.19, [overall["expected"][s] for s in STANCE_WORDS], width=0.36, color="#cfcfcf", label="Blind choosing (expected)")
    for i, s in enumerate(STANCE_WORDS):
        ax.text(i - 0.19, overall["observed"][s] + 0.8, str(overall["observed"][s]), ha="center", fontsize=7.5)
        ax.text(i + 0.19, overall["expected"][s] + 0.8, f"{overall['expected'][s]:.1f}", ha="center", fontsize=7.5, color=fg.INK2)
    ax.set_xticks(xs, ["Held their\nown values", "Split the\ndifference", "Took the\ncompany's\nvalue"], fontsize=7.5)
    ax.set_ylabel("Participants")
    ax.set_ylim(0, 62)
    ax.legend(loc="upper left", fontsize=7.5)
    ax.set_title("A. Scenario 4: the decision", fontsize=9, loc="left")
    ax = axes[1]
    for i, s in enumerate(STANCE_WORDS):
        b = wish["by_stance"][STANCE_WORDS[s]]
        same = 100 * b["same"] / b["n"] if b["n"] else 0
        ax.barh(i, same, color=fg.ACCENT, height=0.6)
        ax.barh(i, 100 - same, left=same, color="#cfcfcf", height=0.6)
        ax.text(1.5, i, f"{b['same']} of {b['n']}", va="center", ha="left", fontsize=7.5, color="white")
    ax.set_yticks(range(3), ["Held their\nown values", "Split the\ndifference", "Took the\ncompany's value"], fontsize=8)
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.grid(True, axis="x")
    ax.grid(False, axis="y")
    ax.set_xlabel("Wished for the option they had decided (%)")
    ax.set_title("B. Scenario 5: the wish", fontsize=9, loc="left")
    save(fig, out, "pfig_P2_company_value", sim, "The Company's Value: the Decision and the Wish",
         "A: participants by what they did with the company's value in Scenario 4 (observed), beside the counts expected if "
         "each had picked one of their six options at random (blind choosing), with each option placed by the study's own "
         "stance rule. B: the share in each group who, in Scenario 5 (the same decision made by someone else and landing on "
         "them), wished for the very option they had decided; random choice gives 1 in 6.", caps)
    return {"overall": overall, "by_company_value": by_value, "company_value_counts": G["lowest"].map(VALUE_WORDS).value_counts().to_dict(),
            "wish": wish, "stance_and_feedback": fb_rows}


# ------------------------------------------------------------------------------------------------- P3: well-being and satisfaction
def p3(X, out, sim, caps):
    desc = []
    cols = [(f"sub_{k}", w) for k, w in SUB_WORDS.items()] + [("item_DS1", "DS1: satisfied with the final decisions"),
                                                              ("item_DS2", "DS2: satisfied with the process"),
                                                              ("item_DS4", "DS4: satisfied with what the decisions achieved")]
    for col, lab in cols:
        v = pd.to_numeric(X[col], errors="coerce").dropna()
        p, r = one_sample_vs_4(v)
        m, ci = ex.boot_mean(v.to_numpy(float), f"PH3:{col}")
        desc.append({"measure": lab, "n": int(len(v)), "mean": m, "ci95": ci, "sd": float(v.std(ddof=1)), "median": float(v.median()),
                     "share_above_4": float((v > 4).mean()), "share_below_4": float((v < 4).mean()), "p": p, "r_rb": r})
    add_q(desc)
    by_cond = []
    for col, lab in cols:
        v = pd.to_numeric(X[col], errors="coerce")
        p, eps2 = ex.kruskal([v[X["condition"] == c] for c in ex.CONDITIONS])
        by_cond.append({"measure": lab, **{c: float(v[X["condition"] == c].mean()) for c in ex.CONDITIONS}, "p": p, "epsilon_squared": eps2})
    add_q(by_cond)
    links = []
    for bcol, blab in (("vci", "VCI"), ("performance", "Performance"), ("mpf_hit_rate", "Prediction hit rate (four decisions)")):
        for fcol, flab in (("sub_valueCongruence", "Value congruence"), ("sub_decisionSatisfaction", "Decision satisfaction"),
                           ("item_DS2", "Process satisfaction (DS2)"), ("sub_decisionConfidence", "Decision confidence"),
                           ("sub_perceivedSupport", "Perceived support"), ("sub_overallWellbeing", "Overall well-being"),
                           ("sub_wellbeingComposite", "Well-being composite")):
            d2 = X[[bcol, fcol]].apply(pd.to_numeric, errors="coerce").dropna()
            r = stats.spearmanr(d2[bcol], d2[fcol])
            links.append({"behaviour": blab, "feedback": flab, "n": int(len(d2)), "rho": float(r.statistic), "p": float(r.pvalue),
                          "ci95": boot_ci_spearman(d2[bcol], d2[fcol], f"PH3:{bcol}:{fcol}")})
    add_q(links)
    likert_figure([(ITEM_WORDS[k], X[f"item_{k}"]) for k in ITEM_WORDS if f"item_{k}" in X],
                  "strongly disagree", "strongly agree", out, "pfig_P3_wellbeing_items", sim,
                  "How Participants Felt About Their Decisions and the Experience",
                  "Answers of all participants (n = 107) to the positively worded well-being items, 1 = strongly disagree to "
                  "7 = strongly agree; short forms of the items (full wording in the table).", caps, height_per_row=0.3)
    return {"descriptives": desc, "by_condition": by_cond, "behaviour_links": links}


# ------------------------------------------------------------------------------------------------- P4: the feedback answers
def p4(X, out, sim, caps):
    rows = []
    for code, text in TOOLS + [("TOOLS_thoughtful", "The information provided helped me make a thoughtful decision.")]:
        v = pd.to_numeric(X.get(f"tool_{code}"), errors="coerce").dropna()
        p, r = one_sample_vs_4(v)
        rows.append({"section": "Tools (1 = not helpful, 7 = very helpful)" if code != "TOOLS_thoughtful" else "Tools (1-7, agree)",
                     "code": code, "text": text, "n": int(len(v)), "mean": float(v.mean()), "median": float(v.median()),
                     "share_5_to_7": float((v >= 5).mean()), "p": p, "r_rb": r})
    for prefix, items, sec in (("cvr", CVR_ITEMS, "The value-reflection step"), ("apa", APA_ITEMS, "The value-clarification step")):
        for code, text in items:
            v = pd.to_numeric(X.get(f"{prefix}_{code}"), errors="coerce").dropna()
            p, r = one_sample_vs_4(v)
            rows.append({"section": sec, "code": code, "text": text, "n": int(len(v)), "mean": float(v.mean()) if len(v) else float("nan"),
                         "median": float(v.median()) if len(v) else float("nan"), "share_5_to_7": float((v >= 5).mean()) if len(v) else float("nan"),
                         "p": p, "r_rb": r})
    add_q(rows)
    yes = []
    for col, text, who in YESNO:
        v = X.get(col)
        v = v.dropna().astype(str).str.lower() if v is not None else pd.Series(dtype=str)
        v = v[v.isin(["yes", "no"])]
        yes.append({"question": text, "n": int(len(v)), "yes": int((v == "yes").sum()), "share_yes": float((v == "yes").mean()) if len(v) else float("nan")})
    likert_figure([(t if len(t) < 48 else t[:46] + "...", X.get(f"tool_{c}")) for c, t in TOOLS]
                  + [("Information helped a thoughtful decision", X.get("tool_TOOLS_thoughtful"))],
                  "not helpful", "very helpful", out, "pfig_P4_tool_ratings", sim, "How Helpful the Decision-Support Tools Were",
                  "Answers of all participants (n = 107): each tool from 1 = not helpful to 7 = very helpful; the last row is "
                  "agreement (1 = strongly disagree, 7 = strongly agree) with \"The information provided helped me make a "
                  "thoughtful decision\".", caps, height_per_row=0.36)
    short = {"CVR_helped": "Reflection: helped me think more carefully", "CVR_useful": "Reflection: was useful to me",
             "CVR_reconsider": "Reflection: made me reconsider my choice", "CVR_confidence": "Reflection: my confidence went up (5-7)",
             "APA_clarify": "Clarification: helped me clarify what I value", "APA_tradeoff": "Clarification: showed the trade-off",
             "APA_prioritization": "Clarification: prioritizing was useful", "APA_better": "Clarification: a better final decision"}
    n_cvr = int(pd.to_numeric(X.get("cvr_CVR_helped"), errors="coerce").notna().sum())
    n_apa = int(pd.to_numeric(X.get("apa_APA_clarify"), errors="coerce").notna().sum())
    likert_figure([(f"{short[c]}", X.get(f"cvr_{c}")) for c, _ in CVR_ITEMS] + [(f"{short[c]}", X.get(f"apa_{c}")) for c, _ in APA_ITEMS],
                  "strongly disagree", "strongly agree", out, "pfig_P4_help_step_feedback", sim,
                  "What Participants Said About the Reflection and Clarification Steps",
                  f"Answers of the participants who met each step: the value-reflection step (n = {n_cvr}) and the "
                  f"value-clarification step (n = {n_apa}); 1 = strongly disagree to 7 = strongly agree, except the "
                  "confidence item (1 = much lower, 7 = much higher).", caps, height_per_row=0.36)
    return {"items": rows, "yes_no": yes, "n_reflection": n_cvr, "n_clarification": n_apa}


# ------------------------------------------------------------------------------------------------- the report and the tables
def write_outputs(R, out, sim, n, caps):
    apa, no0, f = rp.apa_p, rp.no0, rp.num
    ci = lambda c, nd=2, fmt=rp.num: rp.ci(c, fmt, nd).strip()   # noqa: E731
    pci = lambda c: f"[{100 * c[0]:.0f}%, {100 * c[1]:.0f}%]"    # noqa: E731
    L = [f"# Post hoc analyses for the CHIWORK paper: the prediction, the company's value, and the feedback{' (SIMULATED)' if sim else ''}",
         "", "**Date:** 22 November 2026. **Every result in this file is post hoc** (computed after the registered and the "
         "exploratory analyses, at Waseem's request for the CHIWORK 2027 paper).", ""]
    if sim:
        L += ["**SIMULATED: not data.**", ""]
    L += [f"**Data and code.** The AI-safe file of the first analysis ({n} participants: CVR+APA 27, CVR only 27, APA only 26, "
          "Baseline 27), read with the frozen analysis code (Git tag `analysis-v1`) without changing it; the script is "
          "`exploratory/posthoc_chiwork.py`. Each estimate has its 95% interval; p-values are shown raw and as "
          "Benjamini-Hochberg q-values within each section. Group counts and test results only.", "",
          "**Files beside this one:** the figures `figures/pfig_P*.pdf` (and `.png`), their captions in "
          "`figures/figure_captions_round4.md` and `.tex`, and four APA tables in LaTeX, `tables_apa_round4.tex` (needs "
          "`\\usepackage{booktabs,threeparttable}`).", "",
          "**How to write these results.** Write each as a post hoc result (for example, \"a post hoc analysis showed ...\"). "
          "A result with q below .05 holds within its section after the correction for the number of tests; a result with q "
          "of .05 or more is a pattern (\"tended to\"). Results that are also registered (C1, C2, C4, C5, C6, D5) are cited "
          "with their registered decision from the registered results.", ""]
    h, a1 = R["P1"]["hit_rates"], R["P1"]["after_seeing_the_prediction"]
    g = lambda grp, m: next(x for x in h if x["group"] == grp and x["measure"] == m)   # noqa: E731
    o1, o2 = g("All four decisions", "top pick"), g("All four decisions", "top two")
    sl, w, ov = R["P1"]["sounds_like_me"], R["P2"]["wish"], R["P2"]["overall"]
    d3 = {r["measure"]: r for r in R["P3"]["descriptives"]}
    it = {r["code"]: r for r in R["P4"]["items"]}
    tools_share = [r["share_5_to_7"] for r in R["P4"]["items"] if r["code"].startswith("TOOL_")]
    HIT = "Prediction hit rate (four decisions)"
    lk = lambda bb, ff: next(x for x in R["P3"]["behaviour_links"] if x["behaviour"] == bb and x["feedback"] == ff)   # noqa: E731
    four = [lk(a_, b_) for a_ in ("VCI", HIT) for b_ in ("Decision satisfaction", "Process satisfaction (DS2)")]
    L += ["## Key findings (post hoc)", "",
          "| # | Finding | Numbers |", "|---|---|---|",
          f"| 1 | The prediction named the participant's first choice well above chance across the four decisions | top option "
          f"{pct(o1['rate'], 1)} {pci(o1['ci95'])} against 16.7% by chance (p {apa(o1['p'])}); one of its two most likely options "
          f"{pct(o2['rate'], 1)} {pci(o2['ci95'])} against 33.3% (p {apa(o2['p'])}) |",
          f"| 2 | Participants who changed their rule after seeing the prediction moved to the rule it had named | "
          f"{a1['moved_to_the_prediction']} of {a1['changed_from_another_rule']} (one of the other three rules would be 1 in 3 by chance; "
          f"p {apa(a1['p_vs_one_in_three'])}); {a1['kept']} of {a1['kept'] + a1['changed']} kept their first rule |",
          f"| 3 | When the prediction named their rule, participants felt it described how they decide | \"sounds like me\" "
          f"5-7: {pct(sl['right']['share_5_to_7'])} when it named their rule (n = {sl['right']['n']}), "
          f"{pct(sl['wrong']['share_5_to_7'])} when it named another (n = {sl['wrong']['n']}); registered C4 supported |",
          f"| 4 | Decisions made under the employer and wishes as the receiver agreed far more than chance | "
          f"{w['same']} of {w['n']} ({pct(w['rate'])}) wished for the very option they had decided, against 1 in 6 by chance "
          f"(p {apa(w['p'])}) |",
          f"| 5 | Most participants did not simply take the company's value | {ov['observed']['resisted']} held their own values "
          f"and {ov['observed']['compromised']} split the difference; {ov['observed']['adopted']} took the company's value, "
          f"against {ov['expected']['adopted']:.1f} expected from blind choosing (one-sided p {apa(ov['p_fewer_took_the_company_value'])}) |",
          f"| 6 | Participants were satisfied with their decisions and with how they reached them | decision satisfaction "
          f"M = {f(d3['Decision satisfaction']['mean'])} (1-7), {pct(d3['Decision satisfaction']['share_above_4'])} above the "
          f"midpoint; process satisfaction (DS2) M = {f(d3['DS2: satisfied with the process']['mean'])}, "
          f"{pct(d3['DS2: satisfied with the process']['share_above_4'])} above the midpoint; both well above the midpoint "
          f"(one-sample tests, p {apa(max(d3['Decision satisfaction']['p'], d3['DS2: satisfied with the process']['p']))}) |",
          f"| 7 | Participants felt supported and free, and said their decisions reflected their values | perceived support "
          f"M = {f(d3['Perceived support']['mean'])}, value congruence M = {f(d3['Value congruence']['mean'])}, overall "
          f"well-being M = {f(d3['Overall well-being']['mean'])} (1-7; all above the midpoint, p {apa(max(d3[k]['p'] for k in ('Perceived support', 'Value congruence', 'Overall well-being')))}) |",
          f"| 8 | The decision-support tools were rated helpful | each of the six tools rated 5-7 by {pct(min(tools_share))} to "
          f"{pct(max(tools_share))} of participants; \"The information provided helped me make a thoughtful decision\": "
          f"{pct(it['TOOLS_thoughtful']['share_5_to_7'])} agreed |",
          f"| 9 | Participants valued the reflection and clarification steps | \"helped me think more carefully\": "
          f"{pct(it['CVR_helped']['share_5_to_7'])} of {it['CVR_helped']['n']}; \"helped me clarify what I actually value\": "
          f"{pct(it['APA_clarify']['share_5_to_7'])} of {it['APA_clarify']['n']} |",
          f"| 10 | Participants whose choices followed their values more closely, and whose choices the prediction named more "
          f"often, were more satisfied with their decisions and with how they reached them | VCI with decision satisfaction "
          f"rho = {no0(lk('VCI', 'Decision satisfaction')['rho'])}, with process satisfaction rho = "
          f"{no0(lk('VCI', 'Process satisfaction (DS2)')['rho'])}; prediction hit rate with decision satisfaction rho = "
          f"{no0(lk(HIT, 'Decision satisfaction')['rho'])}, with process satisfaction rho = {no0(lk(HIT, 'Process satisfaction (DS2)')['rho'])} "
          f"(raw p {apa(min(x['p'] for x in four))} to {apa(max(x['p'] for x in four))}; q = {apa(max(x['q'] for x in four))} "
          f"after correcting for the 21 correlations in P3) |", ""]
    # P1
    L += ["## P1. The prediction (the Moral Prediction Function, MPF) (post hoc)", "",
          "Scenarios 1-4: the prediction from the profile as each scenario opened (the registered C6 \"updated\" profile), "
          "computed for the analysis; participants did not see it. Scenario 6: the prediction shown after the first choice. "
          "\"Top two\" = the participant's first choice was one of the prediction's two most likely options.", "",
          "| Group | Measure | k / n | Rate [95% CI] | Chance | p (one-sided) | q |", "|---|---|---|---|---|---|---|"]
    L += [f"| {r['group']} | {r['measure']} | {r['k']} / {r['n']} | {pct(r['rate'], 1)} {pci(r['ci95'])} | {pct(r['chance'], 1)} | "
          f"{apa(r['p'])} | {apa(r['q'])} |" for r in h]
    L += ["", f"Note. p: exact binomial test against random choice (valid under random choice, where every pick is independent); "
          f"intervals: Clopper-Pearson, and a participant bootstrap (10,000) for all four decisions together. The registered "
          f"C2 used a bootstrap over participants for the top option (hit rate .28 [.23, .32]); C1 is the Scenario 6 top-option "
          f"row (34 of 107). The prediction's order is the study's own ranking (a tie broken by what the option delivers, then "
          f"by its id); its top option agrees with the registered hits for every decision: {R['P1']['top_pick_matches_the_stored_hits']}.", "",
          "**After seeing the prediction (Scenario 6).** "
          f"{a1['kept']} participants kept their first rule and {a1['changed']} changed it. Of the {a1['changed_from_another_rule']} "
          f"who changed from a rule the prediction had not named, {a1['moved_to_the_prediction']} moved to the rule it named "
          f"(a random switch would land there 1 time in 3; exact binomial p {apa(a1['p_vs_one_in_three'])}). The registration "
          "reports this (C5) as a description because fewer than 20 participants changed; the test here is post hoc.", "",
          "**\"Does this guess sound like how you decide?\" (1-7).** "
          f"All participants: M = {f(sl['mean_all'])}, {pct(sl['share_5_to_7_all'])} answered 5-7. When the prediction named "
          f"their rule: M = {f(sl['right']['mean'])}, median {f(sl['right']['median'], 0)}, {pct(sl['right']['share_5_to_7'])} "
          f"answered 5-7 (n = {sl['right']['n']}); when it named another rule: M = {f(sl['wrong']['mean'])}, median "
          f"{f(sl['wrong']['median'], 0)}, {pct(sl['wrong']['share_5_to_7'])} (n = {sl['wrong']['n']}). The registered C4 "
          "(this difference) is supported.", ""]
    su = R["P1"]["surprised"]
    L += [f"**\"Were you surprised by the guess?\"** {pct(su['share_surprised'])} said yes (n = {su['n']}): "
          f"{su['right_surprised']} of {su['right_n']} when it named their rule, {su['wrong_surprised']} of {su['wrong_n']} when it "
          f"named another (Fisher's exact p {apa(su['p_fisher'])}).", "",
          "**\"Sounds like me\" and the feedback scales (Spearman).**", "",
          "| With | n | rho [95% CI] | p | q |", "|---|---|---|---|---|"]
    L += [f"| {r['with']} | {r['n']} | {no0(r['rho'])} {rp.ci(r['ci95'], no0).strip()} | {apa(r['p'])} | {apa(r['q'])} |"
          for r in R["P1"]["sounds_like_me_links"]]
    # P2
    by = R["P2"]["by_company_value"]
    L += ["", "## P2. Scenarios 4 and 5: the company's value (post hoc)", "",
          "The employer's card put first the participant's lowest policy value (from the profile before the scenarios). "
          "Company values: " + ", ".join(f"{k} {v}" for k, v in R["P2"]["company_value_counts"].items()) + ".", "",
          "**What participants did with it in Scenario 4** (blind choosing: each participant picks one of their six options at "
          "random; each option placed by the study's own stance rule; exact one-sided Poisson-binomial test of \"fewer took the "
          "company's value\").", "", "| Company value | n | Held own (obs / exp) | Split (obs / exp) | Took company's (obs / exp) | p | q |",
          "|---|---|---|---|---|---|---|",
          f"| All | {ov['n']} | {ov['observed']['resisted']} / {ov['expected']['resisted']:.1f} | {ov['observed']['compromised']} / "
          f"{ov['expected']['compromised']:.1f} | {ov['observed']['adopted']} / {ov['expected']['adopted']:.1f} | "
          f"{apa(ov['p_fewer_took_the_company_value'])} | - |"]
    L += [f"| {r['company_value']} | {r['n']} | {r['observed']['resisted']} / {r['expected']['resisted']:.1f} | "
          f"{r['observed']['compromised']} / {r['expected']['compromised']:.1f} | {r['observed']['adopted']} / "
          f"{r['expected']['adopted']:.1f} | {apa(r['p_fewer_took_the_company_value'])} | {apa(r['q'])} |" for r in by]
    L += ["", f"**The wish (Scenario 5).** {w['same']} of {w['n']} participants ({pct(w['rate'])}, {pci(w['ci95'])}) wished for "
          f"the very option they had decided in Scenario 4; random choice gives 1 in 6 (exact binomial p {apa(w['p'])}). By "
          "stance: " + "; ".join(f"{k} {v['same']} of {v['n']}" for k, v in w["by_stance"].items()) +
          f" (chi-square p {apa(w['p_by_stance'])}). Scenario 5 came right after Scenario 4 and showed the same six options.", "",
          "**The stance and the feedback** (means by stance group; Kruskal-Wallis; and Spearman's rho with the pull toward "
          "the company, the distance to one's own values minus the distance to the company's).", "",
          "| Feedback | Held own | Split | Took company's | p (KW) | q | rho (pull) | p | q |", "|---|---|---|---|---|---|---|---|---|"]
    L += [f"| {r['outcome']} | {f(r['Held their own values'])} | {f(r['Split the difference'])} | {f(r[TOOK])} | "
          f"{apa(r['p'])} | {apa(r['q'])} | {no0(r['rho_pull'])} | {apa(r['p_rho'])} | {apa(r['q_rho'])} |" for r in R["P2"]["stance_and_feedback"]]
    # P3
    L += ["", "## P3. Well-being, decision satisfaction and process satisfaction (post hoc)", "",
          "All 107 participants; 1-7 scales (4 = the midpoint). One-sample Wilcoxon signed-rank test against 4 (two-sided), "
          "with the matched-pairs rank-biserial r.", "",
          "| Measure | n | M [95% CI] | SD | Median | Above 4 | Below 4 | p | q | r_rb |", "|---|---|---|---|---|---|---|---|---|---|"]
    L += [f"| {r['measure']} | {r['n']} | {f(r['mean'])} {ci(r['ci95'])} | {f(r['sd'])} | {f(r['median'], 1)} | {pct(r['share_above_4'])} | "
          f"{pct(r['share_below_4'])} | {apa(r['p'])} | {apa(r['q'])} | {no0(r['r_rb'])} |" for r in R["P3"]["descriptives"]]
    L += ["", "Note. Decision regret and cognitive burden are scored so that higher means more regret or more burden; the "
          "well-being composite reverses them (higher = better). Process satisfaction is item DS2: \"I am satisfied with the way "
          "I reached my decisions (the process).\"", "", "**By condition** (means; Kruskal-Wallis).", "",
          "| Measure | CVR+APA | CVR only | APA only | Baseline | p | q | epsilon-squared |", "|---|---|---|---|---|---|---|---|"]
    L += [f"| {r['measure']} | {f(r['CVR+APA'])} | {f(r['CVR_Only'])} | {f(r['APA_Only'])} | {f(r['Baseline'])} | {apa(r['p'])} | "
          f"{apa(r['q'])} | {f(r['epsilon_squared'], 3)} |" for r in R["P3"]["by_condition"]]
    L += ["", "**Behavior and feedback** (Spearman).", "", "| Behavior | Feedback | n | rho [95% CI] | p | q |", "|---|---|---|---|---|---|"]
    L += [f"| {r['behaviour']} | {r['feedback']} | {r['n']} | {no0(r['rho'])} {rp.ci(r['ci95'], no0).strip()} | {apa(r['p'])} | {apa(r['q'])} |"
          for r in R["P3"]["behaviour_links"]]
    L += ["", "Note. The registered D5 (value congruence rises with VCI) is the first row: rho = .18, one-sided p = .036, "
          "Holm-corrected p = .107 (not supported after the correction). VCI and the prediction's hit rate are partly made "
          "of the same choices (the prediction's top option is the option that fits the participant's values best), so their "
          "rows describe one pattern seen two ways rather than two independent findings."]
    # P4
    L += ["", "## P4. The feedback answers (post hoc)", "", "| Part | Item | n | M | Median | 5-7 | p (vs 4) | q | r_rb |",
          "|---|---|---|---|---|---|---|---|---|"]
    L += [f"| {r['section']} | {r['text']} | {r['n']} | {f(r['mean'])} | {f(r['median'], 1)} | {pct(r['share_5_to_7'])} | {apa(r['p'])} | "
          f"{apa(r['q'])} | {no0(r['r_rb'])} |" for r in R["P4"]["items"]]
    L += ["", "**Yes / no questions.**", "", "| Question | n | Yes |", "|---|---|---|"]
    L += [f"| {r['question']} | {r['n']} | {r['yes']} ({pct(r['share_yes'])}) |" for r in R["P4"]["yes_no"]]
    L += ["", f"Note. The reflection-step questions were answered by the {R['P4']['n_reflection']} participants who met a value "
          f"reflection, and the clarification-step questions by the {R['P4']['n_clarification']} who met a value clarification."]
    L += ["", "## Figures", ""] + [f"- `{name}`: *{title}*. {note}" for name, title, note in caps]
    (out / "EXPLORATORY_RESULTS_ROUND4.md").write_text("\n".join(L) + "\n", encoding="utf8")
    # captions
    md = ["# Figure captions, post hoc analyses for the CHIWORK paper (round 4)", ""] + [f"**{n_}**: *{t}*. Note. {nt}" for n_, t, nt in caps]
    (out / "figures").mkdir(parents=True, exist_ok=True)
    (out / "figures" / "figure_captions_round4.md").write_text("\n\n".join(md) + "\n", encoding="utf8")
    tex = ["% Post hoc figures for the CHIWORK paper (round 4). Each figure: \\includegraphics{figures/<name>.pdf}"]
    for n_, t, nt in caps:
        tex += [rf"% {n_}", r"\begin{figure}[htbp]", r"\centering", rf"\includegraphics[width=\linewidth]{{figures/{n_}.pdf}}",
                rf"\caption{{\textit{{{texq(rp.tex_escape(t))}}}}}", rf"\label{{fig:{n_}}}",
                rf"\par\smallskip{{\footnotesize \textit{{Note.}} {texq(rp.tex_escape(nt))}}}", r"\end{figure}", ""]
    (out / "figures" / "figure_captions_round4.tex").write_text("\n".join(tex), encoding="utf8")
    # APA tables
    T1 = rp.tex_table("How Often the Prediction Named the Participant's First Choice (Post Hoc)", "tab:posthoc_mpf",
                      ["Group", "Measure", "$k$ / $n$", "Rate [95\\% CI]", "Chance", "$p$", "$q$"],
                      [[r["group"], r["measure"], f"{r['k']} / {r['n']}", f"{100 * r['rate']:.1f}% {pci(r['ci95'])}", pct(r["chance"], 1),
                        apa(r["p"]), apa(r["q"])] for r in h],
                      "Post hoc. One-sided exact binomial tests against random choice; Benjamini-Hochberg q within the table. "
                      "Scenarios 1-4: the prediction from the profile as each scenario opened; Scenario 6: the prediction shown "
                      "after the first choice.", "llcccrr")
    T2 = rp.tex_table("The Company's Value in Scenario 4: Observed Against Blind Choosing (Post Hoc)", "tab:posthoc_company",
                      ["Company value", "$n$", "Held own", "Split", "Took company's", "$p$", "$q$"],
                      [["All", str(ov["n"])] + [f"{ov['observed'][s]} / {ov['expected'][s]:.1f}" for s in STANCE_WORDS]
                       + [apa(ov["p_fewer_took_the_company_value"]), "-"]]
                      + [[r["company_value"], str(r["n"])] + [f"{r['observed'][s]} / {r['expected'][s]:.1f}" for s in STANCE_WORDS]
                         + [apa(r["p_fewer_took_the_company_value"]), apa(r["q"])] for r in by],
                      "Post hoc. Observed / expected counts; expected: each participant picks one of their six options at random, "
                      "each option placed by the study's own stance rule. p: exact one-sided Poisson-binomial test of fewer "
                      f"taking the company's value. In Scenario 5, {w['same']} of {w['n']} wished for the option they had "
                      f"decided (1 in 6 by chance; p {apa(w['p'])}).", "lcccccc")
    T3 = rp.tex_table("Well-Being and Satisfaction Against the Scale Midpoint (Post Hoc)", "tab:posthoc_wellbeing",
                      ["Measure", "$M$ [95\\% CI]", "$SD$", "Above 4", "$p$", "$q$", "$r_{rb}$"],
                      [[r["measure"], f"{f(r['mean'])} {ci(r['ci95'])}", f(r["sd"]), pct(r["share_above_4"]), apa(r["p"]), apa(r["q"]),
                        no0(r["r_rb"])] for r in R["P3"]["descriptives"]],
                      f"Post hoc. n = {n}; 1-7 scales; one-sample Wilcoxon signed-rank tests against 4 (two-sided). Regret and "
                      "burden: higher = more; the composite reverses them.", "lcccrrr")
    T4 = rp.tex_table("Feedback on the Tools and the Help Steps (Post Hoc)", "tab:posthoc_feedback",
                      ["Item", "$n$", "$M$", "5--7", "$p$", "$q$"],
                      [[texq(f"{r['section']}: {r['text']}"), str(r["n"]), f(r["mean"]), pct(r["share_5_to_7"]), apa(r["p"]), apa(r["q"])]
                       for r in R["P4"]["items"]],
                      "Post hoc. 1-7 scales; one-sample Wilcoxon signed-rank tests against 4 (two-sided). The help-step items were "
                      "answered by the participants who met each step.", "p{0.55\\linewidth}crrrr")
    (out / "tables_apa_round4.tex").write_text("% Post hoc tables for the CHIWORK paper (round 4). Needs \\usepackage{booktabs,threeparttable}.\n\n"
                                               + "\n\n".join([T1, T2, T3, T4]) + "\n", encoding="utf8")


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    data, out = Path(argv[1]), Path(argv[2])
    opt = lambda name: argv[argv.index(name) + 1] if name in argv else None   # noqa: E731
    sim = "--simulated" in argv
    out.mkdir(parents=True, exist_ok=True)
    figs = out / "figures"
    docs = bt.load_records(data)
    T = bt.build(docs)
    keep = set(T["P"]["pid"])
    docs = [d for d in docs if str(d.get("prolific_pid")) in keep]
    X = person_frame(T, docs)
    registered = json.loads(Path(opt("--registered")).read_text(encoding="utf8")) if opt("--registered") else None
    fg.CAPTIONS.clear()
    caps = []
    R = {"P1": p1(T, X, registered, figs, sim, caps, docs), "P2": p2(T, docs, X, figs, sim, caps), "P3": p3(X, figs, sim, caps),
         "P4": p4(X, figs, sim, caps)}
    import pipeline as pl
    R = pl.to_jsonable(R)
    (out / "posthoc_results_round4.json").write_text(json.dumps(R, indent=1), encoding="utf8")
    write_outputs(R, out, sim, len(keep), caps)
    print(f"Post hoc round 4: {len(caps)} figures, {len(keep)} participants -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
