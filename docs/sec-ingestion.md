# SEC ingestion

The connector requires a descriptive `SEC_USER_AGENT` for live use. The public
data route retrieves current Form 4, Form 144, 8-K, Schedule 13D, and Schedule
13G Atom metadata, deduplicates issuer/reporting-party entries by accession,
caches successful results, and falls back to the last verified official
snapshot. Transaction-level production ingestion should additionally apply
pacing, exponential backoff, retry limits, hashes, raw preservation, and
accession-based idempotency.

Included parsers cover Form 4 and Form 144 fixtures. Form 4 cash candidates require transaction code S, disposition code D, positive quantity, and positive price. Awards, gifts, grants, transfers, and non-sale exercises are excluded. Form 144 always creates a proposed event and never proves completion.
