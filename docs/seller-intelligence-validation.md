# Seller Intelligence completion report

Generated: 2026-08-26T04:59:23.695Z

Seller Intelligence aggregates real Cook County, DuPage County, and Illinois property-transfer records by seller. Cross-county dispositions use the same seller identity key. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | 11,053 |
| Unresolved sellers | 8,653 |
| Resolved seller entities | 2,400 |
| Confirmed/reported owners | 2,402 |
| Managers/officers found | 21 |
| $5M+ unresolved | 2,495 |
| $10M+ unresolved | 1,321 |
| $25M+ unresolved | 552 |
| $50M+ unresolved | 248 |
| $100M+ unresolved | 83 |
| Multiple-disposition sellers | 1,115 |
| Business exit candidates | 1,784 |
| Possible Exit Activity | 3,219 |
| Strong Exit Signals | 73 |
| High Exit Convergence | 0 |
| Recorded dispositions | $79.10B |
| People in Motion additions | 1,003 |
| Cross-county sellers | 50 |
| Cross-county recorded value | $1.29B |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
| SEC EDGAR transactions | LIVE | — | 2026-08-24T10:04:23.270Z | — |
| HSR early-termination notices | LIVE | — | 2026-08-24T10:04:23.270Z | — |
| GDELT transaction news | DEGRADED | 2026-08-14T05:26:20.748Z | 2026-08-22T20:47:25.581Z | GDELT CONNECT_TIMEOUT: fetch failed: ConnectTimeoutError: Connect Timeout Error (attempted address: api.gdeltproject.org:443, timeout: 10000ms) |
| CMS change of ownership | LIVE | — | 2026-08-26T04:59:00.967Z | — |
| FCC Universal Licensing System | LIVE | 2026-08-19 | 2026-08-26T04:59:00.967Z | — |
| USPTO patent assignments | DEGRADED | 2026-08-12T05:12:17.000Z | 2026-08-12T21:09:23.491Z | USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED:180357611 |
| STB rail transaction dockets | LIVE | 2026-08-26T04:59:00.967Z | 2026-08-26T04:59:00.967Z | — |
| Bankruptcy asset-sale dockets | LIVE | — | 2026-08-26T04:59:00.967Z | — |
| DOJ and FTC transaction notices | LIVE | 2026-08-26 | 2026-08-26T04:59:00.967Z | — |
| Chicago Property transactions | DEGRADED | — | — | Chicago Property snapshot unavailable. |
| Cook County parcel sales | LIVE | — | — | — |
| Illinois PTAX-203 transfer declarations | LIVE | — | — | — |
| Cook County and Chicago transfer forms | LIVE | — | — | — |
| Cook County parcel situs addresses | LIVE | — | — | — |
| Cook County commercial valuation | LIVE | — | — | — |
| Cook County parcel geography | LIVE | — | — | — |
| Chicago business licenses | LIVE | — | — | — |
| Chicago business owners | LIVE | — | — | — |

## Manual/import sources pending

- Illinois Secretary of State individual entity searches — manual audited enrichment; never bulk scraped.
- Cook County assumed-name records where no permitted machine-readable feed is available — manual/import pending.
- Manual UCC enrichment and other restricted corporate-registry sources — pending authorized data access.

Manual records store the source URL, lookup date, reviewer, and status. High-value active records become **Needs Refresh** after 30 days for $25M+, 60 days for $10M+, and 90 days otherwise.

## Product safeguards and validation

- Exact/normalized public business matching may associate a person; fuzzy candidates remain unresolved.
- Only CONFIRMED_OWNER and REPORTED_OWNER relationships support person-level attribution. Ownership percentage remains unknown unless reported.
- Multi-parcel transactions are clustered and counted once; repeated distinct transactions are aggregated by seller.
- Exit Convergence is recalculated from distinct evidence components after each four-hour sync and capped at 100.
- The API supports seller, person, location, value, disposition, resolution, exit, recency, and business-exit filters.
- Tests: targeted Seller Intelligence unit and integration contracts run in CI; the release also requires the complete `npm run validate` suite.
- Production build: the release requires a successful Vinext production build before Sites deployment.
