"""stats_tools.py: the statistical pieces the registered tests are built from (17 November 2026).

Each function is one test or one interval, written once and used by registered_tests.py. Choices the registration
leaves to the software are fixed here and stated, so the R cross-check (crosscheck.R) can make the same ones:

  Mann-Whitney U       normal approximation with continuity correction (VCI has many ties, so an exact test is not
                       available), as R's wilcox.test(exact = FALSE, correct = TRUE)
  Wilcoxon signed-rank zero differences dropped (the standard test; B6 keeps them by Pratt's method, as registered);
                       exact when fewer than 50 differences, none of them zero and no ties (R's own default rule),
                       otherwise the normal approximation with the tie-corrected variance and no continuity
                       correction, as R's wilcox.test(correct = FALSE)
  Spearman             the t approximation, as R's cor.test(method = "spearman", exact = FALSE)
  bootstrap            10,000 resamples over participants, percentile intervals, a fixed seed per test (the master seed
                       and the test's name), so adding a test never changes another test's numbers
  bootstrap p-value    one-sided: (1 + the resamples on the wrong side of the null value) / (1 + 10,000)
"""
from __future__ import annotations

import math
import zlib

import numpy as np
from scipy import optimize, stats

SEED = 20261117
B = 10_000


def rng_for(name: str) -> np.random.Generator:
    return np.random.default_rng([SEED, zlib.crc32(name.encode("utf8"))])


def clean(x) -> np.ndarray:
    a = np.asarray(x, dtype=float)
    return a[~np.isnan(a)]


def one_sided_from_two(p_two: float, estimate: float, greater: bool = True) -> float:
    """A one-sided p from a symmetric two-sided one: half when the estimate is on the predicted side."""
    on_side = estimate > 0 if greater else estimate < 0
    return p_two / 2 if on_side else 1 - p_two / 2


def percentile_ci(samples: np.ndarray, level: float = 0.95) -> list[float]:
    a = (1 - level) / 2
    s = samples[~np.isnan(samples)]
    if len(s) == 0:
        return [float("nan"), float("nan")]
    return [float(np.quantile(s, a)), float(np.quantile(s, 1 - a))]


def boot_p(samples: np.ndarray, null: float, greater: bool) -> float:
    """One-sided bootstrap p-value: the share of resampled estimates on the wrong side of the null value."""
    s = samples[~np.isnan(samples)]
    wrong = np.sum(s <= null) if greater else np.sum(s >= null)
    return float((1 + wrong) / (1 + len(s)))


# ------------------------------------------------------------------------------------------------- rank tests
def mann_whitney(x, y, name: str, alternative: str = "greater", boot: bool = True) -> dict:
    x, y = clean(x), clean(y)
    n1, n2 = len(x), len(y)
    out = {"test": "Mann-Whitney U (normal approximation, continuity correction)", "n": [n1, n2]}
    if n1 < 2 or n2 < 2:
        return {**out, "p": float("nan"), "note": "too few participants"}
    res = stats.mannwhitneyu(x, y, alternative=alternative, method="asymptotic", use_continuity=True)
    u = float(res.statistic)
    r = 2 * u / (n1 * n2) - 1
    pooled = math.sqrt(((n1 - 1) * x.var(ddof=1) + (n2 - 1) * y.var(ddof=1)) / (n1 + n2 - 2)) if n1 + n2 > 2 else float("nan")
    d = (x.mean() - y.mean()) / pooled if pooled > 0 else float("nan")
    out.update({"U": u, "p": float(res.pvalue), "estimate": float(x.mean() - y.mean()),
                "rank_biserial_r": r, "cohens_d": d, "mean_x": float(x.mean()), "mean_y": float(y.mean()),
                "median_x": float(np.median(x)), "median_y": float(np.median(y))})
    if boot:
        g = rng_for(name)
        xb = x[g.integers(0, n1, (B, n1))]
        yb = y[g.integers(0, n2, (B, n2))]
        ranks = stats.rankdata(np.concatenate([xb, yb], axis=1), axis=1)
        ub = ranks[:, :n1].sum(axis=1) - n1 * (n1 + 1) / 2
        out["ci95_rank_biserial_r"] = percentile_ci(2 * ub / (n1 * n2) - 1)
        out["ci95_mean_difference"] = percentile_ci(xb.mean(axis=1) - yb.mean(axis=1))
    return out


