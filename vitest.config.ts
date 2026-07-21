import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Pure unit tests only — no emulator, no credentials needed. Tests that
    // require the Firestore emulator (rules tests, applySessionAction
    // integration) live under a distinct naming/path pattern excluded here
    // and run separately via `npm run test:emulator` + vitest.config.emulator.ts.
    include: ["src/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "src/lib/scheduling/__tests__/firestore.rules.test.ts",
      "src/**/*.emulator.test.ts",
    ],
  },
});
