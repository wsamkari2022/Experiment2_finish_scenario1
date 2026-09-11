/**
 * storage.ts — the one door in and out of this study's data.
 *
 * ============================================================================
 * WHY EVERYTHING GOES THROUGH HERE
 * ============================================================================
 * Today the study saves to the browser. Tomorrow it saves to MongoDB through a small local API.
 * If the pages called each of those directly, "tomorrow" would mean editing every page. They call
 * this file instead, so the database arrives as a change to ONE module: set `remote` below to an
 * API client and every save in the app starts reaching the server.
 *
 * Nothing outside this file may talk to the server. That is the whole rule.
 *
 * ============================================================================
 * LOCAL FIRST, ALWAYS. THIS IS NOT A PERFORMANCE CHOICE
 * ============================================================================
 * Every write lands in the browser BEFORE it is sent anywhere, and the caller is never made to
 * wait for the network. A participant is 40 minutes into a study on a laptop, and the database is
 * a local server on the researcher's machine which can be stopped, restarted, or simply not
 * running. If a save had to reach that server to count, closing a terminal window would cost
 * somebody their session.
 *
 * So: the browser is the source of truth during a run, and the server is a copy that catches up.
 * A write that cannot be sent is queued in the outbox and retried later, and none of that is
 * visible to the participant.
 *
 * ============================================================================
 * READS ARE ASYNC EVEN THOUGH NOTHING IS ASYNC YET
 * ============================================================================
 * `findParticipant` returns a promise today only to answer instantly from LocalStorage. It is
 * shaped that way on purpose: looking a participant up on a SERVER is the entire point of the
 * feature, and a lookup that is synchronous now would have to change every caller when it stops
 * being synchronous. The seam is built before it is needed, while it costs nothing.
 */

import {
  lookupByEmail,
  markCompleted as markCompletedLocal,
  updateStage as updateStageLocal,
  upsertParticipant as upsertParticipantLocal,
  type DirectoryEntry,
} from "./participantDirectory";
import { TELEMETRY_KEY } from "./telemetry";
import { SOURCE_MAP, buildHeadline, buildVisualizationData } from "./dbShape";

/* ------------------------------------------------------------------ the remote seam */

/**
 * What a server has to be able to do. Step 8 supplies an object with these five methods, backed
 * by `fetch` calls to the local API; nothing else in the app changes.
 */
export interface RemoteBackend {
  findParticipant(email: string): Promise<DirectoryEntry | null>;
  upsertParticipant(entry: DirectoryEntry): Promise<void>;
  updateStage(email: string, stage: string): Promise<void>;
  markCompleted(email: string): Promise<void>;
  /** Writes one named section of the participant document. `path` is dotted, e.g. blocks.block1_money */
  saveSection(path: string, data: unknown): Promise<void>;
}

/**
 * The server, once there is one.
 *
 * Null means local-only, which is the current state: everything below still works, writes simply
 * stop at the browser. Step 8 assigns an API client here.
 */
let remote: RemoteBackend | null = null;

/** Installs the server backend. Called once at startup in step 8. */
export function useRemoteBackend(backend: RemoteBackend | null): void {
  remote = backend;
  if (backend) void flushOutbox();
}

/** True when writes are also being sent to a server. */
export const isRemoteEnabled = (): boolean => remote !== null;

/* ------------------------------------------------------------------------- outbox */

/**
 * Writes that could not reach the server, kept until they can.
 *
 * Without this, a server that is down for ten seconds loses ten seconds of a participant's
 * progress silently — the worst kind of data loss, because nothing reports it. Each entry is a
 * plain description of the call to retry, so it survives a page reload.
 */
const OUTBOX_KEY = "vrds_outbox";

type OutboxItem =
  | { op: "upsertParticipant"; entry: DirectoryEntry }
  | { op: "updateStage"; email: string; stage: string }
  | { op: "markCompleted"; email: string }
  | { op: "saveSection"; path: string; data: unknown };

function readOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    /* Storage unavailable; the queue is lost, but the run continues. */
  }
}

function queue(item: OutboxItem): void {
  /* No server configured means nothing to catch up on — do not grow a queue that will never
     drain. Only a real send failure is worth remembering. */
  if (!remote) return;
  writeOutbox([...readOutbox(), item]);
}

async function send(item: OutboxItem): Promise<boolean> {
  if (!remote) return false;
  try {
    switch (item.op) {
      case "upsertParticipant":
        await remote.upsertParticipant(item.entry);
        return true;
      case "updateStage":
        await remote.updateStage(item.email, item.stage);
        return true;
      case "markCompleted":
        await remote.markCompleted(item.email);
        return true;
      case "saveSection":
        await remote.saveSection(item.path, item.data);
        return true;
    }
  } catch {
    return false;
  }
}

/**
 * Retries everything waiting, oldest first, and stops at the first failure.
 *
 * Order is preserved deliberately: "reached block 5" must not overtake "was created", or the
 * server would be asked to update a participant it has never been told about. One failure means
 * the server is unreachable, so there is nothing to gain by trying the rest.
 */
export async function flushOutbox(): Promise<void> {
  if (!remote) return;
  const items = readOutbox();
  if (items.length === 0) return;

  const remaining = [...items];
  while (remaining.length > 0) {
    const ok = await send(remaining[0]);
    if (!ok) break;
    remaining.shift();
  }
  writeOutbox(remaining);
}

/** Sends now if possible, and queues for later if not. Never throws, never blocks the caller. */
function sendOrQueue(item: OutboxItem): void {
  if (!remote) return;
  void send(item).then((ok) => {
    if (!ok) queue(item);
  });
}

/* -------------------------------------------------------------------- participants */

/**
 * Finds a participant by email — the question the start screen asks.
 *
 * The server is asked first when there is one, because it is the only place that knows about
 * participants who started on a DIFFERENT machine, which is the entire reason a participant
 * types their address. The browser answers when there is no server, or when it cannot be reached:
 * a returning participant on their own laptop is still recognised while the server is down.
 */
export async function findParticipant(email: string): Promise<DirectoryEntry | null> {
  if (remote) {
    try {
      const found = await remote.findParticipant(email);
      if (found) return found;
    } catch {
      /* Server unreachable — fall through to what this browser knows. */
    }
  }
  return lookupByEmail(email);
}

/** Creates or updates a participant. Written locally at once, sent to the server after. */
export function saveParticipant(input: {
  email: string;
  sessionId: string;
  age: number;
  gender: string;
  stage: string;
  consent: DirectoryEntry["consent"];
}): DirectoryEntry {
  const entry = upsertParticipantLocal(input);
  sendOrQueue({ op: "upsertParticipant", entry });
  return entry;
}

/** Records how far a participant has got. Called on every stage change. */
export function saveProgress(email: string, stage: string): void {
  updateStageLocal(email, stage);
  sendOrQueue({ op: "updateStage", email, stage });
}

/**
 * Marks the study finished.
 *
 * The one write in the app that must not be lost: it is what stops a completed participant taking
 * the study twice, and what tells you who to pay. If the server cannot be reached it goes to the
 * outbox like everything else, and the local record is correct in the meantime.
 */
export function saveCompletion(email: string): void {
  markCompletedLocal(email);
  sendOrQueue({ op: "markCompleted", email });
}

/* ------------------------------------------------------------------------- blocks */

/**
 * How many writes are still waiting for the server. Useful for a status readout.
 *
 * (A per-block `saveBlockData` helper used to live here, for blocks to call as they saved. It was
 * never adopted: syncBlocks reads what the blocks have already written instead, which covers every
 * source without any block having to know this file exists. It is gone rather than left unused,
 * because a second way to write the same data is a second way for the two to disagree.)
 */
export const pendingWriteCount = (): number => readOutbox().length;

