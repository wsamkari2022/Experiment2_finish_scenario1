# The VRDS measurement model — how four blocks become seven sensitivities

This document is the map. It explains **what** every equation computes, **why** that particular
equation and not another, **where** it lives in the code, and **how** the numbers travel from a
participant's first click to the alignment scores that drive Block 5.

Read this first, then the comments above each equation in the source. Nothing here is a summary
of the code — the code is authoritative — but every formula below is quoted from it.

---

## 0. The shape of the whole thing

```
BLOCK 1  Found money        3 places   x 8 amounts     ─┐
BLOCK 2  Trolley            2 phases   x 8 life-counts ─┤
BLOCK 3  AI workforce       6 cells    x 6 gain levels ─┼─> raw signals
BLOCK 4  Stakeholder        1 decision, revisited      ─┘        │
                                                                 v
                                          blend()  weighted average per sensitivity
                                                                 │
                                                                 v
                                     calibrateSensitivity()  common ruler (Stage 2)
                                                                 │
                                                                 v
                                          SEVEN SENSITIVITIES (0-100)
                                                                 │
                    ┌────────────────────────────┬───────────────┴────────────┐
                    v                            v                            v
          FOUR POLICY VALUES            CONTEXT vs DIRECTNESS          STAKEHOLDER
          vulnerability, group,         picks the CVR framing          picks whose voice
          gain, outcome                 lens                           appears
                    │
                    v
          BLOCK 5 alignment + which value the CVR says was violated
```

**The three groups matter.** The seven are never all ranked against one another for a real
decision. They are used in three separate comparisons, and each needed its own fairness test:

| Group | Members | Used for | Compared against |
|---|---|---|---|
| Policy | vulnerability, group size, gain, outcome | Block 5 alignment; which value the CVR says an option violated | each other, and option fingerprints |
| Framing | context, directness | which reflection lens the CVR uses | only each other |
| Voice | stakeholder shift | which stakeholder speaks in the CVR | absolute cutoffs (40 / 70) |

---

## 1. The one idea behind every block: the staircase

Every block asks the same question repeatedly with one number rising, and records **the rung at
which the participant changes their mind**. That rung index — not the dollar or life figure — is
the measurement.

**Why the index and not the amount.** Block 3's ladder runs \$1 → \$100,000,000. The step from
\$1 to \$10,000 is a 10,000x jump; the step from \$10M to \$100M is 10x. Treating those as equal
would be indefensible if we averaged the *dollars*. We never do. Every downstream calculation
uses the ordinal position (0, 1, 2 …), and the rungs are treated as equally spaced steps of
"one notch more persuasion required". This is the standard reading of a threshold/staircase
instrument, and it is why the ladder values can be changed without touching any formula.

**The "never" sentinel.** A participant who refuses every rung has no threshold inside the
instrument. Their index is recorded as `LADDER_LENGTH` — one step beyond the top rung.

- Block 1: `toMoneyComparableIndex` → `MONEY_STEPS` (8) · `profileAnalysis.ts`
- Block 2: `toTrolleyComparableIndex` / `toBridgeComparableIndex` → `TROLLEY_STEPS` (8)
- Block 3: `toGainComparableIndex` → `GAIN_STEPS` (6)

*Known limitation:* this is **censored data**. "I refuse at any price" is stored as though it
were exactly one notch above the top rung, and it is then averaged with real thresholds. About
14% of Block 3 answers hit this sentinel. The direction is right (refusers rank as the most
demanding) but the magnitude is a floor, not a measurement. Worth a sentence in the methods
chapter.

---

## 2. BLOCK 1 — Found money

**Design.** 3 places (neutral sidewalk, wealthy financial district, outside a homeless shelter)
x 8 amounts (\$0.25 → \$10,000). Each place restarts the ladder at \$0.25.
`constants.ts` · `MoneyThresholdBlock.tsx`

**What it measures.** How much money it takes before you keep it, and whether *where you found
it* changes that.

