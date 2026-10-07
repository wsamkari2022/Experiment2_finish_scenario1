/**
 * server/index.js — the small API between the study and MongoDB.
 *
 * Six endpoints, no more. Each one matches a method on the RemoteBackend interface in
 * src/experiment/storage.ts, because that interface is the only thing in the app allowed to
 * speak to a server.
 *
 *   GET   /api/health                      is the server up, and is Mongo reachable
 *   POST  /api/participants/lookup         find somebody by email or Prolific ID
 *   POST  /api/participants                create or update a participant
 *   PATCH /api/participants/:key/stage     record how far they have got
 *   PATCH /api/participants/:key/complete  mark the study finished
 *   PATCH /api/participants/:key/section   save one named section of the document
 *   POST  /api/participants/:key/prolific-code   the Prolific completion code, after a saved completion (since 7 October
 *                                          2026, Step 4; the code lives only in the server's .env)
 *
 * And, since 1 October 2026, the four conditions (server/conditions.js has the rule):
 *   POST  /api/conditions/assign    the landing page asks which condition a new arrival gets
 *   POST  /api/conditions/release   a returning participant had a condition already: forget the new arrival
 *   GET   /api/conditions/counts    the counts, as data
 *   GET   /api/conditions/report    the counts, as a small page for the researcher (refreshes every 30 s)
 *
 * WRITES NEVER FAIL DESTRUCTIVELY
 * Every write is an upsert or a targeted $set. Nothing here deletes a participant or replaces a
 * whole document, so a stale or out-of-order request from a reconnecting browser cannot wipe
 * answers that are already stored. The worst a bad request can do is write the same value twice.
 *
 * THE EMAIL IS THE KEY, AND IT IS NORMALISED ON ARRIVAL
 * Addresses are lower-cased and trimmed here as well as in the browser. The browser's copy is a
 * convenience; this one is the one that matters, because it is what the unique index sees.
 *
 * TWO DOORS, ONE KEY EACH (since 6 October 2026; server/recruitment.js). The key in a route is the participant's
 * email (the university door) or their Prolific ID (the Prolific door, /prolific). `whoIs(key)` finds the record:
 * `{ email }` or `{ prolific_pid }`. A Prolific ID is never stored in `email`.
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connect, participants, conditionArrivals, DB_NAME, SAFE_MONGO_URL } from "./db.js";
import { mergeResumeState } from "./resumeMerge.js";
import { browserVerdict, requestBrowser, REFUSED_BODY } from "./activeBrowser.js";
import {
  arrivalLink, identityOnInsert, isProlificKey, keyFromBody, normalizeKey, prolificIdsFrom, recruitmentSourceOf, whoIs,
} from "./recruitment.js";
import {
  ARRIVAL_ID, assignCondition, conditionFieldsFrom, countReport, countReportHtml, mongoStore,
} from "./conditions.js";

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

/* No cross-site access (the audit of 6 October 2026, F2): the study page and this server share one address in
   production, and Vite passes /api through in development, so nothing of ours calls it from another site. Without
   a CORS header a page on another site cannot read any answer from this server. */
app.use(express.json({ limit: "5mb" })); // a finished participant document is a few hundred KB

/* Keys (an email, or a Prolific ID) are trimmed and lower-cased by normalizeKey in server/recruitment.js. */

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
    /* Whether the Prolific completion code is set (since 7 October 2026): yes or no, never the code itself. */
    res.json({
      ok: true, database: DB_NAME, url: SAFE_MONGO_URL, participants: count,
      prolific_code_configured: completionCode() !== null,
    });
  }),
);

/* ------------------------------------------------------------------ the Prolific completion code */

/**
 * THE PROLIFIC COMPLETION CODE (since 7 October 2026; Step 4 of docs/PROLIFIC_CONVERSION_PLAN.md; the researcher's
 * "1-A, 2-A"). One code for everybody, set to "Manually review" on Prolific. It lives ONLY in the server's .env
 * (PROLIFIC_COMPLETION_CODE): never in the page's code (anyone can read that), never in Git, never in the database. It is
 * handed out only when all three hold: the record is a Prolific record, its status is "Study Completed", and the request
 * comes from the browser that holds the record. Everybody who finishes gets it - Prolific allows a rejection only in the
 * review, never by withholding the code. The first and the last time it was handed out, and how often, are written on
 * the record (prolific_code_given_at, prolific_code_last_given_at, prolific_code_given_times) for the daily pay check;
 * the code itself never is. Prolific's own completion address is built here too, so the page never holds it.
 */
const PROLIFIC_CODE = /^[A-Z0-9]{4,32}$/;
function completionCode() {
  const code = String(process.env.PROLIFIC_COMPLETION_CODE ?? "").trim().toUpperCase();
  return PROLIFIC_CODE.test(code) ? code : null;
}
const completionUrl = (code) => `https://app.prolific.com/submissions/complete?cc=${code}`;

