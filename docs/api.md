# API

Versioned endpoints are under `/api/v1`. Local calls use Bearer key `lr_demo_local_2026`. Responses include request ID, data date, methodology version, range fields, classification, confidence, publication status, and cursor metadata where applicable.

The API never returns residential address or precise residential-coordinate fields. Pending-review and suppressed records are excluded. OpenAPI is served at `/api/v1/openapi.json`.

Regional intelligence endpoints include:

- `GET /api/v1/events` with full-text, geography, industry, amount, confidence, status, date, sort, cursor, and limit parameters
- `GET /api/v1/people` with relationship-region and active-region affinity filters
- `GET /api/v1/regions/{slug}`
- `GET /api/v1/regions/{slug}/people`
- `GET /api/v1/regions/{slug}/events`
- `GET /api/v1/regions/{slug}/organizations`
- `GET /api/v1/people/{id}/affinity?region={slug}`

All query parameters are schema validated. Invalid values return a structured
400 response; suppression and workspace entitlement rules remain in force.
