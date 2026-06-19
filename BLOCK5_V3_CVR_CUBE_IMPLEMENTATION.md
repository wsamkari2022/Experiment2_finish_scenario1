# Block 5 — CVR Cube (v3) Implementation Record

This documents the changes made to Block 5 to implement the Scenario 1 CVR Cube spec
(see the `Claude Output` master spec). It is the source-of-truth for the code so we can
keep track of changes and later replicate the pattern to Scenarios 2–5.

## What changed (file map)

**New files**
- `src/experiment/block5CVR.ts` — the CVR Cube **engine** (pure functions): policy-fit
  match score, 4-level alignment label, cube coordinate (violated value + framing + who),
  profile score updates, graded VCI, Stability, and performance score.
- `src/experiment/block5CVRContent.ts` — the **words** for CVR vignettes, keyed by cube
  coordinate. Scenario 1 (cancer) is authored per the spec; other scenarios use a generic
  fallback. No scenario text lives in the logic.

**Modified files**
- `src/experiment/block5Types.ts` — added: `Block5PolicyDimKey` (the 4 ranking dims),
  `AlignmentLevel`, `ALIGNMENT_BANDS`, the 8 `METRIC_KEYS`/labels/hover text,
  `Block5MetricProfile`, CVR types (`CVRFraming`, `SalienceWho`, `CVRCoordinate`,
  `CVRStory`, `CVREndorsement`), new option fields (`metrics`, `consequence`, `givesUp`,
  `moralTension`), and new result/measure fields (alignment level, VCI/Stability, etc.).
- `src/experiment/block5Scenarios.ts` — Scenario 1 is now the **6 stronger options**, each
  with a 4-dimension policy fingerprint, 8 performance metrics, and a consequence line.
  Scenarios 2 & 3 keep their options with a consequence line added (their 8 metrics
  auto-derive until authored — Scenario 1 first).
- `src/experiment/Block5PublicEmergencySimulation.tsx` — rewritten flow: metrics dashboard
  on top, all options shown with a 4-level alignment badge (never removed), the option
  cards now show **only the 4 policy dimensions** (the 7-dim view was stale), the soft
  reconsideration (tap-the-trade-off + Keep / Change my mind), the CVR vignette +
  endorsement (Yes → Q1 value, Q2 stakeholder → Confirm; No → APA value-clarification flow,
  see v3.4), the final confirmation, and the profile carried forward across scenarios.
- `src/experiment/Block5SimulationSummaryPage.tsx` — now shows the headline measures
  (graded **VCI**, **Stability**, **Performance**) and a per-scenario recap with the
  alignment level and CVR outcome.

**Unchanged but still used**
- `block5Ranking.ts` is kept only for `closenessLabel` (used by `block5Meters.tsx`).
  `rankOptions` is now superseded by `labelOptions` in `block5CVR.ts`.

## The CVR Cube logic (exact)

- **Match score (alignment):** weighted closeness of the option's 4 policy dims
  {vulnerability, group-size, gain, outcome-aggregation} to the profile, weighted by how
  much the participant cares about each. 0–100.
- **4-level label (bands 85 / 75 / 55):** ≥85 Aligned · 75–84 Weakly aligned ·
  55–74 Misaligned · <55 Strongly misaligned. **CVR fires when match < 75.** No option is removed.
- **Cube coordinate** = (violated value) + (framing) + (who):
  - *violated value* = the participant's top policy value the option scored low on.
  - *framing* = context if context-sensitivity ≥ directness-sensitivity, else directness.
  - *who* (inverse stakeholder map): trait <40 → close/named person; 40–69 → group/professional; ≥70 → system/population.
- **Endorsement (misaligned + Yes):** Q1 value: +30 (really value) / +15 (kept); displaced
  **#1** top value: −20 / −10; Q2 stakeholder: +25 (guided) / −25 (not). All clamped 0–100,
  committed only on **Confirm** (Change-my-mind discards).
