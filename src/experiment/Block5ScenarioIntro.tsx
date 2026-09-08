/**
 * Block5ScenarioIntro — the page a participant reads BEFORE each Block-5 scenario.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY IT EXISTS
 *
 * On the scenario page the scene, the numbers and the participant's role live in a sidebar beside
 * six option cards. A participant who wants to get on with it can start comparing options before
 * they have taken in who they are — and the participant's POSITION is the one thing Block 5
 * deliberately varies. A manipulation that half the sample skims is a manipulation that half the
 * sample did not receive.
 *
 * This page gives that material a screen of its own, with nothing to click except "continue", so
 * the role has landed before the first option is ever seen.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY ABSENT
 *
 * THE OPTIONS. Not summarised, not counted, not hinted at. If the six choices appear here the
 * participant starts deciding while reading the scene, which is exactly the behaviour the page
 * exists to prevent.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE SAME CARDS, NOT COPIES OF THEM
 *
 * `ScenarioRoleCard` and `CompanyPrincipleCard` are imported from the simulation rather than
 * re-created here. Two reasons: an edit to either card can never leave the two pages disagreeing
 * about what the participant's role is, and — because they are the same elements — the morph
 * transition planned for step 3 has something real to animate between.
 */

import { useEffect, useRef, useState } from "react";
import {
  Box, Button, Center, HStack, Heading, Icon, Image, Stack, Text, VStack,
} from "@chakra-ui/react";
import { LuArrowRight, LuScale, LuTriangleAlert, LuBookOpen } from "react-icons/lu";

import { getBlock5Palette, onAccentText, type Block5Palette } from "./block5Palette";
import { useColorMode } from "@/components/ui/color-mode";
import { deriveCompanyValues } from "./block5Company";
import { ScenarioRoleCard, CompanyPrincipleCard } from "./Block5PublicEmergencySimulation";
import type { Block5Scenario, Block5UserProfile } from "./block5Types";

/**
 * How long the continue button stays disabled, in seconds.
 *
 * Not a comprehension test — it is a guard against the reflex click. Long enough that the page
 * cannot be dismissed before the eye has crossed it, short enough that a fast reader is not left
 * tapping a dead button. The actual time spent is recorded either way, so analysis can identify a
 * skimmer without the interface having to police anyone.
 */
const MIN_DWELL_SECONDS = 6;

interface Props {
  /** Set when the intro is drawn OVER the scenario page, so the cards have somewhere to travel to. */
  rootRef?: React.RefObject<HTMLDivElement | null>;
  scenario: Block5Scenario;
  /** The FROZEN Blocks 1–4 profile — the employer's stated value is derived from it. */
  frozenProfile: Block5UserProfile;
  index: number;
  total: number;
  /** Called with the seconds the participant spent here, so the dwell can be stored. */
  onBegin: (secondsSpent: number) => void;
}

