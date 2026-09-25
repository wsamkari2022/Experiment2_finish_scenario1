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
 * A write the server REFUSES is a different thing from a write it cannot receive, and the outbox
 * has told them apart since 23 September 2026. Before that it could not: a section the API did not
 * recognise came back 400, went to the head of the queue, and was retried forever — holding back
 * every write behind it, so one unknown section name stopped a participant's whole run reaching
 * MongoDB. A 4xx is now parked in `vrds_outbox_refused` with a loud console line and the queue
 * moves on; an unreachable server still stops the flush, because order has to be preserved.
 *
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
import {
  SOURCE_MAP,
  SHAPE_VERSION,
  buildHeadline,
  buildPositionSection,
  buildScenario6Section,
  buildLiftedScenarios,
  buildAlignmentRecords,
  buildCardOrderSection,
  buildValueMovesSection,
  buildMpfPredictions,
  buildMpfPercentages,
  buildMajorScores,
  buildBlocks1to4Checks,
  BLOCKS_1_TO_4_KEYS,
  buildMcfSection,
  buildProfileChange,
  buildQuality,
  collectResumeFiles,
  restoreResumeFiles,
} from "./dbShape";
import { ACTIVE_TIME_KEY } from "./activeTime";
import { SESSION_LOG_KEY } from "./sessionLog";
import { FEEDBACK_KEY } from "./feedbackTypes";
import { BLOCK5_RESULTS_KEY } from "./block5Types";

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
  /** The raw browser files stored for a half-finished participant, or null. */
  getResumeFiles(email: string): Promise<Record<string, unknown> | null>;
}

/**
 * The server, once there is one.
 *
 * Null means local-only, which is the current state: everything below still works, writes simply
 * stop at the browser. Step 8 assigns an API client here.
 */
let remote: RemoteBackend | null = null;

/**
 * Installs the server backend. Called once at startup in step 8.
 *
 * Not a React hook, so it must not be named `use…`: that prefix tells the hooks linter to demand
 * hook call rules, and the call site is inside an async callback on purpose.
 */
