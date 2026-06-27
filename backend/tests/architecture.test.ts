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
    if (trimmed.startsWith("import ") || trimmed.startsWith("export ")) {
      const match = trimmed.match(/from\s+["'](.*)["']/);
      if (match && match[1]) {
        imports.push(match[1]);
      }
    }
  });
  return imports;
}

function assertNoImport(
  files: string[],
  label: string,
  predicate: (imp: string, file: string) => boolean
): void {
  for (const file of files) {
    for (const imp of getImports(file)) {
      if (imp.startsWith(".") && predicate(imp, file)) {
        throw new Error(`[${label}] ${path.relative(srcDir, file)} must not import "${imp}"`);
      }
    }
  }
}

const srcDir = path.join(__dirname, "../src");
const allFiles = getAllFiles(srcDir).filter((file) => file.endsWith(".ts"));

describe("Layered Architecture Constraints", () => {
  // ── Module layer (controller → service → repository) ──────────────────────

  it("Controllers should only import from services, validations, types/DTOs, config, or utils", () => {
    const controllers = allFiles.filter((file) => file.includes(".controller.ts"));
    assertNoImport(controllers, "Controller", (imp) =>
      imp.includes(".repository") || imp.includes(".route")
    );
  });

  it("Services should not import from controllers, routes, or presenters", () => {
    const services = allFiles.filter((file) => file.includes(".service.ts"));
    assertNoImport(services, "Service", (imp) =>
      imp.includes(".controller") || imp.includes(".route") || imp.includes(".presenter")
    );
  });

  it("Repositories should not import from services, controllers, or routes", () => {
    const repositories = allFiles.filter((file) => file.includes(".repository.ts"));
    assertNoImport(repositories, "Repository", (imp) => {
      // The outbox pattern intentionally couples repositories to the outbox
      // infrastructure service so that domain writes and event enqueuing are
      // committed atomically in the same transaction.
      const isOutboxServiceImport = imp.includes("/infrastructure/outbox/");
      return (
        imp.includes(".controller") ||
        imp.includes(".route") ||
        (imp.includes(".service") && !isOutboxServiceImport)
      );
    });
  });

  it("Services must not import prisma directly", () => {
    const services = allFiles.filter((file) => file.includes(".service.ts"));
    assertNoImport(services, "Service/prisma", (imp) =>
      imp.includes("config/prisma") || imp.endsWith("/prisma")
    );
  });

  // ── Routes ────────────────────────────────────────────────────────────────

  it("Routes must not import from repositories directly", () => {
    const routes = allFiles.filter((file) => file.includes(".routes.ts"));
    assertNoImport(routes, "Route", (imp) => imp.includes(".repository"));
  });

  // ── Presenters ────────────────────────────────────────────────────────────

  it("Presenters must not import from repositories, services, or infrastructure", () => {
    const presenters = allFiles.filter((file) => file.includes(".presenter.ts"));
    assertNoImport(presenters, "Presenter", (imp, file) => {
      const resolved = path.resolve(path.dirname(file), imp).replace(/\\/g, "/");
      // Port interfaces (type-only imports for mapping shapes) are allowed;
      // only concrete infrastructure implementations are forbidden.
      const isPortImport = resolved.includes("/ports/");
      return (
        imp.includes(".repository") ||
        (imp.includes(".service") && !isPortImport) ||
        (imp.includes("/infrastructure/") && !isPortImport)
      );
    });
  });

  // ── Infrastructure ────────────────────────────────────────────────────────

  it("Infrastructure adapters must not import from module controllers, services, or repositories", () => {
    const infraFiles = allFiles.filter((file) => file.includes("/infrastructure/"));
    for (const file of infraFiles) {
      // The outbox processor is the intentional bridge between the outbox
      // infrastructure and the notification/inbox module layer. It needs
      // direct access to notificationsRepository and pushService to deliver
      // queued events — this coupling is by design and isolated to one file.
      if (file.includes("outbox.processor.ts")) continue;

      for (const imp of getImports(file)) {
        if (!imp.startsWith(".")) continue;
        const resolved = path.resolve(path.dirname(file), imp).replace(/\\/g, "/");
        // Cross-infrastructure imports (e.g. outbox helper → outbox service) are fine
        if (resolved.includes("/infrastructure/")) continue;
        const targetsModule = resolved.includes("/modules/");
        if (
          targetsModule &&
          (imp.includes(".controller") ||
            imp.includes(".routes") ||
            imp.includes(".service") ||
            imp.includes(".repository"))
        ) {
          throw new Error(
            `[Infrastructure] ${path.relative(srcDir, file)} must not import module-layer file "${imp}"`
          );
        }
      }
    }
  });

  // ── Ports (interfaces) ────────────────────────────────────────────────────

  it("Ports must not import from infrastructure or module layer", () => {
    const portFiles = allFiles.filter((file) => file.includes("/ports/"));
    assertNoImport(portFiles, "Port", (imp) =>
      imp.includes("/infrastructure/") ||
      imp.includes("/modules/") ||
      imp.includes(".controller") ||
      imp.includes(".service") ||
      imp.includes(".repository")
    );
  });

  // ── Domain ────────────────────────────────────────────────────────────────

  it("Domain entities and events must not import from infrastructure, services, controllers, or repositories", () => {
    const domainFiles = allFiles.filter(
      (file) => file.includes(".entity.ts") || file.includes("/domain/")
    );
    assertNoImport(domainFiles, "Domain", (imp) =>
      imp.includes("/infrastructure/") ||
      imp.includes(".controller") ||
      imp.includes(".service") ||
      imp.includes(".repository") ||
      imp.includes(".routes")
    );
  });
});
