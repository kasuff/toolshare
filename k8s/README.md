# Kubernetes Deployment (No-Budget Setup)

Dieses Verzeichnis enthält ein self-hosted Kubernetes-Setup für ToolShare ohne managed Datenbank.

## Inhalt

- `namespace.yaml`: Namespace `toolshare`
- `secrets.template.yaml`: Vorlage für sensible Werte
- `postgres.yaml`: PostgreSQL + Service + PVC
- `postgres-backup.yaml`: Backup-PVC + CronJob (`pg_dump` alle 6h)
- `backend.yaml`: Backend Deployment/Service mit Probes und Resource Limits
- `frontend.yaml`: Frontend Deployment/Service mit Probes und Resource Limits
- `ingress.yaml`: Ingress-Routing für `/` und `/api`
- `prisma-migrate-job.yaml`: Einmaliger Job für `prisma migrate deploy`

## Ablauf

1. Secrets anpassen:
   - `secrets.template.yaml` kopieren/anpassen
   - sichere Werte für `POSTGRES_PASSWORD`, `JWT_SECRET`, `DATABASE_URL` setzen
2. Images bauen und in Registry pushen:
   - `registry.example.com/toolshare/backend:<tag>`
   - `registry.example.com/toolshare/frontend:<tag>`
3. Image-Tags in `backend.yaml` und `frontend.yaml` eintragen.
4. Basis-Ressourcen deployen:
   - `kubectl apply -f k8s/namespace.yaml`
   - `kubectl apply -f k8s/secrets.template.yaml`
   - `kubectl apply -f k8s/postgres.yaml`
5. Migrationen ausführen:
   - `kubectl apply -f k8s/prisma-migrate-job.yaml`
6. App deployen:
   - `kubectl apply -f k8s/backend.yaml`
   - `kubectl apply -f k8s/frontend.yaml`
   - `kubectl apply -f k8s/ingress.yaml`
   - `kubectl apply -f k8s/postgres-backup.yaml`
