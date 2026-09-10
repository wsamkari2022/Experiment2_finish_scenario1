/**
 * DevResetButton — "wipe everything and start again at Block 1".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS A DEVELOPMENT TOOL. TO REMOVE IT BEFORE THE STUDY GOES LIVE:
 *
 *   1. delete this whole folder — src/components/dev/
 *   2. delete the import and the <DevResetButton /> line in src/App.tsx
 *
 * That is the entire footprint. It is deliberately mounted in ONE place (App.tsx, beside the
 * color-mode button that is already fixed to the corner) rather than added to each page, so
 * removing it can never leave a copy behind on some page nobody thought to check.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * IT CANNOT SHIP EVEN IF THOSE TWO STEPS ARE FORGOTTEN, and the shape of this file is what makes
 * that true rather than merely intended:
 *
 *   `import.meta.env.DEV` is replaced by the literal `false` at build time, so the guard below
 *   becomes `if (true) return null` and everything after it — the control, its labels, the wipe
 *   itself — is unreachable and is dropped from the bundle entirely.
 *
 * An earlier version of this file resolved the same flag through an IIFE that also read
 * localStorage, so that a production preview build could re-enable the button with `?devtools=1`.
 * It did not survive checking: the minifier cannot prove an IIFE that touches storage is constant,
 * so the whole control shipped in `dist/` — inert, but present, and one localStorage key away from
 * erasing a real participant's run. The convenience was not worth that. To test a production
 * build, change the guard below to `if (false)` for the duration of the test.
 *
 * WHAT "RESET" MEANS HERE. Every localStorage key is removed except the few in KEEP_KEYS below —
 * enumerated at run time rather than listed, because a hard-coded list of the twenty-odd keys this
 * app writes would silently stop being complete the first time someone adds a twenty-first, and a
 * reset that leaves one stale key behind is worse than no reset: the app restarts at Block 1
 * carrying a fragment of the previous run, and the bug that produces looks like a real bug.
 */

import { useEffect, useState } from "react";
import { Box, Button, HStack, Icon, Text } from "@chakra-ui/react";
import { LuRotateCcw, LuTriangleAlert } from "react-icons/lu";
import { FEEDBACK_ARCHIVE_KEY } from "@/experiment/feedbackTypes";

/**
 * The only keys a restart keeps.
 *
 *   theme / chakra-ui-color-mode — wiping these would flash the tester with a mode switch.
 *   FEEDBACK_ARCHIVE_KEY         — the accumulated feedback records, kept for export.
 *
 * The archive is not a guess. The app's own two reset paths (clearAllSessionData in
 * FinalMoralAnalysisPage and handleFinish in UserFeedbackPage) both call localStorage.clear() and
 * then put this one key back, with the comment "PRESERVE the archived records for export" — it
 * holds every completed run, not the state of the current one. A dev button that quietly deleted
 * a pilot's worth of feedback on its first press would be a worse bug than the one it fixes. To
 * clear the archive too, remove it from this set for that run.
 */
const KEEP_KEYS = new Set<string>(["theme", "chakra-ui-color-mode", FEEDBACK_ARCHIVE_KEY]);

function wipeAndRestart(): void {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!KEEP_KEYS.has(key)) window.localStorage.removeItem(key);
    }
    window.sessionStorage.clear();
  } catch {
    /* Private-mode browsers can throw on storage access. The reload still starts a fresh run. */
  }
  // reload() rather than a route change: ExperimentFlow decides its stage from storage on mount,
  // and every block holds its own state in React, so only a fresh mount is genuinely a restart.
  window.location.reload();
}

/**
 * The control itself, kept in its own component so that the guard in DevResetButton is the only
 * thing standing between a production build and this code — a single constant the bundler folds,
 * rather than a branch inside a component it has to keep because of the hooks above it.
 */
function DevResetControl() {
  const [armed, setArmed] = useState(false);

  // Auto-disarm, so a half-pressed reset left on screen cannot be completed by a stray click
  // minutes later, in the middle of a run.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <Box position="fixed" bottom="4" left="4" zIndex="banner">
      {armed ? (
        /*
          Two separate buttons rather than "click the same pill again". A dev tool that erases a
          run in progress should not be reachable by a double-click on the control that arms it.
        */
        <HStack
          gap="1.5" bg="bg.panel" borderWidth="1px" borderColor="red.solid"
          rounded="full" pl="3" pr="1.5" py="1" shadow="md"
        >
          <Icon boxSize="3.5" color="red.solid"><LuTriangleAlert /></Icon>
          <Text fontSize="2xs" color="fg" fontWeight="medium">Erase this run?</Text>
          <Button size="2xs" rounded="full" colorPalette="red" onClick={wipeAndRestart}>
            Erase &amp; restart
          </Button>
          <Button size="2xs" rounded="full" variant="ghost" onClick={() => setArmed(false)}>
            Cancel
          </Button>
        </HStack>
      ) : (
        <Button
          size="xs"
          variant="outline"
          rounded="full"
          gap="1.5"
          bg="bg.panel"
          color="fg.muted"
          opacity={0.5}
          _hover={{ opacity: 1, color: "fg" }}
          title="DEV ONLY — clears every saved answer and reloads at Block 1. Keeps the light/dark setting and the exported feedback archive."
          onClick={() => setArmed(true)}
        >
          <Icon boxSize="3"><LuRotateCcw /></Icon>
          <Text fontSize="2xs">Restart from Block 1</Text>
        </Button>
      )}
    </Box>
  );
}

export function DevResetButton() {
  if (!import.meta.env.DEV) return null;
  return <DevResetControl />;
}

export default DevResetButton;
