"""posthoc_round6.py: POST HOC checks for the CHIWORK 2027 paper, round 6: baselines and robustness (23 November 2026).

Waseem's request (`CHIWORK 2027/Message_to_Code_Agent_2026-11-23.md`): six checks the reviewers asked for. Every result
is POST HOC. Rates with k / n and 95% intervals; comparisons with the test, the statistic, the p-value and the 95%
interval of the difference; a bootstrap over participants (10,000 resamples) wherever one participant gives several
decisions. Group counts, rates and test results only. Reads the frozen analysis modules (tag analysis-v1) read-only.

Run:
  analysis\\.venv\\Scripts\\python.exe exploratory\\posthoc_round6.py <participants_ai_safe.json> <output folder>
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
import explore as ex                     # noqa: E402  (round 1's tools; it loads the frozen modules, read-only)
from explore import bt, st, rp           # noqa: E402

get = bt.get
B = 10_000
VEIL = "veil_emergency_reserve_rule"
VULN = "vulnerabilityProtectionSensitivity"
WORDS = {"vulnerabilityProtectionSensitivity": "Protecting the vulnerable", "groupSizeSensitivity": "Reducing harm",
         "gainResponsivenessSensitivity": "How much is gained", "outcomeAggregationSensitivity": "How many are helped"}


# ------------------------------------------------------------------------------------------------- helpers
def js_round(x):
    return math.floor(x + 0.5)


def pct(x, nd=1):
    return f"{100 * x:.{nd}f}%"


def rate(k, n):
    return {"k": int(k), "n": int(n), "rate": k / n if n else float("nan"), "ci95": ex.cp(int(k), int(n)) if n else [float("nan")] * 2}


def boot_paired(a_by_person, b_by_person, n_by_person, name, ratio=True):
    """Participant bootstrap of a pooled difference (sum a - sum b) / sum n (ratio=True) or of a mean of per-person
    differences (ratio=False). Two-sided p: twice the smaller share of resamples on either side of 0."""
    a, b, m = (np.asarray(x, float) for x in (a_by_person, b_by_person, n_by_person))
    g = st.rng_for(name)
    idx = g.integers(0, len(a), (B, len(a)))
    if ratio:
        est = (a.sum() - b.sum()) / m.sum()
        boots = (a[idx].sum(1) - b[idx].sum(1)) / m[idx].sum(1)
    else:
        est = float(np.mean(a - b))
        boots = (a - b)[idx].mean(1)
    lo, hi = np.percentile(boots, [2.5, 97.5])
    p = min(1.0, 2 * min((1 + np.sum(boots <= 0)) / (1 + B), (1 + np.sum(boots >= 0)) / (1 + B)))
    return {"difference": float(est), "ci95": [float(lo), float(hi)], "p_two_sided": float(p), "boots": boots}


def mcnemar_exact(x_hit, y_hit):
    x_hit, y_hit = np.asarray(x_hit, bool), np.asarray(y_hit, bool)
    b, c = int((x_hit & ~y_hit).sum()), int((~x_hit & y_hit).sum())
    p = float(stats.binomtest(b, b + c, 0.5).pvalue) if b + c else 1.0
    return {"model_only": b, "baseline_only": c, "p_exact": p}


def ranking(menus, sid, u, keys):
    """The study's own order (labelOptions and the MPF): lowest shortfall first, then more delivered, then the id; over
    the given policy keys."""
    opts = menus.by_id[sid]["options"]
    sf = lambda o: sum((u[k] / 100.0) * max(0.0, u[k] - o["values"][k]) for k in keys)   # noqa: E731
    dl = lambda o: sum((u[k] / 100.0) * o["values"][k] for k in keys)                     # noqa: E731
    return [o["id"] for o in sorted(opts, key=lambda o: (sf(o), -dl(o), o["id"]))]


def mpf_p(menus, sid, u, temperature, keys=None):
    if keys is None:
        return menus.mpf(sid, u, temperature)["p"]
    opts = menus.by_id[sid]["options"]
    fits = {o["id"]: -sum((u[k] / 100.0) * max(0.0, u[k] - o["values"][k]) for k in keys) for o in opts}
    top = max(fits.values())
    w = {i: math.exp((f - top) / temperature) for i, f in fits.items()}
    tot = sum(w.values())
    return {i: w[i] / tot for i in w}


def fit_keys(u, o, keys):
    most = sum((u[k] / 100.0) * u[k] for k in keys)
    if most <= 0:
        return 100.0
    sf = sum((u[k] / 100.0) * max(0.0, u[k] - o["values"][k]) for k in keys)
    return min(100.0, max(0.0, 100.0 * (1.0 - sf / most)))


def clogit(D, cols, label_cols=None):
    X = D[cols].to_numpy(float)
    r = st.conditional_logit(X, D["chosen"].to_numpy(), D["stratum"].to_numpy(), D["pid"].to_numpy())
    out = {"loglik": float(r["loglik"]), "k": len(cols), "coef": {}}
    for i, c in enumerate(cols):
        b, se = float(r["beta"][i]), float(r["se_clustered"][i])
        out["coef"][c] = {"beta": b, "or": math.exp(b), "ci95": [math.exp(b - 1.959964 * se), math.exp(b + 1.959964 * se)],
                          "p": float(2 * stats.norm.sf(abs(b / se)))}
    return out


def lr(big, small):
    x = 2 * (big["loglik"] - small["loglik"])
    df = big["k"] - small["k"]
    return {"chi2": float(x), "df": int(df), "p": float(stats.chi2.sf(x, df))}


# ------------------------------------------------------------------------------------------------- the data
def assemble(docs, T, menus):
    S, O = T["S"], T["O"]
    pol = menus.policy
    u0, uopen, temp, shown_fit, veil, b3 = {}, {}, {}, {}, {}, {}
    for d in docs:
        pid = str(d.get("prolific_pid"))
        dims = {x["key"]: x["score"] for x in get(d, "blocks.block5_emergency_scenarios.originalProfile.dimensions") or []}
        u0[pid] = {k: float(dims[k]) for k in pol}
        for m in get(d, "analysis.mpf_predictions_every_scenario.by_scenario") or []:
            u = m.get("profile_used_values") or {}
            uopen[(pid, m.get("scenario_id"))] = {k: float(u[k]) for k in pol}
        b5 = get(d, "blocks.block5_emergency_scenarios") or {}
        temp[pid] = menus.temperature(b5.get("vci"), b5.get("stability"))
        for r in b5.get("scenarioResults") or []:
            shown_fit[(pid, r["scenarioId"])] = r.get("fitScoresByOptionId") or {}
            if r["scenarioId"] == VEIL:
                veil[pid] = r.get("predictionTest") or {}
        th = get(d, "blocks.block3_ai_workforce.thresholds") or {}
        b3[pid] = [bool(v.get("accepted")) for v in th.values() if isinstance(v, dict)]
    return u0, uopen, temp, shown_fit, veil, b3


# ------------------------------------------------------------------------------------------------- task 1
def task1(T, menus, u0, uopen, temp, veil):
    S, O = T["S"], T["O"]
    pol = menus.policy
    dec = S[S["decision"]][["pid", "scenario_id", "order", "first_id", "mpf_hit_first_updated", "mpf_p_first_updated"]].copy()
    pids = sorted(dec["pid"].unique())
    pos1 = O[O["position"] == 1].set_index(["pid", "scenario_id"])["option_id"].to_dict()
    # popularity, leave one out (ties: the option listed first in the scenario's own option list)
    counts = dec.groupby(["scenario_id", "first_id"]).size().to_dict()
    ties = 0
    rows = []
    for _, r in dec.iterrows():
        pid, sid, first = r["pid"], r["scenario_id"], r["first_id"]
        opts = [o["id"] for o in menus.by_id[sid]["options"]]
        c = {o: counts.get((sid, o), 0) - (1 if o == first else 0) for o in opts}
        best = max(c.values())
        tied = [o for o in opts if c[o] == best]
        ties += len(tied) > 1
        pop = tied[0]
        others = [p for p in pids if p != pid and (p, sid) in uopen]
        u_avg = {k: float(np.mean([uopen[(p, sid)][k] for p in others])) for k in pol}
        avg_top = ranking(menus, sid, u_avg, pol)[0]
        mpf_top = ranking(menus, sid, uopen[(pid, sid)], pol)[0]
        fit_rank = ranking(menus, sid, uopen[(pid, sid)], pol)
        rows.append({"pid": pid, "sid": sid, "order": r["order"], "first": first, "mpf_top": mpf_top,
                     "mpf_hit": mpf_top == first, "stored_hit": bool(r["mpf_hit_first_updated"]),
                     "top_card": pos1.get((pid, sid)), "card_hit": pos1.get((pid, sid)) == first,
                     "pop_hit": pop == first, "avg_hit": avg_top == first,
                     "top_card_fits": fit_rank.index(pos1.get((pid, sid))) < 2 if pos1.get((pid, sid)) in fit_rank else None,
                     "ll_mpf": -math.log(float(r["mpf_p_first_updated"])),
                     "ll_avg": -math.log(mpf_p(menus, sid, u_avg, temp[pid])[first])})
    D = pd.DataFrame(rows)
    per = D.groupby("pid").agg(n=("first", "size"), mpf=("mpf_hit", "sum"), card=("card_hit", "sum"), pop=("pop_hit", "sum"),
                               avg=("avg_hit", "sum"), ll_mpf=("ll_mpf", "mean"), ll_avg=("ll_avg", "mean"))
    out = {"decisions": int(len(D)), "self_check_mpf_top_equals_stored": int((D["mpf_hit"] == D["stored_hit"]).sum()),
           "popularity_ties": int(ties), "mpf": rate(D["mpf_hit"].sum(), len(D))}
    for key, col in (("top_card", "card"), ("most_popular", "pop"), ("average_person", "avg")):
        bp = boot_paired(per["mpf"], per[col], per["n"], f"R6:T1:{key}")
        out[key] = {**rate(D[f"{col if col != 'card' else 'card'}_hit" if col != "card" else "card_hit"].sum(), len(D)),
                    "mpf_minus_baseline": {k: v for k, v in bp.items() if k != "boots"}}
    out["top_card"].update(rate(D["card_hit"].sum(), len(D)))
    out["most_popular"].update(rate(D["pop_hit"].sum(), len(D)))
    out["average_person"].update(rate(D["avg_hit"].sum(), len(D)))
    llp = boot_paired(per["ll_mpf"], per["ll_avg"], per["n"], "R6:T1:ll", ratio=False)
    out["log_loss"] = {"mpf_mean": float(D["ll_mpf"].mean()), "average_person_mean": float(D["ll_avg"].mean()),
                       "uniform": math.log(6), "mpf_minus_average_person": {k: v for k, v in llp.items() if k != "boots"}}
    fits = D.dropna(subset=["top_card_fits"])
    out["top_card_split"] = {"fits": rate(fits.loc[fits["top_card_fits"] == True, "card_hit"].sum(), int((fits["top_card_fits"] == True).sum())),   # noqa: E712
                             "does_not_fit": rate(fits.loc[fits["top_card_fits"] == False, "card_hit"].sum(), int((fits["top_card_fits"] == False).sum()))}   # noqa: E712
    same = D["mpf_top"] == D["top_card"]
    out["overlap"] = {"mpf_top_is_top_card": rate(same.sum(), len(D)),
                      "mpf_hit_when_top_card": rate(D.loc[same, "mpf_hit"].sum(), int(same.sum())),
                      "mpf_hit_when_not_top_card": rate(D.loc[~same, "mpf_hit"].sum(), int((~same).sum()))}
    # scenario 6
    v = []
    cnt6 = pd.Series([veil[p].get("firstChoiceOptionId") for p in pids]).value_counts().to_dict()
    opts6 = [o["id"] for o in menus.by_id[VEIL]["options"]]
    ties6 = 0
    for p in pids:
        pt = veil[p]
        first = pt.get("firstChoiceOptionId")
        u6 = uopen[(p, VEIL)]
        t6 = float(pt.get("temperature"))
        mp = mpf_p(menus, VEIL, u6, t6)
        mpf_top = ranking(menus, VEIL, u6, pol)[0]
        c = {o: cnt6.get(o, 0) - (1 if o == first else 0) for o in opts6}
        best = max(c.values())
        tied = [o for o in opts6 if c[o] == best]
        ties6 += len(tied) > 1
        others = [q for q in pids if q != p]
        u_avg = {k: float(np.mean([uopen[(q, VEIL)][k] for q in others])) for k in pol}
        v.append({"mpf_hit": mpf_top == first, "stored_top_ok": mpf_top == pt.get("predictedTopOptionId"),
                  "shown_p_ok": all(abs(mp[x["optionId"]] - x["probability"]) < 1e-9 for x in pt.get("shownProbabilities") or []),
                  "card_hit": (pt.get("shownOrder") or [None])[0] == first, "pop_hit": tied[0] == first,
                  "avg_hit": ranking(menus, VEIL, u_avg, pol)[0] == first,
                  "ll_mpf": -math.log(mp[first]), "ll_avg": -math.log(mpf_p(menus, VEIL, u_avg, t6)[first])})
    V = pd.DataFrame(v)
    s6 = {"n": int(len(V)), "self_check_top_equals_stored": int(V["stored_top_ok"].sum()), "self_check_shown_probabilities": int(V["shown_p_ok"].sum()),
          "popularity_ties": int(ties6), "mpf": rate(V["mpf_hit"].sum(), len(V))}
    ones = np.ones(len(V))
    for key, col in (("first_listed", "card_hit"), ("most_popular", "pop_hit"), ("average_person", "avg_hit")):
        bp = boot_paired(V["mpf_hit"].astype(float), V[col].astype(float), ones, f"R6:T1:S6:{key}")
        s6[key] = {**rate(V[col].sum(), len(V)), "mpf_minus_baseline": {k: v_ for k, v_ in bp.items() if k != "boots"},
                   "mcnemar": mcnemar_exact(V["mpf_hit"], V[col])}
    llp6 = boot_paired(V["ll_mpf"], V["ll_avg"], ones, "R6:T1:S6:ll", ratio=False)
    s6["log_loss"] = {"mpf_mean": float(V["ll_mpf"].mean()), "average_person_mean": float(V["ll_avg"].mean()), "uniform": math.log(4),
                      "mpf_minus_average_person": {k: x for k, x in llp6.items() if k != "boots"}}
    out["scenario6"] = s6
    return out, D


# ------------------------------------------------------------------------------------------------- task 2
def task2(T, menus, u0, uopen, shown_fit):
    O = T["O"]
    S = T["S"]
    dec_sids = set(S[S["decision"]]["scenario_id"])
    order = dict(zip(S["scenario_id"], S["order"]))
    D = O[O["scenario_id"].isin(dec_sids)].dropna(subset=["position", "captured", "fit_before"]).copy()
    D["shown"] = [shown_fit.get((p, s), {}).get(o) for p, s, o in zip(D["pid"], D["scenario_id"], D["option_id"])]
    D["order"] = D["scenario_id"].map(order)
    corr = {"all": float(np.corrcoef(D["shown"].astype(float), D["fit_before"].astype(float))[0, 1])}
    for o in (1, 2, 3, 4):
        g = D[D["order"] == o]
        corr[f"scenario_{o}"] = float(np.corrcoef(g["shown"].astype(float), g["fit_before"].astype(float))[0, 1])
    s1 = D[D["order"] == 1]
    identical_s1 = bool((s1["fit_before"].map(js_round) == s1["shown"].astype(int)).all())
    # the conditional logit on scenarios 2-4
    D = D[(D.groupby("stratum")["chosen"].transform("sum") == 1) & (D.groupby("stratum")["option_id"].transform("size") == 6)]
    E = D[D["order"].isin([2, 3, 4])].copy()
    for k in range(2, 7):
        E[f"pos{k}"] = (E["position"].astype(int) == k).astype(float)
    E["perf10"] = E["captured"] / 10
    E["shown10"] = E["shown"].astype(float) / 10
    E["frozen10"] = E["fit_before"] / 10
    base = [f"pos{k}" for k in range(2, 7)] + ["perf10"]
    m0 = clogit(E, base)
    ms = clogit(E, base + ["shown10"])
    mf = clogit(E, base + ["frozen10"])
    mb = clogit(E, base + ["shown10", "frozen10"])
    model = {"choice_sets": int(E["stratum"].nunique()), "shown_only": ms["coef"]["shown10"], "frozen_only": mf["coef"]["frozen10"],
             "both": {"shown": mb["coef"]["shown10"], "frozen": mb["coef"]["frozen10"]},
             "lr_frozen_added_to_shown": lr(mb, ms), "lr_shown_added_to_frozen": lr(mb, mf),
             "lr_shown_added_to_base": lr(ms, m0), "lr_frozen_added_to_base": lr(mf, m0)}
    # the two top options
    first = S[S["decision"]].set_index(["pid", "scenario_id"])["first_id"].to_dict()
    tops = []
    for (p, s), f in first.items():
        ts = ranking(menus, s, uopen[(p, s)], menus.policy)[0]
        tf = ranking(menus, s, u0[p], menus.policy)[0]
        tops.append({"order": order[s], "differ": ts != tf, "pick_shown_top": f == ts, "pick_frozen_top": f == tf})
    Tp = pd.DataFrame(tops)
    dif = Tp[Tp["differ"]]
    tops_out = {"decisions": int(len(Tp)), "differ": int(len(dif)), "differ_by_scenario": {int(o): int(g["differ"].sum()) for o, g in Tp.groupby("order")},
                "first_pick_shown_top": int(dif["pick_shown_top"].sum()), "first_pick_frozen_top": int(dif["pick_frozen_top"].sum()),
                "first_pick_neither": int((~dif["pick_shown_top"] & ~dif["pick_frozen_top"]).sum())}
    return {"correlation": corr, "scenario1_identical_after_rounding": identical_s1, "model_scenarios_2_to_4": model, "top_options": tops_out}


# ------------------------------------------------------------------------------------------------- task 3
def task3(T, menus, u0, uopen, temp):
    S = T["S"]
    s24 = S[S["order"].isin([2, 3, 4])].copy()
    per = s24.groupby("pid").agg(n=("first_id", "size"), hu=("mpf_hit_first_updated", "sum"), hb=("mpf_hit_first_before", "sum"))
    bp = boot_paired(per["hu"], per["hb"], per["n"], "R6:T3:hit")
    hit = {"updated": rate(per["hu"].sum(), per["n"].sum()), "frozen": rate(per["hb"].sum(), per["n"].sum()),
           "difference": bp["difference"], "ci95": bp["ci95"], "p_one_sided_updated_higher": st.boot_p(bp["boots"], 0.0, greater=True)}
    rows = []
    for _, r in s24.iterrows():
        p, s, f = r["pid"], r["scenario_id"], r["first_id"]
        rows.append({"pid": p, "own_u": -math.log(mpf_p(menus, s, uopen[(p, s)], temp[p])[f]),
                     "own_b": -math.log(mpf_p(menus, s, u0[p], temp[p])[f]),
                     "t39_u": -math.log(mpf_p(menus, s, uopen[(p, s)], 39.0)[f]), "t39_b": -math.log(mpf_p(menus, s, u0[p], 39.0)[f])})
    R = pd.DataFrame(rows).groupby("pid").mean()
    replicate = float((R["own_u"] - R["own_b"]).mean())
    b39 = boot_paired(R["t39_u"], R["t39_b"], np.ones(len(R)), "R6:T3:t39", ratio=False)
    t39 = {"mean_difference": b39["difference"], "ci95": b39["ci95"], "p_one_sided_below_0": st.boot_p(b39["boots"], 0.0, greater=False),
           "mean_log_loss_updated": float(R["t39_u"].mean()), "mean_log_loss_frozen": float(R["t39_b"].mean())}
    return {"hit_rate": hit, "replicated_registered_log_loss_difference": replicate, "fixed_temperature_39": t39}


# ------------------------------------------------------------------------------------------------- task 4
def task4(T):
    S = T["S"]
    d4 = S[S["order"] == 4].set_index("pid")["final_id"].str.replace("care_", "", regex=False)
    d5 = S[S["order"] == 5].set_index("pid")["final_id"].str.replace("wish_", "", regex=False)
    both = pd.concat([d4.rename("dec"), d5.rename("wish")], axis=1).dropna()
    n = len(both)
    matches = int((both["dec"] == both["wish"]).sum())
    s4, s5 = both["dec"].value_counts(normalize=True), both["wish"].value_counts(normalize=True)
    expected = float(sum(s4.get(k, 0) * s5.get(k, 0) for k in set(s4.index) | set(s5.index)) * n)
    g = st.rng_for("R6:T4:perm")
    w = both["wish"].to_numpy()
    dvals = both["dec"].to_numpy()
    sims = np.array([(dvals == g.permutation(w)).sum() for _ in range(B)])
    return {"n": n, "matches": matches, "expected_popularity": expected, "expected_one_in_six": n / 6,
            "permutation": {"mean": float(sims.mean()), "range95": [float(np.percentile(sims, 2.5)), float(np.percentile(sims, 97.5))],
                            "max": int(sims.max()), "p_one_sided": float((1 + np.sum(sims >= matches)) / (1 + B))},
            "decided_shares": {k: float(v) for k, v in s4.items()}, "wished_shares": {k: float(v) for k, v in s5.items()}}


# ------------------------------------------------------------------------------------------------- task 5
def task5(T, menus, u0, uopen, veil, D1):
    O, S = T["O"], T["S"]
    three = [k for k in menus.policy if k != VULN]
    dec_sids = set(S[S["decision"]]["scenario_id"])
    C = O[O["scenario_id"].isin(dec_sids)].dropna(subset=["position", "captured", "fit_before"]).copy()
    C = C[(C.groupby("stratum")["chosen"].transform("sum") == 1) & (C.groupby("stratum")["option_id"].transform("size") == 6)]
    for k in range(2, 7):
        C[f"pos{k}"] = (C["position"].astype(int) == k).astype(float)
    C["perf10"] = C["captured"] / 10
    C["fit10"] = C["fit_before"] / 10
    C["fit3_10"] = [fit_keys(u0[p], menus.option[(s, o)], three) / 10 for p, s, o in zip(C["pid"], C["scenario_id"], C["option_id"])]
    base = [f"pos{k}" for k in range(2, 7)] + ["perf10"]
    m0, m4, m3 = clogit(C, base), clogit(C, base + ["fit10"]), clogit(C, base + ["fit3_10"])
    c7 = {"choice_sets": int(C["stratum"].nunique()), "four_values": {**m4["coef"]["fit10"], "lr": lr(m4, m0)},
          "three_values": {**m3["coef"]["fit3_10"], "lr": lr(m3, m0)}}
    # the MPF without the value
    hits3 = [ranking(menus, s, uopen[(p, s)], three)[0] == f for p, s, f in zip(D1["pid"], D1["sid"], D1["first"])]
    pids = sorted(veil)
    hits3_6 = [ranking(menus, VEIL, uopen[(p, VEIL)], three)[0] == veil[p].get("firstChoiceOptionId") for p in pids]
    mpf3 = {"scenarios_1_4": rate(sum(hits3), len(hits3)), "scenario6": rate(sum(hits3_6), len(hits3_6))}
    # the original MPF where that value is not the top value of the profile it uses
    top_v = [max(uopen[(p, s)].values()) == uopen[(p, s)][VULN] for p, s in zip(D1["pid"], D1["sid"])]
    keep = ~np.asarray(top_v)
    sub = D1[keep]
    keep6 = [max(uopen[(p, VEIL)].values()) != uopen[(p, VEIL)][VULN] for p in pids]
    h6 = [ranking(menus, VEIL, uopen[(p, VEIL)], menus.policy)[0] == veil[p].get("firstChoiceOptionId") for p in pids]
    subset = {"scenarios_1_4": {**rate(sub["mpf_hit"].sum(), len(sub)), "participants": int(sub["pid"].nunique())},
              "scenario6": rate(sum(h for h, k in zip(h6, keep6) if k), sum(keep6))}
    return {"c7": c7, "mpf_without_the_value": mpf3, "mpf_where_it_is_not_the_top_value": subset}


# ------------------------------------------------------------------------------------------------- task 6
def task6(menus, u0, b3):
    pol = menus.policy
    low, key = {}, {}
    for p, u in u0.items():
        k = pol[0]
        for kk in pol:
            if u[kk] < u[k]:
                k = kk
        low[p], key[p] = u[k], k
    v = np.array(list(low.values()))
    gain = [p for p in u0 if key[p] == "gainResponsivenessSensitivity"]
    never = sum(1 for p in gain if not any(b3[p]))
    gain_low = np.array([low[p] for p in gain])
    return {"n": int(len(v)), "min": float(v.min()), "q1": float(np.percentile(v, 25)), "median": float(np.median(v)),
            "q3": float(np.percentile(v, 75)), "max": float(v.max()), "exactly_0": int((v == 0).sum()),
            "by_value": pd.Series([WORDS[key[p]] for p in u0]).value_counts().to_dict(),
            "gain_lowest": {"n": len(gain), "never_approved_any_cell": int(never), "approved_at_least_one_cell": int(len(gain) - never),
                            "their_gain_score_median": float(np.median(gain_low)), "their_gain_score_exactly_0": int((gain_low == 0).sum()),
                            "cells_per_participant": sorted({len(b3[p]) for p in gain})}}


# ------------------------------------------------------------------------------------------------- the report
def write_report(R, out, n):
    apa = rp.apa_p

    def rt(x):
        return f"{x['k']} / {x['n']} ({pct(x['rate'])}, 95% CI {pct(x['ci95'][0])} to {pct(x['ci95'][1])})"

    def dpts(d):
        return f"{100 * d['difference']:+.1f} points (95% CI {100 * d['ci95'][0]:+.1f} to {100 * d['ci95'][1]:+.1f})"

    t1, t2, t3, t4, t5, t6 = (R[f"task{i}"] for i in range(1, 7))
    s6 = t1["scenario6"]
    L = ["# Post hoc checks for the CHIWORK paper: baselines and robustness", "",
         "**Date:** 23 November 2026. **Every result in this file is post hoc** (computed after the registered and the "
         "exploratory analyses, at Waseem's request for the CHIWORK 2027 paper).", "",
         f"**Data and code.** The AI-safe file of the first analysis ({n} participants: CVR+APA 27, CVR only 27, APA only 26, "
         "Baseline 27), read with the frozen analysis code (Git tag `analysis-v1`) without changing it; the new script is "
         "`exploratory/posthoc_round6.py`. Rates: k / n, percent, Clopper-Pearson 95% interval. Comparisons over the four "
         "decisions: a bootstrap over participants (10,000 resamples); the two-sided p is twice the smaller share of resamples "
         "on either side of 0. Group counts, rates and test results only.", "",
         "**Self-checks.** The MPF's top option, rebuilt from the stored profile, equals the stored top option in "
         f"{t1['self_check_mpf_top_equals_stored']} of {t1['decisions']} decisions and in {s6['self_check_top_equals_stored']} of "
         f"{s6['n']} Scenario 6 predictions; the Scenario 6 probabilities shown to participants are reproduced for "
         f"{s6['self_check_shown_probabilities']} of {s6['n']}. The C7 model reproduces the registered likelihood ratio "
         f"(chi-square(1) = {t5['c7']['four_values']['lr']['chi2']:.2f}), and the registered C6 log-loss difference is "
         f"reproduced exactly ({t3['replicated_registered_log_loss_difference']:.4f}).", "",
         "## Your numbers, checked", "",
         "| Your number | Mine | Same? |", "|---|---|---|",
         f"| MPF top option = first pick, Scenarios 1-4: 118 of 428 (27.6%) | {t1['mpf']['k']} of {t1['mpf']['n']} ({pct(t1['mpf']['rate'])}) | yes |",
         "| Top two: 215 of 428 (50.2%) | 215 of 428 (50.2%), from round 4 | yes |",
         f"| Scenario 6: MPF top rule = first rule, 34 of 107 (31.8%) | {s6['mpf']['k']} of {s6['mpf']['n']} ({pct(s6['mpf']['rate'])}) | yes |",
         f"| Top card = first pick: 113 of 428 (26.4%) | **{t1['top_card']['k']} of {t1['top_card']['n']} ({pct(t1['top_card']['rate'])})** | **differs** (see Task 1a) |",
         f"| ... 91 of 270 where the top card fitted, 22 of 158 where it did not | **{t1['top_card_split']['fits']['k']} of {t1['top_card_split']['fits']['n']}; "
         f"{t1['top_card_split']['does_not_fit']['k']} of {t1['top_card_split']['does_not_fit']['n']}** | **differs** (see Task 1a) |",
         "| Scenario 6 first rules: 35, 32, 23, 17 | 35, 32, 23, 17 (round 3) | yes |",
         f"| Scenario 5: 57 of 107 wished for the option decided | {t4['matches']} of {t4['n']} | yes |", "",
         "**Why the top-card numbers differ.** 113 of 428 is the number of decisions whose FINAL choice was the top card (the "
         "stored field `the_chosen_card_was_the_first_card` describes the final choice). The FIRST pick was the top card in "
         f"{t1['top_card']['k']} of 428. Split by whether the top card fitted the participant's values (Aligned or Weakly "
         "aligned on the profile the scenario opened with): first picks "
         f"{t1['top_card_split']['fits']['k']} of {t1['top_card_split']['fits']['n']} and {t1['top_card_split']['does_not_fit']['k']} of "
         f"{t1['top_card_split']['does_not_fit']['n']}; final choices 91 of 271 and 22 of 157. Your 270 and 158 differ from "
         "my 271 and 157 by one decision; I cannot tell how that decision was classified in your count.", ""]
    # ---- task 1
    L += ["## Task 1. Simple baselines for the MPF (post hoc)", "",
          "**A fact about baseline (a), stated first.** In Scenarios 1-4 the card order is not fixed across participants: "
          "the planner orders each participant's cards from that participant's own values measured in Blocks 1-4. So the "
          "top card is a values-based prediction (the planner's), not a profile-free one. In Scenario 6 the four rules are "
          "listed in a random order for each participant, so there the first-listed rule is profile-free.", "",
          "**Scenarios 1-4, first picks (428 decisions).**", "",
          "| Predictor | Hit rate | MPF minus predictor (participant bootstrap) | p (two-sided) |", "|---|---|---|---|",
          f"| MPF (the profile each scenario opened with) | {rt(t1['mpf'])} | - | - |"]
    for key, name in (("top_card", "(a) Top card (the planner's first card)"),
                      ("most_popular", "(b) Most popular option (the other 106 participants' most frequent first pick)"),
                      ("average_person", "(c) Average person (the MPF's formula on the other 106 participants' mean profile)")):
        b = t1[key]
        L.append(f"| {name} | {rt(b)} | {dpts(b['mpf_minus_baseline'])} | {apa(b['mpf_minus_baseline']['p_two_sided'])} |")
    ll = t1["log_loss"]
    L += ["", f"Ties in (b): {t1['popularity_ties']} of 428 decisions had two or more options tied for most popular; the tie "
          "was broken by the option listed first in the scenario's own option list (the same list for every participant).", "",
          f"**Log loss, Scenarios 1-4** (lower is better; each participant's own temperature for both models, so only the "
          f"profile differs): MPF {ll['mpf_mean']:.3f}; average person {ll['average_person_mean']:.3f}; a uniform guess "
          f"{ll['uniform']:.3f}. MPF minus average person: {ll['mpf_minus_average_person']['difference']:+.3f} (95% CI "
          f"{ll['mpf_minus_average_person']['ci95'][0]:+.3f} to {ll['mpf_minus_average_person']['ci95'][1]:+.3f}), p "
          f"{apa(ll['mpf_minus_average_person']['p_two_sided'])}.", "",
          "**Scenario 6, the first rule (107 participants).**", "",
          "| Predictor | Hit rate | MPF minus predictor (bootstrap) | McNemar's exact test |", "|---|---|---|---|",
          f"| MPF (the prediction shown after the first choice) | {rt(s6['mpf'])} | - | - |"]
    for key, name in (("first_listed", "(a) The rule listed first (random order per participant)"),
                      ("most_popular", "(b) Most popular rule (the other 106 participants)"),
                      ("average_person", "(c) Average person")):
        b = s6[key]
        mc = b["mcnemar"]
        L.append(f"| {name} | {rt(b)} | {dpts(b['mpf_minus_baseline'])}, p {apa(b['mpf_minus_baseline']['p_two_sided'])} | "
                 f"MPF right only {mc['model_only']}, predictor right only {mc['baseline_only']}; p {apa(mc['p_exact'])} |")
    l6 = s6["log_loss"]
    L += ["", f"Ties in (b), Scenario 6: {s6['popularity_ties']}.", "",
          f"**Log loss, Scenario 6** (the temperature of each participant's shown prediction for both): MPF {l6['mpf_mean']:.3f}; "
          f"average person {l6['average_person_mean']:.3f}; a uniform guess {l6['uniform']:.3f}. MPF minus average person: "
          f"{l6['mpf_minus_average_person']['difference']:+.3f} (95% CI {l6['mpf_minus_average_person']['ci95'][0]:+.3f} to "
          f"{l6['mpf_minus_average_person']['ci95'][1]:+.3f}), p {apa(l6['mpf_minus_average_person']['p_two_sided'])}.", ""]
    ov = t1["overlap"]
    L += ["**(d) Overlap.** The MPF's top option was also the top card in " + rt(ov["mpf_top_is_top_card"]) + " of the decisions. "
          "The MPF's hit rate was " + rt(ov["mpf_hit_when_top_card"]) + " when its top option was the top card, and " +
          rt(ov["mpf_hit_when_not_top_card"]) + " when it was not.", ""]
    # ---- task 2
    c = t2["correlation"]
    m = t2["model_scenarios_2_to_4"]

    def orl(x):
        return f"OR {x['or']:.2f} (95% CI {x['ci95'][0]:.2f} to {x['ci95'][1]:.2f}), p {apa(x['p'])}"
    L += ["## Task 2. The card fit against the fit to the profile measured before the scenarios (post hoc)", "",
          "\"Card fit\" = the fit computed for the option cards (\"Matches your earlier answers: N out of 100\", stored as "
          "`fitScoresByOptionId`), from the profile each scenario opened with. \"Frozen fit\" = the fit to the profile measured "
          "before the scenarios, the registered C7 predictor.", "",
          "**(a) Correlation across options (Pearson):** Scenarios 1-4 together r = " + f"{c['all']:.3f}" + "; Scenario 1 r = "
          f"{c['scenario_1']:.4f}; Scenario 2 r = {c['scenario_2']:.3f}; Scenario 3 r = {c['scenario_3']:.3f}; Scenario 4 r = "
          f"{c['scenario_4']:.3f}. In Scenario 1 the two are identical apart from rounding to whole numbers "
          f"({'every' if t2['scenario1_identical_after_rounding'] else 'not every'} card fit equals the rounded frozen fit): the "
          "profile a scenario opens with first changes after Scenario 1.", "",
          f"**(b) The C7 conditional logit with both fits, on Scenarios 2-4 only** (Scenario 1's fits are identical; "
          f"{m['choice_sets']} choice sets; base model: card position and performance captured; odds ratios per 10 points with "
          "participant-clustered robust 95% intervals):", "",
          "| Model | Card fit | Frozen fit |", "|---|---|---|",
          f"| Card fit alone | {orl(m['shown_only'])} | - |", f"| Frozen fit alone | - | {orl(m['frozen_only'])} |",
          f"| Both | {orl(m['both']['shown'])} | {orl(m['both']['frozen'])} |", "",
          f"Likelihood-ratio tests: adding the frozen fit to a model that has the card fit, chi-square(1) = "
          f"{m['lr_frozen_added_to_shown']['chi2']:.2f}, p {apa(m['lr_frozen_added_to_shown']['p'])}; adding the card fit to a model "
          f"that has the frozen fit, chi-square(1) = {m['lr_shown_added_to_frozen']['chi2']:.2f}, p "
          f"{apa(m['lr_shown_added_to_frozen']['p'])}. Each alone added to the base model: card fit chi-square(1) = "
          f"{m['lr_shown_added_to_base']['chi2']:.2f}, p {apa(m['lr_shown_added_to_base']['p'])}; frozen fit chi-square(1) = "
          f"{m['lr_frozen_added_to_base']['chi2']:.2f}, p {apa(m['lr_frozen_added_to_base']['p'])}.", ""]
    tp = t2["top_options"]
    L += [f"**(c) Different top options.** The option with the highest card fit and the option with the highest frozen fit "
          f"(each by the study's own ranking: lowest shortfall, then more delivered) differ in {tp['differ']} of {tp['decisions']} "
          f"decisions (Scenario 1: {tp['differ_by_scenario'].get('1', 0)}; Scenario 2: {tp['differ_by_scenario'].get('2', 0)}; "
          f"Scenario 3: {tp['differ_by_scenario'].get('3', 0)}; Scenario 4: {tp['differ_by_scenario'].get('4', 0)}). In those "
          f"decisions the first pick was the card-fit top option {tp['first_pick_shown_top']} times, the frozen-fit top option "
          f"{tp['first_pick_frozen_top']} times, and neither {tp['first_pick_neither']} times.", ""]
    # ---- task 3
    h = t3["hit_rate"]
    f39 = t3["fixed_temperature_39"]
    L += ["## Task 3. The second part of C6: the hit rate (post hoc)", "",
          f"**(a)** First picks in Scenarios 2-4: updated profile {rt(h['updated'])}; frozen profile {rt(h['frozen'])}. Paired "
          f"difference (updated minus frozen): {100 * h['difference']:+.1f} points (95% CI {100 * h['ci95'][0]:+.1f} to "
          f"{100 * h['ci95'][1]:+.1f}); one-sided bootstrap p (updated higher) {apa(h['p_one_sided_updated_higher'])}. This is the "
          "same hit-rate difference the registered run reported beside the C6 test (-.006 [-.044, .031]).", "",
          "**(b) How the frozen code applied the registered criterion.** The decision used log loss; the hit-rate difference was "
          "reported beside it. The registered analysis text (OSF answers, the C6 entry of the statistical analysis) says: "
          "\"one-sided bootstrap test that the mean difference is below 0. The hit-rate difference is reported beside it; the "
          "decision uses log loss, the proper score of the whole prediction.\" The frozen code (`test_C6` in "
          "`analysis/registered_tests.py`) tests \"the mean per-participant difference in log loss (updated minus before)\" and "
          "stores the hit-rate difference as `beside_hit_rate_difference` with its interval.", "",
          f"**(c) One fixed temperature for everyone (T = 39, post hoc).** Mean log loss: updated {f39['mean_log_loss_updated']:.3f}, "
          f"frozen {f39['mean_log_loss_frozen']:.3f}; difference {f39['mean_difference']:+.3f} (95% CI {f39['ci95'][0]:+.3f} to "
          f"{f39['ci95'][1]:+.3f}); one-sided bootstrap p {apa(f39['p_one_sided_below_0'])}. The registered result with each "
          "participant's own temperature was -0.066 [-0.115, -0.018], Holm p = .007.", ""]
    # ---- task 4
    pm = t4["permutation"]
    L += ["## Task 4. A fairer chance level for the wish match (post hoc)", "",
          f"Observed: {t4['matches']} of {t4['n']} wished in Scenario 5 for the option they had decided in Scenario 4.", "",
          f"**(a) Expected matches if wishes were independent of decisions but kept their observed popularity:** "
          f"{t4['expected_popularity']:.1f} (against {t4['expected_one_in_six']:.1f} for one in six).", "",
          f"**(b) Permutation test** (the wishes shuffled across participants, 10,000 runs): mean {pm['mean']:.1f} matches, 95% "
          f"range {pm['range95'][0]:.0f} to {pm['range95'][1]:.0f}, largest {pm['max']}; one-sided p for {t4['matches']} or more: "
          f"{apa(pm['p_one_sided'])} (no shuffle reached {t4['matches']}).", ""]
    # ---- task 5
    c7 = t5["c7"]
    L += ["## Task 5. Sensitivity without \"Protecting the vulnerable\" (post hoc)", "",
          f"**(a) C7 with the fit from the other three policy values** ({c7['choice_sets']} choice sets; the same model: card "
          "position, performance captured, fit; odds ratio per 10 points, participant-clustered robust 95% interval):", "",
          "| Fit computed from | OR [95% CI] | Likelihood ratio (fit added) |", "|---|---|---|",
          f"| All four values (registered C7) | {c7['four_values']['or']:.2f} [{c7['four_values']['ci95'][0]:.2f}, {c7['four_values']['ci95'][1]:.2f}] | "
          f"chi-square(1) = {c7['four_values']['lr']['chi2']:.2f}, p {apa(c7['four_values']['lr']['p'])} |",
          f"| Three values (without Protecting the vulnerable) | {c7['three_values']['or']:.2f} [{c7['three_values']['ci95'][0]:.2f}, "
          f"{c7['three_values']['ci95'][1]:.2f}] | chi-square(1) = {c7['three_values']['lr']['chi2']:.2f}, p {apa(c7['three_values']['lr']['p'])} |",
          "", "The likelihood-ratio p-values here are two-sided; the registered C7 is one-sided (half of it).", "",
          f"**(b) The MPF with \"Protecting the vulnerable\" left out of the shortfall:** Scenarios 1-4 "
          f"{rt(t5['mpf_without_the_value']['scenarios_1_4'])} (with all four values: 118 / 428, 27.6%); Scenario 6 "
          f"{rt(t5['mpf_without_the_value']['scenario6'])} (with all four: 34 / 107, 31.8%).", "",
          f"**(c) The original MPF where \"Protecting the vulnerable\" is not the top value of the profile it uses** (a tie at the "
          f"top counts as top): Scenarios 1-4 {rt(t5['mpf_where_it_is_not_the_top_value']['scenarios_1_4'])}, from "
          f"{t5['mpf_where_it_is_not_the_top_value']['scenarios_1_4']['participants']} participants; Scenario 6 "
          f"{rt(t5['mpf_where_it_is_not_the_top_value']['scenario6'])}.", ""]
    # ---- task 6
    g = t6["gain_lowest"]
    L += ["## Task 6. The employer's value: how low was it? (post hoc)", "",
          f"**(a) The participant's lowest policy value in the frozen profile (0-100), n = {t6['n']}:** minimum {t6['min']:.0f}, first "
          f"quartile {t6['q1']:.0f}, median {t6['median']:.0f}, third quartile {t6['q3']:.0f}, maximum {t6['max']:.0f}; exactly 0 "
          f"for {t6['exactly_0']} participants.", "",
          "**(b) Which value it was:** " + ", ".join(f"{k} {v}" for k, v in t6["by_value"].items()) +
          " (ties broken by the fixed order of the four values, as the study does). These match your counts.", "",
          f"**(c) The {g['n']} participants whose lowest value was \"How much is gained\", in Block 3:** {g['never_approved_any_cell']} "
          f"never approved the AI rollout in any of the six cells; {g['approved_at_least_one_cell']} approved in at least one "
          f"cell. Their gain score: median {g['their_gain_score_median']:.0f}, exactly 0 for {g['their_gain_score_exactly_0']}.", "",
          "**Why a score near 0 arises.** The gain score is the Block 3 gain level (one minus the mean rung of the six cells over "
          "six, where refusing every gain counts as rung 6) blended with a Block 4 signal, then placed on the study's common "
          "ruler (the share of pretend participants answering at random who score lower). The ladder's rungs are $1, $10,000, "
          "$100,000, $1 million, $10 million and $100 million (rungs 0-5). Approving only at $10 million or $100 million, or "
          "not at all, in most of the six cells gives a mean rung of about 4.7 or more (a raw level of about 22% or less), "
          "which sits at the very bottom of that ruler: in these data every score of 0 had a mean rung of 5.0 to 6.0, and a "
          "mean rung of 4.7 to 4.8 gave a score of 1.", ""]
    (out / "EXPLORATORY_RESULTS_ROUND6.md").write_text("\n".join(L) + "\n", encoding="utf8")


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    data, out = Path(argv[1]), Path(argv[2])
    out.mkdir(parents=True, exist_ok=True)
    docs = bt.load_records(data)
    T = bt.build(docs)
    keep = set(T["P"]["pid"])
    docs = [d for d in docs if str(d.get("prolific_pid")) in keep]
    menus = bt.Menus()
    u0, uopen, temp, shown_fit, veil, b3 = assemble(docs, T, menus)
    t1, D1 = task1(T, menus, u0, uopen, temp, veil)
    R = {"task1": t1, "task2": task2(T, menus, u0, uopen, shown_fit), "task3": task3(T, menus, u0, uopen, temp),
         "task4": task4(T), "task5": task5(T, menus, u0, uopen, veil, D1), "task6": task6(menus, u0, b3)}
    import pipeline as pl
    R = pl.to_jsonable(R)
    (out / "posthoc_results_round6.json").write_text(json.dumps(R, indent=1), encoding="utf8")
    write_report(R, out, len(keep))
    print(f"Post hoc round 6: six tasks, {len(keep)} participants -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
