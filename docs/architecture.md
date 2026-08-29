# Architecture

## Shape of the application

Pockets & Paths is a client-rendered React Router application served by the same Cloudflare Worker that owns the GraphQL endpoint. This keeps the public demo operationally small while still showing a clear frontend/API/data boundary.

The React client does not import server modules. It communicates only through typed GraphQL operations in `src/lib/graphql/`. Each operation carries its result and variable types, while reusable fragments keep budget, category, expense, and money selections consistent. TanStack Query owns request caching and invalidation after mutations.

The Worker creates a browser-specific UUID after the published dummy credentials are accepted. HTTP-only, same-site cookies retain the isolated viewer and its short-lived demo-authenticated state. Logout clears the authenticated state without deleting the sandbox; reset deletes and reseeds only that viewer’s records. Every GraphQL query and mutation scopes its SQL by that viewer ID. D1 queries use prepared statements, and foreign keys enforce budget/category relationships.

## Domain model

- A profile defines display name, locale, and the default currency for new budgets.
- A budget is either `MONTHLY` or `TEMPORARY` and owns one currency.
- A temporary budget requires start and end dates; a monthly budget remains independent of temporary plans.
- A category belongs to exactly one budget and may carry an allocation limit.
- An expense belongs to exactly one budget and one of that budget’s categories.
- An expense stores integer minor units in its parent budget’s currency.

## Important boundaries

### Money

Amounts cross GraphQL as strings because JavaScript numbers cannot safely represent every integer. Parsing uses `BigInt` at the boundary; D1 receives only safe integers. This avoids familiar `0.1 + 0.2` accounting errors.

### Currency boundaries

Currency belongs to the budget, not the individual expense. The expense input deliberately has no currency or rate fields, and the Worker derives currency from the selected budget. Dashboard summaries group matching currencies and never imply that unrelated balances can be added directly.

### Spending position

An expense can exceed a category or overall budget because the ledger represents money that was actually spent. A server-side preview calculates the projected category/budget position before insertion. The client warns without blocking. Percentages remain uncapped, while remaining and overspent values are modeled separately.

Categories without limits have no progress, remaining, or overspent values. They still contribute to overall budget spending. Category limits may under- or over-allocate the overall budget; both states are reported rather than rejected.

### Storage

Database access is divided by domain under `worker/data/`: profiles, budgets, categories, expenses, summaries, validation, and demo seeding. GraphQL type definitions, mapping, and resolvers live separately under `worker/graphql/`. Moving to PostgreSQL would replace the data modules and migrations while leaving the client operations and most resolver behavior unchanged.

Checked-in SQL migrations are the schema source of truth. Local development applies pending migrations before Vite starts; the Worker does not duplicate schema creation during request handling.

Migration `0002` adds the nullable category-limit representation alongside the original required column. This additive approach preserves existing rows and avoids rebuilding a table referenced by historical expenses. New writes keep the compatibility column synchronized while all product reads use the optional value.

Migration `0003` enforces the one-currency-per-budget invariant for new and updated expenses. Earlier conversion columns remain only as additive-schema compatibility fields; current writes mirror the budget amount with a neutral rate, while GraphQL exposes one expense amount and no rate controls.

### Testing

Vitest covers deterministic domain calculations and relative seed timelines. Playwright API tests run against the real local Worker and D1 database to exercise authentication boundaries, viewer-scoped queries, ownership checks, GraphQL mutations, and overspending. A separate browser test covers the main portfolio journey without letting Playwright collect the unit-test files.

## Production evolution

The next production steps would be external identity, rate limiting and account recovery, pagination, structured observability, and background synchronization for queued offline expenses. Cross-currency spending would require an explicit product design before adding a rate provider.
