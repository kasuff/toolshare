import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const reactRoot = path.dirname(require.resolve("react/package.json"));
const reactDomRoot = path.dirname(require.resolve("react-dom/package.json"));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: reactRoot,
      "react-dom": reactDomRoot,
      "react/jsx-runtime": path.join(reactRoot, "jsx-runtime"),
      "react/jsx-dev-runtime": path.join(reactRoot, "jsx-dev-runtime"),
      zod: path.resolve(__dirname, "node_modules/zod"),
    },
    dedupe: ["react", "react-dom"],
  },
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
