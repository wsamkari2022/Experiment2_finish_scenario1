/**
 * block5Types.ts — Type definitions for Block 5: Public Emergency Simulation.
 *
 * Block 5 uses the participant's 7-dimension moral sensitivity profile (derived
 * from Blocks 1–4) to evaluate policy options in emergency scenarios.
 *
 * v3 (CVR Cube) additions — see the Scenario 1 Master Spec:
 *  - Alignment is now a 4-LEVEL label (aligned / weakly / misaligned / strongly),
 *    computed from only the 4 POLICY-FIT dimensions. Options are NEVER removed.
 *  - The 3 presentation dimensions (context, directness, stakeholder) drive the
 *    CVR vignette (framing + who appears), not the ranking.
 *  - Each option carries 5 PERFORMANCE metrics describing what it achieves (see METRIC_DEFS).
 *  - Endorsing a misaligned choice updates the profile (carried to later scenarios).
 *  - Two measures: graded VCI (current profile) + Stability (original profile).
 */

export type Block5SensitivityKey =
  | "directnessSensitivity"
  | "vulnerabilityProtectionSensitivity"
  | "groupSizeSensitivity"
  | "contextSensitivity"
  | "gainResponsivenessSensitivity"
  | "stakeholderPerspectiveShiftSensitivity"
  | "outcomeAggregationSensitivity";

/** The 4 dimensions used to measure POLICY FIT (alignment). Subset of the 7. */
export type Block5PolicyDimKey =
  | "vulnerabilityProtectionSensitivity"
  | "groupSizeSensitivity"
  | "gainResponsivenessSensitivity"
  | "outcomeAggregationSensitivity";

export const POLICY_DIM_KEYS: Block5PolicyDimKey[] = [
  "vulnerabilityProtectionSensitivity",
  "groupSizeSensitivity",
  "gainResponsivenessSensitivity",
  "outcomeAggregationSensitivity",
];

export const POLICY_DIM_SHORT: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "protecting the vulnerable",
  groupSizeSensitivity: "reducing harm",
  gainResponsivenessSensitivity: "how much is gained",
  outcomeAggregationSensitivity: "how many are helped",
};

/** Plain-English hover explanation of each policy value (shown in the sidebar tooltip). */
/*
 * WHY THESE FOUR SENTENCES ARE WORDED THE WAY THEY ARE.
 *
 * The last two describe different things — the SIZE of a benefit and the NUMBER of people it
 * reaches — and both used to end "...before you accept the cost?". Two questions with the same
 * shape and the same ending read as one question asked twice, and a participant who cannot tell
 * them apart cannot use either.
 *
 * "Reducing harm" also carried a worked example ("10 rather than 100,000") that made a reader
 * stop and do arithmetic in the middle of a definition.
 *
 * Each one now names the thing it responds to, in the fewest words that stay true to what Blocks
 * 1-3 actually measured. See docs/VRDS_EXPERIMENT_GUIDE.md §3 for the source of each.
 */
export const POLICY_DIM_EXPLAIN: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity:
    "How far you go to protect the people least able to cope — even when other people would gain more.",
  groupSizeSensitivity:
    "How much it matters to you that fewer people end up hurt.",
  gainResponsivenessSensitivity:
    "How strongly the SIZE of the benefit moves you.",
  outcomeAggregationSensitivity:
    "How strongly the NUMBER of people helped moves you.",
};

/**
 * WHAT A HIGH BAR MEANS, per value.
 *
 * WHY THIS EXISTS. The old name "How many are harmed" read, to a participant seeing a long bar, as "this
 * option harms a lot of people" — the exact opposite of what it encodes. Every fingerprint in this
 * codebase is oriented HIGHER = BETTER, including the two whose names are nouns for bad things.
 * A participant who misreads the direction on one bar misreads the whole panel, and would then be
 * choosing against their own values while believing they were following them.
 *
 * Phrased as a completion of "Higher means …", in plain words, and shown under every bar.
 */
export const POLICY_DIM_HIGHER_MEANS: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity:
    "Higher means MORE protection for the people least able to cope.",
  groupSizeSensitivity:
    "Higher means MORE harm is prevented.",
  gainResponsivenessSensitivity:
    "Higher means MORE is gained from the decision.",
  outcomeAggregationSensitivity:
    "Higher means MORE people are helped.",
};

/** 4-level alignment label (internal — options are never hidden). */
export type AlignmentLevel =
  | "aligned"
  | "weakly_aligned"
  | "misaligned"
  | "strongly_misaligned";

/**
 * Rank-based label rule (v3.3): labels are assigned by an option's RANK within the scenario,
 * not by absolute score cutoffs — this guarantees a spread for any profile. The top `aligned`
 * options become Aligned, the next `weaklyAligned` become Weakly aligned, then the better half
 * of the remaining options become Misaligned and the worse half Strongly misaligned. For 6
 * options this yields a balanced 1 Aligned / 1 Weakly / 2 Misaligned / 2 Strongly. CVR fires on
 * Misaligned / Strongly. Tune the shape here (e.g. aligned: 2) — no per-run band tuning needed.
 */
