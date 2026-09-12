/**
 * MethodLogo.tsx — the CVR and APA wordmarks, used as a link between two places.
 *
 * WHY A LOGO RATHER THAN A LABEL
 * The feedback page asks a participant to rate "the value-reflection step" and "the
 * value-clarification step". Half an hour earlier they saw those steps, but nobody told them what
 * either was called — the interface deliberately avoids research jargon in front of participants.
 * So the questions ask about something they experienced under a name they have never met.
 *
 * A mark solves that without introducing vocabulary. The same small logo sits in the corner of the
 * step when it happens, and beside the question that asks about it. The participant does not need
 * to learn what "CVR" stands for; they need to recognise that THIS question is about THAT screen,
 * and a picture does that better than a definition.
 *
 * WHY ONE COMPONENT AND NOT TWO IMG TAGS
 * The recognition only works if the two appearances are identical. Sizing them separately is how
 * they drift apart — one ends up bigger, or one keeps a stale file name — and a mark that looks
 * different in the two places is worse than no mark, because it invites the question "is this the
 * same thing?" at the exact moment it was supposed to answer it.
 */

import { Box, Image } from "@chakra-ui/react";

export type Method = "cvr" | "apa";

const LOGO: Record<Method, { src: string; alt: string }> = {
  /* Alt text names the step in the participant's own language, never the acronym: a screen reader
     user is in exactly the position this component exists to fix. */
  cvr: { src: "/logos/cvr.png", alt: "The value-reflection step" },
  apa: { src: "/logos/apa.png", alt: "The value-clarification step" },
};

export function MethodLogo({
  method,
  size = "md",
}: {
  method: Method;
  /** `md` in the step itself, `sm` beside a feedback question. */
  size?: "sm" | "md";
}) {
  const { src, alt } = LOGO[method];
  const height = size === "sm" ? { base: "5", md: "5" } : { base: "6", md: "7" };

  return (
    <Box flexShrink={0} lineHeight="0" opacity={0.95}>
      <Image
        src={src}
        alt={alt}
        h={height}
        w="auto"
        /* The wordmarks are bright gradients on transparency, so they read on both themes without
           a plate behind them; a drop shadow keeps the lighter end legible on a light background. */
        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))"
      />
    </Box>
  );
}
