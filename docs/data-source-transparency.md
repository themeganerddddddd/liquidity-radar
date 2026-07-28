# Data-source transparency

The working product includes an official public-data layer sourced from:

- SEC EDGAR current filing metadata for Form 4, Form 144, 8-K, Schedule 13D,
  and Schedule 13G;
- the SEC's July 2026 Form ADV investment-adviser roster;
- the IRS 2026 Form 990-PF e-file index;
- the Census Bureau's June 2026 Business Formation Statistics; and
- the Bureau of Economic Analysis's 2026 Q1 state real-GDP release.

`npm run data:sync-public` retrieves and validates the current official files,
normalizes them into `public/data/public-signals.json`, and fails closed if a
required national or 51-jurisdiction dataset is incomplete. The hosted
`/api/public-data` route refreshes SEC filing metadata and falls back to the
last verified snapshot when the upstream feed is unavailable.

Observed public records are not automatically treated as liquidity events.
Form 144 remains proposed activity, Form 4 may describe non-sale transactions,
and ownership schedules may reflect passive or non-cash changes. Person-level
publication still requires evidence matching and human review.

It does not depend on PitchBook, Wealth-X, Altrata, FINTRX, or another paid private database. Each source stores publisher, URL, date, hash, MIME type, preserved-object key, reliability tier, retrieval state, and licensing notes.
