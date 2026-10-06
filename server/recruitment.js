/**
 * server/recruitment.js — the two doors on the server's side (since 6 October 2026).
 *
 * A participant's key is their email (the university door) or their Prolific ID (the Prolific door). Every route
 * receives the key and finds the record with `whoIs(key)`: `{ email }` or `{ prolific_pid }`. A Prolific ID is stored
 * under `prolific_pid` and NEVER in `email`, so the database reads truthfully. The same rule lives in
 * src/experiment/recruitment.ts (this file cannot import TypeScript); validate:session C13 fails if the two differ.
 */

export const RECRUITMENT_SOURCES = ["university", "prolific"];

/** A Prolific ID (or study / session id), after lower-casing: letters and digits, 8-64. */
export const PROLIFIC_ID = /^[a-z0-9]{8,64}$/;

/** Every key, either kind, trimmed and lower-cased (the email rule since September 2026). */
export const normalizeKey = (value) => String(value ?? "").trim().toLowerCase();

export const isProlificKey = (key) => typeof key === "string" && !key.includes("@") && PROLIFIC_ID.test(normalizeKey(key));

/** The filter that finds this participant's record. */
export const whoIs = (key) => (isProlificKey(key) ? { prolific_pid: normalizeKey(key) } : { email: normalizeKey(key) });

/** The key a request names: a Prolific ID when one is sent, otherwise the email. */
export const keyFromBody = (body) => normalizeKey(body?.prolificPid ?? body?.email);

/** A study or session id from the page, or null. */
export const prolificIdOrNull = (value) => {
  const id = normalizeKey(value);
  return PROLIFIC_ID.test(id) ? id : null;
};

/** The facts that belong to the FIRST time this person is seen: their key under its true name, and their door. */
export const identityOnInsert = (key) => (isProlificKey(key)
  ? { prolific_pid: normalizeKey(key), recruitment_source: "prolific" }
  : { email: normalizeKey(key), recruitment_source: "university" });

/** Prolific's study and session ids, set only when the page sent them (a resume that does not know them never erases them). */
export const prolificIdsFrom = (body) => {
  const study = prolificIdOrNull(body?.prolificStudyId);
  const session = prolificIdOrNull(body?.prolificSessionId);
  return { ...(study ? { prolific_study_id: study } : {}), ...(session ? { prolific_session_id: session } : {}) };
};

/** The landing page's door, as the page sent it; anything else is the university door. */
export const recruitmentSourceOf = (value) => (RECRUITMENT_SOURCES.includes(value) ? value : "university");

/** How an arrival is linked to its person: `linked_email` or `linked_prolific_pid`. */
export const arrivalLink = (key) => (isProlificKey(key)
  ? { linked_prolific_pid: normalizeKey(key) }
  : { linked_email: normalizeKey(key) });
