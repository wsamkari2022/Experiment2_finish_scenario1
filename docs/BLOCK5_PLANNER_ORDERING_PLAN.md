# Block 5 — Planner Ordering + New Scenario Content

> **SUPERSEDED IN PART — 4 September 2026.** This document describes the five-scenario deck.
> `flood_evacuation_priority` and `water_contamination_response` have since been removed; Block 5
> now runs chemical, wildfire and cancer. The reasoning below is kept as the design record of the
> decision made at the time — it is history, not a description of what ships. See the changelog at
> the top of `docs/VRDS_EXPERIMENT_GUIDE.md`.


**Status:** PLAN ONLY. No application code has been touched. Nothing below is implemented.
**Date:** 2026-08-30
**Brainstorm inputs (NOT a rulebook):** `Block5_Planner_Ordering_ClaudeCode_spec.md` and
`…_PART2.md`. Both were written in a chat with no access to this repository. They are treated
here as a source of ideas to accept or reject on the evidence, not as a specification.
**Companion:** `docs/BLOCK5_POSITION_EFFECT_PLAN.md` — this plan is the machinery that makes that
plan's headline measurable. Read them together.

Every number in Section 2 was measured by running a prototype planner against the **current**
option payoffs, not estimated. The probe scripts live in the session scratchpad and are
reproduced as `tools/simulate_planner.cjs` in Stage 1 of the build order.

---

## 0. The one-line summary

Three things change: **the Block 5 scenario content**, **the order the option cards are shown
in**, and **nothing else**. Blocks 1–4 are read, never touched.

The headline finding from the measurement pass: **the planner needs no assumed constants at all.**
Every parameter it requires — red lines, exchange rates, tolerance bands — is already sitting in
`MoralProfile`, computed by Blocks 1–4 and stored before Block 5 starts (§4b). The one parameter
that has no source in Blocks 1–4 is performance weighting, so **performance is removed from the
ordering entirely** and kept as card information only. Nothing in the planner is guessed.

Second finding: the current payoffs are not good enough to carry the design. **3 of 5 scenarios
order the cards the same way alignment already does**, which is the one outcome that makes the
whole measurement uninterpretable (§2a).

### What the shipped planner does

Measured over **3,000 randomly generated profiles** through the shipped `labelOptions` and
`plannerRank`, on all five scenarios:

- The **first card** is labeled Aligned **51%** · Weakly aligned **28%** · Misaligned **19%** ·
  Strongly misaligned **3%**.
- The **best-fitting option** sits at card #1 or #2 **84%** of the time, and in the top three
  **95.5%**. It reaches cards 4–6 in under 5% of cases, so it is never buried.
- The separation gate — `npm run validate:planner`, *planner #1 == alignment #1, need ≤ 50%* —
  currently reports **49%** on the structured 72-profile set.

A first card reading *Misaligned* is therefore the design working rather than a fault: it happens
to roughly one profile in five, and the best-fitting option is almost always the card directly
beside it.

### Decisions locked (2026-08-30)

| # | Decision |
|---|---|
| 1 | **Five scenarios, current order kept.** S1 = alone, S2 = self + dependents, S3–S5 = for others. Scenarios 1 and 2 are **rewritten to high-stakes**; travel and dinner are retired. S3–S5 keep their cover stories and are retuned. |
| 2 | **A post-Block-5 re-measure stage is added**, after Block 5. It re-runs the Blocks 1–3 instruments unchanged; it does not alter them. |
| 3 | **Every planner parameter is derived from Blocks 1–4 data. Zero assumed constants.** Anything not derivable is removed from the planner rather than defaulted. |
| 4 | **Blocks 1–4 are frozen** — instruments, scoring, and the profile they produce. Read-only. |
| 5 | **Scenario order stays fixed.** No counterbalancing. The position/sequence confound is carried as a stated limit (§9). |

---

## 1. File inventory

| Role | Files | Touch? |
|---|---|---|
| **Blocks 1–4 instruments** | `MoneyThresholdBlock.tsx`, `TrolleyThresholdBlock.tsx`, `AIWorkforceThresholdBlock.tsx`, `AdaptiveStakeholderReflectionBlock.tsx` | **FROZEN** |
| **Blocks 1–4 scoring** | `thresholdTree.ts`, `profileAnalysis.ts`, `aiWorkforceAnalysis.ts`, `sensitivityCalibration.ts`, `blocksLegacyMethodology.ts` | **FROZEN** (read-only) |
| **B1–4 → B5 boundary** | `block5Profile.ts` (`extractBlock5Profile`) | read-only; planner reads its output |
| **Scenario data (source of truth)** | `block5Scenarios.ts` (1004 lines, 5 scenarios × 6 options) | **rewritten** |
| **Alignment logic** | `block5CVR.ts` → `policyAlignmentScore`, `rankLabel`, `labelOptions` | **FROZEN** |
| **Block 5 UI** | `Block5PublicEmergencySimulation.tsx` (2436 lines) — line 408 is where `labelOptions` output becomes display order; line 994 renders the cards | order + new text only |
| **Card comparison overlay** | `Block5OptionCompare.tsx` | reads fingerprints/metrics |
| **CVR text** | `block5CVRContent.ts` — keyed by scenario id at lines 296–300 | new scenarios need new parallel worlds |
| **Types** | `block5Types.ts` — `Block5ScenarioId` union + `METRIC_DEFS.readings` (30 scenario-id references) | new fields + new ids |
| **Theme** | `block5Palette.ts` — 5 scenario-id keys | new ids |
| **Validators** | `tools/validate_block5.cjs`, `validate_block5_metrics.mjs`, `simulate_vci.cjs`, `simulate_stability.cjs`, `validate_cvr_lenses.cjs`, `validate_cvr_people.mjs` | extended |
| **Block 5 images** | none — `scenarioImages.ts` serves Blocks 1–3 only | no cost |

**Coupling verdict.** Changing scenario ids or option ids costs exactly
four source files (`block5Types.ts`, `block5Palette.ts`, `block5CVRContent.ts`,
`validate_block5_metrics.mjs`) plus the validators. There is no σ matrix, no design-label
recovery table, and **no image asset** keyed to Block 5 option ids. The brainstorm's fear about
invalidating downstream artefacts does not apply here. The real cost is authoring, not breakage:
every option carries a `cvrSeed` with six hand-written strings (`rule`, `parallelRule`,
`identifiedCase`, `harm`, `benefitCase`, `benefitLost`) plus `gains` / `givesUp` /
`moralTension` / `consequence`. That is ~10 sentences per option.

---

## 2. What the current payoffs actually score

Measured with a prototype `plannerRank` over all 24 permutations of the four policy values, with
scores `[80, 65, 50, 35]` assigned in each permutation order, `tolerance = 0.15`,
`exchange = 2.0`, equal performance weights.

### 2a. Acceptance criteria against the current payoffs

