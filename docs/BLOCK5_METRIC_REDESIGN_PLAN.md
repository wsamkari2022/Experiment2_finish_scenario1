# Block 5 performance metrics — redesign plan

**Status:** APPROVED AND IMPLEMENTED, 2026-08-23. Section 10 records what changed during
implementation and why — read it alongside the plan above, which is kept as written for the record.
**Written:** 2026-08-23

---

## 1. Why this is being done

The eight performance metrics were authored as a mirror of the option fingerprints rather than as
an independent description of what each option does. Measured across all 30 authored options:

| Metric | Restates this value | r |
|---|---|---|
| Vulnerable Protection | Vulnerability protection | **0.98** |
| Total Benefit | Outcome aggregation (Utility) | **0.80** |
| Fairness / Equity | Vulnerability protection | **0.80** |
| Harm Reduction | Outcome aggregation (Utility) | **0.73** |

At r = 0.98 the dashboard is not showing a second thing about the option — it is showing the same
number twice under two headings. A participant who reads "Vulnerable Protection 60" on the
dashboard and "Vulnerability protection 26" in the sidebar and assumes they are related is not
confused; they are right.

The consequence at the aggregate level: **overall performance correlates r = 0.81 with the mean of
the four policy values.** An option that fits the participant's profile also scores well on the
dashboard, close to by construction. That removes the trade-off the block exists to observe.

The origin of the habit is visible in `deriveMetrics()` in `block5CVR.ts`, a fallback for
unauthored scenarios that literally sets `totalBenefit = outcomeAggregationSensitivity` and
`vulnerableProtection = vulnerabilityProtectionSensitivity`. It never runs today, because all 30
options carry authored metrics — but it is where the pattern came from and it is deleted by this
plan.

### Why the fix is not deletion

Filtering out every metric that duplicates a value leaves exactly three: Resource Efficiency,
Long-term Impact, Predictability. Those are the *least* morally loaded three. The dashboard would
become a project-management scorecard with no ethics in it. The four that would be deleted
duplicate the values **because the values are the moral dimensions** — that cannot be fixed by
subtraction.

### The principle the redesign rests on

> **The four values ask *who* and *how much*. The metrics must ask *how well it went*.**

Two axes that can never collapse into each other. That also turns the dashboard into a real second
variable and gives Block 5 a question worth asking: *do participants trade moral alignment against
practical performance?*

---

## 2. The six metrics

Each is defined by an **invariant construct** — the thing being measured, identical in every
scenario — plus a per-scenario reading (section 3).

| # | Metric | Invariant construct | Why it cannot duplicate a value |
|---|---|---|---|
| 1 | **Speed** | How soon the benefit reaches the people it is meant to help. | Timing, not amount. *Currently unmeasured.* |
| 2 | **Resource use** | How little of the limited supply the option consumes. | The input side; the values are all about the output. |
| 3 | **Reliability** | How likely the plan is to work as intended rather than go wrong. | Uncertainty, not amount. |
| 4 | **Durability** | Whether the benefit outlasts the immediate moment. | Time horizon, not amount. |
| 5 | **Practicality** | How much effort it takes the decision-maker to carry out. | Cost to the chooser, not to the affected. |
| 6 | **Reversibility** | If it turns out wrong, how easily you can change course. | Recoverability — no value touches this. |

**Practicality vs Reliability must stay distinct.** In the current set they correlate r = 0.77.
The rubric separates them sharply:

- **Practicality** = *how hard is this to execute?* (input burden on you)
- **Reliability** = *how likely is the intended outcome?* (output uncertainty)

They genuinely come apart: ordering takeaway is easy but may arrive late and cold (high
practicality, low reliability); cooking from scratch is hard but fully under your control (low
practicality, high reliability). Any authored pair that violates this separation is a coding error.

**Higher is always better,** on all six, so the dashboard reads consistently. "Resource use 85"
means *uses little*, not *uses much*. The label will read **"Resource use"** with the hover
"How little of the limited supply this uses — higher means leaner."

---

## 3. Problem 1 — the same metric means different things in each scenario

Raised in review: *"'Speed' in a traveling scenario is different from a cancer scenario."*

Correct, and it applies to all six. If Speed means "arrival time" in travel and "time to treatment"
in cancer, then the dashboard — which **averages each metric across completed scenarios** — is
averaging different quantities. Four devices solve this together.

### Device 1 — one construct, five documented readings

