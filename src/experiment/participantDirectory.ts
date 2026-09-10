/**
 * participantDirectory.ts — who has taken part, keyed by email.
 *
 * WHAT THIS IS
 * The stand-in for the `participants` collection in MongoDB. It holds one entry per email
 * address: their details, their completion status, and where they stopped. The start screen asks
 * it whether an address is known; the demographic page writes the entry; the flow keeps the
 * stopping point up to date.
 *
 * WHY IT EXISTS BEFORE THE DATABASE DOES
 * Every rule that makes "leave and come back" work — one email is one person, a finished study
 * cannot be taken twice, returning details must match what was given before — is a rule about
 * this directory, not about MongoDB. Writing it here first means those rules can be built and
 * TESTED today, and the database step becomes a swap of the four functions below rather than a
 * redesign. The shape of an entry is deliberately the shape of the future document.
 *
 * WHAT IT CANNOT DO YET
 * It is LocalStorage, so it only knows the participants who used THIS browser. A participant
 * returning on a different machine will not be found, and will be treated as new. That is the
 * single thing the server fixes, and it is the reason the server exists.
 *
 * SEPARATE FROM THE RUNNING SESSION ON PURPOSE
 * The keys the study itself uses (`experiment_flow_stage`, `vrds_demographics`, and the block
 * results) describe the run in progress. This directory describes PEOPLE, and it survives when
 * those are cleared — which is what lets a returning participant be recognised after a session
 * is lost. Nothing here is ever deleted by the app.
 */

/** The two values the status may take. Nothing else is a valid status. */
export const STATUS_NOT_COMPLETED = "Study Not Completed";
export const STATUS_COMPLETED = "Study Completed";
export type ParticipantStatus = typeof STATUS_NOT_COMPLETED | typeof STATUS_COMPLETED;

/** LocalStorage key holding the whole directory, an object keyed by normalised email. */
const DIRECTORY_KEY = "vrds_local_participants";

/** One person. Mirrors the MongoDB document planned in CONSENT_DEMOGRAPHICS_MONGODB_PLAN.md. */
export interface DirectoryEntry {
  email: string;
  sessionId: string;
  age: number;
  gender: string;
  status: ParticipantStatus;
  /** The stage they last reached, so a return can resume exactly there. */
  stage: string;
  consent: { agreed: boolean; timestamp: string; version: string } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/**
 * One address, one form.
 *
 * Trimmed and lower-cased everywhere an address is read or written. Without this,
 * `Waseem@x.com` and `waseem@x.com` are two different participants, and the "one email is one
 * person" rule fails on nothing more than a capital letter.
 */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function readAll(): Record<string, DirectoryEntry> {
  try {
    const raw = localStorage.getItem(DIRECTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, DirectoryEntry>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, DirectoryEntry>): void {
  try {
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify(all));
  } catch {
    /* Storage unavailable. The study still runs; only the return-later feature is lost. */
  }
}

/** Returns the entry for an address, or null if this address has never been seen. */
export function lookupByEmail(email: string): DirectoryEntry | null {
  return readAll()[normalizeEmail(email)] ?? null;
}

/**
 * Creates the entry for a new participant, or updates the details of an existing one.
 *
 * Returns the stored entry. Note that `createdAt` is preserved on an update: the first time an
 * address was seen is a fact about the participant and must not be rewritten by a later visit.
 */
export function upsertParticipant(input: {
  email: string;
  sessionId: string;
  age: number;
  gender: string;
  stage: string;
  consent: DirectoryEntry["consent"];
}): DirectoryEntry {
  const all = readAll();
  const key = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const existing = all[key];

  const entry: DirectoryEntry = {
    email: key,
    sessionId: input.sessionId,
    age: input.age,
    gender: input.gender,
    /* An existing status is never downgraded here. Someone who has finished stays finished. */
    status: existing?.status ?? STATUS_NOT_COMPLETED,
    stage: input.stage,
    consent: input.consent ?? existing?.consent ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    completedAt: existing?.completedAt ?? null,
  };

  all[key] = entry;
  writeAll(all);
  return entry;
}

/** Records how far a known participant has got. Silently does nothing for unknown addresses. */
export function updateStage(email: string, stage: string): void {
  const all = readAll();
  const key = normalizeEmail(email);
  const entry = all[key];
  if (!entry) return;
  entry.stage = stage;
  entry.updatedAt = new Date().toISOString();
  writeAll(all);
}

/**
 * Marks a participant finished. The ONLY function that may set STATUS_COMPLETED.
 *
 * Called from one place — after the feedback answers are submitted — so that "completed" always
 * means the same thing: they reached the end, not that they got close to it.
 */
export function markCompleted(email: string): void {
  const all = readAll();
  const key = normalizeEmail(email);
  const entry = all[key];
  if (!entry) return;
  const now = new Date().toISOString();
  entry.status = STATUS_COMPLETED;
  entry.completedAt = entry.completedAt ?? now;
  entry.updatedAt = now;
  writeAll(all);
}
