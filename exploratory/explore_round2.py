"""explore_round2.py: the EXPLORATORY analyses, round 2 (Tier B: the analysis plan's further analyses) (17 November 2026).

PLAN_Exploratory_analysis.md section 2.2, approved ("D1-A ...") and started on Waseem's "start round 2". The same rules as
round 1 (explore.py): every result labelled exploratory, 95% intervals, raw p and Benjamini-Hochberg q within each analysis,
nothing dropped, order and content named where they could explain a pattern, a link built into the scores named as such.

Changed from the analysis plan, as the approved plan states: the path model (5.5) is reported as the regressions only, the
latent classes (3.5) as counts of choice patterns, the mixed ordinal model of Block 3 (4B) as its two Wilcoxon contrasts (in
round 1) with the heat map; in a conditional logit, scenario terms cancel within each choice set, so the choice model has no
scenario fixed effects; "fast against considered" uses a logistic regression with participant-clustered errors.

Run:
  analysis\\.venv\\Scripts\\python.exe exploratory\\explore_round2.py <participants_ai_safe.json> <output folder> \\
      --kinds <pretend_kinds.json> [--null <null folder>] [--simulated]
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
sys.path.insert(0, str(HERE))
import explore as ex               # noqa: E402  (round 1's tools; it also loads the frozen modules, read-only)
from explore import bt, rt, st, rp, fg, plt, CONDITIONS, POLICY, VALUE_COLOR   # noqa: E402

SEVEN = POLICY + ["directnessSensitivity", "contextSensitivity", "stakeholderPerspectiveShiftSensitivity"]
SUBSCALES = ["learningInsight", "decisionSatisfaction", "decisionRegret", "valueCongruence", "decisionConfidence",
             "cognitiveBurden", "perceivedSupport", "overallWellbeing", "wellbeingComposite"]
get = bt.get


def wrapped(v):
    return v.get("answer") if isinstance(v, dict) else v


def cohen_kappa(a, b) -> float:
    """Cohen's kappa for two categorical ratings of the same items."""
    a, b = pd.Series(list(a)).astype(str), pd.Series(list(b)).astype(str)
    if len(a) == 0:
        return float("nan")
    po = float((a.values == b.values).mean())
    cats = sorted(set(a) | set(b))
    pe = sum(float((a == c).mean()) * float((b == c).mean()) for c in cats)
    return float("nan") if pe == 1 else (po - pe) / (1 - pe)


# ------------------------------------------------------------------------------------------------- one row per person
def person_frame(T, docs, menus):
    """Everything the round-2 analyses read, one row per participant, from the tables and the saved records."""
    P, S = T["P"].set_index("pid"), T["S"]
    rows = []
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid not in P.index:
            continue
        p = P.loc[pid]
        b5 = get(d, "blocks.block5_emergency_scenarios") or {}
        res = b5.get("scenarioResults") or []
        tel = [r.get("telemetry") or {} for r in res]
        dims = {x.get("key"): x.get("score") for x in (get(b5, "originalProfile.dimensions") or [])}
        u0 = {k: float(dims[k]) for k in POLICY} if all(isinstance(dims.get(k), (int, float)) for k in POLICY) else None
        fb = get(d, "blocks.feedback_answers.feedback") or {}
        wb = fb.get("wellbeing") or {}
        sub = wb.get("subscales") or {}
        s_me = S[S["pid"] == pid]
        dec = s_me[s_me["decision"]]
        fit_frozen = [menus.fit(u0, menus.option[(r["scenario_id"], r["final_id"])]) for _, r in dec.iterrows()] if u0 else []
        endorse = [r.get("cvrEndorsement") for r in res if r.get("cvrEndorsement") in ("strong", "weak")]
        vpc = get(d, "analysis.value_profile_change") or {}
        dvw = get(d, "analysis.position_effect.decided_versus_wished") or {}
        dep = s_me.set_index("order")["departure"]
        row = {
            "pid": pid, "condition": p["condition"], "age": p["age"], "gender3": p["gender3"], "active_minutes": p["active_minutes"],
            "vci": p["vci"], "stability": p["stability"], "stability_measured": p["stability_measured"], "performance": p["performance"],
            "wish_gap": p["wish_gap"], "wish_differs": dvw.get("wished_for_the_same_option") is False,
            "receiving_minus_employer": float(dep.get(5) - dep.get(4)) if 4 in dep and 5 in dep else np.nan,
            "mpf_hit_rate": float(dec["mpf_hit_first_updated"].astype(float).mean()) if len(dec) else np.nan,
            "reflection_visits": float(sum(t.get("cvrVisits", 0) or 0 for t in tel)),
            "clarification_visits": float(sum(t.get("apaVisits", 0) or 0 for t in tel)),
            "switches": float(sum(t.get("numberOfSwitches", 0) or 0 for t in tel)),
            "mcf_readings": float(sum(r.get("readings_opened", 0) or 0 for r in get(d, "analysis.mcf.by_scenario") or [])),
            "value_change_size": float(sum(abs(v) for v in vpc.values() if isinstance(v, (int, float)))),
            "first_card_share": float((s_me[s_me["order"] <= 5]["card_position_first"] == 1).mean()),
            "seconds_to_first_pick": float(np.median([t.get("timeToFirstSelectionMs") for t in tel if t.get("timeToFirstSelectionMs") is not None]) / 1000)
            if any(t.get("timeToFirstSelectionMs") is not None for t in tel) else np.nan,
            "strong_endorsement_share": float(np.mean([e == "strong" for e in endorse])) if endorse else np.nan,
            "help_page_seconds": float(sum((t.get("cvrDwellMs", 0) or 0) + (t.get("apaDwellMs", 0) or 0) for t in tel) / 1000),
            "preview_opens": float(sum(t.get("previewImpactOpens", 0) or 0 for t in tel)),
            "tool_preview_rating": wrapped((fb.get("decisionSupport") or {}).get("TOOL_previewImpact")),
            "cvr_said_changed": wrapped((fb.get("cvr") or {}).get("CVR_changed")),
            "any_change_after_reflection": any(bool(get(a, "cvr.changed_their_choice")) for a in get(d, "analysis.alignment_records.by_scenario") or []),
            "changed_after_page": float((dec["first_misfit"] & dec["page_opened"] & dec["changed"]).sum()),
            "s6_changed": p["s6_changed"],
            "fit_frozen_mean": float(np.mean(fit_frozen)) if fit_frozen else np.nan,
            **{f"u0_{k}": dims.get(k) for k in SEVEN},
            **{f"vpc_{k}": vpc.get(k) for k in SEVEN},
            **{f"fb_{k}": (wb.get(k) if k == "wellbeingComposite" else sub.get(k)) for k in SUBSCALES},
            "fb_lowDecisionRegret": sub.get("lowDecisionRegret"),
        }
        rows.append(row)
    return pd.DataFrame(rows)


# ------------------------------------------------------------------------------------------------- B1-B6
def b1(T, docs, menus):
    """Principle against practice: the veil rule chosen before the prediction against the #1 value before the scenarios, and
    against the value most of the four decisions were built on (Cohen's kappa)."""
    S = T["S"]
    keep = set(T["P"]["pid"])
    rows = []
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid not in keep:
            continue
        dims = {x.get("key"): x.get("score") for x in (get(d, "blocks.block5_emergency_scenarios.originalProfile.dimensions") or [])}
        top = max(POLICY, key=lambda k: (dims.get(k, -1)))
        s = S[S["pid"] == pid]
        rule = s.loc[s["order"] == 6, "first_id"]
        if rule.empty:
            continue
        built = [menus.option[(r["scenario_id"], r["final_id"])]["built_on"] for _, r in s[s["decision"]].iterrows()]
        counts = pd.Series(built).value_counts()
        mode = counts.index[0] if len(counts) and (len(counts) == 1 or counts.iloc[0] > counts.iloc[1]) else None
        rows.append({"rule_value": menus.option[("veil_emergency_reserve_rule", rule.iloc[0])]["built_on"], "top_before": top,
                     "decisions_mode": mode})
    R = pd.DataFrame(rows)
    out = {"id": "B1", "n": int(len(R))}
    for col, lab in (("top_before", "the #1 value before the scenarios"), ("decisions_mode", "the value most decisions were built on")):
        sub = R.dropna(subset=[col])
        agree = float((sub["rule_value"] == sub[col]).mean()) if len(sub) else float("nan")
        out[col] = {"against": lab, "n": int(len(sub)), "agreement": agree, "ci95": ex.cp(int((sub["rule_value"] == sub[col]).sum()), len(sub)),
                    "kappa": cohen_kappa(sub["rule_value"], sub[col]), "chance_agreement": 0.25}
    return out


def b2(T, docs):
    """Crossing one's own red line, by scenario; trading away the #1 value, by scenario (Cochran's Q over Scenarios 1-5)."""
    from statsmodels.stats.contingency_tables import cochrans_q
    keep = set(T["P"]["pid"])
    rows = []
    for d in docs:
        pid = str(d.get("prolific_pid"))
        if pid in keep:
            for i, r in enumerate(get(d, "blocks.block5_emergency_scenarios.scenarioResults") or []):
                rows.append({"pid": pid, "order": i + 1, "crossed": bool(r.get("choiceCrossedOwnRedLine")),
                             "traded": bool(r.get("choiceUsedTradeOff"))})
    R = pd.DataFrame(rows)
    out = {"id": "B2"}
    tests = []
    for col in ("crossed", "traded"):
        by = {int(o): {"k": int(g[col].sum()), "n": int(len(g)), "share": float(g[col].mean()), "ci95": ex.cp(int(g[col].sum()), len(g))}
              for o, g in R[R["order"] <= 5].groupby("order")}
        w = R[R["order"] <= 5].pivot_table(index="pid", columns="order", values=col, aggfunc="first").dropna().astype(int)
        q = cochrans_q(w.to_numpy()) if w.to_numpy().sum() else None
        out[col] = by
        tests.append({"what": f"{'red line crossed' if col == 'crossed' else '#1 value traded away'}: differs across Scenarios 1-5 (Cochran's Q)",
                      "p": float(q.pvalue) if q is not None else float("nan"), "statistic": float(q.statistic) if q is not None else float("nan")})
    for t, q in zip(tests, ex.fdr([t["p"] for t in tests])):
        t["q"] = q
    out["tests"] = tests
    return out


