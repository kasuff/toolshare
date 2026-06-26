# syntax=docker/dockerfile:1
FROM node:20.19-bookworm-slim AS dev
WORKDIR /app

# Alles als non-root "node" (uid 1000) ausführen: /app dem User übergeben und
# dann USER wechseln. So sind node_modules (npm ci) und Quelltext direkt
# node-owned – Vite kann seine Temp-Config (vite.config.ts.timestamp-*.mjs) und
# den .vite-Optimizer-Cache schreiben, OHNE dass wir hinterher ein teures
# "chown -R /app" brauchen (das sonst ~470 MB node_modules in eine neue Layer
# kopiert und bei jedem Code-Rebuild erneut läuft).
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node frontend/package*.json ./frontend/
COPY --chown=node:node shared/package*.json ./shared/
# Cache-Mount für ~/.npm → heruntergeladene Pakete werden über Builds hinweg
# wiederverwendet, falls sich package-lock.json ändert.
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY --chown=node:node . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=frontend", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM node:20.19-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_GRAFANA_URL=/grafana
ENV VITE_GRAFANA_URL=$VITE_GRAFANA_URL
RUN npm run build --workspace=frontend

FROM nginx:1.27-alpine AS prod
COPY ./frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
