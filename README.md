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
