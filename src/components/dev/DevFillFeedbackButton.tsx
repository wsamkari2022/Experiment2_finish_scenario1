/**
 * DevFillFeedbackButton — "answer every feedback question for me".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS A DEVELOPMENT TOOL. TO REMOVE IT BEFORE THE STUDY GOES LIVE:
 *
 *   1. delete this file — it sits in src/components/dev/, the folder that goes as a whole
 *   2. delete the import and the <DevFillFeedbackButton … /> line in
 *      src/experiment/UserFeedbackPage.tsx
 *
 * It follows DevResetButton exactly, including the reason that file is shaped the way it is:
 * `import.meta.env.DEV` is replaced by the literal `false` at build time, so the guard below
 * becomes `if (true) return null` and everything after it — the control, its label, the filling
 * itself — is unreachable and is dropped from the bundle. Nothing here can reach a participant
 * even if the two steps above are forgotten. To check that for yourself, build and search dist/
 * for the word "Fill feedback": it is not there.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY IT SITS ON THE PAGE RATHER THAN IN App.tsx. The reset button belongs everywhere, so it is
 * mounted once, above the flow. This one needs the feedback page's own answer state, which only
 * that page has. It is handed a single callback and knows nothing else about the page.
 *
 * WHY IT DOES NOT SUBMIT. Filling and submitting are different things: the submit path writes a
 * real record, stops the clock and marks the study completed. A tester who wants that presses the
 * page's own button, which is also the only way to see the page behave as a participant sees it.
 */

import { Box, Button, Icon } from "@chakra-ui/react";
import { LuWandSparkles } from "react-icons/lu";

export function DevFillFeedbackButton({ onFill }: { onFill: () => void }) {
  if (!import.meta.env.DEV) return null;

  return (
    /* Above the reset button, in the same corner and the same size, so the two read as one pair of
       development controls rather than as part of the study. */
    <Box position="fixed" bottom="16" left="4" zIndex="banner">
      <Button size="xs" variant="outline" rounded="md" onClick={onFill}
        borderColor="border.emphasized" color="fg.muted"
        _hover={{ bg: "bg.subtle", color: "fg" }}
        title="DEV ONLY — answers every visible feedback question so the page can be submitted. Does not submit.">
        <Icon boxSize="3.5"><LuWandSparkles /></Icon>
        Fill feedback (dev)
      </Button>
    </Box>
  );
}
