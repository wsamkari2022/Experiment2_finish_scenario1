import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    hmr: {
      overlay: false,
    },
    /*
     * Sends /api/... to the local API server (server/index.js), which is the only thing that
     * talks to MongoDB. Proxying rather than calling http://localhost:4000 directly keeps the
     * app on one origin, so there is no CORS involved and no hostname baked into the client.
     */
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
})
