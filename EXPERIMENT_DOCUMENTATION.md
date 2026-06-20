# Experiment Documentation

## Overview

This is a moral-values assessment experiment built as a React/TypeScript single-page app. It guides a participant through five sequential decision blocks, derives a moral profile from the first three blocks, uses that profile to personalise a reflective fourth block, builds a 7-dimension sensitivity tree, and then presents personalised public-emergency policy scenarios in a fifth block that tests how the participant applies their moral values to real-world crises.

The experiment runs entirely in the browser. No account or login is required. All intermediate data is stored in `localStorage` so a page refresh resumes where the participant left off. Each new browser session (new tab, cleared session storage) starts fresh.

---

## Architecture at a Glance

```
src/
  main.tsx                  – React entry point; wraps App in Chakra Provider
  App.tsx                   – Renders <ExperimentFlow>
  experiment/
    ExperimentFlow.tsx      – Master stage machine: money → trolley → product → insights → block4 → final → block5 → summary
    ─── Block components ───
    MoneyThresholdBlock.tsx       – Block 1: Found-money decisions
    TrolleyThresholdBlock.tsx     – Block 2: Trolley problem (lever + bridge)
    AIWorkforceThresholdBlock.tsx – Block 3: AI workforce rollout approvals
    AdaptiveStakeholderReflectionBlock.tsx – Block 4: Stakeholder perspective reflection
    Block5PublicEmergencySimulation.tsx    – Block 5: Public emergency policy decisions
    ─── Block 5 modules ───
    block5Types.ts          – Type definitions for Block 5
    block5Scenarios.ts      – 3 scenarios with 5 options each (fingerprinted)
    block5Ranking.ts        – Candidate filtering, fit scoring, ranking logic
    block5Profile.ts        – Extracts Block 5 user profile from threshold tree
    block5Meters.tsx        – Sensitivity meter bar UI component
    Block5SimulationSummaryPage.tsx – Final results summary page
    ─── Analysis & profile ───
    profileAnalysis.ts      – Derives MoralProfile from Blocks 1–3
    aiWorkforceAnalysis.ts  – Computes 5 Block-3 scores
    thresholdTree.ts        – Builds ranked 7-dimension sensitivity tree
    finalAnalysis.ts        – Generates final plain-language analysis
    scenarioSelection.ts    – Chooses seed case and Block-4 scenario context
    vignetteLibrary.ts      – Block-4 scenario vignettes and stakeholder cards
    ─── Shared UI ───
    GlowSpan.tsx            – Animated text highlight (one-shot glow on value change)
    ProgressBar.tsx         – Step progress indicator
    ProfileCalculationModal.tsx – Detailed score-formula breakdown modal
    RankedThresholdTree.tsx – 7-dimension ranked tree display
    ─── Completion screens ───
    CompletionScreen.tsx                – Block 1 summary
    TrolleyCompletionScreen.tsx         – Block 2 summary
    ProductLaunchCompletionScreen.tsx   – Block 3 summary (legacy label)
    AIWorkforceCompletionScreen.tsx     – Block 3 summary (current)
    ─── Insights / final pages ───
    MoralProfileInsightsPage.tsx  – Shows profile patterns before Block 4
    FinalMoralAnalysisPage.tsx    – Final synthesis page after Block 4
    ─── Type definitions ───
    types.ts               – Block 1 types
    trolleyTypes.ts        – Block 2 types
    aiWorkforceTypes.ts    – Block 3 types (AI-Workforce; the only Block 3 type module)
    block5Types.ts         – Block 5 types
    ─── Constants ───
    constants.ts           – Block 1 amounts and contexts
  components/ui/           – Chakra UI snippet components
```

---

## Stage Flow

The experiment proceeds through named stages managed by `ExperimentFlow.tsx`. Between each major stage there is a short animated transition spinner (`transition_*` stages, 900 ms).

```
money
  │ handleMoneyContinue
  ▼
transition_money_trolley  (900 ms spinner)
  ▼
trolley
  │ handleTrolleyContinue
  ▼
transition_trolley_product
  ▼
product
  │ handleProductContinue
  ▼
transition_product_insights
  ▼
insights          ← MoralProfileInsightsPage (reads Blocks 1–3 from localStorage)
  │ handleInsightsContinue (receives MoralProfile + SeedCase + ScenarioContext + AIWorkforceAnalysis)
  ▼
transition_insights_block4
  ▼
block4            ← AdaptiveStakeholderReflectionBlock (personalised with profile)
  │ handleBlock4Continue (receives Block4CompletionPayload)
  ▼
transition_block4_final
  ▼
final_analysis    ← FinalMoralAnalysisPage (shows threshold tree + "Start Simulation" button)
  │ handleStartBlock5
  ▼
block5            ← Block5PublicEmergencySimulation (personalised ranking from tree)
  │ handleBlock5Complete (receives Block5Results)
  ▼
block5_summary    ← Block5SimulationSummaryPage (final results display)
```

Transition stages are never persisted to `localStorage`. If the page is refreshed during a transition, `getRestoredStage()` falls back to `"money"`.

---

## Block 1 — Found-Money Decisions

**File:** `MoneyThresholdBlock.tsx`  
**Constants:** `constants.ts`  
**Types:** `types.ts`

### Purpose
Measures the participant's threshold for keeping found money under three morally distinct location contexts. The amount starts small and escalates until the participant either chooses "Keep it" (threshold found) or exhausts all amounts (no threshold found).

### Amounts (8 steps)
`$0.25 → $1 → $10 → $20 → $50 → $100 → $1,000 → $10,000`

### Contexts (3, presented sequentially)
| Key | Label | Scenario |
|-----|-------|----------|
| `sidewalk` | Neutral sidewalk | "You find X on the sidewalk in a public street." |
| `wealthy` | Wealthy financial district | "You find X on the ground outside a major financial district office building." |
| `shelter` | Outside a homeless shelter | "You find X on the ground outside a homeless shelter." |

### Response Options
- **Keep it** — records acceptance at the current amount and moves to the next context
- **Try to return it** / **Leave it** / **Donate it nearby** — all three are non-acceptance; the amount escalates after a 280 ms delay
- If all amounts are exhausted without "Keep it", the context is recorded as `thresholdBeyondRange: true`

