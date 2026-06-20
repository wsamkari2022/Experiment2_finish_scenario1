# The User Value Profile — how Blocks 1–4 build the seven sensitivities

**Audience:** the researcher + advisor. This document explains the scoring model so it
can be defended in the dissertation/paper. It reflects the code after the June 2026
refactor (Approved Changes 1–10). It is the companion to `BLOCK5_V3_CVR_CUBE_IMPLEMENTATION.md`.

---

## 1. Purpose

Blocks 1–4 are **not** the experiment. They are a **pre-experiment value-profiling stage**
whose only job is to build one integrated **User Value Profile** — seven moral
*sensitivities*, each scored **0–100, where higher = a stronger sensitivity**. That profile
is the input to **Block 5** (the real experiment: the CVR-Cube + APA).

The four blocks gather evidence **gradually**. Some blocks measure a sensitivity *directly*;
others contribute *indirect* evidence. The model below combines them intelligently so the
final profile uses the **richest available evidence** for each sensitivity.

## 2. Pipeline (one source of truth)

```
Block 1 (Money)      ─┐
Block 2 (Trolley)    ─┤   computeAIWorkforceAnalysis()  ← single source for ALL Block-3 quantities
Block 3 (AI-Workforce)┤            │
Block 4 (Stakeholder)─┘            ▼
                         buildThresholdTree(profile, aiResults, block4)   ← THE engine (thresholdTree.ts)
                                     │   produces 7 sensitivities (0–100) + rank + provenance
                                     ▼
                         extractBlock5Profile(tree)   ← maps to the frozen Block5UserProfile
                                     ▼
                                  BLOCK 5
```

- **`aiWorkforceAnalysis.ts`** computes every Block-3 derived quantity (average indices,
  spreads) exactly once. `profileAnalysis.ts` and `thresholdTree.ts` both consume it — no
  more duplicated, drifting Block-3 maths (Approved Change 7).
- **`thresholdTree.ts` → `buildThresholdTree`** is the single place the seven scores are
  computed (Approved Change 2).
- **`profileAnalysis.ts` → `MoralProfile`** is a *separate, interim* Blocks-1–3 descriptive
  snapshot shown on the Insights page (before Block 4 exists). It is **not** the authoritative
  profile; it shares the same Block-3 source.

## 3. What each block measures

| Block | Task | Raw signal |
|---|---|---|
| 1 · Money | Find money in 3 contexts (neutral sidewalk / wealthy district / homeless shelter), amounts ascending | keep-threshold per context (index 0–8; 8 = never kept) |
| 2 · Trolley | Lever (indirect harm) then Bridge (direct harm); how many saved lives before acting | lever & bridge thresholds (index 0–8; 8 = never acted) |
| 3 · AI-Workforce | Approve a rollout that displaces low- vs high-buffer workers, across 3 group sizes, for escalating gain | gain threshold per (buffer × size) cell (index 0–6; 6 = never approved) |
| 4 · Stakeholder | Decide → hear two stakeholders → revise; rate confidence; name the most influential voice | decision snapshots, two confidence ratings, influential voice + its valence |

A higher index always means **"needed more before acting"** = more reluctant / more protective.
A refusal is stored as the **sentinel** (ladder length): a categorical "never" placed one rung
above the top — a documented modelling choice, recorded so analysis can separate it.

## 4. The seven sensitivities

| Key (frozen, used by Block 5) | Meaning (higher = …) |
|---|---|
| `vulnerabilityProtectionSensitivity` | protects the worse-off even at a cost |
| `groupSizeSensitivity` | weighs the number of people affected |
| `gainResponsivenessSensitivity` | readily moved toward harm by benefit/gain |
| `outcomeAggregationSensitivity` | maximises the total/aggregate outcome (utilitarian) |
| `directnessSensitivity` | being the *direct* cause of harm matters |
| `contextSensitivity` | surrounding circumstances reshape the choice |
| `stakeholderPerspectiveShiftSensitivity` | moved by a named person's perspective |

## 5. Contribution model (which signals feed each sensitivity)

Every block has a clear **home** sensitivity (so no block dominates unjustifiably — Approved
Change 3), plus **justified secondary signals**. The two meaningless duplications the audit
flagged are removed: each sensitivity now draws on a **distinct** quantity (Approved Change 2).

| Sensitivity | Primary | Secondary |
|---|---|---|
| Vulnerability protection | **B3** low- vs high-buffer gain gap | **B1** shelter-vs-neutral; **B4** moved-by-harmed |
| Group size | **B3** threshold spread across sizes | — |
| Gain responsiveness | **B3** overall gain level (inverted) | **B4** moved-by-beneficiary |
| Outcome aggregation | **B2** trolley sacrifice-willingness | — |
| Directness | **B2** bridge-vs-lever gap | — |
| Context | **B1** spread across the 3 contexts | — |
| Stakeholder shift | **B4** decision change + confidence + influence | — |

