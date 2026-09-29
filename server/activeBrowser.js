/**
 * activeBrowser.js — which browser may write a participant's record (since 29 September 2026).
 *
 * WHY. The researcher: "some people may start working in a new browser or device and at the same time
 * work from the old browser, so the data comes from two sources". Every write already merged or
 * replaced by the rules of its own section, but nothing said that ONE browser is the participant's
 * browser at a time. Now the document holds `active_browser` ({ id, claimed_at }), and every write
 * carries the browser's id in the `X-VRDS-Browser` header.
 *
 * THE RULE, in one function so it can be tested without a database (npm run validate:session):
 *   - no id on the request      -> allow  (a request that is not from the study page, e.g. a tool)
 *   - nobody holds the record   -> claim  (the first writer takes it: a brand-new participant)
 *   - this browser holds it     -> allow
 *   - another browser holds it  -> refuse (409; the page shows "open on another browser or device")
 *
 * A browser TAKES the record only through the claim route, which the start screen calls after the
 * email-and-age check (and the page's "Continue here instead" leads there too). That check is the
 * same one the study always had: it is not a password, and this rule is exactly as strong as it.
 */

export const BROWSER_HEADER = "x-vrds-browser";

/** The id the request carries, or null. Ids are the page's own random ids: short, plain text. */
export function requestBrowser(req) {
  const raw = req?.headers?.[BROWSER_HEADER];
  const id = typeof raw === "string" ? raw.trim() : "";
  return id && id.length <= 100 ? id : null;
}

/** "allow" | "claim" | "refuse" — see the rule above. */
export function browserVerdict(activeBrowserId, requestBrowserId) {
  if (!requestBrowserId) return "allow";
  if (!activeBrowserId) return "claim";
  return activeBrowserId === requestBrowserId ? "allow" : "refuse";
}

/** The answer a refused write gets. The page reads `error` to tell it apart from other refusals. */
export const REFUSED_BODY = {
  error: "another_browser_active",
  message: "This participant's study is open on another browser or device.",
};