export const ALIGNMENT_RANK_RULE = { aligned: 1, weaklyAligned: 1 } as const;

/**
 * ============================================================================
 * PERFORMANCE METRICS — what an OPTION achieves, never what the participant values.
 * ============================================================================
 *
 * WHY THESE FIVE AND NOT THE PREVIOUS EIGHT
 * -----------------------------------------
 * The original eight were authored as a mirror of the option fingerprints. Measured across the
 * 30 authored options, "Vulnerable Protection" correlated r = 0.98 with the participant's
 * vulnerability-protection VALUE, "Total Benefit" r = 0.80 with outcome aggregation, and
 * "Fairness / Equity" r = 0.80 with vulnerability again. They were not a second view of the
 * option; they were the same numbers under a second heading, and overall performance therefore
 * correlated r = 0.81 with the participant's own profile. Choosing your values was free.
 *
 * THE RULE THAT REPLACES THEM
 * ---------------------------
 *   The four VALUES ask *who* and *how much*.
 *   The METRICS ask *how well it went*.
 *
 * Two axes that cannot collapse into each other, because no metric names a group of people or a
 * quantity of good. That is what makes "did this participant trade moral alignment against
 * practical performance?" a real question rather than a tautology.
 *
 * WHY FIVE, NOT SIX
 * -----------------
 * A sixth, "Practicality" (effort to carry the option out), was authored and then dropped. Two
 * reasons, both fatal:
 *   1. It correlated r = 0.71 with Speed even after honest re-coding — fast options are usually
 *      also easy ones, so it was not carrying its own information.
 *   2. Its referent changed between scenarios. In travel and dinner it means effort on YOU; in
 *      the cancer, flood and water scenarios you are a decision-maker, not the executor, so it
 *      means effort on some organization. That is two constructs sharing a label — exactly the
 *      cross-scenario ambiguity the readings below exist to prevent.
 * The five that remain keep the same referent in all five scenarios.
 *
 * HIGHER IS ALWAYS BETTER, on every metric. "Resource use 85" means it uses LITTLE.
 *
 * SCORES ARE RELATIVE TO THE SITUATION, NOT ABSOLUTE
 * --------------------------------------------------
 * A score answers: among the six options available in THIS scenario, how well does this one do
 * on this construct? "Speed 90" in the cancer scenario does not claim treatment is as fast as a
 * flight; it claims this option starts treatment about as soon as anything could there. That is
 * what makes averaging across scenarios legitimate, and it is the same rule the Blocks 1-3
 * ladders already follow — only position within the instrument ever carries meaning.
 * Anchors: 90-100 best this situation allows / 70-85 clearly good / 50-65 middling /
 * 30-45 clearly poor / 10-25 the worst this situation allows.
 *
 * See docs/BLOCK5_METRIC_REDESIGN_PLAN.md for the full rationale and the acceptance gates,
 * and tools/validate_block5_metrics.mjs for the gates as executable checks.
 */
export type Block5MetricKey =
  | "speed"
  | "resourceUse"
  | "reliability"
  | "durability"
  | "reversibility";

export const METRIC_KEYS: Block5MetricKey[] = [
  "speed",
  "resourceUse",
  "reliability",
  "durability",
  "reversibility",
];

/** Scenario ids, used to pick the right reading for a metric. */
export type Block5ScenarioId =
  | "chemical_release_escape"
  | "wildfire_household_evacuation"
  | "cancer_treatment_allocation"
  | "care_rota_reduction"
  | "care_rota_receiving";

/**
 * One metric: a constant label, the construct it measures, and what that construct looks like in
 * each scenario.
 *
 * `readings` is the answer to "'Speed' in a travel scenario is not 'Speed' in a cancer
 * scenario". The CONSTRUCT is identical everywhere — latency of benefit delivery, input
 * consumed, outcome uncertainty, persistence, recoverability. Only the surface changes, and the
 * participant is shown the surface for the scenario they are actually in, so they are never left
 * guessing what a bar means here.
 */
export interface MetricDef {
  key: Block5MetricKey;
  /** Constant across scenarios — this is what makes the dashboard comparable. */
  label: string;
  /** The construct. Governs authoring; never shown to the participant. */
  invariant: string;
  /** Fallback wording when no scenario is in context. */
  hover: string;
  /** What this construct means in each scenario. Shown to the participant. */
  readings: Record<Block5ScenarioId, string>;
}

