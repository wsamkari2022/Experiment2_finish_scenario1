/*
 * simulate_visits.cjs — the guard on "how long did they work, and how many times did they come back".
 *
 * WHY THIS EXISTS. On 23 September 2026 the local database held seven participants whose
 * active_time was identical — 3.8 minutes, longest idle 14.3, first seen twelve days earlier — and
 * whose visit counts were 26, 28, 31, 77, 90, 96 and 99. Both numbers are reported in the paper and
 * one of them decides compensation, and nothing in the test suite looked at either. Three defects
 * were behind it:
 *
 *   1. the ledger belonged to the BROWSER, so a second participant inherited the first one's
 *      minutes and, once any run had finished, a clock that never ran again;
 *   2. a page load after a long gap counted the visit TWICE — once on load, once on the next tick,
 *      because the first one did not close the gap it had just counted;
 *   3. opening the study on another machine counted as no visit at all, though the study's rule
 *      says it is one.
 *
 * HOW IT TESTS THE REAL CODE. activeTime.ts is compiled by tools/tsconfig.dbshape.json and required
 * here. The browser is faked around it: a Map for localStorage, a clock this file moves by hand,
 * and a setInterval that hands back the heartbeat so it can be run tick by tick at controlled
 * times. Nothing is reimplemented, so a gate that passes here passes on the code that ships.
 *
 * Run:  npm run validate:visits
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");

try {
  execFileSync("npx", ["tsc", "-p", "tools/tsconfig.dbshape.json"], { cwd: ROOT, encoding: "utf8", shell: true });
} catch {
  /* The sim build reports errors from files this gate does not use; only the artifact matters. */
}
if (!fs.existsSync(path.join(BUILD, "activeTime.js"))) {
  console.error("  .sim-build/activeTime.js was not produced.");
  process.exit(1);
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));

/* ------------------------------------------------------------------ the fake browser */

const MINUTE = 60_000;
const TICK = 5_000;

let NOW = Date.UTC(2026, 8, 23, 9, 0, 0);
Date.now = () => NOW;

let store = new Map();
let heartbeats = [];
let listeners = {};

function installBrowser() {
  heartbeats = [];
  listeners = {};
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const on = (name, handler) => { (listeners[name] = listeners[name] || []).push(handler); };
  global.window = {
    addEventListener: on,
    removeEventListener: () => {},
    setInterval: (fn, ms) => { heartbeats.push({ fn, ms }); return heartbeats.length; },
    clearInterval: () => {},
  };
  global.document = { visibilityState: "visible", addEventListener: on };
}

/** A fresh page load: new module state, same storage — exactly what a refresh does. */
function reload() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(BUILD)) delete require.cache[key];
  }
  installBrowser();
  return require(path.join(BUILD, "activeTime.js"));
}

const tick = () => { for (const h of heartbeats) if (h.ms === TICK) h.fn(); };
/* The ledger is written by its own slower heartbeat, not by the tick. Without running it, every
   reading below would come from stale storage - which is what this file first reported. */
const flushToStorage = () => { for (const h of heartbeats) if (h.ms !== TICK) h.fn(); };
const input = () => { for (const h of listeners.pointermove || []) h(); };

/** Moves the clock forward tick by tick. `working` decides whether the participant touches anything. */
function advance(ms, working) {
  for (let spent = 0; spent < ms; spent += TICK) {
    NOW += TICK;
    if (working) input();
    tick();
  }
  flushToStorage();
}

const ledger = () => JSON.parse(store.get("vrds_active_time") || "{}");
const minutes = (l) => Math.round((l.totalMs / MINUTE) * 10) / 10;

/* ---------------------------------------------------------------------------- the gates */

