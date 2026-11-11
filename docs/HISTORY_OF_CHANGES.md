# History of changes moved out of CLAUDE.md

Moved word for word from `CLAUDE.md` on 11 November 2026 (the researcher's decision D3), so that every session reads only
today's rules there. **Everything below is history:** it describes versions nobody took part in (the student door, the
course credit, the gift card, the first Prolific price) or plans that were all built. Today's study: CLAUDE.md, section
"Prolific only (since 10 November 2026)".

## Two doors (6 October to 10 November 2026; HISTORY: see CLAUDE.md, "Prolific only")

The researcher: two versions, "the first version is as it is right now (log in through email), and the other one will be
the Prolific version", because he also wants FIT students and employees. Plan answers "1-A" (one website, two doors),
"2-A" (each door balanced on its own), "4-A" (the Prolific demographic page without the email), and for Step 1 "1-A" (a
returning Prolific person continues with no question; **since 7 October 2026 "1-B": on ANOTHER device they are asked their
age**, see the next section), "2-A" (a welcome page with the ID and Start), "3-A" (deploy only
after Step 4, with a database backup first). **Participants see it** (HOW_TO_ANALYZE 4.9, 9.8).

- **The doors** (`recruitment.ts`; the server's twin `server/recruitment.js`, C13 holds them together):
  https://moonlander.fit.edu is the university door, **unchanged**; `/prolific`, or a `PROLIFIC_PID` in the link, is the
  Prolific door. Once somebody is known, their key decides; before that a Prolific address wins over a condition nobody
  owns yet (the live check found an unowned university condition keeping a Prolific arrival at the wrong door).
- **The key.** The browser carries "the participant's key" where it always carried the email (`DirectoryEntry.email`,
  `vrds_pending_email`, every owner): an email, or a Prolific ID (letters and digits, 8-64; Prolific's help pages do not
  state the format, in practice 24 hex; an email always has an @, so the two never mix). The SERVER stores a Prolific ID
  as `prolific_pid`, never in `email`: `whoIs(key)` in every route (`/:key/...`), `identityOnInsert` on a new record
  (with `recruitment_source`), `prolificIdsFrom` for Prolific's `STUDY_ID` / `SESSION_ID` (`prolific_study_id`,
  `prolific_session_id`; never the study's own `participant_id`). The API client sends `prolificPid`, never `email`.
- **The Prolific first page** (`ProlificStartScreen.tsx`): the university page's welcome and study name word for word,
  "Your Prolific ID" with the ID, and Start (new), "Welcome back" + Continue where I stopped (no question), or "You have
  already finished" (since 7 October 2026 with "Your age" to see the completion code again: "The Prolific completion code"); a paste box when the link has no ID (written into the address). It waits
  for the server check before looking the person up (the live check: asked earlier, a finished person read "new").
- **"A little about you"** in the Prolific door: four questions, no email (`askEmail={false}`); the record names its key
  as `prolificPid` with the door and Prolific's two ids. The university door: five questions, as before.
- **Balance per door** (`server/conditions.js`): `tally(..., door)`; the landing page sends its door, the arrival row
  keeps it (`recruitment_source`), a Prolific arrival is linked by `linked_prolific_pid`; a record or arrival from before
  has no door and counts as the university's. The count page shows one table per door.
- **The database rules** (`server/db.js`): "one email = one person" now covers only records WITH an email (a partial
  index; the old one treated "no email" as one shared value and would refuse the second Prolific person), plus "one
  Prolific ID = one person". The old index is replaced at startup, before the server listens; **without that swap the
  server could not start** on a database with the old rule (a deliberate break proved it).
- **Found and fixed on the way:** a queued save found its owner only when it was SENT, so a save waiting for the server
  could land on whoever started next on that computer (now stamped when made: `sendOrQueue`, `saveSection(path, data,
  owner)`); a second person on a shared computer would have reused the first one's session id, refused by the unique
  `participant_id` rule - a DIFFERENT Prolific ID in the link now sets the other person's run aside before the page reads
  anything (`makeRoomForAnotherProlificId`; the machine's files, the list of people and the unsent saves stay).
- **"Not you?" on the university door** (the audit, the researcher's "4-Yes"; `NotYouLink.tsx` in App): on a shared
  computer the browser reopened the first student's run or thank-you page and a second student could not start. When the
  page OPENS with a university run in the browser, a thin strip at the top (above the progress bar, so it covers
  nothing; floating at the bottom it covered Block 1's first button in the live check) says "This study is open for
  w•••@my.fit.edu. Not you?" (`maskEmail`); it goes once the person moves to another page (the stage changes) or with ×.
  "Not you?" asks to confirm, then `setAsideThisBrowsersRun()` (the rule a different Prolific ID uses: the machine's files,
  the list of people and the unsent saves stay) and the plain university address opens afresh; the first student
  continues later with their email and age. Not shown on the page that reloads right after somebody proved who they are
  (`loginKindNoted()`, read before the flow clears it). Never in the Prolific door. Nothing recorded.
- **The audit of 6 October 2026** (the researcher: "fully audit your work ... from several perspectives"): seven findings,
  answers "1-Yes, 2-A, 3-Yes, 4-Yes". Fixed: a resumed Prolific person's condition file lost its door (F1; the record was
  right, `major_info_and_scores.condition` said "university"); `quality.compensation_eligible` is documented as the
  university gift-card rule, never a Prolific pay verdict (F3); the Prolific first page uses the ID the browser knows when
  the link lost it (F4); `connectLate` reads the entry again after its wait, so a completion made meanwhile is sent (F5);
  an unowned condition from the other door is dropped either way and the address forgets it (F6); every test run, also
  Prolific's Preview, uses `?condition=` and test records are deleted before launch (F7, the launch list). **F2 was the
  next step, fixed on 7 October 2026** (the next section): `/api/participants/lookup` returned the WHOLE record (answers,
  age) to anyone who knew a key, so "email and age" was weaker than it looked and a Prolific ID alone opened a record. C12 and C13 extended, C14 new;
  12 breaks, 12 caught. Live: the doors both ways, "Not you?" (start afresh, the first student's record intact, a new
  session id, the first student back in with email and age), the strip gone on moving on, a resumed Prolific person's
  condition file "prolific", a link without the ID recognised; three found and fixed in that check: the floating note
  covered Block 1's first button (now a strip above the progress bar), it asked "Not you?" right after a sign-in, and a
  phone broke the masked email mid-word.
- **All five steps built on 7 October 2026** (Steps 2-3, the consent page and the second number row; Step 4, the end page
  with the code; Step 5, the daily pay check): the next three sections. Left before Prolific: the ethics board, the
  deploy with the code in the server's `.env`, and one Prolific Preview run to the end (docs/PROLIFIC_CONVERSION_PLAN.md 5). The visit log says
  `arrived_with_their_prolific_id` in the Prolific door. `SHAPE_VERSION` "2026-10-06-two-doors"
  (`major_info_and_scores.condition.recruitment_source`).
- **Checked:** `validate:session` C13 (new) with C2, C8 and C11 taught the new routes and page; `validate:conditions` N25
  (new) with N3, N6, N9, N10, N23 and N24 taught the doors; `npm run test:load` L5 (100 students and 100 Prolific people
  at once: 25 per condition inside each door; every Prolific record under `prolific_pid` with no email) and L6 (the rule
  swap on a copy with today's rule; the old record kept). 17 deliberate breaks, 17 caught. Live on the built site with a
  throw-away database: the university door unchanged; a Prolific link opened the Prolific first page; Start, consent,
  four questions, Block 1, and a record with `prolific_pid`, no email, the door and both ids; a refresh continued; a
  second browser with the same ID continued with no question and the first one locked ("Your newest answers will be
  brought here."); a different Prolific ID on that browser started fresh (new session id, the machine's files kept); the
  paste box (a wrong ID refused calmly); a finished ID read "You have already finished"; a 375px phone, light and dark; the
  count page with both doors. All test storage and databases removed.

## The study's length and the Prolific price (7 October 2026)

**Since 9 November 2026 the price is $7.00 ($12 an hour, 104 people; see "Prolific only"); the figures below are history.** The researcher: "make the consent form in both doors that the minimum time for this study is 35 minutes", and on
Prolific's page he set **35 minutes and $8.75 ($15.00 an hour)**; with the 33.3% academic fee each finished person costs
$11.67 (80 people = $933.33 on Prolific's page, no VAT), and the budget is **$1,000** (at most 85 people).
**Participants see it** (HOW_TO_ANALYZE 4.9).

- **Both consent pages** say "The whole study takes **at least 35 minutes**" (one shared sentence; it said "about 40 to 55
  minutes"). `CONSENT_VERSION` "2026-10-07-35-minutes", `PROLIFIC_CONSENT_VERSION` "2026-10-07-prolific-35-minutes"
  (stored with every consent record). docs/PROLIFIC_CONSENT_FOR_ETHICS_BOARD.md updated; **the university consent changed
  too, so ask the ethics board** whether that change needs approval. The university gift-card rule (35 active minutes)
  was unchanged; since 16 October 2026 there is no gift card and no minutes rule (course credit on completion).
- Prolific shows a maximum time of 67 minutes at a 35-minute estimate and asks for an additional payment when the real
  median exceeds the estimate: the Preview run and the first batch should be read for the median.
- **Checked:** `validate:attention` T10 (the sentence in both doors, "40 to 55" gone, both stamps moved); 4 deliberate
  breaks, 4 caught. Live on the built site: both doors' consent pages, and the record saved the new stamp.
- **Pay by progress** (the advisor's idea, 7 October 2026): analysed, not built; the researcher's concerns and the options
  are in the deck for his advisor. Nothing in the study pays partial amounts.

## The university door: course credit (16 October to 10 November 2026; HISTORY: see CLAUDE.md, "Prolific only")

The IRB modification of 14 October 2026 (submitted the same day; the OSF preregistration too) replaced the university door's
$5 gift card with course credit for CSE4301/CSE5290. The researcher: "modify the Student door first", plan answers "1-yes"
(credit is given on completion; behaviour is recorded for the researcher only), "2-yes" (careful participation = the four
OSF robustness signs), "3-yes" (the thank-you line), "4-yes" (late finishers and non-Florida Tech emails are kept off the
instructor's list and shown to the researcher), and earlier "1-A" (build now, **deploy only after the IRB approves**), "2-Yes
keep, and you can turn it into course credit verdict", "3- Yes" (the course-credit email tool). **Participants see it**
(HOW_TO_ANALYZE 4.9). No score changed. The Prolific door is untouched (its consent changes are the next step).

- **The consent page, university door** (`ConsentPage.tsx`, `CONSENT_VERSION` "2026-10-16-course-credit"): word for word the
  Florida Tech consent submitted to the IRB - a "Course Credit" panel (50 points averaged into the assignments grade, an
  alternative assignment for the same 50 points, "Your instructor is told only whether you completed the study, never your
  answers."), "What completes the study: Reach the end." (the gift card's five rules are gone, the 35 active minutes among
  them), the email "to give your course credit", "Questions with answer choices need an answer before you can move on ...
  you may stop at any time." (it said "you may skip questions", untrue), withdrawal "does not affect your grade", and two tick
  boxes ("... receive my course credit." and "I understand that the course credit is given when I complete the study, and
  that I may complete an alternative assignment instead."). `compensation_rules_agreed` keeps its name (it now records the
  second box). `validate:attention` T10 compares the page with the submitted text; live, all 33 paragraphs and 12 headings of
  the submitted .docx were found on the page.
- **Other words participants see:** the start page "Please use your Florida Tech email address. It is used only to save your
  place and to give your course credit."; the demographic page's email help (shown only when the start page did not ask)
  "... to give your course credit when you finish. Nothing else."; the results page's "One last step" card "Answering them
  completes the study, which you need for your course credit."; and on the thank-you page, **university door only**, "If you
  are taking part for course credit, your completion is recorded." (`data-course-credit-line`; the Prolific door shows its
  code card instead). No "$5", "gift card" or "active minutes" is left on any page a participant sees (J18).
- **The verdicts** (`buildQuality` in dbShape.ts, now also given `blocks1to4` and the door by storage.ts):
  `quality.course_credit_earned` = `completed_the_study` in the university door (null in the Prolific door) and NOTHING else
  decides it; `quality.careful_participation` (for the researcher only, never shown, never used for credit or pay) is false
  when any of the four OSF robustness signs is present - answered very fast in Blocks 1-3 (`blocks_1_to_4_checks.
  answered_very_fast`), two or more scenarios under 15 seconds, the same answer to every feedback rating, an attention check
  answered wrongly - null when a sign cannot be read, true otherwise; `careful_participation_reasons`, `_cannot_tell` and
  `_signs` (each sign with `flagged` true / false / null and a detail). `active_minutes`, `study_length_estimate_minutes` (35,
  `STUDY_LENGTH_ESTIMATE_MINUTES`, was `REQUIRED_ACTIVE_MINUTES`) and `under_the_estimated_length` are information. **Gone:**
  `compensation_eligible`, `reasons`, `rule`, `required_active_minutes`, `met_time_requirement` (no real data was made under
  them). The rushed parts, the attention fields and the Prolific fields are unchanged. `SHAPE_VERSION`
  "2026-10-16-course-credit".
- **The course-credit list** (`npm run credit:list -- "Course credit/<date>" [--deadline 2026-12-12]`, `tools/credit_list.cjs`;
  it reads `participants.json` with the pay check's own reader): `CREDIT_LIST.txt` for the instructor, the emails of the
  students who finished ("Study Completed") by the end of the deadline day in Melbourne, Florida (EST or EDT, whichever
  applies) with a Florida Tech address (@fit.edu or a subdomain), one per line and NOTHING else (it stops, writing nothing,
  if a line would hold anything but one email); `CREDIT_CHECK.md` for the researcher only: each student's finishing time and
  careful participation, the ones to LOOK AT (finished late, or not a Florida Tech address: he decides), and who did not
  finish. Careful participation never takes anybody off the list. Records with a Prolific ID are skipped; the console prints
  counts only, never an email; `Course credit/` is git-ignored. Never run it through an AI tool: the files hold emails.
- **Checked:** `validate:attention` T4 (credit = completion only, in the university door only; each sign and its reason; "cannot
  tell"; the gift-card fields gone; storage.ts passes `blocks1to4` and the door) and T10 (the submitted consent text, the
  version stamp); `validate:dbshape` D70 (the rushed rule never touches the credit); `validate:journey` J9, J14 and new J18 (no
  gift card, $5 or active minutes on any page a participant sees; the four sentences; the thank-you line in the university
  door only); `validate:session` C16; new **`npm run validate:credit`** (`tools/validate_credit_list.cjs`, Z1-Z5: the groups,
  the Florida deadline in winter and summer time, the list holding emails only, no email on the screen, the command end to
  end; in the chain before `validate:position`; a check that stops is a failed gate, never a crash). 19 deliberate breaks,
  19 caught (two only after Z2 and Z3 learned to turn a crash into a failure). Live on a separate test address (port 5174,
  its storage restored exactly, nothing written to the database): the start page, the consent page against the submitted
  .docx, the demographic page, and the thank-you page in both doors (the line in the university door only; a 375px phone,
  no sideways scroll).
- **Deploying:** only after the IRB approves the modification. The page only (the server does not read these fields).
- **The "At Least 35 Minutes" request box** (the same day; the researcher: "make a new separate box ... ask the student not
  to rush ... answer genuinely", then "make it general for everything", "1-OK 2-yes"): in the Prolific door careful work is
  part of being paid; in the university door it is optional, so one grey box asks students for the same care
  (`TakeYourTime` in ConsentPage.tsx, `data-take-your-time`, right after "The whole study takes at least 35 minutes" and
  before "You Can Stop and Come Back"; **university door only**): "At Least 35 Minutes" with an "A request" tag, four short
  lines with their own icons - "Take your time. Please do not rush through the pages." / "Read carefully. Read each page fully before you answer." / "Answer as you genuinely would, not as you think you should." / "A few short questions check that you are reading. Please answer them as they ask." / "Careful, genuine answers are what make this research meaningful. This is only a request: your course credit is given when you complete the study." The reading-check line ("2-yes") tells students what Prolific's consent
  tells its people (that the checks exist, never what they ask), so "an attention check answered wrongly" means the same in
  both groups. **Never in the box:** positions, roles or who decides for whom (the researcher: no hint of the position
  effect before the main study), values, consistency, keeping or changing a choice, the options ("read all the options"
  would change the card-order effect, hypothesis C7, in one group only), "one sitting". `CONSENT_VERSION`
  "2026-10-16-take-your-time"; nothing new is recorded. **The researcher sends it to the IRB as a small change to the pending
  modification** (`Downloads/Consent forms/Ready to upload (16 October)`: the clean form, the form with the box highlighted,
  both as PDF, and a note for the IRB office). Checked: T10 (the words letter by letter, four lines, grey with "A request",
  shown once and in the university door only, between the length and "You Can Stop and Come Back", the credit line, no
  design word); 13 deliberate breaks, 13 caught. Live (port 5174, storage restored exactly, nothing written to the
  database): the box in place in dark and light mode and on a 375px phone (no sideways scroll); none in the Prolific door;
  agreeing saved `consent.version` "2026-10-16-take-your-time".

## Prolific: how it was planned (1 to 7 October 2026; all of it was built)

**Decided 6 October 2026** (the researcher, after his advisor): TWO versions on one website - the email version as it
is for FIT students and employees at https://moonlander.fit.edu, and a Prolific version at
https://moonlander.fit.edu/prolific ("1-A"); the conditions balanced within each group on its own ("2-A"); the second
"pick the number" row in the Prolific version only ("3-B"); the Prolific demographic page without the email only
("4-A"); `Prolific docs/` in .gitignore ("5-yes", done); the first Prolific batch 40 places ("6-40"). **No pilot**
(budget: every participant's data is kept). **Every Prolific submission is "Manually review"** (one completion code,
on the server only); every day the researcher exports the participants collection (Compass, JSON) and Prolific's
submissions file into `Prolific docs/daily/`, and Claude says which Prolific IDs to pay, which to look at and which did
not finish, by Prolific's own valid reasons only. Build order: Step 0 (done, above), Step 1 the two doors and the
Prolific ID (done, "Two doors" above; it took the demographic page without the email), Step 2 the consent page and Step 3
the number row (both done 7 October 2026, with the privacy fix), Step 4 the end page with the code and Step 5 the daily pay check
(both done the same day: "The Prolific completion code", "The daily Prolific pay check").

The study will be recruited on Prolific, but only AFTER the four conditions are built and tested (the researcher's
order, 1 October 2026). The full plan - Prolific's rules with their sources, the answers for Prolific's study form,
every place the email is the participant's key, the consent, demographics, completion-code and attention-check changes,
the checks to add, the audit and the decisions still open - is `docs/PROLIFIC_CONVERSION_PLAN.md`. Read it before
changing identity, consent, the demographic page, the thank-you page, attention checks or any payment wording, and
build the conditions so they read "the participant's key" rather than the email. Never commit `Prolific docs/`: it
holds the Prolific completion code.