export const METRIC_DEFS: Record<Block5MetricKey, MetricDef> = {
  speed: {
    key: "speed",
    label: "Speed",
    invariant: "Latency of benefit delivery — how soon the help reaches the people it is for.",
    hover: "How soon the help actually reaches the people it is meant to help.",
    readings: {
      chemical_release_escape: "how soon you are out of the plume, and how much of the six hours is left",
      wildfire_household_evacuation: "how soon your household is clear of the valley",
      cancer_treatment_allocation: "how soon treatment begins for those who receive it",
      care_rota_reduction: "how soon the new schedule actually reaches clients and caregivers",
      care_rota_receiving: "how soon the new schedule actually reaches clients and caregivers",
    },
  },
  resourceUse: {
    key: "resourceUse",
    label: "Resource use",
    invariant: "How little of the limited supply the option consumes. Higher means leaner.",
    hover: "How little of the limited supply this uses — higher means leaner.",
    readings: {
      chemical_release_escape: "how little of the shuttle, the clinic stock and the crews it uses",
      wildfire_household_evacuation: "how little road capacity, fuel and crew time it ties up",
      cancer_treatment_allocation: "how little of the 20 doses and staff time it wastes",
      care_rota_reduction: "how little of the remaining caregiver-hours and budget it wastes",
      care_rota_receiving: "how little of the remaining caregiver-hours and budget it wastes",
    },
  },
  reliability: {
    key: "reliability",
    label: "Reliability",
    invariant: "Probability the intended outcome actually happens.",
    hover: "How likely this is to work as intended rather than go wrong.",
    readings: {
      chemical_release_escape: "how likely you are to get clear without the route failing",
      wildfire_household_evacuation: "how likely all four of you actually get out together",
      cancer_treatment_allocation: "how likely the treatment achieves what is hoped",
      care_rota_reduction: "how likely the schedule holds for the full three months",
      care_rota_receiving: "how likely the schedule holds for the full three months",
    },
  },
  durability: {
    key: "durability",
    label: "Durability",
    invariant: "Whether the benefit persists past the immediate moment.",
    hover: "Whether the benefit lasts beyond the immediate moment.",
    readings: {
      chemical_release_escape: "whether the way out stays open for the people still behind you",
      wildfire_household_evacuation: "whether it still works for the households leaving after you",
      cancer_treatment_allocation: "how long the benefit lasts, not just the first weeks",
      care_rota_reduction: "whether it still works after the three months are up",
      care_rota_receiving: "whether it still works after the three months are up",
    },
  },
  reversibility: {
    key: "reversibility",
    label: "Reversibility",
    invariant: "Recoverability — how easily course can be changed if the choice proves wrong.",
    hover: "If this turns out to be wrong, how easily you can change course.",
    readings: {
      chemical_release_escape: "whether you can turn round and take another way out",
      wildfire_household_evacuation: "whether you can change course once you have committed",
      cancer_treatment_allocation: "whether doses can be reallocated, or the decision is final",
      care_rota_reduction: "whether visits can be restored if it goes wrong",
      care_rota_receiving: "whether visits can be restored if it goes wrong",
    },
  },
};

/** Constant labels, for places that only need the name. */
export const METRIC_LABELS: Record<Block5MetricKey, string> = Object.fromEntries(
  METRIC_KEYS.map((k) => [k, METRIC_DEFS[k].label]),
) as Record<Block5MetricKey, string>;

/**
 * Scenario-aware definition line for a metric.
 *
 * Falls back to the scenario-independent wording when the scenario is unknown, so this can never
 * render an empty string.
 */
export function metricMeaning(key: Block5MetricKey, scenarioId?: string): string {
  const def = METRIC_DEFS[key];
  const reading = scenarioId ? def.readings[scenarioId as Block5ScenarioId] : undefined;
  return reading ?? def.hover;
}

export type Block5MetricProfile = Record<Block5MetricKey, number>;

export interface Block5UserProfileDimension {
  key: Block5SensitivityKey;
  label: string;
  score: number;
  rank: number;
  weight: number;
  sourceBlocks: string[];
}

export interface Block5UserProfile {
  generatedAt: string;
  dimensions: Block5UserProfileDimension[];
  topThreeKeys: Block5SensitivityKey[];
  topSensitivityKey: Block5SensitivityKey;
}

export type Block5OptionFingerprint = Record<Block5SensitivityKey, number>;

/**
 * v3.2: per-option "CVR seed" — the concrete material the CVR vignette re-presents.
 * The recontextualized scenario keeps the SAME trade-off (the option's rule against the
 * shared fact base), and the stakeholder vignette names a concrete, identified case + harm.
 */
