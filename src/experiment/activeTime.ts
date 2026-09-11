/**
 * activeTime.ts — how long the participant was actually working, as opposed to present.
 *
 * ============================================================================
 * WHY CLOCK TIME IS THE WRONG MEASURE
 * ============================================================================
 * telemetry.ts records how long each screen was open. That is the right number for "how long did
 * this page exist", and the wrong number for "did this person do the study". Somebody who opens
 * Block 1 and goes to lunch is recorded as spending an hour on Block 1. In the previous run of
 * this study that produced participants with 35 minutes on one page and 2 seconds on the next,
 * who looked eligible for payment and had plainly not read anything.
 *
 * Compensation depends on this number, so the number has to mean something.
 *
 * ============================================================================
 * HOW IT WORKS
 * ============================================================================
 * A heartbeat every 5 seconds adds 5 seconds — but only if BOTH are true:
 *
 *   1. the tab is actually on screen (not behind another window, not a background tab)
 *   2. there has been a mouse move, key, click, scroll or touch in the last 90 seconds
 *
 * Anything else and the clock simply does not advance. There is no "penalty" and nothing to
 * explain to the participant: time they were not working was never counted in the first place.
 *
 * ============================================================================
 * WHY 90 SECONDS
 * ============================================================================
 * A longer window is easier to game: with a five-minute idle allowance, somebody can nudge the
 * mouse once every four minutes and bank the whole time while doing nothing. A shorter window
 * risks docking a very still reader who is genuinely reading a long scenario.
 *
 * 90 seconds is the compromise, and scrolling counts as activity — people scroll while they read,
 * which is what makes the short window safe. It is one constant, changed in one place.
 *
 * ============================================================================
 * THE TWO FAILURES THIS ALSO FIXES
 * ============================================================================
 * Time is flushed when the tab is hidden and again on unload, so closing the browser no longer
 * throws away the current screen's time — which the old stage timer did, because its "stop the
 * clock" moment only ran on a tidy unmount.
 *
 * And the ledger accumulates across visits, so a participant who does half on Monday and half on
 * Friday has one total, not two unrelated ones.
 */

/** LocalStorage key. On the resume list, so time follows a participant to another computer. */
export const ACTIVE_TIME_KEY = "vrds_active_time";

/** No input for this long and the clock pauses. */
const IDLE_MS = 90_000;
/** How often the heartbeat considers adding time. */
const TICK_MS = 5_000;
/** Writes are batched; storage is not touched twelve times a minute. */
const FLUSH_MS = 15_000;
/** A gap longer than this means the participant went away and came back: a new sitting. */
const SITTING_GAP_MS = 30 * 60_000;

export interface ActiveLedger {
  /** Total milliseconds of genuine work, across every visit. */
  totalMs: number;
  /** Same, split by stage, so a block that took 2 seconds is visible. */
  byStage: Record<string, number>;
  /** How many separate visits this run has taken. */
  sittings: number;
  firstSeenAt: number;
  lastActiveAt: number;
  /** The longest single gap between activity, in ms. A large value is worth a look. */
  longestIdleMs: number;
  /** Set when the study finishes. Once true the clock never advances again. */
  stopped: boolean;
}

const emptyLedger = (now: number): ActiveLedger => ({
  totalMs: 0,
  byStage: {},
  sittings: 1,
  firstSeenAt: now,
  lastActiveAt: now,
  longestIdleMs: 0,
  stopped: false,
});

