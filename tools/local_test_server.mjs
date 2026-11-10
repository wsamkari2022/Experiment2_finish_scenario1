/*
 * local_test_server.mjs — the API server for testing on your own computer with a made-up Prolific ID (since 10 November 2026).
 *
 *   npm run server:test
 *
 * The same server as `npm run server`, with two differences, so a test needs no settings:
 *   - it saves to its own database, vrds_prolific_test, so test runs never mix with anything else;
 *   - it has a made-up completion code, LOCALTEST1, so the last page can show a code. It is not the real code.
 *
 * It refuses to start in production mode and never reads the real database's address. To empty the test database:
 *   npm run server:test -- --empty     (deletes vrds_prolific_test and stops)
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";

const DB = "vrds_prolific_test";
const LOCAL = "mongodb://127.0.0.1:27017";
if (process.env.NODE_ENV === "production") throw new Error("this is for testing on your own computer only");

if (process.argv.includes("--empty")) {
  const client = new MongoClient(LOCAL, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  await client.db(DB).dropDatabase();
  await client.close();
  console.log(`The test database ${DB} is empty now.`);
  process.exit(0);
}

process.env.MONGO_URL = LOCAL;
process.env.MONGO_DB = DB;
process.env.PROLIFIC_COMPLETION_CODE = "LOCALTEST1";
console.log(`[test] saving to the database ${DB} on this computer; made-up completion code LOCALTEST1`);
const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, "..", "server", "index.js")).href);