| Scenario | Distinct orders /24 (need ≥4) | planner#1 = alignment#1 (need <60%) | small-gain/big-loss pair (need ≥12/24) | Dominated options | Always-#1 option |
|---|---:|---:|---:|---|---|
| travel_mode_choice | 5 ✅ | **67% ❌** | 24/24 ✅ | none ✅ | none ✅ |
| meal_hosting_choice | 4 ✅ | **79% ❌** | 24/24 ✅ | none ✅ | none ✅ |
| cancer_treatment_allocation | 4 ✅ | 54% ✅ | 24/24 ✅ | none ✅ | none ✅ |
| flood_evacuation_priority | 5 ✅ | **67% ❌** | 24/24 ✅ | none ✅ | none ✅ |
| water_contamination_response | 5 ✅ | 58% ⚠️ | 22/24 ✅ | none ✅ | none ✅ |

**Reading:** the option sets are healthy on structure (no domination, no dictator option, the
trade-off pair the tree needs exists everywhere) and **weak on discrimination**. Three scenarios
fail the confound gate and one passes by 2 points. If built as-is, "chose rank 1" and "chose the
aligned option" would be the same event two-thirds of the time and neither could be interpreted.
This is the brainstorm’s own "ordering can suppress the effect" risk, arriving in real numbers.

### 2b. The red-line gate as brainstormed is unusable

| Red-line mapping tried | Options landing in Bin C (Blocked) |
|---|---:|
| `redLine[f] = participant's score on f`, all four values | **100%** (144/144 slots, every scenario) |
| Same, top-two values only | **100%** |
| `redLine[f] = participant's score − 15` | **93–98%** |

**Why.** In this codebase a fingerprint is *"how well this option serves that value"*, authored
so each value has exactly one champion per scenario. On any given value, five of six options sit
below the champion, and a participant's score of 65–80 sits above most of them. Treating the
score as a red line therefore blocks nearly everything. Bin B and Bin A never appear, the
"crosses a limit you set" treatment loses all meaning, and the three-bin display collapses.

**This is the single biggest technical finding in the pass.** Red lines must come from somewhere
else — see §4b.

### 2c. Stakes matching — the brainstorm’s stakes complaint is half wrong

Spread (max − min) per scenario, as a percentage difference from the five-scenario mean:

| Scenario | vulnerable | harm | gain | help | speed | resource | reliability | durability | reversibility |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| travel | +1% | −3% | +11% | +15% | **+16%** | +10% | **−19%** | +15% | +2% |
| meal | +4% | +1% | +2% | +11% | +2% | −5% | **+19%** | +12% | −1% |
| cancer | −4% | +1% | 0% | −4% | **−21%** | −1% | −7% | −9% | −14% |
| flood | +1% | +1% | −9% | −11% | −4% | +10% | −11% | **−30%** | +5% |
| water | −2% | +1% | −5% | −11% | +7% | −14% | **+19%** | +12% | +9% |

**The four moral values are already matched to within ±15% on 19 of 20 cells.** The brainstorm claims
"in a table-setting scenario `harm` and `vulnerable` have almost no range". Numerically that is
false here — the dinner scenario has the *widest* vulnerable spread of all five (67 points).

**But the spec's worry survives in a different form, and it is worse.** `block5Types.ts` states
the authoring convention explicitly: *scores are relative to the situation, not absolute* — a 97
means "the best this dinner allows". So the numbers are matched **by construction**, and matching
them proves nothing about whether the psychological stakes are matched. The measurement
instrument cannot detect the confound it is being asked to rule out.

Conclusion: the stakes confound is **real and is not visible in the numbers**. It has to be fixed
in the cover stories, which is what §5 does. Only five performance cells miss ±15%; those are a
tuning job, not a redesign.

### 2d. The six option slots are not filled

| Scenario | Distinct slots filled | Tempting breach valid? |
|---|---:|---|
| travel | 4 of 5 | ✅ flight is both gain champion and worst on vulnerable |
| meal | 4 of 5 | ✅ delivery feast |
| cancer | 4 of 5 | ✅ max_life_years |
| flood | 4 of 5 | ❌ gain champion (`efficient_rescue`) breaches nothing |
| water | 4 of 5 | ❌ gain champion (`efficient_exposure`) breaches nothing |

In **every** scenario the performance star (slot 6) collides with a value champion, so slot 6 has
no option of its own, and two options per scenario carry no slot at all. This is why only 4–5
distinct orders appear in 2a: the option set does not span the space the planner sorts over.

---

## 3. What survives from the brainstorm, and what is dropped

The two MD files were written without access to this repository. Judged against the code:

### Kept — these are the good ideas, and they are the plan

- The **pairwise trade-off tree** and its three branches (red line → is the top gap small? →
  exchange rate). This is the core, and it works.
- **Win counting instead of sorting.** The tree is non-transitive; a direct sort would be a bug.
- **Three bins** (Clear / Costed / Blocked), with blocked options **still fully selectable**.
- **Six option slots**, one role each, all distinct.
- The **"small gain, big loss" pair** as a construction requirement, not an accident.
- **Alignment and planner rank as two separate, separately-logged things.**
- The **inverse planner** for measuring drift.
- The **position manipulation** as the thing scenarios vary on.

### Dropped or corrected

| # | Brainstorm said | Why it is dropped |
|---|---|---|
| 1 | Invert `harm` and `vulnerable` before normalizing ("lower is better") | **All four fingerprints here are already higher = better.** Inverting two of four would make `policyAlignmentScore` reward the options it should penalize, and would corrupt alignment, the CVR coordinate and VCI. Highest-severity trap in the two files. |
| 2 | Three scenarios | Six, per Decision 1. Three cannot separate position from time-on-task. |
| 3 | Default `tolerance` to 0.15 | **Derivable** from ladder resolution (§4b). Not defaulted. |
| 4 | Default `exchange` to 2.0 | **Derivable** from Block 3's 2×3 money-threshold matrix (§4b). Not defaulted. |
| 5 | Default `perfWeights` to 0.2 each | **Not derivable from Blocks 1–4.** Rather than assume it, performance is removed from the ordering entirely (§6). |
| 6 | Reliability / reversibility floor gates at 0.5 | Same reason. No source in Blocks 1–4 → removed, not defaulted. |
| 7 | `fp.gain` needs rescaling in the "for others" scenarios | Already solved. The relative-to-situation convention in `block5Types.ts` **is** the fix. No code change. |
| 8 | "Verify a post-Block-5 re-elicitation exists" | It does not exist. Decision 2 adds one (§4c). |

---

## 4. The decisions that gate everything else

### 4a. The scenario deck: five, order unchanged, all high-stakes *(Decision 1)*

**Locked: the five-scenario deck and its current running order stay exactly as they are.** Only the
content of scenarios 1 and 2 changes.

| # | Position | Scenario | Action |
|---|---|---|---|
| 1 | **A — alone** | Chemical release, 6-hour district evacuation. The participant is alone. Every route or action consumes something other people need: the last shuttle seat, a respirator a clinic had reserved, a fence line whose cutting floods a smallholding, a road they block behind them. | **replaces `travel_mode_choice`** |
| 2 | **B — self + dependents** | Flash flood, 8-hour window. The participant must move themselves, two children and one elderly relative. Same structural trade-offs, but the "own group" side of every option now carries three dependents, one of them vulnerable. | **replaces `meal_hosting_choice`** |
| 3 | **C — for others** | Limited cancer treatment allocation | **kept**, retuned |
| 4 | **C — for others** | Flood evacuation priority | **kept**, retuned |
| 5 | **C — for others** | Water contamination response | **kept**, retuned |