/* ---------------------------------------------------------------------- participants */

/**
 * ONE BROWSER AT A TIME (since 29 September 2026; server/activeBrowser.js has the rule and why).
 *
 * Every write route calls this first. It reads the participant's `active_browser`, and:
 *   refuse -> answers 409 { error: "another_browser_active" } and the route stops;
 *   claim  -> nobody holds the record yet, so this browser takes it (a brand-new participant);
 *   allow  -> carries on.
 * Returns true when the route may continue.
 */
async function guardBrowser(req, res, key) {
  const requestId = requestBrowser(req);
  /* No browser id, no write (the audit of 6 October 2026, F2): "allow" let any script write any record it could name. */
  if (!requestId) {
    res.status(400).json({ error: "the browser id is required" });
    return false;
  }
  const doc = await participants().findOne(whoIs(key), { projection: { active_browser: 1 } });
  const verdict = browserVerdict(doc?.active_browser?.id ?? null, requestId);
  if (verdict === "refuse") {
    res.status(409).json(REFUSED_BODY);
    return false;
  }
  if (verdict === "claim" && doc) {
    await participants().updateOne(
      whoIs(key),
      { $set: { active_browser: { id: requestId, claimed_at: new Date().toISOString() } } },
    );
  }
  return true;
}

app.post(
  "/api/participants/lookup",
  route(async (req, res) => {
    const key = keyFromBody(req.body);
    if (!key) return res.status(400).json({ error: "an email or a Prolific ID is required" });
    /*
     * ONLY THE STATUS (the audit of 6 October 2026, F2). This route answered with the WHOLE record - every answer and
     * the age - to anybody who knew an email or a Prolific ID, which also made the email-and-age check pointless (the
     * age came back with it). The first page needs to know only whether this key started and whether it finished;
     * everything else comes down through the claim route below, after the age is checked HERE.
     */
    const doc = await participants().findOne(whoIs(key), { projection: { _id: 0, status: 1 } });
    res.json(doc ? { status: doc.status } : null);
  }),
);

app.post(
  "/api/participants",
  route(async (req, res) => {
    const body = req.body ?? {};
    const key = keyFromBody(body);
    if (!key) return res.status(400).json({ error: "an email or a Prolific ID is required" });

    if (!(await guardBrowser(req, res, key))) return;
    const now = new Date().toISOString();
    const requestId = requestBrowser(req);

    /*
     * $setOnInsert holds the facts that belong to the FIRST time this person was seen, so a
     * later visit cannot rewrite them. createdAt is obvious; status matters more — without it
     * here, somebody who finished and then reopened the study would be quietly reset to
     * unfinished and could take it again.
     */
    await participants().updateOne(
      whoIs(key),
      {
        $set: {
          participant_id: body.sessionId,
          age: body.age,
          gender: body.gender,
          /* The country (since 30 September 2026), set ONLY when the page sent one: a resume from a browser that
             does not know it must not overwrite a saved country with nothing. country_code is the ISO 3166-1
             alpha-2 code, null for "Prefer not to say". */
          ...(typeof body.country === "string" && body.country
            ? { country: body.country.slice(0, 80),
                country_code: typeof body.countryCode === "string" && /^[A-Z]{2}$/.test(body.countryCode) ? body.countryCode : null }
            : {}),
          /* "Is English your first language?" (since 4 October 2026), set ONLY when the page sent a true or false, for the
             same reason as the country; anything else is ignored. */
          ...(typeof body.englishFirstLanguage === "boolean" ? { english_first_language: body.englishFirstLanguage } : {}),
          /* Prolific's study and submission ids (the Prolific door, since 6 October 2026), set ONLY when the page sent
             them, like the country. Never Prolific's SESSION_ID in participant_id: that one is the study's own. */
          ...prolificIdsFrom(body),
          consent: body.consent ?? null,
          current_stage: body.stage ?? "money",
          /* `stage` is the app's word; `current_stage` says what it is to a reader. */
          updated_at: now,
        },
        $setOnInsert: {
          /* The key under its true name (email or prolific_pid) and the door, both facts of the first visit. */
          ...identityOnInsert(key),
          status: "Study Not Completed",
          created_at: now,
          completed_at: null,
          blocks: {},
          /* A brand-new participant belongs to the browser that created them. */
          ...(requestId ? { active_browser: { id: requestId, claimed_at: now } } : {}),
        },
      },
      { upsert: true },
    );

    /*
     * THE CONDITION IS SET ONCE (since 1 October 2026; server/conditions.js). Only a record that has none takes one,
     * so a later save - another browser, a resume, a page that knows a different condition - can never change it.
     * And the landing page's arrival now belongs to this participant, so it is counted as their record from here on
     * rather than as a fresh arrival.
     */
    const condition = conditionFieldsFrom(body);
    if (condition) {
      await participants().updateOne({ ...whoIs(key), condition_type: { $exists: false } }, { $set: condition });
      const arrivalId = body?.condition?.arrivalId;
      if (typeof arrivalId === "string" && ARRIVAL_ID.test(arrivalId)) {
        await conditionArrivals().updateOne(
          { arrival_id: arrivalId, linked_email: null, linked_prolific_pid: null },
          { $set: { ...arrivalLink(key), linked_at: now } },
        );
      }
    }

    /* Only "ok" (the audit, F2): this route used to answer with the whole record, to anybody who could write it. */
    res.json({ ok: true });
  }),
);