function read(): ActiveLedger {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(ACTIVE_TIME_KEY);
    if (!raw) return emptyLedger(now);
    const parsed = JSON.parse(raw) as Partial<ActiveLedger> | null;
    /* Shape-checked rather than trusted, for the same reason readTimings is: a malformed ledger
       that reaches the heartbeat would throw on every tick. */
    if (!parsed || typeof parsed !== "object" || typeof parsed.totalMs !== "number") {
      return emptyLedger(now);
    }
    return {
      totalMs: parsed.totalMs,
      byStage: parsed.byStage && typeof parsed.byStage === "object" ? parsed.byStage : {},
      sittings: typeof parsed.sittings === "number" ? parsed.sittings : 1,
      firstSeenAt: typeof parsed.firstSeenAt === "number" ? parsed.firstSeenAt : now,
      lastActiveAt: typeof parsed.lastActiveAt === "number" ? parsed.lastActiveAt : now,
      longestIdleMs: typeof parsed.longestIdleMs === "number" ? parsed.longestIdleMs : 0,
      stopped: parsed.stopped === true,
    };
  } catch {
    return emptyLedger(now);
  }
}

function write(ledger: ActiveLedger): void {
  try {
    localStorage.setItem(ACTIVE_TIME_KEY, JSON.stringify(ledger));
  } catch {
    /* Storage unavailable. The run continues; only the timing is lost. */
  }
}

/* ------------------------------------------------------------------------ live state */

let ledger: ActiveLedger = read();
let lastInputAt = Date.now();
/** When time was last added. The gap to now is what gets counted, capped at one tick. */
let lastCountedAt = Date.now();
let currentStage = "";
let paused = false;
let tickTimer: number | null = null;
let flushTimer: number | null = null;
let started = false;

/** Anything that wants to know whether the clock is currently paused (the badge does). */
type PauseListener = (isPaused: boolean) => void;
const pauseListeners = new Set<PauseListener>();

function setPaused(next: boolean): void {
  if (paused === next) return;
  paused = next;
  for (const listener of pauseListeners) listener(paused);
}

export function onPauseChange(listener: PauseListener): () => void {
  pauseListeners.add(listener);
  listener(paused);
  return () => pauseListeners.delete(listener);
}

export const isPaused = (): boolean => paused;

const noteInput = (): void => {
  lastInputAt = Date.now();
};

/* Throttled: a mouse move fires continuously and only the fact of it matters. */
let lastNoted = 0;
const noteInputThrottled = (): void => {
  const now = Date.now();
  if (now - lastNoted < 1000) return;
  lastNoted = now;
  noteInput();
};

const INPUT_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"];

function tick(): void {
  if (ledger.stopped) return;
  const now = Date.now();
  const visible = typeof document === "undefined" || document.visibilityState === "visible";
  const recentlyActive = now - lastInputAt < IDLE_MS;

  if (!visible || !recentlyActive) {
    setPaused(true);
    /* Move the marker forward while paused, so the gap is never counted when they return. */
    lastCountedAt = now;
    return;
  }

  /*
   * No stage means the entry screen, where they are typing an email. That is not participation,
   * and counting it would also break something an analyst will assume without checking: that the
   * total equals the sum of the per-stage times. A total that is larger than its own parts is the
   * kind of discrepancy that makes somebody distrust every other number in the record.
   */
  if (!currentStage) {
    setPaused(false);
    lastCountedAt = now;
    return;
  }

  /* Coming back after a long absence starts a new sitting, and the gap itself is recorded —
     it is the difference between "stepped out for coffee" and "came back a week later". */
  const gap = now - ledger.lastActiveAt;
  if (gap > SITTING_GAP_MS) ledger.sittings += 1;
  if (gap > ledger.longestIdleMs) ledger.longestIdleMs = gap;

  /*
   * ADD THE TIME THAT ACTUALLY PASSED, NOT A FIXED FIVE SECONDS.
   *
   * Adding TICK_MS per tick assumes exactly one heartbeat exists and that it fires exactly on
   * schedule. Neither is safe: a hot reload, a double-invoked effect, or a second module instance
   * produces several heartbeats, and every one of them would add its own five seconds to the same
   * ledger. Measured against the wall clock this counted twenty seconds of work as two hundred.
   *
   * Measuring the gap since the last counted moment makes extra heartbeats harmless — the second
   * one in the same instant finds that no time has passed and adds nothing. It also corrects for
   * a browser that throttles timers, which would otherwise quietly UNDER-count.
   *
   * The cap matters as much as the measurement: without it, the first tick after a pause would
   * add the entire idle period in one go, which is precisely the time this file exists to exclude.
   */
  const since = Math.min(Math.max(0, now - lastCountedAt), TICK_MS);
  lastCountedAt = now;
  if (since === 0) return;

  setPaused(false);
  ledger.totalMs += since;
  ledger.byStage[currentStage] = (ledger.byStage[currentStage] ?? 0) + since;
  ledger.lastActiveAt = now;
}

