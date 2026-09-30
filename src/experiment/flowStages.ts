/**
 * flowStages.ts — where each short pause between two parts of the study leads, and which stage a refresh must land on
 * (since 30 September 2026, the researcher's request: the accuracy checklist's "A refresh on the Block 2 or Block 3
 * finished screen").
 *
 * THE PROBLEM IT FIXES. When a block finishes it saves its results, deletes its progress file, and the flow shows a
 * 0.9-second pause before the next part. The flow used to save NOTHING for a pause: the browser's stage and the server's
 * copy still named the block that had just finished. A refresh, a closed tab or a crash in that moment reopened the
 * finished block with no progress, at its first question, and answering it again overwrote the saved results. It
 * happened after every block: Block 1, 2, 3, 4, and Block 5 (the main study restarted at scenario 1).
 *
 * THE FIX. A pause is remembered as the part it leads to (`stageToSave`), in the browser and on the server, the moment
 * it starts. Every block saves what the next part needs before its pause begins (its results; after Block 3 and 4 the
 * files interBlockData.ts writes), so the next part can always open. A pause restored from storage leads there too.
 * What is left is the block's own last instant (about two screen redraws between the final answer and the pause), which
 * nobody can refresh in. Checked by `npm run validate:session` C10.
 */

/** Each pause, and the part of the study it leads to. The auto-advance, the saved stage and the restore all read this. */
export const TRANSITION_TARGET = {
  transition_money_trolley: "trolley",
  transition_trolley_product: "product",
  transition_product_block4: "block4",
  transition_block4_block5: "block5_intro",
  transition_block5_summary: "block5_summary",
} as const;

export type TransitionStage = keyof typeof TRANSITION_TARGET;

export function isTransition(stage: string | null | undefined): stage is TransitionStage {
  return !!stage && Object.prototype.hasOwnProperty.call(TRANSITION_TARGET, stage);
}

/** The stage to remember for `stage`: a pause is remembered as the part it leads to; every other stage as itself. */
export function stageToSave(stage: string): string {
  return isTransition(stage) ? TRANSITION_TARGET[stage] : stage;
}
