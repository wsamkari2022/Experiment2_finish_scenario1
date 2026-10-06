/**
 * conditions.ts — the study's four conditions, and which one this participant is in (since 1 October 2026).
 *
 * THE RESEARCHER'S DESIGN (1 October 2026, his words): four conditions that share Blocks 1-4 (building the profile)
 * and differ from Block 5 to the end of the study:
 *
 *   1  CVR+APA   the current, full version
 *   2  CVR_Only
 *   3  APA_Only
 *   4  Baseline  no CVR and no APA
 *
 * WHAT EACH CONDITION DOES DIFFERENTLY (built from 1 October 2026, one task at a time, each on the researcher's approved
 * plan; `npm run validate:conditions` N11-N21 stand over it). Blocks 1-4, the rule (scenario 6), the scores' rules, the
 * results page's layout and the feedback page are the SAME in all four. Only what happens after a
 * MISALIGNED or STRONGLY MISALIGNED choice in one of the four decisions (scenarios 1-4) differs - except Baseline, which
 * since 3 October 2026 also hides the fit line and the ranking reasons on the cards and gives a good fit the same
 * confirmation page as a misfit (see below).
 *
 *   condition   the page a misfit opens                  keeping the misfit moves            refusing / going back
 *   ---------   --------------------------------------   ---------------------------------   ---------------------------
 *   1 CVR+APA   the reflection (CVR vignette, two         the endorsement: +30 to the value   refusing opens the APA page:
 *               views), then the person speaking          the option serves, -20 to the one   name a value, how sure, pick
 *                                                         it gives up most, person ±25        from its list (+30 x sure to
 *                                                                                             the value named, -10 x sure
 *                                                                                             to each other, person ±25,
 *                                                                                             the view that moved them +20)
 *   2 CVR_Only  the same reflection and person            the same endorsement                refusing opens the CVR
 *                                                                                             Rejection page: no question,
 *                                                                                             one button back; on its first
 *                                                                                             visit in a scenario the person
 *                                                                                             score ±25 and the last view
 *                                                                                             +20 (only if both were seen)
 *   3 APA_Only  the APA page at once: no reflection, no   naming the value the option is      "Take me back to all options"
 *               person; its own opening sentence; a box   built on (the box names it): +30 x  (no warning)
 *               naming the value the option serves most   sure / -10 x sure; the person
 *                                                         score never moves
 *   4 Baseline  the confirmation page with "Before you    Keep: +30 x sure to the value the   "Change my mind"
 *               confirm, take a moment with what this     option serves most, -10 (misaligned)
 *               option gives up." and "How sure are you   or -15 (strongly) x sure to the
 *               about this choice?" - since 3 October     other three
 *               2026 the SAME page for every choice
 *
 * BASELINE ALSO DIFFERS BEFORE ANY CHOICE (since 3 October 2026, hidesFitAndRankingReasons): its open option cards show
 * no fit line and no planner reasons, and every decision's confirmation page is the same for a good fit and a misfit
 * (confirmsEveryChoiceAlike; a good fit's "How sure" is recorded only). Conditions 1-3 show both, as before.
 *
 * WHAT IS THE SAME, AND WHAT THAT MEANS FOR THE ANALYSIS
 *   - A STABILITY STEP is a decision whose final choice went against the best fit after the condition's page
 *     (`cvrFired` on the row): kept after the reflection (1, 2), a choice confirmed on the APA page (1 after a refusal,
 *     3), kept on the confirmation page (4); going back to a good fit is not a step. Whether a REFLECTION was shown is a separate flag (`reflectionShown`, read through
 *     reflectionWasShown in block5CVR.ts), and since the audit of 2 October 2026 it is also true when the participant saw
 *     the reflection and then went back to a good fit.
 *   - Stability and Stability_all are the average of an order part and a difference part (block5CVR.ts, since 2 October
 *     2026), the same rule in every condition. docs/MAJOR_SCORES_BY_CONDITION.md shows what the conditions' own value
 *     moves do to them for the same behaviour (up to 13 points for Stability; VCI about 1).
 *   - The stakeholder, directness and context scores move only on the reflection pages, so their stabilities are "not
 *     measured" in 3 and 4 (freezesReflectionScores).
 *   - The feedback's CVR questions appear only after a reflection (1, 2), the APA questions only after an APA page
 *     (1, 3), the two-views questions only after a second view was opened (1, 2); Baseline sees none of the three.
 *   - Every condition's page is counted in the scenario's timing record: cvrVisits / apaVisits (1), cvrVisits /
 *     cvrRejectionVisits (2), apaVisits (3), baselineConfirmVisits / baselineConfirmBackouts (4, a misfit's page) and,
 *     since 3 October 2026, baselineGoodFitConfirmVisits / baselineGoodFitConfirmBackouts (4, the same page for a good fit).
 *
 * WHERE EACH DIFFERENCE LIVES. One rule per task below, read once per Block 5 by Block5PublicEmergencySimulation:
 *   showsCvrRejectionPage      condition 2   openRefusalPage, CvrRejectionPanel, handleRejectionBack
 *   skipsCvrReflection         condition 3   handleSelect (straight to step "apa"), APAPanel straightToApa, handleApaCommit
 *   confirmsMisalignedChoices  condition 4   handleSelect (stays on "review"), FlowOverlay confirmOnly, handleKeep,
 *                                            handleChangeMyMind
 *   hidesFitAndRankingReasons  condition 4   OptionCard showValueReasons, the performance panel's note, the wish page's
 *                                            sentence (FlowOverlay), Block5IntroPage section 6, the row's fitAndReasonsShown
 *   confirmsEveryChoiceAlike   condition 4   FlowOverlay askHowSure, handleKeep (howSureOnConfirm), handleSelect and
 *                                            handleChangeMyMind (the good-fit counts)
 *   freezesReflectionScores    conditions 3, 4   APAPanel freezeReflectionScores, finalResults.reflectionScoresFrozen
 * The rows each path saves: CLAUDE.md (the four condition sections); how to analyse them: HOW_TO_ANALYZE_MY_DATA.md
 * section 9; the same pretend people through all four: docs/MAJOR_SCORES_BY_CONDITION.md (tools/condition_sim.cjs).
 *
 * A participant with no condition on record (a test run from before 1 October 2026) is treated as condition 1, the
 * full version, which is what everybody saw before.
 *
 * HOW A PARTICIPANT GETS ONE. The landing page (LandingPage.tsx) asks the server, which counts each condition in
 * the database and gives the one with the fewest people (server/conditions.js has the rule; the researcher's answer
 * "Q1-B": people who finished, plus people still working in the last 2 hours, plus people who arrived in the last 30
 * minutes). Ties go to one of the tied conditions at random. The page then shows the condition in the address
 * (`?condition=CVR_APA`) so the researcher can see which one he is testing.
 *
 * WHERE IT COMES FROM is saved with it, because only one source is counted for balance:
 *   landing_page    given by the server's count (the only one counted)
 *   address         taken from `?condition=...` in the address the participant opened: a researcher testing one
 *                   condition on purpose ("Q2-yes"); never counted
 *   random_offline  the server could not be reached (local testing without `npm run server`); never counted
 *
 * ONCE SAVED IT NEVER CHANGES. The browser file is the participant's from the moment their email is known (`owner`),
 * the server sets the condition on the participant document only when it has none, and an address naming another
 * condition is corrected to the saved one. The file deliberately does NOT travel in resume_state: a new browser's
 * provisional condition would otherwise be merged over the saved one. A returning participant gets theirs from the
 * participant document instead (ExperimentFlow, onResume).
 *
 * The same list lives in server/conditions.js (the server cannot import TypeScript); `npm run validate:conditions`
 * fails if the two ever differ.
 */