def b3(X, docs):
    """Which way Block 5 moved people: the mean change of each value (one-sample Wilcoxon, FDR), how many people it changed for,
    and, from every saved value move of Scenarios 1-4, how often each value was asked to move and how often it could."""
    asked, made = {}, {}
    for d in docs:
        for r in (get(d, "blocks.block5_emergency_scenarios.scenarioResults") or [])[:4]:
            for mv in r.get("valueMoves") or []:
                k = mv.get("value")
                if mv.get("requested"):
                    asked[k] = asked.get(k, 0) + 1
                    made[k] = made.get(k, 0) + (1 if mv.get("applied") else 0)
    rows = []
    for k in SEVEN:
        v = X[f"vpc_{k}"].astype(float).to_numpy() if f"vpc_{k}" in X else None
        if v is None:
            continue
        m, c = ex.boot_mean(v, f"B3:{k}")
        r = st.signed_rank(v, "unused", "two-sided", boot=False)
        rows.append({"value": k, "label": VALUE_LABEL.get(k, k), "mean_change": m, "ci95": c, "p": r.get("p"),
                     "changed_for": int((v != 0).sum()), "n": int(len(v)), "moves_asked": asked.get(k, 0), "moves_made": made.get(k, 0)})
    for r, q in zip(rows, ex.fdr([r["p"] for r in rows])):
        r["q"] = q
    return {"id": "B3", "rows": rows}


def b4(T, docs):
    """Fast first picks against considered ones: first pick Aligned or Weakly aligned ~ log seconds to the first selection
    (logistic regression, participant-clustered errors), decisions 1-4."""
    import statsmodels.api as sm
    S = T["S"]
    secs = {}
    for d in docs:
        for r in get(d, "blocks.block5_emergency_scenarios.scenarioResults") or []:
            ms = (r.get("telemetry") or {}).get("timeToFirstSelectionMs")
            secs[(str(d.get("prolific_pid")), r.get("scenarioId"))] = ms / 1000 if ms else np.nan
    dec = S[S["decision"]].copy()
    dec["sec"] = [secs.get((p, s), np.nan) for p, s in zip(dec["pid"], dec["scenario_id"])]
    dec = dec.dropna(subset=["sec", "first_label"])
    dec = dec[dec["sec"] > 0]
    y = dec["first_label"].isin(["aligned", "weakly_aligned"]).astype(float)
    X = sm.add_constant(np.log(dec[["sec"]]).rename(columns={"sec": "log_seconds"}))
    f = sm.Logit(y, X).fit(disp=0, maxiter=200, cov_type="cluster", cov_kwds={"groups": pd.factorize(dec["pid"])[0]})
    if not f.mle_retvals.get("converged", False):
        raise RuntimeError("B4: the logistic regression did not converge")
    b, se = float(f.params["log_seconds"]), float(f.bse["log_seconds"])
    q = dec["sec"].quantile([0.25, 0.5, 0.75]).to_dict()
    thirds = pd.qcut(dec["sec"], 3, labels=["fastest third", "middle third", "slowest third"])
    share = y.groupby(thirds, observed=True).mean().to_dict()
    return {"id": "B4", "decisions": int(len(dec)), "odds_ratio_per_doubling": math.exp(b * math.log(2)),
            "ci95": [math.exp((b - 1.959964 * se) * math.log(2)), math.exp((b + 1.959964 * se) * math.log(2))],
            "p": float(f.pvalues["log_seconds"]), "seconds_quartiles": q, "good_fit_first_pick_share_by_speed": share}


def b5(docs, keep):
    c = pd.Series([get(d, "analysis.results_page.first_button_used") for d in docs if str(d.get("prolific_pid")) in keep]).value_counts(dropna=False)
    return {"id": "B5", "first_button_used": {str(k): int(v) for k, v in c.items()}}


def b6(T, X):
    """Age and gender as moderators of the four supported results (A4, C4, C6, C7). Gender: female against male (the one
    participant in the third category cannot carry an interaction and is left out of the gender models)."""
    import statsmodels.api as sm
    S, O = T["S"], T["O"]
    Xi = X.set_index("pid")
    z = lambda s: (s - s.mean()) / s.std(ddof=1)   # noqa: E731
    age_z = z(Xi["age"].astype(float))
    male = (Xi["gender3"] == "male").astype(float)
    fm = Xi["gender3"].isin(["female", "male"])
    tests = []
    # A4: good final fit ~ help * moderator (participant-clustered logistic)
    dec = S[S["decision"] & S["first_misfit"]].copy()
    dec["help"] = dec["condition"].isin(["CVR+APA", "CVR_Only", "APA_Only"]).astype(float)
    no_help = dec[dec["help"] == 0]
    k0 = int(no_help["final_good_fit"].astype(bool).sum())
    a4_note = (f"the {len(no_help)} decisions without a help page hold {k0} change{'' if k0 == 1 else 's'} to a good fit, so a "
               "moderator of A4 rests on very few events") if k0 < 5 else ""
    for mod, ser, keep in (("age", age_z, None), ("gender (male)", male, fm)):
        dd = dec if keep is None else dec[dec["pid"].map(keep).fillna(False)]
        m = dd["pid"].map(ser).astype(float)
        y = dd["final_good_fit"].astype(float)
        # A cell of help x gender with no event (or no non-event) separates the data: the interaction then has no finite
        # estimate, and a Wald p-value from it is meaningless. Checked before fitting, and the fit must converge.
        empty = []
        if keep is not None:
            for h in (0.0, 1.0):
                for g in (0.0, 1.0):
                    cell = y[(dd["help"] == h) & (m == g)]
                    if len(cell) and (cell.sum() == 0 or cell.sum() == len(cell)):
                        k = int(cell.sum())
                        empty.append(f"{'male' if g else 'female'} participants {'with' if h else 'without'} a help page: "
                                     f"{k} change{'' if k == 1 else 's'} to a good fit in {len(cell)} decisions")
        if empty:
            tests.append({"result": "A4", "moderator": mod, "p": float("nan"),
                          "note": "not estimable (separation): " + "; ".join(empty)})
            continue
        Xm = sm.add_constant(pd.DataFrame({"help": dd["help"], "mod": m, "help_x_mod": dd["help"] * m}))
        f = sm.Logit(y, Xm).fit(disp=0, maxiter=200, cov_type="cluster", cov_kwds={"groups": pd.factorize(dd["pid"])[0]})
        if not f.mle_retvals.get("converged", False):
            tests.append({"result": "A4", "moderator": mod, "p": float("nan"), "note": "not estimable: the fit did not converge"})
            continue
        tests.append({"result": "A4", "moderator": mod, "interaction": float(f.params["help_x_mod"]), "p": float(f.pvalues["help_x_mod"]),
                      **({"note": a4_note} if a4_note else {})})
    # C4: rating ~ hit * moderator (OLS, HC3)
    P = T["P"].set_index("pid")
    c4 = P.dropna(subset=["s6_hit", "s6_sounds_like_me"])
    for mod, ser, keep in (("age", age_z, None), ("gender (male)", male, fm)):
        cc = c4 if keep is None else c4[keep.reindex(c4.index).fillna(False)]
        hit = cc["s6_hit"].astype(float)
        m = ser.reindex(cc.index).astype(float)
        f = sm.OLS(cc["s6_sounds_like_me"].astype(float), sm.add_constant(pd.DataFrame({"hit": hit, "mod": m, "hit_x_mod": hit * m}))).fit(cov_type="HC3")
        tests.append({"result": "C4", "moderator": mod, "interaction": float(f.params["hit_x_mod"]), "p": float(f.pvalues["hit_x_mod"])})
    # C6: the per-participant log-loss difference ~ moderator (OLS, HC3)
    s24 = S[S["order"].isin([2, 3, 4])].dropna(subset=["mpf_p_first_updated", "mpf_p_first_before"])
    diff = (-np.log(s24["mpf_p_first_updated"].astype(float)) + np.log(s24["mpf_p_first_before"].astype(float))).groupby(s24["pid"]).mean()
    for mod, ser, keep in (("age", age_z, None), ("gender (male)", male, fm)):
        dd = diff if keep is None else diff[keep.reindex(diff.index).fillna(False)]
        f = sm.OLS(dd.astype(float), sm.add_constant(ser.reindex(dd.index).astype(float).rename("mod"))).fit(cov_type="HC3")
        tests.append({"result": "C6", "moderator": mod, "interaction": float(f.params["mod"]), "p": float(f.pvalues["mod"])})
    # C7: the fit coefficient * moderator (conditional logit)
    c7 = O.dropna(subset=["position", "captured", "fit_before"])
    c7 = c7[(c7.groupby("stratum")["chosen"].transform("sum") == 1) & (c7.groupby("stratum")["option_id"].transform("size") == 6)]
    pos = pd.get_dummies(c7["position"].astype(int), prefix="position").reindex(columns=[f"position_{k}" for k in range(2, 7)], fill_value=0).astype(float)
    for mod, ser, keep in (("age", age_z, None), ("gender (male)", male, fm)):
        cc = c7 if keep is None else c7[c7["pid"].map(keep).fillna(False)]
        pp = pos.loc[cc.index]
        m = cc["pid"].map(ser).astype(float).to_numpy()
        Xc = np.column_stack([pp.to_numpy(), cc["captured"].to_numpy(float), cc["fit_before"].to_numpy(float), cc["fit_before"].to_numpy(float) * m])
        r = st.conditional_logit(Xc, cc["chosen"].to_numpy(), cc["stratum"].to_numpy(), cc["pid"].to_numpy())
        b, se = float(r["beta"][-1]), float(r["se_clustered"][-1])
        tests.append({"result": "C7", "moderator": mod, "interaction": b, "p": float(2 * stats.norm.sf(abs(b / se)))})
    for t, q in zip(tests, ex.fdr([t["p"] for t in tests])):
        t["q"] = q
    return {"id": "B6", "tests": tests, "gender_models_leave_out": int((~fm).sum())}


