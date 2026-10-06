/**
 * server/conditions.js — which condition the next participant gets (since 1 October 2026).
 *
 * The researcher's design: four conditions (1 CVR+APA, 2 CVR_Only, 3 APA_Only, 4 Baseline), and a landing page that
 * "will look at my database and count the number of each condition every time a new user arrive and it will give the
 * user that condition that have less participants. So my data will be balanced."
 *
 * WHO IS COUNTED (his answer "Q1-B", 1 October 2026). A person counts for their condition while they
 *   - finished the study (status "Study Completed"), or
 *   - are still working: their record changed in the last 2 hours (`updated_at`, which every save moves), or
 *   - just arrived: the landing page gave them the condition in the last 30 minutes and they have not reached the
 *     demographic page yet (where the participant record is first made), and did not turn out to be somebody
 *     returning with a condition of their own (`released`).
 * Somebody who stopped half way stops counting after 2 hours, so the next arrivals refill that condition and the
 * FINISHED numbers come out equal. Only conditions the landing page gave are counted: a condition taken from the
 * address (the researcher testing one on purpose, "Q2-yes") or chosen at random without a server never is.
 *
 * ONE AT A TIME. Two people arriving in the same second would otherwise both read the same counts and both get the
 * same condition. Assignments take turns, so the second one sees the first one's arrival.
 *
 * IN TURNS, BUT IN GROUPS (since 6 October 2026, the advisor's "multiple sessions safe"). Until then every turn read
 * the database on its own (about 1/20 of a second under load), so in a burst the 100th person waited about 5
 * seconds - and the page gave up after 3 and picked an UNCOUNTED random condition: 33 of 100 people in a load test.
 * Now everybody waiting when a turn starts is served from ONE reading of the database, still one after another: each
 * is counted exactly as if the one before had already been stored. Same rule, same answers (N22 compares the two
 * person by person); 100 at once take a handful of readings instead of 100.
 *
 * SAME ARRIVAL, SAME ANSWER. A refresh on the landing page asks again with the same arrival id and gets the same
 * condition; nothing is counted twice.
 *
 * The same list lives in src/experiment/conditions.ts; `npm run validate:conditions` fails if the two differ.
 */

export const CONDITIONS = [
  { number: 1, type: "CVR+APA", urlName: "CVR_APA" },
  { number: 2, type: "CVR_Only", urlName: "CVR_Only" },
  { number: 3, type: "APA_Only", urlName: "APA_Only" },
  { number: 4, type: "Baseline", urlName: "Baseline" },
];

/** The only source that counts for balance. */
export const COUNTED_SOURCE = "landing_page";
export const SOURCES = ["landing_page", "address", "random_offline"];
/** "Still working": the record changed within this long. */
export const WORKING_WINDOW_MS = 2 * 60 * 60 * 1000;
/** "Just arrived": given a condition within this long, and no participant record yet. */
export const ARRIVAL_WINDOW_MS = 30 * 60 * 1000;
/** The landing page's arrival ids: random, letters, digits and dashes. */
export const ARRIVAL_ID = /^[A-Za-z0-9-]{8,64}$/;

export const conditionByNumber = (n) => CONDITIONS.find((c) => c.number === Number(n)) ?? null;
export const conditionByType = (t) => CONDITIONS.find((c) => c.type === t) ?? null;

/**
 * The counts, worked out from plain lists so the rule can be checked without a database.
 *   docs:     participant documents { condition_type, condition_source, status, updated_at, condition_arrival_id }
 *   arrivals: landing-page arrivals { arrival_id, condition_type, assigned_at, linked_email, released }
 * Returns, per condition type: { finished, working, arriving, counted }.
 *
 * EVERY PERSON ONCE (since 6 October 2026). A person moves from "just arrived" to "working" in two writes - the
 * condition on their record, then the arrival marked as linked - and a count read between the two saw them twice (or,
 * with the two collections read in the other order, not at all): in a burst of 100 the conditions could end 26 / 24.
 * The record now carries its arrival id (condition_arrival_id, written WITH the condition), an arrival already on a
 * record is never counted, and the turn reads the arrivals before the records, so every order of events counts once.
 */
