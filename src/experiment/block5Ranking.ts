/**
 * block5Ranking.ts — Candidate filtering, weighted fit scoring, and ranking logic.
 *
 * This module takes a participant's Block5UserProfile (derived from the threshold tree)
 * and a set of scenario options (each with a 7-dimension fingerprint), then produces
 * a personalised ranking.
 *
 * Algorithm:
 *  1. Gate filtering — each option must meet a minimum threshold on the user's top
 *     sensitivity AND pass gates for at least 2 of their top 3 sensitivities to be
 *     classified as a "candidate."
 *  2. Weighted fit scoring — a 0–100 score based on how closely the option's fingerprint
 *     matches the user's profile across all 7 dimensions, weighted by dimension importance.
 *  3. Ranking — candidates are ranked above non-candidates; within each group, sorted by fit score.
 *  4. Explanation generation — identifies best-matching dimensions (top match reasons)
 *     and poorly-matching dimensions (tension points) for UI transparency.
 */

import type {
  Block5ScenarioOption,
  Block5SensitivityKey,
  Block5UserProfile,
} from "./block5Types";

const ALL_KEYS: Block5SensitivityKey[] = [
  "directnessSensitivity",
  "vulnerabilityProtectionSensitivity",
  "groupSizeSensitivity",
  "contextSensitivity",
  "gainResponsivenessSensitivity",
  "stakeholderPerspectiveShiftSensitivity",
  "outcomeAggregationSensitivity",
];

const CLOSENESS_LABELS: [number, string][] = [
  [90, "Very close match"],
  [75, "Close match"],
  [55, "Moderate mismatch"],
  [35, "Notable mismatch"],
  [0, "Far from your profile"],
];

export function closenessLabel(match: number): string {
  for (const [threshold, label] of CLOSENESS_LABELS) {
    if (match >= threshold) return label;
  }
  return "Far from your profile";
}

function passesGate(optionScore: number, userScore: number): boolean {
  return optionScore >= Math.max(30, userScore - 25);
}

export interface RankedOption extends Block5ScenarioOption {
  fitScore: number;
  candidate: boolean;
  rank: number;
  topMatchReasons: string[];
  tensionPoints: string[];
  gateResults: Record<Block5SensitivityKey, boolean>;
}

export function rankOptions(
  options: Block5ScenarioOption[],
  profile: Block5UserProfile,
): RankedOption[] {
  const top3 = profile.topThreeKeys;
  const topKey = profile.topSensitivityKey;

  const userScoreMap: Record<Block5SensitivityKey, number> = {} as Record<Block5SensitivityKey, number>;
  const userWeightMap: Record<Block5SensitivityKey, number> = {} as Record<Block5SensitivityKey, number>;
  for (const dim of profile.dimensions) {
    userScoreMap[dim.key] = dim.score;
    userWeightMap[dim.key] = dim.weight;
  }

  const scored = options.map((opt) => {
    const gateResults: Record<Block5SensitivityKey, boolean> = {} as Record<Block5SensitivityKey, boolean>;
    for (const k of ALL_KEYS) {
      gateResults[k] = passesGate(opt.fingerprint[k], userScoreMap[k] ?? 50);
    }

    const passesTop = gateResults[topKey];
    const passedTop3Count = top3.filter((k) => gateResults[k]).length;
    const candidate = passesTop && passedTop3Count >= 2;

    let weightedFit = 0;
    for (const k of ALL_KEYS) {
      const match = 100 - Math.abs((userScoreMap[k] ?? 50) - opt.fingerprint[k]);
      weightedFit += match * (userWeightMap[k] ?? 1 / 7);
    }

    if (top3.every((k) => gateResults[k])) weightedFit += 5;
    if (!passesTop) weightedFit -= 8;
    const fitScore = Math.max(0, Math.min(100, Math.round(weightedFit)));

    const matchScores = ALL_KEYS.map((k) => ({
      key: k,
      match: 100 - Math.abs((userScoreMap[k] ?? 50) - opt.fingerprint[k]),
      label: profile.dimensions.find((d) => d.key === k)?.label ?? k,
    }));
    matchScores.sort((a, b) => b.match - a.match);

    const topMatchReasons = matchScores.slice(0, 3).map(
      (m) => `${m.label}: ${m.match}% match`,
    );

    const tensionPoints = matchScores
      .filter((m) => m.match < 60)
      .slice(0, 2)
      .map((m) => `Lower fit on ${m.label.toLowerCase()}`);

    return {
      ...opt,
      fitScore,
      candidate,
      rank: 0,
      topMatchReasons,
      tensionPoints,
      gateResults,
    };
  });

  const candidates = scored.filter((o) => o.candidate).sort((a, b) => b.fitScore - a.fitScore);
  const nonCandidates = scored.filter((o) => !o.candidate).sort((a, b) => b.fitScore - a.fitScore);
  const ranked = [...candidates, ...nonCandidates];
  ranked.forEach((o, i) => { o.rank = i + 1; });

  return ranked;
}
