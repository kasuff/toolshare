import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
}

function getImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const imports: string[] = [];
  const lines = content.split("\n");
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ")) {
      const match = trimmed.match(/from\s+["'](.*)["']/);
      if (match && match[1]) {
        imports.push(match[1]);
      }
    }
  });
  return imports;
}

function resolveLocalImport(filePath: string, imp: string): string | null {
  if (!imp.startsWith(".")) {
    return null;
  }
  const base = path.resolve(path.dirname(filePath), imp);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function importsForbiddenLayer(resolved: string | null, layerSegment: string): boolean {
  return Boolean(resolved?.includes(`${path.sep}${layerSegment}${path.sep}`));
}

describe("Frontend Layered Architecture Constraints", () => {
  const srcDir = path.join(__dirname, "../src");
  const allFiles = getAllFiles(srcDir).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

  it("components must not import from pages", () => {
    const components = allFiles.filter((file) => file.includes(`${path.sep}components${path.sep}`));

    components.forEach((component) => {
      const imports = getImports(component);
      imports.forEach((imp) => {
        const resolved = resolveLocalImport(component, imp);
        expect(importsForbiddenLayer(resolved, "pages"))
          .withContext(`Component ${component} imports page module: ${imp}`)
          .toBe(false);
      });
    });
  });

  it("components must not import api client from shared", () => {
    const components = allFiles.filter((file) => file.includes(`${path.sep}components${path.sep}`));

    components.forEach((component) => {
      const content = fs.readFileSync(component, "utf-8");
      const importsApi =
        content.includes('from "@toolshare/shared"') &&
        (content.includes("{ api") || content.includes(", api") || content.includes(" api "));
      expect(importsApi)
        .withContext(`Component ${component} must not import api from @toolshare/shared`)
        .toBe(false);
    });
  });

  it("utils must not import from components", () => {
    const utils = allFiles.filter((file) => file.includes(`${path.sep}utils${path.sep}`));

    utils.forEach((utilFile) => {
      const imports = getImports(utilFile);
      imports.forEach((imp) => {
        const resolved = resolveLocalImport(utilFile, imp);
        expect(importsForbiddenLayer(resolved, "components"))
          .withContext(`Util ${utilFile} imports component module: ${imp}`)
          .toBe(false);
      });
    });
  });

  it("store must not import from components or pages", () => {
    const stores = allFiles.filter((file) => file.includes(`${path.sep}store${path.sep}`));

    stores.forEach((storeFile) => {
      const imports = getImports(storeFile);
      imports.forEach((imp) => {
        const resolved = resolveLocalImport(storeFile, imp);
        const forbidden =
          importsForbiddenLayer(resolved, "components") || importsForbiddenLayer(resolved, "pages");
        expect(forbidden)
          .withContext(`Store ${storeFile} imports UI module: ${imp}`)
          .toBe(false);
      });
    });
  });
});
