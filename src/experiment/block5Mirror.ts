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
 * them. It is a flag for the analyst, never a judgment shown to the participant.
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
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY WAY THE TWINS COULD DRIFT APART, LISTED.
 *
 * THIS IS A PRECONDITION OF THE MEASURE, NOT A NICETY. The mirror's whole claim is that nothing
 * changed except the chair the participant sits in — decide for others, then wish for yourself.
 * The moment one side is edited alone, every number downstream still computes and silently starts
 * measuring CONTENT instead of POSITION, which is the one thing it exists to rule out.
 *
 * IT USED TO COMPARE TITLES AND NOTHING ELSE. That is the weakest version of this check there is:
 * it passes while a `givesUp` line, a whole fingerprint or all five performance numbers differ
 * between the two halves. Scenario 4's audit is about to rewrite exactly those fields, six options
 * at a time, and a title-only guard would have reported everything fine.
 *
 * WHAT MAY LEGITIMATELY DIFFER, and is therefore not compared:
 *   - `id`, because the two halves are prefixed (care_… and wish_…);
 *   - `cvrSeed`, because a recipient scenario runs no reflection and carries none by design —
 *     simulate_position.cjs asserts that separately;
 *   - `method.detail` — THE ONE LINE UNDER THE METHOD'S NAME. The researcher's decision,
 *     18 September 2026. Scenario 4's boxes were shortened so that no detail line repeats its own
 *     card; scenario 5 keeps its original, longer lines. The reasoning: scenario 5 differs from 4
 *     only in this box and in running no misaligned check at all, and scenarios 5 and 6 are kept
 *     deliberately light - they test the position effect and nothing else, without the reflection
 *     and clarification that scenario 4 puts a participant through.
 *
 *     ONLY THE DETAIL LINE IS EXEMPT. The method's `kind` (its icon) and `by` (its bold name) are
 *     still compared, so both halves must still name the same method the same way. A change to
 *     either on one side alone is still caught.
 *
 *     WHAT THIS COSTS, recorded so nobody rediscovers it: the two screens now differ by one short
 *     line per card. The position effect assumes the content is held constant, and this is a small,
 *     known exception to that - a difference in how the method is explained, not in what the option
 *     is, does, costs or scores.
 *   - everything at SCENARIO level: the situation box, the role and the title are meant to differ,
 *     since one scenario asks what you decide and the other what you hope somebody else decides.
 *
 * FIELDS ARE READ OFF THE OBJECTS rather than from a list written here. A list is a thing to
 * forget to update: add a field to Block5ScenarioOption, author it on one side, and a hardcoded
 * comparison keeps reporting a match. The union of both sides' own keys cannot miss one.
 *
 * Returns a readable description of each difference, most useful first.
 * ════════════════════════════════════════════════════════════════════════════════════════════
 */
export function mirrorContentDifferences(deciderId: string, recipientId: string): string[] {
  const a = BLOCK5_SCENARIOS.find((s) => s.id === deciderId);
  const b = BLOCK5_SCENARIOS.find((s) => s.id === recipientId);
  if (!a) return [`no scenario with id ${deciderId}`];
  if (!b) return [`no scenario with id ${recipientId}`];
  if (a.options.length !== b.options.length) {
    return [`option counts differ: ${a.options.length} vs ${b.options.length}`];
  }

  /** Field names that are allowed to differ, for the reasons in the note above. */
  const EXEMPT = new Set(["id", "cvrSeed"]);

  const out: string[] = [];
  const short = (v: unknown) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s === undefined ? "(absent)" : s.length > 64 ? s.slice(0, 61) + "…" : s;
  };

  a.options.forEach((x, i) => {
    const y = b.options[i];
    /* The union, so a field authored on ONE side only is caught rather than skipped. */
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => !EXEMPT.has(k));
    for (const k of keys) {
      const xv = (x as unknown as Record<string, unknown>)[k];
      const yv = (y as unknown as Record<string, unknown>)[k];
      /* Deep for fingerprint, metrics and method; plain for the strings. Stable key order both
         sides, so a difference is a real difference and not a reordering of the same object. */
      const norm = (v: unknown) =>
        v && typeof v === "object"
          ? JSON.stringify(Object.fromEntries(Object.entries(v as object)
              /* the one permitted difference: see `method.detail` in the note above */
              .filter(([sub]) => !(k === "method" && sub === "detail"))
              .sort()))
          : JSON.stringify(v);
      if (norm(xv) !== norm(yv)) {
        out.push(`option ${i + 1} (${x.id} / ${y.id}) differs on "${k}": ${short(xv)}  ≠  ${short(yv)}`);
      }
    }
  });
  return out;
}

/**
 * Do the two scenarios really offer the same six options?
 *
 * Kept as a boolean for the callers that only need one, and now backed by the full comparison
 * above rather than by a title check. See `mirrorContentDifferences` for what is compared and why.
 *
 * Exported so tools/simulate_position.cjs can assert it rather than trusting it.
 */
export function mirrorContentMatches(deciderId: string, recipientId: string): boolean {
  return mirrorContentDifferences(deciderId, recipientId).length === 0;
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