This is exactly the ladder `BLOCK5_POSITION_EFFECT_PLAN.md` §1 already documents. Nothing about the
position mapping, the ordering, or the three-point shape of that plan's headline changes — the two
everyday scenarios simply stop being everyday.

**Why travel and dinner go.** They are the two that carry the stakes confound, the two that fail
the ordering gate worst (67% and 79%, §2a), and the two whose CVR register is `"everyday"`. With
all five at `life_and_death`, the CONTEXT lens's equal-seriousness requirement is satisfied by
construction rather than by validator check.

**What this costs.** Two scenarios authored from scratch (12 options, ~10 sentences each), three
retuned numerically with their prose intact. Participant time is unchanged — still five scenarios.

**Position n stays unequal (1 / 1 / 3).** That is already listed as limit 1 in
`BLOCK5_POSITION_EFFECT_PLAN.md` §7 and it stays. The compensation is also already there: the three
position-C scenarios sit at three different points in the sequence, so a trend across S3→S4→S5
measures drift within a constant position — that plan's `driftCheck`.

### 4b. Every planner parameter, derived from Blocks 1–4. No assumptions. *(Decision 3)*

**The requirement:** use Blocks 1–4 to compute the profile the planner needs, assuming nothing.
Anything that cannot be derived is removed from the planner rather than defaulted.

**This turns out to be fully achievable**, because Blocks 1–3 are ladders and a ladder measures
exactly the three things the tree needs: where you refuse outright (a red line), how much more you
demand when the target changes (an exchange rate), and how finely you discriminate (a tolerance).

`profileAnalysis.MoralProfile` — already built before Block 5 and already carried to its boundary —
holds all of it:

```
moneyIndices        { sidewalk, wealthy, shelter }   // rung 0-7, 8 = never kept
trolleyIndices      { lever, bridge }                // rung 0-7, 8 = never acted
aiWorkforceIndices  { 6 cells }                      // rung 0-5, 6 = never approved
refusedBridge, refusedLever, refusedAnyRollout, refusedAllLowBufferRollouts
mostRestrictiveLowBufferSize
```

Ladders: Block 1 `AMOUNT_VALUES` = 8 rungs ($0.25 → $10,000) × 3 contexts. Block 2
`SAVED_LIVES_OPTIONS` = 8 rungs (1 → 10,000 lives) × 2 phases. Block 3 `GAIN_OPTIONS` = 6 rungs
($1 → $100M) × 6 cells (low/high buffer × small/medium/large group).

#### RED LINES — a sentinel index is literally a refusal

A rung index equal to the ladder length is the stored sentinel for *"I said no at every rung,
including the largest."* That is not a modeled threshold; it is the participant refusing on
screen. It is the cleanest red line the study could possibly have.

| Red line | Derivation | Fires when |
|---|---|---|
| `redLine.vulnerable` | Block 3 low-buffer cells: `refusedAllLowBufferRollouts`, else `min(aiWorkforceIndices.lowbuffer_*)` | they refused even $100M to harm a low-buffer group |
| `redLine.harm` | Block 3 `*_large` cells + Block 2 `refusedLever` / `trolleyIndices.lever` | they refused at every group size / every number of lives |
| `redLine.help` | Block 2 `trolleyIndices.lever` — the rung at which acting became acceptable | below the number of lives that moved them |
| `redLine.gain` | Block 1 `moneyIndices.shelter` (rung 8 = never kept it) | no amount made keeping it acceptable |

A participant with no sentinel anywhere simply has softer red lines, set at their accepted rung
rather than at a refusal. **Nothing is invented for them.**

#### EXCHANGE RATES — real ratios, in real dollars, already on screen

Block 3 asks the same question six times, changing only *who* and *how many*. The difference
between the answers **is** an exchange rate. It was elicited; it just was never read this way.

```
exchange.vulnerable = rungIndex(lowbuffer, size)  − rungIndex(highbuffer, size)
exchange.harm       = rungIndex(buffer, large)    − rungIndex(buffer, small)
exchange.help       = trolleyIndices.bridge       − trolleyIndices.lever   // already = directnessGap
exchange.gain       = max(aiCells) − min(aiCells)      // spread across the six conditions
```

Rungs step by roughly ×10, so a **difference of rungs is a ratio on a log scale** — which is what
an exchange rate is. A participant who needed $10,000 to harm a buffered group and $10 million to
harm an unbuffered one has stated an exchange rate of two rungs: *"a hundred times more money
before I will do it to people who cannot absorb it."* That sentence can be shown back to them on
the card in their own numbers.

#### TOLERANCE — the ladder's own resolution

Tolerance asks: *how small a gap is too small for you to have noticed?* A ladder answers this
directly. The participant's threshold sits in an interval bounded below by the last rung they
refused and above by the first rung they accepted. **Any difference narrower than that interval is
a difference they did not discriminate on screen.**

```
tolerance[f] = (first accepted rung − last refused rung) / (ladder length)
```

Block 3 stores `startedAtGainIndex` (the carry-forward start), so this interval is genuinely
per-participant and not always a single step. For a participant who moved one rung on an 8-rung
ladder it lands near 0.125 — close to the 0.15 the brainstorm guessed, which is reassuring, but it
is now **measured per person** and varies between them.

**Block 1's money ladder is deliberately NOT used by the planner at all.** Its context spread is the
sole source of `contextSensitivity`, which drives the CVR framing lens — one of the three
presentation sensitivities that are the study's own contribution. Entangling the ordering machinery
with the reflection machinery would make any later correlation between them an artefact of this
code. Block 1 feeds the profile; it does not feed the planner.

#### PERFORMANCE — removed from the ordering

`perfWeights` has **no source anywhere in Blocks 1–4.** Nothing in the money, trolley, workforce or
stakeholder blocks asks whether speed matters more than reversibility. So it is not defaulted; it
is removed:

- Performance plays **no part** in the win count and **no part** in tie-breaking.
- Ties break on the raw lexicographic order (fully derived) → stable original index (deterministic).
- The five metrics stay on the card as **information chips** with their within-scenario rank.

**This is a better design, not a compromise.** The study wants to know whether a participant trades
moral alignment against practical performance. If performance were baked into the ordering, the
planner would already have made that trade on their behalf and the question would be unanswerable.
Keeping performance as pure card information leaves the trade where it belongs — with the
participant.

#### The result

`block5Planner.ts` contains **no `PLANNER_CONSTANTS` block, because there are no constants.**
Verification item 11 in §13 becomes stronger: grep must find **no free numeric literal at all** in
the planner beyond structural ones (0, 1, and the 0.01 lexicographic epsilon, which is a
floating-point guard rather than a parameter).