Block homes: **B1 → Context**, **B2 → Directness + Outcome aggregation**,
**B3 → Vulnerability + Group size + Gain responsiveness**, **B4 → Stakeholder shift**.
B1 and B4 are no longer near-unused.

## 6. The formulas (and why they are logical)

All signals are normalised to [0,1] (higher = stronger sensitivity), combined with an
**availability-aware weighted mean** (`blend`), then scaled to 0–100. Let
`M=8` (money rungs), `T=8` (trolley rungs), `G=6` (gain rungs).

**Common 0-baseline scale (June 2026 correction).** Every sensitivity is 0-baseline: **0 means
the factor did not move the participant at all**. The difference/gap dimensions (vulnerability,
directness) count only the value-relevant direction and are **NOT centred at 50** — a participant
who treats the two cases identically scores 0, not 50. This was changed because the old
centred-at-0.5 versions gave "no sensitivity" a structural score of 50, which made directness (and
vulnerability) almost always outrank the spread-based dimensions (context, group-size). Now all
seven sit on the same footing and any of them can legitimately be the top driver.

1. **Vulnerability protection**
   `blend( B3_gap ×0.55, B1_need ×0.30, B4_harmed ×0.15 )`
   - `B3_gap = max(0, avgLowBuffer − avgHighBuffer)/G` — demanded more gain to harm the more
     vulnerable group ⇒ protective. 0-baseline: equal treatment of the two groups = 0.
   - `B1_need = clamp01( max(0, shelter−sidewalk)/M + 0.20·max(0, sidewalk−wealthy)/M + 0.20·donationSignal )`
     — the participant's Block-1 need-sensitivity. PRIMARY = shelter reluctance; plus two **light**
     supporting signals from already-collected data: **Idea A** (leniency toward a wealthy owner —
     `sidewalk − wealthy`) and **Idea B** (`donationSignal` = 1 if they chose *donate* in the shelter
     context, 0.5 if donated anywhere, else 0). Additive-and-capped so the light signals only
     reinforce the shelter base (never dilute it); each contributes ≈6% of total vulnerability.
     Both feed **Vulnerability, not Context**, so context sensitivity is not inflated. *Return* and
     *Leave* map to no sensitivity (no honesty/passivity dimension) and are kept for analysis only.
   - `B4_harmed` — the influential voice was the *harmed* party and the final decision
     **protected** them (1.0), heard-but-not-protected (0.3), else excluded.
   - *Weights:* a full 2×3 gain matrix is the richest direct measure (0.55) > a single clean
     contextual contrast (0.30) > a soft reflective signal (0.15). The tiers encode **evidence
     strength**, not preference, and are ordered, not arbitrary.

2. **Group size** = `avgSpread / G`, where `avgSpread = mean(lowBufferSpread, highBufferSpread)`.
   The only block that varies group **size**; spread = how far the threshold moved as the
   harmed group grew (~10 → ~100,000).

3. **Gain responsiveness** = `blend( B3_gain ×0.8, B4_benefited ×0.2 )`
   - `B3_gain = 1 − overallGain/G` — approved at **low** gain ⇒ readily moved by gain.
   - `B4_benefited` — moved by the *beneficiary* voice and proceeded (1.0) / didn't (0.3) / excluded.

4. **Outcome aggregation** = `1 − mean(lever, bridge)/T`. The trolley is the canonical
   utilitarian test: acting for **fewer** saved lives ⇒ trades a small harm for a net gain ⇒
   stronger aggregation. (B2 only — keeps it distinct from Group size.)

5. **Directness** = `max(0, bridge − lever)/T`. Needing more lives to **push** (direct) than to
   **pull** (indirect) ⇒ directness matters. 0-baseline: identical thresholds (no direct-vs-indirect
   distinction) = 0 sensitivity, NOT 50 — so directness no longer structurally outranks context.

