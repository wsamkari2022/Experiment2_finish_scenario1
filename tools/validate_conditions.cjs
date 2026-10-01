/*
 * validate_conditions.cjs — the four conditions and the landing page that balances them (since 1 October 2026).
 *
 * The researcher's design: four conditions (1 CVR+APA, 2 CVR_Only, 3 APA_Only, 4 Baseline) that share Blocks 1-4;
 * "Condition number" and "condition type" saved with the demographic data; the condition type in each condition's
 * address; a landing page that counts each condition in the database for every new arrival and gives the one with
 * the fewest. His answers: Q1-B (who counts: finished, still working in the last 2 hours, arrived in the last 30
 * minutes), Q2-yes (a condition opened from the address is a test, never counted), Q3-yes (a count page).
 * These gates run the real code (src/experiment/conditions.ts, participantDirectory.ts, storage.ts, dbShape.ts and
 * server/conditions.js) and read the pages' and the server's source:
 *
 *   N1  one list: the page's and the server's four conditions are the same, with the researcher's names and numbers
 *   N2  the choice: the fewest always wins; a tie goes to each tied condition about equally, and never to another
 *   N3  who counts (Q1-B): finished, working within 2 hours, arrived within 30 minutes and not yet linked or released;
 *       a drop-out, a test by address and a run without a server never count; the count page shows all four
 *   N4  one at a time: 40 people arriving in the same moment end up 10 in each condition, and 40 more on top of an
 *       uneven start even it out exactly
 *   N5  the same arrival twice gets the same condition and is stored once; an arrival id that is not one is refused
 *   N6  the record: the server sets the condition only on a record that has none, only when the number and the name
 *       agree, and links the landing page's arrival to the person; the routes and the arrival index exist
 *   N7  the address: every spelling of each condition is read, anything else is not; the rest of the address (a
 *       Prolific ID later) is kept when the condition is written into it
 *   N8  the browser: the file is read back exactly, an old version is not; the directory keeps the FIRST condition;
 *       the save sends the arrival id once and never stores it; with no server the landing page gets no answer and
 *       picks at random
 *   N9  the flow, from the source: the landing page comes first for a browser without a condition and is never saved
 *       as a stage; the two fields go beside the demographic answers; both saves carry the condition; a returning
 *       participant keeps theirs and releases the new arrival; the address shows the saved condition; the condition
 *       is never named on the page; the file is not carried in resume_state; the development reset clears it
 *   N10 the database copy: major_info_and_scores.condition is the file's number, name, source and time, counted for
 *       balance only when the landing page gave it, null without a file, and named in where_each_number_lives
 *
 * Run:  npm run validate:conditions
 */
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");
try {
  execFileSync("npx", ["tsc", "-p", "tools/tsconfig.dbshape.json"], { cwd: ROOT, encoding: "utf8", shell: true });
} catch { /* errors in files this tool does not use are not its business */ }
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));

/* A pretend browser store. */
let store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { store = {}; },
  key: (i) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
};

