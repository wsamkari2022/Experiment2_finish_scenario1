/**
 * block5ChartColors.ts — shared chart palettes (kept in their own non-component module so
 * the chart components file stays Fast-Refresh-friendly).
 *
 * The categorical palette is color-blind-safe, and in the charts color is always paired
 * with a text label so meaning is never carried by color alone.
 */

/** Color-blind-safe categorical palette (teal · blue · amber · violet · pink). */
export const SERIES_COLORS = ["#0d9488", "#2563eb", "#d97706", "#7c3aed", "#db2777"];

/** Alignment-level colors (always shown next to a text label). */
export const ALIGN_COLORS: Record<string, string> = {
  aligned: "#16a34a",
  weakly_aligned: "#ca8a04",
  misaligned: "#ea580c",
  strongly_misaligned: "#dc2626",
};

/**
 * Six-color categorical palette for the per-scenario option comparison, tuned per color
 * mode: the 600-level hues below read strongly on a light card but go muddy on a dark one,
 * so dark mode uses the 300/400-level counterparts of the SAME six hues. The hues are spread
 * around the wheel (blue · teal · green · amber · red · violet) so no two neighbors are
 * confusable — a lesson from the earlier legend fix, where amber and orange sat ~5° apart and
 * could not be told apart in Light Mode. Color is always paired with the option's title in
 * both the toggle list and the legend.
 */
export const OPTION_SERIES_COLORS: Record<"light" | "dark", string[]> = {
  light: ["#1d4ed8", "#0f766e", "#4d7c0f", "#b45309", "#b91c1c", "#6d28d9"],
  dark: ["#60a5fa", "#2dd4bf", "#a3e635", "#fbbf24", "#f87171", "#c4b5fd"],
};

/**
 * Neutral gray for the dashed "this is you" reference series, deliberately outside the
 * categorical palette so it never reads as one more option.
 */
export const REFERENCE_SERIES_COLOR: Record<"light" | "dark", string> = {
  light: "#475569",
  dark: "#94a3b8",
};