/* ------------------------------------------------------------------- block sync */

/**
 * Every piece of a participant's run, and the name it gets inside their document.
 *
 * WHY THIS IS A LIST HERE RATHER THAN A CALL IN EACH BLOCK
 * The blocks already write their own results to LocalStorage, and they have done since long
 * before there was a database. Editing all of them to also call the server would mean touching
 * five working blocks — the parts of this study that must not break — to add a feature none of
 * them care about. Reading what they have already written is the same data for none of the risk,
 * and a block that changes how it saves keeps working without knowing this file exists.
 *
 * Two of these keys are private constants inside their own modules and cannot be imported, so
 * they appear as literals. If either is ever renamed, this list must be updated with it; the
 * sync check in `npm run validate:block5` is not aware of these.
 */
const BLOCK_SOURCES = SOURCE_MAP;

/** Fingerprints of what has already been sent, so unchanged blocks are not re-sent. */
const SYNC_STATE_KEY = "vrds_sync_state";

/**
 * A cheap content fingerprint.
 *
 * Not a real hash and does not need to be: the only question is "has this changed since I last
 * sent it", and a length plus a rolling sum answers that for JSON that grows as a participant
 * answers questions. A collision would cost one skipped re-send of data the server already has.
 */
function fingerprint(value: string): string {
  let sum = 0;
  for (let i = 0; i < value.length; i += 1) {
    sum = (sum * 31 + value.charCodeAt(i)) >>> 0;
  }
  return `${value.length}:${sum.toString(36)}`;
}

function readSyncState(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Sends any block whose stored answers have changed since the last sync.
 *
 * Called on every stage change and once more at completion. It is deliberately driven by the
 * CONTENT rather than by events: a block that saved twice, or saved late, or was restored from a
 * previous session, is picked up all the same. The alternative — trusting that every save fired a
 * notification — is how partial data sets happen.
 *
 * Does nothing at all when there is no server, and never blocks the caller.
 */
export function syncBlocks(email: string | null): void {
  if (!remote || !email) return;

  const state = readSyncState();
  let changed = false;

  for (const source of BLOCK_SOURCES) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(source.key);
    } catch {
      continue;
    }
    if (!raw) continue;

    const print = fingerprint(raw);
    if (state[source.key] === print) continue;

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue; // not JSON; nothing sensible to store
    }

    /* Translate on the way out: rename misleading keys, attach the real feedback questions.
       See dbShape.ts — the study's own copy in the browser is never touched. */
    const translated = source.transform ? source.transform(data) : data;
    sendOrQueue({ op: "saveSection", path: source.path, data: translated });
    state[source.key] = print;
    changed = true;

    /*
     * Block 5 is the one source that produces more than it stores. The headline scores and the
     * chart numbers are worked out FROM it, and the results page throws them away, so they are
     * built and sent here at the moment the Block 5 results change.
     */
    if (source.path === "blocks.block5_emergency_scenarios") {
      let timings: unknown = null;
      try {
        timings = JSON.parse(localStorage.getItem(TELEMETRY_KEY) ?? "null");
      } catch {
        /* headline simply reports no total time */
      }
      const headline = buildHeadline(translated, timings);
      if (headline) sendOrQueue({ op: "saveSection", path: "headline", data: headline });
      const charts = buildVisualizationData(translated);
      if (charts) sendOrQueue({ op: "saveSection", path: "analysis.block5_visualizations", data: charts });
    }
  }

  if (changed) {
    try {
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
    } catch {
      /* Worst case the same block is sent again next time, which is harmless. */
    }
  }
}

/**
 * Forgets what has been sent, so the next sync sends everything again.
 *
 * Used when a participant is resumed from the server on a machine that has never seen them: the
 * fingerprints from whoever used this browser last say nothing about THIS participant's data.
 */
export function resetSyncState(): void {
  try {
    localStorage.removeItem(SYNC_STATE_KEY);
  } catch {
    /* ignore */
  }
}
