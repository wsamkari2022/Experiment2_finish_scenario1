# Coherence checklist

Run these checks with searches and scripts, not by memory. Each fact below was true on 11 November 2026;
check it against its source before using it, because it may have changed since.

## The key facts and where each one lives

| Fact | Today | Source of truth | Must agree in |
|---|---|---|---|
| Recruitment | Prolific only; one group | `server/recruitment.js`, `src/experiment/recruitment.ts` | CLAUDE.md, HOW_TO files, analysis plan, IRB, OSF, consent |
| Sample | 104 who finish, 26 per condition; enrollment 150 | the IRB text | analysis plan, freeze note, OSF, hypotheses file |
| Pay | $7.00 for 35 minutes ($12 an hour); $9.33 with Prolific's 33.3% fee; 104 people = $970.67 of the $1,000 budget | the consent form; Prolific's page | `docs/DAILY_PAY_CHECK.md` (`--reward 7`), IRB, OSF |
| Pay floor | $8 an hour = 52.5 minutes at $7.00 | arithmetic | pay check (bold warning), consent promise |
| Conditions | 1 CVR+APA, 2 CVR_Only, 3 APA_Only, 4 Baseline (`BSL4` in the address, `Baseline` in the database) | `src/experiment/conditions.ts` and `server/conditions.js` (check N1) | every document |
| **Baseline** | **no fit score and no "Ranked N - why" section**, no reflection or clarification page, one confirmation page with "How sure" | `conditions.ts` rules | every description of Baseline, in bold |
| Scenarios | 6: 1-4 decisions, 5 a wish, 6 the rule behind the veil | `block5Scenarios.ts` | every document |
| Values | 7: 4 policy values and 3 sensitivities | `thresholdTree.ts` | every document |
| Attention checks | 4 for everybody (2 reading checks at random places, 2 "pick the number" rows); 2 or more failed = rejected on Prolific | `attentionChecks.ts`, `ATTENTION_VERSION` | consent form, HOW_TO_READ 6p, pay check, IRB |
| Hypotheses | 23 (A1-D5); primaries A1, B1, C1, D1, Holm together; secondaries Holm within family | the IRB text | analysis plan 11.1, freeze note 5.1, hypotheses file, OSF answers and Word file |
| Analysis sample | every participant who completed; non-completers excluded; checks reported beside the main results | the IRB text | analysis plan, HOW_TO_ANALYZE 2, freeze note, OSF |
| Power (one-way ANOVA, 4 groups, α = .05) | 104 people: .93 for f = .40, .54 for f = .25; 76 and 180 people for .80 | the IRB text; rechecked by simulation | analysis plan, OSF, hypotheses file |
| Versions | `SHAPE_VERSION` and `ATTENTION_VERSION` "2026-11-10-prolific-only"; consent "2026-11-10-prolific-only-12-an-hour" | the code | HOW_TO_READ, HOW_TO_ANALYZE 7, analysis plan 2.5 |
| Days | Prolific approves by itself on day 21 (researchers' page); 22 days (participants' page) | Prolific's help pages | pay check guide, consent form |

## Field names
- [ ] Every field a document calls current exists in a pretend record (`node tools/validate_dbshape.cjs
      --dump=<file>`) or in the code that writes records (`dbShape.ts`, `server/*.js`).
- [ ] A removed field is named only as "gone since <date>" (for example `quality.course_credit_earned`,
      `analysis.attention_checks.door`, `linked_email`).

## Words
- [ ] No word of a removed feature is written as today: student, university door, two doors, course
      credit, gift card, "Not you?", `StartScreen`, `credit:list`, "about 154".
- [ ] The same name for the same thing: CVR+APA, CVR only (`CVR_Only`), APA only (`APA_Only`), Baseline;
      "the reflection (CVR)"; "the clarification (APA)"; "the CVR Rejection page"; "the Baseline
      confirmation page"; "the MCF reading"; "the card planner".
- [ ] The study's name: "Human-AI Moral Value Decision-making Study" on the first page and in recruitment;
      the consent form's "Study Title" is as the IRB has it.

## Checks and commands
- [ ] Every check named in CLAUDE.md's table describes what that check checks today (read the header of
      the tool in `tools/`).
- [ ] Every `npm run` command a document names exists in `package.json`.

## Registered text
- [ ] The hypotheses and analysis rules in every copy match the IRB text word for word (a script, not the
      eye).
- [ ] A copy that waits for the OSF Update carries a dated "pending" note beside it.
