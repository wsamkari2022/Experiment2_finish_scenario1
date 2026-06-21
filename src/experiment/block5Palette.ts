/**
 * block5Palette.ts — the single source of truth for Block-5 scenario-page colours, resolved
 * per colour mode. This makes Block 5 genuinely colour-mode-aware: a fresh, colourful LIGHT
 * theme and a cleaned, flat DARK theme — not a pale copy of one another.
 *
 * Design system: each scenario keeps an identity hue (Cancer = violet, Flood = emerald,
 * Water = blue). One light recipe + one dark recipe are parameterised by that hue + a tinted
 * background, so all three scenarios stay coordinated and only the hue changes.
 *
 * This file only produces COLOURS. It contains no decision logic, scoring, or scenario data.
 */

import type { Block5Scenario } from "./block5Types";

export type Block5Mode = "light" | "dark";

export interface Block5Palette {
  mode: Block5Mode;
  accent: string;
  pageBg: string;
  // text
  text: string;
  textMuted: string;
  textFaint: string;
  headerText: string;
  // surfaces
  cardBg: string;
  cardBorder: string;
  cardHoverBorder: string;
  cardShadow: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarShadow: string;
  surfaceSubtle: string;
  panelDeep: string;
  // badges
  badgeBg: string;
  badgeText: string;
  // dashboard (kept visually distinct from the cards)
  dashBg: string;
  dashBorder: string;
  dashShadow: string;
  dashTopBorder: string;   // accent strip in light → instantly identifies the dashboard
  dashTitleColor: string;
  metricTrack: string;
  // tooltip
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  // misc
  separator: string;
  dotDone: string;
  dotTodo: string;
  backdropBlur: string;
}

/** Per-scenario identity hue + tinted backgrounds for each mode. */
interface HueSpec {
  accentLight: string;
  accentDark: string;
  bgLight: string;
  bgDark: string;
}

const HUES: Record<string, HueSpec> = {
  // Cancer → violet (calm, dignified, distinct from emerald/blue; avoids alarming red).
  cancer_treatment_allocation: {
    accentLight: "#7c3aed",
    accentDark: "#a78bfa",
    bgLight:
      "radial-gradient(900px 460px at 10% -10%, #ede9fe, transparent 60%), radial-gradient(760px 520px at 108% 116%, #f5d0fe, transparent 55%), linear-gradient(155deg, #faf5ff, #f5f3ff 50%, #ede9fe)",
    bgDark:
      "radial-gradient(900px 420px at 12% -10%, rgba(124,58,237,0.20), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(49,29,90,0.42), transparent 55%), linear-gradient(155deg, #0f0a1c, #1a1030 50%, #2a1a4d)",
  },
  // Flood → emerald.
  flood_evacuation_priority: {
    accentLight: "#059669",
    accentDark: "#38A169",
    bgLight:
      "radial-gradient(900px 460px at 10% -10%, #d1fae5, transparent 60%), radial-gradient(760px 520px at 108% 116%, #bbf7d0, transparent 55%), linear-gradient(155deg, #f0fdf4, #ecfdf5 50%, #d1fae5)",
    bgDark:
      "radial-gradient(900px 420px at 12% -10%, rgba(56,161,105,0.20), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(20,75,54,0.35), transparent 55%), linear-gradient(155deg, #06140E, #0f2a1d 50%, #1C4B36)",
  },
  // Water → blue.
  water_contamination_response: {
    accentLight: "#2563eb",
    accentDark: "#3182CE",
    bgLight:
      "radial-gradient(900px 460px at 10% -10%, #dbeafe, transparent 60%), radial-gradient(760px 520px at 108% 116%, #bae6fd, transparent 55%), linear-gradient(155deg, #eff6ff, #f0f9ff 50%, #dbeafe)",
    bgDark:
      "radial-gradient(900px 420px at 12% -10%, rgba(49,130,206,0.20), transparent 62%), radial-gradient(700px 480px at 105% 115%, rgba(11,39,64,0.40), transparent 55%), linear-gradient(155deg, #05111E, #0b2740 50%, #14476B)",
  },
};

