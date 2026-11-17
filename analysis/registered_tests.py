"""registered_tests.py: the analysis registered on OSF (https://osf.io/jvxcz/, page 6), test by test (17 November 2026).

Part 4 of PLAN_Analysis_code.md. It runs, on the tables of build_tables.py:

  1. the manipulation (fidelity) checks and the exposure counts, reported first;
  2. the three positive controls in Blocks 1-3;
  3. the 23 hypotheses A1-D5, each exactly as the registration states it (the words are quoted beside each test);
  4. Holm's correction: the four primary hypotheses together, the secondary ones within their family; B7, C2 and D4 are
     intersection-union tests (the larger of their two p-values, no further correction);
  5. the robustness checks: every test again without each of the four groups the registration names, and family B
     again on the menu-adjusted departure.

The missing-data rule (OSF page 6): a participant who lacks a value a test needs leaves that test only; the number is
reported with every test ("left_out_missing"). No analysis rule is decided here. Where the registration leaves a detail
to the software, the choice is stated in stats_tools.py or beside the test, before any data are opened.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy import stats

import stats_tools as st

ALPHA = 0.05
RANDOM_LEVEL = {"CVR+APA": 57, "CVR_Only": 60, "APA_Only": 63, "Baseline": 60}   # OSF D3, the registered levels
PRIMARY = ["A1", "B1", "C1", "D1"]
FAMILIES = {"A": ["A2", "A3", "A4"], "B": ["B2", "B3", "B4", "B5", "B6", "B7"],
            "C": ["C2", "C3", "C4", "C5", "C6", "C7"], "D": ["D2", "D3", "D4", "D5"]}
ONE_SIDED = {"A1", "A2", "A3", "A4", "B2", "B3", "B4", "B5", "B6", "B7", "C1", "C2", "C3", "C4", "C5", "C6", "C7",
             "D2", "D3", "D4", "D5"}
ROBUSTNESS = {
    "without_fast_blocks": ("flag_fast_blocks", "answered very fast in Blocks 1-3 (median under 2 seconds between answers)"),
    "without_fast_scenarios": ("flag_fast_scenarios", "two or more scenarios decided in under 15 seconds"),
    "without_straightliners": ("flag_straightlined", "the same answer to every feedback rating (at least 8 ratings)"),
    "without_attention_wrong": ("flag_attention_wrong", "any attention check answered wrongly"),
}
S1_ID, S2_ID, S3_ID, S4_ID, S5_ID, S6_ID = (
    "chemical_release_escape", "wildfire_household_evacuation", "cancer_treatment_allocation",
    "care_rota_reduction", "care_rota_receiving", "veil_emergency_reserve_rule")


def _wide(S: pd.DataFrame, col: str) -> pd.DataFrame:
    return S.pivot_table(index="pid", columns="order", values=col, aggfunc="first")


def _paired(P: pd.DataFrame, values: pd.Series) -> tuple[np.ndarray, int]:
    v = values.reindex(P["pid"]).to_numpy(dtype=float)
    return v, int(np.sum(np.isnan(v)))


def _with(res: dict, **extra) -> dict:
    res = dict(res)
    res.update(extra)
    return res


# ------------------------------------------------------------------------------------------------- fidelity, exposure
def fidelity(P: pd.DataFrame, S: pd.DataFrame) -> dict:
    """OSF: 'each condition's pages appear only in that condition (the reflection only in CVR+APA and CVR only; the
    clarification page only in CVR+APA and APA only; the confirmation page with "How sure" on every choice only in
    Baseline); any exception is reported. Exposure: the number and share of participants in each condition who met their
    condition's page at least once.'"""
    per = S.groupby("pid").agg(reflection=("reflection_visits", "sum"), clarification=("clarification_visits", "sum"),
                               rejection=("rejection_page_visits", "sum"), confirm_misfit=("confirm_misfit_visits", "sum"),
                               confirm_good=("confirm_good_fit_visits", "sum"), how_sure=("how_sure_asked", "sum"))
    per = per.join(P.set_index("pid")["condition"])
    allowed = {"reflection": {"CVR+APA", "CVR_Only"}, "clarification": {"CVR+APA", "APA_Only"},
               "rejection": {"CVR_Only"}, "confirm_misfit": {"Baseline"}, "confirm_good": {"Baseline"}, "how_sure": {"Baseline"}}
    exceptions = []
    for page, ok in allowed.items():
        bad = per[(per[page] > 0) & (~per["condition"].isin(ok))]
        for pid, row in bad.iterrows():
            exceptions.append({"participant": pid, "condition": row["condition"], "page": page})
    # Baseline: "How sure" on EVERY choice in the four decisions (a row without it is an exception too)
    bs = S[(S["condition"] == "Baseline") & S["decision"]]
    for _, row in bs[~bs["how_sure_asked"]].iterrows():
        exceptions.append({"participant": row["pid"], "condition": "Baseline", "page": "a decision without How sure",
                           "scenario": row["scenario_id"]})
    exposure = {}
    for c, pages in {"CVR+APA": ["reflection", "clarification"], "CVR_Only": ["reflection", "rejection"],
                     "APA_Only": ["clarification"], "Baseline": ["confirm_misfit", "confirm_good"]}.items():
        sub = per[per["condition"] == c]
        exposure[c] = {"participants": int(len(sub)),
                       **{f"met_{p}_page": {"n": int((sub[p] > 0).sum()),
                                            "share": float((sub[p] > 0).mean()) if len(sub) else float("nan")} for p in pages}}
    return {"exceptions": exceptions, "exceptions_count": len(exceptions), "exposure": exposure}


# ------------------------------------------------------------------------------------------------- positive controls
def positive_controls(P: pd.DataFrame, boot: bool) -> dict:
    """OSF: more lives before pushing than before pulling (Block 2); money kept less readily outside the homeless shelter than
    on the public sidewalk (Block 1); a higher gain before harming workers with little to fall back on than workers with a
    strong safety net (Block 3). One-sided Wilcoxon signed-rank on the rungs (never accepted = the rung past the last one:
    8 in Blocks 1-2, 6 in Block 3; Block 3 compares each participant's mean over the three group sizes)."""
    out = {}
    for key, a, b, words in [
        ("push_vs_pull", "trolley_bridge", "trolley_lever", "more lives required before pushing than before pulling"),
        ("shelter_vs_sidewalk", "money_shelter", "money_sidewalk", "money kept less readily outside the shelter"),
        ("entry_level_vs_safety_net", "ai_low_buffer_mean", "ai_high_buffer_mean", "a higher gain before harming entry-level workers"),
    ]:
        d = (P[a] - P[b]).to_numpy(dtype=float)
        r = st.signed_rank(d, f"control:{key}", "greater", boot=boot)
        out[key] = _with(r, claim=words, left_out_missing=int(np.isnan(d).sum()), present=bool(r["p"] < ALPHA))
    return out


# ------------------------------------------------------------------------------------------------- the 23 hypotheses
# One function per hypothesis, each taking the tables (P, S, O) and returning its result. `hypotheses()` runs them all;
# the checks on simulated studies (check_on_simulated.py) call them one at a time.
def _dep(P, S, col):
    dep = _wide(S, col).reindex(P["pid"])
    get = lambda o: dep[o].to_numpy(dtype=float) if o in dep.columns else np.full(len(P), np.nan)   # noqa: E731
    return [get(o) for o in range(1, 7)]


def _vci_test(hid, other):
    def f(P, S, O, boot=True, departure_col="departure"):
        a, b = P.loc[P["condition"] == "CVR+APA", "vci"], P.loc[P["condition"] == other, "vci"]
        r = _with(st.mann_whitney(a, b, hid, "greater", boot=boot), claim=f"VCI higher in CVR+APA than in {other}",
                  left_out_missing=int(a.isna().sum() + b.isna().sum()))
        if hid == "A1":
            import statsmodels.api as sm
            sub = P.dropna(subset=["vci"])
            X = pd.DataFrame({"cvr": np.where(sub["cvr"], 0.5, -0.5), "apa": np.where(sub["apa"], 0.5, -0.5)})
            X["cvr_x_apa"] = X["cvr"] * X["apa"]
            fit = sm.OLS(sub["vci"].to_numpy(float), sm.add_constant(X.to_numpy(float))).fit()
            r["beside_two_way_anova"] = {"note": "description only, not used for the decision",
                                         **{name: {"estimate": float(fit.params[i + 1]), "t": float(fit.tvalues[i + 1]),
                                                   "p_two_sided": float(fit.pvalues[i + 1])}
                                            for i, name in enumerate(["CVR", "APA", "CVR x APA"])}}
        return r
    return f


def test_A4(P, S, O, boot=True, departure_col="departure"):
    """Decisions in scenarios 1-4 whose FIRST pick was Misaligned or Strongly misaligned: good final fit ~ help + (1 | pid)."""
    dec = S[S["decision"] & S["first_misfit"]].dropna(subset=["final_good_fit"])
    y = dec["final_good_fit"].astype(int).to_numpy()
    x = dec["condition"].isin(["CVR+APA", "CVR_Only", "APA_Only"]).astype(int).to_numpy()
    a4 = {"claim": "after a first pick that went against their values, the final choice fits more often with a help step",
          "decisions": int(len(dec)), "participants": int(dec["pid"].nunique()),
          "good_fit_share_help": float(y[x == 1].mean()) if (x == 1).any() else float("nan"),
          "good_fit_share_baseline": float(y[x == 0].mean()) if (x == 0).any() else float("nan"), "left_out_missing": 0}
    if len(dec) >= 10 and 0 < x.mean() < 1 and 0 < y.mean() < 1:
        m = st.mixed_logistic(y, x, dec["pid"].to_numpy())
        used = m
        if not m["converged"] or m["singular"] or not np.isfinite(m.get("se_help", np.nan)):
            used = st.clustered_logistic(y, x, dec["pid"].to_numpy())
            used["why_the_fallback"] = "the mixed model did not converge or was singular (OSF page 6)"
            a4["mixed_model_tried"] = m
        z = used["help"] / used["se_help"]
        a4.update({"model": used, "test": used["model"] + "; one-sided Wald test",
                   "z": float(z), "p": float(stats.norm.sf(z)), "estimate": float(used["help"]),
                   "odds_ratio": float(math.exp(used["help"])),
                   "ci95_odds_ratio": [float(math.exp(used["help"] - 1.959964 * used["se_help"])),
                                       float(math.exp(used["help"] + 1.959964 * used["se_help"]))]})
    else:
        a4.update({"p": float("nan"), "note": "too few decisions, or no variation, to fit the model"})
    return a4


B_SPECS = {
    "B1": (lambda d: d[4] - d[3], "two-sided", "departure differs between receiving (5) and deciding under an employer (4)"),
    "B2": (lambda d: (d[0] + d[1]) / 2 - d[2], "greater", "larger when their own safety is at stake (1, 2) than for others only (3)"),
    "B3": (lambda d: d[1] - d[0], "greater", "larger deciding for the household (2) than alone (1)"),
    "B4": (lambda d: d[3] - d[2], "greater", "larger under an employer's rules (4) than deciding freely for others (3)"),
    "B5": (lambda d: (d[0] + d[1]) / 2 - d[5], "greater",
           "smaller behind the veil (6, the rule chosen before the prediction) than in 1 and 2"),
}


def b_difference(P, S, hid, departure_col="departure"):
    return B_SPECS[hid][0](_dep(P, S, departure_col))


def _b_test(hid):
    def f(P, S, O, boot=True, departure_col="departure"):
        diff = b_difference(P, S, hid, departure_col)
        _, alt, claim = B_SPECS[hid]
        return _with(st.signed_rank(diff, f"{hid}:{departure_col}", alt, boot=boot), claim=claim,
                     left_out_missing=int(np.isnan(diff).sum()))
    return f


def test_B6(P, S, O, boot=True, departure_col="departure"):
    gap = P["wish_gap"].to_numpy(dtype=float)
    return _with(st.signed_rank(gap, "B6", "greater", zero_method="pratt", boot=boot),
                 claim="the wish fits their values better than their own decision in scenario 4",
                 left_out_missing=int(np.isnan(gap).sum()), beside_sign_test=st.sign_test(gap))


def position_spread(P, S, departure_col="departure"):
    if departure_col == "departure":
        return P["position_spread"].to_numpy(float)
    d1, d2, d3, d4, d5, _ = _dep(P, S, departure_col)   # the menu-adjusted spread, over scenarios 1-5
    adj = np.vstack([d1, d2, d3, d4, d5])
    sp = np.nanmax(adj, axis=0) - np.nanmin(adj, axis=0)
    sp[np.isnan(adj).any(axis=0)] = np.nan
    return sp


def test_B7(P, S, O, boot=True, departure_col="departure"):
    sp = position_spread(P, S, departure_col)
    place = P["place_spread"].to_numpy(float)
    rho = st.spearman(place, sp, f"B7:rho:{departure_col}", boot=boot)
    prt = st.partial_spearman(place, sp, P["vci"].to_numpy(float), f"B7:partial:{departure_col}", boot=boot)
    return {"claim": "a larger Block 1 place spread goes with a larger position spread, also with VCI held fixed",
            "test": "intersection-union: one-sided Spearman and one-sided partial Spearman (VCI held fixed)",
            "spearman": rho, "partial_spearman": prt, "p": max(rho["p"], prt["p"]), "n": rho.get("n"),
            "estimate": rho.get("rho", float("nan")),
            "left_out_missing": int(np.sum(np.isnan(place) | np.isnan(sp) | np.isnan(P["vci"].to_numpy(float))))}


def test_C1(P, S, O, boot=True, departure_col="departure"):
    hit6 = P["s6_hit"].dropna().astype(bool)
    return _with(st.binomial(int(hit6.sum()), int(len(hit6)), 0.25),
                 claim="the MPF's top pick matches the rule chosen before the prediction more often than 25%",
                 left_out_missing=int(P["s6_hit"].isna().sum()))


def test_C2(P, S, O, boot=True, departure_col="departure"):
    first4 = S[S["decision"]].dropna(subset=["mpf_hit_first_updated", "mpf_p_first_updated"])
    t = first4.assign(hit=first4["mpf_hit_first_updated"].astype(float), ll=-np.log(first4["mpf_p_first_updated"].astype(float)))
    per = t.groupby("pid").agg(hits=("hit", "sum"), n=("hit", "size"), logloss=("ll", "sum"))
    c2 = {"claim": "over the four decisions the MPF's top pick matches the first choice more than 1/6, and beats a uniform "
                   "guess on log loss", "test": "intersection-union of two one-sided bootstrap tests over participants",
          "participants": int(len(per)), "decisions": int(per["n"].sum()), "uniform_log_loss": math.log(6),
          "left_out_missing": int(P["pid"].nunique() - len(per))}
    if not len(per):
        return {**c2, "p": float("nan")}
    hit_rate = per["hits"].sum() / per["n"].sum()
    mean_ll = per["logloss"].sum() / per["n"].sum()
    g = st.rng_for("C2")
    idx = g.integers(0, len(per), (st.B, len(per)))
    hb = per["hits"].to_numpy(float)[idx].sum(1) / per["n"].to_numpy(float)[idx].sum(1)
    lb = per["logloss"].to_numpy(float)[idx].sum(1) / per["n"].to_numpy(float)[idx].sum(1)
    c2.update({"hit_rate": float(hit_rate), "mean_log_loss": float(mean_ll), "estimate": float(hit_rate - 1 / 6),
               "p_hit": st.boot_p(hb, 1 / 6, greater=True), "p_log_loss": st.boot_p(lb, math.log(6), greater=False),
               "ci95_hit_rate": st.percentile_ci(hb), "ci95_mean_log_loss": st.percentile_ci(lb)})
    c2["p"] = max(c2["p_hit"], c2["p_log_loss"])
    return c2


def test_C3(P, S, O, boot=True, departure_col="departure"):
    """Logistic regression in scenario 6: hit ~ the MPF's probability for its top rule + condition; one-sided on the slope."""
    import statsmodels.api as sm
    c3d = P.dropna(subset=["s6_hit", "s6_top_p"])
    c3 = {"claim": "the higher the probability the MPF gives its top rule, the more likely the participant chose it",
          "test": "logistic regression hit ~ top-rule probability + condition; one-sided Wald test on the slope",
          "n": int(len(c3d)), "left_out_missing": int(len(P) - len(c3d))}
    try:
        Xc = pd.get_dummies(c3d["condition"], drop_first=False).reindex(columns=list(RANDOM_LEVEL), fill_value=0)
        Xc = Xc.drop(columns="CVR+APA").astype(float)
        Xc = Xc.loc[:, Xc.std() > 0]
        X3 = sm.add_constant(pd.concat([c3d["s6_top_p"].astype(float).rename("top_probability"), Xc], axis=1))
        f3 = sm.Logit(c3d["s6_hit"].astype(float), X3).fit(disp=0)
        b, se = float(f3.params["top_probability"]), float(f3.bse["top_probability"])
        c3.update({"slope": b, "se": se, "z": b / se, "p": float(stats.norm.sf(b / se)), "estimate": b,
                   "odds_ratio_per_10_points": float(math.exp(b * 0.10)),
                   "ci95_odds_ratio_per_10_points": [float(math.exp(0.10 * (b - 1.959964 * se))),
                                                     float(math.exp(0.10 * (b + 1.959964 * se)))]})
        bins = pd.cut(c3d["s6_top_p"], [0, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0])
        c3["calibration"] = [{"bin": str(k), "n": int(len(v)), "mean_predicted": float(v["s6_top_p"].mean()),
                              "observed_hit_rate": float(v["s6_hit"].astype(float).mean())}
                             for k, v in c3d.groupby(bins, observed=True)]
    except Exception as e:     # noqa: BLE001 - a model that cannot be fitted is reported, never hidden
        c3.update({"p": float("nan"), "note": f"the model could not be fitted: {type(e).__name__}"})
    return c3


def test_C4(P, S, O, boot=True, departure_col="departure"):
    c4d = P.dropna(subset=["s6_hit", "s6_sounds_like_me"])
    hit_r = c4d.loc[c4d["s6_hit"].astype(bool), "s6_sounds_like_me"]
    miss_r = c4d.loc[~c4d["s6_hit"].astype(bool), "s6_sounds_like_me"]
    return _with(st.mann_whitney(hit_r, miss_r, "C4", "greater", boot=boot),
                 claim="'sounds like me' is rated higher when the MPF named the chosen rule",
                 left_out_missing=int(len(P) - len(c4d)),
                 beside_spearman=st.spearman(P["s6_p_first"], P["s6_sounds_like_me"], "C4:beside", boot=boot))


def test_C5(P, S, O, boot=True, departure_col="departure"):
    eligible = P[(P["s6_first_rule"] != P["s6_top_rule"]) & (P["s6_changed"] == True)].dropna(subset=["s6_final_rule"])  # noqa: E712
    moved_to_top = int((eligible["s6_final_rule"] == eligible["s6_top_rule"]).sum())
    claim = "those who change after seeing the prediction move to the MPF's top rule more than 1 in 3"
    if len(eligible) >= 20:
        return _with(st.binomial(moved_to_top, len(eligible), 1 / 3), claim=claim, run=True, left_out_missing=0)
    return {"claim": claim, "run": False, "p": float("nan"), "n": int(len(eligible)), "moved_to_top": moved_to_top,
            "note": "fewer than 20 such participants: reported as description, and C5 leaves family C's correction"}


def test_C6(P, S, O, boot=True, departure_col="departure"):
    s24 = S[S["order"].isin([2, 3, 4])].dropna(subset=["mpf_p_first_updated", "mpf_p_first_before"])
    c6 = {"claim": "predictions from the updated profile beat predictions from the profile before the scenarios (log loss)",
          "test": "one-sided bootstrap test on the mean per-participant difference in log loss (updated minus before)"}
    if not len(s24):
        return {**c6, "p": float("nan"), "participants": 0, "left_out_missing": int(P["pid"].nunique())}
    t = s24.assign(llu=-np.log(s24["mpf_p_first_updated"].astype(float)), llb=-np.log(s24["mpf_p_first_before"].astype(float)),
                   hu=s24["mpf_hit_first_updated"].astype(float), hb=s24["mpf_hit_first_before"].astype(float))
    per6 = t.groupby("pid")[["llu", "llb", "hu", "hb"]].mean()
    diff = (per6["llu"] - per6["llb"]).to_numpy()
    hd = (per6["hu"] - per6["hb"]).to_numpy()
    g = st.rng_for("C6")
    idx = g.integers(0, len(diff), (st.B, len(diff)))
    db = diff[idx].mean(1)
    c6.update({"participants": int(len(per6)), "left_out_missing": int(P["pid"].nunique() - len(per6)),
               "mean_difference_log_loss": float(diff.mean()), "estimate": float(diff.mean()),
               "p": st.boot_p(db, 0.0, greater=False), "ci95_mean_difference_log_loss": st.percentile_ci(db),
               "beside_hit_rate_difference": float(hd.mean()), "ci95_hit_rate_difference": st.percentile_ci(hd[idx].mean(1))})
    return c6


def test_C7(P, S, O, boot=True, departure_col="departure"):
    """Conditional logit, one stratum per participant and scenario (the first pick in scenarios 1-4; six options each)."""
    c7d = O.dropna(subset=["position", "captured", "fit_before"])
    full = c7d.groupby("stratum")["chosen"].transform("sum") == 1
    c7d = c7d[full & (c7d.groupby("stratum")["option_id"].transform("size") == 6)]
    c7 = {"claim": "the values from Blocks 1-4 predict the first choice beyond card position and performance",
          "test": "conditional logit; likelihood-ratio test of fit added to position and performance (1 df), one-sided "
                  "(the coefficient in the predicted direction: p is half the likelihood-ratio p when the coefficient is "
                  "positive)", "strata": int(c7d["stratum"].nunique()),
          "left_out_missing": int(O["stratum"].nunique() - c7d["stratum"].nunique())}
    if c7d["stratum"].nunique() < 10:
        return {**c7, "p": float("nan")}
    pos = pd.get_dummies(c7d["position"].astype(int), prefix="position").reindex(
        columns=[f"position_{k}" for k in range(2, 7)], fill_value=0).astype(float)
    X0 = np.column_stack([pos.to_numpy(), c7d["captured"].to_numpy(float)])
    X1 = np.column_stack([X0, c7d["fit_before"].to_numpy(float)])
    m0 = st.conditional_logit(X0, c7d["chosen"].to_numpy(), c7d["stratum"].to_numpy(), c7d["pid"].to_numpy())
    m1 = st.conditional_logit(X1, c7d["chosen"].to_numpy(), c7d["stratum"].to_numpy(), c7d["pid"].to_numpy())
    lr = 2 * (m1["loglik"] - m0["loglik"])
    b = float(m1["beta"][-1])
    p_lr = float(stats.chi2.sf(lr, 1))
    zc = b / m1["se_clustered"][-1]
    c7.update({"likelihood_ratio": float(lr), "p_likelihood_ratio_two_sided": p_lr,
               "fit_coefficient": b, "p": p_lr / 2 if b > 0 else 1 - p_lr / 2, "estimate": b,
               "odds_ratio_per_10_fit_points": float(math.exp(10 * b)),
               "beside_clustered_wald": {"z": float(zc), "p_one_sided": float(stats.norm.sf(zc)),
                                         "se_clustered": float(m1["se_clustered"][-1])},
               "beside_position_fit_correlation": float(stats.spearmanr(c7d["position"], c7d["fit_before"]).statistic),
               "m0_coefficients": dict(zip([*pos.columns, "captured"], map(float, m0["beta"]))),
               "m1_coefficients": dict(zip([*pos.columns, "captured", "fit_before"], map(float, m1["beta"])))})
    return c7


def d1_differences(S, changed_only=False):
    elig = S[S["decision"] & S["first_misfit"] & S["page_opened"]].dropna(subset=["captured_first", "captured_final"])
    if changed_only:
        elig = elig[elig["changed"]]
    return elig.assign(diff=elig["captured_final"] - elig["captured_first"]).groupby("pid")["diff"].mean()


def test_D1(P, S, O, boot=True, departure_col="departure"):
    d1m = d1_differences(S)
    return _with(st.tost_paired(d1m.to_numpy()),
                 claim="after a first pick against their values and the condition's page, performance stays within "
                       "+/-5 points (equivalence)",
                 participants_with_such_a_decision=int(len(d1m)),
                 beside_changed_only=st.tost_paired(d1_differences(S, True).to_numpy()),
                 beside_wilcoxon=st.tost_wilcoxon(d1m.to_numpy()), left_out_missing=0)


def d2_differences(S):
    ch = S[S["decision"] & S["first_misfit"] & S["page_opened"] & S["changed"]
           & S["condition"].isin(["CVR+APA", "CVR_Only", "APA_Only"])].dropna(subset=["shortfall_first", "shortfall_final"])
    return ch.assign(diff=ch["shortfall_first"] - ch["shortfall_final"]).groupby("pid")["diff"].mean()


def test_D2(P, S, O, boot=True, departure_col="departure"):
    return _with(st.signed_rank(d2_differences(S).to_numpy(), "D2", "greater", boot=boot),
                 claim="when a choice changes after a help step, the final choice fits better than the first (shortfall)",
                 note="'help step' as A4 defines it (CVR+APA, CVR only, APA only); Baseline has none", left_out_missing=0)


def test_D3(P, S, O, boot=True, departure_col="departure"):
    d3 = (P["vci"] - P["condition"].map(RANDOM_LEVEL)).to_numpy(float)
    return _with(st.signed_rank(d3, "D3", "greater", boot=boot),
                 claim="VCI is above the random-chooser level of the participant's own condition (57, 60, 63, 60)",
                 left_out_missing=int(np.isnan(d3).sum()))


def test_D4(P, S, O, boot=True, departure_col="departure"):
    return _d4(P)


def test_D5(P, S, O, boot=True, departure_col="departure"):
    return _with(st.spearman(P["value_congruence"], P["vci"], "D5", boot=boot),
                 claim="self-reported value congruence rises with VCI",
                 left_out_missing=int(P[["value_congruence", "vci"]].isna().any(axis=1).sum()))


TESTS = {"A1": _vci_test("A1", "Baseline"), "A2": _vci_test("A2", "APA_Only"), "A3": _vci_test("A3", "CVR_Only"),
         "A4": test_A4, **{h: _b_test(h) for h in ("B1", "B2", "B3", "B4", "B5")}, "B6": test_B6, "B7": test_B7,
         "C1": test_C1, "C2": test_C2, "C3": test_C3, "C4": test_C4, "C5": test_C5, "C6": test_C6, "C7": test_C7,
         "D1": test_D1, "D2": test_D2, "D3": test_D3, "D4": test_D4, "D5": test_D5}


def hypotheses(P: pd.DataFrame, S: pd.DataFrame, O: pd.DataFrame, boot: bool = True,
               departure_col: str = "departure", only=None) -> dict:
    R = {}
    for hid, f in TESTS.items():
        if only is not None and hid not in only:
            continue
        R[hid] = f(P, S, O, boot=boot, departure_col=departure_col)
        R[hid]["predicted_direction"] = _direction(hid, R[hid])
    return R


def _direction(hid: str, r: dict) -> bool:
    """Is the effect in the predicted direction? Read from the statistic the test is built on."""
    if hid in ("B1", "D1"):
        return True                      # B1 is two-sided; D1 is an equivalence test
    if hid in ("A1", "A2", "A3", "C4", "B2", "B3", "B4", "B5", "B6", "D2", "D3"):
        return (r.get("rank_biserial_r") or 0) > 0
    if hid == "C2":
        return r.get("hit_rate", 0) > 1 / 6 and r.get("mean_log_loss", 99) < math.log(6)
    if hid == "C6":
        return (r.get("estimate") or 0) < 0
    if hid == "B7":
        return (r["spearman"].get("rho") or 0) > 0 and (r["partial_spearman"].get("rho_partial") or 0) > 0
    if hid == "D4":
        return all(r.get(k, {}).get("standardized_beta_vci", 0) > 0 for k in ("wellbeing_composite", "decision_satisfaction"))
    return (r.get("estimate") or 0) > 0


def _d4(P: pd.DataFrame) -> dict:
    """OSF: 'two linear regressions, one for the well-being composite and one for decision satisfaction, each on VCI, Stability
    (standardized within condition), overall performance, age, gender, active working minutes and condition, with HC3 robust
    standard errors; one-sided test on VCI's coefficient; supported only if both regressions show it. Variance inflation
    factors are reported.' Every continuous variable z-scored over the sample; gender: female, male, other or prefer not to say,
    the largest category the reference; condition: four levels, CVR+APA the reference (the choice cannot change VCI's test)."""
    import statsmodels.api as sm
    from statsmodels.stats.outliers_influence import variance_inflation_factor
    need = ["wellbeing", "satisfaction", "vci", "stability", "performance", "age", "active_minutes", "gender3", "condition"]
    d = P.dropna(subset=need).copy()
    out = {"claim": "with Stability and performance held fixed, well-being and satisfaction rise with VCI",
           "test": "two OLS regressions with HC3 errors; one-sided on VCI; intersection-union", "n": int(len(d)),
           "left_out_missing": int(len(P) - len(d)),
           "stability_not_tested_flagged": int((d.get("stability_measured") == False).sum())}   # noqa: E712
    if len(d) < 15:
        return {**out, "p": float("nan"), "note": "too few participants"}
    z = lambda s: (s - s.mean()) / s.std(ddof=1) if s.std(ddof=1) > 0 else s * 0.0   # noqa: E731
    d["stab_z"] = d.groupby("condition")["stability"].transform(z)
    for c in ("vci", "performance", "age", "active_minutes"):
        d[c + "_z"] = z(d[c].astype(float))
    ref = d["gender3"].value_counts().idxmax()
    g = pd.get_dummies(d["gender3"]).drop(columns=ref).astype(float)
    cnd = pd.get_dummies(d["condition"]).reindex(columns=list(RANDOM_LEVEL), fill_value=0).drop(columns="CVR+APA").astype(float)
    X = pd.concat([d[["vci_z", "stab_z", "performance_z", "age_z", "active_minutes_z"]], g, cnd], axis=1)
    X = X.loc[:, X.std() > 0]
    X = sm.add_constant(X)
    out["gender_reference"] = ref
    out["vif"] = {col: float(variance_inflation_factor(X.to_numpy(float), i)) for i, col in enumerate(X.columns) if col != "const"}
    ps = []
    for name, col in (("wellbeing_composite", "wellbeing"), ("decision_satisfaction", "satisfaction")):
        y = z(d[col].astype(float))
        f = sm.OLS(y.to_numpy(float), X.to_numpy(float)).fit(cov_type="HC3")
        i = list(X.columns).index("vci_z")
        b, se = float(f.params[i]), float(f.bse[i])
        p = float(stats.t.sf(b / se, f.df_resid))   # t with the residual df, as R's lmtest::coeftest
        ci = [b - stats.t.ppf(0.975, f.df_resid) * se, b + stats.t.ppf(0.975, f.df_resid) * se]
        out[name] = {"standardized_beta_vci": b, "se_hc3": se, "t": b / se, "p_one_sided": p, "ci95_beta": ci,
                     "r_squared": float(f.rsquared)}
        ps.append(p)
    out["p"] = max(ps)
    out["estimate"] = min(out["wellbeing_composite"]["standardized_beta_vci"], out["decision_satisfaction"]["standardized_beta_vci"])
    return out


# ------------------------------------------------------------------------------------------------- Holm and decisions
def holm(R: dict) -> dict:
    """OSF: the four primary hypotheses Holm-corrected together; the secondary ones within their family (C5 leaves family C
    when it is not run). A hypothesis is supported if its p is below its Holm-adjusted alpha and the effect is in the
    predicted direction. D1 is an equivalence test: supported means equivalence within +/-5 points."""
    from statsmodels.stats.multitest import multipletests
    groups = {"primary": PRIMARY, **{f"family {k}": v for k, v in FAMILIES.items()}}
    decisions = {}
    for gname, ids in groups.items():
        ids = [i for i in ids if i in R and not (i == "C5" and not R["C5"].get("run", True))]
        ps = [R[i].get("p", float("nan")) for i in ids]
        ok = [i for i, p in zip(ids, ps) if np.isfinite(p)]
        if not ok:
            continue
        reject, p_adj, _, _ = multipletests([R[i]["p"] for i in ok], alpha=ALPHA, method="holm")
        for i, rj, pa in zip(ok, reject, p_adj):
            supported = bool(rj) and bool(R[i].get("predicted_direction", True))
            decisions[i] = {"group": gname, "p": R[i]["p"], "p_holm_adjusted": float(pa), "supported": supported}
    return decisions


def run(tables: dict, boot: bool = True, robustness: bool = True) -> dict:
    P, S, O = tables["P"], tables["S"], tables["O"]
    out = {"n_participants": int(len(P)), "per_condition": P["condition"].value_counts().reindex(list(RANDOM_LEVEL)).fillna(0).astype(int).to_dict(),
           "fidelity": fidelity(P, S), "positive_controls": positive_controls(P, boot)}
    R = hypotheses(P, S, O, boot=boot)
    out["hypotheses"] = R
    out["decisions"] = holm(R)
    if robustness:
        rob = {}
        for key, (flag, words) in ROBUSTNESS.items():
            keep = P[P[flag] != True]   # noqa: E712 - a flag that cannot be read (None) keeps the participant
            pids = set(keep["pid"])
            Rk = hypotheses(keep, S[S["pid"].isin(pids)], O[O["pid"].isin(pids)], boot=False)
            rob[key] = {"without": words, "left_out": int(len(P) - len(keep)),
                        "p": {h: Rk[h].get("p", float("nan")) for h in Rk},
                        "estimate": {h: Rk[h].get("estimate", float("nan")) for h in Rk}}
        Rm = hypotheses(P, S, O, boot=False, departure_col="departure_menu_adjusted")
        rob["family_B_menu_adjusted"] = {"p": {h: Rm[h].get("p") for h in ("B1", "B2", "B3", "B4", "B5", "B7")},
                                         "estimate": {h: Rm[h].get("estimate") for h in ("B1", "B2", "B3", "B4", "B5", "B7")}}
        out["robustness"] = rob
    return out