import type { RecruitmentSource } from "./recruitment";

export const CONDITIONS = [
  { number: 1, type: "CVR+APA", urlName: "CVR_APA" },
  { number: 2, type: "CVR_Only", urlName: "CVR_Only" },
  { number: 3, type: "APA_Only", urlName: "APA_Only" },
  { number: 4, type: "Baseline", urlName: "Baseline" },
] as const;

export type Condition = (typeof CONDITIONS)[number];
export type ConditionNumber = Condition["number"];
export type ConditionType = Condition["type"];
export type ConditionSource = "landing_page" | "address" | "random_offline";

/** The browser file: this participant's condition. */
export const CONDITION_KEY = "vrds_condition";
/** The id of this browser's request to the landing page, kept so a refresh asks for the SAME arrival again. */
export const CONDITION_ARRIVAL_KEY = "vrds_condition_arrival";
/** The word in the address: `?condition=CVR_APA`. */
export const CONDITION_PARAM = "condition";
/** Bumped if the file's shape ever changes; a file under another version is not read. */
export const CONDITION_FILE_VERSION = 1;

export interface ConditionFile {
  version: typeof CONDITION_FILE_VERSION;
  number: ConditionNumber;
  type: ConditionType;
  source: ConditionSource;
  /** When the condition was given (ISO time). */
  assignedAt: string;
  /** The landing page's arrival id when the server gave it; null otherwise. */
  arrivalId: string | null;
  /** The participant's key (email or Prolific ID), lower case; "" until the start screen or the demographic page knows it. */
  owner: string;
  /** The door this condition was given at (since 6 October 2026; recruitment.ts); absent = the university door. */
  recruitmentSource?: RecruitmentSource;
}

