/**
 * session.ts — the unified, anonymous session id for one participant run.
 *
 * One id is generated once on the first call, persisted in LocalStorage, and reused
 * everywhere (every block result, the telemetry record, and the feedback record) under
 * the field name `session_id`. It is the natural primary/foreign key when these records
 * are later moved to MongoDB — every collection joins on `session_id`.
 *
 * Privacy: this is a random UUID only. No name, email, phone, or student id is ever stored.
 *
 * Lifetime note: the id lives in LocalStorage (not sessionStorage), so it persists across
 * tab/refresh — giving ONE stable id per participant for the whole experiment. A new
 * participant begins only on an explicit Start-Over / Finish, which calls `resetSession()`
 * (or clears LocalStorage), after which the next call to `getSessionId()` mints a fresh id.
 */

/** LocalStorage key holding the participant's unified session id. */
export const SESSION_ID_KEY = "vrds_session_id";

/** Generates a random UUID, with a safe fallback for environments without crypto.randomUUID. */
function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the manual fallback
  }
  // RFC4122-ish fallback (only used if crypto.randomUUID is unavailable).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns this participant's session id, generating and persisting one on first use.
 * Stable across refreshes until `resetSession()` (or a LocalStorage clear) runs.
 */
export function getSessionId(): string {
  try {
    const saved = localStorage.getItem(SESSION_ID_KEY);
    if (saved) return saved;
    const id = generateId();
    localStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    // LocalStorage unavailable (e.g. privacy mode): fall back to a volatile id so the
    // app still runs. It won't persist, but nothing crashes.
    return generateId();
  }
}

/** Clears the session id so the next `getSessionId()` mints a fresh participant id. */
export function resetSession(): void {
  try {
    localStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // ignore
  }
}
