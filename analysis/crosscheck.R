# crosscheck.R: the same registered tests, computed again by a second, independent program (17 November 2026).
#
# Part 10 of PLAN_Analysis_code.md. It reads the three tables build_tables.py wrote as CSV (P.csv, S.csv, O.csv) and
# computes, with R's own functions: the rank tests (wilcox.test), the Spearman tests (cor.test), the binomial test
# (binom.test), A4 with lme4's glmer (adaptive Gauss-Hermite, 25 nodes), C3 with glm, C7 with survival's clogit
# (participant-clustered robust errors), D4 with lm and sandwich's HC3 errors (lmtest's coeftest), and D1's TOST. It
# writes crosscheck_R.json beside the tables; check_on_simulated.py and run_on_real.py compare it with Python's numbers.
#
# Run: Rscript analysis/crosscheck.R <folder with P.csv, S.csv, O.csv>
suppressPackageStartupMessages({
  library(jsonlite); library(lme4); library(survival); library(sandwich); library(lmtest)
})
args <- commandArgs(trailingOnly = TRUE)
dir <- args[1]
P <- read.csv(file.path(dir, "P.csv"), stringsAsFactors = FALSE)
S <- read.csv(file.path(dir, "S.csv"), stringsAsFactors = FALSE)
O <- read.csv(file.path(dir, "O.csv"), stringsAsFactors = FALSE)
tf <- function(v) v %in% c("True", "TRUE", "true", TRUE)
out <- list()
levels4 <- c("CVR+APA", "CVR_Only", "APA_Only", "Baseline")

# The Wilcoxon signed-rank test with R's default exact rule, no continuity correction (zeros dropped).
sr <- function(d, alt) {
  d <- d[!is.na(d)]
  r <- suppressWarnings(wilcox.test(d, alternative = alt, correct = FALSE))
  list(p = unname(r$p.value), V = unname(r$statistic), n = length(d))
}
mw <- function(x, y) {
  r <- wilcox.test(x[!is.na(x)], y[!is.na(y)], alternative = "greater", exact = FALSE, correct = TRUE)
  list(p = unname(r$p.value), W = unname(r$statistic))
}
vci <- function(c) P$vci[P$condition == c]
out$A1 <- mw(vci("CVR+APA"), vci("Baseline"))
out$A2 <- mw(vci("CVR+APA"), vci("APA_Only"))
out$A3 <- mw(vci("CVR+APA"), vci("CVR_Only"))

# A4: decisions in 1-4 whose first pick was Misaligned or Strongly misaligned
dec <- S[tf(S$decision) & tf(S$first_misfit), ]
dec$good <- as.integer(tf(dec$final_good_fit))
dec$help <- as.integer(dec$condition != "Baseline")
m <- glmer(good ~ help + (1 | pid), data = dec, family = binomial, nAGQ = 25)
co <- summary(m)$coefficients
out$A4 <- list(help = co["help", "Estimate"], se_help = co["help", "Std. Error"],
               p = pnorm(co["help", "Estimate"] / co["help", "Std. Error"], lower.tail = FALSE),
               random_intercept_sd = as.data.frame(VarCorr(m))$sdcor[1], singular = isSingular(m))
# The registered fallback (a singular or failed mixed model): logistic regression, participant-clustered robust errors
gl <- glm(good ~ help, data = dec, family = binomial)
for (type in c("HC0", "HC1")) {
  vc <- vcovCL(gl, cluster = ~pid, type = type)
  out$A4[[paste0("fallback_", type)]] <- list(help = unname(coef(gl)["help"]), se_help = sqrt(vc["help", "help"]),
    p = pnorm(coef(gl)["help"] / sqrt(vc["help", "help"]), lower.tail = FALSE)[[1]])
}

# Family B: departure share, one value per participant per scenario (order 1-6; 6 = the rule before the prediction)
w <- reshape(S[, c("pid", "order", "departure")], idvar = "pid", timevar = "order", direction = "wide")
w <- w[match(P$pid, w$pid), ]
d <- function(k) w[[paste0("departure.", k)]]
out$B1 <- sr(d(5) - d(4), "two.sided")
out$B2 <- sr((d(1) + d(2)) / 2 - d(3), "greater")
out$B3 <- sr(d(2) - d(1), "greater")
out$B4 <- sr(d(4) - d(3), "greater")
out$B5 <- sr((d(1) + d(2)) / 2 - d(6), "greater")
# B6: Pratt's method (zeros ranked, then left out of the sum), normal approximation, tie-corrected
pratt <- function(x) {
  x <- x[!is.na(x)]; n <- length(x); r <- rank(abs(x)); n0 <- sum(x == 0)
  t <- sum(r[x > 0]); mn <- (n * (n + 1) - n0 * (n0 + 1)) / 4
  vr <- (n * (n + 1) * (2 * n + 1) - n0 * (n0 + 1) * (2 * n0 + 1)) / 24
  tie <- table(r[x != 0]); vr <- vr - sum(tie^3 - tie) / 48   # ties among the non-zero differences only
  list(p = pnorm((t - mn) / sqrt(vr), lower.tail = FALSE), T_plus = t)
}
out$B6 <- pratt(P$wish_gap)
sp <- function(x, y) { r <- suppressWarnings(cor.test(x, y, method = "spearman", alternative = "greater", exact = FALSE))
  list(rho = unname(r$estimate), p = r$p.value) }
