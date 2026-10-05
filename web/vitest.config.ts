import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Tests always use the in-memory mocks, whatever the local .env.local says.
    env: { VITE_MOCK_AREAS: "*" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