# ------------------------------------------------------------------------------------------------- B7-B12
def b7(X, kinds, out, sim, caps):
    """Real participants against the pretend kinds of chooser (catalog Figure 2)."""
    measures = (("vci", "Value Consistency Index", "vci"), ("stability", "Stability (tested only)", "stability_measured"),
                ("performance", "Performance captured", "performance"))
    pick = ["Always aligned", "True to top value", "Random responder", "Flip-flopper (keeps)", "Always the worst fit"]
    fig, axes = plt.subplots(1, 3, figsize=(fg.WIDTH, 3.3), sharey=False)
    summary = {}
    for ax, (col, lab, kcol) in zip(axes, measures):
        real = X[col].astype(float)
        if col == "stability":
            real = real[X["stability_measured"] == True]   # noqa: E712
        ax.boxplot([real.dropna()], positions=[0], widths=0.5, showfliers=False, medianprops={"color": fg.INK, "lw": 2})
        ax.scatter(fg._jitter(len(real.dropna()), 7, 0.15), real.dropna(), s=6, color=fg.ACCENT, alpha=0.5, linewidths=0)
        meds = {}
        for i, kname in enumerate(pick):
            kv = kinds["conditions"]["CVR+APA"][kname][kcol]
            if kv["median"] is None:
                ax.text(i + 1, np.nanmedian(real), "never\ntested", ha="center", va="center", fontsize=7, color=fg.INK2)
                meds[kname] = None
                continue
            ax.errorbar(i + 1, kv["median"], yerr=[[kv["median"] - kv["q1"]], [kv["q3"] - kv["median"]]], fmt="s", color=fg.INK2, ms=4, capsize=2)
            meds[kname] = kv["median"]
        ax.set_xticks(range(len(pick) + 1), ["Real"] + [k.replace(" (keeps)", "").replace("Always the worst fit", "Worst fit").replace("True to top value", "Top value") for k in pick],
                      rotation=45, ha="right", fontsize=7.5)
        ax.set_title(lab, fontsize=9)
        summary[col] = {"real_median": float(real.median()), "pretend_medians_cvr_apa": meds}
    ex.save(fig, out, "xfig_B7_real_against_pretend_kinds", sim, "Real Participants Beside Pretend Kinds of Chooser",
            "Blue dots and box: real participants (all conditions). Grey squares with bars: the median and middle half of 2,000 "
            "pretend people of each kind, made by the study's own code in the CVR + APA condition (docs/MAJOR_SCORES_BY_CONDITION.md). "
            "Pretend kinds are a ruler, not data.", caps)
    return {"id": "B7", "summary": summary}


MAP_VARS = ["vci", "stability", "performance", "receiving_minus_employer", "wish_gap", "mpf_hit_rate", "reflection_visits",
            "clarification_visits", "switches", "mcf_readings", "active_minutes", "value_change_size"] + \
           [f"u0_{k}" for k in SEVEN] + [f"fb_{k}" for k in SUBSCALES if k != "wellbeingComposite"]
VALUE_LABEL = {"vulnerabilityProtectionSensitivity": "Protecting the vulnerable", "groupSizeSensitivity": "Reducing harm",
               "gainResponsivenessSensitivity": "How much is gained", "outcomeAggregationSensitivity": "How many are helped",
               "directnessSensitivity": "Doing it yourself", "contextSensitivity": "Where it happens",
               "stakeholderPerspectiveShiftSensitivity": "Hearing someone's story"}
LABEL = {"vci": "VCI", "stability": "Stability", "performance": "Performance", "receiving_minus_employer": "Receiving minus employer",
         "wish_gap": "Wish gap", "mpf_hit_rate": "Prediction hit rate", "reflection_visits": "Reflection visits",
         "clarification_visits": "Clarification visits", "switches": "Switches", "mcf_readings": "MCF readings",
         "active_minutes": "Active minutes", "value_change_size": "Value change size",
         **{f"u0_{k}": v for k, v in VALUE_LABEL.items()},
         "fb_learningInsight": "Learning insight", "fb_decisionSatisfaction": "Decision satisfaction",
         "fb_decisionRegret": "Decision regret", "fb_valueCongruence": "Value congruence",
         "fb_decisionConfidence": "Decision confidence", "fb_cognitiveBurden": "Cognitive burden",
         "fb_perceivedSupport": "Perceived support", "fb_overallWellbeing": "Overall well-being"}
SELF_REPORT = {"valueCongruence": "Value congruence", "decisionConfidence": "Decision confidence",
               "cognitiveBurden": "Cognitive burden", "learningInsight": "Learning insight", "perceivedSupport": "Perceived support",
               "decisionRegret": "Decision regret", "decisionSatisfaction": "Decision satisfaction",
               "overallWellbeing": "Overall well-being", "tool_preview_rating": "Preview tool rating"}
BEHAVIOUR = {"vci": "VCI", "fit_frozen_mean": "Fit to the values brought into the scenarios", "seconds_to_first_pick":
             "Seconds to the first pick", "switches": "Option changes", "strong_endorsement_share": "Share of firm keeps",
             "active_minutes": "Active minutes", "reflection_visits": "Reflections met", "help_page_seconds": "Time on help pages",
             "value_change_size": "Values moved", "clarification_visits": "Clarifications met",
             "first_card_share": "Share of first-card picks", "changed_after_page": "Changes after a help page",
             "preview_opens": "Preview opened", "wish differs from the decision (Mann-Whitney)":
             "Wish differs from the decision (Mann-Whitney)"}
# the scoring's names for the seven values (analysis.participant_record.derived.thresholdTree) against Block 5's
TREE_KEY = {"vulnerability_protection": "vulnerabilityProtectionSensitivity", "group_size": "groupSizeSensitivity",
            "gain_responsiveness": "gainResponsivenessSensitivity", "outcome_aggregation": "outcomeAggregationSensitivity",
            "directness": "directnessSensitivity", "context": "contextSensitivity", "stakeholder_shift": "stakeholderPerspectiveShiftSensitivity"}
VALUE_BLOCKS: dict = {}          # filled from the records by value_blocks(): the blocks whose answers feed each value
MISFIT_FAMILY = {"vci", "stability", "mpf_hit_rate", "value_change_size", "reflection_visits", "clarification_visits"}


def value_blocks(docs):
    """Which blocks' answers feed each of the seven values, read from the scoring's own record of every contribution."""
    out = {}
    for d in docs:
        for dim in get(d, "analysis.participant_record.derived.thresholdTree.dimensions") or []:
            k = TREE_KEY.get(dim.get("key"))
            if k:
                out.setdefault(k, set()).update(c.get("block") for c in dim.get("contributions") or [] if c.get("block"))
    return out


def built_in(a, b):
    """Why two measures are partly linked by how they are made (None when they are not): named, never hidden."""
    s = {a, b}
    if s <= MISFIT_FAMILY:
        return "both follow choices that depart from the best fit"
    if s in ({"switches", "reflection_visits"}, {"switches", "clarification_visits"}):
        return "leaving a help page counts as a switch"
    if s == {"receiving_minus_employer", "wish_gap"}:
        return "both are 0 when the wish is the decision"
    if s == {"vci", "performance"}:
        return "the options trade values against performance"
    if a.startswith("u0_") and b.startswith("u0_"):
        shared = VALUE_BLOCKS.get(a[3:], set()) & VALUE_BLOCKS.get(b[3:], set())
        if shared:
            return "computed partly from the same answers (" + ", ".join(sorted(shared)) + ")"
    return None


def spearman_matrix(X):
    cols = [c for c in MAP_VARS if c in X and X[c].astype(float).std() > 0]
    out = []
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            d = X[[a, b]].astype(float).dropna()
            if len(d) > 5:
                r = stats.spearmanr(d[a], d[b])
                why = built_in(a, b)
                out.append({"a": a, "b": b, "rho": float(r.statistic), "p": float(r.pvalue), "n": int(len(d)),
                            "by_construction": why is not None, "why_linked": why})
    return out


def b8(X, null_X, out, sim, caps):
    """The correlation map (Spearman, FDR), with the links built into the scores marked, and each correlation beside its value
    among pretend random choosers made by the study's own code."""
    pairs = spearman_matrix(X)
    for p, q in zip(pairs, ex.fdr([p["p"] for p in pairs])):
        p["q"] = q
    if null_X is not None and len(null_X) > 10:
        nul = {frozenset((p["a"], p["b"])): p["rho"] for p in spearman_matrix(null_X)}
        for p in pairs:
            p["rho_pretend_random"] = nul.get(frozenset((p["a"], p["b"])))
    cols = [c for c in MAP_VARS if c in X and X[c].astype(float).std() > 0]
    n = len(cols)
    M = np.full((n, n), np.nan)               # the lower triangle only: each pair once
    idx = {c: i for i, c in enumerate(cols)}
    for p in pairs:
        i, j = max(idx[p["a"]], idx[p["b"]]), min(idx[p["a"]], idx[p["b"]])
        M[i, j] = p["rho"]
    fig, ax = plt.subplots(figsize=(fg.WIDTH, fg.WIDTH * 0.98))
    ax.grid(False)
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list("div", ["#2a78d6", "#f4f4f4", "#eb6834"])
    cmap.set_bad("white")
    im = ax.imshow(np.ma.masked_invalid(M), cmap=cmap, vmin=-1, vmax=1)
    for p in pairs:
        if p["q"] < 0.05:
            i, j = max(idx[p["a"]], idx[p["b"]]), min(idx[p["a"]], idx[p["b"]])
            v = round(p["rho"] * 100)          # rho x 100: two digits fit a cell of this map
            ax.text(j, i, f"{abs(v)}" if v >= 0 else f"\u2212{abs(v)}", ha="center", va="center", fontsize=5.3,
                    color=fg.INK, fontstyle="italic" if p["by_construction"] else "normal",
                    fontweight="normal" if p["by_construction"] else "bold")
    groups = [sum(1 for c in cols if not c.startswith(("u0_", "fb_"))), sum(1 for c in cols if c.startswith("u0_"))]
    for e in (groups[0], groups[0] + groups[1]):   # the group lines, inside the triangle only
        ax.plot([-0.5, e - 0.5], [e - 0.5, e - 0.5], color=fg.INK2, lw=0.6)
        ax.plot([e - 0.5, e - 0.5], [e - 0.5, n - 0.5], color=fg.INK2, lw=0.6)
    ax.set_xticks(range(n), [LABEL.get(c, c) for c in cols], rotation=90, fontsize=6.5)
    ax.set_yticks(range(n), [LABEL.get(c, c) for c in cols], fontsize=6.5)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    cax = ax.inset_axes([0.52, 0.90, 0.44, 0.025])     # the colour key, in the empty upper triangle
    cb = fig.colorbar(im, cax=cax, orientation="horizontal", ticks=[-1, -0.5, 0, 0.5, 1])
    cb.ax.tick_params(labelsize=6.5)
    cb.ax.set_xticklabels(["\u22121", "\u2212.5", "0", ".5", "1"])
    cb.ax.set_title("Spearman's rho", fontsize=7.5, pad=3)
    ax.text(0.96, 0.80, "Numbers: rho \u00d7 100, where q < .05\nbold: a link found in the data\nitalic: partly built into the measures",
            transform=ax.transAxes, ha="right", va="top", fontsize=6.5, color=fg.INK2, linespacing=1.4)
    ex.save(fig, out, "xfig_B8_correlation_map", sim, "How the Measures Relate",
            "Spearman correlations over participants, each pair once; the number (rho x 100) is printed where the FDR q-value is "
            "below .05: bold for a link found in the data, italic for a link partly built into how the two measures are made "
            "(for example, VCI and the prediction's hit rate both follow choices that depart from the best fit). The lines "
            "divide the scenario measures, the seven values brought into the scenarios, and the feedback scales.", caps)
    return {"id": "B8", "pairs": pairs, "n_pairs": len(pairs)}


