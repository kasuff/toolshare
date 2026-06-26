import { describe, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Project root (one level above this tests/ directory)
const projectRoot = path.resolve(__dirname, "..");

function getAllFiles(dirPath: string, files: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return files;
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
  const root = projectRoot.replace(/\\/g, "/");
  const rel = abs.startsWith(root) ? abs.slice(root.length) : abs;

  if (rel.match(/^\/(app)\//)) return "app";
  if (rel.match(/^\/(components)\//)) return "components";
  if (rel.match(/^\/(hooks\/queries)\//)) return "hooks/queries";
  if (rel.match(/^\/(hooks)\//)) return "hooks";
  if (rel.match(/^\/(store)\//)) return "store";
  if (rel.match(/^\/(utils)\//)) return "utils";
  if (rel.match(/^\/(lib)\//)) return "lib";
  if (rel.match(/^\/(constants)\//)) return "constants";
  return null;
}

function filesInLayer(layerPath: string): string[] {
  const dir = path.join(projectRoot, layerPath);
  return getAllFiles(dir).filter((f) => /\.(ts|tsx)$/.test(f));
}

function assertNoDependencyOn(fromLayer: string, forbiddenLayers: string[]): void {
  for (const file of filesInLayer(fromLayer)) {
    for (const imp of getLocalImports(file)) {
      const target = resolveLayer(imp, file);
      if (target && forbiddenLayers.includes(target)) {
        throw new Error(
          `Layer violation in ${fromLayer}:\n` +
            `  ${path.relative(projectRoot, file)}\n` +
            `  → imports from "${target}" (forbidden for this layer)\n` +
            `  import: "${imp}"`
        );
      }
    }
  }
}

// ── Layer rules ──────────────────────────────────────────────────────────────
//
//  app/            Top — Expo Router Screens, darf alles importieren
//  components/     darf NICHT app/ importieren
//  hooks/queries/  darf NICHT app/, components/ importieren
//  hooks/          darf NICHT app/, components/ importieren
//  store/          darf NICHT app/, components/, hooks/ importieren
//  utils/          Blatt — darf NICHT app/, components/, hooks/, store/ importieren
//  lib/            Infrastruktur — darf kein Business-Layer importieren
//  constants/      Reines Datum — darf kein lokales Modul importieren
//
describe("Mobile Layered Architecture Constraints", () => {
  it("components must not import from app screens", () => {
    assertNoDependencyOn("components", ["app"]);
  });

  it("hooks/queries must not import from app screens or components", () => {
    assertNoDependencyOn("hooks/queries", ["app", "components"]);
  });

  it("hooks must not import from app screens or components", () => {
    assertNoDependencyOn("hooks", ["app", "components"]);
  });

  it("store must not import from app screens, components, or hooks", () => {
    assertNoDependencyOn("store", ["app", "components", "hooks", "hooks/queries"]);
  });

  it("utils are leaf nodes — must not import from view or state layers", () => {
    assertNoDependencyOn("utils", ["app", "components", "hooks", "hooks/queries", "store"]);
  });

  it("lib is infrastructure — must not import from any business layer", () => {
    assertNoDependencyOn("lib", ["app", "components", "hooks", "hooks/queries", "store", "utils"]);
  });

  it("constants are pure data — must not import from any local layer", () => {
    assertNoDependencyOn("constants", [
      "app",
      "components",
      "hooks",
      "hooks/queries",
      "store",
      "utils",
      "lib",
    ]);
  });
});