let fails = 0;
const gate = (id, ok, msg) => {
  console.log(`  ${ok ? "  ok  " : " FAIL "} ${String(id).padEnd(4)} ${msg}`);
  if (!ok) fails += 1;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log("");
console.log("========================================================================");
console.log("  WORKING TIME AND VISITS");
console.log("========================================================================");
console.log("");

/* ---- V1: one uninterrupted sitting is one visit ---- */
{
  store = new Map();
  const A = reload();
  A.claimActiveClockFor("first@example.com");
  A.startActiveClock();
  A.setActiveStage("money");
  advance(20 * MINUTE, true);
  const l = ledger();
  gate("V1", l.sittings === 1 && near(minutes(l), 20, 0.3),
    `twenty minutes straight through is ONE visit  (${minutes(l)} min, ${l.sittings} visit)`);
}

/* ---- V2: half an hour away and back is a second visit, and only a second ---- */
{
  store = new Map();
  const A = reload();
  A.claimActiveClockFor("first@example.com");
  A.startActiveClock();
  A.setActiveStage("money");
  advance(10 * MINUTE, true);
  advance(31 * MINUTE, false);   // the tab is open; nobody is there
  advance(5 * MINUTE, true);
  const l = ledger();
  /* The counted time is the 15 minutes of work PLUS the ninety-second idle grace, which is
     deliberate: a participant reading a long scenario without touching anything is still working,
     and the clock waits that long before it decides otherwise. Anything beyond it would mean the
     idle rule had stopped working. */
  const withGrace = minutes(l) >= 15 && minutes(l) <= 16.6;
  gate("V2", l.sittings === 2 && withGrace,
    `31 minutes idle, then back, is exactly TWO visits  (${minutes(l)} min counted: 15 of work plus `
    + `the 90-second grace, ${l.sittings} visits)`);
  gate("V3", near(Math.round((l.longestIdleMs / MINUTE) * 10) / 10, 31, 0.3),
    `the gap itself is recorded  (longest idle ${Math.round((l.longestIdleMs / MINUTE) * 10) / 10} min)`);
}

/* ---- V4: reopening after a long gap counts ONE visit, not two ---- */
{
  store = new Map();
  let A = reload();
  A.claimActiveClockFor("first@example.com");
  A.startActiveClock();
  A.setActiveStage("money");
  advance(10 * MINUTE, true);

  NOW += 45 * MINUTE;            // they close the tab and come back after lunch
  A = reload();                  // a page load: new module state, same storage
  A.claimActiveClockFor("first@example.com");
  A.startActiveClock();
  A.setActiveStage("trolley");
  advance(5 * MINUTE, true);

  const l = ledger();
  gate("V5", l.sittings === 2,
    `a reload after 45 minutes away is ONE more visit, not two  (${l.sittings} visits)`);
  gate("V6", near(minutes(l), 15, 0.3),
    `and the 45 minutes away are not counted as work  (${minutes(l)} min)`);
}

/* ---- V7: a second participant on the same computer starts from nothing ---- */
{
  store = new Map();
  let A = reload();
  A.claimActiveClockFor("first@example.com");
  A.startActiveClock();
  A.setActiveStage("money");
  advance(12 * MINUTE, true);
  A.stopActiveClock();           // they finish and submit their feedback

  const after = ledger();
  NOW += 3 * MINUTE;
  A = reload();                  // the next participant sits down at the same machine
  A.claimActiveClockFor("second@example.com");
  A.startActiveClock();
  A.setActiveStage("money");
  advance(8 * MINUTE, true);

  const l = ledger();
  gate("V8", l.owner === "second@example.com" && l.sittings === 1 && near(minutes(l), 8, 0.3),
    `a different participant on the same browser starts at zero  (${minutes(l)} min, ${l.sittings} visit, `
    + `after the first one had banked ${minutes(after)})`);
  gate("V9", l.stopped === false,
    "and the first participant's finished-study flag does not stop the newcomer's clock");
}

/* ---- V10: the same participant's own ledger is never thrown away ---- */
{
  store = new Map();
  let A = reload();
  A.claimActiveClockFor("first@example.com");
  A.startActiveClock();
  A.setActiveStage("money");
  advance(10 * MINUTE, true);

  A = reload();
  A.claimActiveClockFor("First@Example.com ");   // same person, typed differently
  A.startActiveClock();
  A.setActiveStage("money");
  advance(4 * MINUTE, true);

  const l = ledger();
  gate("V10", near(minutes(l), 14, 0.3) && l.sittings === 1,
    `the same address in different letters is the same person  (${minutes(l)} min, ${l.sittings} visit)`);
}

/* ---- V11: opening the study on another machine is a visit ---- */
{
  store = new Map();
  const A = reload();
  A.claimActiveClockFor("first@example.com");
  A.startActiveClock();
  A.setActiveStage("money");
  advance(6 * MINUTE, true);
  A.noteNewVisit();              // sessionLog saw a different browser id
  advance(4 * MINUTE, true);
  const l = ledger();
  gate("V11", l.sittings === 2 && near(minutes(l), 10, 0.3),
    `a login from another device adds a visit and no time  (${minutes(l)} min, ${l.sittings} visits)`);
}

/* ---- V12: a finished study earns nothing more ---- */
{
  store = new Map();
  const A = reload();
  A.claimActiveClockFor("first@example.com");
  A.startActiveClock();
  A.setActiveStage("feedback");
  advance(7 * MINUTE, true);
  A.stopActiveClock();
  const atStop = minutes(ledger());
  advance(10 * MINUTE, true);    // they sit on the thank-you page
  A.noteNewVisit();              // and even reopen it somewhere else
  const l = ledger();
  gate("V12", near(minutes(l), atStop, 0.01) && l.sittings === 1,
    `after submitting, neither the minutes nor the visits move  (${minutes(l)} min, ${l.sittings} visit)`);
}

console.log("");
console.log("========================================================================");
if (fails) {
  console.log(`### ${fails} VISIT GATE${fails === 1 ? "" : "S"} FAILED ###`);
  console.log("========================================================================");
  console.log("");
  process.exit(1);
}
console.log("### ALL VISIT GATES PASSED ###");
console.log("========================================================================");
console.log("");