def b9(T, docs, out, sim, caps):
    """The choice model, extended: position, performance, fit, and whether the option's comparison reading was opened; nested
    models by likelihood ratio and AIC."""
    O = T["O"].copy()
    read = {}
    for d in docs:
        pid = str(d.get("prolific_pid"))
        for r in get(d, "analysis.mcf.by_scenario") or []:
            for oid in r.get("options_read") or []:
                read[(pid, r.get("scenario_id"), oid)] = 1
    O["mcf_opened"] = [read.get((p, s, o), 0) for p, s, o in zip(O["pid"], O["scenario_id"], O["option_id"])]
    O = O.dropna(subset=["position", "captured", "fit_before"])
    O = O[(O.groupby("stratum")["chosen"].transform("sum") == 1) & (O.groupby("stratum")["option_id"].transform("size") == 6)]
    pos = pd.get_dummies(O["position"].astype(int), prefix="position").reindex(columns=[f"position_{k}" for k in range(2, 7)], fill_value=0).astype(float)
    # performance and fit per 10 points (0-100 scales), so their odds ratios read on the same page as the others; scaling a
    # column changes no log-likelihood, AIC or likelihood-ratio test
    blocks = {"position": pos.to_numpy(), "performance": O[["captured"]].to_numpy(float) / 10, "fit": O[["fit_before"]].to_numpy(float) / 10,
              "MCF reading opened": O[["mcf_opened"]].to_numpy(float)}
    models, prev = [], None
    names = []
    for step in ("position", "performance", "fit", "MCF reading opened"):
        names = names + ([f"position {k}" for k in range(2, 7)] if step == "position" else [step])
        order = ("position", "performance", "fit", "MCF reading opened")
        Xs = np.column_stack([blocks[s] for s in order[: order.index(step) + 1]])
        if Xs[:, -1].std() == 0:
            models.append({"model": f"+ {step}", "note": "no variation: not estimable"})
            continue
        r = st.conditional_logit(Xs, O["chosen"].to_numpy(), O["stratum"].to_numpy(), O["pid"].to_numpy())
        k = Xs.shape[1]
        m = {"model": ("" if step == "position" else "+ ") + step, "loglik": r["loglik"], "aic": 2 * k - 2 * r["loglik"], "k": k,
             "coefficients": {n: {"odds_ratio": math.exp(b), "ci95": [math.exp(b - 1.959964 * s), math.exp(b + 1.959964 * s)]}
                              for n, b, s in zip(names, r["beta"], r["se_clustered"])}}
        if prev is not None:
            lr = 2 * (r["loglik"] - prev["loglik"])
            m.update({"lr_against_previous": lr, "p": float(stats.chi2.sf(lr, k - prev["k"]))})
        models.append(m)
        prev = m
    last = [m for m in models if "coefficients" in m][-1]
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.75, 3.2))
    items = list(last["coefficients"].items())
    for i, (n, c) in enumerate(items):
        ax.errorbar(c["odds_ratio"], i, xerr=[[c["odds_ratio"] - c["ci95"][0]], [c["ci95"][1] - c["odds_ratio"]]], fmt="o", color=fg.ACCENT, ms=4, capsize=2)
    ax.axvline(1, color=fg.INK2, lw=0.8)
    ax.set_xscale("log")
    from matplotlib.ticker import FixedLocator, FuncFormatter, NullLocator
    ax.xaxis.set_major_locator(FixedLocator([0.25, 0.5, 1, 2, 4]))
    ax.xaxis.set_minor_locator(NullLocator())
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    ax.set_yticks(range(len(items)), [n if n not in ("performance", "fit") else n + " (per 10 points)" for n, _ in items], fontsize=8)
    ax.invert_yaxis()
    ax.grid(True, axis="x")
    ax.grid(False, axis="y")
    ax.set_xlabel("Odds ratio of being chosen first (log scale)")
    ex.save(fig, out, "xfig_B9_choice_model", sim, "What Predicts the First Pick",
            "Conditional logit over the six options of each decision (Scenarios 1-4), first picks; odds ratios with participant-"
            "clustered 95% intervals. Card position 1 is the reference; performance and fit per 10 points of their 0-100 scales; fit "
            "is to the values brought into the scenarios. MCF reading opened: the option's reading in the Compare overlay was "
            "opened at some time in that scenario, before or after the first pick.", caps)
    return {"id": "B9", "models": models, "choice_sets": int(O["stratum"].nunique())}


def b10(X, out, sim, caps):
    """Well-being: five regressions (HC3, standardized) and the two figures of the analysis plan 6.2."""
    import statsmodels.api as sm
    z = lambda s: (s - s.mean()) / s.std(ddof=1)   # noqa: E731
    d = X.dropna(subset=["vci", "performance", "age", "active_minutes", "gender3"]).copy()
    d["stab_z"] = np.where(d["stability_measured"] == True, z(d["stability"].astype(float)), 0.0)   # noqa: E712
    d["not_tested"] = (d["stability_measured"] != True).astype(float)   # noqa: E712
    for c in ("vci", "performance", "age", "active_minutes"):
        d[c + "_z"] = z(d[c].astype(float))
    ref = d["gender3"].value_counts().idxmax()
    g = pd.get_dummies(d["gender3"]).drop(columns=ref).astype(float)
    base = pd.concat([d[["vci_z", "performance_z", "stab_z", "not_tested", "age_z", "active_minutes_z"]], g], axis=1)
    rows = []
    for outcome in ("wellbeingComposite", "decisionSatisfaction", "lowDecisionRegret", "valueCongruence", "overallWellbeing"):
        y = z(d[f"fb_{outcome}"].astype(float))
        f = sm.OLS(y, sm.add_constant(base)).fit(cov_type="HC3")
        for term in ("vci_z", "performance_z"):
            b, se = float(f.params[term]), float(f.bse[term])
            rows.append({"outcome": outcome, "term": term.replace("_z", ""), "beta": b, "ci95": [b - 1.959964 * se, b + 1.959964 * se],
                         "p": float(f.pvalues[term])})
    for r, q in zip(rows, ex.fdr([r["p"] for r in rows])):
        r["q"] = q
    yc = z(d["fb_wellbeingComposite"].astype(float))
    fi = sm.OLS(yc, sm.add_constant(base.assign(vci_x_performance=d["vci_z"] * d["performance_z"]))).fit(cov_type="HC3")
    inter = {"beta": float(fi.params["vci_x_performance"]), "p": float(fi.pvalues["vci_x_performance"])}
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.62, 3.5))
    ax.grid(True, axis="both")
    ax.scatter(X["fb_decisionSatisfaction"], X["fb_decisionRegret"], s=14, color=fg.ACCENT, alpha=0.6, linewidths=0)
    ax.axvline(4, color=fg.INK2, lw=0.8, ls=(0, (3, 2)))
    ax.axhline(4, color=fg.INK2, lw=0.8, ls=(0, (3, 2)))
    sat_reg = int(((X["fb_decisionSatisfaction"] > 4) & (X["fb_decisionRegret"] > 4)).sum())
    ax.text(0.03, 0.03, f"above 4 on both: {sat_reg} participants", ha="left", va="bottom", fontsize=7.5, color=fg.INK,
            transform=ax.transAxes)
    ax.set_xlabel("Decision satisfaction (1-7)")
    ax.set_ylabel("Decision regret (1-7, higher = more)")
    ex.save(fig, out, "xfig_B10_satisfaction_against_regret", sim, "Satisfaction and Regret Are Not Opposites",
            "Each dot is one participant; the dashed lines mark the scale midpoint (4). The upper-right area holds participants "
            "above 4 on both satisfaction and regret.", caps)
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.75, 3.6))
    ax.grid(True, axis="both")
    sc = ax.scatter(X["vci"], X["performance"], c=X["fb_wellbeingComposite"], cmap="Blues", vmin=1, vmax=7, s=22, edgecolors="#9a9a9a", linewidths=0.3)
    fig.colorbar(sc, ax=ax, label="Well-being composite (1-7)")
    ax.set_xlabel("Value Consistency Index")
    ax.set_ylabel("Performance captured")
    ex.save(fig, out, "xfig_B10_tradeoff_map_wellbeing", sim, "Values, Performance and Well-Being",
            "Each dot is one participant, shaded by the well-being composite. The scenario options trade values against "
            "performance by design, so VCI and performance are partly linked by construction.", caps)
    return {"id": "B10", "rows": rows, "vci_x_performance_on_composite": inter, "gender_reference": ref, "n": int(len(d)),
            "satisfied_and_regretful": sat_reg}


