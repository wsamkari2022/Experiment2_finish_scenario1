# The daily Prolific pay check — how to do it

Since 7 October 2026. Every Prolific submission is "Manually review": nobody is paid until you approve them. This page
says how to prepare the two files each day and run the check yourself. **Never give the two files to an AI tool: they hold
Prolific IDs.**

## Your part (about 2 minutes)

1. **Make today's folder:** `Prolific docs/daily/2026-10-20/` (today's date). `Prolific docs/` never goes to GitHub.
2. **Our database, from Compass:** connect to the server (DEPLOYMENT.md, Part F) → database `VRDS2` → collection
   `participants` → **Export Data** → **Export the full collection** → **JSON** → save it in today's folder as
   **`participants.json`**.
3. **Prolific's file:** on Prolific, open the study → **Submissions** → download / export the submissions file (CSV)
   → save it in today's folder as **`prolific.csv`**.
4. **Run the check yourself**, in the project folder (the reward is $7.00: 35 minutes at $12 an hour):

```bash
npm run pay:check -- "Prolific docs/daily/2026-10-20" --reward 7
```

and two files appear in today's folder:

- **`PAY_CHECK.md`** — everybody, in groups, with the reason in words.
- **`approve_ids.txt`** — one line of Prolific IDs, separated by commas: paste it into Prolific's **bulk approve**.

## The groups

| Group | Who | What you do |
|---|---|---|
| **Pay** | Prolific says "Awaiting review", our record is finished with every answer, and none of the reasons below | Paste `approve_ids.txt` into bulk approve |
| **Pay: timed out** | Prolific says "Timed out", but our record is finished with every answer. The consent form promises: "If you finish after Prolific's time limit, we still approve and pay you when our records show that you completed the study." | Approve each one on Prolific, or pay the reward as a bonus if Prolific does not offer that. They are not in `approve_ids.txt`. Each one costs the reward plus Prolific's fee, and only $29.33 of the budget is spare |
| **Reject** (since 14 October 2026) | Failed **two or more of the four attention checks** (the two reading checks and the two "pick the number" rows). The Prolific consent page says "If you fail two or more of them, your submission will be rejected." | Reject on Prolific with the wording the report gives ("Failed attention checks"). Anything else the check found is listed beside it |
| **Look first** | The same answer to every feedback rating, or 3 or more of the six parts (Blocks 1-4, the main study, the feedback) in under 30 seconds; exceptionally fast (more than 3 standard deviations faster than the average on Prolific's own "Time taken", judged once 10 have finished); or our record began long before Prolific's clock | You decide. The report gives Prolific's own wording if you reject |
| **Problem** | The data does not match the submission: no record here, a record not finished, answers missing, the code never shown, almost no working time, or our clock far shorter than Prolific's | Usually send the person a message through Prolific first |
| **Not finished** | Returned, timed out without finishing, or still working | Nothing, unless a technical problem on our side stopped them ("Participant requests" below) |
| **Already decided** | Approved or rejected on Prolific | Nothing |

Failing **one** attention check, being slow, a wrong code, or the study's own measures are **never** reasons to reject on
Prolific. A **Problem** comes first: a record that is not finished is never judged on its attention checks. A **Problem** usually means somebody submitted without really doing the study (for example with a code
somebody else shared), or a technical fault: ask before deciding.

**Day 21:** Prolific approves a submission by itself on day 21. The report warns from day 18 ("Decide soon"). (Prolific tells researchers day 21 and tells participants 22 days, so the consent form's "22 days" is right too.)

**Pay under $8 an hour.** $7.00 is $12 an hour only at 35 minutes. At 52.5 minutes it is exactly $8, Prolific's minimum, and above
that the report starts with a bold WARNING. The consent form promises that the reward is then raised for everyone: stop opening new
places and decide before going on. A raise of $1 for 104 people costs about $139 with Prolific's fee.

## Participant requests

The consent form promises three things a person can ask for. Each one is done by hand.

- **"Show me my data."** In Compass, find the record by `prolific_pid`, export that one document, and send what they asked for
  through Prolific.
- **"Delete my data."** In Compass, delete that one document and any row in `condition_arrivals` with their `linked_prolific_pid`.
  Note the date and their Prolific ID in your private `Prolific docs/` folder. Their place in the balance opens again by itself.
- **A technical problem on our side stopped them.** The consent form promises to pay them for their time. Check their record (how
  far they got and for how long), and pay through Prolific as a bonus. It is not in the budget.

**The five-year rule.** The consent form says the answers are kept for five years after the study ends and then deleted. Write the
date in your calendar on the day the study ends, and delete the `participants` and `condition_arrivals` collections, and the
`Prolific docs/` folder, on that date.

## Privacy

The check reads only the records with a Prolific
ID, refuses to write a report that would contain an email, and never prints the completion code. Keep the daily
folders private, and delete them when the study's data plan says so.

## If it stops

- *"give the day's folder holding participants.json and prolific.csv"* — a file is missing or misnamed.
- *"the Prolific file has no "Participant id" column. Its columns are: ..."* — Prolific renamed a column. Send the
column names (never the file) to Claude; nothing is guessed.

The rules live in one place, `tools/pay_check.cjs`, and `npm run validate:pay` checks them with pretend files.
