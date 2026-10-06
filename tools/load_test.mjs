/*
 * load_test.mjs — "multiple sessions safe": many people starting the study at the same moment (since 6 October 2026).
 *
 * The researcher's advisor asked what happens if 100 people enter at once. This tool answers it with the REAL server:
 * it starts server/index.js itself (production mode when dist/ exists), on port 4100, against a THROW-AWAY database on
 * this computer's MongoDB, and then sends waves of pretend participants who all arrive in the same instant and work
 * as hard as a browser can: the "are you there?" check, the landing page's condition, the record, many saves (the
 * stage, "am I still the active browser?", a block, the resume copy that the server merges), and the completion.
 * Their saves come far more often than a real person's, so this is harsher than real life.
 *
 * It never touches the development database or the live server: the address is fixed to 127.0.0.1, the database
 * name always starts with vrds_load_test_, and the database is deleted at the end, whatever happens.
 *
 *   L1  every request answered, none refused or failed
 *   L2  every person saved, each with their OWN session id, every save landed, every person finished
 *   L3  the four conditions exactly even inside every wave (and every arrival linked to its person)
 *   L4  nobody waited 3 seconds or more for their condition (until 6 October 2026: 33 of 100 did, and the page then
 *       gave them a random condition that was never counted; now the page also waits longer and asks again)
 *
 * The first run, on 6 October 2026 before the fix: 0 errors, 400 people, 100 per condition, but 33 of 100, 41 of 100
 * and 67 of 200 waited longer than 3 seconds (the slowest 5.7 s). The numbers depend on the computer; the live server
 * is a different machine, which is why Prolific places are opened in batches as well.
 *
 * Run:  npm run test:load            (needs MongoDB running on this computer, as `npm run server` does)
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { MongoClient } = createRequire(path.join(ROOT, "package.json"))("mongodb");

const PORT = 4100;
const MONGO_URL = "mongodb://127.0.0.1:27017";
const DB_NAME = `vrds_load_test_${Date.now()}`;
const BASE = `http://127.0.0.1:${PORT}/api`;
const CONDITION_LIMIT_MS = 3000;
const WAVES = [
  { label: "wave1", people: 100, rounds: 15 },
  { label: "wave2", people: 100, rounds: 15 },
  { label: "wave3", people: 200, rounds: 5 },
];
if (!DB_NAME.startsWith("vrds_load_test_")) throw new Error("refusing to run against a database that is not a load test");

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const filler = (kb) => "x".repeat(kb * 1024);
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

async function runWave({ label, people, rounds }) {
  const lat = {};
  const errors = [];
  async function call(name, method, route, body, browser) {
    const t = performance.now();
    try {
      const r = await fetch(BASE + route, {
        method,
        headers: { "content-type": "application/json", "x-vrds-browser": browser },
        body: body ? JSON.stringify(body) : undefined,
      });
      (lat[name] ??= []).push(performance.now() - t);
      const json = await r.json().catch(() => null);
      if (!r.ok) errors.push(`${name} ${r.status} ${JSON.stringify(json).slice(0, 120)}`);
      return json;
    } catch (e) {
      errors.push(`${name} failed: ${e.message}`);
      return null;
    }
  }
  async function person(i) {
    const browser = randomUUID();
    const email = `${label}-${i}@loadtest.invalid`;
    const sessionId = randomUUID(); // what session.ts makes with crypto.randomUUID()
    await call("health", "GET", "/health", null, browser);
    const arrivalId = randomUUID();
    const given = await call("condition", "POST", "/conditions/assign", { arrivalId }, browser);
    if (!given?.type) return sessionId;
    await call("record", "POST", "/participants", {
      email, sessionId, age: 30, gender: "Female", country: "Ireland", countryCode: "IE", englishFirstLanguage: true,
      consent: { agreed: true }, stage: "demographics",
      condition: { number: given.number, type: given.type, source: "landing_page", assignedAt: given.assignedAt, arrivalId },
    }, browser);
    const who = encodeURIComponent(email);
    for (let r = 0; r < rounds; r++) {
      await pause(Math.random() * 200);
      await Promise.all([
        call("stage", "PATCH", `/participants/${who}/stage`, { stage: `stage_${r}` }, browser),
        call("active?", "POST", `/participants/${who}/active`, {}, browser),
        call("block", "PATCH", `/participants/${who}/section`, { path: `blocks.part_${r}`, data: { answers: filler(20) } }, browser),
        call("resume", "PATCH", `/participants/${who}/section`, { path: "resume_state", data: { [`vrds_file_${r}`]: filler(40) } }, browser),
      ]);
    }
    await call("complete", "PATCH", `/participants/${who}/complete`, {}, browser);
    return sessionId;
  }

  const t0 = performance.now();
  const sessionIds = await Promise.all(Array.from({ length: people }, (_, i) => person(i)));
  const seconds = (performance.now() - t0) / 1000;
  return { label, people, rounds, lat, errors, sessionIds, seconds };
}

async function waitForServer(server) {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`the server stopped (exit ${server.exitCode})`);
    try {
      const r = await fetch(`${BASE}/health`);
      const json = await r.json();
      if (json?.ok && json.database === DB_NAME) return;
      if (json?.ok) throw new Error(`port ${PORT} is answered by another server (database ${json.database}); stop it first`);
    } catch (e) {
      if (/another server/.test(e.message)) throw e;
    }
    await pause(250);
  }
  throw new Error("the server did not start within 15 seconds");
}

const production = existsSync(path.join(ROOT, "dist", "index.html"));
let server = null;
const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
let fails = 0;
const gate = (id, ok, msg) => { console.log(`  ${ok ? "  ok  " : " FAIL "} ${id}  ${msg}`); if (!ok) fails += 1; };

try {
  await client.connect();
  console.log(`\nLoad test: the real server (${production ? "production mode, serving dist/" : "API only: no dist/ yet"}) on port ${PORT},`);
  console.log(`database ${DB_NAME} on this computer (deleted at the end).\n`);
  server = spawn(process.execPath, [path.join(ROOT, "server", "index.js")], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: production ? "production" : "development", PORT: String(PORT), HOST: "127.0.0.1", MONGO_URL, MONGO_DB: DB_NAME },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let serverErrors = "";
  server.stderr.on("data", (d) => { serverErrors += d; });
  await waitForServer(server);

  const db = client.db(DB_NAME);
  const all = [];
  for (const wave of WAVES) {
    const w = await runWave(wave);
    all.push(w);
    console.log(`${w.label}: ${w.people} people at the same instant, ${w.rounds} rounds of 4 saves each, done in ${w.seconds.toFixed(1)} s`);
    for (const [name, arr] of Object.entries(w.lat)) {
      const over = name === "condition" ? arr.filter((ms) => ms >= CONDITION_LIMIT_MS).length : null;
      console.log(`  ${name.padEnd(9)} ${String(arr.length).padStart(5)} requests   median ${q(arr, 0.5).toFixed(0).padStart(5)} ms   95% under ${q(arr, 0.95).toFixed(0).padStart(5)} ms   slowest ${Math.max(...arr).toFixed(0).padStart(5)} ms${over === null ? "" : `   3 s or more: ${over}`}`);
    }
    const docs = await db.collection("participants").find({ email: { $regex: `^${w.label}-` } },
      { projection: { participant_id: 1, condition_type: 1, status: 1, blocks: 1 } }).toArray();
    w.records = docs.length;
    w.uniqueIds = new Set(docs.map((d) => d.participant_id)).size;
    w.sentIdsMatch = docs.every((d) => w.sessionIds.includes(d.participant_id));
    w.finished = docs.filter((d) => d.status === "Study Completed").length;
    w.allSaves = docs.filter((d) => Object.keys(d.blocks ?? {}).length === w.rounds).length;
    w.byCondition = {};
    for (const d of docs) w.byCondition[d.condition_type] = (w.byCondition[d.condition_type] ?? 0) + 1;
    w.linked = await db.collection("condition_arrivals").countDocuments({ linked_email: { $regex: `^${w.label}-` } });
    console.log(`  saved ${w.records} of ${w.people}; own session ids ${w.uniqueIds}; finished ${w.finished}; every save landed for ${w.allSaves}; conditions ${JSON.stringify(w.byCondition)}\n`);
  }

  const requests = all.reduce((n, w) => n + Object.values(w.lat).reduce((m, a) => m + a.length, 0), 0);
  const errors = all.flatMap((w) => w.errors);
  gate("L1", errors.length === 0, `${requests.toLocaleString("en-US")} requests, ${errors.length} refused or failed${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  const people = all.reduce((n, w) => n + w.people, 0);
  const dataOk = all.every((w) => w.records === w.people && w.uniqueIds === w.people && w.sentIdsMatch && w.finished === w.people && w.allSaves === w.people);
  gate("L2", dataOk, `${people} people: every one saved with their own session id, every save landed, every one finished`);
  const even = all.every((w) => {
    const counts = Object.values(w.byCondition);
    return counts.length === 4 && counts.every((c) => c === w.people / 4) && w.linked === w.people;
  });
  gate("L3", even, `the four conditions exactly even in every wave (${all.map((w) => `${w.people}: ${w.people / 4} each`).join("; ")}), every arrival linked to its person`);
  const slow = all.reduce((n, w) => n + (w.lat.condition ?? []).filter((ms) => ms >= CONDITION_LIMIT_MS).length, 0);
  const slowest = Math.max(...all.flatMap((w) => w.lat.condition ?? [0]));
  gate("L4", slow === 0, `nobody waited 3 seconds for their condition (slowest ${(slowest / 1000).toFixed(2)} s; ${slow} of ${people} waited 3 s or more)`);
  if (serverErrors.trim()) console.log(`\n  the server wrote errors:\n${serverErrors.split("\n").slice(0, 8).map((l) => `    ${l}`).join("\n")}`);
} catch (e) {
  console.error(`\n  The load test could not run: ${e.message}`);
  fails += 1;
} finally {
  if (server && server.exitCode === null) server.kill();
  try {
    await client.db(DB_NAME).dropDatabase();
    console.log(`\n  ${DB_NAME} deleted.`);
  } catch { /* MongoDB was not reachable, so nothing was made */ }
  await client.close().catch(() => {});
}

console.log("");
console.log("==============================================================================");
console.log(fails ? `### ${fails} LOAD GATE${fails === 1 ? "" : "S"} FAILED ###` : "### ALL LOAD GATES PASSED ###");
console.log("==============================================================================");
process.exit(fails ? 1 : 0);
