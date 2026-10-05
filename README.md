# Financials

## Local Supabase stack

The `supabase/` folder holds the local stack (project id `financials`, ports 55320-55329, so it does not clash with other local Supabase projects). Docker must be running.

```sh
pnpm -C api db:start    # start Postgres, Auth and Storage (first run pulls images)
pnpm -C api db:status   # print URLs and keys (npx supabase status -o env)
pnpm -C api db:reset    # recreate the database and re-apply migrations
pnpm -C api db:stop     # stop the stack
```

Sign-up confirmation e-mails land in Inbucket at http://127.0.0.1:55324.
Integration tests (`pnpm -C api test:int`) read the real URLs and keys from `npx supabase status -o env`.

## Running the API

Startup order for local development: the Supabase stack, then the API, then the front.

```sh
pnpm -C api db:start                 # 1. Postgres + Auth (Docker)
cp api/.env.example api/.env         # 2. once; values match the local stack
pnpm -C api dev                      #    API on http://127.0.0.1:3001 (reloads on change)
yarn --cwd web dev                   # 3. front (see web/.env.local below)
```

`api/.env` variables (see `api/.env.example`):

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `SUPABASE_URL` | required | Supabase project URL; tokens are verified against its JWKS |
| `DATABASE_URL` | required | Postgres role allowed to `set role authenticated` |
| `SUPABASE_JWT_SECRET` | none | Legacy HS256 secret; when set it replaces the JWKS |
| `PORT` / `HOST` | `3001` / `127.0.0.1` | Where the API listens |
| `CORS_ORIGINS` | none | Exact browser origins allowed, comma separated, no `*`; empty allows none |
| `LOG_LEVEL` | `info` | pino level; request logs never contain the `Authorization` header |

Production style run: `pnpm -C api build && pnpm -C api start` (compiles to `api/dist`).
`GET /docs` serves the OpenAPI UI and `GET /health` the liveness check; both are public.