/** What the server answers when it gives a condition. */
export interface AssignedCondition {
  number: ConditionNumber;
  type: ConditionType;
  arrivalId: string;
  assignedAt: string;
}

/** The condition as the participant document and the directory carry it. */
export interface SavedCondition {
  number: ConditionNumber;
  type: ConditionType;
  source: ConditionSource;
  assignedAt: string;
  /* Sent once with the first save, so the server can stop counting the landing page's arrival as a new one. */
  arrivalId?: string | null;
}

const SOURCES: readonly ConditionSource[] = ["landing_page", "address", "random_offline"];

export function conditionByNumber(n: unknown): Condition | null {
  return CONDITIONS.find((c) => c.number === Number(n)) ?? null;
}

export function conditionByType(t: unknown): Condition | null {
  return CONDITIONS.find((c) => c.type === t) ?? null;
}

/** Letters and digits only, lower case: "CVR_APA", "cvr apa" and "CVR+APA" all read the same. */
const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The condition named in an address's query (`?condition=...`), or null. Accepts the address word (CVR_APA), the
 * stored name (CVR+APA, whose "+" arrives as a space), any capitals, and the number 1-4.
 */
export function conditionFromAddress(search: string): Condition | null {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search).get(CONDITION_PARAM);
  } catch {
    return null;
  }
  if (!raw) return null;
  const word = squash(raw);
  if (!word) return null;
  return CONDITIONS.find((c) => squash(c.urlName) === word || squash(c.type) === word || String(c.number) === word)
    ?? null;
}

/** The same address with `?condition=` set to this condition; every other part (a Prolific ID later) is kept. */
export function addressFor(condition: Condition, href: string): string {
  const url = new URL(href);
  url.searchParams.set(CONDITION_PARAM, condition.urlName);
  return url.toString();
}

/** A condition saved somewhere else (the directory, the server's document), checked; null when it is not one. */
export function savedConditionOf(value: unknown): SavedCondition | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const byNumber = conditionByNumber(v.number);
  if (!byNumber || byNumber.type !== v.type) return null;
  const source = SOURCES.includes(v.source as ConditionSource) ? (v.source as ConditionSource) : "landing_page";
  return { number: byNumber.number, type: byNumber.type, source, assignedAt: String(v.assignedAt ?? "") };
}

function isConditionFile(value: unknown): value is ConditionFile {
  if (!value || typeof value !== "object") return false;
  const f = value as Record<string, unknown>;
  const c = conditionByNumber(f.number);
  return f.version === CONDITION_FILE_VERSION && !!c && c.type === f.type
    && SOURCES.includes(f.source as ConditionSource) && typeof f.owner === "string";
}

/** This browser's condition file, or null. */
export function readConditionFile(): ConditionFile | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONDITION_KEY) ?? "null") as unknown;
    return isConditionFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeConditionFile(file: ConditionFile): void {
  try {
    localStorage.setItem(CONDITION_KEY, JSON.stringify(file));
  } catch {
    /* Storage unavailable: the study still runs, in the condition held on screen. */
  }
}

export function makeConditionFile(
  condition: Condition, source: ConditionSource, arrivalId: string | null, owner: string, assignedAt?: string,
  recruitmentSource?: RecruitmentSource,
): ConditionFile {
  return {
    version: CONDITION_FILE_VERSION,
    number: condition.number,
    type: condition.type,
    source,
    assignedAt: assignedAt || new Date().toISOString(),
    arrivalId,
    owner: owner.trim().toLowerCase(),
    ...(recruitmentSource ? { recruitmentSource } : {}),
  };
}

/**
 * The condition this participant is in, for the code that will make the conditions differ. Null only before the
 * landing page has run; callers treat null as condition 1 (see the header).
 */
export function currentCondition(): Condition | null {
  const file = readConditionFile();
  return file ? conditionByNumber(file.number) : null;
}

/**
 * WHAT EACH CONDITION DOES DIFFERENTLY, one rule per task the researcher has given (the header says why they are added
 * one at a time). Each takes the condition so a check can ask about any of the four; the study passes none and gets
 * this participant's.
 *
 * CVR_Only (1 October 2026): somebody who refuses their choice after the reflection reaches the CVR Rejection page
 * (no questions, one button back to all the options; the views and the person speaking move automatically) instead
 * of the APA page.
 */
export function showsCvrRejectionPage(condition: Condition | null = currentCondition()): boolean {
  return condition?.type === "CVR_Only";
}

/*
 * APA_Only (1 October 2026): a misaligned or strongly misaligned choice goes STRAIGHT to the APA page - no reflection
 * (CVR) page and no person speaking - and the APA page shows only its value question (the two-situations table and the
 * "which view did more" question need views, and none are shown). The researcher's answers: Q1-A the stakeholder,
 * directness and context scores are left as Blocks 1-4 made them (nothing in this condition shows or learns them, so
 * nothing moves them - not even the APA rule's automatic stakeholder move); Q2-yes each APA visit is a Stability step;
 * Q3-yes the results page says "Clarification shown", never "Reflection shown".
 */
