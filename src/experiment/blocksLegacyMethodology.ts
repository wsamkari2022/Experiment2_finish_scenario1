/**
 * blocksLegacyMethodology.ts — the ONE place that switches Blocks 2 and 3 between the
 * original ("paired / carry-over") methodology and the current ("independent") methodology.
 *
 * ============================================================================
 * HOW TO REVERT TO THE ORIGINAL DESIGN
 * ============================================================================
 * Set the two flags below to `true`. Nothing else needs to change anywhere in the
 * codebase. Both code paths are compiled and type-checked at all times, so the original
 * methodology cannot rot while it is switched off.
 *
 *   BLOCK2_LEGACY_PAIRED_BRIDGE            = true   → restores the original Block 2
 *   BLOCK3_LEGACY_CARRYOVER_AND_AUTOBLOCK  = true   → restores the original Block 3
 *
 * If you revert, ALSO bump BLOCKS_23_METHODOLOGY_VERSION (see below) so that any
 * half-finished Block 3 session saved in a participant's browser is discarded rather
 * than resumed under the other set of rules.
 *
 * ============================================================================
 * WHAT CHANGED, AND WHY
 * ============================================================================
 *
 * ── BLOCK 2 (Trolley: lever → bridge) ───────────────────────────────────────
 *
 * ORIGINAL ("paired"): the lever phase walked the lives ladder from rung 0
 * (1 person). The bridge phase then opened at the rung where the lever was ACCEPTED, so
 * both scenarios were tested at the same number. If the lever was never accepted at any
 * of the 8 rungs, the bridge phase was skipped entirely and the block ended.
 *
 *   Intent: a matched-pair comparison — same number of lives, only the directness of the
 *   act differs.
 *
 *   Cost: the bridge threshold was structurally unable to fall BELOW the lever threshold,
 *   because the lower rungs were never offered. `bridge >= lever` was therefore an
 *   artifact of the procedure, not a finding. Participants who never pulled the lever
 *   produced no bridge data at all.
 *
 * CURRENT ("independent"): both phases walk the full ladder from rung 0, and the bridge
 * phase always runs — including for participants who never pulled the lever.
 *
 *   Benefit: the bridge threshold is now free to land above, equal to, or below the lever
 *   threshold, so the direct-vs-indirect comparison is a measurement rather than a
 *   constraint. Every participant yields a bridge threshold.
 *
 *   Cost: more questions (see the note on participant burden at the end of this file).
 *
 * ── BLOCK 3 (AI workforce: 2 worker groups × 3 group sizes) ─────────────────
 *
 * ORIGINAL ("carry-over + auto-block"), two separate dependencies:
 *   1. CARRY-OVER — after approving a rollout for one group size, the next (larger) size
 *      opened at the SAME gain level, not at $1M.
 *   2. AUTO-BLOCK — if a size was refused even at the maximum $100M, every LARGER size in
 *      that worker group was auto-filled as `blockedByPriorNonAcceptance` and never shown,
 *      on the assumption that refusing to harm 10 workers implies refusing to harm 1,000.
 *
 *   Cost: (1) made each size's threshold conditional on the previous size's answer, and
 *   (2) meant up to 4 of the 6 cells could be filled with an inferred value instead of a
 *   real answer. Roughly one cell in six was never actually asked.
 *
 * CURRENT ("independent"): every one of the six (worker group × size) cells starts at
 * $1M and is always presented. Refusing at $100M records `thresholdBeyondRange` for that
 * cell only, and the block continues to the next size.
 *
 * ============================================================================
 * THE DIRECTNESS SCORE — the one formula that HAD to change with this
 * ============================================================================
 * `thresholdTree.ts` derives the participant's Directness sensitivity (one of the seven
 * dimensions that drive Block 5) from the two Block 2 thresholds.
 *
 * ORIGINAL formula:   max(0, bridgeIdx − leverIdx) / 8
 *
 * Under the paired design that `max(0, …)` never actually clipped anything, because the
 * bridge could not be accepted below the lever. Under the independent design it CAN be,
 * and the original formula would map every such participant to exactly 0 — the same score
 * given to someone who drew no distinction at all between pushing and pulling. Two very
 * different people, one number.
 *
 * CURRENT formula:    |bridgeIdx − leverIdx| / 8
 *
 * Rationale — the score answers "how much does being the DIRECT cause move this person's
 * decision?", and a participant who needs five rungs FEWER to push is just as strongly
 * moved by directness as one who needs five rungs MORE. What differs between them is the
 * DIRECTION, not the strength, so the direction is recorded separately (see
 * `directnessGapIndex` / `directnessDirection` on the Block 2 summary) and is never folded
 * into the sensitivity score.
 *
 * Why not a signed score centered on 0.5? Because the seven sensitivities are RANKED and
 * WEIGHTED against each other in Block 5, and that model deliberately puts every dimension
 * on a "0 = no sensitivity" footing. A centered score would hand 50/100 to every participant
 * who draws no directness distinction at all, structurally inflating directness above
 * context and group-size — the exact artifact the comment in `thresholdTree.ts` records as
 * having been fixed once already. It would also skew `chooseFraming()`, which picks the CVR
 * reflection lens by comparing context sensitivity against directness sensitivity.
 *
 * Note that `profileAnalysis.ts` keeps a SEPARATE, signed measure named
 * `directnessAversionScore` (centered on 0.5). That is intentional and is not a duplicate:
 * "aversion" is directional by definition and is descriptive only, while "sensitivity" is
 * magnitude and feeds the Block 5 model. See the comments at both sites.
 *
 * ============================================================================
 * PARTICIPANT BURDEN
 * ============================================================================
 * Simulated over 20,000 uniformly-random threshold profiles (relative comparison only,
 * not a prediction of real participants):
 *
 *                              ORIGINAL   CURRENT
 *   Block 2 questions (avg)        7.2       9.2
 *   Block 3 questions (avg)       13.9      23.1
 *   Block 3 cells presented    5.2 of 6     6 of 6
 *   Blocks 2+3 combined (avg)     21.0      32.4
 *   Blocks 2+3 worst case           25        50
 */