### State Machine
```
For each context:
  currentAmountIndex = 0
  LOOP:
    Show scenario with currentAmountLabel and contextPhrase
    User clicks a button
    IF "keep it":
      record threshold (accepted=true, thresholdAmountIndex=currentAmountIndex)
      transition to next context (900 ms)
    ELSE IF at max amount:
      record threshold (accepted=false, thresholdBeyondRange=true)
      transition to next context (900 ms)
    ELSE:
      setIsTransitioning=true, wait 280 ms
      currentAmountIndex += 1
      setIsTransitioning=false
      LOOP (next amount)
After all 3 contexts → CompletionScreen
```

### Output: `MoneyBlockResults`
```ts
{
  completed: boolean,
  completedAt: string,
  thresholds: {
    threshold_sidewalk: ThresholdResult | null,
    threshold_wealthy:  ThresholdResult | null,
    threshold_shelter:  ThresholdResult | null,
  },
  history: MoneyChoiceRecord[],
}
```

### Glow Behaviour
`GlowSpan` is used for two highlighted values per scenario:
- **Amount** (`glowColor="green.400"`) — glows when `currentAmountLabel` changes (i.e. after a non-accept click causes escalation)
- **Context phrase** (`glowColor` varies by context) — glows when the context changes (i.e. after moving from sidewalk → wealthy → shelter)
- Neither glows on initial mount; glow is driven by incrementing `useRef` counters compared via `useEffect`

---

## Block 2 — Trolley Problem

**File:** `TrolleyThresholdBlock.tsx`  
**Types:** `trolleyTypes.ts`

### Purpose
Measures two related thresholds in the classic trolley problem:
1. **Lever phase** — how many lives must be at risk before the participant will pull a lever to redirect the trolley (killing 1 to save N)
2. **Bridge phase** — at the same N found in the lever phase, will the participant push someone off a bridge to stop the trolley? This tests whether directness of the harmful act changes the decision

### Lives Options (8 steps)
`1 → 2 → 5 → 10 → 50 → 100 → 1,000 → 10,000`

### Phases
**Lever phase:**
- Buttons: "Pull the lever" / "Do not pull the lever"
- "Pull" → records lever threshold, jumps to bridge phase at the same index, shows transition message
- "Do not pull" → escalates to next lives value (300 ms delay); if all exhausted, completes with `leverBeyondRange=true`

**Bridge phase:**
- Starts at the same lives index where the participant accepted the lever
- Buttons: "Push the person" / "Do not push"
- "Push" → records bridge threshold, completes block
- "Do not push" → escalates to next lives value (300 ms delay); if exhausted, completes with `bridgeBeyondRange=true`
- If the lever was never accepted (lever beyond range), the bridge phase is skipped entirely

### Output: `TrolleyBlockResults`
```ts
{
  completed: boolean,
  completedAt: string,
  leverThreshold: LeverThresholdResult,   // always present
  bridgeThreshold: BridgeThresholdResult | null,  // null if lever was beyond range
  summary: {
    leverAcceptedValue: number | null,
    bridgeAcceptedValue: number | null,
    consistencyAtSameNumber: boolean | null,  // did they also push at the same N?
    directnessGap: number | null,             // bridgeValue - leverValue (positive = higher bar for bridge)
  },
  history: TrolleyChoiceRecord[],
}
```

### Directness Gap Interpretation
- `directnessGap = 0` — same threshold for lever and bridge; directness does not matter
- `directnessGap > 0` — needed more lives at risk to push than to pull; directness aversion present
- Bridge accepted but lever not — logically inconsistent (unusual)

### Glow Behaviour
Only the lives-count value glows. Glow fires when `currentValue` changes within a phase. Phase transitions (lever→bridge resetting the index) do **not** trigger a glow.

---

## Block 3 — AI Workforce Rollout

**File:** `AIWorkforceThresholdBlock.tsx`  
**Types:** `aiWorkforceTypes.ts`

### Purpose
Measures at what level of financial gain a participant would approve an AI rollout that causes serious job displacement. The scenario is varied across:
- 2 **worker group types**: low-buffer (limited alternatives) and high-buffer (stronger alternatives)
- 3 **group sizes**: small (~10), medium (~1,000), large (~100,000)

This produces 6 threshold measurements (2 × 3) forming a matrix.

### Gain Options (6 steps)
`$1M → $5M → $10M → $25M → $50M → $100M`

### Worker Groups
| Key | Label |
|-----|-------|
| `low_buffer` | "low-buffer workers with limited alternatives" |
| `high_buffer` | "high-buffer workers with stronger alternatives" |

### Group Sizes
| Key | Label | Count |
|-----|-------|-------|
| `small` | "small group of about 10 workers" | 10 |
| `medium` | "medium group of about 1,000 workers" | 1,000 |
| `large` | "large group of about 100,000 workers" | 100,000 |

### Traversal Order
```
For each worker group type (low_buffer → high_buffer):
  currentGainIndex = carryForwardIndex (see below)
  For each group size (small → medium → large):
    LOOP:
      Show scenario
      User clicks "Approve" or "Do not approve"
      IF "approve" at current gain:
        record threshold (accepted=true)
        carry that gain index to the next size in this group
        break inner loop → next size
      IF "do not approve":
        IF at max gain:
          record threshold (accepted=false, thresholdBeyondRange=true)
          carry GAIN_STEPS (beyond range) to next size
          NEXT: sizes after this one get blockedByPriorNonAcceptance
          break inner loop
        ELSE:
          gainIndex += 1, 300 ms delay, LOOP
```

**Carry-forward rule:** When approving at a certain gain level, the next size in the same group starts at the *same* gain index (not from zero). This is because if you approved at $10M for a small group, the block tests whether you'll approve at the same level or higher for a medium group.

**Blocking rule:** If you reject all gains for a given size (beyond range), all larger sizes in the same group are automatically blocked (recorded as `blockedByPriorNonAcceptance: true`) without being shown. The logic: if you wouldn't approve even at $100M for a small group, it is logically implied you won't approve for a larger group either.

**Cross-group carry:** When moving from low_buffer group to high_buffer group, the gain index does **not** carry over — the high_buffer group restarts from index 0.

