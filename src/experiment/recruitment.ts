/**
 * recruitment.ts — the two doors into the study, and the participant's KEY (since 6 October 2026).
 *
 * The researcher's decision ("1-A"): one website, two doors.
 *   - https://moonlander.fit.edu            the university door: FIT students and employees, exactly as before
 *                                            (the email is the key, the $5 gift card);
 *   - https://moonlander.fit.edu/prolific   the Prolific door: Prolific opens it with the participant's Prolific ID in
 *                                            the link (PROLIFIC_PID, STUDY_ID, SESSION_ID), and nobody types an email.
 *
 * THE KEY. Everything that belongs to one participant (the browser's directory, every progress file's owner, the
 * condition's owner, the server's routes) is filed under one string: their email (university door) or their Prolific
 * ID (Prolific door). The browser keeps carrying that string where it always carried the email (the `email` slot of a
 * directory entry, `vrds_pending_email`); the SERVER stores a Prolific ID under its true name, `prolific_pid`, never in
 * `email` (server/recruitment.js holds the same rule and validate:session C13 checks the two agree). An email always
 * has an @, a Prolific ID never does, so the two can never be mistaken for each other.
 *
 * THE FORMAT. Prolific's help pages do not state it; in practice a Prolific ID is 24 letters a-f and digits. The study
 * accepts letters and digits only, 8 to 64 of them, so a future change at Prolific (or what its Preview sends) never
 * locks anybody out. Kept in lower case, like every key (Prolific's IDs are lower-case hexadecimal).
 */

export type RecruitmentSource = "university" | "prolific";
export const RECRUITMENT_SOURCES: readonly RecruitmentSource[] = ["university", "prolific"];

/** The Prolific door's address. */
export const PROLIFIC_PATH = "/prolific";
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

/** Which door a key belongs to. */
export const keyDoor = (key: string): RecruitmentSource => (isProlificKey(key) ? "prolific" : "university");

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

/** The door an address opens: /prolific, or a Prolific ID in the link, is the Prolific door; anything else the university's. */
export function doorFromAddress(pathname: string, search: string): RecruitmentSource {
  if (pathname.toLowerCase().replace(/\/+$/, "") === PROLIFIC_PATH) return "prolific";
  if (pathname.toLowerCase().startsWith(`${PROLIFIC_PATH}/`)) return "prolific";
  return prolificParamsFrom(search).pid ? "prolific" : "university";
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
 * shared computer, or somebody who did the university version here), that run is set aside before the page reads
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

/** The key of the run this browser holds (email or Prolific ID), or null. */
export function browserParticipantKey(): string | null {
  try {
    return localStorage.getItem("vrds_pending_email")
      ?? keyOfDemographics(JSON.parse(localStorage.getItem("vrds_demographics") ?? "null"));
  } catch {
    return null;
  }
}

/** Sets another person's run aside when the link brings a different Prolific ID. True when it did. */
export function makeRoomForAnotherProlificId(search: string): boolean {
  const arriving = prolificParamsFrom(search).pid;
  const held = browserParticipantKey();
  if (!arriving || !held || held.trim().toLowerCase() === arriving) return false;
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
  return true;
}

/** The key a saved demographic record belongs to: its email (university door) or its Prolific ID. */
export function keyOfDemographics(demo: { email?: unknown; prolificPid?: unknown } | null | undefined): string | null {
  if (typeof demo?.email === "string" && demo.email) return demo.email;
  if (typeof demo?.prolificPid === "string" && demo.prolificPid) return demo.prolificPid;
  return null;
}