- **Weakly aligned + Keep:** +10 to the option's main value. **Aligned + Keep:** no change.
- **Graded VCI:** per scenario `S = max(base, reflective)`; base {Aligned 1.0, Weakly 0.75,
  Misaligned 0.35, Strongly 0.0}; reflective {strong 0.9, weak 0.6, no 0}. VCI = mean(S)×100.
- **Stability:** share of final choices that align with the **original** pre-Block-5 profile.
- **Performance:** average of the option's 8 metrics (kept separate from alignment).

## Placeholders / left for later (by design)
- **APA**: now fully implemented (v3.4) — the "No" path opens the value-clarification flow.
- **Scenario 2 & 3**: run on the new engine, but their 8 metrics auto-derive and their CVR
  vignettes use the generic fallback until authored (Scenario 1 was the priority).
- Stakeholder selection is the **inverse map** (not randomized), per the spec.

## Validation status
- All Block 5 files **type-check clean** (`npx tsc -p tsconfig.app.json --noEmit` reports no
  errors in any `block5*`/`Block5*` file). The 8 remaining project tsc errors are
  pre-existing unused-variable warnings in other Bolt files and do not affect the app.
- **To run/build you need Node 20.19+ or 22.12+.** This machine has Node 20.10.0, which the
  current Vite (Rolldown) refuses to run. Upgrade Node, then `npm install && npm run dev`.
  (Bolt's own preview environment already has a compatible Node.)

## Update — performance dashboard + refresh fix (approved)

1. **Top dashboard = the participant's cumulative performance** (not a single option). It is
   a running **average** of the 8 metrics of every option **confirmed so far**, starting at
   **0** in Scenario 1 and growing across scenarios. (`cumulativeMetrics` in `block5CVR.ts`;
   each confirmed choice now stores its `metrics` in the scenario result.)
2. **"Preview impact" button on each option card.** Clicking it puts the top dashboard in a
   projected mode showing what the overall metrics **would become** if that option were
   chosen, with per-metric ▲/▼ deltas and a baseline marker. (`projectedMetrics`.)
3. **Refresh fix (issue 3):** Block 5 no longer resumes mid-block. On mount it clears
   `block5_public_emergency_progress` and always starts at **Scenario 1**, preserving the
   Blocks 1–4 profile so Scenario 1 can be re-tested without redoing earlier blocks. (Block 5
   no longer persists scenario progress to localStorage; only final results are saved.)

All Block 5 files remain `tsc`-clean after these changes.

## Update — v3.1 (alignment fix + dashboard UX + white-bar meaning)

1. **Alignment is now threshold-satisfaction, not closeness** (`policyAlignmentScore` in
   `block5CVR.ts`): an option is penalized **only when it falls below** the participant's
   priority on a value; meeting/exceeding costs nothing. Weighted by how much the user
   cares: `alignment = 100 − Σ (user/100) × max(0, user − option)`. Bands stay 85/75/55.
   This fixes the bug where over-delivering a value wrongly lowered the label (the
   screenshot "essential workers" option now scores 91 → **Aligned**, not "Weakly").
   The CVR `violatedValue` is now the **largest importance-weighted shortfall**.
2. **White meter bars now explain themselves** (`block5Meters.tsx`): the white line is the
   participant's priority (threshold); the colored bar is the option; if the bar stops
   short, a **red shortfall gap** is drawn up to the line and labeled
   *"Below your priority by X"* (else *"Meets/Exceeds your priority"*). A legend + a
   one-line explanation appear in the expanded card view.
3. **Dashboard UX:** the top performance dashboard is now **sticky** (stays visible while
   scrolling), has an **ⓘ info toggle** explaining that scores are an **average** (0–100,
   never exceeds), and a clearer label (*"average of N scenario(s) so far"*). Each option
   also shows an **inline impact panel** when previewing, so the projected overall + the
   biggest metric changes are visible without scrolling up.

**Empirical check (5 representative profiles × 6 options):** label distribution was
Aligned 9 / Weakly 7 / Misaligned 7 / Strongly 7 — all four levels occur. "Strongly
misaligned" arises exactly where expected (e.g., a strong-utilitarian profile choosing
"Protect vulnerable" → 0; a strong-vulnerability profile choosing "Max total lives" → 42).
All Block 5 files remain `tsc`-clean.

