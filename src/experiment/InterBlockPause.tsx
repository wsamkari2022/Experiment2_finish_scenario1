/**
 * InterBlockPause — the screen shown wherever a between-block page used to be.
 *
 * Also used by ExperimentFlow for its own stage transitions. That sharing is the point: because
 * a hidden page and an ordinary transition render the SAME component, the spinner never changes
 * appearance mid-pause, so there is no visual seam where a summary screen was removed. If the two
 * were separate copies, a participant would see the pause flicker at exactly the moment we are
 * trying to make uneventful.
 *
 * See interBlockPages.ts for the switch that decides when this is shown in place of a page.
 */

import { Box, Spinner, Text, VStack } from "@chakra-ui/react";

export function InterBlockPause() {
  return (
    <Box
      minH="100vh"
      bg="bg"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={{ base: "4", md: "6" }}
    >
      <VStack gap="4" animationName="fade-in" animationDuration="moderate">
        <Spinner size="lg" color="fg.muted" />
        <Text color="fg.muted" fontSize="lg" fontStyle="italic">
          Moving to the next section...
        </Text>
      </VStack>
    </Box>
  );
}
