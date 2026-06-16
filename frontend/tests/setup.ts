import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const createStoragePolyfill = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  };
};

if (!globalThis.structuredClone) {
  globalThis.structuredClone = <T>(value: T) => JSON.parse(JSON.stringify(value)) as T;
}

if (typeof globalThis.localStorage?.getItem !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStoragePolyfill(),
    writable: true
  });
}

if (typeof globalThis.sessionStorage?.getItem !== "function") {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: createStoragePolyfill(),
    writable: true
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  // Globale Stubs (z.B. FileReader, fetch) zurücksetzen, damit sie nicht in
  // andere Test-Dateien lecken – im CI laufen alle Dateien in einem Worker.
  vi.unstubAllGlobals();
  if (typeof localStorage?.clear === "function") {
    localStorage.clear();
  }
  if (typeof sessionStorage?.clear === "function") {
    sessionStorage.clear();
  }
});
