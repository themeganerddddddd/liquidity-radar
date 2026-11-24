# Seller Intelligence completion report

Generated: 2026-11-24T03:02:17.202Z

Seller Intelligence aggregates real Cook County, DuPage County, and Illinois property-transfer records by seller. Cross-county dispositions use the same seller identity key. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | 11,781 |
| Unresolved sellers | 9,211 |
| Resolved seller entities | 2,570 |
| Confirmed/reported owners | 2,572 |
| Managers/officers found | 22 |
| $5M+ unresolved | 2,666 |
| $10M+ unresolved | 1,429 |
| $25M+ unresolved | 594 |
| $50M+ unresolved | 273 |
| $100M+ unresolved | 93 |
| Multiple-disposition sellers | 1,159 |
| Business exit candidates | 1,860 |
| Possible Exit Activity | 3,409 |
| Strong Exit Signals | 78 |
| High Exit Convergence | 0 |
| Recorded dispositions | $86.20B |
| People in Motion additions | 1,059 |
| Cross-county sellers | 57 |
| Cross-county recorded value | $1.51B |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
| SEC EDGAR transactions | LIVE | — | 2026-11-22T17:10:57.220Z | — |
| HSR early-termination notices | LIVE | — | 2026-11-22T17:10:57.220Z | — |
| GDELT transaction news | DEGRADED | 2026-08-22T17:26:20.748Z | 2026-11-23T14:55:06.326Z | GDELT CONNECT_TIMEOUT: fetch failed: ConnectTimeoutError: Connect Timeout Error (attempted address: api.gdeltproject.org:443, timeout: 10000ms) |
| CMS change of ownership | LIVE | — | 2026-11-24T03:00:50.255Z | — |
| FCC Universal Licensing System | LIVE | 2026-11-17 | 2026-11-24T03:00:50.255Z | — |
| USPTO patent assignments | LIVE | 2026-10-12T05:07:33.000Z | 2026-11-24T03:00:50.255Z | — |
| STB rail transaction dockets | LIVE | 2026-11-24T03:00:50.255Z | 2026-11-24T03:00:50.255Z | — |
| Bankruptcy asset-sale dockets | DEGRADED | — | — | CourtListener search returned 405 |
| DOJ and FTC transaction notices | LIVE | 2026-11-24 | 2026-11-24T03:00:50.255Z | — |
| Chicago Property transactions | LIVE | 2026-11-20 | 2026-11-24T02:57:20.232Z | — |
| Cook County parcel sales | LIVE | 2026-11-15T12:29:22.000Z | 2026-11-24T02:57:20.232Z | — |
| Illinois PTAX-203 transfer declarations | LIVE | 2026-11-23T12:03:02.000Z | 2026-11-24T02:57:20.232Z | — |
| Cook County and Chicago transfer forms | LIVE | 2026-11-23T12:00:24.000Z | 2026-11-24T02:57:20.232Z | — |
| Cook County parcel situs addresses | LIVE | 2026-11-15T12:28:14.000Z | 2026-11-24T02:57:20.232Z | — |
| Cook County commercial valuation | LIVE | 2025-12-30T00:08:33.000Z | 2026-11-24T02:57:20.232Z | — |
| Cook County parcel geography | LIVE | 2026-11-15T15:59:09.000Z | 2026-11-24T02:57:20.232Z | — |
| Chicago business licenses | LIVE | 2026-11-21T10:56:34.000Z | 2026-11-24T02:57:20.232Z | — |
| Chicago business owners | LIVE | 2026-11-21T10:47:22.000Z | 2026-11-24T02:57:20.232Z | — |

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