A new read-only module `block5Thresholds.ts` performs the derivation:
`deriveDecisionProfile(moralProfile, aiResults, tree) → { order, redLine, exchange, tolerance }`.
It **reads** the Blocks 1–4 output that `ExperimentFlow.tsx` already loads (line 386) and writes
nothing back. Blocks 1–4 stay byte-identical.

**Calibration gate.** With real red lines, Bin C should fire on roughly **1 option in 6** across
the sweep. If a derivation produces 0% or 90%, the derivation is wrong and gets revised — but it
gets revised against the *data*, never tuned to a target by hand. This is acceptance criterion 5
in §7.

### 4c. The missing post-Block-5 re-elicitation *(Decision 2)*

**Confirmed missing.** `ExperimentFlow.tsx` stages run
`money → trolley → product → insights → block4 → final_analysis → block5_intro → block5 →
block5_summary → feedback`. No instrument is ever repeated.

**What `Stability` currently measures.** `computeStability` (block5CVR.ts:579) compares the
pre-Block-5 profile against snapshots produced by `applyEndorsementUpdates` /
`applyApaUpdates` / `applyKeepUpdates` — that is, against a profile **our own update rules**
moved, using constants we chose (+30 / +15 / −20 / −10 / ±25). It is a faithful measure of how
far our rules pushed the profile. It is **not** a measure of whether the participant changed.
The study claims to measure stability. As built, it measures its own arithmetic.

**LOCKED: add a `block5_remeasure` stage between `block5` and `block5_summary`.** Re-run
Blocks 1, 2 and 3 with identical item wording and identical scoring, rebuild through the same
`buildThresholdTree` + `extractBlock5Profile`, and store it as `Block5Results.profilePost`.

- Block 4 is adaptive and generative, so it **cannot** be repeated item-for-item. Hold its
  contribution fixed at its pre value and say so in the methods. It touches only `vulnerable` and
  `gain`, both of which also have Block 3 as a source, so the re-measure still moves them.
- Then: `stability = 1 − kendall(pre.order, post.order) / 6`, and
  `thresholdShift[f] = post.redLine[f] − pre.redLine[f]`.
- The existing rule-driven `computeStability` stays, renamed in the write-up to
  **Rule-Implied Drift**, which is what it honestly is. Two numbers, two names, no collision.

**If this is declined,** the stability claim must be dropped from the study's stated aims. That is
the honest alternative, and it is a legitimate choice — but it cannot stay as written.

---

## 4d. Fidelity to the LEAP paper — checked against the source, not the brainstorm

`Nudging Automated Planners with Learned User Preferences` (LEAP), §3.1 "Trade-off Trees".

| LEAP | This implementation | Match |
|---|---|---|
| Trade-off tree learned for **the most important two attributes only** — "we focused on demonstrating the learning and representation of tradeoff trees for the most important two attributes only" | The tree uses `order[0]` and `order[1]`; values 3 and 4 only enter through the lexicographic comparison | ✅ |
| Branch conditions on `A(+)`, `B(+)`, `diff_A`, `diff_B` | `bestTop`, `diffTop`, `diffSecond` (`B(+)` not used — see below) | ✅ partial |
| Green = original LPM, purple = **truncated LPM ignoring the top attribute** | `order` vs `order.slice(1)` | ✅ |
| "Sorting … could be tricky due to loss of transitivity … we implemented a scoring function that **counted the pairwise wins**" | `plannerRank` counts wins; never sorts the comparison directly | ✅ |
| Learning trigger: the planner "picked a seemingly inferior plan with respect to the most important attribute … but superior with respect to the second" | Recorded per option as `ignoredTopValueAgainst` | ✅ |
| Tree **learned** from SME reorderings via C4.5, refined over sessions | **Not implemented** — see below | ⛔ by design |
| Boundary values: "we decided … to **ask the user directly to set the boundary conditions**" | **Derived from the Blocks 1–3 ladders instead** — see below | ⚠️ deliberate divergence |
| Nudging the underlying planner (GMS) to generate better plans | **Not applicable** — Block 5's options are authored, not generated. This study uses LEAP's *ranking* half only. | n/a |

### The one divergence, and why it is the contribution rather than a shortfall

LEAP **asks**: *"From our experience with SMEs, the user would already have a trade-off value set in
their mind"*, so it presents an interactive tree and lets the operator type the boundary in.

This study cannot ask. Blocks 1–4 are frozen, no new elicitation is permitted, and — more
importantly — a moral threshold is not a number people can reliably introspect and type. So the
thresholds are **inferred from behavior**: the rung at which they refused, the extra rungs they
demanded when the victim changed, the interval they could not discriminate.

**That substitution is the novel step.** LEAP learns a trade-off tree from a domain expert who
knows their own numbers; this applies the same tree to a moral domain where the numbers have to be
recovered from choices. It should be stated in the write-up in exactly those terms, because it is
the part a reviewer will ask about.

### What is deliberately NOT taken from LEAP

**The C4.5 learning loop.** LEAP rebuilds the tree every time the operator overrides a ranking.
Doing that here would be actively harmful: with five scenarios there is nowhere near enough data,
and — fatally — a planner that adapts to the participant's choices would contaminate the drift
measurement. Stability asks whether the PERSON moved. If the planner moves too, the two can never
be separated. **The tree structure stays fixed for every participant; only its parameters differ.**

**`B(+)` as a branch condition.** LEAP lists it as available; this tree does not use it. Adding it
would mean a fourth branch with no derivable threshold behind it. It is listed here so the omission
is a recorded decision rather than an oversight.

### A measurement LEAP gives away for free

LEAP's trigger for learning — *the user picked a plan inferior on the top attribute but superior on
the second* — is precisely the event this study exists to observe. In LEAP it is training data. Here
it is the **dependent variable**: a participant choosing an option the tree ranked below one that
beats it on their own rank-1 value is a measurable, timestamped moment of a person trading away
their stated top priority. It is already recorded as `ignoredTopValueAgainst` and costs nothing.

---

## 5. New scenario content — the authoring contract

Every scenario: **6 options, one per slot, no duplicates.**

| Slot | Role | `fp` shape | `perf` shape |
|---|---|---|---|
| 1 | **Clean reference** — inside every red line for most profiles | moderate on all four | moderate on all five |
| 2 | **Tempting breach** — highest `gain` in the set, **and** lowest on `harm` or `vulnerable` | gain max, one of harm/vulnerable min | good speed |
| 3 | **Vulnerable protector** | vulnerable max, gain low | speed low |
| 4 | **Helper** | help max, harm moderate | speed low, resource low |
| 5 | **Harm minimiser** | harm max, gain low, help low | reversibility max |
| 6 | **Performance star** — must be **its own option**, not a value champion | mediocre on all four | speed + resource + reliability max, reversibility low |

Slot 2's second condition is the fix for the two scenarios that fail it today (§2d). Slot 6's
"its own option" clause is the fix for all five.

**Position-specific fields.**
- Add `stakePosition: "self" | "self_and_group" | "others"` — already proposed in
  `BLOCK5_POSITION_EFFECT_PLAN.md` §6, adopted here unchanged.
