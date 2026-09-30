/**
 * AttentionCheckScreen — the two attention checks inside the study (since 29 September 2026; since 30 September 2026
 * one question each about what the participant has just finished, in the researcher's approved words): right after
 * Block 3, and right after scenario 3. See attentionChecks.ts for the why and the rules.
 *
 * It says openly that it is an attention check, asks what the part just finished was about, and offers four answers in
 * the order drawn for this participant. Any pick lets the participant continue, and it never says whether the pick was
 * right. Words only, so it is fair to colour-blind people. The seconds from the screen appearing to Continue, and how
 * often the pick changed, are saved with the answer.
 */

import { useRef, useState } from "react";
import { Badge, Box, Button, Center, Heading, Icon, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight, LuEye } from "react-icons/lu";
import { TOPIC_CHECKS, readAttention, recordAttentionAnswer, type TopicCheckId } from "./attentionChecks";

export function AttentionCheckScreen({ check, onDone }: { check: TopicCheckId; onDone: () => void }) {
  const [options] = useState(() => readAttention().plan[check].options);
  /* The moment the screen appeared, taken once (a lazy state initializer, not a render-time call). */
  const [shownAt] = useState(() => Date.now());
  const changes = useRef(0);
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (value: string) => {
    if (picked !== null && picked !== value) changes.current += 1;
    setPicked(value);
  };
  const finish = () => {
    if (picked === null) return;
    recordAttentionAnswer(check, picked, (Date.now() - shownAt) / 1000, changes.current);
    onDone();
  };

  return (
    <Box minH="100dvh" bg="bg" px={{ base: "4", md: "6" }} py={{ base: "10", md: "16" }} display="flex"
      alignItems="flex-start" justifyContent="center">
      <Box w="full" maxW="2xl" rounded="2xl" borderWidth="1px" borderColor="border" bg="bg.panel" shadow="sm"
        px={{ base: "5", md: "8" }} py={{ base: "6", md: "8" }} animationName="fade-in" animationDuration="moderate">
        <VStack gap="3" textAlign="center">
          <Center boxSize="11" rounded="full" bg="blue.subtle" color="blue.fg">
            <Icon boxSize="5"><LuEye /></Icon>
          </Center>
          <Badge colorPalette="blue" variant="subtle" rounded="md" px="2.5" textTransform="uppercase" letterSpacing="wider"
            fontSize="2xs">Quick check</Badge>
          <Heading size="lg" color="fg" fontWeight="semibold">Quick attention check</Heading>
          <Text color="fg.muted" fontSize="md" lineHeight="tall">
            This question is only to check that you are reading.
          </Text>
          <Text color="fg" fontSize="lg" fontWeight="medium" data-attention-instruction>
            {TOPIC_CHECKS[check].question}
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" mt="7">
          {options.map((value) => {
            const on = picked === value;
            return (
              <Button key={value} onClick={() => choose(value)} variant="outline" h="auto" minH="16" py="3.5" px="4"
                rounded="xl" whiteSpace="normal" textAlign="center" lineHeight="short" fontSize="sm" fontWeight="medium"
                color="fg" borderWidth={on ? "2px" : "1px"} borderColor={on ? "blue.solid" : "border"}
                bg={on ? "blue.subtle" : "bg.panel"} aria-pressed={on} data-attention-option={value}>
                {value}
              </Button>
            );
          })}
        </SimpleGrid>

        <Box textAlign="center" mt="7">
          <Button onClick={finish} disabled={picked === null} colorPalette="blue" size="lg" rounded="lg" px="8" gap="2">
            Continue
            <Icon><LuArrowRight /></Icon>
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
