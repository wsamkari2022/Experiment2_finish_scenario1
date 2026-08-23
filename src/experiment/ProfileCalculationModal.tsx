import {
  Box,
  Button,
  CloseButton,
  Code,
  Dialog,
  Heading,
  HStack,
  Icon,
  Portal,
  Separator,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuInfo } from "react-icons/lu";
import type { MoralProfile } from "./profileAnalysis";
import { describeScore, MONEY_STEPS, GAIN_STEPS, TROLLEY_STEPS } from "./profileAnalysis";
import { AMOUNT_LABELS, CONTEXTS } from "./constants";
import { SAVED_LIVES_OPTIONS } from "./trolleyTypes";
import {
  WORKER_GROUPS,
  WORKER_GROUP_SIZES,
  GAIN_OPTIONS,
  aiWorkforceThresholdKeyFor,
} from "./aiWorkforceTypes";

/**
 * ProfileCalculationModal — advisor-facing breakdown of the interim Blocks-1–3
 * snapshot (the five MoralProfile scores). It is read-only and shows, for each
 * score, the participant's raw threshold indices, the exact formula, and the
 * result — every number substituted inline so the maths is fully transparent.
 *
 * Vocabulary is AI-Workforce throughout (low-buffer / high-buffer workers, gain) —
 * the legacy Product-Launch wording has been removed (Approved Change 1).
 */

interface ProfileCalculationModalProps {
  profile: MoralProfile;
}

/** Formats a number to 3 decimal places for formula display. */
function fmt(val: number): string {
  return val.toFixed(3);
}

function ScoreBar({ score }: { score: number }) {
  return (
    <Box w="full" bg="bg.emphasized" rounded="full" h="2" overflow="hidden">
      <Box h="full" bg="purple.500" rounded="full" style={{ width: `${Math.max(4, score * 100)}%` }} />
    </Box>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading size="sm" color="purple.400" _dark={{ color: "purple.300" }} mb="1">
      {children}
    </Heading>
  );
}

function FormulaBox({ children }: { children: React.ReactNode }) {
  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="md"
      px="4"
      py="3"
      fontFamily="mono"
      fontSize="sm"
      color="fg.muted"
      whiteSpace="pre-wrap"
      wordBreak="break-word"
    >
      {children}
    </Box>
  );
}

function DataRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "error" | "neutral";
}) {
  const color = accent === "success" ? "fg.success" : accent === "error" ? "fg.error" : "fg";
  return (
    <HStack justify="space-between" borderBottomWidth="1px" borderColor="border.subtle" pb="2" _last={{ borderBottomWidth: 0, pb: 0 }}>
      <Text fontSize="sm" color="fg.muted">{label}</Text>
      <Text fontSize="sm" fontWeight="semibold" color={color}>{value}</Text>
    </HStack>
  );
}

function ScoreSummaryRow({ label, score }: { label: string; score: number }) {
  const levelColor =
    describeScore(score) === "strong" ? "green.400"
      : describeScore(score) === "moderate" ? "blue.300"
        : describeScore(score) === "mild" ? "yellow.300" : "gray.400";
  return (
    <VStack align="stretch" gap="1">
      <HStack justify="space-between">
        <Text fontSize="sm" color="fg.muted">{label}</Text>
        <HStack gap="2">
          <Text fontSize="xs" color="fg.subtle">{fmt(score)}</Text>
          <Text fontSize="sm" fontWeight="semibold" color={levelColor}>{describeScore(score)}</Text>
        </HStack>
      </HStack>
      <ScoreBar score={score} />
    </VStack>
  );
}

