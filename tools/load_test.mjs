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
 *   L5  (Prolific only since 10 November 2026) 200 more people in the same instant: 50 per condition; every record under
 *       prolific_pid with NO email and with Prolific's ids; an email is refused on every route and reaches no record
 *   L7  (the audit's F2) privacy on the real server: a lookup reveals only the status, a wrong age is refused, the right
 *       age brings back the person's details and run but none of their analysis, the create/update route answers only
 *       "ok", a write without the browser's id is refused, and another website gets no permission to read answers
 *   L8  (Step 4, since 7 October 2026) the Prolific completion code, with a made-up code in the server's settings: not
 *       before the completion is saved, nor for a finished record without the study's answers (a script's three requests;
 *       the audit of 7 October 2026), then the code letter for letter and Prolific's address, only to the browser holding the record,
 *       never for an email key (refused), never in a lookup or sign-in answer; the time and count written on the record, never
 *       the code; the health page says a code is set
 *   L6  the database rule swap: the throw-away database is first made with TODAY'S rule ("one email = one person" over
 *       every record) and an old record; the new server must replace the rule, keep the record, and accept the many
 *       Prolific records that have no email
 *
 * The first run, on 6 October 2026 before the fix: 0 errors, 400 people, 100 per condition, but 33 of 100, 41 of 100
 * and 67 of 200 waited longer than 3 seconds (the slowest 5.7 s). The numbers depend on the computer; the live server
 * is a different machine, which is why Prolific places are opened in batches as well.
 *
 * Run:  npm run test:load            (needs MongoDB running on this computer, as `npm run server` does)
 */
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
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
/** L8's made-up completion code: letters and digits, small and capital, like a code Prolific could give (kept letter for
 *  letter since the audit of 7 October 2026). */
