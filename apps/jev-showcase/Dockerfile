FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @sandi/jev-showcase...
RUN pnpm --filter @sandi/jev-showcase build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/jev-showcase/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q --spider http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/server/server.js"]
