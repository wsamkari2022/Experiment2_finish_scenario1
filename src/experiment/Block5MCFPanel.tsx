/**
 * Block5MCFPanel.tsx — the Moral Commitment Function, in words.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT SAYS, AND WHAT IT REFUSES TO SAY
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * For one option, read against THIS participant's four numbers (the ones in "Your values in this
 * scenario"): value by value, whether the option sits above, below or exactly at where they stand
 * and how far (slightly / plain / well); then what it gives beyond where they stand, what it asks
 * of them, which option on this table serves those values most, and what taking that one instead
 * would ask in exchange.
 *
 * IT NEVER PRINTS A NUMBER, A SCORE, A LABEL OR A RANKING. Not the value numbers, not the
 * shortfall, not "aligned", not "best fit", not "recommended". The participant is never shown an
 * alignment verdict or the scoring arithmetic anywhere in this study, and a panel that said "this
 * option fits you 62%" would hand them the answer to the question the block exists to ask. Gate M5
 * in `npm run validate:mcf` keeps that vocabulary out of the data; gate M7 keeps it (and every
 * digit) out of the words.
 *
 * WHAT IT DELIBERATELY OMITS, AND WHY. block5MCF also computes whether the swap option costs the
 * participant MORE or LESS overall. That number is exactly a fit comparison between two options,
 * so it is not rendered here at all - only what the swap gives up instead, which is a fact about
 * the options rather than a verdict about the person.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * THE LOOK (27 September 2026, the researcher's request: "color the most important words")
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * Every color here already means the same thing somewhere else on the page, so nothing new has to
 * be learned:
 *   - each VALUE is drawn in its own color and icon, the ones of "Your values in this scenario"
 *     (NAME and LOOK in block5ValueLook.tsx, shared by both panels);
 *   - ABOVE is green and BELOW is red, the gain and cost colors of the option cards' trade-off
 *     panel and of the chart note above; EXACTLY is neutral;
 *   - SIZE is drawn as weight: a WELL above/below tag is solid, a plain one tinted, a SLIGHTLY one
 *     only outlined - and the word itself always says it, so meaning never rests on color alone;
 *   - each OPTION carries its chart color, as a small square beside its title, so a reading can be
 *     matched to its shape on the chart above.
 * The scenario accent is used only for the frame, as before: it is a different hue in every
 * scenario, so it never carries meaning.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHY IT LIVES IN THE COMPARE OVERLAY AND NOWHERE ELSE
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * The overlay is something a participant chooses to open, and it already draws their own four
 * values as a dashed shape with a caption saying that any corner inside it falls below where they
 * stand on that value. This panel is that same disclosure in sentences, for the
 * participants who cannot read a radar chart. Moving it onto the option cards would change it from
 * a thing they went looking for into a thing they are told while choosing, which is a different
 * study (the researcher's decision, 27 September 2026: it stays here, and it stays SHOWN - MCF is
 * one of the study's contributions and Fix 1 does not remove it).
 *
 * NOT IN SCENARIO 6 (27 September 2026, the researcher's decision). There the four rules ARE the
 * four values, so a reading tells the participant which rule meets where they stand before they
 * choose - 74-84 in 100 readings of a rule that was not the person's best fit named exactly their
 * best-fit rule - which is the answer the prediction test measures. Block5OptionCompare does not
 * render this panel there.
 *
 * EVERY OPTION STARTS CLOSED. Six open readings is a wall of text nobody reads, and opening one is
 * the act that says which option a participant is weighing - which is worth recording (stage 3).
 * So nothing of a reading shows on a closed row: only the option's title and its chart color.
 */

import { Fragment, useCallback, useState, type ReactNode } from "react";
import { Box, HStack, Icon, Stack, Text, VStack } from "@chakra-ui/react";
import {
  LuArrowDown, LuArrowUp, LuChevronDown, LuChevronUp, LuEqual, LuScale, LuTarget,
} from "react-icons/lu";
import type { Block5PolicyDimKey, Block5Scenario } from "./block5Types";
import type { Block5Palette } from "./block5Palette";
import { mcfFromScores, type McfOption } from "./block5MCF";
import { mcfWords, type McfLine, type McfValueRead } from "./block5MCFWords";
import { LOOK, NAME } from "./block5ValueLook";