function flush(): void {
  if (!started) return;
  write(ledger);
}

/**
 * Begins counting. Safe to call repeatedly; only the first call starts the timers.
 *
 * `stage` is updated by the caller on every screen change, which is what produces the per-block
 * breakdown without this file needing to know anything about the study's structure.
 */
export function startActiveClock(): void {
  if (typeof window === "undefined") return;

  /*
   * Never leave a second heartbeat running.
   *
   * Two timers means every five seconds is counted twice, and the total silently drifts away from
   * the sum of its own parts — which is exactly what a hot reload produced during development.
   * React's strict mode also invokes effects twice on purpose. Clearing first makes a second call
   * harmless instead of corrupting the number compensation depends on.
   */
  if (tickTimer !== null) window.clearInterval(tickTimer);
  if (flushTimer !== null) window.clearInterval(flushTimer);
  tickTimer = null;
  flushTimer = null;

  if (started) {
    /* Already initialised in this module instance: just restart the timers cleared above. */
    tickTimer = window.setInterval(tick, TICK_MS);
    flushTimer = window.setInterval(flush, FLUSH_MS);
    return;
  }
  started = true;
  ledger = read();

  /* A page load after a long gap is a new visit. Counted here rather than in the tick, because
     the participant may load the page and read for a while before touching anything. */
  const now = Date.now();
  if (ledger.totalMs > 0 && now - ledger.lastActiveAt > SITTING_GAP_MS) {
    ledger.sittings += 1;
  }
  lastInputAt = now;
  lastCountedAt = now;

  for (const name of INPUT_EVENTS) {
    window.addEventListener(name, noteInputThrottled, { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
    else noteInput();
  });
  window.addEventListener("beforeunload", flush);

  tickTimer = window.setInterval(tick, TICK_MS);
  flushTimer = window.setInterval(flush, FLUSH_MS);
}

/** Tells the clock which screen is showing, so per-block time can be attributed. */
export function setActiveStage(stage: string): void {
  currentStage = stage;
}

/**
 * Stops the clock for good.
 *
 * Called once, when the feedback answers are submitted. Sitting on the thank-you page afterwards
 * must not earn time, and neither must reopening it later — which is why this is a flag in the
 * stored ledger rather than merely clearing a timer.
 */
export function stopActiveClock(): void {
  ledger.stopped = true;
  flush();
  if (tickTimer !== null) window.clearInterval(tickTimer);
  if (flushTimer !== null) window.clearInterval(flushTimer);
  tickTimer = null;
  flushTimer = null;
  setPaused(false);
}

/** Total genuine working time so far, in milliseconds. */
export const getActiveMs = (): number => ledger.totalMs;

/** A readable summary, used for the database and the thank-you page. */
export function getActiveSummary() {
  const minutes = (ms: number) => Math.round((ms / 60000) * 10) / 10;
  const byBlock: Record<string, number> = {};
  for (const [stage, ms] of Object.entries(ledger.byStage)) byBlock[stage] = minutes(ms);
  return {
    total_active_minutes: minutes(ledger.totalMs),
    by_stage_minutes: byBlock,
    sittings: ledger.sittings,
    longest_idle_minutes: minutes(ledger.longestIdleMs),
    first_seen_at: new Date(ledger.firstSeenAt).toISOString(),
    last_active_at: new Date(ledger.lastActiveAt).toISOString(),
    finished: ledger.stopped,
    counting_rule: `Time counts only while the tab is visible and there has been input within ${IDLE_MS / 1000} seconds.`,
  };
}
