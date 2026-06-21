/**
 * block123Theme.ts — shared LIGHT-MODE surface colours for Blocks 1–3 (Money, Trolley,
 * AI-Workforce). One coordinated palette so the whole "value-profiling" stage feels like a
 * single, organised, scientific instrument.
 *
 * Why this exists: in light mode the Bolt defaults render the page (`bg`) and the cards
 * (`bg.panel`) both as near-white, so cards melt into the background and content is hard to
 * read. Here we give light mode a calm cool-slate page tint with crisp WHITE cards (which then
 * pop, aided by their existing shadows) and a soft recessed tint for inner panels.
 *
 * Dark mode is intentionally left exactly as before: each value below resolves to the original
 * semantic token (`bg` / `bg.panel` / `bg.subtle`) when not in light mode.
 */

import { useColorMode } from "@/components/ui/color-mode";

export interface Block123Surfaces {
  /** full-page background */
  pageBg: string;
  /** elevated content cards */
  cardBg: string;
  /** recessed inner panels inside a card */
  subtleBg: string;
  /** true when the new light palette is active (handy for any extra light-only polish) */
  isLight: boolean;
}

/** Coordinated cool-slate light palette shared across Blocks 1–3. */
const LIGHT = {
  page: "#e9edf7",   // calm indigo-slate page tint
  card: "#ffffff",   // crisp white cards that separate clearly from the page
  subtle: "#eef2fb", // soft recessed panels inside cards
};

export function useBlock123Surfaces(): Block123Surfaces {
  const { colorMode } = useColorMode();
  const isLight = colorMode === "light";
  return {
    isLight,
    pageBg: isLight ? LIGHT.page : "bg",
    cardBg: isLight ? LIGHT.card : "bg.panel",
    subtleBg: isLight ? LIGHT.subtle : "bg.subtle",
  };
}
