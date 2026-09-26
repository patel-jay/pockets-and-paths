# Deployment and backups

The repository defines two Cloudflare Worker environments:

- `demo` keeps the browser-isolated sample login available and disables account registration.
- `private` disables the demo login and expects the owner’s personal account secrets.

Each environment must use a different D1 database. Replace the placeholder database IDs in
`wrangler.jsonc` after creating `pockets-and-paths-demo` and `pockets-and-paths-private` in
Cloudflare.

Cloudflare’s free plan can host this two-environment setup: Wrangler environments deploy as
separate Workers, and the free D1 allowance includes multiple databases. Both deployments still
share the account’s free request, storage, and database-operation limits.

## First private deployment

1. Put real Turnstile keys, a long random `AUTH_PEPPER`, and a private
   `REGISTRATION_INVITE_CODE` into Worker secrets. Do not commit them.
2. Temporarily set `REGISTRATION_ENABLED` to `true` for the private environment.
3. Run `npm run db:migrate:private`, then `npm run deploy:private`.
4. Register the owner account once.
5. Set `REGISTRATION_ENABLED` back to `false` and deploy again. Normal sign-in remains available,
   but the registration route and link are closed.

The demo and private environments can be deployed independently with `npm run deploy:demo` and
`npm run deploy:private`.

## Backups

The Settings page provides two portable downloads:

- CSV contains the expense ledger for spreadsheet use.
- JSON contains the profile, budgets, categories, and expenses.

For a restorable database backup, export D1 before a deployment or schema change:

```powershell
npx wrangler d1 export pockets-and-paths-private --remote --env private --output backups/pockets-and-paths-private.sql
```

Keep that SQL file outside the repository or in encrypted storage because it contains personal
financial data. Cloudflare D1 Time Travel is an additional short recovery window; it is not a
replacement for downloads you control.
