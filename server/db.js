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
 */
export async function connect() {
  if (db) return db;
  await client.connect();
  db = client.db(DB_NAME);

  await db.collection("participants").createIndexes([
    { key: { email: 1 }, name: "email_unique", unique: true },
    { key: { participant_id: 1 }, name: "participant_id_unique", unique: true },
    { key: { status: 1 }, name: "status" },
    /* The condition counts read these (since 1 October 2026; server/conditions.js). */
    { key: { condition_type: 1 }, name: "condition_type" },
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