export function tally(docs, arrivals, now = Date.now()) {
  const workingSince = new Date(now - WORKING_WINDOW_MS).toISOString();
  const arrivedSince = new Date(now - ARRIVAL_WINDOW_MS).toISOString();
  const onARecord = new Set((docs ?? []).map((d) => d?.condition_arrival_id).filter(Boolean));
  const out = {};
  for (const c of CONDITIONS) out[c.type] = { finished: 0, working: 0, arriving: 0, counted: 0 };
  for (const d of docs ?? []) {
    const row = out[d?.condition_type];
    if (!row || d.condition_source !== COUNTED_SOURCE) continue;
    if (d.status === "Study Completed") row.finished += 1;
    else if (typeof d.updated_at === "string" && d.updated_at >= workingSince) row.working += 1;
  }
  for (const a of arrivals ?? []) {
    const row = out[a?.condition_type];
    if (!row || a.linked_email || a.released || onARecord.has(a.arrival_id)) continue;
    if (typeof a.assigned_at === "string" && a.assigned_at >= arrivedSince) row.arriving += 1;
  }
  for (const row of Object.values(out)) row.counted = row.finished + row.working + row.arriving;
  return out;
}

/** The condition with the fewest people; a tie goes to one of the tied conditions at random. */
export function chooseFewest(counts, random = Math.random) {
  const counted = (c) => counts?.[c.type]?.counted ?? 0;
  const fewest = Math.min(...CONDITIONS.map(counted));
  const tied = CONDITIONS.filter((c) => counted(c) === fewest);
  return tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))];
}

/* The people waiting for a condition, in the order they asked, and whether a turn is running. */
const waiting = [];
let turnRunning = false;
/** The most served from one reading of the database (one insert of their arrivals). */
export const MOST_IN_ONE_TURN = 200;

/**
 * Gives this arrival a condition. `store` is the database (or a pretend one in the checks):
 *   findArrival(id) -> row | null, loadDocs() -> [], loadArrivals(sinceIso) -> [], insertArrival(row)
 *   and, when it has them, findArrivals(ids) -> rows and insertArrivals(rows), one call for a whole turn.
 * Returns { number, type, urlName, arrivalId, assignedAt, counts }.
 */
export function assignCondition({ arrivalId, browser = null, store, now = () => Date.now(), random = Math.random }) {
  return new Promise((resolve, reject) => {
    waiting.push({ arrivalId, browser, store, now, random, resolve, reject });
    if (!turnRunning) void takeTurns();
  });
}

/*
 * Two stores are the same database when they are the same object, or carry the same `key`. The route builds a NEW store
 * for every request (mongoStore(participants(), conditionArrivals()), and the driver hands out a new collection object
 * each time), so matching on the object alone put every person in a turn of their own: the load test of 6 October
 * 2026 still found 109 of 400 waiting 3 seconds or more. mongoStore gives every store the database's name as its key.
 */
const sameStore = (a, b) => a === b || (a?.key !== undefined && a.key === b?.key);

/* Turns, one after another, until nobody waits. A turn that fails answers its own people with the error (the page
   asks again with the same arrival id) and never stops the next turn. */
async function takeTurns() {
  turnRunning = true;
  try {
    while (waiting.length > 0) {
      const store = waiting[0].store;
      const group = [];
      for (let i = 0; i < waiting.length && group.length < MOST_IN_ONE_TURN;) {
        if (sameStore(waiting[i].store, store)) group.push(waiting.splice(i, 1)[0]);
        else i += 1;
      }
      try {
        await serveTurn(group, store);
      } catch (error) {
        for (const person of group) person.reject(error);
      }
    }
  } finally {
    turnRunning = false;
  }
}

/* One turn: one look for arrivals already answered, one reading of the counts, then each new person in the order
   they asked - counted with everybody before them in this turn - and one insert of the new arrivals. */
