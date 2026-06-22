import { test as teardown } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MANAGER_EMAIL } from "../fixtures/data";

const here = path.dirname(fileURLToPath(import.meta.url));
// frontend/e2e/setup -> Repo-Wurzel (dort liegt die docker-compose.yml).
const repoRoot = path.resolve(here, "..", "..", "..");

/**
 * Räumt nach dem kompletten Lauf alle E2E-Daten wieder ab, sodass die lokale DB
 * aussieht wie vorher – mit Ausnahme des fest provisionierten Managers.
 *
 * Strategie: Ein einziger Cascade-Delete aller Test-Nutzer (E-Mail `e2e-%`,
 * Manager ausgenommen). Über die `onDelete: Cascade`-Beziehungen verschwinden
 * dabei auch deren Tools, Werkstätten, Buchungen, Ratings usw. Da es keinen
 * User-Delete-Endpoint gibt, läuft das direkt gegen den Docker-Postgres.
 *
 * Best-effort: Ohne erreichbaren Docker-Stack wird der Schritt übersprungen
 * (mit Warnung), damit der Lauf nicht künstlich fehlschlägt.
 */
teardown("clean up e2e data", async () => {
  const managerEmail = MANAGER_EMAIL.replace(/'/g, "''");
  const sql = `DELETE FROM "User" WHERE email LIKE 'e2e-%' AND email <> '${managerEmail}';`;

  try {
    const output = execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "toolshare",
        "-d",
        "toolshare",
        "-c",
        sql,
      ],
      { cwd: repoRoot, stdio: "pipe" },
    ).toString();
    // psql gibt z. B. "DELETE 53" zurück.
    // eslint-disable-next-line no-console
    console.log(`[teardown] E2E-Cleanup: ${output.trim()}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[teardown] DB-Cleanup übersprungen (Docker-Postgres nicht erreichbar?): ${
        (error as Error).message
      }`,
    );
  }
});
