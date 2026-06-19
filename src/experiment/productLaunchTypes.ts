export type GroupTypeKey = "vulnerable" | "wealthy";
export type GroupSizeKey = "small" | "medium" | "large";
export type LaunchAction = "launch" | "do_not_launch";

export interface ProfitOption {
  value: number;
  label: string;
}

export interface GroupTypeOption {
  key: GroupTypeKey;
  label: string;
}

export interface GroupSizeOption {
  key: GroupSizeKey;
  label: string;
  count: number;
}

export const PROFIT_OPTIONS: ProfitOption[] = [
  { value: 1_000_000, label: "$1 million" },
  { value: 5_000_000, label: "$5 million" },
  { value: 10_000_000, label: "$10 million" },
  { value: 25_000_000, label: "$25 million" },
  { value: 50_000_000, label: "$50 million" },
  { value: 100_000_000, label: "$100 million" },
];

export const GROUP_TYPES: GroupTypeOption[] = [
  { key: "vulnerable", label: "financially vulnerable people" },
  { key: "wealthy", label: "wealthy and financially secure people" },
];

export const GROUP_SIZES: GroupSizeOption[] = [
  { key: "small", label: "small group of about 10 people", count: 10 },
  { key: "medium", label: "medium group of about 1,000 people", count: 1000 },
  { key: "large", label: "large group of about 100,000 people", count: 100000 },
];

export interface LaunchThresholdResult {
  groupTypeKey: GroupTypeKey;
  groupTypeLabel: string;
  groupSizeKey: GroupSizeKey;
  groupSizeLabel: string;
  groupSizeCount: number;
  accepted: boolean;
  thresholdProfit: number | null;
  thresholdProfitLabel: string | null;
  thresholdProfitIndex: number | null;
  thresholdBeyondRange: boolean;
  blockedByPriorNonAcceptance: boolean;
  startedAtProfitIndex: number;
}

export interface ProductLaunchChoiceRecord {
  groupTypeKey: GroupTypeKey;
  groupTypeLabel: string;
  groupSizeKey: GroupSizeKey;
  groupSizeLabel: string;
  groupSizeCount: number;
  profitIndex: number;
  profitValue: number;
  profitLabel: string;
  action: LaunchAction;
  timestamp: string;
}

export type ThresholdKey =
  | "threshold_vulnerable_small"
  | "threshold_vulnerable_medium"
  | "threshold_vulnerable_large"
  | "threshold_wealthy_small"
  | "threshold_wealthy_medium"
  | "threshold_wealthy_large";

export type ThresholdsMap = Record<ThresholdKey, LaunchThresholdResult>;

export interface ProductLaunchBlockResults {
  completed: boolean;
  completedAt: string;
  thresholds: ThresholdsMap;
  history: ProductLaunchChoiceRecord[];
}

export function thresholdKeyFor(
  groupType: GroupTypeKey,
  groupSize: GroupSizeKey,
): ThresholdKey {
  return `threshold_${groupType}_${groupSize}` as ThresholdKey;
}