pspear <- function(x, y, z) {
  k <- !(is.na(x) | is.na(y) | is.na(z)); x <- rank(x[k]); y <- rank(y[k]); z <- rank(z[k]); n <- length(x)
  rxy <- cor(x, y); rxz <- cor(x, z); ryz <- cor(y, z)
  r <- (rxy - rxz * ryz) / sqrt((1 - rxz^2) * (1 - ryz^2)); t <- r * sqrt((n - 3) / (1 - r^2))
  list(rho_partial = r, p = pt(t, n - 3, lower.tail = FALSE))
}
out$B7 <- list(spearman = sp(P$place_spread, P$position_spread),
               partial_spearman = pspear(P$place_spread, P$position_spread, P$vci))

# Family C
h <- P$s6_hit[!is.na(P$s6_hit) & P$s6_hit != ""]
k <- sum(tf(h)); n <- length(h)
bt <- binom.test(k, n, 0.25, alternative = "greater")
out$C1 <- list(p = bt$p.value, ci95_clopper_pearson = as.numeric(binom.test(k, n, 0.25)$conf.int))
c3 <- P[!is.na(P$s6_top_p) & P$s6_hit != "", ]
c3$hit <- as.integer(tf(c3$s6_hit)); c3$condition <- factor(c3$condition, levels = levels4)
g3 <- summary(glm(hit ~ s6_top_p + condition, data = c3, family = binomial))$coefficients
out$C3 <- list(slope = g3["s6_top_p", "Estimate"], p = pnorm(g3["s6_top_p", "z value"], lower.tail = FALSE))
c4 <- P[!is.na(P$s6_sounds_like_me) & P$s6_hit != "", ]
out$C4 <- mw(c4$s6_sounds_like_me[tf(c4$s6_hit)], c4$s6_sounds_like_me[!tf(c4$s6_hit)])
# C7: conditional logit, first pick in 1-4, position (1 = reference) + performance captured (+ fit before the scenarios).
# One chosen option per stratum, so the "breslow" likelihood is the exact conditional likelihood (and allows robust errors).
O$position <- factor(O$position, levels = 1:6)
m0 <- clogit(chosen ~ position + captured + strata(stratum), data = O, method = "breslow")
m1 <- clogit(chosen ~ position + captured + fit_before + strata(stratum) + cluster(pid), data = O, method = "breslow")
lr <- 2 * (m1$loglik[2] - m0$loglik[2])
b <- unname(coef(m1)["fit_before"])
out$C7 <- list(likelihood_ratio = lr, fit_coefficient = b,
               p = if (b > 0) pchisq(lr, 1, lower.tail = FALSE) / 2 else 1 - pchisq(lr, 1, lower.tail = FALSE) / 2,
               se_clustered = unname(sqrt(diag(m1$var))[length(coef(m1))]))

# Family D
el <- S[tf(S$decision) & tf(S$first_misfit) & tf(S$page_opened), ]
d1 <- tapply(el$captured_final - el$captured_first, el$pid, mean)
tl <- t.test(d1, mu = -5, alternative = "greater"); th <- t.test(d1, mu = 5, alternative = "less")
out$D1 <- list(p = max(tl$p.value, th$p.value), mean_difference = mean(d1),
               ci90 = as.numeric(t.test(d1, conf.level = 0.90)$conf.int))
ch <- el[tf(el$changed) & el$condition != "Baseline", ]
out$D2 <- sr(tapply(ch$shortfall_first - ch$shortfall_final, ch$pid, mean), "greater")
lev <- c("CVR+APA" = 57, "CVR_Only" = 60, "APA_Only" = 63, "Baseline" = 60)
out$D3 <- sr(P$vci - lev[P$condition], "greater")
d4 <- P[complete.cases(P[, c("wellbeing", "satisfaction", "vci", "stability", "performance", "age", "active_minutes")]) &
        P$gender3 != "", ]
z <- function(v) if (sd(v) > 0) (v - mean(v)) / sd(v) else v * 0
d4$stab_z <- ave(d4$stability, d4$condition, FUN = z)
for (v in c("vci", "performance", "age", "active_minutes", "wellbeing", "satisfaction")) d4[[paste0(v, "_z")]] <- z(d4[[v]])
ref <- names(sort(table(d4$gender3), decreasing = TRUE))[1]
d4$gender3 <- relevel(factor(d4$gender3), ref = ref)
d4$condition <- factor(d4$condition, levels = levels4)
reg <- function(y) {
  f <- lm(as.formula(paste(y, "~ vci_z + stab_z + performance_z + age_z + active_minutes_z + gender3 + condition")), data = d4)
  ct <- coeftest(f, vcov = vcovHC(f, type = "HC3"))
  list(beta = ct["vci_z", "Estimate"], se = ct["vci_z", "Std. Error"], p = pt(ct["vci_z", "t value"], f$df.residual, lower.tail = FALSE))
}
out$D4 <- list(wellbeing_composite = reg("wellbeing_z"), decision_satisfaction = reg("satisfaction_z"))
out$D5 <- sp(P$value_congruence, P$vci)
out$controls <- list(push_vs_pull = sr(P$trolley_bridge - P$trolley_lever, "greater"),
                     shelter_vs_sidewalk = sr(P$money_shelter - P$money_sidewalk, "greater"),
                     entry_level_vs_safety_net = sr(P$ai_low_buffer_mean - P$ai_high_buffer_mean, "greater"))
out$R_version <- R.version.string
write(toJSON(out, auto_unbox = TRUE, digits = NA, null = "null", na = "null"), file.path(dir, "crosscheck_R.json"))
cat("crosscheck_R.json written\n")
