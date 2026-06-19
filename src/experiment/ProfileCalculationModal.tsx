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
import {
  describeScore,
  MONEY_STEPS,
  PRODUCT_STEPS,
  TROLLEY_STEPS,
} from "./profileAnalysis";
import { AMOUNT_LABELS, CONTEXTS } from "./constants";
import { SAVED_LIVES_OPTIONS } from "./trolleyTypes";
import { GROUP_SIZES, GROUP_TYPES, PROFIT_OPTIONS, thresholdKeyFor } from "./productLaunchTypes";

/**
 * ProfileCalculationModal — a Chakra Dialog that shows the full derivation of
 * the five MoralProfile scores.
 *
 * Opened via "See full breakdown" on the Insights page. Each of the seven sections
 * shows the participant's raw threshold indices, the exact formula, and the
 * computed score. All values are substituted inline so the participant can
 * verify every number against their own responses.
 *
 * The modal is read-only and makes no changes to state.
 */

interface ProfileCalculationModalProps {
  /** The derived MoralProfile whose scores are being explained. */
  profile: MoralProfile;
}

/** Formats a 0–1 value as a percentage string (e.g. 0.75 → "75.0%"). */
function pct(val: number): string {
  return (val * 100).toFixed(1) + "%";
}

/** Formats a number to 3 decimal places for formula display. */
function fmt2(val: number): string {
  return val.toFixed(3);
}

/** Horizontal fill bar mapping a 0–1 score to a percentage-width bar. */
function ScoreBar({ score }: { score: number }) {
  return (
    <Box w="full" bg="bg.emphasized" rounded="full" h="2" overflow="hidden">
      <Box
        h="full"
        bg="purple.500"
        rounded="full"
        style={{ width: `${Math.max(4, score * 100)}%` }}
      />
    </Box>
  );
}

/** Styled heading for each of the seven modal sections. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading size="sm" color="purple.400" _dark={{ color: "purple.300" }} mb="1">
      {children}
    </Heading>
  );
}

/** Monospaced code block used to display formulas with substituted values. */
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

/** Key-value row with optional accent colour (success = green, error = red, neutral = fg). */
function DataRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "error" | "neutral";
}) {
  const color =
    accent === "success"
      ? "fg.success"
      : accent === "error"
        ? "fg.error"
        : "fg";
  return (
    <HStack
      justify="space-between"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      pb="2"
      _last={{ borderBottomWidth: 0, pb: 0 }}
    >
      <Text fontSize="sm" color="fg.muted">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="semibold" color={color}>
        {value}
      </Text>
    </HStack>
  );
}

