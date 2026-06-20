/**
 * block5ChartColors.ts — shared chart palettes (kept in their own non-component module so
 * the chart components file stays Fast-Refresh-friendly).
 *
 * The categorical palette is colour-blind-safe, and in the charts colour is always paired
 * with a text label so meaning is never carried by colour alone.
 */

/** Colour-blind-safe categorical palette (teal · blue · amber · violet · pink). */
export const SERIES_COLORS = ["#0d9488", "#2563eb", "#d97706", "#7c3aed", "#db2777"];

/** Alignment-level colours (always shown next to a text label). */
export const ALIGN_COLORS: Record<string, string> = {
  aligned: "#16a34a",
  weakly_aligned: "#ca8a04",
  misaligned: "#ea580c",
  strongly_misaligned: "#dc2626",
};