app.patch(
  "/api/participants/:key/stage",
  route(async (req, res) => {
    const key = normalizeKey(req.params.key);
    const stage = String(req.body?.stage ?? "");
    if (!stage) return res.status(400).json({ error: "stage is required" });
    if (!(await guardBrowser(req, res, key))) return;
    const result = await participants().updateOne(
      whoIs(key),
      { $set: { current_stage: stage, updated_at: new Date().toISOString() } },
    );
    res.json({ updated: result.matchedCount === 1 });
  }),
);

app.patch(
  "/api/participants/:key/complete",
  route(async (req, res) => {
    const key = normalizeKey(req.params.key);
    if (!(await guardBrowser(req, res, key))) return;
    const now = new Date().toISOString();
    /*
     * completedAt is only written if it is not already set, so a repeated request — a retry from
     * the outbox, say — records the moment they FIRST finished rather than the moment the
     * message happened to arrive.
     */
    const existing = await participants().findOne(whoIs(key), { projection: { completed_at: 1 } });
    await participants().updateOne(
      whoIs(key),
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


/*
 * THIS BROWSER TAKES THE RECORD (since 29 September 2026). Called by the start screen once the email-and-age
 * check has passed, before the participant's answers are downloaded. The age must match the record: the same
 * check the page makes, repeated here so the claim cannot be made with the email alone.
 *
 * SINCE THE AUDIT OF 6 OCTOBER 2026 (F2) THE AGE IS CHECKED ONLY HERE, and this is the only route that hands a record
 * back: the participant's details and the files that carry their run (resume_state.files), to the browser that has
 * just proved who it is. Both doors ask the age (the researcher's "1-B": a Prolific person continuing on another device
 * too). No limit on wrong answers (the researcher's "2 - no limits").
 */
const SIGN_IN_FIELDS = {
  _id: 0, email: 1, prolific_pid: 1, prolific_study_id: 1, prolific_session_id: 1, recruitment_source: 1,
  participant_id: 1, age: 1, gender: 1, country: 1, country_code: 1, english_first_language: 1,
  condition_number: 1, condition_type: 1, condition_source: 1, condition_assigned_at: 1,
  status: 1, current_stage: 1, consent: 1, created_at: 1, updated_at: 1, completed_at: 1, resume_state: 1,
};

/*
 * The completion code (see "the Prolific completion code" above). Answers { ready: true, code, url } after a saved
 * completion, { ready: false } before it (the page asks again in a few seconds: the completion may still be on its way),
 * 409 to a browser that does not hold the record, 404 for a university key or no record, 503 when no code is set.
 */
app.post(
  "/api/participants/:key/prolific-code",
  route(async (req, res) => {
    const key = normalizeKey(req.params.key);
    if (!isProlificKey(key)) return res.status(404).json({ error: "not a Prolific participant" });
    const requestId = requestBrowser(req);
    if (!requestId) return res.status(400).json({ error: "the browser id is required" });
    const doc = await participants().findOne(whoIs(key), {
      projection: { _id: 0, status: 1, active_browser: 1, prolific_code_given_at: 1 },
    });
    if (!doc) return res.status(404).json({ error: "no such participant" });
    /* Only the browser that holds the record: since the privacy fix a new device holds it only after the age check. */
    if (doc.active_browser?.id !== requestId) return res.status(409).json(REFUSED_BODY);
    if (doc.status !== "Study Completed") return res.json({ ready: false });
    const code = completionCode();
    if (!code) {
      console.error("[api] PROLIFIC_COMPLETION_CODE is not set (or not letters and digits) in .env: no code was given");
      return res.status(503).json({ error: "no_code_configured" });
    }
    const now = new Date().toISOString();
    await participants().updateOne(whoIs(key), {
      $set: { prolific_code_given_at: doc.prolific_code_given_at ?? now, prolific_code_last_given_at: now },
      $inc: { prolific_code_given_times: 1 },
    });
    res.json({ ready: true, code, url: completionUrl(code) });
  }),
);

app.post(
  "/api/participants/:key/claim",
  route(async (req, res) => {
    const key = normalizeKey(req.params.key);
    const requestId = requestBrowser(req);
    if (!requestId) return res.status(400).json({ error: "the browser id is required" });
    const doc = await participants().findOne(whoIs(key), { projection: SIGN_IN_FIELDS });
    if (!doc) return res.status(404).json({ error: "no such participant" });
    if (Number(doc.age) !== Number(req.body?.age)) return res.status(403).json({ error: "the age does not match" });
    await participants().updateOne(
      whoIs(key),
      { $set: { active_browser: { id: requestId, claimed_at: new Date().toISOString() } } },
    );
    const { resume_state: resumeState, ...participant } = doc;
    res.json({ participant, files: resumeState?.files ?? null });
  }),
);

/* IS THIS BROWSER THE ACTIVE ONE? Asked by the page when it opens, after every page and after every Block 5
   scenario. Unknown participant, or nobody holding the record: yes. */
app.post(
  "/api/participants/:key/active",
  route(async (req, res) => {
    const key = normalizeKey(req.params.key);
    const doc = await participants().findOne(whoIs(key), { projection: { active_browser: 1 } });
    const verdict = browserVerdict(doc?.active_browser?.id ?? null, requestBrowser(req));
    res.json({ active: verdict !== "refuse" });
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
  /* Every major score gathered in one room, written by dbShape.buildMajorScores. A copy of
     numbers that already live elsewhere, kept because the question "how did this participant
     score?" should not require opening eight sections. */
  "major_info_and_scores",
]);
const SAFE_PATH = /^[a-z0-9_]+(\.[a-z0-9_]+)?$/;

app.patch(
  "/api/participants/:key/section",
  route(async (req, res) => {
    const key = normalizeKey(req.params.key);
    const path = String(req.body?.path ?? "");

    if (!SAFE_PATH.test(path)) {
      return res.status(400).json({ error: `path must be lower_snake_case, got "${path}"` });
    }
    if (!WRITABLE_ROOTS.has(path.split(".")[0])) {
      return res.status(400).json({ error: `"${path}" is not a writable section` });
    }
    if (!(await guardBrowser(req, res, key))) return;

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
        whoIs(key), { projection: { resume_state: 1, status: 1 } },
      );
      if (doc?.status === "Study Completed") {
        return res.json({ ok: true, ignored: "the study is finished; resume state is not kept" });
      }
      const { state, added, replaced, kept } = mergeResumeState(doc?.resume_state, req.body?.data);
      await participants().updateOne(
        whoIs(key),
        { $set: { resume_state: state, updated_at: new Date().toISOString() } },
      );
      if (kept.length) {
        console.log(`[api] resume merge for ${key}: ${added} added, ${replaced} replaced, `
          + `${kept.length} kept that this browser did not have (${kept.join(", ")})`);
      }
      return res.json({ ok: true, added, replaced, kept: kept.length });
    }

    await participants().updateOne(
      whoIs(key),
      { $set: { [path]: req.body?.data ?? null, updated_at: new Date().toISOString() } },
    );
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------------ conditions */

/* A new arrival on the landing page: the condition with the fewest people (server/conditions.js). The same arrival id
   always gets the same answer, so a refresh is never counted twice. */
app.post(
  "/api/conditions/assign",
  route(async (req, res) => {
    const arrivalId = String(req.body?.arrivalId ?? "");
    if (!ARRIVAL_ID.test(arrivalId)) return res.status(400).json({ error: "a valid arrivalId is required" });
    const given = await assignCondition({
      arrivalId,
      browser: requestBrowser(req),
      store: mongoStore(participants(), conditionArrivals()),
      /* Each door is balanced on its own (the researcher's "2-A", 6 October 2026). */
      recruitmentSource: recruitmentSourceOf(req.body?.recruitmentSource),
    });
    res.json({ number: given.number, type: given.type, urlName: given.urlName, arrivalId, assignedAt: given.assignedAt });
  }),
);

/* The arrival turned out to be somebody returning with a condition of their own: it stops counting at once. */
app.post(
  "/api/conditions/release",
  route(async (req, res) => {
    const arrivalId = String(req.body?.arrivalId ?? "");
    if (!ARRIVAL_ID.test(arrivalId)) return res.status(400).json({ error: "a valid arrivalId is required" });
    await conditionArrivals().updateOne(
      { arrival_id: arrivalId, linked_email: null, linked_prolific_pid: null },
      { $set: { released: true, released_at: new Date().toISOString() } },
    );
    res.json({ ok: true });
  }),
);

/* The counts, for the researcher ("Q3-yes"): data, and a small page. Numbers only; no personal data. */
app.get(
  "/api/conditions/counts",
  route(async (_req, res) => {
    res.json(await countReport(participants(), conditionArrivals()));
  }),
);
app.get(
  "/api/conditions/report",
  route(async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(countReportHtml(await countReport(participants(), conditionArrivals())));
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
