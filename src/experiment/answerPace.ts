/**
 * answerPace.ts — how fast somebody answered in Blocks 1-3, measured ONE way for everything that reports it.
 *
 * Two places read this: the database's careful-participation sign (`analysis.blocks_1_to_4_checks.answered_very_fast`,
 * dbShape.ts) and the participant's own note on the thank-you page ("How long you took over each answer",
 * blocks123Consistency.ts). Until 24 October 2026 they used two lines (2 seconds and 2.5 seconds) and two slightly
 * different medians, so the same run could be "fast" on one and not the other (the dissertation writer's question Q2).
 * The researcher's "R17-A": one line, the one registered on OSF ("median under 2 seconds between answers"), and one
 * median. validate:journey J21 holds the page and the database to the same numbers.
 */

/**
 * Below this median time between two answers in Blocks 1-3, the participant was answering faster than a ladder step can
 * be read. Registered on OSF (14 October 2026) as a robustness sign; the medians themselves are stored, so a different
 * line can still be drawn later over data already collected. Researcher's approval of the flag, 24 September 2026.
 */
export const FAST_ANSWER_SECONDS = 2;

/** The middle value; for an even count, the mean of the two middle values. Null for no values. */
export function medianOf(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Seconds between consecutive answers in one block's click history. The first answer has none. Within one block only:
 *  a gap across two blocks would include the pause screen between them. */
export function secondsBetweenAnswers(block: unknown): number[] {
  const history = (block as { history?: { timestamp?: unknown }[] } | null)?.history;
  if (!Array.isArray(history)) return [];
  const times = history
    .map((h) => (typeof h?.timestamp === "string" ? Date.parse(h.timestamp) : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / 1000);
  return gaps;
}
