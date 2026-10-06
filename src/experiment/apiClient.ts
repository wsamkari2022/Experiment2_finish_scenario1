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
 * study freezing. Ten seconds, then treat it as unreachable and let the outbox take it.
 *
 * TEN SECONDS, NOT THREE (since 6 October 2026, the advisor's "multiple sessions safe"). Three
 * seconds was written for a local server that is either there or not. On the live server a BUSY
 * moment (100 people starting together) or a slow home connection answers late but answers, and
 * three seconds turned that into "no server": the landing page then gave an uncounted random
 * condition, and a large save on a slow line could be cut off on every retry. A server that is
 * really down still fails at once (the connection is refused), so nobody waits ten seconds for it.
 *
 * FAILURE IS NORMAL HERE, NOT EXCEPTIONAL
 * Every method throws on a bad response, and storage.ts catches that and queues the write. So an
 * error thrown from this file is not a bug — it is the mechanism working.
 */

import type { RemoteBackend } from "./storage";
import { browserId } from "./sessionLog";
import type { DirectoryEntry } from "./participantDirectory";
import { conditionByNumber, type AssignedCondition, type SavedCondition } from "./conditions";
import { isProlificKey, keyOfDemographics, type RecruitmentSource } from "./recruitment";

/*
 * THE KEY UNDER ITS TRUE NAME (since 6 October 2026; recruitment.ts). The participant's key is an email (the university
 * door) or a Prolific ID (the Prolific door). It is sent as `email` or as `prolificPid`, and the server stores it the same
 * way (`email` or `prolific_pid`), so a Prolific ID never lands in an email field.
 */
const identity = (key: string): { email: string } | { prolificPid: string } =>
  (isProlificKey(key) ? { prolificPid: key } : { email: key });

/** Same origin: Vite proxies /api to the API server in development. */
const BASE = "/api";
const TIMEOUT_MS = 10_000;
/** The "are you there?" question is tiny; it is asked again (ExperimentFlow) rather than waited on. */
const HEALTH_TIMEOUT_MS = 5_000;

async function request<T>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      /* The browser's id goes with every request, so the server can keep ONE browser writing a
         participant's record (since 29 September 2026; server/activeBrowser.js). */
      headers: { "Content-Type": "application/json", "X-VRDS-Browser": browserId(), ...(init?.headers ?? {}) },
    });
    if (!response.ok) {
      /*
       * THE STATUS TRAVELS WITH THE ERROR, because the caller has to tell two very different
       * failures apart. A 503 or a dropped connection means "try again later". A 400 means the
       * server has looked at this exact write and refused it, and it will refuse it every time.
       * Without the number, storage.ts treated both as "retry", and a single refused write sat at
       * the head of the outbox forever, holding back every write queued behind it.
       */
      const error = new Error(`${init?.method ?? "GET"} ${path} → ${response.status}`);
      (error as Error & { httpStatus?: number }).httpStatus = response.status;
      /* The server's own word for the refusal, e.g. "another_browser_active", so the page can tell a
         write from a browser that is no longer the participant's apart from any other refusal. */
      try {
        const body = (await response.json()) as { error?: unknown };
        if (typeof body?.error === "string") (error as Error & { code?: string }).code = body.error;
      } catch { /* no JSON body */ }
      throw error;
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
    /* The key: the email, or the Prolific ID of a Prolific record (recruitment.ts). */
    email: String(doc.email ?? doc.prolific_pid ?? ""),
    ...(typeof doc.prolific_study_id === "string" ? { prolificStudyId: doc.prolific_study_id } : {}),
    ...(typeof doc.prolific_session_id === "string" ? { prolificSessionId: doc.prolific_session_id } : {}),
    /* The document calls it participant_id now; the browser's own directory still calls it
       sessionId internally. One name in the database is what matters for anybody reading it. */
    sessionId: String(doc.participant_id ?? doc.session_id ?? ""),
    age: Number(doc.age ?? 0),
    gender: String(doc.gender ?? ""),
    /* Since 30 September 2026; absent on a record made before. */
    ...(typeof doc.country === "string"
      ? { country: doc.country, countryCode: typeof doc.country_code === "string" ? doc.country_code : null }
      : {}),
    /* Since 4 October 2026; absent on a record made before. */
    ...(typeof doc.english_first_language === "boolean" ? { englishFirstLanguage: doc.english_first_language } : {}),
    /* Since 1 October 2026; absent on a record made before. */
    ...(conditionByNumber(doc.condition_number)?.type === doc.condition_type
      ? { condition: {
          number: Number(doc.condition_number) as SavedCondition["number"],
          type: doc.condition_type as SavedCondition["type"],
          source: (doc.condition_source as SavedCondition["source"]) ?? "landing_page",
          assignedAt: String(doc.condition_assigned_at ?? ""),
        } }
      : {}),
    status: doc.status as DirectoryEntry["status"],
    stage: String(doc.current_stage ?? "money"),
    consent: (doc.consent as DirectoryEntry["consent"]) ?? null,
    createdAt: String(doc.created_at ?? ""),
    updatedAt: String(doc.updated_at ?? ""),
    completedAt: (doc.completed_at as string | null) ?? null,
  };
}