export interface OptionCVRSeed {
  /** what the option does to the shared pool, phrased to follow "it …" (e.g. "gives them to the highest-odds patients"). */
  rule: string;
  /** the concrete, identified person/group the option leaves out (AHA, gender-neutral). */
  identifiedCase: string;
  /** the concrete harm that case experiences. */
  harm: string;
  /**
   * The person who NEEDS this option, shown when the participant refuses it. Written to follow the
   * voice lead, so it must describe what happens to "them" and must never name a new person.
   */
  benefitCase?: string;
  /** what that person loses because the option was refused. */
  benefitLost?: string;
  /**
   * WHAT THIS OPTION ACTUALLY CAUSES — the material the DIRECTNESS lens is built from.
   *
   * The option card sells the trade-off in the abstract ("you give up four hours"). These two
   * lines say what happens to real people because of it, and they are the things the card does
   * NOT show. One is immediate and one arrives long after anybody would still connect it to the
   * choice, because a consequence you never link back to your decision is exactly the kind the
   * directness lens exists to make visible.
   *
   * WRITING RULES, enforced by tools/validate_block5.cjs:
   *  - short sentences, common words. Participants read this in a second language.
   *  - name people and numbers, never categories ("two of them", not "some stakeholders").
   *  - state the outcome, never the judgment. The lens attributes; the sentence reports.
   */
  consequences?: {
    /** Within hours or days. What happens straight away. */
    soon: string;
    /** Weeks or months later. The part nobody connects back to the choice. */
    later: string;
  };
  /**
   * THE SAME TWO CONSEQUENCES, inside the scenario's parallel setting — for the CONTEXT lens.
   *
   * Written to the same rules and, deliberately, to the SAME SHAPE and roughly the same length as
   * `consequences` above. The study compares the two lenses against each other, so if one carried
   * two vivid consequences and the other carried one, the comparison would partly measure which
   * block was longer. Same structure, same time labels; the only things that differ are the
   * setting and whether the participant is named as the cause.
   */
  parallelConsequences?: {
    soon: string;
    later: string;
  };
  /**
   * THE SAME RULE, restated inside the scenario's parallel setting — used by the CONTEXT lens.
   *
   * Phrased to follow "it …", exactly like `rule`, so the two can be swapped in the same
   * sentence. It cannot be derived from `rule`: that string is written for its own domain
   * ("adds about eight hours by stopping in every town") and does not transplant.
   *
   * Optional only so the type could land before the content did; the validator requires it on
   * every option. See docs/BLOCK5_LENS_IMPLEMENTATION_PLAN.md.
   */
  parallelRule?: string;
}

export interface Block5ScenarioOption {
  id: string;
  title: string;
  summary: string;
  fingerprint: Block5OptionFingerprint;
  /**
   * The five performance metrics for this option. REQUIRED, deliberately: the previous
   * optional field let a scenario fall back to deriveMetrics(), which copied the fingerprint
   * into the metrics and is exactly how the duplication got in. See METRIC_DEFS above.
   */
  metrics: Block5MetricProfile;
  /**
   * v4 — the TRADE-OFF block shown prominently on every option card. Participants were
   * overlooking a single muted `consequence` line, so the gain and the cost are now separate,
   * color-coded fields rendered before the choice is made.
   */
  /** What the participant clearly WINS by choosing this. One short sentence. */
  gains?: string;
  /** v3: one-line "what it gives / what it gives up" shown on every selection. */
  consequence?: string;
  /** What the participant clearly LOSES — the other half of the trade-off. */
  givesUp?: string;
  /** The moral question the option raises, shown under the trade-off block. */
  moralTension?: string;
  /** v3.2: concrete material for the CVR vignette (see OptionCVRSeed). */
  cvrSeed?: OptionCVRSeed;
  // populated by ranking/labeling:
  fitScore?: number;
  candidate?: boolean;
  rank?: number;
  topMatchReasons?: string[];
  tensionPoints?: string[];
}

/** Who bears the consequences of the decision — the Block 5 manipulation. */
/**
 * WHERE THE PARTICIPANT STANDS relative to the decision. The Block 5 manipulation.
 *
 * The first three vary WHO CARRIES THE COST. The last two vary something else, and that is the
 * point of adding them:
 *
 *   self             the participant, and nobody else
 *   self_and_group   the participant and dependents who are present
 *   others           other people; the participant is explicitly unaffected
 *   under_authority  the participant decides, it lands on colleagues — but inside an organization
 *                    whose STATED VALUES pull against their own. Varies whose values govern.
 *   receiving_end    someone else decides and it lands on the participant, who has NO CONTROL.
 *                    Varies whether they hold the pen at all.
 *
 * `under_authority` and `receiving_end` are a matched pair: same employer, same decision, same six
 * options, same numbers. Only the chair the participant sits in changes, which is what makes the
 * contrast between them a clean read of position rather than of content.
 */
export type StakePosition =
  | "self"
  | "self_and_group"
  | "others"
  | "under_authority"
  | "receiving_end";

/**
 * Does the participant DECIDE here, or only WISH?
 *
 * "recipient" scenarios ask what the participant wants someone else to do. A wish is not a choice:
 * nobody is answerable for it, so there is nothing to reflect on and nothing it should teach.
 * Recipient scenarios therefore run NO CVR, NO profile update, and are excluded from VCI and
 * Stability — see the inclusion table in docs/VRDS_EXPERIMENT_GUIDE.md. They still produce a
 * Position Effect distance, because `profileDistance(profile, wished option)` is the same
 * arithmetic; it is simply labeled as a wish wherever it is shown.
 *
 * Defaults to "decider" when absent, so every scenario authored before this existed is unchanged.
 */
export type Block5DecisionRole = "decider" | "recipient";

export interface Block5ScenarioTheme {
  gradient: string;
  accent: string;
  shadow: string;
}