6. **Context** = `(max − min of the 3 money thresholds)/M`. How far behaviour moved across
   the neutral / wealthy / shelter contexts ⇒ context sensitivity. (B1's strong primary home.)

7. **Stakeholder shift** = `blend( decisionShift ×0.5, confidenceMovement ×0.3, influence ×0.2 )`
   - `decisionShift` — final ≠ initial = 1.0; wobbled-then-returned = 0.5; no movement = 0.
   - `confidenceMovement = |finalConf − initialConf| / 4` — any confidence shift = the
     perspectives registered.
   - `influence` — named a perspective as most influential.

**Availability-aware blending.** If a signal is absent (e.g. Block-4 valence wasn't recorded),
it is **excluded** and the remaining weights renormalise — an absent optional signal never
drags a score toward zero. With no evidence at all the neutral midpoint 0.5 is used (in
practice the primary signals are always present, since Blocks 1–3 are mandatory).

## 7. Block 3 carry-forward — an intentional design (Approved Change 4)

Block 3's gain index **carries forward** across group sizes within a worker type: if a
participant approves at \$10M for the small group, the medium group **starts** at \$10M.
This is **deliberate**, for two reasons:

1. **Participant time** — it avoids re-asking from \$1M for every cell.
2. **Logical monotonicity** — accepting \$10M to displace a *small* group but demanding *less*
   to displace a *larger* group would be incoherent; the block measures the gain↔harm
   trade-off, and harm grows with size.

Consequence (documented, **not a bug**): thresholds are non-decreasing with size, so
`groupSizeSensitivity` measures *how much more* gain the participant demands as the harmed
group grows. The raw per-cell indices and `startedAtGainIndex` are preserved so the
one-directional design is fully interpretable in analysis.

## 8. Rank weights & overall index (Approved Change 8)

A single, documented rank-weight function is used (no magic numbers):

```
weight(rank) = (N + 1 − rank) / (N(N+1)/2)
```

The strongest sensitivity (rank 1) gets the largest share, decreasing linearly; the N weights
sum to exactly 1.0 by construction (the denominator is the triangular number of N). The
**overall sensitivity index** is the rank-weighted mean of the seven scores. The same function
sets the profile's metadata `weight` field. *Note:* Block 5 alignment ranks options by the raw
0–100 scores, **not** by this weight, so the weight is descriptive metadata only.

## 9. Block 5 contract (never broken)

`extractBlock5Profile` is the hard boundary. It guarantees, and now **validates** (Approved
Change 6 — it throws loudly instead of silently defaulting):

- exactly 7 dimensions, one per frozen `Block5SensitivityKey`;
- each score an integer 0–100, higher = stronger (direction fixed);
- all four **policy** dimensions present (Block 5's CVR-cube indexes them by key);
- a clear error on any unmapped key, out-of-range score, or invalid rank.

The seven Block 5 keys are **unchanged**. Internal Blocks-1–4 names were cleaned up, but the
contract Block 5 consumes is identical.

## 10. Data model & MongoDB-readiness

Storage is **LocalStorage only** right now (no DB, no Supabase, no Bolt persistence). The data
objects are written to be **analysis-ready and easy to ship to MongoDB later**:

- Each block's results object carries `participantId` (stable session id) + `completedAt`
  (ISO-8601). One participant id threads through every record for future joins.
- Keys are canonical and self-describing (`ai_workforce_block_results`, etc.). The legacy
  `product_launch_block_results` dual-write is gone; the key is only kept in the session-clear
  list so stale data from older runs is wiped.
- Suggested future MongoDB collections (one document per participant per block): `block1_money`,
  `block2_trolley`, `block3_aiworkforce`, `block4_stakeholder`, `userValueProfile`,
  `block5_results`. Each already maps 1:1 to a result object above.
- **Fields worth collecting for analysis** (already in the payloads): per-block `history`
  (full choice path + timestamps), all raw threshold indices, the seven sensitivity scores +
  ranks, the Block-4 decision snapshots + both confidences + influential voice + its valence,
  and the `cvrStakeholderShown` from Block 5.

When MongoDB is added: introduce a thin `persistence` layer that takes these same objects and
POSTs them; no change to the scoring code is required.

## 11. What changed from the original Bolt build

- **Block 3 fully migrated** to AI-Workforce vocabulary; the Product-Launch types, dual-write,
  adapter, and dead components were removed (Change 1).
- **Formulas redesigned** to the multi-block model above; duplicated Block-3 maths consolidated
  (Changes 2, 3, 7).
- **Safety:** the silent "default to directness" fallback replaced with loud validation (Change 6).
- **Rank weights** derived from the dimension count, documented; dead/duplicate schemes removed (Change 8).
- **Derivations** now match the actual computation; misleading names fixed (Change 9).
- **Block 4 enriched:** initial confidence, confidence movement, reported influence, and the
  influential voice's valence now feed Stakeholder shift + secondary vulnerability/gain (Change 5).
- **Supabase removed**; `participantId` threaded into stored payloads for MongoDB-readiness.
- Fixed presentation order preserved deliberately (Change 10).
- **Common 0-baseline scale (validation pass):** vulnerability and directness were changed from
  centred-at-0.5 to `max(0, gap)` so "no sensitivity" reads as 0, not 50. This removed a structural
  bias that made directness almost always outrank context; now any dimension can be the top driver.
- **Idea A & B (approved):** the wealthy-context leniency and the prosocial donation action (both
  already collected) now add **light, capped** support to Vulnerability (≈6% each), routed away from
  Context so the context↔directness balance is preserved. Return/Leave remain analysis-only.