async function serveTurn(group, store) {
  const ids = [...new Set(group.map((person) => person.arrivalId))];
  const found = new Map();
  const rows = store.findArrivals
    ? await store.findArrivals(ids)
    : (await Promise.all(ids.map((id) => store.findArrival(id)))).filter(Boolean);
  for (const row of rows) found.set(row.arrival_id, row);

  const made = new Map();
  const fresh = ids.filter((id) => !found.has(id));
  if (fresh.length > 0) {
    const at = group[0].now();
    /* Arrivals FIRST, then the records (see tally): never the two at once. */
    const arrivals = await store.loadArrivals(new Date(at - ARRIVAL_WINDOW_MS).toISOString());
    const docs = await store.loadDocs();
    const assignedAt = new Date(at).toISOString();
    for (const id of fresh) {
      const person = group.find((p) => p.arrivalId === id);
      const counts = tally(docs, arrivals, at);
      const chosen = chooseFewest(counts, person.random);
      const row = {
        arrival_id: id,
        condition_number: chosen.number,
        condition_type: chosen.type,
        assigned_at: assignedAt,
        browser: person.browser,
        linked_email: null,
        released: false,
      };
      arrivals.push({ ...row }); // the next person in this turn sees it, as if it were already stored
      made.set(id, { row, counts });
    }
    const newRows = [...made.values()].map((m) => m.row);
    if (store.insertArrivals) await store.insertArrivals(newRows);
    else for (const row of newRows) await store.insertArrival(row);
  }

  const answered = new Set();
  for (const person of group) {
    const id = person.arrivalId;
    const old = found.get(id);
    const row = old ?? made.get(id).row;
    const c = conditionByType(row.condition_type);
    const repeated = !!old || answered.has(id);
    answered.add(id);
    person.resolve({
      number: c.number, type: c.type, urlName: c.urlName, arrivalId: id, assignedAt: row.assigned_at,
      ...(repeated ? { repeated: true } : { counts: made.get(id).counts }),
    });
  }
}

/**
 * The fields the participant route may set, from what the page sent, or null when it sent no valid condition.
 * The number and the name must agree, and the source must be one of the three.
 */
export function conditionFieldsFrom(body) {
  const sent = body?.condition;
  if (!sent || typeof sent !== "object") return null;
  const c = conditionByNumber(sent.number);
  if (!c || c.type !== sent.type || !SOURCES.includes(sent.source)) return null;
  const assignedAt = typeof sent.assignedAt === "string" && sent.assignedAt ? sent.assignedAt.slice(0, 40) : null;
  /* The landing page's arrival, written WITH the condition so a count never sees this person twice (tally). */
  const arrivalId = sent.source === COUNTED_SOURCE && typeof sent.arrivalId === "string" && ARRIVAL_ID.test(sent.arrivalId)
    ? sent.arrivalId : null;
  return {
    condition_number: c.number,
    condition_type: c.type,
    condition_source: sent.source,
    condition_assigned_at: assignedAt,
    ...(arrivalId ? { condition_arrival_id: arrivalId } : {}),
  };
}

/** The database's side of `store`, for the real routes. */
export function mongoStore(participantsCollection, arrivalsCollection) {
  return {
    /* Which database this is, so the people waiting on it share a turn (sameStore). */
    key: `${participantsCollection.namespace}|${arrivalsCollection.namespace}`,
    findArrival: (id) => arrivalsCollection.findOne({ arrival_id: id }, { projection: { _id: 0 } }),
    /* A whole turn at once (since 6 October 2026). The rows are copied, so the driver's _id never lands on them. */
    findArrivals: (ids) => arrivalsCollection.find({ arrival_id: { $in: ids } }, { projection: { _id: 0 } }).toArray(),
    insertArrivals: (rows) => arrivalsCollection.insertMany(rows.map((row) => ({ ...row })), { ordered: true }),
    loadDocs: () => participantsCollection
      .find({ condition_type: { $exists: true } },
        { projection: { _id: 0, condition_type: 1, condition_source: 1, status: 1, updated_at: 1, condition_arrival_id: 1 } })
      .toArray(),
    loadArrivals: (sinceIso) => arrivalsCollection
      .find({ linked_email: null, released: { $ne: true }, assigned_at: { $gte: sinceIso } }, { projection: { _id: 0 } })
      .toArray(),
    insertArrival: (row) => arrivalsCollection.insertOne(row),
  };
}