/** Summary row for the overview panel: label, numeric value, level label, and fill bar. */
function ScoreSummaryRow({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const levelColor =
    describeScore(score) === "strong"
      ? "green.400"
      : describeScore(score) === "moderate"
        ? "blue.300"
        : describeScore(score) === "mild"
          ? "yellow.300"
          : "gray.400";
  return (
    <VStack align="stretch" gap="1">
      <HStack justify="space-between">
        <Text fontSize="sm" color="fg.muted">
          {label}
        </Text>
        <HStack gap="2">
          <Text fontSize="xs" color="fg.subtle">
            {fmt2(score)}
          </Text>
          <Text fontSize="sm" fontWeight="semibold" color={levelColor}>
            {describeScore(score)}
          </Text>
        </HStack>
      </HStack>
      <ScoreBar score={score} />
    </VStack>
  );
}

export function ProfileCalculationModal({ profile }: ProfileCalculationModalProps) {
  // Resolve human-readable labels for money thresholds
  const moneyRows = CONTEXTS.map((ctx) => {
    const idx = profile.moneyIndices[ctx.key];
    const accepted = idx < MONEY_STEPS;
    const label = accepted ? (AMOUNT_LABELS[idx] ?? "unknown") : "Never accepted";
    return { ctxLabel: ctx.label, idx, accepted, label };
  });

  // Trolley
  const leverIdx = profile.trolleyIndices.lever;
  const bridgeIdx = profile.trolleyIndices.bridge;
  const leverAccepted = leverIdx < TROLLEY_STEPS;
  const bridgeAccepted = bridgeIdx < TROLLEY_STEPS;
  const leverLabel = leverAccepted
    ? `${SAVED_LIVES_OPTIONS[leverIdx]} lives`
    : "Never accepted";
  const bridgeLabel = bridgeAccepted
    ? `${SAVED_LIVES_OPTIONS[bridgeIdx]} lives`
    : "Never accepted";

  // Product launch rows
  const productRows = GROUP_TYPES.flatMap((gt) =>
    GROUP_SIZES.map((gs) => {
      const key = thresholdKeyFor(gt.key, gs.key);
      const idx = profile.productIndices[key] ?? PRODUCT_STEPS;
      const accepted = idx < PRODUCT_STEPS;
      const label = accepted ? (PROFIT_OPTIONS[idx]?.label ?? "unknown") : "Never accepted";
      return {
        key,
        groupType: gt.label,
        groupSize: gs.label,
        idx,
        accepted,
        label,
      };
    })
  );

  // Vulnerability sensitivity sub-components
  const shelterIdx = profile.moneyIndices.shelter;
  const sidewalkIdx = profile.moneyIndices.sidewalk;
  const moneyVulnGap =
    (shelterIdx / MONEY_STEPS) - (sidewalkIdx / MONEY_STEPS);
  const vulnSmall = profile.productIndices["threshold_vulnerable_small"] ?? PRODUCT_STEPS;
  const vulnMedium = profile.productIndices["threshold_vulnerable_medium"] ?? PRODUCT_STEPS;
  const vulnLarge = profile.productIndices["threshold_vulnerable_large"] ?? PRODUCT_STEPS;
  const wealthySmall = profile.productIndices["threshold_wealthy_small"] ?? PRODUCT_STEPS;
  const wealthyMedium = profile.productIndices["threshold_wealthy_medium"] ?? PRODUCT_STEPS;
  const wealthyLarge = profile.productIndices["threshold_wealthy_large"] ?? PRODUCT_STEPS;
  const avgVulnProduct = (vulnSmall + vulnMedium + vulnLarge) / 3;
  const avgWealthyProduct = (wealthySmall + wealthyMedium + wealthyLarge) / 3;
  const vulnProductGap = (avgVulnProduct - avgWealthyProduct) / PRODUCT_STEPS;

  // Scale sensitivity
  const scaleSpread =
    Math.max(vulnSmall, vulnMedium, vulnLarge) -
    Math.min(vulnSmall, vulnMedium, vulnLarge);

  // Consistency sub-scores
  const moneyVulnNorm = 1 - shelterIdx / MONEY_STEPS;
  const productVulnNorm = 1 - avgVulnProduct / PRODUCT_STEPS;
  const harmReluctanceNorm = profile.harmReluctanceScore;
  const meanSens = (moneyVulnNorm + productVulnNorm + harmReluctanceNorm) / 3;
  const variance =
    (Math.pow(moneyVulnNorm - meanSens, 2) +
      Math.pow(productVulnNorm - meanSens, 2) +
      Math.pow(harmReluctanceNorm - meanSens, 2)) /
    3;

  return (
    <Dialog.Root
      size="xl"
      scrollBehavior="inside"
      motionPreset="slide-in-bottom"
      placement="center"
    >
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          colorPalette="gray"
          flexShrink={0}
          gap="1.5"
        >
          <Icon>
            <LuInfo />
          </Icon>
          See full breakdown
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            maxH="90dvh"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
            rounded="2xl"
          >
            <Dialog.Header borderBottomWidth="1px" borderColor="border.subtle" pb="4">
              <Dialog.Title>
                <VStack align="start" gap="0.5">
                  <Text fontSize="xl" fontWeight="semibold" color="fg">
                    How your profile was calculated
                  </Text>
                  <Text fontSize="sm" color="fg.muted" fontWeight="normal">
                    A full breakdown of every formula, data point, and score
                  </Text>
                </VStack>
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" pos="absolute" top="4" insetEnd="4" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body py="6" overflowY="auto">
              <Stack gap="8">

                {/* ── Score overview ── */}
                <Box>
                  <SectionHeading>Score overview</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4">
                    All five scores are normalised to the range 0–1 and then mapped
                    to a label: <Code fontSize="xs">strong ≥ 0.75</Code>,{" "}
                    <Code fontSize="xs">moderate ≥ 0.55</Code>,{" "}
                    <Code fontSize="xs">mild ≥ 0.35</Code>,{" "}
                    <Code fontSize="xs">low &lt; 0.35</Code>.
                  </Text>
                  <Stack gap="3">
                    <ScoreSummaryRow
                      label="Sensitivity to vulnerable contexts"
                      score={profile.vulnerabilitySensitivityScore}
                    />
                    <ScoreSummaryRow
                      label="Reluctance to cause harm"
                      score={profile.harmReluctanceScore}
                    />
                    <ScoreSummaryRow
                      label="Preference for indirect over direct action"
                      score={profile.directnessAversionScore}
                    />
                    <ScoreSummaryRow
                      label="Responsiveness to number of people affected"
                      score={profile.scaleSensitivityScore}
                    />
                    <ScoreSummaryRow
                      label="Consistency across the blocks"
                      score={profile.consistencyAcrossDomainsScore}
                    />
                  </Stack>
                </Box>

                <Separator />

                {/* ── Section 1: Vulnerability Sensitivity ── */}
                <Box>
                  <SectionHeading>1 · Sensitivity to vulnerable contexts</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    This score combines two signals: how much your money-keeping
                    threshold changed when the context shifted from a neutral
                    sidewalk to outside a homeless shelter (money gap), and how
                    much higher a profit you required before launching a product
                    that harms vulnerable people vs wealthy people (product gap).
                    A higher gap in either signal raises this score.
                  </Text>

                  <VStack align="stretch" gap="4">
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Your money thresholds
                      </Text>
                      <Stack gap="2">
                        {moneyRows.map((r) => (
                          <DataRow
                            key={r.ctxLabel}
                            label={r.ctxLabel}
                            value={r.label}
                            accent={r.accepted ? "success" : "error"}
                          />
                        ))}
                      </Stack>
                    </Box>

                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Money gap calculation
                      </Text>
                      <FormulaBox>
                        {`shelter_index = ${shelterIdx}  (out of ${MONEY_STEPS} steps)
sidewalk_index = ${sidewalkIdx}  (out of ${MONEY_STEPS} steps)

money_vuln_gap = norm(shelter) − norm(sidewalk)
              = ${fmt2(shelterIdx / MONEY_STEPS)} − ${fmt2(sidewalkIdx / MONEY_STEPS)}
              = ${fmt2(moneyVulnGap)}`}
                      </FormulaBox>
                    </Box>

                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Product gap calculation
                      </Text>
                      <FormulaBox>
                        {`avg_vulnerable_product = (${vulnSmall} + ${vulnMedium} + ${vulnLarge}) / 3
                       = ${fmt2(avgVulnProduct)}

avg_wealthy_product   = (${wealthySmall} + ${wealthyMedium} + ${wealthyLarge}) / 3
                       = ${fmt2(avgWealthyProduct)}

vuln_product_gap = (avg_vuln − avg_wealthy) / ${PRODUCT_STEPS}
                 = (${fmt2(avgVulnProduct)} − ${fmt2(avgWealthyProduct)}) / ${PRODUCT_STEPS}
                 = ${fmt2(vulnProductGap)}`}
                      </FormulaBox>
                    </Box>

                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Final score formula
                      </Text>
                      <FormulaBox>
                        {`score = clamp(0, 1,  0.5 + 0.5 × (0.5×product_gap + 0.5×money_gap))
      = clamp(0, 1,  0.5 + 0.5 × (0.5×${fmt2(vulnProductGap)} + 0.5×${fmt2(moneyVulnGap)}))
      = ${fmt2(profile.vulnerabilitySensitivityScore)}  →  "${describeScore(profile.vulnerabilitySensitivityScore)}"`}
                      </FormulaBox>
                    </Box>
                  </VStack>
                </Box>

                <Separator />

                {/* ── Section 2: Harm Reluctance ── */}
                <Box>
                  <SectionHeading>2 · Reluctance to cause harm</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    Derived entirely from the trolley problems. The lever scenario
                    asks you to redirect harm (indirect); the bridge scenario asks
                    you to actively push someone (direct). A higher threshold —
                    needing more lives saved before acting — means greater reluctance.
                    Both scenarios are weighted equally.
                  </Text>

                  <VStack align="stretch" gap="4">
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Your trolley thresholds
                      </Text>
                      <Stack gap="2">
                        <DataRow
                          label="Lever scenario — accepted at"
                          value={leverLabel}
                          accent={leverAccepted ? "success" : "error"}
                        />
                        <DataRow
                          label="Bridge scenario — accepted at"
                          value={bridgeLabel}
                          accent={bridgeAccepted ? "success" : "error"}
                        />
                      </Stack>
                    </Box>

                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Formula
                      </Text>
                      <FormulaBox>
                        {`lever_norm  = ${leverIdx} / ${TROLLEY_STEPS} = ${fmt2(leverIdx / TROLLEY_STEPS)}
bridge_norm = ${bridgeIdx} / ${TROLLEY_STEPS} = ${fmt2(bridgeIdx / TROLLEY_STEPS)}

score = clamp(0, 1,  0.5×lever_norm + 0.5×bridge_norm)
      = clamp(0, 1,  0.5×${fmt2(leverIdx / TROLLEY_STEPS)} + 0.5×${fmt2(bridgeIdx / TROLLEY_STEPS)})
      = ${fmt2(profile.harmReluctanceScore)}  →  "${describeScore(profile.harmReluctanceScore)}"`}
                      </FormulaBox>
                    </Box>
                  </VStack>
                </Box>

                <Separator />

                {/* ── Section 3: Directness Aversion ── */}
                <Box>
                  <SectionHeading>3 · Preference for indirect over direct action</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    Compares your lever threshold (redirecting harm) to your
                    bridge threshold (directly pushing someone). When you needed
                    more lives saved for the bridge scenario than the lever, it
                    signals a preference for indirect action. A score of exactly
                    0.5 means your thresholds were identical; above 0.5 means the
                    bridge required a higher bar.
                  </Text>

                  <VStack align="stretch" gap="4">
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Threshold comparison
                      </Text>
                      <Stack gap="2">
                        <DataRow label="Lever threshold index" value={`${leverIdx} / ${TROLLEY_STEPS}`} />
                        <DataRow label="Bridge threshold index" value={`${bridgeIdx} / ${TROLLEY_STEPS}`} />
                        <DataRow
                          label="Gap (bridge − lever)"
                          value={String(bridgeIdx - leverIdx)}
                          accent={bridgeIdx > leverIdx ? "success" : bridgeIdx < leverIdx ? "error" : "neutral"}
                        />
                      </Stack>
                    </Box>

                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Formula
                      </Text>
                      <FormulaBox>
                        {`score = clamp(0, 1,  (bridge_idx − lever_idx) / ${TROLLEY_STEPS} + 0.5)
      = clamp(0, 1,  (${bridgeIdx} − ${leverIdx}) / ${TROLLEY_STEPS} + 0.5)
      = clamp(0, 1,  ${fmt2((bridgeIdx - leverIdx) / TROLLEY_STEPS)} + 0.5)
      = ${fmt2(profile.directnessAversionScore)}  →  "${describeScore(profile.directnessAversionScore)}"`}
                      </FormulaBox>
                    </Box>
                  </VStack>
                </Box>

                <Separator />

                {/* ── Section 4: Scale Sensitivity ── */}
                <Box>
                  <SectionHeading>4 · Responsiveness to the number of people affected</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    Looks at whether your profit threshold changed when the number
                    of vulnerable people harmed grew from a small group (~10) to a
                    medium group (~1,000) to a large group (~100,000). A wider
                    spread between your smallest and largest thresholds means your
                    decisions were more sensitive to scale.
                  </Text>

                  <VStack align="stretch" gap="4">
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Vulnerable group product thresholds
                      </Text>
                      <Stack gap="2">
                        <DataRow
                          label="Small group (~10 people)"
                          value={vulnSmall < PRODUCT_STEPS ? (PROFIT_OPTIONS[vulnSmall]?.label ?? `index ${vulnSmall}`) : "Never accepted"}
                          accent={vulnSmall < PRODUCT_STEPS ? "success" : "error"}
                        />
                        <DataRow
                          label="Medium group (~1,000 people)"
                          value={vulnMedium < PRODUCT_STEPS ? (PROFIT_OPTIONS[vulnMedium]?.label ?? `index ${vulnMedium}`) : "Never accepted"}
                          accent={vulnMedium < PRODUCT_STEPS ? "success" : "error"}
                        />
                        <DataRow
                          label="Large group (~100,000 people)"
                          value={vulnLarge < PRODUCT_STEPS ? (PROFIT_OPTIONS[vulnLarge]?.label ?? `index ${vulnLarge}`) : "Never accepted"}
                          accent={vulnLarge < PRODUCT_STEPS ? "success" : "error"}
                        />
                      </Stack>
                    </Box>

                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Formula
                      </Text>
                      <FormulaBox>
                        {`spread = max(${vulnSmall}, ${vulnMedium}, ${vulnLarge}) − min(${vulnSmall}, ${vulnMedium}, ${vulnLarge})
       = ${Math.max(vulnSmall, vulnMedium, vulnLarge)} − ${Math.min(vulnSmall, vulnMedium, vulnLarge)}
       = ${scaleSpread}

score = clamp(0, 1,  spread / ${PRODUCT_STEPS})
      = ${fmt2(profile.scaleSensitivityScore)}  →  "${describeScore(profile.scaleSensitivityScore)}"`}
                      </FormulaBox>
                    </Box>
                  </VStack>
                </Box>

                <Separator />

                {/* ── Section 5: Consistency ── */}
                <Box>
                  <SectionHeading>5 · Consistency across the blocks</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    Measures how much three independent signals of sensitivity agree
                    with each other: your money-domain vulnerability sensitivity,
                    your product-domain vulnerability sensitivity, and your harm
                    reluctance score. Low variance across these three values means
                    your responses were consistent; high variance means different
                    domains pulled in different directions.
                  </Text>

                  <VStack align="stretch" gap="4">
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        The three sub-scores
                      </Text>
                      <Stack gap="2">
                        <DataRow
                          label="Money vulnerability signal  (1 − shelter_norm)"
                          value={fmt2(moneyVulnNorm)}
                        />
                        <DataRow
                          label="Product vulnerability signal  (1 − avg_vuln_norm)"
                          value={fmt2(productVulnNorm)}
                        />
                        <DataRow
                          label="Harm reluctance signal"
                          value={fmt2(harmReluctanceNorm)}
                        />
                        <DataRow label="Mean of the three" value={fmt2(meanSens)} />
                        <DataRow label="Variance" value={fmt2(variance)} />
                      </Stack>
                    </Box>

                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" mb="2">
                        Formula
                      </Text>
                      <FormulaBox>
                        {`variance = [ (${fmt2(moneyVulnNorm)} − ${fmt2(meanSens)})²
          + (${fmt2(productVulnNorm)} − ${fmt2(meanSens)})²
          + (${fmt2(harmReluctanceNorm)} − ${fmt2(meanSens)})² ] / 3
        = ${fmt2(variance)}

score = clamp(0, 1,  1 − √variance × 2)
      = clamp(0, 1,  1 − ${fmt2(Math.sqrt(variance))} × 2)
      = ${fmt2(profile.consistencyAcrossDomainsScore)}  →  "${describeScore(profile.consistencyAcrossDomainsScore)}"`}
                      </FormulaBox>
                    </Box>
                  </VStack>
                </Box>

                <Separator />

                {/* ── Section 6: All product launch data ── */}
                <Box>
                  <SectionHeading>6 · All product launch thresholds</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="4" lineHeight="tall">
                    For reference, here are all six product launch thresholds from
                    your responses — the minimum profit you required before
                    agreeing to launch in each combination of affected group type
                    and size.
                  </Text>
                  <Stack gap="2">
                    {productRows.map((r) => (
                      <DataRow
                        key={r.key}
                        label={`${r.groupType.charAt(0).toUpperCase() + r.groupType.slice(1)} · ${r.groupSize}`}
                        value={r.label}
                        accent={r.accepted ? "success" : "error"}
                      />
                    ))}
                  </Stack>
                </Box>

                <Separator />

                {/* ── Section 7: Label reference ── */}
                <Box>
                  <SectionHeading>7 · Label reference</SectionHeading>
                  <Text fontSize="sm" color="fg.muted" mb="3" lineHeight="tall">
                    Every score is converted to a label using the same thresholds:
                  </Text>
                  <Stack gap="2">
                    <DataRow label="strong" value="score ≥ 0.75" accent="success" />
                    <DataRow label="moderate" value="score ≥ 0.55" />
                    <DataRow label="mild" value="score ≥ 0.35" />
                    <DataRow label="low" value="score < 0.35" accent="error" />
                  </Stack>
                  <Text fontSize="xs" color="fg.subtle" mt="3" fontStyle="italic">
                    All scores are clamped to [0, 1] before the label is applied.
                    Index values beyond the maximum step count indicate the
                    participant never accepted the action at any level tested.
                  </Text>
                </Box>

              </Stack>
            </Dialog.Body>

            <Dialog.Footer borderTopWidth="1px" borderColor="border.subtle" pt="4">
              <Dialog.ActionTrigger asChild>
                <Button
                  variant="outline"
                  size="md"
                  w="full"
                  rounded="lg"
                  fontWeight="medium"
                >
                  Back to your brief analysis
                </Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
