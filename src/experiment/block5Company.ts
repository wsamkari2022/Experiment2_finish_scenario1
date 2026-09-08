/**
 * block5Company.ts — the employer's values, and what a participant did with them.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE QUESTION THIS FILE EXISTS TO ANSWER
 *
 * Scenario 4 puts the participant inside an organisation that has published a value they do not
 * hold, and asks them to make a decision under it. Three things can happen, and the whole point is
 * to tell them apart:
 *
 *   ADOPTED      they took the company's line
 *   COMPROMISED  they found something between the company's line and their own
 *   RESISTED     they held their own values
 *
 * Nothing else in the study asks this. The other scenarios vary WHO CARRIES THE COST; this one
 * varies WHOSE VALUES GOVERN, which is a different question about the same person.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THE COMPANY'S VALUE IS DERIVED, NOT WRITTEN
 *
 * A fixed set of company values would produce a real conflict for some participants and none at
 * all for others — and those two people cannot be compared, because they were not asked the same
 * question. Someone who already prizes solvency, told their employer prizes solvency, faces no
 * dilemma whatsoever, and their "adopted" would mean nothing.
 *
 * So the employer's stated priority is set to the value the participant scored LOWEST in Blocks
 * 1–4. Every participant then works under an employer that prizes the thing they care least about,
 * the conflict is guaranteed by construction, and "did you take on your employer's values?" means
 * the same thing for everybody.
 *
 * READ FROM THE FROZEN PROFILE, ALWAYS. A company whose values drifted with the participant's
 * would not be a company; it would be a mirror, and the contrast would vanish exactly when the
 * participant moved — which is the case the measure exists to catch.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY DISTANCE TO THE COMPANY IS MEASURED THE SAME WAY AS DISTANCE TO THE PARTICIPANT
 *
 * `companyDistance` builds a synthetic profile for the employer and then calls the SAME
 * `profileDistance` the rest of Block 5 uses. That is deliberate. The two numbers are meant to be
 * read side by side — "you ended up 41 from yourself and 6 from them" — and a comparison between
 * two quantities computed by different formulas is not a comparison, it is a coincidence.
 */

import { POLICY_DIM_KEYS } from "./block5Types";
import type {
  Block5Employer,
  Block5PolicyDimKey,
  Block5ScenarioOption,
  Block5UserProfile,
} from "./block5Types";
import { profileDistance } from "./block5Position";

/**
 * How strongly the synthetic employer holds its stated value, and how little it holds the rest.
 *
 * NOT 100/0. An employer that scores 100 on one value and 0 on the other three is not a company,
 * it is a caricature, and the distance to it would be dominated by the three zeros rather than by
 * the disagreement that matters. 88/34 gives a profile with one clear priority and ordinary
 * indifference elsewhere — the shape of a real published principle.
 *
 * These two numbers set the scale of `companyDistance`, so changing them changes every stance
 * boundary below. They are constants rather than literals for that reason.
 */
const COMPANY_PRIORITY_SCORE = 88;
const COMPANY_OTHER_SCORE = 34;

/** What the employer says it stands for, for this participant. */
export interface DerivedCompanyValues {
  /** the employer itself */
  name: string;
  /** heading shown above the principle */
  principleLabel: string;
  /** WHICH value the company prizes — the participant's weakest */
  statedKey: Block5PolicyDimKey;
  /** the published sentence */
  principle: string;
  /** the company's own justification */
  rationale: string;
  /** the participant's own score on that value, 0–100, from the FROZEN profile */
  participantScore: number;
}

/** Reads a profile's four policy values as a plain record. */
function scoresOf(profile: Block5UserProfile): Record<Block5PolicyDimKey, number> {
  const out = {} as Record<Block5PolicyDimKey, number>;
  for (const k of POLICY_DIM_KEYS) {
    out[k] = profile.dimensions.find((d) => d.key === k)?.score ?? 0;
  }
  return out;
}

/**
 * The employer's stated priority for THIS participant: whichever value they hold least.
 *
 * Ties break by the fixed order of POLICY_DIM_KEYS rather than by whichever happened to be found
 * first, so two participants with identical profiles always meet the identical employer. A measure
 * that depended on iteration order would be unreproducible in exactly the cases most worth
 * checking.
 *
 * @param frozen the PRE-Block-5 profile. Passing the current profile is a bug, not an option.
 */
export function deriveCompanyValues(
  frozen: Block5UserProfile,
  employer: Block5Employer,
): DerivedCompanyValues {
  const me = scoresOf(frozen);
  let statedKey = POLICY_DIM_KEYS[0];
  for (const k of POLICY_DIM_KEYS) {
    if (me[k] < me[statedKey]) statedKey = k;
  }
  return {
    name: employer.name,
    principleLabel: employer.principleLabel,
    statedKey,
    principle: employer.principleFor[statedKey],
    rationale: employer.rationaleFor[statedKey],
    participantScore: Math.round(me[statedKey]),
  };
}

/**
 * The employer as a profile, so it can be measured against options the same way a person is.
 *
 * Exported because the visualisations draw it alongside the participant's own profile, and a chart
 * that redrew this shape from its own copy of the constants would drift from the number the stance
 * was computed with.
 */