/** Everything the count page shows: the counted numbers, plus every condition ever given, by source. */
export async function countReport(participantsCollection, arrivalsCollection, now = Date.now()) {
  const store = mongoStore(participantsCollection, arrivalsCollection);
  const arrivals = await store.loadArrivals(new Date(now - ARRIVAL_WINDOW_MS).toISOString());
  const [docs, everyone] = await Promise.all([
    store.loadDocs(),
    participantsCollection
      .find({ condition_type: { $exists: true } }, { projection: { _id: 0, condition_type: 1, condition_source: 1, status: 1 } })
      .toArray(),
  ]);
  const counted = tally(docs, arrivals, now);
  const all = {};
  for (const c of CONDITIONS) all[c.type] = { finished: 0, not_finished: 0, tests_by_address: 0, without_server: 0 };
  for (const d of everyone) {
    const row = all[d.condition_type];
    if (!row) continue;
    if (d.condition_source === "address") row.tests_by_address += 1;
    else if (d.condition_source === "random_offline") row.without_server += 1;
    else if (d.status === "Study Completed") row.finished += 1;
    else row.not_finished += 1;
  }
  return {
    at: new Date(now).toISOString(),
    rule: "A person counts for their condition while they finished, or are still working (their record changed in "
      + "the last 2 hours), or just arrived (given the condition in the last 30 minutes, not yet at the demographic "
      + "page). Only conditions the landing page gave are counted. The next person gets the condition with the "
      + "fewest; a tie is broken at random.",
    counted,
    everyone_ever: all,
    next_would_go_to: chooseFewest(counted, () => 0).type,
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

/** The count page ("Q3-yes"): one small table, refreshed every 30 seconds. No personal data is on it. */
export function countReportHtml(report) {
  const rows = CONDITIONS.map((c) => {
    const k = report.counted[c.type];
    const e = report.everyone_ever[c.type];
    return `<tr><td class="n">${c.number}</td><td><b>${esc(c.type)}</b></td>`
      + `<td class="big">${k.counted}</td><td>${k.finished}</td><td>${k.working}</td><td>${k.arriving}</td>`
      + `<td class="muted">${e.finished}</td><td class="muted">${e.not_finished}</td>`
      + `<td class="muted">${e.tests_by_address}</td><td class="muted">${e.without_server}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30"><title>Condition counts</title>
<style>
:root{--bg:#f7f7f8;--panel:#fff;--fg:#1f2328;--muted:#6b7280;--line:#e5e7eb;--accent:#4f46e5}
@media (prefers-color-scheme:dark){:root{--bg:#111318;--panel:#1a1d24;--fg:#e8eaed;--muted:#9aa0a6;--line:#2c313a;--accent:#8b8cf8}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;padding:24px 16px}
main{max-width:860px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}p{color:var(--muted);margin:0 0 16px}
.wrap{overflow-x:auto;background:var(--panel);border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:640px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:right}
th{font-size:12px;color:var(--muted);font-weight:600}td:nth-child(2),th:nth-child(2){text-align:left}
.n{color:var(--muted)}.big{font-size:18px;font-weight:700;color:var(--accent)}.muted{color:var(--muted)}
tr:last-child td{border-bottom:none}.next{margin-top:14px;color:var(--fg)}
</style></head><body><main>
<h1>Condition counts</h1>
<p>Updated ${esc(String(report.at).replace("T", " ").slice(0, 19))} UTC · refreshes every 30 seconds</p>
<div class="wrap"><table><thead><tr><th>#</th><th>Condition</th><th>Counted now</th><th>Finished</th><th>Working</th><th>Just arrived</th>
<th>All finished</th><th>All not finished</th><th>Tests by address</th><th>Without server</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="next">The next new participant goes to <b>${esc(report.next_would_go_to)}</b> (or one of the conditions tied with it).</p>
<p>${esc(report.rule)} The four grey columns count every participant record ever made, for reference; tests opened with a
condition in the address and runs without the server are never counted for balance.</p>
</main></body></html>`;
}
