import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` is a Next.js guard package with no runtime; stub it so
      // service modules can be imported directly in node-based tests.
      "server-only": resolve(__dirname, "tests/stubs/server-only.ts"),
      // Match the Next.js "@/*" path alias.
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    // Rules/integration tests talk to the Firestore emulator; serial & patient.
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    pool: "forks",
  },
});