def signed_rank(diff, name: str, alternative: str, zero_method: str = "wilcox", boot: bool = True) -> dict:
    d = clean(diff)
    nz = d[d != 0]
    ties = len(np.unique(np.abs(nz))) < len(nz)
    exact = zero_method == "wilcox" and 0 < len(d) < 50 and len(nz) == len(d) and not ties
    out = {"test": f"Wilcoxon signed-rank ({'exact' if exact else 'normal approximation'}, zeros "
                   f"{'kept, Pratt' if zero_method == 'pratt' else 'dropped'})",
           "n": int(len(d)), "zero_differences": int(np.sum(d == 0))}
    if len(nz) < 1:
        return {**out, "p": float("nan"), "note": "no non-zero difference"}
    res = stats.wilcoxon(d, zero_method=zero_method, alternative=alternative,
                         method="exact" if exact else "approx", correction=False)
    ranks = stats.rankdata(np.abs(nz))
    r_plus, r_minus = ranks[nz > 0].sum(), ranks[nz < 0].sum()
    out.update({"W": float(res.statistic), "T_plus": float(res.statistic) if zero_method == "pratt" and alternative != "two-sided"
                else float(r_plus), "p": float(res.pvalue), "estimate": float(d.mean()),
                "mean_difference": float(d.mean()), "median_difference": float(np.median(d)),
                "rank_biserial_r": float((r_plus - r_minus) / (r_plus + r_minus)),
                "cohens_dz": float(d.mean() / d.std(ddof=1)) if len(d) > 1 and d.std(ddof=1) > 0 else float("nan")})
    if boot and len(d) > 1:
        g = rng_for(name)
        db = d[g.integers(0, len(d), (B, len(d)))]
        out["ci95_mean_difference"] = percentile_ci(db.mean(axis=1))
        a = np.abs(db)
        a[db == 0] = np.nan
        rk = stats.rankdata(a, axis=1, nan_policy="omit")
        rp = np.nansum(np.where(db > 0, rk, 0), axis=1)
        rm = np.nansum(np.where(db < 0, rk, 0), axis=1)
        with np.errstate(invalid="ignore", divide="ignore"):
            out["ci95_rank_biserial_r"] = percentile_ci((rp - rm) / (rp + rm))
    return out


def sign_test(diff) -> dict:
    d = clean(diff)
    pos, neg = int(np.sum(d > 0)), int(np.sum(d < 0))
    if pos + neg == 0:
        return {"test": "sign test", "p": float("nan"), "positive": pos, "negative": neg}
    res = stats.binomtest(pos, pos + neg, 0.5, alternative="greater")
    return {"test": "sign test (exact binomial on the non-zero differences)", "p": float(res.pvalue),
            "positive": pos, "negative": neg, "zero": int(np.sum(d == 0))}


def binomial(k: int, n: int, p0: float) -> dict:
    if n == 0:
        return {"test": "exact binomial", "n": 0, "p": float("nan")}
    res = stats.binomtest(int(k), int(n), p0, alternative="greater")
    # The two-sided 95% Clopper-Pearson interval (OSF page 6). SciPy builds the interval of a ONE-sided test as one-sided
    # (up to 1.0), so it is taken from the two-sided test of the same counts (found by the R cross-check, 17 November 2026).
    ci = stats.binomtest(int(k), int(n), p0).proportion_ci(confidence_level=0.95, method="exact")
    return {"test": "exact binomial, one-sided", "n": int(n), "successes": int(k), "rate": k / n, "chance": p0,
            "p": float(res.pvalue), "estimate": k / n - p0, "ci95_clopper_pearson": [float(ci.low), float(ci.high)]}


