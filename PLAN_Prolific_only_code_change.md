# Plan: making the study Prolific only (the code)

Written 10 November 2026, after an audit of the code. **Sections 3 to 7 were built the same day, at Waseem's request, with
Option A for decision 4** (the student version is the Git tag `before-prolific-only`). **Nothing is deployed.** Still to do, in order: the IRB's
approval, the OSF Update (with the OSF answers, hypotheses, freeze note and analysis plan), and the launch list in section 9. If the IRB changes
a word of the consent form, change `docs/PROLIFIC_CONSENT_FORM_TEXT.txt` and `src/experiment/ConsentPage.tsx` together and move `PROLIFIC_CONSENT_VERSION`.

## 1. The order of the whole job

1. The IRB approves. Use the consent text the IRB approved, not an older copy. If the IRB wants its approval number on the page, add it.
2. The OSF Update: answers, hypotheses, freeze note, analysis plan.
3. The code: sections 3 to 7 of this plan.
4. The live test: section 8.
5. The launch list: section 9.

## 2. What a participant will see change

| Who | Today | After |
|---|---|---|
| Comes by the Prolific link, all four conditions | A short payment part on the consent page | The consent page is the approved text. **This is the only change for them.** |
| Opens the main address | The student email page | The "paste your Prolific ID" page (Waseem's 3-A) |
| Opens the Prolific address with no ID | Gets a condition first, then the paste page | Paste page first, and a condition only after the ID |

The four conditions, the blocks, the scenarios and every score stay the same.
**Baseline still has no fit score and no "Ranked N - why" section. This plan does not change that.**

## 3. The pages

| File | What changes |
|---|---|
| `src/experiment/ConsentPage.tsx` | Delete the student text, the "At Least 35 Minutes" box (`TakeYourTime`), the two student tick boxes and the `door` choice. The Prolific text becomes the approved form, word for word. Missing today: the US$12 sentence, "total reward is shown", the three "complete the study" lines, the whole "How Prolific pays" list, the three Prolific help links, the five-year sentence, and "ask to see or delete your data". New `PROLIFIC_CONSENT_VERSION`. |
| `StartScreen.tsx`, `NotYouLink.tsx` | Delete both files. Also their lines in `ExperimentFlow.tsx` and `App.tsx`. |
| `ExperimentFlow.tsx` | The first page is always the Prolific one. Remove the door choice (lines near 327). A saved condition file from the student door is dropped. A browser that holds an email from an old test run starts fresh and never crashes. |
| `LandingPage.tsx` and the start of `ExperimentFlow.tsx` | **No condition before a Prolific ID exists.** With no ID in the address, show the paste page first, then the landing page. |
| `recruitment.ts` | The door is always Prolific. Delete the helpers only the student door used (`universityRunHeld`, `maskEmail`, and the "login kind" note). |
| `DemographicPage.tsx` | Always four questions. Remove `askEmail` and the email box. |
| `SessionLockScreen.tsx` | Remove the "email and age" words. |
| `Block5FeedbackNudge.tsx`, `UserFeedbackPage.tsx` | Remove the course-credit sentences. |
| `attentionChecks.ts` | One plan only (two reading checks and two number rows). New `ATTENTION_VERSION`. |
| `dbShape.ts` | `course_credit_earned` and its notes go. `careful_participation` stays. New `SHAPE_VERSION`. |
| `apiClient.ts`, `storage.ts` | Remove every "if nothing is known, say university". |
| `StudyErrorBoundary.tsx` | Add "or send a message through Prolific" beside the researcher's address. |
| `src/components/dev/` | Delete, with its import and line in `UserFeedbackPage.tsx`, before launch. |

**The rule for this section:** no line may be left that says "if we do not know, treat this person as a student". A check searches for that (section 6).

## 4. The server

| File | What changes |
|---|---|
| `server/recruitment.js` | A key that is not a Prolific ID is refused. Remove the "university" default. |
| `server/index.js` | Every route that takes a key answers 400 for an email. Remove email from the sign-in fields. |
| `server/conditions.js` | One group for the balance. The count page shows one table. |
| `server/db.js` | No change. The rule on emails does no harm when no email is ever written. |
| `build-and-run.sh` | **Stop the deploy if the Prolific completion code is missing.** Today it only warns, because the student version could run without it. Without the code, every person who finishes waits forever. |

## 5. The tools

- `tools/pay_check.cjs`:
  - A new group, "Pay: timed out". Today somebody who finished after Prolific's time limit gets "nothing to pay", and that breaks a promise in the consent form.
  - A warning when the median time pushes the pay under US$8 an hour.
  - A note for people who returned the study.
  - Prolific's automatic approval: the tool says day 21 and the consent form says 22 days. Check Prolific's page and make the two agree.
  - The example becomes `--reward 7`.
- `docs/DAILY_PAY_CHECK.md`: Waseem runs the tool himself (remove "tell Claude"). Add a "Participant requests" part: how to see or delete one person's data, and how to pay somebody stopped by a technical problem. Add the five-year deletion date.
- Delete `tools/credit_list.cjs`, `tools/validate_credit_list.cjs`, `docs/COURSE_CREDIT_LIST.md`, and `validate:credit` and `credit:list` in `package.json`, also inside the `validate:block5` chain.
- Change $8.75 to $7.00 everywhere it is left.

## 6. The checks

About 200 lines in the checks name students or emails. Many checks pretend to be a student, so they must learn to pretend to be a Prolific person.

- Most work: `validate:session` (C12, C13), `validate:attention` (T4, T9, T10), `validate:conditions` (N25), `validate:journey` (J18), `test:load` (L1-L5).
- Deleted whole: C14 ("Not you?"), Z1-Z5 (the credit list).
- **New checks:**
  1. No student words and no "university" default anywhere in `src/` or `server/`.
  2. The main address shows the paste page.
  3. No condition is given before an ID exists.
  4. The server refuses an email on every route.
  5. The whole Prolific consent page, word for word, against the approved form.
  6. The pay tool: timed out, under $8, the approval day.
  7. The deploy script stops with no code.
- Every new or changed check is broken on purpose once, to prove that it can fail.
- Then the full chain: `npm run typecheck && npm run lint && npm run validate:block5 && npm run build`, and `npm run test:load`.

## 7. The written files

Rebuild, never edit by hand: `make_feedback_questions_docx.py`, `make_accuracy_checklist_docx.py`.
Update: `CLAUDE.md` (a new "Prolific only" section, and old sections marked as history), `DEPLOYMENT.md`, `docs/ANALYSIS_AND_FIGURES_PLAN.md`, `docs/PREREGISTRATION_FREEZE.md`, `docs/PROLIFIC_CONVERSION_PLAN.md`, `docs/PROLIFIC_CONSENT_FOR_ETHICS_BOARD.md`, `docs/FRESH_EYE_AUDIT.md`, `Generated Outputs/HOW_TO_ANALYZE_MY_DATA.md` (a dated row in 4.9), `Generated Outputs/HOW_TO_READ_MY_DATABASE.md`, the writer's files. Screenshots that show course-credit words must be taken again.

## 8. The live test

On a separate test address, with the test browser's storage restored afterwards:

1. The Prolific link in all four conditions, to the end, with the code on the last page.
2. The main address with no ID: paste page, and the count page shows nobody counted before the ID.
3. A browser that holds an old email run: it starts fresh.
4. The consent page: a computer and a 375px phone, light and dark. Open all three Prolific help links.
5. The server with an email key: refused.
6. Waseem's own test runs now use a made-up Prolific ID in the link, with `&condition=` added.

## 9. The launch list (in this order)

1. A saved copy of the code with the students in it, by a Git tag, made before the first change.
2. Back up the database.
3. Put the Prolific completion code in the server's `.env`.
4. Deploy the page and the server together. `/api/health` must say the code is set.
5. Waseem deletes the test records.
6. One Prolific "Preview" run to the end, pressing "Return to Prolific".
7. The first batch of 40 places. **Read the median time before opening the rest.**

## 10. Limits to remember

- **Pay.** $7.00 is $12 an hour only at 35 minutes. At 50 minutes it is $8.40 an hour, at 52.5 minutes $8.00, at 55 minutes $7.64. Earlier estimates of the study were 40 to 55 minutes. A raise of $1 for 104 people costs about $139 with the fee, and only $29.33 is spare.
- **The paste box.** Anybody can type a made-up ID. They are never paid, and the pay check lists them as "not in Prolific's file". Each one must be deleted, or the balance is off by one.
- **Technical-problem payments and raises** are promised in the consent form and are not in the budget.
- **After the change, students cannot be added without restoring the code** from the Git tag.

## 11. Decision 4: open

How deep to remove the student code. A: remove everything a student could touch and every path to it, and keep the old inside name `email` on the box that already holds the Prolific ID. B: all of A, and also rename that box everywhere (about 100 more lines). Participants and the database are the same under A and B. Recommended: A.
