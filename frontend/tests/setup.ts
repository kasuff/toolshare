import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

if (!globalThis.structuredClone) {
  globalThis.structuredClone = <T>(value: T) => JSON.parse(JSON.stringify(value)) as T;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
