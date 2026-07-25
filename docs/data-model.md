# Data model

The Drizzle schema includes people, organizations, locations, source documents, evidence claims, liquidity events, known deployment events, model runs, liquidity estimates, workspaces, durable workspace records, API keys, audit logs, privacy requests, and job runs.

Every published estimate links person → estimate → model run → inputs → evidence claims → source documents. Indexes cover slugs, normalized names, CIKs, dates, publication state, confidence, amounts, workspace ownership, API-key hashes, and job status.

Amounts are integer minor-unit-compatible USD values. Private values use low/median/high fields. Soft deletion and timestamps are included where records may be withdrawn without destroying lineage.