/**
 * `true` restores the ORIGINAL Block 2: the bridge phase opens at the rung where the lever
 * was accepted, and is skipped entirely when the lever was never accepted.
 *
 * The explicit `: boolean` annotation is deliberate — without it TypeScript narrows the
 * constant to the literal type `false`, and every `if (BLOCK2_LEGACY_PAIRED_BRIDGE)` branch
 * would be flagged as unreachable dead code by the linter.
 */
export const BLOCK2_LEGACY_PAIRED_BRIDGE: boolean = false;

/**
 * `true` restores the ORIGINAL Block 3: each group size opens at the gain level accepted
 * for the previous size, and larger sizes are auto-blocked after a refusal at max gain.
 */
export const BLOCK3_LEGACY_CARRYOVER_AND_AUTOBLOCK: boolean = false;

/**
 * Stamped into Block 3's saved mid-session progress. Block 3 is the only one of the two
 * that can resume an interrupted session from localStorage, and a session started under
 * one methodology must not be finished under the other — the resulting record would mix
 * two designs and silently corrupt that participant's data.
 *
 * Bump this string whenever either flag above is changed. Saved progress carrying a
 * different stamp is discarded and the block restarts cleanly.
 */
export const BLOCKS_23_METHODOLOGY_VERSION = "independent-2026-08-21";

/**
 * CVR REFLECTION LENSES — show, or merely assert?
 *
 *   true  (current) — each lens is shown as its own block. CONTEXT transplants the participant's
 *                     own rule, with the same numbers, into an equally serious second setting.
 *                     DIRECTNESS shows the same outcome twice: once as an impersonal system could
 *                     have produced it, once as the participant in fact produced it.
 *   false           — the original single clause inside the recontext paragraph, which stated
 *                     that context (or your own hand) mattered without letting anyone feel it.
 *
 * Both lenses were upgraded together on purpose. Upgrading only CONTEXT would have made it the
 * more persuasive of the two, and chooseFraming() assigns lenses by the participant's own scores
 * — so any difference in outcomes between the lenses would then partly measure which text was
 * stronger rather than which participant was moved.
 *
 * The explicit `: boolean` keeps both branches live for the compiler and the linter.
 */
export const SHOW_LENS_VIGNETTES: boolean = true;

/**
 * THE PERSON WHO SPEAKS — a page of its own, after the yes/no.
 *
 *   true  (current) — the vignette page asks ONE question. After the answer, one affected person
 *                     appears on their own page and argues AGAINST what the participant just said:
 *                     after "yes" it is the person the choice costs, after "no" the person who
 *                     needed it. Whether the participant then switches IS the stakeholder measure.
 *   false           — the old flow: the person appeared on the vignette page itself, and the
 *                     participant was ASKED "did hearing this influence you?" on a later page.
 *
 * Why the change: people are poor judges of what moved them. Watching whether they switch is a
 * behavioral measure and it removes a self-report question from two pages. It also fixes a page
 * that asked two questions and offered one set of answers.
 */
export const SHOW_STAKEHOLDER_PAGE: boolean = true;