- Add `fp.ownGroupExposed` on position-B scenarios only so the participant's own
  dependents are counted separately from strangers in the card text. It is **display + logging
  only** and never enters alignment — `POLICY_DIM_KEYS` stays at four, so `block5CVR.ts` is
  untouched.

**Held constant across all five scenarios:** option count (6), a stated deadline, non-zero spread
on all four values, a tempting breach, a qualifying small-gain/big-loss pair, and every payoff
range within ±15% of the five-scenario mean.

**Varied deliberately:** hazard, setting, surface numbers, cover story, and position. Matched, not identical.

**On `fp.gain` in position-C scenarios: no change needed.** The relative-to-
situation convention documented in `block5Types.ts` already puts gain on a common "benefit
achieved here" scale, which is the spec's own preferred option (a). Add an authoring comment
saying so; change no code.

**One residual confound to state, not solve.** At positions A and B the participant is *inside*
the emergency; at position C they *allocate* for it. Escapee and allocator are structurally
different roles, and that difference rides along with position. It is not fully removable — you
cannot be unaffected and also escaping. **Mitigation:** every option in every scenario, including
A1 and A2, is shaped as an *allocation of a scarce shared resource* (the last seat, the reserved
respirator, the road capacity). That makes the decision shape identical across positions even
when the role is not. Write the residual into the limits section.

---

## 6. The planner

New file `block5Planner.ts`. Pure, DOM-free, deterministic. `plannerRank(scenario, profile) →
{ orderedIds, perOption: { bin, wins, rank, decidedOn, gainLine, loseLine, breachLine, perfChips } }`.

**Algorithm** — the brainstorm's tree, with three corrections:

1. **No inversion.** All four fingerprints min–max normalize directly. Higher is better on all four
   in this codebase (§3 correction 1).
2. **Red lines, exchange rates and tolerance come from §4b** — derived from the Blocks 1–4 ladders,
   never from the 0–100 sensitivity score and never defaulted.
3. **Performance never enters the ordering** (§4b). Only the four moral values are normalized for
   ranking purposes; the five metrics are normalized for display chips only.

Everything else stands: three bins → pairwise trade-off tree (`bestA < redLineNorm(A)` →
`FAVOR_A`; `diffA < tolerance(A)` → node 3; `diffB > exchange(A) × diffA` → `IGNORE_A`) →
win counting (never a direct sort, because the tree is non-transitive) → tie-breaks
(**raw lexicographic → stable original index**; no performance composite) → display order A, then
B, then C, as one continuous numbered list with dividers.

**Bin C options stay fully clickable.** Non-negotiable: the study
exists to measure whether people cross their own lines, which is unmeasurable if they cannot.

**Two separate code paths, permanently.** `labelOptions` keeps producing the alignment tier and
the tier keeps rendering on every card in its current wording and position. `plannerRank`
produces the order. A participant must be able to see "Strongly aligned" on the card sitting at
rank 4 — **that gap is the signal**, and both halves must survive into the log.

**Unit tests** — The worked example (must yield Q, P, R, S, with P first on the
participant's own rank-1 value and still not ranked first), the flipped-profile case (must yield a
different order), and a constructed non-transitive triple.

---

## 7. Simulation harness + acceptance gates

`tools/simulate_planner.cjs`, built **before** any UI work, and shared with the runtime as the
engine for the inverse planner (§8).

**Two different sweeps, for two different jobs — do not confuse them.**

- **Authoring sweep (offline, this tool).** 24 permutations × tolerance {0.10, 0.15, 0.25} ×
  exchange {1.5, 2.0, 3.0} = 216 synthetic profiles per scenario. These grids are **not planner
  defaults** — no participant is ever scored with them. They exist only to answer *"does this
  option set discriminate across the range of people who might arrive?"*, which is a question about
  the scenario content, not about any individual.
- **Runtime (live).** One profile: the participant's own, fully derived per §4b. No grid, no
  sweep, nothing assumed.

| # | Gate | Threshold | Measured, real planner, current payoffs |
|---|---|---|---|
| 1 | Distinct orders per scenario | >= 6 of 72 | **16-22, all pass** |
| 2 | planner#1 = alignment#1 | <= 50% | 32-40% on the three kept scenarios (**pass**); 67-68% on travel and meal (**fail**, both being retired) |
| 3 | No dominated option on all 9 fields | 0 | **passes, all five** |
| 4 | No option at rank 1 for every profile | 0 | **passes, all five** |
| 5 | Blocked bin fires on ~1 option in 6 | 10-25% of slots | 17% on travel/meal/cancer (**pass**); 39% on flood and water (**fail**) |
| 6 | Small-gain/big-loss pair present | >= half of profiles | **66-72 of 72, all pass** |
| 7 | Six slots filled, all distinct | 5 champions + 1 spare | **4 + 2 in all five (fails)** - the performance star is never its own option |
| 8 | Tempting breach is genuinely tempting | gain champion also worst on harm or vulnerable | passes on travel/meal/cancer; **fails on flood and water** |
| 9 | Every option reaches rank 1 for some profile | all 30 | **27 of 30** - 3 unreachable (see below) |
| 10 | Deterministic across 100 runs | identical | **passes** |

Run with `npm run validate:planner`. Gate 8 was added during Stage 1: the sweep showed that
checking only "does some option have the highest gain" is not enough — in flood and water that
option harms nobody in particular, so it tempts nobody and the tempting-breach slot is empty in
substance while looking filled on paper.

### Stage 1 outcome — what the numbers say

**The planner is working.** Distinct orders rose from 4-5 (prototype, assumed constants) to 16-22
once the parameters came from the derivation, and the confound gate now PASSES on all three
scenarios being kept. That is the single most important result in the stage: ordering and
alignment are no longer the same event for cancer, flood and water.

**Everything still failing is option-payoff authoring, not algorithm.** Specifically:

1. **The performance star is never its own option** (all five scenarios). In every scenario the
   best option on speed + resource use + reliability is also a value champion, so slot 6 is
   occupied by a card already doing another job and two cards carry no role at all. This is the
   root cause of gates 1 and 2 being tighter than they need to be.
2. **Flood and water block 39% of cards.** Both have a vulnerable-champion option that sits at the
   very bottom of the harm range, so a participant with a red line on harm loses it. The payoffs
   need to stop putting the two "who gets hurt" values in perfect opposition.
3. **Flood and water have no real tempting breach.** `flood_efficient_rescue` and
   `water_efficient_exposure` have the highest gain but are not worst on harm or on vulnerable, so
   no participant is ever tempted past a line by them.
4. **Three options can never rank first for anyone**: `travel_shared_car_ride`,
   `meal_pantry_rescue`, `cancer_essential_workers`. An option no profile ever ranks first is dead
   weight on the stack. Two of the three are in scenarios being replaced; `cancer_essential_workers`
   needs a payoff edit.

Gates 5, 7, 8 and 9 are the Stage 3 authoring target.

---

## 8. The inverse planner — how drift gets measured

