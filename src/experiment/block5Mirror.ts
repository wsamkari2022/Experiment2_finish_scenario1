/**
 * block5Mirror.ts — what a participant chose FOR others, against what they wished FOR themselves.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS THE CLEANEST NUMBER IN THE STUDY
 *
 * Scenarios 4 and 5 are the same employer, the same cut, the same six options and the same numbers,
 * met twice. In the first the participant decides and it lands on their colleagues. In the second
 * someone else decides and it lands on them, and they say only what they WISH would happen.
 *
 * Because the content is held exactly constant, ANY difference between the two is attributable to
 * position and to nothing else. Every other position contrast in Block 5 compares different
 * scenarios, so a difference could always be the situation rather than the chair. Here it cannot.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE ORDER IS DECIDE → THEN WISH, AND THAT MAKES THE TEST CONSERVATIVE
 *
 * Having already committed, a participant is pulled toward repeating themselves — nobody enjoys
 * looking inconsistent two screens apart. So the anchor works AGAINST finding a gap, and every gap
 * these measures report is a LOWER BOUND on the real one.
 *
 * That is the version of this test worth having. A gap found in spite of the pull is evidence; a
 * gap found with the pull behind it would be much harder to defend. The cost is that a participant
 * who genuinely would have wished differently may be recorded as consistent, which understates the
 * effect rather than inventing one.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE CARDS ARE NOT SHUFFLED BETWEEN THE TWO, AND THAT WAS A DELIBERATE REVERSAL
 *
 * Shuffling the second presentation was the obvious guard against a participant simply clicking the
 * same position twice, and it was the plan. It is wrong, and the reason is worth writing down.
 *
 * The card order is produced by the planner from the FROZEN profile, so with the same six options
 * it is necessarily the same order both times. Reordering one half would mean the two halves no
 * longer differ ONLY in position — they would differ in the decision support the participant
 * received, which is the study's own treatment. The mirror's entire claim is "nothing changed
 * except the chair you sit in". Shuffling buys protection against position-memory by spending the
 * exact control the measure is built on, which is a bad trade.
 *
 * So the repetition is accepted and handled three other ways: the wish is taken second (so the
 * anchor makes every result conservative), no reminder of the earlier choice is shown anywhere in
 * the second scenario, and the time spent on the wish is recorded and reported — a wish returned in
 * a few seconds is recall, not reflection, and `hurried` marks it so the analysis can say so.
 *
 * A gate in tools/simulate_position.cjs asserts the two orders DO match, so the control is checked
 * rather than assumed.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TWO MEASURES, ON TWO DIFFERENT SCALES, DELIBERATELY NOT COMBINED
 *
 *   MIRROR GAP           how far each option sat from the participant's own frozen values.
 *                        Positive = they departed from themselves MORE when deciding for others.
 *
 *   RESPONSIBILITY GAP   VCI when deciding versus VCI when only wishing.
 *                        Positive = they were TRUER to their values with nothing on their
 *                        shoulders, i.e. responsibility pushed them off.
 *
 * They usually agree and do not have to. One is about distance from a profile, the other about
 * alignment tiers; a participant can move a long way while staying inside the same tier. Reporting
 * one number would hide that, so both are returned and both are captioned separately.
 *
 * ONE CASE WHERE THEY DISAGREE LOUDLY, AND WHY IT IS NOT A BUG. A participant who takes the
 * company's option and then wishes for their own values can show a MIRROR GAP of 100 and a
 * RESPONSIBILITY GAP of 0. The reason is that the two read different profiles by design:
 *
 *   mirror gap          measured against the FROZEN profile, so it is blind to anything Block 5 did
 *   responsibility gap  measured against the profile AS IT STOOD, exactly as VCI is
 *
 * Endorsing the company's option in the deciding half moves the profile toward the company. The
 * wish is then judged against those moved values, so it can land in the same alignment tier as the
 * choice even though it is a completely different option. That is APA working, not the measure
 * failing — but it means the responsibility gap UNDERSTATES a reversal whenever the deciding half
 * fired a profile update, and analysis should read it beside the mirror gap rather than instead of
 * it. The chart prints both for this reason.
 */

