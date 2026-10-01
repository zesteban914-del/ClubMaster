# AGENTS.md

ClubMaster = POS + inventory + finance system for nightclubs/bars. Node 22 + Express 4 (CommonJS) backend, vanilla HTML/CSS/JS (Bootstrap 5 CDN) frontend served statically by Express, MySQL via raw SQL. All code comments, DB schemas, API keys, and UI text are Spanish; keep that convention. Git repo on `origin/main`, but `git` is NOT on PATH — use `C:\Program Files\Git\bin\git.exe`.

## Commands (from repo root)

- `npm start` / `npm run dev` — both just run `node Backend/server.js`; listens on `process.env.PORT` (default 3000 only in development; Railway injects PORT).
- `npm run migrate` — idempotent code-first schema (`migrate.js`: CREATE TABLE IF NOT EXISTS + ALTER). Safe to re-run. Aborts if the DB host is `*.railway.internal` outside Railway ("usa MYSQL_PUBLIC_URL").
- `npm run setup` — migrate + seed (demo roles/users, catalogs; all seed users password `1234`). REFUSES to run if `NODE_ENV=production` or host is not localhost/127.0.0.1 (use `setup:fresh` instead).
- `npm run setup:fresh` — re-provision a NEW install: migrate, wipe all transactional tables, create only the admin from REQUIRED `ADMIN_EMAIL`/`ADMIN_TEMP_PASSWORD` (>=12 chars, bcrypt like login, never printed; no defaults). DESTRUCTIVE — never run against a client with data.
- `npm run clean:dupes` — dedupes `zonas`/`unidades_medida`; MUST run before `migrate` can add their UNIQUE indexes (ALTER fails on duplicates).
- `npm run seed:*`, `seed:reset`/`clean` (= `cleanData.js`), `fix:admin`, `fix-stock-negativo.js` (zeroes negative stock) — one-off maintenance.
- PM2: `pm2 start ecosystem.config.js` (fork, 1 instance); PaaS uses `Procfile`.

## Environment & config gotchas

- Env loaded from `Backend/.env` first, then root `.env` (both via `Backend/config/env.js`); dotenv does not override, so `Backend/.env` wins. `.env.example` exists in both places.
- DB connection is centralized in `Backend/config/env.js`: order `DATABASE_URL` -> `MYSQL_URL` -> `DB_*`/`MYSQL*` (Railway MySQL exposes `MYSQL_URL`, `MYSQL_PUBLIC_URL`, `MYSQLHOST`… — it does NOT create `DATABASE_URL`). No config at all = fatal Spanish error; passwords are never logged.
- Production startup hard-exits if `SESSION_SECRET` or `JWT_SECRET` is missing/<32 chars/example, if no DB config exists, if `CORS_ORIGINS` is empty or contains `*`, or if `PORT` is missing (dev default only). Dev mode allows any origin. `/health` returns `200 {"ok":true}` without touching the DB.
- npm scripts `migrate:prod`/`setup:prod` use bash `NODE_ENV=... node` syntax — broken on Windows. Set `$env:NODE_ENV="production"` first.
- Sessions: cookie `clubmaster.sid`, MySQL-backed store (auto-creates `sessions` table), 8h TTL, Secure only in production (needs HTTPS). Login rate limit: 5 failed attempts/IP -> 15 min lockout (easy to hit while testing).

## Architecture

- `Backend/server.js` is the entrypoint (auth/CORS/helmet, prod guards, static frontend). Routes are wired in `routes/index.js`, which has an explicit file list — a new `Backend/routes/*.js` is NOT loaded until added there.
- `Backend/config/database.js` builds REAL + DEMO MySQL pools. `X-Demo: 1`, `?demo=1`, or `DEMO_MODE=true` transparently routes ALL queries to the demo DB via AsyncLocalStorage proxy.
- `Backend/database.js` (note: file, not dirs) is a facade re-exporting service functions; real business logic lives in `Backend/services/*`. Read it to find where a domain's functions live.
- Services/scripts must import the `pool` proxy from `../config/database` — never `mysql2` directly — or demo mode silently breaks.
- `productos` price/cost column names vary per install (`precio` vs `precio_venta`, `precio_costo` vs `costo`). Use `Backend/helpers/column-detection.js`; never hardcode those column names.
- RBAC is nonstandard: admin is BLOCKED from operating the cash register (`soloCajaOperativa`); only mesero role can create orders (`can_create_orders`); meseros can't cancel orders without master PIN. Assumptions live in `middlewares/authMiddleware.js` + migrate's permission seeding.
- Audit is append-only by design: `scripts/apply-audit-append-only.js` REVOKEs UPDATE/DELETE on `audit_logs` from the app DB user (needs `DB_ADMIN_USER`/`DB_ADMIN_PASSWORD`). Any new write logic to those tables fails with ERROR 1142 — `tipo_evento` is a fixed ENUM extended in migrate.js, not a free-text column.
- Auto-backup `services/backup.js` runs mysqldump daily 4 AM into root `backups/` (gitignored) with 7-day retention; needs mysqldump on PATH or `MYSQLDUMP_PATH`.
- Frontend pages are static HTML screens (`Frontend/login.html`, `dashboard.html`, `mesas.html`, `comandero.html`, `kds.html`...), shared JS in `Frontend/js/*`, no build step. `window.API_BASE` (config.js) overrides API origin; empty = same origin.
- `docs/` holds the Spanish product analysis (modulo-1..3: visión, requerimientos, casos de uso) if you need business context for a feature.

## Testing (NO test framework — `npm test` is a stub)

Ad-hoc suites at repo root hit a LIVE server (start it first) and require `Backend/.env` DB access + seeded users:

- `node test_seguridad_fallos.js --setup` then `node test_seguridad_fallos.js` then `--cleanup` (creates/removes `chaos_mesero`; asserts RBAC + validation guards).
- `node test_estres.js --setup` then `node test_estres.js` then `--cleanup` (pool/concurrency; requires an OPEN jornada and free mesas).
- `node test_reportes_suite.js [BASE_URL]`.

All three hardcode the absolute project path (`C:\Users\juan esteban\OneDrive\Desktop\ClubMaster\...`) internally — they break if that checkout moves. API responses mix `{success,...}` and auth's `{exito,...}` shapes; echo both when asserting.