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
 * THE LEDGER BELONGS TO A PARTICIPANT, NOT TO A BROWSER (23 September 2026)
 * ============================================================================
 * It did not, and the local database showed what that costs: seven participants carrying the same
 * 3.8 minutes, the same longest idle and the same first-seen date from twelve days earlier, with
 * visit counts of 26, 28, 31, 77, 90, 96 and 99. One localStorage key, never reset when a
 * different person began, so every run inherited the last one's totals — and once ANY run had
 * finished, `stopped` stayed true and the next participant's whole study counted as no work at
 * all. Two people sharing a lab computer is all it takes.
 *
 * `claimActiveClockFor` now hands the clock to whoever has been identified and replaces the ledger
 * when that is somebody new. An unowned ledger is adopted only if it was touched within the last
 * half hour, so the minutes somebody spends on the consent page are kept and a run abandoned in
 * that browser last week is not.
 *
 * `npm run validate:visits` holds all of it: one sitting, a 31-minute break, a reload after lunch,
 * a second participant at the same machine, the same participant on a second machine, and a
 * finished study that must earn nothing more.
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
  /**
   * The last time the participant actually touched something — moved, typed, clicked, scrolled.
   *
   * SEPARATE FROM `lastActiveAt`, WHICH IS THE LAST MOMENT TIME WAS COUNTED, and the two differ by
   * up to the ninety-second idle grace. "Away for more than half an hour" is a fact about the
   * PERSON, so it has to be measured from the person: measured from the clock instead, a
   * thirty-one minute absence came out as twenty-nine and a half and counted as no visit at all.
   *
   * Persisted, so a browser that is closed and reopened still knows when they were last here.
   */
  lastInputAt: number;
  /** The longest single gap between activity, in ms. A large value is worth a look. */
  longestIdleMs: number;
  /** Set when the study finishes. Once true the clock never advances again. */
  stopped: boolean;
  /**
   * WHOSE TIME THIS IS — the participant's email, lower-cased.
   *
   * Added 23 September 2026, because without it this ledger belonged to the BROWSER. A second
   * participant on the same computer inherited the first one's minutes, their visit count, and -
   * worst of all - their `stopped` flag, so the newcomer's entire run counted as zero working
   * minutes. Seven test records in the local database all carried the same 3.8 minutes and the
   * same first-seen date from twelve days earlier; only the visit count moved, upward, forever.
   *
   * Undefined on a ledger written before that date. Such a ledger is claimed by the first
   * participant who is identified, which is the safe reading: it is theirs unless proven otherwise.
   */
  owner?: string;
}

