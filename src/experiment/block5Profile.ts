/**
 * block5Profile.ts — Extract a normalized Block 5 user profile from
 * the ranked threshold tree computed by earlier blocks.
 *
 * The threshold tree (built after Block 4) has 7 dimensions with scores 0–100.
 * This module maps those tree dimensions to Block 5 sensitivity keys, preserving
 * ranks and weights, and identifies the participant's top 3 sensitivities.
 *
 * The resulting Block5UserProfile is used by block5Ranking.ts to personalise
 * the ranking of policy options in each emergency scenario.
 */

import type { ThresholdTree } from "./thresholdTree";
import type {
  Block5SensitivityKey,
  Block5UserProfile,
  Block5UserProfileDimension,
} from "./block5Types";

const KEY_MAP: Record<string, Block5SensitivityKey> = {
  directness: "directnessSensitivity",
  worker_vulnerability: "vulnerabilityProtectionSensitivity",
  group_size: "groupSizeSensitivity",
  context: "contextSensitivity",
  gain_responsiveness: "gainResponsivenessSensitivity",
  stakeholder_shift: "stakeholderPerspectiveShiftSensitivity",
  outcome_aggregation: "outcomeAggregationSensitivity",
};

const LABEL_MAP: Record<Block5SensitivityKey, string> = {
  directnessSensitivity: "Directness sensitivity",
  vulnerabilityProtectionSensitivity: "Vulnerability protection sensitivity",
  groupSizeSensitivity: "Group-size sensitivity",
  contextSensitivity: "Context sensitivity",
  gainResponsivenessSensitivity: "Gain responsiveness sensitivity",
  stakeholderPerspectiveShiftSensitivity: "Stakeholder perspective shift sensitivity",
  outcomeAggregationSensitivity: "Outcome-aggregation sensitivity",
};

const SOURCE_MAP: Record<Block5SensitivityKey, string[]> = {
  directnessSensitivity: ["Block 2"],
  vulnerabilityProtectionSensitivity: ["Block 3"],
  groupSizeSensitivity: ["Block 3"],
  contextSensitivity: ["Block 1", "Block 3"],
  gainResponsivenessSensitivity: ["Block 3"],
  stakeholderPerspectiveShiftSensitivity: ["Block 4"],
  outcomeAggregationSensitivity: ["Block 2", "Block 3"],
};

export function extractBlock5Profile(tree: ThresholdTree): Block5UserProfile {
  const dimensions: Block5UserProfileDimension[] = tree.dimensions.map((d) => {
    const key = KEY_MAP[d.key] ?? ("directnessSensitivity" as Block5SensitivityKey);
    const weight = (8 - d.rank) / 28;
    return {
      key,
      label: LABEL_MAP[key],
      score: d.score,
      rank: d.rank,
      weight,
      sourceBlocks: SOURCE_MAP[key],
    };
  });

  const sorted = [...dimensions].sort((a, b) => a.rank - b.rank);
  const topThreeKeys = sorted.slice(0, 3).map((d) => d.key);
  const topSensitivityKey = sorted[0]?.key ?? "directnessSensitivity";

  return {
    generatedAt: new Date().toISOString(),
    dimensions,
    topThreeKeys,
    topSensitivityKey,
  };
}
