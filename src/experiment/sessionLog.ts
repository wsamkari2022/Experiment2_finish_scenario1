/**
 * sessionLog.ts — how many times this participant sat down, and on how many machines.
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * The study already promises a participant may stop and come back, and it already supports
 * carrying a half-finished run to another computer. Neither of those left a trace anybody could
 * read afterwards. The record said a run took four days and 38 active minutes, and nothing said
 * whether that was two sittings or eleven, one laptop or three.
 *
 * That matters for more than curiosity. A run spread over many logins is a different kind of data
 * from one done in a sitting: attention resets, the scenarios are re-read cold, and Block 5's
 * profile was built on a day the participant may barely remember. An analyst who cannot see that
 * has no way to control for it, and no way to notice that the one strange record in the set was
 * somebody logging in from a second machine halfway through Block 3.
 *
 * `active_time.sittings` is NOT this number. It counts gaps of more than thirty minutes between
 * activity, which happens while a tab sits open over lunch. This counts the study being OPENED
 * with a participant identified — a login, in the ordinary sense of the word.
 *
 * ============================================================================
 * WHAT IT DELIBERATELY DOES NOT COLLECT
 * ============================================================================
 * No user-agent string, no screen size, no platform, no IP, nothing that would fingerprint a
 * device. A browser is identified by a random id this file generates, which says only "this is the
 * same browser as last time" or "this is a different one". That answers every question the study
 * has — did they move machine, how many did they use — and answers no question it does not have.
 * The consent form promises answers to a moral-psychology study, not a device inventory.
 *
 * ============================================================================
 * WHY THE BROWSER ID IS NOT ON THE RESUME LIST AND THE HISTORY IS
 * ============================================================================
 * `vrds_session_log` travels with a participant to a new computer (see RESUME_FILES in dbShape),
 * so their history follows them and the count stays true. `vrds_browser_id` must NOT: it names the
 * machine it was made on, and copying it to the second machine would make two computers look like
 * one — which is the exact fact this file exists to record.
 */

/** Random, per-browser, and never sent anywhere except inside a session row. */
export const BROWSER_ID_KEY = "vrds_browser_id";

/** The history itself. On the resume list, so it follows a participant to another machine. */
export const SESSION_LOG_KEY = "vrds_session_log";

/**
 * How a session began. Stored as a word rather than a flag, because "resumed" alone would not
 * distinguish the two cases that matter most: continuing where the answers already are, and
 * arriving on a machine that had to download them.
 */
export type SessionStart =
  | "typed_their_email"
  | "continued_in_this_browser"
  | "restored_from_another_device";

export interface SessionEntry {
  browserId: string;
  startedAt: number;
  lastSeenAt: number;
  stageAtStart: string;
  stageAtLastSeen: string;
  how: SessionStart;
  /**
   * WHAT THIS LOGIN DID TO THE VISIT COUNT, recorded at the moment it was decided.
   *
   * The count and the login history are produced by different files, and when they disagreed there
   * was no way to tell which login had failed to add its visit - three logins from three browsers
   * once produced two visits, and the record held nothing that said which one. Every login now
   * carries its own answer: whether the previous login was on a different browser, and whether a
   * visit was counted for it. Two of these fields, and the disagreement explains itself.
   */
  browserChanged?: boolean;
  countedAVisit?: boolean;
}

export interface SessionLog {
  sessions: SessionEntry[];
  /** How many rows fell off the front of the list. Kept so a total is never quietly wrong. */
  dropped: number;
}

/**
 * A cap, because this list is uploaded with every sync and a participant who opens the tab a
 * hundred times should not grow their document without limit. The oldest rows go first and the
 * count of what went is kept, so `total_logins` stays correct even when the list is not complete.
 */
const MAX_SESSIONS = 60;

const EMPTY: SessionLog = { sessions: [], dropped: 0 };

function read(): SessionLog {
  try {
    const raw = localStorage.getItem(SESSION_LOG_KEY);
    if (!raw) return { sessions: [], dropped: 0 };
    const parsed = JSON.parse(raw) as Partial<SessionLog>;
    return {
      sessions: Array.isArray(parsed.sessions) ? (parsed.sessions as SessionEntry[]) : [],
      dropped: typeof parsed.dropped === "number" ? parsed.dropped : 0,
    };
  } catch {
    return { sessions: [], dropped: 0 };
  }
}

function write(log: SessionLog): void {
  try {
    localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(log));
  } catch {
    /* Storage unavailable. The run continues; only this ledger is lost. */
  }
}

