/*
 * validate_session.cjs — the guard on "continue where you left off" and "one place at a time"
 * (29 September 2026, the researcher's plan answers "Q1-yes, Q2-yes, Q3-yes, Q5-yes").
 *
 * WHY IT EXISTS. Block 5 started again at scenario 1 on every page load and saved no progress; Block 2 saved
 * none either; Blocks 2, 3 and 5 reached the server only when each block ended; and nothing stopped two
 * browsers, or two tabs, writing one participant's record. And a save that failed because the server could
 * not be reached was never queued (sendOrQueue tested `!ok` on a word that is never false).
 *
 * IT RUNS THE REAL CODE: storage.ts, sessionGuard.ts and block5Progress.ts compiled by
 * tools/tsconfig.dbshape.json, and server/activeBrowser.js as it is. The browser is faked around them: a Map
 * for localStorage, a pretend server whose answers each gate sets, and a window that hands its event
 * listeners back.
 *
 *   C1  the server's rule: no id -> allow, nobody holds it -> claim, this browser -> allow, another -> refuse
 *   C2  the server source: every write route asks the rule first; the claim needs the matching age; the
 *       "am I active?" route exists
 *   C3  Block 5 progress saved after a scenario comes back exactly, and the next scenario's cards, labels and
 *       fit numbers from it equal those from the values that were saved
 *   C4  and it is refused for another email, for changed Blocks 1-4 values, for a finished block, for junk
 *   C5  a save the server could not take waits in the queue and is sent, in order, when the server is back;
 *       a new save never overtakes a waiting one
 *   C6  "another browser holds this record" (409) locks the page, sets the queue aside, parks nothing and
 *       sends nothing more; claiming this browser also sets the old queue aside
 *   C7  the tab rule: a newer claim from another tab locks this one, our own claim does not; a browser lock
 *       outranks a tab lock; waiting progress is sent at once when the tab is hidden
 *   C8  the pages, read from the source: Block 5 no longer deletes its progress on opening, saves and sends it
 *       after every scenario and marks a restarted scenario; Blocks 2 and 3 save with an owner and restore
 *       only for it; the flow claims the browser before it writes or downloads anything, shows the lock
 *       screen before any page, and asks "am I still active?" on opening and after every page
 *   C11 (since 4 October 2026) "Is English your first language?": asked on the demographic page as Yes / No, required,
 *       with no default; saved as true / false beside age, gender and country - in the browser's directory, the
 *       demographic file, the API client and the server - and, like the country, never erased by a resume that does
 *       not know it; the country is asked as "Where are you from?"
 *   C12 (since 6 October 2026, "multiple sessions safe") the server check: once in development, on the live site again
 *       after 1, 2 and 4 seconds and then every 15 seconds; a server that answers LATE gets the participant's record
 *       first (nothing is sent before it lands; if it cannot be sent it waits first in the queue), then the blocks,
 *       then the completion of a finished run; another browser's record locks the page; saves wait 10 s, the check 5 s
 *   C13 (since 6 October 2026, the two doors; the researcher's "1-A, 2-A, 4-A") the door an address opens (/prolific or
 *       a Prolific ID in the link); a Prolific ID is never an email and the page and the server agree on every key; the
 *       API client sends it as prolificPid and the server stores it as prolific_pid with the door and Prolific's two
 *       ids; every queued save goes to the owner it was made for; a different Prolific ID in the link sets the other
 *       person's run aside and keeps the machine's files; the Prolific first page (the same welcome, the ID, no email,
 *       no question on a return); "A little about you" with four questions; the two database rules, swapped safely;
 *       and (the audit of 6 October 2026) a resumed person keeps their door, the first page uses the ID the browser
 *       knows, and an unowned condition from the other door is dropped either way
 *   C14 (the audit of 6 October 2026; the researcher's "4-Yes") "Not you?" on the university door: shown only when the
 *       page opens with a university run, the email partly hidden, gone once the person moves on, a confirmation first,
 *       then the run set aside (the machine's files kept) and the university door opened afresh
 *   C15 (the audit's F2, 6 October 2026; the researcher's "1-B, 2 - no limits") privacy: the lookup answers only the status,
 *       the create/update route only "ok"; the claim checks the age (both doors) before it hands back the person's
 *       details and run; no write without a browser id; no cross-site access; the start screens never compare the age
 *       themselves; signing in sets aside only that person's old saves
 *   C16 (Step 4, since 7 October 2026; the researcher's "1-A, 2-A, 3-A") the Prolific completion code: the server gives it
 *       only for a finished Prolific record to the browser holding it, from .env only, never storing it; no code and no
 *       Prolific completion address anywhere in the page's code; the page keeps the code it was given for its owner and
 *       asks again while the completion is on its way; a button, never an automatic jump; the final page shows it only in
 *       the Prolific door; a finished person on another device gets it after the age check; the results page's Prolific
 *       sentence; "confidential" on the feedback page; the deploy files pass the code on without printing it
 *
 * Run:  npm run validate:session
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".sim-build");
try {
  execFileSync("npx", ["tsc", "-p", "tools/tsconfig.dbshape.json"], { cwd: ROOT, encoding: "utf8", shell: true });
} catch { /* errors in files this tool does not use are not its business; the artifacts are checked below */ }
for (const f of ["storage.js", "sessionGuard.js", "block5Progress.js", "block5CVR.js"]) {
  if (!fs.existsSync(path.join(BUILD, f))) { console.error(`  .sim-build/${f} was not produced.`); process.exit(1); }
}
fs.writeFileSync(path.join(BUILD, "package.json"), JSON.stringify({ type: "commonjs" }));

/* ------------------------------------------------------------------ a pretend browser */
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
};
const windowListeners = {};
global.window = { addEventListener: (type, fn) => { (windowListeners[type] ??= []).push(fn); } };
const docListeners = {};
global.document = { visibilityState: "visible", addEventListener: (type, fn) => { (docListeners[type] ??= []).push(fn); } };

const B = (f) => require(path.join(BUILD, f));
const storage = B("storage.js");
const guard = B("sessionGuard.js");
const progress = B("block5Progress.js");
const { labelOptions } = B("block5CVR.js");
const { BLOCK5_SCENARIOS } = B("block5Scenarios.js");