### Output: `AIWorkforceBlockResults`
```ts
{
  completed: boolean,
  completedAt: string,
  thresholds: {
    threshold_lowbuffer_small:   AIWorkforceThresholdResult,
    threshold_lowbuffer_medium:  AIWorkforceThresholdResult,
    threshold_lowbuffer_large:   AIWorkforceThresholdResult,
    threshold_highbuffer_small:  AIWorkforceThresholdResult,
    threshold_highbuffer_medium: AIWorkforceThresholdResult,
    threshold_highbuffer_large:  AIWorkforceThresholdResult,
  },
  history: AIWorkforceChoiceRecord[],
}
```

### Progress Persistence
Block 3 saves its in-progress state to `localStorage` under `AI_WORKFORCE_PROGRESS_KEY` after every state change, so a page refresh resumes mid-block. This is the only block with mid-block persistence; Blocks 1 and 2 only persist their final results.

### Glow Behaviour
Three independent `useRef` glow counters track `currentGain.label`, `currentGroupType.key`, and `currentGroupSize.key`. Each counter increments only when its tracked value changes after initial mount. Only the changed value(s) glow.

---

## Between Blocks 3 and 4 — Moral Profile Insights Page

**File:** `MoralProfileInsightsPage.tsx`  
**Analysis:** `profileAnalysis.ts`

The insights page is shown between Block 3 and Block 4. It:
1. Reads the three completed block results from `localStorage`
2. Derives a `MoralProfile` (6 numeric scores + flags)
3. Builds a `SeedCase` (the most salient single decision from Blocks 1–3)
4. Builds a `ScenarioContext` (which worker group and size to use in Block 4)
5. Computes an `AIWorkforceAnalysis` (5 Block-3 scores)
6. Displays observed patterns in plain language
7. Offers a "show calculation" modal for full score formulas
8. Passes all of the above to Block 4 via `handleInsightsContinue`

---

## Moral Profile (profileAnalysis.ts)

Six normalised scores (0–1) are derived from Blocks 1–3:

| Score | What it measures | Formula (simplified) |
|-------|-----------------|----------------------|
| `vulnerabilitySensitivityScore` | How much context of vulnerability raises your bar | `0.5 + 0.5 × (0.5 × vulnProductGap + 0.5 × moneyVulnGap)` |
| `wealthContextPermissivenessScore` | More lenient when counterparty is wealthy? | `0.5 + 0.5 × (sidewalkIdx/steps − wealthyIdx/steps)` |
| `harmReluctanceScore` | General reluctance to cause harm (both trolley thresholds) | `0.5 × leverIdx/steps + 0.5 × bridgeIdx/steps` |
| `directnessAversionScore` | Higher bar for direct vs indirect harm | `(bridgeIdx − leverIdx)/steps + 0.5` |
| `scaleSensitivityScore` | Do thresholds shift when group size grows? | `max(vulnIndices) − min(vulnIndices) / steps` |
| `consistencyAcrossDomainsScore` | Are vulnerability-sensitivity signals consistent across blocks? | `1 − √(variance of 3 normalised signals) × 2` |

**Normalisation:** Each index is compared to the maximum possible index for that block (`MONEY_STEPS=8`, `TROLLEY_STEPS=8`, `PRODUCT_STEPS=6`). A higher index means a higher threshold (more reluctant); the maximum sentinel value equals `steps` (threshold beyond range).

**Flag fields** (booleans):
- `protectsVulnerableStrongly` — `vulnerabilitySensitivityScore ≥ 0.62` or shelter beyond range
- `refusedBridge` — never pushed in bridge phase
- `refusedLever` — never pulled in lever phase
- `refusedAnyProduct` — at least one Block-3 scenario never accepted
- `refusedAllVulnerableProducts` — all low-buffer scenarios never accepted

---

## AI Workforce Analysis (aiWorkforceAnalysis.ts)

Five 0–100 scores computed from Block 3:

| Score | What it measures |
|-------|-----------------|
| `organizationalGainResponsivenessScore` | How readily financial gain drives approval (high = approves at low gain) |
| `lowBufferProtectionScore` | Does the low-buffer threshold exceed the high-buffer threshold? |
| `highBufferPermissivenessScore` | How readily high-buffer scenarios are approved |
| `sizeEscalationSensitivityScore` | Threshold spread across group sizes (both groups averaged) |
| `workerContextSensitivityScore` | Absolute difference between LB and HB average threshold indices |

---

## Block 4 — Adaptive Stakeholder Reflection

**File:** `AdaptiveStakeholderReflectionBlock.tsx`  
**Vignettes:** `vignetteLibrary.ts`  
**Scenario selection:** `scenarioSelection.ts`

### Purpose
Block 4 is a three-screen reflective exercise that:
1. Presents a specific AI workforce scenario (personalised from the profile)
2. Asks for an initial decision and confidence level
3. Shows a **harm-side stakeholder perspective** (from an affected worker)
4. Asks for a mid-point reaction
5. Shows a **benefit-side stakeholder perspective** (from an organisation or shareholder)
6. Asks for a final decision, confidence, and influence rating

The scenarios and perspectives are drawn from a library (`vignetteLibrary.ts`) and selected based on the participant's moral profile.

### Screen 1: Initial Decision
- Shows the scenario vignette (derived from Block-3 context)
- Buttons: "Approve the rollout" / "Do not approve the rollout"
- Confidence slider: 1–5
- Proceeds on submit

### Screen 2: First Stakeholder Perspective
- Shows a harm-side perspective card (selected to match the profile — e.g., someone emphasising protection if the profile is vulnerability-sensitive)
- After reading, shows a mid-decision question with the same approve/decline buttons
- Proceeds on submit

### Screen 3: Second Perspective + Final Decision
- Shows a benefit-side perspective card
- Asks final decision (approve/decline) + final confidence + influence rating (1–5)
- "How much did hearing these perspectives shift your thinking?"
- Submit → completes Block 4

### Perspective Selection Logic
- If `protectsVulnerableStrongly` → first perspective is a worker in difficult circumstances
- If `wealthContextPermissivenessScore ≥ 0.6` → first perspective challenges the wealth-context reasoning
- Otherwise → default harm-side perspective
- Second perspective is always a benefit-side view (organisation/shareholder)

### Output: `Block4CompletionPayload`
```ts
{
  decisions: Block4DecisionRecord,  // { initialDecision, midDecision, finalDecision, confidence }
  influenceRating: number,          // 1-5
  stakeholderPerspectivesShown: string[],
  scenarioContext: ScenarioContext,
  seedCase: SeedCase,
}
```

