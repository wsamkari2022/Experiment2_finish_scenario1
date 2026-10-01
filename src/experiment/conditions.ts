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
 * WHAT EACH CONDITION DOES DIFFERENTLY IS NOT BUILT YET. On the researcher's instruction the four run the same study
 * until he gives one task per condition ("do this task to CVR_Only"). Code that later makes a condition behave
 * differently reads `currentCondition()`. A participant with no condition on record (a test run from before this
 * date) is treated as condition 1, the full version, which is what everybody saw before.
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
  /** The participant's email, lower case; "" until the start screen or the demographic page knows it. */
  owner: string;
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
): ConditionFile {
  return {
    version: CONDITION_FILE_VERSION,
    number: condition.number,
    type: condition.type,
    source,
    assignedAt: assignedAt || new Date().toISOString(),
    arrivalId,
    owner: owner.trim().toLowerCase(),
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
