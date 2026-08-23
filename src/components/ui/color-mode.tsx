"use client"

import type { IconButtonProps, SpanProps } from "@chakra-ui/react"
import { ClientOnly, IconButton, Skeleton, Span } from "@chakra-ui/react"
import { ThemeProvider, useTheme } from "next-themes"
import type { ThemeProviderProps } from "next-themes"
import * as React from "react"
import { LuMoon, LuSun } from "react-icons/lu"

export interface ColorModeProviderProps extends ThemeProviderProps {}

/**
 * Colour-mode provider.
 *
 * `defaultTheme="dark"` + `enableSystem={false}` means every participant starts in Dark Mode.
 *
 * Disabling the system setting is deliberate and matters for the experiment, not just for
 * looks: with it enabled (next-themes' default) the starting appearance would depend on each
 * participant's own OS preference, so some people would read the scenarios on a dark screen
 * and others on a light one. That is an uncontrolled variable sitting on top of every response.
 * Fixing the starting mode removes it. Participants can still switch whenever they like — the
 * toggle is always available, and their choice is remembered.
 *
 * `{...props}` stays last so a caller can still override any of this.
 */
export function ColorModeProvider(props: ColorModeProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    />
  )
}

export type ColorMode = "light" | "dark"

export interface UseColorModeReturn {
  colorMode: ColorMode
  setColorMode: (colorMode: ColorMode) => void
  toggleColorMode: () => void
}

export function useColorMode(): UseColorModeReturn {
  const { resolvedTheme, setTheme, forcedTheme } = useTheme()
  const colorMode = forcedTheme || resolvedTheme
  const toggleColorMode = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }
  return {
    colorMode: colorMode as ColorMode,
    setColorMode: setTheme,
    toggleColorMode,
  }
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode()
  return colorMode === "dark" ? dark : light
}

export function ColorModeIcon() {
  const { colorMode } = useColorMode()
  return colorMode === "dark" ? <LuMoon /> : <LuSun />
}

interface ColorModeButtonProps extends Omit<IconButtonProps, "aria-label"> {}

/**
 * Remembers that this participant has found the light/dark toggle, so the attention glow is
 * shown once and never again. Stored rather than held in memory because the experiment spans
 * several pages and remounts the button on each one — without persistence the glow would come
 * back after every page change, which is nagging rather than helpful.
 */
const COLOR_MODE_TOGGLE_USED_KEY = "color_mode_toggle_used"

function readToggleUsed(): boolean {
  try {
    return localStorage.getItem(COLOR_MODE_TOGGLE_USED_KEY) === "true"
  } catch {
    return false
  }
}

export const ColorModeButton = React.forwardRef<
  HTMLButtonElement,
  ColorModeButtonProps
>(function ColorModeButton(props, ref) {
  const { toggleColorMode } = useColorMode()
  /** False until the participant has clicked the toggle at least once, ever. */
  const [hasBeenUsed, setHasBeenUsed] = React.useState(readToggleUsed)

  const handleClick = React.useCallback(() => {
    if (!hasBeenUsed) {
      try {
        localStorage.setItem(COLOR_MODE_TOGGLE_USED_KEY, "true")
      } catch {
        // A blocked storage API only means the glow may reappear; never break the toggle.
      }
      setHasBeenUsed(true)
    }
    toggleColorMode()
  }, [hasBeenUsed, toggleColorMode])

  return (
    <ClientOnly fallback={<Skeleton boxSize="9" />}>
      <IconButton
        onClick={handleClick}
        variant="ghost"
        aria-label="Toggle color mode"
        size="sm"
        ref={ref}
        rounded="full"
        // Pulses until first use, to point out that the appearance can be changed. The
        // `glow-ring` keyframes live in index.html so Chakra's css-in-js cannot strip them.
        animation={hasBeenUsed ? undefined : "glow-ring 1.8s ease-in-out infinite"}
        {...props}
        css={{
          _icon: {
            width: "5",
            height: "5",
          },
        }}
      >
        <ColorModeIcon />
      </IconButton>
    </ClientOnly>
  )
})

export const LightMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function LightMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme light"
        colorPalette="gray"
        colorScheme="light"
        ref={ref}
        {...props}
      />
    )
  },
)

export const DarkMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function DarkMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme dark"
        colorPalette="gray"
        colorScheme="dark"
        ref={ref}
        {...props}
      />
    )
  },
)