/**
 * An employer whose STATED values the participant is asked to work under.
 *
 * WHY THE COMPANY'S PRIORITY IS NOT WRITTEN DOWN HERE
 *
 * The scenario has to produce a real conflict for EVERY participant, not for the ones who happen
 * to disagree with whatever a fixed company believes. A single hard-coded set of company values
 * would clash hard with some people and barely at all with others — and those two participants
 * cannot be compared, because they were not asked the same question.
 *
 * So the company's stated priority is chosen per participant: it is whichever value they scored
 * LOWEST in Blocks 1–4. Everyone therefore faces an employer that prizes the thing they care least
 * about, and "did you take on your employer's values?" means the same thing for everybody.
 *
 * WHAT STAYS FIXED. The situation, the numbers, the six options and their fingerprints never
 * change. Only the sentence naming the company's priority does. That is deliberate: it keeps every
 * authoring gate — domination, champion uniqueness, metric independence, the planner confound —
 * applicable exactly as written, because the option set the gates measure is one option set.
 *
 * Read from the FROZEN profile, never the current one. A company whose values drifted along with
 * the participant's would not be a company; it would be a mirror.
 */
export interface Block5Employer {
  /** The organization's name, used in the scene and in the stance readout. */
  name: string;
  /** Heading above the stated principle, e.g. "Meridian Care's published service principle". */
  principleLabel: string;
  /**
   * What the company says it stands for, one phrasing per value. The phrasing shown is selected by
   * `deriveCompanyValues` from the participant's weakest value, so every entry must read as a
   * sentence a real employer could publish — including the ones that are uncomfortable.
   */
  principleFor: Record<Block5PolicyDimKey, string>;
  /** The company's own justification for that principle, in its own voice. */
  rationaleFor: Record<Block5PolicyDimKey, string>;
}

export interface Block5Scenario {
  id: string;
  title: string;
  description: string;
  theme: Block5ScenarioTheme;
  options: Block5ScenarioOption[];
  /**
   * THE SITUATION RIGHT NOW — the hard numbers, and nothing else.
   *
   * How many people, how much of the scarce thing, how long. These are the SAME for every option,
   * which is exactly what makes the comparison a trade-off rather than a guess, and it is what the
   * CVR re-presents when it says "the same 20 doses".
   *
   * NO PROSE ABOUT THE HAZARD — that belongs in `description`. NO STATEMENT OF THE PARTICIPANT'S
   * ROLE — that belongs in `role`. The three fields were previously two, and the two overlapped
   * heavily: `description` restated the scarcity that `factBase` was supposed to own, while the
   * numbers were missing from four of the five scenarios and the participant's position was buried
   * mid-sentence. A validator now enforces the split (numbers appear here, not there).
   */
  factBase?: string;
  /**
   * WHO THE PARTICIPANT IS in this scene, and who carries the cost of what they decide.
   *
   * This is `stakePosition` written out for the participant to read, and it is the block's entire
   * manipulation — the only thing that is supposed to differ across the five scenarios. It had
   * been left implicit in the middle of `description`, where a participant skimming the scene
   * could miss the one sentence the study turns on.
   */
  role?: string;
  /**
   * WHERE THE PARTICIPANT STANDS relative to the consequences — the Block 5 manipulation.
   *
   *   self            — deciding alone. Only the participant carries the cost.
   *   self_and_group  — deciding for themselves AND dependents who are present.
   *   others          — deciding for other people; the participant is explicitly unaffected.
   *
   * The deck runs one `self`, one `self_and_group`, and three `others`, in that fixed order. The
   * unequal n and the confound with sequence position are stated limits, not oversights — see
   * docs/BLOCK5_POSITION_EFFECT_PLAN.md §7 and docs/BLOCK5_PLANNER_ORDERING_PLAN.md §9.
   */
  stakePosition?: StakePosition;
  /**
   * Whether the participant decides here or only says what they wish. Defaults to "decider".
   *
   * This is the flag that switches off the reflection machinery, so it is load-bearing: setting it
   * to "recipient" removes the scenario from CVR, from the profile update, from VCI and from
   * Stability in one place rather than five.
   */
  decisionRole?: Block5DecisionRole;
  /**
   * The organization whose stated values this scenario runs under, if any.
   *
   * Present only on the `under_authority` / `receiving_end` pair. The company's stated priority is
   * NOT written here — it is derived per participant from their frozen Blocks 1–4 profile, so that
   * the conflict is guaranteed rather than a matter of luck. See `deriveCompanyValues` in
   * block5Company.ts.
   */
  employer?: Block5Employer;
  /**
   * How much this scenario's decisions are allowed to teach the profile, 0–1 (default 1).
   *
   * Every profile update the scenario can produce is multiplied by this weight, so the strength
   * of the evidence scales with what is actually at stake. The everyday scenarios (travel, food)
   * use 0.5: a participant's dinner choice is real evidence about their moral priorities, but it
   * should not move the profile as far as a decision about who receives a scarce cancer dose.
   * Applied in block5CVR.ts by applyValueBump / applyEndorsementUpdates / applyApaUpdates.
   */
  stakesWeight?: number;
}

