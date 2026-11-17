"""pipeline.py: one path from a coded records file to every result, used for the simulated runs and the real run alike
(17 November 2026).

    tables (build_tables.py) -> self-checks -> the registered analysis (registered_tests.py) -> the tables as CSV ->
    the second program (crosscheck.R) -> the comparison of the two programs -> figures (figures.py) -> report (report.py)

Nothing in this file decides a number; it only runs the parts in their order and writes what they return.
"""
from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import numpy as np

import build_tables as bt
import registered_tests as rt

HERE = Path(__file__).resolve().parent
RSCRIPT = Path(r"C:\Program Files\R\R-4.0.4\bin\Rscript.exe")

# How close the two programs must be. Closed-form tests: the same number to 6 decimals. Models fitted by an optimizer
# (A4's mixed model, C3's logistic regression) stop at slightly different points, so a looser, stated tolerance.
TOL_EXACT = 1e-6
TOL_FITTED = 1e-3


def to_jsonable(o):
    if isinstance(o, dict):
        return {str(k): to_jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [to_jsonable(v) for v in o]
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if not math.isfinite(float(o)) else float(o)
    if isinstance(o, np.ndarray):
        return to_jsonable(o.tolist())
    return o


def run_r(out_dir: Path) -> dict | None:
    if not RSCRIPT.exists():
        return None
    subprocess.run([str(RSCRIPT), str(HERE / "crosscheck.R"), str(out_dir)], check=True, capture_output=True, text=True)
    return json.loads((out_dir / "crosscheck_R.json").read_text(encoding="utf8"))


def compare_programs(res: dict, R: dict) -> list[dict]:
    """Every number both programs compute, side by side, with its tolerance."""
    H = res["hypotheses"]
    rows = []

    def add(name, py, r, tol):
        ok = py is not None and r is not None and np.isfinite(py) and np.isfinite(r) and abs(py - r) <= tol
        if py is not None and r is not None and not (np.isfinite(py) and np.isfinite(r)):
            ok = (not np.isfinite(py)) and (not np.isfinite(r))
        rows.append({"what": name, "python": py, "R": r, "difference": None if not ok and (py is None or r is None) else
                     (abs(py - r) if py is not None and r is not None and np.isfinite(py) and np.isfinite(r) else 0.0),
                     "tolerance": tol, "agree": bool(ok)})
    for h in ("A1", "A2", "A3", "B1", "B2", "B3", "B4", "B5", "B6", "C1", "C4", "D2", "D3", "D5"):
        add(f"{h} p", H[h].get("p"), R.get(h, {}).get("p"), TOL_EXACT)
    add("B7 Spearman rho", H["B7"]["spearman"].get("rho"), R["B7"]["spearman"]["rho"], TOL_EXACT)
    add("B7 Spearman p", H["B7"]["spearman"].get("p"), R["B7"]["spearman"]["p"], TOL_EXACT)
    add("B7 partial rho", H["B7"]["partial_spearman"].get("rho_partial"), R["B7"]["partial_spearman"]["rho_partial"], TOL_EXACT)
    add("B7 partial p", H["B7"]["partial_spearman"].get("p"), R["B7"]["partial_spearman"]["p"], TOL_EXACT)
    add("C1 Clopper-Pearson low", H["C1"]["ci95_clopper_pearson"][0], R["C1"]["ci95_clopper_pearson"][0], TOL_EXACT)
    add("C1 Clopper-Pearson high", H["C1"]["ci95_clopper_pearson"][1], R["C1"]["ci95_clopper_pearson"][1], TOL_EXACT)
    add("C3 slope", H["C3"].get("slope"), R["C3"]["slope"], TOL_FITTED)
    add("C3 p", H["C3"].get("p"), R["C3"]["p"], TOL_FITTED)
    add("C7 likelihood ratio", H["C7"].get("likelihood_ratio"), R["C7"]["likelihood_ratio"], TOL_EXACT)
    add("C7 fit coefficient", H["C7"].get("fit_coefficient"), R["C7"]["fit_coefficient"], TOL_EXACT)
    add("C7 p", H["C7"].get("p"), R["C7"]["p"], TOL_EXACT)
    add("C7 clustered standard error", H["C7"].get("beside_clustered_wald", {}).get("se_clustered"), R["C7"]["se_clustered"], TOL_EXACT)
    add("D1 p", H["D1"].get("p"), R["D1"]["p"], TOL_EXACT)
    add("D1 mean difference", H["D1"].get("mean_difference"), R["D1"]["mean_difference"], TOL_EXACT)
    add("D1 90% interval low", H["D1"].get("ci90_mean_difference", [None])[0], R["D1"]["ci90"][0], TOL_EXACT)
    for k in ("wellbeing_composite", "decision_satisfaction"):
        add(f"D4 {k} beta", H["D4"][k]["standardized_beta_vci"], R["D4"][k]["beta"], TOL_EXACT)
        add(f"D4 {k} HC3 standard error", H["D4"][k]["se_hc3"], R["D4"][k]["se"], TOL_EXACT)
        add(f"D4 {k} p", H["D4"][k]["p_one_sided"], R["D4"][k]["p"], TOL_EXACT)
    for k in ("push_vs_pull", "shelter_vs_sidewalk", "entry_level_vs_safety_net"):
        add(f"control {k} p", res["positive_controls"][k]["p"], R["controls"][k]["p"], TOL_EXACT)
    a4 = H["A4"]
    if "model" in a4:
        if "mixed_model_tried" in a4:    # Python used the registered fallback: compare with R's fallback (HC1 clusters)
            rr = R["A4"]["fallback_HC1"]
            add("A4 fallback coefficient", a4["model"]["help"], rr["help"], TOL_EXACT)
            add("A4 fallback clustered standard error", a4["model"]["se_help"], rr["se_help"], TOL_EXACT)
            add("A4 p", a4["p"], rr["p"], TOL_EXACT)
            rows.append({"what": "A4 the mixed model was singular in both programs", "python": a4["mixed_model_tried"]["singular"],
                         "R": R["A4"]["singular"], "agree": bool(a4["mixed_model_tried"]["singular"] == R["A4"]["singular"])})
        else:
            add("A4 coefficient", a4["model"]["help"], R["A4"]["help"], TOL_FITTED)
            add("A4 standard error", a4["model"]["se_help"], R["A4"]["se_help"], TOL_FITTED)
            add("A4 p", a4["p"], R["A4"]["p"], TOL_FITTED)
            add("A4 random-intercept SD", a4["model"]["random_intercept_sd"], R["A4"]["random_intercept_sd"], TOL_FITTED * 10)
    return rows


def analyse(records_path: Path, out_dir: Path, simulated: bool, boot: bool = True, robustness: bool = True,
            figures: bool = True, with_r: bool = True) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    docs = bt.load_records(records_path)
    tables = bt.build(docs)
    selfcheck = bt.self_check_report(tables)
    res = rt.run(tables, boot=boot, robustness=robustness)
    res["self_checks"] = {"lines": selfcheck, "problems": tables["checks"].problems,
                          "unreadable": tables["checks"].unreadable, "left_out": tables["left_out"],
                          "records_read": tables["read"], "records_included": tables["included"]}
    res["simulated"] = simulated
    for k in ("P", "S", "O", "V"):
        tables[k].to_csv(out_dir / f"{k}.csv", index=False)
    if with_r:
        R = run_r(out_dir)
        res["two_programs"] = compare_programs(res, R) if R else [{"what": "R was not found", "agree": False}]
    res = to_jsonable(res)
    (out_dir / "results.json").write_text(json.dumps(res, indent=2), encoding="utf8")
    if figures:
        import figures as fg
        fg.make_all(tables, res, out_dir / "figures", simulated)
    import report as rp
    rp.write(res, out_dir, simulated)
    return {"results": res, "tables": tables}