def b11(X, out, sim, caps):
    """Self-report against behaviour (convergent validity): Spearman per pair, FDR; kappa for the yes/no pair."""
    pairs = [("fb_valueCongruence", "vci", "+"), ("fb_valueCongruence", "fit_frozen_mean", "+"),
             ("fb_decisionConfidence", "seconds_to_first_pick", "-"), ("fb_decisionConfidence", "switches", "-"),
             ("fb_decisionConfidence", "strong_endorsement_share", "+"), ("fb_cognitiveBurden", "active_minutes", "+"),
             ("fb_cognitiveBurden", "switches", "+"), ("fb_cognitiveBurden", "reflection_visits", "+"),
             ("fb_cognitiveBurden", "help_page_seconds", "+"), ("fb_learningInsight", "value_change_size", "+"),
             ("fb_learningInsight", "clarification_visits", "+"), ("fb_learningInsight", "reflection_visits", "+"),
             ("fb_perceivedSupport", "first_card_share", "-"), ("fb_decisionRegret", "changed_after_page", "+"),
             ("tool_preview_rating", "preview_opens", "+")]
    rows = []
    for a, b, sign in pairs:
        d = X[[a, b]].apply(pd.to_numeric, errors="coerce").dropna()
        if len(d) > 5 and d[a].std() > 0 and d[b].std() > 0:
            r = stats.spearmanr(d[a], d[b])
            g = st.rng_for(f"B11:{a}:{b}")
            idx = g.integers(0, len(d), (2000, len(d)))
            boots = [stats.spearmanr(d[a].to_numpy()[i], d[b].to_numpy()[i]).statistic for i in idx[:2000]]
            rows.append({"self_report": a.replace("fb_", ""), "behaviour": b, "expected": sign, "n": int(len(d)), "rho": float(r.statistic),
                         "ci95": st.percentile_ci(np.asarray(boots, float)), "p": float(r.pvalue)})
    dr = X.dropna(subset=["fb_decisionRegret"])
    d = X.dropna(subset=["fb_decisionRegret"])
    r = stats.mannwhitneyu(d.loc[d["wish_differs"], "fb_decisionRegret"], d.loc[~d["wish_differs"], "fb_decisionRegret"], alternative="two-sided")
    rows.append({"self_report": "decisionRegret", "behaviour": "wish differs from the decision (Mann-Whitney)", "expected": "+",
                 "n": int(len(d)), "rho": float("nan"), "p": float(r.pvalue),
                 "mean_if_differs": float(d.loc[d["wish_differs"], "fb_decisionRegret"].mean()),
                 "mean_if_same": float(d.loc[~d["wish_differs"], "fb_decisionRegret"].mean())})
    for row, q in zip(rows, ex.fdr([r["p"] for r in rows])):
        row["q"] = q
    k = X[X["cvr_said_changed"].isin(["yes", "no"])]
    kap = {"n": int(len(k)), "agreement": float(((k["cvr_said_changed"] == "yes") == k["any_change_after_reflection"]).mean()) if len(k) else float("nan"),
           "kappa": cohen_kappa(k["cvr_said_changed"] == "yes", k["any_change_after_reflection"]) if len(k) else float("nan")}
    sp = [r for r in rows if r["rho"] == r["rho"]]
    fig, ax = plt.subplots(figsize=(fg.WIDTH, 0.32 * len(sp) + 0.9))
    for i, r in enumerate(sp):
        ax.errorbar(r["rho"], i, xerr=[[r["rho"] - r["ci95"][0]], [r["ci95"][1] - r["rho"]]], fmt="o", color=fg.ACCENT, ms=4, capsize=2)
        ax.text(1.02, i, f"expected {r['expected'].replace('-', '−')}", va="center", fontsize=7, color=fg.INK2, transform=ax.get_yaxis_transform())
    ax.axvline(0, color=fg.INK2, lw=0.8)
    plain = {"valueCongruence": "Value congruence", "decisionConfidence": "Confidence", "cognitiveBurden": "Burden",
             "learningInsight": "Learning", "perceivedSupport": "Support", "decisionRegret": "Regret", "tool_preview_rating": "Preview rating",
             "vci": "VCI", "fit_frozen_mean": "fit to earlier values", "seconds_to_first_pick": "seconds to first pick",
             "switches": "option changes", "strong_endorsement_share": "firm keeps", "active_minutes": "active minutes",
             "reflection_visits": "reflections met", "help_page_seconds": "time on help pages", "value_change_size": "values moved",
             "clarification_visits": "clarifications met", "first_card_share": "first card chosen", "changed_after_page": "changes after a page",
             "preview_opens": "preview opened"}
    ax.set_yticks(range(len(sp)), [f"{plain.get(r['self_report'], r['self_report'])} - {plain.get(r['behaviour'], r['behaviour'])}"
                                   for r in sp], fontsize=7.5)
    ax.invert_yaxis()
    ax.set_xlim(-1, 1)
    ax.grid(True, axis="x")
    ax.grid(False, axis="y")
    ax.set_xlabel("Spearman's rho with 95% bootstrap interval (2,000 resamples)")
    ex.save(fig, out, "xfig_B11_self_report_against_behaviour", sim, "Self-Report Against Behaviour",
            "Each row pairs a feedback scale with a behaviour it should follow; the expected sign is on the right.", caps)
    return {"id": "B11", "rows": rows, "cvr_changed_kappa": kap}


def b12(docs, keep):
    """Reliability of each feedback subscale: Cronbach's alpha, or Spearman-Brown for the two-item subscales."""
    import explore as _ex   # noqa: F401
    items_meta = {"learningInsight": (["LI1", "LI2", "LI3", "LI4"], []), "decisionSatisfaction": (["DS1", "DS2", "DS4"], []),
                  "decisionRegret": (["DR1", "DR2", "DR3", "DR4"], ["DR3"]), "valueCongruence": (["VC1", "VC2"], []),
                  "decisionConfidence": (["DC1", "DC2"], []), "cognitiveBurden": (["CB1", "CB2", "CB3"], []),
                  "perceivedSupport": (["SA1", "SA2", "SA3"], []), "overallWellbeing": (["OW1", "OW2", "OW3"], [])}
    rows = []
    for d in docs:
        if str(d.get("prolific_pid")) in keep:
            rows.append(get(d, "blocks.feedback_answers.feedback.wellbeing.items") or {})
    I = pd.DataFrame(rows).astype(float)
    out = []
    for name, (codes, flip) in items_meta.items():
        M = I[codes].copy()
        for c in flip:   # within the raw (regret) subscale, DR3 is worded the other way
            M[c] = 8 - M[c]
        M = M.dropna()
        if len(codes) == 2:
            r = M.corr(method="pearson").iloc[0, 1]
            out.append({"subscale": name, "items": 2, "coefficient": "Spearman-Brown", "value": float(2 * r / (1 + r)), "n": int(len(M))})
        else:
            k = len(codes)
            alpha = k / (k - 1) * (1 - M.var(ddof=1).sum() / M.sum(axis=1).var(ddof=1))
            out.append({"subscale": name, "items": k, "coefficient": "Cronbach's alpha", "value": float(alpha), "n": int(len(M))})
    return {"id": "B12", "rows": out}


