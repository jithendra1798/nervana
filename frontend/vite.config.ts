import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Local backend; the app calls /v1/* on its own origin, so no CORS setup is needed.
    proxy: { "/v1": "http://localhost:8000" },
    // Mock mode reads the shared fixtures in ../contracts.
    fs: { allow: [".."] },
  },
});
