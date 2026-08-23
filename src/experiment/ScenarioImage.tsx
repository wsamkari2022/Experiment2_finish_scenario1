/**
 * ScenarioImage.tsx — the fixed-size illustration frame shown beside a scenario question.
 *
 * WHY A FRAME RATHER THAN A BARE <img>
 * The illustrations are not all the same shape — the Block 1 masters run from 1402x1122 (5:4)
 * to 1448x1086 (4:3). Dropping them straight into the layout would make the picture, and
 * therefore the whole question row, change height as the participant moves up the ladder, so
 * the buttons would shift under the cursor between questions. The frame fixes the geometry:
 *
 *   - `aspectRatio` pins the box to one shape. The default is 4:3, the native shape of the
 *     large majority of the artwork (all of the wealthy-district and shelter sets), so most
 *     illustrations are shown uncropped;
 *   - `objectFit: cover` fills that box completely for the rest, trimming about 3% from two
 *     edges rather than letterboxing, so no illustration is ever framed differently from the
 *     others. Every scene keeps its subject and its context cue (the shelter sign, the
 *     "Financial District" plaque, the money) well inside the frame, so nothing meaningful is
 *     lost to that trim — checked against each set.
 *
 * The result is that every question in the block presents an identically sized, identically
 * positioned picture, which is what makes the block feel steady rather than jumpy.
 *
 * SWAPPING WITHOUT FLICKER
 * The whole set is preloaded by the parent, so a swap is a cache hit. A short cross-fade keyed
 * on `src` softens the change; `key` forces React to restart the animation on every new image.
 */

import { Box, Image } from "@chakra-ui/react";

interface ScenarioImageProps {
  /** Absolute URL of the illustration, e.g. "/scenario-images/<folder>/Shelter_10.webp". */
  src: string;
  /** Describes the scene for screen readers and for participants whose images fail to load. */
  alt: string;
  /** Frame background, so the box reads as part of the card in either colour mode. */
  bg: string;
  /**
   * Frame shape, as width/height. Defaults to 4:3, which matches most of the existing artwork.
   * Override only if a future block is drawn to a consistently different shape — and keep it
   * consistent WITHIN a block, or the picture will resize between that block's questions.
   */
  aspect?: number;
}

export function ScenarioImage({ src, alt, bg, aspect = 4 / 3 }: ScenarioImageProps) {
  return (
    <Box
      // The frame keeps its geometry no matter which illustration is inside it.
      w="full"
      aspectRatio={aspect}
      bg={bg}
      borderWidth="1px"
      borderColor="border"
      rounded="xl"
      overflow="hidden"
      flexShrink="0"
    >
      <Image
        key={src}
        src={src}
        alt={alt}
        w="full"
        h="full"
        objectFit="cover"
        // Eager + sync decoding: the set is already preloaded, so this avoids the brief blank
        // frame that lazy decoding would otherwise introduce on each swap.
        loading="eager"
        decoding="sync"
        animationName="fade-in"
        animationDuration="moderate"
      />
    </Box>
  );
}
