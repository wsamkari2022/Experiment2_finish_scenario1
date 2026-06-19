/**
 * types.ts — Block 1 (Found-Money) type definitions
 *
 * Covers the three location contexts, the four response actions, the per-context
 * threshold record, the full per-choice history record, and the final results
 * object persisted to localStorage when Block 1 completes.
 */

/** The three location keys used in Block 1. Each maps to one ContextDef. */
export type ContextKey = "sidewalk" | "wealthy" | "shelter";

/**
 * The four actions a participant can take when presented with a found-money scenario.
 * - "keep"   → threshold accepted at the current amount; block moves to next context
 * - "return" / "leave" / "donate" → all treated as non-acceptance; amount escalates
 */
export type ActionKey = "keep" | "return" | "leave" | "donate";

/**
 * A location context definition. The `scenario` function generates the
 * full scenario sentence by interpolating the current amount label.
 */
export interface ContextDef {
  key: ContextKey;
  label: string;
  scenario: (amount: string) => string;
}

/**
 * The acceptance threshold recorded for a single context.
 * - `accepted: true`  → participant clicked "Keep it"; `thresholdAmount` holds the value
 * - `accepted: false` + `thresholdBeyondRange: true` → participant never clicked "Keep it"
 *   even at $10,000; the threshold is considered beyond the tested range
 */
export interface ThresholdResult {
  contextKey: ContextKey;
  accepted: boolean;
  thresholdAmount: number | null;       // null when not accepted
  thresholdLabel: string | null;        // null when not accepted
  thresholdAmountIndex: number | null;  // 0-based index into AMOUNT_LABELS; null when not accepted
  thresholdBeyondRange: boolean;        // true when all amounts were rejected
}

/**
 * A single choice record written to history on every button click.
 * Used to reconstruct the full decision path for analysis.
 */
export interface MoneyChoiceRecord {
  contextKey: ContextKey;
  contextLabel: string;
  amountIndex: number;     // index into AMOUNT_LABELS at time of choice
  amountValue: number;     // numeric value at time of choice
  amountLabel: string;     // display label at time of choice
  action: ActionKey;
  timestamp: string;       // ISO-8601
}

/**
 * The complete output of Block 1, saved to localStorage and passed to profileAnalysis.
 * `thresholds` holds one ThresholdResult per context; null means the context was
 * never reached (should not happen in normal flow, but is typed defensively).
 */
export interface MoneyBlockResults {
  completed: boolean;
  completedAt: string;   // ISO-8601
  thresholds: {
    threshold_sidewalk: ThresholdResult | null;
    threshold_wealthy:  ThresholdResult | null;
    threshold_shelter:  ThresholdResult | null;
  };
  history: MoneyChoiceRecord[];
}
