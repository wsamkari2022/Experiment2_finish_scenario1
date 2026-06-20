import { Badge, Box, Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { describeLevel, type ThresholdTree, type ThresholdTreeDimension } from "./thresholdTree";

/**
 * RankedThresholdTree — displays the seven-dimension User Value Profile, grouped by the
 * three faces of the CVR Cube (Approved CVR-Cube layout):
 *
 *   Face A · Policy values  → the four alignment axes Block 5 scores options against
 *   Face B · Framings       → how a choice is presented (directness / context)
 *   Face C · Salience       → whose voice is heard (stakeholder shift)
 *
 * Each dimension keeps its overall rank, 0–100 score bar, level badge, rationale, and the
 * (now-accurate) derivation. The overall index + primary driver header is preserved. This is
 * display-only — it regroups data already produced by buildThresholdTree; Block 5 is untouched.
 */

interface Props {
  tree: ThresholdTree;
}

type Palette = "teal" | "orange" | "purple";

interface Face {
  id: string;
  title: string;
  subtitle: string;
  palette: Palette;
  keys: string[];
}

/** The CVR-Cube faces and which sensitivities belong to each. */
const FACES: Face[] = [
  {
    id: "A",
    title: "Policy values",
    subtitle: "The four alignment axes Block 5 scores each option against",
    palette: "teal",
    keys: ["vulnerability_protection", "group_size", "gain_responsiveness", "outcome_aggregation"],
  },
  {
    id: "B",
    title: "Framings",
    subtitle: "How a choice is presented to you",
    palette: "orange",
    keys: ["directness", "context"],
  },
  {
    id: "C",
    title: "Salience",
    subtitle: "Whose voice you hear",
    palette: "purple",
    keys: ["stakeholder_shift"],
  },
];

/** Level → Chakra fill tone for the score bar / badge. */
function toneFor(score: number): { bar: string; badge: "green" | "blue" | "yellow" | "gray" } {
  const lvl = describeLevel(score);
  if (lvl === "strong") return { bar: "green.400", badge: "green" };
  if (lvl === "moderate") return { bar: "blue.400", badge: "blue" };
  if (lvl === "mild") return { bar: "yellow.400", badge: "yellow" };
  return { bar: "gray.500", badge: "gray" };
}

/** One sensitivity row, accented with its face's colour. */
function DimensionRow({ d, palette }: { d: ThresholdTreeDimension; palette: Palette }) {
  const tone = toneFor(d.score);
  return (
    <Box borderWidth="1px" borderColor="border.subtle" rounded="lg" bg="bg.subtle" p={{ base: "3.5", md: "4" }}>
      <HStack justify="space-between" align="start" gap="3" mb="2" wrap="wrap">
        <HStack gap="2.5" align="center">
          <Badge colorPalette={palette} variant="solid" rounded="md" px="2" py="0.5" fontFamily="mono" fontSize="2xs">
            #{d.rank}
          </Badge>
          <Heading size="sm" color="fg">{d.label}</Heading>
        </HStack>
        <HStack gap="2.5">
          <Text fontSize="sm" color="fg.muted" fontFamily="mono">{d.score}/100</Text>
          <Badge colorPalette={tone.badge} variant="subtle" rounded="md" px="2">{describeLevel(d.score)}</Badge>
        </HStack>
      </HStack>

      <Box w="full" h="2" bg="bg.emphasized" rounded="full" overflow="hidden" mb="2.5">
        <Box h="full" bg={tone.bar} rounded="full" style={{ width: `${Math.max(4, d.score)}%` }} />
      </Box>

      <Text fontSize="sm" color="fg" lineHeight="tall" mb="2">{d.rationale}</Text>

      {d.contributions.length > 0 && (
        <HStack gap="1.5" wrap="wrap" mb="2.5">
          {d.contributions.map((c, i) => (
            <Badge key={i} variant="outline" colorPalette="gray" rounded="full" px="2" fontSize="2xs" fontWeight="normal">
              {c.block}: {c.label}
            </Badge>
          ))}
        </HStack>
      )}

      <Box bg="bg.panel" borderWidth="1px" borderColor="border.subtle" rounded="md" px="3" py="2"
        fontFamily="mono" fontSize="xs" color="fg.muted" whiteSpace="pre-wrap">
        {d.derivation}
      </Box>
    </Box>
  );
}

/** A coloured CVR-Cube face containing its sensitivities. */
function FaceSection({ face, dims }: { face: Face; dims: ThresholdTreeDimension[] }) {
  if (dims.length === 0) return null;
  return (
    <Box borderWidth="2px" borderColor={`${face.palette}.400`} rounded="xl" overflow="hidden">
      <HStack
        bg={`${face.palette}.subtle`}
        px={{ base: "4", md: "5" }}
        py="3"
        gap="3"
        align="center"
        borderBottomWidth="1px"
        borderColor={`${face.palette}.400`}
      >
        <Box
          w="8" h="8" rounded="md" flexShrink={0}
          bg={`${face.palette}.solid`} color={`${face.palette}.contrast`}
          display="flex" alignItems="center" justifyContent="center"
          fontWeight="bold" fontFamily="mono"
        >
          {face.id}
        </Box>
        <Box>
          <Text fontSize="2xs" fontWeight="bold" color={`${face.palette}.fg`} textTransform="uppercase" letterSpacing="wider">
            Face {face.id} · CVR Cube
          </Text>
          <Heading size="sm" color="fg">{face.title}</Heading>
          <Text fontSize="xs" color="fg.muted">{face.subtitle}</Text>
        </Box>
      </HStack>
      <Stack gap="3" p={{ base: "3", md: "4" }}>
        {dims.map((d) => <DimensionRow key={d.key} d={d} palette={face.palette} />)}
      </Stack>
    </Box>
  );
}

export function RankedThresholdTree({ tree }: Props) {
  const byKey = new Map(tree.dimensions.map((d) => [d.key, d] as const));

  return (
    <VStack align="stretch" gap="5">
      {/* Overall index + primary driver (preserved) */}
      <Box borderWidth="1px" borderColor="border" rounded="xl" p={{ base: "5", md: "6" }} bg="bg.panel">
        <HStack justify="space-between" align="center" wrap="wrap" gap="3">
          <VStack align="start" gap="0.5">
            <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">Overall sensitivity index</Text>
            <Heading size="lg" color="fg" fontFamily="mono">{tree.overallSensitivityIndex}/100</Heading>
          </VStack>
          {tree.primaryDriver && (
            <VStack align="end" gap="0.5">
              <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">Primary driver</Text>
              <Text fontSize="sm" fontWeight="semibold" color="fg">{tree.primaryDriver.label}</Text>
            </VStack>
          )}
        </HStack>
      </Box>

      {/* The three CVR-Cube faces */}
      {FACES.map((face) => (
        <FaceSection
          key={face.id}
          face={face}
          dims={face.keys.map((k) => byKey.get(k)).filter((d): d is ThresholdTreeDimension => !!d)}
        />
      ))}
    </VStack>
  );
}
