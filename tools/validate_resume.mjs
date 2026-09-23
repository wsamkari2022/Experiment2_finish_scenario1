/*
 * validate_resume.mjs — the guard on carrying a run to another computer.
 *
 * WHY IT EXISTS. On 23 September 2026 a participant who had finished all four blocks signed in on
 * a third browser and was sent back to Block 1. The server had replaced their complete resume
 * snapshot with a partial one from a browser that had stopped in the middle of Block 3, because
 * the write used $set on the whole object and the last browser to sync won.
 *
 * Nothing in the test suite looked at the server, so nothing could have caught it. This runs the
 * real merge function the route now uses.
 *
 * Run:  npm run validate:resume
 */
import { mergeResumeFiles, mergeResumeState } from "../server/resumeMerge.js";

let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${String(id).padEnd(4)} ${msg}`);
  if (!ok) fails += 1;
};

console.log("");
console.log("==============================================================================");
console.log("  CARRYING A RUN TO ANOTHER COMPUTER");
console.log("==============================================================================");
console.log("");

/* The snapshot a browser holds once all four blocks are done. */
const complete = {
  experiment_flow_insights: { v: "full" },
  moral_profile_insights: { v: "full" },
  final_moral_analysis: { v: "full" },
  money_block_results: { v: "full" },
  trolley_block_results: { v: "full" },
  ai_workforce_block_results: { v: "full" },
  block4_reflection_results: { v: "full" },
  vrds_stage_timings: { v: "full" },
  vrds_active_time: { totalMs: 900_000 },
  vrds_session_log: { sessions: [1, 2] },
};

/* What the browser that stopped in the middle of Block 3 holds — the real one, from the record. */
const stale = {
  money_block_results: { v: "old" },
  trolley_block_results: { v: "old" },
  ai_workforce_block_progress: { v: "half" },
  vrds_stage_timings: { v: "old" },
  vrds_active_time: { totalMs: 120_000 },
  vrds_session_log: { sessions: [1] },
};

/* ---- R1: the stale browser cannot delete what it never had ---- */
{
  const { merged, kept } = mergeResumeFiles(complete, stale);
  const needed = ["final_moral_analysis", "experiment_flow_insights", "moral_profile_insights",
    "block4_reflection_results", "ai_workforce_block_results"];
  const missing = needed.filter((k) => !(k in merged));
  gate("R1", missing.length === 0,
    missing.length
      ? `a stale sync still erases: ${missing.join(", ")}`
      : `a Block-3 browser syncing over a finished run keeps all ${Object.keys(merged).length} files `
        + `(${kept.length} it had never heard of)`);
}

/* ---- R2: and the run can still be continued from what is left ---- */
{
  const { merged } = mergeResumeFiles(complete, stale);
  gate("R2", merged.final_moral_analysis?.v === "full",
    "the profile Block 5 needs survives the stale sync, so the participant lands where they left off");
}

/* ---- R3: the working-time total never goes backwards ---- */
{
  const { merged } = mergeResumeFiles(complete, stale);
  gate("R3", merged.vrds_active_time.totalMs === 900_000,
    `the larger working total wins  (${merged.vrds_active_time.totalMs / 60000} minutes kept, not `
    + `${stale.vrds_active_time.totalMs / 60000})`);
}

/* ---- R4: a browser that is genuinely ahead still updates the files it holds ---- */
{
  const ahead = { ...complete, block4_reflection_results: { v: "newer" }, vrds_active_time: { totalMs: 1_500_000 } };
  const { merged, replaced } = mergeResumeFiles(complete, ahead);
  gate("R4", merged.block4_reflection_results.v === "newer"
    && merged.vrds_active_time.totalMs === 1_500_000 && replaced > 0,
    `a browser that is ahead updates what it holds  (${replaced} files replaced)`);
}

/* ---- R5: nothing is lost when the server has nothing yet ---- */
{
  const { merged, added } = mergeResumeFiles(undefined, complete);
  gate("R5", Object.keys(merged).length === Object.keys(complete).length && added === added,
    `a first upload onto an empty record stores all ${Object.keys(merged).length} files`);
}

/* ---- R6: the stamp says when we last heard from them ---- */
{
  const now = "2026-09-23T20:00:00.000Z";
  const { state } = mergeResumeState({ files: complete, updated_at: "2026-09-01T00:00:00.000Z" },
    { files: stale }, now);
  gate("R6", state.updated_at === now && "final_moral_analysis" in state.files,
    "the stored state carries this upload's time and the merged files");
}

console.log("");
console.log("==============================================================================");
if (fails) {
  console.log(`### ${fails} RESUME GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("==============================================================================");
  console.log("");
  process.exit(1);
}
console.log("### ALL RESUME GATES PASSED ###");
console.log("==============================================================================");
console.log("");