export function companyProfile(statedKey: Block5PolicyDimKey): Block5UserProfile {
  const dims = POLICY_DIM_KEYS.map((key, i) => ({
    key,
    label: key,
    score: key === statedKey ? COMPANY_PRIORITY_SCORE : COMPANY_OTHER_SCORE,
    rank: key === statedKey ? 1 : i + 2,
    weight: 0.25,
    sourceBlocks: [] as string[],
  }));
  return {
    generatedAt: "",
    dimensions: dims,
    topThreeKeys: [statedKey],
    topSensitivityKey: statedKey,
  } as unknown as Block5UserProfile;
}

/** How far an option sits from what the employer says it wants. Same scale as `profileDistance`. */
export function companyDistance(
  statedKey: Block5PolicyDimKey,
  option: Block5ScenarioOption,
): number {
  return profileDistance(companyProfile(statedKey), option);
}

/** What the participant did with their employer's values. */
export type CompanyStance = "adopted" | "compromised" | "resisted";

export interface StanceReading {
  stance: CompanyStance;
  /** distance from the participant's FROZEN values to the option they chose */
  ownDistance: number;
  /** distance from the employer's stated values to the same option */
  companyDistance: number;
  /**
   * ownDistance − companyDistance. Positive means they landed nearer the company than themselves.
   * This is the number the stance is read off, and it is reported alongside the label so a reader
   * can see how close a call it was.
   */
  pull: number;
  /** plain-language sentence for the card and the chart caption */
  sentence: string;
}

/**
 * The margin, in distance points, outside which a choice counts as having taken a side.
 *
 * WHY A BAND AND NOT A SIGN. Reading the stance from `pull > 0` alone would label a participant who
 * landed one point nearer their employer as having ADOPTED its values, which is not a finding, it
 * is rounding. The middle band is where the honest answer is "they split the difference", and
 * COMPROMISED is a real outcome of this scenario rather than a failure to classify.
 *
 * 8 points on a 0–100 distance scale, chosen so that the band is wide enough to absorb a single
 * value's worth of disagreement (the four values are averaged, so one value differing by ~32
 * moves the distance by 8) without swallowing genuine sidings.
 */
const STANCE_BAND = 8;

/**
 * Which way the participant went, given the option they actually chose.
 *
 * @param frozen  the PRE-Block-5 profile — the values they walked in with
 * @param company the employer's derived values
 * @param option  the option they chose
 */
export function stanceOf(
  frozen: Block5UserProfile,
  company: DerivedCompanyValues,
  option: Block5ScenarioOption,
): StanceReading {
  const own = profileDistance(frozen, option);
  const theirs = companyDistance(company.statedKey, option);
  const pull = own - theirs;
  const stance: CompanyStance =
    pull > STANCE_BAND ? "adopted" : pull < -STANCE_BAND ? "resisted" : "compromised";
  const r = (v: number) => Math.round(v * 10) / 10;
  const sentence =
    stance === "adopted"
      ? `You landed closer to ${company.name}'s stated priority than to your own values (${r(theirs)} from theirs, ${r(own)} from yours).`
      : stance === "resisted"
        ? `You stayed closer to your own values than to ${company.name}'s stated priority (${r(own)} from yours, ${r(theirs)} from theirs).`
        : `You landed between the two, close to neither (${r(own)} from your values, ${r(theirs)} from ${company.name}'s).`;
  return { stance, ownDistance: r(own), companyDistance: r(theirs), pull: r(pull), sentence };
}

/** Everything the stance chart needs, or null when this run had no employer scenario. */
export interface StanceAnalysis extends StanceReading {
  company: DerivedCompanyValues;
  scenarioId: string;
  optionTitle: string;
  /** every option on that table, so the chart can show where the chosen one sat among them */
  field: { optionId: string; title: string; own: number; theirs: number; chosen: boolean }[];
}

/**
 * The stance for this run, found from the stored results.
 *
 * Looks for the scenario that HAS an employer and asks for a decision — the recipient half shares
 * the employer but produces a wish, and a wish is not a stance: nobody adopts or resists values
 * they were given no power over. Returns null when that scenario was not reached, so an incomplete
 * run draws no card rather than a card about a decision that never happened.
 */
export function analyseStance(
  results: { scenarioId: string; selectedOptionId: string }[],
  frozen: Block5UserProfile,
  scenarios: { id: string; employer?: Block5Employer; decisionRole?: string; options: Block5ScenarioOption[] }[],
): StanceAnalysis | null {
  const scenario = scenarios.find((s) => s.employer && (s.decisionRole ?? "decider") === "decider");
  if (!scenario || !scenario.employer) return null;
  const res = results.find((r) => r.scenarioId === scenario.id);
  if (!res) return null;
  const option = scenario.options.find((o) => o.id === res.selectedOptionId);
  if (!option) return null;

  const company = deriveCompanyValues(frozen, scenario.employer);
  const reading = stanceOf(frozen, company, option);
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    ...reading,
    company,
    scenarioId: scenario.id,
    optionTitle: option.title,
    field: scenario.options.map((o) => ({
      optionId: o.id,
      title: o.title,
      own: r(profileDistance(frozen, o)),
      theirs: r(companyDistance(company.statedKey, o)),
      chosen: o.id === option.id,
    })),
  };
}

/** Plain words for a stance, for badges and chart labels. */
export const STANCE_LABEL: Record<CompanyStance, string> = {
  adopted: "Took the company's values",
  compromised: "Split the difference",
  resisted: "Held your own values",
};
