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
├── docker-compose.yml
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

# Alle Services starten (Frontend, Backend, DB)
docker compose up

# Oder einzeln:
# Frontend:  http://localhost:3000
# Backend:   http://localhost:4000
# DB:        localhost:5432
```

---

## Dokumentation

Die vollständige Projektdokumentation (Architektur, ADRs, Scrum, etc.) befindet sich im separaten Repository:

👉 [project-management](https://gitlab.lrz.de/swe2_if/team06/project-management)

---

## Team

SE2 – Team 06 | Hochschule München | SS 2026
