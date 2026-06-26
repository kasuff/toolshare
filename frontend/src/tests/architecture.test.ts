import { describe, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const srcDir = path.resolve(__dirname, "../../");

function getAllFiles(dirPath: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dirPath)) {
    const full = path.join(dirPath, entry);
    if (fs.statSync(full).isDirectory()) {
      getAllFiles(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function getLocalImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("import ") || l.startsWith("export "))
    .map((l) => l.match(/from\s+["'](.+?)["']/)?.[1] ?? "")
    .filter((imp) => imp.startsWith("."));
}

function resolveLayer(imp: string, fromFile: string): string | null {
  const abs = path.resolve(path.dirname(fromFile), imp).replace(/\\/g, "/");
  if (abs.includes("/src/pages/")) return "pages";
  if (abs.includes("/src/components/")) return "components";
  if (abs.includes("/src/hooks/queries/")) return "hooks/queries";
  if (abs.includes("/src/hooks/")) return "hooks";
  if (abs.includes("/src/store/")) return "store";
  if (abs.includes("/src/services/")) return "services";
  if (abs.includes("/src/utils/")) return "utils";
  if (abs.includes("/src/lib/")) return "lib";
  if (abs.includes("/src/constants/")) return "constants";
  return null;
}

function filesInLayer(layerPath: string): string[] {
  const dir = path.join(srcDir, layerPath);
  if (!fs.existsSync(dir)) return [];
  return getAllFiles(dir).filter((f) => /\.(ts|tsx)$/.test(f));
}

function assertNoDependencyOn(
  fromLayer: string,
  forbiddenLayers: string[]
): void {
  const files = filesInLayer(fromLayer);
  for (const file of files) {
    const imports = getLocalImports(file);
    for (const imp of imports) {
      const target = resolveLayer(imp, file);
      if (target && forbiddenLayers.includes(target)) {
        throw new Error(
          `Layer violation in ${fromLayer}:\n` +
            `  ${path.relative(srcDir, file)}\n` +
            `  → imports from "${target}" (forbidden for this layer)\n` +
            `  import: "${imp}"`
        );
      }
    }
  }
}

// ── Layer rules ─────────────────────────────────────────────────────────────
//
//  pages            top — darf alles importieren
//  components       darf NICHT pages importieren
//  hooks/queries    darf NICHT pages, components importieren
//  hooks            darf NICHT pages, components importieren
//  store            darf NICHT pages, components, hooks importieren
//  services         darf NICHT pages, components, hooks, store importieren
//  utils            Blatt — darf NICHT pages, components, hooks, store, services importieren
//  lib              Infrastruktur — darf NICHT pages, components, hooks, store, services importieren
//  constants        Reines Datum — darf KEIN lokales Modul importieren
//
describe("Frontend Layered Architecture Constraints", () => {
  it("components must not import from pages", () => {
    assertNoDependencyOn("components", ["pages"]);
  });

  it("hooks/queries must not import from pages or components", () => {
    assertNoDependencyOn("hooks/queries", ["pages", "components"]);
  });

  it("hooks must not import from pages or components", () => {
    assertNoDependencyOn("hooks", ["pages", "components"]);
  });

  it("store must not import from pages, components, or hooks", () => {
    assertNoDependencyOn("store", ["pages", "components", "hooks", "hooks/queries"]);
  });

  it("services must not import from pages, components, hooks, or store", () => {
    assertNoDependencyOn("services", ["pages", "components", "hooks", "hooks/queries", "store"]);
  });

  it("utils are leaf nodes — must not import from view or state layers", () => {
    assertNoDependencyOn("utils", ["pages", "components", "hooks", "hooks/queries", "store", "services"]);
  });

  it("lib is infrastructure — must not import from any business layer", () => {
    assertNoDependencyOn("lib", ["pages", "components", "hooks", "hooks/queries", "store", "services", "utils"]);
  });

  it("constants are pure data — must not import from any local layer", () => {
    assertNoDependencyOn("constants", [
      "pages",
      "components",
      "hooks",
      "hooks/queries",
      "store",
      "services",
      "utils",
      "lib",
    ]);
  });
});