export function skipsCvrReflection(condition: Condition | null = currentCondition()): boolean {
  return condition?.type === "APA_Only";
}

/*
 * Baseline (1 October 2026): no reflection and no APA page. A misaligned or strongly misaligned choice gets the same
 * confirmation page a good fit gets, with its own first sentence ("Q1-B": "This option fits your earlier priorities"
 * would be untrue) and "How sure are you about this choice?"; keeping it moves the four values the way the APA page's
 * confirm does (applyBaselineConfirmUpdatesWithMoves in block5CVR.ts). Each such keep is a Stability step ("Q2-yes").
 */
export function confirmsMisalignedChoices(condition: Condition | null = currentCondition()): boolean {
  return condition?.type === "Baseline";
}

/*
 * Baseline, the second task (3 October 2026; the researcher, from his advisor: "doesn't want to show the alignment score
 * or ranking reasoning in the baseline condition only", plan answers "Q1-A, Q2-A, Q3-yes"). While choosing, the open
 * option card shows no fit line ("Matches your earlier answers: N out of 100") and none of the planner's reasons for its
 * place ("Ranked N - why": beat N of the others, decided on X, against Y, the trade line, the limit line and its label);
 * "How it performs" stays. The sentences that pointed at that line are reworded (the performance panel's note, the page
 * before Block 5, section 6), and the wish page (scenario 5) drops its "close to what you said matters most" sentence.
 * The card ORDER and its numbers 1-6, "Compare all options" with the MCF, "Your values in this scenario" and the results
 * page after all choices are unchanged. This is Fix 1's card part (audit A1, A2, A8), for Baseline only.
 */
export function hidesFitAndRankingReasons(condition: Condition | null = currentCondition()): boolean {
  return condition?.type === "Baseline";
}

/*
 * Baseline, the same task: EVERY choice in a decision (scenarios 1-4) opens the same confirmation page - the sentence
 * "Before you confirm, take a moment with what this option gives up." and "How sure are you about this choice?" - so the
 * page itself no longer tells the participant whether the choice fits (a good fit used to read "This option fits your
 * earlier priorities" and had no question). On a good fit the answer is RECORDED ONLY ("Q2-A"): the keep rule moves the
 * values exactly as in the other three conditions, and keeping a good fit is never a Stability step.
 */
export function confirmsEveryChoiceAlike(condition: Condition | null = currentCondition()): boolean {
  return condition?.type === "Baseline";
}

/** The stakeholder, directness and context scores never move in this condition: nothing in it shows or learns them
    (APA_Only, the researcher's "Q1-A"; Baseline, which has no reflection and no APA page at all). */
export function freezesReflectionScores(condition: Condition | null = currentCondition()): boolean {
  return condition?.type === "APA_Only" || condition?.type === "Baseline";
}

/** The two fields the researcher asked for beside the demographic answers ("Condition number", "Condition type"). */
export function conditionFields(file: ConditionFile | null): { conditionNumber: ConditionNumber; conditionType: ConditionType } | null {
  return file ? { conditionNumber: file.number, conditionType: file.type } : null;
}

/** The file as the participant document and the directory carry it. */
export function savedFrom(file: ConditionFile | null): SavedCondition | null {
  return file
    ? { number: file.number, type: file.type, source: file.source, assignedAt: file.assignedAt, arrivalId: file.arrivalId }
    : null;
}

/** Shows the saved condition in the address bar without reloading (the researcher's request: he sees which one). */
export function showConditionInAddress(file: ConditionFile | null): void {
  if (!file || typeof window === "undefined") return;
  const condition = conditionByNumber(file.number);
  if (!condition) return;
  try {
    const next = addressFor(condition, window.location.href);
    if (next !== window.location.href) window.history.replaceState(window.history.state, "", next);
  } catch {
    /* An address that cannot be rewritten changes nothing about the study. */
  }
}

/**
 * Takes the condition out of the address. Used before the landing page runs again for a second person on the same
 * computer: the address still shows the first person's condition, and the landing page would read it as a tester's
 * choice (never counted) instead of asking the server.
 */
export function clearConditionFromAddress(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(CONDITION_PARAM)) return;
    url.searchParams.delete(CONDITION_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* ignore */
  }
}

/** A fresh arrival id: random, so two browsers never share one. */
export function newArrivalId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* fall through */ }
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** A condition at random, each about one time in four (used only when the server cannot be reached). */
export function randomCondition(random: () => number = Math.random): Condition {
  return CONDITIONS[Math.min(CONDITIONS.length - 1, Math.floor(random() * CONDITIONS.length))];
}
