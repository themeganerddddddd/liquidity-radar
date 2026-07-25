# Operations

Use `/health` for web-process health and `/ready` for bound storage readiness. The operations console shows queue depth, running and failed jobs, last success, duration, records, and retries.

Jobs must be idempotent, retryable, observable, and auditable. Production should alert on stale ingestion, repeated retries, estimate failure rate, alert-delivery failure, API saturation, storage health, and privacy deadlines.

