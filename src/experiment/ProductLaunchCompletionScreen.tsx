import { Box, Button, Heading, Stack, Text, VStack } from "@chakra-ui/react";
import {
  GROUP_SIZES,
  GROUP_TYPES,
  type LaunchThresholdResult,
  type ProductLaunchBlockResults,
  thresholdKeyFor,
} from "./productLaunchTypes";

interface ProductLaunchCompletionScreenProps {
  results: ProductLaunchBlockResults;
  onContinue: () => void;
}

function describeThreshold(r: LaunchThresholdResult): {
  text: string;
  tone: "ok" | "range" | "blocked";
} {
  if (r.blockedByPriorNonAcceptance) {
    return { text: "Blocked by prior non-acceptance", tone: "blocked" };
  }
  if (r.thresholdBeyondRange || !r.accepted) {
    return { text: "No acceptance within range", tone: "range" };
  }
  return { text: r.thresholdProfitLabel ?? "—", tone: "ok" };
}

export function ProductLaunchCompletionScreen({
  results,
  onContinue,
}: ProductLaunchCompletionScreenProps) {
  const rows = GROUP_TYPES.flatMap((gt) =>
    GROUP_SIZES.map((gs) => {
      const key = thresholdKeyFor(gt.key, gs.key);
      const r = results.thresholds[key];
      const { text, tone } = describeThreshold(r);
      const label = `${gt.key === "vulnerable" ? "Vulnerable" : "Wealthy"} / ${gs.key.charAt(0).toUpperCase() + gs.key.slice(1)}`;
      return { label, text, tone };
    }),
  );

  return (
    <VStack
      gap="8"
      align="stretch"
      animationName="fade-in"
      animationDuration="moderate"
    >
      <VStack gap="3" textAlign="center">
        <Heading size="2xl" color="fg" fontWeight="semibold">
          Product launch block complete
        </Heading>
        <Text color="fg.muted" fontSize="lg" maxW="2xl" mx="auto">
          Your responses for the product launch scenarios have been recorded.
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
          Threshold summary
        </Heading>
        <Stack gap="4">
          {rows.map((row) => (
            <Box
              key={row.label}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              pb="3"
              _last={{ borderBottomWidth: 0, pb: 0 }}
            >
              <Text color="fg.muted" fontSize="md">
                {row.label}
              </Text>
              <Text
                fontSize="md"
                fontWeight="semibold"
                color={
                  row.tone === "ok"
                    ? "green.300"
                    : row.tone === "blocked"
                      ? "gray.500"
                      : "orange.300"
                }
                fontStyle={row.tone === "blocked" ? "italic" : "normal"}
              >
                {row.text}
              </Text>
            </Box>
          ))}
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
