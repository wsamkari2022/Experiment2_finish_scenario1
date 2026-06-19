import type React from "react";
import type { ReactNode } from "react";
import { Text } from "@chakra-ui/react";

// Maps Chakra token paths to their emitted CSS variable names
const TOKEN_VAR: Record<string, string> = {
  "green.300": "var(--chakra-colors-green-300)",
  "green.400": "var(--chakra-colors-green-400)",
  "yellow.300": "var(--chakra-colors-yellow-300)",
  "yellow.400": "var(--chakra-colors-yellow-400)",
  "blue.400":   "var(--chakra-colors-blue-400)",
  "blue.300":   "var(--chakra-colors-blue-300)",
  "red.400":    "var(--chakra-colors-red-400)",
  "orange.400": "var(--chakra-colors-orange-400)",
};

function toVar(color: string): string {
  return (
    TOKEN_VAR[color] ??
    `var(--chakra-colors-${color.replace(".", "-")})`
  );
}

interface GlowSpanProps {
  children: ReactNode;
  /**
   * Increment this counter each time the value changes to trigger a new glow.
   * Keep it at 0 (or a stable value) to suppress the glow (e.g. on initial mount).
   */
  glowKey: number;
  /** Chakra color token, e.g. "green.400" */
  glowColor: string;
  fontWeight?: string;
  color?: string;
}

/**
 * Inline span that plays a one-shot text-shadow glow whenever `glowKey`
 * increments. The React `key` prop unmounts+remounts the element, resetting
 * the CSS animation. Pass `glowKey={0}` on initial mount to avoid glow.
 *
 * @keyframes glow-pulse is defined in index.html so Chakra's css-in-js
 * pipeline never mangles the keyframe body.
 */
export function GlowSpan({
  children,
  glowKey,
  glowColor,
  fontWeight,
  color,
}: GlowSpanProps) {
  const cssVar = toVar(glowColor);

  // glowKey=0 means no glow yet (initial mount). Only animate when glowKey>0.
  const shouldAnimate = glowKey > 0;

  return (
    <Text
      as="span"
      key={glowKey}
      fontWeight={fontWeight}
      color={color}
      display="inline"
      style={
        shouldAnimate
          ? ({
              "--glow-c": cssVar,
              animationName: "glow-pulse",
              animationDuration: "900ms",
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "1",
              animationFillMode: "none",
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </Text>
  );
}
