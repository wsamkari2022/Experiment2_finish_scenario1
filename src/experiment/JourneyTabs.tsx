/**
 * JourneyTabs — "Your journey" on the thank-you page (since 29 September 2026).
 *
 * The researcher: "move the results visualizations and charts to the 'Thank you' page so the user can enjoy
 * their journey results after finishing the feedback", in tabs ("Q1-A"). The charts used to open from the results
 * page, before the feedback; they now come after it, so nothing in them can shape a feedback answer. Five tabs by
 * topic (JOURNEY_TABS in block5Journey.ts); each draws only its own cards (Block5VisualizationsView's `tab`), and
 * only when opened (lazyMount), so the page stays light.
 *
 * THE TABS ARE FIVE SMALL CARDS (the researcher, the same day: "the tabs should look more attractive and elegant"):
 * each with its own color and icon, its name and one line of what is inside; the open one is filled with its color,
 * outlined and lifted. On a phone the row slides sideways and snaps to a card.
 */

import { Badge, Box, Center, Heading, Icon, Tabs, Text, VStack } from "@chakra-ui/react";
import { LuCompass, LuRoute, LuUsers, LuSparkles, LuHistory } from "react-icons/lu";
import type { ReactNode } from "react";
import { Block5VisualizationsView } from "./Block5VisualizationsView";
import { JOURNEY_TABS, type JourneyTabKey } from "./block5Journey";
import type { Block5Results } from "./block5Types";

/** Each tab's look: its icon, its color, and the one line under its name. */
const TAB_LOOK: Record<JourneyTabKey, { icon: ReactNode; palette: string; line: string }> = {
  values: { icon: <LuCompass />, palette: "blue", line: "What matters to you" },
  choices: { icon: <LuRoute />, palette: "teal", line: "Each choice, and its fit" },
  position: { icon: <LuUsers />, palette: "purple", line: "The position effect" },
  predictions: { icon: <LuSparkles />, palette: "pink", line: "What we expected of you" },
  early: { icon: <LuHistory />, palette: "orange", line: "Before the scenarios" },
};

export function JourneyTabs({ results }: { results: Block5Results }) {
  return (
    <Box w="full">
      <VStack gap="2" align="start" mb="5">
        <Badge colorPalette="purple" variant="subtle" rounded="md" px="2.5" py="0.5" fontSize="2xs"
          textTransform="uppercase" letterSpacing="wider">Your journey</Badge>
        <Heading size="xl" color="fg" fontWeight="semibold">A picture of how you decided</Heading>
        <Text color="fg.muted" fontSize="md" maxW="3xl" lineHeight="tall">
          Five views of your study, one topic each. Pick a tab; every chart has a short note on how to read it.
        </Text>
      </VStack>
      <Tabs.Root defaultValue="values" variant="plain" lazyMount unmountOnExit>
        {/* Wider than a phone: the row slides sideways and snaps to a card; the page itself never scrolls sideways. */}
        <Box overflowX="auto" mx={{ base: "-4", md: "0" }} px={{ base: "4", md: "0" }} py="1"
          css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, scrollSnapType: "x mandatory",
            /* Snap to the page's own 16px margin, not to the screen's edge. */
            scrollPaddingInline: "1rem" }}>
          <Tabs.List display="grid" gridTemplateColumns="repeat(5, minmax(10.5rem, 1fr))" gap="3" p="0" bg="transparent"
            borderWidth="0">
            {JOURNEY_TABS.map((t) => {
              const look = TAB_LOOK[t.key];
              const p = look.palette;
              return (
                <Tabs.Trigger key={t.key} value={t.key} h="auto" minH="0" px="4" py="3.5" gap="2.5" rounded="xl"
                  flexDirection="column" alignItems="flex-start" justifyContent="flex-start" textAlign="start"
                  whiteSpace="normal" borderWidth="1px" borderColor="border"
                  bg="bg.panel" color="fg" shadow="xs" cursor="pointer" transition="all 0.2s ease"
                  css={{
                    scrollSnapAlign: "start",
                    "& [data-tab-icon]": { bg: `${p}.subtle`, color: `${p}.fg` },
                    "&:hover": { borderColor: `${p}.muted`, transform: "translateY(-1px)", shadow: "sm" },
                    "&[data-selected]": { borderColor: `${p}.solid`, bg: `${p}.subtle`, shadow: "md" },
                    "&[data-selected] [data-tab-icon]": { bg: `${p}.solid`, color: `${p}.contrast` },
                    "&:focus-visible": { outline: "2px solid", outlineColor: `${p}.solid`, outlineOffset: "2px" },
                  }}>
                  <Center data-tab-icon boxSize="8" rounded="lg" flexShrink={0} transition="all 0.2s ease">
                    <Icon boxSize="4">{look.icon}</Icon>
                  </Center>
                  <Box minW="0">
                    <Text fontSize="sm" fontWeight="semibold" color="fg" lineHeight="short">{t.label}</Text>
                    <Text fontSize="xs" color="fg.muted" lineHeight="short" mt="0.5">{look.line}</Text>
                  </Box>
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
        </Box>
        {JOURNEY_TABS.map((t) => (
          <Tabs.Content key={t.key} value={t.key} pt="6">
            <Box borderStartWidth="3px" borderColor={`${TAB_LOOK[t.key].palette}.solid`} ps="4" py="1" mb="6" maxW="3xl">
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">{t.blurb}</Text>
            </Box>
            <Block5VisualizationsView results={results} tab={t.key} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Box>
  );
}