let fails = 0;
const gate = (id, ok, msg) => { console.log(`  ${ok ? "  ok  " : " FAIL "} ${id.padEnd(3)} ${msg}`); if (!ok) fails += 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

(async () => {
  console.log("");
  console.log("==============================================================================");
  console.log("  CONTINUE WHERE YOU LEFT OFF, AND ONE PLACE AT A TIME");
  console.log("==============================================================================");

  /* C1 */
  {
    const { browserVerdict, requestBrowser } = await import(path.join(ROOT, "server", "activeBrowser.js").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "file:///$1:"));
    /* Since the audit of 6 October 2026 (F2) a request without the browser's id is REFUSED: every study page has sent it
       since 29 September 2026, and "allow" let any script write any record it could name. */
    const ok = browserVerdict("a", null) === "refuse" && browserVerdict(null, null) === "refuse" && browserVerdict(null, "a") === "claim"
      && browserVerdict("a", "a") === "allow" && browserVerdict("a", "b") === "refuse"
      && requestBrowser({ headers: { "x-vrds-browser": " b1 " } }) === "b1"
      && requestBrowser({ headers: {} }) === null && requestBrowser({ headers: { "x-vrds-browser": "x".repeat(200) } }) === null;
    gate("C1", ok, "the server's rule: no id refuse, nobody holds it claim, this browser allow, another browser refuse");
  }

  /* C2 */
  {
    const s = src("server/index.js");
    const why = [];
    const routeBody = (marker) => { const i = s.indexOf(marker); const j = s.indexOf("\n);", i); return i < 0 ? "" : s.slice(i, j); };
    /* Since 6 October 2026 the routes take the participant's key (an email or a Prolific ID; server/recruitment.js). */
    for (const [name, marker] of [["create/update", 'app.post(\n  "/api/participants",'], ["stage", '"/api/participants/:key/stage"'],
      ["complete", '"/api/participants/:key/complete"'], ["section", '"/api/participants/:key/section"']]) {
      if (!routeBody(marker).includes("guardBrowser(req, res, key)")) why.push(`the ${name} route does not ask the rule`);
    }
    const claim = routeBody('"/api/participants/:key/claim"');
    if (!claim || !/Number\(doc\.age\) !== Number\(req\.body\?\.age\)/.test(claim)) why.push("the claim does not check the age");
    if (!routeBody('"/api/participants/:key/active"')) why.push("there is no \"am I active?\" route");
    if (!/\$setOnInsert[\s\S]{0,400}active_browser/.test(s)) why.push("a brand-new participant is not given to the browser that created them");
    gate("C2", why.length === 0, why.length ? why.join(" | ") : "every write route asks the rule first, the claim needs the matching age, the \"am I active?\" route exists");
  }

  /* C3, C4 */
  {
    const dims = ["vulnerabilityProtectionSensitivity", "groupSizeSensitivity", "gainResponsivenessSensitivity",
      "outcomeAggregationSensitivity", "directnessSensitivity", "contextSensitivity", "stakeholderPerspectiveShiftSensitivity"];
    const profileOf = (scores) => ({ generatedAt: "", topThreeKeys: [], topSensitivityKey: dims[0],
      dimensions: dims.map((k, i) => ({ key: k, label: k, score: scores[i], rank: i + 1, weight: 0.1, sourceBlocks: [] })) });
    const broughtIn = profileOf([82.5, 61, 40, 55, 30, 70, 50]);
    const after2 = profileOf([92.5, 46, 40, 55, 30, 70, 75]);
    const results = [{ scenarioId: BLOCK5_SCENARIOS[0].id, selectedOptionId: "x" }, { scenarioId: BLOCK5_SCENARIOS[1].id, selectedOptionId: "y" }];
    progress.saveBlock5Progress({ owner: "Sara@Example.com ", broughtIn, nextScenarioIndex: 2, scenarioResults: results, profile: after2, runningProfile: after2 });
    const back = progress.readBlock5Progress("sara@example.com", broughtIn, BLOCK5_SCENARIOS.length);
    const same = back && back.nextScenarioIndex === 2 && JSON.stringify(back.scenarioResults) === JSON.stringify(results)
      && JSON.stringify(back.profile) === JSON.stringify(after2) && JSON.stringify(back.runningProfile) === JSON.stringify(after2);
    const next = BLOCK5_SCENARIOS[2];
    const labelsSaved = JSON.stringify(labelOptions(next.options, after2).map((o) => [o.id, o.level, o.matchScore]));
    const labelsBack = back ? JSON.stringify(labelOptions(next.options, back.profile).map((o) => [o.id, o.level, o.matchScore])) : "";
    gate("C3", !!same && labelsSaved === labelsBack,
      `saved after scenario 2, it comes back exactly (scenario 3 next, same email in any capitals), and scenario 3's cards read the same labels and fit numbers (${labelsBack.length > 2 ? "6 options" : "none"})`);

    const why = [];
    if (progress.readBlock5Progress("someone.else@example.com", broughtIn, 6)) why.push("another email continued the run");
    if (progress.readBlock5Progress("sara@example.com", profileOf([82.5, 61, 40, 55, 30, 70, 51]), 6)) why.push("changed Blocks 1-4 values continued the run");
    progress.saveBlock5Progress({ owner: "sara@example.com", broughtIn, nextScenarioIndex: 6, scenarioResults: new Array(6).fill({}), profile: after2 });
    if (progress.readBlock5Progress("sara@example.com", broughtIn, 6)) why.push("a finished block was continued");
    progress.saveBlock5Progress({ owner: "sara@example.com", broughtIn, nextScenarioIndex: 3, scenarioResults: results, profile: after2 });
    if (progress.readBlock5Progress("sara@example.com", broughtIn, 6)) why.push("three scenarios promised, two saved, and it was continued");
    localStorage.setItem("block5_public_emergency_progress", "{not json");
    if (progress.readBlock5Progress("sara@example.com", broughtIn, 6) !== null) why.push("junk was read");
    progress.clearBlock5Progress();
    gate("C4", why.length === 0, why.length ? why.join(" | ") : "refused for another email, for changed Blocks 1-4 values, for a finished block, for a count that does not add up, and for junk");
  }

  /* C5, C6: a pretend server */
  const sent = [];
  const server = { mode: "up" };
  /* A real server takes a moment to answer (or to time out), which is what lets two retries overlap. */
  const answer = async (what) => {
    await wait(15);
    if (server.mode === "down") throw Object.assign(new Error("unreachable"), {});
    if (server.mode === "another") throw Object.assign(new Error("409"), { httpStatus: 409, code: "another_browser_active" });
    sent.push(what);
  };
  storage.setRemoteBackend({
    findParticipant: async () => null,
    upsertParticipant: async (e) => answer(`upsert ${e.email}`),
    updateStage: async (_e, stage) => answer(`stage ${stage}`),
    markCompleted: async () => answer("completed"),
    saveSection: async (p) => answer(`section ${p}`),
    signIn: async (key) => {
      sent.push("claim");
      return { participant: { email: key, sessionId: "s", age: 34, gender: "Female", stage: "feedback", consent: null, status: "Study Not Completed", createdAt: "", updatedAt: "", completedAt: null }, files: null };
    },
    isActiveBrowser: async () => server.mode !== "another",
  });
  await wait(20);
  {
    const why = [];
    sent.length = 0;
    server.mode = "down";
    storage.saveProgress("sara@example.com", "block5");
    await wait(60);
    if (storage.pendingWriteCount() !== 1) why.push(`a failed save was not queued (${storage.pendingWriteCount()} waiting)`);
    storage.saveCompletion("sara@example.com");
    await wait(60);
    if (storage.pendingWriteCount() !== 2) why.push("the second save did not wait behind the first");
    server.mode = "up";
    await storage.flushOutbox();
    if (storage.pendingWriteCount() !== 0) why.push("the queue did not drain when the server came back");
    if (sent.join(" | ") !== "stage block5 | completed") why.push(`not sent in order: ${sent.join(" | ")}`);
    /* Several saves in a row while the server is down: each starts a flush, and none may erase another. */
    sent.length = 0;
    server.mode = "down";
    storage.saveProgress("sara@example.com", "s1");
    storage.saveProgress("sara@example.com", "s2");
    storage.saveProgress("sara@example.com", "s3");
    await wait(25);
    storage.saveProgress("sara@example.com", "s4");
    await wait(120);
    if (storage.pendingWriteCount() !== 4) why.push(`saves made while the server was down were lost (${storage.pendingWriteCount()} of 4 waiting)`);
    /* The server comes back, and two new saves arrive at once while the four are being sent: each asks for a
       flush, and only one may run, or two would send the same save twice and drop another. */
    server.mode = "up";
    storage.saveProgress("sara@example.com", "s5");
    storage.saveProgress("sara@example.com", "s6");
    await wait(400);
    if (storage.pendingWriteCount() !== 0) why.push(`${storage.pendingWriteCount()} saves still waiting`);
    if (sent.join(" | ") !== "stage s1 | stage s2 | stage s3 | stage s4 | stage s5 | stage s6") why.push(`not each sent once, in order: ${sent.join(" | ")}`);
    gate("C5", why.length === 0, why.length ? why.join(" | ") : "a save the server could not take waits and is sent when it is back, in order (stage, then completed); four saves in a row while it is down all wait, and with two more arriving as they go out, all six are sent once each, in order");
  }
  {
    const why = [];
    let locks = 0;
    const stop = guard.onLockChange((r) => { if (r === "browser") locks += 1; });
    sent.length = 0;
    server.mode = "down";
    storage.saveProgress("sara@example.com", "block5_summary");
    await wait(60);
    server.mode = "another";
    await storage.flushOutbox();
    if (guard.getLock() !== "browser" || locks !== 1) why.push("the page did not lock");
    if (storage.pendingWriteCount() !== 0) why.push("the queue was not set aside");
    if (!localStorage.getItem("vrds_outbox_locked_out")) why.push("the set-aside writes were not kept in this browser");
    if (localStorage.getItem("vrds_outbox_refused")) why.push("a lock was parked as a refused write");
    if (sent.length) why.push("something was sent after the lock");
    stop();
    guard.setLock(null);
    server.mode = "down";
    storage.saveProgress("sara@example.com", "feedback");
    await wait(60);
    server.mode = "up";
    /* Signing in (since the audit of 6 October 2026: the server checks the age) sets this person's old queue aside first. */
    const claimed = await storage.signIn("sara@example.com", 34);
    if (!claimed.ok || storage.pendingWriteCount() !== 0 || !sent.includes("claim")) why.push("signing in did not set the old queue aside before taking the record");
    gate("C6", why.length === 0, why.length ? why.join(" | ") : "\"another browser holds this record\" locks the page, sets the queue aside (kept, never sent), parks nothing; claiming this browser sets an old queue aside first");
  }

  /* C7 */
  {
    const why = [];
    guard.setLock(null);
    guard.watchTabs();
    guard.claimTab();
    const mine = localStorage.getItem(guard.TAB_KEY);
    for (const fn of windowListeners.storage ?? []) fn({ key: guard.TAB_KEY, newValue: mine });
    if (guard.getLock() !== null) why.push("our own claim locked us");
    for (const fn of windowListeners.storage ?? []) fn({ key: guard.TAB_KEY, newValue: JSON.stringify({ id: "t-other", at: Date.now() }) });
    if (guard.getLock() !== "tab") why.push("a newer tab did not lock this one");
    guard.setLock("browser");
    guard.setLock("tab");
    if (guard.getLock() !== "browser") why.push("a tab lock replaced a browser lock");
    guard.setLock(null);
    let sends = 0;
    guard.setProgressSender(() => { sends += 1; });
    guard.progressSaved(); guard.progressSaved(); guard.progressSaved();
    if (sends !== 0) why.push("gathered progress was sent at once");
    document.visibilityState = "hidden";
    for (const fn of docListeners.visibilitychange ?? []) fn();
    if (sends !== 1) why.push(`hiding the tab sent ${sends} times, not once`);
    guard.progressSaved(true);
    if (sends !== 2) why.push("Block 5's send-now did not send at once");
    guard.setLock("browser");
    guard.progressSaved(true);
    if (sends !== 2) why.push("a locked page still sent its progress");
    guard.setLock(null);
    guard.setProgressSender(null);
    gate("C7", why.length === 0, why.length ? why.join(" | ") : "a newer tab locks this one, our own claim does not; a browser lock outranks a tab lock; progress is gathered, sent once when the tab is hidden, at once for Block 5, never from a locked page");
  }

  /* C8 */
  {
    const why = [];
    const b5 = src("src/experiment/Block5PublicEmergencySimulation.tsx");
    const b2 = src("src/experiment/TrolleyThresholdBlock.tsx");
    const b3 = src("src/experiment/AIWorkforceThresholdBlock.tsx");
    const flow = src("src/experiment/ExperimentFlow.tsx");
    if (/removeItem\(BLOCK5_PROGRESS_KEY\)/.test(b5) || b5.includes("always start fresh at Scenario 1 on mount")) why.push("Block 5 still deletes its progress on opening");
    if (!b5.includes("readBlock5Progress(owner, userProfile, BLOCK5_SCENARIOS.length)")) why.push("Block 5 does not read its progress");
    if (!/saveBlock5Progress\(\{[\s\S]{0,200}\}\);\s*progressSaved\(true\);/.test(b5)) why.push("Block 5 does not save and send after every scenario");
    if (!b5.includes("result.restartedAfterLeaving = true")) why.push("a restarted scenario is not marked");
    if (!b2.includes("readTrolleyProgress(owner)") || !b2.includes("owner: progressOwner(owner)") || !b2.includes("localStorage.removeItem(TROLLEY_PROGRESS_STORAGE_KEY)")) why.push("Block 2 does not save, restore and clear its progress with an owner");
    if (!b3.includes("savedOwner === progressOwner(owner)") || !b3.includes("owner: progressOwner(owner)")) why.push("Block 3 does not save and restore its progress with an owner");
    if (!b2.includes("progressSaved();") || !b3.includes("progressSaved();")) why.push("Blocks 2 and 3 do not send their progress");
    /* The resume step, shared by both doors' first pages since 6 October 2026. */
    const resume = flow.slice(flow.indexOf("const onResume = (entry: DirectoryEntry, restored: number) =>"), flow.indexOf("if (stage === \"consent\")"));
    /* Since the audit of 6 October 2026 (F2) the claim AND the download happen in signIn, on both start screens, after the
       server checked the age and before onResume writes anything; onResume itself neither claims nor downloads. */
    for (const [file, label] of [["src/experiment/StartScreen.tsx", "the university"], ["src/experiment/ProlificStartScreen.tsx", "the Prolific"]]) {
      const page = src(file);
      const iSign = page.indexOf("await signIn("), iResume = page.indexOf("onResume(result.entry, result.restored)");
      if (!(iSign > 0 && iSign < iResume)) why.push(`${label} start screen does not sign in (age checked by the server) before it resumes`);
    }
    if (!resume || /claimThisBrowser|restoreParticipantFiles|getResumeFiles/.test(resume) || !resume.includes("saveParticipant(")) why.push("the resume step still claims or downloads by itself");
    if (!resume.includes("localStorage.setItem(SESSION_ID_KEY, entry.sessionId)")) why.push("a new device does not take the participant's own id (scenario 6's rule order depends on it)");
    const iLock = flow.indexOf("if (lock) {"), iStart = flow.indexOf("if (stage === \"start\") {");
    if (!(iLock > 0 && iLock < iStart) || !flow.includes("<SessionLockScreen")) why.push("the lock screen is not shown before any page");
    if ((flow.match(/checkActiveBrowser\(/g) ?? []).length < 3) why.push("\"am I still active?\" is not asked on opening, after every page and with the progress");
    if (!flow.includes("claimTab();") || !flow.includes("watchTabs();")) why.push("the tab does not claim the study");
    for (const b of ["owner={pendingEmail}"]) if ((flow.match(new RegExp(b.replace(/[{}]/g, "\\$&"), "g")) ?? []).length !== 3) why.push("Blocks 2, 3 and 5 are not told whose progress it is");
    gate("C8", why.length === 0, why.length ? why.join(" | ") : "Block 5 reads, saves and sends its progress and marks a restarted scenario; Blocks 2 and 3 save with an owner; the claim comes before any write or download; the lock screen comes before any page");
  }

  /* C9 — THE COUNTRY (30 September 2026, the researcher's request): a list to type into, best matches first, and the
     answer saved wherever age and gender are, never erased by a resume that does not know it. */
  {
    const why = [];
    const C = B("countries.js");
    const codes = C.COUNTRIES.map((c) => c.code), names = C.COUNTRIES.map((c) => C.foldText(c.name));
    if (new Set(codes).size !== codes.length || codes.some((c) => !/^[A-Z]{2}$/.test(c))) why.push("a country code is repeated or malformed");
    if (new Set(names).size !== names.length) why.push("a country name is repeated");
    for (const gone of ["AQ", "BV", "HM", "GS", "UM", "IO", "TF"]) if (codes.includes(gone)) why.push(`an uninhabited place is listed (${gone})`);
    for (const must of ["SA", "US", "GB", "IN", "CN", "EG", "AE", "PS", "XK", "TW"]) if (!codes.includes(must)) why.push(`${must} is missing`);
    const names_ = (q) => C.matchCountries(q).map((m) => m.country.name);
    /* "Sa": every name starting with Sa first, alphabetically, then names with a word starting with Sa. */
    const sa = C.matchCountries("Sa");
    const firstNotPrefix = sa.findIndex((m) => !C.foldText(m.country.name).startsWith("sa"));
    const prefix = sa.slice(0, firstNotPrefix).map((m) => m.country.name);
    if (!prefix.includes("Saudi Arabia") || prefix.length !== C.COUNTRIES.filter((c) => C.foldText(c.name).startsWith("sa")).length) why.push(`"Sa" does not list every name starting with Sa first: ${prefix.join(", ")}`);
    if ([...prefix].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })).join() !== prefix.join()) why.push("the Sa names are not in alphabetical order");
    for (const w of ["El Salvador", "American Samoa", "Western Sahara"]) if (!sa.slice(firstNotPrefix).some((m) => m.country.name === w)) why.push(`"Sa" misses ${w} after the Sa names`);
    const top = (q) => names_(q)[0];
    const expect = { uk: "United Kingdom", usa: "United States", ksa: "Saudi Arabia", uae: "United Arab Emirates", turkey: "Türkiye",
      sao: "São Tomé and Príncipe", "cote d": "Côte d'Ivoire", ivory: "Côte d'Ivoire", holland: "Netherlands", burma: "Myanmar",
      "south af": "South Africa", "guinea b": "Guinea-Bissau", saudi: "Saudi Arabia", egypt: "Egypt", us: "United States", korea: "South Korea" };
    for (const [q, name] of Object.entries(expect)) if (top(q) !== name) why.push(`"${q}" puts ${top(q)} first, not ${name}`);
    if (C.matchCountries("").length !== C.COUNTRIES.length || C.matchCountries("zzq").length !== 0) why.push("an empty search is not the whole list, or nonsense matches something");
    if (C.matchCountries("a").some((m) => !/(^| )a/.test(C.foldText(m.country.name)) && !(m.country.aka ?? []).some((a) => /(^| )a/.test(C.foldText(a))))) why.push("one letter matches the middle of names");
    /* The bold part is exactly the typed letters, accents and apostrophes included. */
    const hl = (q, name) => { const m = C.matchCountries(q).find((x) => x.country.name === name); return m?.highlight ? name.slice(...m.highlight) : null; };
    if (hl("Sa", "Saudi Arabia") !== "Sa" || hl("sao", "São Tomé and Príncipe") !== "São" || hl("cote d", "Côte d'Ivoire") !== "Côte d"
        || hl("sa", "El Salvador") !== "Sa" || hl("uk", "United Kingdom") !== null) why.push("the bold part is not the typed letters");
    /* Saved wherever age and gender are, and a resume without it keeps it. */
    store.clear();
    const d = B("participantDirectory.js");
    d.upsertParticipant({ email: "c9@example.test", sessionId: "s", age: 30, gender: "Female", country: "Saudi Arabia", countryCode: "SA", stage: "money", consent: null });
    d.upsertParticipant({ email: "c9@example.test", sessionId: "s", age: 30, gender: "Female", stage: "product", consent: null });
    const kept = d.lookupByEmail("c9@example.test");
    if (kept.country !== "Saudi Arabia" || kept.countryCode !== "SA" || kept.stage !== "product") why.push("a resume without the country erased it in the browser");
    const server = src("server/index.js").replace(/\/\*[\s\S]*?\*\//g, "");
    if (!/\.\.\.\(typeof body\.country === "string" && body\.country\s*\?\s*\{ country:/.test(server) || /^\s*country: body\.country,/m.test(server)) why.push("the server can overwrite a saved country with nothing");
    const api = src("src/experiment/apiClient.ts");
    if (!/\.\.\.\(entry\.country !== undefined \? \{ country: entry\.country/.test(api) || !/country_code/.test(api)) why.push("the API client does not send or read the country");
    const page = src("src/experiment/DemographicPage.tsx"), flow2 = src("src/experiment/ExperimentFlow.tsx");
    if (!page.includes("&& !countryError") || !page.includes("countryCode: country?.code ?? null") || !page.includes("<CountryField")) why.push("the page does not require and record the country");
    if (!flow2.includes("country: record.country,") || (flow2.match(/entry\.country !== undefined/g) ?? []).length < 2) why.push("the flow does not save the country, or a resume drops it");
    const field = src("src/experiment/CountryField.tsx");
    if (!field.includes('details.reason === "input-change"') || !field.includes("PREFER_NOT_TO_SAY")) why.push("the field narrows on a pick, or offers no \"Prefer not to say\"");
    gate("C9", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : `the country list (${C.COUNTRIES.length} places, codes unique): "Sa" lists every Sa name first then El Salvador and the other Sa words, other names and accents work (uk, usa, ksa, turkey, sao, cote d, holland ...), the typed letters are the bold part; saved with age and gender, never erased by a resume that does not know it`);
  }

  /* C10 — A REFRESH DURING THE PAUSE AFTER A BLOCK (30 September 2026, the checklist's "A refresh on the Block 2 or
     Block 3 finished screen"). A pause is saved as the part it leads to the moment it starts, so a refresh there lands on
     the next part, never back on the finished block (whose progress is already gone). */
  {
    const why = [];
    const F = B("flowStages.js");
    const flow = src("src/experiment/ExperimentFlow.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const union = (flow.match(/type Stage =([\s\S]*?);/) ?? ["", ""])[1];
    const stages = [...union.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
    const listed = (flow.match(/const STAGES_WITH_TRANSITION: Stage\[\] = \[([\s\S]*?)\];/) ?? ["", ""])[1];
    const transitions = [...listed.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
    if (transitions.sort().join() !== Object.keys(F.TRANSITION_TARGET).sort().join()) why.push("the pauses listed in the flow and in flowStages.ts differ");
    /* The route, written out here on its own, so a pause pointing at the wrong part (its own block, say) is caught. */
    const ROUTE = { transition_money_trolley: "trolley", transition_trolley_product: "product", transition_product_block4: "block4",
      transition_block4_block5: "block5_intro", transition_block5_summary: "block5_summary" };
    if (JSON.stringify(F.TRANSITION_TARGET) !== JSON.stringify(ROUTE)) why.push("a pause does not lead to the part that follows it");
    for (const [pause, target] of Object.entries(F.TRANSITION_TARGET)) {
      if (!stages.includes(pause) || !stages.includes(target)) why.push(`${pause} -> ${target}: not a stage of the flow`);
      if (F.isTransition(target)) why.push(`${pause} leads to another pause`);
      if (F.stageToSave(pause) !== target) why.push(`${pause} is not saved as ${target}`);
    }
    for (const s of stages.filter((x) => !F.isTransition(x))) if (F.stageToSave(s) !== s) why.push(`${s} is not saved as itself`);
    if (F.isTransition("toString") || F.isTransition(null) || F.isTransition("")) why.push("isTransition accepts something that is not a pause");
    /* The flow: the saved stage is stageToSave(stage), never skipped for a pause; the same save not repeated for the same
       participant; the auto-advance and the restore read the same targets. */
    const effect = flow.slice(flow.indexOf("const lastSaved = useRef"), flow.indexOf("}, [stage, pendingEmail]);"));
    if (!effect.includes("const saveAs = stageToSave(stage) as Stage;") || !effect.includes("localStorage.setItem(STORAGE_KEY_STAGE, saveAs);")
        || !effect.includes("saveProgress(pendingEmail, saveAs);") || /STAGES_WITH_TRANSITION/.test(effect)) why.push("the flow does not save a pause as the part it leads to");
    if (!effect.includes('const key = `${saveAs}|${pendingEmail ?? ""}`;')) why.push("the repeat-save guard ignores whose record it is");
    if (!flow.includes("const next = isTransition(stage) ? (TRANSITION_TARGET[stage] as Stage) : undefined;")) why.push("the auto-advance does not read the same targets");
    if (!flow.includes("if (isTransition(saved)) return stageToSave(saved) as Stage;") || /return "money";\s*\}\s*if \(DELETED_STAGE_NEXT/.test(flow)) why.push("a restored pause does not lead to the next part");
    /* Every block saves what the next part needs BEFORE its pause begins. */
    const product = flow.slice(flow.indexOf("const handleProductContinue"), flow.indexOf("const handleBlock4Continue"));
    const block4 = flow.slice(flow.indexOf("const handleBlock4Continue"), flow.indexOf("const handleStartBlock5Scenarios"));
    if (product.indexOf("deriveAndSaveInsights(") < 0 || product.indexOf("goOnAfterBlock3()") < 0 || product.indexOf("deriveAndSaveInsights(") > product.indexOf("goOnAfterBlock3()")) why.push("Block 3's files are not saved before its pause");
    if (block4.indexOf("localStorage.setItem(STORAGE_KEY_BLOCK4") < 0 || block4.indexOf('setStage("transition_block4_block5")') < 0
        || block4.indexOf("saveFinalAnalysis(") > block4.indexOf('setStage("transition_block4_block5")')) why.push("Block 4's files are not saved before its pause");
    const b5 = src("src/experiment/Block5PublicEmergencySimulation.tsx");
    const iSave = b5.indexOf("localStorage.setItem(BLOCK5_RESULTS_KEY, JSON.stringify(finalResults));"), iDone = b5.indexOf("onComplete(finalResults);");
    if (!(iSave > 0 && iDone > iSave)) why.push("Block 5's results are not saved before its pause");
    gate("C10", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : `every pause (${Object.keys(F.TRANSITION_TARGET).length}) is saved as the part it leads to the moment it starts, in the browser and on the server, and a restored pause leads there too; every block saves what the next part needs first; the same stage is not saved twice`);
  }

  /* C11 - "IS ENGLISH YOUR FIRST LANGUAGE?" AND "WHERE ARE YOU FROM?" (4 October 2026, the researcher). */
  {
    const why = [];
    const page = src("src/experiment/DemographicPage.tsx"), flow = src("src/experiment/ExperimentFlow.tsx");
    /* The page: the researcher's words, Yes then No, required, no default, recorded as true / false. */
    if (!page.includes('label="Is English your first language?"')) why.push("the question is not on the page in his words");
    if (!page.includes('const ENGLISH_OPTIONS = [{ label: "Yes", value: true }, { label: "No", value: false }] as const;')) why.push("the answers are not Yes then No");
    if (!page.includes("const [englishFirst, setEnglishFirst] = useState<boolean | null>(null);")) why.push("the question has a default answer");
    if (!page.includes("&& !englishError;") || !page.includes('const englishError = englishFirst === null ? "Please choose Yes or No." : null;')) why.push("the page can be sent without an answer");
    if (!page.includes("englishFirstLanguage: englishFirst === true,")) why.push("the answer is not recorded as true / false");
    if (!page.includes('label="Where are you from?"') || page.includes('label="Country"')) why.push("the country is not asked as \"Where are you from?\"");
    /* Five in the university door; four in the Prolific door, which asks no email (since 6 October 2026, "4-A"). */
    if (!page.includes('{askEmail ? "Five short questions." : "Four short questions."}')
        || !page.includes('{askEmail ? "Please complete all five questions to continue." : "Please complete all four questions to continue."}')) why.push("the page does not count five questions (four without the email)");
    /* The browser's directory: saved, and a resume without it keeps it (as the country). */
    store.clear();
    const d = B("participantDirectory.js");
    d.upsertParticipant({ email: "c11@example.test", sessionId: "s", age: 30, gender: "Female", country: "Canada", countryCode: "CA", englishFirstLanguage: false, stage: "money", consent: null });
    d.upsertParticipant({ email: "c11@example.test", sessionId: "s", age: 30, gender: "Female", stage: "product", consent: null });
    const kept = d.lookupByEmail("c11@example.test");
    if (kept.englishFirstLanguage !== false || kept.stage !== "product") why.push(`a resume without the answer erased it in the browser (${JSON.stringify(kept.englishFirstLanguage)})`);
    d.upsertParticipant({ email: "c11@example.test", sessionId: "s", age: 30, gender: "Female", englishFirstLanguage: true, stage: "product", consent: null });
    if (d.lookupByEmail("c11@example.test").englishFirstLanguage !== true) why.push("a new answer does not replace the old one");
    /* The flow: the new participant's save, the demographic file and both resume paths carry it. */
    if (!flow.includes("englishFirstLanguage: record.englishFirstLanguage,")) why.push("the flow does not save the answer");
    if ((flow.match(/\.\.\.\(typeof entry\.englishFirstLanguage === "boolean" \? \{ englishFirstLanguage: entry\.englishFirstLanguage \} : \{\}\),/g) ?? []).length !== 2) why.push("a resume drops the answer");
    /* The API client sends it only when known and reads it back; the server sets it only for a true or false. */
    const api = src("src/experiment/apiClient.ts");
    if (!api.includes('...(typeof entry.englishFirstLanguage === "boolean" ? { englishFirstLanguage: entry.englishFirstLanguage } : {}),')
        || !api.includes('...(typeof doc.english_first_language === "boolean" ? { englishFirstLanguage: doc.english_first_language } : {}),')) why.push("the API client does not send or read the answer");
    const server = src("server/index.js").replace(/\/\*[\s\S]*?\*\//g, "");
    if (!server.includes('...(typeof body.englishFirstLanguage === "boolean" ? { english_first_language: body.englishFirstLanguage } : {}),')
        || /^\s*english_first_language: body\./m.test(server)) why.push("the server can erase or garble the answer");
    gate("C11", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : "\"Is English your first language?\" asked as Yes / No, required with no default, saved as true / false with age, gender and country, never erased by a resume that does not know it; the country asked as \"Where are you from?\"; the page counts five questions");
  }

  /* ----------------------------------------------------------------------------------------- C12 */
  {
    const why = [];
    /* The plan: development asks once, as before; the live site again after 1, 2 and 4 seconds, then every 15. */
    const live = storage.serverCheckPlan(true);
    const dev = storage.serverCheckPlan(false);
    if (JSON.stringify(live) !== JSON.stringify({ pausesMs: [1000, 2000, 4000], thenEveryMs: 15000 })) why.push(`the live plan is ${JSON.stringify(live)}`);
    if (JSON.stringify(dev) !== JSON.stringify({ pausesMs: [], thenEveryMs: null })) why.push(`the development plan is ${JSON.stringify(dev)}`);

    /* A server that answers late. Its record route takes a moment, as a real one does. */
    const log = [];
    let recordRoute = "up";
    const lateServer = {
      findParticipant: async () => null,
      upsertParticipant: async (e) => {
        log.push(`record sent ${e.email} ${e.stage}`);
        await wait(40);
        if (recordRoute === "down") throw new Error("unreachable");
        if (recordRoute === "another") throw Object.assign(new Error("409"), { httpStatus: 409, code: "another_browser_active" });
        log.push("record landed");
      },
      updateStage: async (_e, s) => { log.push(`stage ${s}`); },
      markCompleted: async () => { log.push("completed"); },
      saveSection: async (p) => { log.push(`section ${p}`); },
      getResumeFiles: async () => null, claimBrowser: async () => {}, isActiveBrowser: async () => true,
    };
    const offline = (email, stage) => {
      storage.setRemoteBackend(null);
      store.clear();
      storage.saveParticipant({ email, sessionId: `s-${email}`, age: 29, gender: "Male", stage, consent: null });
      localStorage.setItem("vrds_pending_email", email);
      localStorage.setItem("vrds_demographics", JSON.stringify({ email, age: 29, gender: "Male" }));
      localStorage.setItem("block4_reflection_results", JSON.stringify({ answered: email }));
      log.length = 0;
    };

    /* 1. Somebody went through the demographic page while the server could not be reached: only this browser knows
          them. The record goes first; saves made while it is on its way are not sent ahead of it. */
    offline("late@example.com", "block2");
    const connecting = storage.connectLate(lateServer, "late@example.com");
    storage.saveProgress("late@example.com", "block2");
    storage.syncBlocks("late@example.com");
    await connecting;
    storage.syncBlocks("late@example.com");
    await wait(40);
    if (log[0] !== "record sent late@example.com block2") why.push(`the first thing sent was "${log[0]}"`);
    const landed = log.indexOf("record landed");
    const firstOther = log.findIndex((l) => !l.startsWith("record"));
    if (landed < 0 || (firstOther >= 0 && firstOther < landed)) why.push(`something was sent before the record landed: ${log.join(" | ")}`);
    /* ...and at once: not left for the 15-second retry (the flush that switching the server on starts is still
       finishing when the first syncs arrive). */
    if (!log.some((l) => l === "section blocks.block4_stakeholder_reflection")) why.push(`the blocks were not sent at once after the record: ${log.join(" | ")}`);

    /* 2. The record cannot be sent: it waits FIRST in the queue, and a save made after it waits behind it. */
    offline("late2@example.com", "block3");
    recordRoute = "down";
    await storage.connectLate(lateServer, "late2@example.com");
    storage.saveProgress("late2@example.com", "block4");
    await wait(80);
    const queued = (JSON.parse(localStorage.getItem("vrds_outbox") ?? "[]")).map((q) => q.op);
    if (queued.join(",") !== "upsertParticipant,updateStage") why.push(`the queue reads ${queued.join(", ") || "(empty)"}`);
    recordRoute = "up";
    log.length = 0;
    await storage.flushOutbox();
    if (log.join(" | ") !== "record sent late2@example.com block3 | record landed | stage block4" || storage.pendingWriteCount() !== 0) why.push(`after the server came back: ${log.join(" | ")}`);

    /* 3. Somebody who FINISHED while the server could not be reached: the record, then the completion. */
    offline("done@example.com", "complete");
    storage.saveCompletion("done@example.com");
    await storage.connectLate(lateServer, "done@example.com");
    await wait(40);
    if (!/^record sent done@example\.com \S+ \| record landed \| completed$/.test(log.join(" | "))) why.push(`a finished run sent: ${log.join(" | ")}`);

    /* 3b. (the audit of 6 October 2026) Somebody who finishes WHILE the record is on its way: the completion still goes. */
    offline("justdone@example.com", "feedback");
    const joining = storage.connectLate(lateServer, "justdone@example.com");
    storage.saveCompletion("justdone@example.com");
    await joining;
    await wait(40);
    if (!log.includes("completed")) why.push(`a completion made during the late connection was not sent: ${log.join(" | ")}`);

    /* 4. Another browser holds the record: the page locks and nothing else is sent. */
    offline("other@example.com", "block1");
    recordRoute = "another";
    await storage.connectLate(lateServer, "other@example.com");
    await wait(60);
    if (guard.getLock() !== "browser") why.push("a record held by another browser did not lock the page");
    if (log.some((l) => !l.startsWith("record"))) why.push(`something was sent after the lock: ${log.join(" | ")}`);
    guard.setLock(null);
    recordRoute = "up";
    storage.setRemoteBackend(null);

    /* From the source: the flow follows the plan and installs a late server through connectLate; the waits. */
    const flow = src("src/experiment/ExperimentFlow.tsx");
    const need = (text, re, what) => { if (!re.test(text)) why.push(what); };
    need(flow, /const plan = serverCheckPlan\(import\.meta\.env\.PROD\);/, "the page does not choose its plan by development or live");
    need(flow, /for \(const ms of plan\.pausesMs\) \{[\s\S]{0,140}available = await isApiAvailable\(\);/, "the page does not ask again after the pauses");
    need(flow, /noRemoteBackend\(\);\s*if \(plan\.thenEveryMs === null\) return;\s*while \(!available\) \{\s*await wait\(plan\.thenEveryMs\);/, "the live page does not go on asking after the landing page stops waiting");
    need(flow, /if \(late\) await connectLate\(apiClient, email\);\s*else setRemoteBackend\(apiClient\);/, "a server that answers late is not installed through connectLate");
    const api = src("src/experiment/apiClient.ts");
    need(api, /const TIMEOUT_MS = 10_000;/, "a save is still given up after less than 10 seconds");
    need(api, /const HEALTH_TIMEOUT_MS = 5_000;/, "no separate limit for the \"are you there?\" question");
    need(api, /request<\{ ok\?: boolean \}>\("\/health", undefined, HEALTH_TIMEOUT_MS\)/, "the \"are you there?\" question does not use its own limit");
    gate("C12", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : "the server check: once in development, live again after 1, 2 and 4 s and then every 15 s; a server that answers late gets the participant's record first (nothing before it lands; queued first if it cannot), then the blocks, then the completion; another browser's record locks the page; saves wait 10 s, the server check 5 s");
  }

  /* ----------------------------------------------------------------------------------------- C13 */
  {
    const why = [];
    const R = B("recruitment.js");
    const SR = await import(require("node:url").pathToFileURL(path.join(ROOT, "server", "recruitment.js")).href);
    const PID = "5f8a3c2e9b1d4e6f7a8b9c0d";
    /* 1. The door an address opens. */
    for (const [pathname, search, want] of [
      ["/", "", "university"], ["/", "?condition=APA_Only", "university"], ["/prolific", "", "prolific"],
      ["/prolific/", "?condition=Baseline", "prolific"], ["/Prolific", "", "prolific"],
      ["/", `?PROLIFIC_PID=${PID}&STUDY_ID=s1234567&SESSION_ID=x1234567`, "prolific"],
      ["/", "?PROLIFIC_PID={{%PROLIFIC_PID%}}", "university"], ["/prolifics", "", "university"],
    ]) if (R.doorFromAddress(pathname, search) !== want) why.push(`${pathname}${search} opened the ${R.doorFromAddress(pathname, search)} door`);
    const params = R.prolificParamsFrom(`?PROLIFIC_PID=${PID.toUpperCase()}&STUDY_ID=Study0001&SESSION_ID=bad id!`);
    if (params.pid !== PID || params.studyId !== "study0001" || params.sessionId !== null) why.push(`the link was read as ${JSON.stringify(params)}`);
    /* 2. A Prolific ID is never an email, and the page and the server agree on every key. */
    const keys = [PID, "a1b2c3d4", "ana@example.com", "5f8a3c2e9b1d4e6f7a8b9c0d@x.y", "short", "has space 1234", "", "ABCDEF123456"];
    for (const k of keys) {
      if (R.isProlificKey(k) !== SR.isProlificKey(k)) why.push(`the page and the server disagree on "${k}"`);
      if (k.includes("@") && R.isProlificKey(k)) why.push(`the email "${k}" read as a Prolific ID`);
    }
    if (JSON.stringify(SR.whoIs(PID)) !== JSON.stringify({ prolific_pid: PID }) || JSON.stringify(SR.whoIs("Ana@Example.com ")) !== JSON.stringify({ email: "ana@example.com" })) why.push("the server finds a record by the wrong field");
    const onInsert = SR.identityOnInsert(PID);
    if (onInsert.email !== undefined || onInsert.prolific_pid !== PID || onInsert.recruitment_source !== "prolific") why.push(`a Prolific record is made as ${JSON.stringify(onInsert)}`);
    if (SR.identityOnInsert("ana@example.com").recruitment_source !== "university") why.push("a university record is not marked university");
    if (JSON.stringify(SR.prolificIdsFrom({ prolificStudyId: "Study0001", prolificSessionId: "{{%SESSION_ID%}}" })) !== JSON.stringify({ prolific_study_id: "study0001" })) why.push("Prolific's study and submission ids are not kept as sent");
    /* 3. What the API client sends: a Prolific ID as prolificPid, never as email; a save under the owner it was made for. */
    const calls = [];
    global.fetch = async (url, init) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
      const answer = String(url).includes("/conditions/assign")
        ? { number: 3, type: "APA_Only", assignedAt: "2026-10-06T10:00:00Z" }
        : String(url).includes("/claim")
          ? { participant: { prolific_pid: PID, prolific_study_id: "study0001", age: 30, status: "Study Not Completed", current_stage: "money" }, files: null }
          : { status: "Study Not Completed" };
      return { ok: true, status: 200, json: async () => answer };
    };
    const api = B("apiClient.js").apiClient;
    await api.upsertParticipant({ email: PID, sessionId: "s", age: 30, gender: "Male", prolificStudyId: "study0001", prolificSessionId: "sess0001", stage: "money", consent: null, status: "Study Not Completed", createdAt: "", updatedAt: "", completedAt: null });
    const up = calls.at(-1)?.body ?? {};
    if (up.email !== undefined || up.prolificPid !== PID || up.prolificStudyId !== "study0001" || up.prolificSessionId !== "sess0001") why.push(`a Prolific record was sent as ${JSON.stringify(up).slice(0, 160)}`);
    const found = await api.findParticipant(PID);
    if (calls.at(-1)?.body?.prolificPid !== PID || calls.at(-1)?.body?.email !== undefined) why.push("the lookup sent the Prolific ID as an email");
    if (JSON.stringify(found) !== JSON.stringify({ status: "Study Not Completed" })) why.push(`the lookup gave more than a glance: ${JSON.stringify(found).slice(0, 120)}`);
    /* The record itself comes only through signing in (since the audit of 6 October 2026), keyed by the Prolific ID. */
    const signed = await api.signIn(PID, 30);
    if (!calls.at(-1)?.url.endsWith(`/participants/${PID}/claim`) || calls.at(-1)?.body?.age !== 30) why.push("signing in does not send the age to the claim route");
    if (signed?.participant?.email !== PID || signed?.participant?.prolificStudyId !== "study0001") why.push(`a Prolific record came back as ${JSON.stringify(signed).slice(0, 120)}`);
    await api.findParticipant("ana@example.com");
    if (calls.at(-1)?.body?.email !== "ana@example.com") why.push("the university lookup changed");
    store.set("vrds_pending_email", "someone-else@example.com");
    await api.saveSection("blocks.block1_money", { a: 1 }, PID);
    if (!calls.at(-1)?.url.endsWith(`/participants/${PID}/section`)) why.push(`a save made for ${PID} went to ${calls.at(-1)?.url}`);
    await api.assignCondition("arrival-c13-1", "prolific");
    if (calls.at(-1)?.body?.recruitmentSource !== "prolific") why.push("the landing page's question does not carry the door");
    delete global.fetch;
    /* 4. A save queued while the server is down is sent under the owner it was made for, even after somebody else starts. */
    {
      const sentTo = [];
      let up2 = false;
      storage.setRemoteBackend({
        findParticipant: async () => null, upsertParticipant: async () => {}, updateStage: async () => {}, markCompleted: async () => {},
        saveSection: async (_p, _d, owner) => { await wait(5); if (!up2) throw new Error("unreachable"); sentTo.push(owner); },
        getResumeFiles: async () => null, claimBrowser: async () => {}, isActiveBrowser: async () => true,
      });
      store.clear();
      store.set("vrds_pending_email", "first@example.com");
      store.set("block4_reflection_results", JSON.stringify({ who: "first" }));
      storage.syncBlocks("first@example.com");
      await wait(40);
      store.set("vrds_pending_email", PID);
      up2 = true;
      await storage.flushOutbox();
      if (sentTo[0] !== "first@example.com") why.push(`a save queued for first@example.com was sent for ${sentTo[0]}`);
      storage.setRemoteBackend(null);
    }
    /* 5. A different Prolific ID in the link sets the other person's run aside and keeps the machine's files. */
    {
      store.clear();
      const kept = ["vrds_local_participants", "vrds_outbox", "vrds_browser_id", "theme", "vrds_active_tab"];
      const run = ["vrds_pending_email", "vrds_demographics", "experiment_flow_stage", "vrds_session_id", "vrds_condition", "block4_reflection_results", "vrds_consent", "vrds_prolific"];
      const fill = () => { store.clear(); for (const k of [...kept, ...run]) store.set(k, k === "vrds_pending_email" ? "ana@example.com" : "x"); };
      fill();
      if (!R.makeRoomForAnotherProlificId(`?PROLIFIC_PID=${PID}`)) why.push("a different Prolific ID did not set the other run aside");
      if (run.some((k) => store.has(k))) why.push(`the other person's files stayed: ${run.filter((k) => store.has(k)).join(", ")}`);
      if (kept.some((k) => !store.has(k))) why.push(`the machine's files were removed: ${kept.filter((k) => !store.has(k)).join(", ")}`);
      fill();
      store.set("vrds_pending_email", PID);
      if (R.makeRoomForAnotherProlificId(`?PROLIFIC_PID=${PID}`) || !store.has("experiment_flow_stage")) why.push("the SAME Prolific ID lost its own run");
      fill();
      if (R.makeRoomForAnotherProlificId("") || !store.has("experiment_flow_stage")) why.push("a link without a Prolific ID set a run aside");
      store.clear();
    }
    /* 6. The pages, from the source. */
    const flow = src("src/experiment/ExperimentFlow.tsx");
    const demo = src("src/experiment/DemographicPage.tsx");
    const pstart = src("src/experiment/ProlificStartScreen.tsx");
    const ustart = src("src/experiment/StartScreen.tsx");
    const need = (text, re, what) => { if (!re.test(text)) why.push(what); };
    if (!(flow.indexOf("useState(() => makeRoomForAnotherProlificId(window.location.search));") >= 0
        && flow.indexOf("useState(() => makeRoomForAnotherProlificId(") < flow.indexOf("useState<string>(() => getSessionId())"))) why.push("another person's run is not set aside before the page reads anything");
    need(flow, /if \(door === "prolific"\) \{[\s\S]{0,500}?const linkParams = prolificParamsFrom\(window\.location\.search\);[\s\S]{0,200}?return \(\s*<ProlificStartScreen\s+params=\{\{ \.\.\.linkParams, pid: linkParams\.pid \?\? knownId \}\}\s+onNewParticipant=\{onNewParticipant\}\s+onResume=\{onResume\}/, "the Prolific door does not open its own first page");
    /* Since 7 October 2026 it is also told how to give back a finished person's new condition (N26). */
    need(flow, /return <StartScreen onNewParticipant=\{onNewParticipant\} onResume=\{onResume\} onFinishedSeen=\{onFinishedSeen\} \/>;/, "the university door's first page changed");
    need(flow, /askEmail=\{door !== "prolific"\}/, "the Prolific door's demographic page still asks the email");
    need(flow, /prolificPid: key, recruitmentSource: "prolific" as const/, "the Prolific record does not name its key truthfully");
    need(flow, /isProlificKey\(pendingEmail\) \? "arrived_with_their_prolific_id" : "typed_their_email"/, "the visit log says \"typed their email\" in the Prolific door");
    need(demo, /\{askEmail && \(\s*<Field\s+label="Email address"/, "the email question is not behind askEmail");
    need(demo, /\.\.\.\(askEmail \? \{ email: email\.trim\(\)\.toLowerCase\(\) \} : \{\}\),/, "the record carries an email in the Prolific door");
    const words = (t) => (t.match(/data-welcome>([\s\S]*?)<\/Text>/)?.[1] ?? "").replace(/\s+/g, " ").trim();
    if (!words(pstart) || words(pstart) !== words(ustart)) why.push("the Prolific first page's welcome differs from the university's");
    need(pstart, /<Text as="span" whiteSpace="nowrap">Human-AI Moral Value<\/Text>\{" "\}\s*<Text as="span" whiteSpace="nowrap">Decision-making Study<\/Text>/, "the Prolific first page does not carry the study's name");
    if (/type="email"|autoComplete="email"|[\w.-]+@[\w-]+\.\w{2,}/.test(pstart)) why.push("the Prolific first page asks or shows an email");
    /* The researcher's "1-B" (the audit of 6 October 2026): continuing on another device asks the age, checked by the server. */
    const resumeBlock = pstart.split("{mode.kind === \"resume\"")[1]?.split("{mode.kind === \"finished\"")[0] ?? "";
    if (!/label="Your age"/.test(resumeBlock) || !/onClick=\{\(\) => void continueWithAge\(\)\}/.test(resumeBlock)
        || !/const result = await signIn\(pid, given\);/.test(pstart)) why.push("a Prolific person continuing on another device is not asked their age (the researcher's 1-B), or it is not checked by the server");
    need(pstart, /Your Prolific ID/, "the Prolific first page does not show the ID");
    /* Found in the live check (6 October 2026): the page looked a person up before the server was known and called a
       finished person "new"; and an unowned university condition kept a Prolific arrival at the university's door. */
    need(pstart, /void whenServerKnown\(\)\.then\(\(\) => findParticipant\(pid\)\)/, "the Prolific first page looks a person up before it knows whether there is a server");
    /* The audit of 6 October 2026: both ways (an unowned Prolific condition is not the next student's either), and the
       address's own ?condition= goes with it. */
    need(flow, /if \(!browserParticipantKey\(\) && file && !file\.owner\s*&& \(file\.recruitmentSource \?\? "university"\) !== doorFromAddress\(window\.location\.pathname, window\.location\.search\)\) \{\s*try \{\s*localStorage\.removeItem\(CONDITION_KEY\);\s*\} catch \{ \/\* ignore \*\/ \}\s*clearConditionFromAddress\(\);/, "an unowned condition from the other door is kept (either way), or the address keeps naming it");
    /* The audit: a resumed Prolific person's condition file keeps their door; the first page uses the ID this browser
       knows when the link has lost it. */
    need(flow, /makeConditionFile\(saved, entry\.condition\.source, null, owner, entry\.condition\.assignedAt, keyDoor\(owner\)\)/, "a resumed person's condition file loses their door (major_info_and_scores would say university)");
    need(flow, /const knownId = isProlificKey\(pendingEmail\) \? pendingEmail : null;[\s\S]{0,200}params=\{\{ \.\.\.linkParams, pid: linkParams\.pid \?\? knownId \}\}/, "a returning Prolific person whose link lost the ID is asked to paste it although the browser knows it");
    need(flow, /: doorFromAddress\(window\.location\.pathname, window\.location\.search\) === "prolific"\s*\? "prolific"\s*: readConditionFile\(\)\?\.recruitmentSource \?\? "university";/, "the address does not decide the door before the condition file");
    /* 7. The database rule: one email, one Prolific ID, each on the records that have it; the old rule replaced first. */
    const db = src("server/db.js");
    need(db, /await replaceIfDifferent\(participantsCollection, "email_unique", EMAIL_RULE\);\s*await participantsCollection\.createIndexes\(\[/, "the old email rule is not replaced before the indexes are made");
    need(db, /name: "email_unique", unique: true, partialFilterExpression: EMAIL_RULE/, "the email rule still covers records without an email");
    need(db, /name: "prolific_pid_unique", unique: true, partialFilterExpression: PROLIFIC_RULE/, "no one-Prolific-ID-one-person rule");
    const server = src("server/index.js").replace(/\/\*[\s\S]*?\*\//g, "");
    if (/participants\(\)\.(?:findOne|updateOne)\(\s*\{\s*email\b|normalizeEmail|req\.params\.email/.test(server)
        || (server.match(/whoIs\(key\)/g) ?? []).length < 14) why.push("a server route still finds a participant by email only");
    need(server, /\.\.\.identityOnInsert\(key\),/, "a new record does not take its key under its true name");
    need(server, /\.\.\.prolificIdsFrom\(body\),/, "the Prolific ids are not saved");
    gate("C13", why.length === 0, why.length ? why.slice(0, 5).join(" | ")
      : "the two doors: /prolific or a Prolific ID in the link opens the Prolific door; a Prolific ID is never an email (page and server agree), is sent as prolificPid and stored as prolific_pid with the door and Prolific's ids; every save goes to the owner it was made for; a different Prolific ID sets the other person's run aside (the machine's files kept); the Prolific first page has the same welcome, the ID, no email and no question for a return; four questions without the email; the database rules swapped safely");
  }

  /* ----------------------------------------------------------------------------------------- C14 */
  {
    const why = [];
    const R = B("recruitment.js");
    /* The email is partly hidden: the next student never sees the first one's full address. */
    for (const [email, want] of [["waseem@my.fit.edu", "w•••@my.fit.edu"], ["a@b.co", "a•••@b.co"], ["nobody", "•••"]]) {
      if (R.maskEmail(email) !== want) why.push(`${email} was shown as ${R.maskEmail(email)}`);
    }
    /* Only a UNIVERSITY run is offered (an email key); a Prolific ID never (its link already starts fresh). */
    store.clear();
    store.set("vrds_pending_email", "ana@my.fit.edu");
    if (R.universityRunHeld() !== "ana@my.fit.edu") why.push("a university run in the browser is not offered");
    store.set("vrds_pending_email", "5f8a3c2e9b1d4e6f7a8b9c0d");
    if (R.universityRunHeld() !== null) why.push("a Prolific run is offered \"Not you?\"");
    store.clear();
    if (R.universityRunHeld() !== null) why.push("an empty browser is offered \"Not you?\"");
    /* Starting as someone else sets the run aside and keeps the machine's files. */
    const kept = ["vrds_local_participants", "vrds_outbox", "vrds_browser_id", "theme"];
    const run = ["vrds_pending_email", "vrds_demographics", "experiment_flow_stage", "vrds_session_id", "vrds_condition", "vrds_status", "vrds_consent"];
    for (const k of [...kept, ...run]) store.set(k, "x");
    R.setAsideThisBrowsersRun();
    if (run.some((k) => store.has(k)) || kept.some((k) => !store.has(k))) why.push(`after "Start as someone else": ${[...store.keys()].join(", ")}`);
    store.clear();
    /* The note, from the source: read when the page opens, gone when the person moves on or closes it, a confirmation
       before anything is forgotten, then the plain university address; drawn on every page (App). */
    const note = src("src/experiment/NotYouLink.tsx");
    const need = (re, what) => { if (!re.test(note)) why.push(what); };
    need(/const \[held\] = useState\(\(\) => \(loginKindNoted\(\) \? null : universityRunHeld\(\)\)\);/, "the note is not decided when the page opens, or asks \"Not you?\" right after somebody proved who they are");
    need(/if \(readStage\(\) !== openedOn\) setHidden\(true\);/, "the note stays after the person moved on");
    need(/\{maskEmail\(held\)\}/, "the note shows the full email");
    need(/onClick=\{\(\) => setConfirming\(true\)\}/, "\"Not you?\" forgets the run without asking first");
    need(/setAsideThisBrowsersRun\(\);\s*window\.location\.assign\(`\$\{window\.location\.origin\}\/`\);/, "starting as someone else does not set the run aside and open the university door afresh");
    if (/[\w.-]+@[\w-]+\.\w{2,}/.test(note.replace(/w•••@my\.fit\.edu/g, ""))) why.push("the note carries a real email address");
    if (!/<NotYouLink \/>/.test(src("src/App.tsx"))) why.push("the note is not on the page");
    gate("C14", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : "\"Not you?\" on the university door: shown only when the page opens with a university run (never a Prolific one), the email partly hidden, gone once the person moves on or closes it, a confirmation first, then the run set aside (the machine's files kept) and the university door opened afresh");
  }

  /* ----------------------------------------------------------------------------------------- C15 */
  {
    const why = [];
    const server = src("server/index.js");
    const code = server.replace(/\/\*[\s\S]*?\*\//g, "");
    const routeBody = (marker) => { const i = code.indexOf(marker); const j = code.indexOf("\n);", i); return i < 0 ? "" : code.slice(i, j); };
    /* The lookup: only the status. */
    const lookup = routeBody('"/api/participants/lookup"');
    if (!/projection: \{ _id: 0, status: 1 \}/.test(lookup) || !/res\.json\(doc \? \{ status: doc\.status \} : null\)/.test(lookup)) why.push("the lookup still answers with more than the status");
    /* The create/update route: only "ok". */
    const create = routeBody('app.post(\n  "/api/participants",');
    if (!/res\.json\(\{ ok: true \}\);/.test(create) || /res\.json\(doc\)/.test(create)) why.push("the create/update route still answers with the record");
    /* The claim: the age checked before anything is answered; the details and files only after. */
    const claim = routeBody('"/api/participants/:key/claim"');
    const iAge = claim.indexOf("Number(doc.age) !== Number(req.body?.age)"), iAnswer = claim.indexOf("res.json({ participant, files: resumeState?.files ?? null })");
    if (!(iAge > 0 && iAnswer > iAge)) why.push("the claim does not check the age before it answers with the record");
    if (!/projection: SIGN_IN_FIELDS/.test(claim)) why.push("the claim reads more than the sign-in fields");
    /* The saved run travels only as `files`, never inside the person's details (a deliberate break found this gap). */
    if (!/const \{ resume_state: resumeState, \.\.\.participant \} = doc;/.test(claim) || /participant\s*=\s*doc\b/.test(claim)) why.push("the claim hands back the saved run inside the person's details");
    const fields = server.match(/const SIGN_IN_FIELDS = \{([\s\S]*?)\};/)?.[1] ?? "";
    for (const leak of ["blocks", "analysis", "headline", "major_info_and_scores", "active_browser", "quality", "timings", "sessions"]) {
      if (new RegExp(`\\b${leak}: 1`).test(fields)) why.push(`the claim hands back ${leak}`);
    }
    /* No write without a browser id; no cross-site access. */
    if (!/if \(!requestId\) \{\s*res\.status\(400\)\.json\(\{ error: "the browser id is required" \}\);\s*return false;/.test(code)) why.push("a write without a browser id is still accepted");
    if (/import cors|app\.use\(cors|access-control-allow/i.test(code)) why.push("other websites may still call the server");
    /* After signing in, a page that reloads to pick up the run changes nothing before it reloads (found live on 7
       October 2026: setting the participant first re-ran the stage-saving effect, which wrote "start" over the saved
       stage, and the reload opened "Welcome back" again). */
    {
      const flow = src("src/experiment/ExperimentFlow.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
      const resume = flow.slice(flow.indexOf("const onResume = (entry: DirectoryEntry, restored: number) => {"), flow.indexOf("if (door === \"prolific\") {", flow.indexOf("const onResume")));
      const iReload = resume.indexOf("window.location.reload();"), iSet = resume.indexOf("setPendingEmail(entry.email);"), iStage = resume.indexOf("localStorage.setItem(STORAGE_KEY_STAGE, entry.stage || \"money\");");
      if (!(iStage > 0 && iReload > iStage && iSet > iReload) || /set(Lock|Stage|PendingEmail)\(/.test(resume.slice(iStage, iReload))) why.push("the page changes its state before the reload that picks up the run, so the stage can be overwritten");
    }
    /* The page: the age goes to the server; the start screens never compare it themselves. */
    const ustart = src("src/experiment/StartScreen.tsx"), pstart = src("src/experiment/ProlificStartScreen.tsx");
    if (/mode\.entry\.age|entry\.age !==|given !== /.test(ustart + pstart)) why.push("a start screen still compares the age itself");
    /* signIn: a wrong age is "mismatch", the right one brings the files down; nobody else's waiting saves are set aside. */
    {
      store.clear();
      const outbox = [
        { op: "updateStage", email: "mia@example.com", stage: "old" },
        { op: "updateStage", email: "someone-else@example.com", stage: "theirs" },
      ];
      store.set("vrds_outbox", JSON.stringify(outbox));
      let mode = "wrong";
      storage.setRemoteBackend({
        findParticipant: async () => ({ status: "Study Not Completed" }), upsertParticipant: async () => { throw new Error("down"); },
        updateStage: async () => { throw new Error("down"); }, markCompleted: async () => {}, saveSection: async () => {}, isActiveBrowser: async () => true,
        signIn: async (key, age) => {
          if (mode === "wrong") throw Object.assign(new Error("403"), { httpStatus: 403 });
          return { participant: { email: key, sessionId: "s", age, gender: "Female", stage: "product", consent: null, status: "Study Not Completed", createdAt: "", updatedAt: "", completedAt: null },
            files: { block4_reflection_results: { mine: true } } };
        },
      });
      const wrong = await storage.signIn("mia@example.com", 99);
      if (wrong.ok || wrong.reason !== "mismatch") why.push(`a wrong age answered ${JSON.stringify(wrong)}`);
      mode = "right";
      const right = await storage.signIn("mia@example.com", 30);
      if (!right.ok || right.restored !== 1 || JSON.parse(store.get("block4_reflection_results") ?? "{}").mine !== true) why.push(`the right age did not bring the run down: ${JSON.stringify(right).slice(0, 120)}`);
      const left = JSON.parse(store.get("vrds_outbox") ?? "[]").map((i) => i.email);
      if (left.join() !== "someone-else@example.com") why.push(`after signing in the queue holds ${left.join(", ")} (only somebody else's saves should stay)`);
      storage.setRemoteBackend(null);
      store.clear();
    }
    gate("C15", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : "privacy (the audit's F2): the lookup gives only the status, the create/update route only \"ok\", the claim checks the age before it hands back the person's details and run (never their analysis or other sections); no write without a browser id; no cross-site access; the start screens never compare the age themselves; signing in sets aside only that person's old saves");
  }

  /* ----------------------------------------------------------------------------------------- C16 */
  {
    const why = [];
    const server = src("server/index.js");
    const code = server.replace(/\/\*[\s\S]*?\*\//g, "");
    const routeAt = code.indexOf('"/api/participants/:key/prolific-code"');
    const route = routeAt < 0 ? "" : code.slice(routeAt, code.indexOf("\n);", routeAt));
    /* The server: a Prolific record only, the holding browser only, a saved completion only, the code from .env only. */
    const order = ["if (!isProlificKey(key))", "if (!requestId)", "if (!doc)", "if (doc.active_browser?.id !== requestId)",
      'if (doc.status !== "Study Completed") return res.json({ ready: false });', "const code = completionCode();", "res.json({ ready: true, code, url: completionUrl(code) });"];
    const at = order.map((o) => route.indexOf(o));
    if (at.some((i) => i < 0) || at.some((i, k) => k > 0 && i < at[k - 1])) why.push("the code route does not check, in order: a Prolific key, the browser id, the record, the holding browser, a saved completion, then the code");
    if (!/String\(process\.env\.PROLIFIC_COMPLETION_CODE \?\? ""\)/.test(code) || !/const PROLIFIC_CODE = \/\^\[A-Z0-9\]\{4,32\}\$\/;/.test(code)) why.push("the code does not come from .env, or is not checked as letters and digits");
    const setPart = route.slice(route.indexOf("$set:"), route.indexOf("res.json({ ready: true"));
    if (/\bcode\b(?!_)/.test(setPart.replace(/prolific_code_\w+/g, ""))) why.push("the code itself is written on the record");
    if (!/prolific_code_given_at: doc\.prolific_code_given_at \?\? now/.test(route) || !/\$inc: \{ prolific_code_given_times: 1 \}/.test(route)) why.push("the first time and the count are not written");
    if (!/prolific_code_configured: completionCode\(\) !== null/.test(code)) why.push("the health page does not say whether a code is set");
    if (/console\.(log|error|warn)\([^)]*\bcode\b[^_]/.test(route.replace(/no code was given/g, ""))) why.push("the server prints the code");
    /* .env.example holds a placeholder the server refuses (an underscore is not a letter or digit); PM2 passes the code on;
       the deploy script warns without printing it. */
    const example = src(".env.example");
    if (!/^PROLIFIC_COMPLETION_CODE=CHANGE_ME$/m.test(example) || /^[A-Z0-9]{4,32}$/.test("CHANGE_ME")) why.push(".env.example does not hold a refused placeholder");
    if (!/PROLIFIC_COMPLETION_CODE: process\.env\.PROLIFIC_COMPLETION_CODE \?\? ""/.test(src("ecosystem.config.cjs"))) why.push("PM2 does not pass the code on to the server");
    const deploy = src("build-and-run.sh");
    if (!/WARNING: PROLIFIC_COMPLETION_CODE is not set in \.env/.test(deploy) || /echo[^\n]*\$\{?PROLIFIC_COMPLETION_CODE/.test(deploy)) why.push("the deploy script does not warn, or prints the code");
    /* The page: no code and no Prolific completion address anywhere in its code (anyone can read a page's JavaScript). */
    const pageFiles = [];
    const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else if (/\.(tsx?|jsx?)$/.test(f.name)) pageFiles.push(p); } };
    walk(path.join(ROOT, "src"));
    const leaky = pageFiles.filter((p) => /submissions\/complete|[?&]cc=|PROLIFIC_COMPLETION_CODE/.test(fs.readFileSync(p, "utf8")));
    if (leaky.length) why.push(`the page's code names the completion address or the code: ${leaky.map((p) => path.basename(p)).join(", ")}`);
    const dist = path.join(ROOT, "dist");
    if (fs.existsSync(dist)) {
      const built = [];
      const walkDist = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walkDist(p); else if (/\.(js|html)$/.test(f.name)) built.push(p); } };
      walkDist(dist);
      if (built.some((p) => /submissions\/complete\?cc=/.test(fs.readFileSync(p, "utf8")))) why.push("the built site contains Prolific's completion address");
    }
    /* storage.fetchCompletionCode: the saved code first (only its owner's), "waiting" before the completion lands, the
       code kept once given, "unavailable" without a server, and a refusal locks the page as any other write does. */
    {
      store.clear();
      const PID = "aa11bb22cc33dd44ee55ff66";
      let answer = null, calls = 0, throwWith = null;
      storage.setRemoteBackend(null);
      if ((await storage.fetchCompletionCode(PID)).kind !== "unavailable") why.push("without a server the code is not 'unavailable'");
      storage.setRemoteBackend({
        findParticipant: async () => null, upsertParticipant: async () => {}, updateStage: async () => {}, markCompleted: async () => {},
        saveSection: async () => {}, isActiveBrowser: async () => true, signIn: async () => { throw new Error("no"); },
        getProlificCode: async (key) => { calls += 1; if (throwWith) throw throwWith; return key === PID ? answer : null; },
      });
      if ((await storage.fetchCompletionCode(PID)).kind !== "waiting") why.push("before the completion lands the code is not 'waiting'");
      answer = { code: "TEST1234", url: "https://example.invalid/back" };
      const ready = await storage.fetchCompletionCode(PID);
      if (ready.kind !== "ready" || ready.code !== "TEST1234" || ready.url !== "https://example.invalid/back") why.push(`the code given came back as ${JSON.stringify(ready)}`);
      const before = calls;
      const again = await storage.fetchCompletionCode(PID);
      if (again.kind !== "ready" || calls !== before) why.push("a reload asks the server again instead of the code it kept");
      if (storage.readSavedCompletionCode("ff66ee55dd44cc33bb22aa11") !== null) why.push("another person's code is read");
      store.clear();
      let locked = 0;
      storage.setLockedListener(() => { locked += 1; });
      throwWith = Object.assign(new Error("409"), { httpStatus: 409, code: "another_browser_active" });
      if ((await storage.fetchCompletionCode(PID)).kind !== "unavailable" || locked !== 1) why.push("a refusal from another browser does not lock the page");
      throwWith = Object.assign(new Error("503"), { httpStatus: 503, code: "no_code_configured" });
      if ((await storage.fetchCompletionCode(PID)).kind !== "unavailable" || locked !== 1) why.push("no code on the server is not 'unavailable', or locks the page");
      storage.setLockedListener(null);
      storage.setRemoteBackend(null);
      store.clear();
    }
    /* The card: from fetchCompletionCode, asked again while waiting, a button and never an automatic jump. */
    const card = src("src/experiment/ProlificCompletionCard.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
    if (!/await fetchCompletionCode\(prolificId\)/.test(card) || !/answer\.kind === "waiting" \? SOON_MS : LATER_MS/.test(card)) why.push("the card does not ask the server again while the code is on its way");
    if (/location\.(href|assign|replace)|window\.open|setTimeout\([^)]*url/.test(card)) why.push("the card moves the person to Prolific by itself (the researcher's 1-A: a button only)");
    if (!/<a data-return-to-prolific href=\{given\.url\}>/.test(card) || !/<Clipboard\.Root value=\{given\.code\}>/.test(card)) why.push("the card has no Return to Prolific button or no Copy");
    /* The final page shows it only with a Prolific ID; the flow passes it by the key. */
    const page = src("src/experiment/UserFeedbackPage.tsx");
    if (!/\{prolificId && <ProlificCompletionCard prolificId=\{prolificId\} \/>\}/.test(page)) why.push("the final page does not show the card for a Prolific participant");
    if (!/prolificId=\{pendingEmail && isProlificKey\(pendingEmail\) \? pendingEmail : null\}/.test(src("src/experiment/ExperimentFlow.tsx"))) why.push("the flow does not pass the Prolific ID by the key");
    if (/answers are anonymous/.test(page) || !/your answers are confidential and help/.test(page)) why.push("the feedback page still says the answers are anonymous (the researcher's 3-A: confidential)");
    /* A finished person on another device: the age (signIn), then the card ("2-A"). */
    const pstart = src("src/experiment/ProlificStartScreen.tsx");
    const finished = pstart.slice(pstart.indexOf('{mode.kind === "finished" && ('), pstart.indexOf('{mode.kind === "paste" && ('));
    if (!/const result = await signIn\(pid, given\);[\s\S]{0,400}setShowCode\(true\);/.test(pstart) || !/label="Your age"/.test(finished) || !/<ProlificCompletionCard prolificId=\{pid\} \/>/.test(finished)) why.push("a finished person on another device does not get the code after the age check (the researcher's 2-A)");
    /* ...and the card waits for it: shown only once the age matched (a deliberate break found the first version blind). */
    if (!/\{pid && showCode \? \(\s*<ProlificCompletionCard prolificId=\{pid\} \/>/.test(finished)
        || (pstart.match(/setShowCode\(true\)/g) ?? []).length !== 1
        || !/if \(!result\.ok\) \{[\s\S]{0,300}return;\s*\}\s*setShowCode\(true\);/.test(pstart)) why.push("the code is shown to a finished person before their age is checked");
    /* The results page: the Prolific sentence, the university one kept. */
    const nudge = src("src/experiment/Block5FeedbackNudge.tsx");
    if (!/Answering them finishes the study and gives you your Prolific completion code\./.test(nudge) || !/which you need for your \$5 gift card/.test(nudge) || !/const prolific = isProlificKey\(browserParticipantKey\(\)\);/.test(nudge)) why.push("the results page's sentence is not the door's own");
    gate("C16", why.length === 0, why.length ? why.slice(0, 4).join(" | ")
      : "the Prolific completion code: the server gives it only for a finished Prolific record to the browser holding it, from .env only and never stored; no code or completion address in the page's code or the built site; the page keeps what it was given for its owner and asks again while waiting; a button, never an automatic jump; only in the Prolific door, and after the age check on another device; the results page's Prolific sentence; \"confidential\" on the feedback page; the deploy files pass the code on without printing it");
  }

  console.log("");
  console.log("==============================================================================");
  if (fails) {
    console.log(`### ${fails} SESSION GATE${fails === 1 ? "" : "S"} FAILED ###`);
    console.log("==============================================================================");
    process.exit(1);
  }
  console.log("### ALL SESSION GATES PASSED ###");
  console.log("==============================================================================");
  console.log("");
  process.exit(0);
})();