import { BLOCK5_SCENARIOS } from "./block5Scenarios";
import { positionRows } from "./block5Position";
import { scenarioVciScore } from "./block5CVR";
import type {
  Block5ScenarioResult,
  Block5UserProfile,
} from "./block5Types";

/** One side of the mirror. */
export interface MirrorSide {
  scenarioId: string;
  optionId: string;
  optionTitle: string;
  /** 0–100: share of the distance this menu made available that the participant used */
  departure: number;
  /** 0–1 alignment credit, the same quantity VCI averages */
  vciScore: number;
  /** seconds spent on this scenario, rounded */
  seconds: number;
}

export interface MirrorReading {
  decided: MirrorSide;
  wished: MirrorSide;
  /** true when the wish names the very same option as the decision */
  sameOption: boolean;
  /** decided.departure − wished.departure. Positive = further from themselves when deciding. */
  mirrorGap: number;
  /** the DECIDING half of the pair, scored 0–100 on the same scale as VCI */
  vciActed: number;
  /** the WISHING half of the pair, scored the same way */
  vciWished: number;
  /** vciWished − vciActed. Positive = truer to their values when not responsible. */
  responsibilityGap: number;
  /**
   * True when the wish came back fast enough to be recall rather than reflection.
   *
   * The second scenario shows the same six options as the first, so a participant can answer it
   * from memory without re-reading anything. This does not invalidate the wish — plenty of people
   * know their own mind quickly — but a `sameOption` result from a hurried wish is much weaker
   * evidence of consistency than one that took a minute, and the analysis should be able to tell
   * them apart rather than averaging them together.
   */
  hurried: boolean;
  /** plain-language reading, for the chart caption */
  sentence: string;
}

/**
 * Below this, a wish is treated as recall rather than reflection.
 *
 * Twelve seconds is roughly the floor for reading six option titles at all, let alone weighing
 * them. It is a flag for the analyst, never a judgement shown to the participant.
 */
export const HURRIED_WISH_SECONDS = 12;

/**
 * The decide/wish pair for this run, or null when the deck has no such pair.
 *
 * The two scenarios are matched by EMPLOYER, not by position in the list. Matching on order would
 * quietly pair the wrong two the first time a scenario was inserted between them, and would pair
 * something with nothing if a second employer were ever added.
 */
function findPair(): { decider: string; recipient: string } | null {
  const recipient = BLOCK5_SCENARIOS.find((s) => s.decisionRole === "recipient" && s.employer);
  if (!recipient) return null;
  const decider = BLOCK5_SCENARIOS.find(
    (s) => s.id !== recipient.id
      && (s.decisionRole ?? "decider") === "decider"
      && s.employer?.name === recipient.employer?.name,
  );
  return decider ? { decider: decider.id, recipient: recipient.id } : null;
}

/**
 * Do the two scenarios really offer the same six options?
 *
 * The mirror only measures position if the content is identical, so this is a PRECONDITION of the
 * measure rather than a nicety. Titles are compared in order because the pair is authored as one
 * option set written twice; if an edit ever changes one side only, every number below would still
 * compute and would silently be measuring content instead of position.
 *
 * Exported so tools/simulate_position.cjs can assert it rather than trusting it.
 */
export function mirrorContentMatches(deciderId: string, recipientId: string): boolean {
  const a = BLOCK5_SCENARIOS.find((s) => s.id === deciderId);
  const b = BLOCK5_SCENARIOS.find((s) => s.id === recipientId);
  if (!a || !b || a.options.length !== b.options.length) return false;
  return a.options.every((o, i) => o.title === b.options[i].title);
}

/**
 * Everything the mirror charts and captions need, computed from the stored results.
 *
 * Returns null when either half is missing — a participant who stopped before scenario 5, or a
 * deck with no pair. An absent mirror draws no card; a fabricated zero would draw a card claiming
 * the participant wished for exactly what they chose, which is a finding, not a placeholder.
 */
