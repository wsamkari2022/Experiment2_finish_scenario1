/**
 * server/recruitment.js — who may have a record (Prolific only since 10 November 2026).
 *
 * The IRB refused the student group on 9 November 2026. A participant's key is their Prolific ID, and it is the only key
 * the server accepts: every route with a key refuses anything else (`isProlificKey`; an email is refused with 400), so no
 * email can reach the database. Every route finds the record with `whoIs(key)`, `{ prolific_pid }`. The same rule lives in
 * src/experiment/recruitment.ts (this file cannot import TypeScript); validate:session C13 fails if the two differ.
 * The student version is kept in the Git tag before-prolific-only.
 */

/** What every record and arrival says about where its person came from. */
export const RECRUITMENT_SOURCE = "prolific";

/** A Prolific ID (or study / session id), after lower-casing: letters and digits, 8-64. */
export const PROLIFIC_ID = /^[a-z0-9]{8,64}$/;

/** Every key, trimmed and lower-cased. */
export const normalizeKey = (value) => String(value ?? "").trim().toLowerCase();

export const isProlificKey = (key) => typeof key === "string" && !key.includes("@") && PROLIFIC_ID.test(normalizeKey(key));

/** The filter that finds this participant's record. */
export const whoIs = (key) => ({ prolific_pid: normalizeKey(key) });

/** The key a request names: the Prolific ID it sent ("" when none). */
export const keyFromBody = (body) => normalizeKey(body?.prolificPid);

/** A study or session id from the page, or null. */
export const prolificIdOrNull = (value) => {
  const id = normalizeKey(value);
  return PROLIFIC_ID.test(id) ? id : null;
};

/** The facts that belong to the FIRST time this person is seen. */
export const identityOnInsert = (key) => ({ prolific_pid: normalizeKey(key), recruitment_source: RECRUITMENT_SOURCE });

/** Prolific's study and session ids, set only when the page sent them (a resume that does not know them never erases them). */
export const prolificIdsFrom = (body) => {
  const study = prolificIdOrNull(body?.prolificStudyId);
  const session = prolificIdOrNull(body?.prolificSessionId);
  return { ...(study ? { prolific_study_id: study } : {}), ...(session ? { prolific_session_id: session } : {}) };
};

/** How an arrival is linked to its person. */
export const arrivalLink = (key) => ({ linked_prolific_pid: normalizeKey(key) });
