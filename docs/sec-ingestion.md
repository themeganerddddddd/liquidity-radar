# SEC ingestion

The connector requires a descriptive `SEC_USER_AGENT` for live use. Production discovery should apply pacing, exponential backoff, retry limits, hashes, raw preservation, and accession-based idempotency.

Included parsers cover Form 4 and Form 144 fixtures. Form 4 cash candidates require transaction code S, disposition code D, positive quantity, and positive price. Awards, gifts, grants, transfers, and non-sale exercises are excluded. Form 144 always creates a proposed event and never proves completion.

