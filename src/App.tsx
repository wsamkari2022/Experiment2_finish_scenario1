import { Box } from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";
import { ExperimentFlow } from "./experiment/ExperimentFlow";
import { StudyErrorBoundary } from "./experiment/StudyErrorBoundary";
import { ActivePauseBadge } from "./experiment/ActivePauseBadge";
import { NotYouLink } from "./experiment/NotYouLink";

function App() {
  return (
    <Box pos="relative">
      <Box
        pos="fixed"
        top="4"
        right="4"
        zIndex="banner"
      >
        <ColorModeButton size="md" />
      </Box>
      {/* "Not you?" when the page opens with a university run in this browser (a shared computer; since 6 October 2026):
          a strip above the study, so it covers nothing. */}
      <NotYouLink />
      {/* The whole study sits inside the safety net, so a crash anywhere in it becomes a page
          with a Continue button rather than a blank screen. See StudyErrorBoundary. */}
      <StudyErrorBoundary>
        <ExperimentFlow />
      </StudyErrorBoundary>
      {/* Above every screen, because the clock pauses wherever the participant happens to be. */}
      <ActivePauseBadge />
    </Box>
  );
}

export default App;
