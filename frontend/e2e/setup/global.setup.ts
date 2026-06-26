import { test as setup } from "@playwright/test";
import fs from "node:fs";
import { makeUser, MANAGER_EMAIL, MANAGER_PASSWORD } from "../fixtures/data";
import { loginUser, registerUser, setUserRole, storageStateForToken } from "../fixtures/api";
import {
  STORAGE_DIR,
  storageFileFor,
  usersFile,
  type RoleLabel,
  type SeededUser,
} from "../fixtures/roles";

/**
 * Setup-Projekt: legt die Standard-Rollen an und schreibt für jede Rolle ein
 * `storageState`, damit die eigentlichen Tests ohne UI-Login direkt eingeloggt
 * starten können.
 *
 * - anfrager/anbieter: werden pro Lauf frisch per API registriert.
 * - manager: ist über die `MANAGER_EMAIL_ALLOWLIST` fest provisioniert (siehe
 *   e2e/README.md). Wir loggen uns nur ein – kein Neustart nötig.
 * - moderator: frisch registriert und anschließend vom Manager per API
 *   befördert. Der Backend-Auth-Layer liest die Rolle live aus der DB, daher
 *   greift die Beförderung sofort (auch mit dem bestehenden Token).
 */
setup("prepare roles and sessions", async ({ request }) => {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  const seeded: Record<string, SeededUser> = {};

  const writeSession = (label: RoleLabel, token: string) => {
    fs.writeFileSync(
      storageFileFor(label),
      JSON.stringify(storageStateForToken(token), null, 2),
    );
  };

  // --- Standard-Nutzer: anfrager, anbieter ---
  for (const label of ["anfrager", "anbieter"] as const) {
    const user = makeUser(label);
    const payload = await registerUser(request, user);
    writeSession(label, payload.accessToken);
    seeded[label] = { ...user, id: payload.user.id, token: payload.accessToken };
  }

  // --- Manager: fest provisioniert, nur einloggen ---
  const managerAuth = await loginUser(request, MANAGER_EMAIL, MANAGER_PASSWORD);
  if (managerAuth.user.role !== "MANAGER") {
    throw new Error(
      `Erwartete Rolle MANAGER für ${MANAGER_EMAIL}, erhielt "${managerAuth.user.role}". ` +
        `Stelle sicher, dass die E-Mail in MANAGER_EMAIL_ALLOWLIST steht und das Backend ` +
        `seit dem Eintrag neu gestartet wurde (siehe e2e/README.md).`,
    );
  }
  writeSession("manager", managerAuth.accessToken);
  seeded.manager = {
    label: "manager",
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
    name: managerAuth.user.name,
    address: "",
    id: managerAuth.user.id,
    token: managerAuth.accessToken,
  };

  // --- Moderator: registrieren + vom Manager befördern ---
  const moderatorUser = makeUser("moderator");
  const moderatorPayload = await registerUser(request, moderatorUser);
  await setUserRole(request, managerAuth.accessToken, moderatorPayload.user.id, "MODERATOR");
  writeSession("moderator", moderatorPayload.accessToken);
  seeded.moderator = {
    ...moderatorUser,
    id: moderatorPayload.user.id,
    token: moderatorPayload.accessToken,
  };

  fs.writeFileSync(usersFile, JSON.stringify(seeded, null, 2));
});
