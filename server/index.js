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
 *   PATCH /api/participants/:email/section save one named section of the document
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
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connect, participants, DB_NAME, SAFE_MONGO_URL } from "./db.js";
import { mergeResumeState } from "./resumeMerge.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const app = express();

/* On the public server, the same hardening headers Experiment 1 sends, on every response. */
if (IS_PRODUCTION) {
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}

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
    res.json({ ok: true, database: DB_NAME, url: SAFE_MONGO_URL, participants: count });
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
          participant_id: body.sessionId,
          age: body.age,
          gender: body.gender,
          consent: body.consent ?? null,
          current_stage: body.stage ?? "money",
          /* `stage` is the app's word; `current_stage` says what it is to a reader. */
          updated_at: now,
        },
        $setOnInsert: {
          email,
          status: "Study Not Completed",
          created_at: now,
          completed_at: null,
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
      { $set: { current_stage: stage, updated_at: new Date().toISOString() } },
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
    const existing = await participants().findOne({ email }, { projection: { completed_at: 1 } });
    await participants().updateOne(
      { email },
      {
        $set: {
          status: "Study Completed",
          completed_at: existing?.completed_at ?? now,
          updated_at: now,
        },
        /*
         * resume_state exists only to carry a HALF-FINISHED run to another computer. Once the
         * study is done there is nothing to carry, and leaving it would put a second, raw copy of
         * every answer beside the tidy one — the kind of duplicate that makes an analyst ask which
         * of the two is the real record. It goes the moment it stops being useful.
         */
        $unset: { resume_state: "" },
      },
    );
    res.json({ ok: true });
  }),
);

/**
 * The rooms of a participant document that may be written, and nothing else.
 *
 * The path arrives from the browser, and a path that went straight into a $set could address any
 * field in the document — including `status`, `email` or `consent`. An allowlist of first segments
 * plus a strict character check means the worst a malformed request can do is be rejected.
 */
const WRITABLE_ROOTS = new Set([
  "blocks", "analysis", "headline", "timings", "resume_state", "active_time", "quality",
  /* The login history written by src/experiment/sessionLog.ts (dbShape path "sessions"). Without
     it here, every save of it was refused, and because the outbox stops at its first failure,
     the refused write sat at the head of the queue and held back everything behind it. */
  "sessions",
]);
const SAFE_PATH = /^[a-z0-9_]+(\.[a-z0-9_]+)?$/;

app.patch(
  "/api/participants/:email/section",
  route(async (req, res) => {
    const email = normalizeEmail(req.params.email);
    const path = String(req.body?.path ?? "");

    if (!SAFE_PATH.test(path)) {
      return res.status(400).json({ error: `path must be lower_snake_case, got "${path}"` });
    }
    if (!WRITABLE_ROOTS.has(path.split(".")[0])) {
      return res.status(400).json({ error: `"${path}" is not a writable section` });
    }

    /*
     * RESUME STATE IS MERGED, NOT REPLACED, AND NOT ACCEPTED AT ALL ONCE THE STUDY IS DONE.
     *
     * Every browser this participant has open syncs its own copy here. Written with $set, the
     * last one to sync won — so a tab left open on an earlier machine, holding the run as it
     * stood an hour before, silently replaced the complete snapshot with its own. A participant
     * who had finished all four blocks signed in on a third browser, received a Block-3 snapshot,
     * and was sent back to Block 1 because Block 5 found no profile. See server/resumeMerge.js.
     *
     * And after completion there is nothing to carry: the completion route unsets this field on
     * purpose, and a stale tab syncing afterwards must not put it back.
     */
    if (path === "resume_state") {
      const doc = await participants().findOne(
        { email }, { projection: { resume_state: 1, status: 1 } },
      );
      if (doc?.status === "Study Completed") {
        return res.json({ ok: true, ignored: "the study is finished; resume state is not kept" });
      }
      const { state, added, replaced, kept } = mergeResumeState(doc?.resume_state, req.body?.data);
      await participants().updateOne(
        { email },
        { $set: { resume_state: state, updated_at: new Date().toISOString() } },
      );
      if (kept.length) {
        console.log(`[api] resume merge for ${email}: ${added} added, ${replaced} replaced, `
          + `${kept.length} kept that this browser did not have (${kept.join(", ")})`);
      }
      return res.json({ ok: true, added, replaced, kept: kept.length });
    }

    await participants().updateOne(
      { email },
      { $set: { [path]: req.body?.data ?? null, updated_at: new Date().toISOString() } },
    );
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ production site */

/*
 * In development Vite serves the pages and proxies /api here. On the server there is no Vite, so
 * in production this same process also serves the built study from dist/. One process, one port,
 * one origin, exactly as the Vite proxy arranges it locally. Development is unaffected, because
 * this block only runs when NODE_ENV is "production".
 */
if (IS_PRODUCTION) {
  const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  const INDEX_HTML = path.join(DIST_DIR, "index.html");

  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`[site] production build not found: ${INDEX_HTML}`);
    console.error("[site] run ./build-and-run.sh (or npm run build) first.");
    process.exit(1);
  }

  /* An unknown /api path must answer with JSON, never with the web page. */
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  app.use(
    express.static(DIST_DIR, {
      index: false,
      maxAge: "1h",
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-store");
      },
    }),
  );

  /* Any other GET returns the page, so a refresh or a direct link does not 404. */
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(INDEX_HTML);
  });
}

/* ----------------------------------------------------------------------------- start */

connect()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`[api] listening on http://${HOST}:${PORT}${IS_PRODUCTION ? " (production: serving dist/)" : ""}`);
      console.log(`[api] try http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error("[db] could not connect to MongoDB:", err.message);
    console.error("[db] is the MongoDB service running? Compass connects to the same address.");
    process.exit(1);
  });