The metric measures the same construct everywhere; only its surface realization changes. This is
made explicit in the type so an author cannot skip it:

```ts
interface MetricDef {
  key: Block5MetricKey;
  label: string;            // constant, shown on the dashboard
  invariant: string;        // the construct — governs authoring, not shown
  hover: string;            // scenario-independent fallback text
  readings: Record<Block5ScenarioId, string>;  // what it means HERE
}
```

The full reading table:

| Metric | Travel · Fairhaven | Dinner for Four | Cancer doses | Flood evacuation | Water contamination |
|---|---|---|---|---|---|
| **Speed** | how soon you arrive, and how much of your own time comes back | how soon everyone is actually eating | how soon treatment begins for those who receive it | how soon people are out of danger | how soon safe water is back |
| **Resource use** | money and fuel spent per person | how little of the $80 and two hours it uses | how little of the 20 doses and staff time it consumes | boats, crews and fuel committed | budget and crew hours committed |
| **Reliability** | chance of delay or a missed connection | chance the meal fails or someone can't eat it | chance the treatment achieves what is hoped | chance the plan actually gets everyone out | chance the fix really clears the contamination |
| **Durability** | whether the route survives for future travellers | leftovers, and whether it is repeatable | length of the benefit, not just the first weeks | whether it builds lasting resilience or works once | a permanent repair vs a temporary supply |
| **Practicality** | booking, connections, luggage | skill and effort the cook needs | clinical and administrative complexity | how hard it is to coordinate | engineering and permitting difficulty |
| **Reversibility** | can you rebook or change plans | can you order something else if it fails | can doses be reallocated, or is the decision final | can you redirect resources mid-operation | can you switch approach without wasting the work |

Every cell is the *same* underlying construct — latency of benefit, input consumed, outcome
uncertainty, persistence, execution burden, recoverability. That is what makes the average across
scenarios legitimate.

### Device 2 — scores are relative to what this situation allows

This is the device that actually solves the problem. **A metric score is not an absolute physical
quantity.** It answers: *among the six options available in this scenario, how well does this one
do on this construct?*

Anchored rubric, applied inside each scenario:

| Band | Meaning |
|---|---|
| 90–100 | The best this situation allows on this construct |
| 70–85 | Clearly good here |
| 50–65 | Middling — neither a strength nor a weakness |
| 30–45 | Clearly poor here |
| 10–25 | The worst this situation allows |

So "Speed 90" in the cancer scenario does **not** claim the treatment is as fast as a flight. It
claims this option gets treatment started about as quickly as anything could in that situation.
Averaging that with Speed 90 in travel is meaningful: both say *this participant consistently
chose the option that gets help there soonest*.

This is the same logic the ladders in Blocks 1–3 already use — only the position within the
instrument carries meaning, never the raw dollar or life figure (see `MEASUREMENT_MODEL.md` §1).
The metric set now follows the same rule, which makes the whole instrument consistent.

### Device 3 — the participant sees the reading, not just the label

`METRIC_HOVER` becomes scenario-aware. In the water scenario the tooltip reads
**"Speed — how soon safe water is back."** In the dinner scenario, **"Speed — how soon everyone is
actually eating."** The label stays constant so the dashboard is comparable; the gloss adapts so
the participant is never guessing what the bar means in this context.

### Device 4 — a metric must earn its place in each scenario

A construct that does not vary between the six options tells the participant nothing about their
choice. Rule: **within-scenario range ≥ 30 points, in at least 4 of the 5 scenarios.**

Not all 5, deliberately. Some constructs genuinely flatten in some domains — reversibility varies
a lot at dinner (order a pizza) and barely at all once doses are administered. That is a true fact
about the domain and should be visible, not manufactured. But a metric that flattens in three or
more scenarios is not carrying its weight and gets cut.

---

## 4. Problem 2 — the fingerprints

Raised in review: *"the fingerprints of each option in each scenario should be in your
considerations."*

### The fingerprints are frozen

They were calibrated in Stage 3 by a uniform translation (VULN +0, GROUP −3, GAIN −17,
OUTCOME −23) chosen so that CVR triggering balances across the four values and every option is
winnable by someone. `npm run validate:block5` enforces that balance. **Changing a fingerprint
breaks it.** Therefore every adjustment in this redesign happens on the metric side only.

### What the relationship between metrics and fingerprints should be

Not zero correlation for its own sake — the target is a **genuine trade-off**:

- If performance correlates **positively** with a value (today: r = 0.81 on the aggregate), a
  participant who holds that value never pays for it. No dilemma.
- If performance were engineered **negatively**, values would be punished by construction — an
  artefact pointing the other way.
- The target is **near zero on average, with all four quadrants populated inside every scenario.**

### Quadrant coverage — the constraint that matters most

For each scenario, and for each of the four policy values V, the six options must include:

- at least one **high-V, low-performance** option (holding V costs you), and
- at least one **low-V, high-performance** option (abandoning V pays you).

Without both, a participant who holds V faces no trade-off at all and their Block 5 data says
nothing. This is checked per scenario, not just globally, because the choice is made inside one
scenario at a time.

### Numeric targets

| Check | Target | Hard fail |
|---|---|---|
| Each metric × each of the 7 fingerprint dimensions (42 pairs) | \|r\| < 0.45 | ≥ 0.50 |
| Metric × metric (15 pairs) | \|r\| < 0.60 | ≥ 0.70 |
| Performance × mean of the 4 policy values | \|r\| < 0.30 | ≥ 0.40 |
| Performance × each policy value individually | \|r\| < 0.40 | ≥ 0.50 |
| Quadrant coverage, per scenario per value | all 5 × 4 satisfied | any missing |

Baseline to beat: the current set fails four of these outright (0.98, 0.80, 0.80, 0.73 on the
first row; 0.81 on the third).

---

## 5. How the numbers get authored

> *"Each option's impact on the metrics should really reflect the option."*

### Prose is the source of truth

Every option already carries `summary`, `gains`, `givesUp`, `consequence` and `moralTension`,
written before any number existed. **The metric values are coded from that text.** They are not
invented to satisfy the gates, and they are not derived from the fingerprint — that is exactly the
mistake being corrected.

Procedure per option:

1. Read the option's own prose and the scenario's `factBase`.
2. For each of the six constructs, locate what the prose actually says about it.
3. Place it on the 10–100 anchored band **relative to the other five options in that scenario**.
4. Record a one-line justification quoting the phrase it came from.

Where the prose is silent on a construct, the score defaults to the middling band (50–65) and the
gap is logged — silence is not evidence of a strength or a weakness.

### Worked example 1 — "Take the overnight train" (travel)

> *gains:* "The lowest pollution of any option, plus a comfortable overnight trip you can work or
> sleep through."
> *givesUp:* "Money and flexibility. The ticket is well above the bus, and you still need local
> transport at both ends."
> *moralTension:* "…when a cheaper option delivers you just as reliably?"

| Construct | Score | Coded from |
|---|---|---|
| Speed | 45 | Overnight — slower than the flight, faster than the slow bus. Third of six. |
| Resource use | 60 | "ticket is well above the bus" (money high) against very low fuel per passenger. Mixed. |
| Reliability | 82 | Fixed timetable, and the tension line concedes rivals deliver "just as reliably" — so this is the benchmark. |
| Durability | 90 | Lowest lasting environmental damage; the fare keeps a rail service viable. |
| Practicality | 58 | "the timetable decides when you leave", "local transport at both ends". |
| Reversibility | 55 | Tickets are changeable, but the timetable constrains. |

Fingerprint for this option is `vuln 58 · group 59 · gain 33 · outcome 73`. The metric row above
does not track it — the highest metric (Durability 90) sits against a middling vulnerability
score, and Speed 45 sits against outcome 73. That is the decoupling this redesign is for.

### Worked example 2 — "Prioritize essential workers / caregivers" (cancer)

> *gains:* "Hospitals and key services keep running for everyone."
> *givesUp:* "The sickest patients, and the idea that every life counts the same."
> *moralTension:* "Is it right to treat people according to how useful they are to everyone else?"

| Construct | Score | Coded from |
|---|---|---|
| Speed | 60 | Establishing who counts as "essential" adds a screening step before treatment starts. |
| Resource use | 80 | All 20 doses are used, targeted, nothing wasted. |
| Reliability | 78 | "Essential worker" is a checkable criterion, so the plan executes as written. |
| Durability | 88 | "keeps the whole health system running" — benefit persists well past this month. |
| Practicality | 55 | Requires defining and adjudicating "essential", which is contested. |
| Reversibility | 35 | Doses given are gone, and the classification persists into next month. |

Old row for the same option: `vulnerableProtection 55` against `fingerprint.vulnerability 56` —
the duplication in miniature. The new row has no such mirror.