/** ---- CVR Cube ---- */
export type CVRFraming = "context" | "directness";

/**
 * A pending one-off adjustment to a reflection-lens sensitivity (Directness or Context),
 * produced by the dual-perspective question and applied only when the participant confirms.
 *  - YES path: −20 to the lens that did NOT influence keeping the option.
 *  - NO  path: +20 to the lens that DID change their mind to reject it.
 */
export interface FramingAdjust {
  sensitivityKey: "directnessSensitivity" | "contextSensitivity";
  delta: number;
}
/** Who appears in the vignette (derived from stakeholder sensitivity, inverse map). */
export type SalienceWho = "close" | "group" | "system";

export interface CVRCoordinate {
  violatedKey: Block5PolicyDimKey;
  framing: CVRFraming;
  who: SalienceWho;
}

/**
 * The reflection lens, made visible instead of asserted.
 *
 * The two lenses measure different things and therefore now LOOK different, which is deliberate:
 *
 *   context     — between contexts only. Shows the participant's own rule, with the same numbers,
 *                 running in another setting of EQUAL seriousness.
 *   directness  — within one context, direct harm. Shows the same outcome twice: once as an
 *                 impersonal system could have produced it, once as the participant did produce it.
 *
 * Both are shown as a block rather than a clause, so neither lens is more persuasive than the
 * other simply by being longer. See docs/BLOCK5_LENS_IMPLEMENTATION_PLAN.md.
 */
export interface CVRLensBlock {
  framing: CVRFraming;
  /** short heading above the block. */
  heading: string;
  /** the body of the lens (with {markup}). */
  body: string;
  /**
   * Short labeled lines shown under the body, one per point.
   *
   * The directness lens needs two separate consequences and a paragraph would bury the second one.
   * Separate lines also read far better in a second language than a long sentence with clauses.
   */
  points?: { label: string; text: string }[];
  /** the one-line challenge that closes it (with {markup}). */
  prompt: string;
}

export interface CVRStory {
  /**
   * The person who argues against whatever the participant just said, for each side.
   * hurt — shown after "yes": what the choice costs someone.
   * need — shown after "no": what that person loses because it was refused.
   * These live on their own page now, after the yes/no, not on the vignette page.
   */
  people?: { hurt: string; need: string };
  coordinateKey: string;
  /** the recontextualized scenario: same trade-off + numbers, re-framed (with {markup}). */
  recontext: string;
  /** the AHA-style stakeholder vignette: who appears + identified case + harm (with {markup}). */
  stakeholder: string;
  /** the re-endorsement question (with {markup}). */
  reendorseQuestion: string;
  /** the lens shown as its own block. Optional until every scenario carries lens content. */
  lens?: CVRLensBlock;
}

/** One randomly-chosen stakeholder "voice" for a CVR vignette (picked per misaligned selection). */
export interface WhoVariant {
  /** the full vignette lead sentence shown to the participant (wrapped in {w|…}). */
  lead: string;
  /** the short subject reused in the matching Q2 stakeholder question (e.g. "your mother", "the nurse"). */
  label: string;
}

/** What the participant answered on the CVR endorsement + follow-ups. */
export type CVREndorsement = "strong" | "weak" | "no" | "n/a";

/** What the participant clarified in APA (recorded for analysis; committed only on a final decision). */
export interface APARecord {
  q1: "endorse" | "context" | "unsure";
  confidence: number;               // 1–5
  stakeholderInfluenced: boolean;
  prioritizedValue: Block5PolicyDimKey;
  originalOptionId: string;         // the misaligned option that triggered APA
}

/** ---- Behavioral telemetry (additive; does NOT affect scoring) ---- */

/** How a scenario's CVR step ended (final committed path). */
export type CVROutcome =
  | "endorsed-strong"
  | "endorsed-weak"
  | "went-to-APA"
  | "exited"
  | "none";

/** How a scenario's APA step ended (final committed path). */
export type APAOutcome = "committed" | "exited" | "none";

/**
 * Per-scenario behavioral telemetry, captured inside the Block-5 component from the handlers
 * it already has (select, preview, expand, CVR yes/no/back, APA open/back/confirm). These are
 * pure observation counters + timestamps — they never change the decision logic or scoring.
 */
