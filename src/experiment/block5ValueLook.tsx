/**
 * block5ValueLook.tsx — the name, icon and color of each of the four values, in one place.
 *
 * Moved out of Block5ValuesPanel on 27 September 2026 so the MCF panel (Block5MCFPanel) can draw each
 * value exactly as "Your values in this scenario" does: the same words, the same icon, the same color.
 * A participant who learns that purple is "Protecting the vulnerable" in one panel reads it the same way
 * in the other. A file of its own because a component file may only export components (the dev server's
 * fast refresh, enforced by lint).
 */
import type { ReactNode } from "react";
import { LuHeartPulse, LuShield, LuTrendingUp, LuUsersRound } from "react-icons/lu";
import type { Block5PolicyDimKey } from "./block5Types";

/** The same four names every other Block 5 surface uses. */
export const NAME: Record<Block5PolicyDimKey, string> = {
  vulnerabilityProtectionSensitivity: "Protecting the vulnerable",
  groupSizeSensitivity: "Reducing harm",
  gainResponsivenessSensitivity: "How much is gained",
  outcomeAggregationSensitivity: "How many are helped",
};

/** One icon and one color family per value; Chakra's semantic tokens follow light and dark mode. */
export const LOOK: Record<Block5PolicyDimKey, { icon: ReactNode; palette: string }> = {
  vulnerabilityProtectionSensitivity: { icon: <LuShield />, palette: "purple" },
  groupSizeSensitivity: { icon: <LuHeartPulse />, palette: "teal" },
  gainResponsivenessSensitivity: { icon: <LuTrendingUp />, palette: "orange" },
  outcomeAggregationSensitivity: { icon: <LuUsersRound />, palette: "pink" },
};
