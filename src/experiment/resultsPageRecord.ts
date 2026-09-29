/**
 * resultsPageRecord.ts — which "Continue to feedback" button a participant used, and whether they
 * opened the charts first.
 *
 * WHY IT EXISTS (28 September 2026, the researcher's plan answers "Q1-A, Q2-yes, Q3-yes, Q4-yes,
 * Q5-yes"). In the previous experiment participants reached the results page, took it for the end,
 * and never gave feedback. The results page now says "1 step left", carries a "One last step" card
 * under the four score cards and a slim bar at the bottom of the screen, as well as the button it
 * always had at the bottom. This file records which of them was used, so the analyst can see which
 * reminder worked - and can spot a participant who rated "The final results page" (TOOL_resultsPage)
 * after going straight to the feedback without opening anything.
 *
 * Browser first, like every record: the page writes here, and dbShape's SOURCE_MAP sends it as
 * `analysis.results_page` at the next stage change (the move to the feedback page is one).
 * Nothing here is ever shown to the participant.
 */

export const RESULTS_PAGE_KEY = "vrds_results_page";

/** Every button that leads from the results or charts page to the feedback. */
export type FeedbackButton =
  | "card_under_scores"
  | "bar_on_results"
  | "bar_on_charts"
  | "bottom_of_results"
  | "bottom_of_charts";

export const FEEDBACK_BUTTONS: FeedbackButton[] = [
  "card_under_scores", "bar_on_results", "bar_on_charts", "bottom_of_results", "bottom_of_charts",
];

export interface ResultsPageVisit {
  button: FeedbackButton;
  /** ISO time of the click. */
  at: string;
  /** How many times the charts page had been opened before this click. */
  chartsOpenedSoFar: number;
}

export interface ResultsPageRecord {
  /** How many times the charts page ("A picture of your journey") was opened, in total. */
  chartsOpened: number;
  /** Every move to the feedback page, oldest first. A participant can come back from the feedback
   *  page with its "Back" button and leave again, so there can be more than one. */
  toFeedback: ResultsPageVisit[];
}

const EMPTY: ResultsPageRecord = { chartsOpened: 0, toFeedback: [] };

export function readResultsPageRecord(): ResultsPageRecord {
  try {
    const raw = localStorage.getItem(RESULTS_PAGE_KEY);
    if (!raw) return { ...EMPTY, toFeedback: [] };
    const parsed = JSON.parse(raw) as Partial<ResultsPageRecord>;
    return {
      chartsOpened: typeof parsed.chartsOpened === "number" ? parsed.chartsOpened : 0,
      toFeedback: Array.isArray(parsed.toFeedback) ? parsed.toFeedback : [],
    };
  } catch {
    return { ...EMPTY, toFeedback: [] };
  }
}

function write(record: ResultsPageRecord): void {
  try {
    localStorage.setItem(RESULTS_PAGE_KEY, JSON.stringify(record));
  } catch {
    /* Storage full or blocked: the study goes on, only this record is missing. */
  }
}

/** Called each time the charts page is opened. */
export function noteChartsOpened(): void {
  const r = readResultsPageRecord();
  write({ ...r, chartsOpened: r.chartsOpened + 1 });
}

/** Called by every "Continue to feedback" button, just before the page changes. */
export function noteFeedbackButton(button: FeedbackButton): void {
  const r = readResultsPageRecord();
  write({
    ...r,
    toFeedback: [...r.toFeedback, { button, at: new Date().toISOString(), chartsOpenedSoFar: r.chartsOpened }],
  });
}
