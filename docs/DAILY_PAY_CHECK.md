# The daily Prolific pay check — how to do it

Since 7 October 2026. Every Prolific submission is "Manually review": nobody is paid until you approve them. This page
says how to prepare the two files each day; Claude then runs the check and explains the result.

## Your part (about 2 minutes)

1. **Make today's folder:** `Prolific docs/daily/2026-10-20/` (today's date). `Prolific docs/` never goes to GitHub.
2. **Our database, from Compass:** connect to the server (DEPLOYMENT.md, Part F) → database `VRDS2` → collection
   `participants` → **Export Data** → **Export the full collection** → **JSON** → save it in today's folder as
   **`participants.json`**.
3. **Prolific's file:** on Prolific, open the study → **Submissions** → download / export the submissions file (CSV)
   → save it in today's folder as **`prolific.csv`**.
4. **Tell Claude:** "pay check 2026-10-20" (the reward is $8.75 since 7 October 2026).

Claude runs:

```bash
npm run pay:check -- "Prolific docs/daily/2026-10-20" --reward 8.75
```

and two files appear in today's folder:

- **`PAY_CHECK.md`** — everybody, in groups, with the reason in words.
- **`approve_ids.txt`** — one line of Prolific IDs, separated by commas: paste it into Prolific's **bulk approve**.

## The groups

| Group | Who | What you do |
|---|---|---|
| **Pay** | Prolific says "Awaiting review", our record is finished with every answer, and none of the reasons below | Paste `approve_ids.txt` into bulk approve |
| **Look first** | Failed **both** "pick the number" rows; the same answer to every feedback rating, or 3 or more of the six parts (Blocks 1-4, the main study, the feedback) in under 30 seconds; exceptionally fast (more than 3 standard deviations faster than the average on Prolific's own "Time taken", judged once 10 have finished); or our record began long before Prolific's clock | You decide. The report gives Prolific's own wording if you reject |
| **Problem** | The data does not match the submission: no record here, a record not finished, answers missing, the code never shown, almost no working time, or our clock far shorter than Prolific's | Usually send the person a message through Prolific first |
| **Not finished** | Returned, timed out, or still working | Nothing |
| **Already decided** | Approved or rejected on Prolific | Nothing |

Failing **one** number row, being slow, a wrong code, or the study's own measures are **never** reasons to reject on
Prolific. A **Problem** usually means somebody submitted without really doing the study (for example with a code
somebody else shared), or a technical fault: ask before deciding.

**Day 21:** Prolific approves a submission by itself on day 21. The report warns from day 18 ("Decide soon").

## Privacy

The Compass file also holds the university participants' emails. The check reads only the records with a Prolific
ID, refuses to write a report that would contain an email, and never prints the completion code. Keep the daily
folders private, and delete them when the study's data plan says so.

## If it stops

- *"give the day's folder holding participants.json and prolific.csv"* — a file is missing or misnamed.
- *"the Prolific file has no "Participant id" column. Its columns are: ..."* — Prolific renamed a column. Send the
  message to Claude; nothing is guessed.

The rules live in one place, `tools/pay_check.cjs`, and `npm run validate:pay` checks them with pretend files.
