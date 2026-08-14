# ScormCreator operations runbook

## Stack (Phương án 1 — one VPS)

- `nginx` → `web` (Next.js)
- `worker` (LibreOffice convert + TTS + SCORM export)
- `redis` (BullMQ)
- `postgres` (app document store when `DATABASE_URL` set)
- `minio` (S3 object storage mirror)

Shared volume `app_data` is mounted at `/data` on web and worker (`DATA_DIR`).

## Deploy

```bash
cp .env.example .env   # set AUTH_SECRET, passwords, keys
docker compose up -d --build
```

Health checks:

- App: `http://<host>/`
- Admin metrics: `GET /api/admin/metrics` (admin session)
- MinIO console: `:9001`

## Backpressure / PPTX load

- Upload enqueues convert; web does **not** run LibreOffice.
- `CONVERT_CONCURRENCY` (default 2) limits parallel soffice jobs.
- `CONVERT_QUEUE_MAX` (default 50) → HTTP 429 when queue is full.
- Users see project `status: processing` until worker finishes.

## LibreOffice zombie / hung convert

1. Check worker logs: `docker compose logs -f worker`
2. Restart worker only (web stays up): `docker compose restart worker`
3. Stuck projects remain `processing` — set `error` via re-upload/rerender or fix meta manually under `/data/projects/<id>/meta.json`
4. Kill leftover soffice inside worker if needed: `docker compose exec worker pkill -9 soffice || true` then restart worker

## Drain before deploy

```bash
# Watch convert queue via admin metrics until waiting+active ≈ 0
docker compose up -d --build web worker
```

Prefer restarting `web` first, then `worker`, so in-flight converts finish or fail cleanly.

## Retention

```bash
docker compose exec worker npx tsx scripts/retention.ts
```

Env: `EXPORT_RETENTION_DAYS`, `GUEST_PROJECT_RETENTION_DAYS`.

## Backup

- Postgres volume `postgres_data` — `pg_dump` or volume snapshot
- MinIO volume `minio_data` — bucket sync / snapshot
- Shared `app_data` — project files + SQLite fallback if unused

## Scale later

1. Move `worker` to a second host with same `REDIS_URL` / `DATABASE_URL` / `DATA_DIR` or S3.
2. Increase `CONVERT_CONCURRENCY` only if RAM allows (~6–8 GB per concurrent LO job).
3. Add more `web` replicas behind nginx/load balancer (requires Postgres + shared storage).