export function ProfileCalculationModal({ profile }: ProfileCalculationModalProps) {
  // ── Block 1 (money) ──
  const moneyRows = CONTEXTS.map((ctx) => {
    const idx = profile.moneyIndices[ctx.key];
    const accepted = idx < MONEY_STEPS;
    return { ctxLabel: ctx.label, label: accepted ? (AMOUNT_LABELS[idx] ?? "unknown") : "Never kept" };
  });
  const shelterIdx = profile.moneyIndices.shelter;
  const sidewalkIdx = profile.moneyIndices.sidewalk;
  const moneyVulnGap = shelterIdx / MONEY_STEPS - sidewalkIdx / MONEY_STEPS;

  // ── Block 2 (trolley) ──
  const leverIdx = profile.trolleyIndices.lever;
  const bridgeIdx = profile.trolleyIndices.bridge;
  const leverAccepted = leverIdx < TROLLEY_STEPS;
  const bridgeAccepted = bridgeIdx < TROLLEY_STEPS;
  const leverLabel = leverAccepted ? `${SAVED_LIVES_OPTIONS[leverIdx]} lives` : "Never acted";
  const bridgeLabel = bridgeAccepted ? `${SAVED_LIVES_OPTIONS[bridgeIdx]} lives` : "Never acted";

  // ── Block 3 (AI-Workforce) ──
  const cell = (gt: "low_buffer" | "high_buffer", gs: "small" | "medium" | "large") =>
    profile.aiWorkforceIndices[aiWorkforceThresholdKeyFor(gt, gs)] ?? GAIN_STEPS;
  const lbSmall = cell("low_buffer", "small");
  const lbMedium = cell("low_buffer", "medium");
  const lbLarge = cell("low_buffer", "large");
  const hbSmall = cell("high_buffer", "small");
  const hbMedium = cell("high_buffer", "medium");
  const hbLarge = cell("high_buffer", "large");
  const avgLowBuffer = (lbSmall + lbMedium + lbLarge) / 3;
  const avgHighBuffer = (hbSmall + hbMedium + hbLarge) / 3;
  const bufferGap = (avgLowBuffer - avgHighBuffer) / GAIN_STEPS;
  const scaleSpread = Math.max(lbSmall, lbMedium, lbLarge) - Math.min(lbSmall, lbMedium, lbLarge);

  const aiRows = WORKER_GROUPS.flatMap((gt) =>
    WORKER_GROUP_SIZES.map((gs) => {
      const idx = cell(gt.key, gs.key);
      const accepted = idx < GAIN_STEPS;
      return {
        key: aiWorkforceThresholdKeyFor(gt.key, gs.key),
        rowLabel: `${gt.shortLabel} · ${gs.shortLabel}`,
        value: accepted ? (GAIN_OPTIONS[idx]?.label ?? "unknown") : "Never approved",
        accepted,
      };
    }),
  );

  // ── Consistency sub-scores (match profileAnalysis exactly) ──
  const moneyVulnNorm = 1 - shelterIdx / MONEY_STEPS;
  const lowBufferVulnNorm = 1 - avgLowBuffer / GAIN_STEPS;
  const harmReluctanceNorm = profile.harmReluctanceScore;
  const meanSens = (moneyVulnNorm + lowBufferVulnNorm + harmReluctanceNorm) / 3;
  const variance =
    (Math.pow(moneyVulnNorm - meanSens, 2) +
      Math.pow(lowBufferVulnNorm - meanSens, 2) +
      Math.pow(harmReluctanceNorm - meanSens, 2)) / 3;

  return (
    <Dialog.Root size="xl" scrollBehavior="inside" motionPreset="slide-in-bottom" placement="center">
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm" colorPalette="gray" flexShrink={0} gap="1.5">
          <Icon><LuInfo /></Icon>
          See full breakdown
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="90dvh" bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl">
            <Dialog.Header borderBottomWidth="1px" borderColor="border.subtle" pb="4">
              <Dialog.Title>
                <VStack align="start" gap="0.5">
                  <Text fontSize="xl" fontWeight="semibold" color="fg">How your interim profile was calculated</Text>
                  <Text fontSize="sm" color="fg.muted" fontWeight="normal">
                    Every formula and data point from Blocks 1–3, substituted with your own responses
                  </Text>
                </VStack>
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" pos="absolute" top="4" insetEnd="4" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body py="6" overflowY="auto">
              <Stack gap="8">
                <Box>
                  <SectionHeading>Score overview</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4">
                    Each score is in 0–1 and mapped to a label:{" "}
                    <Code fontSize="xs">strong ≥ 0.75</Code>, <Code fontSize="xs">moderate ≥ 0.55</Code>,{" "}
                    <Code fontSize="xs">mild ≥ 0.35</Code>, <Code fontSize="xs">low &lt; 0.35</Code>.
                  </Text>
                  <Stack gap="3">
                    <ScoreSummaryRow label="Sensitivity to vulnerable contexts" score={profile.vulnerabilitySensitivityScore} />
                    <ScoreSummaryRow label="Reluctance to cause harm" score={profile.harmReluctanceScore} />
                    <ScoreSummaryRow label="Preference for indirect over direct action" score={profile.directnessAversionScore} />
                    <ScoreSummaryRow label="Responsiveness to the number of workers affected" score={profile.scaleSensitivityScore} />
                    <ScoreSummaryRow label="Consistency across the blocks" score={profile.consistencyAcrossDomainsScore} />
                  </Stack>
                </Box>

                <Separator />

                <Box>
                  <SectionHeading>1 · Sensitivity to vulnerable contexts</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    Combines two signals: how much higher your keep-threshold was outside a homeless shelter
                    than on a neutral sidewalk (Block 1), and how much more financial gain you required before
                    approving harm to low-buffer than high-buffer workers (Block 3).
                  </Text>
                  <VStack align="stretch" gap="4">
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">Your money thresholds</Text>
                      <Stack gap="2">{moneyRows.map((r) => <DataRow key={r.ctxLabel} label={r.ctxLabel} value={r.label} accent={r.label.startsWith("Never") ? "error" : "success"} />)}</Stack>
                    </Box>
                    <FormulaBox>
{`Block 1 money gap = norm(shelter ${shelterIdx}) − norm(sidewalk ${sidewalkIdx})
                  = ${fmt(shelterIdx / MONEY_STEPS)} − ${fmt(sidewalkIdx / MONEY_STEPS)} = ${fmt(moneyVulnGap)}

Block 3 buffer gap = (avg low-buffer ${fmt(avgLowBuffer)} − avg high-buffer ${fmt(avgHighBuffer)}) / ${GAIN_STEPS}
                   = ${fmt(bufferGap)}

score = clamp(0,1,  0.5 + 0.5 × (0.5×buffer_gap + 0.5×money_gap))
      = ${fmt(profile.vulnerabilitySensitivityScore)}  →  "${describeScore(profile.vulnerabilitySensitivityScore)}"`}
                    </FormulaBox>
                  </VStack>
                </Box>

                <Separator />

                <Box>
                  <SectionHeading>2 · Reluctance to cause harm</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    From the two trolley phases. A higher threshold — needing more lives saved before acting —
                    means greater reluctance. Both phases are weighted equally.
                  </Text>
                  <Stack gap="2" mb="4">
                    <DataRow label="Lever phase — acted at" value={leverLabel} accent={leverAccepted ? "success" : "error"} />
                    <DataRow label="Bridge phase — acted at" value={bridgeLabel} accent={bridgeAccepted ? "success" : "error"} />
                  </Stack>
                  <FormulaBox>
{`score = 0.5 × (lever ${leverIdx}/${TROLLEY_STEPS}) + 0.5 × (bridge ${bridgeIdx}/${TROLLEY_STEPS})
      = ${fmt(profile.harmReluctanceScore)}  →  "${describeScore(profile.harmReluctanceScore)}"`}
                  </FormulaBox>
                </Box>

                <Separator />

                <Box>
                  <SectionHeading>3 · Preference for indirect over direct action</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    Compares the lever threshold (redirecting harm) to the bridge threshold (directly pushing).
                    Exactly 0.5 means identical thresholds; above 0.5 means the direct action required a higher bar.
                  </Text>
                  <FormulaBox>
{`score = clamp(0,1,  (bridge ${bridgeIdx} − lever ${leverIdx}) / ${TROLLEY_STEPS} + 0.5)
      = ${fmt(profile.directnessAversionScore)}  →  "${describeScore(profile.directnessAversionScore)}"`}
                  </FormulaBox>
                </Box>

                <Separator />

                <Box>
                  <SectionHeading>4 · Responsiveness to the number of workers affected</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    How far your low-buffer gain threshold moved as the affected group grew from ~10 to ~100,000
                    workers. A wider spread means more sensitivity to scale.
                  </Text>
                  <Stack gap="2" mb="4">
                    <DataRow label="Entry-level · ~10 workers" value={lbSmall < GAIN_STEPS ? (GAIN_OPTIONS[lbSmall]?.label ?? `idx ${lbSmall}`) : "Never approved"} accent={lbSmall < GAIN_STEPS ? "success" : "error"} />
                    <DataRow label="Entry-level · ~1,000 workers" value={lbMedium < GAIN_STEPS ? (GAIN_OPTIONS[lbMedium]?.label ?? `idx ${lbMedium}`) : "Never approved"} accent={lbMedium < GAIN_STEPS ? "success" : "error"} />
                    <DataRow label="Entry-level · ~100,000 workers" value={lbLarge < GAIN_STEPS ? (GAIN_OPTIONS[lbLarge]?.label ?? `idx ${lbLarge}`) : "Never approved"} accent={lbLarge < GAIN_STEPS ? "success" : "error"} />
                  </Stack>
                  <FormulaBox>
{`spread = max(${lbSmall}, ${lbMedium}, ${lbLarge}) − min(${lbSmall}, ${lbMedium}, ${lbLarge}) = ${scaleSpread}
score = clamp(0,1,  spread / ${GAIN_STEPS}) = ${fmt(profile.scaleSensitivityScore)}  →  "${describeScore(profile.scaleSensitivityScore)}"`}
                  </FormulaBox>
                </Box>

                <Separator />

                <Box>
                  <SectionHeading>5 · Consistency across the blocks</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    How much three independent vulnerability signals agree: money-domain (shelter),
                    AI-workforce-domain (low-buffer), and harm reluctance. Low variance = consistent.
                  </Text>
                  <Stack gap="2" mb="4">
                    <DataRow label="Money signal (1 − shelter_norm)" value={fmt(moneyVulnNorm)} />
                    <DataRow label="Entry-level signal (1 − avg_norm)" value={fmt(lowBufferVulnNorm)} />
                    <DataRow label="Harm reluctance signal" value={fmt(harmReluctanceNorm)} />
                    <DataRow label="Variance" value={fmt(variance)} />
                  </Stack>
                  <FormulaBox>
{`score = clamp(0,1,  1 − √variance × 2) = clamp(0,1, 1 − ${fmt(Math.sqrt(variance))} × 2)
      = ${fmt(profile.consistencyAcrossDomainsScore)}  →  "${describeScore(profile.consistencyAcrossDomainsScore)}"`}
                  </FormulaBox>
                </Box>

                <Separator />

                <Box>
                  <SectionHeading>6 · All AI-workforce thresholds</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    The minimum financial gain you required before approving the rollout in each
                    worker-group × size cell.
                  </Text>
                  <Stack gap="2">{aiRows.map((r) => <DataRow key={r.key} label={r.rowLabel} value={r.value} accent={r.accepted ? "success" : "error"} />)}</Stack>
                </Box>
              </Stack>
            </Dialog.Body>

            <Dialog.Footer borderTopWidth="1px" borderColor="border.subtle" pt="4">
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" size="md" w="full" rounded="lg" fontWeight="medium">Back to your brief analysis</Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
