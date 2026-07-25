# Architecture

The deployed application is TypeScript, React, Next App Router, Vinext, Tailwind, MapLibre GL, Zod, Drizzle, Cloudflare D1, and R2. Route handlers provide workspace persistence, health, readiness, and versioned API endpoints. The worker entry is Cloudflare-compatible; the separate worker runner models long-lived ingestion and processing responsibilities.

Core deterministic logic is isolated in `lib/core.ts`; SEC parsing is isolated in `lib/sec.ts`; product UI is in `app/`; D1 schema and migrations are in `db/` and `drizzle/`; fixtures and tests are independent of React.

The hosted Sites build intentionally uses D1/R2 rather than PostgreSQL/PostGIS/MinIO. The domain model and API boundaries preserve a migration path, but this repository does not pretend the two storage stacks are interchangeable.