`consistentSet(scenario, chosenOptionId, depth)` runs the planner **backwards**: over the same
216 profiles, collect every profile under which the chosen option ranks within `depth`. Red lines are held at the
participant's derived values; only the value ranking and the two trade-off parameters are searched. 216 profiles × 5 scenarios is trivial in-browser.

- `choice.inconsistencyDepth` — smallest depth (1…6) giving a non-empty set.
- `drift.rank` — min over that set of `kendall(p.order, declared.order) / 6`. Range 0–1.
- `drift.threshold` — Σ over values of `max(0, crossing(chosen, f)) / range(f)`.
- `drift.topFlip` — 1 if the rank-1 value implied by the choice differs from the declared one.

All computed against the **same** pre-Block-5 profile in all five scenarios, so
`drift_alone` / `drift_withGroup` / `drift_forOthers` are directly comparable. This is the exact
quantity `BLOCK5_POSITION_EFFECT_PLAN.md` §4 wants, computed from the planner rather than from a
distance formula, and it subsumes that plan's `departureIndex` without contradicting it.

---

## 9. Scenario order — DECIDED: fixed, no counterbalancing

**Locked: the running order stays as it is.** S1 alone → S2 dependents → S3–S5 for others.

**What this costs, stated plainly so it can go in the write-up.** Position is confounded with
sequence position: "for others" is always last and always follows two scenarios of accumulated
drift. A participant who drifts simply because they are tired, practiced, or warmed up will look
position-sensitive.

**The partial control already exists and must be reported alongside every position claim.** The
three position-C scenarios occupy sequence slots 3, 4 and 5, so a trend across them measures drift
*within a constant position*. That is `driftCheck` in `BLOCK5_POSITION_EFFECT_PLAN.md` §6, and a
large value is a warning that the effect is time rather than position. Any position comparison that
does not report `driftCheck` next to it is overclaiming.

Log `scenario.positionInSequence` (1–5) regardless — it costs nothing and lets sequence enter any
later analysis as a covariate.

---

## 10. The explanation is itself an intervention — OPEN

**Not decided; does not block Stages 1–6. Recommendation: hold it constant.** Identical panel, identical per-card reason line, every
scenario, every participant, whether or not any option crosses a limit.

Reason: CVR and APA are already the study's manipulated reflection machinery. Making the
explanation a second manipulated factor turns the design into 2 × 3 positions and the cells cannot
be afforded. Constant means the explanation is part of the environment rather than a variable, and
the position comparison stays clean.

**Non-negotiable corollary:** the explanation must **not** appear only when an option breaches a
limit. That would make it fire differentially exactly where the measurement is most sensitive.

---

## 11. Card display

Everything currently on the card stays, **including the alignment tier in its current wording and
position**. Added:

1. **Rank badge** — "1", "2", … in planner order.
2. **Bin treatment** — A normal; B a neutral "has a cost" marker; C visually recessed with
   "crosses a limit you set". Neutral wording only, no red, no warning glyphs. It reports; it does
   not scold.
3. **Reason line**, generated from planner state, never hand-written:
   > **Ranked 2.** Beat 4 of the other 5. Decided on **{value that broke the comparison}**.
   > Compared with the highest-ranked option inside your limits: you gain {δ}, you give up {δ}.
4. **`IGNORE_A` sentence** when that leaf fired:
   > This ranks above {other} even though {other} is slightly better on {rank-1 value}, because
   > the difference there is small ({x}) and the difference on {rank-2 value} is large ({y}).
5. **Performance chips** — two strongest, one weakest, with within-scenario rank.
6. **Breach line** on B and C only, with the price tag attached.
7. **Per-scenario panel** above the cards: the declared ranking, the red lines being applied, and
   one line saying options crossing a limit sit lower but can still be chosen.

---

## 12. Logging

Per scenario, per participant, all additive:

`planner.order`, `planner.bins`, `planner.wins`, `planner.top`, `planner.decidedOn`,
`aligned.option`, `aligned.tier`, `choice.id`, **`choice.rank`** (the key dependent variable),
`choice.bin`, `choice.matchedPlannerTop`, `choice.matchedAlignedLabel`,
`choice.crossedOwnRedLine` (+ which value, + by how much), `choice.inconsistencyDepth`,
`consistentSetSize@depth1`, `drift.rank`, `drift.threshold`, `drift.topFlip`,
`scenario.positionInSequence`, `participant.orderCondition`, `profile.snapshot`, `profile.post`,
`stability.kendall`, `stability.thresholdShift`, `time.firstInteraction`, `time.decision`,
`ui.breachLineExpanded`, `ui.switches`.

The existing `Block5ScenarioTelemetry` block already covers switches, dwell and info-seeking —
extend it rather than adding a parallel structure.

---

## 13. Verification checklist (run and report PASS/FAIL each)

1. Blocks 1–4 instrument and scoring files show zero diffs.
2. `policyAlignmentScore` / `rankLabel` / `labelOptions` show zero diffs; tiers render identically
   for a fixed test profile.
3. **No fingerprint is inverted anywhere in the planner** (grep for any `100 -` or `1 -` applied to
   a fingerprint). This guards §3 correction 1.
4. `plannerRank` is pure, DOM-free, deterministic: identical output across 100 runs.
5. The worked-example unit test → Q, P, R, S.
6. Flipped-profile unit test → a different order.
7. Constructed non-transitive triple resolves via win counting, no crash, no loop.
8. Bin C options clickable and selectable.
9. All §12 log fields present and populated in a full five-scenario run.
10. Every §7 gate reported with actual numbers per scenario.
11. **No assumed constants.** grep finds no free numeric literal in `block5Planner.ts` beyond
    structural ones (0, 1, and the 0.01 lexicographic epsilon). Every red line, exchange rate and
    tolerance traces to a field in `MoralProfile` / `AIWorkforceBlockResults`.
12. Six slots filled in all five scenarios, no duplicates, no dominated options.
13. `consistentSet` non-empty at depth ≤ 6 for every option in every scenario.
14. *(Only if §9 is adopted)* Counterbalancing reproducible from session id and logged.
15. `profilePost` exists and its instrument matches Blocks 1–3 item for item.

---

## 14. Build order

| Stage | Work | Gate |
|---|---|---|
| 1 | ✅ **DONE** — `block5Planner.ts`, `tools/simulate_planner.cjs`, `tools/test_planner.cjs` | §7 measured; all 17 behavioral assertions pass |
| 2 | ✅ **DONE** — `block5Thresholds.ts`. Read-only; Blocks 1–4 show zero diffs. | blocked bin at 17% in 3 of 5; no constants in the planner |
| 3 | ✅ **DONE** — two new high-stakes scenarios authored, three retuned, all six slots filled | all §7 gates green; every existing validator green |
| 4 | ✅ **DONE** — `cvrSeed` × 12, two parallel worlds, registers all `life_and_death` | `validate:lenses`, `validate:people` green |
| 5 | ✅ **DONE** — planner drives the card order; panel, rank badges, bin dividers and reason lines added; full logging | alignment tiers byte-identical; verified live in the running app |
| 6 | ✅ **DONE** — verified in the running app across light/dark × desktop/mobile | no page overflow; SVG labels measured, not eyeballed |
| 7 | `scenario.positionInSequence` logging (order stays fixed per §9) | logged on every trial |
| 8 | ❌ **REVERTED** — no re-measurement; the author's design measures drift from behavior, not from re-asking. See §14c. |
| 9 | Inverse planner + drift fields | §13 item 13 |
| 10 | Docs + methods write-up of every derivation in §4b | — |

