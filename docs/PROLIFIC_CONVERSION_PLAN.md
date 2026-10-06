# Prolific conversion plan (written 1 October 2026, revised 6 October 2026; Step 0 built, the rest NOT built)

> **6 October 2026: read section 1b first.** The researcher decided on TWO versions on one website (the email version
> stays for FIT students and employees), NO pilot, and "Manually review" for every Prolific submission with a daily pay
> check. Where the sections below still speak of a pilot, two completion paths or one version, section 1b wins.

For Waseem, and for the Claude session that will build it later. Nothing in this file has been built. The study
code stayed exactly as it was on 1 October 2026 (commit 7453ae9 and the docs commit that added this file).

**Why it waits.** Waseem first divides the study into four conditions and tests them in the current set-up (email,
local and server database). The Prolific conversion comes after that, so the conditions can be tested before
anything about identity, consent or payment changes. When the conversion starts, this plan must be checked again
against the code as it is then, because the four conditions will have added code that this plan has not seen.

---

## 0. How to pick this up later (for Claude)

1. Read this whole file, then `Prolific docs/Prolific_New_Study_Form_FILLED.docx` if it still exists (it is
   untracked and off GitHub on purpose: the folder holds the Prolific completion code).
2. **Check Prolific's rules again** (section 2 lists the pages). They were read on 1 October 2026 and can change.
3. Run `grep -rli email src server tools` and compare with section 4.A's list. New files from the conditions work
   will appear; each one needs the same treatment.
4. Ask Waseem only the decisions in section 8 that are still open. Never ask analysis-rule questions (his standing
   rule: all completed sessions are analysed; he decides other rules after the experiment).
