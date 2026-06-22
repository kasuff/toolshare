import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@toolshare/shared/contracts",
        replacement: path.resolve(__dirname, "../shared/contracts")
      },
      {
        find: "@toolshare/shared",
        replacement: path.resolve(__dirname, "../shared/index.ts")
      },
      {
        find: "zod",
        replacement: path.resolve(__dirname, "node_modules/zod")
      }
    ]
  },
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