/** Falls back to the scenario's own accent + neutral tints for any unmapped scenario id. */
function hueFor(scenario: Block5Scenario): HueSpec {
  const known = HUES[scenario.id];
  if (known) return known;
  const a = scenario.theme.accent;
  return {
    accentLight: a,
    accentDark: a,
    bgLight: "linear-gradient(155deg, #f8fafc, #f1f5f9 50%, #e2e8f0)",
    bgDark: scenario.theme.gradient,
  };
}

export function getBlock5Palette(scenario: Block5Scenario, mode: Block5Mode): Block5Palette {
  const hue = hueFor(scenario);
  if (mode === "light") {
    const accent = hue.accentLight;
    return {
      mode,
      accent,
      pageBg: hue.bgLight,
      text: "#1e293b",
      textMuted: "#475569",
      textFaint: "#94a3b8",
      headerText: "#0f172a",
      cardBg: "#ffffff",
      cardBorder: "#e2e8f0",
      cardHoverBorder: accent,
      cardShadow: "0 1px 2px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.05)",
      sidebarBg: "rgba(255,255,255,0.62)",
      sidebarBorder: "rgba(255,255,255,0.9)",
      sidebarShadow: "0 8px 30px rgba(15,23,42,0.07)",
      surfaceSubtle: "rgba(255,255,255,0.7)",
      panelDeep: "rgba(255,255,255,0.85)",
      badgeBg: "rgba(15,23,42,0.06)",
      badgeText: "#334155",
      dashBg: "#ffffff",
      dashBorder: "#e2e8f0",
      dashShadow: "0 6px 22px rgba(15,23,42,0.10)",
      dashTopBorder: accent,
      dashTitleColor: accent,
      metricTrack: "#e2e8f0",
      tooltipBg: "#0f172a",
      tooltipBorder: "rgba(255,255,255,0.14)",
      tooltipText: "rgba(255,255,255,0.92)",
      separator: "rgba(15,23,42,0.08)",
      dotDone: accent,
      dotTodo: "rgba(15,23,42,0.16)",
      backdropBlur: "blur(8px)",
    };
  }
  // dark — cleaned & flat (no heavy shadows bleeding over the cards)
  const accent = hue.accentDark;
  return {
    mode,
    accent,
    pageBg: hue.bgDark,
    text: "rgba(255,255,255,0.92)",
    textMuted: "rgba(255,255,255,0.72)",
    textFaint: "rgba(255,255,255,0.5)",
    headerText: "#ffffff",
    cardBg: "rgba(255,255,255,0.05)",
    cardBorder: "rgba(255,255,255,0.1)",
    cardHoverBorder: "rgba(255,255,255,0.3)",
    cardShadow: "none",
    sidebarBg: "rgba(255,255,255,0.05)",
    sidebarBorder: "rgba(255,255,255,0.1)",
    sidebarShadow: "none",
    surfaceSubtle: "rgba(255,255,255,0.06)",
    panelDeep: "rgba(0,0,0,0.4)",
    badgeBg: "rgba(255,255,255,0.1)",
    badgeText: "rgba(255,255,255,0.85)",
    dashBg: "rgba(17,20,28,0.86)",
    dashBorder: "rgba(255,255,255,0.18)",
    dashShadow: "none",
    dashTopBorder: "transparent",
    dashTitleColor: "rgba(255,255,255,0.8)",
    metricTrack: "rgba(255,255,255,0.1)",
    tooltipBg: "#0f1117",
    tooltipBorder: "rgba(255,255,255,0.2)",
    tooltipText: "rgba(255,255,255,0.92)",
    separator: "rgba(255,255,255,0.1)",
    dotDone: "rgba(255,255,255,0.7)",
    dotTodo: "rgba(255,255,255,0.2)",
    backdropBlur: "blur(8px)",
  };
}
