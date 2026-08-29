# Architecture

## Shape of the application

Pockets & Paths is a client-rendered React Router application served by the same Cloudflare Worker that owns the GraphQL endpoint. This keeps the public demo operationally small while still showing a clear frontend/API/data boundary.

The React client does not import server modules. It communicates only through typed GraphQL operations in `src/lib/graphql.ts`. TanStack Query owns request caching and invalidation after mutations.

The Worker creates a browser-specific UUID after the published dummy credentials are accepted. HTTP-only, same-site cookies retain the isolated viewer and its short-lived demo-authenticated state. Logout clears the authenticated state without deleting the sandbox; reset deletes and reseeds only that viewer’s records. Every GraphQL query and mutation scopes its SQL by that viewer ID. D1 queries use prepared statements, and foreign keys enforce budget/category relationships.

## Domain model

- A profile defines display name, locale, and the currency used for combined totals.
- A budget is either `MONTHLY` or `TEMPORARY` and owns a reporting currency.
- A temporary budget requires start and end dates; a monthly budget remains independent of temporary plans.
- A category belongs to exactly one budget and may carry an allocation limit.
- An expense belongs to exactly one budget and one of that budget’s categories.
- An expense stores original minor units, original currency, integer exchange-rate micros, and converted minor units.

## Important boundaries

### Money

Amounts cross GraphQL as strings because JavaScript numbers cannot safely represent every integer. Parsing and conversion use `BigInt` at the boundary; D1 receives only safe integers. This avoids familiar `0.1 + 0.2` accounting errors.

### Exchange rates

The demo rate table is deliberately isolated in `worker/money.ts`. A live provider can later write timestamped rates without changing expense history. Historical expenses retain the applied rate and converted result.

### Spending position

An expense can exceed a category or overall budget because the ledger represents money that was actually spent. A server-side preview calculates the converted amount and projected category/budget position before insertion. The client warns without blocking. Percentages remain uncapped, while remaining and overspent values are modeled separately.

Categories without limits have no progress, remaining, or overspent values. They still contribute to overall budget spending. Category limits may under- or over-allocate the overall budget; both states are reported rather than rejected.

### Storage

The database functions in `worker/database.ts` are framework-independent. Moving to PostgreSQL would replace this adapter and migrations while leaving the GraphQL schema and client operations largely unchanged.

Migration `0002` adds the nullable category-limit representation alongside the original required column. This additive approach preserves existing rows and avoids rebuilding a table referenced by historical expenses. New writes keep the compatibility column synchronized while all product reads use the optional value.

## Production evolution

The next production steps would be external identity, rate limiting and account recovery, rate-provider ingestion with timestamps, pagination, structured observability, and background synchronization for queued offline expenses.
