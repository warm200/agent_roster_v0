---
summary: Ops runbook for scheduling runtime maintenance, including local loop, remote trigger, and Vercel cron guidance.
read_when:
  - Wiring runtime maintenance into hosting or cron.
  - Deciding how often stale runtime reconciliation should run in production.
---

# Runtime Maintenance Ops

## Purpose

Runtime maintenance applies pull-based lifecycle enforcement without Daytona webhooks.

It is responsible for:

- stale runtime reconciliation
- provisioning timeout enforcement
- max session TTL enforcement
- idle timeout enforcement when meaningful activity timestamps exist
- plan-aware follow-up actions like:
  - deleting stopped ephemeral runtimes
  - archiving stopped recoverable runtimes after threshold

## Available execution modes

### Local / long-running worker

Run:

```bash
pnpm runtime:maintenance:watch
```

This loops forever and runs one maintenance batch every `RUNTIME_MAINTENANCE_INTERVAL_SECONDS`.

Use when:

- running a dedicated worker process
- using systemd / pm2 / Docker / supervisor
- you want continuous cleanup without relying on platform cron

### One-shot local batch

Run:

```bash
pnpm runtime:maintenance
```

Optional flags:

```bash
pnpm runtime:maintenance --limit 50 --stale-minutes 10
```

Use when:

- debugging cleanup behavior
- manual ops reconciliation
- ad hoc repair

### Remote hosted trigger

Run:

```bash
pnpm runtime:maintenance:trigger
```

Optional flags:

```bash
pnpm runtime:maintenance:trigger --base-url https://your-app.example.com --limit 50 --stale-minutes 10
```

This calls:

- `GET /api/internal/runtime-maintenance/reconcile` or
- `POST /api/internal/runtime-maintenance/reconcile`

with bearer auth from:

- `INTERNAL_API_TOKEN`, or
- `CRON_SECRET`

Use when:

- your hosting platform provides cron
- you do not want a separate long-running worker

## Environment

Required for remote trigger or hosted cron auth:

- `INTERNAL_API_TOKEN` and/or `CRON_SECRET`

Useful config:

- `RUN_PROVIDER`
- `RUNTIME_MAINTENANCE_BATCH_SIZE`
- `RUNTIME_MAINTENANCE_STALE_MINUTES`
- `RUNTIME_MAINTENANCE_INTERVAL_SECONDS`
- `RUNTIME_MAINTENANCE_BASE_URL`
- `RUNTIME_MAINTENANCE_HTTP_TIMEOUT_SECONDS`

Important:

- maintenance must resolve the same real runtime provider as the app server
- for Daytona, set `RUN_PROVIDER=daytona`
- do not rely on unresolved `op://...` secrets plus implicit provider fallback, because that can silently resolve maintenance to the mock provider

## Vercel cron guidance

This app now supports Vercel-compatible cron invocation because:

- Vercel cron uses `GET`
- Vercel can send `Authorization: Bearer <CRON_SECRET>`

Relevant docs:

- https://vercel.com/docs/cron-jobs
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/cron-jobs/usage-and-pricing

Important operational caveat:

- Vercel Hobby only supports once-per-day cron execution
- per-minute or near-real-time cleanup needs Vercel Pro or another scheduler/worker

Because plan availability differs by hosting tier, this repo does **not** ship a default `vercel.json` cron schedule.

If you deploy on Vercel Pro, a typical config would look like:

```json
{
  "crons": [
    {
      "path": "/api/internal/runtime-maintenance/reconcile?limit=50&staleMinutes=5",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

If you use this path:

1. set `CRON_SECRET` in Vercel
2. confirm the route is reachable in production
3. verify maintenance batches are small enough for function duration limits

## Recommended starting policy

### Dev / local

- use `pnpm runtime:maintenance:watch`
- interval: `60s`
- in Docker dev override mode, `maintenance` can run via:
  - `pnpm exec tsx watch scripts/runtime-maintenance.ts --watch`

### Production with worker support

- use `pnpm runtime:maintenance:watch`
- interval: `60s` to `300s`
- in Docker Compose, run it as a separate long-lived `maintenance` service, not inside the web container
- Docker Compose startup now lets `app` wait for Postgres, run `pnpm db:migrate`, then start the web server
- the migration step is idempotent, so it no-ops when the schema is already current
- `maintenance` waits for `app` startup instead of a separate migration container
- nginx now supports optional TLS termination on `443`
- mount certs at `docker/nginx/certs/tls.crt` and `docker/nginx/certs/tls.key`
- with certs present, nginx redirects `80 -> 443`; without them, it falls back to plain HTTP on `80`
- normal deploy is now:
  - `docker compose up -d --build`
- if you ever need a manual schema rerun inside the app image, use:
  - `docker compose run --rm app /app/docker/entrypoints/start-with-migrations.sh true`

### Production on Vercel Pro without separate workers

- use cron + `CRON_SECRET`
- start with every `5` minutes

### Production on Vercel Hobby

- cron is too infrequent for meaningful runtime TTL enforcement
- use an external scheduler or a separate worker instead

## What this still does not solve

- no Daytona webhook ingestion
- no Daytona audit-log reconciliation
- no volume lifecycle management
- idle cleanup still depends on maintenance cadence
- Daytona/OpenClaw idle now prefers direct session activity from `~/.openclaw/agents/*/sessions/sessions.json`
- provider reconcile timestamps are intentionally excluded from the meaningful activity clock