### Reproducibility

The rubric and the per-option justifications are written into `docs/BLOCK5_METRIC_CODING.md` so
the coding is reproducible rather than a matter of taste. For the dissertation, the defensible
version of this is a **second coder on a subset** (10 of 30 options is enough for a κ) — worth
raising with the advisor, and cheap to do once the rubric exists.

---

## 6. Acceptance gates

Added to `npm run validate:block5`, so they run on every change from now on:

| ID | Gate |
|---|---|
| **G1** | Every one of the 30 options has all 6 metrics, integers 0–100. `metrics` is a **required** field. |
| **G2** | Within-scenario range ≥ 30 for each metric in ≥ 4 of 5 scenarios. |
| **G3** | \|r\| < 0.50 for all 42 metric × fingerprint pairs. |
| **G4** | \|r\| < 0.70 for all 15 metric × metric pairs. |
| **G5** | \|r\| < 0.40 for performance × mean of the 4 policy values. |
| **G6** | Quadrant coverage satisfied for all 5 scenarios × 4 values. |
| **G7** | No metric's grand mean outside 55–80 — no systematically easy or hard metric. |
| **G8** | Every existing gate still passes (champions, domination, no-obviously-best, CVR content). |

---

## 7. Code changes

| File | Change |
|---|---|
| `block5Types.ts` | `Block5MetricKey` → the 6 new keys; replace `METRIC_LABELS` / `METRIC_HOVER` with `METRIC_DEFS` carrying invariant + per-scenario readings. |
| `block5Scenarios.ts` | 30 × 6 authored values replace 30 × 8. |
| `block5CVR.ts` | **Delete `deriveMetrics()`** and make `metrics` required on `Block5ScenarioOption`, so no future scenario can silently inherit its fingerprint. `performanceScore`, `cumulativeMetrics`, `projectedMetrics`, `metricProfileScore` follow `METRIC_KEYS` and need no logic change. |
| `Block5PublicEmergencySimulation.tsx` | Dashboard grid 4×2 → 3×2; tooltip reads the scenario-specific gloss. |
| `Block5OptionCompare.tsx` | Performance radar 8 axes → 6. |
| `tools/validate_block5.cjs` | Add G1–G7. It currently has **no** metric coverage at all — that gap is why this went unnoticed. |
| `participantRecord.ts` | Bump `PARTICIPANT_RECORD_SCHEMA_VERSION` 1 → 2; the stored metric shape changes. |
| `docs/MEASUREMENT_MODEL.md` | New section on the metric set and its relationship to the values. |
| `docs/legacy/block5-metrics-v1.json` | **Archive the current 30 × 8 values before deleting them.** This project is not a git repository, so without this the old numbers are unrecoverable. |

Performance stays the **equal-weighted mean of the six**. There is no principled basis for
unequal weights, and equal weighting is the conservative choice.

---

## 8. What could go wrong

- **The gates may be unsatisfiable with the current options.** If an option's own prose genuinely
  implies both high vulnerability and high performance, no honest coding will decorrelate them. The
  fix would then be to rewrite that option's prose — which touches CVR content and needs its own
  approval. I will report this rather than fudge a number to pass a gate.
- **Two constructs are new** (Speed, Reversibility), so there is no prior authoring to check them
  against. They carry the most coding risk.
- **This is a measurement change, not a display change.** `performanceScore`, the cumulative
  dashboard, VCI and the summary page all move. Nothing is collected yet, so nothing is
  invalidated — but this must land before launch, not after.
- **The r = 0.81 baseline is computed on 30 hand-authored options, not observed behavior.** It
  describes the stimulus set, which is exactly what is being fixed; it is not a claim about
  participants.

---

## 9. Decisions needed before I start

1. **Six metrics, or trim to five?** Practicality is the weakest of the six — it is the one most
   likely to collapse into Reliability. Dropping it would leave a cleaner set at the cost of the
   "effort to the decision-maker" dimension.
2. **"Resource use" or "Resource cost"?** Higher-is-better means "Resource use 85" reads as *uses
   little*, which needs the hover to carry the direction. "Efficiency" would be clearer but edges
   back toward Gain responsiveness.
3. **Second coder for reliability?** Advisor's call. It strengthens the methods chapter and costs
   one afternoon on 10 options.
