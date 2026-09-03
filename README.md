<p align="center">
  <img src="public/logo-mark.png" alt="Pockets & Paths logo" width="84" height="84" />
</p>

# Pockets & Paths

[![CI](https://github.com/patel-jay/pockets-and-paths/actions/workflows/ci.yml/badge.svg)](https://github.com/patel-jay/pockets-and-paths/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2e7064.svg)](LICENSE)

A multi-currency budget planner for everyday life and temporary journeys.

Pockets & Paths lets one person run a recurring monthly plan alongside any number of fixed-date budgets for trips, events, relocations, or other temporary chapters. Each budget owns one currency, and every expense inside it uses that currency automatically.

![Pockets & Paths dashboard showing concurrent monthly and temporary budgets](docs/images/dashboard.png)

<p align="center">
  <img src="docs/images/dashboard-mobile.png" alt="Pockets & Paths dashboard on a mobile screen" width="360" />
</p>

## Product highlights

- Recurring monthly and fixed-date temporary budgets can be active together.
- Budget names, totals, and dates can be edited; completed plans can be archived and restored.
- Expenses inherit their budget’s currency, keeping entry and reporting unambiguous.
- Optional category limits show spent, remaining, and overspent percentages without forcing every category into an allocation.
- Expenses are never blocked by an exhausted plan; the app warns first, then records reality and shows the true overspend.
- The dashboard groups remaining and overspent balances by currency instead of presenting a misleading converted total.
- Responsive SPA navigation and an installable PWA shell work across phones and larger screens.
- A dummy login opens an isolated, cookie-backed demo profile for each browser, with logout and reset controls.

## Stack

- React 19, React Router 8, TypeScript, Vite
- TanStack Query for server-state caching
- GraphQL Yoga on a Cloudflare Worker
- Cloudflare D1 (SQLite) with prepared statements and migrations
- Recharts, Sass, Lucide icons
- Vitest, Playwright, ESLint, Prettier, GitHub Actions

```mermaid
flowchart LR
  UI[React SPA / PWA] -->|GraphQL over HTTP| API[Cloudflare Worker]
  API --> GQL[GraphQL Yoga schema]
  GQL --> DB[(Cloudflare D1)]
  UI --> CACHE[TanStack Query cache]
```

## Run locally

Prerequisite: Node.js 24+.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4173` on the development computer. The development command applies pending D1 migrations before starting. Sign in with `demo@pocketsandpaths.app` and password `pathfinder`; the Worker seeds a realistic monthly budget plus a temporary Japan budget for each isolated browser session.

To preview the app from another device on the same trusted Wi-Fi network, open the `Network` URL printed by Vite (for example, `http://192.168.x.x:4173`). If it is unavailable, allow Node.js through the computer's firewall for private networks. The local IP address may change between connections.

Seed dates are generated relative to the current month, so a newly reset demo always opens with a current monthly plan and an upcoming temporary journey.

Useful commands:

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:integration
npm run test:e2e
npm run build
```

The unit suite covers currency support, parsing, spending positions, grouped currency balances, and relative seed dates. The integration suite exercises the real Worker, GraphQL endpoint, and local D1 database—including viewer isolation, ownership checks, budget editing and archiving, currency inheritance, database reads, and overspending. A browser smoke test verifies the primary sign-in and budgeting flow.

## AI-assisted development

Codex was used as an implementation partner while product scope and architectural decisions remained human-directed. Agent-generated changes were reviewed through typed boundaries, unit and integration tests, browser checks, security auditing, and production builds; key steering decisions included removing ambiguous currency conversion and preserving existing data during schema evolution.

## Data and currency model

Money is stored as integer minor units, never as floating-point values. A budget selects its currency when it is created; expenses do not accept a separate currency or exchange rate. The profile’s default currency only preselects new budget forms. On the dashboard, balances are summed only when their currency matches and are displayed as separate groups.

Overall-budget progress can exceed 100%; remaining and overspent amounts are separate, non-negative values. A category with no limit reports spending without inventing a percentage or overspending state.

## Deployment outline

The repository is configured for a Cloudflare Worker with D1, but no production resources are committed or created.

1. Create a D1 database.
2. Replace the placeholder `database_id` in `wrangler.jsonc`.
3. Apply the checked-in migrations to the target database.
4. Build and deploy the Worker through Cloudflare.

See [architecture](docs/architecture.md), [product decisions](docs/product-decisions.md), and [security notes](docs/security.md) for the reasoning behind the implementation. The project is available under the [MIT License](LICENSE).

## Current scope

This is a focused portfolio MVP. The visible dummy login is a browser-isolated preview flow, not production authentication. External identity, cross-currency expense conversion, collaborative budgets, bank imports, and a durable offline mutation queue are intentionally outside the current release. The PWA caches the application shell; GraphQL data remains network-first.
