import { Box } from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";
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
    </Box>
  );
}

export default App;
