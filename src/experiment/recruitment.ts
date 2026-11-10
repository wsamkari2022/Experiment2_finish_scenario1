/**
 * recruitment.ts — who may take the study, and the participant's KEY.
 *
 * PROLIFIC ONLY (since 10 November 2026). The IRB refused the student group on 9 November 2026, so there is one way in.
 * Every address of the site opens the same first page (ProlificStartScreen): Prolific's link brings the participant's
 * Prolific ID (PROLIFIC_PID, STUDY_ID, SESSION_ID); without it the page asks them to paste the ID (the researcher's "3-A").
 * The student version is kept in the Git tag before-prolific-only.
 *
 * THE KEY. Everything that belongs to one participant (the browser's directory, every progress file's owner, the
 * condition's owner, the server's routes) is filed under their Prolific ID. The browser keeps carrying it where it always
 * carried the key (the `email` slot of a directory entry, `vrds_pending_email`: old names, kept on purpose, the
 * researcher's decision 4-A); the SERVER stores it under its true name, `prolific_pid`, and refuses anything else
 * (server/recruitment.js holds the same rule and validate:session C13 checks the two agree). An email has an @, a Prolific
 * ID never does, so an email can never pass for one.
 *
 * THE FORMAT. Prolific's help pages do not state it; in practice a Prolific ID is 24 letters a-f and digits. The study
 * accepts letters and digits only, 8 to 64 of them, so a future change at Prolific (or what its Preview sends) never
 * locks anybody out. Kept in lower case, like every key (Prolific's IDs are lower-case hexadecimal).
 */

/** What every record and arrival says about where its person came from. Stored as `recruitment_source`. */
export const RECRUITMENT_SOURCE = "prolific" as const;

/** The names Prolific gives its three link values. */
export const PROLIFIC_PARAM = { pid: "PROLIFIC_PID", study: "STUDY_ID", session: "SESSION_ID" } as const;

/** A Prolific ID (or study / session id) as the study accepts it, after lower-casing. */
export const PROLIFIC_ID = /^[a-z0-9]{8,64}$/;

/** The ID, trimmed and lower-cased, or null when it is not one (an email, a placeholder, junk). */
export function normalizeProlificId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toLowerCase();
  return PROLIFIC_ID.test(id) ? id : null;
}

/** Is this participant key a Prolific ID (and not an email)? */
export const isProlificKey = (key: string | null | undefined): boolean =>
  typeof key === "string" && !key.includes("@") && PROLIFIC_ID.test(key.trim().toLowerCase());

export interface ProlificParams {
  pid: string | null;
  studyId: string | null;
  sessionId: string | null;
}

/** Prolific's three values from an address's query string; each null when missing or malformed. */
export function prolificParamsFrom(search: string): ProlificParams {
  const params = new URLSearchParams(search);
  return {
    pid: normalizeProlificId(params.get(PROLIFIC_PARAM.pid)),
    studyId: normalizeProlificId(params.get(PROLIFIC_PARAM.study)),
    sessionId: normalizeProlificId(params.get(PROLIFIC_PARAM.session)),
  };
}

/** The same address with this Prolific ID in it (the paste box writes it there, so a refresh keeps it). */
export function addressWithProlificId(href: string, pid: string): string {
  const url = new URL(href);
  url.searchParams.set(PROLIFIC_PARAM.pid, pid);
  return url.toString();
}

/*
 * THE PROLIFIC FILE. The study and session ids Prolific sent, kept from the first page to the demographic page, where
 * the participant's record is made. `owner` is the Prolific ID they belong to.
 */
export const PROLIFIC_FILE_KEY = "vrds_prolific";

export interface ProlificFile {
  owner: string;
  studyId: string | null;
  sessionId: string | null;
}

export function writeProlificFile(file: ProlificFile): void {
  try {
    localStorage.setItem(PROLIFIC_FILE_KEY, JSON.stringify(file));
  } catch { /* storage unavailable: the record is made without the two ids */ }
}

/** The file for this Prolific ID, or null (none, or somebody else's). */
export function readProlificFile(owner: string | null | undefined): ProlificFile | null {
  try {
    const file = JSON.parse(localStorage.getItem(PROLIFIC_FILE_KEY) ?? "null") as ProlificFile | null;
    if (!file || typeof file !== "object" || !owner || file.owner !== owner.trim().toLowerCase()) return null;
    return {
      owner: file.owner,
      studyId: normalizeProlificId(file.studyId),
      sessionId: normalizeProlificId(file.sessionId),
    };
  } catch {
    return null;
  }
}

/*
 * ANOTHER PROLIFIC ID IN THE LINK. When the link names a Prolific ID and this browser holds a DIFFERENT person's run (a
 * shared computer), that run is set aside before the page reads
 * anything, so the newcomer never sees or continues it: every file is removed except these. The person before keeps
 * everything on the server, and their unsent saves stay queued, each naming its owner (storage.ts), so they still
 * reach the right record. A new session id is made for the newcomer (two records may not share one).
 */
export const KEPT_WHEN_ANOTHER_PERSON_ARRIVES: ReadonlySet<string> = new Set([
  "theme", "chakra-ui-color-mode",
  "vrds_local_participants",                                    // every person this machine has enrolled
  "vrds_outbox", "vrds_outbox_refused", "vrds_outbox_locked_out", // saves not yet sent, each naming its owner
  "vrds_browser_id",                                            // names the machine, not a person
  "vrds_active_tab",                                            // the one-tab rule
  "vrds_feedback_archive",
]);

/** The Prolific ID of the run this browser holds, or null. */
export function browserParticipantKey(): string | null {
  try {
    return localStorage.getItem("vrds_pending_email")
      ?? keyOfDemographics(JSON.parse(localStorage.getItem("vrds_demographics") ?? "null"));
  } catch {
    return null;
  }
}

/** Removes this browser's run (every file but the machine's: KEPT_WHEN_ANOTHER_PERSON_ARRIVES). */
export function setAsideThisBrowsersRun(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null) keys.push(key);
    }
    for (const key of keys) if (!KEPT_WHEN_ANOTHER_PERSON_ARRIVES.has(key)) localStorage.removeItem(key);
  } catch {
    /* storage unavailable: nothing to set aside */
  }
}

/** Sets another person's run aside when the link brings a different Prolific ID. True when it did. */
export function makeRoomForAnotherProlificId(search: string): boolean {
  const arriving = prolificParamsFrom(search).pid;
  const held = browserParticipantKey();
  if (!arriving || !held || held.trim().toLowerCase() === arriving) return false;
  setAsideThisBrowsersRun();
  return true;
}

/*
 * A RUN FROM BEFORE THE STUDY WAS PROLIFIC ONLY. Only a test browser can hold one (no student ever took the study): its key
 * is an email, which the server now refuses. It is set aside before the page reads anything, so the page starts fresh
 * and never tries to continue a run it cannot save.
 */
export function setAsideRunWithoutProlificId(): boolean {
  try {
    const pending = localStorage.getItem("vrds_pending_email");
    const demo = JSON.parse(localStorage.getItem("vrds_demographics") ?? "null") as { email?: unknown } | null;
    const held = pending ?? (typeof demo?.email === "string" ? demo.email : null);
    if (!held || isProlificKey(held)) return false;
    setAsideThisBrowsersRun();
    return true;
  } catch {
    return false;
  }
}

/** The Prolific ID a saved demographic record belongs to. */
export function keyOfDemographics(demo: { prolificPid?: unknown } | null | undefined): string | null {
  return typeof demo?.prolificPid === "string" && demo.prolificPid ? demo.prolificPid : null;
}
