# CI/CD Pipeline für ToolShare

Diese Dokumentation beschreibt die CI/CD-Pipeline für das ToolShare Projekt.

## Übersicht

Die CI/CD-Pipeline folgt dem in der [DevOps-Dokumentation](../../../project-management/docs/devops.md) definierten Schema mit den Stages:

1. **lint** - Statische Codeanalyse
2. **test** - Automatisierte Tests
3. **build** - Build-Prozess
4. **deploy** - Deployment (später auf HMKube)

## Verfügbare Pipelines

### 1. GitLab CI/CD (Primary)

Die Hauptpipeline ist in `.gitlab-ci.yml` definiert und wird auf GitLab-Infrastruktur ausgeführt.

**Trigger:**
- Automatisch bei Push auf Feature-Branches
- Bei Merge Requests auf `main`
- Auf dem Branch `main` (für Production)

**Jobs pro Stage:**

#### Stage: `lint`
- `frontend:lint` - ESLint für React/TypeScript
- `backend:lint` - ESLint für Express/TypeScript

#### Stage: `test`
- `frontend:test` - Vitest für React Components
- `backend:test` - Jest für API Layer (mit PostgreSQL Service)
- `security:scan` - npm audit für Dependencies

#### Stage: `build`
- `frontend:build` - Vite Build für SPA
- `backend:build` - TypeScript Compilation
- `docker:build:frontend` - Docker Image Build (nur auf `main`)
- `docker:build:backend` - Docker Image Build (nur auf `main`)

#### Stage: `deploy`
- `deploy:k8s:staging` - Deployment zu HMKube Staging (manuell)
- `deploy:k8s:production` - Deployment zu HMKube Production (manuell, nur `main`)

### 2. GitHub Actions (Alternative)

Als Alternative ist eine GitHub Actions Workflow in `.github/workflows/ci.yml` verfügbar.

**Trigger:** Push zu `main` oder Pull Requests gegen `main`

**Parallele Jobs:**
- Frontend: Lint → Test → Build
- Backend: Lint → Test → Build
- Security: npm audit

## Anforderungen & Setup

### Lokale Entwicklung

#### Installation der Dev-Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

#### Linting

```bash
# Frontend
npm run lint        # Check
npm run lint:fix    # Auto-fix

# Backend
npm run lint        # Check
npm run lint:fix    # Auto-fix
```

#### Tests

```bash
# Frontend
npm run test           # Run tests
npm run test:ui        # Interactive UI
npm run test:coverage  # Coverage Report

# Backend
npm run test           # Run tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage Report
```

#### Build

```bash
# Frontend
npm run build

# Backend
npm run build
```

### GitLab CI/CD Konfiguration

#### Prerequisites

1. **GitLab Runner** auf Linux-System
2. **Docker** für Container-Builds
3. **kubectl** für Kubernetes-Deployments
4. **Kubeconfig** als Secret im GitLab Project:
   - `KUBECONFIG_STAGING` (base64-encoded)
   - `KUBECONFIG_PRODUCTION` (base64-encoded)

#### Merge Request Protection

Diese Rules müssen in den GitLab Project Settings aktiviert sein:

```
Settings → Merge Requests → Merge Checks
```

- ✅ Require all discussions to be resolved before merging
- ✅ Dismiss approvals by default when the target branch changes
- ✅ Require approval from code owners
- ✅ All discussions must be resolved
- ✅ Pipeline must succeed
- ✅ Status checks must pass (if applicable)

#### Branch Protection

```
Settings → Repository → Protected Branches
```

- `main` Branch:
  - Allowed to push: Only maintainers
  - Allowed to merge: Only maintainers
  - Require status checks: Enabled

### Docker Registry Authentifizierung

Für die Docker-Builds muss der GitLab Container Registry konfiguriert sein:

```bash
# Login to GitLab Registry
docker login registry.gitlab.com
```

In GitLab CI/CD werden die Secrets automatisch bereitgestellt via:
- `$CI_REGISTRY`
- `$CI_REGISTRY_USER`
- `$CI_REGISTRY_PASSWORD`