export const apiClient: RemoteBackend = {
  async findParticipant(key) {
    const doc = await request<Record<string, unknown> | null>("/participants/lookup", {
      method: "POST",
      body: JSON.stringify(identity(key)),
    });
    return toDirectoryEntry(doc);
  },

  async upsertParticipant(entry) {
    await request("/participants", {
      method: "POST",
      body: JSON.stringify({
        ...identity(entry.email),
        /* The Prolific door's two ids, sent only when known: the server never erases them (since 6 October 2026). */
        ...(entry.prolificStudyId ? { prolificStudyId: entry.prolificStudyId } : {}),
        ...(entry.prolificSessionId ? { prolificSessionId: entry.prolificSessionId } : {}),
        sessionId: entry.sessionId,
        age: entry.age,
        gender: entry.gender,
        /* Sent only when known: the server keeps a saved country when none is sent. */
        ...(entry.country !== undefined ? { country: entry.country, countryCode: entry.countryCode ?? null } : {}),
        /* Sent only when known, like the country (since 4 October 2026). */
        ...(typeof entry.englishFirstLanguage === "boolean" ? { englishFirstLanguage: entry.englishFirstLanguage } : {}),
        /* The condition (since 1 October 2026): the server sets it only on a record that has none. */
        ...(entry.condition ? { condition: entry.condition } : {}),
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

  async claimBrowser(email, age) {
    await request(`/participants/${encodeURIComponent(email)}/claim`, {
      method: "POST",
      body: JSON.stringify({ age }),
    });
  },

  async isActiveBrowser(email) {
    const answer = await request<{ active?: boolean }>(`/participants/${encodeURIComponent(email)}/active`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return answer?.active !== false;
  },

  async getResumeFiles(key) {
    /* The lookup already returns the whole document, so no extra endpoint is needed — the raw
       files ride along with the record the start screen was fetching anyway. */
    const doc = await request<{ resume_state?: { files?: Record<string, unknown> } } | null>(
      "/participants/lookup",
      { method: "POST", body: JSON.stringify(identity(key)) },
    );
    return doc?.resume_state?.files ?? null;
  },

  async assignCondition(arrivalId, recruitmentSource?: RecruitmentSource): Promise<AssignedCondition> {
    const given = await request<AssignedCondition>("/conditions/assign", {
      method: "POST",
      /* The door: each is balanced on its own (since 6 October 2026). */
      body: JSON.stringify({ arrivalId, recruitmentSource: recruitmentSource ?? "university" }),
    });
    const condition = conditionByNumber(given?.number);
    if (!condition || condition.type !== given.type) throw new Error("the server named no known condition");
    return { number: condition.number, type: condition.type, arrivalId, assignedAt: String(given.assignedAt ?? "") };
  },

  async releaseArrival(arrivalId) {
    await request("/conditions/release", { method: "POST", body: JSON.stringify({ arrivalId }) });
  },

  async saveSection(path, data, owner) {
    /* Addressed by the participant's key like everything else; the participant id travels on the document itself
       and does not need repeating in every section write. Since 6 October 2026 the key the save was MADE for (storage.ts
       stamps it), so a save that waited in the queue can never land on somebody who started after it. */
    const key = owner ?? currentEmail();
    if (!key) return;
    await request(`/participants/${encodeURIComponent(key)}/section`, {
      method: "PATCH",
      body: JSON.stringify({ path, data }),
    });
  },
};

/** The key (email or Prolific ID) of the participant currently running, used to address block writes. */
function currentEmail(): string | null {
  try {
    return (
      localStorage.getItem("vrds_pending_email") ??
      keyOfDemographics(JSON.parse(localStorage.getItem("vrds_demographics") ?? "null")) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Asks the server whether it is there.
 *
 * Used at startup to decide whether to switch the remote backend on at all. In development it is
 * asked once: if the API is not running, the study stays local-only and nothing is queued — the
 * right behaviour for a researcher testing the study without starting the server. On the live site
 * it is asked again until the server answers (ExperimentFlow, `SERVER_CHECK_PLAN` in storage.ts).
 */
export async function isApiAvailable(): Promise<boolean> {
  try {
    const health = await request<{ ok?: boolean }>("/health", undefined, HEALTH_TIMEOUT_MS);
    return health?.ok === true;
  } catch {
    return false;
  }
}