# ------------------------------------------------------------------------------------------------- B13, B14
def b13(T, X, menus, registered, out, sim, caps):
    """The remaining catalog figures from the registered tables: what happened after a misfit first pick (catalog 7), fit over
    the four decisions on two rulers (8), the prediction's reliability over the decisions (10), the robustness of every test (S3)."""
    S, O = T["S"], T["O"]
    res = {"id": "B13"}
    dec = S[S["decision"] & S["first_misfit"]]
    flow = {}
    fig, ax = plt.subplots(figsize=(fg.WIDTH, 2.6))
    cats = [("kept the first pick", ~dec["changed"], "#cfcfcf"),
            ("changed to a choice that fits", dec["changed"] & dec["final_good_fit"], "#2a78d6"),
            ("changed to another misfit", dec["changed"] & ~dec["final_good_fit"], "#eb6834")]
    for i, c in enumerate(CONDITIONS):
        m = dec["condition"] == c
        left, flow[c] = 0, {}
        for name, mask, col in cats:
            k = int((mask & m).sum())
            flow[c][name] = k
            w = k / max(1, int(m.sum())) * 100
            ax.barh(i, w, left=left, color=col, height=0.62, edgecolor="white", linewidth=1.5)
            if w >= 6:
                ax.text(left + w / 2, i, str(k), ha="center", va="center", fontsize=8, color="white" if col != "#cfcfcf" else fg.INK)
            left += w
        flow[c]["decisions"] = int(m.sum())
    ax.set_yticks(range(4), [fg.LABEL[c] for c in CONDITIONS])
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("Decisions whose first pick went against the participant's values (%)")
    ax.grid(True, axis="x")
    ax.grid(False, axis="y")
    ax.legend([plt.Rectangle((0, 0), 1, 1, color=c) for _, _, c in cats], [n for n, _, _ in cats], loc="lower center",
              bbox_to_anchor=(0.5, 1.0), ncol=3)
    ex.save(fig, out, "xfig_B13_after_a_misfit_first_pick", sim, "What Happened After a First Pick Against One's Values",
            "Decisions in Scenarios 1-4 whose first pick was Misaligned or Strongly misaligned, by condition; counts are decisions.", caps)
    res["after_misfit_first_pick"] = flow
    weights = menus.label_weights
    u0 = X.set_index("pid")[[f"u0_{k}" for k in POLICY]].rename(columns=lambda c: c[3:])
    two = {"opening": [], "before": []}
    for o in range(1, 5):
        rows = S[S["order"] == o]
        w_open = rows["final_label"].map(lambda l: weights[6][l] if l in weights[6] else np.nan).astype(float) * 100
        w_bef = []
        for _, r in rows.iterrows():
            u = u0.loc[r["pid"]].astype(float).to_dict() if r["pid"] in u0.index else None
            if u is None or any(v != v for v in u.values()):
                w_bef.append(np.nan)
                continue
            rk = menus.ranking(r["scenario_id"], u)
            w_bef.append(weights[6][menus.label_of_rank(rk.index(r["final_id"]), 6)] * 100)
        two["opening"].append(ex.boot_mean(w_open, f"B13:open:{o}"))
        two["before"].append(ex.boot_mean(np.asarray(w_bef, float), f"B13:before:{o}"))
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.7, 3.1))
    for key, color, lab in (("opening", fg.ACCENT, "values when each scenario opened (VCI's ruler)"),
                            ("before", fg.INK2, "values before the scenarios")):
        ms = [m for m, _ in two[key]]
        ax.errorbar(range(1, 5), ms, yerr=[[m - c[0] for m, c in two[key]], [c[1] - m for m, c in two[key]]], color=color,
                    marker="o", ms=4, capsize=2, label=lab)
    ax.set_xticks(range(1, 5), [fg.SCENARIO_LABEL[o] for o in range(1, 5)])
    ax.set_ylabel("Fit of the final choice (0-100)")
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.0), fontsize=7.5)
    ex.save(fig, out, "xfig_B13_fit_on_two_rulers", sim, "Fit of Each Decision on Two Rulers",
            "Mean fit (the label weights of VCI, 0-100) of the final choice in each decision, judged on the values the scenario "
            "opened with and on the values brought into the scenarios. 95% bootstrap intervals.", caps)
    res["fit_two_rulers"] = {k: [{"mean": m, "ci95": c} for m, c in v] for k, v in two.items()}
    od = O.dropna(subset=["mpf_p_updated"])
    bins = pd.cut(od["mpf_p_updated"], [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 1.0])
    cal = [{"bin": str(k), "n": int(len(v)), "mean_predicted": float(v["mpf_p_updated"].mean()), "observed": float(v["chosen"].mean())}
           for k, v in od.groupby(bins, observed=True)]
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.55, 3.2))
    ax.grid(True, axis="both")
    top = max(60, max(c["mean_predicted"] * 100 for c in cal) + 5, max(c["observed"] * 100 for c in cal) + 5)
    ax.plot([0, top], [0, top], color="#bbbbbb", lw=1)
    ax.plot([c["mean_predicted"] * 100 for c in cal], [c["observed"] * 100 for c in cal], color=fg.ACCENT, marker="o", ms=4)
    ax.set_xlabel("MPF probability (%)")
    ax.set_ylabel("Chosen first (%)")
    ex.save(fig, out, "xfig_B13_mpf_reliability_decisions", sim, "Reliability of the Prediction Over the Four Decisions",
            "Every option of every decision (Scenarios 1-4), grouped by the probability the Moral Prediction Function gave it; the "
            "share that was the participant's first pick. The grey line is perfect calibration.", caps)
    res["mpf_reliability_decisions"] = cal
    if registered is not None and "robustness" in registered:
        rob = registered["robustness"]
        hs = list(rt.TESTS)
        fig, ax = plt.subplots(figsize=(fg.WIDTH, 3.4))
        keys = [("main", None)] + [(k, k) for k in rob]
        marks = ["o", "s", "^", "v", "D", "P"]
        for j, (lab, k) in enumerate(keys):
            ps = [registered["hypotheses"][h].get("p") if k is None else rob[k]["p"].get(h) for h in hs]
            xs = [i + (j - 2.5) * 0.11 for i in range(len(hs))]
            ys = [-math.log10(p) if isinstance(p, (int, float)) and p == p and p > 0 else np.nan for p in ps]
            ax.scatter(xs, ys, s=12, marker=marks[j % len(marks)], color=fg.ACCENT if k is None else fg.INK2,
                       alpha=1 if k is None else 0.55, label=lab.replace("_", " "))
        ax.axhline(-math.log10(0.05), color="#c0392b", lw=0.8, ls=(0, (3, 2)))
        ax.set_xticks(range(len(hs)), hs, fontsize=7.5)
        ax.set_ylabel("−log10 p (above the dashed line: p < .05)")
        ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=3, fontsize=7)
        ex.save(fig, out, "xfig_B13_robustness", sim, "The Registered Tests Without Each Preregistered Group",
                "Uncorrected p-values of each registered test in the main analysis and without each robustness group (and family "
                "B on the menu-adjusted departure). A description of robustness; the decisions are those of the main analysis. C5 "
                "has no p-value: fewer than 20 participants changed after seeing the prediction, so it was reported as a "
                "description, as registered.", caps)
    return res


