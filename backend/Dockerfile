# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# @toolshare/shared is file:../shared — lives at /shared next to /app.
COPY backend/package*.json ./
COPY shared/package*.json /shared/
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY shared /shared
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefix /shared --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts

# prisma generate runs as root; dev runs as node (see below).
RUN chown -R node:node /app /shared

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

COPY backend/package*.json ./
COPY shared/package*.json /shared/
RUN npm ci --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY shared /shared
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefix /shared --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN npx prisma generate && chown -R node:node /app /shared

EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
