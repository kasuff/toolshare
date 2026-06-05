import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/tests/**/*.{test,spec}.{ts,tsx}"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./junit.xml"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "cobertura", "html", "lcov"],
      reportsDirectory: "./coverage"
    }
  },
});
