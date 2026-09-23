/**
 * Block5MCFPanel.tsx — the Moral Commitment Function, in words.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT SAYS, AND WHAT IT REFUSES TO SAY
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * For one option: what it gives beyond what the participant asked for, what it asks of them,
 * which option on this table serves each of those values most, and what taking that one instead
 * would give up in exchange. Four sentences, one option at a time.
 *
 * IT NEVER PRINTS A NUMBER, A SCORE, A LABEL OR A RANKING. Not the value numbers, not the
 * shortfall, not "aligned", not "best fit", not "recommended". The participant is never shown an
 * alignment verdict or the scoring arithmetic anywhere in this study, and a panel that said "this
 * option fits you 62%" would hand them the answer to the question the block exists to ask. Gate M5
 * in `npm run validate:mcf` keeps that vocabulary out of the data; this file keeps it out of the
 * sentences.
 *
 * WHAT IT DELIBERATELY OMITS, AND WHY. block5MCF also computes whether the swap option costs the
 * participant MORE or LESS overall. That number is exactly a fit comparison between two options,
 * so it is not rendered here at all - only what the swap gives up instead, which is a fact about
 * the options rather than a verdict about the person.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHY IT LIVES IN THE COMPARE OVERLAY AND NOWHERE ELSE
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * The overlay is something a participant chooses to open, and it already draws their own four
 * values as a dashed shape with a caption saying that any corner inside it is something they said
 * mattered and the option gives up. This panel is that same disclosure in sentences, for the
 * participants who cannot read a radar chart. Moving it onto the option cards would change it from
 * a thing they went looking for into a thing they are told while choosing, which is a different
 * study.
 *
 * EVERY OPTION STARTS CLOSED. Six open readings is a wall of text nobody reads, and opening one is
 * the act that says which option a participant is weighing - which is worth recording (stage 3).
 */

import { useCallback, useState } from "react";
import { Box, HStack, Icon, Stack, Text, VStack } from "@chakra-ui/react";
import { LuChevronDown, LuChevronUp, LuScale } from "react-icons/lu";
import type { Block5PolicyDimKey, Block5Scenario } from "./block5Types";
import type { Block5Palette } from "./block5Palette";
import { mcfFromScores, type McfOption } from "./block5MCF";
import { mcfSentences } from "./block5MCFWords";

export function Block5MCFPanel({
  scenario, yourPolicyScores, pal, onOpenOption,
}: {
  scenario: Block5Scenario;
  /** The participant's four values as they stand now — the same numbers the dashed shape uses. */
  yourPolicyScores: Record<Block5PolicyDimKey, number>;
  pal: Block5Palette;
  /**
   * Told which reading is open, and told null the moment one closes.
   *
   * Both halves matter: the open says which option was weighed, and the close is what stops the
   * dwell clock. A hook that only fired on open would report every reading as lasting until the
   * scenario ended.
   */
  onOpenOption?: (optionId: string | null) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const reading = mcfFromScores(scenario, yourPolicyScores);
  const titleOf = (id: string) => scenario.options.find((o) => o.id === id)?.title ?? id;

  const toggle = useCallback((id: string) => {
    setOpenId((current) => {
      const next = current === id ? null : id;
      onOpenOption?.(next);
      return next;
    });
  }, [onOpenOption]);

  return (
    <Box
      bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder}
      borderLeftWidth="4px" rounded="lg" style={{ borderLeftColor: pal.accent }}
      px={{ base: "4", md: "5" }} py={{ base: "4", md: "4.5" }}
    >
      <HStack gap="2" mb="1.5">
        <Icon color={pal.accent} boxSize="4"><LuScale /></Icon>
        <Text fontSize="2xs" fontWeight="bold" letterSpacing="widest" textTransform="uppercase"
          color={pal.accent}>
          What each option asks of your four values
        </Text>
      </HStack>
      <Text fontSize="xs" color={pal.textMuted} lineHeight="tall" mb="3.5">
        The chart above in words. Open an option to read what it gives beyond what you asked for,
        what it asks of you instead, and which other option on this table serves those values most.
        Nothing here is a recommendation — every one of these options can be chosen.
      </Text>

      <Stack gap="2">
        {reading.options.map((row) => {
          const open = openId === row.optionId;
          return (
            <Box key={row.optionId} bg={pal.cardBg} borderWidth="1px" borderColor={pal.cardBorder}
              rounded="lg" px="3.5" py="2.5">
              <HStack
                as="button" w="full" gap="3" align="center" textAlign="left"
                onClick={() => toggle(row.optionId)}
                aria-expanded={open}
                _hover={{ opacity: 0.85 }}
              >
                <Text fontSize="sm" fontWeight="semibold" color={pal.text} flex="1" minW="0"
                  lineHeight="short">
                  {titleOf(row.optionId)}
                </Text>
                <Icon boxSize="4" color={pal.textMuted}>
                  {open ? <LuChevronUp /> : <LuChevronDown />}
                </Icon>
              </HStack>

              {open && <Reading row={row} titleOf={titleOf} pal={pal} />}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

/**
 * The four sentences.
 *
 * EVERY WORD COMES FROM block5MCFWords. This component chooses colour, order and spacing and
 * writes no English of its own, so the two rules that matter - no verdict, no arithmetic - are
 * enforced on plain strings by gate M7 rather than by reading JSX.
 */
function Reading({ row, titleOf, pal }: {
  row: McfOption;
  titleOf: (id: string) => string;
  pal: Block5Palette;
}) {
  const said = mcfSentences(row, titleOf);

  const line = (label: string, color: string, body: React.ReactNode) => (
    <HStack gap="2.5" align="start">
      <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider"
        color={color} minW={{ base: "16", md: "20" }} mt="0.5">
        {label}
      </Text>
      <Text fontSize="xs" color={pal.textMuted} lineHeight="tall" flex="1">{body}</Text>
    </HStack>
  );

  return (
    <VStack align="stretch" gap="2" mt="3" pt="3"
      borderTopWidth="1px" borderTopColor={pal.cardBorder}>
      {line("It gives", pal.gainColor, said.gives)}
      {line("It asks", pal.costColor, said.asks)}
      {said.servedMost && line("Served most here", pal.accent, said.servedMost)}
      {said.inExchange.length > 0 && line("In exchange", pal.textMuted, (
        <Stack gap="1">
          {said.inExchange.map((sentence) => (
            <Text key={sentence} fontSize="xs" color={pal.textMuted} lineHeight="tall">
              {sentence}
            </Text>
          ))}
        </Stack>
      ))}
    </VStack>
  );
}
