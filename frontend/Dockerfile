# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_DATA_SOURCE is left unset: the real adapter through the server layer (S8).
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
WORKDIR /web
RUN useradd --system --uid 10001 --no-create-home web
COPY --from=build --chown=web /web/package.json /web/package-lock.json ./
COPY --from=build --chown=web /web/node_modules ./node_modules
COPY --from=build --chown=web /web/.next ./.next
COPY --from=build --chown=web /web/next.config.ts ./next.config.ts
USER 10001
EXPOSE 3000
CMD ["sh", "-c", "exec npx next start -p ${PORT}"]