const TEST_CODE = "LoadTest77";
const CONDITION_LIMIT_MS = 3000;
const WAVES = [
  { label: "wave1", people: 100, rounds: 15 },
  { label: "wave2", people: 100, rounds: 15 },
  { label: "wave3", people: 200, rounds: 5 },
  /* A bigger crowd, on the database that already holds the three waves. */
  { label: "big", people: 200, rounds: 5 },
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
    /* A Prolific ID looks like Prolific's: 24 letters a-f and digits. */
    const key = randomBytes(12).toString("hex");
    const identity = { prolificPid: key, prolificStudyId: "loadteststudy0001", prolificSessionId: randomBytes(12).toString("hex") };
    const sessionId = randomUUID(); // what session.ts makes with crypto.randomUUID()
    await call("health", "GET", "/health", null, browser);
    const arrivalId = randomUUID();
    const given = await call("condition", "POST", "/conditions/assign", { arrivalId }, browser);
    if (!given?.type) return { sessionId, key };
    await call("record", "POST", "/participants", {
      ...identity, sessionId, age: 30, gender: "Female", country: "Ireland", countryCode: "IE", englishFirstLanguage: true,
      consent: { agreed: true }, stage: "demographics",
      condition: { number: given.number, type: given.type, source: "landing_page", assignedAt: given.assignedAt, arrivalId },
    }, browser);
    const who = encodeURIComponent(key);
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
    return { sessionId, key };
  }

  const t0 = performance.now();
  const persons = await Promise.all(Array.from({ length: people }, (_, i) => person(i)));
  const seconds = (performance.now() - t0) / 1000;
  return { label, people, rounds, lat, errors, persons, sessionIds: persons.map((p) => p.sessionId), seconds };
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
  /* L6: the database as it is today, with the OLD rule over every record and one old record (a tester's, so it is
     never counted for balance). */
  const oldRecord = { email: "old-record@loadtest.invalid", participant_id: "old-record-1", status: "Study Completed",
    condition_type: "CVR+APA", condition_source: "address", updated_at: new Date().toISOString(), blocks: { kept: true } };
  await client.db(DB_NAME).collection("participants").createIndex({ email: 1 }, { name: "email_unique", unique: true });
  await client.db(DB_NAME).collection("participants").insertOne({ ...oldRecord });
  server = spawn(process.execPath, [path.join(ROOT, "server", "index.js")], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: production ? "production" : "development", PORT: String(PORT), HOST: "127.0.0.1", MONGO_URL, MONGO_DB: DB_NAME,
      /* A made-up completion code for L8 (never the real one, which lives only in the live server's .env). */
      PROLIFIC_COMPLETION_CODE: TEST_CODE },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let serverErrors = "";
  server.stderr.on("data", (d) => { serverErrors += d; });
  await waitForServer(server);

  const db = client.db(DB_NAME);
  const indexes = await db.collection("participants").indexes();
  const emailRule = indexes.find((i) => i.name === "email_unique");
  const pidRule = indexes.find((i) => i.name === "prolific_pid_unique");
  const oldAfter = await db.collection("participants").findOne({ email: oldRecord.email }, { projection: { _id: 0 } });
  const all = [];
  for (const wave of WAVES) {
    const w = await runWave(wave);
    all.push(w);
    console.log(`${w.label}: ${w.people} people at the same instant, ${w.rounds} rounds of 4 saves each, done in ${w.seconds.toFixed(1)} s`);
    for (const [name, arr] of Object.entries(w.lat)) {
      const over = name === "condition" ? arr.filter((ms) => ms >= CONDITION_LIMIT_MS).length : null;
      console.log(`  ${name.padEnd(9)} ${String(arr.length).padStart(5)} requests   median ${q(arr, 0.5).toFixed(0).padStart(5)} ms   95% under ${q(arr, 0.95).toFixed(0).padStart(5)} ms   slowest ${Math.max(...arr).toFixed(0).padStart(5)} ms${over === null ? "" : `   3 s or more: ${over}`}`);
    }
    const pids = w.persons.map((p) => p.key);
    const docs = await db.collection("participants").find({ prolific_pid: { $in: pids } },
      { projection: { participant_id: 1, condition_type: 1, status: 1, blocks: 1, email: 1, prolific_pid: 1, recruitment_source: 1, prolific_study_id: 1, prolific_session_id: 1 } }).toArray();
    w.docs = docs;
    w.records = docs.length;
    w.uniqueIds = new Set(docs.map((d) => d.participant_id)).size;
    w.sentIdsMatch = docs.every((d) => w.sessionIds.includes(d.participant_id));
    w.finished = docs.filter((d) => d.status === "Study Completed").length;
    w.allSaves = docs.filter((d) => Object.keys(d.blocks ?? {}).length === w.rounds).length;
    w.byCondition = {};
    for (const d of docs) {
      w.byCondition[d.condition_type] = (w.byCondition[d.condition_type] ?? 0) + 1;
    }
    w.linked = await db.collection("condition_arrivals").countDocuments({ linked_prolific_pid: { $in: pids } });
    console.log(`  saved ${w.records} of ${w.people}; own session ids ${w.uniqueIds}; finished ${w.finished}; every save landed for ${w.allSaves}; conditions ${JSON.stringify(w.byCondition)}`);
  }

  const requests = all.reduce((n, w) => n + Object.values(w.lat).reduce((m, a) => m + a.length, 0), 0);
  const errors = all.flatMap((w) => w.errors);
  gate("L1", errors.length === 0, `${requests.toLocaleString("en-US")} requests, ${errors.length} refused or failed${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  const people = all.reduce((n, w) => n + w.people, 0);
  const dataOk = all.every((w) => w.records === w.people && w.uniqueIds === w.people && w.sentIdsMatch && w.finished === w.people && w.allSaves === w.people);
  gate("L2", dataOk, `${people} people: every one saved with their own session id, every save landed, every one finished`);
  const evenIn = (byCondition, n) => { const counts = Object.values(byCondition); return counts.length === 4 && counts.every((c) => c === n / 4); };
  const single = all;
  const even = single.every((w) => evenIn(w.byCondition, w.people) && w.linked === w.people);
  gate("L3", even, `the four conditions exactly even in every wave (${single.map((w) => `${w.people}: ${w.people / 4} each`).join("; ")}), every arrival linked to its person`);
  /* L5: every record is a Prolific person's, with no email; and an email cannot get in by any route. */
  const proDocs = all.flatMap((w) => w.docs);
  const big = all.find((w) => w.label === "big");
  const recordsOk = proDocs.length === people
    && proDocs.every((d) => d.email === undefined && d.recruitment_source === "prolific" && /^[a-f0-9]{24}$/.test(d.prolific_pid) && d.prolific_study_id === "loadteststudy0001" && /^[a-f0-9]{24}$/.test(d.prolific_session_id ?? ""));
  const emailKey = "student@loadtest.invalid";
  const refusals = [];
  for (const [method, route, body] of [
    ["POST", "/participants/lookup", { email: emailKey }], ["POST", "/participants/lookup", { prolificPid: emailKey }],
    ["POST", "/participants", { email: emailKey, sessionId: randomUUID(), age: 30, gender: "Male", stage: "money" }],
    ["POST", "/participants", { prolificPid: emailKey, sessionId: randomUUID(), age: 30, gender: "Male", stage: "money" }],
    ["PATCH", `/participants/${encodeURIComponent(emailKey)}/stage`, { stage: "money" }], ["PATCH", `/participants/${encodeURIComponent(emailKey)}/complete`, {}],
    ["PATCH", `/participants/${encodeURIComponent(emailKey)}/section`, { path: "blocks.x", data: {} }], ["POST", `/participants/${encodeURIComponent(emailKey)}/claim`, { age: 30 }],
    ["POST", `/participants/${encodeURIComponent(emailKey)}/active`, {}], ["POST", `/participants/${encodeURIComponent(emailKey)}/prolific-code`, {}],
  ]) {
    const r = await fetch(BASE + route, { method, headers: { "content-type": "application/json", "x-vrds-browser": randomUUID() }, body: JSON.stringify(body) });
    if (r.status !== 400) refusals.push(`${method} ${route} answered ${r.status}`);
  }
  const withEmail = await db.collection("participants").countDocuments({ email: { $exists: true }, participant_id: { $ne: "old-record-1" } });
  const arrivalsWithEmail = await db.collection("condition_arrivals").countDocuments({ linked_email: { $exists: true } });
  gate("L5", evenIn(big.byCondition, big.people) && big.linked === big.people && recordsOk && refusals.length === 0 && withEmail === 0 && arrivalsWithEmail === 0,
    `${big.people} at once: ${JSON.stringify(big.byCondition)}; all ${proDocs.length} records under prolific_pid with no email and with Prolific's ids (${recordsOk}); an email was refused on all 10 routes (${refusals.length ? refusals.join(" | ") : "yes"}); records with an email ${withEmail}, arrivals naming an email ${arrivalsWithEmail}`);
  /* L6: the rule swap. */
  const swapOk = emailRule?.unique && JSON.stringify(emailRule.partialFilterExpression) === JSON.stringify({ email: { $type: "string" } })
    && pidRule?.unique && JSON.stringify(pidRule.partialFilterExpression) === JSON.stringify({ prolific_pid: { $type: "string" } })
    && oldAfter?.participant_id === oldRecord.participant_id && oldAfter?.blocks?.kept === true && proDocs.length > 1;
  /* L7: privacy on the real server (the audit's F2). */
  {
    const post = async (route, body, headers = {}) => {
      const r = await fetch(BASE + route, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
      return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
    };
    const key = all[0].persons[0].key;
    const why = [];
    for (const [label, body] of [["a Prolific ID", { prolificPid: key }]]) {
      const look = await post("/participants/lookup", body);
      if (JSON.stringify(Object.keys(look.json ?? {})) !== JSON.stringify(["status"])) why.push(`the lookup of ${label} revealed ${Object.keys(look.json ?? {}).join(", ")}`);
    }
    const browser = { "x-vrds-browser": randomUUID() };
    const wrongAge = await post(`/participants/${encodeURIComponent(key)}/claim`, { age: 31 }, browser);
    if (wrongAge.status !== 403 || wrongAge.json?.participant) why.push(`a wrong age answered ${wrongAge.status}`);
    const rightAge = await post(`/participants/${encodeURIComponent(key)}/claim`, { age: 30 }, browser);
    const handed = Object.keys(rightAge.json?.participant ?? {});
    if (rightAge.status !== 200 || rightAge.json?.participant?.prolific_pid !== key || "email" in (rightAge.json?.participant ?? {}) || !("files" in (rightAge.json ?? {}))) why.push(`the right age answered ${rightAge.status}`);
    for (const leak of ["blocks", "analysis", "headline", "major_info_and_scores", "resume_state", "active_browser"]) if (handed.includes(leak)) why.push(`signing in handed back ${leak}`);
    const created = await post("/participants", { prolificPid: randomBytes(12).toString("hex"), sessionId: randomUUID(), age: 40, gender: "Male", stage: "money" }, { "x-vrds-browser": randomUUID() });
    if (JSON.stringify(created.json) !== JSON.stringify({ ok: true })) why.push(`the create/update route answered ${JSON.stringify(created.json).slice(0, 80)}`);
    const noId = await fetch(`${BASE}/participants/${encodeURIComponent(key)}/section`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "blocks.part_0", data: { overwritten: true } }),
    });
    if (noId.status !== 400) why.push(`a write without the browser's id answered ${noId.status}`);
    const fromElsewhere = await fetch(`${BASE}/participants/lookup`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://somewhere-else.example" }, body: JSON.stringify({ prolificPid: key }),
    });
    if (fromElsewhere.headers.get("access-control-allow-origin")) why.push("another website is allowed to read the answer");
    gate("L7", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : "privacy on the real server: a lookup reveals only the status, a wrong age is refused, the right age brings the details and run without any analysis, the create/update route answers only \"ok\", a write without the browser's id is refused, no other website may read answers");
  }
  /* L8: the Prolific completion code (Step 4). */
  {
    const send = async (method, route, body, browser) => {
      const r = await fetch(BASE + route, {
        method, headers: { "content-type": "application/json", ...(browser ? { "x-vrds-browser": browser } : {}) },
        body: body === null ? undefined : JSON.stringify(body),
      });
      return { status: r.status, json: await r.json().catch(() => null), text: "" };
    };
    const why = [];
    const pid = randomBytes(12).toString("hex"), mine = randomUUID(), theirs = randomUUID();
    await send("POST", "/participants", { prolificPid: pid, sessionId: randomUUID(), age: 27, gender: "Male", stage: "feedback" }, mine);
    const early = await send("POST", `/participants/${pid}/prolific-code`, {}, mine);
    if (early.status !== 200 || early.json?.ready !== false || JSON.stringify(early.json).includes(TEST_CODE)) why.push(`before the completion the route answered ${early.status} ${JSON.stringify(early.json)}`);
    await send("PATCH", `/participants/${pid}/complete`, {}, mine);
    /* A finished record without the study's answers (what a script makes in three requests) gets no code. */
    const scripted = await send("POST", `/participants/${pid}/prolific-code`, {}, mine);
    if (scripted.json?.ready !== false || JSON.stringify(scripted.json).includes(TEST_CODE)) why.push(`a finished record without answers got ${JSON.stringify(scripted.json)}`);
    await send("PATCH", `/participants/${pid}/section`, { path: "blocks.block5_emergency_scenarios", data: { scenarioResults: Array.from({ length: 5 }, (_, i) => ({ scenarioId: i + 1 })) } }, mine);
    await send("PATCH", `/participants/${pid}/section`, { path: "blocks.feedback_answers", data: { feedback: { wellbeing: { items: { LI1: 4 } } } } }, mine);
    const fiveOnly = await send("POST", `/participants/${pid}/prolific-code`, {}, mine);
    if (fiveOnly.json?.ready !== false) why.push(`five scenarios of six got ${JSON.stringify(fiveOnly.json)}`);
    await send("PATCH", `/participants/${pid}/section`, { path: "blocks.block5_emergency_scenarios", data: { scenarioResults: Array.from({ length: 6 }, (_, i) => ({ scenarioId: i + 1 })) } }, mine);
    const given = await send("POST", `/participants/${pid}/prolific-code`, {}, mine);
    if (given.json?.ready !== true || given.json?.code !== TEST_CODE || given.json?.url !== `https://app.prolific.com/submissions/complete?cc=${TEST_CODE}`) why.push(`after the completion the route answered ${JSON.stringify(given.json)}`);
    const other = await send("POST", `/participants/${pid}/prolific-code`, {}, theirs);
    if (other.status !== 409 || JSON.stringify(other.json).includes(TEST_CODE)) why.push(`another browser got ${other.status}`);
    const noId = await send("POST", `/participants/${pid}/prolific-code`, {}, null);
    if (noId.status !== 400) why.push(`no browser id got ${noId.status}`);
    const notAnId = await send("POST", `/participants/${encodeURIComponent("student@loadtest.invalid")}/prolific-code`, {}, mine);
    if (notAnId.status !== 400 || JSON.stringify(notAnId.json).includes(TEST_CODE)) why.push(`an email got ${notAnId.status}`);
    await send("POST", `/participants/${pid}/prolific-code`, {}, mine);
    const look = await send("POST", "/participants/lookup", { prolificPid: pid }, null);
    const claim = await send("POST", `/participants/${pid}/claim`, { age: 27 }, theirs);
    if (JSON.stringify(look.json).includes(TEST_CODE) || JSON.stringify(claim.json).includes(TEST_CODE)) why.push("the lookup or the sign-in carried the code");
    const doc = await db.collection("participants").findOne({ prolific_pid: pid });
    if (!doc?.prolific_code_given_at || doc.prolific_code_given_times !== 2 || !doc.prolific_code_last_given_at || doc.prolific_code_given_at > doc.prolific_code_last_given_at) why.push(`the record's code times: ${JSON.stringify({ at: doc?.prolific_code_given_at, n: doc?.prolific_code_given_times })}`);
    if (JSON.stringify(doc ?? {}).includes(TEST_CODE)) why.push("the code itself was written on the record");
    const health = await send("GET", "/health", null, null);
    if (health.json?.prolific_code_configured !== true || JSON.stringify(health.json).includes(TEST_CODE)) why.push(`the health page said ${JSON.stringify(health.json?.prolific_code_configured)}`);
    gate("L8", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : "the Prolific completion code: not before the completion is saved, nor for a finished record without the study's answers (or with five scenarios of six); then the code letter for letter and Prolific's address, to the browser holding the record only (another browser 409, no id 400), never for an email key (refused), never in a lookup or sign-in answer; the first time, the last time and the count on the record, never the code; the health page says a code is set");
  }
  gate("L6", !!swapOk, `the old "one email = one person" rule over every record was replaced at startup by the rules that cover only the records that have the field; the old record kept; ${proDocs.length} Prolific records without an email accepted`);
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