### Feeds → CONTEXT SENSITIVITY (sole source)

```ts
contextSpread = (max(ctxIdx) − min(ctxIdx)) / MONEY_STEPS      // thresholdTree.ts
```

**Why a range and not a slope.** The three places are **unordered**. Sidewalk → wealthy district
→ shelter is not a scale from low to high; it is three different situations. There is no
direction to take a slope in. For an unordered factor the honest question is *"did your answer
move at all across the settings?"*, and the range is exactly that.

Contrast this with Block 3's group sizes (10 → 1,000 → 100,000), which **are** ordered and
therefore get a slope. The difference is not stylistic — it is what the factor allows.

*Known limitation:* the range is non-negative, so it rises with any variation including noise.
A random responder scores 55/100 on the raw measure. The Stage 2 calibration corrects the
comparison but not the underlying coarseness — the measure has only 9 possible values.

### Feeds → VULNERABILITY PROTECTION (weight 0.30)

```ts
shelterContrast      = max(0, shelter − sidewalk) / MONEY_STEPS
wealthyPermissiveness = max(0, sidewalk − wealthy) / MONEY_STEPS
vulnB1 = clamp01(shelterContrast + 0.2·wealthyPermissiveness + 0.2·donationSignal)
```

**Why `max(0, …)` here and not `|…|`.** Vulnerability protection is a **one-way** construct.
Being *more* reluctant to pocket money outside a shelter is protection. Being *less* reluctant
is not "reverse protection" — it is simply the absence of protection, and belongs at zero.

This is deliberately different from directness (below), where the reverse direction *is* a real
effect. Whether a construct is one-way or two-way is a judgement about meaning, not arithmetic,
and it is made explicitly for each dimension.

**Why the two light signals are additive and capped.** They can only reinforce the shelter
contrast, never dilute it, and each contributes at most ~6% of the total. They are routed into
vulnerability rather than context so that context sensitivity is not inflated by the same data.

---

## 3. BLOCK 2 — Trolley

**Design.** 2 phases (pull a lever / push a person from a bridge) x 8 life-counts (1 → 10,000).
Since the methodology change, **each phase restarts at 1**, and the bridge phase always runs
even if the lever was refused. `trolleyTypes.ts` · `TrolleyThresholdBlock.tsx` ·
`blocksLegacyMethodology.ts`

**Why independent phases.** Under the original design the bridge opened at the rung the lever
was accepted at, which made `bridge >= lever` **impossible to violate** — it was an artifact of
the procedure, not a finding. Independent ladders make the comparison a measurement.

### Feeds → DIRECTNESS SENSITIVITY (sole source)

```ts
directnessGapRungs = bridgeIdx − leverIdx
directnessB2       = |directnessGapRungs| / TROLLEY_STEPS
```

**Why absolute value.** Someone who needs five rungs *fewer* to push than to pull is moved just
as strongly by directness as someone who needs five *more* — only the sign differs. Scoring them
zero would make them indistinguishable from someone who draws no distinction at all. The
direction is not thrown away: it is recorded on the Block 2 result as `directnessGapIndex` and
`directnessDirection` (`aversion` / `reverse` / `none`) for the analysis to use.

**Why zero still means zero.** Identical thresholds → 0. The dimension keeps a true zero point,
which matters because `chooseFraming()` compares it directly against context sensitivity.

*Known limitation — this is the weakest-fed dimension.* One subtraction of two numbers, from a
single block, with no second source. If a participant answers either phase carelessly, the whole
dimension becomes noise and nothing else in the experiment can detect it.

### Feeds → OUTCOME AGGREGATION (sole source)

```ts
avgTrolley     = (leverIdx + bridgeIdx) / 2
aggregationB2  = 1 − avgTrolley / TROLLEY_STEPS
```

**Why inverted.** Acting to save *fewer* lives means accepting a harm for a smaller aggregate
gain — the canonical utilitarian test. A low threshold therefore means high outcome-aggregation
thinking, so the ratio is subtracted from 1.

