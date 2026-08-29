# Neon + Docker: Dev/Prod Setup

This project shows how to run the same app in two modes:

- **Development** — connects to a **Neon Local** proxy running in Docker, which
  forks a fresh, ephemeral Neon branch on every startup and deletes it on shutdown.
- **Production** — connects directly to your real **Neon Cloud** database over TLS.
  No proxy container involved.

One `Dockerfile`, one codebase, two Compose files. Only environment variables change.

```
neon-docker-app/
├── Dockerfile
├── .dockerignore
├── .gitignore
├── docker-compose.dev.yml     # app + neon-local proxy
├── docker-compose.prod.yml    # app only, talks to Neon Cloud
├── .env.development           # dev secrets (Neon Local / API key)
├── .env.production            # prod secrets (Neon Cloud URL) — template only
├── .env.example                # safe-to-commit template
├── package.json
└── src/
    └── server.js               # sample Express app (health + db-check routes)
```

## How the switch works

The app reads exactly one variable: `DATABASE_URL`. Nothing else in the code
changes between environments.

| | Development | Production |
|---|---|---|
| Compose file | `docker-compose.dev.yml` | `docker-compose.prod.yml` |
| DB target | `neon-local` container (proxy) | Real Neon Cloud endpoint |
| `DATABASE_URL` | `postgres://neon:npg@neon-local:5432/neondb?sslmode=no-verify` | `postgres://user:pass@ep-xxx.aws.neon.tech/db?sslmode=require` |
| Branch lifecycle | New ephemeral branch created on `up`, deleted on `down` | Your permanent production branch |
| TLS | Terminated locally by Neon Local (no-verify) | Required, real TLS to Neon Cloud |
| Secrets needed | `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID` | `DATABASE_URL` only |

The `postgres://neon:npg@neon-local:5432/...` connection string is a **fixed
convention**, not something you generate per branch — Neon Local always
accepts that static user/password and silently routes the connection to
whichever ephemeral branch it just created. That's the whole trick: your app
config never has to change when the underlying branch changes.

## Prerequisites

- Docker and Docker Compose v2
- A [Neon account](https://console.neon.tech) and project
- A Neon API key: Console → **Account Settings → API Keys**
- Your Neon **Project ID** and the **Branch ID** you want ephemeral dev
  branches forked from (usually your main branch): Console → project →
  **Settings → General**

## Development workflow (Neon Local)

1. Copy the template and fill in your Neon credentials:

   ```bash
   cp .env.example .env.development
   ```

   Edit `.env.development`:

   ```env
   NEON_API_KEY=neon_api_xxxxxxxx
   NEON_PROJECT_ID=your-project-id
   PARENT_BRANCH_ID=br-xxxxxxxx
   DB_NAME=neondb
   ```

2. Start everything:

   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

   This will:
   - Pull and start `neondatabase/neon_local`, which authenticates with
     `NEON_API_KEY`, forks a new ephemeral branch off `PARENT_BRANCH_ID`,
     and starts listening on `localhost:5432`.
   - Build and start your app, which connects to that proxy at
     `postgres://neon:npg@neon-local:5432/neondb?sslmode=no-verify`.
   - Mount `./src` into the container and run `node --watch`, so code
     changes reload automatically without rebuilding the image.

3. Verify it's working:

   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/db-check
   ```

   `/db-check` runs `SELECT NOW()` against the real ephemeral Neon branch
   through the proxy and returns the result — confirming the whole chain
   (app → neon-local → Neon Cloud) is live.

4. Stop everything:

   ```bash
   docker compose -f docker-compose.dev.yml down
   ```

   The ephemeral branch created in step 2 is automatically deleted by
   Neon Local when its container stops — nothing to clean up manually in
   the Neon Console.

**Connecting to an existing branch instead of an ephemeral one:** if you'd
rather point at a specific, persistent branch (e.g. a shared `staging`
branch) instead of forking a new one each time, swap `PARENT_BRANCH_ID` for
`BRANCH_ID` in both `.env.development` and `docker-compose.dev.yml`.

## Production workflow (Neon Cloud)

1. Get your production connection string from the Neon Console:
   project → **Connection Details** → copy the **pooled** connection string
   (recommended for most app workloads). It looks like:

   ```
   postgres://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

2. Put it in `.env.production` — **for local testing only**:

   ```bash
   cp .env.example .env.production
   # then edit DATABASE_URL and NODE_ENV=production
   ```

3. Build and run:

   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

   No proxy container is started — the app connects straight to Neon Cloud
   over TLS.

4. Verify:

   ```bash
   curl http://localhost:3000/db-check
   ```

### Production secrets — don't commit real values

`.env.production` in this repo is a **template with placeholders**. In an
actual deployment, don't ship a real `.env.production` file at all — inject
`DATABASE_URL` at deploy time instead:

- **Docker Compose on a server / CI runner:** generate `.env.production` from
  your secret store just before `docker compose up`, and keep it out of git
  (`.gitignore` already covers this).
- **Kubernetes:** mount `DATABASE_URL` from a `Secret` as an env var on the
  container spec.
- **ECS / Cloud Run / Fly.io / Render / Railway:** use the platform's
  built-in secrets/environment variable UI or CLI — never bake the value
  into the image or Dockerfile.
- **GitHub Actions / GitLab CI:** store `DATABASE_URL` as an encrypted
  pipeline secret and pass it through `env:` at deploy time.

The image itself (`docker build`) never contains a database credential —
`DATABASE_URL` is only ever supplied at container-run time via `env_file` or
`environment`, so the same image is safe to push to a registry.

## Sample app routes

| Route | Purpose |
|---|---|
| `GET /` | Basic liveness message + current `NODE_ENV` |
| `GET /health` | Process-level health check (no DB dependency) — used by the Dockerfile `HEALTHCHECK` |
| `GET /db-check` | Round-trips a query to Postgres; proves the app is actually talking to the DB (Neon Local in dev, Neon Cloud in prod) |

## Common commands

```bash
# Dev: start with logs attached, rebuild on Dockerfile changes
docker compose -f docker-compose.dev.yml up --build

# Dev: stop and tear down (also deletes the ephemeral Neon branch)
docker compose -f docker-compose.dev.yml down

# Prod: start detached
docker compose -f docker-compose.prod.yml up --build -d

# Prod: view logs
docker compose -f docker-compose.prod.yml logs -f app

# Prod: stop
docker compose -f docker-compose.prod.yml down
```

## Why this design

- **Single Dockerfile:** the image is identical in dev and prod. Only
  environment variables (injected via Compose `env_file`/`environment`)
  change behavior. This avoids "works in dev, breaks in prod" drift caused
  by divergent images.
- **No secrets in the image or in code:** `DATABASE_URL`, `NEON_API_KEY`,
  etc. are never hardcoded — they're supplied at container-run time.
- **Ephemeral branches for dev/test:** every dev session (or CI run) gets an
  isolated copy of the schema/data forked from a known parent branch, and
  cleans itself up automatically — no shared, mutable "the dev DB" to
  accidentally corrupt.
- **Prod has zero extra moving parts:** no proxy container, no Neon API key
  needed at runtime — just a standard Postgres connection string over TLS,
  which also makes it trivial to swap in any other Postgres-compatible
  host if you ever needed to.
