FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build

FROM node:22-bookworm-slim AS runtime

RUN npm install --global wrangler@4.92.0
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY wrangler.docker.jsonc docker-entrypoint.sh ./
RUN chmod 0755 docker-entrypoint.sh

EXPOSE 80
VOLUME ["/data"]
ENTRYPOINT ["./docker-entrypoint.sh"]