Stages 1–4 are invisible to a participant. Nothing before Stage 5 changes Block 5 behavior, and
**as of this writing nothing in the running experiment has changed at all** — the two new modules
are not imported by any component yet.

### What Stage 1 actually shipped

| File | Lines | Role |
|---|---|---|
| `src/experiment/block5Thresholds.ts` | ~310 | Derives red lines, exchange rates and tolerance from `MoralProfile`. Read-only. |
| `src/experiment/block5Planner.ts` | ~400 | `plannerRank(scenario, profile)`. Pure, DOM-free, deterministic, zero constants. |
| `tools/simulate_planner.cjs` | ~290 | Authoring sweep: 72 synthetic participants × 5 scenarios against 10 gates. |
| `tools/test_planner.cjs` | ~230 | 17 behavioral assertions across 5 tests of the tree itself. |

`npm run validate:planner` runs the sweep; `npm run test:planner` runs the tests and is chained
into `npm run validate:block5`.

---

## 14b. Stage 3 outcome — the deck as built

**Every gate passes.** `npm run validate:block5` (six suites) and `npm run validate:planner` are green.

| Scenario | Position | Distinct orders /72 | planner#1 = alignment#1 | Blocked bin | Slots |
|---|---|---:|---:|---:|---|
| Six Hours to Clear the District | `self` | 15 | 31% | 11% | 5 + 1 |
| Eight Hours Ahead of the Fire | `self_and_group` | 17 | 49% | 11% | 5 + 1 |
| Cancer Treatment Allocation | `others` | 16 | 36% | 11% | 5 + 1 |
| Flood Evacuation Priority | `others` | 14 | 35% | 11% | 5 + 1 |
| Water Contamination Response | `others` | 14 | 44% | 11% | 5 + 1 |

Compare the "before" in §2a: 4–5 distinct orders, and 54–79% confound with three scenarios failing.
**The confound gate now passes in all five, with margin.** Ordering and alignment are separable
everywhere in the deck.

### What replaced what

| Retired | Replaced by | Position |
|---|---|---|
| `travel_mode_choice` — Getting to Fairhaven (everyday, stakesWeight 0.5) | `chemical_release_escape` — a chlorine plume, six hours, the participant alone | `self` |
| `meal_hosting_choice` — Dinner for Four (everyday, stakesWeight 0.5) | `wildfire_household_evacuation` — a fire front, eight hours, two children and a grandmother | `self_and_group` |

Cancer, flood and water keep their cover stories and all their authored prose; only their payoffs
moved. **All five scenarios now run at the default `stakesWeight` of 1** — the 0.5 weighting existed
only to stop a dinner teaching the profile as much as a dose, and there are no dinners left.

### The six slots, filled in every scenario

Slot 1 (clean reference) is deliberately the **runner-up on gain**, close enough to the gain
champion that the trade-off tree can set gain aside in its favor. That is the paper's own Table 1
structure — the plan that is slightly worse on the top attribute and much better on the second —
and it is what makes slot 1 reachable as a rank-1 recommendation instead of a permanent also-ran.
Before that change, the clean reference was never ranked first for **any** of the 72 synthetic
participants in any scenario.

### One constant had to be recalibrated

`STABILITY_CHURN_CEILING` moved **35 → 42**. It is documented in `block5CVR.ts` as derived from a
null model — 4,000 random responders run through the real scenarios, ceiling set at their p99 —
with the instruction *"regenerate if the bump magnitudes or the scenario set change"*. The scenario
set changed, and the null moved from p99 = 34.9 to p99 = 41.7, because the new payoffs have a wider
spread. Leaving it at 35 would have saturated the movement half of Stability: chance responders
would have scored zero movement far more often than the calibration intends, making genuinely
unstable participants indistinguishable from merely noisy ones.

This is the **only** line of `block5CVR.ts` that changed. `policyAlignmentScore`, `rankLabel` and
`labelOptions` are byte-identical.

### Stage 5 outcome — the planner is live

`Block5PublicEmergencySimulation.tsx` now renders `plan.orderedIds`. `labelOptions` still runs,
still assigns the four-level tier by rank position, and its array is **never reordered** — its
order IS the tier computation, so it stays the label source and stops being the display order.

Verified in the running app with two seeded participants:

| Check | Result |
|---|---|
| Card order comes from the planner | ✅ rank badges 1–6 in planner order |
| Alignment tier still renders, unchanged | ✅ "Aligned" / "Weakly aligned" / "Misaligned" / "Strongly misaligned" |
| **The two visibly disagree** | ✅ a card ranked **3rd** by the planner carried **"Strongly misaligned"** |
| Panel shown identically regardless of bins | ✅ same three lines for both participants |
| Costed divider + "Has a cost" badge | ✅ fires for a participant with no red line |
| Blocked divider + "Crosses a limit you set" | ✅ fires only for a participant who refused outright |
| **Blocked option still selectable** | ✅ `disabled: false`, `pointer-events: auto`, opacity 0.82 |
| Selecting a blocked option runs CVR | ✅ reflection flow opened as normal |

That third row is the whole point of the build. Ordering and alignment are now two computations
that can be read against each other on the same card.

### One design decision made during the wiring, worth stating

**The planner reads the ORIGINAL pre-Block-5 profile, not the running one.** The profile carried
between scenarios is mutated by CVR and APA. Had the planner followed it, the card order would
chase the participant's own drift — options re-ranked to match whatever the last scenario just
taught the system — and drift would be measured against a moving instrument. The ruler has to hold
still while the thing being measured moves.

The alignment tier DOES follow the live profile, deliberately. The tier is a running judgment;
the ordering is a fixed frame. Keeping them on different clocks is exactly what lets the analysis
ask whether the two came apart.

---

## 14c. Stage 8 — REVERTED. No re-measurement.

**Decision (2026-08-30, the author): the participant does NOT answer Blocks 1–4 a second time.**

A `block5_remeasure` stage was built and then removed in full. What the author wants is the
comparison the system already makes:

> what the participant chose in Blocks 1–4  →  how far their values have moved by the end of Block 5

That already exists, three times over:

| Where | What it shows |
|---|---|
| `computeStability` → the **Stability** headline | order change + total movement, `originalProfile` vs the end-of-Block-5 profile |
| Charts card 1 | before/after radar over the four values |
| Charts card 2 | value-by-value trajectory across the five scenarios |

**Why re-asking was the wrong call, beyond the length.** Re-administering the identical ladders
straight after an intensive moral block invites a testing effect: a participant who recognizes the
questions has an obvious reason to answer consistently ("I should not contradict myself") or
inconsistently ("I should show the block affected me"). That is a demand characteristic sitting
directly on top of the dependent variable, and it would be very hard to argue away afterwards.
The behavioral route has no such problem — the participant is never asked to describe themselves,
only to choose.