**Why the average is now honest.** Under the paired design the bridge could not fall below the
lever, so this average was biased upward and the score was correspondingly deflated. With
independent phases it is an unbiased mean of two free measurements.

---

## 4. BLOCK 3 — AI workforce

**Design.** 2 worker groups (entry-level / senior-level) x 3 group sizes (~10 / ~1,000 /
~100,000) x 6 gain levels (\$1 → \$100M). **All six cells are always presented**, and each
restarts at \$1. `aiWorkforceTypes.ts` · `aiWorkforceAnalysis.ts`

**Why every cell is asked.** The original design inferred larger sizes from a refusal at a
smaller one and carried the accepted gain forward. Up to four of the six cells could be filled
with an inferred value rather than an answer. Now nothing is inferred.

**A note on the wording.** Participants are told only "entry-level workers" and "senior-level
workers, such as the engineers who build these AI systems". They are **never** told that
entry-level workers have less savings. That claim would put the answer in their mouth. The
seniority difference is a plain fact about the roles; the vulnerability judgement is left
entirely to the participant, and is then read off the *difference in their own thresholds*.
Evidence a participant produces is far stronger than agreement with a statement we supplied.

This block is a balanced 2x3 factorial, so its three signals are the standard **orthogonal main
effects** — grand mean, worker-type effect, size effect. That is why they can feed three
different sensitivities without being three copies of the same number (measured correlations:
−0.03, 0.00, 0.02).

### Feeds → GAIN RESPONSIVENESS (weight 0.80) — the grand mean

```ts
overallGain = (avgLowBufferIndex + avgHighBufferIndex) / 2     // = mean of all six cells
gainB3      = 1 − overallGain / GAIN_STEPS
```

**Why inverted.** A low bar means a small gain was enough to move you. Approving at \$1 is
maximal gain responsiveness — you were moved by almost nothing.

### Feeds → VULNERABILITY PROTECTION (weight 0.55) — the worker-type effect

```ts
vulnB3 = max(0, avgLowBufferIndex − avgHighBufferIndex) / GAIN_STEPS
```

**Why directional.** Same reasoning as Block 1: demanding *more* before harming the more
replaceable group is protection; demanding *less* is its absence, not its opposite.

**Naming note.** The internal keys remain `low_buffer` / `high_buffer` and the stored threshold
keys remain `threshold_lowbuffer_*`. Only the participant-facing wording changed:
`low_buffer` → "entry-level", `high_buffer` → "senior-level". Keep this in mind when reading
exported data.

### Feeds → GROUP SIZE SENSITIVITY (sole source) — the size effect

```ts
sizeSlopeForGroup(g) = index(largest group) − index(smallest group)   // signed, in rungs
sizeSlope   = (slopeLowBuffer + slopeHighBuffer) / 2
groupSizeB3 = max(0, sizeSlope) / GAIN_STEPS
```

**Why a slope and not a range.** The three group sizes **are** ordered, so the meaningful
question is directional: *did you demand more as more people were affected?* The previous
measure was `max − min`, which is non-negative by construction and therefore rises with any
variation at all. Measured on a random responder it scored **57/100** for "group-size
sensitivity", and in **54%** of those cases the actual small-to-large trend was flat or
downward. It was reading noise as signal. The slope scores that same random responder 13/100.

The slope is also a proper main effect, which is what makes it orthogonal to the worker-type
contrast: their correlation fell from −0.16 to −0.04 when this changed.

---

## 5. BLOCK 4 — Stakeholder reflection

**Design.** One policy decision, made; then stakeholder perspectives are heard; then the
decision and confidence are revisited. `thresholdTree.ts` (signals) · `vignetteLibrary.ts`

### Feeds → STAKEHOLDER SHIFT (three signals)

