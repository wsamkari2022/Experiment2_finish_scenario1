import { Box, Button, Heading, Stack, Text, VStack } from "@chakra-ui/react";
import {
  WORKER_GROUPS,
  WORKER_GROUP_SIZES,
  aiWorkforceThresholdKeyFor,
  type AIWorkforceBlockResults,
  type AIWorkforceThresholdResult,
} from "./aiWorkforceTypes";

interface Props {
  results: AIWorkforceBlockResults;
  onContinue: () => void;
}

function describe(r: AIWorkforceThresholdResult): {
  text: string;
  tone: "ok" | "range" | "blocked";
} {
  if (r.blockedByPriorNonAcceptance) {
    return { text: "Blocked by prior non-acceptance", tone: "blocked" };
  }
  if (r.thresholdBeyondRange || !r.accepted) {
    return { text: "No acceptance within range", tone: "range" };
  }
  return { text: r.thresholdGainLabel ?? "—", tone: "ok" };
}

export function AIWorkforceCompletionScreen({ results, onContinue }: Props) {
  const rows = WORKER_GROUPS.flatMap((gt) =>
    WORKER_GROUP_SIZES.map((gs) => {
      const key = aiWorkforceThresholdKeyFor(gt.key, gs.key);
      const r = results.thresholds[key];
      const { text, tone } = describe(r);
      return {
        label: `${gt.shortLabel} / ${gs.shortLabel}`,
        text,
        tone,
      };
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
          AI workforce block complete
        </Heading>
        <Text color="fg.muted" fontSize="lg" maxW="2xl" mx="auto">
          Your approval thresholds across the worker groups have been recorded.
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