def spearman(x, y, name: str, boot: bool = True) -> dict:
    x, y = np.asarray(x, float), np.asarray(y, float)
    keep = ~(np.isnan(x) | np.isnan(y))
    x, y = x[keep], y[keep]
    n = len(x)
    if n < 4 or np.std(x) == 0 or np.std(y) == 0:
        return {"test": "Spearman", "n": n, "p": float("nan"), "note": "too few or constant values"}
    res = stats.spearmanr(x, y, alternative="greater")
    out = {"test": "Spearman (t approximation), one-sided", "n": n, "rho": float(res.statistic), "p": float(res.pvalue),
           "estimate": float(res.statistic)}
    if boot:
        g = rng_for(name)
        idx = g.integers(0, n, (B, n))
        rx, ry = stats.rankdata(x[idx], axis=1), stats.rankdata(y[idx], axis=1)
        rx -= rx.mean(axis=1, keepdims=True)
        ry -= ry.mean(axis=1, keepdims=True)
        with np.errstate(invalid="ignore", divide="ignore"):
            rho = (rx * ry).sum(axis=1) / np.sqrt((rx ** 2).sum(axis=1) * (ry ** 2).sum(axis=1))
        out["ci95_rho"] = percentile_ci(rho)
    return out


def partial_spearman(x, y, z, name: str, boot: bool = True) -> dict:
    """The Spearman correlation of x and y with z held fixed: the partial correlation of the three sets of ranks."""
    x, y, z = (np.asarray(v, float) for v in (x, y, z))
    keep = ~(np.isnan(x) | np.isnan(y) | np.isnan(z))
    x, y, z = x[keep], y[keep], z[keep]
    n = len(x)
    if n < 5:
        return {"test": "partial Spearman", "n": n, "p": float("nan")}

    def pr(a, b, c):
        ra, rb, rc = stats.rankdata(a), stats.rankdata(b), stats.rankdata(c)
        rab = np.corrcoef(ra, rb)[0, 1]
        rac = np.corrcoef(ra, rc)[0, 1]
        rbc = np.corrcoef(rb, rc)[0, 1]
        return (rab - rac * rbc) / math.sqrt((1 - rac ** 2) * (1 - rbc ** 2))
    r = pr(x, y, z)
    t = r * math.sqrt((n - 3) / (1 - r ** 2))
    p = float(stats.t.sf(t, n - 3))
    out = {"test": "partial Spearman (rank partial correlation, t with n - 3 df), one-sided", "n": n,
           "rho_partial": float(r), "p": p, "estimate": float(r)}
    if boot:
        g = rng_for(name)
        vals = []
        for _ in range(B):
            i = g.integers(0, n, n)
            with np.errstate(invalid="ignore", divide="ignore"):
                try:
                    vals.append(pr(x[i], y[i], z[i]))
                except (ValueError, ZeroDivisionError):
                    vals.append(np.nan)
        out["ci95_rho_partial"] = percentile_ci(np.asarray(vals, float))
    return out


# ------------------------------------------------------------------------------------------------- D1: equivalence
def tost_paired(diff, margin: float = 5.0) -> dict:
    d = clean(diff)
    n = len(d)
    if n < 3:
        return {"test": "TOST", "n": n, "p": float("nan")}
    m, se = d.mean(), d.std(ddof=1) / math.sqrt(n)
    df = n - 1
    if se == 0:
        p_low = p_high = 0.0 if abs(m) < margin else 1.0
    else:
        p_low = float(stats.t.sf((m + margin) / se, df))      # H0: mean <= -margin
        p_high = float(stats.t.cdf((m - margin) / se, df))    # H0: mean >= +margin
    q = stats.t.ppf(0.95, df)
    return {"test": f"two one-sided t-tests (TOST), margin +/-{margin:g}", "n": n, "mean_difference": float(m), "df": df,
            "t_lower": float((m + margin) / se) if se > 0 else float("nan"),
            "t_upper": float((m - margin) / se) if se > 0 else float("nan"),
            "p_lower": p_low, "p_upper": p_high, "p": max(p_low, p_high), "estimate": float(m),
            "ci90_mean_difference": [float(m - q * se), float(m + q * se)],
            "cohens_dz": float(m / d.std(ddof=1)) if d.std(ddof=1) > 0 else float("nan")}


