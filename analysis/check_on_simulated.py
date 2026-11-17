"""check_on_simulated.py: the registered promise, kept (17 November 2026).

OSF page 6: "the analysis code is written and run on simulated participants before the data are opened." This program
runs the whole analysis on pretend participants made by the study's own code (tools/simulate_records.cjs) and checks it:

  S1 the shape        records made by the study's code, in all four conditions, give every table with no field missing
  S2 self-checks      every number the analysis recomputes equals what the study saved
  S3 no effect        2,000 simulated studies of 107 people (27 / 27 / 26 / 27) with no effect: each test claims support
                      in about 5 of 100 studies or fewer, and Holm keeps each family's false claims at or below 5 in 100
  S4 planted effects  known effects planted: each test finds them, and the estimates land near the planted sizes
  S5 the A4 model     the hand-written mixed model gives back a planted odds ratio, agrees with R's lme4, and the
                      registered fallback runs when the model is singular
  S6 repeatable       two runs on the same input give identical results
  S7 privacy          the real-data runner refuses a file holding a Prolific ID or an email, and refuses to run before
                      the freeze; no output names anything but the codes
  S8 two programs     Python and R give the same numbers within stated tolerances

and the BREAKS: each check is broken on purpose once and must catch it.

Every number this program writes is SIMULATED and is never reported as a finding.

Run (from the project folder; about 30-40 minutes with 2,000 studies):
  analysis\\.venv\\Scripts\\python.exe analysis\\check_on_simulated.py --work <an empty folder outside the project>
Writes analysis/simulation/SIMULATION_REPORT.md and simulation_results.json, and an example run (RESULTS.md, figures).
"""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import build_tables as bt       # noqa: E402
import pipeline as pl           # noqa: E402
import registered_tests as rt   # noqa: E402
import run_on_real as ror       # noqa: E402
import stats_tools as st        # noqa: E402

CONDITIONS = ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"]
COUNTS = [27, 27, 26, 27]
ALPHA = 0.05
SEED = 20261117