## Update — v3.2 (richer CVR: outcome-equivalent + two-part + colour-coded)

The CVR vignette now reflects the true meaning of CVR (same trade-off & numbers, recontextualized) and is split into two visually distinct parts.

1. **Shared fact base + per-option CVR seed** (`block5Types.ts`, `block5Scenarios.ts`): each
   scenario has a `factBase` (e.g. *"20 doses, ~120 patients; every option gives out all 20 —
   only who changes"*), and each cancer option has a `cvrSeed` = `{ rule, identifiedCase, harm }`
   (the concrete trade-off + the identified person it excludes). Other scenarios fall back to a
   generic seed.
2. **Two-part vignette** (`block5CVRContent.ts` → `getCVRStory(scenario, option, coord)` returns
   `{ recontext, stakeholder, reendorseQuestion }`):
   - **recontext** = the recontextualized scenario: `{a|same N doses}` + the `{v|value}` it trades
     away + the `{f|framing}` (context/directness). Outcome-equivalent.
   - **stakeholder** = AHA-style: `{w|who appears}` (close/group/system) + identified case + `{b|harm}`.
3. **UI** (`Block5PublicEmergencySimulation.tsx`): the overlay shows the **recontext** in an
   accent box (with the fact-base reminder) and the **stakeholder vignette + re-endorsement
   question** in a **distinct, unlabeled purple box**, so the participant can tell the
   recontextualized scenario from the stakeholder perspective. A `renderCVRMarkup()` parser turns
   `{a|}{v|}{f|}{w|}{b|}` into **bold/italic, colour-coded** spans (gold=same numbers,
   teal=value, orange=framing, purple=who), with a small colour key. Colours match the cube faces.

Validated: all 24 cube cells produce balanced markup and read correctly. All Block 5 files `tsc`-clean.

## Update — v3.3 (rank-based labels + aligned reinforcement)

**Problem:** with absolute score bands, the label spread depended on the profile's absolute level
(uniformly-high profiles → all misaligned; uniformly-low → all aligned). No fixed band — and not
even profile normalization — could guarantee a usable spread (verified empirically).

**Fix:** labels are now assigned by **rank within the scenario**, not by absolute cutoffs.
- `block5Types.ts`: `ALIGNMENT_BANDS` (score cutoffs) → **`ALIGNMENT_RANK_RULE = { aligned: 1, weaklyAligned: 1 }`** (tune the shape here).
- `block5CVR.ts`: `alignmentLevel(score)` → **`rankLabel(index, total)`**; `labelOptions` ranks options by the absolute threshold-floor fit score (stable tie-break by id) and assigns the level by **rank position**: top `aligned` → Aligned, next `weaklyAligned` → Weakly, better half of the rest → Misaligned, worse half → Strongly. For 6 options this is a **balanced 1 / 1 / 2 / 2 every run, for any profile**.
- The absolute fit score is still computed (the "Align NN" badge, the white-bar detail, and the CVR `violatedValue` are unchanged), so the bars still explain *why* an option ranks where it does, and the CVR vignette still names the value the chosen option falls short on.
- Stability's "aligned to original profile" is now computed by ranking the options against the original profile (`labelOptions`), consistent with the new scheme.

**Aligned reinforcement:** keeping an **Aligned** option now adds **+15** to its main value (was 0),
since "Aligned" is the *relative* best fit, not necessarily an absolute one; **Weakly aligned** stays
**+10**. Both clamp to 100 (`applyValueBump(profile, option, points)`).

**Meaning shift:** "Aligned" = *best fits your values among the available options* (relative), which
is the right framing for a forced choice; VCI reads as "did you pick options that best fit your
values." Known edge (not guarded by default): for a participant who absolutely fits *all* options
(uniform-low profile), the bottom-ranked options are still labeled Misaligned/Strongly even though
their absolute fit is high — an optional guardrail ("don't fire CVR on an option that meets all your
lines") can be enabled later.

Validated empirically: all six test profiles (uniform-high, uniform-low, vuln-strong, gain-strong,
balanced, flat) yield exactly 1/1/2/2. All Block 5 files `tsc`-clean.

## v3.4 — APA (Adaptive Preference Alignment), the "No" path

When a participant sees the CVR vignette for a misaligned choice and answers **"No, I would not"**,
the flow now opens the **APA value-clarification panel** (`APAPanel` in
`Block5PublicEmergencySimulation.tsx`) instead of the old placeholder. APA's job is *not* to judge
the choice — it is to clarify whether the contradiction is a genuine **value reprioritization** or a
**contextual exception**, so later scenarios read the participant correctly.

**The four sections (each colour-coded, bold + italic):**
1. **Reassurance / framing** — "we noticed a couple of your choices point in different directions;
   there are no right or wrong answers — this just helps the system represent your priorities."
2. **Locate the tension** — "you've leaned most toward *{top value}* (in teal), but here you chose an
   option built around *{option value}* (in orange)." `topValue = violatedValue(option, profile)`,
   `optValue = optionMainValue(option)`.
3. **Three questions:**
   - **Q1** (3 choices): *endorse* ("I genuinely value {option value} more now") · *context* ("just
     this situation — overall my priority is still {top value}") · *unsure* ("I'm honestly not sure")
     — **plus a 1–5 confidence rating**.
   - **Q2** (yes/no): did the perspective you saw (*{who}*, in purple) influence you?
   - **Q3** (forced pick, one of the 4 policy values): "which value do you most want the system to
     weight for you?" — there is intentionally **no "no change"** option.
4. **Decide (Section 4 — the all-or-nothing commit):** show the option(s) that best fit the Q3 value
   (with a non-empty fallback), then a final "Make this your final decision?" confirm.

**Profile updates (`applyApaUpdates`, exactly as approved; clamp 0–100, pending until commit):**
- Q1 *endorse* → option value **+15**, top value **−10**. Q1 *context* → option value **+5**,
  top value **+10**. Q1 *unsure* → no value endorsement change.
- Q2 stakeholder sensitivity **+25** (yes) / **−25** (no).
- Q3 chosen value **+10** — this **stacks** (e.g. *endorse* + Q3 on the same value = **+25**).

**All-or-nothing commit (the key design rule).** Nothing is written until the participant confirms a
**final decision** in Section 4. Every "take me back to all options" / outside-click / "Change my
mind" routes to `onBail` and **discards everything — as if the participant never entered APA** (no
profile change, no record). This prevents CVR→APA loops from corrupting the data. Only "Yes, this is
my decision" fires `onCommit` → `handleApaCommit`, which: applies the pending profile, re-labels the
options against it, records the chosen option's result with `cvrEndorsement: "no"` and an `apa`
record `{q1, confidence, stakeholderInfluenced, prioritizedValue, originalOptionId}`, computes
`alignedToOriginal` vs the original pre-Block-5 profile (for Stability), and advances via the shared
`finalizeScenario`.

**Files touched:** `block5Types.ts` (new `APARecord`, `apa?` on `Block5ScenarioResult`),
`block5CVR.ts` (new `applyApaUpdates`), `Block5PublicEmergencySimulation.tsx` (`APAPanel`,
`ApaChoice`, `handleApaCommit`, `finalizeScenario` extracted and shared, `onApaCommit` wired through
`FlowOverlay`).

Validated: all Block 5 files `tsc`-clean; the point math (deltas, stacking, clamping, *unsure* = no
value change) verified by simulation. Note: the **CVR "Yes" endorsement** path is unchanged and still
uses its own numbers (+30/+15, −20/−10) — APA's numbers apply only to the "No" path.

## v3.5 — APA visual polish + escape-proofing (data integrity)

UX pass on the APA panel, prompted by participant-facing readability and a data-loss risk:

- **Answer buttons redesigned (`ApaChoice`).** The old buttons were ~5%-white on the near-black
  modal and read as plain text. They are now raised "glassy" buttons: a subtle top-lit
  gradient surface, a real border + drop shadow, larger readable text (sm, was 2xs), a
  left **radio dot**, and a strong **selected** state (accent-tinted fill + accent border +
  glow + a filled check). Hover lifts the button. Value names no longer break mid-word.
  This component is shared, so Q1, Q2 (yes/no) and Q3 (value pick) all benefit; the confidence
  1–5 pills were enlarged to match.
- **Scenario 1 gradient enriched** (`block5Scenarios.ts`, S1 only per the user's choice): a warm
  radial glow top-left + depth bottom-right over the red base, so the page is no longer flat
  black. The CVR/APA modal got a subtle neutral-slate gradient (kept neutral so the accent pops).
- **Backdrop is no longer click-to-close (CVR *and* APA).** Previously, clicking the dark area
  outside the modal called `onChangeMyMind` and silently dismissed the flow — a real risk of
  **missing/corrupted study data**. The backdrop `onClick` was removed; there is no Esc handler
  either, so the *only* way out is an explicit, recorded button.
- **"You'll lose your answers" warning** on the **two** "take me back to all options" buttons
  (Sections 1–3, and the option list). Clicking them now shows a confirm screen
  ("Go back and clear your answers? … None of it will be saved.") with **Stay on this page**
  (prominent, safe) vs **Go back anyway** (quiet). Only "Go back anyway" calls `onBail`.
- **Final-confirm "No" is now non-destructive.** At the "Make this your final decision?" step,
  "No" used to discard everything; it now returns to the option list keeping all answers
  ("No, let me pick a different option"). That is why only two buttons need the warning — this
  path no longer loses data. The all-or-nothing commit rule is unchanged (nothing is recorded
  until "Yes, this is my decision").

All Block 5 files `tsc`-clean.

## v3.6 — Randomized CVR stakeholder voices (+ matching Q2)

The stakeholder vignette used to show one fixed line per salience level (e.g. always "someone you
love — your mother, father, or child"), which felt robotic. Each level is now a **list of voices**,
one chosen at random per misaligned selection:

- `block5CVRContent.ts`: `whoLead` changed from `Record<SalienceWho, string>` to
  `Record<SalienceWho, WhoVariant[]>`, where `WhoVariant = { lead, label }` (`lead` = the full
  vignette sentence, `label` = the short subject for the Q2 question). A shared **`CLOSE_WHO`** list
  (mother/father/son/daughter/spouse/best friend) is reused by **every** scenario; medium + high are
  scenario-specific (Scenario 1: medium = patient's family member / nurse / treating doctor / ward
  oncology doctor; high = allocation-board member / hospital manager / someone else in charge — each
  keeps the "this was *your* responsibility" framing).
- **`pickWhoVariant(scenario, who)`** chooses a random voice and **never repeats the previous one**
  for the same (scenario, level) — a module-level `lastWhoIdx` map. Verified: 0 immediate repeats
  over 6000 picks/level, full coverage.
- Called **once** at selection time (`handleSelect`) and stored in `cvrWho` state, so the voice is
  **stable while the participant reads** and re-rolls on the next selection. Threaded through
  `FlowOverlay` → `getCVRStory(…, who)` (vignette) **and** the CVR Q2 + APA Q2 questions, so the
  question always names the **exact** person shown (e.g. vignette "the nurse…" → Q2 "Did hearing
  from the nurse…"; close → "Did imagining this patient as your mother…").
- The shown voice is recorded for analysis: `Block5ScenarioResult.cvrStakeholderShown` (set in both
  the CVR-endorsement and APA commit paths).
- **Per-scenario to-do:** keep `CLOSE_WHO`; author new medium + high lists for each new scenario.

All Block 5 files `tsc`-clean.