const B = (f) => require(path.join(BUILD, f));
const C = B("conditions.js");
const dir = B("participantDirectory.js");
const storage = B("storage.js");
const db = B("dbShape.js");
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const results = [];
const gate = (id, what, why) => {
  results.push({ id, ok: why.length === 0 });
  console.log(`${why.length ? "FAIL" : " ok "} ${id}  ${what}${why.length ? `\n       - ${why.join("\n       - ")}` : ""}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* A seeded random (mulberry32), so every run is the same; a plain LCG was too uneven for the tie test. */
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* A pretend database for the server's assignment: every call takes a moment, as a real one does. */
function pretendStore(docs = [], { slow = 3, random = seeded(7) } = {}) {
  const arrivals = [];
  const pause = () => wait(Math.floor(random() * slow));
  return {
    arrivals,
    findArrival: async (id) => { await pause(); return arrivals.find((a) => a.arrival_id === id) ?? null; },
    loadDocs: async () => { await pause(); return docs.map((d) => ({ ...d })); },
    loadArrivals: async (since) => {
      await pause();
      return arrivals.filter((a) => !a.linked_email && !a.released && a.assigned_at >= since).map((a) => ({ ...a }));
    },
    insertArrival: async (row) => { await pause(); arrivals.push({ ...row }); },
  };
}

(async () => {
  const S = await import(pathToFileURL(path.join(ROOT, "server", "conditions.js")).href);
  const NAMES = ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"];

  /* ------------------------------------------------------------------------------- N1 */
  {
    const why = [];
    const page = C.CONDITIONS.map((c) => `${c.number}|${c.type}|${c.urlName}`).join(" ");
    const server = S.CONDITIONS.map((c) => `${c.number}|${c.type}|${c.urlName}`).join(" ");
    if (page !== server) why.push(`the page and the server disagree:\n         page   ${page}\n         server ${server}`);
    if (C.CONDITIONS.map((c) => c.type).join(",") !== NAMES.join(",")) why.push(`names ${C.CONDITIONS.map((c) => c.type)}`);
    if (C.CONDITIONS.map((c) => c.number).join(",") !== "1,2,3,4") why.push("numbers are not 1-4 in order");
    for (const c of C.CONDITIONS) if (!/^[A-Za-z0-9_]+$/.test(c.urlName)) why.push(`${c.urlName} is not safe in an address`);
    gate("N1", "one list of four, the same on the page and the server, with the researcher's names", why);
  }

  /* ------------------------------------------------------------------------------- N2 */
  {
    const why = [];
    const rand = seeded(11);
    const counts = (a, b, c, d) => Object.fromEntries(NAMES.map((n, i) => [n, { counted: [a, b, c, d][i] }]));
    for (let i = 0; i < 2000; i++) {
      const v = [0, 1, 2, 3].map(() => Math.floor(rand() * 6));
      const pick = S.chooseFewest(counts(...v), rand);
      const fewest = Math.min(...v);
      if (v[NAMES.indexOf(pick.type)] !== fewest) { why.push(`${v} gave ${pick.type}`); break; }
    }
    const tally = Object.fromEntries(NAMES.map((n) => [n, 0]));
    for (let i = 0; i < 40000; i++) tally[S.chooseFewest(counts(5, 5, 5, 5), rand).type] += 1;
    for (const n of NAMES) if (tally[n] < 9400 || tally[n] > 10600) why.push(`a four-way tie gave ${n} ${tally[n]} of 40,000`);
    const two = { CVR_Only: 0, Baseline: 0, other: 0 };
    for (let i = 0; i < 20000; i++) {
      const t = S.chooseFewest(counts(4, 2, 3, 2), rand).type;
      if (t in two) two[t] += 1; else two.other += 1;
    }
    if (two.other) why.push(`a two-way tie went outside the tie ${two.other} times`);
    if (Math.abs(two.CVR_Only - two.Baseline) > 600) why.push(`a two-way tie was uneven: ${two.CVR_Only} / ${two.Baseline}`);
    console.log(`       a four-way tie, 40,000 draws: ${NAMES.map((n) => `${n} ${tally[n]}`).join(", ")}`);
    gate("N2", "the fewest always wins; a tie goes to each tied condition about equally", why);
  }

  /* ------------------------------------------------------------------------------- N3 */
  {
    const why = [];
    const now = Date.parse("2026-10-01T12:00:00Z");
    const ago = (min) => new Date(now - min * 60000).toISOString();
    const docs = [
      { condition_type: "CVR+APA", condition_source: "landing_page", status: "Study Completed", updated_at: ago(600) },
      { condition_type: "CVR+APA", condition_source: "landing_page", status: "Study Not Completed", updated_at: ago(60) },
      { condition_type: "CVR_Only", condition_source: "landing_page", status: "Study Not Completed", updated_at: ago(180) },
      { condition_type: "CVR_Only", condition_source: "address", status: "Study Completed", updated_at: ago(5) },
      { condition_type: "APA_Only", condition_source: "random_offline", status: "Study Not Completed", updated_at: ago(5) },
      { condition_type: "APA_Only", condition_source: "landing_page", status: "Study Not Completed", updated_at: ago(119) },
    ];
    const arrivals = [
      { condition_type: "Baseline", assigned_at: ago(10), linked_email: null, released: false },
      { condition_type: "Baseline", assigned_at: ago(40), linked_email: null, released: false },
      { condition_type: "Baseline", assigned_at: ago(5), linked_email: "x@y.z", released: false },
      { condition_type: "CVR_Only", assigned_at: ago(5), linked_email: null, released: true },
    ];
    const t = S.tally(docs, arrivals, now);
    const want = {
      "CVR+APA": { finished: 1, working: 1, arriving: 0, counted: 2 },
      CVR_Only: { finished: 0, working: 0, arriving: 0, counted: 0 },
      APA_Only: { finished: 0, working: 1, arriving: 0, counted: 1 },
      Baseline: { finished: 0, working: 0, arriving: 1, counted: 1 },
    };
    for (const n of NAMES) {
      if (JSON.stringify(t[n]) !== JSON.stringify(want[n])) why.push(`${n}: ${JSON.stringify(t[n])}, wanted ${JSON.stringify(want[n])}`);
    }
    if (S.chooseFewest(t, () => 0).type !== "CVR_Only") why.push("the next person did not go to the empty condition");
    /* The count page: all four conditions, the rule, and no email anywhere. */
    const html = S.countReportHtml({
      at: new Date(now).toISOString(), rule: "rule", counted: t, next_would_go_to: "CVR_Only",
      everyone_ever: Object.fromEntries(NAMES.map((n) => [n, { finished: 1, not_finished: 2, tests_by_address: 3, without_server: 4 }])),
    });
    for (const n of NAMES) if (!html.includes(n.replace("+", "+"))) why.push(`the count page does not show ${n}`);
    if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(html)) why.push("the count page shows an email address");
    if (!/prefers-color-scheme:dark/.test(html) || !/refresh" content="30"/.test(html)) why.push("the count page lost its dark mode or its refresh");
    gate("N3", "who counts (Q1-B): finished, working 2 h, arrived 30 min; drop-outs, tests and offline runs never", why);
  }

  /* ------------------------------------------------------------------------------- N4 */
  {
    const why = [];
    const s1 = pretendStore();
    const ids = Array.from({ length: 40 }, (_, i) => `arrival-${String(i).padStart(4, "0")}`);
    await Promise.all(ids.map((id) => S.assignCondition({ arrivalId: id, store: s1, random: seeded(3) })));
    const by = (rows) => Object.fromEntries(NAMES.map((n) => [n, rows.filter((r) => r.condition_type === n).length]));
    const first = by(s1.arrivals);
    if (NAMES.some((n) => first[n] !== 10)) why.push(`40 at once: ${JSON.stringify(first)}`);
    /* On top of an uneven start: 3 finished in CVR+APA, 1 working in Baseline, 1 old drop-out in APA_Only. */
    const fresh = new Date().toISOString();
    const docs = [
      ...Array.from({ length: 3 }, () => ({ condition_type: "CVR+APA", condition_source: "landing_page", status: "Study Completed", updated_at: fresh })),
      { condition_type: "Baseline", condition_source: "landing_page", status: "Study Not Completed", updated_at: fresh },
      { condition_type: "APA_Only", condition_source: "landing_page", status: "Study Not Completed", updated_at: "2026-01-01T00:00:00Z" },
    ];
    const s2 = pretendStore(docs);
    await Promise.all(ids.map((id) => S.assignCondition({ arrivalId: id, store: s2, random: seeded(5) })));
    const second = by(s2.arrivals);
    const totals = { "CVR+APA": second["CVR+APA"] + 3, CVR_Only: second.CVR_Only, APA_Only: second.APA_Only, Baseline: second.Baseline + 1 };
    if (NAMES.some((n) => totals[n] !== 11)) why.push(`44 counted after an uneven start: ${JSON.stringify(totals)}`);
    console.log(`       40 at once: ${JSON.stringify(first)}; after an uneven start (3/0/0/1): ${JSON.stringify(totals)}`);
    gate("N4", "one at a time: 40 arrivals at once end up 10 each, and an uneven start evens out", why);
  }

  /* ------------------------------------------------------------------------------- N5 */
  {
    const why = [];
    const s = pretendStore();
    const a = await S.assignCondition({ arrivalId: "repeat-arrival-1", store: s });
    const b = await S.assignCondition({ arrivalId: "repeat-arrival-1", store: s });
    if (a.type !== b.type || a.assignedAt !== b.assignedAt) why.push("the same arrival got a different answer");
    if (s.arrivals.length !== 1) why.push(`the same arrival was stored ${s.arrivals.length} times`);
    for (const good of ["5f3a1b2c-1234-4cde-9abc-0123456789ab", "a1b2c3d4"]) if (!S.ARRIVAL_ID.test(good)) why.push(`${good} refused`);
    for (const bad of ["", "short", "has space here!", "x".repeat(65), "$where", "a.b.c.d.e.f"]) if (S.ARRIVAL_ID.test(bad)) why.push(`"${bad}" accepted`);
    gate("N5", "the same arrival twice: the same condition, stored once; a bad arrival id is refused", why);
  }

  /* ------------------------------------------------------------------------------- N6 */
  {
    const why = [];
    const ok = S.conditionFieldsFrom({ condition: { number: 3, type: "APA_Only", source: "landing_page", assignedAt: "2026-10-01T10:00:00Z" } });
    if (!ok || ok.condition_number !== 3 || ok.condition_type !== "APA_Only" || ok.condition_source !== "landing_page") why.push(`a valid condition read as ${JSON.stringify(ok)}`);
    for (const [label, body] of [
      ["number and name disagree", { condition: { number: 1, type: "Baseline", source: "landing_page" } }],
      ["an unknown source", { condition: { number: 4, type: "Baseline", source: "chosen" } }],
      ["a fifth condition", { condition: { number: 5, type: "Extra", source: "landing_page" } }],
      ["no condition", {}],
    ]) if (S.conditionFieldsFrom(body) !== null) why.push(`${label} was accepted`);
    const server = src("server/index.js");
    if (!/updateOne\(\{ email, condition_type: \{ \$exists: false \} \}, \{ \$set: condition \}\)/.test(server)) why.push("the participant route does not set the condition only on a record without one");
    if (!/arrival_id: arrivalId, linked_email: null \},\s*\{ \$set: \{ linked_email: email/.test(server)) why.push("the participant route does not link the arrival");
    for (const route of ["/api/conditions/assign", "/api/conditions/release", "/api/conditions/counts", "/api/conditions/report"]) {
      if (!server.includes(`"${route}"`)) why.push(`no route ${route}`);
    }
    if (!/assignCondition\(\{\s*arrivalId,[\s\S]{0,80}store: mongoStore\(participants\(\), conditionArrivals\(\)\)/.test(server)) why.push("the assign route does not use the shared rule");
    if (!/arrival_id: 1 \}, name: "arrival_id_unique", unique: true/.test(src("server/db.js"))) why.push("no unique index on arrival_id");
    gate("N6", "the record: the condition is set once, checked, and the arrival is linked; the routes exist", why);
  }

  /* ------------------------------------------------------------------------------- N7 */
  {
    const why = [];
    const read = (q) => C.conditionFromAddress(q)?.type ?? null;
    const cases = [
      ["?condition=CVR_APA", "CVR+APA"], ["?condition=cvr_apa", "CVR+APA"], ["?condition=CVR+APA", "CVR+APA"],
      ["?condition=CVR%2BAPA", "CVR+APA"], ["?condition=1", "CVR+APA"], ["?condition=CVR_Only", "CVR_Only"],
      ["?condition=cvr-only", "CVR_Only"], ["?condition=APA_Only", "APA_Only"], ["?condition=3", "APA_Only"],
      ["?condition=Baseline", "Baseline"], ["?condition=BASELINE&PROLIFIC_PID=abc", "Baseline"],
      ["?condition=", null], ["?condition=CVR", null], ["?condition=5", null], ["?condition=APA", null], ["", null],
      ["?other=Baseline", null],
    ];
    for (const [q, want] of cases) if (read(q) !== want) why.push(`${q || "(no query)"} read as ${read(q)}, wanted ${want}`);
    const next = C.addressFor(C.CONDITIONS[2], "https://study.example/?PROLIFIC_PID=5f3a&STUDY_ID=9#top");
    const url = new URL(next);
    if (url.searchParams.get("condition") !== "APA_Only" || url.searchParams.get("PROLIFIC_PID") !== "5f3a" || url.searchParams.get("STUDY_ID") !== "9") why.push(`the address became ${next}`);
    const over = new URL(C.addressFor(C.CONDITIONS[0], "https://study.example/?condition=Baseline"));
    if (over.searchParams.getAll("condition").join(",") !== "CVR_APA") why.push("an address naming another condition was not corrected");
    if (C.savedConditionOf({ number: 2, type: "Baseline", source: "landing_page" }) !== null) why.push("a saved condition whose number and name disagree was accepted");
    gate("N7", "the address: every spelling read, anything else not; the rest of the address kept", why);
  }

  /* ------------------------------------------------------------------------------- N8 */
  {
    const why = [];
    store = {};
    const file = C.makeConditionFile(C.CONDITIONS[1], "landing_page", "arrival-abcdef12", "Sara@Example.com", "2026-10-01T09:00:00.000Z");
    C.writeConditionFile(file);
    const back = C.readConditionFile();
    if (JSON.stringify(back) !== JSON.stringify({ ...file, owner: "sara@example.com" })) why.push(`the file came back as ${JSON.stringify(back)}`);
    if (C.currentCondition()?.type !== "CVR_Only") why.push("currentCondition did not read the file");
    store[C.CONDITION_KEY] = JSON.stringify({ ...file, version: 99 });
    if (C.readConditionFile() !== null) why.push("a file of another version was read");
    const fields = C.conditionFields(file);
    if (fields?.conditionNumber !== 2 || fields?.conditionType !== "CVR_Only") why.push(`the two fields read ${JSON.stringify(fields)}`);
    /* The directory keeps the first condition. */
    store = {};
    const base = { email: "ana@example.com", sessionId: "s1", age: 30, gender: "Female", stage: "money", consent: null };
    dir.upsertParticipant({ ...base, condition: { number: 2, type: "CVR_Only", source: "landing_page", assignedAt: "t1", arrivalId: "arrival-11111111" } });
    dir.upsertParticipant({ ...base, condition: { number: 4, type: "Baseline", source: "address", assignedAt: "t2" } });
    dir.upsertParticipant({ ...base });
    const kept = dir.lookupByEmail("ana@example.com")?.condition;
    if (kept?.type !== "CVR_Only") why.push(`the directory did not keep the first condition: ${JSON.stringify(kept)}`);
    if (kept && "arrivalId" in kept) why.push("the directory stored the arrival id");
    /* No server: the landing page gets no answer, at once. */
    storage.noRemoteBackend();
    const t0 = Date.now();
    const none = await storage.requestCondition("arrival-offline-1");
    if (none !== null) why.push("with no server the landing page still got an answer");
    if (Date.now() - t0 > 500) why.push("with no server the landing page waited");
    /* With a server: the answer, and the save that sends the arrival id once. */
    const upserts = [];
    storage.setRemoteBackend({
      findParticipant: async () => null,
      upsertParticipant: async (e) => { upserts.push(JSON.parse(JSON.stringify(e))); },
      updateStage: async () => {}, markCompleted: async () => {}, saveSection: async () => {},
      getResumeFiles: async () => null, claimBrowser: async () => {}, isActiveBrowser: async () => true,
      assignCondition: async (id) => ({ number: 3, type: "APA_Only", arrivalId: id, assignedAt: "2026-10-01T10:00:00Z" }),
      releaseArrival: async () => {},
    });
    const given = await storage.requestCondition("arrival-online-1");
    if (given?.type !== "APA_Only") why.push(`with a server the landing page got ${JSON.stringify(given)}`);
    store = {};
    storage.saveParticipant({ ...base, email: "lee@example.com", condition: { number: 3, type: "APA_Only", source: "landing_page", assignedAt: "t", arrivalId: "arrival-22222222" } });
    await wait(30);
    const sentCondition = upserts.at(-1)?.condition;
    if (sentCondition?.arrivalId !== "arrival-22222222" || sentCondition?.type !== "APA_Only") why.push(`the save sent ${JSON.stringify(sentCondition)}`);
    if ("arrivalId" in (dir.lookupByEmail("lee@example.com")?.condition ?? {})) why.push("the save stored the arrival id");
    /* A later save with another condition still sends the FIRST one. */
    storage.saveParticipant({ ...base, email: "lee@example.com", condition: { number: 1, type: "CVR+APA", source: "address", assignedAt: "t" } });
    await wait(30);
    if (upserts.at(-1)?.condition?.type !== "APA_Only") why.push("a later save sent a different condition");
    storage.setRemoteBackend(null);
    gate("N8", "the browser: the file, the first condition kept, the arrival id sent once, no server no answer", why);
  }

  /* ------------------------------------------------------------------------------- N9 */
  {
    const why = [];
    const flow = src("src/experiment/ExperimentFlow.tsx");
    const landing = src("src/experiment/LandingPage.tsx");
    const need = (text, re, what) => { if (!re.test(text)) why.push(what); };
    need(flow, /if \(!readConditionFile\(\)\) return "landing";/, "a browser without a condition does not start at the landing page");
    need(flow, /ENTRY_STAGES\.includes\(saved\) && !readConditionFile\(\)\) return "landing"/, "an entry screen without a condition does not go to the landing page");
    need(flow, /if \(stage === "landing"\) return;/, "the landing page is saved as a stage");
    need(flow, /if \(stage === "landing"\) \{\s*return <LandingPage onReady=\{handleLandingReady\} \/>;/, "the landing page is not rendered");
    if (flow.indexOf('if (stage === "landing")') > flow.indexOf('if (stage === "start")')) why.push("the landing page comes after the start screen");
    need(flow, /JSON\.stringify\(\{ \.\.\.record, \.\.\.\(conditionFields\(condition\) \?\? \{\}\) \}\)/, "the two fields are not saved beside the demographic answers");
    if ((flow.match(/condition: savedFrom\(condition\),/g) ?? []).length !== 2) why.push("the two saves do not both carry the condition");
    need(flow, /if \(provisional\?\.arrivalId && provisional\.owner !== owner\) releaseConditionArrival\(provisional\.arrivalId\);/, "a returning participant does not release the new arrival");
    need(flow, /condition = makeConditionFile\(saved, entry\.condition\.source, null, owner, entry\.condition\.assignedAt\);/, "a returning participant does not keep their saved condition");
    need(flow, /showConditionInAddress\(readConditionFile\(\)\);\s*\}, \[stage\]\);/, "the address does not follow the saved condition");
    need(flow, /file\.owner && file\.owner !== email\.trim\(\)\.toLowerCase\(\)[\s\S]{0,400}clearConditionFromAddress\(\);[\s\S]{0,120}setStage\("landing"\)/, "a second person on the same computer does not get their own condition (the address must be cleared first)");
    need(flow, /stage === "start" \|\| stage === "landing" \? "" : stage/, "the landing page counts as working time");
    need(flow, /noRemoteBackend\(\);/, "the flow never says there is no server");
    need(landing, /const fromAddress = conditionFromAddress\(window\.location\.search\);\s*if \(fromAddress\) return makeConditionFile\(fromAddress, "address"/, "the landing page does not take a condition from the address first");
    need(landing, /localStorage\.setItem\(CONDITION_ARRIVAL_KEY, made\);\s*return made;/, "the arrival id is not saved before the request");
    need(landing, /makeConditionFile\(randomCondition\(\), "random_offline"/, "no random fallback without a server");
    if (/\{[^}]*\.(type|urlName)\}/.test(landing.split("return (")[1] ?? "")) why.push("the landing page shows the condition's name");
    const resumeFiles = db.RESUME_FILES ?? [];
    if (resumeFiles.includes(C.CONDITION_KEY)) why.push("the condition file travels in resume_state (a new browser could merge over it)");
    if (/KEEP_KEYS = new Set<string>\(\[[^\]]*vrds_condition/.test(src("src/components/dev/DevResetButton.tsx"))) why.push("the development reset keeps the condition file");
    gate("N9", "the flow: landing first, never saved; the two fields; both saves; a return keeps its own", why);
  }

  /* ------------------------------------------------------------------------------ N10 */
  {
    const why = [];
    const copy = db.conditionCopy(C.makeConditionFile(C.CONDITIONS[3], "landing_page", "arrival-33333333", "a@b.c", "2026-10-01T11:00:00.000Z"));
    const want = { condition_number: 4, condition_type: "Baseline", source: "landing_page", counted_for_balance: true, assigned_at: "2026-10-01T11:00:00.000Z" };
    if (JSON.stringify(copy) !== JSON.stringify(want)) why.push(`the copy is ${JSON.stringify(copy)}`);
    if (db.conditionCopy(C.makeConditionFile(C.CONDITIONS[0], "address", null, ""))?.counted_for_balance !== false) why.push("a test by address is counted for balance");
    if (db.conditionCopy(null) !== null || db.conditionCopy({ number: 2, type: "Baseline" }) !== null) why.push("a missing or wrong file gave a copy");
    /* Through the real builder (the smallest Block 5 record it accepts, as validate_attention T4 uses). */
    const block5 = { scenarioResults: [], originalProfile: { dimensions: [] } };
    {
      const file = C.makeConditionFile(C.CONDITIONS[1], "landing_page", "arrival-44444444", "a@b.c", "2026-10-01T08:00:00.000Z");
      const major = db.buildMajorScores(block5, null, null, null, null, null, null, file);
      if (JSON.stringify(major?.condition) !== JSON.stringify(db.conditionCopy(file))) why.push(`major_info_and_scores.condition is ${JSON.stringify(major?.condition)}`);
      if (!major?.where_each_number_lives?.condition) why.push("where_each_number_lives does not name the condition");
      const without = db.buildMajorScores(block5, null, null, null, null, null, null);
      if (without?.condition !== null) why.push("an older caller without the file did not get null");
    }
    if (db.SHAPE_VERSION !== "2026-10-01-conditions") why.push(`SHAPE_VERSION is ${db.SHAPE_VERSION}`);
    gate("N10", "major_info_and_scores.condition: a copy of the file, counted only from the landing page", why);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(failed.length ? `${failed.length} CONDITION GATE(S) FAILED: ${failed.map((r) => r.id).join(", ")}` : "ALL CONDITION GATES PASSED");
  process.exit(failed.length ? 1 : 0);
})();
