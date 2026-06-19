import { Box, Button, Heading, Stack, Text, VStack } from "@chakra-ui/react";
import type { TrolleyBlockResults } from "./trolleyTypes";

interface TrolleyCompletionScreenProps {
  results: TrolleyBlockResults;
  onContinue: () => void;
}

function formatPeople(n: number | null): string {
  if (n == null) return "—";
  return `${n.toLocaleString()} ${n === 1 ? "person" : "people"}`;
}

export function TrolleyCompletionScreen({
  results,
  onContinue,
}: TrolleyCompletionScreenProps) {
  const { leverThreshold, bridgeThreshold, summary } = results;

  const leverDisplay = leverThreshold.accepted
    ? formatPeople(leverThreshold.thresholdSavedLives)
    : "No acceptance within range";

  let bridgeDisplay: string;
  if (!leverThreshold.accepted) {
    bridgeDisplay = "Not reached";
  } else if (!bridgeThreshold || !bridgeThreshold.accepted) {
    bridgeDisplay = "No acceptance within range";
  } else {
    bridgeDisplay = formatPeople(bridgeThreshold.thresholdSavedLives);
  }

  const consistencyDisplay = (() => {
    if (summary.consistencyAtSameNumber === true) return "Yes";
    if (summary.consistencyAtSameNumber === false) return "No";
    return "—";
  })();

  const directnessDisplay =
    summary.directnessGap == null
      ? "—"
      : summary.directnessGap.toLocaleString();

  return (
    <VStack
      gap="8"
      align="stretch"
      animationName="fade-in"
      animationDuration="moderate"
    >
      <VStack gap="3" textAlign="center">
        <Heading size="2xl" color="fg" fontWeight="semibold">
          Trolley block complete
        </Heading>
        <Text color="fg.muted" fontSize="lg" maxW="2xl" mx="auto">
          Your responses for the trolley scenarios have been recorded.
        </Text>
      </VStack>

      <Box
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border"
        rounded="xl"
        p="8"
        shadow="sm"
      >
        <Heading size="md" mb="5" color="fg">
          Summary of trolley responses
        </Heading>
        <Stack gap="4">
          <SummaryRow label="Lever acceptance threshold" value={leverDisplay} />
          <SummaryRow
            label="Bridge acceptance threshold"
            value={bridgeDisplay}
          />
          <SummaryRow
            label="Consistent at same number"
            value={consistencyDisplay}
          />
          <SummaryRow label="Directness gap" value={directnessDisplay} />
        </Stack>
      </Box>

      <Button
        size="xl"
        onClick={onContinue}
        bg="gray.900"
        color="white"
        _hover={{ bg: "gray.800" }}
        rounded="lg"
        fontWeight="medium"
        alignSelf="center"
        px="10"
      >
        Continue to next section
      </Button>
    </VStack>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      pb="3"
      _last={{ borderBottomWidth: 0, pb: 0 }}
    >
      <Text color="fg.muted" fontSize="md">
        {label}
      </Text>
      <Text color="fg" fontSize="md" fontWeight="semibold">
        {value}
      </Text>
    </Box>
  );
}