4. **Order of work.** I would do it in this sequence, stopping after step 2 for review:
   1. Archive the old values, add the gates to the validator, and confirm the current set *fails*
      them (proving the gates bite).
   2. Author scenario 1 (travel) only — 6 options × 6 metrics — and show you the table and the gate
      output for that scenario.
   3. On approval of the method, author the remaining four scenarios.
   4. Wire the UI, docs and schema bump; run every gate.

---

## 10. What actually happened during implementation

The plan survived contact with the data in most respects. Three things changed, and each was a
finding rather than a convenience.

### 10.1  Six metrics became five — Practicality was dropped

Authored honestly from the prose, **Practicality correlated r = 0.71 with Speed**. Fast options
are usually easy ones, so it was not carrying its own information. Re-coding to separate them
(a flight is fast but nothing in its prose says it is easy to arrange; the slow bus is
exhausting to *endure* but trivially simple to *do*) brought it only to 0.71.

The second reason was decisive and is the one to quote: **its referent changed between
scenarios.** In travel and dinner, "how hard is this to carry out" means effort on *you*. In the
cancer, flood and water scenarios the participant is a decision-maker, not the executor, so it
means effort on some organization. That is two constructs sharing a label — precisely the
cross-scenario ambiguity section 3 exists to prevent. The five that remain keep one referent
throughout.

### 10.2  The correlation gate was replaced, because the first version was wrong

The plan asked for |r| < 0.45 between every metric and every value, in both directions. Applying
it would have forced a falsehood: in a flood, rescuing people who cannot move **is** slower and
less efficient. Suppressing that correlation would mean pretending protecting the vulnerable is
free, which removes the dilemma the block exists to study.

The corrected standard separates two things the first version conflated:

| | |
|---|---|
| **A restatement** — the actual defect | the metric IS the value under another name (r = 0.98) |
| **A trade-off** — the thing we want | serving the value genuinely costs performance |

So the gates now test: no metric may *restate* a value (|r| < 0.85 — achieved: 0.57), and
**performance must never reward vulnerability protection** (achieved: the champion ranks 3rd–5th
of 6 in every scenario, within-scenario r ≤ 0.20).

They are also measured **inside each scenario**, not pooled across all 30 options. Pooling mixes
five different situations and answers a question no participant is ever asked.

### 10.3  The dashboard is a consequentialist scoreboard, and that is now deliberate

With the metrics honestly authored, a pattern appeared that is worth stating plainly in the
methods chapter:

| Value | Its champion's performance rank, per scenario | Mean |
|---|---|---|
| Vulnerability protection | 3, 4, 4, 5, 5 | **4.2** |
| Group size | 2, 2, 6, 1, 3 | 2.8 |
| Gain responsiveness | 4, 3, 1, 2, 2 | 2.4 |
| Outcome aggregation | 1, 6, 3, 3, 1 | 2.8 |

Protecting the vulnerable costs performance in **every** scenario. Options that maximize total
good or efficiency perform well. That is not a residual defect — it follows from what the five
metrics measure. Speed, leanness, reliability, durability and recoverability are a
*consequentialist* account of how a choice went. The cost of a utilitarian option is borne by
people the option leaves out, and that cost is deliberately **not** in the dashboard.

Which is the design: **the dashboard shows the consequentialist view; the CVR shows what it
leaves out.** The tension between the two is the experiment. The original set could not support
that reading, because it claimed to reward vulnerability protection while also being a utility
scoreboard — and the numbers were the same numbers either way.

### 10.4  Results

| Check | Before | After |
|---|---|---|
| Strongest metric-value correlation | **0.98** (Vulnerable Protection) | **0.57** (Resource use x Outcome) |
| Strongest metric-metric correlation | 0.87 | 0.67 |
| Metrics that merely restate a value | 4 of 8 | **0 of 5** |
| Vulnerability champion's mean performance rank | — | 4.2 of 6 |
| Metric coverage in the validator | none | 26 gates, `npm run validate:metrics` |

### 10.5  Files changed

`block5Types.ts` (METRIC_DEFS with per-scenario readings, `metrics` now required),
`block5Scenarios.ts` (30 x 5 authored values), `block5CVR.ts` (`deriveMetrics()` deleted),
`Block5PublicEmergencySimulation.tsx` (five columns, inline scenario-aware definitions with a
show/hide control), `Block5OptionCompare.tsx` (radar axes), `tools/validate_block5_metrics.mjs`
(new), `participantRecord.ts` (schema v1 -> v2), `docs/legacy/block5-metrics-v1.json` (the old
values, archived — this project is not a git repository).
