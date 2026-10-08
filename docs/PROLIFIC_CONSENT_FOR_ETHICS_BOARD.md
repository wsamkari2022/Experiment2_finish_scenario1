# The Prolific version's consent page, for the ethics board

Written 7 October 2026. The study now has two versions on one website:

- **The university version** (https://moonlander.fit.edu): FIT students and employees, who sign in with their email and
  receive a $5 Amazon gift card. Its consent page is **unchanged, word for word** (version `2026-09-14b`).
- **The Prolific version** (https://moonlander.fit.edu/prolific): Prolific participants, paid through Prolific and
  identified only by their Prolific ID. Its consent page is the same page with **eight parts changed**, because
  Prolific's rules differ (version `2026-10-06-prolific`, saved with every agreement).

**Approval is needed before the Prolific version is opened to participants:** recruitment through Prolific, the new
consent text below, storing the Prolific ID, and the attention-check rule.

## What stays the same in both versions

These sections have the same words in both versions: the header ("Informed Consent"), Study Title, Purpose of the Study,
What You Will Do (the five parts and the guess about the participant), the time ("at least 35 minutes"; it said "about 40
to 55 minutes" in both versions until 7 October 2026, so the university version changed here too), Possible
Risks, Possible Benefits, and Who to Contact With Questions (the researcher and the IRB).

## The eight parts that differ

| # | University version (unchanged) | Prolific version | Why |
|---|---|---|---|
| 1 | "... at least 35 minutes. You do not have to finish in one sitting — see below." | "... at least 35 minutes. Please complete it in one sitting — see below." | Prolific gives each submission a time limit |
| 2 | **You Can Stop and Come Back**: close the study and continue later, even on a different computer | **One Sitting, Within Prolific's Time Limit**: "Please complete the study in one sitting, within the time limit Prolific shows you. If the page closes by accident, open the study again from Prolific: you will continue from where you stopped." | Same reason |
| 3 | **Your $5 Amazon Gift Card**, and what earns it: reach the end; at least 35 minutes of active work; time counts only while working; answer thoughtfully; answer the attention checks as asked | **Your Payment Through Prolific**: "Everyone who completes the study is paid through Prolific, the amount shown in the study on Prolific. Every submission is reviewed before it is paid." What completes it: **Reach the end** ("Answer the feedback questions and arrive at the final page. There you receive your completion code, and a button takes you back to Prolific."); **Answer the attention checks as asked** ("A few simple questions check that you are reading. If you fail two or more of them, your submission may be rejected."); **Answer thoughtfully** ("A submission that shows clear low effort throughout, such as the same answer to every question, may be rejected.") | Prolific pays. Prolific does not allow refusing payment for time spent or for the researcher's own measures, so there is no minutes rule (working time is still measured, for the analysis). Prolific allows rejection only after two failed attention checks |
| 4 | **Privacy and Your Email**: confidential, not anonymous; the email is collected to let the person return and to send the gift card | **Privacy and Your Prolific ID**: "We never ask for your name or your email. Your answers are stored with your Prolific ID, which we use only to pay you and to let you continue if the page closes. Your Prolific ID is seen only by the research team and is never shown to anyone else taking part. Your answers are analyzed and reported as group results, so no individual can be identified in anything we publish. Data is kept on secure, password-protected storage accessible only to the research team." | No email is collected in this version |
| 5 | Taking Part Is Voluntary: "... There is no penalty for not taking part, and you may skip questions you do not wish to answer." | "Your participation is completely voluntary. There is no penalty for not taking part: if you decide not to, please return the study on Prolific." | Every question in the study must be answered, so "you may skip questions" would be untrue there; returning the study is Prolific's normal way to leave |
| 6 | Your Right to Withdraw: "... contact the researcher below and it will be deleted." | "You may stop at any time, without giving a reason and without consequence, by returning the study on Prolific. If you would like your data removed after taking part, send the researcher a message through Prolific, or email the researcher below, with your Prolific ID, and it will be deleted." | The data is found by the Prolific ID |
| 7 | Two tick-boxes: the agreement, and the gift-card rules | One tick-box: "I have read the information above. I voluntarily agree to take part, and I understand how the study is paid through Prolific and that the attention checks must be answered as asked." | No gift card, email or minutes to agree to |
| 8 | No way to decline other than closing the page | An **"I do not agree"** button. It shows: "Thank you for considering the study. You have not agreed, so nothing has been recorded. Please go back to Prolific and return the study by choosing 'Stop without completing'. No completion code is needed." | Prolific's normal way out; the person is not left stuck |

## The attention checks in the Prolific version

Both versions ask the same two short questions about what the participant has just finished (after the AI-workforce
part, and after the third scenario). Prolific counts only "instruction" checks as reasons to reject a submission
(for example "Pick the number four"), and only when a person fails **two** of them. So the Prolific version has **two**
"pick the number" rows in the feedback questions (the university version has one): one in "The tools & the experiment
design" and one in "How this experience was for you", each asking for a different number from two to five. A person is
never told whether they answered right. Failing both rows marks the submission for a closer look before payment;
the two topic questions are kept for the analysis and never affect payment.

## Where this lives

The page is `src/experiment/ConsentPage.tsx` (the Prolific parts are the functions `ProlificSitting`, `ProlificPayment`,
`ProlificPrivacy` and `ProlificAgreement`). A check (`npm run validate:attention`, T10) holds the university version's
wording and the Prolific version's key sentences, so neither can change without the check noticing.