def tost_wilcoxon(diff, margin: float = 5.0) -> dict:
    d = clean(diff)
    if len(d) < 3:
        return {"test": "TOST (Wilcoxon)", "n": len(d), "p": float("nan")}
    lo = signed_rank(d + margin, "unused", "greater", boot=False)
    hi = signed_rank(d - margin, "unused", "less", boot=False)
    return {"test": f"two one-sided Wilcoxon signed-rank tests, margin +/-{margin:g}", "n": len(d),
            "p_lower": lo["p"], "p_upper": hi["p"], "p": max(lo["p"], hi["p"])}


# ------------------------------------------------------------------------------------------------- A4: mixed logistic
_GH_NODES, _GH_WEIGHTS = np.polynomial.hermite.hermgauss(25)


def _cluster_loglik(y: np.ndarray, eta: float, sigma: float) -> float:
    """log of the integral over b ~ N(0,1) of prod_j Bernoulli(y_j | eta + sigma * b): adaptive Gauss-Hermite, 25 nodes."""
    k1, k = y.sum(), len(y)

    def h(b):   # log integrand
        e = eta + sigma * b
        return k1 * e - k * np.logaddexp(0.0, e) - 0.5 * b * b - 0.5 * math.log(2 * math.pi)
    if sigma <= 1e-8:
        return float(h(0.0) + 0.5 * math.log(2 * math.pi))
    b = 0.0
    for _ in range(50):    # the mode of the integrand (Newton)
        e = eta + sigma * b
        pr = 1 / (1 + math.exp(-e))
        g = sigma * (k1 - k * pr) - b
        hh = -(sigma ** 2) * k * pr * (1 - pr) - 1
        step = g / hh
        b -= step
        if abs(step) < 1e-10:
            break
    e = eta + sigma * b
    pr = 1 / (1 + math.exp(-e))
    s = 1 / math.sqrt(sigma ** 2 * k * pr * (1 - pr) + 1)
    pts = b + math.sqrt(2) * s * _GH_NODES
    vals = h(pts) + _GH_NODES ** 2
    m = vals.max()
    return float(math.log(math.sqrt(2) * s) + m + math.log(np.sum(_GH_WEIGHTS * np.exp(vals - m))))


def mixed_logistic(y, x, cluster) -> dict:
    """y ~ x + (1 | cluster), by maximum likelihood with adaptive Gauss-Hermite quadrature (25 nodes); x is the help
    step (one value per participant). Wald test on x's coefficient from the inverse of the numerical Hessian."""
    y, x = np.asarray(y, float), np.asarray(x, float)
    cluster = np.asarray(cluster)
    groups = {}
    for i, c in enumerate(cluster):
        groups.setdefault(c, []).append(i)
    # A cluster's likelihood depends only on its size, its number of good fits and its x, so equal patterns are summed once.
    patterns = {}
    for idx in groups.values():
        key = (len(idx), int(y[idx].sum()), float(x[idx[0]]))
        patterns[key] = patterns.get(key, 0) + 1
    pats = [(np.array([1.0] * k1 + [0.0] * (k - k1)), xx, count) for (k, k1, xx), count in patterns.items()]

    def nll(theta):
        b0, b1, sig = theta
        return -sum(count * _cluster_loglik(yy, b0 + b1 * xx, abs(sig)) for yy, xx, count in pats)
    p0 = min(max(y.mean(), 0.02), 0.98)
    best = None
    for start_sigma in (0.3, 1.0, 2.5):
        res = optimize.minimize(nll, np.array([math.log(p0 / (1 - p0)), 0.0, start_sigma]), method="L-BFGS-B",
                                bounds=[(-30, 30), (-30, 30), (0, 30)], options={"ftol": 1e-13, "gtol": 1e-9, "maxiter": 2000})
        if best is None or res.fun < best.fun:
            best = res
    b0, b1, sig = best.x
    sig = abs(sig)
    theta = np.array([b0, b1, sig])
    # The numerical Hessian (central differences)
    h = 1e-4
    H = np.zeros((3, 3))
    f0 = nll(theta)
    for i in range(3):
        for j in range(3):
            ei, ej = np.eye(3)[i] * h, np.eye(3)[j] * h
            H[i, j] = (nll(theta + ei + ej) - nll(theta + ei - ej) - nll(theta - ei + ej) + nll(theta - ei - ej)) / (4 * h * h)
    singular = sig < 1e-4
    out = {"model": "mixed logistic regression, random intercept per participant, adaptive Gauss-Hermite (25 nodes)",
           "converged": bool(best.success), "singular": bool(singular), "intercept": float(b0), "help": float(b1),
           "random_intercept_sd": float(sig), "loglik": float(-f0), "decisions": int(len(y)), "participants": len(groups)}
    try:
        cov = np.linalg.inv(H if not singular else H[:2, :2])
        se = float(math.sqrt(cov[1, 1]))
        out["se_help"] = se
    except np.linalg.LinAlgError:
        out["se_help"] = float("nan")
        out["converged"] = False
    return out