def node(*args):
    return subprocess.run(["node", *map(str, args)], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def make_records(work: Path, name: str, counts, seed: int, first: int = 0, compact: bool = False, compile_: bool = False) -> Path:
    folder = work / name
    folder.mkdir(parents=True, exist_ok=True)
    args = ["tools/simulate_records.cjs", f"--out={folder / 'participants.json'}", f"--truth={folder / 'truth.json'}",
            f"--counts={','.join(map(str, counts))}", f"--seed={seed}", f"--first-number={first}"]
    if not compile_:
        args.append("--no-compile")
    if compact:
        args.append("--compact")
    node(*args)
    node("tools/ai_safe_copy.cjs", folder, "--anywhere")
    return folder


# ================================================================================================ S1, S2, S6, S7, S8
NEEDED = {"P": ["vci", "stability", "performance", "wellbeing", "satisfaction", "value_congruence", "age", "active_minutes",
                "wish_gap", "position_spread", "place_spread", "s6_hit", "s6_top_p", "s6_sounds_like_me",
                "money_sidewalk", "money_shelter", "trolley_lever", "trolley_bridge", "ai_low_buffer_mean", "ai_high_buffer_mean",
                "flag_fast_blocks", "flag_fast_scenarios", "flag_straightlined", "flag_attention_wrong"],
          "S": ["first_id", "final_id", "first_label", "final_label", "captured_first", "captured_final", "shortfall_first",
                "shortfall_final", "time_ms", "card_position_first"],
          "O": ["position", "captured", "fit_before", "mpf_p_updated", "mpf_p_before"]}


def s1_shape(tables) -> dict:
    missing = {}
    for t, cols in NEEDED.items():
        df = tables[t]
        for c in cols:
            if c not in df.columns:
                missing[f"{t}.{c}"] = "column absent"
                continue
            sub = df
            if t == "S" and c in ("departure",):
                sub = df[df["order"] <= 6]
            n = int(sub[c].isna().sum())
            if n:
                missing[f"{t}.{c}"] = n
    dep = tables["S"]["departure"].isna().sum()
    conds = tables["P"]["condition"].value_counts().to_dict()
    ok = not missing and dep == 0 and not tables["checks"].unreadable and all(conds.get(c, 0) > 0 for c in CONDITIONS)
    return {"ok": bool(ok), "fields_missing": missing, "departures_missing": int(dep),
            "unreadable": tables["checks"].unreadable, "per_condition": conds,
            "rows": {k: int(len(tables[k])) for k in ("P", "S", "O", "V")}}


def no_identifier_in(folder: Path, pids: list[str]) -> list[str]:
    bad = []
    for f in folder.rglob("*"):
        if f.suffix.lower() in (".json", ".csv", ".md", ".tex"):
            text = f.read_text(encoding="utf8", errors="ignore").lower()
            if any(p.lower() in text for p in pids) or re.search(r"\b[0-9a-f]{24}\b", text):
                bad.append(f.name)
    return bad


# ================================================================================================ the pool, S3, S4, S5
def build_pool(work: Path) -> dict:
    parts = []
    for k in range(4):
        folder = make_records(work, f"pool{k + 1}", [63, 63, 62, 63], seed=7001 + k, first=10000 + 1000 * k, compact=True)
        t = bt.build(bt.load_records(folder / "participants_ai_safe.json"))
        if t["checks"].problems:
            raise SystemExit(f"pool part {k + 1}: self-check problems {t['checks'].problems[:3]}")
        for name in ("P", "S", "O"):
            t[name]["pid"] = f"pool{k + 1}:" + t[name]["pid"].astype(str)
        t["O"]["stratum"] = t["O"]["pid"] + "|" + t["O"]["scenario_id"]
        parts.append(t)
        (folder / "participants.json").unlink()            # 100 MB each; remade from the seed when needed
        (folder / "participants_ai_safe.json").unlink()
    pool = {name: pd.concat([p[name] for p in parts], ignore_index=True) for name in ("P", "S", "O")}
    pool["by_condition"] = {c: pool["P"].loc[pool["P"]["condition"] == c, "pid"].to_numpy() for c in CONDITIONS}
    return pool


def draw(pool, rng):
    pids = np.concatenate([rng.choice(pool["by_condition"][c], n, replace=False) for c, n in zip(CONDITIONS, COUNTS)])
    keep = set(pids)
    return (pool["P"][pool["P"]["pid"].isin(keep)].copy(), pool["S"][pool["S"]["pid"].isin(keep)].copy(),
            pool["O"][pool["O"]["pid"].isin(keep)].copy())


def relabel(P, S, O, rng):
    labels = np.array(sum([[c] * n for c, n in zip(CONDITIONS, COUNTS)], []))
    rng.shuffle(labels)
    m = dict(zip(P["pid"], labels))
    P = P.assign(condition=P["pid"].map(m))
    P = P.assign(cvr=P["condition"].isin(["CVR+APA", "CVR_Only"]), apa=P["condition"].isin(["CVR+APA", "APA_Only"]),
                 help=P["condition"] != "Baseline")
    return P, S.assign(condition=S["pid"].map(m)), O.assign(condition=O["pid"].map(m))


def flip_pids(P, rng):
    return set(P["pid"][rng.random(len(P)) < 0.5])


def set_order(S, col, order, values: dict):
    S = S.copy()
    m = S["order"] == order
    S.loc[m, col] = S.loc[m, "pid"].map(values).where(S.loc[m, "pid"].isin(values.keys()), S.loc[m, col])
    return S


def null_b(P, S, rng, hid):
    """A null for each position contrast: each participant's difference has its sign flipped at random."""
    w = S.pivot_table(index="pid", columns="order", values="departure", aggfunc="first")
    flip = [p for p in flip_pids(P, rng) if p in w.index]
    f = w.loc[flip]
    if hid == "B1":
        new = {4: f[5], 5: f[4]}
    elif hid == "B3":
        new = {1: f[2], 2: f[1]}
    elif hid == "B4":
        new = {3: f[4], 4: f[3]}
    elif hid == "B2":
        new = {3: (f[1] + f[2]) / 2, 1: f[3], 2: f[3]}
    else:  # B5
        new = {6: (f[1] + f[2]) / 2, 1: f[6], 2: f[6]}
    for order, ser in new.items():
        S = set_order(S, "departure", order, ser.to_dict())
    return S


def null_c2(S, O, rng):
    """C2's null: every first pick in the decisions replaced by an option drawn at random from its six."""
    Od = O.sort_values(["stratum", "position"])
    starts = Od.groupby("stratum").head(1).index
    groups = Od.groupby("stratum", sort=False)
    pick = {}
    for stratum, g in groups:
        row = g.iloc[rng.integers(0, len(g))]
        pick[stratum] = (row["mpf_p_updated"], bool(row["mpf_top_updated"]))
    S = S.copy()
    m = S["decision"]
    keys = S.loc[m, "pid"] + "|" + S.loc[m, "scenario_id"]
    S.loc[m, "mpf_p_first_updated"] = keys.map(lambda k: pick[k][0]).to_numpy()
    S.loc[m, "mpf_hit_first_updated"] = keys.map(lambda k: pick[k][1]).to_numpy()
    _ = starts
    return S


def m0_coefficients(O):
    """The choice model WITHOUT the values (position + performance), fitted once on the pool: C7's null."""
    c7d = O.dropna(subset=["position", "captured"])
    pos = pd.get_dummies(c7d["position"].astype(int), prefix="position").reindex(
        columns=[f"position_{k}" for k in range(2, 7)], fill_value=0).astype(float)
    X0 = np.column_stack([pos.to_numpy(), c7d["captured"].to_numpy(float)])
    return st.conditional_logit(X0, c7d["chosen"].to_numpy(), c7d["stratum"].to_numpy(), c7d["pid"].to_numpy())["beta"]


def null_c7(O, beta0, rng):
    O = O.copy()
    pos = pd.get_dummies(O["position"].astype(int), prefix="position").reindex(
        columns=[f"position_{k}" for k in range(2, 7)], fill_value=0).astype(float).to_numpy()
    u = np.column_stack([pos, O["captured"].to_numpy(float)]) @ beta0 + rng.gumbel(size=len(O))
    O["u"] = u
    best = O.groupby("stratum")["u"].transform("max")
    O["chosen"] = (O["u"] == best).astype(int)
    return O.drop(columns="u")


def hodges_lehmann(d):
    d = np.sort(np.asarray(d, float))
    i, j = np.triu_indices(len(d))
    return float(np.median((d[i] + d[j]) / 2))


def p_of(hid, P, S, O):
    r = rt.TESTS[hid](P, S, O, boot=False)
    return r.get("p", float("nan")), rt._direction(hid, r), r


def s3_null(pool, n_studies, log) -> dict:
    """Each test under its own null, in every simulated study; Holm within each family and over the four primaries."""
    rng = np.random.default_rng(SEED)
    beta0 = m0_coefficients(pool["O"])
    lvl = pool["P"]["condition"].map(rt.RANDOM_LEVEL)
    hl = hodges_lehmann((pool["P"]["vci"] - lvl).dropna())
    d1_pool = rt.d1_differences(pool["S"]).mean()
    rows = []
    t0 = time.time()
    for k in range(n_studies):
        P, S, O = draw(pool, rng)
        p = {}
        Pa, Sa, Oa = relabel(P, S, O, rng)
        for h in ("A1", "A2", "A3", "A4"):
            p[h] = p_of(h, Pa, Sa, Oa)
        for h in ("B1", "B2", "B3", "B4", "B5"):
            p[h] = p_of(h, P, null_b(P, S, rng, h), O)
        s = np.where(rng.random(len(P)) < 0.5, -1.0, 1.0)
        p["B6"] = p_of("B6", P.assign(wish_gap=P["wish_gap"] * s), S, O)
        p["B7"] = p_of("B7", P.assign(place_spread=rng.permutation(P["place_spread"].to_numpy())), S, O)
        p["C1"] = p_of("C1", P.assign(s6_hit=rng.random(len(P)) < 0.25), S, O)
        p["C2"] = p_of("C2", P, null_c2(S, O, rng), O)
        P3 = P.copy()
        P3["s6_hit"] = P3.groupby("condition")["s6_hit"].transform(lambda v: rng.permutation(v.to_numpy()))
        p["C3"] = p_of("C3", P3, S, O)
        p["C4"] = p_of("C4", P.assign(s6_sounds_like_me=rng.permutation(P["s6_sounds_like_me"].to_numpy())), S, O)
        elig = (P["s6_first_rule"] != P["s6_top_rule"]) & (P["s6_changed"] == True)   # noqa: E712
        P5 = P.copy()
        P5.loc[elig, "s6_final_rule"] = np.where(rng.random(int(elig.sum())) < 1 / 3, P5.loc[elig, "s6_top_rule"], "another rule")
        p["C5"] = p_of("C5", P5, S, O)
        flip = flip_pids(P, rng)
        S6 = S.copy()
        m = S6["pid"].isin(flip)
        S6.loc[m, ["mpf_p_first_updated", "mpf_p_first_before"]] = S6.loc[m, ["mpf_p_first_before", "mpf_p_first_updated"]].to_numpy()
        S6.loc[m, ["mpf_hit_first_updated", "mpf_hit_first_before"]] = S6.loc[m, ["mpf_hit_first_before", "mpf_hit_first_updated"]].to_numpy()
        p["C6"] = p_of("C6", P, S6, O)
        p["C7"] = p_of("C7", P, S, null_c7(O, beta0, rng))
        target = 5.0 if k % 2 == 0 else -5.0          # D1's null: the true mean exactly at the margin
        S1 = S.copy()
        el = S1["decision"] & S1["first_misfit"] & S1["page_opened"]
        S1.loc[el, "captured_final"] = S1.loc[el, "captured_final"] + (target - d1_pool)
        p["D1"] = p_of("D1", P, S1, O)
        flip = flip_pids(P, rng)
        S2 = S.copy()
        m = S2["pid"].isin(flip)
        S2.loc[m, ["shortfall_first", "shortfall_final"]] = S2.loc[m, ["shortfall_final", "shortfall_first"]].to_numpy()
        p["D2"] = p_of("D2", P, S2, O)
        lv = P["condition"].map(rt.RANDOM_LEVEL)
        s = np.where(rng.random(len(P)) < 0.5, -1.0, 1.0)
        p["D3"] = p_of("D3", P.assign(vci=lv + s * (P["vci"] - lv - hl)), S, O)
        perm = P.assign(vci=rng.permutation(P["vci"].to_numpy()))
        p["D4"] = p_of("D4", perm, S, O)
        p["D5"] = p_of("D5", perm, S, O)
        R = {h: {"p": v[0], "predicted_direction": v[1], "run": v[2].get("run", True)} for h, v in p.items()}
        dec = rt.holm(R)
        rows.append({"p": {h: v[0] for h, v in p.items()}, "dir": {h: v[1] for h, v in p.items()},
                     "c5_run": bool(p["C5"][2].get("run", False)),
                     "supported": {h: dec.get(h, {}).get("supported", False) for h in p}})
        if k % 100 == 99:
            log(f"  S3: {k + 1} of {n_studies} null studies ({time.time() - t0:.0f} s)")
    return summarise_null(rows, n_studies)


def summarise_null(rows, n):
    band = ALPHA + 3 * math.sqrt(ALPHA * (1 - ALPHA) / n)
    per = {}
    for h in rt.TESTS:
        ps = np.array([r["p"][h] for r in rows], float)
        dirs = np.array([r["dir"][h] for r in rows], bool)
        run = np.isfinite(ps)
        raw = (ps < ALPHA) & dirs & run
        rate = float(raw.sum() / run.sum()) if run.sum() else float("nan")
        per[h] = {"studies_run": int(run.sum()), "false_claims_raw_alpha": rate,
                  "within_band": bool(run.sum() == 0 or rate <= band)}
    fam = {}
    for g, ids in {"primary": rt.PRIMARY, **{f"family {k}": v for k, v in rt.FAMILIES.items()}}.items():
        any_false = [any(r["supported"].get(h, False) for h in ids) for r in rows]
        rate = float(np.mean(any_false))
        fam[g] = {"family_wise_false_claims": rate, "within_band": bool(rate <= band)}
    # C5 is an exact binomial test against 1/3, run only with 20 or more people: its false-claim rate is known exactly for
    # every group size, so it is calculated, not simulated (the pretend pool rarely has 20 such people in a study).
    sizes = {}
    for m in range(20, 108):
        res = [stats.binomtest(k, m, 1 / 3, alternative="greater").pvalue < ALPHA for k in range(m + 1)]
        sizes[m] = float(sum(stats.binom.pmf(k, m, 1 / 3) for k in range(m + 1) if res[k]))
    return {"studies": n, "upper_band": band, "per_test": per, "family_wise": fam,
            "c5_run_in": int(sum(r["c5_run"] for r in rows)),
            "c5_exact_false_claim_rate": {"largest": max(sizes.values()), "at_size": max(sizes, key=sizes.get),
                                          "smallest": min(sizes.values()), "all_at_or_below_5_percent": all(v <= ALPHA for v in sizes.values())}}


def binomial_power(n, p0, p1, alpha=ALPHA):
    k = int(stats.binom.isf(alpha, n, p0)) + 1
    while stats.binom.sf(k - 1, n, p0) > alpha:
        k += 1
    while k > 0 and stats.binom.sf(k - 2, n, p0) <= alpha:
        k -= 1
    return float(stats.binom.sf(k - 1, n, p1)), k


def s4_planted(pool, n_studies, log) -> dict:
    rng = np.random.default_rng(SEED + 4)
    out = {}
    res = {"A1": [], "B1": [], "C1": [], "D1": [], "D4": []}
    for k in range(n_studies):
        P, S, O = draw(pool, rng)
        Pa, Sa, Oa = relabel(P, S, O, rng)
        Pa = Pa.assign(vci=Pa["vci"] + np.where(Pa["condition"] == "CVR+APA", 10.0, 0.0))
        r = rt.TESTS["A1"](Pa, Sa, Oa, boot=False)
        res["A1"].append((r["p"] < ALPHA and r["rank_biserial_r"] > 0, r["estimate"]))
        Sb = null_b(P, S, rng, "B1")
        Sb.loc[Sb["order"] == 5, "departure"] += 8.0
        r = rt.TESTS["B1"](P, Sb, O, boot=False)
        res["B1"].append((r["p"] < ALPHA, r["mean_difference"]))
        r = rt.TESTS["C1"](P.assign(s6_hit=rng.random(len(P)) < 0.40), S, O, boot=False)
        res["C1"].append((r["p"] < ALPHA, r["rate"]))
        Sd = S.copy()
        el = Sd["decision"] & Sd["first_misfit"] & Sd["page_opened"]
        Sd.loc[el, "captured_final"] = Sd.loc[el, "captured_final"] - rt.d1_differences(pool["S"]).mean()
        r = rt.TESTS["D1"](P, Sd, O, boot=False)
        res["D1"].append((r["p"] < ALPHA, r["mean_difference"]))
        z = (P["vci"] - P["vci"].mean()) / P["vci"].std(ddof=1)
        Pw = P.assign(wellbeing=0.3 * z + math.sqrt(1 - 0.09) * rng.normal(size=len(P)),
                      satisfaction=0.3 * z + math.sqrt(1 - 0.09) * rng.normal(size=len(P)))
        r = rt.TESTS["D4"](Pw, S, O, boot=False)
        res["D4"].append((r["p"] < ALPHA, r["wellbeing_composite"]["standardized_beta_vci"]))
        if k % 100 == 99:
            log(f"  S4: {k + 1} of {n_studies} studies with planted effects")
    planted = {"A1": ("VCI 10 points higher in CVR+APA", 10.0), "B1": ("departure 8 points higher in scenario 5", 8.0),
               "C1": ("hit rate 40% in scenario 6", 0.40), "D1": ("true mean difference 0 (equivalent)", 0.0),
               "D4": ("standardized beta 0.3 for VCI", 0.3)}
    for h, rows in res.items():
        found = np.array([r[0] for r in rows])
        est = np.array([r[1] for r in rows], float)
        out[h] = {"planted": planted[h][0], "planted_size": planted[h][1], "found_in_share_of_studies": float(found.mean()),
                  "mean_estimate": float(np.nanmean(est)), "sd_estimate": float(np.nanstd(est, ddof=1))}
    pw, kcrit = binomial_power(107, 0.25, 0.40)
    out["C1"]["expected_share_exact_binomial"] = pw
    return out


def s5_a4(pool, n_reps, work: Path, log) -> dict:
    """The A4 model on the pool's own decision structure with a planted effect: odds ratio 2, random-intercept SD 1."""
    rng = np.random.default_rng(SEED + 5)
    beta, sd, b0 = math.log(2.0), 1.0, -0.6
    est, cover, fallback, agree = [], 0, 0, []
    for k in range(n_reps):
        P, S, O = draw(pool, rng)
        dec = S[S["decision"] & S["first_misfit"]].copy()
        help_ = (dec["condition"] != "Baseline").astype(int).to_numpy()
        b = {p: rng.normal(0, sd) for p in dec["pid"].unique()}
        eta = b0 + beta * help_ + dec["pid"].map(b).to_numpy()
        dec["final_good_fit"] = rng.random(len(dec)) < 1 / (1 + np.exp(-eta))
        Sx = S.copy()
        Sx.loc[dec.index, "final_good_fit"] = dec["final_good_fit"]
        r = rt.TESTS["A4"](P, Sx, O, boot=False)
        est.append(r["estimate"])
        lo, hi = (math.log(v) for v in r["ci95_odds_ratio"])
        cover += lo <= beta <= hi
        fallback += "mixed_model_tried" in r
        if k < 5 and pl.RSCRIPT.exists():       # the same data through R's lme4
            f = work / f"s5_{k}.csv"
            pd.DataFrame({"pid": dec["pid"], "help": help_, "good": dec["final_good_fit"].astype(int)}).to_csv(f, index=False)
            script = work / "s5.R"
            script.write_text('suppressPackageStartupMessages(library(lme4)); d <- read.csv(commandArgs(TRUE)[1]); '
                              'm <- glmer(good ~ help + (1 | pid), data = d, family = binomial, nAGQ = 25); '
                              'co <- summary(m)$coefficients; cat(co[2, 1], co[2, 2], isSingular(m), "\\n")', encoding="utf8")
            outp = subprocess.run([str(pl.RSCRIPT), str(script), str(f)], capture_output=True, text=True).stdout.split()
            m = r.get("model", {})
            if "mixed_model_tried" not in r and len(outp) >= 2:
                agree.append({"python_coefficient": m["help"], "R_coefficient": float(outp[0]),
                              "python_se": m["se_help"], "R_se": float(outp[1]),
                              "agree": abs(m["help"] - float(outp[0])) <= pl.TOL_FITTED and abs(m["se_help"] - float(outp[1])) <= pl.TOL_FITTED})
        if k % 50 == 49:
            log(f"  S5: {k + 1} of {n_reps}")
    est = np.array(est, float)
    # The fallback: a singular model (no person-to-person variation at all) must switch to the clustered regression.
    P, S, O = draw(pool, rng)
    dec = S[S["decision"] & S["first_misfit"]].copy()
    p_ = 1 / (1 + np.exp(-(b0 + beta * (dec["condition"] != "Baseline").astype(int))))
    Sx = S.copy()
    Sx.loc[dec.index, "final_good_fit"] = rng.random(len(dec)) < p_.to_numpy()
    r = rt.TESTS["A4"](P, Sx, O, boot=False)
    return {"replicates": n_reps, "planted_log_odds_ratio": beta, "planted_random_intercept_sd": sd,
            "mean_estimate": float(est.mean()), "sd_estimate": float(est.std(ddof=1)),
            "ci95_coverage": cover / n_reps, "fallback_used": fallback, "agreement_with_lme4": agree,
            "no_variation_case": {"fallback_used": "mixed_model_tried" in r, "random_intercept_sd_found":
                                  r.get("mixed_model_tried", r.get("model", {})).get("random_intercept_sd")}}


# ================================================================================================ the breaks
def breaks(coded: Path, run_dir: Path, res: dict, work: Path) -> list[dict]:
    out = []
    docs = json.loads(coded.read_text(encoding="utf8"))
    # S2: a saved label changed by hand must be caught
    d2 = json.loads(json.dumps(docs))
    r0 = d2[0]["blocks"]["block5_emergency_scenarios"]["scenarioResults"][0]
    r0["alignmentLevel"] = "strongly_misaligned" if r0["alignmentLevel"] != "strongly_misaligned" else "aligned"
    t = bt.build(d2)
    out.append({"break": "S2: one saved label changed", "caught": bool(t["checks"].problems)})
    d3 = json.loads(json.dumps(docs))
    d3[1]["analysis"]["position_effect"]["by_scenario"][0]["departure_share"] += 7
    t = bt.build(d3)
    out.append({"break": "S2: one saved departure changed", "caught": bool(t["checks"].problems)})
    d4 = json.loads(json.dumps(docs))
    m = d4[2]["analysis"]["mpf_predictions_every_scenario"]["by_scenario"][1]
    m["by_option"][0]["mpf_chance_percent"] += 0.3
    t = bt.build(d4)
    out.append({"break": "S2: one saved prediction chance changed", "caught": bool(t["checks"].problems)})
    # S7: a real-looking Prolific ID, or an email, must be refused
    for what, change in (("a 24-character Prolific ID", lambda d: d.__setitem__("prolific_pid", "5f1e2d3c4b5a69788796a5b4")),
                         ("an email address", lambda d: d.__setitem__("email", "someone@example.edu"))):
        d5 = json.loads(json.dumps(docs[:3]))
        change(d5[0])
        f = work / "break_privacy.json"
        f.write_text(json.dumps(d5), encoding="utf8")
        try:
            bt.load_records(f)
            caught = False
        except SystemExit:
            caught = True
        out.append({"break": f"S7: {what} in the file", "caught": caught})
    out.append({"break": "S7: the real-data runner before the freeze", "caught": bool(ror.freeze_problems())})
    # S8: a Python number moved must show as a disagreement
    R = json.loads((run_dir / "crosscheck_R.json").read_text(encoding="utf8"))
    moved = json.loads(json.dumps(res))
    moved["hypotheses"]["B4"]["p"] = moved["hypotheses"]["B4"]["p"] * 1.01 + 1e-5
    out.append({"break": "S8: one Python p-value moved slightly", "caught": not all(r["agree"] for r in pl.compare_programs(moved, R))})
    return out


# ================================================================================================ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True, help="an empty folder OUTSIDE the project for the pretend records")
    ap.add_argument("--studies", type=int, default=2000)
    ap.add_argument("--planted", type=int, default=500)
    ap.add_argument("--a4-reps", type=int, default=300)
    a = ap.parse_args()
    work = Path(a.work).resolve()
    if ROOT in work.parents or work == ROOT:
        raise SystemExit("--work must be outside the project folder (the pretend records are large).")
    work.mkdir(parents=True, exist_ok=True)
    sim_out = HERE / "simulation"
    sim_out.mkdir(exist_ok=True)
    lines = []

    def log(s):
        print(s, flush=True)
        lines.append(s)
    t0 = time.time()
    summary = {"what_this_is": "SIMULATED: the analysis code run on pretend participants. Not data.", "seed": SEED}

    log("Making 107 pretend records (27 / 27 / 26 / 27) with the study's own code ...")
    folder = make_records(work, "sim107", COUNTS, SEED, compile_=True)
    dc = node("tools/data_check.cjs", folder)
    summary["data_check"] = dc.strip().splitlines()[0]
    log("  " + summary["data_check"])
    coded = folder / "participants_ai_safe.json"
    pids = [d["prolific_pid"] for d in json.loads((folder / "participants.json").read_text(encoding="utf8"))]
    run_a = sim_out / "example_run"
    if run_a.exists():
        shutil.rmtree(run_a)
    log("Running the whole analysis on them (twice, for S6) ...")
    ra = pl.analyse(coded, run_a, simulated=True)
    rb = pl.analyse(coded, work / "run_b", simulated=True, figures=False)
    res = ra["results"]
    summary["S1"] = s1_shape(ra["tables"])
    summary["S2"] = {"ok": not res["self_checks"]["problems"], "lines": res["self_checks"]["lines"]}
    a_json = (run_a / "results.json").read_text(encoding="utf8")
    b_json = (work / "run_b" / "results.json").read_text(encoding="utf8")
    summary["S6"] = {"ok": a_json == b_json, "note": "results.json of two runs compared character by character"}
    raw_refused = False
    try:
        bt.load_records(folder / "participants.json")
    except SystemExit:
        raw_refused = True
    leaks = no_identifier_in(run_a, pids)
    summary["S7"] = {"ok": raw_refused and not leaks and bool(ror.freeze_problems()),
                     "raw_file_with_prolific_ids_refused": raw_refused, "outputs_naming_an_id": leaks,
                     "runner_refuses_before_the_freeze": ror.freeze_problems()}
    tp = res.get("two_programs", [])
    summary["S8"] = {"ok": bool(tp) and all(r["agree"] for r in tp), "numbers_compared": len(tp),
                     "disagreements": [r for r in tp if not r["agree"]]}
    summary["breaks"] = breaks(coded, run_a, res, work)
    for k in ("S1", "S2", "S6", "S7", "S8"):
        log(f"  {k}: {'PASS' if summary[k]['ok'] else 'FAIL'}")
    for b in summary["breaks"]:
        log(f"  break {'caught' if b['caught'] else 'NOT CAUGHT'}: {b['break']}")

    log("Making the pool of 1,004 pretend people (four parts) ...")
    pool = build_pool(work)
    log(f"S3: {a.studies} simulated studies with no effect ...")
    summary["S3"] = s3_null(pool, a.studies, log)
    summary["S3"]["ok"] = all(v["within_band"] for v in summary["S3"]["per_test"].values()) and \
        all(v["within_band"] for v in summary["S3"]["family_wise"].values())
    log(f"S4: {a.planted} simulated studies with planted effects ...")
    summary["S4"] = s4_planted(pool, a.planted, log)
    log(f"S5: the A4 model, {a.a4_reps} replicates ...")
    summary["S5"] = s5_a4(pool, a.a4_reps, work, log)
    s5 = summary["S5"]
    summary["S5"]["ok"] = abs(s5["mean_estimate"] - s5["planted_log_odds_ratio"]) < 0.15 and 0.90 <= s5["ci95_coverage"] <= 0.99 \
        and all(x["agree"] for x in s5["agreement_with_lme4"]) and s5["no_variation_case"]["fallback_used"]
    summary["minutes"] = round((time.time() - t0) / 60, 1)
    (sim_out / "simulation_results.json").write_text(json.dumps(pl.to_jsonable(summary), indent=2), encoding="utf8")
    import simulation_report
    simulation_report.write(summary, sim_out / "SIMULATION_REPORT.md")
    log(f"Done in {summary['minutes']} minutes. analysis/simulation/SIMULATION_REPORT.md")


if __name__ == "__main__":
    main()