---

## Seed Case Selection (scenarioSelection.ts)

`selectSeedCase(profile)` picks the **single most salient decision** from Blocks 1–3 to use as the framing anchor for the insights page and Block 4. Priority order:

1. **Refused all low-buffer products** → seed from Block 3 (firm boundary around vulnerable workers)
2. **Refused bridge** → seed from Block 2 bridge (strong reluctance to cause direct harm)
3. **Protects vulnerable strongly** → seed from Block 1 shelter context (context-sensitive money morality)
4. **Directness aversion present but lever accepted** → seed from Block 2 lever (directness of action matters)
5. **Default** → seed from Block 1 sidewalk (baseline money morality)

---

## Threshold Tree (thresholdTree.ts)

`buildThresholdTree(profile, aiResults, block4)` computes a ranked 7-dimension sensitivity index used on the Final Analysis page.

### Dimensions (ranked by score, high to low)
| # | Key | Source |
|---|-----|--------|
| 1 | `directness` | Block 2 bridge vs lever gap |
| 2 | `worker_vulnerability` | Block 3 LB vs HB average (Vulnerability protection sensitivity) |
| 3 | `group_size` | Block 3 spread across sizes |
| 4 | `context` | Block 1 sidewalk/wealthy + Block 3 LB vs HB |
| 5 | `gain_responsiveness` | Block 3 overall average index (inverted) |
| 6 | `stakeholder_shift` | Block 4 decision changes |
| 7 | `outcome_aggregation` | Block 2 scale + Block 3 size spread |

### Overall Sensitivity Index
Rank-weighted composite of the 7 dimension scores. Weights: `[0.22, 0.18, 0.16, 0.14, 0.12, 0.10, 0.08]` (highest-scoring dimension gets highest weight).

---

## Final Analysis (finalAnalysis.ts)

`generateFinalAnalysis(profile, decisions)` produces a plain-language report with:

| Field | Content |
|-------|---------|
| `alignmentNote` | Compares initial vs final Block-4 decision; notes if mid-decision shifted |
| `consistencyNote` | Plain-language description of the consistency score |
| `sensitivityNotes[]` | Up to 5 bullet observations from profile flags |
| `tentativeStyle` | One of four labels (see below) |
| `caveats[]` | 2–3 standard disclaimers |

### Tentative Moral Style Classification
`classifyStyle(profile, decisions)` assigns one of four labels based on a priority-ordered set of conditions:

1. **"high reluctance to sacrificial harm"** — refused bridge AND harmReluctance ≥ 0.65
2. **"more rule-focused / deontological-leaning"** — directnessAversion ≥ 0.65 AND protectsVulnerable
3. **"more outcome-focused / utilitarian-leaning"** — scaleSensitivity ≥ 0.55 AND harmReluctance ≤ 0.45 AND accepted bridge
4. **"mixed or context-sensitive"** — any other case, including if Block-4 decision changed or low consistency

---

## Final Analysis Page (FinalMoralAnalysisPage.tsx)

The last page of the experiment. Shows:
- Block-4 decision alignment note
- Consistency across domains note
- Sensitivity observations (bulleted)
- Ranked Threshold Tree (7 dimensions with scores and rationale)
- Block-3 threshold matrix recap
- Tentative moral style label
- "Explore the numbers" accordion (ProfileCalculationModal)
- Caveats section
- "Start Over" button (clears all experiment localStorage and reloads)

---

## Shared UI Components

### GlowSpan (`GlowSpan.tsx`)
An inline `<Text as="span">` that plays a one-shot CSS `text-shadow` animation (`glow-pulse`) when its `glowKey` prop increments above 0.

