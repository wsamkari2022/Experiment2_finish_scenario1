/**
 * resumeMerge.js — never let a browser that knows less erase what another browser uploaded.
 *
 * ============================================================================
 * THE RUN THAT EXPOSED THIS (23 September 2026)
 * ============================================================================
 * A participant finished all four blocks across two browsers, opened a third, signed in — and was
 * sent back to Block 1. Their server record held this resume state:
 *
 *   money_block_results, trolley_block_results, ai_workforce_block_progress,
 *   vrds_stage_timings, vrds_active_time, vrds_session_log
 *
 * That is a snapshot of somebody who stopped in the middle of Block 3: the Block 3 PROGRESS file
 * is there and its RESULTS file is not, and `final_moral_analysis`, `experiment_flow_insights`,
 * `moral_profile_insights` and `block4_reflection_results` are missing entirely. The third browser
 * downloaded exactly that, Block 5 found no profile, and the flow did what it is written to do
 * when the profile is missing: it sent them to the beginning.
 *
 * The cause was one line: the section route wrote `resume_state` with `$set`, which REPLACES the
 * whole object. Every sync from every browser overwrote it, so the last browser to sync won —
 * even a tab left open on an earlier machine, holding a version of the run from an hour before.
 *
 * ============================================================================
 * THE RULE
 * ============================================================================
 * Merge by file, never replace the set. A browser may update the files it holds; it may not
 * delete the ones it has never heard of. The only thing the old behaviour did that this does not
 * is lose data.
 *
 * ONE EXCEPTION, AND IT IS NAMED. `vrds_active_time` is a running total of working minutes. A
 * stale browser holding an older copy would otherwise push the total backwards, which is never
 * right for a number that only grows, and which decides compensation. The larger total wins.
 */

/** The ledger whose totals must never go backwards. See the note above. */
const RUNNING_TOTAL_FILE = "vrds_active_time";

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * Combines the resume files already stored with the ones just uploaded.
 *
 * Returns the merged file map plus what happened, so the caller can log a merge that actually
 * saved something rather than logging every write.
 */
export function mergeResumeFiles(stored, incoming) {
  const before = isObject(stored) ? stored : {};
  const after = isObject(incoming) ? incoming : {};

  const merged = { ...before };
  let replaced = 0;
  let added = 0;

  for (const [key, value] of Object.entries(after)) {
    if (!(key in merged)) {
      merged[key] = value;
      added += 1;
      continue;
    }

    if (key === RUNNING_TOTAL_FILE) {
      const mine = Number(value?.totalMs ?? 0);
      const theirs = Number(merged[key]?.totalMs ?? 0);
      if (mine < theirs) continue;   // an older ledger: keep the bigger total
    }

    merged[key] = value;
    replaced += 1;
  }

  /* What the upload did NOT contain and therefore did not touch. This is the whole point. */
  const kept = Object.keys(before).filter((k) => !(k in after));
  return { merged, added, replaced, kept };
}

/**
 * The whole `resume_state` value to store, given what is there and what arrived.
 *
 * `updated_at` is the moment of THIS upload, because it answers "when did we last hear from this
 * participant", not "how old is the oldest file in here".
 */
export function mergeResumeState(storedState, incomingState, now = new Date().toISOString()) {
  const { merged, added, replaced, kept } = mergeResumeFiles(
    storedState?.files, incomingState?.files,
  );
  return {
    state: { files: merged, updated_at: now },
    added,
    replaced,
    kept,
  };
}