export function Block5MCFPanel({
  scenario, yourPolicyScores, yourValueOrder, optionColors, pal, onOpenOption,
}: {
  scenario: Block5Scenario;
  /** The participant's four values as they stand now — the same numbers the dashed shape uses. */
  yourPolicyScores: Record<Block5PolicyDimKey, number>;
  /** Their four values strongest first, the order of "Your values in this scenario". */
  yourValueOrder?: Block5PolicyDimKey[];
  /** Each option's color on the charts above, so a reading can be matched to its shape. */
  optionColors?: Record<string, string>;
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

  const strong = (children: ReactNode, color?: string) => (
    <Text as="span" fontWeight="bold" color={color ?? pal.text}>{children}</Text>
  );

  return (
    <Box
      bg={pal.surfaceSubtle} borderWidth="1px" borderColor={pal.cardBorder}
      borderLeftWidth="4px" rounded="xl" style={{ borderLeftColor: pal.accent }}
      px={{ base: "4", md: "5" }} py={{ base: "4", md: "5" }}
    >
      <HStack gap="2" mb="2">
        <Icon color={pal.accent} boxSize="4"><LuScale /></Icon>
        <Text fontSize="2xs" fontWeight="bold" letterSpacing="widest" textTransform="uppercase"
          color={pal.accent}>
          What each option asks of your four values
        </Text>
      </HStack>
      {/* WHAT A GAP MEANS, said once, before any reading (27 September 2026). The old intro said
          what a reading contained but never what "above" or "below" means for the person. */}
      <Stack gap="1.5" mb="4">
        <Text fontSize={{ base: "xs", md: "sm" }} color={pal.textMuted} lineHeight="tall">
          Each option is compared with {strong("your own four numbers")} in “Your values in this
          scenario”. {strong("Above", pal.gainColor)} your number: the option does more for that
          value than your earlier answers point to. {strong("Below", pal.costColor)}: it does less —
          and the further below on a value you hold strongly, {strong("the more it asks of you")}.
        </Text>
        <Text fontSize="xs" color={pal.textFaint} lineHeight="tall">
          Nothing here is a recommendation — every option can be chosen. Open an option to read it.
        </Text>
      </Stack>

      <Stack gap="2.5">
        {reading.options.map((row) => {
          const open = openId === row.optionId;
          const swatch = optionColors?.[row.optionId];
          return (
            <Box key={row.optionId} bg={pal.cardBg} borderWidth="1px"
              borderColor={open && swatch ? swatch : pal.cardBorder}
              rounded="lg" px={{ base: "3", md: "4" }} py="2.5"
              transition="border-color 0.15s ease"
              style={open ? { boxShadow: pal.cardShadow } : undefined}>
              <HStack
                as="button" w="full" gap="3" align="center" textAlign="left"
                onClick={() => toggle(row.optionId)}
                aria-expanded={open}
                _hover={{ opacity: 0.85 }}
              >
                {swatch && <Box flexShrink={0} w="3" h="3" rounded="sm" bg={swatch} aria-hidden />}
                <Text fontSize="sm" fontWeight="semibold" color={pal.text} flex="1" minW="0"
                  lineHeight="short">
                  {titleOf(row.optionId)}
                </Text>
                <Icon boxSize="4" color={pal.textMuted}>
                  {open ? <LuChevronUp /> : <LuChevronDown />}
                </Icon>
              </HStack>

              {open && (
                <Reading row={row} titleOf={titleOf} order={yourValueOrder}
                  optionColors={optionColors} pal={pal} />
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

/**
 * One option's reading: value by value, then the four sentences.
 *
 * EVERY WORD COMES FROM block5MCFWords. This component chooses colour, order and spacing and
 * writes no English of its own beyond the section labels, so the two rules that matter - no
 * verdict, no arithmetic - are enforced on plain strings by gate M7 rather than by reading JSX.
 */
function Reading({ row, titleOf, order, optionColors, pal }: {
  row: McfOption;
  titleOf: (id: string) => string;
  order?: Block5PolicyDimKey[];
  optionColors?: Record<string, string>;
  pal: Block5Palette;
}) {
  const said = mcfWords(row, titleOf, order);

  /* Label beside its sentence from tablet width up; on a phone the label sits above it, so the
     sentence keeps the full width instead of a narrow column. */
  const line = (label: string, color: string, body: ReactNode) => (
    <Stack direction={{ base: "column", sm: "row" }} gap={{ base: "0.5", sm: "3" }} align="start">
      <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider"
        color={color} minW={{ sm: "24" }} mt={{ base: "0", sm: "1" }} flexShrink={0}>
        {label}
      </Text>
      <Box fontSize={{ base: "xs", md: "sm" }} color={pal.textMuted} lineHeight="tall" flex="1" minW="0">
        {body}
      </Box>
    </Stack>
  );

  return (
    <VStack align="stretch" gap="3.5" mt="3" pt="3.5"
      borderTopWidth="1px" borderTopColor={pal.cardBorder}>
      {/* ---- value by value, the participant's own order ---- */}
      <Box>
        <HStack justify="space-between" mb="1.5" gap="3">
          <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider"
            color={pal.textFaint}>
            Your four values, strongest first
          </Text>
          <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider"
            color={pal.textFaint} textAlign="right" display={{ base: "none", sm: "block" }}>
            This option, against where you stand
          </Text>
        </HStack>
        <Stack gap="1.5">
          {said.byValue.map((v) => <ValueRow key={v.value} read={v} pal={pal} />)}
        </Stack>
      </Box>

      {/* ---- the four sentences ---- */}
      <VStack align="stretch" gap="2.5">
        {line("It gives", pal.gainColor, <Spans line={said.gives} optionColors={optionColors} pal={pal} />)}
        {line("It asks", pal.costColor, <Spans line={said.asks} optionColors={optionColors} pal={pal} />)}
        {said.servedMost && line("Served most here", pal.accent,
          <Spans line={said.servedMost} optionColors={optionColors} pal={pal} />)}
        {said.inExchange.length > 0 && line("In exchange", pal.textMuted, (
          <Stack gap="1.5">
            {said.inExchange.map((sentence, i) => (
              <Box key={i}><Spans line={sentence} optionColors={optionColors} pal={pal} /></Box>
            ))}
          </Stack>
        ))}
      </VStack>
    </VStack>
  );
}

/** One value: its name in its own color, and where this option sits against the participant. */
function ValueRow({ read, pal }: { read: McfValueRead; pal: Block5Palette }) {
  const look = LOOK[read.value];
  return (
    <HStack justify="space-between" align="center" gap="3" wrap="wrap"
      bg={pal.surfaceSubtle} rounded="md" px="2.5" py="1.5"
      borderLeftWidth="3px" borderLeftColor={`${look.palette}.solid`}>
      <HStack gap="2" minW="0" color={`${look.palette}.fg`}>
        <Icon boxSize="3.5" flexShrink={0}>{look.icon}</Icon>
        <Text fontSize="sm" fontWeight="semibold" lineHeight="short">{NAME[read.value]}</Text>
      </HStack>
      <HStack gap="2" ml="auto">
        {read.asksMost && (
          <HStack gap="1" color={pal.costColor}>
            <Icon boxSize="3"><LuTarget /></Icon>
            <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
              Asks most here
            </Text>
          </HStack>
        )}
        <Tag read={read} />
      </HStack>
    </HStack>
  );
}

/**
 * Where the option sits, as a tag. Side is the color (green above, red below, neutral exactly) and
 * size is the weight (solid = well, tinted = plain, outlined = slightly); the words say both.
 */
function Tag({ read }: { read: McfValueRead }) {
  const hue = read.side === "above" ? "green" : read.side === "below" ? "red" : "gray";
  const look = read.size === "well"
    ? { bg: `${hue}.solid`, color: `${hue}.contrast`, border: `${hue}.solid` }
    : read.size === "slightly"
      ? { bg: "transparent", color: `${hue}.fg`, border: `${hue}.emphasized` }
      : { bg: `${hue}.muted`, color: `${hue}.fg`, border: `${hue}.muted` };
  return (
    <HStack gap="1" bg={look.bg} color={look.color} borderWidth="1px" borderColor={look.border}
      rounded="full" px="2.5" py="0.5" flexShrink={0}>
      <Icon boxSize="3">
        {read.side === "above" ? <LuArrowUp /> : read.side === "below" ? <LuArrowDown /> : <LuEqual />}
      </Icon>
      <Text fontSize="xs" fontWeight="bold" whiteSpace="nowrap">{read.tag}</Text>
    </HStack>
  );
}

/** A sentence from block5MCFWords, with its meaning-carrying words colored. */
function Spans({ line, optionColors, pal }: {
  line: McfLine;
  optionColors?: Record<string, string>;
  pal: Block5Palette;
}) {
  return (
    <Text as="span">
      {line.map((s, i) => {
        switch (s.tone) {
          case "value":
            return (
              <Text key={i} as="span" fontWeight="semibold"
                color={s.value ? `${LOOK[s.value].palette}.fg` : pal.text}>{s.text}</Text>
            );
          case "above":
            return <Text key={i} as="span" fontWeight="bold" color={pal.gainColor}>{s.text}</Text>;
          case "below":
            return <Text key={i} as="span" fontWeight="bold" color={pal.costColor}>{s.text}</Text>;
          case "exact":
          case "strong":
            return <Text key={i} as="span" fontWeight="bold" color={pal.text}>{s.text}</Text>;
          case "option": {
            const swatch = s.optionId ? optionColors?.[s.optionId] : undefined;
            return (
              <Fragment key={i}>
                {swatch && (
                  <Box as="span" display="inline-block" w="2" h="2" rounded="sm" bg={swatch}
                    mr="1" verticalAlign="middle" aria-hidden />
                )}
                <Text as="span" fontWeight="semibold" color={pal.text}>{s.text}</Text>
              </Fragment>
            );
          }
          default:
            return <Fragment key={i}>{s.text}</Fragment>;
        }
      })}
    </Text>
  );
}