5. Build one step at a time (his rule): plan in simple English with examples, wait for his yes, build, run
   `npm run typecheck && npm run lint && npm run validate:block5 && npm run build`, break each new check on purpose,
   test live in the browser (restore the test browser's localStorage afterwards), update the docs listed in 4.H,
   rebuild the accuracy checklist, commit and push on the working branch.
6. Never commit the `Prolific docs/` folder, a completion code, or a completion link. Codes go into the server's
   `.env` only.

---

## 1. What Waseem decided and asked for (1 October 2026)

- External study link; the study stays on his own server.
- 160 participants for all conditions together (four conditions, about 40 each). The conditions are designed next.
- Prolific's completion link and code are given at the end of the study.
- "I think I need to modify the demographic page" - yes, the email must go (section 4.C).
- "Keep the Prolific folder off GitHub" - done; it is untracked. A `.gitignore` line was suggested, not yet approved.
- Code stays as it is until he asks for the conversion.

---

## 1b. The decisions of 6 October 2026 (the researcher, after his advisor)

| Question | Answer | What it means for the build |
|---|---|---|
| Two versions? | **Yes, "1-A": one website, two doors** | https://moonlander.fit.edu stays the email version exactly as it is (FIT students and employees, the $5 gift card, may come back another day); https://moonlander.fit.edu/prolific is the Prolific version (the Prolific ID from the link, no email). One server, one database; each record saves which door (`recruitment_source`: "university" / "prolific"). Every fix is made once |
| Condition balance | **"2-A": each group on its own** | The landing page's count is done per `recruitment_source`, so 20 students land 5 / 5 / 5 / 5 even while Prolific fills fast |
| Attention checks | **"3-B": the second "pick the number" row in the Prolific version only** | The university version keeps exactly today's three checks and its gift-card rule; the Prolific version adds a second number row (Prolific needs two failed valid checks before a rejection) |
| Prolific demographic page | **"4-A": remove only the email** | Age, gender, "Where are you from?" and the English question stay |
| `.gitignore` | **"5-yes"** | Done 6 October 2026: `Prolific docs/` is ignored (the code, and from launch the daily exports with emails) |
| First Prolific batch | **"6-40"** | Open 40 places (about 10 per condition), check the data the next morning, then add the rest |
| Pilot | **None** (budget) | Every participant's data is kept. Instead: Preview-as-participant runs, colleagues through the university door, and the first batch of 40 read before the rest opens |
| Payment | **Every Prolific submission "Manually review"** | ONE completion code (the one Waseem has), action "Manually review", kept in the server's `.env` and shown by the server only after a saved completion. No automatic "Approve and pay" |
| Daily pay check | **Claude, from exported files** | Every day Waseem exports the `participants` collection from Compass (JSON) and Prolific's submissions file (CSV) into `Prolific docs/daily/<date>/`; a tool (to build) sorts every Prolific ID into Pay / Look first / Not finished / Problem by Prolific's valid reasons only, with one comma-separated line for Prolific's bulk approve. Claude never holds the server's database password |
| Many people at once | **Step 0, built 6 October 2026** | CLAUDE.md "Many people at once": grouped condition turns, a patient landing page that never picks at random on the live site, a live page that keeps looking for the server; `npm run test:load` |

**Step 1 built 6 October 2026** (plan answers "1-A, 2-A, 3-A": a returning Prolific person continues with no question;
the Prolific first page is a welcome with the ID and Start; deploy only after Step 4, with a database backup first).
What it does: CLAUDE.md, "Two doors". It also took "A little about you" without the email from Step 2.

**Build order (one step at a time):** Step 0 (done) -> 1 (done) the two doors, the Prolific ID as the key, `recruitment_source`, balance per group -> 2 the Prolific consent page and the demographic page without the email -> 3 the second number row (Prolific only) -> 4 the end page: the code from the server and "Return to Prolific" -> 5 the daily pay-check tool -> 6 deploy, Preview runs, colleagues, then Prolific in batches.

**Prolific's rules re-read 6 October 2026, unchanged:** at least $8 an hour ($12 recommended); two failed valid checks before a rejection in a study over 5 minutes; memory-recall checks are not valid; "too slow", the researcher's own measures and a wrong or missing code are not valid reasons; submissions not reviewed are approved automatically on day 21; a completion code can approve automatically (not used here); bulk approval takes a list of Prolific IDs.

## 2. Prolific's rules this plan rests on (read 1 October 2026)

| Rule | What it means for this study | Source |
|---|---|---|
| No personal email, name, phone or address without Prolific's written approval | The email question and the email-based return must go; the Prolific ID replaces them | [Personal information](https://researcher-help.prolific.com/en/articles/445117-can-i-ask-participants-for-their-personal-information-identifiers) |
| Valid attention checks: an instruction ("pick the number four") or a nonsense item (a statement that cannot be true). NOT valid: checks relying on memory recall, ambiguous ones, time-based ones | The two topic questions (after Block 3, after scenario 3) ask what was just finished, which is memory: they cannot be used to reject. Only the feedback number row is valid today | [Attention check policy](https://researcher-help.prolific.com/en/articles/445153-prolific-s-attention-and-comprehension-check-policy) |
| In a study longer than 5 minutes a person must fail at least two valid checks before rejection | With one valid check nobody could be rejected; a second instruction check is needed | same page |
| Comprehension checks: at the start, two chances, information re-readable, failure = asked to return, not rejected | The study has none; nothing to change unless one is added | same page |
| Valid rejections: failed checks, clear low effort throughout, exceptionally fast (3 SD below the mean), skipped required questions, non-authentic. NOT valid: too slow, failing the researcher's internal measures, technical errors, a wrong or missing code | The 35-active-minute pay rule must stop being a pay rule; straightlining and rushed blocks can only send a submission to manual review | [Who should I reject?](https://researcher-help.prolific.com/en/articles/445218-who-should-i-reject) |
| Pay at least $8 an hour (£6); $12 (£9) recommended; judged on the REAL median time | Pilot first, then set the price from the pilot's median | [How much should I pay?](https://researcher-help.prolific.com/en/articles/445266-how-much-should-i-pay-participants) |
| Academic platform fee 33.3% of rewards (needs a university-email account set to Academia) | Budget: rewards x 1.333 | [Pricing](https://researcher-help.prolific.com/en/articles/445239-what-is-your-pricing) |
| Time limit: at least 2 + 2 x estimate + 2 x the square root of the estimate (minutes), under 24 hours | At a 50-minute estimate about 116 minutes; "come back another day" no longer works | [Create a study (API)](https://docs.prolific.com/api-reference/studies/create-study) |
| Demographic export by Prolific ID (age, sex, first language, country of residence, nationality, country of birth, student and employment status, times, status); extra prescreeners must be chosen BEFORE launch; returned submissions show "CONSENT REVOKED" | Keep the study's own age, gender, country; choose extra export fields before launch if wanted | Waseem's `prolific_demographic_data_article.pdf` |
| Custom screening is for people the built-in filters cannot find | Not needed: answer "No" | Waseem's custom-screening guide (12 pages) |
| Completion paths: a redirect URL or a copy-paste code per path; several paths allowed, each "Manually review" or "Approve and pay", optionally "add to participant group" | Two paths: Completed and Needs review (section 4.D) | Waseem's `Completetion Path link.docx` screenshots |

---

## 3. The Prolific form, item by item

The full table, with a reason and a tag per item, is `Prolific docs/Prolific_New_Study_Form_FILLED.docx`
(built from a scratchpad script on 1 October 2026; the folder is off GitHub). The answers, without any code:

| Item | Answer |
|---|---|
| 1.1 Data collection | External study link |
| 2.1 Study name | "Human-AI Moral Value Decision-making Study" (the first page and the browser tab since 4 October 2026; the consent page's "Study Title" still says "Human-AI Moral Value Study") - Waseem's choice open |
| 2.2 Internal name | "VRDS Exp 2 - PILOT (10)" and "VRDS Exp 2 - MAIN (160)", two separate Prolific studies |
| 2.3 Description | Draft in section 6 |
| 2.4 Label | Decision making |
| 2.5 Devices | Desktop only recommended (does not block phones; the study can show a note) - open |
| 2.6 Requirements | None |
| 2.7 Content warning | "Sensitive topics" recommended (life-and-death dilemmas) - open |
| 3.1 URL | `https://<public address>/` only; Prolific adds the parameters - address needed from Waseem |
| 3.2 IDs | URL parameters (PROLIFIC_PID, STUDY_ID, SESSION_ID) |
| 3.3 Custom screening | No |
| 3.4 Default path | Pilot: Manually review. Main: "Completed" = Approve and pay |
| 3.5 Participant group | "VRDS2 participants" on the Completed path (keep them out of later studies) |
| 3.6 / 3.7 Redirect URL and code | Copied into the server's `.env`, never into Git or the page |
| 3.8 Extra path | "Needs review" = Manually review |
| 4.1 Places | Pilot 10, main 160 (returned and timed-out places are refilled by Prolific) |
| 4.2 Filters | Approval rate 95-100; fluent English; country of residence (open: US only, or US + UK + CA + AU + IE); main run excludes the pilot study |
| 4.3 Distribution | Standard sample |
| 4.4 Credentials | No |
| 4.5 Submissions | Once |
| 4.6 Auto-reject fast | No |
| 5.1 Time | 50 minutes until the pilot gives the real median (consent page says 40 to 55) |
| 5.2 Reward | $10.00 = $12 an hour at 50 minutes recommended; $12.50 = $15 an hour fills faster - open |
| 6 Cost | Main 160 x $10 = $1,600 + 33.3% = about $2,133; pilot about $133 |
| 7.1 Action | Save as draft; Preview as participant before any publish |

---

## 4. The changes to the study

### A. The Prolific ID replaces the email as the participant's key (the largest change)

**What changes.** Prolific opens `https://<address>/?PROLIFIC_PID=...&STUDY_ID=...&SESSION_ID=...`. The study reads
the three values on its first load, saves them, and uses PROLIFIC_PID wherever the email is the key today. Nobody
types an email. A participant who reopens the study from Prolific (refresh, crash, another browser) arrives with the
same ID and continues; the resume, the one-browser rule and the one-tab rule keep working with the ID as the key.

**Missing ID** (a copied address, a researcher test): the first screen asks "Paste your Prolific ID" and checks the
format (Prolific IDs are 24 hexadecimal characters). In development a test ID can be typed the same way.

**Names.** Prolific's SESSION_ID is NOT the study's own `vrds_session_id` (which seeds scenario 6's rule order and
the attention plan). Store Prolific's as `prolific_session_id`; keep `vrds_session_id` as it is.

**Where the email is the key today** (counts from `grep -ci email`, 1 October 2026):

| File | Mentions | What it does with the email |
|---|---|---|
| `src/experiment/ExperimentFlow.tsx` | 62 | `pendingEmail`, the persistence key `${saveAs}|${pendingEmail}`, every save call |
| `server/index.js` | 44 | routes `/api/participants/lookup`, `/api/participants`, `/:email/stage`, `/:email/complete`, `/:email/claim` (checks age), `/:email/active`, `/:email/section`; `normalizeEmail`; `guardBrowser(req, res, email)` |
| `src/experiment/StartScreen.tsx` | 38 | asks the email; new / unfinished (email + age check) / finished / mismatch |
| `src/experiment/DemographicPage.tsx` | 38 | the email field, `looksLikeEmail`, `DemographicRecord.email` |
| `src/experiment/storage.ts` | 36 | `findParticipant`, `saveParticipant`, `saveProgress`, `saveCompletion`, `syncResumeState`, `restoreParticipantFiles`, `claimThisBrowser(email, age)`, `isThisBrowserActive`, `syncBlocks` |
| `src/experiment/apiClient.ts` | 21 | the HTTP calls above |
| `src/experiment/ConsentPage.tsx` | 17 | "Privacy and Your Email", the agreement sentence |
| `src/experiment/participantDirectory.ts` | 16 | `vrds_local_participants`, `normalizeEmail`, `lookupByEmail`, `updateStage`, `markCompleted` |
| `src/experiment/sessionGuard.ts` | 7 | `checkActiveBrowser(email)`, `progressOwner(email)` |
| `src/experiment/attentionChecks.ts` | 7 | `currentOwner()` reads `vrds_pending_email` / `vrds_demographics.email`; the plan seed `${session}|${owner}` |
| `src/experiment/activeTime.ts` | 6 | `claimActiveClockFor(email)`: the ledger belongs to the participant |
| `src/experiment/block5Progress.ts` | 4 | the progress file's owner |
| `server/db.js` | 3 | the unique index `email_unique` ("one email is one person") |
| `src/experiment/sessionLog.ts` | 2 | the event `typed_their_email` |
| `src/experiment/SessionLockScreen.tsx` | 2 | "You will be asked for your email and age again" |
| `server/activeBrowser.js` | 1 | the claim goes through the email-and-age check |
| others (session.ts, feedbackTypes.ts, dbShape.ts, UserFeedbackPage.tsx, TrolleyThresholdBlock.tsx, Block5PublicEmergencySimulation.tsx, AIWorkforceThresholdBlock.tsx) | 1 each | comments or the owner passed along; read each |
| tools: `validate_session.cjs`, `validate_attention.cjs`, `validate_dbshape.cjs`, `simulate_visits.cjs`, `make_accuracy_checklist_docx.py`, `build_rater_room.cjs` | - | pretend participants and checks written with emails |

**How to build it safely.** Keep every mechanism and swap only the key: one helper that returns "this participant's
key" (the Prolific ID), used wherever the email is read. The database field becomes `prolific_pid` with a unique
index, plus `prolific_study_id` and `prolific_session_id`; the routes take `:pid`. The claim (`/claim`) no longer
asks the age: an ID that arrives in the Prolific link is the participant. "Continue here instead" on the lock screen
claims directly. The study's own test records use emails; there is no real data, so no old-record handling is needed
(confirm with Waseem that the server database was cleared first).

**New checks.** `validate:session`: the ID is read from the link, saved, used as the key everywhere the email was;
a link without an ID shows the paste box; a second browser with the same ID resumes and takes the lock; a different
ID never sees another person's progress. `validate:dbshape` D44 still holds (any new section allowed by the server).

### B. The consent page (`src/experiment/ConsentPage.tsx`)

| Today | After | Why |
|---|---|---|
| "Your $5 Amazon Gift Card ... sent privately by email" (lines ~337-347) | "You will be paid $X through Prolific when you finish" | Prolific pays |
| Rule "Spend at least 35 minutes actively working" + "Time counts only while you are working" (`REQUIRED_ACTIVE_MINUTES`, dbShape.ts line 549) | Removed as a pay rule. Active time is still measured, stored and shown on the thank-you page | Prolific: "too slow" and internal measures are not valid rejection reasons |
| "You do not have to finish in one sitting" + "You Can Stop and Come Back ... on a different computer" | "Please complete it in one sitting, within Prolific's time limit (about 2 hours). If the page closes, open it again from Prolific and you continue where you stopped." | Prolific times out |
| "Privacy and Your Email ... confidential, not anonymous ... we collect your email" | "We never ask your name or email. Your answers are stored with your Prolific ID only, and reported as group results." | No email |
| "Answer the quick attention checks as asked to qualify" | "A few simple questions check that you are reading. If you fail two or more, your submission may be rejected." | Prolific's two-failure rule |
| "you may skip questions you do not wish to answer" | "You may stop at any time." | The study requires every answer, so the old sentence is untrue |
| Two tick-boxes naming the gift card, the email and the 35 minutes | One agreement box without email, gift card or minutes | Same reasons |
| No way to decline except closing the tab | An "I do not agree" button -> "Please return this study on Prolific (click 'Stop without completing')." No code | Prolific's normal way out |
| Withdraw: "contact the researcher" | "Send a message through Prolific, or email the researcher, with your Prolific ID" | Data is found by Prolific ID |
| The IRB contact | unchanged | |

The ethics board must approve the new consent text BEFORE launch (recruitment, payment, data, attention rule).

### C. The demographic page (`src/experiment/DemographicPage.tsx`)

- Remove the email field (and `looksLikeEmail`, the `emailLocked` path, the "Five short questions" header becomes four).
  Since 4 October 2026 the page also asks "Is English your first language?" (`english_first_language`) and asks the
  country as "Where are you from?"; Prolific's own export has a "first language" field, so the two can be compared.
- Recommended: keep age, gender and country. Reasons: short; the database is complete on its own; returned people
  appear as "CONSENT REVOKED" in Prolific's file; comparing with Prolific's file is a free quality check.
- The 18-or-older check stays.
- Optional, before launch only: extra Prolific prescreeners in the export (Prolific cannot add them afterwards).

### D. The end of the study: the code and the way back

- **Thank-you page** (`src/experiment/UserFeedbackPage.tsx`): at the very top, "Your completion code: ______ [Copy]"
  and a "Return to Prolific" button (the redirect URL). The charts (`JourneyTabs`) stay below, optional. A finished
  participant who reloads still lands on the thank-you page (`alreadyCompleted`) and sees the code again.
- **Two completion paths, chosen by the SERVER after it has saved the completion:**
  - "Completed" (Approve and pay): the study is finished and the person did not fail both instruction checks.
  - "Needs review" (Manually review): both instruction checks failed, OR straightlined feedback, OR 3+ rushed blocks
    (the old `compensation_eligible` reasons that Prolific allows only as "clear low effort", judged by hand).
- **Security.** The Completed code is never in the page's code (anyone can read it in the browser). The server keeps
  both codes in `.env` (for example `PROLIFIC_CODE_COMPLETED`, `PROLIFIC_CODE_REVIEW`, and the two redirect URLs) and
  returns the right one from the completion route. The page holds only the "Needs review" code, used when the server
  cannot be reached after a few tries, so a person is never stuck and a doubtful case is checked by hand.
- **Results page** (`src/experiment/Block5FeedbackNudge.tsx` line ~57): "Answering them completes the study, which you
  need for your $5 gift card" -> "Answering them finishes the study and gives you your Prolific completion code."
- **Database** (`buildQuality` in dbShape.ts, lines ~640-690): replace `compensation_eligible` with
  `prolific_completion_path` ("completed" / "needs_review") and its reasons; keep `active_minutes`,
  `met_time_requirement` (renamed or explained as information only), `straightlined_feedback`, `rushed_blocks`.
  Update HOW_TO_READ's quality section.

### E. Attention checks under Prolific's rule (`src/experiment/attentionChecks.ts`, `UserFeedbackPage.tsx`)

| | Today | After (recommended) |
|---|---|---|
| Topic question after Block 3, after scenario 3 | Count for the gift card | Kept, saved, NEVER count for pay (memory recall is not valid on Prolific) |
| "Pick the number N" in the feedback | One row, random place among 30 in two sections | Two rows, one in each section ("The tools & the experiment design", "How this experience was for you"), each with its own random number 2-5 and random place |
| Rule | All three right | Fail BOTH number rows -> "Needs review" |

Bump `ATTENTION_VERSION`; update T1 (two rows, one per section, numbers 2-5, places equally likely), T4 (the path
rule), T7 (chance a random clicker fails both), the consent-page check in T8. The topic checks' words stay as
Waseem approved them (T1 holds them).

### F. The four conditions on Prolific

**Built on 1 October 2026** (CLAUDE.md, "The four conditions and the landing page"): the landing page, the server's
count, the set-once condition and the address. For Prolific: send everybody to ONE study link; the landing page gives
the condition; `addressFor` keeps every other parameter (validate:conditions N7 tests a Prolific ID); the condition's
`owner` and the arrival's `linked_email` become the Prolific ID instead of the email (section A's swap); and Prolific's
time limit fits the counting rule (a person still working counts for 2 hours, about Prolific's limit at 50 minutes).
The rest of this section was written before the landing page existed: For Prolific, recommended: ONE Prolific study; the study's
server assigns the condition (the condition with the fewest people who finished or are still within the time
limit; ties at random), saves it on the participant's record, and never changes it on a return. Benefits: one link,
one set of codes, Prolific blocks second attempts, all conditions run at the same time with the same pool.
The alternative (four Prolific studies with 40 places each, each excluding the other three) is weaker: a person can
start two before the exclusion sees them, and conditions may fill at different hours.
**Build the conditions so the assignment reads "the participant's key"**, not the email directly, so this
conversion only swaps the key.

### G. Smaller items

- Save STUDY_ID (tells the pilot from the main run) and Prolific's SESSION_ID.
- Optional: on a phone, a polite "please use a computer" note (Prolific's device box does not block phones).
- Prolific's "Preview as participant" creates a record in the database; remove test records before launch.
- Remove the dev controls: automatic in a production build (checked after every build: "Fill feedback" absent).

### H. Documents to update when it is built

CLAUDE.md (identity, the visit and working-time section, "Continue where you left off", attention checks, the way on
to the feedback, this plan's status), `Generated Outputs/HOW_TO_READ_MY_DATABASE.md` (email -> prolific_pid, quality,
attention), `Generated Outputs/HOW_TO_ANALYZE_MY_DATA.md` 4.9 (a dated row: the move to Prolific), `docs/FRESH_EYE_AUDIT.md`
Log, `tools/make_accuracy_checklist_docx.py` rows (then rebuild the docx), DEPLOYMENT.md (the new `.env` lines),
memory.

---

## 5. Before launch (Waseem's checklist)

1. The ethics board (IRB) approved Prolific recruitment, the new consent text, the Prolific ID and the attention rule.
2. The four conditions are built and tested.
3. The conversion (A-G) is built and every check passes.
4. The study opens from outside the university, on https, from the Prolific link.
5. The test records are removed from the server database - both doors. **The rule for every test run (both doors,
   and Prolific's "Preview as participant"): open the study with `?condition=CVR_APA` (or `CVR_Only`, `APA_Only`,
   `Baseline`) in the address, so the run is never counted for balance** (the audit of 6 October 2026: a Preview through
   the plain Prolific link would count as a real Prolific participant). Delete or mark every test record before launch.
6. Fix 1 (the option cards' fit numbers; kept for "just before real participants") is done.
7. `docs/PREREGISTRATION_FREEZE.md` is final.
8. The codes and links of both paths are in the server's `.env`; "Preview as participant" reached the end and went
   back to Prolific.
9. The pilot of 10 is done and read: the real median time, any problems, the pay per hour. Then the main run of 160,
   opened in steps (Prolific can fill dozens of places within minutes).
10. During collection: Prolific messages daily; "Needs review" submissions within a few days.

---

## 6. Draft study description (form item 2.3)

> In this study you will make choices about difficult situations. There are no right or wrong answers; we are
> interested in how you decide.
>
> First you answer four short parts with quick choices. Then you face six situations, for example how to leave a
> town during a wildfire or how to share out a limited medicine, and you choose what to do. At the end you see a
> summary of your own choices and answer some questions about your experience.
>
> - Time: about [50] minutes. Please do it in one sitting.
> - Device: please use a computer (desktop or laptop).
> - A few simple questions check that you are reading. Please answer them as asked.
> - Some situations describe hard choices where someone is worse off whatever you decide.
> - At the end you get a completion code, and a button takes you back to Prolific.
>
> This study is part of a PhD project at Florida Institute of Technology. We never ask for your name or email.

If the four conditions differ in what people see, check that this text is true for all four.

---

## 7. Audit of this plan (1 October 2026)

**Checked.** All 28 items of the transcribed form answered. Every Prolific rule above read on Prolific's own pages
on 1 October 2026. Every change matched to the code (the email list in 4.A, the consent lines, the 35-minute rule in
dbShape.ts, the topic checks in attentionChecks.ts, the gift-card line in Block5FeedbackNudge.tsx).

**Problems found in the first draft and fixed above.**
1. A code inside the page can be read by anyone -> the server gives the Completed code; the page holds only the
   Needs-review code as a fallback.
2. The 35-active-minute pay rule is not allowed on Prolific -> information only.
3. The three checks as they are give only one valid check -> a second instruction row.
4. "You may skip questions" was untrue -> "You may stop at any time".
5. Pilot participants could join the main run -> the main run excludes the pilot study.
6. "Come back another day" clashes with the time limit -> one sitting.
7. Straightlining and rushed blocks cannot reject on their own -> they send a submission to manual review.

**Still uncertain.** Whether the server is reachable from outside the university (Waseem). The exact time limit (the
form shows it; at least 116 minutes at 50). Whether Prolific minds age, gender and country (its banned list names
direct identifiers only; low risk). Prolific's pages may change before the conversion: re-read them (section 0).

---

## 8. Decisions still open (ask only these)

1. Study name: "Human-AI Moral Value Decision-making Study" (recommended: the first page and the browser tab say it since
   4 October 2026) or a neutral name.
2. Devices: computer only (recommended), computer and tablet, or all.
3. Content warning: "Sensitive topics" (recommended) or None.
4. Country: US only (recommended; the study uses dollars) or US, UK, Canada, Australia, Ireland.
5. Pay: $10 = $12 an hour (recommended) or $12.50 = $15 an hour; final after the pilot.
6. Demographics: remove the email, keep age, gender, country (recommended), or remove all and use Prolific's file.
7. Attention: keep the topic questions as data and add a second number row (recommended), or replace the topic
   questions with instruction checks.
8. Conditions on Prolific: one study with assignment by the server (recommended) or four studies.
9. A `.gitignore` line for `Prolific docs/` (recommended yes).
10. Also needed from Waseem: the public address, the IRB status, the account funds.
