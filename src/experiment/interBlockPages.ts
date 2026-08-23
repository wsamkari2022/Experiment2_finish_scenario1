/**
 * interBlockPages.tsx — ONE switch that hides every between-block page, and the pieces that
 * make hiding them seamless.
 *
 * ============================================================================
 * WHAT IS BEING HIDDEN
 * ============================================================================
 * Five screens sit between the four measurement blocks. All five are feedback to the
 * participant about what has been measured so far:
 *
 *   1. CompletionScreen              after Block 1  ("Found money" summary)
 *   2. TrolleyCompletionScreen       after Block 2  ("Trolley" summary)
 *   3. AIWorkforceCompletionScreen   after Block 3  ("AI workforce" summary)
 *   4. MoralProfileInsightsPage      between Blocks 3 and 4  ("A brief look at your responses")
 *   5. FinalMoralAnalysisPage        between Blocks 4 and 5  (the full profile + threshold tree)
 *
 * ============================================================================
 * WHY THEY ARE HIDDEN
 * ============================================================================
 * Every one of them tells the participant what the instrument has concluded about them BEFORE
 * they have finished answering. That is a live reactivity risk:
 *
 *   - A participant told "you protect the vulnerable" going into Block 4 has been handed a
 *     self-description to live up to. Consistency pressure is one of the best-documented
 *     demand characteristics there is, and Block 4 is precisely where we ask them to revisit
 *     a decision after hearing other people.
 *   - The Final Analysis page shows the ranked seven-sensitivity tree — the exact quantity that
 *     then decides which Block 5 options are labelled misaligned for them. Showing a participant
 *     the scoring key and then scoring them with it makes Block 5 unusable as a measurement.
 *
 * Hiding them makes Blocks 1-5 run straight through as one continuous task.
 *
 * ============================================================================
 * WHY THEY ARE HIDDEN RATHER THAN DELETED
 * ============================================================================
 * Two reasons, and the second is the important one.
 *
 *   1. The decision is reversible. Flip the flag below and all five come back exactly as they
 *      were; nothing else in the codebase needs to change.
 *
 *   2. THEY STILL RUN. Pages 4 and 5 are not merely display — they COMPUTE and PERSIST. The
 *      Insights page derives the moral profile, seed case, domain and scenario context that
 *      Block 4 is built from; the Final Analysis page derives and stores the threshold tree.
 *      Deleting them would delete that pipeline. In hidden mode they mount, compute and write
 *      exactly as before, then advance themselves instead of waiting for a click. The
 *      participant never sees them; the data does not notice they were hidden.
 *
 * This is why hiding is implemented as "auto-press the Continue button" rather than
 * "skip the stage". Skipping the stage would skip the computation with it.
 *
 * ============================================================================
 * HOW TO BRING THEM BACK
 * ============================================================================
 * Set SHOW_INTER_BLOCK_PAGES to true. That is the whole revert. Every call site reads this one
 * constant; there is no second place to remember.
 */

import { useEffect, useRef } from "react";

/**
 * Master switch for the five between-block pages.
 *
 *   false  (current) — blocks run straight through; the pages still compute and persist.
 *   true             — the pages are shown and the participant clicks Continue, as originally built.
 *
 * The explicit `: boolean` annotation is deliberate. Without it TypeScript narrows the type to
 * the literal `false`, and every `if (SHOW_INTER_BLOCK_PAGES)` branch becomes provably dead code
 * that the compiler and linter then complain about. Annotating keeps both branches live, which
 * is exactly what a revert switch needs.
 */
export const SHOW_INTER_BLOCK_PAGES: boolean = false;

/**
 * Presses a page's Continue button on the participant's behalf, exactly once.
 *
 * WHAT: when `ready` becomes true, calls `advance()` in an effect — never during render.
 *
 * WHY AN EFFECT AND NOT A DIRECT CALL: the pages persist their results in effects of their own.
 * Effects run in declaration order, so as long as this hook is called AFTER the persisting
 * effect, the write is guaranteed to have happened before the flow moves on. Calling `advance()`
 * from the completion handler instead would race the write. Every call site below therefore
 * places this hook after the persist effect, and says so in a comment.
 *
 * WHY THE REF GUARD: React StrictMode mounts, unmounts and remounts every component in
 * development to surface unsafe effects. Without the guard the callback would fire twice. The
 * ref survives that simulated remount, so `advance` runs exactly once either way. (Reading or
 * writing a ref inside an effect is safe; only reading one during render is not.)
 */
export function useAutoAdvance(ready: boolean, advance: () => void): void {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!ready || firedRef.current) return;
    firedRef.current = true;
    advance();
  }, [ready, advance]);
}