**The honest limitation to keep in the write-up.** The end-of-Block-5 profile moves by update
constants the study chose (+30 / +15 / −20 / ±25), so the ABSOLUTE size of a Stability score is
partly a property of those constants rather than of the participant.

**This does not damage the study's actual claim**, because the headline comparison is
*within-participant across positions* — alone vs with dependents vs for others. The same constants
apply in all five scenarios, so they cancel in that comparison. Report Stability as a comparative
measure across positions, not as an absolute quantity of drift, and the constants stop mattering.

### Stage 6 — what the visual pass actually caught

Verified live in all four combinations (light/dark × desktop/mobile). Two real defects, both in the
new slope chart, both found by **measuring the DOM rather than looking at a screenshot**:

1. **Clipped value names.** "protecting the vulnerable" renders **178 user units** at font-size 10
   in the inherited face — not the ~120 assumed. Gutters of 118 and then 152 both cut it to
   "cting the vulnerable". Now sized from the measured width, with the label font pinned so a
   theme change cannot silently re-break it.
2. **Colliding end labels.** Two values finishing at 99 and 100 rendered on top of each other as
   "990". Labels within 11 units of one already placed are now nudged apart, with a hair-line back
   to their own point.

Confirmed: the page never scrolls horizontally at 375 px; the chart scrolls inside its own
container and reaches its end; no SVG text falls outside the viewBox.

---

## 15. Risks to state in the write-up, not to solve silently

1. **Position bias.** Once cards are ranked, choosing rank 1 may mean "matches my values" or just
   "it was first". Ranking is the manipulation, so this cannot be removed — only bounded. Gate 2
   (§7) is the bound: if the planner's #1 is the aligned option less than half the time, the two
   explanations separate.
2. **Ordering can suppress the effect being studied.** If the top card is usually the aligned card,
   nearly everyone takes it, misaligned selections vanish, and CVR almost never fires. Gate 2 again.
   Verify before building any UI.
3. **The derivations in §4b are readings, not raw data.** A rung-index difference *is* the
   participant's own answer, but calling it an "exchange rate" is an interpretation this plan
   makes. Report the derivation openly in the methods so a reader can disagree with the reading
   without doubting the data. This is far stronger than a default, but it is not free of theory.
4. **Performance is deliberately absent from the ordering** (§4b). The planner therefore cannot
   rank a fast option above a slow one, by design. If a participant expects the ranking to weigh
   practicality, the card chips must make clear that performance is shown, not scored.
5. **Escapee vs allocator** rides along with position (§5). Mitigated by allocation-shaped options
   at every position; not eliminated.
6. **Rule-Implied Drift is not Stability** (§4c). Two distinct numbers with two distinct names, or
   the stability claim comes out of the study.

---

## 16. Simple English Explanation

### Why the order has to change

Imagine six cards on a table, each one a different way to handle an emergency.

Right now the cards are laid out in the order **"how much does this look like you?"** The card
that best matches your earlier answers goes on top.

That sounds helpful. It isn't. If your favourite is always on top, then when you pick the top
card, nobody can tell *why* — because it matched you, or because it was simply first. Two
different reasons, one result. So the result tells us nothing.

We measured it: right now the top card and the "matches you" card are **the same card 54–79% of
the time**.

### What the planner does instead

It never gives a card a score on its own. It picks up two cards, holds them side by side, and asks
one question: **"is the gap on the thing you care about most actually big?"**

Say you care most about **how much is gained**, and second about **how many are harmed**.

- Card P → gain **100**, harm **20**
- Card Q → gain **92**, harm **95**

P wins on your favourite thing — but only by **8**. Q is better on your second thing by **75**,
nearly ten times more. So the planner says: *that gap on gain is too small to be worth that much
harm*, and puts **Q above P**.

**P is the best card on your own favourite value and still does not come first.** That is the
whole trick, and the sorting we have now can never do it.

### Where the planner gets its numbers — this is the important part

The planner needs three things about you, and **it invents none of them**. All three are already
sitting in the answers you gave in Blocks 1 to 4. Nobody has to guess, and nothing new is asked.

**1. Your red lines — the things you will not do for any price.**
In Block 3 we showed you a group of workers and offered money. $1. Then $10,000. Then $100,000,
$1M, $10M, $100M. If you said no every single time, right up to a hundred million dollars, then
you drew a line on screen with your own hand. That is a red line. We don't have to model it. It's
already saved as a number.

**2. Your exchange rate — how much extra you demand when the target changes.**
Block 3 asked the same question six times and changed only *who* and *how many*. Suppose you said
yes at **$10,000** for a group that can absorb the hit, but needed **$10 million** for a group
that cannot. You just told us your price for that difference: **a hundred times more**. That's an
exchange rate, and you set it yourself. We simply never read it that way before.

**3. Your tolerance — how small a gap is too small for you to notice.**
The money ladder jumps $1 → $10,000 → $100,000. If you said no at one rung and yes at the next,
then anything narrower than that jump is a difference you never actually distinguished. The ladder
measured your own resolution.

**And one thing we could NOT find anywhere.** Nothing in Blocks 1 to 4 ever asks whether *speed*
matters more to you than *being able to undo it*. So instead of picking a number and pretending,
**performance is taken out of the ordering completely.** The five bars still show on every card —
you can still see which option is fastest — but they never move a card up or down.

That's actually better. The experiment wants to find out whether *you* trade your values against
practicality. If the planner had already made that trade for you, we could never see you make it.

### Two more things

Cards that break a line **you** drew drop to the bottom with a short, honest note. They stay
**fully clickable**. If you can't pick them, we can never find out whether you would have.

And the old "matches you / doesn't match you" sticker **stays exactly where it is**. So you might
see a card that says "matches you" sitting in fourth place. **That mismatch is the whole
experiment.**

### The scenarios are changing too

The travel scenario and the dinner scenario are leaving. Here's why: we're asking whether you
behave differently when the cost lands on *you*, on *your own people*, or on *strangers*. But
right now "strangers" also happens to be the only life-and-death one. So if you act differently
there, is it because they're strangers — or just because it's serious? We can't tell those apart.

So all six become serious, and the only thing that changes between them is **who pays**:

- Two where **you are alone**.
- Two where **your own family is with you**.
- Two where **you decide for other people and you are perfectly safe**.

Same seriousness everywhere. Only the seat you're sitting in changes. It's the driving question:
*am I the same driver alone as I am with my children in the back — and as I am with a stranger's
children in the back?*

### The last thing, and the biggest

Your experiment says it measures whether people **change**. But it never asks the questions a
second time. It just moves the profile using rules we wrote ourselves.

That's like weighing someone, then instead of weighing them again, adding up everything you
watched them eat and calling that their new weight.

So we're adding one step at the end: **put them back on the scale.** Re-ask the Blocks 1–3
questions, word for word, and compare. Blocks 1–4 themselves don't change at all — we just run
them once more, afterwards.
