# Liquidity Radar

Liquidity Radar is an evidence-linked private-capital intelligence product. It estimates where personal liquidity is created, who may control it, what range may remain deployable, where **known deployment** has occurred, and which people plausibly fit an opportunity.

It never claims to know bank balances. Private-liquidity figures are shown as low, median, and high estimates with confidence, calculation date, classification, evidence, and uncertainty.

## Quick start

Requires Node.js 22.13 or newer.

```bash
npm install
npm run setup
npm run dev
```

Open `http://localhost:3000`.

Demonstration accounts use the local-only password `RadarDemo!2026`:

- `customer@liquidityradar.local`
- `analyst@liquidityradar.local`
- `admin@liquidityradar.local`

The local API key is `lr_demo_local_2026`.

## Product surfaces

The demonstration includes marketing and access, dashboard, MapLibre capital map, event feed, people and organization search, person evidence ledger, regions, rankings, opportunity matching, saved searches, alerts, reports, CSV/PDF export, `/api/v1`, analyst review, source management, identity resolution, jobs, privacy requests, workspace entitlements, methodology, health, and readiness.

All named people, organizations, events, and values are fictional.

## Data and persistence

Cloudflare D1 stores workspace records and audit events. R2 is declared for source documents and generated artifacts. The included Drizzle schema models people, organizations, locations, sources, evidence claims, events, model runs, estimates, customer records, API keys, privacy requests, jobs, and audit logs.

The included connector fixtures cover Form 4 sales, multi-transaction filings, non-liquidity awards, Form 144 proposals, 8-K acquisition language, Schedule 13D ownership, malformed input, and duplicates.

## Commands

```bash
npm run setup
npm run dev
npm run build
npm run start
npm run worker
npm run format
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run validate
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:reset
npm run ingest:sec
npm run ingest:feeds
npm run estimates:recalculate
npm run aggregates:rebuild
npm run fixtures:load
```

## API

Send `Authorization: Bearer lr_demo_local_2026` in local requests.

```bash
curl http://localhost:3000/api/v1/people \
  -H "Authorization: Bearer lr_demo_local_2026"
```

OpenAPI: `http://localhost:3000/api/v1/openapi.json`.

## Documentation

See [`docs/`](./docs) for architecture, models, estimation and confidence methodology, geography, connectors, privacy, security, API, deployment, testing, operations, and limitations.

