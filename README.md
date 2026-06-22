# ToolShare Neufreimann

Werkzeugverleih & Werkstattbuchung für das Stadtquartier Neufreimann in München.

---

## Projektübersicht

**ToolShare** ist eine Plattform, die es Bewohnern ermöglicht:

- 🔧 **Werkzeuge** untereinander zu verleihen
- 🏭 **Gemeinschaftliche Werkstätten** zu buchen
- ⭐ **Bewertungen** abzugeben, um Vertrauen aufzubauen
- 🔔 **Benachrichtigungen** zu Anfragen und Buchungen zu erhalten

Die Anwendung ist **nicht kommerziell** – es gibt keinen Zahlungsverkehr.

---

## Tech-Stack

| Bereich | Technologie |
|---------|------------|
| Frontend | React + Vite (TypeScript) |
| Backend | Node.js + Express (TypeScript) |
| Datenbank | PostgreSQL |
| ORM | Prisma |
| Auth | JWT + bcrypt |
| Container | Docker + Docker Compose |

---

## Projektstruktur

```
toolshare/
├── frontend/               # React SPA (Vite)
│   ├── src/
│   │   ├── components/     # Wiederverwendbare UI-Komponenten
│   │   ├── pages/          # Seitenkomponenten (Routes)
│   │   ├── hooks/          # Custom Hooks
│   │   ├── services/       # API-Client
│   │   ├── types/          # TypeScript Types
│   │   └── utils/          # Hilfsfunktionen
│   └── package.json
│
├── backend/                # Node.js + Express
│   ├── src/
│   │   ├── modules/        # Feature-Module (auth, tools, bookings, ...)
│   │   ├── middleware/     # Auth, Validation, Error Handling
│   │   ├── config/        # DB-Verbindung, Environment
│   │   └── utils/
│   ├── prisma/             # Datenbankschema
│   └── package.json
│
├── shared/                 # Gemeinsame TypeScript Types
│   └── types/
│
├── docker-compose.yml           # Development (Hot Reload, Volumes)
├── docker-compose.prod.yml      # Produktionsnahes Setup ohne Mounts
├── k8s/                         # Kubernetes Manifeste (No-Budget Setup)
└── .gitignore
```

---

## Lokale Entwicklung

### Voraussetzungen

- [Node.js](https://nodejs.org/) (>= 18)
- [Docker](https://www.docker.com/) + Docker Compose
- [Git](https://git-scm.com/)

### Starten

```bash
# Repo klonen
git clone https://gitlab.lrz.de/swe2_if/team06/toolshare.git
cd toolshare

# Alle Services starten (Frontend, Backend, DB) - Development
docker compose up --build

# Produktionsnahes Setup lokal testen
POSTGRES_PASSWORD=toolshare JWT_SECRET=change-me docker compose -f docker-compose.prod.yml up --build

# Oder einzeln:
# Frontend:  http://localhost:3000
# Backend:   http://localhost:4000
# DB:        localhost:5432
```

### Kubernetes Deployment (ohne Managed DB)

Im Verzeichnis `k8s/` liegen die Basismanifeste für ein self-hosted Deployment auf HMKube:

- PostgreSQL mit persistentem Volume
- Prisma-Migrationsjob
- Backup-CronJob (`pg_dump`)
- Frontend/Backend Deployments und Services
- Ingress für `/` und `/api`

---

## Mobile App (Android/iOS)

Das Projekt beinhaltet eine React Native / Expo App im Ordner `mobile`.

### Testen mit Expo Go (Schnellstart)

1. Lade dir die App **"Expo Go"** aus dem Google Play Store oder Apple App Store auf dein Smartphone herunter.
2. Wechsle im Terminal in den Mobile-Ordner und starte den Server:
   ```bash
   cd mobile
   npm install
   npm start
   ```
3. Scanne den im Terminal (oder Browser) angezeigten QR-Code mit der Kamera-App deines Smartphones (iOS) oder direkt in der Expo Go App (Android).
4. Die App verbindet sich automatisch mit dem Backend. In der `mobile/.env` Datei kann dafür die URL über `EXPO_PUBLIC_API_URL` konfiguriert werden.

Für Details zur nativen Installation (als eigene `.apk` Datei) siehe die Datei [ANDROID_DEPLOYMENT.md](mobile/ANDROID_DEPLOYMENT.md) im `mobile` Verzeichnis.

---

## Dokumentation

Die vollständige Projektdokumentation (Architektur, ADRs, Scrum, etc.) befindet sich im separaten Repository:

👉 [project-management](https://gitlab.lrz.de/swe2_if/team06/project-management)

Architektur liegt im Doku-Repo; im Code gelten lesbarer Code und sinnvolle Kommentare ([ADR-007](https://gitlab.lrz.de/swe2_if/team06/project-management/-/blob/main/docs/adr/007-repo-struktur.md)).

---

## Architekturrichtlinien

- **State Management:** Client-State (`authStore`, `inboxStore`) mit Zustand; Server-State (Tools, …) mit TanStack Query in `hooks/queries/`. Siehe ADR-010/014 im Doku-Repo.
- **Frontend-Schichten:** API (`@toolshare/shared`) → Hooks → UI. Erzwungen durch `frontend/tests/architecture.test.ts` (CI: `frontend:architecture`).
- **Single Responsibility Principle (SRP):** Große Komponenten werden konsequent in wiederverwendbare UI-Komponenten und fachliche Helper-Funktionen aufgeteilt.
- **Fehlerbehandlung:** Zentrales Error-Handling durch React Error Boundaries fängt unerwartete Fehler in Frontend und Mobile sicher ab.
- **Architekturtests:** Backend (`backend/tests/architecture.test.ts`) und Frontend (`frontend/tests/architecture.test.ts`) in der CI-Pipeline (vitest).
- **Geocoding:** `GeocodingService`-Abstraktion mit Redis-Cache und Nominatim-Rate-Limiter — siehe ADR-011.

---

## Team

SE2 – Team 06 | Hochschule München | SS 2026
