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
    const ok = browserVerdict("a", null) === "allow" && browserVerdict(null, "a") === "claim"
      && browserVerdict("a", "a") === "allow" && browserVerdict("a", "b") === "refuse"
      && requestBrowser({ headers: { "x-vrds-browser": " b1 " } }) === "b1"
      && requestBrowser({ headers: {} }) === null && requestBrowser({ headers: { "x-vrds-browser": "x".repeat(200) } }) === null;
    gate("C1", ok, "the server's rule: no id allow, nobody holds it claim, this browser allow, another browser refuse");
  }

  /* C2 */
  {
    const s = src("server/index.js");
    const why = [];
    const routeBody = (marker) => { const i = s.indexOf(marker); const j = s.indexOf("\n);", i); return i < 0 ? "" : s.slice(i, j); };
    for (const [name, marker] of [["create/update", 'app.post(\n  "/api/participants",'], ["stage", '"/api/participants/:email/stage"'],
      ["complete", '"/api/participants/:email/complete"'], ["section", '"/api/participants/:email/section"']]) {
      if (!routeBody(marker).includes("guardBrowser(req, res, email)")) why.push(`the ${name} route does not ask the rule`);
    }
    const claim = routeBody('"/api/participants/:email/claim"');
    if (!claim || !/Number\(doc\.age\) !== Number\(req\.body\?\.age\)/.test(claim)) why.push("the claim does not check the age");
    if (!routeBody('"/api/participants/:email/active"')) why.push("there is no \"am I active?\" route");
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
    getResumeFiles: async () => null,
    claimBrowser: async () => { sent.push("claim"); },
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
    const claimed = await storage.claimThisBrowser("sara@example.com", 34);
    if (!claimed || storage.pendingWriteCount() !== 0 || !sent.includes("claim")) why.push("claiming did not set the old queue aside before taking the record");
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
    const resume = flow.slice(flow.indexOf("onResume={(entry) =>"), flow.indexOf("if (stage === \"consent\")"));
    const iClaim = resume.indexOf("await claimThisBrowser("), iSave = resume.indexOf("saveParticipant("), iRestore = resume.indexOf("restoreParticipantFiles(");
    if (!(iClaim > 0 && iClaim < iSave && iSave < iRestore)) why.push("the start screen does not claim the browser before it writes and downloads");
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
    if (!page.includes("Five short questions.") || !page.includes("Please complete all five questions to continue.") || /all four questions|Four short questions/.test(page)) why.push("the page still counts four questions");
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
