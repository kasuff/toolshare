# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Alle Installs laufen als unprivilegierter `node`-User, damit node_modules
# von Anfang an node gehoert. Das erspart am Ende ein `chown -R node:node`
# ueber node_modules -- auf overlayfs erzwingt jeder chown ein copy-up des
# gesamten Baums (>60s und doppelt so grosses Image).
RUN mkdir -p /shared && chown node:node /app /shared
USER node

# @toolshare/shared is file:../shared — lives at /shared next to /app.
COPY --chown=node:node backend/package*.json ./
COPY --chown=node:node shared/package*.json /shared/
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY --chown=node:node shared /shared
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm install --prefix /shared --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 \
    && npm run build --prefix /shared
COPY --chown=node:node backend/prisma ./prisma
RUN npx prisma generate

COPY --chown=node:node backend/tsconfig.json ./
COPY --chown=node:node backend/src ./src
COPY --chown=node:node backend/scripts ./scripts

FROM base AS dev
ENV NODE_ENV=development
EXPOSE 4000
USER node
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm run build

FROM node:20-bookworm-slim AS prod
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /shared && chown node:node /app /shared
USER node

COPY --chown=node:node backend/package*.json ./
COPY --chown=node:node shared/package*.json /shared/
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY --from=build --chown=node:node /shared /shared
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts ./scripts
RUN npx prisma generate

EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
