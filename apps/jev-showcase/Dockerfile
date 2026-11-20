FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @sandi/jev-showcase...
RUN pnpm --filter @sandi/jev build
RUN pnpm --filter @sandi/jev-showcase build
RUN pnpm --filter @sandi/jev-showcase deploy --prod /runtime
RUN cp -R apps/jev-showcase/dist /runtime/dist \
    && cd /runtime \
    && JEV_MODE=mock node --input-type=module -e "await import('./dist/server/server.js')"

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000 JEV_MODE=mock
WORKDIR /app
COPY --from=build --chown=node:node /runtime ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q --spider http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/server/server.js"]