export interface Block5ScenarioTelemetry {
  cvrTriggered: boolean;     // the chosen path showed a CVR vignette at least once
  apaTriggered: boolean;     // the APA panel opened at least once
  cvrVisits: number;         // times the CVR vignette was shown (incl. re-entries)
  apaVisits: number;         // times the APA panel opened
  cvrOutcome: CVROutcome;
  apaOutcome: APAOutcome;
  /** = optionChanges + cvrBackouts + apaBackouts + finalDecisionChanges (clean "how much did they waver"). */
  numberOfSwitches: number;
  initialSelections: number; // distinct options opened into the decision view
  optionChanges: number;     // went back and chose a DIFFERENT option
  cvrBackouts: number;       // left the CVR vignette via "change my mind"
  apaBackouts: number;       // left APA via "take me back to all options"
  finalDecisionChanges: number; // picked an APA final option, then changed it before committing
  timeToFirstSelectionMs: number | null; // deliberation before the first pick
  previewImpactOpens: number; // used "Preview impact"
  compareChartsOpens: number; // opened the two-radar "compare all options" charts
  optionExpands: number;     // expanded an option card to read details
  cvrDwellMs: number;        // time reflecting inside the CVR vignette
  apaDwellMs: number;        // time reflecting inside the APA flow
}

/** ---- Results ---- */
export interface Block5ScenarioResult {
  scenarioId: string;
  selectedOptionId: string;
  selectedRank: number;
  topRankedOptionId: string;
  selectedWasTopCandidate: boolean;
  selectedWasCandidate: boolean;
  rankedOptionIds: string[];
  fitScoresByOptionId: Record<string, number>;
  candidateStatusByOptionId: Record<string, boolean>;
  viewedExplanationOptionIds: string[];
  timeMs: number;

  // v3 additions:
  alignmentLevel?: AlignmentLevel;
  matchScore?: number;
  firstChoiceOptionId?: string;
  postCVRChoiceOptionId?: string;
  cvrFired?: boolean;
  cvrEndorsement?: CVREndorsement;
  cvrCoordinate?: CVRCoordinate;
  stakeholderGuided?: boolean | null;
  /** alignment of the FINAL choice vs the ORIGINAL pre-Block-5 profile (for Stability). */
  alignedToOriginal?: boolean;
  /**
   * Whether this scenario asked for a DECISION or only a WISH. Absent means "decider".
   *
   * Recorded on the result rather than looked up from the scenario list, so a stored record stays
   * self-describing: an analyst reading the exported JSON in two years can tell which rows are
   * choices and which are wishes without needing the scenario definitions that were live at the
   * time. It is also what `computeVCI` filters on, so the exclusion travels with the data instead
   * of being re-derived in every place that consumes it.
   */
  decisionRole?: Block5DecisionRole;
  /**
   * Seconds the participant spent on this scenario’s intro page before opening the options.
   *
   * The intro carries the scene, the numbers and the participant’s ROLE — the one thing Block 5
   * varies. Recording the dwell turns “did they take the manipulation in?” from an assumption
   * into something an analyst can check, and lets a run clicked through in seconds be flagged
   * rather than silently averaged in with the rest.
   */
  introSeconds?: number;
  /**
   * per-scenario VCI contribution S_i (0–1).
   *
   * Recorded for recipient scenarios too, but NOT averaged into VCI — see `computeVCI`. Keeping
   * the number lets the Responsibility Gap compare "consistency when deciding" against
   * "consistency when only wishing" on the same scale, which is the whole point of measuring it.
   */
  vciScore?: number;
  performanceScore?: number;
  /**
   * PERFORMANCE AS A SHARE OF WHAT THIS SCENARIO OFFERED, 0-100. See block5Performance.ts.
   *
   * `performanceScore` above is the raw mean of the five metrics, and it is kept — but its
   * achievable range across a session is only ~14 points wide (a participant who takes the worst
   * option every time still scores 56), so it reads as a percentage while behaving like a narrow
   * band. That is fatal for an equivalence test: the prior paper's H3 margin of 0.05 would be 36%
   * of the entire achievable range.
   *
   * This field is `100 x (chosen − worst available) / (best − worst)` within the scenario, so it
   * spans a true 0-100 and answers "of the performance on the table, how much did you take?".
   */
  performanceCaptured?: number;
  /** The worst and best composite the scenario's six options offered — stored so the number is auditable. */
  performanceMenu?: { worst: number; best: number };
  /** the chosen option's 5 metrics, stored so the cumulative dashboard/summary don't re-look-up. */
  metrics?: Block5MetricProfile;
  /** APA clarification, when the scenario was resolved through the APA flow. */
  apa?: APARecord;
  /** the exact stakeholder voice text shown in the CVR vignette this scenario (for analysis). */
  cvrStakeholderShown?: string;
  /** behavioral telemetry for this scenario (visits, switches, dwell) — does not affect scoring. */
  telemetry?: Block5ScenarioTelemetry;
  /**
   * The participant's 4 policy-value scores (0–100) AFTER this scenario's profile update.
   * Captured so the results view can plot how each value evolved across the journey
   * (Before Block 5 → after S1 → after S2 → after S3). Additive; does not affect scoring.
   */
  policySnapshotAfter?: Record<Block5PolicyDimKey, number>;
  /**
   * Stakeholder sensitivity AFTER this scenario's update. Snapshotted alongside the four policy
   * values because Stability measures movement across all five, and stakeholder is the largest
   * single mover in the block (+-25 on every CVR).
   */
  stakeholderSnapshotAfter?: number;

