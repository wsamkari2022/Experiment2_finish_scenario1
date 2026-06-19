import { Box, HStack } from "@chakra-ui/react";

interface ProgressBarProps {
  /** Total number of steps (equals the number of segments rendered). */
  total: number;
  /** Index of the current step (0-based); all segments up to and including this index are filled. */
  current: number;
}

/**
 * Horizontal step indicator shown at the top of each block.
 * Renders `total` equal-width segments; segments with index ≤ `current` are filled.
 */
export function ProgressBar({ total, current }: ProgressBarProps) {
  return (
    <HStack gap="2" w="full" maxW="2xl" mx="auto" justify="center">
      {Array.from({ length: total }).map((_, i) => {
        const active = i <= current;
        return (
          <Box
            key={i}
            flex="1"
            h="3"
            rounded="full"
            bg={active ? "purple.600" : "bg.subtle"}
            borderWidth="1px"
            borderColor={active ? "purple.600" : "border.subtle"}
            transition="background-color 0.35s ease"
          />
        );
      })}
    </HStack>
  );
}