def b14(docs, keep, X, out, sim, caps):
    """Blocks 1-4 one by one (analysis plan 4B)."""
    res = {"id": "B14"}
    rows = []
    for d in docs:
        if str(d.get("prolific_pid")) not in keep:
            continue
        th = get(d, "blocks.block1_money.thresholds") or {}
        m = {p: (t.get("thresholdAmountIndex") if t.get("accepted") else 8) for p, t in
             (("sidewalk", th.get("threshold_sidewalk") or {}), ("wealthy", th.get("threshold_wealthy") or {}),
              ("shelter", th.get("threshold_shelter") or {}))}
        tr = get(d, "blocks.block2_trolley") or {}
        lv, br = tr.get("leverThreshold") or {}, tr.get("bridgeThreshold") or {}
        ai = get(d, "blocks.block3_ai_workforce.thresholds") or {}
        cells = {(v.get("groupTypeKey"), v.get("groupSizeKey")): (v.get("thresholdGainIndex") if v.get("accepted") else 6)
                 for v in ai.values() if isinstance(v, dict)}
        chk = get(d, "analysis.blocks_1_to_4_checks") or {}
        rows.append({"pid": str(d.get("prolific_pid")), **{f"m_{k}": v for k, v in m.items()},
                     "lever": lv.get("thresholdIndex") if lv.get("accepted") else 8,
                     "bridge": br.get("thresholdIndex") if br.get("accepted") else 8,
                     **{f"ai_{a}_{b}": v for (a, b), v in cells.items()},
                     "voice": get(d, "blocks.block4_stakeholder_reflection.mostInfluentialPerspective"),
                     "style": get(d, "analysis.post_block4_final_analysis.tentative_style"),
                     "consistency_across_domains": get(d, "analysis.post_block3_insights.profile.consistencyAcrossDomainsScore"),
                     **{f"pace_{k}": v for k, v in (chk.get("median_seconds_between_answers_by_block") or {}).items()},
                     "first_step_yes": chk.get("first_step_yes_count")})
    R = pd.DataFrame(rows)
    amounts = ["$0.25", "$1", "$10", "$20", "$50", "$100", "$1,000", "$10,000"]
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.7, 3.1))
    ends = []
    for place, color in (("sidewalk", "#2a78d6"), ("wealthy", "#6250d6"), ("shelter", "#eb6834")):
        surv = [float((R[f"m_{place}"] > r).mean() * 100) for r in range(8)]
        ax.step(range(8), surv, where="post", color=color, lw=1.8)
        ends.append([surv[-1], place, color])
    ends.sort()
    for i in range(1, len(ends)):          # keep the end labels at least 6 points apart
        ends[i][0] = max(ends[i][0], ends[i - 1][0] + 6)
    for y, place, color in ends:
        ax.text(7.1, y, {"sidewalk": "public sidewalk", "wealthy": "wealthy home", "shelter": "homeless shelter"}[place],
                color=color, fontsize=8, va="center")
    ax.set_xticks(range(8), amounts, rotation=30, fontsize=7.5)
    ax.set_xlim(-0.2, 9.6)
    ax.set_ylabel("Not yet keeping the money (%)")
    ex.save(fig, out, "xfig_B14_money_survival", sim, "Keeping Found Money, Amount by Amount, in Three Places",
            "The share of participants who had not yet kept the money at each amount (those who never kept it stay in at the end).", caps)
    H = pd.crosstab(R["lever"], R["bridge"]).reindex(index=range(9), columns=range(9), fill_value=0)
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.55, 3.4))
    ax.grid(False)
    ax.imshow(H.to_numpy(), cmap="Blues", origin="lower")
    hmax = H.to_numpy().max()
    for i in range(9):
        for j in range(9):
            if H.iloc[i, j]:
                ax.text(j, i, int(H.iloc[i, j]), ha="center", va="center", fontsize=7, color="white" if H.iloc[i, j] > hmax / 2 else fg.INK)
    labs = ["1", "2", "5", "10", "50", "100", "1k", "10k", "never"]
    ax.set_xticks(range(9), labs, fontsize=7)
    ax.set_yticks(range(9), labs, fontsize=7)
    ax.set_xlabel("Lives needed before pushing")
    ax.set_ylabel("Lives needed before pulling")
    ex.save(fig, out, "xfig_B14_lever_against_bridge", sim, "Pulling the Lever Against Pushing a Person",
            "Number of participants in each combination; right of the diagonal, more lives were needed before pushing.", caps)
    cells = [(t, s) for t in ("low_buffer", "high_buffer") for s in ("small", "medium", "large")]
    never = {f"{t}/{s}": int((R[f"ai_{t}_{s}"] == 6).sum()) for t, s in cells}
    M = np.array([[R[f"ai_{t}_{s}"].mean() for s in ("small", "medium", "large")] for t in ("low_buffer", "high_buffer")])
    fig, ax = plt.subplots(figsize=(fg.WIDTH * 0.6, 2.2))
    ax.grid(False)
    ax.imshow(M, cmap="Blues", vmin=0, vmax=6)
    for i, t in enumerate(("low_buffer", "high_buffer")):
        for j, s in enumerate(("small", "medium", "large")):
            ax.text(j, i, f"{M[i, j]:.1f}\n(never {never[f'{t}/{s}']})", ha="center", va="center", fontsize=7.5,
                    color="white" if M[i, j] > 3.5 else fg.INK)
    ax.set_xticks(range(3), ["about 10", "about 100", "about 1,000"])
    ax.set_yticks(range(2), ["entry-level", "senior"])
    ax.set_xlabel("Workers affected")
    ex.save(fig, out, "xfig_B14_workforce_cells", sim, "The Gain Asked Before Harming Workers",
            "Mean rung of the gain ladder (0 = $1 up to 5 = $100 million; never approved = 6) in each of the six cells, and how many "
            "never approved. "
            "The entry-level cells were always asked first.", caps)
    res.update({"workforce_mean_rung": {f"{t}/{s}": float(M[i, j]) for i, t in enumerate(("low_buffer", "high_buffer"))
                                        for j, s in enumerate(("small", "medium", "large"))},
                "workforce_never": never,
                "whose_voice_mattered": {str(k): int(v) for k, v in R["voice"].value_counts().head(8).items()},
                "moral_style": {str(k): int(v) for k, v in R["style"].value_counts().items()},
                "consistency_across_domains": {"n": int(R["consistency_across_domains"].notna().sum()),
                                               "median": float(R["consistency_across_domains"].median())
                                               if R["consistency_across_domains"].notna().any() else None,
                                               "q1": float(R["consistency_across_domains"].quantile(0.25)),
                                               "q3": float(R["consistency_across_domains"].quantile(0.75)),
                                               "scale": "0-1 (1 = the vulnerability signals of the blocks agree fully; "
                                                        "profileAnalysis.ts)"},
                "pace_median_seconds_by_block": {k[5:]: float(R[k].median()) for k in R.columns if k.startswith("pace_")},
                "first_step_yes_count_median": float(R["first_step_yes"].median()) if R["first_step_yes"].notna().any() else None})
    prov = {}
    for d in docs:
        if str(d.get("prolific_pid")) not in keep:
            continue
        for dim in get(d, "analysis.participant_record.derived.thresholdTree.dimensions") or []:
            for c in dim.get("contributions") or []:
                prov.setdefault(dim.get("label") or dim.get("key"), {}).setdefault(c.get("block"), []).append(
                    (c.get("weight") or 0) * (c.get("value") or 0))
    share = {k: {b: float(np.mean(v)) for b, v in blocks.items()} for k, blocks in prov.items()}
    res["provenance_mean_weight_x_value"] = share
    if share:
        fig, ax = plt.subplots(figsize=(fg.WIDTH, 2.9))
        blocks = sorted({b for v in share.values() for b in v})
        colors = dict(zip(blocks, ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#6250d6"]))
        keys = list(share)                 # the scoring's own names for the seven values (its labels)
        for i, k in enumerate(keys):
            left = 0
            tot = sum(share[k].values()) or 1
            for b in blocks:
                w = share[k].get(b, 0) / tot * 100
                ax.barh(i, w, left=left, color=colors[b], height=0.62, edgecolor="white", linewidth=1.2)
                left += w
        ax.set_yticks(range(len(keys)), [str(k) for k in keys], fontsize=8)
        ax.invert_yaxis()
        ax.set_xlim(0, 100)
        ax.set_xlabel("Share of the value's raw score, by block (%)")
        ax.legend([plt.Rectangle((0, 0), 1, 1, color=colors[b]) for b in blocks], blocks, loc="lower center",
                  bbox_to_anchor=(0.5, 1.0), ncol=len(blocks))
        ax.grid(True, axis="x")
        ax.grid(False, axis="y")
        ex.save(fig, out, "xfig_B14_profile_provenance", sim, "Where Each Value Score Comes From",
                "Mean weight x value of every contribution to each of the seven scores, as the study's scoring records it, as a "
                "share per block.", caps)
    return res


# ------------------------------------------------------------------------------------------------- the report and main
def write_report(R, out, sim, n):
    f, apa, no0 = rp.num, rp.apa_p, rp.no0
    ci = lambda c, nd=2: rp.ci(c, rp.num, nd).strip()   # noqa: E731
    pct = lambda c: f"[{100 * c[0]:.0f}%, {100 * c[1]:.0f}%]"   # noqa: E731
    L = [f"# Exploratory results, round 2: the analysis plan's further analyses{' (SIMULATED)' if sim else ''}", ""]
    if sim:
        L += ["**SIMULATED: not data.** Every number below comes from pretend participants.", ""]
    L += [f"{n} participants. **Every result here is exploratory.** Each estimate has its 95% interval; p-values are shown raw and "
          "as Benjamini-Hochberg FDR q-values within each analysis. Nothing has been left out.", "", "## Index", "",
          "| # | Analysis (analysis plan section) |", "|---|---|",
          "| B1 | Principle against practice: the veil rule against the values (3.5) |",
          "| B2 | Crossing one's own red line; trading away the #1 value (3.5) |",
          "| B3 | Which way the scenarios moved each value (3.5) |", "| B4 | Fast first picks against considered ones (3.5) |",
          "| B5 | Which reminder led to the feedback (3.5) |", "| B6 | Age and gender as moderators of the supported results (3.5) |",
          "| B7 | Real participants beside the pretend kinds (catalog 2) |", "| B8 | The correlation map (5.1-5.3) |",
          "| B9 | The choice model (5.4) |", "| B10 | Well-being (6.2) |", "| B11 | Self-report against behaviour (6.3) |",
          "| B12 | Reliability of the feedback scales (6.4) |", "| B13 | The remaining catalog figures (7, 8, 10, S3) |",
          "| B14 | Blocks 1-4 one by one (4B) |", ""]
    b = R["B1"]
    L += ["## B1. Principle against practice (exploratory)", "",
          f"{b['n']} participants. The four rules of Scenario 6 are one per value, so chance agreement is 25%.", ""]
    for k in ("top_before", "decisions_mode"):
        r = b[k]
        L.append(f"- The veil rule (chosen before the prediction) against {r['against']}: agreement {f(100 * r['agreement'], 1)}% "
                 f"{pct(r['ci95'])} (n = {r['n']}), Cohen's kappa {f(r['kappa'])}.")
    b = R["B2"]
    L += ["", "## B2. Crossing one's own red line, and trading away the #1 value, by scenario (exploratory)", "",
          "| Scenario | Red line crossed (share [95% CI]) | #1 value traded away (share [95% CI]) |", "|---|---|---|"]
    for o in sorted(b["crossed"], key=int):
        c, t = b["crossed"][o], b["traded"][o]
        L.append(f"| {fg.SCENARIO_LABEL[int(o)].replace(chr(10), ' ')} | {c['k']} of {c['n']} {pct(c['ci95'])} | "
                 f"{t['k']} of {t['n']} {pct(t['ci95'])} |")
    L += [""] + [f"- {t['what']}: p {apa(t['p'])}, q {apa(t['q'])}" for t in b["tests"]]
    L += ["", "Note. Red line crossed: the chosen option crosses a limit the participant's earlier answers refused outright "
          "(`choiceCrossedOwnRedLine`). #1 value traded away: the chosen option beat, head to head, an option ahead of it on the "
          "participant's #1 value, because the gap there was small and the gap on the #2 value large (`choiceUsedTradeOff`). A "
          "choice can cross a limit only where such an option is on the menu, and the scenarios came in one fixed order, so the "
          "scenarios are described, not compared as positions."]
    b = R["B3"]
    L += ["", "## B3. Which way the scenarios moved each value (exploratory)", "",
          "| Value | Mean change [95% CI] | Changed for | Moves asked / made | p | q |", "|---|---|---|---|---|---|"]
    L += [f"| {r['label']} | {f(r['mean_change'], 1)} {ci(r['ci95'], 1)} | {r['changed_for']} of {r['n']} | "
          f"{r['moves_asked']} / {r['moves_made']} | {apa(r['p'])} | {apa(r['q'])} |" for r in b["rows"]]
    L += ["", "Note. The study's values after Scenario 4 minus before the scenarios (`analysis.value_profile_change`). Moves asked / "
          "made: every value move saved in Scenarios 1-4 (`valueMoves`); a move asked of a value already at 0 or 100 is made as 0. "
          "The interval is a bootstrap interval of the mean; p is the one-sample Wilcoxon signed-rank test, which looks at the "
          "centre of the changes rather than their mean, so the two can differ. Each condition moves the values by its own "
          "rules: the last three values move only through the reflection pages (CVR + APA and CVR only), and APA only and "
          "Baseline never move them. So this describes, and does not compare."]
    b = R["B4"]
    L += ["", "## B4. Fast first picks against considered ones (exploratory)", "",
          f"{b['decisions']} decisions. Odds that the first pick fits (Aligned or Weakly aligned), per doubling of the time to the "
          f"first selection: {f(b['odds_ratio_per_doubling'])} {ci(b['ci95'])}, p {apa(b['p'])} (logistic regression, "
          "participant-clustered errors). Share of fitting first picks: " +
          ", ".join(f"{k} {f(100 * v, 0)}%" for k, v in b["good_fit_first_pick_share_by_speed"].items()) + "."]
    b = R["B5"]
    L += ["", "## B5. Which reminder led to the feedback (exploratory, description)", "",
          "First button used: " + ", ".join(f"{k.replace('_', ' ')} {v}" for k, v in b["first_button_used"].items()) + "."]
    b = R["B6"]
    L += ["", "## B6. Age and gender as moderators of the four supported results (exploratory)", "",
          "| Result | Moderator | Moderator term | p | q | Note |", "|---|---|---|---|---|---|"]
    L += [f"| {t['result']} | {t['moderator']} | {f(t.get('interaction'), 3) if 'interaction' in t else 'not estimable'} | "
          f"{apa(t['p'])} | {apa(t['q'])} | {t.get('note', '')} |" for t in b["tests"]]
    nl = b["gender_models_leave_out"]
    L += ["", f"Note. Age standardized; gender compares male with female ({nl} participant{'' if nl == 1 else 's'} in the third "
          f"category cannot carry an interaction and {'is' if nl == 1 else 'are'} left out of the gender models). The moderator term is the interaction with "
          "the help page (A4, logistic, participant-clustered errors), with the prediction's hit (C4, HC3), and with fit (C7, "
          "conditional logit); for C6 it is the moderator's slope on each participant's improvement in log-loss (HC3). A "
          "not-estimable row has no p-value and is left out of the q-values."]
    b = R["B7"]
    L += ["", "## B7. Real participants beside the pretend kinds (exploratory, description)", ""]
    names = {"vci": "VCI", "stability": "Stability (tested only)", "performance": "Performance"}
    for col, v in b["summary"].items():
        L.append(f"- {names.get(col, col)}: real median {f(v['real_median'], 1)}; pretend medians in CVR + APA: " +
                 ", ".join(f"{k} {f(m, 0) if m is not None else 'never tested'}" for k, m in v["pretend_medians_cvr_apa"].items()) + ".")
    L += ["", "Note. The pretend kinds are 2,000 pretend people each, made by the study's own code (docs/MAJOR_SCORES_BY_CONDITION.md, "
          "principle A): a ruler for reading the real scores, not data."]
    b = R["B8"]
    sig = sorted([p for p in b["pairs"] if p["q"] < 0.05], key=lambda p: -abs(p["rho"]))
    L += ["", "## B8. The correlation map (exploratory)", "", f"{b['n_pairs']} pairs; {len(sig)} with q < .05:", "",
          "| A | B | rho | q | Partly built into the scores | rho among pretend random choosers |", "|---|---|---|---|---|---|"]
    L += [f"| {LABEL.get(p['a'], p['a'])} | {LABEL.get(p['b'], p['b'])} | {no0(p['rho'])} | {apa(p['q'])} | "
          f"{('yes: ' + p['why_linked']) if p['by_construction'] else ''} | {no0(p.get('rho_pretend_random'))} |" for p in sig]
    L += ["", "Note. The seven values (Protecting the vulnerable ... Hearing someone's story) are those brought into the scenarios. "
          "Pretend random choosers: participants made by the study's own code who choose at random (the pool of the simulation "
          "check); their correlation shows how much of a link the measures carry before anybody's preferences enter."]
    b = R["B9"]
    L += ["", "## B9. The choice model (exploratory)", "", f"{b['choice_sets']} choice sets (first picks, Scenarios 1-4).", "",
          "| Model | Log-likelihood | AIC | LR against the previous | p |", "|---|---|---|---|---|"]
    L += [f"| {m['model']} | {f(m.get('loglik'), 1)} | {f(m.get('aic'), 1)} | {f(m.get('lr_against_previous'), 2)} | {apa(m.get('p'))} |"
          for m in b["models"] if "loglik" in m]
    last = [m for m in b["models"] if "coefficients" in m][-1]
    L += ["", "Odds ratios in the fullest model (card position 1 the reference; performance and fit per 10 points): " +
          "; ".join(f"{k} {f(v['odds_ratio'], 3)} {ci(v['ci95'], 3)}" for k, v in last["coefficients"].items()) + ".",
          "", "Note. MCF reading opened: the option's reading in the Compare overlay was opened at some time in that scenario, "
          "before or after the first pick."]
    b = R["B10"]
    L += ["", "## B10. Well-being (exploratory)", "", f"{b['n']} participants; standardized coefficients, HC3 errors; controls: Stability "
          "(tested; not tested flagged), age, gender, active minutes.", "", "| Outcome | Term | beta [95% CI] | p | q |", "|---|---|---|---|---|"]
    out_name = {"wellbeingComposite": "Well-being composite", "decisionSatisfaction": "Decision satisfaction",
                "lowDecisionRegret": "Low decision regret", "valueCongruence": "Value congruence", "overallWellbeing": "Overall well-being"}
    L += [f"| {out_name.get(r['outcome'], r['outcome'])} | {'VCI' if r['term'] == 'vci' else 'Performance'} | {no0(r['beta'])} "
          f"{rp.ci(r['ci95'], no0).strip()} | {apa(r['p'])} | {apa(r['q'])} |" for r in b["rows"]]
    L += ["", f"VCI x performance on the composite: beta {no0(b['vci_x_performance_on_composite']['beta'])}, "
          f"p {apa(b['vci_x_performance_on_composite']['p'])}. Above 4 (the midpoint of 1-7) on both satisfaction and regret: "
          f"{b['satisfied_and_regretful']} participants. VCI and performance are partly linked by construction (the options trade "
          "values against performance)."]
    b = R["B11"]
    L += ["", "## B11. Self-report against behaviour (exploratory)", "",
          "| Self-report | Behaviour | Expected | n | rho [95% CI] | p | q |", "|---|---|---|---|---|---|---|"]
    for r in b["rows"]:
        val = (f"{no0(r['rho'])} {rp.ci(r.get('ci95'), no0).strip()}" if r["rho"] == r["rho"]
               else f"means {f(r.get('mean_if_differs'))} (wish differs) and {f(r.get('mean_if_same'))} (same)")
        L.append(f"| {SELF_REPORT.get(r['self_report'], r['self_report'])} | {BEHAVIOUR.get(r['behaviour'], r['behaviour'])} | "
                 f"{r['expected'].replace('-', chr(8722))} | {r['n']} | {val} | {apa(r['p'])} | {apa(r['q'])} |")
    k = b["cvr_changed_kappa"]
    L += ["", f"\"Did the reflection change your choice?\" against an actual change after a reflection: agreement "
          f"{f(100 * k['agreement'], 0)}%, Cohen's kappa {f(k['kappa'])} (n = {k['n']})."]
    b = R["B12"]
    L += ["", "## B12. Reliability of the feedback scales (exploratory)", "", "| Subscale | Items | Coefficient | Value |", "|---|---|---|---|"]
    L += [f"| {SELF_REPORT.get(r['subscale'], r['subscale'])} | {r['items']} | {r['coefficient']} | {f(r['value'])} |" for r in b["rows"]]
    b = R["B13"]
    L += ["", "## B13. The remaining catalog figures (exploratory)", "", "After a first pick against one's values (decisions):", ""]
    L += [f"- {c}: " + ", ".join(f"{k} {v}" for k, v in d.items()) for c, d in b["after_misfit_first_pick"].items()]
    L += ["", "Fit of the final choice in Scenarios 1-4: on the values each scenario opened with " +
          ", ".join(f(x["mean"], 1) for x in b["fit_two_rulers"]["opening"]) + "; on the values before the scenarios " +
          ", ".join(f(x["mean"], 1) for x in b["fit_two_rulers"]["before"]) + ".", "",
          "The prediction over the decisions (probability group: mean predicted, observed): " +
          "; ".join(f"{c['bin']}: {f(100 * c['mean_predicted'], 0)}%, {f(100 * c['observed'], 0)}% (n {c['n']})"
                    for c in b["mpf_reliability_decisions"]) + "."]
    b = R["B14"]
    cell = lambda k: {"low_buffer": "entry-level", "high_buffer": "senior"}[k.split("/")[0]] + ", about " + \
        {"small": "10", "medium": "100", "large": "1,000"}[k.split("/")[1]] + " workers"   # noqa: E731
    cad = b["consistency_across_domains"]
    L += ["", "## B14. Blocks 1-4 one by one (exploratory, description)", "",
          "- Block 3, mean rung of the gain ladder (0 = the first rung, $1; never approved = 6): " +
          "; ".join(f"{cell(k)} {f(v, 1)} (never approved {b['workforce_never'][k]})" for k, v in b["workforce_mean_rung"].items()) + ".",
          "- Whose voice mattered most in Block 4: " + ", ".join(f"{k} {v}" for k, v in b["whose_voice_mattered"].items()) + ".",
          "- Moral style after Block 4: " + ", ".join(f"{k} {v}" for k, v in b["moral_style"].items()) + ".",
          f"- Agreement of the vulnerability signals across Blocks 1-3 (0-1, 1 = full agreement): median {f(cad['median'], 2)} "
          f"[middle half {f(cad['q1'], 2)} to {f(cad['q3'], 2)}] (n = {cad['n']}).",
          "- Median seconds between answers, by block: " + ", ".join(f"{k.split('_')[0].replace('block', 'Block ')} {f(v, 1)}"
                                                                    for k, v in b["pace_median_seconds_by_block"].items()) + "."]
    (out / "EXPLORATORY_RESULTS_ROUND2.md").write_text("\n".join(L) + "\n", encoding="utf8")


def null_frame(work: Path):
    """Pretend RANDOM choosers made by the study's own code (the four pool parts of check_on_simulated.py), as one frame."""
    import subprocess
    root = HERE.parent
    frames = []
    for k in range(4):
        folder = work / f"null{k + 1}"
        folder.mkdir(parents=True, exist_ok=True)
        subprocess.run(["node", "tools/simulate_records.cjs", f"--out={folder / 'participants.json'}", f"--truth={folder / 'truth.json'}",
                        "--counts=63,63,62,63", f"--seed={7001 + k}", f"--first-number={10000 + 1000 * k}", "--no-compile", "--compact"],
                       cwd=root, check=True, capture_output=True)
        subprocess.run(["node", "tools/ai_safe_copy.cjs", str(folder), "--anywhere"], cwd=root, check=True, capture_output=True)
        truth = {p["prolific_pid"]: p["kind"] for p in json.loads((folder / "truth.json").read_text(encoding="utf8"))["people"]}
        key = pd.read_csv(folder / "key.csv")
        random_codes = {c for c, pid in zip(key["code"], key["prolific_id"]) if truth.get(pid) == "random"}
        docs = bt.load_records(folder / "participants_ai_safe.json")
        T = bt.build(docs)
        X = person_frame(T, docs, bt.Menus())
        frames.append(X[X["pid"].isin(random_codes)])
        (folder / "participants.json").unlink()
        (folder / "participants_ai_safe.json").unlink()
    return pd.concat(frames, ignore_index=True)


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
    menus = bt.Menus()
    X = person_frame(T, docs, menus)
    kinds = json.loads(Path(opt("--kinds")).read_text(encoding="utf8")) if opt("--kinds") else None
    registered = json.loads(Path(opt("--registered")).read_text(encoding="utf8")) if opt("--registered") else None
    null_X = null_frame(Path(opt("--null-work"))) if opt("--null-work") else None
    VALUE_BLOCKS.update(value_blocks(docs))
    fg.CAPTIONS.clear()
    caps = []
    R = {"B1": b1(T, docs, menus), "B2": b2(T, docs), "B3": b3(X, docs), "B4": b4(T, docs), "B5": b5(docs, keep), "B6": b6(T, X),
         "B7": b7(X, kinds, figs, sim, caps) if kinds else {"id": "B7", "summary": {}},
         "B8": b8(X, null_X, figs, sim, caps), "B9": b9(T, docs, figs, sim, caps), "B10": b10(X, figs, sim, caps),
         "B11": b11(X, figs, sim, caps), "B12": b12(docs, keep), "B13": b13(T, X, menus, registered, figs, sim, caps),
         "B14": b14(docs, keep, X, figs, sim, caps)}
    import pipeline as pl
    R = pl.to_jsonable(R)
    (out / "exploratory_results_round2.json").write_text(json.dumps(R, indent=1), encoding="utf8")
    write_report(R, out, sim, len(keep))
    md = [f"# Figure captions, exploratory round 2{' (SIMULATED: not data)' if sim else ''}", ""]
    md += [f"**{name}**: *{title}*. Note. {note}" for name, title, note in caps]
    (figs / "figure_captions_exploratory_round2.md").write_text("\n\n".join(md) + "\n", encoding="utf8")
    extra = "" if null_X is None else f", {len(null_X)} pretend random choosers for the null"
    print(f"Exploratory round 2: {len(R)} analyses, {len(caps)} figures, {len(keep)} participants{extra} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