  /* ---- CVR dual-perspective (Directness ↔ Context) — see block5CVR + CVRReveal ----
   * All optional and only populated when the participant engaged the dual-perspective feature.
   * If the alternate view is never generated, these stay undefined and behavior is unchanged. */

  /** Which reflection lens was shown FIRST (the larger of Directness/Context at the time). */
  cvrFramingShownFirst?: CVRFraming;
  /** True only if the participant generated the OTHER lens (gate for all dual-perspective logic). */
  cvrAltViewGenerated?: boolean;
  /** The lens generated SECOND (the opposite of the first), if any. */
  cvrFramingShownSecond?: CVRFraming;
  /** The lens the participant SELECTED in the dual-perspective question. */
  cvrFramingSelected?: CVRFraming;
  /**
   * What the selection meant:
   *  - "not_influential" → YES path: the lens that did NOT influence keeping the option (→ −20)
   *  - "influential"     → NO path: the lens that DID change their mind to reject it (→ +20)
   */
  cvrFramingSelectedRole?: "not_influential" | "influential";
  /** The committed sensitivity change for the selected lens (e.g. {key:"contextSensitivity", delta:-20}). */
  cvrFramingAdjustment?: FramingAdjust;

  /* ---- PLANNER (block5Planner.ts) — the card ORDER, kept strictly apart from alignment ----
   *
   * The whole consistency analysis rests on being able to ask one question of the data:
   * "the participant chose the option the planner ranked 4th, and that option was labeled
   * strongly aligned." Both halves of that sentence have to survive into the log, which is why
   * `plannerOrder` and `rankedOptionIds` are two different fields that are allowed to disagree,
   * and why `choiceRank` (planner position) sits beside `selectedRank` (alignment position).
   */

  /** Option ids in the order the planner displayed them: clear, then costed, then blocked. */
  plannerOrder?: string[];
  /** Which display bin each option landed in. */
  plannerBins?: Record<string, "clear" | "costed" | "blocked">;
  /** Pairwise wins per option — the quantity the ordering is actually built from. */
  plannerWins?: Record<string, number>;
  /** The option the planner put first. */
  plannerTopOptionId?: string;
  /** The highest-ranked option inside every limit — the reference every card compares against. */
  plannerCleanReferenceId?: string;
  /** The participant's value ranking as the planner used it, rank 1 first. */
  plannerValueOrder?: Block5PolicyDimKey[];
  /** True when the derived decision profile fell back to neutral (no Blocks 1-3 record). */
  plannerDegradedProfile?: boolean;

  /** THE KEY DEPENDENT VARIABLE: the chosen option's position in the planner order (1-based). */
  choiceRank?: number;
  /** The chosen option's bin. */
  choiceBin?: "clear" | "costed" | "blocked";
  /** Did they take the planner's first card? */
  choiceMatchedPlannerTop?: boolean;
  /** Did they take the option the alignment tier labeled best? */
  choiceMatchedAlignedTop?: boolean;
  /** Did the chosen option cross a limit the participant themselves refused outright? */
  choiceCrossedOwnRedLine?: boolean;
  /** Which values it crossed, and by how much, in normalized scenario units. */
  choiceBreaches?: { key: Block5PolicyDimKey; amount: number; hard: boolean }[];
  /**
   * True when the chosen option outranked another option that beats it on the participant's own
   * rank-1 value. In the LEAP paper this exact event is what TRIGGERS learning; here it is the
   * observation — a person taking an option that trades away the value they ranked first.
   */
  choiceUsedTradeOff?: boolean;

  /**
   * Snapshot of the two reflection-lens sensitivities (0–100) AFTER this scenario's update,
   * so the results view can chart how Directness vs Context evolved across the scenarios.
   */
  framingSnapshotAfter?: { directnessSensitivity: number; contextSensitivity: number };
}

export interface Block5Results {
  completed: boolean;
  completedAt: string;
  userProfile: Block5UserProfile;
  originalProfile?: Block5UserProfile;
  scenarioResults: Block5ScenarioResult[];
  vci?: number;
  vciLevel?: string;
  stability?: number;
  stabilityLevel?: string;
  /**
   * The two halves behind the Stability headline plus the raw churn, kept so the results page can
   * explain the number and so analysis is not left with a single opaque score.
   */
  stabilityDetail?: {
    orderPart: number;
    movementPart: number;
    pairsSwapped: number;
    churn: number;
    topValueBefore: string;
    topValueAfter: string;
  };
  performance?: number;
  /** Session performance as a share of what was available: mean of the per-scenario captured scores. */
  performanceCaptured?: number;
  /** Plain-English label for `performanceCaptured`. */
  performanceCapturedLevel?: string;

  /** behavioral telemetry totals across all scenarios (additive; does not affect scoring). */
  totalCvrVisits?: number;
  totalApaVisits?: number;
  totalSwitches?: number;
}

export const BLOCK5_PROGRESS_KEY = "block5_public_emergency_progress";
export const BLOCK5_RESULTS_KEY = "block5_public_emergency_results";
