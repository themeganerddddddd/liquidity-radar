# Feed ingestion

Feed configurations include name, URL, publisher, reliability tier, schedule, enabled state, keyword rules, and organization rules. Each item is preserved, hashed, deduplicated, classified, extracted into candidates, and routed to review. Low-confidence private proceeds are never auto-published.

The included job command runs deterministic local fixtures; live RSS/Atom retrieval requires configured public feeds and network access.