export function setRemoteBackend(backend: RemoteBackend | null): void {
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

/**
 * What happened to one queued write.
 *
 *   sent      it is in the database; drop it from the queue
 *   retry     the server could not be reached; keep it and stop, so order is preserved
 *   refused   the server read it and said no. Retrying cannot help, so it is parked rather than
 *             left at the head of the queue blocking everything behind it
 */
type SendResult = "sent" | "retry" | "refused";

/**
 * A 4xx means the server understood the request and rejected it: a section this server does not
 * accept, a malformed path, a body it will not take. Those never succeed on a retry.
 *
 * Two are excluded on purpose. 408 is a timeout and 429 is "slow down" — both mean try again,
 * and both are answers about the moment rather than about the write itself.
 */
function isRefusal(error: unknown): boolean {
  const status = (error as { httpStatus?: number } | null)?.httpStatus;
  return typeof status === "number" && status >= 400 && status < 500
    && status !== 408 && status !== 429;
}

async function send(item: OutboxItem): Promise<SendResult> {
  if (!remote) return "retry";
  try {
    switch (item.op) {
      case "upsertParticipant":
        await remote.upsertParticipant(item.entry);
        return "sent";
      case "updateStage":
        await remote.updateStage(item.email, item.stage);
        return "sent";
      case "markCompleted":
        await remote.markCompleted(item.email);
        return "sent";
      case "saveSection":
        await remote.saveSection(item.path, item.data);
        return "sent";
    }
  } catch (error) {
    if (isRefusal(error)) {
      park(item, error);
      return "refused";
    }
    return "retry";
  }
}

/**
 * Where refused writes go, so that dropping one from the queue is not the same as losing it
 * quietly.
 *
 * A refusal is a BUG somewhere — a section the server was never taught to accept, most often —
 * and the evidence has to survive long enough for somebody to see it. It stays in this browser,
 * is never sent anywhere, and is capped so it cannot grow without limit.
 */
const REJECTED_KEY = "vrds_outbox_refused";
const MAX_REJECTED = 20;

function park(item: OutboxItem, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  /* Loud on purpose. A refused write is not a network hiccup; somebody has to fix it. */
  console.error(`[storage] the server REFUSED this write and it will not be retried: ${reason}`, item);
  try {
    const raw = localStorage.getItem(REJECTED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    list.push({ at: new Date().toISOString(), reason, item });
    localStorage.setItem(REJECTED_KEY, JSON.stringify(list.slice(-MAX_REJECTED)));
  } catch {
    /* Storage unavailable: the console line above is then the only record, which is still
       better than a queue that never drains. */
  }
}

/**
 * Retries everything waiting, oldest first.
 *
 * Order is preserved deliberately: "reached block 5" must not overtake "was created", or the
 * server would be asked to update a participant it has never been told about. An unreachable
 * server therefore stops the flush — there is nothing to gain by trying the rest, and passing over
 * one write would break that order.
 *
 * A REFUSED WRITE IS DIFFERENT, AND TREATING IT THE SAME COST A WHOLE QUEUE. Until 23 September
 * 2026 any failure stopped the flush. When the server refused one section it did not recognise,
 * that write went back to the head of the queue and was retried forever, and every write behind it
 * — every block, every section, the completion flag — waited behind a write that could never
 * succeed. One unknown section name was enough to stop a participant's data reaching MongoDB
 * entirely, on the server and in local development alike.
 *
 * A refusal is now parked (see park) and the queue moves on. The order guarantee is unaffected:
 * a write the server will never accept is not a write anything can be ordered against.
 */
export async function flushOutbox(): Promise<void> {
  if (!remote) return;
  const items = readOutbox();
  if (items.length === 0) return;

  const remaining = [...items];
  while (remaining.length > 0) {
    const result = await send(remaining[0]);
    if (result === "retry") break;
    /* "sent" and "refused" both leave the queue; only one of them reached the database. */
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

/* ------------------------------------------------------- carrying a run to another machine */

/**
 * Uploads the files a returning participant would need on a different computer.
 *
 * Sent on every sync rather than only at a stage boundary, because the moment somebody abandons a
 * run is not something the app is ever told about — they simply close the tab. Whatever was last
 * uploaded is what they come back to, so it should be as recent as possible.
 */
export function syncResumeState(email: string | null): void {
  if (!remote || !email) return;
  const files = collectResumeFiles();
  if (Object.keys(files).length === 0) return;
  sendOrQueue({
    op: "saveSection",
    path: "resume_state",
    data: { files, updated_at: new Date().toISOString() },
  });
}

/**
 * Downloads a participant's files and writes them into this browser.
 *
 * Returns how many were restored, so the caller can tell the difference between "welcome back,
 * everything is here" and "the server had nothing for you" — two very different situations for
 * somebody who is otherwise about to be sent back to the start.
 */
export async function restoreParticipantFiles(email: string): Promise<number> {
  if (!remote) return 0;
  try {
    const files = await remote.getResumeFiles(email);
    return restoreResumeFiles(files);
  } catch {
    return 0;
  }
}

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

/** Reserved key inside the sync state holding the shape the fingerprints were taken against. */
const SHAPE_VERSION_KEY = "__shape_version";

/**
 * Reads the fingerprints — unless they were taken against an older document shape, in which case
 * they are discarded.
 *
 * Without this gate, a participant whose data was already synced never receives a newly added
 * field: their answers have not changed, so nothing looks stale, so nothing is re-sent. Comparing
 * the version turns "has this participant's data changed?" into "has their data changed, OR has
 * what we store about it changed?", which is the question that actually matters.
 */
function readSyncState(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object") return { [SHAPE_VERSION_KEY]: SHAPE_VERSION };
    const state = parsed as Record<string, string>;
    if (state[SHAPE_VERSION_KEY] !== SHAPE_VERSION) return { [SHAPE_VERSION_KEY]: SHAPE_VERSION };
    return state;
  } catch {
    return { [SHAPE_VERSION_KEY]: SHAPE_VERSION };
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
export function syncBlocks(email: string | null, opts?: { force?: boolean }): void {
  if (!remote || !email) return;

  /*
   * `force` re-sends everything even if nothing looks changed. It is used at completion, because
   * two things are only true at that moment: the feedback answers have just been written, and the
   * total study time has only just been totalled. A headline built earlier carries
   * total_time_minutes: null forever unless it is rebuilt here.
   */
  const state = opts?.force ? { ["__shape_version"]: SHAPE_VERSION } : readSyncState();
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

      /* Position, per scenario and per chair — the reading the results page computes and drops. */
      const position = buildPositionSection(translated);
      if (position) sendOrQueue({ op: "saveSection", path: "analysis.position_effect", data: position });

      /* Scenario 6's prediction test, in its own room and in plain words. Written outside `blocks`
         because it measures the MODEL, not the participant, and an analyst should not have to dig
         four levels into a scenario array to find the one section that answers a different
         question from everything around it. */
      const scenario6 = buildScenario6Section(translated);
      if (scenario6) {
        sendOrQueue({ op: "saveSection", path: "analysis.scenario6_mpf_test", data: scenario6 });
      }

      /*
       * SCENARIOS 5 AND 6, COPIED TO THE TOP OF `blocks`.
       *
       * Both are already inside `scenarioResults`, four levels down, indistinguishable from the
       * four scenarios around them — and neither is the same kind of thing. One is a wish and one
       * is a test of the model, and an analyst who averages either in with the decisions has made a
       * real mistake that the array gives no warning about. Each copy carries `this_is_a_copy_of`
       * so nobody counts the same answer twice.
       */
      const lifted = buildLiftedScenarios(translated);
      if (lifted.scenario5) {
        sendOrQueue({ op: "saveSection", path: "blocks.block5_scenario_5_wish_on_the_receiving_end", data: lifted.scenario5 });
      }
      if (lifted.scenario6) {
        sendOrQueue({ op: "saveSection", path: "blocks.block5_scenario_6_veil_of_ignorance", data: lifted.scenario6 });
      }

      /* Alignment, reflection and clarification for every scenario, in one table instead of four
         scattered optional fields per row. */
      const alignment = buildAlignmentRecords(translated);
      if (alignment) sendOrQueue({ op: "saveSection", path: "analysis.alignment_records", data: alignment });

      /* The card order in every scenario, what decided it, and a check that the saved inputs rebuild
         it - in words anybody can read. See buildCardOrderSection. */
      const cardOrder = buildCardOrderSection(translated);
      if (cardOrder) sendOrQueue({ op: "saveSection", path: "analysis.card_order_by_scenario", data: cardOrder });

      /* Every value move, as asked for and as made, and the ones cut off at 0 or 100 (B5). */
      const valueMoves = buildValueMovesSection(translated);
      if (valueMoves) sendOrQueue({ op: "saveSection", path: "analysis.value_moves_asked_for_and_made", data: valueMoves });

      /* The prediction function run over every scenario, not only the one where it was shown. Every
         row says which it was. */
      const mpf = buildMpfPredictions(translated);
      if (mpf) sendOrQueue({ op: "saveSection", path: "analysis.mpf_predictions_every_scenario", data: mpf });

      /* The same predictions cut down to the three numbers an analyst actually asks for - what the
         model expected, what they took, and the distance between the two - one row per scenario in
         the order they were shown. Built FROM the section above rather than predicted again, so the
         short table and the long one cannot drift apart. */
      const mpfPercentages = mpf ? buildMpfPercentages(mpf) : null;
      if (mpfPercentages) {
        sendOrQueue({ op: "saveSection", path: "analysis.mpf_prediction_percentages", data: mpfPercentages });
      }

      /* What each option asked of this participant's own values, and which readings they opened.
         Exposure first: most of this section was never on screen. See buildMcfSection. */
      const mcfSection = buildMcfSection(translated);
      if (mcfSection) sendOrQueue({ op: "saveSection", path: "analysis.mcf", data: mcfSection });

      /*
       * EVERY MAJOR SCORE IN ONE ROOM.
       *
       * The numbers that matter are spread across eight rooms of the document, each there for a
       * good reason and none of them where somebody looks when the question is "how did this
       * participant score?". This assembles them from the sections that own them - the same
       * builders, not a second calculation - and it is sent last, so every section it copies has
       * been built in this same pass.
       *
       * It reads four sources this branch does not otherwise touch: the stage timings, the
       * working-time ledger, the login history and the feedback answers. A participant who has
       * not reached the feedback yet simply has no feedback in it.
       */
      const readRaw = (key: string): unknown => {
        try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
      };
      const major = buildMajorScores(
        translated,
        timings,
        readRaw(ACTIVE_TIME_KEY),
        readRaw(SESSION_LOG_KEY),
        readRaw(FEEDBACK_KEY),
        {
          money: readRaw(BLOCKS_1_TO_4_KEYS.money),
          trolley: readRaw(BLOCKS_1_TO_4_KEYS.trolley),
          aiWorkforce: readRaw(BLOCKS_1_TO_4_KEYS.aiWorkforce),
          participantRecord: readRaw(BLOCKS_1_TO_4_KEYS.participantRecord),
        },
      );
      if (major) sendOrQueue({ op: "saveSection", path: "major_info_and_scores", data: major });

      /* The value profile before and after Block 5, and the movement between them. */
      const profiles = buildProfileChange(translated);
      if (profiles) {
        sendOrQueue({ op: "saveSection", path: "analysis.value_profile_before_block5", data: profiles.before });
        sendOrQueue({ op: "saveSection", path: "analysis.value_profile_after_block5", data: profiles.after });
        sendOrQueue({ op: "saveSection", path: "analysis.value_profile_change", data: profiles.change });
      }
    }
  }

  /*
   * Quality is computed last, because it reads across several files at once — the active-time
   * ledger, the Block 5 results and the feedback answers. Building it inside the per-source loop
   * would mean building it from whichever of those happened to be processed first.
   */
  if (changed) {
    const readKey = (key: string): unknown => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };
    const quality = buildQuality(
      readKey(ACTIVE_TIME_KEY),
      readKey(BLOCK5_RESULTS_KEY),
      readKey(FEEDBACK_KEY),
      localStorage.getItem("vrds_status") ?? "",
    );
    if (quality) sendOrQueue({ op: "saveSection", path: "quality", data: quality });

    /* How Blocks 1-4 were answered (first-step yes, speed, values not measured, ties). Built here,
       not inside the Block 5 branch, because it exists as soon as Block 3 is done - long before
       Block 5 - and a participant who stops early should still carry it. `major_info_and_scores`
       holds a copy made by the same builder. */
    const blocks1to4 = buildBlocks1to4Checks({
      money: readKey(BLOCKS_1_TO_4_KEYS.money),
      trolley: readKey(BLOCKS_1_TO_4_KEYS.trolley),
      aiWorkforce: readKey(BLOCKS_1_TO_4_KEYS.aiWorkforce),
      participantRecord: readKey(BLOCKS_1_TO_4_KEYS.participantRecord),
    });
    if (blocks1to4) sendOrQueue({ op: "saveSection", path: "analysis.blocks_1_to_4_checks", data: blocks1to4 });
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
