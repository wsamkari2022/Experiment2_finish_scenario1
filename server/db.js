/**
 * server/db.js — the MongoDB connection, and the shape of what it stores.
 *
 * WHY A SERVER EXISTS AT ALL
 * A browser cannot talk to MongoDB. If it could, the connection string would have to be inside
 * the web page, where anybody who opened the developer tools could read it and help themselves to
 * the database. Every study that stores data has a small server in the middle for this reason,
 * and this is that server.
 *
 * LOCAL ONLY, FOR NOW
 * The connection points at the MongoDB running on this machine — the same one MongoDB Compass
 * connects to. Nothing here is exposed to the internet. Moving to a hosted database later is a
 * change to MONGO_URL and nothing else, which is why the URL is read from the environment with a
 * local default rather than written into the code.
 */

import { MongoClient } from "mongodb";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.MONGO_DB ?? "vrds_experiment2";

/*
 * On the server MONGO_URL carries a username and password. Anything that prints the URL — a log
 * line, /api/health — uses this copy, with the password masked. A local URL has no credentials
 * and comes out unchanged.
 */
const SAFE_MONGO_URL = MONGO_URL.replace(/\/\/([^:@/]+):[^@/]*@/, "//$1:***@");

/** One client for the life of the process; the driver pools connections internally. */
const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 5000 });

let db = null;

/**
 * Connects, and makes sure the indexes exist.
 *
 * THE UNIQUE INDEX ON EMAIL IS THE RULE, NOT THE UI.
 * "One email is one person" is enforced here, in the database, not by the checks in the web page.
 * A rule that lives only in the interface is a rule that holds until two people submit at the
 * same moment, or until somebody reloads at the wrong time. The database refuses a duplicate
 * outright, whatever the page does.
 *
 * TWO DOORS, TWO RULES (since 6 October 2026; server/recruitment.js). A Prolific participant has no email: their
 * key is their Prolific ID (`prolific_pid`). A unique index on `email` that covers every record treats "no email" as
 * one shared value, so the SECOND Prolific person would be refused. Both rules now cover only the records that have
 * that field ("partial" indexes): one email is one person, one Prolific ID is one person.
 *
 * THE SWAP IS SAFE ON A DATABASE THAT ALREADY HAS THE OLD RULE. MongoDB refuses to create an index under an existing
 * name with different options, and the server would stop at startup (PM2 restarting it again and again). So the old
 * `email_unique` is removed first when it is not the partial one - here, before the server opens to anybody - and made
 * again. Every record is kept; tested on a throw-away copy that had the old rule (npm run test:load, L6).
 */
const EMAIL_RULE = { email: { $type: "string" } };
const PROLIFIC_RULE = { prolific_pid: { $type: "string" } };

async function replaceIfDifferent(collection, name, partialFilterExpression) {
  let existing = null;
  try {
    existing = (await collection.indexes()).find((index) => index.name === name) ?? null;
  } catch {
    return; /* no collection yet: createIndexes makes it */
  }
  if (existing && JSON.stringify(existing.partialFilterExpression ?? null) !== JSON.stringify(partialFilterExpression)) {
    await collection.dropIndex(name);
    console.log(`[db] replaced the index ${name} with the two-door rule`);
  }
}

export async function connect() {
  if (db) return db;
  await client.connect();
  db = client.db(DB_NAME);

  const participantsCollection = db.collection("participants");
  await replaceIfDifferent(participantsCollection, "email_unique", EMAIL_RULE);
  await participantsCollection.createIndexes([
    { key: { email: 1 }, name: "email_unique", unique: true, partialFilterExpression: EMAIL_RULE },
    { key: { prolific_pid: 1 }, name: "prolific_pid_unique", unique: true, partialFilterExpression: PROLIFIC_RULE },
    { key: { participant_id: 1 }, name: "participant_id_unique", unique: true },
    { key: { status: 1 }, name: "status" },
    /* The condition counts read these (since 1 October 2026; server/conditions.js); the door since 6 October 2026. */
    { key: { condition_type: 1 }, name: "condition_type" },
    { key: { recruitment_source: 1 }, name: "recruitment_source" },
  ]);
  /* The landing page's arrivals: one row per condition it gave, until the person reaches the demographic page
     (linked_email) or turns out to be somebody returning (released). server/conditions.js has the rule. */
  await db.collection("condition_arrivals").createIndexes([
    { key: { arrival_id: 1 }, name: "arrival_id_unique", unique: true },
    { key: { assigned_at: 1 }, name: "assigned_at" },
  ]);

  console.log(`[db] connected to ${SAFE_MONGO_URL} · database "${DB_NAME}"`);
  return db;
}

/** The landing page's arrivals (since 1 October 2026; server/conditions.js). */
export function conditionArrivals() {
  if (!db) throw new Error("connect() must be awaited before using the database");
  return db.collection("condition_arrivals");
}

/** The participants collection: one document per person. */
export function participants() {
  if (!db) throw new Error("connect() must be awaited before using the database");
  return db.collection("participants");
}

export { DB_NAME, MONGO_URL, SAFE_MONGO_URL };
