/**
 * server/index.js — the small API between the study and MongoDB.
 *
 * Six endpoints, no more. Each one matches a method on the RemoteBackend interface in
 * src/experiment/storage.ts, because that interface is the only thing in the app allowed to
 * speak to a server.
 *
 *   GET   /api/health                      is the server up, and is Mongo reachable
 *   POST  /api/participants/lookup         find somebody by email
 *   POST  /api/participants                create or update a participant
 *   PATCH /api/participants/:email/stage   record how far they have got
 *   PATCH /api/participants/:email/complete  mark the study finished
 *   PATCH /api/participants/:email/block   save one block's answers
 *
 * WRITES NEVER FAIL DESTRUCTIVELY
 * Every write is an upsert or a targeted $set. Nothing here deletes a participant or replaces a
 * whole document, so a stale or out-of-order request from a reconnecting browser cannot wipe
 * answers that are already stored. The worst a bad request can do is write the same value twice.
 *
 * THE EMAIL IS THE KEY, AND IT IS NORMALISED ON ARRIVAL
 * Addresses are lower-cased and trimmed here as well as in the browser. The browser's copy is a
 * convenience; this one is the one that matters, because it is what the unique index sees.
 */

import express from "express";
import cors from "cors";
import { connect, participants, DB_NAME, MONGO_URL } from "./db.js";

const PORT = Number(process.env.PORT ?? 4000);
const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" })); // a finished participant document is a few hundred KB

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

/** Wraps a handler so a thrown error becomes a 500 with a message instead of a dead request. */
const route = (handler) => (req, res) => {
  Promise.resolve(handler(req, res)).catch((err) => {
    console.error(`[api] ${req.method} ${req.path} failed:`, err.message);
    res.status(500).json({ error: err.message });
  });
};

/* --------------------------------------------------------------------------- health */

app.get(
  "/api/health",
  route(async (_req, res) => {
    const count = await participants().estimatedDocumentCount();
    res.json({ ok: true, database: DB_NAME, url: MONGO_URL, participants: count });
  }),
);

/* ---------------------------------------------------------------------- participants */

app.post(
  "/api/participants/lookup",
  route(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: "email is required" });
    const doc = await participants().findOne({ email }, { projection: { _id: 0 } });
    res.json(doc ?? null);
  }),
);

app.post(
  "/api/participants",
  route(async (req, res) => {
    const body = req.body ?? {};
    const email = normalizeEmail(body.email);
    if (!email) return res.status(400).json({ error: "email is required" });

    const now = new Date().toISOString();

    /*
     * $setOnInsert holds the facts that belong to the FIRST time this person was seen, so a
     * later visit cannot rewrite them. createdAt is obvious; status matters more — without it
     * here, somebody who finished and then reopened the study would be quietly reset to
     * unfinished and could take it again.
     */
    await participants().updateOne(
      { email },
      {
        $set: {
          session_id: body.sessionId,
          age: body.age,
          gender: body.gender,
          consent: body.consent ?? null,
          stage: body.stage ?? "money",
          updatedAt: now,
        },
        $setOnInsert: {
          email,
          status: "Study Not Completed",
          createdAt: now,
          completedAt: null,
          blocks: {},
        },
      },
      { upsert: true },
    );

    const doc = await participants().findOne({ email }, { projection: { _id: 0 } });
    res.json(doc);
  }),
);

app.patch(
  "/api/participants/:email/stage",
  route(async (req, res) => {
    const email = normalizeEmail(req.params.email);
    const stage = String(req.body?.stage ?? "");
    if (!stage) return res.status(400).json({ error: "stage is required" });
    const result = await participants().updateOne(
      { email },
      { $set: { stage, updatedAt: new Date().toISOString() } },
    );
    res.json({ updated: result.matchedCount === 1 });
  }),
);

app.patch(
  "/api/participants/:email/complete",
  route(async (req, res) => {
    const email = normalizeEmail(req.params.email);
    const now = new Date().toISOString();
    /*
     * completedAt is only written if it is not already set, so a repeated request — a retry from
     * the outbox, say — records the moment they FIRST finished rather than the moment the
     * message happened to arrive.
     */
    const existing = await participants().findOne({ email }, { projection: { completedAt: 1 } });
    await participants().updateOne(
      { email },
      {
        $set: {
          status: "Study Completed",
          completedAt: existing?.completedAt ?? now,
          updatedAt: now,
        },
      },
    );
    res.json({ ok: true });
  }),
);

app.patch(
  "/api/participants/:email/block",
  route(async (req, res) => {
    const email = normalizeEmail(req.params.email);
    const block = String(req.body?.block ?? "");
    if (!block) return res.status(400).json({ error: "block is required" });
    await participants().updateOne(
      { email },
      { $set: { [`blocks.${block}`]: req.body?.data ?? null, updatedAt: new Date().toISOString() } },
    );
    res.json({ ok: true });
  }),
);

/* ----------------------------------------------------------------------------- start */

connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[api] listening on http://localhost:${PORT}`);
      console.log(`[api] try http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error("[db] could not connect to MongoDB:", err.message);
    console.error("[db] is the MongoDB service running? Compass connects to the same address.");
    process.exit(1);
  });
