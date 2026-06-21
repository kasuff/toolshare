import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./junit.xml"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "cobertura", "html", "lcov"],
      reportsDirectory: "./coverage",
      // The monitoring module only exposes a Prometheus metrics endpoint for the
      // external observability stack -- it is not application logic we unit-test,
      // so keep it out of the coverage numbers (it is loaded transitively via app.ts).
      exclude: ["src/modules/monitoring/**"]
    }
  }
});
