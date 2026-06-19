import { Box, Button, Heading, Stack, Text, VStack } from "@chakra-ui/react";
import type { MoneyBlockResults, ThresholdResult } from "./types";

interface CompletionScreenProps {
  results: MoneyBlockResults;
  onContinue: () => void;
}

function formatThreshold(t: ThresholdResult | null): string {
  if (!t) return "Not recorded";
  if (t.thresholdBeyondRange || !t.accepted) {
    return "No acceptance within range";
  }
  return t.thresholdLabel ?? "Not recorded";
}

export function CompletionScreen({ results, onContinue }: CompletionScreenProps) {
  const { thresholds } = results;
  return (
    <VStack gap="8" align="stretch" animationName="fade-in" animationDuration="moderate">
      <VStack gap="3" textAlign="center">
        <Heading size="2xl" color="fg" fontWeight="semibold">
          Money block complete
        </Heading>
        <Text color="fg.muted" fontSize="lg" maxW="2xl" mx="auto">
          Your responses for the found-money scenarios have been recorded.
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
          Summary of acceptance thresholds
        </Heading>
        <Stack gap="4">
          <SummaryRow
            label="Neutral sidewalk"
            value={formatThreshold(thresholds.threshold_sidewalk)}
          />
          <SummaryRow
            label="Wealthy financial district"
            value={formatThreshold(thresholds.threshold_wealthy)}
          />
          <SummaryRow
            label="Outside a homeless shelter"
            value={formatThreshold(thresholds.threshold_shelter)}
          />
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