export function Block5ScenarioIntro({ rootRef, scenario, frozenProfile, index, total, onBegin }: Props) {
  const { colorMode } = useColorMode();
  const mode = colorMode === "light" ? "light" : "dark";
  const pal: Block5Palette = getBlock5Palette(scenario, mode);
  const onAccent = onAccentText(pal.accent);

  const startedAt = useRef(Date.now());
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setWaited(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  /*
    FREEZE THE PAGE BEHIND THE OVERLAY.

    This overlay is `position: fixed`, but the scenario page underneath keeps its own scrollbar —
    a few thousand pixels of it. A wheel gesture aimed at the intro chains straight through to that
    page, so a participant reading the intro silently scrolls the scenario down behind it, then
    clicks continue and lands halfway through the options with the header already off-screen.

    Locking the root element removes the thing being scrolled. It is also what makes the morph
    measurable: the transition reads where each destination card sits IN THE VIEWPORT, so the page
    behind has to be somewhere known when that measurement is taken.
  */
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = prev; };
  }, []);
  const ready = waited >= MIN_DWELL_SECONDS;

  const company = scenario.employer ? deriveCompanyValues(frozenProfile, scenario.employer) : null;

  /* Named by scenario id, never by position: the deck has already been reordered once, and a
     positional filename would have quietly attached the wrong picture to the wrong scenario. */
  const imageSrc = `${import.meta.env.BASE_URL}scenarios/${scenario.id}.webp`;
  const [imageOk, setImageOk] = useState(true);

  return (
    <Box
      ref={rootRef}
      position="fixed" inset="0" zIndex={40} overflowY="auto" overscrollBehavior="contain"
      style={{ background: pal.pageBg }} py={{ base: "6", md: "10" }} px="4"
    >
      <Stack maxW="5xl" mx="auto" gap={{ base: "5", md: "6" }}>

        {/* ---- title ---- */}
        <Stack data-morph-fade gap="2" textAlign="center">
          <Text fontSize="xs" fontWeight="bold" letterSpacing="widest"
            textTransform="uppercase" color={pal.textMuted}>
            Scenario {index} of {total}
          </Text>
          <Heading size={{ base: "xl", md: "2xl" }} color={pal.text} lineHeight="short">
            {scenario.title}
          </Heading>
          <HStack gap="2" justify="center" color={pal.textMuted}>
            <Icon boxSize="3.5"><LuBookOpen /></Icon>
            <Text fontSize="sm">Read this before you decide. Nothing to choose yet.</Text>
          </HStack>
        </Stack>

        {/* ---- image + the scene ---- */}
        <Stack direction={{ base: "column", lg: "row" }} gap={{ base: "5", md: "6" }} align="stretch">
          {imageOk && (
            <Box data-morph-fade flex="1 1 0" minW="0" rounded="2xl" overflow="hidden"
              borderWidth="1px" borderColor={pal.cardBorder}
              style={{ boxShadow: pal.sidebarShadow }}>
              <Image src={imageSrc} alt="" w="full" h="full" objectFit="cover"
                onError={() => setImageOk(false)} />
            </Box>
          )}

          <Box data-morph="scene" flex="1 1 0" minW="0"
            bg={pal.sidebarBg} backdropFilter={pal.backdropBlur}
            borderWidth="1px" borderColor={pal.accent} rounded="2xl" overflow="hidden"
            style={{ boxShadow: pal.sidebarShadow }}>
            <HStack gap="2.5" px={{ base: "5", md: "6" }} py="3"
              style={{ background: pal.accent, color: onAccent }}>
              <Icon boxSize="4"><LuScale /></Icon>
              <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="widest">
                The scenario
              </Text>
            </HStack>
            <VStack align="stretch" gap="5" px={{ base: "5", md: "6" }} py={{ base: "5", md: "6" }}>
              <Text fontSize={{ base: "md", md: "lg" }} color={pal.text} lineHeight="tall">
                {scenario.description}
              </Text>
              {scenario.factBase && (
                <Box borderWidth="1px" borderLeftWidth="5px" rounded="lg" px="4" py="3.5"
                  style={{
                    background: `${pal.accent}1F`,
                    borderColor: `${pal.accent}59`,
                    borderLeftColor: pal.accent,
                  }}>
                  <HStack gap="2" mb="2">
                    <Center boxSize="5" minW="5" rounded="full"
                      style={{ background: pal.accent, color: onAccent }}>
                      <Icon boxSize="3"><LuTriangleAlert /></Icon>
                    </Center>
                    <Text fontSize="2xs" fontWeight="bold" color={pal.text}
                      textTransform="uppercase" letterSpacing="wider">
                      The situation right now
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color={pal.text} lineHeight="tall">{scenario.factBase}</Text>
                </Box>
              )}
            </VStack>
          </Box>
        </Stack>

        {/* ---- who you are ---- */}
        {scenario.role && <ScenarioRoleCard scenario={scenario} pal={pal} />}

        {/*
          THE EMPLOYER'S PRINCIPLE — scenarios 4 and 5 only, and the loudest thing on the page.

          It is set apart rather than tucked under the role card because it is the second half of
          the same fact: this is who you are, and this is what you are being asked to work under.
          The participant's own score on that value sits directly beneath the quote, because the
          gap between the two IS the scenario — and a participant who does not notice the gap has
          not really been given the dilemma.

          Neutral surface, not the scenario accent: an employer's demand rendered in the interface's
          own colour reads as the interface endorsing it.
        */}
        {/*
          THE EMPLOYER PRINCIPLE — rendered by the SAME component the scenario page uses, in its
          large "hero" form. Two reasons it is not written out again here: an edit to the card can
          never leave the two pages disagreeing about what the company demands, and the morph has
          one element to animate rather than two look-alikes.
        */}
        {company && <CompanyPrincipleCard company={company} pal={pal} variant="hero" />}

        {/* ---- continue ---- */}
        <Stack data-morph-fade align="center" gap="2" pt="1" pb="6">
          <Button size="lg" px="8" rounded="xl" fontWeight="bold"
            disabled={!ready}
            style={ready
              ? { background: pal.accent, color: onAccent, boxShadow: `0 8px 24px ${pal.accent}59` }
              : undefined}
            onClick={() => onBegin(Math.round((Date.now() - startedAt.current) / 1000))}>
            I have read this — show me the options
            <Icon boxSize="4" ml="2"><LuArrowRight /></Icon>
          </Button>
          <Text fontSize="2xs" color={pal.textFaint} h="4">
            {ready ? "" : `Take a moment to read — ${MIN_DWELL_SECONDS - waited}s`}
          </Text>
        </Stack>
      </Stack>
    </Box>
  );
}
