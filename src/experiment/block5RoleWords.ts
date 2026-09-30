/**
 * block5RoleWords.ts — the role each scenario gives the participant, in the words the scenario page shows
 * ("Your role: Deciding alone", ...). One list, so the scenario pages and the results page (since
 * 29 September 2026) can never name a role two ways. No React here, so any page or check can read it.
 */
import type { StakePosition } from "./block5Types";

export const ROLE_BADGE: Record<StakePosition, string> = {
  self: "Deciding alone",
  self_and_group: "Deciding for your household",
  others: "Deciding for other people",
  under_authority: "Deciding inside your employer's rules",
  receiving_end: "It is being decided for you",
  behind_the_veil: "You do not know who you will be",
};
