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
 * same condition. Every assignment runs through `serially`, so the second one sees the first one's arrival.
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
 *   docs:     participant documents { condition_type, condition_source, status, updated_at }
 *   arrivals: landing-page arrivals { condition_type, assigned_at, linked_email, released }
 * Returns, per condition type: { finished, working, arriving, counted }.
 */
export function tally(docs, arrivals, now = Date.now()) {
  const workingSince = new Date(now - WORKING_WINDOW_MS).toISOString();
  const arrivedSince = new Date(now - ARRIVAL_WINDOW_MS).toISOString();
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
    if (!row || a.linked_email || a.released) continue;
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

/* One assignment at a time: each waits for the one before it, and a failure does not stop the next. */
let queue = Promise.resolve();
export function serially(task) {
  const run = queue.then(task, task);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Gives this arrival a condition. `store` is the database (or a pretend one in the checks):
 *   findArrival(id) -> row | null, loadDocs() -> [], loadArrivals(sinceIso) -> [], insertArrival(row)
 * Returns { number, type, urlName, arrivalId, assignedAt, counts }.
 */
export function assignCondition({ arrivalId, browser = null, store, now = () => Date.now(), random = Math.random }) {
  return serially(async () => {
    const existing = await store.findArrival(arrivalId);
    if (existing) {
      const c = conditionByType(existing.condition_type);
      return { number: c.number, type: c.type, urlName: c.urlName, arrivalId, assignedAt: existing.assigned_at, repeated: true };
    }
    const at = now();
    const [docs, arrivals] = await Promise.all([
      store.loadDocs(),
      store.loadArrivals(new Date(at - ARRIVAL_WINDOW_MS).toISOString()),
    ]);
    const counts = tally(docs, arrivals, at);
    const chosen = chooseFewest(counts, random);
    const assignedAt = new Date(at).toISOString();
    await store.insertArrival({
      arrival_id: arrivalId,
      condition_number: chosen.number,
      condition_type: chosen.type,
      assigned_at: assignedAt,
      browser,
      linked_email: null,
      released: false,
    });
    return { number: chosen.number, type: chosen.type, urlName: chosen.urlName, arrivalId, assignedAt, counts };
  });
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
  return {
    condition_number: c.number,
    condition_type: c.type,
    condition_source: sent.source,
    condition_assigned_at: assignedAt,
  };
}

/** The database's side of `store`, for the real routes. */
export function mongoStore(participantsCollection, arrivalsCollection) {
  return {
    findArrival: (id) => arrivalsCollection.findOne({ arrival_id: id }, { projection: { _id: 0 } }),
    loadDocs: () => participantsCollection
      .find({ condition_type: { $exists: true } },
        { projection: { _id: 0, condition_type: 1, condition_source: 1, status: 1, updated_at: 1 } })
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
  const [docs, arrivals, everyone] = await Promise.all([
    store.loadDocs(),
    store.loadArrivals(new Date(now - ARRIVAL_WINDOW_MS).toISOString()),
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