/** This browser's id, made once and kept. Never leaves the row it is written into. */
export function browserId(): string {
  try {
    const existing = localStorage.getItem(BROWSER_ID_KEY);
    if (existing) return existing;
    const made =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(BROWSER_ID_KEY, made);
    return made;
  } catch {
    /* No storage: every load looks like a new browser, which is the safe direction to be wrong
       in — it over-counts machines rather than hiding one. */
    return "unknown-browser";
  }
}

/** True once a session has been opened in THIS page load. Module state, so a re-render cannot
 *  append a second row for the same sitting. */
let openedThisLoad = false;

/** What one call to noteLogin did, for the caller that needs to know. */
export interface LoginResult {
  /** False when a login had already been recorded in this page load. */
  recorded: boolean;
  /**
   * True when the previous login came from a DIFFERENT browser — the participant has moved
   * machine. The study counts that as a new visit, and only this file can see it, so it is
   * reported rather than inferred. See noteNewVisit in activeTime.ts.
   */
  browserChanged: boolean;
}

/**
 * Records that the study was opened with a participant identified.
 *
 * Safe to call more than once per page load: only the first call writes. That matters because the
 * flow identifies a participant from several places — a typed address, a resumed run, a restored
 * download — and more than one of them can fire in a single load.
 */
export function noteLogin(how: SessionStart, stage: string): LoginResult {
  if (openedThisLoad) return { recorded: false, browserChanged: false };
  openedThisLoad = true;

  const log = read();
  const now = Date.now();
  const previous = log.sessions[log.sessions.length - 1];
  const browserChanged = previous !== undefined && previous.browserId !== browserId();
  log.sessions.push({
    browserId: browserId(),
    startedAt: now,
    lastSeenAt: now,
    stageAtStart: stage || "start",
    stageAtLastSeen: stage || "start",
    how,
    browserChanged,
    countedAVisit: false,   // set by recordVisitOutcome once the clock has answered
  });
  while (log.sessions.length > MAX_SESSIONS) {
    log.sessions.shift();
    log.dropped += 1;
  }
  write(log);
  return { recorded: true, browserChanged };
}

/**
 * Writes down whether this login actually added a visit.
 *
 * Called straight after the clock has been asked, so the login history and the visit count can be
 * compared later without re-running anything. Silent when no login has been recorded in this load.
 */
export function recordVisitOutcome(counted: boolean): void {
  if (!openedThisLoad) return;
  const log = read();
  const current = log.sessions[log.sessions.length - 1];
  if (!current) return;
  current.countedAVisit = counted;
  write(log);
}

/**
 * Keeps the current session's end time and stage current.
 *
 * Called on every stage change, so a session that was abandoned mid-study still says where it got
 * to. Does nothing if no session has been opened — an unidentified visitor is not a login.
 */
export function touchSession(stage: string): void {
  if (!openedThisLoad) return;
  const log = read();
  const current = log.sessions[log.sessions.length - 1];
  if (!current) return;
  current.lastSeenAt = Date.now();
  if (stage) current.stageAtLastSeen = stage;
  write(log);
}

/**
 * A note left for the NEXT page load.
 *
 * Restoring a run from the server ends in a deliberate reload (the app reads its files once, at
 * startup), so the login that follows looks exactly like somebody opening the study again on the
 * same machine. Without this marker it would be recorded as one, and the single fact this ledger
 * exists to catch - that they arrived from another device - would be the one fact it lost.
 */
const LOGIN_KIND_KEY = "vrds_next_login_kind";

/** Says how the login after the coming reload should be recorded. */
export function markNextLoginAs(how: SessionStart): void {
  try {
    localStorage.setItem(LOGIN_KIND_KEY, how);
  } catch {
    /* Storage unavailable: the next login is recorded as an ordinary one. */
  }
}

/** Reads that note and clears it, so it can never describe a second load as well. */
export function consumeLoginKind(): SessionStart | null {
  try {
    const value = localStorage.getItem(LOGIN_KIND_KEY);
    if (!value) return null;
    localStorage.removeItem(LOGIN_KIND_KEY);
    return value === "typed_their_email"
      || value === "continued_in_this_browser"
      || value === "restored_from_another_device"
      ? value
      : null;
  } catch {
    return null;
  }
}

/** The ledger as it stands, for anything that wants to read it without importing storage. */
export function readSessionLog(): SessionLog {
  try {
    return read();
  } catch {
    return EMPTY;
  }
}
