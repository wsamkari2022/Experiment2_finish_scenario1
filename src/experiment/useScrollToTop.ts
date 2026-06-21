/**
 * useScrollToTop — scrolls the window to the top whenever `key` changes.
 *
 * Used at every "new page" moment (stage changes, Block-4 step changes, Block-5 scenario
 * changes, the results↔charts toggle) so the participant always starts reading a fresh page
 * from the top instead of wherever the previous page was scrolled to.
 *
 * The scroll is instant (no animation) so the page simply appears at the top.
 */

import { useLayoutEffect } from "react";

export function useScrollToTop(key: unknown): void {
  useLayoutEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      // Belt-and-suspenders for browsers that scroll the documentElement/body instead.
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    } catch {
      try { window.scrollTo(0, 0); } catch { /* ignore */ }
    }
  }, [key]);
}
