# E2E-Tests (Playwright)

End-to-End-Tests für ToolShare. Sie prüfen echte Nutzerflows im Browser über
Frontend, Backend und Session hinweg – als Ergänzung zu den Vitest-/Supertest-Tests.

## Voraussetzung

Der komplette Stack muss laufen (Frontend :3000, Backend :4000, Postgres). Lokal
am einfachsten:

```bash
docker compose up -d
```

Playwright verwendet den laufenden Stack wieder und startet keinen zweiten Server.

## Ausführen

```bash
cd frontend

npm run test:e2e            # alle Projekte (Desktop + Mobile-/WebKit-Smoke)
npm run test:e2e -- --project=desktop-chromium
npm run test:e2e:mobile    # nur Mobile-Viewport (@smoke, inkl. Mobile-Nav)
npm run test:e2e:ui        # interaktiver UI-Modus
npm run test:e2e:debug     # Debugger
npm run test:e2e:report    # letzten HTML-Report öffnen
npm run test:e2e:codegen   # Selektoren aufnehmen
```

Überschreibbare URLs per Env: `E2E_BASE_URL`, `E2E_API_URL`.

### Browser-Projekte

- `desktop-chromium` – volle Suite (Chromium).
- `mobile-chrome` – nur `@smoke`-Flows auf einem Mobile-Viewport (Pixel 7).
- `webkit-smoke` – nur `@smoke`-Flows auf der Safari-/WebKit-Engine
  (Cross-Browser-Absicherung). Benötigt einmalig `npx playwright install webkit`.

## Aufbau

```
e2e/
├── fixtures/
│   ├── data.ts      eindeutige Testdaten (Nutzer, Adressen, Datumshelfer, Manager-Creds)
│   ├── api.ts       API-Helfer (Register/Login/Tools/Workshops/Rolle) + storageState
│   └── roles.ts     Pfade & Zugriff auf vorbereitete Rollen-Sessions
├── setup/
│   └── global.setup.ts   legt Rollen an und schreibt .auth/*.json
├── smoke.spec.ts        Phase 1: Startseite, Gast, Login, Mobile-Nav (@smoke)
├── auth.spec.ts         Login, Registrierung (Adress-Mock), Logout
├── tools.spec.ts        Werkzeugsuche und -detail (Gast)
├── requests.spec.ts     Phase 2: Ausleihanfrage + Inbox-Entscheidung (Akzeptieren/Ablehnen)
├── workshops.spec.ts    Phase 2: Werkstattbuchung + Konflikt (blockierter Zeitraum)
├── admin.spec.ts        Admin: Nutzerverwaltung (Rolle/Sperre) + Zugriffsschutz
├── moderation.spec.ts   Moderation: Bereich sichtbar + Zugriffsschutz
├── clock.spec.ts        Phase 3: Clock-Mocking (deterministische Default-Daten)
├── network.spec.ts      Phase 3: Network-Mocking (erzwungener Backend-Fehler)
└── a11y.spec.ts         Phase 3: Accessibility-Scan ganzer Seiten (axe)
```

`a11y.spec.ts` scannt ganze, real gerenderte Seiten mit `@axe-core/playwright`
(WCAG 2.0/2.1/2.2, A & AA, inkl. Farbkontrast) und ergänzt die komponenten-
basierten jest-axe-Tests der Vitest-Suite (die in jsdom z. B. Farbkontrast gar
nicht auswerten können). Der Scan läuft mit `prefers-reduced-motion: reduce`,
prüft also auch den Reduced-Motion-Pfad und ist unabhängig von laufenden
Einblende-Animationen.

`.auth/` (Sessions) und `playwright-report/`, `test-results/` sind gitignored.

## Rollen & Sessions

Das Setup (`global.setup.ts`) bereitet vier Rollen-Sessions vor:

- `anfrager`, `anbieter` – normale Nutzer, pro Lauf frisch per API registriert.
- `manager` – fest provisioniert (siehe unten), wird nur eingeloggt.
- `moderator` – frisch registriert und vom Manager per API befördert
  (`PATCH /users/:id/role`). Der Backend-Auth-Layer liest die Rolle live aus der
  DB, daher greift die Beförderung sofort.

### Manager einmalig provisionieren

Ein `MANAGER` entsteht nur über die `MANAGER_EMAIL_ALLOWLIST`, die **beim
Backend-Start** bereits registrierte Nutzer befördert. Einmalige Einrichtung:

1. Test-Manager-E-Mail zur Allowlist in `docker-compose.yml` hinzufügen
   (bereits geschehen: `e2e-manager@toolshare.test`).
2. Die E-Mail registrieren (z. B. per API), Passwort setzen.
3. Backend **einmal** neu starten (`docker compose up -d backend`), damit der
   Bootstrap die E-Mail zu `MANAGER` befördert.

Danach genügt pro Testlauf der API-Login – kein weiterer Neustart nötig. Die
Zugangsdaten stehen in `fixtures/data.ts` (`MANAGER_EMAIL`/`MANAGER_PASSWORD`)
und sind per Env überschreibbar (`E2E_MANAGER_EMAIL`, `E2E_MANAGER_PASSWORD`).