export function analyseMirror(
  results: Block5ScenarioResult[],
  frozen: Block5UserProfile,
): MirrorReading | null {
  const pair = findPair();
  if (!pair) return null;

  const rows = positionRows(results, frozen);
  const dRow = rows.find((r) => r.scenarioId === pair.decider);
  const wRow = rows.find((r) => r.scenarioId === pair.recipient);
  const dRes = results.find((r) => r.scenarioId === pair.decider);
  const wRes = results.find((r) => r.scenarioId === pair.recipient);
  if (!dRow || !wRow || !dRes || !wRes) return null;

  /*
   * The option's identity comes from the RESULT and the scenario definition, not from PositionRow —
   * that row carries the distances, not what was picked. Falling back to the id when a title cannot
   * be resolved keeps the sentence readable rather than printing "undefined" at a participant.
   */
  const titleOf = (scenarioId: string, optionId: string): string =>
    BLOCK5_SCENARIOS.find((s) => s.id === scenarioId)?.options.find((o) => o.id === optionId)?.title
    ?? optionId;

  const side = (
    row: typeof dRow,
    res: Block5ScenarioResult,
  ): MirrorSide => ({
    scenarioId: row.scenarioId,
    optionId: res.selectedOptionId,
    optionTitle: titleOf(row.scenarioId, res.selectedOptionId),
    departure: row.departure,
    vciScore: res.vciScore ?? scenarioVciScore(res.alignmentLevel ?? "misaligned"),
    seconds: Math.round((res.timeMs ?? 0) / 1000),
  });

  const decided = side(dRow, dRes);
  const wished = side(wRow, wRes);

  /*
   * Identity is decided by TITLE, not by option id. The two option sets are the same six options
   * authored twice under different ids (`care_…` and `wish_…`), so comparing ids would report
   * "different" for every participant no matter what they did — the measure would always fire and
   * always be wrong. `mirrorContentMatches` guards the assumption that titles line up.
   */
  const sameOption = decided.optionTitle === wished.optionTitle;

  /*
   * THE RESPONSIBILITY GAP COMPARES THE PAIR, NOT THE WHOLE RUN.
   *
   * This first averaged `vciScore` across every decider scenario and compared that to the single
   * wish. It looked reasonable and was wrong, and a live run made it obvious: a participant who
   * wished for EXACTLY the option they had chosen — gap of zero by every other measure on the card
   * — was reported as "much truer to your values when the decision was not yours", because the
   * three unrelated scenarios had dragged the average down. The number was measuring the rest of
   * the session, not the change of chair.
   *
   * Both halves now come from the matched pair: the same company, the same decision, the same six
   * options. That is the only comparison in which "the difference is responsibility" is true.
   *
   * The two can still differ when the SAME option is chosen twice, and legitimately so: scenario 4
   * is scored against the profile as it stood before its own update, scenario 5 against the profile
   * after it. That residue is real movement in the participant's values, not an artefact — but it
   * is small, where the old figure was dominated by scenarios that had nothing to do with the pair.
   */
  const vciActed = Math.round(decided.vciScore * 100);
  const vciWished = Math.round(wished.vciScore * 100);

  const mirrorGap = Math.round(decided.departure - wished.departure);
  const responsibilityGap = vciWished - vciActed;

  const sentence = sameOption
    ? `You wished for exactly what you chose. Deciding for your colleagues and being on the receiving end produced the same answer.`
    : mirrorGap > 0
      ? `You moved further from your own values when you were the one deciding (${decided.departure}) than when it was being done to you (${wished.departure}). You chose “${decided.optionTitle}” and wished for “${wished.optionTitle}”.`
      : mirrorGap < 0
        ? `You moved further from your own values when it was being done to you (${wished.departure}) than when you were deciding (${decided.departure}). You chose “${decided.optionTitle}” and wished for “${wished.optionTitle}”.`
        : `You chose “${decided.optionTitle}” and wished for “${wished.optionTitle}” — different options, but the same distance from your own values.`;

  const hurried = wished.seconds > 0 && wished.seconds < HURRIED_WISH_SECONDS;
  return { decided, wished, sameOption, mirrorGap, vciActed, vciWished, responsibilityGap, hurried, sentence };
}

/** Plain words for the responsibility gap. Deliberately about the situation, never the person. */
export function responsibilityGapLabel(gap: number): string {
  if (gap >= 20) return "Much truer to your values when the decision was not yours";
  if (gap >= 8) return "Somewhat truer to your values when the decision was not yours";
  if (gap > -8) return "About the same whether or not the decision was yours";
  if (gap > -20) return "Somewhat truer to your values when you had to decide";
  return "Much truer to your values when you had to decide";
}
