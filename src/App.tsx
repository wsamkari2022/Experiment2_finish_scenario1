import { Box } from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";
// DEV ONLY — delete this import, the <DevResetButton /> below, and src/components/dev/ before launch.
import { DevResetButton } from "@/components/dev/DevResetButton";
import { ExperimentFlow } from "./experiment/ExperimentFlow";

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
      <ExperimentFlow />
      {/* DEV ONLY — renders nothing in a production build. See DevResetButton for how to remove. */}
      <DevResetButton />
    </Box>
  );
}

export default App;
