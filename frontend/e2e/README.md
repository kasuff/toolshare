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
│   ├── booking.ts   Buchungs-Flow-Helfer (Werkzeug anlegen, Anfrage, Inbox-Thread)
│   ├── forms.ts     UI-Form-Helfer (Adress-Mock, manuelle Adresse, Foto-Upload)
│   └── roles.ts     Pfade & Zugriff auf vorbereitete Rollen-Sessions
├── setup/
│   └── global.setup.ts   legt Rollen an und schreibt .auth/*.json
├── smoke.spec.ts        Phase 1: Startseite, Gast, Login, Mobile-Nav (@smoke)
├── auth.spec.ts         Login, Registrierung (Adress-Mock), Logout
├── tools.spec.ts        Werkzeugsuche und -detail (Gast)
├── create.spec.ts       Werkzeug + Werkstatt über die UI anlegen
├── manage.spec.ts       Werkzeug/Werkstatt bearbeiten + löschen (Anbieter)
├── offers.spec.ts       Meine Angebote + Profil (Name speichern, Passwort ändern)
├── requests.spec.ts     Phase 2: Ausleihanfrage + Inbox-Entscheidung (Akzeptieren/Ablehnen)
├── counter-proposal.spec.ts  Phase 2: Alternativvorschlag senden und annehmen (2 Kontexte)
├── completion.spec.ts   Phase 2: Bestätigte Buchung als abgeschlossen markieren
├── ratings.spec.ts      Phase 2: Bewertung nach Buchungsabschluss
├── notifications.spec.ts  Phase 2: Glocke zeigt ungelesene Konversationen
├── booking-conflict.spec.ts  Phase 2: Überlappende Doppelbuchung (409)
├── workshops.spec.ts    Phase 2: Werkstattbuchung + Konflikt (blockierter Zeitraum)
├── admin.spec.ts        Admin: Nutzerverwaltung (Rolle/Sperre) + Zugriffsschutz
├── system-rules.spec.ts Admin: Systemregeln bearbeiten
├── moderation.spec.ts   Moderation: Bereich sichtbar + Zugriffsschutz
├── moderation-workflow.spec.ts  Moderation: Meldung anlegen, verwerfen oder ermahnen
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

## Fixtures (Helfer)

Die Spec-Dateien sollen den **Nutzerflow** lesbar halten; wiederkehrendes Setup steckt in
`fixtures/`. Grob zwei Schichten:

| Schicht | Dateien | Zweck |
|---------|---------|--------|
| **Daten & Sessions** | `data.ts`, `roles.ts` | Eindeutige E-Mails/Suffixe, Datumsformate, Pfade zu `.auth/*.json` |
| **Setup ohne Browser** | `api.ts` | Backend direkt ansprechen (schnell, kein CORS) – Nutzer, Tools, Buchungen, Notifications |
| **UI-Flows** | `booking.ts`, `forms.ts` | Wiederkehrende Klickpfade im Browser (Anfrage stellen, Inbox öffnen, Formulare) |

**Warum getrennt?** API-Helfer legen Testdaten zuverlässig an und sparen UI-Schritte beim
Arrange-Teil. UI-Helfer kapseln nur dort, wo der Flow selbst getestet werden soll (z. B.
„Anfrage senden“). Multi-Rollen-Szenarien nutzen weiterhin **eigene Browser-Contexts** pro
Rolle (`storageFileFor`) – die Fixtures ersetzen das nicht.

### `data.ts`

- `uniqueSuffix()`, `makeUser()` – kollisionsfreie Testdaten pro Lauf
- `futureDate()` – Anzeigeformat `TT.MM.JJJJ` für `DateInput`
- `isoDaysFromNow()` – ISO-Zeitstempel für API-Buchungen
- `MANAGER_EMAIL` / `MANAGER_PASSWORD` – provisionierter Manager

### `api.ts`

Dünne Wrapper um `APIRequestContext` (Playwright `request`):

| Funktion | Verwendung |
|----------|------------|
| `registerUser`, `loginUser` | Nutzer anlegen / einloggen |
| `createTool`, `createWorkshop` | Angebote für Tests seeden |
| `createToolBooking` | Buchungs-Konflikte per API (ohne UI) |
| `listNotifications` | Outbox-/Benachrichtigungs-Polling (z. B. Ermahnung) |
| `setUserRole` | Moderator befördern (Setup) |
| `storageStateForToken` | `localStorage`-Session für sofort eingeloggte Tests |

### `booking.ts`

Wiederkehrende **Ausleihe-/Inbox-Flows** für Specs mit zwei Rollen:

| Funktion | Verwendung |
|----------|------------|
| `seedTool` | Eindeutiges Werkzeug für den Standard-Anbieter anlegen |
| `submitToolRequest` | Ausleihanfrage über die Werkzeug-Detailseite (UI) |
| `openInboxThread` | Konversation in der Inbox öffnen |
| `acceptBookingAsProvider` | Anbieter-Kontext: Anfrage akzeptieren |
| `completeBookingAsProvider` | Anbieter-Kontext: Buchung abschließen |

Genutzt u. a. in `requests.spec.ts`, `counter-proposal.spec.ts`, `completion.spec.ts`,
`ratings.spec.ts`, `notifications.spec.ts`, `moderation-workflow.spec.ts`.

### `forms.ts` & `roles.ts`

- `forms.ts` – Adress-Autocomplete mocken, Datei-Uploads, wiederkehrende Formularschritte
- `roles.ts` – `readUsers()` (Tokens/IDs aus Setup), `storageFileFor("anfrager" | …)`

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