```ts
decisionShift      = 1    if final ≠ initial          (a full change of mind)
                   = 0.5  if mid ≠ initial but final = initial   (a wobble that returned)
                   = 0    otherwise
confidenceMovement = |confidence − initialConfidence| / 4
reportedInfluence  = 1 if the participant named an influential perspective, else 0

stakeholder = blend( decisionShift x0.5, confidenceMovement x0.3, reportedInfluence x0.2 )
```

**Why a change of mind carries half the weight.** Actually reversing a decision after hearing
someone is the strongest available evidence that the perspective landed. A wobble that returned
counts half: something moved, but not enough to hold.

*Known limitation — this is the second weak dimension.* `decisionShift` is a rare, all-or-nothing
event, and it dominates the blend. In practice the score is **near-binary**: roughly 14 for
anyone who does not change their decision, roughly 60 for the ~15% who do. Because
`chooseWho()` slices this with absolute cutoffs at 40 and 70, the three stakeholder voices come
out at about **81% / 13% / 6%** — the carefully-built ladder of "someone you have known twenty
years / a year / just met" is mostly one rung. Re-anchoring the cutoffs does not fix this: you
cannot make three groups out of a two-valued variable. The fix is more signal in Block 4 —
graded per-voice influence ratings rather than a single yes/no flip.

### Also feeds two secondary signals

```ts
b4Vuln = 1   if the influential voice was the HARMED party AND the final decision protected them
       = 0.3 if the harmed party was named but the decision did not protect them
       = 0   otherwise                                   → vulnerability protection, weight 0.15

b4Gain = same shape for the BENEFITING party            → gain responsiveness, weight 0.20
```

**Why 0.3 for "heard but not protected".** Naming the harmed party as influential is evidence
the perspective registered, even if it did not change the outcome. Scoring it zero would throw
that away; scoring it 1 would overstate it.

---

## 6. Combining signals — `blend()`

```ts
blend(signals) = Σ(weight · clamp01(value)) / Σ(weight)     // over AVAILABLE signals only
               = 0.5 when no signal is available
```

**Why a weighted mean over available signals.** The weights encode **evidence strength, not
preference**. A rich direct measure (a 2x3 gain matrix, 36 questions) outweighs a single
contextual contrast, which outweighs a soft reflective signal. The tiers are ≈0.55 / 0.30 / 0.15.

**Why re-normalising by the available weight matters.** Block 4's secondary signals only exist
if the participant named an influential voice with a recorded valence. If they did not, the
signal is *dropped* rather than treated as zero — a missing measurement is not evidence of
absence. The remaining weights are rescaled so they still sum to 1.

---

## 7. The common ruler — `calibrateSensitivity()`

