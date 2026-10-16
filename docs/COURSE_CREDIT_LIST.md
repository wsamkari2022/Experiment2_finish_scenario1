# The course-credit list for Dr. Eskridge (CSE4301/CSE5290)

Since 16 October 2026. For Waseem. It says how to make the list of students who earned the course credit, once the
participation window closes (12 December 2026).

## The rule (from the Florida Tech consent page, submitted to the IRB on 14 October 2026)

- "I understand that the course credit is given when I complete the study."
- "Your instructor is told only whether you completed the study, never your answers."

So a student is on the list when they **finished** (they reached the thank-you page: `status` "Study Completed") by the
end of the deadline day **in Florida time**, with a **Florida Tech email** (@fit.edu, or a subdomain such as
@my.fit.edu). Nothing else decides it.

**Careful participation never takes anybody off the list.** It is saved for you only (`quality.careful_participation`,
the four OSF robustness signs: very fast in Blocks 1-3, two or more scenarios under 15 seconds, the same answer to every
feedback rating, an attention check answered wrongly), so you can see who answered carefully.

## How to make the list

1. In MongoDB Compass, open the `participants` collection of the live database and export it as JSON (all documents).
2. Save it as `participants.json` in a new folder inside `Course credit/` in this project, named by the date, for
   example `Course credit/2026-12-13/participants.json`. The `Course credit/` folder never goes to GitHub.
3. Run:

```bash
npm run credit:list -- "Course credit/2026-12-13"
```

   The deadline is 12 December 2026 unless you say otherwise: add `--deadline 2026-12-15` for another day.
4. The screen shows only counts (never an email), for example
   `on the list 41, look at 2, not finished 5; Prolific records skipped 80`.
5. Two files appear in the same folder:

| File | For | What is in it |
|---|---|---|
| `CREDIT_LIST.txt` | **Dr. Eskridge** | The email addresses of the students who earned the credit, one per line, and **nothing else** (no answers, scores, condition or dates) |
| `CREDIT_CHECK.md` | **You only** | 1. On the list: each email with the time they finished and their careful participation (Yes / No / Cannot tell, with the reasons). 2. Look at: finished after the deadline, or not a Florida Tech email - you decide. 3. Not finished: where each one stopped |

6. Decide the "Look at" group yourself. If you give one of them the credit, add their email to `CREDIT_LIST.txt` by hand.
7. Send **only** `CREDIT_LIST.txt` to Dr. Eskridge.

## Privacy

- Both files hold students' emails. Keep them inside `Course credit/` and never paste them into an AI tool (Claude
  included): the consent page says the email is seen only by the research team, and your advisor's rule (13 October
  2026) is that no file with emails or Prolific IDs goes to an AI tool.
- Records with a Prolific ID are skipped and only counted; Prolific pay has its own daily check (docs/DAILY_PAY_CHECK.md).
- The tool never changes the database.

## Checked by

`npm run validate:credit` (Z1-Z5, in the main check chain): the groups, the deadline in Florida winter and summer time,
the list holding one email per line and nothing else (the tool stops and writes nothing otherwise), no email on the
screen, and the command end to end on pretend records. The tool is `tools/credit_list.cjs`.
