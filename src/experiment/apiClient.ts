/**
 * apiClient.ts — the only code in the app that speaks to the server.
 *
 * It implements RemoteBackend (see storage.ts) by calling the six endpoints in server/index.js.
 * Everything else in the study calls storage.ts and never knows whether a server exists.
 *
 * WHY EVERY CALL HAS A TIMEOUT
 * The API is a local process that can be stopped at any moment. A `fetch` to a port with nothing
 * listening fails fast, but a fetch to a process that is starting, hung, or mid-restart can hang
 * for a long time. Since these calls sit behind a participant's click, a hang would look like the
 * study freezing. Three seconds, then treat it as unreachable and let the outbox take it.
 *
 * FAILURE IS NORMAL HERE, NOT EXCEPTIONAL
 * Every method throws on a bad response, and storage.ts catches that and queues the write. So an
 * error thrown from this file is not a bug — it is the mechanism working.
 */

import type { RemoteBackend } from "./storage";
import type { DirectoryEntry } from "./participantDirectory";

/** Same origin: Vite proxies /api to the API server in development. */
const BASE = "/api";
const TIMEOUT_MS = 3000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) {
      throw new Error(`${init?.method ?? "GET"} ${path} → ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The server's document and the browser's directory entry are the same information under
 * different field names (`session_id` against `sessionId`). Translating in one place keeps the
 * database's naming out of the rest of the app.
 */
function toDirectoryEntry(doc: Record<string, unknown> | null): DirectoryEntry | null {
  if (!doc) return null;
  return {
    email: String(doc.email ?? ""),
    /* The document calls it participant_id now; the browser's own directory still calls it
       sessionId internally. One name in the database is what matters for anybody reading it. */
    sessionId: String(doc.participant_id ?? doc.session_id ?? ""),
    age: Number(doc.age ?? 0),
    gender: String(doc.gender ?? ""),
    status: doc.status as DirectoryEntry["status"],
    stage: String(doc.current_stage ?? "money"),
    consent: (doc.consent as DirectoryEntry["consent"]) ?? null,
    createdAt: String(doc.created_at ?? ""),
    updatedAt: String(doc.updated_at ?? ""),
    completedAt: (doc.completed_at as string | null) ?? null,
  };
}

export const apiClient: RemoteBackend = {
  async findParticipant(email) {
    const doc = await request<Record<string, unknown> | null>("/participants/lookup", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return toDirectoryEntry(doc);
  },

  async upsertParticipant(entry) {
    await request("/participants", {
      method: "POST",
      body: JSON.stringify({
        email: entry.email,
        sessionId: entry.sessionId,
        age: entry.age,
        gender: entry.gender,
        consent: entry.consent,
        stage: entry.stage,
      }),
    });
  },

  async updateStage(email, stage) {
    await request(`/participants/${encodeURIComponent(email)}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
  },

  async markCompleted(email) {
    await request(`/participants/${encodeURIComponent(email)}/complete`, { method: "PATCH" });
  },

  async getResumeFiles(email) {
    /* The lookup already returns the whole document, so no extra endpoint is needed — the raw
       files ride along with the record the start screen was fetching anyway. */
    const doc = await request<{ resume_state?: { files?: Record<string, unknown> } } | null>(
      "/participants/lookup",
      { method: "POST", body: JSON.stringify({ email }) },
    );
    return doc?.resume_state?.files ?? null;
  },

  async saveSection(path, data) {
    /* Addressed by email like everything else; the participant id travels on the document itself
       and does not need repeating in every section write. */
    const email = currentEmail();
    if (!email) return;
    await request(`/participants/${encodeURIComponent(email)}/section`, {
      method: "PATCH",
      body: JSON.stringify({ path, data }),
    });
  },
};

/** The address of the participant currently running, used to address block writes. */
function currentEmail(): string | null {
  try {
    return (
      localStorage.getItem("vrds_pending_email") ??
      (JSON.parse(localStorage.getItem("vrds_demographics") ?? "null")?.email as string) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Asks the server whether it is there.
 *
 * Used once at startup to decide whether to switch the remote backend on at all. If the API is
 * not running, the study stays local-only and nothing is queued — which is the right behaviour
 * for a researcher testing the study without starting the server.
 */
export async function isApiAvailable(): Promise<boolean> {
  try {
    const health = await request<{ ok?: boolean }>("/health");
    return health?.ok === true;
  } catch {
    return false;
  }
}
