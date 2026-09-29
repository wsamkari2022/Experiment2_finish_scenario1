/**
 * sessionGuard.ts — one place the study runs at a time, and progress that reaches the server as it is
 * made (since 29 September 2026, the researcher's plan answers "Q1-yes, Q2-yes, Q3-yes, Q5-yes").
 *
 * THE LOCK. A participant may open the study on a second browser or device, or in a second tab, and keep
 * using the first one. Two places writing one record is how answers get overwritten. So:
 *   - "browser": the server keeps ONE active browser per participant (server/activeBrowser.js). The newest
 *     browser that passes the email-and-age check takes it. This page asks "am I still the one?" when it
 *     opens, after every page and after every Block 5 scenario; and every write the server refuses for this
 *     reason (409) says the same thing. Either way the page is covered by SessionLockScreen.
 *   - "tab": two tabs of one browser share one id, so the server cannot tell them apart. Each page load
 *     writes a claim into this browser's storage; a tab that sees a NEWER claim from another tab locks.
 * A network problem never locks anybody: only a clear "another browser holds it" does.
 *
 * PROGRESS AS IT IS MADE. The server used to hear about a block only when the block ended, so a participant
 * who moved to another device in the middle of Block 2, 3 or 5 found nothing there to continue from.
 * The blocks now call `progressSaved()` when they save their progress; the page sends the resume files.
 * Block 5 sends at once after every scenario; Blocks 2 and 3 save on every answer, so theirs are gathered
 * and sent a few seconds later (and at once when the tab is hidden or closed).
 */

import { isThisBrowserActive, setLockedListener, setOutboxAside } from "./storage";

export type LockReason = "browser" | "tab";

let lock: LockReason | null = null;
const listeners = new Set<(reason: LockReason | null) => void>();

export function getLock(): LockReason | null {
  return lock;
}

export function setLock(reason: LockReason | null): void {
  if (lock === reason) return;
  /* A browser lock outranks a tab lock: the tab's "use this tab" would not help. */
  if (lock === "browser" && reason === "tab") return;
  lock = reason;
  if (reason === "browser") setOutboxAside();
  for (const l of listeners) l(reason);
}

export function onLockChange(listener: (reason: LockReason | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* A write the server refused because another browser holds the record locks this page. */
setLockedListener(() => setLock("browser"));

/* ----------------------------------------------------------------------------------------- browser */

/** Asks the server whether this browser still holds the participant's record; locks when it does not. */
export async function checkActiveBrowser(email: string | null): Promise<void> {
  const active = await isThisBrowserActive(email);
  if (active === false) setLock("browser");
}

/* --------------------------------------------------------------------------------------------- tab */

export const TAB_KEY = "vrds_active_tab";
/** This page load's own id. A reload makes a new one, and so claims the study again. */
const TAB_ID = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let watching = false;

/** This tab becomes the one the study runs in; any other open tab of the study will lock. */
export function claimTab(): void {
  try {
    localStorage.setItem(TAB_KEY, JSON.stringify({ id: TAB_ID, at: Date.now() }));
  } catch { /* no storage: nothing to share between tabs either */ }
}

/** Locks this tab when another tab claims the study. The storage event only fires in the OTHER tabs. */
export function watchTabs(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== TAB_KEY || !e.newValue) return;
    try {
      const claim = JSON.parse(e.newValue) as { id?: string };
      if (claim?.id && claim.id !== TAB_ID) setLock("tab");
    } catch { /* not ours */ }
  });
}

/* -------------------------------------------------------------------------------- progress to server */

/** Whose progress a saved file is: the participant's email, lower case ("" without one). A block restores
 *  its progress only for the same owner, so a second person on the same computer never continues the
 *  first person's run. */
export function progressOwner(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

let sender: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const GATHER_MS = 4000;

/** The page registers how to send the progress (it knows the participant's email). */
export function setProgressSender(send: (() => void) | null): void {
  sender = send;
}

function sendNow(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (lock) return;
  sender?.();
}

/**
 * Called by a block right after it saves its progress in this browser. `now` sends at once (Block 5, after
 * a scenario); otherwise the saves of the next few seconds are gathered into one send.
 */
export function progressSaved(now = false): void {
  if (now) { sendNow(); return; }
  if (timer) return;
  timer = setTimeout(sendNow, GATHER_MS);
}

/* Leaving the tab sends what is waiting, so a closed tab does not keep the last answers to itself. */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timer) sendNow();
  });
}