def clustered_logistic(y, x, cluster) -> dict:
    """The registered fallback: logistic regression with participant-clustered robust standard errors."""
    import statsmodels.api as sm
    X = sm.add_constant(np.asarray(x, float))
    codes = np.unique(np.asarray(cluster), return_inverse=True)[1]
    fit = sm.Logit(np.asarray(y, float), X).fit(disp=0, cov_type="cluster", cov_kwds={"groups": codes})
    return {"model": "logistic regression, participant-clustered robust standard errors (the registered fallback)",
            "intercept": float(fit.params[0]), "help": float(fit.params[1]), "se_help": float(fit.bse[1]),
            "decisions": int(len(y)), "participants": int(codes.max() + 1)}


# ------------------------------------------------------------------------------------------------- C7: conditional logit
def conditional_logit(X: np.ndarray, chosen: np.ndarray, strata: np.ndarray, clusters: np.ndarray) -> dict:
    """Maximum likelihood by Newton-Raphson; one chosen option per stratum. Returns the coefficients, the log-likelihood,
    the model-based and the participant-clustered (sandwich, no small-sample factor) standard errors."""
    X = np.asarray(X, float)
    chosen = np.asarray(chosen, int)
    s_codes = np.unique(strata, return_inverse=True)[1]
    S = s_codes.max() + 1
    k = X.shape[1]
    beta = np.zeros(k)

    def pieces(beta):
        eta = X @ beta
        m = np.full(S, -np.inf)
        np.maximum.at(m, s_codes, eta)
        ex = np.exp(eta - m[s_codes])
        den = np.zeros(S)
        np.add.at(den, s_codes, ex)
        p = ex / den[s_codes]
        ll = float(np.sum(eta[chosen == 1]) - np.sum(m + np.log(den)))
        xbar = np.zeros((S, k))
        np.add.at(xbar, s_codes, p[:, None] * X)
        score_s = np.zeros((S, k))
        np.add.at(score_s, s_codes[chosen == 1], X[chosen == 1])
        score_s -= xbar
        dev = X - xbar[s_codes]
        info = (p[:, None] * dev).T @ dev
        return ll, score_s, info
    for _ in range(100):
        ll, score_s, info = pieces(beta)
        step = np.linalg.solve(info, score_s.sum(axis=0))
        beta = beta + step
        if np.max(np.abs(step)) < 1e-10:
            break
    ll, score_s, info = pieces(beta)
    inv = np.linalg.inv(info)
    stratum_cluster = {}
    for sc, cl in zip(s_codes, clusters):
        stratum_cluster[sc] = cl
    cl_codes = np.unique([stratum_cluster[i] for i in range(S)], return_inverse=True)[1]
    G = np.zeros((cl_codes.max() + 1, k))
    np.add.at(G, cl_codes, score_s)
    robust = inv @ (G.T @ G) @ inv
    return {"beta": beta, "loglik": ll, "se": np.sqrt(np.diag(inv)), "se_clustered": np.sqrt(np.diag(robust)),
            "strata": int(S), "clusters": int(cl_codes.max() + 1)}