`sensitivityCalibration.ts` (full derivation in that file's header)

Up to this point each sensitivity carries its natural statistic divided by its ladder length.
**Those are not comparable with each other.** A *level* sits near the middle of its range by
nature; a *difference* between two answers on the same ladder is small by nature. Measured on a
random responder the raw scores were:

```
stakeholder 63 · context 56 · outcome 50 · gain 50 · directness 37 · vulnerability 15 · group 13
```

Ranking a level against a difference is like asking whether someone's height is bigger than
their age. The arithmetic works; the answer is meaningless. In practice the two level-type
dimensions won nearly every comparison, and the CVR fired on only two of the four policy values
— vulnerability protection, the centre of the thesis, fired **0%** of the time.

**The fix.** Every sensitivity is re-expressed as one thing, with one meaning:

> *the percentage of all the ways a person could answer this instrument that this participant's
> answers exceed on this value*

Identical definition for all seven, so they become directly comparable. It is a **monotone
relabelling** — it never reorders two participants on the same dimension.

**Why this reference.** The tables describe the *instrument*, not a population: "what range of
scores can these questions produce, and how often?" That is a fact about the questionnaire,
recomputable by anyone from the code, requiring no pilot data and assuming nothing about
participants. A uniform draw over the response space is the maximum-entropy choice — the one
that assumes least. The scale is fixed before recruitment.

**Why "strictly exceeds" and not mid-rank.** Counting only patterns strictly below guarantees a
raw zero maps to zero on every dimension. Three of the seven are clamped at zero when the effect
runs the wrong way, and "this factor did not move me" must not be rewarded. Mid-rank would map a
raw zero on group size to 28/100 purely because many patterns tie there.

**Result** — each dimension's chance of ranking top for a random responder, ideal 14.3%:

| | before | after |
|---|---|---|
| vulnerability protection | 0.1% | 16.6% |
| outcome aggregation | 9.9% | 15.8% |
| gain responsiveness | 5.0% | 15.6% |
| group size | 14.3% | 14.7% |
| directness | 8.8% | 14.0% |
| stakeholder shift | 45.1% | 13.8% |
| context | 16.8% | 9.7% |

**MAINTENANCE:** the tables must be regenerated whenever a ladder gains or loses a rung, a
weight changes, a formula changes, or a block is added. Otherwise the ruler no longer matches
what it measures.

---

## 8. Ranking and weights

```ts
rankWeight(rank, n) = (n + 1 − rank) / (n(n+1)/2)      // thresholdTree.ts
```

A triangular weighting: with 7 dimensions the ranks get 7/28, 6/28 … 1/28, summing to exactly 1.
Used for the composite score and carried into the Block 5 profile.

*Known limitation:* about 10% of participants tie for their top dimension, and the tie is broken
by list order rather than by their answers. `topSensitivityKey` is therefore decided by accident
for roughly one participant in ten.

---

## 9. BLOCK 5 — how the sensitivities are used

### Alignment — `policyAlignmentScore()` in `block5CVR.ts`

```ts
penalty = Σ over the 4 policy dims of  (u/100) · max(0, u − f)
score   = 100 − penalty
```
where `u` = participant's score on that value, `f` = the option's fingerprint on that value.

**Why only shortfalls count.** `max(0, u − f)` means an option is penalised only when it delivers
*less* than the participant demands. Exceeding their bar costs nothing — you are not punished for
caring more than required. This is a threshold-satisfaction model, not a distance model.

**Why the penalty is weighted by `u/100`.** A shortfall on a value you hold strongly should hurt
more than the same shortfall on one you barely hold. This is why the dimensions had to be put on
a common ruler first: before calibration, a value scoring 14 contributed a fifth as much as one
scoring 47, purely because of how it was measured.

### Which value the CVR says was violated — `violatedValue()`

Picks the dimension with the largest `(u/100) · max(0, u − f)` — the biggest importance-weighted
shortfall. Same quantity as one term of the penalty above, so the CVR always names the value
that actually cost the option the most.

### Labels — `rankLabel()`

Labels are assigned by **rank position**, not by absolute score, which guarantees a spread for
every participant: with 6 options, 1 aligned / 1 weakly / 2 misaligned / 2 strongly. The CVR
fires on the bottom four. Absolute cutoffs would give some participants six "aligned" options and
no reflection at all.

### Option fingerprints

Re-anchored in Stage 3 by a uniform per-dimension **translation** (vulnerability +0, group −3,
gain −17, outcome −23) so each dimension's fingerprint median sits on the participant median.

**Why a translation and not a rescale.** A translation preserves every authored difference
exactly, and therefore the champion structure, the domination relationships and the shape of
every scenario. A rescale was tried and measured worse — group size captured 61% of CVR triggers
and one option became the best fit for 83% of participants — because stretching a narrow
authored range onto a wide participant range amplifies that dimension's penalties.

Result across all five scenarios: vulnerability 26.2% · gain 32.9% · group 21.4% · outcome 19.5%,
and every option in every scenario is the best fit for someone.

### Profile updates after a CVR answer — `bump()`

```ts
headroom = delta >= 0 ? (100 − score)/100 : score/100
score   += delta · headroom
```

**Why proportional and not additive.** With five scenarios each able to add ±30, a plain addition
drives any consistently-answered dimension to 0 or 100 by about the third scenario, after which
later scenarios can no longer move it. Simulation confirmed 2 of 3 tracked dimensions pinned at
three scenarios and 3 of 3 at five. Proportional updating (the standard Rescorla-Wagner form)
cannot reach a bound, so the profile keeps responding through Scenario 5 while preserving every
ordering — a strong endorser still ends clearly above a weak one.

---

## 10. Honest summary of what is strong and what is not

| Sensitivity | Sources | Assessment |
|---|---|---|
| Vulnerability protection | B3 gap (.55), B1 need (.30), B4 harmed voice (.15) | **Strong** — three independent sources |
| Gain responsiveness | B3 level (.80), B4 beneficiary voice (.20) | **Strong** — two sources, full range |
| Outcome aggregation | B2 trolley mean | **Good** — honest measure, single source |
| Group size | B3 size slope | **Good** — fixed in Stage 1, single source |
| Context | B1 spread across 3 places | **Moderate** — only 9 possible values |
| Directness | B2 bridge − lever | **Weak** — two questions, no backup |
| Stakeholder shift | B4 decision change | **Weak** — near-binary; voice ladder 81% one rung |

**Not yet audited:** Block 4's internal scoring in depth, the final VCI and Stability measures,
and the CVR ±20/±25 update magnitudes.

**The APA profile update.** The rule is "+30 to the value you name, −20 to the value currently on
top, scaled 0.6–1.0 by confidence, and no policy value moving more than 30 × that scale in one
clarification". `npm run verify:apa` asserts it in 19 checks.

The cap is what makes the published constant the applied one. Q1 and Q2 can name the same value,
and without a cap they add: an internally consistent participant — one who endorses their choice and
then names the value that choice protected — would receive **+45 × confidence**. Uncapped, that also
inverts the confidence rating, since from confidence 2 upward a double-counting participant moves
further (45 × 0.7 = 31.5) than one who is completely sure and does not (30 × 1.0).

Rated **9/10**: the mechanism is sound, the decrement demonstrably lets the ranking change (4 of 6
personas re-rank), and the rule is true as written on every answer path. The weak points are
saturation — 11.9% of policy values sit at 100 after a clarification — and the stakeholder ±25,
which is the one constant with no measurement behind it. Full worked audit, six personas, and the
comparison behind each constant: [`BLOCK5_APA_AUDIT.md`](BLOCK5_APA_AUDIT.md). Reproduce with
`npm run apa:personas` and `npm run apa:variants`.

**All figures in this document come from simulated participants** run through the real pipeline.
The *direction* of every finding is arithmetic and therefore solid; the exact percentages will
move with real people. Pilot data is the next thing that would improve this model.

---

## 10b. What the participant sees, and what is stored

### The five between-block pages are hidden

`src/experiment/interBlockPages.ts` holds one constant, `SHOW_INTER_BLOCK_PAGES`, currently
`false`. It hides five screens:

| Screen | Where |
|---|---|
| `CompletionScreen` | after Block 1 |
| `TrolleyCompletionScreen` | after Block 2 |
| `AIWorkforceCompletionScreen` | after Block 3 |
| `MoralProfileInsightsPage` | between Blocks 3 and 4 |
| `FinalMoralAnalysisPage` | between Blocks 4 and 5 |

**Why.** Every one of them reports back to the participant what the instrument has concluded
about them *before they have finished answering*. Two concrete risks:

- A participant told "you protect the vulnerable" going into Block 4 has been handed a
  self-description to live up to — and Block 4 is exactly where we ask them to revisit a
  decision after hearing other people. Consistency pressure is among the best-documented demand
  characteristics there is.
- The Final Analysis page displays the ranked seven-sensitivity tree, which is the very quantity
  Block 5 then uses to decide which options are labelled misaligned for that person. Showing
  someone the scoring key immediately before scoring them with it makes Block 5 unusable as a
  measurement.

**They are hidden, not deleted, and this matters.** Pages 4 and 5 are not merely display: the
Insights page derives the moral profile, seed case, domain and scenario context that Block 4 is
built from, and the Final Analysis page derives and stores the threshold tree. In hidden mode
they still mount, still compute and still write to storage — they simply press their own
Continue button (`useAutoAdvance`) instead of waiting for a click, and render `InterBlockPause`
instead of their content. Skipping the stage outright would have skipped the computation with it.

Two supporting details:

- `InterBlockPause` is the *same* component `ExperimentFlow` uses for its ordinary stage
  transitions, so a hidden page and a normal transition are pixel-identical. There is no visual
  seam where a summary screen used to be.
- `GlobalStepper` drops the two interstitial phases when hidden, so the bar reads 4 steps rather
  than 6. Leaving them in would show two steps ticking over to a green check on their own — the
  exact "what did I just skip?" question the hiding was meant to avoid.

**To revert:** set `SHOW_INTER_BLOCK_PAGES = true`. That is the entire change; every call site
reads that one constant.

### The consolidated participant record

`src/experiment/participantRecord.ts` assembles everything Blocks 1-4 produced into a single
versioned document, at one well-defined moment: `handleStartBlock5()` in `ExperimentFlow.tsx`,
immediately before Block 5 begins. Everything Blocks 1-4 measure is final by then, and nothing
Block 5 does can change it.

```
vrds_participant_record
├── schemaVersion, sessionId, assembledAt, calibrationVersion
├── raw           block1Money, block2Trolley, block3AIWorkforce, block4Reflection
├── derived       moralProfile, aiWorkforceAnalysis, thresholdTree, block5Profile
└── completeness  block1..block4, readyForBlock5
```

**Why raw and derived are both stored.** Raw is what the participant actually did and can never
be recovered if lost. Derived is what the model made of it and *can* be recomputed from raw by
re-running the pipeline. Keeping both means a future change to a formula can be applied
retrospectively to data already collected — you re-derive rather than re-recruit.

**Why `calibrationVersion` is stamped on every record.** Calibrated scores are only comparable
between participants who were scored against the same null CDF (§7). The stamp is what lets you
detect, rather than assume, that a batch is comparable.

**Migration to a database.** Nothing in that module talks to a network, by design — no
credentials, no endpoint, no request code. `buildParticipantRecord()` already returns exactly
the document you want to store; the migration is to add a POST beside the LocalStorage write in
`persistParticipantRecord()`, keeping the local write as the offline fallback. `sessionId` is the
natural `_id`, and it is the same id every per-block record already carries, so old and new
documents join cleanly.

**Getting a record out today**, with the participant's browser open on DevTools:

```js
copy(localStorage.getItem("vrds_participant_record"))
```

**Known gap.** The record is only assembled at the Block 4 → Block 5 boundary, so a participant
who abandons earlier leaves no consolidated document. Their per-block keys are all still written
independently and `buildParticipantRecord()` can be called at any time to assemble whatever
exists — `completeness` will describe how far they got. If partial sessions need to be captured
automatically, call `captureParticipantRecord()` at the end of each block as well; the function
is safe to call repeatedly and simply overwrites.

---

## 11. Gates to run before any release

```bash
npm run typecheck        # the real one — plain `tsc --noEmit` checks nothing here
npm run lint
npm run validate:block5  # champions, domination, no-obviously-best, CVR content
npm run check:images     # every mapped illustration resolves
npm run build
```

**Reading the lint result.** `npm run lint` reports ~116 errors, all of them
`react-refresh/only-export-components` in `src/components/ui/*`. Those files are generated Chakra
UI snippets, they are not ours, and the rule is a hot-reload convenience check rather than a
correctness one. The number that matters is errors **outside** that folder, which must be zero:

```bash
npx eslint src/experiment src/App.tsx src/main.tsx
```

