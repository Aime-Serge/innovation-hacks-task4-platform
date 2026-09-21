import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // jsdom + coverage instrumentation makes the 500-task render slow on CI runners.
    testTimeout: 20_000,
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/contract/**/*.test.ts",
      "src/**/*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.*"],
      reporter: ["text-summary", "json-summary", "text"],
      // NFR-16: 80% minimum. Never lowered to pass the gate.
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
