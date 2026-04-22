FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

FROM base AS dev
ENV NODE_ENV=development
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm run build

FROM node:20-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN npx prisma generate

EXPOSE 4000
CMD ["node", "dist/index.js"]
