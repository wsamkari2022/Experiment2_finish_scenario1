/**
 * AttentionCheckScreen — the colour check (between two of the first parts) and the letter check (between two
 * scenarios), since 29 September 2026. See attentionChecks.ts for the why and the rules.
 *
 * It says openly that it is an attention check, asks for one named colour or one letter out of four, and lets the
 * participant continue after ANY pick. It never says whether the pick was right. Each colour button shows its name
 * as well as its colour, so a colour-blind participant can pass by reading. The seconds from the screen appearing
 * to Continue, and how often the pick changed, are saved with the answer.
 */

import { useRef, useState } from "react";
import { Badge, Box, Button, Center, Heading, Icon, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight, LuEye } from "react-icons/lu";
import { COLOURS, readAttention, recordAttentionAnswer, type AttentionCheckId } from "./attentionChecks";

export function AttentionCheckScreen({ check, onDone }: { check: Extract<AttentionCheckId, "colour" | "letter">; onDone: () => void }) {
  const [plan] = useState(() => readAttention().plan);
  /* The moment the screen appeared, taken once (a lazy state initializer, not a render-time call). */
  const [shownAt] = useState(() => Date.now());
  const changes = useRef(0);
  const [picked, setPicked] = useState<string | null>(null);

  const isColour = check === "colour";
  const options: string[] = isColour ? plan.colour.options : plan.letter.options;
  const colourOf = (key: string) => COLOURS.find((c) => c.key === key);
  const target = isColour ? colourOf(plan.colour.target)?.name.toLowerCase() ?? plan.colour.target : plan.letter.target;

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
      <Box w="full" maxW="xl" rounded="2xl" borderWidth="1px" borderColor="border" bg="bg.panel" shadow="sm"
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
            {isColour ? <>Please tap the <b>{target}</b> circle.</> : <>Please tap the letter <b>{target}</b>.</>}
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 2, sm: 4 }} gap="3" mt="7">
          {options.map((value) => {
            const on = picked === value;
            const colour = isColour ? colourOf(value) : undefined;
            return (
              <Button key={value} onClick={() => choose(value)} variant="outline" h="auto" py="4" rounded="xl"
                flexDirection="column" gap="2" borderWidth={on ? "2px" : "1px"}
                borderColor={on ? "blue.solid" : "border"} bg={on ? "blue.subtle" : "bg.panel"}
                aria-pressed={on} data-attention-option={value}>
                {colour ? (
                  <>
                    <Box boxSize="9" rounded="full" style={{ background: colour.swatch }} />
                    <Text fontSize="sm" fontWeight="medium" color="fg">{colour.name}</Text>
                  </>
                ) : (
                  <Text fontSize="3xl" fontWeight="bold" color="fg" lineHeight="1">{value}</Text>
                )}
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
