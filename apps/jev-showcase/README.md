# Jev Showcase

A single-port React and Vite app served by a small Node HTTP server. Mock mode is the default. The server reports `live` only when `JEV_MODE=live` and `TYPESAFE_API_KEY` is present at runtime; the key is never sent to the client.

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @sandi/jev-showcase dev
```

Build and run in Docker from the repository root:

```sh
docker build -f apps/jev-showcase/Dockerfile -t jev-showcase .
docker run --rm -p 3000:3000 jev-showcase
```

Open `http://localhost:3000`. The health endpoint is `GET /healthz` on port 3000. Set `JEV_MODE=live` and provide `TYPESAFE_API_KEY` as runtime environment variables to enable the live badge; never pass the key during build.