const emptyLedger = (now: number, owner?: string): ActiveLedger => ({
  totalMs: 0,
  byStage: {},
  sittings: 1,
  firstSeenAt: now,
  lastActiveAt: now,
  lastInputAt: now,
  longestIdleMs: 0,
  stopped: false,
  owner,
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
      /* A ledger written before 23 September 2026 has no such field; the last counted moment is
         the closest honest answer, and it is never in the future. */
      lastInputAt: typeof parsed.lastInputAt === "number"
        ? parsed.lastInputAt
        : (typeof parsed.lastActiveAt === "number" ? parsed.lastActiveAt : now),
      longestIdleMs: typeof parsed.longestIdleMs === "number" ? parsed.longestIdleMs : 0,
      stopped: parsed.stopped === true,
      owner: typeof parsed.owner === "string" ? parsed.owner : undefined,
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
  const now = Date.now();

  /*
   * A VISIT ENDS BY BEING AWAY AND BEGINS BY COMING BACK, so it is counted here, at the first
   * touch after the absence, rather than on the next heartbeat. Two things follow from that.
   *
   * The gap is the real one — input to input — instead of "since the clock last counted", which
   * is up to ninety seconds shorter and turned a thirty-one minute absence into no visit at all.
   *
   * And `lastActiveAt` is moved forward as the gap is counted, so the heartbeat cannot find the
   * same gap still open and count the visit a second time.
   */
  const awayFor = now - ledger.lastInputAt;
  if (awayFor > SITTING_GAP_MS && currentStage && !ledger.stopped) {
    ledger.sittings += 1;
    ledger.lastActiveAt = now;
    if (awayFor > ledger.longestIdleMs) ledger.longestIdleMs = awayFor;
  }
  ledger.lastInputAt = now;

  /* Clear the notice on the spot. Leaving it to the next heartbeat meant up to five seconds of a
     participant moving the mouse at a screen that still said the study was waiting for them. */
  if (paused && currentStage) setPaused(false);
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
  const recentlyActive = now - ledger.lastInputAt < IDLE_MS;

  /*
   * No stage means the entry screen, where they are typing an email. That is not participation,
   * and counting it would also break something an analyst will assume without checking: that the
   * total equals the sum of the per-stage times. A total that is larger than its own parts is the
   * kind of discrepancy that makes somebody distrust every other number in the record.
   *
   * CHECKED BEFORE THE IDLE RULE SINCE 20 SEPTEMBER 2026. It used to come second, so somebody
   * reading the start screen for ninety seconds was shown a notice telling them the study was
   * waiting for them - over a form that was not being timed and had nothing to pause.
   */
  if (!currentStage) {
    setPaused(false);
    lastCountedAt = now;
    return;
  }

  if (!visible || !recentlyActive) {
    setPaused(true);
    /* Move the marker forward while paused, so the gap is never counted when they return. */
    lastCountedAt = now;
    return;
  }

  /*
   * THE VISIT COUNT IS NOT DECIDED HERE, and used to be. Measuring the absence from the last
   * counted moment is wrong in both directions: it is short by the idle grace when somebody walks
   * away, and it is long by however many minutes they spent on the start screen, where nothing is
   * counted — which meant a participant who read the consent page slowly was recorded as having
   * left and come back. noteInput owns it now, measured from the participant.
   */

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

/**
 * Combines what this page holds with what is in storage, keeping the larger of every total.
 *
 * WHY WRITING BLINDLY LOST WHOLE MACHINES OF WORK. Restoring a run onto a new computer writes the
 * downloaded ledger into storage and then reloads the page — and a reload fires `beforeunload`,
 * which flushes. The flush wrote the ledger this page happened to be holding, which was the new
 * machine's nearly empty one, straight over the run that had just been downloaded. Three machines
 * in a row therefore reported the last machine's few minutes and two visits, because each hand-off
 * threw away everything before it. Found by gate V19 on 23 September 2026.
 *
 * Taking the larger of each total is the right rule for more than that one race: two tabs of the
 * same study also write this file, and neither of them should be able to undo the other's minutes.
 *
 * A ledger belonging to somebody else is never merged — claimActiveClockFor has already decided
 * that question, and merging would put two participants' work in one record.
 */
function mergeWithStored(mine: ActiveLedger): ActiveLedger {
  const stored = read();
  if (stored.owner !== mine.owner) return mine;

  const byStage: Record<string, number> = { ...stored.byStage };
  for (const [stage, ms] of Object.entries(mine.byStage)) {
    byStage[stage] = Math.max(ms, stored.byStage[stage] ?? 0);
  }
  return {
    totalMs: Math.max(mine.totalMs, stored.totalMs),
    byStage,
    sittings: Math.max(mine.sittings, stored.sittings),
    firstSeenAt: Math.min(mine.firstSeenAt, stored.firstSeenAt),
    lastActiveAt: Math.max(mine.lastActiveAt, stored.lastActiveAt),
    lastInputAt: Math.max(mine.lastInputAt, stored.lastInputAt),
    longestIdleMs: Math.max(mine.longestIdleMs, stored.longestIdleMs),
    stopped: mine.stopped || stored.stopped,
    owner: mine.owner,
  };
}

function flush(): void {
  if (!started) return;
  ledger = mergeWithStored(ledger);
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

  /*
   * A page load after a long gap is a new visit. Counted here rather than in the tick, because
   * the participant may load the page and read for a while before touching anything.
   *
   * AND THE GAP IS CLOSED IMMEDIATELY, which it was not until 23 September 2026. This counted the
   * visit and left `lastActiveAt` where it was, so the first tick that counted any time saw the
   * very same gap still open and counted the visit a SECOND time. Every return after half an hour
   * away was worth two visits, which is most of why a tester who never left their chair finished
   * the study with ninety-nine of them.
   */
  const now = Date.now();
  const awayFor = now - ledger.lastInputAt;
  if (ledger.totalMs > 0 && awayFor > SITTING_GAP_MS && !visitCountedThisLoad) {
    ledger.sittings += 1;
    ledger.lastActiveAt = now;
    visitCountedThisLoad = true;
    if (awayFor > ledger.longestIdleMs) ledger.longestIdleMs = awayFor;
  }
  ledger.lastInputAt = now;
  lastCountedAt = now;

  for (const name of INPUT_EVENTS) {
    window.addEventListener(name, noteInputThrottled, { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      /*
       * PAUSE AT ONCE, RATHER THAN AT THE NEXT HEARTBEAT.
       *
       * A hidden tab has its timers throttled to roughly once a minute, and a browser is free to
       * freeze them altogether. Waiting for a tick to notice meant the pause frequently never
       * happened at all, and the participant came back to a study that looked as though it had
       * been counting the whole time they were gone.
       *
       * Nothing about what is COUNTED changes here: tick has always refused to add time while the
       * tab is hidden. This is the notice, and only the notice.
       */
      if (currentStage) setPaused(true);
      flush();
      return;
    }
    /*
     * COMING BACK IS NOT ACTIVITY.
     *
     * This used to call noteInput(), which restarted the idle clock and cleared the notice before
     * anybody could read it: they returned, the notice vanished, and nothing ever told them that
     * the minutes they spent away had not been counted. It now stays up until they do something,
     * which is precisely what it asks them to do, and the first move, key or scroll clears it
     * through the ordinary input path.
     *
     * The marker is moved forward so the first tick after their return cannot add the gap.
     */
    lastCountedAt = Date.now();
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
 * True when a visit has already been counted during this page load.
 *
 * ONE PAGE LOAD BEGINS AT MOST ONE VISIT. Coming back after an hour, on a different laptop, is one
 * return — but two separate rules see it: the load-time gap and the change of machine. Counted
 * separately they made a single return worth two visits.
 */
let visitCountedThisLoad = false;

/**
 * Hands this browser's clock to the participant who has just been identified.
 *
 * If the ledger already belongs to somebody else, it is REPLACED rather than continued: a new
 * participant starts at zero minutes, one visit, and a clock that is running. Anything else means
 * one person's effort is recorded against another's name, and — because `stopped` survives in
 * storage once a run has finished — that the newcomer's whole study counts as no work at all.
 *
 * AN UNOWNED LEDGER IS ADOPTED ONLY IF IT BELONGS TO THIS SITTING. The case worth keeping is the
 * few minutes somebody spends on the consent page before their email is known, which is this same
 * page load. A ledger nobody has touched for more than half an hour is from a run that ended
 * without being claimed — an earlier participant at a shared machine, or an earlier test — and
 * adopting it hands its minutes, its visits and its idle gaps to the wrong person. A real run on
 * 23 September inherited one that was six days old, and its 4.6-day gap was then counted as a
 * fresh visit. Ledgers written before that date carry no owner, so this is the rule that decides
 * them.
 *
 * Safe to call on every render: it writes only when something actually changes.
 */
export function claimActiveClockFor(email: string | null | undefined): void {
  if (!email) return;
  const who = email.trim().toLowerCase();
  if (!who) return;

  if (ledger.owner === who) return;

  const now = Date.now();

  if (ledger.owner === undefined) {
    const stale = ledger.stopped || now - ledger.lastInputAt > SITTING_GAP_MS;
    if (!stale) {
      ledger.owner = who;
      write(ledger);
      return;
    }
    /* Left behind by somebody else, or by an earlier run. Not this participant's. */
  }

  /* A different person is now using this browser. Their study starts now. */
  ledger = emptyLedger(now, who);
  lastCountedAt = now;
  visitCountedThisLoad = true;   // the fresh ledger already stands at one visit
  setPaused(false);
  write(ledger);
}

/**
 * Counts one more visit, for a reason the clock itself cannot see.
 *
 * The clock knows about time: a gap of more than thirty minutes ends a visit and the next activity
 * begins another. It cannot know that the participant has opened the study on a different machine,
 * and by the study's own rule that is a new visit too. sessionLog notices the change of browser
 * and says so here, which keeps one definition of a visit rather than two.
 */
export function noteNewVisit(): boolean {
  if (ledger.stopped) return false;
  /* The load has already begun a visit — because the ledger was fresh, or because the gap since
     the last activity was long enough. Arriving on a new machine as well does not make it two. */
  if (visitCountedThisLoad) return false;
  visitCountedThisLoad = true;
  ledger.sittings += 1;
  ledger.lastActiveAt = Date.now();
  write(ledger);
  return true;
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
