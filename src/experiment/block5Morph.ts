/**
 * block5Morph.ts — the PowerPoint-style "Morph" transition, in the browser.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES
 *
 * The intro page shows the scene, the situation and the participant's role as large cards. The
 * scenario page shows the SAME three cards, small, in a sidebar. This animates the first into the
 * second: each card travels and shrinks to the exact place its counterpart occupies, so the
 * participant sees the material they just read take up residence beside the options rather than
 * being replaced by an unfamiliar screen.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY FLIP AND NOT THE VIEW TRANSITIONS API
 *
 * `document.startViewTransition()` does this in about ten lines — and does nothing at all in
 * Firefox, where it is still behind a flag. A study is taken by whoever turns up, and "the
 * animation silently does not happen for some participants" is a difference between participants
 * that nobody chose. FLIP is measure-and-move: it works in every browser that can run the study
 * at all, and needs no dependency.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THE CARDS CROSS-FADE AS THEY TRAVEL
 *
 * A card is scaled, not re-laid-out — animating width and height would reflow text on every frame
 * and stutter. Scaling squashes the type slightly on the way, so each travelling card fades out
 * over the last stretch of its journey while the real card underneath fades in. The eye reads one
 * object moving; it never gets a clear enough look at the distorted text to notice it. This is the
 * same trick PowerPoint's own Morph uses.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ACCESSIBILITY
 *
 * A participant whose system asks for reduced motion gets no animation at all — the callback fires
 * immediately and the page simply changes. Large sliding transitions are a known trigger for
 * vestibular symptoms, and this one moves most of the screen at once.
 */

/** Elements carrying this attribute are matched by value between the two pages and travel. */
export const MORPH_ATTR = "data-morph";
/** Elements carrying this attribute belong to the intro only, and fade out where they stand. */
export const MORPH_FADE_ATTR = "data-morph-fade";

const TRAVEL_MS = 620;
const FADE_OUT_MS = 260;

/** True when the participant has asked the system to minimise animation. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Pair {
  from: HTMLElement;
  to: HTMLElement;
  rect: DOMRect;
  target: DOMRect;
}

/**
 * Animate the intro's cards onto their counterparts, then call `done`.
 *
 * `done` is called exactly once, whatever happens: if a pair cannot be matched, if the browser has
 * no Web Animations support, or if the participant prefers reduced motion. A transition that can
 * strand someone on a half-faded screen is worse than no transition, so every path ends with the
 * app moving on.
 */
export function runMorph(
  overlay: HTMLElement | null,
  page: HTMLElement | null,
  done: () => void,
): void {
  if (!overlay || !page || prefersReducedMotion() || typeof overlay.animate !== "function") {
    done();
    return;
  }

  const pairs: Pair[] = [];
  overlay.querySelectorAll<HTMLElement>(`[${MORPH_ATTR}]`).forEach((from) => {
    const key = from.getAttribute(MORPH_ATTR);
    if (!key) return;
    const to = page.querySelector<HTMLElement>(`[${MORPH_ATTR}="${key}"]`);
    if (!to) return;
    const rect = from.getBoundingClientRect();
    const target = to.getBoundingClientRect();
    // A target with no area is off-screen or display:none — travelling to it would look like the
    // card being sucked into a corner, which is worse than simply fading.
    if (target.width < 1 || target.height < 1 || rect.width < 1) return;
    pairs.push({ from, to, rect, target });
  });

  if (pairs.length === 0) { done(); return; }

  /* The real cards are hidden while their copies travel, or the participant would see both at once
     and the effect would read as duplication rather than movement. */
  const restore: (() => void)[] = [];
  pairs.forEach(({ to }) => {
    const prev = to.style.opacity;
    to.style.opacity = "0";
    restore.push(() => { to.style.opacity = prev; });
  });

  overlay.querySelectorAll<HTMLElement>(`[${MORPH_FADE_ATTR}]`).forEach((el) => {
    el.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: FADE_OUT_MS, easing: "ease-out", fill: "forwards" },
    );
  });

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    restore.forEach((f) => f());
    done();
  };

  pairs.forEach(({ from, rect, target, to }) => {
    const dx = target.left - rect.left;
    const dy = target.top - rect.top;
    const sx = target.width / rect.width;
    const sy = target.height / rect.height;

    from.style.transformOrigin = "top left";
    from.style.willChange = "transform, opacity";
    from.animate(
      [
        { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1, offset: 0 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0, offset: 1 },
      ],
      { duration: TRAVEL_MS, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "forwards" },
    );

    /* The real card fades up in the second half, so the arriving copy dissolves into it rather
       than being swapped for it. */
    to.animate(
      [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1, offset: 1 }],
      { duration: TRAVEL_MS, easing: "ease-in", fill: "forwards" },
    );
  });

  /* Driven by a timer rather than the animation's own finish event: `fill: "forwards"` keeps the
     final frame painted, and a dropped frame or a backgrounded tab must not leave the overlay up
     for ever. */
  window.setTimeout(finish, TRAVEL_MS + 40);
}
