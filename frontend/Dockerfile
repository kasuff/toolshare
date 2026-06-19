FROM node:20-bookworm-slim AS dev
WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=frontend", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/
RUN npm ci

COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_GRAFANA_URL=/grafana
ENV VITE_GRAFANA_URL=$VITE_GRAFANA_URL
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY ./frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
