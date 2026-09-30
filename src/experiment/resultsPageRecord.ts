/**
 * resultsPageRecord.ts — which "Continue to feedback" button a participant used on the results page.
 *
 * WHY IT EXISTS (28 September 2026, the researcher's plan answers "Q1-A, Q2-yes, Q3-yes, Q4-yes,
 * Q5-yes"). In the previous experiment participants reached the results page, took it for the end,
 * and never gave feedback. The results page now says "1 step left", carries a "One last step" card
 * under the score boxes and a slim bar at the bottom of the screen, as well as the button it always had
 * at the bottom. This file records which of them was used, so the analyst can see which reminder worked.
 *
 * SINCE 29 SEPTEMBER 2026 THE CHARTS ARE NOT REACHABLE BEFORE THE FEEDBACK: they moved to the thank-you
 * page (JourneyTabs). So the two chart-page buttons and the "opened the charts first" count are gone;
 * every move to the feedback now starts on the results page.
 *
 * Browser first, like every record: the page writes here, and dbShape's SOURCE_MAP sends it as
 * `analysis.results_page` at the next stage change (the move to the feedback page is one).
 * Nothing here is ever shown to the participant.
 */

export const RESULTS_PAGE_KEY = "vrds_results_page";

/** Every button that leads from the results page to the feedback. */
export type FeedbackButton = "card_under_scores" | "bar_on_results" | "bottom_of_results";

export const FEEDBACK_BUTTONS: FeedbackButton[] = ["card_under_scores", "bar_on_results", "bottom_of_results"];

export interface ResultsPageVisit {
  button: FeedbackButton;
  /** ISO time of the click. */
  at: string;
}

export interface ResultsPageRecord {
  /** Every move to the feedback page, oldest first. A participant can come back from the feedback
   *  page with its "Back" button and leave again, so there can be more than one. */
  toFeedback: ResultsPageVisit[];
}

export function readResultsPageRecord(): ResultsPageRecord {
  try {
    const raw = localStorage.getItem(RESULTS_PAGE_KEY);
    if (!raw) return { toFeedback: [] };
    const parsed = JSON.parse(raw) as Partial<ResultsPageRecord>;
    return { toFeedback: Array.isArray(parsed.toFeedback) ? parsed.toFeedback : [] };
  } catch {
    return { toFeedback: [] };
  }
}

/** Called by every "Continue to feedback" button, just before the page changes. */
export function noteFeedbackButton(button: FeedbackButton): void {
  const r = readResultsPageRecord();
  try {
    localStorage.setItem(RESULTS_PAGE_KEY, JSON.stringify({
      toFeedback: [...r.toFeedback, { button, at: new Date().toISOString() }],
    }));
  } catch {
    /* Storage full or blocked: the study goes on, only this record is missing. */
  }
}