- `glowKey: number` — increment this to trigger a glow; keep at 0 to suppress (e.g. on initial mount)
- `glowColor: string` — Chakra token like `"green.400"`; resolved to a CSS variable (`--glow-c`) for use in the keyframe
- The `@keyframes glow-pulse` definition lives in `index.html` (not in Chakra's css-in-js) to prevent the keyframe body from being stripped

**Usage pattern in blocks:**
```ts
const prevValue = useRef<string | null>(null);
const glowKey = useRef(0);
const [, forceRender] = useState(0);

useEffect(() => {
  if (prevValue.current !== null && prevValue.current !== currentValue) {
    glowKey.current += 1;
    forceRender(n => n + 1);
  }
  prevValue.current = currentValue;
}, [currentValue]);

// In JSX:
<GlowSpan glowKey={glowKey.current} glowColor="green.400">
  {currentValue}
</GlowSpan>
```

### ProgressBar (`ProgressBar.tsx`)
A row of filled/unfilled pill indicators. Props: `total` (total steps) and `current` (how many are filled).

### ProfileCalculationModal (`ProfileCalculationModal.tsx`)
A detailed modal (dialog) showing all 6 profile score calculations with the raw data, formulas, and results. Accessible from the Insights page via a "show calculation" button.

### RankedThresholdTree (`RankedThresholdTree.tsx`)
Displays the 7-dimension tree with an overall sensitivity index badge, primary-driver badge, and a card for each dimension showing score, rationale, and derivation formula.

---

## Data Persistence (localStorage)

| Key | What is stored |
|-----|---------------|
| `money_block_results` | `MoneyBlockResults` — Block 1 final results |
| `trolley_block_results` | `TrolleyBlockResults` — Block 2 final results |
| `product_launch_block_results` | `ProductLaunchBlockResults` — legacy alias for Block 3 |
| `ai_workforce_block_results` | `AIWorkforceBlockResults` — Block 3 final results |
| `ai_workforce_block_progress` | `InProgressState` — Block 3 mid-block state (resumable) |
| `experiment_flow_stage` | Current stage name (never a transition stage) |
| `experiment_flow_insights` | `InsightsPayload` — profile + seedCase + analysis |
| `block4_reflection_results` | `Block4CompletionPayload` — Block 4 completion data |

### Session vs. Local Storage
- `sessionStorage["experiment_participant_id"]` — UUID generated once per browser session; a new tab = new participant = all `localStorage` experiment keys are cleared on creation of a new session ID

---

## Block 5 — Public Emergency Simulation

**Files:** `Block5PublicEmergencySimulation.tsx`, `block5Scenarios.ts`, `block5Ranking.ts`, `block5Profile.ts`, `block5Meters.tsx`, `block5Types.ts`

### Purpose

Block 5 presents three real-world public emergency scenarios. For each scenario, the participant is shown 5 policy options that have been **ranked according to their personal moral sensitivity profile** (derived from Blocks 1–4). The participant then chooses which policy they would implement.

This tests whether participants act consistently with their measured moral sensitivities when facing applied policy decisions — or whether they prioritise different values in high-stakes emergency contexts.

### How the Block 5 Profile is Built

Before Block 5 begins, the system:

1. Reads the 7-dimension threshold tree (built after Block 4)
2. Maps each tree dimension to a Block 5 sensitivity key via `block5Profile.ts`
3. Extracts rank, score, and weight for each dimension
4. Identifies the top 3 sensitivities and the primary (top-1) sensitivity
5. Passes this `Block5UserProfile` to the simulation component

**Dimension mapping:**

| Threshold Tree Key | Block 5 Sensitivity Key | Label |
|---|---|---|
| `directness` | `directnessSensitivity` | Directness sensitivity |
| `worker_vulnerability` | `vulnerabilityProtectionSensitivity` | Vulnerability protection sensitivity |
| `group_size` | `groupSizeSensitivity` | Group-size sensitivity |
| `context` | `contextSensitivity` | Context sensitivity |
| `gain_responsiveness` | `gainResponsivenessSensitivity` | Gain responsiveness sensitivity |
| `stakeholder_shift` | `stakeholderPerspectiveShiftSensitivity` | Stakeholder perspective shift sensitivity |
| `outcome_aggregation` | `outcomeAggregationSensitivity` | Outcome-aggregation sensitivity |

### The Three Scenarios

#### Scenario 1: Limited Cancer Treatment Allocation (Red theme)

**Context:** A hospital system has access to a promising new cancer treatment, but the supply is far too limited for all patients who could benefit this month. You are part of the emergency allocation team.

**Options:**

| # | Option | Key Fingerprint Highlights |
|---|--------|---------------------------|
| 1 | **Prioritize patients with highest expected survival gain** | High outcome-aggregation (95), high gain-responsiveness (80), low vulnerability-protection (30) |
| 2 | **Prioritize medically and socially vulnerable patients** | High vulnerability-protection (95), moderate directness (70), low gain-responsiveness (35) |
| 3 | **Use a weighted lottery with extra priority for vulnerable patients** | High stakeholder-shift (85), high directness (82), balanced vulnerability-protection (75) |
| 4 | **Reserve part of supply for hard-to-reach high-risk patients** | High context (88), high vulnerability-protection (78), moderate directness (68) |
| 5 | **Use first-come, first-served allocation** | High directness (88), low across all other dimensions (20–35) |

#### Scenario 2: Flood Evacuation Priority (Green theme)

**Context:** Severe flooding is approaching several neighborhoods, and evacuation resources are limited. There are not enough buses, rescue teams, or hours left to evacuate everyone immediately.

**Options:**

| # | Option | Key Fingerprint Highlights |
|---|--------|---------------------------|
| 1 | **Evacuate the largest neighborhoods first** | High group-size (95), high outcome-aggregation (90), low vulnerability-protection (35) |
| 2 | **Evacuate hospitals, elderly, disabled, low-mobility families first** | High vulnerability-protection (98), moderate context (70), low gain-responsiveness (30) |
| 3 | **Evacuate the highest-risk flood zones first** | High directness (92), high context (95), moderate vulnerability-protection (60) |
| 4 | **Use a balanced mixed plan** | High stakeholder-shift (88), high context (85), balanced across dimensions (75–82) |
| 5 | **Keep a reserve fleet for secondary flooding** | High context (90), moderate across others (50–70) |

#### Scenario 3: Water Contamination Response (Blue theme)

**Context:** A city discovers dangerous contamination in its water system. Officials cannot protect every area and every institution at once. You must choose the first phase of protection.

**Options:**

| # | Option | Key Fingerprint Highlights |
|---|--------|---------------------------|
| 1 | **Protect hospitals, schools, elder-care, dialysis centers first** | High vulnerability-protection (97), moderate directness (72), low gain-responsiveness (35) |
| 2 | **Shut off highest-contamination zones + deliver emergency water** | High directness (95), high context (92), moderate vulnerability-protection (72) |
| 3 | **Protect the largest neighborhoods first** | High group-size (96), high outcome-aggregation (92), low vulnerability-protection (38) |
| 4 | **Citywide boil-water advisory + targeted high-risk delivery** | High vulnerability-protection (88), high context (87), high stakeholder-shift (82) |
| 5 | **Stabilize central treatment plant to restore system-wide safety** | High outcome-aggregation (86), high group-size (84), moderate context (78) |

### Ranking Mechanism

Each option has a **fingerprint** — a set of 7 scores (0–100) representing how strongly that option aligns with each sensitivity dimension. The ranking algorithm (`block5Ranking.ts`) works as follows:

#### Step 1: Gate Filtering

An option "passes the gate" for a dimension if:
```
optionScore >= max(30, userScore - 25)
```

An option becomes a **candidate** if it passes BOTH:
- The gate for the user's #1 sensitivity (top key)
- At least 2 of the user's top 3 sensitivities

#### Step 2: Weighted Fit Scoring

For each option, a weighted fit score (0–100) is calculated:
```
For each of the 7 dimensions:
  match_i = 100 - |userScore_i - optionScore_i|
  weightedFit += match_i × weight_i

Bonuses/penalties:
  +5 if ALL top 3 gates pass
  -8 if top-1 gate fails

fitScore = clamp(0, 100, round(weightedFit))
```

#### Step 3: Ranking

1. Separate options into **candidates** (passed gates) and **non-candidates**
2. Sort each group by fit score (highest first)
3. Final ranking = candidates first, then non-candidates
4. Assign rank 1–5

#### Step 4: Explanation Generation

For each option, the system generates:
- **Top match reasons:** The 3 dimensions with highest match percentage
- **Tension points:** Dimensions where match < 60% (indicates poor fit on that dimension)
- **Gate results:** Pass/fail for each of the 7 dimensions
- **Closeness label:** Human-readable label based on fit score

| Fit Score Range | Label |
|---|---|
| 90–100 | Very close match |
| 75–89 | Close match |
| 55–74 | Moderate mismatch |
| 35–54 | Notable mismatch |
| 0–34 | Far from your profile |

### User Interface

The simulation presents each scenario as a full-page immersive experience:

- **Left panel:** Scenario description + the participant's top 3 sensitivities with scores
- **Right panel:** 5 ranked option cards showing:
  - Rank position (#1–#5)
  - Title and summary
  - Fit score percentage
  - Candidate badge (if applicable)
  - Expandable "Why is this ranked here?" section containing:
    - Gate pass/fail indicators for top 3 sensitivities
    - Tension points
    - Full 7-dimension meter breakdown (bar visualisation comparing option vs user score)

### Data Collected

For each of the 3 scenarios, Block 5 records:

```ts
{
  scenarioId: string,              // e.g., "cancer_treatment_allocation"
  selectedOptionId: string,        // ID of the option the participant chose
  selectedRank: number,            // What rank was their selection? (1 = top-ranked)
  topRankedOptionId: string,       // ID of the #1 ranked option
  selectedWasTopCandidate: boolean,// Did they pick the #1 option?
  selectedWasCandidate: boolean,   // Did they pick any candidate?
  rankedOptionIds: string[],       // Full ranking order
  fitScoresByOptionId: Record<string, number>,      // Fit scores for all options
  candidateStatusByOptionId: Record<string, boolean>, // Candidate status for all options
  viewedExplanationOptionIds: string[],  // Which "why" explanations were expanded
  timeMs: number,                  // Time spent on this scenario (ms)
}
```

### Output: `Block5Results`

```ts
{
  completed: boolean,
  completedAt: string,
  userProfile: Block5UserProfile,   // The profile used for ranking
  scenarioResults: Block5ScenarioResult[],  // Array of 3 scenario results
}
```

### Progress Persistence

Block 5 saves progress to localStorage under `block5_public_emergency_progress` after each scenario is completed. A page refresh resumes at the next uncompleted scenario.

---

## Block 5 Summary Page (Block5SimulationSummaryPage.tsx)

After all 3 scenarios are completed, the summary page shows:

1. **Sensitivity profile recap** — The participant's top sensitivities used for ranking
2. **Per-scenario panels** showing:
   - The option they selected (with checkmark)
   - What rank that option held
   - The top-ranked option (if different from their selection)
   - An **alignment note** describing the relationship between their choice and their measured profile:
     - "Aligned with top candidate" — chose the #1 ranked option
     - "Chose a candidate option" — chose a candidate but not the #1
     - "Near-top option" — rank 2–3, not a candidate
     - "Different trade-off" — chose a lower-ranked / non-candidate option
3. **Finish button** — clears all experiment localStorage and reloads the page

---

## Data Collected Per Block — Summary

### Block 1: Found Money Decisions

| Data Point | Type | Description |
|---|---|---|
| `thresholds.threshold_sidewalk` | `ThresholdResult` | Amount index where participant kept money (neutral context) |
| `thresholds.threshold_wealthy` | `ThresholdResult` | Amount index (wealthy district context) |
| `thresholds.threshold_shelter` | `ThresholdResult` | Amount index (homeless shelter context) |
| `history` | `MoneyChoiceRecord[]` | Every button click: context, amount, action, timestamp |
| `completed` / `completedAt` | boolean / string | Completion metadata |

**Key derived value:** The *gap* between shelter threshold and sidewalk threshold indicates vulnerability sensitivity; the gap between wealthy and sidewalk indicates wealth-context permissiveness.

### Block 2: Trolley Problem

| Data Point | Type | Description |
|---|---|---|
| `leverThreshold` | `LeverThresholdResult` | Index of lives-at-risk value where participant pulled the lever |
| `bridgeThreshold` | `BridgeThresholdResult` | Index where participant pushed the person off the bridge |
| `summary.directnessGap` | `number \| null` | Bridge threshold − lever threshold (positive = directness aversion) |
| `summary.consistencyAtSameNumber` | `boolean \| null` | Did they also accept the bridge at the lever's threshold? |
| `history` | `TrolleyChoiceRecord[]` | Every button click with phase, value, action, timestamp |

**Key derived values:** `directnessAversionScore` (gap between bridge and lever), `harmReluctanceScore` (average of both indices).

### Block 3: AI Workforce Rollout

| Data Point | Type | Description |
|---|---|---|
| `thresholds` (6 entries) | `AIWorkforceThresholdResult` | Gain index for each of 2 worker groups × 3 sizes |
| `history` | `AIWorkforceChoiceRecord[]` | Every approve/reject decision with group, size, gain, timestamp |

**Key derived values:**
- `avgLB` (average threshold index for low-buffer workers)
- `avgHB` (average threshold index for high-buffer workers)
- Gap `avgLB − avgHB` = vulnerability protection sensitivity
- Spread across sizes = group-size sensitivity
- Overall average = gain responsiveness (inverted)

### Block 4: Adaptive Stakeholder Reflection

| Data Point | Type | Description |
|---|---|---|
| `decisions.initialDecision` | `"approve" \| "decline"` | Decision before any perspective |
| `decisions.midDecision` | `"approve" \| "decline"` | Decision after first (harm-side) perspective |
| `decisions.finalDecision` | `"approve" \| "decline"` | Decision after second (benefit-side) perspective |
| `decisions.initialConfidence` | `number (1–5)` | Confidence at initial decision |
| `decisions.finalConfidence` | `number (1–5)` | Confidence at final decision |
| `influenceRating` | `number (1–5)` | Self-reported influence of perspectives |
| `stakeholderPerspectivesShown` | `string[]` | IDs of the 2 perspectives displayed |
| `scenarioContext` / `seedCase` | objects | Which scenario/context was personalised for this participant |

**Key derived value:** Count of decision shifts between the 3 decision points (0, 1, or 2) = stakeholder-voice responsiveness.

### Block 5: Public Emergency Simulation

| Data Point | Type | Description |
|---|---|---|
| `userProfile` | `Block5UserProfile` | The full 7-dimension profile used for ranking |
| `scenarioResults[i].selectedOptionId` | `string` | Which policy was chosen |
| `scenarioResults[i].selectedRank` | `number` | Rank of the chosen option (1 = top) |
| `scenarioResults[i].selectedWasCandidate` | `boolean` | Whether the choice was a "candidate" option |
| `scenarioResults[i].viewedExplanationOptionIds` | `string[]` | Which explanations were examined |
| `scenarioResults[i].timeMs` | `number` | Time spent on scenario (ms) |
| `scenarioResults[i].fitScoresByOptionId` | `Record<string, number>` | All fit scores |
| `scenarioResults[i].rankedOptionIds` | `string[]` | Full ranking order |

---

## How Collected Data Flows Between Blocks

### Block 1 → Profile Analysis

```
sidewalkIdx, wealthyIdx, shelterIdx (0-based threshold indices)
  ↓
vulnerabilitySensitivityScore = 0.5 + 0.5 × (0.5 × vulnProductGap + 0.5 × moneyVulnGap)
wealthContextPermissivenessScore = 0.5 + 0.5 × (sidewalkIdx/STEPS − wealthyIdx/STEPS)
```

### Block 2 → Profile Analysis

```
leverIdx, bridgeIdx (0-based acceptance indices; STEPS if never accepted)
  ↓
harmReluctanceScore = 0.5 × leverIdx/STEPS + 0.5 × bridgeIdx/STEPS
directnessAversionScore = (bridgeIdx − leverIdx)/STEPS + 0.5
```

### Block 3 → Profile Analysis + Threshold Tree

```
6 threshold indices (LB_small, LB_medium, LB_large, HB_small, HB_medium, HB_large)
  ↓
avgLB = average of 3 low-buffer indices
avgHB = average of 3 high-buffer indices
spreadLB = max(LB indices) − min(LB indices)
spreadHB = max(HB indices) − min(HB indices)
  ↓
vulnerabilityProtectionSensitivity = 100 × (0.5 + 0.5 × (avgLB − avgHB) / GAIN_STEPS)
groupSizeSensitivity = 100 × (spreadLB + spreadHB) / 2 / GAIN_STEPS
gainResponsiveness = 100 × (1 − (avgLB + avgHB) / 2 / GAIN_STEPS)
```

### Block 4 → Threshold Tree

```
initialDecision, midDecision, finalDecision
  ↓
shiftCount = (initial ≠ mid ? 1 : 0) + (mid ≠ final ? 1 : 0)
stakeholderVoiceResponsiveness = 100 × shiftCount / 2
```

### Threshold Tree → Block 5

```
7 dimension scores (0–100) + ranks + weights
  ↓
Block5UserProfile (top 3 keys, primary key, ranked dimensions)
  ↓
For each scenario: rankOptions(options, profile)
  ↓
Personalised ranking of 5 options per scenario
```

---

## Calculation Equations Reference

### Profile Analysis (profileAnalysis.ts)

```
MONEY_STEPS = 8    (number of money amounts)
TROLLEY_STEPS = 8  (number of lives options)
GAIN_STEPS = 6     (number of financial gain options in Block 3)

vulnerabilitySensitivityScore:
  moneyVulnGap = (shelterIdx - sidewalkIdx) / MONEY_STEPS
  productVulnGap = (avgLB - avgHB) / GAIN_STEPS   [using Block 3 data]
  score = 0.5 + 0.5 × (0.5 × productVulnGap + 0.5 × moneyVulnGap)
  Clamped to [0, 1]

wealthContextPermissivenessScore:
  score = 0.5 + 0.5 × (sidewalkIdx/MONEY_STEPS − wealthyIdx/MONEY_STEPS)
  Clamped to [0, 1]

harmReluctanceScore:
  score = 0.5 × (leverIdx/TROLLEY_STEPS) + 0.5 × (bridgeIdx/TROLLEY_STEPS)
  Clamped to [0, 1]

directnessAversionScore:
  score = (bridgeIdx − leverIdx) / TROLLEY_STEPS + 0.5
  Clamped to [0, 1]

scaleSensitivityScore:
  vulnIndices = [LB_small, LB_medium, LB_large]
  score = (max(vulnIndices) − min(vulnIndices)) / GAIN_STEPS
  Clamped to [0, 1]

consistencyAcrossDomainsScore:
  signal1 = (shelterIdx − sidewalkIdx) / MONEY_STEPS
  signal2 = (avgLB − avgHB) / GAIN_STEPS
  signal3 = harmReluctanceScore (from Block 2)
  score = 1 − sqrt(variance(signal1, signal2, signal3)) × 2
  Clamped to [0, 1]
```

### Threshold Tree (thresholdTree.ts)

```
Dimension 1 — Directness sensitivity:
  score = clamp(0, 100,  100 × directnessAversionScore)

Dimension 2 — Vulnerability protection sensitivity:
  score = clamp(0, 100,  100 × (0.5 + 0.5 × (avgLB − avgHB) / GAIN_STEPS))

Dimension 3 — Group-size sensitivity:
  avgSpread = (spreadLB + spreadHB) / 2
  score = clamp(0, 100,  100 × avgSpread / GAIN_STEPS)

Dimension 4 — Context sensitivity:
  contextBlock1 = wealthContextPermissivenessScore [0–1]
  contextBlock3 = |avgLB − avgHB| / GAIN_STEPS
  score = clamp(0, 100,  100 × (0.5 × contextBlock1 + 0.5 × contextBlock3))

Dimension 5 — Gain responsiveness:
  overallAvg = (avgLB + avgHB) / 2
  score = clamp(0, 100,  100 × (1 − overallAvg / GAIN_STEPS))

Dimension 6 — Stakeholder-voice responsiveness:
  shiftCount = number of decision changes in Block 4 (0, 1, or 2)
  score = clamp(0, 100,  100 × shiftCount / 2)

Dimension 7 — Outcome-aggregation sensitivity:
  score = clamp(0, 100,  100 × (0.5 × scaleSensitivityScore + 0.5 × avgSpread / GAIN_STEPS))

Overall Sensitivity Index:
  Sort dimensions by score (highest first)
  Weights = [0.22, 0.18, 0.16, 0.14, 0.12, 0.10, 0.08]
  overallIndex = sum(score_i × weight_i) for ranks 1–7
```

### Block 5 Ranking (block5Ranking.ts)

```
Gate test for dimension k:
  passes = optionScore_k >= max(30, userScore_k - 25)

Candidate status:
  isCandidate = passesGate(topKey) AND (count of top3 gates passed >= 2)

Weighted fit score:
  For each dimension k:
    match_k = 100 - |userScore_k - optionScore_k|
    weightedFit += match_k × weight_k
  
  Bonus: +5 if all top 3 gates pass
  Penalty: -8 if top-1 gate fails
  
  fitScore = clamp(0, 100, round(weightedFit))

Final ranking:
  candidates sorted by fitScore DESC, then non-candidates sorted by fitScore DESC
```

---

## Shared UI Components

### GlowSpan (`GlowSpan.tsx`)
An inline `<Text as="span">` that plays a one-shot CSS `text-shadow` animation (`glow-pulse`) when its `glowKey` prop increments above 0.

- `glowKey: number` — increment this to trigger a glow; keep at 0 to suppress (e.g. on initial mount)
- `glowColor: string` — Chakra token like `"green.400"`; resolved to a CSS variable (`--glow-c`) for use in the keyframe
- The `@keyframes glow-pulse` definition lives in `index.html` (not in Chakra's css-in-js) to prevent the keyframe body from being stripped

**Usage pattern in blocks:**
```ts
const prevValue = useRef<string | null>(null);
const glowKey = useRef(0);
const [, forceRender] = useState(0);

useEffect(() => {
  if (prevValue.current !== null && prevValue.current !== currentValue) {
    glowKey.current += 1;
    forceRender(n => n + 1);
  }
  prevValue.current = currentValue;
}, [currentValue]);

// In JSX:
<GlowSpan glowKey={glowKey.current} glowColor="green.400">
  {currentValue}
</GlowSpan>
```

### ProgressBar (`ProgressBar.tsx`)
A row of filled/unfilled pill indicators. Props: `total` (total steps) and `current` (how many are filled).

### ProfileCalculationModal (`ProfileCalculationModal.tsx`)
A detailed modal (dialog) showing all 6 profile score calculations with the raw data, formulas, and results. Accessible from the Insights page via a "show calculation" button.

### RankedThresholdTree (`RankedThresholdTree.tsx`)
Displays the 7-dimension tree with an overall sensitivity index badge, primary-driver badge, and a card for each dimension showing score, rationale, and derivation formula.

### SensitivityMeterBar (`block5Meters.tsx`)
Horizontal bar visualisation used in Block 5 showing:
- Option's score as a coloured fill (0–100%)
- User's profile score as a white vertical marker line
- Closeness label text

---

## Data Persistence (localStorage)

| Key | What is stored |
|-----|---------------|
| `money_block_results` | `MoneyBlockResults` — Block 1 final results |
| `trolley_block_results` | `TrolleyBlockResults` — Block 2 final results |
| `product_launch_block_results` | `ProductLaunchBlockResults` — legacy alias for Block 3 |
| `ai_workforce_block_results` | `AIWorkforceBlockResults` — Block 3 final results |
| `ai_workforce_block_progress` | `InProgressState` — Block 3 mid-block state (resumable) |
| `experiment_flow_stage` | Current stage name (never a transition stage) |
| `experiment_flow_insights` | `InsightsPayload` — profile + seedCase + analysis |
| `block4_reflection_results` | `Block4CompletionPayload` — Block 4 completion data |
| `block5_public_emergency_progress` | `number` — Index of next uncompleted Block 5 scenario |
| `block5_public_emergency_results` | `Block5Results` — Block 5 final results |

### Session vs. Local Storage
- `sessionStorage["experiment_participant_id"]` — UUID generated once per browser session; a new tab = new participant = all `localStorage` experiment keys are cleared on creation of a new session ID

---

## Storage (LocalStorage only; MongoDB-ready)

The app persists **exclusively to `localStorage`** — there is no active database. Supabase and the
Bolt scaffolding have been **removed entirely**: the `@supabase/supabase-js` dependency, `src/lib/supabase.ts`,
the `supabase/migrations` SQL files, the `.bolt/` config, and the `bolt.new` meta tags are all gone.

Each block writes one analysis-ready results object (carrying `participantId` + `completedAt`) under a
canonical key (`money_block_results`, `trolley_block_results`, `ai_workforce_block_results`,
`block4_reflection_results`, `block5_public_emergency_results`). These map 1:1 to future MongoDB
collections — see `USER_VALUE_PROFILE_MODEL.md` §10. To add MongoDB later, introduce a thin persistence
layer that ships these same objects; no scoring code needs to change.

---

## Key Design Decisions

1. **No authentication.** Participant identity is a UUID in `sessionStorage`; a new session is a new participant.

2. **Carry-forward index in Block 3.** When a participant approves at gain index N for a small group, the medium group starts testing at index N (not index 0). This avoids trivially re-showing amounts already rejected and captures whether scale changes the threshold.

3. **Blocking in Block 3.** If a participant never approves even at the highest gain ($100M), all larger sizes in the same worker group are automatically recorded as blocked. This is both a time-saving measure and a logical implication: higher stakes make approval less likely, not more.

4. **Separate glow counters per field in Blocks 1–3.** Only the specific text value that changed should glow; unchanged sibling values must not animate even though the parent component re-renders.

5. **Transition stages prevent refresh-on-spinner.** Transition stage names are listed in `STAGES_WITH_TRANSITION` and are never persisted; `getRestoredStage()` rolls back to `"money"` if a persisted stage is a transition stage.

6. **The `@keyframes` definition lives in `index.html`.** Chakra UI's css-in-js pipeline strips the body from `@keyframes` rules defined in the `css` prop, producing empty keyframes. Moving the definition to a plain `<style>` tag in the document head prevents this.

7. **Block 4 always revisits the AI workforce context.** `selectDomain()` always returns `DOMAINS.ai_workforce_rollout`; other domain types exist in `scenarioSelection.ts` but are not currently activated.

8. **Block 5 fingerprint-based ranking.** Each policy option carries a pre-assigned 7-dimension fingerprint. Ranking is computed dynamically against the participant's profile, so two participants with different moral profiles see the same options in different orders.

9. **Gate + weighted-fit dual system in Block 5.** The gate filter ensures minimum alignment on the participant's top sensitivities, while the weighted fit score provides a nuanced continuous ranking. This prevents options that fail hard constraints from ranking highly due to incidental fit on minor dimensions.

10. **Fallback stage recovery.** If the app is restored to a stage that requires in-memory data (e.g., `final_analysis` without `insights`), it falls back to the beginning (`"money"`) rather than showing a blank page.