## Umgebungsvariablen

### Backend Test-Umgebung

| Variable | Wert | Beschreibung |
|----------|------|---|
| `POSTGRES_DB` | `toolshare_test` | Test-Datenbank |
| `POSTGRES_USER` | `toolshare` | DB-Nutzer |
| `POSTGRES_PASSWORD` | `testpass` | DB-Password (nur Test!) |
| `DATABASE_URL` | `postgresql://...` | Connection String |
| `NODE_ENV` | `test` | Environment |

### Production Secrets (GitLab CI/CD)

Diese müssen in GitLab Project Settings unter `CI/CD → Variables` konfiguriert werden:

- `KUBECONFIG_STAGING` - Kubernetes Config für Staging
- `KUBECONFIG_PRODUCTION` - Kubernetes Config für Production
- `DATABASE_PASSWORD` - PostgreSQL Password
- `JWT_SECRET` - JWT Signing Secret
- `CORS_ORIGIN` - CORS Origin für Frontend

## Coverage Reports

Coverage Reports werden automatisch generiert:

**Frontend (Vitest):**
- Format: Cobertura XML
- Path: `frontend/coverage/cobertura-coverage.xml`
- HTML Report: `frontend/coverage/index.html`

**Backend (Jest):**
- Format: Cobertura XML
- Path: `backend/coverage/cobertura-coverage.xml`
- HTML Report: `backend/coverage/lcov-report/index.html`

Die Coverage Reports werden als Artifacts in der Pipeline gespeichert.

## Troubleshooting

### Pipeline schlägt bei Tests fehl

**Sympton:** Backend-Tests schlagen mit Datenbank-Fehlern fehl

**Lösung:**
```bash
# Sicherstellen, dass PostgreSQL läuft und richtig konfiguriert ist
cd backend
npm run test -- --verbose

# Oder mit Docker Compose:
docker-compose -f ../docker-compose.yml up -d postgres
npm run test
```

### Lint-Fehler beheben

```bash
# Automatisch fixen
npm run lint:fix

# Dann einmal prüfen
npm run lint
```

### Docker Build schlägt fehl

**Symptom:** `failed to solve with frontend dockerfile.v0`

**Lösung:**
```bash
# Sicherstellen, dass Docker Daemon läuft
docker ps

# BuildKit aktivieren (optional, empfohlen)
export DOCKER_BUILDKIT=1
docker build -f backend/Dockerfile backend/
```

## Best Practices

### Commits & Merge Requests

1. **Feature-Branch** als `<issue-id>-kurze-beschreibung` erstellen
2. **Lokal testen** vor dem Push:
   ```bash
   npm run lint:fix && npm run test
   ```
3. **Merge Request** erstellen mit Issue-Reference: `Closes #123`
4. **Warten** auf grüne CI-Pipeline
5. **Review** abholen
6. **Mergen** nur mit approval

### Iterative Entwicklung

```bash
# Watch mode für schnelle Feedback
npm run test:watch

# Dev server mit HMR
npm run dev
```

### Code Quality

- Streben nach **hoher Testabdeckung** für kritische Pfade
- **Regression Tests** für gefixte Bugs
- Regelmäßige **Security Audits**: `npm audit`

## Deployment-Workflow (Ausblick)

```
Feature Branch → Merge Request → CI Tests → Review → main
                                                      ↓
                                              Git Tag v1.0.0
                                                      ↓
                                         Docker Build (automated)
                                                      ↓
                                         Push zu Registry
                                                      ↓
                                         Manual: Deploy zu Staging
                                         Manual: Deploy zu Production
```

## Links

- 📄 [DevOps Dokumentation](../../../project-management/docs/devops.md)
- 📄 [Branching Strategie](../../../project-management/docs/branching-strategie.md)
- 🔧 [ADR-004: TypeScript](../../../project-management/docs/adr/004-sprache-typescript.md)
- 🔧 [ADR-001: React](../../../project-management/docs/adr/001-frontend-react.md)
- 🔧 [ADR-002: Express](../../../project-management/docs/adr/002-backend-express.md)
