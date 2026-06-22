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

describe("Layered Architecture Constraints", () => {
  const srcDir = path.join(__dirname, "../src");
  const allFiles = getAllFiles(srcDir).filter((file) => file.endsWith(".ts"));

  it("Controllers should only import from services, validations, types/DTOs, config, or utils", () => {
    const controllers = allFiles.filter((file) => file.includes(".controller.ts"));
    
    controllers.forEach((controller) => {
      const imports = getImports(controller);
      imports.forEach((imp) => {
        if (imp.startsWith(".")) {
          // Check what local module is imported
          const isDisallowed = imp.includes(".repository") || imp.includes(".route");
          expect(isDisallowed).withContext(`Controller ${controller} imports unauthorized module: ${imp}`).toBe(false);
        }
      });
    });
  });

  it("Services should not import from controllers or routes", () => {
    const services = allFiles.filter((file) => file.includes(".service.ts"));
    
    services.forEach((service) => {
      const imports = getImports(service);
      imports.forEach((imp) => {
        if (imp.startsWith(".")) {
          const isDisallowed = imp.includes(".controller") || imp.includes(".route");
          expect(isDisallowed).withContext(`Service ${service} imports unauthorized module: ${imp}`).toBe(false);
        }
      });
    });
  });

  it("Repositories should not import from services, controllers, or routes", () => {
    const repositories = allFiles.filter((file) => file.includes(".repository.ts"));
    
    repositories.forEach((repo) => {
      const imports = getImports(repo);
      imports.forEach((imp) => {
        if (imp.startsWith(".")) {
          const isDisallowed = imp.includes(".controller") || imp.includes(".service") || imp.includes(".route");
          expect(isDisallowed).withContext(`Repository ${repo} imports unauthorized module: ${imp}`).toBe(false);
        }
      });
    });
  });

  it("Services must not import prisma directly", () => {
    const services = allFiles.filter((file) => file.includes(".service.ts"));

    services.forEach((service) => {
      const imports = getImports(service);
      const prismaImports = imports.filter(
        (imp) => imp.includes("config/prisma") || imp.endsWith("/prisma") || imp === "../../config/prisma"
      );
      expect(prismaImports).withContext(`Service ${service} must not import prisma: ${prismaImports.join(", ")}`).toEqual([]);
    });
  });
});
