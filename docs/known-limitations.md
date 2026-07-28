# Known limitations

- Demonstration people, modeled liquidity events, and person-level estimates
  are fictional. The official public-data layer contains real firms, filing
  metadata, and aggregate economic indicators.
- Live SEC metadata refresh requires a compliant `SEC_USER_AGENT`; the product
  falls back to the checked-in verified snapshot when it is absent or the SEC
  feed is unavailable.
- Public filing metadata does not prove transaction completion, cash proceeds,
  beneficial ownership, or deployable personal wealth.
- RSS/Atom sources require administrator configuration.
- Private-company coverage depends on reviewed public or user-supplied evidence.
- Known deployment is incomplete; unobserved deployment is an explicit model assumption.
- The hosted implementation uses D1/R2, not PostgreSQL/PostGIS/MinIO.
- Local demonstration authentication is not production identity. Hosted access should use Sites access policy and SIWC.
- PDF generation occurs in the browser for the demonstration.
- Stripe, email, webhook, Census geocoding, and error monitoring require
  external credentials.
