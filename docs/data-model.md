# Data model

The Drizzle schema includes people, organizations, locations, source documents, evidence claims, liquidity events, known deployment events, person geographic relationships, model runs, liquidity estimates, workspaces, durable workspace records, API keys, audit logs, privacy requests, and job runs.

Every published estimate links person → estimate → model run → inputs → evidence claims → source documents. Indexes cover slugs, normalized names, CIKs, dates, publication state, confidence, amounts, workspace ownership, API-key hashes, and job status.

Workspaces reference a home region, and user-scoped workspace records can retain
a recent region. Locations include normalized state, metro, county, city, and
slug lookup fields. Geographic relationships link a person to a region,
relationship type, evidence, and date; affinity remains inexpensive enough to
calculate at query time instead of storing a cache.

Amounts are integer minor-unit-compatible USD values. Private values use low/median/high fields. Soft deletion and timestamps are included where records may be withdrawn without destroying lineage.
